import assert from "node:assert/strict";
import test from "node:test";
import type { ObjectTrajectory, Vector3 } from "../../src/scene/types.js";
import {
  controlPoints,
  curvePoints,
  poseAt,
  simplifyStroke,
  timePath,
} from "../../src/motion/trajectory-path.js";

const dist = (a: Vector3, b: Vector3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const trajectory = (patch: Partial<ObjectTrajectory> = {}): ObjectTrajectory => ({
  offsetsM: [[2, 0, 0]],
  strengthMps: 4,
  startDelayS: 1,
  faceAlongPath: false,
  ...patch,
});
const close = (a: Vector3, b: Vector3, tol = 1e-6): void => {
  assert.ok(dist(a, b) <= tol, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
};
const rotate = (q: number[], v: Vector3): Vector3 => {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
};

test("controlPoints prepends the start and adds offsets", () => {
  assert.deepEqual(
    controlPoints(
      [1, 1, 1],
      trajectory({
        offsetsM: [
          [1, 0, 0],
          [0, 2, 0],
        ],
      }),
    ),
    [
      [1, 1, 1],
      [2, 1, 1],
      [1, 3, 1],
    ],
  );
});

test("curvePoints passes through every control point with bounded spacing", () => {
  const control: Vector3[] = [
    [0, 0, 0],
    [1, 0.5, 0],
    [2, 0, 1],
    [2.5, 1, 2],
    [4, 1, 2],
  ];
  const out = curvePoints(control);
  for (const c of control)
    assert.ok(
      out.some((p) => dist(p, c) <= 1e-9),
      `missing ${c}`,
    );
  close(out[0], control[0], 1e-9);
  close(out[out.length - 1], control[control.length - 1], 1e-9);
  for (let i = 1; i < out.length; i += 1) assert.ok(dist(out[i - 1], out[i]) <= 0.05 + 1e-9);
});

const FLOOR_PATHS: Array<[string, Vector3[]]> = [
  [
    "ball thrown to the floor",
    [
      [-0.8, 2, 0],
      [0.703, 0.26, 3.645],
      [-2, 1, -2.048],
    ],
  ],
  [
    "floor loop",
    [
      [1.5, 1.3, -2],
      [1.5, 0.26, 2],
      [-1.5, 0.26, 2],
      [-1.5, 0.26, -2],
      [1.5, 0.26, -2],
    ],
  ],
];

for (const [name, control] of FLOOR_PATHS) {
  test(`curvePoints never overshoots vertically between control points: ${name}`, () => {
    const out = curvePoints(control, 0.005);
    let seg = 0;
    for (const p of out) {
      const a = control[seg];
      const b = control[seg + 1];
      assert.ok(
        p[1] >= Math.min(a[1], b[1]) - 1e-9 && p[1] <= Math.max(a[1], b[1]) + 1e-9,
        `segment ${seg} sample ${JSON.stringify(p)}`,
      );
      if (seg + 2 < control.length && dist(p, b) <= 1e-12) seg += 1;
    }
    assert.equal(seg, control.length - 2);
    assert.ok(Math.min(...out.map((p) => p[1])) >= 0.26 - 1e-9);
  });
}

/** A 3 m x 4 m floor square through its four corners, back to the first. */
const SQUARE: Array<[number, number]> = [
  [1.5, 2],
  [-1.5, 2],
  [-1.5, -2],
  [1.5, -2],
  [1.5, 2],
];

test("curvePoints keeps a four-point floor square smooth (no polygon corners)", () => {
  // Turned 15 degrees about +Y, as clicked: real floor clicks never share an x or z exactly.
  const turn = (15 * Math.PI) / 180;
  const control: Vector3[] = SQUARE.map(([x, z]) => [
    x * Math.cos(turn) + z * Math.sin(turn),
    0.26,
    -x * Math.sin(turn) + z * Math.cos(turn),
  ]);
  const out = curvePoints(control, 0.05);
  // A polygon corner turns 90 degrees in one sample; a smooth loop turns well under 30 degrees
  // between consecutive 5 cm steps (curvature radius here is >= ~0.5 m, i.e. <= ~6 degrees/step).
  let worst = 0;
  for (let i = 1; i + 1 < out.length; i += 1) {
    const u = [out[i][0] - out[i - 1][0], out[i][2] - out[i - 1][2]];
    const v = [out[i + 1][0] - out[i][0], out[i + 1][2] - out[i][2]];
    const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
    worst = Math.max(worst, Math.acos(Math.min(1, Math.max(-1, cos))));
  }
  assert.ok((worst * 180) / Math.PI < 30, `worst turn ${(worst * 180) / Math.PI} deg`);
});

test("curvePoints turns an exactly axis-aligned corner sharply and never overshoots its sides", () => {
  // Equal x or z on each side is a flat run, as wall projection leaves it: no bulge past it.
  const control: Vector3[] = SQUARE.map(([x, z]) => [x, 0.26, z]);
  const out = curvePoints(control, 0.05);
  for (const p of out) {
    assert.ok(Math.abs(p[0]) <= 1.5 && Math.abs(p[2]) <= 2, `${JSON.stringify(p)} overshoots`);
    assert.ok(
      Math.abs(Math.abs(p[0]) - 1.5) <= 1e-9 || Math.abs(Math.abs(p[2]) - 2) <= 1e-9,
      `${JSON.stringify(p)} leaves the square's sides`,
    );
  }
  for (const corner of control.slice(1, -1)) {
    const i = out.findIndex((p) => dist(p, corner) <= 1e-12);
    const u = [out[i]![0] - out[i - 1]![0], out[i]![2] - out[i - 1]![2]];
    const v = [out[i + 1]![0] - out[i]![0], out[i + 1]![2] - out[i]![2]];
    const cos = (u[0]! * v[0]! + u[1]! * v[1]!) / (Math.hypot(...u) * Math.hypot(...v));
    assert.ok(Math.abs(cos) < 1e-9, `the corner at ${JSON.stringify(corner)} turns 90 degrees`);
  }
});

test("curvePoints is C1 where the path is monotone in every axis (extrema stop by design)", () => {
  const control: Vector3[] = [
    [0, 0, 0],
    [1, 0.4, 0.5],
    [1.5, 1.5, 2],
    [3, 2, 2.5],
  ];
  const out = curvePoints(control, 0.002);
  for (const c of control.slice(1, -1)) {
    const i = out.findIndex((p) => dist(p, c) <= 1e-12);
    const before = out[i - 1];
    const after = out[i + 1];
    const u: Vector3 = [c[0] - before[0], c[1] - before[1], c[2] - before[2]];
    const v: Vector3 = [after[0] - c[0], after[1] - c[1], after[2] - c[2]];
    const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v));
    assert.ok(cos > 0.9, `kink at ${JSON.stringify(c)} cos=${cos}`);
  }
});

