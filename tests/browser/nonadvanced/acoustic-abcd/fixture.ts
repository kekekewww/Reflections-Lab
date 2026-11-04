import {
  ARMS,
  ORDERS,
  runArm,
  summarize,
  wallNow,
} from "../../../perf/acoustic-abcd/comparison.js";
import type {
  BoundaryTiming,
  MeasuredPort,
  RawRow,
  RecordedRow,
} from "../../../perf/acoustic-abcd/comparison.js";
import { decodeExact } from "../../../../benchmarks/acoustic-transport/corpus-codec.js";

class ChromeMeasuredPort implements MeasuredPort {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  timing: BoundaryTiming | null = null;
  ready: Promise<void>;
  closed: Promise<void>;
  private worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  private sendStart = 0;
  private sendEnd = 0;
  private resolveClosed!: () => void;
  private terminated = false;
  constructor() {
    this.closed = new Promise((resolve) => {
      this.resolveClosed = resolve;
    });
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("CHROME_WORKER_READY_TIMEOUT"));
        this.terminate();
      }, 5000);
      this.worker.onerror = (event) => {
        clearTimeout(timer);
        reject(new Error(event.message));
        this.onerror?.call(this.worker, event);
        this.terminate();
      };
      this.worker.onmessageerror = (event) => {
        this.onmessageerror?.call(this.worker, event);
        this.terminate();
      };
      this.worker.onmessage = (event) => {
        const receivedAt = wallNow(),
          message = event.data;
        if (message.kind === "ready") {
          clearTimeout(timer);
          resolve();
          return;
        }
        const t = message.timing;
        this.timing = {
          sendMs: this.sendEnd - this.sendStart,
          receiveAndQueueMs: t.receiveAt - this.sendStart,
          queueAgeMs: Math.max(0, t.receiveAt - this.sendEnd),
          decodeMs: t.decodeMs,
          solveMs: t.solveMs,
          returnMs: receivedAt - t.resultPostedAt,
          workerMemoryDelta: null,
        };
        this.onmessage?.call(this.worker, new MessageEvent("message", { data: message.value }));
      };
    });
    void this.ready.catch(() => undefined);
  }
  postMessage(value: unknown) {
    this.sendStart = wallNow();
    this.worker.postMessage({ value, sentAt: this.sendStart });
    this.sendEnd = wallNow();
  }
  terminate() {
    if (this.terminated) return;
    this.terminated = true;
    this.worker.terminate();
    this.resolveClosed();
  }
}
async function sha256(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
const target = window as unknown as {
  runABCD(): Promise<unknown>;
  saveABCD(value: unknown): Promise<void>;
};
target.runABCD = async () => {
  const response = await fetch("/__abcd-corpus__/corpus.json");
  if (!response.ok) throw new Error("CORPUS_HTTP");
  const bytes = await response.arrayBuffer(),
    corpusSha256 = await sha256(bytes);
  const manifest = JSON.parse(new TextDecoder().decode(bytes));
  const all: RawRow[] = [];
  const loadRow = async (index: number) => {
    const entry = manifest.rows[index];
    const reply = await fetch(`/__abcd-corpus__/${entry.path}`);
    if (!reply.ok) throw new Error("ROW_HTTP");
    const data = await reply.arrayBuffer();
    if (data.byteLength !== entry.bytes || (await sha256(data)) !== entry.sha256)
      throw new Error("CORPUS_HASH");
    return decodeExact(new TextDecoder().decode(data)) as RecordedRow;
  };
  for (let repetition = 0; repetition < ORDERS.length; repetition++)
    for (const arm of ORDERS[repetition]!) {
      document.getElementById("status")!.textContent = `Repetition ${repetition + 1}, arm ${arm}`;
      const result = await runArm({
        arm,
        repetition,
        rowCount: manifest.rows.length,
        loadRow,
        createPort: () => new ChromeMeasuredPort(),
      });
      await target.saveABCD(result);
      all.push(...result.rows);
    }
  return {
    corpusSha256,
    requests: manifest.rows.length,
    repetitions: ORDERS.length,
    arms: Object.fromEntries(
      ARMS.map((arm) => [arm, summarize(all.filter((row) => row.arm === arm))]),
    ),
    differences: all.filter((row) => row.difference),
    memory: "NOT MEASURED: Chrome exposes no comparable per-request process.memoryUsage API",
    termination:
      "Worker.terminate requested and owned browser closed by runner; Chrome offers no worker native-exit acknowledgment",
    onset: "NOT MEASURED: no AudioEngine or native audio in this transport fixture",
  };
};
