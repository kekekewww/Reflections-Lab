import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyCommand,
  createScene,
  deserializeScene,
  SceneHost,
  serializeScene,
} from "../../src/scene/index.js";

const fixture = () =>
  JSON.parse(readFileSync(new URL("../../schemas/examples/scene.json", import.meta.url), "utf8"));
const clone = <T>(value: T): T => structuredClone(value);
const ball = () => fixture().objects[0];
const secondBall = () => ({ ...ball(), id: "ball-two", positionM: [4, 2, 0] });
const transform = (objectId = "ball", positionM = [1, 2, -3]) => ({
  type: "SetTransform" as const,
  objectId,
  positionM,
  orientationQuaternion: [0, 0, 0, 1],
});
const withoutRevision = (value: unknown) => ({
  ...(value as object),
  sceneRevision: 0,
});

test("SceneSpec roundtrip preserves stable IDs, source metadata and caller isolation", () => {
  const input = fixture();
  const scene = createScene(input);
  const exported = serializeScene(scene);
  assert.deepEqual(JSON.parse(exported), input);
  assert.deepEqual(deserializeScene(exported), input);
  input.objects[0].positionM[0] = 100;
  input.sources[0].playing = true;
  assert.deepEqual(scene.objects[0]?.positionM, [0, 1, 0]);
  assert.equal(scene.sources[0]?.playing, false);
  const restored = deserializeScene(exported);
  restored.listener.positionM[0] = 7;
  assert.equal(scene.listener.positionM[0], 0);
});

test("Scene IDs are unique across objects, sources and listener", () => {
  for (const mutate of [
    (s: ReturnType<typeof fixture>) => s.objects.push(clone(s.objects[0])),
    (s: ReturnType<typeof fixture>) => (s.sources[0].id = s.objects[0].id),
    (s: ReturnType<typeof fixture>) => (s.listener.id = s.sources[0].id),
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => createScene(input));
  }
});

test("Domain and schema errors reject invalid dimensions, orientations and references", () => {
  for (const mutate of [
    (s: ReturnType<typeof fixture>) => (s.objects[0].dimensionsM = [0.2, 0.3, 0.2]),
    (s: ReturnType<typeof fixture>) => (s.objects[0].orientationQuaternion = [0, 0, 0, 0]),
    (s: ReturnType<typeof fixture>) => (s.objects[0].orientationQuaternion = [0, 0, 0, 0.8]),
    (s: ReturnType<typeof fixture>) => (s.objects[0].massKg = -1),
    (s: ReturnType<typeof fixture>) => (s.objects[0].positionM[0] = NaN),
    (s: ReturnType<typeof fixture>) => (s.objects[0].restitution = Infinity),
    (s: ReturnType<typeof fixture>) => (s.sources[0].objectId = "unknown-body"),
    (s: ReturnType<typeof fixture>) => (s.objects[0].shape = "mesh"),
    (s: ReturnType<typeof fixture>) => (s.units = "cm"),
    (s: ReturnType<typeof fixture>) => (s.runtimeHandle = 5),
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => createScene(input));
  }
  const capsule = fixture();
  capsule.objects[0].shape = "capsule";
  capsule.objects[0].dimensionsM = [0.4, 0.3, 0.4];
  assert.throws(() => createScene(capsule));
  capsule.objects[0].dimensionsM = [0.4, 1.2, 0.4];
  assert.doesNotThrow(() => createScene(capsule));
});

test("Canonical scene object and source quotas are enforced", () => {
  const input = fixture();
  input.objects = Array.from({ length: 257 }, (_, i) => ({ ...ball(), id: `ball-${i}` }));
  input.sources[0].objectId = "ball-0";
  assert.throws(() => createScene(input));
  const sources = fixture();
  sources.sources = Array.from({ length: 33 }, (_, i) => ({
    ...sources.sources[0],
    id: `source-${i}`,
  }));
  assert.throws(() => createScene(sources));
});

test("Deserialize rejects malformed, oversized and non-scene data", () => {
  assert.throws(() => deserializeScene("{ malformed"));
  assert.throws(() => deserializeScene("null"));
  assert.throws(() => deserializeScene("[]"));
  const valid = JSON.stringify(fixture());
  assert.throws(() => deserializeScene(" ".repeat(2 * 1024 * 1024 + 1) + valid));
});

