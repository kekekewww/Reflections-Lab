import { AudioAssetStore } from "./assets.js";
import type {
  AudioAssetLease,
  AssetEvictionResult,
  AssetResidencySnapshot,
} from "./asset-leases.js";
import type { AudioOscillatorModel } from "./content-model.js";
import {
  LiveAudioMonitor,
  type LiveAudioMonitorFrame,
  type LiveMonitorInput,
  type LiveMonitorMode,
  type LiveMonitorVoice,
} from "./live-monitor.js";
import { NativeSourceCursor } from "./native-source-cursor.js";
import { VirtualVoiceTimeline } from "./virtual-timeline.js";
import { selectNativeVoices, type NativeVoicePolicyOptions } from "./virtual-policy.js";
export { DEFAULT_NATIVE_VOICE_POLICY } from "./virtual-policy.js";

export interface AudioEngineConfiguration extends AudioEngineOptions {
  /** Explicit candidate policy. false/omitted retains the admission reference. */
  virtualization?: NativeVoicePolicyOptions | false;
  /** Explicit recording content pin; missing legacy pins use nativeReference. */
  oscillatorModel?: AudioOscillatorModel;
}
interface VirtualVoice {
  input: VoiceInput;
  timeline: VirtualVoiceTimeline;
  renderCursor: NativeSourceCursor | null;
  sampleOriginSeconds: number;
  nativeEndAudioTime: number;
  carrier?: PlayingVoice;
  virtualSince: number;
  frozenAt: number | null;
  startsAt: number;
}

import { finite, makeBudget, smooth, smoothTarget, unit, vector } from "./control.js";
import {
  AUDIO_LOOKAHEAD_SECONDS,
  isAudioBufferPreset,
  readStoredAudioBufferPreset,
  type AudioBufferPreset,
} from "./buffer-preset.js";
import {
  LISTENER_TURN_RAMP_SECONDS,
  PathRoute,
  ROUTE_DIRECTION_RAMP_SECONDS,
  ROUTE_FADE_SECONDS,
  ROUTE_RETIRE_TAIL_SECONDS,
  validateFrame,
} from "./routes.js";
import { LateReverbBus } from "./late-reverb.js";
import { DeterministicMixInput, type DeterministicMixHandle } from "./deterministic-mix.js";
import { MAX_MONITOR_GAIN } from "./monitor-level.js";
import { outputSafetyCurve } from "./output-safety.js";
import {
  AudioDiagnostics,
  type AcousticDeliveryObservation,
  type AudioDiagnosticsSnapshot,
  type AudioFrameDecision,
} from "./diagnostics.js";
import {
  AudioEngineError,
  type AcousticFrame,
  type AudioAssetDescriptor,
  type AudioAssetMetadata,
  type AudioAssetBankEntry,
  type AudioBudget,
  type AudioEngineOptions,
  type AudioTelemetry,
  type AudioPauseClockAudit,
  type ListenerPose,
  type LateReverbSettings,
  type SoundGenerator,
  type VoiceAdmission,
  type VoiceInput,
  type VoiceUpdate,
  type VoiceCursor,
  type VoiceRestoreCursor,
} from "./types.js";

interface PlayingVoice {
  input: VoiceInput;
  allocationSequence: number;
  source: AudioBufferSourceNode | OscillatorNode;
  contentGain: GainNode;
  envelope: GainNode;
  renderGate: GainNode | null;
  rawMixHandle: DeterministicMixHandle | null;
  renderedSince: number;
  contentFilter: BiquadFilterNode | null;
  routes: Map<string, PathRoute>;
  lateRoute: PathRoute | null;
  active: boolean;
  sourceStopped: boolean;
  scheduledStopAudioTime: number | null;
  nativeEofPending: boolean;
  nativeEndedDeliveryAudioTime: number | null;
  nativeEndedFlushAudioTime: number | null;
  startedAudioTime: number;
  durationSeconds: number | null;
  sourceEndAudioTime: number;
  elapsedBeforeStartSeconds: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  cleanupAudioTime: number | null;
  internalArrival: boolean;
  restoredCursor: boolean;
  historyIncomplete: boolean;
  virtualized: boolean;
  timeline: VirtualVoiceTimeline | null;
  renderCursor: NativeSourceCursor | null;
  sampleOriginSeconds: number;
  rateHistory: { time: number; position: number; from: number; to: number; end: number }[];
}
interface FrozenVoice {
  input: VoiceInput;
  historyIncomplete: boolean;
  rateState: { from: number; to: number; remainingSeconds: number };
  authoredRemainingSeconds: number | null;
  logicalRateState: { from: number; to: number; remainingSeconds: number };
  renderPositionSeconds: number;
  sampleOriginSeconds: number;
  freezeAudioTime: number;
  renderClock: { sampleRate: number; quantumFrames: number } | null;
  positionSeconds: number;
  elapsedSinceEmissionSeconds: number;
  emissionEndElapsedSeconds: number | undefined;
  remainingDurationSeconds: number | null;
  ended: boolean;
  internalArrival: boolean;
  frame: AcousticFrame | undefined;
  arrivals: {
    frame: AcousticFrame;
    positionSeconds: number;
    delaySeconds: number;
    durationSeconds: number;
  }[];
}
interface VoiceStart {
  positionSeconds?: number;
  durationSeconds?: number | null;
  internalArrival?: boolean;
  elapsedSinceEmissionSeconds?: number;
  resumeRate?: { from: number; to: number; remainingSeconds: number };
  historyIncomplete?: boolean;
  promotion?: boolean;
  audioTimeSeconds?: number;
  /** Authored lifetime, independent of a derived natural sample exhaustion. */
  authoredDurationSeconds?: number | null;
  logicalPositionSeconds?: number;
  logicalRateState?: { from: number; to: number; remainingSeconds: number };
  sampleOriginSeconds?: number;
}

/** Native Web Audio source graph. No geometry/AI/network runs on its render thread. */
export class AudioEngine {
  private readonly diagnostics: AudioDiagnostics;
  private context: BaseAudioContext | null;
  private ownsContext: boolean;
  private assets: AudioAssetStore | null = null;
  private rawMix: GainNode | null = null;
  private simulatedMix: GainNode | null = null;
  private rawMixInput: DeterministicMixInput | null = null;
  private simulatedMixInput: DeterministicMixInput | null = null;
  private runGain: GainNode | null = null;
  private headroom: GainNode | null = null;
  private monitor: GainNode | null = null;
  private muteGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private safetyClip: WaveShaperNode | null = null;
  private liveMonitorOutput: AudioNode | null = null;
  private liveMonitor: LiveAudioMonitor | null = null;
  private liveMonitorViews: WeakMap<object, LiveMonitorVoice> | null = null;
  private readonly frames = new Map<string, AcousticFrame>();
  private readonly voices = new Map<string, PlayingVoice>();
  private readonly virtualVoices = new Map<string, VirtualVoice>();
  /** Outgoing native tails retain a separately bounded logical cursor until a queue slot opens. */
  private readonly demotingVoices = new Map<string, VirtualVoice>();
  private servicingNativeVoices = false;
  private readonly nativePolicy: NativeVoicePolicyOptions | null;
  private readonly seekableOscillators: boolean;
  private readonly preciseNativeCursor: boolean;
  private readonly nativeCarrierMode: boolean;
  private readonly nativeGraphBudget: number;
  private readonly internalArrivalGraphBudget: number;
  private readonly nativeGraphTotalBudget: number;
  private readonly nativeCarrierBudget: number;
  private readonly carriers = new Set<PlayingVoice>();
  private nativeCarrierPeak = 0;
  private nativeSourceSequence = 0;
  private phaseAnchor: GainNode | null = null;
  private carrierContextPause = false;
  private virtualPromotions = 0;
  private virtualDemotions = 0;
  private virtualExpirations = 0;
  private readonly retiring = new Set<PlayingVoice>();
  private readonly pendingOnResume = new Map<string, VoiceInput>();
  private readonly frozenOnResume = new Map<string, FrozenVoice>();
  private pauseCompletion: Promise<void> | null = null;
  private arrivalSequence = 0;
  private readonly restoredInstances = new Set<string>();
  private readonly retiredRoutes = new Set<PathRoute>();
  private readonly retiredLateRoutes = new Set<PathRoute>();
  private readonly offlineRouteDeadlines = new Map<PathRoute, number>();
  private lateBus: LateReverbBus | null = null;
  private reverbSettings: LateReverbSettings = {
    enabled: false,
    decaySeconds: 1.2,
    wetGain: 0.15,
    seed: 1,
  };
  private readonly routeTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly budget: AudioBudget;
  private enabled = false;
  private disposed = false;
  private muted = true;
  private paused = false;
  private draining = false;
  private monitorMode: "raw" | "simulated" = "simulated";
  private monitorLevel: number;
  private simulationEpoch = 0;
  private audioEpoch = 0;
  private listenerPosition: [number, number, number] = [0, 0, 0];
  private pauseSerial = 0;
  private transportSerial = 0;
  private pauseBoundary: number | null = null;
  private pauseClockSkew: number | null = null;
  private pauseClockAudit: AudioPauseClockAudit | null = null;
  private droppedVoices = 0;
  private stolenVoices = 0;
  private droppedPaths = 0;
  private staleFrames = 0;
  private lateEvents = 0;
  private staleVoiceAdmissions = 0;
  private bufferPreset: AudioBufferPreset;
  private rebuilding = false;
  private restartFailed = false;
  private lastError: string | null = null;
  private maximumFilterDelay = 0;
  private readonly options: AudioEngineConfiguration;
  private auditionEngine: AudioEngine | null = null;
  private readonly auditionContexts = new Set<AudioEngine>();
  private readonly auditionStops = new Map<AudioEngine, Promise<void>>();
  private disposalCompletion: Promise<void> | null = null;
  private readonly auditionAssetLeases = new Map<AudioEngine, Map<string, AudioAssetLease>>();
  private auditionSequence = 0;

  constructor(options: AudioEngineConfiguration = {}) {
    this.diagnostics = new AudioDiagnostics(
      options.diagnosticsClockMs,
      options.diagnosticsEnabled ?? true,
    );
    this.options = options;
    this.bufferPreset = options.bufferPreset ?? readStoredAudioBufferPreset();
    this.budget = makeBudget(options.budget);
    this.nativePolicy = options.virtualization ? { ...options.virtualization } : null;
    if (
      options.oscillatorModel !== undefined &&
      ![
        "nativeReference",
        "seekableHarmonics",
        "seekableNativeClock",
        "nativeCarrierRoutes",
      ].includes(options.oscillatorModel)
    )
      throw new AudioEngineError("AUDIO_CONTENT_MODEL_PIN", "Unsupported oscillator model");
    if (
      this.nativePolicy &&
      options.oscillatorModel !== undefined &&
      options.oscillatorModel !== "seekableNativeClock" &&
      options.oscillatorModel !== "nativeReference" &&
      options.oscillatorModel !== "nativeCarrierRoutes"
    )
      throw new AudioEngineError(
        "AUDIO_CONTENT_MODEL_PIN",
        "Virtualization requires retained nativeReference content or the explicit historical clock candidate",
      );
    this.nativeCarrierMode =
      options.oscillatorModel === "nativeCarrierRoutes" ||
      (this.nativePolicy !== null &&
        (options.oscillatorModel === undefined || options.oscillatorModel === "nativeReference"));
    this.preciseNativeCursor =
      options.oscillatorModel === "seekableNativeClock" ||
      this.nativePolicy !== null ||
      this.nativeCarrierMode;
    this.seekableOscillators =
      options.oscillatorModel === "seekableHarmonics" ||
      (this.preciseNativeCursor && !this.nativeCarrierMode);
    this.nativeGraphBudget =
      this.nativePolicy?.maxNativeGraphs ??
      (this.nativeCarrierMode
        ? 2 * (this.nativePolicy?.maxNativeVoices ?? this.budget.maxVoices)
        : (this.nativePolicy?.maxNativeVoices ?? 2 * this.budget.maxVoices));
    this.internalArrivalGraphBudget = Math.min(
      this.budget.maxPendingEvents,
      this.budget.maxTotalPaths,
    );
    const legacySourceBound = 2 * this.budget.maxVoices + this.internalArrivalGraphBudget;
    this.nativeGraphTotalBudget =
      (this.nativePolicy ? this.nativeGraphBudget : 2 * this.budget.maxVoices) +
      this.internalArrivalGraphBudget;
    const carrierBound = legacySourceBound + (this.nativePolicy?.maxVirtualVoices ?? 0);
    this.nativeCarrierBudget = this.nativePolicy?.maxNativeCarriers ?? carrierBound;
    if (this.nativePolicy) {
      selectNativeVoices([], this.nativePolicy, 0);
      if (
        this.nativePolicy.maxNativeVoices > this.budget.maxVoices ||
        this.nativeGraphBudget > 2 * this.budget.maxVoices ||
        this.nativeCarrierBudget > carrierBound ||
        this.nativePolicy.maxVirtualVoices > this.budget.maxPendingEvents
      )
        throw new AudioEngineError(
          "VIRTUAL_POLICY_BUDGET",
          "Native/virtual policy exceeds engine budgets",
        );
    }
    this.monitorLevel = finite(options.monitorGain ?? 0.5, "monitor gain", 0, MAX_MONITOR_GAIN);
    finite(options.headroomGain ?? 0.2, "headroom gain", 0, 1);
    this.context = options.context ?? null;
    if (options.offlineOutputTap !== undefined) {
      if (!["master", "simulatedMix", "dryContent"].includes(options.offlineOutputTap))
        throw new AudioEngineError("OFFLINE_OUTPUT_TAP_UNSUPPORTED", "Unknown offline output tap");
      if (!this.context || !("startRendering" in this.context))
        throw new AudioEngineError(
          "OFFLINE_OUTPUT_TAP_REQUIRES_OFFLINE",
          "Output taps require an offline context",
        );
    }
    this.ownsContext = !options.context;
    if (this.context) this.initialize();
  }

  private isAssetReferenced(assetId: string): boolean {
    return (
      [
        ...this.voices.values(),
        ...this.retiring,
        ...this.carriers,
        ...this.frozenOnResume.values(),
        ...this.virtualVoices.values(),
        ...this.demotingVoices.values(),
      ].some(
        (voice) =>
          voice.input.generator.kind === "sample" &&
          voice.input.generator.asset.assetId === assetId,
      ) ||
      [...this.pendingOnResume.values()].some(
        (input) => input.generator.kind === "sample" && input.generator.asset.assetId === assetId,
      )
    );
  }

  private requireContext(): BaseAudioContext {
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    if (!this.context) {
      if (typeof globalThis.AudioContext !== "function")
        throw new AudioEngineError("WEB_AUDIO_UNAVAILABLE", "This environment has no AudioContext");
      this.context = new AudioContext({ latencyHint: this.bufferPreset });
      this.initialize();
    }
    return this.context;
  }

  private initialize(): void {
    const context = this.context;
    if (!context) return;
    this.diagnostics.bindContext(context);
    if (this.nativeCarrierMode) {
      this.phaseAnchor = context.createGain();
      // Pulls retained native carriers without contributing PCM. This gain is
      // exactly zero for its entire lifetime, with no automation or other taps;
      // its N-way sum cannot affect output. Audible buses use bounded junctions.
      this.phaseAnchor.gain.value = 0;
      this.phaseAnchor.connect(context.destination);
    }
    this.assets ??= new AudioAssetStore(context, this.budget, (id) => this.isAssetReferenced(id));
    this.assets.setContext(context);
    this.rawMix = context.createGain();
    this.rawMix.gain.value = this.monitorMode === "raw" ? 1 : 0;
    this.simulatedMix = context.createGain();
    this.simulatedMix.gain.value = this.monitorMode === "simulated" ? 1 : 0;
    this.rawMixInput = new DeterministicMixInput(
      context,
      this.rawMix,
      this.nativeCarrierMode ? this.nativeCarrierBudget : this.nativeGraphTotalBudget,
    );
    // All active and retiring paths share maxTotalPaths; late wet uses one slot.
    this.simulatedMixInput = new DeterministicMixInput(
      context,
      this.simulatedMix,
      this.budget.maxTotalPaths + 1,
    );
    this.runGain = context.createGain();
    this.runGain.gain.value = 1;
    this.headroom = context.createGain();
    this.headroom.gain.value = this.options.headroomGain ?? 0.2;
    this.monitor = context.createGain();
    this.monitor.gain.value = this.monitorLevel;
    this.muteGain = context.createGain();
    this.muteGain.gain.value = this.muted ? 0 : 1;
    this.rawMix.connect(this.runGain);
    this.simulatedMix.connect(this.runGain);
    this.runGain.connect(this.headroom);
    this.headroom.connect(this.monitor);
    this.monitor.connect(this.muteGain);
    const outputTap = this.options.offlineOutputTap ?? "master";
    if (outputTap !== "master") {
      // An explicit export tap, not a second audible monitor route. Neither
      // master headroom/limiter nor monitor mute is baked into dry/stem signals.
      this.monitorMode = outputTap === "dryContent" ? "raw" : "simulated";
      this.rawMix.gain.value = outputTap === "dryContent" ? 1 : 0;
      this.simulatedMix.gain.value = outputTap === "simulatedMix" ? 1 : 0;
      (outputTap === "dryContent" ? this.rawMix : this.simulatedMix).connect(context.destination);
      this.audioEpoch = context.currentTime;
      return;
    }
    if (this.options.limiterEnabled !== false) {
      this.limiter = context.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.1;
      this.muteGain.connect(this.limiter);
      if (this.options.outputSafetyClip) {
        // The compressor is not a hard ceiling; keep product output below full scale.
        this.safetyClip = context.createWaveShaper();
        this.safetyClip.curve = outputSafetyCurve();
        this.safetyClip.oversample = "none";
        this.limiter.connect(this.safetyClip);
        this.safetyClip.connect(context.destination);
      } else this.limiter.connect(context.destination);
    } else this.muteGain.connect(context.destination);
    this.liveMonitorOutput = this.safetyClip ?? this.limiter ?? this.muteGain;
    this.audioEpoch = context.currentTime;
  }

