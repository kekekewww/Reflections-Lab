import { encodeFloatWaveChunks } from "../../../../src/audio/render-chunk-pcm.js";
import { RenderError } from "../../../../src/audio/render-pcm.js";
import type { RenderOutputStore } from "../../../../src/audio/render-output-store.js";
import type { RenderMasterSettings } from "../../../../src/audio/render-types.js";
import { MAX_MONITOR_GAIN } from "../../../../src/audio/monitor-level.js";
import { outputSafetyCurve } from "../../../../src/audio/output-safety.js";

export interface DiagnosticPcm {
  channels: number;
  frames: number;
  sample(channel: number, frame: number): number;
}
export interface PcmDifferenceOptions {
  /** Explicit compared prefix. It is never replaced with min(actual, reference). */
  frames: number;
  sampleRateHz: 48000;
  tolerance: 2e-6;
}
export interface DifferencePoint {
  frame: number;
  channel: number;
  actual: number;
  reference: number;
  error: number;
}
type DiagnosticValue = number | "NaN" | "+Infinity" | "-Infinity" | "non-number";
export interface PcmDifferenceSummary {
  frames: number;
  channels: number;
  sampleRateHz: 48000;
  tolerance: 2e-6;
  actualFrames: number;
  referenceFrames: number;
  comparedSamples: number;
  maxError: number;
  seamError: number;
  tailError: number;
  rmsError: number;
  firstOver: DifferencePoint | null;
  atMax: DifferencePoint | null;
  overCount: number;
  perSecondMax: number[];
  nonfinite: {
    /** Invalid sample pairs, including finite-input subtraction overflow. */
    count: number;
    actual: number;
    reference: number;
    /** Only subtraction overflow with two finite inputs. */
    difference: number;
    first: {
      frame: number;
      channel: number;
      actual: DiagnosticValue;
      reference: DiagnosticValue;
    } | null;
  };
}
const DIAGNOSTIC_RATE = 48000;
const DIAGNOSTIC_MAX_FRAMES = 75 * DIAGNOSTIC_RATE;
const DIAGNOSTIC_CHUNK_FRAMES = 32768;
const DIAGNOSTIC_SEAM_RADIUS = 128;
const DIAGNOSTIC_TAIL_START = 60 * DIAGNOSTIC_RATE;

function diagnosticValue(value: unknown): DiagnosticValue {
  if (typeof value !== "number") return "non-number";
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "+Infinity";
  if (value === -Infinity) return "-Infinity";
  return value;
}
function validateVector(vector: DiagnosticPcm, label: string): void {
  if (
    !vector ||
    !Number.isSafeInteger(vector.channels) ||
    vector.channels < 1 ||
    vector.channels > 2
  )
    throw new RangeError(`${label} channel count must be one or two.`);
  if (!Number.isSafeInteger(vector.frames) || vector.frames < 0)
    throw new RangeError(`${label} frame count must be a nonnegative safe integer.`);
  if (typeof vector.sample !== "function")
    throw new TypeError(`${label} sample reader is required.`);
}
function nearSeam(frame: number, comparedFrames: number): boolean {
  const previous = Math.floor(frame / DIAGNOSTIC_CHUNK_FRAMES) * DIAGNOSTIC_CHUNK_FRAMES;
  const next = previous + DIAGNOSTIC_CHUNK_FRAMES;
  return (
    (previous > 0 && previous < comparedFrames && frame - previous <= DIAGNOSTIC_SEAM_RADIUS) ||
    (next < comparedFrames && next - frame <= DIAGNOSTIC_SEAM_RADIUS)
  );
}

/**
 * Digital diagnostic statistics, not a replacement for the original whole-take gate.
 * Reads exactly the declared prefix in frame-major/channel order. Ties keep the first
 * point; seams include +/-128 around each internal 32768-frame boundary; tail starts
 * at frame 2,880,000. Any invalid pair makes max/RMS Infinity, contributes to overCount,
 * and is separately recorded with JSON-safe value classes. Infinity in a serialized
 * numeric field must therefore be interpreted together with nonfinite, never as zero.
 */
