import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";

interface ClockAccess {
  world: {
    tick: number;
    paused: boolean;
    clock: {
      accumulatorSeconds: number;
      totalDroppedWallTimeSeconds: number;
      maxCatchUpSteps: number;
    };
  };
}

// Actual Runtime/physics/evaluation with reference worker policy. Observations
// are scalars only and do not prove native browser, PCM, or performance results.
test("recording advance observations and reads stay passive before any capture", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    const scene = runtime.getSceneDocument();
    const before = runtime.getSnapshot();
    assert.equal(runtime.getRecordingAdvanceDiagnostics(), null);
    runtime.observeRecordingFrame(null, null, null);
    runtime.observeRecordingHostFlush(0);
    assert.equal(runtime.getRecordingAdvanceDiagnostics(), null);
    assert.equal(runtime.getSnapshot().tick, before.tick);
    assert.equal(runtime.getSnapshot().simulationState, before.simulationState);
    assert.equal(runtime.getSnapshot().recording.state, before.recording.state);
    assert.equal(runtime.getAudioDiagnostics(), null, "diagnostic reads never enable audio");
    assert.deepEqual(runtime.getSceneDocument(), scene);
  } finally {
    runtime.dispose();
  }
  runtime.observeRecordingFrame(1, 2, 3);
  runtime.observeRecordingHostFlush(4);
  assert.equal(runtime.getRecordingAdvanceDiagnostics(), null);
});

test("direct 0.2 second recording advance keeps the original four-step cap and all wall-time debt", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  const access = runtime as unknown as ClockAccess;
  try {
    await runtime.dispatch({ type: "recordToggle" });
    const initial = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(initial);
    assert.equal(initial.advanceCount, 0);
    assert.deepEqual(initial.first, []);
    assert.equal(initial.firstOverrun, null);
    const tickBefore = access.world.tick;
    const accumulatorBefore = access.world.clock.accumulatorSeconds;
    runtime.advance(0.2);
    const snapshot = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(snapshot);
    assert.equal(access.world.clock.maxCatchUpSteps, 4);
    assert.equal(access.world.tick, tickBefore + 4);
    assert.equal(access.world.paused, true);
    assert.equal(access.world.clock.totalDroppedWallTimeSeconds, 0);
    assert.ok(
      Math.abs(access.world.clock.accumulatorSeconds - (accumulatorBefore + 0.2 - 4 / 60)) < 1e-12,
    );
    assert.equal(snapshot.advanceCount, 1);
    const row = snapshot.first[0]!;
    assert.equal(row.deltaSeconds, 0.2);
    assert.equal(row.steps, 4);
    assert.equal(row.tickBefore, tickBefore);
    assert.equal(row.tickAfter, tickBefore + 4);
    assert.equal(row.overrun, true);
    assert.equal(row.accumulatorBeforeSeconds, accumulatorBefore);
    assert.equal(row.accumulatorAfterSeconds, access.world.clock.accumulatorSeconds);
    assert.equal(row.previousRafAtMs, null);
    assert.equal(row.currentRafAtMs, null);
    assert.equal(row.callbackAtMs, null);
    assert.equal(row.hostFlushElapsedMs, null);
    assert.equal(snapshot.firstOverrun?.sequence, row.sequence);
    assert.ok(
      snapshot.firstOverrunContext,
      "the first genuine fixed-clock overrun has bounded context",
    );
    assert.equal(
      snapshot.queueGuard,
      null,
      "four accepted frames do not invent the eight-frame queue guard",
    );
    await runtime.flushRecordingEvaluation();
    assert.equal(runtime.getSnapshot().tick, tickBefore + 4);
    assert.equal(runtime.getSnapshot().simulationState, "paused");
  } finally {
    runtime.dispose();
  }
});

test("host timestamps and flush belong only to the actual recording advance, never a later paused RAF", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    await runtime.dispatch({ type: "recordToggle" });
    runtime.observeRecordingFrame(100, 116, 117);
    runtime.advance(1 / 60);
    runtime.observeRecordingHostFlush(2.5);
    const observed = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(observed);
    assert.equal(observed.advanceCount, 1);
    assert.equal(observed.first[0]?.previousRafAtMs, 100);
    assert.equal(observed.first[0]?.currentRafAtMs, 116);
    assert.equal(observed.first[0]?.callbackAtMs, 117);
    assert.equal(observed.first[0]?.hostFlushElapsedMs, 2.5);
    runtime.observeRecordingHostFlush(900);
    assert.equal(
      runtime.getRecordingAdvanceDiagnostics()?.first[0]?.hostFlushElapsedMs,
      2.5,
      "one host flush observation is consumed per host frame",
    );
    await runtime.flushRecordingEvaluation();
    await runtime.dispatch({ type: "pause" });
    const pausedTick = runtime.getSnapshot().tick;
    runtime.observeRecordingFrame(116, 216, 217);
    runtime.advance(0.1);
    runtime.observeRecordingHostFlush(999);
    const paused = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(paused);
    assert.equal(paused.advanceCount, 1);
    assert.equal(paused.first[0]?.hostFlushElapsedMs, 2.5);
    assert.equal(paused.first[0]?.currentRafAtMs, 116);
    assert.equal(
      observed.first[0]?.hostFlushElapsedMs,
      2.5,
      "returned snapshots do not mutate after later reads",
    );
    assert.equal(runtime.getSnapshot().tick, pausedTick);
  } finally {
    runtime.dispose();
  }
});

