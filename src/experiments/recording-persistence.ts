import { immutableClone } from "./hash.js";
import { ownRecordingFrame, takeRecordingFrameBytes } from "./recording-frame.js";
import type { RecordingSealSnapshot } from "./recorder.js";
import {
  RecordingError,
  type RecordingArtifact,
  type RecordingFrame,
  type RecordingFrameInput,
} from "./types.js";
import type { StoredRecordingReceipt } from "../persistence/blob-store.js";
import {
  RecordingStorageCommitDiagnostics,
  observeRecordingCommit,
  recordingCommitTime,
  type RecordingCommitObserver,
  type RecordingStorageCommitSnapshot,
} from "./recording-commit-diagnostics.js";

export interface RecordingPersistenceCallbacks {
  onBackpressure?(): void;
  onChanged?(): void;
  onFailure?(error: Error): void;
}
export interface RecordingPersistenceBudget {
  maxFrames: number;
  maxBytes: number;
  lowWaterFrames: number;
  lowWaterBytes: number;
}
export interface RecordingPersistenceTelemetry {
  sessionId: string;
  state: "accepting" | "draining" | "interrupted" | "published";
  acceptedFrames: number;
  processedFrames: number;
  persistedFrames: number;
  publishedFrames: number;
  acceptedTick: number | null;
  processedTick: number | null;
  persistedTick: number | null;
  publishedTick: number | null;
  pendingFrames: number;
  reservedBytes: number;
  peakPendingFrames: number;
  peakReservedBytes: number;
  backpressured: boolean;
  error: string | null;
}
/** Monotonic main-thread observations, not filesystem or storage-engine CPU timings. */
export interface RecordingPersistenceReadinessTelemetry {
  sessionId: string;
  createState: "pending" | "ready" | "failed";
  createStartedAtWallMs: number | null;
  createReadyAtWallMs: number | null;
  createFailedAtWallMs: number | null;
  firstAppendStartedAtWallMs: number | null;
  firstAppendCompletedAtWallMs: number | null;
  /** Bounded original create error detail; null also means its detail is unavailable. */
  createError: string | null;
}
export interface RecordingCapturePersistence {
  enqueue(frame: RecordingFrame): void;
  /** Optionally hand back the exact owned frame after capacity succeeds. */
  waitForCapacity(
    frame: RecordingFrameInput,
    onOwnedFrame?: (frame: RecordingFrame) => void,
  ): Promise<void>;
  flush(): Promise<void>;
  drain(): Promise<void>;
  publish(artifact: RecordingArtifact): Promise<StoredRecordingReceipt>;
  cancel(reason: string): Promise<void>;
  getTelemetry(): RecordingPersistenceTelemetry;
  getReadinessTelemetry?(): Readonly<RecordingPersistenceReadinessTelemetry>;
  getCommitDiagnostics?(): Readonly<RecordingStorageCommitSnapshot>;
  getLastEnqueuedFrameBytes?(): number | null;
  waitUntilReady?(signal?: AbortSignal, timeoutMs?: number): Promise<void>;
}
interface RecordingReadinessWait {
  signal: AbortSignal | undefined;
  promise: Promise<void>;
  resolve(): void;
  reject(reason: unknown): void;
  timer: ReturnType<typeof setTimeout> | null;
  onAbort(): void;
}
export interface EncodedRecordingFrame {
  sequence: number;
  tick: number;
  bytes: ArrayBuffer;
}
export interface RecordingAppendOptions {
  /** Writes are queued, not yet committed. Implementations must ignore callback errors. */
  onIssued?: () => void;
}
export interface RecordingPersistenceBackend {
  create(sessionId: string, snapshot: RecordingSealSnapshot): Promise<void>;
  append(
    sessionId: string,
    frames: readonly EncodedRecordingFrame[],
    observer?: RecordingCommitObserver,
    options?: RecordingAppendOptions,
  ): Promise<void>;
  publish(
    sessionId: string,
    artifact: RecordingArtifact,
    signal: AbortSignal,
  ): Promise<StoredRecordingReceipt>;
  interrupt(sessionId: string, reason: string): Promise<void>;
  heartbeat?(sessionId: string): Promise<void>;
}
const DEFAULT_BUDGET: Readonly<RecordingPersistenceBudget> = Object.freeze({
  maxFrames: 8,
  maxBytes: 32 * 1024 * 1024,
  lowWaterFrames: 2,
  lowWaterBytes: 8 * 1024 * 1024,
});
const error = (code: string, message: string) => new RecordingError(code, message);

