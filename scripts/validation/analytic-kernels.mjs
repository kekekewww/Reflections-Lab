// Isolated analytical reference kernels. These are not the product acoustic solver.
const EPS = 1e-9;
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const scale = (a, k) => a.map((v) => v * k);
export const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export const norm = (a) => Math.hypot(...a);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const finitePositive = (v, name) => {
  if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${name} must be finite and > 0`);
};
export function directPath(source, receiver, c, referenceDistance = 1) {
  finitePositive(c, "c");
  finitePositive(referenceDistance, "referenceDistance");
  const distance = norm(sub(receiver, source));
  finitePositive(distance, "distance");
  return { distance, delaySeconds: distance / c, pressureRatio: referenceDistance / distance };
}
export function reflect(point, surface) {
  if (Math.abs(norm(surface.normal) - 1) > EPS)
    throw new RangeError("surface normal must be unit length");
  return sub(point, scale(surface.normal, 2 * dot(sub(point, surface.point), surface.normal)));
}
export function insidePolygon(point, surface) {
  if (Math.abs(dot(sub(point, surface.point), surface.normal)) > EPS) return false;
  const signs = surface.vertices.map((a, i) =>
    dot(
      cross(sub(surface.vertices[(i + 1) % surface.vertices.length], a), sub(point, a)),
      surface.normal,
    ),
  );
  return signs.every((v) => v >= -EPS) || signs.every((v) => v <= EPS);
}
export function intersectSegment(a, b, surface) {
  const delta = sub(b, a);
  const denominator = dot(delta, surface.normal);
  if (Math.abs(denominator) < EPS) return null;
  const t = dot(sub(surface.point, a), surface.normal) / denominator;
  const point = add(a, scale(delta, t));
  return t >= -EPS && t <= 1 + EPS && insidePolygon(point, surface) ? { point, t } : null;
}
export function isOccluded(a, b, blockers) {
  return blockers.some((surface) => {
    const hit = intersectSegment(a, b, surface);
    return hit !== null && hit.t > EPS && hit.t < 1 - EPS;
  });
}
export function specularPath(source, receiver, surfaces, blockers = []) {
  const images = [source];
  for (const surface of surfaces) images.push(reflect(images.at(-1), surface));
  let cursor = receiver;
  const hits = new Array(surfaces.length);
  for (let i = surfaces.length - 1; i >= 0; i--) {
    const hit = intersectSegment(cursor, images[i + 1], surfaces[i]);
    if (!hit || hit.t <= EPS || hit.t >= 1 - EPS) return null;
    hits[i] = hit.point;
    cursor = hit.point;
  }
  const points = [source, ...hits, receiver];
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    if (isOccluded(points[i - 1], points[i], [...surfaces, ...blockers])) return null;
    distance += norm(sub(points[i], points[i - 1]));
  }
  return { hits, distance, sequence: surfaces.map((s) => s.id) };
}
export function pathIdentity(sourceId, receiverId, surfaceIds) {
  return JSON.stringify([sourceId, receiverId, surfaceIds]);
}
export function materialEnergy(bands) {
  return bands.map(({ reflection, transmission, absorption }) => {
    const values = [reflection, transmission, absorption];
    if (
      values.some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
      Math.abs(values.reduce((a, b) => a + b, 0) - 1) > EPS
    )
      throw new RangeError("R + T + A must equal 1 in each energy band");
    return {
      reflectedPressureMagnitude: Math.sqrt(reflection),
      transmittedPressureMagnitude: Math.sqrt(transmission),
    };
  });
}
export function airPressureRatio(alphaDbPerMeter, distanceMeters) {
  if (![alphaDbPerMeter, distanceMeters].every((v) => Number.isFinite(v) && v >= 0))
    throw new RangeError("nonnegative finite alpha and distance required");
  return 10 ** ((-alphaDbPerMeter * distanceMeters) / 20);
}
export function doppler({ frequencyHz, c, sourceVelocity, receiverVelocity, direction }) {
  finitePositive(c, "c");
  finitePositive(frequencyHz, "frequencyHz");
  if (
    Math.abs(norm(direction) - 1) > EPS ||
    norm(sourceVelocity) >= c ||
    norm(receiverVelocity) >= c
  )
    throw new RangeError("unit direction and subsonic velocities required");
  return (
    (frequencyHz * (c - dot(receiverVelocity, direction))) / (c - dot(sourceVelocity, direction))
  );
}
export function roomMode(dimensionsMeters, order, c) {
  dimensionsMeters.forEach((v) => finitePositive(v, "dimension"));
  finitePositive(c, "c");
  if (order.some((v) => !Number.isInteger(v) || v < 0) || order.every((v) => v === 0))
    throw new RangeError("nonzero nonnegative integer mode required");
  return (c / 2) * Math.sqrt(order.reduce((sum, v, i) => sum + (v / dimensionsMeters[i]) ** 2, 0));
}
export function impulseArrivalSample(distance, c, sampleRate) {
  finitePositive(c, "c");
  finitePositive(sampleRate, "sampleRate");
  if (!Number.isFinite(distance) || distance < 0)
    throw new RangeError("nonnegative distance required");
  return Math.round((distance / c) * sampleRate);
}
export function energyDecayDb(samples) {
  if (!samples.length || samples.some((v) => !Number.isFinite(v)))
    throw new RangeError("finite nonempty RIR required");
  let sum = 0;
  const energy = samples.map(() => 0);
  for (let i = samples.length - 1; i >= 0; i--) {
    sum += samples[i] ** 2;
    energy[i] = sum;
  }
  if (sum === 0) throw new RangeError("silent RIR has no normalized EDC");
  return energy.map((v) => (v === 0 ? -Infinity : 10 * Math.log10(v / sum)));
}
export function decayTime(samples, sampleRate, fromDb, toDb) {
  finitePositive(sampleRate, "sampleRate");
  if (!(fromDb > toDb && fromDb <= 0)) throw new RangeError("descending dB interval required");
  const edc = energyDecayDb(samples);
  const points = edc.flatMap((db, i) =>
    Number.isFinite(db) && db <= fromDb && db >= toDb ? [[i / sampleRate, db]] : [],
  );
  if (points.length < 3 || edc.filter(Number.isFinite).at(-1) > toDb) return null;
  const mean = (axis) => points.reduce((s, p) => s + p[axis], 0) / points.length;
  const x = mean(0),
    y = mean(1);
  const denominator = points.reduce((s, p) => s + (p[0] - x) ** 2, 0);
  const slope = points.reduce((s, p) => s + (p[0] - x) * (p[1] - y), 0) / denominator;
  return Number.isFinite(slope) && slope < 0
    ? { rt60Seconds: -60 / slope, slopeDbPerSecond: slope, fittedSamples: points.length }
    : null;
}
