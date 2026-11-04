import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const frame = (): AcousticFrame => ({
  schemaVersion: "1.0.0",
  requestId: "review2",
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
  directDelayS: 0.1,
  pathAvailability: "available",
  impulseResponseArtifactId: null,
  stale: false,
  limitations: ["CONTROL_GRAPH_ONLY"],
  paths: [
    {
      id: "direct",
      sourceId: "source",
      listenerId: "listener",
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
});
const voice = (): VoiceInput => ({
  instanceId: "voice",
  sourceId: "source",
  generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
  gainLinear: 0.1,
  pitchSemitones: 0,
  emissionTimeSeconds: 0,
  continuous: true,
  fadeInSeconds: 0,
  fadeOutSeconds: 0,
});

for (const boundary of ["fade", "native resume"])
  test(`review2 1: Pause cancels resume while awaiting ${boundary}`, async () => {
    const context = new FakeAudioContext();
    const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
    let release!: () => void;
    try {
      await engine.enable(0);
      engine.playVoice(voice(), frame());
      context.currentTime = 0.5;
      const pausing = engine.pause(0.38);
      if (boundary === "native resume") {
        await pausing;
        context.resume = () =>
          new Promise<void>((resolve) => {
            release = resolve;
          });
      }
      const resuming = engine.resume(0.38);
      if (boundary === "native resume") await turn();
      await engine.pause(0.38);
      release?.();
      await resuming;
      await pausing;
      assert.equal(engine.getTelemetry().paused, true);
      assert.equal(engine.getTelemetry().activeVoices, 0);
      assert.equal(context.sources().length, 1, "cancelled resume never restarts a loop");
    } finally {
      release?.();
      engine.dispose();
    }
  });

test("review2 2: re-pause inside lookahead preserves finite cursor, duration and propagation tails", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.registerBuffer("pcm", context.createBuffer(1, 96000, 48000) as unknown as AudioBuffer, {
      name: "Original test PCM",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: "c".repeat(64),
    });
    const input: VoiceInput = {
      ...voice(),
      continuous: false,
      durationSeconds: 1,
      generator: {
        kind: "sample",
        asset: { assetId: "pcm", revision: 1, sha256: "c".repeat(64) },
        loop: false,
        startOffsetSeconds: 0,
      },
    };
    engine.playVoice(input, frame());
    context.currentTime = 0.52;
    await engine.pause(0.4);
    const cursor = engine.getVoiceCursor("voice", 0.4)!;
    await engine.resume(0.4);
    const arrivals = [...(engine as any).retiring].filter((v: any) => v.internalArrival).length;
    assert.ok(arrivals > 0);
    context.currentTime += 0.01;
    await engine.pause(0.4);
    assert.deepEqual(engine.getVoiceCursor("voice", 0.4), cursor);
    await engine.resume(0.4);
    const native = (engine as any).voices.get("voice");
    assert.equal(native.source.starts[0].offset, cursor.playheadSeconds);
    assert.equal(native.durationSeconds, cursor.remainingDurationSeconds);
    assert.equal(
      [...(engine as any).retiring].filter((v: any) => v.internalArrival).length,
      arrivals,
    );
  } finally {
    engine.dispose();
  }
});

test("review2 3: pre-onset pitch updates cannot advance a recorded or frozen cursor", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame());
    context.currentTime = 0.01;
    engine.updateVoice("voice", { pitchSemitones: 12 });
    context.currentTime = 0.02;
    engine.updateVoice("voice", { pitchSemitones: -12 });
    assert.equal(engine.getVoiceCursor("voice", 0)!.playheadSeconds, 0);
    await engine.pause(0);
    assert.equal(engine.getVoiceCursor("voice", 0)!.playheadSeconds, 0);
  } finally {
    engine.dispose();
  }
});

for (const stuck of ["close", "resume"] as const)
  test(`review2 5: a never-settling device ${stuck} fails within a bounded restart`, async (t) => {
    const original = globalThis.AudioContext;
    const contexts: FakeAudioContext[] = [];
    globalThis.AudioContext = class extends FakeAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    } as unknown as typeof AudioContext;
    const engine = new AudioEngine();
    try {
      await engine.enable(0);
      if (stuck === "close") contexts[0]!.close = () => new Promise<void>(() => {});
      else {
        globalThis.AudioContext = class extends FakeAudioContext {
          resume = () => new Promise<void>(() => {});
        } as unknown as typeof AudioContext;
      }
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const changing = engine.setBufferPreset("balanced", 0);
      const rejected = assert.rejects(changing, /AUDIO_BUFFER_RESTART_FAILED/);
      for (let i = 0; i < 12; i++) {
        await turn();
        t.mock.timers.tick(2000);
      }
      assert.equal((engine as any).rebuilding, false, "timeout releases the restart lock");
      await rejected;
      assert.equal(engine.getTelemetry().enabled, false);
      assert.equal(engine.getTelemetry().paused, true);
      assert.equal(engine.getTelemetry().lastError, "AUDIO_BUFFER_RESTART_FAILED");
    } finally {
      engine.dispose();
      globalThis.AudioContext = original;
      t.mock.timers.reset();
    }
  });

test("review2 7: restored main and arrival voices share the epoch lookahead with new events", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    context.currentTime = 2;
    await engine.enable(1);
    const result = engine.restoreVoiceAtCursor(voice(), frame(), {
      playheadSeconds: 0.4,
      elapsedSinceEmissionSeconds: 0.4,
      remainingDurationSeconds: null,
    });
    assert.equal(result.accepted, true);
    assert.ok(context.sources().length > 1, "includes pending propagation arrivals");
    for (const source of context.sources()) assert.equal(source.starts[0]!.when, 2.12);
    assert.equal(engine.getTelemetry().lateEvents, 0);
  } finally {
    engine.dispose();
  }
});

test("review2 8: listener synchronization never creates or reopens an audio device", () => {
  const original = globalThis.AudioContext;
  let created = 0;
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      created++;
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  try {
    engine.updateListener({ positionM: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] });
    assert.equal(created, 0);
    assert.equal(engine.getTelemetry().enabled, false);
  } finally {
    engine.dispose();
    globalThis.AudioContext = original;
  }
});

test("review2 10: rebuild preserves a newer frame delivered while closing the old context", async () => {
  const original = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  let release!: () => void;
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame());
    contexts[0]!.close = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const changing = engine.setBufferPreset("balanced", 0);
    for (let i = 0; i < 100 && !release; i++)
      await new Promise((resolve) => setTimeout(resolve, 1));
    assert.ok(release);
    engine.updateFrame({ ...frame(), poseTick: 5 });
    release();
    await changing;
    assert.equal((engine as any).frames.get("source").poseTick, 5);
  } finally {
    release?.();
    engine.dispose();
    globalThis.AudioContext = original;
  }
});
