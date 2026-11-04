import type { AcousticGeometryRole, AcousticRequest } from "../acoustics/types.js";

export const LEGACY_ACOUSTIC_MODEL_VERSION = "web-geometric-1.0.0";
export const EXTENDED_ACOUSTIC_MODEL_VERSION = "web-geometric-primitives-1.0.0";

export const ACOUSTIC_GEOMETRY_CAPABILITIES = Object.freeze({
  id: "custom-web-geometric-primitives-v1",
  shapes: Object.freeze(["box", "sphere", "capsule"] as const),
  reflectionOrder: 1,
  curvedGeometry: "analyticPrimitiveSpecularPoint" as const,
  movingReflectors: "quasiStaticSnapshot" as const,
  magnitudeModel: "pathLengthSpreadingNoCurvatureFocusing" as const,
  solidTransmission: false,
});

export function supportsAcousticShape(shape: unknown): shape is "box" | "sphere" | "capsule" {
  return ACOUSTIC_GEOMETRY_CAPABILITIES.shapes.some((supported) => shape === supported);
}

/** Legacy moving staticSurface remains an occluder; authors explicitly select dynamicReflector. */
export function acousticSnapshotRole(
  mode: "fixed" | "dynamicGravity" | "dynamicNoGravity" | "kinematic",
  role: "none" | "staticSurface" | "dynamicOccluder" | "dynamicReflector",
): AcousticGeometryRole | null {
  if (role === "none") return null;
  if (role === "dynamicReflector") return "dynamicReflector";
  return mode === "fixed" && role === "staticSurface" ? "staticReflector" : "dynamicOccluder";
}

/** Model identity includes complete authored geometry, not one emitter-excluded request. */
export function acousticSceneSolverVersion(scene: {
  objects: readonly { shape: string; acousticRole: string }[];
}): string {
  return scene.objects.some(
    (object) =>
      object.acousticRole !== "none" &&
      (object.shape !== "box" || object.acousticRole === "dynamicReflector"),
  )
    ? EXTENDED_ACOUSTIC_MODEL_VERSION
    : LEGACY_ACOUSTIC_MODEL_VERSION;
}

/** Past this, a solve is refused, and the scene goes silent. */
export const ACOUSTIC_SURFACE_BUDGET = 256;

/**
 * What buildAcousticRequests would send, so that a proposal can be checked before it silences a
 * scene. It counts every object, including the one a source may exclude as its own emitter.
 */
export function acousticSurfaceCount(scene: {
  objects: readonly {
    shape: string;
    mode: "fixed" | "dynamicGravity" | "dynamicNoGravity" | "kinematic";
    acousticRole: "none" | "staticSurface" | "dynamicOccluder" | "dynamicReflector";
  }[];
}): number {
  const included = scene.objects.filter((object) => object.acousticRole !== "none");
  const faces = included.reduce((sum, object) => sum + (object.shape === "box" ? 6 : 1), 0);
  if (
    faces <= ACOUSTIC_SURFACE_BUDGET ||
    acousticSceneSolverVersion(scene) !== EXTENDED_ACOUSTIC_MODEL_VERSION
  )
    return faces;
  return included.reduce(
    (sum, object) =>
      sum +
      (object.shape === "box" &&
      acousticSnapshotRole(object.mode, object.acousticRole) !== "dynamicOccluder"
        ? 6
        : 1),
    0,
  );
}

/** Resolve a validated snapshot request; a full Scene may explicitly pin an otherwise empty request. */
export function acousticRequestSolverVersion(
  request: Pick<AcousticRequest, "modelVersion" | "surfaces" | "primitives" | "boxOccluders">,
): string {
  return request.modelVersion === EXTENDED_ACOUSTIC_MODEL_VERSION ||
    (request.primitives?.length ?? 0) > 0 ||
    (request.boxOccluders?.length ?? 0) > 0 ||
    [...request.surfaces, ...(request.primitives ?? [])].some(
      (entry) => entry?.role === "dynamicReflector",
    )
    ? EXTENDED_ACOUSTIC_MODEL_VERSION
    : LEGACY_ACOUSTIC_MODEL_VERSION;
}
