import { RenderError } from "./render-pcm.js";
import { IncrementalSha256 } from "../persistence/incremental-sha256.js";
import { MemoryRenderWriterLocks, NativeRenderWriterLocks } from "./render-output-locks.js";
import type { RenderWriterLease } from "./render-output-locks.js";

/** The output format is internal; portable WAV and render manifest formats are unchanged. */
const STORE_VERSION = "native-render-output-store-v1";
export const RENDER_OUTPUT_CHUNK_BYTES = 1024 * 1024;
export const RENDER_OUTPUT_MAX_CHUNKS = 512;
export const RENDER_OUTPUT_MAX_JOB_BYTES = 192 * 1024 * 1024;
export const RENDER_OUTPUT_MAX_ARCHIVE_BYTES = 384 * 1024 * 1024;
export const RENDER_OUTPUT_MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
export const RENDER_OUTPUT_MAX_JOBS = 64;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const hashPattern = /^[a-f0-9]{64}$/;
type StoreStatus = "writing" | "published" | "interrupted";
type Operation = "begin" | "append" | "seal" | "publish" | "recover" | "delete";
interface StoredOutput {
  id: string;
  chunks: number;
  bytes: number;
  sealed: boolean;
  sha256: string | null;
}
interface StoredJob {
  schemaVersion: typeof STORE_VERSION;
  jobId: string;
  status: StoreStatus;
  maxBytes: number;
  /** Absent only in pre-freeze candidate records; their maxBytes remains reserved. */
  reservationBytes?: number;
  manifestBytes?: number;
  manifestSha256?: string;
  bytes: number;
  expectedOutputIds: string[] | null;
  outputs: StoredOutput[];
}
interface StoredChunk {
  jobId: string;
  outputId: string;
  index: number;
  bytes: Uint8Array<ArrayBuffer>;
}
interface StoredManifest {
  jobId: string;
  json: string;
}
interface Change {
  job: StoredJob | null;
  manifest?: StoredManifest;
  chunk?: StoredChunk;
  removeChunks?: boolean;
}
export interface RenderArchiveUsage {
  payloadBytes: number;
  reservedBytes: number;
  chargedBytes: number;
  maxBytes: number;
  jobs: number;
  maxJobs: number;
  maxJobEncodedBytes: number;
  maxManifestBytes: number;
}
export interface RenderOutputStoreSnapshot {
  jobId: string;
  status: StoreStatus;
  bytes: number;
  chunks: number;
  outputs: number;
}
export interface ArchivedRenderOutputJob {
  jobId: string;
  activeWriter: boolean;
  canDiscard: boolean;
  status: StoreStatus;
  bytes: number;
  encodedBytes: number;
  manifestBytes: number;
  outputs: { id: string; sha256: string | null; bytes: number }[];
}
export interface PublishedRenderOutputJob {
  jobId: string;
  /** Total application payload bytes, excluding browser-managed IDB page overhead. */
  bytes: number;
  encodedBytes: number;
  manifestBytes: number;
  outputs: { id: string; sha256: string; bytes: number }[];
}
export interface VerifiedRenderOutputPins {
  readonly id: string;
  readonly chunks: number;
  readonly bytes: number;
  readonly sealed: true;
  readonly sha256: string;
}
export interface VerifiedRenderJobPins {
  readonly schemaVersion: string;
  readonly jobId: string;
  readonly status: "published";
  readonly maxBytes: number;
  readonly reservationBytes: number | null;
  readonly encodedBytes: number;
  readonly expectedOutputIds: readonly string[] | null;
  readonly manifestBytes: number;
  readonly manifestSha256: string | null;
  readonly outputs: readonly VerifiedRenderOutputPins[];
}
/** Caller-owned verified historical bytes, not permanent authority over the archive. */
export interface VerifiedRenderJobSnapshot {
  readonly kind: "verified-historical-render-job-v1";
  readonly jobId: string;
  readonly encodedBytes: number;
  readonly manifestJson: string | null;
  readonly pins: VerifiedRenderJobPins;
  readonly outputs: readonly {
    readonly id: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly blob: Blob;
  }[];
}
export interface RenderJobSnapshotOptions {
  readonly signal?: AbortSignal;
  /** This call's WAV payload allowance only, not a global or physical heap guarantee. */
  readonly maxMaterializedBytes: number;
}
export interface RenderOutputStore {
  begin(
    jobId: string,
    maxBytes: number,
    expectedOutputIds?: readonly string[],
    reservationBytes?: number,
  ): Promise<void>;
  listJobs(): Promise<ArchivedRenderOutputJob[]>;
  getArchiveUsage(): Promise<RenderArchiveUsage>;
  listPublishedJobs(): Promise<PublishedRenderOutputJob[]>;
  deletePublishedJob(jobId: string): Promise<void>;
  append(
    jobId: string,
    outputId: string,
    index: number,
    bytes: Uint8Array<ArrayBuffer>,
  ): Promise<void>;
  sealOutput(jobId: string, outputId: string, expectedBytes: number, sha256: string): Promise<void>;
  publish(jobId: string, manifestJson?: string): Promise<void>;
  readManifest(jobId: string): Promise<string | null>;
  readBlob(jobId: string, outputId: string): Promise<Blob | null>;
  /** Full fresh job audit once; returned bytes remain historical after deletion or change. */
  readVerifiedJobSnapshot(
    jobId: string,
    options: RenderJobSnapshotOptions,
  ): Promise<VerifiedRenderJobSnapshot | null>;
  /** Cancels and removes incomplete work only. Already published work is retained. */
  abort(jobId: string): Promise<void>;
  /** Owner-only rollback of this exact job, including a completed storage transaction. */
  discard(jobId: string): Promise<void>;
  /** Call on restart, before accepting new jobs; incomplete/corrupt output stays private. */
  recover(): Promise<{ jobId: string; status: "interrupted" | "published" }[]>;
  getSnapshot(jobId: string): Promise<RenderOutputStoreSnapshot | null>;
  dispose(): void;
}
function requireStore(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new RenderError(code, message);
}
function archiveCharge(job: StoredJob): number {
  const reservation = job.reservationBytes ?? job.maxBytes;
  requireStore(
    Number.isSafeInteger(job.bytes) &&
      job.bytes >= 0 &&
      Number.isSafeInteger(reservation) &&
      reservation > 0,
    "RENDER_STORE_INTEGRITY",
    "Stored archive byte accounting is invalid.",
  );
  const manifestBytes = job.manifestBytes ?? 0;
  requireStore(
    Number.isSafeInteger(manifestBytes) &&
      manifestBytes >= 0 &&
      manifestBytes <= RENDER_OUTPUT_MAX_MANIFEST_BYTES,
    "RENDER_STORE_INTEGRITY",
    "Stored manifest byte accounting is invalid.",
  );
  return (job.status === "writing" ? Math.max(job.bytes, reservation) : job.bytes) + manifestBytes;
}
function admitArchive(
  operation: Operation,
  jobId: string,
  jobs: readonly StoredJob[],
  next: Change,
): void {
  if (operation !== "begin" && operation !== "append" && operation !== "publish") return;
  if (operation === "begin")
    requireStore(
      jobs.length < RENDER_OUTPUT_MAX_JOBS,
      "RENDER_STORE_ARCHIVE_JOB_CAP",
      "Render output archive job-count cap is exceeded; explicitly discard an existing job before rendering again.",
    );
  if (next.job)
    requireStore(
      next.job.bytes <= next.job.maxBytes,
      "RENDER_STORE_CAP",
      "Render output encoded byte cap is exceeded.",
    );
  const total = jobs
    .filter((job) => job.jobId !== jobId)
    .reduce((sum, job) => sum + archiveCharge(job), next.job ? archiveCharge(next.job) : 0);
  requireStore(
    Number.isSafeInteger(total) && total <= RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
    "RENDER_STORE_ARCHIVE_CAP",
    "Render output archive byte cap is exceeded; explicitly delete completed outputs before rendering again.",
  );
}
function writable(job: StoredJob | null): StoredJob {
  requireStore(
    job?.status === "writing",
    "RENDER_STORE_STATE",
    "Render output job is not writable.",
  );
  return job;
}
function complete(job: StoredJob): boolean {
  return (
    job.schemaVersion === STORE_VERSION &&
    job.outputs.length > 0 &&
    job.outputs.length <= 16 &&
    job.bytes <= job.maxBytes &&
    job.outputs.every(
      (output) =>
        output.sealed &&
        output.chunks > 0 &&
        output.chunks <= RENDER_OUTPUT_MAX_CHUNKS &&
        output.bytes > 0 &&
        typeof output.sha256 === "string" &&
        hashPattern.test(output.sha256),
    ) &&
    job.outputs.reduce((sum, output) => sum + output.bytes, 0) === job.bytes &&
    (job.expectedOutputIds === null ||
      (job.expectedOutputIds.length === job.outputs.length &&
        job.expectedOutputIds.every((id) => job.outputs.some((output) => output.id === id))))
  );
}
function auditChunks(job: StoredJob): (chunk: StoredChunk) => void {
  const seen = new Map<string, { chunks: number; bytes: number }>();
  return (chunk) => {
    const expected = job.outputs.find((output) => output.id === chunk.outputId);
    const actual = seen.get(chunk.outputId) ?? { chunks: 0, bytes: 0 };
    requireStore(
      expected &&
        chunk.jobId === job.jobId &&
        chunk.index === actual.chunks &&
        chunk.bytes instanceof Uint8Array &&
        chunk.bytes.byteLength > 0 &&
        chunk.bytes.byteLength <= RENDER_OUTPUT_CHUNK_BYTES,
      "RENDER_STORE_INTEGRITY",
      "Stored output chunk sequence or layout is invalid.",
    );
    actual.chunks++;
    actual.bytes += chunk.bytes.byteLength;
    requireStore(
      actual.chunks <= expected.chunks && actual.bytes <= expected.bytes,
      "RENDER_STORE_INTEGRITY",
      "Stored output exceeds its sealed byte count.",
    );
    seen.set(chunk.outputId, actual);
  };
}

