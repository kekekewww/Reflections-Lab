import { useId, useRef } from "react";
import { mapParameter } from "../audio-behavior/profile-registry.js";
import type { SoundParameterMapping } from "./contracts.js";
import { useLocale } from "./locale.js";
import {
  appendMapping,
  insertCurvePoint,
  inputPresentation,
  mappingInputs,
  mappingTargets,
  mappingNumberLimits,
  MAX_CURVE_POINTS,
  MAX_MAPPINGS,
  MIN_CURVE_POINTS,
  validateMappingDraft,
  type MappingDraft,
  type MappingDraftState,
} from "./mapping-model.js";

const inputLabelKeys = {
  sourceSpeedMetresPerSecond: "editor.mapping.input.sourceSpeedMetresPerSecond",
  angularSpeedRadiansPerSecond: "editor.mapping.input.angularSpeedRadiansPerSecond",
  normalImpulseNewtonSeconds: "editor.mapping.input.normalImpulseNewtonSeconds",
  closingSpeedMetresPerSecond: "editor.mapping.input.closingSpeedMetresPerSecond",
  tangentSpeedMetresPerSecond: "editor.mapping.input.tangentSpeedMetresPerSecond",
  slipSpeedMetresPerSecond: "editor.mapping.input.slipSpeedMetresPerSecond",
  contactSupportForceNewtons: "editor.mapping.input.contactSupportForceNewtons",
} as const satisfies Record<SoundParameterMapping["input"], string>;

const targetLabelKeys = {
  gainLinear: "editor.mapping.target.gainLinear",
  pitchSemitones: "editor.mapping.target.pitchSemitones",
  filterCutoffHz: "editor.mapping.target.filterCutoffHz",
} as const satisfies Record<SoundParameterMapping["target"], string>;

const targetUnitKeys = {
  gainLinear: "editor.mapping.unit.linear",
  pitchSemitones: "editor.mapping.unit.semitones",
  filterCutoffHz: "editor.mapping.unit.hertz",
} as const satisfies Record<SoundParameterMapping["target"], string>;

