import type {
  BehaviorBinding,
  ContinuousTriggerType,
  DiscreteTriggerType,
  ParameterMapping,
  RuleOverride,
  SoundBehaviorDocument,
  SoundBehaviorProfile,
  SoundBehaviorRule,
  SoundGenerator,
  SoundTrigger,
} from "../../schemas/sound-behavior/types.js";
import {
  createProfileRegistry,
  fail,
  validateBehaviorAuthoring,
} from "../audio-behavior/profile-registry.js";
import type { BehaviorAsset } from "../audio-behavior/types.js";
import { stableHash } from "../physics/math.js";
import type { BodyPose } from "../physics/types.js";
import type { SceneSpec } from "../scene/types.js";
import type { BehaviorRuleView, LabAction } from "../ui/contracts.js";
import { makeBehaviorContext } from "./defaults.js";

type EditAction = Extract<
  LabAction,
  { type: "addRule" | "patchRule" | "removeRule" | "setPreset" | "setBindingOverride" }
>;
type Pose = Pick<BodyPose, "objectId" | "generation">;

const continuous: readonly ContinuousTriggerType[] = [
  "AlwaysOn",
  "WhileMoving",
  "WhileAirborne",
  "WhileRolling",
  "WhileSliding",
  "WhileSpinning",
  "WhileHeld",
];
const discrete: readonly DiscreteTriggerType[] = [
  "OnGrab",
  "OnRelease",
  "OnThrow",
  "OnDrop",
  "OnImpact",
  "OnBounce",
  "OnStartMoving",
  "OnStopMoving",
  "OnEnterZone",
  "OnExitZone",
  "OnSleep",
  "OnWake",
];
const contactTriggers = new Set(["OnImpact", "OnBounce", "WhileRolling", "WhileSliding"]);

function trigger(type: string): SoundTrigger {
  if (continuous.includes(type as ContinuousTriggerType))
    return { kind: "continuous", type: type as ContinuousTriggerType };
  if (discrete.includes(type as DiscreteTriggerType))
    return { kind: "discrete", type: type as DiscreteTriggerType };
  return fail("UNKNOWN_TRIGGER", `Unknown sound behavior trigger: ${type}`);
}

/** A deterministic domain ID, independent of array order and bounded for the schema. */
function unusedId(stem: string, existing: readonly string[]): string {
  const used = new Set(existing);
  if (!used.has(stem)) return stem;
  let suffix = 2;
  while (used.has(`${stem}.${suffix}`)) suffix++;
  return `${stem}.${suffix}`;
}

function newRule(ruleId: string, type: string): SoundBehaviorRule {
  const selectedTrigger = trigger(type);
  return {
    ruleId,
    enabled: true,
    trigger: selectedTrigger,
    conditions: [],
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 440 },
    emitter: contactTriggers.has(type)
      ? { attachment: "contact", aggregation: "impulseWeighted" }
      : { attachment: "object", offsetMetres: [0, 0, 0] },
    gainLinear: 10 ** (-24 / 20),
    pitchSemitones: 0,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.06,
    cooldownSeconds: selectedTrigger.kind === "discrete" ? 0.08 : 0,
    priority: type === "OnImpact" || type === "OnBounce" ? 80 : 40,
    voiceLimit: selectedTrigger.kind === "discrete" ? 4 : 1,
    layerGroup: `layer.${ruleId}`,
    mappings: [],
    ...(selectedTrigger.kind === "discrete" ? { oneShotDurationSeconds: 0.22 } : {}),
  };
}

function normalizeLifecycle(rule: SoundBehaviorRule, profile: SoundBehaviorProfile): void {
  if (rule.trigger.kind === "continuous") delete rule.lifecycle;
  const looping = rule.trigger.kind === "continuous" || Boolean(rule.lifecycle);
  const generators = [
    rule.generator,
    ...profile.materialPairOverrides
      .filter((entry) => entry.ruleId === rule.ruleId)
      .map((entry) => entry.generator),
  ];
  for (const generator of generators) if (generator.kind === "sample") generator.loop = looping;
  if (looping || !generators.some((generator) => generator.kind === "oscillator"))
    delete rule.oneShotDurationSeconds;
  else rule.oneShotDurationSeconds ??= Math.max(0.22, rule.fadeInSeconds + rule.fadeOutSeconds);
}

