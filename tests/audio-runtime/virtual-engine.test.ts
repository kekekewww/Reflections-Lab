import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";

function frame(id: string, delay = 0): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: id,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "virtual-control-oracle",
    backendVersion: "1",
    sourceId: id,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delay,
    paths: [
      {
        id: `${id}-direct`,
        sourceId: id,
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: delay * 343,
        absoluteDelayS: delay,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [1],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_ONLY_NOT_NATIVE_DSP"],
  };
}
const voice = (id: string, overrides: Partial<VoiceInput> = {}): VoiceInput => ({
  instanceId: id,
  sourceId: id,
  generator: {
    kind: "sample",
    asset: { assetId: "loop", revision: 1, sha256: "a".repeat(64) },
    loop: true,
    startOffsetSeconds: 0.125,
  },
  gainLinear: 1,
  pitchSemitones: 0,
  emissionTimeSeconds: 0,
  continuous: true,
  fadeInSeconds: 0,
  fadeOutSeconds: 0,
  priority: 1,
  ...overrides,
});
async function setup() {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const ended: string[] = [];
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: { maxVoices: 1 },
    oscillatorModel: "seekableNativeClock",
    virtualization: {
      maxNativeVoices: 1,
      maxVirtualVoices: 3,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    },
    onVoiceEnded: (id) => ended.push(id),
  });
  await engine.enable(0);
  engine.registerBuffer("loop", context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer, {
    name: "Original virtual phase test",
    origin: "generated",
    license: "PROJECT_GENERATED_TEST_FIXTURE",
    sha256: "a".repeat(64),
  });
  return { engine, context, ended };
}
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("native capacity accepts a virtual logical voice, retains its sample asset and never restarts duplicate IDs", async () => {
  const { engine, context, ended } = await setup();
  try {
    assert.equal(engine.playVoice(voice("native"), frame("native")).accepted, true);
    assert.deepEqual(engine.playVoice(voice("virtual"), frame("virtual")), {
      accepted: true,
      reason: "VIRTUALIZED",
    });
    assert.equal(engine.playVoice(voice("virtual"), frame("virtual")).reason, "ALREADY_PLAYING");
    assert.equal(context.sources().length, 1);
    assert.equal(engine.getVoiceCursorState("virtual", 0)?.provenance, "virtual");
    assert.equal(engine.getTelemetry().virtualVoices, 1);
    assert.throws(() => engine.replaceAssets([]), /Drain/);
    assert.deepEqual(ended, []);
  } finally {
    engine.dispose();
  }
});

test("promotion uses integrated rate cursor plus authored offset once and keeps propagation delay once", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native"));
    engine.playVoice(voice("virtual"), frame("virtual", 0.25));
    context.currentTime = 0.5;
    engine.updateVoice("virtual", { pitchSemitones: 12, smoothingSeconds: 0.5 });
    context.currentTime = 1;
    // .5 + (.5*(1+2)/2) = 1.25 source seconds.
    close(engine.getVoiceCursor("virtual", 1)!.playheadSeconds, 1.25);
    engine.stopVoice("native", 0);
    context.currentTime = 1.03;
    engine.serviceNativeVoices();
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 1);
    const resumed = context.sources().at(-1)!;
    // Independent arithmetic-series oracle for the k-rate quantum values.
    // The first partial quantum retains rate 1; q188..q374 hold the left samples.
    const q = 128 / 48000;
    const first = Math.ceil(0.5 / q),
      last = Math.ceil(1 / q) - 1;
    const count = last - first + 1;
    const sum = count + 2 * ((q * (first + last) * count) / 2 - 0.5 * count);
    const renderPosition = 0.5 + first * q - 0.5 + q * sum + 0.03 * 2;
    close(resumed.starts[0]!.offset!, (0.125 + renderPosition) % 1);
    close(engine.getVoiceCursor("virtual", 1.03)!.playheadSeconds, 1.31);
    assert.equal(context.delays().at(-1)!.delayTime.value, 0.25);
    assert.equal(engine.getVoiceCursorState("virtual", 1.03)?.historyIncomplete, true);
    assert.equal(engine.getVoiceCursorState("virtual", 1.03)?.provenance, "native");
  } finally {
    engine.dispose();
  }
});

