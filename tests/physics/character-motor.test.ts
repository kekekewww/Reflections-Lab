import assert from "node:assert/strict";
import test from "node:test";
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMotor, type CharacterInput } from "../../src/physics/character-motor.js";

await RAPIER.init();
const dt = 1 / 60;
const idle = { forward: 0, right: 0, yaw: 0 };

function floorWorld(gravity = -9.81): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
  world.timestep = dt;
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setTranslation(0, -0.1, 0));
  world.step();
  return world;
}

function step(
  world: RAPIER.World,
  motor: CharacterMotor,
  input: CharacterInput = idle,
  count = 1,
): void {
  for (let i = 0; i < count; i++) {
    motor.step(input, dt);
    world.step();
  }
}

test("capsule falls to a real floor and reports a bounded eye height", () => {
  const world = floorWorld();
  const motor = new CharacterMotor(world, [0, 3, 0]);
  try {
    step(world, motor, idle, 120);
    const state = motor.snapshot();
    assert.equal(state.grounded, true);
    assert.ok(state.footPositionMetres[1] >= -0.001 && state.footPositionMetres[1] < 0.04);
    assert.ok(Math.abs(state.eyePositionMetres[1] - state.footPositionMetres[1] - 1.6) < 1e-6);
    assert.ok(Math.abs(state.positionMetres[1] - state.footPositionMetres[1] - 0.875) < 1e-6);
    assert.equal(state.verticalVelocityMps, 0);
    const y = state.positionMetres[1];
    step(world, motor, idle, 120);
    assert.ok(Math.abs(motor.snapshot().positionMetres[1] - y) < 0.002);
  } finally {
    motor.dispose();
    world.free();
  }
});

test("wall stops the capsule instead of moving the camera through the collider", () => {
  const world = floorWorld();
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 2, 5).setTranslation(1.5, 2, 0));
  world.step();
  const motor = new CharacterMotor(world, [0, 0.02, 0]);
  try {
    step(world, motor, { forward: 0, right: 1, yaw: 0 }, 180);
    const x = motor.snapshot().positionMetres[0];
    assert.ok(x > 1.1 && x < 1.15, `capsule centre must remain before x=1.4 wall face: ${x}`);
    assert.ok(
      motor.collider.contactShape(
        new RAPIER.Cuboid(0.1, 2, 5),
        { x: 1.5, y: 2, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        0.1,
      )!.distance > -0.001,
    );
  } finally {
    motor.dispose();
    world.free();
  }
});

test("diagonal input does not exceed 2m/s and yaw preserves -Z forward", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = dt;
  const motor = new CharacterMotor(world, [0, 2, 0]);
  try {
    step(world, motor, { forward: 1, right: 1, yaw: 0 }, 60);
    const first = motor.snapshot().positionMetres;
    assert.ok(Math.abs(Math.hypot(first[0], first[2]) - 2) < 1e-4);
    assert.ok(first[0] > 0 && first[2] < 0);
    motor.reset([0, 2, 0]);
    world.step();
    step(world, motor, { forward: 1, right: 0, yaw: Math.PI / 2 }, 60);
    const rotated = motor.snapshot().positionMetres;
    assert.ok(Math.abs(rotated[0] + 2) < 1e-4);
    assert.ok(Math.abs(rotated[2]) < 1e-4);
  } finally {
    motor.dispose();
    world.free();
  }
});

test("sprint is bounded at 3.5m/s and invalid input cannot schedule movement", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = dt;
  const motor = new CharacterMotor(world, [0, 2, 0]);
  try {
    step(world, motor, { ...idle, forward: 1, sprint: true }, 60);
    assert.ok(Math.abs(motor.snapshot().positionMetres[2] + 3.5) < 1e-4);
    const before = motor.snapshot();
    assert.throws(() => motor.step({ ...idle, forward: Number.NaN }, dt), {
      code: "INVALID_INPUT",
    });
    assert.throws(() => motor.step(idle, Number.POSITIVE_INFINITY), { code: "INVALID_INPUT" });
    assert.throws(() => motor.step({ ...idle, right: 2 }, dt), { code: "INVALID_INPUT" });
    assert.deepEqual(motor.snapshot(), before);
  } finally {
    motor.dispose();
    world.free();
  }
});

test("blocked spawn/reset is rejected atomically and disposal releases the capsule", () => {
  const world = floorWorld();
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2, 1).setTranslation(5, 2, 0));
  world.step();
  const count = world.bodies.len();
  assert.throws(() => new CharacterMotor(world, [5, 0, 0]), { code: "SPAWN_BLOCKED" });
  assert.equal(world.bodies.len(), count);
  const motor = new CharacterMotor(world, [0, 0.02, 0]);
  try {
    const before = motor.snapshot();
    assert.throws(() => motor.reset([5, 0, 0]), { code: "SPAWN_BLOCKED" });
    assert.deepEqual(motor.snapshot(), before);
    motor.dispose();
    motor.dispose();
    assert.equal(world.bodies.len(), count);
    assert.throws(() => motor.snapshot(), { code: "DISPOSED" });
  } finally {
    motor.dispose();
    world.free();
  }
});

test("new world queries cannot move the capsule into an unprimed wall or floor", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = dt;
  world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0));
  const wall = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.01, 2, 3).setTranslation(0.28, 2, 0),
  );
  const motor = new CharacterMotor(world, [0, 0, 0]);
  try {
    step(world, motor, { forward: 0, right: 1, yaw: 0 }, 10);
    const state = motor.snapshot();
    assert.ok(state.footPositionMetres[1] >= -0.0001);
    assert.ok(state.positionMetres[0] <= 0.0201);
    assert.ok(motor.collider.contactCollider(wall, 0.1)!.distance >= -0.0001);
  } finally {
    motor.dispose();
    world.free();
  }
});

test("newly committed obstacles are guarded before their first broad-phase update", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = dt;
  const motor = new CharacterMotor(world, [0, 2, 0]);
  try {
    step(world, motor, idle, 2);
    const wall = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.01, 2, 3).setTranslation(0.28, 3, 0),
    );
    step(world, motor, { forward: 0, right: 1, yaw: 0 });
    assert.ok(motor.snapshot().positionMetres[0] <= 0.0201);
    assert.ok(motor.collider.contactCollider(wall, 0.1)!.distance >= -0.0001);
  } finally {
    motor.dispose();
    world.free();
  }
});
