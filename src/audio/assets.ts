import {
  AudioEngineError,
  type AudioAssetDescriptor,
  type AudioAssetMetadata,
  type AudioBudget,
  type AudioAssetBankEntry,
} from "./types.js";
import { finite } from "./control.js";
import { preflightWave } from "./wav.js";
import {
  AssetLeaseTracker,
  uniquePcmBytes,
  type AudioAssetLease,
  type AssetEvictionResult,
  type AssetResidencySnapshot,
} from "./asset-leases.js";

export interface DecodedAsset {
  buffer: AudioBuffer;
  descriptor: AudioAssetDescriptor;
}
export class AudioAssetStore {
  private readonly entries = new Map<string, DecodedAsset>();
  private readonly leases = new AssetLeaseTracker();
  private readonly recency = new Map<string, number>();
  private touchSequence = 0;
  /** Conservative per-entry admission total, including shared-buffer aliases. */
  decodedBytes = 0;
  private decoding = 0;
  private generating = 0;
  private decodingBytes = 0;
  private stagingBytes = 0;
  /** PCM hash copies share admission capacity with decoded/reserved PCM. */
  private stagingPcmBytes = 0;
  private readonly staging = new Map<ArrayBuffer, { references: number; byteLength: number }>();
  private highWaterBytes = 0;
  private generation = 0;
  constructor(
    private context: BaseAudioContext | null,
    private readonly budget: AudioBudget,
    private readonly isInUse: (assetId: string) => boolean = () => false,
    private readonly onMemoryObservation?: () => void,
  ) {}

