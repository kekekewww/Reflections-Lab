/** Live UI observation only. This module must never activate an AudioContext. */
export type LiveMonitorMode = "levels" | "spectrum" | "waveform" | "load";
export type LiveMonitorInput = "master-left" | "master-right";
export type LiveAudioMonitorState = "active" | "blocked" | "paused" | "unavailable" | "error";

export const LIVE_MONITOR_FFT_SIZE = 2048 as const;
export const LIVE_MONITOR_SOURCE_FFT_SIZE = 1024 as const;
export const LIVE_MONITOR_SOURCE_TRACK_LIMIT = 6 as const;
export const LIVE_MONITOR_MAX_SOURCE_CHANNELS = 8 as const;
export const LIVE_MONITOR_MAX_ANALYSER_NODES = 50 as const;
/** Total monitor-owned native nodes, including its analyser nodes. */
export const LIVE_MONITOR_MAX_TAP_NODES = 58 as const;
export const LIVE_MONITOR_SAMPLE_INTERVAL_MS = 1000 / 15;

export interface LiveAudioMonitorTrack {
  /** Master IDs are @master/L and @master/R; source IDs are the stable raw instance IDs. */
  id: string;
  label: string;
  kind: "output" | "source";
  /** null is unmeasured/warming; a measured digital zero is negative infinity. */
  peakDbfs: number | null;
  rmsDbfs: number | null;
  sourceId?: string;
  instanceId?: string;
  point: "postLimiterAndMute" | "contentPrePropagation";
}

/**
 * One reused frame and bounded reused arrays. Consumers needing historical data
 * must copy the relevant values; native observations are not experiment truth.
 */
export interface LiveAudioMonitorFrame {
  state: LiveAudioMonitorState;
  reason: string | null;
  sampleRateHz: number | null;
  fftSize: typeof LIVE_MONITOR_FFT_SIZE;
  waveform: Float32Array | null;
  spectrumDbfs: Float32Array | null;
  readonly tracks: readonly LiveAudioMonitorTrack[];
  displayInput: LiveMonitorInput;
  frequencyBinHz: number | null;
  sampledAtAudioTimeSeconds: number | null;
  analyserNodeCount: number;
  /** All owned tap nodes, including analyserNodeCount; never add the two counts. */
  tapNodeCount: number;
  spectrumNormalization: "nativeBlackmanFft;notPeakOrRmsMeter";
  sourceTrackLimit: typeof LIVE_MONITOR_SOURCE_TRACK_LIMIT;
  /** Native voices with a complete 1024-frame source window and measured meters. */
  sampledSourceVoices: number;
  /** Selected native source slots still waiting for a complete 1024-frame window. */
  warmingSourceVoices: number;
  unmeasuredVirtualVoices: number;
  unmeasuredPendingVoices: number;
  /** Other eligible native voices outside the six source slots, or invalid endpoints. */
  unmeasuredNativeVoices: number;
}

/** Engine-owned view; endpoint identity is a lifetime token, never a persistent domain ID. */
export interface LiveMonitorVoice {
  id: string;
  instanceId?: string;
  sourceId: string;
  label: string;
  /** The existing content envelope before propagation/spatialization; null has no native tap. */
  endpoint: AudioNode | null;
  /** Actual generator channels: one oscillator channel or the decoded sample's 1..8 channels. */
  channels: number;
  renderState: "native" | "virtual" | "pending";
  startedAtAudioTimeSeconds: number;
}

/** Read-only engine bridge. None of these getters may create or resume a context. */
export interface LiveAudioMonitorProvider {
  getContext(): BaseAudioContext | null;
  isEnabled(): boolean;
  isDisposed(): boolean;
  isPaused(): boolean;
  /** Existing final product output after limiter, safety, monitor level and mute. */
  getMasterOutput(): AudioNode | null;
  /** Stable engine Map order; include virtual/pending views so omitted voices remain visible. */
  forEachVoice(visit: (voice: LiveMonitorVoice) => void): void;
  getVoice(id: string): LiveMonitorVoice | null;
}

export interface LiveAudioMonitorOptions {
  /** Monotonic wall clock for a 15Hz UI read cache, not an audio/render clock. */
  nowMilliseconds?: () => number;
}

