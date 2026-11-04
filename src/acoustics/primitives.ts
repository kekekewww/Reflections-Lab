import type { AcousticPrimitive, Vec3 } from "./types.js";
import { add, cross, dot, EPSILON_M, length, scale, sub } from "./geometry.js";

export interface PrimitiveSegmentInterval {
  /** Fractions of the finite segment, clipped to [0, 1]. A tangent has equal endpoints. */
  enterT: number;
  exitT: number;
}
export interface PrimitiveReflection {
  point: [number, number, number];
  normal: [number, number, number];
  /** Total bisection iterations across all attempted surface components. */
  iterations: number;
}

const MAX_BISECTIONS = 48;
export const MAX_PRIMITIVE_REFLECTION_ITERATIONS = 3 * MAX_BISECTIONS;
type Interval = readonly [number, number];
type ReflectionAttempt = {
  hit: Omit<PrimitiveReflection, "iterations"> | null;
  iterations: number;
};

function finiteVector(v: unknown): v is Vec3 {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    Array.from(v).every((value) => typeof value === "number" && Number.isFinite(value))
  );
}
function validateVector(v: Vec3): void {
  if (!finiteVector(v) || v.some((value) => Math.abs(value) > 1e6))
    throw new RangeError("Primitive coordinates must be dense, finite and bounded.");
}
function validatePrimitive(p: AcousticPrimitive): void {
  if (!p || (p.kind !== "sphere" && p.kind !== "capsule"))
    throw new RangeError("Unknown acoustic primitive.");
  validateVector(p.centerM);
  if (!Number.isFinite(p.radiusM) || p.radiusM <= 0 || p.radiusM > 1e6)
    throw new RangeError("Primitive radius must be finite and positive.");
  if (p.kind === "capsule") {
    if (!finiteVector(p.axis) || Math.abs(length(p.axis) - 1) > 1e-6)
      throw new RangeError("Capsule axis must be a finite unit vector.");
    if (
      p.halfLengthM === undefined ||
      !Number.isFinite(p.halfLengthM) ||
      p.halfLengthM < 0 ||
      p.halfLengthM > 1e6
    )
      throw new RangeError("Capsule half length must be finite and nonnegative.");
  }
}
function normalized(v: Vec3): [number, number, number] {
  const magnitude = length(v);
  if (!(magnitude > 0) || !Number.isFinite(magnitude))
    throw new RangeError("Cannot normalize a degenerate primitive direction.");
  return scale(v, 1 / magnitude);
}
/** Solutions of a*x*x + 2*b*x + c <= 0; cancellation-safe finite roots. */
function quadraticInterval(a: number, b: number, c: number): Interval | null {
  if (a === 0) return c <= 0 ? [-Infinity, Infinity] : null;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  if (root === 0) return [-b / a, -b / a];
  const q = -b - (b < 0 ? -root : root);
  const first = q / a;
  const second = c / q;
  return first < second ? [first, second] : [second, first];
}
function intersect(a: Interval | null, b: Interval | null): Interval | null {
  if (!a || !b) return null;
  const first = Math.max(a[0], b[0]);
  const last = Math.min(a[1], b[1]);
  return first <= last ? [first, last] : null;
}
function ballInterval(
  origin: Vec3,
  direction: Vec3,
  center: Vec3,
  radius: number,
): Interval | null {
  const relative = sub(origin, center);
  return quadraticInterval(1, dot(relative, direction), dot(relative, relative) - radius * radius);
}
function axialInterval(position: number, velocity: number, halfLength: number): Interval | null {
  if (Math.abs(velocity) <= Number.EPSILON * 16)
    return Math.abs(position) <= halfLength ? [-Infinity, Infinity] : null;
  const first = (-halfLength - position) / velocity;
  const last = (halfLength - position) / velocity;
  return first < last ? [first, last] : [last, first];
}
function shapeInterval(a: Vec3, b: Vec3, p: AcousticPrimitive): Interval | null {
  const displacement = sub(b, a);
  const distance = length(displacement);
  if (distance <= EPSILON_M) return null;
  const direction = scale(displacement, 1 / distance);
  const segment: Interval = [0, distance];
  if (p.kind === "sphere" || p.halfLengthM === 0)
    return intersect(ballInterval(a, direction, p.centerM, p.radiusM), segment);
  const axis = normalized(p.axis!);
  const halfLength = p.halfLengthM!;
  const relative = sub(a, p.centerM);
  const height = dot(relative, axis);
  const axialVelocity = dot(direction, axis);
  const radialOrigin = sub(relative, scale(axis, height));
  const radialDirection = sub(direction, scale(axis, axialVelocity));
  const side = intersect(
    intersect(
      quadraticInterval(
        dot(radialDirection, radialDirection),
        dot(radialOrigin, radialDirection),
        dot(radialOrigin, radialOrigin) - p.radiusM * p.radiusM,
      ),
      axialInterval(height, axialVelocity, halfLength),
    ),
    segment,
  );
  const lower = intersect(
    ballInterval(a, direction, sub(p.centerM, scale(axis, halfLength)), p.radiusM),
    segment,
  );
  const upper = intersect(
    ballInterval(a, direction, add(p.centerM, scale(axis, halfLength)), p.radiusM),
    segment,
  );
  const pieces = [side, lower, upper].filter((item): item is Interval => item !== null);
  if (pieces.length === 0) return null;
  // Their union is a capsule, hence convex. Its intersection with a line is one interval.
  return [
    Math.min(...pieces.map((piece) => piece[0])),
    Math.max(...pieces.map((piece) => piece[1])),
  ];
}
/** Analytic closed-volume interval; no tessellation or Rapier/renderer state is used. */
export function primitiveSegmentInterval(
  a: Vec3,
  b: Vec3,
  primitive: AcousticPrimitive,
): PrimitiveSegmentInterval | null {
  validateVector(a);
  validateVector(b);
  validatePrimitive(primitive);
  const distance = length(sub(b, a));
  const interval = shapeInterval(a, b, primitive);
  if (!interval || distance <= EPSILON_M) return null;
  return { enterT: interval[0] / distance, exitT: interval[1] / distance };
}
/**
 * Obstruction of the open segment. Boundary tangencies count conservatively as hits.
 * If both endpoints are inside, the returned point represents occupied volume, not a surface normal.
 */
