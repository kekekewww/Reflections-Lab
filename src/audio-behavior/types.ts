import type {
  AudioEvent,
  BehaviorRuntimeState,
  ContactData,
  DiscreteTriggerType,
  MetricInput,
  SoundBehaviorDocument,
  SoundGenerator,
  Vec3,
} from "../../schemas/sound-behavior/types.js";

export type KnownState = boolean | null;
export interface BehaviorObjectInput {
  objectId: string;
  generation: number;
  lifecycle: "active" | "staged" | "preview" | "deleted";
  positionMetres: Vec3;
  rotation?: [number, number, number, number];
  states: {
    moving: KnownState;
    airborne: KnownState;
    held: KnownState;
    sleeping: KnownState;
    rolling: KnownState;
    sliding: KnownState;
    spinning: KnownState;
  };
  metrics: Partial<Record<MetricInput, number | null>>;
  contact?: ContactData;
}

/** Producer-accepted events, never inferred from speed by this evaluator. */
export interface NormalizedBehaviorEvent {
  eventId: string;
  tick: number;
  sequence: number;
  objectId: string;
  generation: number;
  type: DiscreteTriggerType;
  source: "interaction" | "physics" | "state" | "zone";
  accepted: boolean;
  commandId?: string;
  contact?: ContactData;
  metrics?: Partial<Record<MetricInput, number | null>>;
}

export interface BehaviorFrame {
  tick: number;
  sceneRevision: number;
  runEpoch: string;
  objects: BehaviorObjectInput[];
  events: NormalizedBehaviorEvent[];
}

export interface BehaviorAsset {
  assetId: string;
  revision: number;
  sha256: string;
  availability: "READY" | "MISSING" | "FIXTURE_ONLY";
  rightsStatus: "APPROVED" | "UNVERIFIED" | "FIXTURE_ONLY";
  durationSeconds?: number;
}

export interface BehaviorContext {
  sceneRevision: number;
  objects: { objectId: string; generation: number }[];
  materialIds: string[];
  zoneIds: string[];
  colliders?: { colliderId: string; objectId: string }[];
  zonePositions?: Record<string, Vec3>;
  assetRegistry: BehaviorAsset[];
  /** Explicitly enables descriptor fixtures; never use for product playback. */
  validationMode?: "product" | "offlineFixture";
}

export interface BehaviorRuntimeOptions {
  experimentId: string;
  runEpoch: string;
  fixedDtSeconds?: number;
  randomSeed?: number;
  maxVoices?: number;
  maxVoicesPerObject?: number;
  maxRecentEvents?: number;
  maxTraceEntries?: number;
}

/** Logical command for a separate audio host. A VoiceIntent is not playback evidence. */
export interface VoiceIntent {
  action: "start" | "update" | "stop";
  event: AudioEvent;
  generator: SoundGenerator;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  smoothingSeconds: number;
  filterCutoffHz?: number;
  expiresAtTick?: number;
}

export interface BehaviorDecision {
  tick: number;
  sequence: number;
  bindingId: string | null;
  ruleId: string | null;
  inputEventId: string | null;
  instanceId: string | null;
  action: "start" | "update" | "stop" | "reject";
  reason: string;
}

export interface BehaviorStepResult {
  events: AudioEvent[];
  voices: VoiceIntent[];
  decisions: BehaviorDecision[];
}

export interface BehaviorSnapshot {
  schemaVersion: "1.0.0";
  state: BehaviorRuntimeState;
  paused: boolean;
  requiresNewEpoch: boolean;
  inputCursor: { tick: number; sequence: number; eventId: string } | null;
  voiceMetadata: {
    instanceId: string;
    generator: SoundGenerator;
    expiresAtTick: number | null;
    releaseAtTick: number | null;
    priority: number;
    filterCutoffHz: number | null;
    startEventId: string | null;
    lastContact: ContactData | null;
  }[];
}

export interface ActiveRuleState {
  bindingId: string;
  activeRuleIds: string[];
}

export interface BehaviorRuntime {
  step(frame: BehaviorFrame): BehaviorStepResult;
  getActiveRuleStates(): ActiveRuleState[];
  snapshot(): BehaviorSnapshot;
  restore(snapshot: BehaviorSnapshot): void;
  reset(runEpoch: string): void;
  setPaused(paused: boolean): void;
  replaceDocument(
    document: SoundBehaviorDocument,
    context: BehaviorContext,
    newRunEpoch?: string,
  ): void;
  notifyEnded(instanceId: string): void;
  getTrace(): BehaviorDecision[];
}

export class BehaviorRuntimeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BehaviorRuntimeError";
  }
}
