import assert from "node:assert/strict";
import type { RecordedBehaviorSnapshot } from "../../../src/app/recording-processor.js";
import type { NonNativeVoiceCursorEvidence } from "../../../src/app/voice-cursor-evidence.js";
import type { VoiceCursor } from "../../../src/audio/types.js";

/**
 * Read the AudioEngine source cursor a recorded frame captured for one voice.
 *
 * Captures follow "nativeCompleteOnly; virtualAndIncompleteAuditsSeparate": a source that
 * starts inside the take has complete native history and is native evidence. A source
 * that was already playing is frozen and restarted at its cursor when Record (or a live
 * restore) begins, so it is kept only as a separate incomplete-history audit.
 */
export function recordedCursor(
  snapshot: RecordedBehaviorSnapshot,
  instanceId: string,
  history: "complete" | "incomplete",
): VoiceCursor {
  const audit = (
    snapshot as RecordedBehaviorSnapshot & {
      nonNativeVoiceCursors?: Record<string, NonNativeVoiceCursorEvidence>;
    }
  ).nonNativeVoiceCursors?.[instanceId];
  const native = snapshot.voiceCursors?.[instanceId];
  if (history === "complete") {
    assert.equal(audit, undefined, "complete native history is not also an incomplete audit");
    assert.ok(native, "capture must include the native AudioEngine source cursor");
    return native;
  }
  assert.equal(native, undefined, "an incomplete native history is never native evidence");
  assert.ok(audit, "capture must audit the actual AudioEngine source cursor");
  assert.equal(audit.provenance, "native");
  assert.equal(audit.historyIncomplete, true);
  assert.equal(audit.reason, "NATIVE_HISTORY_INCOMPLETE");
  return audit.cursor;
}
