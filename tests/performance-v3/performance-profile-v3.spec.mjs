// PREP ONLY. These tests have NOT RUN. No browser launch or source mutation.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import {
  validateNativeV3,
  unchangedNumericV3,
  SHORT_TRACE_CAPS,
} from "../browser/performance-native-v3.mjs";
import { createProofCollector, float64Bits, V3_LIMITS } from "../browser/performance-proof-v3.mjs";
import {
  baseV3Fixture,
  negativeV3Cases,
  rebindV3Frame,
} from "./performance-v3-negative-fixtures.mjs";
const validate = (data) => validateNativeV3(data.ui, data.events, data.context);
test("positive literal/native interval oracle is [8, 10, 4] ms", () => {
  const data = baseV3Fixture(),
    native = validate(data);
  assert.equal(native.qualified, true, JSON.stringify(native.reasons));
  assert.deepEqual(unchangedNumericV3(data.ui, native).mainTaskOccupancyMs, [8, 10, 4]);
});
for (const fixture of negativeV3Cases())
  test(`controlled UNVERIFIED: ${fixture.name}`, () => {
    const result = validate(fixture.data);
    assert.equal(result.qualified, false);
    assert.ok(result.reasons.includes(fixture.expectedReason), JSON.stringify(result.reasons));
    assert.deepEqual(unchangedNumericV3(fixture.data.ui, result).mainTaskOccupancyMs, []);
  });
