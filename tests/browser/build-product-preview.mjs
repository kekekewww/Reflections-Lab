import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const outputDirectory = "test-results/product-preview-dist";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const file = path.posix.join(directory, entry.name);
        return entry.isDirectory() ? walk(file) : [file];
      }),
    )
  )
    .flat()
    .sort();
}
async function inputs() {
  const files = [
    ...(await walk("src")),
    ...(await walk("schemas")),
    ...(await walk("public")),
    "docs/05-ux/DESIGN_TOKENS.json",
    "package.json",
    "package-lock.json",
    "index.html",
    "tsconfig.json",
    "vite.config.ts",
  ].sort();
  return Promise.all(
    files.map(async (file) => ({ path: file, sha256: hash(await readFile(file)) })),
  );
}
const before = await inputs(),
  startedAt = new Date().toISOString();
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--mode", "e2e", "--outDir", outputDirectory],
  { cwd: root, encoding: "utf8" },
);
await mkdir("test-results/product-e2e", { recursive: true });
await writeFile("test-results/product-e2e/build.stdout.txt", result.stdout);
await writeFile("test-results/product-e2e/build.stderr.txt", result.stderr);
const after = await inputs();
const stable = JSON.stringify(before) === JSON.stringify(after);
const bundle =
  result.status === 0
    ? await Promise.all(
        (await walk(outputDirectory)).map(async (file) => ({
          path: file,
          sha256: hash(await readFile(file)),
        })),
      )
    : [];
const manifest = {
  schemaVersion: 1,
  startedAt,
  completedAt: new Date().toISOString(),
  command: [
    process.execPath,
    "node_modules/vite/bin/vite.js",
    "build",
    "--mode",
    "e2e",
    "--outDir",
    outputDirectory,
  ],
  exitCode: result.status,
  sourceStableDuringBuild: stable,
  inputDigest: hash(JSON.stringify(before)),
  inputs: before,
  inputsAfter: after,
  bundle,
};
await writeFile("test-results/product-e2e/build.json", JSON.stringify(manifest, null, 2) + "\n");
if (result.status !== 0 || !stable) {
  process.stderr.write(result.stderr + (stable ? "" : "BUILD_INPUT_CHANGED\n"));
  process.exitCode = 1;
} else process.stdout.write(`Product preview frozen input digest ${manifest.inputDigest}\n`);
