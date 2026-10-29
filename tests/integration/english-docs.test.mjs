import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  inventory,
  inspectDocumentationSources,
  classifyArtifactMarkdown,
  rewriteLinks,
  validateEnglishDocs,
} from "../../scripts/validation/english-docs.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
function put(root, file, contents) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), contents);
}
function fixture() {
  const parent = path.resolve(".cache/docs-en/tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "case-"));
  fs.mkdirSync(path.join(root, "docs/en"), { recursive: true });
  const source = "# 限制\n\nusedPercent ≥100\n\nRLAB-TASK-0006\n\n```js\nconst value = 1;\n```\n";
  fs.writeFileSync(path.join(root, "docs/topic.md"), source);
  return {
    root,
    source,
    write(
      body = "# Limits\n\nusedPercent ≥100\n\nRLAB-TASK-0006\n\n```js\nconst value = 1;\n```\n",
      sha256 = hash(source),
    ) {
      fs.writeFileSync(
        path.join(root, "docs/en/topic.md"),
        `<!-- english-source: ${JSON.stringify({ path: "docs/topic.md", sha256, translated_at: "2026-10-27T00:00:00.000Z", executor: "Codex", model_id: null, links: "source-relative" })} -->\n` +
          body,
      );
    },
  };
}
test("documentation inventory excludes generated mirrors and shared non-Markdown data", () => {
  const f = fixture();
  f.write();
  fs.writeFileSync(path.join(f.root, "docs/en/generated.md"), "# Generated\n");
  fs.writeFileSync(path.join(f.root, "docs/task.json"), "{}");
  assert.deepEqual(
    inventory(f.root).map((e) => e.source),
    ["docs/topic.md"],
  );
});
test("missing and stale translations cannot pass coverage", () => {
  const f = fixture();
  assert.equal(validateEnglishDocs(f.root).entries[0].errors[0].code, "MISSING_TRANSLATION");
  f.write(undefined, "0".repeat(64));
  assert.ok(validateEnglishDocs(f.root).entries[0].errors.some((e) => e.code === "SOURCE_CHANGED"));
});
test("lost quota comparison operators and modified code are rejected", () => {
  const f = fixture();
  f.write("# Limits\n\nusedPercent ?100\n\nRLAB-TASK-0006\n\n```js\nconst value = 2;\n```\n");
  const errors = validateEnglishDocs(f.root).entries[0].errors.map((e) => e.code);
  assert.ok(errors.includes("TECHNICAL_RELATION_CHANGED"));
  assert.ok(errors.includes("VERBATIM_CODE_CHANGED"));
});
test("link rewriting uses English Markdown, shares raw results, and leaves code unchanged", () => {
  const mapping = new Map([
    ["docs/a.md", "docs/en/a.md"],
    ["docs/b.md", "docs/en/b.md"],
  ]);
  const text = "[B](b.md#原標題) [data](../results/x.json)\n\n```md\n[B](b.md)\n```\n";
  const result = rewriteLinks(text, "docs/a.md", "docs/en/a.md", mapping);
  assert.equal(result, "[B](b.md#原標題) [data](../../results/x.json)\n\n```md\n[B](b.md)\n```\n");
  assert.equal(rewriteLinks(result, "docs/a.md", "docs/en/a.md", mapping, true), result);
});
test("recorded English hashes detect prose tampering and check mode does not write files", () => {
  const f = fixture();
  f.write();
  const finalized = validateEnglishDocs(f.root, { finalize: true });
  assert.equal(finalized.status, "PASS");
  const manifest = fs.readFileSync(path.join(f.root, "docs/en/manifest.json"));
  assert.equal(validateEnglishDocs(f.root, { verifyRecorded: true }).status, "PASS");
  const target = path.join(f.root, "docs/en/topic.md");
  fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("# Limits", "# Altered limits"));
  const checked = validateEnglishDocs(f.root, { verifyRecorded: true });
  assert.ok(checked.entries[0].errors.some((e) => e.code === "TRANSLATION_HASH_CHANGED"));
  assert.ok(fs.readFileSync(path.join(f.root, "docs/en/manifest.json")).equals(manifest));
});
test("an English README companion must contain the complete original sections", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.root, "README.md"), "# 專案\n\n## 操作\n");
  fs.writeFileSync(path.join(f.root, "README.en.md"), "# Overview only\n");
  const entry = validateEnglishDocs(f.root).entries.find((e) => e.source === "README.md");
  assert.ok(entry.errors.some((e) => e.code === "INVALID_TRANSLATION_PROVENANCE"));
});
test("repeated finalization is idempotent for translated pages and shared-data links", () => {
  const f = fixture();
  f.write();
  validateEnglishDocs(f.root, { finalize: true });
  const before = fs.readFileSync(path.join(f.root, "docs/en/topic.md"));
  validateEnglishDocs(f.root, { finalize: true });
  assert.ok(fs.readFileSync(path.join(f.root, "docs/en/topic.md")).equals(before));
});
test("inline technical examples are preserved while backtick-labelled navigation is rewritten", () => {
  const mapping = new Map([
    ["docs/a.md", "docs/en/a.md"],
    ["docs/b.md", "docs/en/b.md"],
  ]);
  const body = "`[example](../data/fixture.json)` and [the `data`](../data/fixture.json)\n";
  assert.equal(
    rewriteLinks(body, "docs/a.md", "docs/en/a.md", mapping),
    "`[example](../data/fixture.json)` and [the `data`](../../data/fixture.json)\n",
  );
});
test("untranslated Chinese prose cannot pass by retaining a valid provenance marker", () => {
  const f = fixture();
  f.write(f.source);
  assert.ok(
    validateEnglishDocs(f.root).entries[0].errors.some(
      (e) => e.code === "HAN_PROSE_REQUIRES_REVIEW",
    ),
  );
});
test("Windows separators and percent-encoded separators cannot validate an outside-workspace link", () => {
  const f = fixture();
  f.write(
    "# Limits\n\nusedPercent ≥100\n\nRLAB-TASK-0006\n\n[unsafe](..%5c..%5c..%5coutside.md)\n\n```js\nconst value = 1;\n```\n",
  );
  fs.writeFileSync(path.join(path.dirname(f.root), "outside.md"), "# Outside fixture\n");
  assert.ok(
    validateEnglishDocs(f.root).entries[0].errors.some((e) => e.code === "LINK_OUTSIDE_WORKSPACE"),
  );
});
test("an .en.md filename cannot exempt untranslated prose from coverage", () => {
  const f = fixture();
  f.write();
  fs.writeFileSync(path.join(f.root, "docs/fake.en.md"), "# 中文\n");
  const entry = validateEnglishDocs(f.root).entries.find((e) => e.source === "docs/fake.en.md");
  assert.ok(entry.errors.some((e) => e.code === "HAN_PROSE_REQUIRES_REVIEW"));
});
test("encoded filenames keep spaces and hash characters inside the path", () => {
  const mapping = new Map([["docs/a.md", "docs/en/a.md"]]);
  assert.equal(
    rewriteLinks("[data](../results/a%20b%23c.json)", "docs/a.md", "docs/en/a.md", mapping),
    "[data](../../results/a%20b%23c.json)",
  );
});
test("escaped or mismatched backtick runs do not hide actual navigation", () => {
  const mapping = new Map([["docs/a.md", "docs/en/a.md"]]);
  for (const body of ["\\`[data](../results/a.json)\\`", "``[data](../results/a.json)```"]) {
    assert.ok(
      rewriteLinks(body, "docs/a.md", "docs/en/a.md", mapping).includes("../../results/a.json"),
    );
  }
});
test("unsupported nested image-link destinations cannot silently pass coverage", () => {
  const f = fixture();
  const text = f.source + "\n[![badge](../../assets/logo.png)](missing.md)\n";
  fs.writeFileSync(path.join(f.root, "docs/topic.md"), text);
  fs.mkdirSync(path.join(f.root, "assets"), { recursive: true });
  fs.writeFileSync(path.join(f.root, "assets/logo.png"), "fixture");
  f.write(text.replace("# 限制", "# Limits"), hash(text));
  assert.ok(
    validateEnglishDocs(f.root).entries[0].errors.some(
      (e) => e.code === "UNSUPPORTED_LOCAL_LINK_SYNTAX",
    ),
  );
});

