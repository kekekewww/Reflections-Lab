import { Ajv2020 } from "ajv/dist/2020.js";
import acousticFrameSchema from "../../schemas/acoustic-frame.schema.json" with { type: "json" };
import { solveAcoustics } from "../acoustics/index.js";
import type { AcousticFrame, AcousticRequest } from "../acoustics/types.js";
import type { BehaviorAsset } from "../audio-behavior/types.js";
import {
  canonicalBytes,
  immutableClone,
  immutableCloneWithByteLength,
} from "../experiments/hash.js";
import { RecordingError } from "../experiments/types.js";
import type { RecordingConfiguration, RecordingFrame } from "../experiments/types.js";
import type { ReprocessConfiguration, ReprocessedFrame } from "../experiments/reprocess.js";
import { RecordingProcessor } from "./recording-processor.js";
import {
  getOwnedRecordingCaptureJob,
  validateRecordingEvaluationFrames,
} from "./recording-evaluation-lane.js";
import { RECORDING_EVALUATION_MAX_BYTES as MAX_BYTES } from "./recording-evaluation-limits.js";

export interface RecordingEvaluationWorkerPort {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessageerror: ((event: unknown) => void) | null;
  postMessage(value: unknown): void;
  terminate(): void;
}
/** Preparation has its own fixed protocol; it is never an acoustic capture job. */
export interface RecordingEvaluationPrepareRequest {
  kind: "prepare";
  id: number;
  generation: number;
  protocolVersion: 1;
}
export type RecordingEvaluationJob =
  | { kind: "capture"; requests: readonly AcousticRequest[] }
  | {
      kind: "reprocess";
      frame: RecordingFrame;
      changes: ReprocessConfiguration;
      baseline: RecordingConfiguration;
      assets: readonly BehaviorAsset[];
    };
export interface RecordingEvaluationClientOptions {
  useWorker?: boolean;
  workerFactory?: () => RecordingEvaluationWorkerPort;
  getAssets?(): readonly BehaviorAsset[];
  timeoutMs?: number;
  /** Reference/fallback scheduling injection; production yields one task per frame. */
  yieldTask?: () => Promise<void>;
}
/**
 * Bounded main-thread observations of the latest successfully created worker
 * generation. Creation does not mean readiness. A protocol reply passed only
 * the transport envelope and owned-clone checks, not capture/reprocess semantic
 * validation, solver completion timing, or an audio/DSP readiness test.
 * Retired generation values remain readable until another worker is created.
 */
export interface RecordingEvaluationReadinessDiagnostics {
  mode: "worker" | "yieldingReference";
  workerGeneration: number | null;
  workerActive: boolean;
  workerCreateCount: number;
  firstWorkerCreatedAtWallMs: number | null;
  /** Start of the first successfully returned postMessage call. */
  firstWorkerPostedAtWallMs: number | null;
  firstWorkerProtocolReplyAtWallMs: number | null;
  workerPrepared: boolean;
  preparing: boolean;
  /** Start of the first successfully returned preparation-control postMessage call. */
  preparePostedAtWallMs: number | null;
  /** Main-thread receipt of the first correlated successful ACK, not DSP readiness. */
  firstPreparedAckAtWallMs: number | null;
}
interface RecordingEvaluationPreparation {
  id: number;
  generation: number;
  worker: RecordingEvaluationWorkerPort;
  signal: AbortSignal | undefined;
  abortListener: (() => void) | null;
  promise: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}
const MAX_PREPARE_REPLY_BYTES = 2048;
const validFrame = new Ajv2020({ strict: true, ownProperties: true }).compile<AcousticFrame>(
  acousticFrameSchema,
);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const failure = (code: string, message: string) => new RecordingError(code, message);

