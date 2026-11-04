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
  const commit = async (operations: SceneOperation[], guard?: () => void, policy?: "placement") => {
    const expected = scene.sceneRevision;
    if (beforeCommit) await beforeCommit();
    assert.equal(scene.sceneRevision, expected);
    guard?.();
    const candidate = applyCommand(scene, {
      expectedSceneRevision: expected,
      operations,
    }).scene;
    const running = !world.paused;
    if (policy === "placement") world.pause();
    world.applyScene(candidate);
    if (policy === "placement" && running) world.resume();
    scene = candidate;
    commitCount++;
  };
  const pauses: string[] = [];
  const fades: string[] = [];
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => scene,
    commitSceneOperations: commit,
    onPause: (reason: string) => pauses.push(reason),
    onAudioFade: (reason) => fades.push(reason),
    createBuildDraft: () => object(`preview-${commitCount}`, { mode: "dynamicGravity" }),
    confirmGeometry: options.confirmGeometry ?? (() => true),
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
    fades,
    dispose: () => {
      host.dispose();
      world.dispose();
    },
  };
}

const norm = (v: readonly number[]) => Math.hypot(...v);
test("review 9: non-placement commit rig preserves the running-world PAUSE_REQUIRED guard", async () => {
  const r = await rig();
  try {
    r.start();
    await assert.rejects(r.commit([{ type: "SetObjectMode", objectId: "ball", mode: "fixed" }]), {
      code: "PAUSE_REQUIRED",
    });
    assert.equal(r.world.paused, false);
    assert.equal(r.getScene().sceneRevision, 0);
  } finally {
    r.dispose();
  }
});
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

