import assert from "node:assert/strict";
import type { AcousticRequest, AcousticSolution } from "../../src/acoustics/types.js";

export const CONFIGURATIONS = Object.freeze([
  { id: "A", persistentCache: false, transport: "clone" as const },
  { id: "B", persistentCache: true, transport: "clone" as const },
  { id: "C", persistentCache: false, transport: "deduplicated" as const },
  { id: "D", persistentCache: true, transport: "deduplicated" as const },
]);
export function assertFullOracle(
  referenceRequests: readonly AcousticRequest[],
  requests: readonly AcousticRequest[],
  referenceSolutions: readonly AcousticSolution[],
  solutions: readonly AcousticSolution[],
): void {
  assert.deepEqual(
    requests,
    referenceRequests,
    "complete request identity/geometry/material/ownership snapshot differs",
  );
  assert.deepEqual(
    solutions,
    referenceSolutions,
    "complete solver identity/path/vertices/bands/delay/diagnostics differs",
  );
}
export function summarize(values: readonly number[]) {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error("COMPONENT_TIMING_INVALID");
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0]!,
    median: sorted[Math.ceil(sorted.length * 0.5) - 1]!,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    max: sorted.at(-1)!,
  };
}
let observing = false;
/** Untimed instrumentation of explicit main-thread structuredClone calls only. */
export async function observeExplicitCopies<T>(operation: () => T | Promise<T>) {
  if (observing) throw new Error("COMPONENT_COPY_PROBE_BUSY");
  observing = true;
  const original = globalThis.structuredClone;
  const copies = {
    calls: 0,
    uniqueContainers: 0,
    numericValues: 0,
    jsonRepresentationBytes: 0,
    vmAllocationBytes: null,
    nativeWireBytes: null,
    scope:
      "Explicit main-thread structuredClone calls; not VM allocated bytes or internal worker copies",
  };
  globalThis.structuredClone = new Proxy(original, {
    apply(target, receiver, args) {
      copies.calls++;
      const stack: unknown[] = [args[0]],
        seen = new WeakSet<object>();
      while (stack.length) {
        const value = stack.pop();
        if (typeof value === "number") copies.numericValues++;
        else if (value !== null && typeof value === "object" && !seen.has(value)) {
          seen.add(value);
          copies.uniqueContainers++;
          for (const entry of Object.values(value)) stack.push(entry);
        }
      }
      const json = JSON.stringify(args[0]);
      if (json !== undefined)
        copies.jsonRepresentationBytes += new TextEncoder().encode(json).byteLength;
      return Reflect.apply(target, receiver, args);
    },
  });
  try {
    return { value: await operation(), copies };
  } finally {
    globalThis.structuredClone = original;
    observing = false;
  }
}
