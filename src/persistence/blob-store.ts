import { canonicalStringify } from "../experiments/hash.js";
import { ExperimentRecorder, verifyRecording } from "../experiments/recorder.js";
import { RecordingWorkerClient, type WorkerPort } from "../experiments/recording-worker-client.js";
import type { RecordingArtifact } from "../experiments/types.js";
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
interface RecordingRecord extends StoredRecordingReceipt {
  kind: "recording";
  bytes: ArrayBuffer;
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
        request = this.factory!.open(this.databaseName, 1);
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
        database.createObjectStore("assets", { keyPath: ["assetId", "sha256"] });
        database.createObjectStore("recordings", { keyPath: ["runId", "sha256"] });
        database.createObjectStore("state");
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
      next.totalBytes > this.limits.maxTotalBytes ||
      next.assetEntries > this.limits.maxAssetEntries ||
      next.recordings > this.limits.maxRecordings
    )
      fail("BLOB_BUDGET", "Local immutable blob budget exhausted; existing data retained");
    return { budget: next, head: { sha256: candidate.sha256, revision }, duplicate: false };
  }
  private async commit(candidate: BlobRecord): Promise<void> {
    this.assertOpen();
    const [id, sha256] = key(candidate),
      headKey = `${candidate.kind}:${id}`;
    if (this.mode === "memory") {
      const recordKey = `${candidate.kind}:${memoryKey(id, sha256)}`;
      const plan = this.plan(
        candidate,
        this.memory.get(recordKey),
        this.heads.get(headKey),
        this.budget,
      );
      this.memory.set(recordKey, structuredClone(candidate));
      this.heads.set(headKey, plan.head);
      this.budget = plan.budget;
      return;
    }
    const database = await this.open();
    this.assertOpen();
    await new Promise<void>((resolve, reject) => {
      // All stores share this transaction: cross-tab caps and revision checks are serialized.
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(["assets", "recordings", "state"], "readwrite");
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
        previousRequest = store.get([id, sha256]);
      let remaining = 3,
        failure: unknown;
      const ready = () => {
        if (--remaining !== 0) return;
        try {
          const plan = this.plan(
            candidate,
            previousRequest.result as BlobRecord | undefined,
            headRequest.result as Head | undefined,
            budgetRequest.result === undefined ? emptyBudget() : (budgetRequest.result as Budget),
          );
          // Rewriting the exact verified ref also repairs damaged local bytes without changing identity or budget.
          if (plan.duplicate) store.put(candidate);
          else store.add(candidate);
          state.put(plan.budget, "budget");
          state.put(plan.head, headKey);
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
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          failure ??
            new ProjectError(
              "BLOB_STORAGE_WRITE",
              `IndexedDB transaction aborted: ${transaction.error?.name ?? "unknown"}; previous data retained`,
            ),
        );
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
        await this.commit(candidate);
        this.#prepared.delete(artifact);
        return this.receipt(candidate);
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
    await this.commit(candidate);
    return this.receipt(candidate);
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
  close(): void {
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
