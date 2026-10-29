import { MAX_PROPAGATION_SECONDS } from "./limits.js";
import type {
  AcousticMaterialBand,
  AcousticFrame,
  AcousticMaterial,
  AcousticPath,
  AcousticRequest,
  AcousticSolution,
  Vec3,
} from "./types.js";
import {
  EPSILON_M,
  cross,
  dot,
  length,
  reflectionPoint,
  segmentIntersection,
  sub,
  unit,
} from "./geometry.js";
import type { PreparedSurface } from "./geometry.js";

export const SOLVER_VERSION = "web-geometric-1.0.0";
export const DEFAULT_BANDS_HZ = Object.freeze([125, 250, 500, 1000, 2000, 4000, 8000]);
export class AcousticSolverError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AcousticSolverError";
  }
}
function requireValue(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new AcousticSolverError(code, message);
}
function finite(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}
function vector(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && Array.from(v).every((n) => finite(n, -200, 200));
}
function validId(v: unknown): v is string {
  return typeof v === "string" && /^[a-z][a-z0-9._-]{0,63}$/.test(v);
}
function validSurfaceId(v: unknown): v is string {
  return typeof v === "string" && /^[a-z][a-z0-9._-]{0,71}$/.test(v);
}
function integer(n: unknown, min: number, max: number): n is number {
  return Number.isSafeInteger(n) && finite(n, min, max);
}
function limit(value: unknown, fallback: number, min: number, max: number, name: string): number {
  const n = value ?? fallback;
  requireValue(
    integer(n, min, max),
    "INVALID_BUDGET",
    `${name} must be an integer in [${min}, ${max}]`,
  );
  return n;
}
function prepareSurface(raw: AcousticRequest["surfaces"][number]): PreparedSurface {
  requireValue(
    raw && validSurfaceId(raw.id) && validId(raw.materialId),
    "INVALID_SURFACE",
    "Surface identities are invalid",
  );
  requireValue(
    Array.isArray(raw.verticesM) &&
      raw.verticesM.length >= 3 &&
      raw.verticesM.length <= 32 &&
      Array.from(raw.verticesM).every(vector),
    "INVALID_GEOMETRY",
    "Surface needs 3–32 finite vertices within scene bounds",
  );
  const vertices = raw.verticesM.map((v) => [...v] as [number, number, number]),
    point = vertices[0]!;
  const firstNormal = cross(sub(vertices[1]!, point), sub(vertices[2]!, point));
  requireValue(
    length(firstNormal) > EPSILON_M,
    "DEGENERATE_SURFACE",
    "First three surface vertices must be non-collinear",
  );
  const windingNormal = unit(firstNormal);
  const normal = raw.normal ?? windingNormal;
  requireValue(
    vector(normal) &&
      Math.abs(length(normal) - 1) < 1e-6 &&
      Math.abs(dot(normal, windingNormal)) > 1 - 1e-6,
    "INVALID_NORMAL",
    "Normal must be unit and perpendicular to surface",
  );
  requireValue(
    raw.twoSided === undefined || typeof raw.twoSided === "boolean",
    "INVALID_SURFACE",
    "twoSided must be boolean",
  );
  requireValue(
    raw.role === undefined || raw.role === "staticReflector" || raw.role === "dynamicOccluder",
    "INVALID_SURFACE_ROLE",
    "Only static reflectors or snapshot dynamic occluders are supported",
  );
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!,
      next = vertices[(i + 1) % vertices.length]!,
      edge = sub(next, v);
    requireValue(
      length(edge) > EPSILON_M,
      "DEGENERATE_SURFACE",
      "Duplicate or degenerate surface edge",
    );
    requireValue(
      Math.abs(dot(windingNormal, sub(v, point))) <= EPSILON_M,
      "NON_PLANAR_SURFACE",
      "Surface vertices must be coplanar",
    );
    for (let j = 0; j < vertices.length; j++) {
      const p = vertices[j]!;
      requireValue(
        dot(cross(edge, sub(p, v)), windingNormal) >= -EPSILON_M * length(edge),
        "NON_CONVEX_SURFACE",
        "Surface must be convex, ordered and non-self-intersecting",
      );
      if (j !== i)
        requireValue(
          length(sub(p, v)) > EPSILON_M,
          "DEGENERATE_SURFACE",
          "Repeated surface vertex",
        );
    }
  }
  return {
    id: raw.id,
    materialId: raw.materialId,
    point,
    normal: unit(normal),
    windingNormal,
    vertices,
    twoSided: raw.twoSided ?? true,
    role: raw.role ?? "staticReflector",
  };
}
function materialMap(
  materials: AcousticRequest["materials"],
  bands: readonly number[],
): Map<string, AcousticMaterial> {
  requireValue(
    Array.isArray(materials) && materials.length <= 256,
    "INVALID_MATERIALS",
    "At most 256 materials",
  );
  const map = new Map<string, AcousticMaterial>();
  for (const m of materials) {
    requireValue(
      m &&
        validId(m.id) &&
        !map.has(m.id) &&
        m.schemaVersion === "1.0.0" &&
        integer(m.revision, 0, Number.MAX_SAFE_INTEGER),
      "INVALID_MATERIAL",
      "Material identity/version/revision invalid or duplicated",
    );
    requireValue(
      ["Measured", "Derived", "Tuned", "Synthetic"].includes(m.dataClass) &&
        m.phaseModel === "zeroPhaseMagnitudeOnly",
      "INVALID_MATERIAL",
      "Material provenance/phase model invalid",
    );
    requireValue(
      typeof m.label === "string" &&
        m.label.length > 0 &&
        m.label.length <= 160 &&
        typeof m.conditions === "string" &&
        m.conditions.length > 0 &&
        m.conditions.length <= 2048,
      "INVALID_MATERIAL",
      "Material metadata missing",
    );
    requireValue(
      Array.isArray(m.sourceUrls) &&
        m.sourceUrls.length <= 20 &&
        Array.from(m.sourceUrls).every(
          (u: unknown) => typeof u === "string" && /^https:\/\//.test(u) && u.length <= 2048,
        ),
      "INVALID_MATERIAL",
      "Invalid material source URLs",
    );
    requireValue(
      Array.isArray(m.bands) && m.bands.length === bands.length,
      "BAND_MISMATCH",
      "Material bands must exactly match solver bands",
    );
    for (let i = 0; i < bands.length; i++) {
      const band: AcousticMaterialBand | undefined = m.bands[i];
      requireValue(
        band && band.centerHz === bands[i],
        "BAND_MISMATCH",
        "No implicit band interpolation",
      );
      const {
        absorptionEnergy: a,
        reflectionEnergy: r,
        transmissionEnergy: t,
        scatteringFraction: s,
      } = band;
      requireValue(
        [a, r, t, s].every((n) => finite(n, 0, 1)) && Math.abs(a + r + t - 1) <= 1e-8,
        "MATERIAL_ENERGY",
        "A/R/T must be finite fractions summing to one; scattering belongs within R",
      );
    }
    map.set(m.id, m);
  }
  return map;
}

