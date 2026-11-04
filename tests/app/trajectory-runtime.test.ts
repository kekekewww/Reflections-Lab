import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import type { PhysicsWorld } from "../../src/physics/index.js";
import { poseAt, timePath } from "../../src/motion/trajectory-path.js";
import type { ObjectTrajectory, SceneObject, Vector3 } from "../../src/scene/types.js";
import type { LabAction } from "../../src/ui/contracts.js";
import { formatMessage } from "../../src/ui/locale-model.js";

const STEP = 1 / 60;
const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];
const BALL_START: Vector3 = [-0.8, 2, 0];
/** A short arc in free air above the floor: about 1 m at 2 m/s. */
const ARC: ObjectTrajectory = {
  offsetsM: [
    [0.4, 0.3, 0],
    [0.8, 0, 0],
  ],
  strengthMps: 2,
  startDelayS: 0,
  faceAlongPath: false,
};

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
async function fixture(run: (app: LabRuntime) => Promise<void>) {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    await run(app);
  } finally {
    app.dispose();
  }
}
async function command(app: LabRuntime, action: LabAction) {
  await app.dispatch(action);
  assert.equal(app.getSnapshot().error, "", `command ${action.type} must succeed`);
}
async function refused(app: LabRuntime, action: LabAction, code: string) {
  await app.dispatch(action);
  const error = app.getSnapshot().error ?? "";
  assert.ok(error.startsWith(code), `${action.type} must be refused with ${code}, got "${error}"`);
  await app.dispatch({ type: "clearError" });
}
async function steps(app: LabRuntime, count: number) {
  for (let index = 0; index < count; index++) {
    app.advance(STEP);
    await app.flushRecordingEvaluation();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
const world = (app: LabRuntime) => (app as unknown as { world: PhysicsWorld }).world;
const ballAt = (app: LabRuntime): Vector3 => world(app).getPose("ball").positionMetres;
const sceneObject = (app: LabRuntime, id: string): SceneObject =>
  app.getSceneDocument().objects.find((object) => object.id === id)!;
function near(
  actual: readonly number[],
  expected: readonly number[],
  tolerance: number,
  what: string,
) {
  const distance = Math.hypot(...actual.map((value, index) => value - expected[index]!));
  assert.ok(distance <= tolerance, `${what}: [${actual}] is ${distance} m from [${expected}]`);
}
function onlyRun(app: LabRuntime) {
  const runs = app.getSnapshot().pathRuns;
  assert.equal(runs.length, 1, "exactly one path runs");
  return runs[0]!;
}

test("setTrajectory refuses a non-audible object and saves an undoable path on the ball", async () => {
  await fixture(async (app) => {
    const revision = app.getSnapshot().sceneRevision;
    await refused(
      app,
      { type: "setTrajectory", objectId: "floor", trajectory: ARC },
      "TRAJECTORY_NOT_AUDIBLE",
    );
    assert.equal(app.getSnapshot().sceneRevision, revision, "a refusal changes nothing");
    assert.equal(sceneObject(app, "floor").trajectory, undefined);

    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    assert.equal(app.getSnapshot().sceneRevision, revision + 1);
    assert.deepEqual(sceneObject(app, "ball").trajectory, ARC);
    assert.equal(app.getSnapshot().canUndo, true);

    await command(app, { type: "undo" });
    assert.equal(sceneObject(app, "ball").trajectory, undefined, "undo removes the new path");
    assert.equal(app.getSnapshot().trajectoryStatus.ball, undefined);
  });
});

test("patchObject refuses a trajectory key, so setTrajectory is the only path write", async () => {
  await fixture(async (app) => {
    const revision = app.getSnapshot().sceneRevision;
    for (const objectId of ["floor", "ball"]) {
      await refused(
        app,
        { type: "patchObject", objectId, patch: { trajectory: ARC } },
        "TRAJECTORY_USE_SET_TRAJECTORY",
      );
      assert.equal(sceneObject(app, objectId).trajectory, undefined);
    }
    await refused(
      app,
      { type: "patchObject", objectId: "ball", patch: { massKg: 2, trajectory: null } },
      "TRAJECTORY_USE_SET_TRAJECTORY",
    );
    assert.equal(sceneObject(app, "ball").massKg, 1, "the whole patch is refused");
    assert.equal(app.getSnapshot().sceneRevision, revision);
  });
});

test("Play at ready runs the path; Pause then Play continues it from the same elapsed time", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    const path = timePath(BALL_START, ARC);
    assert.equal(app.getSnapshot().simulationState, "ready");
    const status = app.getSnapshot().trajectoryStatus;
    assert.deepEqual(status.ball, {
      lengthM: path.lengthM,
      durationS: path.durationS,
      valid: true,
    });
    await command(app, { type: "run" });
    assert.equal(onlyRun(app).objectId, "ball");
    assert.equal(onlyRun(app).elapsedS, 0);

    await steps(app, 12);
    await command(app, { type: "pause" });
    const paused = onlyRun(app);
    assert.equal(paused.status, "moving");
    assert.ok(Math.abs(paused.elapsedS - world(app).tick * STEP) < 1e-12, "elapsed follows ticks");
    near(ballAt(app), poseAt(path, IDENTITY, paused.elapsedS).positionM, 1e-4, "ball on its path");

    await command(app, { type: "run" });
    assert.equal(onlyRun(app).elapsedS, paused.elapsedS, "resume does not restart the path");
    await steps(app, 1);
    const resumed = onlyRun(app);
    assert.ok(resumed.elapsedS > paused.elapsedS);
    near(ballAt(app), poseAt(path, IDENTITY, resumed.elapsedS).positionM, 1e-4, "path continues");

    await steps(app, 60 - world(app).tick);
    assert.ok(path.durationS < 1, "the arc lasts under a second");
    assert.equal(onlyRun(app).status, "finished", "after 1 s the path has ended");
    assert.equal(app.getSnapshot().trajectoryStatus, status, "status is cached per scene revision");
  });
});

