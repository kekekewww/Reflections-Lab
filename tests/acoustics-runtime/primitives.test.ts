import test from "node:test";
import assert from "node:assert/strict";
import type { AcousticPrimitive, Vec3 } from "../../src/acoustics/types.js";
import {
  MAX_PRIMITIVE_REFLECTION_ITERATIONS,
  primitiveReflectionPoint,
  primitiveSegmentIntersection,
  primitiveSegmentInterval,
} from "../../src/acoustics/primitives.js";

const sphere = (patch: Partial<AcousticPrimitive> = {}): AcousticPrimitive => ({
  id: "sphere",
  materialId: "mat",
  kind: "sphere",
  centerM: [0, 0, 0],
  radiusM: 1,
  ...patch,
});
const capsule = (patch: Partial<AcousticPrimitive> = {}): AcousticPrimitive => ({
  ...sphere(),
  id: "capsule",
  kind: "capsule",
  axis: [0, 1, 0],
  halfLengthM: 1,
  ...patch,
});
const add = (a: Vec3, b: Vec3): [number, number, number] => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): [number, number, number] => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec3): [number, number, number] => mul(a, 1 / Math.hypot(...a));
function close(actual: number, expected: number, tolerance = 2e-10): void {
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) <= tolerance, String(actual) + " != " + String(expected));
}
function vector(actual: Vec3, expected: Vec3, tolerance = 2e-10): void {
  actual.forEach((item, i) => close(item, expected[i]!, tolerance));
}
/** Independently construct endpoints whose equal-angle rays meet a prescribed outward normal. */
function exactEndpoints(point: Vec3, normal: Vec3, tangent: Vec3, angle: number) {
  return {
    source: add(point, mul(add(mul(normal, Math.cos(angle)), mul(tangent, Math.sin(angle))), 2.3)),
    listener: add(
      point,
      mul(add(mul(normal, Math.cos(angle)), mul(tangent, -Math.sin(angle))), 5.7),
    ),
  };
}
function equalAngle(point: Vec3, normal: Vec3, source: Vec3, listener: Vec3): void {
  const sourceRay = norm(add(source, mul(point, -1)));
  const listenerRay = norm(add(listener, mul(point, -1)));
  const sum = add(sourceRay, listenerRay);
  const projection = sum[0] * normal[0] + sum[1] * normal[1] + sum[2] * normal[2];
  vector(add(sum, mul(normal, -projection)), [0, 0, 0], 2e-9);
  close(Math.hypot(...normal), 1);
  assert.ok(projection > 0);
}

test("sphere analytic volume intersection, tangency and open-endpoint policy", () => {
  vector(primitiveSegmentIntersection([-2, 0, 0], [2, 0, 0], sphere())!, [-1, 0, 0]);
  const interval = primitiveSegmentInterval([-2, 0, 0], [2, 0, 0], sphere())!;
  close(interval.enterT, 0.25);
  close(interval.exitT, 0.75);
  assert.equal(primitiveSegmentIntersection([-2, 2, 0], [2, 2, 0], sphere()), null);
  vector(primitiveSegmentIntersection([1, -2, 0], [1, 2, 0], sphere())!, [1, 0, 0]);
  assert.equal(primitiveSegmentIntersection([2, 0, 0], [1, 0, 0], sphere()), null);
  assert.equal(primitiveSegmentIntersection([1, 0, 0], [2, 0, 0], sphere()), null);
  assert.equal(primitiveSegmentIntersection([1, 0, 0], [1, 2, 0], sphere()), null);
  assert.ok(primitiveSegmentIntersection([0, 0, 0], [0.5, 0, 0], sphere()));
  assert.ok(primitiveSegmentIntersection([0, 0, 0], [2, 0, 0], sphere()));
  assert.equal(primitiveSegmentIntersection([0, 0, 0], [0, 0, 0], sphere()), null);
  assert.equal(primitiveSegmentIntersection([0, 0, 0], [1.5e-7, 0, 0], sphere()), null);
});

test("capsule exact side/cap/axis intervals and zero-length-spine sphere equivalence", () => {
  vector(primitiveSegmentIntersection([-2, 0, 0], [2, 0, 0], capsule())!, [-1, 0, 0]);
  vector(primitiveSegmentIntersection([0, -3, 0], [0, 3, 0], capsule())!, [0, -2, 0]);
  vector(primitiveSegmentIntersection([-2, 1.5, 0], [2, 1.5, 0], capsule())!, [
    -Math.sqrt(0.75),
    1.5,
    0,
  ]);
  assert.equal(primitiveSegmentIntersection([-2, 2.1, 0], [2, 2.1, 0], capsule()), null);
  assert.ok(primitiveSegmentIntersection([0, -0.5, 0], [0, 0.5, 0], capsule()));
  vector(
    primitiveSegmentIntersection([-2, 0.5, 0], [2, 0.5, 0], capsule({ halfLengthM: 0 }))!,
    primitiveSegmentIntersection([-2, 0.5, 0], [2, 0.5, 0], sphere())!,
  );
  const axis = norm([1, 1, 0]);
  const across = norm([1, -1, 0]);
  const center: Vec3 = [3, 2, -1];
  vector(
    primitiveSegmentIntersection(
      add(center, mul(across, -3)),
      add(center, mul(across, 3)),
      capsule({ centerM: center, axis }),
    )!,
    add(center, mul(across, -1)),
  );
});

