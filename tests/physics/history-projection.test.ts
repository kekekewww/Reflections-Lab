import assert from "node:assert/strict";
import test from "node:test";
import { PhysicsWorld } from "../../src/physics/physics-world.js";
import type { BodyPose, PhysicsSnapshot } from "../../src/physics/types.js";
import type { BodyMode, SceneObject, SceneSpec } from "../../src/scene/types.js";
import { originalPoses } from "./fixtures/contact-projection-reference.mjs";
import { originalFixedStep } from "./fixtures/history-fixed-step-reference.mjs";

type HistoryPose = Pick<
  BodyPose,
  "objectId" | "generation" | "positionMetres" | "rotation" | "moving" | "sleeping"
>;
interface HistorySeam {
  historyPoses(): HistoryPose[];
  poses(updateMotion?: boolean): BodyPose[];
  fixedStep(): void;
  records: Map<string, { body: { sleep(): void; wakeUp(): void } }>;
}
const seam = (world: PhysicsWorld) => world as unknown as HistorySeam;
const expectedKeys = ["generation", "moving", "objectId", "positionMetres", "rotation", "sleeping"];
function object(id: string, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [1, 1, 1],
    positionM: [0, 1.5, 0],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicGravity",
    massKg: 1,
    friction: 0.5,
    restitution: 0,
    physicsMaterialId: "history.physics",
    acousticMaterialId: "history.acoustic",
    acousticRole: "none",
    ...patch,
  };
}
function scene(): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "history-projection-reference",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 17,
    gravityMps2: [0, -9.81, 0],
    objects: [
      object("floor", {
        shape: "box",
        dimensionsM: [20, 0.2, 20],
        positionM: [0, -0.1, 0],
        mode: "fixed",
      }),
      object("ball"),
      object("inertial", { positionM: [3, 2, 0], mode: "dynamicNoGravity" }),
      object("driven", { positionM: [-3, 2, 0], mode: "kinematic" }),
    ],
    sources: [],
    listener: {
      id: "listener.history",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}
function projectedHistory(world: PhysicsWorld): HistoryPose[] {
  return (originalPoses.call(world, false) as BodyPose[]).map((pose) => ({
    objectId: pose.objectId,
    generation: pose.generation,
    positionMetres: [...pose.positionMetres],
    rotation: [...pose.rotation],
    moving: pose.moving,
    sleeping: pose.sleeping,
  }));
}
function compareHistory(world: PhysicsWorld): HistoryPose[] {
  const before = world.snapshot();
  const expected = projectedHistory(world);
  const actual = seam(world).historyPoses();
  assert.deepEqual(actual, expected);
  for (const row of actual) assert.deepEqual(Object.keys(row).sort(), expectedKeys);
  assert.deepEqual(
    world.snapshot(),
    before,
    "history reads must not advance motion or mutate state",
  );
  return actual;
}

test("a completed fixed tick uses full projections only for post-step motion and the public snapshot", async () => {
  const world = await PhysicsWorld.create(scene());
  try {
    const internal = seam(world);
    const poses = internal.poses;
    const calls: boolean[] = [];
    internal.poses = (updateMotion = false) => {
      calls.push(updateMotion);
      return poses.call(world, updateMotion);
    };
    world.resume();
    const result = world.step();
    assert.equal(result.tick, 1);
    assert.deepEqual(calls, [true, false], "PRE history must not rebuild full body/contact DTOs");
    internal.poses = poses;
    assert.deepEqual(result.poses, originalPoses.call(world, false));
  } finally {
    world.dispose();
  }
});

test("history is a detached current six-field read across same-tick velocity, sleep, modes and enable changes", async () => {
  const world = await PhysicsWorld.create(scene());
  try {
    const initial = compareHistory(world);
    const saved = structuredClone(initial);
    const ball = initial.find((pose) => pose.objectId === "ball")!;
    ball.positionMetres[0] = 900;
    ball.rotation[0] = 900;
    const fresh = compareHistory(world);
    assert.deepEqual(fresh, saved);
    assert.notEqual(fresh[0]!.positionMetres, initial[0]!.positionMetres);
    assert.notEqual(fresh[0]!.rotation, initial[0]!.rotation);
    const retained = world.snapshot();
    const retainedCopy = structuredClone(retained);
    const tick = world.tick;
    world.setVelocity("ball", [0.3, 0, 0], [0, 0, 0.6]);
    compareHistory(world);
    assert.equal(world.tick, tick);
    assert.equal(
      seam(world)
        .historyPoses()
        .find((pose) => pose.objectId === "ball")!.moving,
      false,
      "history reads stored reducer state, rather than deriving a new moving gate from velocity",
    );
    seam(world).records.get("ball")!.body.sleep();
    assert.equal(compareHistory(world).find((pose) => pose.objectId === "ball")!.sleeping, true);
    seam(world).records.get("ball")!.body.wakeUp();
    assert.equal(compareHistory(world).find((pose) => pose.objectId === "ball")!.sleeping, false);
    for (const mode of ["dynamicNoGravity", "fixed", "kinematic", "dynamicGravity"] as BodyMode[]) {
      world.setMode("ball", mode);
      compareHistory(world);
    }
    world.setObjectEnabled("ball", false);
    compareHistory(world);
    world.setObjectEnabled("ball", true);
    compareHistory(world);
    assert.deepEqual(retained, retainedCopy);
    assert.deepEqual(
      initial.filter((pose) => pose.objectId !== "ball"),
      saved.filter((pose) => pose.objectId !== "ball"),
    );
    const poses = seam(world).poses;
    seam(world).poses = () => {
      throw new Error("full projection reached from narrow history");
    };
    try {
      assert.equal(seam(world).historyPoses().length, 4);
    } finally {
      seam(world).poses = poses;
    }
  } finally {
    world.dispose();
  }
});

