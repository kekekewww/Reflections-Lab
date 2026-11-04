import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyCommand,
  createScene,
  deserializeScene,
  serializeScene,
  type SceneOperation,
  type SceneSpec,
  type SceneZone,
} from "../../src/scene/index.js";

const fixture = (): SceneSpec =>
  JSON.parse(readFileSync(new URL("../../schemas/examples/scene.json", import.meta.url), "utf8"));
const digest = (text: string): string => createHash("sha256").update(text).digest("hex");
const aabb = (id = "zone.test"): SceneZone => ({
  id,
  name: "Derived box zone",
  shape: "aabb",
  enabled: true,
  centerM: [0, 1, 0],
  halfExtentsM: [1, 2, 3],
  hysteresisM: 0.02,
});
const sphere = (id = "zone.sphere"): SceneZone => ({
  id,
  name: "Derived sphere zone",
  shape: "sphere",
  enabled: true,
  centerM: [2, 1, 0],
  radiusM: 0.5,
  hysteresisM: 0.02,
});
const withoutRevision = (scene: SceneSpec): SceneSpec => ({ ...scene, sceneRevision: 0 });
const run = (scene: SceneSpec, ...operations: SceneOperation[]) =>
  applyCommand(scene, { expectedSceneRevision: scene.sceneRevision, operations });

test("legacy scenes keep absent zones and identical canonical JSON bytes/hash", () => {
  const legacy = fixture();
  assert.equal(Object.hasOwn(legacy, "zones"), false);
  const bytes = JSON.stringify(legacy);
  const copied = createScene(legacy);
  assert.equal(Object.hasOwn(copied, "zones"), false);
  assert.equal(serializeScene(copied), bytes);
  assert.equal(digest(serializeScene(copied)), digest(bytes));
  assert.equal(serializeScene(deserializeScene(bytes)), bytes);
  const unrelated = run(copied, { type: "SetGravity", gravityMps2: [0, -9, 0] }).scene;
  assert.equal(Object.hasOwn(unrelated, "zones"), false);
});

test("optional empty arrays and finite closed aabb/sphere volumes roundtrip without default injection", () => {
  for (const zones of [[], [aabb()], [aabb(), sphere()]]) {
    const input = { ...fixture(), zones };
    const scene = createScene(input);
    assert.deepEqual(scene.zones, zones);
    assert.equal(serializeScene(scene), JSON.stringify(input));
    assert.deepEqual(deserializeScene(serializeScene(scene)), input);
    if (zones.length) zones[0]!.centerM[0] = 99;
    assert.notEqual(scene.zones?.[0]?.centerM[0], 99);
  }
});

test("zone IDs are stable and unique across every scene entity category", () => {
  const original = fixture();
  for (const id of [original.objects[0]!.id, original.sources[0]!.id, original.listener.id])
    assert.throws(() => createScene({ ...original, zones: [aabb(id)] }));
  assert.throws(() => createScene({ ...original, zones: [aabb(), aabb()] }));
  for (const id of ["", "UPPER", "has space", "1numeric", "x".repeat(65)])
    assert.throws(() => createScene({ ...original, zones: [aabb(id)] }));
});

test("zone schema rejects invalid shapes, unknown fields, bounds, sparse arrays and nonfinite data", () => {
  const invalid: unknown[] = [
    { ...aabb(), shape: "mesh" },
    { ...aabb(), phantomBody: true },
    { ...aabb(), radiusM: 1 },
    { ...sphere(), halfExtentsM: [1, 1, 1] },
    { ...aabb(), enabled: 1 },
    { ...aabb(), name: "" },
    { ...aabb(), name: "   " },
    { ...aabb(), name: "x".repeat(81) },
    { ...aabb(), centerM: [201, 0, 0] },
    { ...aabb(), centerM: [NaN, 0, 0] },
    { ...aabb(), halfExtentsM: [0.049, 1, 1] },
    { ...aabb(), halfExtentsM: [1, 50.01, 1] },
    { ...aabb(), halfExtentsM: [1, 1] },
    { ...sphere(), radiusM: 0 },
    { ...sphere(), radiusM: Infinity },
    { ...sphere(), radiusM: 51 },
    { ...sphere(), hysteresisM: -0.001 },
    { ...sphere(), hysteresisM: 0.251 },
  ];
  for (const zone of invalid) assert.throws(() => createScene({ ...fixture(), zones: [zone] }));
  const sparse = new Array(1);
  assert.throws(() => createScene({ ...fixture(), zones: sparse }));
  const extraArray = Object.assign([aabb()], { hiddenRole: "sensor" });
  assert.throws(() => createScene({ ...fixture(), zones: extraArray }));
  assert.throws(() => createScene({ ...fixture(), zones: null }));
  assert.throws(() => createScene({ ...fixture(), zones: undefined }));
});

