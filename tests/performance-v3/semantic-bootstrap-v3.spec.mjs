// RED contract for one real post-begin timer; this is a versioned semantic
// fixture, never a replacement for the original numeric coverage gate.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createContext, Script } from "node:vm";
import { createProofCollector } from "../browser/performance-proof-v3.mjs";

const moduleUrl = new URL("../browser/performance-semantic-bootstrap-v1.mjs", import.meta.url);
const candidate = existsSync(moduleUrl) ? await import(moduleUrl.href) : {};
const clone = (value) => structuredClone(value);
const collectionId = "bootstrap-contract-1";
const handle = 17;
const enterName = `rlab-semantic.bootstrap.enter.${collectionId}.${handle}`;
const exitName = `rlab-semantic.bootstrap.exit.${collectionId}.${handle}`;
const snapshotKeys = [
  "schemaVersion",
  "method",
  "collectionId",
  "state",
  "scheduleCount",
  "fireCount",
  "requestedDelayMs",
  "timerHandle",
  "scheduledAtPerformanceMs",
  "enteredAtPerformanceMs",
  "exitedAtPerformanceMs",
  "enterMarkName",
  "exitMarkName",
];

function harness() {
  let now = 42;
  const scheduled = [];
  const cancelled = [];
  const marks = [];
  let clockReads = 0;
  const bootstrap = candidate.createSemanticBootstrap({
    collectionId,
    clock() {
      clockReads++;
      return now;
    },
    mark(name) {
      marks.push(name);
    },
    schedule(callback, delay) {
      scheduled.push({ callback, delay });
      return handle;
    },
    cancel(timer) {
      cancelled.push(timer);
    },
  });
  return {
    bootstrap,
    scheduled,
    cancelled,
    marks,
    setNow(value) {
      now = value;
    },
    get clockReads() {
      return clockReads;
    },
  };
}

test("bootstrap exposes independent one-shot scheduler and raw evidence verifier", () => {
  assert.equal(typeof candidate.createSemanticBootstrap, "function");
  assert.equal(typeof candidate.verifySemanticBootstrapV1, "function");
});

test("bootstrap unmeasured timestamps remain null before any real callback", () => {
  if (typeof candidate.createSemanticBootstrap !== "function") return;
  const h = harness();
  const value = h.bootstrap.snapshot();
  assert.deepEqual(Object.keys(value).sort(), [...snapshotKeys].sort());
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.method, "ONE_SHOT_POST_BEGIN");
  assert.equal(value.collectionId, collectionId);
  assert.equal(value.state, "IDLE");
  assert.equal(value.scheduleCount, 0);
  assert.equal(value.fireCount, 0);
  assert.equal(value.requestedDelayMs, 0);
  for (const key of [
    "timerHandle",
    "scheduledAtPerformanceMs",
    "enteredAtPerformanceMs",
    "exitedAtPerformanceMs",
    "enterMarkName",
    "exitMarkName",
  ])
    assert.equal(value[key], null);
  assert.equal(h.clockReads, 0);
  assert.equal(h.scheduled.length, 0);
});

test("bootstrap schedules exactly one zero-requested-delay timer and records real callback clocks", () => {
  if (typeof candidate.createSemanticBootstrap !== "function") return;
  const h = harness();
  h.bootstrap.schedule();
  assert.equal(h.scheduled.length, 1);
  assert.equal(h.scheduled[0].delay, 0);
  const pending = h.bootstrap.snapshot();
  assert.equal(pending.state, "SCHEDULED");
  assert.equal(pending.scheduleCount, 1);
  assert.equal(pending.fireCount, 0);
  assert.equal(pending.timerHandle, handle);
  assert.equal(pending.scheduledAtPerformanceMs, 42);
  assert.equal(pending.enteredAtPerformanceMs, null);
  assert.equal(pending.exitedAtPerformanceMs, null);
  h.setNow(43);
  // The independent clock advances during the actual enter mark, not from a guessed delay.
  const originalMark = h.marks.push.bind(h.marks);
  h.marks.push = (name) => {
    originalMark(name);
    if (name === enterName) h.setNow(43.25);
  };
  h.scheduled[0].callback();
  const done = h.bootstrap.snapshot();
  assert.deepEqual(Object.keys(done).sort(), [...snapshotKeys].sort());
  assert.equal(done.state, "FIRED");
  assert.equal(done.fireCount, 1);
  assert.equal(done.enteredAtPerformanceMs, 43);
  assert.equal(done.exitedAtPerformanceMs, 43.25);
  assert.equal(done.enterMarkName, enterName);
  assert.equal(done.exitMarkName, exitName);
  assert.deepEqual(Array.from(h.marks), [enterName, exitName]);
  assert.ok(h.marks.every((name) => !name.startsWith("rlab-v3.observe.")));
  assert.equal(
    done.enteredAtPerformanceMs - done.scheduledAtPerformanceMs,
    1,
    "requested delay zero is not measured delivery delay zero",
  );
  assert.throws(() => h.bootstrap.schedule());
  h.bootstrap.restore();
  assert.equal(h.bootstrap.snapshot().state, "FIRED");
  assert.deepEqual(h.cancelled, []);
});

