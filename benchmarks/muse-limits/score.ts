import type { SceneSpec, SceneObject, Vec3 } from "../../src/scene/types.js";
import type { ToolRequest } from "../../src/ai/types.js";
import { rotate, sub, length, dot, normalize } from "../../src/physics/math.js";
import type { LimitsExpectation } from "./ladder.js";

export interface Bounds {
  min: Vec3;
  max: Vec3;
}
const axes = [0, 1, 2] as const;
const roomSurface = (o: SceneObject) =>
  o.mode === "fixed" && (o.id === "floor" || o.id.startsWith("wall.") || o.id.startsWith("room."));

/** World AABB of the actual primitive, including box/capsule quaternion rotation. */
export function objectBounds(o: SceneObject): Bounds {
  const basis = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map((v) => rotate(v as Vec3, o.orientationQuaternion));
  const radius = o.dimensionsM[0] / 2;
  const half = axes.map((i) =>
    o.shape === "sphere"
      ? radius
      : o.shape === "capsule"
        ? radius + Math.max(0, o.dimensionsM[1] / 2 - radius) * Math.abs(basis[1]![i])
        : axes.reduce<number>((s, j) => s + (Math.abs(basis[j]![i]) * o.dimensionsM[j]) / 2, 0),
  ) as Vec3;
  return {
    min: axes.map((i) => o.positionM[i] - half[i]) as Vec3,
    max: axes.map((i) => o.positionM[i] + half[i]) as Vec3,
  };
}
/** Missing open-front walls use the floor edge; no invented nominal room dimensions. */
export function roomInterior(scene: SceneSpec): Bounds {
  const surfaces = scene.objects.filter(roomSurface);
  const floor = surfaces.find((o) => o.id === "floor" || o.id === "room.floor");
  if (!floor) throw new Error("Scoring requires a fixed room floor.");
  const f = objectBounds(floor);
  const min: Vec3 = [f.min[0], f.max[1], f.min[2]];
  const max: Vec3 = [f.max[0], Infinity, f.max[2]];
  const walls = surfaces.filter((o) => o !== floor && !o.id.endsWith("ceiling"));
  for (const wall of walls) {
    const b = objectBounds(wall);
    const axis = b.max[0] - b.min[0] < b.max[2] - b.min[2] ? 0 : 2;
    if (wall.positionM[axis] < floor.positionM[axis]) min[axis] = Math.max(min[axis], b.max[axis]);
    else max[axis] = Math.min(max[axis], b.min[axis]);
  }
  const ceiling = surfaces.find((o) => o.id.endsWith("ceiling"));
  max[1] = ceiling
    ? objectBounds(ceiling).min[1]
    : Math.max(f.max[1], ...walls.map((o) => objectBounds(o).max[1]));
  return { min, max };
}
const overlap = (a: Bounds, b: Bounds, i: number) =>
  Math.min(a.max[i]!, b.max[i]!) - Math.max(a.min[i]!, b.min[i]!);
const outside = (b: Bounds, room: Bounds, tolerance: number) =>
  axes.some((i) => b.min[i] < room.min[i] - tolerance || b.max[i] > room.max[i] + tolerance);
function contains(o: SceneObject, point: Vec3): boolean {
  const q = o.orientationQuaternion;
  const p = rotate(sub(point, o.positionM), [-q[0], -q[1], -q[2], q[3]]);
  if (o.shape === "box") return axes.every((i) => Math.abs(p[i]) <= o.dimensionsM[i] / 2);
  const r = o.dimensionsM[0] / 2;
  if (o.shape === "sphere") return length(p) <= r;
  const h = Math.max(0, o.dimensionsM[1] / 2 - r);
  return Math.hypot(p[0], p[1] - Math.max(-h, Math.min(h, p[1])), p[2]) <= r;
}
function gridSpacingError(objects: SceneObject[]): number {
  // Cluster rows/columns to a centimetre; compare gaps separately along X and Z.
  let error = 0;
  for (const axis of [0, 2] as const) {
    const rows = new Map<number, number[]>();
    for (const o of objects) {
      const key = Math.round(o.positionM[axis === 0 ? 2 : 0] * 100);
      rows.set(key, [...(rows.get(key) ?? []), o.positionM[axis]]);
    }
    const gaps: number[] = [];
    for (const row of rows.values()) {
      row.sort((a, b) => a - b);
      for (let i = 1; i < row.length; i++) gaps.push(row[i]! - row[i - 1]!);
    }
    if (gaps.length) error = Math.max(error, Math.max(...gaps) - Math.min(...gaps));
  }
  return error;
}

