export interface WorkerPort {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessageerror?: ((event: unknown) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}
const MAX_BYTES = 70 * 1024 * 1024;
const fail = (code: string) => new Error(code);
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
function freezeDeep(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) freezeDeep(child);
  Object.freeze(value);
}
export class RecordingWorkerClient {
  private busy = false;
  private disposed = false;
  private pending: ((error: Error) => void) | null = null;
  constructor(
    private readonly factory: () => WorkerPort,
    private readonly timeoutMs: number,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000)
      throw fail("TIMEOUT_RANGE");
  }
  async run(input: {
    runId: string;
  }): Promise<{ artifact: unknown; bytes: ArrayBuffer; encodedSha256: string }> {
    if (this.disposed) throw fail("DISPOSED");
    if (this.busy) throw fail("BUSY");
    this.busy = true;
    const id = crypto.randomUUID();
    let worker: WorkerPort;
    try {
      worker = this.factory();
    } catch (e) {
      this.busy = false;
      throw e;
    }
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (
        error: unknown,
        result?: { artifact: unknown; bytes: ArrayBuffer; encodedSha256: string },
        failed = true,
      ) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.pending = null;
        this.busy = false;
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        try {
          worker.terminate();
        } catch (cleanup) {
          reject(failed ? new AggregateError([error, cleanup], "WORKER_CLEANUP") : cleanup);
          return;
        }
        if (failed) reject(error);
        else resolve(result!);
      };
      const timer = setTimeout(() => finish(fail("TIMEOUT")), this.timeoutMs);
      this.pending = (error) => finish(error);
      worker.onerror = () => finish(fail("WORKER_ERROR"));
      worker.onmessageerror = () => finish(fail("WORKER_MESSAGE_ERROR"));
      worker.onmessage = ({ data }) => {
        void (async () => {
          try {
            if (!data || typeof data !== "object") throw fail("PROTOCOL");
            const r = data as Record<string, unknown>;
            if (r.id === id && r.ok === false) {
              const details = r.error;
              if (!details || typeof details !== "object") throw fail("PROTOCOL");
              const e = details as Record<string, unknown>;
              if (
                typeof e.name !== "string" ||
                e.name.length > 80 ||
                typeof e.code !== "string" ||
                e.code.length > 80 ||
                typeof e.message !== "string" ||
                e.message.length > 512
              )
                throw fail("PROTOCOL");
              const error = Object.assign(new Error(e.message), { name: e.name, code: e.code });
              throw error;
            }
            if (
              r.id !== id ||
              r.ok !== true ||
              !(r.bytes instanceof ArrayBuffer) ||
              r.bytes.byteLength > MAX_BYTES ||
              typeof r.encodedSha256 !== "string" ||
              !/^[a-f0-9]{64}$/.test(r.encodedSha256)
            )
              throw fail("PROTOCOL");
            const ownedBytes = r.bytes.slice(0);
            const actual = hex(await crypto.subtle.digest("SHA-256", ownedBytes));
            if (actual !== r.encodedSha256) throw fail("PROTOCOL_DIGEST");
            const artifact = JSON.parse(
              new TextDecoder("utf-8", { fatal: true }).decode(ownedBytes),
            );
            if (
              !artifact ||
              artifact.runId !== input.runId ||
              typeof artifact.artifactSha256 !== "string" ||
              artifact.artifactSha256 !== r.artifactSha256
            )
              throw fail("PROTOCOL_IDENTITY");
            freezeDeep(artifact);
            finish(undefined, { artifact, bytes: ownedBytes, encodedSha256: actual }, false);
          } catch (e) {
            finish(e);
          }
        })();
      };
      try {
        worker.postMessage({ id, input });
      } catch (e) {
        finish(e);
      }
    });
  }
  dispose(): void {
    this.disposed = true;
    this.pending?.(fail("DISPOSED"));
  }
}
