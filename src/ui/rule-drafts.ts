import type {
  BehaviorRuleView,
  LabController,
  LabViewModel,
  SoundParameterMapping,
} from "./contracts.js";

export interface RuleDraftEntry {
  value: BehaviorRuleView;
  profileId?: string;
  bindingId?: string;
  expectedSceneRevision?: number;
  expectedBehaviorRevision?: number;
  mappingError?: string;
  changedFields?: (
    | "trigger"
    | "enabled"
    | "generator"
    | "assetId"
    | "gainLinear"
    | "pitchSemitones"
    | "cooldownSeconds"
    | "mappings"
  )[];
  baseRevision: number;
  pending: boolean;
  error: string;
  inputValues?: Partial<Record<"gainLinear" | "pitchSemitones" | "cooldownSeconds", string>>;
}
export type RuleDrafts = Record<string, RuleDraftEntry>;

export function ruleDraftKey(objectId: string, ruleId: string): string {
  return JSON.stringify([objectId, ruleId]);
}

/** Identity, priority and runtime telemetry are never submitted as authored fields. */
export function editableRulePatch(rule: BehaviorRuleView): Partial<BehaviorRuleView> {
  return {
    trigger: rule.trigger,
    enabled: rule.enabled,
    ...(rule.generator !== undefined ? { generator: rule.generator } : {}),
    ...(rule.generator !== "oscillator" && rule.assetId !== undefined
      ? { assetId: rule.assetId }
      : {}),
    gainLinear: rule.gainLinear,
    pitchSemitones: rule.pitchSemitones,
    cooldownSeconds: rule.cooldownSeconds,
    ...(rule.mappings !== undefined
      ? { mappings: structuredClone(rule.mappings) }
      : { mapping: rule.mapping ?? "none" }),
  };
}

function sameNumber(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-8;
}

function sameMapping(a: SoundParameterMapping, b: SoundParameterMapping): boolean {
  return (
    a.mappingId === b.mappingId &&
    a.input === b.input &&
    a.target === b.target &&
    a.interpolation === b.interpolation &&
    a.clamp === b.clamp &&
    (["inputMin", "inputMax", "outputMin", "outputMax", "smoothingSeconds"] as const).every(
      (field) => sameNumber(a[field], b[field]),
    ) &&
    a.curve.length === b.curve.length &&
    a.curve.every((point, index) => {
      const other = b.curve[index];
      return !!other && sameNumber(point.x, other.x) && sameNumber(point.y, other.y);
    })
  );
}

function sameMappings(a: BehaviorRuleView, b: BehaviorRuleView): boolean {
  if (a.mappings === undefined && b.mappings === undefined)
    return (a.mapping ?? "none") === (b.mapping ?? "none");
  // A legacy summary cannot prove the ranges or curve of a nonempty mapping.
  const left = a.mappings ?? ((a.mapping ?? "none") === "none" ? [] : null);
  const right = b.mappings ?? ((b.mapping ?? "none") === "none" ? [] : null);
  return (
    left !== null &&
    right !== null &&
    left.length === right.length &&
    left.every((mapping, index) => {
      const other = right[index];
      return !!other && sameMapping(mapping, other);
    })
  );
}

export function sameEditableRule(a: BehaviorRuleView, b: BehaviorRuleView): boolean {
  return (
    a.trigger === b.trigger &&
    a.enabled === b.enabled &&
    a.generator === b.generator &&
    (a.generator === "oscillator" || a.assetId === b.assetId) &&
    sameNumber(a.gainLinear, b.gainLinear) &&
    sameNumber(a.pitchSemitones, b.pitchSemitones) &&
    sameNumber(a.cooldownSeconds, b.cooldownSeconds) &&
    sameMappings(a, b)
  );
}

interface RuleReadState {
  profileId: string;
  bindingId: string | undefined;
  documentRevision: number | undefined;
  revision: number;
  rule: BehaviorRuleView;
}

function currentRule(
  snapshot: LabViewModel,
  objectId: string,
  ruleId: string,
): RuleReadState | undefined {
  const matches = snapshot.behaviors
    .filter((profile) => profile.objectId === objectId)
    .flatMap((profile) =>
      profile.rules
        .filter((rule) => rule.id === ruleId)
        .map((rule) => ({
          profileId: profile.profileId,
          bindingId: profile.bindingId,
          documentRevision: profile.documentRevision,
          revision: profile.revision,
          rule,
        })),
    );
  return matches.length === 1 ? matches[0] : undefined;
}

