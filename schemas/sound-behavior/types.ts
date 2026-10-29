/**
 * Sound Behavior v1 draft data contracts. This file does not implement playback,
 * behavior evaluation, physics or provider execution. JSON Schema plus host
 * domain validation remain authoritative for bounds, identities and references.
 */
export type Vec3 = [number, number, number];
/** Stable domain identity; pattern and length are enforced by the host. */
export type Id = string;
/** Lowercase hexadecimal SHA-256; verified against the trusted asset registry. */
export type Sha256 = string;

export type ContinuousTriggerType =
  | "AlwaysOn"
  | "WhileMoving"
  | "WhileAirborne"
  | "WhileRolling"
  | "WhileSliding"
  | "WhileSpinning"
  | "WhileHeld";

export type DiscreteTriggerType =
  | "OnGrab"
  | "OnRelease"
  | "OnThrow"
  | "OnDrop"
  | "OnImpact"
  | "OnBounce"
  | "OnStartMoving"
  | "OnStopMoving"
  | "OnEnterZone"
  | "OnExitZone"
  | "OnSleep"
  | "OnWake";

export type ContinuousSoundTrigger = { kind: "continuous"; type: ContinuousTriggerType };
export type DiscreteSoundTrigger = { kind: "discrete"; type: DiscreteTriggerType };
export type SoundTrigger = ContinuousSoundTrigger | DiscreteSoundTrigger;

export type MetricInput =
  | "sourceSpeedMetresPerSecond"
  | "angularSpeedRadiansPerSecond"
  | "normalImpulseNewtonSeconds"
  | "closingSpeedMetresPerSecond"
  | "tangentSpeedMetresPerSecond"
  | "slipSpeedMetresPerSecond"
  | "contactSupportForceNewtons";

export type TriggerCondition =
  | {
      kind: "metric";
      input: MetricInput;
      operator: "gt" | "gte" | "lt" | "lte";
      value: number;
    }
  | {
      kind: "state";
      state: "held" | "airborne" | "moving" | "sleeping" | "rolling" | "sliding";
      equals: boolean;
    }
  | { kind: "materialPair"; materialA: Id; materialB: Id };

export interface SoundAssetReference {
  assetId: Id;
  revision: number;
  sha256: Sha256;
}

export interface ParameterMapping {
  mappingId: Id;
  input: MetricInput;
  target: "gainLinear" | "pitchSemitones" | "filterCutoffHz";
  inputMin: number;
  inputMax: number;
  outputMin: number;
  outputMax: number;
  curve: { x: number; y: number }[];
  interpolation: "linear" | "step";
  clamp: true;
  smoothingSeconds: number;
}

export type SoundGenerator =
  | {
      kind: "sample";
      asset: SoundAssetReference;
      loop: boolean;
      startOffsetSeconds: number;
    }
  | {
      kind: "oscillator";
      waveform: "sine" | "triangle" | "square" | "sawtooth";
      frequencyHz: number;
    };

export type SpatialEmitter =
  | { attachment: "object"; offsetMetres: Vec3 }
  | { attachment: "contact"; aggregation: "impulseWeighted" | "representative" }
  | { attachment: "zone"; zoneId: Id }
  | { attachment: "fixed"; positionMetres: Vec3 };

/** Bounded event-started loop; only a validated host can advance this lifecycle. */
export interface RuleLifecycle {
  mode: "latched";
  stopOn: DiscreteTriggerType[];
  retriggerPolicy: "ignore" | "restart";
  maxDurationSeconds: number;
}

export interface SoundBehaviorRule {
  ruleId: Id;
  enabled: boolean;
  trigger: SoundTrigger;
  conditions: TriggerCondition[];
  generator: SoundGenerator;
  emitter: SpatialEmitter;
  gainLinear: number;
  pitchSemitones: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  cooldownSeconds: number;
  priority: number;
  voiceLimit: number;
  layerGroup: Id;
  mappings: ParameterMapping[];
  lifecycle?: RuleLifecycle;
  /** Plain discrete oscillators need a host-validated finite lifetime. */
  oneShotDurationSeconds?: number;
}

export interface MaterialPairOverride {
  overrideId: Id;
  ruleId: Id;
  materialA: Id;
  materialB: Id;
  generator: SoundGenerator;
}

/** `physical` selects an authored preset, not a claim of vibration synthesis. */
export interface SoundBehaviorProfile {
  profileId: Id;
  revision: number;
  name: string;
  presetKind: "physical" | "creative" | "hybrid" | "procedural";
  rules: SoundBehaviorRule[];
  materialPairOverrides: MaterialPairOverride[];
}

export interface RuleOverride {
  ruleId: Id;
  enabled?: boolean;
  gainLinear?: number;
  pitchSemitones?: number;
}

export interface BehaviorBinding {
  bindingId: Id;
  objectId: Id;
  objectGeneration: number;
  profileId: Id;
  profileRevision: number;
  enabled: boolean;
  overrides: RuleOverride[];
}

