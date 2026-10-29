import type { BehaviorDecisionView } from "./contracts.js";
import type { LocaleValue, MessageKey } from "./locale.js";

const reasons: Record<string, MessageKey> = {
  RULE_MATCH: "analysis.decision.ruleMatch",
  COOLDOWN: "analysis.decision.cooldown",
  GLOBAL_VOICE_LIMIT: "analysis.decision.globalLimit",
  OBJECT_VOICE_LIMIT: "analysis.decision.objectLimit",
  RULE_VOICE_LIMIT: "analysis.decision.ruleLimit",
  METRIC_UNAVAILABLE: "analysis.decision.metricUnavailable",
  EMITTER_UNAVAILABLE: "analysis.decision.emitterUnavailable",
  CONDITION_FALSE_OR_UNKNOWN: "analysis.decision.conditionUnknown",
  DUPLICATE_EVENT: "analysis.decision.duplicate",
  PRODUCER_REJECTED: "analysis.decision.producerRejected",
  LATCH_ALREADY_ACTIVE: "analysis.decision.latchActive",
  LATCH_RESTART: "analysis.decision.latchRestart",
  LATCH_STOP_EVENT: "analysis.decision.latchStop",
  LATCH_CONTEXT_UNAVAILABLE: "analysis.decision.latchContext",
  LATCH_UPDATE: "analysis.decision.latchUpdate",
  CONTINUOUS_UPDATE: "analysis.decision.continuousUpdate",
  OBJECT_ATTACHED_ONE_SHOT_UPDATE: "analysis.decision.oneShotUpdate",
  CONTINUOUS_GATE_CLOSED: "analysis.decision.gateClosed",
  OBJECT_OR_RULE_INVALIDATED: "analysis.decision.invalidated",
  ONE_SHOT_ENDED: "analysis.decision.ended",
  LIFETIME_EXPIRED: "analysis.decision.lifetime",
  LATCH_DEADLINE: "analysis.decision.deadline",
  RULE_DISABLED: "analysis.decision.ruleDisabled",
  BINDING_DISABLED: "analysis.decision.bindingDisabled",
};
const nativeReasons: Record<string, MessageKey> = {
  SOURCE_BUDGET: "analysis.native.sourceBudget",
  VOICE_PRIORITY_BUDGET: "analysis.native.voiceBudget",
};

/** Native admission is a separate renderer result, never a claim of device output. */
export function nativeRejectionText(reason: string | undefined, t: LocaleValue["t"]): string {
  if (reason === undefined) return t("analysis.native.missingReason");
  const key = Object.prototype.hasOwnProperty.call(nativeReasons, reason)
    ? nativeReasons[reason]
    : undefined;
  return key ? `${t(key)} [${reason}]` : t("analysis.native.otherReason", { reason });
}

/** Known explanations are localized; the exact engine reason always remains inspectable. */
export function behaviorReasonText(
  reason: string,
  t: LocaleValue["t"],
  diagnostic?: BehaviorDecisionView,
): string {
  const key =
    reason === "EMITTER_UNAVAILABLE" &&
    diagnostic?.emitterAttachment === "contact" &&
    !diagnostic.contactPositionM
      ? "analysis.decision.contactUnavailable"
      : Object.prototype.hasOwnProperty.call(reasons, reason)
        ? reasons[reason]
        : undefined;
  return key ? `${t(key)} [${reason}]` : t("analysis.decision.unknownReason", { reason });
}
