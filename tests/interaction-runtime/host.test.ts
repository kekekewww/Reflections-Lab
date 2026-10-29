import assert from "node:assert/strict";
import test from "node:test";
import { InteractionHost } from "../../src/interaction/index.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { applyCommand, createScene } from "../../src/scene/index.js";
import type { SceneObject, SceneOperation, SceneSpec, Vec3 } from "../../src/scene/types.js";

function object(id: string, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [0.4, 0.4, 0.4],
    positionM: [0, 1.6, 1],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicNoGravity",
    massKg: 1,
    friction: 0.5,
    restitution: 0,
    physicsMaterialId: "test-physics",
    acousticMaterialId: "test-acoustic",
    acousticRole: "none",
    ...patch,
  };
}

const floor = (): SceneObject =>
  object("floor", {
    shape: "box",
    dimensionsM: [20, 0.2, 20],
    positionM: [0, -0.1, 0],
    mode: "fixed",
    acousticRole: "staticSurface",
  });

async function rig(
  objects: SceneObject[] = [floor(), object("ball")],
  options: {
    confirmGeometry?: (objectId: string, sceneRevision: number) => boolean | Promise<boolean>;
  } = {},
) {
  let scene: SceneSpec = createScene({
    schemaVersion: "1.0.0",
    sceneId: "interaction-tests",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 4,
    gravityMps2: [0, -9.81, 0],
    objects,
    sources: [],
    listener: {
      id: "listener",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
  const world = await PhysicsWorld.create(scene);
  let commitCount = 0;
  let beforeCommit: (() => Promise<void>) | null = null;
  const commit = async (operations: SceneOperation[]) => {
    if (beforeCommit) await beforeCommit();
    const candidate = applyCommand(scene, {
      expectedSceneRevision: scene.sceneRevision,
      operations,
    }).scene;
    world.applyScene(candidate);
    scene = candidate;
    commitCount++;
  };
  const pauses: string[] = [];
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => scene,
    commitSceneOperations: commit,
    onPause: (reason: string) => pauses.push(reason),
    ...(options.confirmGeometry ? { confirmGeometry: options.confirmGeometry } : {}),
  });
  const start = () => {
    host.enterFPS({ pointerLocked: true });
    assert.equal(host.resume(), true);
  };
  const step = (count = 1) => {
    for (let i = 0; i < count; i++) {
      host.beforeStep();
      world.step();
    }
  };
  return {
    host,
    world,
    start,
    step,
    commit,
    setCommitBarrier: (barrier: (() => Promise<void>) | null) => {
      beforeCommit = barrier;
    },
    getScene: () => scene,
    getCommitCount: () => commitCount,
    pauses,
    dispose: () => {
      host.dispose();
      world.dispose();
    },
  };
}

const norm = (v: readonly number[]) => Math.hypot(...v);
const close = (a: number, b: number, tol = 1e-5) =>
  assert.ok(Math.abs(a - b) < tol, `${a} differs from ${b}`);

test("actual lock confirmation gates FPS input; blur freezes ticks and clears latched movement", async () => {
  const r = await rig([floor()]);
  try {
    r.host.enterFPS();
    assert.equal(r.host.resume(), false);
    r.host.handleKey("KeyW", true);
    r.step(20);
    assert.equal(r.world.tick, 0);
    r.host.confirmPointerLock(true);
    assert.equal(r.host.resume(), true);
    const initial: Vec3 = [...r.host.snapshot().camera.positionM];
    r.host.handleKey("KeyW", false);
    r.host.handleKey("KeyW", true);
    r.step(40);
    assert.ok(r.host.snapshot().camera.positionM[2] < initial[2] - 0.5);
    r.host.suspend("blur");
    const frozen = r.world.snapshot();
    r.step(20);
    assert.equal(r.world.tick, frozen.tick);
    assert.equal(r.world.paused, true);
    r.host.confirmPointerLock(true);
    assert.equal(r.host.resume(), true);
    const resumeZ = r.host.snapshot().camera.positionM[2];
    r.step(20);
    close(r.host.snapshot().camera.positionM[2], resumeZ, 0.02);
  } finally {
    r.dispose();
  }
});

test("ordinary pause preserves actual lock and Held while clearing controls; explicit Resume needs no second lock event", async () => {
  const r = await rig();
  try {
    r.start();
    r.host.handleKey("KeyE", true);
    r.host.handleKey("KeyW", true);
    r.step();
    r.host.pausePreservingInputMode("Enter pause");
    const frozen = r.world.snapshot();
    assert.equal(r.host.snapshot().pointerLocked, true);
    assert.equal(r.host.snapshot().alternativeInput, false);
    assert.equal(r.host.snapshot().suspended, true);
    r.step(10);
    assert.equal(r.world.tick, frozen.tick);
    assert.deepEqual(
      r.world.getPose("ball"),
      frozen.poses.find((pose) => pose.objectId === "ball"),
    );
    assert.equal(r.host.resume(), true, "DOM still owns lock, so no new lock event is needed");
    assert.equal(r.world.heldObjectId, "ball");
    const cameraZ = r.host.snapshot().camera.positionM[2];
    r.host.handleKey("KeyE", true);
    r.host.handleKey("KeyW", true);
    r.host.handlePointer(0, true);
    r.step(10);
    close(r.host.snapshot().camera.positionM[2], cameraZ, 0.02);
    assert.equal(r.world.heldObjectId, "ball", "pause/resume cannot replay held keys or throw");
    r.host.handlePointer(0, false);
    r.host.handleKey("KeyE", false);
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, null);
    r.host.suspend("blur after ordinary pause");
    assert.equal(r.host.snapshot().pointerLocked, false);
    assert.equal(
      r.host.resume(),
      false,
      "focus loss still requires actual reacquisition or alternative mode",
    );
  } finally {
    r.dispose();
  }
});

