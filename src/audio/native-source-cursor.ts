import { AudioEngineError } from "./types.js";

export interface NativeSourceCursorOptions {
  audioTimeSeconds: number;
  positionSeconds?: number;
  rate: number;
  sampleRate: number;
  quantumFrames: number;
  parameterScale: number;
  rateKind: "k-rate" | "a-rate";
  /** Actual native AudioParam value, in parameter units rather than source-rate units. */
  fromParameter?: number;
}

export interface NativeSourceRateState {
  from: number;
  to: number;
  remainingSeconds: number;
}

interface RatePoint {
  time: number;
  position: number;
  from: number;
  to: number;
  end: number;
  gridOrigin: number;
  prefixParameter: number;
}

interface FrozenCursor {
  time: number;
  position: number;
  fromParameter: number;
  toParameter: number;
  remainingSeconds: number;
}

const MAX_HISTORY_POINTS = 512;
const HISTORY_SECONDS = 5.1;
const MAX_RAMP_SECONDS = 2;
const MAX_SAMPLE_RATE = 384000;
const f = Math.fround;

function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0)
    throw new AudioEngineError(
      "INVALID_NATIVE_SOURCE_CURSOR",
      `${name} must be finite and nonnegative`,
    );
  return value;
}

function positive(value: number, name: string): number {
  nonnegative(value, name);
  if (value === 0)
    throw new AudioEngineError("INVALID_NATIVE_SOURCE_CURSOR", `${name} must be positive`);
  return value;
}

/**
 * Control-thread prediction of a native source's accumulated source seconds.
 * This models the pinned Float32/k-rate or Chromium four-lane a-rate policy;
 * it is not a capture of native filter state or a cross-browser DSP guarantee.
 */
export class NativeSourceCursor {
  private onset: number;
  private readonly initialPosition: number;
  private readonly initial: RatePoint;
  private readonly sampleRate: number;
  private readonly quantumFrames: number;
  private readonly parameterScale: number;
  private readonly rateKind: "k-rate" | "a-rate";
  private readonly sampleDurationF32: number;
  private readonly points: RatePoint[] = [];
  private pruned = false;
  private lastControlTime: number | null = null;
  private stopTime: number | null = null;
  private frozen: FrozenCursor | null = null;

  // Reusable four-scalar scratch state. No per-block arrays or objects are made.
  private lanePoint: RatePoint | null = null;
  private laneBlock = NaN;
  private laneGroup = -1;
  private laneDelta = 0;
  private lane0 = 0;
  private lane1 = 0;
  private lane2 = 0;
  private lane3 = 0;

  constructor(options: NativeSourceCursorOptions) {
    this.onset = nonnegative(options.audioTimeSeconds, "audio time");
    this.initialPosition = nonnegative(options.positionSeconds ?? 0, "source position");
    positive(options.rate, "source rate");
    this.sampleRate = positive(options.sampleRate, "sample rate");
    if (this.sampleRate > MAX_SAMPLE_RATE)
      throw new AudioEngineError(
        "INVALID_NATIVE_SOURCE_CURSOR",
        "Sample rate exceeds the bounded cursor model",
      );
    this.quantumFrames = positive(options.quantumFrames, "render quantum");
    if (!Number.isSafeInteger(this.quantumFrames))
      throw new AudioEngineError(
        "INVALID_NATIVE_SOURCE_CURSOR",
        "Render quantum must be an integer",
      );
    this.parameterScale = positive(options.parameterScale, "parameter scale");
    if (options.rateKind !== "k-rate" && options.rateKind !== "a-rate")
      throw new AudioEngineError("INVALID_NATIVE_SOURCE_CURSOR", "Unknown native rate kind");
    this.rateKind = options.rateKind;
    this.sampleDurationF32 = f(1 / this.sampleRate);
    const parameter = this.parameter(options.fromParameter ?? options.rate * this.parameterScale);
    this.initial = {
      time: this.onset,
      position: this.initialPosition,
      from: parameter,
      to: parameter,
      end: this.onset,
      gridOrigin: 0,
      prefixParameter: parameter,
    };
  }

  get historySize(): number {
    return Math.max(1, this.points.length);
  }

  private parameter(value: number): number {
    return positive(f(positive(value, "native parameter")), "Float32 native parameter");
  }

  private pointAt(time: number): RatePoint {
    for (let index = this.points.length - 1; index >= 0; index--)
      if (this.points[index]!.time <= time) return this.points[index]!;
    return this.initial;
  }

  private requireHistory(time: number): void {
    if (this.pruned && this.points[0] && time > this.onset && time < this.points[0]!.time)
      throw new AudioEngineError(
        "NATIVE_CURSOR_HISTORY_UNAVAILABLE",
        "Cursor predates retained native rate history",
      );
  }

  private continuousParameter(point: RatePoint, time: number): number {
    if (point.end <= point.time || time >= point.end) return point.to;
    if (time <= point.time) return point.from;
    return f(
      point.from + (point.to - point.from) * ((time - point.time) / (point.end - point.time)),
    );
  }

