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
import type { AcousticFrame, AcousticRequest } from "../acoustics/types.js";
import {
  RecordingEvaluationLane,
  type RecordingEvaluationBudget,
  type RecordingEvaluationTelemetry,
} from "./recording-evaluation-lane.js";

import type {
  RecordingCapturePersistence,
  RecordingPersistenceCallbacks,
  RecordingPersistenceTelemetry,
} from "../experiments/recording-persistence.js";
import {
  RecordingEvaluationCommitDiagnostics,
  beginRecordingCommit,
  observeRecordingCommit,
  recordingCommitTime,
  recordingCommitElapsed,
  type RecordingCommitIdentity,
  type RecordingCommitDiagnosticsSnapshot,
} from "../experiments/recording-commit-diagnostics.js";

interface CommitCapture extends RecordingCommitIdentity {
  evaluation: RecordingEvaluationCommitDiagnostics;
}

export type RecordingBackpressureOrigin = "evaluation" | "storage";

/** One first-guard observation per capture; timing values are main-thread wall-clock observations. */
export interface RecordingBackpressureDiagnostics {
  readonly schemaVersion: 1;
  readonly origin: RecordingBackpressureOrigin;
  readonly captureRunId: string | null;
  readonly runEpoch: string;
  readonly sceneRevision: number;
  readonly worldTick: number;
  readonly simulationTimeSeconds: number;
  readonly recordingDurationSeconds: number | null;
  readonly observedAtWallMs: number | null;
  readonly evaluation: Readonly<RecordingEvaluationTelemetry> | null;
  /** Raw storage queue watermarks, not the host's combined producer/processed projection. */
  readonly persistence: Readonly<RecordingPersistenceTelemetry> | null;
  readonly evaluationReadiness: Readonly<
    import("./recording-evaluation-client.js").RecordingEvaluationReadinessDiagnostics
  > | null;
  readonly persistenceReadiness: Readonly<
    import("../experiments/recording-persistence.js").RecordingPersistenceReadinessTelemetry
  > | null;
  readonly diagnosticError: string | null;
}

export interface RecordingHostOptions {
  getConfig(): ExperimentRecorderOptions;
  createPersistence?: (
    recorder: ExperimentRecorder,
    callbacks: RecordingPersistenceCallbacks,
  ) => RecordingCapturePersistence;
  sealRecording?: (recorder: ExperimentRecorder) => Promise<RecordingArtifact>;
  /** Actual host evaluation using the supplied immutable frame/configuration. */
  reprocessFrame?: (
    frame: RecordingFrame,
    configuration: ReprocessConfiguration,
    baseline: RecordingConfiguration,
  ) => ReprocessedFrame | Promise<ReprocessedFrame>;
  /** Capture evaluation is independent of live preview admission. */
  evaluateCapture?: (requests: readonly AcousticRequest[]) => Promise<readonly AcousticFrame[]>;
  batchCaptureEvaluation?: boolean;
  evaluationBudget?: Partial<RecordingEvaluationBudget>;
  cancelEvaluation?: (reason: string) => void;
  onEvaluationBackpressure?: (origin: RecordingBackpressureOrigin) => void;
  onEvaluationFailure?: (error: Error) => void;
  onEvaluationChanged?: () => void;
}
export interface RecordingHostView {
  recording: LabViewModel["recording"];
  comparison: LabViewModel["comparison"];
  pending: boolean;
  error: string | null;
}
type Operation = "finalize" | "captureA" | "candidate" | "compare" | "replay";
interface CapturePreparationPrevious {
  commitCapture: CommitCapture | null;
  recorder: ExperimentRecorder | null;
  evaluation: RecordingEvaluationLane | null;
  persistence: RecordingCapturePersistence | null;
  replayCursor: MotionReplay | null;
  replayTimeSeconds: number;
  paused: boolean;
  error: string | null;
  captureEpoch: string;
  captureRunId: string | null;
}
interface CapturePreparation {
  candidate: ExperimentRecorder;
  evaluation: RecordingEvaluationLane | null;
  persistence: RecordingCapturePersistence | null;
  previous: CapturePreparationPrevious;
  controller: AbortController;
  signal: AbortSignal | undefined;
  forwardAbort: (() => void) | null;
  ready: boolean;
}
interface RetiringPreparation {
  persistence: RecordingCapturePersistence;
  reason: string;
  work: Promise<void> | null;
  failure: unknown;
}

