import { AcousticSolverError, createBoxSurfaces } from "../acoustics/index.js";
import type {
  AcousticMaterial,
  AcousticRequest,
  Atmosphere,
  SolverBudget,
  Vec3,
} from "../acoustics/types.js";
import type { RecordedPose } from "../experiments/types.js";
import type { BodyPose } from "../physics/types.js";
import { stableHash } from "../physics/math.js";
import { createScene } from "../scene/index.js";
import type { SceneSpec } from "../scene/types.js";

export type AcousticPose =
  | Pick<BodyPose, "objectId" | "positionMetres" | "rotation">
  | Pick<RecordedPose, "objectId" | "positionM" | "orientationQuaternion">;
export interface AcousticSourceInput {
  id: string;
  objectId: string;
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

const compareIds = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** The same finite box geometry and voice positions feed live, replay and A/B solving. */
export function buildAcousticRequests(input: AcousticInput): AcousticRequest[] {
  const scene = createScene(input.scene);
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
    maxSurfaces: 256,
    maxSegmentTests: 10000,
    ...input.budget,
  };
  const sourceIds = new Set<string>();
  const objects = [...scene.objects].sort(compareIds);
  // Geometry is identical for all sources in this snapshot. Keep the cache local
  // to this call so a new tick, pose or authored revision is always rebuilt.
  const boxSurfaces = new Map<string, ReturnType<typeof createBoxSurfaces>>();
  return [...input.sources].sort(compareIds).map((source: AcousticSourceInput): AcousticRequest => {
    if (sourceIds.has(source.id) || !objectIds.has(source.objectId))
      throw new AcousticSolverError(
        "SOURCE_IDENTITY",
        "Acoustic source identity is duplicated or owner is unknown",
      );
    sourceIds.add(source.id);
    const surfaces = objects.flatMap((object) => {
      if (object.id === source.objectId || object.shape !== "box" || object.acousticRole === "none")
        return [];
      const cached = boxSurfaces.get(object.id);
      if (cached) return structuredClone(cached);
      const pose = poseMap.get(object.id);
      if (!pose && object.mode !== "fixed")
        throw new AcousticSolverError(
          "POSE_REQUIRED",
          `Moving acoustic object lacks a pose: ${object.id}`,
        );
      const prepared = createBoxSurfaces({
        id: object.id,
        positionM: pose
          ? "positionMetres" in pose
            ? pose.positionMetres
            : pose.positionM
          : object.positionM,
        orientationQuaternion: pose
          ? "rotation" in pose
            ? pose.rotation
            : pose.orientationQuaternion
          : object.orientationQuaternion,
        dimensionsM: object.dimensionsM,
        materialId: object.acousticMaterialId,
        // Moving objects are occluder snapshots even if authored as reflectors.
        role:
          object.mode === "fixed" && object.acousticRole === "staticSurface"
            ? "staticReflector"
            : "dynamicOccluder",
      });
      boxSurfaces.set(object.id, prepared);
      // The first request owns these new faces; later requests receive clones.
      // Nothing from the call-local cache escapes separately or survives this call.
      return prepared;
    });
    if (surfaces.length > budget.maxSurfaces)
      throw new AcousticSolverError(
        "SURFACE_BUDGET",
        "Complete acoustic geometry exceeds the surface budget",
      );
    return {
      requestId: `solve.${stableHash(`${scene.sceneId}|${scene.sceneRevision}|${input.tick}|${source.id}`)}`,
      sceneRevision: scene.sceneRevision,
      geometryRevision: scene.sceneRevision,
      poseTick: input.tick,
      topologyId: scene.sceneId,
      source: { id: source.id, positionM: [...source.positionM] },
      listener: { id: input.listener.id, positionM: [...input.listener.positionM] },
      surfaces,
      materials: structuredClone(input.materials),
      atmosphere: structuredClone(input.atmosphere),
      budget,
    };
  });
}
