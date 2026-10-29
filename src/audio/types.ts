import type { AcousticFrame, AcousticPath, Vec3 } from "../acoustics/types.js";
import type { SoundGenerator } from "../../schemas/sound-behavior/types.js";

export type { AcousticFrame, AcousticPath, SoundGenerator };
export interface AudioBudget {
  maxVoices: number;
  maxSources: number;
  maxSourceFrames: number;
  maxPathsPerVoice: number;
  maxTotalPaths: number;
  maxDecodedBytes: number;
  maxAssetDurationSeconds: number;
  maxAssetChannels: number;
  maxPendingEvents: number;
  maxAssets: number;
  maxConcurrentDecodes: number;
  maxLateSends: number;
  maxLateReverbBytes: number;
}
export interface LateReverbSettings {
  enabled: boolean;
  decaySeconds: number;
  wetGain: number;
  seed: number;
}
export interface AudioEngineOptions {
  context?: BaseAudioContext;
  budget?: Partial<AudioBudget>;
  headroomGain?: number;
  monitorGain?: number;
  limiterEnabled?: boolean;
  spatializationModel?: PanningModelType;
  onVoiceEnded?: (instanceId: string) => void;
}
export interface AudioAssetMetadata {
  name: string;
  origin: "generated" | "imported";
  license: string;
  sha256?: string;
  revision?: number;
}
export interface AudioAssetDescriptor extends Omit<AudioAssetMetadata, "sha256"> {
  assetId: string;
  revision: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  decodedBytes: number;
  sha256: string | null;
}
export interface AudioAssetBankEntry {
  assetId: string;
  buffer: AudioBuffer;
  metadata: AudioAssetMetadata;
}
export interface VoiceInput {
  instanceId: string;
  sourceId: string;
  generator: SoundGenerator;
  gainLinear: number;
  pitchSemitones: number;
  emissionTimeSeconds: number;
  continuous: boolean;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  durationSeconds?: number;
  priority?: number;
  filterCutoffHz?: number;
}
export interface VoiceUpdate {
  gainLinear?: number;
  pitchSemitones?: number;
  filterCutoffHz?: number;
  smoothingSeconds?: number;
}
export interface VoiceAdmission {
  accepted: boolean;
  reason?: string;
  stolenInstanceId?: string;
}
export interface VoiceCursor {
  /** Original generator source seconds, excluding the authored sample startOffset. */
  playheadSeconds: number;
  /** Unpitched logical seconds since the original emission, carried across native restarts. */
  elapsedSinceEmissionSeconds: number;
  remainingDurationSeconds: number | null;
  /** Original emission-clock end, including an explicit stop/fade; absent only for indefinite sources. */
  emissionEndElapsedSeconds?: number;
}
export interface VoiceRestoreCursor extends VoiceCursor {
  restorePendingArrivals?: boolean;
}
export interface ListenerPose {
  positionM: Vec3;
  forward: Vec3;
  up: Vec3;
}
export interface AudioTelemetry {
  enabled: boolean;
  muted: boolean;
  paused: boolean;
  monitorMode: "raw" | "simulated";
  monitorGain: number;
  activeVoices: number;
  activeSources: number;
  cachedSourceFrames: number;
  activePaths: number;
  retiringVoices: number;
  pendingVoices: number;
  frozenVoices: number;
  frozenArrivals: number;
  draining: boolean;
  droppedVoices: number;
  stolenVoices: number;
  droppedPaths: number;
  staleFrames: number;
  lateEvents: number;
  decodedBytes: number;
  assetCount: number;
  sampleRate: number | null;
  contextState: string;
  baseLatencySeconds: number | null;
  outputLatencySeconds: number | null;
  propagationDelayResponsibility: "AcousticFrame.absoluteDelayS once";
  bandFilterModel: "uniformGainOrWindowedFrequencySamplingApproximation";
  maximumBandFilterGroupDelaySeconds: number;
  nativeHrtfAndLimiterLatencySeconds: null;
  pauseBoundaryAudioSeconds: number | null;
  pauseClockSkewSeconds: number | null;
  pauseArrivalPolicy: "fadeBoundaryCutoff; remainingDelayFromPauseCall; latestPathAndContentParameters";
  lastError: string | null;
  budget: AudioBudget;
  lateReverb: LateReverbSettings & {
    model: "Synthetic/perceptual approximation";
    irIncludesDirect: false;
    convolverNormalize: false;
    irEnergyNormalization: "explicit unit energy";
    decodedBytes: number;
    activeSends: number;
    sendResponsibility: "earliest valid solver path delay/bands/HRTF once";
  };
}
export class AudioEngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AudioEngineError";
  }
}
