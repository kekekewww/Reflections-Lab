import { useId } from "react";
import type { BehaviorRuleView, BehaviorView, LabViewModel } from "./contracts.js";
import {
  bindingDraftConflict,
  bindingMetadataProblem,
  bindingOverrideLimits,
  createBindingDraft,
  normalizeBindingOverride,
  validateBindingDraft,
  type BindingDraftEntry,
} from "./binding-drafts.js";
import { Badge } from "./components.js";
import { useLocale } from "./locale.js";

interface Props {
  model: LabViewModel;
  behavior: BehaviorView;
  rule: BehaviorRuleView;
  entry: BindingDraftEntry | undefined;
  disabled: boolean;
  onChange: (next: BindingDraftEntry) => void;
  onApply: () => Promise<void>;
  onDiscard: () => void;
  onClear: () => Promise<void>;
}
const labelKeys = {
  enabled: "editor.parameter.enabled",
  gainLinear: "editor.parameter.gain",
  pitchSemitones: "editor.parameter.pitch",
} as const;
const units = { enabled: "", gainLinear: "linear", pitchSemitones: "semitones" };

/** The parent owns this draft so selection changes cannot erase raw input or errors. */
export function BindingOverrideEditor({
  model,
  behavior,
  rule,
  entry,
  disabled,
  onChange,
  onApply,
  onDiscard,
  onClear,
}: Props) {
  const { t, n, message } = useLocale();
  const id = useId();
  const readout = (value: number | boolean | undefined) =>
    typeof value === "boolean"
      ? t(value ? "editor.parameter.enabled" : "editor.state.disabled")
      : value === undefined || !Number.isFinite(value)
        ? t("editor.state.unavailable")
        : n(value, { maximumSignificantDigits: 6 });
  const valueTitle = (value: number | boolean | undefined) =>
    typeof value === "number"
      ? n(value, { maximumSignificantDigits: 21, useGrouping: false })
      : value === undefined
        ? t("editor.state.unavailableTitle")
        : t(value ? "editor.parameter.enabled" : "editor.state.disabled");
  const metadataProblem = bindingMetadataProblem(model, behavior, rule);
  const currentOverride =
    rule.bindingOverride === undefined ? undefined : normalizeBindingOverride(rule.bindingOverride);
  const state = entry ?? (metadataProblem ? undefined : createBindingDraft(model, behavior, rule));
  const conflict = entry ? bindingDraftConflict(model, entry) : null;
  const result = state ? validateBindingDraft(state) : { override: null, errors: [] };
  const pending = entry?.pending ?? false;
  const editingDisabled = disabled || pending || !!metadataProblem;
  const update = (change: (next: BindingDraftEntry) => void) => {
    if (!state || editingDisabled) return;
    const next = structuredClone(state);
    next.pending = false;
    next.error = "";
    change(next);
    onChange(next);
  };
  return (
    <section
      className="binding-override-editor"
      aria-label={t("editor.binding.aria", { id: rule.id })}
    >
      <details>
        <summary>
          {t("editor.binding.title")}{" "}
          <Badge kind={entry ? "warning" : "neutral"}>
            {entry
              ? t("editor.rule.draft")
              : currentOverride === undefined
                ? t("editor.binding.sourceUnavailable")
                : currentOverride === null
                  ? t("editor.binding.inherited")
                  : t("editor.binding.overridden")}
          </Badge>
        </summary>
        <p className="micro-copy">{t("editor.binding.help")}</p>
        {metadataProblem && (
          <p className="micro-copy" role="status">
            {message(metadataProblem)}
          </p>
        )}
        {behavior.bindingEnabled === false && (
          <p className="micro-copy">{t("editor.binding.disabledHelp")}</p>
        )}
        <div className="table-scroll">
          <table className="data-table binding-override-table">
            <caption className="sr-only">{t("editor.binding.tableCaption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("editor.binding.parameter")}</th>
                <th scope="col">{t("editor.binding.base")}</th>
                <th scope="col">{t("editor.binding.effective")}</th>
                <th scope="col">{t("editor.binding.title")}</th>
              </tr>
            </thead>
            <tbody>
              {(["enabled", "gainLinear", "pitchSemitones"] as const).map((field) => {
                const selected = state?.fields[field] ?? false;
                const raw = field === "enabled" ? "" : (state?.values[field] ?? "");
                const numericInvalid =
                  field !== "enabled" &&
                  selected &&
                  (!raw.trim() ||
                    !Number.isFinite(Number(raw)) ||
                    Number(raw) < bindingOverrideLimits[field].minimum ||
                    Number(raw) > bindingOverrideLimits[field].maximum);
                return (
                  <tr key={field}>
                    <th scope="row">
                      {t(labelKeys[field])}
                      {units[field] && <span className="field-unit"> {units[field]}</span>}
                    </th>
                    <td className="numeric" title={valueTitle(rule.baseValues?.[field])}>
                      {readout(rule.baseValues?.[field])}
                    </td>
                    <td className="numeric" title={valueTitle(rule[field])}>
                      {readout(rule[field])}
                    </td>
                    <td>
                      <label className="check-field">
                        <input
                          type="checkbox"
                          aria-label={t("editor.binding.overrideAria", {
                            parameter: t(labelKeys[field]),
                          })}
                          checked={selected}
                          disabled={editingDisabled}
                          onChange={(event) =>
                            update((next) => {
                              next.fields[field] = event.target.checked;
                            })
                          }
                        />
                        <span>{t("editor.binding.override")}</span>
                      </label>
                      {field === "enabled" ? (
                        <label className="check-field">
                          <input
                            type="checkbox"
                            aria-label={t("editor.binding.enabledAria")}
                            checked={state?.values.enabled ?? false}
                            disabled={editingDisabled || !selected}
                            onChange={(event) =>
                              update((next) => {
                                next.values.enabled = event.target.checked;
                              })
                            }
                          />
                          <span>
                            {selected
                              ? t(
                                  state?.values.enabled
                                    ? "editor.parameter.enabled"
                                    : "editor.state.disabled",
                                )
                              : t("editor.binding.inherited")}
                          </span>
                        </label>
                      ) : (
                        <input
                          type="number"
                          aria-label={t("editor.binding.valueAria", {
                            parameter: t(labelKeys[field]),
                            unit: units[field],
                          })}
                          value={raw}
                          min={bindingOverrideLimits[field].minimum}
                          max={bindingOverrideLimits[field].maximum}
                          step={field === "gainLinear" ? 0.05 : 1}
                          disabled={editingDisabled || !selected}
                          aria-invalid={numericInvalid}
                          aria-describedby={numericInvalid ? `${id}-${field}-error` : undefined}
                          onChange={(event) =>
                            update((next) => {
                              next.values[field] = event.target.value;
                            })
                          }
                        />
                      )}
                      {numericInvalid && (
                        <span className="field-message" id={`${id}-${field}-error`}>
                          {t("editor.binding.finiteRange")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {conflict && (
          <p className="inline-error" role="status">
            {message(conflict)}
          </p>
        )}
        {entry?.error && (
          <p className="inline-error" role="alert">
            {message(entry.error)}
          </p>
        )}
        {result.errors.length > 0 && (
          <p className="field-message">{result.errors.map((error) => message(error)).join(" ")}</p>
        )}
        {entry && (
          <div className="draft-actions">
            <span className="draft-label">
              {pending
                ? t("editor.binding.pending")
                : result.override === null
                  ? t("editor.binding.inheritDraft")
                  : t("editor.binding.draft")}
            </span>
            <button type="button" className="text-button" disabled={pending} onClick={onDiscard}>
              {t("editor.binding.discard")}
            </button>
            <button
              type="button"
              className="primary-button compact-button"
              disabled={editingDisabled || !!conflict || result.errors.length > 0}
              onClick={() => void onApply()}
            >
              {t("editor.binding.apply")}
            </button>
          </div>
        )}
        <button
          type="button"
          className="text-button"
          disabled={
            editingDisabled || !!entry || currentOverride === null || currentOverride === undefined
          }
          title={entry ? t("editor.binding.clearDraftFirst") : t("editor.binding.clearHelp")}
          onClick={() => void onClear()}
        >
          {t("editor.binding.clear")}
        </button>
        {entry && <p className="micro-copy">{t("editor.binding.clearDraftNotice")}</p>}
      </details>
    </section>
  );
}
