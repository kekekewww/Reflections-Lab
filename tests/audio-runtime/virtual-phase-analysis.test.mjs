import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFundamental } from "../browser/audio-virtualization/analyze-pcm.mjs";

const sampleRate = 48000;
const frequencyHz = 137.3;
const frames = 48000;
const options = { sampleRate, frequencyHz, startFrame: 0, endFrame: frames };

function signal(phase = 0, amplitude = 1) {
  return Float32Array.from(
    { length: frames },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate + phase),
  );
}

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
}

test("Hann-weighted complex fundamental recovers a known non-bin phase and amplitude change", () => {
  const reference = signal();
  const candidate = signal(0.123, 0.7);
  const result = analyzeFundamental(reference, candidate, options);
  close(result.phaseErrorRadians, 0.123);
  close(result.amplitudeRatio, 0.7);
});

test("complex fundamental phase wraps candidate-minus-reference to the principal angle", () => {
  const result = analyzeFundamental(signal(0.4), signal(0.4 + Math.PI + 0.1), options);
  close(result.phaseErrorRadians, -Math.PI + 0.1);
  close(result.amplitudeRatio, 1);
});

test("equal fundamental phase does not turn a harmonic waveform residual into PCM success", () => {
  const reference = new Float32Array(frames);
  const candidate = new Float32Array(frames);
  let maximumPcmError = 0;
  for (let index = 0; index < frames; index++) {
    const phase = (2 * Math.PI * frequencyHz * index) / sampleRate;
    reference[index] = Math.sin(phase) + 0.45 * Math.sin(3 * phase) + 0.2 * Math.sin(5 * phase);
    candidate[index] =
      Math.sin(phase) - 0.35 * Math.sin(3 * phase + 0.2) + 0.6 * Math.sin(5 * phase - 0.3);
    if (index < 32 || index >= frames - 32) candidate[index] += index % 2 ? 1 : -1;
    maximumPcmError = Math.max(maximumPcmError, Math.abs(candidate[index] - reference[index]));
  }
  const result = analyzeFundamental(reference, candidate, options);
  close(result.phaseErrorRadians, 0);
  close(result.amplitudeRatio, 1);
  assert.ok(maximumPcmError > 0.1);
  assert.ok(maximumPcmError > 2e-6, "original per-sample PCM tolerance still fails");
  assert.equal("pass" in result, false, "phase diagnostics do not decide waveform acceptance");
});

test("fundamental analysis uses exactly the declared frame window", () => {
  const reference = signal();
  const candidate = signal(0.123, 0.7);
  // A half-second interior window still contains a noninteger number of cycles.
  // Deliberately corrupt samples outside it; they must not bias its complex sum.
  candidate.fill(20, 0, 12000);
  candidate.fill(-20, 36000);
  const result = analyzeFundamental(reference, candidate, {
    ...options,
    startFrame: 12000,
    endFrame: 36000,
  });
  close(result.phaseErrorRadians, 0.123);
  close(result.amplitudeRatio, 0.7);
});

test("nonfinite sample data and mismatched PCM lengths fail explicitly", () => {
  const reference = signal();
  const candidate = signal();
  candidate[100] = NaN;
  assert.throws(() => analyzeFundamental(reference, candidate, options));
  candidate[100] = Infinity;
  assert.throws(() => analyzeFundamental(reference, candidate, options));
  assert.throws(() => analyzeFundamental(reference, new Float32Array(frames - 1), options));
});

test("zero-energy reference or candidate cannot report a fabricated phase or amplitude", () => {
  assert.throws(() => analyzeFundamental(new Float32Array(frames), signal(), options));
  assert.throws(() => analyzeFundamental(signal(), new Float32Array(frames), options));
});

test("invalid sample rates, frequencies, windows and empty PCM fail explicitly", () => {
  const reference = signal();
  const candidate = signal();
  for (const invalid of [
    { sampleRate: 0 },
    { sampleRate: NaN },
    { frequencyHz: 0 },
    { frequencyHz: sampleRate / 2 },
    { startFrame: -1 },
    { startFrame: 0.5 },
    { endFrame: frames + 1 },
    { startFrame: 100, endFrame: 100 },
    { startFrame: 0, endFrame: 2 },
  ])
    assert.throws(() => analyzeFundamental(reference, candidate, { ...options, ...invalid }));
  assert.throws(() =>
    analyzeFundamental(new Float32Array(), new Float32Array(), {
      ...options,
      endFrame: 0,
    }),
  );
});