test("authored artifact narratives require English coverage even inside snapshot-named directories", () => {
  const f = fixture();
  f.write();
  put(f.root, "artifacts/v1/report/README.md", "# 執行結果\n\n此結果仍待驗證。\n");
  put(f.root, "artifacts/v1/report/source-before/analysis.md", "# 新撰分析\n");
  const result = validateEnglishDocs(f.root);
  const artifacts = result.entries.filter((e) => e.source.startsWith("artifacts/"));
  assert.equal(artifacts.length, 2);
  assert.ok(artifacts.every((e) => e.artifact_role === "project_authored_artifact_narrative"));
  assert.ok(artifacts.every((e) => e.errors.some((x) => x.code === "MISSING_TRANSLATION")));
  assert.equal(result.summary.shared_raw_evidence, 0);
});

test("only exact source-copy bytes or independently pinned capture bytes are shared raw", () => {
  const f = fixture();
  const canonical = "# Captured contract\n";
  put(f.root, "docs/reference.md", canonical);
  put(f.root, "artifacts/v1/capture/source-before/docs/reference.md", canonical);
  let result = inspectDocumentationSources(f.root);
  assert.equal(result.excluded_shared_raw.length, 1);
  assert.equal(result.excluded_shared_raw[0].confirmation, "CURRENT_CANONICAL_BYTES_MATCH");
  put(f.root, "docs/reference.md", "# Contract has since changed\n");
  assert.equal(inspectDocumentationSources(f.root).excluded_shared_raw.length, 0);
  put(
    f.root,
    "artifacts/v1/capture/before.json",
    JSON.stringify({ sources: [{ path: "docs/reference.md", sha256: hash(canonical) }] }),
  );
  result = inspectDocumentationSources(f.root);
  assert.equal(result.excluded_shared_raw.length, 1);
  assert.equal(result.excluded_shared_raw[0].confirmation, "PINNED_CAPTURE_HASH_MATCH");
  assert.equal(result.excluded_shared_raw[0].source_sha256, hash(canonical));
  assert.equal(result.excluded_shared_raw[0].canonical_source, "docs/reference.md");
  assert.equal(result.excluded_shared_raw[0].evidence.path, "artifacts/v1/capture/before.json");
});

