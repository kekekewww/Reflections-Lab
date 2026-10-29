import test from "node:test";
import assert from "node:assert/strict";
import { Ajv2020 } from "ajv/dist/2020.js";
import experimentSchema from "../../schemas/experiment.schema.json" with { type: "json" };
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticMaterial, AcousticSurface } from "../../src/acoustics/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import {
  ExperimentRecorder,
  MotionReplay,
  canonicalStringify,
  compareRecordings,
  computeRecordingMetrics,
  reprocessRecording,
  sha256Canonical,
  verifyRecording,
} from "../../src/experiments/index.js";
import type { RecordingFrameInput } from "../../src/experiments/types.js";

const scene: SceneSpec = {
  schemaVersion: "1.0.0",
  sceneId: "scene.integration",
  sceneRevision: 1,
  units: "SI",
  coordinateSystem: "right-handed-y-up-minus-z-forward",
  seed: 3,
  gravityMps2: [0, 0, 0],
  objects: [
    {
      id: "ball",
      shape: "sphere",
      dimensionsM: [1, 1, 1],
      positionM: [0, 1, 0],
      orientationQuaternion: [0, 0, 0, 1],
      mode: "dynamicNoGravity",
      massKg: 1,
      friction: 0.5,
      restitution: 0.5,
      physicsMaterialId: "metal",
      acousticMaterialId: "wall",
      acousticRole: "none",
    },
  ],
  sources: [
    {
      id: "source.ball",
      objectId: "ball",
      signalId: "tone",
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
};
const surface: AcousticSurface = {
  id: "floor",
  materialId: "wall",
  twoSided: true,
  verticesM: [
    [-10, 0, -10],
    [-10, 0, 10],
    [10, 0, 10],
    [10, 0, -10],
  ],
  normal: [0, 1, 0],
};
const material = (absorption: number): AcousticMaterial => ({
  schemaVersion: "1.0.0",
  id: "wall",
  revision: 1,
  label: "Synthetic test wall",
  dataClass: "Synthetic",
  sourceUrls: [],
  conditions: "test only",
  phaseModel: "zeroPhaseMagnitudeOnly",
  bands: [
    {
      centerHz: 1000,
      absorptionEnergy: absorption,
      reflectionEnergy: 1 - absorption,
      transmissionEnergy: 0,
      scatteringFraction: 0,
    },
  ],
});
const options = () => ({
  runId: "run.baseline",
  sceneSnapshot: scene,
  sourceConfig: { waveform: "sine", frequencyHz: 440 },
  behaviorConfig: { profile: "continuous", gain: 0.2 },
  generatorConfig: { waveform: "sine" },
  solverConfig: { maxReflectionOrder: 1 },
  geometrySnapshot: [surface],
  atmosphere: {
    medium: "air",
    speedOfSoundMps: 343,
    temperatureC: 20,
    relativeHumidityPercent: 50,
    pressurePa: 101325,
  },
  materialRegistry: [material(0.2)],
  physicsVersion: "rapier-0.21.0",
  backendVersion: "custom-web-1",
  fixedDtS: 1 / 60,
  sampleRateHz: 48000 as const,
});
const input = (tick: number): RecordingFrameInput => ({
  tick,
  sceneRevision: 1,
  poses: [{ objectId: "ball", positionM: [tick / 60, 1, 0], orientationQuaternion: [0, 0, 0, 1] }],
  listener: scene.listener,
  physicsEvents: [],
  audioEvents: [],
  behaviorDecisions: [],
});
function acoustic(frame: RecordingFrameInput, wall: AcousticMaterial) {
  return solveAcoustics({
    requestId: `request.${frame.tick}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: frame.tick,
    source: { id: "source.ball", positionM: frame.poses[0]!.positionM },
    listener: { id: "listener", positionM: frame.listener.positionM },
    surfaces: [surface],
    materials: [wall],
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    bandCentersHz: [1000],
  }).frame;
}
async function baseline() {
  const recorder = new ExperimentRecorder(options());
  for (let tick = 0; tick < 3; tick += 1) {
    const frame = input(tick);
    recorder.appendFrame({ ...frame, acousticFrames: [acoustic(frame, material(0.2))] });
  }
  return recorder.finish();
}

test("real solver reprocess lowers reflection energy but cannot claim source-phase-matched output without content evidence", async () => {
  const a = await baseline();
  let calls = 0;
  const b = await reprocessRecording(
    a,
    { runId: "run.absorber", materialRegistry: [material(0.8)] },
    (frame, changes) => {
      calls += 1;
      return {
        behaviorDecisions: frame.behaviorDecisions,
        audioEvents: frame.audioEvents,
        acousticFrames: [acoustic(frame, (changes.materialRegistry as AcousticMaterial[])[0]!)],
      };
    },
  );
  assert.equal(calls, 3);
  assert.equal(a.fingerprints.motionTraceHash, b.fingerprints.motionTraceHash);
  assert.equal(a.fingerprints.physicsEventTraceHash, b.fingerprints.physicsEventTraceHash);
  const comparison = await compareRecordings(a, b, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(comparison.matched, false);
  assert(comparison.mismatches.some((entry) => entry.field === "sourcePhaseProof"));
  const left = computeRecordingMetrics(a),
    right = computeRecordingMetrics(b);
  assert(
    right.find((metric) => metric.id === "meanPathEnergy")!.value! <
      left.find((metric) => metric.id === "meanPathEnergy")!.value!,
  );
  assert.equal(
    right.find((metric) => metric.id === "meanDirectDelay")!.value,
    left.find((metric) => metric.id === "meanDirectDelay")!.value,
  );
  assert.equal(
    comparison.metrics.find((metric) => metric.id === "meanPathEnergy")!.delta,
    null,
    "unmatched recordings cannot publish a causal comparison delta",
  );
  assert.equal(comparison.metrics.find((metric) => metric.id === "rt60")!.delta, null);
  assert.equal(new Ajv2020({ strict: true }).compile(experimentSchema)(b.manifest), true);
});
test("reprocess callback cannot replace immutable motion input and wrong-tick output is rejected", async () => {
  const a = await baseline();
  await assert.rejects(
    () =>
      reprocessRecording(a, { runId: "run.bad" }, (frame) => {
        frame.poses[0]!.positionM[0] = 9;
        return { behaviorDecisions: [], audioEvents: [] };
      }),
    TypeError,
  );
  await assert.rejects(
    () =>
      reprocessRecording(a, { runId: "run.bad" }, () => ({
        behaviorDecisions: [{ tick: 99 }],
        audioEvents: [],
      })),
    { code: "DECISION" },
  );
});
test("vacuum capture preserves real medium and exposes unsupported legacy manifest without a false c", async () => {
  const recorder = new ExperimentRecorder({ ...options(), atmosphere: { medium: "vacuum" } });
  recorder.appendFrame(input(0));
  const recording = await recorder.finish();
  assert.equal(recording.status, "captured");
  assert.equal(recording.manifest, null);
  assert.equal(recording.manifestUnavailableReason, "VACUUM_NOT_REPRESENTABLE_IN_EXPERIMENT_V1");
  assert.deepEqual(recording.configuration.atmosphere, { medium: "vacuum" });
  await verifyRecording(recording);
  await MotionReplay.create(recording);
});
test("unresolved speed has explicit unavailable legacy metadata and inconsistent actual c cannot be sealed", async () => {
  const unresolved = new ExperimentRecorder({
    ...options(),
    atmosphere: { medium: "air", temperatureC: 25 },
  });
  unresolved.appendFrame(input(0));
  const recording = await unresolved.finish();
  assert.equal(recording.manifest, null);
  assert.equal(recording.manifestUnavailableReason, "PROPAGATION_SPEED_UNRESOLVED");
  const inconsistent = new ExperimentRecorder({
    ...options(),
    atmosphere: { medium: "air", speedOfSoundMps: 300 },
  });
  const frame = input(0);
  inconsistent.appendFrame({ ...frame, acousticFrames: [acoustic(frame, material(0.2))] });
  await assert.rejects(() => inconsistent.finish(), { code: "SPEED_PROVENANCE" });
  assert.equal(inconsistent.getTelemetry().state, "interrupted");
});
test("canonical capture never invokes accessors or hidden serialization hooks", () => {
  let calls = 0;
  const value = Object.defineProperty({}, "unsafe", {
    enumerable: true,
    get() {
      calls += 1;
      return "secret";
    },
  });
  assert.throws(() => canonicalStringify(value), { code: "NON_JSON" });
  assert.equal(calls, 0);
  const hidden = Object.defineProperty({}, "toJSON", {
    value() {
      calls += 1;
      return {};
    },
  });
  assert.throws(() => canonicalStringify(hidden), { code: "NON_JSON" });
  assert.equal(calls, 0);
});
test("recomputed outer hash cannot hide corrupt trace/manifest references", async () => {
  const bad = structuredClone(await baseline());
  bad.frames[1]!.tick = 7;
  const { artifactSha256: _old, ...body } = bad;
  bad.artifactSha256 = await sha256Canonical(body);
  await assert.rejects(() => verifyRecording(bad), { code: "TICK_GAP" });
});
