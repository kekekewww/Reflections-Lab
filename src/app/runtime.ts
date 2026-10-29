import { applyCommand, createScene } from "../scene/index.js";
import type { SceneObject, SceneOperation, SceneSpec, Vec3 } from "../scene/types.js";
import { PhysicsWorld } from "../physics/index.js";
import type { PhysicsSnapshot } from "../physics/types.js";
import { createBehaviorRuntime } from "../audio-behavior/index.js";
import type {
  BehaviorAsset,
  BehaviorRuntime,
  BehaviorSnapshot,
  VoiceIntent,
} from "../audio-behavior/types.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { AudioEngine } from "../audio/index.js";
import type { VoiceInput, VoiceCursor } from "../audio/types.js";
import { solveAcoustics, SOLVER_VERSION } from "../acoustics/index.js";
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
import { RecordingHost } from "./recording-host.js";
import { AgentSession } from "./agent-session.js";
import { getProviderStatus } from "../ai/client.js";
import { AcousticService } from "./acoustic-service.js";
import { ViewProjection } from "./view-projection.js";
import { buildAcousticRequests } from "./acoustic-input.js";
import { RecordingProcessor } from "./recording-processor.js";
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
interface RuntimeOptions {
  storage?: StorageAdapter;
  useWorker?: boolean;
  blobStore?: BlobStore;
  assetStagingContext?: (sampleRate: number) => AssetStagingContext;
}
const clone = <T>(value: T): T => structuredClone(value);
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

