import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import {
  FakeAudioContext,
  FakeAudioBuffer,
  FakePannerNode,
  pathsToDestination,
} from "./fake-context.js";

function frame(overrides: Partial<AcousticFrame> = {}): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "frame-1",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "fixture",
    backendVersion: "1",
    sourceId: "source-1",
    listenerId: "listener-1",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters", "individualReflectionPaths"],
    modelClass: "numericalApproximation",
    directDelayS: 0.1,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["FIXTURE_ONLY"],
    paths: [
      {
        id: "direct",
        sourceId: "source-1",
        listenerId: "listener-1",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [2, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 2,
        absoluteDelayS: 0.1,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [0.5],
      },
      {
        id: "reflection",
        sourceId: "source-1",
        listenerId: "listener-1",
        surfaceIds: ["wall"],
        order: 1,
        verticesM: [
          [2, 0, 0],
          [0, 0, -2],
          [0, 0, 0],
        ],
        lengthM: 4,
        absoluteDelayS: 0.4,
        relativeDelayS: 0.3,
        arrivalDirection: [0, 0, -1],
        bandGains: [0.25],
      },
    ],
    ...overrides,
  };
}
function voice(instanceId = "voice-1", priority = 5) {
  return {
    instanceId,
    sourceId: "source-1",
    generator: { kind: "oscillator" as const, waveform: "sine" as const, frequencyHz: 440 },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
    priority,
  };
}
async function setup(options: ConstructorParameters<typeof AudioEngine>[0] = {}) {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ ...options, context: context.asContext() });
  await engine.enable(0);
  return { context, engine };
}

test("simulated direct/reflection routes each apply delay and HRTF once with distance rolloff disabled", async () => {
  const { context, engine } = await setup();
  engine.setMuted(false);
  assert.equal(engine.playVoice(voice(), frame()).accepted, true);
  const source = context.sources()[0];
  assert.ok(source);
  const routes = pathsToDestination(source, context.destination).filter((path) =>
    path.some((node) => node.kind === "panner"),
  );
  assert.equal(routes.length, 2);
  for (const route of routes) {
    assert.equal(route.filter((node) => node.kind === "delay").length, 1);
    assert.equal(route.filter((node) => node.kind === "panner").length, 1);
  }
  assert.deepEqual(
    context
      .delays()
      .map((n) => n.delayTime.value)
      .sort(),
    [0.1, 0.4],
  );
  const panners = context.panners();
  assert.equal(panners.length, 2);
  for (const panner of panners) {
    assert.equal(panner.panningModel, "HRTF");
    assert.equal(panner.rolloffFactor, 0);
  }
  assert.deepEqual(
    panners.map((p) => [p.positionX.value, p.positionY.value, p.positionZ.value]),
    [
      [1, 0, 0],
      [0, 0, -1],
    ],
  );
  engine.dispose();
});

test("continuous parameter and path updates keep the running generator node", async () => {
  const { context, engine } = await setup();
  engine.playVoice(voice(), frame());
  const source = context.sources()[0];
  assert.ok(source);
  assert.equal(source.starts.length, 1);
  engine.updateVoice("voice-1", { gainLinear: 0.3, pitchSemitones: 12 });
  engine.updateFrame(
    frame({
      poseTick: 2,
      paths: frame().paths.map((p) => ({ ...p, absoluteDelayS: p.absoluteDelayS + 0.01 })),
    }),
  );
  assert.equal(context.sources().length, 1);
  assert.equal(source.starts.length, 1);
  assert.equal(source.stops.length, 0);
  assert.equal(engine.getTelemetry().activeVoices, 1);
  engine.dispose();
});

test("independent sample one-shots use fresh BufferSource nodes and the same registered decoded buffer", async () => {
  const { context, engine } = await setup();
  const buffer = context.createBuffer(1, 4800, 48000);
  engine.registerBuffer("asset-impact", buffer as unknown as AudioBuffer, {
    name: "fixture impulse",
    origin: "generated",
    license: "PROJECT_GENERATED",
    sha256: "a".repeat(64),
  });
  const generator = {
    kind: "sample" as const,
    asset: { assetId: "asset-impact", revision: 1, sha256: "a".repeat(64) },
    loop: false,
    startOffsetSeconds: 0,
  };
  assert.equal(
    engine.playVoice(
      { ...voice("shot-a"), generator, continuous: false, durationSeconds: 0.1 },
      frame(),
    ).accepted,
    true,
  );
  assert.equal(
    engine.playVoice(
      { ...voice("shot-b"), generator, continuous: false, durationSeconds: 0.1 },
      frame(),
    ).accepted,
    true,
  );
  const sources = context.sources().filter((n) => n.kind === "buffer-source");
  assert.equal(sources.length, 2);
  assert.notEqual(sources[0], sources[1]);
  assert.equal(sources[0]?.buffer, buffer);
  assert.equal(sources[1]?.buffer, buffer);
  assert.equal(sources[0]?.starts.length, 1);
  assert.equal(sources[1]?.starts.length, 1);
  engine.dispose();
});

