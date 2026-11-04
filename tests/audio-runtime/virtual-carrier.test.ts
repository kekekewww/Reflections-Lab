import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext, FakeBiquadNode, FakeGainNode, FakeSourceNode } from "./fake-context.js";

// Native control-graph observations only. FakeAudioContext renders no PCM:
// these tests establish ownership, admission and scheduling, not native phase or hearing.
class CarrierContext extends FakeAudioContext {
  periodicWaveCreates = 0;
  override createPeriodicWave(real: Float32Array, imag: Float32Array) {
    this.periodicWaveCreates++;
    return super.createPeriodicWave(real, imag);
  }
}

function frame(sourceId: string, delay = 0): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: `carrier-${sourceId}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "carrier-control-oracle",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delay,
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
    limitations: ["CONTROL_GRAPH_ONLY_NOT_NATIVE_PHASE_OR_HEARING"],
  };
}

function voice(id: string, overrides: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId: id,
    sourceId: id,
    generator: { kind: "oscillator", waveform: "sawtooth", frequencyHz: 173.3 },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    priority: 1,
    ...overrides,
  };
}

async function setup(maxNativeCarriers = 8, maxVirtualVoices = 3) {
  const context = new CarrierContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const ended: string[] = [];
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: { maxVoices: 1 },
    virtualization: {
      maxNativeVoices: 1,
      maxNativeGraphs: 1,
      maxNativeCarriers,
      maxVirtualVoices,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    },
    onVoiceEnded: (id) => ended.push(id),
  });
  await engine.enable(0);
  return { engine, context, ended };
}

function contentNodes(source: FakeSourceNode) {
  // The existing native SourceGraph contract separates the optional content
  // filter, content gain and content envelope from any later render gate/routes.
  const first = source.connections[0];
  const filter = first instanceof FakeBiquadNode ? first : null;
  const contentGain = filter ? filter.connections[0] : first;
  assert.ok(contentGain instanceof FakeGainNode, "source must retain its content gain");
  const envelope = contentGain.connections[0];
  assert.ok(envelope instanceof FakeGainNode, "content envelope must precede render-only routing");
  return { filter, contentGain, envelope };
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

test("carrier admission keeps native content sources and bounds expensive rendered graphs separately", async () => {
  const { engine, context, ended } = await setup();
  try {
    assert.equal(engine.playVoice(voice("rendered"), frame("rendered")).accepted, true);
    assert.deepEqual(engine.playVoice(voice("virtual"), frame("virtual")), {
      accepted: true,
      reason: "VIRTUALIZED",
    });
    assert.equal(context.sources().length, 2, "a virtual voice still owns one real native carrier");
    assert.equal(
      context.panners().length,
      1,
      "virtual content does not allocate another spatial graph",
    );
    assert.equal(context.delays().length, 1);
    const telemetry = engine.getTelemetry();
    assert.equal(telemetry.activeVoices, 1);
    assert.equal(telemetry.nativeSlotsInUse, 1);
    assert.equal(telemetry.virtualVoices, 1);
    assert.equal(telemetry.nativeSourceNodes, 2);
    assert.equal(telemetry.carrierOnlyVoices, 1);
    assert.equal(telemetry.nativeCarrierBudget, 8);
    assert.equal(telemetry.nativeCarrierPeak, 2);
    assert.equal(engine.getVoiceCursorState("virtual", 0)?.provenance, "virtual");
    assert.equal(engine.getVoiceCursorState("virtual", 0)?.historyIncomplete, true);
    assert.equal(context.periodicWaveCreates, 0, "candidate retains the browser-managed waveform");
    for (const source of context.sources()) {
      assert.equal(source.type, "sawtooth");
      assert.equal(
        source.detune.value,
        0,
        "carrier continuity must not rely on a tiny-detune workaround",
      );
      assert.equal(source.starts.length, 1);
    }
    assert.deepEqual(ended, []);
  } finally {
    engine.dispose();
  }
});

test("fair demotion and promotion reuse source identities without stopping or fading content envelopes", async () => {
  const { engine, context, ended } = await setup();
  try {
    engine.playVoice(voice("a"), frame("a"));
    engine.playVoice(voice("b"), frame("b"));
    const originals = [...context.sources()];
    const content = originals.map(contentNodes);
    const before = content.map(({ contentGain, envelope }) => ({
      gain: structuredClone(contentGain.gain.automation),
      envelope: structuredClone(envelope.gain.automation),
    }));
    context.currentTime = 1.2;
    engine.serviceNativeVoices();
    assert.equal(
      engine.getTelemetry().nativeSlotsInUse,
      1,
      "outgoing graph/tail still owns its slot",
    );
    context.currentTime = 1.3;
    engine.serviceNativeVoices();
    assert.equal(engine.getVoiceCursorState("b", 1.3)?.provenance, "native");
    context.currentTime = 2.6;
    engine.serviceNativeVoices();
    context.currentTime = 2.7;
    engine.serviceNativeVoices();
    assert.equal(engine.getVoiceCursorState("a", 2.7)?.provenance, "native");
    assert.deepEqual(context.sources(), originals, "route swaps create no replacement source");
    originals.forEach((source, index) => {
      assert.equal(source.starts.length, 1);
      assert.deepEqual(source.stops, [], "demotion leaves the carrier running");
      assert.deepEqual(content[index]!.contentGain.gain.automation, before[index]!.gain);
      assert.deepEqual(
        content[index]!.envelope.gain.automation,
        before[index]!.envelope,
        "only a render gate may fade, not the source content envelope",
      );
    });
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 1);
    assert.equal(context.periodicWaveCreates, 0);
    assert.deepEqual(ended, [], "route virtualization is not a logical end");
  } finally {
    engine.dispose();
  }
});

test("virtual carrier gain, pitch and content filter updates reach the original native parameters", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("rendered"), frame("rendered"));
    engine.playVoice(voice("virtual", { filterCutoffHz: 2000 }), frame("virtual"));
    const carrier = context.sources()[1]!;
    const content = contentNodes(carrier);
    assert.ok(content.filter);
    const envelope = structuredClone(content.envelope.gain.automation);
    context.currentTime = 0.3;
    engine.updateVoice("virtual", {
      gainLinear: 0.25,
      pitchSemitones: 7,
      filterCutoffHz: 500,
      smoothingSeconds: 0.1,
    });
    close(carrier.frequency.value, 173.3 * 2 ** (7 / 12));
    close(content.contentGain.gain.value, 0.25);
    close(content.filter.frequency.value, 500);
    for (const param of [carrier.frequency, content.contentGain.gain, content.filter.frequency]) {
      assert.equal(param.automation.at(-1)?.method, "linearRampToValueAtTime");
      close(param.automation.at(-1)!.time, 0.4);
    }
    assert.deepEqual(content.envelope.gain.automation, envelope);
    assert.equal(context.sources()[1], carrier);
    assert.equal(carrier.starts.length, 1);
    assert.deepEqual(carrier.stops, []);
    assert.equal(engine.getTelemetry().carrierOnlyVoices, 1);
  } finally {
    engine.dispose();
  }
});

test("a virtual legacy-finite one-shot ends once and is never recreated after a slot becomes free", async () => {
  const { engine, context, ended } = await setup();
  try {
    engine.registerBuffer(
      "shot-pcm",
      context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer,
      {
        name: "Original carrier one-shot PCM",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: "a".repeat(64),
      },
    );
    engine.playVoice(voice("blocker"), frame("blocker"));
    const shot = voice("shot", {
      continuous: false,
      generator: {
        kind: "sample",
        asset: { assetId: "shot-pcm", revision: 1, sha256: "a".repeat(64) },
        loop: false,
        startOffsetSeconds: 0.125,
      },
    });
    assert.equal(engine.playVoice(shot, frame("shot")).accepted, true);
    const carrier = context.sources()[1]!;
    assert.equal(carrier.starts.length, 1);
    assert.deepEqual(
      carrier.stops,
      [0.875],
      "retain the reference initial-rate finite cutoff without calling it exact natural EOF",
    );
    context.currentTime = 0.875;
    // Fake event delivery stands in for native onended, not for rendered PCM.
    carrier.finish();
    carrier.finish();
    engine.serviceNativeVoices();
    engine.serviceNativeVoices();
    assert.deepEqual(ended, ["shot"]);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 1);
    assert.equal(engine.getTelemetry().virtualVoices, 0);
    engine.stopVoice("blocker", 0);
    context.currentTime = 1;
    engine.serviceNativeVoices();
    assert.equal(context.sources().length, 2, "ended one-shot is not replayed on promotion");
    assert.equal(carrier.starts.length, 1);
    assert.equal(engine.getVoiceCursorState("shot", 1), null);
  } finally {
    engine.dispose();
  }
});

test("carrier budget rejection is explicit and allocates no native nodes", async () => {
  const { engine, context } = await setup(2, 4);
  try {
    engine.playVoice(voice("a"), frame("a"));
    engine.playVoice(voice("b"), frame("b"));
    const beforeNodes = context.nodes.length;
    const beforeSources = [...context.sources()];
    assert.deepEqual(engine.playVoice(voice("overflow"), frame("overflow")), {
      accepted: false,
      reason: "NATIVE_CARRIER_BUDGET",
    });
    assert.equal(
      context.nodes.length,
      beforeNodes,
      "reject before any source/filter/gain allocation",
    );
    assert.deepEqual(context.sources(), beforeSources);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    assert.equal(engine.getTelemetry().nativeCarrierPeak, 2);
    assert.equal(engine.getTelemetry().nativeCarrierBudget, 2);
    assert.equal(engine.playVoice(voice("b"), frame("b")).reason, "ALREADY_PLAYING");
    assert.equal(context.sources().length, 2, "duplicate IDs do not compete for another carrier");
  } finally {
    engine.dispose();
  }
});

test("virtual queue budget remains independent of the larger physical carrier cap", async () => {
  const { engine, context } = await setup(6, 2);
  try {
    for (const id of ["a", "b", "c"])
      assert.equal(engine.playVoice(voice(id), frame(id)).accepted, true);
    const before = context.nodes.length;
    assert.deepEqual(engine.playVoice(voice("overflow"), frame("overflow")), {
      accepted: false,
      reason: "VIRTUAL_VOICE_BUDGET",
    });
    assert.equal(context.nodes.length, before);
    assert.equal(context.sources().length, 3);
    assert.equal(engine.getTelemetry().virtualVoices, 2);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 3);
    assert.equal(engine.getTelemetry().nativeCarrierPeak, 3);
  } finally {
    engine.dispose();
  }
});

test("future and duplicate emissions keep their original native onset and identity", async () => {
  const { engine, context } = await setup();
  try {
    engine.playVoice(voice("future-a", { emissionTimeSeconds: 2 }), frame("future-a"));
    const future = voice("future-b", { emissionTimeSeconds: 3 });
    engine.playVoice(future, frame("future-b"));
    const originals = [...context.sources()];
    assert.equal(originals[0]!.starts[0]!.when, 2);
    assert.equal(originals[1]!.starts[0]!.when, 3);
    assert.equal(engine.playVoice(future, frame("future-b")).reason, "ALREADY_PLAYING");
    context.currentTime = 0.4;
    engine.updateVoice("future-b", { gainLinear: 0.2, pitchSemitones: -12, smoothingSeconds: 0.1 });
    engine.serviceNativeVoices();
    assert.deepEqual(context.sources(), originals);
    assert.equal(
      originals[1]!.starts[0]!.when,
      3,
      "content updates cannot pull a future onset earlier",
    );
    assert.equal(originals[1]!.starts.length, 1);
    assert.deepEqual(originals[1]!.stops, []);
    close(originals[1]!.frequency.value, 173.3 / 2);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
  } finally {
    engine.dispose();
  }
});

test("ordinary pause suspends the context and resumes every carrier without stop or restart", async () => {
  const { engine, context } = await setup();
  try {
    for (const id of ["a", "b", "c"]) engine.playVoice(voice(id), frame(id, 0.25));
    const originals = [...context.sources()];
    const starts = originals.map((source) => structuredClone(source.starts));
    context.currentTime = 0.4;
    await engine.pause(0.4);
    assert.equal(
      context.state,
      "suspended",
      "native clocks and delay contents must actually freeze",
    );
    assert.deepEqual(context.sources(), originals);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 3);
    originals.forEach((source, index) => {
      assert.deepEqual(source.starts, starts[index]);
      assert.deepEqual(source.stops, [], "ordinary pause retains native source state");
    });
    close(engine.getVoiceCursor("b", 100)!.playheadSeconds, 0.4);
    await engine.resume(0.4);
    assert.equal(context.state, "running");
    assert.deepEqual(context.sources(), originals);
    originals.forEach((source, index) => {
      assert.deepEqual(source.starts, starts[index], "resume does not start a second source");
      assert.deepEqual(source.stops, []);
    });
    context.currentTime = 0.6;
    engine.serviceNativeVoices();
    close(engine.getVoiceCursor("b", 0.6)!.playheadSeconds, 0.6);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 3);
  } finally {
    engine.dispose();
  }
});

test("drain and dispose release every carrier and leave no late callbacks or native source ownership", async () => {
  const { engine, context, ended } = await setup();
  try {
    for (const id of ["a", "b", "c"]) engine.playVoice(voice(id), frame(id));
    const originals = [...context.sources()];
    context.currentTime = 0.1;
    await engine.drainVoices();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 0);
    assert.equal(engine.getTelemetry().carrierOnlyVoices, 0);
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 0);
    assert.equal(engine.getTelemetry().virtualVoices, 0);
    assert.deepEqual([...ended].sort(), ["a", "b", "c"]);
    for (const source of originals) {
      assert.ok(source.stops.length > 0);
      assert.equal(source.connections.length, 0);
      source.finish();
    }
    assert.deepEqual([...ended].sort(), ["a", "b", "c"]);
    engine.playVoice(voice("after-drain", { emissionTimeSeconds: 0.1 }), frame("after-drain"));
    assert.equal(engine.getTelemetry().nativeSourceNodes, 1);
    const last = context.sources().at(-1)!;
    engine.dispose();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 0);
    assert.equal(last.connections.length, 0);
    assert.ok(last.stops.length > 0);
    last.finish();
    assert.equal(
      ended.filter((id) => id === "after-drain").length,
      0,
      "dispose disconnects late callbacks rather than dispatching a new logical event",
    );
  } finally {
    engine.dispose();
  }
});

test("the explicit carrier content model can be selected for a reference renderer without virtualization", async () => {
  const context = new CarrierContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeCarrierRoutes",
    virtualization: false,
  });
  try {
    await engine.enable(0);
    engine.playVoice(voice("reference-a"), frame("reference-a"));
    engine.playVoice(voice("reference-b"), frame("reference-b"));
    assert.equal(context.sources().length, 2);
    assert.equal(context.periodicWaveCreates, 0);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    assert.equal(engine.getTelemetry().carrierOnlyVoices, 0);
    assert.equal(engine.getTelemetry().virtualVoices, 0);
  } finally {
    engine.dispose();
  }
});

test("a failed virtual carrier start rolls back ownership without logical end and permits the same ID and asset retry", async () => {
  const { engine, context, ended } = await setup();
  const originalCreateBufferSource = context.createBufferSource.bind(context);
  try {
    const pcm = context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer;
    const metadata = {
      name: "Original failing carrier PCM",
      origin: "generated" as const,
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: "a".repeat(64),
    };
    engine.registerBuffer("failure-pcm", pcm, metadata);
    engine.playVoice(voice("blocker"), frame("blocker"));
    let failedSource: FakeSourceNode | null = null;
    context.createBufferSource = () => {
      const source = originalCreateBufferSource();
      failedSource = source;
      source.start = () => {
        throw new Error("INJECTED_NATIVE_START_FAILURE");
      };
      return source;
    };
    const input = voice("retry", {
      generator: {
        kind: "sample",
        asset: { assetId: "failure-pcm", revision: 1, sha256: "a".repeat(64) },
        loop: true,
        startOffsetSeconds: 0,
      },
    });
    assert.throws(() => engine.playVoice(input, frame("retry")), /INJECTED_NATIVE_START_FAILURE/);
    const failed = failedSource as FakeSourceNode | null;
    assert.ok(failed, "native start failure must occur after a carrier was created");
    assert.equal(
      engine.getTelemetry().nativeSourceNodes,
      1,
      "failed carrier cannot retain source ownership",
    );
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 1, "only the blocker graph remains");
    assert.equal(
      engine.getTelemetry().virtualVoices,
      0,
      "failed starts cannot leave a virtual identity",
    );
    assert.equal(
      failed.connections.length,
      0,
      "failed source must detach from content and anchor routing",
    );
    assert.equal(failed.onended, null, "failed native callbacks cannot emit a later logical end");
    failed.finish();
    assert.deepEqual(ended, []);
    assert.deepEqual(
      engine.evictAssets(["failure-pcm"]).evictedAssetIds,
      ["failure-pcm"],
      "failed ownership must not leave the asset protected",
    );
    engine.registerBuffer("failure-pcm", pcm, metadata);
    context.createBufferSource = originalCreateBufferSource;
    assert.deepEqual(engine.playVoice(input, frame("retry")), {
      accepted: true,
      reason: "VIRTUALIZED",
    });
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    assert.equal(engine.getTelemetry().virtualVoices, 1);
    assert.equal(context.sources().at(-1)!.starts.length, 1);
    assert.deepEqual(ended, [], "rollback and retry are not extra logical sound endings");
  } finally {
    context.createBufferSource = originalCreateBufferSource;
    engine.dispose();
  }
});

test("virtual sample carriers protect their PCM through stop fade until native ownership is released", async () => {
  const { engine, context, ended } = await setup();
  try {
    const original = context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer;
    const replacement = context.createBuffer(1, 24000, 48000) as unknown as AudioBuffer;
    const metadata = {
      name: "Original protected carrier PCM",
      origin: "generated" as const,
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: "a".repeat(64),
    };
    engine.registerBuffer("protected-pcm", original, metadata);
    engine.playVoice(voice("blocker"), frame("blocker"));
    const input = voice("protected", {
      generator: {
        kind: "sample",
        asset: { assetId: "protected-pcm", revision: 1, sha256: "a".repeat(64) },
        loop: true,
        startOffsetSeconds: 0,
      },
    });
    engine.playVoice(input, frame("protected"));
    const carrier = context.sources()[1]!;
    assert.deepEqual(engine.evictAssets(["protected-pcm"]).protectedAssetIds, ["protected-pcm"]);
    assert.throws(
      () => engine.registerBuffer("protected-pcm", replacement, metadata),
      (error: unknown) => (error as { code?: string }).code === "ASSET_IN_USE",
    );
    context.currentTime = 0.1;
    engine.stopVoice("protected", 0.05);
    assert.deepEqual(ended, ["protected"]);
    assert.equal(engine.getTelemetry().virtualVoices, 0);
    assert.equal(
      engine.getTelemetry().nativeSourceNodes,
      2,
      "stopping carrier retains native ownership during its fade",
    );
    assert.deepEqual(engine.evictAssets(["protected-pcm"]).protectedAssetIds, ["protected-pcm"]);
    assert.throws(
      () => engine.registerBuffer("protected-pcm", replacement, metadata),
      (error: unknown) => (error as { code?: string }).code === "ASSET_IN_USE",
    );
    context.currentTime = 0.2;
    carrier.finish();
    assert.equal(engine.getTelemetry().nativeSourceNodes, 1);
    assert.deepEqual(engine.evictAssets(["protected-pcm"]).evictedAssetIds, ["protected-pcm"]);
    assert.equal(carrier.onended, null);
    carrier.finish();
    assert.deepEqual(
      ended,
      ["protected"],
      "release callbacks cannot end the same logical source twice",
    );
  } finally {
    engine.dispose();
  }
});

test("carrier envelopes share one zero-gain destination anchor and dispose disconnects it", async () => {
  const { engine, context, ended } = await setup();
  try {
    engine.playVoice(voice("rendered"), frame("rendered"));
    engine.playVoice(voice("virtual"), frame("virtual"));
    const sources = [...context.sources()];
    const rendered = contentNodes(sources[0]!);
    const parked = contentNodes(sources[1]!);
    const anchor = rendered.envelope.connections.find(
      (node) => node instanceof FakeGainNode && node.connections.includes(context.destination),
    );
    assert.ok(anchor instanceof FakeGainNode);
    assert.equal(anchor.gain.value, 0);
    assert.deepEqual(anchor.connections, [context.destination]);
    assert.ok(
      parked.envelope.connections.includes(anchor),
      "all carrier sources share the same anchor",
    );
    assert.equal(rendered.envelope.connections.length, 2);
    assert.equal(parked.envelope.connections.length, 2);
    assert.equal(
      context.nodes.filter(
        (node) =>
          node instanceof FakeGainNode &&
          node.connections.includes(context.destination) &&
          node.gain.value === 0,
      ).length,
      1,
      "phase anchor is one bounded node, not one new destination branch per virtual voice",
    );
    engine.dispose();
    assert.deepEqual(anchor.connections, []);
    assert.deepEqual(rendered.envelope.connections, []);
    assert.deepEqual(parked.envelope.connections, []);
    for (const source of sources) {
      assert.equal(source.onended, null);
      source.finish();
    }
    assert.deepEqual(ended, []);
    // These graph observations establish wiring ownership only. Native processing
    // and phase continuity require the separate real-browser PCM evidence.
  } finally {
    engine.dispose();
  }
});

test("carrier pause reports the actual suspend-boundary native cursor and resume does not jump it", async () => {
  const { engine, context } = await setup();
  const suspend = context.suspend.bind(context);
  const actualSuspendAudioTime = 20480 / 48000; // Actual quantum 160, after the pause fade.
  try {
    engine.registerBuffer(
      "pause-unit-pcm",
      context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer,
      {
        name: "Original unit-rate pause PCM",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: "a".repeat(64),
      },
    );
    engine.playVoice(voice("blocker"), frame("blocker"));
    engine.playVoice(
      voice("pause-signal", {
        generator: {
          kind: "sample",
          asset: { assetId: "pause-unit-pcm", revision: 1, sha256: "a".repeat(64) },
          loop: true,
          startOffsetSeconds: 0,
        },
      }),
      frame("pause-signal"),
    );
    const originals = [...context.sources()];
    context.suspend = async () => {
      // A controlled native-clock advance stands in for audio rendered during
      // the fade. This is a clock/wiring oracle; FakeAudioContext emits no PCM.
      context.currentTime = actualSuspendAudioTime;
      await suspend();
    };
    context.currentTime = 0.4;
    await engine.pause(0.4);
    assert.equal(context.state, "suspended");
    const audit = engine.getTelemetry().pauseClockAudit!;
    assert.equal(audit.transportPolicy, "sameContextCarrier");
    close(audit.logicalCutoffSimulationSeconds, 0.4);
    close(audit.logicalCutoffAudioSeconds, 0.4);
    close(audit.nativeSuspendAudioSeconds!, actualSuspendAudioTime);
    close(audit.nativeFadeAdvanceSeconds!, actualSuspendAudioTime - 0.4);
    close(audit.clockSkewAtCallSeconds, 0);
    const beforeResume = engine.getVoiceCursorState("pause-signal", 0.4)!;
    close(beforeResume.logicalCursor.playheadSeconds, 0.4);
    close(beforeResume.cursor.playheadSeconds, actualSuspendAudioTime);
    close(beforeResume.cursor.elapsedSinceEmissionSeconds, actualSuspendAudioTime);
    const stillPaused = engine.getVoiceCursorState("pause-signal", 100)!;
    close(stillPaused.cursor.playheadSeconds, beforeResume.cursor.playheadSeconds);
    await engine.resume(0.4);
    const afterResume = engine.getVoiceCursorState("pause-signal", 0.4)!;
    close(afterResume.cursor.playheadSeconds, beforeResume.cursor.playheadSeconds);
    close(
      afterResume.cursor.elapsedSinceEmissionSeconds,
      beforeResume.cursor.elapsedSinceEmissionSeconds,
    );
    close(afterResume.logicalCursor.playheadSeconds, 0.4);
    assert.deepEqual(context.sources(), originals);
    for (const source of originals) {
      assert.equal(source.starts.length, 1);
      assert.deepEqual(source.stops, []);
    }
  } finally {
    context.suspend = suspend;
    engine.dispose();
  }
});

test("fade-boundary native exhaustion is not replayed and future carriers keep their original native deadline", async () => {
  const { engine, context, ended } = await setup();
  const suspend = context.suspend.bind(context);
  const actualSuspendAudioTime = 20480 / 48000;
  try {
    engine.registerBuffer(
      "pause-boundary-pcm",
      context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer,
      {
        name: "Original pause boundary PCM",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: "a".repeat(64),
      },
    );
    engine.playVoice(voice("blocker"), frame("blocker"));
    engine.playVoice(
      voice("fade-shot", {
        continuous: false,
        generator: {
          kind: "sample",
          asset: { assetId: "pause-boundary-pcm", revision: 1, sha256: "a".repeat(64) },
          loop: false,
          startOffsetSeconds: 0.59,
        },
      }),
      frame("fade-shot"),
    );
    const future = voice("pause-future", {
      emissionTimeSeconds: 2,
      generator: {
        kind: "sample",
        asset: { assetId: "pause-boundary-pcm", revision: 1, sha256: "a".repeat(64) },
        loop: true,
        startOffsetSeconds: 0,
      },
    });
    engine.playVoice(future, frame("pause-future"));
    const originals = [...context.sources()];
    const shotCarrier = originals[1]!;
    const futureCarrier = originals[2]!;
    assert.equal(futureCarrier.starts[0]!.when, 2);
    context.suspend = async () => {
      context.currentTime = actualSuspendAudioTime;
      // Explicitly deliver the native event for a sample exhausted within the
      // fade advance. This is not a new recorded physics/behavior event.
      shotCarrier.finish();
      shotCarrier.finish();
      await suspend();
    };
    context.currentTime = 0.4;
    await engine.pause(0.4);
    assert.equal(ended.filter((id) => id === "fade-shot").length, 1);
    assert.equal(engine.getVoiceCursorState("fade-shot", 0.4), null);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 2);
    assert.equal(
      futureCarrier.starts[0]!.when,
      2,
      "pause keeps an already scheduled carrier's native deadline",
    );
    await engine.resume(0.4);
    assert.deepEqual(
      context.sources(),
      originals,
      "resume neither replays the exhausted shot nor recreates the future source",
    );
    assert.equal(engine.playVoice(future, frame("pause-future")).reason, "ALREADY_PLAYING");
    context.currentTime = 2.1;
    engine.serviceNativeVoices();
    const simulationAtCurrentAudioTime = 0.4 + context.currentTime - actualSuspendAudioTime;
    close(
      engine.getVoiceCursorState("pause-future", simulationAtCurrentAudioTime)!.cursor
        .playheadSeconds,
      0.1,
    );
    assert.equal(futureCarrier.starts.length, 1);
    assert.equal(futureCarrier.starts[0]!.when, 2);
    assert.deepEqual(futureCarrier.stops, []);
    assert.equal(shotCarrier.starts.length, 1);
    assert.equal(shotCarrier.onended, null);
    shotCarrier.finish();
    assert.equal(ended.filter((id) => id === "fade-shot").length, 1);
    assert.deepEqual(context.sources(), originals);
  } finally {
    context.suspend = suspend;
    engine.dispose();
  }
});

test("resource virtualization can retain an explicit nativeReference content selection", async () => {
  const context = new CarrierContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeReference",
    budget: { maxVoices: 1 },
    virtualization: {
      maxNativeVoices: 1,
      maxNativeGraphs: 1,
      maxNativeCarriers: 8,
      maxVirtualVoices: 2,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    },
  });
  try {
    await engine.enable(0);
    engine.playVoice(voice("native-content-a"), frame("native-content-a"));
    const admission = engine.playVoice(voice("native-content-b"), frame("native-content-b"));
    assert.equal(admission.reason, "VIRTUALIZED");
    assert.equal(context.sources().length, 2);
    assert.equal(context.periodicWaveCreates, 0);
    assert.equal(engine.getNativeResourceSnapshot().mode, "nativeCarrierRoutes");
  } finally {
    engine.dispose();
  }
});
