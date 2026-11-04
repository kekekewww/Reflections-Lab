import { Worker } from "node:worker_threads";

/** Independent diagnostic ONLY. No product arm uses this pool or transfers Scene/UI buffers. */
export class OwnedTransferProbe {
  private worker: Worker | null = null;
  private exit: Promise<number> = Promise.resolve(0);
  private owned = new WeakMap<ArrayBuffer, number>();
  private pending: {
    ticket: number;
    generation: number;
    bytes: number;
    resolve(buffer: ArrayBuffer): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private ticket = 0;
  private generation = 0;
  ownedCopy(bytes: Uint8Array): ArrayBuffer {
    if (!bytes.byteLength || bytes.byteLength > 2 * 1024 * 1024)
      throw new Error("PROBE_PAYLOAD_CAP");
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    this.owned.set(buffer, this.generation);
    return buffer;
  }
  private ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker(
      `
      const { parentPort } = require('node:worker_threads');
      parentPort.on('message', (message) => {
        if (message.mode === 'crash') throw new Error('PROBE_CRASH');
        if (message.mode === 'hold') return;
        parentPort.postMessage(message, [message.buffer]);
      });`,
      { eval: true, execArgv: [] },
    );
    const worker = this.worker;
    this.exit = new Promise((resolve) => worker.once("exit", resolve));
    worker.on("message", (message) => {
      if (worker === this.worker) this.acceptReturn(message);
    });
    worker.on("error", (error) => {
      if (worker === this.worker) void this.cancel(error.message);
    });
  }
  sendOwned(
    buffer: ArrayBuffer,
    mode: "return" | "hold" | "crash" = "return",
  ): Promise<ArrayBuffer> {
    if (this.pending) return Promise.reject(new Error("PROBE_POOL_BUSY"));
    if (this.owned.get(buffer) !== this.generation || buffer.byteLength === 0)
      return Promise.reject(new Error("PROBE_NOT_OWNED_OR_STALE"));
    this.ensureWorker();
    const ticket = ++this.ticket,
      generation = this.generation,
      bytes = buffer.byteLength;
    return new Promise((resolve, reject) => {
      this.pending = {
        ticket,
        generation,
        bytes,
        resolve,
        reject,
        timer: setTimeout(() => {
          void this.cancel("PROBE_TIMEOUT");
        }, 1000),
      };
      this.worker!.postMessage({ ticket, generation, mode, buffer }, [buffer]);
    });
  }
  /** Stale/duplicate/foreign returns cannot acquire current generation ownership. */
  acceptReturn(message: { ticket: number; generation: number; buffer: ArrayBuffer }): boolean {
    const pending = this.pending;
    if (
      !pending ||
      message.ticket !== pending.ticket ||
      message.generation !== pending.generation ||
      !(message.buffer instanceof ArrayBuffer) ||
      message.buffer.byteLength !== pending.bytes
    )
      return false;
    clearTimeout(pending.timer);
    this.pending = null;
    this.owned.set(message.buffer, this.generation);
    pending.resolve(message.buffer);
    return true;
  }
  async cancel(reason = "PROBE_CANCELLED"): Promise<void> {
    const pending = this.pending;
    this.pending = null;
    this.generation++;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    const worker = this.worker,
      exit = this.exit;
    this.worker = null;
    if (worker) {
      await worker.terminate();
      await exit;
    }
  }
  snapshot() {
    return {
      inFlight: this.pending ? 1 : 0,
      cap: 1,
      generation: this.generation,
      ticket: this.ticket,
    };
  }
}