export function summarizePcmDifference(
  actual: DiagnosticPcm,
  reference: DiagnosticPcm,
  options: PcmDifferenceOptions,
): PcmDifferenceSummary {
  validateVector(actual, "Actual");
  validateVector(reference, "Reference");
  if (actual.channels !== reference.channels) throw new RangeError("PCM channel counts differ.");
  if (
    !options ||
    !Number.isSafeInteger(options.frames) ||
    options.frames < 0 ||
    options.frames > actual.frames ||
    options.frames > reference.frames ||
    options.frames > DIAGNOSTIC_MAX_FRAMES
  )
    throw new RangeError(
      "Explicit PCM prefix must fit both vectors and the 75 second diagnostic bound.",
    );
  if (options.sampleRateHz !== DIAGNOSTIC_RATE)
    throw new RangeError("Diagnostic PCM sample rate must be 48000 Hz.");
  if (options.tolerance !== 2e-6) throw new RangeError("Diagnostic tolerance must remain 2e-6.");
  const summary: PcmDifferenceSummary = {
    frames: options.frames,
    channels: actual.channels,
    sampleRateHz: options.sampleRateHz,
    tolerance: options.tolerance,
    actualFrames: actual.frames,
    referenceFrames: reference.frames,
    comparedSamples: options.frames * actual.channels,
    maxError: 0,
    seamError: 0,
    tailError: 0,
    rmsError: 0,
    firstOver: null,
    atMax: null,
    overCount: 0,
    perSecondMax: Array.from({ length: Math.ceil(options.frames / options.sampleRateHz) }, () => 0),
    nonfinite: { count: 0, actual: 0, reference: 0, difference: 0, first: null },
  };
  // Scaled sum of squares avoids overflow when finite diagnostic values are large.
  let scale = 0;
  let normalizedSquares = 0;
  for (let frame = 0; frame < options.frames; frame++) {
    const seam = nearSeam(frame, options.frames);
    const second = Math.floor(frame / options.sampleRateHz);
    for (let channel = 0; channel < actual.channels; channel++) {
      const actualSample = actual.sample(channel, frame);
      const referenceSample = reference.sample(channel, frame);
      const actualFinite = Number.isFinite(actualSample);
      const referenceFinite = Number.isFinite(referenceSample);
      const difference =
        actualFinite && referenceFinite ? Math.abs(actualSample - referenceSample) : Infinity;
      const invalid = !actualFinite || !referenceFinite || !Number.isFinite(difference);
      const error = invalid ? Infinity : difference;
      if (invalid) {
        summary.nonfinite.count++;
        if (!actualFinite) summary.nonfinite.actual++;
        if (!referenceFinite) summary.nonfinite.reference++;
        if (actualFinite && referenceFinite) summary.nonfinite.difference++;
        summary.nonfinite.first ??= {
          frame,
          channel,
          actual: diagnosticValue(actualSample),
          reference: diagnosticValue(referenceSample),
        };
      } else if (error > 0) {
        if (scale < error) {
          normalizedSquares = 1 + normalizedSquares * (scale / error) ** 2;
          scale = error;
        } else normalizedSquares += (error / scale) ** 2;
      }
      let point: DifferencePoint | null = null;
      if (summary.atMax === null || error > summary.maxError) {
        point = { frame, channel, actual: actualSample, reference: referenceSample, error };
        summary.maxError = error;
        summary.atMax = point;
      }
      if (error > options.tolerance) {
        summary.overCount++;
        summary.firstOver ??= point ?? {
          frame,
          channel,
          actual: actualSample,
          reference: referenceSample,
          error,
        };
      }
      if (seam) summary.seamError = Math.max(summary.seamError, error);
      if (frame >= DIAGNOSTIC_TAIL_START) summary.tailError = Math.max(summary.tailError, error);
      summary.perSecondMax[second] = Math.max(summary.perSecondMax[second]!, error);
    }
  }
  summary.rmsError =
    summary.nonfinite.count > 0
      ? Infinity
      : summary.comparedSamples > 0
        ? scale * Math.sqrt(normalizedSquares / summary.comparedSamples)
        : 0;
  return summary;
}

export interface DiagnosticWave {
  id: string;
  bytes: number;
  sha256: string;
  frames: number;
  channels: number;
  rate: 48000;
}

/** Append/seal into a caller-owned begun diagnostic job; never publish or retain a whole WAV. */
export async function persistDiagnosticWave(
  store: RenderOutputStore,
  jobId: string,
  id: string,
  channels: readonly Float32Array[],
  rate: 48000,
): Promise<DiagnosticWave> {
  if (rate !== DIAGNOSTIC_RATE) throw new RangeError("Diagnostic WAVE rate must be 48000 Hz.");
  const encoded = await encodeFloatWaveChunks(channels, rate, (bytes, index) =>
    store.append(jobId, id, index, bytes),
  );
  await store.sealOutput(jobId, id, encoded.bytes, encoded.sha256);
  return {
    id,
    bytes: encoded.bytes,
    sha256: encoded.sha256,
    frames: channels[0]!.length,
    channels: channels.length,
    rate,
  };
}

/**
 * Reprocess one already-cropped mix PCM from source sample zero through a fresh master
 * graph. Before zero both the input and native processor history are known-zero; no
 * original propagation/source/IR history is restored or inferred. The complete input
 * must fit the explicit output. This diagnoses repeatability and 62-vs-63-second prefix
 * behavior only; it cannot replace the original uncropped whole-native reference gate.
 * Full native input/output buffers still consume memory. Returned channel views own
 * the output storage until the caller drops them; this is not constant-memory DSP.
 */