abstract class BaseRenderOutputStore implements RenderOutputStore {
  private disposed = false;
  private busy = false;
  private current: { jobId: string; promise: Promise<void> } | null = null;
  private cancelled = new Set<string>();
  private ownedWriters = new Map<string, RenderWriterLease>();
  protected abstract change(
    jobId: string,
    operation: Operation,
    transform: (job: StoredJob | null, jobs: readonly StoredJob[]) => Change,
  ): Promise<void>;
  protected abstract load(jobId: string): Promise<StoredJob | null>;
  protected abstract list(): Promise<StoredJob[]>;
  protected abstract loadManifest(jobId: string): Promise<string | null>;
  protected abstract materialize(job: StoredJob, outputId: string | null): Promise<Blob | null>;
  protected abstract captureSnapshot(
    jobId: string,
    maximum: number,
    signal?: AbortSignal,
  ): Promise<VerifiedRenderJobSnapshot | null>;
  protected abstract verifySnapshotAuthority(
    snapshot: VerifiedRenderJobSnapshot,
    signal?: AbortSignal,
  ): Promise<void>;
  protected assertRead(signal?: AbortSignal): void {
    this.assertOpen();
    requireStore(
      !signal?.aborted,
      "RENDER_CANCELLED",
      "Render output snapshot read was cancelled.",
    );
  }
  protected abstract interrupt(jobId?: string): void;
  protected abstract close(): void;
  protected abstract tryWriter(jobId: string): Promise<RenderWriterLease | null>;
  protected abstract closeWriters(): void;
  protected assertOpen(): void {
    requireStore(!this.disposed, "RENDER_STORE_DISPOSED", "Render output store is disposed.");
  }
  protected assertWriting(jobId: string): void {
    this.assertOpen();
    requireStore(
      !this.cancelled.has(jobId),
      "RENDER_CANCELLED",
      "Render output job was cancelled.",
    );
  }
  protected assertOwnedWriter(jobId: string): void {
    this.assertWriting(jobId);
    requireStore(
      this.ownedWriters.get(jobId)?.active,
      "RENDER_STORE_WRITER_REQUIRED",
      "This store does not own the active render writer lease.",
    );
  }
  private async acquireWriter(jobId: string): Promise<RenderWriterLease | null> {
    const lease = await this.tryWriter(jobId);
    try {
      this.assertOpen();
    } catch (error) {
      await lease?.release();
      throw error;
    }
    return lease;
  }
  private async releaseOwnedWriter(jobId: string): Promise<void> {
    const lease = this.ownedWriters.get(jobId);
    this.ownedWriters.delete(jobId);
    await lease?.release();
  }
  private async hasActiveWriter(jobId: string): Promise<boolean> {
    if (this.ownedWriters.get(jobId)?.active) return true;
    const probe = await this.acquireWriter(jobId);
    if (!probe) return true;
    await probe.release();
    return false;
  }
  private exclusive(
    jobId: string,
    action: () => Promise<void>,
    allowCancelled = false,
  ): Promise<void> {
    try {
      if (allowCancelled) this.assertOpen();
      else this.assertWriting(jobId);
      requireStore(
        !this.busy,
        "RENDER_STORE_BUSY",
        "Render output store is busy; await the current write.",
      );
    } catch (error) {
      return Promise.reject(error);
    }
    this.busy = true;
    let actionPromise: Promise<void>;
    try {
      actionPromise = action();
    } catch (error) {
      this.busy = false;
      return Promise.reject(error);
    }
    const promise = actionPromise.finally(() => {
      this.busy = false;
      this.current = null;
    });
    this.current = { jobId, promise };
    return promise;
  }
  begin(
    jobId: string,
    maxBytes: number,
    expectedOutputIds?: readonly string[],
    reservationBytes = maxBytes,
  ): Promise<void> {
    return this.exclusive(jobId, async () => {
      const ownedOutputIds = expectedOutputIds ? [...expectedOutputIds] : null;
      requireStore(
        idPattern.test(jobId) &&
          Number.isSafeInteger(maxBytes) &&
          maxBytes > 0 &&
          maxBytes <= RENDER_OUTPUT_MAX_JOB_BYTES,
        "RENDER_STORE_PLAN",
        "Invalid output-store job ID or byte cap.",
      );
      requireStore(
        Number.isSafeInteger(reservationBytes) &&
          reservationBytes > 0 &&
          reservationBytes <= maxBytes,
        "RENDER_STORE_PLAN",
        "Invalid render output reservation byte count.",
      );
      requireStore(
        expectedOutputIds === undefined ||
          (expectedOutputIds.length > 0 &&
            expectedOutputIds.length <= 16 &&
            new Set(expectedOutputIds).size === expectedOutputIds.length &&
            expectedOutputIds.every((id) => idPattern.test(id))),
        "RENDER_STORE_PLAN",
        "Invalid expected output IDs.",
      );
      const lease = await this.acquireWriter(jobId);
      requireStore(
        lease,
        "RENDER_STORE_ACTIVE_WRITER",
        "Another active render writer owns this job.",
      );
      this.ownedWriters.set(jobId, lease);
      try {
        this.assertOwnedWriter(jobId);
        await this.change(jobId, "begin", (job) => {
          requireStore(
            job === null,
            "RENDER_STORE_JOB_EXISTS",
            "A stored render job already has this ID.",
          );
          return {
            job: {
              schemaVersion: STORE_VERSION,
              jobId,
              status: "writing",
              maxBytes,
              reservationBytes,
              bytes: 0,
              expectedOutputIds: ownedOutputIds,
              outputs: [],
            },
          };
        });
      } catch (error) {
        await this.releaseOwnedWriter(jobId);
        throw error;
      }
    });
  }
  append(
    jobId: string,
    outputId: string,
    index: number,
    bytes: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    return this.exclusive(jobId, () => {
      this.assertOwnedWriter(jobId);
      requireStore(
        idPattern.test(outputId) &&
          Number.isSafeInteger(index) &&
          index >= 0 &&
          bytes instanceof Uint8Array &&
          bytes.byteLength > 0 &&
          bytes.byteLength <= RENDER_OUTPUT_CHUNK_BYTES,
        "RENDER_STORE_CHUNK",
        "Invalid output chunk ID, index or bounded byte length.",
      );
      // Take ownership after admission, before the first asynchronous operation. At most one copy is in flight.
      const owned = bytes.slice();
      return this.change(jobId, "append", (value) => {
        const job = writable(value);
        requireStore(
          index < RENDER_OUTPUT_MAX_CHUNKS,
          "RENDER_STORE_CAP",
          "Render output chunk-count cap is exceeded.",
        );
        requireStore(
          job.expectedOutputIds === null || job.expectedOutputIds.includes(outputId),
          "RENDER_STORE_OUTPUT",
          "Chunk does not belong to an expected output.",
        );
        let output = job.outputs.find((entry) => entry.id === outputId);
        requireStore(
          !output?.sealed,
          "RENDER_STORE_STATE",
          "This render output is already sealed.",
        );
        requireStore(
          index === (output?.chunks ?? 0),
          "RENDER_STORE_SEQUENCE",
          "Output chunk sequence is not contiguous.",
        );
        requireStore(
          Number.isSafeInteger(job.bytes + owned.byteLength) &&
            job.bytes + owned.byteLength <= job.maxBytes,
          "RENDER_STORE_CAP",
          "Render output byte cap is exceeded.",
        );
        if (!output) {
          requireStore(
            job.outputs.length < 16,
            "RENDER_STORE_CAP",
            "Render output count cap is exceeded.",
          );
          output = { id: outputId, bytes: 0, chunks: 0, sealed: false, sha256: null };
          job.outputs.push(output);
        }
        output.bytes += owned.byteLength;
        output.chunks++;
        job.bytes += owned.byteLength;
        return { job, chunk: { jobId, outputId, index, bytes: owned } };
      });
    });
  }
  sealOutput(
    jobId: string,
    outputId: string,
    expectedBytes: number,
    sha256: string,
  ): Promise<void> {
    return this.exclusive(jobId, () => {
      this.assertOwnedWriter(jobId);
      return this.change(jobId, "seal", (value) => {
        const job = writable(value);
        const output = job.outputs.find((entry) => entry.id === outputId);
        requireStore(
          output && !output.sealed && output.bytes === expectedBytes && output.chunks > 0,
          "RENDER_STORE_LENGTH",
          "Output sealed byte count differs from committed chunks.",
        );
        requireStore(hashPattern.test(sha256), "RENDER_STORE_HASH", "Invalid sealed SHA-256.");
        output.sealed = true;
        output.sha256 = sha256;
        return { job };
      });
    });
  }
  publish(jobId: string, manifestJson?: string): Promise<void> {
    return this.exclusive(jobId, async () => {
      this.assertOwnedWriter(jobId);
      let manifestBytes: Uint8Array<ArrayBuffer> | null = null;
      if (manifestJson !== undefined) {
        requireStore(
          typeof manifestJson === "string" &&
            manifestJson.length <= RENDER_OUTPUT_MAX_MANIFEST_BYTES,
          "RENDER_STORE_MANIFEST_CAP",
          "Render output manifest byte cap is exceeded.",
        );
        manifestBytes = new TextEncoder().encode(manifestJson);
        requireStore(
          manifestBytes.byteLength > 0 &&
            manifestBytes.byteLength <= RENDER_OUTPUT_MAX_MANIFEST_BYTES,
          "RENDER_STORE_MANIFEST_CAP",
          "Render output manifest byte cap is exceeded.",
        );
      }
      const manifestByteCount = manifestBytes?.byteLength ?? 0;
      const manifestSha256 = manifestBytes
        ? new IncrementalSha256().update(manifestBytes).digestHex()
        : null;
      const observed = writable(await this.load(jobId));
      requireStore(
        complete(observed),
        "RENDER_STORE_INCOMPLETE",
        "Every expected output must be sealed before publication.",
      );
      // Read back committed chunks and verify each complete WAV digest before publishing metadata.
      // null requests an integrity pass without materializing any output Blob.
      await this.materialize(observed, null);
      this.assertOwnedWriter(jobId);
      await this.change(jobId, "publish", (value) => {
        const job = writable(value);
        requireStore(
          complete(job),
          "RENDER_STORE_INCOMPLETE",
          "Every expected output must be sealed before publication.",
        );
        job.status = "published";
        job.manifestBytes = manifestByteCount;
        if (manifestSha256) job.manifestSha256 = manifestSha256;
        return {
          job,
          ...(manifestJson === undefined ? {} : { manifest: { jobId, json: manifestJson } }),
        };
      });
      await this.releaseOwnedWriter(jobId);
    });
  }
  async readManifest(jobId: string): Promise<string | null> {
    this.assertOpen();
    const job = await this.load(jobId);
    if (job?.status !== "published" || !job.manifestBytes) return null;
    const manifest = await this.loadManifest(jobId);
    requireStore(
      typeof manifest === "string" && manifest.length <= RENDER_OUTPUT_MAX_MANIFEST_BYTES,
      "RENDER_STORE_INTEGRITY",
      "Published render manifest is missing or exceeds its byte cap.",
    );
    const bytes = new TextEncoder().encode(manifest);
    requireStore(
      bytes.byteLength <= RENDER_OUTPUT_MAX_MANIFEST_BYTES &&
        bytes.byteLength === job.manifestBytes &&
        new IncrementalSha256().update(bytes).digestHex() === job.manifestSha256,
      "RENDER_STORE_INTEGRITY",
      "Published render manifest SHA-256 differs from the stored payload.",
    );
    return manifest;
  }
  async getArchiveUsage(): Promise<RenderArchiveUsage> {
    this.assertOpen();
    const jobs = await this.list();
    const chargedBytes = jobs.reduce((sum, job) => sum + archiveCharge(job), 0);
    const payloadBytes = jobs.reduce((sum, job) => sum + job.bytes + (job.manifestBytes ?? 0), 0);
    requireStore(
      Number.isSafeInteger(chargedBytes) && Number.isSafeInteger(payloadBytes),
      "RENDER_STORE_INTEGRITY",
      "Stored archive usage counters are unsafe.",
    );
    return {
      payloadBytes,
      reservedBytes: chargedBytes - payloadBytes,
      chargedBytes,
      maxBytes: RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
      jobs: jobs.length,
      maxJobs: RENDER_OUTPUT_MAX_JOBS,
      maxJobEncodedBytes: RENDER_OUTPUT_MAX_JOB_BYTES,
      maxManifestBytes: RENDER_OUTPUT_MAX_MANIFEST_BYTES,
    };
  }
  async listJobs(): Promise<ArchivedRenderOutputJob[]> {
    this.assertOpen();
    const result: ArchivedRenderOutputJob[] = [];
    for (const job of (await this.list()).sort((a, b) => a.jobId.localeCompare(b.jobId))) {
      const activeWriter = await this.hasActiveWriter(job.jobId);
      result.push({
        jobId: job.jobId,
        status: job.status,
        activeWriter,
        canDiscard: job.status === "interrupted" && !activeWriter,
        bytes: job.bytes + (job.manifestBytes ?? 0),
        encodedBytes: job.bytes,
        manifestBytes: job.manifestBytes ?? 0,
        outputs: job.outputs.map((output) => ({
          id: output.id,
          sha256: output.sha256,
          bytes: output.bytes,
        })),
      });
    }
    return result;
  }
  async listPublishedJobs(): Promise<PublishedRenderOutputJob[]> {
    this.assertOpen();
    return (await this.list())
      .filter((job) => job.status === "published" && complete(job))
      .sort((a, b) => a.jobId.localeCompare(b.jobId))
      .map((job) => ({
        jobId: job.jobId,
        bytes: job.bytes + (job.manifestBytes ?? 0),
        encodedBytes: job.bytes,
        manifestBytes: job.manifestBytes ?? 0,
        outputs: job.outputs.map((output) => ({
          id: output.id,
          sha256: output.sha256!,
          bytes: output.bytes,
        })),
      }));
  }
  deletePublishedJob(jobId: string): Promise<void> {
    return this.exclusive(
      jobId,
      async () => {
        const lease = await this.acquireWriter(jobId);
        requireStore(
          lease,
          "RENDER_STORE_ACTIVE_WRITER",
          "Another active render writer owns this job.",
        );
        try {
          await this.change(jobId, "delete", (job) => {
            requireStore(
              job?.status === "published",
              "RENDER_STORE_STATE",
              "Only a published render output job can be deleted from the archive.",
            );
            return { job: null, removeChunks: true };
          });
        } finally {
          await lease.release();
        }
      },
      true,
    );
  }
  async readBlob(jobId: string, outputId: string): Promise<Blob | null> {
    this.assertOpen();
    const job = await this.load(jobId);
    if (job?.status !== "published" || !job.outputs.some((output) => output.id === outputId))
      return null;
    requireStore(
      complete(job),
      "RENDER_STORE_INTEGRITY",
      "Published render metadata is incomplete.",
    );
    return this.materialize(job, outputId);
  }
  async readVerifiedJobSnapshot(
    jobId: string,
    options: RenderJobSnapshotOptions,
  ): Promise<VerifiedRenderJobSnapshot | null> {
    const { signal, maxMaterializedBytes } = options;
    this.assertRead(signal);
    requireStore(
      idPattern.test(jobId) &&
        Number.isSafeInteger(maxMaterializedBytes) &&
        maxMaterializedBytes > 0 &&
        maxMaterializedBytes <= RENDER_OUTPUT_MAX_JOB_BYTES,
      "RENDER_STORE_PLAN",
      "Invalid snapshot job ID or materialized byte allowance.",
    );
    const snapshot = await this.captureSnapshot(jobId, maxMaterializedBytes, signal);
    this.assertRead(signal);
    if (!snapshot) return null;
    await this.verifySnapshotAuthority(snapshot, signal);
    this.assertRead(signal);
    return snapshot;
  }
  async getSnapshot(jobId: string): Promise<RenderOutputStoreSnapshot | null> {
    this.assertOpen();
    const job = await this.load(jobId);
    return job
      ? {
          jobId,
          status: job.status,
          bytes: job.bytes,
          chunks: job.outputs.reduce((sum, output) => sum + output.chunks, 0),
          outputs: job.outputs.length,
        }
      : null;
  }
  async abort(jobId: string): Promise<void> {
    return this.remove(jobId, true);
  }
  async discard(jobId: string): Promise<void> {
    return this.remove(jobId, false);
  }
  private async remove(jobId: string, preservePublished: boolean): Promise<void> {
    this.assertOpen();
    const ownsOperation =
      Boolean(this.ownedWriters.get(jobId)?.active) || this.current?.jobId === jobId;
    if (ownsOperation) {
      this.cancelled.add(jobId);
      this.interrupt(jobId);
      if (this.current?.jobId === jobId) await this.current.promise.catch(() => undefined);
    }
    requireStore(!this.busy, "RENDER_STORE_BUSY", "Render output store is busy with another job.");
    const owned = this.ownedWriters.get(jobId);
    const lease = owned?.active ? owned : await this.acquireWriter(jobId);
    requireStore(
      lease,
      "RENDER_STORE_ACTIVE_WRITER",
      "Another active render writer owns this job.",
    );
    this.cancelled.add(jobId);
    try {
      await this.change(jobId, "recover", (job) =>
        preservePublished && job?.status === "published"
          ? { job }
          : { job: null, removeChunks: true },
      );
    } finally {
      if (this.ownedWriters.get(jobId) === lease) this.ownedWriters.delete(jobId);
      await lease.release();
    }
  }
  async recover(): Promise<{ jobId: string; status: "interrupted" | "published" }[]> {
    const results: { jobId: string; status: "interrupted" | "published" }[] = [];
    await this.exclusive("recovery", async () => {
      for (const observed of (await this.list()).sort((a, b) => a.jobId.localeCompare(b.jobId))) {
        if (this.ownedWriters.get(observed.jobId)?.active) continue;
        const lease = await this.acquireWriter(observed.jobId);
        if (!lease) continue;
        try {
          // Re-read after acquiring the lease: the previous owner may have completed before release.
          const job = await this.load(observed.jobId);
          if (!job) continue;
          let valid = job.status === "published" && complete(job);
          if (valid) {
            try {
              await this.materialize(job, null);
              if (job.manifestBytes) await this.readManifest(job.jobId);
            } catch {
              valid = false;
            }
          }
          if (!valid)
            await this.change(job.jobId, "recover", (current) =>
              current ? { job: { ...current, status: "interrupted" } } : { job: null },
            );
          results.push({ jobId: job.jobId, status: valid ? "published" : "interrupted" });
        } finally {
          await lease.release();
        }
      }
    });
    return results;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.interrupt();
    this.closeWriters();
    this.ownedWriters.clear();
    this.close();
  }
}