  /** Correct only roundoff at a grid boundary, never round a fractional onset to a frame. */
  private gridCoordinate(value: number): number {
    const nearest = Math.round(value);
    return Math.abs(value - nearest) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 4
      ? nearest
      : value;
  }

  private firstFrame(time: number, point: RatePoint): number {
    const step = this.rateKind === "k-rate" ? this.quantumFrames : 1;
    return (
      Math.floor(this.gridCoordinate(((time - point.gridOrigin) * this.sampleRate) / step)) * step
    );
  }

  private initialLane(lane: number, a: number, h: number, m: number, value: number): number {
    return f(f(f(f(lane * h) + a) * m) + value);
  }

  /**
   * Native parameter generator hook. A-rate follows the pinned Chromium SSE
   * four-lane recurrence, resetting lanes at each actual render quantum.
   */
  private parameterValue(point: RatePoint, frame: number): number {
    const time = point.gridOrigin + frame / this.sampleRate;
    if (time < point.time) return point.prefixParameter;
    if (point.end <= point.time || time >= point.end) return point.to;
    const first = Math.floor(frame / this.quantumFrames) * this.quantumFrames;
    const offset = frame - first;
    const vectorFrames = Math.floor(this.quantumFrames / 4) * 4;
    const difference = f(point.to - point.from);
    const inverseDuration = f(1 / (point.end - point.time));
    const start = point.time - point.gridOrigin;
    if (this.rateKind === "k-rate" || offset >= vectorFrames) {
      // k-rate uses the scalar one-value path, not the SSE lane-zero path.
      const x = f((frame / this.sampleRate - start) * inverseDuration);
      return f(point.from + f(x * difference));
    }
    const group = Math.floor(offset / 4);
    if (this.lanePoint !== point || this.laneBlock !== first || group < this.laneGroup) {
      const a = f(first / this.sampleRate - start);
      const h = this.sampleDurationF32;
      const m = f(inverseDuration * difference);
      this.laneDelta = f((4 / this.sampleRate) * inverseDuration * difference);
      this.lane0 = this.initialLane(0, a, h, m, point.from);
      this.lane1 = this.initialLane(1, a, h, m, point.from);
      this.lane2 = this.initialLane(2, a, h, m, point.from);
      this.lane3 = this.initialLane(3, a, h, m, point.from);
      this.lanePoint = point;
      this.laneBlock = first;
      this.laneGroup = 0;
    }
    while (this.laneGroup < group) {
      this.lane0 = f(this.lane0 + this.laneDelta);
      this.lane1 = f(this.lane1 + this.laneDelta);
      this.lane2 = f(this.lane2 + this.laneDelta);
      this.lane3 = f(this.lane3 + this.laneDelta);
      this.laneGroup++;
    }
    switch (offset % 4) {
      case 0:
        return this.lane0;
      case 1:
        return this.lane1;
      case 2:
        return this.lane2;
      default:
        return this.lane3;
    }
  }

  private sourceRateAt(point: RatePoint, frame: number): number {
    const parameter = this.parameterValue(point, frame);
    return this.rateKind === "k-rate"
      ? parameter / this.parameterScale
      : (f(f(parameter) * this.sampleDurationF32) * this.sampleRate) / this.parameterScale;
  }

  private heldParameter(point: RatePoint, time: number): number {
    return this.parameterValue(point, this.firstFrame(time, point));
  }

  private steadySourceRate(parameter: number): number {
    return this.rateKind === "k-rate"
      ? parameter / this.parameterScale
      : (f(f(parameter) * this.sampleDurationF32) * this.sampleRate) / this.parameterScale;
  }

  private integrate(point: RatePoint, start: number, end: number): number {
    if (end <= start) return 0;
    const step = this.rateKind === "k-rate" ? this.quantumFrames : 1;
    // At most two ramp seconds plus boundary cells are scanned. Long steady
    // tails are one multiplication, independent of elapsed source lifetime.
    const steadyFrame =
      Math.ceil(this.gridCoordinate(((point.end - point.gridOrigin) * this.sampleRate) / step)) *
      step;
    const steadyTime = point.gridOrigin + steadyFrame / this.sampleRate;
    const scanEnd = Math.min(end, Math.max(start, steadyTime));
    let time = start;
    let result = 0;
    while (time < scanEnd) {
      let frame = this.firstFrame(time, point);
      let next = point.gridOrigin + (frame + step) / this.sampleRate;
      if (next <= time) {
        frame += step;
        next = point.gridOrigin + (frame + step) / this.sampleRate;
      }
      const until = Math.min(scanEnd, next);
      result += this.sourceRateAt(point, frame) * (until - time);
      time = until;
    }
    if (time < end) result += this.steadySourceRate(point.to) * (end - time);
    return result;
  }

  private positionAt(time: number): number {
    if (time <= this.onset) return this.initialPosition;
    this.requireHistory(time);
    const point = this.pointAt(time);
    return nonnegative(
      point.position + this.integrate(point, Math.max(this.onset, point.time), time),
      "native source position",
    );
  }