export function primitiveSegmentIntersection(
  a: Vec3,
  b: Vec3,
  primitive: AcousticPrimitive,
): [number, number, number] | null {
  const interval = primitiveSegmentInterval(a, b, primitive);
  if (!interval) return null;
  const displacement = sub(b, a);
  const endpointTolerance = EPSILON_M / length(displacement);
  if (endpointTolerance >= 0.5) return null;
  if (interval.exitT <= endpointTolerance || interval.enterT >= 1 - endpointTolerance) return null;
  const t =
    interval.enterT > endpointTolerance
      ? interval.enterT
      : (Math.max(interval.enterT, endpointTolerance) +
          Math.min(interval.exitT, 1 - endpointTolerance)) /
        2;
  return add(a, scale(displacement, t));
}
function distanceToSpine(point: Vec3, primitive: AcousticPrimitive): number {
  const relative = sub(point, primitive.centerM);
  if (primitive.kind === "sphere" || primitive.halfLengthM === 0) return length(relative);
  const along = Math.max(
    -primitive.halfLengthM!,
    Math.min(primitive.halfLengthM!, dot(relative, normalized(primitive.axis!))),
  );
  return length(sub(relative, scale(normalized(primitive.axis!), along)));
}
function visible(point: Vec3, normal: Vec3, source: Vec3, listener: Vec3): boolean {
  return (
    dot(normal, sub(source, point)) > EPSILON_M && dot(normal, sub(listener, point)) > EPSILON_M
  );
}

/**
 * Circle/sphere specular position in the source-centre-listener plane.
 * On the common visible arc F'' > 0: each distance contributes a positive tangential
 * term plus -r*n.dot((P-E)/|P-E|), also positive for an externally visible endpoint.
 */
