import assert from "node:assert/strict";
import test from "node:test";
import { InteractionHost } from "../../src/interaction/index.js";
import { strokeOffsets, timePath } from "../../src/motion/trajectory-path.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { createScene } from "../../src/scene/index.js";
import { TRAJECTORY_LIMITS, type SceneObject, type Vec3 } from "../../src/scene/types.js";

const object = (id: string, patch: Partial<SceneObject> = {}): SceneObject => ({
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
});
const floor = object("floor", {
  shape: "box",
  dimensionsM: [20, 0.2, 20],
  positionM: [0, -0.1, 0],
  mode: "fixed",
});
/** A wall to the player's left whose right face is the plane x = -0.9. */
const leftWall = object("wall", {
  shape: "box",
  dimensionsM: [0.2, 4, 20],
  positionM: [-1, 2, 0],
  mode: "fixed",
});

/** A wall ahead of the player whose near face is the plane z = 0.7, 2.3 m from the eye. */
const backWall = object("wall.back", {
  shape: "box",
  dimensionsM: [20, 4, 0.2],
  positionM: [0, 2, 0.6],
  mode: "fixed",
});

/** First person with the actual lock, paused the way the runtime's snap-back leaves it. */
async function frozenRoom(extra: SceneObject[] = []) {
  const scene = createScene({
    schemaVersion: "1.0.0",
    sceneId: "paint-tests",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 4,
    gravityMps2: [0, -9.81, 0],
    objects: [floor, object("ball"), ...extra],
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
      throw new Error("painting never commits through the host");
    },
  });
  host.enterFPS({ pointerLocked: true });
  assert.equal(host.resume(), true);
  host.pausePreservingInputMode("snap-back");
  assert.equal(world.paused, true);
  const camera = (): Vec3 => host.snapshot().camera.positionM;
  /** A start straight ahead of the camera at the given distance. */
  const ahead = (distanceM: number): Vec3 => {
    const eye = camera();
    return [eye[0], eye[1], eye[2] - distanceM];
  };
  return {
    host,
    world,
    camera,
    ahead,
    dispose: () => {
      host.dispose();
      world.dispose();
    },
  };
}
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((value, index) => value - b[index]!));
/** The curve a stroke is saved as and the runner drives: its offsets, sampled by timePath. */
const storedCurve = (start: Vec3, stroke: Vec3[]): Vec3[] =>
  timePath(start, {
    offsetsM: strokeOffsets(start, stroke),
    strengthMps: TRAJECTORY_LIMITS.defaultStrengthMps,
    startDelayS: 0,
    faceAlongPath: false,
  }).pointsM;

test("a paint stroke follows the crosshair at the start distance on the frozen room", async () => {
  const r = await frozenRoom();
  try {
    const before = r.host.snapshot().camera.orientationQuaternion;
    r.host.handleLook(40, 0);
    assert.deepEqual(
      r.host.snapshot().camera.orientationQuaternion,
      before,
      "without a stroke, look stays gated on the paused world",
    );

    const start = r.ahead(2.9);
    r.host.beginPaint("ball", start);
    assert.equal(r.host.painting, true);
    assert.ok(Math.abs(r.host.snapshot().paint!.distanceM - 2.9) < 1e-9);
    for (let index = 0; index < 10; index++) r.host.handleLook(40, 0);
    assert.equal(r.world.paused, true, "painting never runs time");
    assert.equal(r.world.tick, 0);
    const paint = r.host.snapshot().paint!;
    assert.equal(paint.objectId, "ball");
    assert.ok(paint.pointsM.length > 5, `${paint.pointsM.length} stroke points`);
    assert.deepEqual(paint.pointsM[0], start, "the stroke starts at the object");
    for (const point of paint.pointsM)
      assert.ok(Math.abs(distance(point, r.camera()) - 2.9) < 1e-6, `[${point}] at 2.9 m`);
    for (let index = 1; index < paint.pointsM.length; index++)
      assert.ok(distance(paint.pointsM[index]!, paint.pointsM[index - 1]!) >= 0.05);
  } finally {
    r.dispose();
  }
});

test("the wheel moves the brush within 0.75 to 3 m; presses and keys never grab while painting", async () => {
  const r = await frozenRoom();
  try {
    r.host.beginPaint("ball", r.ahead(2.9));
    r.host.handleWheel(500);
    assert.equal(r.host.snapshot().paint!.distanceM, 3);
    for (let index = 0; index < 20; index++) r.host.handleWheel(-500);
    assert.equal(r.host.snapshot().paint!.distanceM, 0.75);

    assert.equal(r.host.snapshot().hover?.objectId, "ball", "the crosshair is on the ball");
    r.host.handlePointer(0, true);
    r.host.handleKey("KeyE", true);
    assert.equal(r.world.heldObjectId, null, "neither the press nor E grabs");
    assert.equal(r.host.painting, true, "the stroke continues");
    r.host.handlePointer(0, false);
    r.host.handleKey("KeyE", false);

    const stroke = r.host.endPaint();
    assert.deepEqual(stroke, [r.ahead(2.9)], "no look: the stroke is its start");
    assert.equal(r.host.painting, false);
    assert.equal(r.host.snapshot().paint, null);
    assert.equal(r.world.paused, true, "the room stays frozen after the stroke");
  } finally {
    r.dispose();
  }
});

