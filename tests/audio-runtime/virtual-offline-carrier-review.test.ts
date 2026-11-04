import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";

// Audio-clock/control-graph oracle only. This does not render native PCM.
class OfflineContext extends FakeAudioContext {
  readonly renderQuantumSize = 128;
  async startRendering() {
    return this.createBuffer(1, 1, this.sampleRate) as unknown as AudioBuffer;
  }
}

async function retirementTrace(offline: boolean) {
  const context = offline ? new OfflineContext() : new FakeAudioContext();
  if (!offline) Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const ended: string[] = [];
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeReference",
    budget: { maxVoices: 1 },
    virtualization: {
      maxNativeVoices: 1,
      maxNativeGraphs: 2,
      maxNativeCarriers: 8,
      maxVirtualVoices: 2,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 30,
    },
    onVoiceEnded: (id) => ended.push(id),
  });
  const frame: AcousticFrame = {
    schemaVersion: "1.0.0",
    requestId: "retirement-authority",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "control-only",
    backendVersion: "1",
    sourceId: "shot",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: [],
    modelClass: "numericalApproximation",
    directDelayS: 1,
    paths: [
      {
        id: "shot-direct",
        sourceId: "shot",
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [343, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 343,
        absoluteDelayS: 1,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [1],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_ONLY_NOT_NATIVE_PCM"],
  };
  const input: VoiceInput = {
    instanceId: "shot",
    sourceId: "shot",
    generator: {
      kind: "sample",
      asset: { assetId: "pcm", revision: 1, sha256: "a".repeat(64) },
      loop: false,
      startOffsetSeconds: 0.125,
    },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: false,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  };
  try {
    await engine.enable(0);
    engine.registerBuffer("pcm", context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer, {
      name: "Original retirement authority PCM",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: "a".repeat(64),
    });
    assert.equal(engine.playVoice(input, frame).accepted, true);
    const native = context.sources()[0]!;
    assert.deepEqual(native.stops, [0.875], "legacy initial-rate finite cutoff remains unchanged");
    context.currentTime = 0.1;
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 0.5;
    native.finish();
    engine.flushControlUpdates();
    const initial = engine.getNativeResourceSnapshot().sources[0]!;
    assert.equal(initial.nativeEndedFlushAudioTime, 0.5);
    assert.equal(engine.getTelemetry().retiringVoices, 1);
    assert.deepEqual(ended, ["shot"]);
    // Natural EOF was already observed and retired. The original later stop
    // must not acquire a second retirement authority or restart the tail.
    context.currentTime = 0.875;
    engine.serviceNativeVoices();
    engine.flushControlUpdates();
    assert.equal(
      engine.getTelemetry().nativeSourceNodes,
      1,
      "one second of propagation still drains",
    );
    context.currentTime = 1.519;
    engine.serviceNativeVoices();
    engine.flushControlUpdates();
    const beforeDeadline = {
      nodes: engine.getTelemetry().nativeSourceNodes,
      paths: engine.getTelemetry().activePaths,
      ended: [...ended],
    };
    context.currentTime = 1.52; // First observation 0.5 + original delay 1 + original guard 0.02.
    engine.serviceNativeVoices();
    engine.flushControlUpdates();
    return {
      beforeDeadline,
      atDeadline: {
        nodes: engine.getTelemetry().nativeSourceNodes,
        paths: engine.getTelemetry().activePaths,
        retiring: engine.getTelemetry().retiringVoices,
        ended: [...ended],
      },
    };
  } finally {
    engine.dispose();
  }
}

test("an early natural EOF keeps its first rendered tail deadline when the later legacy cutoff passes in live and offline contexts", async () => {
  const live = await retirementTrace(false);
  const offline = await retirementTrace(true);
  const expected = {
    beforeDeadline: { nodes: 1, paths: 1, ended: ["shot"] },
    atDeadline: { nodes: 0, paths: 0, retiring: 0, ended: ["shot"] },
  };
  assert.deepEqual(offline, expected, "offline first-observation tail is the paired reference");
  assert.deepEqual(
    live,
    expected,
    "live scheduled sweep cannot extend an already-retired natural tail",
  );
  assert.deepEqual(live, offline);
});

async function virtualStopTrace(deliverEnded: boolean, checkpoint: "flush" | "service") {
  const context = new OfflineContext();
  const ended: string[] = [];
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeReference",
    budget: { maxVoices: 1 },
    virtualization: {
      maxNativeVoices: 1,
      maxNativeGraphs: 2,
      maxNativeCarriers: 8,
      maxVirtualVoices: 3,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 30,
    },
    onVoiceEnded: (id) => ended.push(id),
  });
  const frame = (sourceId: string): AcousticFrame => ({
    schemaVersion: "1.0.0",
    requestId: sourceId,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "control-only",
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
    limitations: ["CONTROL_ONLY_NOT_NATIVE_PCM"],
  });
  const common = {
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    priority: 1,
  };
  const sweep = () =>
    checkpoint === "flush" ? engine.flushControlUpdates() : engine.serviceNativeVoices();
  try {
    await engine.enable(0);
    engine.registerBuffer(
      "stop-pcm",
      context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer,
      {
        name: "Original virtual-stop PCM",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: "b".repeat(64),
      },
    );
    engine.playVoice(
      {
        ...common,
        instanceId: "blocker",
        sourceId: "blocker",
        generator: { kind: "oscillator", waveform: "sine", frequencyHz: 200 },
      },
      frame("blocker"),
    );
    const input: VoiceInput = {
      ...common,
      instanceId: "virtual",
      sourceId: "virtual",
      generator: {
        kind: "sample",
        asset: { assetId: "stop-pcm", revision: 1, sha256: "b".repeat(64) },
        loop: true,
        startOffsetSeconds: 0,
      },
    };
    assert.equal(engine.playVoice(input, frame("virtual")).reason, "VIRTUALIZED");
    const carrier = context.sources()[1]!;
    context.currentTime = 0.1;
    engine.stopVoice("virtual", 0.1);
    assert.equal(carrier.stops.at(-1), 0.2);
    assert.deepEqual(ended, ["virtual"]);
    context.currentTime = 0.199;
    sweep();
    assert.equal(
      engine.getTelemetry().nativeSourceNodes,
      2,
      "the requested native fade has not ended",
    );
    assert.deepEqual(engine.evictAssets(["stop-pcm"]).protectedAssetIds, ["stop-pcm"]);
    context.currentTime = 0.2;
    if (deliverEnded) carrier.finish();
    context.currentTime = 0.22; // Native stop plus the existing 20ms cleanup guard.
    sweep();
    const after = {
      nodes: engine.getTelemetry().nativeSourceNodes,
      retiring: engine.getTelemetry().retiringVoices,
      virtual: engine.getTelemetry().virtualVoices,
      ended: [...ended],
      evicted: engine.evictAssets(["stop-pcm"]).evictedAssetIds,
      callbacksCleared: carrier.onended === null,
      disconnected: carrier.connections.length === 0,
    };
    return after;
  } finally {
    engine.dispose();
  }
}

