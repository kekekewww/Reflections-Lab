import test from "node:test";
import assert from "node:assert/strict";
import { zoneRegistryPin } from "../../src/app/zone-registry-pin.js";
import { LabRuntime } from "../../src/app/runtime.js";
import type { SceneZone } from "../../src/scene/types.js";

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
const box: SceneZone = {
  id: "zone.room",
  name: "Room",
  shape: "aabb",
  centerM: [0, 1, 0],
  halfExtentsM: [1, 1, 1],
  hysteresisM: 0.02,
  enabled: true,
};
async function save(
  app: LabRuntime,
  zone: SceneZone,
  revision = app.getSceneDocument().sceneRevision,
) {
  await app.dispatch({
    type: "saveZone",
    zone,
    expectedSceneRevision: revision,
    expectedZoneRegistryPin: zoneRegistryPin(app.getSceneDocument().zones),
  });
}

test("LabRuntime creates, updates and disables a real zone without phantom scene objects or roles", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    const initial = app.getSceneDocument();
    assert.equal(Object.hasOwn(initial, "zones"), false);
    await save(app, box);
    assert.equal(app.getSnapshot().error, "");
    assert.deepEqual(app.getSceneDocument().zones, [box]);
    assert.deepEqual(app.getSnapshot().zones, [box]);
    assert.deepEqual(app.getSceneDocument().objects, initial.objects);
    assert.deepEqual(app.getSceneDocument().sources, initial.sources);
    const sphere: SceneZone = {
      id: box.id,
      name: "Sphere",
      shape: "sphere",
      centerM: [1, 2, 3],
      radiusM: 2,
      hysteresisM: 0.1,
      enabled: true,
    };
    await save(app, sphere);
    assert.equal(app.getSnapshot().error, "");
    assert.deepEqual(app.getSceneDocument().zones, [sphere]);
    await save(app, { ...sphere, enabled: false });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(app.getSceneDocument().zones?.[0]?.enabled, false);
    assert.equal(app.getSceneDocument().sceneRevision, initial.sceneRevision + 3);
  } finally {
    app.dispose();
  }
});

test("invalid raw zone values and duplicate domain IDs leave Scene and read model unchanged", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    const before = app.getSceneDocument();
    for (const invalid of [
      { ...box, hysteresisM: 2 },
      { ...box, id: "ball" },
      { ...box, centerM: [NaN, 0, 0] as [number, number, number] },
      { ...box, halfExtentsM: [0, 1, 1] as [number, number, number] },
      { ...box, name: "" },
    ]) {
      await save(app, invalid);
      assert.ok(app.getSnapshot().error);
      assert.deepEqual(app.getSceneDocument(), before);
      assert.deepEqual(app.getSnapshot().zones ?? [], []);
    }
  } finally {
    app.dispose();
  }
});

test("stale revisions and running state reject zone edits before committing any change", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    const initialRevision = app.getSceneDocument().sceneRevision;
    await save(app, box);
    const before = app.getSceneDocument();
    await save(app, { ...box, name: "Stale" }, initialRevision);
    assert.match(app.getSnapshot().error ?? "", /REVISION_CONFLICT/);
    assert.deepEqual(app.getSceneDocument(), before);
    await app.dispatch({ type: "run" });
    await save(app, { ...box, name: "During run" });
    assert.match(app.getSnapshot().error ?? "", /ZONE_EDIT_BLOCKED/);
    assert.deepEqual(app.getSceneDocument(), before);
  } finally {
    app.dispose();
  }
});

test("zone undo and redo preserve the original absence of the optional legacy zones field", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    const before = app.getSceneDocument();
    await save(app, box);
    await app.dispatch({ type: "undo" });
    const undone = app.getSceneDocument();
    assert.equal(Object.hasOwn(undone, "zones"), false);
    assert.deepEqual(undone.objects, before.objects);
    assert.deepEqual(undone.sources, before.sources);
    await app.dispatch({ type: "redo" });
    assert.deepEqual(app.getSceneDocument().zones, [box]);
    await app.dispatch({
      type: "removeZone",
      expectedZoneRegistryPin: zoneRegistryPin(app.getSceneDocument().zones),
      zoneId: box.id,
      expectedSceneRevision: app.getSceneDocument().sceneRevision,
    });
    assert.equal(app.getSnapshot().error, "");
    assert.deepEqual(app.getSceneDocument().zones ?? [], []);
    await app.dispatch({ type: "undo" });
    assert.deepEqual(app.getSceneDocument().zones, [box]);
  } finally {
    app.dispose();
  }
});

test("project save/load and exported JSON persist zone authoring without changing Scene objects", async () => {
  const storage = memory(),
    app = await LabRuntime.create({ storage, useWorker: false });
  try {
    await save(app, box);
    const saved = app.exportProject(),
      before = app.getSceneDocument();
    assert.ok(saved.includes('"zone.room"'));
    await app.dispatch({ type: "save" });
    await save(app, { ...box, name: "Unsaved edit", enabled: false });
    await app.dispatch({ type: "load" });
    assert.equal(app.getSnapshot().error, "");
    assert.deepEqual(app.getSceneDocument().zones, [box]);
    assert.deepEqual(app.getSceneDocument().objects, before.objects);
    await save(app, { ...box, name: "Temporary" });
    await app.importProject(saved);
    assert.deepEqual(app.getSceneDocument().zones, [box]);
  } finally {
    app.dispose();
  }
});

