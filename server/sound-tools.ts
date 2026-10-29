import { Ajv2020 } from "ajv/dist/2020.js";
import proposalSchema from "../schemas/sound-behavior/sound-behavior-ai.schema.json" with { type: "json" };
import documentSchema from "../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import type { SoundBehaviorOperation } from "../schemas/sound-behavior/types.js";
import { AgentError } from "../src/ai/types.js";
import { assertBoundedJson } from "../src/ai/validation.js";

type Schema = Record<string, unknown>;
const originalDefs = documentSchema.$defs as Record<string, Schema>;
const originalOperations = proposalSchema.properties.operations as Schema;
const originalArguments = {
  type: "object",
  properties: { operations: originalOperations },
  required: ["operations"],
  additionalProperties: false,
};
function schemaObject(value: unknown): Schema {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AgentError("SCHEMA_INVALID", "Sound provider schema必須是object。");
  return value as Schema;
}
function refName(ref: unknown): string {
  if (typeof ref !== "string") throw new AgentError("SCHEMA_INVALID", "Sound schema ref無效。");
  const prefix = documentSchema.$id + "#/$defs/";
  const name = ref.startsWith(prefix)
    ? ref.slice(prefix.length)
    : ref.startsWith("#/$defs/")
      ? ref.slice(8)
      : null;
  if (!name || !/^[A-Za-z0-9]+$/.test(name) || !originalDefs[name])
    throw new AgentError("SCHEMA_INVALID", "Sound provider只接受已固定的本地schema refs。");
  return name;
}
function discriminator(branches: unknown[]): string {
  const schemas = branches.map(schemaObject);
  const first = schemas[0];
  for (const key of (first?.required as string[] | undefined) ?? []) {
    const constants = schemas.map((branch) => {
      if (!(branch.required as string[] | undefined)?.includes(key)) return undefined;
      const properties = branch.properties as Record<string, Schema> | undefined;
      return properties?.[key]?.const;
    });
    if (
      constants.every((value) => typeof value === "string") &&
      new Set(constants).size === schemas.length
    )
      return key;
  }
  throw new AgentError("SCHEMA_INVALID", "Sound oneOf不是互斥且必填的const discriminator。");
}
function createParameters(): Schema {
  const definitions: Record<string, Schema> = {};
  const active = new Set<string>();
  const transform = (input: unknown): Schema => {
    const node = schemaObject(input);
    if (node.$ref !== undefined) {
      if (Object.keys(node).some((key) => !["$ref", "description"].includes(key)))
        throw new AgentError("SCHEMA_INVALID", "Sound ref不能忽略額外schema限制。");
      const name = refName(node.$ref);
      if (active.has(name))
        throw new AgentError("SCHEMA_INVALID", "Sound schema不能包含遞迴refs。");
      if (!definitions[name]) {
        active.add(name);
        definitions[name] = transform(originalDefs[name]);
        active.delete(name);
      }
      return { $ref: `#/$defs/${name}` };
    }
    if (node.allOf !== undefined)
      throw new AgentError("SCHEMA_INVALID", "Sound provider不接受allOf。");
    if (node.anyOf !== undefined)
      throw new AgentError("SCHEMA_INVALID", "原始Sound anyOf尚未完成相容性驗證。");
    const out: Schema = {};
    for (const [key, value] of Object.entries(node)) {
      // Meta's observed HTTP 400 rejects this grammar keyword. The unchanged
      // original AJV contract below still enforces array uniqueness after decoding.
      if (
        [
          "$id",
          "$schema",
          "$defs",
          "title",
          "properties",
          "required",
          "oneOf",
          "uniqueItems",
        ].includes(key)
      )
        continue;
      out[key] = key === "items" ? transform(value) : structuredClone(value);
    }
    if (node.oneOf !== undefined) {
      const branches = node.oneOf as unknown[];
      discriminator(branches);
      out.anyOf = branches.map(transform);
    }
    if (node.type === "object") {
      if (node.additionalProperties !== false)
        throw new AgentError("SCHEMA_INVALID", "Sound provider object必須封閉。");
      const properties = schemaObject(node.properties);
      const required = node.required as string[];
      out.properties = Object.fromEntries(
        Object.entries(properties).map(([key, value]) => {
          const child = transform(value);
          return [key, required.includes(key) ? child : { anyOf: [child, { type: "null" }] }];
        }),
      );
      out.required = Object.keys(properties);
    }
    return out;
  };
  const parameters = transform(originalArguments);
  parameters.$defs = definitions;
  const depth = (input: unknown, containers: number): number => {
    const node = schemaObject(input);
    if (node.$ref !== undefined) return depth(definitions[refName(node.$ref)], containers);
    if (Array.isArray(node.anyOf))
      return Math.max(...node.anyOf.map((branch) => depth(branch, containers)));
    if (node.type === "object")
      return Math.max(
        containers + 1,
        ...Object.values(schemaObject(node.properties)).map((child) =>
          depth(child, containers + 1),
        ),
      );
    if (node.type === "array") return depth(node.items, containers + 1);
    return containers;
  };
  if (depth(parameters, 0) > 10)
    throw new AgentError("SCHEMA_INVALID", "Sound provider schema超出10層容器深度。");
  return parameters;
}
const parameters = createParameters();
const strictAjv = new Ajv2020({ strict: true, allErrors: true, ownProperties: true });
const validateStrict = strictAjv.compile(parameters);
const originalAjv = new Ajv2020({ strict: true, allErrors: true, ownProperties: true });
originalAjv.addSchema(documentSchema);
const validateOriginal = originalAjv.compile(originalArguments);