/** Two Worker capture jobs at most; reference/reprocess work remains exclusive. */
export class RecordingEvaluationClient {
  private worker: RecordingEvaluationWorkerPort | null = null;
  private sequence = 0;
  private generation = 0;
  private disposed = false;
  private assetsRun: string | null = null;
  private assets: readonly BehaviorAsset[] = [];
  private processor = new RecordingProcessor({ getAssets: () => [...this.assets] });
  private pending = new Map<
    number,
    {
      kind: RecordingEvaluationJob["kind"];
      resolve(value: unknown): void;
      reject(error: Error): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly timeoutMs: number;
  private readinessWorkerGeneration: number | null = null;
  private workerCreateCount = 0;
  private firstWorkerCreatedAtWallMs: number | null = null;
  private firstWorkerPostedAtWallMs: number | null = null;
  private firstWorkerProtocolReplyAtWallMs: number | null = null;
  private firstWorkerPostObserved = false;
  private firstWorkerProtocolReplyObserved = false;
  private preparation: RecordingEvaluationPreparation | null = null;
  private preparedWorker: RecordingEvaluationWorkerPort | null = null;
  private preparedGeneration: number | null = null;
  private preparePostedAtWallMs: number | null = null;
  private firstPreparedAckAtWallMs: number | null = null;
  private firstPreparePostObserved = false;
  private firstPreparedAckObserved = false;

  constructor(private readonly options: RecordingEvaluationClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 10000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120000)
      throw failure("EVALUATION_TIMEOUT_RANGE", "錄製評估逾時預算無效。");
  }

  private get busy(): boolean {
    return this.preparation !== null || this.pending.size > 0;
  }

  get mode(): "worker" | "yieldingReference" {
    return this.options.workerFactory ||
      (this.options.useWorker !== false && typeof Worker !== "undefined")
      ? "worker"
      : "yieldingReference";
  }

  /** An explicit read never constructs a worker or changes its readiness state. */
  getReadinessDiagnostics(): Readonly<RecordingEvaluationReadinessDiagnostics> {
    return Object.freeze({
      mode: this.mode,
      workerGeneration: this.readinessWorkerGeneration,
      workerActive: this.worker !== null,
      workerCreateCount: this.workerCreateCount,
      firstWorkerCreatedAtWallMs: this.firstWorkerCreatedAtWallMs,
      firstWorkerPostedAtWallMs: this.firstWorkerPostedAtWallMs,
      firstWorkerProtocolReplyAtWallMs: this.firstWorkerProtocolReplyAtWallMs,
      workerPrepared:
        this.worker !== null &&
        this.preparedWorker === this.worker &&
        this.preparedGeneration === this.generation,
      preparing: this.preparation !== null,
      preparePostedAtWallMs: this.preparePostedAtWallMs,
      firstPreparedAckAtWallMs: this.firstPreparedAckAtWallMs,
    });
  }

  private diagnosticWallTime(): number | null {
    try {
      const value = globalThis.performance?.now();
      return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
      // Observation failure must not change capture admission, its clock or error.
      return null;
    }
  }

