import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";

class OfflineContext extends FakeAudioContext {
  readonly renderQuantumSize = 128;
  async startRendering() {
    return this.createBuffer(1, 1, this.sampleRate) as unknown as AudioBuffer;
  }
}
function frame(sourceId: string): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: sourceId,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "offline-carrier-control-oracle",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: [],
    modelClass: "numericalApproximation",
    directDelayS: 0,
    paths: [],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_NOT_NATIVE_PCM"],
  };
}
function voice(id: string, fields: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId: id,
    sourceId: id,
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 200 },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    priority: 1,
    ...fields,
  };
}
async function setup(Context: typeof FakeAudioContext = OfflineContext) {
  const context = new Context();
  const ended: string[] = [];
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeReference",
    budget: { maxVoices: 1 },
    virtualization: {
      maxNativeVoices: 1,
      maxNativeGraphs: 2,
      maxNativeCarriers: 8,
      maxVirtualVoices: 4,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 30,
    },
    onVoiceEnded: (id) => ended.push(id),
  });
  await engine.enable(0);
  return { context, engine, ended };
}
function registerShot(
  context: FakeAudioContext,
  engine: AudioEngine,
  offset = 0.125,
  assetRate = 48000,
) {
  engine.registerBuffer(
    "pcm",
    context.createBuffer(1, assetRate, assetRate) as unknown as AudioBuffer,
    {
      name: "Original natural EOF PCM",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: "a".repeat(64),
    },
  );
  return voice("shot", {
    continuous: false,
    generator: {
      kind: "sample",
      asset: { assetId: "pcm", revision: 1, sha256: "a".repeat(64) },
      loop: false,
      startOffsetSeconds: offset,
    },
  });
}

test("offline virtual authored stops are swept at the actual scheduled time independent of event delivery", async () => {
  async function run(deliver: boolean) {
    const { context, engine, ended } = await setup();
    try {
      engine.playVoice(voice("blocker"), frame("blocker"));
      engine.playVoice(voice("shot", { continuous: false, durationSeconds: 0.1 }), frame("shot"));
      context.currentTime = 0.1;
      if (deliver) context.sources()[1]!.finish();
      assert.deepEqual(ended, [], "native delivery cannot mutate control ownership");
      const before = engine.getTelemetry().nativeSourceNodes;
      engine.flushControlUpdates();
      return {
        before,
        after: engine.getTelemetry().nativeSourceNodes,
        virtual: engine.getTelemetry().virtualVoices,
        ended,
      };
    } finally {
      engine.dispose();
    }
  }
  const deferred = await run(false),
    delivered = await run(true);
  assert.deepEqual(deferred, { before: 2, after: 1, virtual: 0, ended: ["shot"] });
  assert.deepEqual(delivered, deferred);
});

test("natural EOF is a checkpoint-delivered native observation, not a modeled deadline", async () => {
  const { context, engine, ended } = await setup();
  try {
    engine.playVoice(voice("blocker"), frame("blocker"));
    const input = registerShot(context, engine);
    engine.playVoice(input, frame("shot"));
    const carrier = context.sources()[1]!;
    assert.deepEqual(
      carrier.stops,
      [0.875],
      "the existing initial-rate finite cutoff is preserved, not called exact natural EOF",
    );
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 0.5;
    engine.flushControlUpdates();
    assert.equal(
      engine.getTelemetry().nativeSourceNodes,
      2,
      "a source-time estimate is not native EOF evidence",
    );
    assert.deepEqual(engine.evictAssets(["pcm"]).protectedAssetIds, ["pcm"]);
    carrier.finish();
    carrier.finish();
    assert.deepEqual(ended, [], "callback enqueues only, even if delivered twice");
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    engine.flushControlUpdates();
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["shot"]);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 1);
    assert.equal(engine.getTelemetry().virtualVoices, 0);
    assert.deepEqual(engine.evictAssets(["pcm"]).evictedAssetIds, ["pcm"]);
    context.currentTime = 2;
    engine.serviceNativeVoices();
    engine.flushControlUpdates();
    assert.equal(context.sources().length, 2, "ended natural one-shot cannot be replayed");
    assert.equal(carrier.starts.length, 1);
  } finally {
    engine.dispose();
  }
});

test("a rendered native sample with another asset rate is not cut at the analytic fractional offset prediction", async () => {
  const { context, engine, ended } = await setup();
  try {
    // Independent asset-frame oracle: Chromium's unit-rate nearest-frame origin
    // is7957. First128context frames at rate1 and next64 at rate2 advance42+2/3
    // asset frames at Fs8000. Native can still have content, but raw-origin model
    // predicts191.53frames. The original initial-rate finite cutoff is255.06.
    const input = registerShot(context, engine, (7957 + 0.49) / 8000, 8000);
    engine.playVoice(input, frame("shot"));
    context.currentTime = 128 / 48000;
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 192 / 48000;
    engine.flushControlUpdates();
    assert.equal(
      engine.getTelemetry().activeVoices,
      1,
      "unvalidated modeled EOF must not remove controls",
    );
    assert.deepEqual(ended, []);
    assert.equal(
      context.sources()[0]!.stops.length,
      1,
      "only the legacy finite cutoff was scheduled",
    );
    engine.updateVoice("shot", { gainLinear: 0.25, smoothingSeconds: 0 });
    context.sources()[0]!.finish();
    assert.deepEqual(ended, []);
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["shot"]);
  } finally {
    engine.dispose();
  }
});

