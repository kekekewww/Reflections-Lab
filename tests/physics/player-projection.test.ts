import assert from "node:assert/strict";
import test from "node:test";
import { PhysicsWorld } from "../../src/physics/index.js";
import { createDefaultScene } from "../../src/app/defaults.js";

test("player reads stay live and isolated without projecting body poses", async () => {
  const world = await PhysicsWorld.create(createDefaultScene());
  try {
    assert.equal(typeof world.getPlayerPose, "function");
    assert.equal(world.getPlayerPose(), null);
    world.createPlayer([0, 0, 3]);
    const initial = world.snapshot().player!;
    assert.deepEqual(world.getPlayerPose(), initial);
    assert.deepEqual(initial.eyePositionMetres, [0, 1.6, 3]);
    const copy = world.getPlayerPose()!;
    copy.positionMetres[0] = 123;
    copy.eyePositionMetres[2] = 123;
    assert.deepEqual(world.getPlayerPose(), initial);

    world.resume();
    world.setPlayerInput({ forward: 1, right: 0, yaw: 0 });
    for (let i = 0; i < 10; i++) world.step();
    const moved = world.snapshot().player!;
    assert.ok(moved.eyePositionMetres[2] < initial.eyePositionMetres[2] - 0.2);
    assert.deepEqual(world.getPlayerPose(), moved);

    const original = world.snapshot;
    const projection = world as unknown as { poses(): unknown[] };
    const originalPoses = projection.poses;
    world.snapshot = () => {
      throw new Error("A player-only read must not build a world snapshot");
    };
    projection.poses = () => {
      throw new Error("A player-only read must not project body/contact poses");
    };
    try {
      assert.deepEqual(world.getPlayerPose(), moved);
    } finally {
      world.snapshot = original;
      projection.poses = originalPoses;
    }
    world.reset();
    assert.equal(world.getPlayerPose(), null);
  } finally {
    world.dispose();
  }
  assert.throws(() => world.getPlayerPose(), /disposed/i);
});
