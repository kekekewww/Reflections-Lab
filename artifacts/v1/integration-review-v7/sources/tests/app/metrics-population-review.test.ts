import test from "node:test";
import assert from "node:assert/strict";
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import {
  createDefaultBehaviors,
  createDefaultScene,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import { solveAcoustics, SOLVER_VERSION } from "../../src/acoustics/index.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import type { BehaviorSnapshot } from "../../src/audio-behavior/types.js";
import {
  compareRecordings,
  computeRecordingMetrics,
  ExperimentRecorder,
  recordingFingerprints,
  sha256Canonical,
  verifyRecording,
} from "../../src/experiments/index.js";
import type { ExperimentRecorderOptions, RecordingArtifact } from "../../src/experiments/types.js";
import type { ToolRequest } from "../../src/ai/types.js";

function configuration(): ExperimentRecorderOptions {
  const scene = createDefaultScene();
  // Binary-exact coordinates isolate estimator errors from Rapier Float32
  // quantization: the authored and captured direct distance is exactly 5 m.
  scene.objects.find((object) => object.id === "speaker")!.positionM = [0, 1.5, -1];
  scene.listener.positionM = [0, 1.5, 4];
  const behavior = createDefaultBehaviors(scene);
  return {
    runId: "run.population-host",
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: behavior,
    generatorConfig: behavior.profiles.map((profile) =>
      profile.rules.map((rule) => rule.generator),
    ),
    solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
    materialRegistry: DEFAULT_MATERIALS,
    atmosphere: { medium: "air", speedOfSoundMps: 343, temperatureC: 20, dataClass: "Synthetic" },
    physicsVersion: "rapier-0.21.0",
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}
async function baseline(durationS = 0.1): Promise<RecordingArtifact> {
  const config = configuration();
  const host = new ExperimentToolHost({ getConfiguration: () => config, getAssets: () => [] });
  const request: ToolRequest = {
    schemaVersion: "1.0.0",
    requestId: "request.population-baseline",
    tool: "RunSimulation",
    sceneId: config.sceneSnapshot.sceneId,
    expectedSceneRevision: config.sceneSnapshot.sceneRevision,
    transactionId: null,
    arguments: {
      backendId: "custom-web-geometric",
      durationS,
      timeStepS: 1 / 60,
      seed: config.sceneSnapshot.seed,
      replayTraceId: null,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  };
  const result = await host.execute(request);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  return host.getRun(result.runId!)!;
}

test("independent metrics population: a retired-source diagnostic route cannot alter a playing-source average or paired delta", async () => {
  // The falling ball genuinely triggers, plays and stops an impact voice. A
  // retains its actual stop-route diagnostics; B is separately reprocessed.
  const a = await baseline(1.2),
    originalSha = a.artifactSha256,
    config = configuration();
  const host = new ExperimentToolHost({
    getConfiguration: () => config,
    getAssets: () => [],
    getRecording: (runId) => (runId === a.runId ? a : null),
  });
  const replayed = await host.execute({
    schemaVersion: "1.0.0",
    requestId: "request.population-stop-replay",
    tool: "RunSimulation",
    sceneId: config.sceneSnapshot.sceneId,
    expectedSceneRevision: config.sceneSnapshot.sceneRevision,
    transactionId: null,
    arguments: {
      backendId: "custom-web-geometric",
      durationS: 1.2,
      timeStepS: 1 / 60,
      seed: config.sceneSnapshot.seed,
      replayTraceId: a.runId,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  });
  assert.equal(replayed.state, "succeeded", JSON.stringify(replayed.error));
  const b = host.getRun(replayed.runId!)!;
  await Promise.all([verifyRecording(a), verifyRecording(b)]);
  const rawCount = (recording: RecordingArtifact) =>
    recording.frames.reduce((sum, frame) => sum + frame.acousticFrames.length, 0);
  assert.ok(
    rawCount(a) > rawCount(b),
    "the immutable original keeps actual stop diagnostics while reprocessing records playing sources",
  );
  const rawDelays = a.frames.flatMap((frame) =>
    frame.acousticFrames.flatMap((acoustic) =>
      acoustic.paths.filter((path) => path.order === 0).map((path) => path.absoluteDelayS),
    ),
  );
  const rawMean = rawDelays.reduce((sum, delay) => sum + delay, 0) / rawDelays.length;
  const left = computeRecordingMetrics(a),
    right = computeRecordingMetrics(b);
  const directA = left.find((metric) => metric.id === "meanDirectDelay")!,
    directB = right.find((metric) => metric.id === "meanDirectDelay")!;
  assert.ok(
    Math.abs(rawMean - directA.value!) > 1e-7,
    "the retained diagnostic route would materially bias the old all-route estimator",
  );
  assert.equal(directB.value, directA.value);
  assert.equal(directA.population!.kind, "logicalPlayingSourceQueries");
  assert.equal(directA.population!.sampleCount, directB.population!.sampleCount);
  assert.ok(
    directA.population!.sampleCount > a.frameCount,
    "the genuinely playing one-shot also contributes samples",
  );
  assert.ok(directA.population!.excludedNonPlayingQueryCount > 0);
  assert.equal(directB.population!.excludedNonPlayingQueryCount, 0);
  assert.equal(
    right.find((metric) => metric.id === "meanPathEnergy")!.value,
    left.find((metric) => metric.id === "meanPathEnergy")!.value,
  );
  const comparison = await compareRecordings(a, b, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(comparison.matched, true, JSON.stringify(comparison.mismatches));
  assert.equal(comparison.metrics.find((metric) => metric.id === "meanDirectDelay")!.delta, 0);
  assert.equal(comparison.metrics.find((metric) => metric.id === "meanPathEnergy")!.delta, 0);
  assert.equal(comparison.metrics.find((metric) => metric.id === "rt60")!.delta, null);
  assert.equal(
    a.artifactSha256,
    originalSha,
    "the source recording is never rewritten to manufacture a zero delta",
  );
});

test("independent metrics population: a material-only candidate preserves literal direct timing and changes only computed reflected pressure ratios", async () => {
  const a = await baseline(),
    config = configuration();
  for (const object of config.sceneSnapshot.objects)
    if (object.acousticRole === "staticSurface") object.acousticMaterialId = "material.soft";
  const host = new ExperimentToolHost({
    getConfiguration: () => config,
    getAssets: () => [],
    getRecording: (runId) => (runId === a.runId ? a : null),
  });
  const result = await host.execute({
    schemaVersion: "1.0.0",
    requestId: "request.population-material",
    tool: "RunSimulation",
    sceneId: config.sceneSnapshot.sceneId,
    expectedSceneRevision: config.sceneSnapshot.sceneRevision,
    transactionId: null,
    arguments: {
      backendId: "custom-web-geometric",
      durationS: 0.1,
      timeStepS: 1 / 60,
      seed: config.sceneSnapshot.seed,
      replayTraceId: a.runId,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  });
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const b = host.getRun(result.runId!)!;
  assert.equal(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  assert.equal(a.fingerprints.motionTraceHash, b.fingerprints.motionTraceHash);
  const left = computeRecordingMetrics(a),
    right = computeRecordingMetrics(b);
  const expectedSeconds = 5 / 343;
  assert.ok(
    Math.abs(left.find((metric) => metric.id === "meanDirectDelay")!.value! - expectedSeconds) <
      1e-12,
  );
  assert.ok(
    Math.abs(right.find((metric) => metric.id === "meanDirectDelay")!.value! - expectedSeconds) <
      1e-12,
  );
  const energyA = left.find((metric) => metric.id === "meanPathEnergy")!,
    energyB = right.find((metric) => metric.id === "meanPathEnergy")!;
  assert.equal(energyA.unit, "ratio");
  assert.equal(energyB.unit, "ratio");
  assert.ok(
    energyB.value! < energyA.value!,
    "less reflected pressure-ratio squared is a geometric result, not rendered energy, loudness or RT60",
  );
  const comparison = await compareRecordings(a, b, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(comparison.matched, true, JSON.stringify(comparison.mismatches));
  assert.equal(comparison.metrics.find((metric) => metric.id === "meanDirectDelay")!.delta, 0);
  assert.equal(comparison.metrics.find((metric) => metric.id === "rt60")!.delta, null);
});

test("independent metrics population: equal numeric averages with a missing playing-source query are not a paired comparison", async () => {
  const a = await baseline();
  const recorder = new ExperimentRecorder({
    ...a.configuration,
    runId: "run.population-missing-query",
    runEpoch: a.runEpoch,
  });
  for (const [index, frame] of a.frames.entries())
    recorder.appendFrame(
      index === 2 ? { ...frame, acousticFrames: [], acousticResultRefs: [] } : frame,
    );
  const b = await recorder.finish();
  const metricA = computeRecordingMetrics(a).find((metric) => metric.id === "meanDirectDelay")!,
    metricB = computeRecordingMetrics(b).find((metric) => metric.id === "meanDirectDelay")!;
  assert.ok(
    Math.abs(metricA.value! - metricB.value!) < 1e-15,
    "numeric equality alone is not evidence of matching sample support",
  );
  assert.equal(metricA.population!.kind, "logicalPlayingSourceQueries");
  assert.equal(metricB.population!.kind, "logicalPlayingSourceQueries");
  assert.equal(metricA.population!.sampleCount, a.frameCount);
  assert.equal(metricB.population!.sampleCount, b.frameCount - 1);
  assert.equal(a.fingerprints.motionTraceHash, b.fingerprints.motionTraceHash);
  assert.equal(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  const comparison = await compareRecordings(a, b, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(
    comparison.matched,
    true,
    "matching run/source conditions remain independent of an unavailable paired metric",
  );
  const direct = comparison.metrics.find((metric) => metric.id === "meanDirectDelay")!;
  assert.equal(direct.population!.compatible, false);
  assert.equal(direct.delta, null);
  assert.equal(direct.reason, "INCOMPATIBLE_METRIC_POPULATION");
  assert.equal(comparison.metrics.find((metric) => metric.id === "meanPathEnergy")!.delta, null);
  assert.equal(comparison.metrics.find((metric) => metric.id === "duration")!.delta, 0);
  assert.equal(comparison.metrics.find((metric) => metric.id === "impactCount")!.delta, 0);
});

test("independent metrics population: a genuine legacy geometric-query estimator is qualified and cannot silently match logical playing-source support", async () => {
  const a = await baseline();
  const recorder = new ExperimentRecorder({
    ...a.configuration,
    runId: "run.population-legacy",
    runEpoch: a.runEpoch,
  });
  for (const frame of a.frames) {
    const { behaviorSnapshot: _behaviorSnapshot, ...withoutState } = frame;
    recorder.appendFrame(withoutState);
  }
  const current = await recorder.finish();
  const {
    artifactSha256: _artifactSha256,
    fingerprintVersion: _fingerprintVersion,
    sourcePhaseEvidence: _sourcePhaseEvidence,
    ...body
  } = structuredClone(current);
  body.fingerprints = await recordingFingerprints(body.configuration, body.frames, body.runId);
  // Encode the real supported legacy fingerprint convention, rather than
  // changing a frozen historical artifact or treating an unverified hash as proof.
  const legacy: RecordingArtifact = { ...body, artifactSha256: await sha256Canonical(body) };
  await verifyRecording(legacy);
  const logical = computeRecordingMetrics(a).find((metric) => metric.id === "meanDirectDelay")!,
    geometric = computeRecordingMetrics(legacy).find((metric) => metric.id === "meanDirectDelay")!;
  assert.equal(logical.population!.kind, "logicalPlayingSourceQueries");
  assert.equal(geometric.population!.kind, "capturedGeometricQueries");
  assert.equal(geometric.population!.missingEligibilityFrameCount, legacy.frameCount);
  assert.notEqual(
    logical.method,
    geometric.method,
    "the geometric fallback must retain a different estimator identity",
  );
  assert.equal(geometric.unit, "s");
  const comparison = await compareRecordings(a, legacy, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(comparison.matched, false);
  assert.equal(
    comparison.metrics.find((metric) => metric.id === "meanDirectDelay")!.population!.compatible,
    false,
  );
  assert.ok(comparison.metrics.every((metric) => metric.delta === null));
});

test("independent metrics population: conflicting duplicate queries for one tick and source are excluded together", async () => {
  const a = await baseline();
  const recorder = new ExperimentRecorder({
    ...a.configuration,
    runId: "run.population-duplicate",
    runEpoch: a.runEpoch,
  });
  for (const [index, frame] of a.frames.entries()) {
    if (index !== 1) {
      recorder.appendFrame(frame);
      continue;
    }
    assert.equal(frame.acousticFrames.length, 1);
    const conflicting = solveAcoustics({
      requestId: "query.conflicting-playing-source",
      sceneRevision: frame.sceneRevision,
      geometryRevision: frame.sceneRevision,
      poseTick: frame.tick,
      source: {
        id: frame.acousticFrames[0]!.sourceId,
        positionM: [
          frame.listener.positionM[0] + 34.3,
          frame.listener.positionM[1],
          frame.listener.positionM[2],
        ],
      },
      listener: { id: frame.listener.id, positionM: frame.listener.positionM },
      surfaces: [],
      materials: DEFAULT_MATERIALS,
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
    }).frame;
    recorder.appendFrame({
      ...frame,
      acousticFrames: [...frame.acousticFrames, conflicting],
      acousticResultRefs: [...frame.acousticResultRefs, conflicting.requestId],
    });
  }
  const b = await recorder.finish();
  await verifyRecording(b);
  const metric = computeRecordingMetrics(b).find((value) => value.id === "meanDirectDelay")!;
  assert.equal(
    metric.population!.sampleCount,
    a.frameCount - 1,
    "neither array order nor duplicate weighting can choose the source position for an ambiguous tick",
  );
  assert.equal(metric.population!.invalidAcousticQueryCount, 2);
  assert.ok(Math.abs(metric.value! - 5 / 343) < 1e-12);
  const comparison = await compareRecordings(a, b, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(comparison.matched, true);
  assert.equal(comparison.metrics.find((value) => value.id === "meanDirectDelay")!.delta, null);
  assert.equal(
    comparison.metrics.find((value) => value.id === "meanDirectDelay")!.reason,
    "INCOMPATIBLE_METRIC_POPULATION",
  );
});

test("independent metrics population: AI comparison cannot convert an unavailable paired metric into a numeric delta", async () => {
  const a = await baseline();
  const recorder = new ExperimentRecorder({
    ...a.configuration,
    runId: "run.population-ai-missing",
    runEpoch: a.runEpoch,
  });
  for (const [index, frame] of a.frames.entries())
    recorder.appendFrame(
      index === 2 ? { ...frame, acousticFrames: [], acousticResultRefs: [] } : frame,
    );
  const b = await recorder.finish(),
    config = configuration();
  const recordings = new Map([
    [a.runId, a],
    [b.runId, b],
  ]);
  const host = new ExperimentToolHost({
    getConfiguration: () => config,
    getAssets: () => [],
    getRecording: (runId) => recordings.get(runId) ?? null,
  });
  const request = (
    requestId: string,
    tool: ToolRequest["tool"],
    args: Record<string, unknown>,
  ): ToolRequest => ({
    schemaVersion: "1.0.0",
    requestId,
    tool,
    sceneId: config.sceneSnapshot.sceneId,
    expectedSceneRevision: config.sceneSnapshot.sceneRevision,
    transactionId: null,
    arguments: args,
  });
  const captureA = await host.execute(
      request("request.population-cap-a", "CaptureExperiment", { runId: a.runId, label: "A" }),
    ),
    captureB = await host.execute(
      request("request.population-cap-b", "CaptureExperiment", { runId: b.runId, label: "B" }),
    );
  assert.equal(captureA.state, "succeeded");
  assert.equal(captureB.state, "succeeded");
  const compared = await host.execute(
    request("request.population-ai-compare", "CompareExperiments", {
      baselineExperimentId: captureA.artifactIds[0],
      candidateExperimentId: captureB.artifactIds[0],
      metrics: ["directArrivalTimeS"],
      requireMatchedMotionTrace: true,
    }),
  );
  assert.equal(compared.state, "succeeded", JSON.stringify(compared.error));
  assert.ok(
    compared.metrics.every(
      (metric) => metric.value !== null && metric.availability === "available",
    ),
    "absolute computed values remain distinct from paired deltas",
  );
  const artifact = host.getArtifact(compared.artifactIds[0]!)!;
  const pairs = (
    artifact.data as {
      pairs: { a: number | null; b: number | null; delta: number | null; reason: string | null }[];
    }
  ).pairs;
  assert.equal(pairs.length, 6);
  assert.ok(
    pairs.every(
      (pair) =>
        pair.a !== null &&
        pair.b !== null &&
        pair.delta === null &&
        pair.reason === "INCOMPATIBLE_METRIC_POPULATION",
    ),
  );
});

test("independent metrics population: different frequency grids cannot be compared as the same mean-band pressure ratio", async () => {
  const a = await baseline();
  const recorder = new ExperimentRecorder({
    ...a.configuration,
    runId: "run.population-band-grid",
    runEpoch: a.runEpoch,
  });
  for (const frame of a.frames) {
    const snapshot = (frame.behaviorSnapshot as { runtimeSnapshot: BehaviorSnapshot })
      .runtimeSnapshot;
    const queries = buildAcousticRequests({
      scene: a.configuration.sceneSnapshot,
      poses: frame.poses,
      sources: snapshot.state.instances
        .filter((instance) => instance.playbackState === "playing")
        .map((instance) => ({
          id: instance.instanceId,
          objectId: instance.objectId,
          positionM: instance.positionMetres,
        })),
      listener: frame.listener,
      tick: frame.tick,
      materials: DEFAULT_MATERIALS,
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
    });
    const acousticFrames = queries.map(
      (query) =>
        solveAcoustics({
          ...query,
          bandCentersHz: [1000],
          materials: query.materials.map((material) => ({
            ...material,
            bands: material.bands.filter((band) => band.centerHz === 1000),
          })),
        }).frame,
    );
    recorder.appendFrame({
      ...frame,
      acousticFrames,
      acousticResultRefs: acousticFrames.map((query) => query.requestId),
    });
  }
  const b = await recorder.finish();
  await verifyRecording(b);
  assert.equal(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  assert.ok(a.frames[0]!.acousticFrames[0]!.bandCentersHz.length > 1);
  assert.deepEqual(b.frames[0]!.acousticFrames[0]!.bandCentersHz, [1000]);
  const comparison = await compareRecordings(a, b, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(comparison.matched, true);
  assert.equal(
    comparison.metrics.find((metric) => metric.id === "meanDirectDelay")!.delta,
    0,
    "frequency-independent geometric timing retains matching support",
  );
  const energy = comparison.metrics.find((metric) => metric.id === "meanPathEnergy")!;
  assert.ok(
    energy.a !== null && energy.b !== null,
    "each absolute geometric coefficient estimate remains valid",
  );
  assert.equal(
    energy.population!.compatible,
    false,
    "one frequency and an equally weighted multi-band mean are different estimands",
  );
  assert.equal(energy.delta, null);
  assert.equal(energy.reason, "INCOMPATIBLE_METRIC_POPULATION");
});
