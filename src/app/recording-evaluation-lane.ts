import { Ajv2020 } from "ajv/dist/2020.js";
import acousticFrameSchema from "../../schemas/acoustic-frame.schema.json" with { type: "json" };
import type { AcousticFrame, AcousticRequest } from "../acoustics/types.js";
import { canonicalBytes, immutableCloneWithByteLength } from "../experiments/hash.js";
import { RecordingError } from "../experiments/types.js";
import type { RecordingFrameInput } from "../experiments/types.js";
import {
  RECORDING_EVALUATION_MAX_BYTES,
  RECORDING_EVALUATION_MAX_REQUESTS,
} from "./recording-evaluation-limits.js";

export interface RecordingEvaluationInput {
  frame: RecordingFrameInput;
  requests: readonly AcousticRequest[];
}
export interface RecordingEvaluationBudget {
  maxFrames: number;
  maxBytes: number;
  lowWaterFrames: number;
  lowWaterBytes: number;
}
export interface RecordingEvaluationTelemetry {
  state: "accepting" | "draining" | "failed" | "disposed";
  acceptedFrames: number;
  committedFrames: number;
  acceptedTick: number | null;
  committedTick: number | null;
  pendingFrames: number;
  /** Input plus reserved reply bytes, including the in-flight item; not total JS heap. */
  reservedBytes: number;
  peakPendingFrames: number;
  peakReservedBytes: number;
  backpressured: boolean;
  lastError: string | null;
}
export interface RecordingEvaluationLaneOptions {
  evaluate(input: RecordingEvaluationInput): Promise<readonly AcousticFrame[]>;
  /** Disable for serial reference scheduling with one job per captured tick. */
  batchCapture?: boolean;
  commit(frame: RecordingFrameInput): void | Promise<void>;
  onBackpressure?(): void;
  onFailure?(error: Error): void;
  onChanged?(): void;
  cancelEvaluation?(reason: string): void;
  budget?: Partial<RecordingEvaluationBudget>;
}

const DEFAULT_BUDGET: RecordingEvaluationBudget = Object.freeze({
  maxFrames: 8,
  maxBytes: 32 * 1024 * 1024,
  lowWaterFrames: 2,
  lowWaterBytes: 8 * 1024 * 1024,
});
const validFrame = new Ajv2020({ strict: true, ownProperties: true }).compile<AcousticFrame>(
  acousticFrameSchema,
);
const fail = (code: string, message: string) => new RecordingError(code, message);

/** Conservative protocol reservation, enforced against the actual serialized reply. */
export function recordingEvaluationReplyBudget(requests: readonly AcousticRequest[]): number {
  return requests.reduce((bytes, request) => {
    const paths = request.budget?.maxPaths ?? 8;
    if (!Number.isSafeInteger(paths) || paths < 1 || paths > 256)
      throw fail("EVALUATION_REQUEST_BUDGET", "錄製求解路徑預算無效。");
    return bytes + 16384 + paths * 8192;
  }, 2048);
}

export function validateRecordingEvaluationFrames(
  requests: readonly AcousticRequest[],
  frames: readonly AcousticFrame[],
): void {
  if (!Array.isArray(frames) || frames.length !== requests.length)
    throw fail("EVALUATION_REPLY", "錄製求解回覆數量不符。");
  for (let index = 0; index < requests.length; index++) {
    const request = requests[index]!;
    const frame = frames[index]!;
    if (
      !validFrame(frame) ||
      frame.requestId !== request.requestId ||
      frame.sourceId !== request.source.id ||
      frame.listenerId !== request.listener.id ||
      frame.poseTick !== request.poseTick ||
      frame.sceneRevision !== request.sceneRevision ||
      frame.geometryRevision !== request.geometryRevision ||
      frame.stale ||
      frame.pathAvailability === "failed" ||
      frame.paths.length > (request.budget?.maxPaths ?? 8)
    )
      throw fail("EVALUATION_REPLY_IDENTITY", "錄製聲學結果的身分、時鐘或內容無效。");
  }
}

interface Entry {
  input: RecordingEvaluationInput;
  reservedBytes: number;
  replyBudget: number;
  requestBytes: number | undefined;
}

interface CaptureBatch {
  entries: Entry[];
  input: RecordingEvaluationInput;
  result: Promise<readonly AcousticFrame[] | null>;
}

const CAPTURE_JOB_OVERHEAD = canonicalBytes({ kind: "capture", requests: [] }) - 2;
const COMMIT_TASK_BUDGET_MS = 4;

