import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../../src/physics/index.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import { PathRunner } from "../../src/motion/path-runner.js";
import type { ObjectTrajectory, SceneObject, SceneSpec, Vec3 } from "../../src/scene/types.js";

const path = (offsetsM: Vec3[], strengthMps = 4, startDelayS = 0): ObjectTrajectory => ({
  offsetsM,
  strengthMps,
  startDelayS,
  faceAlongPath: false,
});

function sceneWith(
  objectId: string,
  trajectory: ObjectTrajectory,
  edit?: (scene: SceneSpec) => void,
): SceneSpec {
  const scene = createDefaultScene();
  scene.objects.find((o) => o.id === objectId)!.trajectory = trajectory;
  edit?.(scene);
  return scene;
}

async function withRunner<T>(
  scene: SceneSpec,
  run: (world: PhysicsWorld, runner: PathRunner) => T,
): Promise<T> {
  const world = await PhysicsWorld.create(scene);
  const runner = new PathRunner(world);
  try {
    world.resume();
    return run(world, runner);
  } finally {
    runner.dispose();
    world.dispose();
  }
}

const steps = (world: PhysicsWorld, n: number): void => {
  for (let i = 0; i < n; i++) world.step();
};
const near = (a: readonly number[], b: readonly number[], tol: number): boolean =>
  a.every((v, i) => Math.abs(v - b[i]!) <= tol);

test("ball finishes its path in exactly 30 steps and is handed back to gravity with path velocity", async () => {
  const scene = sceneWith("ball", path([[0, 0, -2]]));
  await withRunner(scene, (world, runner) => {
    runner.beginTake(scene, new Set(["ball"]));
    steps(world, 29);
    assert.equal(runner.view()[0]!.status, "moving");
    assert.equal(world.getPose("ball").mode, "kinematic");
    steps(world, 1);
    assert.equal(runner.view()[0]!.status, "finished");
    assert.equal(runner.isRunning("ball"), false);
    const pose = world.getPose("ball");
    assert.equal(pose.mode, "dynamicGravity");
    assert.ok(near(pose.positionMetres, [-0.8, 2, -2], 0.02), String(pose.positionMetres));
    assert.ok(Math.abs(pose.linearVelocityMetresPerSecond[2] + 4) < 0.05);
  });
});

test("a fixed speaker moves along its path and stays fixed at the end point", async () => {
  const scene = sceneWith("speaker", path([[1, 0, 0]]));
  await withRunner(scene, (world, runner) => {
    runner.beginTake(scene, new Set(["speaker"]));
    steps(world, 15 + 1);
    assert.equal(runner.view()[0]!.status, "finished");
    assert.equal(world.getPose("speaker").mode, "fixed");
    steps(world, 60);
    const pose = world.getPose("speaker");
    assert.equal(pose.mode, "fixed");
    assert.ok(near(pose.positionMetres, [2.5, 1.3, -2], 0.02), String(pose.positionMetres));
  });
});

test("the start delay holds the ball still and does not let it fall", async () => {
  const scene = sceneWith("ball", path([[0, 0, -2]], 4, 0.5));
  await withRunner(scene, (world, runner) => {
    runner.beginTake(scene, new Set(["ball"]));
    for (let i = 0; i < 30; i++) {
      world.step();
      assert.ok(near(world.getPose("ball").positionMetres, [-0.8, 2, 0], 1e-6));
      if (i < 29) assert.equal(runner.view()[0]!.status, "delayed");
    }
    steps(world, 31);
    assert.ok(world.getPose("ball").positionMetres[2] < -1.5);
  });
});

test("a dynamic box on the path blocks the run and the ball becomes dynamic before the box", async () => {
  const scene = sceneWith("ball", path([[0, 0, -3]]), (s) => {
    const { trajectory: _own, ...ball } = s.objects.find((o) => o.id === "ball")!;
    s.objects.push({
      ...ball,
      id: "crate",
      shape: "box",
      dimensionsM: [0.5, 0.5, 0.5],
      positionM: [-0.8, 2, -1.5],
      mode: "dynamicNoGravity",
    });
  });
  let changes = 0;
  const world = await PhysicsWorld.create(scene);
  const runner = new PathRunner(world, () => changes++);
  try {
    world.resume();
    runner.beginTake(scene, new Set(["ball"]));
    for (let i = 0; i < 60 && runner.isRunning("ball"); i++) world.step();
    assert.equal(runner.view()[0]!.status, "blocked");
    const pose = world.getPose("ball");
    assert.equal(pose.mode, "dynamicGravity");
    // Stopped at z = -1 (crate face -1.25 plus ball radius); the hand-over velocity then carries one step on.
    assert.ok(pose.positionMetres[2] > -1.25, String(pose.positionMetres));
    assert.ok(pose.positionMetres[2] < -0.5, "it moved before being blocked");
    assert.equal(changes, 1);
  } finally {
    runner.dispose();
    world.dispose();
  }
});

test("two takes from reset produce identical ball positions every tick", async () => {
  const scene = sceneWith(
    "ball",
    path([
      [0, 0, -2],
      [1, 0, -2],
    ]),
  );
  await withRunner(scene, (world, runner) => {
    const take = (): Vec3[] => {
      world.reset(scene);
      world.resume();
      runner.beginTake(scene, new Set(["ball"]));
      const out: Vec3[] = [];
      for (let i = 0; i < 120; i++) {
        world.step();
        out.push([...world.getPose("ball").positionMetres] as Vec3);
      }
      return out;
    };
    assert.deepEqual(take(), take());
  });
});

test("nine objects with paths: only the first eight by id run", async () => {
  const scene = createDefaultScene();
  const ball = scene.objects.find((o) => o.id === "ball")!;
  const extra: SceneObject[] = [];
  for (let i = 1; i <= 9; i++)
    extra.push({
      ...ball,
      id: `p${i}`,
      positionM: [-2 + 0.6 * i, 1, 1],
      mode: "dynamicNoGravity",
      trajectory: path([[0, 0, 0.5]]),
    });
  scene.objects.push(...extra);
  await withRunner(scene, (world, runner) => {
    const ids = new Set(extra.map((o) => o.id));
    const views = runner.beginTake(scene, ids);
    assert.deepEqual(
      views.map((v) => v.objectId),
      ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
    );
    assert.equal(world.getPose("p8").mode, "kinematic");
    assert.equal(world.getPose("p9").mode, "dynamicNoGravity");
  });
});

test("the path starts where the object is in the scene, offsets move with it", async () => {
  const scene = sceneWith("ball", path([[0, 0, -2]]), (s) => {
    s.objects.find((o) => o.id === "ball")!.positionM = [0, 1, 0];
  });
  await withRunner(scene, (world, runner) => {
    runner.beginTake(scene, new Set(["ball"]));
    steps(world, 30);
    assert.ok(near(world.getPose("ball").positionMetres, [0, 1, -2], 0.02));
  });
});