test("ordinary pause preserves alternative input and the exact uncommitted ghost without activating it", async () => {
  const r = await rig([floor()]);
  try {
    r.host.enterFPS();
    r.host.setAlternativeInput(true);
    assert.equal(r.host.resume(), true);
    r.host.beginBuild(object("paused-preview"));
    assert.equal(r.host.setGhostPose([1, 0.21, 1]), true);
    const ghost = r.host.snapshot().ghost;
    r.host.pausePreservingInputMode("alternative button pause");
    const tick = r.world.tick;
    assert.equal(r.host.snapshot().alternativeInput, true);
    assert.equal(r.host.snapshot().pointerLocked, false);
    assert.deepEqual(r.host.snapshot().ghost, ghost);
    r.step(10);
    assert.equal(r.world.tick, tick);
    assert.equal(r.host.resume(), true);
    assert.deepEqual(r.host.snapshot().ghost, ghost);
    assert.equal(r.getCommitCount(), 0);
    assert.equal(
      r.world.snapshot().poses.some((pose) => pose.objectId === "paused-preview"),
      false,
    );
  } finally {
    r.dispose();
  }
});

test("explicit alternative input enables real FPS controls without claiming browser lock or auto-resuming", async () => {
  const r = await rig();
  try {
    r.host.setAlternativeInput(true);
    assert.equal(r.host.resume(), false, "Editor must not become FPS through a settings toggle");
    assert.equal(r.host.enterFPS(), true);
    assert.equal(r.host.snapshot().alternativeInput, true);
    assert.equal(r.host.snapshot().pointerLocked, false);
    assert.equal(r.world.paused, true);
    r.host.handleKey("KeyW", true);
    r.step(5);
    assert.equal(r.world.tick, 0, "choosing alternative controls cannot start time");
    assert.equal(r.host.resume(), true);
    const initialZ = r.host.snapshot().camera.positionM[2];
    r.host.handleKey("KeyW", true);
    r.step(5);
    close(r.host.snapshot().camera.positionM[2], initialZ, 0.02);
    r.host.handleKey("KeyW", false);
    assert.equal(r.host.grab(), true, "the accessible Grab button uses the real ray and body");
    const initialCamera = r.host.snapshot().camera.orientationQuaternion;
    r.host.handleLook(20, 0);
    assert.notDeepEqual(r.host.snapshot().camera.orientationQuaternion, initialCamera);
    assert.equal(r.host.throw(), true, "an explicit Throw button applies one real impulse");
    r.step();
    assert.equal(r.world.snapshot().events.filter((event) => event.type === "OnThrow").length, 1);
    r.host.handleKey("KeyW", true);
    r.step(20);
    assert.ok(r.host.snapshot().camera.positionM[2] < initialZ - 0.3);
    assert.equal(r.host.snapshot().pointerLocked, false);
    r.host.setAlternativeInput(false);
    const frozenTick = r.world.tick;
    r.host.handleKey("KeyW", true);
    r.step(5);
    assert.equal(r.world.tick, frozenTick);
    assert.equal(r.host.snapshot().suspended, true);
    assert.equal(r.host.resume(), false, "disabling the alternative requires real lock again");
  } finally {
    r.dispose();
  }
});

