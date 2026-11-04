import type {
  AcousticBoxOccluder,
  AcousticPrimitive,
  AcousticSurface,
} from "../acoustics/types.js";

export interface PreparedAcousticGeometry {
  surfaces: AcousticSurface[];
  primitive?: AcousticPrimitive;
  boxOccluder?: AcousticBoxOccluder;
}
export interface AcousticGeometryCacheTelemetry {
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
  generation: number;
  maxEntries: number;
}

function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

/** Bounded internal world-geometry cache. Public requests always receive their own copies. */
export class AcousticGeometryCache {
  private readonly entries = new Map<
    string,
    { identity: string; geometry: PreparedAcousticGeometry }
  >();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private generation = 0;
  constructor(private readonly maxEntries = 512) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 512)
      throw new Error("ACOUSTIC_GEOMETRY_CACHE_CAPACITY");
  }
  /** A slot replaces the previous pose instead of retaining a new entry for every tick. */
  prepare(
    slot: string,
    identity: string,
    create: () => PreparedAcousticGeometry,
  ): PreparedAcousticGeometry {
    const cached = this.entries.get(slot);
    if (cached?.identity === identity) {
      this.hits++;
      this.entries.delete(slot);
      this.entries.set(slot, cached);
      return cached.geometry;
    }
    this.misses++;
    // Publish only successfully constructed geometry. A failed pose cannot poison a prior slot.
    const geometry = immutable(create());
    this.entries.delete(slot);
    this.entries.set(slot, { identity, geometry });
    if (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!);
      this.evictions++;
    }
    return geometry;
  }
  clear(): void {
    this.entries.clear();
    this.generation++;
  }
  getTelemetry(): Readonly<AcousticGeometryCacheTelemetry> {
    return Object.freeze({
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      generation: this.generation,
      maxEntries: this.maxEntries,
    });
  }
}
