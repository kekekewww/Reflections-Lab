import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsZoneProducer, zoneBoundaryDistance } from "../../src/physics/zone-producer.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import { toBehaviorFrame } from "../../src/app/physics-behavior.js";
import type { SceneZone } from "../../src/scene/types.js";
import type { BodyPose, PhysicsEvent } from "../../src/physics/types.js";
const region = (patch: Partial<SceneZone> = {}): SceneZone =>
  ({
    id: "zone.test",
    name: "Test region",
    enabled: true,
    shape: "aabb",
    centerM: [0, 0, 0],
    halfExtentsM: [1, 1, 1],
    hysteresisM: 0.1,
    ...patch,
  }) as SceneZone;
function body(x: number): BodyPose {
  return {
    objectId: "ball",
    generation: 1,
    positionMetres: [x, 0, 0],
    rotation: [0, 0, 0, 1],
    linearVelocityMetresPerSecond: [1, 0, 0],
    angularVelocityRadiansPerSecond: [0, 0, 0],
    mode: "dynamicNoGravity",
    sleeping: false,
    moving: true,
    airborne: true,
    held: false,
    rolling: false,
    sliding: false,
    spinning: false,
    enabled: true,
    lifecycle: "active",
    discontinuity: false,
  };
}
function step(
  producer: PhysicsZoneProducer,
  tick: number,
  x: number,
  zones: SceneZone[] = [region()],
  patch: Partial<BodyPose> = {},
) {
  return producer.step({
    tick,
    epoch: 1,
    sceneRevision: 1,
    fixedDtSeconds: 1 / 60,
    zones,
    poses: [{ ...body(x), ...patch }],
    events: [],
  });
}
test("AABB uses inner enter and outer exit boundaries, with stable zone and object identity", () => {
  const p = new PhysicsZoneProducer();
  assert.deepEqual(step(p, 1, 1.5), []);
  assert.deepEqual(step(p, 2, 0.95), []);
  const [enter] = step(p, 3, 0.89);
  assert.equal(enter?.type, "OnEnterZone");
  assert.equal(enter?.zoneId, "zone.test");
  assert.equal(enter?.source, "zone");
  assert.deepEqual(enter?.positionMetres, [0.89, 0, 0]);
  assert.deepEqual(step(p, 4, 1.05), []);
  assert.equal(step(p, 5, 1.11)[0]?.type, "OnExitZone");
  assert.deepEqual(step(p, 5, 1.11), []);
});
test("sphere classification uses Euclidean body centre rather than AABB or whole collider overlap", () => {
  const p = new PhysicsZoneProducer(),
    zone: SceneZone = {
      id: "zone.sphere",
      name: "Sphere",
      enabled: true,
      shape: "sphere",
      centerM: [0, 0, 0],
      radiusM: 1,
      hysteresisM: 0.1,
    };
  assert.ok(zoneBoundaryDistance(zone, [0.8, 0.8, 0]) > 0);
  assert.deepEqual(step(p, 1, 2, [zone]), []);
  assert.equal(step(p, 2, 0.8, [zone])[0]?.type, "OnEnterZone");
  assert.equal(step(p, 3, 1.2, [zone])[0]?.type, "OnExitZone");
});
test("initial inside is a baseline; later normal exit is real and no phantom entry is emitted", () => {
  const p = new PhysicsZoneProducer();
  assert.deepEqual(step(p, 1, 0), []);
  assert.equal(step(p, 2, 2)[0]?.type, "OnExitZone");
});
test("disabled, edited, removed and re-enabled regions rebaseline without phantom edges", () => {
  const p = new PhysicsZoneProducer();
  step(p, 1, 2);
  assert.deepEqual(step(p, 2, 0, [region({ enabled: false })]), []);
  assert.deepEqual(step(p, 3, 0), []);
  assert.deepEqual(step(p, 4, 0, []), []);
  assert.deepEqual(step(p, 5, 0), []);
  assert.deepEqual(step(p, 6, 0, [region({ centerM: [5, 0, 0] })]), []);
});
test("generation, teleport discontinuity, inactive bodies and epoch reset do not manufacture crossings", () => {
  for (const patch of [
    { generation: 2 },
    { discontinuity: true },
    { enabled: false },
    { lifecycle: "staged" as const },
  ]) {
    const p = new PhysicsZoneProducer();
    step(p, 1, 2);
    assert.deepEqual(step(p, 2, 0, [region()], patch), []);
  }
  const p = new PhysicsZoneProducer();
  step(p, 1, 2);
  assert.deepEqual(
    p.step({
      tick: 2,
      epoch: 2,
      sceneRevision: 2,
      fixedDtSeconds: 1 / 60,
      zones: [region()],
      poses: [body(0)],
      events: [],
    }),
    [],
  );
  p.reset();
  assert.deepEqual(step(p, 3, 0), []);
});
test("held and kinematic body movement crosses normally, without a mode-based blanket baseline", () => {
  for (const patch of [{ held: true }, { mode: "kinematic" as const }]) {
    const p = new PhysicsZoneProducer();
    step(p, 1, 2, [region()], patch);
    assert.equal(step(p, 2, 0, [region()], patch)[0]?.type, "OnEnterZone");
  }
});
test("outside-to-outside fast passage is sampled occupancy, not swept continuous collision detection", () => {
  const p = new PhysicsZoneProducer();
  step(p, 1, -2);
  assert.deepEqual(step(p, 2, 2), []);
});
test("multiple overlapping regions generate deterministic bounded event order and distinct IDs", () => {
  const p = new PhysicsZoneProducer();
  const zones = [region({ id: "zone.b" }), region({ id: "zone.a" })];
  step(p, 1, 2, zones);
  const events = step(p, 2, 0, zones);
  assert.deepEqual(
    events.map((e) => e.zoneId),
    ["zone.a", "zone.b"],
  );
  assert.deepEqual(
    events.map((e) => e.sequence),
    [0, 1],
  );
  assert.equal(new Set(events.map((e) => e.eventId)).size, 2);
  assert.throws(() =>
    step(
      p,
      3,
      0,
      Array.from({ length: 17 }, (_, i) => region({ id: "zone." + i })),
    ),
  );
});
test("true Rapier fixed steps produce raw and normalized Zone enter and exit from moving body centres", async () => {
  const scene = createDefaultScene();
  const ball = scene.objects.find((o) => o.id === "ball")!;
  scene.objects = [{ ...ball, mode: "dynamicNoGravity", positionM: [-1.5, 1, 0] }];
  scene.sources = [];
  scene.zones = [region({ centerM: [0, 1, 0], halfExtentsM: [0.5, 0.5, 0.5], hysteresisM: 0.05 })];
  const world = await PhysicsWorld.create(scene);
  try {
    world.setVelocity("ball", [2, 0, 0]);
    world.resume();
    const types: string[] = [];
    for (let i = 0; i < 100; i++) {
      const snapshot = world.step();
      const raw = snapshot.events.filter((e) => e.source === "zone");
      types.push(...raw.map((e) => e.type));
      const normalized = toBehaviorFrame(snapshot, "epoch.zones").events.filter(
        (e) => e.source === "zone",
      );
      assert.deepEqual(
        normalized.map((e) => [e.eventId, e.type, e.zoneId]),
        raw.map((e) => [e.eventId, e.type, e.zoneId]),
      );
    }
    assert.deepEqual(types, ["OnEnterZone", "OnExitZone"]);
  } finally {
    world.dispose();
  }
});