test("alternative input keeps Held on blur and blocks held keys until a fresh release after explicit Resume", async () => {
  const r = await rig();
  try {
    r.host.enterFPS();
    r.host.setAlternativeInput(true);
    assert.equal(r.host.resume(), true);
    r.host.handleKey("KeyE", true);
    r.host.handleKey("KeyW", true);
    r.step();
    r.host.suspend("IME-or-focus-transfer");
    const frozen = r.world.snapshot();
    r.step(10);
    assert.equal(r.world.tick, frozen.tick);
    assert.equal(r.world.heldObjectId, "ball");
    assert.equal(r.host.resume(), true);
    const cameraZ = r.host.snapshot().camera.positionM[2];
    r.host.handleKey("KeyE", true);
    r.host.handleKey("KeyW", true);
    r.step(10);
    close(r.host.snapshot().camera.positionM[2], cameraZ, 0.02);
    assert.equal(r.world.heldObjectId, "ball");
    r.host.handleKey("KeyE", false);
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, null);
    assert.equal(r.host.snapshot().pointerLocked, false);
  } finally {
    r.dispose();
  }
});

test("E key edges grab/drop exactly once and NoGravity drop preserves current velocity", async () => {
  const r = await rig();
  try {
    r.start();
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, "ball");
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, "ball", "OS repeat must not drop");
    r.world.setVelocity("ball", [0.2, 0.1, 0]);
    r.host.handleKey("KeyE", false);
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, null);
    assert.equal(r.world.getPose("ball").mode, "dynamicNoGravity");
    close(r.world.getPose("ball").linearVelocityMetresPerSecond[0], 0.2);
    close(r.world.getPose("ball").linearVelocityMetresPerSecond[1], 0.1);
    r.step();
    assert.equal(r.world.snapshot().events.filter((e) => e.type === "OnGrab").length, 1);
    assert.equal(r.world.snapshot().events.filter((e) => e.type === "OnDrop").length, 1);
  } finally {
    r.dispose();
  }
});

test("pointer-lock acquisition click cannot throw; a subsequent press emits one finite throw", async () => {
  const r = await rig();
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    r.host.handlePointer(0, true);
    assert.equal(r.world.heldObjectId, "ball");
    r.host.handlePointer(0, false);
    r.host.handlePointer(0, true);
    r.host.handlePointer(0, true);
    assert.equal(r.world.heldObjectId, null);
    r.step();
    const throws = r.world.snapshot().events.filter((e) => e.type === "OnThrow");
    assert.equal(throws.length, 1);
    assert.equal(throws[0]?.impulseNs, 6);
    const velocity = r.world.getPose("ball").linearVelocityMetresPerSecond;
    assert.ok(velocity.every(Number.isFinite));
    assert.ok(norm(velocity) > 5 && norm(velocity) < 7);
  } finally {
    r.dispose();
  }
});