test("Record from a paused take snaps objects back and keeps the first-person player", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "enterFPS" });
    await command(app, { type: "pointerLockChanged", locked: true });
    await command(app, { type: "run" });
    await app.dispatch({ type: "inputLook", movementX: 40, movementY: -20 });
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: true });
    await steps(app, 12);
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: false });
    await steps(app, 8);
    await command(app, { type: "pause" });
    assert.ok(world(app).tick > 0);
    const camera = app.getFPSCamera()!;
    assert.ok(Math.abs(camera.positionM[2] - 4) > 0.1, "the player walked away from the spawn");
    assert.ok(Math.hypot(...ballAt(app).map((v, i) => v - BALL_START[i]!)) > 0.2, "ball moved");

    await command(app, { type: "recordToggle" });
    const snapshot = app.getSnapshot();
    assert.equal(snapshot.recording.state, "recording");
    assert.equal(world(app).tick, 0, "the fresh take starts at tick 0");
    near(ballAt(app), BALL_START, 1e-6, "ball snapped back to its starting position");
    assert.equal(onlyRun(app).elapsedS, 0, "the path restarts from elapsed 0");
    const kept = app.getFPSCamera()!;
    near(kept.positionM, camera.positionM, 1e-3, "player eye kept within 1 mm");
    assert.deepEqual(
      kept.orientationQuaternion,
      camera.orientationQuaternion,
      "yaw and pitch kept",
    );

    await steps(app, 6);
    near(
      ballAt(app),
      poseAt(timePath(BALL_START, ARC), IDENTITY, onlyRun(app).elapsedS).positionM,
      1e-4,
      "the new take follows the path from its start",
    );
    // The re-created capsule settles onto the floor again (about a millimetre), nothing more.
    near(app.getFPSCamera()!.positionM, camera.positionM, 5e-3, "player stays put while recording");
    await command(app, { type: "recordToggle" });
    assert.equal(app.getSnapshot().recording.state, "finalized");
  });
});

test("Record twice from the same layout repeats the take and keeps the first recording", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    const take = async () => {
      await command(app, { type: "recordToggle" });
      await steps(app, 45);
      await command(app, { type: "recordToggle" });
      await command(app, { type: "pause" });
      return app.getRecordingArtifact()!;
    };
    const first = await take();
    assert.ok(world(app).tick > 0);
    const second = await take();
    assert.notEqual(first.runId, second.runId);
    assert.ok(first.frameCount > 40);
    const ballTrace = (artifact: typeof first) =>
      artifact.frames.map((frame) => [
        frame.tick,
        frame.poses.find((pose) => pose.objectId === "ball")!.positionM,
      ]);
    assert.deepEqual(ballTrace(second), ballTrace(first), "the take repeats exactly");
    const recordings = (
      JSON.parse(app.exportProject()) as { recordings: { runId: string }[] }
    ).recordings.map((reference) => reference.runId);
    assert.ok(recordings.includes(first.runId), "the earlier recording is kept");
    assert.ok(recordings.includes(second.runId));
  });
});

test("Record while holding an object in first person still starts after the snap-back", async () => {
  await fixture(async (app) => {
    await command(app, {
      type: "patchObject",
      objectId: "ball",
      patch: { positionM: [0, 1.6, 2.5] },
    });
    await command(app, {
      type: "patchObject",
      objectId: "ball",
      patch: { mode: "dynamicNoGravity" },
    });
    // A short slow path away from the player; it has handed over to physics before the grab.
    const away: ObjectTrajectory = { ...ARC, offsetsM: [[0, 0, -0.3]], strengthMps: 0.5 };
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: away });
    await command(app, { type: "enterFPS" });
    await command(app, { type: "setAlternativeInput", enabled: true });
    await command(app, { type: "run" });
    await steps(app, 40);
    assert.equal(onlyRun(app).status, "finished");
    await command(app, { type: "grab" });
    await steps(app, 2);
    assert.equal(world(app).heldObjectId, "ball");
    await command(app, { type: "pause" });

    await command(app, { type: "recordToggle" });
    assert.equal(app.getSnapshot().recording.state, "recording", "recording starts");
    assert.equal(world(app).heldObjectId, null, "the snap-back released the grip");
    near(ballAt(app), [0, 1.6, 2.5], 1e-6, "ball at its starting position");
    assert.equal(onlyRun(app).elapsedS, 0);
  });
});

