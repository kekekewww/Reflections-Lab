import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { AgentError, type ToolRequest } from "../ai/types.js";
import { validateToolRequest } from "../ai/validation.js";
import { solveAcoustics, SOLVER_VERSION } from "../acoustics/index.js";
import type { AcousticFrame, AcousticMaterial, Atmosphere } from "../acoustics/types.js";
import { createBehaviorRuntime } from "../audio-behavior/index.js";
import type { BehaviorAsset } from "../audio-behavior/types.js";
import {
  canonicalBytes,
  canonicalStringify,
  compareRecordings,
  collectRecordingPathSamples,
  compatiblePathMetricPopulation,
  ExperimentRecorder,
  immutableClone,
  pathMetricPopulation,
  reprocessRecording,
  sha256Canonical,
  verifyRecording,
} from "../experiments/index.js";
import type { ExperimentRecorderOptions, RecordingArtifact } from "../experiments/types.js";
import { PhysicsWorld } from "../physics/index.js";
import type { PhysicsSnapshot } from "../physics/types.js";
import { createScene } from "../scene/index.js";
import type { SceneSpec } from "../scene/types.js";
import { buildAcousticRequests } from "./acoustic-input.js";
import { reconcileBehaviors } from "./behavior-editor.js";
import { makeBehaviorContext } from "./defaults.js";
import { toBehaviorFrame } from "./physics-behavior.js";
import { RecordingProcessor } from "./recording-processor.js";

export type ExperimentMetricId =
  | "directArrivalTimeS"
  | "rt60S"
  | "edtS"
  | "t20S"
  | "t30S"
  | "drrDb"
  | "c50Db"
  | "c80Db";
export type ExperimentToolState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelRequested"
  | "canceled"
  | "timedOut"
  | "budgetExceeded";
