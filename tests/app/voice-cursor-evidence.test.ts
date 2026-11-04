import test from "node:test";
import assert from "node:assert/strict";
import { captureVoiceCursorEvidence } from "../../src/app/voice-cursor-evidence.js";
const cursor = {
  playheadSeconds: 1.25,
  elapsedSinceEmissionSeconds: 2,
  remainingDurationSeconds: null,
};
test("only complete native mapped cursors enter native evidence", () => {
  const times: number[] = [];
  const result = captureVoiceCursorEvidence([{ instanceId: "native" }], 3, {
    getVoiceCursorState: (_id, time) => {
      times.push(time);
      return { cursor, provenance: "native", historyIncomplete: false };
    },
  });
  assert.deepEqual(result.native, { native: cursor });
  assert.deepEqual(result.nonNative, {});
  assert.deepEqual(times, [3]);
  assert.notEqual(result.native.native, cursor);
});
test("virtual and restored incomplete history never claim native epoch evidence", () => {
  const result = captureVoiceCursorEvidence(
    [{ instanceId: "virtual" }, { instanceId: "restored" }],
    2,
    {
      getVoiceCursorState: (id) => ({
        cursor,
        provenance: id === "virtual" ? "virtual" : "native",
        historyIncomplete: true,
      }),
    },
  );
  assert.deepEqual(result.native, {});
  assert.ok(result.nonNative.virtual);
  assert.ok(result.nonNative.restored);
  assert.equal(result.nonNative.virtual.reason, "VIRTUAL_RENDERER_NOT_ACTIVE");
  assert.equal(result.nonNative.restored.reason, "NATIVE_HISTORY_INCOMPLETE");
  assert.deepEqual(result.nonNative.virtual.cursor, cursor);
});
test("missing renderer state never synthesizes a native cursor from logical age", () => {
  const result = captureVoiceCursorEvidence([{ instanceId: "missing" }], 100, {
    getVoiceCursorState: () => null,
  });
  assert.deepEqual(result, { native: {}, nonNative: {} });
  assert.deepEqual(captureVoiceCursorEvidence([{ instanceId: "disabled" }], 100, null), result);
});
test("mixed voices retain identity and explicit emission end", () => {
  const result = captureVoiceCursorEvidence(
    [{ instanceId: "complete" }, { instanceId: "virtual" }],
    2,
    {
      getVoiceCursorState: (id) => ({
        cursor: { ...cursor, emissionEndElapsedSeconds: 8 },
        provenance: id === "complete" ? "native" : "virtual",
        historyIncomplete: id !== "complete",
      }),
    },
  );
  assert.deepEqual(Object.keys(result.native), ["complete"]);
  assert.ok(result.native.complete);
  assert.ok(result.nonNative.virtual);
  assert.equal(result.native.complete.emissionEndElapsedSeconds, 8);
  assert.equal(result.nonNative.virtual.cursor.emissionEndElapsedSeconds, 8);
});
test("invalid clocks and duplicate persistent IDs fail explicitly", () => {
  assert.throws(() => captureVoiceCursorEvidence([], Number.NaN, null), /VOICE_CURSOR_TIME/);
  assert.throws(
    () => captureVoiceCursorEvidence([{ instanceId: "same" }, { instanceId: "same" }], 0, null),
    /VOICE_CURSOR_ID/,
  );
});

test("non-native evidence retains modeled native clock and an owned logical cursor", () => {
  const logicalCursor = { ...cursor, playheadSeconds: 99 };
  const state = {
    cursor,
    logicalCursor,
    cursorModel: "nativeFloat32AAndKRate-v2" as const,
    nativeAudioTimeSeconds: 0.75,
    cursorObservation: "modeledSourceClock;notNativePcmPointer" as const,
    provenance: "virtual" as const,
    historyIncomplete: true,
  };
  const result = captureVoiceCursorEvidence([{ instanceId: "parked" }], 100, {
    getVoiceCursorState: () => state,
  });
  assert.deepEqual(result.native, {});
  const audit = result.nonNative.parked! as typeof state;
  assert.equal(audit.nativeAudioTimeSeconds, 0.75);
  assert.equal(audit.cursorObservation, "modeledSourceClock;notNativePcmPointer");
  assert.equal(audit.cursorModel, "nativeFloat32AAndKRate-v2");
  assert.deepEqual(audit.logicalCursor, logicalCursor);
  logicalCursor.playheadSeconds = 101;
  assert.equal(
    audit.logicalCursor.playheadSeconds,
    99,
    "later renderer changes cannot alter captured audit",
  );
});
