import {
  ExperimentRecorder,
  MotionReplay,
  compareRecordings,
  immutableClone,
  canonicalStringify,
  reprocessRecording,
  RecordingError,
  verifyRecording,
} from "../experiments/index.js";
import type {
  ExperimentRecorderOptions,
  RecordingArtifact,
  RecordingComparison,
  RecordingFrame,
  RecordingFrameInput,
  RecordingConfiguration,
  ReplayFrame,
  ReplayMode,
  ReprocessConfiguration,
  ReprocessedFrame,
} from "../experiments/index.js";
import type { LabViewModel } from "../ui/contracts.js";

export interface RecordingHostOptions {
  getConfig(): ExperimentRecorderOptions;
  sealRecording?: (recorder: ExperimentRecorder) => Promise<RecordingArtifact>;
  /** Actual host evaluation using the supplied immutable frame/configuration. */
  reprocessFrame?: (
    frame: RecordingFrame,
    configuration: ReprocessConfiguration,
    baseline: RecordingConfiguration,
  ) => ReprocessedFrame | Promise<ReprocessedFrame>;
}
export interface RecordingHostView {
  recording: LabViewModel["recording"];
  comparison: LabViewModel["comparison"];
  pending: boolean;
  error: string | null;
}
type Operation = "finalize" | "captureA" | "candidate" | "compare" | "replay";

/** Serializes capture/replay/A-B publication; it does not drive the physics clock. */
export class RecordingHost {
  private readonly options: RecordingHostOptions;
  private recorder: ExperimentRecorder | null = null;
  private artifact: RecordingArtifact | null = null;
  private replayCursor: MotionReplay | null = null;
  private slots: { A: RecordingArtifact | null; B: RecordingArtifact | null } = {
    A: null,
    B: null,
  };
  private comparisonResult: RecordingComparison | null = null;
  private pending: { operation: Operation; token: number } | null = null;
  private generation = 0;
  private identitySequence = 0;
  private paused = false;
  private replayTimeSeconds = 0;
  private error: string | null = null;

  constructor(options: RecordingHostOptions) {
    this.options = options;
  }

  private assertAvailable(): void {
    if (this.pending)
      throw new RecordingError("HOST_BUSY", "錄製／比較操作仍在完成；請等待目前操作。");
  }
  private assertCurrent(token: number): void {
    if (token !== this.generation)
      throw new RecordingError("OPERATION_CANCELLED", "操作已中斷；沒有發布不完整結果。");
  }
  private uniqueRunId(base: string, kind: string): string {
    if (!/^[a-z][a-z0-9._-]{0,63}$/.test(base))
      throw new RecordingError("RUN_ID", "主程式提供的 run ID 無效。");
    const suffix = `.${kind}.${++this.identitySequence}`;
    return base.slice(0, 64 - suffix.length) + suffix;
  }
  private async operation<T>(
    operation: Operation,
    work: (token: number) => Promise<T>,
  ): Promise<T> {
    this.assertAvailable();
    const token = ++this.generation;
    this.pending = { operation, token };
    this.error = null;
    try {
      const result = await work(token);
      this.assertCurrent(token);
      return result;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "錄製操作失敗。";
      throw error;
    } finally {
      if (this.pending?.token === token) this.pending = null;
    }
  }

  start(): void {
    this.assertAvailable();
    if (this.recorder) throw new RecordingError("RECORDER_ACTIVE", "請先完成或中斷目前錄製。");
    const config = this.options.getConfig();
    const candidate = new ExperimentRecorder({
      ...config,
      runId: this.uniqueRunId(config.runId, "capture"),
      runEpoch: config.runEpoch ?? config.runId,
    });
    this.replayCursor = null;
    this.replayTimeSeconds = 0;
    this.recorder = candidate;
    this.paused = false;
    this.error = null;
  }

