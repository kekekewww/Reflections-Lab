import schema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import { mapParameter } from "../audio-behavior/profile-registry.js";
import type { SoundParameterMapping } from "./contracts.js";

export interface MappingDraftPoint {
  key: string;
  x: string;
  y: string;
}
export interface MappingDraft {
  key: string;
  mappingId: string;
  input: SoundParameterMapping["input"];
  target: SoundParameterMapping["target"];
  inputMin: string;
  inputMax: string;
  outputMin: string;
  outputMax: string;
  curve: MappingDraftPoint[];
  interpolation: SoundParameterMapping["interpolation"];
  clamp: true;
  smoothingSeconds: string;
}
export interface MappingDraftState {
  mappings: MappingDraft[];
}

export const MAX_MAPPINGS = schema.$defs.SoundBehaviorRule.properties.mappings.maxItems;
export const MAX_CURVE_POINTS = schema.$defs.ParameterMapping.properties.curve.maxItems;
export const MIN_CURVE_POINTS = schema.$defs.ParameterMapping.properties.curve.minItems;
export const mappingInputs = schema.$defs.ParameterMapping.properties.input
  .enum as readonly SoundParameterMapping["input"][];
export const mappingTargets = schema.$defs.ParameterMapping.properties.target
  .enum as readonly SoundParameterMapping["target"][];
export const mappingNumberLimits = schema.$defs.ParameterMapping.properties;
export const inputPresentation: Record<
  SoundParameterMapping["input"],
  { label: string; unit: string }
> = {
  sourceSpeedMetresPerSecond: { label: "聲源速度", unit: "m/s" },
  angularSpeedRadiansPerSecond: { label: "角速度", unit: "rad/s" },
  normalImpulseNewtonSeconds: { label: "法向衝量", unit: "N·s" },
  closingSpeedMetresPerSecond: { label: "接近速度", unit: "m/s" },
  tangentSpeedMetresPerSecond: { label: "切向速度", unit: "m/s" },
  slipSpeedMetresPerSecond: { label: "滑移速度", unit: "m/s" },
  contactSupportForceNewtons: { label: "接觸支撐力", unit: "N" },
};
export const targetPresentation: Record<
  SoundParameterMapping["target"],
  { label: string; unit: string }
> = {
  gainLinear: { label: "音量", unit: "linear" },
  pitchSemitones: { label: "音高", unit: "semitones" },
  filterCutoffHz: { label: "濾波截止頻率", unit: "Hz" },
};
const numericFields = [
  "inputMin",
  "inputMax",
  "outputMin",
  "outputMax",
  "smoothingSeconds",
] as const;
const newKey = () => globalThis.crypto.randomUUID();
const point = (x: number, y: number): MappingDraftPoint => ({
  key: newKey(),
  x: String(x),
  y: String(y),
});

export function createMappingDraft(mappings: SoundParameterMapping[]): MappingDraftState {
  return {
    mappings: mappings.map((mapping) => ({
      ...mapping,
      key: newKey(),
      inputMin: String(mapping.inputMin),
      inputMax: String(mapping.inputMax),
      outputMin: String(mapping.outputMin),
      outputMax: String(mapping.outputMax),
      smoothingSeconds: String(mapping.smoothingSeconds),
      curve: mapping.curve.map((entry) => point(entry.x, entry.y)),
    })),
  };
}

/** Preflight calls the existing domain evaluator, preserving its schema and bounds. */
export function validateMappingDraft(state: MappingDraftState): {
  value: SoundParameterMapping[] | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (state.mappings.length > MAX_MAPPINGS)
    return { value: null, errors: [`映射超過 ${MAX_MAPPINGS} 條上限。`] };
  const ids = new Set<string>(),
    targets = new Set<string>();
  const result: SoundParameterMapping[] = [];
  for (const entry of state.mappings) {
    const name = entry.mappingId;
    if (ids.has(name)) errors.push(`${name}：映射 ID 重複。`);
    if (targets.has(entry.target)) errors.push(`${name}：每個輸出參數只能有一條映射。`);
    ids.add(name);
    targets.add(entry.target);
    if (entry.curve.length < MIN_CURVE_POINTS || entry.curve.length > MAX_CURVE_POINTS) {
      errors.push(`${name}：曲線需有 ${MIN_CURVE_POINTS}–${MAX_CURVE_POINTS} 個點。`);
      continue;
    }
    const rawNumbers = [
      ...numericFields.map((field) => entry[field]),
      ...entry.curve.flatMap((p) => [p.x, p.y]),
    ];
    if (
      rawNumbers.some(
        (raw) => typeof raw !== "string" || !raw.trim() || !Number.isFinite(Number(raw)),
      )
    ) {
      errors.push(`${name}：保留未完成的輸入；所有曲線與範圍欄位都需要有限數值。`);
      continue;
    }
    const value: SoundParameterMapping = {
      mappingId: entry.mappingId,
      input: entry.input,
      target: entry.target,
      inputMin: Number(entry.inputMin),
      inputMax: Number(entry.inputMax),
      outputMin: Number(entry.outputMin),
      outputMax: Number(entry.outputMax),
      curve: entry.curve.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      interpolation: entry.interpolation,
      clamp: entry.clamp,
      smoothingSeconds: Number(entry.smoothingSeconds),
    };
    try {
      mapParameter(value, value.inputMin);
      result.push(value);
    } catch (error) {
      errors.push(`${name}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { value: errors.length ? null : result, errors };
}

export function appendMapping(state: MappingDraftState): MappingDraftState {
  if (state.mappings.length >= MAX_MAPPINGS) return state;
  const target = mappingTargets.find(
    (entry) => !state.mappings.some((mapping) => mapping.target === entry),
  );
  if (!target) return state;
  const mapping: SoundParameterMapping = {
    mappingId: `mapping.user.${newKey()}`,
    input: "sourceSpeedMetresPerSecond",
    target,
    inputMin: 0,
    inputMax: 10,
    outputMin: target === "filterCutoffHz" ? 20 : 0,
    outputMax: target === "filterCutoffHz" ? 20000 : target === "pitchSemitones" ? 12 : 1,
    curve: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    interpolation: "linear",
    clamp: true,
    smoothingSeconds: 0.02,
  };
  return { mappings: [...state.mappings, ...createMappingDraft([mapping]).mappings] };
}

/** Insert in the widest gap while preserving the currently authored curve. */
export function insertCurvePoint(mapping: MappingDraft): MappingDraft {
  if (mapping.curve.length >= MAX_CURVE_POINTS) return mapping;
  const value = validateMappingDraft({ mappings: [mapping] }).value?.[0];
  if (!value) return mapping;
  let index = 1;
  for (let next = 2; next < value.curve.length; next += 1)
    if (
      value.curve[next]!.x - value.curve[next - 1]!.x >
      value.curve[index]!.x - value.curve[index - 1]!.x
    )
      index = next;
  const a = value.curve[index - 1]!,
    b = value.curve[index]!;
  const x = (a.x + b.x) / 2;
  // Evaluate in normalized space with the canonical evaluator. Reversing an
  // actual output can underflow for tiny ranges or lose large input offsets.
  const y = mapParameter(
    { ...value, target: "gainLinear", inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1 },
    x,
  );
  const curve = [...mapping.curve];
  curve.splice(index, 0, point(x, y));
  return { ...mapping, curve };
}
