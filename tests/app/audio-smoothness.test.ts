import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import { formatMessage } from "../../src/ui/locale-model.js";

test("listener updates coalesce to the last physics tick of each animation frame", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  try {
    (app as any).audio = engine;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    const poses: unknown[] = [];
    const update = engine.updateListener.bind(engine);
    engine.updateListener = (pose) => {
      poses.push(pose);
      update(pose);
    };
    app.advance(0.05);
    assert.equal(poses.length, 1);
    assert.deepEqual((poses[0] as any).positionM, (app as any).listener().positionM);
  } finally {
    app.dispose();
  }
});

test("a solve older than three ticks still admits its pending voice with stale telemetry", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  let deliver!: () => void;
  const delivery = new Promise<void>((resolve) => {
    deliver = resolve;
  });
  const service = (app as any).acoustics;
  const solve = service.solve.bind(service);
  service.solve = async (...args: unknown[]) => {
    const results = await solve(...args);
    await delivery;
    return results;
  };
  try {
    (app as any).audio = engine;
    (app as any).cachedEmitterFrames.clear();
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    (app as any).lastSolve = Infinity;
    for (let i = 0; i < 5; i++) app.advance(1 / 60);
    deliver();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.ok((engine.getTelemetry() as any).staleVoiceAdmissions > 0);
  } finally {
    deliver();
    app.dispose();
  }
});

test("interactive overrun notice is stable within a one-second reporting window", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "run" });
    app.advance(0.2);
    const notice = app.getSnapshot().notice;
    assert.match(notice ?? "", /牆鐘/);
    app.advance(0.3);
    assert.equal(app.getSnapshot().notice, notice);
    app.advance(0.8);
    assert.notEqual(app.getSnapshot().notice, notice);
    assert.match(app.getSnapshot().notice ?? "", /0\.967/);
  } finally {
    app.dispose();
  }
});

test("cached source admission starts in the same tick and the next solve preserves route identities", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  try {
    (app as any).audio = engine;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    assert.equal(
      engine.getTelemetry().activeVoices,
      1,
      "admitted before any solve promise resolves",
    );
    assert.equal(engine.getTelemetry().staleVoiceAdmissions, 1);
    const before = [...(engine as any).voices.values()][0] as any;
    const routes = new Map(before.routes);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.equal(context.sources().length, 1);
    assert.deepEqual([...before.routes.keys()], [...routes.keys()]);
    for (const [id, route] of routes) assert.equal(before.routes.get(id), route);
    assert.equal((app as any).pendingAudio.size, 0);
  } finally {
    app.dispose();
  }
});

test("cached admission refuses an old scene revision instead of routing invalid geometry", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  try {
    const internal = app as any;
    for (const frame of internal.cachedEmitterFrames.values()) frame.sceneRevision--;
    internal.audio = engine;
    internal.lastSolve = Infinity;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(internal.pendingAudio.size, 1);
    assert.equal(engine.getTelemetry().staleVoiceAdmissions, 0);
  } finally {
    app.dispose();
  }
});

test("fixed-tick publications coalesce per frame while a critical pause is delivered immediately", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const internal = app as any;
    const onTick = internal.onTick.bind(app);
    internal.onTick = (snapshot: unknown) => {
      onTick(snapshot);
      internal.requestPublication();
      internal.requestPublication();
    };
    await app.dispatch({ type: "run" });
    let notifications = 0;
    app.subscribe(() => {
      notifications++;
    });
    app.advance(0.05);
    assert.equal(notifications, 1);
    assert.equal(app.getSnapshot().tick, 3);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(
      notifications,
      1,
      "async acoustic delivery marks dirty without another frame build",
    );
    app.advance(0);
    assert.equal(notifications, 2);
    const pausing = app.dispatch({ type: "pause" });
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.ok(notifications >= 3, "critical transport is not waiting for another animation frame");
    await pausing;
  } finally {
    app.dispose();
  }
});

test("high-frequency look and key dispatches defer full models until the next frame", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    let notifications = 0;
    app.subscribe(() => {
      notifications++;
    });
    for (let i = 0; i < 40; i++) {
      await app.dispatch({ type: "inputLook", movementX: 1, movementY: 0 });
      await app.dispatch({ type: "inputKey", code: "KeyW", pressed: true });
    }
    assert.equal(notifications, 0);
    app.advance(0);
    assert.equal(notifications, 1);
    await app.dispatch({ type: "pause" });
    assert.ok(notifications > 1);
  } finally {
    app.dispose();
  }
});

test("buffer selection refuses recording, replay, staged placement and pending transactions with bilingual status", async () => {
  for (const state of ["recording", "replaying", "busy", "staged", "pending", "pendingProject"]) {
    const app = await LabRuntime.create({ useWorker: false });
    try {
      const internal = app as any;
      if (state === "recording" || state === "replaying") {
        const getView = internal.recorder.getView.bind(internal.recorder);
        internal.recorder.getView = () => {
          const view = getView();
          return { ...view, recording: { ...view.recording, state } };
        };
      } else if (state === "busy") internal.busy = true;
      else if (state === "pendingProject") internal.pendingProject = {};
      else {
        const snapshot = internal.interaction.snapshot.bind(internal.interaction);
        internal.interaction.snapshot = () => ({
          ...snapshot(),
          [state]: state === "staged" ? {} : true,
        });
      }
      await app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
      assert.equal(app.getSnapshot().error, "AUDIO_BUFFER_UNSAFE", state);
      assert.equal(app.getSnapshot().monitor.bufferPreset, "playback");
      assert.match(formatMessage("en", app.getSnapshot().error), /cannot restart/);
      assert.match(formatMessage("zh-TW", app.getSnapshot().error), /AUDIO_BUFFER_UNSAFE/);
      assert.equal(internal.audio, null);
    } finally {
      app.dispose();
    }
  }
});

test("runtime restart preserves transport, monitor settings and voice count, and Pause wins during restart", async () => {
  const original = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const app = await LabRuntime.create({ useWorker: false });
  const engine = new AudioEngine();
  try {
    const internal = app as any;
    internal.audio = engine;
    await engine.enable(0);
    engine.setMonitorGain(0.7);
    engine.setMuted(true);
    engine.setMonitorMode("raw");
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    const tick = app.getSnapshot().tick;
    contexts[0]!.currentTime = 0.4;
    const changing = app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
    assert.equal(app.getSnapshot().monitor.rebuilding, true);
    app.advance(0.05);
    assert.equal(
      app.getSnapshot().tick,
      tick + 3,
      "restart keeps fixed-step control advancement live",
    );
    await changing;
    const view = app.getSnapshot();
    assert.equal(view.error, "");
    assert.equal(view.simulationState, "running");
    assert.equal(view.monitor.activeVoices, 1);
    assert.equal(view.monitor.mode, "raw");
    assert.equal(view.monitor.gainLinear, 0.7);
    assert.equal(view.monitor.muted, true);
    assert.equal(view.monitor.bufferPreset, "balanced");
    assert.equal(view.monitor.outputLatencySeconds, 0.015);
    assert.equal(view.monitor.outputUnderrunEvents, null);
    assert.equal(view.monitor.outputUnderrunStatus, "NOT_AVAILABLE");
    contexts[1]!.currentTime = 0.4;
    const changingAgain = app.dispatch({ type: "setAudioBufferPreset", preset: "interactive" });
    await app.dispatch({ type: "pause" });
    await changingAgain;
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(engine.getTelemetry().paused, true);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(contexts[1]!.state, "closed");
  } finally {
    app.dispose();
    globalThis.AudioContext = original;
  }
});
