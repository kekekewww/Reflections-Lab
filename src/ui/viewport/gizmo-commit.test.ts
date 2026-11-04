import assert from "node:assert/strict";
import test from "node:test";
import { gizmoDragPatch, MIN_GIZMO_DIMENSION_M, type GizmoStart } from "./gizmo-commit.js";

const start: GizmoStart = {
  shape: "box",
  positionM: [1, 2, 3],
  orientationQuaternion: [0, 0, 0, 1],
  dimensionsM: [2, 1, 0.5],
};
const base = { positionM: start.positionM, orientationQuaternion: start.orientationQuaternion };

test("translate emits only positionM and ignores a zero-length drag", () => {
  assert.deepEqual(
    gizmoDragPatch("translate", start, { ...base, positionM: [4, 2, 3], scale: [1, 1, 1] }),
    { positionM: [4, 2, 3] },
  );
  assert.equal(gizmoDragPatch("translate", start, { ...base, scale: [1, 1, 1] }), null);
});

test("scale multiplies original dimensions and clamps to the minimum", () => {
  assert.deepEqual(gizmoDragPatch("scale", start, { ...base, scale: [2, 1, 1] }), {
    dimensionsM: [4, 1, 0.5],
  });
  const tiny = gizmoDragPatch("scale", start, { ...base, scale: [0.001, 1, 0.001] });
  assert.deepEqual(tiny, { dimensionsM: [MIN_GIZMO_DIMENSION_M, 1, MIN_GIZMO_DIMENSION_M] });
  assert.equal(gizmoDragPatch("scale", start, { ...base, scale: [1, 1, 1] }), null);
});

test("sphere and capsule scaling keeps shapes the scene validator accepts", () => {
  const sphere: GizmoStart = { ...start, shape: "sphere", dimensionsM: [0.5, 0.5, 0.5] };
  assert.deepEqual(gizmoDragPatch("scale", sphere, { ...base, scale: [2, 1, 1] }), {
    dimensionsM: [1, 1, 1],
  });
  const capsule: GizmoStart = { ...start, shape: "capsule", dimensionsM: [0.4, 1.2, 0.4] };
  assert.deepEqual(gizmoDragPatch("scale", capsule, { ...base, scale: [1, 0.1, 1.5] }), {
    dimensionsM: [0.6000000000000001, 0.6000000000000001, 0.6000000000000001],
  });
});

test("rotate normalizes, treats q and -q as unchanged, rejects non-finite", () => {
  const s = Math.SQRT1_2;
  const patch = gizmoDragPatch("rotate", start, {
    ...base,
    orientationQuaternion: [s * 2, 0, 0, s * 2],
    scale: [1, 1, 1],
  });
  assert.ok(patch && "orientationQuaternion" in patch);
  assert.ok(Math.abs(patch.orientationQuaternion[0] - s) < 1e-9);
  assert.equal(
    gizmoDragPatch("rotate", start, {
      ...base,
      orientationQuaternion: [0, 0, 0, -1],
      scale: [1, 1, 1],
    }),
    null,
  );
  assert.equal(
    gizmoDragPatch("rotate", start, {
      ...base,
      orientationQuaternion: [NaN, 0, 0, 1],
      scale: [1, 1, 1],
    }),
    null,
  );
  assert.equal(
    gizmoDragPatch("translate", start, { ...base, positionM: [Infinity, 0, 0], scale: [1, 1, 1] }),
    null,
  );
});
