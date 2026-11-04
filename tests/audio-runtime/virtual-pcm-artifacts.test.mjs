import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { encodeNativePcmArtifact } from "../browser/audio-virtualization/pcm-artifacts.mjs";

test("native PCM persistence requires actual finite frames and produces exact Float32 bytes", () => {
  const samples = [0, -0.5, 0.25, 1];
  const artifact = encodeNativePcmArtifact(samples, 4);
  assert.equal(artifact.bytes.length, 16);
  assert.deepEqual(
    Array.from(new Float32Array(artifact.bytes.buffer, artifact.bytes.byteOffset, 4)),
    samples,
  );
  assert.equal(artifact.sha256, createHash("sha256").update(artifact.bytes).digest("hex"));
});

test("missing, empty, truncated and nonfinite PCM cannot be published as a native artifact", () => {
  for (const samples of [undefined, [], [0], [0, NaN], [0, Infinity]])
    assert.throws(() => encodeNativePcmArtifact(samples, 2), /NATIVE_PCM/);
});