  /** Explicit UI observation only; never creates, resumes or runs an audio context. */
  readLiveMonitor(
    mode: LiveMonitorMode,
    input: LiveMonitorInput = "master-left",
  ): LiveAudioMonitorFrame | null {
    if (mode === "load") {
      this.releaseLiveMonitor();
      return null;
    }
    if (this.disposed || !this.enabled || !this.context || this.isOffline()) return null;
    if (!this.liveMonitor) {
      this.liveMonitorViews = new WeakMap();
      this.liveMonitor = new LiveAudioMonitor({
        getContext: () => this.context,
        isEnabled: () => this.enabled,
        isDisposed: () => this.disposed,
        isPaused: () => this.paused,
        getMasterOutput: () => this.liveMonitorOutput,
        forEachVoice: (visit) => {
          for (const voice of this.voices.values()) {
            if (voice.internalArrival || !voice.active) continue;
            visit(this.liveMonitorVoice(voice.input.instanceId)!);
          }
          for (const voice of this.virtualVoices.values())
            visit(this.liveMonitorVoice(voice.input.instanceId)!);
          for (const voice of this.demotingVoices.values())
            visit(this.liveMonitorVoice(voice.input.instanceId)!);
          for (const input of this.pendingOnResume.values())
            visit(this.liveMonitorVoice(input.instanceId)!);
        },
        getVoice: (id) => this.liveMonitorVoice(id),
      });
    }
    return this.liveMonitor.read(mode, input);
  }

  releaseLiveMonitor(): void {
    this.liveMonitor?.release();
  }

  private liveMonitorVoice(id: string): LiveMonitorVoice | null {
    const native = this.voices.get(id);
    const parked = this.virtualVoices.get(id) ?? this.demotingVoices.get(id);
    const pending = this.pendingOnResume.get(id);
    const owner = native ?? parked ?? pending;
    const input = native?.input ?? parked?.input ?? pending;
    if (!owner || !input || !this.liveMonitorViews) return null;
    const source = native?.source ?? parked?.carrier?.source;
    const channels = source && "buffer" in source ? (source.buffer?.numberOfChannels ?? 1) : 1;
    const onset = native?.startedAudioTime ?? parked?.startsAt ?? Infinity;
    const state =
      pending || onset > (this.context?.currentTime ?? 0)
        ? "pending"
        : parked
          ? "virtual"
          : "native";
    let view = this.liveMonitorViews.get(owner);
    if (!view) {
      view = {
        id,
        instanceId: id,
        sourceId: input.sourceId,
        label: input.sourceId,
        endpoint: null,
        channels,
        renderState: state,
        startedAtAudioTimeSeconds: onset,
      };
      this.liveMonitorViews.set(owner, view);
    }
    view.endpoint = state === "native" && native?.active ? native.envelope : null;
    view.channels = channels;
    view.renderState = state;
    view.startedAtAudioTimeSeconds = onset;
    return view;
  }

  async enable(simulationTimeSeconds = 0): Promise<void> {
    const context = this.requireContext();
    finite(simulationTimeSeconds, "simulation epoch", 0, 1e9);
    if ("resume" in context && typeof context.resume === "function" && !this.isOffline())
      await context.resume();
    const recovering = this.restartFailed;
    this.restartFailed = false;
    if (!this.enabled) this.setEpoch(simulationTimeSeconds, context.currentTime);
    this.enabled = true;
    if (recovering) {
      this.lastError = null;
      this.setLateReverb(this.reverbSettings);
    }
  }

  private isOffline(): boolean {
    return this.context !== null && "startRendering" in this.context;
  }
  private get lookahead(): number {
    // Reference/offline callers own their time-zero. Product-owned contexts always buffer.
    return this.isOffline() || (this.options.context && !this.options.bufferPreset)
      ? 0
      : AUDIO_LOOKAHEAD_SECONDS[this.bufferPreset];
  }
  private get controlInterval(): number {
    // Realtime acoustic solves publish at 20 Hz; external reference clocks retain R20 ramps.
    return this.isOffline() || (this.options.context && !this.options.bufferPreset) ? 0.02 : 0.05;
  }
  setEpoch(simulationTimeSeconds: number, audioTimeSeconds?: number): void {
    if (this.restartFailed) return;
    const context = this.requireContext();
    this.simulationEpoch = finite(simulationTimeSeconds, "simulation epoch", 0, 1e9);
    this.audioEpoch =
      finite(audioTimeSeconds ?? context.currentTime, "audio epoch", 0, 1e9) + this.lookahead;
    this.restoredInstances.clear();
  }

  /** Interactive catch-up discarded wall time, while the native clock kept running. */
  shiftEpoch(droppedWallTimeSeconds: number): void {
    finite(droppedWallTimeSeconds, "dropped wall time", 0, 1e9);
    if (!this.enabled || this.paused || this.rebuilding || this.context?.state !== "running")
      return;
    this.audioEpoch += droppedWallTimeSeconds;
    // Existing native sources keep playing. Their unchanged onset/rate anchors let
    // cursor capture follow the position actually heard during discarded wall time.
  }