function evaluationTaskTime(): number | null {
  try {
    const time = globalThis.performance?.now();
    return typeof time === "number" && Number.isFinite(time) && time >= 0 ? time : null;
  } catch {
    // An unavailable scheduling clock must not change recording success/errors.
    return null;
  }
}

function yieldEvaluationTask(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return scheduler?.yield
    ? scheduler.yield()
    : new Promise<void>((resolve) => setTimeout(resolve, 0));
}

interface OwnedCaptureJob {
  job: Readonly<{ kind: "capture"; requests: readonly AcousticRequest[] }>;
  byteLength: number;
}
// Only populated after lane admission has canonical-cloned/frozen the entries.
// A caller's shallow Object.freeze is never evidence of immutable ownership.
const captureJobs = new WeakMap<readonly AcousticRequest[], Readonly<OwnedCaptureJob>>();

export function getOwnedRecordingCaptureJob(
  requests: readonly AcousticRequest[],
): Readonly<OwnedCaptureJob> | undefined {
  return captureJobs.get(requests);
}

/** Lossless sequential ownership lane. Live previews deliberately do not use this FIFO. */
export class RecordingEvaluationLane {
  private readonly budget: RecordingEvaluationBudget;
  private entries: Entry[] = [];
  private accepting = true;
  private running = false;
  private batches: CaptureBatch[] = [];
  private dispatchedFrames = 0;
  private dispatchScheduled = false;
  private disposed = false;
  private generation = 0;
  private error: Error | null = null;
  private identity: { revision: number; epoch: string | undefined } | null = null;
  private acceptedTick: number | null = null;
  private committedTick: number | null = null;
  private acceptedFrames = 0;
  private committedFrames = 0;
  private reservedBytes = 0;
  private peakPendingFrames = 0;
  private peakReservedBytes = 0;
  private backpressured = false;
  private waiters: { target: number; resolve(): void; reject(error: Error): void }[] = [];

  constructor(private readonly options: RecordingEvaluationLaneOptions) {
    this.budget = { ...DEFAULT_BUDGET, ...options.budget };
    const { maxFrames, maxBytes, lowWaterFrames, lowWaterBytes } = this.budget;
    if (
      !Number.isSafeInteger(maxFrames) ||
      maxFrames < 1 ||
      maxFrames > 64 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      maxBytes > 128 * 1024 * 1024 ||
      !Number.isSafeInteger(lowWaterFrames) ||
      lowWaterFrames < 0 ||
      lowWaterFrames >= maxFrames ||
      !Number.isSafeInteger(lowWaterBytes) ||
      lowWaterBytes < 0 ||
      lowWaterBytes >= maxBytes
    )
      throw fail("EVALUATION_BUDGET", "錄製評估佇列的容量／低水位無效。");
  }

  enqueue(input: RecordingEvaluationInput): void {
    if (this.disposed || !this.accepting || this.error)
      throw this.error ?? fail("EVALUATION_CLOSED", "錄製評估已停止接納。");
    const { frame, requests } = input;
    if (
      !Number.isSafeInteger(frame.tick) ||
      frame.tick < 0 ||
      (this.acceptedTick !== null && frame.tick !== this.acceptedTick + 1) ||
      (this.identity &&
        (frame.sceneRevision !== this.identity.revision ||
          frame.runEpoch !== this.identity.epoch)) ||
      !Array.isArray(requests) ||
      requests.length > RECORDING_EVALUATION_MAX_REQUESTS ||
      new Set(requests.map((request) => request.requestId)).size !== requests.length ||
      requests.some(
        (request) =>
          request.poseTick !== frame.tick ||
          request.sceneRevision !== frame.sceneRevision ||
          request.listener.id !== frame.listener.id,
      )
    )
      throw fail("EVALUATION_INPUT_IDENTITY", "錄製評估必須接收同一 epoch／revision 的連續 tick。");
    const replyBudget = recordingEvaluationReplyBudget(requests);
    const owned = immutableCloneWithByteLength(input, "requests");
    const reservedBytes = owned.byteLength + replyBudget;
    if (
      this.entries.length >= this.budget.maxFrames ||
      this.reservedBytes + reservedBytes > this.budget.maxBytes
    )
      throw fail("EVALUATION_CAPACITY", "錄製評估容量不足；不覆寫或跳過已接納的 tick。");
    this.identity ??= { revision: frame.sceneRevision, epoch: frame.runEpoch };
    this.acceptedTick = frame.tick;
    this.acceptedFrames++;
    this.entries.push({
      input: owned.value,
      reservedBytes,
      replyBudget,
      requestBytes: owned.propertyByteLength,
    });
    this.reservedBytes += reservedBytes;
    this.peakPendingFrames = Math.max(this.peakPendingFrames, this.entries.length);
    this.peakReservedBytes = Math.max(this.peakReservedBytes, this.reservedBytes);
    if (
      !this.backpressured &&
      (this.entries.length === this.budget.maxFrames ||
        this.reservedBytes >= this.budget.maxBytes * 0.75)
    ) {
      this.backpressured = true;
      this.options.onBackpressure?.();
    }
    this.options.onChanged?.();
    void this.pump();
  }

