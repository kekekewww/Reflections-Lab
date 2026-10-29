import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ExperimentRecorder,
  MotionReplay,
  canonicalStringify,
  compareRecordings,
  computeRecordingMetrics,
  sha256Canonical,
  verifyRecording,
} from "../../src/experiments/index.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";

const scene = {
  schemaVersion: "1.0.0" as const,
  sceneId: "scene.test",
  sceneRevision: 2,
  units: "SI" as const,
  coordinateSystem: "right-handed-y-up-minus-z-forward" as const,
  seed: 13,
  gravityMps2: [0, -9.81, 0] as [number, number, number],
  objects: [
    {
      id: "ball",
      shape: "sphere" as const,
      dimensionsM: [1, 1, 1] as [number, number, number],
      positionM: [0, 1, 0] as [number, number, number],
      orientationQuaternion: [0, 0, 0, 1] as [number, number, number, number],
      mode: "dynamicGravity" as const,
      massKg: 1,
      friction: 0.5,
      restitution: 0.4,
      physicsMaterialId: "metal",
      acousticMaterialId: "synthetic.wall",
      acousticRole: "dynamicOccluder" as const,
    },
  ],
  sources: [],
  listener: {
    id: "listener",
    positionM: [0, 1, 3] as [number, number, number],
    orientationQuaternion: [0, 0, 0, 1] as [number, number, number, number],
    attachment: "independent" as const,
  },
};
function options(runId = "run.a"): ExperimentRecorderOptions {
  return {
    runId,
    runEpoch: "epoch.one",
    sceneSnapshot: structuredClone(scene),
    sourceConfig: { signal: "sine", frequencyHz: 440 },
    behaviorConfig: { gain: 0.2 },
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [{ id: "synthetic.wall", absorption: 0.3 }],
    assetManifest: [],
    generatorConfig: { type: "sine" },
    physicsVersion: "rapier-0.21.0",
    backendVersion: "1.0.0",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    createdAt: "2026-10-27T00:00:00.000Z",
  };
}
function frame(tick: number): RecordingFrameInput {
  return {
    tick,
    sceneRevision: 2,
    poses: [
      {
        objectId: "ball",
        positionM: [tick / 60, 1, 0],
        orientationQuaternion: [0, 0, 0, 1],
        linearVelocityMps: [1, 0, 0],
      },
    ],
    listener: structuredClone(scene.listener),
    physicsEvents:
      tick === 1
        ? [
            {
              eventId: "impact.one",
              tick,
              sequence: 0,
              objectId: "ball",
              type: "OnImpact",
              accepted: true,
            },
          ]
        : [],
    behaviorDecisions: tick === 1 ? [{ tick, sequence: 0, action: "start", ruleId: "impact" }] : [],
    audioEvents:
      tick === 1
        ? [{ eventId: "audio.one", tick, sequence: 0, objectId: "ball", action: "start" }]
        : [],
  };
}
async function capture(input = options()) {
  const recorder = new ExperimentRecorder(input);
  for (let tick = 0; tick < 3; tick += 1) recorder.appendFrame(frame(tick));
  return recorder.finish();
}

