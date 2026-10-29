import assert from "node:assert/strict";
import test from "node:test";
import { PhysicsWorld } from "../../src/physics/index.js";
import type { BodyPose } from "../../src/physics/types.js";
import type { SceneObject, SceneSpec, Vec3 } from "../../src/scene/types.js";
import type { ContactData } from "../../schemas/sound-behavior/types.js";
import { originalPoses } from "./fixtures/contact-projection-reference.mjs";

interface PairProjection {
  a: string;
  b: string;
  contact: ContactData | null;
}
interface ProjectionSeam {
  poses(updateMotion?: boolean): BodyPose[];
  records: Map<string, { motion: Record<string, unknown> }>;
  pairs: Map<string, PairProjection>;
}
const seam = (world: PhysicsWorld) => world as unknown as ProjectionSeam;
function body(id: string, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [1, 1, 1],
    positionM: [0.5, 0.5, 0],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicGravity",
    massKg: 1,
    friction: 0,
    restitution: 0,
    physicsMaterialId: "material.test",
    acousticMaterialId: "material.test",
    acousticRole: "none",
    ...patch,
  };
}
function scene(objects: SceneObject[], gravityMps2: Vec3 = [0, -9.81, 0]): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "contact-projection",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 7,
    gravityMps2,
    objects,
    sources: [],
    listener: {
      id: "listener",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}
function motionState(world: PhysicsWorld) {
  return new Map(
    [...seam(world).records].map(([id, record]) => [id, structuredClone(record.motion)]),
  );
}
function restoreMotion(world: PhysicsWorld, states: ReturnType<typeof motionState>) {
  for (const [id, motion] of states) seam(world).records.get(id)!.motion = structuredClone(motion);
}
function compareOriginal(world: PhysicsWorld, updateMotion: boolean) {
  const before = motionState(world);
  const expected = originalPoses.call(world, updateMotion);
  const expectedMotion = motionState(world);
  restoreMotion(world, before);
  try {
    const actual = seam(world).poses(updateMotion);
    assert.deepEqual(actual, expected);
    assert.deepEqual(motionState(world), expectedMotion);
    return actual;
  } finally {
    restoreMotion(world, before);
  }
}
async function floorAndWall() {
  const world = await PhysicsWorld.create(
    scene([
      body("ball"),
      body("floor", {
        shape: "box",
        dimensionsM: [20, 0.2, 20],
        positionM: [0, -0.1, 0],
        mode: "fixed",
      }),
      body("wall", {
        shape: "box",
        dimensionsM: [0.2, 4, 20],
        positionM: [-0.1, 1, 0],
        mode: "fixed",
      }),
    ]),
  );
  world.resume();
  for (let i = 0; i < 60; i++) world.step();
  return world;
}

test("each pose projection visits each contact pair once and rebuilds after pair changes", async () => {
  const world = await floorAndWall();
  try {
    const pairs = seam(world).pairs;
    assert.ok(pairs.size >= 2, "actual Rapier floor and wall contacts are required");
    const values = pairs.values.bind(pairs);
    let visits = 0;
    pairs.values = () => {
      const iterator = values();
      const next = iterator.next.bind(iterator);
      iterator.next = () => {
        const value = next();
        if (!value.done) visits++;
        return value;
      };
      return iterator;
    };
    const retained = world.snapshot();
    assert.equal(retained.poses.length, 3);
    assert.ok(retained.poses.find((pose) => pose.objectId === "ball")!.contact);
    assert.equal(visits, pairs.size, "pair traversal must scale with pairs, not bodies × pairs");
    const before = structuredClone(retained);
    pairs.delete([...pairs.keys()][0]!);
    visits = 0;
    const changed = world.snapshot().poses;
    assert.equal(visits, pairs.size, "each later read must rebuild its current contact index");
    pairs.values = values;
    assert.deepEqual(changed, originalPoses.call(world, false));
    assert.deepEqual(retained, before, "a later projection cannot mutate the retained snapshot");
  } finally {
    world.dispose();
  }
});

