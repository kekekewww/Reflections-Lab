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

test("deleting the selected object clears selection instead of selecting another stable ID", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    assert.equal(app.getSnapshot().selectedObjectId, "ball");
    await app.dispatch({ type: "removeObject", objectId: "ball" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(
      app.getSceneDocument().objects.some((object) => object.id === "ball"),
      false,
    );
    assert.equal(app.getSnapshot().selectedObjectId, null);
  } finally {
    app.dispose();
  }
});

test("deleting another object preserves the currently selected stable ID", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    await app.dispatch({ type: "removeObject", objectId: "wall.back" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(app.getSnapshot().selectedObjectId, "ball");
  } finally {
    app.dispose();
  }
});

test("undo restores the deleted object without silently assigning a new selection", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    await app.dispatch({ type: "removeObject", objectId: "ball" });
    await app.dispatch({ type: "undo" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(
      app.getSceneDocument().objects.some((object) => object.id === "ball"),
      true,
    );
    assert.equal(app.getSnapshot().selectedObjectId, null);
  } finally {
    app.dispose();
  }
});
