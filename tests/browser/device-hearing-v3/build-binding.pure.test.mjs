import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, cp, writeFile, rm, rename } from "node:fs/promises";

import path from "node:path";
import { validateManifest, inspectManifest, verifyFrozenBundle } from "./build-binding.mjs";
const cache = path.resolve("artifacts/v1/device-hearing-v3-frozen-20261029-r6");
const raw = await readFile(path.join(cache, "build.raw.json"));
test("exact frozen manifest and bundle qualify", async () => {
  const r = await verifyFrozenBundle(raw, path.join(cache, "bundle"));
  assert.equal(r.inputCount, 175);
  assert.equal(r.bundleCount, 14);
});
for (const [name, edit] of [
  [
    "unknown schema",
    (m) => {
      m.future = true;
    },
  ],
  [
    "changed schema",
    (m) => {
      m.schemaVersion = 2;
    },
  ],
  ["input order", (m) => m.inputs.reverse()],
  [
    "postbuild drift",
    (m) => {
      m.inputsAfter[0].sha256 = "0".repeat(64);
    },
  ],
  [
    "digest",
    (m) => {
      m.inputDigest = "0".repeat(64);
    },
  ],
  [
    "duplicate",
    (m) => {
      m.bundle[1] = m.bundle[0];
    },
  ],
  [
    "path escape",
    (m) => {
      m.bundle[0].path = "../escape";
    },
  ],
  [
    "command",
    (m) => {
      m.command.push("extra");
    },
  ],
  [
    "timestamp",
    (m) => {
      m.startedAt = "invalid";
    },
  ],
])
  test(`reject ${name}`, () => {
    const m = JSON.parse(raw);
    edit(m);
    assert.throws(() => validateManifest(Buffer.from(JSON.stringify(m))));
    assert.throws(() => inspectManifest(m));
  });
test("reject altered, missing and extra bundle bytes", async () => {
  const temp = await mkdtemp(path.resolve(".cache/v1/r14-hearing-20261028/test-"));
  try {
    await cp(path.join(cache, "bundle"), temp, { recursive: true });
    const index = path.join(temp, "index.html");
    const original = await readFile(index);
    await writeFile(index, "tampered");
    await assert.rejects(verifyFrozenBundle(raw, temp));
    await writeFile(index, original);
    await rename(index, index + ".missing");
    await assert.rejects(verifyFrozenBundle(raw, temp));
    await rename(index + ".missing", index);
    await writeFile(path.join(temp, "extra.txt"), "extra");
    await assert.rejects(verifyFrozenBundle(raw, temp));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("recording worker script and source map are required in frozen closure", () => {
  const m = JSON.parse(raw);
  const worker = m.bundle.filter((entry) =>
    /\/recording-seal\.worker-[^/]+\.js(?:\.map)?$/.test(entry.path),
  );
  assert.equal(worker.length, 2);
  assert(worker.some((entry) => entry.path.endsWith(".js")));
  assert(worker.some((entry) => entry.path.endsWith(".js.map")));
  for (const entry of worker) {
    const altered = structuredClone(m);
    altered.bundle = altered.bundle.filter((item) => item.path !== entry.path);
    assert.throws(() => inspectManifest(altered));
  }
});

test("previous R3 manifest is rejected by R4 binding", async () => {
  const old = await readFile(
    path.resolve("artifacts/v1/device-hearing-v3-frozen-20261028-r3/build.raw.json"),
  );
  assert.throws(() => validateManifest(old));
});

test("previous R4 manifest is rejected by R5 binding", async () => {
  const old = await readFile(
    path.resolve("artifacts/v1/device-hearing-v3-frozen-20261028-r4/build.raw.json"),
  );
  assert.throws(() => validateManifest(old));
});

test("previous R5 manifest is rejected by R6 binding", async () => {
  const old = await readFile(
    path.resolve("artifacts/v1/device-hearing-v3-frozen-20261029-r5/build.raw.json"),
  );
  assert.throws(() => validateManifest(old));
});
