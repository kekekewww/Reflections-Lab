/** Tracks responsibility for real releases across suspension without inventing keyups. */
export class ReleaseLedger<T> {
  private readonly active = new Set<T>();
  private readonly debt = new Set<T>();

  constructor(
    private readonly capacity: number,
    private readonly accepts: (value: T) => boolean,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 256)
      throw new RangeError("Release ownership capacity must be an integer from 1 to 256");
  }

  /** Only a newly admitted physical press may be forwarded to the host. */
  press(value: T): boolean {
    if (!this.accepts(value) || this.hasUnreleased(value) || this.size >= this.capacity)
      return false;
    this.active.add(value);
    return true;
  }

  /** Suspension clears active intents but retains the responsibility to forward their release. */
  suspend(): void {
    for (const value of this.active) this.debt.add(value);
    this.active.clear();
  }

  /** Return true exactly once for a release this owner actually observed a press for. */
  release(value: T): boolean {
    const active = this.active.delete(value);
    const debt = this.debt.delete(value);
    return active || debt;
  }

  hasUnreleased(value: T): boolean {
    return this.active.has(value) || this.debt.has(value);
  }

  get size(): number {
    return this.active.size + this.debt.size;
  }
}