/** Serializes capture/replay/A-B publication; it does not drive the physics clock. */
export class RecordingHost {
  private commitCapture: CommitCapture | null = null;
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
  private evaluation: RecordingEvaluationLane | null = null;
  private captureEpoch = "";
  private captureRunId: string | null = null;
  private persistence: RecordingCapturePersistence | null = null;
  private preparation: CapturePreparation | null = null;
  private retiringPreparation: RetiringPreparation | null = null;

  constructor(options: RecordingHostOptions) {
    this.options = options;
  }

  private assertAvailable(): void {
    if (this.pending || this.preparation)
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
    if (this.retiringPreparation) {
      this.retryPreparationRetirement(this.retiringPreparation);
      throw new RecordingError(
        "RECORDING_PREPARATION_CLEANUP",
        "前一次錄製準備仍在清理；請稍後重試。",
      );
    }
    if (this.recorder) throw new RecordingError("RECORDER_ACTIVE", "請先完成或中斷目前錄製。");
    const config = this.options.getConfig();
    const captureRunId = this.uniqueRunId(config.runId, "capture");
    const candidate = new ExperimentRecorder({
      ...config,
      runId: captureRunId,
      runEpoch: config.runEpoch ?? config.runId,
    });
    this.replayCursor = null;
    this.replayTimeSeconds = 0;
    this.recorder = candidate;
    this.paused = false;
    this.error = null;
    this.captureEpoch = config.runEpoch ?? config.runId;
    this.captureRunId = captureRunId;
    this.evaluation?.dispose();
    this.persistence =
      this.options.createPersistence?.(candidate, {
        onBackpressure: () => {
          if (this.recorder === candidate) this.options.onEvaluationBackpressure?.("storage");
        },
        onChanged: () => {
          if (this.recorder === candidate) this.options.onEvaluationChanged?.();
        },
        onFailure: (error) => {
          if (this.recorder !== candidate) return;
          candidate.interrupt("STORAGE_FAILED: " + error.message);
          this.error = error.message;
          // Preparation has no admitted jobs; its await owns this error and rollback.
          if (this.preparation?.candidate === candidate) return;
          this.evaluation?.cancel("STORAGE_FAILED");
          this.options.onEvaluationFailure?.(error);
        },
      }) ?? null;
    try {
      this.commitCapture = {
        captureRunId,
        runEpoch: this.captureEpoch,
        sceneRevision: config.sceneSnapshot.sceneRevision,
        evaluation: new RecordingEvaluationCommitDiagnostics(),
      };
    } catch {
      this.commitCapture = null;
    }
    // The lane closure owns this capture's table, even across a later start/rollback.
    const commitDiagnostics = this.commitCapture?.evaluation;
    this.evaluation = this.options.evaluateCapture
      ? new RecordingEvaluationLane({
          evaluate: (input) => this.options.evaluateCapture!(input.requests),
          batchCapture: this.options.batchCaptureEvaluation ?? true,
          commit: async (frame) => {
            beginRecordingCommit(commitDiagnostics);
            observeRecordingCommit(commitDiagnostics, "tick", frame.tick);
            let committed = false;
            try {
              const capacityStartedAt = this.persistence ? recordingCommitTime() : null;
              let capacity: Promise<void> | undefined;
              let ownedFrame: RecordingFrameInput = frame;
              try {
                capacity = this.persistence?.waitForCapacity(frame, (owned) => {
                  ownedFrame = owned;
                });
              } finally {
                observeRecordingCommit(
                  commitDiagnostics,
                  "capacityCallMs",
                  recordingCommitElapsed(capacityStartedAt, recordingCommitTime()),
                );
              }
              const capacityWaitStartedAt = this.persistence ? recordingCommitTime() : null;
              try {
                await capacity;
              } finally {
                observeRecordingCommit(
                  commitDiagnostics,
                  "capacityAwaitMs",
                  recordingCommitElapsed(capacityWaitStartedAt, recordingCommitTime()),
                );
              }
              if (this.recorder !== candidate)
                throw new RecordingError("EVALUATION_GENERATION", "錄製已切換；不接納舊評估結果。");
              const paused = candidate.getTelemetry().state === "paused";
              if (paused) candidate.resume();
              try {
                const appendStartedAt = recordingCommitTime();
                try {
                  candidate.appendFrame(ownedFrame);
                  this.persistence?.enqueue(candidate.getLastFrame()!);
                } finally {
                  observeRecordingCommit(
                    commitDiagnostics,
                    "appendEnqueueMs",
                    recordingCommitElapsed(appendStartedAt, recordingCommitTime()),
                  );
                }
                try {
                  observeRecordingCommit(
                    commitDiagnostics,
                    "encodedFrameBytes",
                    this.persistence?.getLastEnqueuedFrameBytes?.(),
                  );
                } catch {
                  // Byte telemetry reuses enqueue's size and never performs another encode.
                }
              } finally {
                if (paused) candidate.pause();
              }
              committed = true;
            } finally {
              observeRecordingCommit(commitDiagnostics, "completed", committed);
            }
          },
          ...(this.options.evaluationBudget ? { budget: this.options.evaluationBudget } : {}),
          onBackpressure: () => {
            if (this.recorder === candidate) this.options.onEvaluationBackpressure?.("evaluation");
          },
          onChanged: () => {
            if (this.recorder === candidate) this.options.onEvaluationChanged?.();
          },
          cancelEvaluation: (reason) => {
            if (this.recorder === candidate) this.options.cancelEvaluation?.(reason);
          },
          onFailure: (error) => {
            if (this.recorder !== candidate) return;
            candidate.interrupt("EVALUATION_FAILED: " + error.message);
            this.error = error.message;
            this.options.onEvaluationFailure?.(error);
          },
        })
      : null;
  }

