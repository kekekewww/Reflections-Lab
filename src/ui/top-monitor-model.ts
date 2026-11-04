export const LIVE_LEVEL_FLOOR_DBFS = -60;
export const LIVE_SPECTRUM_FLOOR_DBFS = -100;

export function digitalLevelRatio(dbfs: number | null): number | null {
  if (dbfs === null || Number.isNaN(dbfs) || dbfs === Infinity) return null;
  if (dbfs === -Infinity) return 0;
  return Math.max(0, Math.min(1, (dbfs - LIVE_LEVEL_FLOOR_DBFS) / -LIVE_LEVEL_FLOOR_DBFS));
}

export function displayDbfs(value: number | null): string {
  if (value === null || Number.isNaN(value) || value === Infinity) return "—";
  return value === -Infinity ? "−∞" : value.toFixed(1);
}

export function waveformWindowMs(length: number, sampleRateHz: number | null): number | null {
  return Number.isSafeInteger(length) &&
    length > 0 &&
    sampleRateHz !== null &&
    Number.isFinite(sampleRateHz) &&
    sampleRateHz > 0
    ? (length / sampleRateHz) * 1000
    : null;
}

/** Pixel buckets preserve short impulses instead of sampling one point per pixel. */
export function writeWaveformEnvelope(
  samples: Float32Array,
  minimum: Float32Array,
  maximum: Float32Array,
  columns: number,
): boolean {
  if (
    !Number.isSafeInteger(columns) ||
    columns < 1 ||
    columns > minimum.length ||
    columns > maximum.length ||
    samples.length < 1
  )
    return false;
  for (const sample of samples) if (!Number.isFinite(sample)) return false;
  for (let column = 0; column < columns; column++) {
    const first = Math.floor((column * samples.length) / columns);
    const end = Math.min(
      samples.length,
      Math.max(first + 1, Math.floor(((column + 1) * samples.length) / columns)),
    );
    let low = Infinity,
      high = -Infinity;
    for (let index = first; index < end; index++) {
      const value = samples[index]!;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    minimum[column] = low;
    maximum[column] = high;
  }
  return true;
}

export function spectrumRange(
  sampleRateHz: number | null,
  fftSize: number,
  bins: number,
): { minimumHz: number; maximumHz: number; binHz: number } | null {
  if (
    sampleRateHz === null ||
    !Number.isFinite(sampleRateHz) ||
    sampleRateHz <= 0 ||
    !Number.isSafeInteger(fftSize) ||
    fftSize < 32 ||
    fftSize > 32768 ||
    (fftSize & (fftSize - 1)) !== 0 ||
    bins !== fftSize / 2
  )
    return null;
  const binHz = sampleRateHz / fftSize;
  const minimumHz = Math.max(20, binHz),
    maximumHz = (bins - 1) * binHz;
  return maximumHz > minimumHz ? { minimumHz, maximumHz, binHz } : null;
}

/** NaN output means a log column contains no FFT bin; it is not a zero-level observation. */
export function writeLogSpectrum(
  bins: Float32Array,
  sampleRateHz: number | null,
  fftSize: number,
  output: Float32Array,
  columns: number,
): boolean {
  const range = spectrumRange(sampleRateHz, fftSize, bins.length);
  if (!range || !Number.isSafeInteger(columns) || columns < 1 || columns > output.length)
    return false;
  for (const value of bins) if (value !== -Infinity && !Number.isFinite(value)) return false;
  const ratio = range.maximumHz / range.minimumHz;
  for (let column = 0; column < columns; column++) {
    const firstHz = range.minimumHz * Math.pow(ratio, column / columns);
    const endHz = range.minimumHz * Math.pow(ratio, (column + 1) / columns);
    const first = Math.max(1, Math.ceil(firstHz / range.binHz));
    const end =
      column === columns - 1 ? bins.length : Math.min(bins.length, Math.ceil(endHz / range.binHz));
    let peak = -Infinity;
    for (let index = first; index < end; index++) peak = Math.max(peak, bins[index]!);
    output[column] = first < end ? peak : NaN;
  }
  return true;
}

/** Display-only powers-of-two scaling. It never changes the source samples or level measurements. */
export function waveformDisplayGain(samples: Float32Array): number | null {
  if (samples.length === 0) return null;
  let peak = 0;
  for (const value of samples) {
    if (!Number.isFinite(value)) return null;
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak === 0 || peak >= 0.9) return 1;
  return Math.min(1024, 2 ** Math.max(0, Math.floor(Math.log2(0.9 / peak))));
}
/** Unknown or invalid time observations are never presented as zero workload. */
export function displayMilliseconds(value: number | null): string {
  return value !== null && Number.isFinite(value) && value >= 0 ? value.toFixed(1) : "—";
}
