import test from "node:test";
import assert from "node:assert/strict";
import {
  ExperimentRecorder,
  MotionReplay,
  compareRecordings,
  computeRecordingMetrics,
} from "../../src/experiments/index.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import { solveAcoustics } from "../../src/acoustics/index.js";

function options(runId: string): ExperimentRecorderOptions {
  return {
    runId,
    runEpoch: "epoch.review",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    physicsVersion: "rapier-0.21.0",
    backendVersion: "review-1",
    sceneSnapshot: {
      schemaVersion: "1.0.0",
      sceneId: "scene.review",
      sceneRevision: 0,
      units: "SI",
      coordinateSystem: "right-handed-y-up-minus-z-forward",
      seed: 1,
      gravityMps2: [0, -9.81, 0],
      objects: [
        {
          id: "ball",
          shape: "sphere",
          dimensionsM: [1, 1, 1],
          positionM: [0, 1, 0],
          orientationQuaternion: [0, 0, 0, 1],
          mode: "dynamicGravity",
          massKg: 1,
          friction: 0.5,
          restitution: 0.5,
          physicsMaterialId: "metal",
          acousticMaterialId: "wall",
          acousticRole: "dynamicOccluder",
        },
      ],
      sources: [
        {
          id: "source.ball",
          objectId: "ball",
          signalId: "tone.sine",
          mode: "continuous",
          gainDbfs: -12,
          playing: true,
        },
      ],
      listener: {
        id: "listener",
        positionM: [0, 1, 3],
        orientationQuaternion: [0, 0, 0, 1],
        attachment: "independent",
      },
    },
    sourceConfig: { waveform: "sine" },
    behaviorConfig: { gain: 0.2 },
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [{ id: "wall", absorption: 0.3 }],
  };
}
function frame(acousticFrames: AcousticFrame[] = []): RecordingFrameInput {
  return {
    tick: 0,
    sceneRevision: 0,
    poses: [{ objectId: "ball", positionM: [0, 1, 0], orientationQuaternion: [0, 0, 0, 1] }],
    listener: { id: "listener", positionM: [0, 1, 3], orientationQuaternion: [0, 0, 0, 1] },
    physicsEvents: [],
    audioEvents: [],
    behaviorDecisions: [],
    acousticFrames,
  };
}
async function capture(input: ExperimentRecorderOptions, acousticFrames: AcousticFrame[] = []) {
  const recorder = new ExperimentRecorder(input);
  recorder.appendFrame(frame(acousticFrames));
  return recorder.finish();
}

test("review: caller overrides cannot hide changed scene mass or geometry in matched A/B", async () => {
  const left = options("run.left");
  left.physicsConfig = { advertised: "same" };
  left.geometrySnapshot = { advertised: "same" };
  const right = structuredClone(left);
  right.runId = "run.right";
  right.sceneSnapshot.objects[0]!.massKg = 20;
  right.sceneSnapshot.objects[0]!.dimensionsM = [2, 2, 2];
  const result = await compareRecordings(await capture(left), await capture(right), {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(
    result.matched,
    false,
    "scene-derived physics and geometry must remain authoritative",
  );
  assert(result.mismatches.some((m) => m.field === "physicsConfigHash"));
  assert(result.mismatches.some((m) => m.field === "sceneGeometryHash"));
});

test("review: noninteger reflection order cannot seal a schema-invalid Captured manifest", async () => {
  const input = options("run.fraction");
  input.solverConfig = { maxReflectionOrder: 1.5 };
  await assert.rejects(async () => {
    await capture(input);
  }, "manifest maxReflectionOrder is an integer in Experiment v1");
});

test("review: finite extreme gains cannot publish an infinite available metric", async () => {
  const acoustic: AcousticFrame = {
    schemaVersion: "1.0.0",
    requestId: "request.review",
    sceneRevision: 0,
    geometryRevision: 0,
    poseTick: 0,
    backendId: "custom-web-acoustic-core",
    backendVersion: "review-1",
    sourceId: "source.ball",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 3 / 343,
    paths: [
      {
        id: "path.review",
        sourceId: "source.ball",
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [0, 1, 0],
          [0, 1, 3],
        ],
        lengthM: 3,
        absoluteDelayS: 3 / 343,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: [1e308],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: [],
  };
  let captured;
  try {
    captured = await capture(options("run.extreme"), [acoustic]);
  } catch {
    return;
  } // A domain-range rejection is also valid.
  for (const metric of computeRecordingMetrics(captured)) {
    assert(
      metric.value === null || Number.isFinite(metric.value),
      `${metric.id} must be finite or unavailable`,
    );
  }
});

test("review: a new replay instance receives a fresh audio scheduling epoch", async () => {
  const artifact = await capture(options("run.repeat"));
  const first = await MotionReplay.create(artifact);
  const second = await MotionReplay.create(artifact);
  assert.notEqual(first.getState().runEpoch, second.getState().runEpoch);
});

test("review: manifest records the actual temperature-derived propagation speed", async () => {
  const input = options("run.temperature");
  input.atmosphere = { medium: "air", temperatureC: 40 };
  const solution = solveAcoustics({
    requestId: "request.temperature",
    sceneRevision: 0,
    geometryRevision: 0,
    poseTick: 0,
    source: { id: "source.ball", positionM: [0, 1, 0] },
    listener: { id: "listener", positionM: [0, 1, 3] },
    surfaces: [],
    materials: [],
    atmosphere: { medium: "air", temperatureC: 40 },
  });
  const artifact = await capture(input, [solution.frame]);
  assert(
    Math.abs(
      artifact.manifest!.solverSettings.speedOfSoundMps - solution.diagnostics.speedOfSoundMps!,
    ) < 1e-9,
    "manifest cannot silently substitute 343 m/s for the solver's actual propagation speed",
  );
});

test("review: behavior A/B rejects changed object-to-acoustic-material bindings", async () => {
  const left = options("run.binding-a");
  const right = options("run.binding-b");
  left.materialRegistry = right.materialRegistry = [
    { id: "wall", absorption: 0.3 },
    { id: "foam", absorption: 0.9 },
  ];
  right.sceneSnapshot.objects[0]!.acousticMaterialId = "foam";
  right.behaviorConfig = { gain: 0.4 };
  const result = await compareRecordings(await capture(left), await capture(right), {
    kind: "behavior",
    independentVariables: ["gainMapping"],
  });
  assert.equal(
    result.matched,
    false,
    "material registry equality is insufficient when object bindings changed",
  );
  assert(result.mismatches.some((m) => m.field === "propagationMaterialHash"));
});

test("review: acoustic A/B rejects a changed Scene source excitation even when auxiliary config is unchanged", async () => {
  const left = options("run.source-a");
  const right = options("run.source-b");
  right.sceneSnapshot.sources[0]!.gainDbfs = -6;
  const result = await compareRecordings(await capture(left), await capture(right), {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(result.matched, false, "scene source definitions must remain authoritative");
  assert(result.mismatches.some((m) => m.field === "sourceSignalHash"));
});
