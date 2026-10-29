import type {
  SoundBehaviorDocument,
  SoundBehaviorProfile,
  SoundBehaviorRule,
} from "../../schemas/sound-behavior/types.js";
import { AgentError } from "../ai/types.js";
import type { ToolRequest } from "../ai/types.js";
import { canonicalJson, validateToolRequest } from "../ai/validation.js";
import { createProfileRegistry } from "../audio-behavior/profile-registry.js";
import type { BehaviorAsset } from "../audio-behavior/types.js";
import { createScene } from "../scene/index.js";
import type { SceneSource, SceneSpec } from "../scene/types.js";
import { reconcileBehaviors } from "./behavior-editor.js";
import { makeBehaviorContext } from "./defaults.js";

export interface SceneSourceSignal {
  id: string;
  frequencyHz: number;
  waveform: "sine" | "square" | "triangle" | "sawtooth";
}
type Generation = { objectId: string; generation: number };
const rulePrefix = "rule.scene-source.";
const sourceIdPattern = /^[a-z][a-z0-9._-]{0,63}$/;

export function sceneSourceRuleId(sourceId: string): string {
  if (!sourceIdPattern.test(sourceId))
    throw new AgentError("DOMAIN_INVALID", "Source ID不符合Scene契約。");
  return rulePrefix + sourceId;
}
export function sceneSourceIdFromRuleId(ruleId: string): string | null {
  if (!ruleId.startsWith(rulePrefix)) return null;
  const sourceId = ruleId.slice(rulePrefix.length);
  return sourceIdPattern.test(sourceId) ? sourceId : null;
}

function sourceRule(source: SceneSource, signal: SceneSourceSignal): SoundBehaviorRule {
  const impact = source.mode === "impact";
  return {
    ruleId: sceneSourceRuleId(source.id),
    enabled: source.playing,
    trigger: impact
      ? { kind: "discrete", type: "OnImpact" }
      : { kind: "continuous", type: "AlwaysOn" },
    conditions: [],
    generator: { kind: "oscillator", waveform: signal.waveform, frequencyHz: signal.frequencyHz },
    emitter: impact
      ? { attachment: "contact", aggregation: "impulseWeighted" }
      : { attachment: "object", offsetMetres: [0, 0, 0] },
    gainLinear: 10 ** (source.gainDbfs / 20),
    pitchSemitones: 0,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.06,
    cooldownSeconds: impact ? 0.08 : 0,
    priority: impact ? 80 : 40,
    voiceLimit: impact ? 4 : 1,
    layerGroup: `layer.scene-source.${source.id}`,
    mappings: [],
    ...(impact ? { oneShotDurationSeconds: 0.22 } : {}),
  };
}