test("curvePoints keeps unevenly spaced collinear points on the line without back-tracking", () => {
  const out = curvePoints(
    [
      [0, 1, 0],
      [0, 1, -0.06],
      [0, 1, -2.06],
      [0, 1, -2.12],
    ],
    0.01,
  );
  for (let i = 0; i < out.length; i += 1) {
    assert.ok(Math.abs(out[i][0]) <= 1e-9 && Math.abs(out[i][1] - 1) <= 1e-9);
    if (i > 0) assert.ok(out[i][2] <= out[i - 1][2] + 1e-9, `back-track at ${i}`);
  }
});

test("curvePoints keeps an uneven painted-like stroke close to its control polyline", () => {
  // Quarter arc of radius 1 sampled unevenly (a 0.06 m step next to a ~1 m one).
  const control: Vector3[] = [
    [0, 0.5, 0],
    [0.06, 0.5, -0.0018],
    [0.9, 0.5, -0.4359],
    [1, 0.5, -1],
  ];
  const out = curvePoints(control, 0.01);
  const segDist = (p: Vector3, a: Vector3, b: Vector3): number => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const u = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2),
    );
    return dist(p, [a[0] + ab[0] * u, a[1] + ab[1] * u, a[2] + ab[2] * u]);
  };
  // Bound 0.05 m is the stroke filter resolution (strokeOffsets minStepM): the curve may not stray
  // further from the painted polyline than one painting step. Measured 0.044 m with chord-length
  // knots; the uniform-parameter version overshoots this bound.
  for (const p of out) {
    const d = Math.min(...control.slice(1).map((c, i) => segDist(p, control[i], c)));
    assert.ok(d <= 0.05, `sample ${JSON.stringify(p)} is ${d} m off the polyline`);
  }
});

