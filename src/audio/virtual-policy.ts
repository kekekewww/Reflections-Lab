import { AudioEngineError } from "./types.js";

export interface NativeVoicePolicyOptions {
  /** Active rendered voices, independently bounded by the original engine budget. */
  maxNativeVoices: number;
  /** Active plus retiring native route graphs. */
  maxNativeGraphs?: number;
  /** Every actual native source object, including silent virtual carriers and native tails. */
  maxNativeCarriers?: number;
  maxVirtualVoices: number;
  minResidenceSeconds: number;
  priorityHysteresis: number;
  fairnessSeconds: number;
}

export interface NativeVoiceCandidate {
  instanceId: string;
  priority: number;
  nativeSince: number | null;
  virtualSince: number | null;
}

export const DEFAULT_NATIVE_VOICE_POLICY: Readonly<NativeVoicePolicyOptions> = Object.freeze({
  maxNativeVoices: 24,
  maxNativeGraphs: 48,
  maxVirtualVoices: 32,
  minResidenceSeconds: 0.2,
  priorityHysteresis: 0.1,
  fairnessSeconds: 1,
});

function bounded(value: number, name: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new AudioEngineError(
      "INVALID_NATIVE_VOICE_POLICY",
      `${name} must be finite in [${min}, ${max}]`,
    );
  return value;
}

export function validateNativeVoicePolicy(options: NativeVoicePolicyOptions): void {
  for (const [key, minimum, maximum] of [
    ["maxNativeVoices", 1, 64],
    ["maxVirtualVoices", 0, 2048],
  ] as const) {
    bounded(options[key], key, minimum, maximum);
    if (!Number.isSafeInteger(options[key]))
      throw new AudioEngineError("INVALID_NATIVE_VOICE_POLICY", `${key} must be an integer`);
  }
  for (const [key, maximum] of [
    ["maxNativeGraphs", 128],
    ["maxNativeCarriers", 2432],
  ] as const) {
    if (options[key] !== undefined) {
      bounded(options[key], key, 1, maximum);
      if (!Number.isSafeInteger(options[key]))
        throw new AudioEngineError("INVALID_NATIVE_VOICE_POLICY", `${key} must be an integer`);
    }
  }
  bounded(options.minResidenceSeconds, "minimum residence", 0, 60);
  bounded(options.priorityHysteresis, "priority hysteresis", 0, 100);
  bounded(options.fairnessSeconds, "fairness interval", 1e-6, 3600);
}

/** Native rendering decisions only. This never changes logical sound admission or event identity. */
export function selectNativeVoices(
  candidates: readonly NativeVoiceCandidate[],
  options: NativeVoicePolicyOptions = DEFAULT_NATIVE_VOICE_POLICY,
  nowSeconds = 0,
): string[] {
  validateNativeVoicePolicy(options);
  bounded(nowSeconds, "selection time", 0, 1e9);
  // At hard maxima this includes a separate outgoing-native transition set.
  // Selection does not mistake those phase-preserving transitions for rejected events.
  if (candidates.length > 2048 + 64 * 2)
    throw new AudioEngineError(
      "NATIVE_VOICE_CANDIDATE_BUDGET",
      "Too many native/virtual candidates",
    );
  const identities = new Set<string>();
  const ranked = candidates.map((candidate) => {
    if (
      typeof candidate.instanceId !== "string" ||
      candidate.instanceId.length === 0 ||
      identities.has(candidate.instanceId)
    )
      throw new AudioEngineError(
        "INVALID_NATIVE_VOICE_CANDIDATE",
        "Candidate identities must be unique and nonempty",
      );
    identities.add(candidate.instanceId);
    bounded(candidate.priority, "candidate priority", 0, 100);
    if (candidate.nativeSince !== null) bounded(candidate.nativeSince, "native since", 0, 1e9);
    if (candidate.virtualSince !== null) bounded(candidate.virtualSince, "virtual since", 0, 1e9);
    if ((candidate.nativeSince === null) === (candidate.virtualSince === null))
      throw new AudioEngineError(
        "INVALID_NATIVE_VOICE_CANDIDATE",
        "Candidate must be native or virtual",
      );
    const native = candidate.nativeSince !== null;
    const residence = native ? Math.max(0, nowSeconds - candidate.nativeSince!) : 0;
    const waiting = native ? 0 : Math.max(0, nowSeconds - candidate.virtualSince!);
    return {
      instanceId: candidate.instanceId,
      priority: candidate.priority,
      protected: native && residence < options.minResidenceSeconds,
      score:
        candidate.priority +
        options.priorityHysteresis * (native ? 1 : waiting / options.fairnessSeconds),
    };
  });
  ranked.sort(
    (left, right) =>
      Number(right.protected) - Number(left.protected) ||
      right.score - left.score ||
      right.priority - left.priority ||
      (left.instanceId < right.instanceId ? -1 : left.instanceId > right.instanceId ? 1 : 0),
  );
  return ranked.slice(0, options.maxNativeVoices).map((candidate) => candidate.instanceId);
}
