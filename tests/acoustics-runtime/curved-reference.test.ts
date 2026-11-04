import assert from "node:assert/strict";
import test from "node:test";
import { solveAcoustics } from "../../src/acoustics/solver.js";
import {
  primitiveReflectionPoint,
  primitiveSegmentIntersection,
} from "../../src/acoustics/primitives.js";
import type {
  AcousticMaterial,
  AcousticPrimitive,
  AcousticRequest,
  Vec3,
} from "../../src/acoustics/types.js";

// Independent V1 geometric references. Expected surface points are constructed
// from the reflection law, never returned by a product geometry helper.
type V = [number, number, number];
const add = (a: Vec3, b: Vec3): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const normalized = (a: Vec3): V => mul(a, 1 / norm(a));
const distance = (a: Vec3, b: Vec3): number => norm(sub(a, b));
const pointToleranceM = 2e-7;
const near = (actual: number, expected: number, tolerance: number, label: string): void => {
  assert.ok(Number.isFinite(actual), label + " must be finite");
  assert.ok(Math.abs(actual - expected) <= tolerance, label + ": " + actual + " vs " + expected);
};
const pointNear = (actual: Vec3, expected: Vec3, label: string): void =>
  near(distance(actual, expected), 0, pointToleranceM, label);

const sphere = (
  id = "reference-sphere",
  centerM: Vec3 = [0, 0, 0],
  radiusM = 1,
): AcousticPrimitive => ({
  id,
  kind: "sphere",
  centerM,
  radiusM,
  materialId: "reference-material",
  role: "staticReflector",
});
const capsule = (
  id = "reference-capsule",
  centerM: Vec3 = [0, 0, 0],
  radiusM = 0.5,
  halfLengthM = 1,
  axis: Vec3 = [0, 1, 0],
): AcousticPrimitive => ({
  id,
  kind: "capsule",
  centerM,
  radiusM,
  halfLengthM,
  axis,
  materialId: "reference-material",
  role: "staticReflector",
});

function fromReflectionLaw(
  point: Vec3,
  normal: Vec3,
  tangent: Vec3,
  angleRad: number,
  sourceDistanceM = 2.3,
  listenerDistanceM = 4.7,
): { source: V; listener: V; pathLengthM: number } {
  // Both rays point outward from P. Their tangential components are opposite.
  const outward = mul(normal, Math.cos(angleRad));
  const transverse = mul(tangent, Math.sin(angleRad));
  return {
    source: add(point, mul(add(outward, transverse), sourceDistanceM)),
    listener: add(point, mul(sub(outward, transverse), listenerDistanceM)),
    pathLengthM: sourceDistanceM + listenerDistanceM,
  };
}

function checkConstructedPoint(
  primitive: AcousticPrimitive,
  expectedPoint: Vec3,
  expectedNormal: Vec3,
  tangent: Vec3,
  angleRad: number,
): void {
  near(norm(expectedNormal), 1, 1e-12, "fixture unit normal");
  near(norm(tangent), 1, 1e-12, "fixture unit tangent");
  near(dot(expectedNormal, tangent), 0, 1e-12, "fixture tangent perpendicular");
  const fixture = fromReflectionLaw(expectedPoint, expectedNormal, tangent, angleRad);
  const result = primitiveReflectionPoint(fixture.source, fixture.listener, primitive);
  assert.ok(result, "the analytically constructed outward reflection must exist");
  pointNear(result.point, expectedPoint, "constructed reflection point");
  pointNear(result.normal, expectedNormal, "outward normal");
  near(
    distance(fixture.source, result.point) + distance(result.point, fixture.listener),
    fixture.pathLengthM,
    4e-7,
    "known two-leg path length",
  );
  const toSource = normalized(sub(fixture.source, result.point));
  const toListener = normalized(sub(fixture.listener, result.point));
  near(dot(toSource, result.normal), Math.cos(angleRad), 2e-7, "incidence cosine");
  near(dot(toListener, result.normal), Math.cos(angleRad), 2e-7, "reflection cosine");
  pointNear(
    sub(toSource, mul(result.normal, dot(toSource, result.normal))),
    mul(sub(toListener, mul(result.normal, dot(toListener, result.normal))), -1),
    "opposite tangential ray components",
  );
  assert.ok(result.iterations >= 0 && result.iterations <= 144, "bounded primitive work");
}