export async function renderFrozenMaster(
  input: AudioBuffer,
  settings: RenderMasterSettings,
  outputFrames: number,
): Promise<Float32Array[]> {
  if (
    input.sampleRate !== DIAGNOSTIC_RATE ||
    !Number.isSafeInteger(input.length) ||
    input.length < 1 ||
    !Number.isSafeInteger(input.numberOfChannels) ||
    input.numberOfChannels < 1 ||
    input.numberOfChannels > 2
  )
    throw new RenderError(
      "DIAGNOSTIC_MASTER_INPUT",
      "Frozen master needs finite mono/stereo 48000 Hz input.",
    );
  if (
    !Number.isSafeInteger(outputFrames) ||
    outputFrames < input.length ||
    outputFrames > DIAGNOSTIC_MAX_FRAMES
  )
    throw new RenderError(
      "DIAGNOSTIC_MASTER_WINDOW",
      "Frozen master output must cover the complete input within 75 seconds.",
    );
  if (
    !settings ||
    !Number.isFinite(settings.headroomGain) ||
    settings.headroomGain < 0 ||
    settings.headroomGain > 1 ||
    !Number.isFinite(settings.monitorGain) ||
    settings.monitorGain < 0 ||
    settings.monitorGain > MAX_MONITOR_GAIN ||
    typeof settings.limiterEnabled !== "boolean" ||
    typeof settings.outputSafetyClip !== "boolean"
  )
    throw new RenderError(
      "DIAGNOSTIC_MASTER_SETTINGS",
      "Frozen master settings exceed the existing graph bounds.",
    );
  for (let channel = 0; channel < input.numberOfChannels; channel++) {
    const samples = input.getChannelData(channel);
    for (let frame = 0; frame < input.length; frame++)
      if (!Number.isFinite(samples[frame]))
        throw new RenderError("NONFINITE_PCM", "Frozen master input contains nonfinite PCM.");
  }
  if (typeof OfflineAudioContext !== "function")
    throw new RenderError(
      "OFFLINE_AUDIO_UNAVAILABLE",
      "Frozen master needs a real OfflineAudioContext.",
    );
  const context = new OfflineAudioContext(input.numberOfChannels, outputFrames, DIAGNOSTIC_RATE);
  const source = context.createBufferSource();
  const run = context.createGain();
  const headroom = context.createGain();
  const monitor = context.createGain();
  const mute = context.createGain();
  const nodes: AudioNode[] = [source, run, headroom, monitor, mute];
  let started = false;
  try {
    source.buffer = input;
    source.loop = false;
    source.playbackRate.value = 1;
    source.detune.value = 0;
    run.gain.value = 1;
    headroom.gain.value = settings.headroomGain;
    monitor.gain.value = settings.monitorGain;
    mute.gain.value = 0;
    mute.gain.setValueAtTime(0, 0);
    mute.gain.linearRampToValueAtTime(1, 0.02);
    source.connect(run);
    run.connect(headroom);
    headroom.connect(monitor);
    monitor.connect(mute);
    if (settings.limiterEnabled) {
      const compressor = context.createDynamicsCompressor();
      nodes.push(compressor);
      compressor.threshold.value = -3;
      compressor.knee.value = 0;
      compressor.ratio.value = 20;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.1;
      mute.connect(compressor);
      if (settings.outputSafetyClip) {
        const safety = context.createWaveShaper();
        nodes.push(safety);
        safety.curve = outputSafetyCurve();
        safety.oversample = "none";
        compressor.connect(safety);
        safety.connect(context.destination);
      } else compressor.connect(context.destination);
    } else mute.connect(context.destination);
    source.start(0, 0);
    started = true;
    const output = await context.startRendering();
    const channels = Array.from({ length: input.numberOfChannels }, (_, channel) =>
      output.getChannelData(channel),
    );
    for (const samples of channels)
      for (let frame = 0; frame < samples.length; frame++)
        if (!Number.isFinite(samples[frame]))
          throw new RenderError(
            "NONFINITE_PCM",
            "Frozen master native output contains nonfinite PCM.",
          );
    return channels;
  } finally {
    if (started) {
      try {
        source.stop();
      } catch {
        /* The native source can already have ended. */
      }
    }
    for (const node of nodes) node.disconnect();
    try {
      source.buffer = null;
    } catch {
      /* Disconnected local source references are released on return. */
    }
    const close = (context as OfflineAudioContext & { close?: () => Promise<void> }).close;
    if (close) await close.call(context).catch(() => undefined);
  }
}
