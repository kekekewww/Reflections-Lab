import assert from "node:assert/strict";
import test from "node:test";
import { InteractionHost } from "../../interaction/index.js";
import { PhysicsWorld } from "../../physics/index.js";
import { createScene } from "../../scene/index.js";
import { acceptsFPSKey } from "./input-policy.js";
import { ReleaseLedger } from "./release-ledger.js";

const acceptsKey = (code: string) =>
  acceptsFPSKey({
    code,
    isComposing: false,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    typing: false,
    locked: true,
    running: true,
  });

test("suspension preserves one owned release through double clear, unlock and UI focus", () => {
  const keys = new ReleaseLedger(32, acceptsKey);
  const forwarded: { code: string; pressed: boolean }[] = [];
  if (keys.press("KeyW")) forwarded.push({ code: "KeyW", pressed: true });
  keys.suspend();
  keys.suspend();
  assert.equal(keys.size, 1);
  assert.equal(keys.press("KeyW"), false, "a held key cannot become a fresh Resume edge");
  // Release is consumed independently of pointer lock, focus or running state.
  if (keys.release("KeyW")) forwarded.push({ code: "KeyW", pressed: false });
  assert.equal(keys.release("KeyW"), false);
  assert.equal(keys.size, 0);
  if (keys.press("KeyW")) forwarded.push({ code: "KeyW", pressed: true });
  assert.deepEqual(forwarded, [
    { code: "KeyW", pressed: true },
    { code: "KeyW", pressed: false },
    { code: "KeyW", pressed: true },
  ]);
});

test("unowned typing and unrelated releases are never fabricated or forwarded", () => {
  const keys = new ReleaseLedger(32, acceptsKey);
  assert.equal(keys.press("KeyT"), false);
  assert.equal(keys.release("KeyT"), false);
  assert.equal(keys.release("KeyW"), false);
  assert.equal(keys.press("ShiftRight"), true);
  keys.suspend();
  assert.equal(keys.release("KeyA"), false);
  assert.equal(keys.hasUnreleased("ShiftRight"), true);
  assert.equal(keys.release("ShiftRight"), true);
  assert.equal(keys.release("ShiftRight"), false);
});

test("primary button release debt survives enter and prevents a false acquisition release", () => {
  const buttons = new ReleaseLedger<number>(
    5,
    (button) => Number.isSafeInteger(button) && button >= 0 && button <= 4,
  );
  assert.equal(buttons.hasUnreleased(0), false);
  assert.equal(buttons.press(0), true);
  buttons.suspend();
  buttons.suspend();
  assert.equal(
    buttons.hasUnreleased(0),
    true,
    "lock/resume must not announce a release while still held",
  );
  assert.equal(buttons.press(0), false);
  assert.equal(buttons.release(0), true);
  assert.equal(buttons.hasUnreleased(0), false);
  assert.equal(
    buttons.press(0),
    true,
    "a genuinely new click can be admitted after actual pointerup",
  );
});

test("tracking is bounded and duplicate or invalid buttons do not consume release slots", () => {
  const buttons = new ReleaseLedger<number>(
    5,
    (button) => Number.isSafeInteger(button) && button >= 0 && button <= 4,
  );
  for (let button = 0; button < 5; button++) assert.equal(buttons.press(button), true);
  for (const button of [-1, 5, 99, Number.NaN, 0, 4]) assert.equal(buttons.press(button), false);
  buttons.suspend();
  buttons.suspend();
  assert.equal(buttons.size, 5);
  assert.equal(buttons.release(2), true);
  assert.equal(buttons.size, 4);
  assert.equal(buttons.press(2), true);
  assert.equal(buttons.size, 5);
  const capped = new ReleaseLedger<number>(2, Number.isSafeInteger);
  assert.equal(capped.press(1), true);
  assert.equal(capped.press(2), true);
  assert.equal(capped.press(3), false);
  assert.equal(capped.size, 2);
});

test("real Rapier host stays frozen through held W Resume, then recovers after observed release", async () => {
  const scene = createScene({
    schemaVersion: "1.0.0",
    sceneId: "release-debt-regression",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 4,
    gravityMps2: [0, -9.81, 0],
    objects: [
      {
        id: "floor",
        shape: "box",
        dimensionsM: [20, 0.2, 20],
        positionM: [0, -0.1, 0],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "fixed",
        massKg: 1,
        friction: 0.5,
        restitution: 0,
        physicsMaterialId: "test.physics",
        acousticMaterialId: "test.acoustic",
        acousticRole: "staticSurface",
      },
    ],
    sources: [],
    listener: {
      id: "listener",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
  const world = await PhysicsWorld.create(scene);
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => scene,
    commitSceneOperations: async () => {
      throw new Error("No authoring command expected");
    },
  });
  const keys = new ReleaseLedger(32, acceptsKey);
  const press = (code: string) => {
    if (keys.press(code)) host.handleKey(code, true);
  };
  const release = (code: string) => {
    if (keys.release(code)) host.handleKey(code, false);
  };
  const step = (count: number) => {
    for (let i = 0; i < count; i++) {
      host.beforeStep();
      world.step();
    }
  };
  try {
    host.enterFPS({ pointerLocked: true });
    assert.equal(host.resume(), true);
    press("KeyW");
    step(12);
    keys.suspend();
    host.suspend("blur-regression");
    keys.suspend();
    host.suspend("duplicate-blur");
    host.confirmPointerLock(true);
    assert.equal(host.resume(), true);
    const pausedZ = host.snapshot().camera.positionM[2];
    press("KeyW");
    step(20);
    assert.ok(
      Math.abs(host.snapshot().camera.positionM[2] - pausedZ) < 0.02,
      "still-held W cannot silently resume movement",
    );
    release("KeyW");
    press("KeyW");
    step(20);
    assert.ok(
      host.snapshot().camera.positionM[2] < pausedZ - 0.3,
      "observed release must unblock the next fresh press",
    );
  } finally {
    host.dispose();
    world.dispose();
  }
});