test("explicit different thread task exclusion does not validate its irrelevant task schema", () => {
  const data = baseV3Fixture();
  data.events.push({ name: "RunTask", pid: 8, tid: 10, ph: "B", cat: null, ts: null, dur: -1 });
  data.events.push({
    name: "thread_name",
    ph: "M",
    pid: 0,
    tid: 0,
    args: { name: "harmless metadata" },
  });
  const result = validate(data);
  assert.equal(result.qualified, true);
  assert.equal(result.excludedOtherThreadTasks, 1);
});
test("event cap is checked before filtering; exact cap remains eligible", () => {
  const d = baseV3Fixture();
  assert.equal(
    validateNativeV3(d.ui, d.events, d.context, { ...SHORT_TRACE_CAPS, events: d.events.length })
      .qualified,
    true,
  );
  assert.ok(
    validateNativeV3(d.ui, d.events, d.context, {
      ...SHORT_TRACE_CAPS,
      events: d.events.length - 1,
    }).reasons.includes("INPUT_CAP"),
  );
});
test("physical callTime exact fire boundaries are inclusive", () => {
  for (const offset of [0, 1500]) {
    const d = baseV3Fixture(),
      mark = d.events.find((e) => e.name.startsWith("rlab-v3.observe."));
    mark.args.data.callTime = 10000 + offset;
    assert.equal(validate(d).qualified, true);
  }
});
test("exact raw inversion stays diagnostic under positive native identity; no epsilon", () => {
  const d = baseV3Fixture();
  rebindV3Frame(d, 0, 11.000000000000002, 11);
  const result = validate(d);
  assert.equal(result.qualified, true);
  assert.equal(result.rawOrderDiagnostic[0].nativeAfterObserved, true);
  assert.ok(result.rawOrderDiagnostic[0].rawNativeMinusObservedMs > 0);
});
test("native 50000us coverage edge passes exactly; edge+1 fails numeric completeness", () => {
  for (const [gap, expected] of [
    [50000, true],
    [50001, false],
  ]) {
    const d = baseV3Fixture();
    d.events.find((e) => e.name === d.ui.collectionWindow.endMarkName).ts = 201000;
    d.events = d.events.filter((e) => e.name !== "RunTask");
    d.events.push({
      name: "RunTask",
      ph: "X",
      cat: "toplevel",
      pid: 7,
      tid: 9,
      ts: 1000 + gap,
      dur: 200000 - gap,
    });
    const native = validate(d);
    assert.equal(native.qualified, true);
    assert.equal(unchangedNumericV3(d.ui, native).complete, expected);
  }
});
test("old/new binary64 bins and occupancy are bit exact on original eligible literal", async () => {
  const old = await import(
    pathToFileURL(path.resolve("tests/browser/performance-profile.mjs")).href
  );
  const d = baseV3Fixture(),
    dir = await mkdtemp(path.join(os.tmpdir(), "v3-candidate-"));
  const native = validate(d),
    next = unchangedNumericV3(d.ui, native);
  const legacy = structuredClone(d.ui);
  legacy.collectionWindow.schemaVersion = "2.0.0";
  delete legacy.v3Proof;
  try {
    const file = path.join(dir, "synthetic.json.gz");
    await writeFile(file, gzipSync(JSON.stringify({ traceEvents: d.events })));
    const previous = await old.analyzeTrace(file, legacy);
    assert.equal(previous.coverage.complete, true);
    assert.deepEqual(
      next.mainTaskOccupancyMs.map(float64Bits),
      previous.mainTaskOccupancyMs.map(float64Bits),
    );
    assert.deepEqual(
      next.nativeTraceBinBoundariesUs.map(float64Bits),
      previous.coverage.clockCorrelation.nativeTraceBinBoundariesUs.map(float64Bits),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("collector twins share one proof; actual handles/raw bits retained and closed samples rejected", () => {
  const marks = [],
    c = createProofCollector({ mark: (name) => marks.push(name) });
  c.register(40, false);
  c.begin("literal-collector");
  c.callback(40, 10, 11, true);
  c.register(41, true);
  c.callback(41, 10, 12, true);
  c.register(42, true);
  c.callback(42, 20, 21, true);
  c.close();
  const before = c.snapshot();
  assert.equal(before.frames.length, 2);
  assert.equal(before.callbacks.length, 3);
  assert.equal(before.callbacks[1].representedByOrdinal, 1);
  assert.equal(before.frames[0].requestHandle, 40);
  assert.equal(before.frames[0].rawRafBits, float64Bits(10));
  assert.equal(before.counters.precollectionRegistrations, 1);
  c.callback(43, 30, 31, true);
  assert.equal(c.snapshot().counters.samplesAfterClose, 1);
});
test("register-cancel-register reuse and boundary cap+1 are visible", () => {
  const c = createProofCollector({ mark() {}, limits: { ...V3_LIMITS, pendingHandles: 1 } });
  c.begin("literal-collector");
  c.register(1, true);
  c.cancel(1);
  c.register(1, true);
  c.register(2, true);
  assert.ok(c.snapshot().reasons.includes("HANDLE_REUSE_OR_WRAP"));
  assert.ok(c.snapshot().reasons.includes("PENDING_HANDLE_CAP"));
});
test("inherited wrapper preserves argument bits, returned handles, cancel, invoke-once, all callback timing, restoration", async () => {
  const text = await readFile(
    new URL("../browser/performance-fixture-v3.mjs", import.meta.url),
    "utf8",
  );
  const wrapper = text.slice(
    text.indexOf("const observedRAF ="),
    text.indexOf("\nconst makeBody ="),
  );
  assert.ok(wrapper.length > 1000);
  let next = 101,
    now = 0;
  const pending = new Map(),
    cancelled = [],
    received = [];
  const previousRAF = () => {},
    previousCancelRAF = () => {};
  const window = { requestAnimationFrame: previousRAF, cancelAnimationFrame: previousCancelRAF };
  const proof = createProofCollector({ mark() {} });
  proof.begin("wrapper-literal");
  const nativeRAF = (callback) => {
    const id = next++;
    pending.set(id, callback);
    return id;
  };
  const nativeCancelRAF = (id) => {
    cancelled.push(id);
    pending.delete(id);
    return "native-cancel-result";
  };
  // Fake asynchronous native registration boundary only. Executes the exact derivative wrapper text.
  const create = new Function(
    "env",
    `const {window, nativeRAF, nativeCancelRAF, previousRAF, previousCancelRAF, v3Proof, clock} = env;
    let measuring = true, currentFrame = null, lastAudioSampleAt = -Infinity, startedAt = 0;
    const collectionWindow = {collectionId:'wrapper-literal'}, runtime = {world:{paused:false,tick:1}};
    const samples = {frame:new Map(), audioTelemetry:[], droppedSamples:0}, CAP = 90000;
    ${wrapper}
    return {samples, restoreRAFObserver};`,
  );
  const harness = create({
    window,
    nativeRAF,
    nativeCancelRAF,
    previousRAF,
    previousCancelRAF,
    v3Proof: proof,
    clock: () => ++now,
  });
  const raw = 17.000000000000004;
  for (const label of ["host", "R3F", "other-page-callback"]) {
    const id = window.requestAnimationFrame((value) => received.push({ label, value }));
    assert.equal(id, next - 1);
    const callback = pending.get(id);
    pending.delete(id);
    callback(raw);
  }
  assert.equal(received.length, 3);
  assert.ok(received.every((row) => float64Bits(row.value) === float64Bits(raw)));
  assert.equal(harness.samples.frame.get(raw).callbacks, 3);
  const canceledId = window.requestAnimationFrame(() =>
    assert.fail("cancelled native callback invoked"),
  );
  assert.equal(window.cancelAnimationFrame(canceledId), "native-cancel-result");
  assert.deepEqual(cancelled, [canceledId]);
  assert.equal(pending.has(canceledId), false);
  let throws = 0;
  const throwingId = window.requestAnimationFrame(() => {
    throws++;
    throw new Error("literal-callback-failure");
  });
  const callback = pending.get(throwingId);
  pending.delete(throwingId);
  assert.throws(() => callback(18), /literal-callback-failure/);
  assert.equal(throws, 1);
  assert.equal(harness.samples.frame.get(18).callbacks, 1);
  harness.restoreRAFObserver();
  assert.equal(window.requestAnimationFrame, previousRAF);
  assert.equal(window.cancelAnimationFrame, previousCancelRAF);
});
