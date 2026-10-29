import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { solveAcoustics } from "../acoustics/index.js";
import type { AcousticMaterial, Atmosphere, SolverBudget } from "../acoustics/types.js";
import { createBehaviorRuntime } from "../audio-behavior/index.js";
import type {
  BehaviorAsset,
  BehaviorFrame,
  BehaviorRuntime,
  BehaviorSnapshot,
  VoiceIntent,
} from "../audio-behavior/types.js";
import type { VoiceCursor } from "../audio/types.js";
import { canonicalStringify } from "../experiments/hash.js";
import type { ReprocessConfiguration, ReprocessedFrame } from "../experiments/reprocess.js";
import { RecordingError } from "../experiments/types.js";
import type { RecordingConfiguration, RecordingFrame } from "../experiments/types.js";
import { createScene } from "../scene/index.js";
import type { SceneSpec } from "../scene/types.js";
import { buildAcousticRequests } from "./acoustic-input.js";
import type { AcousticSourceInput } from "./acoustic-input.js";
import { makeBehaviorContext } from "./defaults.js";

export interface RecordedBehaviorSnapshot {
  inputFrame: BehaviorFrame;
  preStepSnapshot?: BehaviorSnapshot;
  runtimeSnapshot: BehaviorSnapshot;
  voiceIntents: VoiceIntent[];
  stateInitializationPolicy?: "restoredPreStepSnapshot" | "freshBehaviorReevaluation";
  /** Current logical voices only; original source identity maps to this candidate. */
  sourceInstanceMapping?: SourceInstanceMapping[];
  preStepVoiceCursors?: Record<string, VoiceCursor>;
  voiceCursors?: Record<string, VoiceCursor>;
  cursorModel?: "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer";
}
interface SourceInstanceMapping {
  baselineInstanceId: string;
  candidateInstanceId: string;
}
interface RunState {
  id: string;
  configuration: string;
  scene: SceneSpec;
  runtime: BehaviorRuntime;
  activeVoices: Map<string, AcousticSourceInput>;
  lastTick: number | null;
  fixedDtSeconds: number;
  stateInitializationPolicy: "restoredPreStepSnapshot" | "freshBehaviorReevaluation";
  sourceInstanceMapping: Map<string, string>;
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Stateful behavior reevaluation over authoritative motion, with one bounded current run. */
export class RecordingProcessor {
  private run: RunState | null = null;
  constructor(private readonly options: { getAssets(): BehaviorAsset[] }) {}

