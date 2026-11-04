import {
  TRAJECTORY_LIMITS,
  type ObjectTrajectory,
  type Quaternion,
  type Vector3,
} from "../scene/types.js";

export interface TimedPath {
  pointsM: Vector3[];
  cumulativeM: number[];
  lengthM: number;
  durationS: number;
  strengthMps: number;
  startDelayS: number;
  faceAlongPath: boolean;
}

export interface PathPose {
  positionM: Vector3;
  orientationQuaternion: Quaternion;
  velocityMps: Vector3;
  finished: boolean;
}

export type PathProblem = "TOO_LONG" | "BLOCKED" | "TOO_MANY";

const DENSE_STEPS = 64;
const MIN_KNOT_GAP = 1e-6;
/** A secant moving less than this in one axis is flat there, as wall or floor projection leaves it. */
const FLAT_RUN_M = 1e-4;

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`trajectory-path index ${index} out of range`);
  return item;
}
const copy = (v: Vector3): Vector3 => [v[0], v[1], v[2]];
const dist = (a: Vector3, b: Vector3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerp = (a: Vector3, b: Vector3, t: number): Vector3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function controlPoints(startM: Vector3, trajectory: ObjectTrajectory): Vector3[] {
  return [
    copy(startM),
    ...trajectory.offsetsM.map(
      (o): Vector3 => [startM[0] + o[0], startM[1] + o[1], startM[2] + o[2]],
    ),
  ];
}

/**
 * Per-axis velocities (units per metre of chord-length knot t) for a cubic Hermite through
 * `values`, where `h[k]` is the chord length between control k and k+1. Interior velocity starts
 * from the centripetal-style chord-length difference (v_{i+1}-v_{i-1} over t_{i+1}-t_{i-1}); ends
 * use the one-sided slope. The limiter is Fritsch-Carlson in slope form: the velocity is clamped
 * to 3x the smaller neighbouring secant slope, so each segment stays inside its end values.
 * - "vertical" (y): 0 at a local extremum (secants of different sign or zero), else limited.
 * - "horizontal" (x, z): 0 next to a secant that is flat in this axis (|delta| < FLAT_RUN_M, the
 *   runs that wall projection leaves, so the curve never bulges past them). At a point next to a
 *   flat run in either horizontal axis (`nearFlat`), same-sign secants are limited too, so the
 *   curve turning onto a run never overshoots in the other axis either (a corner). Everywhere
 *   else the velocity stays free, so clicked loops and painted arcs stay smooth.
 */
function axisVelocities(
  values: readonly number[],
  h: readonly number[],
  axis: "vertical" | "horizontal",
  nearFlat: (i: number) => boolean = () => false,
) {
  const n = values.length;
  const delta: number[] = [];
  for (let k = 0; k + 1 < n; k += 1) delta.push(at(values, k + 1) - at(values, k));
  const slope = delta.map((d, k) => d / at(h, k));
  const v: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (i === 0) v.push(slope.length > 0 ? at(slope, 0) : 0);
    else if (i === n - 1) v.push(at(slope, i - 1));
    else {
      const free = (at(values, i + 1) - at(values, i - 1)) / (at(h, i - 1) + at(h, i));
      const s0 = at(slope, i - 1);
      const s1 = at(slope, i);
      const limited = () =>
        Math.sign(s0) * Math.min(Math.abs(free), 3 * Math.min(Math.abs(s0), Math.abs(s1)));
      if (axis === "vertical") v.push(s0 * s1 <= 0 ? 0 : limited());
      else if (Math.abs(at(delta, i - 1)) < FLAT_RUN_M || Math.abs(at(delta, i)) < FLAT_RUN_M)
        v.push(0);
      else v.push(nearFlat(i) && s0 * s1 > 0 ? limited() : free);
    }
  }
  return v;
}

/** Cubic Hermite in difference form, so equal ends with zero tangents return exactly `p0`. */
function hermite(p0: number, p1: number, m0: number, m1: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return p0 + (3 * t2 - 2 * t3) * (p1 - p0) + (t3 - 2 * t2 + t) * m0 + (t3 - t2) * m1;
}