  /** Snapshot contiguous undispatched entries while retaining all in-flight ownership. */
  private queuedBatch(): { entries: Entry[]; jobBytes: number } {
    const queued = this.entries.slice(this.dispatchedFrames);
    const batch = [queued[0]!];
    let requestCount = batch[0]!.input.requests.length;
    let jobBytes =
      batch[0]!.requestBytes === undefined
        ? canonicalBytes({ kind: "capture", requests: batch[0]!.input.requests })
        : CAPTURE_JOB_OVERHEAD + batch[0]!.requestBytes;
    if (this.options.batchCapture === false || queued.length === 1)
      return { entries: batch, jobBytes };
    for (const entry of queued.slice(1)) {
      const count = entry.input.requests.length;
      if (requestCount + count > RECORDING_EVALUATION_MAX_REQUESTS) break;
      // Concatenation removes the next array's brackets and may add one comma.
      const bytes =
        jobBytes +
        (entry.requestBytes ?? canonicalBytes(entry.input.requests)) -
        2 +
        (requestCount > 0 && count > 0 ? 1 : 0);
      if (bytes > RECORDING_EVALUATION_MAX_BYTES) break;
      batch.push(entry);
      requestCount += count;
      jobBytes = bytes;
    }
    // An oversize first entry still reaches evaluate and retains its original error.
    return { entries: batch, jobBytes };
  }

  private dispatch(generation: number): void {
    const depth = this.options.batchCapture === false ? 1 : 2;
    while (
      this.batches.length < depth &&
      this.dispatchedFrames < this.entries.length &&
      generation === this.generation &&
      !this.error &&
      !this.disposed
    ) {
      const { entries: batch, jobBytes } = this.queuedBatch();
      const input =
        batch.length === 1
          ? batch[0]!.input
          : Object.freeze({
              frame: batch[0]!.input.frame,
              requests: Object.freeze(batch.flatMap((entry) => entry.input.requests)),
            });
      // The first array came from immutableCloneWithByteLength; a batch array
      // contains only those frozen entries. Its exact size was composed above.
      // Requests had the same depth in the admitted {frame, requests} envelope,
      // so rewrapping them cannot bypass canonical JSON depth/shape guards.
      if (batch.every((entry) => entry.requestBytes !== undefined))
        captureJobs.set(
          input.requests,
          Object.freeze({
            job: Object.freeze({ kind: "capture" as const, requests: input.requests }),
            byteLength: jobBytes,
          }),
        );
      this.dispatchedFrames += batch.length;
      const result = this.options.evaluate(input).catch((error: unknown) => {
        // Observe both jobs immediately, including a failure while the head is
        // waiting/committing. Never leave a prefetched rejection unhandled.
        if (generation === this.generation)
          this.fail(error instanceof Error ? error : fail("EVALUATION_FAILED", "錄製評估失敗。"));
        return null;
      });
      this.batches.push({ entries: batch, input, result });
    }
  }

