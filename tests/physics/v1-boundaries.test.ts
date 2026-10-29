import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import type RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld } from "../../src/physics/index.js";
import type { BodyPose, PhysicsEvent } from "../../src/physics/types.js";
import type { SceneObject, SceneSpec, Vec3 } from "../../src/scene/types.js";

const measurements: Record<string, unknown>[] = [];
const dt = 1 / 60;
const norm = (v: readonly number[]) => Math.hypot(...v);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
const subtract = (a: readonly number[], b: readonly number[]): Vec3 =>
  a.map((x, i) => x - b[i]!) as Vec3;
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [
  a[1]! * b[2]! - a[2]! * b[1]!,
  a[2]! * b[0]! - a[0]! * b[2]!,
  a[0]! * b[1]! - a[1]! * b[0]!,
];
const near = (actual: number, expected: number, message: string) =>
  assert.ok(Math.abs(actual - expected) <= 1e-5, `${message}: ${actual} vs ${expected}`);

function object(id: string, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [0.2, 0.2, 0.2],
    positionM: [0, 1, 0],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicNoGravity",
    massKg: 1,
    friction: 0,
    restitution: 0,
    physicsMaterialId: `mat.${id}`,
    acousticMaterialId: "acoustic-test",
    acousticRole: "none",
    ...patch,
  };
}
function scene(objects: SceneObject[], gravityMps2: Vec3 = [0, -9.81, 0]): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "v1-physics-boundaries",
    sceneRevision: 9,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 271828,
    gravityMps2,
    objects,
    sources: [],
    listener: {
      id: "listener.boundaries",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}
const floor = () =>
  object("floor", {
    shape: "box",
    dimensionsM: [20, 0.2, 20],
    positionM: [0, -0.1, 0],
    mode: "fixed",
  });

// Read-only observations of actual WASM data, used only as independent event references.
// All motion, controls, lifetime and event reads use the public PhysicsWorld API.
function raw(world: PhysicsWorld) {
  return world as unknown as {
    world: RAPIER.World;
    records: Map<string, { body: RAPIER.RigidBody; collider: RAPIER.Collider }>;
    player: {
      radiusMetres: number;
      totalHeightMetres: number;
      eyeHeightMetres: number;
      collider: RAPIER.Collider;
      controller: RAPIER.KinematicCharacterController;
    };
  };
}

for (const angleDegrees of [20, 60]) {
  test(`actual capsule ${angleDegrees} degree ramp respects the configured 45 degree climb limit`, async () => {
    const angle = (angleDegrees * Math.PI) / 180;
    const world = await PhysicsWorld.create(
      scene([
        object("ramp", {
          shape: "box",
          dimensionsM: [16, 0.2, 6],
          positionM: [0, -0.1 / Math.cos(angle), 0],
          orientationQuaternion: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)],
          mode: "fixed",
        }),
      ]),
    );
    try {
      // Analytic capsule support: foot differs from plane height by r(sec(theta)-1).
      world.createPlayer([0, 0.25 * (1 / Math.cos(angle) - 1) + 0.02 / Math.cos(angle), 0]);
      const motor = raw(world).player;
      assert.equal(motor.radiusMetres, 0.25);
      assert.equal(motor.totalHeightMetres, 1.75);
      near(motor.controller.maxSlopeClimbAngle(), Math.PI / 4, "actual configured climb limit");
      const start = world.snapshot().player!;
      const trace: NonNullable<ReturnType<PhysicsWorld["snapshot"]>["player"]>[] = [];
      world.setPlayerInput({ forward: 0, right: 1, yaw: 0 });
      world.resume();
      for (let tick = 0; tick < 90; tick++) {
        const player = world.step().player!;
        assert.ok(player.positionMetres.every(Number.isFinite));
        trace.push(player);
      }
      const end = trace.at(-1)!;
      const maximumUphillProgressM = Math.max(
        ...trace.map((p) => p.positionMetres[0] - start.positionMetres[0]),
      );
      if (angleDegrees === 20) {
        assert.ok(
          end.positionMetres[0] - start.positionMetres[0] > 1.5,
          "walkable ramp must make more than half the commanded 3m horizontal progress",
        );
        assert.ok(
          end.positionMetres[1] > start.positionMetres[1] + motor.radiusMetres,
          "climb must raise the actual capsule by more than one radius",
        );
      } else {
        assert.ok(
          maximumUphillProgressM < motor.radiusMetres,
          "60 degree surface must not permit even one capsule radius of uphill traversal",
        );
      }
      measurements.push({
        requirement: "V1-PHY-03",
        angleDegrees,
        radiusMetres: motor.radiusMetres,
        offsetMetres: motor.controller.offset(),
        start,
        end,
        maximumUphillProgressM,
        trace,
      });
    } finally {
      world.dispose();
    }
  });
}

