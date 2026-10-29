import { build } from "vite";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outDir = path.resolve(root, "test-results/acoustic-delivery-dist");
if (path.relative(root, outDir) !== path.join("test-results", "acoustic-delivery-dist"))
  throw new Error("Unsafe build output directory");
await build({
  configFile: false,
  root,
  worker: { format: "es" },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: path.join(root, "tests/browser/acoustic-delivery-harness.html") },
  },
});
const artifacts = {};
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(absolute);
    else
      artifacts[path.relative(root, absolute).replaceAll("\\", "/")] = createHash("sha256")
        .update(await readFile(absolute))
        .digest("hex");
  }
}
await visit(outDir);
await writeFile(
  path.join(root, "tests/acoustics-runtime/delivery-build-20261027.json"),
  JSON.stringify({ createdAt: new Date().toISOString(), mode: "production", artifacts }, null, 2),
);