test("first blocking wall prevents selecting and grabbing a dynamic body behind it", async () => {
  const wall = object("wall", {
    shape: "box",
    dimensionsM: [4, 4, 0.2],
    positionM: [0, 2, 2],
    mode: "fixed",
  });
  const r = await rig([floor(), wall, object("hidden")]);
  try {
    r.start();
    r.host.beforeStep();
    assert.equal(r.host.snapshot().hover?.objectId, "wall");
    assert.equal(r.host.grab(), false);
    assert.equal(r.world.heldObjectId, null);
  } finally {
    r.dispose();
  }
});

test("Held freeze preserves the same body; resume is explicit and build switching is rejected", async () => {
  const r = await rig();
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    const generation = r.world.getPose("ball").generation;
    assert.equal(r.host.setBuild(true), false);
    r.host.suspend("workspace-change");
    const before = r.world.snapshot();
    r.step(8);
    assert.equal(r.world.heldObjectId, "ball");
    assert.equal(r.world.tick, before.tick);
    assert.deepEqual(
      r.world.getPose("ball").positionMetres,
      before.poses.find((p) => p.objectId === "ball")?.positionMetres,
    );
    assert.equal(r.world.getPose("ball").generation, generation);
    r.host.confirmPointerLock(true);
    assert.equal(r.host.resume(), true);
    assert.equal(r.world.heldObjectId, "ball");
  } finally {
    r.dispose();
  }
});

test("rotating Held body does not rotate the camera and produces normalized finite targets", async () => {
  const r = await rig();
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    const camera = [...r.host.snapshot().camera.orientationQuaternion];
    r.host.handleKey("KeyR", true);
    r.host.handleLook(40, -30);
    r.step(5);
    assert.deepEqual(r.host.snapshot().camera.orientationQuaternion, camera);
    const rotation = r.world.getPose("ball").rotation;
    assert.ok(rotation.every(Number.isFinite));
    close(norm(rotation), 1, 1e-4);
    r.host.handleKey("KeyR", false);
    r.host.handleLook(20, 1e6);
    const next = r.host.snapshot().camera.orientationQuaternion;
    assert.ok(next.every(Number.isFinite));
    close(norm(next), 1, 1e-6);
    assert.notDeepEqual(next, camera);
  } finally {
    r.dispose();
  }
});

test("resume rejects a saved Held generation after collider geometry was rebuilt", async () => {
  const r = await rig();
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    r.host.pausePreservingInputMode("editor");
    await r.commit([
      { type: "SetGeometry", objectId: "ball", shape: "sphere", dimensionsM: [0.5, 0.5, 0.5] },
    ]);
    assert.equal(r.host.snapshot().pointerLocked, true);
    assert.equal(r.host.resume(), false);
    assert.equal(r.world.paused, true);
    assert.ok(r.host.snapshot().pauseReason);
  } finally {
    r.dispose();
  }
});

test("Build commits one disabled fixed staged body and requires matching geometry acknowledgement before enable", async () => {
  const r = await rig([floor()]);
  try {
    r.start();
    assert.equal(r.host.setBuild(true), true);
    r.host.beginBuild(object("placed", { positionM: [1, 0.21, 1] }));
    r.host.setGhostPose([1, 0.21, 1]);
    assert.equal(r.host.snapshot().ghost?.valid, true);
    assert.equal(await r.host.place(), true);
    assert.equal(r.world.paused, true);
    assert.equal(r.getCommitCount(), 1);
    assert.equal(r.getScene().objects.find((o) => o.id === "placed")?.mode, "fixed");
    assert.equal(r.world.getPose("placed").enabled, false);
    r.host.setAlternativeInput(true);
    assert.equal(r.host.resume(), false, "unacknowledged staged geometry must keep time paused");
    assert.equal(await r.host.enableStaged(), false);
    r.host.acknowledgeStaged("placed", r.getScene().sceneRevision);
    assert.equal(r.host.resume(), false, "acknowledgement still requires explicit Enable");
    assert.equal(await r.host.enableStaged(), true);
    assert.equal(r.getScene().objects.find((o) => o.id === "placed")?.mode, "dynamicNoGravity");
    assert.equal(r.world.getPose("placed").enabled, true);
    assert.equal(r.world.paused, true, "enable must not silently resume the simulation");
  } finally {
    r.dispose();
  }
});

