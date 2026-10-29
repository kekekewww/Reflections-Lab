import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  formalNumericV3,
  FORMAL_NUMERIC_TASK_CAP,
} from "../browser/performance-numeric-formal-v3.mjs";
import {
  unchangedNumericV3,
  FORMAL_TRACE_CAPS,
  analyzeFormalTraceStreamV3,
  analyzeTraceStreamV3,
} from "../browser/performance-native-v3.mjs";
import {
  NUMERIC_FIXTURES,
  ERROR_FIXTURES,
  candidateNumericAdapterInput,
} from "./reference/fixtures.mjs";
import { bits } from "./reference/rational-binary64.mjs";
import { baseV3Fixture } from "./performance-v3-negative-fixtures.mjs";
const adapt = () => candidateNumericAdapterInput(NUMERIC_FIXTURES[1]);
test("formal kernel text differs only in name and declared cap", async () => {
  const source = await readFile("tests/browser/performance-native-v3.mjs", "utf8"),
    formal = await readFile("tests/browser/performance-numeric-formal-v3.mjs", "utf8");
  const begin = source.indexOf("export function unchangedNumericV3("),
    end = source.indexOf("export function analyzeFrameCoverageV3(", begin);
  const f = formal.slice(formal.indexOf("export function formalNumericV3("));
  assert.equal(
    f
      .replace("formalNumericV3", "unchangedNumericV3")
      .replace("FORMAL_NUMERIC_TASK_CAP", "SHORT_TRACE_CAPS.relevantTasks"),
    source.slice(begin, end),
  );
  assert.equal(FORMAL_NUMERIC_TASK_CAP, FORMAL_TRACE_CAPS.relevantTasks);
});
for (const fixture of NUMERIC_FIXTURES)
  test(`formal literal bit parity ${fixture.id}`, () => {
    const { ui, validated } = candidateNumericAdapterInput(fixture);
    const a = unchangedNumericV3(ui, validated),
      b = formalNumericV3(ui, validated);
    assert.deepEqual(b, a);
    assert.deepEqual(b.nativeTraceBinBoundariesUs.map(bits), fixture.expected.native.map(bits));
    assert.deepEqual(
      b.mainTaskOccupancyMs.map(bits),
      fixture.expected.complete ? fixture.expected.occupancyMs.map(bits) : [],
    );
  });
for (const fixture of ERROR_FIXTURES)
  test(`formal negative parity ${fixture.id}`, () => {
    const { ui, validated } = candidateNumericAdapterInput(fixture);
    assert.deepEqual(formalNumericV3(ui, validated), unchangedNumericV3(ui, validated));
  });
test("200001 duplicate overlap tasks formal union exact and short rejects", () => {
  const { ui, validated } = adapt();
  const task = validated.validatedTasks[0];
  validated.validatedTasks = Array.from({ length: 200001 }, () => task);
  const before = unchangedNumericV3(ui, validated);
  assert.equal(before.reasons[0], "INPUT_CAP");
  const one = formalNumericV3(ui, { ...validated, validatedTasks: [task] }),
    many = formalNumericV3(ui, validated);
  assert.deepEqual(many.mainTaskOccupancyMs.map(bits), one.mainTaskOccupancyMs.map(bits));
  assert.deepEqual(many.mergedNativeTasks, one.mergedNativeTasks);
  assert.deepEqual(many.mainTaskOccupancyMs.map(bits), [0.25, 0.25, 0.25, 0.25].map(bits));
  assert.deepEqual(many.mergedNativeTasks, [[0.5, 1000.5]]);
  assert.equal(many.nativeTaskCount, 200001);
});
test("formal cap rejects 2000001 sparse tasks before traversal", () => {
  const { ui, validated } = adapt();
  validated.validatedTasks = new Array(2000001);
  assert.equal(formalNumericV3(ui, validated).reasons[0], "INPUT_CAP");
});
test("formal validates malformed and overflow tasks outside window", () => {
  for (const task of [
    null,
    { ts: NaN, dur: 1 },
    { ts: Number.MAX_VALUE, dur: Number.MAX_VALUE },
    { ts: -999, dur: -1 },
  ]) {
    const { ui, validated } = adapt();
    validated.validatedTasks.push(task);
    assert.equal(formalNumericV3(ui, validated).status, "UNVERIFIED");
  }
});
test("formal streaming sibling retains short analysis semantics for small inputs", async () => {
  const d = baseV3Fixture(),
    dir = await mkdtemp(path.join(tmpdir(), "formal-stream-"));
  try {
    const f = path.join(dir, "trace.gz");
    await writeFile(f, gzipSync(JSON.stringify({ traceEvents: d.events })));
    const a = await analyzeTraceStreamV3(f, d.ui, d.context),
      b = await analyzeFormalTraceStreamV3(f, d.ui, d.context);
    assert.deepEqual(b.mainTaskOccupancyMs.map(bits), a.mainTaskOccupancyMs.map(bits));
    assert.equal(b.nativeEligibility.qualified, a.nativeEligibility.qualified);
    assert.equal(b.parsedTraceEvents, a.parsedTraceEvents);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
