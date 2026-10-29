import type { ComparisonRun, SoundBehaviorComparison } from "../../schemas/sound-behavior/types.js";
import type { AcousticFrame } from "../acoustics/types.js";
import type { SceneSpec } from "../scene/types.js";

export type Vector3 = readonly [number, number, number];
export type Quaternion = readonly [number, number, number, number];
export interface RecordedPose {
  objectId: string;
  positionM: Vector3;
  orientationQuaternion: Quaternion;
  linearVelocityMps?: Vector3;
  angularVelocityRadps?: Vector3;
  sleeping?: boolean;
}
export interface RecordedListener {
  id: string;
  positionM: Vector3;
  orientationQuaternion: Quaternion;
}
export interface RecordingFrameInput {
  tick: number;
  sceneRevision: number;
  runEpoch?: string;
  poses: readonly RecordedPose[];
  listener: RecordedListener;
  /** Normalized physics/player inputs, before Behavior evaluation. */
  physicsEvents: readonly unknown[];
  /** Derived decisions may change in behavior A/B even when raw inputs match. */
  behaviorDecisions: readonly unknown[];
  audioEvents: readonly unknown[];
  acousticFrames?: readonly AcousticFrame[];
  acousticResultRefs?: readonly string[];
  behaviorSnapshot?: unknown;
}
export interface RecordingFrame extends RecordingFrameInput {
  runEpoch: string;
  acousticFrames: readonly AcousticFrame[];
  acousticResultRefs: readonly string[];
}
export interface RecorderBudget {
  maxFrames?: number;
  maxBytes?: number;
  maxObjects?: number;
  maxEvents?: number;
  maxEventsPerFrame?: number;
}
export interface ExperimentRecorderOptions {
  runId: string;
  runEpoch?: string;
  sceneSnapshot: SceneSpec;
  sourceConfig: unknown;
  behaviorConfig: unknown;
  solverConfig: unknown;
  atmosphere: unknown;
  materialRegistry: unknown;
  assetManifest?: unknown;
  generatorConfig?: unknown;
  physicsConfig?: unknown;
  geometrySnapshot?: unknown;
  physicsVersion: string;
  backendId?: string;
  backendVersion: string;
  fixedDtS: number;
  sampleRateHz: 44100 | 48000;
  createdAt?: string;
  budget?: RecorderBudget;
}
export interface RecordingConfiguration {
  sceneSnapshot: SceneSpec;
  sourceConfig: unknown;
  behaviorConfig: unknown;
  solverConfig: unknown;
  atmosphere: unknown;
  materialRegistry: unknown;
  assetManifest: unknown;
  generatorConfig: unknown;
  physicsConfig: unknown;
  geometrySnapshot: unknown;
  physicsVersion: string;
  backendId: string;
  backendVersion: string;
  fixedDtS: number;
  sampleRateHz: 44100 | 48000;
}
export type RecordingStatus = "captured" | "interrupted" | "cancelled";
/** Absent on durable legacy artifacts, which retain their original hash algorithm. */
export type RecordingFingerprintVersion = "content-and-cursors-v2";
export interface SourcePhaseEvidence {
  evidenceClass: "nativeEpoch" | "logicalIntent" | "silent" | "missing";
  reason: string | null;
}
export type RecorderState = "recording" | "paused" | "finalizing" | RecordingStatus;
export interface ExperimentManifest {
  schemaVersion: "1.0.0";
  experimentId: string;
  createdAt: string;
  sceneId: string;
  sceneRevision: number;
  sceneSha256: string;
  motionTraceSha256: string;
  contactTraceSha256: string;
  materialRegistrySha256: string;
  backendId: string;
  backendVersion: string;
  physicsVersion: string;
  solverSettings: {
    fixedDtS: number;
    sampleRateHz: 44100 | 48000;
    seed: number;
    speedOfSoundMps: number;
    temperatureC: number;
    relativeHumidityPercent: number;
    pressurePa: number;
    maxReflectionOrder: number;
  };
  recordingMode: "authoritativeMotionTrace";
  resultArtifacts: {
    id: string;
    sha256: string;
    kind: "paths" | "events";
    evidenceClass: "Computed";
  }[];
  validationLevel: "V1";
}
export interface RecordingArtifact {
  schemaVersion: "1.0.0";
  fingerprintVersion?: RecordingFingerprintVersion;
  /** Intended logical content or captured epoch-mapped cursor evidence; never hardware PCM. */
  sourcePhaseEvidence?: SourcePhaseEvidence;
  runId: string;
  runEpoch: string;
  createdAt: string;
  status: RecordingStatus;
  reason: string | null;
  configuration: RecordingConfiguration;
  frames: readonly RecordingFrame[];
  fingerprints: ComparisonRun;
  artifactSha256: string;
  startTick: number | null;
  endTick: number | null;
  frameCount: number;
  eventCount: number;
  traceBytes: number;
  manifest: ExperimentManifest | null;
  /** Existing Experiment v1 cannot encode vacuum or an unresolved propagation speed. */
  manifestUnavailableReason: string | null;
  limitations: readonly string[];
}
export interface RecorderTelemetry {
  state: RecorderState;
  frameCount: number;
  eventCount: number;
  traceBytes: number;
  durationSeconds: number;
  reason: string | null;
}
export interface ReplayFrame extends RecordingFrame {
  sourceRunEpoch: string;
  replayEpoch: string;
  emitEvents: boolean;
}
export type ReplayMode = "recordedOutput" | "behaviorReevaluation";
export interface RecordingMetric {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  evidenceClass: "Computed";
  method: string;
  status: "available" | "unavailable";
  reason: string | null;
  /** Explicit estimator support; never an assertion of rendered PCM or audible energy. */
  population?: RecordingMetricPopulation;
}
export interface RecordingMetricPopulation {
  kind: "logicalPlayingSourceQueries" | "capturedGeometricQueries";
  policyVersion: "post-step-playing-v1" | "geometric-query-v1";
  sampleCount: number;
  eligibleQueryCount: number;
  excludedNonPlayingQueryCount: number;
  invalidAcousticQueryCount: number;
  backendDeclarationMismatchQueryCount: number;
  missingEligibilityFrameCount: number;
  bandCenterHz: number | null;
  window: { startTick: number | null; endTick: number | null; fixedDtS: number };
}
export interface RecordingComparison {
  kind: "acoustic" | "behavior";
  matched: boolean;
  runA: string;
  runB: string;
  mismatches: { field: string; reason: string }[];
  independentVariables: SoundBehaviorComparison["independentVariables"];
  metrics: {
    id: string;
    label: string;
    a: number | null;
    b: number | null;
    delta: number | null;
    percentDelta: number | null;
    unit: string;
    reason: string | null;
    method?: string;
    population?: {
      a: RecordingMetricPopulation;
      b: RecordingMetricPopulation;
      compatible: boolean;
    };
  }[];
}
export class RecordingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RecordingError";
  }
}
