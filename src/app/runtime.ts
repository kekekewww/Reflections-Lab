import type {
  LiveMonitorFrame,
  LiveMonitorMode,
  LiveMonitorInput,
} from "../ui/live-monitor-contracts.js";
import { emitterGeometryPolicyPin } from "../capabilities/emitter-geometry-policy.js";
import { applyCommand, createScene } from "../scene/index.js";
import {
  TRAJECTORY_LIMITS,
  type ObjectTrajectory,
  type SceneObject,
  type SceneOperation,
  type SceneSpec,
  type Vec3,
} from "../scene/types.js";
import { PhysicsWorld } from "../physics/index.js";
import { CharacterMotorError } from "../physics/character-motor.js";
import type { PhysicsSnapshot } from "../physics/types.js";
import { createBehaviorRuntime } from "../audio-behavior/index.js";
import type {
  BehaviorAsset,
  BehaviorRuntime,
  BehaviorSnapshot,
  VoiceIntent,
} from "../audio-behavior/types.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { AudioEngine, AudioEngineError } from "../audio/index.js";
import type { AudioEngineConfiguration } from "../audio/engine.js";
import {
  validateNativeVoicePolicy,
  type NativeVoicePolicyOptions,
} from "../audio/virtual-policy.js";
import { finite } from "../audio/control.js";
import {
  DEFAULT_MONITOR_GAIN,
  MAX_MONITOR_GAIN,
  PRODUCT_HEADROOM_GAIN,
} from "../audio/monitor-level.js";
import {
  AUDIO_LOOKAHEAD_SECONDS,
  readStoredAudioBufferPreset,
  persistAudioBufferPreset,
  isAudioBufferPreset,
  type AudioBufferPreset,
} from "../audio/buffer-preset.js";
import type { VoiceInput, VoiceCursor } from "../audio/types.js";
import type { AudioAssetLease } from "../audio/asset-leases.js";
import { NATIVE_REFERENCE_CONTENT_MODEL } from "../audio/content-model.js";
import { captureVoiceCursorEvidence } from "./voice-cursor-evidence.js";
import { solveAcoustics } from "../acoustics/index.js";
import { acousticSceneSolverVersion } from "../capabilities/acoustic-geometry.js";
import type {
  AcousticFrame,
  AcousticRequest,
  AcousticSolution,
  Atmosphere,
} from "../acoustics/types.js";
import { InteractionHost } from "../interaction/index.js";
import {
  createProject,
  deserializeProject,
  ProjectStore,
  serializeProject,
  validateProjectAtmosphere,
} from "../persistence/index.js";
import type {
  ProjectAsset,
  ProjectDocument,
  ProjectEditorMetadata,
  StorageAdapter,
} from "../persistence/types.js";
import {
  validateEditorMetadata,
  reconcileEditorMetadata,
  projectEditorMetadata,
} from "../persistence/editor-metadata.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrame,
  RecordingConfiguration,
} from "../experiments/types.js";
import type { ReprocessConfiguration, ReprocessedFrame } from "../experiments/reprocess.js";
import { sha256Canonical } from "../experiments/hash.js";
import {
  RecordingHost,
  type RecordingBackpressureOrigin,
  type RecordingBackpressureDiagnostics,
} from "./recording-host.js";
import { AgentSession } from "./agent-session.js";
import { RenderHost } from "./render-host.js";
import { MotionWorkspace, type MotionRegistryDocument } from "../motion/index.js";
import { PathRunner } from "../motion/path-runner.js";
import { strokeOffsets, type PathProblem } from "../motion/trajectory-path.js";
import { audibleObjectIds } from "./audible-objects.js";
import { measurePaths, rankPaths, type PathGeometry } from "./trajectory-status.js";
import type { MotionTransactionHooks } from "../ai/scene-adapter.js";
import { getProviderStatus } from "../ai/client.js";
import { AcousticService } from "./acoustic-service.js";
import { ViewProjection } from "./view-projection.js";
import { LiveMonitorLabelProjection } from "./live-monitor-labels.js";
import {
  TopMonitorObservationCache,
  type TopMonitorObservationSnapshot,
} from "./live-monitor-observation.js";
import { buildAcousticRequests } from "./acoustic-input.js";
import { behaviorAcousticSource } from "./behavior-acoustic-source.js";
import { zoneRegistryPin } from "./zone-registry-pin.js";
import { RecordingEvaluationClient } from "./recording-evaluation-client.js";
import {
  RecordingAdvanceDiagnostics,
  type RecordingAdvanceDiagnosticsSnapshot,
  type RecordingAdvanceTimingInput,
} from "./recording-advance-diagnostics.js";
import { ReplayAudioHost } from "./replay-audio.js";
import { AssetHost } from "./asset-host.js";
import { StaticPreviewHost, type CapturedPreviewContact } from "./static-preview.js";
import type { AssetStagingContext, PreparedAssetBank } from "./asset-host.js";
import { BlobStore } from "../persistence/blob-store.js";
import { ExperimentToolHost } from "./experiment-tools.js";
import { replayEventViews } from "./replay-view.js";
import {
  BehaviorDiagnostics,
  NativeAdmissionDiagnostics,
  projectBehaviorDecisions,
} from "./behavior-diagnostics.js";
import { projectSceneSources, sceneSourceIdFromRuleId } from "./scene-source-behaviors.js";
import type { ToolRequest } from "../ai/types.js";
import { canonicalJson } from "../ai/validation.js";
import type { RecordingArtifact } from "../experiments/types.js";
import { Quaternion, Vector3 } from "three";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "./defaults.js";
import { toBehaviorFrame } from "./physics-behavior.js";
import { editBehaviors, reconcileBehaviors } from "./behavior-editor.js";
import type {
  LabAction,
  LabController,
  LabViewModel,
  PoseView,
  Workspace,
  AgentProvider,
  AgentProviderStatusView,
} from "../ui/contracts.js";

import type { RecordingRecoveryEntryView } from "../ui/recovery-contracts.js";

export interface RecordingClockOverrunContext
  extends Omit<RecordingBackpressureDiagnostics, "origin"> {
  readonly origin: "clockOverrun";
}

export interface RuntimeRecordingAdvanceDiagnostics extends RecordingAdvanceDiagnosticsSnapshot {
  readonly captureRunId: string | null;
  readonly runEpoch: string;
  readonly sceneRevision: number;
  readonly firstOverrunContext: Readonly<RecordingClockOverrunContext> | null;
  /** A distinct observation at the original evaluation/storage guard, if it matches this capture. */
  readonly queueGuard: Readonly<RecordingBackpressureDiagnostics> | null;
}

/** Inclusive Window monotonic observations, never exclusive CPU or audio-device timings. */
function recordingDiagnosticWallTime(): number | null {
  try {
    const value = globalThis.performance?.now();
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function recordingDiagnosticElapsed(start: number | null, end: number | null): number | null {
  return start !== null && end !== null && end >= start ? end - start : null;
}

function recordingDiagnosticNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

type RecordingGuardOrigin = RecordingBackpressureOrigin | "clockOverrun";
type RecordingGuardContext<Origin extends RecordingGuardOrigin> = Omit<
  RecordingBackpressureDiagnostics,
  "origin"
> & { readonly origin: Origin };

/** Only scalar nested telemetry is retained, and every read receives detached values. */
function copyRecordingGuardContext<Origin extends RecordingGuardOrigin>(
  value: Readonly<RecordingGuardContext<Origin>>,
): Readonly<RecordingGuardContext<Origin>> {
  return Object.freeze({
    ...value,
    evaluation: value.evaluation ? Object.freeze({ ...value.evaluation }) : null,
    persistence: value.persistence ? Object.freeze({ ...value.persistence }) : null,
    evaluationReadiness: value.evaluationReadiness
      ? Object.freeze({ ...value.evaluationReadiness })
      : null,
    persistenceReadiness: value.persistenceReadiness
      ? Object.freeze({ ...value.persistenceReadiness })
      : null,
  });
}

interface UndoEntry {
  scene: SceneSpec;
  behaviors: SoundBehaviorDocument;
  metadata?: ProjectEditorMetadata;
}
interface SuspendedLiveAudio {
  snapshot: BehaviorSnapshot;
  voices: VoiceIntent[];
  pending: PendingNativeVoice[];
  cursors: Record<string, VoiceCursor>;
}
interface PendingNativeVoice {
  input: VoiceInput;
  /** Preserve the exact enqueue event while later logical updates replace activeVoices. */
  intent: VoiceIntent;
  behaviorDocumentRevision: number;
}
export type AudioEngineResourcePolicy = false | Readonly<NativeVoicePolicyOptions>;

interface RuntimeOptions {
  /** Explicit resource representation only; omitted preserves the original engine defaults. */
  audioResourcePolicy?: AudioEngineResourcePolicy;
  storage?: StorageAdapter;
  useWorker?: boolean;
  blobStore?: BlobStore;
  assetStagingContext?: (sampleRate: number) => AssetStagingContext;
}
function runtimeAudioResourcePolicy(
  options: RuntimeOptions,
): AudioEngineResourcePolicy | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(options, "audioResourcePolicy");
  if (!descriptor) return undefined;
  const invalid = (): never => {
    throw new AudioEngineError(
      "INVALID_NATIVE_VOICE_POLICY",
      "Runtime audioResourcePolicy requires only finite native policy scalars",
    );
  };
  if (!Object.hasOwn(descriptor, "value")) return invalid();
  const value: unknown = descriptor.value;
  if (value === undefined || value === false) return value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const required = [
    "maxNativeVoices",
    "maxVirtualVoices",
    "minResidenceSeconds",
    "priorityHysteresis",
    "fairnessSeconds",
  ];
  const allowed = new Set([...required, "maxNativeGraphs", "maxNativeCarriers"]);
  const scalars: Record<string, number> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) return invalid();
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (
      !field ||
      !Object.hasOwn(field, "value") ||
      typeof field.value !== "number" ||
      !Number.isFinite(field.value)
    )
      return invalid();
    scalars[key] = field.value;
  }
  if (!required.every((key) => Object.hasOwn(scalars, key))) return invalid();
  const policy = scalars as unknown as NativeVoicePolicyOptions;
  validateNativeVoicePolicy(policy);
  return Object.freeze(policy);
}

const clone = <T>(value: T): T => structuredClone(value);
const RECORDING_PREPARATION_NOTICE = "正在準備錄製…";
const TAKE_RESTARTED_NOTICE = "場景已變更；物件回到起始位置，重新開始這段 take。";
/** Why a just-painted path will not run, said in first person where the editor's status is hidden. */
const PAINTED_PATH_NOTICES: Readonly<Record<PathProblem, string>> = {
  BLOCKED: "這條軌跡碰到固定幾何，不會執行；回到編輯器按 T 調整。",
  TOO_LONG: "這條軌跡以目前強度移動太久，不會執行；回到編輯器按 T 提高強度或縮短軌跡。",
  TOO_MANY: "同一段可執行的軌跡已達上限，這條不會執行；回到編輯器清除其他物件的軌跡。",
};
/** PhysicsWorld.createPlayer uses the CharacterMotor defaults: the eye sits 1.6 m above the foot. */
const PLAYER_EYE_HEIGHT_M = 1.6;
const id = (prefix: string): string => `${prefix}.${crypto.randomUUID().slice(0, 18)}`;
const memoryStorage = (): StorageAdapter => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

/** Exact historical default; loading legacy projects must not inherit another project's environment. */
const defaultAtmosphere = (): Atmosphere => ({
  medium: "air",
  speedOfSoundMps: 343,
  temperatureC: 20,
  bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
  dataClass: "Synthetic",
});

/** Application composition root. Engines own their clocks and return copied domain data. */
export class LabRuntime implements LabController {
  private readonly workerEnabled: boolean;
  private readonly audioResourcePolicy: AudioEngineResourcePolicy | undefined;
  private scene: SceneSpec;
  private document: SoundBehaviorDocument;
  private world: PhysicsWorld;
  private behavior: BehaviorRuntime;
  private interaction!: InteractionHost;
  private recorder!: RecordingHost;
  private recordingBackpressureDiagnostics: RecordingBackpressureDiagnostics | null = null;
  private readonly recordingAdvanceDiagnostics = new RecordingAdvanceDiagnostics();
  private recordingAdvanceCaptureRunId: string | null = null;
  private recordingAdvanceRunEpoch = "";
  private recordingAdvanceSceneRevision = 0;
  private recordingFirstOverrunContext: Readonly<RecordingClockOverrunContext> | null = null;
  private recordingAdvanceActive = false;
  private recordingHostFlushPending = false;
  private recordingHostFrameObserved = false;
  private recordingPreviousRafAtMs: number | null = null;
  private recordingCurrentRafAtMs: number | null = null;
  private recordingCallbackAtMs: number | null = null;
  /** One reused scalar input; helper storage is exactly first eight + last two + first overrun. */
  private readonly recordingAdvanceInput: RecordingAdvanceTimingInput = {
    previousRafAtMs: null,
    currentRafAtMs: null,
    callbackAtMs: null,
    deltaSeconds: null,
    accumulatorBeforeSeconds: null,
    accumulatorAfterSeconds: null,
    steps: null,
    tickBefore: null,
    tickAfter: null,
    overrun: null,
    advanceElapsedMs: null,
    onTickElapsedMs: null,
    admissionElapsedMs: null,
    publishElapsedMs: null,
    hostFlushElapsedMs: null,
  };
  private recordingPreparation: { controller: AbortController; promise: Promise<void> } | null =
    null;
  private agent!: AgentSession;
  private motion!: MotionWorkspace;
  /** Bound to the live world in initializeHosts; one take of stored paths at a time. */
  private pathRunner!: PathRunner;
  /** Measured once per scene document, against a world holding that scene's starting layout. */
  private readonly pathGeometry = new WeakMap<SceneSpec, ReadonlyMap<string, PathGeometry>>();
  private pathRanking: {
    scene: SceneSpec;
    document: SoundBehaviorDocument;
    audible: ReadonlySet<string>;
    ranked: ReturnType<typeof rankPaths>;
  } | null = null;
  private renderHost!: RenderHost;
  private renderRecording: RecordingArtifact | null = null;
  private readonly transportAssetLeases: Record<"recording" | "replay", AudioAssetLease | null> = {
    recording: null,
    replay: null,
  };
  private readonly transportAssetLeaseGeneration = { recording: 0, replay: 0 };
  private pipelineTransactionDepth = 0;
  private experimentTools!: ExperimentToolHost;
  private agentProvider: AgentProvider = "offline";
  private providerStatus: AgentProviderStatusView = {
    status: "unknown",
    reason: "尚未查詢本機Meta provider狀態；未呼叫模型。",
  };
  private acoustics: AcousticService;
  private placementAcoustics: AcousticService;
  private pauseGeneration = 0;
  /** Raised only by pauses a user input causes; the runtime's own pauses (drain, snap-back) leave it. */
  private userPauseGeneration = 0;
  /** Raised by each paintStart and by a paintEnd with no stroke; a stale start never begins painting. */
  private paintGeneration = 0;
  /**
   * Set by every scene commit that changes the live world, cleared when the world is built or reset
   * from the scene. An edited world ended its take and holds its bodies in edit order, so a take
   * from it would not repeat; Play and Record with runnable paths reset it first.
   */
  private takeStale = false;
  private replayStarting = false;
  private replayGeneration = 0;
  private replayCancellation = 0;
  private replayPrelude: Promise<void> | null = null;
  private replayOperation: Promise<unknown> | null = null;
  private replayClosing: Promise<void> | null = null;
  private audio: AudioEngine | null = null;
  private desiredMonitorGain = DEFAULT_MONITOR_GAIN;
  private desiredMonitorMode: "raw" | "simulated" = "simulated";
  private audioBufferPreset = readStoredAudioBufferPreset();
  private audioRestarting = false;
  private liveMonitorMode: LiveMonitorMode | null = null;
  private liveMonitorReadAtMs = -Infinity;
  private liveMonitorPhysicsMs: number | null = null;
  private liveMonitorLabels = new LiveMonitorLabelProjection();
  private topMonitorObservation = new TopMonitorObservationCache();
  private staticPreview = new StaticPreviewHost({
    getEngine: () => this.audio,
    acquireAssetBank: (ids) => this.assetHost.acquireAssetBank("static-preview", ids),
    onChanged: () => {
      if (this.view && !this.disposed) this.requestPublication();
    },
  });
  // At most 64 accepted contacts share one immutable authoring snapshot per revision/epoch.
  private previewContacts = new Map<string, CapturedPreviewContact>();
  private previewContactDocument: SoundBehaviorDocument | null = null;
  private previewContactEpoch = "";
  private previewIntent = 0;
  private reverbSettings = { enabled: false, decaySeconds: 1.2, wetGain: 0.12 };
  private assets: BehaviorAsset[] = [];
  private projectAssets: ProjectAsset[] = [];
  private blobStore: BlobStore;
  private ownsBlobStore: boolean;
  private assetHost: AssetHost;
  private pendingProject: ProjectDocument | null = null;
  private storedArtifacts = new Map<string, RecordingArtifact>();
  private recordingEvaluation: RecordingEvaluationClient;
  private replayAudio = new ReplayAudioHost({
    getEngine: () => this.audio,
    getAssets: () => this.assets,
  });
  private suspendedLiveAudio: SuspendedLiveAudio | null = null;
  private restoreLiveAudioOnRun: SuspendedLiveAudio | null = null;
  private project: ProjectDocument;
  private editorMetadata: ProjectEditorMetadata | undefined;
  private lastBehaviorEdit: LabViewModel["lastBehaviorEdit"];
  private store: ProjectStore;
  private workspace: Workspace = "scene";
  private selected = "ball";
  private selectedPath: string | null = null;
  private selectedEvent: string | null = null;
  private runEpoch = id("epoch");
  private runId = id("run");
  private latest: PhysicsSnapshot;
  private replayPoses = new Map<string, PoseView>();
  private replayFrame: RecordingFrame | null = null;
  private recordedAcousticFrames: AcousticFrame[] = [];
  private replayEvents: LabViewModel["events"] = [];
  private replayPaused = true;
  private replayAccumulator = 0;
  private alpha = 1;
  private poseCacheSnapshot: PhysicsSnapshot | null = null;
  private poseCacheAlpha = NaN;
  private poseCache = new Map<string, PoseView>();
  private view!: LabViewModel;
  private viewProjection = new ViewProjection();
  private subscribers = new Set<() => void>();
  private undoStack: UndoEntry[] = [];
  private buildShape: SceneObject["shape"] = "box";
  private redoStack: UndoEntry[] = [];
  private aiSceneTransactions = new Map<
    string,
    { before: UndoEntry; after: SoundBehaviorDocument; afterMetadata: ProjectEditorMetadata | null }
  >();
  private activeVoices = new Map<string, VoiceIntent>();
  private pendingAudio = new Map<string, PendingNativeVoice>();
  private solutions = new Map<string, AcousticSolution>();
  private cachedEmitterFrames = new Map<string, AcousticFrame>();
  private cachedEmitterPositions = new Map<string, Vec3>();
  private eventLog: LabViewModel["events"] = [];
  private behaviorDiagnostics = new BehaviorDiagnostics();
  private nativeAdmissionDiagnostics = new NativeAdmissionDiagnostics();
  // Startup help lives in tooltips and PARAMETER_REFERENCE.md; the status line starts empty.
  private notice = "";
  /** The interaction message currently standing in as the pause reason, if any. */
  private pausedInteractionNotice: string | null = null;
  private error = "";
  private pauseReason = "";
  private atmosphere: Atmosphere = defaultAtmosphere();
  private busy = false;
  private fpsEntryGeneration = 0;
  private disposed = false;
  private lastSolve = -Infinity;
  private lastPublish = -Infinity;
  private clock = 0;
  private lastOverrunNotice = -Infinity;
  private droppedWallTimeSinceNotice = 0;
  private advancing = false;
  private shortTakeActive = false;
  private shortTakeCompletion: Promise<void> | null = null;
  private recordingStartCompletion: Promise<void> | null = null;
  private publicationPending = false;

