import { Worker as NodeWorker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import type { AcousticServiceOptions } from "../../src/app/acoustic-service.js";

type WorkerPort = ReturnType<NonNullable<AcousticServiceOptions["workerFactory"]>>;
type PortState = "starting" | "ready" | "failed" | "closing" | "closed";
export interface NodeAcousticWorkerOptions {
  /** Local application worker entry; no network module loading is introduced. */
  workerModuleUrl?: URL;
  readyTimeoutMs?: number;
  measurePostMs?: boolean;
}
const READY = "reflection-lab-acoustic-node-ready-1";
const asError = (value: unknown, fallback: string): Error =>
  value instanceof Error ? value : new Error(typeof value === "string" ? value : fallback);

/** Node-only component adapter. This is not a browser Worker or a new product backend. */
export class NodeAcousticWorkerPort implements WorkerPort {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  readonly ready: Promise<void>;
  /** Resolves only on native exit, never merely on requesting termination. */
  readonly closed: Promise<number>;
  private readonly native: NodeWorker;
  private readonly sourceUrl: string;
  private readonly startedAt = performance.now();
  private readonly readyTimeoutMs: number;
  private readonly measurePostMs: boolean;
  private resolveReady!: () => void;
  private rejectReady!: (error: Error) => void;
  private resolveClosed!: (code: number) => void;
  private rejectClosed!: (error: Error) => void;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private readySettled = false;
  private failureReported = false;
  private terminationRequested = false;
  private exited = false;
  private state: PortState = "starting";
  private bootMs: number | null = null;
  private lastPostMs: number | null = null;
  private postCalls = 0;
  private terminationRequests = 0;
  private exitCode: number | null = null;
  private lastError: string | null = null;

  constructor(options: NodeAcousticWorkerOptions = {}) {
    this.readyTimeoutMs = options.readyTimeoutMs ?? 5000;
    if (
      !Number.isSafeInteger(this.readyTimeoutMs) ||
      this.readyTimeoutMs < 1 ||
      this.readyTimeoutMs > 5000
    )
      throw new Error("NODE_ACOUSTIC_READY_BOUNDS");
    const source =
      options.workerModuleUrl ?? new URL("../../src/app/acoustic-worker.ts", import.meta.url);
    if (source.protocol !== "file:") throw new Error("NODE_ACOUSTIC_WORKER_URL");
    this.sourceUrl = source.href;
    this.measurePostMs = options.measurePostMs ?? true;
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.closed = new Promise<number>((resolve, reject) => {
      this.resolveClosed = resolve;
      this.rejectClosed = reject;
    });
    // Service users may only await solve(). Keep auxiliary rejected lifecycle promises
    // handled internally while leaving their original rejection observable to awaiters.
    void this.ready.catch(() => undefined);
    void this.closed.catch(() => undefined);
    this.native = new NodeWorker(new URL("./node-worker.mjs", import.meta.url), {
      workerData: { workerModuleUrl: this.sourceUrl },
      // The plain ESM bootstrap explicitly installs its own locked tsx loader.
      // Inheriting a test runner's loader or --input-type flags would change this backend.
      execArgv: [],
    });
    this.native.on("message", (value: unknown) => this.receive(value));
    this.native.on("error", (error: Error) => this.fail(error));
    this.native.on("messageerror", (error: Error) =>
      this.fail(asError(error, "NODE_ACOUSTIC_MESSAGE_ERROR"), true),
    );
    this.native.once("exit", (code) => this.exitedWith(code));
    this.readyTimer = setTimeout(
      () => this.fail(new Error("NODE_ACOUSTIC_READY_TIMEOUT")),
      this.readyTimeoutMs,
    );
  }

  private clearReadyTimer(): void {
    if (this.readyTimer !== null) clearTimeout(this.readyTimer);
    this.readyTimer = null;
  }
  private settleReady(error?: Error): void {
    if (this.readySettled) return;
    this.readySettled = true;
    this.clearReadyTimer();
    if (error) this.rejectReady(error);
    else this.resolveReady();
  }
  private receive(value: unknown): void {
    if (this.terminationRequested || this.exited) return;
    if (
      value !== null &&
      typeof value === "object" &&
      Object.keys(value).length === 1 &&
      Reflect.get(value, "__acousticComponentReady") === READY
    ) {
      if (!this.readySettled) {
        this.state = "ready";
        this.bootMs = Math.max(0, performance.now() - this.startedAt);
        this.settleReady();
      }
      return;
    }
    this.onmessage?.call(this as unknown as Worker, new MessageEvent("message", { data: value }));
  }
  private fail(error: Error, messageError = false): void {
    if (this.failureReported || this.terminationRequested || this.exited) return;
    // Set every guard before callbacks: AcousticService's handlers synchronously terminate.
    this.failureReported = true;
    this.lastError = error.message.slice(0, 2048);
    this.state = "failed";
    this.settleReady(error);
    try {
      if (messageError)
        this.onmessageerror?.call(this as unknown as Worker, new MessageEvent("messageerror"));
      else this.onerror?.call(this as unknown as Worker, { message: error.message } as ErrorEvent);
    } finally {
      this.terminate();
    }
  }
  private exitedWith(code: number): void {
    this.exited = true;
    this.exitCode = code;
    this.state = "closed";
    this.clearReadyTimer();
    const error = new Error(`NODE_ACOUSTIC_UNEXPECTED_EXIT:${code}`);
    this.settleReady(error);
    // Physical exit owns this acknowledgement; caller exceptions cannot revoke it.
    this.resolveClosed(code);
    if (!this.terminationRequested && !this.failureReported) {
      this.failureReported = true;
      this.lastError = error.message;
      this.onerror?.call(this as unknown as Worker, { message: error.message } as ErrorEvent);
    }
  }

  postMessage(value: unknown): void {
    if (this.terminationRequested || this.exited || this.failureReported)
      throw new Error("NODE_ACOUSTIC_PORT_CLOSED");
    const startedAt = this.measurePostMs ? performance.now() : null;
    this.postCalls++;
    try {
      // Do not await readiness and do not clone here: native Node postMessage must
      // synchronously snapshot exactly once, just as AcousticService's contract requires.
      this.native.postMessage(value);
    } finally {
      this.lastPostMs = startedAt === null ? null : Math.max(0, performance.now() - startedAt);
    }
  }
  terminate(): void {
    if (this.terminationRequested || this.exited) return;
    this.terminationRequested = true;
    this.terminationRequests++;
    this.state = "closing";
    this.settleReady(new Error("NODE_ACOUSTIC_TERMINATED_BEFORE_READY"));
    void this.native.terminate().catch((error: unknown) => {
      const failure = asError(error, "NODE_ACOUSTIC_TERMINATE_FAILED");
      this.lastError = failure.message.slice(0, 2048);
      this.state = "failed";
      this.rejectClosed(failure);
    });
  }
  getTelemetry() {
    return Object.freeze({
      backend: "node:worker_threads" as const,
      state: this.state,
      bootMs: this.bootMs,
      lastPostMs: this.lastPostMs,
      postCalls: this.postCalls,
      terminationRequests: this.terminationRequests,
      readyTimeoutMs: this.readyTimeoutMs,
      exitCode: this.exitCode,
      lastError: this.lastError,
      workerModuleUrl: this.sourceUrl,
      workerExecArgv: Object.freeze([] as string[]),
      actualWireBytes: null,
      timingScope:
        "Parent-observed create-to-ready delay and native Node postMessage call brackets; not browser dispatch or actual wire/copy bytes",
    });
  }
}