  /** The legacy synchronous start remains available; this gate owns a zero-frame candidate. */
  async prepareStart(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted)
      throw new RecordingError("RECORDING_PREPARATION_CANCELLED", "錄製準備已取消。");
    const previous: CapturePreparationPrevious = {
      commitCapture: this.commitCapture,
      recorder: this.recorder,
      evaluation: this.evaluation,
      persistence: this.persistence,
      replayCursor: this.replayCursor,
      replayTimeSeconds: this.replayTimeSeconds,
      paused: this.paused,
      error: this.error,
      captureEpoch: this.captureEpoch,
      captureRunId: this.captureRunId,
    };
    try {
      this.start();
    } catch (reason) {
      if (this.recorder && this.recorder !== previous.recorder) {
        this.preparation = {
          candidate: this.recorder,
          evaluation: this.evaluation === previous.evaluation ? null : this.evaluation,
          persistence: this.persistence === previous.persistence ? null : this.persistence,
          previous,
          controller: new AbortController(),
          signal: undefined,
          forwardAbort: null,
          ready: false,
        };
        this.abortPreparedStart("PREPARATION_START_FAILED");
      }
      throw reason;
    }
    const preparation: CapturePreparation = {
      candidate: this.recorder!,
      evaluation: this.evaluation,
      persistence: this.persistence,
      previous,
      controller: new AbortController(),
      signal,
      forwardAbort: null,
      ready: false,
    };
    this.preparation = preparation;
    this.paused = true;
    preparation.candidate.pause();
    try {
      if (signal) {
        preparation.forwardAbort = () => {
          if (this.preparation === preparation) this.abortPreparedStart("PREPARATION_CANCELLED");
        };
        signal.addEventListener("abort", preparation.forwardAbort, { once: true });
      }
      if (signal?.aborted) this.abortPreparedStart("PREPARATION_CANCELLED");
      if (preparation.persistence && typeof preparation.persistence.waitUntilReady !== "function")
        throw new RecordingError(
          "RECORDING_STORAGE_PREPARATION_UNSUPPORTED",
          "錄製儲存不支援就緒確認。",
        );
      await preparation.persistence?.waitUntilReady?.(preparation.controller.signal, 10000);
      if (
        preparation.controller.signal.aborted ||
        this.preparation !== preparation ||
        this.recorder !== preparation.candidate
      )
        throw new RecordingError("RECORDING_PREPARATION_CANCELLED", "錄製準備已取消。");
      if (preparation.persistence?.getTelemetry().state === "interrupted")
        throw new RecordingError("RECORDING_STORAGE_FAILED", "錄製儲存已失敗；請先中斷目前錄製。");
      preparation.ready = true;
    } catch (reason) {
      if (this.preparation === preparation) this.abortPreparedStart("PREPARATION_FAILED");
      throw reason;
    }
  }
  /** Discard only a candidate that has never admitted a tick; valid prior results stay owned. */
  abortPreparedStart(reason: string): void {
    const preparation = this.preparation;
    if (!preparation || this.recorder !== preparation.candidate) return;
    if (
      preparation.candidate.getTelemetry().frameCount !== 0 ||
      (preparation.evaluation?.getTelemetry().acceptedFrames ?? 0) !== 0 ||
      (preparation.persistence?.getTelemetry().acceptedFrames ?? 0) !== 0
    )
      throw new RecordingError(
        "RECORDING_PREPARATION_ACCEPTED",
        "錄製已接納影格，不能丟棄完整資料。",
      );
    this.preparation = null;
    const previous = preparation.previous;
    this.commitCapture = previous.commitCapture;
    this.recorder = previous.recorder;
    this.evaluation = previous.evaluation;
    this.persistence = previous.persistence;
    this.replayCursor = previous.replayCursor;
    this.replayTimeSeconds = previous.replayTimeSeconds;
    this.paused = previous.paused;
    this.error = previous.error;
    this.captureEpoch = previous.captureEpoch;
    this.captureRunId = previous.captureRunId;
    this.generation++;
    this.removePreparationListener(preparation);
    preparation.controller.abort(reason.slice(0, 256));
    preparation.candidate.interrupt(reason.slice(0, 256));
    preparation.evaluation?.dispose();
    if (preparation.persistence) {
      const retiring: RetiringPreparation = {
        persistence: preparation.persistence,
        reason: reason.slice(0, 256),
        work: null,
        failure: null,
      };
      this.retiringPreparation = retiring;
      this.retryPreparationRetirement(retiring);
    }
  }
  private removePreparationListener(preparation: CapturePreparation): void {
    if (preparation.signal && preparation.forwardAbort)
      preparation.signal.removeEventListener("abort", preparation.forwardAbort);
    preparation.forwardAbort = null;
  }
  private retryPreparationRetirement(retiring: RetiringPreparation): void {
    if (this.retiringPreparation !== retiring || retiring.work) return;
    retiring.work = Promise.resolve()
      .then(() => retiring.persistence.cancel(retiring.reason))
      .then(
        () => {
          if (this.retiringPreparation === retiring) this.retiringPreparation = null;
        },
        (reason: unknown) => {
          if (this.retiringPreparation !== retiring) return;
          let creationFailed = false;
          try {
            creationFailed =
              retiring.persistence.getReadinessTelemetry?.().createState === "failed";
          } catch {
            /* Retain uncertain cleanup ownership. */
          }
          if (creationFailed) this.retiringPreparation = null;
          else {
            retiring.failure = reason;
            retiring.work = null;
          }
        },
      );
  }
  /** Safe to call on every physics step; returns false when capture is not active. */
  appendFrame(frame: RecordingFrameInput): boolean {
    if (
      !this.recorder ||
      this.pending ||
      this.preparation ||
      this.recorder.getTelemetry().state !== "recording"
    )
      return false;
    try {
      this.recorder.appendFrame(frame);
      this.persistence?.enqueue(this.recorder.getLastFrame()!);
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "錄製 frame 失敗。";
      throw error;
    }
  }
  /** Own the exact tick before deferring solver work. Full queues never overwrite frames. */
  appendEvaluationFrame(frame: RecordingFrameInput, requests: readonly AcousticRequest[]): boolean {
    if (
      !this.recorder ||
      this.pending ||
      this.preparation ||
      this.recorder.getTelemetry().state !== "recording"
    )
      return false;
    if (!this.evaluation) {
      if (requests.length > 0)
        throw new RecordingError("EVALUATION_UNAVAILABLE", "沒有可用的錄製求解器。");
      return this.appendFrame(frame);
    }
    try {
      this.evaluation.enqueue({
        frame: { ...frame, runEpoch: frame.runEpoch ?? this.captureEpoch },
        requests,
      });
      return true;
    } catch (error) {
      this.recorder.interrupt("EVALUATION_ADMISSION_FAILED");
      this.evaluation.cancel("EVALUATION_ADMISSION_FAILED");
      this.error = error instanceof Error ? error.message : "錄製評估接納失敗。";
      throw error;
    }
  }
  getCaptureRunId(): string | null {
    return this.captureRunId;
  }
  getCommitDiagnostics(): Readonly<RecordingCommitDiagnosticsSnapshot> | null {
    try {
      const capture = this.commitCapture;
      if (!capture || capture.captureRunId !== this.captureRunId) return null;
      const storage = this.persistence?.getCommitDiagnostics?.() ?? null;
      if (
        storage &&
        (storage.captureRunId !== capture.captureRunId ||
          storage.runEpoch !== capture.runEpoch ||
          storage.sceneRevision !== capture.sceneRevision ||
          storage.sessionId !== this.persistence?.getTelemetry().sessionId)
      )
        return null;
      return Object.freeze({
        schemaVersion: 1,
        captureRunId: capture.captureRunId,
        sessionId: storage?.sessionId ?? null,
        runEpoch: capture.runEpoch,
        sceneRevision: capture.sceneRevision,
        evaluation: capture.evaluation.snapshot(),
        storage: storage?.storage ?? null,
      });
    } catch {
      return null;
    }
  }
  /** Diagnostics need the storage queue's own accepted count, without the flow projection below. */
  getPersistenceQueueTelemetry(): RecordingPersistenceTelemetry | null {
    return this.persistence?.getTelemetry() ?? null;
  }
  getPersistenceReadinessTelemetry() {
    return this.persistence?.getReadinessTelemetry?.() ?? null;
  }
  getEvaluationTelemetry(): RecordingEvaluationTelemetry | null {
    return this.evaluation?.getTelemetry() ?? null;
  }
  getPersistenceTelemetry(): RecordingPersistenceTelemetry | null {
    const persistence = this.persistence?.getTelemetry();
    if (!persistence) return null;
    const evaluation = this.evaluation?.getTelemetry();
    return {
      ...persistence,
      acceptedFrames: evaluation?.acceptedFrames ?? persistence.acceptedFrames,
      acceptedTick: evaluation?.acceptedTick ?? persistence.acceptedTick,
      processedFrames: this.recorder?.getTelemetry().frameCount ?? persistence.processedFrames,
      processedTick: this.recorder?.getLastFrame()?.tick ?? persistence.processedTick,
    };
  }
  /** Controlled captures may flush one exact tick without closing admission. */
  async flushEvaluation(): Promise<void> {
    if (!this.recorder) return;
    await this.evaluation?.flush();
  }
  pause(): void {
    this.paused = true;
    this.recorder?.pause();
    this.replayCursor?.pause();
  }
  resume(): void {
    if (this.preparation && !this.preparation.ready)
      throw new RecordingError("RECORDING_STORAGE_PREPARING", "錄製儲存尚未就緒。");
    this.assertEvaluationReady();
    if (this.preparation) {
      this.removePreparationListener(this.preparation);
      this.preparation = null;
    }
    this.paused = false;
    this.recorder?.resume();
    this.replayCursor?.resume();
  }
  /** Check before the runtime resumes physics, interaction or behavior clocks. */
  assertEvaluationReady(): void {
    if (!this.recorder) return;
    if (this.persistence?.getTelemetry().backpressured)
      throw new RecordingError(
        "RECORDING_STORAGE_BACKPRESSURE",
        "錄製儲存仍在處理；降到低水位後才可繼續。",
      );
    if (this.persistence?.getTelemetry().state === "interrupted")
      throw new RecordingError("RECORDING_STORAGE_FAILED", "錄製儲存已失敗；請先中斷目前錄製。");
    if (this.evaluation?.getTelemetry().backpressured)
      throw new RecordingError(
        "EVALUATION_BACKPRESSURE",
        "錄製評估仍在處理；降到低水位後才可繼續。",
      );
    if (this.evaluation?.getTelemetry().state === "failed")
      throw new RecordingError("EVALUATION_FAILED", "錄製評估已失敗；請先停止並保存完整前綴。");
  }
  private async finalize(token: number): Promise<RecordingArtifact> {
    if (!this.recorder) {
      if (this.artifact) return this.artifact;
      throw new RecordingError("NO_RECORDING", "目前沒有錄製可以完成。");
    }
    const active = this.recorder;
    if (this.evaluation) {
      try {
        await this.evaluation.drain();
      } catch (error) {
        active.interrupt(
          "EVALUATION_FAILED: " + (error instanceof Error ? error.message : "unknown"),
        );
      }
      this.assertCurrent(token);
    }
    try {
      await this.persistence?.drain();
      this.assertCurrent(token);
      const artifact = await (this.options.sealRecording
        ? this.options.sealRecording(active)
        : active.finish());
      this.assertCurrent(token);
      await this.persistence?.publish(artifact);
      this.assertCurrent(token);
      this.artifact = artifact;
      this.recorder = null;
      return artifact;
    } catch (error) {
      active.interrupt("STORAGE_OR_SEAL_FAILED");
      await this.persistence
        ?.cancel(error instanceof Error ? error.message : "STORAGE_OR_SEAL_FAILED")
        .catch(() => {});
      throw error;
    }
  }
  stop(): Promise<RecordingArtifact> {
    return this.operation("finalize", (token) => this.finalize(token));
  }
  async interrupt(reason: string): Promise<RecordingArtifact | null> {
    if (this.preparation) {
      this.abortPreparedStart(reason);
      return null;
    }
    this.replayCursor = null;
    this.paused = false;
    if (this.pending) {
      // An in-progress seal already owns a complete frozen snapshot. Do not race its commit.
      if (["finalize", "captureA"].includes(this.pending.operation))
        throw new RecordingError("HOST_BUSY", "錄製快照正在封存；完成後再重設。");
      this.generation += 1;
      this.options.cancelEvaluation?.(reason);
      this.error = `已中斷：${reason}`;
      return null;
    }
    if (!this.recorder) return null;
    if (this.persistence?.getTelemetry().state === "interrupted") {
      await this.persistence.cancel(reason).catch(() => {});
      this.recorder = null;
      this.generation += 1;
      this.error = `已保留中斷的錄製儲存前綴：${reason}；先前有效成果保留。`;
      return null;
    }
    if (this.recorder.getTelemetry().reason === "SEAL_FAILED") {
      // A failed seal is terminal and caches its rejected promise. Explicit interruption
      // discards only that invalid in-progress recorder, preserving the last valid artifact.
      this.recorder = null;
      this.generation += 1;
      this.error = `已丟棄未能封存的錄製：${reason}；先前有效成果保留。`;
      return null;
    }
    this.recorder.interrupt(reason);
    this.evaluation?.cancel(reason);
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
      const candidate = await reprocessRecording(baseline, changes, async (frame, pinned) => {
        this.assertCurrent(token);
        // The fallback must yield every frame; a 32-frame synchronous burst can
        // otherwise occupy the main thread for hundreds of milliseconds.
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
        this.assertCurrent(token);
        const output = await processor(frame, pinned, baseline.configuration);
        this.assertCurrent(token);
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
  dispose(): void {
    this.abortPreparedStart("DISPOSED");
    this.generation++;
    this.evaluation?.dispose();
    this.options.cancelEvaluation?.("DISPOSED");
    this.recorder?.interrupt("DISPOSED");
    void this.persistence?.cancel("DISPOSED").catch(() => {});
    this.recorder = null;
    this.replayCursor = null;
  }
  /** Restore only an independently hash-verified immutable artifact; no physics is re-run. */
  async restoreArtifact(artifact: RecordingArtifact): Promise<void> {
    this.assertAvailable();
    if (this.recorder || this.replayCursor)
      throw new RecordingError("RECORDER_ACTIVE", "請先停止目前錄製或重播。");
    const token = this.generation;
    await verifyRecording(artifact);
    this.assertCurrent(token);
    this.assertAvailable();
    if (this.recorder || this.replayCursor)
      throw new RecordingError("RECORDER_ACTIVE", "請先停止目前錄製或重播。");
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
    const telemetry = this.preparation ? undefined : this.recorder?.getTelemetry();
    const artifact = this.artifact;
    const replaying = this.replayCursor !== null;
    const durationSeconds =
      artifact && artifact.startTick !== null && artifact.endTick !== null
        ? (artifact.endTick - artifact.startTick) * artifact.configuration.fixedDtS
        : 0;
    const result = this.comparisonResult;
    let status = "先錄製，再保存 A；修改設定後重評 B。";
    if (this.pending?.operation === "candidate") status = "正在以 A 的相同運動／事件重評 B…";
    else if (result)
      status = !result.matched
        ? `無法作相同條件比較：${result.mismatches.map((entry) => entry.field).join("、")}`
        : result.kind === "acoustic"
          ? "acoustic A/B：固定條件相符。"
          : "behavior A/B：固定條件相符。";
    else if (this.slots.B) status = "B 已重評；等待核對比較條件。";
    else if (this.slots.A) status = "A 已保存；B 將重用同一運動／事件 trace。";
    return {
      recording: {
        state:
          this.recorder && !this.preparation
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
      pending: this.pending !== null || this.preparation !== null,
      error: this.error,
    };
  }
}
