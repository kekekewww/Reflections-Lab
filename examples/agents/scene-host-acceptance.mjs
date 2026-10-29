// Future P0-01 host slice acceptance. No product implementation lives here.
// All expected values come from the preserved SceneSpec fixture and literal assertions.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { sceneDomainErrors } from "../../scripts/validation/domain-checks.mjs";

assert.ok(process.argv[2], "Pass the isolated candidate workspace as argv[2]");
const workspace = path.resolve(process.argv[2]);
const candidate = await import(pathToFileURL(path.join(workspace, "src/scene-host.mjs")));
for (const name of ["createScene", "applyCommand", "serializeScene", "deserializeScene"]) {
  assert.equal(typeof candidate[name], "function", `Missing host export: ${name}`);
}
const { createScene, applyCommand, serializeScene, deserializeScene } = candidate;
const schema = JSON.parse(
  readFileSync(new URL("../../schemas/scene.schema.json", import.meta.url), "utf8"),
);
const fixture = JSON.parse(
  readFileSync(new URL("../../schemas/examples/scene.json", import.meta.url), "utf8"),
);
const validScene = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const clone = (value) => structuredClone(value);
const assertValid = (scene) => {
  assert.equal(validScene(scene), true, JSON.stringify(validScene.errors));
  assert.deepEqual(sceneDomainErrors(scene), []);
};

// API: synchronous pure SceneSpec functions; internal runtime engine objects are never serialized.
const callerInput = clone(fixture);
const scene = createScene(callerInput);
assertValid(scene);
assert.deepEqual(scene, fixture);
assert.notEqual(scene, callerInput);
callerInput.objects[0].positionM[0] = 99;
assert.deepEqual(scene.objects[0].positionM, [0, 1, 0]);

const serialized = serializeScene(scene);
assert.equal(typeof serialized, "string");
assert.deepEqual(JSON.parse(serialized), fixture);
const restored = deserializeScene(serialized);
assertValid(restored);
assert.deepEqual(restored, fixture);
restored.objects[0].positionM[1] = 99;
assert.deepEqual(scene.objects[0].positionM, [0, 1, 0]);
assert.throws(() => deserializeScene("{ malformed"));

const invalidInputs = [
  (value) => {
    value.objects.push(clone(value.objects[0]));
  },
  (value) => {
    value.sources[0].objectId = "missing-object";
  },
  (value) => {
    value.objects[0].orientationQuaternion = [0, 0, 0, 0];
  },
  (value) => {
    value.objects[0].massKg = -1;
  },
  (value) => {
    value.objects[0].positionM[0] = NaN;
  },
  (value) => {
    value.objects[0].dimensionsM = [0.2, 0.3, 0.2];
  },
  (value) => {
    value.listener.id = value.objects[0].id;
  },
  (value) => {
    value.units = "cm";
  },
  (value) => {
    value.runtimeHandle = 5;
  },
  (value) => {
    value.objects = Array.from({ length: 257 }, (_, index) => ({
      ...clone(value.objects[0]),
      id: `ball-${index}`,
    }));
    value.sources[0].objectId = "ball-0";
  },
];
for (const invalidate of invalidInputs) {
  const invalid = clone(fixture);
  invalidate(invalid);
  assert.throws(() => createScene(invalid), "Invalid SceneSpec must be rejected");
  // NaN has no JSON representation; createScene rejection above covers pre-JSON input.
  if (!Number.isNaN(invalid.objects[0]?.positionM[0]))
    assert.throws(() => deserializeScene(JSON.stringify(invalid)));
}
assert.deepEqual(scene, fixture, "Failed imports cannot alter an already open scene");

const twoObjects = clone(fixture);
twoObjects.objects.push({ ...clone(fixture.objects[0]), id: "other-ball", positionM: [5, 1, 0] });
const original = createScene(twoObjects);
const command = {
  expectedSceneRevision: 0,
  operations: [
    {
      type: "SetTransform",
      objectId: "ball",
      positionM: [1, 2, -3],
      orientationQuaternion: [0, 0, 0, 1],
    },
    {
      type: "SetTransform",
      objectId: "other-ball",
      positionM: [-4, 3, 2],
      orientationQuaternion: [0, 0, 0, 1],
    },
  ],
};
const changed = applyCommand(original, command);
assertValid(changed.scene);
assert.equal(changed.scene.sceneRevision, 1);
assert.deepEqual(
  changed.scene.objects.map((object) => object.id),
  ["ball", "other-ball"],
);
assert.deepEqual(changed.scene.objects[0].positionM, [1, 2, -3]);
assert.deepEqual(changed.scene.objects[1].positionM, [-4, 3, 2]);
assert.deepEqual(changed.scene.sources, fixture.sources);
assert.deepEqual(changed.scene.listener, fixture.listener);
assert.deepEqual(original, twoObjects, "Command must not mutate its input document");
assert.equal(changed.inverse.expectedSceneRevision, 1);

const undone = applyCommand(changed.scene, changed.inverse).scene;
assertValid(undone);
assert.equal(undone.sceneRevision, 2, "Undo preserves monotonic transaction revision");
assert.deepEqual({ ...undone, sceneRevision: 0 }, twoObjects);
assert.throws(() => applyCommand(changed.scene, command), { code: "STALE_REVISION" });
const beforeFailure = clone(original);
assert.throws(
  () =>
    applyCommand(original, {
      expectedSceneRevision: 0,
      operations: [
        ...command.operations.slice(0, 1),
        { ...command.operations[1], objectId: "missing-object" },
      ],
    }),
  { code: "UNKNOWN_ID" },
);
assert.deepEqual(
  original,
  beforeFailure,
  "Partial command failures must roll back every operation",
);
assert.throws(() =>
  applyCommand(original, {
    expectedSceneRevision: 0,
    operations: [{ ...command.operations[0], orientationQuaternion: [0, 0, 0, 0] }],
  }),
);
assert.deepEqual(original, beforeFailure);

// A reordered input still targets stable domain IDs rather than array positions.
const reordered = createScene({
  ...clone(twoObjects),
  objects: [...clone(twoObjects.objects)].reverse(),
});
const byId = applyCommand(reordered, {
  expectedSceneRevision: 0,
  operations: command.operations.slice(0, 1),
}).scene;
assert.deepEqual(byId.objects.find((object) => object.id === "ball").positionM, [1, 2, -3]);
assert.deepEqual(byId.objects.find((object) => object.id === "other-ball").positionM, [5, 1, 0]);
console.log(
  JSON.stringify({
    status: "PASS",
    scope: "future-P0-01-scene-host-slice",
    validation_mode: "OFFLINE_INDEPENDENT_ACCEPTANCE",
    not_run: ["Rapier fixed step", "Four body modes", "Browser UI", "Product Meta runtime"],
  }),
);