test("registered zone rules retain explicit IDs and prevent deletion with actionable profile/rule references", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    await save(app, box);
    await app.dispatch({
      type: "addRule",
      objectId: "ball",
      trigger: "OnEnterZone",
      zoneId: box.id,
    });
    assert.equal(app.getSnapshot().error, "");
    const document = app.getBehaviorDocument();
    const profile = document.profiles.find((value) =>
      value.rules.some(
        (rule) =>
          rule.trigger.kind === "discrete" &&
          rule.trigger.type === "OnEnterZone" &&
          rule.trigger.zoneId === box.id,
      ),
    )!;
    assert.ok(profile);
    const rule = profile.rules.find(
      (value) => value.trigger.kind === "discrete" && value.trigger.type === "OnEnterZone",
    )!;
    const before = app.getSceneDocument();
    await app.dispatch({
      type: "removeZone",
      expectedZoneRegistryPin: zoneRegistryPin(app.getSceneDocument().zones),
      zoneId: box.id,
      expectedSceneRevision: before.sceneRevision,
    });
    assert.match(app.getSnapshot().error ?? "", /ZONE_IN_USE/);
    assert.ok(app.getSnapshot().error?.includes(profile.profileId + "/" + rule.ruleId));
    assert.deepEqual(app.getSceneDocument(), before);
    await save(app, { ...box, enabled: false });
    assert.equal(app.getSnapshot().error, "");
    const retained = app
      .getBehaviorDocument()
      .profiles.flatMap((value) => value.rules)
      .find((value) => value.ruleId === rule.ruleId)!;
    assert.equal(retained.trigger.kind === "discrete" && retained.trigger.zoneId, box.id);
    await app.dispatch({ type: "removeRule", objectId: "ball", ruleId: rule.ruleId });
    await app.dispatch({
      type: "removeZone",
      expectedZoneRegistryPin: zoneRegistryPin(app.getSceneDocument().zones),
      zoneId: box.id,
      expectedSceneRevision: app.getSceneDocument().sceneRevision,
    });
    assert.equal(app.getSnapshot().error, "");
    assert.deepEqual(app.getSceneDocument().zones ?? [], []);
  } finally {
    app.dispose();
  }
});

test("same metadata Project replacement rejects old Zone save and delete baselines atomically", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    await save(app, box);
    const old = app.getSceneDocument();
    const oldPin = zoneRegistryPin(old.zones);
    const incoming = JSON.parse(app.exportProject());
    incoming.scene.zones[0].halfExtentsM = [2, 2, 2];
    await app.importProject(JSON.stringify(incoming));
    assert.equal(app.getSceneDocument().sceneRevision, old.sceneRevision);
    const before = app.getSceneDocument();
    for (const action of [
      {
        type: "saveZone" as const,
        zone: { ...box, name: "Old draft" },
        expectedSceneRevision: old.sceneRevision,
        expectedZoneRegistryPin: oldPin,
      },
      {
        type: "removeZone" as const,
        zoneId: box.id,
        expectedSceneRevision: old.sceneRevision,
        expectedZoneRegistryPin: oldPin,
      },
    ]) {
      await app.dispatch(action);
      assert.match(app.getSnapshot().error ?? "", /REVISION_CONFLICT/);
      assert.deepEqual(app.getSceneDocument(), before);
    }
    const current = app.getSceneDocument();
    const reordered = current.zones!.map((zone) =>
      Object.fromEntries(Object.entries(zone).reverse()),
    ) as unknown as SceneZone[];
    assert.equal(zoneRegistryPin(reordered), zoneRegistryPin(current.zones));
    await app.dispatch({
      type: "saveZone",
      zone: { ...current.zones![0]!, name: "Current draft" },
      expectedSceneRevision: current.sceneRevision,
      expectedZoneRegistryPin: zoneRegistryPin(reordered),
    });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(app.getSceneDocument().zones![0]!.name, "Current draft");
  } finally {
    app.dispose();
  }
});

test("same-revision Scene replacement during async Zone commit cannot overwrite imported objects", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    await save(app, box);
    const before = app.getSceneDocument();
    const incoming = JSON.parse(app.exportProject());
    incoming.scene.objects.find((o: { id: string }) => o.id === "ball").massKg = 2;
    const target = app as unknown as { drain(): Promise<void> };
    const drain = target.drain.bind(app);
    let replace = true;
    target.drain = async () => {
      await drain();
      if (replace) {
        replace = false;
        await app.importProject(JSON.stringify(incoming));
      }
    };
    await app.dispatch({
      type: "saveZone",
      zone: { ...box, name: "Raced draft" },
      expectedSceneRevision: before.sceneRevision,
      expectedZoneRegistryPin: zoneRegistryPin(before.zones),
    });
    assert.match(app.getSnapshot().error ?? "", /REVISION_CONFLICT/);
    const after = app.getSceneDocument();
    assert.equal(after.objects.find((o) => o.id === "ball")!.massKg, 2);
    assert.deepEqual(after.zones, before.zones);
    assert.equal(after.sceneRevision, before.sceneRevision);
  } finally {
    app.dispose();
  }
});
