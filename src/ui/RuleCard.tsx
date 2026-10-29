import { useId, useMemo, useRef } from "react";
import behaviorSchema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import type { BehaviorRuleView, LabViewModel } from "./contracts.js";
import type { RuleDraftEntry } from "./rule-drafts.js";
import { sameEditableRule } from "./rule-drafts.js";
import {
  triggerName,
  triggerOptions,
  unsupportedTriggerReason,
  unsupportedTriggerReasons,
} from "./behavior-options.js";
import { Badge, Icon } from "./components.js";
import { MappingEditor } from "./MappingEditor.js";
import { createMappingDraft, type MappingDraftState } from "./mapping-model.js";
import { useLocale } from "./locale.js";
import { behaviorReasonText, nativeRejectionText } from "./behavior-diagnostic-text.js";

export type NumericRuleField = "gainLinear" | "pitchSemitones" | "cooldownSeconds";
export interface EditorRuleDraft extends RuleDraftEntry {
  profileId: string;
  bindingId: string;
  expectedSceneRevision: number;
  expectedBehaviorRevision: number;
  mappingDraft?: MappingDraftState;
  projectKey: string;
  objectId: string;
  ruleId: string;
  baseline: BehaviorRuleView;
}
const limits = behaviorSchema.$defs.SoundBehaviorRule.properties;
export function invalidRuleNumber(field: NumericRuleField, raw: string): boolean {
  const number = Number(raw);
  return (
    !raw.trim() ||
    !Number.isFinite(number) ||
    number < limits[field].minimum ||
    number > limits[field].maximum
  );
}

function RuleNumberField({
  field,
  label,
  unit,
  raw,
  disabled,
  onChange,
}: {
  field: NumericRuleField;
  label: string;
  unit: string;
  raw: string;
  disabled: boolean;
  onChange: (raw: string) => void;
}) {
  const { t, n } = useLocale();
  const id = useId();
  const focusValue = useRef(raw);
  const invalid = invalidRuleNumber(field, raw);
  return (
    <label className={`number-field ${invalid ? "field-error" : ""}`}>
      <span className="field-label">
        {label}
        <span className="field-unit">{unit}</span>
      </span>
      <input
        type="number"
        value={raw}
        min={limits[field].minimum}
        max={limits[field].maximum}
        step={field === "pitchSemitones" ? 1 : 0.05}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? id : undefined}
        onFocus={() => {
          focusValue.current = raw;
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            focusValue.current = raw;
            event.preventDefault();
          }
          if (event.key === "Escape") {
            onChange(focusValue.current);
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid && (
        <span className="field-message" id={id}>
          {t("editor.rule.finiteRange", {
            min: n(limits[field].minimum),
            max: n(limits[field].maximum),
          })}
        </span>
      )}
    </label>
  );
}