  private async pump(): Promise<void> {
    if (this.error || this.disposed) return;
    if (this.running) {
      // Coalesce synchronous arrivals into the next capture batch, without
      // waiting for the current round trip or its main-thread commits.
      if (!this.dispatchScheduled && this.options.batchCapture !== false) {
        this.dispatchScheduled = true;
        const generation = this.generation;
        queueMicrotask(() => {
          this.dispatchScheduled = false;
          try {
            this.dispatch(generation);
          } catch (error) {
            if (generation === this.generation)
              this.fail(
                error instanceof Error ? error : fail("EVALUATION_FAILED", "錄製評估失敗。"),
              );
          }
        });
      }
      return;
    }
    this.running = true;
    const generation = this.generation;
    try {
      while (this.entries.length > 0 && !this.error && !this.disposed) {
        this.dispatch(generation);
        const { entries: batch, input, result } = this.batches[0]!;
        const frames = await result;
        if (generation !== this.generation || this.disposed) return;
        let taskStarted = evaluationTaskTime();
        if (!Array.isArray(frames) || frames.length !== input.requests.length)
          throw fail("EVALUATION_REPLY", "錄製求解回覆數量不符。");
        let offset = 0;
        for (const entry of batch) {
          if (generation !== this.generation || this.disposed) return;
          const slice = frames.slice(offset, offset + entry.input.requests.length);
          offset += entry.input.requests.length;
          validateRecordingEvaluationFrames(entry.input.requests, slice);
          if (canonicalBytes(slice) > entry.replyBudget)
            throw fail("EVALUATION_REPLY_BUDGET", "錄製求解回覆超過已保留的容量。");
          await this.options.commit({
            ...entry.input.frame,
            acousticFrames: slice,
            acousticResultRefs: slice.map((frame) => frame.requestId),
          });
          if (generation !== this.generation || this.disposed) return;
          this.committedTick = entry.input.frame.tick;
          this.committedFrames++;
          this.entries.shift();
          this.dispatchedFrames--;
          this.reservedBytes -= entry.reservedBytes;
          if (
            this.entries.length <= this.budget.lowWaterFrames &&
            this.reservedBytes <= this.budget.lowWaterBytes
          )
            this.backpressured = false;
          this.options.onChanged?.();
          this.settle();
          // Keep each entry's validation, budget check and commit together.
          // Awaiting a synchronous commit only yields a microtask, so explicitly
          // give input/rendering a turn between entries once this slice is spent.
          if (entry !== batch[batch.length - 1]) {
            const now = evaluationTaskTime();
            if (
              taskStarted === null ||
              now === null ||
              now - taskStarted >= COMMIT_TASK_BUDGET_MS
            ) {
              await yieldEvaluationTask();
              if (generation !== this.generation || this.disposed) return;
              taskStarted = evaluationTaskTime();
            }
          }
        }
        this.batches.shift();
      }
    } catch (error) {
      if (generation === this.generation)
        this.fail(error instanceof Error ? error : fail("EVALUATION_FAILED", "錄製評估失敗。"));
    } finally {
      this.running = false;
      this.settle();
    }
  }

  private fail(error: Error): void {
    if (this.error) return;
    this.error = error;
    this.accepting = false;
    this.generation++;
    this.entries = [];
    this.batches = [];
    this.dispatchedFrames = 0;
    this.reservedBytes = 0;
    this.backpressured = false;
    this.options.cancelEvaluation?.(error.message);
    this.options.onFailure?.(error);
    this.options.onChanged?.();
    this.settle();
  }

  /** Freeze admission before waiting; publication must wait for this barrier. */
  drain(): Promise<void> {
    this.accepting = false;
    return this.flush();
  }

  /** Wait for the current accepted watermark without stopping the producer. */
  flush(): Promise<void> {
    if (this.error) return Promise.reject(this.error);
    if (this.committedFrames >= this.acceptedFrames) return Promise.resolve();
    return new Promise<void>((resolve, reject) =>
      this.waiters.push({ target: this.acceptedFrames, resolve, reject }),
    );
  }

  cancel(reason = "USER_CANCELLED"): void {
    this.fail(fail("EVALUATION_CANCELLED", reason.slice(0, 256)));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel("DISPOSED");
  }

  private settle(): void {
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      if (this.error) waiter.reject(this.error);
      else if (this.committedFrames >= waiter.target) waiter.resolve();
      else this.waiters.push(waiter);
    }
  }

  getTelemetry(): RecordingEvaluationTelemetry {
    return {
      state: this.disposed
        ? "disposed"
        : this.error
          ? "failed"
          : this.accepting
            ? "accepting"
            : "draining",
      acceptedFrames: this.acceptedFrames,
      committedFrames: this.committedFrames,
      acceptedTick: this.acceptedTick,
      committedTick: this.committedTick,
      pendingFrames: this.entries.length,
      reservedBytes: this.reservedBytes,
      peakPendingFrames: this.peakPendingFrames,
      peakReservedBytes: this.peakReservedBytes,
      backpressured: this.backpressured,
      lastError: this.error?.message ?? null,
    };
  }
}
