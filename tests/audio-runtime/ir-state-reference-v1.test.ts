import assert from "node:assert/strict";
import test from "node:test";
import { createBandFilterKernel } from "../../src/audio/band-filter.js";
import {
  IR_STATE_REFERENCE_VERSION,
  IR_STATE_RATE,
  IR_STATE_FRAMES,
  IR_STATE_BANDS,
  IR_STATE_GAINS_A,
  IR_STATE_GAINS_B,
  IR_STATE_BASELINE_SHA256,
  fixedIrStateKernel,
} from "./ir-state-reference-v1-data.js";

/** Direct scalar cosine sum; no production FFT, cached plans or production interpolation are used. */
function independentKernel(gains: readonly number[]): Float64Array {
  const grid = 2048;
  const frequencies = [1000, 4000, 12000];
  const scale = Math.max(...gains);
  const spectrum = new Float64Array(grid / 2 + 1);
  for (let bin = 0; bin < spectrum.length; bin++) {
    const frequency = (bin * 48000) / grid;
    let amplitude = gains[0]!;
    if (frequency >= frequencies[2]!) amplitude = gains[2]!;
    else if (frequency > frequencies[0]!) {
      const interval = frequency <= frequencies[1]! ? 0 : 1;
      const lower = frequencies[interval]!;
      const upper = frequencies[interval + 1]!;
      const fraction =
        (Math.log2(frequency) - Math.log2(lower)) / (Math.log2(upper) - Math.log2(lower));
      amplitude = gains[interval]! * (1 - fraction) + gains[interval + 1]! * fraction;
    }
    spectrum[bin] = amplitude / scale;
  }
  const result = new Float64Array(129);
  for (let tap = 1; tap < 128; tap++) {
    const displacement = tap - 64;
    let value = spectrum[0]! + spectrum[1024]! * (-1) ** displacement;
    for (let bin = 1; bin < 1024; bin++)
      value += 2 * spectrum[bin]! * Math.cos((2 * Math.PI * bin * displacement) / grid);
    const hann = (1 - Math.cos((Math.PI * tap) / 64)) / 2;
    result[tap] = (value / grid) * hann;
  }
  return result;
}

function bytes(kernel: Float32Array): Buffer {
  return Buffer.from(kernel.buffer, kernel.byteOffset, kernel.byteLength);
}

test("IR-state reference pins the pre-run fixture version, source hash and authored response layouts", () => {
  assert.equal(IR_STATE_REFERENCE_VERSION, "native-ir-state-reference-v1");
  assert.equal(IR_STATE_RATE, 48000);
  assert.equal(IR_STATE_FRAMES, 12000);
  assert.deepEqual(IR_STATE_BANDS, [1000, 4000, 12000]);
  assert.deepEqual(IR_STATE_GAINS_A, [0.25, 0.5, 1]);
  assert.deepEqual(IR_STATE_GAINS_B, [1, 0.5, 0.25]);
  assert.equal(
    IR_STATE_BASELINE_SHA256,
    "dedfed098eb37e4e4d82dcc76450c3c33fdd3edc8b0b1baaa2db56fa413f4e12",
  );
});

for (const name of ["A", "B"] as const) {
  const gains = name === "A" ? [0.25, 0.5, 1] : [1, 0.5, 0.25];
  test(`fixed response ${name} agrees with an independent inverse DFT and Hann oracle within 1e-7`, () => {
    const actual = fixedIrStateKernel(name);
    const expected = independentKernel(gains);
    assert.equal(actual.length, 129);
    assert.equal(actual[0], 0);
    assert.equal(actual[128], 0);
    assert.ok(actual.every(Number.isFinite));
    for (let tap = 0; tap < 129; tap++) {
      assert.ok(Math.abs(actual[tap]! - expected[tap]!) < 1e-7, `${name} oracle tap ${tap}`);
      assert.ok(Math.abs(actual[tap]! - actual[128 - tap]!) < 1e-7, `${name} symmetry tap ${tap}`);
    }
  });

  test(`live response ${name} retains every fixed Float32 byte, scale and group delay`, () => {
    const actual = createBandFilterKernel([1000, 4000, 12000], gains, 48000);
    assert.ok(actual);
    assert.deepEqual(bytes(actual.kernel), bytes(fixedIrStateKernel(name)));
    assert.equal(actual.scale, 1);
    assert.equal(actual.groupDelaySeconds, 64 / 48000);
    assert.equal(actual.model, "windowedFrequencySamplingApproximation");
  });

  test(`response ${name} scaled by two keeps the fixed normalized bytes with fresh retained ownership`, () => {
    const initial = createBandFilterKernel([1000, 4000, 12000], gains, 48000);
    const scaled = createBandFilterKernel(
      [1000, 4000, 12000],
      gains.map((gain) => gain * 2),
      48000,
    );
    assert.ok(initial && scaled);
    assert.equal(scaled.scale, 2);
    assert.equal(scaled.groupDelaySeconds, 64 / 48000);
    assert.notEqual(initial.kernel.buffer, scaled.kernel.buffer);
    assert.deepEqual(bytes(scaled.kernel), bytes(fixedIrStateKernel(name)));
    scaled.kernel[64] = 123;
    assert.deepEqual(bytes(initial.kernel), bytes(fixedIrStateKernel(name)));
    const later = createBandFilterKernel([1000, 4000, 12000], gains, 48000);
    assert.ok(later);
    assert.notEqual(later.kernel.buffer, initial.kernel.buffer);
    assert.deepEqual(bytes(later.kernel), bytes(fixedIrStateKernel(name)));
  });
}

test("each literal-word decode owns fresh Float32 storage and cannot mutate a later fixed response", () => {
  for (const name of ["A", "B"] as const) {
    const first = fixedIrStateKernel(name);
    const second = fixedIrStateKernel(name);
    const saved = Buffer.from(bytes(second));
    assert.notEqual(first.buffer, second.buffer);
    first.fill(99);
    assert.deepEqual(bytes(second), saved);
    assert.deepEqual(bytes(fixedIrStateKernel(name)), saved);
  }
});

test("unknown runtime fixture names fail explicitly", () => {
  assert.throws(() => fixedIrStateKernel("unknown" as "A"), RangeError);
});
