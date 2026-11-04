import assert from "node:assert/strict";
import test from "node:test";
import { encodeFloatWave, hashRenderBytes } from "../../src/audio/render-pcm.js";

test("IEEE-float WAVE preserves interleaved samples, fact count, peak and out-of-range values", async () => {
  const { bytes, peakLinear, samplesOutsideUnitRange } = encodeFloatWave(
    [new Float32Array([0, 0.25, -1.25]), new Float32Array([0.5, -0.75, 1.5])],
    48000,
  );
  const view = new DataView(bytes.buffer);
  const text = (offset: number, length: number) =>
    new TextDecoder().decode(bytes.slice(offset, offset + length));
  assert.equal(text(0, 4), "RIFF");
  assert.equal(text(8, 4), "WAVE");
  assert.equal(view.getUint32(4, true), bytes.length - 8);
  assert.equal(view.getUint16(20, true), 3);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(text(36, 4), "fact");
  assert.equal(view.getUint32(44, true), 3);
  assert.equal(text(48, 4), "data");
  assert.equal(view.getUint32(52, true), 24);
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => view.getFloat32(56 + i * 4, true)),
    [0, 0.5, 0.25, -0.75, -1.25, 1.5],
  );
  assert.equal(peakLinear, 1.5);
  assert.equal(samplesOutsideUnitRange, 2);
  assert.match(await hashRenderBytes(bytes), /^[a-f0-9]{64}$/);
  assert.notEqual(await hashRenderBytes(bytes), await hashRenderBytes(bytes.slice(1)));
});

test("WAVE rejects missing channels, unequal frames, nonfinite PCM and unsupported rate", () => {
  assert.throws(() => encodeFloatWave([], 48000));
  assert.throws(() => encodeFloatWave([new Float32Array()], 48000));
  assert.throws(() => encodeFloatWave([new Float32Array(1), new Float32Array(2)], 48000));
  assert.throws(() => encodeFloatWave([new Float32Array([NaN])], 44100), /nonfinite/);
  assert.throws(() => encodeFloatWave([new Float32Array([0])], 22050 as 48000), /44.1/);
});