async function drainRecording(runtime: LabRuntime) {
  await runtime.flushRecordingEvaluation();
  const host = (
    runtime as unknown as {
      recorder: { getPersistenceQueueTelemetry(): { pendingFrames: number } | null };
    }
  ).recorder;
  for (
    let attempt = 0;
    attempt < 100 && (host.getPersistenceQueueTelemetry()?.pendingFrames ?? 0) > 0;
    attempt++
  )
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(
    host.getPersistenceQueueTelemetry()?.pendingFrames ?? 0,
    0,
    "the prior real frame must persist before the next controlled test advance",
  );
}

test("returned diagnostic snapshots stay detached and host metadata cannot leak into a later direct advance", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    const scene = runtime.getSceneDocument();
    await runtime.dispatch({ type: "recordToggle" });
    runtime.observeRecordingFrame(100, 120, 121);
    runtime.advance(1 / 60);
    runtime.observeRecordingHostFlush(3);
    await drainRecording(runtime);
    const snapshot = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(snapshot);
    const again = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(again);
    assert.notEqual(snapshot, again);
    assert.notEqual(snapshot.first, again.first);
    assert.notEqual(snapshot.first[0], again.first[0]);
    Reflect.set(snapshot.first[0]!, "steps", 999);
    Reflect.set(snapshot.first[0]!, "deltaSeconds", 10);
    assert.equal(runtime.getRecordingAdvanceDiagnostics()?.first[0]?.steps, 1);
    assert.equal(runtime.getRecordingAdvanceDiagnostics()?.first[0]?.deltaSeconds, 1 / 60);
    assert.equal(runtime.getAudioDiagnostics(), null);
    // Only a prior observeRecordingFrame marks a host frame; a bare direct
    // advance has unknown host provenance and cannot accept a later flush mark.
    runtime.advance(1 / 60);
    runtime.observeRecordingHostFlush(999);
    await drainRecording(runtime);
    const next = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(next);
    assert.equal(next.advanceCount, 2);
    assert.equal(next.first[1]?.previousRafAtMs, null);
    assert.equal(next.first[1]?.currentRafAtMs, null);
    assert.equal(next.first[1]?.callbackAtMs, null);
    assert.equal(
      next.first[1]?.hostFlushElapsedMs,
      null,
      "a direct advance cannot inherit an old host frame's flush mark",
    );
    assert.equal(snapshot.advanceCount, 1);
    assert.equal(snapshot.first[0]?.hostFlushElapsedMs, 3);
    assert.ok(!JSON.stringify(next).includes('"sceneSnapshot"'));
    assert.ok(!JSON.stringify(next).includes('"pcm"'));
    assert.deepEqual(runtime.getSceneDocument(), scene);
  } finally {
    runtime.dispose();
  }
});

test("bounded retention across fifteen real recording advances keeps first eight and chronological latest two", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    await runtime.dispatch({ type: "recordToggle" });
    const startTick = runtime.getSnapshot().tick;
    for (let sequence = 1; sequence <= 15; sequence++) {
      runtime.observeRecordingFrame((sequence - 1) * 20, sequence * 20, sequence * 20 + 1);
      // Observation timestamps do not replace this explicit deterministic delta.
      runtime.advance(1 / 60);
      runtime.observeRecordingHostFlush(sequence / 10);
      await drainRecording(runtime);
    }
    const snapshot = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(snapshot);
    assert.equal(snapshot.startTick, startTick);
    assert.equal(snapshot.advanceCount, 15);
    assert.deepEqual(
      snapshot.first.map((row) => row.sequence),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      snapshot.last.map((row) => row.sequence),
      [14, 15],
    );
    assert.equal(
      snapshot.first.length + snapshot.last.length + Number(snapshot.firstOverrun !== null),
      10,
    );
    assert.equal(snapshot.first[0]?.previousRafAtMs, 0, "a measured zero timestamp is not unknown");
    assert.equal(snapshot.last[1]?.currentRafAtMs, 300);
    assert.equal(snapshot.last[1]?.hostFlushElapsedMs, 1.5);
    assert.ok(snapshot.first.every((row) => row.steps === 1 && row.overrun === false));
    assert.ok(snapshot.last.every((row) => row.steps === 1 && row.overrun === false));
    assert.equal(snapshot.firstOverrun, null);
    assert.equal(snapshot.firstOverrunContext, null);
    assert.equal(snapshot.queueGuard, null);
    assert.equal(runtime.getSnapshot().tick, startTick + 15);
    assert.equal(runtime.getSnapshot().recording.state, "recording");
  } finally {
    runtime.dispose();
  }
});