test("Record refuses to start when a snapped-back object would stand in the player", async () => {
  await fixture(async (app) => {
    // The ball starts in front of the player and travels away; the player then walks onto its start.
    await command(app, { type: "patchObject", objectId: "ball", patch: { positionM: [0, 1, 3] } });
    const away: ObjectTrajectory = { ...ARC, offsetsM: [[0, 0, -2]], strengthMps: 3 };
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: away });
    await command(app, { type: "enterFPS" });
    await command(app, { type: "setAlternativeInput", enabled: true });
    await command(app, { type: "run" });
    await steps(app, 15);
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: true });
    await steps(app, 30);
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: false });
    await command(app, { type: "pause" });
    assert.ok(Math.abs(app.getFPSCamera()!.positionM[2] - 3) < 0.3, "player stands on the start");

    await refused(app, { type: "recordToggle" }, "PLAYER_RESPAWN_BLOCKED");
    assert.notEqual(app.getSnapshot().recording.state, "recording", "no recording starts");
    assert.equal(app.getSnapshot().simulationState, "ready", "the room is still reset");
    near(ballAt(app), [0, 1, 3], 1e-6, "ball at its starting position");
    assert.equal(world(app).getPlayerPose(), null);
  });
});

test("a user Pause during the Record snap-back cancels the start", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "run" });
    await steps(app, 10);
    await command(app, { type: "pause" });
    // Land the Pause inside the snap-back's own awaits, after the dispatch preamble's guard.
    const recorder = (
      app as unknown as { recorder: { interrupt(reason: string): Promise<unknown> } }
    ).recorder;
    let paused: Promise<void> | null = null;
    recorder.interrupt = (reason) => {
      delete (recorder as Partial<typeof recorder>).interrupt;
      paused = app.dispatch({ type: "pause" });
      return recorder.interrupt(reason);
    };
    await command(app, { type: "recordToggle" });
    assert.ok(paused, "the Pause landed during the snap-back");
    await paused;
    assert.notEqual(app.getSnapshot().recording.state, "recording", "no recording starts");
    assert.equal(world(app).paused, true, "the world stays paused");
    assert.equal(app.getSnapshot().simulationState, "ready", "the room is back at its start");
    assert.deepEqual(app.getSnapshot().pathRuns, [], "no take starts");
    await steps(app, 3);
    assert.equal(world(app).tick, 0, "time does not run");
  });
});

test("a Pause dispatched right after Record cancels the start", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "run" });
    await steps(app, 10);
    await command(app, { type: "pause" });
    const recording = app.dispatch({ type: "recordToggle" });
    await app.dispatch({ type: "pause" });
    await recording;
    assert.equal(app.getSnapshot().error, "");
    assert.notEqual(app.getSnapshot().recording.state, "recording", "no recording starts");
    assert.equal(world(app).paused, true, "the world stays paused");
  });
});

test("a refused first-person resume does not start the take", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    // Neither pointer lock nor the alternative input: the host refuses to resume.
    await command(app, { type: "enterFPS" });
    await app.dispatch({ type: "run" });
    assert.equal(app.getSnapshot().simulationState, "ready");
    assert.deepEqual(app.getSnapshot().pathRuns, [], "Play leaves no half-started take");
    assert.equal(world(app).getPose("ball").mode, "dynamicGravity");
    await app.dispatch({ type: "recordToggle" });
    assert.notEqual(app.getSnapshot().recording.state, "recording");
    assert.deepEqual(app.getSnapshot().pathRuns, [], "Record leaves no half-started take");
    assert.equal(world(app).getPose("ball").mode, "dynamicGravity");
  });
});

test("Record in a room without runnable paths keeps continuing the live world", async () => {
  await fixture(async (app) => {
    await command(app, { type: "run" });
    await steps(app, 5);
    await command(app, { type: "pause" });
    const tick = world(app).tick;
    await command(app, { type: "recordToggle" });
    assert.equal(world(app).tick, tick, "no snap-back without a path");
    await steps(app, 2);
    await command(app, { type: "recordToggle" });
    assert.equal(app.getRecordingArtifact()!.startTick, tick + 1);
  });
});

const TAKE_RESTARTED_NOTICE = "場景已變更；物件回到起始位置，重新開始這段 take。";