  setContext(context: BaseAudioContext): void {
    this.context = context;
  }
  get hasPendingDecodes(): boolean {
    return this.decoding > 0;
  }
  private requireContext(): BaseAudioContext {
    if (!this.context)
      throw new AudioEngineError(
        "ASSET_CONTEXT_UNAVAILABLE",
        "A native or offline context is required for decoding/generation",
      );
    return this.context;
  }
  private touch(assetId: string): void {
    this.recency.set(assetId, ++this.touchSequence);
  }
  private bankEntry(assetId: string, decoded: DecodedAsset): AudioAssetBankEntry {
    const { revision, sha256, name, origin, license } = decoded.descriptor;
    return {
      assetId,
      buffer: decoded.buffer,
      metadata: { name, origin, license, revision, ...(sha256 === null ? {} : { sha256 }) },
    };
  }
  private retainStaging(buffer: ArrayBuffer): void {
    const current = this.staging.get(buffer);
    if (current) current.references++;
    else {
      this.staging.set(buffer, { references: 1, byteLength: buffer.byteLength });
      this.stagingBytes += buffer.byteLength;
    }
    this.observe();
  }
  private releaseStaging(buffer: ArrayBuffer): void {
    const current = this.staging.get(buffer);
    if (!current) return;
    if (--current.references === 0) {
      this.staging.delete(buffer);
      this.stagingBytes -= current.byteLength;
    }
  }
  private retainedBuffers(): AudioBuffer[] {
    return [
      ...[...this.entries.values()].map((entry) => entry.buffer),
      ...this.leases.entries().map((entry) => entry.buffer),
    ];
  }
  /** Existing conservative bank admission plus physically distinct orphaned lease PCM. */
  private capacityBytes(bank: Iterable<DecodedAsset>, reservationCredit = 0): number {
    const candidate = [...bank],
      buffers = new Set(candidate.map((entry) => entry.buffer));
    return (
      candidate.reduce((sum, entry) => sum + entry.descriptor.decodedBytes, 0) +
      uniquePcmBytes(
        this.leases
          .entries()
          .filter((entry) => !buffers.has(entry.buffer))
          .map((entry) => entry.buffer),
      ) +
      this.decodingBytes +
      this.stagingPcmBytes -
      reservationCredit
    );
  }
  private observe(reservationCredit = 0): void {
    const observed =
      uniquePcmBytes(this.retainedBuffers()) +
      this.decodingBytes -
      reservationCredit +
      this.stagingBytes;
    if (observed > this.highWaterBytes) {
      this.highWaterBytes = observed;
      this.onMemoryObservation?.();
    }
  }
  getResidency(): AssetResidencySnapshot {
    this.observe();
    return {
      residentBytes: uniquePcmBytes([...this.entries.values()].map((entry) => entry.buffer)),
      leasedBytes: uniquePcmBytes(this.leases.entries().map((entry) => entry.buffer)),
      retainedBytes: uniquePcmBytes(this.retainedBuffers()),
      decodeReservedBytes: this.decodingBytes,
      leaseCount: this.leases.count,
      residentAssets: this.entries.size,
      highWaterBytes: this.highWaterBytes,
      knownStagingBytes: this.stagingBytes,
      nativeDecoderScratchBytes: null,
    };
  }
  acquire(assetIds: readonly string[], reason: string): AudioAssetLease {
    const ids = [...new Set(assetIds)],
      bank: AudioAssetBankEntry[] = [];
    for (const assetId of ids) {
      const decoded = this.entries.get(assetId);
      if (!decoded)
        throw new AudioEngineError("ASSET_MISSING", `Decoded asset is not resident: ${assetId}`);
      bank.push(this.bankEntry(assetId, decoded));
    }
    const lease = this.leases.acquire(bank, reason);
    for (const assetId of ids) this.touch(assetId);
    this.observe();
    return lease;
  }
  evictUnused(
    options: {
      targetBytes?: number;
      assetIds?: readonly string[];
    } = {},
  ): AssetEvictionResult {
    const target = options.targetBytes ?? 0;
    if (!Number.isSafeInteger(target) || target < 0)
      throw new AudioEngineError(
        "INVALID_ASSET_EVICTION_TARGET",
        "Resident byte target must be a nonnegative integer",
      );
    const scope = options.assetIds === undefined ? null : new Set(options.assetIds),
      before = uniquePcmBytes(this.retainedBuffers()),
      evictedAssetIds: string[] = [],
      protectedAssetIds: string[] = [];
    const candidates = [...this.entries.keys()]
      .filter((id) => scope === null || scope.has(id))
      .sort((a, b) => (this.recency.get(a) ?? 0) - (this.recency.get(b) ?? 0));
    for (const assetId of candidates) {
      const decoded = this.entries.get(assetId)!;
      if (this.isInUse(assetId) || this.leases.has(assetId, decoded.buffer)) {
        protectedAssetIds.push(assetId);
        continue;
      }
      if (uniquePcmBytes([...this.entries.values()].map((entry) => entry.buffer)) <= target) break;
      this.entries.delete(assetId);
      this.recency.delete(assetId);
      this.decodedBytes -= decoded.descriptor.decodedBytes;
      evictedAssetIds.push(assetId);
    }
    return {
      evictedAssetIds,
      releasedBytes: before - uniquePcmBytes(this.retainedBuffers()),
      residentBytes: uniquePcmBytes([...this.entries.values()].map((entry) => entry.buffer)),
      protectedAssetIds,
    };
  }
  private requireIdleBankMutation(): void {
    if (this.decoding > 0)
      throw new AudioEngineError(
        "DECODE_IN_PROGRESS",
        "Wait for in-flight decoding before replacing the asset bank",
      );
    if (this.generating > 0)
      throw new AudioEngineError(
        "GENERATION_IN_PROGRESS",
        "Wait for built-in generation before replacing the asset bank",
      );
  }
  private publish(candidate: AudioAssetStore): AudioAssetDescriptor[] {
    if (this.capacityBytes(candidate.entries.values()) > this.budget.maxDecodedBytes)
      throw new AudioEngineError(
        "DECODED_MEMORY_BUDGET",
        "Candidate bank plus borrowed previous PCM exceeds the budget",
      );
    const oldIds = new Set(this.entries.keys());
    this.entries.clear();
    for (const [id, decoded] of candidate.entries) {
      this.entries.set(id, decoded);
      if (!oldIds.has(id)) this.touch(id);
    }
    for (const id of oldIds) if (!this.entries.has(id)) this.recency.delete(id);
    this.decodedBytes = candidate.decodedBytes;
    this.generation++;
    this.observe();
    return this.list();
  }
  private validateBank(entries: readonly AudioAssetBankEntry[]): AudioAssetStore {
    if (entries.length > this.budget.maxAssets)
      throw new AudioEngineError("ASSET_COUNT_BUDGET", "Too many candidate assets");
    const ids = new Set<string>(),
      candidate = new AudioAssetStore(this.context, this.budget);
    for (const entry of entries) {
      if (ids.has(entry.assetId)) throw new AudioEngineError("DUPLICATE_ASSET_ID", entry.assetId);
      ids.add(entry.assetId);
      candidate.register(entry.assetId, entry.buffer, entry.metadata);
    }
    return candidate;
  }
  /** Validate a complete candidate bank before publishing any of it. */
  replace(entries: readonly AudioAssetBankEntry[]): AudioAssetDescriptor[] {
    this.requireIdleBankMutation();
    if ([...this.entries.keys()].some((id) => this.isInUse(id)))
      throw new AudioEngineError("ASSET_IN_USE", "Drain voices before replacing the asset bank");
    return this.publish(this.validateBank(entries));
  }
  /** Atomically merge rehydrated entries without replacing unaffected live assets. */
  restore(entries: readonly AudioAssetBankEntry[]): AudioAssetDescriptor[] {
    this.requireIdleBankMutation();
    const additions = this.validateBank(entries),
      merged = new Map<string, AudioAssetBankEntry>();
    for (const [id, decoded] of this.entries) merged.set(id, this.bankEntry(id, decoded));
    for (const [id, decoded] of additions.entries) {
      const current = this.entries.get(id);
      if (current && current.buffer !== decoded.buffer && this.isInUse(id))
        throw new AudioEngineError("ASSET_IN_USE", "Drain voices before replacing decoded asset");
      merged.set(id, this.bankEntry(id, decoded));
    }
    return this.publish(this.validateBank([...merged.values()]));
  }

