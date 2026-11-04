import type { VoiceCursor } from "../audio/types.js";

export interface CapturedVoiceCursorState {
  cursor: VoiceCursor;
  provenance: "native" | "virtual";
  historyIncomplete: boolean;
  logicalCursor?: VoiceCursor;
  cursorModel?: "nativeFloat32AAndKRate-v2" | "analytic-v1";
  nativeAudioTimeSeconds?: number | null;
  cursorObservation?: "modeledSourceClock;notNativePcmPointer";
}
export interface VoiceCursorEvidenceSource {
  getVoiceCursorState(
    instanceId: string,
    simulationTimeSeconds: number,
  ): CapturedVoiceCursorState | null;
}
export interface NonNativeVoiceCursorEvidence extends CapturedVoiceCursorState {
  reason: "VIRTUAL_RENDERER_NOT_ACTIVE" | "NATIVE_HISTORY_INCOMPLETE";
}

/** Virtual source age is useful for recovery, but never proves native rendered history. */
export function captureVoiceCursorEvidence(
  instances: readonly { instanceId: string }[],
  simulationTimeSeconds: number,
  source: VoiceCursorEvidenceSource | null,
): {
  native: Record<string, VoiceCursor>;
  nonNative: Record<string, NonNativeVoiceCursorEvidence>;
} {
  if (!Number.isFinite(simulationTimeSeconds) || simulationTimeSeconds < 0)
    throw new Error("VOICE_CURSOR_TIME");
  const seen = new Set<string>();
  const native: [string, VoiceCursor][] = [];
  const nonNative: [string, NonNativeVoiceCursorEvidence][] = [];
  for (const { instanceId } of instances) {
    if (!instanceId || seen.has(instanceId)) throw new Error("VOICE_CURSOR_ID");
    seen.add(instanceId);
    const state = source?.getVoiceCursorState(instanceId, simulationTimeSeconds);
    if (!state) continue;
    if (
      (state.provenance !== "native" && state.provenance !== "virtual") ||
      typeof state.historyIncomplete !== "boolean"
    )
      throw new Error("VOICE_CURSOR_STATE");
    const cursor = { ...state.cursor };
    if (state.provenance === "native" && !state.historyIncomplete)
      native.push([instanceId, cursor]);
    else
      nonNative.push([
        instanceId,
        {
          ...state,
          cursor,
          ...(state.logicalCursor ? { logicalCursor: { ...state.logicalCursor } } : {}),
          provenance: state.provenance,
          historyIncomplete: state.historyIncomplete,
          reason:
            state.provenance === "virtual"
              ? "VIRTUAL_RENDERER_NOT_ACTIVE"
              : "NATIVE_HISTORY_INCOMPLETE",
        },
      ]);
  }
  return { native: Object.fromEntries(native), nonNative: Object.fromEntries(nonNative) };
}