test("Play after a scene edit mid-take restarts the take from the starting layout and says so", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "run" });
    await steps(app, 12);
    await command(app, { type: "pause" });
    assert.ok(world(app).tick > 0);
    const faster: ObjectTrajectory = { ...ARC, strengthMps: 3 };
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: faster });

    await command(app, { type: "run" });
    const snapshot = app.getSnapshot();
    assert.equal(snapshot.simulationState, "running");
    assert.equal(world(app).tick, 0, "the take starts again at tick 0");
    assert.equal(onlyRun(app).elapsedS, 0, "the path starts from its beginning");
    near(ballAt(app), BALL_START, 1e-6, "the ball is back at its start");
    assert.equal(snapshot.notice, TAKE_RESTARTED_NOTICE);
    assert.doesNotMatch(formatMessage("en", snapshot.notice), /\p{Script=Han}/u);
    await steps(app, 6);
    near(
      ballAt(app),
      poseAt(timePath(BALL_START, faster), IDENTITY, onlyRun(app).elapsedS).positionM,
      1e-4,
      "the new take follows the edited path",
    );

    // Without a further edit, Pause then Play resumes as before.
    await command(app, { type: "pause" });
    const paused = onlyRun(app).elapsedS;
    await command(app, { type: "run" });
    assert.equal(onlyRun(app).elapsedS, paused, "an unedited take resumes");
  });
});

test("a user Pause during the Play restart cancels the start", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "run" });
    await steps(app, 10);
    await command(app, { type: "pause" });
    await command(app, {
      type: "setTrajectory",
      objectId: "ball",
      trajectory: { ...ARC, strengthMps: 3 },
    });
    // Land the Pause inside the restart's own awaits, after the dispatch preamble's guard.
    const recorder = (
      app as unknown as { recorder: { interrupt(reason: string): Promise<unknown> } }
    ).recorder;
    let paused: Promise<void> | null = null;
    recorder.interrupt = (reason) => {
      delete (recorder as Partial<typeof recorder>).interrupt;
      paused = app.dispatch({ type: "pause" });
      return recorder.interrupt(reason);
    };
    await command(app, { type: "run" });
    assert.ok(paused, "the Pause landed during the restart");
    await paused;
    assert.equal(world(app).paused, true, "the world stays paused");
    assert.equal(app.getSnapshot().simulationState, "ready", "the room is back at its start");
    assert.deepEqual(app.getSnapshot().pathRuns, [], "no take starts");
    await steps(app, 3);
    assert.equal(world(app).tick, 0, "time does not run");
  });
});

test("the first take after adding an object repeats exactly, through contacts", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    // A new dynamic box at ready: the edited world appends its body, a reset world sorts by id.
    await command(app, { type: "addObject", shape: "box" });
    // It drops onto the speaker, whose body an id-sorted world creates after the box's
    // ("object.*" < "speaker") but the edited world created before it.
    const box = app.getSnapshot().selectedObjectId!;
    assert.ok(box < "speaker");
    await command(app, {
      type: "patchObject",
      objectId: box,
      patch: { positionM: [1.5, 2.2, -2] },
    });
    const take = async () => {
      await command(app, { type: "recordToggle" });
      // Long enough for the box to land on the speaker and the ball to hit the floor.
      await steps(app, 120);
      await command(app, { type: "recordToggle" });
      await command(app, { type: "pause" });
      const artifact = app.getRecordingArtifact()!;
      assert.ok(artifact.frameCount >= 90, `${artifact.frameCount} frames`);
      return artifact.frames.map((frame) => [
        frame.tick,
        frame.poses.map((pose) => [pose.objectId, pose.positionM]),
      ]);
    };
    const first = await take();
    const second = await take();
    assert.deepEqual(second, first, "the second take repeats the first");
    await command(app, { type: "reset" });
    assert.deepEqual(await take(), first, "a take after an explicit Reset repeats it too");
  });
});

test("without a runnable path, scene edits change nothing about Play or Record", async () => {
  await fixture(async (app) => {
    const internals = app as unknown as {
      resetCore(options: { keepPlayer: boolean }): Promise<void>;
    };
    const resetCore = internals.resetCore.bind(app);
    let resets = 0;
    internals.resetCore = (options) => {
      resets++;
      return resetCore(options);
    };
    // A path that cannot run (into the back wall) does not count.
    const intoWall: ObjectTrajectory = { ...ARC, offsetsM: [[0, 0, -5]] };
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: intoWall });
    await command(app, { type: "run" });
    await steps(app, 5);
    await command(app, { type: "pause" });
    await command(app, { type: "patchObject", objectId: "speaker", patch: { massKg: 90 } });
    const tick = world(app).tick;
    assert.ok(tick > 0);
    await command(app, { type: "run" });
    assert.equal(world(app).tick, tick, "Play resumes the live world");
    await steps(app, 2);
    await command(app, { type: "pause" });
    await command(app, { type: "patchObject", objectId: "speaker", patch: { massKg: 80 } });
    await command(app, { type: "recordToggle" });
    assert.equal(world(app).tick, tick + 2, "Record continues the live world");
    await steps(app, 2);
    await command(app, { type: "recordToggle" });
    assert.equal(app.getRecordingArtifact()!.startTick, tick + 3);
    assert.equal(resets, 0, "no snap-back without a runnable path");
    assert.notEqual(app.getSnapshot().notice, TAKE_RESTARTED_NOTICE);
  });
});