  register(
    assetId: string,
    buffer: AudioBuffer,
    metadata: AudioAssetMetadata,
  ): AudioAssetDescriptor {
    return this.commit(assetId, buffer, metadata, 0);
  }
  private commit(
    assetId: string,
    buffer: AudioBuffer,
    metadata: AudioAssetMetadata,
    reservationCredit: number,
  ): AudioAssetDescriptor {
    if (!/^[a-z][a-z0-9._-]{0,63}$/.test(assetId))
      throw new AudioEngineError("INVALID_ASSET_ID", assetId);
    if (
      typeof metadata.name !== "string" ||
      typeof metadata.license !== "string" ||
      !metadata.name.trim() ||
      !metadata.license.trim() ||
      !["generated", "imported"].includes(metadata.origin)
    )
      throw new AudioEngineError("ASSET_PROVENANCE_REQUIRED", assetId);
    if (metadata.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(metadata.sha256))
      throw new AudioEngineError("INVALID_ASSET_HASH", assetId);
    finite(buffer.duration, "asset duration", 1 / 192000, this.budget.maxAssetDurationSeconds);
    finite(buffer.sampleRate, "asset sample rate", 8000, 192000);
    finite(buffer.numberOfChannels, "asset channels", 1, this.budget.maxAssetChannels);
    if (
      !Number.isSafeInteger(buffer.numberOfChannels) ||
      !Number.isSafeInteger(buffer.length) ||
      buffer.length < 1
    )
      throw new AudioEngineError(
        "INVALID_AUDIO_BUFFER",
        "AudioBuffer must contain bounded complete frames/channels",
      );
    const decodedBytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT,
      existing = this.entries.get(assetId);
    if (!existing && this.entries.size >= this.budget.maxAssets)
      throw new AudioEngineError("ASSET_COUNT_BUDGET", assetId);
    const revision = finite(metadata.revision ?? 1, "asset revision", 1, 1e9);
    if (!Number.isSafeInteger(revision))
      throw new AudioEngineError("INVALID_ASSET_REVISION", assetId);
    if (existing && existing.buffer !== buffer && this.isInUse(assetId))
      throw new AudioEngineError("ASSET_IN_USE", "Drain voices before replacing decoded asset");
    const descriptor: AudioAssetDescriptor = {
        ...metadata,
        assetId,
        revision,
        durationSeconds: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        decodedBytes,
        sha256: metadata.sha256 ?? null,
      },
      candidate = new Map(this.entries);
    candidate.set(assetId, { buffer, descriptor });
    if (this.capacityBytes(candidate.values(), reservationCredit) > this.budget.maxDecodedBytes)
      throw new AudioEngineError("DECODED_MEMORY_BUDGET", assetId);
    this.entries.set(assetId, { buffer, descriptor });
    this.decodedBytes += decodedBytes - (existing?.descriptor.decodedBytes ?? 0);
    this.touch(assetId);
    this.observe(reservationCredit);
    return { ...descriptor };
  }

