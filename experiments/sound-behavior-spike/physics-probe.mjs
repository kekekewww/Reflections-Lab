import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import RAPIER from "@dimforge/rapier3d-compat";

// Three API risks not covered by the original six-check physics smoke.
const dt = 1 / 60;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const vec = (v) => [v.x, v.y, v.z];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function localToWorld(collider, point) {
  const q = collider.rotation(),
    v = vec(point),
    xyz = [q.x, q.y, q.z],
    a = cross(xyz, v),
    b = cross(xyz, a),
    t = vec(collider.translation());
  return v.map((x, i) => x + 2 * q.w * a[i] + 2 * b[i] + t[i]);
}
const metadata = JSON.parse(
  readFileSync(
    new URL("../../node_modules/@dimforge/rapier3d-compat/package.json", import.meta.url),
  ),
);
await RAPIER.init({});
const checks = [];
function run(name, fn) {
  const out = { name, status: "FAIL" };
  checks.push(out);
  Object.assign(out, fn(), { status: "PASS" });
}
let error;
try {
  run("world_point_velocity_distinguishes_rolling_from_center_translation", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false));
      world.createCollider(RAPIER.ColliderDesc.ball(0.5).setMass(1), body);
      body.setLinvel({ x: 2, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: -4 }, true);
      const point = { x: 0, y: -0.5, z: 0 },
        velocity = body.velocityAtPoint(point);
      assert.ok(
        Math.hypot(velocity.x, velocity.y, velocity.z) < 1e-6,
        "2m/s plus omega×r must cancel at ideal sphere contact",
      );
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const slide = body.velocityAtPoint(point);
      assert.ok(Math.abs(slide.x - 2) < 1e-6);
      return {
        contactPointMetres: vec(point),
        linearVelocityMetresPerSecond: [2, 0, 0],
        angularVelocityRadiansPerSecond: [0, 0, -4],
        rollingPointVelocity: vec(velocity),
        slidingPointVelocity: vec(slide),
        scope: "Kinematic identity only; no friction/rolling solver or audio",
      };
    } finally {
      world.free();
    }
  });
  run("box_floor_manifold_has_multiple_contacts_with_distinct_contact_and_center_positions", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = dt;
    const queue = new RAPIER.EventQueue(true);
    try {
      const floor = world.createCollider(
        RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0),
      );
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.25, 0).setCanSleep(false),
      );
      const cube = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setFriction(0).setRestitution(0),
        body,
      );
      cube.setActiveEvents(
        RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
      );
      cube.setContactForceEventThreshold(0);
      let started = 0,
        maxContacts = 0,
        restForceSamples = 0;
      const samples = [];
      for (let step = 1; step <= 180; step++) {
        const preVelocity = vec(body.linvel());
        world.step(queue);
        queue.drainCollisionEvents((_a, _b, onset) => {
          if (onset) started++;
        });
        queue.drainContactForceEvents((event) => {
          if (step > 120 && event.totalForceMagnitude() > 0) restForceSamples++;
        });
        world.contactPair(cube, floor, (m, flipped) => {
          maxContacts = Math.max(maxContacts, m.numContacts());
          const localA = flipped ? floor : cube,
            localB = flipped ? cube : floor;
          for (let i = 0; i < m.numContacts(); i++) {
            if (m.contactImpulse(i) <= 0 || samples.length >= 8) continue;
            const p1 = m.localContactPoint1(i),
              p2 = m.localContactPoint2(i);
            // Local contact positions must use each actual collider's world quaternion.
            const wa = localToWorld(localA, p1),
              wb = localToWorld(localB, p2);
            const point = wa.map((v, i) => (v + wb[i]) / 2);
            const raw = vec(m.normal()),
              normal = raw.map((v) => (flipped ? -v : v));
            assert.ok(normal[1] < -0.9, "canonical cube→floor normal points down");
            assert.ok(
              Math.abs(point[1]) < 0.03,
              "representative world contact is near floor top, not cube center",
            );
            assert.ok(
              Math.abs(body.translation().y - point[1]) > 0.4,
              "contact emitter and object center are distinct",
            );
            samples.push({
              tick: step,
              flipped,
              normalAtoB: normal,
              pointWorldMetres: point,
              centerMetres: vec(body.translation()),
              normalImpulseNewtonSeconds: m.contactImpulse(i),
              preStepLinearVelocity: preVelocity,
              geometricContacts: m.numContacts(),
              solverContacts: m.numSolverContacts(),
              solverRepresentativeWorldMetres: m.numSolverContacts()
                ? vec(m.solverContactPoint(0))
                : null,
            });
          }
        });
      }
      assert.ok(started >= 1);
      assert.ok(maxContacts >= 2);
      assert.ok(restForceSamples >= 30);
      return {
        collisionStarts: started,
        maxGeometricContacts: maxContacts,
        restForceStepsInLast60: restForceSamples,
        samples,
        scope:
          "Geometric contact points/impulses copied inside callback; solver indices never paired with geometric indices; normal orientation verified only for this fixture",
      };
    } finally {
      queue.free();
      world.free();
    }
  });
  run("sensor_zone_enter_exit_does_not_produce_contact_force_or_impact", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.timestep = dt;
    const queue = new RAPIER.EventQueue(true);
    try {
      const zone = world.createCollider(
        RAPIER.ColliderDesc.cuboid(1, 1, 1)
          .setSensor(true)
          .setActiveEvents(
            RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
          ),
      );
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(-2, 0, 0)
          .setCanSleep(false)
          .setLinvel(1, 0, 0),
      );
      const ball = world.createCollider(RAPIER.ColliderDesc.ball(0.1), body);
      const ids = new Map([
        [zone.handle, "zone-main"],
        [ball.handle, "ball-main"],
      ]);
      const events = [];
      let forces = 0;
      for (let tick = 1; tick <= 300; tick++) {
        world.step(queue);
        queue.drainCollisionEvents((a, b, started) =>
          events.push({
            tick,
            colliderA: ids.get(a),
            colliderB: ids.get(b),
            trigger: started ? "OnEnterZone" : "OnExitZone",
          }),
        );
        queue.drainContactForceEvents(() => forces++);
      }
      assert.equal(events.filter((e) => e.trigger === "OnEnterZone").length, 1);
      assert.equal(events.filter((e) => e.trigger === "OnExitZone").length, 1);
      assert.equal(forces, 0);
      assert.ok(events.every((e) => e.colliderA && e.colliderB));
      return {
        events,
        contactForceEvents: forces,
        finalX: body.translation().x,
        scope: "Dynamic ball crossing one static sensor; not fixed/kinematic zone pair validation",
      };
    } finally {
      queue.free();
      world.free();
    }
  });
} catch (e) {
  error = e;
}
const result = {
  schema_version: 1,
  recorded_at: new Date().toISOString(),
  status: error ? "FAIL" : "PASS",
  node: process.version,
  platform: process.platform,
  package: { name: metadata.name, version: metadata.version, license: metadata.license },
  fixed_dt_seconds: dt,
  source: {
    path: "experiments/sound-behavior-spike/physics-probe.mjs",
    sha256: sha(readFileSync(new URL(import.meta.url))),
  },
  checks,
  limitations: [
    "Isolated Node/WASM API probes; no product bridge/audio/browser implementation",
    "No complete CCD/substep, simultaneous wall contacts, compound shapes, cross-platform replay or hearing validation",
    "Fixture thresholds and geometric tolerances are synthetic controls, not calibrated presets",
  ],
  ...(error ? { error: error.message } : {}),
};
const file = `physics-results-${result.recorded_at.replace(/[:.]/g, "-")}.json`;
writeFileSync(new URL(file, import.meta.url), JSON.stringify(result, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    status: result.status,
    checks: checks.length,
    artifact: `experiments/sound-behavior-spike/${file}`,
  }),
);
if (error) {
  console.error(error.message);
  process.exitCode = 1;
}
