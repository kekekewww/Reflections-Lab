import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { verifyFrozenBundle, validateManifest } from "./build-binding.mjs";
const root = process.cwd();
const cache = path.join(root, "artifacts/v1/device-hearing-v3-frozen-20261029-r6");
const bytes = await readFile(path.join(cache, "build.raw.json"));
const m = validateManifest(bytes);
const result = await verifyFrozenBundle(bytes, path.join(cache, "bundle"));
const drift = [];
for (const item of m.inputs) {
  try {
    const actual = createHash("sha256")
      .update(await readFile(path.join(root, item.path)))
      .digest("hex");
    if (actual !== item.sha256) drift.push(item.path);
  } catch {
    drift.push(item.path);
  }
}
console.log(
  JSON.stringify(
    {
      ...result,
      sourceDrift: drift,
      scope:
        "static frozen build and listed source bytes only; no HTTP, browser, device or listening qualification",
    },
    null,
    2,
  ),
);
if (drift.length) process.exitCode = 1;