/** Manager lifetime and explicit-read API. */
export interface LiveAudioMonitorManager {
  read(mode: LiveMonitorMode, input?: LiveMonitorInput): LiveAudioMonitorFrame | null;
  /** Detach every monitor branch on load mode, hidden UI, or explicit release. */
  release(): void;
  /** Remove only the matching instance+endpoint generation during engine cleanup. */
  disposeVoice(id: string, endpoint: AudioNode): void;
  /** Detach old context branches before engine context/output replacement. */
  resetContext(): void;
  dispose(): void;
}

/*
 * Bounded graph design (this is not native validation evidence):
 * masterOutput -> unity Gain(explicit stereo,speakers) -> splitter(2)
 *              -> two Analyser(fftSize=2048,smoothing=0), outputs unconnected.
 * Each retained source slot -> splitter(actual 1..8 channels)
 *              -> channel Analyser(fftSize=1024,time-domain reads only).
 * Source RMS pools channel energies: sqrt(sum(x^2)/(1024*channels)); peak is
 * the greatest absolute channel sample. Stereo anti-phase is never mono-folded.
 * Six eight-channel sources plus master own 50 analysers / 58 total nodes.
 * All waveform/frequency buffers are allocated once on manager construction;
 * native branches are created only by an eligible explicit live read.
 * Paused/suspended reads detach branches and expose null metrics/arrays;
 * resuming requires fresh native warmup windows, not stale cached values.
 * Attach windows must cover 2048/master or 1024/source real audio frames before
 * reporting data. Unfilled native buffers are unavailable, never measured zero.
 *
 * W3C Web Audio REC 2021 section 1.8 permits unconnected Analyser outputs.
 * Section 1.8.6 specifies Blackman window, 1/N DFT and 20*log10 magnitude;
 * these raw FFT bins are not calibrated peak/RMS meters or SPL.
 * https://www.w3.org/TR/2021/REC-webaudio-20210617/#AnalyserNode
 * https://www.w3.org/TR/2021/REC-webaudio-20210617/#fft-windowing-and-smoothing-over-time
 */

type NativeSamples = ReturnType<typeof makeSamples>;

function makeSamples(length: number) {
  return new Float32Array(length);
}

interface SourceSlot {
  id: string | null;
  endpoint: AudioNode | null;
  splitter: ChannelSplitterNode | null;
  channels: number;
  attachedAt: number;
  sampled: boolean;
  readonly analysers: (AnalyserNode | null)[];
  readonly buffers: NativeSamples[];
  readonly track: LiveAudioMonitorTrack;
}

function clearMeter(track: LiveAudioMonitorTrack): void {
  track.peakDbfs = null;
  track.rmsDbfs = null;
}

function meterFromChannels(
  track: LiveAudioMonitorTrack,
  buffers: readonly NativeSamples[],
  channels: number,
  frames: number,
): void {
  let peak = 0;
  let squares = 0;
  for (let channel = 0; channel < channels; channel++) {
    const samples = buffers[channel]!;
    for (let frame = 0; frame < frames; frame++) {
      const value = samples[frame]!;
      if (!Number.isFinite(value)) throw new Error("Non-finite native time-domain sample");
      peak = Math.max(peak, Math.abs(value));
      squares += value * value;
    }
  }
  track.peakDbfs = peak === 0 ? -Infinity : 20 * Math.log10(peak);
  track.rmsDbfs = squares === 0 ? -Infinity : 10 * Math.log10(squares / (frames * channels));
}

/**
 * Bounded UI observer of existing native nodes. Construction allocates only the
 * reusable JS buffers; read() is the sole native-branch creation entry point.
 * No method creates, resumes, suspends, or closes an AudioContext.
 */
