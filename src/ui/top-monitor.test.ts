import assert from "node:assert/strict";
import test from "node:test";
import {
  digitalLevelRatio,
  displayDbfs,
  displayMilliseconds,
  spectrumRange,
  waveformWindowMs,
  waveformDisplayGain,
  writeLogSpectrum,
  writeWaveformEnvelope,
} from "./top-monitor-model.js";

test("digital silence differs from unavailable and invalid level observations", () => {
  assert.equal(digitalLevelRatio(-Infinity), 0);
  assert.equal(displayDbfs(-Infinity), "−∞");
  for (const value of [null, NaN, Infinity]) {
    assert.equal(digitalLevelRatio(value), null);
    assert.equal(displayDbfs(value), "—");
  }
  assert.equal(digitalLevelRatio(-60), 0);
  assert.equal(digitalLevelRatio(-30), 0.5);
  assert.equal(digitalLevelRatio(0), 1);
  assert.equal(digitalLevelRatio(12), 1);
  assert.equal(displayDbfs(12), "12.0");
});

test("waveform window uses actual sample rate, not a fixed device assumption", () => {
  assert.equal(waveformWindowMs(2048, 48000), 2048 / 48);
  assert.equal(waveformWindowMs(2048, 44100), 2048 / 44.1);
  for (const rate of [null, 0, NaN, Infinity, -1]) assert.equal(waveformWindowMs(2048, rate), null);
  assert.equal(waveformWindowMs(0, 48000), null);
});

test("pixel envelope preserves an off-grid one-sample transient and polarity", () => {
  const samples = new Float32Array(1024),
    low = new Float32Array(32),
    high = new Float32Array(32);
  samples[437] = 0.875;
  samples[438] = -0.625;
  assert.equal(writeWaveformEnvelope(samples, low, high, 32), true);
  assert.equal(high[13], 0.875);
  assert.equal(low[13], -0.625);
  assert.equal(Math.max(...high), 0.875);
  assert.equal(Math.min(...low), -0.625);
});

test("waveform envelope keeps over-range values instead of secretly normalizing them", () => {
  const low = new Float32Array(2),
    high = new Float32Array(2);
  assert.equal(writeWaveformEnvelope(new Float32Array([2, -3]), low, high, 2), true);
  assert.deepEqual([...low], [2, -3]);
  assert.deepEqual([...high], [2, -3]);
});

test("invalid waveform data cannot partially overwrite the previous owned projection", () => {
  const low = new Float32Array([7, 7]),
    high = new Float32Array([8, 8]);
  assert.equal(writeWaveformEnvelope(new Float32Array([1, NaN]), low, high, 2), false);
  assert.deepEqual([...low], [7, 7]);
  assert.deepEqual([...high], [8, 8]);
  assert.equal(writeWaveformEnvelope(new Float32Array([1]), low, high, 3), false);
  assert.equal(writeWaveformEnvelope(new Float32Array(), low, high, 2), false);
});

test("FFT frequency geometry has native resolution and rejects incomplete buffers", () => {
  assert.deepEqual(spectrumRange(48000, 2048, 1024), {
    minimumHz: 23.4375,
    maximumHz: 23976.5625,
    binHz: 23.4375,
  });
  assert.equal(spectrumRange(48000, 2048, 512), null);
  assert.equal(spectrumRange(null, 2048, 1024), null);
  assert.equal(spectrumRange(48000, 2000, 1000), null);
  assert.equal(spectrumRange(48000, 65536, 32768), null);
});

test("log FFT aggregation preserves narrow peaks without inventing missing-bin zeros", () => {
  const bins = new Float32Array(1024);
  bins.fill(-Infinity);
  bins[15] = -12;
  bins[240] = -24;
  const output = new Float32Array(512);
  assert.equal(writeLogSpectrum(bins, 48000, 2048, output, 512), true);
  const observed = [...output].filter((value) => Number.isFinite(value));
  assert.deepEqual(
    observed.slice().sort((a, b) => b - a),
    [-12, -24],
  );
  assert.ok(
    [...output].some(Number.isNaN),
    "log intervals without a native FFT bin remain unmeasured gaps",
  );
  assert.ok(
    [...output].some((value) => value === -Infinity),
    "measured silent FFT bins remain digital silence",
  );
});

test("DC is excluded from a positive-frequency logarithmic spectrum", () => {
  const bins = new Float32Array(1024);
  bins.fill(-Infinity);
  bins[0] = 0;
  const output = new Float32Array(100);
  assert.equal(writeLogSpectrum(bins, 48000, 2048, output, 100), true);
  assert.equal([...output].some(Number.isFinite), false);
});

test("malformed FFT values and dimensions do not replace previous plotted data", () => {
  const bins = new Float32Array(1024);
  bins.fill(-80);
  bins[20] = Infinity;
  const output = new Float32Array(8);
  output.fill(3);
  assert.equal(writeLogSpectrum(bins, 48000, 2048, output, 8), false);
  assert.deepEqual([...output], Array(8).fill(3));
  assert.equal(writeLogSpectrum(new Float32Array(512), 48000, 2048, output, 8), false);
});

test("waveform display scaling stays explicit and preserves raw quiet and over-range samples", () => {
  const quiet = new Float32Array([0.03125, -0.03125]);
  assert.equal(waveformDisplayGain(quiet), 16);
  assert.deepEqual([...quiet], [0.03125, -0.03125]);
  assert.equal(waveformDisplayGain(new Float32Array([0, 0])), 1);
  assert.equal(waveformDisplayGain(new Float32Array([2, -3])), 1);
  assert.equal(waveformDisplayGain(new Float32Array([1e-8])), 1024);
  assert.equal(waveformDisplayGain(new Float32Array([NaN])), null);
});
test("invalid timing observations differ from a measured zero duration", () => {
  for (const value of [null, NaN, Infinity, -Infinity, -1])
    assert.equal(displayMilliseconds(value), "—");
  assert.equal(displayMilliseconds(0), "0.0");
  assert.equal(displayMilliseconds(12.34), "12.3");
});
