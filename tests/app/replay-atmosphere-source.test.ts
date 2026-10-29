import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";

// Independent public API contract, frozen before execution. No internal writes.
test("authoritative air replay publishes captured speed, temperature and delay after live atmosphere changes", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "setAtmosphere", medium: "air", temperatureC: 0 });
    const capturedSpeed = app.getSnapshot().acoustic.speedOfSoundMps!;
    assert.ok(Number.isFinite(capturedSpeed));
    await app.dispatch({ type: "run" });
    await app.dispatch({ type: "recordToggle" });
    for (let i = 0; i < 4; i++) app.advance(1 / 60);
    await app.dispatch({ type: "recordToggle" });
    const artifact = app.getRecordingArtifact()!;
    const acousticFrame = artifact.frames.find((frame) => frame.acousticFrames.length > 0);
    assert.ok(acousticFrame, "a real captured solver frame is required");
    const capturedDelay = acousticFrame.acousticFrames[0]!.directDelayS;
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "setAtmosphere", medium: "air", temperatureC: 40 });
    const liveSpeed = app.getSnapshot().acoustic.speedOfSoundMps!;
    assert.notEqual(
      liveSpeed,
      capturedSpeed,
      "fixture must distinguish current and captured media",
    );
    await app.dispatch({ type: "replay" });
    await app.dispatch({
      type: "seek",
      timeSeconds: (acousticFrame.tick - artifact.startTick!) / 60,
    });
    const model = app.getSnapshot();
    console.log(
      JSON.stringify({
        capturedSpeed,
        liveSpeed,
        replaySpeed: model.acoustic.speedOfSoundMps,
        replayTemperature: model.acoustic.temperatureC,
        capturedDelay,
        replayDelay: model.acoustic.metrics[0]!.value,
        state: model.acoustic.state,
      }),
    );
    assert.equal(model.error, "");
    assert.equal(model.acoustic.medium, "air");
    assert.equal(model.acoustic.temperatureC, 0);
    assert.equal(model.acoustic.speedOfSoundMps, capturedSpeed);
    assert.equal(model.acoustic.metrics[0]!.value, capturedDelay);
  } finally {
    app.dispose();
  }
});