export function curvePoints(control: Vector3[], spacingM = 0.05): Vector3[] {
  if (control.length === 0) return [];
  if (!(spacingM > 0)) throw new Error("curvePoints spacingM must be positive");
  const out: Vector3[] = [copy(at(control, 0))];
  const last = control.length - 1;
  const h: number[] = [];
  for (let k = 0; k < last; k += 1)
    h.push(Math.max(dist(at(control, k), at(control, k + 1)), MIN_KNOT_GAP));
  // Segments flat in x or z: what pushing brush points onto a wall's clearance leaves.
  const flat = h.map((_, k) =>
    [0, 2].some(
      (axis) => Math.abs(at(at(control, k + 1), axis) - at(at(control, k), axis)) < FLAT_RUN_M,
    ),
  );
  const nearFlat = (i: number): boolean => at(flat, i - 1) || at(flat, i);
  const velocities = [0, 1, 2].map((axis) =>
    axisVelocities(
      control.map((c) => at(c, axis)),
      h,
      axis === 1 ? "vertical" : "horizontal",
      nearFlat,
    ),
  );
  // Hermite end tangents for segment i are v * h_i (same scale on every axis).
  const tangent = (axis: number, i: number, k: number): number =>
    at(at(velocities, axis), i) * at(h, k);
  for (let i = 0; i < last; i += 1) {
    const p1 = at(control, i);
    const p2 = at(control, i + 1);
    const dense: Vector3[] = [];
    for (let s = 0; s <= DENSE_STEPS; s += 1) {
      dense.push(
        s === 0
          ? p1
          : s === DENSE_STEPS
            ? p2
            : ([0, 1, 2].map((axis) =>
                hermite(
                  at(p1, axis),
                  at(p2, axis),
                  tangent(axis, i, i),
                  tangent(axis, i + 1, i),
                  s / DENSE_STEPS,
                ),
              ) as Vector3),
      );
    }
    const cum = [0];
    for (let s = 1; s < dense.length; s += 1) {
      cum.push(at(cum, s - 1) + dist(at(dense, s - 1), at(dense, s)));
    }
    const total = at(cum, cum.length - 1);
    const count = Math.max(1, Math.ceil(total / spacingM));
    let cursor = 0;
    for (let k = 1; k < count; k += 1) {
      const target = (total * k) / count;
      while (cursor < cum.length - 2 && at(cum, cursor + 1) < target) cursor += 1;
      const span = at(cum, cursor + 1) - at(cum, cursor);
      out.push(
        lerp(
          at(dense, cursor),
          at(dense, cursor + 1),
          span > 0 ? (target - at(cum, cursor)) / span : 0,
        ),
      );
    }
    out.push(copy(p2));
  }
  return out;
}

export function timePath(startM: Vector3, trajectory: ObjectTrajectory): TimedPath {
  if (!(trajectory.strengthMps > 0)) throw new Error("trajectory strengthMps must be positive");
  const pointsM = curvePoints(controlPoints(startM, trajectory));
  const cumulativeM = [0];
  for (let i = 1; i < pointsM.length; i += 1) {
    cumulativeM.push(at(cumulativeM, i - 1) + dist(at(pointsM, i - 1), at(pointsM, i)));
  }
  const lengthM = at(cumulativeM, cumulativeM.length - 1);
  return {
    pointsM,
    cumulativeM,
    lengthM,
    durationS: lengthM / trajectory.strengthMps,
    strengthMps: trajectory.strengthMps,
    startDelayS: trajectory.startDelayS,
    faceAlongPath: trajectory.faceAlongPath,
  };
}

function unitStep(path: TimedPath, i: number): Vector3 | null {
  const a = at(path.pointsM, i);
  const b = at(path.pointsM, i + 1);
  const len = dist(a, b);
  return len > 1e-12 ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len] : null;
}

// Tangent of the segment at index, falling back to the nearest non-degenerate segment.
function tangentAt(path: TimedPath, index: number): Vector3 {
  const count = path.pointsM.length - 1;
  for (let i = Math.min(index, count - 1); i >= 0; i -= 1) {
    const t = unitStep(path, i);
    if (t) return t;
  }
  for (let i = Math.max(index, 0); i < count; i += 1) {
    const t = unitStep(path, i);
    if (t) return t;
  }
  return [0, 0, 0];
}