/** Pure Scene-to-Behavior candidate. The caller owns CAS, pause/drain, Apply and full Undo snapshots. */
export function projectSceneSources(
  beforeScene: SceneSpec,
  nextScene: SceneSpec,
  beforeDocument: SoundBehaviorDocument,
  approvedRequests: readonly ToolRequest[],
  generations: readonly Generation[],
  assets: readonly BehaviorAsset[],
  signals: readonly SceneSourceSignal[],
): SoundBehaviorDocument {
  const before = createScene(beforeScene);
  const scene = createScene(nextScene);
  if (scene.sceneId !== before.sceneId || scene.sceneRevision !== before.sceneRevision + 1)
    throw new AgentError("REVISION_CONFLICT", "Source projection需要同場景的下一個revision。");
  const seen = new Set<string>();
  for (const pose of generations) {
    if (seen.has(pose.objectId) || !Number.isSafeInteger(pose.generation) || pose.generation < 1)
      throw new AgentError("DOMAIN_INVALID", "Object generations重複或無效。");
    seen.add(pose.objectId);
  }
  if (scene.objects.some((object) => !seen.has(object.id)))
    throw new AgentError("UNKNOWN_OBJECT", "Source projection缺少目前物件generation。");
  const registry = new Map<string, SceneSourceSignal>();
  for (const signal of signals) {
    if (
      registry.has(signal.id) ||
      !Number.isFinite(signal.frequencyHz) ||
      signal.frequencyHz < 20 ||
      signal.frequencyHz > 20000 ||
      !["sine", "square", "triangle", "sawtooth"].includes(signal.waveform)
    )
      throw new AgentError("DOMAIN_INVALID", "Signal registry重複或不支援此generator。");
    registry.set(signal.id, signal);
  }
  const requests = approvedRequests.map(validateToolRequest);
  for (const request of requests)
    if (
      request.sceneId !== before.sceneId ||
      request.expectedSceneRevision !== before.sceneRevision
    )
      throw new AgentError("REVISION_CONFLICT", "核准請求不屬於此Scene revision。");
  const configured = requests.filter((request) => request.tool === "ConfigureSoundSource");
  if (new Set(configured.map((request) => request.arguments.sourceId)).size !== configured.length)
    throw new AgentError("DOMAIN_INVALID", "同一Source在交易中只能設定一次。");
  const next = reconcileBehaviors(beforeDocument, scene, generations);
  const edited = new Map<
    string,
    { profile: SoundBehaviorProfile; before: string; existing: boolean }
  >();

  function legacyRule(source: SceneSource, bindingId: string): boolean {
    const binding = beforeDocument.bindings.find((entry) => entry.bindingId === bindingId);
    const profile = beforeDocument.profiles.find((entry) => entry.profileId === binding?.profileId);
    return (
      source.mode === "continuous" &&
      before.sources.find(
        (entry) => entry.objectId === source.objectId && entry.mode === "continuous",
      )?.id === source.id &&
      bindingId === `binding.continuous.${source.objectId}` &&
      binding?.profileId === "profile.continuous-tone" &&
      profile?.rules.length === 1 &&
      profile.rules[0]?.ruleId === "rule.always" &&
      profile.rules[0].trigger.type === "AlwaysOn"
    );
  }

  function editable(objectId: string) {
    const cached = edited.get(objectId);
    if (cached) return cached.profile;
    const candidates = next.bindings.filter((binding) => binding.objectId === objectId);
    if (candidates.length > 1)
      throw new AgentError("AMBIGUOUS_BINDING", "物件有多個bindings，必須先明確選擇來源對應。");
    let binding = candidates[0];
    let profile: SoundBehaviorProfile;
    let existing = Boolean(binding);
    if (binding) {
      profile = next.profiles.find((entry) => entry.profileId === binding!.profileId)!;
      if (
        next.bindings.some((entry) => entry !== binding && entry.profileId === profile.profileId)
      ) {
        const id = `profile.scene-sources.${objectId}`;
        if (next.profiles.some((entry) => entry.profileId === id))
          throw new AgentError("DOMAIN_INVALID", "Source profile ID已被其他設定使用。");
        profile = { ...structuredClone(profile), profileId: id, revision: 1 };
        next.profiles.push(profile);
        binding.profileId = id;
        binding.profileRevision = 1;
        existing = false;
      }
    } else {
      const profileId = `profile.scene-sources.${objectId}`;
      const bindingId = `binding.scene-sources.${objectId}`;
      if (
        next.profiles.some((entry) => entry.profileId === profileId) ||
        next.bindings.some((entry) => entry.bindingId === bindingId)
      )
        throw new AgentError("DOMAIN_INVALID", "Source profile／binding ID已被其他設定使用。");
      profile = {
        profileId,
        revision: 1,
        name: "場景聲源 · 程序音色",
        presetKind: "procedural",
        rules: [],
        materialPairOverrides: [],
      };
      binding = {
        bindingId,
        objectId,
        objectGeneration: generations.find((entry) => entry.objectId === objectId)!.generation,
        profileId,
        profileRevision: 1,
        enabled: true,
        overrides: [],
      };
      next.profiles.push(profile);
      next.bindings.push(binding);
    }
    const original = canonicalJson(profile);
    const legacy = before.sources.find(
      (source) => source.objectId === objectId && legacyRule(source, binding!.bindingId),
    );
    if (legacy) {
      const id = sceneSourceRuleId(legacy.id);
      if (profile.rules.some((rule) => rule.ruleId === id))
        throw new AgentError("DOMAIN_INVALID", "Legacy source rule ID已被使用。");
      profile.rules = profile.rules.map((rule) =>
        rule.ruleId === "rule.always" ? { ...rule, ruleId: id } : rule,
      );
      profile.materialPairOverrides = profile.materialPairOverrides.map((entry) =>
        entry.ruleId === "rule.always" ? { ...entry, ruleId: id } : entry,
      );
      binding.overrides = binding.overrides.map((entry) =>
        entry.ruleId === "rule.always" ? { ...entry, ruleId: id } : entry,
      );
    }
    edited.set(objectId, { profile, before: original, existing });
    return profile;
  }

  // Remove only source-owned rules for deleted sources, preserving every unrelated rule.
  for (const source of before.sources.filter(
    (entry) =>
      !scene.sources.some((value) => value.id === entry.id && value.objectId === entry.objectId),
  )) {
    if (!scene.objects.some((object) => object.id === source.objectId)) continue;
    const relevant = next.bindings.some(
      (binding) =>
        binding.objectId === source.objectId &&
        next.profiles
          .find((profile) => profile.profileId === binding.profileId)
          ?.rules.some(
            (rule) =>
              rule.ruleId === sceneSourceRuleId(source.id) ||
              (legacyRule(source, binding.bindingId) && rule.ruleId === "rule.always"),
          ),
    );
    if (!relevant) continue;
    const profile = editable(source.objectId);
    const ruleId = sceneSourceRuleId(source.id);
    const owner = next.bindings.find((entry) => entry.objectId === source.objectId)!;
    const removed = new Set([
      ruleId,
      ...(legacyRule(source, owner.bindingId) ? ["rule.always"] : []),
    ]);
    profile.rules = profile.rules.filter((rule) => !removed.has(rule.ruleId));
    profile.materialPairOverrides = profile.materialPairOverrides.filter(
      (entry) => !removed.has(entry.ruleId),
    );
    for (const binding of next.bindings.filter((entry) => entry.objectId === source.objectId))
      binding.overrides = binding.overrides.filter((entry) => !removed.has(entry.ruleId));
  }
  for (const request of configured) {
    const args = request.arguments;
    const source = scene.sources.find((entry) => entry.id === args.sourceId);
    if (
      !source ||
      source.objectId !== args.objectId ||
      source.signalId !== args.signalId ||
      source.mode !== args.mode ||
      source.gainDbfs !== args.gainDbfs
    )
      throw new AgentError("DOMAIN_INVALID", "Scene source與核准的ConfigureSoundSource不一致。");
    const signal = registry.get(source.signalId);
    if (!signal) throw new AgentError("UNKNOWN_ID", "Signal不存在於可信generator registry。");
    if (signal.frequencyHz !== args.referenceFrequencyHz)
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "Reference frequency不符合可信signal；不從分析參數猜測音色。",
      );
    const oldSource = before.sources.find((entry) => entry.id === source.id);
    if (source.playing !== (oldSource?.playing ?? false))
      throw new AgentError(
        "DOMAIN_INVALID",
        "Configure不能暗中啟用或關閉Source；新Source必須明確Enable。",
      );
    const profile = editable(source.objectId);
    const binding = next.bindings.find((entry) => entry.objectId === source.objectId)!;
    const legacy = oldSource !== undefined && legacyRule(oldSource, binding.bindingId);
    const ruleId = sceneSourceRuleId(source.id);
    const index = profile.rules.findIndex(
      (rule) => rule.ruleId === ruleId || (legacy && rule.ruleId === "rule.always"),
    );
    if (index >= 0 && !oldSource && !legacy)
      throw new AgentError("DOMAIN_INVALID", "Source rule ID已存在但沒有原始Source ownership。");
    const replaced = index >= 0 ? profile.rules[index]!.ruleId : null;
    if (index >= 0) profile.rules[index] = sourceRule(source, signal);
    else profile.rules.push(sourceRule(source, signal));
    binding.overrides = binding.overrides.filter(
      (entry) => entry.ruleId !== ruleId && entry.ruleId !== replaced,
    );
    if (replaced)
      profile.materialPairOverrides = profile.materialPairOverrides.filter(
        (entry) => entry.ruleId !== replaced,
      );
  }
  for (const { profile, before: original, existing } of edited.values()) {
    if (!profile.rules.length) {
      next.bindings = next.bindings.filter((binding) => binding.profileId !== profile.profileId);
      next.profiles = next.profiles.filter((entry) => entry !== profile);
      continue;
    }
    if (existing && canonicalJson(profile) !== original) profile.revision++;
    for (const binding of next.bindings.filter((entry) => entry.profileId === profile.profileId))
      binding.profileRevision = profile.revision;
  }
  if (canonicalJson(next) !== canonicalJson(beforeDocument))
    next.revision = beforeDocument.revision + 1;
  createProfileRegistry(next, makeBehaviorContext(scene, generations, assets));
  return next;
}
