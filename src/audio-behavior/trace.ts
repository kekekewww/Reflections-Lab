import type { BehaviorDecision } from "./types.js";

export function appendTrace(
  trace: BehaviorDecision[],
  decisions: BehaviorDecision[],
  maxEntries: number,
): void {
  trace.push(...structuredClone(decisions));
  if (trace.length > maxEntries) trace.splice(0, trace.length - maxEntries);
}
