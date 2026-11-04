import { AudioEngineError, type VoiceCursor } from "./types.js";

export interface VirtualVoiceTimelineOptions {
  audioTimeSeconds: number;
  rate: number;
  /** Remaining unpitched emission duration from this anchor; null means indefinite. */
  durationSeconds: number | null;
  positionSeconds?: number;
  elapsedSeconds?: number;
  /** Absolute source cursor limit, excluding an authored sample start offset. */
  sourceLimitSeconds?: number;
}

export interface VirtualVoiceRateState {
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
}

const MAX_HISTORY_POINTS = 512;
const HISTORY_SECONDS = 5.1;

function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0)
    throw new AudioEngineError(
      "INVALID_VIRTUAL_TIMELINE",
      `${name} must be finite and nonnegative`,
    );
  return value;
}

function positive(value: number, name: string): number {
  nonnegative(value, name);
  if (value === 0)
    throw new AudioEngineError("INVALID_VIRTUAL_TIMELINE", `${name} must be positive`);
  return value;
}

/** Bounded control-thread source clock. It is not evidence of rendered native DSP history. */
export class VirtualVoiceTimeline {
  private onset: number;
  private readonly initialPosition: number;
  private readonly initialElapsed: number;
  private readonly initialRate: number;
  private readonly duration: number | null;
  private readonly sourceLimit: number | undefined;
  private readonly points: RatePoint[] = [];
  private pruned = false;
  private lastControlTime: number | null = null;
  private endedAt: number | null = null;
  private explicitStopAt: number | null = null;
  private frozenAt: number | null = null;
  private frozenCursor: VoiceCursor | null = null;

  constructor(options: VirtualVoiceTimelineOptions) {
    this.onset = nonnegative(options.audioTimeSeconds, "audio time");
    this.initialPosition = nonnegative(options.positionSeconds ?? 0, "source position");
    this.initialElapsed = nonnegative(options.elapsedSeconds ?? 0, "emission elapsed");
    this.initialRate = positive(options.rate, "playback rate");
    this.duration =
      options.durationSeconds === null
        ? null
        : nonnegative(options.durationSeconds, "remaining duration");
    this.sourceLimit =
      options.sourceLimitSeconds === undefined
        ? undefined
        : nonnegative(options.sourceLimitSeconds, "source limit");
    if (this.sourceLimit !== undefined && this.sourceLimit < this.initialPosition)
      throw new AudioEngineError("INVALID_VIRTUAL_TIMELINE", "Source limit precedes its cursor");
    if (this.duration !== null) nonnegative(this.onset + this.duration, "duration end");
  }

  get historySize(): number {
    return Math.max(1, this.points.length);
  }

  private pointAt(time: number): RatePoint | null {
    for (let index = this.points.length - 1; index >= 0; index--)
      if (this.points[index]!.time <= time) return this.points[index]!;
    return null;
  }

  private rateAt(point: RatePoint | null, time: number): number {
    if (!point) return this.initialRate;
    if (point.end <= point.time || time >= point.end) return point.to;
    const fraction = Math.max(0, (time - point.time) / (point.end - point.time));
    return point.from + (point.to - point.from) * fraction;
  }

  private integral(point: RatePoint, time: number): number {
    const dt = Math.max(0, time - point.time);
    const ramp = Math.max(0, point.end - point.time);
    const during = Math.min(dt, ramp);
    return (
      (ramp > 0
        ? point.from * during + ((point.to - point.from) * during * during) / (2 * ramp)
        : 0) +
      point.to * (dt - during)
    );
  }

  private positionAt(time: number): number {
    if (time <= this.onset) return this.initialPosition;
    const oldest = this.points[0];
    if (this.pruned && oldest && time < oldest.time)
      throw new AudioEngineError(
        "VIRTUAL_HISTORY_UNAVAILABLE",
        "Requested cursor predates retained rate history",
      );
    const point = this.pointAt(time);
    const position = point
      ? point.position +
        this.integral(point, time) -
        this.integral(point, Math.max(this.onset, point.time))
      : this.initialPosition + (time - this.onset) * this.initialRate;
    return nonnegative(position, "integrated source position");
  }

  private secondsForDistance(point: RatePoint | null, time: number, distance: number): number {
    if (distance <= 0) return 0;
    const rate = this.rateAt(point, time);
    const remaining = point ? Math.max(0, point.end - time) : 0;
    if (point && remaining > 0) {
      const slope = (point.to - point.from) / (point.end - point.time);
      const rampDistance = rate * remaining + (slope * remaining * remaining) / 2;
      if (distance <= rampDistance) {
        // This form avoids cancellation in the positive quadratic root, including
        // a falling ramp. All admitted rates remain strictly positive.
        const discriminant = Math.max(0, rate * rate + 2 * slope * distance);
        return (2 * distance) / (rate + Math.sqrt(discriminant));
      }
      return remaining + (distance - rampDistance) / point.to;
    }
    return distance / rate;
  }

  private contentEndTime(): number {
    if (this.sourceLimit === undefined) return Infinity;
    if (this.sourceLimit === this.initialPosition) return this.onset;
    let time = this.onset;
    let position = this.initialPosition;
    let point = this.pointAt(time);
    if (this.pruned && this.points[0]!.time > time) {
      point = this.points[0]!;
      time = point.time;
      position = point.position;
    }
    for (const next of this.points) {
      if (next.time <= time) continue;
      if (next.position >= this.sourceLimit)
        return nonnegative(
          time + this.secondsForDistance(point, time, this.sourceLimit - position),
          "source end",
        );
      time = next.time;
      position = next.position;
      point = next;
    }
    return nonnegative(
      time + this.secondsForDistance(point, time, this.sourceLimit - position),
      "source end",
    );
  }