  /** Safe to call on every physics step; returns false when capture is not active. */
  appendFrame(frame: RecordingFrameInput): boolean {
    if (!this.recorder || this.pending || this.recorder.getTelemetry().state !== "recording")
      return false;
    try {
      this.recorder.appendFrame(frame);
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "錄製 frame 失敗。";
      throw error;
    }
  }
  pause(): void {
    this.paused = true;
    this.recorder?.pause();
    this.replayCursor?.pause();
  }
  resume(): void {
    this.paused = false;
    this.recorder?.resume();
    this.replayCursor?.resume();
  }
  private async finalize(token: number): Promise<RecordingArtifact> {
    if (!this.recorder) {
      if (this.artifact) return this.artifact;
      throw new RecordingError("NO_RECORDING", "目前沒有錄製可以完成。");
    }
    const active = this.recorder;
    const artifact = await (this.options.sealRecording
      ? this.options.sealRecording(active)
      : active.finish());
    this.assertCurrent(token);
    this.artifact = artifact;
    this.recorder = null;
    return artifact;
  }
  stop(): Promise<RecordingArtifact> {
    return this.operation("finalize", (token) => this.finalize(token));
  }
  async interrupt(reason: string): Promise<RecordingArtifact | null> {
    this.replayCursor = null;
    this.paused = false;
    if (this.pending) {
      // An in-progress seal already owns a complete frozen snapshot. Do not race its commit.
      if (["finalize", "captureA"].includes(this.pending.operation))
        throw new RecordingError("HOST_BUSY", "錄製快照正在封存；完成後再重設。");
      this.generation += 1;
      this.error = `已中斷：${reason}`;
      return null;
    }
    if (!this.recorder) return null;
    if (this.recorder.getTelemetry().reason === "SEAL_FAILED") {
      // A failed seal is terminal and caches its rejected promise. Explicit interruption
      // discards only that invalid in-progress recorder, preserving the last valid artifact.
      this.recorder = null;
      this.generation += 1;
      this.error = `已丟棄未能封存的錄製：${reason}；先前有效成果保留。`;
      return null;
    }
    this.recorder.interrupt(reason);
    return this.operation("finalize", (token) => this.finalize(token));
  }

  async replay(mode: ReplayMode = "recordedOutput"): Promise<void> {
    if (this.recorder) throw new RecordingError("RECORDER_ACTIVE", "錄製完成後才可重播。");
    await this.operation("replay", async (token) => {
      if (!this.artifact) throw new RecordingError("NO_RECORDING", "尚無可重播的錄製。");
      const cursor = await MotionReplay.create(this.artifact, { mode });
      this.assertCurrent(token);
      if (this.paused) cursor.pause();
      this.replayCursor = cursor;
      this.replayTimeSeconds = 0;
    });
  }
  seek(tick: number): ReplayFrame {
    this.assertAvailable();
    if (!this.replayCursor || !this.artifact)
      throw new RecordingError("REPLAY_UNAVAILABLE", "請先開啟錄製重播。");
    const frame = this.replayCursor.seek(tick);
    this.replayTimeSeconds =
      (frame.tick - this.artifact.startTick!) * this.artifact.configuration.fixedDtS;
    return frame;
  }
  nextReplay(): ReplayFrame | null {
    if (this.pending || !this.replayCursor || !this.artifact) return null;
    const frame = this.replayCursor.next();
    if (frame)
      this.replayTimeSeconds =
        (frame.tick - this.artifact.startTick!) * this.artifact.configuration.fixedDtS;
    return frame;
  }
  stopReplay(): void {
    if (this.pending?.operation === "replay") this.generation += 1;
    this.replayCursor = null;
  }

