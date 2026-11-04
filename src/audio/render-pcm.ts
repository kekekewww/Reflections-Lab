export class RenderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export async function hashRenderBytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** IEEE float WAVE, including a fact chunk. No normalization, dithering or clipping. */
export function encodeFloatWave(
  channels: readonly Float32Array[],
  sampleRate: 44100 | 48000,
): { bytes: Uint8Array<ArrayBuffer>; peakLinear: number; samplesOutsideUnitRange: number } {
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
  const bytes = new Uint8Array(56 + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index++)
      bytes[offset + index] = text.charCodeAt(index);
  };
  ascii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
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
  let peakLinear = 0;
  let samplesOutsideUnitRange = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels.length; channel++) {
      const sample = channels[channel]![frame]!;
      if (!Number.isFinite(sample))
        throw new RenderError("NONFINITE_PCM", "Rendered PCM contains a nonfinite sample.");
      peakLinear = Math.max(peakLinear, Math.abs(sample));
      if (Math.abs(sample) > 1) samplesOutsideUnitRange++;
      view.setFloat32(56 + (frame * channels.length + channel) * 4, sample, true);
    }
  }
  return { bytes, peakLinear, samplesOutsideUnitRange };
}
