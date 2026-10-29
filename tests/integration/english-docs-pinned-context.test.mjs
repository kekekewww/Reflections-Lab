import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyArtifactMarkdown } from "../../scripts/validation/english-docs.mjs";

const ui = "artifacts/v1/r13-ui-2026-10-28T085649588Z-f90bb40a";
const product = "artifacts/v1/r13-product-2026-10-28T090742166Z-935fa33e";
const files = [
  `${ui}/cases/ui-refined-v2-completed-re-cfb13--raw-RecordingArtifact-JSON/error-context.md`,
  `${ui}/cases/ui-refined-v2-project-JSON-2db83--draft-until-explicit-Apply/error-context.md`,
  `${ui}/cases/ui-refined-v2-reset-seals--88c67--replay-remains-unavailable/error-context.md`,
  `${product}/cases/product-e2e-refined-v2-a-s-2e0eb-without-activating-hardware/error-context.md`,
];
const receipt = (s) => `${s.startsWith(ui) ? ui : product}/playwright-results.json`;
const classify = (root, s) =>
  classifyArtifactMarkdown(root, s, fs.readFileSync(path.join(root, s)));
function fixture(s) {
  const parent = path.resolve(".cache/v1/r14-english-20261028");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "maintained-test-"));
  for (const f of [s, receipt(s)]) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.copyFileSync(f, path.join(root, f));
  }
  return root;
}
test("only exact registered browser contexts with their pinned reports are excluded", () => {
  for (const s of files)
    assert.equal(
      classify(".", s).confirmation,
      "REGISTERED_GENERATED_CONTEXT_AND_RECEIPT_PIN_MATCH",
    );
});
test("context and report edits or missing reports fail closed for both captures", () => {
  for (const s of [files[0], files[3]])
    for (const change of ["context", "report", "missing"]) {
      const root = fixture(s),
        r = path.join(root, receipt(s));
      if (change === "context") fs.appendFileSync(path.join(root, s), "\n## Authored analysis\n");
      if (change === "report") fs.appendFileSync(r, " ");
      if (change === "missing") fs.unlinkSync(r);
      const actual = classify(root, s);
      assert.equal(actual.classification, "project_authored_artifact_narrative");
      assert.equal(actual.classification_error.code, "IMMUTABLE_GENERATED_CONTEXT_PIN_MISMATCH");
    }
});
test("unregistered authored and copied lookalike files remain in scope", () => {
  const s = files[0],
    root = fixture(s);
  for (const other of [
    s.replace("error-context.md", "authored.md"),
    s.replace("error-context.md", "other/error-context.md"),
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, other)), { recursive: true });
    fs.copyFileSync(path.join(root, s), path.join(root, other));
    assert.equal(classify(root, other).classification, "project_authored_artifact_narrative");
  }
});

test("moving only the source path while preserving context and original report never inherits its pin", () => {
  const original = files[0],
    root = fixture(original);
  const moved = original.replace("/cases/", "/cases/moved/");
  fs.mkdirSync(path.dirname(path.join(root, moved)), { recursive: true });
  fs.copyFileSync(path.join(root, original), path.join(root, moved));
  assert.deepEqual(
    fs.readFileSync(path.join(root, moved)),
    fs.readFileSync(path.join(root, original)),
  );
  assert.deepEqual(
    fs.readFileSync(path.join(root, receipt(original))),
    fs.readFileSync(receipt(original)),
  );
  assert.equal(classify(root, moved).classification, "project_authored_artifact_narrative");
});