  private async deviceStep<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("AUDIO_DEVICE_TIMEOUT")), 2000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Freeze/fade, release the device, then restore the same logical voices via resume. */
  async setBufferPreset(
    preset: AudioBufferPreset,
    simulationTimeSeconds: number,
    transport?: { shouldResume(): boolean; simulationTime(): number },
  ): Promise<void> {
    if (!isAudioBufferPreset(preset))
      throw new AudioEngineError("AUDIO_BUFFER_INVALID", "AUDIO_BUFFER_INVALID");
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    if (this.rebuilding || this.draining || this.assets?.hasPendingDecodes)
      throw new AudioEngineError("AUDIO_BUFFER_BUSY", "AUDIO_BUFFER_BUSY");
    if (preset === this.bufferPreset) return;
    if (!this.ownsContext)
      throw new AudioEngineError("AUDIO_BUFFER_EXTERNAL_CONTEXT", "AUDIO_BUFFER_EXTERNAL_CONTEXT");
    if (!this.context) {
      this.bufferPreset = preset;
      return;
    }
    this.rebuilding = true;
    const previousPreset = this.bufferPreset;
    const wasPaused = this.paused;
    const entrySerial = this.transportSerial;
    const reverb = { ...this.reverbSettings };
    try {
      await this.deviceStep(this.stopAudition());
      const mayResume = !wasPaused && entrySerial === this.transportSerial;
      const pauseTime = transport?.simulationTime() ?? simulationTimeSeconds;
      const pausing = this.pause(pauseTime, this.nativeCarrierMode);
      const serial = this.transportSerial;
      await this.deviceStep(pausing);
      await this.deviceStep(Promise.resolve(this.pauseCompletion));
      const old = this.context;
      this.disconnectOutput();
      if ("close" in old && typeof old.close === "function") await this.deviceStep(old.close());
      if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
      this.context = null;
      this.bufferPreset = preset;
      this.enabled = false;
      this.requireContext();
      // Frames remain in the map throughout the rebuild; asynchronous newer solves win.
      if (reverb) this.setLateReverb(reverb);
      // Enabling the replacement is bounded too. A late native resolution has no
      // continuation that can turn a failed/disconnected engine back on.
      const context = this.context!;
      if ("resume" in context && typeof context.resume === "function")
        await this.deviceStep(context.resume());
      this.enabled = true;
      const resumeTime = transport?.simulationTime() ?? simulationTimeSeconds;
      this.advanceRestartCursors(Math.max(0, resumeTime - pauseTime), resumeTime);
      if (mayResume && serial === this.transportSerial && (transport?.shouldResume() ?? true))
        await this.deviceStep(this.resume(resumeTime));
      else this.setEpoch(resumeTime);
      if (this.lastError === "AUDIO_BUFFER_RESTART_FAILED") this.lastError = null;
    } catch (error) {
      this.enabled = false;
      this.paused = true;
      this.restartFailed = true;
      ++this.transportSerial;
      this.bufferPreset = previousPreset;
      for (const voice of new Set([...this.voices.values(), ...this.retiring, ...this.carriers]))
        this.cleanupVoice(voice, true);
      this.frozenOnResume.clear();
      this.pendingOnResume.clear();
      this.virtualVoices.clear();
      this.demotingVoices.clear();
      this.restoredInstances.clear();
      this.disconnectOutput();
      const failed = this.context;
      this.context = null;
      let cause = error;
      if (failed && "close" in failed && typeof failed.close === "function") {
        try {
          await this.deviceStep(failed.close());
        } catch (closeError) {
          cause = new AggregateError([error, closeError], "Audio restart and device close failed");
        }
      }
      this.lastError = "AUDIO_BUFFER_RESTART_FAILED";
      throw new Error("AUDIO_BUFFER_RESTART_FAILED", { cause });
    } finally {
      this.rebuilding = false;
    }
  }

  /** Simulation continues during device replacement; the frozen content must catch up. */
  private advanceRestartCursors(delta: number, simulationTime: number): void {
    for (const voice of [...this.virtualVoices.values(), ...this.demotingVoices.values()]) {
      if (voice.frozenAt !== null && delta > 0) {
        voice.timeline.resume(voice.frozenAt);
        voice.timeline.freeze(voice.frozenAt + delta);
        voice.renderCursor?.resume(voice.frozenAt);
        voice.renderCursor?.freeze(voice.frozenAt + delta);
        voice.frozenAt += delta;
      }
    }
    for (const saved of this.frozenOnResume.values()) {
      const emissionDelta =
        saved.remainingDurationSeconds === null
          ? delta
          : Math.min(delta, saved.remainingDurationSeconds);
      if (!saved.ended) {
        const state = saved.logicalRateState;
        const rampTime = Math.min(emissionDelta, state.remainingSeconds);
        saved.positionSeconds +=
          state.remainingSeconds > 0
            ? state.from * rampTime +
              ((state.to - state.from) * rampTime * rampTime) / (2 * state.remainingSeconds) +
              state.to * (emissionDelta - rampTime)
            : state.to * emissionDelta;
        if (saved.renderClock) {
          const phase = new NativeSourceCursor({
            audioTimeSeconds: saved.freezeAudioTime,
            positionSeconds: saved.renderPositionSeconds,
            rate: saved.rateState.from,
            sampleRate: saved.renderClock.sampleRate,
            quantumFrames: saved.renderClock.quantumFrames,
            parameterScale:
              saved.input.generator.kind === "oscillator" ? saved.input.generator.frequencyHz : 1,
            rateKind: saved.input.generator.kind === "oscillator" ? "a-rate" : "k-rate",
          });
          if (saved.rateState.remainingSeconds > 0)
            phase.setRate(
              saved.rateState.to,
              saved.freezeAudioTime,
              saved.rateState.remainingSeconds,
            );
          saved.renderPositionSeconds = phase.readPosition(saved.freezeAudioTime + emissionDelta);
          saved.rateState = phase.rateState(saved.freezeAudioTime + delta);
        } else saved.renderPositionSeconds = saved.positionSeconds;
        saved.logicalRateState = {
          from:
            state.remainingSeconds > 0
              ? state.from + (state.to - state.from) * Math.min(1, delta / state.remainingSeconds)
              : state.to,
          to: state.to,
          remainingSeconds: Math.max(0, state.remainingSeconds - delta),
        };
      }
      if (saved.authoredRemainingSeconds !== null)
        saved.authoredRemainingSeconds = Math.max(0, saved.authoredRemainingSeconds - delta);
      saved.freezeAudioTime += delta;
      saved.elapsedSinceEmissionSeconds += delta;
      if (saved.remainingDurationSeconds !== null) {
        saved.remainingDurationSeconds = Math.max(0, saved.remainingDurationSeconds - delta);
        saved.ended ||= saved.remainingDurationSeconds === 0;
      }
      saved.arrivals = saved.arrivals.flatMap((arrival) => {
        const consumed = Math.max(0, delta - arrival.delaySeconds);
        if (arrival.durationSeconds <= consumed) return [];
        const delaySeconds = Math.max(0, arrival.delaySeconds - delta);
        return [
          {
            ...arrival,
            delaySeconds,
            frame: {
              ...arrival.frame,
              paths: arrival.frame.paths.map((path) => ({ ...path, absoluteDelayS: delaySeconds })),
            },
            positionSeconds:
              arrival.positionSeconds + consumed * 2 ** (saved.input.pitchSemitones / 12),
            durationSeconds: arrival.durationSeconds - consumed,
          },
        ];
      });
    }
    for (const [id, input] of this.pendingOnResume) {
      if (!input.continuous && simulationTime - input.emissionTimeSeconds > this.lookahead) {
        this.pendingOnResume.delete(id);
        this.lastError = "RESTART_GAP";
        this.options.onVoiceEnded?.(id);
      }
    }
  }

  async pause(simulationTimeSeconds: number, forContextReplacement = false): Promise<void> {
    finite(simulationTimeSeconds, "pause simulation time", 0, 1e9);
    ++this.transportSerial;
    const context = this.context;
    if (!context || !this.enabled) {
      this.paused = true;
      return;
    }
    if (forContextReplacement && this.carrierContextPause) {
      this.carrierContextPause = false;
      this.paused = false;
    }
    if (this.paused) return;
    if (this.nativeCarrierMode && !forContextReplacement)
      return this.pauseCarrierContext(simulationTimeSeconds);
    this.paused = true;
    const now = context.currentTime;
    const logicalAudioTime = this.audioEpoch + (simulationTimeSeconds - this.simulationEpoch);
    this.pauseClockSkew = now - logicalAudioTime;
    this.pauseClockAudit = {
      transportPolicy: "legacyRestart",
      logicalCutoffSimulationSeconds: simulationTimeSeconds,
      logicalCutoffAudioSeconds: logicalAudioTime,
      nativePauseCallAudioSeconds: now,
      nativeSuspendAudioSeconds: null,
      nativeFadeAdvanceSeconds: null,
      clockSkewAtCallSeconds: this.pauseClockSkew,
      cursorObservation: "modeledSourceClock;notNativePcmPointer",
    };
    const boundary = now + 0.02;
    for (const voice of [...this.virtualVoices.values(), ...this.demotingVoices.values()]) {
      voice.timeline.freeze(logicalAudioTime);
      voice.renderCursor?.freeze(logicalAudioTime);
      voice.frozenAt = logicalAudioTime;
    }
    const oldVoices = this.nativeCarrierMode
      ? [
          ...new Set([
            ...this.voices.values(),
            ...[...this.virtualVoices.values(), ...this.demotingVoices.values()].flatMap((voice) =>
              voice.carrier ? [voice.carrier] : [],
            ),
            ...this.retiring,
            ...this.carriers,
          ]),
        ]
      : [...this.voices.values(), ...this.retiring];
    if (this.nativeCarrierMode) {
      this.virtualVoices.clear();
      this.demotingVoices.clear();
    }
    for (const voice of oldVoices) {
      if (voice.virtualized && !this.nativeCarrierMode) {
        this.cleanupVoice(voice);
        continue;
      }
      if (
        voice.startedAudioTime > now &&
        !voice.restoredCursor &&
        voice.input.emissionTimeSeconds > simulationTimeSeconds
      ) {
        if (voice.active && !voice.internalArrival)
          this.pendingOnResume.set(voice.input.instanceId, structuredClone(voice.input));
        this.cleanupVoice(voice);
        continue;
      }
      {
        // A restored source may still be inside onset lookahead. Freeze its startup
        // cursor and finite duration, including internal propagation arrivals.
        const freezeTime =
          voice.startedAudioTime > now
            ? voice.startedAudioTime
            : voice.internalArrival
              ? now
              : logicalAudioTime;
        const position = this.voicePositionAt(voice, freezeTime);
        const end = voice.sourceEndAudioTime;
        const frame = this.frames.get(voice.input.sourceId);
        const arrivals: FrozenVoice["arrivals"] = [];
        if (frame)
          for (const route of voice.routes.values()) {
            const path = frame.paths.find((p) => p.id === route.id);
            if (!path) continue;
            const emissionStart = Math.max(voice.startedAudioTime, boundary - route.absoluteDelayS);
            const emissionEnd = Math.min(now, end);
            if (emissionEnd <= emissionStart || arrivals.length >= this.budget.maxPathsPerVoice)
              continue;
            arrivals.push({
              frame: {
                ...structuredClone(frame),
                paths: [
                  {
                    ...structuredClone(path),
                    absoluteDelayS: Math.max(0, emissionStart + route.absoluteDelayS - now),
                  },
                ],
              },
              positionSeconds: this.voicePositionAt(voice, emissionStart),
              delaySeconds: Math.max(0, emissionStart + route.absoluteDelayS - now),
              durationSeconds: emissionEnd - emissionStart,
            });
          }
        const oldGeneration = this.frozenOnResume.has(voice.input.instanceId);
        const frozenId = oldGeneration
          ? `\u0000retired-audio-${++this.arrivalSequence}`
          : voice.input.instanceId;
        this.frozenOnResume.set(frozenId, {
          input: { ...structuredClone(voice.input), instanceId: frozenId },
          historyIncomplete: true,
          logicalRateState: voice.timeline?.rateState(freezeTime) ?? {
            from: 2 ** (voice.input.pitchSemitones / 12),
            to: 2 ** (voice.input.pitchSemitones / 12),
            remainingSeconds: 0,
          },
          renderPositionSeconds: voice.renderCursor?.readPosition(freezeTime) ?? position,
          sampleOriginSeconds: voice.sampleOriginSeconds,
          freezeAudioTime: freezeTime,
          renderClock: voice.renderCursor
            ? { sampleRate: context.sampleRate, quantumFrames: this.nativeRenderQuantum() }
            : null,
          rateState:
            voice.renderCursor?.rateState(freezeTime) ??
            voice.timeline?.rateState(freezeTime) ??
            (() => {
              const point =
                [...voice.rateHistory].reverse().find((entry) => entry.time <= freezeTime) ??
                voice.rateHistory[0]!;
              const progress =
                point.end > point.time
                  ? Math.min(1, Math.max(0, (freezeTime - point.time) / (point.end - point.time)))
                  : 1;
              return {
                from: point.from + (point.to - point.from) * progress,
                to: point.to,
                remainingSeconds: Math.max(0, point.end - freezeTime),
              };
            })(),
          authoredRemainingSeconds:
            voice.timeline?.authoredRemainingSeconds(freezeTime) ??
            (voice.input.durationSeconds === undefined
              ? null
              : Math.max(
                  0,
                  voice.input.durationSeconds -
                    voice.elapsedBeforeStartSeconds -
                    Math.max(0, freezeTime - voice.startedAudioTime),
                )),
          positionSeconds: position,
          elapsedSinceEmissionSeconds:
            voice.elapsedBeforeStartSeconds + Math.max(0, freezeTime - voice.startedAudioTime),
          emissionEndElapsedSeconds: Number.isFinite(end)
            ? voice.elapsedBeforeStartSeconds +
              (voice.startedAudioTime > now ? voice.durationSeconds! : end - voice.startedAudioTime)
            : undefined,
          remainingDurationSeconds:
            end === Infinity
              ? null
              : voice.startedAudioTime > now
                ? voice.durationSeconds
                : Math.max(0, end - freezeTime),
          ended:
            oldGeneration || (voice.internalArrival ? false : !voice.active) || end <= freezeTime,
          arrivals,
          internalArrival: voice.internalArrival || oldGeneration,
          frame:
            voice.internalArrival && frame
              ? {
                  ...structuredClone(frame),
                  paths: frame.paths
                    .filter((p) => voice.routes.has(p.id))
                    .map((p) => ({
                      ...structuredClone(p),
                      absoluteDelayS: voice.routes.get(p.id)!.absoluteDelayS,
                    })),
                }
              : undefined,
        });
        this.liveMonitor?.disposeVoice(voice.input.instanceId, voice.envelope);
        voice.active = false;
        if (this.voices.get(voice.input.instanceId) === voice)
          this.voices.delete(voice.input.instanceId);
        voice.source.onended = null;
        voice.source.stop(boundary);
      }
    }
    const serial = ++this.pauseSerial;
    smooth(this.runGain!.gain, 0, now, 0.02);
    this.pauseBoundary = boundary;
    this.pauseCompletion = new Promise<void>((resolve) => setTimeout(resolve, 25));
    await this.pauseCompletion;
    if (this.disposed || serial !== this.pauseSerial) return;
    for (const voice of oldVoices) this.cleanupVoice(voice, this.nativeCarrierMode);
    for (const timer of this.routeTimers) clearTimeout(timer);
    this.routeTimers.clear();
    for (const route of this.retiredRoutes) route.disconnect();
    this.retiredRoutes.clear();
    this.retiredLateRoutes.clear();
    this.offlineRouteDeadlines.clear();
    this.lateBus?.clearTail();
    this.pauseCompletion = null;
  }

  private async pauseCarrierContext(simulationTimeSeconds: number): Promise<void> {
    const context = this.requireContext();
    this.paused = true;
    this.carrierContextPause = true;
    const logicalTime = this.audioEpoch + simulationTimeSeconds - this.simulationEpoch;
    this.pauseClockSkew = context.currentTime - logicalTime;
    this.pauseClockAudit = {
      transportPolicy: "sameContextCarrier",
      logicalCutoffSimulationSeconds: simulationTimeSeconds,
      logicalCutoffAudioSeconds: logicalTime,
      nativePauseCallAudioSeconds: context.currentTime,
      nativeSuspendAudioSeconds: null,
      nativeFadeAdvanceSeconds: null,
      clockSkewAtCallSeconds: this.pauseClockSkew,
      cursorObservation: "modeledSourceClock;notNativePcmPointer",
    };
    for (const carrier of this.carriers)
      if (carrier.active) {
        carrier.timeline?.freeze(logicalTime);
        // The retained source is exact; clearing late state remains an interrupted DSP boundary.
        carrier.historyIncomplete = true;
      }
    const serial = ++this.pauseSerial;
    smooth(this.runGain!.gain, 0, context.currentTime, 0.02);
    const completion = (async () => {
      if (!this.isOffline() && context.state === "running")
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
      if (this.disposed || serial !== this.pauseSerial) return;
      if (
        !this.isOffline() &&
        context.state !== "suspended" &&
        "suspend" in context &&
        typeof context.suspend === "function"
      )
        await this.deviceStep((context as AudioContext).suspend());
      if (this.disposed || serial !== this.pauseSerial) return;
      this.pauseBoundary = context.currentTime;
      if (this.pauseClockAudit) {
        this.pauseClockAudit.nativeSuspendAudioSeconds = context.currentTime;
        this.pauseClockAudit.nativeFadeAdvanceSeconds = Math.max(
          0,
          context.currentTime - this.pauseClockAudit.nativePauseCallAudioSeconds,
        );
      }
      for (const carrier of this.carriers)
        if (carrier.active) carrier.renderCursor?.freeze(context.currentTime);
      this.lateBus?.clearTail();
    })();
    this.pauseCompletion = completion;
    try {
      await completion;
    } finally {
      if (this.pauseCompletion === completion) this.pauseCompletion = null;
    }
  }

  async resume(simulationTimeSeconds: number): Promise<boolean> {
    if (!this.enabled || !this.context) {
      // Mirrors pause(): without a renderer only the logical transport flag changes, so
      // later admissions report AUDIO_NOT_ENABLED instead of staying SIMULATION_PAUSED.
      this.paused = false;
      return false;
    }
    const context = this.requireContext();
    finite(simulationTimeSeconds, "resume simulation time", 0, 1e9);
    if (!this.paused) return true;
    const serial = ++this.transportSerial;
    await this.pauseCompletion;
    if (this.carrierContextPause) {
      if (this.disposed || serial !== this.transportSerial) return false;
      if (!this.isOffline() && "resume" in context && typeof context.resume === "function")
        await this.deviceStep(context.resume());
      if (this.disposed || serial !== this.transportSerial) return false;
      this.setEpoch(simulationTimeSeconds, context.currentTime);
      for (const carrier of this.carriers)
        if (carrier.active) {
          carrier.timeline?.resume(this.audioEpoch);
          carrier.renderCursor?.resumeSameContext();
        }
      this.carrierContextPause = false;
      this.paused = false;
      smooth(this.runGain!.gain, 1, context.currentTime, 0.02);
      return true;
    }
    if (this.disposed || serial !== this.transportSerial) return false;
    ++this.pauseSerial;
    if ("resume" in context && typeof context.resume === "function" && !this.isOffline())
      await context.resume();
    if (this.disposed || serial !== this.transportSerial) return false;
    this.paused = false;
    this.setEpoch(simulationTimeSeconds, context.currentTime);
    smooth(this.runGain!.gain, 1, context.currentTime, 0.02);
    for (const voice of [...this.virtualVoices.values(), ...this.demotingVoices.values()]) {
      voice.timeline.resume(this.audioEpoch);
      voice.renderCursor?.resume(this.audioEpoch);
      if (voice.frozenAt !== null) {
        const shift = this.audioEpoch - voice.frozenAt;
        voice.virtualSince = Math.max(0, voice.virtualSince + shift);
        voice.startsAt += shift;
        if (Number.isFinite(voice.nativeEndAudioTime)) voice.nativeEndAudioTime += shift;
      }
      voice.frozenAt = null;
    }
    const pending = [...this.pendingOnResume.values()];
    this.pendingOnResume.clear();
    const frozen = [...this.frozenOnResume.values()];
    // Keep registry pins and frames protected until every restored source is admitted.
    for (const saved of frozen) {
      if (!saved.ended) {
        const result = this.startVoice(
          { ...saved.input, emissionTimeSeconds: simulationTimeSeconds, fadeInSeconds: 0 },
          saved.frame,
          {
            positionSeconds: saved.renderPositionSeconds,
            logicalPositionSeconds: saved.positionSeconds,
            logicalRateState: saved.logicalRateState,
            sampleOriginSeconds: saved.sampleOriginSeconds,
            durationSeconds: saved.remainingDurationSeconds,
            internalArrival: saved.internalArrival,
            elapsedSinceEmissionSeconds: saved.elapsedSinceEmissionSeconds,
            historyIncomplete: saved.historyIncomplete,
            resumeRate: saved.rateState,
            authoredDurationSeconds: saved.authoredRemainingSeconds,
          },
        );
        if (!result.accepted && !saved.internalArrival)
          this.options.onVoiceEnded?.(saved.input.instanceId);
      }
      for (const arrival of saved.arrivals) {
        if (this.retiring.size >= this.budget.maxPendingEvents) {
          this.droppedPaths++;
          continue;
        }
        this.startVoice(
          {
            ...saved.input,
            instanceId: `arrival-${++this.arrivalSequence}`,
            emissionTimeSeconds: simulationTimeSeconds,
            continuous: false,
            fadeInSeconds: 0,
            fadeOutSeconds: 0,
          },
          arrival.frame,
          {
            positionSeconds: arrival.positionSeconds,
            durationSeconds: arrival.durationSeconds,
            internalArrival: true,
          },
        );
      }
    }
    this.frozenOnResume.clear();
    for (const input of pending) {
      const result = this.playVoice({
        ...input,
        emissionTimeSeconds: Math.max(simulationTimeSeconds, input.emissionTimeSeconds),
      });
      if (!result.accepted) this.options.onVoiceEnded?.(input.instanceId);
    }
    for (const sourceId of new Set([
      ...frozen.map((v) => v.input.sourceId),
      ...pending.map((v) => v.sourceId),
    ]))
      this.forgetSource(sourceId);
    return true;
  }

  /** Safe authoring boundary: disconnect old epochs while preserving decoded assets/context. */
  async drainVoices(): Promise<void> {
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    if (this.draining)
      throw new AudioEngineError("DRAIN_IN_PROGRESS", "Audio drain already in progress");
    this.draining = true;
    try {
      if (this.context && this.runGain) {
        smooth(this.runGain.gain, 0, this.context.currentTime, 0.02);
        if (this.context.state === "running" && !this.isOffline())
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
      }
      // A replaced independent preview may be disposed during the fade wait.
      // Its graph is already disconnected; do not rebuild a late-reverb tail after disposal.
      if (this.disposed) return;
      ++this.pauseSerial;
      const ids = new Set([
        ...this.voices.keys(),
        ...this.virtualVoices.keys(),
        ...this.demotingVoices.keys(),
        ...this.pendingOnResume.keys(),
        ...[...this.frozenOnResume]
          .filter(([, v]) => !v.ended && !v.internalArrival)
          .map(([id]) => id),
      ]);
      for (const voice of new Set([...this.voices.values(), ...this.retiring, ...this.carriers]))
        this.cleanupVoice(voice, true);
      for (const timer of this.routeTimers) clearTimeout(timer);
      this.routeTimers.clear();
      for (const route of this.retiredRoutes) route.disconnect();
      this.retiredRoutes.clear();
      this.retiredLateRoutes.clear();
      this.offlineRouteDeadlines.clear();
      this.lateBus?.clearTail();
      this.pendingOnResume.clear();
      this.frozenOnResume.clear();
      this.virtualVoices.clear();
      this.demotingVoices.clear();
      this.restoredInstances.clear();
      this.carrierContextPause = false;
      this.frames.clear();
      for (const id of ids) this.options.onVoiceEnded?.(id);
      if (this.context && this.runGain && !this.paused)
        smooth(this.runGain.gain, 1, this.context.currentTime, 0.02);
    } finally {
      this.draining = false;
    }
  }

  setMuted(muted: boolean): void {
    if (typeof muted !== "boolean") throw new AudioEngineError("INVALID_MUTE", "Expected boolean");
    this.muted = muted;
    if (this.context && this.muteGain)
      smooth(this.muteGain.gain, muted ? 0 : 1, this.context.currentTime);
    this.auditionEngine?.setMuted(muted);
  }
  setMonitorGain(gain: number): void {
    this.monitorLevel = finite(gain, "monitor gain", 0, MAX_MONITOR_GAIN);
    if (this.context && this.monitor) smooth(this.monitor.gain, gain, this.context.currentTime);
    this.auditionEngine?.setMonitorGain(gain);
  }
  setMonitorMode(mode: "raw" | "simulated"): void {
    if (mode !== "raw" && mode !== "simulated")
      throw new AudioEngineError("INVALID_MONITOR_MODE", String(mode));
    const tap = this.options.offlineOutputTap;
    if (tap && tap !== "master" && mode !== (tap === "dryContent" ? "raw" : "simulated"))
      throw new AudioEngineError(
        "OFFLINE_TAP_MODE_FIXED",
        "An offline signal tap has a fixed monitor mode",
      );
    this.monitorMode = mode;
    if (this.context) {
      smooth(this.rawMix!.gain, mode === "raw" ? 1 : 0, this.context.currentTime);
      smooth(this.simulatedMix!.gain, mode === "simulated" ? 1 : 0, this.context.currentTime);
    }
  }

  setLateReverb(update: Partial<LateReverbSettings> & { enabled: boolean }): void {
    if (this.restartFailed) {
      if (typeof update.enabled !== "boolean")
        throw new AudioEngineError("INVALID_REVERB", "enabled must be boolean");
      const next = { ...this.reverbSettings, ...update };
      finite(next.decaySeconds, "synthetic IR duration", 0.1, 4);
      finite(next.wetGain, "late wet gain", 0, 1);
      finite(next.seed, "synthetic IR seed", 0, 0xffffffff);
      if (!Number.isSafeInteger(next.seed))
        throw new AudioEngineError("INVALID_REVERB_SEED", "Expected uint32 seed");
      this.reverbSettings = next;
      return;
    }
    const context = this.requireContext();
    this.lateBus ??= new LateReverbBus(
      context,
      this.simulatedMixInput!,
      this.budget.maxLateReverbBytes,
      this.budget.maxLateSends,
    );
    this.lateBus.set(update);
    this.reverbSettings = { ...this.lateBus.settings };
    for (const voice of this.voices.values()) {
      const frame = this.frames.get(voice.input.sourceId);
      if (frame) this.applyLateRoute(voice, frame);
    }
  }

  registerBuffer(
    assetId: string,
    buffer: AudioBuffer,
    metadata: AudioAssetMetadata,
  ): AudioAssetDescriptor {
    this.requireContext();
    return this.assets!.register(assetId, buffer, metadata);
  }
  async importAsset(
    assetId: string,
    bytes: ArrayBuffer,
    metadata: AudioAssetMetadata,
  ): Promise<AudioAssetDescriptor> {
    this.requireContext();
    return this.assets!.import(assetId, bytes, metadata);
  }
  async registerBuiltins(): Promise<AudioAssetDescriptor[]> {
    this.requireContext();
    return this.assets!.registerBuiltins();
  }
  getAssets(): AudioAssetDescriptor[] {
    return this.assets?.list() ?? [];
  }
  /** Trusted persistence host only; returning buffers does not serialize engine objects. */
  getAssetBuffer(assetId: string): AudioBuffer | null {
    return this.assets?.get(assetId)?.buffer ?? null;
  }
  /** Scoped PCM ownership; callers release after offline/record/replay use. */
  acquireAssets(assetIds: readonly string[], reason: string): AudioAssetLease {
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    this.assets ??= new AudioAssetStore(this.context, this.budget, (id) =>
      this.isAssetReferenced(id),
    );
    return this.assets.acquire(assetIds, reason);
  }
  restoreAssets(entries: readonly AudioAssetBankEntry[]): AudioAssetDescriptor[] {
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    this.assets ??= new AudioAssetStore(this.context, this.budget, (id) =>
      this.isAssetReferenced(id),
    );
    return this.assets.restore(entries);
  }
  evictAssets(assetIds?: readonly string[], targetBytes = 0): AssetEvictionResult {
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    this.assets ??= new AudioAssetStore(this.context, this.budget, (id) =>
      this.isAssetReferenced(id),
    );
    return this.assets.evictUnused({ ...(assetIds ? { assetIds } : {}), targetBytes });
  }
  getAssetResidency(): AssetResidencySnapshot {
    this.assets ??= new AudioAssetStore(this.context, this.budget, (id) =>
      this.isAssetReferenced(id),
    );
    return this.assets.getResidency();
  }

  getAssetBudget(): Readonly<AudioBudget> {
    return Object.freeze({ ...this.budget });
  }
  getAssetSampleRate(): number | null {
    return this.context?.sampleRate ?? null;
  }
  replaceAssets(entries: readonly AudioAssetBankEntry[]): AudioAssetDescriptor[] {
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    if (
      this.draining ||
      this.voices.size ||
      this.carriers.size ||
      this.virtualVoices.size ||
      this.demotingVoices.size ||
      this.retiring.size ||
      this.pendingOnResume.size ||
      this.frozenOnResume.size ||
      this.retiredRoutes.size
    )
      throw new AudioEngineError(
        "ASSET_BANK_IN_USE",
        "Drain all active, retiring, pending and frozen voices before replacing assets",
      );
    this.assets ??= new AudioAssetStore(null, this.budget, (id) => this.isAssetReferenced(id));
    const descriptors = this.assets.replace(entries);
    this.lateBus?.clearTail();
    return descriptors;
  }

  private reject(reason: string): VoiceAdmission {
    this.droppedVoices++;
    this.lastError = reason;
    return { accepted: false, reason };
  }
  private validateVoice(input: VoiceInput): void {
    if (!input.instanceId || !input.sourceId)
      throw new AudioEngineError("INVALID_VOICE_ID", "Voice/source ID required");
    if (
      typeof input.continuous !== "boolean" ||
      !["sample", "oscillator"].includes(input.generator.kind)
    )
      throw new AudioEngineError(
        "INVALID_GENERATOR",
        "Expected bounded sample or oscillator generator",
      );
    finite(input.gainLinear, "voice gain", 0, 4);
    finite(input.pitchSemitones, "pitch", -48, 48);
    finite(input.emissionTimeSeconds, "emission time", 0, 1e9);
    finite(input.fadeInSeconds, "fade in", 0, 30);
    finite(input.fadeOutSeconds, "fade out", 0, 30);
    finite(input.priority ?? 0, "priority", 0, 100);
    if (input.durationSeconds !== undefined) finite(input.durationSeconds, "duration", 0.001, 600);
    if (input.filterCutoffHz !== undefined)
      finite(input.filterCutoffHz, "filter cutoff", 20, 20000);
    if (input.generator.kind === "oscillator") {
      if (!["sine", "triangle", "square", "sawtooth"].includes(input.generator.waveform))
        throw new AudioEngineError("INVALID_WAVEFORM", "Unsupported oscillator waveform");
      const frequency =
        finite(input.generator.frequencyHz, "oscillator frequency", 20, 20000) *
        2 ** (input.pitchSemitones / 12);
      if (frequency >= this.requireContext().sampleRate / 2)
        throw new AudioEngineError("OSCILLATOR_OUT_OF_BAND", "Authored pitch exceeds Nyquist");
      if (!input.continuous && input.durationSeconds === undefined)
        throw new AudioEngineError(
          "ONE_SHOT_DURATION_REQUIRED",
          "Oscillator one-shot must be finite",
        );
    } else if (!input.continuous && input.generator.loop && input.durationSeconds === undefined) {
      throw new AudioEngineError(
        "ONE_SHOT_DURATION_REQUIRED",
        "Looped sample one-shot must be finite",
      );
    }
  }

  playVoice(input: VoiceInput, frame?: AcousticFrame, cached = false): VoiceAdmission {
    this.serviceNativeVoices();
    const admission = this.startVoice(input, frame);
    if (cached && admission.accepted && admission.reason !== "ALREADY_PLAYING")
      this.staleVoiceAdmissions++;
    return admission;
  }
  get isPaused(): boolean {
    return this.paused;
  }
  /** Epoch-mapped logical source cursor, including the integrated authored pitch ramps. */
  getVoiceCursor(instanceId: string, simulationTimeSeconds: number): VoiceCursor | null {
    finite(simulationTimeSeconds, "cursor simulation time", 0, 1e9);
    const virtual = this.virtualVoices.get(instanceId) ?? this.demotingVoices.get(instanceId);
    if (virtual)
      return virtual.timeline.read(this.audioEpoch + simulationTimeSeconds - this.simulationEpoch);
    const frozen = this.frozenOnResume.get(instanceId);
    if (frozen && !frozen.internalArrival)
      return {
        playheadSeconds: frozen.positionSeconds,
        elapsedSinceEmissionSeconds: frozen.elapsedSinceEmissionSeconds,
        remainingDurationSeconds: frozen.remainingDurationSeconds,
        ...(frozen.emissionEndElapsedSeconds === undefined
          ? {}
          : { emissionEndElapsedSeconds: frozen.emissionEndElapsedSeconds }),
      };
    const voice =
      this.voices.get(instanceId) ??
      [...this.retiring]
        .filter((v) => !v.internalArrival && v.input.instanceId === instanceId)
        .sort((a, b) => b.startedAudioTime - a.startedAudioTime)[0];
    if (!voice) return null;
    const audioTime = this.audioEpoch + (simulationTimeSeconds - this.simulationEpoch);
    if (audioTime < voice.startedAudioTime) return null;
    if (voice.timeline) return voice.timeline.read(audioTime);
    return {
      playheadSeconds: this.voicePositionAt(voice, audioTime),
      elapsedSinceEmissionSeconds:
        voice.elapsedBeforeStartSeconds + Math.max(0, audioTime - voice.startedAudioTime),
      remainingDurationSeconds: Number.isFinite(voice.sourceEndAudioTime)
        ? Math.max(0, voice.sourceEndAudioTime - audioTime)
        : null,
      ...(Number.isFinite(voice.sourceEndAudioTime)
        ? {
            emissionEndElapsedSeconds:
              voice.elapsedBeforeStartSeconds + voice.sourceEndAudioTime - voice.startedAudioTime,
          }
        : {}),
    };
  }

  /** Cursor provenance is separate from its four serializable source-time values. */
  getVoiceCursorState(
    instanceId: string,
    simulationTimeSeconds: number,
  ): {
    cursor: VoiceCursor;
    logicalCursor: VoiceCursor;
    cursorModel: "nativeFloat32AAndKRate-v2" | "analytic-v1";
    nativeAudioTimeSeconds: number | null;
    cursorObservation: "modeledSourceClock;notNativePcmPointer";
    provenance: "native" | "virtual";
    historyIncomplete: boolean;
  } | null {
    const cursor = this.getVoiceCursor(instanceId, simulationTimeSeconds);
    if (!cursor) return null;
    const virtual = this.virtualVoices.has(instanceId) || this.demotingVoices.has(instanceId);
    const native =
      this.voices.get(instanceId) ??
      [...this.retiring].find((voice) => voice.input.instanceId === instanceId);
    const frozen = this.frozenOnResume.get(instanceId);
    const parked = this.virtualVoices.get(instanceId) ?? this.demotingVoices.get(instanceId);
    const audioTime = this.nativeCarrierMode
      ? this.requireContext().currentTime
      : this.audioEpoch + simulationTimeSeconds - this.simulationEpoch;
    const phase = parked?.renderCursor ?? native?.renderCursor;
    const renderPosition = frozen?.renderPositionSeconds ?? phase?.readPosition(audioTime);
    const end = parked?.nativeEndAudioTime ?? native?.sourceEndAudioTime;
    const carrier = parked?.carrier ?? native;
    const sourceElapsed =
      this.nativeCarrierMode && carrier
        ? carrier.elapsedBeforeStartSeconds + Math.max(0, audioTime - carrier.startedAudioTime)
        : cursor.elapsedSinceEmissionSeconds;
    const actualCursor =
      renderPosition === undefined
        ? cursor
        : {
            ...cursor,
            elapsedSinceEmissionSeconds: sourceElapsed,
            playheadSeconds: this.clampSamplePosition(
              parked?.input ?? native?.input ?? frozen!.input,
              renderPosition,
            ),
            ...(end !== undefined && Number.isFinite(end) && !frozen
              ? {
                  remainingDurationSeconds: Math.max(
                    0,
                    end - Math.max(audioTime, parked?.startsAt ?? native!.startedAudioTime),
                  ),
                  emissionEndElapsedSeconds:
                    sourceElapsed +
                    end -
                    Math.max(audioTime, parked?.startsAt ?? native!.startedAudioTime),
                }
              : {}),
          };
    return {
      cursor: actualCursor,
      logicalCursor: cursor,
      cursorModel: phase ? "nativeFloat32AAndKRate-v2" : "analytic-v1",
      nativeAudioTimeSeconds: this.nativeCarrierMode && !frozen ? audioTime : null,
      cursorObservation: "modeledSourceClock;notNativePcmPointer",
      provenance: virtual ? "virtual" : "native",
      historyIncomplete:
        virtual || (native?.historyIncomplete ?? frozen?.historyIncomplete ?? false),
    };
  }

  /** Restore a recorded emission cursor without dispatching a new logical sound event. */
  restoreVoiceAtCursor(
    input: VoiceInput,
    frame: AcousticFrame,
    cursor: VoiceRestoreCursor,
  ): VoiceAdmission {
    if (this.restartFailed) return this.reject("AUDIO_NOT_ENABLED");
    const context = this.requireContext();
    this.validateVoice(input);
    const position = finite(cursor.playheadSeconds, "restored source cursor", 0, 1e9);
    const elapsed = finite(cursor.elapsedSinceEmissionSeconds, "restored emission elapsed", 0, 1e9);
    if (cursor.remainingDurationSeconds !== null)
      finite(cursor.remainingDurationSeconds, "remaining duration", 0, 600);
    if (cursor.emissionEndElapsedSeconds !== undefined)
      finite(cursor.emissionEndElapsedSeconds, "emission end elapsed", 0, 1e9);
    if (cursor.remainingDurationSeconds === null && !input.continuous)
      return this.reject("FINITE_RESTORE_DURATION_REQUIRED");
    if (
      cursor.restorePendingArrivals !== undefined &&
      typeof cursor.restorePendingArrivals !== "boolean"
    )
      throw new AudioEngineError(
        "INVALID_RESTORE_CURSOR",
        "restorePendingArrivals must be boolean",
      );
    if (!this.enabled) return this.reject("AUDIO_NOT_ENABLED");
    if (this.paused || this.draining)
      return this.reject(this.paused ? "SIMULATION_PAUSED" : "AUDIO_DRAINING");
    if (
      this.restoredInstances.has(input.instanceId) ||
      this.voices.has(input.instanceId) ||
      this.virtualVoices.has(input.instanceId) ||
      this.demotingVoices.has(input.instanceId)
    )
      return this.reject("RESTORE_ALREADY_APPLIED");
    if (this.restoredInstances.size >= this.budget.maxPendingEvents)
      return this.reject("RESTORE_HISTORY_BUDGET");
    if (frame.sourceId !== input.sourceId) return this.reject("FRAME_SOURCE_MISMATCH");
    validateFrame(frame, context.sampleRate);
    const previous = this.frames.get(frame.sourceId);
    if (
      frame.stale ||
      (previous &&
        (frame.sceneRevision < previous.sceneRevision ||
          frame.geometryRevision < previous.geometryRevision ||
          (frame.sceneRevision === previous.sceneRevision &&
            frame.geometryRevision === previous.geometryRevision &&
            frame.poseTick < previous.poseTick)))
    ) {
      this.staleFrames++;
      return this.reject("STALE_ACOUSTIC_FRAME");
    }
    if (frame.pathAvailability !== "available") return this.reject("ACOUSTIC_FRAME_UNAVAILABLE");
    let originalDuration = input.durationSeconds ?? Infinity;
    const rate = 2 ** (input.pitchSemitones / 12);
    if (input.generator.kind === "sample") {
      const asset = this.assets!.get(input.generator.asset.assetId);
      if (!asset) return this.reject("ASSET_NOT_READY");
      if (
        asset.descriptor.revision !== input.generator.asset.revision ||
        (asset.descriptor.sha256 !== null &&
          asset.descriptor.sha256 !== input.generator.asset.sha256)
      )
        return this.reject("ASSET_REFERENCE_MISMATCH");
      finite(input.generator.startOffsetSeconds, "sample offset", 0, asset.buffer.duration);
      if (!input.generator.loop)
        originalDuration = Math.min(
          originalDuration,
          (asset.buffer.duration - input.generator.startOffsetSeconds) / rate,
        );
    }
    const remaining = cursor.remainingDurationSeconds;
    const ended = remaining === 0;
    const emissionEnd = Math.min(
      elapsed,
      cursor.emissionEndElapsedSeconds ?? (ended ? originalDuration : elapsed),
    );
    const arrivals: { frame: AcousticFrame; position: number; duration: number }[] = [];
    if (cursor.restorePendingArrivals !== false)
      for (const path of [...frame.paths]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .slice(0, this.budget.maxPathsPerVoice)) {
        const emissionStart = Math.max(0, elapsed - path.absoluteDelayS);
        if (emissionEnd - emissionStart < 1 / context.sampleRate) continue;
        arrivals.push({
          frame: {
            ...structuredClone(frame),
            paths: [
              {
                ...structuredClone(path),
                absoluteDelayS: Math.max(0, emissionStart + path.absoluteDelayS - elapsed),
              },
            ],
          },
          position: Math.max(0, position - (emissionEnd - emissionStart) * rate),
          duration: emissionEnd - emissionStart,
        });
      }
    if (
      [...this.retiring].filter((v) => v.internalArrival).length + arrivals.length >
      this.budget.maxPendingEvents
    )
      return this.reject("PENDING_ARRIVAL_BUDGET");
    const mainPaths = ended ? 0 : Math.min(frame.paths.length, this.budget.maxPathsPerVoice);
    const latePaths = !ended && mainPaths > 0 && this.lateBus?.settings.enabled ? 1 : 0;
    if (this.totalPaths() + mainPaths + latePaths + arrivals.length > this.budget.maxTotalPaths)
      return this.reject("RESTORE_PATH_BUDGET");
    if (latePaths && this.lateSendCount() >= this.budget.maxLateSends)
      return this.reject("LATE_SEND_BUDGET");
    if (
      mainPaths + arrivals.length > 0 &&
      !this.sourceInUse(input.sourceId) &&
      this.activeSourceIds().size >= this.budget.maxSources
    )
      return this.reject("SOURCE_BUDGET");
    if (
      !previous &&
      this.frames.size >= this.budget.maxSourceFrames &&
      ![...this.frames.keys()].some((id) => !this.sourceInUse(id))
    )
      return this.reject("FRAME_SOURCE_BUDGET");
    let admission: VoiceAdmission = {
      accepted: true,
      reason: ended ? "RESTORED_PENDING_OR_ALREADY_COMPLETE" : "RESTORED_SOURCE_CURSOR",
    };
    if (!ended) {
      admission = this.startVoice(
        {
          ...input,
          emissionTimeSeconds: Math.max(input.emissionTimeSeconds, this.simulationEpoch),
          fadeInSeconds: 0,
        },
        frame,
        {
          positionSeconds: position,
          durationSeconds: remaining,
          elapsedSinceEmissionSeconds: elapsed,
        },
      );
      if (!admission.accepted) return admission;
    } else this.updateFrame(frame);
    for (const arrival of arrivals)
      this.startVoice(
        {
          ...input,
          emissionTimeSeconds: Math.max(input.emissionTimeSeconds, this.simulationEpoch),
          instanceId: `\u0000restored-arrival-${++this.arrivalSequence}`,
          continuous: false,
          fadeInSeconds: 0,
          fadeOutSeconds: 0,
        },
        arrival.frame,
        {
          positionSeconds: arrival.position,
          durationSeconds: arrival.duration,
          internalArrival: true,
        },
      );
    this.restoredInstances.add(input.instanceId);
    this.forgetSource(input.sourceId);
    return admission;
  }
  private startVoice(
    input: VoiceInput,
    frame?: AcousticFrame,
    startup: VoiceStart = {},
  ): VoiceAdmission {
    if (this.restartFailed) return this.reject("AUDIO_NOT_ENABLED");
    const context = this.requireContext();
    this.validateVoice(
      startup.durationSeconds !== undefined && startup.durationSeconds !== null
        ? { ...input, durationSeconds: Math.max(0.001, startup.durationSeconds) }
        : input,
    );
    if (frame && frame.sourceId !== input.sourceId) return this.reject("FRAME_SOURCE_MISMATCH");
    if (!this.enabled) return this.reject("AUDIO_NOT_ENABLED");
    if (this.draining) return this.reject("AUDIO_DRAINING");
    if (this.paused) return this.reject("SIMULATION_PAUSED");
    if (
      !startup.internalArrival &&
      !startup.promotion &&
      (this.voices.has(input.instanceId) ||
        this.virtualVoices.has(input.instanceId) ||
        this.demotingVoices.has(input.instanceId))
    )
      return { accepted: true, reason: "ALREADY_PLAYING" };
    if (input.generator.kind === "sample") {
      const asset = this.assets!.get(input.generator.asset.assetId);
      if (!asset) return this.reject("ASSET_NOT_READY");
      if (
        asset.descriptor.revision !== input.generator.asset.revision ||
        (asset.descriptor.sha256 !== null &&
          asset.descriptor.sha256 !== input.generator.asset.sha256)
      )
        return this.reject("ASSET_REFERENCE_MISMATCH");
      const offset = finite(
        input.generator.startOffsetSeconds,
        "sample offset",
        0,
        asset.buffer.duration,
      );
      if (!input.generator.loop && offset >= asset.buffer.duration)
        return this.reject("ASSET_OFFSET_EXPIRED");
    }
    const requested =
      startup.audioTimeSeconds ??
      this.audioEpoch + (input.emissionTimeSeconds - this.simulationEpoch);
    if (
      requested > context.currentTime &&
      (this.nativeCarrierMode ? [...this.carriers] : [...this.voices.values()]).filter(
        (v) => v.startedAudioTime > context.currentTime,
      ).length >= this.budget.maxPendingEvents
    )
      return this.reject("PENDING_EVENT_BUDGET");
    if (frame && !startup.internalArrival) this.updateFrame(frame);
    const currentFrame = startup.internalArrival ? frame : this.frames.get(input.sourceId);
    if (!currentFrame || currentFrame.pathAvailability !== "available")
      return this.reject("ACOUSTIC_FRAME_UNAVAILABLE");
    if (!this.sourceInUse(input.sourceId) && this.activeSourceIds().size >= this.budget.maxSources)
      return this.reject("SOURCE_BUDGET");
    if (
      !this.nativePolicy &&
      !startup.internalArrival &&
      [...this.retiring].filter((v) => !v.internalArrival).length >= this.budget.maxVoices
    )
      return this.reject("RETIRING_VOICE_BUDGET");
    let stolenInstanceId: string | undefined;
    if (
      !this.nativePolicy &&
      !startup.internalArrival &&
      this.voices.size >= this.budget.maxVoices
    ) {
      const victim = [...this.voices.values()].sort(
        (a, b) =>
          (a.input.priority ?? 0) - (b.input.priority ?? 0) ||
          a.input.instanceId.localeCompare(b.input.instanceId),
      )[0];
      if (!victim || (input.priority ?? 0) <= (victim.input.priority ?? 0))
        return this.reject("VOICE_PRIORITY_BUDGET");
      stolenInstanceId = victim.input.instanceId;
      this.stopVoice(stolenInstanceId);
      this.stolenVoices++;
    }
    let startVirtual = false;
    if (
      startup.internalArrival &&
      this.internalArrivalGraphsInUse() >= this.internalArrivalGraphBudget
    )
      return this.reject("INTERNAL_ARRIVAL_BUDGET");
    if (this.nativeCarrierMode && this.carriers.size >= this.nativeCarrierBudget)
      return this.reject("NATIVE_CARRIER_BUDGET");
    if (
      this.nativePolicy &&
      !startup.internalArrival &&
      (this.parentNativeGraphsInUse() >= this.nativeGraphBudget ||
        this.voices.size >= this.nativePolicy.maxNativeVoices)
    ) {
      if (startup.promotion) return this.reject("NATIVE_SLOT_BUSY");
      if (
        this.virtualVoices.size >= this.nativePolicy.maxVirtualVoices ||
        this.voices.size + this.virtualVoices.size + this.demotingVoices.size >=
          this.nativePolicy.maxNativeVoices + this.nativePolicy.maxVirtualVoices
      )
        return this.reject("VIRTUAL_VOICE_BUDGET");
      if (!this.nativeCarrierMode) {
        this.virtualVoices.set(
          input.instanceId,
          this.makeVirtualVoice(input, startup, Math.max(context.currentTime, requested)),
        );
        return { accepted: true, reason: "VIRTUALIZED" };
      }
      startVirtual = true;
    }
    let source: AudioBufferSourceNode | OscillatorNode;
    let duration: number | null =
      this.nativePolicy && startup.authoredDurationSeconds !== undefined
        ? startup.authoredDurationSeconds
        : startup.durationSeconds === undefined
          ? (input.durationSeconds ?? null)
          : startup.durationSeconds;
    let sampleOffset = 0;
    if (input.generator.kind === "sample") {
      const asset = this.assets!.get(input.generator.asset.assetId);
      if (!asset) return this.reject("ASSET_NOT_READY");
      if (
        asset.descriptor.revision !== input.generator.asset.revision ||
        (asset.descriptor.sha256 !== null &&
          asset.descriptor.sha256 !== input.generator.asset.sha256)
      )
        return this.reject("ASSET_REFERENCE_MISMATCH");
      const origin =
        startup.sampleOriginSeconds ??
        (this.preciseNativeCursor && !this.nativeCarrierMode
          ? Math.round(input.generator.startOffsetSeconds * asset.buffer.sampleRate) /
            asset.buffer.sampleRate
          : input.generator.startOffsetSeconds);
      let offset = origin + (startup.positionSeconds ?? 0);
      if (input.generator.loop) offset %= asset.buffer.duration;
      finite(offset, "sample offset", 0, asset.buffer.duration);
      if (!input.generator.loop && offset >= asset.buffer.duration)
        return this.reject("ASSET_OFFSET_EXPIRED");
      sampleOffset = offset;
      const node = context.createBufferSource();
      node.buffer = asset.buffer;
      node.loop = input.generator.loop;
      node.playbackRate.value = startup.resumeRate?.from ?? 2 ** (input.pitchSemitones / 12);
      source = node;
      if (!input.generator.loop && (!this.nativePolicy || this.nativeCarrierMode))
        duration = Math.min(
          duration ?? Infinity,
          (asset.buffer.duration - offset) / node.playbackRate.value,
        );
    } else {
      const node = context.createOscillator();
      node.type = input.generator.waveform;
      node.frequency.value =
        input.generator.frequencyHz *
        (startup.resumeRate?.from ?? 2 ** (input.pitchSemitones / 12));
      if (this.seekableOscillators || startup.positionSeconds)
        this.restoreOscillatorPhase(node, input, startup.positionSeconds ?? 0);
      source = node;
    }
    const contentGain = context.createGain();
    contentGain.gain.value = input.gainLinear;
    const envelope = context.createGain();
    envelope.gain.value = 0;
    let contentFilter: BiquadFilterNode | null = null;
    if (input.filterCutoffHz !== undefined) {
      contentFilter = context.createBiquadFilter();
      contentFilter.type = "lowpass";
      contentFilter.frequency.value = input.filterCutoffHz;
      source.connect(contentFilter);
      contentFilter.connect(contentGain);
    } else source.connect(contentGain);
    contentGain.connect(envelope);
    const renderGate = this.nativeCarrierMode ? context.createGain() : null;
    if (renderGate) {
      renderGate.gain.value = startVirtual ? 0 : 1;
      envelope.connect(renderGate);
      envelope.connect(this.phaseAnchor!);
    }
    const rawMixHandle = startup.internalArrival
      ? null
      : this.rawMixInput!.attach(renderGate ?? envelope);
    if (requested < context.currentTime - 0.001) this.lateEvents++;
    const when = Math.max(context.currentTime, requested);
    this.diagnostics.recordOnset(requested, when);
    const phaseState =
      this.nativePolicy || this.preciseNativeCursor
        ? this.makeVirtualVoice(input, startup, when)
        : null;
    const timeline = phaseState?.timeline ?? null;
    const finiteDuration = this.nativeCarrierMode
      ? duration
      : phaseState && Number.isFinite(phaseState.nativeEndAudioTime)
        ? Math.max(0, phaseState.nativeEndAudioTime - when)
        : (timeline?.read(when).remainingDurationSeconds ?? duration);
    const playing: PlayingVoice = {
      input: structuredClone(input),
      allocationSequence: ++this.nativeSourceSequence,
      source,
      contentGain,
      envelope,
      renderGate,
      rawMixHandle,
      renderedSince: when,
      contentFilter,
      routes: new Map(),
      lateRoute: null,
      active: !startup.internalArrival,
      sourceStopped: false,
      scheduledStopAudioTime: null,
      nativeEofPending: false,
      nativeEndedDeliveryAudioTime: null,
      nativeEndedFlushAudioTime: null,
      startedAudioTime: when,
      durationSeconds: finiteDuration,
      sourceEndAudioTime: finiteDuration === null ? Infinity : when + finiteDuration,
      elapsedBeforeStartSeconds: startup.elapsedSinceEmissionSeconds ?? 0,
      cleanupTimer: null,
      cleanupAudioTime: null,
      internalArrival: startup.internalArrival ?? false,
      restoredCursor: startup.positionSeconds !== undefined,
      historyIncomplete:
        startVirtual ||
        (startup.historyIncomplete ??
          (startup.positionSeconds !== undefined ||
            (this.nativeCarrierMode && !phaseState?.renderCursor))),
      virtualized: false,
      timeline,
      renderCursor: phaseState?.renderCursor ?? null,
      sampleOriginSeconds:
        phaseState?.sampleOriginSeconds ??
        (input.generator.kind === "sample" ? input.generator.startOffsetSeconds : 0),
      rateHistory: [
        {
          time: when,
          position: startup.positionSeconds ?? 0,
          from: startup.resumeRate?.from ?? 2 ** (input.pitchSemitones / 12),
          to: startup.resumeRate?.to ?? 2 ** (input.pitchSemitones / 12),
          end: when + (startup.resumeRate?.remainingSeconds ?? 0),
        },
      ],
    };
    if (this.nativeCarrierMode) {
      this.carriers.add(playing);
      this.nativeCarrierPeak = Math.max(this.nativeCarrierPeak, this.carriers.size);
    }
    if (startVirtual) {
      const saved = phaseState!;
      saved.input = playing.input;
      saved.carrier = playing;
      saved.timeline = playing.timeline!;
      saved.renderCursor = playing.renderCursor;
      this.virtualVoices.set(input.instanceId, saved);
    } else {
      if (startup.internalArrival) this.retiring.add(playing);
      else this.voices.set(input.instanceId, playing);
      this.applyRoutes(playing, currentFrame, true);
    }
    this.nativeCarrierPeak = Math.max(
      this.nativeCarrierPeak,
      this.nativeCarrierMode ? this.carriers.size : this.nativeSlotsInUse(),
    );
    const attack = Math.min(input.fadeInSeconds, (finiteDuration ?? Infinity) / 2);
    const release = Math.min(
      input.fadeOutSeconds,
      Math.max(0, (finiteDuration ?? Infinity) - attack),
    );
    envelope.gain.setValueAtTime(attack === 0 ? 1 : 0, when);
    if (attack > 0) envelope.gain.linearRampToValueAtTime(1, when + attack);
    if (finiteDuration !== null) {
      const end = when + finiteDuration,
        fadeStart = Math.max(when + attack, end - release);
      if (release > 0) {
        envelope.gain.setValueAtTime(1, fadeStart);
        envelope.gain.linearRampToValueAtTime(0, end);
      }
    }
    if (startup.resumeRate && startup.resumeRate.remainingSeconds > 0) {
      const parameter =
        input.generator.kind === "sample"
          ? (source as AudioBufferSourceNode).playbackRate
          : (source as OscillatorNode).frequency;
      const scale = input.generator.kind === "oscillator" ? input.generator.frequencyHz : 1;
      parameter.setValueAtTime(startup.resumeRate.from * scale, when);
      parameter.linearRampToValueAtTime(
        startup.resumeRate.to * scale,
        when + startup.resumeRate.remainingSeconds,
      );
    }
    source.onended = () => {
      if (this.nativeCarrierMode) {
        if (this.disposed || !this.carriers.has(playing)) return;
        playing.nativeEndedDeliveryAudioTime ??= context.currentTime;
        if (this.isOffline()) {
          // A bounded mailbox records delivery, never an inferred native EOF sample.
          playing.nativeEofPending = true;
          return;
        }
      } else if (this.isOffline() && Number.isFinite(playing.sourceEndAudioTime)) return;
      this.sourceEnded(playing);
    };
    try {
      if (input.generator.kind === "sample")
        (source as AudioBufferSourceNode).start(when, sampleOffset);
      else source.start(when);
      if (duration !== null) {
        source.stop(when + duration);
        playing.scheduledStopAudioTime = when + duration;
        playing.sourceStopped = true;
        if (this.nativeCarrierMode) {
          playing.timeline?.stopAt(when + duration);
          playing.renderCursor?.stopAt(when + duration);
        }
      }
    } catch (error) {
      // A failed native start never becomes an accepted logical lifetime.
      for (const collection of [this.virtualVoices, this.demotingVoices])
        if (collection.get(input.instanceId)?.carrier === playing)
          collection.delete(input.instanceId);
      this.cleanupVoice(playing, true);
      throw error;
    }
    return {
      accepted: true,
      ...(startVirtual ? { reason: "VIRTUALIZED" } : {}),
      ...(stolenInstanceId ? { stolenInstanceId } : {}),
    };
  }

  private nativeSlotsInUse(): number {
    return this.voices.size + this.retiring.size;
  }
  private parentNativeGraphsInUse(): number {
    return this.voices.size + [...this.retiring].filter((voice) => !voice.internalArrival).length;
  }
  private internalArrivalGraphsInUse(): number {
    return [...this.retiring].filter((voice) => voice.internalArrival).length;
  }

  private makeVirtualVoice(input: VoiceInput, startup: VoiceStart, when: number): VirtualVoice {
    const rate =
      startup.logicalRateState?.from ??
      startup.resumeRate?.from ??
      2 ** (input.pitchSemitones / 12);
    const asset =
      input.generator.kind === "sample" ? this.assets!.get(input.generator.asset.assetId) : null;
    const timeline = new VirtualVoiceTimeline({
      audioTimeSeconds: when,
      rate,
      positionSeconds: startup.logicalPositionSeconds ?? startup.positionSeconds ?? 0,
      elapsedSeconds: startup.elapsedSinceEmissionSeconds ?? 0,
      durationSeconds:
        startup.authoredDurationSeconds !== undefined
          ? startup.authoredDurationSeconds
          : startup.durationSeconds === undefined
            ? (input.durationSeconds ?? null)
            : startup.durationSeconds,
      ...(input.generator.kind === "sample" && !input.generator.loop && asset
        ? { sourceLimitSeconds: asset.buffer.duration - input.generator.startOffsetSeconds }
        : {}),
    });
    const logicalRate = startup.logicalRateState ?? startup.resumeRate;
    if (logicalRate && logicalRate.remainingSeconds > 0)
      timeline.setRate(logicalRate.to, when, logicalRate.remainingSeconds);
    const sampleOriginSeconds =
      startup.sampleOriginSeconds ??
      (input.generator.kind === "sample" && asset
        ? this.preciseNativeCursor && !this.nativeCarrierMode
          ? Math.round(input.generator.startOffsetSeconds * asset.buffer.sampleRate) /
            asset.buffer.sampleRate
          : input.generator.startOffsetSeconds
        : 0);
    const actualQuantum = this.observedNativeQuantum();
    if (this.preciseNativeCursor && !this.nativeCarrierMode && actualQuantum === null)
      this.nativeRenderQuantum();
    const renderCursor =
      this.preciseNativeCursor &&
      actualQuantum !== null &&
      this.requireContext().sampleRate <= 384000
        ? new NativeSourceCursor({
            audioTimeSeconds: when,
            positionSeconds: startup.positionSeconds ?? 0,
            rate: startup.resumeRate?.from ?? 2 ** (input.pitchSemitones / 12),
            sampleRate: this.requireContext().sampleRate,
            quantumFrames: actualQuantum!,
            parameterScale: input.generator.kind === "oscillator" ? input.generator.frequencyHz : 1,
            rateKind: input.generator.kind === "oscillator" ? "a-rate" : "k-rate",
          })
        : null;
    if (renderCursor && startup.resumeRate && startup.resumeRate.remainingSeconds > 0)
      renderCursor.setRate(startup.resumeRate.to, when, startup.resumeRate.remainingSeconds);
    const saved: VirtualVoice = {
      input: structuredClone(input),
      timeline,
      renderCursor,
      sampleOriginSeconds,
      nativeEndAudioTime: Infinity,
      virtualSince: when,
      frozenAt: null,
      startsAt: when,
    };
    saved.nativeEndAudioTime = this.nativeEndFor(
      saved.input,
      timeline,
      renderCursor,
      sampleOriginSeconds,
      when,
    );
    return saved;
  }

  private observedNativeQuantum(): number | null {
    const context = this.context as (BaseAudioContext & { renderQuantumSize?: number }) | null;
    const quantum = context?.renderQuantumSize;
    return context &&
      Number.isSafeInteger(quantum) &&
      quantum! > 0 &&
      quantum! <= context.sampleRate * 6
      ? quantum!
      : null;
  }
  private nativeRenderQuantum(): number {
    const context = this.requireContext() as BaseAudioContext & { renderQuantumSize?: number };
    const quantum = context.renderQuantumSize;
    if (!Number.isSafeInteger(quantum) || quantum! < 1 || quantum! > context.sampleRate * 6)
      throw new AudioEngineError(
        "NATIVE_RENDER_QUANTUM_UNAVAILABLE",
        "Actual context renderQuantumSize is required for the native cursor model",
      );
    return quantum!;
  }
  private clampSamplePosition(input: VoiceInput, position: number): number {
    if (input.generator.kind !== "sample" || input.generator.loop) return position;
    const asset = this.assets!.get(input.generator.asset.assetId);
    return Math.min(
      position,
      Math.max(0, (asset?.buffer.duration ?? 0) - input.generator.startOffsetSeconds),
    );
  }
  private nativeEndFor(
    input: VoiceInput,
    timeline: VirtualVoiceTimeline,
    phase: NativeSourceCursor | null,
    origin: number,
    time: number,
  ): number {
    const authored = timeline.authoredRemainingSeconds(time);
    let end = authored === null ? Infinity : time + authored;
    if (phase && input.generator.kind === "sample" && !input.generator.loop) {
      const limit = this.assets!.get(input.generator.asset.assetId)!.buffer.duration - origin;
      const position = phase.readPosition(time);
      if (position >= limit) return time;
      const rate = phase.rateState(time);
      let low = time;
      let high =
        time +
        (limit - position) / Math.min(rate.from, rate.to) +
        rate.remainingSeconds +
        this.nativeRenderQuantum() / this.requireContext().sampleRate;
      for (let iteration = 0; iteration < 48; iteration++) {
        const middle = (low + high) / 2;
        if (phase.readPosition(middle) < limit) low = middle;
        else high = middle;
      }
      end = Math.min(end, high);
    } else if (!phase) {
      const remaining = timeline.read(time).remainingDurationSeconds;
      end = remaining === null ? Infinity : time + remaining;
    }
    return end;
  }

  /** Bounded main/control-thread checkpoint; never called by an audio callback. */
  serviceNativeVoices(): void {
    if (
      !this.nativePolicy ||
      !this.context ||
      !this.enabled ||
      this.paused ||
      this.disposed ||
      this.draining ||
      this.servicingNativeVoices
    )
      return;
    this.servicingNativeVoices = true;
    try {
      const now = this.context.currentTime;
      for (const voice of this.nativeCarrierMode ? [...this.carriers] : [...this.voices.values()])
        if (
          this.nativeCarrierMode
            ? voice.scheduledStopAudioTime !== null && voice.scheduledStopAudioTime <= now
            : voice.sourceEndAudioTime <= now
        ) {
          this.sourceEnded(voice);
          if (!this.nativeCarrierMode)
            voice.cleanupAudioTime = voice.sourceEndAudioTime + this.voiceTailSeconds(voice);
        }
      for (const voice of new Set([...this.retiring, ...this.carriers]))
        if (voice.cleanupAudioTime !== null && voice.cleanupAudioTime <= now + 1e-9)
          this.cleanupVoice(voice);
      for (const collection of [this.virtualVoices, this.demotingVoices])
        for (const [id, voice] of collection)
          if (!voice.carrier && voice.nativeEndAudioTime <= now) {
            collection.delete(id);
            this.virtualExpirations++;
            this.options.onVoiceEnded?.(id);
            this.forgetSource(voice.input.sourceId);
          }
      const desired = new Set(
        selectNativeVoices(
          [
            ...[...this.voices.values()].map((voice) => ({
              instanceId: voice.input.instanceId,
              priority: voice.input.priority ?? 0,
              nativeSince: voice.renderedSince,
              virtualSince: null,
            })),
            ...[...this.virtualVoices.values(), ...this.demotingVoices.values()].map((voice) => ({
              instanceId: voice.input.instanceId,
              priority: voice.input.priority ?? 0,
              nativeSince: null,
              virtualSince: voice.virtualSince,
            })),
          ],
          this.nativePolicy,
          now,
        ),
      );
      for (const voice of [...this.voices.values()])
        if (!desired.has(voice.input.instanceId)) {
          if (this.demotingVoices.size >= this.nativePolicy.maxNativeVoices) break;
          if (this.nativeCarrierMode) {
            const parked: VirtualVoice = {
              input: voice.input,
              timeline: voice.timeline!,
              renderCursor: voice.renderCursor,
              sampleOriginSeconds: voice.sampleOriginSeconds,
              nativeEndAudioTime: voice.sourceEndAudioTime,
              virtualSince: now,
              frozenAt: null,
              startsAt: voice.startedAudioTime,
              carrier: voice,
            };
            this.demotingVoices.set(voice.input.instanceId, parked);
            this.liveMonitor?.disposeVoice(voice.input.instanceId, voice.envelope);
            voice.virtualized = true;
            voice.historyIncomplete = true;
            this.voices.delete(voice.input.instanceId);
            this.retiring.add(voice);
            smooth(voice.renderGate!.gain, 0, now, 0.02);
            this.scheduleCleanup(voice, 0.02 + this.voiceTailSeconds(voice));
            this.virtualDemotions++;
            continue;
          }
          const point =
            [...voice.rateHistory].reverse().find((entry) => entry.time <= now) ??
            voice.rateHistory[0]!;
          const progress =
            point.end > point.time
              ? Math.min(1, Math.max(0, (now - point.time) / (point.end - point.time)))
              : 1;
          const onset = Math.max(now, voice.startedAudioTime);
          const cursor = voice.timeline?.read(onset) ?? {
            playheadSeconds: this.voicePositionAt(voice, onset),
            elapsedSinceEmissionSeconds:
              voice.elapsedBeforeStartSeconds + onset - voice.startedAudioTime,
            remainingDurationSeconds: Number.isFinite(voice.sourceEndAudioTime)
              ? voice.sourceEndAudioTime - onset
              : null,
          };
          const parked = this.makeVirtualVoice(
            voice.input,
            {
              positionSeconds: voice.renderCursor?.readPosition(onset) ?? cursor.playheadSeconds,
              logicalPositionSeconds: cursor.playheadSeconds,
              ...(voice.timeline
                ? {
                    logicalRateState: voice.timeline.rateState(onset),
                    authoredDurationSeconds: voice.timeline.authoredRemainingSeconds(onset),
                  }
                : {}),
              sampleOriginSeconds: voice.sampleOriginSeconds,
              elapsedSinceEmissionSeconds: cursor.elapsedSinceEmissionSeconds,
              durationSeconds: cursor.remainingDurationSeconds,
              resumeRate: voice.renderCursor?.rateState(onset) ??
                voice.timeline?.rateState(onset) ?? {
                  from: point.from + (point.to - point.from) * progress,
                  to: point.to,
                  remainingSeconds: Math.max(0, point.end - onset),
                },
            },
            onset,
          );
          this.demotingVoices.set(voice.input.instanceId, parked);
          this.liveMonitor?.disposeVoice(voice.input.instanceId, voice.envelope);
          voice.virtualized = true;
          voice.active = false;
          this.voices.delete(voice.input.instanceId);
          if (voice.startedAudioTime > now) this.cleanupVoice(voice);
          else {
            this.retiring.add(voice);
            const stopAt = Math.min(voice.sourceEndAudioTime, now + 0.02);
            smooth(voice.envelope.gain, 0, now, Math.max(0, stopAt - now));
            voice.source.stop(stopAt);
            voice.sourceEndAudioTime = stopAt;
            voice.sourceStopped = true;
            this.scheduleCleanup(voice, Math.max(0, stopAt - now) + this.voiceTailSeconds(voice));
          }
          this.virtualDemotions++;
        }
      for (const id of desired) {
        if (
          this.voices.has(id) ||
          this.voices.size >= this.nativePolicy.maxNativeVoices ||
          this.parentNativeGraphsInUse() >= this.nativeGraphBudget
        )
          continue;
        if ([...this.retiring].some((voice) => voice.virtualized && voice.input.instanceId === id))
          continue;
        const collection = this.virtualVoices.has(id) ? this.virtualVoices : this.demotingVoices;
        const saved = collection.get(id);
        if (!saved) continue;
        const onset = Math.max(now, saved.startsAt);
        const cursor = saved.timeline.read(onset);
        const frame = this.frames.get(saved.input.sourceId);
        if (!frame) continue;
        if (saved.carrier) {
          const carrier = saved.carrier;
          carrier.virtualized = false;
          carrier.historyIncomplete = true;
          carrier.renderedSince = now;
          this.voices.set(id, carrier);
          this.applyRoutes(carrier, frame, true);
          smooth(carrier.renderGate!.gain, 1, now, 0.02);
          collection.delete(id);
          this.virtualPromotions++;
          continue;
        }
        const result = this.startVoice({ ...saved.input, fadeInSeconds: 0.02 }, frame, {
          promotion: true,
          audioTimeSeconds: onset,
          positionSeconds: saved.renderCursor?.readPosition(onset) ?? cursor.playheadSeconds,
          logicalPositionSeconds: cursor.playheadSeconds,
          logicalRateState: saved.timeline.rateState(onset),
          sampleOriginSeconds: saved.sampleOriginSeconds,
          elapsedSinceEmissionSeconds: cursor.elapsedSinceEmissionSeconds,
          durationSeconds: cursor.remainingDurationSeconds,
          authoredDurationSeconds: saved.timeline.authoredRemainingSeconds(onset),
          resumeRate: saved.renderCursor?.rateState(onset) ?? saved.timeline.rateState(onset),
          historyIncomplete: true,
        });
        if (result.accepted) {
          collection.delete(id);
          this.virtualPromotions++;
        }
      }
      // Demotion cursors have a separate maxNativeVoices transition budget. This keeps
      // accepted logical voices and outgoing tails bounded even when the virtual queue is full.
      for (const [id, saved] of this.demotingVoices)
        if (
          this.virtualVoices.size < this.nativePolicy.maxVirtualVoices &&
          ![...this.retiring].some((voice) => voice.virtualized && voice.input.instanceId === id)
        ) {
          this.virtualVoices.set(id, saved);
          this.demotingVoices.delete(id);
        }
    } finally {
      this.servicingNativeVoices = false;
    }
  }

  private voicePositionAt(voice: PlayingVoice, time: number): number {
    if (voice.timeline) return voice.timeline.read(time).playheadSeconds;
    time = Math.min(time, voice.sourceEndAudioTime);
    const point =
      [...voice.rateHistory].reverse().find((p) => p.time <= time) ?? voice.rateHistory[0]!;
    const dt = Math.max(0, time - point.time),
      ramp = point.end - point.time;
    const rampTime = Math.min(dt, Math.max(0, ramp));
    return (
      point.position +
      (ramp > 0
        ? point.from * rampTime + ((point.to - point.from) * rampTime * rampTime) / (2 * ramp)
        : 0) +
      point.to * (dt - rampTime)
    );
  }
  private restoreOscillatorPhase(node: OscillatorNode, input: VoiceInput, position: number): void {
    if (input.generator.kind !== "oscillator") return;
    const phase = 2 * Math.PI * ((input.generator.frequencyHz * position) % 1);
    const harmonics = Math.max(
      1,
      Math.min(
        256,
        Math.floor(
          this.requireContext().sampleRate /
            (2 * (this.seekableOscillators ? input.generator.frequencyHz : node.frequency.value)),
        ),
      ),
    );
    const real = new Float32Array(harmonics + 1),
      imag = new Float32Array(harmonics + 1);
    for (let k = 1; k <= harmonics; k++) {
      let amplitude = 0;
      switch (input.generator.waveform) {
        case "sine":
          amplitude = k === 1 ? 1 : 0;
          break;
        case "square":
          amplitude = k % 2 ? 4 / (Math.PI * k) : 0;
          break;
        case "triangle":
          amplitude = k % 2 ? (8 * (-1) ** ((k - 1) / 2)) / (Math.PI ** 2 * k ** 2) : 0;
          break;
        case "sawtooth":
          amplitude = -2 / (Math.PI * k);
          break;
      }
      real[k] = amplitude * Math.sin(k * phase);
      imag[k] = amplitude * Math.cos(k * phase);
    }
    node.setPeriodicWave(
      this.requireContext().createPeriodicWave(real, imag, { disableNormalization: true }),
    );
  }

  updateVoice(instanceId: string, update: VoiceUpdate): void {
    if (this.restartFailed) return;
    const virtual = this.virtualVoices.get(instanceId) ?? this.demotingVoices.get(instanceId);
    const voice = this.voices.get(instanceId) ?? virtual?.carrier;
    const pending =
      this.pendingOnResume.get(instanceId) ?? this.frozenOnResume.get(instanceId)?.input;
    if (!voice && !pending && !virtual) return;
    const input = voice?.input ?? virtual?.input ?? pending!;
    const now = this.requireContext().currentTime;
    const smoothing = Math.max(
      this.controlInterval === 0.05 ? 0.05 : 0,
      finite(update.smoothingSeconds ?? 0.02, "smoothing", 0, 2),
    );
    const ramp = smoothTarget;
    if (update.gainLinear !== undefined) finite(update.gainLinear, "voice gain", 0, 4);
    if (update.pitchSemitones !== undefined) {
      finite(update.pitchSemitones, "pitch", -48, 48);
      if (
        input.generator.kind === "oscillator" &&
        input.generator.frequencyHz * 2 ** (update.pitchSemitones / 12) >=
          this.requireContext().sampleRate / 2
      )
        throw new AudioEngineError("OSCILLATOR_OUT_OF_BAND", "Authored pitch exceeds Nyquist");
    }
    if (update.filterCutoffHz !== undefined) {
      finite(update.filterCutoffHz, "filter cutoff", 20, 20000);
      if (voice ? !voice.contentFilter : input.filterCutoffHz === undefined)
        throw new AudioEngineError(
          "FILTER_NOT_ALLOCATED",
          "Changing filter topology requires safe authoring boundary",
        );
    }
    if (virtual && !voice) {
      if (update.gainLinear !== undefined) input.gainLinear = update.gainLinear;
      if (
        update.pitchSemitones !== undefined &&
        Math.abs(update.pitchSemitones - input.pitchSemitones) > 1e-5
      ) {
        virtual.timeline.setRate(2 ** (update.pitchSemitones / 12), now, smoothing);
        virtual.renderCursor?.setRate(2 ** (update.pitchSemitones / 12), now, smoothing);
        virtual.nativeEndAudioTime = this.nativeEndFor(
          input,
          virtual.timeline,
          virtual.renderCursor,
          virtual.sampleOriginSeconds,
          Math.max(now, virtual.startsAt),
        );
        input.pitchSemitones = update.pitchSemitones;
      }
      if (update.filterCutoffHz !== undefined) input.filterCutoffHz = update.filterCutoffHz;
      return;
    }
    if (pending) {
      if (update.gainLinear !== undefined) pending.gainLinear = update.gainLinear;
      if (update.pitchSemitones !== undefined) pending.pitchSemitones = update.pitchSemitones;
      if (update.filterCutoffHz !== undefined) pending.filterCutoffHz = update.filterCutoffHz;
      return;
    }
    if (!voice) return;
    if (update.gainLinear !== undefined) {
      voice.input.gainLinear = finite(update.gainLinear, "voice gain", 0, 4);
      ramp(voice.contentGain.gain, update.gainLinear, now, smoothing);
    }
    if (
      update.pitchSemitones !== undefined &&
      Math.abs(update.pitchSemitones - input.pitchSemitones) > 1e-5
    ) {
      const point = voice.rateHistory[voice.rateHistory.length - 1]!;
      const progress =
        point.end > point.time
          ? Math.min(1, Math.max(0, (now - point.time) / (point.end - point.time)))
          : 1;
      const from = point.from + (point.to - point.from) * progress;
      const to = 2 ** (update.pitchSemitones / 12);
      const parameter =
        voice.input.generator.kind === "sample"
          ? (voice.source as AudioBufferSourceNode).playbackRate
          : (voice.source as OscillatorNode).frequency;
      const nativeAnchor = this.nativeCarrierMode
        ? undefined
        : voice.renderCursor?.rateState(now).from;
      voice.renderCursor?.setRate(
        to,
        now,
        smoothing,
        this.nativeCarrierMode ? parameter.value : undefined,
      );
      if (voice.timeline) {
        voice.timeline.setRate(to, now, smoothing);
        const remaining = voice.timeline.read(now).remainingDurationSeconds;
        const previousEnd = voice.sourceEndAudioTime;
        voice.sourceEndAudioTime = voice.renderCursor
          ? this.nativeEndFor(
              voice.input,
              voice.timeline,
              voice.renderCursor,
              voice.sampleOriginSeconds,
              Math.max(now, voice.startedAudioTime),
            )
          : remaining === null
            ? Infinity
            : Math.max(now, voice.startedAudioTime) + remaining;
        voice.durationSeconds = Number.isFinite(voice.sourceEndAudioTime)
          ? voice.sourceEndAudioTime - voice.startedAudioTime
          : null;
        if (
          !this.nativeCarrierMode &&
          voice.sourceEndAudioTime !== previousEnd &&
          Number.isFinite(voice.sourceEndAudioTime)
        ) {
          const end = voice.sourceEndAudioTime;
          const attackEnd = Math.min(voice.startedAudioTime + voice.input.fadeInSeconds, end);
          const held = voice.envelope.gain.value;
          voice.envelope.gain.cancelAndHoldAtTime(now);
          voice.envelope.gain.setValueAtTime(held, now);
          if (attackEnd > now) voice.envelope.gain.linearRampToValueAtTime(1, attackEnd);
          const release = Math.min(
            voice.input.fadeOutSeconds,
            Math.max(0, end - Math.max(now, attackEnd)),
          );
          if (release > 0) {
            voice.envelope.gain.setValueAtTime(1, end - release);
            voice.envelope.gain.linearRampToValueAtTime(0, end);
          }
        }
      }
      const position = this.voicePositionAt(voice, now);
      // Continuous automation still begins now. Integrate only the portion heard
      // after source onset, even when several pitch targets arrive before it.
      const time = Math.max(now, voice.startedAudioTime);
      const onsetProgress = smoothing > 0 ? Math.min(1, (time - now) / smoothing) : 1;
      const onsetRate = from + (to - from) * onsetProgress;
      voice.rateHistory.push({
        time,
        position,
        from: onsetRate,
        to,
        end: Math.max(time, now + smoothing),
      });
      // Five-second propagation window plus one preceding anchor, never an unbounded control log.
      while (
        voice.rateHistory.length > 2 &&
        (voice.rateHistory[1]!.time < now - 5.1 || voice.rateHistory.length > 512)
      )
        voice.rateHistory.shift();
      voice.input.pitchSemitones = finite(update.pitchSemitones, "pitch", -48, 48);
      if (nativeAnchor !== undefined) {
        // Both native and virtual controls use the same explicit clock anchor.
        // AudioParam.value may represent a previous processed block or a future target.
        const scale =
          voice.input.generator.kind === "oscillator" ? voice.input.generator.frequencyHz : 1;
        parameter.cancelScheduledValues(now);
        parameter.setValueAtTime(nativeAnchor * scale, now);
        if (smoothing === 0) parameter.setValueAtTime(to * scale, now);
        else parameter.linearRampToValueAtTime(to * scale, now + smoothing);
      } else if (voice.input.generator.kind === "sample")
        ramp((voice.source as AudioBufferSourceNode).playbackRate, to, now, smoothing, 0);
      else
        ramp(
          (voice.source as OscillatorNode).frequency,
          voice.input.generator.frequencyHz * to,
          now,
          smoothing,
          0,
        );
    }
    if (virtual?.carrier === voice) virtual.nativeEndAudioTime = voice.sourceEndAudioTime;
    if (update.filterCutoffHz !== undefined) {
      finite(update.filterCutoffHz, "filter cutoff", 20, 20000);
      if (!voice.contentFilter)
        throw new AudioEngineError(
          "FILTER_NOT_ALLOCATED",
          "Changing filter topology requires safe authoring boundary",
        );
      ramp(voice.contentFilter.frequency, update.filterCutoffHz, now, smoothing);
    }
  }

  updateFrame(frame: AcousticFrame): void {
    const started = this.diagnostics.enabled ? performance.now() : null;
    let decision: AudioFrameDecision = "error";
    try {
      if (this.restartFailed) {
        decision = "restart-blocked";
        return;
      }
      const context = this.requireContext();
      try {
        validateFrame(frame, context.sampleRate);
      } catch (error) {
        decision = "invalid";
        throw error;
      }
      const previous = this.frames.get(frame.sourceId);
      const regressed =
        previous &&
        (frame.sceneRevision < previous.sceneRevision ||
          frame.geometryRevision < previous.geometryRevision ||
          (frame.sceneRevision === previous.sceneRevision &&
            frame.geometryRevision === previous.geometryRevision &&
            frame.poseTick < previous.poseTick));
      if (frame.stale || regressed) {
        decision = "stale";
        this.staleFrames++;
        return;
      }
      if (frame.pathAvailability !== "available") {
        decision = "unavailable";
        this.lastError = "ACOUSTIC_FRAME_UNAVAILABLE";
        return;
      }
      if (!previous && this.frames.size >= this.budget.maxSourceFrames) {
        const inactive = [...this.frames.keys()].find((id) => !this.sourceInUse(id));
        if (inactive) this.frames.delete(inactive);
        else {
          decision = "source-budget";
          this.lastError = "FRAME_SOURCE_BUDGET";
          return;
        }
      }
      this.frames.set(frame.sourceId, structuredClone(frame));
      for (const voice of this.voices.values())
        if (voice.input.sourceId === frame.sourceId) this.applyRoutes(voice, frame);
      decision = "accepted";
    } finally {
      if (started !== null) this.diagnostics.recordFrame(decision, performance.now() - started);
    }
  }

  /** Turn control-thread observation on/off without touching voices or the native graph. */
  setDiagnosticsEnabled(enabled: boolean): void {
    this.diagnostics.setEnabled(enabled);
  }

  /** Runtime-side batch rejection is distinct from per-source native consumer admission. */
  recordAcousticDelivery(observation: AcousticDeliveryObservation): void {
    this.diagnostics.recordDelivery(observation);
  }

  /** Explicit audio-clock checkpoint for offline controls and pending filter-bank work. */
  flushControlUpdates(): void {
    for (const collection of [this.voices.values(), this.retiring.values()])
      for (const voice of collection) {
        for (const route of voice.routes.values()) {
          route.flushControlUpdates();
          this.maximumFilterDelay = Math.max(this.maximumFilterDelay, route.groupDelaySeconds);
        }
        voice.lateRoute?.flushControlUpdates();
      }
    for (const route of this.retiredRoutes) route.flushControlUpdates();
    if (this.disposed || !this.isOffline()) return;
    const now = this.requireContext().currentTime;
    // Offline rendering may advance past native onended delivery in one task.
    // Scheduled source time, including internal arrivals, owns graph lifetime.
    for (const voice of new Set([...this.voices.values(), ...this.retiring, ...this.carriers])) {
      if (this.nativeCarrierMode && this.carriers.has(voice)) {
        if (
          voice.nativeEofPending ||
          (voice.cleanupAudioTime === null &&
            voice.scheduledStopAudioTime !== null &&
            voice.scheduledStopAudioTime <= now)
        )
          this.sourceEnded(voice);
      } else if (voice.cleanupAudioTime === null && voice.sourceEndAudioTime <= now)
        this.sourceEnded(voice);
    }
    for (const [route, deadline] of this.offlineRouteDeadlines)
      if (now + 1e-9 >= deadline) {
        route.disconnect();
        this.offlineRouteDeadlines.delete(route);
        this.retiredRoutes.delete(route);
        this.retiredLateRoutes.delete(route);
      }
    for (const voice of new Set([...this.retiring, ...this.carriers]))
      if (voice.cleanupAudioTime !== null && now + 1e-9 >= voice.cleanupAudioTime)
        this.cleanupVoice(voice);
  }

  private activeSourceIds(): Set<string> {
    return new Set([
      ...[...this.voices.values(), ...this.retiring, ...this.carriers].map((v) => v.input.sourceId),
      ...[...this.pendingOnResume.values()].map((v) => v.sourceId),
      ...[...this.virtualVoices.values(), ...this.demotingVoices.values()].map(
        (v) => v.input.sourceId,
      ),
      ...[...this.frozenOnResume.values()].map((v) => v.input.sourceId),
    ]);
  }
  private sourceInUse(sourceId: string): boolean {
    return this.activeSourceIds().has(sourceId);
  }
  /** Release an inactive source's cached solver frame; active/pending arrivals keep their frame. */
  forgetSource(sourceId: string): boolean {
    if (this.sourceInUse(sourceId)) return false;
    return this.frames.delete(sourceId);
  }

  private totalPaths(): number {
    return (
      [...this.voices.values(), ...this.retiring].reduce((n, v) => n + v.routes.size, 0) +
      [...this.voices.values(), ...this.retiring].filter((v) => v.lateRoute).length +
      this.retiredRoutes.size
    );
  }
  private applyRoutes(voice: PlayingVoice, frame: AcousticFrame, initialVoice = false): void {
    const ranked = [...frame.paths].sort(
      (a, b) =>
        a.order - b.order ||
        Math.max(...b.bandGains) - Math.max(...a.bandGains) ||
        a.id.localeCompare(b.id),
    );
    const wanted = ranked.slice(0, this.budget.maxPathsPerVoice);
    this.droppedPaths += Math.max(0, ranked.length - wanted.length);
    const ids = new Set(wanted.map((p) => p.id));
    for (const [id, route] of voice.routes)
      if (!ids.has(id)) {
        voice.routes.delete(id);
        this.retireRoute(route);
      }
    for (const path of wanted) {
      const old = voice.routes.get(path.id);
      if (old) {
        old.update(frame, path, this.listenerPosition);
        this.maximumFilterDelay = Math.max(this.maximumFilterDelay, old.groupDelaySeconds);
        continue;
      }
      if (this.totalPaths() >= this.budget.maxTotalPaths) {
        this.droppedPaths++;
        continue;
      }
      const route = new PathRoute(
        this.requireContext(),
        voice.renderGate ?? voice.envelope,
        this.simulatedMixInput!,
        frame,
        path,
        this.routePanningModel(path.order === 0),
        this.listenerPosition,
        !initialVoice,
        this.controlInterval,
        this.diagnostics,
      );
      voice.routes.set(path.id, route);
      this.maximumFilterDelay = Math.max(this.maximumFilterDelay, route.groupDelaySeconds);
    }
    this.applyLateRoute(voice, frame, !initialVoice);
  }

  private routePanningModel(directPath: boolean): PanningModelType {
    return this.options.hrtfScope === "directPath" && !directPath
      ? "equalpower"
      : (this.options.spatializationModel ?? "HRTF");
  }

  private lateSendCount(): number {
    return (
      [...this.voices.values(), ...this.retiring].filter((v) => v.lateRoute).length +
      this.retiredLateRoutes.size
    );
  }
  private applyLateRoute(voice: PlayingVoice, frame: AcousticFrame, fadeIn = true): void {
    const path = [...frame.paths].sort(
      (a, b) => a.absoluteDelayS - b.absoluteDelayS || a.id.localeCompare(b.id),
    )[0];
    if (voice.internalArrival || !this.lateBus?.settings.enabled || !path) {
      if (voice.lateRoute) {
        this.retireRoute(voice.lateRoute, true);
        voice.lateRoute = null;
      }
      return;
    }
    if (voice.lateRoute?.id === path.id) {
      voice.lateRoute.update(frame, path, this.listenerPosition);
      return;
    }
    if (voice.lateRoute) {
      this.retireRoute(voice.lateRoute, true);
      voice.lateRoute = null;
    }
    if (
      this.totalPaths() >= this.budget.maxTotalPaths ||
      this.lateSendCount() >= this.budget.maxLateSends
    ) {
      this.droppedPaths++;
      this.lastError = "LATE_SEND_BUDGET";
      return;
    }
    voice.lateRoute = new PathRoute(
      this.requireContext(),
      voice.renderGate ?? voice.envelope,
      this.lateBus.inputMix,
      frame,
      path,
      this.routePanningModel(false),
      this.listenerPosition,
      fadeIn,
      this.controlInterval,
      this.diagnostics,
    );
  }

  private retireRoute(route: PathRoute, late = false): void {
    route.fadeOut();
    this.retiredRoutes.add(route);
    if (late) this.retiredLateRoutes.add(route);
    const deadline =
      this.requireContext().currentTime + ROUTE_FADE_SECONDS + ROUTE_RETIRE_TAIL_SECONDS;
    if (this.isOffline()) {
      this.offlineRouteDeadlines.set(route, deadline);
      return;
    }
    const poll = () => {
      const timer = setTimeout(
        () => {
          this.routeTimers.delete(timer);
          if ((this.context?.currentTime ?? deadline) + 1e-6 < deadline) poll();
          else {
            route.disconnect();
            this.retiredRoutes.delete(route);
            this.retiredLateRoutes.delete(route);
          }
        },
        Math.max(10, Math.min(1000, (deadline - this.requireContext().currentTime) * 1000 + 5)),
      );
      this.routeTimers.add(timer);
    };
    poll();
  }
  updateListener(pose: ListenerPose): void {
    const context = this.context;
    if (!context || !this.enabled || this.rebuilding || this.disposed) return;
    const started = this.diagnostics.enabled ? performance.now() : null;
    try {
      const p = vector(pose.positionM, "listener position"),
        f = unit(pose.forward),
        u = unit(pose.up);
      if (Math.abs(f[0] * u[0] + f[1] * u[1] + f[2] * u[2]) > 0.01)
        throw new AudioEngineError("INVALID_LISTENER_BASIS", "Forward/up must be orthogonal");
      this.listenerPosition = p;
      const params = [
        context.listener.positionX,
        context.listener.positionY,
        context.listener.positionZ,
        context.listener.forwardX,
        context.listener.forwardY,
        context.listener.forwardZ,
        context.listener.upX,
        context.listener.upY,
        context.listener.upZ,
      ];
      [...p, ...f, ...u].forEach((value, i) => {
        const param = params[i];
        if (param)
          smoothTarget(
            param,
            value,
            context.currentTime,
            i < 3 ? ROUTE_DIRECTION_RAMP_SECONDS : LISTENER_TURN_RAMP_SECONDS,
            i < 3 ? 1e-4 : 1e-5,
          );
      });
      for (const voice of this.voices.values())
        for (const route of [
          ...voice.routes.values(),
          ...(voice.lateRoute ? [voice.lateRoute] : []),
        ])
          route.updateListener(p);
    } finally {
      if (started !== null) this.diagnostics.timing("listenerControl", performance.now() - started);
    }
  }

  stopVoice(instanceId: string, fadeSeconds?: number): void {
    const virtual = this.virtualVoices.get(instanceId) ?? this.demotingVoices.get(instanceId);
    if (virtual) {
      this.virtualVoices.delete(instanceId);
      this.demotingVoices.delete(instanceId);
      if (virtual.carrier) {
        this.stopPlayingVoice(virtual.carrier, fadeSeconds);
        return;
      }
      this.forgetSource(virtual.input.sourceId);
      this.options.onVoiceEnded?.(instanceId);
      return;
    }
    const frozen = this.frozenOnResume.get(instanceId);
    if (frozen) {
      this.frozenOnResume.delete(instanceId);
      this.forgetSource(frozen.input.sourceId);
      if (!frozen.ended && !frozen.internalArrival) this.options.onVoiceEnded?.(instanceId);
      return;
    }
    const pending = this.pendingOnResume.get(instanceId);
    if (pending) {
      this.pendingOnResume.delete(instanceId);
      this.forgetSource(pending.sourceId);
      this.options.onVoiceEnded?.(instanceId);
      return;
    }
    const voice = this.voices.get(instanceId);
    if (voice) this.stopPlayingVoice(voice, fadeSeconds);
  }

  private stopPlayingVoice(voice: PlayingVoice, fadeSeconds?: number): void {
    const instanceId = voice.input.instanceId;
    if (!voice.active && !voice.internalArrival) return;
    const wasRendered = this.voices.get(instanceId) === voice || this.retiring.has(voice);
    const context = this.requireContext(),
      fade = finite(fadeSeconds ?? voice.input.fadeOutSeconds, "voice fade", 0, 30);
    smooth(voice.envelope.gain, 0, context.currentTime, Math.max(0.001, fade));
    this.liveMonitor?.disposeVoice(voice.input.instanceId, voice.envelope);
    voice.active = false;
    if (this.voices.get(instanceId) === voice) this.voices.delete(instanceId);
    if (!this.nativeCarrierMode || wasRendered || voice.routes.size || voice.lateRoute)
      this.retiring.add(voice);
    const stopAt = Math.min(
      this.nativeCarrierMode
        ? (voice.scheduledStopAudioTime ?? Infinity)
        : voice.sourceEndAudioTime,
      context.currentTime + Math.max(0.001, fade),
    );
    voice.source.stop(stopAt);
    voice.scheduledStopAudioTime = stopAt;
    voice.sourceEndAudioTime = Math.min(voice.sourceEndAudioTime, stopAt);
    voice.timeline?.stopAt(stopAt);
    voice.renderCursor?.stopAt(stopAt);
    voice.sourceStopped = true;
    this.scheduleCleanup(
      voice,
      Math.max(0.001, fade) + this.voiceTailSeconds(voice),
      this.nativeCarrierMode ? stopAt + this.voiceTailSeconds(voice) : undefined,
    );
    this.options.onVoiceEnded?.(instanceId);
  }

  private sourceEnded(voice: PlayingVoice): void {
    if (
      this.isOffline() &&
      (this.disposed ||
        (this.voices.get(voice.input.instanceId) !== voice &&
          !this.retiring.has(voice) &&
          !this.carriers.has(voice)))
    )
      return;
    if (this.nativeCarrierMode && this.carriers.has(voice)) {
      voice.nativeEofPending = false;
      if (voice.input.generator.kind === "sample" && !voice.input.generator.loop)
        voice.historyIncomplete = true; // Native ended never exposes the EOF sample time.
      // The first completed emission owns its retirement deadline. A later
      // legacy cutoff or duplicate event cannot retire the same tail again.
      const now = this.requireContext().currentTime;
      if (!voice.active && voice.cleanupAudioTime !== null) {
        if (voice.cleanupAudioTime <= now + 1e-9) this.cleanupVoice(voice);
        return;
      }
      const scheduled =
        voice.scheduledStopAudioTime !== null && voice.scheduledStopAudioTime <= now;
      if (!scheduled && voice.nativeEndedDeliveryAudioTime !== null)
        voice.nativeEndedFlushAudioTime ??= now;
      voice.nativeEofPending = false;
      const id = voice.input.instanceId;
      const wasRendered = this.voices.get(id) === voice || this.retiring.has(voice);
      const endedLogical = voice.active && !voice.internalArrival;
      this.liveMonitor?.disposeVoice(voice.input.instanceId, voice.envelope);
      voice.active = false;
      if (this.voices.get(id) === voice) this.voices.delete(id);
      for (const collection of [this.virtualVoices, this.demotingVoices])
        if (collection.get(id)?.carrier === voice) collection.delete(id);
      if (endedLogical) this.options.onVoiceEnded?.(id);
      if (!wasRendered && voice.routes.size === 0 && !voice.lateRoute) {
        this.cleanupVoice(voice, true);
        return;
      }
      this.retiring.add(voice);
      const tailDeadline =
        (scheduled ? voice.scheduledStopAudioTime! : (voice.nativeEndedFlushAudioTime ?? now)) +
        this.voiceTailSeconds(voice);
      this.scheduleCleanup(voice, Math.max(0, tailDeadline - now), tailDeadline);
      return;
    }
    const tailRemaining = Math.max(
      0,
      (Number.isFinite(voice.sourceEndAudioTime)
        ? voice.sourceEndAudioTime
        : this.requireContext().currentTime) +
        this.voiceTailSeconds(voice) -
        this.requireContext().currentTime,
    );
    if (voice.virtualized) {
      this.scheduleCleanup(voice, tailRemaining);
      return;
    }
    if (voice.active) {
      this.liveMonitor?.disposeVoice(voice.input.instanceId, voice.envelope);
      voice.active = false;
      if (this.voices.get(voice.input.instanceId) === voice)
        this.voices.delete(voice.input.instanceId);
      this.retiring.add(voice);
      this.options.onVoiceEnded?.(voice.input.instanceId);
    }
    this.scheduleCleanup(voice, tailRemaining);
  }
  private voiceTailSeconds(voice: PlayingVoice): number {
    return (
      Math.max(
        0,
        ...[...voice.routes.values()].map((r) => r.absoluteDelayS + r.groupDelaySeconds),
      ) + 0.02
    );
  }
  private scheduleCleanup(voice: PlayingVoice, seconds: number, knownDeadline?: number): void {
    if (voice.cleanupTimer !== null) clearTimeout(voice.cleanupTimer);
    const offline = this.isOffline();
    const deadline =
      knownDeadline ??
      (offline && !this.nativeCarrierMode && Number.isFinite(voice.sourceEndAudioTime)
        ? voice.sourceEndAudioTime + this.voiceTailSeconds(voice)
        : this.requireContext().currentTime + seconds);
    // Native ended delivery can be late or duplicated; it cannot restart an
    // offline tail whose end was fixed by the already-scheduled source stop.
    voice.cleanupAudioTime = offline
      ? (voice.cleanupAudioTime ?? deadline)
      : Math.max(voice.cleanupAudioTime ?? 0, deadline);
    if (offline) return;
    const poll = () => {
      const remaining = voice.cleanupAudioTime! - this.requireContext().currentTime;
      voice.cleanupTimer = setTimeout(
        () => {
          if (this.disposed) return;
          if (this.requireContext().currentTime + 1e-6 < voice.cleanupAudioTime!) poll();
          else this.cleanupVoice(voice);
        },
        Math.max(10, Math.min(1000, remaining * 1000 + 5)),
      );
    };
    poll();
  }
  private cleanupVoice(voice: PlayingVoice, force = false): void {
    this.liveMonitor?.disposeVoice(voice.input.instanceId, voice.envelope);
    if (
      this.nativeCarrierMode &&
      !force &&
      voice.active &&
      (this.virtualVoices.get(voice.input.instanceId)?.carrier === voice ||
        this.demotingVoices.get(voice.input.instanceId)?.carrier === voice)
    ) {
      if (voice.cleanupTimer !== null) clearTimeout(voice.cleanupTimer);
      voice.cleanupTimer = null;
      voice.cleanupAudioTime = null;
      for (const route of voice.routes.values()) route.disconnect();
      voice.routes.clear();
      voice.lateRoute?.disconnect();
      voice.lateRoute = null;
      this.retiring.delete(voice);
      return;
    }
    if (voice.cleanupTimer !== null) clearTimeout(voice.cleanupTimer);
    voice.cleanupTimer = null;
    voice.cleanupAudioTime = null;
    voice.source.onended = null;
    voice.nativeEofPending = false;
    try {
      voice.source.stop(this.context?.currentTime ?? 0);
    } catch {
      /* May already have ended naturally. */
    }
    voice.sourceStopped = true;
    voice.source.disconnect();
    voice.contentGain.disconnect();
    if (voice.rawMixHandle) this.rawMixInput!.detach(voice.rawMixHandle);
    voice.rawMixHandle = null;
    voice.envelope.disconnect();
    voice.renderGate?.disconnect();
    voice.contentFilter?.disconnect();
    this.carriers.delete(voice);
    for (const route of voice.routes.values()) route.disconnect();
    voice.lateRoute?.disconnect();
    voice.lateRoute = null;
    voice.routes.clear();
    this.retiring.delete(voice);
    if (this.voices.get(voice.input.instanceId) === voice)
      this.voices.delete(voice.input.instanceId);
    this.forgetSource(voice.input.sourceId);
  }

  /** Explicit nonspatial content audition, separate engine/clock; never an experiment. */
  async audition(generator: SoundGenerator, durationSeconds = 1): Promise<VoiceAdmission> {
    if (this.restartFailed) return this.reject("AUDIO_NOT_ENABLED");
    this.requireContext();
    finite(durationSeconds, "audition duration", 0.02, 10);
    if (this.auditionStops.size > 0) {
      // A pending native close still owns a context. Concurrent replacements
      // wait for it, then share the single current audition engine.
      await Promise.all(this.auditionStops.values());
      if (this.disposed) return { accepted: false, reason: "AUDITION_CANCELLED" };
    }
    if (!this.auditionEngine) {
      this.auditionEngine = new AudioEngine({
        budget: { maxVoices: 2, maxPathsPerVoice: 1, maxTotalPaths: 2 },
        monitorGain: this.monitorLevel,
        // Same master headroom and output ceiling as this monitor.
        ...(this.options.headroomGain !== undefined
          ? { headroomGain: this.options.headroomGain }
          : {}),
        ...(this.options.outputSafetyClip ? { outputSafetyClip: true } : {}),
        limiterEnabled: true,
      });
      this.auditionContexts.add(this.auditionEngine);
      this.auditionEngine.setMuted(this.muted);
      this.auditionEngine.setMonitorMode("raw");
    }
    const engine = this.auditionEngine;
    await engine.enable(0);
    if (this.auditionEngine !== engine || this.disposed)
      return { accepted: false, reason: "AUDITION_CANCELLED" };
    if (generator.kind === "sample") {
      const asset = this.assets!.get(generator.asset.assetId);
      if (!asset) return { accepted: false, reason: "ASSET_NOT_READY" };
      const leases = this.auditionAssetLeases.get(engine) ?? new Map<string, AudioAssetLease>();
      const previous = leases.get(asset.descriptor.assetId);
      const lease =
        previous?.entries[0]?.buffer === asset.buffer
          ? previous
          : this.acquireAssets([asset.descriptor.assetId], "independent-audition-bank");
      try {
        engine.registerBuffer(asset.descriptor.assetId, asset.buffer, {
          name: asset.descriptor.name,
          origin: asset.descriptor.origin,
          license: asset.descriptor.license,
          revision: asset.descriptor.revision,
          ...(asset.descriptor.sha256 ? { sha256: asset.descriptor.sha256 } : {}),
        });
      } catch (error) {
        if (lease !== previous) lease.release();
        throw error;
      }
      leases.set(asset.descriptor.assetId, lease);
      this.auditionAssetLeases.set(engine, leases);
      if (previous !== lease) previous?.release();
    }
    const sourceId = "audition-source";
    const frame: AcousticFrame = {
      schemaVersion: "1.0.0",
      requestId: "audition",
      sceneRevision: 0,
      geometryRevision: 0,
      poseTick: 0,
      backendId: "dry-audition",
      backendVersion: "1",
      sourceId,
      listenerId: "audition-listener",
      bandCentersHz: [1000],
      gainQuantity: "pressureRatio",
      capabilities: [],
      modelClass: "numericalApproximation",
      directDelayS: 0,
      paths: [],
      pathAvailability: "available",
      impulseResponseArtifactId: null,
      stale: false,
      limitations: ["NONSPATIAL_AUDITION; excluded from experiments"],
    };
    engine.setEpoch(0);
    return engine.playVoice(
      {
        instanceId: `audition-${++this.auditionSequence}`,
        sourceId,
        generator,
        gainLinear: 0.5,
        pitchSemitones: 0,
        emissionTimeSeconds: 0,
        continuous: false,
        fadeInSeconds: 0.01,
        fadeOutSeconds: 0.03,
        durationSeconds,
      },
      frame,
    );
  }

  /** Stop the independent dry audition before a run/replay or explicit preview stop. */
  async stopAudition(): Promise<void> {
    const engine = this.auditionEngine;
    this.auditionEngine = null;
    if (!engine) {
      await Promise.all(this.auditionStops.values());
      return;
    }
    const completion = (async () => {
      try {
        await engine.drainVoices();
      } finally {
        await engine.disposeAsync();
        this.releaseAuditionAssetLeases(engine);
        this.auditionContexts.delete(engine);
      }
    })();
    this.auditionStops.set(engine, completion);
    try {
      await completion;
      this.auditionStops.delete(engine);
    } catch (error) {
      // Keep the rejecting completion visible to repeated stop/dispose callers.
      throw error;
    }
  }

  private releaseAuditionAssetLeases(engine: AudioEngine): void {
    for (const lease of this.auditionAssetLeases.get(engine)?.values() ?? []) lease.release();
    this.auditionAssetLeases.delete(engine);
  }

  getDiagnostics(): AudioDiagnosticsSnapshot & {
    outputTap: "master" | "simulatedMix" | "dryContent";
    admissions: { droppedVoices: number; droppedPaths: number; staleVoiceAdmissions: number };
    updatePolicy: {
      scalarPressure: "exact";
      normalizedShape: "exactFloat64KeyAndFloat32Target";
      delayDeadbandSeconds: number;
      directionDeadbandMetres: number;
    };
  } {
    return {
      ...this.diagnostics.snapshot(),
      outputTap: this.options.offlineOutputTap ?? "master",
      admissions: {
        droppedVoices: this.droppedVoices,
        droppedPaths: this.droppedPaths,
        staleVoiceAdmissions: this.staleVoiceAdmissions,
      },
      updatePolicy: {
        scalarPressure: "exact",
        normalizedShape: "exactFloat64KeyAndFloat32Target",
        delayDeadbandSeconds: 1e-6,
        directionDeadbandMetres: 1e-4,
      },
    };
  }

  /** Bounded owner/role observations. Sequence is ephemeral allocation telemetry, never a Scene ID. */
  getNativeResourceSnapshot(): {
    mode: "nativeCarrierRoutes" | "nativeReference" | "softwareCursorCandidate";
    sourceContentModel: "nativeReference" | "seekableHarmonics" | "seekableNativeClock";
    activeRenderedCap: number;
    nativeGraphBudget: number | null;
    internalArrivalGraphBudget: number;
    nativeGraphTotalBudget: number;
    parentNativeGraphsInUse: number;
    internalArrivalGraphsInUse: number;
    nativeCarrierBudget: number;
    nativeSourceNodes: number;
    sources: {
      instanceId: string;
      sourceId: string;
      allocationSequence: number;
      kind: "content" | "internalArrival";
      generatorKind: "oscillator" | "sample";
      role: "rendered" | "virtual" | "demoting" | "tail" | "pendingCleanup";
      pending: boolean;
      startedAudioTime: number;
      sourceEndAudioTime: number | null;
      sourceEndAudioTimeBasis: "modelOrLegacyCutoff;notObservedNativeEof";
      scheduledStopAudioTime: number | null;
      nativeEofPending: boolean;
      nativeEndedDeliveryAudioTime: number | null;
      nativeEndedFlushAudioTime: number | null;
    }[];
    carrierCpuSeconds: null;
  } {
    const values = this.nativeCarrierMode
      ? [...this.carriers]
      : [...new Set([...this.voices.values(), ...this.retiring])];
    return {
      mode: this.nativeCarrierMode
        ? "nativeCarrierRoutes"
        : this.nativePolicy
          ? "softwareCursorCandidate"
          : "nativeReference",
      sourceContentModel:
        this.options.oscillatorModel === "seekableHarmonics"
          ? "seekableHarmonics"
          : this.options.oscillatorModel === "seekableNativeClock"
            ? "seekableNativeClock"
            : "nativeReference",
      activeRenderedCap: this.nativePolicy?.maxNativeVoices ?? this.budget.maxVoices,
      nativeGraphBudget: this.nativePolicy ? this.nativeGraphBudget : null,
      internalArrivalGraphBudget: this.internalArrivalGraphBudget,
      nativeGraphTotalBudget: this.nativeGraphTotalBudget,
      parentNativeGraphsInUse: this.parentNativeGraphsInUse(),
      internalArrivalGraphsInUse: this.internalArrivalGraphsInUse(),
      nativeCarrierBudget: this.nativeCarrierBudget,
      nativeSourceNodes: values.length,
      carrierCpuSeconds: null,
      sources: values.map((voice) => ({
        instanceId: voice.input.instanceId,
        sourceId: voice.input.sourceId,
        allocationSequence: voice.allocationSequence,
        kind: voice.internalArrival ? "internalArrival" : "content",
        generatorKind: voice.input.generator.kind,
        role:
          this.voices.get(voice.input.instanceId) === voice
            ? "rendered"
            : this.demotingVoices.get(voice.input.instanceId)?.carrier === voice
              ? "demoting"
              : this.virtualVoices.get(voice.input.instanceId)?.carrier === voice
                ? "virtual"
                : this.retiring.has(voice)
                  ? "tail"
                  : "pendingCleanup",
        pending: voice.startedAudioTime > (this.context?.currentTime ?? 0),
        startedAudioTime: voice.startedAudioTime,
        sourceEndAudioTime: Number.isFinite(voice.sourceEndAudioTime)
          ? voice.sourceEndAudioTime
          : null,
        sourceEndAudioTimeBasis: "modelOrLegacyCutoff;notObservedNativeEof",
        scheduledStopAudioTime: voice.scheduledStopAudioTime,
        nativeEofPending: voice.nativeEofPending,
        nativeEndedDeliveryAudioTime: voice.nativeEndedDeliveryAudioTime,
        nativeEndedFlushAudioTime: voice.nativeEndedFlushAudioTime,
      })),
    };
  }

  getTelemetry(): AudioTelemetry & {
    nativeSlotsInUse: number;
    nativeSourceNodes: number;
    carrierOnlyVoices: number;
    nativeCarrierBudget: number;
    nativeCarrierPeak: number;
    activeRenderedCap: number;
    nativeGraphBudget: number | null;
    internalArrivalGraphBudget: number;
    nativeGraphTotalBudget: number;
    parentNativeGraphsInUse: number;
    internalArrivalGraphsInUse: number;
    nativeRenderQuantumFrames: number | null;
    nativeCursorObservation: "Float32Model" | "LogicalOnly";
    pendingCarriers: number;
    virtualVoices: number;
    demotingVoices: number;
    virtualization: {
      enabled: boolean;
      policy: NativeVoicePolicyOptions | null;
      promotions: number;
      demotions: number;
      expirations: number;
      virtualTimelineCapacity: number;
      historyPolicy: string;
    };
  } {
    for (const collection of [this.voices.values(), this.retiring.values()])
      for (const voice of collection)
        for (const route of voice.routes.values())
          this.maximumFilterDelay = Math.max(this.maximumFilterDelay, route.groupDelaySeconds);
    const context = this.context,
      device = context as AudioContext | null;
    // Both public diagnostics views share one low-frequency capability sample.
    // Reading a UI snapshot never changes the native graph or resets its counters.
    const output = this.diagnostics.snapshot().nativeOutput;
    const measured = output.status === "AVAILABLE";
    return {
      enabled: this.enabled,
      muted: this.muted,
      paused: this.paused,
      monitorMode: this.monitorMode,
      monitorGain: this.monitorLevel,
      activeVoices: this.voices.size,
      nativeSlotsInUse: this.nativeSlotsInUse(),
      nativeSourceNodes: this.nativeCarrierMode ? this.carriers.size : this.nativeSlotsInUse(),
      carrierOnlyVoices: [...this.virtualVoices.values(), ...this.demotingVoices.values()].filter(
        (voice) => voice.carrier && !this.retiring.has(voice.carrier),
      ).length,
      nativeCarrierBudget: this.nativeCarrierBudget,
      nativeCarrierPeak: this.nativeCarrierPeak,
      activeRenderedCap: this.nativePolicy?.maxNativeVoices ?? this.budget.maxVoices,
      nativeGraphBudget: this.nativePolicy ? this.nativeGraphBudget : null,
      internalArrivalGraphBudget: this.internalArrivalGraphBudget,
      nativeGraphTotalBudget: this.nativeGraphTotalBudget,
      parentNativeGraphsInUse: this.parentNativeGraphsInUse(),
      internalArrivalGraphsInUse: this.internalArrivalGraphsInUse(),
      nativeRenderQuantumFrames: this.observedNativeQuantum(),
      nativeCursorObservation:
        this.preciseNativeCursor && this.observedNativeQuantum() !== null
          ? "Float32Model"
          : "LogicalOnly",
      pendingCarriers: [...this.carriers].filter(
        (voice) => voice.startedAudioTime > (this.context?.currentTime ?? 0),
      ).length,
      virtualVoices: this.virtualVoices.size + this.demotingVoices.size,
      demotingVoices: this.demotingVoices.size,
      virtualization: {
        enabled: this.nativePolicy !== null,
        policy: this.nativePolicy ? { ...this.nativePolicy } : null,
        promotions: this.virtualPromotions,
        demotions: this.virtualDemotions,
        expirations: this.virtualExpirations,
        virtualTimelineCapacity: this.nativePolicy
          ? this.nativePolicy.maxNativeVoices + this.nativePolicy.maxVirtualVoices
          : 0,
        historyPolicy: this.nativeCarrierMode
          ? "retainedNativeContent;outgoingRouteTailDrains;virtualRouteDspHistoryIncomplete;promotionRoutesCurrentEmissionThroughDelayOnce"
          : "sourcePhasePreserved; outgoingNativeTailDrains; virtualIntervalHasNoNativeDspHistory; promotionEmitsCurrentCursorThroughDelayOnce",
      },
      activeSources: this.activeSourceIds().size,
      cachedSourceFrames: this.frames.size,
      activePaths: this.totalPaths(),
      retiringVoices: this.retiring.size,
      pendingVoices: this.pendingOnResume.size,
      frozenVoices: this.frozenOnResume.size,
      frozenArrivals: [...this.frozenOnResume.values()].reduce((n, v) => n + v.arrivals.length, 0),
      draining: this.draining,
      droppedVoices: this.droppedVoices,
      stolenVoices: this.stolenVoices,
      droppedPaths: this.droppedPaths,
      staleFrames: this.staleFrames,
      staleVoiceAdmissions: this.staleVoiceAdmissions,
      lateEvents: this.lateEvents,
      decodedBytes: this.assets?.decodedBytes ?? 0,
      assetCount: this.assets?.list().length ?? 0,
      sampleRate: context?.sampleRate ?? null,
      contextState: context?.state ?? "not-created",
      baseLatencySeconds: device && Number.isFinite(device.baseLatency) ? device.baseLatency : null,
      outputLatencySeconds:
        device && Number.isFinite(device.outputLatency) ? device.outputLatency : null,
      outputUnderrunEvents: measured ? output.cumulativeUnderrunEvents : null,
      outputUnderrunSeconds: measured ? output.cumulativeUnderrunSeconds : null,
      outputUnderrunStatus: measured ? "AVAILABLE" : "NOT_AVAILABLE",
      bufferPreset: this.bufferPreset,
      schedulingLookaheadSeconds: this.lookahead,
      schedulingLookaheadPolicy: "onset-only",
      rebuilding: this.rebuilding,
      propagationDelayResponsibility: "AcousticFrame.absoluteDelayS once",
      bandFilterModel: "uniformGainOrWindowedFrequencySamplingApproximation",
      maximumBandFilterGroupDelaySeconds: this.maximumFilterDelay,
      nativeHrtfAndLimiterLatencySeconds: null,
      pauseBoundaryAudioSeconds: this.pauseBoundary,
      pauseClockSkewSeconds: this.pauseClockSkew,
      pauseArrivalPolicy: this.nativeCarrierMode
        ? "sameContextFadeSuspendResume;nativePendingDelayRetained;actualSuspendBoundary"
        : "fadeBoundaryCutoff; remainingDelayFromPauseCall; latestPathAndContentParameters",
      pauseClockAudit: this.pauseClockAudit ? { ...this.pauseClockAudit } : null,
      lastError: this.lastError,
      budget: { ...this.budget },
      lateReverb: {
        ...(this.lateBus?.settings ?? this.reverbSettings),
        model: "Synthetic/perceptual approximation",
        irIncludesDirect: false,
        convolverNormalize: false,
        irEnergyNormalization: "explicit unit energy",
        decodedBytes: this.lateBus?.decodedBytes ?? 0,
        activeSends: this.lateSendCount(),
        sendResponsibility:
          this.options.hrtfScope === "directPath"
            ? "earliest valid solver path delay/bands/stereo panning once"
            : "earliest valid solver path delay/bands/HRTF once",
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.liveMonitor?.dispose();
    ++this.pauseSerial;
    ++this.transportSerial;
    for (const voice of new Set([...this.voices.values(), ...this.retiring, ...this.carriers]))
      this.cleanupVoice(voice, true);
    for (const timer of this.routeTimers) clearTimeout(timer);
    this.routeTimers.clear();
    for (const route of this.retiredRoutes) route.disconnect();
    this.retiredRoutes.clear();
    this.retiredLateRoutes.clear();
    this.offlineRouteDeadlines.clear();
    this.disconnectOutput();
    this.assets?.clear();
    this.virtualVoices.clear();
    this.demotingVoices.clear();
    this.pendingOnResume.clear();
    this.frozenOnResume.clear();
    this.restoredInstances.clear();
    this.frames.clear();
    const completions: Promise<void>[] = [];
    const auditions = new Set([...this.auditionContexts, ...this.auditionAssetLeases.keys()]);
    completions.push(...this.auditionStops.values());
    if (this.auditionEngine) auditions.add(this.auditionEngine);
    this.auditionEngine = null;
    for (const engine of auditions)
      completions.push(
        engine.disposeAsync().then(() => {
          this.releaseAuditionAssetLeases(engine);
          this.auditionContexts.delete(engine);
        }),
      );
    if (
      this.ownsContext &&
      this.context &&
      "close" in this.context &&
      typeof this.context.close === "function"
    ) {
      try {
        completions.push(Promise.resolve(this.context.close()));
      } catch (error) {
        completions.push(Promise.reject(error));
      }
    }
    this.disposalCompletion = Promise.all(completions).then(() => undefined);
    // Legacy synchronous disposal remains fire-and-forget. The original rejecting
    // completion is retained for disposeAsync callers and never reported as closed.
    void this.disposalCompletion.catch(() => undefined);
    this.disposed = true;
    this.enabled = false;
  }

  /** Completes only after every owned context close succeeds; a rejection retains borrowed PCM claims. */
  disposeAsync(): Promise<void> {
    this.dispose();
    return this.disposalCompletion ?? Promise.resolve();
  }

  private disconnectOutput(): void {
    this.liveMonitor?.resetContext();
    this.liveMonitorOutput = null;
    this.phaseAnchor?.disconnect();
    this.phaseAnchor = null;
    this.lateBus?.dispose();
    this.lateBus = null;
    this.rawMixInput?.dispose();
    this.rawMixInput = null;
    this.simulatedMixInput?.dispose();
    this.simulatedMixInput = null;
    for (const node of [
      this.rawMix,
      this.simulatedMix,
      this.runGain,
      this.headroom,
      this.monitor,
      this.muteGain,
      this.limiter,
      this.safetyClip,
    ])
      node?.disconnect();
  }
}