test("World startup establishes its initial occupancy baseline rather than inventing an edge during spawn discontinuity", async () => {
  const scene = createDefaultScene(),
    ball = scene.objects.find((o) => o.id === "ball")!;
  scene.objects = [{ ...ball, mode: "dynamicNoGravity", positionM: [-0.55, 1, 0] }];
  scene.sources = [];
  scene.zones = [region({ centerM: [0, 1, 0], halfExtentsM: [0.5, 0.5, 0.5], hysteresisM: 0 })];
  const world = await PhysicsWorld.create(scene);
  try {
    world.setVelocity("ball", [6, 0, 0]);
    world.resume();
    const first = world.step();
    assert.ok(first.poses[0]!.positionMetres[0] > -0.5);
    assert.equal(first.events.filter((e) => e.source === "zone").length, 0);
    assert.equal(world.step().events.filter((e) => e.type === "OnEnterZone").length, 0);
  } finally {
    world.dispose();
  }
});

test("authoring teleport, registry disable/re-enable, delete/recreate and reset do not fabricate Zone edges in Rapier", async () => {
  const scene = createDefaultScene(),
    ball = scene.objects.find((o) => o.id === "ball")!;
  scene.objects = [{ ...ball, mode: "dynamicNoGravity", positionM: [-2, 0, 0] }];
  scene.sources = [];
  scene.zones = [region()];
  const world = await PhysicsWorld.create(scene);
  let authored = structuredClone(scene);
  const advanceWithoutZone = () => {
    world.resume();
    for (let i = 0; i < 2; i++)
      assert.deepEqual(
        world.step().events.filter((e) => e.source === "zone"),
        [],
      );
    world.pause();
  };
  const commit = () => {
    authored.sceneRevision++;
    world.applyScene(authored);
    advanceWithoutZone();
  };
  try {
    advanceWithoutZone();
    authored.objects[0]!.positionM = [0, 0, 0];
    commit();
    authored.zones![0]!.enabled = false;
    commit();
    authored.zones![0]!.enabled = true;
    commit();
    const restored = structuredClone(authored.objects[0]!);
    const generation = world.snapshot().poses[0]!.generation;
    authored.objects = [];
    commit();
    authored.objects = [restored];
    commit();
    assert.ok(world.snapshot().poses[0]!.generation > generation);
    authored.zones![0]!.centerM = [10, 0, 0];
    commit();
    authored.zones![0]!.centerM = [0, 0, 0];
    commit();
    world.reset(authored);
    advanceWithoutZone();
  } finally {
    world.dispose();
  }
});

