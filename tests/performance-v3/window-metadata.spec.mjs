import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.env.BOUNDARY_TARGET ?? ".");
const source = await readFile(path.join(root, "tests/browser/performance-profile-v3.mjs"), "utf8");
function block(start, end) {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  if (a < 0 || b < a) throw Error(`ADAPTER_EXTRACTION_FAILURE:${start}`);
  return source.slice(a, b);
}
const helpers = block("const list =", "\nasync function main()").replaceAll(
  "export function ",
  "function ",
);
const api = new Function(
  "analyzeFrameCoverageV3",
  helpers +
    ";return {evaluateUIWorkload,closedWindowMetadataValid:typeof closedWindowMetadataValid==='function'?closedWindowMetadataValid:undefined};",
)(() => ({}));
function positive() {
  return {
    windowSnapshot: { status: "CLOSED_WINDOW" },
    pendingAtEnd: {
      timestamp: 600000,
      scriptBusy: false,
      runtimeBusy: false,
      recorderPending: false,
    },
    collectionWindow: { endPerformanceMs: 600000 },
    sampleMilliseconds: 600000,
    captureScheduleMs: [580000],
    captureWindows: [
      {
        index: 0,
        scheduledAtMs: 580000,
        start: { atMs: 580000, clockMode: "recording", paused: false },
        end: { atMs: 599000, paused: false },
        artifact: {
          status: "captured",
          sha256: "a".repeat(64),
          frameCount: 1,
          startTick: 1,
          endTick: 1,
        },
        requested: { tick: 0 },
        beforeStop: { tick: 1 },
        advanceCount: 1,
        overrunCount: 0,
        pausedAdvanceCount: 0,
        maxAccumulatorSeconds: 0,
      },
    ],
  };
}
function control() {
  const data = positive(),
    flags = api.evaluateUIWorkload(data);
  assert.equal(
    flags.closedWindowNoPending,
    true,
    "valid current pending metadata positive control",
  );
  assert.equal(flags.periodicCaptureCompleted, true, "valid finite capture positive control");
  return data;
}
for (const [name, value] of [
  ["absent", undefined],
  ["null", null],
  ["empty", {}],
  ["zero", 0],
  ["string", "false"],
  ["array", []],
  ["boolean", false],
])
  test(`CLOSED_WINDOW pending record rejects ${name}`, () => {
    const d = control();
    if (name === "absent") delete d.pendingAtEnd;
    else d.pendingAtEnd = value;
    assert.equal(api.evaluateUIWorkload(d).closedWindowNoPending, false);
  });
for (const flag of ["scriptBusy", "runtimeBusy", "recorderPending"])
  for (const [name, value] of [
    ["absent", undefined],
    ["null", null],
    ["zero", 0],
    ["stringfalse", "false"],
    ["emptystring", ""],
    ["true", true],
  ])
    test(`CLOSED_WINDOW ${flag} rejects ${name}`, () => {
      const d = control();
      if (name === "absent") delete d.pendingAtEnd[flag];
      else d.pendingAtEnd[flag] = value;
      assert.equal(api.evaluateUIWorkload(d).closedWindowNoPending, false);
    });
for (const [name, value] of [
  ["absent", undefined],
  ["null", null],
  ["string", "600000"],
  ["nan", NaN],
  ["infinite", Infinity],
  ["wrong", 599999],
])
  test(`CLOSED_WINDOW pending timestamp rejects ${name}`, () => {
    const d = control();
    if (name === "absent") delete d.pendingAtEnd.timestamp;
    else d.pendingAtEnd.timestamp = value;
    assert.equal(api.evaluateUIWorkload(d).closedWindowNoPending, false);
  });
for (const [name, value] of [
  ["null", null],
  ["string", "600000"],
  ["nan", NaN],
  ["infinite", Infinity],
])
  test(`CLOSED_WINDOW collection end rejects ${name}`, () => {
    const d = control();
    d.collectionWindow.endPerformanceMs = value;
    assert.equal(api.evaluateUIWorkload(d).closedWindowNoPending, false);
  });
