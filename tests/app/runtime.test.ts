import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
test("app commands edit real Scene and reject invalid input atomically", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  const before = app.getSceneDocument();
  await app.dispatch({ type: "patchObject", objectId: "ball", patch: { massKg: -1 } });
  assert.deepEqual(app.getSceneDocument(), before);
  assert.ok(app.getSnapshot().error);
  await app.dispatch({ type: "addObject", shape: "box" });
  assert.equal(app.getSceneDocument().objects.length, before.objects.length + 1);
  assert.equal(app.getSceneDocument().sceneRevision, before.sceneRevision + 1);
  await app.dispatch({ type: "undo" });
  assert.deepEqual(app.getSceneDocument().objects, before.objects);
  await app.dispatch({ type: "redo" });
  assert.equal(app.getSceneDocument().objects.length, before.objects.length + 1);
  app.dispose();
});
test("app Run/Pause/Reset drives actual fixed-step Rapier and preserves author document", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  const initial = app.getSceneDocument();
  const start = app.getPose("ball")!.positionM[1];
  await app.dispatch({ type: "run" });
  for (let i = 0; i < 30; i++) app.advance(1 / 60);
  assert.ok(app.getPose("ball")!.positionM[1] < start);
  const tick = app.getSnapshot().tick;
  await app.dispatch({ type: "pause" });
  app.advance(1);
  assert.equal(app.getSnapshot().tick, tick);
  assert.deepEqual(app.getSceneDocument(), initial);
  await app.dispatch({ type: "reset" });
  assert.equal(app.getSnapshot().tick, 0);
  assert.equal(app.getPose("ball")!.positionM[1], start);
  app.dispose();
});
test("project save/load and invalid import preserve scene and sound behavior", async () => {
  const storage = memory(),
    app = await LabRuntime.create({ storage, useWorker: false });
  await app.dispatch({ type: "addRule", objectId: "ball", trigger: "WhileMoving" });
  const saved = app.exportProject();
  await app.dispatch({ type: "save" });
  const before = app.getSceneDocument(),
    rules = app.getBehaviorDocument();
  await assert.rejects(app.importProject("{bad"));
  assert.deepEqual(app.getSceneDocument(), before);
  assert.deepEqual(app.getBehaviorDocument(), rules);
  await app.dispatch({ type: "addObject", shape: "sphere" });
  await app.importProject(saved);
  assert.deepEqual(app.getSceneDocument(), before);
  assert.deepEqual(app.getBehaviorDocument(), rules);
  app.dispose();
});
