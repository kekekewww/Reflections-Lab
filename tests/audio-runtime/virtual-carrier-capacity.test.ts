import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine, DEFAULT_NATIVE_VOICE_POLICY } from "../../src/audio/engine.js";
import { DEFAULT_AUDIO_BUDGET } from "../../src/audio/control.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";

function frame(sourceId: string, count = 0): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: sourceId,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "capacity-control-only",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: [],
    modelClass: "numericalApproximation",
    directDelayS: 0.5,
    paths: Array.from({ length: count }, (_, n) => ({
      id: `${sourceId}-path-${n}`,
      sourceId,
      listenerId: "listener",
      surfaceIds: [],
      order: 0,
      verticesM: [
        [1, 0, 0],
        [0, 0, 0],
      ],
      lengthM: 171.5,
      absoluteDelayS: 0.5,
      relativeDelayS: 0,
      arrivalDirection: [1, 0, 0],
      bandGains: [1],
    })),
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_CAPACITY_NOT_NATIVE_PCM_OR_COST"],
  };
}
const voice = (instanceId: string): VoiceInput => ({
  instanceId,
  sourceId: instanceId,
  generator: { kind: "oscillator", waveform: "sine", frequencyHz: 200 },
  gainLinear: 1,
  pitchSemitones: 0,
  emissionTimeSeconds: 0,
  continuous: false,
  durationSeconds: 0.1,
  fadeInSeconds: 0,
  fadeOutSeconds: 0,
});

test("formal default and stress preserve every original AudioBudget and derive all source and graph pools", () => {
  for (const [budget, arrivals, sources] of [
    [{}, 96, 176],
    [{ maxPathsPerVoice: 32, maxTotalPaths: 256 }, 256, 336],
  ] as const) {
    const engine = new AudioEngine({
      budget,
      virtualization: DEFAULT_NATIVE_VOICE_POLICY,
      oscillatorModel: "nativeReference",
    });
    try {
      const t = engine.getTelemetry();
      assert.deepEqual(t.budget, { ...DEFAULT_AUDIO_BUDGET, ...budget });
      assert.equal(t.activeRenderedCap, 24);
      assert.equal(t.nativeGraphBudget, 48);
      assert.equal(t.internalArrivalGraphBudget, arrivals);
      assert.equal(t.nativeGraphTotalBudget, 48 + arrivals);
      assert.equal(t.nativeCarrierBudget, sources);
      assert.equal(t.nativeSourceNodes, 0);
    } finally {
      engine.dispose();
    }
  }
});

test("reference reports legacy finite source and arrival bounds without imposing candidate parent slots", () => {
  const engine = new AudioEngine({ virtualization: false, oscillatorModel: "nativeReference" });
  try {
    const t = engine.getTelemetry();
    assert.equal(t.nativeGraphBudget, null);
    assert.equal(t.nativeGraphTotalBudget, 144);
    assert.equal(t.internalArrivalGraphBudget, 96);
    assert.equal(t.nativeCarrierBudget, 144);
    assert.equal(t.virtualization.enabled, false);
  } finally {
    engine.dispose();
  }
});

test("carrier parent slots do not reject the original legal internal-arrival restore capacity", async () => {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeReference",
    budget: { maxVoices: 1, maxPathsPerVoice: 6, maxTotalPaths: 6, maxPendingEvents: 6 },
    virtualization: {
      maxNativeVoices: 1,
      maxNativeGraphs: 2,
      maxVirtualVoices: 2,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    },
  });
  try {
    await engine.enable(0);
    const result = engine.restoreVoiceAtCursor(voice("arrivals"), frame("arrivals", 6), {
      playheadSeconds: 0.1,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: 0,
      emissionEndElapsedSeconds: 0.1,
    });
    assert.equal(result.accepted, true);
    assert.equal(context.sources().length, 6, "all six original legal pending sources must exist");
    const t = engine.getTelemetry();
    assert.equal(t.nativeCarrierBudget, 10);
    assert.equal(t.parentNativeGraphsInUse, 0);
    assert.equal(t.internalArrivalGraphsInUse, 6);
    assert.equal(t.nativeSlotsInUse, 6);
    assert.equal(t.nativeGraphTotalBudget, 8);
    assert.equal(t.nativeSourceNodes, 6);
    assert.equal(t.activePaths, 6);
    assert.equal(
      engine.playVoice({ ...voice("parent"), continuous: true }, frame("parent")).accepted,
      true,
    );
    assert.equal(engine.getTelemetry().parentNativeGraphsInUse, 1);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 7);
  } finally {
    engine.dispose();
  }
});

test("the original maximum legal budget retains pending capacity beside the new virtual pool", () => {
  const engine = new AudioEngine({
    budget: { maxVoices: 64, maxPendingEvents: 2048, maxTotalPaths: 256 },
    oscillatorModel: "nativeReference",
    virtualization: {
      maxNativeVoices: 64,
      maxNativeGraphs: 128,
      maxVirtualVoices: 2048,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    },
  });
  try {
    assert.equal(engine.getTelemetry().nativeGraphTotalBudget, 384);
    assert.equal(engine.getTelemetry().nativeCarrierBudget, 2432);
  } finally {
    engine.dispose();
  }
});
