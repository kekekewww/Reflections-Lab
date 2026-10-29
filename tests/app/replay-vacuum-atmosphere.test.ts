import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";

test("replayed unavailable status uses its captured vacuum atmosphere after live air is restored", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "setAtmosphere", medium: "vacuum" });
    await app.dispatch({ type: "run" });
    await app.dispatch({ type: "recordToggle" });
    for (let i = 0; i < 4; i++) app.advance(1 / 60);
    await app.dispatch({ type: "recordToggle" });
    const artifact = app.getRecordingArtifact()!;
    const acousticFrame = artifact.frames.find((frame) => frame.acousticFrames.length > 0);
    assert.ok(acousticFrame, "a real recorded solver frame is required");
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "setAtmosphere", medium: "air" });
    assert.equal(app.getSnapshot().acoustic.state, "ready");
    await app.dispatch({ type: "replay" });
    await app.dispatch({
      type: "seek",
      timeSeconds: (acousticFrame.tick - artifact.startTick!) / 60,
    });
    const model = app.getSnapshot();
    assert.equal(model.error, "");
    assert.equal(model.acoustic.state, "unavailable");
    assert.equal(model.acoustic.medium, "vacuum");
    assert.equal(model.acoustic.metrics[0]!.value, null);
    assert.match(model.acoustic.metrics[0]!.reason!, /真空/);
    assert.equal(model.acoustic.speedOfSoundMps, undefined);
  } finally {
    app.dispose();
  }
});
