import { AcousticSolverError, createBoxSurfaces } from "../acoustics/index.js";
import type { AcousticGeometryCache } from "./acoustic-geometry-cache.js";
import type {
  AcousticMaterial,
  AcousticBoxOccluder,
  AcousticPrimitive,
  AcousticSurface,
  AcousticRequest,
  Atmosphere,
  SolverBudget,
  Vec3,
} from "../acoustics/types.js";
import type { RecordedPose } from "../experiments/types.js";
import type { BodyPose } from "../physics/types.js";
import { stableHash } from "../physics/math.js";
import { createScene } from "../scene/index.js";
import type { SceneObject, SceneSpec } from "../scene/types.js";
import {
  acousticSnapshotRole,
  acousticSceneSolverVersion,
  ACOUSTIC_SURFACE_BUDGET,
  EXTENDED_ACOUSTIC_MODEL_VERSION,
  supportsAcousticShape,
} from "../capabilities/acoustic-geometry.js";

export type AcousticPose =
  | Pick<BodyPose, "objectId" | "positionMetres" | "rotation">
  | Pick<RecordedPose, "objectId" | "positionM" | "orientationQuaternion">;
export interface AcousticSourceInput {
  id: string;
  objectId: string;
  /** Undefined retains legacy owner exclusion; null is detached (for example a zone center). */
  emitterObjectId?: string | null;
  positionM: Vec3;
}
export interface AcousticInput {
  scene: SceneSpec;
  poses: readonly AcousticPose[];
  /** The caller supplies actual voices or explicitly requested preview sources. */
  sources: readonly AcousticSourceInput[];
  listener: { id: string; positionM: Vec3 };
  tick: number;
  materials: readonly AcousticMaterial[];
  atmosphere: Atmosphere;
  budget?: SolverBudget;
}

/** Validate and retain the same indexed numeric values used by keys and geometry creation. */
function numericPoseSnapshot(
  positionInput: Vec3,
  orientationInput: readonly [number, number, number, number],
  invalid: () => Error,
) {
  const position: Vec3 = [positionInput?.[0]!, positionInput?.[1]!, positionInput?.[2]!];
  const orientation: readonly [number, number, number, number] = [
    orientationInput?.[0]!,
    orientationInput?.[1]!,
    orientationInput?.[2]!,
    orientationInput?.[3]!,
  ];
  if (
    !Array.isArray(positionInput) ||
    positionInput.length !== 3 ||
    !Array.isArray(orientationInput) ||
    orientationInput.length !== 4 ||
    !position.every(Number.isFinite) ||
    !orientation.every(Number.isFinite) ||
    Math.abs(Math.hypot(...orientation) - 1) > 1e-6
  )
    throw invalid();
  return { position, orientation };
}

