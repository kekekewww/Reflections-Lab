/** Authored synthetic validation data only. This module never reads project files or credentials. */
export const META_LIVE_SOUND_PROMPT =
  "Use exactly one ProposeSoundBehavior function call with TWO ordered operations: first RemoveBinding(bindingId=binding.interactive.ball), then AssignBinding. The new binding must be bindingId binding.interactive.ball, objectId ball, objectGeneration 1, profileId profile.interactive-tone, profileRevision 1, enabled true. Its overrides must contain one item: ruleId rule.impact, pitchSemitones 2, enabled null, gainLinear null. Keep every profile and asset unchanged. This is a creative synthetic setting, not a measured result. Do not explain, do not omit RemoveBinding, and call no other tools.";
export const META_LIVE_SCENE_PROMPT =
  "Use exactly one AddObject tool call to create one synthetic sphere. Arguments: objectId object.meta-proof; label Meta proof sphere; shape sphere; dimensionsM [0.4,0.4,0.4]; positionM [2,2,0]; orientationQuaternion [0,0,0,1]; materialId material.metal; mode dynamicNoGravity; massKg 1. No sound source, no other changes, no explanation.";
export const metaLiveRunPrompt = (seed: number): string =>
  `Use exactly one RunSimulation tool call. backendId custom-web; durationS 3; timeStepS ${1 / 60}; seed ${seed}; replayTraceId null; maxReflectionOrder 1; sampleRateHz 48000. Execute no scene mutations and give no invented metric or explanation.`;
export const META_LIVE_SIGNALS = [
  {
    id: "signal.tone-220",
    label: "220 Hz synthetic sine",
    frequencyHz: 220,
    waveform: "sine" as const,
  },
];
export const META_LIVE_ADD_OBJECT = {
  objectId: "object.meta-proof",
  label: "Meta proof sphere",
  shape: "sphere",
  dimensionsM: [0.4, 0.4, 0.4],
  positionM: [2, 2, 0],
  orientationQuaternion: [0, 0, 0, 1],
  materialId: "material.metal",
  mode: "dynamicNoGravity",
  massKg: 1,
};
