import assert from "node:assert/strict";
import test from "node:test";
import { decideNumberFieldCommit } from "./number-field-policy.js";

test("ordinary blur and explicit Enter commit a changed finite value without altering its draft", () => {
  const draft = Object.freeze({ raw: "0.375", dirty: true, min: 0, max: 1 });
  for (const trigger of [
    { type: "blur", intent: "other" },
    { type: "enter", isComposing: false },
  ] as const)
    assert.deepEqual(decideNumberFieldCommit(draft, trigger), { kind: "commit", value: 0.375 });
  assert.equal(draft.raw, "0.375");
  assert.equal(draft.dirty, true);
});

test("language-control blur retains both valid and invalid raw edits until a field commit", () => {
  const valid = Object.freeze({ raw: "0.375", dirty: true, min: 0, max: 1 });
  const invalid = Object.freeze({ raw: "2", dirty: true, min: 0, max: 1 });
  for (const draft of [valid, invalid])
    assert.deepEqual(decideNumberFieldCommit(draft, { type: "blur", intent: "locale" }), {
      kind: "retain",
    });
  assert.deepEqual(decideNumberFieldCommit(valid, { type: "enter", isComposing: false }), {
    kind: "commit",
    value: 0.375,
  });
  assert.deepEqual(decideNumberFieldCommit(invalid, { type: "blur", intent: "other" }), {
    kind: "invalid",
  });
  assert.equal(invalid.raw, "2");
});

test("empty, nonfinite and out-of-range edits cannot become committed scene values", () => {
  for (const raw of ["", " ", "NaN", "Infinity", "-Infinity", "-0.001", "1.001"])
    assert.deepEqual(
      decideNumberFieldCommit(
        { raw, dirty: true, min: 0, max: 1 },
        { type: "enter", isComposing: false },
      ),
      { kind: "invalid" },
      raw,
    );
  for (const raw of ["0", "1"])
    assert.deepEqual(
      decideNumberFieldCommit(
        { raw, dirty: true, min: 0, max: 1 },
        { type: "blur", intent: "other" },
      ),
      { kind: "commit", value: Number(raw) },
    );
});

test("unchanged fields and IME Enter retain the raw edit without committing or replacing its error", () => {
  assert.deepEqual(
    decideNumberFieldCommit({ raw: "0.5", dirty: false }, { type: "blur", intent: "other" }),
    { kind: "retain" },
  );
  assert.deepEqual(
    decideNumberFieldCommit(
      { raw: "2", dirty: true, min: 0, max: 1 },
      { type: "enter", isComposing: true },
    ),
    { kind: "retain" },
  );
});
