import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateManifest, verifyFrozenBundle } from "./build-binding.mjs";
const artifact = "artifacts/v1/device-hearing-v3-frozen-20261029-r6";
export const RECEIPT_PATH = `${artifact}/independent-review.json`;
export const BASE_FILES = [
  "tests/browser/device-hearing-v3/manual-probe-driver.mjs",
  "tests/browser/device-hearing-v3/build-binding.mjs",
  "tests/browser/device-hearing-v3/review-gate.mjs",
  "tests/browser/device-hearing-v3/serve-frozen.mjs",
  "tests/browser/device-hearing-v3/binding.json",
  "tests/browser/device-hearing/manual-probe-protocol.json",
  "tests/browser/device-hearing/hearing-probe.mjs",
  "tests/browser/device-hearing/hearing-probe.synthetic.test.mjs",
  "tests/browser/native-accessibility-external-browser.mjs",
  "artifacts/v1/hearing-probe-preparation-20261027T173919314Z/raw-receipts/independent-review.json",
  `${artifact}/build.raw.json`,
];
export const HUMAN_BROWSER_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const HUMAN_BROWSER_SHA256 =
  "480f275b63d1ea39113cbc8344ac395578acc25b432bd39af5fbc77005179aca";
const sha = (b) => createHash("sha256").update(b).digest("hex");
export async function computeClosure(root) {
  const manifestBytes = await readFile(path.join(root, `${artifact}/build.raw.json`));
  const manifest = validateManifest(manifestBytes);
  await verifyFrozenBundle(manifestBytes, path.join(root, `${artifact}/bundle`));
  const names = [
    ...BASE_FILES,
    ...manifest.bundle.map(
      (x) => `${artifact}/bundle/` + x.path.slice("test-results/product-preview-dist/".length),
    ),
  ].sort();
  assert.equal(new Set(names).size, names.length);
  return Promise.all(
    names.map(async (p) => ({ path: p, sha256: sha(await readFile(path.join(root, p))) })),
  );
}
export function verifyBrowserBytes({
  executable,
  bytes,
  qualificationNoAudio = false,
  qualificationExecutable,
}) {
  assert.equal(typeof executable, "string");
  assert(bytes instanceof Uint8Array);
  const actual = sha(bytes);
  if (qualificationNoAudio) {
    assert(qualificationExecutable && typeof qualificationExecutable.path === "string");
    assert.deepEqual(Object.keys(qualificationExecutable).sort(), ["path", "sha256"]);
    assert.equal(
      path.resolve(executable),
      path.resolve(qualificationExecutable.path),
      "qualification executable path mismatch",
    );
    assert.equal(actual, qualificationExecutable.sha256, "qualification executable bytes mismatch");
  } else {
    assert.equal(
      path.resolve(executable).toLowerCase(),
      path.resolve(HUMAN_BROWSER_PATH).toLowerCase(),
      "human executable path mismatch",
    );
    assert.equal(actual, HUMAN_BROWSER_SHA256, "human executable bytes mismatch");
  }
  return { path: path.resolve(executable), sha256: actual };
}
export async function verifyReview({ root, qualificationNoAudio = false, receiptBytes }) {
  assert.equal(typeof qualificationNoAudio, "boolean");
  const bytes = receiptBytes ?? (await readFile(path.join(root, RECEIPT_PATH)));
  const receipt = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(
    Object.keys(receipt).sort(),
    qualificationNoAudio
      ? ["executable", "files", "reviewer", "schemaVersion", "status"]
      : ["files", "reviewer", "schemaVersion", "status"],
  );
  assert.equal(receipt.schemaVersion, 1);
  if (qualificationNoAudio) {
    assert.equal(receipt.status, "MOCK_NOT_APPROVED");
    assert.equal(receipt.reviewer, "qualification-fixture");
  } else {
    assert.equal(receipt.status, "APPROVED_FOR_HUMAN_SESSION");
    assert.equal(receipt.reviewer, "root-independent-review");
  }
  assert.deepEqual(
    receipt.files,
    await computeClosure(root),
    "reviewed execution closure mismatch",
  );
  return {
    receiptSha256: sha(bytes),
    status: receipt.status,
    ...(qualificationNoAudio ? { executable: receipt.executable } : {}),
  };
}
