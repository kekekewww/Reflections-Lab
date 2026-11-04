import { IncrementalSha256 } from "../persistence/incremental-sha256.js";
import { RenderError } from "./render-pcm.js";

export const RENDER_PCM_CHUNK_FRAMES = 32768;
export interface ChunkWaveSummary {
  bytes: number;
  chunks: number;
  sha256: string;
  peakLinear: number;
  samplesOutsideUnitRange: number;
}

/** Bounded encoder only: its channel views still refer to a whole native AudioBuffer. */
export async function encodeFloatWaveChunks(
  channels: readonly Float32Array[],
  sampleRate: 44100 | 48000,
  write: (bytes: Uint8Array<ArrayBuffer>, index: number) => Promise<void>,
  options: { chunkFrames?: number; assertActive?: () => void } = {},
): Promise<ChunkWaveSummary> {
  const chunkFrames = options.chunkFrames ?? RENDER_PCM_CHUNK_FRAMES;
  if (
    !Number.isSafeInteger(chunkFrames) ||
    chunkFrames < 1 ||
    chunkFrames > RENDER_PCM_CHUNK_FRAMES
  )
    throw new RenderError("WAVE_CHUNK_SIZE", "WAVE chunk frames must be between 1 and 32768.");
  if (![44100, 48000].includes(sampleRate) || channels.length < 1 || channels.length > 2)
    throw new RenderError(
      "WAVE_LAYOUT",
      "Render WAVE requires one or two channels at 44.1/48 kHz.",
    );
  const frames = channels[0]!.length;
  if (!frames || channels.some((channel) => channel.length !== frames))
    throw new RenderError(
      "WAVE_LENGTH",
      "Render channels must have the same positive frame count.",
    );
  const dataBytes = frames * channels.length * 4;
  if (!Number.isSafeInteger(dataBytes) || dataBytes > 0xffffffff - 48)
    throw new RenderError("WAVE_SIZE", "The float WAVE exceeds the RIFF size limit.");
  const header = new Uint8Array(56);
  const view = new DataView(header.buffer);
  const ascii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index++)
      header[offset + index] = value.charCodeAt(index);
  };
  ascii(0, "RIFF");
  view.setUint32(4, dataBytes + 48, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 4, true);
  view.setUint16(32, channels.length * 4, true);
  view.setUint16(34, 32, true);
  ascii(36, "fact");
  view.setUint32(40, 4, true);
  view.setUint32(44, frames, true);
  ascii(48, "data");
  view.setUint32(52, dataBytes, true);
  const hash = new IncrementalSha256();
  let chunks = 0,
    peakLinear = 0,
    samplesOutsideUnitRange = 0;
  const append = async (bytes: Uint8Array<ArrayBuffer>): Promise<void> => {
    options.assertActive?.();
    hash.update(bytes);
    await write(bytes, chunks++);
    options.assertActive?.();
  };
  await append(header);
  for (let start = 0; start < frames; start += chunkFrames) {
    options.assertActive?.();
    const count = Math.min(chunkFrames, frames - start);
    const bytes = new Uint8Array(count * channels.length * 4);
    const pcm = new DataView(bytes.buffer);
    for (let frame = 0; frame < count; frame++) {
      for (let channel = 0; channel < channels.length; channel++) {
        const sample = channels[channel]![start + frame]!;
        if (!Number.isFinite(sample))
          throw new RenderError("NONFINITE_PCM", "Rendered PCM contains a nonfinite sample.");
        const magnitude = Math.abs(sample);
        peakLinear = Math.max(peakLinear, magnitude);
        if (magnitude > 1) samplesOutsideUnitRange++;
        pcm.setFloat32((frame * channels.length + channel) * 4, sample, true);
      }
    }
    await append(bytes);
  }
  return {
    bytes: 56 + dataBytes,
    chunks,
    sha256: hash.digestHex(),
    peakLinear,
    samplesOutsideUnitRange,
  };
}