test("curvePoints keeps a flat x run (a stroke on a wall's clearance) exactly at that x", () => {
  // The brush approaches a wall at x = -0.69, slides along it, then leaves it again.
  const wallX = -0.69;
  const control: Vector3[] = [
    [0, 1.6, 1],
    [-0.4754, 1.6, 1.0573],
    [wallX, 1.6, 1.1579],
    [wallX, 1.4, 2.2],
    [wallX, 1.6, 3.0263],
    [-0.3, 1.6, 3.4],
  ];
  const out = curvePoints(control, 0.01);
  const first = out.findIndex((p) => dist(p, control[2]) <= 1e-12);
  const last = out.findIndex((p) => dist(p, control[4]) <= 1e-12);
  assert.ok(first > 0 && last > first + 50, `run samples ${first}..${last}`);
  for (const p of out.slice(first, last + 1)) assert.equal(p[0], wallX, `${JSON.stringify(p)}`);
  for (const p of out) assert.ok(p[0] >= wallX, `${JSON.stringify(p)} passes the wall`);
});

test("curvePoints with two control points is a straight segment", () => {
  const out = curvePoints([
    [0, 0, 0],
    [1, 0, 0],
  ]);
  for (const p of out) assert.ok(Math.abs(p[1]) < 1e-12 && Math.abs(p[2]) < 1e-12);
});

test("timePath uses arc length over strength", () => {
  const path = timePath([0, 1, 0], trajectory());
  assert.ok(Math.abs(path.lengthM - 2) < 1e-6);
  assert.ok(Math.abs(path.durationS - 0.5) < 1e-6);
});

test("poseAt handles delay, midpoint and finish", () => {
  const path = timePath([0, 1, 0], trajectory());
  const base: [number, number, number, number] = [0, 0, 0, 1];
  const before = poseAt(path, base, 0.99);
  close(before.positionM, [0, 1, 0]);
  assert.deepEqual(before.velocityMps, [0, 0, 0]);
  assert.equal(before.finished, false);
  const mid = poseAt(path, base, 1.25);
  close(mid.positionM, [1, 1, 0]);
  assert.equal(mid.finished, false);
  const end = poseAt(path, base, 1.6);
  close(end.positionM, [2, 1, 0]);
  assert.equal(end.finished, true);
  close(end.velocityMps, [4, 0, 0]);
});

test("faceAlongPath yaws forward onto the horizontal tangent, otherwise keeps base", () => {
  const base: [number, number, number, number] = [0.1, 0.2, 0.3, Math.sqrt(1 - 0.14)];
  const kept = poseAt(timePath([0, 0, 0], trajectory()), base, 1.25);
  assert.deepEqual(kept.orientationQuaternion, base);
  const path = timePath([0, 0, 0], trajectory({ offsetsM: [[0, 1, -3]], faceAlongPath: true }));
  const q = poseAt(path, base, 1.1).orientationQuaternion;
  assert.ok(Math.abs(q[0]) < 1e-9 && Math.abs(q[2]) < 1e-9);
  close(rotate(q, [0, 0, -1]), [0, 0, -1], 1e-9);
  const east = poseAt(timePath([0, 0, 0], trajectory({ faceAlongPath: true })), base, 1.1);
  close(rotate(east.orientationQuaternion, [0, 0, -1]), [1, 0, 0], 1e-9);
});

test("simplifyStroke bounds points, keeps endpoints and shape", () => {
  const stroke: Vector3[] = Array.from({ length: 500 }, (_, i) => {
    const a = (i / 499) * Math.PI * 2;
    return [Math.cos(a), 0, Math.sin(a)];
  });
  const out = simplifyStroke(stroke, 63);
  assert.ok(out.length <= 63);
  assert.deepEqual(out[0], stroke[0]);
  assert.deepEqual(out[out.length - 1], stroke[499]);
  for (const p of stroke) {
    let best = Infinity;
    for (let i = 1; i < out.length; i += 1) {
      const a = out[i - 1];
      const b = out[i];
      const ab: Vector3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      const t =
        len2 === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / len2,
              ),
            );
      best = Math.min(best, dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
    }
    assert.ok(best <= 0.15);
  }
});
