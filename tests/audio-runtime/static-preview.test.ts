import test from "node:test";
import assert from "node:assert/strict";
import { StaticPreviewHost, type StaticPreviewInput } from "../../src/app/static-preview.js";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import { FakeAudioContext, FakeDelayNode, FakePannerNode, FakeSourceNode } from "./fake-context.js";

function fixture(): StaticPreviewInput {
  const scene = createDefaultScene();
  return {
    state: "paused",
    scene,
    document: createDefaultBehaviors(scene),
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: [...object.positionM],
      orientationQuaternion: [...object.orientationQuaternion],
    })),
    objectId: "speaker",
    generation: 1,
    bindingId: "binding.continuous.speaker",
    ruleId: "rule.always",
    tick: 120,
    listener: scene.listener,
    materials: DEFAULT_MATERIALS,
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      bandAbsorptionDbPerM: DEFAULT_MATERIALS[0]!.bands.map(() => 0),
      dataClass: "Synthetic",
    },
  };
}
function sourceEngine() {
  const context = new FakeAudioContext();
  context.currentTime = 50;
  const engine = new AudioEngine({ context: context as unknown as BaseAudioContext });
  engine.setEpoch(20);
  engine.setMuted(false);
  engine.setMonitorGain(0.18);
  return { context, engine };
}

test("static preview uses independent native control graph with solver delay and HRTF once", async () => {
  const source = sourceEngine();
  const context = new FakeAudioContext();
  context.currentTime = 7;
  let preview: AudioEngine | undefined;
  const host = new StaticPreviewHost({
    getEngine: () => source.engine,
    createEngine: (options) =>
      (preview = new AudioEngine({ ...options, context: context as unknown as BaseAudioContext })),
  });
  try {
    const input = fixture();
    const original = structuredClone(input);
    const sourceTelemetry = source.engine.getTelemetry();
    const result = await host.start(input);
    assert.equal(result?.status, "playing");
    assert.deepEqual(input, original);
    assert.deepEqual(source.engine.getTelemetry(), sourceTelemetry);
    assert.equal(source.context.nodes.filter((node) => node.kind === "oscillator").length, 0);
    const oscillators = context.nodes.filter(
      (node): node is FakeSourceNode => node.kind === "oscillator",
    );
    assert.equal(oscillators.length, 1);
    assert.deepEqual(oscillators[0]!.starts, [{ when: 7 }]);
    const directDistance = Math.hypot(1.5, 1.3 - 1.6, -2 - 4);
    const delays = context.nodes.filter((node): node is FakeDelayNode => node.kind === "delay");
    assert.ok(delays.some((node) => Math.abs(node.delayTime.value - directDistance / 343) < 1e-10));
    const panners = context.nodes.filter((node): node is FakePannerNode => node.kind === "panner");
    assert.equal(panners.length, result?.metadata?.solver.pathCount);
    assert.ok(panners.every((node) => node.panningModel === "HRTF" && node.rolloffFactor === 0));
    assert.equal(
      preview?.getTelemetry().propagationDelayResponsibility,
      "AcousticFrame.absoluteDelayS once",
    );
    assert.equal(preview?.getTelemetry().monitorGain, 0.18);
    assert.equal(preview?.getTelemetry().muted, false);
    const metadata = host.getView();
    metadata.metadata!.listener.positionM[0] = 100;
    assert.equal(host.getView().metadata!.listener.positionM[0], 0);
  } finally {
    host.dispose();
    source.engine.dispose();
  }
});