export function createMetaSoundFunctionTools(): unknown[] {
  return [
    {
      type: "function",
      function: {
        name: "ProposeSoundBehavior",
        strict: true,
        description:
          "只提出五種Sound Behavior operations；host固定scene、revision與proposal ID，驗證並預覽，不能Apply。optional欄位必填null代表省略。",
        parameters: structuredClone(parameters),
      },
    },
  ];
}

/** Removes null only where the original schema explicitly made a property optional. */
export function decodeSoundOperations(input: unknown): SoundBehaviorOperation[] {
  assertBoundedJson(input, 256 * 1024);
  if (!validateStrict(input))
    throw new AgentError(
      "SCHEMA_INVALID",
      "Meta Sound參數不符合strict tool契約。",
      (validateStrict.errors ?? []).map((error) => error.instancePath).slice(0, 16),
    );
  const restore = (schema: Schema, value: unknown): unknown => {
    if (schema.$ref !== undefined) return restore(originalDefs[refName(schema.$ref)]!, value);
    if (Array.isArray(schema.oneOf)) {
      const key = discriminator(schema.oneOf);
      const selected = schema.oneOf
        .map(schemaObject)
        .find(
          (branch) =>
            (branch.properties as Record<string, Schema>)[key]!.const ===
            (value as Record<string, unknown>)[key],
        );
      if (!selected) throw new AgentError("SCHEMA_INVALID", "Sound discriminator無匹配分支。");
      return restore(selected, value);
    }
    if (schema.type === "array")
      return (value as unknown[]).map((item) => restore(schemaObject(schema.items), item));
    if (schema.type === "object") {
      const properties = schema.properties as Record<string, Schema>;
      const required = schema.required as string[];
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key, item]) => item !== null || required.includes(key))
          .map(([key, item]) => [key, restore(properties[key]!, item)]),
      );
    }
    return value;
  };
  const decoded = restore(originalArguments, input);
  if (!validateOriginal(decoded))
    throw new AgentError(
      "SCHEMA_INVALID",
      "Meta Sound參數無法還原為原始五種operation契約。",
      (validateOriginal.errors ?? []).map((error) => error.instancePath).slice(0, 16),
    );
  return structuredClone((decoded as { operations: SoundBehaviorOperation[] }).operations);
}