/** Deterministic, finite-polygon, first-order geometric acoustic approximation. No audio/OS access. */
export function solveAcoustics(request: AcousticRequest): AcousticSolution {
  requireValue(
    request && typeof request === "object",
    "INVALID_REQUEST",
    "Acoustic request required",
  );
  requireValue(
    typeof request.requestId === "string" &&
      request.requestId.length > 0 &&
      request.requestId.length <= 64,
    "INVALID_REQUEST_ID",
    "requestId must contain 1–64 characters",
  );
  requireValue(
    integer(request.sceneRevision, 0, Number.MAX_SAFE_INTEGER) &&
      integer(request.geometryRevision, 0, Number.MAX_SAFE_INTEGER) &&
      integer(request.poseTick, 0, Number.MAX_SAFE_INTEGER),
    "INVALID_REVISION",
    "Revisions/tick must be nonnegative safe integers",
  );
  requireValue(
    request.source &&
      request.listener &&
      validId(request.source.id) &&
      validId(request.listener.id) &&
      vector(request.source.positionM) &&
      vector(request.listener.positionM),
    "INVALID_ENDPOINT",
    "Source/listener need stable identities and finite in-bounds positions",
  );
  requireValue(
    request.topologyId === undefined || validId(request.topologyId),
    "INVALID_TOPOLOGY",
    "topologyId must be stable domain ID",
  );
  const rawBands = request.bandCentersHz ?? DEFAULT_BANDS_HZ;
  requireValue(Array.isArray(rawBands), "INVALID_BANDS", "Bands must be an array");
  const bands: number[] = [...rawBands];
  requireValue(
    bands.length >= 1 &&
      bands.length <= 32 &&
      bands.every((v, i) => finite(v, 20, 24000) && (i === 0 || v > bands[i - 1]!)),
    "INVALID_BANDS",
    "Bands must be strictly increasing, 20–24000Hz",
  );
  const budgets = request.budget ?? {};
  requireValue(
    typeof budgets === "object" && !Array.isArray(budgets),
    "INVALID_BUDGET",
    "Budget must be an object",
  );
  const maxSurfaces = limit(budgets.maxSurfaces, 256, 0, 2048, "maxSurfaces");
  const maxPaths = limit(budgets.maxPaths, 32, 1, 256, "maxPaths");
  const maxSegmentTests = limit(budgets.maxSegmentTests, 16384, 1, 262144, "maxSegmentTests");
  const maximumDelay = budgets.maxPropagationSeconds ?? 2;
  const minimumDistance = budgets.minimumDistanceM ?? 0.1;
  requireValue(
    finite(maximumDelay, 0.001, MAX_PROPAGATION_SECONDS) && finite(minimumDistance, 0.001, 10),
    "INVALID_BUDGET",
    "Propagation time/minimum distance outside finite bounds",
  );
  requireValue(
    Array.isArray(request.surfaces) && request.surfaces.length <= maxSurfaces,
    "SURFACE_BUDGET",
    "Surface count exceeds the explicitly configured budget",
  );
  const surfaces = Array.from(request.surfaces, prepareSurface).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  requireValue(
    new Set(surfaces.map((s) => s.id)).size === surfaces.length,
    "DUPLICATE_SURFACE",
    "Surface IDs must be unique",
  );
  const materials = materialMap(request.materials, bands);
  for (const s of surfaces)
    requireValue(
      materials.has(s.materialId),
      "UNKNOWN_MATERIAL",
      `Unknown material ${s.materialId}`,
    );
  const atmosphere = request.atmosphere;
  requireValue(
    atmosphere && (atmosphere.medium === "air" || atmosphere.medium === "vacuum"),
    "INVALID_MEDIUM",
    "Medium must explicitly be air or vacuum",
  );
  requireValue(
    atmosphere.dataClass === undefined ||
      ["Measured", "Derived", "Tuned", "Synthetic"].includes(atmosphere.dataClass),
    "INVALID_ATMOSPHERE",
    "Invalid atmosphere data class",
  );
  requireValue(
    atmosphere.speedOfSoundMps === undefined || finite(atmosphere.speedOfSoundMps, 100, 1000),
    "INVALID_SOUND_SPEED",
    "Explicit sound speed must be finite even when the selected medium does not use it",
  );
  requireValue(
    atmosphere.temperatureC === undefined || finite(atmosphere.temperatureC, -80, 100),
    "INVALID_TEMPERATURE",
    "Temperature must be finite even when explicit sound speed is selected",
  );
  const rawAbsorption = atmosphere.bandAbsorptionDbPerM ?? bands.map(() => 0);
  requireValue(Array.isArray(rawAbsorption), "INVALID_AIR_LOSS", "Air loss must be an array");
  const absorption: number[] = [...rawAbsorption];
  requireValue(
    absorption.length === bands.length && absorption.every((v) => finite(v, 0, 10)),
    "INVALID_AIR_LOSS",
    "Explicit finite dB/m vector must match bands",
  );
  const limitations = [
    "Numerical geometric approximation: static convex planar reflectors and snapshot dynamic occluders, first-order specular reflections only; quasi-static motion, no retarded-time solution.",
    "Magnitude-only equal-impedance coefficients; no diffraction, diffuse-path rendering, solid transmission or wave/modal interference.",
    "Coincident/coplanar grazing and finite-thickness wall transmission are unsupported; endpoint self-intersections use an explicit 1e-7m tolerance.",
    "bandGains already include pressure spreading, material specular coefficient and air loss; renderer must apply distance, HRTF and absolute delay only once.",
    "Supplied air dB/m is explicit data, not an ISO 9613-1 prediction; omitted air loss is a zero-loss Synthetic assumption.",
    `Pressure reference distance is 1m; geometric gain is capped below ${minimumDistance}m (finite near-field engineering approximation, not calibrated SPL).`,
    "No impulse response or late decay was solved; RT60, DRR and clarity metrics are unavailable.",
  ];
  const frame: AcousticFrame = {
    schemaVersion: "1.0.0",
    requestId: request.requestId,
    sceneRevision: request.sceneRevision,
    geometryRevision: request.geometryRevision,
    poseTick: request.poseTick,
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    sourceId: request.source.id,
    listenerId: request.listener.id,
    bandCentersHz: bands,
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters", "individualReflectionPaths", "dynamicOccluders"],
    modelClass: "numericalApproximation",
    directDelayS: null,
    paths: [],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations,
  };
  const diagnostics: AcousticSolution["diagnostics"] = {
    directOccluded: null,
    blockedBySurfaceIds: [],
    evaluatedReflectionCandidates: 0,
    segmentTests: 0,
    budgetExceeded: false,
    rejectedReflectionCount: 0,
    droppedPathCount: 0,
    speedOfSoundMps: null,
    speedModel: "vacuum",
    materialDiffuseEnergyExcluded: false,
  };
  const metrics: AcousticSolution["metrics"] = {
    rt60Seconds: null,
    drrDb: null,
    c50Db: null,
    reason:
      "INSUFFICIENT_RESPONSE: first-order magnitude paths are not a measured or phase-correct room impulse response",
  };
  if (atmosphere.medium === "vacuum") {
    frame.pathAvailability = "unsupported";
    frame.limitations.push(
      "Vacuum: no airborne sound; mechanical collisions still exist. Solid-borne propagation is unsupported.",
    );
    return { frame, diagnostics, metrics };
  }
  let c: number;
  if (atmosphere.speedOfSoundMps !== undefined) {
    requireValue(
      finite(atmosphere.speedOfSoundMps, 100, 1000),
      "INVALID_SOUND_SPEED",
      "Explicit air sound speed must be finite 100–1000m/s",
    );
    c = atmosphere.speedOfSoundMps;
    diagnostics.speedModel = "explicit";
  } else {
    const temperatureC = atmosphere.temperatureC ?? 20;
    requireValue(
      finite(temperatureC, -80, 100),
      "INVALID_TEMPERATURE",
      "Dry-air ideal-gas temperature range is -80..100°C",
    );
    c = Math.sqrt(1.4 * 287.05 * (temperatureC + 273.15));
    diagnostics.speedModel = "idealDryAirDerived";
    limitations.push(
      "Sound speed uses c=sqrt(1.4*287.05*T_K), a fixed-composition ideal dry-air Derived model; no humidity-composition correction.",
    );
  }
  diagnostics.speedOfSoundMps = c;
  const source = request.source.positionM,
    listener = request.listener.positionM,
    directDistance = length(sub(source, listener));
  requireValue(
    directDistance > EPSILON_M,
    "COINCIDENT_ENDPOINTS",
    "Coincident source/listener has no defined point-source arrival direction",
  );
  const directDelay = directDistance / c;
  frame.directDelayS = directDelay;
  const trace = (a: Vec3, b: Vec3): { visible: boolean; blockerId?: string; complete: boolean } => {
    for (const surface of surfaces) {
      if (diagnostics.segmentTests >= maxSegmentTests) {
        diagnostics.budgetExceeded = true;
        return { visible: false, complete: false };
      }
      diagnostics.segmentTests++;
      if (segmentIntersection(a, b, surface))
        return { visible: false, blockerId: surface.id, complete: true };
    }
    return { visible: true, complete: true };
  };
  const makePath = (
    vertices: Vec3[],
    surfaceIds: string[],
    material: AcousticMaterial | null,
  ): AcousticPath | null => {
    let distance = 0;
    for (let i = 1; i < vertices.length; i++)
      distance += length(sub(vertices[i]!, vertices[i - 1]!));
    if (distance / c > maximumDelay) {
      diagnostics.droppedPathCount++;
      diagnostics.budgetExceeded = true;
      return null;
    }
    const spreading = 1 / Math.max(distance, minimumDistance);
    const gains = bands.map((_, i) => {
      const b = material?.bands[i];
      if (b && b.scatteringFraction * b.reflectionEnergy > 0)
        diagnostics.materialDiffuseEnergyExcluded = true;
      const reflection = b ? Math.sqrt(b.reflectionEnergy * (1 - b.scatteringFraction)) : 1;
      return spreading * reflection * 10 ** ((-absorption[i]! * distance) / 20);
    });
    return {
      id: `${SOLVER_VERSION}|${request.topologyId ?? "default"}|${request.source.id}|${request.listener.id}|${surfaceIds.length ? surfaceIds.join(">") : "direct"}`,
      sourceId: request.source.id,
      listenerId: request.listener.id,
      surfaceIds,
      order: surfaceIds.length,
      verticesM: vertices.map((v) => [...v] as [number, number, number]),
      lengthM: distance,
      absoluteDelayS: distance / c,
      relativeDelayS: Math.max(0, (distance - directDistance) / c),
      arrivalDirection: unit(sub(vertices[vertices.length - 2]!, listener)),
      bandGains: gains,
    };
  };
  const directVisibility = trace(source, listener);
  diagnostics.directOccluded = directVisibility.complete ? !directVisibility.visible : null;
  if (directVisibility.blockerId) diagnostics.blockedBySurfaceIds.push(directVisibility.blockerId);
  const paths: AcousticPath[] = [];
  if (directVisibility.visible) {
    const path = makePath([source, listener], [], null);
    if (path) paths.push(path);
  }
  for (const surface of surfaces) {
    if (surface.role === "dynamicOccluder") continue;
    if (diagnostics.segmentTests >= maxSegmentTests) {
      diagnostics.budgetExceeded = true;
      break;
    }
    diagnostics.evaluatedReflectionCandidates++;
    const hit = reflectionPoint(source, listener, surface);
    if (!hit) {
      diagnostics.rejectedReflectionCount++;
      continue;
    }
    const first = trace(source, hit);
    if (!first.visible) {
      diagnostics.rejectedReflectionCount++;
      continue;
    }
    const last = trace(hit, listener);
    if (!last.visible) {
      diagnostics.rejectedReflectionCount++;
      continue;
    }
    const path = makePath(
      [source, hit, listener],
      [surface.id],
      materials.get(surface.materialId)!,
    );
    if (path) paths.push(path);
  }
  paths.sort(
    (a, b) =>
      a.order - b.order ||
      b.bandGains.reduce((n, v) => n + v * v, 0) - a.bandGains.reduce((n, v) => n + v * v, 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  if (paths.length > maxPaths) {
    diagnostics.droppedPathCount += paths.length - maxPaths;
    diagnostics.budgetExceeded = true;
  }
  frame.paths = paths.slice(0, maxPaths);
  if (diagnostics.materialDiffuseEnergyExcluded)
    limitations.push(
      "Scattering redistributes reflected energy: only sqrt((1-s)R) specular pressure is rendered; sR diffuse energy is unrendered, not reclassified as absorption.",
    );
  if (diagnostics.budgetExceeded)
    limitations.push(
      "Explicit solver budget reached: incomplete visibility fails closed and paths are truncated; missing paths are not proof that no physical path exists.",
    );
  if (!directVisibility.complete && frame.paths.length === 0) frame.pathAvailability = "failed";
  return { frame, diagnostics, metrics };
}
