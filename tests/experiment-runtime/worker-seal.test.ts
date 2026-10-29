import test from "node:test";
import assert from "node:assert/strict";
import {
  ExperimentRecorder,
  sealRecordingSnapshot,
  verifyRecording,
} from "../../src/experiments/recorder.js";
import { canonicalStringify } from "../../src/experiments/hash.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { options, frame } from "./worker-fixture.js";

function captured() {
  const r = new ExperimentRecorder(options());
  for (let i = 0; i < 3; i++) r.appendFrame(frame(i));
  return r;
}
test("snapshot mutation cannot raise the recorder's actual frame admission budget", () => {
  const recorder = new ExperimentRecorder({ ...options(), budget: { maxFrames: 1 } });
  recorder.appendFrame(frame(0));
  const snapshot = recorder.captureSealSnapshot();
  try {
    snapshot.budget.maxFrames = 18001;
  } catch {
    // Immediate rejection is valid; subsequent admission must also remain bounded.
  }
  assert.throws(() => recorder.appendFrame(frame(1)), { code: "RECORDING_BUDGET" });
  assert.equal(recorder.getTelemetry().frameCount, 1);
  assert.equal(recorder.getTelemetry().state, "interrupted");
  assert.equal(recorder.getTelemetry().reason, "RECORDING_BUDGET");
});

test("snapshot ownership protects budgets, frame array, and deep frozen data", () => {
  const r = captured(),
    view = r.captureSealSnapshot(),
    max = view.budget.maxFrames;
  assert.ok(Object.isFrozen(view.budget));
  try {
    view.budget.maxFrames = 999999;
  } catch {}
  view.frames.length = 0;
  view.events.length = 0;
  const fresh = r.captureSealSnapshot();
  assert.equal(fresh.budget.maxFrames, max);
  assert.equal(fresh.frames.length, 3);
  assert.equal(fresh.events.length, 2);
  assert.ok(Object.isFrozen(fresh.configuration));
  assert.ok(Object.isFrozen(fresh.configuration.sceneSnapshot.objects[0]));
  assert.ok(Object.isFrozen(fresh.frames[0]));
  assert.ok(Object.isFrozen(fresh.frames[0]!.poses[0]));
});
test("snapshot sealing independently verifies and preserves canonical artifact and hashes", async () => {
  const r = captured(),
    snapshot = r.captureSealSnapshot();
  const expected = await r.finish();
  const result = await sealRecordingSnapshot(snapshot);
  assert.deepEqual(result.artifact, expected);
  assert.equal(canonicalStringify(result.artifact), canonicalStringify(expected));
  assert.deepEqual(new TextDecoder().decode(result.bytes), canonicalStringify(expected));
  await verifyRecording(result.artifact);
});
test("snapshot preflight rejects extra keys, changed budgets, counters and non-JSON input", async () => {
  const snap = captured().captureSealSnapshot();
  const extra = { ...structuredClone(snap), unexpected: true };
  await assert.rejects(sealRecordingSnapshot(extra));
  const budget = structuredClone(snap);
  (budget.budget as any).extra = 1;
  await assert.rejects(sealRecordingSnapshot(budget));
  const counter = structuredClone(snap);
  counter.traceBytes++;
  await assert.rejects(sealRecordingSnapshot(counter));
  const invalid = structuredClone(snap);
  Object.defineProperty(invalid, "runId", {
    enumerable: true,
    get() {
      return "run.a";
    },
  });
  await assert.rejects(sealRecordingSnapshot(invalid), { code: "NON_JSON" });
});
test("processor failure is cached and preserves original failure and recorder state", async () => {
  const r = captured(),
    error = new Error("worker failure");
  let calls = 0;
  const a = r.finish(async () => {
      calls++;
      throw error;
    }),
    b = r.finish();
  assert.equal(a, b);
  await assert.rejects(a, (e) => e === error);
  await assert.rejects(b, (e) => e === error);
  assert.equal(calls, 1);
  assert.equal(r.getTelemetry().state, "interrupted");
  assert.equal(r.getTelemetry().reason, "SEAL_FAILED");
});
test("public storage rejects tampered artifact", async () => {
  const artifact = await captured().finish(),
    invalid = structuredClone(artifact);
  invalid.frames[0]!.tick++;
  const store = new BlobStore({ indexedDB: null });
  try {
    await assert.rejects(store.saveRecording(invalid));
  } finally {
    store.close();
  }
});
