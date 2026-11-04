/**
 * Final digital output ceiling after the master compressor. The compressor
 * (-3 dBFS threshold, ratio 20) is not a hard limit: an R18 stress case with a
 * +12 dB rule gain beside the listener at the +12 dB monitor reached +3 dBFS.
 * This curve is exactly linear up to SAFETY_KNEE and bounded below full scale
 * above it, so normal levels are unchanged. It is digital protection only, not
 * a calibrated hearing-safety limit.
 */
export const SAFETY_KNEE = 10 ** (-1 / 20);
export const SAFETY_CEILING = 10 ** (-0.2 / 20);
export const SAFETY_CURVE_SAMPLES = 4097;

/** Odd-symmetric WaveShaper curve over [-1, 1]; inputs beyond are clamped by the node. */
export function outputSafetyCurve(samples = SAFETY_CURVE_SAMPLES): Float32Array<ArrayBuffer> {
  if (!Number.isSafeInteger(samples) || samples < 3 || samples % 2 === 0)
    throw new RangeError("Safety curve needs an odd sample count of at least 3");
  const curve = new Float32Array(samples);
  const span = SAFETY_CEILING - SAFETY_KNEE;
  for (let i = 0; i < samples; i++) {
    const x = -1 + (2 * i) / (samples - 1);
    const magnitude = Math.abs(x);
    const shaped =
      magnitude <= SAFETY_KNEE
        ? magnitude
        : SAFETY_KNEE + span * Math.tanh((magnitude - SAFETY_KNEE) / span);
    curve[i] = Math.sign(x) * shaped;
  }
  return curve;
}