// Value-only reference: uniformly inspect a complete normal circle, then use
// golden-section minimization of total distance. It does not use the product's
// visibility-arc derivative, bisection, or capsule decomposition.
function sphereValueReference(source: Vec3, listener: Vec3, primitive: AcousticPrimitive): V {
  const u = normalized(sub(source, primitive.centerM));
  const towardListener = sub(listener, primitive.centerM);
  const projected = sub(towardListener, mul(u, dot(towardListener, u)));
  const v = normalized(projected);
  const at = (theta: number): V =>
    add(
      primitive.centerM,
      mul(add(mul(u, Math.cos(theta)), mul(v, Math.sin(theta))), primitive.radiusM),
    );
  const cost = (theta: number): number => {
    const p = at(theta);
    const normal = normalized(sub(p, primitive.centerM));
    if (dot(sub(source, p), normal) <= 1e-9 || dot(sub(listener, p), normal) <= 1e-9)
      return Number.POSITIVE_INFINITY;
    return distance(source, p) + distance(listener, p);
  };
  const count = 32_768;
  const step = (2 * Math.PI) / count;
  let best = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const theta = -Math.PI + i * step;
    const value = cost(theta);
    if (value < bestCost) {
      bestCost = value;
      best = theta;
    }
  }
  assert.ok(Number.isFinite(bestCost), "independent full-circle scan found visible points");
  let left = best - step;
  let right = best + step;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let c = right - ratio * (right - left);
  let d = left + ratio * (right - left);
  let fc = cost(c);
  let fd = cost(d);
  for (let iteration = 0; iteration < 90; iteration++) {
    if (fc <= fd) {
      right = d;
      d = c;
      fd = fc;
      c = right - ratio * (right - left);
      fc = cost(c);
    } else {
      left = c;
      c = d;
      fc = fd;
      d = left + ratio * (right - left);
      fd = cost(d);
    }
  }
  return at((left + right) / 2);
}

test("CURVE-REF-01: constructed sphere reflections satisfy the reflection law at arbitrary normals", () => {
  const primitive = sphere("sphere-translated", [1.3, -0.7, 2.1], 0.8);
  for (const normal of [
    [1, 2, 3],
    [-2, 1, 0.3],
    [0.2, -3, 1],
  ] as const) {
    const n = normalized(normal);
    const t = normalized(cross(n, [0.3, 0.4, 0.9]));
    const p = add(primitive.centerM, mul(n, primitive.radiusM));
    for (const angle of [0, 0.43, 1.1, (89 * Math.PI) / 180])
      checkConstructedPoint(primitive, p, n, t, angle);
  }
});

test("CURVE-REF-02: full-circle value-only optimization agrees with general asymmetric sphere points", () => {
  const primitive = sphere("sphere-general", [-0.4, 0.7, 1.2], 0.65);
  for (const [sourceOffset, listenerOffset] of [
    [
      [2.1, 1.7, 0.4],
      [-1.1, 3.2, 0.7],
    ],
    [
      [4.2, 0.8, -1.3],
      [1.2, 2.7, 3.4],
    ],
    [
      [0.72, 0.01, 0],
      [0.1, 7, 0.2],
    ],
    [
      [-2, 1.5, 1.4],
      [-3.1, -0.4, 2.7],
    ],
  ] as const) {
    const source = add(primitive.centerM, sourceOffset);
    const listener = add(primitive.centerM, listenerOffset);
    const expected = sphereValueReference(source, listener, primitive);
    const actual = primitiveReflectionPoint(source, listener, primitive);
    assert.ok(actual, "visible reference minimum must produce a reflection");
    // Value-only minimization loses digits near a flat minimum. 2e-6 m is a
    // declared independent-oracle bound, separate from the 2e-7 m exact fixtures.
    near(distance(actual.point, expected), 0, 2e-6, "independent value-only sphere point");
  }
});

test("CURVE-REF-03: rotated capsule side/caps/seams match exact constructed points", () => {
  const axis = normalized([1, 2, -1]);
  const u = normalized(cross(axis, [0, 0, 1]));
  const v = cross(axis, u);
  const primitive = capsule("capsule-rotated", [1.2, -0.4, 0.6], 0.45, 0.9, axis);
  for (const z of [-0.9, -0.899999, -0.2, 0.899999, 0.9]) {
    const n = normalized(add(mul(u, 0.6), mul(v, 0.8)));
    const p = add(add(primitive.centerM, mul(axis, z)), mul(n, primitive.radiusM));
    const tangent = normalized(add(mul(axis, 0.7), mul(cross(axis, n), 0.3)));
    checkConstructedPoint(primitive, p, n, tangent, 0.64);
  }
  for (const sign of [-1, 1]) {
    for (const beta of [0, 0.37, Math.PI / 2 - 1e-6]) {
      const n = add(mul(axis, sign * Math.cos(beta)), mul(u, Math.sin(beta)));
      const center = add(primitive.centerM, mul(axis, sign * 0.9));
      const p = add(center, mul(n, primitive.radiusM));
      const tangent = normalized(cross(n, v));
      for (const angle of [0, 0.13, 0.73]) checkConstructedPoint(primitive, p, n, tangent, angle);
    }
  }
});

