import assert from "node:assert/strict";
import test from "node:test";
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import { SOLVER_VERSION } from "../../src/acoustics/index.js";
import {
  compareRecordings,
  computeRecordingMetrics,
  verifyRecording,
} from "../../src/experiments/index.js";
import type { ExperimentRecorderOptions, RecordingArtifact } from "../../src/experiments/types.js";
import type { ToolRequest } from "../../src/ai/types.js";

// Two fixed bodies, one continuous oscillator, one finite floor. No fabricated
// events, no patched hashes, and no manually constructed RecordingArtifact.
// ExperimentToolHost uses the real ExperimentRecorder for its six solver ticks.
function configuration(reflectionEnergy = 0.8): ExperimentRecorderOptions {
  const scene = createDefaultScene();
  scene.objects = scene.objects.filter((object) => ["floor", "speaker"].includes(object.id));
  scene.objects.find((object) => object.id === "speaker")!.positionM = [0, 1.5, -1];
  scene.listener.positionM = [0, 1.5, 4];
  // Binary-exact bottom/height keep the actual Rapier top plane exactly y=0.
  const floorBody = scene.objects.find((object) => object.id === "floor")!;
  floorBody.positionM[1] = -0.125;
  floorBody.dimensionsM[1] = 0.25;
  const behavior = createDefaultBehaviors(scene);
  const materials = structuredClone(DEFAULT_MATERIALS);
  const floor = materials.find((material) => material.id === "material.wood")!;
  floor.bands = floor.bands.map((band) => ({
    ...band,
    absorptionEnergy: 1 - reflectionEnergy,
    reflectionEnergy,
    transmissionEnergy: 0,
    scatteringFraction: 0,
  }));
  return {
    runId: "run.ab-edge-fixture",
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: behavior,
    generatorConfig: behavior.profiles.map((profile) =>
      profile.rules.map((rule) => rule.generator),
    ),
    solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
    materialRegistry: materials,
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
      dataClass: "Synthetic",
    },
    physicsVersion: "rapier-0.21.0",
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}
async function captured(config = configuration(), original?: RecordingArtifact) {
  const host = new ExperimentToolHost({
    getConfiguration: () => config,
    getAssets: () => [],
    getRecording: (runId) => (original?.runId === runId ? original : null),
  });
  const request: ToolRequest = {
    schemaVersion: "1.0.0",
    requestId: original ? "request.ab-edge-candidate" : "request.ab-edge-baseline",
    tool: "RunSimulation",
    sceneId: config.sceneSnapshot.sceneId,
    expectedSceneRevision: config.sceneSnapshot.sceneRevision,
    transactionId: null,
    arguments: {
      backendId: "custom-web-geometric",
      durationS: 0.1,
      timeStepS: 1 / 60,
      seed: config.sceneSnapshot.seed,
      replayTraceId: original?.runId ?? null,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  };
  const result = await host.execute(request);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const recording = host.getRun(result.runId!)!;
  await verifyRecording(recording);
  assert.equal(recording.status, "captured");
  return recording;
}
let original: Promise<RecordingArtifact> | undefined;
const baseline = () => (original ??= captured());
const compareOptions = {
  kind: "acoustic" as const,
  independentVariables: ["acousticMaterial" as const],
};

// The literal zero follows from an actually empty contact-event history. The
// expected unavailable-percent token is the public result contract, not a
// recomputation of the implementation's division/branching algorithm.
test("AB edge: genuine zero-impact self comparison preserves raw zero and delta while refusing a percentage", async (t) => {
  const a = await baseline(),
    originalHash = a.artifactSha256;
  assert.equal(a.startTick, 0);
  assert.equal(a.endTick, 6);
  assert.equal(a.frames.length, 7);
  assert.equal(a.frames.flatMap((frame) => frame.physicsEvents).length, 0);
  const result = await compareRecordings(a, a, compareOptions);
  assert.equal(result.matched, true, JSON.stringify(result.mismatches));
  assert.deepEqual(
    {
      runA: result.runA,
      runB: result.runB,
      kind: result.kind,
      variables: result.independentVariables,
    },
    { runA: a.runId, runB: a.runId, kind: "acoustic", variables: ["acousticMaterial"] },
  );
  const metric = result.metrics.find((entry) => entry.id === "impactCount")!;
  assert.deepEqual(
    {
      a: metric.a,
      b: metric.b,
      delta: metric.delta,
      percentDelta: metric.percentDelta,
      unit: metric.unit,
      reason: metric.reason,
    },
    {
      a: 0,
      b: 0,
      delta: 0,
      percentDelta: null,
      unit: "events",
      reason: "BASELINE_ZERO_PERCENT_UNAVAILABLE",
    },
  );
  t.diagnostic(
    JSON.stringify({ metric, runA: result.runA, runB: result.runB, artifactSha256: originalHash }),
  );
  assert.equal(Number.isNaN(metric.percentDelta), false);
  assert.equal(Number.isFinite(metric.delta), true);
  const duration = result.metrics.find((entry) => entry.id === "duration")!;
  assert.deepEqual(
    { a: duration.a, b: duration.b, delta: duration.delta, unit: duration.unit },
    { a: 0.1, b: 0.1, delta: 0, unit: "s" },
  );
  assert.equal(a.artifactSha256, originalHash);
  await verifyRecording(a);
});

// Independent geometry: direct distance 5m; finite floor image distance
// sqrt(5^2+3^2). With no air/scatter/transmission, summed pressure ratios squared
// are 1/25 + R/34, not rendered PCM energy, loudness or SPL.
test("AB edge: same-motion material comparison preserves literal raw ratios, candidate-minus-baseline delta and artifact scope", async (t) => {
  const a = await baseline(),
    originalHash = a.artifactSha256;
  const b = await captured(configuration(0.2), a),
    candidateHash = b.artifactSha256;
  assert.notEqual(a.runId, b.runId);
  assert.equal(a.fingerprints.motionTraceHash, b.fingerprints.motionTraceHash);
  assert.equal(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  const result = await compareRecordings(a, b, compareOptions);
  assert.equal(result.matched, true, JSON.stringify(result.mismatches));
  assert.equal(result.runA, a.runId);
  assert.equal(result.runB, b.runId);
  const metric = result.metrics.find((entry) => entry.id === "meanPathEnergy")!;
  t.diagnostic(
    JSON.stringify({
      metric,
      runA: result.runA,
      runB: result.runB,
      baselineSha256: originalHash,
      candidateSha256: candidateHash,
      actualFloor: a.frames[0]!.poses.find((pose) => pose.objectId === "floor"),
    }),
  );
  for (const recording of [a, b]) {
    const reflections = recording.frames
      .flatMap((frame) => frame.acousticFrames ?? [])
      .flatMap((frame) => frame.paths)
      .filter((path) => path.order === 1);
    assert.ok(
      reflections.length > 0,
      "actual solver artifacts must contain finite-floor reflections",
    );
    for (const path of reflections)
      assert.ok(
        path.verticesM[1]![1] === 0,
        "actual reflected bounce must lie on the independently specified y=0 floor plane",
      );
  }
  const expectedA = 1 / 25 + 0.8 / 34;
  const expectedB = 1 / 25 + 0.2 / 34;
  const expectedDelta = -0.6 / 34;
  assert.ok(Math.abs(metric.a! - expectedA) < 1e-12);
  assert.ok(Math.abs(metric.b! - expectedB) < 1e-12);
  assert.ok(Math.abs(metric.delta! - expectedDelta) < 1e-12);
  assert.equal(metric.unit, "ratio");
  assert.equal(metric.reason, null);
  assert.equal(metric.population?.compatible, true);
  assert.deepEqual(metric.population?.a.window, { startTick: 0, endTick: 6, fixedDtS: 1 / 60 });
  assert.match(
    metric.method!,
    /excludes authored gain, pitch, waveform and PCM; not rendered energy or SPL/,
  );
  assert.equal(
    computeRecordingMetrics(a).find((entry) => entry.id === "meanPathEnergy")!.evidenceClass,
    "Computed",
  );
  assert.equal(result.metrics.find((entry) => entry.id === "rt60")!.delta, null);
  assert.equal(a.artifactSha256, originalHash);
  assert.equal(b.artifactSha256, candidateHash);
  await Promise.all([verifyRecording(a), verifyRecording(b)]);
});