for (const widthMetres of [0.7, 0.4]) {
  test(`actual capsule ${widthMetres}m doorway uses real radius and controller skin`, async () => {
    const world = await PhysicsWorld.create(
      scene([
        floor(),
        ...[-1, 1].map((sign) =>
          object(`post.${sign < 0 ? "left" : "right"}`, {
            shape: "box",
            dimensionsM: [1, 3, 0.2],
            positionM: [sign * (widthMetres / 2 + 0.5), 1.5, 0],
            mode: "fixed",
          }),
        ),
      ]),
    );
    try {
      world.createPlayer([0, 0.02, 1]);
      const motor = raw(world).player;
      const offset = motor.controller.offset();
      const radialClearanceM = widthMetres / 2 - motor.radiusMetres - offset;
      assert.equal(motor.radiusMetres, 0.25);
      near(offset, 0.01, "actual controller skin");
      const start = world.snapshot().player!;
      world.setPlayerInput({ forward: 1, right: 0, yaw: 0 });
      world.resume();
      const trace = [];
      for (let tick = 0; tick < 90; tick++) trace.push(world.step().player!);
      const end = trace.at(-1)!;
      if (radialClearanceM > 0)
        assert.ok(
          end.positionMetres[2] < -1,
          "positive radial clearance must allow actual passage through both posts",
        );
      else
        assert.ok(
          trace.every((p) => p.positionMetres[2] > 0.1),
          "undersized opening must never let capsule center cross the posts' near face",
        );
      measurements.push({
        requirement: "V1-PHY-03",
        widthMetres,
        radiusMetres: motor.radiusMetres,
        offsetMetres: offset,
        radialClearanceM,
        start,
        end,
        trace,
      });
    } finally {
      world.dispose();
    }
  });
}

