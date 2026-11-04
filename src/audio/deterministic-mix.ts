import { AudioEngineError } from "./types.js";

declare const mixHandle: unique symbol;
export type DeterministicMixHandle = { readonly [mixHandle]: true };

/**
 * Main-thread unity summation: target <- J0 <- J1 <- ... . Each junction has
 * at most one leaf and one successor, avoiding native N-way summation order.
 * Links only grow until disposal; no live rewire, DSP callback or added delay.
 * Storage is bounded by peak simultaneous leaves (at least one root junction).
 */
export class DeterministicMixInput {
  private readonly junctions: GainNode[] = [];
  private readonly slots: (DeterministicMixHandle | null)[] = [];
  private readonly leaves = new Map<DeterministicMixHandle, { leaf: AudioNode; slot: number }>();
  private disposed = false;

  constructor(
    private readonly context: BaseAudioContext,
    target: AudioNode,
    private readonly capacity?: number,
  ) {
    if (capacity !== undefined && (!Number.isSafeInteger(capacity) || capacity < 1))
      throw new AudioEngineError("INVALID_MIX_CAPACITY", "Mix capacity must be a positive integer");
    this.grow(target);
  }

  private grow(target: AudioNode): void {
    const junction = this.context.createGain();
    junction.gain.value = 1;
    junction.connect(target);
    this.junctions.push(junction);
    this.slots.push(null);
  }

  attach(leaf: AudioNode): DeterministicMixHandle {
    if (this.disposed) throw new AudioEngineError("MIX_DISPOSED", "Mix input disposed");
    if (this.capacity !== undefined && this.leaves.size >= this.capacity)
      throw new AudioEngineError("MIX_CAPACITY", "Mix input capacity exhausted");
    // Map identity is only handle bookkeeping; slot selection is strictly numeric.
    let slot = this.slots.indexOf(null);
    if (slot === -1) {
      slot = this.junctions.length;
      this.grow(this.junctions[slot - 1]!);
    }
    const handle = Object.freeze({}) as DeterministicMixHandle;
    leaf.connect(this.junctions[slot]!);
    this.slots[slot] = handle;
    this.leaves.set(handle, { leaf, slot });
    return handle;
  }

  detach(handle: DeterministicMixHandle): void {
    const entry = this.leaves.get(handle);
    if (!entry) return;
    entry.leaf.disconnect(this.junctions[entry.slot]!);
    this.slots[entry.slot] = null;
    this.leaves.delete(handle);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const handle of this.leaves.keys()) this.detach(handle);
    for (const junction of this.junctions) junction.disconnect();
    this.junctions.length = 0;
    this.slots.length = 0;
  }
}
