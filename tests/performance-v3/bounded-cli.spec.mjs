import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { planPerformanceRun, runPerformance } from "../browser/run-performance-v3.mjs";
import {
  observeTraceFaults,
  finalizeTraceFaults,
} from "../browser/performance-owned-cleanup-v3.mjs";
const env = {
  nodeVersion: "v22.17.0",
  nodePath: "node-pinned",
  cwd: process.cwd(),
  environment: {},
  defaultOutput: "artifacts/v1/example",
};
test("formal wrapper plan single child fixed bounds and unique nested output", () => {
  const p = planPerformanceRun(
    ["--formal-600", "--executable-path", "chrome", "--output", "artifacts/v1/candidate"],
    env,
  );
  assert.equal(p.timeoutMs, 1380000);
  assert.equal(p.maxOutputBytes, 8388608);
  assert.equal(p.file, "node-pinned");
  assert.equal(p.args[0], "--max-old-space-size=2560");
  assert.equal(p.args.filter((x) => x === "--output").length, 1);
  assert.equal(p.args.at(-1), path.join(p.parent, "native"));
  assert.equal(p.env.RLAB_PERF_WORKER, "1");
});
test("short wrapper has bounded timeout", () =>
  assert.equal(
    planPerformanceRun(["--phase", "ui", "--executable-path", "chrome"], env).timeoutMs,
    420000,
  ));
for (const args of [
  ["--unknown", "x"],
  ["--output", "a", "--output", "b", "--executable-path", "chrome"],
  ["--output"],
  ["--seconds", "600", "--executable-path", "chrome"],
  ["--formal-600", "--phase", "ui", "--executable-path", "chrome"],
  [],
])
  test(`wrapper rejects ${args.join(" ") || "missing executable"}`, () =>
    assert.throws(() => planPerformanceRun(args, env)));
test("wrapper rejects recursive child or wrong node", () => {
  assert.throws(
    () =>
      planPerformanceRun(["--executable-path", "chrome"], {
        ...env,
        environment: { RLAB_PERF_WORKER: "1" },
      }),
    /NESTED/,
  );
  assert.throws(
    () => planPerformanceRun(["--executable-path", "chrome"], { ...env, nodeVersion: "v20.0.0" }),
    /NODE/,
  );
});
test("late trace stream fault overrides measured status while preserving error", async () => {
  const browser = new EventEmitter(),
    page = new EventEmitter(),
    cdp = new EventEmitter(),
    report = {
      status: "MEASURED_LOCAL_ONLY",
      error: { message: "primary" },
      traceLifecycleFaults: [],
    };
  const obs = observeTraceFaults({
    browser,
    page,
    cdp,
    records: report.traceLifecycleFaults,
    phase: () => "trace-stream",
  });
  cdp.emit("close");
  assert.equal(finalizeTraceFaults(report, obs), true);
  assert.equal(report.status, "FAILED_TRACE_LIFECYCLE");
  assert.equal(report.error.message, "primary");
  assert.equal(report.traceLifecycleFaults[0].phase, "trace-stream");
});
test("normal cleanup after dispose creates no lifecycle fault", () => {
  const browser = new EventEmitter(),
    page = new EventEmitter(),
    cdp = new EventEmitter(),
    report = { status: "MEASURED_LOCAL_ONLY", traceLifecycleFaults: [] };
  const obs = observeTraceFaults({ browser, page, cdp, records: report.traceLifecycleFaults });
  assert.equal(finalizeTraceFaults(report, obs), false);
  browser.emit("disconnected");
  page.emit("crash");
  cdp.emit("close");
  assert.equal(report.status, "MEASURED_LOCAL_ONLY");
  assert.deepEqual(report.traceLifecycleFaults, []);
});

test("existing output parent is never overwritten or launched", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "v3-existing-output-"));
  try {
    await assert.rejects(
      runPerformance(["--executable-path", "chrome", "--output", dir]),
      (error) => error.code === "EEXIST",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
