/**
 * Pointer-lock look deltas with isolated spikes held back for one event.
 * Chromium on Windows can report a single movementX/Y hundreds of pixels long that
 * the mouse never produced (adjusted pointer mode, lock re-entry). A delta far above
 * the recent motion is applied only when the next delta continues it, so a real fast
 * flick is delayed by one event and a lone spike is dropped.
 */
export class LookSpikeFilter {
  private recentPx = 0;
  private recentAtMs = Number.NEGATIVE_INFINITY;
  private held: readonly [number, number] | null = null;

  constructor(
    private readonly floorPx = 120,
    private readonly ratio = 4,
    private readonly halfLifeMs = 60,
  ) {}

  reset(): void {
    this.recentPx = 0;
    this.recentAtMs = Number.NEGATIVE_INFINITY;
    this.held = null;
  }

  /** Deltas to apply now, in order: none, this one, or a confirmed held one and this one. */
  accept(x: number, y: number, timeMs: number): Array<readonly [number, number]> {
    const size = Math.hypot(x, y);
    const held = this.held;
    this.held = null;
    if (held) {
      const heldSize = Math.hypot(held[0], held[1]);
      if (held[0] * x + held[1] * y > 0 && size >= heldSize * 0.25) {
        this.track(Math.max(heldSize, size), timeMs);
        return [held, [x, y]];
      }
    }
    if (size > Math.max(this.floorPx, this.ratio * this.decayed(timeMs))) {
      this.held = [x, y];
      return [];
    }
    this.track(size, timeMs);
    return [[x, y]];
  }

  private decayed(timeMs: number): number {
    const elapsed = timeMs - this.recentAtMs;
    return elapsed > 0 ? this.recentPx * 0.5 ** (elapsed / this.halfLifeMs) : this.recentPx;
  }

  private track(size: number, timeMs: number): void {
    this.recentPx = Math.max(size, this.decayed(timeMs));
    this.recentAtMs = timeMs;
  }
}