test("12m/s capped Throw with CCD cannot traverse a 0.01m wall with a 0.02m sphere", async () => {
  const world = await PhysicsWorld.create(
    scene(
      [
        object("projectile", {
          dimensionsM: [0.02, 0.02, 0.02],
          positionM: [-0.15, 1, 0],
          massKg: 0.1,
        }),
        object("thin-wall", {
          shape: "box",
          dimensionsM: [0.01, 2, 2],
          positionM: [0, 1, 0],
          mode: "fixed",
        }),
      ],
      [0, 0, 0],
    ),
  );
  try {
    assert.ok(
      12 * dt > 0.01 + 0.02,
      "one tick travels much farther than the combined sphere diameter and wall thickness",
    );
    assert.equal(world.grab("projectile", [-0.15, 1, 0], "grab.ccd"), true);
    assert.equal(world.throwHeld([1, 0, 0], 6, "throw.ccd"), true);
    assert.equal(world.throwHeld([1, 0, 0], 6, "throw.ccd"), false);
    const velocityBeforeRetry = world.getPose("projectile").linearVelocityMetresPerSecond;
    assert.equal(world.grab("projectile", [-0.15, 1, 0], "grab.ccd.retry"), true);
    assert.equal(world.throwHeld([1, 0, 0], 6, "throw.ccd"), false);
    assert.equal(
      world.heldObjectId,
      "projectile",
      "a remembered command ID cannot throw a newly reacquired grip",
    );
    assert.deepEqual(
      world.getPose("projectile").linearVelocityMetresPerSecond,
      velocityBeforeRetry,
    );
    assert.equal(world.drop("drop.ccd.retry"), true);
    assert.equal(world.heldObjectId, null);
    const thrown = world.getPose("projectile");
    near(norm(thrown.linearVelocityMetresPerSecond), 12, "throw reaches the configured speed cap");
    assert.equal(raw(world).records.get("projectile")!.body.isCcdEnabled(), true);
    world.resume();
    const trace = [],
      events: PhysicsEvent[] = [];
    for (let tick = 0; tick < 30; tick++) {
      const snapshot = world.step();
      const pose = snapshot.poses.find((p) => p.objectId === "projectile")!;
      assert.ok(
        [...pose.positionMetres, ...pose.linearVelocityMetresPerSecond].every(Number.isFinite),
      );
      assert.ok(
        pose.positionMetres[0] < -0.005,
        "CCD must keep the projectile COM on the original side of the wall's near face",
      );
      trace.push(pose);
      events.push(...snapshot.events);
    }
    const throws = events.filter((e) => e.type === "OnThrow");
    assert.equal(throws.length, 1);
    near(throws[0]!.impulseNs!, 1.2, "one COM impulse uses remaining speed budget, in N s");
    measurements.push({
      requirement: "V1-PHY-05",
      wallThicknessM: 0.01,
      sphereDiameterM: 0.02,
      commandedSpeedMps: 12,
      perTickTravelM: 12 * dt,
      thrown,
      trace,
      events,
      limitation:
        "CCD intermediate impact manifolds may not survive post-step; no complete micro-contact trace claim",
    });
  } finally {
    world.dispose();
  }
});

function pointVelocity(pose: BodyPose, point: Vec3): Vec3 {
  const rotational = cross(
    pose.angularVelocityRadiansPerSecond,
    subtract(point, pose.positionMetres),
  );
  return pose.linearVelocityMetresPerSecond.map((x, i) => x + rotational[i]!) as Vec3;
}

for (const supportFirst of [true, false]) {
  test(`rotated contact uses canonical world normal and v+omega cross r (${supportFirst ? "support" : "body"} sorts first)`, async () => {
    const angle = Math.PI / 6,
      n: Vec3 = [-Math.sin(angle), Math.cos(angle), 0],
      tangent: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
    const supportId = supportFirst ? "a.plane" : "z.plane",
      ballId = supportFirst ? "z.ball" : "a.ball";
    const world = await PhysicsWorld.create(
      scene(
        [
          object(ballId, { positionM: n.map((v) => v * 0.5) as Vec3 }),
          object(supportId, {
            shape: "box",
            dimensionsM: [4, 0.2, 4],
            positionM: [0, 0, 0],
            orientationQuaternion: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)],
            mode: "fixed",
          }),
        ],
        [0, 0, 0],
      ),
    );
    try {
      world.setVelocity(ballId, n.map((v, i) => -2 * v + 0.5 * tangent[i]!) as Vec3, [0, 0, 3]);
      world.resume();
      let checked = false;
      for (let tick = 0; tick < 30; tick++) {
        const before = new Map(world.snapshot().poses.map((p) => [p.objectId, p]));
        const snapshot = world.step();
        const impact = snapshot.events.find((e) => e.type === "OnImpact");
        if (!impact?.contact) continue;
        const c = impact.contact;
        assert.equal(c.objectA, supportFirst ? supportId : ballId);
        assert.equal(c.objectB, supportFirst ? ballId : supportId);
        assert.equal(c.materialA, `mat.${c.objectA}`);
        assert.equal(c.materialB, `mat.${c.objectB}`);
        near(
          dot(c.pointWorldMetres, n),
          0.1,
          "rotated fixed support witness lies on its analytic upper plane",
        );
        for (let i = 0; i < 3; i++)
          near(c.normalAtoB[i]!, n[i]! * (supportFirst ? 1 : -1), "canonical world normal");
        const relative = subtract(
          pointVelocity(before.get(c.objectB)!, c.pointWorldMetres),
          pointVelocity(before.get(c.objectA)!, c.pointWorldMetres),
        );
        const normalSpeed = dot(relative, c.normalAtoB);
        const tangentSpeed = norm(relative.map((v, i) => v - normalSpeed * c.normalAtoB[i]!));
        near(
          c.closingSpeedMetresPerSecond!,
          Math.max(0, -normalSpeed),
          "pre-step point closing speed",
        );
        near(c.tangentSpeedMetresPerSecond!, tangentSpeed, "pre-step angular point velocity");
        assert.ok(
          Math.abs(tangentSpeed - 0.5) > 0.1,
          "fixture must distinguish point velocity from COM-only velocity",
        );
        assert.equal(c.impulseMethod, "RapierContactImpulse");
        const saved = structuredClone(c);
        world.step();
        assert.deepEqual(c, saved, "copied manifold data must survive the next WASM step");
        measurements.push({
          requirement: "V1-EVT-01",
          supportFirst,
          normalReference: n,
          before: [...before.values()],
          impact,
          relativePointVelocityMps: relative,
          referenceClosingSpeedMps: Math.max(0, -normalSpeed),
          referenceTangentSpeedMps: tangentSpeed,
        });
        checked = true;
        break;
      }
      assert.equal(checked, true, "fixture must generate an actual rotated surface impact");
    } finally {
      world.dispose();
    }
  });
}

