import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../../src/physics/index.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import type { Vec3 } from "../../src/scene/types.js";

// The hold point sits 2 m in front of a turning view, as the interaction host requests it.
const pivot: Vec3 = [0, 1.6, 1.5],
  radiusM = 2;
const holdPoint = (yaw: number): Vec3 => [
  pivot[0] - Math.sin(yaw) * radiusM,
  pivot[1],
  pivot[2] - Math.cos(yaw) * radiusM,
];

async function turnWhileHolding(rateRadPerS: number) {
  const scene = createDefaultScene();
  const ball = scene.objects.find((object) => object.id === "ball")!;
  ball.positionM = holdPoint(0);
  const world = await PhysicsWorld.create(scene);
  try {
    world.resume();
    world.grab("ball", holdPoint(0), `grab-turn-${rateRadPerS}`);
    for (let i = 0; i < 30; i++) world.step();
    const turnTicks = Math.round((Math.PI / rateRadPerS) * 60);
    let yaw = 0,
      peakLagM = 0,
      settledLagM = Infinity,
      released = false;
    for (let i = 0; i < turnTicks + 60; i++) {
      if (i < turnTicks) yaw += rateRadPerS / 60;
      world.updateGrabTarget(holdPoint(yaw));
      const snapshot = world.step();
      if (snapshot.heldObjectId !== "ball") {
        released = true;
        break;
      }
      const p = snapshot.poses.find((pose) => pose.objectId === "ball")!.positionMetres;
      const t = holdPoint(yaw);
      const lag = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
      peakLagM = Math.max(peakLagM, lag);
      settledLagM = lag;
    }
    return { released, peakLagM, settledLagM };
  } finally {
    world.dispose();
  }
}

test("a held ball stays in hand through brisk to very fast 180-degree view turns", async () => {
  // Before the 2026-11-03 retune a 172 deg/s turn dropped the ball (tracking-distance-limit).
  for (const [rate, peakLimitM] of [
    [3, 0.3],
    [6, 0.8],
    [10, 2],
  ] as const) {
    const result = await turnWhileHolding(rate);
    assert.equal(result.released, false, `${rate} rad/s turn released the grip`);
    assert.ok(
      result.peakLagM < peakLimitM,
      `${rate} rad/s peak lag ${result.peakLagM.toFixed(2)} m`,
    );
    assert.ok(
      result.settledLagM < 0.15,
      `${rate} rad/s did not settle: ${result.settledLagM.toFixed(2)} m`,
    );
  }
});

test("sustained lag beyond the hold limit still drops the object instead of stretching", async () => {
  const scene = createDefaultScene();
  const ball = scene.objects.find((object) => object.id === "ball")!;
  ball.positionM = [-0.8, 1, -3.6];
  ball.mode = "dynamicNoGravity";
  const world = await PhysicsWorld.create(scene);
  try {
    world.resume();
    world.grab("ball", ball.positionM, "grab-behind-wall");
    // Keep asking for a point 2 m behind the back wall, as a player walking away would.
    let releasedAtTick = -1;
    for (let i = 0; i < 120 && releasedAtTick < 0; i++) {
      world.updateGrabTarget([-0.8, 1, -6]);
      const snapshot = world.step();
      if (snapshot.heldObjectId === null) {
        releasedAtTick = i;
        assert.ok(
          snapshot.events.some(
            (event) =>
              event.type === "ContactInvalidated" && event.reason === "tracking-distance-limit",
          ),
        );
      }
    }
    assert.ok(releasedAtTick >= 0, "a grip pinned behind a wall must eventually drop");
    assert.ok(releasedAtTick <= 60, `released only at tick ${releasedAtTick}`);
    assert.ok(
      world.getPose("ball").positionMetres[2] > -3.76,
      "the ball stays in front of the wall",
    );
  } finally {
    world.dispose();
  }
});
