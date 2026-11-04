/** Pure conversion from a finished transform-gizmo drag to the minimal scene patch. */
export type GizmoMode = "translate" | "rotate" | "scale";
export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export interface GizmoStart {
  /** Scene validation: spheres need equal axes, capsules equal width/depth and height >= width. */
  shape: "box" | "sphere" | "capsule";
  positionM: Vec3;
  orientationQuaternion: Quat;
  dimensionsM: Vec3;
}
export interface GizmoEnd {
  positionM: Vec3;
  orientationQuaternion: Quat;
  /** Group scale at drag end; the group scale is 1 at drag start. */
  scale: Vec3;
}
export type GizmoPatch =
  | { positionM: [number, number, number] }
  | { orientationQuaternion: [number, number, number, number] }
  | { dimensionsM: [number, number, number] };

export const MIN_GIZMO_DIMENSION_M = 0.05;
const EPSILON = 1e-6;

const finite = (values: readonly number[]) => values.every((value) => Number.isFinite(value));
const same = (a: readonly number[], b: readonly number[]) =>
  a.every((value, index) => Math.abs(value - b[index]!) <= EPSILON);

/**
 * Returns the single-field patch for the active mode, or null when the drag changed
 * nothing or produced non-finite numbers. Runtime validation stays authoritative.
 */
export function gizmoDragPatch(
  mode: GizmoMode,
  start: GizmoStart,
  end: GizmoEnd,
): GizmoPatch | null {
  if (mode === "translate") {
    if (!finite(end.positionM) || same(start.positionM, end.positionM)) return null;
    return { positionM: [...end.positionM] };
  }
  if (mode === "rotate") {
    if (!finite(end.orientationQuaternion)) return null;
    const length = Math.hypot(...end.orientationQuaternion);
    if (length < EPSILON) return null;
    const q = end.orientationQuaternion.map((value) => value / length) as [
      number,
      number,
      number,
      number,
    ];
    // q and -q are the same rotation.
    const dot = q.reduce((sum, value, i) => sum + value * start.orientationQuaternion[i]!, 0);
    if (Math.abs(dot) >= 1 - EPSILON) return null;
    return { orientationQuaternion: q };
  }
  if (!finite(end.scale) || !finite(start.dimensionsM)) return null;
  const [sx, sy, sz] = end.scale;
  const dominant = (a: number, b: number) => (Math.abs(a - 1) >= Math.abs(b - 1) ? a : b);
  const [x, y, z] = start.dimensionsM;
  let dimensions: [number, number, number];
  if (start.shape === "sphere") {
    const f = dominant(dominant(sx, sy), sz);
    dimensions = [x * f, x * f, x * f];
  } else if (start.shape === "capsule") {
    const f = dominant(sx, sz);
    dimensions = [x * f, y * sy, x * f];
  } else dimensions = [x * sx, y * sy, z * sz];
  dimensions = dimensions.map((value) => Math.max(MIN_GIZMO_DIMENSION_M, value)) as [
    number,
    number,
    number,
  ];
  if (start.shape === "capsule") dimensions[1] = Math.max(dimensions[1], dimensions[0]);
  return same(dimensions, start.dimensionsM) ? null : { dimensionsM: dimensions };
}
