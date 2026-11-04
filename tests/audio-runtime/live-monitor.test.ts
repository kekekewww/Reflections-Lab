import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import type { LiveAudioMonitorFrame, LiveMonitorMode } from "../../src/audio/live-monitor.js";
import {
  FakeAudioContext,
  FakeAnalyserNode,
  FakeNode,
  FakeGainNode,
  FakeSourceNode,
  FakeWaveShaperNode,
} from "./fake-context.js";

// Native-method/control-graph fixture only; this fake renders no DSP or PCM.
class Analyser extends FakeAnalyserNode {
  pattern: readonly number[] = [0];
  bins: readonly number[] = [-Infinity];
  readonly timeReads: Float32Array[] = [];
  readonly frequencyReads: Float32Array[] = [];
  failTimeRead = false;
  constructor(context: FakeAudioContext) {
    super("live-monitor-analyser", context);
    Object.defineProperty(this, "frequencyBinCount", { get: () => this.fftSize / 2 });
  }
  override getFloatTimeDomainData(values: Float32Array): void {
    if (this.failTimeRead) throw new Error("CONTROLLED_NATIVE_ANALYSER_READ_FAILED");
    this.timeReads.push(values);
    for (let n = 0; n < values.length; n++) values[n] = this.pattern[n % this.pattern.length]!;
  }
  getFloatFrequencyData(values: Float32Array): void {
    this.frequencyReads.push(values);
    for (let n = 0; n < values.length; n++) values[n] = this.bins[n % this.bins.length]!;
  }
}
class Splitter extends FakeNode {
  readonly ports: { node: FakeNode; channel: number; input: number }[] = [];
  constructor(
    context: FakeAudioContext,
    readonly numberOfOutputs: number,
  ) {
    super("live-monitor-splitter", context);
  }
  override connect(node: FakeNode, channel = 0, input = 0): FakeNode {
    assert.ok(channel >= 0 && channel < this.numberOfOutputs);
    assert.equal(input, 0, "each native analyser has exactly one input");
    this.ports.push({ node, channel, input });
    return super.connect(node);
  }
  override disconnect(node?: FakeNode): void {
    super.disconnect(node);
    if (node) {
      for (let n = this.ports.length - 1; n >= 0; n--)
        if (this.ports[n]!.node === node) this.ports.splice(n, 1);
    } else this.ports.length = 0;
  }
}
class MonitorContext extends FakeAudioContext {
  readonly renderQuantumSize = 128;
  override createAnalyser(): Analyser {
    const node = new Analyser(this);
    this.nodes.push(node);
    return node;
  }
  createChannelSplitter(channels = 6): Splitter {
    const node = new Splitter(this, channels);
    this.nodes.push(node);
    return node;
  }
  analysers(): Analyser[] {
    return this.nodes.filter((node): node is Analyser => node instanceof Analyser);
  }
}
function clock() {
  const descriptor = Object.getOwnPropertyDescriptor(performance, "now");
  let now = 0;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  return {
    set(value: number) {
      now = value;
    },
    restore() {
      if (descriptor) Object.defineProperty(performance, "now", descriptor);
      else Reflect.deleteProperty(performance, "now");
    },
  };
}
function read(
  engine: AudioEngine,
  mode: LiveMonitorMode,
  input = "master-left",
): LiveAudioMonitorFrame | null {
  const method = Reflect.get(engine, "readLiveMonitor");
  assert.equal(typeof method, "function", "Engine must expose explicit readLiveMonitor");
  return Reflect.apply(method, engine, [mode, input]) as LiveAudioMonitorFrame | null;
}
function release(engine: AudioEngine) {
  const method = Reflect.get(engine, "releaseLiveMonitor");
  assert.equal(typeof method, "function", "Engine must expose releaseLiveMonitor");
  Reflect.apply(method, engine, []);
}
function frame(value: LiveAudioMonitorFrame | null) {
  assert.ok(value);
  return value;
}
function meter(value: LiveAudioMonitorFrame, id: string) {
  const track = value.tracks.find((item) => item.id === id);
  assert.ok(track, `missing track ${id}`);
  return track;
}
function close(actual: number | null, expected: number) {
  assert.equal(typeof actual, "number");
  assert.ok(Math.abs(actual! - expected) < 1e-5, `${actual} != ${expected}`);
}
function master(context: MonitorContext) {
  const endpoint = context.nodes.find(
    (node): node is FakeWaveShaperNode => node instanceof FakeWaveShaperNode,
  );
  assert.ok(endpoint);
  const gain = endpoint.connections.find(
    (node) =>
      node instanceof FakeGainNode && node.connections.some((next) => next instanceof Splitter),
  );
  assert.ok(gain instanceof FakeGainNode);
  const splitter = gain.connections.find((node): node is Splitter => node instanceof Splitter);
  assert.ok(splitter);
  const channel = (index: number) => {
    const node = splitter.ports.find((port) => port.channel === index)?.node;
    assert.ok(node instanceof Analyser);
    return node;
  };
  return { endpoint, gain, splitter, left: channel(0), right: channel(1) };
}
function detached(context: MonitorContext, nodes: readonly FakeNode[]) {
  for (const node of nodes) {
    assert.equal(node.connections.length, 0);
    for (const parent of context.nodes)
      if (!nodes.includes(parent)) assert.ok(!parent.connections.includes(node));
  }
}
async function setup(rendered = 8, virtualized = false) {
  const context = new MonitorContext();
  const time = clock();
  const engine = new AudioEngine({
    context: context.asContext(),
    outputSafetyClip: true,
    diagnosticsEnabled: false,
    budget: { maxVoices: rendered, maxAssetChannels: 8 },
    virtualization: virtualized
      ? {
          maxNativeVoices: rendered,
          maxNativeCarriers: 16,
          maxVirtualVoices: 8,
          minResidenceSeconds: 0.2,
          priorityHysteresis: 0.1,
          fairnessSeconds: 30,
        }
      : false,
  });
  try {
    await engine.enable(0);
  } catch (error) {
    time.restore();
    engine.dispose();
    throw error;
  }
  return {
    context,
    engine,
    time,
    done() {
      try {
        engine.dispose();
      } finally {
        time.restore();
      }
    },
  };
}
function acoustic(sourceId: string): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: sourceId,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "monitor-control",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.25,
    paths: [
      {
        id: `${sourceId}-direct`,
        sourceId,
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 1,
        absoluteDelayS: 0.25,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [0.1],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_ONLY_NOT_NATIVE_DSP"],
  };
}
function voice(id: string, overrides: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId: id,
    sourceId: `acoustic-${id}`,
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
    gainLinear: 0.5,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    priority: 1,
    ...overrides,
  };
}
function sourceSplitter(source: FakeSourceNode): Splitter {
  const contentGain = source.connections[0];
  assert.ok(contentGain instanceof FakeGainNode);
  const envelope = contentGain.connections[0];
  assert.ok(envelope instanceof FakeGainNode);
  const splitter = envelope.connections.find((node): node is Splitter => node instanceof Splitter);
  assert.ok(splitter, "source tap must fork from the content envelope before propagation");
  return splitter;
}
function sourceChannel(splitter: Splitter, index: number): Analyser {
  const node = splitter.ports.find((port) => port.channel === index)?.node;
  assert.ok(node instanceof Analyser);
  return node;
}
function sampleVoice(id: string): VoiceInput {
  return voice(id, {
    generator: {
      kind: "sample",
      asset: { assetId: "pcm", revision: 1, sha256: "a".repeat(64) },
      loop: true,
      startOffsetSeconds: 0,
    },
  });
}
function register(context: MonitorContext, engine: AudioEngine, channels: number) {
  engine.registerBuffer(
    "pcm",
    context.createBuffer(channels, 4800, 48000) as unknown as AudioBuffer,
    {
      name: "Original multichannel control fixture",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
    },
  );
}

