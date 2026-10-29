import { useState } from "react";
import { acousticPathPresentation } from "./acoustic-presentation.js";
import { Euler, Quaternion as ThreeQuaternion } from "three";
import type {
  BehaviorRuleView,
  BehaviorView,
  BodyMode,
  LabController,
  LabViewModel,
  ObjectView,
  Vector3,
} from "./contracts.js";
import { Badge, Icon, NumberField, Section } from "./components.js";
import {
  RuleCard,
  invalidRuleNumber,
  type EditorRuleDraft,
  type NumericRuleField,
} from "./RuleCard.js";
import { applyRuleDraft, ruleDraftKey, sameEditableRule } from "./rule-drafts.js";
import {
  triggerName,
  triggerOptions,
  unsupportedTriggerReason,
  unsupportedTriggerReasons,
} from "./behavior-options.js";
import { validateMappingDraft, type MappingDraftState } from "./mapping-model.js";
import { BindingOverrideEditor } from "./BindingOverrideEditor.js";
import { applyBindingDraft, createBindingDraft, type BindingDraftEntry } from "./binding-drafts.js";
import { useLocale } from "./locale.js";
import { previewErrorKeys } from "./locales/preview.js";

const modes = [
  { value: "dynamicGravity", labelKey: "inspector.bodyMode.dynamicGravity" },
  { value: "dynamicNoGravity", labelKey: "inspector.bodyMode.dynamicNoGravity" },
  { value: "fixed", labelKey: "inspector.bodyMode.fixed" },
  { value: "kinematic", labelKey: "inspector.bodyMode.kinematic" },
] as const satisfies readonly { value: BodyMode; labelKey: string }[];
const demoMaterialLabels = {
  "material.hard": { label: "硬質表面 · Synthetic", key: "inspector.material.hard" },
  "material.soft": { label: "吸音表面 · Synthetic", key: "inspector.material.soft" },
  "material.wood": { label: "木質示範 · Synthetic", key: "inspector.material.wood" },
  "material.metal": { label: "金屬示範 · Synthetic", key: "inspector.material.metal" },
} as const;
const acousticStateKeys = {
  idle: "inspector.acousticState.idle",
  ready: "inspector.acousticState.ready",
  empty: "inspector.acousticState.empty",
  pending: "inspector.acousticState.pending",
  stale: "inspector.acousticState.stale",
  unsupported: "inspector.acousticState.unsupported",
  unavailable: "inspector.acousticState.unavailable",
  error: "inspector.acousticState.error",
} as const;
const draftKey = (projectKey: string, objectId: string, ruleId: string) =>
  JSON.stringify([projectKey, ruleDraftKey(objectId, ruleId)]);
const scalarFields = [
  "trigger",
  "enabled",
  "generator",
  "assetId",
  "gainLinear",
  "pitchSemitones",
  "cooldownSeconds",
] as const;
function changedRuleFields(
  baseline: BehaviorRuleView,
  value: BehaviorRuleView,
): NonNullable<EditorRuleDraft["changedFields"]> {
  const changed: NonNullable<EditorRuleDraft["changedFields"]> = scalarFields.filter((field) => {
    const before = baseline[field],
      after = value[field];
    return typeof before === "number" && typeof after === "number"
      ? Math.abs(before - after) > 1e-8
      : before !== after;
  });
  if (
    !sameEditableRule(
      { ...baseline, mappings: baseline.mappings ?? [] },
      { ...baseline, mappings: value.mappings ?? [] },
    )
  )
    changed.push("mappings");
  return changed;
}

