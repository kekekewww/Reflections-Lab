/**
 * Bounded magnitude-only renderer approximation. This is not a material solver.
 * Hann truncation smooths features narrower than roughly sampleRate / tapCount;
 * low-frequency octave bands can therefore have substantial magnitude error.
 */
export interface BandFilterKernel {
  /** Normalized FIR. Apply `scale` once in the path gain; do not normalize DC. */
  kernel: Float32Array;
  scale: number;
  groupDelaySeconds: number;
  model: "windowedFrequencySamplingApproximation";
}

const FREQUENCY_GRID_SIZE = 2048;
const MAX_LAYOUT_PLANS = 8;
const MAX_RESPONSE_LAYOUT_PREFIXES = 8;
const MAX_RESPONSE_ENTRIES = 512;
const MAX_RESPONSE_PAYLOAD_BYTES = 1024 * 1024;
// Version all fixed operators as well as the exact numeric layout/response bits.
const RESPONSE_KEY_VERSION = "frequencySampling2048-logLinear-hann-v1:";

interface TransformPlan {
  reversed: Uint16Array;
  stages: { size: number; real: Float64Array; imaginary: Float64Array }[];
}
interface LayoutPlan {
  /** 0 selects the first endpoint, 255 the last; other values are interpolation upper indices. */
  upper: Uint8Array;
  fraction: Float64Array;
  window: Float64Array;
}
interface Workspace {
  real: Float64Array;
  imaginary: Float64Array;
}
interface CachedResponse {
  kernel: Float32Array;
  payloadBytes: number;
}
interface ResponseLayoutPrefix {
  sampleRate: number;
  tapCount: number;
  /** The already-owned, validated positive finite input snapshot. */
  frequencies: readonly number[];
  prefix: string;
}
let transformPlan: TransformPlan | null = null;
const layoutPlans = new Map<string, LayoutPlan>();
const responses = new Map<string, CachedResponse>();
const responseLayoutPrefixes: ResponseLayoutPrefix[] = [];
let responsePayloadBytes = 0;
const numberBits = new DataView(new ArrayBuffer(8));
let sharedWorkspace: Workspace | null = null;
let workspaceInUse = false;

/** An injective IEEE-754 encoding, including the sign of zero; no rounded gain keys. */
function exactNumberKey(value: number): string {
  numberBits.setFloat64(0, value, false);
  return (
    numberBits.getUint32(0, false).toString(16).padStart(8, "0") +
    numberBits.getUint32(4, false).toString(16).padStart(8, "0")
  );
}