test("a scene edit during a take ends it and returns the object to its scene mode", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "run" });
    await steps(app, 10);
    await command(app, { type: "pause" });
    assert.equal(world(app).getPose("ball").mode, "kinematic", "a running path drives the ball");
    await command(app, { type: "patchObject", objectId: "ball", patch: { massKg: 2 } });
    assert.deepEqual(app.getSnapshot().pathRuns, []);
    assert.equal(world(app).getPose("ball").mode, "dynamicGravity");
  });
});

test("Reset clears the take and puts objects at their scene positions", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "run" });
    await steps(app, 20);
    assert.equal(app.getSnapshot().pathRuns.length, 1);
    await command(app, { type: "reset" });
    assert.deepEqual(app.getSnapshot().pathRuns, []);
    assert.equal(app.getSnapshot().simulationState, "ready");
    near(ballAt(app), BALL_START, 1e-6, "ball back at its scene position");
    assert.equal(world(app).getPose("ball").mode, "dynamicGravity");

    await command(app, { type: "run" });
    assert.equal(onlyRun(app).elapsedS, 0, "the next Play starts a fresh take");
  });
});

test("motionStart is refused for an object whose path is running", async () => {
  await fixture(async (app) => {
    await command(app, {
      type: "setTrajectory",
      objectId: "ball",
      trajectory: { ...ARC, startDelayS: 0.5 },
    });
    const revision = () => app.getMotionWorkspace().getSnapshot().revision;
    await command(app, { type: "motionRebase", expectedRevision: revision() });
    await command(app, {
      type: "motionSave",
      expectedRevision: revision(),
      input: { actionId: "motion.kick", objectId: "ball", kind: "impulse", impulseNs: [0, 1, 0] },
    });
    await command(app, { type: "run" });
    await steps(app, 2);
    assert.equal(onlyRun(app).status, "delayed");
    await refused(app, { type: "motionStart", actionId: "motion.kick" }, "MOTION_PATH_ACTIVE");
    assert.equal(onlyRun(app).status, "delayed", "the path keeps its run");
  });
});

test("a path into the back wall is published as blocked and is not run by Play", async () => {
  await fixture(async (app) => {
    const intoWall: ObjectTrajectory = { ...ARC, offsetsM: [[0, 0, -5]], strengthMps: 3 };
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: intoWall });
    const status = app.getSnapshot().trajectoryStatus.ball!;
    assert.equal(status.valid, false);
    assert.equal(status.problem, "BLOCKED");
    assert.ok(Math.abs(status.lengthM - 5) < 1e-9);
    assert.ok(Math.abs(status.durationS - 5 / 3) < 1e-9);

    await command(app, { type: "run" });
    assert.deepEqual(app.getSnapshot().pathRuns, [], "a blocked path does not run");
    await steps(app, 10);
    assert.ok(ballAt(app)[1] < BALL_START[1], "the ball falls under normal physics");
    assert.ok(Math.abs(ballAt(app)[2]) < 1e-6, "and does not travel toward the wall");
  });
});

test("a path longer than 30 s of travel is published as too long", async () => {
  await fixture(async (app) => {
    const zigzag: Vector3[] = Array.from({ length: 11 }, (_, i) => [i % 2 ? 1.6 : 0, 0, 0.2 * i]);
    zigzag.shift();
    const tooLong: ObjectTrajectory = { ...ARC, offsetsM: zigzag, strengthMps: 0.5 };
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: tooLong });
    const status = app.getSnapshot().trajectoryStatus.ball!;
    assert.ok(status.durationS > 30);
    assert.deepEqual(
      { valid: status.valid, problem: status.problem },
      { valid: false, problem: "TOO_LONG" },
    );
    const clear = app.getSnapshot();
    assert.equal(
      clear.trajectoryStatus.speaker,
      undefined,
      "objects without a path have no status",
    );
  });
});

test("a loaded project measures its paths and runs them on the new world", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    const text = app.exportProject();
    const before = world(app);
    await command(app, { type: "importProject", text });
    assert.notEqual(world(app), before, "the project load swapped the world");
    assert.equal(app.getSnapshot().trajectoryStatus.ball!.valid, true);
    await command(app, { type: "run" });
    await steps(app, 6);
    near(
      ballAt(app),
      poseAt(timePath(BALL_START, ARC), IDENTITY, onlyRun(app).elapsedS).positionM,
      1e-4,
      "the runner drives the new world",
    );
  });
});

test("a duplicate starts without the original's path", async () => {
  await fixture(async (app) => {
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: ARC });
    await command(app, { type: "duplicateObject", objectId: "ball" });
    const copy = app.getSnapshot().selectedObjectId!;
    assert.notEqual(copy, "ball");
    assert.equal(sceneObject(app, copy).trajectory, undefined, "the copy carries no path");
    assert.equal(app.getSnapshot().trajectoryStatus[copy], undefined);
    assert.deepEqual(sceneObject(app, "ball").trajectory, ARC, "the original keeps its path");
  });
});