test("restore cancels the owned pending timer once and ignores late canceled delivery", () => {
  if (typeof candidate.createSemanticBootstrap !== "function") return;
  const h = harness();
  h.bootstrap.schedule();
  h.bootstrap.restore();
  h.bootstrap.restore();
  assert.deepEqual(h.cancelled, [handle]);
  assert.equal(h.bootstrap.snapshot().state, "CANCELLED");
  const reads = h.clockReads;
  h.scheduled[0].callback();
  assert.equal(h.clockReads, reads);
  assert.equal(h.bootstrap.snapshot().fireCount, 0);
  assert.equal(h.bootstrap.snapshot().enteredAtPerformanceMs, null);
  assert.deepEqual(h.marks, []);
  assert.throws(() => h.bootstrap.schedule());
});

test("a duplicate callback cannot create a heartbeat or a second measurement", () => {
  if (typeof candidate.createSemanticBootstrap !== "function") return;
  const h = harness();
  h.bootstrap.schedule();
  h.setNow(43);
  h.scheduled[0].callback();
  const done = h.bootstrap.snapshot();
  const reads = h.clockReads;
  h.scheduled[0].callback();
  assert.deepEqual(h.bootstrap.snapshot(), done);
  assert.equal(h.clockReads, reads);
  assert.equal(h.scheduled.length, 1);
  assert.equal(h.marks.length, 2);
});

test("snapshot mutations cannot alter the scheduler's stored evidence", () => {
  if (typeof candidate.createSemanticBootstrap !== "function") return;
  const h = harness();
  h.bootstrap.schedule();
  const exposed = h.bootstrap.snapshot();
  exposed.scheduleCount = 99;
  exposed.timerHandle = 999;
  assert.equal(h.bootstrap.snapshot().scheduleCount, 1);
  assert.equal(h.bootstrap.snapshot().timerHandle, handle);
});

function fixture(entry = 102) {
  const origin = 100,
    finish = 200,
    begin = 1_000_000,
    end = 1_100_000;
  const entryUs = begin + (entry - origin) * 1000;
  const exit = entry + 0.25;
  const exitMarkTime = entry + 0.125;
  const exitUs = begin + (exitMarkTime - origin) * 1000;
  const doc = {
    id: "frame-bootstrap-1",
    loaderId: "navigation-bootstrap-1",
    url: "http://127.0.0.1:53908/performance-semantic-pilot-v2.html",
  };
  const task = {
    name: "ThreadControllerImpl::RunTask",
    cat: "toplevel",
    ph: "X",
    pid: 11,
    tid: 22,
    ts: entryUs - 200,
    dur: 700,
    args: {
      src_file: "third_party/blink/renderer/core/scheduler/dom_timer.cc",
      src_func: "DOMTimer",
      src_line: 356,
    },
  };
  const mark = (name, ts, startTime) => ({
    name,
    cat: "blink.user_timing",
    ph: "I",
    s: "t",
    pid: 11,
    tid: 22,
    ts,
    args: {
      data: { callTime: ts + 10, navigationId: doc.loaderId, sampleTraceId: 12345, startTime },
    },
  });
  return {
    bootstrap: {
      schemaVersion: 1,
      method: "ONE_SHOT_POST_BEGIN",
      collectionId,
      state: "FIRED",
      scheduleCount: 1,
      fireCount: 1,
      requestedDelayMs: 0,
      timerHandle: handle,
      scheduledAtPerformanceMs: 100.25,
      enteredAtPerformanceMs: entry,
      exitedAtPerformanceMs: exit,
      enterMarkName: enterName,
      exitMarkName: exitName,
    },
    ui: {
      startedAtPerformanceMs: origin,
      sampleMilliseconds: finish - origin,
      collectionWindow: {
        schemaVersion: "3.0.0",
        collectionId,
        beginMarkName: `reflection-profile.begin.${collectionId}`,
        endMarkName: `reflection-profile.end.${collectionId}`,
        beginPerformanceMs: origin,
        endPerformanceMs: finish,
      },
    },
    events: [
      clone(task),
      {
        name: "TimerInstall",
        cat: "devtools.timeline",
        ph: "I",
        s: "t",
        pid: 11,
        tid: 22,
        ts: begin + 300,
        args: { data: { frame: doc.id, timerId: handle, timeout: 0, singleShot: true } },
      },
      {
        name: "TimerFire",
        cat: "devtools.timeline",
        ph: "X",
        pid: 11,
        tid: 22,
        ts: entryUs - 100,
        dur: 400,
        args: { data: { frame: doc.id, timerId: handle } },
      },
      mark(enterName, entryUs + 10, entry + 0.01),
      mark(exitName, exitUs + 10, exitMarkTime),
    ],
    context: {
      documentBefore: clone(doc),
      documentAfter: clone(doc),
      traceDataLoss: false,
      traceStreamClosed: true,
      nativeEligibility: {
        qualified: true,
        expectedPid: 11,
        expectedTid: 22,
        expectedNavigationId: doc.loaderId,
        begin,
        end,
        validatedTasks: [clone(task)],
      },
    },
  };
}
function call(f) {
  return candidate.verifySemanticBootstrapV1(f.bootstrap, f.ui, f.events, f.context);
}
function rejected(f) {
  let result;
  assert.doesNotThrow(() => {
    result = call(f);
  });
  assert.equal(result.qualified, false);
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
}
function nextFloat(value) {
  const storage = new ArrayBuffer(8);
  const view = new DataView(storage);
  view.setFloat64(0, value, false);
  view.setBigUint64(0, view.getBigUint64(0, false) + 1n, false);
  return view.getFloat64(0, false);
}