  async process(
    frame: RecordingFrame,
    changes: ReprocessConfiguration,
    baseline?: RecordingConfiguration,
  ): Promise<ReprocessedFrame> {
    const captured = frame.behaviorSnapshot;
    if (!record(captured) || !record(captured.inputFrame))
      throw new RecordingError(
        "CAPABILITY_UNSUPPORTED",
        "錄製缺少原始 BehaviorFrame；無法可靠重評行為。",
      );
    const inputFrame = structuredClone(captured.inputFrame) as unknown as BehaviorFrame;
    if (
      inputFrame.tick !== frame.tick ||
      inputFrame.sceneRevision !== frame.sceneRevision ||
      inputFrame.runEpoch !== frame.runEpoch
    )
      throw new RecordingError(
        "INPUT_PROVENANCE_MISMATCH",
        "BehaviorFrame 的 tick／revision／epoch 與錄製不同。",
      );
    if (
      !changes.sceneSnapshot ||
      !changes.behaviorConfig ||
      !changes.atmosphere ||
      !Array.isArray(changes.materialRegistry)
    )
      throw new RecordingError(
        "CAPABILITY_UNSUPPORTED",
        "重評需要明確的 scene、behavior、atmosphere 與 material registry。",
      );
    const signature = canonicalStringify({ changes, baseline: baseline ?? null });
    const savedState =
      record(captured.runtimeSnapshot) && record(captured.runtimeSnapshot.state)
        ? captured.runtimeSnapshot.state
        : null;
    if (!savedState || savedState.fixedDtSeconds === undefined)
      throw new RecordingError(
        "CAPABILITY_UNSUPPORTED",
        "錄製缺少原始 Behavior 固定步時鐘；不能假設時間或聲音壽命。",
      );
    if (
      savedState.tick !== frame.tick ||
      savedState.sceneRevision !== frame.sceneRevision ||
      savedState.runEpoch !== frame.runEpoch
    )
      throw new RecordingError(
        "INPUT_PROVENANCE_MISMATCH",
        "Behavior snapshot 的 tick／revision／epoch 與錄製不同。",
      );
    const fixedDtSeconds = savedState.fixedDtSeconds;
    if (
      typeof fixedDtSeconds !== "number" ||
      !Number.isFinite(fixedDtSeconds) ||
      fixedDtSeconds <= 0
    )
      throw new RecordingError("INVALID_FIXED_DT", "錄製固定步長無效。");
    if (baseline && baseline.fixedDtS !== fixedDtSeconds)
      throw new RecordingError(
        "INPUT_PROVENANCE_MISMATCH",
        "Behavior 固定步時鐘與原實驗配置不同。",
      );
    const budget = this.solverBudget(changes.solverConfig);
    let run = this.run;
    if (!run || run.id !== changes.runId) {
      const scene = createScene(changes.sceneSnapshot);
      // Use the captured generation verbatim. A current authoring binding for a
      // different generation must fail validation rather than being reconciled.
      const context = makeBehaviorContext(scene, inputFrame.objects, this.options.getAssets());
      context.materialIds = (changes.materialRegistry as AcousticMaterial[]).map(
        (material) => material.id,
      );
      const stateInitializationPolicy =
        baseline && this.sameSourceContent(changes, baseline)
          ? "restoredPreStepSnapshot"
          : "freshBehaviorReevaluation";
      if (!baseline && frame.tick > 1)
        throw new RecordingError(
          "CAPABILITY_UNSUPPORTED",
          "中途錄製的重評需要原始配置，才能確認聲源狀態的接續政策。",
        );
      run = {
        id: changes.runId,
        configuration: signature,
        scene,
        runtime: createBehaviorRuntime(changes.behaviorConfig as SoundBehaviorDocument, context, {
          experimentId: changes.runId,
          runEpoch: changes.runId,
          fixedDtSeconds,
          ...(stateInitializationPolicy === "freshBehaviorReevaluation"
            ? { randomSeed: scene.seed }
            : {}),
          maxVoices: 16,
          maxVoicesPerObject: 8,
        }),
        activeVoices: new Map(),
        lastTick: null,
        fixedDtSeconds,
        stateInitializationPolicy,
        sourceInstanceMapping: new Map(),
      };
      if (stateInitializationPolicy === "restoredPreStepSnapshot") {
        if (!record(captured.preStepSnapshot) || !record(captured.preStepSnapshot.state))
          throw new RecordingError(
            "CAPABILITY_UNSUPPORTED",
            "相同聲源的聲學重評需要真正的 step 前狀態；不能重啟已發聲內容。",
          );
        const preStepSnapshot = structuredClone(
          captured.preStepSnapshot,
        ) as unknown as BehaviorSnapshot;
        const initialTickZero =
          frame.tick === 0 &&
          preStepSnapshot.state.tick === 0 &&
          preStepSnapshot.state.sequence === 0 &&
          preStepSnapshot.inputCursor === null &&
          preStepSnapshot.paused === false &&
          preStepSnapshot.requiresNewEpoch === false &&
          Array.isArray(preStepSnapshot.state.instances) &&
          preStepSnapshot.state.instances.length === 0 &&
          Array.isArray(preStepSnapshot.voiceMetadata) &&
          preStepSnapshot.voiceMetadata.length === 0 &&
          Array.isArray(preStepSnapshot.state.processedEventIds) &&
          preStepSnapshot.state.processedEventIds.length === 0 &&
          Array.isArray(preStepSnapshot.state.bindings) &&
          preStepSnapshot.state.bindings.every(
            (binding) =>
              record(binding) &&
              Array.isArray(binding.activeRuleIds) &&
              binding.activeRuleIds.length === 0 &&
              Array.isArray(binding.cooldowns) &&
              binding.cooldowns.length === 0,
          );
        if (
          (preStepSnapshot.state.tick >= frame.tick && !initialTickZero) ||
          preStepSnapshot.state.runEpoch !== frame.runEpoch ||
          preStepSnapshot.state.sceneRevision !== frame.sceneRevision ||
          preStepSnapshot.state.fixedDtSeconds !== fixedDtSeconds ||
          preStepSnapshot.state.experimentId !== savedState.experimentId ||
          preStepSnapshot.state.documentId !== savedState.documentId ||
          preStepSnapshot.state.documentRevision !== savedState.documentRevision
        )
          throw new RecordingError(
            "INPUT_PROVENANCE_MISMATCH",
            "step 前狀態的時鐘／文件／epoch 與原錄製不同，或誤用了 step 後狀態。",
          );
        // Source instance IDs, playheads, event cursor, cooldowns and contact
        // anchors belong to captured content. Only the candidate run identity
        // and its scene revision change; no already emitted event is replayed.
        preStepSnapshot.state.experimentId = changes.runId;
        preStepSnapshot.state.runEpoch = changes.runId;
        preStepSnapshot.state.sceneRevision = scene.sceneRevision;
        run.runtime.restore(preStepSnapshot);
        run.sourceInstanceMapping = new Map(
          preStepSnapshot.state.instances.map((instance) => [
            instance.instanceId,
            instance.instanceId,
          ]),
        );
      }
    } else if (run.configuration !== signature || run.fixedDtSeconds !== fixedDtSeconds) {
      throw new RecordingError(
        "REPROCESS_CONFIGURATION_CHANGED",
        "同一 run 不能在重評中途變更配置或固定步長。",
      );
    }
    if (run.lastTick !== null && frame.tick !== run.lastTick + 1)
      throw new RecordingError(
        "REPROCESS_TICK_ORDER",
        "重評必須依連續錄製 tick 執行；新重評請使用新 run ID。",
      );
    this.validateMotion(frame, inputFrame, run.scene);
    inputFrame.sceneRevision = run.scene.sceneRevision;
    inputFrame.runEpoch = changes.runId;
    const before = run.runtime.snapshot();
    try {
      let preStepSourceMapping: SourceInstanceMapping[] | undefined;
      if (run.stateInitializationPolicy === "restoredPreStepSnapshot") {
        if (!record(captured.preStepSnapshot) || !record(captured.preStepSnapshot.state))
          throw new RecordingError(
            "CAPABILITY_UNSUPPORTED",
            "相同聲源重評的每個 tick 都需要原始 step 前狀態。",
          );
        preStepSourceMapping = this.verifySourceState(
          before,
          captured.preStepSnapshot as unknown as BehaviorSnapshot,
          run.sourceInstanceMapping,
          frame.tick,
        );
      }
      const result = run.runtime.step(inputFrame);
      const runtimeSnapshot = run.runtime.snapshot();
      const sourceInstanceMapping =
        run.stateInitializationPolicy === "restoredPreStepSnapshot"
          ? this.verifySourceState(
              runtimeSnapshot,
              captured.runtimeSnapshot as unknown as BehaviorSnapshot,
              run.sourceInstanceMapping,
              frame.tick,
            )
          : undefined;
      const nativeCursors =
        preStepSourceMapping !== undefined && sourceInstanceMapping !== undefined
          ? this.preserveNativeCursors(
              captured,
              captured.preStepSnapshot as unknown as BehaviorSnapshot,
              captured.runtimeSnapshot as unknown as BehaviorSnapshot,
              preStepSourceMapping,
              sourceInstanceMapping,
            )
          : {};
      // Retained one-shots need not issue an update intent each tick. Their
      // authoritative runtime instances still carry the actual contact anchor.
      const activeVoices = new Map(
        runtimeSnapshot.state.instances
          .filter((instance) => instance.playbackState === "playing")
          .map(
            (instance) =>
              [
                instance.instanceId,
                {
                  id: instance.instanceId,
                  objectId: instance.objectId,
                  positionM: instance.positionMetres,
                },
              ] as const,
          ),
      );
      const acousticFrames = buildAcousticRequests({
        scene: run.scene,
        poses: frame.poses,
        sources: [...activeVoices.values()],
        listener: frame.listener,
        tick: frame.tick,
        materials: changes.materialRegistry as AcousticMaterial[],
        atmosphere: changes.atmosphere as Atmosphere,
        ...(budget === undefined ? {} : { budget }),
      }).map((request) => solveAcoustics(request).frame);
      const output: ReprocessedFrame = {
        behaviorDecisions: result.decisions,
        audioEvents: result.events,
        acousticFrames,
        acousticResultRefs: acousticFrames.map((value) => value.requestId),
        behaviorSnapshot: {
          inputFrame,
          preStepSnapshot: before,
          runtimeSnapshot,
          voiceIntents: result.voices,
          stateInitializationPolicy: run.stateInitializationPolicy,
          ...(sourceInstanceMapping === undefined ? {} : { sourceInstanceMapping }),
          ...nativeCursors,
        } satisfies RecordedBehaviorSnapshot,
      };
      run.activeVoices = activeVoices;
      run.lastTick = frame.tick;
      if (sourceInstanceMapping !== undefined)
        run.sourceInstanceMapping = new Map(
          sourceInstanceMapping.map((pair) => [pair.baselineInstanceId, pair.candidateInstanceId]),
        );
      this.run = run;
      return structuredClone(output);
    } catch (error) {
      run.runtime.restore(before);
      throw error;
    }
  }