export class LiveAudioMonitor implements LiveAudioMonitorManager {
  private readonly nowMilliseconds: () => number;
  private readonly masterWaveforms = [makeSamples(2048), makeSamples(2048)] as const;
  private readonly masterSpectra = [makeSamples(1024), makeSamples(1024)] as const;
  private readonly masterAnalysers: (AnalyserNode | null)[] = [null, null];
  private readonly spectrumValid = [false, false];
  private readonly masterTracks: readonly [LiveAudioMonitorTrack, LiveAudioMonitorTrack] = [
    {
      id: "@master/L",
      label: "Master L",
      kind: "output",
      peakDbfs: null,
      rmsDbfs: null,
      point: "postLimiterAndMute",
    },
    {
      id: "@master/R",
      label: "Master R",
      kind: "output",
      peakDbfs: null,
      rmsDbfs: null,
      point: "postLimiterAndMute",
    },
  ];
  private readonly sourceSlots: SourceSlot[] = Array.from(
    { length: LIVE_MONITOR_SOURCE_TRACK_LIMIT },
    () => ({
      id: null,
      endpoint: null,
      splitter: null,
      channels: 0,
      attachedAt: 0,
      sampled: false,
      analysers: Array<AnalyserNode | null>(LIVE_MONITOR_MAX_SOURCE_CHANNELS).fill(null),
      buffers: Array.from({ length: LIVE_MONITOR_MAX_SOURCE_CHANNELS }, () => makeSamples(1024)),
      track: {
        id: "",
        label: "",
        kind: "source",
        peakDbfs: null,
        rmsDbfs: null,
        point: "contentPrePropagation",
      },
    }),
  );
  private readonly tracks: LiveAudioMonitorTrack[];
  private readonly frame: LiveAudioMonitorFrame;
  private context: BaseAudioContext | null = null;
  private masterEndpoint: AudioNode | null = null;
  private masterGain: GainNode | null = null;
  private masterSplitter: ChannelSplitterNode | null = null;
  private masterAttachedAt = 0;
  private masterSampled = false;
  private lastSampleWallTime = -Infinity;
  private lastObservedAudioTime = -Infinity;
  private disposed = false;
  private selectingSources = false;
  private observedAudioTime = 0;
  private nativeVoiceCount = 0;

  constructor(
    private readonly provider: LiveAudioMonitorProvider,
    options: LiveAudioMonitorOptions = {},
  ) {
    this.nowMilliseconds = options.nowMilliseconds ?? (() => performance.now());
    // Reserve the bounded eight-track array once, then reuse its identity.
    this.tracks = [
      this.masterTracks[0],
      this.masterTracks[1],
      ...this.sourceSlots.map((slot) => slot.track),
    ];
    this.tracks.length = 2;
    this.frame = {
      state: "unavailable",
      reason: null,
      sampleRateHz: null,
      fftSize: LIVE_MONITOR_FFT_SIZE,
      waveform: null,
      spectrumDbfs: null,
      tracks: this.tracks,
      displayInput: "master-left",
      frequencyBinHz: null,
      sampledAtAudioTimeSeconds: null,
      analyserNodeCount: 0,
      tapNodeCount: 0,
      spectrumNormalization: "nativeBlackmanFft;notPeakOrRmsMeter",
      sourceTrackLimit: LIVE_MONITOR_SOURCE_TRACK_LIMIT,
      sampledSourceVoices: 0,
      warmingSourceVoices: 0,
      unmeasuredVirtualVoices: 0,
      unmeasuredPendingVoices: 0,
      unmeasuredNativeVoices: 0,
    };
  }

  read(
    mode: LiveMonitorMode,
    input: LiveMonitorInput = "master-left",
  ): LiveAudioMonitorFrame | null {
    if (this.disposed) return null;
    if (mode === "load") {
      this.release();
      return null;
    }
    try {
      if (this.provider.isDisposed()) {
        this.dispose();
        return null;
      }
      if (
        (mode !== "levels" && mode !== "spectrum" && mode !== "waveform") ||
        (input !== "master-left" && input !== "master-right")
      ) {
        throw new Error("Invalid live monitor mode or input");
      }
      this.frame.displayInput = input;
      const context = this.provider.getContext();
      const state = context ? String(context.state) : "unavailable";
      if (!context) return this.unavailable("blocked", "Audio context has not been enabled", null);
      if (
        !Number.isFinite(context.sampleRate) ||
        context.sampleRate <= 0 ||
        !Number.isFinite(context.currentTime) ||
        context.currentTime < 0
      ) {
        throw new Error("Invalid native audio clock");
      }
      if (typeof Reflect.get(context, "startRendering") === "function") {
        return this.unavailable(
          "unavailable",
          "Offline contexts are not live monitor inputs",
          context,
        );
      }
      if (state === "closed")
        return this.unavailable("unavailable", "Audio context is closed", context);
      if (this.provider.isPaused() || state === "suspended" || state === "interrupted") {
        return this.unavailable("paused", "Audio context is paused", context);
      }
      if (!this.provider.isEnabled())
        return this.unavailable("blocked", "Audio engine is not enabled", context);
      const endpoint = this.provider.getMasterOutput();
      if (!endpoint)
        return this.unavailable("unavailable", "Native master output is unavailable", context);
      if (
        this.context !== context ||
        this.masterEndpoint !== endpoint ||
        context.currentTime < this.lastObservedAudioTime
      ) {
        this.release();
        this.attachMaster(context, endpoint);
      }
      this.observedAudioTime = context.currentTime;
      this.lastObservedAudioTime = context.currentTime;
      this.reconcileSources();
      this.frame.state = "active";
      this.frame.reason = null;
      this.frame.sampleRateHz = context.sampleRate;
      this.frame.frequencyBinHz = context.sampleRate / LIVE_MONITOR_FFT_SIZE;
      const wallTime = this.nowMilliseconds();
      if (!Number.isFinite(wallTime)) throw new Error("Invalid live monitor wall clock");
      if (
        wallTime < this.lastSampleWallTime ||
        wallTime - this.lastSampleWallTime >= LIVE_MONITOR_SAMPLE_INTERVAL_MS
      ) {
        this.sample(context.currentTime, mode, input);
        this.lastSampleWallTime = wallTime;
      }
      this.updateTracksAndCounts();
      const channel = input === "master-left" ? 0 : 1;
      this.frame.waveform =
        mode === "waveform" && this.masterSampled ? this.masterWaveforms[channel] : null;
      this.frame.spectrumDbfs =
        mode === "spectrum" && this.spectrumValid[channel] ? this.masterSpectra[channel] : null;
      if (!this.masterSampled || (mode === "spectrum" && !this.spectrumValid[channel])) {
        this.frame.reason = "ANALYSER_WARMUP";
      }
      return this.frame;
    } catch (error) {
      this.release();
      this.frame.state = "error";
      this.frame.reason = error instanceof Error ? error.message : String(error);
      return this.frame;
    }
  }