/** Descriptive numbers only. Geometry is an AABB approximation, not collision simulation. */
function horizontalAngleDeg(a: Vec3, b: Vec3): number {
  const dot = a[0] * b[0] + a[2] * b[2];
  const cross = a[0] * b[2] - a[2] * b[0];
  return (Math.abs(Math.atan2(cross, dot)) * 180) / Math.PI;
}
/** Boxes have no marked front, so report both conventions: -Z is the project's forward axis. */
function arcScore(added: SceneObject[], candidate: SceneSpec, expect: LimitsExpectation) {
  if (!expect.arcAround || !added.length) return null;
  const target = candidate.objects.find((o) => o.id === expect.arcAround!.target);
  if (!target) return null;
  const toTarget = added.map((o) => sub(target.positionM, o.positionM));
  const radii = toTarget.map((d) => Math.hypot(d[0], d[2]));
  const minusZ = added.map((o, i) =>
    horizontalAngleDeg(rotate([0, 0, -1], o.orientationQuaternion), toTarget[i]!),
  );
  const plusZ = added.map((o, i) =>
    horizontalAngleDeg(rotate([0, 0, 1], o.orientationQuaternion), toTarget[i]!),
  );
  return {
    count: added.length,
    meanRadiusM: radii.reduce((sum, r) => sum + r, 0) / radii.length,
    maxRadiusErrorM: Math.max(...radii.map((r) => Math.abs(r - expect.arcAround!.radiusM))),
    maxFacingErrorDegMinusZ: Math.max(...minusZ),
    maxFacingErrorDegPlusZ: Math.max(...plusZ),
  };
}
export function scoreScene(
  before: SceneSpec,
  candidate: SceneSpec,
  requests: ToolRequest[],
  expect: LimitsExpectation,
) {
  const previous = new Set(before.objects.map((o) => o.id));
  const added = candidate.objects.filter((o) => !previous.has(o.id));
  const addedIds = new Set(added.map((o) => o.id));
  const room = roomInterior(candidate);
  const bounds = new Map(candidate.objects.map((o) => [o.id, objectBounds(o)]));
  const toolCounts: Record<string, number> = {};
  for (const r of requests) toolCounts[r.tool] = (toolCounts[r.tool] ?? 0) + 1;
  let intersectingPairs = 0;
  const nonRoom = candidate.objects.filter((o) => !roomSurface(o));
  for (let i = 0; i < nonRoom.length; i++)
    for (let j = i + 1; j < nonRoom.length; j++) {
      const a = nonRoom[i]!,
        b = nonRoom[j]!;
      if (
        (addedIds.has(a.id) || addedIds.has(b.id)) &&
        axes.every((k) => overlap(bounds.get(a.id)!, bounds.get(b.id)!, k) > 0.02 + 1e-9)
      )
        intersectingPairs++;
    }
  const unsupported = added.filter((o) => {
    if (o.mode === "kinematic") return false;
    const b = bounds.get(o.id)!;
    if (Math.abs(b.min[1] - room.min[1]) <= 0.03 + 1e-9) return false;
    return !candidate.objects.some((other) => {
      if (other.id === o.id) return false;
      const support = bounds.get(other.id)!;
      if (
        Math.abs(b.min[1] - support.max[1]) <= 0.03 + 1e-9 &&
        overlap(b, support, 0) > 0 &&
        overlap(b, support, 2) > 0
      )
        return true;
      return (
        roomSurface(other) &&
        other.id !== "floor" &&
        !other.id.endsWith("floor") &&
        !other.id.endsWith("ceiling") &&
        [0, 2].some(
          (i) =>
            (Math.abs(b.max[i]! - support.min[i]!) <= 0.03 + 1e-9 ||
              Math.abs(b.min[i]! - support.max[i]!) <= 0.03 + 1e-9) &&
            axes.filter((k) => k !== i).every((k) => overlap(b, support, k) > 0),
        )
      );
    });
  }).length;
  const paths = requests
    .filter((r) => r.tool === "SetTrajectory")
    .map((r) => {
      const objectId = String(r.arguments.objectId);
      const samples = r.arguments.samples as { timeS: number; positionM: Vec3 }[];
      const first = samples[0]!,
        last = samples.at(-1)!;
      const object = candidate.objects.find((o) => o.id === objectId);
      const expected = expect.path?.objectId === objectId ? expect.path : undefined;
      const centre =
        expected?.centre === "listener" ? candidate.listener.positionM : expected?.centre;
      const radii = centre
        ? samples.map((s) => Math.hypot(s.positionM[0] - centre[0], s.positionM[2] - centre[2]))
        : [];
      let peakSpeedMps = 0;
      for (let i = 1; i < samples.length; i++)
        peakSpeedMps = Math.max(
          peakSpeedMps,
          length(sub(samples[i]!.positionM, samples[i - 1]!.positionM)) /
            (samples[i]!.timeS - samples[i - 1]!.timeS),
        );
      return {
        objectId,
        samples: samples.length,
        durationS: last.timeS - first.timeS,
        peakSpeedMps,
        startDistanceM: object ? length(sub(first.positionM, object.positionM)) : null,
        endDistanceM: length(sub(first.positionM, last.positionM)),
        outsideRoom: samples.filter((s) => outside({ min: s.positionM, max: s.positionM }, room, 0))
          .length,
        meanRadiusM: radii.length ? radii.reduce((s, r) => s + r, 0) / radii.length : null,
        maxRadiusErrorM:
          radii.length && expected?.radiusM !== undefined
            ? Math.max(...radii.map((r) => Math.abs(r - expected.radiusM!)))
            : null,
      };
    });
  const target = candidate.objects.find((o) => o.id === expect.listenerFacingTarget);
  const direction = target ? sub(target.positionM, candidate.listener.positionM) : null;
  return {
    addedObjects: added.length,
    addedSources: candidate.sources.filter((s) => !before.sources.some((b) => b.id === s.id))
      .length,
    toolCounts,
    outsideRoom: added.filter((o) => outside(bounds.get(o.id)!, room, 0.05)).length,
    intersectingPairs,
    unsupported,
    arc: arcScore(added, candidate, expect),
    listenerMovedM: length(sub(candidate.listener.positionM, before.listener.positionM)),
    listenerInside: candidate.objects.filter((o) => contains(o, candidate.listener.positionM))
      .length,
    paths,
    listenerFacingErrorDeg:
      direction && length(direction) > 1e-12
        ? (Math.acos(
            Math.max(
              -1,
              Math.min(
                1,
                dot(
                  normalize(rotate([0, 0, -1], candidate.listener.orientationQuaternion)),
                  normalize(direction),
                ),
              ),
            ),
          ) *
            180) /
          Math.PI
        : null,
    gridSpacingErrorM: expect.evenGrid ? gridSpacingError(added) : null,
  };
}
