import behaviorSchema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import type {
  BehaviorRuleView,
  BehaviorView,
  LabController,
  LabViewModel,
  SoundRuleOverride,
} from "./contracts.js";

export type BindingOverrideField = "enabled" | "gainLinear" | "pitchSemitones";
export interface BindingDraftEntry {
  projectKey: string;
  objectId: string;
  ruleId: string;
  expectedSceneRevision: number;
  expectedBehaviorRevision: number;
  bindingId: string;
  bindingEnabled: boolean;
  profileId: string;
  profileRevision: number;
  baselineOverride: SoundRuleOverride | null;
  baselineBaseValues: NonNullable<BehaviorRuleView["baseValues"]>;
  fields: Record<BindingOverrideField, boolean>;
  values: { enabled: boolean; gainLinear: string; pitchSemitones: string };
  pending: boolean;
  error: string;
}

export const bindingOverrideLimits = behaviorSchema.$defs.RuleOverride.properties;
const fields = ["enabled", "gainLinear", "pitchSemitones"] as const;
const sameNumber = (left: number, right: number) =>
  Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-8;

/** The read model can contain additional identity metadata; the command cannot. */
export function normalizeBindingOverride(
  value: SoundRuleOverride | null,
): SoundRuleOverride | null {
  if (value === null) return null;
  const result: SoundRuleOverride = {};
  for (const field of fields)
    if (Object.hasOwn(value, field)) Object.assign(result, { [field]: value[field] });
  return Object.keys(result).length ? result : null;
}

export function sameBindingOverride(
  left: SoundRuleOverride | null,
  right: SoundRuleOverride | null,
): boolean {
  const a = normalizeBindingOverride(left);
  const b = normalizeBindingOverride(right);
  if (a === null || b === null) return a === b;
  return fields.every((field) => {
    if (Object.hasOwn(a, field) !== Object.hasOwn(b, field)) return false;
    if (!Object.hasOwn(a, field)) return true;
    return field === "enabled" ? a.enabled === b.enabled : sameNumber(a[field]!, b[field]!);
  });
}

function baseValuesEqual(
  a: NonNullable<BehaviorRuleView["baseValues"]>,
  b: NonNullable<BehaviorRuleView["baseValues"]>,
): boolean {
  return (
    a.enabled === b.enabled &&
    sameNumber(a.gainLinear, b.gainLinear) &&
    sameNumber(a.pitchSemitones, b.pitchSemitones)
  );
}

export function bindingMetadataProblem(
  snapshot: LabViewModel,
  behavior: BehaviorView,
  rule: BehaviorRuleView,
): string | null {
  if (
    !behavior.bindingId ||
    behavior.documentRevision === undefined ||
    rule.baseValues === undefined ||
    rule.bindingOverride === undefined ||
    behavior.bindingEnabled === undefined
  )
    return "BINDING_METADATA_UNAVAILABLE：尚未提供完整的基底、覆寫與版本資料；目前無法編輯此物件覆寫。";
  if (
    behavior.objectId === "" ||
    behavior.profileId === "" ||
    !Number.isSafeInteger(behavior.documentRevision) ||
    behavior.documentRevision < 0 ||
    !Number.isSafeInteger(snapshot.sceneRevision) ||
    snapshot.sceneRevision < 0 ||
    !Number.isSafeInteger(behavior.revision) ||
    behavior.revision < 1
  )
    return "BINDING_METADATA_INVALID：物件行為版本資料無效；目前無法編輯覆寫。";
  if (
    typeof rule.baseValues.enabled !== "boolean" ||
    !Number.isFinite(rule.baseValues.gainLinear) ||
    !Number.isFinite(rule.baseValues.pitchSemitones)
  )
    return "BINDING_METADATA_INVALID：基底參數未提供有限值；目前無法編輯覆寫。";
  return null;
}

export function createBindingDraft(
  snapshot: LabViewModel,
  behavior: BehaviorView,
  rule: BehaviorRuleView,
): BindingDraftEntry {
  const problem = bindingMetadataProblem(snapshot, behavior, rule);
  if (problem) throw new Error(problem);
  const override = normalizeBindingOverride(rule.bindingOverride!);
  const base = rule.baseValues!;
  return {
    projectKey: snapshot.projectId ?? snapshot.projectName,
    objectId: behavior.objectId,
    ruleId: rule.id,
    expectedSceneRevision: snapshot.sceneRevision,
    expectedBehaviorRevision: behavior.documentRevision!,
    bindingId: behavior.bindingId!,
    bindingEnabled: behavior.bindingEnabled!,
    profileId: behavior.profileId,
    profileRevision: behavior.revision,
    baselineOverride: override === null ? null : { ...override },
    baselineBaseValues: { ...base },
    fields: {
      enabled: override !== null && Object.hasOwn(override, "enabled"),
      gainLinear: override !== null && Object.hasOwn(override, "gainLinear"),
      pitchSemitones: override !== null && Object.hasOwn(override, "pitchSemitones"),
    },
    values: {
      enabled: override?.enabled ?? base.enabled,
      gainLinear: String(override?.gainLinear ?? base.gainLinear),
      pitchSemitones: String(override?.pitchSemitones ?? base.pitchSemitones),
    },
    pending: false,
    error: "",
  };
}