function mapping(kind: BehaviorRuleView["mapping"], ruleId: string): ParameterMapping[] {
  if (kind === "none") return [];
  if (kind !== "speed" && kind !== "impact")
    return fail("UNKNOWN_MAPPING", "Mapping must be none, speed or impact");
  return [
    {
      mappingId: `mapping.${stableHash(ruleId)}.${kind}`,
      input: kind === "speed" ? "sourceSpeedMetresPerSecond" : "closingSpeedMetresPerSecond",
      target: "gainLinear",
      inputMin: 0,
      inputMax: 10,
      outputMin: 0.025,
      outputMax: 0.25,
      curve: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      interpolation: "linear",
      clamp: true,
      smoothingSeconds: 0.015,
    },
  ];
}

function sampleGenerator(
  document: SoundBehaviorDocument,
  assets: readonly BehaviorAsset[],
  assetId: string,
): SoundGenerator {
  const asset = assets
    .filter((entry) => entry.assetId === assetId)
    .sort((a, b) => b.revision - a.revision)[0];
  if (!asset) return fail("UNKNOWN_ASSET", `Unknown sound asset: ${assetId}`);
  if (asset.availability !== "READY" || asset.rightsStatus !== "APPROVED")
    return fail("ASSET_NOT_READY", "Selected sample must be ready with approved rights");
  if (!Number.isFinite(asset.durationSeconds) || (asset.durationSeconds ?? 0) <= 0)
    return fail("ASSET_DURATION_REQUIRED", "Selected sample needs a decoded finite duration");
  const pin = { assetId: asset.assetId, revision: asset.revision, sha256: asset.sha256 };
  const existing = document.assets.find(
    (entry) => entry.assetId === pin.assetId && entry.revision === pin.revision,
  );
  if (existing && existing.sha256 !== pin.sha256)
    return fail("ASSET_HASH_MISMATCH", "Pinned version differs from trusted registry");
  if (!existing) document.assets.push(pin);
  return { kind: "sample", asset: pin, loop: false, startOffsetSeconds: 0 };
}

const patchKeys = new Set([
  "id",
  "trigger",
  "enabled",
  "assetId",
  "generator",
  "gainLinear",
  "pitchSemitones",
  "cooldownSeconds",
  "priority",
  "mapping",
  "mappings",
  "active",
  "status",
]);

function patchRule(
  document: SoundBehaviorDocument,
  profile: SoundBehaviorProfile,
  rule: SoundBehaviorRule,
  patch: Partial<BehaviorRuleView>,
  assets: readonly BehaviorAsset[],
): void {
  if (
    !patch ||
    typeof patch !== "object" ||
    Array.isArray(patch) ||
    Reflect.ownKeys(patch).some((key) => typeof key !== "string" || !patchKeys.has(key))
  )
    fail("INVALID_PATCH", "Only declared Inspector rule fields can be edited");
  // RuleCard submits a complete read model. Identity and telemetry are never authored data.
  if ("id" in patch && patch.id !== rule.ruleId)
    fail("RULE_ID_MISMATCH", "A rule edit cannot replace its stable identity");
  if ("active" in patch && typeof patch.active !== "boolean")
    fail("INVALID_PATCH", "Active telemetry must be boolean");
  if ("status" in patch && typeof patch.status !== "string")
    fail("INVALID_PATCH", "Status telemetry must be a string");
  let lifecycleChanged = false;
  if ("trigger" in patch && patch.trigger !== rule.trigger.type) {
    rule.trigger = trigger(patch.trigger as string);
    lifecycleChanged = true;
    rule.emitter = contactTriggers.has(rule.trigger.type)
      ? { attachment: "contact", aggregation: "impulseWeighted" }
      : { attachment: "object", offsetMetres: [0, 0, 0] };
  }
  for (const key of [
    "enabled",
    "gainLinear",
    "pitchSemitones",
    "cooldownSeconds",
    "priority",
  ] as const)
    if (key in patch) Object.assign(rule, { [key]: patch[key] });
  if ("mappings" in patch) {
    // The canonical authoring payload wins over the legacy read-model summary.
    // Registry validation below checks bounds, points, target uniqueness and trigger metrics.
    rule.mappings = structuredClone(patch.mappings as ParameterMapping[]);
  } else if ("mapping" in patch) {
    if (patch.mapping !== "none" && patch.mapping !== "speed" && patch.mapping !== "impact")
      fail("UNKNOWN_MAPPING", "Mapping must be none, speed or impact");
    const current =
      rule.mappings[0]?.input === "sourceSpeedMetresPerSecond"
        ? "speed"
        : rule.mappings.length
          ? "impact"
          : "none";
    if (current !== patch.mapping) rule.mappings = mapping(patch.mapping, rule.ruleId);
  }
  if ("generator" in patch && patch.generator !== "sample" && patch.generator !== "oscillator")
    fail("UNKNOWN_GENERATOR", "Generator must be sample or oscillator");
  if (patch.generator === "oscillator") {
    if ("assetId" in patch) fail("INVALID_PATCH", "Oscillator edits cannot select a sample");
    if (rule.generator.kind !== "oscillator") {
      rule.generator = { kind: "oscillator", waveform: "sine", frequencyHz: 440 };
      lifecycleChanged = true;
    }
  } else if ("assetId" in patch || patch.generator === "sample") {
    const assetId =
      "assetId" in patch
        ? patch.assetId
        : rule.generator.kind === "sample"
          ? rule.generator.asset.assetId
          : undefined;
    if (typeof assetId !== "string") fail("UNKNOWN_ASSET", "A sample needs a selected asset");
    if (rule.generator.kind !== "sample" || rule.generator.asset.assetId !== assetId) {
      rule.generator = sampleGenerator(document, assets, assetId);
      lifecycleChanged = true;
    }
  }
  if (lifecycleChanged) normalizeLifecycle(rule, profile);
}