test("Stable IDs target a reordered input and inverse restores the exact document", () => {
  const input = fixture();
  input.objects.unshift(secondBall());
  const original = createScene(input);
  const changed = applyCommand(original, {
    expectedSceneRevision: 0,
    operations: [transform("ball"), transform("ball-two", [-4, 3, 1])],
  });
  assert.equal(changed.scene.sceneRevision, 1);
  assert.deepEqual(changed.scene.objects.find((o) => o.id === "ball")?.positionM, [1, 2, -3]);
  assert.deepEqual(changed.scene.objects.find((o) => o.id === "ball-two")?.positionM, [-4, 3, 1]);
  assert.deepEqual(original, input);
  const undone = applyCommand(changed.scene, changed.inverse).scene;
  assert.equal(undone.sceneRevision, 2);
  assert.deepEqual(withoutRevision(undone), input);
});

test("Second operation failure cannot partially mutate the caller document", () => {
  const input = createScene(fixture());
  const before = clone(input);
  assert.throws(
    () =>
      applyCommand(input, {
        expectedSceneRevision: 0,
        operations: [transform(), transform("missing-object")],
      }),
    { code: "UNKNOWN_ID" },
  );
  assert.deepEqual(input, before);
  assert.throws(() =>
    applyCommand(input, {
      expectedSceneRevision: 0,
      operations: [transform(), { type: "SetPhysics", objectId: "ball", massKg: -2 }],
    }),
  );
  assert.deepEqual(input, before);
});

test("Transactions reject stale revisions, unknown operations and extra command fields", () => {
  const input = createScene(fixture());
  const invalidCommands = [
    { expectedSceneRevision: 0, operations: [] },
    { expectedSceneRevision: 0, operations: Array.from({ length: 65 }, () => transform()) },
    { expectedSceneRevision: 0, operations: [{ type: "RunJavaScript", code: "1+1" }] },
    { expectedSceneRevision: 0, operations: [{ ...transform(), runtimeHandle: 9 }] },
    { expectedSceneRevision: 0, operations: [transform()], secretOption: true },
    { expectedSceneRevision: NaN, operations: [transform()] },
  ];
  for (const command of invalidCommands) assert.throws(() => applyCommand(input, command));
  const changed = applyCommand(input, { expectedSceneRevision: 0, operations: [transform()] });
  assert.throws(
    () => applyCommand(changed.scene, { expectedSceneRevision: 0, operations: [transform()] }),
    { code: "STALE_REVISION" },
  );
  assert.deepEqual(input, fixture());
});

test("Removing an object removes attached sources and undo restores source ordering", () => {
  const input = fixture();
  input.objects.push(secondBall());
  input.sources.push({ ...input.sources[0], id: "source-second", objectId: "ball-two" });
  input.sources.push({ ...input.sources[0], id: "source-extra" });
  const original = createScene(input);
  const removed = applyCommand(original, {
    expectedSceneRevision: 0,
    operations: [{ type: "RemoveObject", objectId: "ball" }],
  });
  assert.deepEqual(
    removed.scene.objects.map((o) => o.id),
    ["ball-two"],
  );
  assert.deepEqual(
    removed.scene.sources.map((s) => s.id),
    ["source-second"],
  );
  const restored = applyCommand(removed.scene, removed.inverse).scene;
  assert.deepEqual(withoutRevision(restored), input);
});

test("Create object and source in one atomic transaction then undo both", () => {
  const original = createScene(fixture());
  const object = secondBall();
  const source = { ...fixture().sources[0], id: "new-source", objectId: object.id };
  const changed = applyCommand(original, {
    expectedSceneRevision: 0,
    operations: [
      { type: "AddObject", object },
      { type: "AddSource", source },
    ],
  });
  object.positionM[0] = 100;
  source.playing = true;
  assert.deepEqual(changed.scene.objects.find((o) => o.id === "ball-two")?.positionM, [4, 2, 0]);
  assert.equal(changed.scene.sources.find((s) => s.id === "new-source")?.playing, false);
  assert.deepEqual(withoutRevision(applyCommand(changed.scene, changed.inverse).scene), fixture());
});