function roundReflection(
  source: Vec3,
  listener: Vec3,
  center: Vec3,
  radius: number,
): ReflectionAttempt {
  const sourceVector = sub(source, center);
  const listenerVector = sub(listener, center);
  const sourceDistance = length(sourceVector);
  const listenerDistance = length(listenerVector);
  if (sourceDistance <= radius + EPSILON_M || listenerDistance <= radius + EPSILON_M)
    return { hit: null, iterations: 0 };
  const u = normalized(sourceVector);
  const w = normalized(listenerVector);
  const cosine = Math.max(-1, Math.min(1, dot(u, w)));
  const separation = Math.atan2(length(cross(u, w)), cosine);
  if (separation <= 1e-12) {
    const point = add(center, scale(u, radius));
    return {
      hit: visible(point, u, source, listener) ? { point, normal: u } : null,
      iterations: 0,
    };
  }
  const transverse = sub(w, scale(u, cosine));
  if (length(transverse) <= 1e-12) return { hit: null, iterations: 0 };
  const v = normalized(transverse);
  let lower = Math.max(0, separation - Math.acos(radius / listenerDistance));
  let upper = Math.min(separation, Math.acos(radius / sourceDistance));
  if (!(upper > lower)) return { hit: null, iterations: 0 };
  const derivative = (angle: number) => {
    const x = radius * Math.cos(angle),
      y = radius * Math.sin(angle);
    const firstLength = Math.hypot(x - sourceDistance, y);
    const secondLength = Math.hypot(
      x - listenerDistance * cosine,
      y - listenerDistance * Math.sin(separation),
    );
    return (
      (sourceDistance * Math.sin(angle)) / firstLength +
      (listenerDistance * Math.sin(angle - separation)) / secondLength
    );
  };
  if (derivative(lower) > 0 || derivative(upper) < 0) return { hit: null, iterations: 0 };
  for (let iteration = 0; iteration < MAX_BISECTIONS; iteration++) {
    const middle = (lower + upper) / 2;
    if (derivative(middle) > 0) upper = middle;
    else lower = middle;
  }
  const angle = (lower + upper) / 2;
  const normal = add(scale(u, Math.cos(angle)), scale(v, Math.sin(angle)));
  const point = add(center, scale(normal, radius));
  return {
    hit: visible(point, normal, source, listener) ? { point, normal } : null,
    iterations: MAX_BISECTIONS,
  };
}
/**
 * One convex-body reflection candidate. Capsule side stationarity reduces to a
 * circle problem; axial stationarity gives z=(ys*dL+yl*dS)/(dS+dL).
 * This solves ray geometry, not curvature spreading/focusing, diffraction or wave scattering.
 */
export function primitiveReflectionPoint(
  source: Vec3,
  listener: Vec3,
  primitive: AcousticPrimitive,
): PrimitiveReflection | null {
  validateVector(source);
  validateVector(listener);
  validatePrimitive(primitive);
  if (
    distanceToSpine(source, primitive) <= primitive.radiusM + EPSILON_M ||
    distanceToSpine(listener, primitive) <= primitive.radiusM + EPSILON_M
  )
    return null;
  if (primitive.kind === "sphere" || primitive.halfLengthM === 0) {
    const result = roundReflection(source, listener, primitive.centerM, primitive.radiusM);
    return result.hit ? { ...result.hit, iterations: result.iterations } : null;
  }
  const axis = normalized(primitive.axis!);
  const halfLength = primitive.halfLengthM!;
  const candidates: Omit<PrimitiveReflection, "iterations">[] = [];
  let iterations = 0;
  for (const side of [-1, 1]) {
    const center = add(primitive.centerM, scale(axis, side * halfLength));
    const result = roundReflection(source, listener, center, primitive.radiusM);
    iterations += result.iterations;
    if (result.hit && side * dot(result.hit.normal, axis) >= -1e-10) candidates.push(result.hit);
  }
  const sourceOffset = sub(source, primitive.centerM);
  const listenerOffset = sub(listener, primitive.centerM);
  const sourceHeight = dot(sourceOffset, axis);
  const listenerHeight = dot(listenerOffset, axis);
  const sourceRadial = sub(sourceOffset, scale(axis, sourceHeight));
  const listenerRadial = sub(listenerOffset, scale(axis, listenerHeight));
  const side = roundReflection(sourceRadial, listenerRadial, [0, 0, 0], primitive.radiusM);
  iterations += side.iterations;
  if (side.hit) {
    const sourceDistance = length(sub(sourceRadial, side.hit.point));
    const listenerDistance = length(sub(listenerRadial, side.hit.point));
    const height =
      (sourceHeight * listenerDistance + listenerHeight * sourceDistance) /
      (sourceDistance + listenerDistance);
    if (Math.abs(height) <= halfLength + EPSILON_M) {
      const axialPosition = Math.max(-halfLength, Math.min(halfLength, height));
      const point = add(primitive.centerM, add(side.hit.point, scale(axis, axialPosition)));
      if (visible(point, side.hit.normal, source, listener))
        candidates.push({ point, normal: side.hit.normal });
    }
  }
  candidates.sort(
    (a, b) =>
      length(sub(a.point, source)) +
      length(sub(a.point, listener)) -
      length(sub(b.point, source)) -
      length(sub(b.point, listener)),
  );
  const chosen = candidates[0];
  return chosen ? { ...chosen, iterations } : null;
}
