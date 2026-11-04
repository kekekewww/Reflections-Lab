import { ReplayAudioHost } from "../app/replay-audio.js";
import type { BehaviorAsset } from "../audio-behavior/types.js";
import { canonicalStringify, immutableClone, sha256Canonical } from "../experiments/hash.js";
import type { RecordedBehaviorSnapshot } from "../app/recording-processor.js";
import { readAudioContentModelPin, type AudioOscillatorModel } from "./content-model.js";
import { AudioEngine } from "./engine.js";
import type { AcousticFrame, AudioEngineOptions, VoiceInput } from "./types.js";
import type {
  RenderBackend,
  RenderJob,
  RenderOutputRequest,
  RenderResult,
  RenderedOutput,
} from "./render-contract.js";
import { RenderError } from "./render-pcm.js";
import { encodeFloatWaveChunks } from "./render-chunk-pcm.js";
import { IndexedDBRenderOutputStore, type RenderOutputStore } from "./render-output-store.js";
import type {
  RenderControlObservation,
  RenderExportManifest,
  RenderFile,
  RenderInput,
} from "./render-types.js";
import {
  NATIVE_RENDER_CAPABILITIES,
  NATIVE_RENDER_IDENTITY,
  renderTickSample,
  verifyRenderInput,
} from "./render-validation.js";
import type { ValidatedRenderPlan } from "./render-validation.js";

interface RenderRecord {
  hash: string;
  cancelled: boolean;
  promise: Promise<RenderResult>;
  files: Map<
    string,
    Omit<RenderFile, "bytes"> & { byteLength: number; bytes?: Uint8Array<ArrayBuffer> }
  >;
  manifest: RenderExportManifest | null;
}
export interface NativeOfflineRenderOptions {
  input: RenderInput;
  onProgress?: (completedOutputs: number, totalOutputs: number) => void;
  createContext?: (channels: number, frames: number, sampleRate: number) => OfflineAudioContext;
  /** Explicit test seam. Production requires durable IndexedDB output storage. */
  outputStore?: RenderOutputStore;
}

/** Bounded one-shot backend. Captured decisions use the existing native source graph. */
export class NativeOfflineRenderBackend implements RenderBackend {
  readonly identity = NATIVE_RENDER_IDENTITY;
  readonly capabilities = NATIVE_RENDER_CAPABILITIES;
  private records = new Map<string, RenderRecord>();
  private active: string | null = null;
  private preparing: { jobId: string; cancelled: boolean } | null = null;
  private disposed = false;
  private readonly outputStore: RenderOutputStore;
  private ownedInput: RenderInput | null;
  private readonly options: Omit<NativeOfflineRenderOptions, "input">;
  private get input(): RenderInput {
    if (!this.ownedInput)
      throw new RenderError(
        "RENDER_INPUT_RELEASED",
        "Render inputs were released after execution.",
      );
    return this.ownedInput;
  }
  private ownedBank: RenderInput["assetBank"] | null = null;
  constructor(options: NativeOfflineRenderOptions) {
    const { input, ...executionOptions } = options;
    this.options = executionOptions;
    this.outputStore = options.outputStore ?? new IndexedDBRenderOutputStore();
    this.ownedInput = {
      recording: immutableClone(input.recording),
      configuration: immutableClone(input.configuration),
      assetBank: [...input.assetBank].map((asset) => ({
        ...asset,
        metadata: { ...asset.metadata },
      })),
    };
  }

