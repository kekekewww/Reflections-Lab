import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";

export const MANIFEST_SHA256 = "b462b8606b1ab089d300d334225d984a30c91369e97eecd4e50652dd4cfb60a7";
export const INPUT_DIGEST = "6f192f7e95ecca86a558459912f4a75f59486cfcae7d08e14dd551a1aaf14eb3";
const prefix = "test-results/product-preview-dist/";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const keys = [
  "schemaVersion",
  "startedAt",
  "completedAt",
  "command",
  "exitCode",
  "sourceStableDuringBuild",
  "inputDigest",
  "inputs",
  "inputsAfter",
  "bundle",
];
const expectedCommand = [
  "C:\\Program Files\\nodejs\\node.exe",
  "node_modules/vite/bin/vite.js",
  "build",
  "--mode",
  "e2e",
  "--outDir",
  "test-results/product-preview-dist",
];
function entries(value, count, bundle = false) {
  assert(Array.isArray(value) && value.length === count, "entry count");
  const seen = new Set();
  for (const item of value) {
    assert(item && typeof item === "object" && !Array.isArray(item));
    assert.deepEqual(Object.keys(item).sort(), ["path", "sha256"]);
    assert(
      typeof item.path === "string" &&
        item.path.length <= 512 &&
        /^[A-Za-z0-9_./-]+$/.test(item.path),
    );
    assert(
      !item.path.startsWith("/") &&
        !item.path.split("/").some((x) => !x || x === "." || x === ".."),
    );
    assert(!seen.has(item.path), "duplicate path");
    seen.add(item.path);
    assert(/^[a-f0-9]{64}$/.test(item.sha256));
    if (bundle) assert(item.path.startsWith(prefix) && item.path.length > prefix.length);
  }
}
export function inspectManifest(m) {
  assert(m && typeof m === "object" && !Array.isArray(m));
  assert.deepEqual(Object.keys(m).sort(), [...keys].sort(), "unknown manifest schema");
  assert.equal(m.schemaVersion, 1);
  assert.equal(m.exitCode, 0);
  assert.equal(m.sourceStableDuringBuild, true);
  assert.deepEqual(m.command, expectedCommand);
  for (const key of ["startedAt", "completedAt"])
    assert.equal(new Date(m[key]).toISOString(), m[key]);
  assert(Date.parse(m.startedAt) <= Date.parse(m.completedAt));
  entries(m.inputs, 175);
  entries(m.inputsAfter, 175);
  entries(m.bundle, 14, true);
  assert.deepEqual(m.inputsAfter, m.inputs, "build inputs changed");
  assert.equal(m.inputDigest, INPUT_DIGEST);
  assert.equal(sha(JSON.stringify(m.inputs)), m.inputDigest);
  assert.equal(m.bundle.filter((e) => e.path === prefix + "index.html").length, 1);
  return m;
}
export function validateManifest(bytes) {
  assert.equal(sha(bytes), MANIFEST_SHA256, "manifest bytes mismatch");
  return inspectManifest(JSON.parse(bytes.toString("utf8")));
}
async function files(dir, base = "") {
  const result = [];
  for (const name of await readdir(path.join(dir, base))) {
    const rel = base ? `${base}/${name}` : name;
    const stat = await lstat(path.join(dir, rel));
    assert(!stat.isSymbolicLink(), "symlink prohibited");
    if (stat.isDirectory()) result.push(...(await files(dir, rel)));
    else {
      assert(stat.isFile());
      result.push(rel);
    }
  }
  return result.sort();
}
export async function verifyFrozenBundle(manifestBytes, bundleDir) {
  const m = validateManifest(manifestBytes);
  const expected = m.bundle.map((e) => e.path.slice(prefix.length)).sort();
  assert.deepEqual(await files(bundleDir), expected, "bundle closure mismatch");
  for (const item of m.bundle)
    assert.equal(
      sha(await readFile(path.join(bundleDir, item.path.slice(prefix.length)))),
      item.sha256,
      `bundle mismatch: ${item.path}`,
    );
  return {
    manifestSha256: sha(manifestBytes),
    inputDigest: m.inputDigest,
    inputCount: m.inputs.length,
    bundleCount: m.bundle.length,
  };
}
