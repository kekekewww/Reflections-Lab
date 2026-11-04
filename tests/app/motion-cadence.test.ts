import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PhysicsWorld } from "../../src/physics/index.js";
import { MotionWorkspace, type MotionRunReceipt } from "../../src/motion/index.js";
import type { PhysicsSnapshot } from "../../src/physics/types.js";
import type { SceneObject, SceneSpec } from "../../src/scene/types.js";

const body = (id: string, y: number, mode: SceneObject["mode"]): SceneObject => ({
  id,
  shape: "sphere",
  dimensionsM: [0.2, 0.2, 0.2],
  positionM: [0, y, 0],
  orientationQuaternion: [0, 0, 0, 1],
  mode,
  massKg: 1,
  friction: 0,
  restitution: 0,
  physicsMaterialId: "material.test",
  acousticMaterialId: "material.test",
  acousticRole: "none",
});
function scene(): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "scene.motion-cadence",
    sceneRevision: 1,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 73,
    gravityMps2: [0, -9.81, 0],
    objects: [
      body("move", 2, "dynamicNoGravity"),
      body("release", 4, "kinematic"),
      body("impulse", 6, "dynamicNoGravity"),
    ],
    sources: [],
    listener: {
      id: "listener",
      positionM: [0, 1, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}

function normalizedReceipt(receipt: MotionRunReceipt) {
  const { runId: _runId, ...domain } = receipt;
  return structuredClone(domain);
}
function normalizedSnapshot(snapshot: PhysicsSnapshot) {
  return structuredClone({
    tick: snapshot.tick,
    simulationTimeSeconds: snapshot.simulationTimeSeconds,
    fixedDtSeconds: snapshot.fixedDtSeconds,
    sceneRevision: snapshot.sceneRevision,
    epoch: snapshot.epoch,
    paused: snapshot.paused,
    poses: snapshot.poses,
    events: snapshot.events,
    heldObjectId: snapshot.heldObjectId,
    grabDiagnostics: snapshot.grabDiagnostics,
    player: snapshot.player,
  });
}
async function run(renderHz: 30 | 60 | 144) {
  const document = scene();
  const world = await PhysicsWorld.create(document);
  const motion = await MotionWorkspace.create(document, world, { getScene: () => document });
  try {
    await motion.save(
      {
        actionId: "motion.move",
        objectId: "move",
        kind: "moveTo",
        targetPositionM: [1, 2, 0],
        timeoutS: 3,
      },
      0,
    );
    await motion.save(
      {
        actionId: "motion.release",
        objectId: "release",
        kind: "moveAndRelease",
        targetPositionM: [1, 4, 0],
        positionToleranceM: 0.001,
        releasePolicy: "transfer",
        releaseMode: "dynamicNoGravity",
        timeoutS: 3,
      },
      1,
    );
    await motion.save(
      { actionId: "motion.impulse", objectId: "impulse", kind: "impulse", impulseNs: [0.25, 0, 0] },
      2,
    );
    await motion.start("motion.move", "command.cadence.move");
    await motion.start("motion.release", "command.cadence.release");
    await motion.start("motion.impulse", "command.cadence.impulse");
    // Establish the same published read model before any outer render frame.
    motion.getView();
    world.resume();
    const timeline: {
      physics: ReturnType<typeof normalizedSnapshot>;
      motion: ReturnType<typeof normalizedReceipt>[];
    }[] = [];
    let droppedWallTimeSeconds = 0;
    let overruns = 0;
    for (let frame = 0; frame < renderHz * 4; frame++) {
      const result = world.advance(1 / renderHz, (snapshot) => {
        timeline.push({
          physics: normalizedSnapshot(snapshot),
          motion: motion.getView().runs.map(normalizedReceipt),
        });
      });
      droppedWallTimeSeconds += result.droppedWallTimeSeconds;
      if (result.overrun) overruns++;
      // Real render interpolation/getters occur at each outer cadence, outside the fixed-step observers.
      const beforeRender = normalizedSnapshot(world.snapshot());
      const beforeMotion = motion.getView();
      world.interpolatedPoses(result.alpha);
      motion.getView();
      assert.deepEqual(
        normalizedSnapshot(world.snapshot()),
        beforeRender,
        "render interpolation must not advance Rapier or emit motion events",
      );
      assert.strictEqual(
        motion.getView(),
        beforeMotion,
        "render reads must not advance or republish the motion cursor",
      );
    }
    const terminal = motion.getView().runs.map(normalizedReceipt);
    assert.equal(world.tick, 240);
    assert.equal(timeline.length, 240);
    assert.deepEqual(
      timeline.map((item) => item.physics.tick),
      Array.from({ length: 240 }, (_, index) => index + 1),
    );
    assert.equal(droppedWallTimeSeconds, 0);
    assert.equal(overruns, 0);
    assert.equal(motion.getView().activeRunIds.length, 0);
    assert.deepEqual(
      terminal.map((receipt) => [receipt.actionId, receipt.status]),
      [
        ["motion.move", "reached"],
        ["motion.release", "reached"],
        ["motion.impulse", "applied"],
      ],
    );
    for (const receipt of terminal) {
      assert.equal(receipt.elapsedTicks, receipt.endTick! - receipt.startTick);
      assert.ok(receipt.after);
    }
    const poses = world.snapshot().poses;
    assert.ok(
      Math.abs(poses.find((pose) => pose.objectId === "move")!.positionMetres[0] - 1) < 0.03,
      "dynamic move must actually reach its authored target",
    );
    const released = terminal.find((receipt) => receipt.actionId === "motion.release")!;
    assert.equal(released.after!.mode, "dynamicNoGravity");
    assert.ok(
      released.after!.linearVelocityMetresPerSecond[0] > 0.9,
      "release must actually transfer accepted trajectory velocity",
    );
    assert.equal(
      terminal.find((receipt) => receipt.actionId === "motion.impulse")!.elapsedTicks,
      1,
      "impulse must execute exactly once at a real fixed tick",
    );
    return {
      timeline,
      terminal,
      final: normalizedSnapshot(world.snapshot()),
      droppedWallTimeSeconds,
      overruns,
    };
  } finally {
    motion.dispose();
    world.dispose();
  }
}

test("MotionWorkspace authored move, release and impulse have identical complete fixed-tick traces at 30/60/144 Hz render cadence", async (t) => {
  const reference = await run(60);
  const hash = createHash("sha256").update(JSON.stringify(reference)).digest("hex");
  t.diagnostic("60 Hz reference:240 actual fixed ticks; full trace SHA-256 " + hash);
  for (const renderHz of [30, 144] as const) {
    const candidate = await run(renderHz);
    assert.deepEqual(
      candidate,
      reference,
      renderHz +
        " Hz must preserve every fixed-tick pose/event/Motion read model and terminal receipt exactly",
    );
    t.diagnostic(
      renderHz +
        " Hz:240 actual fixed ticks; exact full-trace and terminal equality with60 Hz; no overrun/discard",
    );
  }
});
