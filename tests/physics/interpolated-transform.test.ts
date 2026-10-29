import assert from "node:assert/strict";
import test from "node:test";
import { PhysicsWorld } from "../../src/physics/physics-world.js";
import type { BodyPose } from "../../src/physics/types.js";
import type { BodyMode, Quaternion, SceneObject, SceneSpec, Vec3 } from "../../src/scene/types.js";
import { originalInterpolatedPoses } from "./fixtures/interpolated-transform-reference.mjs";

type Transform = Pick<BodyPose, "objectId" | "positionMetres" | "rotation">;
type History = Pick<
  BodyPose,
  "objectId" | "generation" | "positionMetres" | "rotation" | "moving" | "sleeping"
>;
interface TransformSeam {
  interpolatedTransforms(alpha: number): Transform[];
  poses(updateMotion?: boolean): BodyPose[];
  previous: History[];
  records: Map<
    string,
    {
      generation: number;
      discontinuityUntilTick: number;
      body: {
        setTranslation(value: { x: number; y: number; z: number }, wake: boolean): void;
        setRotation(value: { x: number; y: number; z: number; w: number }, wake: boolean): void;
      };
    }
  >;
}
const seam = (world: PhysicsWorld) => world as unknown as TransformSeam;
function body(id: string, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [1, 1, 1],
    positionM: [0, 2, 0],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicNoGravity",
    massKg: 1,
    friction: 0.5,
    restitution: 0,
    physicsMaterialId: "transform.physics",
    acousticMaterialId: "transform.acoustic",
    acousticRole: "none",
    ...patch,
  };
}
function scene(): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "interpolated-transform-reference",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 19,
    gravityMps2: [0, -9.81, 0],
    objects: [
      body("ball"),
      body("floor", {
        shape: "box",
        dimensionsM: [10, 0.2, 10],
        positionM: [0, -0.1, 0],
        mode: "fixed",
      }),
      body("driven", { positionM: [3, 2, 0], mode: "kinematic" }),
    ],
    sources: [],
    listener: {
      id: "listener.transform",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}
function subset(poses: BodyPose[]): Transform[] {
  return poses.map((pose) => ({
    objectId: pose.objectId,
    positionMetres: [...pose.positionMetres],
    rotation: [...pose.rotation],
  }));
}
function compare(world: PhysicsWorld, alpha: number): Transform[] {
  const expected = originalInterpolatedPoses.call(world, alpha) as BodyPose[];
  assert.deepEqual(
    world.interpolatedPoses(alpha),
    expected,
    "full public interpolation remains the frozen reference",
  );
  const actual = seam(world).interpolatedTransforms(alpha);
  assert.deepEqual(actual, subset(expected));
  assert.deepEqual(
    actual.map((pose) => pose.objectId),
    ["ball", "driven", "floor"],
  );
  for (const pose of actual)
    assert.deepEqual(Object.keys(pose).sort(), ["objectId", "positionMetres", "rotation"]);
  return actual;
}

test("narrow interpolation matches the frozen full-public subset and avoids full body projections", async () => {
  const world = await PhysicsWorld.create(scene());
  try {
    world.setVelocity("ball", [0.5, 0.1, 0], [0, 0.8, 0.3]);
    world.resume();
    for (let step = 0; step < 12; step++) {
      world.setKinematicTarget("driven", [3 + step / 100, 2, 0]);
      world.step();
      for (const alpha of [0, 0.25, 0.5, 1]) compare(world, alpha);
    }
    const expected = subset(world.interpolatedPoses(0.5));
    const poses = seam(world).poses;
    const full = world.interpolatedPoses;
    seam(world).poses = () => {
      throw new Error("narrow transform called full poses");
    };
    world.interpolatedPoses = () => {
      throw new Error("narrow transform called full public interpolation");
    };
    try {
      assert.deepEqual(seam(world).interpolatedTransforms(0.5), expected);
    } finally {
      seam(world).poses = poses;
      world.interpolatedPoses = full;
    }
    for (const alpha of [-0.1, 1.1, NaN, Infinity]) {
      assert.throws(() => seam(world).interpolatedTransforms(alpha), { code: "INVALID_ALPHA" });
    }
  } finally {
    world.dispose();
  }
  assert.throws(() => seam(world).interpolatedTransforms(0.5), { code: "DISPOSED" });
});