export function validateBindingDraft(entry: BindingDraftEntry): {
  override: SoundRuleOverride | null;
  errors: string[];
} {
  const errors: string[] = [];
  const override: SoundRuleOverride = {};
  if (entry.fields.enabled) {
    if (typeof entry.values.enabled !== "boolean") errors.push("啟用覆寫必須是布林值。");
    else override.enabled = entry.values.enabled;
  }
  for (const field of ["gainLinear", "pitchSemitones"] as const) {
    if (!entry.fields[field]) continue;
    const raw = entry.values[field];
    const value = Number(raw);
    const limit = bindingOverrideLimits[field];
    if (!raw.trim() || !Number.isFinite(value) || value < limit.minimum || value > limit.maximum)
      errors.push(
        `${field === "gainLinear" ? "音量 linear" : "音高 semitones"} 必須介於 ${limit.minimum} 與 ${limit.maximum}，並提供有限數值。`,
      );
    else Object.assign(override, { [field]: value });
  }
  return { override: errors.length ? null : normalizeBindingOverride(override), errors };
}

function readBinding(snapshot: LabViewModel, objectId: string, ruleId: string) {
  const matches = snapshot.behaviors
    .filter((behavior) => behavior.objectId === objectId)
    .flatMap((behavior) =>
      behavior.rules.filter((rule) => rule.id === ruleId).map((rule) => ({ behavior, rule })),
    );
  return matches.length === 1 ? matches[0] : undefined;
}

export function bindingDraftConflict(
  snapshot: LabViewModel,
  entry: BindingDraftEntry,
): string | null {
  const current = readBinding(snapshot, entry.objectId, entry.ruleId);
  if (!current) return "BINDING_MISSING：原綁定或規則已移除，或無法唯一識別；覆寫草稿保留。";
  const problem = bindingMetadataProblem(snapshot, current.behavior, current.rule);
  if (problem) return problem;
  if (
    (snapshot.projectId ?? snapshot.projectName) !== entry.projectKey ||
    snapshot.sceneRevision !== entry.expectedSceneRevision ||
    current.behavior.documentRevision !== entry.expectedBehaviorRevision ||
    current.behavior.bindingId !== entry.bindingId ||
    current.behavior.bindingEnabled !== entry.bindingEnabled ||
    current.behavior.profileId !== entry.profileId ||
    current.behavior.revision !== entry.profileRevision ||
    !sameBindingOverride(current.rule.bindingOverride!, entry.baselineOverride) ||
    !baseValuesEqual(current.rule.baseValues!, entry.baselineBaseValues)
  )
    return "STALE_BINDING：場景、行為文件或原綁定已變更；覆寫草稿保留，請明示放棄後重新編輯。";
  return null;
}

/** Only the accepted object binding and the trusted receipt acknowledge this author transaction. */
export async function applyBindingDraft(
  controller: LabController,
  entry: BindingDraftEntry,
): Promise<void> {
  const pinned = structuredClone(entry);
  const desired = validateBindingDraft(pinned);
  if (desired.errors.length) throw new Error(`DRAFT_INVALID：${desired.errors.join(" ")}`);
  const conflict = bindingDraftConflict(controller.getSnapshot(), pinned);
  if (conflict) throw new Error(conflict);
  const transaction = controller.dispatch({
    type: "setBindingOverride",
    objectId: pinned.objectId,
    ruleId: pinned.ruleId,
    override: desired.override,
    expectedSceneRevision: pinned.expectedSceneRevision,
    expectedBehaviorRevision: pinned.expectedBehaviorRevision,
  });
  await transaction;
  const snapshot = controller.getSnapshot();
  if (snapshot.error) throw new Error(snapshot.error);
  const current = readBinding(snapshot, pinned.objectId, pinned.ruleId);
  const receipt = snapshot.lastBehaviorEdit;
  if (
    !current ||
    (snapshot.projectId ?? snapshot.projectName) !== pinned.projectKey ||
    current.behavior.bindingId !== pinned.bindingId ||
    current.behavior.bindingEnabled !== pinned.bindingEnabled ||
    current.behavior.profileId !== pinned.profileId ||
    current.behavior.revision !== pinned.profileRevision ||
    current.behavior.documentRevision !== pinned.expectedBehaviorRevision + 1 ||
    current.rule.baseValues === undefined ||
    current.rule.bindingOverride === undefined ||
    !baseValuesEqual(current.rule.baseValues, pinned.baselineBaseValues) ||
    !sameBindingOverride(current.rule.bindingOverride, desired.override) ||
    current.rule.enabled !==
      (pinned.bindingEnabled && (desired.override?.enabled ?? pinned.baselineBaseValues.enabled)) ||
    !sameNumber(
      current.rule.gainLinear,
      desired.override?.gainLinear ?? pinned.baselineBaseValues.gainLinear,
    ) ||
    !sameNumber(
      current.rule.pitchSemitones,
      desired.override?.pitchSemitones ?? pinned.baselineBaseValues.pitchSemitones,
    ) ||
    !receipt ||
    receipt.objectId !== pinned.objectId ||
    receipt.bindingId !== pinned.bindingId ||
    receipt.beforeDocumentRevision !== pinned.expectedBehaviorRevision ||
    receipt.afterDocumentRevision !== current.behavior.documentRevision ||
    receipt.beforeProfileId !== pinned.profileId ||
    receipt.afterProfileId !== pinned.profileId ||
    receipt.afterProfileRevision !== pinned.profileRevision
  )
    throw new Error("BINDING_ACK_MISSING：尚未收到符合覆寫草稿的綁定與文件版本；草稿保留。");
}
