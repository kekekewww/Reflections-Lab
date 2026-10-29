import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { snapshotValidationInputs } from "../../scripts/validation/source-snapshot.mjs";

function fixture(work) {
  const base = path.resolve(tmpdir());
  const prefix = "reflection-lab-root-readme-snapshot-";
  const root = mkdtempSync(path.join(base, prefix));
  const write = (name, bytes = name) => {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), bytes);
  };
  for (const name of [
    "src",
    "server",
    "scripts",
    "schemas",
    "tests",
    "prompts",
    "examples",
    "benchmarks/fixtures",
    "benchmarks/analytic",
    "benchmarks/muse",
    "experiments",
    "third_party",
    ".agents",
    "docs",
    "knowledge",
    "research",
    ".github",
  ])
    mkdirSync(path.join(root, name), { recursive: true });
  for (const name of [
    "AGENTS.md",
    "index.html",
    ".node-version",
    ".prettierrc.json",
    ".prettierignore",
    "eslint.config.mjs",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "playwright.config.ts",
  ])
    write(name);
  try {
    work({ root, write });
  } finally {
    assert.equal(path.dirname(path.resolve(root)), base);
    assert.ok(path.basename(root).startsWith(prefix), "remove only this test's mkdtemp root");
    rmSync(root, { recursive: true, force: true });
  }
}

test("snapshot fixtures without optional root READMEs still work", () => {
  fixture(({ root, write }) => {
    const initial = snapshotValidationInputs(root);
    assert.ok(initial.some((entry) => entry.path === "AGENTS.md"));
    assert.ok(!initial.some((entry) => /^README(?:\.en)?\.md$/u.test(entry.path)));
    write("README.txt", "unrelated root file");
    assert.deepEqual(snapshotValidationInputs(root), initial);
  });
});

test("both root READMEs have exact raw-byte hashes and unique sorted paths", () => {
  fixture(({ root, write }) => {
    write("README.md", "hello\n");
    write("README.en.md", "abc");
    write("docs/README.md", "nested documentation");
    const snapshot = snapshotValidationInputs(root);
    const paths = snapshot.map((entry) => entry.path);
    assert.deepEqual(paths, [...new Set(paths)].sort());
    assert.equal(
      snapshot.find((entry) => entry.path === "README.md")?.sha256,
      "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
    );
    assert.equal(
      snapshot.find((entry) => entry.path === "README.en.md")?.sha256,
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    assert.ok(paths.includes("docs/README.md"), "nested documentation remains a separate input");
  });
});

for (const name of ["README.md", "README.en.md"]) {
  test(name + " byte edits and deletion invalidate the validation stamp", () => {
    fixture(({ root, write }) => {
      write(name, "hello\n");
      const initial = snapshotValidationInputs(root);
      write(name, "hello\r\n");
      assert.notDeepEqual(snapshotValidationInputs(root), initial, "line-ending bytes matter");
      write(name, "hello\n");
      assert.deepEqual(snapshotValidationInputs(root), initial);
      rmSync(path.join(root, name));
      const removed = snapshotValidationInputs(root);
      assert.notDeepEqual(
        removed,
        initial,
        "removing a previously captured README must be detected",
      );
      assert.ok(!removed.some((entry) => entry.path === name));
    });
  });
}

test("adding either root README after an initial capture invalidates the stamp", () => {
  fixture(({ root, write }) => {
    const initial = snapshotValidationInputs(root);
    for (const name of ["README.md", "README.en.md"]) {
      write(name, "new documentation");
      const added = snapshotValidationInputs(root);
      assert.notDeepEqual(added, initial);
      assert.ok(added.some((entry) => entry.path === name));
      rmSync(path.join(root, name));
      assert.deepEqual(snapshotValidationInputs(root), initial);
    }
  });
});
