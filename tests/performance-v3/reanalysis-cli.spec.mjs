import test from "node:test";
import assert from "node:assert/strict";
import { planReanalysis, verifyCaptureContract } from "../browser/reanalyze-performance-v3.mjs";
const env = { cwd: process.cwd(), version: "v22.17.0", env: {}, node: "pinned-node" };
const valid = ["--capture", "artifacts/v1/capture/native", "--output", "artifacts/v1/reanalysis"];
const setup = () => ({
  report: {
    artifactFiles: [
      { path: "ui.raw.json", sha256: "raw" },
      { path: "ui.trace.json.gz", sha256: "trace" },
      { path: "ui.trace-analysis.json", sha256: "analysis" },
    ],
    uiCheckpoint: { sha256: "raw", bytes: 10 },
    host: { gitRevision: "git" },
    metrics: [],
    ui: { workloadValidity: {} },
    pageErrors: [],
  },
  analysis: {
    status: "UNVERIFIED",
    reasons: ["INPUT_CAP"],
    analysisContext: {
      traceDataLoss: false,
      traceStreamClosed: true,
      documentBefore: {},
      documentAfter: {},
    },
  },
  inputs: [
    { path: "ui.raw.json", sha256: "raw", bytes: 10 },
    { path: "ui.trace.json.gz", sha256: "trace" },
    { path: "ui.trace-analysis.json", sha256: "analysis" },
  ],
});
test("plan has one bounded worker and distinct paths", () => {
  const p = planReanalysis(valid, env);
  assert.equal(p.file, "pinned-node");
  assert.equal(p.timeoutMs, 420000);
  assert.equal(p.maxOutputBytes, 8388608);
  assert.equal(p.args[0], "--max-old-space-size=2560");
  assert.equal(p.args.length, 4);
  assert.notEqual(p.capture, p.output);
  assert.equal(p.env.RLAB_REANALYSIS_WORKER, "1");
});
for (const args of [
  [],
  ["--capture", "artifacts/v1/a/native"],
  [...valid, "--output", "artifacts/v1/b"],
  [...valid, "--unknown", "x"],
  ["--capture", "artifacts/v1/a/native", "--output", "artifacts/v1/a/native/sub"],
  ["--capture", "artifacts/v1/a/native", "--output", "artifacts/v1/a"],
  ["--capture", "outside/native", "--output", "artifacts/v1/o"],
  ["--capture", "artifacts/v1/a/not-native", "--output", "artifacts/v1/o"],
])
  test(`reject invalid path or arguments ${args.join(" ")}`, () =>
    assert.throws(() => planReanalysis(args, env)));
test("reject worker recursion and wrong node", () => {
  assert.throws(
    () => planReanalysis(valid, { ...env, env: { RLAB_REANALYSIS_WORKER: "1" } }),
    /NESTED/,
  );
  assert.throws(() => planReanalysis(valid, { ...env, version: "v20.0.0" }), /NODE/);
});
test("verified inputs and explicit context pass", () => {
  const x = setup();
  assert.equal(verifyCaptureContract(x.report, x.analysis, x.inputs), x.analysis.analysisContext);
});
for (const field of ["ui.raw.json", "ui.trace.json.gz", "ui.trace-analysis.json"])
  test(`tampered ${field} rejected`, () => {
    const x = setup();
    x.inputs.find((e) => e.path === field).sha256 = "changed";
    assert.throws(() => verifyCaptureContract(x.report, x.analysis, x.inputs), /MISMATCH/);
  });
test("raw byte count mismatch rejected", () => {
  const x = setup();
  x.report.uiCheckpoint.bytes++;
  assert.throws(() => verifyCaptureContract(x.report, x.analysis, x.inputs), /CHECKPOINT/);
});
for (const field of ["traceDataLoss", "traceStreamClosed", "documentBefore", "documentAfter"])
  test(`missing context ${field} rejected`, () => {
    const x = setup();
    delete x.analysis.analysisContext[field];
    assert.throws(() => verifyCaptureContract(x.report, x.analysis, x.inputs), /CONTEXT/);
  });
test("original INPUT_CAP result required", () => {
  const x = setup();
  x.analysis.reasons = [];
  assert.throws(() => verifyCaptureContract(x.report, x.analysis, x.inputs), /INPUT_CAP/);
});
