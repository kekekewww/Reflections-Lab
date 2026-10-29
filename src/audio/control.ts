import { AudioEngineError, type AudioBudget } from "./types.js";

export const DEFAULT_AUDIO_BUDGET: Readonly<AudioBudget> = Object.freeze({
  maxVoices: 24,
  maxSources: 32,
  maxSourceFrames: 64,
  maxPathsPerVoice: 8,
  maxTotalPaths: 96,
  maxDecodedBytes: 64 * 1024 * 1024,
  maxAssetDurationSeconds: 120,
  maxAssetChannels: 2,
  maxPendingEvents: 256,
  maxAssets: 64,
  maxConcurrentDecodes: 2,
  maxLateSends: 16,
  maxLateReverbBytes: 4 * 1024 * 1024,
});

export function finite(value: number, name: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new AudioEngineError("INVALID_AUDIO_VALUE", `${name} must be finite in [${min}, ${max}]`);
  }
  return value;
}

export function makeBudget(input: Partial<AudioBudget> = {}): AudioBudget {
  const result = { ...DEFAULT_AUDIO_BUDGET, ...input };
  const caps: AudioBudget = {
    maxVoices: 64,
    maxSources: 64,
    maxSourceFrames: 256,
    maxPathsPerVoice: 32,
    maxTotalPaths: 256,
    maxDecodedBytes: 256 * 1024 * 1024,
    maxAssetDurationSeconds: 600,
    maxAssetChannels: 8,
    maxPendingEvents: 2048,
    maxAssets: 256,
    maxConcurrentDecodes: 4,
    maxLateSends: 64,
    maxLateReverbBytes: 16 * 1024 * 1024,
  };
  for (const key of Object.keys(result) as (keyof AudioBudget)[]) {
    finite(result[key], key, 1, caps[key]);
    if (!Number.isSafeInteger(result[key]))
      throw new AudioEngineError("INVALID_BUDGET", `${key} must be integer`);
  }
  return result;
}

export function smooth(param: AudioParam, value: number, time: number, duration = 0.02): void {
  const held = param.value;
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(time);
    // Anchor explicitly: a later ramp must not interpolate back to a completed earlier ramp.
    param.setValueAtTime(held, time);
  } else {
    param.cancelScheduledValues(time);
    param.setValueAtTime(param.value, time);
  }
  if (duration === 0) param.setValueAtTime(value, time);
  else param.linearRampToValueAtTime(value, time + duration);
}

export function vector(value: readonly number[], name: string): [number, number, number] {
  if (value.length !== 3) throw new AudioEngineError("INVALID_VECTOR", name);
  return value.map((v) => finite(v, name, -1e6, 1e6)) as [number, number, number];
}

export function unit(value: readonly number[]): [number, number, number] {
  const [x, y, z] = vector(value, "direction");
  const length = Math.hypot(x, y, z);
  if (length < 1e-9) throw new AudioEngineError("INVALID_DIRECTION", "Direction cannot be zero");
  return [x / length, y / length, z / length];
}