const generatedContext =
  "# Instructions\n\n- Following Playwright test failed.\n\n# Test info\n\nA captured failure\n\n# Error details\n\nAssertion failed\n\n# Page snapshot\n\n```yaml\n- button: Example\n```\n\n# Test source\n\n```ts\nexpect(result).toBe(true);\n```\n";
function browserEvidence(root, context = generatedContext) {
  const source = "artifacts/v1/browser/cases/case/error-context.md";
  put(root, source, context);
  put(
    root,
    "artifacts/v1/browser/results.json",
    JSON.stringify({
      suites: [],
      stats: {},
      attachments: [
        {
          name: "error-context",
          contentType: "text/markdown",
          path: "/captured/cases/case/error-context.md",
        },
      ],
    }),
  );
  return source;
}
test("generated failure contexts require both standard structure and a recorded attachment", () => {
  const f = fixture();
  const source = browserEvidence(f.root);
  assert.equal(
    inspectDocumentationSources(f.root).excluded_shared_raw[0].classification,
    "shared_raw_generated_browser_context",
  );
  put(
    f.root,
    "artifacts/v1/browser/results.json",
    JSON.stringify({ suites: [], stats: {}, attachments: [] }),
  );
  assert.ok(inventory(f.root).some((e) => e.source === source));
  browserEvidence(f.root, generatedContext + "\n# Authored follow-up\n\nA project report.\n");
  assert.ok(inventory(f.root).some((e) => e.source === source));
  assert.equal(inspectDocumentationSources(f.root).excluded_shared_raw.length, 0);
});

