import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { encodeFloatWave } from "../../src/audio/render-pcm.js";
import { encodeFloatWaveChunks } from "../../src/audio/render-chunk-pcm.js";

function concatenate(chunks: Uint8Array<ArrayBuffer>[]) {
  const bytes = new Uint8Array(chunks.reduce((sum, value) => sum + value.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

test("chunked float WAV equals the independent whole-file encoder byte for byte across frame boundaries", async () => {
  const channels = [
    Float32Array.from({ length: 65539 }, (_, i) => Math.sin(i / 9) * 1.25),
    Float32Array.from({ length: 65539 }, (_, i) => (i % 2 ? -0 : i / 65539)),
  ];
  const reference = encodeFloatWave(channels, 48000);
  for (const chunkFrames of [1, 127, 128, 32768]) {
    const parts: Uint8Array<ArrayBuffer>[] = [];
    const result = await encodeFloatWaveChunks(
      channels,
      48000,
      async (bytes) => {
        parts.push(bytes);
      },
      { chunkFrames },
    );
    const encoded = concatenate(parts);
    assert.deepEqual(encoded, reference.bytes);
    assert.equal(result.sha256, createHash("sha256").update(reference.bytes).digest("hex"));
    assert.equal(result.peakLinear, reference.peakLinear);
    assert.equal(result.samplesOutsideUnitRange, reference.samplesOutsideUnitRange);
    assert.equal(result.bytes, encoded.byteLength);
    assert.ok(parts.slice(1).every((part) => part.byteLength <= chunkFrames * 8));
  }
});

test("chunk writer backpressure is awaited, cancellation/nonfinite samples stop before sealing", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  let cancelled = false;
  const rendering = encodeFloatWaveChunks(
    [new Float32Array(65536)],
    44100,
    async () => {
      calls++;
      if (calls === 1) await pending;
    },
    {
      assertActive: () => {
        if (cancelled) throw new Error("cancelled");
      },
    },
  );
  await Promise.resolve();
  assert.equal(calls, 1, "no second chunk while the writer owns the header");
  cancelled = true;
  release();
  await assert.rejects(rendering, /cancelled/);
  assert.equal(calls, 1);
  const invalid = new Float32Array(65536);
  invalid[32768] = Infinity;
  await assert.rejects(() => encodeFloatWaveChunks([invalid], 48000, async () => {}), /nonfinite/);
  await assert.rejects(
    () =>
      encodeFloatWaveChunks([new Float32Array(1)], 48000, async () => {}, { chunkFrames: 32769 }),
    /chunk/,
  );
});
