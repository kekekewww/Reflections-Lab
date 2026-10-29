export type ClockMode = "interactive" | "recording";

export interface FixedClockOptions {
  fixedDtSeconds?: number;
  maxCatchUpSteps?: number;
  mode?: ClockMode;
}

export interface FixedClockAdvance {
  steps: number;
  alpha: number;
  tick: number;
  /** Wall time discarded during this call only; logical ticks are never skipped. */
  droppedWallTimeSeconds: number;
  /** Recording overruns also pause the clock and retain every pending tick. */
  overrun: boolean;
}

/**
 * Fixed-step scheduling is independent from render refresh rate. The callback
 * performs one complete physics step; the clock commits its tick only if that
 * callback returns successfully. It never supplies a variable physics dt.
 */
export class FixedClock {
  readonly fixedDtSeconds: number;
  readonly maxCatchUpSteps: number;
  private currentMode: ClockMode;
  private accumulatedSeconds = 0;
  private currentTick = 0;
  private suspended = true;
  private discardedSeconds = 0;

  constructor(options: FixedClockOptions = {}) {
    const dt = options.fixedDtSeconds ?? 1 / 60;
    const maxSteps = options.maxCatchUpSteps ?? 4;
    const mode = options.mode ?? "interactive";
    if (!Number.isFinite(dt) || dt < 1 / 1000 || dt > 1) {
      throw new RangeError("fixedDtSeconds must be finite and between 0.001 and 1 second");
    }
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 240) {
      throw new RangeError("maxCatchUpSteps must be an integer between 1 and 240");
    }
    if (mode !== "interactive" && mode !== "recording") {
      throw new TypeError("Unknown fixed-clock mode");
    }
    this.fixedDtSeconds = dt;
    this.maxCatchUpSteps = maxSteps;
    this.currentMode = mode;
  }

  get tick(): number {
    return this.currentTick;
  }
  get mode(): ClockMode {
    return this.currentMode;
  }
  /** Switch policy only at a stopped tick boundary; never reset or invent ticks. */
  setMode(mode: ClockMode): void {
    if (mode !== "interactive" && mode !== "recording") throw new TypeError("Unknown clock mode");
    if (!this.suspended) throw new Error("PAUSE_REQUIRED");
    this.currentMode = mode;
  }

  get paused(): boolean {
    return this.suspended;
  }

  get accumulatorSeconds(): number {
    return this.accumulatedSeconds;
  }

  get totalDroppedWallTimeSeconds(): number {
    return this.discardedSeconds;
  }

  pause(): void {
    this.suspended = true;
  }

  resume(): void {
    this.suspended = false;
  }

  reset(): void {
    this.accumulatedSeconds = 0;
    this.currentTick = 0;
    this.discardedSeconds = 0;
    this.suspended = true;
  }

  advance(wallDeltaSeconds: number, step: () => void): FixedClockAdvance {
    if (!Number.isFinite(wallDeltaSeconds) || wallDeltaSeconds < 0) {
      throw new RangeError("wallDeltaSeconds must be finite and nonnegative");
    }
    if (typeof step !== "function") throw new TypeError("A fixed-step callback is required");
    if (this.suspended) return this.result(0, 0, false);

    const proposedSeconds = this.accumulatedSeconds + wallDeltaSeconds;
    if (
      !Number.isFinite(proposedSeconds) ||
      proposedSeconds / this.fixedDtSeconds > Number.MAX_SAFE_INTEGER ||
      !Number.isFinite(this.discardedSeconds + wallDeltaSeconds) ||
      this.currentTick > Number.MAX_SAFE_INTEGER - this.maxCatchUpSteps
    ) {
      throw new RangeError("Fixed-clock time exceeds the safely representable range");
    }
    this.accumulatedSeconds = proposedSeconds;
    const epsilon = this.fixedDtSeconds * 1e-10;
    let steps = 0;
    while (
      !this.suspended &&
      this.accumulatedSeconds + epsilon >= this.fixedDtSeconds &&
      steps < this.maxCatchUpSteps
    ) {
      step();
      this.accumulatedSeconds = Math.max(0, this.accumulatedSeconds - this.fixedDtSeconds);
      this.currentTick += 1;
      steps += 1;
    }

    const overrun = !this.suspended && this.accumulatedSeconds + epsilon >= this.fixedDtSeconds;
    let droppedSeconds = 0;
    if (overrun) {
      if (this.mode === "recording") {
        this.suspended = true;
      } else {
        const droppedSteps = Math.floor((this.accumulatedSeconds + epsilon) / this.fixedDtSeconds);
        droppedSeconds = droppedSteps * this.fixedDtSeconds;
        this.accumulatedSeconds = Math.max(0, this.accumulatedSeconds - droppedSeconds);
        this.discardedSeconds += droppedSeconds;
      }
    }
    return this.result(steps, droppedSeconds, overrun);
  }

  private result(steps: number, droppedSeconds: number, overrun: boolean): FixedClockAdvance {
    return {
      steps,
      alpha: Math.max(0, Math.min(1, this.accumulatedSeconds / this.fixedDtSeconds)),
      tick: this.currentTick,
      droppedWallTimeSeconds: droppedSeconds,
      overrun,
    };
  }
}