test("CURVE-REF-04: zero-length capsule is geometrically equivalent to its sphere", () => {
  const s = sphere("equivalent-sphere", [0.3, 0.4, 0.5], 0.7);
  const c = capsule("equivalent-capsule", s.centerM, s.radiusM, 0, normalized([1, 1, 1]));
  const source: V = [2, 3, 1];
  const listener: V = [-1, 2, 2];
  const a = primitiveReflectionPoint(source, listener, s);
  const b = primitiveReflectionPoint(source, listener, c);
  assert.ok(a && b);
  pointNear(a.point, b.point, "degenerate capsule/sphere point");
  pointNear(a.normal, b.normal, "degenerate capsule/sphere normal");
});

test("CURVE-REF-05: collinear, opposite-side, internal, and exact grazing domains are explicit", () => {
  const primitive = sphere();
  const sameSide = primitiveReflectionPoint([2, 0, 0], [5, 0, 0], primitive);
  assert.ok(sameSide);
  pointNear(sameSide.point, [1, 0, 0], "collinear near sphere point");
  assert.equal(primitiveReflectionPoint([-2, 0, 0], [2, 0, 0], primitive), null);
  assert.equal(primitiveReflectionPoint([0, 0, 0], [2, 1, 0], primitive), null);
  assert.equal(primitiveReflectionPoint([1, 0, 0], [2, 1, 0], primitive), null);
  assert.equal(primitiveReflectionPoint([-2, 1, 0], [2, 1, 0], primitive), null);
  const capsuleShape = capsule();
  assert.equal(primitiveReflectionPoint([0, 0, 0], [2, 3, 0], capsuleShape), null);
  assert.equal(primitiveReflectionPoint([0, 1.4, 0], [2, 3, 0], capsuleShape), null);
  assert.equal(primitiveReflectionPoint([0.5, 1, 0], [2, 3, 0], capsuleShape), null);
  assert.equal(primitiveReflectionPoint([0, 3, 0], [0, -3, 0], capsuleShape), null);
});

test("CURVE-REF-06: primitive visibility handles open endpoints, opaque interior, and capsule endcaps", () => {
  const s = sphere();
  assert.equal(primitiveSegmentIntersection([1, 0, 0], [3, 0, 0], s), null);
  const through = primitiveSegmentIntersection([-2, 0, 0], [2, 0, 0], s);
  assert.ok(through);
  assert.ok(through[0] > -2 && through[0] < 2);
  assert.ok(primitiveSegmentIntersection([0, 0, 0], [0.2, 0, 0], s));
  assert.equal(primitiveSegmentIntersection([-2, 1.1, 0], [2, 1.1, 0], s), null);
  const tangentHit = primitiveSegmentIntersection([-2, 1, 0], [2, 1, 0], s);
  assert.ok(tangentHit, "closed opaque tangent is conservatively a hit");
  pointNear(tangentHit, [0, 1, 0], "tangent boundary point");
  assert.equal(primitiveSegmentIntersection([0, 1, 0], [2, 1, 0], s), null);
  const c = capsule();
  const capHit = primitiveSegmentIntersection([0, 3, 0], [0, -3, 0], c);
  assert.ok(capHit);
  near(Math.abs(capHit[1]), 1.5, 2e-7, "capsule cap boundary");
  const sideHit = primitiveSegmentIntersection([-2, 0.3, 0], [2, 0.3, 0], c);
  assert.ok(sideHit);
  near(Math.abs(sideHit[0]), 0.5, 2e-7, "capsule side boundary");
});

const bands = [125, 250, 500, 1000, 2000, 4000, 8000];
const syntheticMaterial: AcousticMaterial = {
  schemaVersion: "1.0.0",
  id: "reference-material",
  revision: 0,
  label: "Original synthetic independent curved reference",
  dataClass: "Synthetic",
  sourceUrls: [],
  conditions: "Equal-medium magnitude-only synthetic fixture, no measured material claim",
  phaseModel: "zeroPhaseMagnitudeOnly",
  bands: bands.map((centerHz) => ({
    centerHz,
    absorptionEnergy: 0.36,
    reflectionEnergy: 0.64,
    transmissionEnergy: 0,
    scatteringFraction: 0.25,
  })),
};
const acousticRequest = (source: Vec3, listener: Vec3): AcousticRequest => ({
  requestId: "curved-independent-reference",
  sceneRevision: 1,
  geometryRevision: 1,
  poseTick: 1,
  topologyId: "reference-topology",
  source: { id: "reference-source", positionM: source },
  listener: { id: "reference-listener", positionM: listener },
  surfaces: [],
  materials: [syntheticMaterial],
  atmosphere: { medium: "air", speedOfSoundMps: 343 },
});

