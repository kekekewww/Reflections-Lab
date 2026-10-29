import test from "node:test";
import assert from "node:assert/strict";
import type { SoundParameterMapping } from "./contracts.js";
import { mapParameter } from "../audio-behavior/profile-registry.js";
import {
  appendMapping,
  createMappingDraft,
  insertCurvePoint,
  MAX_CURVE_POINTS,
  MAX_MAPPINGS,
  validateMappingDraft,
} from "./mapping-model.js";

function mapping(patch: Partial<SoundParameterMapping> = {}): SoundParameterMapping {
  return {
    mappingId: "mapping.nonlinear",
    input: "sourceSpeedMetresPerSecond",
    target: "gainLinear",
    inputMin: 0,
    inputMax: 10,
    outputMin: 0,
    outputMax: 1,
    curve: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.2 },
      { x: 1, y: 1 },
    ],
    interpolation: "linear",
    clamp: true,
    smoothingSeconds: 0.02,
    ...patch,
  };
}

test("raw draft round-trip preserves canonical identity and nonlinear halfway output", () => {
  const original = mapping();
  const draft = createMappingDraft([original]);
  const result = validateMappingDraft(draft);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, [original]);
  assert.equal(mapParameter(result.value![0]!, 5), 0.2);
  assert.equal(mapParameter(result.value![0]!, 2.5), 0.1);
  assert.equal(mapParameter(result.value![0]!, -100), 0);
  assert.equal(mapParameter(result.value![0]!, 100), 1);
});

test("step uses the left segment before a knot and the knot value exactly at it", () => {
  const result = validateMappingDraft(createMappingDraft([mapping({ interpolation: "step" })]));
  const value = result.value![0]!;
  assert.equal(mapParameter(value, 4.999), 0);
  assert.equal(mapParameter(value, 5), 0.2);
  assert.equal(mapParameter(value, 9.999), 0.2);
  assert.equal(mapParameter(value, 10), 1);
});

test("normalized y may decrease while x remains strictly increasing", () => {
  const value = mapping({
    curve: [
      { x: 0, y: 1 },
      { x: 0.5, y: 0.2 },
      { x: 1, y: 0.8 },
    ],
  });
  assert.deepEqual(validateMappingDraft(createMappingDraft([value])).value, [value]);
});

test("incomplete or nonfinite number text is retained without mutating the last draft", () => {
  for (const raw of ["", " ", "NaN", "Infinity", "1e309"]) {
    const draft = createMappingDraft([mapping()]);
    draft.mappings[0]!.inputMax = raw;
    const before = structuredClone(draft);
    const result = validateMappingDraft(draft);
    assert.equal(result.value, null);
    assert.ok(result.errors.length > 0);
    assert.deepEqual(draft, before);
  }
});

test("domain preflight rejects bad curve order, endpoint coverage and actual target bounds", () => {
  const invalid: SoundParameterMapping[] = [
    mapping({ inputMax: 0 }),
    mapping({ outputMin: 1, outputMax: 0 }),
    mapping({ smoothingSeconds: 1.01 }),
    mapping({ outputMax: 4.01 }),
    mapping({ target: "pitchSemitones", outputMin: -24.01 }),
    mapping({ target: "filterCutoffHz", outputMin: 0, outputMax: 20000 }),
    mapping({
      curve: [
        { x: 0.1, y: 0 },
        { x: 1, y: 1 },
      ],
    }),
    mapping({
      curve: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.2 },
        { x: 0.5, y: 1 },
      ],
    }),
    mapping({
      curve: [
        { x: 0, y: -0.1 },
        { x: 1, y: 1 },
      ],
    }),
  ];
  for (const value of invalid)
    assert.equal(validateMappingDraft(createMappingDraft([value])).value, null);
});

test("mapping IDs and output targets are unique and the schema count remains bounded", () => {
  assert.equal(
    validateMappingDraft(createMappingDraft([mapping(), mapping({ mappingId: "mapping.other" })]))
      .value,
    null,
  );
  assert.equal(
    validateMappingDraft(createMappingDraft([mapping(), mapping({ target: "pitchSemitones" })]))
      .value,
    null,
  );
  const tooMany = createMappingDraft(
    Array.from({ length: MAX_MAPPINGS + 1 }, (_, index) =>
      mapping({ mappingId: `mapping.${index}` }),
    ),
  );
  assert.equal(validateMappingDraft(tooMany).value, null);
  assert.deepEqual(validateMappingDraft({ mappings: [] }), { value: [], errors: [] });
});

test("inserting points preserves existing UI keys, canonical ID and evaluated curve", () => {
  let draft = createMappingDraft([mapping()]).mappings[0]!;
  const originalKeys = draft.curve.map((point) => point.key);
  const original = mapping();
  draft = insertCurvePoint(draft);
  assert.equal(draft.mappingId, original.mappingId);
  assert.ok(originalKeys.every((key) => draft.curve.some((point) => point.key === key)));
  const value = validateMappingDraft({ mappings: [draft] }).value![0]!;
  for (const input of [0, 1, 2.5, 5, 7.5, 10])
    assert.equal(mapParameter(value, input), mapParameter(original, input));
  while (draft.curve.length < MAX_CURVE_POINTS) draft = insertCurvePoint(draft);
  assert.equal(new Set(draft.curve.map((point) => point.key)).size, MAX_CURVE_POINTS);
  assert.equal(insertCurvePoint(draft), draft);
});

test("flat output ranges remain finite when inserting an editorial point", () => {
  const original = mapping({ outputMin: 0.4, outputMax: 0.4 });
  const draft = insertCurvePoint(createMappingDraft([original]).mappings[0]!);
  const value = validateMappingDraft({ mappings: [draft] }).value![0]!;
  assert.equal(mapParameter(value, 5), 0.4);
  assert.ok(value.curve.every((point) => Number.isFinite(point.y)));
});

test("point insertion preserves normalized shape for subnormal output and large input offsets", () => {
  const curve = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  for (const original of [
    mapping({ outputMin: 0, outputMax: Number.MIN_VALUE, curve }),
    mapping({ inputMin: 1e9 - 1e-7, inputMax: 1e9, curve }),
  ]) {
    const draft = insertCurvePoint(createMappingDraft([original]).mappings[0]!);
    assert.equal(draft.curve[1]!.x, "0.5");
    assert.equal(draft.curve[1]!.y, "0.5");
    const value = validateMappingDraft({ mappings: [draft] }).value![0]!;
    for (const fraction of [0, 0.2, 0.5, 0.6, 0.8, 1]) {
      const input = original.inputMin + fraction * (original.inputMax - original.inputMin);
      assert.equal(mapParameter(value, input), mapParameter(original, input));
    }
  }
});

test("adding mappings offers only remaining targets and creates bounded valid defaults", () => {
  let draft = createMappingDraft([]);
  for (let index = 0; index < 3; index += 1) draft = appendMapping(draft);
  assert.equal(draft.mappings.length, 3);
  assert.equal(new Set(draft.mappings.map((mapping) => mapping.target)).size, 3);
  assert.equal(validateMappingDraft(draft).errors.length, 0);
  assert.equal(appendMapping(draft), draft);
});