test("mute/gain/raw monitoring forward without restarting preview or changing emission parameters", async () => {
  const source = sourceEngine();
  const context = new FakeAudioContext();
  let preview: AudioEngine | undefined;
  const host = new StaticPreviewHost({
    getEngine: () => source.engine,
    createEngine: (options) =>
      (preview = new AudioEngine({ ...options, context: context as unknown as BaseAudioContext })),
  });
  try {
    await host.start(fixture());
    source.engine.setMuted(true);
    source.engine.setMonitorGain(0.07);
    source.engine.setMonitorMode("raw");
    host.syncMonitor();
    assert.equal(preview?.getTelemetry().muted, true);
    assert.equal(preview?.getTelemetry().monitorGain, 0.07);
    assert.equal(preview?.getTelemetry().monitorMode, "raw");
    assert.equal(host.getView().monitorMode, "raw");
    assert.equal(context.nodes.filter((node) => node.kind === "oscillator").length, 1);
    source.engine.setMonitorMode("simulated");
    host.syncMonitor();
    assert.equal(preview?.getTelemetry().activeVoices, 1);
    assert.equal(host.getView().monitorMode, "simulated");
  } finally {
    host.dispose();
    source.engine.dispose();
  }
});

test("stopping during asynchronous device enable cancels every late voice start", async () => {
  const source = sourceEngine();
  const context = new FakeAudioContext();
  let resolve!: () => void;
  context.resume = () =>
    new Promise<void>((done) => {
      resolve = done;
    });
  const host = new StaticPreviewHost({
    getEngine: () => source.engine,
    createEngine: (options) =>
      new AudioEngine({ ...options, context: context as unknown as BaseAudioContext }),
  });
  try {
    const started = host.start(fixture());
    assert.equal(host.getView().status, "starting");
    host.stop();
    resolve();
    assert.equal(await started, null);
    assert.equal(context.nodes.filter((node) => node.kind === "oscillator").length, 0);
    assert.equal(host.getView().status, "stopped");
  } finally {
    host.dispose();
    source.engine.dispose();
  }
});

test("sample preview copies the exact accepted asset version and missing bytes refuse explicitly", async () => {
  const source = sourceEngine();
  const input = fixture();
  const generator = {
    kind: "sample" as const,
    asset: { assetId: "asset.preview", revision: 4, sha256: "a".repeat(64) },
    loop: true,
    startOffsetSeconds: 0.1,
  };
  input.document.profiles[0]!.rules[0]!.generator = generator;
  const contexts: FakeAudioContext[] = [];
  const host = new StaticPreviewHost({
    getEngine: () => source.engine,
    createEngine: (options) => {
      const context = new FakeAudioContext();
      contexts.push(context);
      return new AudioEngine({ ...options, context: context as unknown as BaseAudioContext });
    },
  });
  try {
    await assert.rejects(host.start(input), /ASSET_NOT_READY/);
    assert.equal(host.getView().status, "error");
    assert.equal(contexts[0]!.nodes.filter((node) => node.kind === "buffer-source").length, 0);
    const buffer = source.context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer;
    source.engine.registerBuffer(generator.asset.assetId, buffer, {
      name: "preview fixture",
      revision: 4,
      sha256: generator.asset.sha256,
      origin: "generated",
      license: "PROJECT_GENERATED",
    });
    assert.equal((await host.start(input))?.status, "playing");
    const nodes = contexts[1]!.nodes.filter(
      (node): node is FakeSourceNode => node.kind === "buffer-source",
    );
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0]!.buffer, buffer);
    assert.equal(nodes[0]!.loop, true);
    assert.equal(nodes[0]!.starts[0]!.offset, 0.1);
  } finally {
    host.dispose();
    source.engine.dispose();
  }
});

test("rapid replacement bounds independent live voices and disposed host cannot restart", async () => {
  const source = sourceEngine();
  const engines: AudioEngine[] = [];
  const host = new StaticPreviewHost({
    getEngine: () => source.engine,
    createEngine: (options) => {
      const context = new FakeAudioContext();
      const engine = new AudioEngine({
        ...options,
        context: context as unknown as BaseAudioContext,
      });
      engines.push(engine);
      return engine;
    },
  });
  try {
    await host.start(fixture());
    await host.start(fixture());
    await host.start(fixture());
    assert.ok(engines.reduce((sum, engine) => sum + engine.getTelemetry().activeVoices, 0) <= 2);
    assert.equal(engines[0]!.getTelemetry().enabled, false);
    assert.equal(host.getView().status, "playing");
    host.dispose();
    await assert.rejects(host.start(fixture()), /PREVIEW_DISPOSED/);
    assert.ok(engines.every((engine) => engine.getTelemetry().activeVoices === 0));
  } finally {
    host.dispose();
    source.engine.dispose();
  }
});

