import assert from "node:assert/strict";
import test from "node:test";
import { PhysicsWorld } from "../../src/physics/physics-world.js";
import type { SceneObject, SceneSpec, Vec3 } from "../../src/scene/types.js";

function body(id = "ball", patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [1, 1, 1],
    positionM: [0, 0.5, 0],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicNoGravity",
    massKg: 1,
    friction: 0,
    restitution: 0,
    physicsMaterialId: "material.test",
    acousticMaterialId: "material.test",
    acousticRole: "none",
    ...patch,
  };
}
function scene(objects = [body()], gravityMps2: Vec3 = [0, 0, 0]): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "motion-hysteresis",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 17,
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
async function unsupported() {
  const world = await PhysicsWorld.create(scene());
  world.resume();
  return world;
}
async function supported() {
  const world = await PhysicsWorld.create(
    scene(
      [
        body("ball", { mode: "dynamicGravity" }),
        body("floor", {
          shape: "box",
          dimensionsM: [20, 0.2, 20],
          positionM: [0, -0.1, 0],
          mode: "fixed",
        }),
      ],
      [0, -9.81, 0],
    ),
  );
  world.resume();
  for (let i = 0; i < 60; i++) world.step();
  assert.ok(world.getPose("ball").contact, "actual Rapier support contact required");
  return world;
}
function stepVelocity(world: PhysicsWorld, speed: number, omega: Vec3 = [0, 0, 0]) {
  world.setVelocity("ball", [speed, 0, 0], omega);
  return world.step().poses.find((pose) => pose.objectId === "ball")!;
}

test("moving uses fixed-step enter/exit hysteresis and two low-speed samples before stop", async () => {
  const world = await unsupported();
  try {
    assert.equal(stepVelocity(world, 0.04).moving, false);
    assert.equal(stepVelocity(world, 0.06).moving, true);
    assert.equal(
      world.snapshot().events.filter((event) => event.type === "OnStartMoving").length,
      1,
    );
    for (const speed of [0.049, 0.03, 0.051, 0.035]) {
      assert.equal(stepVelocity(world, speed).moving, true);
      assert.equal(world.snapshot().events.filter((event) => /Moving$/.test(event.type)).length, 0);
    }
    assert.equal(stepVelocity(world, 0.02).moving, true, "one low sample cannot stop");
    assert.equal(stepVelocity(world, 0.035).moving, true, "returning to band resets stop debounce");
    assert.equal(stepVelocity(world, 0.02).moving, true);
    assert.equal(stepVelocity(world, 0.02).moving, false);
    assert.equal(
      world.snapshot().events.filter((event) => event.type === "OnStopMoving").length,
      1,
    );
    assert.equal(stepVelocity(world, 0.04).moving, false);
  } finally {
    world.dispose();
  }
});

test("snapshot/interpolation reads cannot advance motion state or absorb the next movement edge", async () => {
  const world = await unsupported();
  try {
    world.setVelocity("ball", [0.06, 0, 0], [0, 0.12, 0]);
    for (let i = 0; i < 5; i++) {
      assert.equal(world.snapshot().poses[0]!.moving, false);
      assert.equal(world.interpolatedPoses(i / 4)[0]!.moving, false);
    }
    const first = world.step();
    assert.equal(first.poses[0]!.moving, true);
    assert.equal(first.events.filter((event) => event.type === "OnStartMoving").length, 1);
    world.setVelocity("ball", [0, 0, 0], [0, 0, 0]);
    world.step();
    for (let i = 0; i < 5; i++) assert.equal(world.getPose("ball").moving, true);
    assert.equal(world.step().poses[0]!.moving, false);
  } finally {
    world.dispose();
  }
});

test("spinning has radian-per-second hysteresis independent of linear speed", async () => {
  const world = await unsupported();
  try {
    assert.equal(stepVelocity(world, 0, [0, 0.08, 0]).spinning, false);
    assert.equal(stepVelocity(world, 0, [0, 0.12, 0]).spinning, true);
    for (const speed of [0.08, 0.06, 0.09]) {
      const pose = stepVelocity(world, 0, [0, speed, 0]);
      assert.equal(pose.spinning, true);
      assert.equal(pose.moving, false);
    }
    assert.equal(stepVelocity(world, 0, [0, 0.04, 0]).spinning, true);
    assert.equal(stepVelocity(world, 0, [0, 0.04, 0]).spinning, false);
  } finally {
    world.dispose();
  }
});

