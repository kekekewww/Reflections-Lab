import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const output = path.join(root, "test-results/ui-preview-dist");
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

async function files(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = path.posix.join(directory, entry.name);
      return entry.isDirectory() ? files(relative) : [relative];
    }),
  );
  return nested.flat().sort();
}

async function inputs() {
  const names = [
    ...(await files("src")),
    ...(await files("schemas")),
    ...(await files("public")),
    "docs/05-ux/DESIGN_TOKENS.json",
    "index.html",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
  ].sort();
  return Promise.all(
    names.map(async (name) => ({
      path: name,
      sha256: sha256(await readFile(path.join(root, name))),
    })),
  );
}

const before = await inputs();
const buildStartedAt = new Date().toISOString();
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--mode", "e2e", "--outDir", output],
  { cwd: root, stdio: "inherit" },
);
if (result.status !== 0) throw new Error(`UI preview build failed: ${result.status}`);
const after = await inputs();
if (JSON.stringify(before) !== JSON.stringify(after)) {
  const beforeHashes = new Map(before.map((entry) => [entry.path, entry.sha256]));
  const changed = after
    .filter((entry) => beforeHashes.get(entry.path) !== entry.sha256)
    .map((entry) => entry.path);
  await writeFile(
    path.join(root, "test-results/ui-preview-build-failed.json"),
    `${JSON.stringify({ buildStartedAt, changed, before, after }, null, 2)}\n`,
  );
  throw new Error(`BUILD_INPUT_CHANGED: ${changed.join(", ")}`);
}
const bundle = await Promise.all(
  (await files("test-results/ui-preview-dist")).map(async (name) => ({
    path: name,
    sha256: sha256(await readFile(path.join(root, name))),
  })),
);
const manifest = {
  schemaVersion: 1,
  mode: "e2e",
  buildStartedAt,
  buildCompletedAt: new Date().toISOString(),
  sourceStableDuringBuild: true,
  inputDigest: sha256(JSON.stringify(before)),
  inputs: before,
  bundle,
};
await mkdir(path.join(root, "test-results"), { recursive: true });
await writeFile(
  path.join(root, "test-results/ui-preview-build.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
process.stdout.write(`UI preview source digest ${manifest.inputDigest}\n`);