test("bootstrap verifies actual unique timer and marks inside the complete raw owned task", () => {
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const f = fixture();
  const before = clone(f);
  const result = call(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.deepEqual(result.reasons, []);
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.deepEqual(f, before);
});

test("a bootstrap delivered exactly fifty ms after the original begin stays eligible", () => {
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const f = fixture(150);
  // The actual captured mark clock also sits exactly on the unchanged boundary.
  f.events[3].args.data.startTime = 150;
  assert.equal(f.bootstrap.enteredAtPerformanceMs - f.ui.startedAtPerformanceMs, 50);
  const result = call(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
});
test("the next Float64 above the fifty-ms boundary is rejected without epsilon", () => {
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const f = fixture(nextFloat(150));
  assert.ok(f.bootstrap.enteredAtPerformanceMs - f.ui.startedAtPerformanceMs > 50);
  rejected(f);
});

const mutations = {
  "missing bootstrap cannot be rescued by advertised flags": (f) => {
    f.bootstrap = null;
    f.context.qualified = true;
  },
  "unfired timer": (f) => {
    f.bootstrap.state = "SCHEDULED";
    f.bootstrap.fireCount = 0;
    f.bootstrap.enteredAtPerformanceMs = null;
  },
  "canceled timer": (f) => {
    f.bootstrap.state = "CANCELLED";
  },
  "second schedule": (f) => {
    f.bootstrap.scheduleCount = 2;
  },
  "second fire": (f) => {
    f.bootstrap.fireCount = 2;
  },
  "nonzero requested delay": (f) => {
    f.bootstrap.requestedDelayMs = 1;
  },
  "wrong collection": (f) => {
    f.bootstrap.collectionId = "another-collection";
  },
  "scheduled before the original begin": (f) => {
    f.bootstrap.scheduledAtPerformanceMs = 99.99;
  },
  "entry before schedule": (f) => {
    f.bootstrap.enteredAtPerformanceMs = 100.1;
  },
  "exit before entry": (f) => {
    f.bootstrap.exitedAtPerformanceMs = 101.9;
  },
  "exit after the unchanged close": (f) => {
    f.bootstrap.exitedAtPerformanceMs = 200.1;
  },
  "nonfinite entry": (f) => {
    f.bootstrap.enteredAtPerformanceMs = NaN;
  },
  "nonfinite exit": (f) => {
    f.bootstrap.exitedAtPerformanceMs = Infinity;
  },
  "missing measured schedule": (f) => {
    f.bootstrap.scheduledAtPerformanceMs = null;
  },
  "entry changed to a clock after the real enter mark": (f) => {
    f.bootstrap.enteredAtPerformanceMs = 102.05;
  },
  "exit changed to a clock before the real exit mark": (f) => {
    f.bootstrap.exitedAtPerformanceMs = 102.1;
  },
  "aux entry fabricated early cannot hide the actual native mark clock": (f) => {
    f.events[3].args.data.startTime = 151;
    f.events[4].args.data.startTime = 151.125;
  },
  "aux exit fabricated late cannot hide an exit mark before entry": (f) => {
    f.bootstrap.exitedAtPerformanceMs = 199;
    f.events[4].args.data.startTime = 101.9;
  },
  "enter mark startTime unknown": (f) => {
    delete f.events[3].args.data.startTime;
  },
  "exit mark startTime unknown": (f) => {
    delete f.events[4].args.data.startTime;
  },
  "enter mark startTime nonfinite": (f) => {
    f.events[3].args.data.startTime = NaN;
  },
  "exit mark startTime nonfinite": (f) => {
    f.events[4].args.data.startTime = Infinity;
  },
  "mark clock ordering reversed": (f) => {
    f.events[3].args.data.startTime = 102.2;
    f.events[4].args.data.startTime = 102.1;
  },
  "enter mark clock after close": (f) => {
    f.events[3].args.data.startTime = 200.1;
  },
  "exit mark clock after close": (f) => {
    f.events[4].args.data.startTime = 200.1;
  },

  "bootstrap timer is another handle": (f) => {
    f.bootstrap.timerHandle = 18;
  },
  "missing TimerInstall": (f) => {
    f.events.splice(1, 1);
  },
  "missing TimerFire": (f) => {
    f.events.splice(2, 1);
  },
  "duplicate TimerInstall": (f) => {
    f.events.push(clone(f.events[1]));
  },
  "duplicate TimerFire": (f) => {
    f.events.push(clone(f.events[2]));
  },
  "TimerInstall on another positive owner": (f) => {
    f.events[1].pid += 1;
  },
  "TimerFire on another positive owner": (f) => {
    f.events[2].tid += 1;
  },
  "TimerInstall another document": (f) => {
    f.events[1].args.data.frame = "another-frame";
  },
  "TimerFire another document": (f) => {
    f.events[2].args.data.frame = "another-frame";
  },
  "TimerInstall malformed present args": (f) => {
    f.events[1].args.data = null;
  },
  "TimerFire malformed present args": (f) => {
    f.events[2].args.data = null;
  },
  "TimerInstall unknown timerId": (f) => {
    f.events[1].args.data.timerId = 18;
  },
  "TimerFire unknown timerId": (f) => {
    f.events[2].args.data.timerId = 18;
  },
  "TimerInstall repeated timer": (f) => {
    f.events[1].args.data.singleShot = false;
  },
  "TimerInstall actual nonzero request": (f) => {
    f.events[1].args.data.timeout = 1;
  },
  "TimerInstall wrong category": (f) => {
    f.events[1].cat = "blink.user_timing";
  },
  "TimerFire wrong category": (f) => {
    f.events[2].cat = "toplevel";
  },
  "TimerInstall invalid instant": (f) => {
    f.events[1].ph = "B";
  },
  "TimerFire missing duration": (f) => {
    delete f.events[2].dur;
  },
  "TimerFire negative duration": (f) => {
    f.events[2].dur = -1;
  },
  "TimerInstall after Fire": (f) => {
    f.events[1].ts = f.events[2].ts + 1;
  },
  "TimerInstall before the unchanged begin": (f) => {
    f.events[1].ts = f.context.nativeEligibility.begin - 1;
  },
  "TimerFire after the unchanged end": (f) => {
    f.events[2].ts = f.context.nativeEligibility.end + 1;
  },
  "missing enter mark": (f) => {
    f.events.splice(3, 1);
  },
  "missing exit mark": (f) => {
    f.events.splice(4, 1);
  },
  "duplicate enter mark": (f) => {
    f.events.push(clone(f.events[3]));
  },
  "duplicate exit mark": (f) => {
    f.events.push(clone(f.events[4]));
  },
  "mark from another owner": (f) => {
    f.events[3].tid += 1;
  },
  "mark from another navigation": (f) => {
    f.events[3].args.data.navigationId = "other-navigation";
  },
  "mark unknown callTime": (f) => {
    f.events[3].args.data.callTime = null;
  },
  "mark nonfinite callTime": (f) => {
    f.events[3].args.data.callTime = NaN;
  },
  "mark physical callTime outside its Fire": (f) => {
    f.events[4].args.data.callTime = f.events[2].ts + f.events[2].dur + 1;
  },
  "enter and exit physical callTimes reversed": (f) => {
    f.events[3].args.data.callTime = f.events[4].args.data.callTime + 1;
  },
  "mark wrong category": (f) => {
    f.events[3].cat = "devtools.timeline";
  },
  "mark mislabeled as an old V3 proof": (f) => {
    f.bootstrap.enterMarkName = "rlab-v3.observe.forged";
    f.events[3].name = f.bootstrap.enterMarkName;
  },
  "native context unqualified": (f) => {
    f.context.nativeEligibility.qualified = false;
  },
  "native context wrong navigation": (f) => {
    f.context.nativeEligibility.expectedNavigationId = "other-navigation";
  },
  "changed document": (f) => {
    f.context.documentAfter.loaderId = "another-navigation";
  },
  "trace loss": (f) => {
    f.context.traceDataLoss = true;
  },
  "trace close unknown": (f) => {
    delete f.context.traceStreamClosed;
  },
  "no validated complete task": (f) => {
    f.context.nativeEligibility.validatedTasks = [];
  },
  "native complete task absent from raw": (f) => {
    f.events.splice(0, 1);
  },
  "raw task differs from the validated complete task": (f) => {
    f.events[0].dur += 1;
  },
  "task not complete": (f) => {
    f.events[0].ph = "B";
    f.context.nativeEligibility.validatedTasks[0].ph = "B";
  },
  "task contains marks but not the whole Fire": (f) => {
    f.events[0].ts = f.events[2].ts + 1;
    f.context.nativeEligibility.validatedTasks[0].ts = f.events[0].ts;
  },
  "task another positive owner": (f) => {
    f.events[0].pid += 1;
    f.context.nativeEligibility.validatedTasks[0].pid += 1;
  },
  "task wrong category": (f) => {
    f.events[0].cat = "devtools.timeline";
    f.context.nativeEligibility.validatedTasks[0].cat = "devtools.timeline";
  },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`bootstrap rejects ${name}`, () => {
    if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
    const f = fixture();
    mutate(f);
    rejected(f);
  });
}
for (const [name, mutate] of [
  [
    "null ui",
    (f) => {
      f.ui = null;
    },
  ],
  [
    "null events",
    (f) => {
      f.events = null;
    },
  ],
  [
    "null context",
    (f) => {
      f.context = null;
    },
  ],
]) {
  test(`bootstrap returns controlled rejection for ${name}`, () => {
    if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
    const f = fixture();
    mutate(f);
    rejected(f);
  });
}

test("the actual attempt02 missing bootstrap remains rejected and original raw bytes stay exact", () => {
  const root = new URL(
    "../../docs/16-nonadvanced-completion/lanes/performance/semantic-attempt02-v4/",
    import.meta.url,
  );
  const trace = readFileSync(new URL("native/pilot.trace.json.gz", root));
  assert.equal(
    createHash("sha256").update(trace).digest("hex"),
    "02e874df3350dbab25db5a9b10c7503bc2bc9bd65f26b87c613aa952fd767d0b",
  );
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const raw = JSON.parse(readFileSync(new URL("native/pilot.raw.json", root), "utf8"));
  const verification = JSON.parse(readFileSync(new URL("native/verification.json", root), "utf8"));
  const analysis = JSON.parse(
    readFileSync(new URL("native/pilot.native-analysis.json", root), "utf8"),
  );
  const events = JSON.parse(gunzipSync(trace).toString("utf8")).traceEvents;
  rejected({
    bootstrap: null,
    ui: raw.ui,
    events,
    context: {
      documentBefore: verification.documentBefore,
      documentAfter: verification.documentAfter,
      traceDataLoss: false,
      traceStreamClosed: true,
      nativeEligibility: analysis.nativeEligibility,
    },
  });
  assert.equal(analysis.nativeEligibility.legacyRawEligibility.qualified, true);
  assert.equal(analysis.complete, false);
  assert.deepEqual(analysis.mainTaskOccupancyMs, []);
});

// The pinned category configuration omits disabled-by-default-devtools.timeline.stack.
// Its exact observed TimerInstall.data shape has four keys; this is not a generic
// Chromium parser contract for captures with the optional stack category enabled.
test("an extra stack field is rejected for the exact pinned no-stack capture config", () => {
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const f = fixture();
  f.events[1].args.data.stackTrace = [{ functionName: "schedule", scriptId: "8" }];
  rejected(f);
});

test("a fully foreign document may independently reuse the same numeric timerId", () => {
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const f = fixture();
  const install = clone(f.events[1]),
    fire = clone(f.events[2]);
  for (const row of [install, fire]) {
    row.pid = 33;
    row.tid = 44;
    row.args.data.frame = "foreign-frame";
  }
  f.events.push(install, fire);
  const result = call(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
});

test("quantized same-value callback clocks stay actual values rather than being fabricated", () => {
  if (typeof candidate.createSemanticBootstrap !== "function") return;
  const h = harness();
  h.bootstrap.schedule();
  h.setNow(43);
  h.scheduled[0].callback();
  assert.equal(h.bootstrap.snapshot().enteredAtPerformanceMs, 43);
  assert.equal(h.bootstrap.snapshot().exitedAtPerformanceMs, 43);
  assert.equal(h.bootstrap.snapshot().state, "FIRED");
  assert.equal(h.marks.length, 2);
});

const pageV2Url = new URL("../browser/performance-semantic-page-v2.mjs", import.meta.url);
test("the versioned bootstrap page is separate from the frozen original semantic page", () => {
  assert.equal(existsSync(pageV2Url), true);
  const oldBytes = readFileSync(
    new URL("../browser/performance-semantic-page-v1.mjs", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(oldBytes).digest("hex"),
    "8f712452ba026711acb57ef07dd75631c02b552c0e4cbc4e37fbd8eddad28ab7",
  );
});

test("versioned page keeps all original callbacks and schedules only one bootstrap before close", async () => {
  if (!existsSync(pageV2Url) || typeof candidate.createSemanticBootstrap !== "function") return;
  const source = readFileSync(pageV2Url, "utf8");
  const executable = source.replace(
    /^\s*import\s*\{[^}]*\}\s*from\s*["']\.\/performance-(?:proof-v3|semantic-bootstrap-v1)\.mjs["'];?/gm,
    "",
  );
  assert.doesNotMatch(executable, /^\s*import\s/m);
  let wall = 100,
    rafId = 0,
    timerId = 0;
  const rafs = new Map(),
    timers = new Map(),
    allSchedules = [],
    marks = [];
  const status = { textContent: "" };
  const nativeRaf = (callback) => {
    const id = ++rafId;
    rafs.set(id, callback);
    return id;
  };
  const nativeCancel = (id) => {
    rafs.delete(id);
  };
  const timeout = (callback, delay) => {
    const id = ++timerId;
    timers.set(id, callback);
    allSchedules.push({ id, delay });
    return id;
  };
  const scope = {
    performance: {
      now: () => wall,
      mark: (name, options) => {
        const value = { name, startTime: options?.startTime ?? wall };
        marks.push(value);
        return value;
      },
    },
    requestAnimationFrame: nativeRaf,
    cancelAnimationFrame: nativeCancel,
    setTimeout: timeout,
    clearTimeout: (id) => timers.delete(id),
    crypto: { randomUUID: () => "bootstrap-vm-page-1" },
    document: { getElementById: () => status },
    structuredClone,
    createProofCollector,
    createSemanticBootstrap: candidate.createSemanticBootstrap,
  };
  scope.window = scope;
  const context = createContext(scope);
  new Script(executable, { filename: "performance-semantic-page-v2.mjs" }).runInContext(context);
  const originalRaf = scope.requestAnimationFrame,
    originalCancel = scope.cancelAnimationFrame;
  const pendingResult = scope.__semanticPilot.prepareAndPause();
  assert.equal(
    allSchedules.length,
    1,
    "only the bootstrap timer is scheduled at the unchanged begin",
  );
  assert.equal(allSchedules[0].delay, 0);
  assert.equal(rafs.size, 2, "both pretrace RAF registrations remain pending at begin");
  const begin = marks.find((row) => row.name.startsWith("reflection-profile.begin."));
  assert.ok(begin);
  assert.equal(begin.startTime, 100);
  const bootstrapTimer = timers.get(allSchedules[0].id);
  timers.delete(allSchedules[0].id);
  wall = 101;
  bootstrapTimer();
  assert.equal(allSchedules.length, 1, "bootstrap does not schedule another heartbeat");
  const groups = [];
  for (let group = 0; group < 13; group++) {
    const current = [...rafs.entries()];
    rafs.clear();
    assert.ok(current.length > 0);
    groups.push(current.length);
    wall = 102 + group * 16;
    for (const [, callback] of current) callback(wall - 0.25);
  }
  assert.deepEqual(groups, [2, 3, 2, 1, 3, 2, 1, 2, 2, 1, 2, 1, 2]);
  assert.equal(rafs.size, 0);
  assert.equal(allSchedules.length, 2, "the only additional timer is the original close timer");
  assert.equal(timers.size, 1);
  const closeTimer = [...timers.values()][0];
  timers.clear();
  wall += 0.5;
  closeTimer();
  const result = await pendingResult;
  assert.equal(
    result.ui.startedAtPerformanceMs,
    100,
    "the begin is not moved to the bootstrap callback",
  );
  assert.equal(result.ui.collectionWindow.endPerformanceMs, wall);
  assert.equal(result.ui.sampleMilliseconds, wall - 100);
  assert.equal(result.journal.operations.filter((row) => row.kind === "register").length, 26);
  assert.equal(result.journal.operations.filter((row) => row.kind === "callback").length, 24);
  assert.equal(result.ui.frame.length, 13);
  assert.equal(result.bootstrap.scheduleCount, 1);
  assert.equal(result.bootstrap.fireCount, 1);
  assert.equal(result.bootstrap.state, "FIRED");
  assert.equal(result.bootstrap.scheduledAtPerformanceMs, 100);
  assert.equal(result.bootstrap.enteredAtPerformanceMs, 101);
  assert.equal(result.bootstrap.exitedAtPerformanceMs, 101);
  const restore = scope.__semanticPilot.restore();
  assert.equal(restore.nativeRafIdentityUnchanged, true);
  assert.equal(restore.nativeCancelIdentityUnchanged, true);
  assert.equal(restore.pendingAfterRestore, 0);
  assert.equal(scope.requestAnimationFrame, originalRaf);
  assert.equal(scope.cancelAnimationFrame, originalCancel);
  assert.equal(allSchedules.length, 2);
  assert.equal(timers.size, 0);
});

test("an auxiliary early-entry claim cannot hide a captured timer and enter mark after fifty ms", () => {
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const f = fixture(151);
  f.bootstrap.enteredAtPerformanceMs = 102;
  // Preserve a separate, real complete head task so the original numeric edge
  // criterion would not be the only reason to reject this forged auxiliary clock.
  const headTask = clone(f.events[0]);
  headTask.ts = f.context.nativeEligibility.begin + 500;
  headTask.dur = 50;
  f.events.push(clone(headTask));
  f.context.nativeEligibility.validatedTasks.push(headTask);
  assert.ok(f.events[2].ts - f.context.nativeEligibility.begin > 50_000);
  assert.ok(f.events[3].args.data.startTime - f.ui.startedAtPerformanceMs > 50);
  assert.ok(f.bootstrap.enteredAtPerformanceMs - f.ui.startedAtPerformanceMs < 50);
  assert.ok(f.bootstrap.exitedAtPerformanceMs > f.events[4].args.data.startTime);
  rejected(f);
});

const runnerV3Url = new URL("../browser/performance-semantic-runner-v3.mjs", import.meta.url);
const commandV3Url = new URL("../browser/performance-semantic-command-v3.mjs", import.meta.url);
const runnerV3 = existsSync(runnerV3Url) ? await import(runnerV3Url.href) : {};
const commandV3 = existsSync(commandV3Url) ? await import(commandV3Url.href) : {};
const commandV2 = await import("../browser/performance-semantic-command-v2.mjs");

function completeEvidenceReport() {
  return {
    journalOracle: { qualified: true },
    strictNative: { qualified: true },
    nativeJournalCorroboration: { qualified: true },
    bootstrapCapture: { qualified: true },
    numericCoverageComplete: true,
  };
}
const evidencePaths = [
  ["journalOracle", "qualified"],
  ["strictNative", "qualified"],
  ["nativeJournalCorroboration", "qualified"],
  ["bootstrapCapture", "qualified"],
  ["numericCoverageComplete"],
];
function alterEvidence(report, path, value, missing = false) {
  const parent = path.length === 1 ? report : report[path[0]];
  const key = path.at(-1);
  if (missing) delete parent[key];
  else parent[key] = value;
}

test("V3 runner exposes an explicit all-evidence success predicate", () => {
  assert.equal(typeof runnerV3.semanticPilotEvidenceCompleteV3, "function");
});
test("V3 command exposes independent process-cleanup and bootstrap-evidence outcome", () => {
  assert.equal(typeof commandV3.semanticProcessOutcome, "function");
});
test("V3 runner success requires five actually true evidence values", () => {
  if (typeof runnerV3.semanticPilotEvidenceCompleteV3 !== "function") return;
  const report = completeEvidenceReport(),
    before = clone(report);
  assert.equal(runnerV3.semanticPilotEvidenceCompleteV3(report), true);
  assert.deepEqual(report, before);
});
for (const path of evidencePaths) {
  for (const [name, value, missing] of [
    ["false", false, false],
    ["null", null, false],
    ["missing", undefined, true],
    ["truthy string", "true", false],
  ]) {
    test(`V3 runner rejects ${path.join(".")} ${name}`, () => {
      if (typeof runnerV3.semanticPilotEvidenceCompleteV3 !== "function") return;
      const report = completeEvidenceReport();
      alterEvidence(report, path, value, missing);
      assert.equal(runnerV3.semanticPilotEvidenceCompleteV3(report), false);
    });
  }
}
for (const path of evidencePaths.filter((row) => row.length > 1)) {
  test(`V3 runner rejects a missing ${path[0]} record`, () => {
    if (typeof runnerV3.semanticPilotEvidenceCompleteV3 !== "function") return;
    const report = completeEvidenceReport();
    delete report[path[0]];
    assert.equal(runnerV3.semanticPilotEvidenceCompleteV3(report), false);
  });
}
test("an advertised bootstrap boolean cannot rescue a failed raw capture object", () => {
  if (typeof runnerV3.semanticPilotEvidenceCompleteV3 !== "function") return;
  const report = completeEvidenceReport();
  report.bootstrapCaptureQualified = true;
  report.bootstrapCapture.qualified = false;
  assert.equal(runnerV3.semanticPilotEvidenceCompleteV3(report), false);
});
for (const value of [null, undefined, false, "qualified"]) {
  test(`V3 runner returns false for non-report ${String(value)}`, () => {
    if (typeof runnerV3.semanticPilotEvidenceCompleteV3 !== "function") return;
    assert.doesNotThrow(() => {
      assert.equal(runnerV3.semanticPilotEvidenceCompleteV3(value), false);
    });
  });
}

function completedProcess() {
  return {
    exit_code: 0,
    signal: null,
    timed_out: false,
    cancelled: false,
    process_stopped: true,
    process_tree_stopped: null,
    stop_scope: "direct_process",
    output_limit: false,
    spawn_error: null,
  };
}
function cleanChild() {
  return {
    status: "SEMANTIC_CANDIDATE_OBSERVED_NOT_APPROVED",
    semanticCandidateObserved: true,
    formalQualification: "NOT_APPROVED",
    browserConnectedAfterCleanup: false,
    serverListeningAfterCleanup: false,
    cleanupErrors: [],
    endpointPins: { sourceStable: true, executableStable: true },
    restoration: {
      nativeRafIdentityUnchanged: true,
      nativeCancelIdentityUnchanged: true,
      pendingAfterRestore: 0,
      state: "CLOSED",
      bootstrapStateAfterRestore: "FIRED",
      bootstrapPendingAfterRestore: false,
    },
    ...completeEvidenceReport(),
    bootstrapCaptureQualified: true,
  };
}

test("V3 complete bootstrap evidence preserves the original V2 actual cleanup outcome", () => {
  if (typeof commandV3.semanticProcessOutcome !== "function") return;
  const process = completedProcess(),
    child = cleanChild();
  const reference = commandV2.semanticProcessOutcome(process, child);
  assert.equal(reference.machineLeaseReleasable, true);
  assert.equal(reference.pilotSucceeded, true);
  const actual = commandV3.semanticProcessOutcome(process, child);
  assert.equal(actual.machineLeaseReleasable, reference.machineLeaseReleasable);
  assert.equal(actual.pilotSucceeded, true);
  assert.equal(actual.processTreeStopped, reference.processTreeStopped);
  assert.equal(actual.stopScope, reference.stopScope);
  assert.equal(actual.formalQualification, "NOT_APPROVED");
});
for (const [name, value, missing] of [
  ["false", false, false],
  ["null", null, false],
  ["missing", undefined, true],
  ["truthy string", "true", false],
]) {
  test(`V3 bootstrap capture ${name} rejects success while releasing actually closed resources`, () => {
    if (typeof commandV3.semanticProcessOutcome !== "function") return;
    const process = completedProcess(),
      child = cleanChild();
    if (missing) delete child.bootstrapCaptureQualified;
    else child.bootstrapCaptureQualified = value;
    const reference = commandV2.semanticProcessOutcome(process, child);
    assert.equal(reference.pilotSucceeded, true);
    const actual = commandV3.semanticProcessOutcome(process, child);
    assert.equal(actual.machineLeaseReleasable, true);
    assert.equal(actual.machineLeaseReleasable, reference.machineLeaseReleasable);
    assert.equal(actual.pilotSucceeded, false);
    assert.equal(actual.formalQualification, "NOT_APPROVED");
  });
}
for (const [name, value, missing] of [
  ["true", true, false],
  ["null", null, false],
  ["missing", undefined, true],
  ["false string", "false", false],
]) {
  test(`V3 unconfirmed bootstrap restoration ${name} rejects success after actual browser closure`, () => {
    if (typeof commandV3.semanticProcessOutcome !== "function") return;
    const process = completedProcess(),
      child = cleanChild();
    if (missing) delete child.restoration.bootstrapPendingAfterRestore;
    else child.restoration.bootstrapPendingAfterRestore = value;
    const reference = commandV2.semanticProcessOutcome(process, child);
    assert.equal(reference.machineLeaseReleasable, true);
    const actual = commandV3.semanticProcessOutcome(process, child);
    assert.equal(actual.machineLeaseReleasable, reference.machineLeaseReleasable);
    assert.equal(actual.pilotSucceeded, false);
    assert.equal(actual.formalQualification, "NOT_APPROVED");
  });
}
test("V3 bootstrap evidence cannot rescue an unconfirmed forced process tree", () => {
  if (typeof commandV3.semanticProcessOutcome !== "function") return;
  const process = {
    ...completedProcess(),
    exit_code: null,
    signal: "SIGKILL",
    timed_out: true,
    process_tree_stopped: false,
  };
  const actual = commandV3.semanticProcessOutcome(process, cleanChild());
  assert.equal(actual.machineLeaseReleasable, false);
  assert.equal(actual.pilotSucceeded, false);
});

test("bootstrap ordinary mark cannot backdate its event timestamp while retaining a valid callTime", () => {
  if (typeof candidate.verifySemanticBootstrapV1 !== "function") return;
  const f = fixture();
  f.events[3].ts = f.context.nativeEligibility.begin + 1;
  assert.ok(f.events[3].args.data.callTime >= f.events[2].ts);
  assert.ok(f.events[3].args.data.callTime <= f.events[2].ts + f.events[2].dur);
  assert.ok(f.events[3].ts < f.events[2].ts);
  rejected(f);
});
for (const [name, value, missing] of [
  ["CANCELLED", "CANCELLED", false],
  ["null", null, false],
  ["missing", undefined, true],
  ["truthy flag", true, false],
]) {
  test(`V3 bootstrap restore state ${name} rejects success after actual closure`, () => {
    if (typeof commandV3.semanticProcessOutcome !== "function") return;
    const process = completedProcess(),
      child = cleanChild();
    if (missing) delete child.restoration.bootstrapStateAfterRestore;
    else child.restoration.bootstrapStateAfterRestore = value;
    const reference = commandV2.semanticProcessOutcome(process, child);
    const actual = commandV3.semanticProcessOutcome(process, child);
    assert.equal(reference.machineLeaseReleasable, true);
    assert.equal(actual.machineLeaseReleasable, reference.machineLeaseReleasable);
    assert.equal(actual.pilotSucceeded, false);
    assert.equal(actual.formalQualification, "NOT_APPROVED");
  });
}