  /**
   * Warm only the owned worker's module/protocol before recording admission.
   * Same-signal callers share one operation; this never emits a capture frame.
   */
  prepare(signal?: AbortSignal): Promise<void> {
    if (this.disposed) return Promise.reject(failure("EVALUATION_DISPOSED", "錄製評估已關閉。"));
    if (signal?.aborted)
      return Promise.reject(failure("EVALUATION_PREPARE_CANCELLED", "錄製評估準備已取消。"));
    if (this.preparation) {
      return this.preparation.signal === signal
        ? this.preparation.promise
        : Promise.reject(failure("EVALUATION_PREPARE_OWNER", "另一個操作正在準備錄製評估。"));
    }
    if (this.busy) return Promise.reject(failure("EVALUATION_BUSY", "錄製評估已有進行中的工作。"));
    if (this.mode === "yieldingReference") return Promise.resolve();
    if (
      this.worker !== null &&
      this.preparedWorker === this.worker &&
      this.preparedGeneration === this.generation
    )
      return Promise.resolve();

    const generation = this.generation;
    let worker: RecordingEvaluationWorkerPort;
    try {
      worker = this.ensureWorker();
    } catch (error) {
      const reason =
        error instanceof Error
          ? error
          : failure("EVALUATION_PREPARE_FAILED", "錄製評估工作者建立失敗。");
      this.abort(reason);
      return Promise.reject(reason);
    }
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((done, failed) => {
      resolve = done;
      reject = failed;
    });
    const id = ++this.sequence;
    const timer = globalThis.setTimeout(() => {
      if (this.preparation === preparation)
        this.abort(failure("EVALUATION_PREPARE_TIMEOUT", "錄製評估準備逾時。"));
    }, this.timeoutMs);
    const preparation: RecordingEvaluationPreparation = {
      id,
      generation,
      worker,
      signal,
      abortListener: null,
      promise,
      resolve,
      reject,
      timer,
    };
    this.preparation = preparation;
    try {
      if (signal) {
        preparation.abortListener = () => {
          if (this.preparation === preparation)
            this.abort(failure("EVALUATION_PREPARE_CANCELLED", "錄製評估準備已取消。"));
        };
        signal.addEventListener("abort", preparation.abortListener, { once: true });
      }
      if (signal?.aborted || this.disposed || generation !== this.generation) {
        this.abort(failure("EVALUATION_PREPARE_CANCELLED", "錄製評估準備已取消。"));
        return promise;
      }
      const firstPost = !this.firstPreparePostObserved;
      const postedAt = firstPost ? this.diagnosticWallTime() : null;
      const request: RecordingEvaluationPrepareRequest = {
        kind: "prepare",
        id,
        generation,
        protocolVersion: 1,
      };
      worker.postMessage(request);
      if (firstPost && this.readinessWorkerGeneration === generation) {
        this.firstPreparePostObserved = true;
        this.preparePostedAtWallMs = postedAt;
      }
    } catch (error) {
      this.abort(
        error instanceof Error ? error : failure("EVALUATION_SEND", "錄製評估準備傳送失敗。"),
      );
    }
    return promise;
  }

  private clearPreparation(preparation: RecordingEvaluationPreparation): void {
    if (this.preparation !== preparation) return;
    this.preparation = null;
    globalThis.clearTimeout(preparation.timer);
    if (preparation.signal && preparation.abortListener)
      preparation.signal.removeEventListener("abort", preparation.abortListener);
  }

  private preparedReply(
    data: unknown,
    worker: RecordingEvaluationWorkerPort,
    generation: number,
  ): void {
    const preparation = this.preparation;
    if (
      !preparation ||
      preparation.worker !== worker ||
      preparation.generation !== generation ||
      worker !== this.worker ||
      generation !== this.generation
    )
      return;
    try {
      if (!record(data)) throw failure("EVALUATION_PREPARE_PROTOCOL", "錄製評估準備回覆協定無效。");
      if (data.id !== preparation.id) return;
      const allowed = ["kind", "ok", "id", "generation", "protocolVersion"];
      if (data.ok === false) allowed.push("error");
      if (
        data.kind !== "prepared" ||
        data.generation !== generation ||
        data.protocolVersion !== 1 ||
        Object.keys(data).length !== allowed.length ||
        Object.keys(data).some((key) => !allowed.includes(key)) ||
        canonicalBytes(data) > MAX_PREPARE_REPLY_BYTES
      )
        throw failure("EVALUATION_PREPARE_PROTOCOL", "錄製評估準備回覆協定無效。");
      if (data.ok === false) {
        if (!record(data.error) || typeof data.error.message !== "string")
          throw failure("EVALUATION_PREPARE_PROTOCOL", "錄製評估準備錯誤回覆無效。");
        this.abort(
          failure(
            typeof data.error.code === "string" && data.error.code.length > 0
              ? data.error.code.slice(0, 80)
              : "EVALUATION_PREPARE_FAILED",
            data.error.message.slice(0, 512),
          ),
        );
        return;
      }
      if (data.ok !== true)
        throw failure("EVALUATION_PREPARE_PROTOCOL", "錄製評估準備回覆協定無效。");
      if (!this.firstPreparedAckObserved) {
        this.firstPreparedAckObserved = true;
        this.firstPreparedAckAtWallMs = this.diagnosticWallTime();
      }
      this.preparedWorker = worker;
      this.preparedGeneration = generation;
      this.clearPreparation(preparation);
      preparation.resolve();
    } catch {
      this.abort(failure("EVALUATION_PREPARE_PROTOCOL", "錄製評估準備回覆協定無效。"));
    }
  }