/** Test-only in-memory database. Production never silently falls back to it. */
export class MemoryRenderOutputDatabase {
  readonly jobs = new Map<string, StoredJob>();
  readonly chunks = new Map<string, StoredChunk>();
  readonly manifests = new Map<string, string>();
  readonly writerOwners = new Map<string, symbol>();
  transaction: Promise<void> = Promise.resolve();
}
export interface MemoryRenderOutputStoreOptions {
  database?: MemoryRenderOutputDatabase;
  beforeCommit?: (operation: Operation) => void | Promise<void>;
}
export class MemoryRenderOutputStore extends BaseRenderOutputStore {
  private readonly writers: MemoryRenderWriterLocks;
  private readonly database: MemoryRenderOutputDatabase;
  constructor(private readonly options: MemoryRenderOutputStoreOptions = {}) {
    super();
    this.database = options.database ?? new MemoryRenderOutputDatabase();
    this.writers = new MemoryRenderWriterLocks(this.database.writerOwners);
  }
  protected async change(
    jobId: string,
    operation: Operation,
    transform: (job: StoredJob | null, jobs: readonly StoredJob[]) => Change,
  ): Promise<void> {
    const previous = this.database.transaction;
    let release!: () => void;
    this.database.transaction = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const jobs = structuredClone([...this.database.jobs.values()]);
      const next = transform(structuredClone(this.database.jobs.get(jobId) ?? null), jobs);
      admitArchive(operation, jobId, jobs, next);
      await this.options.beforeCommit?.(operation);
      if (operation !== "recover" && operation !== "delete") this.assertOwnedWriter(jobId);
      else this.assertOpen();
      if (next.removeChunks) this.database.manifests.delete(jobId);
      if (next.manifest) this.database.manifests.set(jobId, next.manifest.json);
      if (next.removeChunks)
        for (const [key, chunk] of this.database.chunks)
          if (chunk.jobId === jobId) this.database.chunks.delete(key);
      if (next.chunk)
        this.database.chunks.set(
          JSON.stringify([jobId, next.chunk.outputId, next.chunk.index]),
          next.chunk,
        );
      if (next.job) this.database.jobs.set(jobId, next.job);
      else this.database.jobs.delete(jobId);
    } finally {
      release();
    }
  }
  protected async tryWriter(jobId: string): Promise<RenderWriterLease | null> {
    return this.writers.tryAcquire(jobId);
  }
  protected closeWriters(): void {
    this.writers.dispose();
  }
  protected async load(jobId: string): Promise<StoredJob | null> {
    return structuredClone(this.database.jobs.get(jobId) ?? null);
  }
  protected async list(): Promise<StoredJob[]> {
    return structuredClone([...this.database.jobs.values()]);
  }
  protected async loadManifest(jobId: string): Promise<string | null> {
    return this.database.manifests.get(jobId) ?? null;
  }
  protected async materialize(job: StoredJob, outputId: string | null): Promise<Blob | null> {
    const rows = [...this.database.chunks.values()]
      .filter((chunk) => chunk.jobId === job.jobId)
      .sort((a, b) => a.outputId.localeCompare(b.outputId) || a.index - b.index);
    return assemble(job, outputId, rows);
  }
  protected async captureSnapshot(
    jobId: string,
    maximum: number,
    signal?: AbortSignal,
  ): Promise<VerifiedRenderJobSnapshot | null> {
    await this.database.transaction;
    this.assertRead(signal);
    const job = structuredClone(this.database.jobs.get(jobId) ?? null);
    if (job?.status !== "published") return null;
    const assembler = snapshotAssembler(job, this.database.manifests.get(jobId) ?? null, maximum);
    const rows = [...this.database.chunks.values()]
      .filter((chunk) => chunk.jobId === jobId)
      .sort((a, b) => a.outputId.localeCompare(b.outputId) || a.index - b.index);
    for (const chunk of rows) {
      this.assertRead(signal);
      assembler.add(chunk);
    }
    return assembler.finish();
  }
  protected async verifySnapshotAuthority(
    snapshot: VerifiedRenderJobSnapshot,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.database.transaction;
    this.assertRead(signal);
    assertSnapshotAuthority(
      snapshot,
      this.database.jobs.get(snapshot.jobId) ?? null,
      this.database.manifests.get(snapshot.jobId) ?? null,
    );
  }
  protected interrupt(): void {
    /* Cancellation is checked immediately before the test transaction commit. */
  }
  protected close(): void {
    /* The injected database survives the store instance to model reload. */
  }
}