test("flat box multipoint impact aggregates positive manifold impulses once per pair in N s", async () => {
  const world = await PhysicsWorld.create(
    scene(
      [
        floor(),
        object("box", { shape: "box", dimensionsM: [0.6, 0.4, 0.6], positionM: [0, 0.6, 0] }),
      ],
      [0, 0, 0],
    ),
  );
  try {
    world.setVelocity("box", [0, -2, 0]);
    world.resume();
    const events: PhysicsEvent[] = [];
    let checked = false;
    for (let tick = 0; tick < 120; tick++) {
      const pre = world.getPose("box");
      const snapshot = world.step();
      events.push(...snapshot.events);
      const impact = snapshot.events.find((e) => e.type === "OnImpact");
      if (!impact?.contact) continue;
      const real = raw(world),
        box = real.records.get("box")!,
        support = real.records.get("floor")!;
      const impulses: number[] = [],
        supportWitnesses: Vec3[] = [];
      real.world.contactPair(box.collider, support.collider, (manifold, flipped) => {
        for (let i = 0; i < manifold.numContacts(); i++) {
          if (manifold.contactDist(i) > 0.015) continue;
          impulses.push(manifold.contactImpulse(i));
          // This reference floor is an unrotated fixed cuboid. Its local witness
          // therefore needs only its independently observed world translation.
          const local = flipped ? manifold.localContactPoint1(i) : manifold.localContactPoint2(i);
          assert.ok(local);
          const translation = support.collider.translation();
          supportWitnesses.push([
            local.x + translation.x,
            local.y + translation.y,
            local.z + translation.z,
          ]);
        }
      });
      assert.ok(impulses.length >= 4, "fixture must actually solve a multipoint face patch");
      assert.ok(
        impulses.every((j) => j > 0),
        "all reference contacts must carry positive solved impulse",
      );
      const sumNs = impulses.reduce((s, j) => s + j, 0);
      near(
        impact.contact.normalImpulseNewtonSeconds!,
        sumNs,
        "aggregate matches independent raw contact impulses",
      );
      const deltaMomentumNs =
        (world.getPose("box").linearVelocityMetresPerSecond[1] -
          pre.linearVelocityMetresPerSecond[1]) *
        1;
      near(
        sumNs,
        deltaMomentumNs,
        "N s equals real COM momentum change with no gravity/friction/restitution",
      );
      assert.ok(
        Math.abs(sumNs / dt - sumNs) > 1,
        "force in N differs from impulse in N s by the fixed-step factor",
      );
      const weightedWitness = [0, 1, 2].map(
        (axis) =>
          supportWitnesses.reduce((sum, point, i) => sum + point[axis]! * impulses[i]!, 0) / sumNs,
      ) as Vec3;
      for (let axis = 0; axis < 3; axis++)
        near(
          impact.contact.pointWorldMetres[axis]!,
          weightedWitness[axis]!,
          "positive-impulse-weighted actual support witnesses",
        );
      near(impact.contact.pointWorldMetres[1], 0, "fixed floor witness y");
      measurements.push({
        requirement: "V1-EVT-01/V1-EVT-02",
        impact,
        impulsesNs: impulses,
        supportWitnessesMetres: supportWitnesses,
        independentWeightedWitnessMetres: weightedWitness,
        sumNs,
        deltaMomentumNs,
        forceEquivalentNewtons: sumNs / dt,
      });
      checked = true;
    }
    assert.equal(checked, true);
    assert.equal(
      events.filter((e) => e.type === "OnImpact").length,
      1,
      "one multipoint patch must produce one pair impact, then resting support stays silent",
    );
    assert.equal(events.filter((e) => e.type === "ContactBegin").length, 1);
  } finally {
    world.dispose();
  }
});

