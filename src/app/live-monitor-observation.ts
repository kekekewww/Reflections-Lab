import type {
  LiveAudioMonitorFrame,
  LiveMonitorInput,
  LiveMonitorMode,
} from "../audio/live-monitor.js";

/** Cached normal-UI observations. fftSize is the selected logical Master analyser's actual FFT size. */
export interface TopMonitorObservationSnapshot {
  readonly mode: LiveMonitorMode | null;
  readonly input: LiveMonitorInput | null;
  readonly visible: boolean;
  readonly observed: boolean;
  readonly normalReadAtPerformanceMs: number | null;
  readonly sampledAtAudioTimeSeconds: number | null;
  readonly sampleRateHz: number | null;
  readonly fftSize: number | null;
  readonly analyserNodeCount: number | null;
  readonly tapNodeCount: number | null;
  /** Native source track IDs (voice instance IDs), never labels or logical sourceId aliases. */
  readonly sourceIDs: readonly string[];
  readonly sampledSourceVoices: number | null;
  readonly warmingSourceVoices: number | null;
  readonly unmeasuredVirtualVoices: number | null;
  readonly unmeasuredPendingVoices: number | null;
  readonly unmeasuredNativeVoices: number | null;
}

type MutableSnapshot = {
  -readonly [Key in keyof TopMonitorObservationSnapshot]: TopMonitorObservationSnapshot[Key];
};
function nonnegative(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}
function count(value: number): number | null {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function actualFftSize(value: number): number | null {
  return Number.isSafeInteger(value) && value >= 32 && value <= 32768 && (value & (value - 1)) === 0
    ? value
    : null;
}

/**
 * Records only an already completed normal UI read. No clock, provider, native
 * audio methods, sample buffers or engine frames are retained by this cache.
 */
export class TopMonitorObservationCache {
  private readonly sourceIDs: string[] = [];
  private readonly values: MutableSnapshot = {
    mode: null,
    input: null,
    visible: false,
    observed: false,
    normalReadAtPerformanceMs: null,
    sampledAtAudioTimeSeconds: null,
    sampleRateHz: null,
    fftSize: null,
    analyserNodeCount: null,
    tapNodeCount: null,
    sourceIDs: this.sourceIDs,
    sampledSourceVoices: null,
    warmingSourceVoices: null,
    unmeasuredVirtualVoices: null,
    unmeasuredPendingVoices: null,
    unmeasuredNativeVoices: null,
  };

  recordNormalRead(
    mode: LiveMonitorMode,
    input: LiveMonitorInput,
    atPerformanceMs: number,
    frame: LiveAudioMonitorFrame | null,
  ): void {
    this.clearNative();
    this.values.mode = mode;
    this.values.input = input;
    this.values.visible = true;
    this.values.normalReadAtPerformanceMs = nonnegative(atPerformanceMs);
    if (mode === "load" || !frame || frame.state !== "active") return;
    this.values.sampledAtAudioTimeSeconds = nonnegative(frame.sampledAtAudioTimeSeconds);
    this.values.sampleRateHz =
      Number.isFinite(frame.sampleRateHz) && frame.sampleRateHz !== null && frame.sampleRateHz > 0
        ? frame.sampleRateHz
        : null;
    this.values.fftSize = actualFftSize(frame.fftSize);
    this.values.analyserNodeCount = count(frame.analyserNodeCount);
    this.values.tapNodeCount = count(frame.tapNodeCount);
    this.values.sampledSourceVoices = count(frame.sampledSourceVoices);
    this.values.warmingSourceVoices = count(frame.warmingSourceVoices);
    this.values.unmeasuredVirtualVoices = count(frame.unmeasuredVirtualVoices);
    this.values.unmeasuredPendingVoices = count(frame.unmeasuredPendingVoices);
    this.values.unmeasuredNativeVoices = count(frame.unmeasuredNativeVoices);
    this.values.observed =
      this.values.sampledAtAudioTimeSeconds !== null && frame.reason !== "ANALYSER_WARMUP";
    // Native monitor contract: two master tracks plus at most six source slots.
    for (let index = 0; index < Math.min(8, frame.tracks.length); index++) {
      const track = frame.tracks[index]!;
      if (track.kind === "source" && track.id.length > 0 && !this.sourceIDs.includes(track.id)) {
        this.sourceIDs.push(track.id);
        if (this.sourceIDs.length === 6) break;
      }
    }
  }

  /** Last requested view and read timestamp remain available only to identify stale data. */
  release(): void {
    this.clearNative();
    this.values.visible = false;
  }

  /** Plain detached values only. Age is computed by the caller from its existing end timestamp. */
  snapshot(): TopMonitorObservationSnapshot {
    return { ...this.values, sourceIDs: this.sourceIDs.slice() };
  }

  private clearNative(): void {
    this.values.observed = false;
    this.values.sampledAtAudioTimeSeconds = null;
    this.values.sampleRateHz = null;
    this.values.fftSize = null;
    this.values.analyserNodeCount = null;
    this.values.tapNodeCount = null;
    this.values.sampledSourceVoices = null;
    this.values.warmingSourceVoices = null;
    this.values.unmeasuredVirtualVoices = null;
    this.values.unmeasuredPendingVoices = null;
    this.values.unmeasuredNativeVoices = null;
    this.sourceIDs.length = 0;
  }
}
