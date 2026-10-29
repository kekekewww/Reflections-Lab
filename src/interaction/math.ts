import type { Quaternion, SceneObject, Vec3 } from "../scene/types.js";
import { InteractionError } from "./types.js";
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: Vec3): number => Math.hypot(...a);
export const normalize = (a: Vec3): Vec3 => (norm(a) > 1e-10 ? mul(a, 1 / norm(a)) : [0, 0, 0]);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));
export function finite(n: number, label: string, min = -1e6, max = 1e6): number {
  if (!Number.isFinite(n) || n < min || n > max)
    throw new InteractionError("INVALID_INPUT", `${label} 必須為有限合法數值。`);
  return n;
}
export function vector(v: Vec3, label: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3)
    throw new InteractionError("INVALID_INPUT", `${label} 需要三個座標。`);
  return [
    finite(v[0], label, -200, 200),
    finite(v[1], label, -200, 200),
    finite(v[2], label, -200, 200),
  ];
}
export function quaternion(q: Quaternion): Quaternion {
  if (
    !Array.isArray(q) ||
    q.length !== 4 ||
    q.some((n) => !Number.isFinite(n)) ||
    Math.abs(Math.hypot(...q) - 1) > 1e-5
  )
    throw new InteractionError("INVALID_INPUT", "方向必須是正規化 quaternion。");
  return [...q];
}
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const q: Quaternion = [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const length = Math.hypot(...q);
  return q.map((x) => x / length) as Quaternion;
}
export const axisAngle = (axis: Vec3, angle: number): Quaternion => {
  const a = normalize(axis),
    s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
};
export const cameraRotation = (yaw: number, pitch: number): Quaternion =>
  multiply(axisAngle([0, 1, 0], yaw), axisAngle([1, 0, 0], pitch));
export function rotate(p: Vec3, q: Quaternion): Vec3 {
  const xyz: Vec3 = [q[0], q[1], q[2]];
  return add(p, add(mul(cross(xyz, p), 2 * q[3]), mul(cross(xyz, cross(xyz, p)), 2)));
}
/** Exact support radius of the Scene primitives along the given world normal. */
export function supportRadius(
  object: SceneObject,
  normal: Vec3,
  q = object.orientationQuaternion,
): number {
  const n = normalize(normal),
    d = object.dimensionsM;
  if (object.shape === "sphere") return d[0] / 2;
  if (object.shape === "capsule")
    return d[0] / 2 + Math.max(0, (d[1] - d[0]) / 2) * Math.abs(dot(rotate([0, 1, 0], q), n));
  return (
    (Math.abs(dot(rotate([1, 0, 0], q), n)) * d[0]) / 2 +
    (Math.abs(dot(rotate([0, 1, 0], q), n)) * d[1]) / 2 +
    (Math.abs(dot(rotate([0, 0, 1], q), n)) * d[2]) / 2
  );
}
export function surfaceRotation(normal: Vec3, yaw: number): Quaternion {
  const up: Vec3 = [0, 1, 0],
    n = normalize(normal),
    axis = cross(up, n),
    c = clamp(dot(up, n), -1, 1);
  const aligned =
    norm(axis) < 1e-8
      ? c < 0
        ? axisAngle([1, 0, 0], Math.PI)
        : ([0, 0, 0, 1] as Quaternion)
      : axisAngle(axis, Math.acos(c));
  return multiply(axisAngle(n, yaw), aligned);
}