  private trim(time: number): void {
    while (
      this.points.length > 2 &&
      (this.points[1]!.time < time - HISTORY_SECONDS || this.points.length > MAX_HISTORY_POINTS)
    ) {
      this.points.shift();
      this.pruned = true;
    }
  }

  setRate(
    rate: number,
    audioTimeSeconds: number,
    smoothingSeconds = 0,
    observedFromParameter?: number,
  ): void {
    positive(rate, "source rate");
    nonnegative(audioTimeSeconds, "audio time");
    nonnegative(smoothingSeconds, "rate smoothing");
    if (smoothingSeconds > MAX_RAMP_SECONDS)
      throw new AudioEngineError(
        "NATIVE_CURSOR_RAMP_BUDGET",
        "Native cursor ramps are limited to two seconds",
      );
    if (observedFromParameter !== undefined) this.parameter(observedFromParameter);
    const time = this.frozen?.time ?? audioTimeSeconds;
    if (this.lastControlTime !== null && time < this.lastControlTime)
      throw new AudioEngineError("NATIVE_CURSOR_TIME_REVERSED", "Native controls must be ordered");
    if (this.stopTime !== null && time >= this.stopTime) return;
    const previous = this.pointAt(time);
    const to = this.parameter(rate * this.parameterScale);
    this.lastControlTime = time;
    if (previous.to === to && observedFromParameter === undefined) return;
    const point: RatePoint = {
      time,
      position: this.positionAt(time),
      from:
        observedFromParameter === undefined
          ? this.continuousParameter(previous, time)
          : this.parameter(observedFromParameter),
      to,
      end: nonnegative(time + smoothingSeconds, "native ramp end"),
      gridOrigin: 0,
      prefixParameter: this.heldParameter(previous, time),
    };
    if (this.points.at(-1)?.time === time) this.points.pop();
    this.points.push(point);
    this.trim(time);
    if (this.frozen) this.captureFreeze(time);
  }

  readPosition(audioTimeSeconds: number): number {
    nonnegative(audioTimeSeconds, "audio time");
    if (this.frozen) return this.frozen.position;
    return this.positionAt(Math.min(audioTimeSeconds, this.stopTime ?? Infinity));
  }

  rateState(audioTimeSeconds: number): NativeSourceRateState {
    nonnegative(audioTimeSeconds, "audio time");
    if (this.frozen)
      return {
        from: this.frozen.fromParameter / this.parameterScale,
        to: this.frozen.toParameter / this.parameterScale,
        remainingSeconds: this.frozen.remainingSeconds,
      };
    this.requireHistory(audioTimeSeconds);
    const point = this.pointAt(audioTimeSeconds);
    return {
      from: this.continuousParameter(point, audioTimeSeconds) / this.parameterScale,
      to: point.to / this.parameterScale,
      remainingSeconds: Math.max(0, point.end - audioTimeSeconds),
    };
  }

  private captureFreeze(time: number): void {
    const point = this.pointAt(time);
    this.frozen = {
      time,
      position: this.positionAt(Math.min(time, this.stopTime ?? Infinity)),
      fromParameter: this.continuousParameter(point, time),
      toParameter: point.to,
      remainingSeconds: Math.max(0, point.end - time),
    };
  }

  freeze(audioTimeSeconds: number): void {
    nonnegative(audioTimeSeconds, "freeze time");
    if (!this.frozen) this.captureFreeze(audioTimeSeconds);
  }

  /** Context suspension stops its clock; retained native nodes keep the original curve/grid. */
  resumeSameContext(): void {
    this.frozen = null;
    this.lanePoint = null;
  }

  resume(audioTimeSeconds: number): void {
    nonnegative(audioTimeSeconds, "resume time");
    const frozen = this.frozen;
    if (!frozen) return;
    const shift = audioTimeSeconds - frozen.time;
    this.onset += shift;
    for (const point of [this.initial, ...this.points]) {
      point.time += shift;
      point.end += shift;
      point.gridOrigin += shift;
    }
    if (this.stopTime !== null) this.stopTime += shift;
    if (this.lastControlTime !== null) this.lastControlTime += shift;
    const point: RatePoint = {
      time: audioTimeSeconds,
      position: frozen.position,
      from: frozen.fromParameter,
      to: frozen.toParameter,
      end: audioTimeSeconds + frozen.remainingSeconds,
      gridOrigin: 0,
      prefixParameter: frozen.fromParameter,
    };
    if (this.points.at(-1)?.time === audioTimeSeconds) this.points.pop();
    this.points.push(point);
    this.trim(audioTimeSeconds);
    this.frozen = null;
    this.lanePoint = null;
  }

  /** Explicit emission boundary; later stops cannot extend an earlier stop. */
  stopAt(audioTimeSeconds: number): void {
    nonnegative(audioTimeSeconds, "stop time");
    this.stopTime = Math.min(this.stopTime ?? Infinity, Math.max(this.onset, audioTimeSeconds));
    if (this.frozen) this.captureFreeze(this.frozen.time);
  }
}