test("resuming an overloaded recording keeps its capture, earlier evidence, and existing wall-time debt", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  const access = runtime as unknown as ClockAccess;
  try {
    await runtime.dispatch({ type: "recordToggle" });
    const startTick = access.world.tick;
    runtime.advance(0.2);
    await drainRecording(runtime);
    const before = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(before);
    const debt = access.world.clock.accumulatorSeconds;
    assert.ok(debt > 4 / 60);
    await runtime.dispatch({ type: "run" });
    assert.equal(access.world.paused, false);
    assert.equal(access.world.clock.accumulatorSeconds, debt);
    const resumed = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(resumed);
    assert.equal(resumed.captureSequence, before.captureSequence);
    assert.equal(resumed.captureRunId, before.captureRunId);
    assert.equal(resumed.advanceCount, 1);
    assert.deepEqual(resumed.first[0], before.first[0]);
    assert.ok(resumed.latestResumeWallMarkMs !== null && resumed.latestResumeWallMarkMs >= 0);
    assert.ok(
      before.latestResumeWallMarkMs !== null &&
        resumed.latestResumeWallMarkMs >= before.latestResumeWallMarkMs,
    );
    runtime.advance(0);
    await drainRecording(runtime);
    const next = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(next);
    assert.equal(next.advanceCount, 2);
    assert.equal(
      next.firstOverrun?.sequence,
      1,
      "the second overload cannot replace first-overrun evidence",
    );
    assert.equal(next.first[0]?.resumeWallMarkMs, before.first[0]?.resumeWallMarkMs);
    assert.equal(next.first[1]?.resumeWallMarkMs, resumed.latestResumeWallMarkMs);
    assert.equal(next.first[1]?.deltaSeconds, 0);
    assert.equal(next.first[1]?.steps, 4);
    assert.equal(access.world.tick, startTick + 8);
    assert.equal(access.world.clock.totalDroppedWallTimeSeconds, 0);
    assert.ok(Math.abs(access.world.clock.accumulatorSeconds - (debt - 4 / 60)) < 1e-12);
  } finally {
    runtime.dispose();
  }
});

test("a new capture clears previous advance and overrun evidence while disposal closes observations", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  const access = runtime as unknown as ClockAccess;
  try {
    await runtime.dispatch({ type: "recordToggle" });
    runtime.advance(0.2);
    await drainRecording(runtime);
    const prior = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(prior?.firstOverrun);
    const retainedDebt = access.world.clock.accumulatorSeconds;
    await runtime.dispatch({ type: "recordToggle" });
    const nextStart = access.world.tick;
    await runtime.dispatch({ type: "recordToggle" });
    const next = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(next);
    assert.equal(next.captureSequence, prior.captureSequence + 1);
    assert.notEqual(next.captureRunId, prior.captureRunId);
    assert.equal(next.startTick, nextStart);
    assert.equal(next.advanceCount, 0);
    assert.deepEqual(next.first, []);
    assert.deepEqual(next.last, []);
    assert.equal(next.firstOverrun, null);
    assert.equal(next.firstOverrunContext, null);
    assert.equal(next.queueGuard, null);
    assert.equal(
      access.world.clock.accumulatorSeconds,
      retainedDebt,
      "diagnostic reset is not a physics debt reset",
    );
    assert.equal(prior.advanceCount, 1);
    assert.equal(prior.firstOverrun.sequence, 1);
  } finally {
    runtime.dispose();
  }
  assert.doesNotThrow(() => runtime.observeRecordingFrame(1, 2, 3));
  assert.doesNotThrow(() => runtime.observeRecordingHostFlush(4));
  assert.equal(runtime.getRecordingAdvanceDiagnostics(), null);
});

test("an explicitly observed host frame can have unknown timestamps and a measured zero flush", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    await runtime.dispatch({ type: "recordToggle" });
    runtime.observeRecordingFrame(null, null, null);
    runtime.advance(1 / 60);
    runtime.observeRecordingHostFlush(0);
    const snapshot = runtime.getRecordingAdvanceDiagnostics();
    assert.ok(snapshot);
    assert.equal(snapshot.advanceCount, 1);
    assert.equal(snapshot.first[0]?.previousRafAtMs, null);
    assert.equal(snapshot.first[0]?.currentRafAtMs, null);
    assert.equal(snapshot.first[0]?.callbackAtMs, null);
    assert.equal(
      snapshot.first[0]?.hostFlushElapsedMs,
      0,
      "host ownership is explicit and not inferred from clock availability",
    );
    await drainRecording(runtime);
  } finally {
    runtime.dispose();
  }
});
