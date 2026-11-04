import { AudioEngineError, type AudioAssetBankEntry } from "./types.js";

/** Immutable PCM borrow. Release drops tracker-owned references, not browser/native scratch. */
export interface AudioAssetLease {
  readonly entries: readonly AudioAssetBankEntry[];
  readonly released: boolean;
  release(): void;
}
export interface AssetEvictionResult {
  evictedAssetIds: string[];
  releasedBytes: number;
  residentBytes: number;
  protectedAssetIds: string[];
}
export interface AssetResidencySnapshot {
  residentBytes: number;
  leasedBytes: number;
  retainedBytes: number;
  decodeReservedBytes: number;
  leaseCount: number;
  residentAssets: number;
  /** Known PCM plus reservations and explicitly owned encoded/hash staging, not process RAM. */
  highWaterBytes: number;
  knownStagingBytes: number;
  nativeDecoderScratchBytes: null;
}
interface Claim {
  entries: readonly AudioAssetBankEntry[];
  released: boolean;
}
export const pcmByteLength = (buffer: AudioBuffer): number =>
  buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
export function uniquePcmBytes(buffers: Iterable<AudioBuffer>): number {
  let bytes = 0;
  for (const buffer of new Set(buffers)) bytes += pcmByteLength(buffer);
  return bytes;
}

/** Ownership only; this is not a second asset cache or a persistent source of truth. */
export class AssetLeaseTracker {
  private readonly claims = new Set<Claim>();
  get count(): number {
    return this.claims.size;
  }
  entries(): readonly AudioAssetBankEntry[] {
    return [...this.claims].flatMap((claim) => [...claim.entries]);
  }
  has(assetId: string, buffer?: AudioBuffer): boolean {
    return [...this.claims].some((claim) =>
      claim.entries.some(
        (entry) => entry.assetId === assetId && (!buffer || entry.buffer === buffer),
      ),
    );
  }
  acquire(
    entries: readonly AudioAssetBankEntry[],
    reason: string,
    onRelease?: () => void,
  ): AudioAssetLease {
    if (typeof reason !== "string" || !reason.trim() || reason.length > 128)
      throw new AudioEngineError("ASSET_LEASE_REASON", "A bounded borrower reason is required");
    const claim: Claim = {
      entries: Object.freeze(
        entries.map((entry) =>
          Object.freeze({
            ...entry,
            metadata: Object.freeze({ ...entry.metadata }),
          }),
        ),
      ),
      released: false,
    };
    this.claims.add(claim);
    return Object.freeze({
      get entries() {
        return claim.entries;
      },
      get released() {
        return claim.released;
      },
      release: () => {
        if (claim.released) return;
        claim.released = true;
        claim.entries = Object.freeze([]);
        this.claims.delete(claim);
        onRelease?.();
      },
    });
  }
}
