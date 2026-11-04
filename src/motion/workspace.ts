import { canonicalStringify } from "../experiments/hash.js";
import { createScene } from "../scene/index.js";
import type { Quaternion, SceneSpec, Vec3 } from "../scene/types.js";
import type { BodyPose, PhysicsSnapshot } from "../physics/types.js";
import type { PhysicsWorld } from "../physics/physics-world.js";
import {
  createMotionAction,
  createMotionRegistry,
  pinMotionScene,
  validateMotionRegistry,
  MAX_MOTION_ACTIONS,
} from "./registry.js";
import {
  MotionError,
  type MotionAction,
  type MotionActionInput,
  type MotionRegistryDocument,
  type MotionRunReceipt,
  type MotionRunStatus,
  type MotionSample,
  type MotionWorkspaceOptions,
  type MotionWorkspaceView,
} from "./types.js";

const copy = <T>(value: T): T => structuredClone(value);
const sub = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]!) as Vec3;
const scale = (a: Vec3, k: number): Vec3 => a.map((v) => v * k) as Vec3;
const norm = (a: Vec3): number => Math.hypot(...a);
const bounded = (a: Vec3, limit: number): Vec3 => (norm(a) > limit ? scale(a, limit / norm(a)) : a);
const dynamic = (mode: BodyPose["mode"]): boolean =>
  mode === "dynamicGravity" || mode === "dynamicNoGravity";
const zero = (): Vec3 => [0, 0, 0];
function angularDelta(from: Quaternion, to: Quaternion): Vec3 {
  const [x, y, z, w] = to,
    [a, b, c, d] = from;
  let q: Quaternion = [
    x * d - w * a - y * c + z * b,
    y * d - w * b - z * a + x * c,
    z * d - w * c - x * b + y * a,
    w * d + x * a + y * b + z * c,
  ];
  if (q[3] < 0) q = q.map((v) => -v) as Quaternion;
  const length = Math.hypot(q[0], q[1], q[2]);
  if (length < 1e-10) return zero();
  return scale([q[0], q[1], q[2]], (2 * Math.atan2(length, Math.max(0, q[3]))) / length);
}
function slerp(a: Quaternion, original: Quaternion, alpha: number): Quaternion {
  let b = original,
    dot = a.reduce((sum, v, i) => sum + v * b[i]!, 0);
  if (dot < 0) {
    b = b.map((v) => -v) as Quaternion;
    dot = -dot;
  }
  if (dot > 0.9995) {
    const q = a.map((v, i) => v + (b[i]! - v) * alpha);
    return q.map((v) => v / Math.hypot(...q)) as Quaternion;
  }
  const angle = Math.acos(Math.min(1, dot)),
    denominator = Math.sin(angle);
  return a.map(
    (v, i) => (v * Math.sin((1 - alpha) * angle) + b[i]! * Math.sin(alpha * angle)) / denominator,
  ) as Quaternion;
}
function trajectoryAt(samples: MotionSample[], timeS: number): MotionSample {
  if (timeS >= samples.at(-1)!.timeS) return copy(samples.at(-1)!);
  const i = Math.max(
    1,
    samples.findIndex((sample) => sample.timeS >= timeS),
  );
  const a = samples[i - 1]!,
    b = samples[i]!;
  const alpha = Math.max(0, (timeS - a.timeS) / (b.timeS - a.timeS));
  return {
    timeS,
    positionM: a.positionM.map((v, axis) => v + (b.positionM[axis]! - v) * alpha) as Vec3,
    orientationQuaternion: slerp(a.orientationQuaternion, b.orientationQuaternion, alpha),
  };
}
interface ActiveRun {
  action: MotionAction;
  receipt: MotionRunReceipt;
  epoch: number;
  settled: number;
  blockedTicks: number;
  lastDistance: number;
  previousPose: BodyPose;
  linear: Vec3;
  angular: Vec3;
  impulseApplied: boolean;
}