test("one-shots that expire while virtual do not replay or emit multiple ended callbacks", async () => {
  const { engine, context, ended } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native"));
    engine.playVoice(
      voice("shot", { continuous: false, durationSeconds: 0.1 }),
      frame("shot", 0.2),
    );
    context.currentTime = 0.5;
    engine.serviceNativeVoices();
    engine.serviceNativeVoices();
    assert.equal(engine.getVoiceCursorState("shot", 0.5), null);
    assert.equal(context.sources().length, 1);
    assert.deepEqual(ended, ["shot"]);
    assert.equal(engine.getTelemetry().virtualVoices, 0);
  } finally {
    engine.dispose();
  }
});

test("native plus retiring arrivals share the native slot cap; virtual flood is bounded", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native", 0.5));
    for (const id of ["v1", "v2", "v3"])
      assert.equal(engine.playVoice(voice(id), frame(id)).accepted, true);
    assert.equal(
      engine.playVoice(voice("overflow"), frame("overflow")).reason,
      "VIRTUAL_VOICE_BUDGET",
    );
    engine.stopVoice("native", 0);
    context.currentTime = 0.3;
    engine.serviceNativeVoices();
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 1);
    assert.equal(context.sources().length, 1, "native tail holds the slot");
    context.currentTime = 0.6;
    engine.serviceNativeVoices();
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 1);
    assert.equal(context.sources().length, 2, "one source promoted only after tail drain");
  } finally {
    engine.dispose();
  }
});

test("pause/resume freezes virtual phase; drain and dispose release every virtual source", async () => {
  const { engine, context, ended } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native"));
    engine.playVoice(voice("virtual"), frame("virtual"));
    context.currentTime = 0.4;
    await engine.pause(0.4);
    close(engine.getVoiceCursor("virtual", 20)!.playheadSeconds, 0.4);
    context.currentTime = 20;
    await engine.resume(0.4);
    context.currentTime = 20.2;
    close(engine.getVoiceCursor("virtual", 0.6)!.playheadSeconds, 0.6);
    await engine.drainVoices();
    assert.equal(engine.getTelemetry().virtualVoices, 0);
    assert.equal(engine.getVoiceCursorState("virtual", 0.6), null);
    assert.deepEqual(ended.sort(), ["native", "virtual"]);
  } finally {
    engine.dispose();
  }
});

test("a promoted cursor never regains complete native history through pause/resume or retiring tail", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native"));
    engine.playVoice(voice("promoted"), frame("promoted", 0.2));
    engine.stopVoice("native", 0);
    context.currentTime = 0.03;
    engine.serviceNativeVoices();
    assert.equal(engine.getVoiceCursorState("promoted", 0.03)?.historyIncomplete, true);
    context.currentTime = 0.2;
    await engine.pause(0.2);
    assert.equal(engine.getVoiceCursorState("promoted", 0.2)?.historyIncomplete, true);
    context.currentTime = 10;
    await engine.resume(0.2);
    assert.equal(engine.getVoiceCursorState("promoted", 0.2)?.historyIncomplete, true);
    context.currentTime = 10.1;
    engine.stopVoice("promoted", 0);
    assert.equal(engine.getVoiceCursorState("promoted", 0.3)?.historyIncomplete, true);
  } finally {
    engine.dispose();
  }
});

test("a saturated virtual queue rotates equal-priority sources fairly after tail drain without exceeding native slots", async () => {
  const { engine, context, ended } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native"));
    for (const id of ["v1", "v2", "v3"]) engine.playVoice(voice(id), frame(id));
    context.currentTime = 1.2;
    engine.serviceNativeVoices();
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 1);
    assert.equal(engine.getTelemetry().demotingVoices, 1);
    context.currentTime = 1.3;
    engine.serviceNativeVoices();
    assert.equal(engine.getVoiceCursorState("v1", 1.3)?.provenance, "native");
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 1);
    assert.equal(engine.getTelemetry().virtualVoices, 3);
    context.currentTime = 1.31;
    engine.serviceNativeVoices();
    assert.equal(
      engine.getTelemetry().virtualization.demotions,
      1,
      "minimum residence prevents thrash",
    );
    close(engine.getVoiceCursor("native", 1.31)!.playheadSeconds, 1.31);
    assert.deepEqual(ended, [], "virtual demotion is not a logical end/rejection");
  } finally {
    engine.dispose();
  }
});

