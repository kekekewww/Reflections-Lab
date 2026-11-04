import { acousticPayloadBytes } from "./acoustic-payload.js";
import type {
  AcousticBoxOccluder,
  AcousticMaterial,
  AcousticPrimitive,
  AcousticRequest,
  AcousticSurface,
} from "../acoustics/types.js";

export type AcousticTransport = "clone" | "deduplicated";
type PackedRequest = Omit<
  AcousticRequest,
  "surfaces" | "primitives" | "boxOccluders" | "materials"
> & {
  surfaceRefs: number[];
  materialRefs: number[];
  primitiveRefs?: number[];
  boxOccluderRefs?: number[];
};
export interface AcousticBatchPacket {
  protocol: "acoustic-batch/1";
  requests: PackedRequest[];
  surfaces: AcousticSurface[];
  primitives: AcousticPrimitive[];
  boxOccluders: AcousticBoxOccluder[];
  materials: AcousticMaterial[];
}
const maxSources = 32,
  maxGeometry = 256,
  maxTable = maxSources * maxGeometry;
const fail = (): never => {
  throw new Error("ACOUSTIC_PACKET_INVALID");
};
function dense(value: unknown, max: number): value is unknown[] {
  if (!Array.isArray(value) || value.length > max || Object.keys(value).length !== value.length)
    return false;
  for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) return false;
  return true;
}
function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
const headerKeys = new Set([
  "protocol",
  "requests",
  "surfaces",
  "primitives",
  "boxOccluders",
  "materials",
]);
const requestKeys = new Set([
  "requestId",
  "sceneRevision",
  "geometryRevision",
  "poseTick",
  "topologyId",
  "modelVersion",
  "source",
  "listener",
  "atmosphere",
  "bandCentersHz",
  "budget",
  "surfaceRefs",
  "materialRefs",
  "primitiveRefs",
  "boxOccluderRefs",
]);

const inputKeys = new Set(
  [...requestKeys]
    .filter((key) => !key.endsWith("Refs"))
    .concat(["surfaces", "primitives", "boxOccluders", "materials"]),
);
/** Only indexed reads: caller methods, iterators, constructors and species are not executed. */
function indexedMap<T, R>(values: readonly T[], convert: (value: T, index: number) => R): R[] {
  const result: R[] = [];
  for (let index = 0; index < values.length; index++) result.push(convert(values[index]!, index));
  return result;
}
/** Detect enumerable accessors without reading them or altering clone's snapshot timing. */
function accessorFreeSnapshot(root: unknown): boolean {
  const stack: unknown[] = [root],
    seen = new WeakSet<object>();
  let nodes = 1;
  while (stack.length) {
    const value = stack.pop();
    if (value === null || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const keys = Object.keys(value);
    nodes += keys.length;
    if (keys.length > 4096 || nodes > 200_000) return false;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return false;
      const child: unknown = descriptor.value;
      if (child !== null && typeof child === "object") stack.push(child);
    }
  }
  return true;
}
/** Unknown caller metadata retains the ordinary clone reference behavior. */
export function canPackAcousticBatch(requests: readonly AcousticRequest[]): boolean {
  if (!accessorFreeSnapshot(requests)) return false;
  for (let index = 0; index < requests.length; index++) {
    const request = requests[index];
    if (!record(request) || Object.keys(request).some((key) => !inputKeys.has(key))) return false;
  }
  return true;
}

/** Exact bounded packet representation accepted by the Worker's pre-reconstruction guard. */
export function acousticPacketBytes(packet: AcousticBatchPacket): number {
  return acousticPayloadBytes(packet, maxTable);
}

/** A typed structural identity cannot alias malformed arrays/strings with optional scalar values. */
function contentKey(value: unknown, depth = 0): string {
  if (depth > 16) return fail();
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail();
    return "number:" + (Object.is(value, -0) ? "-0" : String(value));
  }
  if (typeof value === "string") {
    if (value.length > 8192) return fail();
    return "string:" + JSON.stringify(value);
  }
  if (typeof value === "boolean") return "boolean:" + String(value);
  if (Array.isArray(value)) {
    if (!dense(value, 4096)) return fail();
    return "array:[" + indexedMap(value, (entry) => contentKey(entry, depth + 1)).join(",") + "]";
  }
  if (!record(value) || Object.keys(value).length > 64) return fail();
  return (
    "object:{" +
    indexedMap(
      Object.entries(value),
      ([key, entry]) => JSON.stringify(key) + ":" + contentKey(entry, depth + 1),
    ).join(",") +
    "}"
  );
}
function table<T>() {
  const values: T[] = [],
    indices = new Map<string, number>();
  return {
    values,
    add(value: T): number {
      const key = contentKey(value),
        existing = indices.get(key);
      if (existing !== undefined) return existing;
      if (values.length >= maxTable) return fail();
      const index = values.length;
      // Only the packet owns these clones; native postMessage snapshots them synchronously.
      values.push(structuredClone(value));
      indices.set(key, index);
      return index;
    },
  };
}

