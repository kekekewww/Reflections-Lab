import { Ajv2020 } from "ajv/dist/2020.js";
import toolSchema from "../../schemas/ai-tool-request.schema.json" with { type: "json" };
import { AgentError } from "./types.js";
import type { ToolRequest } from "./types.js";

const validate = new Ajv2020({ strict: true, allErrors: true, ownProperties: true }).compile(
  toolSchema,
);
export function assertBoundedJson(value: unknown, maxBytes = 64 * 1024): void {
  let nodes = 0;
  const seen = new Set<object>();
  const visit = (input: unknown, depth: number): void => {
    if (++nodes > 12000 || depth > 24)
      throw new AgentError("INPUT_LIMIT", "資料超出節點／深度上限。");
    if (input === null || typeof input === "boolean" || typeof input === "string") return;
    if (typeof input === "number") {
      if (!Number.isFinite(input)) throw new AgentError("SCHEMA_INVALID", "數字必須有限。");
      return;
    }
    if (typeof input !== "object") throw new AgentError("SCHEMA_INVALID", "只接受 JSON 資料。");
    if (seen.has(input)) throw new AgentError("SCHEMA_INVALID", "不接受循環參照。");
    const prototype = Object.getPrototypeOf(input);
    if (!Array.isArray(input) && prototype !== Object.prototype && prototype !== null)
      throw new AgentError("SCHEMA_INVALID", "只接受普通 JSON object。");
    seen.add(input);
    for (const key of Object.keys(input)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw new AgentError("SCHEMA_INVALID", "不接受 prototype 欄位。");
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !("value" in descriptor))
        throw new AgentError("SCHEMA_INVALID", "不接受 accessor。");
      visit(descriptor.value, depth + 1);
    }
    seen.delete(input);
  };
  visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).length > maxBytes)
    throw new AgentError("INPUT_LIMIT", "資料超過大小限制。");
}
export function canonicalJson(value: unknown): string {
  assertBoundedJson(value, 1024 * 1024);
  const ordered = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(ordered);
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, ordered(item)]),
      );
    return input;
  };
  return JSON.stringify(ordered(value));
}
export async function digestJson(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return (
    "sha256:" + [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}
export function validateToolRequest(input: unknown): ToolRequest {
  assertBoundedJson(input);
  if (!validate(input))
    throw new AgentError(
      "SCHEMA_INVALID",
      "工具請求不符合封閉契約。",
      (validate.errors ?? []).map((error) => error.instancePath).slice(0, 16),
    );
  return structuredClone(input) as unknown as ToolRequest;
}
export const localToolSchema = toolSchema;