test("bounded preview reserves a late-send slot after eight individual control-graph paths", async () => {
  const source = sourceEngine();
  source.engine.setLateReverb({ enabled: true, decaySeconds: 0.2, wetGain: 0.1 });
  const context = new FakeAudioContext();
  class EightPathFixtureEngine extends AudioEngine {
    override playVoice(voice: VoiceInput, frame: AcousticFrame) {
      // Synthetic control-graph stress fixture, not a claimed eight-reflection room solve.
      const direct = frame.paths.find((path) => path.order === 0)!;
      return super.playVoice(voice, {
        ...frame,
        paths: Array.from({ length: 8 }, (_, index) => ({
          ...structuredClone(direct),
          id: `fixture.path.${index}`,
        })),
      });
    }
  }
  let preview: EightPathFixtureEngine | undefined;
  const host = new StaticPreviewHost({
    getEngine: () => source.engine,
    createEngine: (options) =>
      (preview = new EightPathFixtureEngine({
        ...options,
        context: context as unknown as BaseAudioContext,
      })),
  });
  try {
    const result = await host.start(fixture());
    assert.equal(result?.status, "playing");
    assert.deepEqual(result?.metadata?.rendererBudget, {
      voices: 1,
      individualPaths: 8,
      lateSends: 1,
      totalPaths: 9,
    });
    assert.equal(preview?.getTelemetry().activePaths, 9);
    assert.equal(preview?.getTelemetry().lateReverb.activeSends, 1);
    assert.equal(preview?.getTelemetry().droppedPaths, 0);
    assert.equal(preview?.getTelemetry().lastError, null);
  } finally {
    host.dispose();
    source.engine.dispose();
  }
});

test("disposed reverb preview creates no nodes when its pending fade drain resolves", async () => {
  const source = sourceEngine();
  source.engine.setLateReverb({ enabled: true, decaySeconds: 0.2, wetGain: 0.1 });
  const contexts: FakeAudioContext[] = [];
  const engines: AudioEngine[] = [];
  const host = new StaticPreviewHost({
    getEngine: () => source.engine,
    createEngine: (options) => {
      const context = new FakeAudioContext();
      contexts.push(context);
      const engine = new AudioEngine({
        ...options,
        context: context as unknown as BaseAudioContext,
      });
      engines.push(engine);
      return engine;
    },
  });
  try {
    await host.start(fixture());
    await host.start(fixture());
    await host.start(fixture());
    assert.equal(engines[0]!.getTelemetry().enabled, false);
    const countAtDispose = contexts[0]!.nodes.length;
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    assert.equal(contexts[0]!.nodes.length, countAtDispose);
    assert.equal(engines[0]!.getTelemetry().draining, false);
  } finally {
    host.dispose();
    source.engine.dispose();
  }
});

test("dry audition stop cancels pending enable and disconnects a started independent source", async () => {
  const original = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class AuditionContext extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = AuditionContext as unknown as typeof AudioContext;
  const source = sourceEngine();
  try {
    const generator = { kind: "oscillator" as const, waveform: "sine" as const, frequencyHz: 300 };
    const pending = source.engine.audition(generator);
    await source.engine.stopAudition();
    assert.deepEqual(await pending, { accepted: false, reason: "AUDITION_CANCELLED" });
    assert.equal(contexts[0]!.sources().length, 0);
    assert.equal((await source.engine.audition(generator)).accepted, true);
    assert.equal(contexts[1]!.sources().length, 1);
    await source.engine.stopAudition();
    assert.equal(contexts[1]!.sources()[0]!.connections.length, 0);
    assert.equal(contexts[1]!.state, "closed");
  } finally {
    source.engine.dispose();
    globalThis.AudioContext = original;
  }
});
