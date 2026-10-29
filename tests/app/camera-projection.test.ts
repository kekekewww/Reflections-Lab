import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import type { InteractionHost } from "../../src/interaction/index.js";
import type { PhysicsWorld } from "../../src/physics/index.js";

test("runtime FPS camera reads avoid whole interaction and physics projections", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const internal = app as unknown as { world: PhysicsWorld; interaction: InteractionHost };
  const readWithoutSnapshots = () => {
    const worldSnapshot = internal.world.snapshot;
    const interactionSnapshot = internal.interaction.snapshot;
    internal.world.snapshot = () => {
      throw new Error("Narrow camera read projected the full physics world");
    };
    internal.interaction.snapshot = () => {
      throw new Error("Narrow camera read projected hover and the full interaction state");
    };
    try {
      return app.getFPSCamera();
    } finally {
      internal.world.snapshot = worldSnapshot;
      internal.interaction.snapshot = interactionSnapshot;
    }
  };
  try {
    assert.equal(readWithoutSnapshots(), undefined);
    await app.dispatch({ type: "enterFPS" });
    await app.dispatch({ type: "pointerLockChanged", locked: true });
    await app.dispatch({ type: "run" });
    await app.dispatch({ type: "inputLook", movementX: 40, movementY: -20 });
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: true });
    for (let i = 0; i < 10; i++) app.advance(1 / 60);
    const expected = internal.interaction.snapshot().camera;
    const camera = readWithoutSnapshots()!;
    assert.deepEqual(camera, expected);
    assert.ok(camera.positionM[2] < 3.8);
    assert.notDeepEqual(camera.orientationQuaternion, [0, 0, 0, 1]);
    camera.positionM[0] = 123;
    camera.orientationQuaternion[3] = 0;
    assert.deepEqual(readWithoutSnapshots(), expected);
    await app.dispatch({ type: "exitFPS" });
    assert.equal(readWithoutSnapshots(), undefined);
    await app.dispatch({ type: "reset" });
    assert.equal(readWithoutSnapshots(), undefined);
    const project = JSON.parse(app.exportProject());
    project.scene.listener.positionM = [1, 1.6, 3];
    await app.importProject(JSON.stringify(project));
    assert.equal(readWithoutSnapshots(), undefined);
    await app.dispatch({ type: "enterFPS" });
    assert.deepEqual(readWithoutSnapshots()?.positionM, [1, 1.6, 3]);
    assert.equal(app.getSnapshot().error, "");
  } finally {
    app.dispose();
  }
});