test("sphere equal-angle symmetry gives the independently known top point and length", () => {
  const source: Vec3 = [-2, 2, 0],
    listener: Vec3 = [2, 2, 0];
  const result = primitiveReflectionPoint(source, listener, sphere())!;
  assert.ok(result);
  vector(result.point, [0, 1, 0]);
  vector(result.normal, [0, 1, 0]);
  close(
    Math.hypot(result.point[0] + 2, result.point[1] - 2, result.point[2]) * 2,
    2 * Math.sqrt(5),
  );
  equalAngle(result.point, result.normal, source, listener);
  assert.ok(result.iterations <= 48);
});

test("sphere arbitrary plane, unequal source distances and near grazing preserve constructed specular point", () => {
  const center: Vec3 = [1, -2, 0.5],
    normal = norm([1, 2, 3]),
    tangent = norm([2, -1, 0]),
    radius = 0.75;
  const expected = add(center, mul(normal, radius));
  for (const angle of [0.1, 0.7, (Math.PI * 89) / 180]) {
    const { source, listener } = exactEndpoints(expected, normal, tangent, angle);
    const result = primitiveReflectionPoint(
      source,
      listener,
      sphere({ centerM: center, radiusM: radius }),
    );
    assert.ok(result);
    vector(result.point, expected, 3e-9);
    vector(result.normal, normal, 4e-9);
    equalAngle(result.point, result.normal, source, listener);
    assert.ok(result.iterations <= 48);
    assert.equal(
      primitiveSegmentIntersection(
        source,
        result.point,
        sphere({ centerM: center, radiusM: radius }),
      ),
      null,
    );
    assert.equal(
      primitiveSegmentIntersection(
        result.point,
        listener,
        sphere({ centerM: center, radiusM: radius }),
      ),
      null,
    );
  }
});

test("collinear source directions are stable; opposite visibility and inside/on endpoints reject", () => {
  const n = norm([1, 2, 3]);
  vector(primitiveReflectionPoint(mul(n, 2), mul(n, 4), sphere())!.point, n);
  assert.equal(primitiveReflectionPoint([2, 0, 0], [-2, 0, 0], sphere()), null);
  assert.equal(primitiveReflectionPoint([0, 0, 0], [2, 1, 0], sphere()), null);
  assert.equal(primitiveReflectionPoint([1, 0, 0], [2, 1, 0], sphere()), null);
});

test("capsule lateral solution recovers a prescribed point with both circumferential and axial directions", () => {
  const expected: Vec3 = [1, 0.2, 0],
    normal: Vec3 = [1, 0, 0],
    tangent = norm([0, 0.6, 0.8]);
  const { source, listener } = exactEndpoints(expected, normal, tangent, 0.5);
  const result = primitiveReflectionPoint(source, listener, capsule())!;
  assert.ok(result);
  vector(result.point, expected);
  vector(result.normal, normal);
  equalAngle(result.point, result.normal, source, listener);
  assert.ok(result.iterations <= MAX_PRIMITIVE_REFLECTION_ITERATIONS);
});

test("rotated capsule hemispheres and seams retain valid normals and unique geometric position", () => {
  const axis = norm([1, 1, 0]),
    across = norm([1, -1, 0]),
    tangent: Vec3 = [0, 0, 1],
    center: Vec3 = [0.5, 2, -1];
  for (const side of [-1, 1]) {
    for (const axialNormal of [0, 1e-6, 0.6]) {
      const normal = add(
        mul(axis, side * axialNormal),
        mul(across, Math.sqrt(1 - axialNormal * axialNormal)),
      );
      const expected = add(add(center, mul(axis, side)), normal);
      const { source, listener } = exactEndpoints(expected, normal, tangent, 0.4);
      const result = primitiveReflectionPoint(
        source,
        listener,
        capsule({ axis, centerM: center }),
      )!;
      assert.ok(result);
      vector(result.point, expected, 3e-9);
      equalAngle(result.point, result.normal, source, listener);
      assert.ok(result.iterations <= MAX_PRIMITIVE_REFLECTION_ITERATIONS);
    }
  }
  const { source, listener } = exactEndpoints([0, 1, 0], [0, 1, 0], [1, 0, 0], 0.3);
  vector(
    primitiveReflectionPoint(source, listener, capsule({ halfLengthM: 0 }))!.point,
    primitiveReflectionPoint(source, listener, sphere())!.point,
  );
});

test("malformed finite geometry rejects sparse, NaN and nonunit/zero axes without nonfinite output", () => {
  const invalid: AcousticPrimitive[] = [
    sphere({ radiusM: 0 }),
    sphere({ radiusM: NaN }),
    sphere({ centerM: [NaN, 0, 0] }),
    sphere({ centerM: new Array(3) as unknown as Vec3 }),
    capsule({ axis: [0, 0, 0] }),
    capsule({ axis: [0, 2, 0] }),
    capsule({ halfLengthM: -1 }),
  ];
  for (const primitive of invalid) {
    assert.throws(() => primitiveSegmentIntersection([-3, 2, 0], [3, 2, 0], primitive), RangeError);
    assert.throws(() => primitiveReflectionPoint([-3, 2, 0], [3, 2, 0], primitive), RangeError);
  }
  assert.throws(
    () => primitiveSegmentIntersection([Infinity, 0, 0], [2, 0, 0], sphere()),
    RangeError,
  );
});
