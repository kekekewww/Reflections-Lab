import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { verifyRecording } from "../../src/experiments/index.js";

test("interactive stalls drop reported wall time but only recording stalls pause the run", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "run" });
    app.advance(0.5);
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.match(app.getSnapshot().notice ?? "", /wall|牆鐘|追趕/);
    await app.dispatch({ type: "recordToggle" });
    app.advance(0.5);
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.match(app.getSnapshot().pauseReason ?? "", /負載|超限/);
  } finally {
    app.dispose();
  }
});

test("recording overrun retains a paused capture for explicit resume and contiguous final seal", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "recordToggle" });
    app.advance(0.5);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    const pausedTick = app.getSnapshot().tick;
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(
      app.getSnapshot().recording.state,
      "recording",
      "paused capture remains stoppable",
    );
    assert.equal(
      app.getRecordingArtifact(),
      null,
      "overrun does not silently finalize or discard capture",
    );
    app.advance(0.5);
    assert.equal(app.getSnapshot().tick, pausedTick);
    // Recording mode retains its fixed-step debt. Each explicit resume can process
    // at most four ticks; it must never skip the 30 ticks represented by 0.5 seconds.
    for (let attempt = 0; attempt < 8 && app.getSnapshot().tick < 30; attempt++) {
      const before = app.getSnapshot().tick;
      await app.dispatch({ type: "run" });
      app.advance(0);
      assert.ok(app.getSnapshot().tick > before && app.getSnapshot().tick <= before + 4);
    }
    await app.dispatch({ type: "pause" });
    assert.equal(app.getSnapshot().tick, 30);
    await app.dispatch({ type: "recordToggle" });
    assert.equal(app.getSnapshot().error, "");
    const artifact = app.getRecordingArtifact()!;
    assert.equal(artifact.status, "captured");
    assert.equal(artifact.frameCount, 30);
    assert.deepEqual(
      artifact.frames.map((frame) => frame.tick),
      Array.from({ length: artifact.frameCount }, (_, index) => index + 1),
    );
    await verifyRecording(artifact);
  } finally {
    app.dispose();
  }
});
