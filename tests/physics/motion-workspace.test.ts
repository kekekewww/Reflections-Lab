import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../../src/physics/index.js";
import {
  MotionWorkspace,
  createMotionAction,
  validateMotionRegistry,
} from "../../src/motion/index.js";
import type { SceneObject, SceneSpec } from "../../src/scene/types.js";

const object = (
  id: string,
  positionM: [number, number, number],
  mode: SceneObject["mode"] = "dynamicNoGravity",
): SceneObject => ({
  id,
  shape: "sphere",
  dimensionsM: [0.2, 0.2, 0.2],
  positionM,
  orientationQuaternion: [0, 0, 0, 1],
  mode,
  massKg: 1,
  friction: 0,
  restitution: 0,
  physicsMaterialId: "material.test",
  acousticMaterialId: "material.test",
  acousticRole: "none",
});
function scene(mode: SceneObject["mode"] = "dynamicNoGravity", wall = false): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "scene.motion",
    sceneRevision: 1,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects: [
      object("ball", [0, 2, 0], mode),
      ...(wall
        ? [
            {
              ...object("wall", [0.6, 2, 0], "fixed"),
              shape: "box" as const,
              dimensionsM: [0.04, 2, 2] as [number, number, number],
            },
          ]
        : []),
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
async function setup(mode?: SceneObject["mode"], wall = false) {
  const current = scene(mode, wall),
    world = await PhysicsWorld.create(current);
  const motion = await MotionWorkspace.create(current, world, { getScene: () => current });
  return {
    scene: current,
    world,
    motion,
    dispose: () => {
      motion.dispose();
      world.dispose();
    },
  };
}

test("motion registry is versioned, import/export pinned, and author undo is a new revision", async () => {
  const lab = await setup();
  try {
    await lab.motion.save(
      { actionId: "motion.ball", objectId: "ball", kind: "moveTo", targetPositionM: [1, 2, 0] },
      0,
    );
    const json = lab.motion.exportJson();
    assert.equal(JSON.parse(json).scenePin.sceneHash.length, 71);
    await assert.rejects(
      lab.motion.save(
        { actionId: "motion.other", objectId: "ball", kind: "impulse", impulseNs: [1, 0, 0] },
        0,
      ),
      /changed/,
    );
    assert.equal(lab.motion.getSnapshot().actions.length, 1);
    await lab.motion.undo(1);
    assert.equal(lab.motion.getSnapshot().revision, 2);
    assert.equal(lab.motion.getSnapshot().actions.length, 0);
    await lab.motion.redo(2);
    assert.equal(lab.motion.getSnapshot().revision, 3);
    assert.equal(lab.motion.getSnapshot().actions[0]!.actionId, "motion.ball");
    await lab.motion.importJson(json, 3);
    assert.equal(lab.motion.getSnapshot().revision, 4);
    const bad = JSON.parse(json);
    bad.scenePin.sceneHash = "sha256:" + "0".repeat(64);
    await assert.rejects(lab.motion.importJson(JSON.stringify(bad), 4), /another scene/);
    assert.equal(lab.motion.getSnapshot().revision, 4);
  } finally {
    lab.dispose();
  }
});

test("motion rejects invalid samples, nonfinite authoring and duplicate action IDs", async () => {
  assert.throws(
    () =>
      createMotionAction(
        { actionId: "m", objectId: "ball", kind: "moveTo", targetPositionM: [NaN, 0, 0] },
        1,
        1,
      ),
    /finite/,
  );
  assert.throws(
    () =>
      createMotionAction(
        {
          actionId: "m",
          objectId: "ball",
          kind: "trajectory",
          samples: [
            { timeS: 0, positionM: [0, 0, 0], orientationQuaternion: [0, 0, 0, 1] },
            { timeS: 0.1, positionM: [1, 0, 0], orientationQuaternion: [0, 0, 0, 1] },
          ],
        },
        1,
        1,
      ),
    /maximum speed/,
  );
  const lab = await setup();
  try {
    await lab.motion.save(
      { actionId: "m", objectId: "ball", kind: "impulse", impulseNs: [1, 0, 0] },
      0,
    );
    const input = lab.motion.getSnapshot();
    input.actions.push(input.actions[0]!);
    assert.throws(() => validateMotionRegistry(input), /Duplicate/);
  } finally {
    lab.dispose();
  }
});

test("dynamic Move To reaches a target with real solver poses and no player grab/throw events", async () => {
  const lab = await setup();
  try {
    await lab.motion.save(
      { actionId: "move", objectId: "ball", kind: "moveTo", targetPositionM: [1, 2, 0] },
      0,
    );
    await lab.motion.start("move", "command.move");
    lab.world.resume();
    const events: string[] = [];
    for (let i = 0; i < 600 && lab.motion.getView().activeRunIds.length; i++)
      events.push(...lab.world.step().events.map((event) => event.type));
    const receipt = lab.motion.getView().runs.at(-1)!;
    assert.equal(receipt.status, "reached");
    assert.ok(Math.abs(lab.world.getPose("ball").positionMetres[0] - 1) < 0.03);
    assert.ok(!events.some((type) => ["OnGrab", "OnThrow", "OnRelease"].includes(type)));
  } finally {
    lab.dispose();
  }
});

test("thin wall blocks dynamic controlled movement without a transform jump", async () => {
  const lab = await setup("dynamicNoGravity", true);
  try {
    await lab.motion.save(
      {
        actionId: "blocked",
        objectId: "ball",
        kind: "moveTo",
        targetPositionM: [1.2, 2, 0],
        timeoutS: 4,
      },
      0,
    );
    await lab.motion.start("blocked", "command.blocked");
    lab.world.resume();
    let maxX = -Infinity;
    for (let i = 0; i < 300; i++) {
      lab.world.step();
      maxX = Math.max(maxX, lab.world.getPose("ball").positionMetres[0]);
    }
    assert.ok(maxX < 0.51, `controlled body crossed wall: ${maxX}`);
    assert.ok(["blocked", "timedOut"].includes(lab.motion.getView().runs.at(-1)!.status));
  } finally {
    lab.dispose();
  }
});

test("pause freezes motion cursor and cancellation releases only the motion owner", async () => {
  const lab = await setup();
  try {
    await lab.motion.save(
      { actionId: "move", objectId: "ball", kind: "moveTo", targetPositionM: [2, 2, 0] },
      0,
    );
    const started = await lab.motion.start("move", "command.pause");
    lab.world.resume();
    for (let i = 0; i < 10; i++) lab.world.step();
    lab.world.pause();
    const tick = lab.world.tick;
    for (let i = 0; i < 20; i++) lab.world.step();
    assert.equal(lab.world.tick, tick);
    lab.motion.cancel(started.runId);
    assert.equal(lab.motion.getView().activeRunIds.length, 0);
    assert.equal(lab.motion.getView().runs.at(-1)!.elapsedTicks, 10);
    assert.equal(lab.motion.getView().runs.at(-1)!.status, "cancelled");
    assert.equal(lab.world.getPose("ball").held, false);
  } finally {
    lab.dispose();
  }
});

for (const policy of ["zero", "transfer"] as const) {
  test(`kinematic Move and Release uses explicit ${policy} velocity and keeps collision enabled`, async () => {
    const lab = await setup("kinematic");
    try {
      await lab.motion.save(
        {
          actionId: "release",
          objectId: "ball",
          kind: "moveAndRelease",
          targetPositionM: [1, 2, 0],
          positionToleranceM: 0.001,
          releasePolicy: policy,
          releaseMode: "dynamicGravity",
        },
        0,
      );
      await lab.motion.start("release", `command.${policy}`);
      lab.world.resume();
      for (let i = 0; i < 180 && lab.motion.getView().activeRunIds.length; i++) lab.world.step();
      const receipt = lab.motion.getView().runs.at(-1)!,
        pose = lab.world.getPose("ball");
      assert.equal(receipt.status, "reached");
      assert.equal(pose.mode, "dynamicGravity");
      assert.equal(pose.enabled, true);
      if (policy === "zero") assert.ok(Math.hypot(...pose.linearVelocityMetresPerSecond) < 1e-9);
      else {
        assert.ok(pose.linearVelocityMetresPerSecond[0] > 0.9);
        assert.ok(pose.linearVelocityMetresPerSecond[0] <= 1.001);
      }
      lab.world.step();
      assert.ok(lab.world.getPose("ball").linearVelocityMetresPerSecond[1] < 0);
    } finally {
      lab.dispose();
    }
  });
}

test("impulse command is applied once and fixed objects reject control visibly", async () => {
  const lab = await setup();
  try {
    await lab.motion.save(
      { actionId: "kick", objectId: "ball", kind: "impulse", impulseNs: [1, 0, 0] },
      0,
    );
    await lab.motion.start("kick", "command.once");
    lab.world.resume();
    lab.world.step();
    const velocity = lab.world.getPose("ball").linearVelocityMetresPerSecond[0];
    const again = await lab.motion.start("kick", "command.once");
    lab.world.step();
    assert.equal(again.status, "applied");
    assert.ok(
      Math.abs(lab.world.getPose("ball").linearVelocityMetresPerSecond[0] - velocity) < 1e-9,
    );
    assert.equal(lab.motion.getView().runs.length, 1);
  } finally {
    lab.dispose();
  }
  const fixed = await setup("fixed");
  try {
    await fixed.motion.save(
      { actionId: "kick", objectId: "ball", kind: "impulse", impulseNs: [1, 0, 0] },
      0,
    );
    await assert.rejects(fixed.motion.start("kick", "command.fixed"), /active, unheld/);
  } finally {
    fixed.dispose();
  }
});

test("external sidecar transaction excludes concurrent authoring and retains registry on failed scene commit", async () => {
  const lab = await setup();
  try {
    const before = lab.motion.getSnapshot(),
      candidate = { ...before, revision: 1 };
    let release!: () => void;
    const pending = lab.motion.withExternalTransaction(candidate, before, lab.scene, async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      throw new Error("scene commit failed");
    });
    while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
    await assert.rejects(
      lab.motion.save(
        { actionId: "race", objectId: "ball", kind: "impulse", impulseNs: [1, 0, 0] },
        0,
      ),
      /pending/,
    );
    release();
    await assert.rejects(pending, /scene commit failed/);
    assert.deepEqual(lab.motion.getSnapshot(), before);
  } finally {
    lab.dispose();
  }
});