  /** Release only owned connections; the existing audible graph is untouched. */
  release(): void {
    for (const slot of this.sourceSlots) this.detachSource(slot);
    if (this.masterEndpoint && this.masterGain)
      this.disconnect(this.masterEndpoint, this.masterGain);
    for (let channel = 0; channel < 2; channel++) {
      const analyser = this.masterAnalysers[channel];
      if (analyser) this.disconnect(analyser);
      this.masterAnalysers[channel] = null;
      this.spectrumValid[channel] = false;
      clearMeter(this.masterTracks[channel]!);
    }
    if (this.masterSplitter) this.disconnect(this.masterSplitter);
    if (this.masterGain) this.disconnect(this.masterGain);
    this.context = null;
    this.masterEndpoint = null;
    this.masterGain = null;
    this.masterSplitter = null;
    this.masterSampled = false;
    this.lastSampleWallTime = -Infinity;
    this.lastObservedAudioTime = -Infinity;
    this.frame.waveform = null;
    this.frame.spectrumDbfs = null;
    this.frame.sampledAtAudioTimeSeconds = null;
    this.frame.sampledSourceVoices = 0;
    this.frame.warmingSourceVoices = 0;
    this.frame.unmeasuredNativeVoices = 0;
    this.frame.unmeasuredPendingVoices = 0;
    this.frame.unmeasuredVirtualVoices = 0;
    this.nativeVoiceCount = 0;
    this.tracks.length = 2;
    this.updateNodeCounts();
  }

  disposeVoice(id: string, endpoint: AudioNode): void {
    for (const slot of this.sourceSlots) {
      if (slot.id === id && slot.endpoint === endpoint) {
        this.detachSource(slot);
      }
    }
    this.updateTracksAndCounts();
  }

  resetContext(): void {
    this.release();
  }

  dispose(): void {
    if (this.disposed) return;
    this.release();
    this.disposed = true;
  }

  private unavailable(
    state: LiveAudioMonitorState,
    reason: string,
    context: BaseAudioContext | null,
  ): LiveAudioMonitorFrame {
    this.release();
    this.frame.state = state;
    this.frame.reason = reason;
    this.frame.sampleRateHz = context?.sampleRate ?? null;
    this.frame.frequencyBinHz = context ? context.sampleRate / LIVE_MONITOR_FFT_SIZE : null;
    this.observedAudioTime = context?.currentTime ?? 0;
    this.selectingSources = false;
    this.provider.forEachVoice(this.visitVoice);
    this.frame.unmeasuredNativeVoices = this.nativeVoiceCount;
    return this.frame;
  }

