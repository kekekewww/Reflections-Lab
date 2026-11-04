import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test(
  "SHA-256-named document copies keep source links only while bytes match",
  { timeout: 30000 },
  () => {
    fixture(({ write, run }) => {
      const copy = Buffer.from("# Earlier status\n\n[Contract](CONTRACT.md)\n");
      const name = `docs/history/STATUS.pre-m1.${sha(copy).slice(0, 12)}.md`;
      write(name, copy);
      const exact = run();
      assert.equal(exact.status, 0, exact.output);
      assert.match(
        exact.output,
        /Excluded byte-exact document copies \(1\): docs\/history\/STATUS/,
      );
      write(name, Buffer.concat([copy, Buffer.from("edited\n")]));
      const edited = run();
      assert.equal(edited.status, 1, edited.output);
      assert.match(edited.output, /STATUS\.pre-m1\.[0-9a-f]{12}\.md:3: CONTRACT\.md/);
      write("docs/history/OTHER.000000000000.md", "[Missing](missing.md)\n");
      assert.match(run().output, /OTHER\.000000000000\.md:1: missing\.md/);
    });
  },
);

test("SNAPSHOT_INDEX-registered copies are verified by SHA-256", { timeout: 30000 }, () => {
  fixture(({ write, run }) => {
    const copy = Buffer.from("[Request](REQUEST.json)\n");
    write("docs/history/CONTRACT.v1.md", copy);
    const index = (entries) =>
      write("docs/history/SNAPSHOT_INDEX.json", JSON.stringify({ byte_exact_documents: entries }));
    index([{ path: "docs/history/CONTRACT.v1.md", sha256: sha(copy) }]);
    const exact = run();
    assert.equal(exact.status, 0, exact.output);
    assert.match(
      exact.output,
      /Excluded byte-exact document copies \(1\): docs\/history\/CONTRACT\.v1\.md/,
    );
    write("docs/history/CONTRACT.v1.md", "[Request](REQUEST.json)\nedited\n");
    const edited = run();
    assert.equal(edited.status, 1, edited.output);
    assert.match(edited.output, /CONTRACT\.v1\.md: bytes differ from the snapshot registered/);
    assert.match(edited.output, /CONTRACT\.v1\.md:1: REQUEST\.json/);
    index([{ path: "docs/history/GONE.md", sha256: sha(copy) }, { path: "docs/x.md" }]);
    const invalid = run();
    assert.equal(invalid.status, 1, invalid.output);
    assert.match(invalid.output, /GONE\.md: registered snapshot is missing/);
    assert.match(invalid.output, /snapshot entry needs a path and a sha256/);
  });
});