  private receiveWorkerMessage(
    data: unknown,
    worker: RecordingEvaluationWorkerPort,
    generation: number,
  ): void {
    if (worker !== this.worker || generation !== this.generation) return;
    if (this.preparation) {
      this.preparedReply(data, worker, generation);
      return;
    }
    // A delayed ACK is never an evaluation result or a first evaluation reply.
    if (record(data) && data.kind === "prepared") return;
    this.reply(data, worker);
  }

  private ensureWorker(): RecordingEvaluationWorkerPort {
    if (this.worker) return this.worker;
    const generation = this.generation;
    const worker =
      this.options.workerFactory?.() ??
      (new Worker(new URL("./recording-evaluation.worker.ts", import.meta.url), {
        type: "module",
      }) as unknown as RecordingEvaluationWorkerPort);
    this.worker = worker;
    this.readinessWorkerGeneration = generation;
    this.workerCreateCount++;
    this.firstWorkerCreatedAtWallMs = this.diagnosticWallTime();
    this.firstWorkerPostedAtWallMs = null;
    this.firstWorkerProtocolReplyAtWallMs = null;
    this.firstWorkerPostObserved = false;
    this.firstWorkerProtocolReplyObserved = false;
    this.preparePostedAtWallMs = null;
    this.firstPreparedAckAtWallMs = null;
    this.firstPreparePostObserved = false;
    this.firstPreparedAckObserved = false;
    worker.onmessage = ({ data }) => this.receiveWorkerMessage(data, worker, generation);
    worker.onerror = () => {
      if (worker === this.worker && generation === this.generation)
        this.abort(failure("EVALUATION_WORKER_ERROR", "錄製評估 Worker 失敗。"));
    };
    worker.onmessageerror = () => {
      if (worker === this.worker && generation === this.generation)
        this.abort(failure("EVALUATION_WORKER_MESSAGE", "錄製評估 Worker 回覆無法解碼。"));
    };
    return worker;
  }

  async capture(requests: readonly AcousticRequest[]): Promise<readonly AcousticFrame[]> {
    // Keep only independent comparison fields; execute owns the full payload.
    const identities = requests.map((request) => ({
      ...request,
      source: { ...request.source },
      listener: { ...request.listener },
      ...(request.budget ? { budget: { ...request.budget } } : {}),
    }));
    const output = await this.execute({ kind: "capture", requests });
    if (!Array.isArray(output)) throw this.invalidReply("EVALUATION_REPLY", "錄製求解回覆無效。");
    try {
      validateRecordingEvaluationFrames(identities, output as AcousticFrame[]);
    } catch (error) {
      this.cancel("INVALID_REPLY");
      throw error;
    }
    return output as AcousticFrame[];
  }

