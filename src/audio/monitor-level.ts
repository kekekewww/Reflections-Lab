/**
 * Product monitor level shared by the engine contract and its UI control.
 * Digital gain only: no device, DAC, OS volume or SPL calibration is implied.
 *
 * R18: the previous product chain stacked -14 dB master headroom and a 0.18
 * (-14.9 dB) monitor default on top of conservative authored source levels; the
 * default scene measured about -51 dBFS peak / -67 dBFS RMS at the output.
 * The limiter (-3 dBFS threshold) remains the overload protection.
 */
export const MONITOR_MIN_DB = -40;
export const MONITOR_MAX_DB = 12;
export const MAX_MONITOR_GAIN = 10 ** (MONITOR_MAX_DB / 20);
/** Unity monitor; the control can still lower 40 dB or raise 12 dB. */
export const DEFAULT_MONITOR_GAIN = 1;
/** Master headroom for the product mix: about -6 dB before monitor and limiter. */
export const PRODUCT_HEADROOM_GAIN = 0.5;

export const gainToDb = (gain: number): number =>
  gain > 0 && Number.isFinite(gain) ? 20 * Math.log10(gain) : -Infinity;
export const dbToGain = (db: number): number => 10 ** (db / 20);

/** Whole-dB control position for a linear monitor gain, clamped to the control range. */
export function monitorControlDb(gain: number): number {
  const db = gainToDb(gain);
  if (db === -Infinity) return MONITOR_MIN_DB;
  return Math.min(MONITOR_MAX_DB, Math.max(MONITOR_MIN_DB, Math.round(db)));
}

/** Linear monitor gain for a control position; rejects non-finite input. */
export function monitorGainFromControl(db: number): number {
  if (!Number.isFinite(db)) throw new RangeError("Monitor level must be a finite dB value");
  const clamped = Math.min(MONITOR_MAX_DB, Math.max(MONITOR_MIN_DB, db));
  return clamped === MONITOR_MAX_DB ? MAX_MONITOR_GAIN : dbToGain(clamped);
}
