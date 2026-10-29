import type { Quaternion, Vec3 } from "../scene/types.js";

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalize = (a: Vec3): Vec3 =>
  length(a) > 1e-12 ? scale(a, 1 / length(a)) : [0, 0, 0];
export const clampNorm = (a: Vec3, max: number): Vec3 =>
  length(a) > max ? scale(a, max / length(a)) : [...a];
export const vector = (a: { x: number; y: number; z: number }): Vec3 => [a.x, a.y, a.z];
export const quaternion = (a: { x: number; y: number; z: number; w: number }): Quaternion => [
  a.x,
  a.y,
  a.z,
  a.w,
];
export const rv = (a: Vec3): { x: number; y: number; z: number } => ({ x: a[0], y: a[1], z: a[2] });
export const rq = (a: Quaternion): { x: number; y: number; z: number; w: number } => ({
  x: a[0],
  y: a[1],
  z: a[2],
  w: a[3],
});
export const rotate = (p: Vec3, q: Quaternion): Vec3 => {
  const xyz: Vec3 = [q[0], q[1], q[2]];
  return add(p, add(scale(cross(xyz, p), 2 * q[3]), scale(cross(xyz, cross(xyz, p)), 2)));
};
export function finiteVector(value: Vec3, label = "vector", max = 1e6): Vec3 {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((x) => !Number.isFinite(x) || Math.abs(x) > max)
  )
    throw Object.assign(new Error(`Invalid ${label}`), { code: "INVALID_VECTOR" });
  return [...value];
}
export function finiteQuaternion(value: Quaternion): Quaternion {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some((x) => !Number.isFinite(x)) ||
    Math.abs(Math.hypot(...value) - 1) > 1e-5
  )
    throw Object.assign(new Error("Invalid quaternion"), { code: "INVALID_QUATERNION" });
  return [...value];
}
export function stableHash(text: string): string {
  let n = 14695981039346656037n;
  for (const c of text)
    n = BigInt.asUintN(64, (n ^ BigInt(c.codePointAt(0) ?? 0)) * 1099511628211n);
  return n.toString(16).padStart(16, "0");
}
