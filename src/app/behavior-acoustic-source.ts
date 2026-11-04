import type {
  SoundBehaviorDocument,
  SoundInstance,
  SpatialEmitter,
} from "../../schemas/sound-behavior/types.js";
import { AcousticSolverError } from "../acoustics/index.js";
import { effectiveRule } from "../audio-behavior/profile-registry.js";
import type { AcousticSourceInput } from "./acoustic-input.js";

/** Geometry ownership is distinct from the logical owner used by voice budgets and stems. */
export function acousticEmitterMetadata(
  emitter: SpatialEmitter,
): Pick<AcousticSourceInput, "emitterObjectId"> {
  return emitter.attachment === "zone" || emitter.attachment === "fixed"
    ? { emitterObjectId: null }
    : {};
}

type Emission = Pick<
  SoundInstance,
  | "instanceId"
  | "bindingId"
  | "profileId"
  | "profileRevision"
  | "ruleId"
  | "objectId"
  | "generation"
  | "positionMetres"
>;
/** Resolve attachment from the trusted accepted document; never infer it from world position. */
export function behaviorAcousticSource(
  document: SoundBehaviorDocument,
  emission: Emission,
): AcousticSourceInput {
  const binding = document.bindings.find((value) => value.bindingId === emission.bindingId);
  const profile = document.profiles.find((value) => value.profileId === binding?.profileId);
  const rule = profile?.rules.find((value) => value.ruleId === emission.ruleId);
  if (
    !binding ||
    !profile ||
    !rule ||
    binding.objectId !== emission.objectId ||
    binding.objectGeneration !== emission.generation ||
    profile.profileId !== emission.profileId ||
    profile.revision !== emission.profileRevision ||
    binding.profileRevision !== emission.profileRevision
  )
    throw new AcousticSolverError(
      "SOURCE_RULE_IDENTITY",
      "Acoustic emission must reference the accepted binding, profile, rule and generation",
    );
  return {
    id: emission.instanceId,
    objectId: emission.objectId,
    positionM: [...emission.positionMetres],
    ...acousticEmitterMetadata(effectiveRule(binding, rule).emitter),
  };
}