function responseLayoutPrefix(
  frequencies: readonly number[],
  sampleRate: number,
  tapCount: number,
): string {
  for (let index = responseLayoutPrefixes.length - 1; index >= 0; index--) {
    const cached = responseLayoutPrefixes[index]!;
    if (
      cached.sampleRate !== sampleRate ||
      cached.tapCount !== tapCount ||
      cached.frequencies.length !== frequencies.length
    )
      continue;
    let matches = true;
    for (let band = 0; band < frequencies.length; band++) {
      if (cached.frequencies[band] !== frequencies[band]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    if (index !== responseLayoutPrefixes.length - 1) {
      responseLayoutPrefixes.splice(index, 1);
      responseLayoutPrefixes.push(cached);
    }
    return cached.prefix;
  }
  let prefix =
    RESPONSE_KEY_VERSION +
    exactNumberKey(sampleRate) +
    exactNumberKey(tapCount) +
    exactNumberKey(frequencies.length);
  for (const frequency of frequencies) prefix += exactNumberKey(frequency);
  // At most 8 * (600 UTF-16 characters + 34 numeric values) = 11.5 KiB
  // explicit payload at 32 bands, plus bounded array/object headers and slots.
  // The frequency array is the existing private snapshot, never caller storage.
  if (responseLayoutPrefixes.length >= MAX_RESPONSE_LAYOUT_PREFIXES) responseLayoutPrefixes.shift();
  responseLayoutPrefixes.push({ sampleRate, tapCount, frequencies, prefix });
  return prefix;
}

function responseKey(
  frequencies: readonly number[],
  normalized: readonly number[],
  sampleRate: number,
  tapCount: number,
): string {
  let key = responseLayoutPrefix(frequencies, sampleRate, tapCount);
  for (const gain of normalized) key += exactNumberKey(gain);
  return key;
}

/** Never hand the private cache array to a caller-controlled typed-array constructor. */
function copyKernel(source: Float32Array): Float32Array {
  const copy = new Float32Array(source.length);
  for (let index = 0; index < source.length; index++) copy[index] = source[index] ?? 0;
  return copy;
}

function rememberResponse(key: string, kernel: Float32Array): void {
  // Complete allocation before touching accounting: constructors can throw or
  // reenter, including an invocation that inserts this same response key.
  const privateKernel = copyKernel(kernel);
  const payloadBytes = key.length * 2 + privateKernel.byteLength;
  const existing = responses.get(key);
  if (existing) {
    responses.delete(key);
    responsePayloadBytes -= existing.payloadBytes;
  }
  while (
    responses.size >= MAX_RESPONSE_ENTRIES ||
    responsePayloadBytes + payloadBytes > MAX_RESPONSE_PAYLOAD_BYTES
  ) {
    const oldestKey = responses.keys().next().value;
    if (oldestKey === undefined) return;
    const oldest = responses.get(oldestKey)!;
    responses.delete(oldestKey);
    responsePayloadBytes -= oldest.payloadBytes;
  }
  responses.set(key, { kernel: privateKernel, payloadBytes });
  responsePayloadBytes += payloadBytes;
}

/** The original bit-reversal and twiddle recurrence, evaluated once without reordering arithmetic. */
function getTransformPlan(): TransformPlan {
  if (transformPlan) return transformPlan;
  const reversedIndices = new Uint16Array(FREQUENCY_GRID_SIZE);
  let reversed = 0;
  for (let index = 1; index < FREQUENCY_GRID_SIZE; index++) {
    let bit = FREQUENCY_GRID_SIZE >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    reversedIndices[index] = reversed;
  }
  const stages: TransformPlan["stages"] = [];
  for (let size = 2; size <= FREQUENCY_GRID_SIZE; size *= 2) {
    const halfSize = size / 2;
    const angle = (2 * Math.PI) / size;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    const real = new Float64Array(halfSize);
    const imaginary = new Float64Array(halfSize);
    let twiddleReal = 1;
    let twiddleImaginary = 0;
    for (let offset = 0; offset < halfSize; offset++) {
      real[offset] = twiddleReal;
      imaginary[offset] = twiddleImaginary;
      const nextTwiddleReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
      twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
      twiddleReal = nextTwiddleReal;
    }
    stages.push({ size, real, imaginary });
  }
  transformPlan = { reversed: reversedIndices, stages };
  return transformPlan;
}

function getLayoutPlan(
  bandCentersHz: readonly number[],
  sampleRate: number,
  tapCount: number,
): LayoutPlan {
  const key = JSON.stringify([sampleRate, tapCount, bandCentersHz]);
  const cached = layoutPlans.get(key);
  if (cached) {
    layoutPlans.delete(key);
    layoutPlans.set(key, cached);
    return cached;
  }
  const halfGrid = FREQUENCY_GRID_SIZE / 2;
  const upper = new Uint8Array(halfGrid + 1);
  const fraction = new Float64Array(halfGrid + 1);
  const firstFrequency = bandCentersHz[0] ?? 20;
  const lastFrequency = bandCentersHz[bandCentersHz.length - 1] ?? sampleRate / 2;
  for (let k = 0; k <= halfGrid; k++) {
    const frequency = (k * sampleRate) / FREQUENCY_GRID_SIZE;
    if (frequency <= firstFrequency) continue;
    if (frequency >= lastFrequency) {
      upper[k] = 255;
      continue;
    }
    let index = 1;
    while (index < bandCentersHz.length - 1 && frequency > (bandCentersHz[index] ?? Infinity))
      index++;
    upper[k] = index;
    const lowFrequency = bandCentersHz[index - 1] ?? firstFrequency;
    const highFrequency = bandCentersHz[index] ?? lastFrequency;
    fraction[k] = Math.log(frequency / lowFrequency) / Math.log(highFrequency / lowFrequency);
  }
  const window = new Float64Array(tapCount);
  for (let n = 1; n < tapCount - 1; n++)
    window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (tapCount - 1));
  const plan = { upper, fraction, window };
  if (layoutPlans.size >= MAX_LAYOUT_PLANS) layoutPlans.delete(layoutPlans.keys().next().value!);
  layoutPlans.set(key, plan);
  return plan;
}

function makeWorkspace(): Workspace {
  return {
    real: new Float64Array(FREQUENCY_GRID_SIZE),
    imaginary: new Float64Array(FREQUENCY_GRID_SIZE),
  };
}

/** Same butterfly order as before; the private plan supplies the identical recurrent twiddles. */
function inverseRealSpectrum(workspace: Workspace, plan: TransformPlan): Float64Array {
  const { real, imaginary } = workspace;
  for (let index = 1; index < FREQUENCY_GRID_SIZE; index++) {
    const reversed = plan.reversed[index] ?? 0;
    if (index < reversed) {
      const temporary = real[index] ?? 0;
      real[index] = real[reversed] ?? 0;
      real[reversed] = temporary;
    }
  }
  for (const stage of plan.stages) {
    const size = stage.size;
    const halfSize = size / 2;
    for (let base = 0; base < FREQUENCY_GRID_SIZE; base += size) {
      for (let offset = 0; offset < halfSize; offset++) {
        const twiddleReal = stage.real[offset] ?? 0;
        const twiddleImaginary = stage.imaginary[offset] ?? 0;
        const even = base + offset;
        const odd = even + halfSize;
        const oddReal = real[odd] ?? 0;
        const oddImaginary = imaginary[odd] ?? 0;
        const rotatedReal = oddReal * twiddleReal - oddImaginary * twiddleImaginary;
        const rotatedImaginary = oddReal * twiddleImaginary + oddImaginary * twiddleReal;
        const evenReal = real[even] ?? 0;
        const evenImaginary = imaginary[even] ?? 0;
        real[even] = evenReal + rotatedReal;
        imaginary[even] = evenImaginary + rotatedImaginary;
        real[odd] = evenReal - rotatedReal;
        imaginary[odd] = evenImaginary - rotatedImaginary;
      }
    }
  }
  return real;
}

function validateInputs(
  bandCentersHz: readonly number[],
  bandGains: readonly number[],
  sampleRate: number,
  tapCount: number,
): void {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 384000) {
    throw new RangeError("sampleRate must be finite and within 8000..384000 Hz");
  }
  if (!Number.isSafeInteger(tapCount) || tapCount < 33 || tapCount > 257 || tapCount % 2 !== 1) {
    throw new RangeError("tapCount must be an odd safe integer within 33..257");
  }
  if (
    bandCentersHz.length < 1 ||
    bandCentersHz.length > 32 ||
    bandGains.length !== bandCentersHz.length
  ) {
    throw new RangeError("Band frequencies and gains must have the same length within 1..32");
  }
  for (let i = 0; i < bandCentersHz.length; i++) {
    const frequency = bandCentersHz[i];
    const gain = bandGains[i];
    if (
      frequency === undefined ||
      !Number.isFinite(frequency) ||
      frequency < 20 ||
      frequency > sampleRate / 2 ||
      (i > 0 && frequency <= (bandCentersHz[i - 1] ?? Infinity))
    ) {
      throw new RangeError(
        "Band frequencies must be finite, strictly increasing and within 20 Hz..Nyquist",
      );
    }
    if (gain === undefined || !Number.isFinite(gain) || gain < 0) {
      throw new RangeError("Band pressure gains must be finite and nonnegative");
    }
  }
}