  private authoredEndTime(): number {
    return Math.min(
      this.duration === null ? Infinity : this.onset + this.duration,
      this.explicitStopAt ?? Infinity,
    );
  }

  private endTime(): number {
    if (this.endedAt !== null) return Math.min(this.endedAt, this.authoredEndTime());
    return Math.min(this.authoredEndTime(), this.contentEndTime());
  }

  /**
   * Remaining authored emission time, including an explicit stop but excluding
   * the pitch-dependent prediction of a sample's natural end. Recreating a
   * virtual/native timeline must not turn that prediction into an authored cap.
   */
  authoredRemainingSeconds(audioTimeSeconds: number): number | null {
    nonnegative(audioTimeSeconds, "audio time");
    const end = this.authoredEndTime();
    const time = Math.max(this.onset, this.frozenAt ?? audioTimeSeconds);
    return Number.isFinite(end) ? Math.max(0, end - time) : null;
  }

  /**
   * Bound emission by an explicit audio-clock stop. This never lengthens an
   * authored stop or the currently predicted natural end. A stop before onset
   * yields no emitted content. Elapsed emission time continues after the stop,
   * while read() clamps source position and reports the original end marker.
   */
  stopAt(audioTimeSeconds: number): void {
    nonnegative(audioTimeSeconds, "stop time");
    this.explicitStopAt = Math.min(this.endTime(), Math.max(this.onset, audioTimeSeconds));
    if (this.frozenAt !== null) this.frozenCursor = this.readAt(this.frozenAt);
  }

  setRate(rate: number, audioTimeSeconds: number, smoothingSeconds = 0): void {
    positive(rate, "playback rate");
    nonnegative(audioTimeSeconds, "audio time");
    nonnegative(smoothingSeconds, "rate smoothing");
    const time = this.frozenAt ?? audioTimeSeconds;
    if (this.lastControlTime !== null && time < this.lastControlTime)
      throw new AudioEngineError(
        "VIRTUAL_CONTROL_TIME_REVERSED",
        "Rate controls must arrive in audio-clock order",
      );
    const end = this.endTime();
    if (end <= time) {
      this.endedAt = end;
      return;
    }
    const previous = this.pointAt(time);
    this.lastControlTime = time;
    if ((previous?.to ?? this.initialRate) === rate) return;
    const point: RatePoint = {
      time,
      position: this.positionAt(time),
      from: this.rateAt(previous, time),
      to: rate,
      end: nonnegative(time + smoothingSeconds, "rate ramp end"),
    };
    if (this.points.at(-1)?.time === time) this.points.pop();
    this.points.push(point);
    // Keep a preceding anchor for the five-second propagation window, with a
    // strict event-count cap. Older unavailable queries fail rather than inventing phase.
    while (
      this.points.length > 2 &&
      (this.points[1]!.time < time - HISTORY_SECONDS || this.points.length > MAX_HISTORY_POINTS)
    ) {
      this.points.shift();
      this.pruned = true;
    }
    if (this.frozenAt !== null) this.frozenCursor = this.readAt(this.frozenAt);
  }

  private readAt(time: number): VoiceCursor {
    const end = this.endTime();
    const effectiveTime = Math.max(this.onset, time);
    return {
      playheadSeconds: Math.min(this.sourceLimit ?? Infinity, this.positionAt(Math.min(time, end))),
      elapsedSinceEmissionSeconds: this.initialElapsed + Math.max(0, time - this.onset),
      remainingDurationSeconds: Number.isFinite(end) ? Math.max(0, end - effectiveTime) : null,
      ...(Number.isFinite(end)
        ? { emissionEndElapsedSeconds: this.initialElapsed + end - this.onset }
        : {}),
    };
  }

  read(audioTimeSeconds: number): VoiceCursor {
    nonnegative(audioTimeSeconds, "audio time");
    return this.frozenCursor ? { ...this.frozenCursor } : this.readAt(audioTimeSeconds);
  }

  rateState(audioTimeSeconds: number): VirtualVoiceRateState {
    nonnegative(audioTimeSeconds, "audio time");
    const time = this.frozenAt ?? audioTimeSeconds;
    const oldest = this.points[0];
    if (this.pruned && oldest && time > this.onset && time < oldest.time)
      throw new AudioEngineError(
        "VIRTUAL_HISTORY_UNAVAILABLE",
        "Requested rate predates retained rate history",
      );
    const point = this.pointAt(time);
    return {
      from: this.rateAt(point, time),
      to: point?.to ?? this.initialRate,
      remainingSeconds: point ? Math.max(0, point.end - time) : 0,
    };
  }

  currentRate(audioTimeSeconds: number): number {
    return this.rateState(audioTimeSeconds).from;
  }

  freeze(audioTimeSeconds: number): void {
    nonnegative(audioTimeSeconds, "freeze time");
    if (this.frozenAt !== null) return;
    this.frozenCursor = this.readAt(audioTimeSeconds);
    this.frozenAt = audioTimeSeconds;
    const end = this.endTime();
    if (end <= audioTimeSeconds) this.endedAt = end;
  }

  resume(audioTimeSeconds: number): void {
    nonnegative(audioTimeSeconds, "resume time");
    if (this.frozenAt === null) return;
    // A replacement AudioContext legitimately starts its sample clock at zero.
    // Rebase all anchors, including a negative shift, while preserving source time.
    const shift = audioTimeSeconds - this.frozenAt;
    this.onset += shift;
    for (const point of this.points) {
      point.time += shift;
      point.end += shift;
    }
    if (this.lastControlTime !== null) this.lastControlTime += shift;
    if (this.endedAt !== null) this.endedAt += shift;
    if (this.explicitStopAt !== null) this.explicitStopAt += shift;
    this.frozenAt = null;
    this.frozenCursor = null;
  }
}