export function RuleCard({
  rule,
  model,
  entry,
  currentProfileId,
  currentRevision,
  currentSceneRevision,
  currentDocumentRevision,
  bindingEnabled,
  disabled,
  onDraft,
  onNumber,
  onMappings,
  onDiscard,
  onApply,
  onDelete,
  onPreview,
  previewDisabled,
}: {
  rule: BehaviorRuleView;
  model: LabViewModel;
  entry: EditorRuleDraft | undefined;
  currentProfileId: string;
  currentRevision: number;
  currentSceneRevision: number;
  currentDocumentRevision: number | undefined;
  bindingEnabled: boolean | undefined;
  disabled: boolean;
  onDraft: (value: BehaviorRuleView) => void;
  onNumber: (field: NumericRuleField, raw: string) => void;
  onMappings: (state: MappingDraftState) => void;
  onDiscard: () => void;
  onApply: () => Promise<void>;
  onDelete: () => void;
  onPreview?: () => void;
  previewDisabled?: boolean;
}) {
  const { t, message } = useLocale();
  const draft = entry?.value ?? rule;
  const dirty = !!entry;
  const pending = entry?.pending ?? false;
  const stale =
    !!entry &&
    (entry.profileId !== currentProfileId ||
      currentRevision !== entry.baseRevision ||
      currentSceneRevision !== entry.expectedSceneRevision ||
      currentDocumentRevision !== entry.expectedBehaviorRevision ||
      !sameEditableRule(entry.baseline, rule));
  const mappingSignature = JSON.stringify(rule.mappings ?? []);
  const committedMappings = useMemo(
    () => createMappingDraft(rule.mappings ?? []),
    [mappingSignature],
  );
  const unsupported = unsupportedTriggerReason(draft.trigger, t);
  const editDisabled = disabled || pending;
  const invalid = (["gainLinear", "pitchSemitones", "cooldownSeconds"] as const).some((field) =>
    invalidRuleNumber(field, entry?.inputValues?.[field] ?? String(draft[field])),
  );
  const change = (patch: Partial<BehaviorRuleView>) => onDraft({ ...draft, ...patch });
  return (
    <article
      className={`behavior-card ${draft.enabled ? "" : "is-disabled"}`}
      aria-label={t("editor.rule.aria", { id: rule.id })}
    >
      <header className="behavior-card-header">
        <label className="check-field">
          <input
            type="checkbox"
            checked={draft.enabled}
            disabled={editDisabled || bindingEnabled === false}
            title={bindingEnabled === false ? t("editor.rule.bindingDisabled") : undefined}
            onChange={(event) => change({ enabled: event.target.checked })}
          />
          <strong>{triggerName(draft.trigger, t)}</strong>
        </label>
        <button
          type="button"
          className="icon-button subtle-button"
          disabled={editDisabled || dirty}
          title={dirty ? t("editor.rule.deleteDraftFirst") : t("editor.rule.delete")}
          aria-label={t("editor.rule.deleteAria", { id: rule.id })}
          onClick={onDelete}
        >
          <Icon name="trash" size={14} />
        </button>
      </header>
      <div className="rule-identity">
        <code>{rule.id}</code>
        <Badge
          kind={
            unsupported || rule.nativeRejection ? "warning" : rule.active ? "success" : "neutral"
          }
        >
          {unsupported
            ? t("editor.rule.unsupported")
            : rule.status
              ? behaviorReasonText(rule.status, t, rule.diagnostic)
              : !rule.enabled
                ? t("editor.rule.disabled")
                : t(rule.active ? "analysis.native.logicalActive" : "editor.rule.waiting")}
        </Badge>
      </div>
      {rule.diagnostic && (
        <p className="micro-copy">
          {t("analysis.decision.latestTick", { tick: rule.diagnostic.tick })}
          {" · "}
          {behaviorReasonText(rule.diagnostic.reason, t, rule.diagnostic)}
        </p>
      )}
      {rule.nativeRejection && (
        <p className="micro-copy">
          {nativeRejectionText(rule.nativeRejection.reason, t)}
          {" · "}
          {t("analysis.native.latestAttempt", { tick: rule.nativeRejection.attemptedAtTick })}
          <br />
          {t("analysis.decision.instance")}: <code>{rule.nativeRejection.instanceId}</code>
          <br />
          {t("analysis.native.scope")}
        </p>
      )}
      {onPreview && (
        <div className="draft-actions">
          <button
            type="button"
            className="outline-button compact-button"
            disabled={
              disabled ||
              pending ||
              dirty ||
              previewDisabled ||
              model.recording.state === "replaying"
            }
            title={
              dirty || previewDisabled
                ? t("preview.applyFirst")
                : disabled
                  ? t("preview.pauseFirst")
                  : t("preview.help")
            }
            onClick={onPreview}
          >
            <Icon name="sound" size={14} />
            {t("preview.sceneAction")}
          </button>
        </div>
      )}
      {unsupported && (
        <p className="micro-copy">{t("editor.rule.unsupportedHelp", { reason: unsupported })}</p>
      )}
      <label className="select-field">
        <span>{t("editor.rule.trigger")}</span>
        <select
          value={draft.trigger}
          disabled={editDisabled}
          onChange={(event) => change({ trigger: event.target.value })}
        >
          {triggerOptions.map(([id]) => (
            <option
              value={id}
              key={id}
              disabled={!!unsupportedTriggerReasons[id]}
              title={unsupportedTriggerReason(id, t)}
            >
              {triggerName(id, t)} · {id}
              {unsupportedTriggerReasons[id] ? t("editor.rule.unsupportedSuffix") : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="select-field">
        <span>{t("editor.rule.asset")}</span>
        <select
          value={draft.assetId ?? "__oscillator"}
          disabled={editDisabled}
          onChange={(event) => {
            if (event.target.value === "__oscillator") {
              const next = { ...draft, generator: "oscillator" as const };
              delete next.assetId;
              onDraft(next);
            } else change({ generator: "sample", assetId: event.target.value });
          }}
        >
          <option value="__oscillator">{t("editor.rule.oscillator")}</option>
          {model.assets
            .filter((asset) => asset.status === "ready")
            .map((asset) => (
              <option value={asset.id} key={asset.id}>
                {asset.name}
              </option>
            ))}
        </select>
      </label>
      <div className="two-fields">
        <RuleNumberField
          field="gainLinear"
          label={t("editor.parameter.gain")}
          unit="linear"
          raw={entry?.inputValues?.gainLinear ?? String(draft.gainLinear)}
          disabled={editDisabled}
          onChange={(raw) => onNumber("gainLinear", raw)}
        />
        <RuleNumberField
          field="pitchSemitones"
          label={t("editor.parameter.pitch")}
          unit="semitones"
          raw={entry?.inputValues?.pitchSemitones ?? String(draft.pitchSemitones)}
          disabled={editDisabled}
          onChange={(raw) => onNumber("pitchSemitones", raw)}
        />
      </div>
      <div className="two-fields">
        <RuleNumberField
          field="cooldownSeconds"
          label={t("editor.parameter.cooldown")}
          unit="s"
          raw={entry?.inputValues?.cooldownSeconds ?? String(draft.cooldownSeconds)}
          disabled={editDisabled}
          onChange={(raw) => onNumber("cooldownSeconds", raw)}
        />
        <p className="micro-copy">{t("editor.rule.curveHelp")}</p>
      </div>
      <MappingEditor
        state={entry?.mappingDraft ?? committedMappings}
        disabled={editDisabled}
        onChange={onMappings}
      />
      {!!entry?.mappingError && (
        <p className="inline-error" role="alert">
          {message(entry.mappingError)}
        </p>
      )}
      {entry?.error && (
        <p className="inline-error" role="alert">
          {message(entry.error)}
        </p>
      )}
      {stale && (
        <p className="inline-error" role="status">
          {t("editor.rule.staleDraft")}
        </p>
      )}
      {dirty && (
        <div className="draft-actions">
          <span className="draft-label">
            {t(pending ? "editor.rule.pending" : "editor.rule.draft")}
          </span>
          <button type="button" className="text-button" disabled={pending} onClick={onDiscard}>
            {t("editor.action.discard")}
          </button>
          <button
            type="button"
            className="primary-button compact-button"
            disabled={
              editDisabled ||
              stale ||
              invalid ||
              !!entry?.mappingError ||
              entry?.changedFields?.length === 0 ||
              (!!unsupported && draft.enabled)
            }
            onClick={() => void onApply()}
          >
            {t("editor.action.apply")}
          </button>
        </div>
      )}
    </article>
  );
}
