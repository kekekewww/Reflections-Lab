import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyCommand, createScene } from "../../src/scene/index.js";

const fixture = () =>
  JSON.parse(readFileSync(new URL("../../schemas/examples/scene.json", import.meta.url), "utf8"));

test("A duplicate ID cannot be introduced temporarily and hidden by a later removal", () => {
  const original = createScene(fixture());
  const duplicate = structuredClone(original.objects[0]!);
  duplicate.positionM = [2, 3, 4];
  assert.throws(() =>
    applyCommand(original, {
      expectedSceneRevision: 0,
      operations: [
        { type: "AddObject", object: duplicate },
        { type: "RemoveObject", objectId: "ball" },
      ],
    }),
  );
  assert.deepEqual(original, fixture());
});

test("RestoreObject cannot smuggle sources owned by a different object past its inverse", () => {
  const original = createScene(fixture());
  const restoredObject = { ...structuredClone(original.objects[0]!), id: "restored-ball" };
  const foreignSource = {
    ...structuredClone(original.sources[0]!),
    id: "foreign-source",
    objectId: "ball",
  };
  assert.throws(() =>
    applyCommand(original, {
      expectedSceneRevision: 0,
      operations: [
        {
          type: "RestoreObject",
          object: restoredObject,
          index: 1,
          sources: [{ source: foreignSource, index: 1 }],
        },
      ],
    }),
  );
  assert.deepEqual(original, fixture());
});

test("A maximum-size removal transaction has a bounded inverse and restores all source order", () => {
  const input = fixture();
  const templateObject = structuredClone(input.objects[0]);
  const templateSource = structuredClone(input.sources[0]);
  input.objects = Array.from({ length: 64 }, (_, index) => ({
    ...templateObject,
    id: `body-${index}`,
    positionM: [index, 1, 0],
  }));
  input.sources = Array.from({ length: 32 }, (_, index) => ({
    ...templateSource,
    id: `source-${index}`,
    objectId: `body-${(index * 7) % 64}`,
  }));
  const original = createScene(input);
  const removed = applyCommand(original, {
    expectedSceneRevision: 0,
    operations: input.objects.map((object: { id: string }) => ({
      type: "RemoveObject",
      objectId: object.id,
    })),
  });
  assert.deepEqual(removed.scene.objects, []);
  assert.deepEqual(removed.scene.sources, []);
  assert.equal(removed.inverse.operations.length, 64);
  const restored = applyCommand(removed.scene, removed.inverse).scene;
  assert.equal(restored.sceneRevision, 2);
  assert.deepEqual({ ...restored, sceneRevision: 0 }, input);
  assert.deepEqual(original, input);
});
