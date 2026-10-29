import { SceneError } from "./errors.js";
import { assertJsonValue, createScene, validateScene } from "./validate-scene.js";
import type {
  SceneCommand,
  SceneCommandResult,
  SceneObject,
  SceneOperation,
  SceneSource,
  SceneSpec,
} from "./types.js";

export const MAX_COMMAND_OPERATIONS = 64;

const objectPatchKeys = [
  "shape",
  "dimensionsM",
  "positionM",
  "orientationQuaternion",
  "mode",
  "massKg",
  "friction",
  "restitution",
  "physicsMaterialId",
  "acousticMaterialId",
  "acousticRole",
];
const sourcePatchKeys = ["objectId", "signalId", "mode", "gainDbfs", "playing"];

function requireRecord(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new SceneError("INVALID_COMMAND", "操作必須是 object。");
}

function keys(value: Record<string, unknown>, allowed: string[], required: string[]): void {
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new SceneError("INVALID_COMMAND", "操作含未知或缺少的欄位。");
  }
}

function validatePatch(patch: unknown, allowed: string[]): void {
  requireRecord(patch);
  if (Object.keys(patch).length === 0) throw new SceneError("INVALID_COMMAND", "Patch 不可為空。");
  keys(patch, allowed, []);
}

function validateCommand(command: unknown): asserts command is SceneCommand {
  assertJsonValue(command);
  requireRecord(command);
  keys(command, ["expectedSceneRevision", "operations"], ["expectedSceneRevision", "operations"]);
  if (
    !Number.isSafeInteger(command.expectedSceneRevision) ||
    (command.expectedSceneRevision as number) < 0
  )
    throw new SceneError("INVALID_COMMAND", "預期 revision 必須為非負安全整數。");
  if (
    !Array.isArray(command.operations) ||
    command.operations.length < 1 ||
    command.operations.length > MAX_COMMAND_OPERATIONS
  )
    throw new SceneError("INPUT_LIMIT", "每項交易必須有 1–64 個操作。");
  for (const operation of command.operations) {
    requireRecord(operation);
    switch (operation.type) {
      case "SetTransform":
        keys(
          operation,
          ["type", "objectId", "positionM", "orientationQuaternion"],
          ["type", "objectId", "positionM", "orientationQuaternion"],
        );
        break;
      case "AddObject":
        keys(operation, ["type", "object"], ["type", "object"]);
        requireRecord(operation.object);
        break;
      case "RemoveObject":
        keys(operation, ["type", "objectId"], ["type", "objectId"]);
        break;
      case "UpdateObject":
        keys(operation, ["type", "objectId", "patch"], ["type", "objectId", "patch"]);
        validatePatch(operation.patch, objectPatchKeys);
        break;
      case "SetObjectMode":
        keys(operation, ["type", "objectId", "mode"], ["type", "objectId", "mode"]);
        break;
      case "SetPhysics": {
        keys(
          operation,
          ["type", "objectId", "massKg", "friction", "restitution"],
          ["type", "objectId"],
        );
        if (!["massKg", "friction", "restitution"].some((key) => Object.hasOwn(operation, key)))
          throw new SceneError("INVALID_COMMAND", "SetPhysics 必須設定至少一項參數。");
        break;
      }
      case "SetMaterial": {
        keys(
          operation,
          ["type", "objectId", "physicsMaterialId", "acousticMaterialId", "acousticRole"],
          ["type", "objectId"],
        );
        if (
          !["physicsMaterialId", "acousticMaterialId", "acousticRole"].some((key) =>
            Object.hasOwn(operation, key),
          )
        )
          throw new SceneError("INVALID_COMMAND", "SetMaterial 必須設定至少一項參數。");
        break;
      }
      case "SetGeometry":
        keys(
          operation,
          ["type", "objectId", "shape", "dimensionsM"],
          ["type", "objectId", "shape", "dimensionsM"],
        );
        break;
      case "AddSource":
      case "SetSource":
        keys(operation, ["type", "source"], ["type", "source"]);
        requireRecord(operation.source);
        break;
      case "UpdateSource":
        keys(operation, ["type", "sourceId", "patch"], ["type", "sourceId", "patch"]);
        validatePatch(operation.patch, sourcePatchKeys);
        break;
      case "RemoveSource":
        keys(operation, ["type", "sourceId"], ["type", "sourceId"]);
        break;
      case "SetListener":
        keys(operation, ["type", "listener"], ["type", "listener"]);
        requireRecord(operation.listener);
        break;
      case "SetGravity":
        keys(operation, ["type", "gravityMps2"], ["type", "gravityMps2"]);
        break;
      case "RestoreObject": {
        keys(
          operation,
          ["type", "object", "index", "sources"],
          ["type", "object", "index", "sources"],
        );
        requireRecord(operation.object);
        if (
          !Number.isSafeInteger(operation.index) ||
          (operation.index as number) < 0 ||
          (operation.index as number) > 256 ||
          !Array.isArray(operation.sources) ||
          operation.sources.length > 32
        )
          throw new SceneError("INVALID_COMMAND", "RestoreObject 索引／sources 無效。");
        for (const source of operation.sources) {
          requireRecord(source);
          keys(source, ["source", "index"], ["source", "index"]);
          requireRecord(source.source);
          if (
            !Number.isSafeInteger(source.index) ||
            (source.index as number) < 0 ||
            (source.index as number) > 32
          )
            throw new SceneError("INVALID_COMMAND", "Restore source 索引無效。");
        }
        break;
      }
      case "RestoreSource":
        keys(operation, ["type", "source", "index"], ["type", "source", "index"]);
        requireRecord(operation.source);
        if (
          !Number.isSafeInteger(operation.index) ||
          (operation.index as number) < 0 ||
          (operation.index as number) > 32
        )
          throw new SceneError("INVALID_COMMAND", "RestoreSource 索引無效。");
        break;
      default:
        throw new SceneError("UNKNOWN_OPERATION", "不支援的場景操作。");
    }
    for (const field of ["objectId", "sourceId"])
      if (Object.hasOwn(operation, field) && typeof operation[field] !== "string")
        throw new SceneError("INVALID_COMMAND", "Domain ID 必須為字串。");
  }
}