/**
 * Build a causal linear-phase FIR by numerical inverse-DTFT sampling on a fixed
 * dense grid and Hann truncation. Magnitudes interpolate linearly against log
 * frequency, with the endpoint values extended to DC and Nyquist.
 *
 * Uniform gains return null: native path gain is exact and needs no FIR delay.
 * Work is bounded by 32 bands, a 2048-point radix-2 transform and 257 taps.
 * Call this from the control thread, never inside an AudioWorklet callback.
 */
export function createBandFilterKernel(
  bandCentersHz: readonly number[],
  bandGains: readonly number[],
  sampleRate: number,
  tapCount = 129,
): BandFilterKernel | null {
  const count = bandCentersHz.length;
  if (!Number.isSafeInteger(count) || count < 1 || count > 32 || bandGains.length !== count)
    throw new RangeError("Band frequencies and gains must have the same length within 1..32");
  // One bounded snapshot is shared by validation, key and arithmetic. Accessors
  // or reentrant authoring code cannot later change the response behind its key.
  const frequencies = new Array<number>(count);
  const gains = new Array<number>(count);
  for (let index = 0; index < count; index++) {
    frequencies[index] = bandCentersHz[index]!;
    gains[index] = bandGains[index]!;
  }
  validateInputs(frequencies, gains, sampleRate, tapCount);
  const firstGain = gains[0] ?? 0;
  if (gains.every((gain) => gain === firstGain)) return null;

  let scale = 0;
  for (const gain of gains) scale = Math.max(scale, gain);
  // A nonuniform nonnegative collection necessarily has a positive maximum.
  if (!(scale > 0)) throw new RangeError("Nonuniform band response has no positive scale");
  const normalized = gains.map((gain) => gain / scale);
  const key = responseKey(frequencies, normalized, sampleRate, tapCount);
  const cached = responses.get(key);
  if (cached) {
    responses.delete(key);
    responses.set(key, cached);
    return {
      kernel: copyKernel(cached.kernel),
      scale,
      groupDelaySeconds: (tapCount - 1) / 2 / sampleRate,
      model: "windowedFrequencySamplingApproximation",
    };
  }
  const layout = getLayoutPlan(frequencies, sampleRate, tapCount);
  const transform = getTransformPlan();
  // Allocate the independent retained output before borrowing scratch storage. A
  // reentrant constructor/caller cannot overwrite an outer in-progress result.
  const kernel = new Float32Array(tapCount);
  const ownsSharedWorkspace = !workspaceInUse;
  const workspace = ownsSharedWorkspace ? (sharedWorkspace ??= makeWorkspace()) : makeWorkspace();
  // At most one shared fixed-size workspace is retained. A reentrant invocation
  // uses private fixed-size storage and never exposes it through the returned IR.
  if (ownsSharedWorkspace) workspaceInUse = true;
  try {
    const halfGrid = FREQUENCY_GRID_SIZE / 2;
    for (let k = 0; k <= halfGrid; k++) {
      const upper = layout.upper[k] ?? 0;
      let magnitude: number;
      if (upper === 0) magnitude = normalized[0] ?? 0;
      else if (upper === 255) magnitude = normalized[normalized.length - 1] ?? 0;
      else {
        const low = normalized[upper - 1] ?? 0;
        const high = normalized[upper] ?? 0;
        magnitude = low + (high - low) * (layout.fraction[k] ?? 0);
      }
      workspace.real[k] = magnitude;
    }
    for (let k = 1; k < halfGrid; k++)
      workspace.real[FREQUENCY_GRID_SIZE - k] = workspace.real[k] ?? 0;
    for (let k = 0; k < FREQUENCY_GRID_SIZE; k++) workspace.imaginary[k] = 0;
    const zeroPhaseResponse = inverseRealSpectrum(workspace, transform);
    const midpoint = (tapCount - 1) / 2;
    for (let n = 1; n < tapCount - 1; n++) {
      const offset = n - midpoint;
      const value = zeroPhaseResponse[(offset + FREQUENCY_GRID_SIZE) % FREQUENCY_GRID_SIZE] ?? 0;
      kernel[n] = (value / FREQUENCY_GRID_SIZE) * (layout.window[n] ?? 0);
    }
  } finally {
    if (ownsSharedWorkspace) workspaceInUse = false;
  }
  // Only successful complete calculations enter the bounded cache. The explicit
  // byte cap counts UTF-16 key and Float32 payload; Map/object overhead is also
  // bounded by MAX_RESPONSE_ENTRIES. No engine/context objects are retained.
  rememberResponse(key, kernel);
  return {
    kernel,
    scale,
    groupDelaySeconds: (tapCount - 1) / 2 / sampleRate,
    model: "windowedFrequencySamplingApproximation",
  };
}
