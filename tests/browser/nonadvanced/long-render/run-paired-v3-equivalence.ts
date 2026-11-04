import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readVerifiedSnapshotPcm, type PairedV3Wave } from "./paired-v3-support.js";
import { summarizePcmDifference, type DiagnosticPcm } from "./diagnostics.js";
const started = performance.now(),
  root = ".cache/nonadvanced-long-render/2026-11-02T193138116Z";
const definitions = [
  {
    id: "master",
    filename: "master.wav",
    frames: 2976000,
    bytes: 23808056,
    sha256: "4f0912f43925b381d7a47a640129337befa9e283d93181e6ac993c7b0a6998f7",
  },
  {
    id: "reference63",
    filename: "reference-master63.diagnostic.wav",
    frames: 3024000,
    bytes: 24192056,
    sha256: "54a4a8856d00436eed2b35e8b3a8d0051d680f7ec978b36952c107cee010bbf9",
  },
];
const loaded: { old: DiagnosticPcm; next: DiagnosticPcm }[] = [];
for (const d of definitions) {
  const bytes = await readFile(`${root}/${d.filename}`);
  assert.equal(bytes.byteLength, d.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), d.sha256);
  const backing = bytes.buffer;
  if (!(backing instanceof ArrayBuffer)) throw new Error("FIXED_PCM_SHARED_BUFFER");
  const view = new DataView(backing, bytes.byteOffset, bytes.byteLength),
    file: PairedV3Wave = {
      id: d.id,
      bytes: d.bytes,
      sha256: d.sha256,
      frames: d.frames,
      channels: 2,
      rate: 48000,
    };
  const blob = new Blob([new Uint8Array(backing, bytes.byteOffset, bytes.byteLength)]);
  const next = await readVerifiedSnapshotPcm({ ...file, blob }, file);
  loaded.push({
    old: {
      channels: 2,
      frames: d.frames,
      sample: (channel: number, frame: number) =>
        view.getFloat32(56 + (frame * 2 + channel) * 4, true),
    } satisfies DiagnosticPcm,
    next: next.vector,
  });
}
const options = { frames: 2976000, sampleRateHz: 48000 as const, tolerance: 2e-6 as const };
const old = summarizePcmDifference(loaded[0]!.old, loaded[1]!.old, options),
  next = summarizePcmDifference(loaded[0]!.next, loaded[1]!.next, options);
let numericFields = 0;
const bits = new DataView(new ArrayBuffer(16));
function exact(a: unknown, b: unknown, path = "root"): void {
  if (typeof a === "number" && typeof b === "number") {
    assert.ok(Object.is(a, b), path);
    bits.setFloat64(0, a);
    bits.setFloat64(8, b);
    assert.equal(bits.getBigUint64(0), bits.getBigUint64(8), path);
    numericFields++;
    return;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    assert.equal(a, b, path);
    return;
  }
  assert.deepEqual(Object.keys(a), Object.keys(b), path);
  for (const k of Object.keys(a))
    exact((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path + "." + k);
}
exact(old, next);
assert.equal(old.maxError, 2.9802322387695312e-6);
assert.equal(old.overCount, 321);
assert.equal(old.firstOver?.frame, 543481);
assert.equal(old.atMax?.frame, 1703952);
assert.equal(old.nonfinite.count, 0);
const elapsedMs = performance.now() - started;
if (elapsedMs > 20000) throw new Error("FIXED_PCM_PROOF_EXCEEDED_20S");
const receipt = {
  schemaVersion: "paired-v3-fixed-pcm-equivalence-v1",
  status: "PASS",
  method:
    "Fixed complete original62/63 PCM bytes independentlyNodeSHA-pinned. Old DataView reader and snapshot Blob adapter both call exact unchanged original Stats; every numericfield compared with Object.is and Float64bits.",
  sourceFiles: definitions,
  frames: options.frames,
  comparedSamples: old.comparedSamples,
  comparedFloat64Fields: numericFields,
  legacySummary: old,
  nextSummary: next,
  elapsedMs,
  scope:
    "Adapter/math proof only, no new native render. Original321overs whole63 failure preserved.",
};
await writeFile(
  "docs/16-nonadvanced-completion/lanes/long-render/paired-v3-fixed-pcm-equivalence.json",
  JSON.stringify(receipt, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    status: "PASS",
    elapsedMs,
    numericFields,
    maxError: old.maxError,
    overCount: old.overCount,
  }),
);