for (const checkpoint of ["flush", "service"] as const)
  test(`offline explicitly-stopped virtual carriers release from the ${checkpoint} checkpoint without native delivery`, async () => {
    const deferred = await virtualStopTrace(false, checkpoint);
    const delivered = await virtualStopTrace(true, checkpoint);
    const expected = {
      nodes: 1,
      retiring: 0,
      virtual: 0,
      ended: ["virtual"],
      evicted: ["stop-pcm"],
      callbacksCleared: true,
      disconnected: true,
    };
    assert.deepEqual(
      deferred,
      expected,
      "a virtual source outside retiring still owns a finite cleanup deadline",
    );
    assert.deepEqual(delivered, expected);
    assert.deepEqual(
      delivered,
      deferred,
      "scheduled cleanup cannot depend on native event delivery",
    );
  });

test("an explicit-stop tail cannot claim complete native EOF timing after an earlier natural observation", async () => {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeReference",
    budget: { maxVoices: 1 },
    virtualization: {
      maxNativeVoices: 1,
      maxNativeGraphs: 2,
      maxVirtualVoices: 2,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 30,
    },
  });
  try {
    await engine.enable(0);
    engine.registerBuffer(
      "stop-pcm",
      context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer,
      {
        name: "Original stopped EOF observation",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: "b".repeat(64),
      },
    );
    const input: VoiceInput = {
      instanceId: "shot",
      sourceId: "shot",
      generator: {
        kind: "sample",
        asset: { assetId: "stop-pcm", revision: 1, sha256: "b".repeat(64) },
        loop: false,
        startOffsetSeconds: 0.125,
      },
      gainLinear: 1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: false,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    };
    const f: AcousticFrame = {
      schemaVersion: "1.0.0",
      requestId: "stopped-eof",
      sceneRevision: 1,
      geometryRevision: 1,
      poseTick: 1,
      backendId: "control-only",
      backendVersion: "1",
      sourceId: "shot",
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
      limitations: ["CONTROL_ONLY_NOT_NATIVE_PCM"],
    };
    engine.playVoice(input, f);
    context.currentTime = 0.1;
    engine.updateVoice("shot", { pitchSemitones: 12, smoothingSeconds: 0 });
    context.currentTime = 0.3;
    engine.stopVoice("shot", 0.3);
    context.currentTime = 0.5;
    context.sources()[0]!.finish();
    const state = engine.getVoiceCursorState("shot", 0.5)!;
    assert.equal(state.provenance, "native");
    assert.equal(
      state.historyIncomplete,
      true,
      "native ended delivery does not expose the actual EOF sample",
    );
    assert.equal(
      engine.getTelemetry().nativeSourceNodes,
      1,
      "the original explicit-stop tail deadline remains authoritative",
    );
    context.currentTime = 0.62;
    engine.serviceNativeVoices();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 0);
  } finally {
    engine.dispose();
  }
});