function snapshotPins(job: StoredJob): VerifiedRenderJobPins {
  return Object.freeze({
    schemaVersion: job.schemaVersion,
    jobId: job.jobId,
    status: "published" as const,
    maxBytes: job.maxBytes,
    reservationBytes: job.reservationBytes ?? null,
    encodedBytes: job.bytes,
    expectedOutputIds:
      job.expectedOutputIds === null ? null : Object.freeze([...job.expectedOutputIds]),
    manifestBytes: job.manifestBytes ?? 0,
    manifestSha256: job.manifestSha256 ?? null,
    outputs: Object.freeze(
      job.outputs.map((output) =>
        Object.freeze({
          id: output.id,
          chunks: output.chunks,
          bytes: output.bytes,
          sealed: output.sealed as true,
          sha256: output.sha256!,
        }),
      ),
    ),
  });
}
function assertSnapshotAuthority(
  snapshot: VerifiedRenderJobSnapshot,
  current: StoredJob | null,
  manifest: string | null,
): void {
  requireStore(
    current?.status === "published" &&
      complete(current) &&
      JSON.stringify(snapshotPins(current)) === JSON.stringify(snapshot.pins) &&
      manifest === snapshot.manifestJson,
    "RENDER_STORE_SNAPSHOT_CHANGED",
    "Published render metadata changed during the snapshot read.",
  );
}
function snapshotAssembler(job: StoredJob, manifest: string | null, maximum: number) {
  const safePositive = (value: number) => Number.isSafeInteger(value) && value > 0;
  requireStore(
    complete(job) &&
      idPattern.test(job.jobId) &&
      safePositive(job.maxBytes) &&
      job.maxBytes <= RENDER_OUTPUT_MAX_JOB_BYTES &&
      safePositive(job.bytes) &&
      job.bytes <= job.maxBytes &&
      (job.reservationBytes === undefined ||
        (safePositive(job.reservationBytes) && job.reservationBytes <= job.maxBytes)) &&
      new Set(job.outputs.map((output) => output.id)).size === job.outputs.length &&
      job.outputs.every(
        (output) =>
          output.sealed === true &&
          idPattern.test(output.id) &&
          safePositive(output.bytes) &&
          safePositive(output.chunks) &&
          output.bytes <= output.chunks * RENDER_OUTPUT_CHUNK_BYTES,
      ) &&
      (job.expectedOutputIds === null ||
        (new Set(job.expectedOutputIds).size === job.expectedOutputIds.length &&
          job.expectedOutputIds.every((id) => idPattern.test(id)))),
    "RENDER_STORE_INTEGRITY",
    "Published render metadata is incomplete or invalid.",
  );
  requireStore(
    job.bytes <= maximum,
    "RENDER_STORE_SNAPSHOT_CAP",
    "Snapshot WAV payload exceeds this call's materialized byte allowance.",
  );
  const manifestBytes = job.manifestBytes ?? 0;
  requireStore(
    Number.isSafeInteger(manifestBytes) &&
      manifestBytes >= 0 &&
      manifestBytes <= RENDER_OUTPUT_MAX_MANIFEST_BYTES,
    "RENDER_STORE_INTEGRITY",
    "Published manifest byte accounting is invalid.",
  );
  if (manifestBytes === 0) {
    requireStore(
      manifest === null && job.manifestSha256 === undefined,
      "RENDER_STORE_INTEGRITY",
      "Unexpected published manifest payload or digest.",
    );
  } else {
    requireStore(
      typeof manifest === "string" && manifest.length <= RENDER_OUTPUT_MAX_MANIFEST_BYTES,
      "RENDER_STORE_INTEGRITY",
      "Published render manifest is missing or exceeds its byte cap.",
    );
    // The stored byte cap bounds allocation even when corrupt text contains multibyte characters.
    const encoded = new Uint8Array(manifestBytes);
    const encodedResult = new TextEncoder().encodeInto(manifest, encoded);
    requireStore(
      encodedResult.read === manifest.length &&
        encodedResult.written === manifestBytes &&
        hashPattern.test(job.manifestSha256 ?? "") &&
        new IncrementalSha256().update(encoded).digestHex() === job.manifestSha256,
      "RENDER_STORE_INTEGRITY",
      "Published render manifest SHA-256 differs from the stored payload.",
    );
  }
  const pins = snapshotPins(job);
  const check = auditChunks(job);
  const outputs = new Map(
    job.outputs.map((output) => [
      output.id,
      {
        bytes: 0,
        chunks: 0,
        hash: new IncrementalSha256(),
        parts: [] as Blob[],
      },
    ]),
  );
  return {
    add(chunk: StoredChunk): void {
      check(chunk);
      const output = outputs.get(chunk.outputId)!;
      output.hash.update(chunk.bytes);
      output.bytes += chunk.bytes.byteLength;
      output.chunks++;
      output.parts.push(new Blob([chunk.bytes]));
    },
    finish(): VerifiedRenderJobSnapshot {
      const materialized = job.outputs.map((expected) => {
        const output = outputs.get(expected.id)!;
        requireStore(
          output.bytes === expected.bytes &&
            output.chunks === expected.chunks &&
            output.hash.digestHex() === expected.sha256,
          "RENDER_STORE_INTEGRITY",
          "Stored output chunks or SHA-256 differ from the sealed artifact.",
        );
        const blob = new Blob(output.parts, { type: "audio/wav" });
        output.parts.length = 0;
        requireStore(
          blob.size === expected.bytes,
          "RENDER_STORE_INTEGRITY",
          "Snapshot Blob length differs from the sealed artifact.",
        );
        return Object.freeze({
          id: expected.id,
          bytes: expected.bytes,
          sha256: expected.sha256!,
          blob,
        });
      });
      return Object.freeze({
        kind: "verified-historical-render-job-v1" as const,
        jobId: job.jobId,
        encodedBytes: job.bytes,
        manifestJson: manifest,
        pins,
        outputs: Object.freeze(materialized),
      });
    },
  };
}