test("invalid player-overlapping ghost cannot mutate the scene, and cancel affects only preview", async () => {
  const r = await rig([floor()]);
  try {
    r.start();
    r.host.setBuild(true);
    r.host.beginBuild(object("invalid", { shape: "box", dimensionsM: [1, 1, 1] }));
    r.host.setGhostPose([0, 0.9, 3] as Vec3);
    assert.equal(r.host.snapshot().ghost?.valid, false);
    assert.equal(await r.host.place(), false);
    assert.equal(r.getCommitCount(), 0);
    assert.equal(r.getScene().objects.length, 1);
    r.host.suspend("blur");
    assert.ok(r.host.snapshot().ghost);
    r.host.cancelPreview();
    assert.equal(r.host.snapshot().ghost, null);
    assert.equal(r.getScene().objects.length, 1);
  } finally {
    r.dispose();
  }
});

test("pending placement rejects duplicate input; stale geometry acknowledgement cannot enable a staged body", async () => {
  const r = await rig([floor()]);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    r.start();
    r.host.setBuild(true);
    r.host.beginBuild(object("pending"));
    r.host.setGhostPose([1, 0.21, 1]);
    r.setCommitBarrier(() => barrier);
    const first = r.host.place();
    assert.equal(r.host.snapshot().ghost?.stage, "pending");
    assert.equal(await r.host.place(), false);
    assert.equal(r.getCommitCount(), 0);
    release();
    assert.equal(await first, true);
    assert.equal(r.getCommitCount(), 1);
    r.host.acknowledgeStaged("pending", r.getScene().sceneRevision - 1);
    assert.equal(await r.host.enableStaged(), false);
    assert.equal(r.world.getPose("pending").enabled, false);
  } finally {
    release();
    r.dispose();
  }
});

test("pending placement cannot be canceled halfway; a completed staged cancel removes exactly one disabled body", async () => {
  let releaseCommit!: () => void;
  let releaseGeometry!: (acknowledged: boolean) => void;
  const commitBarrier = new Promise<void>((resolve) => {
    releaseCommit = resolve;
  });
  const geometryBarrier = new Promise<boolean>((resolve) => {
    releaseGeometry = resolve;
  });
  const r = await rig([floor()], { confirmGeometry: () => geometryBarrier });
  try {
    r.start();
    r.host.beginBuild(object("cancel-staged"));
    r.host.setGhostPose([1, 0.21, 1]);
    r.setCommitBarrier(() => commitBarrier);
    const placement = r.host.place();
    r.host.cancelPreview();
    assert.equal(r.host.snapshot().ghost?.stage, "pending");
    assert.equal(await r.host.cancelStaged(), false);
    releaseCommit();
    // Let the committed entity reach its asynchronous backend acknowledgement.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(r.host.snapshot().pending, true);
    assert.equal(r.world.getPose("cancel-staged").enabled, false);
    assert.equal(await r.host.cancelStaged(), false);
    assert.equal(await r.host.enableStaged(), false);
    releaseGeometry(true);
    assert.equal(await placement, true);
    r.host.cancelPreview();
    assert.equal(r.host.snapshot().staged?.objectId, "cancel-staged");
    r.host.setAlternativeInput(true);
    assert.equal(
      r.host.resume(),
      false,
      "a geometry acknowledgement cannot replace explicit Enable",
    );
    assert.equal(r.world.paused, true);
    assert.equal(await r.host.cancelStaged(), true);
    assert.equal(await r.host.cancelStaged(), false);
    assert.equal(r.host.snapshot().staged, null);
    assert.equal(
      r.getScene().objects.some((entry) => entry.id === "cancel-staged"),
      false,
    );
    assert.equal(
      r.world.snapshot().poses.some((entry) => entry.objectId === "cancel-staged"),
      false,
    );
    assert.equal(r.getCommitCount(), 2, "one Add and one Remove, with no duplicate cancellation");
    assert.equal(r.world.paused, true);
  } finally {
    releaseCommit();
    releaseGeometry(false);
    r.dispose();
  }
});

