import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import { FakeAudioContext, FakeGainNode } from "./fake-context.js";

function fixtureFrame(overrides: Partial<AcousticFrame> = {}): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "review-frame",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "fixture",
    backendVersion: "1",
    sourceId: "review-source",
    listenerId: "review-listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.1,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_GRAPH_FIXTURE_ONLY"],
    paths: [
      {
        id: "review-direct",
        sourceId: "review-source",
        listenerId: "review-listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 1,
        absoluteDelayS: 0.1,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [0.5],
      },
    ],
    ...overrides,
  };
}

function fixtureVoice(instanceId = "review-voice") {
  return {
    instanceId,
    sourceId: "review-source",
    generator: { kind: "oscillator" as const, waveform: "sine" as const, frequencyHz: 440 },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
    priority: 1,
  };
}

test("retiring instance cleanup cannot remove a new generation with the same instance ID", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    assert.equal(engine.playVoice(fixtureVoice(), fixtureFrame()).accepted, true);
    engine.stopVoice("review-voice", 0.001);
    assert.equal(engine.playVoice(fixtureVoice(), fixtureFrame()).accepted, true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.equal(context.sources()[1]?.stops.length, 0);
  } finally {
    engine.dispose();
  }
});

test("lazy context creation preserves monitor and mute controls selected before enable", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const context = new FakeAudioContext();
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: function () {
      return context;
    },
  });
  const engine = new AudioEngine();
  try {
    engine.setMuted(false);
    engine.setMonitorMode("raw");
    await engine.enable(0);
    const gains = context.nodes.filter(
      (node): node is FakeGainNode => node instanceof FakeGainNode,
    );
    assert.equal(gains[0]?.gain.value, 1, "raw bus must match selected raw mode");
    assert.equal(gains[1]?.gain.value, 0, "simulated bus must be muted in raw mode");
    assert.equal(gains[5]?.gain.value, 1, "master mute must match selected unmuted state");
  } finally {
    engine.dispose();
    if (previous) Object.defineProperty(globalThis, "AudioContext", previous);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("invalid frequency-band frames fail atomically before replacing active route data", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.playVoice(fixtureVoice(), fixtureFrame());
    const before = context.delays()[0]?.delayTime.value;
    const bad = fixtureFrame({
      poseTick: 2,
      bandCentersHz: [1000, 500],
      paths: fixtureFrame().paths.map((p) => ({
        ...p,
        absoluteDelayS: 0.8,
        bandGains: [0.5, 0.2],
      })),
    });
    assert.throws(() => engine.updateFrame(bad));
    assert.equal(context.delays()[0]?.delayTime.value, before);
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    engine.dispose();
  }
});

test("replacing an in-use decoded asset cannot bypass the decoded memory budget", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: { maxDecodedBytes: 4096 },
  });
  await engine.enable(0);
  try {
    const metadata = {
      name: "review PCM",
      origin: "generated" as const,
      license: "FIXTURE_ONLY",
      sha256: "a".repeat(64),
    };
    const first = context.createBuffer(1, 1024, 48000);
    engine.registerBuffer("review-asset", first as unknown as AudioBuffer, metadata);
    const generator = {
      kind: "sample" as const,
      asset: { assetId: "review-asset", revision: 1, sha256: "a".repeat(64) },
      loop: true,
      startOffsetSeconds: 0,
    };
    assert.equal(engine.playVoice({ ...fixtureVoice(), generator }, fixtureFrame()).accepted, true);
    const replacement = context.createBuffer(1, 1024, 48000);
    assert.throws(() =>
      engine.registerBuffer("review-asset", replacement as unknown as AudioBuffer, {
        ...metadata,
        sha256: "b".repeat(64),
        revision: 2,
      }),
    );
    assert.equal(engine.getTelemetry().decodedBytes, 4096);
  } finally {
    engine.dispose();
  }
});

test("invalid compound voice update cannot partially change gain before rejecting its filter", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.playVoice(fixtureVoice(), fixtureFrame());
    const gains = context.nodes.filter(
      (node): node is FakeGainNode => node instanceof FakeGainNode,
    );
    const contentGain = gains[6];
    assert.ok(contentGain);
    const before = contentGain.gain.value;
    assert.throws(() =>
      engine.updateVoice("review-voice", { gainLinear: 0.2, filterCutoffHz: 500 }),
    );
    assert.equal(contentGain.gain.value, before);
  } finally {
    engine.dispose();
  }
});

test("a one-shot sample loop requires an explicit finite duration", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.registerBuffer(
      "review-loop",
      context.createBuffer(1, 1024, 48000) as unknown as AudioBuffer,
      {
        name: "loop fixture",
        origin: "generated",
        license: "FIXTURE_ONLY",
        sha256: "a".repeat(64),
      },
    );
    const generator = {
      kind: "sample" as const,
      asset: { assetId: "review-loop", revision: 1, sha256: "a".repeat(64) },
      loop: true,
      startOffsetSeconds: 0,
    };
    assert.throws(
      () => engine.playVoice({ ...fixtureVoice(), generator, continuous: false }, fixtureFrame()),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "ONE_SHOT_DURATION_REQUIRED",
    );
    assert.equal(engine.getTelemetry().activeVoices, 0);
  } finally {
    engine.dispose();
  }
});

test("zero authored attack does not silently discard a first-sample impulse", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.playVoice({ ...fixtureVoice(), fadeInSeconds: 0 }, fixtureFrame());
    const gains = context.nodes.filter(
      (node): node is FakeGainNode => node instanceof FakeGainNode,
    );
    const envelope = gains[7];
    assert.ok(envelope);
    assert.equal(
      envelope.gain.automation.some(
        (a) => a.method === "setValueAtTime" && a.time === 0 && a.value === 1,
      ),
      true,
    );
  } finally {
    engine.dispose();
  }
});

test("drain while paused clears voices and route caches while preserving decoded assets", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.registerBuffer(
      "review-preserved",
      context.createBuffer(1, 1024, 48000) as unknown as AudioBuffer,
      {
        name: "preserved fixture",
        origin: "generated",
        license: "FIXTURE_ONLY",
        sha256: "a".repeat(64),
      },
    );
    engine.playVoice(fixtureVoice(), fixtureFrame());
    await engine.pause(0);
    await engine.drainVoices();
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(engine.getTelemetry().assetCount, 1);
    assert.equal(engine.getTelemetry().decodedBytes, 4096);
    await engine.resume(0);
    assert.equal(engine.playVoice(fixtureVoice("after-drain"), fixtureFrame()).accepted, true);
  } finally {
    engine.dispose();
  }
});

test("pause preserves future logical emissions and resume schedules them once in the new epoch", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.setEpoch(0, 0);
    context.currentTime = 0.5;
    engine.playVoice({ ...fixtureVoice(), emissionTimeSeconds: 1 }, fixtureFrame());
    assert.equal(context.sources()[0]?.starts[0]?.when, 1);
    const pause = engine.pause(0.5);
    context.currentTime = 0.52;
    await pause;
    await engine.resume(0.5);
    assert.equal(context.sources().length, 2);
    assert.equal(context.sources()[1]?.starts[0]?.when, 1.02);
    assert.equal(engine.getTelemetry().activeVoices, 1);
    await engine.resume(0.5);
    assert.equal(
      context.sources().length,
      2,
      "repeated resume must not duplicate a future emission",
    );
  } finally {
    engine.dispose();
  }
});