test("objects publish whether they are audible", async () => {
  await fixture(async (app) => {
    const audible = Object.fromEntries(
      app.getSnapshot().objects.map((object) => [object.id, object.audible]),
    );
    assert.equal(audible.ball, true, "ball has an enabled behaviour binding");
    assert.equal(audible.speaker, true, "speaker has a sound source");
    assert.equal(audible.floor, false);
  });
});

test("a moved ball keeps its offsets, starts the next take at its new place and hands over in its mode", async () => {
  await fixture(async (app) => {
    const straight: ObjectTrajectory = { ...ARC, offsetsM: [[0.6, 0, 0]], strengthMps: 3 };
    const moved: Vector3 = [-0.8, 2.5, 0.5];
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: straight });
    await command(app, { type: "patchObject", objectId: "ball", patch: { positionM: moved } });
    assert.deepEqual(sceneObject(app, "ball").trajectory!.offsetsM, [[0.6, 0, 0]]);
    await command(app, {
      type: "patchObject",
      objectId: "ball",
      patch: { mode: "dynamicNoGravity" },
    });
    assert.equal(app.getSnapshot().trajectoryStatus.ball!.valid, true);

    await command(app, { type: "run" });
    await steps(app, 3);
    const path = timePath(moved, straight);
    near(ballAt(app), poseAt(path, IDENTITY, onlyRun(app).elapsedS).positionM, 1e-4, "new start");
    await steps(app, Math.ceil(path.durationS / STEP) + 6 - world(app).tick);
    assert.equal(onlyRun(app).status, "finished");
    const pose = world(app).getPose("ball");
    assert.equal(pose.mode, "dynamicNoGravity", "hand-over restores the configured mode");
    near(pose.linearVelocityMetresPerSecond, [3, 0, 0], 1e-3, "keeps the path velocity");
    assert.ok(Math.abs(pose.positionMetres[1] - moved[1]) < 1e-4, "no gravity after hand-over");
  });
});

test("path ranking runs at most eight audible valid paths in id order", async () => {
  const { rankPaths } = await import("../../src/app/trajectory-status.js");
  const geometry = new Map(
    ["k", "a", "c", "b", "e", "d", "g", "f", "h", "i", "j", "wall", "mute"].map((id) => [
      id,
      id === "wall"
        ? { lengthM: 1, durationS: 0.5, problem: "BLOCKED" as const }
        : { lengthM: 1, durationS: 0.5 },
    ]),
  );
  const audible = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "wall"]);
  const { status, runnable } = rankPaths(geometry, audible);
  assert.deepEqual([...runnable].sort(), ["a", "b", "c", "d", "e", "f", "g", "h"]);
  for (const id of ["i", "j", "k"])
    assert.deepEqual(status[id], { lengthM: 1, durationS: 0.5, valid: false, problem: "TOO_MANY" });
  assert.deepEqual(status.wall, { lengthM: 1, durationS: 0.5, valid: false, problem: "BLOCKED" });
  assert.deepEqual(
    status.mute,
    { lengthM: 1, durationS: 0.5, valid: true },
    "never runs, never ranked",
  );
  assert.equal(runnable.has("mute"), false);
});

/** The ball floats 1.5 m in front of the first-person spawn, under the crosshair. */
const AHEAD: Vector3 = [0, 1.6, 2.5];
async function ballUnderCrosshair(app: LabRuntime) {
  await command(app, { type: "patchObject", objectId: "ball", patch: { positionM: AHEAD } });
  await command(app, {
    type: "patchObject",
    objectId: "ball",
    patch: { mode: "dynamicNoGravity" },
  });
  await command(app, { type: "enterFPS" });
  await command(app, { type: "pointerLockChanged", locked: true });
}
async function paintSweep(app: LabRuntime, looks = 12) {
  for (let index = 0; index < looks; index++)
    await app.dispatch({ type: "inputLook", movementX: 40, movementY: -10 });
}