function setBindingOverride(
  binding: BehaviorBinding,
  ruleId: string,
  override: Omit<RuleOverride, "ruleId"> | null,
): void {
  if (override !== null) {
    if (
      !override ||
      typeof override !== "object" ||
      Array.isArray(override) ||
      Reflect.ownKeys(override).some(
        (key) =>
          typeof key !== "string" || !["enabled", "gainLinear", "pitchSemitones"].includes(key),
      )
    )
      fail("INVALID_OVERRIDE", "Only enabled, gainLinear and pitchSemitones can be overridden");
    for (const key of Object.keys(override) as (keyof typeof override)[]) {
      const value = override[key];
      if (
        key === "enabled"
          ? typeof value !== "boolean"
          : typeof value !== "number" || !Number.isFinite(value)
      )
        fail(
          "INVALID_OVERRIDE",
          "Overrides require explicit finite numbers or a boolean enabled gate",
        );
    }
  }
  const index = binding.overrides.findIndex((entry) => entry.ruleId === ruleId);
  if (override === null || !Object.keys(override).length) {
    if (index >= 0) binding.overrides.splice(index, 1);
  } else {
    const entry = { ruleId, ...structuredClone(override) };
    if (index >= 0) binding.overrides[index] = entry;
    else binding.overrides.push(entry);
  }
}