test("narrow transforms copy current native poses on same-tick edits and include fixed/staged/disabled bodies", async () => {
  const world = await PhysicsWorld.create(scene());
  try {
    world.resume();
    world.step();
    const retained = compare(world, 0.5),
      copy = structuredClone(retained);
    const first = retained.find((pose) => pose.objectId === "ball")!;
    first.positionMetres[0] = 999;
    first.rotation[0] = 999;
    assert.deepEqual(compare(world, 0.5), copy);
    const tick = world.tick;
    const record = seam(world).records.get("ball")!;
    record.body.setTranslation({ x: 1, y: 2.2, z: 0.1 }, true);
    record.body.setRotation({ x: 0, y: Math.sin(0.3), z: 0, w: Math.cos(0.3) }, true);
    assert.equal(compare(world, 1).find((pose) => pose.objectId === "ball")!.positionMetres[0], 1);
    assert.equal(world.tick, tick);
    const driven = world.getPose("driven").positionMetres;
    world.setKinematicTarget("driven", [3.1, 2, 0]);
    assert.deepEqual(
      compare(world, 1).find((pose) => pose.objectId === "driven")!.positionMetres,
      driven,
      "a pending kinematic target is not the current native transform",
    );
    for (const mode of ["dynamicGravity", "fixed", "kinematic", "dynamicNoGravity"] as BodyMode[]) {
      world.setMode("ball", mode);
      for (const alpha of [0, 0.5, 1]) compare(world, alpha);
    }
    world.setObjectEnabled("ball", false);
    compare(world, 0.5);
    world.setObjectEnabled("ball", true);
    compare(world, 0.5);
    assert.deepEqual(
      retained.filter((pose) => pose.objectId !== "ball"),
      copy.filter((pose) => pose.objectId !== "ball"),
    );
  } finally {
    world.dispose();
  }
});

test("quaternion hemisphere, missing previous, generation and discontinuity use exactly the full-public branches", async () => {
  const world = await PhysicsWorld.create(scene());
  try {
    world.resume();
    world.step();
    world.step();
    const current = world.getPose("ball"),
      internal = seam(world),
      record = internal.records.get("ball")!;
    assert.equal(
      current.discontinuity,
      false,
      "hemisphere fixture must leave the spawn discontinuity",
    );
    const oldPosition: Vec3 = [
      current.positionMetres[0] - 0.5,
      current.positionMetres[1],
      current.positionMetres[2],
    ];
    const opposite: Quaternion = current.rotation.map((v) => -v) as Quaternion;
    internal.previous = [
      {
        objectId: "ball",
        generation: current.generation,
        positionMetres: oldPosition,
        rotation: opposite,
        moving: current.moving,
        sleeping: current.sleeping,
      },
    ];
    const middle = compare(world, 0.5).find((pose) => pose.objectId === "ball")!;
    assert.ok(Math.abs(Math.hypot(...middle.rotation) - 1) < 1e-12);
    assert.ok(middle.rotation.reduce((sum, v, i) => sum + v * opposite[i]!, 0) > 0.999);
    assert.equal(middle.positionMetres[0], (oldPosition[0] + current.positionMetres[0]) / 2);
    internal.previous[0]!.generation++;
    assert.deepEqual(
      compare(world, 0).find((pose) => pose.objectId === "ball")!.positionMetres,
      current.positionMetres,
    );
    internal.previous[0]!.generation = current.generation;
    record.discontinuityUntilTick = world.tick;
    assert.deepEqual(
      compare(world, 0).find((pose) => pose.objectId === "ball")!.positionMetres,
      current.positionMetres,
    );
  } finally {
    world.dispose();
  }
});

test("author transform, geometry replacement and reset preserve fresh generation rebases and retained DTOs", async () => {
  const initial = scene(),
    world = await PhysicsWorld.create(initial);
  try {
    world.setVelocity("ball", [1, 0, 0], [0, 1, 0]);
    world.resume();
    world.step();
    const retained = compare(world, 0.5),
      copy = structuredClone(retained);
    world.pause();
    const edited = structuredClone(initial);
    edited.sceneRevision = 1;
    edited.objects.find((row) => row.id === "ball")!.positionM = [2, 3, 0];
    world.applyScene(edited);
    for (const alpha of [0, 0.5, 1]) compare(world, alpha);
    const generation = world.getPose("ball").generation;
    const rebuilt = structuredClone(edited);
    rebuilt.sceneRevision = 2;
    rebuilt.objects.find((row) => row.id === "ball")!.dimensionsM = [0.8, 0.8, 0.8];
    world.applyScene(rebuilt);
    assert.ok(world.getPose("ball").generation > generation);
    for (const alpha of [0, 0.5, 1]) compare(world, alpha);
    world.reset(rebuilt);
    for (const alpha of [0, 0.5, 1]) compare(world, alpha);
    assert.deepEqual(retained, copy);
  } finally {
    world.dispose();
  }
});
