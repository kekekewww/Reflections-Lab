import { AudioEngineError } from "./types.js";

/** Private, bounded snapshots. Scalar pressure and normalized spectral shape have separate owners. */
export interface RouteResponseTarget {
  readonly shapeKey: string;
  readonly scale: number;
  readonly bandCentersHz: readonly number[];
  readonly bandGains: readonly number[];
  readonly uniform: boolean;
}

const numberBits = new DataView(new ArrayBuffer(8));
function exactNumberKey(value: number): string {
  numberBits.setFloat64(0, value, false);
  return (
    numberBits.getUint32(0, false).toString(16).padStart(8, "0") +
    numberBits.getUint32(4, false).toString(16).padStart(8, "0")
  );
}

/** No epsilon, rounded cache key, or caller-owned array is used for normalized shape identity. */
export function prepareRouteResponse(
  bandCentersHz: readonly number[],
  bandGains: readonly number[],
  sampleRate: number,
): RouteResponseTarget {
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 384000 ||
    bandCentersHz.length < 1 ||
    bandCentersHz.length > 32 ||
    bandCentersHz.length !== bandGains.length
  )
    throw new AudioEngineError("INVALID_BAND_RESPONSE", "Invalid route response dimensions");
  const frequencies = Array.from(bandCentersHz);
  const gains = Array.from(bandGains);
  for (let index = 0; index < frequencies.length; index++) {
    const frequency = frequencies[index]!,
      gain = gains[index]!;
    if (
      !Number.isFinite(frequency) ||
      frequency < 20 ||
      frequency > sampleRate / 2 ||
      (index > 0 && frequency <= frequencies[index - 1]!) ||
      !Number.isFinite(gain) ||
      gain < 0 ||
      gain > 100
    )
      throw new AudioEngineError("INVALID_BAND_RESPONSE", "Invalid route response value");
  }
  const first = gains[0]!;
  const uniform = gains.every((gain) => gain === first);
  const scale = uniform ? first : Math.max(...gains);
  // Uniform and silent responses are exact scalar gains with no FIR/group delay.
  const shapeKey = uniform
    ? "identity-v1"
    : "fir129-v1:" +
      exactNumberKey(sampleRate) +
      frequencies.map(exactNumberKey).join("") +
      ":" +
      gains.map((gain) => exactNumberKey(gain / scale)).join("");
  return { shapeKey, scale, bandCentersHz: frequencies, bandGains: gains, uniform };
}