test("Ctrl+press painting freezes the room at its start, keeps the player and saves an undoable path", async () => {
  await fixture(async (app) => {
    await ballUnderCrosshair(app);
    // The start delay holds the ball at its start while the room runs.
    const previous: ObjectTrajectory = {
      offsetsM: [[0, 0.5, 0]],
      strengthMps: 2,
      startDelayS: 1,
      faceAlongPath: true,
    };
    await command(app, { type: "setTrajectory", objectId: "ball", trajectory: previous });
    await command(app, { type: "run" });
    await steps(app, 5);
    assert.equal(app.getSnapshot().simulationState, "running");
    const eye = app.getFPSCamera()!.positionM;

    await command(app, { type: "paintStart" });
    let snapshot = app.getSnapshot();
    assert.equal(snapshot.simulationState, "ready", "the room froze at its starting layout");
    assert.equal(world(app).tick, 0);
    assert.deepEqual(snapshot.pathRuns, [], "no take runs while painting");
    near(app.getFPSCamera()!.positionM, eye, 1e-3, "the player stays where they stand");
    assert.equal(snapshot.paint?.objectId, "ball");
    assert.ok(Math.abs(snapshot.paint!.distanceM - 1.5) < 0.05, "brush at the ball's distance");
    near(snapshot.paint!.pointsM[0]!, AHEAD, 1e-9, "the stroke starts at the ball's start");

    await paintSweep(app);
    assert.ok(app.getSnapshot().paint!.pointsM.length > 5, "the stroke follows the crosshair");
    await steps(app, 3);
    assert.equal(world(app).tick, 0, "time stays frozen during the stroke");
    const revision = app.getSnapshot().sceneRevision;
    await command(app, { type: "paintEnd" });
    snapshot = app.getSnapshot();
    assert.equal(snapshot.paint, null);
    assert.equal(snapshot.simulationState, "ready", "the room waits for Enter or a click");
    assert.equal(snapshot.sceneRevision, revision + 1, "one undoable scene edit");
    const saved = sceneObject(app, "ball").trajectory!;
    assert.ok(saved.offsetsM.length >= 1 && saved.offsetsM.length <= 63);
    assert.ok(Math.hypot(...saved.offsetsM[0]!) <= 0.2, "the first point is next to the start");
    assert.deepEqual(
      { ...saved, offsetsM: [] },
      { ...previous, offsetsM: [] },
      "a redraw keeps strength, delay and face-along-path",
    );
    assert.equal(snapshot.trajectoryStatus.ball!.valid, true);

    await command(app, { type: "undo" });
    assert.deepEqual(sceneObject(app, "ball").trajectory, previous, "undo restores the old path");
  });
});

test("a first stroke takes the default parameters; a stroke that never moved saves nothing", async () => {
  await fixture(async (app) => {
    await ballUnderCrosshair(app);
    const revision = app.getSnapshot().sceneRevision;
    await command(app, { type: "paintStart" });
    assert.equal(app.getSnapshot().paint?.objectId, "ball", "painting also starts from ready");
    await command(app, { type: "paintEnd" });
    assert.equal(app.getSnapshot().paint, null);
    assert.equal(app.getSnapshot().sceneRevision, revision, "no movement commits nothing");
    assert.equal(sceneObject(app, "ball").trajectory, undefined);
    assert.equal(app.getSnapshot().simulationState, "ready");

    await command(app, { type: "paintStart" });
    await paintSweep(app);
    await command(app, { type: "paintEnd" });
    const saved = sceneObject(app, "ball").trajectory!;
    assert.deepEqual(
      { strengthMps: saved.strengthMps, startDelayS: saved.startDelayS, face: saved.faceAlongPath },
      { strengthMps: 3, startDelayS: 0, face: false },
    );
    // Enter or a plain click dispatches Resume; at the starting layout it starts the take.
    await command(app, { type: "run" });
    assert.equal(onlyRun(app).objectId, "ball");
    assert.equal(onlyRun(app).elapsedS, 0);
  });
});

const BLOCKED_NOTICE = "這條軌跡碰到固定幾何，不會執行；回到編輯器按 T 調整。";
const TOO_LONG_NOTICE = "這條軌跡以目前強度移動太久，不會執行；回到編輯器按 T 提高強度或縮短軌跡。";

test("a painted path that meets fixed geometry is saved, and a first-person notice says it will not run", async () => {
  await fixture(async (app) => {
    await ballUnderCrosshair(app);
    await command(app, { type: "paintStart" });
    // The brush keeps every stroke clear of walls, so stand in for it with a stroke through the
    // back wall: the release still runs the real paintEnd commit and status check. The view does
    // not turn, so the crosshair stays on the ball for the redraw (look is gated while frozen).
    const host = (app as unknown as { interaction: { endPaint(): Vector3[] } }).interaction;
    const endPaint = host.endPaint.bind(host);
    host.endPaint = () => {
      endPaint();
      return [AHEAD, [0, 1.6, -2], [0, 1.6, -6]];
    };
    const revision = app.getSnapshot().sceneRevision;
    await command(app, { type: "paintEnd" });
    let snapshot = app.getSnapshot();
    assert.equal(snapshot.sceneRevision, revision + 1, "the stroke is saved for editing");
    assert.equal(snapshot.trajectoryStatus.ball!.problem, "BLOCKED");
    assert.equal(snapshot.interactionMode, "fps-interact", "still in first person");
    assert.equal(snapshot.notice, BLOCKED_NOTICE);
    assert.doesNotMatch(formatMessage("en", snapshot.notice), /\p{Script=Han}/u);

    // A valid redraw withdraws the warning.
    delete (host as Partial<typeof host>).endPaint;
    await command(app, { type: "paintStart" });
    assert.equal(app.getSnapshot().paint?.objectId, "ball");
    await paintSweep(app);
    await command(app, { type: "paintEnd" });
    snapshot = app.getSnapshot();
    assert.equal(snapshot.trajectoryStatus.ball!.valid, true);
    assert.notEqual(snapshot.notice, BLOCKED_NOTICE, "a valid redraw clears the warning");
  });
});