  async render(job: RenderJob): Promise<RenderResult> {
    if (this.disposed)
      throw new RenderError("RENDER_DISPOSED", "Render backend has been disposed.");
    job = immutableClone(job);
    const preparation = this.preparing ?? { jobId: job.jobId, cancelled: false };
    const preparationAdmitted = preparation.jobId === job.jobId;
    if (preparationAdmitted) this.preparing = preparation;
    let hash: string;
    try {
      hash = await sha256Canonical(job);
    } finally {
      if (this.preparing === preparation) this.preparing = null;
    }
    if (this.disposed)
      throw new RenderError("RENDER_DISPOSED", "Render backend was disposed during preparation.");
    if (!preparationAdmitted)
      return {
        status: "failed",
        jobId: job.jobId,
        jobSha256: hash,
        code: "RENDER_BUSY",
        reason: "A render is already being prepared.",
        limitations: [],
      };
    const previous = this.records.get(job.jobId);
    if (previous) {
      if (previous.hash !== hash)
        return {
          status: "failed",
          jobId: job.jobId,
          jobSha256: hash,
          code: "RENDER_JOB_ID_REUSED",
          reason: "The same render job ID was reused with different content.",
          limitations: [],
        };
      return previous.promise;
    }
    if (this.active !== null)
      return {
        status: "failed",
        jobId: job.jobId,
        jobSha256: hash,
        code: "RENDER_BUSY",
        reason: "A render is already active.",
        limitations: [],
      };
    if (this.records.size >= 1)
      return {
        status: "failed",
        jobId: job.jobId,
        jobSha256: hash,
        code: "RENDER_JOB_CAPACITY",
        reason:
          "This bounded backend retains one job. Create a new backend after consuming its exports.",
        limitations: [],
      };
    const record: RenderRecord = {
      hash,
      cancelled: preparation.cancelled,
      promise: Promise.resolve(null as unknown as RenderResult),
      files: new Map(),
      manifest: null,
    };
    this.records.set(job.jobId, record);
    this.active = job.jobId;
    record.promise = this.execute(immutableClone(job), record).finally(() => {
      this.active = null;
      this.ownedInput = null;
    });
    return record.promise;
  }
  async cancel(jobId: string): Promise<void> {
    const record = this.records.get(jobId);
    if (record?.manifest) return;
    if (this.preparing?.jobId === jobId) this.preparing.cancelled = true;
    if (record) record.cancelled = true;
    if (record) await record.promise;
  }
  /** Host rollback is restricted to a job this exact backend completed. */
  async discardOwnedJob(jobId: string): Promise<void> {
    const record = this.records.get(jobId);
    if (!record) return;
    await this.cancel(jobId);
    await record.promise;
    if (!record.manifest) return;
    await this.outputStore.discard(jobId);
    record.manifest = null;
    record.files.clear();
  }
  getFile(jobId: string, outputId: string): RenderFile | null {
    const record = this.records.get(jobId);
    if (!record?.manifest) return null;
    const file = record.files.get(outputId);
    return file?.bytes && !this.disposed
      ? {
          id: file.id,
          filename: file.filename,
          mediaType: file.mediaType,
          sha256: file.sha256,
          bytes: file.bytes.slice(),
        }
      : null;
  }
  async getFileBlob(jobId: string, outputId: string): Promise<Blob | null> {
    if (this.disposed || !this.records.get(jobId)?.manifest) return null;
    return this.outputStore.readBlob(jobId, outputId);
  }
  getStorageSnapshot(jobId: string) {
    return this.outputStore.getSnapshot(jobId);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.preparing) this.preparing.cancelled = true;
    for (const record of this.records.values()) if (!record.manifest) record.cancelled = true;
    const pending = [...this.records.values()].map((record) => record.promise);
    void Promise.allSettled(pending).then(() => {
      this.records.clear();
      this.ownedBank = null;
      this.ownedInput = null;
      this.outputStore.dispose();
    });
  }
  getManifest(jobId: string): RenderExportManifest | null {
    return this.records.get(jobId)?.manifest ?? null;
  }
  private assertActive(record: RenderRecord): void {
    if (record.cancelled)
      throw new RenderError("RENDER_CANCELLED", "Render cancelled before publication.");
  }
  private async execute(job: RenderJob, record: RenderRecord): Promise<RenderResult> {
    const startedAtUtc = new Date().toISOString();
    const limitations = [
      "Native AudioEngine render of captured VoiceIntent/path data; not captured hardware PCM.",
      "Source onsets retain the recorded epoch. Dynamic graph/parameter controls are applied at observed native render-quantum boundaries, not sampleScheduledControls.",
      "Native HRTF/limiter coefficients and latency are browser managed and not asset-pinned.",
      "Wet/propagated mix includes direct, early and configured Synthetic late reverb; it is not a separate late-only tap.",
      "Working-memory admission includes a whole native AudioBuffer and native scratch allowance; it is an estimate, not constant-memory or unlimited streaming. Native allocation failure remains explicit.",
      "Each output uses one whole native graph. Encoding/storage chunks do not restart filter, delay, HRTF, convolution or compressor state. Long outputs are persisted in IndexedDB without a resident all-WAV byte cache.",
      "Tail flags compare the requested interval with declared path delay/fade/Synthetic IR length and a nominal native guard; opaque native decay is not certified for every possible input.",
    ];
    let storeOwned = false;
    try {
      const plan = await verifyRenderInput(job, this.input);
      this.assertActive(record);
      await this.outputStore.begin(
        job.jobId,
        job.budget.maxOutputBytes,
        job.outputs.map((output) => output.id),
        plan.outputBytes,
      );
      storeOwned = true;
      this.assertActive(record);
      this.ownedBank = this.input.assetBank.map((asset) => {
        const buffer = new AudioBuffer({
          numberOfChannels: asset.buffer.numberOfChannels,
          length: asset.buffer.length,
          sampleRate: asset.buffer.sampleRate,
        });
        for (let channel = 0; channel < buffer.numberOfChannels; channel++)
          buffer.copyToChannel(asset.buffer.getChannelData(channel), channel);
        return { ...asset, buffer };
      });
      const rendered: RenderedOutput[] = [];
      const observations: RenderControlObservation[] = [];
      for (const request of job.outputs) {
        this.assertActive(record);
        // This helper's channel/native-buffer references end before the next context allocation.
        const output = await this.renderAndStoreOutput(job, request, plan, record);
        const encoded = output.encoded;
        const sha256 = encoded.sha256;
        this.assertActive(record);
        const filename = `${job.jobId.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 80)}-${request.id.replace(/[^A-Za-z0-9_.-]/g, "-")}.wav`;
        record.files.set(request.id, {
          id: request.id,
          filename,
          mediaType: "audio/wav",
          byteLength: encoded.bytes,
          ...(output.legacyBytes ? { bytes: output.legacyBytes } : {}),
          sha256,
        });
        const windowSeconds = job.window.tailFrames / job.clock.sampleRateHz;
        const tailRequired = this.requiredTailSeconds(request);
        rendered.push({
          requestId: request.id,
          artifact: { id: `${job.jobId}.${request.id}`, sha256 },
          sampleRateHz: job.clock.sampleRateHz,
          channels: request.channels,
          frames: plan.outputFrames,
          encoding: "float32Pcm",
          peakLinear: encoded.peakLinear,
          samplesOutsideUnitRange: encoded.samplesOutsideUnitRange,
          clipping: { stage: "float32OutputConversion", clippedSampleCount: 0 },
          tailTruncated: windowSeconds + 1 / job.clock.sampleRateHz < tailRequired,
          historyIncomplete: this.historyIncomplete(job, plan, tailRequired),
        });
        if (!observations.length) observations.push(...output.controls);
        this.options.onProgress?.(rendered.length, job.outputs.length);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      this.assertActive(record);
      const result = immutableClone({
        status: "completed" as const,
        jobId: job.jobId,
        jobSha256: record.hash,
        provenance: {
          backend: { ...this.identity },
          capabilities: [...this.capabilities],
          engine: { id: "AudioEngine/nativeWebAudio", version: "recorded-native-v1" },
          startedAtUtc,
          finishedAtUtc: new Date().toISOString(),
          limitations,
        },
        outputs: rendered,
      });
      const manifest: RenderExportManifest = immutableClone({
        schemaVersion: "render-export-manifest-v1" as const,
        job,
        configuration: this.input.configuration,
        result,
        files: [...record.files.values()].map(({ id, filename, sha256, byteLength }) => ({
          id,
          filename,
          sha256,
          bytes: byteLength,
        })),
        controlObservations: observations,
        semantics: {
          dryContent:
            "Authored generator/gain/pitch/envelope before propagation and master processing. Mono content is duplicated at unity into each stereo channel, as in the existing raw graph; no stereo-energy normalization.",
          propagatedMix:
            "Direct + early + configured Synthetic late reverb, unity pre-master graph; labeled wet/propagated, not pure late.",
          stems:
            "Captured emission selection by authored object before every bus. Matching pre-master stems share origin, length, gain and seed and sum to the propagated mix within native floating-point tolerance.",
          master:
            "Combined sources after the pinned headroom/monitor/limiter/safety graph. Independently mastered stems are not required to sum.",
        },
      });
      this.assertActive(record);
      await this.outputStore.publish(job.jobId, canonicalStringify(manifest));
      this.assertActive(record);
      record.manifest = manifest;
      this.ownedBank = null;
      return result;
    } catch (error) {
      record.files.clear();
      record.manifest = null;
      if (storeOwned)
        await this.outputStore.discard(job.jobId).catch((cleanupError: unknown) => {
          limitations.push(
            `Output cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        });
      this.ownedBank = null;
      const code =
        error instanceof RenderError
          ? error.code
          : error instanceof Error && "code" in error
            ? String(error.code)
            : "RENDER_FAILED";
      return immutableClone({
        status: record.cancelled ? ("cancelled" as const) : ("failed" as const),
        jobId: job.jobId,
        jobSha256: record.hash,
        code,
        reason: error instanceof Error ? error.message : String(error),
        limitations,
      });
    }
  }
  private async renderAndStoreOutput(
    job: RenderJob,
    request: RenderOutputRequest,
    plan: ValidatedRenderPlan,
    record: RenderRecord,
  ) {
    const output = await this.renderOutput(job, request, plan, record);
    this.assertActive(record);
    // The <=30 second synchronous getFile API remains available and its complete
    // cache is counted by admission. Long outputs only retain store descriptors.
    const cache = plan.emissionFrames <= 30 * job.clock.sampleRateHz;
    const parts: Uint8Array<ArrayBuffer>[] = [];
    const encoded = await encodeFloatWaveChunks(
      output.channels,
      job.clock.sampleRateHz,
      async (bytes, index) => {
        await this.outputStore.append(job.jobId, request.id, index, bytes);
        if (cache) parts.push(bytes);
      },
      { assertActive: () => this.assertActive(record) },
    );
    await this.outputStore.sealOutput(job.jobId, request.id, encoded.bytes, encoded.sha256);
    this.assertActive(record);
    let legacyBytes: Uint8Array<ArrayBuffer> | undefined;
    if (cache) {
      legacyBytes = new Uint8Array(encoded.bytes);
      let offset = 0;
      for (const part of parts) {
        legacyBytes.set(part, offset);
        offset += part.byteLength;
      }
    }
    return { encoded, legacyBytes, controls: output.controls };
  }
  private requiredTailSeconds(request: RenderOutputRequest): number {
    const selected =
      request.sources.kind === "includeRecordedSourceIds"
        ? new Set(request.sources.sourceIds)
        : null;
    let delay = 0;
    let fade = 0;
    for (const frame of this.input.recording.frames) {
      for (const acoustic of frame.acousticFrames)
        if (!selected || selected.has(acoustic.sourceId))
          for (const path of acoustic.paths) delay = Math.max(delay, path.absoluteDelayS);
      const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot | undefined;
      for (const intent of snapshot?.voiceIntents ?? [])
        if (!selected || selected.has(intent.event.instanceId))
          fade = Math.max(fade, intent.fadeOutSeconds);
    }
    if (request.tap === "dryContent") return fade;
    const late = this.input.configuration.master.lateReverb;
    return (
      delay +
      fade +
      0.1 +
      ((request.tap === "master" || request.tap === "simulatedMix") && late.enabled
        ? late.decaySeconds
        : 0)
    );
  }
  private historyIncomplete(job: RenderJob, plan: ValidatedRenderPlan, required: number): boolean {
    // Finite preroll/tail is never an oracle for opaque IIR/HRTF/convolver/compressor
    // history. Certify only a graph beginning at the logical run origin with no
    // prior instances; all later starts conservatively retain the incomplete flag.
    void job;
    void required;
    const frame = this.input.recording.frames[plan.startFrameIndex]!;
    const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot | undefined;
    return (
      plan.renderStartTick > 1 ||
      !snapshot?.preStepSnapshot ||
      snapshot.preStepSnapshot.state.instances.length > 0
    );
  }
  private async renderOutput(
    job: RenderJob,
    request: RenderOutputRequest,
    plan: ValidatedRenderPlan,
    record: RenderRecord,
  ): Promise<{ channels: Float32Array[]; controls: RenderControlObservation[] }> {
    const native =
      this.options.createContext ??
      ((channels: number, frames: number, rate: number) => {
        if (typeof OfflineAudioContext !== "function")
          throw new RenderError(
            "OFFLINE_AUDIO_UNAVAILABLE",
            "OfflineAudioContext is unavailable in this browser.",
          );
        return new OfflineAudioContext(channels, frames, rate);
      });
    const context = native(request.channels, plan.contextFrames, job.clock.sampleRateHz);
    const settings = this.input.configuration.master;
    const outputTap =
      request.tap === "master"
        ? "master"
        : request.tap === "dryContent"
          ? "dryContent"
          : "simulatedMix";
    const engineOptions: AudioEngineOptions & {
      offlineOutputTap: "master" | "simulatedMix" | "dryContent";
      oscillatorModel: AudioOscillatorModel;
      virtualization: false;
    } = {
      context,
      headroomGain: settings.headroomGain,
      monitorGain: settings.monitorGain,
      limiterEnabled: settings.limiterEnabled,
      outputSafetyClip: settings.outputSafetyClip,
      spatializationModel:
        job.spatialization.kind === "nativePanner" ? job.spatialization.model : "equalpower",
      offlineOutputTap: outputTap,
      oscillatorModel: readAudioContentModelPin(this.input.recording.configuration.generatorConfig),
      virtualization: false,
      budget: {
        maxVoices: 64,
        maxSources: 64,
        maxSourceFrames: 128,
        maxPathsPerVoice: 16,
        maxTotalPaths: 256,
      },
    };
    const engine = new AudioEngine(engineOptions);
    const selected =
      request.sources.kind === "includeRecordedSourceIds"
        ? new Set(request.sources.sourceIds)
        : null;
    const active = new Set<string>();
    const filterFrame = (frame: AcousticFrame): AcousticFrame => {
      if (request.tap !== "dryContent" && frame.pathAvailability !== "available")
        throw new RenderError(
          "RENDER_ACOUSTIC_UNAVAILABLE",
          "Captured propagated paths are unavailable; export dry content separately or capture a supported acoustic take.",
        );
      if (request.tap !== "direct" && request.tap !== "early") return frame;
      return {
        ...frame,
        paths: frame.paths.filter((path) =>
          request.tap === "direct" ? path.order === 0 : path.order > 0,
        ),
      };
    };
    const filteredEngine = new Proxy(engine, {
      get(target, property) {
        if (property === "updateFrame")
          return (frame: AcousticFrame): void => {
            if (!selected || selected.has(frame.sourceId)) target.updateFrame(filterFrame(frame));
          };
        if (property === "playVoice" || property === "restoreVoiceAtCursor")
          return (
            input: VoiceInput,
            frame: AcousticFrame | undefined,
            cursor?: Parameters<AudioEngine["restoreVoiceAtCursor"]>[2],
          ) => {
            if (selected && !selected.has(input.sourceId)) return { accepted: true };
            const routed = frame ? filterFrame(frame) : undefined;
            const admission =
              property === "restoreVoiceAtCursor"
                ? target.restoreVoiceAtCursor(input, routed!, cursor!)
                : target.playVoice(input, routed);
            if (!admission.accepted)
              throw new RenderError(
                "RENDER_VOICE_REJECTED",
                `Captured voice ${input.instanceId} was rejected: ${admission.reason ?? "unknown"}`,
              );
            active.add(input.instanceId);
            return admission;
          };
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const assets: BehaviorAsset[] = (this.ownedBank ?? this.input.assetBank).map((asset) => ({
      assetId: asset.assetId,
      revision: asset.metadata.revision ?? 1,
      sha256: asset.metadata.sha256 ?? "",
      availability: "READY",
      rightsStatus: "APPROVED",
      durationSeconds: asset.buffer.duration,
    }));
    let attached = plan.startFrameIndex === 0;
    const replay = new ReplayAudioHost({
      getEngine: () => (attached ? filteredEngine : null),
      getAssets: () => assets,
    });
    const controls: RenderControlObservation[] = [];
    let rendering: Promise<AudioBuffer> | null = null;
    let controlFailure: unknown = null;
    try {
      for (const asset of this.ownedBank ?? this.input.assetBank)
        engine.registerBuffer(asset.assetId, asset.buffer, asset.metadata);
      await engine.enable(plan.renderStartTick * this.input.recording.configuration.fixedDtS);
      engine.setMuted(false);
      engine.setLateReverb({
        ...settings.lateReverb,
        enabled:
          (request.tap === "master" || request.tap === "simulatedMix") &&
          settings.lateReverb.enabled,
      });
      await replay.begin(this.input.recording);
      // The full original artifact remains validated. Seek a preroll boundary only when required.
      const frames = this.input.recording.frames.slice(
        plan.startFrameIndex,
        plan.endFrameIndexExclusive,
      );
      const first = frames[0]!;
      if (plan.startFrameIndex > 0) {
        await replay.seek(first);
        attached = true;
        await replay.resume();
      }
      replay.applyFrame(first);
      const origin = renderTickSample(job, plan.renderStartTick);
      const quantum = this.input.configuration.controlQuantumFrames;
      const events = frames.slice(1).map((frame) => ({
        tick: frame.tick,
        desired: renderTickSample(job, frame.tick) - origin,
        frame,
      }));
      const emissionEnd = renderTickSample(job, job.window.endTickExclusive) - origin;
      const flushSample = Math.min(
        plan.contextFrames - 1,
        emissionEnd + Math.ceil(0.1 * context.sampleRate),
      );
      const actions: { tick: number; desired: number; apply: () => void }[] = events.map(
        ({ tick, desired, frame }) => ({ tick, desired, apply: () => replay.applyFrame(frame) }),
      );
      if (emissionEnd < plan.contextFrames)
        actions.push({
          tick: job.window.endTickExclusive,
          desired: emissionEnd,
          apply: () => {
            for (const id of active) engine.stopVoice(id);
          },
        });
      if (flushSample > emissionEnd && flushSample < plan.contextFrames)
        actions.push({
          tick: job.window.endTickExclusive,
          desired: flushSample,
          apply: () => undefined,
        });
      const pending: { sample: number; actions: typeof actions; promise: Promise<void> }[] = [];
      for (const action of actions) {
        const sample = Math.floor(action.desired / quantum) * quantum;
        if (sample <= 0)
          throw new RenderError(
            "RENDER_CONTROL_GRID",
            "Captured fixed steps are finer than this native render-control grid.",
          );
        const previous = pending[pending.length - 1];
        if (previous?.sample === sample) previous.actions.push(action);
        else {
          const promise = context.suspend(sample / context.sampleRate);
          void promise.catch(() => undefined);
          pending.push({ sample, actions: [action], promise });
        }
      }
      rendering = context.startRendering();
      for (const suspension of pending) {
        await Promise.race([
          suspension.promise,
          rendering.then(() => {
            throw new RenderError(
              "RENDER_CONTROL_GRID",
              "Offline rendering completed before a requested control boundary.",
            );
          }),
        ]);
        const actual = Math.round(context.currentTime * context.sampleRate);
        if (actual < suspension.sample || actual >= suspension.sample + quantum)
          controlFailure ??= new RenderError(
            "RENDER_CONTROL_GRID",
            "Native suspend boundaries differ from the declared render-control grid.",
          );
        for (const action of suspension.actions) {
          controls.push({
            tick: action.tick,
            requestedSample: action.desired,
            actualControlSample: actual,
            controlOffsetFrames: actual - action.desired,
          });
          if (!record.cancelled && !controlFailure) {
            try {
              action.apply();
            } catch (error) {
              controlFailure = error;
            }
          }
        }
        (engine as AudioEngine & { flushControlUpdates?: () => void }).flushControlUpdates?.();
        if (record.cancelled || controlFailure) engine.setMuted(true);
        await context.resume();
      }
      const buffer = await rendering;
      if (controlFailure) throw controlFailure;
      const { droppedVoices, droppedPaths } = engine.getDiagnostics().admissions;
      if (droppedVoices !== 0 || (request.tap !== "dryContent" && droppedPaths !== 0))
        throw new RenderError(
          "RENDER_ADMISSION_INCOMPLETE",
          `Native render dropped voices/paths (${droppedVoices}/${droppedPaths}); incomplete audio is not published.`,
        );
      this.assertActive(record);
      return {
        channels: Array.from({ length: request.channels }, (_, channel) =>
          buffer
            .getChannelData(channel)
            .subarray(job.window.preRollFrames, job.window.preRollFrames + plan.outputFrames),
        ),
        controls,
      };
    } finally {
      engine.dispose();
      // Resume any outstanding cancellation/failure boundaries so a native render cannot hang.
      if (rendering && context.state === "suspended") await context.resume().catch(() => undefined);
      const close = (context as OfflineAudioContext & { close?: () => Promise<void> }).close;
      if (close) await close.call(context).catch(() => undefined);
    }
  }
}