export interface ExperimentMetricRecord {
  metricRecordId: string;
  metricId: ExperimentMetricId;
  bandCenterHz: number | null;
  value: number | null;
  unit: "s" | "dB_ratio";
  availability: "available" | "unsupported" | "missingArtifact";
  provenance: "computed";
  evidenceArtifactId: string;
  runId: string;
  methodId: string;
  backendVersion: string;
  materialRevision: number;
  validationLevel: "V1";
  limitations: string[];
}
export interface ExperimentToolResult {
  schemaVersion: "1.0.0";
  requestId: string;
  state: ExperimentToolState;
  runId: string | null;
  sceneRevision: number;
  artifactIds: string[];
  metrics: ExperimentMetricRecord[];
  error: {
    code: string;
    message: string;
    retryable: false;
    fieldPaths: string[];
    retryAfterMs: null;
    detailsArtifactId: null;
  } | null;
  usage: {
    wallTimeMs: number;
    solverSteps: number;
    inputTokens: null;
    outputTokens: null;
    estimatedCostUsd: 0;
    actualCostUsd: 0;
  };
  explanation: null;
}
export interface ExperimentToolLimits {
  maxRuns: number;
  maxToolCalls: number;
  wallTimeMs: number;
  maxTraceBytes: number;
  maxStoredBytes: number;
  yieldEverySteps: number;
}
export const EXPERIMENT_TOOL_LIMITS: Readonly<ExperimentToolLimits> = Object.freeze({
  maxRuns: 6,
  maxToolCalls: 48,
  wallTimeMs: 120000,
  maxTraceBytes: 32 * 1024 * 1024,
  maxStoredBytes: 64 * 1024 * 1024,
  yieldEverySteps: 8,
});
export interface ExperimentToolOptions {
  /** Trusted host snapshot. It is copied before a run and cannot be changed by a tool. */
  getConfiguration(): ExperimentRecorderOptions;
  getAssets(): BehaviorAsset[];
  getRecording?(runId: string): RecordingArtifact | null;
  persistRecording?(artifact: RecordingArtifact): Promise<void>;
  /** Resolve an actual staged transaction. Omission never substitutes the current scene. */
  getPreviewScene?(transactionId: string): SceneSpec | null;
  now?(): number;
  yieldControl?(): Promise<void>;
  limits?: Partial<ExperimentToolLimits>;
  onChange?(): void;
}
export interface ExperimentToolLedgerEntry {
  requestId: string;
  tool: ToolRequest["tool"];
  state: ExperimentToolState;
  runId: string | null;
  solverSteps: number;
  wallTimeMs: number;
  artifactIds: string[];
  errorCode: string | null;
}
export interface ExperimentToolArtifact {
  id: string;
  sha256: string;
  kind: "recording" | "capture" | "comparison" | "preview";
  data: unknown;
}
interface Operation {
  request: ToolRequest;
  startedAt: number;
  runId: string | null;
  solverSteps: number;
  cancelRequested: boolean;
}
interface CapturedExperiment {
  experimentId: string;
  runId: string;
  label: string;
  recordingArtifactId: string;
  recordingSha256: string;
  provenance: "Computed";
}
const clone = <T>(value: T): T => structuredClone(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const FIXED_DT = 1 / 60;
const BACKEND = "custom-web-geometric";
const LOCAL_LIMITATION =
  "本機 Rapier／Behavior／幾何聲學的 Computed 結果；未建立音訊裝置，非聽測、房間量測或 Meta live 證據。";
const ERROR_CODES = new Set([
  "SCHEMA_INVALID",
  "DOMAIN_INVALID",
  "UNKNOWN_ID",
  "REVISION_CONFLICT",
  "POLICY_DENIED",
  "PREVIEW_REQUIRED",
  "APPROVAL_REQUIRED",
  "PROVIDER_UNVERIFIED",
  "MODEL_UNAVAILABLE",
  "CAPABILITY_UNSUPPORTED",
  "QUOTA_EXCEEDED",
  "BUDGET_EXCEEDED",
  "TIMEOUT",
  "CANCELED",
  "SOLVER_FAILED",
  "INSUFFICIENT_DATA",
  "INCOMPATIBLE_EXPERIMENTS",
  "INTERNAL_ERROR",
]);

/** A local bounded tool executor. Artifacts are referenced, never inlined into model results. */
export class ExperimentToolHost {
  readonly limits: Readonly<ExperimentToolLimits>;
  private readonly requests = new Map<
    string,
    { payload: string; result: Promise<ExperimentToolResult> }
  >();
  private readonly ledger = new Map<string, ExperimentToolLedgerEntry>();
  private readonly runs = new Map<string, RecordingArtifact>();
  private readonly artifacts = new Map<string, ExperimentToolArtifact>();
  private readonly captures = new Map<string, CapturedExperiment>();
  private readonly metricRecords = new Map<string, ExperimentMetricRecord>();
  private active: Operation | null = null;
  private runsUsed = 0;
  private storedBytes = 0;

  constructor(private readonly options: ExperimentToolOptions) {
    const limits = { ...EXPERIMENT_TOOL_LIMITS, ...options.limits };
    for (const key of Object.keys(limits) as (keyof ExperimentToolLimits)[]) {
      if (
        !Object.hasOwn(EXPERIMENT_TOOL_LIMITS, key) ||
        !Number.isSafeInteger(limits[key]) ||
        limits[key] < 1 ||
        limits[key] > EXPERIMENT_TOOL_LIMITS[key]
      )
        throw new AgentError("DOMAIN_INVALID", `無效的本機實驗預算：${key}`);
    }
    this.limits = Object.freeze(limits);
  }
  private now(): number {
    return this.options.now?.() ?? performance.now();
  }
  private changed(): void {
    this.options.onChange?.();
  }
  private check(operation: Operation): void {
    if (operation.cancelRequested)
      throw new AgentError("CANCELED", "實驗已安全取消；未發布完成結果。");
    if (this.now() - operation.startedAt >= this.limits.wallTimeMs)
      throw new AgentError("TIMEOUT", "實驗達牆鐘時間上限；未發布完成結果。");
  }
  private async yield(operation: Operation): Promise<void> {
    await (this.options.yieldControl?.() ?? new Promise<void>((resolve) => setTimeout(resolve, 0)));
    this.check(operation);
  }
  private update(
    operation: Operation,
    state: ExperimentToolState,
    artifactIds: string[] = [],
    errorCode: string | null = null,
  ): void {
    this.ledger.set(operation.request.requestId, {
      requestId: operation.request.requestId,
      tool: operation.request.tool,
      state,
      runId: operation.runId,
      solverSteps: operation.solverSteps,
      wallTimeMs: Math.max(0, this.now() - operation.startedAt),
      artifactIds: [...artifactIds],
      errorCode,
    });
    this.changed();
  }
  private result(
    operation: Operation,
    state: ExperimentToolState,
    artifactIds: string[] = [],
    metrics: ExperimentMetricRecord[] = [],
    error?: { code: string; message: string },
  ): ExperimentToolResult {
    return immutableClone({
      schemaVersion: "1.0.0",
      requestId: operation.request.requestId,
      state,
      runId: operation.runId,
      sceneRevision: operation.request.expectedSceneRevision,
      artifactIds,
      metrics,
      error: error
        ? {
            ...error,
            retryable: false,
            fieldPaths: [],
            retryAfterMs: null,
            detailsArtifactId: null,
          }
        : null,
      usage: {
        wallTimeMs: Math.max(0, this.now() - operation.startedAt),
        solverSteps: operation.solverSteps,
        inputTokens: null,
        outputTokens: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
      },
      explanation: null,
    });
  }
  execute(input: unknown): Promise<ExperimentToolResult> {
    const request = validateToolRequest(input);
    const payload = canonicalStringify(request);
    const old = this.requests.get(request.requestId);
    if (old) {
      if (old.payload !== payload)
        return Promise.reject(
          new AgentError("DOMAIN_INVALID", "同一 requestId 不能改變請求內容。"),
        );
      return old.result.then(clone);
    }
    if (this.requests.size >= this.limits.maxToolCalls)
      return Promise.reject(new AgentError("BUDGET_EXCEEDED", "本次實驗工具呼叫已達上限。"));
    // Install the identity promise before callbacks can synchronously re-enter the host.
    const result = Promise.resolve().then(() => this.perform(request));
    this.requests.set(request.requestId, { payload, result });
    return result.then(clone);
  }
  private async perform(request: ToolRequest): Promise<ExperimentToolResult> {
    const operation: Operation = {
      request,
      startedAt: this.now(),
      runId: null,
      solverSteps: 0,
      cancelRequested: false,
    };
    this.update(operation, "queued");
    try {
      const current = clone(this.options.getConfiguration());
      if (
        request.sceneId !== current.sceneSnapshot.sceneId ||
        request.expectedSceneRevision !== current.sceneSnapshot.sceneRevision
      )
        throw new AgentError(
          "REVISION_CONFLICT",
          "實驗請求的 Scene ID／revision 與目前工作台不同。",
        );
      this.check(operation);
      let artifactIds: string[],
        metrics: ExperimentMetricRecord[] = [];
      if (request.tool === "RunSimulation") {
        if (this.active)
          throw new AgentError("BUDGET_EXCEEDED", "同時只允許一個模擬；請等待或取消目前工作。");
        if (this.runsUsed >= this.limits.maxRuns)
          throw new AgentError("BUDGET_EXCEEDED", "本次最多六次模擬。");
        this.runsUsed++;
        this.active = operation;
        operation.runId = `run.tool.${(await sha256Canonical(request)).slice(0, 40)}`;
        this.check(operation);
        this.update(operation, "running");
        const recording = await this.simulate(operation, current);
        this.check(operation);
        await verifyRecording(recording);
        this.check(operation);
        const candidate = await this.recordingArtifact(recording);
        this.checkStorage(candidate);
        if (this.options.persistRecording) await this.options.persistRecording(recording);
        this.check(operation);
        this.checkStorage(candidate);
        this.commitArtifact(candidate);
        this.runs.set(recording.runId, recording);
        artifactIds = [candidate.id];
      } else if (request.tool === "CaptureExperiment") {
        const recording = await this.recording(String(request.arguments.runId));
        operation.runId = recording.runId;
        const reference = await this.recordingArtifact(recording);
        const experimentId = `experiment.${(await sha256Canonical({ runId: recording.runId, sha256: recording.artifactSha256, label: request.arguments.label })).slice(0, 40)}`;
        const captured: CapturedExperiment = {
          experimentId,
          runId: recording.runId,
          label: String(request.arguments.label),
          recordingArtifactId: reference.id,
          recordingSha256: recording.artifactSha256,
          provenance: "Computed",
        };
        const capture = await this.artifact("capture", captured, experimentId);
        this.checkStorage(reference, capture);
        if (this.options.persistRecording) await this.options.persistRecording(recording);
        this.check(operation);
        this.checkStorage(reference, capture);
        this.commitArtifact(reference);
        this.commitArtifact(capture);
        this.captures.set(experimentId, immutableClone(captured));
        artifactIds = [experimentId, reference.id];
      } else if (request.tool === "AnalyzeAcousticResults") {
        const recording = await this.recording(String(request.arguments.runId));
        operation.runId = recording.runId;
        const reference = await this.recordingArtifact(recording);
        this.checkStorage(reference);
        metrics = await this.analyze(
          recording,
          request.arguments.metrics as ExperimentMetricId[],
          request.arguments.bandCentersHz as number[],
          reference.id,
        );
        this.check(operation);
        this.checkStorage(reference);
        this.commitArtifact(reference);
        for (const metric of metrics)
          this.metricRecords.set(metric.metricRecordId, immutableClone(metric));
        artifactIds = [reference.id];
      } else if (request.tool === "CompareExperiments") {
        const left = this.captures.get(String(request.arguments.baselineExperimentId)),
          right = this.captures.get(String(request.arguments.candidateExperimentId));
        if (!left || !right)
          throw new AgentError("UNKNOWN_ID", "比較只能引用 CaptureExperiment 建立的實驗 ID。");
        const [a, b] = await Promise.all([this.recording(left.runId), this.recording(right.runId)]);
        const comparison = await compareRecordings(a, b, {
          kind: "acoustic",
          independentVariables: ["acousticMaterial"],
        });
        if (!comparison.matched)
          throw new AgentError(
            "INCOMPATIBLE_EXPERIMENTS",
            `比較條件不同：${comparison.mismatches.map((value) => value.field).join(", ")}`,
          );

        operation.runId = b.runId;
        const requested = request.arguments.metrics as ExperimentMetricId[];
        const aReference = await this.recordingArtifact(a),
          bReference = await this.recordingArtifact(b);
        const bands = [125, 250, 500, 1000, 2000, 4000];
        const [aMetrics, bMetrics] = await Promise.all([
          this.analyze(a, requested, bands, aReference.id),
          this.analyze(b, requested, bands, bReference.id),
        ]);
        const pairs = bMetrics.map((candidate, index) => {
          const baseline = aMetrics[index]!;
          const samplesA = collectRecordingPathSamples(a, candidate.bandCenterHz),
            samplesB = collectRecordingPathSamples(b, candidate.bandCenterHz);
          const methodCompatible = candidate.methodId === baseline.methodId;
          const populationCompatible =
            candidate.metricId !== "directArrivalTimeS" ||
            compatiblePathMetricPopulation(samplesA, samplesB, "directDelay");
          return {
            metricId: candidate.metricId,
            bandCenterHz: candidate.bandCenterHz,
            baselineMetricRecordId: baseline.metricRecordId,
            candidateMetricRecordId: candidate.metricRecordId,
            a: baseline.value,
            b: candidate.value,
            delta:
              !methodCompatible ||
              !populationCompatible ||
              baseline.value === null ||
              candidate.value === null
                ? null
                : candidate.value - baseline.value,
            unit: candidate.unit,
            methodId: candidate.methodId,
            ...(candidate.metricId === "directArrivalTimeS"
              ? {
                  population: {
                    a: pathMetricPopulation(samplesA, "directDelay"),
                    b: pathMetricPopulation(samplesB, "directDelay"),
                    compatible: methodCompatible && populationCompatible,
                  },
                }
              : {}),
            reason: !methodCompatible
              ? "INCOMPATIBLE_METRIC_METHOD"
              : !populationCompatible
                ? "INCOMPATIBLE_METRIC_POPULATION"
                : baseline.value === null || candidate.value === null
                  ? "VALID_SUPPORTED_ARTIFACT_REQUIRED"
                  : null,
          };
        });
        const artifact = await this.artifact("comparison", {
          comparison,
          pairs,
          provenance: "Computed",
          validationLevel: "V1",
          limitations: [
            LOCAL_LIMITATION,
            "只允許 acousticMaterial 自變項；時間差保存在配對 artifact，非誤標為非負絕對時間。",
          ],
        });
        this.checkStorage(aReference, bReference, artifact);
        this.check(operation);
        this.commitArtifact(aReference);
        this.commitArtifact(bReference);
        this.commitArtifact(artifact);
        for (const metric of [...aMetrics, ...bMetrics])
          this.metricRecords.set(metric.metricRecordId, immutableClone(metric));
        metrics = bMetrics;
        artifactIds = [artifact.id, aReference.id, bReference.id].filter(
          (value, index, array) => array.indexOf(value) === index,
        );
      } else if (request.tool === "PreviewSceneChanges") {
        artifactIds = [await this.preview(operation)];
      } else
        throw new AgentError(
          "POLICY_DENIED",
          "此入口只執行受限的實驗／分析工具。場景變更必須先預覽及套用。",
        );
      this.update(operation, "succeeded", artifactIds);
      return this.result(operation, "succeeded", artifactIds, metrics);
    } catch (error) {
      const original =
        isRecord(error) && typeof error.code === "string"
          ? error.code
          : error instanceof Error && "code" in error
            ? String(error.code)
            : "INTERNAL_ERROR";
      const code = ERROR_CODES.has(original)
        ? original
        : original.includes("BUDGET")
          ? "BUDGET_EXCEEDED"
          : "SOLVER_FAILED";
      const state =
        code === "CANCELED"
          ? "canceled"
          : code === "TIMEOUT"
            ? "timedOut"
            : code === "BUDGET_EXCEEDED"
              ? "budgetExceeded"
              : "failed";
      const message =
        error instanceof AgentError
          ? error.message
          : "實驗未完成；已保留失敗狀態，未發布可分析的完成 artifact。";
      this.update(operation, state, [], code);
      return this.result(operation, state, [], [], { code, message });
    } finally {
      if (this.active === operation) this.active = null;
    }
  }
  private async simulate(
    operation: Operation,
    current: ExperimentRecorderOptions,
  ): Promise<RecordingArtifact> {
    const args = operation.request.arguments;
    if (
      !["custom-web", BACKEND].includes(String(args.backendId)) ||
      args.timeStepS !== FIXED_DT ||
      ![0, 1].includes(Number(args.maxReflectionOrder))
    )
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "本機模擬只支援 custom-web（明示別名）／custom-web-geometric、1/60 秒及零／一階反射。參數未被自動改寫。",
      );
    const steps = Number(args.durationS) / FIXED_DT;
    if (Math.abs(steps - Math.round(steps)) > 1e-9)
      throw new AgentError("DOMAIN_INVALID", "durationS 必須是 1/60 秒的整數倍；不靜默四捨五入。");
    if (
      !isRecord(current.behaviorConfig) ||
      !Array.isArray(current.materialRegistry) ||
      !isRecord(current.atmosphere)
    )
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "實驗需要實際的 Behavior、材質與 atmosphere 配置。",
      );
    if (args.replayTraceId !== null) return this.replay(operation, current);
    const scene = createScene({ ...clone(current.sceneSnapshot), seed: Number(args.seed) });
    this.check(operation);
    const world = await PhysicsWorld.create(scene, {
      fixedDtSeconds: FIXED_DT,
      clockMode: "recording",
    });
    try {
      this.check(operation);
      const assets = clone(this.options.getAssets());
      const document = reconcileBehaviors(
        current.behaviorConfig as unknown as SoundBehaviorDocument,
        scene,
        world.snapshot().poses,
      );
      const behavior = createBehaviorRuntime(
        document,
        makeBehaviorContext(scene, world.snapshot().poses, assets),
        {
          experimentId: operation.runId!,
          runEpoch: operation.runId!,
          fixedDtSeconds: FIXED_DT,
          randomSeed: Number(args.seed),
          maxVoices: 16,
          maxVoicesPerObject: 8,
        },
      );
      const configuration = this.configuration(current, scene, document, operation);
      const recorder = new ExperimentRecorder(configuration);
      const append = (snapshot: PhysicsSnapshot): void => {
        this.check(operation);
        const preStepSnapshot = behavior.snapshot(),
          inputFrame = toBehaviorFrame(snapshot, operation.runId!);
        const result = behavior.step(inputFrame),
          runtimeSnapshot = behavior.snapshot();
        const sources = new Map(
          runtimeSnapshot.state.instances
            .filter((instance) => instance.playbackState === "playing")
            .map((instance) => [
              instance.instanceId,
              {
                id: instance.instanceId,
                objectId: instance.objectId,
                positionM: instance.positionMetres,
              },
            ]),
        );
        // A stop command may retain a diagnostic route without being another emission.
        for (const event of result.events)
          sources.set(event.instanceId, {
            id: event.instanceId,
            objectId: event.objectId,
            positionM: event.positionMetres,
          });
        const acousticFrames: AcousticFrame[] = [];
        const inputs = [...sources.values()];
        for (let i = 0; i < inputs.length; i += 16) {
          const requests = buildAcousticRequests({
            scene,
            poses: snapshot.poses,
            sources: inputs.slice(i, i + 16),
            listener: scene.listener,
            tick: snapshot.tick,
            materials: current.materialRegistry as AcousticMaterial[],
            atmosphere: current.atmosphere as Atmosphere,
          });
          for (const request of requests) {
            const query =
              args.maxReflectionOrder === 0
                ? {
                    ...request,
                    surfaces: request.surfaces.map((surface) => ({
                      ...surface,
                      role: "dynamicOccluder" as const,
                    })),
                  }
                : request;
            const solution = solveAcoustics(query);
            if (solution.diagnostics.budgetExceeded)
              throw new AgentError(
                "BUDGET_EXCEEDED",
                "聲學查詢超過固定求解預算；未發布不完整 run。",
              );
            acousticFrames.push(solution.frame);
          }
        }
        recorder.appendFrame({
          tick: snapshot.tick,
          sceneRevision: scene.sceneRevision,
          runEpoch: operation.runId!,
          poses: snapshot.poses.map((pose) => ({
            objectId: pose.objectId,
            positionM: pose.positionMetres,
            orientationQuaternion: pose.rotation,
            linearVelocityMps: pose.linearVelocityMetresPerSecond,
            angularVelocityRadps: pose.angularVelocityRadiansPerSecond,
          })),
          listener: scene.listener,
          physicsEvents: snapshot.events,
          behaviorDecisions: result.decisions,
          audioEvents: result.events,
          acousticFrames,
          acousticResultRefs: acousticFrames.map((frame) => frame.requestId),
          behaviorSnapshot: {
            inputFrame,
            preStepSnapshot,
            runtimeSnapshot,
            voiceIntents: result.voices,
            cursorModel:
              "NOT_RENDERED: logical behavior state only; no native PCM cursor or audio playback evidence",
          },
        });
      };
      behavior.setPaused(false);
      append(world.snapshot());
      world.resume();
      for (let index = 0; index < Math.round(steps); index++) {
        append(world.step());
        operation.solverSteps++;
        if (operation.solverSteps % this.limits.yieldEverySteps === 0) {
          this.update(operation, "running");
          await this.yield(operation);
        }
      }
      this.check(operation);
      return await recorder.finish();
    } finally {
      world.dispose();
    }
  }
  private configuration(
    current: ExperimentRecorderOptions,
    scene: SceneSpec,
    document: SoundBehaviorDocument,
    operation: Operation,
  ): ExperimentRecorderOptions {
    return {
      ...current,
      runId: operation.runId!,
      runEpoch: operation.runId!,
      createdAt: new Date().toISOString(),
      sceneSnapshot: scene,
      behaviorConfig: document,
      sourceConfig: clone(current.sourceConfig),
      generatorConfig: document.profiles.map((profile) =>
        profile.rules.map((rule) => rule.generator),
      ),
      physicsConfig: {
        fixedDtS: FIXED_DT,
        gravityMps2: scene.gravityMps2,
        seed: scene.seed,
        objects: scene.objects.map(
          ({ id, mode, massKg, friction, restitution, physicsMaterialId }) => ({
            id,
            mode,
            massKg,
            friction,
            restitution,
            physicsMaterialId,
          }),
        ),
      },
      backendId: BACKEND,
      backendVersion: SOLVER_VERSION,
      fixedDtS: FIXED_DT,
      sampleRateHz: operation.request.arguments.sampleRateHz as 44100 | 48000,
      solverConfig: {
        backendId: BACKEND,
        maxReflectionOrder: operation.request.arguments.maxReflectionOrder,
        maxPaths: 8,
      },
      budget: {
        maxFrames: 1801,
        maxBytes: this.limits.maxTraceBytes,
        maxObjects: 256,
        maxEvents: 100000,
        maxEventsPerFrame: 2048,
      },
    };
  }
  private async replay(
    operation: Operation,
    current: ExperimentRecorderOptions,
  ): Promise<RecordingArtifact> {
    const args = operation.request.arguments,
      original = await this.recording(String(args.replayTraceId));
    if (
      original.configuration.backendId !== BACKEND ||
      original.configuration.backendVersion !== SOLVER_VERSION
    )
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "重評必須明示目前實際求解器版本；舊版 recording 保留原始來源，請先建立 fresh run。",
      );
    if (args.maxReflectionOrder !== 1)
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "目前同運動重評 adapter 只支援一階反射；零階 fresh run 仍可用。",
      );
    if (
      original.configuration.fixedDtS !== FIXED_DT ||
      original.configuration.sceneSnapshot.seed !== args.seed ||
      original.startTick === null ||
      original.endTick === null ||
      Math.abs((original.endTick - original.startTick) * FIXED_DT - Number(args.durationS)) > 1e-9
    )
      throw new AgentError(
        "INCOMPATIBLE_EXPERIMENTS",
        "原 trace 的固定步、seed 或完整時長與請求不同；不截短、重播物理或重新抽樣。",
      );
    if (original.configuration.sampleRateHz !== args.sampleRateHz)
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "重評必須保留原 trace 的 sample rate；請求未被靜默改寫。",
      );
    const scene = createScene({ ...clone(current.sceneSnapshot), seed: Number(args.seed) });
    const motionInputs = (value: SceneSpec) => ({
      units: value.units,
      coordinateSystem: value.coordinateSystem,
      seed: value.seed,
      gravityMps2: value.gravityMps2,
      listener: value.listener,
      objects: value.objects
        .map(({ acousticMaterialId: _acousticMaterialId, ...object }) => object)
        .sort((left, right) => left.id.localeCompare(right.id)),
    });
    if (
      canonicalStringify(motionInputs(scene)) !==
      canonicalStringify(motionInputs(original.configuration.sceneSnapshot))
    )
      throw new AgentError(
        "INCOMPATIBLE_EXPERIMENTS",
        "重用 motion trace 不能改質量、摩擦、反彈、重力、geometry／初始 pose、body mode 或 Listener；這些變更必須 fresh physics run。",
      );
    const first = original.frames[0]?.behaviorSnapshot;
    if (!isRecord(first) || !isRecord(first.inputFrame) || !Array.isArray(first.inputFrame.objects))
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "原 trace 缺少可信物件 generation，無法建立重評配置。",
      );
    const document = reconcileBehaviors(
      current.behaviorConfig as unknown as SoundBehaviorDocument,
      scene,
      first.inputFrame.objects as { objectId: string; generation: number }[],
    );
    const changes = {
      runId: operation.runId!,
      sceneSnapshot: scene,
      sourceConfig: clone(current.sourceConfig),
      behaviorConfig: document,
      solverConfig: { backendId: BACKEND, maxReflectionOrder: 1, maxPaths: 8 },
      atmosphere: clone(current.atmosphere),
      materialRegistry: clone(current.materialRegistry),
      assetManifest: clone(current.assetManifest ?? []),
      generatorConfig: document.profiles.map((profile) =>
        profile.rules.map((rule) => rule.generator),
      ),
    };
    const processor = new RecordingProcessor({ getAssets: () => clone(this.options.getAssets()) });
    let traceBytes = 2;
    let frameCount = 0;
    const artifact = await reprocessRecording(original, changes, async (frame, configuration) => {
      this.check(operation);
      const result = await processor.process(frame, configuration, original.configuration);
      if (
        isRecord(result.behaviorSnapshot) &&
        result.behaviorSnapshot.cursorModel === undefined &&
        result.behaviorSnapshot.preStepVoiceCursors === undefined &&
        result.behaviorSnapshot.voiceCursors === undefined
      )
        result.behaviorSnapshot.cursorModel =
          "NOT_RENDERED: logical behavior state only; no native PCM cursor or audio playback evidence";
      const candidateFrame = {
        ...frame,
        ...result,
        sceneRevision: scene.sceneRevision,
        runEpoch: operation.runId!,
      };
      traceBytes += canonicalBytes(candidateFrame) + (frameCount > 0 ? 1 : 0);
      frameCount++;
      if (traceBytes > this.limits.maxTraceBytes || frameCount > 1801)
        throw new AgentError(
          "BUDGET_EXCEEDED",
          "重評 trace 已達本機 frame／byte 上限；未發布不完整 run。",
        );
      operation.solverSteps++;
      if (operation.solverSteps % this.limits.yieldEverySteps === 0) {
        this.update(operation, "running");
        await this.yield(operation);
      }
      return result;
    });
    return artifact;
  }
  private async recording(runId: string): Promise<RecordingArtifact> {
    const owned = this.runs.get(runId);
    const original = owned ?? this.options.getRecording?.(runId);
    if (!original) throw new AgentError("UNKNOWN_ID", "找不到已完成的 run artifact。");
    const recording = owned ?? immutableClone(original);
    await verifyRecording(recording);
    if (recording.status !== "captured")
      throw new AgentError(
        "INSUFFICIENT_DATA",
        "只可分析／保存完整 captured run；中斷資料僅供診斷。",
      );
    if (
      recording.frames.some((frame) =>
        frame.acousticFrames.some(
          (acoustic) =>
            acoustic.backendId !== recording.configuration.backendId ||
            acoustic.backendVersion !== recording.configuration.backendVersion,
        ),
      )
    )
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "Recording 宣告的 backend ID／版本與實際 acoustic frame 不符；保留歷史資料，但不據此產生新 metric 或重評結果。",
      );
    return recording;
  }
  private async analyze(
    recording: RecordingArtifact,
    requested: ExperimentMetricId[],
    bands: number[],
    reference: string,
  ): Promise<ExperimentMetricRecord[]> {
    const metrics: ExperimentMetricRecord[] = [];
    const materials = recording.configuration.materialRegistry;
    const revisions = Array.isArray(materials)
      ? materials.map((value) =>
          isRecord(value) && Number.isSafeInteger(value.revision) ? Number(value.revision) : 0,
        )
      : [];
    const materialRevision =
      revisions.length && revisions.every((revision) => revision === revisions[0])
        ? revisions[0]!
        : 0;
    const samplesByBand = new Map(
      bands.map((band) => [band, collectRecordingPathSamples(recording, band)]),
    );
    for (const metricId of requested)
      for (const bandCenterHz of bands) {
        const samples = samplesByBand.get(bandCenterHz)!;
        const population = pathMetricPopulation(samples, "directDelay");
        const delays = samples.directDelay.map((sample) => sample.value);
        const direct = metricId === "directArrivalTimeS";
        const value =
          direct && delays.length
            ? delays.reduce((sum, delay) => sum + delay, 0) / delays.length
            : null;
        const methodId = direct
          ? samples.population.kind === "logicalPlayingSourceQueries"
            ? "analysis.mean-playing-direct-delay.v2"
            : "analysis.mean-geometric-query-delay.v1"
          : "analysis.valid-ir-required.v1";
        const limitations = [
          LOCAL_LIMITATION,
          direct
            ? "所選 band 的非 stale 真正 order-0 路徑 absoluteDelayS 算術平均；有完整狀態時只納入 post-step playing 來源，排除 stop/fading 診斷；幾何延遲不依頻率，不是最早聲音偵測或 dB 閾值量測。"
            : "VALID_IR_REQUIRED：有限路徑及 Synthetic late reverb 不構成完整可分析 IR，不能推導 decay／DRR／clarity。",
          ...(direct && value === null
            ? ["NO_CAPTURED_DIRECT_PATH_IN_REQUESTED_BAND：遮擋、真空或缺少該 band 資料。"]
            : []),
          ...(materialRevision === 0
            ? [
                "材質 registry 沒有單一共同 revision；此欄以 0 表示，逐材質的實際 pin 保存在引用的 run configuration。",
              ]
            : []),
          ...(direct
            ? [
                `Population=${population.kind}; samples=${population.sampleCount}; eligibleQueries=${population.eligibleQueryCount}; excludedNonPlaying=${population.excludedNonPlayingQueryCount}; invalidQueries=${population.invalidAcousticQueryCount}; missingEligibilityFrames=${population.missingEligibilityFrameCount}; window=ticks ${population.window.startTick}..${population.window.endTick}, dt=${population.window.fixedDtS}s, band=${bandCenterHz}Hz.`,
              ]
            : []),
        ];
        metrics.push({
          metricRecordId: `metric.${(await sha256Canonical({ hash: recording.artifactSha256, metricId, bandCenterHz, methodId })).slice(0, 40)}`,
          metricId,
          bandCenterHz,
          value,
          unit: ["drrDb", "c50Db", "c80Db"].includes(metricId) ? "dB_ratio" : "s",
          availability: direct ? (value === null ? "missingArtifact" : "available") : "unsupported",
          provenance: "computed",
          evidenceArtifactId: reference,
          runId: recording.runId,
          methodId,
          backendVersion: recording.configuration.backendVersion,
          materialRevision,
          validationLevel: "V1",
          limitations,
        });
      }
    return metrics;
  }
  private async artifact(
    kind: ExperimentToolArtifact["kind"],
    data: unknown,
    fixedId?: string,
  ): Promise<ExperimentToolArtifact> {
    const sha256 = await sha256Canonical(data);
    return immutableClone({ id: fixedId ?? `artifact.${sha256.slice(0, 40)}`, sha256, kind, data });
  }
  private async recordingArtifact(recording: RecordingArtifact): Promise<ExperimentToolArtifact> {
    // Recordings are already immutable; the run catalog and artifact index share their bytes.
    return Object.freeze({
      id: `artifact.${recording.artifactSha256.slice(0, 40)}`,
      sha256: await sha256Canonical(recording),
      kind: "recording",
      data: recording,
    });
  }
  private checkStorage(...artifacts: ExperimentToolArtifact[]): void {
    const incoming = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    let bytes = this.storedBytes;
    for (const artifact of incoming.values()) {
      const old = this.artifacts.get(artifact.id);
      if (old && old.sha256 !== artifact.sha256)
        throw new AgentError("DOMAIN_INVALID", "不可覆寫既有 immutable artifact ID。");
      if (!old) bytes += canonicalBytes(artifact);
    }
    if (bytes > this.limits.maxStoredBytes)
      throw new AgentError("BUDGET_EXCEEDED", "本次序列化 artifact 容量已達上限；舊結果仍保留。");
  }
  private commitArtifact(artifact: ExperimentToolArtifact): void {
    if (!this.artifacts.has(artifact.id)) {
      this.storedBytes += canonicalBytes(artifact);
      this.artifacts.set(artifact.id, artifact);
    }
  }
  private async preview(operation: Operation): Promise<string> {
    const transactionId = operation.request.transactionId;
    const proposed = transactionId ? this.options.getPreviewScene?.(transactionId) : null;
    if (!proposed)
      throw new AgentError(
        "PREVIEW_REQUIRED",
        "找不到此 transaction 的可信 staged candidate；沒有以目前場景冒充預覽。",
      );
    const scene = createScene(proposed);
    if (
      scene.sceneId !== operation.request.sceneId ||
      scene.sceneRevision !== operation.request.expectedSceneRevision + 1
    )
      throw new AgentError(
        "REVISION_CONFLICT",
        "Staged candidate 的 Scene identity／revision 與原請求不同。",
      );
    const world = await PhysicsWorld.create(scene);
    try {
      const collisions = scene.objects.map((object) => ({
        objectId: object.id,
        ...world.validatePlacement(object, object.id),
      }));
      const faceCount =
        scene.objects.filter((object) => object.shape === "box" && object.acousticRole !== "none")
          .length * 6;
      const artifact = await this.artifact("preview", {
        scene,
        sceneSha256: await sha256Canonical(scene),
        transactionId,
        collisionCheck: {
          method:
            "Rapier shape overlap at authored pose; existing support contacts may be reported",
          objects: collisions,
        },
        acousticCostEstimate: {
          provenance: "Estimated",
          method: "box face count × admitted source upper bound; not a duration benchmark",
          boxFaces: faceCount,
          declaredSceneSources: scene.sources.length,
          admittedSourceUpperBound: 16,
          maxReflectionOrder: 1,
          maxPathsPerVoice: 8,
          geometryWithinBudget: faceCount <= 256,
        },
        limitations: [
          LOCAL_LIMITATION,
          "此 artifact 不 commit 場景，不開啟聲音，也不證明影像或效能驗收通過。",
        ],
      });
      this.checkStorage(artifact);
      this.check(operation);
      this.commitArtifact(artifact);
      return artifact.id;
    } finally {
      world.dispose();
    }
  }
  /** Acknowledgement appears only after the bounded cooperative main-thread loop exits. */
  cancel(requestId?: string): boolean {
    if (!this.active || (requestId && this.active.request.requestId !== requestId)) return false;
    this.active.cancelRequested = true;
    this.update(this.active, "cancelRequested");
    return true;
  }
  getRun(runId: string): RecordingArtifact | null {
    const value = this.runs.get(runId);
    return value ? immutableClone(value) : null;
  }
  getRuns(): RecordingArtifact[] {
    return [...this.runs.values()].map(immutableClone);
  }
  getArtifact(artifactId: string): ExperimentToolArtifact | null {
    const value = this.artifacts.get(artifactId);
    return value ? immutableClone(value) : null;
  }
  getMetrics(): ExperimentMetricRecord[] {
    return [...this.metricRecords.values()].map(immutableClone);
  }
  getLedger(): ExperimentToolLedgerEntry[] {
    return [...this.ledger.values()].map(immutableClone);
  }
  getRequests(): ToolRequest[] {
    return [...this.requests.values()].map((entry) =>
      immutableClone(JSON.parse(entry.payload) as ToolRequest),
    );
  }
  getUsage(): {
    toolCalls: number;
    runs: number;
    storedBytes: number;
    activeRequestId: string | null;
  } {
    return {
      toolCalls: this.requests.size,
      runs: this.runsUsed,
      storedBytes: this.storedBytes,
      activeRequestId: this.active?.request.requestId ?? null,
    };
  }
}
