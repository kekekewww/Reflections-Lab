/** Control-thread observations only; these are not DSP callback or device hearing measurements. */
export const AUDIO_DIAGNOSTIC_SAMPLE_CAPACITY = 128;
export const AUDIO_NATIVE_POLL_INTERVAL_MS = 500;

export type AudioFrameDecision =
  | "accepted"
  | "stale"
  | "unavailable"
  | "source-budget"
  | "restart-blocked"
  | "invalid"
  | "error";
export type AcousticDeliveryDecision =
  | "accepted"
  | "epoch-rejected"
  | "revision-rejected"
  | "age-rejected"
  | "solver-rejected";
export type AudioTimingStage = "frameConsumer" | "routeControl" | "listenerControl";
export type AudioControlOperation =
  | "scalarGainUpdates"
  | "scalarGainSkips"
  | "shapeBuilds"
  | "shapeUploads"
  | "shapeReuses"
  | "shapeDeferred"
  | "delayUpdates"
  | "delaySkips"
  | "directionUpdates"
  | "directionSkips"
  | "routeCreates"
  | "routeRetires"
  | "bankRetirements";

export interface AcousticDeliveryObservation {
  decision: AcousticDeliveryDecision;
  frameCount: number;
  ageTicks?: number;
  elapsedMs?: number;
}
export interface AudioDiagnosticSamples {
  /** Lifetime observation count; quantiles describe only the last retained samples. */
  count: number;
  retained: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  max: number | null;
  last: number | null;
}
export interface NativeOutputObservation {
  status: "NOT_OBSERVED" | "UNSUPPORTED" | "WARMUP" | "AVAILABLE" | "COUNTER_RESET";
  contextGeneration: number;
  polledAtMs: number | null;
  windowMs: number | null;
  cumulativeUnderrunEvents: number | null;
  cumulativeUnderrunSeconds: number | null;
  deltaUnderrunEvents: number | null;
  deltaUnderrunSeconds: number | null;
  outputLatencySeconds: number | null;
}
export interface AudioDiagnosticsSnapshot {
  enabled: boolean;
  model: "CONTROL_THREAD_OBSERVATIONS";
  sampleCapacity: 128;
  frameDecisions: Record<AudioFrameDecision, number>;
  onsets: {
    count: number;
    lateCount: number;
    lateThresholdMs: 1;
    requestedAudioTimeS: number | null;
    actualAudioTimeS: number | null;
    /** max(0, actual-requested), excluding propagation and device output latency. */
    latenessMs: AudioDiagnosticSamples;
  };
  controlOperations: Record<AudioControlOperation, number>;
  timings: Record<AudioTimingStage, AudioDiagnosticSamples>;
  delivery: {
    status: "NOT_OBSERVED" | "OBSERVED";
    batches: Record<AcousticDeliveryDecision, number>;
    frames: Record<AcousticDeliveryDecision, number>;
    totalBatches: number;
    totalFrames: number;
    ageTicks: AudioDiagnosticSamples;
    elapsedMs: AudioDiagnosticSamples;
  };
  nativeOutput: NativeOutputObservation;
  unmeasured: {
    pcmGapSeconds: null;
    nativeDspCpuMs: null;
    nativeMemoryBytes: null;
    calibratedSpl: null;
  };
}

const frameDecisions: readonly AudioFrameDecision[] = [
  "accepted",
  "stale",
  "unavailable",
  "source-budget",
  "restart-blocked",
  "invalid",
  "error",
];
const deliveryDecisions: readonly AcousticDeliveryDecision[] = [
  "accepted",
  "epoch-rejected",
  "revision-rejected",
  "age-rejected",
  "solver-rejected",
];
const controlOperations: readonly AudioControlOperation[] = [
  "scalarGainUpdates",
  "scalarGainSkips",
  "shapeBuilds",
  "shapeUploads",
  "shapeReuses",
  "shapeDeferred",
  "delayUpdates",
  "delaySkips",
  "directionUpdates",
  "directionSkips",
  "routeCreates",
  "routeRetires",
  "bankRetirements",
];

function counters<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}
function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and >=0`);
  return value;
}
function amount(value: number, name: string): number {
  nonnegative(value, name);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer`);
  return value;
}
function add(value: number, increment: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, value + increment);
}
function increment<T extends string>(target: Record<T, number>, key: T, count = 1): void {
  if (!Object.prototype.hasOwnProperty.call(target, key)) throw new TypeError("Unknown counter");
  target[key] = add(target[key], amount(count, "counter amount"));
}

class Samples {
  private readonly values = new Float64Array(AUDIO_DIAGNOSTIC_SAMPLE_CAPACITY);
  private count = 0;
  private size = 0;
  private cursor = 0;
  private cached: AudioDiagnosticSamples | null = null;

