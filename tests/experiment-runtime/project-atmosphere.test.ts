import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBehaviors, createDefaultScene } from "../../src/app/defaults.js";
import {
  createProject,
  deserializeProject,
  serializeProject,
  ProjectStore,
} from "../../src/persistence/index.js";

function input() {
  const scene = createDefaultScene();
  scene.sources = [];
  return {
    projectId: "project.atmosphere",
    name: "環境設定",
    createdAt: "2026-11-02T00:00:00.000Z",
    scene,
    soundBehaviors: createDefaultBehaviors(scene),
    assets: [],
  };
}
const atmosphere = {
  medium: "vacuum",
  temperatureC: 35.5,
  speedOfSoundMps: 352.74,
  bandAbsorptionDbPerM: [0, 0.001, 0.002, 0.003, 0.004, 0.005, 0.006],
  dataClass: "Synthetic",
};

test("optional authored atmosphere roundtrip preserves every supplied field and isolates ownership", () => {
  const supplied = { ...input(), atmosphere: structuredClone(atmosphere) };
  const project = createProject(supplied);
  const encoded = serializeProject(project);
  const decoded = deserializeProject(encoded);
  assert.deepEqual(decoded.atmosphere, atmosphere);
  assert.equal(serializeProject(decoded), encoded);
  supplied.atmosphere.bandAbsorptionDbPerM[0] = 1;
  assert.equal(decoded.atmosphere!.bandAbsorptionDbPerM![0], 0);
  for (const temperatureC of [-80, 100])
    assert.equal(
      createProject({ ...input(), atmosphere: { medium: "air", temperatureC } }).atmosphere!
        .temperatureC,
      temperatureC,
    );
});

test("legacy validation keeps atmosphere absent and its serialization byte-identical", () => {
  const project = createProject(input());
  const bytes = serializeProject(project);
  assert.equal(Object.hasOwn(project, "atmosphere"), false);
  assert.equal(Object.hasOwn(deserializeProject(bytes), "atmosphere"), false);
  assert.equal(serializeProject(deserializeProject(bytes)), bytes);
});

test("invalid atmosphere is rejected atomically, including unused vacuum values", () => {
  const entries = new Map<string, string>();
  const store = new ProjectStore({
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  });
  store.save(createProject({ ...input(), atmosphere }));
  const prior = store.export();
  for (const candidate of [
    null,
    [],
    { medium: "water" },
    { medium: "vacuum", temperatureC: -81 },
    { medium: "vacuum", temperatureC: 101 },
    { medium: "air", speedOfSoundMps: 99 },
    { medium: "air", speedOfSoundMps: 1001 },
    { medium: "air", temperatureC: "20" },
    { medium: "air", bandAbsorptionDbPerM: [0, 0] },
    { medium: "air", bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, -1] },
    { medium: "air", bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 11] },
    { medium: "air", dataClass: "Unknown" },
    { medium: "air", engine: {} },
  ]) {
    assert.throws(() =>
      store.import(
        JSON.stringify({
          ...input(),
          schemaVersion: "1.0.0",
          revision: 1,
          recordings: [],
          updatedAt: "2026-11-02T00:00:00.000Z",
          atmosphere: candidate,
        }),
      ),
    );
    assert.equal(store.export(), prior);
  }
  for (const candidate of [
    { medium: "air", temperatureC: NaN },
    { medium: "air", speedOfSoundMps: Infinity },
    { medium: "air", bandAbsorptionDbPerM: new Array(7) },
  ])
    assert.throws(() => createProject({ ...input(), atmosphere: candidate }));
});
