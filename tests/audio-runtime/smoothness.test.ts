import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";
import { FakeGainNode, FakeAudioBuffer, FakeAudioParam } from "./fake-context.js";

export function smoothnessFrame(): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "smoothness",
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
  };
}
export function smoothnessVoice(): VoiceInput {
  return {
    instanceId: "voice",
    sourceId: "source",
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
    gainLinear: 0.1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
  };
}

test("owned output defaults to playback buffering", async () => {
  const original = globalThis.AudioContext;
  let hint: AudioContextLatencyCategory | number | undefined;
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor(options?: AudioContextOptions) {
      super();
      hint = options?.latencyHint;
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  try {
    await engine.enable(0);
    assert.equal(hint, "playback");
  } finally {
    engine.dispose();
    globalThis.AudioContext = original;
  }
});

test("a 40 ms control stall schedules emission ahead without late events or duplicate delay", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    bufferPreset: "interactive",
  } as ConstructorParameters<typeof AudioEngine>[0]);
  try {
    await engine.enable(0);
    context.currentTime = 0.04;
    assert.equal(engine.playVoice(smoothnessVoice(), smoothnessFrame()).accepted, true);
    assert.equal(engine.getTelemetry().lateEvents, 0);
    assert.equal(context.sources()[0]!.starts[0]!.when, 0.06);
    assert.equal(context.delays()[0]!.delayTime.value, 0.1);
  } finally {
    engine.dispose();
  }
});

test("preset lookahead is applied once at each epoch; emission and physical delay stay separate", async () => {
  for (const [preset, lookahead, stall] of [
    ["interactive", 0.06, 0.04],
    ["balanced", 0.08, 0.07],
    ["playback", 0.12, 0.1],
  ] as const) {
    const context = new FakeAudioContext();
    const engine = new AudioEngine({ context: context.asContext(), bufferPreset: preset });
    try {
      await engine.enable(10);
      context.currentTime = stall;
      await engine.enable(10); // Does not add another L or move time-zero.
      const voice = { ...smoothnessVoice(), emissionTimeSeconds: 10.02 };
      assert.equal(engine.playVoice(voice, smoothnessFrame()).accepted, true);
      assert.ok(Math.abs(context.sources()[0]!.starts[0]!.when - (lookahead + 0.02)) < 1e-12);
      assert.equal(context.delays()[0]!.delayTime.value, 0.1);
      assert.equal(engine.getTelemetry().lateEvents, 0);
      assert.equal(engine.getTelemetry().schedulingLookaheadSeconds, lookahead);
      engine.setEpoch(20, 5);
      context.currentTime = 5 + stall;
      engine.playVoice({ ...voice, instanceId: "next", emissionTimeSeconds: 20.02 });
      assert.ok(Math.abs(context.sources()[1]!.starts[0]!.when - (5 + lookahead + 0.02)) < 1e-12);
      assert.equal(engine.getTelemetry().lateEvents, 0);
    } finally {
      engine.dispose();
    }
  }
});

test("onsets keep lookahead while path and content ramps start now and cover a 20 Hz solve interval", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.playVoice(smoothnessVoice(), smoothnessFrame());
    assert.equal(context.sources()[0]!.starts[0]!.when, 0.12);
    const envelope = [...(engine as any).voices.values()][0].envelope;
    assert.ok(
      envelope.gain.automation.some((a: any) => a.method === "setValueAtTime" && a.time === 0.12),
    );
    context.currentTime = 0.2;
    const frame = smoothnessFrame();
    frame.poseTick = 1;
    frame.paths[0]!.absoluteDelayS = 0.11;
    frame.paths[0]!.bandGains = [0.4];
    engine.updateFrame(frame);
    engine.updateVoice("voice", { gainLinear: 0.2, smoothingSeconds: 0.01 });
    const delay = context.delays()[0]!.delayTime.automation.at(-1)!;
    assert.equal(delay.method, "linearRampToValueAtTime");
    assert.ok(Math.abs(delay.time - 0.25) < 1e-12);
    assert.equal(context.delays()[0]!.delayTime.automation.at(-3)!.time, 0.2);
    const gains = context.nodes.filter(
      (node): node is FakeGainNode => node instanceof FakeGainNode,
    );
    assert.ok(
      gains.some((node) =>
        node.gain.automation.some((a) => a.value === 0.2 && Math.abs(a.time - 0.25) < 1e-12),
      ),
    );
    assert.ok(
      gains.some((node) =>
        node.gain.automation.some((a) => a.value === 0.4 && Math.abs(a.time - 0.25) < 1e-12),
      ),
    );
    assert.equal(context.sources().length, 1);
    assert.equal(context.delays().length, 1);
  } finally {
    engine.dispose();
  }
});