test("ordinary pause preserves alternative input and cancels preview without activating it", async () => {
  const r = await rig([floor()]);
  try {
    r.host.enterFPS();
    r.host.setAlternativeInput(true);
    assert.equal(r.host.resume(), true);
    r.host.beginBuild(object("paused-preview"));
    assert.equal(r.host.setGhostPose([1, 0.21, 1]), true);
    r.host.pausePreservingInputMode("alternative button pause");
    const tick = r.world.tick;
    assert.equal(r.host.snapshot().alternativeInput, true);
    assert.equal(r.host.snapshot().pointerLocked, false);
    assert.equal(r.host.snapshot().ghost, null);
    r.step(10);
    assert.equal(r.world.tick, tick);
    assert.equal(r.host.resume(), true);
    assert.equal(r.host.snapshot().ghost, null);
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

test("Held freeze preserves the same body; resume is explicit and placement preview is rejected", async () => {
  const r = await rig();
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    const generation = r.world.getPose("ball").generation;
    assert.equal(r.host.startPreview(), false);
    assert.match(r.host.snapshot().notice ?? "", /釋放/);
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

test("placement acknowledges a data-only staged draft then atomically enables the desired mode", async () => {
  let r!: Awaited<ReturnType<typeof rig>>;
  r = await rig([floor()], {
    confirmGeometry: (id, revision) => {
      assert.equal(id, "placed");
      assert.equal(revision, r.getScene().sceneRevision + 1);
      assert.equal(
        r.getScene().objects.some((o) => o.id === id),
        false,
      );
      assert.equal(
        r.world.snapshot().poses.some((p) => p.objectId === id),
        false,
        "no body or collider before ack",
      );
      assert.equal(r.host.snapshot().staged?.geometryAcknowledged, false);
      return true;
    },
  });
  try {
    r.start();
    r.host.beginBuild(object("placed"));
    r.host.setGhostPose([1, 0.21, 1]);
    assert.equal(await r.host.place(), true);
    assert.equal(r.world.paused, false);
    assert.equal(r.getCommitCount(), 1);
    assert.equal(r.getScene().objects.find((o) => o.id === "placed")?.mode, "dynamicNoGravity");
    assert.equal(r.world.getPose("placed").enabled, true);
    assert.equal(r.host.snapshot().staged, null);
    assert.equal(r.host.snapshot().ghost, null);
    assert.deepEqual(r.pauses, []);
    assert.deepEqual(r.fades, []);
    assert.equal(r.host.resume(), true);
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
    assert.equal(r.host.snapshot().ghost, null);
    r.host.cancelPreview();
    assert.equal(r.host.snapshot().ghost, null);
    assert.equal(r.getScene().objects.length, 1);
  } finally {
    r.dispose();
  }
});

test("pending placement deduplicates input and rejects a revision changed during acknowledgement", async () => {
  let release!: (ack: boolean) => void;
  const ack = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  const r = await rig([floor()], { confirmGeometry: () => ack });
  try {
    r.start();
    r.host.beginBuild(object("pending"));
    r.host.setGhostPose([1, 0.21, 1]);
    const first = r.host.place();
    assert.equal(r.host.snapshot().ghost?.stage, "pending");
    assert.equal(await r.host.place(), false);
    assert.equal(r.getCommitCount(), 0);
    r.world.pause();
    await r.commit([{ type: "AddObject", object: object("other", { positionM: [-2, 1, 0] }) }]);
    r.world.resume();
    release(true);
    assert.equal(await first, false);
    assert.equal(r.getCommitCount(), 1);
    assert.equal(
      r.getScene().objects.some((o) => o.id === "pending"),
      false,
    );
    assert.equal(r.host.snapshot().staged, null);
    assert.equal(r.host.resume(), true);
  } finally {
    release(false);
    r.dispose();
  }
});

test("pending placement cannot be duplicated or partly enabled; acknowledgement completes one live object", async () => {
  let release!: (ack: boolean) => void;
  const ack = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  const r = await rig([floor()], { confirmGeometry: () => ack });
  try {
    r.start();
    r.host.beginBuild(object("pending-live"));
    r.host.setGhostPose([1, 0.21, 1]);
    const placement = r.host.place();
    r.host.cancelPreview();
    assert.equal(r.host.snapshot().ghost?.stage, "pending");
    assert.equal(await r.host.place(), false);
    assert.equal(
      r.world.snapshot().poses.some((o) => o.objectId === "pending-live"),
      false,
    );
    assert.equal(r.getCommitCount(), 0);
    release(true);
    assert.equal(await placement, true);
    assert.equal(r.world.getPose("pending-live").enabled, true);
    assert.equal(r.getCommitCount(), 1);
    assert.equal(r.host.snapshot().staged, null);
    assert.equal(r.host.resume(), true);
  } finally {
    release(false);
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

test("a failed asynchronous geometry acknowledgement leaves no object and Resume remains possible", async () => {
  const r = await rig([floor()], {
    confirmGeometry: async () => {
      throw new Error("injected backend acknowledgement failure");
    },
  });
  try {
    r.start();
    r.host.beginBuild(object("ack-failure"));
    r.host.setGhostPose([1, 0.21, 1]);
    assert.equal(await r.host.place(), false);
    assert.equal(r.host.snapshot().pending, false);
    assert.equal(r.host.snapshot().ghost, null);
    assert.equal(r.host.snapshot().staged, null);
    assert.equal(r.world.paused, false);
    assert.equal(
      r.world.snapshot().poses.some((p) => p.objectId === "ack-failure"),
      false,
    );
    assert.equal(
      r.getScene().objects.some((o) => o.id === "ack-failure"),
      false,
    );
    assert.equal(r.getCommitCount(), 0);
    assert.match(r.host.snapshot().notice ?? "", /injected backend acknowledgement failure/);
    assert.equal(r.host.resume(), true);
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

test("R18: transaction safe pauses keep the browser-owned lock so an explicit Resume works without alternative input", async () => {
  const r = await rig([floor(), object("ball")]);
  try {
    r.start();
    assert.equal(r.host.grab(), true);
    assert.equal(await r.host.toggleFixed(), true);
    assert.equal(r.world.paused, true);
    assert.equal(r.host.snapshot().pointerLocked, true, "fixing never released the browser lock");
    assert.equal(r.host.snapshot().alternativeInput, false);
    assert.equal(r.host.resume(), true, "Enter/click Resume while the canvas stays locked");
    assert.equal(r.host.setBuild(true), true);
    r.host.beginBuild(object("placed", { positionM: [1, 0.21, 1] }));
    r.host.setGhostPose([1, 0.21, 1]);
    assert.equal(await r.host.place(), true);
    assert.equal(r.host.snapshot().pointerLocked, true, "placement never released the lock");
    assert.equal(r.world.getPose("placed").enabled, true);
    assert.equal(r.world.paused, false, "placement continues without manual Enable");
    assert.equal(r.host.resume(), true);
    r.host.suspend("blur");
    assert.equal(r.host.snapshot().pointerLocked, false, "focus loss still revokes the lock");
    assert.equal(r.host.resume(), false);
  } finally {
    r.dispose();
  }
});

test("R21: placement never traps Resume or requires leaving a build mode", async () => {
  const r = await rig([floor()], { confirmGeometry: () => true });
  try {
    r.start();
    r.host.handleKey("KeyB", true);
    r.host.beginBuild(object("r21-placed"));
    r.host.setGhostPose([1, 0.21, 1]);
    assert.equal(await r.host.place(), true);
    assert.equal(r.host.resume(), true);
    r.host.handleKey("KeyB", false);
    r.host.handleKey("KeyB", true);
    assert.equal(r.host.snapshot().mode, "fps-interact");
  } finally {
    r.dispose();
  }
});

test("R21: a fresh left press grabs the crosshair target", async () => {
  const r = await rig();
  try {
    r.start();
    r.host.handlePointer(0, false);
    r.host.handlePointer(0, true);
    assert.equal(r.world.heldObjectId, "ball");
  } finally {
    r.dispose();
  }
});

test("R21: right hold starts a placement preview without B", async () => {
  const r = await rig([floor()]);
  try {
    r.start();
    r.host.handlePointer(2, false);
    r.host.handlePointer(2, true);
    assert.ok(r.host.snapshot().ghost, "right press must show the current shape");
  } finally {
    r.dispose();
  }
});

test("R21: no surface produces a valid mid-air preview", async () => {
  const r = await rig([floor()]);
  try {
    r.start();
    r.host.beginBuild(object("r21-air", { mode: "dynamicGravity" }));
    assert.equal(r.host.snapshot().ghost?.valid, true);
    assert.equal(r.host.snapshot().ghost?.draft.mode, "dynamicNoGravity");
  } finally {
    r.dispose();
  }
});

async function settled(r: Awaited<ReturnType<typeof rig>>) {
  for (let i = 0; i < 100 && r.host.snapshot().pending; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(r.host.snapshot().pending, false);
}

test("R21 suspension can cancel an acknowledgement that has not settled and Resume is available", async () => {
  let release!: (ack: boolean) => void;
  const ack = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  const r = await rig([floor()], { confirmGeometry: () => ack });
  try {
    r.start();
    r.host.beginBuild(object("cancel-pending"));
    const placing = r.host.place();
    r.host.suspend("blur while waiting");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(r.host.snapshot().pending, false, "no backend response is needed to cancel");
    assert.equal(await placing, false);
    r.host.confirmPointerLock(true);
    assert.equal(r.host.resume(), true);
    release(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(r.getCommitCount(), 0, "late acknowledgement cannot resurrect placement");
  } finally {
    release(false);
    r.dispose();
  }
});

test("R21: left press throws Held once and right press drops in place with current velocity", async () => {
  const r = await rig();
  try {
    r.start();
    r.host.handlePointer(0, false);
    r.host.handlePointer(2, false);
    r.host.handlePointer(0, true);
    r.host.handlePointer(0, false);
    r.world.setVelocity("ball", [0.2, 0.3, 0.4]);
    const velocity = r.world.getPose("ball").linearVelocityMetresPerSecond;
    r.host.handlePointer(2, true);
    assert.equal(r.world.heldObjectId, null);
    assert.deepEqual(r.world.getPose("ball").linearVelocityMetresPerSecond, velocity);
    assert.equal(r.host.snapshot().ghost, null);
    r.host.handlePointer(2, false);
    r.host.handlePointer(0, true);
    r.host.handlePointer(0, false);
    r.host.handlePointer(0, true);
    r.host.handlePointer(0, true);
    assert.equal(r.world.heldObjectId, null);
    r.step();
    assert.equal(r.world.snapshot().events.filter((e) => e.type === "OnThrow").length, 1);
    assert.equal(r.world.snapshot().events.filter((e) => e.type === "OnDrop").length, 1);
  } finally {
    r.dispose();
  }
});

for (const quick of [true, false])
  test(`R21: ${quick ? "quick right click" : "right hold"} places one live object per release`, async () => {
    const r = await rig([floor()]);
    try {
      r.start();
      r.host.handlePointer(2, false);
      r.host.handlePointer(2, true);
      assert.equal(r.host.snapshot().ghost?.valid, true);
      const pressPose = r.host.snapshot().ghost!.draft.positionM;
      assert.equal(r.getScene().objects.length, 1);
      if (!quick) {
        r.host.handleWheel(100);
        r.step(2);
      }
      const preview = r.host.snapshot().ghost!.draft;
      r.host.handlePointer(2, false);
      r.host.handlePointer(2, false);
      await settled(r);
      const placed = r.getScene().objects.find((o) => o.id === preview.id)!;
      assert.ok(placed);
      if (quick) assert.deepEqual(placed.positionM, pressPose);
      assert.equal(placed.mode, "dynamicNoGravity");
      assert.equal(r.world.getPose(placed.id).enabled, true);
      assert.equal(r.host.snapshot().staged, null);
      assert.equal(r.host.snapshot().ghost, null);
      assert.equal(r.world.paused, false);
      assert.equal(r.getCommitCount(), 1);
    } finally {
      r.dispose();
    }
  });

test("R21: surface preview keeps the gravity draft mode and its tangent grid clearance", async () => {
  const r = await rig([floor()]);
  try {
    r.start();
    r.host.handlePointer(2, false);
    r.host.handleLook(0, 500);
    r.host.handlePointer(2, true);
    const preview = r.host.snapshot().ghost!;
    assert.equal(preview.surfaceObjectId, "floor");
    assert.equal(preview.valid, true);
    assert.equal(preview.draft.mode, "dynamicGravity");
    r.host.handlePointer(2, false);
    await settled(r);
    assert.equal(r.world.getPose(preview.draft.id).mode, "dynamicGravity");
    assert.equal(r.world.getPose(preview.draft.id).enabled, true);
  } finally {
    r.dispose();
  }
});

for (const cause of ["Escape", "Tab", "blur", "lock-loss", "pause", "left-click"])
  test(`R21: ${cause} cancels right hold without placing on its later release`, async () => {
    const r = await rig([floor()]);
    try {
      r.start();
      r.host.handlePointer(0, false);
      r.host.handlePointer(2, false);
      r.host.handlePointer(2, true);
      assert.ok(r.host.snapshot().ghost);
      if (cause === "Escape" || cause === "Tab") r.host.handleKey(cause, true);
      else if (cause === "left-click") r.host.handlePointer(0, true);
      else if (cause === "lock-loss") r.host.confirmPointerLock(false);
      else if (cause === "pause") r.host.pausePreservingInputMode("user pause");
      else r.host.suspend("blur");
      assert.equal(r.host.snapshot().ghost, null);
      r.host.handlePointer(2, false);
      await settled(r);
      assert.equal(r.getCommitCount(), 0);
      assert.equal(r.getScene().objects.length, 1);
      r.host.confirmPointerLock(true);
      assert.equal(r.host.resume(), true);
    } finally {
      r.dispose();
    }
  });

test("R21: both acquisition buttons consume their first release without grabbing or placing", async () => {
  const r = await rig();
  try {
    r.start();
    r.host.handlePointer(0, true);
    r.host.handlePointer(2, true);
    assert.equal(r.world.heldObjectId, null);
    assert.equal(r.host.snapshot().ghost, null);
    r.host.handlePointer(0, false);
    r.host.handlePointer(2, false);
    await settled(r);
    assert.equal(r.getCommitCount(), 0);
    assert.equal(r.world.snapshot().events.filter((e) => e.type === "OnThrow").length, 0);
  } finally {
    r.dispose();
  }
});

for (const failure of [
  "ack-false",
  "overlap-at-ack",
  "overlap-at-commit",
  "commit-failure",
  "blur-at-ack",
])
  test(`R21: ${failure} leaves no half-created object or hidden recovery step`, async () => {
    let r!: Awaited<ReturnType<typeof rig>>;
    r = await rig([floor(), object("blocker", { positionM: [-2, 1.6, 1] })], {
      confirmGeometry: () => {
        if (failure === "ack-false") return false;
        if (failure === "overlap-at-ack") r.world.setVelocity("blocker", [120, 0, 0]);
        if (failure === "overlap-at-ack") r.step();
        if (failure === "blur-at-ack") r.host.suspend("blur during acknowledgement");
        return true;
      },
    });
    try {
      r.start();
      r.host.beginBuild(object("fail"));
      r.host.setGhostPose([0, 1.6, 1]);
      if (failure === "commit-failure")
        r.setCommitBarrier(async () => {
          throw new Error("injected commit failure");
        });
      if (failure === "overlap-at-commit")
        r.setCommitBarrier(async () => {
          r.world.setVelocity("blocker", [120, 0, 0]);
          r.step();
        });
      assert.equal(await r.host.place(), false);
      assert.equal(
        r.getScene().objects.some((o) => o.id === "fail"),
        false,
      );
      assert.equal(
        r.world.snapshot().poses.some((o) => o.objectId === "fail"),
        false,
      );
      assert.equal(r.host.snapshot().staged, null);
      assert.equal(r.host.snapshot().pending, false);
      assert.ok(r.host.snapshot().notice);
      assert.equal(r.world.paused, failure === "blur-at-ack");
      r.host.confirmPointerLock(true);
      assert.equal(r.host.resume(), true);
    } finally {
      r.dispose();
    }
  });
