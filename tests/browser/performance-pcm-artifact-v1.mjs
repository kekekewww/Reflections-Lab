import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Independent diagnostic-artifact policy. This is not the product WAV decoder.
// The unchanged Stage12 nonzero-quality reference is run on the same original bytes.
const DECODER_POLICY = "capture-format-v1";
const REFERENCE_PATH = "tests/browser/render/verify-downloaded-wav.mjs";
const REFERENCE_SHA256 = "11da91f61c06b4d89fa2b917f99b4e78faeb4216c6a27459eae090325ad12536";
const MAX_PCM_BYTES = 32 * 1024 * 1024;
const MAX_CAPTURE_SECONDS = 10;
const HEADER_BYTES = 56;
const DEFINITION =
  "all-channel exact-zero run >= shortest observed block; not proof of one aligned missing callback block/hardware/audibility";
const faultCounters = Object.freeze([
  "blockLengthOverflowCount",
  "missingInputFrames",
  "channelMismatchFrames",
  "nonFiniteSamples",
  "renderFrameGapFrames",
  "overlapFrames",
  "overflowFrames",
]);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const safeFrame = (value) => Number.isSafeInteger(value) && value >= 0;
const referenceBytes = await readFile(
  new URL("./render/verify-downloaded-wav.mjs", import.meta.url),
);
const actualReferenceSha256 = createHash("sha256").update(referenceBytes).digest("hex");
if (actualReferenceSha256 !== REFERENCE_SHA256)
  throw new Error("PCM_STAGE12_REFERENCE_HASH_MISMATCH");
const referenceSource = referenceBytes.toString("utf8");
const referenceStart = referenceSource.indexOf("function decodeWave(bytes, expected) {");
const referenceEnd = referenceSource.indexOf("\nfunction difference(a, b) {", referenceStart);
if (referenceStart < 0 || referenceEnd <= referenceStart)
  throw new Error("PCM_STAGE12_REFERENCE_FUNCTION_BOUNDARY");
const decodeStage12 = new Function(
  "assert",
  referenceSource.slice(referenceStart, referenceEnd) + "; return decodeWave;",
)(assert);

function unavailable(reason, status = "INVALID", reference = null) {
  return {
    schemaVersion: "1.0.0",
    decoderPolicy: DECODER_POLICY,
    status,
    qualified: false,
    reasons: [reason],
    definition: DEFINITION,
    sampleRate: null,
    channelCount: null,
    frameCount: null,
    startFrame: null,
    endFrameExclusive: null,
    actualBlockLengths: null,
    minimumDigitalGapFrames: null,
    digitalGaps: null,
    zeroRunCount: null,
    longestAllChannelZeroRunFrames: null,
    peakLinear: null,
    rmsLinear: null,
    nonZeroSamples: null,
    nativeDspCpuMs: null,
    hardwareUnderrunEvents: null,
    stage12NonzeroReference: reference ?? {
      sourcePath: REFERENCE_PATH,
      sourceSha256: actualReferenceSha256,
      status: "NOT_RUN",
      error: null,
    },
  };
}

/**
 * Verify finite, complete digital capture and report exact all-channel zero runs.
 * qualified refers only to format/finite/capture completeness. Expected active
 * source behavior, audibility, device output and performance are separate gates.
 * This function never mutates, normalizes, repairs or inserts samples into bytes.
 */