export function poseAt(path: TimedPath, baseRotation: Quaternion, elapsedS: number): PathPose {
  const t = elapsedS - path.startDelayS;
  const finished = t >= path.durationS;
  const s = Math.min(Math.max(t, 0) * path.strengthMps, path.lengthM);
  const { cumulativeM, pointsM } = path;
  let lo = 0;
  let hi = cumulativeM.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at(cumulativeM, mid) <= s) lo = mid;
    else hi = mid;
  }
  const segment = Math.min(lo, pointsM.length - 2);
  let positionM: Vector3;
  let tangent: Vector3 = [0, 0, 0];
  if (pointsM.length < 2) {
    positionM = copy(at(pointsM, 0));
  } else {
    const span = at(cumulativeM, segment + 1) - at(cumulativeM, segment);
    positionM = lerp(
      at(pointsM, segment),
      at(pointsM, segment + 1),
      span > 0 ? (s - at(cumulativeM, segment)) / span : 0,
    );
    tangent = tangentAt(path, segment);
  }
  let orientationQuaternion: Quaternion = [
    baseRotation[0],
    baseRotation[1],
    baseRotation[2],
    baseRotation[3],
  ];
  if (path.faceAlongPath && Math.hypot(tangent[0], tangent[2]) > 1e-6) {
    // Yaw about +Y that maps forward [0,0,-1] onto the horizontal tangent.
    const yaw = Math.atan2(-tangent[0], -tangent[2]);
    orientationQuaternion = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  }
  const velocityMps: Vector3 =
    t >= 0
      ? [
          tangent[0] * path.strengthMps,
          tangent[1] * path.strengthMps,
          tangent[2] * path.strengthMps,
        ]
      : [0, 0, 0];
  return { positionM, orientationQuaternion, velocityMps, finished };
}

function pointSegmentDistance(p: Vector3, a: Vector3, b: Vector3): number {
  const ab: Vector3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
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
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
}

export function simplifyStroke(
  strokeM: Vector3[],
  maxPoints: number,
  toleranceM = 0.03,
): Vector3[] {
  if (maxPoints < 2) throw new Error("simplifyStroke maxPoints must be at least 2");
  if (strokeM.length <= 2) return strokeM.map(copy);
  const keep = new Array<boolean>(strokeM.length).fill(false);
  keep[0] = true;
  keep[strokeM.length - 1] = true;
  const stack: Array<[number, number]> = [[0, strokeM.length - 1]];
  for (let range = stack.pop(); range !== undefined; range = stack.pop()) {
    const [first, lastIdx] = range;
    let worst = -1;
    let worstDist = toleranceM;
    for (let i = first + 1; i < lastIdx; i += 1) {
      const d = pointSegmentDistance(at(strokeM, i), at(strokeM, first), at(strokeM, lastIdx));
      if (d > worstDist) {
        worstDist = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = true;
      stack.push([first, worst], [worst, lastIdx]);
    }
  }
  const kept = strokeM.filter((_, i) => keep[i]);
  if (kept.length <= maxPoints) return kept.map(copy);
  const thinned: Vector3[] = [];
  for (let k = 0; k < maxPoints; k += 1) {
    thinned.push(copy(at(kept, Math.round((k * (kept.length - 1)) / (maxPoints - 1)))));
  }
  return thinned;
}

/**
 * A painted stroke as path offsets from `startM`. Points within `minStepM` of the previous kept
 * point, starting from `startM`, are dropped first, so no zero or repeated offset is saved; the
 * rest is simplified to at most 63 points, keeping where the brush first left the start and where
 * it ended. Empty when the brush never left the start.
 */
export function strokeOffsets(startM: Vector3, strokeM: Vector3[], minStepM = 0.05): Vector3[] {
  const kept: Vector3[] = [];
  let previous = startM;
  for (const point of strokeM)
    if (dist(point, previous) >= minStepM) {
      kept.push(copy(point));
      previous = point;
    }
  return simplifyStroke(kept, TRAJECTORY_LIMITS.maxOffsets).map(
    (p): Vector3 => [p[0] - startM[0], p[1] - startM[1], p[2] - startM[2]],
  );
}
