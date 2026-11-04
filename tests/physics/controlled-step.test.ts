import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultScene } from "../../src/app/defaults.js";
import { PhysicsWorld } from "../../src/physics/physics-world.js";

async function overrunWorld() {
  const world = await PhysicsWorld.create(createDefaultScene(), { clockMode: "recording" });
  world.resume();
  assert.equal(world.advance(0.2 + 1 / 240).steps, 4);
  assert.equal(world.paused, true);
  return world;
}

test("controlled physics advances exactly one real Rapier step without altering wall-time debt", async () => {
  const world = await overrunWorld();
  try {
    const debt = world.clock.accumulatorSeconds;
    const startY = world.getPose("ball").positionMetres[1];
    let calls = 0;
    assert.equal(world.advanceControlledStep(() => calls++).steps, 0);
    world.resume();
    const result = world.advanceControlledStep((snapshot) => {
      calls++;
      assert.equal(snapshot.tick, 5);
    });
    assert.equal(result.steps, 1);
    assert.equal(result.tick, 5);
    assert.equal(world.clock.tick, 5);
    assert.equal(result.overrun, false);
    assert.equal(calls, 1);
    assert.ok(world.getPose("ball").positionMetres[1] < startY);
    assert.equal(world.clock.accumulatorSeconds, debt);
    assert.equal(world.clock.totalDroppedWallTimeSeconds, 0);
    assert.equal(world.advance(0).steps, 4);
    assert.equal(world.paused, true);
    world.resume();
    assert.equal(world.advance(0).steps, 4);
    assert.equal(world.tick, 13);
    assert.equal(world.clock.tick, 13);
    assert.ok(Math.abs(world.clock.accumulatorSeconds - 1 / 240) < 1e-12);
  } finally {
    world.dispose();
  }
});

for (const phase of ["before", "after", "external"] as const)
  test(
    "controlled physics preserves tick commits when the " + phase + " observer throws",
    async () => {
      const world = await overrunWorld();
      try {
        const debt = world.clock.accumulatorSeconds;
        let externalCalls = 0;
        world.observeFixedSteps({
          beforeStep: () => {
            if (phase === "before") throw new Error("before failed");
          },
          afterStep: () => {
            if (phase === "after") throw new Error("after failed");
          },
        });
        world.resume();
        assert.throws(
          () =>
            world.advanceControlledStep(() => {
              externalCalls++;
              if (phase === "external") throw new Error("external failed");
            }),
          new RegExp(phase + " failed"),
        );
        assert.equal(world.tick, phase === "before" ? 4 : 5);
        assert.equal(world.clock.tick, world.tick);
        assert.equal(world.paused, true);
        assert.equal(externalCalls, phase === "external" ? 1 : 0);
        assert.equal(world.clock.accumulatorSeconds, debt);
        assert.equal(world.clock.totalDroppedWallTimeSeconds, 0);
        assert.equal(world.advanceControlledStep().steps, 0);
      } finally {
        world.dispose();
      }
    },
  );