test("unchanged listener, routes and voice targets issue no automation across 240 ticks", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.playVoice(smoothnessVoice(), smoothnessFrame());
    const pose = { positionM: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] };
    engine.updateListener(pose);
    const params = [
      ...Object.values(context.listener),
      ...context.nodes.flatMap((node) => Object.values(node)),
    ].filter((value): value is FakeAudioParam => value instanceof FakeAudioParam);
    const count = () => params.reduce((sum, param) => sum + param.automation.length, 0);
    const before = count();
    for (let tick = 1; tick <= 240; tick++) {
      context.currentTime = tick / 60;
      engine.updateListener(pose);
      engine.updateFrame({ ...smoothnessFrame(), poseTick: tick });
      engine.updateVoice("voice", { gainLinear: 0.1, pitchSemitones: 0 });
    }
    assert.equal(count(), before);
    engine.updateListener({ ...pose, positionM: [0.00001, 0, 0] });
    assert.equal(count(), before, "sub-epsilon jitter also skips automation");
    engine.updateListener({ ...pose, positionM: [0.1, 0, 0] });
    assert.ok(count() > before, "real movement still ramps");
    assert.equal(context.listener.positionX.automation.at(-3)!.time, context.currentTime);
    assert.equal(engine.getTelemetry().schedulingLookaheadSeconds, 0.12);
    assert.equal((engine.getTelemetry() as any).schedulingLookaheadPolicy, "onset-only");
  } finally {
    engine.dispose();
  }
});

test("output telemetry distinguishes unsupported counters, measured zeros and measured underruns", async () => {
  const context = new FakeAudioContext();
  let wallMs = 0;
  const engine = new AudioEngine({
    context: context.asContext(),
    diagnosticsClockMs: () => wallMs,
  });
  try {
    let telemetry = engine.getTelemetry();
    assert.equal(telemetry.outputUnderrunStatus, "NOT_AVAILABLE");
    assert.equal(telemetry.outputUnderrunEvents, null);
    assert.equal(telemetry.outputUnderrunSeconds, null);
    (context as any).playbackStats = { underrunEvents: 0, underrunDuration: 0 };
    wallMs = 500;
    engine.getTelemetry(); // First supported sample establishes this context's baseline.
    wallMs = 1000;
    telemetry = engine.getTelemetry();
    assert.equal(telemetry.outputUnderrunStatus, "AVAILABLE");
    assert.equal(telemetry.outputUnderrunEvents, 0);
    (context as any).playbackStats = { underrunEvents: 7, underrunDuration: 0.07 };
    wallMs = 1500;
    telemetry = engine.getTelemetry();
    assert.equal(telemetry.outputUnderrunEvents, 7);
    assert.equal(telemetry.outputUnderrunSeconds, 0.07);
    assert.equal(telemetry.outputLatencySeconds, 0.01);
    (context as any).playbackStats.underrunDuration = NaN;
    wallMs = 2000;
    assert.equal(engine.getTelemetry().outputUnderrunStatus, "NOT_AVAILABLE");
  } finally {
    engine.dispose();
  }
});