/** Pure candidate edit. The caller owns pause/drain, revision conflicts, undo and audio activation. */
export function editBehaviors(
  document: SoundBehaviorDocument,
  scene: SceneSpec,
  poses: readonly Pose[],
  assets: readonly BehaviorAsset[],
  action: EditAction,
): SoundBehaviorDocument {
  if (
    ("expectedSceneRevision" in action && action.expectedSceneRevision !== scene.sceneRevision) ||
    ("expectedBehaviorRevision" in action && action.expectedBehaviorRevision !== document.revision)
  )
    fail("REVISION_CONFLICT", "The scene or behavior document changed while the draft was edited");
  const context = makeBehaviorContext(scene, poses, assets);
  createProfileRegistry(document, context);
  const object = context.objects.find((entry) => entry.objectId === action.objectId);
  if (!object || !poses.some((pose) => pose.objectId === action.objectId))
    fail("UNKNOWN_OBJECT", "Behavior edits require a scene object and its current physics pose");
  const next = structuredClone(document);
  const candidates = next.bindings.filter((entry) => entry.objectId === action.objectId);
  const targets =
    action.type === "patchRule" ||
    action.type === "removeRule" ||
    action.type === "setBindingOverride"
      ? candidates.filter((binding) =>
          next.profiles
            .find((entry) => entry.profileId === binding.profileId)!
            .rules.some((rule) => rule.ruleId === action.ruleId),
        )
      : candidates;
  if (targets.length > 1)
    fail("AMBIGUOUS_BINDING", "The Inspector action does not identify a unique behavior binding");
  let binding: BehaviorBinding | undefined = targets[0];
  if (
    !binding &&
    (action.type === "patchRule" ||
      action.type === "removeRule" ||
      action.type === "setBindingOverride")
  )
    fail("UNKNOWN_RULE", "Rule is not assigned to the selected object");
  if (action.type === "setBindingOverride") {
    setBindingOverride(binding!, action.ruleId, action.override);
    next.revision++;
    createProfileRegistry(next, context);
    return next;
  }
  let profile: SoundBehaviorProfile;
  if (!binding) {
    profile = {
      profileId: unusedId(
        `profile.local.${stableHash(action.objectId)}`,
        next.profiles.map((entry) => entry.profileId),
      ),
      revision: 1,
      name: "物件聲音行為 · 作者設定",
      presetKind: "creative",
      rules: [],
      materialPairOverrides: [],
    };
    binding = {
      bindingId: unusedId(
        `binding.local.${stableHash(action.objectId)}`,
        next.bindings.map((entry) => entry.bindingId),
      ),
      objectId: action.objectId,
      objectGeneration: object.generation,
      profileId: profile.profileId,
      profileRevision: profile.revision,
      enabled: true,
      overrides: [],
    };
    next.profiles.push(profile);
    next.bindings.push(binding);
  } else {
    const currentBinding = binding;
    profile = next.profiles.find((entry) => entry.profileId === currentBinding.profileId)!;
    if (next.bindings.some((entry) => entry !== binding && entry.profileId === profile.profileId)) {
      profile = structuredClone(profile);
      profile.profileId = unusedId(
        `profile.local.${stableHash(action.objectId)}`,
        next.profiles.map((entry) => entry.profileId),
      );
      next.profiles.push(profile);
      binding.profileId = profile.profileId;
    }
    const curveOnly =
      action.type === "patchRule" &&
      "mappings" in action.patch &&
      Reflect.ownKeys(action.patch).every(
        (key) =>
          typeof key === "string" &&
          ["mappings", "mapping", "id", "active", "status"].includes(key),
      );
    if (!curveOnly) {
      // Legacy scalar edits materialize this object's effective rules. A dedicated
      // canonical curve edit leaves separately authored binding overrides intact.
      // Keep the binding gate separate so a mute is never baked into every rule.
      profile.rules = profile.rules.map((rule) => ({
        ...rule,
        ...currentBinding.overrides.find((entry) => entry.ruleId === rule.ruleId),
      }));
      binding.overrides = [];
    }
    profile.revision++;
    binding.profileRevision = profile.revision;
  }
  switch (action.type) {
    case "addRule":
      profile.rules.push(
        newRule(
          unusedId(
            `rule.${action.trigger}`,
            profile.rules.map((entry) => entry.ruleId),
          ),
          action.trigger,
        ),
      );
      break;
    case "patchRule":
      patchRule(
        next,
        profile,
        profile.rules.find((entry) => entry.ruleId === action.ruleId)!,
        action.patch,
        assets,
      );
      break;
    case "removeRule":
      profile.rules = profile.rules.filter((entry) => entry.ruleId !== action.ruleId);
      profile.materialPairOverrides = profile.materialPairOverrides.filter(
        (entry) => entry.ruleId !== action.ruleId,
      );
      if (!profile.rules.length) {
        next.bindings = next.bindings.filter((entry) => entry !== binding);
        next.profiles = next.profiles.filter((entry) => entry !== profile);
      }
      break;
    case "setPreset":
      profile.presetKind = action.presetKind;
      if (!profile.rules.length) profile.rules.push(newRule("rule.AlwaysOn", "AlwaysOn"));
      break;
    default:
      fail("UNKNOWN_ACTION", "Unknown behavior editor action");
  }
  next.revision++;
  createProfileRegistry(next, context);
  return next;
}

/** Align identity only. Scene/undo callers own revision changes and the new runtime epoch. */
export function reconcileBehaviors(
  document: SoundBehaviorDocument,
  scene: SceneSpec,
  poses: readonly Pose[],
): SoundBehaviorDocument {
  // These explicit unavailable descriptors retain references without claiming bytes or rights.
  // Reconciliation never activates samples; activation must use the actual host asset registry.
  const descriptors: BehaviorAsset[] = document.assets.map((pin) => ({
    ...pin,
    availability: "MISSING",
    rightsStatus: "UNVERIFIED",
  }));
  const context = makeBehaviorContext(scene, poses, descriptors);
  const next = structuredClone(document);
  next.bindings = next.bindings.filter((binding) =>
    context.objects.some((object) => object.objectId === binding.objectId),
  );
  for (const binding of next.bindings) {
    const pose = poses.find((entry) => entry.objectId === binding.objectId);
    if (!pose) fail("MISSING_OBJECT_POSE", `Missing current pose: ${binding.objectId}`);
    binding.objectGeneration = pose.generation;
  }
  validateBehaviorAuthoring(next, context);
  return next;
}
