import { canonicalStringify } from "../experiments/hash.js";
import {
  ExperimentRecorder,
  verifyRecording,
  type RecordingSealSnapshot,
} from "../experiments/recorder.js";
import { RecordingWorkerClient, type WorkerPort } from "../experiments/recording-worker-client.js";
import {
  RecordingError,
  type RecordingArtifact,
  type RecordingFrame,
} from "../experiments/types.js";
import {
  RecordingPersistenceSession,
  type RecordingAppendOptions,
  type RecordingCapturePersistence,
  type RecordingPersistenceBudget,
  type RecordingPersistenceCallbacks,
  type EncodedRecordingFrame,
} from "../experiments/recording-persistence.js";
import { IncrementalSha256 } from "./incremental-sha256.js";
import {
  observeRecordingCommit,
  recordingCommitTime,
  recordingCommitElapsed,
  type RecordingCommitObserver,
} from "../experiments/recording-commit-diagnostics.js";
import { ProjectError, type ProjectAsset } from "./types.js";

export interface BlobStoreLimits {
  maxAssetBytes: number;
  maxRecordingBytes: number;
  maxTotalBytes: number;
  /** Immutable versions each consume an entry. No automatic eviction breaks project refs. */
  maxAssetEntries: number;
  maxRecordings: number;
}
export const DEFAULT_BLOB_LIMITS: Readonly<BlobStoreLimits> = Object.freeze({
  maxAssetBytes: 16 * 1024 * 1024,
  maxRecordingBytes: 70 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024,
  maxAssetEntries: 256,
  maxRecordings: 100,
});
export interface StoredAssetMetadata {
  name: string;
  origin: "imported" | "generated";
  license: string;
  revision: number;
}
export interface SaveAssetInput {
  assetId: string;
  sha256: string;
  bytes: ArrayBuffer;
  metadata: StoredAssetMetadata;
}
export interface StoredAsset extends SaveAssetInput {
  /** Encoded file bytes only; neither a descriptor hash nor decoded PCM availability. */
  hashKind: "encodedBytesSha256";
}
export interface StoredRecordingReceipt {
  runId: string;
  /** Existing RecordingReference SHA: canonical artifact body, excluding artifactSha256. */
  sha256: string;
  hashKind: "canonicalRecordingArtifactSha256";
  encodedSha256: string;
  encodedHashKind: "utf8JsonBytesSha256";
  byteLength: number;
}
interface AssetRecord extends StoredAsset {
  kind: "asset";
  byteLength: number;
}
interface LegacyRecordingRecord extends StoredRecordingReceipt {
  kind: "recording";
  bytes: ArrayBuffer;
  storageVersion?: never;
}
interface RecordingChunkDescriptor {
  sequence: number;
  tick: number;
  byteLength: number;
  sha256: string;
}
interface RecordingChunkRecord extends RecordingChunkDescriptor {
  sessionId: string;
  bytes: ArrayBuffer;
}
interface ChunkedRecordingRecord extends StoredRecordingReceipt {
  kind: "recording";
  storageVersion: "chunked-recording-v1";
  sessionId: string;
  prefix: ArrayBuffer;
  suffix: ArrayBuffer;
  chunks: RecordingChunkDescriptor[];
}
type RecordingRecord = LegacyRecordingRecord | ChunkedRecordingRecord;
export interface RecordingRecoveryEntry {
  sessionId: string;
  runId: string;
  runEpoch: string;
  sceneRevision: number;
  state: "staging" | "interrupted";
  persistedFrames: number;
  persistedTick: number | null;
  reservedBytes: number;
  reason: string | null;
  leaseExpiresAt: number;
}
interface RecordingSessionRecord extends RecordingRecoveryEntry {
  snapshot: RecordingSealSnapshot;
  chunks: RecordingChunkDescriptor[];
}
type BlobRecord = AssetRecord | RecordingRecord;
interface Budget {
  totalBytes: number;
  assetEntries: number;
  recordings: number;
}
interface Head {
  sha256: string;
  revision: number;
}
interface CommitPlan {
  budget: Budget;
  head: Head;
  duplicate: boolean;
}
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const emptyBudget = (): Budget => ({ totalBytes: 0, assetEntries: 0, recordings: 0 });
function fail(code: string, message: string): never {
  throw new ProjectError(code, message);
}
function identity(value: string): void {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value))
    fail("BLOB_ID", "Blob identity must be a bounded stable ID");
}
function hash(value: string): void {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    fail("BLOB_HASH", "Expected SHA-256");
}
function metadata(input: StoredAssetMetadata): StoredAssetMetadata {
  const value = JSON.parse(canonicalStringify(input)) as StoredAssetMetadata;
  if (
    !value ||
    Object.keys(value).some((key) => !["name", "origin", "license", "revision"].includes(key)) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 256 ||
    typeof value.license !== "string" ||
    !value.license.trim() ||
    value.license.length > 512 ||
    !["generated", "imported"].includes(value.origin) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    value.revision > 2147483647
  )
    fail("BLOB_METADATA", "Asset name, license, origin and revision are required");
  return value;
}
async function digest(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) fail("HASH_UNAVAILABLE", "WebCrypto SHA-256 is required");
  return [...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
function key(record: BlobRecord): [string, string] {
  return [record.kind === "asset" ? record.assetId : record.runId, record.sha256];
}
function memoryKey(id: string, sha256: string): string {
  return `${id}\u0000${sha256}`;
}

/** Local immutable byte storage. IDB denial/quota errors never silently switch to volatile memory. */
export class BlobStore {
  readonly mode: "indexedDB" | "memory";
  readonly capabilities: Readonly<{
    persistent: boolean;
    crossTabAtomicWrites: boolean;
    immutableHashReferences: true;
  }>;
  readonly limits: Readonly<BlobStoreLimits>;
  private readonly factory: IDBFactory | null;
  private readonly databaseName: string;
  private opening: Promise<IDBDatabase> | null = null;
  private database: IDBDatabase | null = null;
  private closed = false;
  private readonly memory = new Map<string, BlobRecord>();
  private readonly heads = new Map<string, Head>();
  private budget = emptyBudget();
  private stagingBytes = 0;
  private readonly sessions = new Map<string, RecordingSessionRecord>();
  private readonly chunks = new Map<string, RecordingChunkRecord>();
  private readonly captureSessions = new Set<RecordingCapturePersistence>();
  #prepared = new WeakMap<
    RecordingArtifact,
    { bytes: ArrayBuffer; encodedSha256: string; inFlight?: Promise<StoredRecordingReceipt> }
  >();
  #workerClient: RecordingWorkerClient | null = null;

  sealRecording(recorder: ExperimentRecorder): Promise<RecordingArtifact> {
    this.assertOpen();
    this.#workerClient ??= new RecordingWorkerClient(
      () =>
        new Worker(new URL("../experiments/recording-seal.worker.ts", import.meta.url), {
          type: "module",
        }) as unknown as WorkerPort,
      120000,
    );
    return recorder.finish(async (snapshot) => {
      const output = await this.#workerClient!.run(snapshot);
      const artifact = output.artifact as RecordingArtifact;
      this.assertOpen();
      this.#prepared.set(artifact, { bytes: output.bytes, encodedSha256: output.encodedSha256 });
      return artifact;
    });
  }

  constructor(
    options: {
      indexedDB?: IDBFactory | null;
      databaseName?: string;
      limits?: Partial<BlobStoreLimits>;
    } = {},
  ) {
    this.factory =
      options.indexedDB === undefined ? (globalThis.indexedDB ?? null) : options.indexedDB;
    this.databaseName = options.databaseName ?? "reflection-lab.blobs.v1";
    if (!this.databaseName || this.databaseName.length > 128)
      fail("BLOB_ID", "Invalid database name");
    const limits = { ...DEFAULT_BLOB_LIMITS, ...options.limits };
    for (const name of Object.keys(limits) as (keyof BlobStoreLimits)[])
      if (
        !Object.hasOwn(DEFAULT_BLOB_LIMITS, name) ||
        !Number.isSafeInteger(limits[name]) ||
        limits[name] < 1 ||
        limits[name] > DEFAULT_BLOB_LIMITS[name]
      )
        fail("BLOB_BUDGET", `Invalid ${name} limit`);
    this.limits = Object.freeze(limits);
    this.mode = this.factory ? "indexedDB" : "memory";
    this.capabilities = Object.freeze({
      persistent: this.mode === "indexedDB",
      crossTabAtomicWrites: this.mode === "indexedDB",
      immutableHashReferences: true,
    });
  }
  private assertOpen(): void {
    if (this.closed) fail("BLOB_CLOSED", "Blob store is closed");
  }
  private open(): Promise<IDBDatabase> {
    this.assertOpen();
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory!.open(this.databaseName, 2);
      } catch {
        reject(
          new ProjectError(
            "BLOB_STORAGE_OPEN",
            "IndexedDB access failed; no volatile fallback was substituted",
          ),
        );
        return;
      }
      let rejected = false;
      const refuse = (message: string) => {
        rejected = true;
        reject(new ProjectError("BLOB_STORAGE_OPEN", message));
      };
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("assets"))
          database.createObjectStore("assets", { keyPath: ["assetId", "sha256"] });
        if (!database.objectStoreNames.contains("recordings"))
          database.createObjectStore("recordings", { keyPath: ["runId", "sha256"] });
        if (!database.objectStoreNames.contains("state")) database.createObjectStore("state");
        if (!database.objectStoreNames.contains("recordingChunks"))
          database.createObjectStore("recordingChunks", { keyPath: ["sessionId", "sequence"] });
        if (!database.objectStoreNames.contains("recordingSessions"))
          database.createObjectStore("recordingSessions", { keyPath: "sessionId" });
      };
      request.onerror = () => refuse(request.error?.name ?? "IndexedDB could not be opened");
      request.onblocked = () => refuse("IndexedDB upgrade is blocked by another tab");
      request.onsuccess = () => {
        if (rejected || this.closed) {
          request.result.close();
          if (this.closed) refuse("Store closed during open");
          return;
        }
        this.database = request.result;
        this.database.onversionchange = () => this.close();
        resolve(this.database);
      };
    });
    return this.opening;
  }
  private plan(
    candidate: BlobRecord,
    previous: BlobRecord | undefined,
    head: Head | undefined,
    budget: Budget,
    stagedBytes = 0,
    stagedRecordings = 0,
  ): CommitPlan {
    if (
      budget === null ||
      typeof budget !== "object" ||
      Object.keys(budget).length !== 3 ||
      !["totalBytes", "assetEntries", "recordings"].every((name) => Object.hasOwn(budget, name))
    )
      fail("BLOB_INTEGRITY", "Stored budget is incomplete");
    for (const value of Object.values(budget))
      if (!Number.isSafeInteger(value) || value < 0)
        fail("BLOB_INTEGRITY", "Stored budget is corrupt");
    if (
      head !== undefined &&
      (head === null ||
        typeof head !== "object" ||
        typeof head.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(head.sha256) ||
        !Number.isSafeInteger(head.revision) ||
        head.revision < 1)
    )
      fail("BLOB_INTEGRITY", "Stored identity head is corrupt");
    const revision = candidate.kind === "asset" ? candidate.metadata.revision : 1;
    if (previous) {
      if (
        candidate.kind === "asset" &&
        (previous.kind !== "asset" ||
          canonicalStringify(previous.metadata) !== canonicalStringify(candidate.metadata))
      )
        fail("REVISION_CONFLICT", "Same byte reference cannot replace its provenance");
      if (
        candidate.kind === "recording" &&
        (previous.kind !== "recording" || previous.encodedSha256 !== candidate.encodedSha256)
      )
        fail("REVISION_CONFLICT", "Run artifact is immutable");
      return { budget, head: head ?? { sha256: candidate.sha256, revision }, duplicate: true };
    }
    if (
      head &&
      (revision < head.revision || (revision === head.revision && candidate.sha256 !== head.sha256))
    )
      fail(
        "REVISION_CONFLICT",
        "Stored identity revision changed; previous immutable bytes retained",
      );
    const next = {
      totalBytes: budget.totalBytes + candidate.byteLength,
      assetEntries: budget.assetEntries + (candidate.kind === "asset" ? 1 : 0),
      recordings: budget.recordings + (candidate.kind === "recording" ? 1 : 0),
    };
    if (
      next.totalBytes + stagedBytes > this.limits.maxTotalBytes ||
      next.assetEntries > this.limits.maxAssetEntries ||
      next.recordings + stagedRecordings > this.limits.maxRecordings
    )
      fail("BLOB_BUDGET", "Local immutable blob budget exhausted; existing data retained");
    return { budget: next, head: { sha256: candidate.sha256, revision }, duplicate: false };
  }
  private assertRecordingGeneration(
    candidate: BlobRecord,
    previous: BlobRecord | undefined,
    repairGeneration: string | null,
  ): void {
    if (
      candidate.kind === "recording" &&
      previous?.kind === "recording" &&
      previous.storageVersion === "chunked-recording-v1" &&
      previous.sessionId !== repairGeneration
    )
      fail(
        "BLOB_GENERATION_CHANGED",
        "A different recording generation committed; verify it before reuse or repair",
      );
  }
  private async commit(
    candidate: BlobRecord,
    signal?: AbortSignal,
    repairGeneration: string | null = null,
  ): Promise<void> {
    this.assertOpen();
    const [id, sha256] = key(candidate),
      headKey = `${candidate.kind}:${id}`;
    if (signal?.aborted) fail("BLOB_CANCELLED", "Recording publication was cancelled");
    const stagedSessionId =
      candidate.kind === "recording" && candidate.storageVersion === "chunked-recording-v1"
        ? candidate.sessionId
        : null;
    if (this.mode === "memory") {
      const recordKey = `${candidate.kind}:${memoryKey(id, sha256)}`;
      const previous = this.memory.get(recordKey);
      this.assertRecordingGeneration(candidate, previous, repairGeneration);
      const plan = this.plan(
        candidate,
        this.memory.get(recordKey),
        this.heads.get(headKey),
        this.budget,
        this.stagingBytes -
          (stagedSessionId ? (this.sessions.get(stagedSessionId)?.reservedBytes ?? 0) : 0),
        this.sessions.size - (stagedSessionId ? 1 : 0),
      );
      if (stagedSessionId) {
        const session = this.sessions.get(stagedSessionId);
        if (!session || session.state !== "staging")
          fail("BLOB_STAGING", "Recording session is no longer publishable");
        this.stagingBytes -= session.reservedBytes;
        this.sessions.delete(stagedSessionId);
      }
      this.memory.set(recordKey, structuredClone(candidate));
      if (
        plan.duplicate &&
        previous?.kind === "recording" &&
        previous.storageVersion === "chunked-recording-v1"
      )
        for (const chunk of previous.chunks)
          this.chunks.delete(`${previous.sessionId}:${chunk.sequence}`);
      this.heads.set(headKey, plan.head);
      this.budget = plan.budget;
      return;
    }
    const database = await this.open();
    this.assertOpen();
    if (signal?.aborted) fail("BLOB_CANCELLED", "Recording publication was cancelled");
    await new Promise<void>((resolve, reject) => {
      // All stores share this transaction: cross-tab caps and revision checks are serialized.
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(
          ["assets", "recordings", "state", "recordingSessions", "recordingChunks"],
          "readwrite",
        );
      } catch {
        reject(
          new ProjectError(
            "BLOB_STORAGE_WRITE",
            "IndexedDB write transaction could not start; previous data retained",
          ),
        );
        return;
      }
      const state = transaction.objectStore("state"),
        store = transaction.objectStore(candidate.kind === "asset" ? "assets" : "recordings");
      const budgetRequest = state.get("budget"),
        headRequest = state.get(headKey),
        previousRequest = store.get([id, sha256]),
        stagingRequest = state.get("recordingStagingBytes"),
        sessionRequest = transaction
          .objectStore("recordingSessions")
          .get(stagedSessionId ?? "__none__"),
        sessionCountRequest = transaction.objectStore("recordingSessions").count();
      const abort = () => {
        try {
          transaction.abort();
        } catch {
          /* already completed */
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      let remaining = 6,
        failure: unknown;
      const ready = () => {
        if (--remaining !== 0) return;
        try {
          const session = sessionRequest.result as RecordingSessionRecord | undefined;
          if (stagedSessionId && (!session || session.state !== "staging"))
            fail("BLOB_STAGING", "Recording session is no longer publishable");
          const stagingBytes =
            this.validStagingBytes(stagingRequest.result) - (session?.reservedBytes ?? 0);
          if (stagingBytes < 0) fail("BLOB_INTEGRITY", "Recording staging reservation is corrupt");
          const previous = previousRequest.result as BlobRecord | undefined;
          this.assertRecordingGeneration(candidate, previous, repairGeneration);
          const plan = this.plan(
            candidate,
            previous,
            headRequest.result as Head | undefined,
            budgetRequest.result === undefined ? emptyBudget() : (budgetRequest.result as Budget),
            stagingBytes,
            sessionCountRequest.result - (stagedSessionId ? 1 : 0),
          );
          // Rewriting the exact verified ref also repairs damaged local bytes without changing identity or budget.
          if (plan.duplicate) store.put(candidate);
          else store.add(candidate);
          if (
            plan.duplicate &&
            previous?.kind === "recording" &&
            previous.storageVersion === "chunked-recording-v1"
          )
            for (const chunk of previous.chunks)
              transaction
                .objectStore("recordingChunks")
                .delete([previous.sessionId, chunk.sequence]);
          state.put(plan.budget, "budget");
          state.put(plan.head, headKey);
          if (stagedSessionId) {
            state.put(stagingBytes, "recordingStagingBytes");
            transaction.objectStore("recordingSessions").delete(stagedSessionId);
          }
        } catch (error) {
          failure =
            error instanceof ProjectError
              ? error
              : new ProjectError(
                  "BLOB_STORAGE_WRITE",
                  "IndexedDB write failed; previous data retained",
                );
          // A storage exception may already have aborted the transaction.
          try {
            transaction.abort();
          } catch {
            /* onabort still reports the original failure. */
          }
        }
      };
      budgetRequest.onsuccess = ready;
      headRequest.onsuccess = ready;
      previousRequest.onsuccess = ready;
      stagingRequest.onsuccess = ready;
      sessionRequest.onsuccess = ready;
      sessionCountRequest.onsuccess = ready;
      transaction.oncomplete = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      transaction.onabort = () => {
        signal?.removeEventListener("abort", abort);
        reject(
          failure ??
            new ProjectError(
              "BLOB_STORAGE_WRITE",
              `IndexedDB transaction aborted: ${transaction.error?.name ?? "unknown"}; previous data retained`,
            ),
        );
      };
      transaction.onerror = () => {
        /* onabort supplies the definitive transaction result. */
      };
    });
  }
  private async read(
    kind: BlobRecord["kind"],
    id: string,
    sha256: string,
  ): Promise<BlobRecord | undefined> {
    this.assertOpen();
    identity(id);
    hash(sha256);
    if (this.mode === "memory")
      return structuredClone(this.memory.get(`${kind}:${memoryKey(id, sha256)}`));
    const database = await this.open();
    this.assertOpen();
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(kind === "asset" ? "assets" : "recordings", "readonly");
      } catch {
        reject(new ProjectError("BLOB_STORAGE_READ", "IndexedDB read transaction could not start"));
        return;
      }
      const request = transaction
        .objectStore(kind === "asset" ? "assets" : "recordings")
        .get([id, sha256]);
      transaction.oncomplete = () => resolve(request.result as BlobRecord | undefined);
      transaction.onabort = () =>
        reject(
          new ProjectError("BLOB_STORAGE_READ", transaction.error?.name ?? "IndexedDB read failed"),
        );
    });
  }
  async saveAsset(input: SaveAssetInput): Promise<StoredAsset> {
    this.assertOpen();
    identity(input.assetId);
    hash(input.sha256);
    if (
      !(input.bytes instanceof ArrayBuffer) ||
      input.bytes.byteLength < 1 ||
      input.bytes.byteLength > this.limits.maxAssetBytes
    )
      fail("BLOB_BUDGET", "Encoded asset bytes exceed local budget");
    // Snapshot before the first await: callers retain ownership of their original data.
    const candidate: AssetRecord = {
      kind: "asset",
      assetId: input.assetId,
      sha256: input.sha256,
      bytes: input.bytes.slice(0),
      metadata: metadata(input.metadata),
      hashKind: "encodedBytesSha256",
      byteLength: input.bytes.byteLength,
    };
    if ((await digest(candidate.bytes)) !== candidate.sha256)
      fail("BLOB_HASH", "Encoded asset SHA does not match bytes");
    await this.commit(candidate);
    return {
      assetId: candidate.assetId,
      sha256: candidate.sha256,
      bytes: candidate.bytes.slice(0),
      metadata: structuredClone(candidate.metadata),
      hashKind: candidate.hashKind,
    };
  }
  async loadAsset(assetId: string, sha256: string): Promise<StoredAsset | null> {
    const record = await this.read("asset", assetId, sha256);
    if (!record) return null;
    if (
      record.kind !== "asset" ||
      record.assetId !== assetId ||
      record.sha256 !== sha256 ||
      record.hashKind !== "encodedBytesSha256" ||
      !(record.bytes instanceof ArrayBuffer) ||
      record.byteLength !== record.bytes.byteLength ||
      record.byteLength < 1 ||
      record.byteLength > this.limits.maxAssetBytes ||
      (await digest(record.bytes)) !== sha256
    )
      fail("BLOB_INTEGRITY", "Stored asset bytes/hash/provenance do not match reference");
    return {
      assetId,
      sha256,
      bytes: record.bytes.slice(0),
      metadata: metadata(record.metadata),
      hashKind: record.hashKind,
    };
  }
  async saveRecording(artifact: RecordingArtifact): Promise<StoredRecordingReceipt> {
    this.assertOpen();
    const prepared = this.#prepared.get(artifact);
    if (prepared) {
      if (prepared.inFlight) return prepared.inFlight;
      const operation = (async () => {
        identity(artifact.runId);
        hash(artifact.artifactSha256);
        hash(prepared.encodedSha256);
        const bytes = prepared.bytes.slice(0);
        if (bytes.byteLength > this.limits.maxRecordingBytes)
          fail("BLOB_BUDGET", "Recording encoded bytes exceed local budget");
        if ((await digest(bytes)) !== prepared.encodedSha256)
          fail("BLOB_HASH", "Prepared recording bytes changed");
        const decoded = JSON.parse(decoder.decode(bytes)) as RecordingArtifact;
        await verifyRecording(decoded);
        if (decoded.runId !== artifact.runId || decoded.artifactSha256 !== artifact.artifactSha256)
          fail("BLOB_HASH", "Prepared recording identity changed");
        const candidate: RecordingRecord = {
          kind: "recording",
          runId: artifact.runId,
          sha256: artifact.artifactSha256,
          hashKind: "canonicalRecordingArtifactSha256",
          encodedSha256: prepared.encodedSha256,
          encodedHashKind: "utf8JsonBytesSha256",
          byteLength: bytes.byteLength,
          bytes,
        };
        const receipt = await this.commitVerifiedRecording(candidate, decoded);
        this.#prepared.delete(artifact);
        return receipt;
      })();
      prepared.inFlight = operation;
      try {
        return await operation;
      } finally {
        delete prepared.inFlight;
      }
    }
    const text = canonicalStringify(artifact),
      bytes = encoder.encode(text).buffer;
    if (bytes.byteLength > this.limits.maxRecordingBytes)
      fail("BLOB_BUDGET", "Recording encoded bytes exceed local budget");
    const candidateArtifact = JSON.parse(text) as RecordingArtifact;
    identity(candidateArtifact.runId);
    hash(candidateArtifact.artifactSha256);
    await verifyRecording(candidateArtifact);
    const candidate: RecordingRecord = {
      kind: "recording",
      runId: candidateArtifact.runId,
      sha256: candidateArtifact.artifactSha256,
      hashKind: "canonicalRecordingArtifactSha256",
      encodedSha256: await digest(bytes),
      encodedHashKind: "utf8JsonBytesSha256",
      byteLength: bytes.byteLength,
      bytes,
    };
    return this.commitVerifiedRecording(candidate, candidateArtifact);
  }
  private async inspectPublishedRecordingChunks(
    artifact: RecordingArtifact,
  ): Promise<{ receipt: StoredRecordingReceipt | null; repairGeneration: string | null }> {
    const existing = await this.read("recording", artifact.runId, artifact.artifactSha256);
    if (existing?.kind !== "recording" || existing.storageVersion !== "chunked-recording-v1")
      return { receipt: null, repairGeneration: null };
    try {
      await this.verifyChunkedRecording(existing);
      return { receipt: this.receipt(existing), repairGeneration: null };
    } catch (error) {
      // Exact verified bytes may repair local corruption; operational read failures remain explicit.
      if (
        (error instanceof ProjectError && error.code === "BLOB_INTEGRITY") ||
        error instanceof RecordingError
      )
        return { receipt: null, repairGeneration: existing.sessionId };
      throw error;
    }
  }
  private async commitVerifiedRecording(
    candidate: RecordingRecord,
    artifact: RecordingArtifact,
    signal?: AbortSignal,
  ): Promise<StoredRecordingReceipt> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) fail("BLOB_CANCELLED", "Recording publication was cancelled");
      const inspected = await this.inspectPublishedRecordingChunks(artifact);
      if (signal?.aborted) fail("BLOB_CANCELLED", "Recording publication was cancelled");
      if (inspected.receipt) {
        if (candidate.storageVersion === "chunked-recording-v1")
          await this.discardRecordingSession(candidate.sessionId, true, signal);
        return inspected.receipt;
      }
      try {
        await this.commit(candidate, signal, inspected.repairGeneration);
        return this.receipt(candidate);
      } catch (error) {
        if (
          !(error instanceof ProjectError) ||
          error.code !== "BLOB_GENERATION_CHANGED" ||
          attempt === 2
        )
          throw error;
      }
    }
    fail(
      "BLOB_GENERATION_CHANGED",
      "Recording publication kept changing; complete staging retained",
    );
  }
  private receipt(record: RecordingRecord): StoredRecordingReceipt {
    return {
      runId: record.runId,
      sha256: record.sha256,
      hashKind: record.hashKind,
      encodedSha256: record.encodedSha256,
      encodedHashKind: record.encodedHashKind,
      byteLength: record.byteLength,
    };
  }
  async loadRecording(runId: string, sha256: string): Promise<RecordingArtifact | null> {
    const record = await this.read("recording", runId, sha256);
    if (!record) return null;
    if (record.kind === "recording" && record.storageVersion === "chunked-recording-v1") {
      if (record.runId !== runId || record.sha256 !== sha256)
        fail("BLOB_INTEGRITY", "Recording manifest identity differs");
      return this.verifyChunkedRecording(record);
    }
    if (
      record.kind !== "recording" ||
      record.runId !== runId ||
      record.sha256 !== sha256 ||
      record.hashKind !== "canonicalRecordingArtifactSha256" ||
      record.encodedHashKind !== "utf8JsonBytesSha256" ||
      !(record.bytes instanceof ArrayBuffer) ||
      record.byteLength !== record.bytes.byteLength ||
      record.byteLength > this.limits.maxRecordingBytes ||
      (await digest(record.bytes)) !== record.encodedSha256
    )
      fail("BLOB_INTEGRITY", "Stored recording encoded bytes do not match receipt");
    let artifact: RecordingArtifact;
    try {
      artifact = JSON.parse(decoder.decode(record.bytes)) as RecordingArtifact;
    } catch {
      fail("BLOB_INTEGRITY", "Stored recording is not valid UTF-8 JSON");
    }
    if (artifact.runId !== runId || artifact.artifactSha256 !== sha256)
      fail("BLOB_INTEGRITY", "Recording reference identity differs");
    await verifyRecording(artifact);
    return artifact;
  }
  private async verifyChunkedRecording(record: ChunkedRecordingRecord): Promise<RecordingArtifact> {
    const bytes = await this.assembleRecording(record);
    let artifact: RecordingArtifact;
    try {
      artifact = JSON.parse(decoder.decode(bytes)) as RecordingArtifact;
    } catch {
      fail("BLOB_INTEGRITY", "Stored recording chunks are not valid UTF8 JSON");
    }
    if (artifact.runId !== record.runId || artifact.artifactSha256 !== record.sha256)
      fail("BLOB_INTEGRITY", "Recording identity differs");
    await verifyRecording(artifact);
    return artifact;
  }
  createRecordingPersistence(
    recorder: ExperimentRecorder,
    callbacks: RecordingPersistenceCallbacks = {},
    budget: Partial<RecordingPersistenceBudget> = {},
  ): RecordingCapturePersistence {
    this.assertOpen();
    const snapshot = recorder.captureSealSnapshot();
    if (snapshot.frames.length !== 0)
      fail("BLOB_STAGING", "Capture persistence must begin before its first frame");
    const session: RecordingCapturePersistence = new RecordingPersistenceSession(
      `recording.${crypto.randomUUID()}`,
      snapshot,
      {
        create: async (id, input) => {
          try {
            await this.createRecordingSession(id, input);
          } catch (error) {
            this.captureSessions.delete(session);
            throw error;
          }
        },
        append: (id, frames, observer, options) =>
          this.appendRecordingChunks(id, frames, observer, options),
        publish: async (id, artifact, signal) => {
          const receipt = await this.publishRecordingChunks(id, artifact, signal);
          this.captureSessions.delete(session);
          return receipt;
        },
        interrupt: async (id, reason) => {
          try {
            await this.interruptRecordingSession(id, reason);
          } finally {
            this.captureSessions.delete(session);
          }
        },
        heartbeat: (id) => this.heartbeatRecordingSession(id),
      },
      callbacks,
      budget,
    );
    this.captureSessions.add(session);
    return session;
  }
  private validStagingBytes(value: unknown): number {
    if (value === undefined) return 0;
    if (!Number.isSafeInteger(value) || (value as number) < 0)
      fail("BLOB_INTEGRITY", "Recording staging budget is corrupt");
    return value as number;
  }
  private async stagingTransaction<T>(
    work: (
      transaction: IDBTransaction,
      finish: (value: T) => void,
      reject: (error: unknown) => void,
    ) => void,
    signal?: AbortSignal,
    observer?: RecordingCommitObserver,
    options?: RecordingAppendOptions,
  ): Promise<T> {
    if (signal?.aborted) fail("BLOB_CANCELLED", "Recording transaction was cancelled");
    const database = await this.open();
    this.assertOpen();
    if (signal?.aborted) fail("BLOB_CANCELLED", "Recording transaction was cancelled");
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(
        ["recordingSessions", "recordingChunks", "recordings", "state"],
        "readwrite",
      );
      if (observer)
        observeRecordingCommit(observer, "transactionCreatedAtMs", recordingCommitTime());
      let result: T;
      let failure: unknown;
      let refused = false;
      let issued = false;
      const refuse = (reason: unknown) => {
        refused = true;
        failure = reason;
        try {
          transaction.abort();
        } catch {
          /* already aborted */
        }
      };
      const abort = () => {
        refused = true;
        try {
          transaction.abort();
        } catch {
          /* already complete */
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      transaction.oncomplete = () => {
        if (observer) observeRecordingCommit(observer, "oncompleteAtMs", recordingCommitTime());
        signal?.removeEventListener("abort", abort);
        resolve(result);
      };
      transaction.onabort = () => {
        refused = true;
        signal?.removeEventListener("abort", abort);
        reject(
          failure ??
            new ProjectError(
              "BLOB_STORAGE_WRITE",
              `Recording transaction aborted: ${transaction.error?.name ?? "unknown"}`,
            ),
        );
      };
      transaction.onerror = () => {
        /* onabort is definitive */
      };
      try {
        work(
          transaction,
          (value) => {
            result = value;
            if (!refused && !issued) {
              issued = true;
              try {
                options?.onIssued?.();
              } catch {
                // A notification cannot refuse or alter the transaction's writes.
              }
            }
          },
          refuse,
        );
      } catch (error) {
        refuse(error);
      }
    });
  }
  private async createRecordingSession(
    sessionId: string,
    snapshot: RecordingSealSnapshot,
  ): Promise<void> {
    const owned = structuredClone(snapshot);
    const reservedBytes = encoder.encode(canonicalStringify(owned)).byteLength;
    const session: RecordingSessionRecord = {
      sessionId,
      runId: owned.runId,
      runEpoch: owned.runEpoch,
      sceneRevision: owned.configuration.sceneSnapshot.sceneRevision,
      state: "staging",
      persistedFrames: 0,
      persistedTick: null,
      reservedBytes,
      reason: null,
      snapshot: owned,
      chunks: [],
      leaseExpiresAt: Date.now() + 30000,
    };
    if (this.mode === "memory") {
      this.assertOpen();
      if (
        this.budget.totalBytes + this.stagingBytes + reservedBytes > this.limits.maxTotalBytes ||
        this.budget.recordings + this.sessions.size >= this.limits.maxRecordings
      )
        fail("BLOB_BUDGET", "Recording staging budget exhausted; existing data retained");
      this.sessions.set(sessionId, session);
      this.stagingBytes += reservedBytes;
      return;
    }
    await this.stagingTransaction<void>((transaction, finish, refuse) => {
      const state = transaction.objectStore("state");
      const sessions = transaction.objectStore("recordingSessions");
      const budget = state.get("budget"),
        staged = state.get("recordingStagingBytes"),
        count = sessions.count();
      let remaining = 3;
      const ready = () => {
        if (--remaining) return;
        try {
          const stagingBytes = this.validStagingBytes(staged.result);
          const current = (budget.result ?? emptyBudget()) as Budget;
          if (
            current.totalBytes + stagingBytes + reservedBytes > this.limits.maxTotalBytes ||
            current.recordings + count.result >= this.limits.maxRecordings
          )
            fail("BLOB_BUDGET", "Recording staging budget exhausted; existing data retained");
          sessions.add(session);
          state.put(stagingBytes + reservedBytes, "recordingStagingBytes");
          finish();
        } catch (error) {
          refuse(error);
        }
      };
      budget.onsuccess = ready;
      staged.onsuccess = ready;
      count.onsuccess = ready;
    });
  }
  private async appendRecordingChunks(
    sessionId: string,
    frames: readonly EncodedRecordingFrame[],
    observer?: RecordingCommitObserver,
    options?: RecordingAppendOptions,
  ): Promise<void> {
    this.assertOpen();
    const records: RecordingChunkRecord[] = [];
    const digestStartedAt = recordingCommitTime();
    for (const frame of frames)
      records.push({
        ...frame,
        sessionId,
        byteLength: frame.bytes.byteLength,
        sha256: await digest(frame.bytes),
      });
    const digestsCompletedAt = recordingCommitTime();
    observeRecordingCommit(observer, "digestsCompletedAtMs", digestsCompletedAt);
    observeRecordingCommit(
      observer,
      "digestTotalMs",
      recordingCommitElapsed(digestStartedAt, digestsCompletedAt),
    );
    const append = (
      session: RecordingSessionRecord | undefined,
      publishedBudget: Budget,
      stagingBytes: number,
    ): RecordingSessionRecord => {
      if (!session || session.state !== "staging")
        fail("BLOB_STAGING", "Recording staging session is interrupted or missing");
      try {
        observeRecordingCommit(observer, "descriptorCountBefore", session.chunks.length);
      } catch {
        // Observation cannot replace a validation/clone error.
      }
      const next = structuredClone(session);
      let additional = 0;
      for (const record of records) {
        if (
          record.sequence !== next.persistedFrames ||
          (next.persistedTick !== null && record.tick !== next.persistedTick + 1)
        )
          fail("BLOB_CHUNK_ORDER", "Recording chunks must have contiguous sequence and ticks");
        const parsed = JSON.parse(decoder.decode(record.bytes)) as RecordingFrame;
        if (
          parsed.tick !== record.tick ||
          parsed.runEpoch !== session.runEpoch ||
          parsed.sceneRevision !== session.sceneRevision
        )
          fail("BLOB_CHUNK_IDENTITY", "Recording chunk identity differs");
        const { bytes: _bytes, sessionId: _sessionId, ...descriptor } = record;
        next.chunks.push(descriptor);
        next.persistedFrames++;
        next.persistedTick = record.tick;
        additional += record.byteLength;
      }
      if (
        next.persistedFrames > 18000 ||
        next.reservedBytes + additional > this.limits.maxRecordingBytes ||
        publishedBudget.totalBytes + stagingBytes + additional > this.limits.maxTotalBytes
      )
        fail("BLOB_BUDGET", "Recording chunk budget exhausted; existing data retained");
      next.reservedBytes += additional;
      next.leaseExpiresAt = Date.now() + 30000;
      return next;
    };
    if (this.mode === "memory") {
      const previous = this.sessions.get(sessionId);
      const next = append(previous, this.budget, this.stagingBytes);
      for (const record of records)
        this.chunks.set(`${sessionId}:${record.sequence}`, structuredClone(record));
      this.stagingBytes += next.reservedBytes - previous!.reservedBytes;
      this.sessions.set(sessionId, next);
      try {
        options?.onIssued?.();
      } catch {
        // Synchronous memory writes are authoritative even if notification fails.
      }
      return;
    }
    await this.stagingTransaction<void>(
      (transaction, finish, refuse) => {
        const state = transaction.objectStore("state"),
          sessions = transaction.objectStore("recordingSessions");
        const session = sessions.get(sessionId),
          budget = state.get("budget"),
          staged = state.get("recordingStagingBytes");
        let remaining = 3;
        const ready = () => {
          if (--remaining) return;
          const readsReadyAt = recordingCommitTime();
          observeRecordingCommit(observer, "readsReadyAtMs", readsReadyAt);
          try {
            const previous = session.result as RecordingSessionRecord | undefined;
            let stagingBytes: number;
            let next: RecordingSessionRecord;
            try {
              stagingBytes = this.validStagingBytes(staged.result);
              next = append(previous, (budget.result ?? emptyBudget()) as Budget, stagingBytes);
            } finally {
              observeRecordingCommit(
                observer,
                "validationParseCloneMs",
                recordingCommitElapsed(readsReadyAt, recordingCommitTime()),
              );
            }
            for (const record of records) transaction.objectStore("recordingChunks").add(record);
            sessions.put(next);
            state.put(
              stagingBytes + next.reservedBytes - previous!.reservedBytes,
              "recordingStagingBytes",
            );
            observeRecordingCommit(observer, "requestsIssuedAtMs", recordingCommitTime());
            finish();
          } catch (error) {
            refuse(error);
          }
        };
        session.onsuccess = ready;
        budget.onsuccess = ready;
        staged.onsuccess = ready;
      },
      undefined,
      observer,
      options,
    );
  }
  private async readRecordingSession(
    sessionId: string,
  ): Promise<RecordingSessionRecord | undefined> {
    this.assertOpen();
    identity(sessionId);
    if (this.mode === "memory") return structuredClone(this.sessions.get(sessionId));
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("recordingSessions", "readonly");
      const request = transaction.objectStore("recordingSessions").get(sessionId);
      transaction.oncomplete = () => resolve(request.result as RecordingSessionRecord | undefined);
      transaction.onabort = () =>
        reject(new ProjectError("BLOB_STORAGE_READ", "Recording session read failed"));
    });
  }
  private async readRecordingChunk(
    sessionId: string,
    descriptor: RecordingChunkDescriptor,
  ): Promise<ArrayBuffer> {
    let record: RecordingChunkRecord | undefined;
    if (this.mode === "memory")
      record = structuredClone(this.chunks.get(`${sessionId}:${descriptor.sequence}`));
    else {
      const database = await this.open();
      record = await new Promise<RecordingChunkRecord | undefined>((resolve, reject) => {
        const transaction = database.transaction("recordingChunks", "readonly");
        const request = transaction
          .objectStore("recordingChunks")
          .get([sessionId, descriptor.sequence]);
        transaction.oncomplete = () => resolve(request.result as RecordingChunkRecord | undefined);
        transaction.onabort = () =>
          reject(new ProjectError("BLOB_STORAGE_READ", "Recording chunk read failed"));
      });
    }
    if (
      !record ||
      record.sessionId !== sessionId ||
      record.sequence !== descriptor.sequence ||
      record.tick !== descriptor.tick ||
      record.byteLength !== descriptor.byteLength ||
      record.sha256 !== descriptor.sha256 ||
      !(record.bytes instanceof ArrayBuffer) ||
      record.bytes.byteLength !== descriptor.byteLength ||
      (await digest(record.bytes)) !== descriptor.sha256
    )
      fail("BLOB_INTEGRITY", "Recording chunk is missing or corrupt");
    return record.bytes;
  }
  private async publishRecordingChunks(
    sessionId: string,
    artifact: RecordingArtifact,
    signal: AbortSignal,
  ): Promise<StoredRecordingReceipt> {
    await verifyRecording(artifact);
    const session = await this.readRecordingSession(sessionId);
    if (
      !session ||
      session.state !== "staging" ||
      artifact.runId !== session.runId ||
      artifact.runEpoch !== session.runEpoch ||
      artifact.frameCount !== session.persistedFrames ||
      artifact.createdAt !== session.snapshot.createdAt ||
      canonicalStringify(artifact.configuration) !==
        canonicalStringify(session.snapshot.configuration)
    )
      fail("BLOB_STAGING", "Recording artifact does not match the fully persisted session");
    const keys = Object.keys(artifact).sort();
    const split = keys.indexOf("frames");
    const field = (name: string) =>
      `${JSON.stringify(name)}:${canonicalStringify((artifact as unknown as Record<string, unknown>)[name])}`;
    const prefix = encoder.encode(
      `{${keys.slice(0, split).map(field).join(",")},"frames":[`,
    ).buffer;
    const suffix = encoder.encode(
      `]${keys
        .slice(split + 1)
        .map((name) => `,${field(name)}`)
        .join("")}}`,
    ).buffer;
    const hash = new IncrementalSha256().update(new Uint8Array(prefix));
    let byteLength = prefix.byteLength + suffix.byteLength;
    for (let index = 0; index < session.chunks.length; index++) {
      if (signal.aborted) fail("BLOB_CANCELLED", "Recording publication was cancelled");
      const descriptor = session.chunks[index]!;
      const bytes = await this.readRecordingChunk(sessionId, descriptor);
      const expected = encoder.encode(canonicalStringify(artifact.frames[index]));
      if (
        descriptor.sequence !== index ||
        (index > 0 && descriptor.tick !== session.chunks[index - 1]!.tick + 1) ||
        (await digest(expected.buffer)) !== descriptor.sha256
      )
        fail("BLOB_INTEGRITY", "Recording chunk content differs from the sealed artifact");
      if (index > 0) {
        hash.update(new Uint8Array([44]));
        byteLength++;
      }
      hash.update(new Uint8Array(bytes));
      byteLength += bytes.byteLength;
    }
    hash.update(new Uint8Array(suffix));
    if (byteLength > this.limits.maxRecordingBytes)
      fail("BLOB_BUDGET", "Recording encoded bytes exceed local budget");
    const record: ChunkedRecordingRecord = {
      kind: "recording",
      storageVersion: "chunked-recording-v1",
      sessionId,
      prefix,
      suffix,
      chunks: session.chunks,
      runId: artifact.runId,
      sha256: artifact.artifactSha256,
      hashKind: "canonicalRecordingArtifactSha256",
      encodedHashKind: "utf8JsonBytesSha256",
      encodedSha256: hash.digestHex(),
      byteLength,
    };
    const receipt = await this.commitVerifiedRecording(record, artifact, signal);
    this.#prepared.delete(artifact);
    return receipt;
  }
  private async assembleRecording(record: ChunkedRecordingRecord): Promise<ArrayBuffer> {
    if (
      record.hashKind !== "canonicalRecordingArtifactSha256" ||
      record.encodedHashKind !== "utf8JsonBytesSha256" ||
      !Number.isSafeInteger(record.byteLength) ||
      record.byteLength < 1 ||
      record.byteLength > this.limits.maxRecordingBytes ||
      !(record.prefix instanceof ArrayBuffer) ||
      !(record.suffix instanceof ArrayBuffer) ||
      !Array.isArray(record.chunks) ||
      record.chunks.length > 18000
    )
      fail("BLOB_INTEGRITY", "Recording chunk manifest is corrupt");
    const expectedLength =
      record.prefix.byteLength +
      record.suffix.byteLength +
      Math.max(0, record.chunks.length - 1) +
      record.chunks.reduce((sum, chunk) => {
        if (
          !Number.isSafeInteger(chunk.byteLength) ||
          chunk.byteLength < 1 ||
          chunk.byteLength > this.limits.maxRecordingBytes
        )
          fail("BLOB_INTEGRITY", "Recording chunk length is corrupt");
        return sum + chunk.byteLength;
      }, 0);
    if (expectedLength !== record.byteLength)
      fail("BLOB_INTEGRITY", "Recording manifest length differs");
    const output = new Uint8Array(record.byteLength);
    let offset = 0;
    const write = (bytes: ArrayBuffer) => {
      output.set(new Uint8Array(bytes), offset);
      offset += bytes.byteLength;
    };
    write(record.prefix);
    for (let index = 0; index < record.chunks.length; index++) {
      const descriptor = record.chunks[index]!;
      if (
        descriptor.sequence !== index ||
        (index > 0 && descriptor.tick !== record.chunks[index - 1]!.tick + 1)
      )
        fail("BLOB_INTEGRITY", "Recording chunks are not contiguous");
      if (index > 0) output[offset++] = 44;
      write(await this.readRecordingChunk(record.sessionId, descriptor));
    }
    write(record.suffix);
    if ((await digest(output.buffer)) !== record.encodedSha256)
      fail("BLOB_INTEGRITY", "Recording UTF8 bytes digest differs");
    return output.buffer;
  }
  async listRecordingRecovery(): Promise<RecordingRecoveryEntry[]> {
    this.assertOpen();
    let sessions: RecordingSessionRecord[];
    if (this.mode === "memory") sessions = structuredClone([...this.sessions.values()]);
    else {
      const database = await this.open();
      sessions = await new Promise((resolve, reject) => {
        const transaction = database.transaction("recordingSessions", "readonly");
        const request = transaction.objectStore("recordingSessions").getAll();
        transaction.oncomplete = () => resolve(request.result as RecordingSessionRecord[]);
        transaction.onabort = () =>
          reject(new ProjectError("BLOB_STORAGE_READ", "Recording recovery scan failed"));
      });
    }
    return sessions.map(({ snapshot: _snapshot, chunks: _chunks, ...entry }) => entry);
  }
  private assertRecoverableSession(
    sessionId: string,
    session: RecordingSessionRecord | undefined,
  ): asserts session is RecordingSessionRecord {
    if (!session || session.sessionId !== sessionId)
      fail("BLOB_STAGING", "Recording recovery session is missing");
    if (
      !["staging", "interrupted"].includes(session.state) ||
      !Number.isSafeInteger(session.leaseExpiresAt) ||
      session.leaseExpiresAt < 0
    )
      fail("BLOB_INTEGRITY", "Recording recovery state or lease is corrupt");
    if (session.state === "staging" && session.leaseExpiresAt > Date.now())
      fail("BLOB_STAGING_ACTIVE", "Recording session still has an active owner lease");
  }
  private recoverySessionPins(session: RecordingSessionRecord): string {
    return canonicalStringify({
      sessionId: session.sessionId,
      runId: session.runId,
      runEpoch: session.runEpoch,
      sceneRevision: session.sceneRevision,
      persistedFrames: session.persistedFrames,
      persistedTick: session.persistedTick,
      reservedBytes: session.reservedBytes,
      snapshot: session.snapshot,
      chunks: session.chunks,
    });
  }
  private async assertFinalRecoveryAuthority(
    sessionId: string,
    expectedPins: string,
  ): Promise<void> {
    this.assertOpen();
    const check = (fresh: RecordingSessionRecord | undefined) => {
      this.assertRecoverableSession(sessionId, fresh);
      if (this.recoverySessionPins(fresh) !== expectedPins)
        fail(
          "BLOB_STAGING_CHANGED",
          "Recording recovery prefix changed during verification; refresh before retrying",
        );
    };
    if (this.mode === "memory") {
      check(this.sessions.get(sessionId));
      return;
    }
    // This transaction serializes with append/heartbeat/cleanup. It changes no writer data.
    await this.stagingTransaction<void>((transaction, finish, refuse) => {
      const request = transaction.objectStore("recordingSessions").get(sessionId);
      request.onsuccess = () => {
        try {
          check(request.result as RecordingSessionRecord | undefined);
          finish();
        } catch (error) {
          refuse(error);
        }
      };
    });
  }
  async recoverRecording(sessionId: string): Promise<RecordingArtifact> {
    const session = await this.readRecordingSession(sessionId);
    this.assertRecoverableSession(sessionId, session);
    const expectedPins = this.recoverySessionPins(session);
    const recorder = new ExperimentRecorder({
      ...session.snapshot.configuration,
      runId: session.runId,
      runEpoch: session.runEpoch,
      createdAt: session.snapshot.createdAt,
      budget: session.snapshot.budget,
    });
    for (let index = 0; index < session.chunks.length; index++) {
      const descriptor = session.chunks[index]!;
      if (descriptor.sequence !== index)
        fail("BLOB_INTEGRITY", "Recording recovery chunk sequence differs");
      recorder.appendFrame(
        JSON.parse(
          decoder.decode(await this.readRecordingChunk(sessionId, descriptor)),
        ) as RecordingFrame,
      );
    }
    if (
      recorder.getTelemetry().frameCount !== session.persistedFrames ||
      recorder.getLastFrame()?.tick !== (session.persistedTick ?? undefined)
    )
      fail("BLOB_INTEGRITY", "Recording recovery counters differ");
    recorder.interrupt("RECOVERED_INCOMPLETE_RECORDING");
    const artifact = await recorder.finish();
    await this.assertFinalRecoveryAuthority(sessionId, expectedPins);
    return artifact;
  }
  private async heartbeatRecordingSession(sessionId: string): Promise<void> {
    this.assertOpen();
    if (this.mode === "memory") {
      const session = this.sessions.get(sessionId);
      if (!session || session.state !== "staging")
        fail("BLOB_STAGING", "Recording owner lease is no longer current");
      session.leaseExpiresAt = Date.now() + 30000;
      return;
    }
    await this.stagingTransaction<void>((transaction, finish, refuse) => {
      const sessions = transaction.objectStore("recordingSessions");
      const request = sessions.get(sessionId);
      request.onsuccess = () => {
        try {
          const session = request.result as RecordingSessionRecord | undefined;
          if (!session || session.state !== "staging")
            fail("BLOB_STAGING", "Recording owner lease is no longer current");
          sessions.put({ ...session, leaseExpiresAt: Date.now() + 30000 });
          finish();
        } catch (error) {
          refuse(error);
        }
      };
    });
  }
  private async interruptRecordingSession(sessionId: string, reason: string): Promise<void> {
    if (this.closed) return;
    if (this.mode === "memory") {
      const session = this.sessions.get(sessionId);
      if (session)
        this.sessions.set(sessionId, {
          ...session,
          state: "interrupted",
          reason: reason.slice(0, 256),
          leaseExpiresAt: 0,
        });
      return;
    }
    await this.stagingTransaction<void>((transaction, finish, refuse) => {
      const sessions = transaction.objectStore("recordingSessions");
      const request = sessions.get(sessionId);
      request.onsuccess = () => {
        try {
          if (request.result)
            sessions.put({
              ...(request.result as RecordingSessionRecord),
              state: "interrupted",
              reason: reason.slice(0, 256),
              leaseExpiresAt: 0,
            });
          finish();
        } catch (error) {
          refuse(error);
        }
      };
    });
  }
  async discardRecordingRecovery(sessionId: string): Promise<void> {
    return this.discardRecordingSession(sessionId, false);
  }
  private async discardRecordingSession(
    sessionId: string,
    ownedDuplicate: boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    this.assertOpen();
    if (signal?.aborted) fail("BLOB_CANCELLED", "Recording publication was cancelled");
    identity(sessionId);
    const discardable = (session: RecordingSessionRecord | undefined) => {
      if (!session) fail("BLOB_STAGING", "Only an unpublished recovery session can be discarded");
      if (!ownedDuplicate && session.state === "staging" && session.leaseExpiresAt > Date.now())
        fail("BLOB_STAGING_ACTIVE", "Recording session still has an active owner lease");
      return session;
    };
    if (this.mode === "memory") {
      const session = discardable(this.sessions.get(sessionId));
      for (const chunk of session.chunks) this.chunks.delete(`${sessionId}:${chunk.sequence}`);
      this.stagingBytes -= session.reservedBytes;
      this.sessions.delete(sessionId);
      return;
    }
    await this.stagingTransaction<void>((transaction, finish, refuse) => {
      const sessions = transaction.objectStore("recordingSessions"),
        state = transaction.objectStore("state");
      const request = sessions.get(sessionId),
        staged = state.get("recordingStagingBytes");
      let remaining = 2;
      const ready = () => {
        if (--remaining) return;
        try {
          const session = discardable(request.result as RecordingSessionRecord | undefined);
          const remainingBytes = this.validStagingBytes(staged.result) - session.reservedBytes;
          if (remainingBytes < 0)
            fail("BLOB_INTEGRITY", "Recording staging reservation is corrupt");
          for (const chunk of session.chunks)
            transaction.objectStore("recordingChunks").delete([sessionId, chunk.sequence]);
          sessions.delete(sessionId);
          state.put(remainingBytes, "recordingStagingBytes");
          finish();
        } catch (error) {
          refuse(error);
        }
      };
      request.onsuccess = ready;
      staged.onsuccess = ready;
    }, signal);
  }

  close(): void {
    for (const session of this.captureSessions) void session.cancel("BLOB_CLOSED").catch(() => {});
    this.captureSessions.clear();
    this.#workerClient?.dispose();
    this.closed = true;
    this.database?.close();
    this.database = null;
  }
}

