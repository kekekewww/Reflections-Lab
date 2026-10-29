import type { PhysicsWorld } from "../physics/index.js";
import type { BodyMode, Quaternion, SceneObject, Vec3 } from "../scene/types.js";
import type {
  CameraPose,
  GhostPreview,
  InteractionHostOptions,
  InteractionMode,
  InteractionSnapshot,
  StagedPlacement,
} from "./types.js";
import { InteractionError } from "./types.js";
import {
  add,
  axisAngle,
  cameraRotation,
  clamp,
  dot,
  finite,
  mul,
  multiply,
  norm,
  normalize,
  quaternion,
  rotate,
  sub,
  supportRadius,
  surfaceRotation,
  vector,
} from "./math.js";

interface HeldLease {
  objectId: string;
  generation: number;
  geometry: string;
  rotation: Quaternion;
}
const geometryKey = (o: SceneObject): string => JSON.stringify([o.shape, o.dimensionsM, o.mode]);
const dynamic = (mode: BodyMode): boolean =>
  mode === "dynamicGravity" || mode === "dynamicNoGravity";

/** Input is a proposal only: Rapier remains the authority for all body movement. */
export class InteractionHost {
  private mode: InteractionMode = "editor";
  private pointerLocked = false;
  private alternativeInput = false;
  private suspended = true;
  private pauseReason: string | null = "尚未開始第一人稱控制";
  private yaw = 0;
  private pitch = 0;
  private readonly keys = new Set<string>();
  private readonly physicalKeys = new Set<string>();
  private readonly blockedUntilRelease = new Set<string>();
  private readonly buttons = new Set<number>();
  private primaryReleaseBarrier = true;
  private heldLease: HeldLease | null = null;
  private holdDistance = 2;
  private heldRotation: Quaternion = [0, 0, 0, 1];
  private rotationToggle = false;
  private ghost: GhostPreview | null = null;
  private ghostManual = false;
  private ghostAngle = 0;
  private staged: StagedPlacement | null = null;
  private notice: string | null = null;
  private pending = false;
  private sequence = 0;
  private gentleTarget: Vec3 | null = null;
  private gentleCurrent: Vec3 | null = null;
  private gentleSupport: { objectId: string; generation: number } | null = null;
  private readonly unlockedModes = new Map<string, { mode: BodyMode; generation: number }>();
  private readonly lookSensitivity: number;
  private readonly throwImpulse: number;
  private disposed = false;

  constructor(private readonly options: InteractionHostOptions) {
    this.lookSensitivity = finite(
      options.lookSensitivity ?? 0.002,
      "lookSensitivity",
      0.0001,
      0.02,
    );
    this.throwImpulse = finite(options.throwImpulseNs ?? 6, "throwImpulseNs", 0.01, 100);
    const forward = rotate([0, 0, -1], this.listenerPose().orientationQuaternion);
    this.yaw = Math.atan2(-forward[0], -forward[2]);
    this.pitch = Math.asin(clamp(forward[1], -1, 1));
  }
  private world(): PhysicsWorld {
    if (this.disposed) throw new InteractionError("DISPOSED", "互動控制器已清理。");
    return this.options.getWorld();
  }
  private changed(): void {
    this.options.onChange?.();
  }
  private say(message: string): false {
    this.notice = message;
    this.options.onNotice?.(message);
    this.changed();
    return false;
  }
  private command(action: string): string {
    return `interaction-${action}-${++this.sequence}`;
  }
  private object(id: string): SceneObject | undefined {
    return this.options.getScene().objects.find((o) => o.id === id);
  }
  private active(): boolean {
    return (
      this.mode !== "editor" &&
      (this.pointerLocked || this.alternativeInput) &&
      !this.suspended &&
      !this.pending &&
      !this.world().paused
    );
  }
  private camera() {
    const player = this.world().getPlayerPose();
    const positionM: Vec3 = player ? [...player.eyePositionMetres] : this.listenerPose().positionM;
    return { positionM, orientationQuaternion: cameraRotation(this.yaw, this.pitch) };
  }
  private listenerPose(): CameraPose {
    const listener = this.options.getListenerPose?.() ?? this.options.getScene().listener;
    return {
      positionM: [...listener.positionM],
      orientationQuaternion: [...listener.orientationQuaternion],
    };
  }
  /** Live render/listener pose; avoids unrelated hover and interaction projections. */
  getFPSCamera() {
    return this.mode === "editor" ? undefined : this.camera();
  }
  private forward(): Vec3 {
    return rotate([0, 0, -1], cameraRotation(this.yaw, this.pitch));
  }
  private target(): Vec3 {
    return add(this.camera().positionM, mul(this.forward(), this.holdDistance));
  }
  private clearInput(): void {
    for (const code of this.physicalKeys) this.blockedUntilRelease.add(code);
    this.keys.clear();
    this.buttons.clear();
    this.rotationToggle = false;
    this.world().setPlayerInput({ forward: 0, right: 0, yaw: this.yaw, sprint: false });
  }
  private captureLease(): void {
    const id = this.world().heldObjectId;
    if (!id) {
      this.heldLease = null;
      return;
    }
    const object = this.object(id);
    if (!object) return;
    const pose = this.world().getPose(id);
    this.heldLease = {
      objectId: id,
      generation: pose.generation,
      geometry: geometryKey(object),
      rotation: [...pose.rotation],
    };
    this.heldRotation = [...pose.rotation];
  }