test("occupancy and event budgets admit exact capacity and explicitly refuse overflow", () => {
  const producer = new PhysicsZoneProducer();
  const zones = Array.from({ length: 16 }, (_, i) => region({ id: "zone." + i }));
  const poses = Array.from({ length: 128 }, (_, i) => ({ ...body(2), objectId: "body." + i }));
  const input = {
    tick: 1,
    epoch: 1,
    sceneRevision: 1,
    fixedDtSeconds: 1 / 60,
    zones,
    poses,
    events: [],
  };
  assert.deepEqual(producer.step(input), []);
  const events = producer.step({
    ...input,
    tick: 2,
    poses: poses.map((pose) => ({ ...pose, positionMetres: [0, 0, 0] })),
  });
  assert.equal(events.length, 2048);
  assert.equal(new Set(events.map((event) => event.eventId)).size, 2048);
  assert.deepEqual(
    events.map((event) => event.sequence),
    Array.from({ length: 2048 }, (_, i) => i),
  );
  assert.throws(
    () =>
      new PhysicsZoneProducer().step({
        ...input,
        poses: Array.from({ length: 257 }, (_, i) => ({ ...body(2), objectId: "body." + i })),
      }),
    { code: "ZONE_BUDGET" },
  );
  const bounded = new PhysicsZoneProducer();
  step(bounded, 1, 2);
  assert.throws(
    () =>
      bounded.step({
        ...input,
        tick: 2,
        zones: [region()],
        poses: [body(0)],
        events: Array.from({ length: 2048 }, (_, sequence) => ({ sequence }) as PhysicsEvent),
      }),
    { code: "ZONE_EVENT_BUDGET" },
  );
});