export interface RegeneratedBuiltinAsset {
  bytesPCM: Float32Array<ArrayBuffer>;
  sha256: string;
  hashKind: "float32MonoPcmBytesSha256";
  sampleRateHz: 44100 | 48000;
  channels: 1;
  durationSeconds: number;
}
/** Exact v1 AudioAssetStore formulas. Does not decode files, register AudioBuffers, or enable audio. */
export async function regenerateBuiltinAsset(
  asset: ProjectAsset,
): Promise<RegeneratedBuiltinAsset | null> {
  const generator = asset.generator;
  const expectedSha256 = asset.sha256,
    expectedByteLength = asset.byteLength;
  if (asset.storage !== "generatedDescriptor" || !generator) return null;
  if (["tone-v1", "noise-v1", "impulse-v1"].includes(generator.algorithm)) return null;
  const definitions = {
    "builtin-tone-v1": {
      duration: 1,
      sample: (t: number) => Math.sin(2 * Math.PI * 220 * t) * 0.25,
    },
    "builtin-impact-v1": {
      duration: 0.25,
      sample: (t: number) =>
        Math.sin(2 * Math.PI * (330 - 400 * t) * t) *
        Math.exp(-25 * t) *
        Math.min(1, t / 0.002) *
        0.5,
    },
    "builtin-whoosh-v1": {
      duration: 0.5,
      sample: (t: number) =>
        Math.sin(2 * Math.PI * (120 + 1100 * t) * t) * Math.sin((Math.PI * t) / 0.5) ** 2 * 0.2,
    },
  };
  if (!Object.hasOwn(definitions, generator.algorithm))
    fail("ASSET_GENERATOR", "Unknown builtin generator algorithm");
  const definition = definitions[generator.algorithm as keyof typeof definitions];
  if (
    !definition ||
    generator.durationSeconds !== definition.duration ||
    ![44100, 48000].includes(generator.sampleRateHz) ||
    generator.frequencyHz !== undefined ||
    generator.seed !== undefined ||
    asset.hashKind !== "float32MonoPcmBytesSha256"
  )
    fail("ASSET_GENERATOR", "Unknown or changed builtin generator settings/hash provenance");
  const rate = generator.sampleRateHz,
    bytesPCM = new Float32Array(Math.round(rate * definition.duration));
  for (let i = 0; i < bytesPCM.length; i++) bytesPCM[i] = definition.sample(i / rate);
  const sha256 = await digest(bytesPCM.buffer);
  if (sha256 !== expectedSha256 || bytesPCM.byteLength !== expectedByteLength)
    fail("BLOB_HASH", "Regenerated PCM does not match project reference");
  return {
    bytesPCM,
    sha256,
    hashKind: "float32MonoPcmBytesSha256",
    sampleRateHz: rate,
    channels: 1,
    durationSeconds: definition.duration,
  };
}