  record(value: number): void {
    this.values[this.cursor] = nonnegative(value, "sample");
    this.cursor = (this.cursor + 1) % this.values.length;
    this.size = Math.min(this.size + 1, this.values.length);
    this.count = add(this.count, 1);
    this.cached = null;
  }
  snapshot(): AudioDiagnosticSamples {
    if (!this.cached) {
      const sorted = Array.from(this.values.subarray(0, this.size)).sort((a, b) => a - b);
      const percentile = (fraction: number): number | null =>
        sorted.length ? (sorted[Math.ceil(sorted.length * fraction) - 1] ?? null) : null;
      this.cached = {
        count: this.count,
        retained: this.size,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: this.size ? (sorted.at(-1) ?? null) : null,
        last: this.size
          ? (this.values[(this.cursor + this.values.length - 1) % this.values.length] ?? null)
          : null,
      };
    }
    return { ...this.cached };
  }
}

/** Bounded counters/rings on the control thread; snapshot never changes the audio graph. */
export class AudioDiagnostics {
  private enabledValue = true;
  private readonly frames = counters(frameDecisions);
  private readonly operations = counters(controlOperations);
  private readonly timingSamples: Record<AudioTimingStage, Samples> = {
    frameConsumer: new Samples(),
    routeControl: new Samples(),
    listenerControl: new Samples(),
  };
  private readonly onsetLateness = new Samples();
  private onsetCount = 0;
  private lateCount = 0;
  private requestedAudioTimeS: number | null = null;
  private actualAudioTimeS: number | null = null;
  private readonly deliveryBatches = counters(deliveryDecisions);
  private readonly deliveryFrames = counters(deliveryDecisions);
  private readonly deliveryAge = new Samples();
  private readonly deliveryElapsed = new Samples();
  private totalBatches = 0;
  private totalFrames = 0;
  private context: BaseAudioContext | null = null;
  private contextGeneration = 0;
  private lastPollMs: number | null = null;
  private baseline: { events: number; seconds: number; timeMs: number } | null = null;
  private native = this.emptyNative("NOT_OBSERVED", null);

  constructor(
    private readonly clockMs: () => number = () => performance.now(),
    enabled = true,
  ) {
    this.setEnabled(enabled);
  }

  get enabled(): boolean {
    return this.enabledValue;
  }
  setEnabled(enabled: boolean): void {
    if (typeof enabled !== "boolean") throw new TypeError("diagnostics enabled must be boolean");
    if (enabled === this.enabledValue) return;
    this.enabledValue = enabled;
    // A gap in observation cannot become a measured zero or span a native delta window.
    this.lastPollMs = null;
    this.baseline = null;
    this.native = this.emptyNative("NOT_OBSERVED", null);
  }

  bindContext(context: BaseAudioContext | null): void {
    if (context === this.context) return;
    this.context = context;
    this.contextGeneration = add(this.contextGeneration, 1);
    this.lastPollMs = null;
    this.baseline = null;
    this.native = this.emptyNative("NOT_OBSERVED", null);
  }
  recordFrame(decision: AudioFrameDecision, durationMs: number): void {
    if (!this.enabledValue) return;
    nonnegative(durationMs, "frame consumer duration");
    increment(this.frames, decision);
    this.timing("frameConsumer", durationMs);
  }
  recordOnset(requestedAudioTimeS: number, actualAudioTimeS: number): void {
    if (!this.enabledValue) return;
    // A backdated emission can map before audio time zero; keep that requested
    // time so its lateness remains observable, while the actual onset is legal.
    if (!Number.isFinite(requestedAudioTimeS))
      throw new RangeError("requested audio time must be finite");
    nonnegative(actualAudioTimeS, "actual audio time");
    const latenessMs = nonnegative(
      Math.max(0, (actualAudioTimeS - requestedAudioTimeS) * 1000),
      "onset lateness",
    );
    this.onsetCount = add(this.onsetCount, 1);
    if (latenessMs > 1) this.lateCount = add(this.lateCount, 1);
    this.requestedAudioTimeS = requestedAudioTimeS;
    this.actualAudioTimeS = actualAudioTimeS;
    this.onsetLateness.record(latenessMs);
  }
  increment(kind: AudioControlOperation, count = 1): void {
    if (!this.enabledValue) return;
    increment(this.operations, kind, count);
  }
  timing(stage: AudioTimingStage, durationMs: number): void {
    if (!this.enabledValue) return;
    if (!Object.prototype.hasOwnProperty.call(this.timingSamples, stage))
      throw new TypeError("Unknown audio timing stage");
    this.timingSamples[stage].record(durationMs);
  }
  recordDelivery(observation: AcousticDeliveryObservation): void {
    if (!this.enabledValue) return;
    const { decision, frameCount, ageTicks, elapsedMs } = observation;
    amount(frameCount, "delivery frame count");
    if (ageTicks !== undefined) amount(ageTicks, "delivery age ticks");
    if (elapsedMs !== undefined) nonnegative(elapsedMs, "delivery elapsed time");
    if (!Object.prototype.hasOwnProperty.call(this.deliveryBatches, decision))
      throw new TypeError("Unknown delivery decision");
    increment(this.deliveryBatches, decision);
    increment(this.deliveryFrames, decision, frameCount);
    this.totalBatches = add(this.totalBatches, 1);
    this.totalFrames = add(this.totalFrames, frameCount);
    if (ageTicks !== undefined) this.deliveryAge.record(ageTicks);
    if (elapsedMs !== undefined) this.deliveryElapsed.record(elapsedMs);
  }