test("authored lower-level headings and prose after generated source remain in English scope", () => {
  const f = fixture();
  for (const appendix of [
    "\n## Authored project analysis\n\n這是新撰的報告。\n",
    "\n這是未使用標題的新撰報告。\n",
  ]) {
    const source = browserEvidence(f.root, generatedContext + appendix);
    const result = inspectDocumentationSources(f.root);
    assert.equal(result.excluded_shared_raw.length, 0);
    assert.ok(result.sources.some((e) => e.source === source && e.kind === "translation_required"));
  }
});

test("raw evidence bytes and capture evidence hashes remain checked after finalization", () => {
  const f = fixture();
  f.write();
  const source = browserEvidence(f.root);
  const finalized = validateEnglishDocs(f.root, { finalize: true });
  assert.equal(finalized.status, "PASS");
  assert.equal(finalized.summary.shared_raw_evidence, 1);
  assert.equal(finalized.summary.markdown_files_inventoried, finalized.summary.originals + 1);
  assert.equal(validateEnglishDocs(f.root, { verifyRecorded: true }).status, "PASS");
  put(f.root, source, generatedContext.replace("A captured failure", "Different captured bytes"));
  assert.ok(
    validateEnglishDocs(f.root, { verifyRecorded: true }).global_errors.some(
      (e) => e.code === "RAW_EVIDENCE_OR_CLASSIFICATION_CHANGED",
    ),
  );
  browserEvidence(f.root);
  put(
    f.root,
    "artifacts/v1/browser/results.json",
    fs.readFileSync(path.join(f.root, "artifacts/v1/browser/results.json"), "utf8") + "\n",
  );
  assert.ok(
    validateEnglishDocs(f.root, { verifyRecorded: true }).global_errors.some(
      (e) => e.code === "RAW_EVIDENCE_OR_CLASSIFICATION_CHANGED",
    ),
  );
});

test("new raw evidence and reclassified evidence cannot silently leave the recorded inventory", () => {
  const f = fixture();
  f.write();
  validateEnglishDocs(f.root, { finalize: true });
  const source = browserEvidence(f.root);
  assert.ok(
    validateEnglishDocs(f.root, { verifyRecorded: true }).global_errors.some(
      (e) => e.code === "RAW_EVIDENCE_NOT_IN_MANIFEST",
    ),
  );
  validateEnglishDocs(f.root, { finalize: true });
  put(f.root, source, "# Authored replacement\n\nThis is a project narrative.\n");
  const result = validateEnglishDocs(f.root, { verifyRecorded: true });
  assert.ok(
    result.global_errors.some((e) => e.code === "MANIFEST_RAW_EVIDENCE_REMOVED_OR_RECLASSIFIED"),
  );
  assert.ok(
    result.entries
      .find((e) => e.source === source)
      .errors.some((e) => e.code === "SOURCE_NOT_IN_MANIFEST"),
  );
});

test("Git inventory includes unignored and tracked artifact narratives without reading ignored private Markdown", () => {
  const f = fixture();
  put(f.root, ".gitignore", "private/\nartifacts/ignored/\n");
  put(f.root, "private/key-notes.md", "# Private fixture\n");
  put(f.root, "artifacts/unignored/README.md", "# Authored narrative\n");
  put(f.root, "artifacts/ignored/README.md", "# Tracked narrative\n");
  const options = { cwd: f.root, windowsHide: true, stdio: "pipe", timeout: 10000 };
  execFileSync("git", ["init", "-q"], options);
  execFileSync("git", ["add", "-f", "artifacts/ignored/README.md"], options);
  const result = inventory(f.root).map((e) => e.source);
  assert.ok(result.includes("artifacts/unignored/README.md"));
  assert.ok(result.includes("artifacts/ignored/README.md"));
  assert.ok(!result.includes("private/key-notes.md"));
});

