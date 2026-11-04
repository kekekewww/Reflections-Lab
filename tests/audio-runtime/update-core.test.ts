import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import { AudioDiagnostics } from "../../src/audio/diagnostics.js";
import { prepareRouteResponse } from "../../src/audio/route-response.js";
import { PathRoute } from "../../src/audio/routes.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext, type FakeAudioParam, type FakeNode } from "./fake-context.js";

const centers = [1000, 4000, 12000];
const a = [0.25, 0.5, 1];
const b = [1, 0.5, 0.25];
function frame(gains = a, poseTick = 1): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "update-core",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick,
    backendId: "literal-control-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: centers,
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.075,
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
          [0, 0, -1],
          [0, 0, 0],
        ],
        lengthM: 0.075 * 343,
        absoluteDelayS: 0.075,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: gains,
      },
    ],
  };
}
function fixture() {
  const context = new FakeAudioContext(),
    diagnostics = new AudioDiagnostics();
  const input = context.createGain(),
    output = context.createGain(),
    initial = frame();
  const route = new PathRoute(
    context.asContext(),
    input as unknown as AudioNode,
    output as unknown as AudioNode,
    initial,
    initial.paths[0]!,
    "equalpower",
    [0, 0, 0],
    false,
    0.02,
    diagnostics,
  );
  const update = (time: number, gains: number[]) => {
    context.currentTime = time;
    const next = frame(gains);
    route.update(next, next.paths[0]!, [0, 0, 0]);
  };
  return { context, diagnostics, route, update };
}

test("normalization splits pressure scale from exact spectral identity without retaining caller arrays", () => {
  const input = [...a];
  const first = prepareRouteResponse(centers, input, 48000);
  const scaled = prepareRouteResponse(
    centers,
    a.map((value) => value * 4),
    48000,
  );
  assert.equal(first.shapeKey, scaled.shapeKey);
  assert.equal(first.scale, 1);
  assert.equal(scaled.scale, 4);
  input[0] = 1;
  assert.deepEqual(first.bandGains, a);
  assert.notEqual(
    prepareRouteResponse(centers, [0.2500001, 0.5, 1], 48000).shapeKey,
    first.shapeKey,
  );
  assert.equal(
    prepareRouteResponse([1000], [0], 48000).shapeKey,
    prepareRouteResponse(centers, [0.5, 0.5, 0.5], 48000).shapeKey,
  );
  assert.throws(() => prepareRouteResponse(centers, [-1, 0, 1], 48000));
});

test("a scalar update during a real shape crossfade does not build or upload another FIR", () => {
  const f = fixture();
  try {
    f.update(0.1, b);
    f.update(
      0.105,
      b.map((value) => value * 2),
    );
    f.update(
      0.11,
      b.map((value) => value * 4),
    );
    assert.equal((f.route.gain.gain as unknown as FakeAudioParam).automation.at(-1)!.value, 4);
    const stats = f.diagnostics.snapshot().controlOperations;
    assert.equal(stats.shapeBuilds, 2);
    assert.equal(stats.shapeUploads, 2);
    f.context.currentTime = 0.125;
    f.route.flushControlUpdates();
    assert.deepEqual((f.route.delay as unknown as FakeNode).connections, [
      f.route.convolvers[1] as unknown as FakeNode,
    ]);
  } finally {
    f.route.disconnect();
  }
});

test("the final pending shape is applied by an explicit audio-clock checkpoint without another frame", () => {
  const f = fixture();
  try {
    f.update(0.1, b);
    f.update(0.11, a);
    assert.equal(f.diagnostics.snapshot().controlOperations.shapeUploads, 2);
    f.context.currentTime = 0.121;
    f.route.flushControlUpdates();
    assert.equal(f.diagnostics.snapshot().controlOperations.shapeUploads, 3);
    f.context.currentTime = 0.15;
    f.route.flushControlUpdates();
    assert.deepEqual((f.route.delay as unknown as FakeNode).connections, [
      f.route.convolvers[0] as unknown as FakeNode,
    ]);
  } finally {
    f.route.disconnect();
  }
});

