/** Browser-safe acoustic domain contracts. All positions use metres and delay seconds. */
export type Vec3 = readonly [number, number, number];
export interface AcousticMaterialBand {
  centerHz: number;
  absorptionEnergy: number;
  reflectionEnergy: number;
  transmissionEnergy: number;
  scatteringFraction: number;
}
export interface AcousticMaterial {
  schemaVersion: "1.0.0";
  id: string;
  revision: number;
  label: string;
  dataClass: "Measured" | "Derived" | "Tuned" | "Synthetic";
  sourceUrls: readonly string[];
  conditions: string;
  phaseModel: "zeroPhaseMagnitudeOnly";
  bands: readonly AcousticMaterialBand[];
}
/** Planar, finite convex surface. Normal direction is ignored for two-sided surfaces. */
export interface AcousticSurface {
  id: string;
  verticesM: readonly Vec3[];
  normal?: Vec3;
  materialId: string;
  twoSided?: boolean;
  /** Moving snapshots may occlude, but are never promoted to moving reflectors. */
  role?: "staticReflector" | "dynamicOccluder";
}
export interface AcousticEndpoint {
  id: string;
  positionM: Vec3;
}
export interface Atmosphere {
  medium: "air" | "vacuum";
  speedOfSoundMps?: number;
  temperatureC?: number;
  /** Explicit supplied dB/m, never inferred as ISO 9613-1 data. */
  bandAbsorptionDbPerM?: readonly number[];
  dataClass?: "Measured" | "Derived" | "Tuned" | "Synthetic";
}
export interface SolverBudget {
  maxSurfaces?: number;
  maxPaths?: number;
  maxSegmentTests?: number;
  maxPropagationSeconds?: number;
  minimumDistanceM?: number;
}
export interface AcousticRequest {
  requestId: string;
  sceneRevision: number;
  geometryRevision: number;
  poseTick: number;
  /** Stable topology namespace; change only when surface identities/topology change. */
  topologyId?: string;
  source: AcousticEndpoint;
  listener: AcousticEndpoint;
  surfaces: readonly AcousticSurface[];
  materials: readonly AcousticMaterial[];
  atmosphere: Atmosphere;
  bandCentersHz?: readonly number[];
  budget?: SolverBudget;
}
export interface AcousticPath {
  id: string;
  sourceId: string;
  listenerId: string;
  surfaceIds: string[];
  order: number;
  verticesM: [number, number, number][];
  lengthM: number;
  absoluteDelayS: number;
  relativeDelayS: number;
  /** Apparent-source direction: listener toward previous path vertex. */
  arrivalDirection: [number, number, number];
  /** Includes geometric spreading, specular material and air losses; pressure ratios. */
  bandGains: number[];
}
export interface AcousticFrame {
  schemaVersion: "1.0.0";
  requestId: string;
  sceneRevision: number;
  geometryRevision: number;
  poseTick: number;
  backendId: string;
  backendVersion: string;
  sourceId: string;
  listenerId: string;
  bandCentersHz: number[];
  gainQuantity: "pressureRatio";
  capabilities: ("directParameters" | "individualReflectionPaths" | "dynamicOccluders")[];
  modelClass: "numericalApproximation";
  directDelayS: number | null;
  paths: AcousticPath[];
  pathAvailability: "available" | "unsupported" | "failed";
  impulseResponseArtifactId: null;
  stale: boolean;
  limitations: string[];
}
export interface AcousticSolution {
  frame: AcousticFrame;
  diagnostics: {
    directOccluded: boolean | null;
    blockedBySurfaceIds: string[];
    evaluatedReflectionCandidates: number;
    segmentTests: number;
    budgetExceeded: boolean;
    rejectedReflectionCount: number;
    droppedPathCount: number;
    speedOfSoundMps: number | null;
    speedModel: "explicit" | "idealDryAirDerived" | "vacuum";
    materialDiffuseEnergyExcluded: boolean;
  };
  metrics: {
    rt60Seconds: null;
    drrDb: null;
    c50Db: null;
    reason: string;
  };
}
