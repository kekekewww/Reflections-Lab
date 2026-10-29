import type { BehaviorAsset } from "../audio-behavior/types.js";
import { AudioAssetStore } from "../audio/assets.js";
import { AudioEngine } from "../audio/engine.js";
import { makeBudget } from "../audio/control.js";
import type { AudioAssetBankEntry, AudioAssetDescriptor, AudioBudget } from "../audio/types.js";
import { preflightWave } from "../audio/wav.js";
import { sha256Canonical } from "../experiments/hash.js";
import { BlobStore, regenerateBuiltinAsset } from "../persistence/blob-store.js";
import { ProjectError, type ProjectAsset, type ProjectDocument } from "../persistence/types.js";
import { validateProject } from "../persistence/validate-project.js";

export type AssetStagingContext = Pick<
  BaseAudioContext,
  "sampleRate" | "createBuffer" | "decodeAudioData"
>;
export interface PreparedAssetBank {
  readonly assets: readonly BehaviorAsset[];
  readonly projectAssets: readonly ProjectAsset[];
  readonly requiredAssetIds: readonly string[];
  /** Retained PCM only; native decoder scratch allocation is browser controlled. */
  readonly stagedDecodedBytes: number;
}
interface InternalBank {
  token: PreparedAssetBank;
  entries: AudioAssetBankEntry[];
  projectAssets: ProjectAsset[];
  approved: Set<string>;
  generation: number;
  engine: AudioEngine | null;
}
interface Stage {
  budget: AudioBudget;
  rate: number;
  contexts: Map<number, AssetStagingContext>;
  currentBuffers: Set<AudioBuffer>;
  currentBytes: number;
  buffers: Set<AudioBuffer>;
  newBytes: number;
  reusable: Map<string, AudioBuffer>;
}
const USER_CONFIRMED = "USER_CONFIRMED_LOCAL_USE";
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
const BUILTIN_IDS = ["builtin-tone", "builtin-impact", "builtin-whoosh"] as const;
const isBuiltin = (asset: ProjectAsset): boolean =>
  asset.storage === "generatedDescriptor" &&
  Boolean(asset.generator?.algorithm.startsWith("builtin-"));
const pcmBytes = (buffer: AudioBuffer): number => buffer.length * buffer.numberOfChannels * 4;
const contentKey = (asset: ProjectAsset): string =>
  `${asset.hashKind ?? (asset.storage === "externalFile" ? "encodedBytesSha256" : "canonicalDescriptorSha256")}:${asset.sha256}`;
function fail(code: string, message: string): never {
  throw new ProjectError(code, message);
}
const clone = <T>(value: T): T => structuredClone(value);
async function digest(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) fail("HASH_UNAVAILABLE", "WebCrypto SHA-256 is required");
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
function descriptor(entry: AudioAssetBankEntry): AudioAssetDescriptor {
  return {
    ...entry.metadata,
    assetId: entry.assetId,
    revision: entry.metadata.revision ?? 1,
    sha256: entry.metadata.sha256 ?? null,
    durationSeconds: entry.buffer.duration,
    sampleRate: entry.buffer.sampleRate,
    channels: entry.buffer.numberOfChannels,
    decodedBytes: pcmBytes(entry.buffer),
  };
}

/** Owns decoded asset banks. Offline staging never creates/resumes a live AudioContext. */
export class AssetHost {
  private readonly store: BlobStore;
  private readonly getEngine: () => AudioEngine | null;
  private readonly createContext: (sampleRate: number) => AssetStagingContext;
  private readonly fallbackBudget: AudioBudget;
  private projectAssets: ProjectAsset[];
  private entries: AudioAssetBankEntry[] = [];
  private approved = new Set<string>();
  private prepared: InternalBank | null = null;
  private generation = 0;
  private busy = false;