  enterFPS(options: { pointerLocked?: boolean } = {}): boolean {
    const world = this.world();
    try {
      if (!world.snapshot().player) {
        const listener = this.listenerPose().positionM;
        world.createPlayer(
          this.options.spawnFootPositionM ?? [listener[0], listener[1] - 1.6, listener[2]],
        );
      }
    } catch (error) {
      return this.say(
        `無法進入第一人稱：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (this.mode === "editor") this.mode = "fps-interact";
    this.suspended = true;
    this.pauseReason = this.alternativeInput
      ? "輔助操作已選用；請明確開始／繼續"
      : "請明確開始／繼續並確認滑鼠鎖定";
    world.pause();
    this.clearInput();
    this.captureLease();
    this.pointerLocked = options.pointerLocked ?? false;
    this.primaryReleaseBarrier = true;
    this.changed();
    return true;
  }
  /** Only confirm the browser's actual native Pointer Lock ownership. */
  confirmPointerLock(locked: boolean): void {
    if (locked) {
      this.pointerLocked = true;
      this.primaryReleaseBarrier = true;
      this.keys.clear();
      this.buttons.clear();
      this.changed();
    } else this.suspend("滑鼠已解鎖；明確繼續後恢復");
  }
  /**
   * Explicit accessible keyboard/button mode. DOM focus, typing and IME remain
   * the input router's responsibility; this grants no browser lock or auto-resume.
   */
  setAlternativeInput(enabled: boolean): void {
    if (typeof enabled !== "boolean")
      throw new InteractionError("INVALID_INPUT", "輔助操作設定必須為布林值。");
    if (this.alternativeInput === enabled) return;
    this.alternativeInput = enabled;
    this.suspend(
      enabled
        ? "已選用不鎖定滑鼠的輔助操作；請明確開始／繼續"
        : "已關閉輔助操作；請取得滑鼠鎖定後明確繼續",
    );
  }
  resume(): boolean {
    const world = this.world();
    if (this.mode === "editor" || (!this.pointerLocked && !this.alternativeInput))
      return this.say("必須先進入第一人稱，並取得滑鼠鎖定或明確選用輔助操作。");
    if (this.pending) return this.say("交易尚未完成。");
    if (this.staged) return this.say("請先明確啟用或取消待啟用物件，再繼續模擬。");
    if (this.heldLease) {
      const saved = this.heldLease,
        object = this.object(saved.objectId);
      try {
        const pose = world.getPose(saved.objectId);
        if (
          world.heldObjectId !== saved.objectId ||
          pose.generation !== saved.generation ||
          !object ||
          geometryKey(object) !== saved.geometry ||
          !pose.enabled ||
          !dynamic(pose.mode)
        ) {
          return this.say("持有物件的版本或幾何已變更；維持暫停，請明確釋放或回復場景。");
        }
        const target = {
          ...object,
          positionM: this.target(),
          orientationQuaternion: [...saved.rotation] as Quaternion,
        };
        if (!world.validatePlacement(target, saved.objectId).valid)
          return this.say("恢復抓取的目標空間受阻；維持暫停。");
      } catch {
        return this.say("持有物件已失效；維持暫停，請明確釋放或回復場景。");
      }
    }
    if (this.gentleTarget && !this.refreshGentleSupport()) {
      return this.say("輕放支撐已失效；已取消輕放並保留持有，請重新確認後繼續。");
    }
    if (this.ghost) {
      this.validateGhost();
      if (this.ghost.stage === "pending") return this.say("放置交易尚未完成。");
    }
    this.clearInput();
    try {
      world.resume();
    } catch (error) {
      world.pause();
      this.suspended = true;
      this.pauseReason = "恢復前的物理驗證失敗";
      return this.say(`無法恢復：${error instanceof Error ? error.message : String(error)}`);
    }
    this.suspended = false;
    this.pauseReason = null;
    this.notice = null;
    this.changed();
    return true;
  }
  suspend(reason = "已暫停"): void {
    this.pauseControl(reason, true);
  }
  /** Ordinary pause does not imply the browser released its actual Pointer Lock. */
  pausePreservingInputMode(reason = "已暫停"): void {
    this.pauseControl(reason, false);
  }
  private pauseControl(reason: string, releasePointer: boolean): void {
    const world = this.world();
    this.captureLease();
    world.pause();
    this.suspended = true;
    if (releasePointer) this.pointerLocked = false;
    this.pauseReason = reason;
    this.clearInput();
    this.primaryReleaseBarrier = true;
    this.options.onAudioFade?.(reason);
    this.options.onPause?.(reason);
    this.changed();
  }
  exitFPS(): void {
    this.suspend("已離開第一人稱；持有／預覽狀態保留");
    this.mode = "editor";
    this.changed();
  }
  setBuild(build: boolean): boolean {
    if (this.world().heldObjectId) return this.say("持有物件時不能切換建造；請明確釋放或輕放。");
    if (this.pending) return this.say("放置交易尚未完成。");
    this.mode = build ? "fps-build" : "fps-interact";
    this.rotationToggle = false;
    this.gentleTarget = null;
    this.changed();
    return true;
  }

  handleKey(code: string, pressed: boolean): void {
    if (!pressed) {
      this.keys.delete(code);
      this.physicalKeys.delete(code);
      this.blockedUntilRelease.delete(code);
      this.changed();
      return;
    }
    if (this.physicalKeys.has(code)) return;
    this.physicalKeys.add(code);
    if (code === "Escape" || code === "Tab") {
      this.suspend(code === "Tab" ? "已切換至介面焦點" : "使用者暫停第一人稱");
      return;
    }
    if (!this.active()) {
      this.blockedUntilRelease.add(code);
      return;
    }
    if (this.blockedUntilRelease.has(code)) return;
    this.keys.add(code);
    if (code === "KeyE") {
      if (this.world().heldObjectId) this.drop();
      else this.grab();
    } else if (code === "KeyB") this.setBuild(this.mode !== "fps-build");
    else if (code === "KeyG") this.gentlePlace();
    else if (code === "KeyF") void this.toggleFixed().catch((error) => this.say(String(error)));
    else if (code === "KeyL" && this.mode === "fps-build") {
      this.suspend("物件資料庫已開啟");
      this.options.onLibrary?.();
    } else if (code === "KeyR" && this.mode === "fps-build")
      this.rotationToggle = !this.rotationToggle;
    this.changed();
  }
  setRotationToggle(enabled: boolean): void {
    this.rotationToggle = enabled;
    this.changed();
  }
  handleLook(movementX: number, movementY: number): void {
    finite(movementX, "movementX");
    finite(movementY, "movementY");
    if (!this.active()) return;
    const dx = clamp(movementX, -500, 500) * this.lookSensitivity,
      dy = clamp(movementY, -500, 500) * this.lookSensitivity;
    if (this.mode === "fps-build" && this.ghost && this.rotationToggle) {
      this.ghostAngle -= dx;
      this.updateGhost();
    } else if (this.world().heldObjectId && (this.keys.has("KeyR") || this.rotationToggle)) {
      this.heldRotation = multiply(
        axisAngle([0, 1, 0], -dx),
        multiply(this.heldRotation, axisAngle([1, 0, 0], -dy)),
      );
      this.world().updateGrabTarget(this.target(), this.heldRotation);
      this.gentleTarget = null;
    } else {
      this.yaw =
        ((((this.yaw - dx + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      this.pitch = clamp(this.pitch - dy, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      if (this.ghost) this.updateGhost();
    }
    this.changed();
  }
  handlePointer(button: number, pressed: boolean): void {
    if (!Number.isSafeInteger(button) || button < 0 || button > 4)
      throw new InteractionError("INVALID_INPUT", "無效滑鼠按鈕。");
    if (!pressed) {
      this.buttons.delete(button);
      if (button === 0) this.primaryReleaseBarrier = false;
      return;
    }
    if (this.buttons.has(button)) return;
    this.buttons.add(button);
    if (!this.active() || (button === 0 && this.primaryReleaseBarrier)) return;
    if (button === 0) {
      if (this.mode === "fps-build") void this.place().catch((error) => this.say(String(error)));
      else this.throw();
    }
    if (button === 2 && this.mode === "fps-build") this.cancelPreview();
  }
  handleWheel(deltaY: number): void {
    finite(deltaY, "wheel delta");
    if (!this.active()) return;
    if (this.world().heldObjectId || this.ghost) {
      const object = this.world().heldObjectId
        ? this.object(this.world().heldObjectId!)
        : this.ghost?.draft;
      const radius = object ? Math.hypot(...object.dimensionsM) / 2 : 0;
      const minimum = Math.max(0.75, 0.25 + radius + 0.1);
      this.holdDistance = clamp(this.holdDistance + clamp(deltaY, -100, 100) * 0.002, minimum, 3);
      if (this.ghost) this.updateGhost();
      this.gentleTarget = null;
      this.changed();
    }
  }

  grab(): boolean {
    const world = this.world();
    if (!this.active() || this.mode !== "fps-interact")
      return this.say("抓取需要正在運行的第一人稱互動模式。");
    if (world.heldObjectId) return this.say("已有持有物件。");
    const camera = this.camera(),
      hit = world.raycast(camera.positionM, this.forward(), 3);
    if (!hit) return this.say("三公尺內沒有可抓取物件。");
    if (!hit.grabbable) return this.say("第一個命中物件已固定、受控或超過抓取預算。");
    const object = this.object(hit.objectId);
    if (!object) return this.say("物件已移除。");
    const minimum = Math.max(0.75, 0.25 + Math.hypot(...object.dimensionsM) / 2 + 0.1);
    if (minimum > 3) return this.say("物件太大，沒有合法持有距離。");
    const pose = world.getPose(hit.objectId);
    this.holdDistance = clamp(norm(sub(pose.positionMetres, camera.positionM)), minimum, 3);
    if (!world.grab(hit.objectId, pose.positionMetres, this.command("grab"))) return false;
    this.heldRotation = [...pose.rotation];
    this.captureLease();
    this.gentleTarget = null;
    this.notice = null;
    this.changed();
    return true;
  }
  /** An explicit Release remains available while paused; it applies no impulse. */
  drop(): boolean {
    const accepted = this.world().drop(this.command("drop"));
    if (accepted) {
      this.heldLease = null;
      this.gentleTarget = null;
      this.gentleCurrent = null;
      this.rotationToggle = false;
      this.changed();
    }
    return accepted;
  }
  throw(): boolean {
    if (!this.active() || this.mode !== "fps-interact")
      return this.say("投擲需要運行中的第一人稱互動。");
    const accepted = this.world().throwHeld(
      this.forward(),
      this.throwImpulse,
      this.command("throw"),
    );
    if (accepted) {
      this.heldLease = null;
      this.gentleTarget = null;
      this.rotationToggle = false;
      this.changed();
    }
    return accepted;
  }
  gentlePlace(): boolean {
    const world = this.world(),
      id = world.heldObjectId;
    if (!this.active() || !id) return this.say("輕放需要正在持有物件。");
    const object = this.object(id);
    if (!object) return false;
    const pose = world.getPose(id);
    const hit = world.raycast(pose.positionMetres, [0, -1, 0], 2, [id]);
    if (!hit || dot(hit.normal, [0, 1, 0]) < 0.7)
      return this.say("沒有合法支撐面；仍維持持有，未自動釋放。");
    const target = add(
      hit.pointMetres,
      mul(hit.normal, supportRadius(object, hit.normal, pose.rotation) + 0.01),
    );
    if (
      !world.validatePlacement(
        { ...object, positionM: target, orientationQuaternion: pose.rotation },
        id,
      ).valid
    )
      return this.say("輕放位置受阻；仍維持持有。");
    this.gentleTarget = target;
    this.gentleCurrent = [...pose.positionMetres];
    this.gentleSupport = {
      objectId: hit.objectId,
      generation: world.getPose(hit.objectId).generation,
    };
    this.notice = "正在低速輕放";
    this.changed();
    return true;
  }
  private refreshGentleSupport(): boolean {
    const world = this.world(),
      id = world.heldObjectId,
      support = this.gentleSupport;
    const cancel = (): false => {
      this.gentleTarget = null;
      this.gentleCurrent = null;
      this.gentleSupport = null;
      return false;
    };
    if (!id || !support) return cancel();
    const object = this.object(id);
    if (!object) return cancel();
    try {
      const pose = world.getPose(id),
        supportPose = world.getPose(support.objectId);
      if (supportPose.generation !== support.generation || !supportPose.enabled) return cancel();
      const hit = world.raycast(pose.positionMetres, [0, -1, 0], 2, [id]);
      if (!hit || hit.objectId !== support.objectId || dot(hit.normal, [0, 1, 0]) < 0.7)
        return cancel();
      const target = add(
        hit.pointMetres,
        mul(hit.normal, supportRadius(object, hit.normal, pose.rotation) + 0.01),
      );
      if (
        !world.validatePlacement(
          { ...object, positionM: target, orientationQuaternion: pose.rotation },
          id,
        ).valid
      )
        return cancel();
      this.gentleTarget = target;
      return true;
    } catch {
      return cancel();
    }
  }
  async toggleFixed(): Promise<boolean> {
    if (this.pending) return false;
    const world = this.world(),
      id =
        world.heldObjectId ?? world.raycast(this.camera().positionM, this.forward(), 3)?.objectId;
    if (!id) return this.say("沒有明確固定／解除目標。");
    const object = this.object(id);
    if (!object) return false;
    const generation = world.getPose(id).generation;
    const expectedRevision = this.options.getScene().sceneRevision;
    let target: BodyMode;
    if (object.mode === "fixed") {
      const previous = this.unlockedModes.get(id);
      if (!previous || previous.generation !== generation) {
        this.unlockedModes.delete(id);
        return this.say("沒有此物件版本的先前重力模式；請在Inspector明確選擇。");
      }
      target = previous.mode;
    } else if (dynamic(object.mode)) {
      this.unlockedModes.delete(id);
      target = "fixed";
    } else return this.say("受控運動物件需先在Inspector明確解除控制。");
    this.suspend(target === "fixed" ? "正在固定物件" : "正在解除固定，速度預設為零");
    this.pending = true;
    this.changed();
    const rememberAppliedMode = () => {
      if (target === "fixed")
        this.unlockedModes.set(id, {
          mode: object.mode,
          generation,
        });
      else this.unlockedModes.delete(id);
      this.heldLease = null;
      this.gentleTarget = null;
    };
    try {
      const unlockPlacement = (expectedMode: BodyMode) => {
        const current = this.object(id);
        if (this.world() !== world)
          throw new InteractionError("REVISION_CONFLICT", "解除固定的物理世界已變更。");
        if (!current) throw new InteractionError("REVISION_CONFLICT", "解除固定的物件已移除。");
        const pose = world.getPose(id);
        if (
          pose.generation !== generation ||
          current.mode !== expectedMode ||
          pose.mode !== expectedMode ||
          !pose.enabled
        )
          throw new InteractionError("REVISION_CONFLICT", "解除固定的物件版本或模式已變更。");
        // Authoring transforms can lag solver motion. Clearance belongs to the
        // actual frozen body pose, excluding only that same entity's colliders.
        return world.validatePlacement(
          {
            ...current,
            mode: target,
            positionM: [...pose.positionMetres],
            orientationQuaternion: [...pose.rotation],
          },
          id,
        );
      };
      const guardUnlock = () => {
        if (this.options.getScene().sceneRevision !== expectedRevision)
          throw new InteractionError("REVISION_CONFLICT", "解除固定前的場景版本已變更。");
        if (!unlockPlacement("fixed").valid)
          throw new InteractionError(
            "UNLOCK_BLOCKED",
            "解除固定位置受阻；物件保持固定，可清除障礙後重試。",
          );
      };
      if (target !== "fixed") guardUnlock();
      await this.options.commitSceneOperations(
        [{ type: "SetObjectMode", objectId: id, mode: target }],
        target === "fixed" ? undefined : guardUnlock,
      );
      if (target !== "fixed") {
        // Never consume the restore record for a replaced body or a later user
        // transaction. Clearance was guarded at the atomic apply boundary.
        if (this.options.getScene().sceneRevision !== expectedRevision + 1)
          throw new InteractionError("REVISION_CONFLICT", "解除固定後的場景版本已變更。");
        unlockPlacement(target);
      }
      rememberAppliedMode();
      this.notice =
        target === "fixed" ? "已固定；另按繼續才恢復模擬" : "已解除固定，初速為零；另按繼續";
      return true;
    } catch (error) {
      // An adapter's observer can fail after its atomic document/body commit.
      // Report that outcome accurately; never overwrite a later transaction.
      if (
        this.world() === world &&
        this.options.getScene().sceneRevision === expectedRevision + 1
      ) {
        const current = this.object(id);
        if (current?.mode === target) {
          const pose = world.getPose(id);
          if (pose.mode === target && pose.generation === generation) {
            rememberAppliedMode();
            return this.say(
              `${target === "fixed" ? "已固定" : "已解除固定"}；模擬保持暫停，但後續同步失敗：${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
      return this.say(`模式交易失敗：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.pending = false;
      this.changed();
    }
  }

  beginBuild(draft: SceneObject): boolean {
    if (this.world().heldObjectId) return this.say("請先明確釋放持有物件。");
    if (this.pending || this.staged) return this.say("請先完成或取消目前放置。");
    if (this.options.getScene().objects.some((o) => o.id === draft.id))
      return this.say("預覽必須使用新的穩定物件ID。");
    this.mode = "fps-build";
    this.ghost = {
      draft: structuredClone(draft),
      valid: false,
      reason: "尚未取得表面",
      blockingObjectIds: [],
      surfaceObjectId: null,
      stage: "preview",
    };
    this.ghostManual = false;
    this.ghostAngle = 0;
    this.updateGhost();
    this.changed();
    return true;
  }
  /** Accessible coordinate alternative: still uses the same full Rapier shape query. */
  setGhostPose(
    positionM: Vec3,
    orientation: Quaternion = this.ghost?.draft.orientationQuaternion ?? [0, 0, 0, 1],
  ): boolean {
    if (!this.ghost || this.pending) return false;
    this.ghost.draft.positionM = vector(positionM, "ghost position");
    this.ghost.draft.orientationQuaternion = quaternion(orientation);
    this.ghostManual = true;
    this.ghost.surfaceObjectId = null;
    this.validateGhost();
    this.changed();
    return this.ghost.valid;
  }
  private validateGhost(): void {
    if (!this.ghost) return;
    try {
      const camera = this.camera();
      if (norm(sub(this.ghost.draft.positionM, camera.positionM)) > 3.5) {
        this.ghost.valid = false;
        this.ghost.reason = "放置位置超出範圍";
        this.ghost.blockingObjectIds = [];
        return;
      }
      const result = this.world().validatePlacement(this.ghost.draft);
      this.ghost.valid = result.valid;
      this.ghost.reason = result.valid ? "可放置" : result.reason;
      this.ghost.blockingObjectIds = result.blockingObjectIds;
    } catch (error) {
      this.ghost.valid = false;
      this.ghost.reason = error instanceof Error ? error.message : String(error);
      this.ghost.blockingObjectIds = [];
    }
  }
  private updateGhost(): void {
    if (!this.ghost || this.ghost.stage !== "preview") return;
    if (this.ghostManual) {
      this.validateGhost();
      return;
    }
    const camera = this.camera(),
      hit = this.world().raycast(camera.positionM, this.forward(), this.holdDistance);
    if (!hit) {
      this.ghost.valid = false;
      this.ghost.reason = "沒有可放置表面";
      this.ghost.surfaceObjectId = null;
      return;
    }
    const step = Math.PI / 12,
      angle = Math.round(this.ghostAngle / step) * step;
    const rotation = surfaceRotation(hit.normal, angle);
    const outward = supportRadius(this.ghost.draft, hit.normal, rotation) + 0.01;
    let position = add(hit.pointMetres, mul(hit.normal, outward));
    // Grid snapping only changes tangent coordinates; it must never move into the support surface.
    const normal = normalize(hit.normal),
      helper: Vec3 = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const tangent = normalize([
      normal[1] * helper[2] - normal[2] * helper[1],
      normal[2] * helper[0] - normal[0] * helper[2],
      normal[0] * helper[1] - normal[1] * helper[0],
    ]);
    const bitangent: Vec3 = [
      normal[1] * tangent[2] - normal[2] * tangent[1],
      normal[2] * tangent[0] - normal[0] * tangent[2],
      normal[0] * tangent[1] - normal[1] * tangent[0],
    ];
    const t = dot(position, tangent),
      b = dot(position, bitangent);
    position = add(
      position,
      add(
        mul(tangent, Math.round(t / 0.1) * 0.1 - t),
        mul(bitangent, Math.round(b / 0.1) * 0.1 - b),
      ),
    );
    this.ghost.draft.positionM = position;
    this.ghost.draft.orientationQuaternion = rotation;
    this.ghost.surfaceObjectId = hit.objectId;
    this.validateGhost();
  }
  async place(): Promise<boolean> {
    if (!this.ghost || this.pending || this.staged) return false;
    this.updateGhost();
    if (!this.ghost.valid) return this.say(`無法放置：${this.ghost.reason}`);
    this.suspend("放置確認：已安全暫停，建立待啟用物件");
    this.validateGhost();
    if (!this.ghost.valid) return this.say(`位置已被占用：${this.ghost.reason}`);
    const beforeRevision = this.options.getScene().sceneRevision;
    const ghost = this.ghost,
      desiredMode = ghost.draft.mode,
      draft = { ...structuredClone(ghost.draft), mode: "fixed" as const };
    ghost.stage = "pending";
    this.pending = true;
    this.changed();
    try {
      await this.options.commitSceneOperations([{ type: "AddObject", object: draft }]);
      const world = this.world();
      world.pause();
      world.setObjectEnabled(draft.id, false);
      this.staged = {
        objectId: draft.id,
        desiredMode,
        sceneRevision: this.options.getScene().sceneRevision,
        geometryAcknowledged: false,
      };
      this.ghost = null;
      this.ghostManual = false;
      if (this.options.confirmGeometry) {
        try {
          const stagedRevision = this.staged.sceneRevision;
          const acknowledged = await this.options.confirmGeometry(draft.id, stagedRevision);
          this.staged.geometryAcknowledged =
            acknowledged && this.options.getScene().sceneRevision === stagedRevision;
        } catch (error) {
          // Document/body creation succeeded. Keep one disabled, repairable staged
          // entity rather than resurrecting a second preview with the same ID.
          this.staged.geometryAcknowledged = false;
          this.notice = `幾何確認失敗；物件保持待啟用，可重試或取消：${error instanceof Error ? error.message : String(error)}`;
          return true;
        }
      }
      this.notice = "已建立待啟用物件；幾何確認後需明確啟用，再另按繼續。";
      return true;
    } catch (error) {
      const committed = this.object(draft.id);
      if (committed && this.options.getScene().sceneRevision > beforeRevision) {
        // The adapter must commit atomically, but a later runtime observer may
        // still fail. Retain a single explicit recovery state and fail closed.
        this.world().pause();
        try {
          this.world().setObjectEnabled(draft.id, false);
        } catch {
          /* Recovery remains explicit below. */
        }
        this.staged = {
          objectId: draft.id,
          desiredMode,
          sceneRevision: this.options.getScene().sceneRevision,
          geometryAcknowledged: false,
        };
        this.ghost = null;
      } else {
        ghost.stage = "preview";
        this.ghost = ghost;
      }
      return this.say(`放置失敗：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.pending = false;
      this.changed();
    }
  }
  acknowledgeStaged(objectId: string, sceneRevision: number): boolean {
    if (
      !this.staged ||
      this.staged.objectId !== objectId ||
      this.staged.sceneRevision !== sceneRevision ||
      this.options.getScene().sceneRevision !== sceneRevision
    )
      return this.say("幾何確認的物件／版本已失效。");
    this.staged.geometryAcknowledged = true;
    this.changed();
    return true;
  }
  async enableStaged(): Promise<boolean> {
    const staged = this.staged;
    if (!staged || this.pending) return false;
    if (!staged.geometryAcknowledged) return this.say("尚待聲學幾何確認，不能啟用。");
    const object = this.object(staged.objectId),
      world = this.world();
    if (!object || this.options.getScene().sceneRevision !== staged.sceneRevision)
      return this.say("待啟用物件或場景版本已變更，請重新確認。");
    if (!world.validatePlacement(object, object.id).valid) return this.say("待啟用位置已被占用。");
    this.pending = true;
    this.changed();
    try {
      await this.options.commitSceneOperations([
        { type: "SetObjectMode", objectId: object.id, mode: staged.desiredMode },
      ]);
      this.world().pause();
      this.world().setObjectEnabled(object.id, true);
      this.staged = null;
      this.notice = "物件已啟用；模擬仍暫停，另按繼續。";
      return true;
    } catch (error) {
      // A failed final enable must never leave an untracked active body.
      try {
        this.world().pause();
        this.world().setObjectEnabled(object.id, false);
      } catch {
        /* The recovery notice still identifies the object. */
      }
      if (this.object(object.id)) {
        this.staged = {
          ...staged,
          sceneRevision: this.options.getScene().sceneRevision,
          geometryAcknowledged: false,
        };
      }
      return this.say(`啟用失敗：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.pending = false;
      this.changed();
    }
  }
  cancelPreview(): void {
    if (this.pending) return;
    this.ghost = null;
    this.ghostManual = false;
    this.rotationToggle = false;
    this.changed();
  }
  async cancelStaged(): Promise<boolean> {
    if (!this.staged || this.pending) return false;
    const staged = this.staged;
    this.pending = true;
    try {
      await this.options.commitSceneOperations([
        { type: "RemoveObject", objectId: staged.objectId },
      ]);
      this.staged = null;
      return true;
    } catch (error) {
      return this.say(`取消待啟用物件失敗：${String(error)}`);
    } finally {
      this.pending = false;
      this.changed();
    }
  }

  beforeStep(): void {
    const world = this.world();
    if (!this.active()) {
      world.setPlayerInput({ forward: 0, right: 0, yaw: this.yaw, sprint: false });
      return;
    }
    const forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
      right = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    world.setPlayerInput({
      forward,
      right,
      yaw: this.yaw,
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
    });
    if (world.heldObjectId) {
      if (this.gentleTarget && this.gentleCurrent) {
        if (!this.refreshGentleSupport()) {
          this.say("輕放支撐或空間已失效；已取消輕放，仍維持持有。");
          return;
        }
        const delta = sub(this.gentleTarget, this.gentleCurrent),
          step = 0.35 * world.fixedDtSeconds;
        this.gentleCurrent = add(
          this.gentleCurrent,
          mul(normalize(delta), Math.min(norm(delta), step)),
        );
        world.updateGrabTarget(this.gentleCurrent, this.heldRotation);
        const pose = world.getPose(world.heldObjectId);
        if (
          norm(sub(pose.positionMetres, this.gentleTarget)) < 0.035 &&
          norm(pose.linearVelocityMetresPerSecond) < 0.12
        ) {
          if (this.refreshGentleSupport()) this.drop();
        }
      } else world.updateGrabTarget(this.target(), this.heldRotation);
    } else if (this.heldLease) {
      this.heldLease = null;
      this.gentleTarget = null;
    }
    if (this.ghost) this.updateGhost();
  }
  snapshot(): InteractionSnapshot {
    const camera = this.camera();
    const hover =
      this.mode !== "editor" ? this.world().raycast(camera.positionM, this.forward(), 3) : null;
    return structuredClone({
      mode: this.mode,
      pointerLocked: this.pointerLocked,
      alternativeInput: this.alternativeInput,
      suspended: this.suspended,
      pauseReason: this.pauseReason,
      camera,
      hover,
      heldObjectId: this.world().heldObjectId,
      holdDistanceM: this.holdDistance,
      rotating: this.keys.has("KeyR") || this.rotationToggle,
      ghost: this.ghost,
      staged: this.staged,
      notice: this.notice,
      pending: this.pending,
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.clearInput();
    this.disposed = true;
    this.keys.clear();
    this.buttons.clear();
  }
}