  async import(
    assetId: string,
    bytes: ArrayBuffer,
    metadata: AudioAssetMetadata,
  ): Promise<AudioAssetDescriptor> {
    const context = this.requireContext();
    if (bytes.byteLength === 0 || bytes.byteLength > 16 * 1024 * 1024)
      throw new AudioEngineError("ENCODED_ASSET_BUDGET", "Imported bytes must be 1..16MiB");
    const wave = preflightWave(bytes, this.budget, context.sampleRate);
    if (this.entries.has(assetId) && this.isInUse(assetId))
      throw new AudioEngineError("ASSET_IN_USE", "Drain voices before replacing decoded asset");
    if (this.capacityBytes(this.entries.values()) + wave.decodedBytes > this.budget.maxDecodedBytes)
      throw new AudioEngineError(
        "DECODED_MEMORY_BUDGET",
        "Decoded assets plus in-flight WAVE reservations exceed the PCM budget",
      );
    if (this.decoding + this.generating >= this.budget.maxConcurrentDecodes)
      throw new AudioEngineError("DECODE_CONCURRENCY_BUDGET", assetId);
    const generation = this.generation;
    this.decoding++;
    this.decodingBytes += wave.decodedBytes;
    this.retainStaging(bytes);
    try {
      const sha256 = await digest(bytes);
      if (generation !== this.generation)
        throw new AudioEngineError("DECODE_CANCELLED", "Asset store was cleared during import");
      // The owned input copy remains accounted until native decode actually settles.
      let nativeInput: ArrayBuffer | null = bytes.slice(0);
      this.retainStaging(nativeInput);
      let decoded: AudioBuffer;
      try {
        decoded = await context.decodeAudioData(nativeInput);
      } finally {
        this.releaseStaging(nativeInput);
        nativeInput = null;
      }
      if (generation !== this.generation)
        throw new AudioEngineError("DECODE_CANCELLED", "Asset store was cleared during import");
      if (
        decoded.numberOfChannels !== wave.channels ||
        !Number.isSafeInteger(decoded.length) ||
        decoded.length < 1 ||
        decoded.sampleRate !== context.sampleRate ||
        decoded.length * decoded.numberOfChannels * 4 > wave.decodedBytes ||
        Math.abs(decoded.duration - wave.durationSeconds) >
          1 / wave.sampleRate + 1 / context.sampleRate
      )
        throw new AudioEngineError(
          "WAV_DECODE_MISMATCH",
          "Native decoder output does not match bounded WAVE metadata",
        );
      return this.commit(
        assetId,
        decoded,
        { ...metadata, origin: "imported", sha256 },
        wave.decodedBytes,
      );
    } finally {
      this.decoding--;
      this.decodingBytes -= wave.decodedBytes;
      this.releaseStaging(bytes);
    }
  }

