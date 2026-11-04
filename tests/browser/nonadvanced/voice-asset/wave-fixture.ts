/** Exact WAVE/PCM16 algorithm from tests/app/asset-residency.test.ts::wave.
 * Materialized by the Node CLI; no external audio is downloaded or substituted.
 */
export function wave(sample: number, frames: number, rate: number, channels: number): ArrayBuffer {
  const bytes = new ArrayBuffer(44 + frames * channels * 2),
    view = new DataView(bytes);
  const tag = (offset: number, value: string) =>
    [...value].forEach((v, i) => view.setUint8(offset + i, v.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  tag(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  for (let i = 0; i < frames * channels; i++)
    view.setInt16(44 + i * 2, sample + (i % channels), true);
  return bytes;
}
