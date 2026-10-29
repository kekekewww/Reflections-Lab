import type { BehaviorRuntimeState } from "../../schemas/sound-behavior/types.js";
import type { ProfileRegistry } from "./profile-registry.js";
import { assertFinite, assertId, fail } from "./profile-registry.js";
import type { BehaviorRuntimeOptions } from "./types.js";

export function integer(value: unknown, min: number, max: number, name: string): number {
  assertFinite(value, min, max, name);
  if (!Number.isSafeInteger(value)) fail("INTEGER_REQUIRED", `${name} must be an integer`);
  return value;
}

/** Browser-safe deterministic identity, independent of array positions/engine handles. */
export function stableId(prefix: string, ...parts: (string | number)[]): string {
  let a = 2166136261,
    b = 0x9e3779b9;
  for (const part of parts) {
    const value = String(part),
      framed = `${value.length}:${value};`;
    for (let i = 0; i < framed.length; i++) {
      a = Math.imul(a ^ framed.charCodeAt(i), 16777619) >>> 0;
      b = Math.imul(b ^ framed.charCodeAt(i), 2246822519) >>> 0;
    }
  }
  return `${prefix}.${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

export function initialState(
  registry: ProfileRegistry,
  options: Required<BehaviorRuntimeOptions>,
): BehaviorRuntimeState {
  assertId(options.experimentId, "experimentId");
  assertId(options.runEpoch, "runEpoch");
  assertFinite(options.fixedDtSeconds, 0.000001, 1, "fixedDtSeconds");
  integer(options.randomSeed, 0, 4294967295, "randomSeed");
  integer(options.maxVoices, 1, 256, "maxVoices");
  integer(options.maxVoicesPerObject, 1, options.maxVoices, "maxVoicesPerObject");
  integer(options.maxRecentEvents, 1, 4096, "maxRecentEvents");
  integer(options.maxTraceEntries, 1, 16384, "maxTraceEntries");
  return {
    schemaVersion: "1.0.0",
    experimentId: options.experimentId,
    runEpoch: options.runEpoch,
    sceneRevision: registry.context.sceneRevision,
    documentId: registry.document.documentId,
    documentRevision: registry.document.revision,
    tick: 0,
    fixedDtSeconds: options.fixedDtSeconds,
    sequence: 0,
    bindings: registry.bindings.map((binding) => ({
      bindingId: binding.bindingId,
      activeRuleIds: [],
      cooldowns: [],
    })),
    instances: [],
    processedEventIds: [],
    randomSeed: options.randomSeed,
  };
}
