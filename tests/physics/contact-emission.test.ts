import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../../src/physics/index.js";
import { createDefaultScene } from "../../src/app/defaults.js";

test("impact emitter uses the fixed support's actual contact witness rather than a penetrated midpoint", async () => {
  const world = await PhysicsWorld.create(createDefaultScene());
  try {
    world.resume();
    let checked = false;
    for (let tick = 0; tick < 55; tick++) {
      const snapshot = world.step();
      const event = snapshot.events.find(
        (value) =>
          value.type === "OnImpact" &&
          value.contact &&
          (value.contact.objectA === "floor" || value.contact.objectB === "floor"),
      );
      if (!event?.contact) continue;
      assert.ok(
        Math.abs(event.contact.pointWorldMetres[1]) < 1e-7,
        "floor top is y=0; a collider contact witness must stay on that surface",
      );
      assert.ok(event.contact.normalImpulseNewtonSeconds! > 0);
      checked = true;
      break;
    }
    assert.ok(checked, "the scene must contain a real floor impact");
  } finally {
    world.dispose();
  }
});

async function dropBall(heightM: number, ticks: number) {
  const scene = createDefaultScene();
  const ball = scene.objects.find((object) => object.id === "ball")!;
  ball.positionM = [ball.positionM[0], heightM, ball.positionM[2]];
  const world = await PhysicsWorld.create(scene);
  world.resume();
  const bounces: Array<{ tick: number; incomingMps: number; impact: boolean }> = [];
  const impacts: number[] = [];
  let previousVy = 0;
  try {
    for (let tick = 0; tick < ticks; tick++) {
      const snapshot = world.step();
      const pose = snapshot.poses.find((entry) => entry.objectId === "ball")!;
      const vy = pose.linearVelocityMetresPerSecond[1];
      const impact = snapshot.events.some(
        (event) =>
          event.type === "OnImpact" &&
          event.contact &&
          [event.contact.objectA, event.contact.objectB].includes("floor") &&
          [event.contact.objectA, event.contact.objectB].includes("ball"),
      );
      if (impact) impacts.push(snapshot.tick);
      // A floor bounce: falling into the support, rising after this step's solve.
      if (previousVy < 0 && vy > 0.05)
        bounces.push({ tick: snapshot.tick, incomingMps: -previousVy, impact });
      previousVy = vy;
    }
  } finally {
    world.dispose();
  }
  return { bounces, impacts };
}

test("every audible floor bounce of the default ball emits OnImpact regardless of step phase", async () => {
  // The step phase decides whether the solver meets the floor through a penetrating or a
  // speculative contact; a speculative contact that carried impulse is the same physical hit.
  for (const heightM of [0.4, 0.6, 0.8, 1, 1.3, 1.6, 2, 2.5, 3]) {
    const { bounces } = await dropBall(heightM, 240);
    const audible = bounces.filter((bounce) => bounce.incomingMps >= 0.4);
    assert.ok(audible.length >= 2, `drop ${heightM} m must bounce at least twice audibly`);
    for (const bounce of audible)
      assert.ok(
        bounce.impact,
        `drop ${heightM} m: bounce at tick ${bounce.tick} (${bounce.incomingMps.toFixed(2)} m/s) had no OnImpact`,
      );
  }
});

test("a settled ball does not rearm impacts from its resting contact", async () => {
  const { impacts } = await dropBall(1.6, 600);
  assert.ok(impacts.length >= 2);
  // The last impact belongs to the final small bounce, long before 10 s of rest.
  assert.ok(impacts.at(-1)! < 120, `late impacts while resting: ${impacts.join(",")}`);
});