for (const [name, value] of [
  ["absent", undefined],
  ["null", null],
  ["string", "599000"],
  ["nan", NaN],
  ["infinite", Infinity],
  ["late", 606000],
])
  test(`capture completion rejects ${name}`, () => {
    const d = control();
    if (name === "absent") delete d.captureWindows[0].end.atMs;
    else d.captureWindows[0].end.atMs = value;
    assert.equal(api.evaluateUIWorkload(d).periodicCaptureCompleted, false);
  });
const runnerBody = source.includes("// BEGIN_TESTABLE_UI_WINDOW_FINALIZATION")
  ? block("// BEGIN_TESTABLE_UI_WINDOW_FINALIZATION", "// END_TESTABLE_UI_WINDOW_FINALIZATION")
  : block("      let data, tail, uiFailure", "      if (bufferUsageCapped)");
const run = new Function(
  "d",
  `return(async()=>{${helpers};const {page,writeBoundedUIRaw,report,path,directory,UI_RAW_MAX_BYTES,checkpointThenCloseTrace,cdp,completion,traceObserver,formal,bufferUsage,saveOwnedTrace,FORMAL_TRACE_CAPS,SHORT_TRACE_CAPS}=d;let tracePhase,traceMeta;${runnerBody}})()`,
);
async function currentRunner(data) {
  const events = [];
  await run({
    page: {
      evaluate: async (fn) =>
        fn.toString().includes("getUIFinishTail") ||
        (!source.includes("getUIFinishTail") && fn.toString().includes("finishUI"))
          ? { status: "TAIL_DRAINED_OUTSIDE_WINDOW", cleanupErrors: [] }
          : data,
    },
    writeBoundedUIRaw: async () => ({ bytes: 1 }),
    report: {},
    path,
    directory: "synthetic",
    UI_RAW_MAX_BYTES: 4194304,
    checkpointThenCloseTrace: async ({ checkpoint, stop }) => {
      await checkpoint();
      await stop();
      return { traceMeta: {} };
    },
    cdp: { send: async () => events.push("trace") },
    completion: Promise.resolve(),
    traceObserver: { fault: new Promise(() => {}) },
    formal: false,
    bufferUsage: [],
    saveOwnedTrace: async () => events.push("save"),
    FORMAL_TRACE_CAPS: { compressedBytes: 1 },
    SHORT_TRACE_CAPS: { compressedBytes: 1 },
  });
  return events;
}
test("current runner accepts strong positive after trace flush", async () => {
  assert.deepEqual(await currentRunner(control()), ["trace", "save"]);
});
for (const mode of [
  "missing-marker",
  "null-marker",
  "empty-marker",
  "wrong-marker",
  "missing-pending",
  "empty-pending",
  "string-flag",
])
  test(`current runner never treats ${mode} as legacy`, async () => {
    const d = control();
    if (mode === "missing-marker") delete d.windowSnapshot;
    if (mode === "null-marker") d.windowSnapshot = null;
    if (mode === "empty-marker") d.windowSnapshot = {};
    if (mode === "wrong-marker") d.windowSnapshot.status = "MEASURED_NOT_TRACE_VERIFIED";
    if (mode === "missing-pending") delete d.pendingAtEnd;
    if (mode === "empty-pending") d.pendingAtEnd = {};
    if (mode === "string-flag") d.pendingAtEnd.scriptBusy = "false";
    await assert.rejects(currentRunner(d), /UI_CLOSED_WINDOW_METADATA_INVALID/);
  });
test("explicit historical evaluator compatibility remains available without current marker", () => {
  const d = control();
  delete d.windowSnapshot;
  delete d.pendingAtEnd;
  assert.equal(api.evaluateUIWorkload(d).closedWindowNoPending, true);
});
