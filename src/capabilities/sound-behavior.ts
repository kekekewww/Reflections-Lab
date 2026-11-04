import type {
  SoundBehaviorDocument,
  SoundBehaviorRule,
  SoundTrigger,
} from "../../schemas/sound-behavior/types.js";

/** Trusted host declaration, never a capability granted by a model response. */
export interface SoundBehaviorProducerCapabilities {
  bounceProducer: boolean;
  zoneProducer: boolean;
}

export interface SoundBehaviorCapabilityOptions extends Partial<SoundBehaviorProducerCapabilities> {
  zoneIds?: readonly string[];
}

export interface SoundBehaviorCapability {
  trigger: SoundTrigger["type"];
  kind: SoundTrigger["kind"];
  supported: boolean;
  reasonCode:
    | "BOUNCE_PRODUCER_UNAVAILABLE"
    | "ZONE_PRODUCER_UNAVAILABLE"
    | "ZONE_REGISTRY_EMPTY"
    | null;
  reason: string | null;
  reasonEn: string | null;
  limitations: string[];
}

/** PhysicsWorld owns bounce and derived body-center Zone occupancy producers. */
export const PRODUCT_SOUND_BEHAVIOR_PRODUCERS: Readonly<SoundBehaviorProducerCapabilities> =
  Object.freeze({ bounceProducer: true, zoneProducer: true });

const continuous = [
  "AlwaysOn",
  "WhileMoving",
  "WhileAirborne",
  "WhileRolling",
  "WhileSliding",
  "WhileSpinning",
  "WhileHeld",
] as const;
const discrete = [
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
] as const;

export class SoundCapabilityError extends Error {
  readonly code = "CAPABILITY_UNSUPPORTED";
  constructor(
    readonly trigger: string,
    readonly reasonCode: string,
    message: string,
  ) {
    super(message);
    this.name = "SoundCapabilityError";
  }
}

export function validateSoundProducerCapabilities(
  input: unknown,
): asserts input is SoundBehaviorProducerCapabilities {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !Object.prototype.hasOwnProperty.call(input, "bounceProducer") ||
    !Object.prototype.hasOwnProperty.call(input, "zoneProducer") ||
    Object.keys(input).some((key) => key !== "bounceProducer" && key !== "zoneProducer") ||
    typeof (input as SoundBehaviorProducerCapabilities).bounceProducer !== "boolean" ||
    typeof (input as SoundBehaviorProducerCapabilities).zoneProducer !== "boolean"
  )
    throw new SoundCapabilityError(
      "producerCapabilities",
      "INVALID_PRODUCER_CAPABILITIES",
      "聲音事件能力必須由可信Host提供明確的boolean producer宣告。",
    );
}

/** JSON-safe projection shared by UI, planners, previews and the validating host. */
export function getSoundBehaviorCapabilities(
  options: SoundBehaviorCapabilityOptions = {},
): SoundBehaviorCapability[] {
  return [...continuous, ...discrete].map((trigger) => {
    const capability: SoundBehaviorCapability = {
      trigger,
      kind: (continuous as readonly string[]).includes(trigger) ? "continuous" : "discrete",
      supported: true,
      reasonCode: null,
      reason: null,
      reasonEn: null,
      limitations: [],
    };
    if (trigger === "OnBounce") {
      capability.limitations = [
        "接受的撞擊後，動態物件對未移動fixed支撐面的有界分離候選；不涵蓋動態對動態或旋轉支撐面。",
        "門檻為Tuned工程分類，非材質量測；接觸點速度包含角速度。",
      ];
      if (options.bounceProducer !== true) {
        capability.supported = false;
        capability.reasonCode = "BOUNCE_PRODUCER_UNAVAILABLE";
        capability.reason = "目前Host未接上OnBounce事件產生器；請使用OnImpact。";
        capability.reasonEn = "This host has no OnBounce producer; use OnImpact.";
      }
    } else if (trigger === "OnEnterZone" || trigger === "OnExitZone") {
      capability.limitations = [
        "Derived：靜態AABB或sphere的固定步物件中心occupancy，不是collider overlap或連續swept crossing。",
        "首次穩定步、teleport或區域改動只建立基準；內縮進入與外擴離開使用hysteresis。",
        "停用只停止occupancy；明示的區域中心聲源錨點仍存在，快速outside→outside穿越不產生事件。",
      ];
      if (options.zoneProducer !== true) {
        capability.supported = false;
        capability.reasonCode = "ZONE_PRODUCER_UNAVAILABLE";
        capability.reason = "目前Host沒有已接線的區域occupancy事件產生器。";
        capability.reasonEn = "This host has no connected zone occupancy producer.";
      } else if (!options.zoneIds?.length) {
        capability.supported = false;
        capability.reasonCode = "ZONE_REGISTRY_EMPTY";
        capability.reason = "尚未註冊具有實際範圍的區域，不能產生進出事件。";
        capability.reasonEn = "No zones with actual regions have been registered.";
      }
    }
    return capability;
  });
}

export function soundTriggerCapability(
  trigger: string,
  options: SoundBehaviorCapabilityOptions = {},
): SoundBehaviorCapability | undefined {
  return getSoundBehaviorCapabilities(options).find((entry) => entry.trigger === trigger);
}

export function assertSupportedSoundTrigger(
  trigger: string,
  options: SoundBehaviorCapabilityOptions = {},
): void {
  const capability = soundTriggerCapability(trigger, options);
  if (!capability || !capability.supported)
    throw new SoundCapabilityError(
      trigger,
      capability?.reasonCode ?? "UNKNOWN_TRIGGER",
      capability?.reason ?? `Unknown sound trigger: ${trigger}`,
    );
}

/** Inert unsupported rules can be retained, but enabled rules and latch stops must have producers. */
export function assertSupportedBehaviorDocument(
  document: SoundBehaviorDocument,
  options: SoundBehaviorCapabilityOptions,
): void {
  const validateRule = (rule: SoundBehaviorRule): void => {
    assertSupportedSoundTrigger(rule.trigger.type, options);
    if (rule.trigger.type === "OnEnterZone" || rule.trigger.type === "OnExitZone") {
      if (
        rule.trigger.kind !== "discrete" ||
        !rule.trigger.zoneId ||
        !options.zoneIds?.includes(rule.trigger.zoneId)
      )
        throw new SoundCapabilityError(
          rule.trigger.type,
          "ZONE_ID_REQUIRED",
          "區域觸發必須明確選擇已註冊的區域ID。",
        );
    }
    for (const stop of rule.lifecycle?.stopOn ?? []) assertSupportedSoundTrigger(stop, options);
    if (rule.emitter.attachment === "zone") {
      assertSupportedSoundTrigger("OnEnterZone", options);
      if (!options.zoneIds?.includes(rule.emitter.zoneId))
        throw new SoundCapabilityError(
          rule.trigger.type,
          "ZONE_REGISTRY_EMPTY",
          "區域聲源需要可信Host中已註冊的實際區域。",
        );
    }
  };
  for (const profile of document.profiles)
    for (const rule of profile.rules) {
      if (!rule.enabled) continue;
      validateRule(rule);
    }
  // A binding override may enable an otherwise inert profile rule.
  for (const binding of document.bindings) {
    if (!binding.enabled) continue;
    const profile = document.profiles.find((entry) => entry.profileId === binding.profileId);
    for (const rule of profile?.rules ?? []) {
      const override = binding.overrides.find((entry) => entry.ruleId === rule.ruleId);
      if (override?.enabled === true && !rule.enabled) validateRule(rule);
    }
  }
}