export interface SoundBehaviorDocument {
  schemaVersion: "1.0.0";
  documentId: Id;
  revision: number;
  /** References only. The host owns asset readiness, rights and actual bytes. */
  assets: SoundAssetReference[];
  profiles: SoundBehaviorProfile[];
  bindings: BehaviorBinding[];
}

export interface ContactData {
  pairKey: Id;
  episodeId: Id;
  objectA: Id;
  objectB: Id;
  colliderA: Id;
  colliderB: Id;
  materialA: Id;
  materialB: Id;
  pointWorldMetres: Vec3;
  normalAtoB: Vec3;
  normalImpulseNewtonSeconds: number | null;
  impulseMethod: "RapierContactImpulse" | "ForceDtEstimate" | "Unavailable";
  closingSpeedMetresPerSecond: number | null;
  tangentSpeedMetresPerSecond: number | null;
  velocityMethod: "PreStepRigidBodyEstimate" | "PostSolveSample" | "Unavailable";
}

/** Logical emission event. Simulation time is separate from audio/device time. */
export interface AudioEvent {
  eventId: Id;
  parentPhysicsEventId?: Id;
  experimentId: Id;
  runEpoch: Id;
  sceneRevision: number;
  tick: number;
  simulationTimeSeconds: number;
  fixedDtSeconds: number;
  sequence: number;
  objectId: Id;
  generation: number;
  bindingId: Id;
  profileId: Id;
  profileRevision: number;
  ruleId: Id;
  trigger: SoundTrigger;
  instanceId: Id;
  action: "start" | "update" | "stop";
  positionMetres: Vec3;
  gainLinear: number;
  pitchSemitones: number;
  contact?: ContactData;
}

/** Serializable diagnostic state, never AudioNode/Rapier/WASM engine objects. */
export interface SoundInstance {
  instanceId: Id;
  bindingId: Id;
  profileId: Id;
  profileRevision: number;
  ruleId: Id;
  objectId: Id;
  generation: number;
  kind: "continuous" | "oneShot";
  playbackState: "scheduled" | "playing" | "fading" | "stopped";
  startedAtTick: number;
  playheadSeconds: number;
  randomSeed: number;
  gainLinear: number;
  pitchSemitones: number;
  positionMetres: Vec3;
  latch?: LatchRuntimeState;
}

export interface LatchRuntimeState {
  startEventId: Id;
  deadlineTick: number;
  retriggerCount: number;
}

export type SoundLatchLifecycle = RuleLifecycle;

export interface BindingRuntimeState {
  bindingId: Id;
  activeRuleIds: Id[];
  cooldowns: { ruleId: Id; rearmAtTick: number }[];
}

export interface BehaviorRuntimeState {
  schemaVersion: "1.0.0";
  experimentId: Id;
  runEpoch: Id;
  sceneRevision: number;
  documentId: Id;
  documentRevision: number;
  tick: number;
  fixedDtSeconds: number;
  sequence: number;
  bindings: BindingRuntimeState[];
  instances: SoundInstance[];
  processedEventIds: Id[];
  randomSeed: number;
}

export interface ComparisonRun {
  runId: Id;
  sceneGeometryHash: Sha256;
  physicsConfigHash: Sha256;
  motionTraceHash: Sha256;
  physicsEventTraceHash: Sha256;
  listenerTraceHash: Sha256;
  solverConfigHash: Sha256;
  atmosphereHash: Sha256;
  propagationMaterialHash: Sha256;
  profileHash: Sha256;
  assetManifestHash: Sha256;
  generatorConfigHash: Sha256;
  sourceSignalHash: Sha256;
}

export interface SoundBehaviorComparison {
  comparisonKind: "acoustic" | "behavior";
  independentVariables: (
    | "acousticMaterial"
    | "sourceAsset"
    | "generator"
    | "gainMapping"
    | "pitchMapping"
    | "behaviorProfile"
  )[];
  runA: ComparisonRun;
  runB: ComparisonRun;
}

export type SoundBehaviorOperation =
  | { type: "CreateProfile"; profile: SoundBehaviorProfile }
  | {
      type: "ReplaceProfile";
      profileId: Id;
      expectedProfileRevision: number;
      profile: SoundBehaviorProfile;
    }
  | { type: "DeleteProfile"; profileId: Id; expectedProfileRevision: number }
  | { type: "AssignBinding"; binding: BehaviorBinding }
  | { type: "RemoveBinding"; bindingId: Id };

/** Model proposal only; the trusted host assigns transaction/preview/apply IDs. */
export interface SoundBehaviorProposal {
  schemaVersion: "1.0.0";
  proposalId: Id;
  sceneId: Id;
  expectedSceneRevision: number;
  expectedBehaviorRevision: number;
  operations: SoundBehaviorOperation[];
}

export type BehaviorProposal = SoundBehaviorProposal;