test("Source edits validate references and support invertible update and removal", () => {
  const original = createScene(fixture());
  assert.throws(() =>
    applyCommand(original, {
      expectedSceneRevision: 0,
      operations: [
        { type: "UpdateSource", sourceId: "source-ball", patch: { objectId: "missing" } },
      ],
    }),
  );
  const changed = applyCommand(original, {
    expectedSceneRevision: 0,
    operations: [
      { type: "UpdateSource", sourceId: "source-ball", patch: { playing: true, gainDbfs: -18 } },
    ],
  });
  assert.equal(changed.scene.sources[0]?.playing, true);
  assert.equal(changed.scene.sources[0]?.gainDbfs, -18);
  assert.deepEqual(withoutRevision(applyCommand(changed.scene, changed.inverse).scene), fixture());
  const removed = applyCommand(changed.scene, {
    expectedSceneRevision: 1,
    operations: [{ type: "RemoveSource", sourceId: "source-ball" }],
  });
  assert.deepEqual(removed.scene.sources, []);
  assert.deepEqual(
    withoutRevision(applyCommand(removed.scene, removed.inverse).scene),
    withoutRevision(changed.scene),
  );
});

test("Physics mode, mechanical and acoustic metadata edits are invertible", () => {
  for (const mode of ["dynamicGravity", "dynamicNoGravity", "fixed", "kinematic"] as const) {
    const original = createScene(fixture());
    const changed = applyCommand(original, {
      expectedSceneRevision: 0,
      operations: [
        { type: "SetObjectMode", objectId: "ball", mode },
        { type: "SetPhysics", objectId: "ball", massKg: 2, friction: 0.2, restitution: 0.8 },
        {
          type: "SetMaterial",
          objectId: "ball",
          physicsMaterialId: "physics-custom",
          acousticMaterialId: "synthetic-absorbent",
          acousticRole: "dynamicOccluder",
        },
      ],
    });
    assert.equal(changed.scene.objects[0]?.mode, mode);
    assert.equal(changed.scene.objects[0]?.massKg, 2);
    assert.equal(changed.scene.objects[0]?.acousticMaterialId, "synthetic-absorbent");
    assert.deepEqual(
      withoutRevision(applyCommand(changed.scene, changed.inverse).scene),
      fixture(),
    );
  }
});

test("Gravity and listener changes preserve scene content and support undo", () => {
  const original = createScene(fixture());
  const listener = { ...original.listener, positionM: [1, 1.6, 3] };
  const changed = applyCommand(original, {
    expectedSceneRevision: 0,
    operations: [
      { type: "SetGravity", gravityMps2: [0, 0, 0] },
      { type: "SetListener", listener },
    ],
  });
  assert.deepEqual(changed.scene.gravityMps2, [0, 0, 0]);
  assert.deepEqual(changed.scene.listener.positionM, [1, 1.6, 3]);
  assert.deepEqual(changed.scene.sources, original.sources);
  assert.deepEqual(withoutRevision(applyCommand(changed.scene, changed.inverse).scene), fixture());
});

test("SceneHost undo/redo is monotonic and external snapshots cannot mutate its state", () => {
  const host = new SceneHost(fixture());
  const before = host.scene;
  host.apply({ expectedSceneRevision: 0, operations: [transform()] });
  const external = host.scene;
  external.objects[0]!.positionM[0] = 99;
  assert.deepEqual(host.scene.objects[0]?.positionM, [1, 2, -3]);
  assert.deepEqual(before, fixture());
  host.undo();
  assert.equal(host.scene.sceneRevision, 2);
  assert.deepEqual(withoutRevision(host.scene), fixture());
  host.redo();
  assert.equal(host.scene.sceneRevision, 3);
  assert.deepEqual(host.scene.objects[0]?.positionM, [1, 2, -3]);
  assert.deepEqual(JSON.parse(host.export()), host.scene);
});

test("SceneHost invalid import and failed commands preserve open document and history", () => {
  const host = new SceneHost(fixture());
  host.apply({ expectedSceneRevision: 0, operations: [transform()] });
  const before = host.scene;
  assert.throws(() => host.import("{ malformed"));
  const invalid = fixture();
  invalid.objects[0].massKg = -1;
  assert.throws(() => host.import(JSON.stringify(invalid)));
  assert.throws(() => host.apply({ expectedSceneRevision: 1, operations: [transform("missing")] }));
  assert.deepEqual(host.scene, before);
  host.undo();
  assert.deepEqual(withoutRevision(host.scene), fixture());
});