test("canonical SHA-256 matches independent node implementation and ignores property order", async () => {
  const expected = createHash("sha256").update('{"a":[2,3],"b":1}').digest("hex");
  assert.equal(await sha256Canonical({ b: 1, a: [2, 3] }), expected);
  assert.throws(() => canonicalStringify({ value: Infinity }), { code: "NONFINITE" });
  assert.throws(() => canonicalStringify(new Date()), { code: "NON_JSON" });
});
test("captured immutable artifact seals full motion, raw events and independent behavior output", async () => {
  const input = options();
  const recorder = new ExperimentRecorder(input);
  const initial = frame(0);
  recorder.appendFrame(initial);
  initial.poses[0]!.positionM = [99, 0, 0];
  recorder.appendFrame(frame(1));
  recorder.appendFrame(frame(2));
  const artifact = await recorder.finish();
  assert.equal(artifact.status, "captured");
  assert.equal(artifact.frames[0]!.poses[0]!.positionM[0], 0);
  assert.equal(artifact.manifest!.recordingMode, "authoritativeMotionTrace");
  assert.equal(artifact.frameCount, 3);
  assert.equal(artifact.eventCount, 2);
  assert(Object.isFrozen(artifact.frames[0]!.poses));
  await verifyRecording(artifact);
});
test("pause freezes ticks, resume remains contiguous, no wall-time gap is inserted", async () => {
  const recorder = new ExperimentRecorder(options());
  recorder.appendFrame(frame(0));
  recorder.pause();
  assert.throws(() => recorder.appendFrame(frame(1)), { code: "RECORDER_STATE" });
  recorder.resume();
  recorder.appendFrame(frame(1));
  assert.throws(() => recorder.appendFrame(frame(3)), { code: "TICK_GAP" });
  recorder.appendFrame(frame(2));
  const artifact = await recorder.finish();
  assert.equal(artifact.endTick, 2);
});
test("duplicate input events, bad refs, stale revision and invalid quaternion are rejected atomically", () => {
  const recorder = new ExperimentRecorder(options());
  recorder.appendFrame(frame(0));
  const stale = frame(1);
  stale.sceneRevision = 3;
  assert.throws(() => recorder.appendFrame(stale), { code: "SCENE_REVISION" });
  const bad = frame(1);
  bad.poses[0]!.orientationQuaternion = [0, 0, 0, 0];
  assert.throws(() => recorder.appendFrame(bad), { code: "QUATERNION" });
  const missing = frame(1);
  missing.physicsEvents = [
    { eventId: "event.bad", tick: 1, sequence: 0, objectId: "missing", type: "OnImpact" },
  ];
  assert.throws(() => recorder.appendFrame(missing), { code: "OBJECT_REFERENCE" });
  recorder.appendFrame(frame(1));
  const duplicate = frame(2);
  duplicate.physicsEvents = [
    { eventId: "impact.one", tick: 2, sequence: 0, objectId: "ball", type: "OnImpact" },
  ];
  assert.throws(() => recorder.appendFrame(duplicate), { code: "DUPLICATE_EVENT" });
  assert.equal(recorder.getTelemetry().frameCount, 2);
});
test("cancel and bounded-budget interruption never produce Captured manifest", async () => {
  const cancelled = new ExperimentRecorder(options());
  cancelled.appendFrame(frame(0));
  cancelled.cancel();
  const first = await cancelled.finish();
  assert.equal(first.status, "cancelled");
  assert.equal(first.manifest, null);
  const bounded = new ExperimentRecorder({ ...options(), budget: { maxFrames: 1 } });
  bounded.appendFrame(frame(0));
  assert.throws(() => bounded.appendFrame(frame(1)), { code: "RECORDING_BUDGET" });
  const second = await bounded.finish();
  assert.equal(second.status, "interrupted");
  assert.equal(second.manifest, null);
});
test("replay uses original poses once, seek starts new epoch without re-emitting a collision", async () => {
  const artifact = await capture();
  const replay = await MotionReplay.create(artifact);
  const first = replay.next()!;
  const impact = replay.next()!;
  assert.equal(first.tick, 0);
  assert.equal(impact.physicsEvents.length, 1);
  assert.equal(impact.emitEvents, true);
  const epoch = impact.replayEpoch;
  const seek = replay.seek(1);
  assert.equal(seek.emitEvents, false);
  assert.notEqual(seek.replayEpoch, epoch);
  assert.equal(replay.next()!.tick, 2);
  assert.equal(replay.next(), null);
  replay.reset();
  assert.equal(replay.next()!.tick, 0);
});
test("behavior reevaluation reuses raw physics but excludes recorded audio decisions", async () => {
  const replay = await MotionReplay.create(await capture(), { mode: "behaviorReevaluation" });
  replay.next();
  const impact = replay.next()!;
  assert.equal(impact.physicsEvents.length, 1);
  assert.equal(impact.behaviorDecisions.length, 0);
  assert.equal(impact.audioEvents.length, 0);
});
test("hash tampering and incomplete recording cannot be replayed", async () => {
  const artifact = await capture();
  const tampered = structuredClone(artifact);
  tampered.frames[1]!.poses[0]!.positionM = [6, 0, 0];
  await assert.rejects(() => MotionReplay.create(tampered), { code: "ARTIFACT_HASH" });
  const recorder = new ExperimentRecorder(options());
  recorder.appendFrame(frame(0));
  recorder.interrupt("blur");
  const incomplete = await recorder.finish();
  await assert.rejects(() => MotionReplay.create(incomplete), { code: "INCOMPLETE_RECORDING" });
});
test("acoustic A/B requires source phase evidence as well as declared propagation-only changes", async () => {
  const a = await capture();
  const bOptions = options("run.b");
  bOptions.materialRegistry = [{ id: "synthetic.wall", absorption: 0.8 }];
  const b = await capture(bOptions);
  const missingPhase = await compareRecordings(a, b, {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert.equal(
    missingPhase.matched,
    false,
    "pose/configuration-only fixtures cannot prove source phase",
  );
  assert(missingPhase.mismatches.some((entry) => entry.field === "sourcePhaseProof"));
  const changed = options("run.c");
  changed.sourceConfig = { signal: "piano" };
  assert.equal(
    (
      await compareRecordings(a, await capture(changed), {
        kind: "acoustic",
        independentVariables: ["acousticMaterial"],
      })
    ).matched,
    false,
  );
  const physics = options("run.d");
  physics.sceneSnapshot.objects[0]!.massKg = 2;
  const result = await compareRecordings(a, await capture(physics), {
    kind: "acoustic",
    independentVariables: ["acousticMaterial"],
  });
  assert(result.mismatches.some((m) => m.field === "physicsConfigHash"));
});
test("behavior A/B allows declared profile/gain source change while keeping propagation fixed", async () => {
  const a = await capture();
  const input = options("run.b");
  input.behaviorConfig = { gain: 0.8 };
  input.sourceConfig = { signal: "sine", frequencyHz: 440, gain: 0.8 };
  const b = await capture(input);
  assert.equal(
    (await compareRecordings(a, b, { kind: "behavior", independentVariables: ["gainMapping"] }))
      .matched,
    true,
  );
  const invalid = options("run.c");
  invalid.materialRegistry = [{ absorption: 0.9 }];
  assert.equal(
    (
      await compareRecordings(a, await capture(invalid), {
        kind: "behavior",
        independentVariables: ["gainMapping"],
      })
    ).matched,
    false,
  );
});
test("missing IR never produces RT60/DRR numbers or fabricated zero", async () => {
  const metrics = computeRecordingMetrics(await capture());
  for (const id of ["rt60", "drr", "c50"]) {
    const metric = metrics.find((m) => m.id === id)!;
    assert.equal(metric.value, null);
    assert.equal(metric.status, "unavailable");
    assert(metric.reason);
  }
});