function objectAt(scene: SceneSpec, id: string): SceneObject {
  const object = scene.objects.find((candidate) => candidate.id === id);
  if (!object) throw new SceneError("UNKNOWN_ID", `物件不存在：${id}`);
  return object;
}

function ensureIdAvailable(scene: SceneSpec, id: string): void {
  if (typeof id !== "string" || !/^[a-z][a-z0-9._-]{0,63}$/.test(id)) {
    throw new SceneError("INVALID_COMMAND", "Entity ID 格式無效。");
  }
  if (
    scene.listener.id === id ||
    scene.objects.some((object) => object.id === id) ||
    scene.sources.some((source) => source.id === id)
  ) {
    throw new SceneError("DUPLICATE_ID", `Domain ID 已存在：${id}`);
  }
}

function sourceAt(scene: SceneSpec, id: string): SceneSource {
  const source = scene.sources.find((candidate) => candidate.id === id);
  if (!source) throw new SceneError("UNKNOWN_ID", `聲源不存在：${id}`);
  return source;
}

function objectInverse(object: SceneObject): SceneOperation {
  const { id, ...patch } = structuredClone(object);
  return { type: "UpdateObject", objectId: id, patch };
}

function execute(scene: SceneSpec, operation: SceneOperation): SceneOperation {
  switch (operation.type) {
    case "SetTransform": {
      const object = objectAt(scene, operation.objectId),
        inverse = objectInverse(object);
      object.positionM = structuredClone(operation.positionM);
      object.orientationQuaternion = structuredClone(operation.orientationQuaternion);
      return inverse;
    }
    case "AddObject": {
      ensureIdAvailable(scene, operation.object.id);
      scene.objects.push(structuredClone(operation.object));
      return { type: "RemoveObject", objectId: operation.object.id };
    }
    case "RemoveObject": {
      const object = objectAt(scene, operation.objectId),
        index = scene.objects.indexOf(object);
      const sources = scene.sources.flatMap((source, sourceIndex) =>
        source.objectId === object.id
          ? [{ source: structuredClone(source), index: sourceIndex }]
          : [],
      );
      scene.objects.splice(index, 1);
      scene.sources = scene.sources.filter((source) => source.objectId !== object.id);
      return { type: "RestoreObject", object: structuredClone(object), index, sources };
    }
    case "RestoreObject": {
      ensureIdAvailable(scene, operation.object.id);
      if (operation.sources.some((item) => item.source.objectId !== operation.object.id)) {
        throw new SceneError("INVALID_COMMAND", "還原聲源必須隸屬同一還原物件。");
      }
      if (operation.index > scene.objects.length)
        throw new SceneError("INVALID_COMMAND", "物件還原索引超出目前集合。");
      scene.objects.splice(operation.index, 0, structuredClone(operation.object));
      for (const { source, index } of [...operation.sources].sort((a, b) => a.index - b.index)) {
        ensureIdAvailable(scene, source.id);
        if (index > scene.sources.length)
          throw new SceneError("INVALID_COMMAND", "聲源還原索引超出目前集合。");
        scene.sources.splice(index, 0, structuredClone(source));
      }
      return { type: "RemoveObject", objectId: operation.object.id };
    }
    case "UpdateObject": {
      const object = objectAt(scene, operation.objectId),
        inverse = objectInverse(object);
      Object.assign(object, structuredClone(operation.patch));
      return inverse;
    }
    case "SetObjectMode": {
      const object = objectAt(scene, operation.objectId),
        inverse = objectInverse(object);
      object.mode = operation.mode;
      return inverse;
    }
    case "SetPhysics": {
      const object = objectAt(scene, operation.objectId),
        inverse = objectInverse(object);
      for (const field of ["massKg", "friction", "restitution"] as const)
        if (operation[field] !== undefined) object[field] = operation[field];
      return inverse;
    }
    case "SetMaterial": {
      const object = objectAt(scene, operation.objectId),
        inverse = objectInverse(object);
      if (operation.physicsMaterialId !== undefined)
        object.physicsMaterialId = operation.physicsMaterialId;
      if (operation.acousticMaterialId !== undefined)
        object.acousticMaterialId = operation.acousticMaterialId;
      if (operation.acousticRole !== undefined) object.acousticRole = operation.acousticRole;
      return inverse;
    }
    case "SetGeometry": {
      const object = objectAt(scene, operation.objectId),
        inverse = objectInverse(object);
      object.shape = operation.shape;
      object.dimensionsM = structuredClone(operation.dimensionsM);
      return inverse;
    }
    case "AddSource": {
      ensureIdAvailable(scene, operation.source.id);
      scene.sources.push(structuredClone(operation.source));
      return { type: "RemoveSource", sourceId: operation.source.id };
    }
    case "SetSource": {
      const existing = scene.sources.find((source) => source.id === operation.source.id);
      if (existing) {
        const inverse: SceneOperation = { type: "SetSource", source: structuredClone(existing) };
        scene.sources[scene.sources.indexOf(existing)] = structuredClone(operation.source);
        return inverse;
      }
      ensureIdAvailable(scene, operation.source.id);
      scene.sources.push(structuredClone(operation.source));
      return { type: "RemoveSource", sourceId: operation.source.id };
    }
    case "UpdateSource": {
      const source = sourceAt(scene, operation.sourceId),
        inverse: SceneOperation = { type: "SetSource", source: structuredClone(source) };
      Object.assign(source, structuredClone(operation.patch));
      return inverse;
    }
    case "RemoveSource": {
      const source = sourceAt(scene, operation.sourceId),
        index = scene.sources.indexOf(source);
      scene.sources.splice(index, 1);
      return { type: "RestoreSource", source: structuredClone(source), index };
    }
    case "RestoreSource": {
      ensureIdAvailable(scene, operation.source.id);
      if (operation.index > scene.sources.length)
        throw new SceneError("INVALID_COMMAND", "聲源還原索引超出目前集合。");
      scene.sources.splice(operation.index, 0, structuredClone(operation.source));
      return { type: "RemoveSource", sourceId: operation.source.id };
    }
    case "SetListener": {
      const inverse: SceneOperation = {
        type: "SetListener",
        listener: structuredClone(scene.listener),
      };
      scene.listener = structuredClone(operation.listener);
      return inverse;
    }
    case "SetGravity": {
      const inverse: SceneOperation = {
        type: "SetGravity",
        gravityMps2: structuredClone(scene.gravityMps2),
      };
      scene.gravityMps2 = structuredClone(operation.gravityMps2);
      return inverse;
    }
  }
}

export function applyCommand(scene: SceneSpec, command: unknown): SceneCommandResult {
  validateScene(scene);
  validateCommand(command);
  if (scene.sceneRevision !== command.expectedSceneRevision)
    throw new SceneError("STALE_REVISION", "場景已變更，請重新預覽操作。");
  if (scene.sceneRevision >= Number.MAX_SAFE_INTEGER)
    throw new SceneError("REVISION_EXHAUSTED", "Scene revision 已達安全上限。");
  const next = createScene(scene);
  const inverse: SceneOperation[] = [];
  for (const operation of command.operations) {
    inverse.unshift(execute(next, operation));
    validateScene(next);
  }
  next.sceneRevision += 1;
  validateScene(next);
  return {
    scene: next,
    inverse: { expectedSceneRevision: next.sceneRevision, operations: inverse },
  };
}
