import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validator = fileURLToPath(new URL("../../scripts/validation/docs.mjs", import.meta.url));

function fixture(work) {
  const parent = resolve(tmpdir());
  const prefix = resolve(parent, "reflection-lab-doc-link-scope-");
  const root = mkdtempSync(prefix);
  const write = (name, bytes) => {
    const target = resolve(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  };
  const run = () => {
    const result = spawnSync(process.execPath, [validator], {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, "validator must exit within its process timeout");
    return { ...result, output: result.stdout + result.stderr };
  };
  try {
    work({ root, write, run });
  } finally {
    const target = resolve(root);
    assert.ok(
      target.startsWith(prefix) && target !== prefix && dirname(target) === parent,
      "remove only this fixture's resolved mkdtemp directory",
    );
    rmSync(target, { recursive: true, force: true });
  }
}

test(
  "raw artifact snapshots retain source-relative links and copied bytes",
  { timeout: 30000 },
  () => {
    fixture(({ root, write, run }) => {
      const original = Buffer.from("# Source\r\n\r\n[Reference](../reference.md)\r\n");
      write("docs/11-v1/ACCEPTANCE.md", original);
      write("docs/reference.md", "# Reference\n");
      const copies = [
        "artifacts/v1/run/source-before/docs/11-v1/ACCEPTANCE.md",
        "artifacts/v1/run/source-after/docs/11-v1/ACCEPTANCE.md",
        "artifacts/v1/run/sources/docs/11-v1/ACCEPTANCE.md",
        "artifacts/v1/run/tested-bundle/docs/11-v1/ACCEPTANCE.md",
      ];
      for (const name of copies) write(name, original);
      const result = run();
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /PASS Markdown local targets: 1 links in 2 documents/);
      assert.match(result.output, /raw byte snapshot/i);
      for (const name of copies) {
        assert.ok(readFileSync(resolve(root, name)).equals(original), `${name} bytes unchanged`);
        const snapshotDirectory = name.slice(0, name.indexOf("/docs/"));
        assert.ok(
          result.output.includes(snapshotDirectory),
          `${snapshotDirectory} exclusion is reported`,
        );
      }
    });
  },
);

test("a missing canonical document target fails", { timeout: 30000 }, () => {
  fixture(({ write, run }) => {
    write("docs/canonical.md", "[Missing](missing.md)\n");
    const result = run();
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /FAIL 1 missing Markdown local targets/);
    assert.match(result.output, /canonical\.md:1: missing\.md/);
  });
});

test("snapshot directory names outside root artifacts remain checked", { timeout: 30000 }, () => {
  fixture(({ write, run }) => {
    const names = [
      "docs/source-before/README.md",
      "docs/source-after/README.md",
      "docs/sources/README.md",
      "docs/tested-bundle/README.md",
      "docs/artifacts/v1/run/sources/README.md",
    ];
    for (const name of names) write(name, "[Missing](missing.md)\n");
    const result = run();
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /FAIL 5 missing Markdown local targets/);
  });
});

test(
  "artifact report READMEs and similarly named directories remain checked",
  { timeout: 30000 },
  () => {
    fixture(({ write, run }) => {
      write("artifacts/v1/run/README.md", "[Missing](missing.md)\n");
      write("artifacts/v1/run/source-before-report/README.md", "[Missing](missing.md)\n");
      const result = run();
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /FAIL 2 missing Markdown local targets/);
      assert.match(result.output, /run[/\\]README\.md:1: missing\.md/);
      assert.match(result.output, /source-before-report[/\\]README\.md:1: missing\.md/);
    });
  },
);

test("normal valid relative Markdown links pass", { timeout: 30000 }, () => {
  fixture(({ write, run }) => {
    write("docs/topic.md", "[Reference](reference.md#heading)\n[Space](<space file.md>)\n");
    write("docs/reference.md", "# Heading\n");
    write("docs/space file.md", "# Space\n");
    const result = run();
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /PASS Markdown local targets: 2 links in 3 documents/);
  });
});

test("malformed local URL encoding still fails", { timeout: 30000 }, () => {
  fixture(({ write, run }) => {
    write("docs/topic.md", "[Malformed](%ZZ.md)\n");
    const result = run();
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /malformed encoded target %ZZ\.md/);
  });
});
