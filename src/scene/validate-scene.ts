import { Ajv2020 } from "ajv/dist/2020.js";
import schema from "../../schemas/scene.schema.json" with { type: "json" };
import { SceneError } from "./errors.js";
import type { SceneSpec } from "./types.js";

export const MAX_SCENE_JSON_BYTES = 1024 * 1024;
const validateSchema = new Ajv2020({
  strict: true,
  allErrors: true,
  ownProperties: true,
}).compile<SceneSpec>(schema);

export function assertJsonValue(input: unknown): void {
  let count = 0;
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number): void => {
    if (++count > 20000 || depth > 24)
      throw new SceneError("INPUT_LIMIT", "資料超出節點／深度上限。");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new SceneError("INVALID_NUMBER", "數值必須有限。");
      return;
    }
    if (typeof value === "string") {
      if (value.length > MAX_SCENE_JSON_BYTES) throw new SceneError("INPUT_LIMIT", "字串過長。");
      return;
    }
    if (typeof value !== "object") throw new SceneError("INVALID_JSON", "只接受有限 JSON 資料。");
    if (seen.has(value)) throw new SceneError("INVALID_JSON", "不接受循環參照。");
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      throw new SceneError("INVALID_JSON", "只接受一般 JSON object。");
    }
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw new SceneError("INVALID_JSON", "不接受 prototype 欄位。");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor))
        throw new SceneError("INVALID_JSON", "不接受 accessor 欄位。");
      visit(descriptor.value, depth + 1);
    }
    seen.delete(value);
  };
  visit(input, 0);
}

export function sceneValidationErrors(input: unknown): string[] {
  try {
    assertJsonValue(input);
  } catch (error) {
    return [error instanceof Error ? error.message : "Invalid JSON"];
  }
  if (!validateSchema(input)) {
    return (validateSchema.errors ?? []).map(
      (error) => `${error.instancePath || "/"}: ${error.message ?? error.keyword}`,
    );
  }
  const scene = input as SceneSpec;
  const errors: string[] = [];
  if (!Number.isSafeInteger(scene.sceneRevision)) errors.push("sceneRevision 必須為安全整數。");
  const ids = new Set<string>();
  for (const entity of [...scene.objects, ...scene.sources, scene.listener]) {
    if (ids.has(entity.id)) errors.push(`${entity.id}: 重複 domain ID。`);
    ids.add(entity.id);
  }
  for (const entity of [...scene.objects, scene.listener]) {
    if (Math.abs(Math.hypot(...entity.orientationQuaternion) - 1) > 1e-6) {
      errors.push(`${entity.id}: quaternion 必須為單位長度。`);
    }
  }
  const objectIds = new Set(scene.objects.map((object) => object.id));
  for (const source of scene.sources)
    if (!objectIds.has(source.objectId)) errors.push(`${source.id}: 物件參照不存在。`);
  for (const object of scene.objects) {
    const [width, height, depth] = object.dimensionsM;
    if (object.shape === "sphere" && (width !== height || width !== depth))
      errors.push(`${object.id}: 球體三軸直徑必須相同。`);
    if (object.shape === "capsule" && (width !== depth || height < width))
      errors.push(`${object.id}: capsule 外接尺寸不合法。`);
  }
  return errors;
}

export function validateScene(input: unknown): asserts input is SceneSpec {
  const errors = sceneValidationErrors(input);
  if (errors.length) throw new SceneError("INVALID_SCENE", "場景驗證失敗。", errors);
}

export function createScene(input: unknown): SceneSpec {
  validateScene(input);
  return structuredClone(input);
}

export function serializeScene(scene: SceneSpec): string {
  validateScene(scene);
  return JSON.stringify(scene);
}

export function deserializeScene(serialized: string): SceneSpec {
  if (
    typeof serialized !== "string" ||
    serialized.length > MAX_SCENE_JSON_BYTES ||
    new TextEncoder().encode(serialized).byteLength > MAX_SCENE_JSON_BYTES
  ) {
    throw new SceneError("INPUT_LIMIT", "場景 JSON 超過 1 MiB 上限。");
  }
  let input: unknown;
  try {
    input = JSON.parse(serialized);
  } catch {
    throw new SceneError("INVALID_JSON", "場景 JSON 無法解析。");
  }
  return createScene(input);
}