test("actual supported sphere retains rolling/sliding through the slip band and transitions without both", async () => {
  const world = await supported();
  try {
    let pose = stepVelocity(world, 0.2, [0, 0, -0.4]);
    assert.equal(pose.rolling, true);
    assert.equal(pose.sliding, false);
    for (let i = 0; i < 5; i++) {
      pose = stepVelocity(world, 0.2, [0, 0, -0.2]);
      assert.ok(
        pose.contact!.tangentSpeedMetresPerSecond! > 0.085 &&
          pose.contact!.tangentSpeedMetresPerSecond! < 0.115,
      );
      assert.equal(pose.rolling, true, "prior rolling survives 0.1m/s slip band");
      assert.equal(pose.sliding, false);
    }
    pose = stepVelocity(world, 0.2);
    assert.equal(pose.rolling, false);
    assert.equal(pose.sliding, true);
    for (let i = 0; i < 5; i++) {
      pose = stepVelocity(world, 0.2, [0, 0, -0.2]);
      assert.equal(pose.rolling, false);
      assert.equal(pose.sliding, true, "prior sliding survives same band");
    }
    pose = stepVelocity(world, 0.2, [0, 0, -0.28]);
    assert.equal(pose.sliding, true, "single low-slip sample is insufficient");
    pose = stepVelocity(world, 0.2, [0, 0, -0.28]);
    assert.equal(pose.sliding, false);
    assert.equal(pose.rolling, true);
  } finally {
    world.dispose();
  }
});

test("normal-axis spin plus slow contact translation cannot be mislabeled rolling", async () => {
  const world = await supported();
  try {
    const pose = stepVelocity(world, 0.06, [0, 0.3, 0]);
    assert.equal(pose.spinning, true);
    assert.equal(pose.moving, true);
    assert.equal(pose.rolling, false);
    assert.equal(pose.sliding, false);
    assert.ok(pose.contact!.tangentSpeedMetresPerSecond! < 0.08);
  } finally {
    world.dispose();
  }
});

test("a fixed support does not become a sliding object when a dynamic sphere scrapes it", async () => {
  const world = await supported();
  try {
    assert.equal(stepVelocity(world, 0.2).sliding, true);
    const support = world.getPose("floor");
    assert.equal(support.sliding, false);
    assert.equal(support.moving, false);
    assert.equal(support.spinning, false);
  } finally {
    world.dispose();
  }
});

test("a sphere rolling on the floor while scraping a wall anchors sliding to the actual high-slip wall", async () => {
  const world = await PhysicsWorld.create(
    scene(
      [
        body("ball", { mode: "dynamicGravity", positionM: [0.5, 0.5, 0] }),
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
      ],
      [0, -9.81, 0],
    ),
  );
  try {
    world.resume();
    for (let i = 0; i < 60; i++) world.step();
    world.setVelocity("ball", [0, 0, 0.3], [0.6, 0, 0]);
    const pose = world.step().poses.find((value) => value.objectId === "ball")!;
    assert.equal(pose.sliding, true);
    assert.equal(pose.rolling, false);
    assert.ok(
      [pose.contact!.objectA, pose.contact!.objectB].includes("wall"),
      "selected anchor must be the high-slip contact",
    );
    assert.ok(pose.contact!.tangentSpeedMetresPerSecond! > 0.25);
    assert.ok(Math.abs(pose.contact!.pointWorldMetres[0]) < 0.001, "wall boundary is x=0");
  } finally {
    world.dispose();
  }
});

test("held and pause are orthogonal to motion; mode/lifecycle changes clear stale gates", async () => {
  const world = await unsupported();
  try {
    const moving = stepVelocity(world, 0.06, [0, 0.12, 0]);
    world.grab("ball", moving.positionMetres, "grab-motion");
    assert.equal(world.getPose("ball").held, true);
    assert.equal(world.getPose("ball").moving, true);
    world.pause();
    const before = world.snapshot();
    world.advance(1);
    assert.deepEqual(world.snapshot(), before);
    world.setMode("ball", "fixed");
    assert.equal(world.heldObjectId, null);
    assert.equal(world.getPose("ball").moving, false);
    assert.equal(world.getPose("ball").spinning, false);
    world.setMode("ball", "dynamicNoGravity");
    world.resume();
    assert.equal(stepVelocity(world, 0.04, [0, 0.08, 0]).moving, false);
    stepVelocity(world, 0.06);
    world.setObjectEnabled("ball", false);
    assert.equal(world.getPose("ball").moving, false);
    assert.equal(world.getPose("ball").rolling, null);
    world.setObjectEnabled("ball", true);
    assert.equal(world.getPose("ball").moving, false);
    assert.equal(stepVelocity(world, 0.04).moving, false);
  } finally {
    world.dispose();
  }
});

test("reset, replacement and remove/re-add start fresh bounded generation state", async () => {
  const definition = scene();
  const world = await PhysicsWorld.create(definition);
  try {
    world.resume();
    stepVelocity(world, 0.06);
    const oldGeneration = world.getPose("ball").generation;
    world.reset();
    assert.ok(world.getPose("ball").generation > oldGeneration);
    assert.equal(world.getPose("ball").moving, false);
    world.resume();
    assert.equal(stepVelocity(world, 0.04).moving, false);
    stepVelocity(world, 0.06);
    world.pause();
    world.applyScene({
      ...definition,
      sceneRevision: 1,
      objects: [body("ball", { dimensionsM: [0.5, 0.5, 0.5] })],
    });
    assert.equal(world.getPose("ball").moving, false);
    world.applyScene({ ...definition, sceneRevision: 2, objects: [] });
    world.applyScene({ ...definition, sceneRevision: 3 });
    assert.equal(world.getPose("ball").moving, false);
    world.resume();
    assert.equal(stepVelocity(world, 0.04).moving, false);
  } finally {
    world.dispose();
  }
});
