import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  analyzeTraceV3,
  analyzeTraceStreamV3,
  validateNativeV3,
  SHORT_TRACE_CAPS,
  FORMAL_TRACE_CAPS,
} from "../browser/performance-native-v3.mjs";
import { parseProfileOptions } from "../browser/performance-cli-v3.mjs";
import { baseV3Fixture } from "./performance-v3-negative-fixtures.mjs";
async function withTrace(events, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "v3-formal-"));
  try {
    const file = path.join(dir, "trace.gz");
    await writeFile(file, gzipSync(JSON.stringify({ traceEvents: events })));
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("stream and buffer preserve same numeric output, identity, context and full event count", async () => {
  const d = baseV3Fixture();
  d.events.push({ name: "irrelevant", ph: "I" });
  await withTrace(d.events, async (f) => {
    const a = await analyzeTraceV3(f, d.ui, d.context),
      b = await analyzeTraceStreamV3(f, d.ui, d.context);
    assert.equal(b.parsedTraceEvents, d.events.length);
    assert.equal(b.streamStats.retainedEvents, d.events.length - 1);
    assert.deepEqual(b.mainTaskOccupancyMs, a.mainTaskOccupancyMs);
    assert.deepEqual(b.nativeTraceBinBoundariesUs, a.nativeTraceBinBoundariesUs);
    assert.equal(b.nativeEligibility.qualified, a.nativeEligibility.qualified);
    assert.deepEqual(b.analysisContext, d.context);
  });
});
for (const [name, event] of [
  ["primitive", null],
  ["bad name", { name: 5 }],
  ["long name", { name: "x".repeat(513) }],
])
  test(`stream rejects foreign ${name} before filtering`, async () => {
    const d = baseV3Fixture();
    d.events.push(event);
    await withTrace(d.events, async (f) =>
      assert.equal(
        (await analyzeTraceStreamV3(f, d.ui, d.context)).nativeEligibility.qualified,
        false,
      ),
    );
  });
test("stream validates malformed task outside window", async () => {
  const d = baseV3Fixture();
  d.events.push({ name: "RunTask", ph: "X", ts: -1, dur: -1, cat: "toplevel", pid: 7, tid: 9 });
  await withTrace(d.events, async (f) =>
    assert.ok(
      (await analyzeTraceStreamV3(f, d.ui, d.context)).nativeEligibility.reasons.includes(
        "RENDERER_TASK_SCHEMA_OR_CATEGORY",
      ),
    ),
  );
});
test("only exact formal or bounded short caps accepted", () => {
  const d = baseV3Fixture();
  assert.equal(validateNativeV3(d.ui, d.events, d.context, FORMAL_TRACE_CAPS).qualified, true);
  assert.equal(
    validateNativeV3(d.ui, d.events, d.context, { ...SHORT_TRACE_CAPS, events: 8000000 }).qualified,
    false,
  );
  assert.equal(
    validateNativeV3(d.ui, d.events, d.context, { ...FORMAL_TRACE_CAPS, events: 8000001 })
      .qualified,
    false,
  );
});
test("formal opt in fixes workload, default short remains bounded", () => {
  assert.deepEqual([parseProfileOptions([]).seconds, parseProfileOptions([]).formal], [20, false]);
  const p = parseProfileOptions(["--formal-600"]);
  assert.deepEqual(
    [p.seconds, p.phase, p.physicsIterations, p.acousticIterations, p.formal],
    [600, "all", 3000, 600, true],
  );
});
for (const args of [
  ["--seconds", "600"],
  ["--formal-600", "--phase", "ui"],
  ["--formal-600", "--seconds", "599"],
  ["--bogus", "1"],
  ["--phase"],
  ["--seconds", "20", "--seconds", "20"],
  ["--formal-600", "--formal-600"],
])
  test(`invalid cli ${args.join(" ")}`, () => assert.throws(() => parseProfileOptions(args)));