test("disconnect cancels unsent shape work and does not resurrect a retired route", () => {
  const f = fixture();
  f.update(0.1, b);
  f.update(0.11, a);
  f.route.disconnect();
  f.context.currentTime = 1;
  f.route.flushControlUpdates();
  f.update(1, b);
  assert.equal(f.diagnostics.snapshot().controlOperations.shapeUploads, 2);
  assert.deepEqual((f.route.delay as unknown as FakeNode).connections, []);
});

test("frame consumer rejection, upstream batch rejection and native onset lateness remain separate", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  try {
    await engine.enable(0);
    engine.updateFrame(frame());
    engine.updateFrame({ ...frame(a, 0), stale: true });
    engine.updateFrame({ ...frame(), pathAvailability: "unsupported" });
    assert.throws(() => engine.updateFrame({ ...frame(), bandCentersHz: [] }));
    engine.recordAcousticDelivery({
      decision: "age-rejected",
      frameCount: 2,
      ageTicks: 4,
      elapsedMs: 0.25,
    });
    context.currentTime = 0.2;
    const voice: VoiceInput = {
      instanceId: "voice",
      sourceId: "source",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
      gainLinear: 0.1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0.02,
    };
    assert.equal(engine.playVoice(voice).accepted, true);
    const snapshot = engine.getDiagnostics();
    assert.equal(snapshot.frameDecisions.accepted, 1);
    assert.equal(snapshot.frameDecisions.stale, 1);
    assert.equal(snapshot.frameDecisions.unavailable, 1);
    assert.equal(snapshot.frameDecisions.invalid, 1);
    assert.equal(snapshot.onsets.lateCount, 1);
    assert.equal(snapshot.onsets.latenessMs.max, 200);
    assert.equal(snapshot.nativeOutput.deltaUnderrunEvents, null);
  } finally {
    engine.dispose();
  }
});

test("pre-master output taps require offline contexts and cannot silently change their signal mode", () => {
  const context = new FakeAudioContext();
  assert.throws(
    () => new AudioEngine({ context: context.asContext(), offlineOutputTap: "dryContent" }),
    (error: unknown) => (error as { code?: string }).code === "OFFLINE_OUTPUT_TAP_REQUIRES_OFFLINE",
  );
  Object.defineProperty(context, "startRendering", { value: async () => null });
  const engine = new AudioEngine({ context: context.asContext(), offlineOutputTap: "dryContent" });
  try {
    assert.equal(engine.getDiagnostics().outputTap, "dryContent");
    assert.equal(engine.getTelemetry().monitorMode, "raw");
    assert.throws(
      () => engine.setMonitorMode("simulated"),
      (error: unknown) => (error as { code?: string }).code === "OFFLINE_TAP_MODE_FIXED",
    );
  } finally {
    engine.dispose();
  }
});

test("disabling observation leaves the native graph running and does not poll the diagnostic clock", async () => {
  const context = new FakeAudioContext();
  let polls = 0,
    wallMs = 0;
  Object.defineProperty(context, "playbackStats", {
    value: { underrunEvents: 0, underrunDuration: 0 },
  });
  const engine = new AudioEngine({
    context: context.asContext(),
    diagnosticsEnabled: false,
    diagnosticsClockMs: () => {
      polls++;
      return wallMs;
    },
  });
  try {
    await engine.enable(0);
    engine.updateFrame(frame());
    engine.playVoice({
      instanceId: "observed-tone",
      sourceId: "source",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
      gainLinear: 0.1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0.02,
    });
    assert.equal(context.sources().length, 1);
    assert.equal(engine.getDiagnostics().enabled, false);
    assert.equal(engine.getDiagnostics().onsets.count, 0);
    assert.equal(engine.getTelemetry().outputUnderrunEvents, null);
    assert.equal(polls, 0);
    engine.setDiagnosticsEnabled(true);
    engine.updateFrame(frame(a, 2));
    assert.equal(engine.getDiagnostics().frameDecisions.accepted, 1);
    assert.equal(engine.getDiagnostics().nativeOutput.status, "WARMUP");
    wallMs = 500;
    assert.equal(engine.getDiagnostics().nativeOutput.status, "AVAILABLE");
    assert.equal(context.sources().length, 1);
    assert.equal(context.sources()[0]!.starts.length, 1);
  } finally {
    engine.dispose();
  }
});