/** Remove repeated DTO values within one batch. This does not transfer or detach caller data. */
export function packAcousticBatch(requests: readonly AcousticRequest[]): AcousticBatchPacket {
  if (!dense(requests, maxSources) || !canPackAcousticBatch(requests)) return fail();
  const surfaces = table<AcousticSurface>(),
    primitives = table<AcousticPrimitive>(),
    boxes = table<AcousticBoxOccluder>(),
    materials = table<AcousticMaterial>();
  const packed = indexedMap<AcousticRequest, PackedRequest>(requests, (request): PackedRequest => {
    if (
      !record(request) ||
      !dense(request.surfaces, maxGeometry) ||
      !dense(request.materials, maxGeometry) ||
      (request.primitives !== undefined && !dense(request.primitives, maxGeometry)) ||
      (request.boxOccluders !== undefined && !dense(request.boxOccluders, maxGeometry)) ||
      request.surfaces.length +
        (request.primitives?.length ?? 0) +
        (request.boxOccluders?.length ?? 0) >
        maxGeometry
    )
      return fail();
    const {
      surfaces: faces,
      primitives: curved,
      boxOccluders: volumes,
      materials: bands,
      ...rest
    } = request;
    // Endpoint, budget and atmosphere remain source-local owned scalars/arrays.
    return {
      ...structuredClone(rest),
      surfaceRefs: indexedMap(faces, surfaces.add),
      materialRefs: indexedMap(bands, materials.add),
      ...(curved !== undefined ? { primitiveRefs: indexedMap(curved, primitives.add) } : {}),
      ...(volumes !== undefined ? { boxOccluderRefs: indexedMap(volumes, boxes.add) } : {}),
    };
  });
  return {
    protocol: "acoustic-batch/1",
    requests: packed,
    surfaces: surfaces.values,
    primitives: primitives.values,
    boxOccluders: boxes.values,
    materials: materials.values,
  };
}

function references<T>(indices: unknown, values: readonly T[], used: Set<number>): T[] {
  if (!dense(indices, maxGeometry)) return fail();
  return indexedMap(indices, (index) => {
    if (
      typeof index !== "number" ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= values.length
    )
      return fail();
    used.add(index);
    return values[index]!;
  });
}

/** Worker-only reconstruction: shared packet DTOs are read by the solver, never published to UI. */
export function unpackAcousticBatch(packet: AcousticBatchPacket): AcousticRequest[] {
  try {
    acousticPacketBytes(packet);
  } catch {
    return fail();
  }
  if (
    !record(packet) ||
    packet.protocol !== "acoustic-batch/1" ||
    Object.keys(packet).some((key) => !headerKeys.has(key)) ||
    !dense(packet.requests, maxSources) ||
    !dense(packet.surfaces, maxTable) ||
    !dense(packet.primitives, maxTable) ||
    !dense(packet.boxOccluders, maxTable) ||
    !dense(packet.materials, maxTable)
  )
    return fail();
  const usedSurfaces = new Set<number>(),
    usedMaterials = new Set<number>(),
    usedPrimitives = new Set<number>(),
    usedBoxes = new Set<number>();
  const requests = indexedMap(packet.requests, (request) => {
    if (!record(request) || Object.keys(request).some((key) => !requestKeys.has(key)))
      return fail();
    const { surfaceRefs, materialRefs, primitiveRefs, boxOccluderRefs, ...rest } = request;
    const surfaces = references(surfaceRefs, packet.surfaces, usedSurfaces),
      materials = references(materialRefs, packet.materials, usedMaterials),
      primitives =
        primitiveRefs === undefined
          ? undefined
          : references(primitiveRefs, packet.primitives, usedPrimitives),
      boxes =
        boxOccluderRefs === undefined
          ? undefined
          : references(boxOccluderRefs, packet.boxOccluders, usedBoxes);
    if (surfaces.length + (primitives?.length ?? 0) + (boxes?.length ?? 0) > maxGeometry)
      return fail();
    return {
      ...rest,
      surfaces,
      materials,
      ...(primitives === undefined ? {} : { primitives }),
      ...(boxes === undefined ? {} : { boxOccluders: boxes }),
    };
  });
  if (
    usedSurfaces.size !== packet.surfaces.length ||
    usedMaterials.size !== packet.materials.length ||
    usedPrimitives.size !== packet.primitives.length ||
    usedBoxes.size !== packet.boxOccluders.length
  )
    return fail();
  return requests;
}