test("hysteresis cannot eliminate the enter volume and dimensions obey the exact accepted boundary", () => {
  assert.doesNotThrow(() =>
    createScene({
      ...fixture(),
      zones: [
        { ...aabb(), halfExtentsM: [0.05, 50, 1], hysteresisM: 0 },
        { ...sphere(), radiusM: 0.05, hysteresisM: 0.049 },
      ],
    }),
  );
  for (const zone of [
    { ...aabb(), halfExtentsM: [0.05, 1, 1], hysteresisM: 0.05 },
    { ...sphere(), radiusM: 0.1, hysteresisM: 0.1 },
  ])
    assert.throws(() => createScene({ ...fixture(), zones: [zone] }));
});

test("zone quota allows sixteen and rejects the seventeenth without partial transaction mutation", () => {
  const scene = createScene({
    ...fixture(),
    zones: Array.from({ length: 16 }, (_, i) => aabb(`zone.${i}`)),
  });
  const before = serializeScene(scene);
  assert.equal(scene.zones?.length, 16);
  assert.throws(() => run(scene, { type: "AddZone", zone: aabb("zone.overflow") }));
  assert.equal(serializeScene(scene), before);
  assert.throws(() =>
    createScene({ ...fixture(), zones: Array.from({ length: 17 }, (_, i) => aabb(`zone.${i}`)) }),
  );
});

test("AddZone is isolated, advances revision once, and Undo restores legacy property absence", () => {
  const original = createScene(fixture()),
    zone = aabb();
  const added = run(original, { type: "AddZone", zone });
  assert.equal(added.scene.sceneRevision, 1);
  assert.deepEqual(added.scene.zones, [zone]);
  assert.equal(Object.hasOwn(original, "zones"), false);
  zone.centerM[0] = 20;
  assert.equal(added.scene.zones?.[0]?.centerM[0], 0);
  assert.deepEqual(added.inverse.operations, [{ type: "SetZones", zones: null }]);
  const undone = applyCommand(added.scene, added.inverse).scene;
  assert.equal(Object.hasOwn(undone, "zones"), false);
  assert.equal(serializeScene(withoutRevision(undone)), serializeScene(original));
});

test("AddZone Undo retains an explicitly empty array instead of converting it to absence", () => {
  const original = createScene({ ...fixture(), zones: [] });
  const added = run(original, { type: "AddZone", zone: aabb() });
  assert.deepEqual(added.inverse.operations, [{ type: "SetZones", zones: [] }]);
  const undone = applyCommand(added.scene, added.inverse).scene;
  assert.equal(Object.hasOwn(undone, "zones"), true);
  assert.deepEqual(undone.zones, []);
});

test("full zone update changes shape and enablement atomically, retains order, and is undoable", () => {
  const original = createScene({ ...fixture(), zones: [aabb(), sphere()] });
  const replacement = { ...sphere("zone.test"), name: "Updated", enabled: false };
  const changed = run(original, { type: "UpdateZone", zone: replacement });
  assert.equal(changed.scene.zones?.[0]?.shape, "sphere");
  assert.equal(changed.scene.zones?.[0]?.enabled, false);
  assert.equal(changed.scene.zones?.[1]?.id, "zone.sphere");
  assert.deepEqual(
    withoutRevision(applyCommand(changed.scene, changed.inverse).scene),
    withoutRevision(original),
  );
  assert.throws(() => run(original, { type: "UpdateZone", zone: aabb("zone.unknown") }));
});

