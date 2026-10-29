import { Ajv2020 } from "ajv/dist/2020.js";
import documentSchema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import type { SoundBehaviorProposal } from "../../schemas/sound-behavior/types.js";
import { createProfileRegistry } from "../audio-behavior/profile-registry.js";
import type { SoundHostState } from "./sound-host.js";
import { AgentError } from "./types.js";
import type { PlannerProvenance } from "./types.js";
import { assertBoundedJson } from "./validation.js";

export interface SoundPlannerOptions {
  selectedObjectId?: string;
  assetLabels?: Record<string, string>;
}
export interface SoundPlannerInput {
  state: SoundHostState;
  options?: SoundPlannerOptions;
}
export interface SoundAgentPlan {
  proposal: SoundBehaviorProposal;
  assumptions: string[];
  warnings: string[];
  summary: string;
  provenance: PlannerProvenance;
}

const id = { $ref: documentSchema.$id + "#/$defs/Id" };
const revision = { type: "integer", minimum: 0, maximum: 2147483647 };
const generation = { type: "integer", minimum: 1, maximum: 2147483647 };
const ids = { type: "array", items: id, maxItems: 4096, uniqueItems: true };
const vec3 = { $ref: documentSchema.$id + "#/$defs/Vec3" };
const schema = {
  type: "object",
  required: ["state"],
  additionalProperties: false,
  properties: {
    state: {
      type: "object",
      required: ["sceneId", "sceneRevision", "document", "context"],
      additionalProperties: false,
      properties: {
        sceneId: id,
        sceneRevision: revision,
        document: { $ref: documentSchema.$id },
        context: {
          type: "object",
          required: ["sceneRevision", "objects", "materialIds", "zoneIds", "assetRegistry"],
          additionalProperties: false,
          properties: {
            sceneRevision: revision,
            objects: {
              type: "array",
              maxItems: 4096,
              items: {
                type: "object",
                required: ["objectId", "generation"],
                additionalProperties: false,
                properties: { objectId: id, generation },
              },
            },
            materialIds: ids,
            zoneIds: ids,
            colliders: {
              type: "array",
              maxItems: 8192,
              items: {
                type: "object",
                required: ["colliderId", "objectId"],
                additionalProperties: false,
                properties: { colliderId: id, objectId: id },
              },
            },
            zonePositions: {
              type: "object",
              maxProperties: 4096,
              propertyNames: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" },
              additionalProperties: vec3,
            },
            assetRegistry: {
              type: "array",
              maxItems: 256,
              items: {
                type: "object",
                required: ["assetId", "revision", "sha256", "availability", "rightsStatus"],
                additionalProperties: false,
                properties: {
                  assetId: id,
                  revision: generation,
                  sha256: { $ref: documentSchema.$id + "#/$defs/Sha256" },
                  availability: { enum: ["READY", "MISSING", "FIXTURE_ONLY"] },
                  rightsStatus: { enum: ["APPROVED", "UNVERIFIED", "FIXTURE_ONLY"] },
                  durationSeconds: { type: "number", exclusiveMinimum: 0, maximum: 600 },
                },
              },
            },
            validationMode: { const: "product" },
          },
        },
      },
    },
    options: {
      type: "object",
      additionalProperties: false,
      properties: {
        selectedObjectId: id,
        assetLabels: {
          type: "object",
          maxProperties: 256,
          propertyNames: { pattern: "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$" },
          additionalProperties: { type: "string", maxLength: 160 },
        },
      },
    },
  },
};
const ajv = new Ajv2020({ strict: true, allErrors: true, ownProperties: true });
ajv.addSchema(documentSchema);
const validate = ajv.compile(schema);

/** Validates transport input, never grants authority over the live client host. */
export function validateSoundPlannerInput(input: unknown): SoundPlannerInput {
  assertBoundedJson(input, 256 * 1024);
  if (!validate(input))
    throw new AgentError(
      "SCHEMA_INVALID",
      "Sound planner輸入不符合封閉的state／options契約。",
      (validate.errors ?? []).map((error) => error.instancePath).slice(0, 16),
    );
  const value = structuredClone(input) as unknown as SoundPlannerInput;
  if (value.state.context.sceneRevision !== value.state.sceneRevision)
    throw new AgentError("REVISION_CONFLICT", "Sound context與場景revision不符。");
  if (
    value.options?.selectedObjectId &&
    !value.state.context.objects.some(
      (object) => object.objectId === value.options!.selectedObjectId,
    )
  )
    throw new AgentError("UNKNOWN_OBJECT", "所選Sound物件不在目前registry。");
  for (const assetId of Object.keys(value.options?.assetLabels ?? {}))
    if (!value.state.context.assetRegistry.some((asset) => asset.assetId === assetId))
      throw new AgentError("UNKNOWN_ASSET", "音檔標籤不在目前registry。");
  try {
    createProfileRegistry(value.state.document, {
      ...value.state.context,
      validationMode: "product",
    });
  } catch (error) {
    throw new AgentError(
      error && typeof error === "object" && "code" in error ? String(error.code) : "DOMAIN_INVALID",
      error instanceof Error ? error.message : "Sound context／document驗證失敗。",
    );
  }
  return value;
}
