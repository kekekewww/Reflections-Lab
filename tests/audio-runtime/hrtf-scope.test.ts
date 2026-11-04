import assert from "node:assert/strict";
import test from "node:test";
import type { AcousticFrame, AcousticPath, VoiceInput } from "../../src/audio/types.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext, type FakePannerNode } from "./fake-context.js";

function path(id: string, order: number, delay: number): AcousticPath {
  return {
    id,
    sourceId: "source",
    listenerId: "listener",
    surfaceIds: order === 0 ? [] : ["wall"],
    order,
    verticesM: [
      [1, 0, 0],
      [0, 0, 0],
    ],
    lengthM: delay * 343,
    absoluteDelayS: delay,
    relativeDelayS: 0,
    arrivalDirection: [1, 0, 0],
    bandGains: [0.5],
  };
}

function frame(paths: AcousticPath[]): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "hrtf-scope",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 0,
    backendId: "fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.01,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_GRAPH_ONLY"],
    paths,
  };
}

const voice = (): VoiceInput => ({
  instanceId: "voice",
  sourceId: "source",
  generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
  gainLinear: 0.1,
  pitchSemitones: 0,
  emissionTimeSeconds: 0,
  continuous: true,
  fadeInSeconds: 0.01,
  fadeOutSeconds: 0.02,
});

const models = (context: FakeAudioContext) =>
  context.panners().map((node: FakePannerNode) => node.panningModel);

test("by default every path keeps HRTF", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame([path("direct", 0, 0.01), path("wall", 1, 0.02)]));
    assert.deepEqual(models(context), ["HRTF", "HRTF"]);
  } finally {
    engine.dispose();
  }
});

test("direct-path scope keeps HRTF on the direct path and pans reflections in stereo", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    bufferPreset: "playback",
    hrtfScope: "directPath",
  });
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame([path("direct", 0, 0.01), path("wall", 1, 0.02)]));
    assert.deepEqual(models(context), ["HRTF", "equalpower"]);
  } finally {
    engine.dispose();
  }
});

test("direct-path scope pans the reverb send in stereo", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    bufferPreset: "playback",
    hrtfScope: "directPath",
  });
  try {
    await engine.enable(0);
    engine.setLateReverb({ enabled: true });
    engine.playVoice(voice(), frame([path("direct", 0, 0.01)]));
    assert.deepEqual(models(context), ["HRTF", "equalpower"], "the direct route, then the send");
  } finally {
    engine.dispose();
  }
});

test("with the direct path blocked, direct-path scope uses stereo rather than moving HRTF to a reflection", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    bufferPreset: "playback",
    hrtfScope: "directPath",
  });
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame([path("wall", 1, 0.02)]));
    assert.deepEqual(models(context), ["equalpower"]);
  } finally {
    engine.dispose();
  }
});