test("RemoveZone preserves the remaining order, rejects unknown IDs, and restores exact authored data", () => {
  const original = createScene({
    ...fixture(),
    zones: [aabb("zone.a"), sphere("zone.b"), aabb("zone.c")],
  });
  const removed = run(original, { type: "RemoveZone", zoneId: "zone.b" });
  assert.deepEqual(
    removed.scene.zones?.map((zone) => zone.id),
    ["zone.a", "zone.c"],
  );
  assert.deepEqual(
    withoutRevision(applyCommand(removed.scene, removed.inverse).scene),
    withoutRevision(original),
  );
  assert.throws(() => run(original, { type: "RemoveZone", zoneId: "zone.unknown" }));
});

test("zone edits reject stale revisions and a later invalid operation rolls the entire transaction back", () => {
  const original = createScene(fixture()),
    before = serializeScene(original);
  assert.throws(() =>
    applyCommand(original, {
      expectedSceneRevision: 1,
      operations: [{ type: "AddZone", zone: aabb() }],
    }),
  );
  assert.throws(() =>
    run(
      original,
      { type: "AddZone", zone: aabb() },
      { type: "UpdateZone", zone: { ...sphere(), radiusM: -1 } },
    ),
  );
  assert.throws(() =>
    run(original, { type: "AddZone", zone: aabb() }, { type: "AddZone", zone: aabb() }),
  );
  assert.equal(serializeScene(original), before);
});

test("new objects and sources cannot collide with zone domain IDs", () => {
  const scene = createScene({ ...fixture(), zones: [aabb()] });
  assert.throws(() =>
    run(scene, { type: "AddObject", object: { ...scene.objects[0]!, id: "zone.test" } }),
  );
  assert.throws(() =>
    run(scene, { type: "AddSource", source: { ...scene.sources[0]!, id: "zone.test" } }),
  );
  assert.throws(() =>
    run(scene, { type: "SetListener", listener: { ...scene.listener, id: "zone.test" } }),
  );
});

test("SetZones null/array is reversible and malformed command forms are rejected", () => {
  const original = createScene({ ...fixture(), zones: [aabb()] });
  const omitted = run(original, { type: "SetZones", zones: null });
  assert.equal(Object.hasOwn(omitted.scene, "zones"), false);
  assert.deepEqual(
    withoutRevision(applyCommand(omitted.scene, omitted.inverse).scene),
    withoutRevision(original),
  );
  for (const operation of [
    { type: "SetZones", zones: {} },
    { type: "SetZones", zones: new Array(1) },
    { type: "SetZones", zones: null, extra: true },
    { type: "AddZone" },
    { type: "UpdateZone", zone: null },
    { type: "RemoveZone", zoneId: 1 },
    { type: "RemoveZone", zoneId: "zone.test", role: "sensor" },
  ])
    assert.throws(() =>
      applyCommand(original, {
        expectedSceneRevision: original.sceneRevision,
        operations: [operation],
      }),
    );
});

test("a maximum sixty-four-operation zone transaction has a bounded inverse that restores authored bytes", () => {
  const original = createScene({
    ...fixture(),
    zones: Array.from({ length: 16 }, (_, i) => aabb(`zone.${i}`)),
  });
  const operations: SceneOperation[] = Array.from({ length: 64 }, (_, i) => ({
    type: "UpdateZone",
    zone: { ...aabb(`zone.${i % 16}`), name: `Edit ${i}`, centerM: [i / 10, 1, 0] },
  }));
  const changed = run(original, ...operations);
  assert.equal(changed.scene.sceneRevision, 1);
  assert.equal(changed.inverse.operations.length, 64);
  const restored = applyCommand(changed.scene, changed.inverse).scene;
  assert.equal(serializeScene(withoutRevision(restored)), serializeScene(original));
});
