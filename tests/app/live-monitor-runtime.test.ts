import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";

test("monitor reads do not enable audio, mutate a scene, or change transport", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const scene = app.getSceneDocument();
    const before = app.getSnapshot();
    const levels = app.readLiveMonitor("levels");
    assert.equal(levels?.audio?.state, "blocked");
    assert.equal(levels?.audio?.waveform, null);
    assert.deepEqual(levels?.audio?.tracks, []);
    const load = app.readLiveMonitor("load");
    assert.equal(load?.audio, null);
    assert.equal(load?.load?.physicsMs, null);
    assert.equal(load?.load?.audioControlMs, null);
    assert.equal(app.getAudioDiagnostics(), null, "reading never creates a context");
    app.releaseLiveMonitor();
    assert.equal(app.getSnapshot().tick, before.tick);
    assert.equal(app.getSnapshot().simulationState, before.simulationState);
    assert.deepEqual(app.getSceneDocument(), scene);
    assert.throws(() => app.readLiveMonitor("invalid" as "load"), /LIVE_MONITOR_MODE/);
  } finally {
    app.dispose();
  }
  assert.equal(app.readLiveMonitor("levels"), null);
  app.releaseLiveMonitor();
});

test("load timing is opt-in and switching monitor views does not stop recording", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "recordToggle" });
    assert.equal(app.getSnapshot().recording.state, "recording");
    app.readLiveMonitor("load");
    app.advance(1 / 60);
    await app.flushRecordingEvaluation();
    const load = app.readLiveMonitor("load");
    assert.ok(load?.load);
    assert.equal(typeof load.load.physicsMs, "number");
    assert.ok(load.load.physicsMs! >= 0);
    const tick = app.getSnapshot().tick;
    app.readLiveMonitor("spectrum", "master-right");
    app.readLiveMonitor("waveform");
    app.releaseLiveMonitor();
    assert.equal(app.getSnapshot().recording.state, "recording");
    assert.equal(app.getSnapshot().tick, tick);
    assert.equal(
      app.readLiveMonitor("load")?.load?.physicsMs,
      null,
      "old timing is not replayed on remount",
    );
    await app.dispatch({ type: "recordToggle" });
  } finally {
    app.dispose();
  }
});
