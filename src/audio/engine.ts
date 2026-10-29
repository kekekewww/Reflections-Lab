import { AudioAssetStore } from "./assets.js";
import { finite, makeBudget, smooth, unit, vector } from "./control.js";
import { PathRoute, validateFrame } from "./routes.js";
import { LateReverbBus } from "./late-reverb.js";
import {
  AudioEngineError,
  type AcousticFrame,
  type AudioAssetDescriptor,
  type AudioAssetMetadata,
  type AudioAssetBankEntry,
  type AudioBudget,
  type AudioEngineOptions,
  type AudioTelemetry,
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
  source: AudioBufferSourceNode | OscillatorNode;
  contentGain: GainNode;
  envelope: GainNode;
  contentFilter: BiquadFilterNode | null;
  routes: Map<string, PathRoute>;
  lateRoute: PathRoute | null;
  active: boolean;
  sourceStopped: boolean;
  startedAudioTime: number;
  durationSeconds: number | null;
  sourceEndAudioTime: number;
  elapsedBeforeStartSeconds: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  cleanupAudioTime: number | null;
  internalArrival: boolean;
  rateHistory: { time: number; position: number; from: number; to: number; end: number }[];
}
interface FrozenVoice {
  input: VoiceInput;
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
}

/** Native Web Audio source graph. No geometry/AI/network runs on its render thread. */
export class AudioEngine {
  private context: BaseAudioContext | null;
  private ownsContext: boolean;
  private assets: AudioAssetStore | null = null;
  private rawMix: GainNode | null = null;
  private simulatedMix: GainNode | null = null;
  private runGain: GainNode | null = null;
  private headroom: GainNode | null = null;
  private monitor: GainNode | null = null;
  private muteGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private readonly frames = new Map<string, AcousticFrame>();
  private readonly voices = new Map<string, PlayingVoice>();
  private readonly retiring = new Set<PlayingVoice>();
  private readonly pendingOnResume = new Map<string, VoiceInput>();
  private readonly frozenOnResume = new Map<string, FrozenVoice>();
  private pauseCompletion: Promise<void> | null = null;
  private arrivalSequence = 0;
  private readonly restoredInstances = new Set<string>();
  private readonly retiredRoutes = new Set<PathRoute>();
  private readonly retiredLateRoutes = new Set<PathRoute>();
  private lateBus: LateReverbBus | null = null;
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
  private pauseBoundary: number | null = null;
  private pauseClockSkew: number | null = null;
  private droppedVoices = 0;
  private stolenVoices = 0;
  private droppedPaths = 0;
  private staleFrames = 0;
  private lateEvents = 0;
  private lastError: string | null = null;
  private maximumFilterDelay = 0;
  private readonly options: AudioEngineOptions;
  private auditionEngine: AudioEngine | null = null;
  private auditionSequence = 0;

  constructor(options: AudioEngineOptions = {}) {
    this.options = options;
    this.budget = makeBudget(options.budget);
    this.monitorLevel = finite(options.monitorGain ?? 0.5, "monitor gain", 0, 1);
    finite(options.headroomGain ?? 0.2, "headroom gain", 0, 1);
    this.context = options.context ?? null;
    this.ownsContext = !options.context;
    if (this.context) this.initialize();
  }

  private requireContext(): BaseAudioContext {
    if (this.disposed) throw new AudioEngineError("DISPOSED", "AudioEngine disposed");
    if (!this.context) {
      if (typeof globalThis.AudioContext !== "function")
        throw new AudioEngineError("WEB_AUDIO_UNAVAILABLE", "This environment has no AudioContext");
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.initialize();
    }
    return this.context;
  }

