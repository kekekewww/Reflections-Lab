import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadValidators, validateRepositoryExamples } from "../../scripts/validation/schemas.mjs";
import {
  sceneDomainErrors,
  materialDomainErrors,
  acousticFrameDomainErrors,
  experimentDomainErrors,
} from "../../scripts/validation/domain-checks.mjs";

const validators = loadValidators();
const validate = (name, value, expected = true) => {
  const check = validators.get(`${name}.schema.json`);
  assert.equal(check(value), expected, `${name}: ${JSON.stringify(check.errors)}`);
};
const example = (name) => JSON.parse(readFileSync(`schemas/examples/${name}.json`, "utf8"));
const request = (tool, args, transactionId = "tx-1") => ({
  schemaVersion: "1.0.0",
  requestId: "req-1",
  tool,
  sceneId: "room-1",
  expectedSceneRevision: 0,
  transactionId,
  arguments: args,
});
const args = {
  CreateScene: {
    label: "測試",
    roomDimensionsM: [8, 3, 6],
    surfaceMaterialId: "concrete",
    seed: 42,
  },
  AddObject: {
    objectId: "ball",
    label: "球",
    shape: "sphere",
    dimensionsM: [0.2, 0.2, 0.2],
    positionM: [0, 1, 0],
    orientationQuaternion: [0, 0, 0, 1],
    materialId: "steel",
    mode: "dynamicGravity",
    massKg: 1,
  },
  SetMaterial: {
    objectId: "ball",
    materialId: "steel",
    materialRegistryRevision: 0,
    scope: "both",
  },
  SetRigidBodyMode: { objectId: "ball", mode: "fixed", velocityPolicy: "zero" },
  ConfigureSoundSource: {
    sourceId: "source",
    objectId: "ball",
    signalId: "sine-440",
    mode: "continuous",
    gainDbfs: -20,
    referenceFrequencyHz: 440,
  },
  MoveListener: {
    listenerId: "listener",
    positionM: [0, 1.6, 0],
    orientationQuaternion: [0, 0, 0, 1],
  },
  SetTrajectory: {
    objectId: "ball",
    interpolation: "linearSlerp",
    samples: [
      { timeS: 0, positionM: [0, 1, 0], orientationQuaternion: [0, 0, 0, 1] },
      { timeS: 1, positionM: [1, 1, 0], orientationQuaternion: [0, 0, 0, 1] },
    ],
  },
  RunSimulation: {
    backendId: "analytic",
    durationS: 1,
    timeStepS: 1 / 60,
    seed: 42,
    replayTraceId: null,
    maxReflectionOrder: 1,
    sampleRateHz: 48000,
  },
  CaptureExperiment: { runId: "run-1", label: "合成" },
  AnalyzeAcousticResults: {
    runId: "run-1",
    metrics: ["directArrivalTimeS"],
    bandCentersHz: [1000],
  },
  CompareExperiments: {
    baselineExperimentId: "exp-a",
    candidateExperimentId: "exp-b",
    metrics: ["directArrivalTimeS"],
    requireMatchedMotionTrace: true,
  },
  PreviewSceneChanges: { includeCollisionCheck: true, includeAcousticCostEstimate: true },
};
test("repository Draft2020-12 schemas compile and product synthetic examples pass", () => {
  for (const schema of [
    "scene",
    "material",
    "acoustic-frame",
    "experiment",
    "ai-tool-request",
    "ai-tool-result",
    "ai-scene-change-set",
    "ai-provider-config",
  ])
    assert.equal(typeof validators.get(`${schema}.schema.json`), "function");
  assert.equal(validateRepositoryExamples(validators).length, 3);
});
test("scene schema rejects unknown property, negative mass and oversized budgets", () => {
  const unknown = example("scene");
  unknown.secret = "disallowed";
  validate("scene", unknown, false);
  const mass = example("scene");
  mass.objects[0].massKg = -1;
  validate("scene", mass, false);
  const many = example("scene");
  many.objects = Array.from({ length: 257 }, () => many.objects[0]);
  validate("scene", many, false);
});
test("test-only scene domain rejects zero quaternion, duplicate IDs and dangling object", () => {
  const quaternion = example("scene");
  quaternion.objects[0].orientationQuaternion = [0, 0, 0, 0];
  validate("scene", quaternion);
  assert.ok(sceneDomainErrors(quaternion).some((e) => e.includes("quaternion")));
  const refs = example("scene");
  refs.sources[0].objectId = "absent";
  assert.ok(sceneDomainErrors(refs).some((e) => e.includes("reference")));
  const duplicate = example("scene");
  duplicate.objects.push(duplicate.objects[0]);
  assert.ok(sceneDomainErrors(duplicate).some((e) => e.includes("duplicate")));
  const sphere = example("scene");
  sphere.objects[0].dimensionsM = [1, 2, 1];
  assert.ok(sceneDomainErrors(sphere).some((e) => e.includes("sphere")));
});
test("test-only material domain rejects nonconservation and unordered bands", () => {
  const material = example("material");
  material.bands[0].reflectionEnergy = 0.9;
  validate("material", material);
  assert.ok(materialDomainErrors(material).some((e) => e.includes("A+R+T")));
  material.bands[0].reflectionEnergy = 0.7;
  material.bands.push(material.bands[0]);
  assert.ok(materialDomainErrors(material).some((e) => e.includes("increasing")));
});
test("test-only backend domain rejects unsupported individual reflection paths", () => {
  const frame = example("acoustic-frame");
  frame.pathAvailability = "available";
  validate("acoustic-frame", frame);
  assert.ok(acousticFrameDomainErrors(frame).some((e) => e.includes("unsupported")));
});
test("nonempty analytical frame has unambiguous pair, pressure bands, arrival and delays", () => {
  const frame = JSON.parse(readFileSync("tests/fixtures/acoustic-frame-nonempty.json", "utf8"));
  validate("acoustic-frame", frame);
  assert.deepEqual(acousticFrameDomainErrors(frame), []);
  const path = frame.paths[0];
  const length = path.verticesM
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + Math.hypot(...point.map((value, axis) => value - path.verticesM[index][axis])),
      0,
    );
  assert.ok(Math.abs(length - Math.sqrt(20)) < 1e-12);
  assert.ok(Math.abs(path.lengthM - length) < 1e-12);
  assert.ok(Math.abs(path.absoluteDelayS - length / 343) < 1e-12);
  assert.ok(Math.abs(path.bandGains[0] - Math.sqrt(0.7) / length) < 1e-12);
  const mismatched = structuredClone(frame);
  mismatched.paths[0].sourceId = "other-source";
  validate("acoustic-frame", mismatched);
  assert.ok(acousticFrameDomainErrors(mismatched).some((error) => error.includes("frame pair")));
  mismatched.paths[0].sourceId = frame.sourceId;
  mismatched.paths[0].listenerId = "other-listener";
  assert.ok(acousticFrameDomainErrors(mismatched).some((error) => error.includes("frame pair")));
  const bands = structuredClone(frame);
  bands.paths[0].bandGains = [0.1];
  validate("acoustic-frame", bands);
  assert.ok(acousticFrameDomainErrors(bands).some((error) => error.includes("band gain count")));
  const unordered = structuredClone(frame);
  unordered.bandCentersHz = [1000, 500];
  assert.ok(acousticFrameDomainErrors(unordered).some((error) => error.includes("increasing")));
  const opposite = structuredClone(frame);
  opposite.paths[0].arrivalDirection = opposite.paths[0].arrivalDirection.map((value) => -value);
  validate("acoustic-frame", opposite);
  assert.ok(
    acousticFrameDomainErrors(opposite).some((error) => error.includes("toward last interaction")),
  );
  const duplicate = structuredClone(frame);
  duplicate.bandCentersHz = [500, 500];
  validate("acoustic-frame", duplicate, false);
  const wrongQuantity = structuredClone(frame);
  wrongQuantity.gainQuantity = "energyFraction";
  validate("acoustic-frame", wrongQuantity, false);
});
test("all twelve declared AI tools accept bounded synthetic requests", () => {
  const readOnly = new Set([
    "RunSimulation",
    "CaptureExperiment",
    "AnalyzeAcousticResults",
    "CompareExperiments",
  ]);
  for (const [tool, argument] of Object.entries(args))
    validate("ai-tool-request", request(tool, argument, readOnly.has(tool) ? null : "tx-1"));
});
test("AI request schema rejects invalid dimensions, mass, unknown fields/tools, transaction misuse", () => {
  validate(
    "ai-tool-request",
    request("CreateScene", { ...args.CreateScene, roomDimensionsM: [0, 3, 6] }),
    false,
  );
  validate("ai-tool-request", request("AddObject", { ...args.AddObject, massKg: -1 }), false);
  validate(
    "ai-tool-request",
    request("CreateScene", { ...args.CreateScene, secret: "disallowed" }),
    false,
  );
  validate("ai-tool-request", request("CreateScene", args.CreateScene, null), false);
  validate("ai-tool-request", request("RunSimulation", args.RunSimulation), false);
  validate("ai-tool-request", request("DeleteEverything", {}), false);
});
test("offline AI provider schema rejects network access and nonzero cost", () => {
  const config = {
    schemaVersion: "1.0.0",
    provider: "offlineFixture",
    networkEnabled: false,
    modelId: null,
    verificationStatus: "notRun",
    verifiedAt: null,
    verificationArtifactId: null,
    dataMode: "offline",
    capabilities: {
      functionTools: false,
      strictStructuredOutputs: false,
      imageInput: false,
      audioInput: false,
      videoInput: false,
    },
    budgets: {
      maxAgentTurns: 12,
      maxToolCalls: 48,
      maxConcurrentSimulations: 1,
      maxSimulations: 6,
      maxWallTimeMs: 120000,
      maxInputTokens: 32000,
      maxOutputTokens: 4000,
      maxEstimatedCostUsd: 0,
      maxRetries: 2,
    },
  };
  validate("ai-provider-config", config);
  validate("ai-provider-config", { ...config, networkEnabled: true }, false);
  validate(
    "ai-provider-config",
    { ...config, budgets: { ...config.budgets, maxEstimatedCostUsd: 0.1 } },
    false,
  );
  validate(
    "ai-provider-config",
    { ...config, provider: "metaModelApi", networkEnabled: true, modelId: "candidate" },
    false,
  );
});
test("AI result schema represents insufficient RIR decay as null with limitations", () => {
  const metric = {
    metricRecordId: "metric-1",
    metricId: "rt60S",
    bandCenterHz: 1000,
    value: null,
    unit: "s",
    availability: "insufficientDecay",
    provenance: "computed",
    evidenceArtifactId: "rir-1",
    runId: "run-1",
    methodId: "schroeder-t20",
    backendVersion: "synthetic-fixture-1",
    materialRevision: 0,
    validationLevel: "V1",
    limitations: ["合成不足衰減範圍"],
  };
  const result = {
    schemaVersion: "1.0.0",
    requestId: "req-1",
    state: "succeeded",
    runId: "run-1",
    sceneRevision: 0,
    artifactIds: ["rir-1"],
    metrics: [metric],
    error: null,
    usage: {
      wallTimeMs: 0,
      solverSteps: 0,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: 0,
      actualCostUsd: null,
    },
    explanation: null,
  };
  validate("ai-tool-result", result);
  validate("ai-tool-result", { ...result, metrics: [{ ...metric, value: 0.8 }] }, false);
  validate(
    "ai-tool-result",
    { ...result, metrics: [{ ...metric, availability: "available" }] },
    false,
  );
  validate(
    "ai-tool-result",
    { ...result, metrics: [{ ...metric, provenance: "ai_generated_explanation" }] },
    false,
  );
});
test("staged transaction requires snapshot/digests for applied state", () => {
  const staged = {
    schemaVersion: "1.0.0",
    transactionId: "tx-1",
    sceneId: "room-1",
    baseRevision: 0,
    status: "drafted",
    operations: [request("CreateScene", args.CreateScene)],
    beforeSnapshotId: null,
    previewDigest: null,
    approvedDigest: null,
    approvedBy: null,
    resultRevision: null,
    validationErrors: [],
  };
  validate("ai-scene-change-set", staged);
  validate("ai-scene-change-set", { ...staged, status: "applied" }, false);
});
test("synthetic experiment manifest hashes exact fixture bytes; domain rejects invalid UTC", () => {
  const digest = (text) => createHash("sha256").update(text).digest("hex");
  const experiment = {
    schemaVersion: "1.0.0",
    experimentId: "synthetic-exp-1",
    createdAt: "2026-10-26T00:00:00Z",
    sceneId: "scene-baseline",
    sceneRevision: 0,
    sceneSha256: digest(readFileSync("schemas/examples/scene.json")),
    motionTraceSha256: digest("synthetic-motion-empty-v1"),
    contactTraceSha256: null,
    materialRegistrySha256: digest(readFileSync("schemas/examples/material.json")),
    backendId: "synthetic-fixture",
    backendVersion: "1.0.0",
    physicsVersion: "not-run",
    solverSettings: {
      fixedDtS: 1 / 60,
      sampleRateHz: 48000,
      seed: 42,
      speedOfSoundMps: 343,
      temperatureC: 20,
      relativeHumidityPercent: 50,
      pressurePa: 101325,
      maxReflectionOrder: 1,
    },
    recordingMode: "syntheticFixture",
    resultArtifacts: [],
    validationLevel: "V0",
  };
  validate("experiment", experiment);
  assert.deepEqual(experimentDomainErrors(experiment), []);
  assert.ok(experimentDomainErrors({ ...experiment, createdAt: "invalidZ" }).length);
  validate("experiment", { ...experiment, sceneSha256: "fabricated" }, false);
});