  get(assetId: string): DecodedAsset | undefined {
    const decoded = this.entries.get(assetId);
    if (decoded) this.touch(assetId);
    return decoded ? { buffer: decoded.buffer, descriptor: { ...decoded.descriptor } } : undefined;
  }
  list(): AudioAssetDescriptor[] {
    return [...this.entries.values()].map((a) => ({ ...a.descriptor }));
  }
  clear(): void {
    this.generation++;
    this.entries.clear();
    this.recency.clear();
    this.decodedBytes = 0;
    // Leases and in-flight native work own their references until their own release/settle.
  }

  async registerBuiltins(): Promise<AudioAssetDescriptor[]> {
    const context = this.requireContext();
    if (this.generating + this.decoding >= this.budget.maxConcurrentDecodes)
      throw new AudioEngineError(
        "ASSET_GENERATION_BUDGET",
        "Too many in-flight built-in generation jobs",
      );
    this.generating++;
    try {
      return await this.generateBuiltins(context, this.generation);
    } finally {
      this.generating--;
    }
  }
  private async generateBuiltins(
    context: BaseAudioContext,
    generation: number,
  ): Promise<AudioAssetDescriptor[]> {
    const rate = context.sampleRate;
    const definitions = [
      {
        id: "builtin-tone",
        duration: 1,
        sample: (t: number) => Math.sin(2 * Math.PI * 220 * t) * 0.25,
      },
      {
        id: "builtin-impact",
        duration: 0.25,
        sample: (t: number) =>
          Math.sin(2 * Math.PI * (330 - 400 * t) * t) *
          Math.exp(-25 * t) *
          Math.min(1, t / 0.002) *
          0.5,
      },
      {
        id: "builtin-whoosh",
        duration: 0.5,
        sample: (t: number) =>
          Math.sin(2 * Math.PI * (120 + 1100 * t) * t) * Math.sin((Math.PI * t) / 0.5) ** 2 * 0.2,
      },
    ];
    const results: AudioAssetDescriptor[] = [];
    for (const definition of definitions) {
      const old = this.entries.get(definition.id);
      if (old) {
        results.push({ ...old.descriptor });
        continue;
      }
      const length = Math.round(rate * definition.duration),
        reservation = length * 4;
      if (this.entries.size >= this.budget.maxAssets)
        throw new AudioEngineError("ASSET_COUNT_BUDGET", definition.id);
      if (this.capacityBytes(this.entries.values()) + reservation * 2 > this.budget.maxDecodedBytes)
        throw new AudioEngineError(
          "DECODED_MEMORY_BUDGET",
          "Built-in PCM and hash copy plus other in-flight reservations exceed the budget",
        );
      this.decodingBytes += reservation;
      this.observe();
      try {
        const buffer = context.createBuffer(1, length, rate),
          samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = definition.sample(i / rate);
        let hashInput: ArrayBuffer | null = new Float32Array(samples).buffer;
        this.stagingPcmBytes += reservation;
        this.retainStaging(hashInput);
        let sha256: string;
        try {
          sha256 = await digest(hashInput);
        } finally {
          this.releaseStaging(hashInput);
          this.stagingPcmBytes -= reservation;
          hashInput = null;
        }
        if (generation !== this.generation)
          throw new AudioEngineError(
            "GENERATION_CANCELLED",
            "Asset store changed during built-in generation",
          );
        results.push(
          this.commit(
            definition.id,
            buffer,
            {
              name: definition.id,
              origin: "generated",
              license: "ORIGINAL_PROCEDURAL; project license undecided",
              sha256,
            },
            reservation,
          ),
        );
      } finally {
        this.decodingBytes -= reservation;
      }
    }
    return results;
  }
}

async function digest(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new AudioEngineError(
      "HASH_UNAVAILABLE",
      "WebCrypto SHA-256 required for asset provenance",
    );
  return [...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