function documentAdvanced(before: RuleReadState, after: RuleReadState): boolean {
  if (before.documentRevision === undefined && after.documentRevision === undefined) return true;
  return (
    before.documentRevision !== undefined &&
    after.documentRevision !== undefined &&
    after.documentRevision > before.documentRevision
  );
}

function receiptAcknowledgesFork(
  snapshot: LabViewModel,
  objectId: string,
  bindingId: string | undefined,
  before: RuleReadState,
  after: RuleReadState,
): boolean {
  const receipt = snapshot.lastBehaviorEdit;
  return (
    receipt !== undefined &&
    bindingId !== undefined &&
    receipt.objectId === objectId &&
    receipt.bindingId === bindingId &&
    before.bindingId === bindingId &&
    after.bindingId === bindingId &&
    before.documentRevision !== undefined &&
    after.documentRevision !== undefined &&
    receipt.beforeDocumentRevision === before.documentRevision &&
    receipt.afterDocumentRevision === after.documentRevision &&
    receipt.beforeProfileId === before.profileId &&
    receipt.afterProfileId === after.profileId &&
    receipt.afterProfileRevision === after.revision
  );
}

/** Resolve only after the raw transaction and its read-model acknowledgement succeed. */
export async function applyRuleDraft(
  controller: LabController,
  objectId: string,
  ruleId: string,
  entry: RuleDraftEntry,
): Promise<void> {
  const desired = structuredClone(entry.value);
  const { baseRevision, bindingId, expectedSceneRevision, expectedBehaviorRevision } = entry;
  if (entry.mappingError) throw new Error(`DRAFT_INVALID：${entry.mappingError}`);
  if (desired.id !== ruleId) throw new Error("DRAFT_INVALID：草稿與規則 ID 不符。");
  for (const field of ["gainLinear", "pitchSemitones", "cooldownSeconds"] as const) {
    const raw = entry.inputValues?.[field];
    if (raw !== undefined && (!raw.trim() || !sameNumber(Number(raw), desired[field])))
      throw new Error(`DRAFT_INVALID：${field} 尚有無效或未完成的數值輸入。`);
  }
  const initial = controller.getSnapshot();
  const before = currentRule(initial, objectId, ruleId);
  if (!before) throw new Error("RULE_MISSING：原規則已移除或無法唯一識別；草稿保留。");
  if (
    (expectedSceneRevision !== undefined && initial.sceneRevision !== expectedSceneRevision) ||
    (expectedBehaviorRevision !== undefined && before.documentRevision !== expectedBehaviorRevision)
  )
    throw new Error("STALE_REVISION：場景或行為文件已變更；原草稿版本保留。");
  if (bindingId !== undefined && bindingId !== before.bindingId)
    throw new Error("STALE_BINDING：原物件行為 binding 已替換；草稿保留。");
  if (entry.profileId !== undefined && entry.profileId !== before.profileId)
    throw new Error("STALE_PROFILE：原聲音行為 profile 已替換；草稿保留。");
  if (before.revision !== baseRevision)
    throw new Error("STALE_REVISION：聲音行為版本已變更；請檢查草稿後重試。");

  const fullPatch = editableRulePatch(desired);
  const patch: Partial<BehaviorRuleView> = entry.changedFields?.length
    ? Object.fromEntries(
        entry.changedFields
          .filter((field) => Object.hasOwn(fullPatch, field))
          .map((field) => [field, fullPatch[field]]),
      )
    : fullPatch;
  // No await belongs between the revision check and dispatch: both use this stack.
  const transaction = controller.dispatch({
    type: "patchRule",
    objectId,
    ruleId,
    patch,
    ...(expectedSceneRevision !== undefined ? { expectedSceneRevision } : {}),
    ...(expectedBehaviorRevision !== undefined ? { expectedBehaviorRevision } : {}),
  });
  await transaction;
  const snapshot = controller.getSnapshot();
  if (snapshot.error) throw new Error(snapshot.error);
  const after = currentRule(snapshot, objectId, ruleId);
  if (
    !after ||
    after.bindingId !== before.bindingId ||
    !documentAdvanced(before, after) ||
    (after.profileId === before.profileId
      ? after.revision <= baseRevision
      : !receiptAcknowledgesFork(snapshot, objectId, bindingId, before, after)) ||
    !sameEditableRule(after.rule, desired)
  )
    throw new Error("RULE_ACK_MISSING：尚未收到符合草稿的規則版本；草稿保留。");
}
