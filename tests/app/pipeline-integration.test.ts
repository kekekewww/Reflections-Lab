import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { verifyRecording } from "../../src/experiments/index.js";

test("short take captures consecutive real physics ticks while RAF cannot add ticks", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const before = app.getSnapshot().tick;
    const initialHeight = app.getPose("ball")!.positionM[1];
    const pending = app.captureShortTake(0.1);
    app.advance(10);
    await pending;
    const artifact = app.getRecordingArtifact();
    assert.ok(artifact);
    await verifyRecording(artifact);
    assert.equal(app.getSnapshot().tick - before, 6);
    assert.equal(artifact.frames.length, 6);
    assert.equal(
      artifact.sourcePhaseEvidence?.evidenceClass,
      "logicalIntent",
      "a logical capture must not lose validated source-phase evidence",
    );
    assert.equal(artifact.sourcePhaseEvidence?.reason, "LOGICAL_INTENT_ONLY");
    assert.deepEqual(
      artifact.frames.map((frame) => frame.tick),
      [1, 2, 3, 4, 5, 6],
    );
    assert.ok(app.getPose("ball")!.positionM[1] < initialHeight);
    assert.equal(app.getSnapshot().simulationState, "paused");
  } finally {
    app.dispose();
  }
});

test("a user pause cancels a controlled take and never resumes it", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const pending = app.captureShortTake(1);
    await app.dispatch({ type: "pause" });
    await assert.rejects(pending, /SHORT_TAKE_INTERRUPTED/);
    assert.notEqual(app.getSnapshot().simulationState, "running");
    const tick = app.getSnapshot().tick;
    app.advance(1);
    assert.equal(app.getSnapshot().tick, tick);
  } finally {
    app.dispose();
  }
});

test("invalid take durations and overlapping capture are rejected without scene mutation", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const scene = app.getSceneDocument();
    await assert.rejects(app.captureShortTake(Number.NaN), /SHORT_TAKE_DURATION/);
    await assert.rejects(app.captureShortTake(61), /SHORT_TAKE_DURATION/);
    const pending = app.captureShortTake(0.1);
    try {
      await assert.rejects(app.captureShortTake(0.1), /SHORT_TAKE_BUSY/);
      // Valid duration reaches the overlap guard; this is not a sixty-second run.
      await assert.rejects(app.captureShortTake(60), /SHORT_TAKE_BUSY/);
      await assert.rejects(app.captureShortTake(60 + 1 / 60), /SHORT_TAKE_DURATION/);
    } finally {
      await pending;
    }
    assert.deepEqual(app.getSceneDocument(), scene);
  } finally {
    app.dispose();
  }
});

test("disposing during a take preserves cancellation instead of touching disposed physics", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const pending = app.captureShortTake(1);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  app.dispose();
  await assert.rejects(pending, /DISPOSED|CANCEL|SHORT_TAKE_INTERRUPTED/);
});

test("a controlled take after recording overload retains wall-time debt and captures exactly 180 new ticks", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const scene = app.getSceneDocument();
    await app.dispatch({ type: "recordToggle" });
    app.advance(0.2);
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(app.getSnapshot().recording.state, "recording");
    assert.equal(app.getSnapshot().tick, 4);
    const clock = (
      app as unknown as {
        world: { clock: { accumulatorSeconds: number; totalDroppedWallTimeSeconds: number } };
      }
    ).world.clock;
    const retainedDebt = clock.accumulatorSeconds;
    assert.ok(retainedDebt > 4 / 60, "recording overload must retain pending wall-time work");
    assert.equal(clock.totalDroppedWallTimeSeconds, 0);
    await app.dispatch({ type: "recordToggle" });
    const prefix = app.getRecordingArtifact();
    assert.ok(prefix);
    await verifyRecording(prefix);
    assert.equal(prefix.frames.length, 4);
    assert.equal(app.getSnapshot().recording.state, "finalized");
    const startTick = app.getSnapshot().tick;
    await app.captureShortTake(3);
    const take = app.getRecordingArtifact();
    assert.ok(take);
    await verifyRecording(take);
    assert.equal(take.frames.length, 180);
    assert.equal(app.getSnapshot().recording.canReplay, true);
    assert.deepEqual(
      take.frames.map((frame) => frame.tick),
      Array.from({ length: 180 }, (_, i) => startTick + i + 1),
    );
    assert.equal(app.getSnapshot().tick, startTick + 180);
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(
      clock.accumulatorSeconds,
      retainedDebt,
      "manual time does not consume or clear wall-time debt",
    );
    assert.equal(clock.totalDroppedWallTimeSeconds, 0);
    assert.deepEqual(
      app.getSceneDocument(),
      scene,
      "capture does not reset or mutate the authored scene",
    );
  } finally {
    app.dispose();
  }
});

test("a pause during a controlled take with retained debt seals a consecutive prefix without late ticks", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "recordToggle" });
    app.advance(0.2);
    await app.dispatch({ type: "recordToggle" });
    const clock = (
      app as unknown as {
        world: { clock: { accumulatorSeconds: number; totalDroppedWallTimeSeconds: number } };
      }
    ).world.clock;
    const debt = clock.accumulatorSeconds;
    const startTick = app.getSnapshot().tick;
    const pending = app.captureShortTake(3);
    for (let i = 0; i < 100 && app.getSnapshot().tick === startTick; i++)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.ok(
      app.getSnapshot().tick > startTick,
      "cancel only after a real controlled tick was accepted",
    );
    await app.dispatch({ type: "pause" });
    await assert.rejects(pending, /SHORT_TAKE_INTERRUPTED/);
    const prefix = app.getRecordingArtifact();
    assert.ok(prefix);
    await verifyRecording(prefix);
    assert.ok(prefix.frames.length > 0 && prefix.frames.length < 180);
    assert.deepEqual(
      prefix.frames.map((frame) => frame.tick),
      Array.from({ length: prefix.frames.length }, (_, i) => startTick + i + 1),
    );
    const stoppedTick = app.getSnapshot().tick;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    app.advance(10);
    assert.equal(app.getSnapshot().tick, stoppedTick);
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(clock.accumulatorSeconds, debt);
    assert.equal(clock.totalDroppedWallTimeSeconds, 0);
  } finally {
    app.dispose();
  }
});
