import assert from "node:assert/strict";
import test from "node:test";
import { PhysicsWorld } from "../../src/physics/physics-world.js";
import type { PhysicsEvent } from "../../src/physics/types.js";
import type { SceneObject, SceneSpec, Vec3 } from "../../src/scene/types.js";

function object(id: string, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [0.2, 0.2, 0.2],
    positionM: [0, 1, 0],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicGravity",
    massKg: 1,
    friction: 0.5,
    restitution: 0,
    physicsMaterialId: "physics-test",
    acousticMaterialId: "acoustic-test",
    acousticRole: "none",
    ...patch,
  };
}

function scene(objects: SceneObject[]): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "physics-independent-tests",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects,
    sources: [],
    listener: {
      id: "listener-test",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}

function floor(): SceneObject {
  return object("floor", {
    shape: "box",
    dimensionsM: [10, 0.2, 10],
    positionM: [0, -0.1, 0],
    mode: "fixed",
    acousticRole: "staticSurface",
  });
}

function near(actual: number, expected: number, tolerance: number, label = "value"): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: actual ${actual}, expected ${expected} ± ${tolerance}`,
  );
}

const norm = (v: Vec3): number => Math.hypot(...v);

test("paused construction, fixed 60Hz freefall, reset and disposed lifetime", async () => {
  const world = await PhysicsWorld.create(scene([object("falling", { positionM: [0, 5, 0] })]));
  try {
    assert.equal(world.paused, true);
    assert.equal(world.step().tick, 0);
    assert.equal(world.advance(1).steps, 0);
    near(world.getPose("falling").positionMetres[1], 5, 1e-6);
    world.resume();
    for (let i = 0; i < 30; i++) world.step();
    assert.equal(world.tick, 30);
    near(world.snapshot().simulationTimeSeconds, 0.5, 1e-12);
    near(world.getPose("falling").linearVelocityMetresPerSecond[1], -4.905, 0.002);
    near(world.getPose("falling").positionMetres[1], 3.77375, 0.05, "analytic freefall y");
    const beforePause = world.snapshot();
    world.pause();
    world.step();
    assert.deepEqual(world.snapshot().poses, beforePause.poses);
    world.reset();
    assert.equal(world.tick, 0);
    assert.equal(world.paused, true);
    near(world.getPose("falling").positionMetres[1], 5, 1e-6);
    assert.equal(world.snapshot().epoch, 1);
  } finally {
    world.dispose();
  }
  world.dispose();
  assert.throws(() => world.snapshot(), { code: "DISPOSED" });
});

test("four body modes use real solver behavior; gravity changes preserve velocity and lock/unlock zero it", async () => {
  const world = await PhysicsWorld.create(
    scene([
      object("gravity", { positionM: [0, 5, 0] }),
      object("inertial", { positionM: [3, 5, 0], mode: "dynamicNoGravity" }),
      object("locked", { positionM: [6, 5, 0], mode: "fixed" }),
      object("driven", { positionM: [9, 5, 0], mode: "kinematic" }),
    ]),
  );
  try {
    world.setVelocity("inertial", [2, 0, 0]);
    world.applyImpulse("locked", [10, 0, 0]);
    world.setKinematicTarget("driven", [9.05, 5, 0]);
    world.resume();
    world.step();
    assert.ok(world.getPose("gravity").positionMetres[1] < 5);
    near(world.getPose("inertial").positionMetres[1], 5, 1e-6);
    near(world.getPose("inertial").positionMetres[0], 3 + 2 / 60, 1e-5);
    assert.deepEqual(world.getPose("locked").positionMetres, [6, 5, 0]);
    near(world.getPose("driven").positionMetres[0], 9.05, 1e-5);
    world.setMode("inertial", "dynamicGravity");
    near(world.getPose("inertial").linearVelocityMetresPerSecond[0], 2, 1e-6);
    world.step();
    assert.ok(world.getPose("inertial").linearVelocityMetresPerSecond[1] < 0);
    const lockPosition = world.getPose("inertial").positionMetres;
    world.setMode("inertial", "fixed");
    world.step();
    assert.deepEqual(world.getPose("inertial").positionMetres, lockPosition);
    world.setMode("inertial", "dynamicNoGravity");
    assert.deepEqual(world.getPose("inertial").linearVelocityMetresPerSecond, [0, 0, 0]);
    world.step();
    assert.deepEqual(world.getPose("inertial").positionMetres, lockPosition);
  } finally {
    world.dispose();
  }
});

test("one falling sphere emits one impact at real contact, while support does not repeat impacts", async () => {
  const world = await PhysicsWorld.create(scene([floor(), object("ball")]));
  try {
    world.resume();
    const events: PhysicsEvent[] = [];
    for (let i = 0; i < 240; i++) events.push(...world.step().events);
    const impacts = events.filter((e) => e.type === "OnImpact");
    assert.equal(
      impacts.length,
      1,
      "A resting support impulse must not retrigger impact sound each tick",
    );
    const impact = impacts[0]!;
    assert.equal(impact.objectId, "ball");
    assert.equal(impact.otherObjectId, "floor");
    assert.equal(impact.source, "physics");
    assert.equal(impact.accepted, true);
    assert.ok(impact.contact);
    near(impact.positionMetres[1], 0, 0.03, "contact point lies at floor surface");
    assert.ok(
      Math.abs(impact.positionMetres[1] - world.getPose("ball").positionMetres[1]) > 0.07,
      "Emitter contact is not sphere COM",
    );
    assert.equal(impact.contact.impulseMethod, "RapierContactImpulse");
    assert.equal(impact.contact.velocityMethod, "PreStepRigidBodyEstimate");
    assert.ok((impact.contact.normalImpulseNewtonSeconds ?? 0) > 0.02);
    assert.ok((impact.contact.closingSpeedMetresPerSecond ?? 0) > 0.15);
    assert.equal(new Set(events.map((e) => e.eventId)).size, events.length);
    assert.equal(world.getPose("ball").airborne, false);
    assert.equal(events.filter((e) => e.type === "ContactBegin").length, 1);
  } finally {
    world.dispose();
  }
});

test("mode-change invalidation recovers resting support without inventing a second impact", async () => {
  const world = await PhysicsWorld.create(scene([floor(), object("ball")]));
  try {
    world.resume();
    for (let i = 0; i < 180; i++) world.step();
    assert.equal(world.getPose("ball").airborne, false);
    world.setMode("ball", "dynamicNoGravity");
    const events: PhysicsEvent[] = [];
    for (let i = 0; i < 10; i++) events.push(...world.step().events);
    assert.equal(
      world.getPose("ball").airborne,
      false,
      "Existing contact must be rediscovered after mode-change invalidation",
    );
    assert.equal(
      events.filter((e) => e.type === "OnImpact").length,
      0,
      "Invalidating a cache cannot create a new physical collision",
    );
  } finally {
    world.dispose();
  }
});

for (const massKg of [0.1, 1, 5, 20]) {
  test(`grab ${massKg}kg has finite force/torque budgets and preserves dynamic collision mode`, async () => {
    const world = await PhysicsWorld.create(
      scene([object("held", { mode: "dynamicNoGravity", massKg, positionM: [0, 1, 0] })]),
    );
    try {
      world.grab("held", [0.5, 1, 0], `grab-${String(massKg).replace(".", "-")}`);
      world.updateGrabTarget([0.5, 1, 0], [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)]);
      world.resume();
      let sawDiagnostics = false;
      for (let i = 0; i < 30; i++) {
        const snapshot = world.step(),
          d = snapshot.grabDiagnostics;
        assert.equal(snapshot.heldObjectId, "held");
        assert.equal(world.getPose("held").mode, "dynamicNoGravity");
        if (!d) continue;
        sawDiagnostics = true;
        assert.ok(Number.isFinite(d.trackingErrorMetres));
        assert.ok(norm(d.impulseNewtonSeconds) <= Math.min(150 / 60, (massKg * 20) / 60) + 1e-6);
        assert.ok(norm(d.torqueImpulseNewtonMetreSeconds) <= 15 / 60 + 1e-6);
      }
      assert.equal(sawDiagnostics, true);
      assert.ok(
        world.getPose("held").positionMetres[0] > 0,
        "Bounded servo should move the object, not just create diagnostics",
      );
    } finally {
      world.dispose();
    }
  });
}

test("held target behind wall is clamped without penetrating or teleporting object", async () => {
  const wall = object("wall", {
    shape: "box",
    dimensionsM: [0.1, 4, 4],
    positionM: [0.8, 1, 0],
    mode: "fixed",
  });
  const world = await PhysicsWorld.create(
    scene([wall, object("held", { mode: "dynamicNoGravity" })]),
  );
  try {
    world.grab("held", [0, 1, 0], "grab-wall");
    world.updateGrabTarget([1.2, 1, 0]);
    world.resume();
    let blocked = false;
    let previousX = 0;
    for (let i = 0; i < 120; i++) {
      const snapshot = world.step();
      const x = world.getPose("held").positionMetres[0];
      assert.ok(x <= 0.66, `sphere cannot cross left wall surface; x=${x}`);
      assert.ok(Math.abs(x - previousX) < 0.1, "No instantaneous teleport to camera target");
      previousX = x;
      blocked ||= snapshot.grabDiagnostics?.blocked ?? false;
    }
    assert.equal(blocked, true);
  } finally {
    world.dispose();
  }
});

test("NoGravity drop preserves solver momentum; throw is explicit, command-bound and speed limited", async () => {
  const world = await PhysicsWorld.create(scene([object("ball", { mode: "dynamicNoGravity" })]));
  try {
    world.setVelocity("ball", [2, 1, 0]);
    world.grab("ball", [0, 1, 0], "grab-drop");
    world.drop("drop-one");
    assert.deepEqual(world.getPose("ball").linearVelocityMetresPerSecond, [2, 1, 0]);
    world.resume();
    const dropped = world.step();
    assert.equal(
      dropped.events.filter((e) => e.type === "OnDrop" && e.commandId === "drop-one").length,
      1,
    );
    assert.equal(
      dropped.events.some((e) => e.type === "OnThrow"),
      false,
    );
    near(world.getPose("ball").linearVelocityMetresPerSecond[1], 1, 1e-6);
    world.grab("ball", world.getPose("ball").positionMetres, "grab-throw");
    assert.equal(world.throwHeld([1, 0, 0], 20, "throw-one"), true);
    assert.ok(norm(world.getPose("ball").linearVelocityMetresPerSecond) <= 12 + 1e-5);
    assert.equal(world.throwHeld([1, 0, 0], 20, "throw-one"), false);
    const thrown = world.step();
    const throws = thrown.events.filter((e) => e.type === "OnThrow");
    assert.equal(throws.length, 1);
    assert.equal(throws[0]!.source, "interaction");
    assert.equal(throws[0]!.commandId, "throw-one");
    assert.ok(
      (throws[0]!.impulseNs ?? Infinity) < 20,
      "New impulse is saturated, old momentum is not erased",
    );
  } finally {
    world.dispose();
  }
});

test("ray returns first blocking wall rather than a grabbable sphere behind it", async () => {
  const world = await PhysicsWorld.create(
    scene([
      object("wall", {
        shape: "box",
        dimensionsM: [2, 2, 0.1],
        positionM: [0, 1, -1],
        mode: "fixed",
      }),
      object("behind", { positionM: [0, 1, -2] }),
    ]),
  );
  try {
    const hit = world.raycast([0, 1, 0], [0, 0, -1], 3);
    assert.ok(hit);
    assert.equal(hit.objectId, "wall");
    assert.equal(hit.grabbable, false);
    near(hit.distanceMetres, 0.95, 1e-4);
    assert.throws(() => world.raycast([0, 1, 0], [0, 0, 0]), { code: "INVALID_RAY" });
  } finally {
    world.dispose();
  }
});

test("placement uses actual shape clearance, staged body stays inactive until enabled", async () => {
  const world = await PhysicsWorld.create(
    scene([floor(), object("ball", { positionM: [0, 2, 0] })]),
  );
  try {
    assert.equal(
      world.validatePlacement(object("candidate", { positionM: [1, 0.11, 0] })).valid,
      true,
    );
    const blocked = world.validatePlacement(object("candidate", { positionM: [1, -0.05, 0] }));
    assert.equal(blocked.valid, false);
    assert.ok(blocked.blockingObjectIds.includes("floor"));
    assert.equal(
      world.validatePlacement(object("candidate", { positionM: [201, 1, 0] })).reason,
      "OUT_OF_BOUNDS",
    );
    world.setObjectEnabled("ball", false);
    world.resume();
    for (let i = 0; i < 60; i++) world.step();
    near(world.getPose("ball").positionMetres[1], 2, 1e-6);
    assert.equal(world.getPose("ball").lifecycle, "staged");
    assert.equal(world.getPose("ball").enabled, false);
    world.setObjectEnabled("ball", true);
    world.step();
    assert.ok(world.getPose("ball").positionMetres[1] < 2);
    assert.equal(world.getPose("ball").lifecycle, "active");
  } finally {
    world.dispose();
  }
});

test("scene application validates before mutation, requires pause and preserves unedited solver poses", async () => {
  const initial = scene([object("ball", { mode: "dynamicNoGravity" })]);
  const world = await PhysicsWorld.create(initial);
  try {
    world.setVelocity("ball", [1, 0, 0]);
    world.resume();
    for (let i = 0; i < 30; i++) world.step();
    const moved = world.getPose("ball").positionMetres;
    assert.throws(() => world.applyScene(initial), { code: "PAUSE_REQUIRED" });
    world.pause();
    const invalid = structuredClone(initial);
    invalid.objects[0]!.massKg = -1;
    const before = world.snapshot();
    assert.throws(() => world.applyScene(invalid));
    assert.deepEqual(world.snapshot(), before);
    const changed = structuredClone(initial);
    changed.sceneRevision = 1;
    changed.objects[0]!.acousticMaterialId = "different-material";
    world.applyScene(changed);
    assert.equal(world.sceneRevision, 1);
    assert.deepEqual(world.getPose("ball").positionMetres, moved);
    near(world.getPose("ball").linearVelocityMetresPerSecond[0], 1, 1e-6);
  } finally {
    world.dispose();
  }
});

test("interpolation is bounded and snapshot mutations cannot write solver state", async () => {
  const world = await PhysicsWorld.create(scene([object("ball", { mode: "dynamicNoGravity" })]));
  try {
    world.setVelocity("ball", [1, 0, 0]);
    world.resume();
    for (let i = 0; i < 3; i++) world.step();
    const current = world.getPose("ball");
    const previous = world.interpolatedPoses(0)[0]!;
    const middle = world.interpolatedPoses(0.5)[0]!;
    near(
      middle.positionMetres[0],
      (previous.positionMetres[0] + current.positionMetres[0]) / 2,
      1e-7,
    );
    const mutable = world.snapshot();
    mutable.poses[0]!.positionMetres[0] = 99;
    assert.notEqual(world.getPose("ball").positionMetres[0], 99);
    assert.throws(() => world.interpolatedPoses(1.1), { code: "INVALID_ALPHA" });
  } finally {
    world.dispose();
  }
});

test("30Hz render advance observes every 60Hz snapshot and keeps first-step throw/impact events", async () => {
  const world = await PhysicsWorld.create(scene([floor(), object("ball")]));
  try {
    world.grab("ball", [0, 1, 0], "grab-before-render");
    world.throwHeld([0, -1, 0], 1, "throw-before-render");
    world.resume();
    const observedTicks: number[] = [];
    const observedEvents: PhysicsEvent[] = [];
    for (let frame = 0; frame < 120; frame++) {
      const result = world.advance(1 / 30, (snapshot) => {
        observedTicks.push(snapshot.tick);
        observedEvents.push(...snapshot.events);
        snapshot.poses[0]!.positionMetres[0] = 99;
      });
      assert.equal(result.steps, 2);
    }
    assert.deepEqual(
      observedTicks,
      Array.from({ length: 240 }, (_, i) => i + 1),
    );
    assert.equal(observedEvents.filter((e) => e.type === "OnThrow").length, 1);
    assert.equal(observedEvents.find((e) => e.type === "OnThrow")?.tick, 1);
    assert.equal(observedEvents.filter((e) => e.type === "OnImpact").length, 1);
    assert.equal(world.tick, 240);
    assert.equal(world.clock.tick, 240);
    assert.notEqual(
      world.getPose("ball").positionMetres[0],
      99,
      "An observer receives copies, never live WASM state",
    );
  } finally {
    world.dispose();
  }
});

test("throwing step observer pauses safely after committing exactly the already-solved tick", async () => {
  const world = await PhysicsWorld.create(scene([object("ball", { mode: "dynamicNoGravity" })]));
  try {
    world.resume();
    const expected = new Error("recording consumer rejected a frame");
    assert.throws(
      () =>
        world.advance(1 / 30, () => {
          throw expected;
        }),
      (error) => error === expected,
    );
    assert.equal(world.paused, true);
    assert.equal(world.tick, 1);
    assert.equal(
      world.clock.tick,
      1,
      "Rapier and fixed-clock ticks must still agree after observer failure",
    );
    assert.equal(world.step().tick, 1, "Pause prevents any further solver/control work");
    world.resume();
    const observedTicks: number[] = [];
    const resumed = world.advance(0, (snapshot) => observedTicks.push(snapshot.tick));
    assert.equal(resumed.steps, 1, "Unprocessed backlog remains available for explicit resume");
    assert.deepEqual(observedTicks, [2]);
    assert.equal(world.tick, 2);
    assert.equal(world.clock.tick, 2);
  } finally {
    world.dispose();
  }
});

test("invalid kinematic orientation rejects the entire target without leaving a pending translation", async () => {
  const world = await PhysicsWorld.create(scene([object("driven", { mode: "kinematic" })]));
  try {
    const before = world.getPose("driven").positionMetres;
    assert.throws(() => world.setKinematicTarget("driven", [0.05, 1, 0], [0, 0, 0, 0]), {
      code: "INVALID_QUATERNION",
    });
    world.resume();
    world.step();
    assert.deepEqual(
      world.getPose("driven").positionMetres,
      before,
      "Rejected orientation must not leave a partial next-translation command",
    );
  } finally {
    world.dispose();
  }
});

test("held geometry replacement cannot resume an old generation grip without explicit release", async () => {
  const initial = scene([object("held", { mode: "dynamicNoGravity" })]);
  const world = await PhysicsWorld.create(initial);
  try {
    world.grab("held", [0.4, 1, 0], "grab-before-geometry");
    const originalGeneration = world.getPose("held").generation;
    const changed = structuredClone(initial);
    changed.sceneRevision = 1;
    changed.objects[0]!.dimensionsM = [0.4, 0.4, 0.4];
    world.applyScene(changed);
    assert.ok(world.getPose("held").generation > originalGeneration);
    assert.equal(world.paused, true);
    assert.throws(
      () => world.resume(),
      "A held generation change needs explicit recovery; silently keeping its old controller is unsafe",
    );
    assert.equal(world.paused, true);
    assert.equal(world.heldObjectId, "held", "Invalid hold remains visible for explicit release");
    world.drop("drop-invalid-grip");
    world.resume();
    world.step();
    assert.equal(world.heldObjectId, null);
    assert.equal(world.snapshot().grabDiagnostics, null);
  } finally {
    world.dispose();
  }
});

test("editing gravity wakes sleeping dynamic bodies so the new acceleration actually applies", async () => {
  const initial = scene([floor(), object("ball")]);
  const world = await PhysicsWorld.create(initial);
  try {
    world.resume();
    for (let i = 0; i < 600; i++) world.step();
    assert.equal(
      world.getPose("ball").sleeping,
      true,
      "This regression must exercise a solver-sleeping object",
    );
    const restingY = world.getPose("ball").positionMetres[1];
    world.pause();
    const changed = structuredClone(initial);
    changed.sceneRevision = 1;
    changed.gravityMps2 = [0, 9.81, 0];
    world.applyScene(changed);
    world.resume();
    for (let i = 0; i < 60; i++) world.step();
    assert.ok(
      world.getPose("ball").positionMetres[1] > restingY + 1,
      "Reversing gravity must move the sphere away from its former support",
    );
    assert.ok(world.getPose("ball").linearVelocityMetresPerSecond[1] > 9);
  } finally {
    world.dispose();
  }
});