function assemble(
  job: StoredJob,
  outputId: string | null,
  chunks: Iterable<StoredChunk>,
): Blob | null {
  const parts: Blob[] = [];
  const check = auditChunks(job);
  const hashes = new Map(job.outputs.map((output) => [output.id, new IncrementalSha256()]));
  const totals = new Map<string, { bytes: number; chunks: number }>();
  for (const chunk of chunks) {
    check(chunk);
    hashes.get(chunk.outputId)!.update(chunk.bytes);
    const total = totals.get(chunk.outputId) ?? { bytes: 0, chunks: 0 };
    total.bytes += chunk.bytes.byteLength;
    total.chunks++;
    totals.set(chunk.outputId, total);
    if (outputId === chunk.outputId) parts.push(new Blob([chunk.bytes]));
  }
  for (const output of job.outputs)
    requireStore(
      totals.get(output.id)?.bytes === output.bytes &&
        totals.get(output.id)?.chunks === output.chunks &&
        hashes.get(output.id)!.digestHex() === output.sha256,
      "RENDER_STORE_INTEGRITY",
      "Stored output chunks or SHA-256 differ from the sealed artifact.",
    );
  return outputId === null ? null : new Blob(parts, { type: "audio/wav" });
}

export interface IndexedDBRenderOutputStoreOptions {
  name?: string;
  /** null deliberately tests unavailable storage; omitted selects the browser's IndexedDB. */
  factory?: IDBFactory | null;
  /** Omitted uses the real browser LockManager; null explicitly exercises fail-closed support. */
  locks?: LockManager | null;
}
/** Native IndexedDB chunk transactions; no complete WAV byte arrays are retained in JavaScript. */
export class IndexedDBRenderOutputStore extends BaseRenderOutputStore {
  private readonly writers: NativeRenderWriterLocks;
  private readonly factory: IDBFactory | null;
  private database: Promise<IDBDatabase> | null = null;
  private transactions = new Map<IDBTransaction, string>();
  constructor(private readonly options: IndexedDBRenderOutputStoreOptions = {}) {
    super();
    this.factory = options.factory === undefined ? (globalThis.indexedDB ?? null) : options.factory;
    const locks =
      options.locks === undefined
        ? typeof navigator === "undefined"
          ? null
          : (navigator.locks ?? null)
        : options.locks;
    this.writers = new NativeRenderWriterLocks(
      options.name ?? "reflection-lab-render-output-v1",
      locks,
    );
  }
  protected async tryWriter(jobId: string): Promise<RenderWriterLease | null> {
    this.assertOpen();
    // Preserve the explicit IndexedDB-unavailable error without allocating a database.
    if (!this.factory) await this.open();
    const lease = await this.writers.tryAcquire(jobId);
    if (!lease) return null;
    try {
      await this.open();
      return lease;
    } catch (error) {
      await lease.release();
      throw error;
    }
  }
  protected closeWriters(): void {
    this.writers.dispose();
  }
  private open(): Promise<IDBDatabase> {
    this.assertOpen();
    if (!this.factory)
      return Promise.reject(
        new RenderError(
          "RENDER_STORAGE_UNAVAILABLE",
          "IndexedDB is unavailable; long render output cannot be persisted safely.",
        ),
      );
    this.database ??= new Promise((resolve, reject) => {
      let rejected = false;
      const request = this.factory!.open(this.options.name ?? "reflection-lab-render-output-v1", 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("jobs"))
          database.createObjectStore("jobs", { keyPath: "jobId" });
        if (!database.objectStoreNames.contains("chunks"))
          database
            .createObjectStore("chunks", { keyPath: ["jobId", "outputId", "index"] })
            .createIndex("jobId", "jobId");
        if (!database.objectStoreNames.contains("manifests"))
          database.createObjectStore("manifests", { keyPath: "jobId" });
      };
      request.onerror = () =>
        reject(
          request.error ??
            new RenderError("RENDER_STORAGE_OPEN", "Cannot open render output storage."),
        );
      request.onblocked = () => {
        rejected = true;
        reject(
          new RenderError(
            "RENDER_STORAGE_BLOCKED",
            "Another browser session blocks render output storage.",
          ),
        );
      };
      request.onsuccess = () => {
        try {
          this.assertOpen();
        } catch (error) {
          request.result.close();
          reject(error);
          return;
        }
        if (rejected) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
    return this.database;
  }
  private async transaction<T>(
    jobId: string,
    mode: IDBTransactionMode,
    work: (
      transaction: IDBTransaction,
      finish: (value: T) => void,
      fail: (error: unknown) => void,
    ) => void,
    signal?: AbortSignal,
  ): Promise<T> {
    const database = await this.open();
    this.assertRead(signal);
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(["jobs", "chunks", "manifests"], mode);
      this.transactions.set(transaction, jobId);
      let value: T;
      let failure: unknown;
      transaction.oncomplete = () => {
        signal?.removeEventListener("abort", cancelled);
        this.transactions.delete(transaction);
        resolve(value);
      };
      transaction.onabort = () => {
        signal?.removeEventListener("abort", cancelled);
        this.transactions.delete(transaction);
        reject(
          failure ??
            transaction.error ??
            new RenderError("RENDER_STORE_TRANSACTION", "Render storage transaction was aborted."),
        );
      };
      transaction.onerror = () => {
        failure ??= transaction.error;
      };
      const fail = (error: unknown): void => {
        failure = error;
        try {
          transaction.abort();
        } catch {
          reject(error);
        }
      };
      const cancelled = (): void =>
        fail(new RenderError("RENDER_CANCELLED", "Render output snapshot read was cancelled."));
      signal?.addEventListener("abort", cancelled, { once: true });
      try {
        work(
          transaction,
          (result) => {
            value = result;
          },
          fail,
        );
      } catch (error) {
        fail(error);
      }
    });
  }
  protected async change(
    jobId: string,
    operation: Operation,
    transform: (job: StoredJob | null, jobs: readonly StoredJob[]) => Change,
  ): Promise<void> {
    if (operation !== "recover" && operation !== "delete") this.assertOwnedWriter(jobId);
    else this.assertOpen();
    return this.transaction<void>(jobId, "readwrite", (transaction, finish, fail) => {
      const jobs = transaction.objectStore("jobs");
      const request = jobs.getAll();
      request.onsuccess = () => {
        try {
          if (operation !== "recover" && operation !== "delete") this.assertOwnedWriter(jobId);
          else this.assertOpen();
          // All jobs participate in the same readwrite transaction as admission and chunk commit.
          // IndexedDB serializes this scope across tabs, so concurrent reservations cannot oversubscribe.
          const records = request.result as StoredJob[];
          const next = transform(
            structuredClone(records.find((job) => job.jobId === jobId) ?? null),
            records,
          );
          admitArchive(operation, jobId, records, next);
          if (next.manifest) transaction.objectStore("manifests").put(next.manifest);
          if (next.removeChunks) {
            transaction.objectStore("manifests").delete(jobId);
            const cursor = transaction.objectStore("chunks").index("jobId").openCursor(jobId);
            cursor.onsuccess = () => {
              if (cursor.result) {
                cursor.result.delete();
                cursor.result.continue();
              }
            };
          }
          if (next.chunk) transaction.objectStore("chunks").add(next.chunk);
          if (next.job) jobs.put(next.job);
          else jobs.delete(jobId);
          finish(undefined);
        } catch (error) {
          fail(error);
        }
      };
    });
  }
  protected async load(jobId: string): Promise<StoredJob | null> {
    return this.transaction<StoredJob | null>(jobId, "readonly", (transaction, finish) => {
      const request = transaction.objectStore("jobs").get(jobId);
      request.onsuccess = () => finish((request.result as StoredJob | undefined) ?? null);
    });
  }
  protected async loadManifest(jobId: string): Promise<string | null> {
    return this.transaction<string | null>(jobId, "readonly", (transaction, finish) => {
      const request = transaction.objectStore("manifests").get(jobId);
      request.onsuccess = () =>
        finish((request.result as StoredManifest | undefined)?.json ?? null);
    });
  }
  protected async list(): Promise<StoredJob[]> {
    return this.transaction<StoredJob[]>("recovery", "readonly", (transaction, finish) => {
      const result: StoredJob[] = [];
      const request = transaction.objectStore("jobs").openCursor();
      request.onsuccess = () => {
        if (request.result) {
          result.push(request.result.value as StoredJob);
          request.result.continue();
        } else finish(result);
      };
    });
  }
  protected async materialize(job: StoredJob, outputId: string | null): Promise<Blob | null> {
    return this.transaction<Blob | null>(job.jobId, "readonly", (transaction, finish, fail) => {
      const parts: Blob[] = [];
      const totals = new Map<string, { bytes: number; chunks: number }>();
      const check = auditChunks(job);
      const hashes = new Map(job.outputs.map((output) => [output.id, new IncrementalSha256()]));
      const request = transaction.objectStore("chunks").index("jobId").openCursor(job.jobId);
      request.onsuccess = () => {
        try {
          const cursor = request.result;
          if (cursor) {
            const chunk = cursor.value as StoredChunk;
            check(chunk);
            hashes.get(chunk.outputId)!.update(chunk.bytes);
            const total = totals.get(chunk.outputId) ?? { bytes: 0, chunks: 0 };
            total.bytes += chunk.bytes.byteLength;
            total.chunks++;
            totals.set(chunk.outputId, total);
            // Blob implementations may retain native memory. Only bounded chunk bytes are held as JS arrays.
            if (chunk.outputId === outputId) parts.push(new Blob([chunk.bytes]));
            cursor.continue();
          } else {
            for (const output of job.outputs)
              requireStore(
                totals.get(output.id)?.bytes === output.bytes &&
                  totals.get(output.id)?.chunks === output.chunks &&
                  hashes.get(output.id)!.digestHex() === output.sha256,
                "RENDER_STORE_INTEGRITY",
                "Stored output chunks or SHA-256 differ from the sealed artifact.",
              );
            finish(outputId === null ? null : new Blob(parts, { type: "audio/wav" }));
          }
        } catch (error) {
          fail(error);
        }
      };
    });
  }
  protected async captureSnapshot(
    jobId: string,
    maximum: number,
    signal?: AbortSignal,
  ): Promise<VerifiedRenderJobSnapshot | null> {
    return this.transaction<VerifiedRenderJobSnapshot | null>(
      jobId,
      "readonly",
      (transaction, finish, fail) => {
        const jobRequest = transaction.objectStore("jobs").get(jobId);
        jobRequest.onsuccess = () => {
          try {
            this.assertRead(signal);
            const job = (jobRequest.result as StoredJob | undefined) ?? null;
            if (job?.status !== "published") {
              finish(null);
              return;
            }
            const manifestRequest = transaction.objectStore("manifests").get(jobId);
            manifestRequest.onsuccess = () => {
              try {
                this.assertRead(signal);
                const manifest =
                  (manifestRequest.result as StoredManifest | undefined)?.json ?? null;
                const assembler = snapshotAssembler(job, manifest, maximum);
                const request = transaction.objectStore("chunks").index("jobId").openCursor(jobId);
                request.onsuccess = () => {
                  try {
                    this.assertRead(signal);
                    const cursor = request.result;
                    if (cursor) {
                      assembler.add(cursor.value as StoredChunk);
                      cursor.continue();
                    } else finish(assembler.finish());
                  } catch (error) {
                    fail(error);
                  }
                };
              } catch (error) {
                fail(error);
              }
            };
          } catch (error) {
            fail(error);
          }
        };
      },
      signal,
    );
  }
  protected async verifySnapshotAuthority(
    snapshot: VerifiedRenderJobSnapshot,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.transaction<void>(
      snapshot.jobId,
      "readonly",
      (transaction, finish, fail) => {
        const jobRequest = transaction.objectStore("jobs").get(snapshot.jobId);
        jobRequest.onsuccess = () => {
          try {
            this.assertRead(signal);
            const manifestRequest = transaction.objectStore("manifests").get(snapshot.jobId);
            manifestRequest.onsuccess = () => {
              try {
                this.assertRead(signal);
                assertSnapshotAuthority(
                  snapshot,
                  (jobRequest.result as StoredJob | undefined) ?? null,
                  (manifestRequest.result as StoredManifest | undefined)?.json ?? null,
                );
                finish(undefined);
              } catch (error) {
                fail(error);
              }
            };
          } catch (error) {
            fail(error);
          }
        };
      },
      signal,
    );
  }
  protected interrupt(jobId?: string): void {
    for (const [transaction, owner] of this.transactions)
      if (jobId === undefined || owner === jobId) {
        try {
          transaction.abort();
        } catch {
          /* It has already completed; its result remains authoritative. */
        }
      }
  }
  protected close(): void {
    void this.database?.then((database) => database.close()).catch(() => undefined);
  }
}