test("a future native onset may be virtualized without a null cursor or premature emission", async () => {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: { maxVoices: 1 },
    oscillatorModel: "seekableNativeClock",
    virtualization: {
      maxNativeVoices: 1,
      maxVirtualVoices: 2,
      minResidenceSeconds: 0,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    },
  });
  try {
    await engine.enable(0);
    const oscillator = { kind: "oscillator" as const, waveform: "sine" as const, frequencyHz: 100 };
    engine.playVoice(
      voice("future", { generator: oscillator, emissionTimeSeconds: 2 }),
      frame("future"),
    );
    engine.playVoice(voice("urgent", { generator: oscillator, priority: 2 }), frame("urgent"));
    engine.serviceNativeVoices();
    assert.equal(engine.getVoiceCursor("future", 0)!.playheadSeconds, 0);
    assert.equal(engine.getVoiceCursorState("urgent", 0)?.provenance, "native");
    engine.stopVoice("urgent", 0);
    context.currentTime = 0.1;
    engine.serviceNativeVoices();
    assert.equal(
      context.sources().at(-1)!.starts[0]!.when,
      2,
      "promotion cannot pull a future emission earlier",
    );
    assert.equal(
      engine.getVoiceCursor("future", 1),
      null,
      "native cursor does not claim an onset before it starts",
    );
  } finally {
    engine.dispose();
  }
});

test("natural non-loop sample lifetime follows pitch integration equally in native and virtual modes", async () => {
  const { engine, context } = await setup();
  try {
    const sample = voice("sample");
    if (sample.generator.kind !== "sample") throw new Error("sample required");
    sample.generator.loop = false;
    engine.playVoice(sample, frame("sample"));
    const virtual = { ...sample, instanceId: "virtual-sample", sourceId: "virtual-sample" };
    engine.playVoice(virtual, frame("virtual-sample"));
    context.currentTime = 0.2;
    for (const id of ["sample", "virtual-sample"])
      engine.updateVoice(id, { pitchSemitones: -12, smoothingSeconds: 0 });
    const a = engine.getVoiceCursor("sample", 0.2)!;
    const b = engine.getVoiceCursor("virtual-sample", 0.2)!;
    close(a.playheadSeconds, b.playheadSeconds);
    close(a.remainingDurationSeconds!, 1.35); // (.875 source seconds - .2 consumed) / .5
    close(b.remainingDurationSeconds!, 1.35);
    assert.equal(
      context.sources()[0]!.stops.length,
      0,
      "natural sample exhaustion is not an initial-rate hard stop",
    );
  } finally {
    engine.dispose();
  }
});

test("natural sample exhaustion remains pitch-dependent after virtual promotion", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("blocker"), frame("blocker"));
    const input = voice("natural");
    if (input.generator.kind !== "sample") throw new Error("sample required");
    input.generator.loop = false;
    engine.playVoice(input, frame("natural"));
    context.currentTime = 0.2;
    engine.stopVoice("blocker", 0);
    context.currentTime = 0.23;
    engine.serviceNativeVoices();
    context.currentTime = 0.3;
    engine.updateVoice("natural", { pitchSemitones: -12, smoothingSeconds: 0 });
    close(engine.getVoiceCursor("natural", 0.3)!.remainingDurationSeconds!, 1.15);
    assert.equal(context.sources().at(-1)!.stops.length, 0);
  } finally {
    engine.dispose();
  }
});

test("native and virtual voices preserve the same remaining pitch ramp through pause/resume", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native"));
    engine.playVoice(voice("virtual"), frame("virtual"));
    context.currentTime = 0.2;
    for (const id of ["native", "virtual"])
      engine.updateVoice(id, { pitchSemitones: 12, smoothingSeconds: 1 });
    context.currentTime = 0.4;
    await engine.pause(0.4);
    context.currentTime = 10;
    await engine.resume(0.4);
    context.currentTime = 10.25;
    const a = engine.getVoiceCursor("native", 0.65)!;
    const b = engine.getVoiceCursor("virtual", 0.65)!;
    close(a.playheadSeconds, 0.75125);
    close(a.playheadSeconds, b.playheadSeconds);
  } finally {
    engine.dispose();
  }
});

