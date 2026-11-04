/* global registerProcessor, AudioWorkletProcessor, currentFrame, sampleRate */
// Measurement-only tap: reports the RMS and peak of each render quantum reaching the
// destination. It runs on the audio thread, allocates one batch per 32 quanta and never blocks.
const BATCH = 32;

class RenderedOutputTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.rms = new Float32Array(BATCH);
    this.peak = new Float32Array(BATCH);
    this.count = 0;
    this.firstFrame = 0;
  }
  process(inputs) {
    const channels = inputs[0] ?? [];
    let sum = 0,
      peak = 0,
      samples = 0;
    for (const channel of channels) {
      for (let i = 0; i < channel.length; i++) {
        const value = channel[i];
        sum += value * value;
        const magnitude = Math.abs(value);
        if (magnitude > peak) peak = magnitude;
      }
      samples += channel.length;
    }
    if (this.count === 0) this.firstFrame = currentFrame;
    this.rms[this.count] = samples ? Math.sqrt(sum / samples) : 0;
    this.peak[this.count] = peak;
    this.count++;
    if (this.count === BATCH) {
      this.port.postMessage(
        { firstFrame: this.firstFrame, sampleRate, rms: this.rms, peak: this.peak },
        [this.rms.buffer, this.peak.buffer],
      );
      this.rms = new Float32Array(BATCH);
      this.peak = new Float32Array(BATCH);
      this.count = 0;
    }
    return true;
  }
}

registerProcessor("rendered-output-tap", RenderedOutputTap);
