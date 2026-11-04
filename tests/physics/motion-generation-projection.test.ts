import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../../src/physics/index.js";
import { MotionWorkspace } from "../../src/motion/index.js";
import type { SceneObject, SceneSpec } from "../../src/scene/types.js";

const ball = (id = "ball", mode: SceneObject["mode"] = "dynamicNoGravity"): SceneObject => ({
  id,
  shape: "sphere",
  dimensionsM: [0.2, 0.2, 0.2],
  positionM: [0, 2, 0],
  orientationQuaternion: [0, 0, 0, 1],
  mode,
  massKg: 1,
  friction: 0,
  restitution: 0,
  physicsMaterialId: "test",
  acousticMaterialId: "test",
  acousticRole: "none",
});
function makeScene(): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "scene.motion-generation",
    sceneRevision: 1,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects: [ball()],
    sources: [],
    listener: {
      id: "listener",
      positionM: [0, 1, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}
const proposals = (id: string) => [
  {
    requestId: "request.motion",
    arguments: {
      objectId: id,
      interpolation: "linearSlerp",
      samples: [
        { timeS: 0, positionM: [0, 2, 0], orientationQuaternion: [0, 0, 0, 1] },
        { timeS: 1, positionM: [0.5, 2, 0], orientationQuaternion: [0, 0, 0, 1] },
      ],
    },
  },
];

for (const variant of ["reset-mode", "geometry", "reused-id", "new-id"] as const) {
  test("Motion generation projection matches actual applyScene: " + variant, async () => {
    let current = makeScene();
    const world = await PhysicsWorld.create(current);
    const motion = await MotionWorkspace.create(current, world, { getScene: () => current });
    try {
      let next = structuredClone(current);
      let id = "ball",
        expected = 1;
      if (variant === "reset-mode") {
        world.reset();
        expected = 2;
      }
      if (variant === "geometry") {
        next.objects[0]!.dimensionsM = [0.4, 0.4, 0.4];
        expected = 2;
      }
      if (variant === "reused-id") {
        current = { ...current, sceneRevision: 2, objects: [] };
        world.applyScene(current);
        next = { ...next, sceneRevision: 3 };
        expected = 2;
      }
      if (variant === "new-id") {
        id = "new-ball";
        next.objects[0]!.positionM = [-2, 2, 0];
        next.objects.push(ball(id, "kinematic"));
      }
      next.sceneRevision = current.sceneRevision + 1;
      next.objects.find((o) => o.id === id)!.mode = "kinematic";
      const projection = world.projectSceneGenerations(next);
      assert.equal(projection[id], expected);
      assert.deepEqual(world.projectSceneGenerations(next), projection);
      const before = motion.getSnapshot();
      const staged = await motion.previewTrajectories(proposals(id), next);
      assert.equal(staged.candidate.actions[0]!.generation, expected);
      await motion.withExternalTransaction(staged.candidate, before, next, () => {
        world.applyScene(next);
        current = next;
        return current;
      });
      assert.equal(world.getPose(id).generation, expected);
      await motion.start("trajectory." + id, "command." + variant);
      world.resume();
      for (let i = 0; i < 90; i++) world.step();
      assert.equal(motion.getView().runs.at(-1)!.status, "reached");
    } finally {
      motion.dispose();
      world.dispose();
    }
  });
}

test("reset after preview rejects stale generation before the scene callback", async () => {
  let current = makeScene();
  const world = await PhysicsWorld.create(current);
  const motion = await MotionWorkspace.create(current, world, { getScene: () => current });
  try {
    const before = motion.getSnapshot();
    const next = structuredClone(current);
    next.sceneRevision++;
    next.objects[0]!.mode = "kinematic";
    const staged = await motion.previewTrajectories(proposals("ball"), next);
    world.reset();
    let calls = 0;
    await assert.rejects(
      motion.withExternalTransaction(staged.candidate, before, next, () => {
        calls++;
        current = next;
        world.applyScene(next);
        return current;
      }),
      /body identity/,
    );
    assert.equal(calls, 0);
    assert.deepEqual(motion.getSnapshot(), before);
  } finally {
    motion.dispose();
    world.dispose();
  }
});

test("mixed geometry Undo projects restored author content onto the next real generation", async () => {
  let current = makeScene();
  current.objects[0]!.mode = "kinematic";
  const original = structuredClone(current);
  const world = await PhysicsWorld.create(current);
  const motion = await MotionWorkspace.create(current, world, { getScene: () => current });
  try {
    await motion.save(
      { actionId: "move", objectId: "ball", kind: "moveTo", targetPositionM: [1, 2, 0] },
      0,
    );
    const before = motion.getSnapshot();
    const next = structuredClone(current);
    next.sceneRevision++;
    next.objects[0]!.dimensionsM = [0.4, 0.4, 0.4];
    const staged = await motion.previewTrajectories(proposals("ball"), next);
    await motion.withExternalTransaction(staged.candidate, before, next, () => {
      world.applyScene(next);
      current = next;
      return current;
    });
    assert.equal(world.getPose("ball").generation, 2);
    const after = motion.getSnapshot();
    const restoredScene = { ...original, sceneRevision: 3 };
    const restored = await motion.projectRestoredRegistry(
      { ...before, revision: after.revision + 1 },
      restoredScene,
    );
    assert.equal(restored.actions[0]!.generation, 3);
    assert.deepEqual(
      { ...restored.actions[0], generation: before.actions[0]!.generation },
      before.actions[0],
    );
    await motion.withExternalTransaction(restored, after, restoredScene, () => {
      world.applyScene(restoredScene);
      current = restoredScene;
      return current;
    });
    assert.equal(world.getPose("ball").generation, 3);
    await motion.start("move", "command.restored");
    world.resume();
    for (let i = 0; i < 120; i++) world.step();
    assert.equal(motion.getView().runs.at(-1)!.status, "reached");
  } finally {
    motion.dispose();
    world.dispose();
  }
});