const preparedCopies = [
  [
    "artifacts/v1/audio-prepared-static-v2-preflight-20261027153307199/prepared-static-v2",
    "build-spec.json",
  ],
  [
    "artifacts/v1/audio-prepared-static-v2-preflight-20261027153418936/prepared-static-v2",
    "manifest.json",
  ],
  [
    "artifacts/v1/audio-prefix-native25-preflight-20261027172830/prepared-static-v2",
    "manifest.json",
  ],
];
function preparedFixture(root, index = 0, receipt = true) {
  const [directory, filename] = preparedCopies[index];
  const canonical = "tests/audio-runtime/CROSS_ENGINE.md";
  const source = `${directory}/sources/${canonical}`;
  const evidence = `${directory}/${filename}`;
  const bytes = fs.readFileSync(path.resolve(source));
  put(root, source, bytes);
  put(root, canonical, "# A newer canonical document\n");
  if (receipt) put(root, evidence, fs.readFileSync(path.resolve(evidence)));
  return { source, canonical, evidence, bytes, directory };
}
for (let i = 0; i < preparedCopies.length; i++) {
  test(`prepared source receipt ${i + 1} remains raw after canonical changes`, () => {
    const f = fixture(),
      capture = preparedFixture(f.root, i);
    const result = inspectDocumentationSources(f.root, [capture.source]);
    assert.equal(result.sources.length, 0);
    assert.equal(result.excluded_shared_raw.length, 1);
    const raw = result.excluded_shared_raw[0];
    assert.equal(raw.confirmation, "REGISTERED_PREPARED_SOURCE_MAP_PIN_MATCH");
    assert.equal(
      raw.source_sha256,
      "442e12e66bd5b2388af72f3d8d0447a6ba0eafa3c0bf6c7748ac61f785f5b847",
    );
    assert.equal(raw.evidence.path, capture.evidence);
    assert.match(raw.reason, /does not imply.*passed/);
  });
}
test("prepared source pins reject altered copied bytes before the canonical shortcut", () => {
  const f = fixture(),
    capture = preparedFixture(f.root);
  put(f.root, capture.source, "# Tampered captured bytes\n");
  put(f.root, capture.canonical, "# Tampered captured bytes\n");
  const classification = classifyArtifactMarkdown(
    f.root,
    capture.source,
    fs.readFileSync(path.join(f.root, capture.source)),
  );
  assert.equal(classification.classification, "project_authored_artifact_narrative");
  assert.equal(classification.classification_error.code, "IMMUTABLE_SOURCE_SNAPSHOT_PIN_MISMATCH");
  const result = validateEnglishDocs(f.root, { sourcePaths: [capture.source] });
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.excluded_shared_raw.length, 0);
  assert.ok(
    result.entries[0].errors.some((e) => e.code === "IMMUTABLE_SOURCE_SNAPSHOT_PIN_MISMATCH"),
  );
});
test("prepared source pins reject changed receipt bytes despite matching canonical bytes", () => {
  const f = fixture(),
    capture = preparedFixture(f.root, 1);
  put(f.root, capture.canonical, capture.bytes);
  const receipt = fs.readFileSync(path.join(f.root, capture.evidence));
  put(f.root, capture.evidence, Buffer.concat([receipt, Buffer.from("\n")]));
  const result = inspectDocumentationSources(f.root, [capture.source]);
  assert.equal(result.excluded_shared_raw.length, 0);
  assert.equal(
    result.sources[0].classification_error.code,
    "IMMUTABLE_SOURCE_SNAPSHOT_PIN_MISMATCH",
  );
});
test("prepared source pins require their own receipt and exact source-map key", () => {
  const f = fixture(),
    capture = preparedFixture(f.root, 2, false);
  put(f.root, capture.canonical, capture.bytes);
  assert.equal(inspectDocumentationSources(f.root, [capture.source]).excluded_shared_raw.length, 0);
  const otherReceipt = fs.readFileSync(
    path.resolve(`${preparedCopies[1][0]}/${preparedCopies[1][1]}`),
  );
  put(f.root, capture.evidence, otherReceipt);
  assert.equal(inspectDocumentationSources(f.root, [capture.source]).excluded_shared_raw.length, 0);
  const wrongKey = JSON.parse(fs.readFileSync(path.resolve(capture.evidence)));
  wrongKey.originalSources["tests/audio-runtime/unrelated.md"] =
    wrongKey.originalSources[capture.canonical];
  delete wrongKey.originalSources[capture.canonical];
  put(f.root, capture.evidence, JSON.stringify(wrongKey));
  assert.equal(inspectDocumentationSources(f.root, [capture.source]).excluded_shared_raw.length, 0);
});
test("prepared source receipt exceptions never hide adjacent authored Markdown", () => {
  const f = fixture(),
    capture = preparedFixture(f.root);
  const authored = `${capture.directory}/sources/tests/audio-runtime/analysis.md`;
  put(f.root, authored, "# 新撰專案分析\n\n仍須完整英譯。\n");
  const result = inspectDocumentationSources(f.root, [capture.source, authored]);
  assert.equal(result.excluded_shared_raw.length, 1);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].source, authored);
  assert.equal(result.sources[0].kind, "translation_required");
});
test("selected source finalization never enumerates Git or writes full corpus artifacts", () => {
  const f = fixture();
  f.write();
  fs.mkdirSync(path.join(f.root, ".git"));
  put(f.root, "docs/ignored-in-this-scope.md", "# 尚未翻譯\n");
  const sentinel = new Map([
    ["docs/en/manifest.json", '{"frozen":true}\n'],
    ["docs/en/validation.json", '{"frozen":true}\n'],
    ["docs/en/index.md", "# Frozen corpus index\n"],
  ]);
  for (const [file, text] of sentinel) put(f.root, file, text);
  const result = validateEnglishDocs(f.root, { sourcePaths: ["docs/topic.md"], finalize: true });
  assert.equal(result.status, "PASS");
  assert.equal(result.scope_complete, false);
  assert.equal(result.inventory_strategy, "explicit_source_paths_no_git_enumeration");
  assert.equal(result.entries.length, 1);
  for (const [file, text] of sentinel)
    assert.equal(fs.readFileSync(path.join(f.root, file), "utf8"), text);
});
test("selected source checks do not report unselected manifest entries removed", () => {
  const f = fixture();
  f.write();
  validateEnglishDocs(f.root, { finalize: true });
  const file = path.join(f.root, "docs/en/manifest.json"),
    manifest = JSON.parse(fs.readFileSync(file));
  manifest.entries.push({ source: "docs/not-selected.md", source_sha256: "0".repeat(64) });
  manifest.excluded_shared_raw = [
    { source: "artifacts/not-selected.md", source_sha256: "0".repeat(64) },
  ];
  fs.writeFileSync(file, JSON.stringify(manifest));
  fs.mkdirSync(path.join(f.root, ".git"));
  const result = validateEnglishDocs(f.root, {
    sourcePaths: ["docs/topic.md"],
    verifyRecorded: true,
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.scope_complete, false);
});
test("selected source paths reject escapes, aliases, duplicates and English mirrors", () => {
  const f = fixture();
  for (const sourcePaths of [
    [],
    ["../outside.md"],
    ["D:/outside.md"],
    ["docs\\topic.md"],
    ["./docs/topic.md"],
    ["docs/en/topic.md"],
    ["docs/topic.md", "docs/topic.md"],
  ])
    assert.throws(() => inspectDocumentationSources(f.root, sourcePaths));
});
