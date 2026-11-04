import type { AcousticBoxOccluder, Vec3 } from "./types.js";
import { add, cross, EPSILON_M, length, scale, sub } from "./geometry.js";

export interface BoxOccluderSegmentInterval {
  /** Fractions of the closed finite segment, clipped to [0, 1]. */
  enterT: number;
  exitT: number;
}

function vector(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    Array.from(value).every(
      (component) =>
        typeof component === "number" && Number.isFinite(component) && Math.abs(component) <= 1e6,
    )
  );
}
function validatePoint(value: Vec3): void {
  if (!vector(value)) throw new RangeError("Box coordinates must be dense, finite and bounded.");
}
function inverseOrientation(box: AcousticBoxOccluder): readonly [number, number, number, number] {
  if (!box || !vector(box.centerM) || !vector(box.halfExtentsM))
    throw new RangeError("Box center and half extents must be dense, finite and bounded.");
  if (box.halfExtentsM.some((extent) => extent <= 0))
    throw new RangeError("Box half extents must be positive.");
  const q = box.orientationQuaternion;
  if (
    !Array.isArray(q) ||
    q.length !== 4 ||
    !Array.from(q).every((component) => typeof component === "number" && Number.isFinite(component))
  )
    throw new RangeError("Box orientation must be a dense, finite quaternion.");
  const magnitude = Math.hypot(...q);
  if (Math.abs(magnitude - 1) > 1e-6 || magnitude === 0)
    throw new RangeError("Box orientation must be a unit quaternion.");
  // Conjugate of the normalized quaternion is the actual inverse rotation.
  return [-q[0] / magnitude, -q[1] / magnitude, -q[2] / magnitude, q[3] / magnitude];
}
function rotate(point: Vec3, q: readonly [number, number, number, number]): Vec3 {
  const imaginary: Vec3 = [q[0], q[1], q[2]];
  return add(
    point,
    add(
      scale(cross(imaginary, point), 2 * q[3]),
      scale(cross(imaginary, cross(imaginary, point)), 2),
    ),
  );
}
/** Numerical boundary skin only: retain a closed-body tangency within the shared metre tolerance. */
function snapRoundoffToSlab(position: number, extent: number): number {
  if (position > extent && position - extent <= EPSILON_M) return extent;
  if (position < -extent && -extent - position <= EPSILON_M) return -extent;
  return position;
}
/**
 * Closed oriented-box volume interval. Each rigidly transformed endpoint is tested
 * against three local slabs; this representation is an occluder, never a reflector.
 */
export function boxOccluderSegmentInterval(
  a: Vec3,
  b: Vec3,
  box: AcousticBoxOccluder,
): BoxOccluderSegmentInterval | null {
  validatePoint(a);
  validatePoint(b);
  const inverse = inverseOrientation(box);
  if (length(sub(b, a)) <= EPSILON_M) return null;
  const localA = rotate(sub(a, box.centerM), inverse);
  const localB = rotate(sub(b, box.centerM), inverse);
  let enterT = 0;
  let exitT = 1;
  for (let index = 0; index < 3; index++) {
    const extent = box.halfExtentsM[index]!;
    const position = snapRoundoffToSlab(localA[index]!, extent);
    const end = snapRoundoffToSlab(localB[index]!, extent);
    const velocity = end - position;
    if (velocity === 0) {
      if (position < -extent || position > extent) return null;
      continue;
    }
    const first = (-extent - position) / velocity;
    const last = (extent - position) / velocity;
    enterT = Math.max(enterT, Math.min(first, last));
    exitT = Math.min(exitT, Math.max(first, last));
    if (enterT > exitT) return null;
  }
  return { enterT, exitT };
}
/**
 * Obstruction of the open segment with the same actual-endpoint tolerance as
 * planar/curved geometry. Boundary tangencies conservatively count as hits.
 * An entirely interior segment returns an occupied-volume representative point;
 * it is not a surface normal or a reflection vertex.
 */
export function boxOccluderSegmentIntersection(
  a: Vec3,
  b: Vec3,
  box: AcousticBoxOccluder,
): [number, number, number] | null {
  const interval = boxOccluderSegmentInterval(a, b, box);
  if (!interval) return null;
  const displacement = sub(b, a);
  const endpointTolerance = EPSILON_M / length(displacement);
  if (
    endpointTolerance >= 0.5 ||
    interval.exitT <= endpointTolerance ||
    interval.enterT >= 1 - endpointTolerance
  )
    return null;
  const parameter =
    interval.enterT > endpointTolerance
      ? interval.enterT
      : (Math.max(interval.enterT, endpointTolerance) +
          Math.min(interval.exitT, 1 - endpointTolerance)) /
        2;
  return add(a, scale(displacement, parameter));
}
