import {
  readAudioContentModelPin,
  type AudioOscillatorModel,
} from "../../../../src/audio/content-model.js";
import { AudioEngine } from "../../../../src/audio/engine.js";
import type { AudioEngineOptions } from "../../../../src/audio/types.js";
import type { BehaviorAsset } from "../../../../src/audio-behavior/types.js";
import { ReplayAudioHost } from "../../../../src/app/replay-audio.js";
import type { RecordedBehaviorSnapshot } from "../../../../src/app/recording-processor.js";
import type { RenderJob } from "../../../../src/audio/render-contract.js";
import type { RenderInput } from "../../../../src/audio/render-types.js";

type ReferenceTap = "simulatedMix" | "master" | "dryContent";

/**
 * Whole-take native reference for the recorded-source render fixture.
 *
 * This deliberately does not call the production renderer, validation-plan builder,
 * chunk encoder, or output store. It independently maps captured ticks, drives one
 * uninterrupted native graph, and returns views over that graph's final PCM buffer.
 * AudioEngine and ReplayAudioHost are shared product components: this is an
 * independent orchestration/encoding oracle, not an independent DSP implementation,
 * a browser-independent HRTF oracle, or captured hardware PCM.
 *
 * The caller owns the returned channel views and must release them before rendering
 * another large reference. The full native AudioBuffer still consumes memory.
 */
