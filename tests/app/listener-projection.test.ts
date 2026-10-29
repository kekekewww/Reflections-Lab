import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import { InteractionHost } from "../../src/interaction/index.js";
import type { InteractionHostOptions } from "../../src/interaction/types.js";
import { PhysicsWorld } from "../../src/physics/index.js";

test("interaction listener reads prefer the narrow DTO without reading the full Scene", async () => {
  const scene = createDefaultScene();
  const world = await PhysicsWorld.create(scene);
  let host: InteractionHost | undefined;
  try {
    host = new InteractionHost({
      getWorld: () => world,
      getScene: () => {
        throw new Error("A listener read must not copy the full Scene");
      },
      getListenerPose: () => scene.listener,
      commitSceneOperations: async () => {
        throw new Error("Unexpected authoring operation");
      },
    });
    assert.deepEqual(host.snapshot().camera.positionM, [0, 1.6, 4]);
    scene.listener.positionM = [1, 1.6, 3];
    const camera = host.snapshot().camera;
    assert.deepEqual(camera.positionM, [1, 1.6, 3]);
    camera.positionM[0] = 123;
    camera.orientationQuaternion[3] = 0;
    assert.deepEqual(host.snapshot().camera, {
      positionM: [1, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
    });
    assert.deepEqual(scene.listener.positionM, [1, 1.6, 3]);
    assert.equal(host.enterFPS(), true);
    assert.deepEqual(host.getFPSCamera()!.positionM, [1, 1.6, 3]);
  } finally {
    host?.dispose();
    world.dispose();
  }
});

test("existing interaction hosts retain the copied Scene listener fallback", async () => {
  const scene = createDefaultScene();
  const world = await PhysicsWorld.create(scene);
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => structuredClone(scene),
    commitSceneOperations: async () => {
      throw new Error("Unexpected authoring operation");
    },
  });
  try {
    const camera = host.snapshot().camera;
    assert.deepEqual(camera.positionM, [0, 1.6, 4]);
    camera.positionM[0] = 123;
    scene.listener.positionM = [1, 1.6, 3];
    assert.deepEqual(host.snapshot().camera.positionM, [1, 1.6, 3]);
  } finally {
    host.dispose();
    world.dispose();
  }
});

test("runtime narrow listener fallback follows commands, undo, reset and import without Scene projection", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const internal = app as unknown as {
    interaction: Pick<InteractionHost, "snapshot"> & { options: InteractionHostOptions };
  };
  const fallback = () => {
    const options = internal.interaction.options;
    const getScene = options.getScene;
    options.getScene = () => {
      throw new Error("Runtime listener fallback projected the full Scene");
    };
    try {
      return internal.interaction.snapshot().camera;
    } finally {
      options.getScene = getScene;
    }
  };
  try {
    assert.deepEqual(fallback().positionM, [0, 1.6, 4]);
    const narrow = internal.interaction.options.getListenerPose!();
    narrow.positionM[0] = 123;
    narrow.orientationQuaternion[3] = 0;
    assert.deepEqual(app.getSceneDocument().listener, createDefaultScene().listener);
    await app.dispatch({ type: "patchListener", positionM: [1, 1.6, 3] });
    assert.deepEqual(fallback().positionM, [1, 1.6, 3]);
    await app.dispatch({ type: "undo" });
    assert.deepEqual(fallback().positionM, [0, 1.6, 4]);
    await app.dispatch({ type: "redo" });
    assert.deepEqual(fallback().positionM, [1, 1.6, 3]);
    await app.dispatch({ type: "reset" });
    assert.deepEqual(fallback().positionM, [1, 1.6, 3]);
    const project = JSON.parse(app.exportProject());
    project.scene.listener.positionM = [-1, 1.6, 3];
    await app.importProject(JSON.stringify(project));
    assert.deepEqual(fallback().positionM, [-1, 1.6, 3]);
    await app.dispatch({ type: "enterFPS" });
    assert.deepEqual(app.getFPSCamera()!.positionM, [-1, 1.6, 3]);
    await app.dispatch({ type: "exitFPS" });
    assert.equal(app.getFPSCamera(), undefined);
    await app.dispatch({ type: "reset" });
    assert.deepEqual(fallback().positionM, [-1, 1.6, 3]);
    assert.equal(app.getSnapshot().error, "");
  } finally {
    app.dispose();
  }
});