/** A failed clock observation must not change storage admission or error handling. */
function readinessTime(): number | null {
  try {
    const value = globalThis.performance?.now();
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}
function createErrorDetail(reason: unknown): string | null {
  try {
    const message =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : null;
    return typeof message === "string" ? message.slice(0, 512) : null;
  } catch {
    return null;
  }
}

function deeplyFrozen(value: unknown, depth = 0): boolean {
  if (value === null || typeof value !== "object") return true;
  if (depth > 48 || !Object.isFrozen(value)) return false;
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !deeplyFrozen(descriptor.value, depth + 1))
      return false;
  }
  return true;
}

/** Capture's lossless encoded ownership queue, including the batch currently writing to storage. */
export class RecordingPersistenceSession implements RecordingCapturePersistence {
  private readonly commitDiagnostics = new RecordingStorageCommitDiagnostics();
  private lastEnqueuedFrameBytes: number | null = null;
  private readonly budget: RecordingPersistenceBudget;
  private readonly ready: Promise<void>;
  private readonly signal = new AbortController();
  private queue: EncodedRecordingFrame[] = [];
  private running: Promise<void> | null = null;
  private dispatchPending: (() => void) | null = null;
  private publication: Promise<StoredRecordingReceipt> | null = null;
  private receipt: StoredRecordingReceipt | null = null;
  private accepting = true;
  private failure: Error | null = null;
  private acceptedFrames = 0;
  private persistedFrames = 0;
  private acceptedTick: number | null = null;
  private persistedTick: number | null = null;
  private reservedBytes = 0;
  private peakFrames = 0;
  private peakBytes = 0;
  private pressure = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private heartbeatPending = false;
  private createStartedAtWallMs: number | null = null;
  private createReadyAtWallMs: number | null = null;
  private createFailedAtWallMs: number | null = null;
  private firstAppendStartedAtWallMs: number | null = null;
  private firstAppendCompletedAtWallMs: number | null = null;
  private createError: string | null = null;
  private firstAppendStartObserved = false;
  private firstAppendCompletionObserved = false;
  private createState: RecordingPersistenceReadinessTelemetry["createState"] = "pending";
  private creationRejectionObserved = false;
  private creationRejectionWon = false;
  private creationRejection: unknown;
  private readinessWait: RecordingReadinessWait | null = null;
  private waiters: { target: number; resolve(): void; reject(error: Error): void }[] = [];

