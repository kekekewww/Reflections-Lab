import test from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, cp, rm } from "node:fs/promises";
import path from "node:path";
import {
  computeClosure,
  verifyReview,
  verifyBrowserBytes,
  HUMAN_BROWSER_PATH,
  RECEIPT_PATH,
} from "./review-gate.mjs";
const root = process.cwd();
const files = await computeClosure(root);
const fixture = Buffer.from(
  JSON.stringify({
    schemaVersion: 1,
    status: "MOCK_NOT_APPROVED",
    reviewer: "qualification-fixture",
    executable: { path: "fixture-chromium", sha256: "0".repeat(64) },
    files,
  }),
);
test("fixture only qualifies no-audio and is refused for human", async () => {
  assert.equal(
    (await verifyReview({ root, qualificationNoAudio: true, receiptBytes: fixture })).status,
    "MOCK_NOT_APPROVED",
  );
  await assert.rejects(verifyReview({ root, receiptBytes: fixture }));
});
test("missing receipt refuses human session", async () => {
  const dir = await mkdtemp(path.resolve(".cache/v1/r14-hearing-20261028/gate-"));
  try {
    await assert.rejects(verifyReview({ root: dir }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("reviewed closure refuses altered launcher, protocol, adapter and bundle", async () => {
  const dir = await mkdtemp(path.resolve(".cache/v1/r14-hearing-20261028/gate-"));
  try {
    for (const item of files) {
      const target = path.join(dir, item.path);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(root, item.path), target);
    }
    const rp = path.join(dir, RECEIPT_PATH);
    await writeFile(
      rp,
      JSON.stringify({
        schemaVersion: 1,
        status: "APPROVED_FOR_HUMAN_SESSION",
        reviewer: "root-independent-review",
        files,
      }),
    );
    await verifyReview({ root: dir });
    for (const name of [
      "tests/browser/native-accessibility-external-browser.mjs",
      "tests/browser/device-hearing/manual-probe-protocol.json",
      "tests/browser/device-hearing-v3/build-binding.mjs",
      files.find((x) => x.path.endsWith("/bundle/index.html")).path,
    ]) {
      const target = path.join(dir, name),
        original = await readFile(target);
      await writeFile(target, "tampered");
      await assert.rejects(verifyReview({ root: dir }));
      await writeFile(target, original);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("browser path and bytes are pinned, including changed bytes on recheck", () => {
  const bytes = Buffer.from("qualification browser bytes");
  const executable = {
    path: path.resolve("fixture-chromium"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const args = {
    executable: executable.path,
    bytes,
    qualificationNoAudio: true,
    qualificationExecutable: executable,
  };
  const first = verifyBrowserBytes(args);
  assert.equal(first.sha256, executable.sha256);
  assert.throws(() => verifyBrowserBytes({ ...args, executable: path.resolve("wrong-browser") }));
  assert.throws(() => verifyBrowserBytes({ ...args, bytes: Buffer.from("changed bytes") }));
  assert.throws(() => verifyBrowserBytes({ executable: path.resolve("wrong-browser"), bytes }));
  assert.throws(() => verifyBrowserBytes({ executable: HUMAN_BROWSER_PATH, bytes }));
});
