export type LiveMonitorMode = "levels" | "spectrum" | "waveform" | "load";
export type LiveMonitorInput = "master-left" | "master-right";

export interface LiveMonitorTrack {
  readonly id: string;
  readonly label: string;
  readonly kind: "output" | "source";
  readonly peakDbfs: number | null;
  readonly rmsDbfs: number | null;
  readonly sourceId?: string;
  readonly point?: "contentPrePropagation" | "postLimiterAndMute";
}

/** Arrays are borrowed observation buffers. Read immediately; do not mutate or persist them. */
export interface LiveMonitorAudio {
  readonly state: "active" | "blocked" | "paused" | "unavailable" | "error";
  readonly reason?: string | null;
  readonly sampleRateHz: number | null;
  readonly fftSize: number;
  readonly waveform: Float32Array | null;
  readonly spectrumDbfs: Float32Array | null;
  readonly tracks: readonly LiveMonitorTrack[];
  readonly displayInput?: LiveMonitorInput;
  readonly spectrumNormalization?: string;
  readonly frequencyBinHz?: number | null;
  readonly sourceTrackLimit?: number;
  readonly sampledSourceVoices?: number;
  readonly unmeasuredVirtualVoices?: number;
  readonly unmeasuredPendingVoices?: number;
  readonly unmeasuredNativeVoices?: number;
  readonly warmingSourceVoices?: number;
}

/** Observed timings in ms. Acoustic computation is measured in its Worker; not whole-system CPU. */
export interface LiveMonitorLoad {
  readonly frameIntervalMs: number | null;
  readonly physicsMs: number | null;
  readonly acousticMs: number | null;
  readonly audioControlMs: number | null;
  readonly activeVoices: number;
  readonly voiceLimit: number;
}

export interface LiveMonitorFrame {
  readonly audio: LiveMonitorAudio | null;
  readonly load: LiveMonitorLoad | null;
}

export interface LiveMonitorPorts {
  readLiveMonitor?(mode: LiveMonitorMode, input?: LiveMonitorInput): LiveMonitorFrame | null;
  releaseLiveMonitor?(): void;
}