  constructor(
    readonly sessionId: string,
    private readonly snapshot: RecordingSealSnapshot,
    private readonly backend: RecordingPersistenceBackend,
    private readonly callbacks: RecordingPersistenceCallbacks = {},
    limits: Partial<RecordingPersistenceBudget> = {},
  ) {
    this.budget = { ...DEFAULT_BUDGET, ...limits };
    if (limits.maxFrames !== undefined && limits.lowWaterFrames === undefined)
      this.budget.lowWaterFrames = Math.min(this.budget.lowWaterFrames, limits.maxFrames - 1);
    if (limits.maxBytes !== undefined && limits.lowWaterBytes === undefined)
      this.budget.lowWaterBytes = Math.min(this.budget.lowWaterBytes, limits.maxBytes - 1);
    const b = this.budget;
    if (
      !Number.isSafeInteger(b.maxFrames) ||
      b.maxFrames < 1 ||
      b.maxFrames > DEFAULT_BUDGET.maxFrames ||
      !Number.isSafeInteger(b.maxBytes) ||
      b.maxBytes < 1 ||
      b.maxBytes > DEFAULT_BUDGET.maxBytes ||
      !Number.isSafeInteger(b.lowWaterFrames) ||
      b.lowWaterFrames < 0 ||
      b.lowWaterFrames >= b.maxFrames ||
      !Number.isSafeInteger(b.lowWaterBytes) ||
      b.lowWaterBytes < 0 ||
      b.lowWaterBytes >= b.maxBytes
    )
      throw error("RECORDING_STORAGE_BUDGET", "錄製儲存 queue 預算無效。");
    this.createStartedAtWallMs = readinessTime();
    this.ready = backend.create(sessionId, snapshot);
    // Creation may fail while no frames are pending; retain the original error without an unhandled rejection.
    void this.ready
      .then(() => {
        if (!this.backend.heartbeat || this.failure || this.receipt) return;
        this.heartbeat = setInterval(() => {
          if (this.heartbeatPending || this.failure || this.receipt) return;
          this.heartbeatPending = true;
          void this.backend.heartbeat!(this.sessionId)
            .catch((reason: unknown) => {
              if (!this.failure && !this.receipt) this.fail(reason);
            })
            .finally(() => {
              this.heartbeatPending = false;
            });
        }, 10000);
        if (typeof this.heartbeat === "object" && "unref" in this.heartbeat) this.heartbeat.unref();
      })
      .catch((reason: unknown) => this.fail(reason));
    // Observe the original promise without replacing it or moving its existing failure handler.
    void this.ready.then(
      () => {
        this.createState = "ready";
        this.createReadyAtWallMs = readinessTime();
        if (!this.failure) this.finishReadinessWait(true);
      },
      (reason: unknown) => {
        this.createState = "failed";
        this.creationRejectionObserved = true;
        this.creationRejectionWon = this.failure === null;
        this.creationRejection = reason;
        this.createFailedAtWallMs = readinessTime();
        this.createError = createErrorDetail(reason);
        if (this.creationRejectionWon) this.finishReadinessWait(false, reason);
      },
    );
  }