test("contact index matches retained scan reference for actual support, wall scrape and slip transitions", async () => {
  const world = await floorAndWall();
  try {
    for (const [speed, angular] of [
      [0.2, [0, 0, -0.4]],
      [0.2, [0, 0, -0.2]],
      [0.2, [0, 0, 0]],
      [0.3, [0.6, 0, 0]],
      [0.04, [0, 0.3, 0]],
    ] as [number, Vec3][]) {
      world.setVelocity("ball", [0, 0, speed], angular);
      world.step();
      compareOriginal(world, false);
      compareOriginal(world, true);
    }
  } finally {
    world.dispose();
  }
});

for (const supportFirst of [true, false]) {
  test(`contact index matches rotated support reference (${supportFirst ? "support" : "body"} sorts first)`, async () => {
    const angle = Math.PI / 6;
    const n: Vec3 = [-Math.sin(angle), Math.cos(angle), 0];
    const supportId = supportFirst ? "a.plane" : "z.plane";
    const ballId = supportFirst ? "z.ball" : "a.ball";
    const world = await PhysicsWorld.create(
      scene(
        [
          body(ballId, { positionM: n.map((value) => value * 0.5) as Vec3 }),
          body(supportId, {
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
      world.setVelocity(ballId, n.map((value) => -2 * value) as Vec3, [0, 0, 3]);
      world.resume();
      let contacts = 0;
      for (let i = 0; i < 15; i++) {
        world.step();
        contacts += Number(Boolean(world.getPose(ballId).contact));
        compareOriginal(world, false);
        compareOriginal(world, true);
      }
      assert.ok(contacts > 0, "the rotated fixture must produce actual contacts");
    } finally {
      world.dispose();
    }
  });
}

test("projection-only synthetic ties, nulls, unknown slip and nested copies preserve original selection", async () => {
  const world = await floorAndWall();
  try {
    const internal = seam(world);
    const template = [...internal.pairs.values()].find((pair) => pair.contact)!.contact!;
    const pair = (
      key: string,
      a: string,
      b: string,
      impulse: number,
      slip: number | null,
      normal: Vec3,
    ): PairProjection => ({
      a,
      b,
      contact: {
        ...structuredClone(template),
        pairKey: key,
        episodeId: `${key}.episode`,
        objectA: a,
        objectB: b,
        normalImpulseNewtonSeconds: impulse,
        tangentSpeedMetresPerSecond: slip,
        normalAtoB: normal,
      },
    });
    // These values exercise projection ordering only; they are not measured physical contacts.
    internal.pairs = new Map([
      ["z.support", pair("z.support", "ball", "floor", 2, 0.02, [0, -1, 0])],
      ["z.wall", pair("z.wall", "ball", "wall", 20, 0.3, [-1, 0, 0])],
      ["a.support", pair("a.support", "floor", "ball", 2, 0.02, [0, 1, 0])],
      ["a.wall", pair("a.wall", "wall", "ball", 20, 0.3, [1, 0, 0])],
      ["null", { a: "ball", b: "wall", contact: null }],
    ]);
    internal.records.get("ball")!.motion.sliding = false;
    assert.equal(
      compareOriginal(world, false).find((pose) => pose.objectId === "ball")!.contact!.pairKey,
      "a.support",
    );
    internal.records.get("ball")!.motion.sliding = true;
    const sliding = compareOriginal(world, false).find((pose) => pose.objectId === "ball")!;
    assert.equal(sliding.contact!.pairKey, "a.wall");
    const stored = structuredClone(internal.pairs.get("a.wall")!.contact);
    sliding.contact!.pointWorldMetres[0] = 123;
    sliding.contact!.normalAtoB[0] = 123;
    assert.deepEqual(internal.pairs.get("a.wall")!.contact, stored);
    internal.pairs.get("a.wall")!.contact!.tangentSpeedMetresPerSecond = null;
    compareOriginal(world, true);
    internal.pairs.delete("z.support");
    compareOriginal(world, false);
  } finally {
    world.dispose();
  }
});