  snapshot(): AudioDiagnosticsSnapshot {
    this.pollNative();
    return {
      enabled: this.enabledValue,
      model: "CONTROL_THREAD_OBSERVATIONS",
      sampleCapacity: AUDIO_DIAGNOSTIC_SAMPLE_CAPACITY,
      frameDecisions: { ...this.frames },
      onsets: {
        count: this.onsetCount,
        lateCount: this.lateCount,
        lateThresholdMs: 1,
        requestedAudioTimeS: this.requestedAudioTimeS,
        actualAudioTimeS: this.actualAudioTimeS,
        latenessMs: this.onsetLateness.snapshot(),
      },
      controlOperations: { ...this.operations },
      timings: {
        frameConsumer: this.timingSamples.frameConsumer.snapshot(),
        routeControl: this.timingSamples.routeControl.snapshot(),
        listenerControl: this.timingSamples.listenerControl.snapshot(),
      },
      delivery: {
        status: this.totalBatches ? "OBSERVED" : "NOT_OBSERVED",
        batches: { ...this.deliveryBatches },
        frames: { ...this.deliveryFrames },
        totalBatches: this.totalBatches,
        totalFrames: this.totalFrames,
        ageTicks: this.deliveryAge.snapshot(),
        elapsedMs: this.deliveryElapsed.snapshot(),
      },
      nativeOutput: { ...this.native },
      unmeasured: {
        pcmGapSeconds: null,
        nativeDspCpuMs: null,
        nativeMemoryBytes: null,
        calibratedSpl: null,
      },
    };
  }

  private emptyNative(
    status: NativeOutputObservation["status"],
    polledAtMs: number | null,
  ): NativeOutputObservation {
    return {
      status,
      contextGeneration: this.contextGeneration,
      polledAtMs,
      windowMs: null,
      cumulativeUnderrunEvents: null,
      cumulativeUnderrunSeconds: null,
      deltaUnderrunEvents: null,
      deltaUnderrunSeconds: null,
      outputLatencySeconds: null,
    };
  }
  private pollNative(): void {
    if (!this.enabledValue || !this.context) return;
    const now = nonnegative(this.clockMs(), "diagnostic clock");
    if (this.lastPollMs !== null && now - this.lastPollMs < AUDIO_NATIVE_POLL_INTERVAL_MS) return;
    this.lastPollMs = now;
    try {
      // Read the optional native getter once per poll; never infer PCM continuity from this counter.
      const stats = Reflect.get(this.context, "playbackStats") as unknown;
      if (typeof stats !== "object" || stats === null) throw new Error("Unavailable native stats");
      const events = Reflect.get(stats, "underrunEvents") as unknown;
      const seconds = Reflect.get(stats, "underrunDuration") as unknown;
      if (
        typeof events !== "number" ||
        !Number.isSafeInteger(events) ||
        events < 0 ||
        typeof seconds !== "number" ||
        !Number.isFinite(seconds) ||
        seconds < 0
      )
        throw new Error("Unavailable native counters");
      const previous = this.baseline;
      this.baseline = { events, seconds, timeMs: now };
      if (!previous) {
        this.native = this.emptyNative("WARMUP", now);
        return;
      }
      if (events < previous.events || seconds < previous.seconds) {
        this.native = this.emptyNative("COUNTER_RESET", now);
        return;
      }
      const latency = Reflect.get(this.context, "outputLatency") as unknown;
      this.native = {
        status: "AVAILABLE",
        contextGeneration: this.contextGeneration,
        polledAtMs: now,
        windowMs: now - previous.timeMs,
        cumulativeUnderrunEvents: events,
        cumulativeUnderrunSeconds: seconds,
        deltaUnderrunEvents: events - previous.events,
        deltaUnderrunSeconds: seconds - previous.seconds,
        outputLatencySeconds:
          typeof latency === "number" && Number.isFinite(latency) && latency >= 0 ? latency : null,
      };
    } catch {
      this.baseline = null;
      this.native = this.emptyNative("UNSUPPORTED", now);
    }
  }
}