  captureComparison(slot: "A" | "B"): Promise<RecordingArtifact> {
    if (slot === "A")
      return this.operation("captureA", async (token) => {
        const candidate = this.recorder ? await this.finalize(token) : this.artifact;
        if (!candidate || candidate.status !== "captured")
          throw new RecordingError("NO_CAPTURED_RECORDING", "A 必須來自完整錄製。");
        this.assertCurrent(token);
        this.slots = { A: candidate, B: null };
        this.comparisonResult = null;
        return candidate;
      });
    if (slot !== "B")
      return Promise.reject(new RecordingError("COMPARISON_SLOT", "比較欄位必須是 A 或 B。"));
    return this.operation("candidate", async (token) => {
      if (this.recorder) throw new RecordingError("RECORDER_ACTIVE", "請先完成錄製，才可重評 B。");
      const baseline = this.slots.A;
      const processor = this.options.reprocessFrame;
      if (!baseline) throw new RecordingError("NO_BASELINE", "請先保存 A 錄製。");
      if (!processor)
        throw new RecordingError(
          "CAPABILITY_UNSUPPORTED",
          "未提供實際 Behavior／聲學重評器，不能建立 B。",
        );
      const config = this.options.getConfig();
      if (
        config.fixedDtS !== baseline.configuration.fixedDtS ||
        config.sampleRateHz !== baseline.configuration.sampleRateHz ||
        config.physicsVersion !== baseline.configuration.physicsVersion ||
        config.backendVersion !== baseline.configuration.backendVersion ||
        (config.backendId ?? "custom-web-acoustic-core") !== baseline.configuration.backendId ||
        (config.physicsConfig !== undefined &&
          canonicalStringify(config.physicsConfig) !==
            canonicalStringify(baseline.configuration.physicsConfig)) ||
        (config.geometrySnapshot !== undefined &&
          canonicalStringify(config.geometrySnapshot) !==
            canonicalStringify(baseline.configuration.geometrySnapshot))
      ) {
        throw new RecordingError(
          "INCOMPATIBLE_EXPERIMENTS",
          "固定步、取樣率、backend／physics version 或額外幾何／物理設定改變；不可假定相同實驗。",
        );
      }
      const changes: ReprocessConfiguration = immutableClone({
        runId: this.uniqueRunId(config.runId, "candidate"),
        sceneSnapshot: config.sceneSnapshot,
        sourceConfig: config.sourceConfig,
        behaviorConfig: config.behaviorConfig,
        solverConfig: config.solverConfig,
        atmosphere: config.atmosphere,
        materialRegistry: config.materialRegistry,
        assetManifest: config.assetManifest ?? [],
        generatorConfig: config.generatorConfig ?? config.sourceConfig,
      });
      let processedFrames = 0;
      const candidate = await reprocessRecording(baseline, changes, async (frame, pinned) => {
        this.assertCurrent(token);
        if (processedFrames > 0 && processedFrames % 32 === 0) {
          await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
          this.assertCurrent(token);
        }
        const output = await processor(frame, pinned, baseline.configuration);
        this.assertCurrent(token);
        processedFrames += 1;
        return output;
      });
      this.assertCurrent(token);
      this.slots = { A: baseline, B: candidate };
      this.comparisonResult = null;
      return candidate;
    });
  }
  compare(kind: "acoustic" | "behavior"): Promise<RecordingComparison> {
    return this.operation("compare", async (token) => {
      if (!this.slots.A || !this.slots.B)
        throw new RecordingError("COMPARISON_SLOTS", "A 與 B 都完成後才能比較。");
      const result = await compareRecordings(this.slots.A, this.slots.B, {
        kind,
        independentVariables: kind === "acoustic" ? ["acousticMaterial"] : ["behaviorProfile"],
      });
      this.assertCurrent(token);
      this.comparisonResult = immutableClone(result);
      return result;
    });
  }
  getArtifact(): RecordingArtifact | null {
    return this.artifact;
  }
  /** Restore only an independently hash-verified immutable artifact; no physics is re-run. */
  async restoreArtifact(artifact: RecordingArtifact): Promise<void> {
    this.assertAvailable();
    if (this.recorder || this.replayCursor)
      throw new RecordingError("RECORDER_ACTIVE", "請先停止目前錄製或重播。");
    await verifyRecording(artifact);
    this.artifact = immutableClone(artifact);
    this.slots = { A: null, B: null };
    this.comparisonResult = null;
    this.replayTimeSeconds = 0;
    this.paused = true;
  }
  getSlots(): { A: RecordingArtifact | null; B: RecordingArtifact | null } {
    return { ...this.slots };
  }
  getComparison(): RecordingComparison | null {
    return this.comparisonResult;
  }
  getView(): RecordingHostView {
    const telemetry = this.recorder?.getTelemetry();
    const artifact = this.artifact;
    const replaying = this.replayCursor !== null && !this.replayCursor.getState().ended;
    const durationSeconds =
      artifact && artifact.startTick !== null && artifact.endTick !== null
        ? (artifact.endTick - artifact.startTick) * artifact.configuration.fixedDtS
        : 0;
    const result = this.comparisonResult;
    let status = "先錄製，再保存 A；修改設定後重評 B。";
    if (this.pending?.operation === "candidate") status = "正在以 A 的相同運動／事件重評 B…";
    else if (result)
      status = result.matched
        ? `${result.kind} A/B：固定條件相符。`
        : `無法作相同條件比較：${result.mismatches.map((entry) => entry.field).join("、")}`;
    else if (this.slots.B) status = "B 已重評；等待核對比較條件。";
    else if (this.slots.A) status = "A 已保存；B 將重用同一運動／事件 trace。";
    return {
      recording: {
        state: this.recorder
          ? "recording"
          : replaying
            ? "replaying"
            : artifact?.status === "captured"
              ? "finalized"
              : "idle",
        eventCount: telemetry?.eventCount ?? artifact?.eventCount ?? 0,
        durationSeconds: telemetry?.durationSeconds ?? durationSeconds,
        replayTimeSeconds: this.replayTimeSeconds,
        canReplay:
          this.recorder === null && artifact?.status === "captured" && this.pending === null,
        hasArtifact: Boolean(
          artifact && artifact.frameCount > 0 && artifact.status !== "cancelled",
        ),
      },
      comparison: {
        hasA: this.slots.A !== null,
        hasB: this.slots.B !== null,
        status,
        metrics:
          result?.metrics.map((metric) => ({
            label: `${metric.label} Δ(B−A)`,
            value: metric.delta,
            unit: metric.unit,
            ...(metric.reason ? { reason: metric.reason } : {}),
          })) ?? [],
      },
      pending: this.pending !== null,
      error: this.error,
    };
  }
}