/** Application composition root. Engines own their clocks and return copied domain data. */
export class LabRuntime implements LabController {
  private readonly workerEnabled: boolean;
  private scene: SceneSpec;
  private document: SoundBehaviorDocument;
  private world: PhysicsWorld;
  private behavior: BehaviorRuntime;
  private interaction!: InteractionHost;
  private recorder!: RecordingHost;
  private agent!: AgentSession;
  private experimentTools!: ExperimentToolHost;
  private agentProvider: AgentProvider = "offline";
  private providerStatus: AgentProviderStatusView = {
    status: "unknown",
    reason: "尚未查詢本機Meta provider狀態；未呼叫模型。",
  };
  private acoustics: AcousticService;
  private audio: AudioEngine | null = null;
  private staticPreview = new StaticPreviewHost({
    getEngine: () => this.audio,
    onChanged: () => {
      if (this.view && !this.disposed) this.publish();
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
  private recordingProcessor = new RecordingProcessor({ getAssets: () => this.assets });
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
  private redoStack: UndoEntry[] = [];
  private aiSceneTransactions = new Map<
    string,
    { before: UndoEntry; after: SoundBehaviorDocument; afterMetadata: ProjectEditorMetadata | null }
  >();
  private activeVoices = new Map<string, VoiceIntent>();
  private pendingAudio = new Map<string, PendingNativeVoice>();
  private solutions = new Map<string, AcousticSolution>();
  private eventLog: LabViewModel["events"] = [];
  private behaviorDiagnostics = new BehaviorDiagnostics();
  private nativeAdmissionDiagnostics = new NativeAdmissionDiagnostics();
  private notice = "選取物件編輯聲音行為；啟用聆聽後才建立音訊裝置。所有材質為 Synthetic 示範。";
  private error = "";
  private pauseReason = "";
  private atmosphere: Atmosphere = {
    medium: "air",
    speedOfSoundMps: 343,
    temperatureC: 20,
    bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
    dataClass: "Synthetic",
  };
  private busy = false;
  private fpsEntryGeneration = 0;
  private disposed = false;
  private lastSolve = -Infinity;
  private lastPublish = -Infinity;
  private clock = 0;

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
    this.workerEnabled = options.useWorker ?? true;
    this.scene = scene;
    this.world = world;
    this.latest = world.snapshot();
    this.document = createDefaultBehaviors(scene);
    this.behavior = this.newBehavior();
    this.acoustics = new AcousticService(options.useWorker ?? true);
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
  private initializeHosts(): void {
    this.interaction = new InteractionHost({
      getWorld: () => this.world,
      getScene: () => clone(this.scene),
      getListenerPose: () => ({
        positionM: [...this.scene.listener.positionM],
        orientationQuaternion: [...this.scene.listener.orientationQuaternion],
      }),
      commitSceneOperations: (operations, guard) => this.editScene(operations, guard),
      onChange: () => {
        if (this.view) this.publish();
      },
      onPause: (reason) => this.pauseCore(reason),
      onAudioFade: () => {
        if (this.audio) void this.audio.pause(this.currentSimulationTime());
      },
      onNotice: (message) => {
        this.notice = message;
        this.publish();
      },
      confirmGeometry: (objectId, revision) =>
        revision === this.scene.sceneRevision && this.world.getPose(objectId) !== undefined,
    });
    this.recorder = new RecordingHost({
      getConfig: () => this.recordingConfig(),
      ...(this.workerEnabled && typeof Worker !== "undefined"
        ? { sealRecording: (recorder) => this.blobStore.sealRecording(recorder) }
        : {}),
      reprocessFrame: (frame, changes, baseline) => this.reprocessFrame(frame, changes, baseline),
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
    });
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
  getRecordingArtifact() {
    return this.recorder.getArtifact();
  }
  getComparisonArtifacts() {
    return this.recorder.getSlots();
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
  private pauseCore(reason = "使用者暫停"): void {
    this.world.pause();
    this.behavior.setPaused(true);
    this.pauseReason = reason;
    if (this.audio) void this.audio.pause(this.currentSimulationTime());
    this.recorder?.pause();
  }
  private async drain(): Promise<void> {
    await this.stopPreviews();
    this.clearPreviewContacts();
    this.nativeAdmissionDiagnostics.clear();
    this.suspendedLiveAudio = null;
    this.restoreLiveAudioOnRun = null;
    this.acoustics.cancel("AUTHORING_CANCELLED");
    if (this.recorder?.getView().recording.state === "recording") {
      await this.recorder.interrupt("作者資料變更中斷目前錄製");
      await this.persistRecordings();
    }
    this.pauseCore("作者編輯：暫停並清理舊聲音");
    this.activeVoices.clear();
    this.pendingAudio.clear();
    this.solutions.clear();
    if (this.replayFrame || this.recorder.getView().recording.state === "replaying") {
      await this.replayAudio.stop();
      this.recorder.stopReplay();
      this.replayFrame = null;
      this.replayPoses.clear();
      this.recordedAcousticFrames = [];
    }
    if (this.audio) await this.audio.drainVoices();
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
      await this.recorder.interrupt("GRAVITY_MODE_CHANGED");
      await this.persistRecordings();
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
  advance(deltaSeconds: number): void {
    if (this.disposed) return;
    const previousTick = this.latest.tick;
    const previousReplayTick = this.replayFrame?.tick;
    this.clock += deltaSeconds;
    if (this.recorder.getView().recording.state === "replaying" && !this.replayPaused) {
      this.replayAccumulator += deltaSeconds;
      for (let i = 0; i < 4 && this.replayAccumulator >= 1 / 60; i++) {
        this.replayAccumulator -= 1 / 60;
        const frame = this.recorder.nextReplay();
        if (!frame) {
          this.replayPaused = true;
          this.recorder.pause();
          if (this.audio) void this.audio.pause(this.currentSimulationTime());
          this.pauseReason = "重播已結束並暫停音訊；可重播或返回即時場景。";
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
        const result = this.world.advance(deltaSeconds, (snapshot) => {
          this.latest = snapshot;
          this.onTick(snapshot);
          this.interaction.beforeStep();
        });
        this.alpha = result.alpha;
        this.latest = result.snapshot;
        if (result.overrun && this.world.clock.mode === "recording") {
          this.pauseCore("固定步負載超限，已暫停；未丟棄錄製 tick");
          this.notice =
            "錄製已暫停並保留固定步欠帳；可繼續逐批處理，或明確停止並封存目前連續資料。";
        } else if (result.overrun) {
          this.notice = `互動追趕上限：捨棄 ${result.droppedWallTimeSeconds.toFixed(3)} s 牆鐘時間；固定步長保持1/60 s。`;
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
      this.publish();
    }
  }
  private onTick(snapshot: PhysicsSnapshot): void {
    this.syncAudioListener();
    const capturing = this.recorder.getView().recording.state === "recording";
    const preStepSnapshot = capturing ? this.behavior.snapshot() : null;
    const preStepVoiceCursors = preStepSnapshot ? this.captureVoiceCursors(preStepSnapshot) : {};
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
    const voiceCursors = runtimeSnapshot ? this.captureVoiceCursors(runtimeSnapshot) : {};
    for (const event of snapshot.events)
      this.eventLog.push({
        id: event.eventId,
        tick: event.tick,
        timeSeconds: event.simulationTimeSeconds,
        type: event.type,
        objectId: event.objectId,
        positionM: event.positionMetres,
        detail: event.reason ?? "Rapier／已接受互動事件",
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
    this.eventLog = this.eventLog.slice(-512);
    let frames = [...this.solutions.values()]
      .map((solution) => solution.frame)
      .filter(
        (frame) =>
          frame.poseTick === snapshot.tick && frame.sceneRevision === this.scene.sceneRevision,
      );
    // During capture, record actual propagation at each recorded event tick.
    // Stop commands retain a diagnostic route without claiming another emission.
    if (capturing) {
      const events = new Map(
        [...this.activeVoices.values()].map((voice) => [voice.event.instanceId, voice.event]),
      );
      for (const event of result.events) events.set(event.instanceId, event);
      const sources = [...events.values()];
      frames = [];
      for (let start = 0; start < sources.length; start += 16) {
        frames.push(
          ...this.requests(snapshot.poses, sources.slice(start, start + 16)).map(
            (request) => solveAcoustics(request).frame,
          ),
        );
      }
    }
    if (capturing)
      this.recorder.appendFrame({
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
        acousticFrames: frames,
        acousticResultRefs: frames.map((frame) => frame.requestId),
        behaviorSnapshot: {
          inputFrame,
          preStepSnapshot,
          runtimeSnapshot,
          voiceIntents: result.voices,
          preStepVoiceCursors,
          voiceCursors,
          cursorModel: "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer",
        },
      });
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
      ? sourceEvents.map((event) => ({
          id: event.instanceId,
          objectId: event.objectId,
          positionM: event.positionMetres,
        }))
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
      this.replayFrame ||
      this.recorder?.getView().recording.state === "replaying"
    )
      return;
    const epoch = this.runEpoch,
      revision = this.scene.sceneRevision;
    try {
      this.syncAudioListener();
      const results = await this.acoustics.solve(this.requests());
      if (this.disposed || epoch !== this.runEpoch || revision !== this.scene.sceneRevision) return;
      if (results.some((solution) => this.latest.tick - solution.frame.poseTick > 3)) {
        this.notice = "聲學結果已超過3個固定步（20Hz更新窗口）；保留舊結果並標示過期，等待新解。";
        return;
      }
      this.solutions = new Map(results.map((solution) => [solution.frame.sourceId, solution]));
      for (const solution of results) this.audio?.updateFrame(solution.frame);
      for (const [key, pending] of this.pendingAudio) {
        const { input, intent } = pending;
        const solution = this.solutions.get(input.sourceId);
        if (!solution || this.world.paused) continue;
        const admission = this.audio?.playVoice(input, solution.frame);
        if (admission?.accepted) this.pendingAudio.delete(key);
        else if (admission) {
          this.nativeAdmissionDiagnostics.append({
            intent,
            voiceInput: input,
            admission,
            frame: solution.frame,
            behaviorDocumentRevision: pending.behaviorDocumentRevision,
            attemptedAtTick: this.latest.tick,
          });
          if (admission.reason !== "ACOUSTIC_FRAME_UNAVAILABLE") {
            this.notice = `音訊 admission：${admission.reason}`;
            this.pendingAudio.delete(key);
          }
        }
      }
      this.publish();
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
  private recordingConfig(): ExperimentRecorderOptions {
    return {
      runId: id("recording"),
      runEpoch: this.runEpoch,
      sceneSnapshot: clone(this.scene),
      sourceConfig: clone(this.scene.sources),
      behaviorConfig: clone(this.document),
      solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
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
      generatorConfig: this.document.profiles.map((profile) =>
        profile.rules.map((rule) => rule.generator),
      ),
      physicsConfig: { fixedDtS: 1 / 60, gravityMps2: this.scene.gravityMps2 },
      physicsVersion: "rapier-0.21.0",
      backendId: "custom-web-geometric",
      backendVersion: SOLVER_VERSION,
      fixedDtS: 1 / 60,
      sampleRateHz: 48000,
    };
  }
  private async reprocessFrame(
    frame: RecordingFrame,
    changes: ReprocessConfiguration,
    baseline: RecordingConfiguration,
  ): Promise<ReprocessedFrame> {
    return this.recordingProcessor.process(frame, changes, baseline);
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
    let bank: PreparedAssetBank | null = null;
    let candidateWorld: PhysicsWorld | null = null;
    const restored = new Map<string, RecordingArtifact>();
    try {
      bank = await this.assetHost.prepareProject(next);
      candidateWorld = await PhysicsWorld.create(next.scene);
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
    this.scene = next.scene;
    this.document = next.soundBehaviors;
    this.project = next;
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
    this.publish();
  }
  async dispatch(action: LabAction): Promise<void> {
    if (this.disposed) return;
    let ownsTransaction = false;
    try {
      switch (action.type) {
        case "cancelAI":
          this.experimentTools.cancel();
          this.agent.cancel();
          return;
        case "setAlternativeInput":
          this.interaction.setAlternativeInput(action.enabled);
          this.publish();
          return;
        case "inputKey":
          this.interaction.handleKey(action.code, action.pressed);
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
        case "pointerLockChanged":
          this.interaction.confirmPointerLock(action.locked);
          this.publish();
          return;
        case "inputBlur":
          this.fpsEntryGeneration++;
          void this.stopPreviews();
          this.interaction.suspend("失去焦點／輸入所有權");
          this.publish();
          return;
        case "exitFPS":
          this.fpsEntryGeneration++;
          this.interaction.exitFPS();
          this.notice = "已還原原本的 ScenePinned Listener；觀察相機不改變量測位置。";
          this.publish();
          return;
        case "stopPreview":
          await this.stopPreviews();
          this.publish();
          return;
      }
      if (this.busy) throw new Error("TRANSACTION_BUSY：請等待目前操作完成");
      this.busy = true;
      ownsTransaction = true;
      const fpsEntryGeneration = this.fpsEntryGeneration;
      this.error = "";
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
      )
        await this.stopPreviews();
      if (action.type === "enterFPS" && fpsEntryGeneration !== this.fpsEntryGeneration) return;
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
          if (this.replayFrame || this.recorder.getView().recording.state === "replaying") {
            this.recorder.resume();
            this.replayPaused = false;
            await this.replayAudio.resume();
            this.pauseReason = "";
            break;
          }
          this.replayPoses.clear();
          if (this.interaction.snapshot().mode !== "editor") {
            if (!this.interaction.resume()) break;
          } else this.world.resume();
          this.behavior.setPaused(false);
          this.recorder.resume();
          if (this.audio) await this.audio.resume(this.latest.simulationTimeSeconds);
          await this.restoreSuspendedLiveVoices();
          this.pauseReason = "";
          break;
        case "pause":
          this.replayPaused = true;
          if (!this.replayFrame && this.recorder.getView().recording.state !== "replaying")
            this.interaction.pausePreservingInputMode("使用者暫停");
          this.pauseCore();
          break;
        case "reset":
          await this.recorder.interrupt("RESET");
          await this.persistRecordings();
          await this.drain();
          this.world.reset(this.scene);
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
          break;
        case "undo":
          await this.restoreHistory(true);
          break;
        case "redo":
          await this.restoreHistory(false);
          break;
        case "addObject": {
          const object = this.newObject(action.shape);
          await this.editScene([{ type: "AddObject", object }]);
          this.selected = object.id;
          break;
        }
        case "duplicateObject": {
          const original = this.scene.objects.find((object) => object.id === action.objectId);
          if (!original) throw new Error("UNKNOWN_OBJECT");
          const object = {
            ...clone(original),
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
        case "setMonitorGain":
          this.audio?.setMonitorGain(action.gainLinear);
          this.staticPreview.syncMonitor();
          break;
        case "setMonitorMode":
          this.audio?.setMonitorMode(action.mode);
          this.staticPreview.syncMonitor();
          break;
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
            await this.recorder.stop();
            await this.persistRecordings();
            this.setClockMode("interactive");
          } else {
            this.world.pause();
            this.world.clock.setMode("recording");
            this.recorder.start();
            this.behavior.setPaused(false);
            this.world.resume();
            if (this.audio) await this.audio.resume(this.latest.simulationTimeSeconds);
          }
          break;
        case "replay":
          if (!this.recorder.getView().recording.canReplay) throw new Error("REPLAY_UNAVAILABLE");
          this.nativeAdmissionDiagnostics.clear();
          if (!this.suspendedLiveAudio) this.suspendedLiveAudio = this.captureLiveAudio();
          // Clear before native drains so their ended callbacks cannot terminate the saved logical voices.
          this.activeVoices.clear();
          this.pendingAudio.clear();
          this.pauseCore("已錄軌跡重播，未重新模擬物理");
          if (this.audio) await this.audio.drainVoices();
          this.activeVoices.clear();
          this.pendingAudio.clear();
          this.solutions.clear();
          this.replayFrame = null;
          this.replayPoses.clear();
          this.replayAccumulator = 0;
          await this.recorder.replay();
          const artifact = this.recorder.getArtifact();
          if (!artifact) throw new Error("NO_RECORDING");
          this.replayEvents = replayEventViews(artifact);
          await this.replayAudio.begin(artifact);
          this.recorder.resume();
          this.replayPaused = false;
          this.pauseReason = "重播已錄物理軌跡；未重新執行Rapier";
          break;
        case "stopReplay":
          this.nativeAdmissionDiagnostics.clear();
          await this.replayAudio.stop();
          this.recorder.stopReplay();
          this.replayPoses.clear();
          this.replayFrame = null;
          this.replayPaused = true;
          this.replayEvents = [];
          if (this.audio) await this.audio.drainVoices();
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
          this.syncAudioListener();
          this.pauseReason = "已返回暫停的即時場景；繼續時恢復原來源游標，不重發舊事件。";
          break;
        case "seek":
          if (!Number.isFinite(action.timeSeconds) || action.timeSeconds < 0)
            throw new Error("INVALID_SEEK_TIME");
          this.nativeAdmissionDiagnostics.clear();
          this.recorder.pause();
          this.replayPaused = true;
          if (this.audio) await this.audio.drainVoices();
          {
            const frame = this.recorder.seek(
              (this.recorder.getArtifact()?.startTick ?? 0) + Math.round(action.timeSeconds * 60),
            );
            await this.replayAudio.seek(frame);
            this.applyReplayFrame(frame, false);
          }
          this.pauseReason = "Seek已截斷舊尾音；按繼續從保存的來源游標重播，不重發舊撞擊。";
          break;
        case "captureComparison":
          this.pauseCore("建立同運動比較快照");
          await this.recorder.captureComparison(action.slot);
          await this.persistRecordings();
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
            if (action.mode === "fps-build") this.interaction.beginBuild(this.newObject("box"));
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
        case "enableStaged":
          await this.interaction.enableStaged();
          break;
        case "cancelPlacement":
          this.interaction.cancelPreview();
          break;
        case "setAtmosphere":
          await this.drain();
          this.atmosphere = {
            ...this.atmosphere,
            medium: action.medium,
            ...(action.temperatureC !== undefined
              ? {
                  temperatureC: action.temperatureC,
                  speedOfSoundMps: Math.sqrt(1.4 * 287.05 * (273.15 + action.temperatureC)),
                }
              : {}),
          };
          this.runEpoch = id("epoch");
          this.behavior = this.newBehavior();
          await this.solveCurrent();
          break;
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
        case "exportRecording": {
          const artifact = this.recorder.getArtifact();
          if (!artifact) throw new Error("NO_RECORDING：請先完成一次錄製");
          this.download(JSON.stringify(artifact), `${artifact.runId}.recording.json`);
          break;
        }
        case "frameSelected":
          this.notice = "使用Viewport的對準控制移動觀察相機，不改Listener。";
          break;
      }
    } catch (error) {
      this.fail(error, false);
    } finally {
      if (ownsTransaction) this.busy = false;
      if (!this.disposed) this.publish();
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
  private async enableAudio(): Promise<void> {
    if (this.audio?.getTelemetry().enabled) {
      this.audio.setMuted(false);
      this.staticPreview.syncMonitor();
      return;
    }
    if (!this.audio)
      this.audio = new AudioEngine({
        monitorGain: 0.18,
        // Native onended belongs to the renderer clock. Logical lifetimes and recorded
        // state change only during Behavior fixed steps; native cleanup stays in AudioEngine.
      });
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
    this.notice = "已啟用低音量監聽；請依實際裝置調整。dBFS未校準為dB SPL。";
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
    if (!saved || !this.audio) return;
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
    if (!this.audio) return;
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
    this.publish();
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
        reason: `${result.meta.reason}；Live validation ${result.meta.liveValidation}；剩餘額度未知。`,
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
  private captureVoiceCursors(snapshot: BehaviorSnapshot): Record<string, VoiceCursor> {
    const cursors: Record<string, VoiceCursor> = {};
    if (!this.audio) return cursors;
    const time = snapshot.state.tick * snapshot.state.fixedDtSeconds;
    for (const instance of snapshot.state.instances) {
      const cursor = this.audio.getVoiceCursor(instance.instanceId, time);
      if (cursor) cursors[instance.instanceId] = cursor;
    }
    return cursors;
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
    this.publish();
  }
  private assertLive(): void {
    if (this.disposed) throw new Error("DISPOSED：工作台已卸載，取消提交。");
  }
  private publish(): void {
    if (this.disposed) return;
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
    const objects = this.viewProjection.objects(displayScene, this.editorMetadata).map((object) => {
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
      projectId: this.project.projectId,
      ...(this.lastBehaviorEdit ? { lastBehaviorEdit: clone(this.lastBehaviorEdit) } : {}),
      projectName: this.project.name,
      sceneRevision: displayScene.sceneRevision,
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
        lateReverb: { ...this.reverbSettings },
        state: !audio ? "blocked" : audio.lastError ? "error" : audio.muted ? "muted" : "audible",
        muted: audio?.muted ?? true,
        gainLinear: audio?.monitorGain ?? 0.18,
        mode: audio?.monitorMode ?? "simulated",
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
              stage: "preview" as const,
            },
          }
        : interaction?.staged
          ? {
              placementGhost: {
                ...clone(
                  this.scene.objects.find((object) => object.id === interaction.staged!.objectId)!,
                ),
                valid: interaction.staged.geometryAcknowledged,
                reason: "Staged；確認後才啟用物理",
                stage: "staged" as const,
              },
            }
          : {}),
    };
    for (const listener of this.subscribers) listener();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.previewIntent;
    this.experimentTools?.cancel();
    this.interaction.dispose();
    this.staticPreview.dispose();
    this.clearPreviewContacts();
    this.audio?.dispose();
    this.acoustics.dispose();
    this.world.dispose();
    if (this.ownsBlobStore) this.blobStore.close();
    this.subscribers.clear();
  }
}
