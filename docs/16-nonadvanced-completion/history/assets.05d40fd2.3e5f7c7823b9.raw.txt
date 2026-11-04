import {
  AudioEngineError,
  type AudioAssetDescriptor,
  type AudioAssetMetadata,
  type AudioBudget,
  type AudioAssetBankEntry,
} from "./types.js";
import { finite } from "./control.js";
import { preflightWave } from "./wav.js";

export interface DecodedAsset {
  buffer: AudioBuffer;
  descriptor: AudioAssetDescriptor;
}
export class AudioAssetStore {
  private readonly entries = new Map<string, DecodedAsset>();
  decodedBytes = 0;
  private decoding = 0;
  private generating = 0;
  private decodingBytes = 0;
  private generation = 0;
  constructor(
    private context: BaseAudioContext | null,
    private readonly budget: AudioBudget,
    private readonly isInUse: (assetId: string) => boolean = () => false,
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
  /** Validate a complete candidate bank before publishing any of it. */
  replace(entries: readonly AudioAssetBankEntry[]): AudioAssetDescriptor[] {
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
    if (entries.length > this.budget.maxAssets)
      throw new AudioEngineError("ASSET_COUNT_BUDGET", "Too many candidate assets");
    if ([...this.entries.keys()].some((id) => this.isInUse(id)))
      throw new AudioEngineError("ASSET_IN_USE", "Drain voices before replacing the asset bank");
    const ids = new Set<string>(),
      candidate = new AudioAssetStore(this.context, this.budget);
    for (const entry of entries) {
      if (ids.has(entry.assetId)) throw new AudioEngineError("DUPLICATE_ASSET_ID", entry.assetId);
      ids.add(entry.assetId);
      candidate.register(entry.assetId, entry.buffer, entry.metadata);
    }
    this.entries.clear();
    for (const [id, decoded] of candidate.entries) this.entries.set(id, decoded);
    this.decodedBytes = candidate.decodedBytes;
    this.generation++;
    return this.list();
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
    const decodedBytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    const existing = this.entries.get(assetId);
    if (!existing && this.entries.size >= this.budget.maxAssets)
      throw new AudioEngineError("ASSET_COUNT_BUDGET", assetId);
    const revision = finite(metadata.revision ?? 1, "asset revision", 1, 1e9);
    if (!Number.isSafeInteger(revision))
      throw new AudioEngineError("INVALID_ASSET_REVISION", assetId);
    if (existing && existing.buffer !== buffer && this.isInUse(assetId))
      throw new AudioEngineError("ASSET_IN_USE", "Drain voices before replacing decoded asset");
    const oldBytes = existing?.descriptor.decodedBytes ?? 0;
    if (
      this.decodedBytes - oldBytes + decodedBytes + this.decodingBytes - reservationCredit >
      this.budget.maxDecodedBytes
    )
      throw new AudioEngineError("DECODED_MEMORY_BUDGET", assetId);
    const descriptor: AudioAssetDescriptor = {
      ...metadata,
      assetId,
      revision,
      durationSeconds: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      decodedBytes,
      sha256: metadata.sha256 ?? null,
    };
    this.entries.set(assetId, { buffer, descriptor });
    this.decodedBytes += decodedBytes - oldBytes;
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
    if (this.decodedBytes + this.decodingBytes + wave.decodedBytes > this.budget.maxDecodedBytes)
      throw new AudioEngineError(
        "DECODED_MEMORY_BUDGET",
        "Decoded assets plus in-flight WAVE reservations exceed the PCM budget",
      );
    if (this.decoding >= this.budget.maxConcurrentDecodes)
      throw new AudioEngineError("DECODE_CONCURRENCY_BUDGET", assetId);
    const generation = this.generation;
    this.decoding++;
    this.decodingBytes += wave.decodedBytes;
    try {
      const sha256 = await digest(bytes);
      if (generation !== this.generation)
        throw new AudioEngineError("DECODE_CANCELLED", "Asset store was cleared during import");
      const decoded = await context.decodeAudioData(bytes.slice(0));
      if (generation !== this.generation)
        throw new AudioEngineError("DECODE_CANCELLED", "Asset store was cleared during import");
      if (
        decoded.numberOfChannels !== wave.channels ||
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
    }
  }

  get(assetId: string): DecodedAsset | undefined {
    return this.entries.get(assetId);
  }
  list(): AudioAssetDescriptor[] {
    return [...this.entries.values()].map((a) => ({ ...a.descriptor }));
  }
  clear(): void {
    this.generation++;
    this.entries.clear();
    this.decodedBytes = 0;
  }

  async registerBuiltins(): Promise<AudioAssetDescriptor[]> {
    const context = this.requireContext();
    if (this.generating >= this.budget.maxConcurrentDecodes)
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
      if (this.decodedBytes + this.decodingBytes + reservation > this.budget.maxDecodedBytes)
        throw new AudioEngineError(
          "DECODED_MEMORY_BUDGET",
          "Built-in PCM plus other in-flight reservations exceed the budget",
        );
      this.decodingBytes += reservation;
      try {
        const buffer = context.createBuffer(1, length, rate),
          samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = definition.sample(i / rate);
        const sha256 = await digest(new Float32Array(samples).buffer);
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
