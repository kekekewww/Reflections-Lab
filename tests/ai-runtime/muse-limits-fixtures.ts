import { DEFAULT_META_CONFIG } from "../../server/meta-provider.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import type { MetaBudgetPolicy } from "../../server/meta-budget-ledger.js";
import type { MetaProviderConfig } from "../../server/meta-provider.js";
import type { PlannerContext } from "../../src/ai/types.js";

export const authorization = "artifact.meta-limits-20261104";
export const config: MetaProviderConfig = {
  ...DEFAULT_META_CONFIG,
  apiKey: "fixture-secret-unused",
  networkEnabled: true,
  modelId: "muse-spark-1.3",
  verificationStatus: "verified",
  verifiedAt: "2026-11-04T01:51:03.422Z",
  verificationArtifactId: authorization,
  maxEstimatedCostUsd: 5,
  inputUsdPerMillionTokens: 1.25,
  outputUsdPerMillionTokens: 4.25,
  pricingSource: "FIXTURE",
  maxRetries: 0,
  maxRequests: 200,
  maxInputBytes: 128000,
  parallelToolCalls: true,
  maxCompletionTokens: 16000,
  reasoningEffort: "medium",
};
export const policy: MetaBudgetPolicy = {
  authorizationId: authorization,
  modelId: config.modelId!,
  dataMode: "standard",
  budgetUsd: 5,
  inputUsdPerMillionTokens: 1.25,
  outputUsdPerMillionTokens: 4.25,
  pricingSource: "FIXTURE",
  maxRequests: 200,
  maxAttemptsPerRequest: 1,
};
export const context = (): PlannerContext => ({
  scene: createDefaultScene(),
  materials: DEFAULT_MATERIALS.map(({ id, label }) => ({ id, label })),
  signals: [{ id: "signal.tone-220", label: "220 Hz", frequencyHz: 220 }],
  materialRegistryRevision: 1,
});
export function call(index = 0, args: unknown = addArgs(index), name = "AddObject") {
  return {
    id: `call.${index}`,
    type: "function",
    function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) },
  };
}
export function addArgs(index = 0) {
  return {
    objectId: `fixture.object-${index}`,
    label: "Fixture",
    shape: "box",
    dimensionsM: [0.2, 0.2, 0.2],
    positionM: [-2 + index * 0.3, 0.1, 1],
    orientationQuaternion: [0, 0, 0, 1],
    materialId: DEFAULT_MATERIALS[0]!.id,
    mode: "fixed",
    massKg: 1,
  };
}
export function body(calls = [call()], id = "response.fixture", finish = "tool_calls") {
  return {
    id,
    model: config.modelId,
    choices: [
      {
        finish_reason: finish,
        message: { role: "assistant", content: "Fixture explanation", tool_calls: calls },
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      completion_tokens_details: { reasoning_tokens: 20 },
      prompt_tokens_details: { cached_tokens: 30 },
    },
  };
}
export const response = (value = body()) => new Response(JSON.stringify(value));