const compareIds = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** The same bounded planar/analytic geometry feeds live, replay and A/B solving. */
export function buildAcousticRequests(
  input: AcousticInput,
  cache?: AcousticGeometryCache,
): AcousticRequest[] {
  const scene = createScene(input.scene);
  const sceneVersion = acousticSceneSolverVersion(scene);
  if (!Number.isSafeInteger(input.tick) || input.tick < 0)
    throw new AcousticSolverError(
      "INVALID_TICK",
      "Acoustic pose tick must be a nonnegative integer",
    );
  if (!Array.isArray(input.sources) || input.sources.length > 16)
    throw new AcousticSolverError(
      "SOURCE_BUDGET",
      "At most 16 explicit acoustic sources are supported",
    );
  if (!Array.isArray(input.poses) || input.poses.length > 256)
    throw new AcousticSolverError("POSE_BUDGET", "At most 256 object poses are supported");
  const objectIds = new Set(scene.objects.map((object) => object.id));
  const poseMap = new Map<string, AcousticPose>();
  for (const pose of input.poses) {
    if (poseMap.has(pose.objectId) || !objectIds.has(pose.objectId))
      throw new AcousticSolverError(
        "POSE_IDENTITY",
        "Acoustic pose identity is duplicated or unknown",
      );
    poseMap.set(pose.objectId, pose);
  }
  const budget = {
    maxPaths: 8,
    maxSurfaces: ACOUSTIC_SURFACE_BUDGET,
    maxSegmentTests: 10000,
    ...input.budget,
  };
  const sourceIds = new Set<string>();
  const objects = [...scene.objects].sort(compareIds);
  // Source-local membership and compaction remain independent. This small local map
  // avoids repeated lookups; the optional persistent cache compares complete geometry content.
  const geometryCache = new Map<
    string,
    {
      surfaces: AcousticSurface[];
      primitive?: AcousticPrimitive;
      boxOccluder?: AcousticBoxOccluder;
    }
  >();
  const geometryFor = (object: SceneObject, compactOccluders: boolean) => {
    const analyticBox =
      compactOccluders &&
      object.shape === "box" &&
      acousticSnapshotRole(object.mode, object.acousticRole) === "dynamicOccluder";
    const cacheKey = object.id + (analyticBox ? "|volume" : "|faces");
    const cached = geometryCache.get(cacheKey);
    if (cached) return cached;
    const pose = poseMap.get(object.id);
    if (!pose && object.mode !== "fixed")
      throw new AcousticSolverError(
        "POSE_REQUIRED",
        "Moving acoustic object lacks a pose: " + object.id,
      );
    const positionInput = pose
      ? "positionMetres" in pose
        ? pose.positionMetres
        : pose.positionM
      : object.positionM;
    const orientationInput = pose
      ? "rotation" in pose
        ? pose.rotation
        : pose.orientationQuaternion
      : object.orientationQuaternion;
    const role = acousticSnapshotRole(object.mode, object.acousticRole);
    if (role === null)
      throw new AcousticSolverError(
        "INVALID_GEOMETRY_ROLE",
        "Excluded geometry cannot be prepared",
      );
    const { position, orientation } = numericPoseSnapshot(positionInput, orientationInput, () =>
      !analyticBox && object.shape === "box"
        ? new RangeError("Invalid box acoustic geometry")
        : new AcousticSolverError(
            "INVALID_GEOMETRY_POSE",
            "Analytic geometry requires a finite position and unit orientation: " + object.id,
          ),
    );
    const identity = cache
      ? JSON.stringify(
          [
            scene.sceneId,
            scene.sceneRevision,
            sceneVersion,
            object.id,
            object.shape,
            object.mode,
            object.acousticRole,
            role,
            object.acousticMaterialId,
            [object.dimensionsM[0], object.dimensionsM[1], object.dimensionsM[2]],
            [position[0], position[1], position[2]],
            [orientation[0], orientation[1], orientation[2], orientation[3]],
            analyticBox,
          ],
          (_key, value: unknown) => (Object.is(value, -0) ? "acoustic:negative-zero" : value),
        )
      : "";
    const createGeometry = () => {
      let prepared: {
        surfaces: AcousticSurface[];
        primitive?: AcousticPrimitive;
        boxOccluder?: AcousticBoxOccluder;
      };

      if (analyticBox) {
        prepared = {
          surfaces: [],
          boxOccluder: {
            id: object.id + ".volume",
            materialId: object.acousticMaterialId,
            centerM: [position[0]!, position[1]!, position[2]!],
            halfExtentsM: [
              object.dimensionsM[0] / 2,
              object.dimensionsM[1] / 2,
              object.dimensionsM[2] / 2,
            ],
            orientationQuaternion: [
              orientation[0]!,
              orientation[1]!,
              orientation[2]!,
              orientation[3]!,
            ],
          },
        };
      } else if (object.shape === "box") {
        prepared = {
          surfaces: createBoxSurfaces({
            id: object.id,
            positionM: position,
            orientationQuaternion: orientation,
            dimensionsM: object.dimensionsM,
            materialId: object.acousticMaterialId,
            role,
          }),
        };
      } else {
        const primitive: AcousticPrimitive = {
          id: object.id + ".body",
          kind: object.shape,
          materialId: object.acousticMaterialId,
          role,
          centerM: [position[0]!, position[1]!, position[2]!],
          radiusM: object.dimensionsM[0] / 2,
        };
        if (object.shape === "capsule") {
          const [x, y, z, w] = orientation;
          primitive.axis = [
            2 * (x! * y! - z! * w!),
            1 - 2 * (x! * x! + z! * z!),
            2 * (y! * z! + x! * w!),
          ];
          primitive.halfLengthM = (object.dimensionsM[1] - object.dimensionsM[0]) / 2;
        }
        prepared = { surfaces: [], primitive };
      }
      return prepared;
    };
    const prepared = cache
      ? cache.prepare(
          JSON.stringify([scene.sceneId, object.id, analyticBox]),
          identity,
          createGeometry,
        )
      : createGeometry();
    geometryCache.set(cacheKey, prepared);
    return prepared;
  };
  return [...input.sources].sort(compareIds).map((source: AcousticSourceInput): AcousticRequest => {
    if (sourceIds.has(source.id) || !objectIds.has(source.objectId))
      throw new AcousticSolverError(
        "SOURCE_IDENTITY",
        "Acoustic source identity is duplicated or owner is unknown",
      );
    const excludedEmitter =
      source.emitterObjectId === undefined ? source.objectId : source.emitterObjectId;
    if (
      excludedEmitter !== null &&
      (typeof excludedEmitter !== "string" || !objectIds.has(excludedEmitter))
    )
      throw new AcousticSolverError(
        "SOURCE_EMITTER_IDENTITY",
        "Explicit acoustic emitter body is unknown",
      );
    // An explicit physical emitter is also an authoritative snapshot reference,
    // even though its body is excluded from its own propagation query.
    if (typeof source.emitterObjectId === "string") {
      const emitter = objects.find((object) => object.id === source.emitterObjectId)!;
      const pose = poseMap.get(emitter.id);
      if (!pose && emitter.mode !== "fixed")
        throw new AcousticSolverError(
          "POSE_REQUIRED",
          "Explicit moving emitter lacks a pose: " + emitter.id,
        );
      const position = pose
        ? "positionMetres" in pose
          ? pose.positionMetres
          : pose.positionM
        : emitter.positionM;
      const orientation = pose
        ? "rotation" in pose
          ? pose.rotation
          : pose.orientationQuaternion
        : emitter.orientationQuaternion;
      numericPoseSnapshot(
        position,
        orientation,
        () =>
          new AcousticSolverError(
            "INVALID_GEOMETRY_POSE",
            "Explicit emitter requires a finite position and unit orientation: " + emitter.id,
          ),
      );
    }
    sourceIds.add(source.id);
    const surfaces: AcousticSurface[] = [];
    const primitives: AcousticPrimitive[] = [];
    const boxOccluders: AcousticBoxOccluder[] = [];
    const includedObjects = objects.filter(
      (object) => object.id !== excludedEmitter && object.acousticRole !== "none",
    );
    const uncompactedCount = includedObjects.reduce(
      (count, object) => count + (object.shape === "box" ? 6 : 1),
      0,
    );
    const compactOccluders =
      sceneVersion === EXTENDED_ACOUSTIC_MODEL_VERSION && uncompactedCount > budget.maxSurfaces;
    for (const object of includedObjects) {
      if (!supportsAcousticShape(object.shape))
        throw new AcousticSolverError("GEOMETRY_UNSUPPORTED", "Unsupported acoustic shape");
      const geometry = geometryFor(object, compactOccluders);
      // No cache-owned array escapes. Each source owns its geometry snapshot.
      surfaces.push(...structuredClone(geometry.surfaces));
      if (geometry.primitive) primitives.push(structuredClone(geometry.primitive));
      if (geometry.boxOccluder) boxOccluders.push(structuredClone(geometry.boxOccluder));
    }
    if (surfaces.length + primitives.length + boxOccluders.length > budget.maxSurfaces)
      throw new AcousticSolverError(
        "SURFACE_BUDGET",
        "Complete acoustic geometry exceeds the shared surface/primitive/box-occluder budget",
      );
    return {
      requestId: `solve.${stableHash(`${scene.sceneId}|${scene.sceneRevision}|${input.tick}|${source.id}`)}`,
      sceneRevision: scene.sceneRevision,
      geometryRevision: scene.sceneRevision,
      poseTick: input.tick,
      topologyId: scene.sceneId,
      ...(sceneVersion === EXTENDED_ACOUSTIC_MODEL_VERSION ? { modelVersion: sceneVersion } : {}),
      source: { id: source.id, positionM: [...source.positionM] },
      listener: { id: input.listener.id, positionM: [...input.listener.positionM] },
      surfaces,
      ...(primitives.length ? { primitives } : {}),
      ...(boxOccluders.length ? { boxOccluders } : {}),
      materials: structuredClone(input.materials),
      atmosphere: structuredClone(input.atmosphere),
      budget,
    };
  });
}
