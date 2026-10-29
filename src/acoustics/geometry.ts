import type { AcousticSurface, Vec3 } from "./types.js";

export const EPSILON_M = 1e-7;
export const add = (a: Vec3, b: Vec3): [number, number, number] => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): [number, number, number] => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const scale = (a: Vec3, t: number): [number, number, number] => [
  a[0] * t,
  a[1] * t,
  a[2] * t,
];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(...a);
export const unit = (a: Vec3): [number, number, number] => scale(a, 1 / length(a));

export interface PreparedSurface {
  id: string;
  materialId: string;
  point: Vec3;
  normal: Vec3;
  windingNormal: Vec3;
  vertices: readonly Vec3[];
  twoSided: boolean;
  role: "staticReflector" | "dynamicOccluder";
}

export function insidePolygon(point: Vec3, surface: PreparedSurface): boolean {
  return surface.vertices.every((v, i) => {
    const next = surface.vertices[(i + 1) % surface.vertices.length]!;
    return (
      dot(cross(sub(next, v), sub(point, v)), surface.windingNormal) >=
      -EPSILON_M * length(sub(next, v))
    );
  });
}

/** The open segment excludes only its actual endpoints, never an entire reflection plane. */
export function segmentIntersection(a: Vec3, b: Vec3, surface: PreparedSurface): Vec3 | null {
  const d = sub(b, a),
    segmentLength = length(d),
    denominator = dot(surface.normal, d);
  if (segmentLength <= EPSILON_M || Math.abs(denominator) <= EPSILON_M) return null;
  const t = dot(surface.normal, sub(surface.point, a)) / denominator;
  const endpointTolerance = EPSILON_M / segmentLength;
  if (t <= endpointTolerance || t >= 1 - endpointTolerance) return null;
  const hit = add(a, scale(d, t));
  return insidePolygon(hit, surface) ? hit : null;
}

export function reflectionPoint(
  source: Vec3,
  listener: Vec3,
  surface: PreparedSurface,
): Vec3 | null {
  const sourceSide = dot(surface.normal, sub(source, surface.point));
  const listenerSide = dot(surface.normal, sub(listener, surface.point));
  if (
    Math.abs(sourceSide) <= EPSILON_M ||
    Math.abs(listenerSide) <= EPSILON_M ||
    sourceSide * listenerSide <= 0
  )
    return null;
  if (!surface.twoSided && (sourceSide < 0 || listenerSide < 0)) return null;
  const mirrored = sub(source, scale(surface.normal, 2 * sourceSide));
  return segmentIntersection(listener, mirrored, surface);
}

export interface BoxSurfaceInput {
  id: string;
  positionM: Vec3;
  dimensionsM: Vec3;
  orientationQuaternion?: readonly [number, number, number, number];
  materialId: string;
  role?: "staticReflector" | "dynamicOccluder";
}

/** Exact planar faces for an oriented box; this does not approximate curved objects. */
export function createBoxSurfaces(input: BoxSurfaceInput): AcousticSurface[] {
  const { id, positionM, dimensionsM, materialId } = input;
  const q = input.orientationQuaternion ?? [0, 0, 0, 1];
  if (
    !/^[a-z][a-z0-9._-]{0,63}$/.test(id) ||
    !/^[a-z][a-z0-9._-]{0,63}$/.test(materialId) ||
    (input.role !== undefined &&
      input.role !== "staticReflector" &&
      input.role !== "dynamicOccluder") ||
    positionM.length !== 3 ||
    !Array.from(positionM).every(Number.isFinite) ||
    dimensionsM.length !== 3 ||
    !Array.from(dimensionsM).every((n) => Number.isFinite(n) && n > 0 && n <= 100) ||
    q.length !== 4 ||
    q.some((n) => !Number.isFinite(n)) ||
    Math.abs(Math.hypot(...q) - 1) > 1e-6
  )
    throw new RangeError("Invalid box acoustic geometry");
  const rotate = (v: Vec3): [number, number, number] => {
    const u: Vec3 = [q[0], q[1], q[2]];
    return add(v, add(scale(cross(u, v), 2 * q[3]), scale(cross(u, cross(u, v)), 2)));
  };
  const [x, y, z] = dimensionsM.map((n) => n / 2) as [number, number, number];
  const faces: readonly [string, Vec3, readonly Vec3[]][] = [
    [
      "px",
      [1, 0, 0],
      [
        [x, -y, -z],
        [x, y, -z],
        [x, y, z],
        [x, -y, z],
      ],
    ],
    [
      "nx",
      [-1, 0, 0],
      [
        [-x, -y, z],
        [-x, y, z],
        [-x, y, -z],
        [-x, -y, -z],
      ],
    ],
    [
      "py",
      [0, 1, 0],
      [
        [-x, y, -z],
        [-x, y, z],
        [x, y, z],
        [x, y, -z],
      ],
    ],
    [
      "ny",
      [0, -1, 0],
      [
        [-x, -y, z],
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
      ],
    ],
    [
      "pz",
      [0, 0, 1],
      [
        [x, -y, z],
        [x, y, z],
        [-x, y, z],
        [-x, -y, z],
      ],
    ],
    [
      "nz",
      [0, 0, -1],
      [
        [-x, -y, -z],
        [-x, y, -z],
        [x, y, -z],
        [x, -y, -z],
      ],
    ],
  ];
  return faces.map(([suffix, normal, vertices]) => ({
    id: `${id}.${suffix}`,
    materialId,
    normal: rotate(normal),
    verticesM: vertices.map((v) => add(rotate(v), positionM)),
    twoSided: false,
    ...(input.role ? { role: input.role } : {}),
  }));
}