  static async create(options: RuntimeOptions = {}): Promise<LabRuntime> {
    const scene = createDefaultScene();
    const world = await PhysicsWorld.create(scene, { clockMode: "interactive" });
    let app: LabRuntime | null = null;
    try {
      const signalGenerator = {
        algorithm: "tone-v1" as const,
        durationSeconds: 1,
        sampleRateHz: 48000 as const,
        frequencyHz: 220,
      };
      const signal: ProjectAsset = {
        assetId: "signal.tone-220",
        revision: 1,
        sha256: await sha256Canonical(signalGenerator),
        name: "220 Hz sine · generated descriptor",
        mimeType: "application/x-reflection-lab-generator",
        byteLength: new TextEncoder().encode(JSON.stringify(signalGenerator)).byteLength,
        storage: "generatedDescriptor",
        rights: {
          license: "PROJECT_GENERATED",
          source:
            "tone-v1 generator descriptor; hash covers canonical descriptor, not measured PCM",
        },
        generator: signalGenerator,
      };
      app = new LabRuntime(scene, world, options, [signal]);
      await app.initializePipeline();
      app.initializeHosts();
      app.publish();
      await app.solveCurrent();
      return app;
    } catch (error) {
      if (app) app.dispose();
      else world.dispose();
      throw error;
    }
  }
  private constructor(
    scene: SceneSpec,
    world: PhysicsWorld,
    options: RuntimeOptions,
    projectAssets: ProjectAsset[],
  ) {
    this.audioResourcePolicy = runtimeAudioResourcePolicy(options);
    this.workerEnabled = options.useWorker ?? true;
    this.recordingEvaluation = new RecordingEvaluationClient({
      useWorker: this.workerEnabled,
      getAssets: () => this.assets,
    });
    this.scene = scene;
    this.world = world;
    this.pathGeometry.set(scene, measurePaths(scene, world));
    this.latest = world.snapshot();
    this.document = createDefaultBehaviors(scene);
    this.behavior = this.newBehavior();
    this.acoustics = new AcousticService(options.useWorker ?? true);
    // One representative source, bounded by the existing geometry/path budgets.
    // Staging never creates or restarts a second acoustic worker.
    this.placementAcoustics = new AcousticService(false);
    this.store = new ProjectStore(
      options.storage ?? (typeof localStorage !== "undefined" ? localStorage : memoryStorage()),
    );
    this.projectAssets = clone(projectAssets);
    this.blobStore = options.blobStore ?? new BlobStore();
    this.ownsBlobStore = options.blobStore === undefined;
    this.assetHost = new AssetHost({
      store: this.blobStore,
      getEngine: () => this.audio,
      initialProjectAssets: projectAssets,
      ...(options.assetStagingContext ? { createStagingContext: options.assetStagingContext } : {}),
    });
    this.syncAssets();
    this.project = createProject({
      projectId: "project.reflection-lab",
      name: "聲音行為實驗",
      scene,
      soundBehaviors: this.document,
      assets: this.projectAssets,
    });
  }
  private async initializePipeline(): Promise<void> {
    this.motion = await MotionWorkspace.create(this.scene, this.world, {
      getScene: () => clone(this.scene),
      onChange: () => {
        if (this.view && !this.disposed) this.requestPublication();
      },
    });
    this.renderHost = new RenderHost({
      getRecording: () => this.renderRecording ?? this.recorder?.getArtifact() ?? null,
      getAssetBank: () => this.assetHost.getAssetBank(),
      acquireAssetBank: () => this.assetHost.acquireAssetBank("offline"),
      getMasterSettings: () => ({
        headroomGain: PRODUCT_HEADROOM_GAIN,
        monitorGain: this.audio?.getTelemetry().monitorGain ?? this.desiredMonitorGain,
        limiterEnabled: true,
        outputSafetyClip: true,
        lateReverb: {
          ...this.reverbSettings,
          seed: this.audio?.getTelemetry().lateReverb.seed ?? 1,
        },
      }),
    });
  }
  private motionTransactionHooks(): MotionTransactionHooks {
    return {
      getSnapshot: () => {
        const document = this.motion.getSnapshot();
        return { namespace: "motion", revision: document.revision, document };
      },
      preview: async (requests, candidateScene, removedObjectIds) => {
        const result = await this.motion.previewTrajectories(
          requests,
          candidateScene,
          removedObjectIds,
        );
        return {
          ...result,
          candidate: {
            namespace: "motion",
            revision: result.candidate.revision,
            document: result.candidate,
          },
        };
      },
      prepareRestore: async (previous, candidateScene) => ({
        ...previous,
        document: await this.motion.projectRestoredRegistry(
          previous.document as MotionRegistryDocument,
          candidateScene,
        ),
      }),
      commit: async (input) => {
        await this.drain();
        // A person approved this edit, and a scene edit ends the take, as commitScene says below.
        this.motion.cancelAll("scene-edit");
        this.pipelineTransactionDepth++;
        try {
          return await this.motion.withExternalTransaction(
            input.candidate.document as MotionRegistryDocument,
            input.before.document as MotionRegistryDocument,
            input.scene,
            async () => {
              if (this.scene.sceneRevision !== input.expectedSceneRevision)
                throw new Error("REVISION_CONFLICT");
              if (canonicalJson(this.scene) !== canonicalJson(input.scene))
                await this.commitAgentScene(
                  input.scene,
                  input.expectedSceneRevision,
                  input.transactionId,
                  input.requests,
                );
              return clone(this.scene);
            },
          );
        } finally {
          this.pipelineTransactionDepth--;
          this.requestPublication();
        }
      },
      restore: async (input) => {
        await this.drain();
        this.motion.cancelAll("scene-edit");
        this.pipelineTransactionDepth++;
        try {
          return await this.motion.withExternalTransaction(
            input.restore.document as MotionRegistryDocument,
            input.expectedCurrent.document as MotionRegistryDocument,
            input.scene,
            async () => {
              if (this.scene.sceneRevision !== input.expectedSceneRevision)
                throw new Error("REVISION_CONFLICT");
              if (canonicalJson(this.scene) !== canonicalJson(input.scene))
                await this.commitAgentScene(
                  input.scene,
                  input.expectedSceneRevision,
                  input.transactionId,
                  [],
                );
              return clone(this.scene);
            },
            true,
          );
        } finally {
          this.pipelineTransactionDepth--;
          this.requestPublication();
        }
      },
    };
  }
  private initializeHosts(): void {
    this.interaction = new InteractionHost({
      getWorld: () => this.world,
      getScene: () => clone(this.scene),
      getListenerPose: () => ({
        positionM: [...this.scene.listener.positionM],
        orientationQuaternion: [...this.scene.listener.orientationQuaternion],
      }),
      commitSceneOperations: (operations, guard, policy) =>
        policy === "placement"
          ? this.commitPlacement(operations, guard!)
          : this.editScene(operations, guard),
      onChange: () => {
        if (this.view) this.requestPublication();
      },
      onPause: (reason) => this.pauseCore(reason),
      onAudioFade: () => {
        if (this.audio) void this.audio.pause(this.currentSimulationTime());
      },
      onNotice: (message) => {
        this.notice = message;
        // While the live simulation waits, the newest interaction outcome or refusal
        // is why; the status line shows the pause reason first. Replay keeps its own.
        const replaying =
          Boolean(this.replayFrame) || this.recorder?.getView().recording.state === "replaying";
        // Either way a message from paused time (replay included) expires once live time runs.
        this.pausedInteractionNotice = this.world.paused ? message : null;
        if (this.world.paused && !replaying && !this.interaction.snapshot().staged)
          this.pauseReason = message;
        this.requestPublication();
      },
      onLibrary: () => {
        this.workspace = "scene";
        this.requestPublication();
      },
      createBuildDraft: () => this.newObject(this.buildShape),
      placementRefusal: () => this.placementRefusal(),
      confirmGeometry: async (objectId, revision, draft, signal) => {
        if (revision !== this.scene.sceneRevision + 1 || draft.id !== objectId) return false;
        const staged = applyCommand(this.scene, {
          expectedSceneRevision: revision - 1,
          operations: [{ type: "AddObject", object: draft }],
        }).scene;
        // Prepare the same local acoustic geometry used by live solving. The
        // staged pose is data only: no live body, source or voice is registered.
        const poses = [
          ...this.world.snapshot().poses,
          {
            objectId,
            positionMetres: draft.positionM,
            rotation: draft.orientationQuaternion,
          },
        ];
        const requests = buildAcousticRequests({
          scene: staged,
          poses,
          sources: staged.sources
            .filter((source) => source.playing)
            .slice(0, 1)
            .map((source) => ({
              id: source.id,
              objectId: source.objectId,
              positionM: poses.find((pose) => pose.objectId === source.objectId)!.positionMetres,
            })),
          listener: this.listener(),
          tick: this.world.tick,
          materials: DEFAULT_MATERIALS,
          atmosphere: this.atmosphere,
        });
        // Separate acknowledgement transport: live solves and input continue while staging.
        const cancel = () => this.placementAcoustics.cancel("PLACEMENT_CANCELLED");
        signal?.throwIfAborted();
        signal?.addEventListener("abort", cancel, { once: true });
        try {
          await this.placementAcoustics.solve(requests);
          signal?.throwIfAborted();
        } finally {
          signal?.removeEventListener("abort", cancel);
        }
        return true;
      },
    });
    this.recorder = new RecordingHost({
      getConfig: () => this.recordingConfig(),
      createPersistence: (recorder, callbacks) =>
        this.blobStore.createRecordingPersistence(recorder, callbacks),
      ...(this.workerEnabled && typeof Worker !== "undefined"
        ? { sealRecording: (recorder) => this.blobStore.sealRecording(recorder) }
        : {}),
      reprocessFrame: (frame, changes, baseline) => this.reprocessFrame(frame, changes, baseline),
      evaluateCapture: (requests) => this.recordingEvaluation.capture(requests),
      batchCaptureEvaluation: this.recordingEvaluation.mode === "worker",
      cancelEvaluation: (reason) => this.recordingEvaluation.cancel(reason),
      onEvaluationBackpressure: (origin) => {
        this.captureRecordingBackpressureDiagnostics(origin);
        this.pauseCore("錄製評估佇列已滿，已在完整 tick 邊界暫停；處理後可繼續。");
      },
      onEvaluationFailure: (error) => {
        if (this.disposed) return;
        this.pauseCore(`錄製評估失敗；已保留完整前綴：${error.message}`);
      },
      onEvaluationChanged: () => {
        if (!this.disposed && this.view) this.requestPublication();
      },
    });
    this.experimentTools ??= new ExperimentToolHost({
      getConfiguration: () => this.recordingConfig(),
      getAssets: () => clone(this.assets),
      getRecording: (runId) =>
        this.storedArtifacts.get(runId) ??
        [this.recorder.getArtifact(), ...Object.values(this.recorder.getSlots())].find(
          (artifact) => artifact?.runId === runId,
        ) ??
        null,
      persistRecording: async (artifact) => {
        await this.blobStore.saveRecording(artifact);
        this.storedArtifacts.set(artifact.runId, artifact);
      },
    });
    this.agent = new AgentSession({
      getScene: () => clone(this.scene),
      getBehaviorState: () => ({
        sceneId: this.scene.sceneId,
        sceneRevision: this.scene.sceneRevision,
        document: clone(this.document),
        context: makeBehaviorContext(this.scene, this.world.snapshot().poses, this.assets),
      }),
      commitScene: async (
        next: SceneSpec,
        expected: number,
        transactionId: string,
        requests: ToolRequest[],
      ) => {
        await this.commitAgentScene(next, expected, transactionId, requests);
        return clone(this.scene);
      },
      commitBehavior: async (
        next: SoundBehaviorDocument,
        docRevision: number,
        sceneRevision: number,
      ) => {
        if (this.document.revision !== docRevision || this.scene.sceneRevision !== sceneRevision)
          throw new Error("REVISION_CONFLICT");
        await this.commitBehavior(next);
        return clone(this.document);
      },
      getRegistries: () => ({
        materials: DEFAULT_MATERIALS.map((material) => ({
          id: material.id,
          label: material.label,
        })),
        signals: [{ id: "signal.tone-220", label: "220 Hz sine", frequencyHz: 220 }],
        materialRegistryRevision: 1,
        selectedObjectId: this.selected,
      }),
      runTool: (request) => this.experimentTools.execute(request),
      resolveGroundingArtifact: (artifactId) =>
        this.experimentTools.getGroundingArtifact(artifactId),
      cancelTool: (requestId) => this.experimentTools.cancel(requestId),
      motionTransaction: this.motionTransactionHooks(),
      onChange: () => {
        if (this.view && !this.disposed) this.requestPublication();
      },
    });
    // Every world swap passes here, so the path runner always observes the live world.
    this.pathRunner?.dispose();
    this.pathRunner = new PathRunner(this.world, () => {
      if (this.view && !this.disposed) this.requestPublication();
    });
    // Bind after all host replacements: its onChange publishes the current graph.
    this.motion?.bindWorld(this.world);
  }
  /** Status of every stored path and the runnable set, cached per scene and behaviour document. */
  private pathStatus(): ReturnType<typeof rankPaths> {
    if (this.pathRanking?.scene === this.scene && this.pathRanking.document === this.document)
      return this.pathRanking.ranked;
    const audible = audibleObjectIds(this.scene, this.document);
    // A reset reconciles the document into a new object with the same sounds: keep the ranking.
    if (
      this.pathRanking?.scene === this.scene &&
      this.pathRanking.audible.size === audible.size &&
      [...audible].every((objectId) => this.pathRanking!.audible.has(objectId))
    ) {
      this.pathRanking = { ...this.pathRanking, document: this.document };
      return this.pathRanking.ranked;
    }
    let geometry = this.pathGeometry.get(this.scene);
    if (!geometry) {
      // Every scene assignment measures a fresh world first; the live world is a fallback only.
      geometry = measurePaths(this.scene, this.world);
      this.pathGeometry.set(this.scene, geometry);
    }
    const ranked = rankPaths(geometry, audible);
    this.pathRanking = { scene: this.scene, document: this.document, audible, ranked };
    return ranked;
  }
  /** Take start: every runnable path starts from its beginning in the scene's starting layout. */
  private beginTake(): void {
    this.pathRunner.beginTake(this.scene, this.pathStatus().runnable);
  }
  private newBehavior(): BehaviorRuntime {
    this.clearPreviewContacts();
    this.behaviorDiagnostics.clear();
    this.nativeAdmissionDiagnostics.clear();
    return createBehaviorRuntime(
      this.document,
      makeBehaviorContext(this.scene, this.world.snapshot().poses, this.assets),
      {
        experimentId: this.runId,
        runEpoch: this.runEpoch,
        randomSeed: this.scene.seed,
        maxVoices: 16,
        maxVoicesPerObject: 8,
      },
    );
  }
  getSnapshot(): LabViewModel {
    if (this.publicationPending && !this.advancing && this.pipelineTransactionDepth === 0)
      this.publish();
    return this.view;
  }
  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }
  getSceneDocument(): SceneSpec {
    return clone(this.scene);
  }
  getBehaviorDocument(): SoundBehaviorDocument {
    return clone(this.document);
  }
  /** Wait for the currently accepted capture tick without sealing or resuming. */
  async flushRecordingEvaluation(): Promise<void> {
    await this.recorder.flushEvaluation();
  }
  getRenderHost(): RenderHost {
    return this.renderHost;
  }
  getMotionWorkspace(): MotionWorkspace {
    return this.motion;
  }
  getAgentSession(): AgentSession {
    return this.agent;
  }
  getAudioDiagnostics() {
    return this.audio?.getDiagnostics() ?? null;
  }
  getTopMonitorObservationSnapshot(): TopMonitorObservationSnapshot {
    return this.topMonitorObservation.snapshot();
  }
  readLiveMonitor(
    mode: LiveMonitorMode,
    input: LiveMonitorInput = "master-left",
  ): LiveMonitorFrame | null {
    if (this.disposed) return null;
    if (!["levels", "spectrum", "waveform", "load"].includes(mode))
      throw new Error("LIVE_MONITOR_MODE");
    if (input !== "master-left" && input !== "master-right") throw new Error("LIVE_MONITOR_INPUT");
    const normalReadAtPerformanceMs = performance.now();
    if (this.liveMonitorMode !== mode) this.liveMonitorPhysicsMs = null;
    this.liveMonitorMode = mode;
    if (mode === "load") {
      this.liveMonitorLabels.clear();
      this.liveMonitorReadAtMs = normalReadAtPerformanceMs;
      this.topMonitorObservation.recordNormalRead(mode, input, normalReadAtPerformanceMs, null);
      this.audio?.releaseLiveMonitor?.();
      const acoustic = this.acoustics.getTelemetry();
      const audio = this.audio?.getDiagnostics();
      return {
        audio: null,
        load: {
          frameIntervalMs: null,
          physicsMs: this.world.paused || this.replayFrame ? null : this.liveMonitorPhysicsMs,
          acousticMs: acoustic.lastWorkerComputeMs,
          audioControlMs: audio?.timings.frameConsumer.last ?? null,
          activeVoices: this.view.monitor.activeVoices,
          voiceLimit: this.view.monitor.voiceLimit,
        },
      };
    }
    this.liveMonitorReadAtMs = -Infinity;
    const observed = this.audio?.readLiveMonitor?.(mode, input) ?? null;
    this.topMonitorObservation.recordNormalRead(mode, input, normalReadAtPerformanceMs, observed);
    if (!observed) this.liveMonitorLabels.clear();
    return {
      load: null,
      audio: observed
        ? this.liveMonitorLabels.project(
            observed,
            this.activeVoices,
            this.view.objects,
            this.runEpoch,
          )
        : {
            state: this.audio ? "unavailable" : "blocked",
            reason: this.audio ? "MONITOR_UNAVAILABLE" : "AUDIO_NOT_ENABLED",
            sampleRateHz: null,
            fftSize: 0,
            waveform: null,
            spectrumDbfs: null,
            tracks: [],
          },
    };
  }
  releaseLiveMonitor(): void {
    this.liveMonitorMode = null;
    this.liveMonitorReadAtMs = -Infinity;
    this.liveMonitorPhysicsMs = null;
    this.liveMonitorLabels.clear();
    this.topMonitorObservation.release();
    this.audio?.releaseLiveMonitor?.();
  }
  private selectWorkflowTake(): void {
    const view = this.agent.getWorkflowView();
    const take = view?.candidate ?? view?.baseline;
    if (view?.status === "completed" && take) {
      const artifact = this.experimentTools.getRun(take.runId);
      if (artifact) this.renderRecording = artifact;
    }
    this.renderHost.refresh();
  }
  getRecordingArtifact() {
    return this.recorder.getArtifact();
  }
  private async acquireTransportAssets(kind: "recording" | "replay"): Promise<AudioAssetLease> {
    const generation = ++this.transportAssetLeaseGeneration[kind];
    // Logical capture also works without an audio device. Protect the resident PCM
    // bank; native playback separately protects sources admitted during capture.
    const ids = this.assetHost.getAssetBank().map((entry) => entry.assetId);
    const lease = await this.assetHost.acquireAssetBank(kind, ids);
    if (this.disposed || generation !== this.transportAssetLeaseGeneration[kind]) {
      lease.release();
      this.assertLive();
      throw new Error(kind === "replay" ? "REPLAY_CANCELLED" : "SHORT_TAKE_INTERRUPTED");
    }
    const previous = this.transportAssetLeases[kind];
    this.transportAssetLeases[kind] = lease;
    previous?.release();
    return lease;
  }
  private releaseTransportAssets(kind: "recording" | "replay", expected?: AudioAssetLease): void {
    const current = this.transportAssetLeases[kind];
    if (expected && current !== expected) {
      expected.release();
      return;
    }
    this.transportAssetLeaseGeneration[kind]++;
    this.transportAssetLeases[kind] = null;
    current?.release();
  }
  private recoveryUnsafe(ownsTransaction = false): boolean {
    return Boolean(
      this.disposed ||
        (!ownsTransaction && this.busy) ||
        this.pendingProject ||
        this.shortTakeActive ||
        !this.world.paused ||
        this.replayStarting ||
        this.replayOperation ||
        this.replayClosing ||
        this.replayFrame ||
        this.recorder.getView().pending ||
        this.recorder.getView().recording.state === "recording" ||
        this.recorder.getView().recording.state === "replaying" ||
        this.interaction.snapshot().mode !== "editor",
    );
  }
  private assertRecoveryIdle(ownsTransaction = false): void {
    this.assertLive();
    if (this.recoveryUnsafe(ownsTransaction))
      throw new Error("RECOVERY_UNSAFE：請先暫停，並結束錄製、重播與其他操作。");
  }
  async listRecordingRecovery(): Promise<readonly RecordingRecoveryEntryView[]> {
    this.assertLive();
    const entries = await this.blobStore.listRecordingRecovery();
    this.assertLive();
    const idle = !this.recoveryUnsafe();
    const now = Date.now();
    return entries.map((entry) => {
      const active = entry.state === "staging" && entry.leaseExpiresAt > now;
      return {
        ...entry,
        canRecover: idle && !active && entry.persistedFrames > 0,
        canDiscard: idle && !active,
      };
    });
  }
  recoverRecording(sessionId: string): Promise<void> {
    return this.recordingRecoveryOperation(sessionId, "recover");
  }
  discardRecordingRecovery(sessionId: string): Promise<void> {
    return this.recordingRecoveryOperation(sessionId, "discard");
  }
  private async recordingRecoveryOperation(
    sessionId: string,
    operation: "recover" | "discard",
  ): Promise<void> {
    this.assertRecoveryIdle();
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 256)
      throw new Error("RECOVERY_MISSING：找不到這份中斷錄製。");
    const epoch = this.runEpoch;
    const sceneRevision = this.scene.sceneRevision;
    const documentRevision = this.document.revision;
    const current = () => {
      this.assertRecoveryIdle(true);
      if (
        this.runEpoch !== epoch ||
        this.scene.sceneRevision !== sceneRevision ||
        this.document.revision !== documentRevision
      )
        throw new Error("RECOVERY_IDENTITY：復原資料的來源與所選記錄不符。");
    };
    this.busy = true;
    this.requestPublication();
    try {
      const entries = await this.blobStore.listRecordingRecovery();
      current();
      const entry = entries.find((candidate) => candidate.sessionId === sessionId);
      if (!entry) throw new Error("RECOVERY_MISSING：找不到這份中斷錄製。");
      if (entry.state === "staging" && entry.leaseExpiresAt > Date.now())
        throw new Error("RECOVERY_ACTIVE：這份錄製仍由其他工作階段使用。");
      if (operation === "discard") {
        await this.blobStore.discardRecordingRecovery(sessionId);
        current();
      } else {
        if (entry.persistedFrames < 1)
          throw new Error("RECOVERY_EMPTY：這份錄製尚無可復原的完整影格。");
        const artifact = await this.blobStore.recoverRecording(sessionId);
        current();
        if (artifact.status !== "interrupted")
          throw new Error("RECOVERY_STATE：只能載入已驗證的中斷錄製。");
        if (
          artifact.runId !== entry.runId ||
          artifact.runEpoch !== entry.runEpoch ||
          artifact.configuration.sceneSnapshot.sceneRevision !== entry.sceneRevision
        )
          throw new Error("RECOVERY_IDENTITY：復原資料的來源與所選記錄不符。");
        await this.recorder.restoreArtifact(artifact);
        current();
        this.renderRecording = null;
        this.renderHost.refresh();
      }
      this.error = "";
    } finally {
      this.busy = false;
      if (!this.disposed) this.requestPublication();
    }
  }
  getComparisonArtifacts() {
    return this.recorder.getSlots();
  }
  /** A user-triggered bounded capture drives the same world, motion hooks and recorder. */
  async captureShortTake(durationSeconds: number): Promise<void> {
    if (this.replayClosing) await this.replayClosing;
    this.assertLive();
    const steps = Math.round(durationSeconds * 60);
    if (
      !Number.isFinite(durationSeconds) ||
      steps < 1 ||
      steps > 3600 ||
      Math.abs(steps / 60 - durationSeconds) > 1e-9
    )
      throw new Error("SHORT_TAKE_DURATION: use 1/60 s steps, at most 60 s");
    if (
      this.busy ||
      this.shortTakeActive ||
      this.pendingProject ||
      this.recorder.getView().recording.state === "recording" ||
      this.recorder.getView().recording.state === "replaying" ||
      this.interaction.snapshot().mode !== "editor"
    )
      throw new Error("SHORT_TAKE_BUSY: stop recording/replay and return to the editor");
    const preparationGeneration = this.pauseGeneration;
    let completeShortTake!: () => void;
    const completion = new Promise<void>((resolve) => {
      completeShortTake = resolve;
    });
    this.shortTakeCompletion = completion;
    this.shortTakeActive = true;
    this.busy = true;
    this.error = "";
    try {
      await this.stopPreviews();
      this.assertLive();
      if (preparationGeneration !== this.pauseGeneration) throw new Error("SHORT_TAKE_INTERRUPTED");
      await this.acquireTransportAssets("recording");
      this.assertLive();
      if (preparationGeneration !== this.pauseGeneration) throw new Error("SHORT_TAKE_INTERRUPTED");
      this.pauseCore("短 take：由固定步進控制錄製");
      const generation = this.pauseGeneration;
      const revision = this.scene.sceneRevision;
      const startTick = this.latest.tick;
      if (!(await this.prepareRecordingCapture())) throw new Error("SHORT_TAKE_INTERRUPTED");
      this.assertLive();
      if (generation !== this.pauseGeneration || revision !== this.scene.sceneRevision)
        throw new Error("SHORT_TAKE_INTERRUPTED");
      this.world.clock.setMode("recording");
      this.recorder.resume();
      this.recordingBackpressureDiagnostics = null;
      this.beginRecordingAdvanceCapture();
      this.behavior.setPaused(false);
      this.world.resume();
      this.markRecordingAdvanceResumed();
      this.pauseReason = "";
      for (let index = 0; index < steps; index++) {
        this.assertLive();
        if (generation !== this.pauseGeneration || revision !== this.scene.sceneRevision)
          throw new Error("SHORT_TAKE_INTERRUPTED: paused or author data changed");
        this.advance(1 / 60, true);
        await this.recorder.flushEvaluation();
        if (this.latest.tick !== startTick + index + 1 || this.world.paused)
          throw new Error("SHORT_TAKE_INTERRUPTED: fixed step did not complete");
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (generation !== this.pauseGeneration) throw new Error("SHORT_TAKE_INTERRUPTED");
      this.world.pause();
      this.behavior.setPaused(true);
      this.recorder.pause();
      await this.recorder.stop();
      await this.persistRecordings();
      this.renderRecording = this.recorder.getArtifact();
      this.renderHost.refresh();
      this.notice = "短 take 已完成；可在音訊匯出產生混音與各聲源音檔。";
      this.pauseReason = "短 take 已完成；模擬保持暫停";
    } catch (error) {
      try {
        await this.recorder.interrupt("SHORT_TAKE_INTERRUPTED");
      } catch (cleanupError) {
        if (!this.disposed) this.notice = String(cleanupError);
      }
      if (!this.disposed) this.fail(error, false);
      throw error;
    } finally {
      try {
        this.releaseTransportAssets("recording");
        this.shortTakeActive = false;
        this.busy = false;
        if (!this.disposed) {
          this.world.pause();
          this.behavior.setPaused(true);
          this.world.clock.setMode("interactive");
          this.requestPublication();
        }
      } finally {
        if (this.shortTakeCompletion === completion) this.shortTakeCompletion = null;
        completeShortTake();
      }
    }
  }
  getPose(objectId: string): PoseView | undefined {
    const replay = this.replayPoses.get(objectId);
    if (replay) return clone(replay);
    if (this.poseCacheSnapshot !== this.latest || this.poseCacheAlpha !== this.alpha) {
      this.poseCache = new Map(
        this.world.interpolatedTransforms(this.alpha).map((pose) => [
          pose.objectId,
          {
            positionM: [...pose.positionMetres] as Vec3,
            orientationQuaternion: [...pose.rotation] as [number, number, number, number],
          },
        ]),
      );
      this.poseCacheSnapshot = this.latest;
      this.poseCacheAlpha = this.alpha;
    }
    const pose = this.poseCache.get(objectId);
    return pose ? clone(pose) : undefined;
  }
  getFPSCamera(): PoseView | undefined {
    return this.interaction?.getFPSCamera();
  }
  private listener(): SceneSpec["listener"] {
    const camera = this.getFPSCamera();
    return camera
      ? { ...this.scene.listener, ...clone(camera), attachment: "fpsHead" }
      : clone(this.scene.listener);
  }
  private remember(): void {
    this.undoStack.push({
      scene: clone(this.scene),
      behaviors: clone(this.document),
      ...(this.editorMetadata ? { metadata: clone(this.editorMetadata) } : {}),
    });
    if (this.undoStack.length > 64) this.undoStack.shift();
    this.redoStack = [];
  }
  private async replayTask<T>(task: () => Promise<T>): Promise<T> {
    const operation = task();
    this.replayOperation = operation;
    try {
      return await operation;
    } finally {
      if (this.replayOperation === operation) this.replayOperation = null;
    }
  }
  private async openReplay(paused: boolean, requestedPauseGeneration: number): Promise<boolean> {
    if (!this.recorder.getView().recording.canReplay) throw new Error("REPLAY_UNAVAILABLE");
    const requestedPause = requestedPauseGeneration !== this.pauseGeneration;
    const requestedPauseReason = requestedPause ? this.pauseReason : null;
    const generation = ++this.replayGeneration;
    const current = () => !this.disposed && generation === this.replayGeneration;
    this.nativeAdmissionDiagnostics.clear();
    this.suspendedLiveAudio ??= this.restoreLiveAudioOnRun ?? this.captureLiveAudio();
    this.restoreLiveAudioOnRun = null;
    this.activeVoices.clear();
    this.pendingAudio.clear();
    this.replayPaused = true;
    this.interaction.pausePreservingInputMode("已錄軌跡重播，未重新模擬物理");
    const pauseGeneration = this.pauseGeneration;
    this.acoustics.cancel("REPLAY_STARTED");
    if (this.audio) await this.audio.drainVoices();
    if (!current()) return false;
    let lease: AudioAssetLease | null = null;
    let retainLease = false;
    try {
      lease = await this.acquireTransportAssets("replay");
      if (!current()) return false;
      this.solutions.clear();
      this.cachedEmitterFrames.clear();
      this.cachedEmitterPositions.clear();
      this.replayPoses.clear();
      this.replayFrame = null;
      this.recordedAcousticFrames = [];
      this.replayAccumulator = 0;
      await this.recorder.replay();
      if (!current()) return false;
      const artifact = this.recorder.getArtifact();
      if (!artifact) throw new Error("NO_RECORDING");
      // Verify a private catalog without touching audio. A cancelled verifier
      // cannot resume native content or replace another session's catalog.
      let catalogOnly = true;
      const host = new ReplayAudioHost({
        getEngine: () => (!catalogOnly && current() ? this.audio : null),
        getAssets: () => this.assets,
      });
      await host.begin(artifact);
      if (!current()) return false;
      this.replayAudio = host;
      catalogOnly = false;
      this.replayEvents = replayEventViews(artifact);
      if (paused || requestedPause || pauseGeneration !== this.pauseGeneration) {
        this.recorder.pause();
        this.replayPaused = true;
        if (requestedPauseReason && pauseGeneration === this.pauseGeneration)
          this.pauseReason = requestedPauseReason;
        retainLease = true;
        return true;
      }
      await host.resume();
      if (!current()) return false;
      if (pauseGeneration !== this.pauseGeneration) {
        this.recorder.pause();
        this.replayPaused = true;
      } else {
        this.recorder.resume();
        this.replayPaused = false;
        this.pauseReason = "重播已錄物理軌跡；未重新執行Rapier";
      }
      retainLease = true;
      return true;
    } catch (error) {
      if (!current()) return false;
      throw error;
    } finally {
      if (!retainLease && lease) this.releaseTransportAssets("replay", lease);
    }
  }
  private finishReplay(
    reason = "已返回暫停的即時場景；繼續時恢復原來源游標，不重發舊事件。",
  ): Promise<void> {
    if (this.replayClosing) return this.replayClosing;
    if (
      this.disposed ||
      (!this.replayStarting &&
        !this.replayOperation &&
        !this.replayFrame &&
        !this.suspendedLiveAudio &&
        this.recorder.getView().recording.state !== "replaying")
    )
      return Promise.resolve();
    const replayLease = this.transportAssetLeases.replay;
    this.transportAssetLeaseGeneration.replay++;
    ++this.replayGeneration;
    ++this.replayCancellation;
    this.suspendedLiveAudio ??= this.restoreLiveAudioOnRun ?? this.captureLiveAudio();
    this.restoreLiveAudioOnRun = null;
    this.activeVoices.clear();
    this.pendingAudio.clear();
    this.replayPaused = true;
    // pause() cancels native Resume synchronously; drain alone cannot.
    this.interaction.pausePreservingInputMode(reason);
    const pauseGeneration = this.pauseGeneration;
    const engine = this.audio;
    const host = this.replayAudio;
    const operation = this.replayOperation;
    const prelude = this.replayPrelude;
    const closing = (async () => {
      if (prelude) await prelude.catch(() => {});
      if (operation) await operation.catch(() => {});
      if (this.disposed) return;
      await host.stop();
      // The invalidated per-session host cannot fetch a native engine.
      // Drain the captured engine once before restoring live logical voices.
      if (engine) await engine.drainVoices();
      if (this.disposed) return;
      this.recorder.stopReplay();
      this.replayPoses.clear();
      this.replayFrame = null;
      this.replayEvents = [];
      this.recordedAcousticFrames = [];
      this.replayAccumulator = 0;
      if (this.suspendedLiveAudio) {
        const saved = this.suspendedLiveAudio;
        this.behavior.restore(saved.snapshot);
        this.behavior.setPaused(true);
        this.activeVoices = new Map(
          saved.voices.map((voice) => [voice.event.instanceId, clone(voice)]),
        );
        this.pendingAudio = new Map(
          saved.pending.map((pending) => [pending.input.instanceId, clone(pending)]),
        );
        this.restoreLiveAudioOnRun = saved;
        this.suspendedLiveAudio = null;
      }
      this.solutions.clear();
      this.cachedEmitterFrames.clear();
      this.cachedEmitterPositions.clear();
      this.syncAudioListener();
      if (pauseGeneration === this.pauseGeneration) this.pauseReason = reason;
      this.requestPublication();
    })();
    const completion = closing.finally(() => {
      this.releaseTransportAssets("replay", replayLease ?? undefined);
      if (this.replayClosing === completion) this.replayClosing = null;
    });
    this.replayClosing = completion;
    return completion;
  }

  /** Applies a user input synchronously; a pause it causes counts as a user pause. */
  private userInput(apply: () => void): void {
    const before = this.pauseGeneration;
    try {
      apply();
    } finally {
      if (this.pauseGeneration !== before) this.userPauseGeneration++;
    }
  }
  private pauseCore(reason = "使用者暫停"): void {
    this.cancelRecordingPreparation("PAUSED");
    this.pauseGeneration++;
    this.interaction?.abortPlacement();
    this.world.pause();
    this.behavior.setPaused(true);
    this.pauseReason = reason;
    if (this.audio) void this.audio.pause(this.currentSimulationTime());
    this.recorder?.pause();
  }
  private async drain(): Promise<void> {
    if (this.replayClosing) await this.replayClosing;
    await this.stopPreviews();
    this.clearPreviewContacts();
    this.nativeAdmissionDiagnostics.clear();
    this.suspendedLiveAudio = null;
    this.restoreLiveAudioOnRun = null;
    this.acoustics.cancel("AUTHORING_CANCELLED");
    if (this.recorder?.getView().recording.state === "recording") {
      try {
        await this.recorder.interrupt("作者資料變更中斷目前錄製");
        await this.persistRecordings();
      } finally {
        this.releaseTransportAssets("recording");
      }
    }
    this.pauseCore("作者編輯：暫停並清理舊聲音");
    this.activeVoices.clear();
    this.pendingAudio.clear();
    this.solutions.clear();
    this.cachedEmitterFrames.clear();
    this.cachedEmitterPositions.clear();
    if (this.replayFrame || this.recorder.getView().recording.state === "replaying") {
      await this.replayAudio.stop();
      this.recorder.stopReplay();
      this.replayFrame = null;
      this.replayPoses.clear();
      this.recordedAcousticFrames = [];
    }
    if (this.audio) await this.audio.drainVoices();
    this.releaseTransportAssets("recording");
    this.releaseTransportAssets("replay");
  }
  /**
   * Back to the starting layout. `keepPlayer` re-creates the first-person player where it stood
   * (the look angles live in the interaction host and survive the world reset). Its own pauses
   * leave userPauseGeneration unchanged, so a caller can still see a user pause that lands meanwhile.
   */
  private async resetCore(options: { keepPlayer: boolean }): Promise<void> {
    try {
      await this.recorder.interrupt("RESET");
      await this.persistRecordings();
    } finally {
      const view = this.recorder.getView();
      if (!view.pending && view.recording.state !== "recording")
        this.releaseTransportAssets("recording");
    }
    await this.drain();
    const player = options.keepPlayer ? this.world.getPlayerPose() : null;
    this.pathRunner.clear();
    this.world.reset(this.scene);
    this.takeStale = false;
    let respawnError: unknown = null;
    if (options.keepPlayer) {
      // The reset released any grip; drop the host's lease on it so the take can resume.
      this.interaction.pausePreservingInputMode();
      if (player) {
        const eye = player.eyePositionMetres;
        try {
          this.world.createPlayer([eye[0], eye[1] - PLAYER_EYE_HEIGHT_M, eye[2]]);
        } catch (error) {
          respawnError = error;
        }
      }
    }
    this.latest = this.world.snapshot();
    this.document = reconcileBehaviors(this.document, this.scene, this.latest.poses);
    this.runEpoch = id("epoch");
    this.runId = id("run");
    this.behavior = this.newBehavior();
    this.eventLog = [];
    this.replayPoses.clear();
    this.replayFrame = null;
    this.replayPaused = true;
    await this.solveCurrent();
    // The room is reset either way. An object's starting position overlapping the player is
    // named for the UI (status codes stay bare until it catalogues them); other failures pass as is.
    if (respawnError) {
      if (respawnError instanceof CharacterMotorError && respawnError.code === "SPAWN_BLOCKED")
        throw new Error("PLAYER_RESPAWN_BLOCKED", { cause: respawnError });
      throw respawnError;
    }
  }
  /** The one path write, so the audible check cannot be bypassed; `null` removes the path. */
  private async commitTrajectory(
    objectId: string,
    trajectory: ObjectTrajectory | null,
  ): Promise<void> {
    if (!this.scene.objects.some((object) => object.id === objectId))
      throw new Error("UNKNOWN_OBJECT");
    // Removal stays open, so a path left on an object that lost its sound can be cleared.
    if (trajectory !== null && !audibleObjectIds(this.scene, this.document).has(objectId))
      throw new Error("TRAJECTORY_NOT_AUDIBLE");
    await this.editScene([{ type: "UpdateObject", objectId, patch: { trajectory } }]);
  }
  /** The audible object under the crosshair, or why a Ctrl+press cannot paint now. */
  private paintTarget(): { objectId: string } | { refusal: string } {
    const transport = this.recorder.getView().recording.state;
    if (this.replayFrame || transport === "recording" || transport === "replaying")
      return { refusal: "錄製或重播期間無法繪製軌跡；請先結束錄製或返回即時場景。" };
    const hit = this.interaction.snapshot().hover;
    if (!hit) return { refusal: "三公尺內沒有對準的物件；請以準心對準有聲音的物件。" };
    if (!audibleObjectIds(this.scene, this.document).has(hit.objectId))
      return { refusal: "只有有聲音的物件可以繪製軌跡；此物件沒有聲音行為或聲源。" };
    return { objectId: hit.objectId };
  }
  /** One revision and one Undo; all fallible preparation precedes the quiet fixed-step hold. */
  private placementRefusal(): string | null {
    if (this.audioRestarting) return "PLACEMENT_AUDIO_RESTART";
    return this.recorder?.getView().recording.state === "recording" ||
      this.replayStarting ||
      this.replayFrame ||
      this.recorder?.getView().recording.state === "replaying"
      ? "PLACEMENT_TRANSPORT"
      : null;
  }
  private async commitPlacement(operations: SceneOperation[], guard: () => void): Promise<void> {
    const refusal = this.placementRefusal();
    if (refusal) throw new Error(refusal);
    const previous = this.scene,
      world = this.world;
    const next = applyCommand(previous, {
      expectedSceneRevision: previous.sceneRevision,
      operations,
    }).scene;
    const prepared = await PhysicsWorld.create(next);
    try {
      this.pathGeometry.set(next, measurePaths(next, prepared));
      const document = reconcileBehaviors(this.document, next, prepared.snapshot().poses);
      createBehaviorRuntime(
        document,
        makeBehaviorContext(next, prepared.snapshot().poses, this.assets),
        { experimentId: this.runId, runEpoch: this.runEpoch, randomSeed: next.seed },
      );
    } finally {
      prepared.dispose();
    }
    this.assertLive();
    const applyRefusal = this.placementRefusal();
    if (applyRefusal) throw new Error(applyRefusal);
    if (
      this.world !== world ||
      this.scene !== previous ||
      this.replayFrame ||
      this.recorder.getView().recording.state === "replaying"
    )
      throw new Error("REVISION_CONFLICT");
    guard();
    const document = reconcileBehaviors(this.document, next, world.snapshot().poses);
    const saved = this.behavior.snapshot();
    const behavior = createBehaviorRuntime(
      document,
      makeBehaviorContext(next, world.snapshot().poses, this.assets),
      {
        experimentId: this.runId,
        runEpoch: this.runEpoch,
        randomSeed: next.seed,
        maxVoices: 16,
        maxVoicesPerObject: 8,
      },
    );
    behavior.restore({
      ...saved,
      state: {
        ...saved.state,
        sceneRevision: next.sceneRevision,
        documentRevision: document.revision,
      },
    });
    const wasRunning = !world.paused;
    // A scene edit ends the take: applyScene returns every path object to its scene mode.
    this.pathRunner.clear();
    // No await, publish, onPause, audio fade/drain, or status change inside this hold.
    world.pause();
    try {
      world.applyScene(next);
      if (wasRunning) world.resume();
    } catch (error) {
      world.pause();
      world.applyScene(previous);
      if (wasRunning) world.resume();
      throw error;
    } finally {
      this.takeStale = true;
    }
    this.remember();
    this.scene = next;
    this.document = document;
    this.behavior = behavior;
    this.latest = world.snapshot();
    this.lastBehaviorEdit = undefined;
    // Existing live replies carry the previous revision and are discarded by solveCurrent.
    // Let that bounded job finish: cancel() terminates the worker and would force a restart.
    void this.solveCurrent();
  }
  private async editScene(operations: SceneOperation[], guard?: () => void): Promise<void> {
    const next = applyCommand(this.scene, {
      expectedSceneRevision: this.scene.sceneRevision,
      operations,
    }).scene;
    await this.commitScene(next, this.scene.sceneRevision, true, undefined, undefined, guard);
  }
  private async commitScene(
    nextInput: SceneSpec,
    expected: number,
    remember = true,
    documentInput?: SoundBehaviorDocument,
    metadataInput?: ProjectEditorMetadata | null,
    commitGuard?: () => void,
  ): Promise<void> {
    if (this.scene.sceneRevision !== expected) throw new Error("REVISION_CONFLICT");
    const next = createScene(nextInput);
    const nextMetadata = reconcileEditorMetadata(
      metadataInput === undefined ? this.editorMetadata : (metadataInput ?? undefined),
      next,
    );
    const candidateWorld = await PhysicsWorld.create(next);
    try {
      this.pathGeometry.set(next, measurePaths(next, candidateWorld));
      const document = reconcileBehaviors(
        documentInput ?? this.document,
        next,
        candidateWorld.snapshot().poses,
      );
      createBehaviorRuntime(
        document,
        makeBehaviorContext(next, candidateWorld.snapshot().poses, this.assets),
        { experimentId: this.runId, runEpoch: id("validate"), randomSeed: next.seed },
      );
    } finally {
      candidateWorld.dispose();
    }
    if (this.gravityOnlyEdit(next, documentInput, metadataInput) && !commitGuard) {
      await this.commitGravityEdit(next, expected, remember, documentInput);
      return;
    }
    const previousWorld = this.world;
    const checkpoint = this.suspendedLiveAudio ?? this.captureLiveAudio();
    let drained = false;
    try {
      await this.drain();
      drained = true;
      this.assertLive();
      if (this.scene.sceneRevision !== expected) throw new Error("REVISION_CONFLICT");
      commitGuard?.();
    } catch (error) {
      if (
        !this.disposed &&
        this.world === previousWorld &&
        this.scene.sceneRevision === expected &&
        this.document.revision === checkpoint.snapshot.state.documentRevision
      ) {
        this.behavior.restore(checkpoint.snapshot);
        this.behavior.setPaused(true);
        this.activeVoices = new Map(
          checkpoint.voices.map((voice) => [voice.event.instanceId, clone(voice)]),
        );
        this.pendingAudio = new Map(
          checkpoint.pending.map((pending) => [pending.input.instanceId, clone(pending)]),
        );
        if (drained) this.restoreLiveAudioOnRun = checkpoint;
      }
      throw error;
    }
    if (remember) this.remember();
    // A scene edit ends the take: applyScene returns every path object to its scene mode.
    this.pathRunner.clear();
    this.takeStale = true;
    this.world.applyScene(next);
    this.scene = next;
    this.lastBehaviorEdit = undefined;
    this.editorMetadata = nextMetadata;
    this.latest = this.world.snapshot();
    this.document = reconcileBehaviors(
      documentInput ?? this.document,
      this.scene,
      this.latest.poses,
    );
    this.runEpoch = id("epoch");
    this.behavior = this.newBehavior();
    if (this.selected && !this.scene.objects.some((object) => object.id === this.selected))
      this.selected = "";
    await this.solveCurrent();
  }
  private gravityOnlyEdit(
    next: SceneSpec,
    document?: SoundBehaviorDocument,
    metadata?: ProjectEditorMetadata | null,
  ): boolean {
    if (
      this.replayFrame ||
      this.recorder.getView().recording.state === "replaying" ||
      next.sceneRevision !== this.scene.sceneRevision + 1
    )
      return false;
    const previous = new Map(this.scene.objects.map((object) => [object.id, object]));
    const changed = next.objects.filter((object) => object.mode !== previous.get(object.id)?.mode);
    const dynamic = (mode: string | undefined) =>
      mode === "dynamicGravity" || mode === "dynamicNoGravity";
    if (
      !changed.length ||
      changed.some((object) => !dynamic(object.mode) || !dynamic(previous.get(object.id)?.mode))
    )
      return false;
    const normalized = {
      ...next,
      sceneRevision: this.scene.sceneRevision,
      objects: next.objects.map((object) => ({
        ...object,
        mode: previous.get(object.id)?.mode ?? object.mode,
      })),
    };
    const { revision: _oldRevision, ...oldDocument } = this.document;
    const { revision: _newRevision, ...nextDocument } = document ?? this.document;
    return (
      canonicalJson(normalized) === canonicalJson(this.scene) &&
      canonicalJson(oldDocument) === canonicalJson(nextDocument) &&
      canonicalJson(metadata === undefined ? (this.editorMetadata ?? null) : metadata) ===
        canonicalJson(this.editorMetadata ?? null)
    );
  }
  /** Gravity changes are physical controls, not a replacement sound authoring branch. */
  private async commitGravityEdit(
    next: SceneSpec,
    expected: number,
    remember: boolean,
    document?: SoundBehaviorDocument,
  ): Promise<void> {
    await this.stopPreviews();
    this.clearPreviewContacts();
    this.nativeAdmissionDiagnostics.clear();
    const previousWorld = this.world;
    const wasRunning = !this.world.paused;
    const wasRecording = this.recorder.getView().recording.state === "recording";
    if (wasRecording) {
      try {
        await this.recorder.interrupt("GRAVITY_MODE_CHANGED");
        await this.persistRecordings();
      } finally {
        this.releaseTransportAssets("recording");
      }
    }
    this.assertLive();
    if (this.world !== previousWorld || this.scene.sceneRevision !== expected)
      throw new Error("REVISION_CONFLICT");
    const snapshot = this.behavior.snapshot();
    const nextDocument = reconcileBehaviors(document ?? this.document, next, this.latest.poses);
    const nextBehavior = createBehaviorRuntime(
      nextDocument,
      makeBehaviorContext(next, this.latest.poses, this.assets),
      {
        experimentId: this.runId,
        runEpoch: this.runEpoch,
        randomSeed: next.seed,
        maxVoices: 16,
        maxVoicesPerObject: 8,
      },
    );
    nextBehavior.restore({
      ...snapshot,
      state: {
        ...snapshot.state,
        sceneRevision: next.sceneRevision,
        documentRevision: nextDocument.revision,
      },
    });
    if (remember) this.remember();
    this.acoustics.cancel("GRAVITY_MODE_CHANGED_CANCELLED");
    this.world.pause();
    this.pathRunner.clear();
    this.takeStale = true;
    this.world.applyScene(next);
    if (wasRecording) this.world.clock.setMode("interactive");
    this.scene = next;
    this.document = nextDocument;
    this.behavior = nextBehavior;
    this.latest = this.world.snapshot();
    this.lastBehaviorEdit = undefined;
    if (wasRunning) {
      try {
        this.world.resume();
      } catch {
        this.pauseCore("重力模式已套用；恢復前需重新確認抓取／碰撞空間。");
      }
    }
    this.notice = wasRecording
      ? "重力模式已變更，原錄製以中斷狀態封存；持續聲源及游標保留。"
      : "重力模式已變更；持續聲源、動量及播放游標保留。";
    await this.solveCurrent();
  }
  private async commitAgentScene(
    next: SceneSpec,
    expected: number,
    transactionId: string,
    requests: ToolRequest[],
  ): Promise<void> {
    const before: UndoEntry = {
      scene: clone(this.scene),
      behaviors: clone(this.document),
      ...(this.editorMetadata ? { metadata: clone(this.editorMetadata) } : {}),
    };
    let candidate: SoundBehaviorDocument;
    if (transactionId.endsWith(".undo")) {
      const originalId = transactionId.slice(0, -5),
        transaction = this.aiSceneTransactions.get(originalId);
      if (
        !transaction ||
        canonicalJson(this.document) !== canonicalJson(transaction.after) ||
        canonicalJson(this.editorMetadata ?? null) !== canonicalJson(transaction.afterMetadata)
      )
        throw new Error("REVISION_CONFLICT：聲音配置已有後續變更，拒絕覆蓋。");
      candidate = { ...clone(transaction.before.behaviors), revision: this.document.revision + 1 };
      await this.commitScene(next, expected, true, candidate, transaction.before.metadata ?? null);
      this.aiSceneTransactions.delete(originalId);
      return;
    }
    const poses = new Map(this.latest.poses.map((pose) => [pose.objectId, pose.generation]));
    candidate = projectSceneSources(
      this.scene,
      next,
      this.document,
      requests,
      next.objects.map((object) => ({
        objectId: object.id,
        generation: poses.get(object.id) ?? 1,
      })),
      this.assets,
      [{ id: "signal.tone-220", frequencyHz: 220, waveform: "sine" }],
    );
    const metadata = projectEditorMetadata(this.editorMetadata, next, requests);
    await this.commitScene(next, expected, true, candidate, metadata ?? null);
    this.aiSceneTransactions.set(transactionId, {
      before,
      after: clone(this.document),
      afterMetadata: clone(this.editorMetadata ?? null),
    });
    if (this.aiSceneTransactions.size > 48)
      this.aiSceneTransactions.delete(this.aiSceneTransactions.keys().next().value!);
  }
  private async commitBehavior(next: SoundBehaviorDocument, remember = true): Promise<void> {
    const expectedSceneRevision = this.scene.sceneRevision;
    const expectedDocumentRevision = this.document.revision;
    createBehaviorRuntime(
      next,
      makeBehaviorContext(this.scene, this.world.snapshot().poses, this.assets),
      { experimentId: this.runId, runEpoch: id("check") },
    );
    await this.drain();
    this.assertLive();
    if (
      this.scene.sceneRevision !== expectedSceneRevision ||
      this.document.revision !== expectedDocumentRevision
    )
      throw new Error("REVISION_CONFLICT");
    // Drain is asynchronous: recheck the trusted registry and references at the actual swap boundary.
    createBehaviorRuntime(
      next,
      makeBehaviorContext(this.scene, this.world.snapshot().poses, this.assets),
      { experimentId: this.runId, runEpoch: id("check") },
    );
    if (remember) this.remember();
    this.document = clone(next);
    this.lastBehaviorEdit = undefined;
    this.runEpoch = id("epoch");
    this.behavior = this.newBehavior();
  }
  private async restoreHistory(undo: boolean): Promise<void> {
    const from = undo ? this.undoStack : this.redoStack,
      to = undo ? this.redoStack : this.undoStack;
    const target = from.at(-1);
    if (!target) return;
    const current: UndoEntry = {
      scene: clone(this.scene),
      behaviors: clone(this.document),
      ...(this.editorMetadata ? { metadata: clone(this.editorMetadata) } : {}),
    };
    const next = createScene({ ...target.scene, sceneRevision: this.scene.sceneRevision + 1 });
    await this.commitScene(
      next,
      this.scene.sceneRevision,
      false,
      {
        ...clone(target.behaviors),
        revision: this.document.revision + 1,
      },
      target.metadata ?? null,
    );
    from.pop();
    to.push(current);
  }
  advance(deltaSeconds: number, controlledTake = false): void {
    // A skipped, paused, or direct advance cannot inherit an earlier host flush.
    this.recordingHostFlushPending = false;
    this.recordingAdvanceActive = false;
    const hostFrameObserved = this.recordingHostFrameObserved;
    const previousRafAtMs = this.recordingPreviousRafAtMs;
    const currentRafAtMs = this.recordingCurrentRafAtMs;
    const callbackAtMs = this.recordingCallbackAtMs;
    this.recordingHostFrameObserved = false;
    this.recordingPreviousRafAtMs = null;
    this.recordingCurrentRafAtMs = null;
    this.recordingCallbackAtMs = null;
    if (this.disposed || (this.shortTakeActive && !controlledTake)) return;
    const advanceStartedAt = recordingDiagnosticWallTime();
    this.advancing = true;
    try {
      const previousTick = this.latest.tick;
      const previousReplayTick = this.replayFrame?.tick;
      this.clock += deltaSeconds;
      const recordingView = this.recorder.getView();
      try {
        if (
          recordingView.recording.state === "recording" &&
          !recordingView.pending &&
          !this.world.paused &&
          this.world.clock.mode === "recording" &&
          this.recordingAdvanceCaptureRunId !== null &&
          this.recorder.getCaptureRunId() === this.recordingAdvanceCaptureRunId
        ) {
          const input = this.recordingAdvanceInput;
          input.previousRafAtMs = hostFrameObserved ? previousRafAtMs : null;
          input.currentRafAtMs = hostFrameObserved ? currentRafAtMs : null;
          input.callbackAtMs = hostFrameObserved ? callbackAtMs : null;
          input.deltaSeconds = deltaSeconds;
          input.accumulatorBeforeSeconds = this.world.clock.accumulatorSeconds;
          input.accumulatorAfterSeconds = null;
          input.steps = null;
          input.tickBefore = this.world.tick;
          input.tickAfter = null;
          input.overrun = null;
          input.advanceElapsedMs = null;
          // No invocation is an observed zero; a failed invocation clock becomes null.
          input.onTickElapsedMs = 0;
          input.admissionElapsedMs = 0;
          input.publishElapsedMs = 0;
          input.hostFlushElapsedMs = null;
          this.recordingAdvanceActive = true;
        }
      } catch {
        this.recordingAdvanceActive = false;
      }
      if (recordingView.recording.state === "replaying" && !this.replayPaused) {
        this.replayAccumulator += deltaSeconds;
        for (let i = 0; i < 4 && this.replayAccumulator >= 1 / 60; i++) {
          this.replayAccumulator -= 1 / 60;
          const frame = this.recorder.nextReplay();
          if (!frame) {
            void this.finishReplay().catch((error) => {
              if (!this.disposed) this.fail(error);
            });
            break;
          }
          try {
            this.applyReplayFrame(frame);
          } catch (error) {
            this.replayPaused = true;
            this.recorder.pause();
            this.fail(error);
            break;
          }
        }
      } else if (!this.world.paused) {
        try {
          this.interaction.beforeStep();
          const manualStep = controlledTake && this.shortTakeActive;
          if (!manualStep)
            this.audio?.shiftEpoch(this.world.clock.previewDroppedWallTime(deltaSeconds));
          const observePhysics =
            this.liveMonitorMode === "load" && performance.now() - this.liveMonitorReadAtMs < 250;
          const physicsStartedAt = observePhysics ? performance.now() : null;
          let callbackMs = 0;
          const onStep = (snapshot: PhysicsSnapshot) => {
            const callbackStartedAt = observePhysics ? performance.now() : null;
            try {
              this.latest = snapshot;
              const onTickStartedAt = this.recordingAdvanceActive
                ? recordingDiagnosticWallTime()
                : null;
              try {
                this.onTick(snapshot);
              } finally {
                if (this.recordingAdvanceActive)
                  this.addRecordingAdvanceElapsed("onTickElapsedMs", onTickStartedAt);
              }
              this.interaction.beforeStep();
            } finally {
              if (callbackStartedAt !== null) callbackMs += performance.now() - callbackStartedAt;
            }
          };
          const result = manualStep
            ? this.world.advanceControlledStep(onStep)
            : this.world.advance(deltaSeconds, onStep);
          if (physicsStartedAt !== null && result.steps > 0)
            this.liveMonitorPhysicsMs = Math.max(
              0,
              performance.now() - physicsStartedAt - callbackMs,
            );
          this.alpha = result.alpha;
          this.latest = result.snapshot;
          if (this.recordingAdvanceActive) {
            this.recordingAdvanceInput.steps = result.steps;
            this.recordingAdvanceInput.overrun = result.overrun;
            if (result.overrun && this.recordingFirstOverrunContext === null) {
              try {
                const context = this.observeRecordingGuardContext("clockOverrun");
                if (context.captureRunId === this.recordingAdvanceCaptureRunId)
                  this.recordingFirstOverrunContext = context;
              } catch {
                // Retaining diagnostic context cannot interfere with the original guard.
              }
            }
          }
          if (result.overrun && this.world.clock.mode === "recording") {
            this.pauseCore("固定步負載超限，已暫停；未丟棄錄製 tick");
            this.notice =
              "錄製已暫停並保留固定步欠帳；可繼續逐批處理，或明確停止並封存目前連續資料。";
          } else if (result.overrun) {
            this.droppedWallTimeSinceNotice += result.droppedWallTimeSeconds;
            if (this.clock - this.lastOverrunNotice >= 1) {
              this.notice = `互動追趕上限：捨棄 ${this.droppedWallTimeSinceNotice.toFixed(3)} s 牆鐘時間；固定步長保持1/60 s。`;
              this.droppedWallTimeSinceNotice = 0;
              this.lastOverrunNotice = this.clock;
            }
          }
        } catch (error) {
          this.fail(error);
        }
      }
      if (
        !this.replayFrame &&
        this.recorder.getView().recording.state !== "replaying" &&
        this.clock - this.lastSolve >= 0.05 &&
        !this.acoustics.busy
      ) {
        this.lastSolve = this.clock;
        void this.solveCurrent();
      }
      if (
        previousTick !== this.latest.tick ||
        previousReplayTick !== this.replayFrame?.tick ||
        this.clock - this.lastPublish >= 0.1
      ) {
        this.lastPublish = this.clock;
        this.requestPublication();
      }
      this.advancing = false;
      this.syncAudioListener();
    } catch (error) {
      this.fail(error);
    } finally {
      this.advancing = false;
      try {
        if (this.publicationPending) {
          const publishStartedAt = this.recordingAdvanceActive
            ? recordingDiagnosticWallTime()
            : null;
          try {
            this.publish();
          } finally {
            if (this.recordingAdvanceActive)
              this.addRecordingAdvanceElapsed("publishElapsedMs", publishStartedAt);
          }
        }
      } finally {
        // This endpoint includes original finally publication. Host flush is observed later.
        if (this.recordingAdvanceActive) {
          try {
            if (!this.disposed) {
              const input = this.recordingAdvanceInput;
              input.tickAfter = this.world.tick;
              input.accumulatorAfterSeconds = this.world.clock.accumulatorSeconds;
              input.advanceElapsedMs = recordingDiagnosticElapsed(
                advanceStartedAt,
                recordingDiagnosticWallTime(),
              );
              this.recordingAdvanceDiagnostics.record(input);
              this.recordingHostFlushPending = hostFrameObserved;
            }
          } catch {
            // An optional sample must not replace advance/publication errors or engine state.
          } finally {
            this.recordingAdvanceActive = false;
          }
        }
      }
    }
  }

  private addRecordingAdvanceElapsed(
    field: "onTickElapsedMs" | "admissionElapsedMs" | "publishElapsedMs",
    start: number | null,
  ): void {
    try {
      const elapsed = recordingDiagnosticElapsed(start, recordingDiagnosticWallTime());
      const previous = this.recordingAdvanceInput[field];
      this.recordingAdvanceInput[field] =
        typeof previous === "number" && Number.isFinite(previous) && elapsed !== null
          ? previous + elapsed
          : null;
    } catch {
      // Optional timing may be unavailable; the original callback result remains authoritative.
      this.recordingAdvanceInput[field] = null;
    }
  }

  private onTick(snapshot: PhysicsSnapshot): void {
    const recordingView = this.recorder.getView();
    const capturing = recordingView.recording.state === "recording" && !recordingView.pending;
    const preStepSnapshot = capturing ? this.behavior.snapshot() : null;
    const preStepCursorEvidence = preStepSnapshot
      ? this.captureCursorEvidence(preStepSnapshot)
      : { native: {}, nonNative: {} };
    const preStepVoiceCursors = preStepCursorEvidence.native;
    const inputFrame = toBehaviorFrame(snapshot, this.runEpoch);
    const result = this.behavior.step(inputFrame);
    for (const voice of result.voices) {
      const event = voice.event;
      const source = inputFrame.events.find(
        (value) => value.eventId === event.parentPhysicsEventId,
      );
      if (
        voice.action !== "start" ||
        !event.contact ||
        !source?.accepted ||
        source.source !== "physics" ||
        !source.contact
      )
        continue;
      if (
        !this.previewContactDocument ||
        this.previewContactDocument.revision !== this.document.revision ||
        this.previewContactEpoch !== this.runEpoch
      ) {
        this.clearPreviewContacts();
        this.previewContactDocument = clone(this.document);
        this.previewContactEpoch = this.runEpoch;
      }
      this.previewContacts.set(event.eventId, {
        runId: this.runId,
        runEpoch: this.runEpoch,
        sceneRevision: this.scene.sceneRevision,
        behaviorDocument: this.previewContactDocument,
        inputEvent: clone(source),
        voice: clone(voice),
      });
      if (this.previewContacts.size > 64)
        this.previewContacts.delete(this.previewContacts.keys().next().value!);
    }
    const runtimeSnapshot = capturing ? this.behavior.snapshot() : null;
    const cursorEvidence = runtimeSnapshot
      ? this.captureCursorEvidence(runtimeSnapshot)
      : { native: {}, nonNative: {} };
    const voiceCursors = cursorEvidence.native;
    for (const event of snapshot.events)
      this.eventLog.push({
        id: event.eventId,
        tick: event.tick,
        timeSeconds: event.simulationTimeSeconds,
        type: event.type,
        objectId: event.objectId,
        positionM: event.positionMetres,
        detail:
          (event.zoneId ? "Zone " + event.zoneId + " · " : "") +
          (event.reason ?? "Rapier／已接受互動事件"),
      });
    const diagnosticViews = projectBehaviorDecisions({
      runEpoch: this.runEpoch,
      fixedDtSeconds: snapshot.fixedDtSeconds,
      document: this.document,
      inputFrame,
      decisions: result.decisions,
      audioEvents: result.events,
    });
    this.behaviorDiagnostics.append(diagnosticViews);
    // High-frequency updates refresh the rule status without evicting discrete event evidence.
    this.eventLog.push(...diagnosticViews.filter((view) => view.decision?.action !== "update"));
    for (const voice of result.voices) {
      const key = voice.event.instanceId;
      if (voice.action === "stop") {
        this.activeVoices.delete(key);
        this.pendingAudio.delete(key);
        this.audio?.stopVoice(key);
        this.solutions.delete(key);
        continue;
      }
      this.activeVoices.set(key, voice);
      if (voice.action === "start") {
        if (this.audio)
          this.pendingAudio.set(key, {
            input: this.voiceInput(voice),
            intent: clone(voice),
            behaviorDocumentRevision: this.document.revision,
          });
      } else
        this.audio?.updateVoice(key, {
          gainLinear: voice.event.gainLinear,
          pitchSemitones: voice.event.pitchSemitones,
          smoothingSeconds: voice.smoothingSeconds,
        });
    }
    this.admitPendingAudio(true);
    this.eventLog = this.eventLog.slice(-512);
    // During capture, record actual propagation at each recorded event tick.
    // Stop commands retain a diagnostic route without claiming another emission.
    if (capturing) {
      const events = new Map(
        [...this.activeVoices.values()].map((voice) => [voice.event.instanceId, voice.event]),
      );
      for (const event of result.events) events.set(event.instanceId, event);
      const sources = [...events.values()];
      const requests: AcousticRequest[] = [];
      for (let start = 0; start < sources.length; start += 16) {
        requests.push(...this.requests(snapshot.poses, sources.slice(start, start + 16)));
      }
      const admissionStartedAt = this.recordingAdvanceActive ? recordingDiagnosticWallTime() : null;
      try {
        this.recorder.appendEvaluationFrame(
          {
            tick: snapshot.tick,
            sceneRevision: this.scene.sceneRevision,
            runEpoch: this.runEpoch,
            poses: snapshot.poses.map((pose) => ({
              objectId: pose.objectId,
              positionM: pose.positionMetres,
              orientationQuaternion: pose.rotation,
              linearVelocityMps: pose.linearVelocityMetresPerSecond,
              angularVelocityRadps: pose.angularVelocityRadiansPerSecond,
            })),
            listener: this.listener(),
            physicsEvents: snapshot.events,
            behaviorDecisions: result.decisions,
            audioEvents: result.events,
            behaviorSnapshot: {
              inputFrame,
              preStepSnapshot,
              runtimeSnapshot,
              voiceIntents: result.voices,
              preStepVoiceCursors,
              voiceCursors,
              preStepNonNativeVoiceCursors: preStepCursorEvidence.nonNative,
              nonNativeVoiceCursors: cursorEvidence.nonNative,
              cursorEvidencePolicy: "nativeCompleteOnly; virtualAndIncompleteAuditsSeparate",
              cursorModel: "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer",
            },
          },
          requests,
        );
      } finally {
        if (this.recordingAdvanceActive)
          this.addRecordingAdvanceElapsed("admissionElapsedMs", admissionStartedAt);
      }
    }
  }
  private voiceInput(voice: VoiceIntent): VoiceInput {
    const profile = this.document.profiles.find(
      (value) => value.profileId === voice.event.profileId,
    );
    const rule = profile?.rules.find((value) => value.ruleId === voice.event.ruleId);
    return {
      instanceId: voice.event.instanceId,
      sourceId: voice.event.instanceId,
      generator: clone(voice.generator),
      gainLinear: voice.event.gainLinear,
      pitchSemitones: voice.event.pitchSemitones,
      emissionTimeSeconds: voice.event.simulationTimeSeconds,
      continuous: voice.event.trigger.kind === "continuous" || Boolean(rule?.lifecycle),
      fadeInSeconds: voice.fadeInSeconds,
      fadeOutSeconds: voice.fadeOutSeconds,
      priority: rule?.priority ?? 0,
      ...(rule?.oneShotDurationSeconds !== undefined
        ? { durationSeconds: rule.oneShotDurationSeconds }
        : {}),
      ...(voice.filterCutoffHz !== undefined ? { filterCutoffHz: voice.filterCutoffHz } : {}),
    };
  }
  private requests(
    poses = this.latest.poses,
    sourceEvents = [...this.activeVoices.values()].map((voice) => voice.event),
    scene = this.scene,
    listener = this.listener(),
  ): AcousticRequest[] {
    const poseMap = new Map(poses.map((pose) => [pose.objectId, pose]));
    const emitters = sourceEvents.length
      ? sourceEvents.map((event) => behaviorAcousticSource(this.document, event))
      : scene.sources
          .filter((source) => source.playing)
          .map((source) => ({
            id: `preview.${source.id}`,
            objectId: source.objectId,
            positionM:
              poseMap.get(source.objectId)?.positionMetres ??
              scene.objects.find((object) => object.id === source.objectId)!.positionM,
          }));
    return buildAcousticRequests({
      scene,
      poses,
      sources: emitters,
      listener,
      tick: this.latest.tick,
      materials: DEFAULT_MATERIALS,
      atmosphere: this.atmosphere,
      budget: { maxPaths: 8, maxSurfaces: 256, maxSegmentTests: 10000 },
    });
  }
  private async solveCurrent(): Promise<void> {
    if (
      this.disposed ||
      this.acoustics.busy ||
      this.replayStarting ||
      this.replayClosing ||
      this.replayFrame ||
      this.recorder?.getView().recording.state === "replaying"
    )
      return;
    const epoch = this.runEpoch,
      revision = this.scene.sceneRevision,
      replayGeneration = this.replayGeneration;
    const sourceEvents = new Map(
      [...this.activeVoices.values()].map((voice) => [voice.event.instanceId, voice.event]),
    );
    try {
      this.syncAudioListener();
      const requests = this.requests();
      const origins = new Map(
        requests.map((request) => [request.source.id, request.source.positionM]),
      );
      const results = await this.acoustics.solve(requests);
      if (
        this.disposed ||
        replayGeneration !== this.replayGeneration ||
        this.replayStarting ||
        this.replayClosing ||
        this.replayFrame ||
        this.recorder.getView().recording.state === "replaying"
      )
        return;
      if (epoch !== this.runEpoch || revision !== this.scene.sceneRevision) {
        this.audio?.recordAcousticDelivery({
          decision: epoch !== this.runEpoch ? "epoch-rejected" : "revision-rejected",
          frameCount: results.length,
        });
        return;
      }
      this.audio?.recordAcousticDelivery({
        decision: "accepted",
        frameCount: results.length,
        ageTicks: results.length
          ? Math.max(...results.map((result) => this.latest.tick - result.frame.poseTick))
          : 0,
      });
      // Current topology/epoch remains valid even when delivery missed the pose window.
      // Keep the newest frame PER SOURCE; audio never waits for an entirely fresh batch.
      for (const solution of results) {
        const previous = this.solutions.get(solution.frame.sourceId);
        if (previous && previous.frame.poseTick > solution.frame.poseTick) continue;
        this.solutions.set(solution.frame.sourceId, solution);
        const event = sourceEvents.get(solution.frame.sourceId);
        const preview = this.scene.sources.find(
          (source) => `preview.${source.id}` === solution.frame.sourceId,
        );
        const cacheKey = event
          ? `${event.objectId}/${event.bindingId}/${event.ruleId}`
          : preview
            ? `preview/${preview.objectId}`
            : null;
        if (cacheKey && solution.frame.pathAvailability === "available" && !solution.frame.stale) {
          this.cachedEmitterFrames.delete(cacheKey);
          this.cachedEmitterFrames.set(cacheKey, solution.frame);
          this.cachedEmitterPositions.set(cacheKey, [...origins.get(solution.frame.sourceId)!]);
          if (this.cachedEmitterFrames.size > 64) {
            const oldest = this.cachedEmitterFrames.keys().next().value!;
            this.cachedEmitterFrames.delete(oldest);
            this.cachedEmitterPositions.delete(oldest);
          }
        }
        this.audio?.updateFrame(solution.frame);
      }
      // Retain only current playing previews, pending admissions and active voices.
      const previews = new Set(
        this.scene.sources
          .filter((source) => source.playing)
          .map((source) => `preview.${source.id}`),
      );
      for (const key of this.solutions.keys())
        if (
          !this.activeVoices.has(key) &&
          !this.pendingAudio.has(key) &&
          (this.activeVoices.size > 0 || !previews.has(key))
        )
          this.solutions.delete(key);
      this.admitPendingAudio(false);
      this.publicationPending = true;
    } catch (error) {
      if (
        !this.disposed &&
        epoch === this.runEpoch &&
        revision === this.scene.sceneRevision &&
        !(error instanceof Error && /CANCELLED|DISPOSED/.test(error.message))
      )
        this.fail(error, false);
    }
  }
  private admitPendingAudio(cached: boolean): void {
    if (this.audioRestarting || this.world.paused || !this.audio || this.audio.isPaused) return;
    for (const [key, pending] of this.pendingAudio) {
      const { input, intent } = pending;
      const solution = this.solutions.get(input.sourceId);
      const frame = solution?.frame ?? this.cachedVoiceFrame(pending);
      if (!frame || frame.sceneRevision !== this.scene.sceneRevision || frame.stale) continue;
      const admission = this.audio.playVoice(
        input,
        frame,
        cached || !solution || this.latest.tick - frame.poseTick > 3,
      );
      if (admission?.accepted) this.pendingAudio.delete(key);
      else if (admission) {
        this.nativeAdmissionDiagnostics.append({
          intent,
          voiceInput: input,
          admission,
          frame,
          behaviorDocumentRevision: pending.behaviorDocumentRevision,
          attemptedAtTick: this.latest.tick,
        });
        if (
          admission.reason !== "ACOUSTIC_FRAME_UNAVAILABLE" &&
          admission.reason !== "SIMULATION_PAUSED"
        ) {
          this.notice = `音訊 admission：${admission.reason}`;
          this.pendingAudio.delete(key);
        }
      }
    }
  }
  private cachedVoiceFrame(pending: PendingNativeVoice): AcousticFrame | undefined {
    const event = pending.intent.event;
    const identity = `${event.objectId}/${event.bindingId}/${event.ruleId}`;
    const key = this.cachedEmitterFrames.has(identity) ? identity : `preview/${event.objectId}`;
    const frame = this.cachedEmitterFrames.get(key);
    if (key.startsWith("preview/") && !pending.input.continuous) return;
    if (!frame || frame.sceneRevision !== this.scene.sceneRevision) return;
    const origin = this.cachedEmitterPositions.get(key) ?? frame.paths[0]?.verticesM[0];
    const age = this.latest.tick - frame.poseTick;
    if (
      !origin ||
      age < 0 ||
      age > 3 ||
      Math.hypot(...origin.map((value, i) => value - event.positionMetres[i]!)) > 0.1
    )
      return;
    // Rebind only identity on genuine solver paths. Geometry/delay/gains stay the
    // cached approximation, explicitly counted stale; the next solve replaces them.
    const prefix = `${frame.backendVersion}|${this.scene.sceneId}|${frame.sourceId}|`;
    if (frame.paths.some((path) => !path.id.startsWith(prefix))) return;
    const sourceId = pending.input.sourceId;
    return {
      ...frame,
      sourceId,
      paths: frame.paths.map((path) => ({
        ...path,
        sourceId,
        id: `${frame.backendVersion}|${this.scene.sceneId}|${sourceId}|${path.id.slice(prefix.length)}`,
      })),
    };
  }
  /** The world and audio stay paused until both storage creation and worker ACK are ready. */
  private async prepareRecordingCapture(): Promise<boolean> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(
      () => controller.abort("RECORDING_PREPARATION_TIMEOUT"),
      10000,
    );
    const promise = (async () => {
      await this.recorder.prepareStart(controller.signal);
      await this.recordingEvaluation.prepare(controller.signal);
    })();
    const preparation = { controller, promise };
    this.recordingPreparation = preparation;
    let completed = false;
    try {
      this.notice = RECORDING_PREPARATION_NOTICE;
      this.requestPublication();
      await promise;
      if (controller.signal.aborted) {
        if (controller.signal.reason === "RECORDING_PREPARATION_TIMEOUT")
          throw new Error("錄製準備逾時；請重試。");
        return false;
      }
      this.assertLive();
      const persistence = this.recorder.getPersistenceQueueTelemetry();
      if (persistence?.state === "interrupted")
        throw new Error(persistence.error ?? "錄製儲存已失敗；請先中斷目前錄製。");
      completed = true;
      return true;
    } catch (error) {
      if (controller.signal.aborted) {
        if (controller.signal.reason === "RECORDING_PREPARATION_TIMEOUT")
          throw new Error("錄製準備逾時；請重試。");
        return false;
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timer);
      if (!completed) this.recorder.abortPreparedStart("PREPARATION_CANCELLED_OR_FAILED");
      if (this.recordingPreparation === preparation) this.recordingPreparation = null;
      if (this.notice === RECORDING_PREPARATION_NOTICE) this.notice = "";
      if (this.pauseReason === RECORDING_PREPARATION_NOTICE) this.pauseReason = "";
      if (!this.disposed) this.requestPublication();
    }
  }
  private cancelRecordingPreparation(reason: string): Promise<void> | null {
    const preparation = this.recordingPreparation;
    if (!preparation) return null;
    preparation.controller.abort(reason);
    return preparation.promise;
  }

  /** Host observations describe a RAF boundary; they do not admit or modify wall time. */
  observeRecordingFrame(
    previousRafAtMs: number | null,
    currentRafAtMs: number | null,
    callbackAtMs: number | null,
  ): void {
    if (this.disposed) return;
    this.recordingHostFrameObserved = true;
    this.recordingPreviousRafAtMs = recordingDiagnosticNumber(previousRafAtMs);
    this.recordingCurrentRafAtMs = recordingDiagnosticNumber(currentRafAtMs);
    this.recordingCallbackAtMs = recordingDiagnosticNumber(callbackAtMs);
  }

  /** Consume at most one host flush for the row produced by this actual advance. */
  observeRecordingHostFlush(elapsedMs: unknown): void {
    if (this.disposed || !this.recordingHostFlushPending) return;
    this.recordingHostFlushPending = false;
    try {
      this.recordingAdvanceDiagnostics.markHostFlush(elapsedMs);
    } catch {
      // Optional observations cannot change product scheduling or error handling.
    }
  }

  getRecordingCommitDiagnostics(): Readonly<
    import("../experiments/recording-commit-diagnostics.js").RecordingCommitDiagnosticsSnapshot
  > | null {
    if (this.disposed || this.recordingAdvanceCaptureRunId === null) return null;
    try {
      const diagnostics = this.recorder.getCommitDiagnostics();
      if (
        !diagnostics ||
        diagnostics.captureRunId !== this.recordingAdvanceCaptureRunId ||
        diagnostics.runEpoch !== this.recordingAdvanceRunEpoch ||
        diagnostics.sceneRevision !== this.recordingAdvanceSceneRevision ||
        diagnostics.runEpoch !== this.runEpoch ||
        diagnostics.sceneRevision !== this.scene.sceneRevision
      )
        return null;
      return diagnostics;
    } catch {
      return null;
    }
  }

  getRecordingAdvanceDiagnostics(): Readonly<RuntimeRecordingAdvanceDiagnostics> | null {
    if (this.disposed || this.recordingAdvanceCaptureRunId === null) return null;
    try {
      const queueGuard = this.recordingBackpressureDiagnostics;
      return Object.freeze({
        ...this.recordingAdvanceDiagnostics.snapshot(),
        captureRunId: this.recordingAdvanceCaptureRunId,
        runEpoch: this.recordingAdvanceRunEpoch,
        sceneRevision: this.recordingAdvanceSceneRevision,
        firstOverrunContext: this.recordingFirstOverrunContext
          ? copyRecordingGuardContext(this.recordingFirstOverrunContext)
          : null,
        queueGuard:
          queueGuard?.captureRunId === this.recordingAdvanceCaptureRunId
            ? copyRecordingGuardContext(queueGuard)
            : null,
      });
    } catch {
      return null;
    }
  }

  private beginRecordingAdvanceCapture(): void {
    try {
      // A successful host resume owns the new capture. Preparation alone is not capture start.
      this.recordingAdvanceCaptureRunId = this.recorder.getCaptureRunId();
      this.recordingAdvanceRunEpoch = this.runEpoch;
      this.recordingAdvanceSceneRevision = this.scene.sceneRevision;
      this.recordingFirstOverrunContext = null;
      this.recordingAdvanceActive = false;
      this.recordingHostFlushPending = false;
      this.recordingHostFrameObserved = false;
      this.recordingPreviousRafAtMs = null;
      this.recordingCurrentRafAtMs = null;
      this.recordingCallbackAtMs = null;
      this.recordingAdvanceDiagnostics.startCapture(this.world.tick, recordingDiagnosticWallTime());
    } catch {
      // Diagnostics cannot fail a successfully prepared recording transaction.
      this.recordingAdvanceCaptureRunId = null;
    }
  }

  private markRecordingAdvanceResumed(): void {
    try {
      if (
        !this.disposed &&
        !this.world.paused &&
        this.world.clock.mode === "recording" &&
        this.recordingAdvanceCaptureRunId !== null &&
        this.recorder.getCaptureRunId() === this.recordingAdvanceCaptureRunId
      )
        this.recordingAdvanceDiagnostics.markResumed(recordingDiagnosticWallTime());
    } catch {
      // A clock observation cannot prevent the original resume.
    }
  }

  /** Read the retained first guard by value; it never starts or resumes a recording. */
  getRecordingBackpressureDiagnostics(): RecordingBackpressureDiagnostics | null {
    return this.disposed ? null : this.recordingBackpressureDiagnostics;
  }

  private captureRecordingBackpressureDiagnostics(origin: RecordingBackpressureOrigin): void {
    if (this.recordingBackpressureDiagnostics) return;
    this.recordingBackpressureDiagnostics = this.observeRecordingGuardContext(origin);
  }

  private observeRecordingGuardContext<Origin extends RecordingGuardOrigin>(
    origin: Origin,
  ): Readonly<RecordingGuardContext<Origin>> {
    const diagnostic: {
      -readonly [Key in keyof RecordingGuardContext<Origin>]: RecordingGuardContext<Origin>[Key];
    } = {
      schemaVersion: 1,
      origin,
      captureRunId: null,
      runEpoch: this.runEpoch,
      sceneRevision: this.scene.sceneRevision,
      worldTick: this.world.tick,
      simulationTimeSeconds: this.latest.simulationTimeSeconds,
      recordingDurationSeconds: null,
      observedAtWallMs: null,
      evaluation: null,
      persistence: null,
      evaluationReadiness: null,
      persistenceReadiness: null,
      diagnosticError: null,
    };
    try {
      diagnostic.observedAtWallMs = recordingDiagnosticWallTime();
      diagnostic.captureRunId = this.recorder.getCaptureRunId();
      diagnostic.recordingDurationSeconds = this.recorder.getView().recording.durationSeconds;
      const evaluation = this.recorder.getEvaluationTelemetry();
      const persistence = this.recorder.getPersistenceQueueTelemetry();
      diagnostic.evaluation = evaluation
        ? Object.freeze({ ...evaluation, lastError: evaluation.lastError?.slice(0, 512) ?? null })
        : null;
      diagnostic.persistence = persistence
        ? Object.freeze({ ...persistence, error: persistence.error?.slice(0, 512) ?? null })
        : null;
      diagnostic.evaluationReadiness = Object.freeze({
        ...this.recordingEvaluation.getReadinessDiagnostics(),
      });
      const readiness = this.recorder.getPersistenceReadinessTelemetry();
      diagnostic.persistenceReadiness = readiness
        ? Object.freeze({ ...readiness, createError: readiness.createError?.slice(0, 512) ?? null })
        : null;
    } catch {
      // A failed optional observation must never prevent the existing complete-tick pause guard.
      diagnostic.diagnosticError = "RECORDING_DIAGNOSTIC_UNAVAILABLE";
    }
    return Object.freeze(diagnostic);
  }

  private recordingConfig(): ExperimentRecorderOptions {
    return {
      runId: id("recording"),
      runEpoch: this.runEpoch,
      sceneSnapshot: clone(this.scene),
      sourceConfig: clone(this.scene.sources),
      behaviorConfig: clone(this.document),
      solverConfig: {
        backendId: "custom-web-geometric",
        maxReflectionOrder: 1,
        maxPaths: 8,
        ...emitterGeometryPolicyPin(),
      },
      atmosphere: clone(this.atmosphere),
      materialRegistry: clone(DEFAULT_MATERIALS),
      assetManifest: this.projectAssets.map((projectAsset) => {
        const decoded = this.assets.find(
          (asset) =>
            asset.assetId === projectAsset.assetId &&
            asset.revision === projectAsset.revision &&
            asset.sha256 === projectAsset.sha256,
        );
        return { ...clone(projectAsset), ...(decoded ? clone(decoded) : {}) };
      }),
      generatorConfig: {
        audioContentModel: NATIVE_REFERENCE_CONTENT_MODEL,
        generators: this.document.profiles.map((profile) =>
          profile.rules.map((rule) => rule.generator),
        ),
      },
      physicsConfig: {
        fixedDtS: 1 / 60,
        gravityMps2: this.scene.gravityMps2,
        motionRegistry: this.motion?.getSnapshot() ?? null,
      },
      physicsVersion: "rapier-0.21.0",
      backendId: "custom-web-geometric",
      backendVersion: acousticSceneSolverVersion(this.scene),
      fixedDtS: 1 / 60,
      sampleRateHz: 48000,
    };
  }
  private async reprocessFrame(
    frame: RecordingFrame,
    changes: ReprocessConfiguration,
    baseline: RecordingConfiguration,
  ): Promise<ReprocessedFrame> {
    return this.recordingEvaluation.reprocess(frame, changes, baseline);
  }
  private applyReplayFrame(frame: RecordingFrame, emitEvents = true): void {
    this.replayFrame = frame;
    this.replayPoses = new Map(
      frame.poses.map((pose) => [
        pose.objectId,
        { positionM: [...pose.positionM], orientationQuaternion: [...pose.orientationQuaternion] },
      ]),
    );
    this.solutions.clear();
    this.cachedEmitterFrames.clear();
    this.cachedEmitterPositions.clear();
    if (frame.acousticFrames.length) this.recordedAcousticFrames = clone([...frame.acousticFrames]);
    else
      this.recordedAcousticFrames = this.recordedAcousticFrames.map((value) => ({
        ...value,
        stale: true,
      }));
    this.syncAudioListener();
    if (emitEvents) this.replayAudio.applyFrame(frame);
  }
  private currentProject(): ProjectDocument {
    const artifacts = [
      this.recorder.getArtifact(),
      ...Object.values(this.recorder.getSlots()),
      ...this.storedArtifacts.values(),
    ].filter(
      (artifact): artifact is NonNullable<typeof artifact> =>
        artifact !== null && artifact.frameCount > 0 && artifact.status !== "cancelled",
    );
    const references = new Map(
      this.project.recordings.map((reference) => [reference.runId, reference]),
    );
    for (const artifact of artifacts)
      references.set(artifact.runId, {
        runId: artifact.runId,
        sha256: artifact.artifactSha256,
        status: artifact.status === "captured" ? "captured" : "interrupted",
        frameCount: artifact.frameCount,
        durationSeconds:
          (artifact.endTick! - artifact.startTick!) * artifact.configuration.fixedDtS,
        storage: "externalArtifact",
      });
    const activeRunId = this.recorder.getArtifact()?.runId ?? this.project.activeRecordingId;
    const {
      editorMetadata: _storedMetadata,
      activeRecordingId: _storedSelection,
      ...projectBase
    } = this.project;
    return createProject({
      ...projectBase,
      revision: this.project.revision + 1,
      updatedAt: new Date().toISOString(),
      scene: clone(this.scene),
      // Project files describe a new world, never the live WASM body's ephemeral generation.
      // The trusted live document retains its actual generations; a loaded world starts at 1.
      soundBehaviors: {
        ...clone(this.document),
        bindings: this.document.bindings.map((binding) => ({
          ...clone(binding),
          objectGeneration: 1,
        })),
      },
      assets: clone(this.projectAssets),
      atmosphere: clone(this.atmosphere),
      recordings: [...references.values()],
      ...(activeRunId && references.has(activeRunId) ? { activeRecordingId: activeRunId } : {}),
      ...(this.editorMetadata ? { editorMetadata: clone(this.editorMetadata) } : {}),
    });
  }
  exportProject(): string {
    return serializeProject(this.currentProject());
  }
  async importProject(text: string): Promise<void> {
    const next = deserializeProject(text);
    const nextAtmosphere = next.atmosphere
      ? { ...clone(next.atmosphere), temperatureC: next.atmosphere.temperatureC ?? 20 }
      : defaultAtmosphere();
    let bank: PreparedAssetBank | null = null;
    let candidateWorld: PhysicsWorld | null = null;
    const restored = new Map<string, RecordingArtifact>();
    try {
      bank = await this.assetHost.prepareProject(next);
      candidateWorld = await PhysicsWorld.create(next.scene);
      this.pathGeometry.set(next.scene, measurePaths(next.scene, candidateWorld));
      createBehaviorRuntime(
        next.soundBehaviors,
        makeBehaviorContext(next.scene, candidateWorld.snapshot().poses, [...bank.assets]),
        { experimentId: id("validate"), runEpoch: id("epoch") },
      );
      for (const ref of next.recordings) {
        const artifact = await this.blobStore.loadRecording(ref.runId, ref.sha256);
        if (artifact) {
          if (
            artifact.frameCount !== ref.frameCount ||
            artifact.status !== ref.status ||
            artifact.endTick === null ||
            artifact.startTick === null ||
            Math.abs(
              (artifact.endTick - artifact.startTick) * artifact.configuration.fixedDtS -
                ref.durationSeconds,
            ) > 1e-9
          )
            throw new Error(`RECORDING_REFERENCE_MISMATCH：${ref.runId}`);
          restored.set(ref.runId, artifact);
        }
      }
      await this.drain();
      this.assertLive();
      await this.assetHost.commitPrepared(bank);
    } catch (error) {
      candidateWorld?.dispose();
      if (bank) this.assetHost.discardPrepared(bank);
      if (error instanceof Error && "code" in error && String(error.code).startsWith("ASSET_"))
        this.pendingProject = next;
      throw error;
    }
    this.remember();
    this.interaction.dispose();
    this.world.dispose();
    this.world = candidateWorld;
    this.takeStale = false;
    this.scene = next.scene;
    this.document = next.soundBehaviors;
    this.project = next;
    this.atmosphere = nextAtmosphere;
    this.renderRecording = null;
    this.lastBehaviorEdit = undefined;
    this.editorMetadata = next.editorMetadata ? clone(next.editorMetadata) : undefined;
    this.syncAssets();
    this.pendingProject = null;
    this.storedArtifacts = restored;
    this.latest = this.world.snapshot();
    this.runEpoch = id("epoch");
    this.behavior = this.newBehavior();
    this.initializeHosts();
    // Legacy files have no selection field: preserve the documented last-captured fallback.
    // A missing explicit selection never silently selects a different recording.
    const lastArtifact = next.activeRecordingId
      ? restored.get(next.activeRecordingId)
      : [...restored.values()].filter((artifact) => artifact.status === "captured").at(-1);
    if (lastArtifact) await this.recorder.restoreArtifact(lastArtifact);
    this.selected = this.scene.objects[0]?.id ?? "";
    this.notice =
      restored.size < next.recordings.length
        ? "專案已載入；部分錄製原始資料不在此瀏覽器，保留hash參照，未宣稱可重播。"
        : `專案已載入；已驗證 ${restored.size} 份錄製與本機可用音檔。`;
    await this.solveCurrent();
    this.requestPublication();
  }
  async dispatch(action: LabAction): Promise<void> {
    if (this.disposed) return;
    let ownsTransaction = false;
    let replayIntent: number | undefined;
    let recordingStartCompletion: Promise<void> | null = null;
    let completeRecordingStart: (() => void) | undefined;
    let paintTicket = 0;
    let paintStroke: { objectId: string; pointsM: Vec3[] } | null = null;
    try {
      switch (action.type) {
        case "exportRecording": {
          // The Host publishes only sealed, verified immutable artifacts. Export
          // reads one snapshot; it neither waits for nor unlocks a mutation/seal.
          const artifact = this.recorder.getArtifact();
          if (!artifact || artifact.frameCount < 1 || artifact.status === "cancelled")
            throw new Error("NO_RECORDING：請先完成一次錄製");
          this.error = "";
          this.download(JSON.stringify(artifact), `${artifact.runId}.recording.json`);
          return;
        }
        case "clearError":
          this.error = "";
          this.requestPublication();
          return;
        case "pause":
          this.error = "";
          this.replayPaused = true;
          this.userInput(() => {
            if (!this.replayFrame && this.recorder.getView().recording.state !== "replaying")
              this.interaction.pausePreservingInputMode("使用者暫停");
            this.pauseCore();
          });
          this.requestPublication();
          return;
        case "stopReplay":
          await this.finishReplay();
          return;
        case "reset": {
          const shortTakeCompletion = this.shortTakeCompletion;
          const recordingStartCompletion = this.recordingStartCompletion;
          const preparation = this.cancelRecordingPreparation("RESET");
          if (preparation) {
            await preparation.catch(() => {});
            if (shortTakeCompletion) await shortTakeCompletion;
            if (recordingStartCompletion) await recordingStartCompletion;
          }
          if (
            this.replayStarting ||
            this.replayOperation ||
            this.replayFrame ||
            this.recorder.getView().recording.state === "replaying"
          )
            await this.finishReplay();
          break;
        }
        case "cancelAI":
          this.experimentTools.cancel();
          this.agent.cancel();
          return;
        case "cancelPlacement":
          this.interaction.abortPlacement();
          this.requestPublication();
          return;
        case "setAlternativeInput":
          this.userInput(() => this.interaction.setAlternativeInput(action.enabled));
          this.requestPublication();
          return;
        case "inputKey":
          this.userInput(() => this.interaction.handleKey(action.code, action.pressed));
          return;
        case "inputLook":
          this.interaction.handleLook(action.movementX, action.movementY);
          return;
        case "inputPointer":
          this.interaction.handlePointer(action.button, action.pressed);
          return;
        case "inputWheel":
          this.interaction.handleWheel(action.deltaY);
          return;
        case "paintStart":
          paintTicket = ++this.paintGeneration;
          break;
        case "paintEnd": {
          // The release always ends the stroke at once, before any wait for the transaction.
          const objectId = this.interaction.snapshot().paint?.objectId;
          if (!objectId) {
            // Released before the snap-back finished: that start must not begin a stroke.
            this.paintGeneration++;
            return;
          }
          paintStroke = { objectId, pointsM: this.interaction.endPaint() };
          break;
        }
        case "pointerLockChanged":
          this.userInput(() => this.interaction.confirmPointerLock(action.locked));
          this.requestPublication();
          return;
        case "inputBlur":
          this.fpsEntryGeneration++;
          void this.stopPreviews();
          this.userInput(() => this.interaction.suspend("失去焦點／輸入所有權"));
          this.requestPublication();
          return;
        case "exitFPS":
          this.fpsEntryGeneration++;
          this.userInput(() => this.interaction.exitFPS());
          this.notice = "已還原原本的 ScenePinned Listener；觀察相機不改變量測位置。";
          this.requestPublication();
          return;
        case "stopPreview":
          await this.stopPreviews();
          this.requestPublication();
          return;
      }
      if (this.replayClosing) await this.replayClosing;
      if (this.disposed) return;
      if (
        action.type === "setAudioBufferPreset" &&
        (this.busy ||
          this.pendingProject ||
          this.recorder.getView().recording.state === "recording" ||
          this.recorder.getView().recording.state === "replaying" ||
          this.replayFrame ||
          this.interaction.snapshot().pending ||
          this.interaction.snapshot().staged)
      )
        throw new Error("AUDIO_BUFFER_UNSAFE");
      if (this.busy) throw new Error("TRANSACTION_BUSY：請等待目前操作完成");
      this.busy = true;
      ownsTransaction = true;
      const fpsEntryGeneration = this.fpsEntryGeneration;
      const pauseGeneration = this.pauseGeneration;
      const userPauseGeneration = this.userPauseGeneration;
      replayIntent = this.replayCancellation;
      if (action.type === "replay" || action.type === "seek") this.replayStarting = true;
      const cancelsPlacementForRecording =
        action.type === "recordToggle" &&
        this.recorder.getView().recording.state !== "recording" &&
        this.interaction.snapshot().pending;
      // Record owns this transport boundary. Cancel before preview shutdown awaits,
      // so the FPS Resume guard sees settled cancellation and late preparation
      // cannot commit the old placement into the new recording.
      if (cancelsPlacementForRecording) this.interaction.abortPlacement();
      this.error = "";
      if (
        action.type === "run" ||
        (action.type === "recordToggle" && this.recorder.getView().recording.state !== "recording")
      )
        this.pauseReason = "";
      if (
        [
          "run",
          "recordToggle",
          "replay",
          "stopReplay",
          "seek",
          "selectObject",
          "selectEvent",
          "enterFPS",
          "setReverb",
        ].includes(action.type)
      ) {
        const prelude = this.stopPreviews();
        if (action.type === "replay" || action.type === "seek") this.replayPrelude = prelude;
        try {
          await prelude;
        } finally {
          if (this.replayPrelude === prelude) this.replayPrelude = null;
        }
      }
      if (
        (action.type === "run" || action.type === "recordToggle") &&
        pauseGeneration !== this.pauseGeneration
      )
        return;
      if (
        (action.type === "replay" || action.type === "seek") &&
        replayIntent !== this.replayCancellation
      )
        return;
      // Exit or focus loss while previews stop cancels a pending entry or Resume;
      // a stale Resume must never start time after the user has left control.
      if (
        (action.type === "enterFPS" || action.type === "run") &&
        fpsEntryGeneration !== this.fpsEntryGeneration
      )
        return;
      switch (action.type) {
        case "workspace":
          this.workspace = action.workspace;
          if (this.interaction.snapshot().mode !== "editor")
            this.interaction.suspend("工作區切換：FPS互動安全暫停");
          break;
        case "selectObject":
          this.selected = action.objectId ?? "";
          break;
        case "selectPath":
          this.selectedPath = action.pathId;
          break;
        case "selectEvent":
          this.selectedEvent = action.eventId;
          break;
        case "run":
          // Clear the reason as time resumes, before any await: a pause that lands
          // while audio resumes must keep its own reason.
          if (this.replayFrame || this.recorder.getView().recording.state === "replaying") {
            const generation = this.replayGeneration;
            await this.replayTask(() => this.replayAudio.resume());
            if (pauseGeneration !== this.pauseGeneration || generation !== this.replayGeneration)
              break;
            this.recorder.resume();
            this.replayPaused = false;
            this.pauseReason = "";
            break;
          }
          this.recorder.assertEvaluationReady();
          this.replayPoses.clear();
          let runGeneration = pauseGeneration;
          // A scene edit since the last reset ended the take and left an edited world: with
          // runnable paths, Play starts a fresh take from the starting layout so it repeats exactly.
          if (this.world.paused && this.takeStale && this.pathStatus().runnable.size > 0) {
            const midTake = this.world.tick > 0;
            await this.resetCore({ keepPlayer: true });
            // The snap-back pauses on its own; only a user's Pause, or leaving first person or
            // focus, meanwhile cancels the start.
            if (
              userPauseGeneration !== this.userPauseGeneration ||
              fpsEntryGeneration !== this.fpsEntryGeneration
            )
              break;
            runGeneration = this.pauseGeneration;
            if (midTake) this.notice = TAKE_RESTARTED_NOTICE;
          }
          // Play at the starting layout starts the take; Play after a pause only resumes it.
          const startsTake = this.world.paused && this.world.tick === 0;
          if (this.interaction.snapshot().mode !== "editor") {
            if (!this.interaction.resume()) break;
          } else this.world.resume();
          // Only once time really resumes; no fixed step runs before the next advance.
          if (startsTake) this.beginTake();
          this.markRecordingAdvanceResumed();
          this.pauseReason = "";
          this.behavior.setPaused(false);
          this.recorder.resume();
          if (this.audio) await this.audio.resume(this.latest.simulationTimeSeconds);
          if (runGeneration !== this.pauseGeneration) break;
          await this.restoreSuspendedLiveVoices();
          if (runGeneration !== this.pauseGeneration) break;
          break;
        case "reset":
          await this.resetCore({ keepPlayer: false });
          break;
        case "undo":
          await this.restoreHistory(true);
          break;
        case "redo":
          await this.restoreHistory(false);
          break;
        case "saveZone": {
          const authoringScene = this.scene;
          if (
            action.expectedSceneRevision !== this.scene.sceneRevision ||
            action.expectedZoneRegistryPin !== zoneRegistryPin(this.scene.zones)
          )
            throw new Error("REVISION_CONFLICT：區域草稿已過期，請重新讀取。");
          if (
            this.interaction.snapshot().mode !== "editor" ||
            ["recording", "replaying"].includes(this.recorder.getView().recording.state) ||
            !this.world.paused
          )
            throw new Error("ZONE_EDIT_BLOCKED：請暫停並結束錄製／重播，在編輯器修改區域。");
          const exists = this.scene.zones?.some((zone) => zone.id === action.zone.id);
          await this.editScene(
            [{ type: exists ? "UpdateZone" : "AddZone", zone: action.zone }],
            () => {
              if (
                this.scene !== authoringScene ||
                action.expectedSceneRevision !== this.scene.sceneRevision ||
                action.expectedZoneRegistryPin !== zoneRegistryPin(this.scene.zones)
              )
                throw new Error("REVISION_CONFLICT");
              if (
                this.interaction.snapshot().mode !== "editor" ||
                ["recording", "replaying"].includes(this.recorder.getView().recording.state) ||
                !this.world.paused
              )
                throw new Error("ZONE_EDIT_BLOCKED");
            },
          );
          break;
        }
        case "removeZone": {
          const authoringScene = this.scene;
          if (
            action.expectedSceneRevision !== this.scene.sceneRevision ||
            action.expectedZoneRegistryPin !== zoneRegistryPin(this.scene.zones)
          )
            throw new Error("REVISION_CONFLICT：區域草稿已過期，請重新讀取。");
          if (
            this.interaction.snapshot().mode !== "editor" ||
            ["recording", "replaying"].includes(this.recorder.getView().recording.state) ||
            !this.world.paused
          )
            throw new Error("ZONE_EDIT_BLOCKED：請暫停並結束錄製／重播，在編輯器修改區域。");
          const references = this.document.profiles.flatMap((profile) =>
            profile.rules
              .filter(
                (rule) =>
                  (rule.trigger.kind === "discrete" && rule.trigger.zoneId === action.zoneId) ||
                  (rule.emitter.attachment === "zone" && rule.emitter.zoneId === action.zoneId),
              )
              .map((rule) => profile.profileId + "/" + rule.ruleId),
          );
          if (references.length)
            throw new Error(
              "ZONE_IN_USE：請先改選或移除引用此區域的規則：" + references.join(", "),
            );
          await this.editScene([{ type: "RemoveZone", zoneId: action.zoneId }], () => {
            if (
              this.scene !== authoringScene ||
              action.expectedSceneRevision !== this.scene.sceneRevision ||
              action.expectedZoneRegistryPin !== zoneRegistryPin(this.scene.zones)
            )
              throw new Error("REVISION_CONFLICT");
            if (
              this.interaction.snapshot().mode !== "editor" ||
              ["recording", "replaying"].includes(this.recorder.getView().recording.state) ||
              !this.world.paused
            )
              throw new Error("ZONE_EDIT_BLOCKED");
          });
          break;
        }
        case "addObject": {
          if (this.interaction.snapshot().mode !== "editor") {
            this.buildShape = action.shape;
            this.interaction.cancelPreview();
            this.notice = "已選擇放置形狀；繼續後按住右鍵預覽。";
            break;
          }
          const object = this.newObject(action.shape);
          await this.editScene([{ type: "AddObject", object }]);
          this.selected = object.id;
          break;
        }
        case "duplicateObject": {
          const original = this.scene.objects.find((object) => object.id === action.objectId);
          if (!original) throw new Error("UNKNOWN_OBJECT");
          // The copy starts without a path: setTrajectory is the only path write (audible check).
          const { trajectory: _path, ...copied } = clone(original);
          const object = {
            ...copied,
            id: id("object"),
            positionM: [
              original.positionM[0] + 0.6,
              original.positionM[1] + 0.3,
              original.positionM[2],
            ] as Vec3,
          };
          await this.editScene([{ type: "AddObject", object }]);
          this.selected = object.id;
          break;
        }
        case "removeObject":
          await this.editScene([{ type: "RemoveObject", objectId: action.objectId }]);
          break;
        case "patchObject": {
          // One write path for paths, so the audible check cannot be bypassed.
          if ("trajectory" in action.patch) throw new Error("TRAJECTORY_USE_SET_TRAJECTORY");
          const { name, ...patch } = action.patch;
          if (!this.scene.objects.some((object) => object.id === action.objectId))
            throw new Error("UNKNOWN_OBJECT");
          if (name === undefined && Object.keys(patch).length === 0) throw new Error("EMPTY_PATCH");
          const next =
            Object.keys(patch).length > 0
              ? applyCommand(this.scene, {
                  expectedSceneRevision: this.scene.sceneRevision,
                  operations: [{ type: "UpdateObject", objectId: action.objectId, patch }],
                }).scene
              : createScene({ ...this.scene, sceneRevision: this.scene.sceneRevision + 1 });
          let metadata = this.editorMetadata;
          if (name !== undefined) {
            const base = metadata ?? {
              schemaVersion: "1.0.0" as const,
              revision: 0,
              objectLabels: [],
              sourceReferences: [],
            };
            metadata = validateEditorMetadata(
              {
                ...base,
                revision: base.revision + 1,
                objectLabels: [
                  ...base.objectLabels.filter((entry) => entry.objectId !== action.objectId),
                  { objectId: action.objectId, label: name },
                ],
              },
              next,
            );
          }
          await this.commitScene(next, this.scene.sceneRevision, true, undefined, metadata ?? null);
          break;
        }
        case "setTrajectory":
          await this.commitTrajectory(action.objectId, action.trajectory);
          break;
        case "paintStart": {
          const target = this.paintTarget();
          if ("refusal" in target) {
            this.notice = target.refusal;
            break;
          }
          // Only objects snap back to the starting layout; the player stays where they stand.
          await this.resetCore({ keepPlayer: true });
          // A release, a user pause, or losing focus, the lock or first person meanwhile ends the
          // stroke before it begins; the room stays at its starting layout.
          if (
            paintTicket !== this.paintGeneration ||
            userPauseGeneration !== this.userPauseGeneration
          )
            break;
          const object = this.scene.objects.find((value) => value.id === target.objectId);
          if (!object) throw new Error("UNKNOWN_OBJECT");
          this.interaction.beginPaint(object.id, [...object.positionM]);
          break;
        }
        case "paintEnd": {
          if (!paintStroke) break;
          const objectId = paintStroke.objectId;
          const object = this.scene.objects.find((value) => value.id === objectId);
          if (!object) throw new Error("UNKNOWN_OBJECT");
          const offsetsM = strokeOffsets(object.positionM, paintStroke.pointsM);
          // The brush never left the start: keep the previous path and the frozen room as they are.
          if (offsetsM.length === 0) break;
          // A redraw replaces only the curve.
          const previous = object.trajectory;
          await this.commitTrajectory(objectId, {
            offsetsM,
            strengthMps: previous?.strengthMps ?? TRAJECTORY_LIMITS.defaultStrengthMps,
            startDelayS: previous?.startDelayS ?? 0,
            faceAlongPath: previous?.faceAlongPath ?? false,
          });
          // The stroke is saved for editing either way; a path that cannot run says why at once.
          const problem = this.pathStatus().status[objectId]?.problem;
          if (problem) this.notice = PAINTED_PATH_NOTICES[problem];
          else if (Object.values(PAINTED_PATH_NOTICES).includes(this.notice)) this.notice = "";
          break;
        }
        case "patchListener":
          await this.editScene([
            {
              type: "SetListener",
              listener: {
                ...this.scene.listener,
                positionM: action.positionM,
                orientationQuaternion:
                  action.orientationQuaternion ?? this.scene.listener.orientationQuaternion,
                attachment: "independent",
              },
            },
          ]);
          break;
        case "addRule":
        case "patchRule":
        case "removeRule":
        case "setBindingOverride":
        case "setPreset": {
          const beforeRevision = this.document.revision;
          const beforeBinding = this.document.bindings.find(
            (binding) => binding.objectId === action.objectId,
          );
          const ruleId = "ruleId" in action ? action.ruleId : null;
          const nextDocument = editBehaviors(
            this.document,
            this.scene,
            this.latest.poses,
            this.assets,
            action,
          );
          const source =
            action.type === "patchRule" ||
            action.type === "removeRule" ||
            action.type === "setBindingOverride"
              ? this.sceneSourceForRule(action.objectId, action.ruleId)
              : null;
          const enabledChange =
            action.type === "setBindingOverride" ||
            (action.type === "patchRule" && action.patch.enabled !== undefined);
          if (source && (action.type === "removeRule" || enabledChange)) {
            const binding = nextDocument.bindings.find(
              (value) => value.objectId === action.objectId,
            );
            const profile = nextDocument.profiles.find(
              (value) => value.profileId === binding?.profileId,
            );
            const rule = profile?.rules.find((value) => value.ruleId === ruleId);
            const enabled = Boolean(
              binding?.enabled &&
                (binding.overrides.find((value) => value.ruleId === ruleId)?.enabled ??
                  rule?.enabled),
            );
            const operations: SceneOperation[] =
              action.type === "removeRule"
                ? [{ type: "RemoveSource", sourceId: source.id }]
                : [{ type: "SetSource", source: { ...source, playing: enabled } }];
            const nextScene = applyCommand(this.scene, {
              expectedSceneRevision: this.scene.sceneRevision,
              operations,
            }).scene;
            await this.commitScene(nextScene, this.scene.sceneRevision, true, nextDocument);
          } else await this.commitBehavior(nextDocument);
          const afterBinding = this.document.bindings.find(
            (binding) => binding.objectId === action.objectId,
          );
          if (beforeBinding && afterBinding && this.document.revision > beforeRevision)
            this.lastBehaviorEdit = {
              objectId: action.objectId,
              bindingId: afterBinding.bindingId,
              beforeDocumentRevision: beforeRevision,
              afterDocumentRevision: this.document.revision,
              beforeProfileId: beforeBinding.profileId,
              afterProfileId: afterBinding.profileId,
              afterProfileRevision: afterBinding.profileRevision,
            };
          break;
        }
        case "enableAudio":
          await this.enableAudio();
          break;
        case "toggleMute":
          if (this.audio) this.audio.setMuted(!this.audio.getTelemetry().muted);
          this.staticPreview.syncMonitor();
          break;
        case "setAudioBufferPreset":
          await this.changeAudioBufferPreset(action.preset);
          break;
        case "setMonitorGain": {
          const gain = finite(action.gainLinear, "monitor gain", 0, MAX_MONITOR_GAIN);
          this.audio?.setMonitorGain(gain);
          this.desiredMonitorGain = gain;
          this.staticPreview.syncMonitor();
          break;
        }
        case "setMonitorMode": {
          if (action.mode !== "raw" && action.mode !== "simulated")
            throw new AudioEngineError("INVALID_MONITOR_MODE", String(action.mode));
          this.audio?.setMonitorMode(action.mode);
          this.desiredMonitorMode = action.mode;
          this.staticPreview.syncMonitor();
          break;
        }
        case "setReverb": {
          const next = {
            ...this.reverbSettings,
            enabled: action.enabled,
            ...(action.decaySeconds !== undefined ? { decaySeconds: action.decaySeconds } : {}),
            ...(action.wetGain !== undefined ? { wetGain: action.wetGain } : {}),
          };
          if (
            !Number.isFinite(next.decaySeconds) ||
            next.decaySeconds < 0.1 ||
            next.decaySeconds > 4 ||
            !Number.isFinite(next.wetGain) ||
            next.wetGain < 0 ||
            next.wetGain > 1
          )
            throw new Error("REVERB_BOUNDS");
          if (this.audio) await this.audio.setLateReverb(next);
          this.reverbSettings = next;
          break;
        }
        case "audition": {
          const intent = ++this.previewIntent;
          this.assertPreviewPaused();
          await this.staticPreview.stop();
          if (this.disposed || intent !== this.previewIntent) break;
          if (!this.audio) await this.enableAudio();
          if (this.disposed || intent !== this.previewIntent) break;
          const asset = this.assets.find((value) => value.assetId === action.assetId);
          if (!asset) throw new Error("ASSET_NOT_READY");
          const admission = await this.audio!.audition({
            kind: "sample",
            asset: { assetId: asset.assetId, revision: asset.revision, sha256: asset.sha256 },
            loop: false,
            startOffsetSeconds: 0,
          });
          if (this.disposed || intent !== this.previewIntent) break;
          if (!admission.accepted) throw new Error(admission.reason ?? "AUDITION_FAILED");
          this.notice = "素材預聽；不屬於3D實驗結果。";
          break;
        }
        case "previewRule": {
          const intent = ++this.previewIntent;
          this.assertPreviewPaused();
          const binding = this.document.bindings.find(
            (value) => value.bindingId === action.bindingId,
          );
          if (!binding || binding.objectId !== action.objectId)
            throw new Error("PREVIEW_SELECTION_MISMATCH");
          const pose = this.latest.poses.find((value) => value.objectId === action.objectId);
          const contact = this.selectedEvent
            ? (this.previewContacts.get(this.selectedEvent) ??
              [...this.previewContacts.values()].find(
                (value) =>
                  value.inputEvent.eventId === this.selectedEvent &&
                  value.voice.event.objectId === action.objectId &&
                  value.voice.event.bindingId === action.bindingId &&
                  value.voice.event.ruleId === action.ruleId,
              ))
            : undefined;
          const rule = this.document.profiles
            .find((value) => value.profileId === binding.profileId)
            ?.rules.find((value) => value.ruleId === action.ruleId);
          if (!rule) throw new Error("PREVIEW_SELECTION_MISMATCH");
          if (rule.emitter.attachment === "contact" && !contact)
            throw new Error("CONTACT_EVENT_REQUIRED");
          if (rule.emitter.attachment !== "contact" && rule.mappings.length)
            throw new Error("MAPPING_INPUT_UNAVAILABLE");
          if (!this.audio) await this.enableAudio();
          if (this.disposed || intent !== this.previewIntent) break;
          await this.audio!.stopAudition();
          if (this.disposed || intent !== this.previewIntent) break;
          await this.staticPreview.start({
            state: this.latest.tick === 0 ? "ready" : "paused",
            scene: this.scene,
            document: this.document,
            poses: this.latest.poses,
            objectId: action.objectId,
            generation: pose?.generation ?? binding.objectGeneration,
            bindingId: binding.bindingId,
            ruleId: action.ruleId,
            tick: this.latest.tick,
            listener: this.listener(),
            materials: DEFAULT_MATERIALS,
            atmosphere: this.atmosphere,
            ...(contact ? { contact } : {}),
          });
          break;
        }
        case "importAudio":
          await this.importAudio(action.file, action.rightsConfirmed);
          break;
        case "recordToggle":
          if (this.replayFrame || this.recorder.getView().recording.state === "replaying")
            throw new Error("STOP_REPLAY_REQUIRED：請先返回即時場景再錄製");
          if (this.recorder.getView().recording.state === "recording") {
            try {
              await this.recorder.stop();
              this.renderRecording = this.recorder.getArtifact();
              this.renderHost.refresh();
              if (pauseGeneration !== this.pauseGeneration) this.world.pause();
              await this.persistRecordings();
              if (pauseGeneration !== this.pauseGeneration) this.world.pause();
            } finally {
              this.releaseTransportAssets("recording");
              if (!this.disposed) this.setClockMode("interactive");
            }
          } else {
            // A room with paths that has already run, or whose world a scene edit changed, snaps
            // back first, so every take starts from the starting layout and repeats exactly.
            // Without a runnable path Record keeps continuing the live world.
            if ((this.world.tick > 0 || this.takeStale) && this.pathStatus().runnable.size > 0) {
              await this.resetCore({ keepPlayer: true });
              // The snap-back pauses on its own; only a user's Pause meanwhile cancels the start.
              if (userPauseGeneration !== this.userPauseGeneration) break;
            }
            if (this.interaction.snapshot().mode !== "editor" && !this.interaction.resume()) break;
            recordingStartCompletion = new Promise<void>((resolve) => {
              completeRecordingStart = resolve;
            });
            this.recordingStartCompletion = recordingStartCompletion;
            // The preparation helper owns its temporary notice; asset failures stay paused.
            this.pauseCore("");
            const recordGeneration = this.pauseGeneration;
            await this.acquireTransportAssets("recording");
            this.assertLive();
            if (recordGeneration !== this.pauseGeneration) {
              this.releaseTransportAssets("recording");
              break;
            }
            try {
              const ready = await this.prepareRecordingCapture();
              if (!ready || recordGeneration !== this.pauseGeneration) {
                this.recorder.abortPreparedStart("PREPARATION_INTERRUPTED");
                this.releaseTransportAssets("recording");
                break;
              }
              this.assertLive();
              // The take starts with time, after every refusal point; no step has run yet.
              if (this.world.tick === 0) this.beginTake();
              this.world.clock.setMode("recording");
              this.recorder.resume();
              this.recordingBackpressureDiagnostics = null;
              this.beginRecordingAdvanceCapture();
            } catch (error) {
              this.recorder.abortPreparedStart("PREPARATION_RESUME_FAILED");
              this.releaseTransportAssets("recording");
              throw error;
            }
            if (cancelsPlacementForRecording) this.notice = "PLACEMENT_TRANSPORT";
            this.behavior.setPaused(false);
            this.world.resume();
            this.markRecordingAdvanceResumed();
            // Starting a recording resumes time, like run; clear the reason before
            // awaiting audio so a pause landing meanwhile keeps its own.
            this.pauseReason = "";
            if (this.audio) await this.audio.resume(this.latest.simulationTimeSeconds);
            if (recordGeneration !== this.pauseGeneration) break;
            await this.restoreSuspendedLiveVoices();
            if (recordGeneration !== this.pauseGeneration) break;
          }
          break;
        case "replay":
          await this.replayTask(() => this.openReplay(false, pauseGeneration));
          break;
        case "seek":
          if (!Number.isFinite(action.timeSeconds) || action.timeSeconds < 0)
            throw new Error("INVALID_SEEK_TIME");
          await this.replayTask(async () => {
            if (this.recorder.getView().recording.state !== "replaying") {
              if (!(await this.openReplay(true, pauseGeneration))) return;
            }
            const generation = this.replayGeneration;
            this.nativeAdmissionDiagnostics.clear();
            this.replayPaused = true;
            this.recorder.pause();
            this.interaction.pausePreservingInputMode(
              "Seek已截斷舊尾音；按繼續從保存的來源游標重播，不重發舊撞擊。",
            );
            const frame = this.recorder.seek(
              (this.recorder.getArtifact()?.startTick ?? 0) + Math.round(action.timeSeconds * 60),
            );
            await this.replayAudio.seek(frame);
            if (this.disposed || generation !== this.replayGeneration) return;
            this.applyReplayFrame(frame, false);
          });
          break;
        case "captureComparison":
          this.pauseCore("建立同運動比較快照");
          try {
            await this.recorder.captureComparison(action.slot);
            await this.persistRecordings();
          } finally {
            const view = this.recorder.getView();
            if (!view.pending && view.recording.state !== "recording")
              this.releaseTransportAssets("recording");
          }
          break;
        case "compare":
          await this.recorder.compare(action.kind);
          break;
        case "submitPrompt":
          if (this.agentProvider === "meta") {
            if (this.providerStatus.status !== "ready")
              throw new Error(`META_PROVIDER_BLOCKED：${this.providerStatus.reason}`);
            await this.agent.submitLive(action.prompt);
          } else await this.agent.submit(action.prompt);
          break;
        case "setAgentMode":
          this.agent.cancel();
          this.agentProvider = action.mode;
          if (action.mode === "meta") await this.refreshProviderStatus();
          break;
        case "refreshAgentStatus":
          await this.refreshProviderStatus();
          break;
        case "motionSave":
          await this.motion.save(action.input, action.expectedRevision);
          break;
        case "motionRemove":
          await this.motion.remove(action.actionId, action.expectedRevision);
          break;
        case "motionStart": {
          const target = this.motion
            .getSnapshot()
            .actions.find((entry) => entry.actionId === action.actionId)?.objectId;
          if (target !== undefined && this.pathRunner.isRunning(target))
            throw new Error("MOTION_PATH_ACTIVE");
          this.recorder.assertEvaluationReady();
          await this.motion.start(action.actionId, id("motion-command"));
          this.recorder.resume();
          this.world.resume();
          this.behavior.setPaused(false);
          this.pauseReason = "";
          if (this.audio) await this.audio.resume(this.currentSimulationTime());
          break;
        }
        case "motionCancel":
          this.motion.cancel(action.runId);
          break;
        case "motionUndo":
          await this.motion.undo(action.expectedRevision);
          break;
        case "motionRedo":
          await this.motion.redo(action.expectedRevision);
          break;
        case "motionRebase":
          await this.motion.rebase(action.expectedRevision);
          break;
        case "exportMotion":
          this.download(this.motion.exportJson(), "reflection-lab-motion.json");
          break;
        case "importMotion":
          await this.motion.importJson(action.text, action.expectedRevision);
          break;
        case "setAudioDiagnosticsEnabled":
          this.audio?.setDiagnosticsEnabled(action.enabled);
          break;
        case "runAgentExperiment":
          await this.stopPreviews();
          this.pauseCore("實驗工具：有界模擬與分析");
          await this.agent.runExperiment({ durationS: action.durationS });
          this.selectWorkflowTake();
          break;
        case "compareAgentExperiment":
          await this.stopPreviews();
          this.pauseCore("實驗工具：相同運動比較");
          await this.agent.compareExperiment();
          this.selectWorkflowTake();
          break;
        case "undoAI":
          await this.agent.undo();
          break;
        case "applyAI":
          await this.agent.apply();
          break;
        case "enterFPS":
          this.workspace = "simulation";
          this.interaction.enterFPS({ pointerLocked: this.interaction.snapshot().pointerLocked });
          break;
        case "setInteractionMode":
          if (action.mode === "editor") this.interaction.exitFPS();
          else {
            if (this.interaction.snapshot().mode === "editor")
              this.interaction.enterFPS({ pointerLocked: false });
            this.interaction.setBuild(action.mode === "fps-build");
            if (action.mode === "fps-build")
              this.interaction.beginBuild(this.newObject(this.buildShape));
          }
          break;
        case "grab":
          this.interaction.grab();
          break;
        case "drop":
          this.interaction.drop();
          break;
        case "throw":
          this.interaction.throw();
          break;
        case "place":
          if (this.interaction.snapshot().ghost) await this.interaction.place();
          else this.interaction.gentlePlace();
          break;
        case "startPlacement":
          this.interaction.startPreview();
          break;
        case "setAtmosphere": {
          const nextAtmosphere = validateProjectAtmosphere({
            ...this.atmosphere,
            medium: action.medium,
            ...(action.temperatureC !== undefined
              ? {
                  temperatureC: action.temperatureC,
                  speedOfSoundMps: Math.sqrt(1.4 * 287.05 * (273.15 + action.temperatureC)),
                }
              : {}),
          });
          // Refusals cannot drain a recording or change the current environment.
          await this.drain();
          this.assertLive();
          this.atmosphere = nextAtmosphere;
          this.runEpoch = id("epoch");
          this.behavior = this.newBehavior();
          await this.solveCurrent();
          break;
        }
        case "save":
          await this.persistRecordings();
          this.project = this.store.save(this.currentProject());
          this.notice = this.blobStore.capabilities.persistent
            ? "已儲存專案、可用音檔與已完成錄製至本機瀏覽器；跨裝置需另外攜帶原檔。"
            : "已儲存專案；此環境的音檔與錄製為記憶體保存，關閉後需重新匯入。";
          break;
        case "load": {
          const saved = this.store.load();
          if (!saved) throw new Error("NO_SAVED_PROJECT");
          await this.importProject(serializeProject(saved));
          break;
        }
        case "export":
          this.download(this.exportProject(), "reflection-lab-project.json");
          break;
        case "importProject":
          await this.importProject(action.text);
          break;
        case "frameSelected":
          this.notice = "使用Viewport的對準控制移動觀察相機，不改Listener。";
          break;
      }
    } catch (error) {
      const cancelled =
        replayIntent !== undefined &&
        replayIntent !== this.replayCancellation &&
        ["replay", "seek", "run"].includes(action.type);
      if (!this.disposed && !cancelled) {
        if ((action.type === "replay" || action.type === "seek") && this.suspendedLiveAudio)
          await this.finishReplay();
        this.fail(error, false);
      }
    } finally {
      try {
        if (ownsTransaction && (action.type === "replay" || action.type === "seek"))
          this.replayStarting = false;
        if (ownsTransaction) this.busy = false;
        if (!this.disposed) {
          if (["inputLook", "inputKey", "inputPointer", "inputWheel"].includes(action.type))
            this.publicationPending = true;
          else this.requestPublication();
        }
      } finally {
        if (recordingStartCompletion) {
          if (this.recordingStartCompletion === recordingStartCompletion)
            this.recordingStartCompletion = null;
          completeRecordingStart?.();
        }
      }
    }
  }
  private newObject(shape: SceneObject["shape"]): SceneObject {
    return {
      id: id("object"),
      shape,
      dimensionsM: shape === "capsule" ? [0.5, 1, 0.5] : [0.5, 0.5, 0.5],
      positionM: [0, 2, 0],
      orientationQuaternion: [0, 0, 0, 1],
      mode: "dynamicGravity",
      massKg: 1,
      friction: 0.5,
      restitution: 0.4,
      physicsMaterialId: "material.wood",
      acousticMaterialId: "material.wood",
      acousticRole: "dynamicOccluder",
    };
  }
  private sceneSourceForRule(objectId: string, ruleId: string) {
    const sourceId = sceneSourceIdFromRuleId(ruleId);
    if (sourceId)
      return this.scene.sources.find(
        (source) => source.id === sourceId && source.objectId === objectId,
      );
    const binding = this.document.bindings.find(
      (value) =>
        value.objectId === objectId && value.bindingId === `binding.continuous.${objectId}`,
    );
    const profile = this.document.profiles.find((value) => value.profileId === binding?.profileId);
    const sources = this.scene.sources.filter(
      (source) => source.objectId === objectId && source.mode === "continuous",
    );
    return binding &&
      ruleId === "rule.always" &&
      profile?.rules.some((rule) => rule.ruleId === ruleId && rule.trigger.type === "AlwaysOn") &&
      sources.length === 1
      ? sources[0]
      : undefined;
  }
  private assertPreviewPaused(): void {
    if (this.replayFrame || this.recorder.getView().recording.state === "replaying")
      throw new Error("PREVIEW_STOP_REPLAY_REQUIRED");
    if (!this.world.paused) throw new Error("PREVIEW_REQUIRES_PAUSE");
  }
  private clearPreviewContacts(): void {
    this.previewContacts.clear();
    this.previewContactDocument = null;
    this.previewContactEpoch = "";
  }
  private async stopPreviews(): Promise<void> {
    ++this.previewIntent;
    await Promise.all([this.staticPreview.stop(), this.audio?.stopAudition()]);
  }
  /** Active shared benchmark/control endpoint: diagnostics polling and native clock reads are included. */
  getAudioResourceObservation(): {
    telemetry: ReturnType<AudioEngine["getTelemetry"]>;
    resourceSnapshot: ReturnType<AudioEngine["getNativeResourceSnapshot"]>;
  } | null {
    if (this.disposed || !this.audio) return null;
    return clone({
      telemetry: this.audio.getTelemetry(),
      resourceSnapshot: this.audio.getNativeResourceSnapshot(),
    });
  }
  /** Observer configuration only. It never allocates an engine or changes voices/routes. */
  setAudioDiagnosticsEnabled(enabled: boolean): void {
    if (typeof enabled !== "boolean")
      throw new TypeError("Audio diagnostics enabled must be boolean");
    if (this.disposed) throw new AudioEngineError("DISPOSED", "Runtime disposed");
    if (!this.audio) throw new AudioEngineError("AUDIO_NOT_ENABLED", "Audio engine is not enabled");
    this.audio.setDiagnosticsEnabled(enabled);
  }
  private async enableAudio(): Promise<void> {
    if (this.audio?.getTelemetry().enabled) {
      this.audio.setMuted(false);
      this.staticPreview.syncMonitor();
      return;
    }
    if (!this.audio) {
      const audioOptions: AudioEngineConfiguration = {
        bufferPreset: this.audioBufferPreset,
        monitorGain: this.desiredMonitorGain,
        headroomGain: PRODUCT_HEADROOM_GAIN,
        outputSafetyClip: true,
        // Native HRTF panners click as they turn and load the audio thread; see AUDIO_PATH_CLICKS_20261104.
        hrtfScope: "directPath",
        // Native onended belongs to the renderer clock. Logical lifetimes and recorded
        // state change only during Behavior fixed steps; native cleanup stays in AudioEngine.
      };
      if (this.audioResourcePolicy !== undefined)
        audioOptions.virtualization = this.audioResourcePolicy;
      this.audio = new AudioEngine(audioOptions);
      this.audio.setMonitorMode(this.desiredMonitorMode);
    }
    // The host owns the validated bank. Attaching never activates an audio device.
    await this.audio.drainVoices();
    await this.assetHost.attachEngine(this.audio);
    this.assertLive();
    await this.audio.enable(this.latest.simulationTimeSeconds);
    this.assertLive();
    this.audio.setMuted(false);
    this.staticPreview.syncMonitor();
    await this.audio.setLateReverb(this.reverbSettings);
    await this.assetHost.ensureBuiltinDescriptors(this.audio);
    this.syncAssets();
    this.syncAudioListener();
    if (this.replayFrame || this.recorder.getView().recording.state === "replaying") {
      await this.replayAudio.resume();
      if (this.replayPaused) this.audio.pause(this.currentSimulationTime());
      return;
    }
    for (const voice of this.activeVoices.values())
      if (voice.event.trigger.kind === "continuous")
        this.pendingAudio.set(voice.event.instanceId, {
          input: {
            ...this.voiceInput(voice),
            emissionTimeSeconds: this.latest.simulationTimeSeconds,
          },
          intent: clone(voice),
          behaviorDocumentRevision: this.document.revision,
        });
    if (this.world.paused) this.audio.pause(this.latest.simulationTimeSeconds);
    else await this.audio.resume(this.latest.simulationTimeSeconds);
    this.notice = "已啟用低音量監聽；請依實際裝置調整。dBFS未校準為dB SPL。";
  }
  private async changeAudioBufferPreset(preset: AudioBufferPreset): Promise<void> {
    if (!isAudioBufferPreset(preset)) throw new Error("AUDIO_BUFFER_INVALID");
    if (preset === this.audioBufferPreset) return;
    this.audioRestarting = true;
    this.requestPublication();
    try {
      await this.stopPreviews();
      this.assertLive();
      if (this.audio) {
        await this.audio.setBufferPreset(preset, this.currentSimulationTime(), {
          shouldResume: () => !this.world.paused,
          simulationTime: () => this.currentSimulationTime(),
        });
        this.assertLive();
        this.syncAudioListener();
      }
      this.audioBufferPreset = preset;
      persistAudioBufferPreset(preset);
    } catch (error) {
      if (this.audio?.getTelemetry().lastError === "AUDIO_BUFFER_RESTART_FAILED")
        this.pauseCore("AUDIO_BUFFER_RESTART_FAILED");
      throw error;
    } finally {
      this.audioRestarting = false;
      if (!this.disposed) this.expireRestartGapIntents();
      if (!this.disposed) this.admitPendingAudio(true);
    }
  }
  private expireRestartGapIntents(): void {
    for (const [key, pending] of this.pendingAudio) {
      if (
        pending.input.continuous ||
        this.currentSimulationTime() - pending.input.emissionTimeSeconds <=
          AUDIO_LOOKAHEAD_SECONDS[this.audioBufferPreset]
      )
        continue;
      const frame =
        this.solutions.get(pending.input.sourceId)?.frame ?? this.cachedVoiceFrame(pending);
      this.nativeAdmissionDiagnostics.append({
        intent: pending.intent,
        voiceInput: pending.input,
        admission: { accepted: false, reason: "RESTART_GAP" },
        ...(frame ? { frame } : {}),
        behaviorDocumentRevision: pending.behaviorDocumentRevision,
        attemptedAtTick: this.latest.tick,
      });
      this.pendingAudio.delete(key);
    }
  }
  private async importAudio(file: File, rightsConfirmed: boolean): Promise<void> {
    if (!rightsConfirmed) throw new Error("RIGHTS_CONFIRMATION_REQUIRED");
    if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 8 * 1024 * 1024)
      throw new Error("ASSET_SIZE_LIMIT");
    await this.drain();
    try {
      await this.assetHost.importFile(file, rightsConfirmed, this.pendingProject ?? undefined);
    } finally {
      // A bank edit is a new paused authoring branch; no drained logical source may remain silently active.
      this.runEpoch = id("epoch");
      this.behavior = this.newBehavior();
    }
    this.syncAssets();
    this.notice = this.pendingProject
      ? `已核對並保存 ${file.name}；請再次套用待匯入的專案，保留原asset ID與revision。`
      : `已解碼並保存 ${file.name}；hash涵蓋原WAV位元組，監聽仍需另行啟用。`;
  }
  private syncAssets(): void {
    this.assets = this.assetHost.getAssets();
    this.projectAssets = this.assetHost.getProjectAssets();
  }
  private captureLiveAudio(): SuspendedLiveAudio {
    const snapshot = this.behavior.snapshot();
    return {
      snapshot,
      voices: clone([...this.activeVoices.values()]),
      pending: clone([...this.pendingAudio.values()]),
      cursors: this.captureVoiceCursors(snapshot),
    };
  }
  private async restoreSuspendedLiveVoices(): Promise<void> {
    const saved = this.restoreLiveAudioOnRun;
    if (!saved || !this.audio?.getTelemetry().enabled) return;
    const engine = this.audio;
    engine.setEpoch(this.latest.simulationTimeSeconds);
    this.syncAudioListener();
    const frames = this.requests(
      this.latest.poses,
      saved.voices.map((voice) => voice.event),
    ).map((request) => solveAcoustics(request).frame);
    for (const frame of frames) {
      const voice = this.activeVoices.get(frame.sourceId),
        cursor = saved.cursors[frame.sourceId];
      if (!voice || !cursor) continue;
      const result = engine.restoreVoiceAtCursor(this.voiceInput(voice), frame, cursor);
      if (!result.accepted) throw new Error(`LIVE_AUDIO_RESTORE：${result.reason}`);
    }
    this.restoreLiveAudioOnRun = null;
  }
  private async persistRecordings(): Promise<void> {
    const artifacts = [this.recorder.getArtifact(), ...Object.values(this.recorder.getSlots())];
    for (const artifact of artifacts) {
      if (!artifact || artifact.frameCount === 0 || artifact.status === "cancelled") continue;
      if (this.storedArtifacts.get(artifact.runId)?.artifactSha256 === artifact.artifactSha256)
        continue;
      await this.blobStore.saveRecording(artifact);
      this.storedArtifacts.set(artifact.runId, artifact);
    }
  }
  private syncAudioListener(): void {
    if (!this.audio || this.advancing) return;
    const listener = this.replayFrame?.listener ?? this.listener();
    const rotation = new Quaternion(...listener.orientationQuaternion);
    const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
    const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
    this.audio.updateListener({
      positionM: listener.positionM,
      forward: [forward.x, forward.y, forward.z],
      up: [up.x, up.y, up.z],
    });
  }
  private async refreshProviderStatus(): Promise<void> {
    this.providerStatus = { status: "loading", reason: "查詢本機設定；沒有模型呼叫。" };
    this.requestPublication();
    try {
      const result = await getProviderStatus();
      this.providerStatus = {
        status:
          result.meta.state === "READY" &&
          result.meta.estimatedCostCeilingUsd > 0 &&
          typeof result.meta.modelId === "string" &&
          result.meta.modelId.trim().length > 0
            ? "ready"
            : "blocked",
        reason:
          result.meta.state === "READY"
            ? "READY_REQUIRES_EXPLICIT_REQUEST；只有提交指令才會呼叫模型；剩餘額度未知。"
            : `${result.meta.reason}；Live validation ${result.meta.liveValidation}；剩餘額度未知。`,
      };
    } catch (error) {
      this.providerStatus = {
        status: "error",
        reason: error instanceof Error ? error.message : "本機API不可用；未呼叫模型。",
      };
    }
  }
  private currentSimulationTime(): number {
    return this.replayFrame ? this.replayFrame.tick / 60 : this.latest.simulationTimeSeconds;
  }
  private captureCursorEvidence(snapshot: BehaviorSnapshot) {
    return captureVoiceCursorEvidence(
      snapshot.state.instances,
      snapshot.state.tick * snapshot.state.fixedDtSeconds,
      this.audio,
    );
  }
  private captureVoiceCursors(snapshot: BehaviorSnapshot): Record<string, VoiceCursor> {
    const evidence = this.captureCursorEvidence(snapshot);
    // Live restoration may use an incomplete cursor; recording native evidence may not.
    return Object.fromEntries([
      ...Object.entries(evidence.native),
      ...Object.entries(evidence.nonNative).map(([instanceId, state]) => [
        instanceId,
        state.cursor,
      ]),
    ]);
  }
  private setClockMode(mode: "interactive" | "recording"): void {
    const running = !this.world.paused;
    this.world.pause();
    this.world.clock.setMode(mode);
    if (running) this.world.resume();
  }
  private download(text: string, filename: string): void {
    if (typeof document === "undefined") return;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  private fail(error: unknown, pause = true): void {
    this.error = error instanceof Error ? error.message : String(error);
    if (pause) this.pauseCore("錯誤後安全暫停");
    this.requestPublication();
  }
  private assertLive(): void {
    if (this.disposed) throw new Error("DISPOSED：工作台已卸載，取消提交。");
  }
  private requestPublication(): void {
    if (this.pipelineTransactionDepth > 0) {
      this.publicationPending = true;
      return;
    }
    if (this.advancing) this.publicationPending = true;
    else this.publish();
  }
  private publish(): void {
    if (this.disposed) return;
    if (this.pipelineTransactionDepth > 0) {
      this.publicationPending = true;
      return;
    }
    this.publicationPending = false;
    // A paused-time interaction message no longer applies once the live simulation
    // runs, whichever path resumed it (run, Enter, recording start).
    if (this.pausedInteractionNotice !== null && !this.world.paused) {
      if (this.notice === this.pausedInteractionNotice) this.notice = "";
      if (this.pauseReason === this.pausedInteractionNotice) this.pauseReason = "";
      this.pausedInteractionNotice = null;
    }
    const interaction = this.interaction?.snapshot(),
      record = this.recorder?.getView();
    const first = this.solutions.values().next().value as AcousticSolution | undefined;
    const acousticFrames = this.replayFrame
      ? this.recordedAcousticFrames
      : [...this.solutions.values()].map((solution) => solution.frame);
    const firstFrame = acousticFrames[0];
    const audio = this.audio?.getTelemetry();
    const activeRuleStates = this.behavior.getActiveRuleStates();
    const displayingReplay = Boolean(this.replayFrame || record?.recording.state === "replaying");
    const displayScene = displayingReplay
      ? (this.recorder.getArtifact()?.configuration.sceneSnapshot ?? this.scene)
      : this.scene;
    const recordedAtmosphere = displayingReplay
      ? this.recorder.getArtifact()?.configuration.atmosphere
      : undefined;
    const displayAtmosphere =
      recordedAtmosphere &&
      typeof recordedAtmosphere === "object" &&
      "medium" in recordedAtmosphere &&
      (recordedAtmosphere.medium === "air" || recordedAtmosphere.medium === "vacuum")
        ? (recordedAtmosphere as Atmosphere)
        : this.atmosphere;
    const recordedSnapshot = this.replayFrame?.behaviorSnapshot;
    const recordedInput =
      recordedSnapshot && typeof recordedSnapshot === "object" && "inputFrame" in recordedSnapshot
        ? recordedSnapshot.inputFrame
        : undefined;
    const recordedObjects =
      recordedInput &&
      typeof recordedInput === "object" &&
      "objects" in recordedInput &&
      Array.isArray(recordedInput.objects)
        ? (recordedInput.objects as unknown[])
        : [];
    const objectViews = this.viewProjection.objects(
      displayScene,
      this.editorMetadata,
      this.document,
    );
    const objects = objectViews.map((object) => {
      const pose = displayingReplay
        ? undefined
        : this.latest.poses.find((body) => body.objectId === object.id);
      const recordedPose = this.replayFrame?.poses.find((body) => body.objectId === object.id);
      const savedObject = recordedObjects.find(
        (body): body is Record<string, unknown> =>
          body !== null &&
          typeof body === "object" &&
          "objectId" in body &&
          body.objectId === object.id,
      );
      const savedState =
        savedObject?.states && typeof savedObject.states === "object"
          ? (savedObject.states as Record<string, unknown>)
          : undefined;
      return {
        ...object,
        ...(recordedPose
          ? {
              positionM: [...recordedPose.positionM] as Vec3,
              orientationQuaternion: [...recordedPose.orientationQuaternion] as [
                number,
                number,
                number,
                number,
              ],
              ...(recordedPose.linearVelocityMps
                ? { velocityMps: [...recordedPose.linearVelocityMps] as Vec3 }
                : {}),
              ...(recordedPose.angularVelocityRadps
                ? { angularVelocityRadps: [...recordedPose.angularVelocityRadps] as Vec3 }
                : {}),
              ...(typeof recordedPose.sleeping === "boolean"
                ? { sleeping: recordedPose.sleeping }
                : typeof savedState?.sleeping === "boolean"
                  ? { sleeping: savedState.sleeping }
                  : {}),
              ...(typeof savedState?.held === "boolean" ? { held: savedState.held } : {}),
            }
          : {}),
        ...(pose
          ? {
              velocityMps: pose.linearVelocityMetresPerSecond,
              angularVelocityRadps: pose.angularVelocityRadiansPerSecond,
              held: pose.held,
              sleeping: pose.sleeping,
            }
          : {}),
      };
    });
    this.view = {
      motion: this.motion.getView(),
      projectId: this.project.projectId,
      ...(this.lastBehaviorEdit ? { lastBehaviorEdit: clone(this.lastBehaviorEdit) } : {}),
      projectName: this.project.name,
      sceneRevision: displayScene.sceneRevision,
      ...(displayScene.zones === undefined ? {} : { zones: clone(displayScene.zones) }),
      workspace: this.workspace,
      simulationState:
        this.replayFrame || record?.recording.state === "replaying"
          ? this.replayPaused
            ? "paused"
            : "running"
          : this.world.paused
            ? this.latest.tick === 0
              ? "ready"
              : "paused"
            : "running",
      interactionMode: interaction?.mode ?? "editor",
      alternativeInput: interaction?.alternativeInput ?? false,
      tick: this.replayFrame?.tick ?? this.latest.tick,
      simTimeSeconds: this.replayFrame
        ? this.replayFrame.tick / 60
        : this.latest.simulationTimeSeconds,
      runId: this.runId,
      objects,
      trajectoryStatus: this.pathStatus().status,
      pathRuns: this.pathRunner.view(),
      paint: interaction?.paint ?? null,
      listener: this.replayFrame
        ? {
            ...this.scene.listener,
            ...clone(this.replayFrame.listener),
            positionM: [...this.replayFrame.listener.positionM],
            orientationQuaternion: [...this.replayFrame.listener.orientationQuaternion],
            attachment: "independent",
          }
        : this.listener(),
      selectedObjectId: this.selected || null,
      selectedPathId: this.selectedPath,
      selectedEventId: this.selectedEvent,
      preview: this.staticPreview.getView(),
      paths: acousticFrames.flatMap((frame) =>
        frame.paths.map((path) => ({
          id: path.id,
          kind: path.order === 0 ? ("direct" as const) : ("reflection" as const),
          points: path.verticesM,
          distanceM: path.lengthM,
          delaySeconds: path.absoluteDelayS,
          gainLinear: path.bandGains[0] ?? 0,
          energyBands: path.bandGains.map((gain) => gain * gain),
          surfaceIds: path.surfaceIds,
          sourceId: path.sourceId,
          stale:
            frame.stale ||
            (this.replayFrame
              ? frame.poseTick !== this.replayFrame.tick
              : frame.sceneRevision !== this.scene.sceneRevision ||
                frame.poseTick !== this.latest.tick),
        })),
      ),
      events: this.viewProjection.events(
        displayingReplay
          ? this.replayEvents
          : [...this.eventLog, ...this.nativeAdmissionDiagnostics.events()]
              .sort((left, right) => left.tick - right.tick)
              .slice(-512),
      ),
      assets: this.projectAssets
        .filter(
          (asset) =>
            asset.storage === "externalFile" || asset.generator?.algorithm.startsWith("builtin-"),
        )
        .map((asset) => {
          const decoded = this.assets.find(
            (value) =>
              value.assetId === asset.assetId &&
              value.revision === asset.revision &&
              value.sha256 === asset.sha256,
          );
          return {
            id: asset.assetId,
            name: asset.name,
            provenance: `${asset.storage} · ${asset.rights.license}`,
            ...(decoded?.durationSeconds === undefined
              ? {}
              : { durationSeconds: decoded.durationSeconds }),
            status:
              decoded?.availability === "READY" && decoded.rightsStatus === "APPROVED"
                ? ("ready" as const)
                : ("pending" as const),
          };
        }),
      behaviors: this.viewProjection.behaviors(this.document).map((binding) => {
        return {
          ...binding,
          rules: binding.rules.map((rule) => ({
            ...rule,
            active:
              activeRuleStates
                .find((value) => value.bindingId === binding.bindingId)
                ?.activeRuleIds.includes(rule.id) ?? false,
            ...(!displayingReplay
              ? this.nativeAdmissionDiagnostics.ruleView(binding.bindingId, rule.id)
              : {}),
            ...(!displayingReplay
              ? this.behaviorDiagnostics.ruleView(
                  binding.bindingId,
                  rule.id,
                  !binding.bindingEnabled
                    ? "BINDING_DISABLED"
                    : !rule.enabled
                      ? "RULE_DISABLED"
                      : undefined,
                )
              : {}),
          })),
        };
      }),
      monitor: {
        bufferPreset: this.audioBufferPreset,
        rebuilding: this.audioRestarting,
        outputUnderrunEvents: audio?.outputUnderrunEvents ?? null,
        outputUnderrunSeconds: audio?.outputUnderrunSeconds ?? null,
        outputUnderrunStatus: audio?.outputUnderrunStatus ?? "NOT_AVAILABLE",
        outputLatencySeconds:
          audio?.enabled && audio.baseLatencySeconds !== null && audio.outputLatencySeconds !== null
            ? audio.baseLatencySeconds + audio.outputLatencySeconds
            : null,
        schedulingLookaheadSeconds: audio?.schedulingLookaheadSeconds ?? null,
        staleVoiceAdmissions: audio?.staleVoiceAdmissions ?? 0,
        lateReverb: { ...this.reverbSettings },
        state: !audio ? "blocked" : audio.lastError ? "error" : audio.muted ? "muted" : "audible",
        muted: audio?.muted ?? true,
        gainLinear: audio?.monitorGain ?? this.desiredMonitorGain,
        mode: audio?.monitorMode ?? this.desiredMonitorMode,
        activeVoices: audio?.activeVoices ?? 0,
        voiceLimit: audio?.budget.maxVoices ?? 16,
      },
      recording: record?.recording ?? {
        state: "idle",
        eventCount: 0,
        durationSeconds: 0,
        canReplay: false,
      },
      ai: {
        canUndo: this.agent.canUndo(),
        ...(this.agent?.getView() ?? {
          mode: "offline",
          status: "idle",
          message: "離線工具模式；沒有Meta模型呼叫。",
          canApply: false,
        }),
        selectedProvider: this.agentProvider,
        providerStatus: clone(this.providerStatus),
      },
      comparison: record?.comparison ?? {
        hasA: false,
        hasB: false,
        status: "先錄製同一物理軌跡",
        metrics: [],
      },
      acoustic: {
        backend: "Custom Web Geometric Core",
        model: "Numerical approximation · 一階有限面／零相位幅度",
        revision: firstFrame?.sceneRevision ?? null,
        state: this.acoustics.busy
          ? "pending"
          : acousticFrames.some(
                (frame) =>
                  frame.stale ||
                  frame.poseTick !== (this.replayFrame?.tick ?? this.latest.tick) ||
                  (!this.replayFrame && frame.sceneRevision !== this.scene.sceneRevision),
              )
            ? "stale"
            : acousticFrames.some((frame) => frame.pathAvailability === "failed")
              ? "error"
              : acousticFrames.some((frame) => frame.pathAvailability === "unsupported")
                ? displayAtmosphere.medium === "vacuum"
                  ? "unavailable"
                  : "unsupported"
                : firstFrame
                  ? "ready"
                  : "unsupported",
        ...(displayAtmosphere.medium === "air" &&
        (first?.diagnostics.speedOfSoundMps ?? displayAtmosphere.speedOfSoundMps) !== undefined
          ? {
              speedOfSoundMps: (first?.diagnostics.speedOfSoundMps ??
                displayAtmosphere.speedOfSoundMps)!,
            }
          : {}),
        ...(displayAtmosphere.temperatureC !== undefined
          ? { temperatureC: displayAtmosphere.temperatureC }
          : {}),
        medium: displayAtmosphere.medium,
        metrics: [
          {
            label: "直達延遲",
            value: firstFrame?.directDelayS ?? null,
            unit: "s",
            reason: displayAtmosphere.medium === "vacuum" ? "真空沒有空氣傳播" : "幾何距離/c",
          },
          { label: "RT60", value: null, unit: "s", reason: "未產生完整IR，無可擬合衰減" },
        ],
      },
      materialOptions: DEFAULT_MATERIALS.map((material) => ({
        id: material.id,
        label: material.label,
        dataClass: material.dataClass,
      })),
      pauseReason: this.pauseReason,
      notice: this.notice,
      error: this.error,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      ...(interaction?.ghost
        ? {
            placementGhost: {
              ...clone(interaction.ghost.draft),
              valid: interaction.ghost.valid,
              reason: interaction.ghost.reason,
              stage: interaction.pending ? ("pending" as const) : ("preview" as const),
              attachment: interaction.ghost.surfaceObjectId
                ? ("surface" as const)
                : ("air" as const),
            },
          }
        : {}),
    };
    for (const listener of this.subscribers) listener();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelRecordingPreparation("DISPOSED");
    ++this.replayGeneration;
    ++this.replayCancellation;
    this.replayPaused = true;
    ++this.previewIntent;
    this.experimentTools?.cancel();
    this.renderHost?.dispose();
    this.motion?.dispose();
    this.pathRunner?.dispose();
    this.recorder?.dispose();
    this.recordingEvaluation.dispose();
    this.interaction.dispose();
    this.releaseLiveMonitor();
    this.staticPreview.dispose();
    this.clearPreviewContacts();
    this.audio?.dispose();
    this.releaseTransportAssets("recording");
    this.releaseTransportAssets("replay");
    this.assetHost.dispose();
    this.acoustics.dispose();
    this.placementAcoustics.dispose();
    this.world.dispose();
    if (this.ownsBlobStore) this.blobStore.close();
    this.subscribers.clear();
  }
}
