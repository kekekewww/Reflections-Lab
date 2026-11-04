import type { editorMessages } from "./locales/editor.js";
import {
  getSoundBehaviorCapabilities,
  PRODUCT_SOUND_BEHAVIOR_PRODUCERS,
} from "../capabilities/sound-behavior.js";

export const triggerOptions = [
  ["AlwaysOn", "持續發聲"],
  ["WhileMoving", "移動期間"],
  ["WhileAirborne", "飛行期間"],
  ["WhileRolling", "滾動期間"],
  ["WhileSliding", "滑動期間"],
  ["WhileSpinning", "旋轉期間"],
  ["WhileHeld", "持有期間"],
  ["OnGrab", "抓取時"],
  ["OnRelease", "放手時"],
  ["OnThrow", "投擲時"],
  ["OnDrop", "放下時"],
  ["OnImpact", "撞擊時"],
  ["OnBounce", "彈跳時"],
  ["OnStartMoving", "開始移動"],
  ["OnStopMoving", "停止移動"],
  ["OnEnterZone", "進入區域"],
  ["OnExitZone", "離開區域"],
  ["OnSleep", "休眠時"],
  ["OnWake", "喚醒時"],
] as const;

/** The UI reads the same trusted producer declaration as authoring and AI hosts. */
export const unsupportedTriggerReasons: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    getSoundBehaviorCapabilities(PRODUCT_SOUND_BEHAVIOR_PRODUCERS)
      .filter((capability) => !capability.supported)
      .map((capability) => [capability.trigger, capability.reason ?? "Unsupported trigger"]),
  ),
);

type EditorMessageKey = keyof typeof editorMessages;
type TranslateEditor = (key: EditorMessageKey) => string;

export const triggerLabelKeys: Readonly<Record<string, EditorMessageKey>> = {
  AlwaysOn: "editor.trigger.AlwaysOn",
  WhileMoving: "editor.trigger.WhileMoving",
  WhileAirborne: "editor.trigger.WhileAirborne",
  WhileRolling: "editor.trigger.WhileRolling",
  WhileSliding: "editor.trigger.WhileSliding",
  WhileSpinning: "editor.trigger.WhileSpinning",
  WhileHeld: "editor.trigger.WhileHeld",
  OnGrab: "editor.trigger.OnGrab",
  OnRelease: "editor.trigger.OnRelease",
  OnThrow: "editor.trigger.OnThrow",
  OnDrop: "editor.trigger.OnDrop",
  OnImpact: "editor.trigger.OnImpact",
  OnBounce: "editor.trigger.OnBounce",
  OnStartMoving: "editor.trigger.OnStartMoving",
  OnStopMoving: "editor.trigger.OnStopMoving",
  OnEnterZone: "editor.trigger.OnEnterZone",
  OnExitZone: "editor.trigger.OnExitZone",
  OnSleep: "editor.trigger.OnSleep",
  OnWake: "editor.trigger.OnWake",
};

export const unsupportedTriggerReasonKeys: Readonly<Record<string, EditorMessageKey>> = {
  OnEnterZone: "editor.trigger.unsupported.OnEnterZone",
  OnExitZone: "editor.trigger.unsupported.OnExitZone",
};

export const triggerName = (id: string, t?: TranslateEditor) =>
  t && triggerLabelKeys[id]
    ? t(triggerLabelKeys[id])
    : (triggerOptions.find((option) => option[0] === id)?.[1] ?? id);

export const isZoneTrigger = (id: string): boolean => id === "OnEnterZone" || id === "OnExitZone";

export const unsupportedTriggerReason = (
  id: string,
  t?: TranslateEditor,
  zones?: readonly { id: string }[],
): string | undefined => {
  const capability = getSoundBehaviorCapabilities({
    ...PRODUCT_SOUND_BEHAVIOR_PRODUCERS,
    ...(zones !== undefined ? { zoneIds: zones.map((zone) => zone.id) } : {}),
  }).find((entry) => entry.trigger === id);
  if (capability?.supported) return undefined;
  if (capability?.reasonCode === "ZONE_REGISTRY_EMPTY")
    return t ? t("editor.zone.none") : (capability.reason ?? undefined);
  return t && unsupportedTriggerReasonKeys[id]
    ? t(unsupportedTriggerReasonKeys[id])
    : (capability?.reason ?? unsupportedTriggerReasons[id]);
};