test("Freeze Held clears the saved lease and Unlock restores its exact prior gravity mode before explicit Resume", async () => {
  const r = await rig();
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    r.world.setVelocity("ball", [0.1, 0.2, 0.3]);
    assert.equal(await r.host.toggleFixed(), true);
    assert.equal(r.world.heldObjectId, null);
    assert.equal(r.world.getPose("ball").mode, "fixed");
    assert.equal(r.world.paused, true);
    assert.deepEqual(r.world.getPose("ball").linearVelocityMetresPerSecond, [0, 0, 0]);
    r.host.setAlternativeInput(true);
    assert.equal(r.host.resume(), true, "the former Held lease must not prevent Freeze recovery");
    assert.equal(await r.host.toggleFixed(), true);
    assert.equal(r.world.getPose("ball").mode, "dynamicNoGravity");
    assert.deepEqual(r.world.getPose("ball").linearVelocityMetresPerSecond, [0, 0, 0]);
    assert.equal(r.world.paused, true);
    assert.equal(r.host.resume(), true);
    r.step(20);
    assert.equal(r.world.heldObjectId, null);
    assert.equal(r.world.getPose("ball").mode, "dynamicNoGravity");
    close(r.world.getPose("ball").positionMetres[1], 1.6, 0.001);
  } finally {
    r.dispose();
  }
});

test("Unlock cannot reuse a previous body's gravity mode after the same stable ID is removed and rebuilt", async () => {
  const r = await rig();
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    assert.equal(await r.host.toggleFixed(), true);
    const oldGeneration = r.world.getPose("ball").generation;
    await r.commit([{ type: "RemoveObject", objectId: "ball" }]);
    await r.commit([{ type: "AddObject", object: object("ball", { mode: "fixed" }) }]);
    const replacement = r.world.getPose("ball");
    assert.notEqual(replacement.generation, oldGeneration);
    assert.equal(await r.host.toggleFixed(), false);
    assert.match(r.host.snapshot().notice ?? "", /先前重力模式/);
    assert.equal(r.world.getPose("ball").mode, "fixed");
    assert.equal(r.world.paused, true);
    assert.equal(r.getCommitCount(), 3, "the rejected Unlock must not add a mode transaction");
  } finally {
    r.dispose();
  }
});

test("a key pressed while inactive must be released before it can become a fresh action after Resume", async () => {
  const r = await rig();
  try {
    r.host.enterFPS();
    r.host.handleKey("KeyE", true);
    r.host.confirmPointerLock(true);
    assert.equal(r.host.resume(), true);
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, null, "held key repeat is not a new Grab edge");
    r.host.handleKey("KeyE", false);
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, "ball");
  } finally {
    r.dispose();
  }
});