  private preserveNativeCursors(
    captured: Record<string, unknown>,
    preStepSnapshot: BehaviorSnapshot,
    postStepSnapshot: BehaviorSnapshot,
    preStepMapping: readonly SourceInstanceMapping[],
    postStepMapping: readonly SourceInstanceMapping[],
  ): Pick<RecordedBehaviorSnapshot, "preStepVoiceCursors" | "voiceCursors" | "cursorModel"> {
    if (captured.preStepVoiceCursors === undefined && captured.voiceCursors === undefined)
      return {};
    const model = "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer";
    if (captured.cursorModel !== model)
      throw new RecordingError(
        "INVALID_AUDIO_CURSOR",
        "原生 cursor 的模型來源未明，不能作為 B 的聲音位置。",
      );
    const copy = (
      value: unknown,
      snapshot: BehaviorSnapshot,
      mapping: readonly SourceInstanceMapping[],
    ) => {
      if (!record(value) || Object.keys(value).length > 16)
        throw new RecordingError(
          "INVALID_AUDIO_CURSOR",
          "原生 cursor 必須是有界的 instance 集合。",
        );
      const identities = new Map(
        mapping.map((entry) => [entry.baselineInstanceId, entry.candidateInstanceId]),
      );
      const result: Record<string, VoiceCursor> = {};
      const nonnegative = (number: unknown, maximum: number): number is number =>
        typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= maximum;
      for (const [id, cursor] of Object.entries(value)) {
        const targetId = identities.get(id);
        const instance = snapshot.state.instances.find((entry) => entry.instanceId === id);
        if (
          !targetId ||
          !instance ||
          !record(cursor) ||
          Object.keys(cursor).some(
            (key) =>
              ![
                "playheadSeconds",
                "elapsedSinceEmissionSeconds",
                "remainingDurationSeconds",
                "emissionEndElapsedSeconds",
              ].includes(key),
          ) ||
          !nonnegative(cursor.playheadSeconds, 1e9) ||
          !nonnegative(cursor.elapsedSinceEmissionSeconds, 1e9) ||
          (cursor.remainingDurationSeconds !== null &&
            !nonnegative(cursor.remainingDurationSeconds, 600)) ||
          (instance.kind === "oneShot" && cursor.remainingDurationSeconds === null) ||
          cursor.elapsedSinceEmissionSeconds >
            (snapshot.state.tick - instance.startedAtTick) * snapshot.state.fixedDtSeconds + 1e-5 ||
          cursor.playheadSeconds > cursor.elapsedSinceEmissionSeconds * 16 + 1e-5 ||
          (cursor.emissionEndElapsedSeconds !== undefined &&
            !nonnegative(cursor.emissionEndElapsedSeconds, 1e9))
        )
          throw new RecordingError(
            "INVALID_AUDIO_CURSOR",
            "原生 cursor 的來源、單位或時鐘不符錄製狀態。",
          );
        // These are the captured epoch-mapped native source seconds. Neither
        // Behavior's unpitched playhead nor propagation delay changes them.
        result[targetId] = structuredClone(cursor) as unknown as VoiceCursor;
      }
      return result;
    };
    return {
      cursorModel: model,
      ...(captured.preStepVoiceCursors === undefined
        ? {}
        : {
            preStepVoiceCursors: copy(
              captured.preStepVoiceCursors,
              preStepSnapshot,
              preStepMapping,
            ),
          }),
      ...(captured.voiceCursors === undefined
        ? {}
        : {
            voiceCursors: copy(captured.voiceCursors, postStepSnapshot, postStepMapping),
          }),
    };
  }

