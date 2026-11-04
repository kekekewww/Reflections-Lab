import { applyCommand, createScene } from "../scene/index.js";
import type {
  SceneObject,
  SceneOperation,
  SceneSpec,
  Vector3,
  Quaternion,
} from "../scene/types.js";
import { AgentError } from "./types.js";
import type {
  AgentAdapter,
  AgentAdapterPreview,
  AgentSidecarSnapshot,
  AgentSidecarTransaction,
  AgentSidecarRestore,
  RegistryEntry,
  ToolRequest,
} from "./types.js";
import { canonicalJson, digestJson } from "./validation.js";
import {
  ACOUSTIC_SURFACE_BUDGET,
  acousticSurfaceCount,
} from "../capabilities/acoustic-geometry.js";

/** The default bay and CreateScene name their shell objects this way; Muse-added objects don't. */
const ROOM_SURFACE_ID = /^(?:floor|ceiling|wall\.|room\.)/;
const PHYSICAL_TOOLS: ReadonlySet<string> = new Set([
  "AddObject",
  "MoveObject",
  "ResizeObject",
  "RemoveObject",
  "SetRigidBodyMode",
]);

export interface AgentMaterial extends RegistryEntry {
  friction?: number;
  restitution?: number;
}
export interface MotionTransactionCommit {
  scene: SceneSpec;
  expectedSceneRevision: number;
  transactionId: string;
  requests: ToolRequest[];
  before: AgentSidecarSnapshot;
  candidate: AgentSidecarSnapshot;
}
export interface MotionTransactionRestore extends AgentSidecarRestore {
  scene: SceneSpec;
  expectedSceneRevision: number;
  transactionId: string;
}
/** The trusted runtime must validate and publish Scene + Motion atomically. */
export interface MotionTransactionHooks {
  getSnapshot(): AgentSidecarSnapshot;
  prepareRestore?(
    snapshot: AgentSidecarSnapshot,
    candidateScene: SceneSpec,
  ): AgentSidecarSnapshot | Promise<AgentSidecarSnapshot>;
  preview(
    requests: ToolRequest[],
    candidateScene: SceneSpec,
    removedObjectIds?: string[],
  ):
    | { candidate: AgentSidecarSnapshot; changes: string[]; warnings: string[] }
    | Promise<{ candidate: AgentSidecarSnapshot; changes: string[]; warnings: string[] }>;
  commit(input: MotionTransactionCommit): SceneSpec | Promise<SceneSpec>;
  restore(input: MotionTransactionRestore): SceneSpec | Promise<SceneSpec>;
}
export interface SceneToolAdapterOptions {
  getScene(): SceneSpec;
  commitScene(
    next: SceneSpec,
    expectedRevision: number,
    transactionId: string,
    requests: ToolRequest[],
  ): SceneSpec | Promise<SceneSpec>;
  materials: AgentMaterial[];
  signals: RegistryEntry[];
  materialRegistryRevision?: number;
  runTool?(request: ToolRequest): Promise<unknown>;
  motionTransaction?: MotionTransactionHooks;
}
/** All speculative work uses the real immutable Scene command validator. */
export function createSceneToolAdapter(options: SceneToolAdapterOptions): AgentAdapter {
  const motionActions = (): { actionId: string; objectId: string }[] => {
    const document = options.motionTransaction?.getSnapshot().document as
      | { actions?: unknown }
      | undefined;
    return Array.isArray(document?.actions)
      ? (document.actions as { actionId: string; objectId: string }[])
      : [];
  };
  const build = (requests: ToolRequest[]): AgentAdapterPreview => {
    const materialRevision = options.materialRegistryRevision ?? 1;
    const scene = createScene(options.getScene());
    const operations: SceneOperation[] = [];
    const changes: string[] = [];
    const warnings: string[] = [];
    let replacing = false;
    // Operations apply in order, so an edit must name an object that exists at its place in the list.
    const shapes = new Map(scene.objects.map((object) => [object.id, object.shape]));
    const existing = (id: unknown): string => {
      if (typeof id !== "string" || !shapes.has(id))
        throw new AgentError("UNKNOWN_ID", `物件 ${String(id)} 不存在，或已在此清單中移除。`, [
          "/arguments/objectId",
        ]);
      return id;
    };
    const warnIfRoomSurface = (id: string): void => {
      const warning = `此操作變更房間表面 ${id}，會影響聲學與物理；套用前請檢查。`;
      if (ROOM_SURFACE_ID.test(id) && !warnings.includes(warning)) warnings.push(warning);
    };
    for (const request of requests) {
      const args = request.arguments;
      const getMaterial = (id: unknown): AgentMaterial => {
        const material = options.materials.find((item) => item.id === id);
        if (!material)
          throw new AgentError("UNKNOWN_ID", "材質不存在於已載入registry。", [
            "/arguments/materialId",
          ]);
        return material;
      };
      if (request.tool === "AddObject") {
        const material = getMaterial(args.materialId);
        const object: SceneObject = {
          id: args.objectId as string,
          shape: args.shape as SceneObject["shape"],
          dimensionsM: args.dimensionsM as Vector3,
          positionM: args.positionM as Vector3,
          orientationQuaternion: args.orientationQuaternion as Quaternion,
          mode: args.mode as SceneObject["mode"],
          massKg: args.massKg as number,
          friction: material.friction ?? 0.6,
          restitution: material.restitution ?? 0.25,
          physicsMaterialId: material.id,
          acousticMaterialId: material.id,
          acousticRole: args.mode === "fixed" ? "staticSurface" : "dynamicOccluder",
        };
        operations.push({ type: "AddObject", object });
        shapes.set(object.id, object.shape);
        changes.push(`新增 ${object.id}：${object.shape}／${object.mode}`);
      } else if (request.tool === "MoveObject") {
        const objectId = existing(args.objectId);
        const positionM = args.positionM as Vector3;
        operations.push({
          type: "SetTransform",
          objectId,
          positionM,
          orientationQuaternion: args.orientationQuaternion as Quaternion,
        });
        warnIfRoomSurface(objectId);
        if (
          motionActions().some((action) => action.objectId === objectId) &&
          !requests.some(
            (other) => other.tool === "SetTrajectory" && other.arguments.objectId === objectId,
          )
        )
          warnings.push(`${objectId} 已有路徑，起點不再符合新位置；需要新的路徑才能播放。`);
        changes.push(`移動 ${objectId} 到 [${positionM.join(", ")}]`);
      } else if (request.tool === "ResizeObject") {
        const objectId = existing(args.objectId);
        const dimensionsM = args.dimensionsM as Vector3;
        operations.push({
          type: "SetGeometry",
          objectId,
          shape: shapes.get(objectId)!,
          dimensionsM,
        });
        warnIfRoomSurface(objectId);
        changes.push(`調整 ${objectId} 尺寸為 ${dimensionsM.join("×")} m`);
      } else if (request.tool === "RemoveObject") {
        const objectId = existing(args.objectId);
        const sourceIds = new Set(
          scene.sources.filter((source) => source.objectId === objectId).map((source) => source.id),
        );
        for (const operation of operations)
          if (operation.type === "SetSource" && operation.source.objectId === objectId)
            sourceIds.add(operation.source.id);
        const actionIds = motionActions()
          .filter((action) => action.objectId === objectId)
          .map((action) => action.actionId);
        operations.push({ type: "RemoveObject", objectId });
        shapes.delete(objectId);
        warnIfRoomSurface(objectId);
        changes.push(
          `移除 ${objectId}` +
            (sourceIds.size ? `；一併移除聲源 ${[...sourceIds].join("、")}` : "") +
            (actionIds.length ? `；一併移除路徑 ${actionIds.join("、")}` : ""),
        );
      } else if (request.tool === "SetMaterial") {
        const material = getMaterial(args.materialId);
        if (args.materialRegistryRevision !== materialRevision)
          throw new AgentError("REVISION_CONFLICT", "材質registry已更新。");
        const operation: SceneOperation = {
          type: "SetMaterial",
          objectId: args.objectId as string,
        };
        if (args.scope === "acoustic" || args.scope === "both")
          operation.acousticMaterialId = material.id;
        if (args.scope === "physics" || args.scope === "both")
          operation.physicsMaterialId = material.id;
        operations.push(operation);
        if (args.scope === "physics" || args.scope === "both")
          operations.push({
            type: "SetPhysics",
            objectId: args.objectId as string,
            friction: material.friction ?? 0.6,
            restitution: material.restitution ?? 0.25,
          });
        changes.push(`變更 ${args.objectId} 的${args.scope}材質為 ${material.id}`);
      } else if (request.tool === "SetRigidBodyMode") {
        if (args.velocityPolicy !== "zero")
          throw new AgentError(
            "CAPABILITY_UNSUPPORTED",
            "AI模式切換初版只支援zero速度政策；其他政策需明確Physics快照adapter。",
          );
        operations.push({
          type: "SetObjectMode",
          objectId: args.objectId as string,
          mode: args.mode as SceneObject["mode"],
        });
        changes.push(`將 ${args.objectId} 設為 ${args.mode}（速度歸零）`);
      } else if (request.tool === "ConfigureSoundSource") {
        const signal = options.signals.find((item) => item.id === args.signalId);
        if (!signal) throw new AgentError("UNKNOWN_ID", "訊號不存在於已授權registry。");
        if (signal.frequencyHz !== undefined && signal.frequencyHz !== args.referenceFrequencyHz)
          throw new AgentError(
            "CAPABILITY_UNSUPPORTED",
            "固定訊號的reference frequency不符；請選擇正確registry訊號。",
          );
        const source = {
          id: args.sourceId as string,
          objectId: args.objectId as string,
          signalId: signal.id,
          mode: args.mode as "continuous" | "impact",
          gainDbfs: args.gainDbfs as number,
          playing: scene.sources.find((entry) => entry.id === args.sourceId)?.playing ?? false,
        };
        operations.push({ type: "SetSource", source });
        changes.push(
          `設定 ${source.objectId} 聲源 ${source.id}：${signal.label}／${source.mode}；非量測振動聲`,
        );
      } else if (request.tool === "MoveListener") {
        if (args.listenerId !== scene.listener.id)
          throw new AgentError("UNKNOWN_ID", "Listener不存在。");
        operations.push({
          type: "SetListener",
          listener: {
            ...scene.listener,
            positionM: args.positionM as Vector3,
            orientationQuaternion: args.orientationQuaternion as Quaternion,
            attachment: "independent",
          },
        });
        changes.push("移動正式Listener；編輯camera保持獨立。");
      } else if (request.tool === "CreateScene") {
        if (requests.length !== 1)
          throw new AgentError("POLICY_DENIED", "CreateScene必須獨立預覽，避免隱含跨場景ID。");
        const material = getMaterial(args.surfaceMaterialId);
        const dims = args.roomDimensionsM as Vector3;
        const [width, height, depth] = dims;
        const wall = (id: string, dimensionsM: Vector3, positionM: Vector3): SceneObject => ({
          id,
          shape: "box",
          dimensionsM,
          positionM,
          orientationQuaternion: [0, 0, 0, 1],
          mode: "fixed",
          massKg: 1,
          friction: material.friction ?? 0.6,
          restitution: material.restitution ?? 0.25,
          physicsMaterialId: material.id,
          acousticMaterialId: material.id,
          acousticRole: "staticSurface",
        });
        if (Math.min(...dims) < 1 || Math.max(...dims) > 50)
          throw new AgentError("DOMAIN_INVALID", "初版房間尺寸範圍為1–50m。");
        scene.objects = [
          wall("room.floor", [width, 0.2, depth], [0, -0.1, 0]),
          wall("room.ceiling", [width, 0.2, depth], [0, height + 0.1, 0]),
          wall("room.left", [0.2, height, depth], [-width / 2 - 0.1, height / 2, 0]),
          wall("room.right", [0.2, height, depth], [width / 2 + 0.1, height / 2, 0]),
          wall("room.back", [width, height, 0.2], [0, height / 2, -depth / 2 - 0.1]),
          wall("room.front", [width, height, 0.2], [0, height / 2, depth / 2 + 0.1]),
        ];
        scene.sources = [];
        scene.seed = args.seed as number;
        scene.listener = {
          ...scene.listener,
          positionM: [0, Math.min(1.6, height / 2), depth / 4],
          attachment: "independent",
        };
        scene.sceneRevision++;
        replacing = true;
        warnings.push("此操作替換現有物件與聲源；套用前請檢查，Undo可回復Scene。");
        const actionIds = motionActions().map((action) => action.actionId);
        changes.push(
          `建立固定六面房間 ${width}×${height}×${depth} m；${material.id}` +
            (actionIds.length ? `；一併移除路徑 ${actionIds.join("、")}` : ""),
        );
      } else if (request.tool === "SetTrajectory") {
        if (!options.motionTransaction)
          throw new AgentError("CAPABILITY_UNSUPPORTED", "目前Host未提供Motion authoring。");
        if (args.interpolation !== "linearSlerp")
          throw new AgentError(
            "CAPABILITY_UNSUPPORTED",
            "Recorded trace需要可驗證的原始錄製；Motion authoring只接受linearSlerp。",
          );
      } else throw new AgentError("POLICY_DENIED", "此入口只接受場景mutation。");
    }
    try {
      const candidate = replacing
        ? createScene(scene)
        : operations.length
          ? applyCommand(scene, { expectedSceneRevision: scene.sceneRevision, operations }).scene
          : scene;
      if (candidate.sources.length > 16)
        throw new AgentError(
          "POLICY_DENIED",
          "AI session最多16聲源；Scene格式上限不是Agent授權上限。",
        );
      // Over budget the solver refuses the whole scene and all sound stops. A scene someone already
      // built past the limit can still be edited, as long as the edit doesn't add surfaces.
      const surfaces = acousticSurfaceCount(candidate);
      if (surfaces > ACOUSTIC_SURFACE_BUDGET && surfaces > acousticSurfaceCount(options.getScene()))
        throw new AgentError(
          "ACOUSTIC_BUDGET",
          `這個提案會讓場景有 ${surfaces} 個聲學面，超過上限 ${ACOUSTIC_SURFACE_BUDGET}，聲音會因此停止；每個方塊算 6 面，球體與膠囊算 1 面。請減少物件。`,
        );
      return {
        candidate,
        changes,
        warnings,
        ...(requests.every((request) => request.tool === "SetTrajectory")
          ? { sceneRevisionDelta: 0 as const }
          : {}),
      };
    } catch (error) {
      if (error instanceof AgentError) throw error;
      throw new AgentError(
        "DOMAIN_INVALID",
        error instanceof Error ? error.message : "場景domain驗證失敗。",
      );
    }
  };
  const motionPinIsCurrent = async (): Promise<boolean> => {
    const document = options.motionTransaction?.getSnapshot().document as
      | { scenePin?: { sceneId?: string; sceneRevision?: number; sceneHash?: string } }
      | undefined;
    const scene = options.getScene();
    return (
      document?.scenePin?.sceneId === scene.sceneId &&
      document.scenePin.sceneRevision === scene.sceneRevision &&
      document.scenePin.sceneHash === (await digestJson(scene))
    );
  };
  const pending = new Map<string, { requests: ToolRequest[]; sidecar?: AgentSidecarTransaction }>();
  const transactionKey = (
    candidate: SceneSpec,
    requests: ToolRequest[],
    sidecar?: AgentSidecarTransaction,
  ) => canonicalJson({ candidate, requests, ...(sidecar ? { sidecar } : {}) });
  const adapter: AgentAdapter = {
    getScene: options.getScene,
    async preview(requests) {
      const result = build(requests);
      const trajectories = requests.filter((request) => request.tool === "SetTrajectory");
      const actions = motionActions();
      const replacing = requests.some((request) => request.tool === "CreateScene");
      // A list that deletes or rebuilds a path's object must go through Motion, even on a stale
      // registry, so that the Host's scene pin check refuses it rather than leaving a dangling path.
      const touchesPath =
        actions.length > 0 &&
        (replacing ||
          requests.some(
            (request) =>
              (request.tool === "RemoveObject" || request.tool === "ResizeObject") &&
              actions.some((action) => action.objectId === request.arguments.objectId),
          ));
      // Physical edits end any like-for-like comparison anyway, so paths may follow them. Acoustic
      // edits must leave the registry alone: A/B reprocessing compares it byte for byte.
      const changesPhysics = requests.some((request) => PHYSICAL_TOOLS.has(request.tool));
      const needsMotion =
        trajectories.length > 0 ||
        touchesPath ||
        (actions.length > 0 && changesPhysics && (await motionPinIsCurrent()));
      if (needsMotion) {
        const before = structuredClone(options.motionTransaction!.getSnapshot());
        const removedObjectIds = replacing
          ? options.getScene().objects.map((object) => object.id)
          : requests
              .filter((request) => request.tool === "RemoveObject")
              .map((request) => request.arguments.objectId as string);
        const motion = structuredClone(
          await options.motionTransaction!.preview(
            trajectories,
            structuredClone(result.candidate),
            removedObjectIds,
          ),
        );
        if (canonicalJson(before) !== canonicalJson(options.motionTransaction!.getSnapshot()))
          throw new AgentError("REVISION_CONFLICT", "Motion預覽期間registry已變動。");
        result.sidecar = { before, candidate: motion.candidate };
        result.changes.push(...motion.changes);
        result.warnings.push(...motion.warnings);
      }
      const key = transactionKey(result.candidate, requests, result.sidecar);
      // The Host decides what may still be approved; only the oldest entry can be this far behind.
      if (!pending.has(key) && pending.size >= 48) pending.delete(pending.keys().next().value!);
      pending.set(key, {
        requests: structuredClone(requests),
        ...(result.sidecar ? { sidecar: structuredClone(result.sidecar) } : {}),
      });
      return result;
    },
    async commit(candidate, expectedRevision, transactionId, approvedRequests, sidecar) {
      if (options.getScene().sceneRevision !== expectedRevision)
        throw new AgentError("REVISION_CONFLICT", "場景revision不符。");
      createScene(candidate);
      const key = transactionKey(candidate, approvedRequests ?? [], sidecar);
      const transaction = pending.get(key);
      if (!transaction)
        throw new AgentError("PREVIEW_REQUIRED", "Candidate沒有通過本adapter的預覽。");
      let result: SceneSpec;
      if (transaction.sidecar) {
        const motion = options.motionTransaction;
        if (
          !motion ||
          canonicalJson(motion.getSnapshot()) !== canonicalJson(transaction.sidecar.before)
        )
          throw new AgentError("REVISION_CONFLICT", "Motion registry已變動，請重新預覽。");
        result = await motion.commit({
          scene: structuredClone(candidate),
          expectedSceneRevision: expectedRevision,
          transactionId,
          requests: structuredClone(transaction.requests),
          before: structuredClone(transaction.sidecar.before),
          candidate: structuredClone(transaction.sidecar.candidate),
        });
      } else
        result = await options.commitScene(
          structuredClone(candidate),
          expectedRevision,
          transactionId,
          structuredClone(transaction.requests),
        );
      pending.delete(key);
      return result;
    },
    async restore(snapshot, expectedRevision, transactionId, sidecar) {
      if (options.getScene().sceneRevision !== expectedRevision)
        throw new AgentError("REVISION_CONFLICT", "Undo將覆蓋後續編輯，已拒絕。");
      if (sidecar) {
        const motion = options.motionTransaction;
        if (
          !motion ||
          canonicalJson(motion.getSnapshot()) !== canonicalJson(sidecar.expectedCurrent)
        )
          throw new AgentError("REVISION_CONFLICT", "Motion Undo將覆蓋後續編輯，已拒絕。");
        const document = sidecar.restore.document as {
          scenePin?: { sceneRevision?: number };
        };
        const revision = document.scenePin?.sceneRevision;
        if (revision !== expectedRevision && revision !== expectedRevision + 1)
          throw new AgentError("DOMAIN_INVALID", "Motion Undo的Scene revision不符。");
        return motion.restore({
          scene: createScene({ ...snapshot, sceneRevision: revision }),
          expectedSceneRevision: expectedRevision,
          transactionId,
          expectedCurrent: structuredClone(sidecar.expectedCurrent),
          restore: structuredClone(sidecar.restore),
        });
      }
      const next = createScene({ ...snapshot, sceneRevision: expectedRevision + 1 });
      return options.commitScene(next, expectedRevision, transactionId, []);
    },
  };
  if (options.motionTransaction) {
    adapter.getSidecarSnapshot = () => structuredClone(options.motionTransaction!.getSnapshot());
    if (options.motionTransaction.prepareRestore)
      adapter.prepareSidecarRestore = async (snapshot, candidateScene) =>
        structuredClone(
          await options.motionTransaction!.prepareRestore!(
            structuredClone(snapshot),
            createScene(candidateScene),
          ),
        );
  }
  if (options.runTool) adapter.runTool = options.runTool;
  return adapter;
}