test("cold/load monitor does not create or resume an owned context", () => {
  const original = globalThis.AudioContext;
  const contexts: MonitorContext[] = [];
  globalThis.AudioContext = class extends MonitorContext {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  try {
    assert.equal(read(engine, "load"), null);
    const cold = read(engine, "levels");
    assert.ok(cold === null || cold.state === "blocked" || cold.state === "unavailable");
    assert.equal(contexts.length, 0);
    release(engine);
    engine.dispose();
    assert.equal(read(engine, "waveform"), null);
    assert.equal(contexts.length, 0);
  } finally {
    try {
      engine.dispose();
    } finally {
      globalThis.AudioContext = original;
    }
  }
});

test("offline and disposed reads have zero analyser cost", async () => {
  class Offline extends MonitorContext {
    async startRendering() {
      return this.createBuffer(1, 1, this.sampleRate) as unknown as AudioBuffer;
    }
  }
  const context = new Offline();
  const engine = new AudioEngine({ context: context.asContext(), diagnosticsEnabled: false });
  try {
    await engine.enable(0);
    const result = read(engine, "levels");
    assert.ok(result === null || result.state === "unavailable");
    assert.equal(context.analysers().length, 0);
    engine.dispose();
    assert.equal(read(engine, "spectrum"), null);
    assert.equal(context.analysers().length, 0);
  } finally {
    engine.dispose();
  }
});

test("lazy master branch is explicit stereo post-limiter/mute and preserves audible routing", async () => {
  const { context, engine, done } = await setup();
  try {
    assert.equal(context.analysers().length, 0);
    assert.equal(read(engine, "load"), null);
    const value = frame(read(engine, "levels"));
    const tap = master(context);
    assert.ok(tap.endpoint.connections.includes(context.destination));
    assert.equal(tap.gain.gain.value, 1);
    assert.equal(tap.gain.channelCount, 2);
    assert.equal(tap.gain.channelCountMode, "explicit");
    assert.equal(tap.gain.channelInterpretation, "speakers");
    assert.equal(tap.splitter.numberOfOutputs, 2);
    assert.equal(context.analysers().length, 2);
    for (const node of [tap.left, tap.right]) {
      assert.equal(node.fftSize, 2048);
      assert.equal(node.smoothingTimeConstant, 0);
      assert.equal(node.connections.length, 0);
    }
    assert.equal(value.state, "active");
    assert.equal(value.sampleRateHz, context.sampleRate);
    assert.equal(value.fftSize, 2048);
    close(value.frequencyBinHz, context.sampleRate / 2048);
    assert.equal(meter(value, "@master/L").point, "postLimiterAndMute");
    assert.equal(meter(value, "@master/L").rmsDbfs, null);
    assert.equal(meter(value, "@master/R").peakDbfs, null);
  } finally {
    done();
  }
});

test("float samples yield hand-computed RMS/peak, true zero, and a reused 15Hz waveform cache", async () => {
  const { context, engine, time, done } = await setup();
  try {
    frame(read(engine, "waveform"));
    const tap = master(context);
    tap.left.pattern = [1, -1, 0, 0];
    tap.right.pattern = [0];
    context.currentTime = 0.1;
    time.set(100);
    const value = frame(read(engine, "waveform"));
    close(meter(value, "@master/L").peakDbfs, 0);
    close(meter(value, "@master/L").rmsDbfs, -3.010299956639812);
    assert.equal(meter(value, "@master/R").peakDbfs, -Infinity);
    assert.equal(meter(value, "@master/R").rmsDbfs, -Infinity);
    assert.ok(value.waveform instanceof Float32Array);
    assert.equal(value.waveform.length, 2048);
    assert.equal(value.waveform, tap.left.timeReads.at(-1));
    assert.deepEqual(Array.from(value.waveform.subarray(0, 4)), [1, -1, 0, 0]);
    const waveform = value.waveform;
    const count = tap.left.timeReads.length;
    tap.left.pattern = [0.25];
    context.currentTime = 0.11;
    time.set(110);
    const cached = frame(read(engine, "waveform"));
    assert.equal(cached, value);
    assert.equal(cached.waveform, waveform);
    assert.equal(tap.left.timeReads.length, count);
    close(meter(cached, "@master/L").rmsDbfs, -3.010299956639812);
    context.currentTime = 0.2;
    time.set(200);
    const refreshed = frame(read(engine, "waveform"));
    assert.equal(refreshed.waveform, waveform);
    assert.ok(tap.left.timeReads.length > count);
    close(meter(refreshed, "@master/L").rmsDbfs, -12.041199826559248);
  } finally {
    done();
  }
});

test("spectrum exposes unchanged native selected-channel bins and reuses its buffer", async () => {
  const { context, engine, time, done } = await setup();
  try {
    frame(read(engine, "spectrum", "master-right"));
    const tap = master(context);
    tap.left.bins = [-60];
    tap.right.bins = [-12.5, -24, -Infinity];
    context.currentTime = 0.1;
    time.set(100);
    const value = frame(read(engine, "spectrum", "master-right"));
    assert.equal(value.displayInput, "master-right");
    assert.equal(value.spectrumNormalization, "nativeBlackmanFft;notPeakOrRmsMeter");
    assert.ok(value.spectrumDbfs instanceof Float32Array);
    assert.equal(value.spectrumDbfs.length, 1024);
    assert.equal(value.spectrumDbfs, tap.right.frequencyReads.at(-1));
    assert.deepEqual(Array.from(value.spectrumDbfs.subarray(0, 3)), [-12.5, -24, -Infinity]);
    const bins = value.spectrumDbfs;
    const count = tap.right.frequencyReads.length;
    context.currentTime = 0.12;
    time.set(120);
    assert.equal(frame(read(engine, "spectrum", "master-right")).spectrumDbfs, bins);
    assert.equal(tap.right.frequencyReads.length, count);
    context.currentTime = 0.2;
    time.set(200);
    tap.right.bins = [-9];
    assert.equal(frame(read(engine, "spectrum", "master-right")).spectrumDbfs, bins);
    assert.equal(bins[0], -9);
  } finally {
    done();
  }
});

test("load/release detach every monitor branch without replacing product output", async () => {
  const { context, engine, done } = await setup();
  try {
    const before = context.nodes.length;
    frame(read(engine, "levels"));
    const tap = master(context);
    const branches = context.nodes.slice(before);
    assert.equal(read(engine, "load"), null);
    detached(context, branches);
    assert.ok(tap.endpoint.connections.includes(context.destination));
    const count = context.analysers().length;
    release(engine);
    release(engine);
    assert.equal(context.analysers().length, count);
    engine.dispose();
    detached(context, branches);
    assert.equal(read(engine, "levels"), null);
  } finally {
    done();
  }
});

test("paused reads detach and return unknown metrics rather than stale or fabricated zero", async () => {
  const { context, engine, time, done } = await setup();
  try {
    const before = context.nodes.length;
    frame(read(engine, "waveform"));
    master(context).left.pattern = [1];
    context.currentTime = 0.1;
    time.set(100);
    close(meter(frame(read(engine, "waveform")), "@master/L").rmsDbfs, 0);
    const branches = context.nodes.slice(before);
    await engine.pause(0.1);
    time.set(200);
    const paused = frame(read(engine, "waveform"));
    assert.equal(paused.state, "paused");
    assert.equal(paused.waveform, null);
    assert.equal(paused.spectrumDbfs, null);
    for (const track of paused.tracks) {
      assert.equal(track.rmsDbfs, null);
      assert.equal(track.peakDbfs, null);
    }
    detached(context, branches);
    await engine.resume(0.1);
    time.set(300);
    const warming = frame(read(engine, "waveform"));
    assert.equal(warming.state, "active");
    assert.equal(meter(warming, "@master/L").rmsDbfs, null);
  } finally {
    done();
  }
});

test("source observes its pre-propagation 1024-frame window before master finishes warming", async () => {
  const { context, engine, time, done } = await setup();
  try {
    const input = voice("mono");
    assert.equal(engine.playVoice(input, acoustic(input.sourceId)).accepted, true);
    const initial = frame(read(engine, "levels"));
    assert.equal(initial.warmingSourceVoices, 1);
    assert.equal(meter(initial, "mono").rmsDbfs, null);
    const splitter = sourceSplitter(context.sources()[0]!);
    assert.equal(
      splitter.numberOfOutputs,
      1,
      "oscillator content is mono despite node channelCount default",
    );
    const analyser = sourceChannel(splitter, 0);
    assert.equal(analyser.fftSize, 1024);
    analyser.pattern = [0.5];
    assert.ok(context.delays().some((node) => node.delayTime.value === 0.25));
    context.currentTime = 0.03;
    time.set(100);
    const value = frame(read(engine, "levels"));
    close(meter(value, "mono").rmsDbfs, -6.020599913279624);
    assert.equal(meter(value, "mono").point, "contentPrePropagation");
    assert.equal(meter(value, "mono").sourceId, input.sourceId);
    assert.equal(value.sampledSourceVoices, 1);
    assert.equal(value.warmingSourceVoices, 0);
    assert.equal(meter(value, "@master/L").rmsDbfs, null);
  } finally {
    done();
  }
});

test("opposite-phase stereo uses independent channels and pooled energy instead of false mono zero", async () => {
  const { context, engine, time, done } = await setup();
  try {
    register(context, engine, 2);
    const input = sampleVoice("stereo");
    assert.equal(engine.playVoice(input, acoustic(input.sourceId)).accepted, true);
    frame(read(engine, "levels"));
    const splitter = sourceSplitter(context.sources()[0]!);
    assert.equal(splitter.numberOfOutputs, 2);
    const left = sourceChannel(splitter, 0);
    const right = sourceChannel(splitter, 1);
    assert.notEqual(left, right);
    left.pattern = [0.5];
    right.pattern = [-0.5];
    context.currentTime = 0.1;
    time.set(100);
    const value = frame(read(engine, "levels"));
    close(meter(value, "stereo").peakDbfs, -6.020599913279624);
    close(meter(value, "stereo").rmsDbfs, -6.020599913279624);
    assert.equal(left.frequencyReads.length, 0);
    assert.equal(right.frequencyReads.length, 0, "source meters never compute spectra");
  } finally {
    done();
  }
});

test("six stable eight-channel source slots bound costs and free only the cleaned instance", async () => {
  const { context, engine, time, done } = await setup(8, true);
  try {
    register(context, engine, 8);
    for (let n = 0; n < 8; n++) {
      const input = sampleVoice(`voice-${n}`);
      assert.equal(engine.playVoice(input, acoustic(input.sourceId)).accepted, true);
    }
    const before = context.nodes.length;
    const initial = frame(read(engine, "levels"));
    const ids = initial.tracks.filter((track) => track.kind === "source").map((track) => track.id);
    assert.deepEqual(
      ids,
      Array.from({ length: 6 }, (_, n) => `voice-${n}`),
    );
    assert.equal(initial.tracks.length, 8);
    assert.equal(initial.warmingSourceVoices, 6);
    assert.equal(initial.unmeasuredNativeVoices, 2);
    assert.equal(context.analysers().length, 50);
    assert.equal(context.nodes.length - before, 58);
    assert.equal(initial.analyserNodeCount, 50);
    assert.equal(initial.tapNodeCount, 58);
    const stable = context.sources().slice(0, 6).map(sourceSplitter);
    context.currentTime = 0.1;
    time.set(100);
    assert.equal(frame(read(engine, "levels")).sampledSourceVoices, 6);
    engine.stopVoice("voice-1", 0);
    context.currentTime = 0.5;
    engine.serviceNativeVoices();
    assert.equal(
      stable[1]!.connections.length,
      0,
      "native cleanup immediately detaches that instance's branch",
    );
    time.set(500);
    const replacement = frame(read(engine, "levels"));
    assert.equal(replacement.tracks.filter((track) => track.kind === "source").length, 6);
    assert.equal(replacement.unmeasuredNativeVoices, 1);
    assert.ok(!replacement.tracks.some((track) => track.id === "voice-1"));
    for (const n of [0, 2, 3, 4, 5]) assert.equal(sourceSplitter(context.sources()[n]!), stable[n]);
  } finally {
    done();
  }
});

test("virtual and future carriers stay explicitly unmeasured rather than fabricated zero tracks", async () => {
  const { context, engine, time, done } = await setup(1, true);
  try {
    for (const input of [
      voice("rendered"),
      voice("virtual"),
      voice("future", { emissionTimeSeconds: 5 }),
    ])
      assert.equal(engine.playVoice(input, acoustic(input.sourceId)).accepted, true);
    frame(read(engine, "levels"));
    context.currentTime = 0.1;
    time.set(100);
    const value = frame(read(engine, "levels"));
    assert.deepEqual(
      value.tracks.filter((track) => track.kind === "source").map((track) => track.id),
      ["rendered"],
    );
    assert.ok(value.unmeasuredVirtualVoices >= 1);
    assert.ok(value.unmeasuredPendingVoices >= 1);
    assert.equal(value.sampledSourceVoices, 1);
    assert.equal(context.analysers().length, 3);
  } finally {
    done();
  }
});

test("owned context rebuild releases old taps and leaves the replacement untapped until an explicit read", async () => {
  const original = globalThis.AudioContext;
  const contexts: MonitorContext[] = [];
  globalThis.AudioContext = class extends MonitorContext {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const time = clock();
  const engine = new AudioEngine({
    outputSafetyClip: true,
    diagnosticsEnabled: false,
    bufferPreset: "playback",
  });
  try {
    await engine.enable(0);
    const old = contexts[0]!;
    const before = old.nodes.length;
    frame(read(engine, "levels"));
    const branches = old.nodes.slice(before);
    await engine.setBufferPreset("balanced", 0);
    assert.equal(contexts.length, 2);
    assert.equal(old.state, "closed");
    detached(old, branches);
    const replacement = contexts[1]!;
    assert.equal(replacement.analysers().length, 0);
    assert.equal(frame(read(engine, "levels")).state, "active");
    assert.equal(replacement.analysers().length, 2);
    await engine.disposeAsync();
    assert.equal(replacement.state, "closed");
    for (const analyser of replacement.analysers()) assert.equal(analyser.connections.length, 0);
    assert.equal(read(engine, "levels"), null);
  } finally {
    try {
      engine.dispose();
    } finally {
      time.restore();
      globalThis.AudioContext = original;
    }
  }
});

test("a context suspended outside engine transport still detaches and reports paused unknown metrics", async () => {
  const { context, engine, time, done } = await setup();
  try {
    const before = context.nodes.length;
    frame(read(engine, "levels"));
    const branches = context.nodes.slice(before);
    master(context).left.pattern = [1];
    context.currentTime = 0.1;
    time.set(100);
    close(meter(frame(read(engine, "levels")), "@master/L").rmsDbfs, 0);
    const count = context.analysers().reduce((sum, node) => sum + node.timeReads.length, 0);
    context.state = "suspended";
    time.set(200);
    const paused = frame(read(engine, "levels"));
    assert.equal(paused.state, "paused");
    for (const track of paused.tracks) {
      assert.equal(track.peakDbfs, null);
      assert.equal(track.rmsDbfs, null);
    }
    detached(context, branches);
    assert.equal(
      context.analysers().reduce((sum, node) => sum + node.timeReads.length, 0),
      count,
    );
  } finally {
    done();
  }
});

test("native analyser failure is observable error with unknown metrics instead of fabricated silent zero", async () => {
  const { context, engine, time, done } = await setup();
  try {
    frame(read(engine, "levels"));
    master(context).left.failTimeRead = true;
    context.currentTime = 0.1;
    time.set(100);
    const value = frame(read(engine, "levels"));
    assert.equal(value.state, "error");
    assert.ok(value.reason);
    for (const track of value.tracks) {
      assert.equal(track.peakDbfs, null);
      assert.equal(track.rmsDbfs, null);
    }
  } finally {
    done();
  }
});

test("source cleanup cannot bypass the global 15Hz sampling cache", async () => {
  const { context, engine, time, done } = await setup();
  try {
    const input = voice("short-lived");
    assert.equal(engine.playVoice(input, acoustic(input.sourceId)).accepted, true);
    frame(read(engine, "levels"));
    const tap = master(context);
    tap.left.pattern = [1];
    context.currentTime = 0.1;
    time.set(100);
    close(meter(frame(read(engine, "levels")), "@master/L").rmsDbfs, 0);
    const count = tap.left.timeReads.length;
    engine.stopVoice("short-lived", 0);
    tap.left.pattern = [0.25];
    context.currentTime = 0.11;
    time.set(110);
    const cached = frame(read(engine, "levels"));
    assert.equal(
      tap.left.timeReads.length,
      count,
      "topology changes cannot force early master sampling",
    );
    close(meter(cached, "@master/L").rmsDbfs, 0);
    assert.equal(cached.sampledSourceVoices, 0);
    context.currentTime = 0.17;
    time.set(170);
    close(meter(frame(read(engine, "levels")), "@master/L").rmsDbfs, -12.041199826559248);
    assert.equal(
      tap.left.timeReads.length,
      count + 1,
      "normal sampling resumes at the next eligible UI budget",
    );
  } finally {
    done();
  }
});

test("levels never computes FFT and an unfilled mode/input cache stays unknown until its next refresh", async () => {
  const { context, engine, time, done } = await setup();
  try {
    frame(read(engine, "levels"));
    const tap = master(context);
    tap.left.bins = [-12];
    tap.right.bins = [-24];
    context.currentTime = 0.1;
    time.set(100);
    frame(read(engine, "levels"));
    assert.equal(tap.left.frequencyReads.length, 0);
    assert.equal(tap.right.frequencyReads.length, 0);
    context.currentTime = 0.11;
    time.set(110);
    const unfilledMode = frame(read(engine, "spectrum", "master-left"));
    assert.equal(unfilledMode.spectrumDbfs, null);
    assert.equal(unfilledMode.reason, "ANALYSER_WARMUP");
    assert.equal(tap.left.frequencyReads.length, 0);
    context.currentTime = 0.2;
    time.set(200);
    const left = frame(read(engine, "spectrum", "master-left"));
    assert.ok(left.spectrumDbfs instanceof Float32Array);
    const leftBins = left.spectrumDbfs;
    assert.equal(leftBins[0], -12);
    assert.equal(tap.left.frequencyReads.length, 1);
    assert.equal(tap.right.frequencyReads.length, 0);
    context.currentTime = 0.21;
    time.set(210);
    const unfilledInput = frame(read(engine, "spectrum", "master-right"));
    assert.equal(unfilledInput.spectrumDbfs, null);
    assert.equal(unfilledInput.reason, "ANALYSER_WARMUP");
    assert.equal(
      tap.right.frequencyReads.length,
      0,
      "changing selected input cannot bypass the 15Hz budget",
    );
    context.currentTime = 0.3;
    time.set(300);
    const right = frame(read(engine, "spectrum", "master-right"));
    assert.ok(right.spectrumDbfs instanceof Float32Array);
    assert.notEqual(right.spectrumDbfs, leftBins);
    assert.equal(right.spectrumDbfs[0], -24);
    assert.equal(tap.left.frequencyReads.length, 1);
    assert.equal(tap.right.frequencyReads.length, 1);
    context.currentTime = 0.4;
    time.set(400);
    const levels = frame(read(engine, "levels"));
    assert.equal(levels.spectrumDbfs, null);
    assert.equal(tap.left.frequencyReads.length, 1);
    assert.equal(tap.right.frequencyReads.length, 1);
  } finally {
    done();
  }
});

test("a warming contact source does not hide an already measured master waveform", async () => {
  const { context, engine, time, done } = await setup();
  try {
    frame(read(engine, "waveform"));
    const tap = master(context);
    tap.left.pattern = [0.5];
    context.currentTime = 0.1;
    time.set(100);
    const measured = frame(read(engine, "waveform"));
    assert.ok(measured.waveform);
    assert.equal(measured.reason, null);
    const waveform = measured.waveform;
    const input = voice("new-contact", {
      emissionTimeSeconds: 0.1,
      continuous: false,
      durationSeconds: 0.2,
    });
    assert.equal(engine.playVoice(input, acoustic(input.sourceId)).accepted, true);
    context.currentTime = 0.11;
    time.set(110);
    const value = frame(read(engine, "waveform"));
    assert.equal(value.warmingSourceVoices, 1);
    assert.equal(meter(value, "new-contact").peakDbfs, null);
    assert.equal(meter(value, "new-contact").rmsDbfs, null);
    assert.equal(value.waveform, waveform);
    close(meter(value, "@master/L").rmsDbfs, -6.020599913279624);
    assert.equal(
      value.reason,
      null,
      "source warmup belongs to its track/count, not the ready master graph",
    );
  } finally {
    done();
  }
});
