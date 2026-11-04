import { Worker } from "node:worker_threads";
import { wallNow } from "./comparison.js";
import type { BoundaryTiming, MeasuredPort } from "./comparison.js";

export class NodeMeasuredPort implements MeasuredPort {
  onmessage: globalThis.Worker["onmessage"] = null;
  onerror: globalThis.Worker["onerror"] = null;
  onmessageerror: globalThis.Worker["onmessageerror"] = null;
  timing: BoundaryTiming | null = null;
  readonly ready: Promise<void>;
  readonly closed: Promise<number>;
  private native: Worker;
  private sendStart = 0;
  private sendEnd = 0;
  private terminating = false;
  constructor() {
    this.native = new Worker(new URL("./node-worker.mjs", import.meta.url), { execArgv: [] });
    this.closed = new Promise((resolve) =>
      this.native.once("exit", (code) => {
        resolve(code);
        if (!this.terminating)
          this.onerror?.call(
            this as unknown as globalThis.Worker,
            { message: "WORKER_EXIT" } as ErrorEvent,
          );
      }),
    );
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("WORKER_READY_TIMEOUT"));
        this.terminate();
      }, 5000);
      this.native.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
        this.onerror?.call(
          this as unknown as globalThis.Worker,
          { message: error.message } as ErrorEvent,
        );
        this.terminate();
      });
      this.native.on("message", (message) => {
        const receivedAt = wallNow();
        if (message.kind === "ready") {
          clearTimeout(timer);
          resolve();
          return;
        }
        const timing = message.timing;
        this.timing = {
          sendMs: this.sendEnd - this.sendStart,
          receiveAndQueueMs: timing.receiveAt - this.sendStart,
          queueAgeMs: Math.max(0, timing.receiveAt - this.sendEnd),
          decodeMs: timing.decodeMs,
          solveMs: timing.solveMs,
          returnMs: receivedAt - timing.resultPostedAt,
          workerMemoryDelta: timing.workerMemoryDelta,
        };
        this.onmessage?.call(
          this as unknown as globalThis.Worker,
          new MessageEvent("message", { data: message.value }),
        );
      });
    });
    void this.ready.catch(() => undefined);
  }
  postMessage(value: unknown): void {
    this.sendStart = wallNow();
    this.native.postMessage({ value, sentAt: this.sendStart });
    this.sendEnd = wallNow();
  }
  terminate(): void {
    if (this.terminating) return;
    this.terminating = true;
    void this.native.terminate();
  }
}