function NumberInput({
  label,
  value,
  disabled,
  onChange,
  min,
  max,
  step = "any",
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  const numeric = Number(value);
  const focusValue = useRef(value);
  const invalid =
    !value.trim() ||
    !Number.isFinite(numeric) ||
    (min !== undefined && numeric < min) ||
    (max !== undefined && numeric > max);
  return (
    <input
      type="number"
      aria-label={label}
      value={value}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      aria-invalid={invalid}
      onFocus={() => {
        focusValue.current = value;
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") {
          focusValue.current = value;
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
  );
}

function CurveChart({ mapping }: { mapping: SoundParameterMapping }) {
  const id = useId();
  const { t, n } = useLocale();
  const inputUnit = inputPresentation[mapping.input].unit;
  const outputUnit = t(targetUnitKeys[mapping.target]);
  const displayNumber = (value: number) => n(value, { maximumSignificantDigits: 15 });
  const coordinate = (x: number, y: number) => `${20 + x * 200},${100 - y * 80}`;
  const curve =
    mapping.outputMin === mapping.outputMax
      ? mapping.curve.map((p) => ({ x: p.x, y: 0.5 }))
      : mapping.curve;
  let d = `M${coordinate(curve[0]!.x, curve[0]!.y)}`;
  for (const p of curve.slice(1))
    d +=
      mapping.interpolation === "step"
        ? `H${20 + p.x * 200}V${100 - p.y * 80}`
        : `L${coordinate(p.x, p.y)}`;
  return (
    <svg
      className="mapping-chart"
      viewBox="0 0 240 120"
      width="100%"
      role="img"
      aria-labelledby={id}
      aria-describedby={`${id}-description`}
    >
      <title id={id}>
        {t("editor.mapping.chartTitle", {
          interpolation: t(
            mapping.interpolation === "step"
              ? "editor.mapping.interpolationDescription.step"
              : "editor.mapping.interpolationDescription.linear",
          ),
        })}
      </title>
      <desc id={`${id}-description`}>
        {mapping.outputMin === mapping.outputMax
          ? t("editor.mapping.chartFixedDescription", {
              output: displayNumber(mapping.outputMin),
              unit: outputUnit,
            })
          : t("editor.mapping.chartRangeDescription", {
              inputMin: displayNumber(mapping.inputMin),
              inputMax: displayNumber(mapping.inputMax),
              inputUnit,
              outputMin: displayNumber(mapping.outputMin),
              outputMax: displayNumber(mapping.outputMax),
              outputUnit,
            })}
      </desc>
      <path d="M20,20V100H220" fill="none" stroke="var(--color-border-control)" />
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      {curve.map((p, index) => (
        <circle
          key={`${mapping.mappingId}:${p.x}`}
          cx={20 + p.x * 200}
          cy={100 - p.y * 80}
          r="3"
          fill="var(--color-accent)"
        >
          <title>
            {t("editor.mapping.chartPointTitle", {
              index: n(index + 1),
              input: displayNumber(mapping.inputMin + p.x * (mapping.inputMax - mapping.inputMin)),
              inputUnit,
              output: displayNumber(
                mapParameter(
                  mapping,
                  mapping.inputMin + p.x * (mapping.inputMax - mapping.inputMin),
                ),
              ),
              outputUnit,
            })}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function MappingEditor({
  state,
  disabled,
  onChange,
}: {
  state: MappingDraftState;
  disabled: boolean;
  onChange: (next: MappingDraftState) => void;
}) {
  const { t, n, message } = useLocale();
  const displayNumber = (value: number) => n(value, { maximumSignificantDigits: 15 });
  const displayDraftNumber = (raw: string) =>
    raw.trim() && Number.isFinite(Number(raw)) ? displayNumber(Number(raw)) : raw;
  const validation = validateMappingDraft(state);
  const update = (key: string, patch: Partial<MappingDraft>) =>
    onChange({
      mappings: state.mappings.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    });
  const available = mappingTargets.some(
    (target) => !state.mappings.some((mapping) => mapping.target === target),
  );
  return (
    <section className="mapping-editor" aria-label={t("editor.mapping.editorLabel")}>
      <p className="micro-copy">{t("editor.mapping.instructions", { zero: n(0), one: n(1) })}</p>
      {state.mappings.map((mapping) => {
        const inputUnit = inputPresentation[mapping.input].unit;
        const outputUnit = t(targetUnitKeys[mapping.target]);
        const canonical = validateMappingDraft({ mappings: [mapping] }).value?.[0];
        return (
          <article
            className="mapping-card"
            key={mapping.key}
            aria-label={t("editor.mapping.cardLabel", { id: mapping.mappingId })}
          >
            <header className="behavior-card-header">
              <code>{mapping.mappingId}</code>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    mappings: state.mappings.filter((entry) => entry.key !== mapping.key),
                  })
                }
              >
                {t("editor.mapping.removeMapping")}
              </button>
            </header>
            <div className="two-fields">
              <label className="select-field">
                <span>{t("editor.mapping.inputLabel", { unit: inputUnit })}</span>
                <select
                  aria-label={t("editor.mapping.inputAria")}
                  value={mapping.input}
                  disabled={disabled}
                  onChange={(event) =>
                    update(mapping.key, {
                      input: event.target.value as SoundParameterMapping["input"],
                    })
                  }
                >
                  {mappingInputs.map((metric) => (
                    <option key={metric} value={metric}>
                      {t(inputLabelKeys[metric])} · {inputPresentation[metric].unit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-field">
                <span>{t("editor.mapping.targetLabel", { unit: outputUnit })}</span>
                <select
                  aria-label={t("editor.mapping.targetAria")}
                  value={mapping.target}
                  disabled={disabled}
                  onChange={(event) =>
                    update(mapping.key, {
                      target: event.target.value as SoundParameterMapping["target"],
                    })
                  }
                >
                  {mappingTargets.map((output) => (
                    <option
                      key={output}
                      value={output}
                      disabled={state.mappings.some(
                        (entry) => entry.key !== mapping.key && entry.target === output,
                      )}
                    >
                      {t(targetLabelKeys[output])} · {t(targetUnitKeys[output])}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="two-fields">
              <label className="number-field">
                <span>{t("editor.mapping.inputMinLabel", { unit: inputUnit })}</span>
                <NumberInput
                  label={t("editor.mapping.inputMinAria")}
                  value={mapping.inputMin}
                  disabled={disabled}
                  min={mappingNumberLimits.inputMin.minimum}
                  max={mappingNumberLimits.inputMin.maximum}
                  onChange={(value) => update(mapping.key, { inputMin: value })}
                />
              </label>
              <label className="number-field">
                <span>{t("editor.mapping.inputMaxLabel", { unit: inputUnit })}</span>
                <NumberInput
                  label={t("editor.mapping.inputMaxAria")}
                  value={mapping.inputMax}
                  disabled={disabled}
                  min={mappingNumberLimits.inputMax.minimum}
                  max={mappingNumberLimits.inputMax.maximum}
                  onChange={(value) => update(mapping.key, { inputMax: value })}
                />
              </label>
            </div>
            <div className="two-fields">
              <label className="number-field">
                <span>{t("editor.mapping.outputMinLabel", { unit: outputUnit })}</span>
                <NumberInput
                  label={t("editor.mapping.outputMinAria")}
                  value={mapping.outputMin}
                  disabled={disabled}
                  onChange={(value) => update(mapping.key, { outputMin: value })}
                />
              </label>
              <label className="number-field">
                <span>{t("editor.mapping.outputMaxLabel", { unit: outputUnit })}</span>
                <NumberInput
                  label={t("editor.mapping.outputMaxAria")}
                  value={mapping.outputMax}
                  disabled={disabled}
                  onChange={(value) => update(mapping.key, { outputMax: value })}
                />
              </label>
            </div>
            <div className="two-fields">
              <label className="select-field">
                <span>{t("editor.mapping.interpolationLabel")}</span>
                <select
                  aria-label={t("editor.mapping.interpolationAria")}
                  value={mapping.interpolation}
                  disabled={disabled}
                  onChange={(event) =>
                    update(mapping.key, {
                      interpolation: event.target.value as SoundParameterMapping["interpolation"],
                    })
                  }
                >
                  <option value="linear">{t("editor.mapping.interpolation.linear")}</option>
                  <option value="step">{t("editor.mapping.interpolation.step")}</option>
                </select>
              </label>
              <label className="number-field">
                <span>{t("editor.mapping.smoothingLabel")}</span>
                <NumberInput
                  label={t("editor.mapping.smoothingAria")}
                  value={mapping.smoothingSeconds}
                  disabled={disabled}
                  min={mappingNumberLimits.smoothingSeconds.minimum}
                  max={mappingNumberLimits.smoothingSeconds.maximum}
                  step={0.01}
                  onChange={(value) => update(mapping.key, { smoothingSeconds: value })}
                />
              </label>
            </div>
            <p className="micro-copy">{t("editor.mapping.clampHelp", { zero: n(0) })}</p>
            {canonical ? (
              <CurveChart mapping={canonical} />
            ) : (
              <p className="inline-error">{t("editor.mapping.previewUnavailable")}</p>
            )}
            {canonical && (
              <p className="mapping-midpoint">
                <output aria-label={t("editor.mapping.midpointAria")}>
                  {t("editor.mapping.midpointValue", {
                    input: displayNumber(
                      canonical.inputMin + (canonical.inputMax - canonical.inputMin) / 2,
                    ),
                    inputUnit,
                    output: n(
                      mapParameter(
                        canonical,
                        canonical.inputMin + (canonical.inputMax - canonical.inputMin) / 2,
                      ),
                      { maximumFractionDigits: 6 },
                    ),
                    outputUnit,
                  })}
                </output>
                <span className="micro-copy">{t("editor.mapping.midpointHelp")}</span>
              </p>
            )}
            <p className="micro-copy">
              {t("editor.mapping.rangeSummary", {
                inputLabel: t(inputLabelKeys[mapping.input]),
                inputMin: displayDraftNumber(mapping.inputMin),
                inputMax: displayDraftNumber(mapping.inputMax),
                inputUnit,
                outputLabel: t(targetLabelKeys[mapping.target]),
                outputMin: displayDraftNumber(mapping.outputMin),
                outputMax: displayDraftNumber(mapping.outputMax),
                outputUnit,
              })}
            </p>
            <table className="data-table mapping-point-table">
              <caption>{t("editor.mapping.pointsCaption", { zero: n(0), one: n(1) })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("editor.mapping.pointColumn")}</th>
                  <th scope="col">{t("editor.mapping.axisX")}</th>
                  <th scope="col">{t("editor.mapping.axisY")}</th>
                  <th scope="col">{t("editor.mapping.actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {mapping.curve.map((p, index) => (
                  <tr key={p.key}>
                    <th scope="row">{n(index + 1)}</th>
                    <td>
                      <NumberInput
                        label={t("editor.mapping.pointXAria", { index: n(index + 1) })}
                        value={p.x}
                        disabled={disabled}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          update(mapping.key, {
                            curve: mapping.curve.map((entry) =>
                              entry.key === p.key ? { ...entry, x: value } : entry,
                            ),
                          })
                        }
                      />
                    </td>
                    <td>
                      <NumberInput
                        label={t("editor.mapping.pointYAria", { index: n(index + 1) })}
                        value={p.y}
                        disabled={disabled}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          update(mapping.key, {
                            curve: mapping.curve.map((entry) =>
                              entry.key === p.key ? { ...entry, y: value } : entry,
                            ),
                          })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={t("editor.mapping.removePointAria", { index: n(index + 1) })}
                        disabled={
                          disabled ||
                          mapping.curve.length <= MIN_CURVE_POINTS ||
                          index === 0 ||
                          index === mapping.curve.length - 1
                        }
                        onClick={() =>
                          update(mapping.key, {
                            curve: mapping.curve.filter((entry) => entry.key !== p.key),
                          })
                        }
                      >
                        {t("editor.mapping.removePoint")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              disabled={disabled || !canonical || mapping.curve.length >= MAX_CURVE_POINTS}
              title={
                canonical
                  ? t("editor.mapping.pointLimit", { count: n(MAX_CURVE_POINTS) })
                  : t("editor.mapping.fixCurveFirst")
              }
              onClick={() => update(mapping.key, { curve: insertCurvePoint(mapping).curve })}
            >
              {t("editor.mapping.addPoint")}
            </button>
          </article>
        );
      })}
      {validation.errors.length > 0 && (
        <ul className="inline-error" role="alert">
          {validation.errors.map((error) => (
            <li key={error}>{message(error)}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={disabled || !available || state.mappings.length >= MAX_MAPPINGS}
        onClick={() => onChange(appendMapping(state))}
      >
        {t("editor.mapping.addMapping")}
      </button>
      <p className="micro-copy">
        {t("editor.mapping.countHelp", {
          count: n(state.mappings.length),
          maximum: n(MAX_MAPPINGS),
        })}
      </p>
    </section>
  );
}