test("linearSlerp trajectory uses fixed ticks, real clearance and a pinned start pose", async () => {
  const lab = await setup("kinematic");
  try {
    await lab.motion.save(
      {
        actionId: "path",
        objectId: "ball",
        kind: "trajectory",
        timeoutS: 2,
        samples: [
          { timeS: 0, positionM: [0, 2, 0], orientationQuaternion: [0, 0, 0, 1] },
          { timeS: 1, positionM: [1, 2, 0], orientationQuaternion: [0, 0, 0, 1] },
        ],
      },
      0,
    );
    await lab.motion.start("path", "command.path");
    lab.world.resume();
    for (let i = 0; i < 90; i++) lab.world.step();
    assert.equal(lab.motion.getView().runs.at(-1)!.status, "reached");
    assert.ok(Math.abs(lab.world.getPose("ball").positionMetres[0] - 1) < 1e-5);
    await assert.rejects(lab.motion.start("path", "command.path-again"), /first sample/);
  } finally {
    lab.dispose();
  }
});

test("world reset retains the Motion step subscription and requires generation rebase", async () => {
  const lab = await setup();
  try {
    await lab.motion.save(
      { actionId: "move", objectId: "ball", kind: "moveTo", targetPositionM: [1, 2, 0] },
      0,
    );
    lab.world.reset();
    await lab.motion.rebase(1);
    await lab.motion.start("move", "command.after-reset");
    lab.world.resume();
    for (let i = 0; i < 600 && lab.motion.getView().activeRunIds.length; i++) lab.world.step();
    assert.equal(lab.motion.getView().runs.at(-1)!.status, "reached");
    assert.ok(Math.abs(lab.world.getPose("ball").positionMetres[0] - 1) < 0.03);
  } finally {
    lab.dispose();
  }
});

test("authoring rejects sparse vectors and quaternions without changing the registry", async () => {
  const lab = await setup();
  try {
    const vector = new Array(3) as [number, number, number];
    vector[0] = 1;
    vector[2] = 0;
    await assert.rejects(
      lab.motion.save(
        { actionId: "sparse", objectId: "ball", kind: "moveTo", targetPositionM: vector },
        0,
      ),
      /dense, finite/,
    );
    const quaternion = new Array(4) as [number, number, number, number];
    quaternion[3] = 1;
    await assert.rejects(
      lab.motion.save(
        {
          actionId: "sparse",
          objectId: "ball",
          kind: "moveTo",
          targetPositionM: [1, 2, 0],
          targetOrientationQuaternion: quaternion,
        },
        0,
      ),
      /dense, finite/,
    );
    assert.equal(lab.motion.getSnapshot().revision, 0);
    assert.equal(lab.motion.getSnapshot().actions.length, 0);
  } finally {
    lab.dispose();
  }
});