  private initialize(): void {
    const context = this.context;
    if (!context) return;
    this.assets ??= new AudioAssetStore(
      context,
      this.budget,
      (id) =>
        [...this.voices.values(), ...this.retiring].some(
          (v) => v.input.generator.kind === "sample" && v.input.generator.asset.assetId === id,
        ) ||
        [...this.pendingOnResume.values()].some(
          (v) => v.generator.kind === "sample" && v.generator.asset.assetId === id,
        ) ||
        [...this.frozenOnResume.values()].some(
          (v) => v.input.generator.kind === "sample" && v.input.generator.asset.assetId === id,
        ),
    );
    this.assets.setContext(context);
    this.rawMix = context.createGain();
    this.rawMix.gain.value = this.monitorMode === "raw" ? 1 : 0;
    this.simulatedMix = context.createGain();
    this.simulatedMix.gain.value = this.monitorMode === "simulated" ? 1 : 0;
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
    if (this.options.limiterEnabled !== false) {
      this.limiter = context.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.1;
      this.muteGain.connect(this.limiter);
      this.limiter.connect(context.destination);
    } else this.muteGain.connect(context.destination);
    this.audioEpoch = context.currentTime;
  }

  async enable(simulationTimeSeconds = 0): Promise<void> {
    const context = this.requireContext();
    finite(simulationTimeSeconds, "simulation epoch", 0, 1e9);
    if ("resume" in context && typeof context.resume === "function" && !this.isOffline())
      await context.resume();
    if (!this.enabled) this.setEpoch(simulationTimeSeconds, context.currentTime);
    this.enabled = true;
  }

  private isOffline(): boolean {
    return this.context !== null && "startRendering" in this.context;
  }
  setEpoch(simulationTimeSeconds: number, audioTimeSeconds?: number): void {
    const context = this.requireContext();
    this.simulationEpoch = finite(simulationTimeSeconds, "simulation epoch", 0, 1e9);
    this.audioEpoch = finite(audioTimeSeconds ?? context.currentTime, "audio epoch", 0, 1e9);
    this.restoredInstances.clear();
  }

