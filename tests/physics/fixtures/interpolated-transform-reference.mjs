// Frozen full public interpolation from physics-world.ts SHA256 9df0d1d2c01c03522c38659644f51d979a80d6e9198f973d2c9bbc6115ea6d85.
import { add, sub, scale } from "../../../src/physics/math.js";
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
export function originalInterpolatedPoses(alpha) {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)
    fail("INVALID_ALPHA", "Interpolation alpha must be in [0,1]");
  const previous = new Map(this.previous.map((p) => [p.objectId, p]));
  return this.poses().map((p) => {
    const old = previous.get(p.objectId);
    if (!old || p.discontinuity || old.generation !== p.generation) return p;
    const target = p.rotation;
    const sign = old.rotation.reduce((s, x, i) => s + x * target[i], 0) < 0 ? -1 : 1;
    const q = old.rotation.map((x, i) => x + (sign * target[i] - x) * alpha);
    const norm = Math.hypot(...q);
    return {
      ...p,
      positionMetres: add(
        old.positionMetres,
        scale(sub(p.positionMetres, old.positionMetres), alpha),
      ),
      rotation: q.map((x) => x / norm),
    };
  });
}