  /** Wait for the original create transaction only; no frame or append is manufactured. */
  waitUntilReady(signal?: AbortSignal, timeoutMs = 10000): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10000)
      return Promise.reject(
        error(
          "RECORDING_STORAGE_PREPARATION_TIMEOUT_RANGE",
          "錄製儲存準備逾時須大於 0 且不超過 10000 ms。",
        ),
      );
    if (this.readinessWait) {
      if (this.readinessWait.signal !== signal)
        return Promise.reject(
          error("RECORDING_STORAGE_PREPARATION_BUSY", "錄製儲存準備已有另一個等待擁有者。"),
        );
      return this.readinessWait.promise;
    }
    if (this.creationRejectionObserved && this.creationRejectionWon)
      return Promise.reject(this.creationRejection);
    if (this.failure) return Promise.reject(this.failure);
    if (signal?.aborted) {
      const reason = error("RECORDING_STORAGE_PREPARATION_ABORTED", "錄製儲存準備已取消。");
      this.fail(reason);
      return Promise.reject(reason);
    }
    if (this.createState === "ready") return Promise.resolve();
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<void>((done, failed) => {
      resolve = done;
      reject = failed;
    });
    const wait: RecordingReadinessWait = {
      signal,
      promise,
      resolve,
      reject,
      timer: null,
      onAbort: () => {
        if (this.readinessWait === wait)
          this.fail(error("RECORDING_STORAGE_PREPARATION_ABORTED", "錄製儲存準備已取消。"));
      },
    };
    this.readinessWait = wait;
    try {
      signal?.addEventListener("abort", wait.onAbort, { once: true });
      if (signal?.aborted) wait.onAbort();
      if (this.readinessWait === wait)
        wait.timer = globalThis.setTimeout(() => {
          if (this.readinessWait === wait)
            this.fail(error("RECORDING_STORAGE_PREPARATION_TIMEOUT", "錄製儲存準備逾時。"));
        }, timeoutMs);
    } catch (reason) {
      this.fail(reason);
    }
    return promise;
  }
  private finishReadinessWait(ready: boolean, reason?: unknown): void {
    const wait = this.readinessWait;
    if (!wait) return;
    this.readinessWait = null;
    if (wait.timer !== null) globalThis.clearTimeout(wait.timer);
    wait.signal?.removeEventListener("abort", wait.onAbort);
    if (ready) wait.resolve();
    else wait.reject(reason);
  }

  enqueue(frame: RecordingFrame): void {
    if (this.failure) throw this.failure;
    if (!this.accepting) throw error("RECORDING_STORAGE_STATE", "錄製儲存已停止接納。");
    if (
      frame.runEpoch !== this.snapshot.runEpoch ||
      frame.sceneRevision !== this.snapshot.configuration.sceneSnapshot.sceneRevision ||
      (this.acceptedTick !== null && frame.tick !== this.acceptedTick + 1)
    ) {
      const failure = error("RECORDING_STORAGE_IDENTITY", "錄製儲存只接納同一身分的連續 tick。");
      this.fail(failure);
      throw failure;
    }
    const bytes = takeRecordingFrameBytes(frame);
    if (
      this.queue.length >= this.budget.maxFrames ||
      this.reservedBytes + bytes.byteLength > this.budget.maxBytes
    ) {
      const failure = error(
        "RECORDING_STORAGE_BACKPRESSURE",
        "錄製儲存容量不足；不覆寫已接納的 tick。",
      );
      this.fail(failure);
      throw failure;
    }
    this.queue.push({ sequence: this.acceptedFrames, tick: frame.tick, bytes });
    try {
      this.lastEnqueuedFrameBytes = bytes.byteLength;
    } catch {
      // Diagnostic data never governs queue ownership.
    }
    this.acceptedFrames++;
    this.acceptedTick = frame.tick;
    this.reservedBytes += bytes.byteLength;
    this.peakFrames = Math.max(this.peakFrames, this.queue.length);
    this.peakBytes = Math.max(this.peakBytes, this.reservedBytes);
    if (
      !this.pressure &&
      (this.queue.length === this.budget.maxFrames ||
        this.reservedBytes >= this.budget.maxBytes * 0.75)
    ) {
      this.pressure = true;
      this.callbacks.onBackpressure?.();
    }
    this.callbacks.onChanged?.();
    this.pump();
  }

  /** Only the background evaluation consumer waits here; the physics producer never awaits storage. */
  async waitForCapacity(
    frame: RecordingFrameInput,
    onOwnedFrame?: (frame: RecordingFrame) => void,
  ): Promise<void> {
    if (this.failure) throw this.failure;
    const owned = ownRecordingFrame(frame, this.snapshot.runEpoch);
    const bytes = owned.byteLength;
    if (bytes > this.budget.maxBytes)
      throw error("RECORDING_STORAGE_BACKPRESSURE", "單一錄製 frame 超過儲存 queue 容量。");
    if (
      this.queue.length >= this.budget.maxFrames ||
      this.reservedBytes + bytes > this.budget.maxBytes
    )
      await this.flush();
    if (this.failure) throw this.failure;
    onOwnedFrame?.(owned.value);
  }

  private pump(): void {
    if (this.failure || this.queue.length === 0) return;
    if (this.running) {
      this.dispatchPending?.();
      return;
    }
    this.running = this.write().finally(() => {
      this.running = null;
      this.settle();
      if (!this.failure && this.queue.length > 0) this.pump();
    });
  }
  private async write(): Promise<void> {
    const batches: {
      frames: EncodedRecordingFrame[];
      issued: boolean;
      completion: Promise<boolean> | undefined;
    }[] = [];
    let dispatchedFrames = 0;
    let active = true;
    try {
      await this.ready;
      const dispatch = () => {
        if (
          !active ||
          this.failure ||
          batches.length >= 2 ||
          dispatchedFrames === this.queue.length ||
          (batches.length > 0 && !batches.at(-1)!.issued)
        )
          return;
        const batch = {
          frames: this.queue.slice(dispatchedFrames),
          issued: false,
          completion: undefined as Promise<boolean> | undefined,
        };
        const inFlightAtStart = batches.length;
        dispatchedFrames += batch.frames.length;
        // Reserve the slot before invoking a backend that may signal synchronously.
        batches.push(batch);
        batch.completion = this.appendBatch(batch.frames, inFlightAtStart, () => {
          if (batch.issued) return;
          batch.issued = true;
          dispatch();
        });
      };
      this.dispatchPending = dispatch;
      dispatch();
      let appendFailed = false;
      while (batches.length > 0) {
        const pending = batches[0]!;
        const appended = await pending.completion!;
        batches.shift();
        if (!appended) appendFailed = true;
        // Await every dispatched append, but never advance past a failed batch.
        if (appendFailed) continue;
        const batch = pending.frames;
        dispatchedFrames -= batch.length;
        if (!this.firstAppendCompletionObserved) {
          this.firstAppendCompletionObserved = true;
          this.firstAppendCompletedAtWallMs = readinessTime();
        }
        // Transaction completion is definitive even if cancel arrived during its final event.
        this.persistedFrames += batch.length;
        this.persistedTick = batch.at(-1)!.tick;
        this.queue.splice(0, batch.length);
        this.reservedBytes -= batch.reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
        if (
          this.queue.length <= this.budget.lowWaterFrames &&
          this.reservedBytes <= this.budget.lowWaterBytes
        )
          this.pressure = false;
        this.callbacks.onChanged?.();
        this.settle();
        dispatch();
      }
    } catch (reason) {
      this.fail(reason);
    } finally {
      active = false;
      this.dispatchPending = null;
      await Promise.all(batches.map((batch) => batch.completion));
    }
  }
  private async appendBatch(
    batch: EncodedRecordingFrame[],
    inFlightAtStart: number,
    onIssued: () => void,
  ): Promise<boolean> {
    if (!this.firstAppendStartObserved) {
      this.firstAppendStartObserved = true;
      this.firstAppendStartedAtWallMs = readinessTime();
    }
    let observer: RecordingCommitObserver | undefined;
    try {
      observer = this.commitDiagnostics.beginBatch();
      let total = 0,
        min = Infinity,
        max = 0;
      for (const frame of batch) {
        const bytes = frame.bytes.byteLength;
        total += bytes;
        min = Math.min(min, bytes);
        max = Math.max(max, bytes);
      }
      observeRecordingCommit(observer, "batchFrameCount", batch.length);
      observeRecordingCommit(observer, "batchEncodedBytes", total);
      observeRecordingCommit(observer, "minFrameBytes", min);
      observeRecordingCommit(observer, "maxFrameBytes", max);
      observeRecordingCommit(observer, "firstTick", batch[0]?.tick);
      observeRecordingCommit(observer, "lastTick", batch.at(-1)?.tick);
      observeRecordingCommit(observer, "queueLengthAtStart", this.queue.length);
      observeRecordingCommit(observer, "reservedBytesAtStart", this.reservedBytes);
      observeRecordingCommit(observer, "inFlightAtStart", inFlightAtStart);
    } catch {
      // Never retain frames or buffers in the scalar observation table.
    }
    observeRecordingCommit(observer, "appendStartedAtMs", recordingCommitTime());
    let appended = false;
    try {
      await this.backend.append(this.sessionId, batch, observer, { onIssued });
      appended = true;
      return true;
    } catch (reason) {
      // Observe rejections immediately, even when an earlier batch is still pending.
      this.fail(reason);
      return false;
    } finally {
      observeRecordingCommit(observer, "appendEndedAtMs", recordingCommitTime());
      observeRecordingCommit(observer, "completed", appended);
    }
  }
  private fail(reason: unknown): void {
    if (this.failure) return;
    this.failure =
      reason instanceof Error ? reason : error("RECORDING_STORAGE_FAILED", "錄製儲存失敗。");
    this.accepting = false;
    this.stopHeartbeat();
    this.finishReadinessWait(false, this.failure);
    this.callbacks.onFailure?.(this.failure);
    this.callbacks.onChanged?.();
    this.settle();
    void this.ready
      .then(() => this.backend.interrupt(this.sessionId, this.failure!.message))
      .catch(() => {});
  }
  private settle(): void {
    const pending = this.waiters.splice(0);
    for (const waiter of pending) {
      if (this.failure) waiter.reject(this.failure);
      else if (this.persistedFrames >= waiter.target) waiter.resolve();
      else this.waiters.push(waiter);
    }
  }
  async flush(): Promise<void> {
    try {
      await this.ready;
      if (this.failure) throw this.failure;
      if (this.persistedFrames < this.acceptedFrames)
        await new Promise<void>((resolve, reject) =>
          this.waiters.push({ target: this.acceptedFrames, resolve, reject }),
        );
    } finally {
      while (this.running) await this.running;
    }
    if (this.failure) throw this.failure;
  }
  drain(): Promise<void> {
    this.accepting = false;
    return this.flush();
  }
  publish(artifact: RecordingArtifact): Promise<StoredRecordingReceipt> {
    if (this.receipt) return Promise.resolve({ ...this.receipt });
    if (this.publication) return this.publication;
    let owned: RecordingArtifact;
    try {
      owned = deeplyFrozen(artifact) ? artifact : immutableClone(artifact);
    } catch (error) {
      return Promise.reject(error);
    }
    const operation = (async () => {
      await this.drain();
      const receipt = await this.backend.publish(this.sessionId, owned, this.signal.signal);
      this.receipt = receipt;
      this.stopHeartbeat();
      this.callbacks.onChanged?.();
      return { ...receipt };
    })();
    this.publication = operation;
    void operation.catch(() => {
      if (this.publication === operation) this.publication = null;
    });
    return operation;
  }
  private stopHeartbeat(): void {
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
  async cancel(reason: string): Promise<void> {
    if (this.receipt) return;
    this.signal.abort(reason);
    this.fail(error("RECORDING_STORAGE_CANCELLED", reason.slice(0, 256)));
    await this.running;
    if (this.publication) {
      try {
        await this.publication;
      } catch {
        /* failed publication never becomes visible */
      }
    }
    if (this.receipt) return;
    this.queue = [];
    this.reservedBytes = 0;
    this.pressure = false;
    await this.ready;
    await this.backend.interrupt(this.sessionId, reason.slice(0, 256));
  }
  /** Copied scalars only; observation cannot create a session or advance its queue. */
  getCommitDiagnostics(): Readonly<RecordingStorageCommitSnapshot> {
    return Object.freeze({
      captureRunId: this.snapshot.runId,
      sessionId: this.sessionId,
      runEpoch: this.snapshot.runEpoch,
      sceneRevision: this.snapshot.configuration.sceneSnapshot.sceneRevision,
      storage: this.commitDiagnostics.snapshot(),
    });
  }
  getLastEnqueuedFrameBytes(): number | null {
    return this.lastEnqueuedFrameBytes;
  }
  getReadinessTelemetry(): Readonly<RecordingPersistenceReadinessTelemetry> {
    return Object.freeze({
      sessionId: this.sessionId,
      createState: this.createState,
      createStartedAtWallMs: this.createStartedAtWallMs,
      createReadyAtWallMs: this.createReadyAtWallMs,
      createFailedAtWallMs: this.createFailedAtWallMs,
      firstAppendStartedAtWallMs: this.firstAppendStartedAtWallMs,
      firstAppendCompletedAtWallMs: this.firstAppendCompletedAtWallMs,
      createError: this.createError,
    });
  }
  getTelemetry(): RecordingPersistenceTelemetry {
    return {
      sessionId: this.sessionId,
      state: this.receipt
        ? "published"
        : this.failure
          ? "interrupted"
          : this.accepting
            ? "accepting"
            : "draining",
      acceptedFrames: this.acceptedFrames,
      processedFrames: this.acceptedFrames,
      persistedFrames: this.persistedFrames,
      publishedFrames: this.receipt ? this.persistedFrames : 0,
      acceptedTick: this.acceptedTick,
      processedTick: this.acceptedTick,
      persistedTick: this.persistedTick,
      publishedTick: this.receipt ? this.persistedTick : null,
      pendingFrames: this.queue.length,
      reservedBytes: this.reservedBytes,
      peakPendingFrames: this.peakFrames,
      peakReservedBytes: this.peakBytes,
      backpressured: this.pressure,
      error: this.failure?.message ?? null,
    };
  }
}