export function analyzeCapturedPcmWave(bytes, caseResult) {
  try {
    if (!Buffer.isBuffer(bytes)) return unavailable("PCM_ARTIFACT_BYTES_TYPE");
    if (bytes.length > MAX_PCM_BYTES + HEADER_BYTES) return unavailable("PCM_ARTIFACT_BYTE_CAP");
    if (bytes.length < HEADER_BYTES) return unavailable("PCM_ARTIFACT_TRUNCATED_HEADER");
    if (
      !object(caseResult) ||
      !object(caseResult.capture) ||
      !object(caseResult.timeline) ||
      !object(caseResult.wav)
    )
      return unavailable("PCM_ARTIFACT_METADATA_MISSING");
    const capture = caseResult.capture;
    const timeline = caseResult.timeline;
    const declaration = caseResult.wav;
    const rate = capture.sampleRate;
    const channels = capture.channelCount;
    const frames = capture.frameCount;
    const startFrame = capture.startFrame;
    if (
      caseResult.probeMode !== "on" ||
      capture.kind !== "capture" ||
      capture.schemaVersion !== "1.0.0" ||
      capture.status !== "COMPLETE" ||
      !Number.isSafeInteger(rate) ||
      rate < 8000 ||
      rate > 384000 ||
      ![1, 2].includes(channels) ||
      !Number.isSafeInteger(frames) ||
      frames < 1 ||
      !safeFrame(startFrame) ||
      !safeFrame(startFrame + frames)
    )
      return unavailable("PCM_ARTIFACT_CAPTURE_SCHEMA");
    const endFrame = startFrame + frames;
    const pcmBytes = frames * channels * 4;
    if (frames > rate * MAX_CAPTURE_SECONDS || pcmBytes > MAX_PCM_BYTES)
      return unavailable("PCM_ARTIFACT_DURATION_OR_PCM_CAP");
    if (
      capture.capturedFrames !== frames ||
      capture.reservedPcmBytes !== pcmBytes ||
      capture.firstCapturedContextFrame !== startFrame ||
      capture.lastCapturedContextFrameExclusive !== endFrame ||
      !Number.isSafeInteger(capture.processCalls) ||
      capture.processCalls < 1 ||
      !Array.isArray(capture.reasons) ||
      capture.reasons.length !== 0 ||
      capture.nativeDspCpuMs !== null ||
      capture.hardwareUnderrunEvents !== null ||
      faultCounters.some((key) => capture[key] !== 0)
    )
      return unavailable("PCM_ARTIFACT_CAPTURE_INCOMPLETE_OR_FAULTED");
    const blocks = capture.actualBlockLengths;
    if (
      !Array.isArray(blocks) ||
      blocks.length < 1 ||
      blocks.length > 16 ||
      blocks.some((length) => !Number.isSafeInteger(length) || length < 1 || length > 0xffffffff) ||
      new Set(blocks).size !== blocks.length
    )
      return unavailable("PCM_ARTIFACT_OBSERVED_BLOCK_SCHEMA");
    if (
      timeline.sampleRate !== rate ||
      timeline.channelCount !== channels ||
      timeline.frameCount !== frames ||
      timeline.startFrame !== startFrame ||
      timeline.endFrame !== endFrame ||
      declaration.sampleRate !== rate ||
      declaration.channels !== channels ||
      declaration.frames !== frames ||
      declaration.bytes !== bytes.length ||
      declaration.format !== "IEEE_FLOAT32_LE" ||
      declaration.normalized !== false ||
      !Number.isFinite(caseResult.actualContextTimeAtEndSeconds) ||
      caseResult.actualContextTimeAtEndSeconds < endFrame / rate
    )
      return unavailable("PCM_ARTIFACT_TIMELINE_OR_WAV_DECLARATION_MISMATCH");
    if (bytes.length !== HEADER_BYTES + pcmBytes)
      return unavailable("PCM_ARTIFACT_EXACT_BYTE_COUNT_MISMATCH");

    // The new policy deliberately accepts only this independently specified layout.
    // It does not relax or patch the older Stage12 parser's quality requirements.
    if (
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.readUInt32LE(4) !== bytes.length - 8 ||
      bytes.toString("ascii", 8, 12) !== "WAVE" ||
      bytes.toString("ascii", 12, 16) !== "fmt " ||
      bytes.readUInt32LE(16) !== 16 ||
      bytes.readUInt16LE(20) !== 3 ||
      bytes.readUInt16LE(22) !== channels ||
      bytes.readUInt32LE(24) !== rate ||
      bytes.readUInt32LE(28) !== rate * channels * 4 ||
      bytes.readUInt16LE(32) !== channels * 4 ||
      bytes.readUInt16LE(34) !== 32 ||
      bytes.toString("ascii", 36, 40) !== "fact" ||
      bytes.readUInt32LE(40) !== 4 ||
      bytes.readUInt32LE(44) !== frames ||
      bytes.toString("ascii", 48, 52) !== "data" ||
      bytes.readUInt32LE(52) !== pcmBytes
    )
      return unavailable("PCM_ARTIFACT_FIXED_RIFF_FORMAT_MISMATCH");
    if (rate !== 44100 && rate !== 48000)
      return unavailable(
        "PCM_ARTIFACT_REFERENCE_SAMPLE_RATE_UNSUPPORTED",
        "UNSUPPORTED_SAMPLE_RATE",
      );

    const minimumDigitalGapFrames = Math.min(...blocks);
    const digitalGaps = [];
    let zeroRunStart = null;
    let zeroRunCount = 0;
    let longestAllChannelZeroRunFrames = 0;
    let peakLinear = 0;
    let squaredSum = 0;
    let nonZeroSamples = 0;
    const closeZeroRun = (relativeEndFrameExclusive) => {
      if (zeroRunStart === null) return;
      const length = relativeEndFrameExclusive - zeroRunStart;
      zeroRunCount++;
      longestAllChannelZeroRunFrames = Math.max(longestAllChannelZeroRunFrames, length);
      if (length >= minimumDigitalGapFrames)
        digitalGaps.push({
          relativeStartFrame: zeroRunStart,
          relativeEndFrameExclusive,
          startFrame: startFrame + zeroRunStart,
          endFrameExclusive: startFrame + relativeEndFrameExclusive,
          frames: length,
          seconds: length / rate,
        });
      zeroRunStart = null;
    };
    for (let frame = 0; frame < frames; frame++) {
      let allChannelsZero = true;
      for (let channel = 0; channel < channels; channel++) {
        const value = bytes.readFloatLE(HEADER_BYTES + (frame * channels + channel) * 4);
        if (!Number.isFinite(value)) return unavailable("PCM_ARTIFACT_NONFINITE_SAMPLE");
        const magnitude = Math.abs(value);
        peakLinear = Math.max(peakLinear, magnitude);
        squaredSum += value * value;
        if (value !== 0) {
          allChannelsZero = false;
          nonZeroSamples++;
        }
      }
      if (allChannelsZero && zeroRunStart === null) zeroRunStart = frame;
      else if (!allChannelsZero) closeZeroRun(frame);
    }
    closeZeroRun(frames);

    const stage12NonzeroReference = {
      sourcePath: REFERENCE_PATH,
      sourceSha256: actualReferenceSha256,
      status: "PASS",
      error: null,
    };
    try {
      decodeStage12(bytes, { channels, sampleRateHz: rate, frames });
    } catch (error) {
      stage12NonzeroReference.status = "REJECTED";
      stage12NonzeroReference.error = String(error?.message ?? error);
    }
    if (nonZeroSamples > 0 && stage12NonzeroReference.status !== "PASS")
      return unavailable(
        "PCM_ARTIFACT_NONZERO_REFERENCE_REJECTED",
        "INVALID",
        stage12NonzeroReference,
      );
    if (
      nonZeroSamples === 0 &&
      (stage12NonzeroReference.status !== "REJECTED" ||
        !stage12NonzeroReference.error.includes("PCM data contains nonzero samples"))
    )
      return unavailable(
        "PCM_ARTIFACT_SILENCE_REFERENCE_POLICY_MISMATCH",
        "INVALID",
        stage12NonzeroReference,
      );

    return {
      schemaVersion: "1.0.0",
      decoderPolicy: DECODER_POLICY,
      status: "VERIFIED_DIGITAL_PCM",
      qualified: true,
      reasons: [],
      definition: DEFINITION,
      sampleRate: rate,
      channelCount: channels,
      frameCount: frames,
      startFrame,
      endFrameExclusive: endFrame,
      actualBlockLengths: blocks.slice(),
      minimumDigitalGapFrames,
      digitalGaps,
      zeroRunCount,
      longestAllChannelZeroRunFrames,
      peakLinear,
      rmsLinear: Math.sqrt(squaredSum / (frames * channels)),
      nonZeroSamples,
      nativeDspCpuMs: null,
      hardwareUnderrunEvents: null,
      stage12NonzeroReference,
    };
  } catch {
    return unavailable("PCM_ARTIFACT_READER_EXCEPTION");
  }
}
