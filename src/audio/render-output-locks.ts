import { RenderError } from "./render-pcm.js";

export interface RenderWriterLease {
  readonly active: boolean;
  release(): Promise<void>;
}
export interface RenderWriterLocks {
  tryAcquire(jobId: string): Promise<RenderWriterLease | null>;
  dispose(): void;
}

/** Test-only registry mirrors document-owned Web Locks without a time-based expiry. */
export class MemoryRenderWriterLocks implements RenderWriterLocks {
  private disposed = false;
  private leases = new Set<RenderWriterLease>();
  constructor(private readonly registry: Map<string, symbol>) {}
  async tryAcquire(jobId: string): Promise<RenderWriterLease | null> {
    if (this.disposed)
      throw new RenderError("RENDER_STORE_DISPOSED", "Render writer locks are disposed.");
    if (this.registry.has(jobId)) return null;
    const token = Symbol(jobId);
    this.registry.set(jobId, token);
    let active = true;
    const lease: RenderWriterLease = {
      get active() {
        return active && thisRegistry.get(jobId) === token;
      },
      release: async () => {
        active = false;
        if (this.registry.get(jobId) === token) this.registry.delete(jobId);
        this.leases.delete(lease);
      },
    };
    const thisRegistry = this.registry;
    this.leases.add(lease);
    return lease;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const lease of [...this.leases]) void lease.release();
  }
}

/** W3C Web Locks: callback waiting promise owns the lease; never steal or guess liveness via TTL. */
export class NativeRenderWriterLocks implements RenderWriterLocks {
  private disposed = false;
  private leases = new Set<RenderWriterLease>();
  constructor(
    private readonly databaseName: string,
    private readonly locks: LockManager | null,
  ) {}
  async tryAcquire(jobId: string): Promise<RenderWriterLease | null> {
    if (this.disposed)
      throw new RenderError("RENDER_STORE_DISPOSED", "Render writer locks are disposed.");
    if (!this.locks || typeof this.locks.request !== "function")
      throw new RenderError(
        "RENDER_STORE_LOCKS_UNAVAILABLE",
        "Web Locks API is unavailable; another render writer cannot safely be classified as inactive.",
      );
    const name = `reflection-lab.render-output.writer/${encodeURIComponent(this.databaseName)}/${encodeURIComponent(jobId)}`;
    let resolveAcquired!: (lease: RenderWriterLease | null) => void;
    let rejectAcquired!: (error: unknown) => void;
    const acquired = new Promise<RenderWriterLease | null>((resolve, reject) => {
      resolveAcquired = resolve;
      rejectAcquired = reject;
    });
    let releaseHold!: () => void;
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    let active = false;
    let lease: RenderWriterLease | null = null;
    let request: Promise<unknown>;
    try {
      request = this.locks.request(name, { mode: "exclusive", ifAvailable: true }, (lock) => {
        if (!lock) {
          resolveAcquired(null);
          return;
        }
        if (this.disposed) {
          rejectAcquired(
            new RenderError("RENDER_STORE_DISPOSED", "Render writer locks are disposed."),
          );
          return;
        }
        active = true;
        const held: RenderWriterLease = {
          get active() {
            return active;
          },
          release: async () => {
            active = false;
            releaseHold();
            this.leases.delete(held);
            await request.catch(() => undefined);
          },
        };
        lease = held;
        this.leases.add(held);
        resolveAcquired(held);
        return hold;
      });
    } catch (error) {
      rejectAcquired(
        new RenderError(
          "RENDER_STORE_LOCK_FAILED",
          `Cannot request the render writer lock: ${String(error)}`,
        ),
      );
      return acquired;
    }
    void request.then(
      () => {
        active = false;
        if (lease) this.leases.delete(lease);
      },
      (error: unknown) => {
        active = false;
        if (lease) this.leases.delete(lease);
        rejectAcquired(
          new RenderError(
            "RENDER_STORE_LOCK_FAILED",
            `Render writer lock request failed: ${String(error)}`,
          ),
        );
      },
    );
    return acquired;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const lease of [...this.leases]) void lease.release();
  }
}
