/**
 * Category B extension seam only. No renderer implements this contract yet.
 * Jobs/results contain portable data, never AudioNode/AudioBuffer/engine objects.
 * Future backends must validate hashes, integer bounds and capabilities at runtime.
 */
export interface RenderArtifactRef {
  /** Stable artifact ID resolved by the host; never an array index or engine handle. */
  readonly id: string;
  /** SHA-256 of stored artifact bytes; not a canonical object's embedded content hash. */
  readonly sha256: string;
}

export interface RenderBackendIdentity {
  readonly id: string;
  readonly version: string;
}

export type RenderCapability =
  | "offlinePcm"
  | "sampleScheduledControls"
  | "listenerReevaluation"
  | "customHrtf"
  | "emissionSelection"
  | "separatePathTaps"
  | "statePreservingChunks";

/** Counters must be safe integers; denominator/rate are positive; reject overflow/negative samples. */
export interface RenderClockMapping {
  readonly policy: "tick-to-sample-rational-v1";
  readonly tickOrigin: number;
  /** fixedDtS = numerator / denominator; must agree with the verified recording. */
  readonly fixedDtNumerator: number;
  readonly fixedDtDenominator: number;
  readonly sampleRateHz: 44100 | 48000;
  /** sample(t) = round((t - tickOrigin) * numerator * rate / denominator). */
  readonly rounding: "nearestTiesToPositiveInfinity";
}

export interface RenderWindow {
  /** Emission interval [startTick, endTickExclusive); both belong to the trace clock. */
  readonly startTick: number;
  readonly endTickExclusive: number;
  /** History rendered before the window and discarded; must come from captured data. */
  readonly preRollFrames: number;
  /** Additional output frames after the emission interval; bounded, never implicit infinity. */
  readonly tailFrames: number;
  readonly boundaryPolicy: "reportUnresolvedHistoryAndTruncatedTail";
  /** Output sample zero is sample(startTick); quantum padding is discarded. */
  readonly outputOrigin: "windowStart";
}

export type RenderListenerPolicy =
  | { readonly kind: "recorded" }
  | {
      readonly kind: "replacementTrace";
      readonly trace: RenderArtifactRef;
      readonly acousticReevaluation: "required";
    };

export type RenderSpatialization =
  | { readonly kind: "none" }
  | {
      readonly kind: "nativePanner";
      readonly model: "HRTF" | "equalpower";
      /** Native HRTF coefficients cannot be pinned by a Web Audio asset hash. */
      readonly profileIdentity: "browserManagedUnspecified";
    }
  | {
      readonly kind: "hrtfAsset";
      readonly profileId: string;
      readonly revision: number;
      readonly asset: RenderArtifactRef;
      readonly license: RenderArtifactRef;
    };

export type RenderSourceSelection =
  | { readonly kind: "allRecordedSources" }
  | { readonly kind: "includeRecordedSourceIds"; readonly sourceIds: readonly string[] };

export type RenderOutputTap =
  /** Authored content/gain/pitch/envelope; no propagation, spatialization or master processing. */
  | "dryContent"
  /** Each path tap includes its delay/bands/spatialization once, before master processing. */
  | "direct"
  | "early"
  /** Late-bus output, including its declared send path; model remains explicit in graph settings. */
  | "late"
  /** Direct + early + late before master headroom/limiter/output gain. */
  | "simulatedMix"
  /** Shared mixed bus after the pinned master graph; isolated mastered stems need not add up. */
  | "master";

export interface RenderOutputRequest {
  readonly id: string;
  readonly tap: RenderOutputTap;
  readonly sources: RenderSourceSelection;
  /** Filter emissions before all audio buses; unselected signals drive no bus in this output. */
  readonly mixPolicy: "independentGraphPerSelection";
  /** Explicit layout; unsupported tap/layout combinations must be rejected. */
  readonly channels: 1 | 2;
  readonly encoding: "float32Pcm";
}

export interface RenderJob {
  readonly schemaVersion: "render-job-plan-v1";
  readonly jobId: string;
  /** Existing RecordingArtifact bytes; this does not introduce another recording format. */
  readonly recording: RenderArtifactRef;
  /** Existing RecordingArtifact.artifactSha256; verify separately from stored bytes SHA-256. */
  readonly recordingContentSha256: string;
  readonly sceneRevision: number;
  readonly backend: RenderBackendIdentity;
  readonly requiredCapabilities: readonly RenderCapability[];
  readonly clock: RenderClockMapping;
  readonly window: RenderWindow;
  readonly listener: RenderListenerPolicy;
  readonly spatialization: RenderSpatialization;
  /** Pins solver/material/asset revisions, graph settings, gains and limiter configuration. */
  readonly renderConfiguration: RenderArtifactRef;
  /** Select emissions after original behavior/admission; never remove physics bodies. */
  readonly selectionPolicy: "preserveRecordedPhysicsBehaviorAndAdmission";
  readonly normalization: "none";
  readonly outputs: readonly RenderOutputRequest[];
  readonly budget: {
    readonly maxOutputFrames: number;
    readonly maxWorkingBytes: number;
    readonly maxOutputBytes: number;
  };
}

export interface RenderExecutionProvenance {
  readonly backend: RenderBackendIdentity;
  /** Actual capability observations for this execution, not requirements copied from the job. */
  readonly capabilities: readonly RenderCapability[];
  readonly engine: RenderBackendIdentity;
  readonly startedAtUtc: string;
  readonly finishedAtUtc: string;
  readonly limitations: readonly string[];
}

export interface RenderedOutput {
  readonly requestId: string;
  readonly artifact: RenderArtifactRef;
  readonly sampleRateHz: 44100 | 48000;
  readonly channels: 1 | 2;
  /** sample(endTickExclusive) - sample(startTick) + tailFrames; excludes preroll/padding. */
  readonly frames: number;
  readonly encoding: "float32Pcm";
  readonly peakLinear: number;
  /** Before file encoding; values outside [-1, 1] are not necessarily clipped float PCM. */
  readonly samplesOutsideUnitRange: number;
  /** Only the final float32 output conversion; does not infer clipping inside opaque DSP. */
  readonly clipping:
    | { readonly stage: "float32OutputConversion"; readonly clippedSampleCount: number }
    | { readonly stage: "unavailable"; readonly reason: string };
  readonly tailTruncated: boolean;
  readonly historyIncomplete: boolean;
}

export type RenderResult =
  | {
      readonly status: "completed";
      readonly jobId: string;
      readonly jobSha256: string;
      readonly provenance: RenderExecutionProvenance;
      /** Publish only after every requested output and hash has been verified. */
      readonly outputs: readonly RenderedOutput[];
    }
  | {
      readonly status: "failed" | "cancelled";
      readonly jobId: string;
      readonly jobSha256: string;
      readonly code: string;
      readonly reason: string;
      readonly limitations: readonly string[];
    };

/** Host-owned backend seam; no provider registration, network action or live routing is implied. */
export interface RenderBackend {
  readonly identity: RenderBackendIdentity;
  readonly capabilities: readonly RenderCapability[];
  /** Same ID + canonical job hash returns the same terminal result; changed content must fail. */
  render(job: RenderJob): Promise<RenderResult>;
  /** Idempotent; cancel before atomic publication wins, completed results remain immutable. */
  cancel(jobId: string): Promise<void>;
}
