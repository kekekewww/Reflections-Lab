import { createHash } from "node:crypto";

export function encodeNativePcmArtifact(samples, expectedFrames) {
  if (
    !Number.isSafeInteger(expectedFrames) ||
    expectedFrames <= 0 ||
    !Array.isArray(samples) ||
    samples.length !== expectedFrames ||
    !samples.every(Number.isFinite)
  )
    throw new Error(
      "NATIVE_PCM_FRAMES: finite PCM with the exact declared frame count is required",
    );
  const values = new Float32Array(samples);
  if (!values.every(Number.isFinite))
    throw new Error("NATIVE_PCM_NONFINITE: Float32 conversion overflow");
  const bytes = Buffer.from(values.buffer);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), frames: values.length };
}