  private attachMaster(context: BaseAudioContext, endpoint: AudioNode): void {
    this.context = context;
    this.masterEndpoint = endpoint;
    // Assign immediately after each allocation, so a later native exception is
    // rolled back by read() without leaking an already-created partial graph.
    const gain = context.createGain();
    this.masterGain = gain;
    gain.gain.value = 1;
    gain.channelCount = 2;
    gain.channelCountMode = "explicit";
    gain.channelInterpretation = "speakers";
    const splitter = context.createChannelSplitter(2);
    this.masterSplitter = splitter;
    splitter.channelCount = 2;
    splitter.channelCountMode = "explicit";
    splitter.channelInterpretation = "discrete";
    for (let channel = 0; channel < 2; channel++) {
      const analyser = context.createAnalyser();
      this.masterAnalysers[channel] = analyser;
      analyser.fftSize = LIVE_MONITOR_FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      splitter.connect(analyser, channel);
    }
    gain.connect(splitter);
    endpoint.connect(gain);
    this.masterAttachedAt = context.currentTime;
  }

  private validNativeVoice(voice: LiveMonitorVoice): boolean {
    return (
      voice.renderState === "native" &&
      voice.endpoint !== null &&
      voice.endpoint.context === this.context &&
      Number.isInteger(voice.channels) &&
      voice.channels >= 1 &&
      voice.channels <= LIVE_MONITOR_MAX_SOURCE_CHANNELS &&
      Number.isFinite(voice.startedAtAudioTimeSeconds) &&
      voice.startedAtAudioTimeSeconds <= this.observedAudioTime
    );
  }

  private reconcileSources(): void {
    // Retain live generations before filling vacancies in provider Map order.
    for (const slot of this.sourceSlots) {
      if (slot.id === null) continue;
      const voice = this.provider.getVoice(slot.id);
      if (
        !voice ||
        !this.validNativeVoice(voice) ||
        voice.endpoint !== slot.endpoint ||
        voice.channels !== slot.channels
      ) {
        this.detachSource(slot);
      } else this.updateSourceTrack(slot, voice);
    }
    this.nativeVoiceCount = 0;
    this.frame.unmeasuredPendingVoices = 0;
    this.frame.unmeasuredVirtualVoices = 0;
    this.selectingSources = true;
    try {
      this.provider.forEachVoice(this.visitVoice);
    } finally {
      this.selectingSources = false;
    }
  }

  private readonly visitVoice = (voice: LiveMonitorVoice): void => {
    if (voice.renderState === "virtual") {
      this.frame.unmeasuredVirtualVoices++;
      return;
    }
    if (
      voice.renderState === "pending" ||
      voice.startedAtAudioTimeSeconds > this.observedAudioTime
    ) {
      this.frame.unmeasuredPendingVoices++;
      return;
    }
    this.nativeVoiceCount++;
    if (!this.selectingSources || !this.validNativeVoice(voice)) return;
    let empty: SourceSlot | null = null;
    for (const slot of this.sourceSlots) {
      if (slot.id === voice.id) return;
      if (empty === null && slot.id === null) empty = slot;
    }
    if (empty) this.attachSource(empty, voice);
  };

  private updateSourceTrack(slot: SourceSlot, voice: LiveMonitorVoice): void {
    slot.track.id = voice.id;
    slot.track.label = voice.label;
    slot.track.sourceId = voice.sourceId;
    slot.track.instanceId = voice.instanceId ?? voice.id;
  }

  private attachSource(slot: SourceSlot, voice: LiveMonitorVoice): void {
    const context = this.context!;
    const endpoint = voice.endpoint!;
    slot.id = voice.id;
    slot.endpoint = endpoint;
    slot.channels = voice.channels;
    this.updateSourceTrack(slot, voice);
    const splitter = context.createChannelSplitter(voice.channels);
    slot.splitter = splitter;
    splitter.channelCount = voice.channels;
    splitter.channelCountMode = "explicit";
    splitter.channelInterpretation = "discrete";
    for (let channel = 0; channel < voice.channels; channel++) {
      const analyser = context.createAnalyser();
      slot.analysers[channel] = analyser;
      analyser.fftSize = LIVE_MONITOR_SOURCE_FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      splitter.connect(analyser, channel);
    }
    endpoint.connect(splitter);
    slot.attachedAt = context.currentTime;
    slot.sampled = false;
    clearMeter(slot.track);
  }

