import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";

test("commit diagnostics are passive, detached and scoped to the resumed capture", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    assert.equal(runtime.getRecordingCommitDiagnostics(), null);
    await runtime.dispatch({ type: "recordToggle" });
    const initial = runtime.getRecordingCommitDiagnostics();
    assert.ok(initial);
    assert.equal(initial.captureRunId, runtime.getRecordingAdvanceDiagnostics()?.captureRunId);
    assert.equal(initial.evaluation.count, 0);
    assert.equal(initial.storage?.count, 0);
    for (let index = 0; index < 12; index++) {
      runtime.advance(1 / 60);
      await runtime.flushRecordingEvaluation();
    }
    await runtime.dispatch({ type: "recordToggle" });
    const stopped = runtime.getRecordingCommitDiagnostics();
    assert.ok(stopped?.storage);
    assert.equal(stopped.evaluation.count, 12);
    assert.equal(stopped.evaluation.first.length, 8);
    assert.equal(stopped.evaluation.last.length, 2);
    assert.ok(stopped.evaluation.first.every((row) => row.completed === true));
    assert.ok(stopped.evaluation.first.every((row) => row.encodedFrameBytes! > 0));
    assert.equal(stopped.storage.last.at(-1)?.completed, true);
    assert.ok(Object.isFrozen(stopped));
    assert.ok(Object.isFrozen(stopped.evaluation.first[0]));
    assert.equal(initial.evaluation.count, 0);
    const access = runtime as unknown as { runEpoch: string };
    const epoch = access.runEpoch;
    access.runEpoch = "epoch.foreign";
    assert.equal(runtime.getRecordingCommitDiagnostics(), null);
    access.runEpoch = epoch;
    await runtime.dispatch({ type: "recordToggle" });
    const next = runtime.getRecordingCommitDiagnostics();
    assert.ok(next);
    assert.notEqual(next.captureRunId, stopped.captureRunId);
    assert.notEqual(next.sessionId, stopped.sessionId);
    assert.equal(next.evaluation.count, 0);
    assert.equal(next.storage?.count, 0);
    assert.equal(stopped.evaluation.count, 12);
  } finally {
    runtime.dispose();
  }
  assert.equal(runtime.getRecordingCommitDiagnostics(), null);
});
