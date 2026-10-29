import { applyCommand, createScene } from "../scene/index.js";
import type {
  SceneObject,
  SceneOperation,
  SceneSpec,
  Vector3,
  Quaternion,
} from "../scene/types.js";
import { AgentError } from "./types.js";
import type { AgentAdapter, RegistryEntry, ToolRequest } from "./types.js";
import { canonicalJson } from "./validation.js";

export interface AgentMaterial extends RegistryEntry {
  friction?: number;
  restitution?: number;
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
}
/** All speculative work uses the real immutable Scene command validator. */
export function createSceneToolAdapter(options: SceneToolAdapterOptions): AgentAdapter {
  const build = (
    requests: ToolRequest[],
  ): { candidate: SceneSpec; changes: string[]; warnings: string[] } => {
    const materialRevision = options.materialRegistryRevision ?? 1;
    const scene = createScene(options.getScene());
    const operations: SceneOperation[] = [];
    const changes: string[] = [];
    const warnings: string[] = [];
    let replacing = false;
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
        changes.push(`新增 ${object.id}：${object.shape}／${object.mode}`);
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
        changes.push(`建立固定六面房間 ${width}×${height}×${depth} m；${material.label}`);
      } else if (request.tool === "SetTrajectory")
        throw new AgentError(
          "CAPABILITY_UNSUPPORTED",
          "AI trajectory mutation尚未接入版本化Motion Registry，請使用錄放介面。",
        );
      else throw new AgentError("POLICY_DENIED", "此入口只接受場景mutation。");
    }
    try {
      const candidate = replacing
        ? createScene(scene)
        : applyCommand(scene, { expectedSceneRevision: scene.sceneRevision, operations }).scene;
      if (candidate.sources.length > 16)
        throw new AgentError(
          "POLICY_DENIED",
          "AI session最多16聲源；Scene格式上限不是Agent授權上限。",
        );
      return { candidate, changes, warnings };
    } catch (error) {
      if (error instanceof AgentError) throw error;
      throw new AgentError(
        "DOMAIN_INVALID",
        error instanceof Error ? error.message : "場景domain驗證失敗。",
      );
    }
  };
  const pending = new Map<string, ToolRequest[]>();
  const adapter: AgentAdapter = {
    getScene: options.getScene,
    preview(requests) {
      const result = build(requests);
      const key = canonicalJson({ candidate: result.candidate, requests });
      if (!pending.has(key) && pending.size >= 48)
        throw new AgentError("BUDGET_EXCEEDED", "Adapter待確認交易已達上限。");
      pending.set(key, structuredClone(requests));
      return result;
    },
    async commit(candidate, expectedRevision, transactionId, approvedRequests) {
      if (options.getScene().sceneRevision !== expectedRevision)
        throw new AgentError("REVISION_CONFLICT", "場景revision不符。");
      createScene(candidate);
      const key = canonicalJson({ candidate, requests: approvedRequests ?? [] });
      const requests = pending.get(key);
      if (!requests) throw new AgentError("PREVIEW_REQUIRED", "Candidate沒有通過本adapter的預覽。");
      const result = await options.commitScene(
        structuredClone(candidate),
        expectedRevision,
        transactionId,
        structuredClone(requests),
      );
      pending.delete(key);
      return result;
    },
    async restore(snapshot, expectedRevision, transactionId) {
      if (options.getScene().sceneRevision !== expectedRevision)
        throw new AgentError("REVISION_CONFLICT", "Undo將覆蓋後續編輯，已拒絕。");
      const next = createScene({ ...snapshot, sceneRevision: expectedRevision + 1 });
      return options.commitScene(next, expectedRevision, transactionId, []);
    },
  };
  if (options.runTool) adapter.runTool = options.runTool;
  return adapter;
}