function VectorFields({
  label,
  value,
  onCommit,
  disabled,
  min = -200,
  max = 200,
}: {
  label: string;
  value: Vector3;
  onCommit: (value: Vector3) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <fieldset className="vector-fields">
      <legend>
        {label} <span className="field-unit">m</span>
      </legend>
      <div className="axis-fields">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <NumberField
            key={axis}
            label={axis}
            value={value[index] ?? 0}
            min={min}
            max={max}
            step={0.1}
            disabled={disabled ?? false}
            onCommit={(next) => {
              const result: Vector3 = [...value];
              result[index] = next;
              onCommit(result);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function RotationFields({
  value,
  onCommit,
  disabled,
}: {
  value: [number, number, number, number];
  onCommit: (value: [number, number, number, number]) => void;
  disabled: boolean;
}) {
  const { t } = useLocale();
  const rotation = new Euler().setFromQuaternion(new ThreeQuaternion(...value), "XYZ");
  const degrees: Vector3 = [rotation.x, rotation.y, rotation.z].map(
    (angle) => (angle * 180) / Math.PI,
  ) as Vector3;
  return (
    <fieldset className="vector-fields">
      <legend>
        {t("inspector.rotation")} <span className="field-unit">deg · XYZ</span>
      </legend>
      <div className="axis-fields">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <NumberField
            key={axis}
            label={t("inspector.rotationAxis", { axis })}
            value={Math.round((degrees[index] ?? 0) * 1000) / 1000}
            min={-360}
            max={360}
            step={1}
            disabled={disabled}
            onCommit={(angle) => {
              const updated: Vector3 = [...degrees];
              updated[index] = angle;
              const q = new ThreeQuaternion().setFromEuler(
                new Euler(
                  (updated[0] * Math.PI) / 180,
                  (updated[1] * Math.PI) / 180,
                  (updated[2] * Math.PI) / 180,
                  "XYZ",
                ),
              );
              onCommit([q.x, q.y, q.z, q.w]);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function SoundEditor({
  controller,
  model,
  object,
  projectKey,
  drafts,
  bindingDrafts,
  onDraft,
  onNumber,
  onMappings,
  onDiscard,
  onApply,
  onBindingChange,
  onBindingApply,
  onBindingDiscard,
  onBindingClear,
}: {
  controller: LabController;
  model: LabViewModel;
  object: ObjectView;
  projectKey: string;
  drafts: Record<string, EditorRuleDraft>;
  bindingDrafts: Record<string, BindingDraftEntry>;
  onDraft: (
    key: string,
    objectId: string,
    revision: number,
    rule: BehaviorRuleView,
    value: BehaviorRuleView,
  ) => void;
  onNumber: (
    key: string,
    objectId: string,
    revision: number,
    rule: BehaviorRuleView,
    field: NumericRuleField,
    raw: string,
  ) => void;
  onMappings: (
    key: string,
    objectId: string,
    revision: number,
    rule: BehaviorRuleView,
    state: MappingDraftState,
  ) => void;
  onDiscard: (key: string) => void;
  onApply: (key: string) => Promise<void>;
  onBindingChange: (key: string, entry: BindingDraftEntry) => void;
  onBindingApply: (key: string) => Promise<void>;
  onBindingDiscard: (key: string) => void;
  onBindingClear: (key: string, behavior: BehaviorView, rule: BehaviorRuleView) => Promise<void>;
}) {
  const { t, n } = useLocale();
  const [trigger, setTrigger] = useState("OnImpact");
  const behavior = model.behaviors.find((profile) => profile.objectId === object.id);
  const canEdit = model.simulationState !== "running" && model.recording.state !== "replaying";
  const canAuthor = canEdit && !!behavior?.bindingId && behavior.documentRevision !== undefined;
  return (
    <Section
      title={t("inspector.behaviors")}
      aside={
        <Badge kind="accent">
          {t("inspector.ruleCount", { count: n(behavior?.rules.length ?? 0) })}
        </Badge>
      }
    >
      <p className="section-copy">{t("inspector.behaviorDescription")}</p>
      <label className="select-field">
        <span>{t("inspector.classification")}</span>
        <select
          disabled={!canEdit}
          value={behavior?.presetKind ?? "creative"}
          onChange={(event) => {
            const kind = event.target.value as BehaviorView["presetKind"];
            void controller.dispatch({ type: "setPreset", objectId: object.id, presetKind: kind });
          }}
        >
          <option value="creative">{t("inspector.classification.creative")}</option>
          <option value="physical">{t("inspector.classification.physical")}</option>
          <option value="hybrid">{t("inspector.classification.hybrid")}</option>
          <option value="procedural">{t("inspector.classification.procedural")}</option>
        </select>
      </label>
      <details className="inspector-help">
        <summary>{t("inspector.moreDetails")}</summary>
        <p className="micro-copy">{t("inspector.classificationHelp")}</p>
        {behavior && (
          <p className="micro-copy">
            <code>{behavior.profileId}</code> · profile r{behavior.revision} · binding{" "}
            <code>{behavior.bindingId ?? t("inspector.notProvided")}</code> · document r
            {behavior.documentRevision ?? t("inspector.notProvided")}
          </p>
        )}
      </details>
      {behavior && !canAuthor && canEdit && (
        <p className="inline-error" role="status">
          {t("inspector.authoringMetadataMissing")}
        </p>
      )}
      {behavior?.rules.map((rule) => {
        const key = draftKey(projectKey, object.id, rule.id);
        return (
          <div className="behavior-rule-group" key={`${object.id}/${rule.id}`}>
            <RuleCard
              rule={rule}
              model={model}
              disabled={!canAuthor}
              entry={drafts[key]}
              currentProfileId={behavior.profileId}
              currentRevision={behavior.revision}
              currentSceneRevision={model.sceneRevision}
              currentDocumentRevision={behavior.documentRevision}
              bindingEnabled={behavior.bindingEnabled}
              previewDisabled={!!bindingDrafts[key]}
              onPreview={() => {
                if (behavior.bindingId)
                  void controller.dispatch({
                    type: "previewRule",
                    objectId: object.id,
                    bindingId: behavior.bindingId,
                    ruleId: rule.id,
                  });
              }}
              onDraft={(value) => onDraft(key, object.id, behavior.revision, rule, value)}
              onNumber={(field, raw) =>
                onNumber(key, object.id, behavior.revision, rule, field, raw)
              }
              onMappings={(state) => onMappings(key, object.id, behavior.revision, rule, state)}
              onDiscard={() => onDiscard(key)}
              onApply={() => onApply(key)}
              onDelete={() =>
                void controller.dispatch({
                  type: "removeRule",
                  objectId: object.id,
                  ruleId: rule.id,
                })
              }
            />
            <BindingOverrideEditor
              model={model}
              behavior={behavior}
              rule={rule}
              entry={bindingDrafts[key]}
              disabled={!canAuthor}
              onChange={(entry) => onBindingChange(key, entry)}
              onApply={() => onBindingApply(key)}
              onDiscard={() => onBindingDiscard(key)}
              onClear={() => onBindingClear(key, behavior, rule)}
            />
          </div>
        );
      })}
      {!behavior?.rules.length && (
        <div className="empty-state compact">{t("inspector.noBehaviors")}</div>
      )}
      <div className="add-rule-row">
        <label className="sr-only" htmlFor="new-trigger">
          {t("inspector.newTrigger")}
        </label>
        <select
          id="new-trigger"
          disabled={!canEdit}
          value={trigger}
          onChange={(event) => setTrigger(event.target.value)}
        >
          {triggerOptions.map(([id]) => (
            <option
              value={id}
              key={id}
              disabled={!!unsupportedTriggerReasons[id]}
              title={unsupportedTriggerReason(id, t)}
            >
              {triggerName(id, t)}
              {unsupportedTriggerReasons[id] ? t("inspector.unsupportedSuffix") : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="outline-button"
          disabled={!canEdit || !!unsupportedTriggerReasons[trigger]}
          onClick={() =>
            void controller.dispatch({ type: "addRule", objectId: object.id, trigger })
          }
        >
          <Icon name="plus" />
          {t("inspector.addRule")}
        </button>
      </div>
      <details className="inspector-help">
        <summary>{t("inspector.moreDetails")}</summary>
        <p className="micro-copy">{t("inspector.physicalInspiredHelp")}</p>
        <p className="micro-copy">{t("inspector.unsupportedTriggers")}</p>
      </details>
    </Section>
  );
}

function PreviewInspector({
  model,
  controller,
}: {
  model: LabViewModel;
  controller: LabController;
}) {
  const { t, n } = useLocale();
  const preview = model.preview;
  const metadata = preview?.metadata;
  const error = model.error || preview?.error || "";
  const errorKey = Object.entries(previewErrorKeys).find(([code]) => error.includes(code))?.[1];
  if (!preview || (preview.status === "idle" && !metadata && !preview.error && !errorKey))
    return null;
  return (
    <Section title={t("preview.title")}>
      <details className="inspector-help">
        <summary>{t("inspector.moreDetails")}</summary>
        <p className="micro-copy">{t("preview.help")}</p>
      </details>
      <p className="micro-copy" role="status">
        {t(`preview.state.${preview.status}`)}
      </p>
      {errorKey && (
        <p className="inline-error" role="status">
          {t(errorKey)}
        </p>
      )}
      {!errorKey && preview.status === "error" && (
        <p className="inline-error" role="status">
          {t("preview.error.audio")}
        </p>
      )}
      <button
        type="button"
        className="outline-button compact-button"
        disabled={model.monitor.state === "blocked" && preview.status === "idle"}
        onClick={() => void controller.dispatch({ type: "stopPreview" })}
      >
        <Icon name="pause" size={14} />
        {t("preview.stop")}
      </button>
      {metadata && (
        <>
          <p className="micro-copy">
            {t(preview.monitorMode === "raw" ? "preview.raw" : "preview.simulated")}
          </p>
          {preview.muted && <p className="micro-copy">{t("preview.muted")}</p>}
          <p className="micro-copy">
            {t("preview.duration", { seconds: n(metadata.durationSeconds) })}
          </p>
          <details>
            <summary>{t("preview.details")}</summary>
            <dl className="detail-list">
              <div>
                <dt>{t("preview.identity")}</dt>
                <dd>
                  <code>{metadata.previewId}</code> · epoch 0 s
                </dd>
              </div>
              <div>
                <dt>{t("preview.object")}</dt>
                <dd>
                  <code>{metadata.objectId}</code> · generation {metadata.generation} · [
                  {metadata.source.positionM.map((value) => n(value)).join(", ")}] ·{" "}
                  {t(`preview.origin.${metadata.source.origin}`)}
                </dd>
              </div>
              <div>
                <dt>{t("preview.scene")}</dt>
                <dd>
                  <code>{metadata.sceneId}</code> r{metadata.sceneRevision} · tick{" "}
                  {metadata.poseTick}
                </dd>
              </div>
              <div>
                <dt>{t("preview.behavior")}</dt>
                <dd>
                  <code>{metadata.documentId}</code> r{metadata.documentRevision} ·{" "}
                  <code>{metadata.profileId}</code> r{metadata.profileRevision} ·{" "}
                  <code>{metadata.ruleId}</code> · <code>{metadata.bindingId}</code>
                </dd>
              </div>
              <div>
                <dt>{t("preview.listener")}</dt>
                <dd>
                  <code>{metadata.listener.id}</code> · [
                  {metadata.listener.positionM.map((value) => n(value)).join(", ")}] m · [
                  {metadata.listener.orientationQuaternion.map((value) => n(value)).join(", ")}]
                </dd>
              </div>
              <div>
                <dt>{t("preview.contact")}</dt>
                <dd>
                  {metadata.contact ? (
                    <>
                      <code>{metadata.contact.runId}</code> ·{" "}
                      <code>{metadata.contact.runEpoch}</code> ·{" "}
                      <code>{metadata.contact.inputEventId}</code> ·{" "}
                      <code>{metadata.contact.audioEventId}</code> · tick {metadata.contact.tick} ·{" "}
                      <code>{metadata.contact.pairKey}</code>
                    </>
                  ) : (
                    t("preview.noContact")
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("preview.solver")}</dt>
                <dd>
                  <code>{metadata.solver.backendId}</code> v{metadata.solver.backendVersion} ·{" "}
                  <code>{metadata.solver.requestId}</code> · scene r{metadata.solver.sceneRevision}{" "}
                  / geometry r{metadata.solver.geometryRevision} / tick {metadata.solver.poseTick} ·{" "}
                  {metadata.solver.pathCount} paths · {metadata.solver.capabilities.join(", ")}
                </dd>
              </div>
            </dl>
          </details>
          <p className="micro-copy">{t("preview.limit")}</p>
        </>
      )}
    </Section>
  );
}

export function Inspector({
  controller,
  model,
  showListener = false,
  transactionController = controller,
}: {
  controller: LabController;
  model: LabViewModel;
  showListener?: boolean;
  transactionController?: LabController;
}) {
  const { t, n, message } = useLocale();
  const projectKey = model.projectId ?? model.projectName;
  const [drafts, setDrafts] = useState<Record<string, EditorRuleDraft>>({});
  const [bindingDrafts, setBindingDrafts] = useState<Record<string, BindingDraftEntry>>({});
  const [bindingError, setBindingError] = useState("");
  const createDraft = (
    objectId: string,
    revision: number,
    rule: BehaviorRuleView,
  ): EditorRuleDraft => ({
    projectKey,
    profileId: model.behaviors.find((profile) => profile.objectId === objectId)?.profileId ?? "",
    bindingId: model.behaviors.find((profile) => profile.objectId === objectId)?.bindingId ?? "",
    expectedSceneRevision: model.sceneRevision,
    expectedBehaviorRevision:
      model.behaviors.find((profile) => profile.objectId === objectId)?.documentRevision ?? -1,
    objectId,
    ruleId: rule.id,
    baseline: structuredClone(rule),
    value: structuredClone(rule),
    baseRevision: revision,
    pending: false,
    error: "",
    inputValues: {},
    changedFields: [],
  });
  const updateDraft = (
    key: string,
    objectId: string,
    revision: number,
    rule: BehaviorRuleView,
    value: BehaviorRuleView,
  ) => {
    setDrafts((current) => {
      const entry = current[key] ?? createDraft(objectId, revision, rule);
      return entry.pending
        ? current
        : {
            ...current,
            [key]: {
              ...entry,
              value,
              changedFields: changedRuleFields(entry.baseline, value),
              error: "",
            },
          };
    });
  };
  const updateNumber = (
    key: string,
    objectId: string,
    revision: number,
    rule: BehaviorRuleView,
    field: NumericRuleField,
    raw: string,
  ) => {
    setDrafts((current) => {
      const entry = current[key] ?? createDraft(objectId, revision, rule);
      if (entry.pending) return current;
      const value = invalidRuleNumber(field, raw)
        ? entry.value
        : { ...entry.value, [field]: Number(raw) };
      return {
        ...current,
        [key]: {
          ...entry,
          value,
          changedFields: changedRuleFields(entry.baseline, value),
          inputValues: { ...entry.inputValues, [field]: raw },
          error: "",
        },
      };
    });
  };
  const updateMappings = (
    key: string,
    objectId: string,
    revision: number,
    rule: BehaviorRuleView,
    state: MappingDraftState,
  ) => {
    setDrafts((current) => {
      const entry = current[key] ?? createDraft(objectId, revision, rule);
      if (entry.pending) return current;
      const validation = validateMappingDraft(state);
      const value = validation.value ? { ...entry.value, mappings: validation.value } : entry.value;
      return {
        ...current,
        [key]: {
          ...entry,
          value,
          mappingDraft: state,
          mappingError: validation.errors.join("；"),
          changedFields: changedRuleFields(entry.baseline, value),
          error: "",
        },
      };
    });
  };
  const discardDraft = (key: string) =>
    setDrafts((current) => {
      if (current[key]?.pending) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  const applyDraft = async (key: string) => {
    const entry = drafts[key];
    if (!entry || entry.pending) return;
    setDrafts((current) => ({ ...current, [key]: { ...entry, pending: true, error: "" } }));
    try {
      const snapshot = transactionController.getSnapshot();
      if ((snapshot.projectId ?? snapshot.projectName) !== entry.projectKey)
        throw new Error("PROJECT_CHANGED：原專案已切換；草稿保留。");
      const profile = snapshot.behaviors.find((item) => item.objectId === entry.objectId);
      const rule = profile?.rules.find((item) => item.id === entry.ruleId);
      if (
        !profile ||
        !rule ||
        profile.profileId !== entry.profileId ||
        profile.revision !== entry.baseRevision ||
        snapshot.sceneRevision !== entry.expectedSceneRevision ||
        profile.documentRevision !== entry.expectedBehaviorRevision ||
        !sameEditableRule(entry.baseline, rule)
      )
        throw new Error("STALE_RULE：原規則已變更或移除；草稿保留，請檢視後明示放棄再重新編輯。");
      await applyRuleDraft(transactionController, entry.objectId, entry.ruleId, entry);
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (error) {
      setDrafts((current) => ({
        ...current,
        [key]: {
          ...entry,
          pending: false,
          error: error instanceof Error ? error.message : "套用失敗；草稿保留。",
        },
      }));
    }
  };
  const currentDrafts = Object.values(drafts).filter((entry) => entry.projectKey === projectKey);
  const currentBindingDrafts = Object.values(bindingDrafts).filter(
    (entry) => entry.projectKey === projectKey,
  );
  const storeBindingDraft = (key: string, entry: BindingDraftEntry) =>
    setBindingDrafts((current) => (current[key]?.pending ? current : { ...current, [key]: entry }));
  const discardBindingDraft = (key: string) =>
    setBindingDrafts((current) => {
      if (current[key]?.pending) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  const submitBindingEntry = async (key: string, entry: BindingDraftEntry) => {
    if (entry.pending) return;
    setBindingError("");
    setBindingDrafts((current) => ({ ...current, [key]: { ...entry, pending: true, error: "" } }));
    try {
      await applyBindingDraft(transactionController, entry);
      setBindingDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (error) {
      setBindingDrafts((current) => ({
        ...current,
        [key]: {
          ...entry,
          pending: false,
          error: error instanceof Error ? error.message : "物件覆寫套用失敗；草稿保留。",
        },
      }));
    }
  };
  const applyBinding = async (key: string) => {
    const entry = bindingDrafts[key];
    if (entry) await submitBindingEntry(key, entry);
  };
  const clearBinding = async (key: string, behavior: BehaviorView, rule: BehaviorRuleView) => {
    try {
      const entry = createBindingDraft(model, behavior, rule);
      entry.fields = { enabled: false, gainLinear: false, pitchSemitones: false };
      await submitBindingEntry(key, entry);
    } catch (error) {
      setBindingError(error instanceof Error ? error.message : "無法準備清除覆寫。");
    }
  };
  const object = showListener
    ? undefined
    : model.objects.find((entry) => entry.id === model.selectedObjectId);
  const canEdit = model.simulationState !== "running" && model.recording.state !== "replaying";
  const patch = (changes: Parameters<LabController["dispatch"]>[0] & { type: "patchObject" }) =>
    void controller.dispatch(changes);
  const materials =
    model.materialOptions ??
    Array.from(new Set(model.objects.map((entry) => entry.acousticMaterialId))).map((id) => ({
      id,
      label: id,
      dataClass: t("inspector.sourceNotProvided"),
    }));
  const materialLabel = (material: { id: string; label: string }) => {
    const demo = demoMaterialLabels[material.id as keyof typeof demoMaterialLabels];
    return demo?.label === material.label ? t(demo.key) : material.label;
  };
  return (
    <aside className="inspector" aria-label={t("inspector.aria")}>
      <header className="panel-header">
        <h2>{t("inspector.title")}</h2>
        <Badge>{object ? object.shape : "Listener"}</Badge>
      </header>
      <PreviewInspector model={model} controller={controller} />
      {!!(currentDrafts.length + currentBindingDrafts.length) && (
        <section className="rule-draft-summary" aria-label={t("inspector.savedDraftsAria")}>
          <p role="status">
            {t("inspector.savedDrafts", {
              count: n(currentDrafts.length + currentBindingDrafts.length),
            })}
          </p>
          <button
            type="button"
            className="text-button"
            disabled={[...currentDrafts, ...currentBindingDrafts].some((entry) => entry.pending)}
            onClick={() => {
              setBindingDrafts((current) =>
                Object.fromEntries(
                  Object.entries(current).filter(([, entry]) => entry.projectKey !== projectKey),
                ),
              );
              setDrafts((current) =>
                Object.fromEntries(
                  Object.entries(current).filter(([, entry]) => entry.projectKey !== projectKey),
                ),
              );
            }}
          >
            {t("inspector.discardAllDrafts")}
          </button>
        </section>
      )}
      {bindingError && (
        <p className="inline-error" role="alert">
          {message(bindingError)}
        </p>
      )}
      {model.simulationState === "running" && (
        <div className="editing-guard">
          <span>{t("inspector.runningEditGuard")}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => void controller.dispatch({ type: "pause" })}
          >
            {t("inspector.pause")}
          </button>
        </div>
      )}
      {object ? (
        <>
          <div className="inspector-identity">
            <span className="identity-icon">
              <Icon name={object.shape} size={25} />
            </span>
            <div>
              <h2>{object.name ?? object.id}</h2>
              <code>{object.id}</code>
            </div>
          </div>
          <div className="inspector-actions">
            <button
              type="button"
              className="text-button"
              disabled={!canEdit}
              onClick={() =>
                void controller.dispatch({ type: "duplicateObject", objectId: object.id })
              }
            >
              <Icon name="duplicate" size={14} />
              {t("inspector.duplicate")}
            </button>
            <button
              type="button"
              className="text-button danger-text"
              disabled={!canEdit}
              onClick={() =>
                void controller.dispatch({ type: "removeObject", objectId: object.id })
              }
            >
              <Icon name="trash" size={14} />
              {t("inspector.remove")}
            </button>
          </div>
          <Section
            title={t("inspector.transform")}
            aside={<Badge>{t("inspector.authorSettings")}</Badge>}
          >
            <VectorFields
              label={t("inspector.position")}
              value={object.positionM}
              disabled={!canEdit}
              onCommit={(positionM) =>
                patch({ type: "patchObject", objectId: object.id, patch: { positionM } })
              }
            />
            <VectorFields
              label={t("inspector.dimensions")}
              value={object.dimensionsM}
              min={0.01}
              max={100}
              disabled={!canEdit}
              onCommit={(dimensionsM) =>
                patch({ type: "patchObject", objectId: object.id, patch: { dimensionsM } })
              }
            />
            <RotationFields
              value={object.orientationQuaternion}
              disabled={!canEdit}
              onCommit={(orientationQuaternion) =>
                patch({
                  type: "patchObject",
                  objectId: object.id,
                  patch: { orientationQuaternion },
                })
              }
            />
            <details className="inspector-help">
              <summary>{t("inspector.moreDetails")}</summary>
              <p className="micro-copy">{t("inspector.authorPoseHelp")}</p>
            </details>
          </Section>
          <Section title={t("inspector.rigidBody")}>
            <label className="select-field">
              <span>{t("inspector.bodyModeLabel")}</span>
              <select
                aria-label={t("inspector.bodyModeAria")}
                disabled={!canEdit}
                value={object.mode}
                onChange={(event) =>
                  patch({
                    type: "patchObject",
                    objectId: object.id,
                    patch: { mode: event.target.value as BodyMode },
                  })
                }
              >
                {modes.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {t(mode.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="two-fields">
              <NumberField
                label={t("inspector.mass")}
                unit="kg"
                min={0.001}
                max={10000}
                step={0.1}
                disabled={!canEdit || object.mode === "fixed"}
                value={object.massKg}
                onCommit={(massKg) =>
                  patch({ type: "patchObject", objectId: object.id, patch: { massKg } })
                }
              />
              <NumberField
                label={t("inspector.friction")}
                min={0}
                max={2}
                step={0.05}
                disabled={!canEdit}
                value={object.friction}
                onCommit={(friction) =>
                  patch({ type: "patchObject", objectId: object.id, patch: { friction } })
                }
              />
            </div>
            <NumberField
              label={t("inspector.restitution")}
              min={0}
              max={1}
              step={0.05}
              disabled={!canEdit}
              value={object.restitution}
              onCommit={(restitution) =>
                patch({ type: "patchObject", objectId: object.id, patch: { restitution } })
              }
            />
            {object.velocityMps && (
              <div className="readout-line">
                <span>{t("inspector.speed")}</span>
                <code>
                  {n(Math.hypot(...object.velocityMps), {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                    useGrouping: false,
                  })}{" "}
                  m/s
                </code>
              </div>
            )}
            <details className="inspector-help">
              <summary>{t("inspector.moreDetails")}</summary>
              <p className="micro-copy">{t("inspector.noGravityHelp")}</p>
            </details>
          </Section>
          <Section
            title={t("inspector.acousticMaterial")}
            aside={
              <Badge>
                {materials.find((material) => material.id === object.acousticMaterialId)
                  ?.dataClass ?? t("inspector.notProvided")}
              </Badge>
            }
          >
            <label className="select-field">
              <span>{t("inspector.surfaceMaterial")}</span>
              <select
                aria-label={t("inspector.acousticMaterial")}
                disabled={!canEdit}
                value={object.acousticMaterialId}
                onChange={(event) =>
                  patch({
                    type: "patchObject",
                    objectId: object.id,
                    patch: { acousticMaterialId: event.target.value },
                  })
                }
              >
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {materialLabel(material)} · {material.dataClass}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <span>{t("inspector.acousticRole")}</span>
              <select
                disabled={!canEdit}
                value={object.acousticRole}
                onChange={(event) =>
                  patch({
                    type: "patchObject",
                    objectId: object.id,
                    patch: { acousticRole: event.target.value as ObjectView["acousticRole"] },
                  })
                }
              >
                <option value="none">{t("inspector.acousticRole.none")}</option>
                <option value="staticSurface">{t("inspector.acousticRole.staticSurface")}</option>
                <option value="dynamicOccluder">
                  {t("inspector.acousticRole.dynamicOccluder")}
                </option>
                <option value="dynamicReflector">
                  {t("inspector.acousticRole.dynamicReflector")}
                </option>
              </select>
            </label>
          </Section>
          <SoundEditor
            controller={controller}
            model={model}
            object={object}
            projectKey={projectKey}
            drafts={drafts}
            bindingDrafts={bindingDrafts}
            onDraft={updateDraft}
            onNumber={updateNumber}
            onMappings={updateMappings}
            onDiscard={discardDraft}
            onApply={applyDraft}
            onBindingChange={storeBindingDraft}
            onBindingApply={applyBinding}
            onBindingDiscard={discardBindingDraft}
            onBindingClear={clearBinding}
          />
        </>
      ) : (
        <>
          <div className="inspector-identity">
            <span className="identity-icon">
              <Icon name="listener" size={25} />
            </span>
            <div>
              <h2>{t("inspector.audioListener")}</h2>
              <code>{model.listener.id}</code>
            </div>
          </div>
          <Section
            title={t("inspector.receiverPosition")}
            aside={
              <Badge>
                {model.listener.attachment === "fpsHead"
                  ? t("inspector.fpsFollow")
                  : t("inspector.independent")}
              </Badge>
            }
          >
            <VectorFields
              label={t("inspector.position")}
              value={model.listener.positionM}
              disabled={!canEdit || model.listener.attachment === "fpsHead"}
              onCommit={(positionM) =>
                void controller.dispatch({ type: "patchListener", positionM })
              }
            />
            <RotationFields
              value={model.listener.orientationQuaternion}
              disabled={!canEdit || model.listener.attachment === "fpsHead"}
              onCommit={(orientationQuaternion) =>
                void controller.dispatch({
                  type: "patchListener",
                  positionM: model.listener.positionM,
                  orientationQuaternion,
                })
              }
            />
            <details className="inspector-help">
              <summary>{t("inspector.moreDetails")}</summary>
              <p className="micro-copy">{t("inspector.listenerPoseHelp")}</p>
            </details>
          </Section>
          <Section title={t("inspector.environment")}>
            <div className="readout-line">
              <span>{t("inspector.backend")}</span>
              <code>{model.acoustic.backend}</code>
            </div>
            <div className="readout-line">
              <span>{t("inspector.medium")}</span>
              <span>{model.acoustic.medium ?? t("inspector.notProvided")}</span>
            </div>
            <label className="select-field">
              <span>{t("inspector.propagationMedium")}</span>
              <select
                aria-label={t("inspector.propagationMedium")}
                disabled={!canEdit}
                value={
                  model.acoustic.medium === "air" || model.acoustic.medium === "vacuum"
                    ? model.acoustic.medium
                    : ""
                }
                onChange={(event) => {
                  if (event.target.value === "air" || event.target.value === "vacuum")
                    void controller.dispatch({ type: "setAtmosphere", medium: event.target.value });
                }}
              >
                <option value="" disabled>
                  {t("inspector.notProvided")}
                </option>
                <option value="air">{t("inspector.medium.air")}</option>
                <option value="vacuum">{t("inspector.medium.vacuum")}</option>
              </select>
            </label>
            {model.acoustic.temperatureC !== undefined && (
              <NumberField
                label={t("inspector.airTemperature")}
                unit="°C"
                min={-80}
                max={100}
                value={model.acoustic.temperatureC}
                disabled={!canEdit || model.acoustic.medium === "vacuum"}
                step={1}
                onCommit={(temperatureC) =>
                  void controller.dispatch({ type: "setAtmosphere", medium: "air", temperatureC })
                }
              />
            )}
            <details className="inspector-help">
              <summary>{t("inspector.moreDetails")}</summary>
              <p className="micro-copy">{t("inspector.vacuumHelp")}</p>
            </details>
            <div className="readout-line">
              <span>{t("inspector.speedOfSound")}</span>
              <code>
                {model.acoustic.speedOfSoundMps === undefined
                  ? t("inspector.notProvided")
                  : `${n(model.acoustic.speedOfSoundMps, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })} m/s`}
              </code>
            </div>
            <p className="section-copy">{message(model.acoustic.model)}</p>
            <Badge kind={model.acoustic.state === "ready" ? "success" : "warning"}>
              {t(acousticStateKeys[acousticPathPresentation(model)])}
            </Badge>
          </Section>
          <div className="empty-state">
            <Icon name="target" size={30} />
            <p>{t("inspector.selectObjectHelp")}</p>
          </div>
        </>
      )}
    </aside>
  );
}
