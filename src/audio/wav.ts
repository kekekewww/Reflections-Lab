import { AudioEngineError, type AudioBudget } from "./types.js";

export interface WavePreflight {
  frames: number;
  channels: number;
  sampleRate: number;
  decodedBytes: number;
  durationSeconds: number;
  format: "PCM" | "float";
  bitsPerSample: number;
}
/** V1 intentionally accepts bounded, uncompressed RIFF/WAVE only, before native decoding. */
export function preflightWave(
  bytes: ArrayBuffer,
  budget: AudioBudget,
  decodeSampleRate?: number,
): WavePreflight {
  const view = new DataView(bytes);
  const fail = (code: string, message: string): never => {
    throw new AudioEngineError(code, message);
  };
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(bytes, offset, 4));
  if (bytes.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE")
    fail(
      "WAV_CAPABILITY_UNSUPPORTED",
      "V1 import supports uncompressed RIFF/WAVE PCM or float32 only",
    );
  if (view.getUint32(4, true) + 8 !== bytes.byteLength)
    fail("INVALID_WAV", "RIFF byte length does not match the supplied file");
  let formatOffset = -1,
    formatLength = 0,
    dataOffset = -1,
    dataLength = 0,
    offset = 12,
    chunks = 0;
  while (offset < bytes.byteLength) {
    if (++chunks > 128 || offset + 8 > bytes.byteLength)
      fail("INVALID_WAV", "Invalid or excessive RIFF chunks");
    const name = tag(offset),
      length = view.getUint32(offset + 4, true),
      start = offset + 8;
    if (start + length + (length % 2) > bytes.byteLength)
      fail("INVALID_WAV", "Truncated RIFF chunk");
    if (name === "fmt ") {
      if (formatOffset !== -1) fail("INVALID_WAV", "Exactly one fmt chunk is supported");
      formatOffset = start;
      formatLength = length;
    } else if (name === "data") {
      if (dataOffset !== -1) fail("INVALID_WAV", "Exactly one data chunk is supported");
      dataOffset = start;
      dataLength = length;
    }
    offset = start + length + (length % 2);
  }
  if (formatOffset < 0 || dataOffset < 0 || dataLength === 0)
    fail("INVALID_WAV", "One nonempty data chunk and one fmt chunk are required");
  if (formatLength !== 16 && (formatLength !== 18 || view.getUint16(formatOffset + 16, true) !== 0))
    fail("WAV_CAPABILITY_UNSUPPORTED", "Extended or compressed WAVE formats are unavailable in V1");
  const code = view.getUint16(formatOffset, true),
    channels = view.getUint16(formatOffset + 2, true),
    sampleRate = view.getUint32(formatOffset + 4, true);
  const byteRate = view.getUint32(formatOffset + 8, true),
    align = view.getUint16(formatOffset + 12, true),
    bitsPerSample = view.getUint16(formatOffset + 14, true);
  if (
    (code !== 1 && code !== 3) ||
    (code === 1 && ![8, 16, 24, 32].includes(bitsPerSample)) ||
    (code === 3 && bitsPerSample !== 32)
  )
    fail(
      "WAV_CAPABILITY_UNSUPPORTED",
      "Supported WAVE encodings are PCM8/16/24/32 and normalized float32",
    );
  if (channels < 1 || channels > budget.maxAssetChannels)
    fail("WAV_CHANNEL_BUDGET", "WAVE channel count exceeds the configured budget");
  if (sampleRate < 8000 || sampleRate > 192000)
    fail("WAV_RATE_UNSUPPORTED", "WAVE sample rate must be 8000..192000Hz");
  if (
    align !== channels * (bitsPerSample / 8) ||
    byteRate !== sampleRate * align ||
    dataLength % align !== 0
  )
    fail("INVALID_WAV", "WAVE block alignment, byte rate or frame count is inconsistent");
  const frames = dataLength / align,
    durationSeconds = frames / sampleRate;
  if (!Number.isSafeInteger(frames) || frames < 1)
    fail("INVALID_WAV", "WAVE must contain complete sample frames");
  if (durationSeconds > budget.maxAssetDurationSeconds)
    fail("WAV_DURATION_BUDGET", "WAVE duration exceeds the configured budget");
  const outputRate = decodeSampleRate ?? sampleRate;
  if (!Number.isFinite(outputRate) || outputRate < 8000 || outputRate > 192000)
    fail("WAV_RATE_UNSUPPORTED", "Invalid native decode sample rate");
  // decodeAudioData resamples to the context rate; reserve the rounded-up output plus one sample.
  const decodedBytes = (Math.ceil((frames * outputRate) / sampleRate) + 1) * channels * 4;
  if (decodedBytes > budget.maxDecodedBytes)
    fail("DECODED_MEMORY_BUDGET", "Predicted decoded WAVE exceeds the PCM budget");
  if (code === 3)
    for (let position = dataOffset; position < dataOffset + dataLength; position += 4) {
      const sample = view.getFloat32(position, true);
      if (!Number.isFinite(sample) || Math.abs(sample) > 1)
        fail(
          "WAV_SAMPLE_OUT_OF_RANGE",
          "Float32 WAVE samples must be finite normalized values in [-1,1]",
        );
    }
  return {
    frames,
    channels,
    sampleRate,
    decodedBytes,
    durationSeconds,
    format: code === 1 ? "PCM" : "float",
    bitsPerSample,
  };
}