/** Versioned authoring sidecar and one collision-preserving controller per body. */
export class MotionWorkspace {
  private document: MotionRegistryDocument;
  private undoStack: MotionRegistryDocument[] = [];
  private redoStack: MotionRegistryDocument[] = [];
  private active = new Map<string, ActiveRun>();
  private receipts: MotionRunReceipt[] = [];
  private commands = new Map<string, { signature: string; receipt: MotionRunReceipt }>();
  private unobserve: (() => void) | null = null;
  private sequence = 0;
  private mutating = false;
  private disposed = false;
  private subscribers = new Set<() => void>();
  private cachedView: MotionWorkspaceView | null = null;
  private cachedEpoch = -1;
  private world: PhysicsWorld;
  static async create(
    scene: SceneSpec,
    world: PhysicsWorld,
    options: MotionWorkspaceOptions,
  ): Promise<MotionWorkspace> {
    return new MotionWorkspace(await createMotionRegistry(scene), world, options);
  }
  private constructor(
    document: MotionRegistryDocument,
    world: PhysicsWorld,
    private options: MotionWorkspaceOptions,
  ) {
    this.document = document;
    this.world = world;
    this.attach();
  }
  private attach(): void {
    this.unobserve = this.world.observeFixedSteps({
      beforeStep: () => this.beforeStep(),
      afterStep: (snapshot) => this.afterStep(snapshot),
    });
  }
  bindWorld(world: PhysicsWorld): void {
    if (this.disposed) throw new MotionError("MOTION_DISPOSED", "Motion workspace is disposed.");
    this.cancelAll("world-replaced");
    this.unobserve?.();
    this.world = world;
    this.attach();
    this.changed();
  }
  getSnapshot(): MotionRegistryDocument {
    return copy(this.document);
  }
  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }
  getView(): MotionWorkspaceView {
    if (
      this.cachedView &&
      this.cachedEpoch === this.world.resetEpoch &&
      this.cachedView.document.scenePin.sceneRevision === this.options.getScene().sceneRevision
    )
      return this.cachedView;
    this.cachedEpoch = this.world.resetEpoch;
    const scene = this.options.getScene();
    const generationStale = this.document.actions.some((action) => {
      try {
        return this.world.getPose(action.objectId).generation !== action.generation;
      } catch {
        return true;
      }
    });
    this.cachedView = {
      document: this.getSnapshot(),
      runs: copy(this.receipts),
      activeRunIds: [...this.active.values()].map((run) => run.receipt.runId),
      stale:
        generationStale ||
        scene.sceneId !== this.document.scenePin.sceneId ||
        scene.sceneRevision !== this.document.scenePin.sceneRevision,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
    };
    return this.cachedView;
  }
  private changed(): void {
    this.cachedView = null;
    this.options.onChange?.();
    for (const listener of this.subscribers) listener();
  }
  private assertRevision(expected: number): void {
    if (expected !== this.document.revision)
      throw new MotionError(
        "MOTION_REVISION_CONFLICT",
        "Motion registry changed; refresh the draft.",
      );
  }
  private authoring(): void {
    if (!this.world.paused || this.active.size)
      throw new MotionError(
        "MOTION_AUTHORING_BUSY",
        "Pause the simulation and cancel active motion before editing actions.",
      );
  }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.disposed) throw new MotionError("MOTION_DISPOSED", "Motion workspace is disposed.");
    if (this.mutating)
      throw new MotionError("MOTION_TRANSACTION_BUSY", "Another motion transaction is pending.");
    this.mutating = true;
    try {
      return await operation();
    } finally {
      this.mutating = false;
    }
  }
  private install(candidate: MotionRegistryDocument, history = true): void {
    if (history) {
      this.undoStack.push(this.getSnapshot());
      if (this.undoStack.length > 64) this.undoStack.shift();
      this.redoStack = [];
    }
    this.document = copy(candidate);
    this.changed();
  }
  async save(input: MotionActionInput, expectedRevision: number): Promise<MotionAction> {
    return this.exclusive(async () => {
      this.authoring();
      this.assertRevision(expectedRevision);
      const scene = createScene(this.options.getScene());
      const definition = scene.objects.find((value) => value.id === input.objectId);
      if (!definition)
        throw new MotionError("MOTION_UNKNOWN_OBJECT", "The motion object is not in this scene.");
      const pose = this.world.getPose(input.objectId);
      const old = this.document.actions.find((action) => action.actionId === input.actionId);
      const action = createMotionAction(input, (old?.revision ?? 0) + 1, pose.generation);
      if (!old && this.document.actions.length >= MAX_MOTION_ACTIONS)
        throw new MotionError("MOTION_BUDGET", "Motion registry is full.");
      const pin = await pinMotionScene(scene);
      this.assertRevision(expectedRevision);
      if (canonicalStringify(scene) !== canonicalStringify(this.options.getScene()))
        throw new MotionError("MOTION_SCENE_CONFLICT", "Scene changed while preparing the action.");
      this.install({
        ...this.document,
        revision: expectedRevision + 1,
        scenePin: pin,
        actions: [
          ...this.document.actions.filter((value) => value.actionId !== action.actionId),
          action,
        ].sort((a, b) => a.actionId.localeCompare(b.actionId)),
      });
      return copy(action);
    });
  }
  async remove(actionId: string, expectedRevision: number): Promise<void> {
    return this.exclusive(async () => {
      this.authoring();
      this.assertRevision(expectedRevision);
      if (!this.document.actions.some((action) => action.actionId === actionId))
        throw new MotionError("MOTION_UNKNOWN_ACTION", "Motion action does not exist.");
      this.install({
        ...this.document,
        revision: expectedRevision + 1,
        actions: this.document.actions.filter((action) => action.actionId !== actionId),
      });
    });
  }
  async rebase(expectedRevision: number): Promise<void> {
    return this.exclusive(async () => {
      this.authoring();
      this.assertRevision(expectedRevision);
      const scene = createScene(this.options.getScene()),
        pin = await pinMotionScene(scene);
      const actions = this.document.actions.map((action) => {
        if (!scene.objects.some((object) => object.id === action.objectId))
          throw new MotionError(
            "MOTION_UNKNOWN_OBJECT",
            "Remove actions whose objects were deleted before rebasing.",
          );
        return { ...action, generation: this.world.getPose(action.objectId).generation };
      });
      this.assertRevision(expectedRevision);
      if (canonicalStringify(scene) !== canonicalStringify(this.options.getScene()))
        throw new MotionError("MOTION_SCENE_CONFLICT", "Scene changed while rebasing.");
      this.install({ ...this.document, revision: expectedRevision + 1, scenePin: pin, actions });
    });
  }
  private async history(undo: boolean, expectedRevision: number): Promise<void> {
    return this.exclusive(async () => {
      this.authoring();
      this.assertRevision(expectedRevision);
      const from = undo ? this.undoStack : this.redoStack,
        to = undo ? this.redoStack : this.undoStack;
      const prior = from.at(-1);
      if (!prior)
        throw new MotionError(
          "MOTION_HISTORY_EMPTY",
          "No motion authoring transaction to restore.",
        );
      const pin = await pinMotionScene(this.options.getScene());
      if (canonicalStringify(pin) !== canonicalStringify(prior.scenePin))
        throw new MotionError(
          "MOTION_SCENE_CONFLICT",
          "Scene changed; motion history cannot overwrite another scene.",
        );
      this.assertRevision(expectedRevision);
      from.pop();
      to.push(this.getSnapshot());
      this.install({ ...prior, revision: expectedRevision + 1 }, false);
    });
  }
  undo(expectedRevision: number): Promise<void> {
    return this.history(true, expectedRevision);
  }
  redo(expectedRevision: number): Promise<void> {
    return this.history(false, expectedRevision);
  }
  exportJson(): string {
    return canonicalStringify(this.document);
  }
  async importJson(text: string, expectedRevision: number): Promise<void> {
    let value: unknown;
    try {
      if (new TextEncoder().encode(text).byteLength > 1024 * 1024) throw new Error("size");
      value = JSON.parse(text);
    } catch {
      throw new MotionError("MOTION_INVALID", "Invalid or oversized motion JSON.");
    }
    await this.withExternalTransaction(
      validateMotionRegistry(value),
      this.getSnapshot(),
      this.options.getScene(),
      async () => {
        this.assertRevision(expectedRevision);
        return this.options.getScene();
      },
      true,
    );
  }
  /** Validate everything before the scene callback; publish registry synchronously after it succeeds. */
  async withExternalTransaction(
    input: MotionRegistryDocument,
    expectedSnapshot: MotionRegistryDocument,
    candidateScene: SceneSpec,
    commitScene: () => SceneSpec | Promise<SceneSpec>,
    importAsNewRevision = false,
  ): Promise<SceneSpec> {
    return this.exclusive(async () => {
      this.authoring();
      if (canonicalStringify(this.document) !== canonicalStringify(expectedSnapshot))
        throw new MotionError("MOTION_REVISION_CONFLICT", "Motion snapshot changed before commit.");
      const candidate = validateMotionRegistry(input),
        scene = createScene(candidateScene);
      const pin = await pinMotionScene(scene);
      if (canonicalStringify(pin) !== canonicalStringify(candidate.scenePin))
        throw new MotionError(
          "MOTION_SCENE_CONFLICT",
          "Motion registry is pinned to another scene.",
        );
      if (!importAsNewRevision && candidate.revision !== expectedSnapshot.revision + 1)
        throw new MotionError(
          "MOTION_REVISION_CONFLICT",
          "Motion commit must create the next registry revision.",
        );
      for (const action of candidate.actions)
        if (!scene.objects.some((object) => object.id === action.objectId))
          throw new MotionError(
            "MOTION_UNKNOWN_OBJECT",
            "Motion references an object absent from the candidate scene.",
          );
      const projected = this.world.projectSceneGenerations(scene);
      for (const action of candidate.actions) {
        const generation = projected[action.objectId];
        if (importAsNewRevision) action.generation = generation!;
        else if (generation !== action.generation)
          throw new MotionError(
            "MOTION_GENERATION_CONFLICT",
            "Motion candidate body identity changed before commit.",
          );
      }
      if (canonicalStringify(this.document) !== canonicalStringify(expectedSnapshot))
        throw new MotionError("MOTION_REVISION_CONFLICT", "Motion changed while validating.");
      const committed = await commitScene();
      // The callback is an explicit trusted atomic scene adapter, never a model callback.
      if (canonicalStringify(committed) !== canonicalStringify(scene))
        throw new MotionError(
          "MOTION_SCENE_CONFLICT",
          "Scene adapter did not publish the validated scene.",
        );
      this.install({ ...candidate, revision: expectedSnapshot.revision + 1 });
      return committed;
    });
  }
  /** Trusted Undo/import binding projection; author parameters are preserved exactly. */
  async projectRestoredRegistry(
    input: MotionRegistryDocument,
    candidateScene: SceneSpec,
  ): Promise<MotionRegistryDocument> {
    const candidate = validateMotionRegistry(input),
      scene = createScene(candidateScene);
    const generations = this.world.projectSceneGenerations(scene);
    candidate.scenePin = await pinMotionScene(scene);
    candidate.actions = candidate.actions.map((action) => {
      const generation = generations[action.objectId];
      if (generation === undefined)
        throw new MotionError(
          "MOTION_UNKNOWN_OBJECT",
          "Restored motion references an absent object.",
        );
      return { ...action, generation };
    });
    return candidate;
  }
  async previewTrajectories(
    proposals: { requestId: string; arguments: Record<string, unknown> }[],
    candidateScene: SceneSpec,
    removedObjectIds: readonly string[] = [],
  ): Promise<{ candidate: MotionRegistryDocument; changes: string[]; warnings: string[] }> {
    const scene = createScene(candidateScene),
      candidate = this.getSnapshot();
    candidate.revision++;
    candidate.scenePin = await pinMotionScene(scene);
    const projectedGenerations = this.world.projectSceneGenerations(scene);
    candidate.actions = candidate.actions.flatMap((action) => {
      const generation = projectedGenerations[action.objectId];
      if (generation === undefined) {
        // Only a removal the person is approving in this same transaction may drop an action.
        if (removedObjectIds.includes(action.objectId)) return [];
        throw new MotionError(
          "MOTION_UNKNOWN_OBJECT",
          "Remove motions for deleted objects before a mixed scene transaction.",
        );
      }
      return [{ ...action, generation }];
    });
    const changes: string[] = [];
    for (const proposal of proposals) {
      const args = proposal.arguments;
      if (args.interpolation !== "linearSlerp")
        throw new MotionError(
          "CAPABILITY_UNSUPPORTED",
          "Recorded traces require a verified recording; use linearSlerp authoring.",
        );
      const objectId = args.objectId as string;
      const object = scene.objects.find((entry) => entry.id === objectId);
      if (!object || object.mode !== "kinematic")
        throw new MotionError(
          "MOTION_NOT_KINEMATIC",
          "AI trajectories require an explicitly kinematic candidate object.",
        );
      const actionId = `trajectory.${objectId}`;
      const old = candidate.actions.find((entry) => entry.actionId === actionId);
      const generation = projectedGenerations[objectId]!;
      const action = createMotionAction(
        {
          actionId,
          objectId,
          kind: "trajectory",
          samples: args.samples as MotionSample[],
          timeoutS: 30,
          maxSpeedMps: 3,
          releasePolicy: "zero",
          source: "ai",
        },
        (old?.revision ?? 0) + 1,
        generation,
      );
      const first = action.samples![0]!;
      if (
        norm(sub(first.positionM, object.positionM)) > action.positionToleranceM ||
        norm(angularDelta(object.orientationQuaternion, first.orientationQuaternion)) > 0.025
      )
        throw new MotionError(
          "MOTION_START_POSE",
          `The first sample of ${objectId} must match where it is at this point in the list: position [${object.positionM.join(", ")}], orientation [${object.orientationQuaternion.join(", ")}]. Otherwise the path can't be played.`,
        );
      candidate.actions = [
        ...candidate.actions.filter((entry) => entry.actionId !== actionId),
        action,
      ];
      changes.push(
        `Motion ${actionId}: ${action.samples!.length} samples / ${action.samples!.at(-1)!.timeS} s`,
      );
    }
    return {
      candidate: validateMotionRegistry(candidate),
      changes,
      warnings: proposals.length
        ? ["Motion is authored only; starting it requires an explicit local run action."]
        : [],
    };
  }
  async start(actionId: string, commandId: string): Promise<MotionRunReceipt> {
    return this.exclusive(async () => {
      if (!/^[a-z][a-z0-9._-]{0,63}$/.test(commandId))
        throw new MotionError("MOTION_INVALID", "Invalid motion command ID.");
      const action = this.document.actions.find((entry) => entry.actionId === actionId);
      if (!action) throw new MotionError("MOTION_UNKNOWN_ACTION", "Motion action does not exist.");
      const signature = canonicalStringify({ action, registryRevision: this.document.revision });
      const duplicate = this.commands.get(commandId);
      if (duplicate) {
        if (duplicate.signature !== signature)
          throw new MotionError(
            "MOTION_COMMAND_CONFLICT",
            "Command ID was used with different motion content.",
          );
        return copy(duplicate.receipt);
      }
      if (this.commands.size >= 2048 || this.active.size >= 8)
        throw new MotionError("MOTION_BUDGET", "Motion command/controller budget exhausted.");
      if (this.active.has(action.objectId))
        throw new MotionError("MOTION_OWNER_CONFLICT", "Another motion controller owns this body.");
      const registryRevision = this.document.revision,
        pin = await pinMotionScene(this.options.getScene());
      this.assertRevision(registryRevision);
      if (canonicalStringify(pin) !== canonicalStringify(this.document.scenePin))
        throw new MotionError(
          "MOTION_SCENE_CONFLICT",
          "Motion scene pin is stale; explicitly rebase the registry.",
        );
      const pose = this.world.getPose(action.objectId);
      if (pose.generation !== action.generation)
        throw new MotionError("MOTION_GENERATION_CONFLICT", "Motion body generation changed.");
      if (!pose.enabled || pose.lifecycle !== "active" || pose.held || pose.mode === "fixed")
        throw new MotionError(
          "MOTION_CONTROL_CONFLICT",
          "Motion requires an active, unheld dynamic or kinematic body.",
        );
      if (action.kind === "impulse" && !dynamic(pose.mode))
        throw new MotionError("MOTION_NOT_DYNAMIC", "Impulse actions require a dynamic body.");
      if (
        action.kind === "moveAndRelease" &&
        pose.mode === "kinematic" &&
        action.releasePolicy === "preserve"
      )
        throw new MotionError(
          "MOTION_RELEASE_POLICY",
          "Kinematic release requires explicit zero or transfer velocity.",
        );
      if (
        action.kind === "moveAndRelease" &&
        dynamic(pose.mode) &&
        action.releasePolicy === "transfer"
      )
        throw new MotionError(
          "MOTION_RELEASE_POLICY",
          "Dynamic release preserves the actual solver velocity; choose preserve or zero.",
        );
      if (action.kind === "trajectory") {
        if (pose.mode !== "kinematic")
          throw new MotionError("MOTION_NOT_KINEMATIC", "Trajectories require a kinematic body.");
        const first = action.samples![0]!;
        if (
          norm(sub(first.positionM, pose.positionMetres)) > action.positionToleranceM ||
          norm(angularDelta(pose.rotation, first.orientationQuaternion)) > 0.025
        )
          throw new MotionError(
            "MOTION_START_POSE",
            "Trajectory first sample must match the actual body pose.",
          );
      }
      const receipt: MotionRunReceipt = {
        runId: `motion.run.${++this.sequence}`,
        commandId,
        actionId,
        actionRevision: action.revision,
        registryRevision,
        scenePin: copy(pin),
        objectId: action.objectId,
        generation: pose.generation,
        startTick: this.world.tick,
        endTick: null,
        elapsedTicks: 0,
        status: "pending",
        reason: null,
        before: copy(pose),
        after: null,
        acceptedLinearVelocityMps: zero(),
        acceptedAngularVelocityRadps: zero(),
        releasePolicy: action.releasePolicy,
        originalMode: pose.mode,
      };
      this.receipts.push(receipt);
      if (this.receipts.length > 128) this.receipts.shift();
      this.commands.set(commandId, { signature, receipt });
      this.active.set(action.objectId, {
        action: copy(action),
        receipt,
        epoch: this.world.resetEpoch,
        settled: 0,
        blockedTicks: 0,
        lastDistance: Infinity,
        previousPose: copy(pose),
        linear: zero(),
        angular: zero(),
        impulseApplied: false,
      });
      this.changed();
      return copy(receipt);
    });
  }
  cancel(runId: string, reason = "user-cancelled"): void {
    const run = [...this.active.values()].find((entry) => entry.receipt.runId === runId);
    if (!run) throw new MotionError("MOTION_UNKNOWN_RUN", "No active motion run with this ID.");
    this.finish(run, "cancelled", reason);
  }
  cancelAll(reason = "cancelled"): void {
    for (const run of [...this.active.values()]) this.finish(run, "cancelled", reason);
  }
  private finish(run: ActiveRun, status: MotionRunStatus, reason: string | null): void {
    run.receipt.status = status;
    run.receipt.reason = reason;
    run.receipt.endTick = this.world.tick;
    try {
      run.receipt.after = this.world.getPose(run.action.objectId);
    } catch {
      run.receipt.after = null;
    }
    this.active.delete(run.action.objectId);
    this.changed();
  }
  private beforeStep(): void {
    const scene = this.options.getScene(),
      dt = this.world.fixedDtSeconds;
    for (const run of [...this.active.values()]) {
      try {
        const action = run.action,
          pose = this.world.getPose(action.objectId);
        if (
          this.world.sceneRevision !== run.receipt.scenePin.sceneRevision ||
          this.world.resetEpoch !== run.epoch ||
          pose.generation !== action.generation ||
          pose.held ||
          !pose.enabled ||
          pose.mode !== run.receipt.originalMode
        ) {
          this.finish(run, "invalidated", "scene-epoch-generation-or-controller-changed");
          continue;
        }
        run.receipt.status = "running";
        if (action.kind === "impulse") {
          if (!run.impulseApplied) {
            this.world.applyMotionImpulses(action.objectId, action.impulseNs!, zero());
            run.impulseApplied = true;
          }
          continue;
        }
        const target =
          action.kind === "trajectory"
            ? trajectoryAt(action.samples!, (run.receipt.elapsedTicks + 1) * dt)
            : {
                positionM: action.targetPositionM!,
                orientationQuaternion: action.targetOrientationQuaternion ?? pose.rotation,
              };
        if (pose.mode === "kinematic") {
          const angularError = norm(angularDelta(pose.rotation, target.orientationQuaternion));
          const fraction =
            angularError > 0 ? Math.min(1, (action.maxAngularSpeedRadps * dt) / angularError) : 1;
          const boundedTarget = sub(target.positionM, pose.positionMetres);
          const position = pose.positionMetres.map(
            (v, i) => v + bounded(boundedTarget, action.maxSpeedMps * dt)[i]!,
          ) as Vec3;
          this.world.setKinematicTarget(
            action.objectId,
            position,
            slerp(pose.rotation, target.orientationQuaternion, fraction),
          );
        } else {
          const object = scene.objects.find((entry) => entry.id === action.objectId)!;
          const desired = bounded(
            scale(sub(target.positionM, pose.positionMetres), 5),
            action.maxSpeedMps,
          );
          let acceleration = bounded(
            scale(sub(desired, pose.linearVelocityMetresPerSecond), 1 / dt),
            action.maxAccelerationMps2,
          );
          if (pose.mode === "dynamicGravity") acceleration = sub(acceleration, scene.gravityMps2);
          const impulse = bounded(scale(acceleration, object.massKg * dt), action.maxImpulseNs);
          const desiredAngular = bounded(
            scale(angularDelta(pose.rotation, target.orientationQuaternion), 5),
            action.maxAngularSpeedRadps,
          );
          const inertiaScale =
            (object.massKg * object.dimensionsM.reduce((sum, value) => sum + value * value, 0)) /
            12;
          const torque = bounded(
            scale(sub(desiredAngular, pose.angularVelocityRadiansPerSecond), inertiaScale),
            action.maxTorqueImpulseNms,
          );
          this.world.applyMotionImpulses(action.objectId, impulse, torque);
        }
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "MOTION_RUNTIME_ERROR";
        this.finish(run, code === "KINEMATIC_BLOCKED" ? "blocked" : "invalidated", code);
      }
    }
  }
  private afterStep(snapshot: PhysicsSnapshot): void {
    const poses = new Map(snapshot.poses.map((pose) => [pose.objectId, pose]));
    for (const run of [...this.active.values()]) {
      const pose = poses.get(run.action.objectId);
      if (!pose) {
        this.finish(run, "invalidated", "object-removed");
        continue;
      }
      const action = run.action,
        dt = snapshot.fixedDtSeconds;
      run.receipt.elapsedTicks++;
      run.linear = scale(sub(pose.positionMetres, run.previousPose.positionMetres), 1 / dt);
      run.angular = scale(angularDelta(run.previousPose.rotation, pose.rotation), 1 / dt);
      run.previousPose = copy(pose);
      run.receipt.acceptedLinearVelocityMps = copy(run.linear);
      run.receipt.acceptedAngularVelocityRadps = copy(run.angular);
      if (action.kind === "impulse") {
        this.finish(run, "applied", null);
        continue;
      }
      const target =
        action.kind === "trajectory"
          ? action.samples!.at(-1)!
          : {
              positionM: action.targetPositionM!,
              orientationQuaternion: action.targetOrientationQuaternion ?? pose.rotation,
            };
      const distance = norm(sub(target.positionM, pose.positionMetres));
      const angle = norm(angularDelta(pose.rotation, target.orientationQuaternion));
      const pastTrajectory =
        action.kind !== "trajectory" ||
        run.receipt.elapsedTicks * dt >= action.samples!.at(-1)!.timeS;
      const speedOkay =
        pose.mode === "kinematic" ||
        norm(pose.linearVelocityMetresPerSecond) <= action.velocityToleranceMps;
      run.settled =
        pastTrajectory && distance <= action.positionToleranceM && angle <= 0.025 && speedOkay
          ? run.settled + 1
          : 0;
      const requiredSettleTicks =
        action.kind === "moveAndRelease" &&
        pose.mode === "kinematic" &&
        action.releasePolicy === "transfer"
          ? 1
          : action.settleTicks;
      if (run.settled >= requiredSettleTicks) {
        if (action.kind === "moveAndRelease") {
          if (pose.mode === "kinematic") {
            this.world.setMode(action.objectId, action.releaseMode);
            this.world.setVelocity(
              action.objectId,
              action.releasePolicy === "transfer"
                ? bounded(run.linear, action.maxSpeedMps)
                : zero(),
              action.releasePolicy === "transfer"
                ? bounded(run.angular, action.maxAngularSpeedRadps)
                : zero(),
            );
          } else if (action.releasePolicy === "zero")
            this.world.setVelocity(action.objectId, zero(), zero());
        }
        this.finish(run, "reached", null);
        continue;
      }
      run.blockedTicks =
        distance > action.positionToleranceM &&
        Math.abs(run.lastDistance - distance) < 1e-5 &&
        norm(pose.linearVelocityMetresPerSecond) < 0.03
          ? run.blockedTicks + 1
          : 0;
      run.lastDistance = distance;
      if (run.blockedTicks >= Math.ceil(0.5 / dt))
        this.finish(run, "blocked", "no-progress-under-collision-preserving-control");
      else if (run.receipt.elapsedTicks * dt >= action.timeoutS)
        this.finish(run, "timedOut", "action-timeout");
    }
    if (this.active.size && snapshot.tick % 6 === 0) this.changed();
  }
  dispose(): void {
    this.cancelAll("workspace-disposed");
    this.unobserve?.();
    this.unobserve = null;
    this.subscribers.clear();
    this.disposed = true;
  }
}
