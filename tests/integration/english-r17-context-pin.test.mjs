import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  classifyArtifactMarkdown,
  inspectDocumentationSources,
  validateEnglishDocs,
} from "../../scripts/validation/english-docs.mjs";

const source =
  "artifacts/v1/r17-vacuum-browser-red-20261029/proofs/linked-workflow-v2-real-un-56281-rics-with-its-actual-reason/error-context.md";
const receipt = "artifacts/v1/r17-vacuum-browser-red-20261029/run-results.json";
const verification = "artifacts/v1/r17-vacuum-browser-red-20261029/verification.json";
const sourceHash = "1d3913f2f6936b79e1454d9a447168fda0eca56bebfca584ec51337791040fd6";
const receiptHash = "39c3eb58998927a802c4bc6db25f9c725e6bc1ab8bcb684bebf22ef98c95d3d5";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const originalSource = fs.readFileSync(path.resolve(source));
const originalReceipt = fs.readFileSync(path.resolve(receipt));

function put(root, file, bytes) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), bytes);
}
function fixture({ context = originalSource, report = originalReceipt, file = source } = {}) {
  const parent = path.resolve(".cache/v1/r17-english-pin-sol-20261029/fixtures");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "case-"));
  put(root, file, context);
  if (report !== null) put(root, receipt, report);
  return root;
}
function assertAuthored(root, file = source, pinned = true) {
  const result = inspectDocumentationSources(root, [file]);
  assert.equal(result.excluded_shared_raw.length, 0);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].artifact_role, "project_authored_artifact_narrative");
  assert.equal(result.sources[0].kind, "translation_required");
  if (pinned)
    assert.equal(
      result.sources[0].classification_error?.code,
      "IMMUTABLE_GENERATED_CONTEXT_PIN_MISMATCH",
    );
  const checked = validateEnglishDocs(root, { sourcePaths: [file] });
  assert.equal(checked.status, "INCOMPLETE");
  assert.ok(checked.entries[0].errors.some((error) => error.code === "MISSING_TRANSLATION"));
}

test("R17 source and report are the unchanged actual ready !== unavailable browser failure", () => {
  assert.equal(hash(originalSource), sourceHash);
  assert.equal(hash(originalReceipt), receiptHash);
  const captureBytes = fs.readFileSync(path.resolve(verification));
  assert.equal(
    hash(captureBytes),
    "83e43b7c17f73f2d9421cffca488285fac669b7c0971ecbe4de955b8893877aa",
  );
  const capture = JSON.parse(captureBytes);
  assert.equal(capture.result.exit_code, 1);
  assert.equal(capture.result.spawn_error, null);
  assert.equal(capture.sourceStable, true);
  assert.match(capture.result.stdout, /Expected: "unavailable"\s+Received: "ready"/);
  const report = JSON.parse(originalReceipt);
  assert.equal(report.stats.unexpected, 1);
  const failure = report.suites[0].specs[0].tests[0].results[0];
  assert.equal(failure.status, "failed");
  const attachment = failure.attachments.find((item) => item.name === "error-context");
  assert.equal(attachment.contentType, "text/markdown");
  assert.ok(attachment.path.replace(/\\/g, "/").endsWith(`/${source}`));
  assert.match(originalSource.toString("utf8"), /Expected: "unavailable"\r?\nReceived: "ready"/);
});

test("only the exact R17 context and report pair is shared raw browser evidence", () => {
  const root = fixture();
  const classification = classifyArtifactMarkdown(root, source, originalSource);
  assert.equal(classification.classification, "shared_raw_generated_browser_context");
  assert.equal(classification.confirmation, "REGISTERED_GENERATED_CONTEXT_AND_RECEIPT_PIN_MATCH");
  assert.deepEqual(classification.evidence, { path: receipt, sha256: receiptHash });
  const result = inspectDocumentationSources(root, [source]);
  assert.equal(result.sources.length, 0);
  assert.equal(result.excluded_shared_raw.length, 1);
  assert.equal(result.excluded_shared_raw[0].source_sha256, sourceHash);
  assert.equal(validateEnglishDocs(root, { sourcePaths: [source] }).status, "PASS");
});

test("changed R17 context bytes and appended authored prose remain in English scope", () => {
  for (const context of [
    originalSource.toString("utf8").replace('Received: "ready"', 'Received: "changed"'),
    `${originalSource}\n## Authored follow-up\n\n新撰分析仍須翻譯。\n`,
  ])
    assertAuthored(fixture({ context }));
});

test("missing R17 report cannot exempt the captured context", () => {
  assertAuthored(fixture({ report: null }));
});

test("changed R17 report bytes fail even when its recorded attachment is retained", () => {
  assertAuthored(fixture({ report: Buffer.concat([originalReceipt, Buffer.from("\n")]) }));
});

test("R17 report with a changed attachment or missing suite structure cannot exempt context", () => {
  const changedAttachment = JSON.parse(originalReceipt);
  const attachments = changedAttachment.suites[0].specs[0].tests[0].results[0].attachments;
  attachments.find((item) => item.name === "error-context").path = "unrelated/error-context.md";
  assertAuthored(fixture({ report: JSON.stringify(changedAttachment) }));
  const missingSuites = JSON.parse(originalReceipt);
  delete missingSuites.suites;
  assertAuthored(fixture({ report: JSON.stringify(missingSuites) }));
});

test("identical R17 capture at a moved proofs path has no raw-evidence exemption", () => {
  const file = source.replace("/proofs/", "/proofs/moved/");
  assertAuthored(fixture({ file }), file, false);
});

test("the R17 exact pin never hides adjacent authored artifact Markdown", () => {
  const root = fixture();
  const adjacent = source.replace("error-context.md", "analysis.md");
  put(root, adjacent, "# 新撰分析\n\n仍須完整英譯。\n");
  assertAuthored(root, adjacent, false);
});
