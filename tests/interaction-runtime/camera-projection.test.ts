import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultScene } from "../../src/app/defaults.js";
import { InteractionHost } from "../../src/interaction/index.js";
import { PhysicsWorld } from "../../src/physics/index.js";

test("camera snapshots read only the current player pose, including no-player fallback", async () => {
  const scene = createDefaultScene();
  const world = await PhysicsWorld.create(scene);
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => structuredClone(scene),
    commitSceneOperations: async () => {
      throw new Error("No authoring transaction is expected");
    },
  });
  try {
    const original = world.snapshot;
    world.snapshot = () => {
      throw new Error("Camera reads must not build a world snapshot");
    };
    try {
      assert.deepEqual(host.snapshot().camera, {
        positionM: [0, 1.6, 4],
        orientationQuaternion: [0, 0, 0, 1],
      });
      assert.equal(host.getFPSCamera(), undefined);
    } finally {
      world.snapshot = original;
    }
    assert.equal(host.enterFPS({ pointerLocked: true }), true);
    assert.equal(host.resume(), true);
    host.handleLook(40, -20);
    host.handleKey("KeyW", true);
    for (let i = 0; i < 10; i++) {
      host.beforeStep();
      world.step();
    }
    const current = host.snapshot().camera;
    const camera = host.getFPSCamera()!;
    assert.deepEqual(camera, current);
    assert.ok(camera.positionM[2] < 3.8);
    assert.notDeepEqual(camera.orientationQuaternion, [0, 0, 0, 1]);
    camera.positionM[0] = 123;
    camera.orientationQuaternion[3] = 0;
    assert.deepEqual(host.getFPSCamera(), current);
    host.exitFPS();
    assert.equal(host.getFPSCamera(), undefined);
    world.reset();
    assert.deepEqual(host.snapshot().camera.positionM, scene.listener.positionM);
  } finally {
    host.dispose();
    world.dispose();
  }
});