test("physical keys held through suspension cannot resume movement or drop the saved Held body", async () => {
  const r = await rig();
  try {
    r.start();
    r.host.handleKey("KeyE", true);
    r.host.handleKey("KeyW", true);
    r.step();
    assert.equal(r.world.heldObjectId, "ball");
    r.host.suspend("blur-held-keys");
    r.host.confirmPointerLock(true);
    assert.equal(r.host.resume(), true);
    const frozenZ = r.host.snapshot().camera.positionM[2];
    r.host.handleKey("KeyE", true);
    r.host.handleKey("KeyW", true);
    assert.equal(r.world.heldObjectId, "ball", "repeat must not silently Drop after Resume");
    r.step(20);
    close(r.host.snapshot().camera.positionM[2], frozenZ, 0.02);
    r.host.handleKey("KeyE", false);
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, null);
    r.host.handleKey("KeyW", false);
    r.host.handleKey("KeyW", true);
    r.step(20);
    assert.ok(r.host.snapshot().camera.positionM[2] < frozenZ - 0.3);
  } finally {
    r.dispose();
  }
});

test("a failed asynchronous geometry acknowledgement keeps one disabled staged object and remains recoverable", async () => {
  const r = await rig([floor()], {
    confirmGeometry: async () => {
      throw new Error("injected backend acknowledgement failure");
    },
  });
  try {
    r.start();
    r.host.setBuild(true);
    r.host.beginBuild(object("ack-failure"));
    r.host.setGhostPose([1, 0.21, 1]);
    await r.host.place();
    const snapshot = r.host.snapshot();
    assert.equal(snapshot.pending, false);
    assert.equal(
      snapshot.ghost,
      null,
      "a committed ID cannot simultaneously remain an uncommitted ghost",
    );
    assert.equal(snapshot.staged?.objectId, "ack-failure");
    assert.equal(snapshot.staged?.geometryAcknowledged, false);
    assert.equal(r.world.paused, true);
    assert.equal(r.world.getPose("ack-failure").enabled, false);
    assert.equal(r.getScene().objects.filter((o) => o.id === "ack-failure").length, 1);
    r.host.acknowledgeStaged("ack-failure", r.getScene().sceneRevision);
    assert.equal(await r.host.enableStaged(), true);
    assert.equal(r.world.getPose("ack-failure").enabled, true);
  } finally {
    r.dispose();
  }
});

test("an injected physics Resume failure leaves the host suspended and the real world paused", async () => {
  const r = await rig([floor()]);
  try {
    r.host.enterFPS({ pointerLocked: true });
    const originalResume = r.world.resume.bind(r.world);
    r.world.resume = () => {
      throw new Error("injected resume failure");
    };
    assert.equal(r.host.resume(), false);
    assert.equal(r.host.snapshot().suspended, true);
    assert.equal(r.world.paused, true);
    r.world.resume = originalResume;
    assert.equal(r.host.resume(), true);
  } finally {
    r.dispose();
  }
});

test("a removed Gentle Place support cancels the pending placement without silently dropping Held", async () => {
  const playerFloor = object("player-floor", {
    shape: "box",
    dimensionsM: [2, 0.2, 1],
    positionM: [0, -0.1, 3],
    mode: "fixed",
  });
  const support = object("support", {
    shape: "box",
    dimensionsM: [2, 0.2, 2],
    positionM: [0, -0.1, 0.5],
    mode: "fixed",
  });
  const r = await rig([playerFloor, support, object("ball")]);
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    assert.equal(r.host.gentlePlace(), true);
    r.host.suspend("remove-gentle-support");
    await r.commit([{ type: "RemoveObject", objectId: "support" }]);
    r.host.confirmPointerLock(true);
    assert.equal(r.host.resume(), false);
    assert.match(r.host.snapshot().notice ?? "", /輕放支撐已失效/);
    assert.equal(r.world.paused, true);
    assert.equal(r.world.heldObjectId, "ball");
    assert.equal(r.host.resume(), true, "a second explicit Resume continues ordinary Held");
    r.step(242);
    assert.equal(r.world.heldObjectId, "ball");
    assert.equal(r.world.getPose("ball").mode, "dynamicNoGravity");
    assert.equal(r.world.snapshot().events.filter((e) => e.type === "OnDrop").length, 0);
  } finally {
    r.dispose();
  }
});