test("a surface closer than the brush keeps the stroke on it, clear by the radius plus 1 cm", async () => {
  const r = await frozenRoom([leftWall]);
  try {
    const start = r.ahead(2);
    r.host.beginPaint("ball", start);
    // Turn left in small steps until the crosshair faces the wall.
    for (let index = 0; index < 20; index++) r.host.handleLook(-40, 0);
    const points = r.host.snapshot().paint!.pointsM;
    const clear = -0.9 + 0.2 + 0.01;
    const onWall = points.filter((point) => distance(point, r.camera()) < 2 - 1e-6);
    assert.ok(onWall.length > 3, `${onWall.length} points met the wall`);
    for (const point of onWall) assert.ok(Math.abs(point[0] - clear) < 1e-6, `[${point}]`);
    for (const point of points) assert.ok(point[0] > -0.9, `[${point}] went through the wall`);
    // The saved curve turns onto the wall without bulging past the brush's clearance.
    const curve = storedCurve(start, r.host.endPaint());
    for (const point of curve)
      assert.ok(point[0] >= clear - 1e-6, `[${point}] bulges into the wall`);
    assert.equal(r.world.firstFixedHitAlong("ball", curve, [0, 0, 0, 1]), null);
  } finally {
    r.dispose();
  }
});

test("a brush short of a wall but within the radius of it stays clear, so the stroke is not blocked", async () => {
  const r = await frozenRoom([backWall]);
  try {
    const face = 0.7,
      clear = 0.2 + 0.01;
    assert.ok(Math.abs(r.camera()[2] - face - 2.3) < 0.01, "the wall face is 2.3 m ahead");
    const start = r.ahead(2);
    r.host.beginPaint("ball", start);
    // 2.2 m: short of the wall, but a 0.2 m ball there would reach 10 cm into it.
    r.host.handleWheel(100);
    assert.ok(Math.abs(r.host.snapshot().paint!.distanceM - 2.2) < 1e-9);
    // Sweep along the wall, right then left, within 0.24 rad of straight ahead.
    for (const movementX of [40, 40, 40, -40, -40, -40, -40, -40, -40])
      r.host.handleLook(movementX, 0);
    const stroke = r.host.snapshot().paint!.pointsM;
    assert.ok(stroke.length > 5, `${stroke.length} stroke points`);
    for (const point of stroke.slice(1))
      assert.ok(point[2] - face >= clear - 1e-6, `[${point}] is within ${clear} m of the wall`);
    const curve = storedCurve(start, r.host.endPaint());
    for (const point of curve)
      assert.ok(point[2] - face >= clear - 1e-6, `[${point}] bulges toward the wall`);
    assert.equal(
      r.world.firstFixedHitAlong("ball", curve, [0, 0, 0, 1]),
      null,
      "the saved path does not meet the wall",
    );
  } finally {
    r.dispose();
  }
});

test("a stroke sweeping along a side wall at a grazing angle slides along it, clear and unblocked", async () => {
  const r = await frozenRoom([leftWall]);
  try {
    const clear = 0.2 + 0.01;
    const start = r.ahead(2);
    r.host.beginPaint("ball", start);
    // Turn slowly toward the wall: the brush meets it at a grazing angle before its ray does.
    for (let index = 0; index < 20; index++) r.host.handleLook(-10, 0);
    const stroke = r.host.snapshot().paint!.pointsM;
    assert.ok(stroke.length > 5, `${stroke.length} stroke points`);
    for (const point of stroke)
      assert.ok(point[0] + 0.9 >= clear - 1e-6, `[${point}] is within ${clear} m of the wall`);
    const curve = storedCurve(start, r.host.endPaint());
    assert.equal(r.world.firstFixedHitAlong("ball", curve, [0, 0, 0, 1]), null);
  } finally {
    r.dispose();
  }
});