test("owned device rebuild fades, closes and disconnects the old graph and restores one continuous voice", async () => {
  const original = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  const hints: unknown[] = [];
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor(options?: AudioContextOptions) {
      super();
      contexts.push(this);
      hints.push(options?.latencyHint);
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  try {
    await engine.enable(0);
    engine.setMonitorGain(0.7);
    engine.setMonitorMode("raw");
    engine.setMuted(false);
    engine.setLateReverb({ enabled: true, decaySeconds: 0.2, wetGain: 0.17, seed: 42 });
    const before = smoothnessFrame();
    engine.playVoice(smoothnessVoice(), before);
    contexts[0]!.currentTime = 0.5;
    await engine.setBufferPreset("balanced", 0.5);
    const telemetry = engine.getTelemetry();
    assert.deepEqual(hints, ["playback", "balanced"]);
    assert.equal(contexts[0]!.state, "closed");
    assert.ok(contexts[0]!.nodes.every((node) => node.connections.length === 0));
    assert.equal(telemetry.activeVoices, 1);
    assert.equal(telemetry.monitorGain, 0.7);
    assert.equal(telemetry.monitorMode, "raw");
    assert.equal(telemetry.muted, false);
    assert.equal(telemetry.lateReverb.enabled, true);
    assert.equal(telemetry.lateReverb.decaySeconds, 0.2);
    assert.equal(telemetry.lateReverb.wetGain, 0.17);
    assert.equal(telemetry.lateReverb.seed, 42);
    assert.equal(telemetry.schedulingLookaheadSeconds, 0.08);
    assert.equal(engine.playVoice(smoothnessVoice(), before).reason, "ALREADY_PLAYING");
    assert.equal(
      contexts[1]!.sources().length,
      2,
      "one logical source plus its finite pending propagation arrival",
    );
    assert.equal(contexts[1]!.sources()[0]!.starts[0]!.when, 0.08);
    const internal = engine as any;
    assert.deepEqual([...internal.voices.get("voice").routes.keys()], ["direct"]);
    contexts[1]!.currentTime = 0.3;
    await engine.pause(0.8);
    await engine.setBufferPreset("interactive", 0.8);
    assert.equal(engine.getTelemetry().paused, true);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    await engine.resume(0.8);
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.equal(
      [...(engine as any).voices.values()].filter((voice: any) => !voice.internalArrival).length,
      1,
    );
  } finally {
    engine.dispose();
    globalThis.AudioContext = original;
  }
});

test("externally managed contexts refuse a buffer restart", async () => {
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  try {
    await assert.rejects(engine.setBufferPreset("interactive", 0), /AUDIO_BUFFER_EXTERNAL_CONTEXT/);
  } finally {
    engine.dispose();
  }
});

test("restarting an owned device retains decoded loop assets and admits a pending start once", async () => {
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
    const buffer = new FakeAudioBuffer(1, 48000, 48000) as unknown as AudioBuffer;
    engine.registerBuffer("loop", buffer, {
      name: "Loop",
      origin: "generated",
      license: "PROJECT_GENERATED",
      sha256: "a".repeat(64),
    });
    const input: VoiceInput = {
      ...smoothnessVoice(),
      generator: {
        kind: "sample",
        asset: { assetId: "loop", revision: 1, sha256: "a".repeat(64) },
        loop: true,
        startOffsetSeconds: 0,
      },
    };
    engine.playVoice(input, smoothnessFrame());
    const changing = engine.setBufferPreset("interactive", 0);
    await assert.rejects(engine.setBufferPreset("balanced", 0), /AUDIO_BUFFER_BUSY/);
    await changing;
    assert.equal(engine.getAssetBuffer("loop"), buffer);
    assert.equal(engine.getTelemetry().assetCount, 1);
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.equal(contexts[1]!.sources().length, 1);
    assert.equal(contexts[1]!.sources()[0]!.buffer, buffer);
    assert.equal(contexts[1]!.sources()[0]!.starts[0]!.when, 0.06);
    assert.equal(engine.playVoice(input, smoothnessFrame()).reason, "ALREADY_PLAYING");
    assert.equal(contexts[1]!.sources().length, 1);
  } finally {
    engine.dispose();
    globalThis.AudioContext = original;
  }
});

test("device creation failure preserves the error cause and leaves no running or connected old graph", async () => {
  const original = globalThis.AudioContext;
  const context = new FakeAudioContext();
  let creations = 0;
  globalThis.AudioContext = class {
    constructor() {
      if (++creations === 2) throw new Error("device unavailable");
      return context;
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  try {
    await engine.enable(0);
    engine.playVoice(smoothnessVoice(), smoothnessFrame());
    await assert.rejects(engine.setBufferPreset("balanced", 0), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "AUDIO_BUFFER_RESTART_FAILED");
      assert.equal((error.cause as Error).message, "device unavailable");
      return true;
    });
    assert.equal(context.state, "closed");
    assert.ok(context.nodes.every((node) => node.connections.length === 0));
    assert.equal(engine.getTelemetry().enabled, false);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().bufferPreset, "playback");
    assert.equal(engine.getTelemetry().lastError, "AUDIO_BUFFER_RESTART_FAILED");
  } finally {
    engine.dispose();
    globalThis.AudioContext = original;
  }
});
