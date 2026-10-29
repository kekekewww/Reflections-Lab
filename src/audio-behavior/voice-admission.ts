import type { SoundInstance } from "../../schemas/sound-behavior/types.js";
import { compareIds } from "./profile-registry.js";

export interface VoiceCandidateIdentity {
  objectId: string;
  bindingId: string;
  ruleId: string;
  priority: number;
  voiceLimit: number;
  inputSequence: number;
  inputEventId: string;
}

/** Burst policy: high priority first, stable identities break ties; active tails count. */
export function compareVoiceCandidates(
  a: VoiceCandidateIdentity,
  b: VoiceCandidateIdentity,
): number {
  return (
    b.priority - a.priority ||
    compareIds(a.bindingId, b.bindingId) ||
    compareIds(a.ruleId, b.ruleId) ||
    a.inputSequence - b.inputSequence ||
    compareIds(a.inputEventId, b.inputEventId)
  );
}

/** Existing voices are never abruptly stolen; reject is explicit and deterministic. */
export function voiceAdmission(
  candidate: VoiceCandidateIdentity,
  instances: SoundInstance[],
  maxVoices: number,
  maxPerObject: number,
): string | null {
  const active = instances.filter((instance) => instance.playbackState !== "stopped");
  if (active.length >= maxVoices) return "GLOBAL_VOICE_LIMIT";
  if (active.filter((instance) => instance.objectId === candidate.objectId).length >= maxPerObject)
    return "OBJECT_VOICE_LIMIT";
  if (
    active.filter(
      (instance) =>
        instance.bindingId === candidate.bindingId && instance.ruleId === candidate.ruleId,
    ).length >= candidate.voiceLimit
  )
    return "RULE_VOICE_LIMIT";
  return null;
}