test("a painted path too long for its Strength gets its own first-person notice", async () => {
  await fixture(async (app) => {
    await ballUnderCrosshair(app);
    // A redraw keeps the slowest Strength: 0.5 m/s, so 15 m of stroke exceeds 30 s.
    await command(app, {
      type: "setTrajectory",
      objectId: "ball",
      trajectory: { ...ARC, strengthMps: 0.5 },
    });
    await command(app, { type: "paintStart" });
    // Two full turns around the player at the ball's 1.5 m distance: about 19 m.
    for (let index = 0; index < 64; index++)
      await app.dispatch({ type: "inputLook", movementX: 100, movementY: 0 });
    await command(app, { type: "paintEnd" });
    const snapshot = app.getSnapshot();
    assert.equal(snapshot.trajectoryStatus.ball!.problem, "TOO_LONG");
    assert.equal(snapshot.notice, TOO_LONG_NOTICE);
    assert.doesNotMatch(formatMessage("en", snapshot.notice), /\p{Script=Han}/u);
  });
});

test("Ctrl+press refuses empty air, the floor and a recording with a notice, and nothing pauses", async () => {
  await fixture(async (app) => {
    await ballUnderCrosshair(app);
    await command(app, { type: "run" });
    await steps(app, 3);
    const refusal = async (why: string) => {
      const tick = world(app).tick;
      const revision = app.getSnapshot().sceneRevision;
      await command(app, { type: "paintStart" });
      const snapshot = app.getSnapshot();
      assert.equal(snapshot.simulationState, "running", `${why}: the room keeps running`);
      assert.equal(snapshot.paint, null, why);
      assert.equal(world(app).tick, tick, `${why}: no snap-back`);
      assert.equal(snapshot.sceneRevision, revision, why);
      assert.ok(snapshot.notice, `${why}: a notice says why`);
      await steps(app, 1);
      assert.ok(world(app).tick > tick, `${why}: time still runs`);
      return snapshot.notice;
    };
    // About 57 degrees to the left: nothing within reach.
    await app.dispatch({ type: "inputLook", movementX: -500, movementY: 0 });
    const nothing = await refusal("nothing aimed");
    await app.dispatch({ type: "inputLook", movementX: 0, movementY: 500 });
    const floor = await refusal("the floor has no sound");
    await app.dispatch({ type: "inputLook", movementX: 500, movementY: -500 });
    await command(app, { type: "recordToggle" });
    assert.equal(app.getSnapshot().recording.state, "recording");
    const recording = await refusal("recording");
    assert.equal(app.getSnapshot().recording.state, "recording", "the recording continues");
    assert.equal(new Set([nothing, floor, recording]).size, 3, "each refusal says its own reason");
  });
});

test("losing the lock, focus or first person mid-stroke cancels it without saving", async () => {
  for (const loss of [
    { type: "pointerLockChanged", locked: false },
    { type: "inputBlur" },
    { type: "exitFPS" },
  ] as LabAction[]) {
    await fixture(async (app) => {
      await ballUnderCrosshair(app);
      await command(app, { type: "run" });
      await steps(app, 3);
      await command(app, { type: "paintStart" });
      await paintSweep(app, 6);
      const revision = app.getSnapshot().sceneRevision;
      await command(app, loss);
      const snapshot = app.getSnapshot();
      assert.equal(snapshot.paint, null, loss.type);
      assert.equal(snapshot.simulationState, "ready", `${loss.type}: still the starting layout`);
      near(ballAt(app), AHEAD, 1e-6, `${loss.type}: ball at its start`);
      await command(app, { type: "paintEnd" });
      assert.equal(app.getSnapshot().sceneRevision, revision, `${loss.type}: nothing saved`);
      assert.equal(sceneObject(app, "ball").trajectory, undefined, loss.type);
    });
  }
});

test("a release that lands during the snap-back ends the stroke before it begins", async () => {
  await fixture(async (app) => {
    await ballUnderCrosshair(app);
    await command(app, { type: "run" });
    await steps(app, 3);
    const revision = app.getSnapshot().sceneRevision;
    const start = app.dispatch({ type: "paintStart" });
    await command(app, { type: "paintEnd" });
    await start;
    const snapshot = app.getSnapshot();
    assert.equal(snapshot.error, "");
    assert.equal(snapshot.paint, null, "no stroke is left without a held button");
    assert.equal(snapshot.simulationState, "ready", "the room is at its starting layout");
    assert.equal(snapshot.sceneRevision, revision);
    await paintSweep(app, 3);
    assert.equal(app.getSnapshot().paint, null);
  });
});

test("audibleObjectIds counts enabled bindings and sound sources only", async () => {
  const { audibleObjectIds } = await import("../../src/app/audible-objects.js");
  const { createDefaultBehaviors, createDefaultScene } = await import("../../src/app/defaults.js");
  const scene = createDefaultScene();
  const behaviors = createDefaultBehaviors(scene);
  assert.deepEqual([...audibleObjectIds(scene, behaviors)].sort(), ["ball", "speaker"]);
  const disabled = {
    ...behaviors,
    bindings: behaviors.bindings.map((binding) => ({ ...binding, enabled: false })),
  };
  assert.deepEqual([...audibleObjectIds(scene, disabled)], ["speaker"], "a source still counts");
});
