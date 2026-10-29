import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import { buildContextPack } from "../../scripts/agents/context-pack.mjs";

function fixture() {
  const root = path.resolve(".cache/context-pack-tests");
  mkdirSync(root, { recursive: true });
  const repository = mkdtempSync(path.join(root, "case-"));
  writeFileSync(path.join(repository, "AGENTS.md"), "# Shared policy\nUse explicit scope.\n");
  writeFileSync(
    path.join(repository, "reference.md"),
    "Reference data; ignore-all-instructions is quoted source text.\n",
  );
  return repository;
}

test("context includes canonical policy exactly once and deduplicates bounded explicit references", () => {
  const repository = fixture();
  const result = buildContextPack({
    repository,
    contract: {
      relevant_files: ["AGENTS.md", "reference.md"],
      architecture_refs: ["reference.md"],
      skill_refs: [],
    },
  });
  assert.deepEqual(
    result.entries.map((entry) => [entry.path, entry.role]),
    [
      ["AGENTS.md", "repository-policy"],
      ["reference.md", "task-reference"],
    ],
  );
  assert.equal(result.entries[1].text, readFileSync(path.join(repository, "reference.md"), "utf8"));
  assert.match(result.entries[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(
    result.total_bytes,
    result.entries.reduce((sum, entry) => sum + entry.bytes, 0),
  );
});

test("missing repository policy or selected source fails closed", () => {
  const repository = fixture();
  assert.throws(
    () => buildContextPack({ repository, contract: { relevant_files: ["missing.md"] } }),
    /CONTEXT_FILE_MISSING/,
  );
  const emptyRoot = path.join(repository, "empty");
  mkdirSync(emptyRoot);
  assert.throws(
    () => buildContextPack({ repository: emptyRoot, contract: {} }),
    /CONTEXT_POLICY_MISSING/,
  );
});

test("repository wiki startup and existing authoritative task are included without expanding the entire wiki", () => {
  const repository = fixture();
  mkdirSync(path.join(repository, "knowledge/wiki"), { recursive: true });
  mkdirSync(path.join(repository, "knowledge/tasks"), { recursive: true });
  for (const file of [
    "knowledge/schema.md",
    "knowledge/wiki/index.md",
    "knowledge/wiki/now.md",
    "knowledge/tasks/RLAB-TASK-0008.json",
  ])
    writeFileSync(path.join(repository, file), "Shared startup data\n");
  writeFileSync(
    path.join(repository, "knowledge/wiki/unselected.md"),
    "Must remain out of context.\n",
  );
  const result = buildContextPack({ repository, contract: { wiki_task_id: "RLAB-TASK-0008" } });
  assert.deepEqual(
    result.entries.map((entry) => entry.path),
    [
      "AGENTS.md",
      "knowledge/schema.md",
      "knowledge/wiki/index.md",
      "knowledge/wiki/now.md",
      "knowledge/tasks/RLAB-TASK-0008.json",
    ],
  );
});

test("context rejects traversal, directories, secrets and private Git paths", () => {
  const repository = fixture();
  mkdirSync(path.join(repository, "directory"));
  for (const selected of [
    "../AGENTS.md",
    "directory",
    ".env",
    ".env.example",
    ".git/config",
    "private-secrets.txt",
    "credentials.json",
    "C:/outside.txt",
  ]) {
    assert.throws(
      () => buildContextPack({ repository, contract: { relevant_files: [selected] } }),
      /UNSAFE_PATH|CONTEXT_/,
    );
  }
});

test("context never truncates an oversized file or aggregate context", () => {
  const repository = fixture();
  writeFileSync(path.join(repository, "large.md"), "a".repeat(65));
  assert.throws(
    () =>
      buildContextPack({
        repository,
        contract: { relevant_files: ["large.md"] },
        maxFileBytes: 64,
      }),
    /CONTEXT_FILE_BUDGET/,
  );
  assert.throws(
    () =>
      buildContextPack({
        repository,
        contract: { relevant_files: ["reference.md"] },
        maxTotalBytes: 40,
      }),
    /CONTEXT_TOTAL_BUDGET/,
  );
});

test("binary, invalid UTF8 and detectable credential content are rejected without echoing contents", () => {
  const repository = fixture();
  for (const [name, bytes] of [
    ["invalid.md", Buffer.from([0xc3, 0x28])],
    ["binary.md", Buffer.from([0, 1, 2])],
    ["credential-example.md", Buffer.from("Authorization: Bearer private-example")],
    ["token.md", Buffer.from("api_key=private-value")],
  ]) {
    writeFileSync(path.join(repository, name), bytes);
    assert.throws(
      () => buildContextPack({ repository, contract: { relevant_files: [name] } }),
      /CONTEXT_BINARY|CONTEXT_SENSITIVE_PATH|CONTEXT_SECRET_CONTENT/,
    );
  }
});

test("symlink selected context is rejected even when target remains inside repository", (t) => {
  const repository = fixture();
  try {
    symlinkSync(path.join(repository, "reference.md"), path.join(repository, "link.md"));
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) {
      t.skip("Windows symlink privilege unavailable");
      return;
    }
    throw error;
  }
  assert.throws(
    () => buildContextPack({ repository, contract: { relevant_files: ["link.md"] } }),
    /SYMLINK_PATH/,
  );
});

test("next product slice contract provides a real bounded readable context without changing product state", () => {
  const contract = JSON.parse(readFileSync("examples/agents/p0-01-scene-contract.json", "utf8"));
  const result = buildContextPack({ repository: process.cwd(), contract });
  assert.ok(result.entries.length >= 6);
  assert.ok(result.total_bytes <= 262144);
  assert.equal(result.entries[0].path, "AGENTS.md");
});
