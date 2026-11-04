import type { LiveMonitorPorts } from "./live-monitor-contracts.js";
import type { RecordingRecoveryEntryView } from "./recovery-contracts.js";
/** Read models for the interface. Domain engines remain the authority for mutations. */
import type { ParameterMapping, RuleOverride } from "../../schemas/sound-behavior/types.js";
import type { StaticPreviewView } from "../app/static-preview.js";
import type { RenderHost } from "../app/render-host.js";
import type { MotionWorkspace } from "../motion/workspace.js";
import type { MotionActionInput, MotionWorkspaceView } from "../motion/types.js";
import type { AgentSession } from "../app/agent-session.js";
import type { AudioDiagnosticsSnapshot } from "../audio/diagnostics.js";
import type { ObjectTrajectory, SceneZone } from "../scene/types.js";
import type { PathRunView } from "../motion/path-runner.js";
import type { PathProblem } from "../motion/trajectory-path.js";
export type SoundParameterMapping = ParameterMapping;
export type SoundRuleOverride = Pick<RuleOverride, "enabled" | "gainLinear" | "pitchSemitones">;
export type Vector3 = [number, number, number];
export type Quaternion = [number, number, number, number];
export type Workspace = "scene" | "simulation" | "analysis";
export type InteractionMode = "editor" | "fps-interact" | "fps-build";
export type AgentProvider = "offline" | "meta";
export interface AgentProviderStatusView {
  status: "unknown" | "loading" | "ready" | "blocked" | "error";
  reason: string;
}
export type BodyMode = "dynamicGravity" | "dynamicNoGravity" | "fixed" | "kinematic";
export type PrimitiveShape = "box" | "sphere" | "capsule";
export interface PoseView {
  positionM: Vector3;
  orientationQuaternion: Quaternion;
}
export interface PlacementGhostView extends PoseView {
  shape: PrimitiveShape;
  dimensionsM: Vector3;
  valid: boolean;
  reason?: string;
  stage: "preview" | "pending";
  attachment?: "surface" | "air";
}
export interface ObjectView extends PoseView {
  id: string;
  name?: string;
  shape: PrimitiveShape;
  dimensionsM: Vector3;
  mode: BodyMode;
  massKg: number;
  friction: number;
  restitution: number;
  physicsMaterialId: string;
  acousticMaterialId: string;
  acousticRole: "none" | "staticSurface" | "dynamicOccluder" | "dynamicReflector";
  trajectory?: ObjectTrajectory;
  /** An enabled sound behaviour binding or a sound source: the object can carry a path. */
  audible: boolean;
  velocityMps?: Vector3;
  angularVelocityRadps?: Vector3;
  held?: boolean;
  sleeping?: boolean;
}
export interface PathView {
  id: string;
  kind: "direct" | "reflection" | "transmission" | "blocked";
  points: Vector3[];
  distanceM: number;
  delaySeconds: number;
  gainLinear?: number;
  energyBands?: number[];
  surfaceIds?: string[];
  sourceId?: string;
  stale?: boolean;
}
export interface BehaviorDecisionView {
  tick: number;
  sequence: number;
  action: "start" | "update" | "stop" | "reject";
  reason: string;
  /** Identical semantic decisions in one frame share a row, with their actual count retained. */
  occurrences?: number;
  bindingId?: string;
  inputEventId?: string;
  instanceId?: string;
  emitterAttachment?: "object" | "contact" | "fixed" | "zone";
  /** Available input contact evidence; does not imply that a voice was emitted. */
  contactPairKey?: string;
  contactPositionM?: Vector3;
  /** Set only from an actual AudioEvent, never inferred from an object's COM. */
  emitterPositionM?: Vector3;
}
/** Ephemeral native renderer rejection; never captured physics/behavior or device-output evidence. */
export interface NativeVoiceRejectionView {
  reason?: string;
  audioEventId: string;
  audioEventTick: number;
  inputEventId?: string;
  instanceId: string;
  bindingId: string;
  ruleId: string;
  objectId: string;
  generation: number;
  runEpoch: string;
  sceneRevision: number;
  behaviorDocumentRevision: number;
  profileId: string;
  profileRevision: number;
  sourceId: string;
  acousticRequestId: string | null;
  acousticSceneRevision: number | null;
  acousticPoseTick: number | null;
  attemptedAtTick: number;
}
export interface EventView {
  id: string;
  tick: number;
  timeSeconds: number;
  type: string;
  objectId?: string;
  ruleId?: string;
  assetId?: string;
  positionM?: Vector3;
  detail?: string;
  suppressed?: boolean;
  decision?: BehaviorDecisionView;
  nativeRejection?: NativeVoiceRejectionView;
}
export interface AssetView {
  id: string;
  name: string;
  provenance: string;
  durationSeconds?: number;
  status: "ready" | "pending" | "error";
}
export interface BehaviorRuleView {
  id: string;
  trigger: string;
  zoneId?: string;
  enabled: boolean;
  assetId?: string;
  generator?: "sample" | "oscillator";
  gainLinear: number;
  pitchSemitones: number;
  cooldownSeconds: number;
  priority?: number;
  mapping?: "none" | "speed" | "impact";
  mappings?: SoundParameterMapping[];
  baseValues?: { enabled: boolean; gainLinear: number; pitchSemitones: number };
  bindingOverride?: SoundRuleOverride | null;
  active?: boolean;
  status?: string;
  diagnostic?: BehaviorDecisionView;
  nativeRejection?: NativeVoiceRejectionView;
}
export interface BehaviorView {
  objectId: string;
  profileId: string;
  revision: number;
  presetKind: "physical" | "creative" | "hybrid" | "procedural";
  rules: BehaviorRuleView[];
  bindingId?: string;
  bindingEnabled?: boolean;
  documentRevision?: number;
}
/** A stored path measured against the scene's starting layout. */
export interface TrajectoryStatusView {
  lengthM: number;
  durationS: number;
  /** False when the path has a problem; a valid path on a non-audible object still never runs. */
  valid: boolean;
  problem?: PathProblem;
}
export type { PathProblem, PathRunView };
export interface MetricView {
  label: string;
  value: number | null;
  unit: string;
  reason?: string;
}
export interface LabViewModel {
  projectName: string;
  projectId?: string;
  lastBehaviorEdit?: {
    objectId: string;
    bindingId: string;
    beforeDocumentRevision: number;
    afterDocumentRevision: number;
    beforeProfileId: string;
    afterProfileId: string;
    afterProfileRevision: number;
  };
  sceneRevision: number;
  zones?: SceneZone[];
  /** Published with the Scene read model so sidecar transactions appear atomically. */
  motion?: MotionWorkspaceView;
  workspace: Workspace;
  simulationState: "ready" | "running" | "paused" | "error";
  interactionMode: InteractionMode;
  /** Explicitly enabled alternative controls; never implies actual pointer lock. */
  alternativeInput?: boolean;
  tick: number;
  simTimeSeconds: number;
  runId: string | null;
  objects: ObjectView[];
  /** Keyed by object id, for every object with a stored path; recomputed per scene revision. */
  trajectoryStatus: Record<string, TrajectoryStatusView>;
  /** The current take's path runs; empty before the first Play or Record and after Reset. */
  pathRuns: PathRunView[];
  /** A first-person paint stroke in progress: world points, the object's start first. */
  paint: { objectId: string; pointsM: Vector3[]; distanceM: number } | null;
  listener: PoseView & { id: string; attachment: "independent" | "fpsHead" };
  selectedObjectId: string | null;
  placementGhost?: PlacementGhostView | null;
  selectedPathId?: string | null;
  selectedEventId?: string | null;
  preview?: StaticPreviewView;
  paths: PathView[];
  events: EventView[];
  assets: AssetView[];
  behaviors: BehaviorView[];
  monitor: {
    bufferPreset?: import("../audio/buffer-preset.js").AudioBufferPreset;
    rebuilding?: boolean;
    outputLatencySeconds?: number | null;
    outputUnderrunEvents?: number | null;
    outputUnderrunSeconds?: number | null;
    outputUnderrunStatus?: "AVAILABLE" | "NOT_AVAILABLE";
    schedulingLookaheadSeconds?: number | null;
    staleVoiceAdmissions?: number;
    state: "blocked" | "muted" | "audible" | "error";
    muted: boolean;
    gainLinear: number;
    mode: "raw" | "simulated";
    activeVoices: number;
    voiceLimit: number;
    peakDbfs?: number;
    lateReverb?: { enabled: boolean; decaySeconds: number; wetGain: number };
  };
  recording: {
    state: "idle" | "recording" | "finalized" | "replaying";
    eventCount: number;
    durationSeconds: number;
    replayTimeSeconds?: number;
    canReplay: boolean;
    hasArtifact?: boolean;
  };
  ai: {
    mode: "offline" | "live" | "unavailable";
    status: "idle" | "loading" | "preview" | "error";
    message: string;
    preview?: string;
    /** Muse's own words. Untrusted text: display only. */
    note?: string;
    canApply: boolean;
    canUndo?: boolean;
    selectedProvider?: AgentProvider;
    providerStatus?: AgentProviderStatusView;
  };
  comparison: {
    hasA: boolean;
    hasB: boolean;
    status: string;
    metrics: MetricView[];
  };
  acoustic: {
    backend: string;
    model: string;
    revision: number | null;
    state: "ready" | "pending" | "stale" | "unsupported" | "unavailable" | "error";
    speedOfSoundMps?: number;
    medium?: string;
    temperatureC?: number;
    metrics: MetricView[];
  };
  materialOptions?: { id: string; label: string; dataClass: string }[];
  pauseReason?: string;
  notice?: string;
  error?: string;
  canUndo: boolean;
  canRedo: boolean;
}
export type ObjectPatch = Partial<
  Pick<
    ObjectView,
    | "name"
    | "positionM"
    | "dimensionsM"
    | "orientationQuaternion"
    | "mode"
    | "massKg"
    | "friction"
    | "restitution"
    | "physicsMaterialId"
    | "acousticMaterialId"
    | "acousticRole"
  >