  async reprocess(
    frame: RecordingFrame,
    changes: ReprocessConfiguration,
    baseline: RecordingConfiguration,
  ): Promise<ReprocessedFrame> {
    if (this.busy) throw failure("EVALUATION_BUSY", "錄製評估已有進行中的工作。");
    if (this.assetsRun !== changes.runId) {
      this.assets = immutableClone(this.options.getAssets?.() ?? []);
      this.assetsRun = changes.runId;
    }
    const identity = {
      tick: frame.tick,
      listenerId: frame.listener.id,
      revision: changes.sceneSnapshot?.sceneRevision ?? baseline.sceneSnapshot.sceneRevision,
      runId: changes.runId,
    };
    const output = await this.execute({
      kind: "reprocess",
      frame,
      changes,
      baseline,
      assets: this.assets,
    });
    if (
      !record(output) ||
      Object.keys(output).some(
        (key) =>
          ![
            "behaviorDecisions",
            "audioEvents",
            "acousticFrames",
            "acousticResultRefs",
            "behaviorSnapshot",
          ].includes(key),
      ) ||
      !Array.isArray(output.behaviorDecisions) ||
      !Array.isArray(output.audioEvents) ||
      !Array.isArray(output.acousticFrames) ||
      !Array.isArray(output.acousticResultRefs) ||
      output.acousticFrames.length !== output.acousticResultRefs.length ||
      !record(output.behaviorSnapshot) ||
      !record(output.behaviorSnapshot.inputFrame) ||
      output.behaviorSnapshot.inputFrame.tick !== identity.tick ||
      output.behaviorSnapshot.inputFrame.runEpoch !== identity.runId
    )
      throw this.invalidReply("EVALUATION_REPROCESS_REPLY", "重評回覆的內容或來源不符。");
    for (let index = 0; index < output.acousticFrames.length; index++) {
      const acoustic = output.acousticFrames[index] as AcousticFrame;
      if (
        !validFrame(acoustic) ||
        acoustic.poseTick !== identity.tick ||
        acoustic.sceneRevision !== identity.revision ||
        acoustic.listenerId !== identity.listenerId ||
        acoustic.stale ||
        acoustic.pathAvailability === "failed" ||
        acoustic.requestId !== output.acousticResultRefs[index]
      )
        throw this.invalidReply("EVALUATION_REPROCESS_REPLY", "重評聲學回覆的身分或時鐘不符。");
    }
    return output as unknown as ReprocessedFrame;
  }

  private async execute(job: RecordingEvaluationJob): Promise<unknown> {
    if (this.disposed) throw failure("EVALUATION_DISPOSED", "錄製評估已關閉。");
    if (
      this.busy &&
      (this.preparation !== null ||
        this.mode !== "worker" ||
        job.kind !== "capture" ||
        this.pending.size >= 2 ||
        [...this.pending.values()].some((pending) => pending.kind !== "capture"))
    )
      throw failure("EVALUATION_BUSY", "錄製評估已有進行中的工作。");
    const owned = job.kind === "capture" ? getOwnedRecordingCaptureJob(job.requests) : undefined;
    if ((owned?.byteLength ?? canonicalBytes(job)) > MAX_BYTES)
      throw failure("EVALUATION_PAYLOAD", "錄製評估輸入超過容量。");
    const input = owned?.job ?? immutableClone(job);
    const generation = this.generation;
    if (this.mode === "yieldingReference") {
      const id = ++this.sequence;
      return await new Promise<unknown>((resolve, reject) => {
        const timer = globalThis.setTimeout(
          () => this.abort(failure("EVALUATION_TIMEOUT", "錄製 reference 評估逾時。")),
          this.timeoutMs,
        );
        this.pending.set(id, { kind: input.kind, resolve, reject, timer });
        void (async () => {
          await (this.options.yieldTask?.() ??
            new Promise<void>((done) => globalThis.setTimeout(done, 0)));
          if (this.disposed || generation !== this.generation || !this.pending.has(id)) return;
          const output =
            input.kind === "capture"
              ? input.requests.map((request) => solveAcoustics(request).frame)
              : await this.processor.process(input.frame, input.changes, input.baseline);
          if (generation === this.generation && this.pending.has(id))
            this.reply({ id, ok: true, output });
        })().catch((error: unknown) => {
          if (generation === this.generation && this.pending.has(id))
            this.abort(
              error instanceof Error
                ? error
                : failure("EVALUATION_FAILED", "錄製 reference 評估失敗。"),
            );
        });
      });
    }
    this.ensureWorker();
    const id = ++this.sequence;
    return await new Promise<unknown>((resolve, reject) => {
      const timer = globalThis.setTimeout(
        () => this.abort(failure("EVALUATION_TIMEOUT", "錄製評估 Worker 逾時。")),
        this.timeoutMs,
      );
      this.pending.set(id, { kind: input.kind, resolve, reject, timer });
      try {
        const firstPost = !this.firstWorkerPostObserved;
        const postedAt = firstPost ? this.diagnosticWallTime() : null;
        this.worker!.postMessage({ id, input });
        // A throwing postMessage is not a successfully posted worker request.
        // Preserve null when the first observed call had no usable wall clock.
        if (firstPost && this.readinessWorkerGeneration === generation) {
          this.firstWorkerPostObserved = true;
          this.firstWorkerPostedAtWallMs = postedAt;
        }
      } catch (error) {
        this.abort(
          error instanceof Error ? error : failure("EVALUATION_SEND", "錄製評估傳送失敗。"),
        );
      }
    });
  }

