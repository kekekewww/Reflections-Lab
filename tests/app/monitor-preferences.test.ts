import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { MAX_MONITOR_GAIN } from "../../src/audio/monitor-level.js";
import type { LabAction } from "../../src/ui/contracts.js";
import type { AssetStagingContext } from "../../src/app/asset-host.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";

async function withRuntime(
  run: (app: LabRuntime, contexts: FakeAudioContext[]) => Promise<void>,
): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const contexts: FakeAudioContext[] = [];
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  let app: LabRuntime | null = null;
  try {
    app = await LabRuntime.create({
      useWorker: false,
      // Public staging adapter only: no decoding or native DSP is claimed by this control test.
      assetStagingContext: (sampleRate): AssetStagingContext => {
        const staging = new FakeAudioContext();
        return {
          sampleRate,
          createBuffer: staging.createBuffer.bind(staging) as AssetStagingContext["createBuffer"],
          decodeAudioData: async () => {
            throw new Error("This control test does not decode imported audio");
          },
        };
      },
    });
    await run(app, contexts);
  } finally {
    app?.dispose();
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
}

async function accepted(app: LabRuntime, action: LabAction): Promise<void> {
  await app.dispatch(action);
  assert.equal(app.getSnapshot().error, "", action.type + " should succeed");
}

test("monitor preferences are visible before enabling a device without creating AudioContext", async () => {
  await withRuntime(async (app, contexts) => {
    let monitor = app.getSnapshot().monitor;
    assert.equal(monitor.state, "blocked");
    assert.equal(monitor.gainLinear, 1, "default product monitor is 0 dB");
    assert.equal(monitor.mode, "simulated");
    assert.equal(monitor.muted, true);
    assert.equal(contexts.length, 0);
    await accepted(app, { type: "setMonitorGain", gainLinear: 0.01 });
    monitor = app.getSnapshot().monitor;
    assert.equal(monitor.gainLinear, 0.01, "pre-enable gain is retained in the public view");
    await accepted(app, { type: "setMonitorMode", mode: "raw" });
    monitor = app.getSnapshot().monitor;
    assert.equal(monitor.mode, "raw", "pre-enable route is retained in the public view");
    assert.equal(monitor.state, "blocked");
    assert.equal(monitor.muted, true);
    assert.equal(contexts.length, 0, "changing preferences never activates a device");
  });
});

test("explicit listening enable initializes the device with the desired monitor gain and mode", async () => {
  await withRuntime(async (app, contexts) => {
    await accepted(app, { type: "setMonitorGain", gainLinear: 0.25 });
    await accepted(app, { type: "setMonitorMode", mode: "raw" });
    assert.equal(contexts.length, 0);
    await accepted(app, { type: "enableAudio" });
    const monitor = app.getSnapshot().monitor;
    assert.equal(contexts.length, 1);
    assert.equal(monitor.gainLinear, 0.25);
    assert.equal(monitor.mode, "raw");
    assert.equal(monitor.muted, false);
    assert.equal(monitor.state, "audible");
    assert.notEqual(contexts[0]!.state, "closed");
  });
});

test("all three buffer rebuilds preserve monitor gain, routing, mute and paused simulation", async () => {
  await withRuntime(async (app, contexts) => {
    await accepted(app, { type: "enableAudio" });
    await accepted(app, { type: "setMonitorGain", gainLinear: 0.4 });
    await accepted(app, { type: "setMonitorMode", mode: "raw" });
    await accepted(app, { type: "toggleMute" });
    await accepted(app, { type: "run" });
    app.advance(1 / 60);
    await accepted(app, { type: "pause" });
    const pausedState = app.getSnapshot().simulationState;
    assert.equal(pausedState, "paused");
    for (const preset of ["interactive", "balanced", "playback"] as const) {
      const count = contexts.length;
      await accepted(app, { type: "setAudioBufferPreset", preset });
      const view = app.getSnapshot();
      assert.equal(contexts.length, count + 1, preset + " creates one replacement context");
      assert.equal(contexts[count - 1]!.state, "closed");
      assert.equal(view.monitor.bufferPreset, preset);
      assert.equal(view.monitor.gainLinear, 0.4);
      assert.equal(view.monitor.mode, "raw");
      assert.equal(view.monitor.muted, true);
      assert.equal(view.simulationState, pausedState);
      assert.equal(view.monitor.rebuilding, false);
    }
    await accepted(app, { type: "toggleMute" });
    assert.equal(app.getSnapshot().monitor.muted, false);
    assert.equal(app.getSnapshot().monitor.gainLinear, 0.4);
    assert.equal(app.getSnapshot().monitor.mode, "raw");
  });
});

for (const enableDevice of [false, true])
  test(
    "invalid monitor preferences reject atomically " +
      (enableDevice ? "after" : "before") +
      " audio enable",
    async () => {
      await withRuntime(async (app, contexts) => {
        if (enableDevice) await accepted(app, { type: "enableAudio" });
        await accepted(app, { type: "setMonitorGain", gainLinear: 0.7 });
        await accepted(app, { type: "setMonitorMode", mode: "raw" });
        const previous = app.getSnapshot().monitor;
        const previousContexts = contexts.length;
        for (const gainLinear of [NaN, Infinity, -0.001, MAX_MONITOR_GAIN + 0.01]) {
          await app.dispatch({ type: "setMonitorGain", gainLinear });
          const view = app.getSnapshot();
          assert.match(
            view.error,
            /monitor|gain|INVALID/i,
            String(gainLinear) + " should be rejected explicitly",
          );
          assert.equal(view.monitor.gainLinear, previous.gainLinear);
          assert.equal(view.monitor.mode, previous.mode);
          assert.equal(contexts.length, previousContexts);
        }
        await app.dispatch({ type: "setMonitorMode", mode: "stereo" } as unknown as LabAction);
        const view = app.getSnapshot();
        assert.match(view.error, /monitor|mode|stereo|INVALID/i);
        assert.equal(view.monitor.gainLinear, previous.gainLinear);
        assert.equal(view.monitor.mode, previous.mode);
        assert.equal(contexts.length, previousContexts);
      });
    },
  );

test("the exact +12 dB maximum is retained before and after enabling the monitor", async () => {
  await withRuntime(async (app, contexts) => {
    await accepted(app, { type: "setMonitorGain", gainLinear: MAX_MONITOR_GAIN });
    assert.equal(app.getSnapshot().monitor.gainLinear, MAX_MONITOR_GAIN);
    assert.ok(MAX_MONITOR_GAIN > 2, "the product ceiling exceeds the legacy linear-two limit");
    assert.equal(contexts.length, 0);
    await accepted(app, { type: "enableAudio" });
    assert.equal(app.getSnapshot().monitor.gainLinear, MAX_MONITOR_GAIN);
    await accepted(app, { type: "setMonitorGain", gainLinear: 1 });
    await accepted(app, { type: "setMonitorGain", gainLinear: MAX_MONITOR_GAIN });
    assert.equal(app.getSnapshot().monitor.gainLinear, MAX_MONITOR_GAIN);
    assert.equal(contexts.length, 1);
  });
});