> & { trajectory?: ObjectTrajectory | null };
export type LabAction =
  | { type: "clearError" }
  | { type: "workspace"; workspace: Workspace }
  | { type: "selectObject"; objectId: string | null }
  | { type: "selectPath"; pathId: string | null }
  | { type: "selectEvent"; eventId: string | null }
  | { type: "run" | "pause" | "reset" | "undo" | "redo" | "save" | "export" | "load" }
  | { type: "importProject"; text: string }
  | { type: "exportRecording" }
  | { type: "motionSave"; input: MotionActionInput; expectedRevision: number }
  | { type: "motionRemove"; actionId: string; expectedRevision: number }
  | { type: "motionStart"; actionId: string }
  | { type: "motionCancel"; runId: string }
  | { type: "motionUndo" | "motionRedo" | "motionRebase"; expectedRevision: number }
  | { type: "exportMotion" }
  | { type: "importMotion"; text: string; expectedRevision: number }
  | { type: "runAgentExperiment"; durationS: number }
  | { type: "compareAgentExperiment" }
  | { type: "setAudioDiagnosticsEnabled"; enabled: boolean }
  | {
      type: "saveZone";
      zone: SceneZone;
      expectedSceneRevision: number;
      expectedZoneRegistryPin: string;
    }
  | {
      type: "removeZone";
      zoneId: string;
      expectedSceneRevision: number;
      expectedZoneRegistryPin: string;
    }
  | { type: "addObject"; shape: PrimitiveShape }
  | { type: "duplicateObject" | "removeObject" | "frameSelected"; objectId: string }
  | { type: "patchObject"; objectId: string; patch: ObjectPatch }
  /** The only path write; `null` removes the path. */
  | { type: "setTrajectory"; objectId: string; trajectory: ObjectTrajectory | null }
  | { type: "patchListener"; positionM: Vector3; orientationQuaternion?: Quaternion }
  | { type: "addRule"; objectId: string; trigger: string; zoneId?: string }
  | {
      type: "patchRule";
      objectId: string;
      ruleId: string;
      patch: Partial<BehaviorRuleView>;
      expectedSceneRevision?: number;
      expectedBehaviorRevision?: number;
    }
  | {
      type: "setBindingOverride";
      objectId: string;
      ruleId: string;
      override: SoundRuleOverride | null;
      expectedSceneRevision?: number;
      expectedBehaviorRevision?: number;
    }
  | { type: "removeRule"; objectId: string; ruleId: string }
  | { type: "setPreset"; objectId: string; presetKind: BehaviorView["presetKind"] }
  | { type: "importAudio"; file: File; rightsConfirmed: boolean }
  | { type: "audition"; assetId: string }
  | { type: "previewRule"; objectId: string; bindingId: string; ruleId: string }
  | { type: "stopPreview" }
  | { type: "recordToggle" | "replay" | "stopReplay" }
  | { type: "seek"; timeSeconds: number }
  | { type: "captureComparison"; slot: "A" | "B" }
  | { type: "compare"; kind: "acoustic" | "behavior" }
  | { type: "submitPrompt"; prompt: string }
  | { type: "setAgentMode"; mode: AgentProvider }
  | { type: "refreshAgentStatus" }
  | { type: "applyAI" | "cancelAI" | "undoAI" }
  | { type: "enableAudio" | "toggleMute" }
  | { type: "setMonitorGain"; gainLinear: number }
  | { type: "setMonitorMode"; mode: "raw" | "simulated" }
  | { type: "setAudioBufferPreset"; preset: import("../audio/buffer-preset.js").AudioBufferPreset }
  | { type: "setReverb"; enabled: boolean; decaySeconds?: number; wetGain?: number }
  | { type: "enterFPS" | "exitFPS" }
  | { type: "pointerLockChanged"; locked: boolean }
  | { type: "setAlternativeInput"; enabled: boolean }
  | { type: "setInteractionMode"; mode: InteractionMode }
  | { type: "inputKey"; code: string; pressed: boolean }
  | { type: "inputLook"; movementX: number; movementY: number }
  | { type: "inputPointer"; button: number; pressed: boolean }
  | { type: "inputWheel"; deltaY: number }
  | { type: "inputBlur" }
  /** Ctrl+left press on an aimed audible object, and its button release. */
  | { type: "paintStart" }
  | { type: "paintEnd" }
  | { type: "place" | "grab" | "drop" | "throw" | "startPlacement" | "cancelPlacement" }
  | { type: "setAtmosphere"; medium: "air" | "vacuum"; temperatureC?: number };
export interface LabController extends LiveMonitorPorts {
  /** The same immutable object must be returned until subscribe notifies a change. */
  getSnapshot(): LabViewModel;
  subscribe(listener: () => void): () => void;
  dispatch(action: LabAction): void | Promise<void>;
  /** Read interpolated physics poses without issuing a React update for every fixed step. */
  getPose(objectId: string): PoseView | undefined;
  getFPSCamera?(): PoseView | undefined;
  /** Optional composition ports; legacy/read-only controllers remain valid. */
  getRenderHost?(): RenderHost | null;
  getMotionWorkspace?(): MotionWorkspace | null;
  getAgentSession?(): AgentSession | null;
  getAudioDiagnostics?(): AudioDiagnosticsSnapshot | null;
  captureShortTake?(durationSeconds: number): Promise<void>;
  listRecordingRecovery?(): Promise<readonly RecordingRecoveryEntryView[]>;
  recoverRecording?(sessionId: string): Promise<void>;
  discardRecordingRecovery?(sessionId: string): Promise<void>;
}
