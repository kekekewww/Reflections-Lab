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