export async function renderWholeNativeReference(
  input: RenderInput,
  job: RenderJob,
  tap: ReferenceTap,
): Promise<{ channels: Float32Array[]; controls: number[] }> {
  const rate = job.clock.sampleRateHz;
  const sampleAtTick = (tick: number): number => {
    const numerator =
      (tick - job.clock.tickOrigin) * job.clock.fixedDtNumerator * job.clock.sampleRateHz;
    if (!Number.isSafeInteger(numerator)) throw new Error("REFERENCE_CLOCK_OVERFLOW");
    const sample = Math.round(numerator / job.clock.fixedDtDenominator);
    if (!Number.isSafeInteger(sample) || sample < 0) throw new Error("REFERENCE_CLOCK_RANGE");
    return sample;
  };
  if (input.configuration.controlQuantumFrames !== 128)
    throw new Error("REFERENCE_CONTROL_QUANTUM_UNSUPPORTED");
  if (job.listener.kind !== "recorded" || job.spatialization.kind !== "nativePanner")
    throw new Error("REFERENCE_SPATIAL_POLICY_UNSUPPORTED");
  const request = job.outputs.find(
    (output) => output.tap === tap && output.sources.kind === "allRecordedSources",
  );
  if (!request) throw new Error("REFERENCE_REQUIRES_ALL_RECORDED_SOURCES_TAP");
  const startSample = sampleAtTick(job.window.startTick);
  const renderOriginSample = startSample - job.window.preRollFrames;
  const firstIndex = input.recording.frames.findIndex(
    (frame) => sampleAtTick(frame.tick) === renderOriginSample,
  );
  if (firstIndex < 0) throw new Error("REFERENCE_PREROLL_TICK_UNAVAILABLE");
  const frames = input.recording.frames.filter(
    (frame, index) => index >= firstIndex && frame.tick < job.window.endTickExclusive,
  );
  const first = frames[0];
  if (!first) throw new Error("REFERENCE_EMPTY_WINDOW");
  const emissionEnd = sampleAtTick(job.window.endTickExclusive) - renderOriginSample;
  const outputFrames =
    sampleAtTick(job.window.endTickExclusive) - startSample + job.window.tailFrames;
  const contextFrames = job.window.preRollFrames + outputFrames;
  if (!Number.isSafeInteger(contextFrames) || contextFrames < 1)
    throw new Error("REFERENCE_FRAME_RANGE");
  if (
    tap !== "dryContent" &&
    frames.some((frame) =>
      frame.acousticFrames.some((acoustic) => acoustic.pathAvailability !== "available"),
    )
  )
    throw new Error("REFERENCE_ACOUSTICS_UNAVAILABLE");

  const context = new OfflineAudioContext(request.channels, contextFrames, rate);
  const master = input.configuration.master;
  const options: AudioEngineOptions & {
    oscillatorModel: AudioOscillatorModel;
    virtualization: false;
  } = {
    context,
    headroomGain: master.headroomGain,
    monitorGain: master.monitorGain,
    limiterEnabled: master.limiterEnabled,
    outputSafetyClip: master.outputSafetyClip,
    spatializationModel: job.spatialization.model,
    offlineOutputTap: tap,
    oscillatorModel: readAudioContentModelPin(input.recording.configuration.generatorConfig),
    virtualization: false,
    budget: {
      maxVoices: 64,
      maxSources: 64,
      maxSourceFrames: 128,
      maxPathsPerVoice: 16,
      maxTotalPaths: 256,
    },
  };
  const engine = new AudioEngine(options);
  const assets: BehaviorAsset[] = input.assetBank.map((entry) => ({
    assetId: entry.assetId,
    revision: entry.metadata.revision ?? 1,
    sha256: entry.metadata.sha256 ?? "",
    availability: "READY",
    rightsStatus: "APPROVED",
    durationSeconds: entry.buffer.duration,
  }));
  let attached = firstIndex === 0;
  const replay = new ReplayAudioHost({
    getEngine: () => (attached ? engine : null),
    getAssets: () => assets,
  });
  // Stable captured instance IDs, including voices restored from a pre-window cursor.
  // Stopping an already-ended instance is a no-op in the existing source graph.
  const instanceIds = new Set<string>();
  for (const frame of frames) {
    const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot | undefined;
    for (const event of frame.audioEvents) {
      if (
        !event ||
        typeof event !== "object" ||
        !("instanceId" in event) ||
        typeof event.instanceId !== "string" ||
        !event.instanceId
      )
        throw new Error("REFERENCE_AUDIO_EVENT_INSTANCE");
      instanceIds.add(event.instanceId);
    }
    for (const state of [snapshot?.preStepSnapshot, snapshot?.runtimeSnapshot])
      for (const instance of state?.state.instances ?? []) instanceIds.add(instance.instanceId);
  }
  const controls: number[] = [];
  let rendering: Promise<AudioBuffer> | null = null;
  try {
    for (const entry of input.assetBank)
      engine.registerBuffer(entry.assetId, entry.buffer, entry.metadata);
    await engine.enable(first.tick * input.recording.configuration.fixedDtS);
    engine.setMuted(false);
    engine.setLateReverb({
      ...master.lateReverb,
      enabled: tap !== "dryContent" && master.lateReverb.enabled,
    });
    await replay.begin(input.recording);
    if (!attached) {
      await replay.seek(first);
      attached = true;
      await replay.resume();
    }
    replay.applyFrame(first);

    // Every control point is registered before native rendering begins. Encoding
    // boundaries never appear here, so native filters, HRTF, IR and compressor state
    // cannot be reset by the output file's chunk layout.
    const boundaries = new Map<number, (() => void)[]>();
    const addControl = (desired: number, action: () => void): void => {
      const boundary = Math.floor(desired / 128) * 128;
      if (boundary <= 0 || boundary >= contextFrames)
        throw new Error("REFERENCE_CONTROL_OUTSIDE_CONTEXT");
      const actions = boundaries.get(boundary) ?? [];
      actions.push(action);
      boundaries.set(boundary, actions);
    };
    for (const frame of frames.slice(1))
      addControl(sampleAtTick(frame.tick) - renderOriginSample, () => replay.applyFrame(frame));
    if (emissionEnd < contextFrames)
      addControl(emissionEnd, () => {
        for (const instanceId of instanceIds) engine.stopVoice(instanceId);
      });
    const flushSample = Math.min(contextFrames - 1, emissionEnd + Math.ceil(rate * 0.1));
    if (flushSample > emissionEnd) addControl(flushSample, () => undefined);
    const suspensions = [...boundaries]
      .sort(([left], [right]) => left - right)
      .map(([sample, actions]) => {
        const promise = context.suspend(sample / rate);
        void promise.catch(() => undefined);
        return { sample, actions, promise };
      });
    rendering = context.startRendering();
    let failure: unknown = null;
    for (const point of suspensions) {
      await Promise.race([
        point.promise,
        rendering.then(() => {
          throw new Error("REFERENCE_NATIVE_COMPLETED_BEFORE_CONTROL");
        }),
      ]);
      const actual = Math.round(context.currentTime * rate);
      if (actual < point.sample || actual >= point.sample + 128)
        failure ??= new Error("REFERENCE_NATIVE_CONTROL_GRID_MISMATCH");
      for (const action of point.actions) {
        controls.push(actual);
        if (failure === null) {
          try {
            action();
          } catch (error) {
            failure = error;
          }
        }
      }
      try {
        engine.flushControlUpdates();
      } catch (error) {
        failure ??= error;
      }
      if (failure !== null) engine.setMuted(true);
      await context.resume();
    }
    const buffer = await rendering;
    if (failure !== null) throw failure;
    const { droppedVoices, droppedPaths } = engine.getDiagnostics().admissions;
    if (droppedVoices !== 0 || droppedPaths !== 0)
      throw new Error(`REFERENCE_NATIVE_ADMISSION_INCOMPLETE:${droppedVoices}:${droppedPaths}`);
    return {
      channels: Array.from({ length: request.channels }, (_, channel) =>
        buffer
          .getChannelData(channel)
          .subarray(job.window.preRollFrames, job.window.preRollFrames + outputFrames),
      ),
      controls,
    };
  } finally {
    engine.dispose();
    if (rendering && context.state === "suspended") await context.resume().catch(() => undefined);
    const close = (context as OfflineAudioContext & { close?: () => Promise<void> }).close;
    if (close) await close.call(context).catch(() => undefined);
  }
}