test("unknown render quantum keeps natural EOF native-owned and bounded instead of guessing a block size", async () => {
  class UnknownQuantumOffline extends FakeAudioContext {
    async startRendering() {
      return this.createBuffer(1, 1, this.sampleRate) as unknown as AudioBuffer;
    }
  }
  const { context, engine, ended } = await setup(UnknownQuantumOffline);
  try {
    engine.playVoice(voice("blocker"), frame("blocker"));
    engine.playVoice(registerShot(context, engine), frame("shot"));
    context.currentTime = 0.25;
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 0.7;
    engine.flushControlUpdates();
    engine.serviceNativeVoices();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    assert.equal(engine.getTelemetry().nativeRenderQuantumFrames, null);
    assert.deepEqual(ended, []);
    context.sources()[1]!.finish();
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["shot"]);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 1);
  } finally {
    engine.dispose();
  }
});

test("authored stop bookkeeping uses the scheduled stop, not an earlier modeled natural boundary", async () => {
  const { context, engine, ended } = await setup();
  try {
    engine.playVoice(voice("blocker"), frame("blocker"));
    const shot = registerShot(context, engine, 0.5);
    engine.playVoice({ ...shot, durationSeconds: 0.6 }, frame("shot"));
    assert.deepEqual(context.sources()[1]!.stops, [0.5]);
    context.currentTime = 0.1;
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 0.32;
    engine.flushControlUpdates();
    engine.serviceNativeVoices();
    assert.equal(
      engine.getTelemetry().nativeSourceNodes,
      2,
      "estimated natural EOF is not the authored stop",
    );
    context.currentTime = 0.5;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 1);
    assert.deepEqual(ended, ["shot"]);
  } finally {
    engine.dispose();
  }
});

test("stale offline carrier callbacks cannot repopulate ownership after drain or disposal", async () => {
  const { context, engine, ended } = await setup();
  try {
    engine.playVoice(voice("blocker"), frame("blocker"));
    engine.playVoice(registerShot(context, engine), frame("shot"));
    const carrier = context.sources()[1]!,
      callback = carrier.onended!;
    await engine.drainVoices();
    const before = [...ended].sort();
    assert.doesNotThrow(() => callback.call(carrier, new Event("ended")));
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 0);
    assert.deepEqual([...ended].sort(), before);
    engine.dispose();
    assert.doesNotThrow(() => callback.call(carrier, new Event("ended")));
    assert.deepEqual([...ended].sort(), before);
  } finally {
    engine.dispose();
  }
});

test("an explicit carrier stop is never shortened by an unvalidated natural-end estimate", async () => {
  const { context, engine } = await setup();
  try {
    engine.playVoice(registerShot(context, engine), frame("shot"));
    context.currentTime = 0.1;
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 0.3;
    engine.stopVoice("shot", 0.3);
    assert.equal(context.sources()[0]!.stops.at(-1), 0.6);
    const source = engine.getNativeResourceSnapshot().sources[0]!;
    assert.equal(source.scheduledStopAudioTime, 0.6);
  } finally {
    engine.dispose();
  }
});

test("a late natural EOF observation retains its full checkpoint-delivered rendered tail", async () => {
  const { context, engine, ended } = await setup();
  try {
    engine.playVoice(registerShot(context, engine), frame("shot"));
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 0.6;
    context.sources()[0]!.finish();
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["shot"]);
    assert.equal(
      engine.getTelemetry().retiringVoices,
      1,
      "the model cannot backdate an observed natural tail",
    );
    assert.equal(engine.getNativeResourceSnapshot().sources[0]!.nativeEndedDeliveryAudioTime, 0.6);
    assert.equal(
      engine.getVoiceCursorState("shot", 0.6)?.historyIncomplete,
      true,
      "a native event delivery time cannot certify the actual EOF sample time",
    );
    context.currentTime = 0.619;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 1);
    context.currentTime = 0.62;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 0);
  } finally {
    engine.dispose();
  }
});

test("a stale natural callback cannot end a new carrier reusing the previous instance ID", async () => {
  const { context, engine, ended } = await setup();
  try {
    engine.playVoice(voice("blocker"), frame("blocker"));
    const input = registerShot(context, engine);
    engine.playVoice(input, frame("shot"));
    const old = context.sources()[1]!,
      callback = old.onended!;
    context.currentTime = 0.9;
    old.finish();
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["shot"]);
    assert.equal(
      engine.playVoice({ ...input, emissionTimeSeconds: 0.9 }, frame("shot")).accepted,
      true,
    );
    callback.call(old, new Event("ended"));
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["shot"]);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    assert.equal(context.sources()[2]!.starts.length, 1);
    assert.equal(
      context.sources()[2]!.stops.length,
      1,
      "new lifetime keeps its own legacy finite cutoff",
    );
  } finally {
    engine.dispose();
  }
});