test("simultaneous corner contacts retain separate domain pairs, normals and episodes", async () => {
  const world = await PhysicsWorld.create(
    scene(
      [
        floor(),
        object("wall", {
          shape: "box",
          dimensionsM: [0.2, 4, 4],
          positionM: [-0.1, 2, 0],
          mode: "fixed",
        }),
        object("ball", { positionM: [0.4, 0.4, 0] }),
      ],
      [0, 0, 0],
    ),
  );
  try {
    world.setVelocity("ball", [-2, -2, 0]);
    world.resume();
    const events: PhysicsEvent[] = [];
    for (let tick = 0; tick < 120; tick++) events.push(...world.step().events);
    const impacts = events.filter((e) => e.type === "OnImpact");
    assert.equal(
      impacts.length,
      2,
      "two physical corner surfaces must yield exactly one impact each",
    );
    assert.equal(
      new Set(impacts.map((e) => e.tick)).size,
      1,
      "fixture must hit both surfaces in the same fixed step",
    );
    assert.equal(new Set(impacts.map((e) => e.contact!.pairKey)).size, 2);
    assert.equal(new Set(impacts.map((e) => e.contact!.episodeId)).size, 2);
    for (const impact of impacts) {
      assert.equal(impact.objectId, "ball");
      const expected = impact.otherObjectId === "floor" ? [0, -1, 0] : [-1, 0, 0];
      for (let i = 0; i < 3; i++)
        near(
          impact.contact!.normalAtoB[i]!,
          expected[i]!,
          "corner normals cannot blend between pairs",
        );
    }
    measurements.push({
      requirement: "V1-EVT-01/V1-EVT-02",
      impacts,
      contactBegins: events.filter((e) => e.type === "ContactBegin"),
      ticks: world.tick,
      limitation: "separate simple convex wall objects; no compound/multipatch completeness claim",
    });
  } finally {
    world.dispose();
  }
});

after(async () => {
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/v1-physics-boundaries.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          rapier: "0.21.0",
          fixedDtSeconds: dt,
        },
        numericalOracleTolerance: {
          absolute: 1e-5,
          scope:
            "copied Float32 WASM data vs analytic transform/vector/momentum arithmetic only; not a physical penetration tolerance",
        },
        measurements,
        limitations: [
          "Node/WASM only; browser input/rendering/hearing are separate",
          "No universal geometric penetration tolerance or complete CCD micro-contact trace is claimed",
          "Read-only raw Rapier observation supplies references; control and event outputs use actual public PhysicsWorld APIs",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});