test("voice admission rejects lower priority then steals only the lowest priority voice", async () => {
  const { engine } = await setup({ budget: { maxVoices: 2 } });
  assert.equal(engine.playVoice(voice("voice-low", 1), frame()).accepted, true);
  assert.equal(engine.playVoice(voice("voice-mid", 5), frame()).accepted, true);
  assert.equal(engine.playVoice(voice("voice-rejected", 0), frame()).accepted, false);
  const result = engine.playVoice(voice("voice-high", 10), frame());
  assert.equal(result.accepted, true);
  assert.equal(result.stolenInstanceId, "voice-low");
  const telemetry = engine.getTelemetry();
  assert.equal(telemetry.activeVoices, 2);
  assert.equal(telemetry.droppedVoices, 1);
  assert.equal(telemetry.stolenVoices, 1);
  engine.dispose();
});

test("stale and regressing acoustic frames cannot change an active route", async () => {
  const { context, engine } = await setup();
  engine.playVoice(voice(), frame({ poseTick: 10 }));
  const before = context.delays().map((d) => d.delayTime.value);
  engine.updateFrame(
    frame({
      poseTick: 11,
      stale: true,
      paths: frame().paths.map((p) => ({ ...p, absoluteDelayS: 2 })),
    }),
  );
  engine.updateFrame(
    frame({ poseTick: 9, paths: frame().paths.map((p) => ({ ...p, absoluteDelayS: 3 })) }),
  );
  assert.deepEqual(
    context.delays().map((d) => d.delayTime.value),
    before,
  );
  assert.equal(engine.getTelemetry().staleFrames, 2);
  engine.dispose();
});

test("audio epoch schedules emission time once; propagation remains solely in the path DelayNode", async () => {
  const { context, engine } = await setup();
  context.currentTime = 10;
  engine.setEpoch(3, 10);
  engine.playVoice({ ...voice(), emissionTimeSeconds: 3.5 }, frame());
  const source = context.sources()[0];
  assert.ok(source);
  assert.equal(source.starts[0]?.when, 10.5);
  assert.deepEqual(
    context
      .delays()
      .map((d) => d.delayTime.value)
      .sort(),
    [0.1, 0.4],
  );
  engine.dispose();
});

test("late emission is counted and scheduled at current audio time rather than in the past", async () => {
  const { context, engine } = await setup();
  context.currentTime = 5;
  engine.setEpoch(0, 0);
  engine.playVoice({ ...voice(), emissionTimeSeconds: 1 }, frame());
  assert.equal(context.sources()[0]?.starts[0]?.when, 5);
  assert.equal(engine.getTelemetry().lateEvents, 1);
  engine.dispose();
});

test("path budget is enforced independently of voice count", async () => {
  const { context, engine } = await setup({ budget: { maxPathsPerVoice: 1, maxTotalPaths: 1 } });
  engine.playVoice(voice(), frame());
  assert.equal(context.panners().length, 1);
  assert.equal(engine.getTelemetry().activePaths, 1);
  engine.dispose();
});

test("decoded asset memory cap is enforced before admitting a new buffer", async () => {
  const { engine } = await setup({ budget: { maxDecodedBytes: 4096 } });
  const buffer = new FakeAudioBuffer(1, 2048, 48000);
  assert.throws(() =>
    engine.registerBuffer("asset-large", buffer as unknown as AudioBuffer, {
      name: "large fixture",
      origin: "generated",
      license: "PROJECT_GENERATED",
    }),
  );
  assert.equal(engine.getTelemetry().decodedBytes, 0);
  engine.dispose();
});

test("invalid nonfinite controls fail explicitly rather than reaching AudioParam", async () => {
  const { engine } = await setup();
  assert.throws(() => engine.setMonitorGain(NaN));
  assert.throws(() => engine.playVoice({ ...voice(), gainLinear: Infinity }, frame()));
  assert.equal(engine.getTelemetry().activeVoices, 0);
  engine.dispose();
});

test("muted/raw/simulated monitoring is explicit and does not recreate generators", async () => {
  const { context, engine } = await setup();
  engine.playVoice(voice(), frame());
  engine.setMonitorMode("raw");
  assert.equal(engine.getTelemetry().monitorMode, "raw");
  engine.setMonitorMode("simulated");
  engine.setMuted(true);
  assert.equal(engine.getTelemetry().muted, true);
  assert.equal(context.sources().length, 1);
  const panners = context.nodes.filter((n): n is FakePannerNode => n instanceof FakePannerNode);
  assert.equal(panners.length, 2);
  engine.dispose();
});

test("dispose releases voices and graph connections", async () => {
  const { context, engine } = await setup();
  engine.playVoice(voice(), frame());
  engine.dispose();
  assert.equal(engine.getTelemetry().activeVoices, 0);
  assert.equal(engine.getTelemetry().activePaths, 0);
  assert.ok(context.sources().every((s) => s.stops.length === 1));
});