  private verifySourceState(
    actual: BehaviorSnapshot,
    captured: BehaviorSnapshot,
    previousIdentities: ReadonlyMap<string, string>,
    tick: number,
  ): SourceInstanceMapping[] {
    const fail: () => never = () => {
      throw new RecordingError(
        "SOURCE_STATE_MISMATCH",
        "相同聲源重評的狀態／邏輯播放位置與原錄製不同；不能宣稱 acoustic matched。",
      );
    };
    const normalize = (value: BehaviorSnapshot) => {
      const snapshot = structuredClone(value);
      if (
        !record(snapshot) ||
        !record(snapshot.state) ||
        !Array.isArray(snapshot.state.instances) ||
        !Array.isArray(snapshot.voiceMetadata) ||
        snapshot.state.instances.length > 16 ||
        snapshot.voiceMetadata.length !== snapshot.state.instances.length
      )
        fail();
      const instances: BehaviorSnapshot["state"]["instances"] = snapshot.state.instances;
      const metadata: BehaviorSnapshot["voiceMetadata"] = snapshot.voiceMetadata;
      const metadataById = new Map<string, BehaviorSnapshot["voiceMetadata"][number]>();
      for (const entry of metadata) {
        if (
          !record(entry) ||
          typeof entry.instanceId !== "string" ||
          metadataById.has(entry.instanceId)
        )
          fail();
        metadataById.set(entry.instanceId, entry);
      }
      const ids = new Map<string, { id: string; startedAtTick: number }>();
      const usedIds = new Set<string>();
      for (const instance of instances) {
        const entry = metadataById.get(instance.instanceId);
        if (!entry || usedIds.has(instance.instanceId)) fail();
        usedIds.add(instance.instanceId);
        const key = canonicalStringify([
          instance.bindingId,
          instance.ruleId,
          instance.objectId,
          instance.generation,
          instance.kind,
          instance.startedAtTick,
          entry.startEventId,
        ]);
        if (ids.has(key)) fail();
        ids.set(key, { id: instance.instanceId, startedAtTick: instance.startedAtTick });
        instance.instanceId = key;
        entry.instanceId = key;
      }
      if (usedIds.size !== metadataById.size) fail();
      instances.sort((a, b) =>
        a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
      );
      metadata.sort((a, b) =>
        a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
      );
      snapshot.state.experimentId = "normalized";
      snapshot.state.runEpoch = "normalized";
      snapshot.state.sceneRevision = 0;
      return { snapshot, ids };
    };
    const original = normalize(captured),
      candidate = normalize(actual);
    if (canonicalStringify(original.snapshot) !== canonicalStringify(candidate.snapshot)) fail();
    return [...original.ids.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, source]) => {
        const target = candidate.ids.get(key);
        if (!target) fail();
        const previous = previousIdentities.get(source.id);
        if (
          (previous !== undefined && previous !== target.id) ||
          (previous === undefined && source.startedAtTick !== tick)
        )
          fail();
        return { baselineInstanceId: source.id, candidateInstanceId: target.id };
      });
  }

  private sameSourceContent(
    changes: ReprocessConfiguration,
    baseline: RecordingConfiguration,
  ): boolean {
    return (
      canonicalStringify({
        behavior: changes.behaviorConfig,
        sceneSources: changes.sceneSnapshot?.sources,
        source: changes.sourceConfig === undefined ? baseline.sourceConfig : changes.sourceConfig,
        assets:
          changes.assetManifest === undefined ? baseline.assetManifest : changes.assetManifest,
        generator:
          changes.generatorConfig === undefined
            ? baseline.generatorConfig
            : changes.generatorConfig,
      }) ===
      canonicalStringify({
        behavior: baseline.behaviorConfig,
        sceneSources: baseline.sceneSnapshot.sources,
        source: baseline.sourceConfig,
        assets: baseline.assetManifest,
        generator: baseline.generatorConfig,
      })
    );
  }

  private validateMotion(frame: RecordingFrame, input: BehaviorFrame, scene: SceneSpec): void {
    if (
      !Array.isArray(input.objects) ||
      input.objects.length !== frame.poses.length ||
      input.objects.length !== scene.objects.length
    )
      throw new RecordingError("INPUT_MOTION_MISMATCH", "重評物件集合必須與原運動及 scene 相同。");
    for (const pose of frame.poses) {
      const object = input.objects.find((value) => value.objectId === pose.objectId);
      if (
        !object ||
        !scene.objects.some((value) => value.id === pose.objectId) ||
        canonicalStringify(object.positionMetres) !== canonicalStringify(pose.positionM) ||
        (object.rotation !== undefined &&
          canonicalStringify(object.rotation) !== canonicalStringify(pose.orientationQuaternion))
      )
        throw new RecordingError(
          "INPUT_MOTION_MISMATCH",
          "BehaviorFrame 的位置／旋轉與原錄製 motion 不同。",
        );
    }
  }

  private solverBudget(configuration: unknown): SolverBudget | undefined {
    if (configuration === undefined) return undefined;
    if (
      !record(configuration) ||
      (configuration.backendId !== undefined &&
        configuration.backendId !== "custom-web-geometric") ||
      (configuration.maxReflectionOrder !== undefined && configuration.maxReflectionOrder !== 1)
    )
      throw new RecordingError("CAPABILITY_UNSUPPORTED", "目前重評只支援一階有限面求解器。");
    const budget: SolverBudget = {};
    for (const key of [
      "maxPaths",
      "maxSurfaces",
      "maxSegmentTests",
      "maxPropagationSeconds",
      "minimumDistanceM",
    ] as const) {
      if (configuration[key] !== undefined) {
        if (typeof configuration[key] !== "number")
          throw new RecordingError("INVALID_SOLVER_CONFIG", "聲學預算必須為數值。");
        budget[key] = configuration[key];
      }
    }
    return budget;
  }
}