test("CURVE-REF-07: actual curved solver path has analytic length, delay, pressure and stable identity", () => {
  const primitive = sphere();
  const point: V = [0, 1, 0];
  const fixture = fromReflectionLaw(point, [0, 1, 0], [1, 0, 0], 0.6);
  const input = { ...acousticRequest(fixture.source, fixture.listener), primitives: [primitive] };
  const solved = solveAcoustics(input);
  const reflected = solved.frame.paths.filter((p) => p.order === 1);
  assert.equal(reflected.length, 1, "one convex specular reflection, no tessellation duplicates");
  const path = reflected[0]!;
  pointNear(path.verticesM[1]!, point, "actual solver reflection");
  near(path.lengthM, 7, 4e-7, "analytic 2.3+4.7 m");
  near(path.absoluteDelayS, 7 / 343, 2e-9, "absolute propagation delay once");
  near(path.bandGains[0]!, Math.sqrt(0.64 * 0.75) / 7, 2e-8, "pressure amplitude");
  const moved = solveAcoustics({
    ...input,
    poseTick: 2,
    source: { ...input.source, positionM: add(fixture.source, [0.001, 0, 0]) },
  }).frame.paths.find((p) => p.order === 1);
  assert.ok(moved);
  assert.equal(
    moved.id,
    path.id,
    "path identity excludes pose, rank, and numerical candidate index",
  );
  assert.equal(solved.metrics.rt60Seconds, null);
  assert.equal(solved.metrics.drrDb, null);
  assert.equal(solved.metrics.c50Db, null);
  assert.ok(
    solved.frame.limitations.some((text) => /curv|focus|diverg|caustic/i.test(text)),
    "curvature amplitude limits must be declared",
  );
});

test("CURVE-REF-08: moving planar reflector snapshots change geometry without changing path identity", () => {
  const request = acousticRequest([1, 1, 0], [5, 1, 0]);
  const input = (height: number, tick: number): AcousticRequest => ({
    ...request,
    poseTick: tick,
    surfaces: [
      {
        id: "moving-plane",
        materialId: syntheticMaterial.id,
        role: "dynamicReflector",
        normal: [0, 1, 0],
        verticesM: [
          [-10, height, -10],
          [-10, height, 10],
          [10, height, 10],
          [10, height, -10],
        ],
      },
    ],
  });
  const a = solveAcoustics(input(0, 1));
  const b = solveAcoustics(input(0.5, 2));
  const pa = a.frame.paths.find((path) => path.order === 1);
  const pb = b.frame.paths.find((path) => path.order === 1);
  assert.ok(pa && pb);
  pointNear(pa.verticesM[1]!, [3, 0, 0], "first snapshot");
  pointNear(pb.verticesM[1]!, [3, 0.5, 0], "second snapshot");
  near(pa.lengthM, Math.sqrt(20), 1e-10, "first snapshot path length");
  near(pb.lengthM, Math.sqrt(17), 1e-10, "second snapshot path length");
  assert.equal(pa.id, pb.id);
  assert.ok(b.frame.limitations.some((text) => /quasi-static|retarded|Doppler/i.test(text)));
});

test("CURVE-REF-09: capsule seam produces one solver path and opaque snapshots cannot invent transmission", () => {
  const primitive = capsule();
  const p: V = [0.5, 1, 0];
  const n: V = [1, 0, 0];
  const tangent = normalized([0, 0.6, 0.8]);
  const fixture = fromReflectionLaw(p, n, tangent, 0.56);
  const seam = solveAcoustics({
    ...acousticRequest(fixture.source, fixture.listener),
    primitives: [primitive],
  });
  const paths = seam.frame.paths.filter((path) => path.order === 1);
  assert.equal(paths.length, 1, "shared cap/cylinder seam is not multiple physical reflections");
  pointNear(paths[0]!.verticesM[1]!, p, "seam solver point");
  const blocked = solveAcoustics({
    ...acousticRequest([-2, 0, 0], [2, 0, 0]),
    primitives: [{ ...primitive, role: "dynamicOccluder" }],
  });
  assert.equal(blocked.diagnostics.directOccluded, true);
  assert.equal(
    blocked.frame.paths.length,
    0,
    "opaque analytic shape does not fabricate a through path",
  );
  assert.ok(blocked.frame.limitations.some((text) => /no solid transmission/i.test(text)));
});