  private detachSource(slot: SourceSlot): void {
    if (slot.endpoint && slot.splitter) this.disconnect(slot.endpoint, slot.splitter);
    if (slot.splitter) this.disconnect(slot.splitter);
    for (let channel = 0; channel < LIVE_MONITOR_MAX_SOURCE_CHANNELS; channel++) {
      const analyser = slot.analysers[channel];
      if (analyser) this.disconnect(analyser);
      slot.analysers[channel] = null;
    }
    slot.id = null;
    slot.endpoint = null;
    slot.splitter = null;
    slot.channels = 0;
    slot.sampled = false;
    clearMeter(slot.track);
  }

  private sample(audioTime: number, mode: LiveMonitorMode, input: LiveMonitorInput): void {
    const sampleRate = this.context!.sampleRate;
    this.spectrumValid[0] = false;
    this.spectrumValid[1] = false;
    if (audioTime - this.masterAttachedAt >= LIVE_MONITOR_FFT_SIZE / sampleRate) {
      for (let channel = 0; channel < 2; channel++) {
        this.masterAnalysers[channel]!.getFloatTimeDomainData(this.masterWaveforms[channel]!);
        // Use a one-channel view of the existing pair, without allocating views.
        this.measureMaster(channel);
      }
      this.masterSampled = true;
      if (mode === "spectrum") {
        const channel = input === "master-left" ? 0 : 1;
        const bins = this.masterSpectra[channel];
        this.masterAnalysers[channel]!.getFloatFrequencyData(bins);
        for (let bin = 0; bin < bins.length; bin++) {
          const value = bins[bin]!;
          if (!Number.isFinite(value) && value !== -Infinity)
            throw new Error("Invalid native frequency-domain sample");
        }
        this.spectrumValid[channel] = true;
      }
    }
    for (const slot of this.sourceSlots) {
      if (
        slot.id === null ||
        audioTime - slot.attachedAt < LIVE_MONITOR_SOURCE_FFT_SIZE / sampleRate
      )
        continue;
      for (let channel = 0; channel < slot.channels; channel++) {
        slot.analysers[channel]!.getFloatTimeDomainData(slot.buffers[channel]!);
      }
      meterFromChannels(slot.track, slot.buffers, slot.channels, LIVE_MONITOR_SOURCE_FFT_SIZE);
      slot.sampled = true;
    }
    this.frame.sampledAtAudioTimeSeconds =
      this.masterSampled || this.sourceSlots.some(this.isSampledSlot) ? audioTime : null;
  }

  private readonly isSampledSlot = (slot: SourceSlot): boolean => slot.id !== null && slot.sampled;

  private measureMaster(channel: number): void {
    const samples = this.masterWaveforms[channel]!;
    let peak = 0;
    let squares = 0;
    for (let frame = 0; frame < samples.length; frame++) {
      const value = samples[frame]!;
      if (!Number.isFinite(value)) throw new Error("Non-finite native time-domain sample");
      peak = Math.max(peak, Math.abs(value));
      squares += value * value;
    }
    const track = this.masterTracks[channel]!;
    track.peakDbfs = peak === 0 ? -Infinity : 20 * Math.log10(peak);
    track.rmsDbfs = squares === 0 ? -Infinity : 10 * Math.log10(squares / samples.length);
  }

  private updateTracksAndCounts(): void {
    this.tracks.length = 2;
    let selected = 0;
    let sampled = 0;
    for (const slot of this.sourceSlots) {
      if (slot.id === null) continue;
      this.tracks.push(slot.track);
      selected++;
      if (slot.sampled) sampled++;
    }
    this.frame.sampledSourceVoices = sampled;
    this.frame.warmingSourceVoices = selected - sampled;
    this.frame.unmeasuredNativeVoices = Math.max(0, this.nativeVoiceCount - selected);
    this.updateNodeCounts();
  }

  private updateNodeCounts(): void {
    let analysers = 0;
    let nodes = this.masterGain ? 1 : 0;
    if (this.masterSplitter) nodes++;
    for (const analyser of this.masterAnalysers) if (analyser) analysers++;
    for (const slot of this.sourceSlots) {
      if (slot.splitter) nodes++;
      for (const analyser of slot.analysers) if (analyser) analysers++;
    }
    this.frame.analyserNodeCount = analysers;
    this.frame.tapNodeCount = nodes + analysers;
  }

  private disconnect(node: AudioNode, destination?: AudioNode): void {
    // Native graph cleanup can race engine cleanup/closed contexts. Each owned
    // edge is attempted independently; never disconnect a product node globally.
    try {
      if (destination) node.disconnect(destination);
      else node.disconnect();
    } catch {
      /* Already detached or context closed. Continue releasing siblings. */
    }
  }
}