test("history and interpolation rebase at geometry generation and reset without changing retained snapshots", async () => {
  const initial = scene();
  const world = await PhysicsWorld.create(initial);
  try {
    world.setVelocity("inertial", [1, 0, 0], [0, 0.5, 0]);
    world.resume();
    world.step();
    const retained = world.snapshot();
    const retainedCopy = structuredClone(retained);
    const oldHistory = compareHistory(world);
    const oldHistoryCopy = structuredClone(oldHistory);
    const oldGeneration = world.getPose("inertial").generation;
    world.pause();
    const changed = structuredClone(initial);
    changed.sceneRevision = 1;
    changed.objects.find((row) => row.id === "inertial")!.dimensionsM = [0.8, 0.8, 0.8];
    world.applyScene(changed);
    const rebased = world.getPose("inertial");
    assert.ok(rebased.generation > oldGeneration);
    compareHistory(world);
    for (const alpha of [0, 0.5, 1]) {
      const interpolated = world
        .interpolatedPoses(alpha)
        .find((row) => row.objectId === "inertial")!;
      assert.deepEqual(interpolated.positionMetres, rebased.positionMetres);
      assert.deepEqual(interpolated.rotation, rebased.rotation);
    }
    world.resume();
    world.step();
    compareHistory(world);
    world.reset(changed);
    assert.equal(world.paused, true);
    assert.equal(world.tick, 0);
    assert.ok(world.getPose("inertial").generation > rebased.generation);
    compareHistory(world);
    assert.deepEqual(retained, retainedCopy);
    assert.deepEqual(oldHistory, oldHistoryCopy);
  } finally {
    world.dispose();
  }
});

test("full snapshots, motion/contact events, grab and interpolation match the frozen pre-change fixedStep", async () => {
  const initial = scene();
  const candidate = await PhysicsWorld.create(initial);
  const reference = await PhysicsWorld.create(initial);
  seam(reference).fixedStep = () => originalFixedStep.call(reference);
  const worlds = [candidate, reference];
  let edited = initial;
  let retained: PhysicsSnapshot | undefined;
  let retainedCopy: PhysicsSnapshot | undefined;
  const observedEvents = new Set<string>();
  let actualContacts = 0;
  try {
    for (const world of worlds) world.resume();
    for (let step = 0; step < 150; step++) {
      for (const world of worlds) {
        if (step === 5) world.setVelocity("inertial", [0.3, 0, 0], [0, 0, 0.6]);
        if (step === 35) world.applyImpulse("ball", [0.3, 0, 0]);
        if (step === 40)
          world.grab("inertial", world.getPose("inertial").positionMetres, "history-grab");
        if (step >= 41 && step < 48) world.updateGrabTarget([3.5, 2, 0]);
        if (step === 48) world.drop("history-drop");
        if (step === 55) world.setMode("inertial", "dynamicGravity");
        if (step === 65) world.setMode("inertial", "fixed");
        if (step === 70) world.setMode("inertial", "kinematic");
        if (step === 71) world.setKinematicTarget("inertial", [3.2, 2, 0]);
        if (step === 75) world.setMode("inertial", "dynamicNoGravity");
        if (step === 80) world.setObjectEnabled("inertial", false);
        if (step === 81) world.setObjectEnabled("inertial", true);
        if (step === 90) {
          world.pause();
          const next = structuredClone(initial);
          next.sceneRevision = 1;
          next.objects.find((row) => row.id === "ball")!.dimensionsM = [0.8, 0.8, 0.8];
          world.applyScene(next);
          edited = next;
          world.resume();
        }
        if (step === 110) {
          world.reset(edited);
          world.resume();
        }
        if (step === 120) {
          seam(world).records.get("inertial")!.body.sleep();
        }
        if (step === 121) {
          seam(world).records.get("inertial")!.body.wakeUp();
        }
        if (step < 60) world.setKinematicTarget("driven", [-3 + step / 100, 2, 0]);
      }
      const actual = candidate.step();
      const expected = reference.step();
      assert.deepEqual(actual, expected, "complete public snapshot differs at script step " + step);
      for (const event of actual.events) observedEvents.add(event.type);
      actualContacts += actual.poses.filter((pose) => Boolean(pose.contact)).length;
      for (const alpha of [0, 0.3, 1]) {
        assert.deepEqual(candidate.interpolatedPoses(alpha), reference.interpolatedPoses(alpha));
      }
      if (step === 30) {
        retained = actual;
        retainedCopy = structuredClone(actual);
      }
    }
    assert.ok(actualContacts > 0, "fixture must contain real Rapier contact DTOs");
    for (const event of [
      "ContactBegin",
      "OnImpact",
      "OnStartMoving",
      "OnGrab",
      "OnDrop",
      "BodyModeChanged",
    ]) {
      assert.ok(observedEvents.has(event), "fixture did not exercise " + event);
    }
    assert.deepEqual(retained, retainedCopy);
  } finally {
    for (const world of worlds) world.dispose();
  }
});
