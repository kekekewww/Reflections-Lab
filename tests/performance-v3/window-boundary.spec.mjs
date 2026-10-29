import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const root = path.resolve(process.env.BOUNDARY_TARGET ?? ".");
const fixture = await readFile(path.join(root, "tests/browser/performance-fixture-v3.mjs"), "utf8");
const runner = await readFile(path.join(root, "tests/browser/performance-profile-v3.mjs"), "utf8");
const proofModule = await import(
  pathToFileURL(path.resolve("tests/browser/performance-proof-v3.mjs"))
);
let quiesceProfile, runProfileTail;
try {
  ({ quiesceProfile, runProfileTail } = await import(
    pathToFileURL(path.join(root, "tests/browser/performance-quiescence-v3.mjs"))
  ));
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
function block(source, start, end) {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  if (a < 0 || b < a) throw Error(`ADAPTER_EXTRACTION_FAILURE:${start}`);
  return source.slice(a, b);
}
const prefix = block(fixture, "const previousRAF =", "\nconst makeBody =");
const finishing = block(
  fixture,
  fixture.includes("let closedUIRaw =")
    ? "let closedUIRaw ="
    : fixture.includes("function closeUIWindow()")
      ? "function closeUIWindow()"
      : "async function finishUI(",
  "\n// BEGIN_TESTABLE_PHYSICS_MAINTENANCE",
);
function host({
  resolveAfter = 6000,
  kind = "recorder",
  timeout = false,
  recordingState = "finalizing",
} = {}) {
  let now = 600000,
    elapsed = 0,
    artifact = null,
    disposing = 0,
    closes = 0;
  const timers = [],
    marks = [],
    pending = new Map();
  let id = 10;
  const native = (fn) => {
    pending.set(++id, fn);
    return id;
  };
  const window = {
    requestAnimationFrame: native,
    cancelAnimationFrame: (key) => pending.delete(key),
  };
  const performance = {
    now: () => now,
    mark: (name) => {
      marks.push({ name, at: now });
      return { startTime: now };
    },
  };
  const live = {
    pending: true,
    error: "literal-pending-worker-error",
    recordingState,
    operation: { type: "recordToggle", sequence: 57 },
  };
  const runtime = {
    busy: kind === "runtime",
    world: {
      paused: false,
      tick: 36000,
      clock: { mode: "interactive", accumulatorSeconds: 0, totalDroppedWallTimeSeconds: 0 },
    },
    recorder: {
      getView: () => ({
        pending: kind === "recorder" && live.pending,
        recording: { state: live.recordingState, error: live.error },
      }),
    },
    getSnapshot: () => ({ error: live.error, simulationState: "running" }),
    getSceneDocument: () => ({ id: "scene" }),
    getRecordingArtifact: () => artifact,
    dispatch: async () => {},
  };
  const build = new Function(
    "d",
    `const {window,requestAnimationFrame,cancelAnimationFrame,performance,createProofCollector,PerformanceObserver,setTimeout,quiesceProfile,runProfileTail}=d; ${prefix} ${fixture.includes("let activeProfileAction =") ? block(fixture, "let activeProfileAction =", ";\n") + ";" : ""} ${block(fixture, "function clockState()", "\nfunction artifactSummary()")} ${finishing}; return {samples,proof:v3Proof,finish:finishUI,tail:typeof getUIFinishTail==='function'?getUIFinishTail:null,close:typeof closeUIWindow==='function'?closeUIWindow:null,init(r){runtime=r;mounted={dispose(){d.dispose()}};observer={disconnect(){}};measuring=true;scriptBusy=d.kind==='script';activeInit();},settle(){scriptBusy=false;runtime.busy=false;},state:()=>({measuring,collectionWindow})};function activeInit(){startedAt=0;startedAtTick=0;currentCaptureIndex=2;measurementStartedClock={totalDroppedWallTimeSeconds:0};collectionWindow={collectionId:'boundary',endMarkName:'reflection-profile.end.boundary',endPerformanceMs:null};interpolationObservation={ms:[0.25],calls:1,requiredMethod:'interpolatedTransforms',observedMethods:['interpolatedTransforms'],successfulCalls:1,failedCalls:0,byMethod:{},aggregateScope:'all'};${fixture.includes("activeProfileAction") ? "activeProfileAction=d.live.operation;" : ""}v3Proof.begin('boundary');}`,
  );
  let h;
  let nextTimer = 1;
  const cancelled = new Set();
  function schedule(fn, ms) {
    const timer = nextTimer++,
      due = now + ms;
    const task = () => {
      if (cancelled.has(timer)) return;
      now = Math.max(now, due);
      elapsed = now - 600000;
      if (!timeout && live.pending && elapsed >= resolveAfter) {
        live.pending = false;
        h.settle();
        artifact = { artifactSha256: "late", status: "captured", frameCount: 12, traceBytes: 18 };
        h.samples.captureWindows[0].end = { atMs: now };
        h.samples.actions.push({ atMs: now, type: "lateCapture" });
      }
      fn();
    };
    task.due = due;
    task.id = timer;
    timers.push(task);
    return timer;
  }
  const deps = {
    window,
    requestAnimationFrame: native,
    cancelAnimationFrame: window.cancelAnimationFrame,
    performance,
    createProofCollector: proofModule.createProofCollector,
    PerformanceObserver: undefined,
    quiesceProfile,
    runProfileTail: (args) =>
      runProfileTail({ ...args, setTimer: schedule, clearTimer: (id) => cancelled.add(id) }),
    kind,
    live,
    dispose: () => disposing++,
    setTimeout: schedule,
  };
  h = build(deps);
  h.init(runtime);
  h.samples.captureWindows.push({ index: 2, start: { atMs: 580000 }, end: null });
  const values = [16.000000000000004, 32.00000000000001];
  for (const value of values) {
    const handle = window.requestAnimationFrame(() => {});
    const fn = pending.get(handle);
    pending.delete(handle);
    fn(value);
  }
  const expectedFrame = structuredClone([...h.samples.frame.values()]),
    expectedProof = structuredClone(h.proof.snapshot());
  return {
    ...h,
    live,
    window,
    runtime,
    schedule,
    cancelled,
    expectedFrame,
    expectedProof,
    timers,
    get elapsed() {
      return elapsed;
    },
    get now() {
      return now;
    },
    get marks() {
      return marks;
    },
    get disposing() {
      return disposing;
    },
    get closes() {
      return closes;
    },
  };
}
async function drive(h, promise) {
  let done = false,
    result,
    error;
  Promise.resolve(promise).then(
    (v) => {
      done = true;
      result = v;
    },
    (e) => {
      done = true;
      error = e;
    },
  );
  for (let i = 0; i < 15010 && !done; i++) {
    for (let j = 0; j < 30 && !done; j++) await Promise.resolve();
    if (!done && h.timers.length) {
      h.timers.sort((a, b) => a.due - b.due || a.id - b.id);
      h.timers.shift()();
    }
  }
  assert.ok(done, "ADAPTER_FAKE_TIMER_LIMIT");
  if (error) throw error;
  return result;
}
for (const kind of ["recorder", "runtime", "script"])
  test(`closed original frame/proof boundary survives ${kind} completion after 5s without backfill`, async () => {
    const h = host({ kind });
    let raw, tail, closedBytes;
    if (h.close) {
      raw = h.close();
      closedBytes = JSON.stringify(raw);
      tail = await drive(h, h.finish());
      if (h.tail) tail = h.tail();
      assert.equal(
        JSON.stringify(raw),
        closedBytes,
        "entire closed snapshot immutable across delayed work",
      );
    } else raw = await drive(h, h.finish());
    assert.equal(raw.collectionWindow.endPerformanceMs, 600000);
    assert.equal(raw.sampleMilliseconds, 600000);
    assert.deepEqual(
      raw.frame,
      h.expectedFrame,
      "all original callback timestamps and CPU samples unchanged",
    );
    assert.deepEqual(raw.v3Proof.frames, h.expectedProof.frames);
    assert.deepEqual(raw.v3Proof.callbacks, h.expectedProof.callbacks);
    assert.equal(raw.v3Proof.closed, true);
    assert.deepEqual(
      raw.frame.map((v) => proofModule.float64Bits(v.timestamp)),
      [16.000000000000004, 32.00000000000001].map(proofModule.float64Bits),
    );
    assert.equal(
      raw.captureWindows[0].end,
      null,
      "late completed capture must never backfill measured window",
    );
    assert.equal(raw.recorderArtifact, null);
    assert.equal(raw.actions.length, 0);
    assert.ok(raw.pendingAtEnd, "pending diagnostic is required");
    assert.equal(raw.pendingAtEnd.timestamp, 600000);
    assert.equal(raw.pendingAtEnd.captureIndex, 2);
    assert.equal(
      raw.pendingAtEnd[
        { recorder: "recorderPending", runtime: "runtimeBusy", script: "scriptBusy" }[kind]
      ],
      true,
    );
    assert.equal(raw.final.error, "literal-pending-worker-error");
    assert.deepEqual(raw.pendingAtEnd.operation, { type: "recordToggle", sequence: 57 });
    assert.ok(h.elapsed > 5000);
    assert.equal(h.marks.filter((x) => x.name === "reflection-profile.end.boundary").length, 1);
    assert.equal(tail.status, "TAIL_DRAINED_OUTSIDE_WINDOW");
    assert.equal(h.disposing, 1);
  });
function runnerBlock() {
  const begin = "// BEGIN_TESTABLE_UI_WINDOW_FINALIZATION",
    end = "// END_TESTABLE_UI_WINDOW_FINALIZATION";
  if (runner.includes(begin)) return block(runner, begin, end);
  const start = runner.includes("let data, tail, uiFailure")
    ? "      let data, tail, uiFailure"
    : "      const data = await page.evaluate(() => window.__performanceFixture.finishUI());";
  return block(runner, start, "      if (bufferUsageCapped)");
}
const executeRunner = new Function(
  "d",
  `return (async()=>{const {page,window,writeBoundedUIRaw,report,path,directory,UI_RAW_MAX_BYTES,checkpointThenCloseTrace,cdp,completion,traceObserver,formal,bufferUsage,saveOwnedTrace,FORMAL_TRACE_CAPS,SHORT_TRACE_CAPS}=d;let tracePhase,traceMeta;${runnerBlock()}})()`,
);
for (const kind of ["close", "write"])
  test(`runner ${kind} failure still finishes cleanup and preserves primary through trace`, async () => {
    const h = host(),
      primary = new Error(`literal-runner-${kind}`),
      events = [];
    const d = {
      page: {
        evaluate: async (fn) => {
          const text = fn.toString();
          if (text.includes("closeUIWindow")) {
            events.push("close");
            if (kind === "close") throw primary;
            return h.close();
          }
          if (text.includes("getUIFinishTail")) return h.tail();
          events.push("finish");
          return h.finish();
        },
      },
      window: {},
      writeBoundedUIRaw: async (file) => {
        if (kind === "write" && file.endsWith("ui.raw.json")) throw primary;
        return { sha256: "stub", bytes: 1 };
      },
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
    };
    let actual;
    try {
      await drive(h, executeRunner(d));
    } catch (error) {
      actual = error;
    }
    assert.equal(actual, primary);
    assert.deepEqual(events, ["close", "finish", "trace", "save"]);
    assert.equal(h.disposing, 1);
    assert.equal(h.state().measuring, false);
  });
for (const stopFails of [false, true])
  test(`runner checkpoints pending raw before timeout and attempts trace; stop failure=${stopFails}`, async () => {
    const h = host({ timeout: true }),
      events = [],
      writes = new Map(),
      report = {},
      traceError = new Error("literal-trace-stop-failure");
    const fixtureAPI = { closeUIWindow: h.close, finishUI: h.finish, getUIFinishTail: h.tail };
    const d = {
      page: {
        evaluate: async (fn) => {
          const name = fn.toString().includes("closeUIWindow")
            ? "closeUIWindow"
            : fn.toString().includes("getUIFinishTail")
              ? "getUIFinishTail"
              : "finishUI";
          events.push(name);
          if (name === "finishUI")
            events.push(writes.has("ui.raw.json") ? "RAW_ALREADY_SAVED" : "RAW_NOT_YET_SAVED");
          return fixtureAPI[name]();
        },
      },
      window: { __performanceFixture: fixtureAPI },
      writeBoundedUIRaw: async (file, value) => {
        events.push(path.basename(file));
        writes.set(path.basename(file), structuredClone(value));
        return { sha256: "stub", bytes: 12 };
      },
      report,
      path,
      directory: "synthetic",
      UI_RAW_MAX_BYTES: 4194304,
      checkpointThenCloseTrace: async ({ checkpoint, stop, timeoutMs }) => {
        assert.ok(Number.isFinite(timeoutMs) && timeoutMs <= 180000);
        await checkpoint();
        await stop();
        return { traceMeta: {} };
      },
      cdp: {
        send: async (method) => {
          events.push(method);
          if (stopFails) throw traceError;
        },
      },
      completion: Promise.resolve({}),
      traceObserver: { fault: new Promise(() => {}) },
      formal: false,
      bufferUsage: [],
      saveOwnedTrace: async () => events.push("saveTrace"),
      FORMAL_TRACE_CAPS: { compressedBytes: 1 },
      SHORT_TRACE_CAPS: { compressedBytes: 1 },
    };
    let failure;
    try {
      await drive(h, executeRunner(d));
    } catch (e) {
      failure = e;
    }
    assert.ok(failure, "pending timeout remains failing");
    assert.ok(writes.has("ui.raw.json"), "closed raw survives timeout");
    const raw = writes.get("ui.raw.json");
    assert.equal(raw.pendingAtEnd.recorderPending, true);
    assert.equal(raw.final.error, "literal-pending-worker-error");
    assert.equal(raw.captureWindows[0].end, null);
    assert.ok(events.indexOf("ui.raw.json") < events.indexOf("finishUI"));
    assert.ok(events.includes("RAW_ALREADY_SAVED"));
    assert.ok(!events.includes("RAW_NOT_YET_SAVED"));
    assert.ok(events.includes("Tracing.end"), "trace stop attempted after primary failure");
    if (stopFails) {
      assert.ok(failure instanceof AggregateError);
      assert.match(String(failure.errors[0]), /PROFILE_(?:SCRIPT_DID_NOT_QUIESCE|TAIL_TIMEOUT)/);
      assert.equal(failure.errors[1], traceError);
    } else {
      assert.match(String(failure), /PROFILE_(?:SCRIPT_DID_NOT_QUIESCE|TAIL_TIMEOUT)/);
      assert.ok(events.includes("saveTrace"));
    }
    assert.ok(h.elapsed <= 135000, "bounded drain");
    assert.equal(h.disposing, 1);
  });

const evaluateUIWorkload = new Function(
  "analyzeFrameCoverageV3",
  block(runner, "const list =", "\nasync function main()").replaceAll(
    "export function ",
    "function ",
  ) + ";return evaluateUIWorkload;",
)(() => ({}));
test("late completion remains workload failure even after successful tail drain", async () => {
  const h = host();
  let raw;
  if (h.close) {
    raw = h.close();
    await drive(h, h.finish());
  } else raw = await drive(h, h.finish());
  const flags = evaluateUIWorkload(raw);
  assert.equal(flags.closedWindowNoPending, false);
  assert.equal(flags.periodicCaptureCompleted, false);
  const backfilled = structuredClone(raw);
  backfilled.pendingAtEnd = { scriptBusy: false, runtimeBusy: false, recorderPending: false };
  backfilled.captureScheduleMs = [580000];
  backfilled.captureWindows = [
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
  ];
  assert.equal(
    evaluateUIWorkload(backfilled).periodicCaptureCompleted,
    true,
    "positive completed capture control",
  );
  backfilled.captureWindows[0].end.atMs = 606000;
  assert.equal(
    evaluateUIWorkload(backfilled).periodicCaptureCompleted,
    false,
    "capture completion outside closed 600s always rejected",
  );
});

for (const scenario of [
  "pause-never",
  "record-stop-never",
  "busy100s-pause60s",
  "late-pause-reject",
])
  test(`entire tail shares single 135s deadline: ${scenario}`, async () => {
    const h = host({
      resolveAfter: scenario === "busy100s-pause60s" ? 100000 : 0,
      recordingState: scenario === "record-stop-never" ? "recording" : "finalizing",
    });
    if (scenario !== "busy100s-pause60s") h.live.pending = false;
    const primary = new Error("literal-late-pause-rejection"),
      unhandled = [];
    const listener = (error) => unhandled.push(error);
    process.on("unhandledRejection", listener);
    h.runtime.dispatch = (command) => {
      if (scenario === "record-stop-never")
        return command.type === "recordToggle" ? new Promise(() => {}) : Promise.resolve();
      if (scenario === "busy100s-pause60s")
        return new Promise((resolve) => h.schedule(resolve, 60000));
      if (scenario === "late-pause-reject")
        return new Promise((resolve, reject) => h.schedule(() => reject(primary), 145000));
      return new Promise(() => {});
    };
    const raw = h.close(),
      before = JSON.stringify(raw);
    let actual;
    try {
      try {
        await drive(h, h.finish());
      } catch (error) {
        actual = error;
      }
      assert.match(String(actual), /PROFILE_TAIL_TIMEOUT/);
      assert.equal(h.elapsed, 135000, "one total deadline, including initial drain");
      assert.equal(h.tail().deadlinePerformanceMs, 735000);
      assert.equal(h.tail().status, "TAIL_INCOMPLETE_UNVERIFIED");
      assert.equal(h.disposing, 1);
      assert.equal(h.state().measuring, false);
      assert.equal(JSON.stringify(raw), before, "timed out tail leaves original window intact");
      if (scenario === "late-pause-reject") {
        for (let i = 0; i < 5 && h.timers.length; i++) {
          h.timers.sort((a, b) => a.due - b.due);
          h.timers.shift()();
          for (let j = 0; j < 30; j++) await Promise.resolve();
        }
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(unhandled.length, 0, "late work rejection is observed");
        assert.equal(h.disposing, 1);
        assert.equal(JSON.stringify(raw), before);
      }
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

// Shared actual-fixture adapter for supplemental tail failure-preservation cases.
export { host as makeWindowHost, drive as driveWindow };