  async pause(simulationTimeSeconds: number): Promise<void> {
    const context = this.requireContext();
    finite(simulationTimeSeconds, "pause simulation time", 0, 1e9);
    if (this.paused) return;
    this.paused = true;
    const now = context.currentTime;
    const logicalAudioTime = this.audioEpoch + (simulationTimeSeconds - this.simulationEpoch);
    this.pauseClockSkew = now - logicalAudioTime;
    const boundary = now + 0.02;
    const oldVoices = [...this.voices.values(), ...this.retiring];
    for (const voice of oldVoices) {
      if (voice.startedAudioTime > now) {
        if (voice.active && !voice.internalArrival)
          this.pendingOnResume.set(voice.input.instanceId, structuredClone(voice.input));
        this.cleanupVoice(voice);
      } else {
        const position = this.voicePositionAt(
          voice,
          voice.internalArrival ? now : logicalAudioTime,
        );
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
          positionSeconds: position,
          elapsedSinceEmissionSeconds:
            voice.elapsedBeforeStartSeconds +
            Math.max(0, (voice.internalArrival ? now : logicalAudioTime) - voice.startedAudioTime),
          emissionEndElapsedSeconds: Number.isFinite(end)
            ? voice.elapsedBeforeStartSeconds + end - voice.startedAudioTime
            : undefined,
          remainingDurationSeconds:
            end === Infinity
              ? null
              : Math.max(0, end - (voice.internalArrival ? now : logicalAudioTime)),
          ended:
            oldGeneration ||
            (voice.internalArrival ? false : !voice.active) ||
            end <= (voice.internalArrival ? now : logicalAudioTime),
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
    for (const voice of oldVoices) this.cleanupVoice(voice);
    for (const timer of this.routeTimers) clearTimeout(timer);
    this.routeTimers.clear();
    for (const route of this.retiredRoutes) route.disconnect();
    this.retiredRoutes.clear();
    this.retiredLateRoutes.clear();
    this.lateBus?.clearTail();
    this.pauseCompletion = null;
  }

  async resume(simulationTimeSeconds: number): Promise<void> {
    const context = this.requireContext();
    finite(simulationTimeSeconds, "resume simulation time", 0, 1e9);
    if (!this.paused) return;
    await this.pauseCompletion;
    ++this.pauseSerial;
    if ("resume" in context && typeof context.resume === "function" && !this.isOffline())
      await context.resume();
    this.paused = false;
    this.setEpoch(simulationTimeSeconds, context.currentTime);
    smooth(this.runGain!.gain, 1, context.currentTime, 0.02);
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
            positionSeconds: saved.positionSeconds,
            durationSeconds: saved.remainingDurationSeconds,
            internalArrival: saved.internalArrival,
            elapsedSinceEmissionSeconds: saved.elapsedSinceEmissionSeconds,
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
      const result = this.playVoice(input);
      if (!result.accepted) this.options.onVoiceEnded?.(input.instanceId);
    }
    for (const sourceId of new Set([
      ...frozen.map((v) => v.input.sourceId),
      ...pending.map((v) => v.sourceId),
    ]))
      this.forgetSource(sourceId);
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
        ...this.pendingOnResume.keys(),
        ...[...this.frozenOnResume]
          .filter(([, v]) => !v.ended && !v.internalArrival)
          .map(([id]) => id),
      ]);
      for (const voice of [...this.voices.values(), ...this.retiring]) this.cleanupVoice(voice);
      for (const timer of this.routeTimers) clearTimeout(timer);
      this.routeTimers.clear();
      for (const route of this.retiredRoutes) route.disconnect();
      this.retiredRoutes.clear();
      this.retiredLateRoutes.clear();
      this.lateBus?.clearTail();
      this.pendingOnResume.clear();
      this.frozenOnResume.clear();
      this.restoredInstances.clear();
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
    this.monitorLevel = finite(gain, "monitor gain", 0, 1);
    if (this.context && this.monitor) smooth(this.monitor.gain, gain, this.context.currentTime);
    this.auditionEngine?.setMonitorGain(gain);
  }
  setMonitorMode(mode: "raw" | "simulated"): void {
    if (mode !== "raw" && mode !== "simulated")
      throw new AudioEngineError("INVALID_MONITOR_MODE", String(mode));
    this.monitorMode = mode;
    if (this.context) {
      smooth(this.rawMix!.gain, mode === "raw" ? 1 : 0, this.context.currentTime);
      smooth(this.simulatedMix!.gain, mode === "simulated" ? 1 : 0, this.context.currentTime);
    }
  }

  setLateReverb(update: Partial<LateReverbSettings> & { enabled: boolean }): void {
    const context = this.requireContext();
    this.lateBus ??= new LateReverbBus(context, this.simulatedMix!, this.budget.maxLateReverbBytes);
    this.lateBus.set(update);
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
      this.retiring.size ||
      this.pendingOnResume.size ||
      this.frozenOnResume.size ||
      this.retiredRoutes.size
    )
      throw new AudioEngineError(
        "ASSET_BANK_IN_USE",
        "Drain all active, retiring, pending and frozen voices before replacing assets",
      );
    this.assets ??= new AudioAssetStore(null, this.budget, () => this.activeSourceIds().size > 0);
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

  playVoice(input: VoiceInput, frame?: AcousticFrame): VoiceAdmission {
    return this.startVoice(input, frame);
  }
  /** Epoch-mapped logical source cursor, including the integrated authored pitch ramps. */
  getVoiceCursor(instanceId: string, simulationTimeSeconds: number): VoiceCursor | null {
    finite(simulationTimeSeconds, "cursor simulation time", 0, 1e9);
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

  /** Restore a recorded emission cursor without dispatching a new logical sound event. */
  restoreVoiceAtCursor(
    input: VoiceInput,
    frame: AcousticFrame,
    cursor: VoiceRestoreCursor,
  ): VoiceAdmission {
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
    if (this.restoredInstances.has(input.instanceId) || this.voices.has(input.instanceId))
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
      admission = this.startVoice({ ...input, fadeInSeconds: 0 }, frame, {
        positionSeconds: position,
        durationSeconds: remaining,
        elapsedSinceEmissionSeconds: elapsed,
      });
      if (!admission.accepted) return admission;
    } else this.updateFrame(frame);
    for (const arrival of arrivals)
      this.startVoice(
        {
          ...input,
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
    if (!startup.internalArrival && this.voices.has(input.instanceId))
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
    const requested = this.audioEpoch + (input.emissionTimeSeconds - this.simulationEpoch);
    if (
      requested > context.currentTime &&
      [...this.voices.values()].filter((v) => v.startedAudioTime > context.currentTime).length >=
        this.budget.maxPendingEvents
    )
      return this.reject("PENDING_EVENT_BUDGET");
    if (frame && !startup.internalArrival) this.updateFrame(frame);
    const currentFrame = startup.internalArrival ? frame : this.frames.get(input.sourceId);
    if (!currentFrame || currentFrame.pathAvailability !== "available")
      return this.reject("ACOUSTIC_FRAME_UNAVAILABLE");
    if (!this.sourceInUse(input.sourceId) && this.activeSourceIds().size >= this.budget.maxSources)
      return this.reject("SOURCE_BUDGET");
    if (
      !startup.internalArrival &&
      [...this.retiring].filter((v) => !v.internalArrival).length >= this.budget.maxVoices
    )
      return this.reject("RETIRING_VOICE_BUDGET");
    let stolenInstanceId: string | undefined;
    if (!startup.internalArrival && this.voices.size >= this.budget.maxVoices) {
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
    let source: AudioBufferSourceNode | OscillatorNode;
    let duration: number | null =
      startup.durationSeconds === undefined
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
      let offset = input.generator.startOffsetSeconds + (startup.positionSeconds ?? 0);
      if (input.generator.loop) offset %= asset.buffer.duration;
      finite(offset, "sample offset", 0, asset.buffer.duration);
      if (!input.generator.loop && offset >= asset.buffer.duration)
        return this.reject("ASSET_OFFSET_EXPIRED");
      sampleOffset = offset;
      const node = context.createBufferSource();
      node.buffer = asset.buffer;
      node.loop = input.generator.loop;
      node.playbackRate.value = 2 ** (input.pitchSemitones / 12);
      source = node;
      if (!input.generator.loop)
        duration = Math.min(
          duration ?? Infinity,
          (asset.buffer.duration - offset) / node.playbackRate.value,
        );
    } else {
      const node = context.createOscillator();
      node.type = input.generator.waveform;
      node.frequency.value = input.generator.frequencyHz * 2 ** (input.pitchSemitones / 12);
      if (startup.positionSeconds)
        this.restoreOscillatorPhase(node, input, startup.positionSeconds);
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
    if (!startup.internalArrival) envelope.connect(this.rawMix!);
    if (requested < context.currentTime - 0.001) this.lateEvents++;
    const when = Math.max(context.currentTime, requested);
    const playing: PlayingVoice = {
      input: structuredClone(input),
      source,
      contentGain,
      envelope,
      contentFilter,
      routes: new Map(),
      lateRoute: null,
      active: !startup.internalArrival,
      sourceStopped: false,
      startedAudioTime: when,
      durationSeconds: duration,
      sourceEndAudioTime: duration === null ? Infinity : when + duration,
      elapsedBeforeStartSeconds: startup.elapsedSinceEmissionSeconds ?? 0,
      cleanupTimer: null,
      cleanupAudioTime: null,
      internalArrival: startup.internalArrival ?? false,
      rateHistory: [
        {
          time: when,
          position: startup.positionSeconds ?? 0,
          from: 2 ** (input.pitchSemitones / 12),
          to: 2 ** (input.pitchSemitones / 12),
          end: when,
        },
      ],
    };
    if (startup.internalArrival) this.retiring.add(playing);
    else this.voices.set(input.instanceId, playing);
    this.applyRoutes(playing, currentFrame, true);
    const attack = Math.min(input.fadeInSeconds, (duration ?? Infinity) / 2);
    const release = Math.min(input.fadeOutSeconds, Math.max(0, (duration ?? Infinity) - attack));
    envelope.gain.setValueAtTime(attack === 0 ? 1 : 0, when);
    if (attack > 0) envelope.gain.linearRampToValueAtTime(1, when + attack);
    if (duration !== null) {
      const end = when + duration,
        fadeStart = Math.max(when + attack, end - release);
      if (release > 0) {
        envelope.gain.setValueAtTime(1, fadeStart);
        envelope.gain.linearRampToValueAtTime(0, end);
      }
    }
    source.onended = () => this.sourceEnded(playing);
    if (input.generator.kind === "sample")
      (source as AudioBufferSourceNode).start(when, sampleOffset);
    else source.start(when);
    if (duration !== null) {
      source.stop(when + duration);
      playing.sourceStopped = true;
    }
    return { accepted: true, ...(stolenInstanceId ? { stolenInstanceId } : {}) };
  }

  private voicePositionAt(voice: PlayingVoice, time: number): number {
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
      Math.min(256, Math.floor(this.requireContext().sampleRate / (2 * node.frequency.value))),
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
    const voice = this.voices.get(instanceId);
    const pending =
      this.pendingOnResume.get(instanceId) ?? this.frozenOnResume.get(instanceId)?.input;
    if (!voice && !pending) return;
    const input = voice?.input ?? pending!;
    const now = this.requireContext().currentTime;
    const smoothing = finite(update.smoothingSeconds ?? 0.02, "smoothing", 0, 2);
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
    if (pending) {
      if (update.gainLinear !== undefined) pending.gainLinear = update.gainLinear;
      if (update.pitchSemitones !== undefined) pending.pitchSemitones = update.pitchSemitones;
      if (update.filterCutoffHz !== undefined) pending.filterCutoffHz = update.filterCutoffHz;
      return;
    }
    if (!voice) return;
    if (update.gainLinear !== undefined) {
      voice.input.gainLinear = finite(update.gainLinear, "voice gain", 0, 4);
      smooth(voice.contentGain.gain, update.gainLinear, now, smoothing);
    }
    if (update.pitchSemitones !== undefined) {
      const point = voice.rateHistory[voice.rateHistory.length - 1]!;
      const progress =
        point.end > point.time
          ? Math.min(1, Math.max(0, (now - point.time) / (point.end - point.time)))
          : 1;
      const from = point.from + (point.to - point.from) * progress;
      const to = 2 ** (update.pitchSemitones / 12);
      const position = this.voicePositionAt(voice, now);
      voice.rateHistory.push({ time: now, position, from, to, end: now + smoothing });
      // Five-second propagation window plus one preceding anchor, never an unbounded control log.
      while (
        voice.rateHistory.length > 2 &&
        (voice.rateHistory[1]!.time < now - 5.1 || voice.rateHistory.length > 512)
      )
        voice.rateHistory.shift();
      voice.input.pitchSemitones = finite(update.pitchSemitones, "pitch", -48, 48);
      if (voice.input.generator.kind === "sample")
        smooth(
          (voice.source as AudioBufferSourceNode).playbackRate,
          2 ** (update.pitchSemitones / 12),
          now,
          smoothing,
        );
      else
        smooth(
          (voice.source as OscillatorNode).frequency,
          Math.min(
            this.requireContext().sampleRate * 0.49,
            voice.input.generator.frequencyHz * 2 ** (update.pitchSemitones / 12),
          ),
          now,
          smoothing,
        );
    }
    if (update.filterCutoffHz !== undefined) {
      finite(update.filterCutoffHz, "filter cutoff", 20, 20000);
      if (!voice.contentFilter)
        throw new AudioEngineError(
          "FILTER_NOT_ALLOCATED",
          "Changing filter topology requires safe authoring boundary",
        );
      smooth(voice.contentFilter.frequency, update.filterCutoffHz, now, smoothing);
    }
  }

  updateFrame(frame: AcousticFrame): void {
    const context = this.requireContext();
    validateFrame(frame, context.sampleRate);
    const previous = this.frames.get(frame.sourceId);
    const regressed =
      previous &&
      (frame.sceneRevision < previous.sceneRevision ||
        frame.geometryRevision < previous.geometryRevision ||
        (frame.sceneRevision === previous.sceneRevision &&
          frame.geometryRevision === previous.geometryRevision &&
          frame.poseTick < previous.poseTick));
    if (frame.stale || regressed) {
      this.staleFrames++;
      return;
    }
    if (frame.pathAvailability !== "available") {
      this.lastError = "ACOUSTIC_FRAME_UNAVAILABLE";
      return;
    }
    if (!previous && this.frames.size >= this.budget.maxSourceFrames) {
      const inactive = [...this.frames.keys()].find((id) => !this.sourceInUse(id));
      if (inactive) this.frames.delete(inactive);
      else {
        this.lastError = "FRAME_SOURCE_BUDGET";
        return;
      }
    }
    this.frames.set(frame.sourceId, structuredClone(frame));
    for (const voice of this.voices.values())
      if (voice.input.sourceId === frame.sourceId) this.applyRoutes(voice, frame);
  }

  private activeSourceIds(): Set<string> {
    return new Set([
      ...[...this.voices.values(), ...this.retiring].map((v) => v.input.sourceId),
      ...[...this.pendingOnResume.values()].map((v) => v.sourceId),
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
        voice.envelope,
        this.simulatedMix!,
        frame,
        path,
        this.options.spatializationModel ?? "HRTF",
        this.listenerPosition,
        !initialVoice,
      );
      voice.routes.set(path.id, route);
      this.maximumFilterDelay = Math.max(this.maximumFilterDelay, route.groupDelaySeconds);
    }
    this.applyLateRoute(voice, frame, !initialVoice);
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
      voice.envelope,
      this.lateBus.input,
      frame,
      path,
      this.options.spatializationModel ?? "HRTF",
      this.listenerPosition,
      fadeIn,
    );
  }

  private retireRoute(route: PathRoute, late = false): void {
    route.fadeOut();
    this.retiredRoutes.add(route);
    if (late) this.retiredLateRoutes.add(route);
    const deadline = this.requireContext().currentTime + 0.02;
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
    const context = this.requireContext(),
      p = vector(pose.positionM, "listener position"),
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
      if (param) smooth(param, value, context.currentTime, 0.02);
    });
    for (const voice of this.voices.values())
      for (const route of [...voice.routes.values(), ...(voice.lateRoute ? [voice.lateRoute] : [])])
        route.updateListener(p);
  }

  stopVoice(instanceId: string, fadeSeconds?: number): void {
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
    if (!voice) return;
    const context = this.requireContext(),
      fade = finite(fadeSeconds ?? voice.input.fadeOutSeconds, "voice fade", 0, 30);
    smooth(voice.envelope.gain, 0, context.currentTime, Math.max(0.001, fade));
    voice.active = false;
    this.voices.delete(instanceId);
    this.retiring.add(voice);
    voice.source.stop(context.currentTime + Math.max(0.001, fade));
    voice.sourceEndAudioTime = context.currentTime + Math.max(0.001, fade);
    voice.sourceStopped = true;
    this.scheduleCleanup(voice, Math.max(0.001, fade) + this.voiceTailSeconds(voice));
    this.options.onVoiceEnded?.(instanceId);
  }

  private sourceEnded(voice: PlayingVoice): void {
    if (voice.active) {
      voice.active = false;
      if (this.voices.get(voice.input.instanceId) === voice)
        this.voices.delete(voice.input.instanceId);
      this.retiring.add(voice);
      this.options.onVoiceEnded?.(voice.input.instanceId);
    }
    this.scheduleCleanup(voice, this.voiceTailSeconds(voice));
  }
  private voiceTailSeconds(voice: PlayingVoice): number {
    return (
      Math.max(
        0,
        ...[...voice.routes.values()].map((r) => r.absoluteDelayS + r.groupDelaySeconds),
      ) + 0.02
    );
  }
  private scheduleCleanup(voice: PlayingVoice, seconds: number): void {
    if (voice.cleanupTimer !== null) clearTimeout(voice.cleanupTimer);
    voice.cleanupAudioTime = Math.max(
      voice.cleanupAudioTime ?? 0,
      this.requireContext().currentTime + seconds,
    );
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
  private cleanupVoice(voice: PlayingVoice): void {
    if (voice.cleanupTimer !== null) clearTimeout(voice.cleanupTimer);
    voice.cleanupTimer = null;
    voice.cleanupAudioTime = null;
    voice.source.onended = null;
    try {
      voice.source.stop(this.context?.currentTime ?? 0);
    } catch {
      /* May already have ended naturally. */
    }
    voice.sourceStopped = true;
    voice.source.disconnect();
    voice.contentGain.disconnect();
    voice.envelope.disconnect();
    voice.contentFilter?.disconnect();
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
    this.requireContext();
    finite(durationSeconds, "audition duration", 0.02, 10);
    if (!this.auditionEngine) {
      this.auditionEngine = new AudioEngine({
        budget: { maxVoices: 2, maxPathsPerVoice: 1, maxTotalPaths: 2 },
        monitorGain: this.monitorLevel,
        limiterEnabled: true,
      });
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
      engine.registerBuffer(asset.descriptor.assetId, asset.buffer, {
        name: asset.descriptor.name,
        origin: asset.descriptor.origin,
        license: asset.descriptor.license,
        revision: asset.descriptor.revision,
        ...(asset.descriptor.sha256 ? { sha256: asset.descriptor.sha256 } : {}),
      });
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
    if (!engine) return;
    try {
      await engine.drainVoices();
    } finally {
      engine.dispose();
    }
  }

  getTelemetry(): AudioTelemetry {
    const context = this.context,
      device = context as AudioContext | null;
    return {
      enabled: this.enabled,
      muted: this.muted,
      paused: this.paused,
      monitorMode: this.monitorMode,
      monitorGain: this.monitorLevel,
      activeVoices: this.voices.size,
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
      lateEvents: this.lateEvents,
      decodedBytes: this.assets?.decodedBytes ?? 0,
      assetCount: this.assets?.list().length ?? 0,
      sampleRate: context?.sampleRate ?? null,
      contextState: context?.state ?? "not-created",
      baseLatencySeconds: device && Number.isFinite(device.baseLatency) ? device.baseLatency : null,
      outputLatencySeconds:
        device && Number.isFinite(device.outputLatency) ? device.outputLatency : null,
      propagationDelayResponsibility: "AcousticFrame.absoluteDelayS once",
      bandFilterModel: "uniformGainOrWindowedFrequencySamplingApproximation",
      maximumBandFilterGroupDelaySeconds: this.maximumFilterDelay,
      nativeHrtfAndLimiterLatencySeconds: null,
      pauseBoundaryAudioSeconds: this.pauseBoundary,
      pauseClockSkewSeconds: this.pauseClockSkew,
      pauseArrivalPolicy:
        "fadeBoundaryCutoff; remainingDelayFromPauseCall; latestPathAndContentParameters",
      lastError: this.lastError,
      budget: { ...this.budget },
      lateReverb: {
        ...(this.lateBus?.settings ?? {
          enabled: false,
          decaySeconds: 1.2,
          wetGain: 0.15,
          seed: 1,
        }),
        model: "Synthetic/perceptual approximation",
        irIncludesDirect: false,
        convolverNormalize: false,
        irEnergyNormalization: "explicit unit energy",
        decodedBytes: this.lateBus?.decodedBytes ?? 0,
        activeSends: this.lateSendCount(),
        sendResponsibility: "earliest valid solver path delay/bands/HRTF once",
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    ++this.pauseSerial;
    for (const voice of [...this.voices.values(), ...this.retiring]) this.cleanupVoice(voice);
    for (const timer of this.routeTimers) clearTimeout(timer);
    this.routeTimers.clear();
    for (const route of this.retiredRoutes) route.disconnect();
    this.retiredRoutes.clear();
    this.retiredLateRoutes.clear();
    this.lateBus?.dispose();
    for (const node of [
      this.rawMix,
      this.simulatedMix,
      this.runGain,
      this.headroom,
      this.monitor,
      this.muteGain,
      this.limiter,
    ])
      node?.disconnect();
    this.assets?.clear();
    this.pendingOnResume.clear();
    this.frozenOnResume.clear();
    this.restoredInstances.clear();
    this.frames.clear();
    this.auditionEngine?.dispose();
    if (
      this.ownsContext &&
      this.context &&
      "close" in this.context &&
      typeof this.context.close === "function"
    )
      void this.context.close();
    this.disposed = true;
    this.enabled = false;
  }
}