  constructor(options: {
    store?: BlobStore;
    getEngine: () => AudioEngine | null;
    initialProjectAssets?: readonly ProjectAsset[];
    budget?: Partial<AudioBudget>;
    /** Test adapter; production defaults to native OfflineAudioContext. */
    createStagingContext?: (sampleRate: number) => AssetStagingContext;
  }) {
    this.store = options.store ?? new BlobStore();
    this.getEngine = options.getEngine;
    this.fallbackBudget = makeBudget(options.budget);
    this.projectAssets = clone([...(options.initialProjectAssets ?? [])]);
    this.createContext =
      options.createStagingContext ??
      ((sampleRate) => {
        if (typeof OfflineAudioContext !== "function")
          fail(
            "OFFLINE_AUDIO_UNAVAILABLE",
            "OfflineAudioContext is required to verify decoded assets",
          );
        return new OfflineAudioContext(1, 1, sampleRate);
      });
  }
  getProjectAssets(): ProjectAsset[] {
    return clone(this.projectAssets);
  }
  getAssets(): BehaviorAsset[] {
    return this.registry(this.projectAssets, this.entries, this.approved);
  }
  private registry(
    assets: readonly ProjectAsset[],
    entries: readonly AudioAssetBankEntry[],
    approved: ReadonlySet<string>,
  ): BehaviorAsset[] {
    return assets.map((asset) => {
      const entry = entries.find(
        (value) =>
          value.assetId === asset.assetId &&
          value.metadata.revision === asset.revision &&
          value.metadata.sha256 === asset.sha256,
      );
      return {
        assetId: asset.assetId,
        revision: asset.revision,
        sha256: asset.sha256,
        availability: entry ? "READY" : "MISSING",
        rightsStatus: entry && approved.has(asset.sha256) ? "APPROVED" : "UNVERIFIED",
        ...(entry ? { durationSeconds: entry.buffer.duration } : {}),
      };
    });
  }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) fail("ASSET_HOST_BUSY", "An asset transaction is already in progress");
    this.busy = true;
    try {
      return await operation();
    } finally {
      this.busy = false;
    }
  }
  private invalidate(): void {
    if (this.prepared) this.prepared.entries = [];
    this.prepared = null;
  }
  discardPrepared(bank: PreparedAssetBank): void {
    if (this.prepared?.token === bank) this.invalidate();
  }
  private stage(engine = this.getEngine()): Stage {
    const budget = makeBudget(engine?.getAssetBudget() ?? this.fallbackBudget),
      currentBuffers = new Set(this.entries.map((entry) => entry.buffer));
    for (const item of engine?.getAssets() ?? []) {
      const buffer = engine!.getAssetBuffer(item.assetId);
      if (buffer) currentBuffers.add(buffer);
    }
    const reusable = new Map<string, AudioBuffer>();
    for (const asset of this.projectAssets) {
      const local = this.entries.find(
        (entry) =>
          entry.assetId === asset.assetId &&
          entry.metadata.sha256 === asset.sha256 &&
          entry.metadata.revision === asset.revision,
      );
      if (local) reusable.set(contentKey(asset), local.buffer);
    }
    return {
      budget,
      rate: engine?.getAssetSampleRate() ?? 48000,
      contexts: new Map(),
      currentBuffers,
      currentBytes: [...currentBuffers].reduce((total, buffer) => total + pcmBytes(buffer), 0),
      buffers: new Set(),
      newBytes: 0,
      reusable,
    };
  }
  private capacity(stage: Stage, reservation = 0): void {
    if (stage.currentBytes + stage.newBytes + reservation > stage.budget.maxDecodedBytes)
      fail(
        "DECODED_MEMORY_BUDGET",
        "Current decoded assets plus staged PCM exceed the budget; existing bank retained",
      );
  }
  private context(stage: Stage, rate = stage.rate): AssetStagingContext {
    let context = stage.contexts.get(rate);
    if (!context) {
      context = this.createContext(rate);
      if (context.sampleRate !== rate)
        fail("ASSET_STAGING_RATE", "Offline staging context did not preserve the requested rate");
      stage.contexts.set(rate, context);
    }
    return context;
  }
  private retain(stage: Stage, buffer: AudioBuffer, key: string): AudioBuffer {
    if (!stage.currentBuffers.has(buffer) && !stage.buffers.has(buffer)) {
      this.capacity(stage, pcmBytes(buffer));
      stage.newBytes += pcmBytes(buffer);
      stage.buffers.add(buffer);
    }
    stage.reusable.set(key, buffer);
    return buffer;
  }
  private async decode(bytes: ArrayBuffer, stage: Stage): Promise<AudioBuffer> {
    const wave = preflightWave(bytes, stage.budget, stage.rate);
    this.capacity(stage, wave.decodedBytes);
    const decoded = await this.context(stage).decodeAudioData(bytes.slice(0));
    if (
      decoded.numberOfChannels !== wave.channels ||
      !Number.isSafeInteger(decoded.length) ||
      decoded.length < 1 ||
      decoded.sampleRate !== stage.rate ||
      pcmBytes(decoded) > wave.decodedBytes ||
      Math.abs(decoded.duration - wave.durationSeconds) > 1 / wave.sampleRate + 1 / stage.rate
    )
      fail("WAV_DECODE_MISMATCH", "Native WAVE decoding did not match the bounded preflight");
    return decoded;
  }
  private entry(asset: ProjectAsset, buffer: AudioBuffer): AudioAssetBankEntry {
    return {
      assetId: asset.assetId,
      buffer,
      metadata: {
        name: asset.name,
        origin: asset.storage === "externalFile" ? "imported" : "generated",
        license: asset.rights.license,
        revision: asset.revision,
        sha256: asset.sha256,
      },
    };
  }
  private checkBank(entries: readonly AudioAssetBankEntry[], budget: AudioBudget): void {
    if (entries.length > budget.maxAssets)
      fail("ASSET_COUNT_BUDGET", "Decoded asset count exceeds the bank budget");
    // Match the engine's conservative per-entry accounting even when references share one buffer.
    if (
      entries.reduce((total, entry) => total + pcmBytes(entry.buffer), 0) > budget.maxDecodedBytes
    )
      fail("DECODED_MEMORY_BUDGET", "Decoded bank exceeds the PCM budget");
  }
  private async confirmation(
    sha256: string,
  ): Promise<{ assetId: string; sha256: string; bytes: ArrayBuffer }> {
    // A separate immutable local receipt preserves source/license provenance when the
    // user later confirms an already-stored WAV. It is never exposed as an audio asset.
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        schemaVersion: "1.0.0",
        kind: "local-use-confirmation",
        assetSha256: sha256,
        confirmed: true,
      }),
    ).buffer;
    return { assetId: `rights.${sha256}`, sha256: await digest(bytes), bytes };
  }
  private async isConfirmed(sha256: string): Promise<boolean> {
    if (this.approved.has(sha256)) return true;
    const reference = await this.confirmation(sha256),
      stored = await this.store.loadAsset(reference.assetId, reference.sha256);
    return Boolean(
      stored &&
        stored.metadata.origin === "generated" &&
        stored.metadata.license === USER_CONFIRMED &&
        stored.metadata.revision === 1,
    );
  }
  private required(project: ProjectDocument): Set<string> {
    const ids = new Set(project.soundBehaviors.assets.map((pin) => pin.assetId));
    for (const profile of project.soundBehaviors.profiles) {
      for (const rule of profile.rules)
        if (rule.generator.kind === "sample") ids.add(rule.generator.asset.assetId);
      for (const pair of profile.materialPairOverrides)
        if (pair.generator.kind === "sample") ids.add(pair.generator.asset.assetId);
    }
    for (const source of project.scene.sources) {
      const asset = project.assets.find((value) => value.assetId === source.signalId)!;
      if (asset.storage !== "generatedDescriptor" || isBuiltin(asset)) ids.add(source.signalId);
    }
    return ids;
  }

  prepareProject(project: ProjectDocument): Promise<PreparedAssetBank> {
    return this.exclusive(async () => {
      this.invalidate();
      const candidate = validateProject(project),
        engine = this.getEngine(),
        stage = this.stage(engine);
      const entries: AudioAssetBankEntry[] = [],
        approved = new Set<string>(),
        required = this.required(candidate);
      for (const asset of candidate.assets) {
        if (asset.storage === "generatedDescriptor" && !isBuiltin(asset)) {
          if (!asset.generator || (await sha256Canonical(asset.generator)) !== asset.sha256)
            fail("ASSET_DESCRIPTOR_HASH", `Generator descriptor hash differs: ${asset.assetId}`);
          if (required.has(asset.assetId))
            fail("ASSET_DESCRIPTOR_ONLY", `Descriptor is not decoded sample PCM: ${asset.assetId}`);
          continue;
        }
        let buffer = stage.reusable.get(contentKey(asset));
        if (!buffer && engine) {
          const existing = engine
            .getAssets()
            .find(
              (item) =>
                item.assetId === asset.assetId &&
                item.sha256 === asset.sha256 &&
                item.revision === asset.revision,
            );
          if (existing) buffer = engine.getAssetBuffer(asset.assetId) ?? undefined;
        }
        if (isBuiltin(asset)) {
          if (!buffer) {
            // The exact Float32 waveform and its AudioBuffer coexist briefly during copying.
            this.capacity(stage, asset.byteLength * 2);
            const regenerated = await regenerateBuiltinAsset(asset);
            if (!regenerated)
              fail("ASSET_GENERATOR", `Builtin cannot be regenerated: ${asset.assetId}`);
            buffer = this.context(stage).createBuffer(
              1,
              regenerated.bytesPCM.length,
              regenerated.sampleRateHz,
            );
            buffer.copyToChannel(regenerated.bytesPCM, 0);
          } else {
            // A raw engine descriptor is insufficient evidence for a builtin PCM claim.
            const data = buffer.numberOfChannels === 1 ? buffer.getChannelData(0) : null;
            if (
              !data ||
              buffer.sampleRate !== asset.generator!.sampleRateHz ||
              pcmBytes(buffer) !== asset.byteLength ||
              (await digest(new Float32Array(data).buffer)) !== asset.sha256
            )
              fail(
                "ASSET_PCM_HASH",
                `Existing builtin buffer does not match pinned PCM: ${asset.assetId}`,
              );
            await regenerateBuiltinAsset(asset);
          }
          approved.add(asset.sha256);
        } else {
          const stored = await this.store.loadAsset(asset.assetId, asset.sha256);
          if (!stored) {
            if (required.has(asset.assetId))
              fail(
                "ASSET_REQUIRED_MISSING",
                `Import the original WAV, then apply this project again: ${asset.assetId}`,
              );
            continue;
          }
          if (
            stored.metadata.revision !== asset.revision ||
            stored.bytes.byteLength !== asset.byteLength
          )
            fail(
              "ASSET_REFERENCE_MISMATCH",
              `Stored asset revision/length differs: ${asset.assetId}`,
            );
          if (
            (stored.metadata.origin === "imported" && stored.metadata.license === USER_CONFIRMED) ||
            (await this.isConfirmed(asset.sha256))
          )
            approved.add(asset.sha256);
          if (required.has(asset.assetId) && !approved.has(asset.sha256))
            fail(
              "ASSET_RIGHTS_UNVERIFIED",
              `Confirm local use rights by importing the original WAV: ${asset.assetId}`,
            );
          if (!buffer) buffer = await this.decode(stored.bytes, stage);
        }
        entries.push(this.entry(asset, this.retain(stage, buffer, contentKey(asset))));
        this.checkBank(entries, stage.budget);
      }
      const assets = this.registry(candidate.assets, entries, approved);
      for (const assetId of required) {
        const asset = assets.find((value) => value.assetId === assetId);
        if (asset?.availability !== "READY")
          fail("ASSET_REQUIRED_MISSING", `Required decoded asset is missing: ${assetId}`);
        if (asset.rightsStatus !== "APPROVED")
          fail(
            "ASSET_RIGHTS_UNVERIFIED",
            `Required asset local rights are unconfirmed: ${assetId}`,
          );
      }
      const token: PreparedAssetBank = Object.freeze({
        assets: Object.freeze(clone(assets)),
        projectAssets: Object.freeze(clone(candidate.assets)),
        requiredAssetIds: Object.freeze([...required]),
        stagedDecodedBytes: stage.newBytes,
      });
      this.prepared = {
        token,
        entries,
        projectAssets: candidate.assets,
        approved,
        generation: this.generation,
        engine,
      };
      return token;
    });
  }
  commitPrepared(bank: PreparedAssetBank): Promise<void> {
    return this.exclusive(async () => {
      const pending = this.prepared;
      if (
        !pending ||
        pending.token !== bank ||
        pending.generation !== this.generation ||
        pending.engine !== this.getEngine()
      )
        fail("ASSET_PREPARED_STALE", "Prepared asset bank is stale or belongs to another host");
      // replaceAssets validates the entire bank before mutating its engine-owned store.
      pending.engine?.replaceAssets(pending.entries);
      this.entries = [...pending.entries];
      this.projectAssets = clone(pending.projectAssets);
      this.approved = new Set(pending.approved);
      this.generation++;
      this.invalidate();
    });
  }
  private engineMatches(engine: AudioEngine): boolean {
    const current = engine.getAssets();
    return (
      current.length === this.entries.length &&
      this.entries.every((entry) => {
        const item = current.find((asset) => asset.assetId === entry.assetId);
        return (
          item &&
          engine.getAssetBuffer(entry.assetId) === entry.buffer &&
          item.revision === entry.metadata.revision &&
          item.sha256 === entry.metadata.sha256 &&
          item.name === entry.metadata.name &&
          item.origin === entry.metadata.origin &&
          item.license === entry.metadata.license
        );
      })
    );
  }
  attachEngine(engine: AudioEngine): Promise<void> {
    return this.exclusive(async () => {
      const stage = this.stage(engine);
      this.capacity(stage);
      this.checkBank(this.entries, stage.budget);
      if (this.engineMatches(engine)) return;
      engine.replaceAssets(this.entries);
      this.generation++;
      this.invalidate();
    });
  }

  importFile(
    file: File,
    rightsConfirmed: boolean,
    pendingProject?: ProjectDocument,
  ): Promise<AudioAssetDescriptor> {
    return this.exclusive(async () => {
      if (rightsConfirmed !== true)
        fail("RIGHTS_CONFIRMATION_REQUIRED", "Local use rights must be explicitly confirmed");
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_IMPORT_BYTES)
        fail("ASSET_SIZE_LIMIT", "WAV import must be 1..8MiB");
      this.invalidate();
      const pending = pendingProject ? validateProject(pendingProject) : null;
      const bytes = await file.arrayBuffer(),
        sha256 = await digest(bytes);
      if (bytes.byteLength !== file.size)
        fail("ASSET_SIZE_LIMIT", "File bytes do not match the declared length");
      const pendingMatches =
        pending?.assets.filter(
          (asset) => asset.storage === "externalFile" && asset.sha256 === sha256,
        ) ?? [];
      if (pending && !pendingMatches.length)
        fail(
          "ASSET_RELINK_MISMATCH",
          "This WAV does not match any external asset SHA in the pending project",
        );
      let targets = pendingMatches.length
        ? pendingMatches
        : this.projectAssets.filter(
            (asset) => asset.storage === "externalFile" && asset.sha256 === sha256,
          );
      if (!targets.length)
        targets = [
          {
            assetId: `asset.${crypto.randomUUID()}`,
            revision: 1,
            sha256,
            hashKind: "encodedBytesSha256",
            name: file.name,
            mimeType: "audio/wav",
            byteLength: bytes.byteLength,
            storage: "externalFile",
            rights: {
              license: USER_CONFIRMED,
              source:
                "User-confirmed local WAV; encoded bytes stored locally; project JSON retains immutable references",
            },
          },
        ];
      if (targets.some((asset) => asset.byteLength !== bytes.byteLength))
        fail("ASSET_REFERENCE_MISMATCH", "Matching SHA has inconsistent project byte length");
      const stage = this.stage(),
        reuse = stage.reusable.get(contentKey(targets[0]!));
      const finalCount = pending
        ? targets.length
        : this.entries.filter((entry) => !targets.some((asset) => asset.assetId === entry.assetId))
            .length + targets.length;
      if (finalCount > stage.budget.maxAssets)
        fail("ASSET_COUNT_BUDGET", "Decoded asset count exceeds the bank budget");
      // Always preflight even when reusing existing decoded PCM.
      preflightWave(bytes, stage.budget, stage.rate);
      const buffer = reuse ?? (await this.decode(bytes, stage));
      this.retain(stage, buffer, contentKey(targets[0]!));
      const additions = targets.map((asset) => this.entry(asset, buffer));
      const nextEntries = [
        ...this.entries.filter(
          (entry) => !targets.some((asset) => asset.assetId === entry.assetId),
        ),
        ...additions,
      ];
      this.checkBank(pendingMatches.length ? additions : nextEntries, stage.budget);
      for (const asset of targets) {
        const existing = await this.store.loadAsset(asset.assetId, sha256);
        if (existing && existing.metadata.revision !== asset.revision)
          fail("ASSET_REFERENCE_MISMATCH", "Existing immutable bytes have another revision");
        await this.store.saveAsset({
          assetId: asset.assetId,
          sha256,
          bytes,
          metadata: existing?.metadata ?? {
            name: asset.name,
            origin: "imported",
            license: USER_CONFIRMED,
            revision: asset.revision,
          },
        });
      }
      await this.store.saveAsset({
        ...(await this.confirmation(sha256)),
        metadata: {
          name: "Local use confirmation",
          origin: "generated",
          license: USER_CONFIRMED,
          revision: 1,
        },
      });
      if (!pendingMatches.length) {
        this.getEngine()?.replaceAssets(nextEntries);
        this.entries = nextEntries;
        this.projectAssets = [
          ...this.projectAssets.filter(
            (asset) => !targets.some((target) => target.assetId === asset.assetId),
          ),
          ...clone(targets),
        ];
        this.approved.add(sha256);
        this.generation++;
      }
      return descriptor(additions[0]!);
    });
  }

  ensureBuiltinDescriptors(engine: AudioEngine): Promise<ProjectAsset[]> {
    return this.exclusive(async () => {
      this.invalidate();
      const missing = BUILTIN_IDS.filter(
        (id) => !this.entries.some((entry) => entry.assetId === id),
      );
      for (const id of BUILTIN_IDS) {
        const existing = this.projectAssets.find((asset) => asset.assetId === id);
        if (existing && (!isBuiltin(existing) || existing.generator?.algorithm !== `${id}-v1`))
          fail("ASSET_BUILTIN_ID_CONFLICT", `Reserved builtin identity has another source: ${id}`);
      }
      if (!missing.length)
        return clone(
          this.projectAssets.filter((asset) =>
            BUILTIN_IDS.includes(asset.assetId as (typeof BUILTIN_IDS)[number]),
          ),
        );
      const stage = this.stage(engine),
        rate = stage.rate,
        additions: AudioAssetBankEntry[] = [],
        refs: ProjectAsset[] = [];
      if (this.entries.length + missing.length > stage.budget.maxAssets)
        fail("ASSET_COUNT_BUDGET", "Builtin library exceeds the asset count budget");
      const mint: string[] = [];
      for (const id of missing) {
        const existing = this.projectAssets.find((asset) => asset.assetId === id);
        if (!existing) {
          mint.push(id);
          continue;
        }
        this.capacity(stage, existing.byteLength * 2);
        const regenerated = await regenerateBuiltinAsset(existing);
        if (!regenerated) fail("ASSET_GENERATOR", `Builtin cannot be regenerated: ${id}`);
        const buffer = this.context(stage).createBuffer(
          1,
          regenerated.bytesPCM.length,
          regenerated.sampleRateHz,
        );
        buffer.copyToChannel(regenerated.bytesPCM, 0);
        this.retain(stage, buffer, contentKey(existing));
        refs.push(clone(existing));
        additions.push(this.entry(existing, buffer));
      }
      if (mint.length) {
        if (rate !== 44100 && rate !== 48000)
          fail(
            "ASSET_RATE_UNSUPPORTED",
            "V1 new builtin descriptors support 44100/48000Hz PCM only",
          );
        this.capacity(stage, Math.round(rate * 1.75) * 4);
        const context = this.context(stage),
          stagingStore = new AudioAssetStore(context as BaseAudioContext, stage.budget);
        const decoded = await stagingStore.registerBuiltins();
        for (const item of decoded)
          if (mint.includes(item.assetId)) {
            const ref: ProjectAsset = {
              assetId: item.assetId,
              revision: item.revision,
              sha256: item.sha256!,
              hashKind: "float32MonoPcmBytesSha256",
              name: item.name,
              mimeType: "audio/x-float32-pcm",
              byteLength: item.decodedBytes,
              storage: "generatedDescriptor",
              rights: {
                license: item.license,
                source:
                  "AudioAssetStore fixed original procedural builtin; SHA covers mono Float32 PCM bytes",
              },
              generator: {
                algorithm: `${item.assetId}-v1` as
                  | "builtin-tone-v1"
                  | "builtin-impact-v1"
                  | "builtin-whoosh-v1",
                durationSeconds: item.durationSeconds,
                sampleRateHz: rate,
              },
            };
            refs.push(ref);
            additions.push(this.entry(ref, stagingStore.get(item.assetId)!.buffer));
          }
      }
      const next = [...this.entries, ...additions];
      this.checkBank(next, stage.budget);
      engine.replaceAssets(next);
      this.entries = next;
      this.projectAssets = [
        ...this.projectAssets.filter((asset) => !refs.some((ref) => ref.assetId === asset.assetId)),
        ...refs,
      ];
      for (const ref of refs) this.approved.add(ref.sha256);
      this.generation++;
      return clone(
        this.projectAssets.filter((asset) =>
          BUILTIN_IDS.includes(asset.assetId as (typeof BUILTIN_IDS)[number]),
        ),
      );
    });
  }
}