test("an explicitly stopped native cursor clamps emission phase while its propagation tail ages", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native", 1));
    context.currentTime = 0.5;
    engine.stopVoice("native", 0.02);
    const cursor = engine.getVoiceCursor("native", 1)!;
    close(cursor.playheadSeconds, 0.52);
    close(cursor.elapsedSinceEmissionSeconds, 1);
    close(cursor.emissionEndElapsedSeconds!, 0.52);
    assert.equal(cursor.remainingDurationSeconds, 0);
  } finally {
    engine.dispose();
  }
});

test("a delayed native onended callback cannot extend an expired tail and block promotion", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("blocker"), frame("blocker"));
    engine.playVoice(voice("waiting"), frame("waiting"));
    context.currentTime = 0.5;
    engine.stopVoice("blocker", 0);
    context.currentTime = 0.75;
    context.sources()[0]!.finish();
    engine.serviceNativeVoices();
    assert.equal(engine.getVoiceCursorState("waiting", 0.75)?.provenance, "native");
    assert.equal(engine.getTelemetry().virtualization.promotions, 1);
  } finally {
    engine.dispose();
  }
});

test("native and virtual pitch replacements share the same explicit control-clock anchor", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("native"), frame("native"));
    engine.playVoice(voice("virtual"), frame("virtual"));
    context.currentTime = 0.2;
    for (const id of ["native", "virtual"])
      engine.updateVoice(id, { pitchSemitones: 12, smoothingSeconds: 1 });
    context.currentTime = 0.4;
    for (const id of ["native", "virtual"])
      engine.updateVoice(id, { pitchSemitones: -12, smoothingSeconds: 0.4 });
    const native = engine.getVoiceCursorState("native", 0.8)!;
    const virtual = engine.getVoiceCursorState("virtual", 0.8)!;
    close(native.cursor.playheadSeconds, virtual.cursor.playheadSeconds);
    const source = context.sources()[0]!;
    const anchor = source.playbackRate.automation.findLast(
      (entry) => entry.method === "setValueAtTime",
    );
    close(anchor!.value!, Math.fround(1.2));
  } finally {
    engine.dispose();
  }
});

test("owned device rebuild advances both native and virtual frozen phase through the transport gap", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  globalThis.AudioContext = class extends FakeAudioContext {
    readonly renderQuantumSize = 128;
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine({
    budget: { maxVoices: 1 },
    bufferPreset: "playback",
    oscillatorModel: "seekableNativeClock",
    virtualization: {
      maxNativeVoices: 1,
      maxVirtualVoices: 2,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    },
  });
  try {
    await engine.enable(0);
    const first = contexts[0]!;
    engine.registerBuffer("loop", first.createBuffer(1, 48000, 48000) as unknown as AudioBuffer, {
      name: "Original rebuilt phase",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: "a".repeat(64),
    });
    engine.playVoice(voice("native"), frame("native"));
    engine.playVoice(voice("virtual"), frame("virtual"));
    first.currentTime = 0.32;
    for (const id of ["native", "virtual"])
      engine.updateVoice(id, { pitchSemitones: 12, smoothingSeconds: 1 });
    first.currentTime = 0.52;
    let reads = 0;
    await engine.setBufferPreset("balanced", 0.4, {
      shouldResume: () => true,
      simulationTime: () => (reads++ === 0 ? 0.4 : 0.9),
    });
    assert.equal(contexts.length, 2);
    const native = engine.getVoiceCursorState("native", 0.9)!;
    const virtual = engine.getVoiceCursorState("virtual", 0.9)!;
    close(native.logicalCursor.playheadSeconds, 1.145);
    close(native.cursor.playheadSeconds, virtual.cursor.playheadSeconds);
    assert.equal(native.historyIncomplete, true);
  } finally {
    engine.dispose();
    globalThis.AudioContext = previous;
  }
});
