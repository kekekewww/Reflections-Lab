import assert from "node:assert/strict";
import test from "node:test";
import { createBandFilterKernel } from "../../src/audio/band-filter.js";

function response(kernel: Float32Array, frequency: number, sampleRate: number) {
  let real = 0;
  let imaginary = 0;
  for (let n = 0; n < kernel.length; n++) {
    const angle = (2 * Math.PI * frequency * n) / sampleRate;
    real += (kernel[n] ?? 0) * Math.cos(angle);
    imaginary -= (kernel[n] ?? 0) * Math.sin(angle);
  }
  return { real, imaginary, magnitude: Math.hypot(real, imaginary) };
}

test("uniform pressure ratios use an exact gain route with no FIR or algorithmic group delay", () => {
  assert.equal(createBandFilterKernel([125, 1000, 8000], [0.5, 0.5, 0.5], 48000), null);
  assert.equal(createBandFilterKernel([125, 1000, 8000], [0, 0, 0], 48000), null);
  assert.equal(createBandFilterKernel([1000], [3], 48000), null);
});

test("nonuniform response has bounded odd length and a symmetric linear-phase kernel", () => {
  const result = createBandFilterKernel([1000, 4000, 12000], [0.25, 0.5, 1], 48000);
  assert.ok(result);
  assert.equal(result.kernel.length, 129);
  assert.equal(result.scale, 1);
  assert.equal(result.model, "windowedFrequencySamplingApproximation");
  assert.equal(result.groupDelaySeconds, 64 / 48000);
  assert.ok(result.kernel.every(Number.isFinite));
  for (let i = 0; i < result.kernel.length; i++) {
    assert.ok(Math.abs((result.kernel[i] ?? 0) - (result.kernel[128 - i] ?? 0)) < 1e-7);
  }
});

test("broad band target amplitudes are approximated by an independently evaluated complex response", () => {
  const result = createBandFilterKernel([1000, 4000, 12000], [0.25, 0.5, 1], 48000);
  assert.ok(result);
  for (const [frequency, target] of [
    [0, 0.25],
    [1000, 0.25],
    [4000, 0.5],
    [12000, 1],
    [24000, 1],
  ]) {
    assert.ok(frequency !== undefined && target !== undefined);
    const actual = response(result.kernel, frequency, 48000).magnitude * result.scale;
    assert.ok(
      Math.abs(actual - target) < 0.055,
      `${frequency}Hz target=${target}, actual=${actual}`,
    );
  }
});

test("frequency interpolation is logarithmic and linear-phase delay remains explicit", () => {
  const result = createBandFilterKernel([1000, 4000], [0.2, 0.8], 48000, 257);
  assert.ok(result);
  const measured = response(result.kernel, 2000, 48000);
  assert.ok(Math.abs(measured.magnitude * result.scale - 0.5) < 0.025);
  const undoPhase = (2 * Math.PI * 2000 * 128) / 48000;
  const imaginaryAfterRemovingDelay =
    measured.real * Math.sin(undoPhase) + measured.imaginary * Math.cos(undoPhase);
  assert.ok(Math.abs(imaginaryAfterRemovingDelay) < 1e-6);
  assert.equal(result.groupDelaySeconds, 128 / 48000);
});

test("normalization records the pressure scale without silently normalizing target DC to unity", () => {
  const a = createBandFilterKernel([1000, 4000, 12000], [0.25, 0.5, 1], 48000);
  const b = createBandFilterKernel([1000, 4000, 12000], [0.5, 1, 2], 48000);
  assert.ok(a && b);
  assert.equal(b.scale, 2);
  assert.deepEqual(a.kernel, b.kernel);
  assert.ok(Math.abs(response(b.kernel, 0, 48000).magnitude * b.scale - 0.5) < 0.01);
});

test("zero bands remain a finite attenuation approximation rather than a zero gain normalization error", () => {
  const result = createBandFilterKernel([1000, 4000, 12000], [0, 0.2, 0.8], 48000);
  assert.ok(result);
  assert.equal(result.scale, 0.8);
  assert.ok(result.kernel.every(Number.isFinite));
  assert.ok(response(result.kernel, 0, 48000).magnitude * result.scale < 0.01);
  assert.ok(Math.abs(response(result.kernel, 12000, 48000).magnitude * result.scale - 0.8) < 0.03);
});

test("independent dense-DTFT oracle bounds one declared broad-band fixture without claiming arbitrary octave precision", () => {
  const frequencies = [125, 500, 2000, 8000, 16000];
  const gains = [1, 1, 0.5, 0.25, 0.125];
  const result = createBandFilterKernel(frequencies, gains, 48000);
  assert.ok(result);
  // Independently computed inverse-DTFT + Hann reference, not source code output.
  const oracleMagnitudes = [0.9955293, 0.9374837, 0.51249, 0.2500988, 0.1262586];
  for (let i = 0; i < frequencies.length; i++) {
    const measured = response(result.kernel, frequencies[i] ?? 0, 48000).magnitude;
    assert.ok(Math.abs(measured - (oracleMagnitudes[i] ?? 0)) < 0.000005);
  }
  let maximumError = 0;
  for (let frequency = 20; frequency <= 24000; frequency += 10) {
    let target = gains[0] ?? 0;
    if (frequency >= 16000) target = gains[4] ?? 0;
    else if (frequency > 125) {
      for (let i = 1; i < frequencies.length; i++) {
        const upper = frequencies[i] ?? Infinity;
        if (frequency > upper) continue;
        const lower = frequencies[i - 1] ?? 125;
        const fraction = Math.log(frequency / lower) / Math.log(upper / lower);
        target = (gains[i - 1] ?? 0) * (1 - fraction) + (gains[i] ?? 0) * fraction;
        break;
      }
    }
    maximumError = Math.max(
      maximumError,
      Math.abs(response(result.kernel, frequency, 48000).magnitude - target),
    );
  }
  assert.ok(maximumError < 0.07, `Declared fixture maximum magnitude error=${maximumError}`);
});

test("invalid frequency, gain and shape inputs fail explicitly before allocation", () => {
  for (const [frequencies, gains, sampleRate] of [
    [[], [], 48000],
    [[1000, 1000], [1, 0.5], 48000],
    [[1000, 500], [1, 0.5], 48000],
    [[19], [1], 48000],
    [[24001], [1], 48000],
    [[1000], [NaN], 48000],
    [[1000], [-1], 48000],
    [[1000], [Infinity], 48000],
    [[1000, 2000], [1], 48000],
    [[1000], [1], 0],
    [[1000], [1], Infinity],
  ] as const) {
    assert.throws(() => createBandFilterKernel(frequencies, gains, sampleRate));
  }
  assert.throws(() =>
    createBandFilterKernel(
      Array.from({ length: 33 }, (_, i) => 20 + i),
      Array(33).fill(1),
      48000,
    ),
  );
});

test("tap budgets are bounded and cannot be bypassed with noninteger or nonfinite values", () => {
  for (const count of [31, 32, 128, 258, 10001, NaN, Infinity, 129.5]) {
    assert.throws(() => createBandFilterKernel([1000, 4000], [0.2, 1], 48000, count));
  }
  assert.equal(createBandFilterKernel([1000, 4000], [0.2, 1], 48000, 33)?.kernel.length, 33);
  assert.equal(createBandFilterKernel([1000, 4000], [0.2, 1], 48000, 257)?.kernel.length, 257);
});
