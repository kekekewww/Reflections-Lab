import assert from "node:assert/strict";
import test from "node:test";
import type { AcousticBoxOccluder, Vec3 } from "../../src/acoustics/types.js";
import {
  boxOccluderSegmentIntersection,
  boxOccluderSegmentInterval,
} from "../../src/acoustics/box-volume.js";

const box = (patch: Partial<AcousticBoxOccluder> = {}): AcousticBoxOccluder => ({
  id: "occluder",
  materialId: "mat",
  centerM: [0, 0, 0],
  halfExtentsM: [1, 1, 1],
  orientationQuaternion: [0, 0, 0, 1],
  ...patch,
});
function close(actual: number, expected: number, tolerance = 2e-10): void {
  assert.ok(Number.isFinite(actual));
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    String(actual) + " != " + String(expected) + " +/- " + tolerance,
  );
}
function point(actual: Vec3, expected: Vec3, tolerance = 2e-10): void {
  actual.forEach((value, index) => close(value, expected[index]!, tolerance));
}
const add = (a: Vec3, b: Vec3): [number, number, number] => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (v: Vec3, scalar: number): [number, number, number] => [
  v[0] * scalar,
  v[1] * scalar,
  v[2] * scalar,
];

test("OBB three-slab interval exactly handles axial rays and parallel misses", () => {
  const result = boxOccluderSegmentInterval([-3, 0, 0], [3, 0, 0], box())!;
  close(result.enterT, 1 / 3);
  close(result.exitT, 2 / 3);
  point(boxOccluderSegmentIntersection([-3, 0, 0], [3, 0, 0], box())!, [-1, 0, 0]);
  point(boxOccluderSegmentIntersection([0, -3, 0], [0, 3, 0], box())!, [0, -1, 0]);
  point(boxOccluderSegmentIntersection([0, 0, 3], [0, 0, -3], box())!, [0, 0, 1]);
  assert.equal(boxOccluderSegmentIntersection([-3, 2, 0], [3, 2, 0], box()), null);
  assert.equal(boxOccluderSegmentIntersection([2, -3, 0], [2, 3, 0], box()), null);
});

test("45 and 90 degree OBBs use the inverse quaternion rather than a world AABB", () => {
  const rotated45 = box({
    halfExtentsM: [2, 1, 0.5],
    orientationQuaternion: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)],
  });
  point(boxOccluderSegmentIntersection([-4, 0, 0], [4, 0, 0], rotated45)!, [-Math.SQRT2, 0, 0]);
  const axis: Vec3 = [Math.SQRT1_2, Math.SQRT1_2, 0];
  point(boxOccluderSegmentIntersection(mul(axis, -4), mul(axis, 4), rotated45)!, mul(axis, -2));
  const rotated90 = box({
    halfExtentsM: [2, 1, 0.5],
    orientationQuaternion: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
  });
  point(boxOccluderSegmentIntersection([-4, 0, 0], [4, 0, 0], rotated90)!, [-1, 0, 0]);
});

test("arbitrary three-dimensional orientation and translation recover a known local face", () => {
  const k = Math.sin(0.35) / Math.sqrt(14);
  const x = k,
    y = 2 * k,
    z = 3 * k,
    w = Math.cos(0.35);
  // Independent quaternion-to-matrix first column: local X expressed in world coordinates.
  const normal: Vec3 = [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)];
  const center: Vec3 = [3, -2, 1];
  const shape = box({
    centerM: center,
    halfExtentsM: [2, 0.6, 0.25],
    orientationQuaternion: [x, y, z, w],
  });
  point(
    boxOccluderSegmentIntersection(
      add(center, mul(normal, -4)),
      add(center, mul(normal, 4)),
      shape,
    )!,
    add(center, mul(normal, -2)),
  );
  const almostUnit = box({
    ...shape,
    orientationQuaternion: [x * (1 + 5e-7), y * (1 + 5e-7), z * (1 + 5e-7), w * (1 + 5e-7)],
  });
  point(
    boxOccluderSegmentIntersection(
      add(center, mul(normal, -4)),
      add(center, mul(normal, 4)),
      almostUnit,
    )!,
    add(center, mul(normal, -2)),
  );
});

test("closed face/corner tangencies count while actual endpoint-only contacts are excluded", () => {
  point(boxOccluderSegmentIntersection([-3, 1, 0], [3, 1, 0], box())!, [-1, 1, 0]);
  point(boxOccluderSegmentIntersection([-3, 5, 0], [5, -3, 0], box())!, [1, 1, 0]);
  assert.equal(boxOccluderSegmentIntersection([-3, 1.00001, 0], [3, 1.00001, 0], box()), null);
  assert.equal(boxOccluderSegmentIntersection([2, 0, 0], [1, 0, 0], box()), null);
  assert.equal(boxOccluderSegmentIntersection([1, 0, 0], [2, 0, 0], box()), null);
  assert.equal(boxOccluderSegmentIntersection([1, 1, 0], [2, 0, 0], box()), null);
});

test("interior endpoints fail closed and zero/short segments have no open interior", () => {
  const result = boxOccluderSegmentInterval([0, 0, 0], [0.5, 0.5, 0], box())!;
  assert.deepEqual(result, { enterT: 0, exitT: 1 });
  const hit = boxOccluderSegmentIntersection([0, 0, 0], [0.5, 0.5, 0], box())!;
  assert.ok(hit[0] > 0 && hit[0] < 0.5);
  assert.ok(boxOccluderSegmentIntersection([0, 0, 0], [2, 0, 0], box()));
  assert.equal(boxOccluderSegmentIntersection([0, 0, 0], [0, 0, 0], box()), null);
  assert.equal(boxOccluderSegmentIntersection([0, 0, 0], [1.5e-7, 0, 0], box()), null);
});

test("small and large finite extents preserve analytical entry positions", () => {
  point(
    boxOccluderSegmentIntersection(
      [-0.01, 0, 0],
      [0.01, 0, 0],
      box({ halfExtentsM: [1e-4, 3e-4, 2e-4] }),
    )!,
    [-1e-4, 0, 0],
    1e-12,
  );
  point(
    boxOccluderSegmentIntersection(
      [20, -100, 50],
      [180, -100, 50],
      box({ centerM: [100, -100, 50], halfExtentsM: [50, 25, 10] }),
    )!,
    [50, -100, 50],
  );
});

test("invalid, sparse and nonunit geometry rejects explicitly before slab work", () => {
  const malformed = [
    box({ centerM: [NaN, 0, 0] }),
    box({ halfExtentsM: [0, 1, 1] }),
    box({ halfExtentsM: [-1, 1, 1] }),
    box({ halfExtentsM: [Infinity, 1, 1] }),
    box({ halfExtentsM: new Array(3) as unknown as Vec3 }),
    box({ orientationQuaternion: [0, 0, 0, 0] }),
    box({ orientationQuaternion: [0, 0, 0, 2] }),
    box({ orientationQuaternion: [0, NaN, 0, 1] }),
    box({
      orientationQuaternion: new Array(
        4,
      ) as unknown as AcousticBoxOccluder["orientationQuaternion"],
    }),
  ];
  for (const shape of malformed) {
    assert.throws(() => boxOccluderSegmentInterval([-3, 0, 0], [3, 0, 0], shape), RangeError);
    assert.throws(() => boxOccluderSegmentIntersection([-3, 0, 0], [3, 0, 0], shape), RangeError);
  }
  assert.throws(
    () => boxOccluderSegmentIntersection(new Array(3) as unknown as Vec3, [3, 0, 0], box()),
    RangeError,
  );
});