test("a brush aimed into a corner stays clear of both walls", async () => {
  const r = await frozenRoom([leftWall, backWall]);
  try {
    const clear = 0.2 + 0.01;
    const start = r.ahead(2);
    r.host.beginPaint("ball", start);
    r.host.handleWheel(100);
    r.host.handleWheel(100);
    // The corner of the left face x = -0.9 and the back face z = 0.7, about 0.37 rad left.
    r.host.handleLook(-187, 0);
    const stroke = r.host.snapshot().paint!.pointsM;
    assert.equal(stroke.length, 2, "one brush point in the corner");
    const corner = stroke[1]!;
    assert.ok(corner[0] + 0.9 >= clear - 1e-6, `[${corner}] is within ${clear} m of the left wall`);
    assert.ok(corner[2] - 0.7 >= clear - 1e-6, `[${corner}] is within ${clear} m of the back wall`);
    const curve = storedCurve(start, r.host.endPaint());
    assert.equal(r.world.firstFixedHitAlong("ball", curve, [0, 0, 0, 1]), null);
  } finally {
    r.dispose();
  }
});

test("a sweep that slides along a side wall and on into the corner is saved clear of both walls", async () => {
  const r = await frozenRoom([leftWall, backWall]);
  try {
    const clear = 0.2 + 0.01;
    const start = r.ahead(2);
    r.host.beginPaint("ball", start);
    r.host.handleWheel(100);
    r.host.handleWheel(100);
    // Turn left past the corner: the brush runs along the back wall, then the left wall.
    for (let index = 0; index < 40; index++) r.host.handleLook(-12, 0);
    const stroke = r.host.snapshot().paint!.pointsM;
    for (const point of stroke.slice(1)) {
      assert.ok(point[0] + 0.9 >= clear - 1e-6, `[${point}] is within ${clear} m of the left wall`);
      assert.ok(point[2] - 0.7 >= clear - 1e-6, `[${point}] is within ${clear} m of the back wall`);
    }
    const curve = storedCurve(start, r.host.endPaint());
    for (const point of curve) {
      assert.ok(point[0] + 0.9 >= clear - 1e-6, `[${point}] bulges into the left wall`);
      assert.ok(point[2] - 0.7 >= clear - 1e-6, `[${point}] bulges into the back wall`);
    }
    assert.equal(r.world.firstFixedHitAlong("ball", curve, [0, 0, 0, 1]), null);
  } finally {
    r.dispose();
  }
});

test("losing the lock, pausing or leaving first person cancels a stroke", async () => {
  for (const loss of ["lock", "pause", "exit", "resume"] as const) {
    const r = await frozenRoom();
    try {
      r.host.beginPaint("ball", r.ahead(2));
      r.host.handleLook(40, 0);
      if (loss === "lock") r.host.confirmPointerLock(false);
      else if (loss === "pause") r.host.suspend("blur");
      else if (loss === "exit") r.host.exitFPS();
      else assert.equal(r.host.resume(), true);
      assert.equal(r.host.painting, false, loss);
      assert.equal(r.host.snapshot().paint, null, loss);
      assert.deepEqual(r.host.endPaint(), [], `${loss}: nothing is left to save`);
    } finally {
      r.dispose();
    }
  }
});

test("stroke offsets drop jitter from the start, keep the end and fit 63 offsets", () => {
  const start: Vec3 = [1, 2, 3];
  const at = (x: number, y = 0, z = 0): Vec3 => [start[0] + x, start[1] + y, start[2] + z];
  assert.deepEqual(strokeOffsets(start, []), [], "an empty stroke saves nothing");
  assert.deepEqual(
    strokeOffsets(start, [at(0), at(0.01), at(0.04, 0.02), at(-0.03)]),
    [],
    "a brush that never left the start saves nothing",
  );
  const jitter = strokeOffsets(start, [at(0.03), at(0.06), at(0.07), at(0.13), at(0.2)]);
  assert.equal(jitter.length, 2, "jitter is dropped and the straight middle simplified away");
  assert.ok(distance(jitter[0]!, [0.06, 0, 0]) < 1e-9, "the first point that left the start");
  assert.ok(distance(jitter[1]!, [0.2, 0, 0]) < 1e-9, "the end of the stroke");

  // A spiral of 600 points, 6 cm apart: far more than the path can hold.
  const spiral: Vec3[] = Array.from({ length: 600 }, (_, index) => {
    const angle = index * 0.06;
    return at(Math.cos(angle) - 1, index * 0.002, Math.sin(angle));
  });
  const offsets = strokeOffsets(start, spiral);
  assert.ok(offsets.length > 10 && offsets.length <= 63, `${offsets.length} offsets`);
  assert.ok(
    distance(
      offsets.at(-1)!,
      spiral.at(-1)!.map((v, i) => v - start[i]!),
    ) < 1e-9,
  );
  const world = [start, ...offsets.map((o) => at(o[0], o[1], o[2]))];
  for (let index = 1; index < world.length; index++)
    assert.ok(distance(world[index]!, world[index - 1]!) > 0.04, "no zero or duplicate offsets");
});
