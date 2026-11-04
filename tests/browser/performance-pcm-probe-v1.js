/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentFrame */
// Test-only digital render observer. It never measures device underruns or DSP CPU.
// One bounded interleaved PCM pool and 16 block-length slots are allocated before process().
const PCM_MAX_SECONDS = 10;
const PCM_MAX_BYTES = 32 * 1024 * 1024;
const PCM_BLOCK_LENGTH_SLOTS = 16;
const PCM_REASON_SLOTS = 16;
const safeFrame = (value) => Number.isSafeInteger(value) && value >= 0;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const add = (previous, amount) => Math.min(Number.MAX_SAFE_INTEGER, previous + amount);
const floatChannel = (value) =>
  ArrayBuffer.isView(value) &&
  Object.prototype.toString.call(value) === "[object Float32Array]" &&
  Number.isSafeInteger(value.length) &&
  value.length > 0 &&
  value.length <= 0xffffffff;

class ReflectionPerformancePcmProbeV1 extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options?.processorOptions;
    if (
      !object(config) ||
      Object.keys(config).length !== 3 ||
      !["startFrame", "frameCount", "channelCount"].every((key) =>
        Object.prototype.hasOwnProperty.call(config, key),
      ) ||
      !Number.isFinite(sampleRate) ||
      sampleRate < 8000 ||
      sampleRate > 384000 ||
      !safeFrame(config.startFrame) ||
      !Number.isSafeInteger(config.frameCount) ||
      config.frameCount < 1 ||
      config.frameCount > Math.floor(sampleRate * PCM_MAX_SECONDS) ||
      ![1, 2].includes(config.channelCount) ||
      !safeFrame(config.startFrame + config.frameCount) ||
      config.frameCount * config.channelCount * 4 > PCM_MAX_BYTES
    )
      throw new RangeError("Invalid PCM capture configuration or capacity");

    this.startFrame = config.startFrame;
    this.frameCount = config.frameCount;
    this.endFrame = this.startFrame + this.frameCount;
    this.channelCount = config.channelCount;
    this.actualSampleRate = sampleRate;
    this.reservedPcmBytes = this.frameCount * this.channelCount * 4;
    this.pcm = new Float32Array(this.frameCount * this.channelCount);
    this.blockLengths = new Uint32Array(PCM_BLOCK_LENGTH_SLOTS);
    this.blockLengthCount = 0;
    this.blockLengthOverflowCount = 0;
    this.reasons = [];
    this.terminal = false;
    this.processCalls = 0;
    this.capturedFrames = 0;
    this.firstCapturedContextFrame = null;
    this.lastCapturedContextFrameExclusive = null;
    this.observedThroughFrame = null;
    this.missingInputFrames = 0;
    this.channelMismatchFrames = 0;
    this.nonFiniteSamples = 0;
    this.renderFrameGapFrames = 0;
    this.overlapFrames = 0;
    this.overflowFrames = 0;
    this.port.onmessage = (event) => {
      if (this.terminal) return;
      const data = event?.data;
      if (
        object(data) &&
        Object.keys(data).length === 1 &&
        Object.prototype.hasOwnProperty.call(data, "kind") &&
        Object.keys(data)[0] === "kind" &&
        data.kind === "cancel"
      ) {
        this.finish("CANCELLED");
      } else {
        this.invalidate("UNKNOWN_CONTROL_MESSAGE");
        this.finish("INVALID");
      }
    };
  }

  invalidate(reason) {
    if (!this.reasons.includes(reason) && this.reasons.length < PCM_REASON_SLOTS)
      this.reasons.push(reason);
  }

  observeBlockLength(length) {
    for (let index = 0; index < this.blockLengthCount; index++)
      if (this.blockLengths[index] === length) return;
    if (this.blockLengthCount === PCM_BLOCK_LENGTH_SLOTS) {
      this.blockLengthOverflowCount = add(this.blockLengthOverflowCount, 1);
      this.invalidate("BLOCK_LENGTH_METADATA_OVERFLOW");
      return;
    }
    this.blockLengths[this.blockLengthCount++] = length;
  }

  finish(status) {
    if (this.terminal) return;
    this.terminal = true;
    const actualBlockLengths = new Array(this.blockLengthCount);
    for (let index = 0; index < this.blockLengthCount; index++)
      actualBlockLengths[index] = this.blockLengths[index];
    const buffer = status === "CANCELLED" ? null : this.pcm.buffer;
    // Only terminal messages allocate a bounded ordinary record/array. No per-block PCM views.
    const message = {
      kind: "capture",
      schemaVersion: "1.0.0",
      status,
      sampleRate: this.actualSampleRate,
      startFrame: this.startFrame,
      frameCount: this.frameCount,
      channelCount: this.channelCount,
      capturedFrames: this.capturedFrames,
      reservedPcmBytes: this.reservedPcmBytes,
      firstCapturedContextFrame: this.firstCapturedContextFrame,
      lastCapturedContextFrameExclusive: this.lastCapturedContextFrameExclusive,
      processCalls: this.processCalls,
      actualBlockLengths,
      blockLengthOverflowCount: this.blockLengthOverflowCount,
      missingInputFrames: this.missingInputFrames,
      channelMismatchFrames: this.channelMismatchFrames,
      nonFiniteSamples: this.nonFiniteSamples,
      renderFrameGapFrames: this.renderFrameGapFrames,
      overlapFrames: this.overlapFrames,
      overflowFrames: this.overflowFrames,
      pcm: buffer,
      nativeDspCpuMs: null,
      hardwareUnderrunEvents: null,
      reasons: this.reasons.slice(),
    };
    if (buffer === null) this.port.postMessage(message);
    else this.port.postMessage(message, [buffer]);
    this.pcm = null;
  }

  process(inputs, outputs) {
    if (this.terminal) return false;
    this.processCalls = add(this.processCalls, 1);
    const input = inputs?.[0];
    const output = outputs?.[0];
    const inputCount = Array.isArray(input) ? input.length : 0;
    const outputCount = Array.isArray(output) ? output.length : 0;
    const inputLength = inputCount && floatChannel(input[0]) ? input[0].length : null;
    const outputLength = outputCount && floatChannel(output[0]) ? output[0].length : null;
    if (inputLength === null && outputLength === null) {
      this.invalidate("NO_ACTUAL_BLOCK_LENGTH");
      this.finish("INVALID");
      return false;
    }
    if (
      !safeFrame(currentFrame) ||
      (inputLength !== null && outputLength !== null && inputLength !== outputLength)
    ) {
      this.invalidate("INCONSISTENT_CONTEXT_OR_BLOCK_LENGTH");
      this.finish("INVALID");
      return false;
    }
    const length = inputLength ?? outputLength;
    const blockEnd = currentFrame + length;
    if (!safeFrame(blockEnd)) {
      this.invalidate("INVALID_CONTEXT_FRAME_END");
      this.finish("INVALID");
      return false;
    }
    for (let channel = 0; channel < inputCount; channel++) {
      if (!floatChannel(input[channel]) || input[channel].length !== length) {
        this.invalidate("INCONSISTENT_INPUT_CHANNEL_LENGTH");
        this.finish("INVALID");
        return false;
      }
    }
    for (let channel = 0; channel < outputCount; channel++) {
      if (!floatChannel(output[channel]) || output[channel].length !== length) {
        this.invalidate("INCONSISTENT_OUTPUT_CHANNEL_LENGTH");
        this.finish("INVALID");
        return false;
      }
    }
    this.observeBlockLength(length);

    // Transparent observer output. A parallel muted sink prevents adding an audible route.
    for (let channel = 0; channel < outputCount; channel++) {
      if (channel < inputCount) output[channel].set(input[channel]);
      else output[channel].fill(0);
    }

    const previousEnd = this.observedThroughFrame;
    const activeStart = Math.max(currentFrame, this.startFrame);
    const activeEnd = Math.min(blockEnd, this.endFrame);
    const activeFrames = Math.max(0, activeEnd - activeStart);
    const gapStart =
      previousEnd === null ? this.startFrame : Math.max(previousEnd, this.startFrame);
    const gapEnd = Math.min(currentFrame, this.endFrame);
    if (gapEnd > gapStart) {
      this.renderFrameGapFrames = add(this.renderFrameGapFrames, gapEnd - gapStart);
      this.invalidate("RENDER_CONTEXT_FRAME_GAP");
    }
    if (previousEnd !== null) {
      const overlapEnd = Math.min(previousEnd, blockEnd, this.endFrame);
      if (overlapEnd > activeStart) {
        this.overlapFrames = add(this.overlapFrames, overlapEnd - activeStart);
        this.invalidate("RENDER_CONTEXT_FRAME_OVERLAP");
      }
    }
    const firstUniqueFrame = Math.max(activeStart, previousEnd ?? activeStart);
    const uniqueFrames = Math.max(0, activeEnd - firstUniqueFrame);
    if (
      activeFrames > 0 &&
      (inputCount !== this.channelCount || outputCount !== this.channelCount)
    ) {
      this.channelMismatchFrames = add(this.channelMismatchFrames, activeFrames);
      this.invalidate("CAPTURE_CHANNEL_MISMATCH");
    }
    if (uniqueFrames > 0) {
      if (inputCount === 0) {
        this.missingInputFrames = add(this.missingInputFrames, uniqueFrames);
        this.invalidate("MISSING_CAPTURE_INPUT");
      } else {
        for (let frame = firstUniqueFrame; frame < activeEnd; frame++) {
          const targetFrame = frame - this.startFrame;
          const targetOffset = targetFrame * this.channelCount;
          if (targetOffset < 0 || targetOffset + this.channelCount > this.pcm.length) {
            this.overflowFrames = add(this.overflowFrames, 1);
            this.invalidate("PCM_POOL_OVERFLOW");
            continue;
          }
          const inputOffset = frame - currentFrame;
          for (let channel = 0; channel < this.channelCount; channel++) {
            if (channel < inputCount) {
              const value = input[channel][inputOffset];
              this.pcm[targetOffset + channel] = value;
              if (!Number.isFinite(value)) {
                this.nonFiniteSamples = add(this.nonFiniteSamples, 1);
                this.invalidate("NONFINITE_CAPTURE_SAMPLE");
              }
            }
          }
          this.capturedFrames = add(this.capturedFrames, 1);
          if (this.firstCapturedContextFrame === null) this.firstCapturedContextFrame = frame;
          this.lastCapturedContextFrameExclusive = frame + 1;
        }
      }
    }
    this.observedThroughFrame = previousEnd === null ? blockEnd : Math.max(previousEnd, blockEnd);
    if (blockEnd >= this.endFrame) {
      if (this.capturedFrames !== this.frameCount)
        this.invalidate("INCOMPLETE_CAPTURE_FRAME_COUNT");
      this.finish(this.reasons.length === 0 ? "COMPLETE" : "INVALID");
      return false;
    }
    return true;
  }
}

registerProcessor("reflection-performance-pcm-probe-v1", ReflectionPerformancePcmProbeV1);