  private reply(data: unknown, sourceWorker: RecordingEvaluationWorkerPort | null = null): void {
    if (this.pending.size === 0) return;
    if (!record(data)) {
      this.abort(failure("EVALUATION_PROTOCOL", "錄製評估回覆協定無效。"));
      return;
    }
    const pending = typeof data.id === "number" ? this.pending.get(data.id) : undefined;
    if (!pending) return; // An earlier generation can never resolve a current request.
    if (data.ok === false && record(data.error) && typeof data.error.message === "string") {
      this.abort(
        failure(
          typeof data.error.code === "string" ? data.error.code.slice(0, 80) : "EVALUATION_FAILED",
          data.error.message.slice(0, 512),
        ),
      );
      return;
    }
    try {
      if (data.ok !== true)
        throw failure("EVALUATION_PROTOCOL", "錄製評估回覆超過容量或協定無效。");
      const owned = immutableCloneWithByteLength(data.output);
      if (owned.byteLength > MAX_BYTES)
        throw failure("EVALUATION_PROTOCOL", "錄製評估回覆超過容量或協定無效。");
      const output = owned.value;
      if (
        sourceWorker !== null &&
        sourceWorker === this.worker &&
        this.readinessWorkerGeneration === this.generation &&
        !this.firstWorkerProtocolReplyObserved
      ) {
        this.firstWorkerProtocolReplyObserved = true;
        this.firstWorkerProtocolReplyAtWallMs = this.diagnosticWallTime();
      }
      globalThis.clearTimeout(pending.timer);
      this.pending.delete(data.id as number);
      pending.resolve(output);
    } catch (error) {
      this.abort(
        error instanceof Error ? error : failure("EVALUATION_PROTOCOL", "錄製評估回覆無效。"),
      );
    }
  }

  private abort(error: Error): void {
    this.generation++;
    this.preparedWorker = null;
    this.preparedGeneration = null;
    const preparation = this.preparation;
    if (preparation) this.clearPreparation(preparation);
    this.assetsRun = null;
    this.assets = [];
    this.processor = new RecordingProcessor({ getAssets: () => [...this.assets] });
    const pending = this.pending;
    this.pending = new Map();
    for (const job of pending.values()) globalThis.clearTimeout(job.timer);
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      try {
        worker.terminate();
      } catch {
        /* The original error remains authoritative. */
      }
    }
    for (const job of pending.values()) job.reject(error);
    preparation?.reject(error);
  }

  private invalidReply(code: string, message: string): RecordingError {
    this.cancel("INVALID_REPLY");
    return failure(code, message);
  }

  cancel(reason = "USER_CANCELLED"): void {
    this.abort(failure("EVALUATION_CANCELLED", reason.slice(0, 256)));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel("DISPOSED");
  }
}
