import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/index.js";
import { createSyntheticLateIR, LateReverbBus } from "../../src/audio/late-reverb.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import {
  FakeAudioContext,
  FakeConvolverNode,
  FakeDelayNode,
  FakeGainNode,
  FakePannerNode,
  pathsToDestination,
} from "./fake-context.js";

// Numerical synthetic-IR and control-graph checks only. Native convolution,
// audible crossfades, real-time capacity, and hearing need separate evidence.
function irEnergy(buffer: AudioBuffer): number {
  return buffer.getChannelData(0).reduce((sum, sample) => sum + sample * sample, 0);
}

function pathFrame(sourceId: string): AcousticFrame {
  const path = (id: string, order: number, delay: number, direction: [number, number, number]) => ({
    id,
    sourceId,
    listenerId: "late-listener",
    surfaceIds: [id],
    order,
    verticesM: [
      [1, 0, 0],
      [0, 0, 0],
    ] as [number, number, number][],
    lengthM: delay * 343,
    absoluteDelayS: delay,
    relativeDelayS: delay - 0.05,
    arrivalDirection: direction,
    bandGains: [0.5],
  });
  return {
    schemaVersion: "1.0.0",
    requestId: `late-fixture-${sourceId}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "late-control-fixture",
    backendVersion: "1",
    sourceId,
    listenerId: "late-listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["individualReflectionPaths"],
    modelClass: "numericalApproximation",
    directDelayS: 0.05,
    // Deliberately ordered differently from arrival time: the send must use
    // actual delay, rather than assuming the lowest reflection order is first.
    paths: [
      path(`${sourceId}-order-one`, 1, 0.2, [1, 0, 0]),
      path(`${sourceId}-earliest`, 2, 0.05, [0, 0, -1]),
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_ROUTING_FIXTURE_ONLY"],
  };
}

function voice(id: string): VoiceInput {
  return {
    instanceId: id,
    sourceId: id,
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 440 },
    gainLinear: 0.1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
  };
}

function activeIr(context: FakeAudioContext): AudioBuffer {
  const active = context.nodes.find(
    (node) =>
      node instanceof FakeConvolverNode &&
      node.buffer !== null &&
      node.connections.some(
        (connection) => connection instanceof FakeGainNode && connection.gain.value === 1,
      ),
  );
  assert.ok(active instanceof FakeConvolverNode && active.buffer);
  return active.buffer;
}

test("synthetic late IR is deterministic mono unit-energy content with no immediate direct impulse", () => {
  const context = new FakeAudioContext();
  for (const seconds of [0.1, 1.2, 4]) {
    const buffer = createSyntheticLateIR(context.asContext(), seconds, 1234);
    assert.equal(buffer.numberOfChannels, 1);
    assert.equal(buffer.length, Math.ceil(48000 * seconds));
    assert.ok(buffer.getChannelData(0).every(Number.isFinite));
    assert.ok(
      buffer
        .getChannelData(0)
        .subarray(0, 1440)
        .every((sample) => sample === 0),
    );
    assert.ok(
      Math.abs(irEnergy(buffer) - 1) < 1e-6,
      "unit impulse energy normalization must be explicit rather than native auto-normalization",
    );
  }
  const first = createSyntheticLateIR(context.asContext(), 0.1, 1234);
  const repeat = createSyntheticLateIR(context.asContext(), 0.1, 1234);
  const different = createSyntheticLateIR(context.asContext(), 0.1, 5678);
  assert.deepEqual(first.getChannelData(0), repeat.getChannelData(0));
  assert.notDeepEqual(first.getChannelData(0), different.getChannelData(0));
});

test("late IR bounds and the independent two-bank memory budget reject atomically", () => {
  const context = new FakeAudioContext();
  const bus = new LateReverbBus(
    context.asContext(),
    context.destination as unknown as AudioNode,
    38400,
  );
  try {
    bus.set({ enabled: true, decaySeconds: 0.1, wetGain: 0.2, seed: 1 });
    const before = { ...bus.settings };
    for (const update of [
      { decaySeconds: 0.099 },
      { decaySeconds: 4.001 },
      { decaySeconds: NaN },
      { wetGain: -0.001 },
      { wetGain: 1.001 },
      { seed: -1 },
      { seed: 1.5 },
      { seed: 0x100000000 },
      { decaySeconds: 0.2 },
    ]) {
      assert.throws(() => bus.set({ enabled: true, ...update }));
      assert.deepEqual(bus.settings, before);
      assert.ok(bus.decodedBytes <= 38400);
    }
    for (const node of context.nodes)
      if (node instanceof FakeConvolverNode) assert.equal(node.normalize, false);
  } finally {
    bus.dispose();
  }
});

test("the complete uint32 seed range includes a deterministic zero seed", () => {
  const context = new FakeAudioContext();
  const bus = new LateReverbBus(
    context.asContext(),
    context.destination as unknown as AudioNode,
    100000,
  );
  try {
    assert.doesNotThrow(() => bus.set({ enabled: true, decaySeconds: 0.1, seed: 0 }));
    assert.equal(bus.settings.seed, 0);
    assert.ok(Math.abs(irEnergy(activeIr(context)) - 1) < 1e-6);
  } finally {
    bus.dispose();
  }
});

test("coalescing a pending IR back to the active IR cannot later apply an obsolete seed", async () => {
  const context = new FakeAudioContext();
  const bus = new LateReverbBus(
    context.asContext(),
    context.destination as unknown as AudioNode,
    100000,
  );
  try {
    bus.set({ enabled: true, decaySeconds: 0.1, seed: 1 });
    bus.set({ enabled: true, seed: 2 });
    bus.set({ enabled: true, seed: 3 });
    bus.set({ enabled: true, seed: 2 });
    context.currentTime = 0.1;
    await new Promise((resolve) => setTimeout(resolve, 35));
    const expected = createSyntheticLateIR(context.asContext(), 0.1, 2);
    assert.equal(bus.settings.seed, 2);
    assert.deepEqual(
      activeIr(context).getChannelData(0),
      expected.getChannelData(0),
      "the actual IR must match the latest accepted settings after coalescing",
    );
    assert.ok(bus.decodedBytes <= 100000);
  } finally {
    bus.dispose();
  }
});

test("an immediate IR update supersedes an older pending update after its crossfade has elapsed", async () => {
  const context = new FakeAudioContext();
  const bus = new LateReverbBus(
    context.asContext(),
    context.destination as unknown as AudioNode,
    100000,
  );
  try {
    bus.set({ enabled: true, decaySeconds: 0.1, seed: 1 });
    bus.set({ enabled: true, seed: 2 });
    bus.set({ enabled: true, seed: 3 });
    // Native audio can advance before the main-thread pending timer is serviced.
    context.currentTime = 0.1;
    bus.set({ enabled: true, seed: 4 });
    context.currentTime = 0.2;
    await new Promise((resolve) => setTimeout(resolve, 35));
    const expected = createSyntheticLateIR(context.asContext(), 0.1, 4);
    assert.equal(bus.settings.seed, 4);
    assert.deepEqual(
      activeIr(context).getChannelData(0),
      expected.getChannelData(0),
      "a delayed control callback must not restore superseded IR content",
    );
  } finally {
    bus.dispose();
  }
});

test("clearing the late tail replaces convolution state while retaining immutable IR buffers", () => {
  const context = new FakeAudioContext();
  const bus = new LateReverbBus(
    context.asContext(),
    context.destination as unknown as AudioNode,
    100000,
  );
  try {
    bus.set({ enabled: true, decaySeconds: 0.1, seed: 42 });
    const oldConvolvers = context.nodes.filter(
      (node): node is FakeConvolverNode => node instanceof FakeConvolverNode,
    );
    const original = activeIr(context);
    const beforeBytes = bus.decodedBytes;
    bus.clearTail();
    assert.ok(oldConvolvers.every((node) => node.connections.length === 0));
    assert.equal((bus.input as unknown as FakeGainNode).connections.length, 2);
    assert.equal(
      activeIr(context),
      original,
      "IR content is reused; convolution history is replaced",
    );
    assert.equal(bus.decodedBytes, beforeBytes);
  } finally {
    bus.dispose();
  }
});

test("dispose releases the retained late IR buffers and graph connections", () => {
  const context = new FakeAudioContext();
  const bus = new LateReverbBus(
    context.asContext(),
    context.destination as unknown as AudioNode,
    100000,
  );
  bus.set({ enabled: true, decaySeconds: 0.1, seed: 1 });
  bus.set({ enabled: true, seed: 2 });
  assert.ok(bus.decodedBytes > 0);
  bus.dispose();
  assert.equal(bus.decodedBytes, 0, "a disposed bus must not retain decoded PCM references");
  assert.ok(context.nodes.every((node) => node.connections.length === 0));
});

test("late sends use one actual solver arrival route before synthetic convolution", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.setLateReverb({ enabled: true, decaySeconds: 0.1, seed: 123 });
    assert.equal(engine.playVoice(voice("routed"), pathFrame("routed")).accepted, true);
    const source = context.sources()[0]!;
    const wetPaths = pathsToDestination(source, context.destination).filter((path) =>
      path.some((node) => node instanceof FakeConvolverNode && (node.buffer?.length ?? 0) > 1),
    );
    assert.ok(wetPaths.length > 0);
    for (const path of wetPaths) {
      const delays = path.filter((node): node is FakeDelayNode => node instanceof FakeDelayNode);
      const panners = path.filter((node): node is FakePannerNode => node instanceof FakePannerNode);
      assert.equal(
        delays.length,
        1,
        "propagation delay must not be applied before and after reverb",
      );
      assert.equal(panners.length, 1, "the late send has one arrival HRTF");
      assert.equal(delays[0]!.delayTime.value, 0.05, "send chooses the earliest actual path");
      assert.equal(
        panners[0]!.rolloffFactor,
        0,
        "pressure attenuation is not duplicated by distance rolloff",
      );
      assert.deepEqual(
        [panners[0]!.positionX.value, panners[0]!.positionY.value, panners[0]!.positionZ.value],
        [0, 0, -1],
      );
    }
    assert.equal(engine.getTelemetry().lateReverb.activeSends, 1);
    assert.equal(engine.getTelemetry().lateReverb.irIncludesDirect, false);
    assert.equal(engine.getTelemetry().lateReverb.convolverNormalize, false);
  } finally {
    engine.dispose();
  }
});

test("late send caps remain independent of logical voice admission and total path caps", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: { maxLateSends: 1, maxTotalPaths: 5 },
  });
  await engine.enable(0);
  try {
    engine.setLateReverb({ enabled: true, decaySeconds: 0.1, seed: 123 });
    assert.equal(engine.playVoice(voice("first"), pathFrame("first")).accepted, true);
    assert.equal(engine.playVoice(voice("second"), pathFrame("second")).accepted, true);
    const telemetry = engine.getTelemetry();
    assert.equal(telemetry.activeVoices, 2);
    assert.equal(telemetry.lateReverb.activeSends, 1);
    assert.ok(telemetry.activePaths <= 5);
    assert.equal(telemetry.lastError, "LATE_SEND_BUDGET");
    assert.ok(telemetry.droppedPaths > 0);
  } finally {
    engine.dispose();
  }
});

test("an unavailable solver frame cannot create a substitute late arrival", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    engine.setLateReverb({ enabled: true, decaySeconds: 0.1, seed: 123 });
    const unavailable = {
      ...pathFrame("missing"),
      paths: [],
      pathAvailability: "unsupported" as const,
    };
    assert.equal(engine.playVoice(voice("missing"), unavailable).accepted, false);
    assert.equal(engine.getTelemetry().lateReverb.activeSends, 0);
    assert.equal(engine.getTelemetry().activePaths, 0);
  } finally {
    engine.dispose();
  }
});

test("restored early-arrival segments do not regenerate the synthetic tail once per reflected path", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  try {
    const hash = "d".repeat(64);
    engine.registerBuffer(
      "late-pause-pcm",
      context.createBuffer(1, 96000, 48000) as unknown as AudioBuffer,
      {
        name: "Original late pause fixture",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: hash,
      },
    );
    engine.setLateReverb({ enabled: true, decaySeconds: 0.1, seed: 123 });
    const input: VoiceInput = {
      ...voice("late-pause"),
      generator: {
        kind: "sample",
        asset: { assetId: "late-pause-pcm", revision: 1, sha256: hash },
        loop: true,
        startOffsetSeconds: 0,
      },
    };
    engine.playVoice(input, pathFrame("late-pause"));
    assert.equal(engine.getTelemetry().lateReverb.activeSends, 1);
    context.currentTime = 0.3;
    await engine.pause(0.3);
    context.currentTime = 10;
    await engine.resume(0.3);
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.ok(
      engine.getTelemetry().activePaths > 3,
      "the fixture reconstructs multiple unarrived early paths",
    );
    assert.equal(
      engine.getTelemetry().lateReverb.activeSends,
      1,
      "only resumed source emission feeds the new synthetic tail; interrupted old tails stay truncated",
    );
  } finally {
    engine.dispose();
  }
});
