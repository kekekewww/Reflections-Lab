import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../../src/physics/index.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import type { Quaternion, SceneObject, Vec3 } from "../../src/scene/types.js";

const identity: Quaternion = [0, 0, 0, 1];

async function withWorld<T>(
  edit: (objects: SceneObject[]) => void,
  run: (world: PhysicsWorld) => T,
): Promise<T> {
  const scene = createDefaultScene();
  edit(scene.objects);
  const world = await PhysicsWorld.create(scene);
  try {
    return run(world);
  } finally {
    world.dispose();
  }
}

const driven = (objects: SceneObject[]): void => {
  const ball = objects.find((o) => o.id === "ball")!;
  ball.mode = "kinematic";
  ball.positionM = [-0.8, 1, 0];
};

function travelledPerStep(maxSpeedMps?: number): Promise<number> {
  return withWorld(driven, (world) => {
    world.resume();
    const start = world.step().poses.find((p) => p.objectId === "ball")!.positionMetres;
    const target: Vec3 = [start[0] + 1, start[1], start[2]];
    if (maxSpeedMps === undefined) world.setKinematicTarget("ball", target, identity);
    else world.setKinematicTarget("ball", target, identity, maxSpeedMps);
    const end = world.step().poses.find((p) => p.objectId === "ball")!.positionMetres;
    return Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  });
}

test("kinematic target step is limited by the speed parameter, default 3 m/s", async () => {
  assert.ok(Math.abs((await travelledPerStep(20)) - 20 / 60) < 1e-6);
  assert.ok(Math.abs((await travelledPerStep()) - 3 / 60) < 1e-6);
});

test("firstFixedHitAlong finds the back wall segment and ignores in-room paths", async () => {
  await withWorld(
    () => {},
    (world) => {
      // Back wall front face z = -4.0; ball radius 0.25, so contact at centre z = -3.75 (segment 1).
      assert.equal(
        world.firstFixedHitAlong(
          "ball",
          [
            [-0.8, 1, 0],
            [-0.8, 1, -3],
            [-0.8, 1, -6],
          ],
          identity,
        ),
        1,
      );
      assert.equal(
        world.firstFixedHitAlong(
          "ball",
          [
            [-0.8, 1, 0],
            [-0.8, 1, -2],
            [1, 1, -2],
          ],
          identity,
        ),
        null,
      );
    },
  );
});

test("a dynamic box on the segment does not count as a fixed hit", async () => {
  await withWorld(
    (objects) => {
      const ball = objects.find((o) => o.id === "ball")!;
      objects.push({
        ...ball,
        id: "crate",
        shape: "box",
        dimensionsM: [0.5, 0.5, 0.5],
        positionM: [-0.8, 1, -1.5],
        mode: "dynamicNoGravity",
      });
      ball.positionM = [-0.8, 1, 0];
    },
    (world) => {
      assert.equal(
        world.firstFixedHitAlong(
          "ball",
          [
            [-0.8, 1, 0],
            [-0.8, 1, -3],
          ],
          identity,
        ),
        null,
      );
    },
  );
});

test("resting on the floor and sliding along it is not a hit, going down into it is", async () => {
  await withWorld(
    () => {},
    (world) => {
      assert.equal(
        world.firstFixedHitAlong(
          "ball",
          [
            [-0.8, 0.25, 0],
            [-0.8, 0.25, -2],
            [1, 0.25, -2],
          ],
          identity,
        ),
        null,
      );
      assert.equal(
        world.firstFixedHitAlong(
          "ball",
          [
            [-0.8, 0.25, 0],
            [-0.8, 0.25, -1],
            [-0.8, -1, -1],
          ],
          identity,
        ),
        1,
      );
    },
  );
});

test("clearFromFixed pushes a point clear of fixed geometry and ignores other bodies", async () => {
  await withWorld(
    (objects) => {
      const ball = objects.find((o) => o.id === "ball")!;
      objects.push({ ...ball, id: "crate", shape: "box", positionM: [0, 1, 1] });
    },
    (world) => {
      // Rapier projects in single precision.
      const near = (actual: Vec3, expected: Vec3, what: string) =>
        assert.ok(
          Math.hypot(...actual.map((v, i) => v - expected[i]!)) < 1e-6,
          `${what}: [${actual}] is not [${expected}]`,
        );
      assert.deepEqual(world.clearFromFixed([0, 1.5, 0], 0.26, "ball"), [0, 1.5, 0], "free air");
      // Back wall front face z = -4.0, left wall face x = -3.0, floor top y = 0.
      near(world.clearFromFixed([0, 1.5, -3.9], 0.26, "ball"), [0, 1.5, -3.74], "near a face");
      near(world.clearFromFixed([0, 1.5, -4.05], 0.26, "ball"), [0, 1.5, -3.74], "inside a wall");
      near(
        world.clearFromFixed([-2.95, 0.1, -3.95], 0.26, "ball"),
        [-2.74, 0.26, -3.74],
        "a corner by the floor settles clear of all three",
      );
      assert.deepEqual(
        world.clearFromFixed([0, 1, 1], 0.26, "ball"),
        [0, 1, 1],
        "a dynamic body never pushes",
      );
      assert.deepEqual(
        world.clearFromFixed([1.5, 1.3, -2], 0.3, "speaker"),
        [1.5, 1.3, -2],
        "the excluded fixed object does not push",
      );
    },
  );
});

test("a ball thrown to a floor-clicked point does not sweep into fixed geometry", async () => {
  const { timePath } = await import("../../src/motion/trajectory-path.js");
  await withWorld(
    () => {},
    (world) => {
      const path = timePath([-0.8, 2, 0], {
        offsetsM: [
          [1.503, -1.74, 3.645],
          [-1.2, -1, -2.048],
        ],
        strengthMps: 3,
        startDelayS: 0,
        faceAlongPath: false,
      });
      assert.equal(world.firstFixedHitAlong("ball", path.pointsM, [0, 0, 0, 1]), null);
    },
  );
});
