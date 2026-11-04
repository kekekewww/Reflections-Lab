// Executes extracted actual V4 fixture functions with controlled VM dependencies.
// No TS/product imports, real WASM, browser, device audio or native benchmark run here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quiesceProfile, runProfileTail } from "../browser/performance-quiescence-v3.mjs";

const fixtureUrl = new URL("../browser/performance-fixture-v4.mjs", import.meta.url);
const source = readFileSync(fixtureUrl, "utf8");
function between(begin, end) {
  const start = source.indexOf(begin),
    stop = source.indexOf(end, start);
  assert.ok(start >= 0 && stop > start, `V4 fixture extraction boundary: ${begin}`);
  return source.slice(start, stop);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function pump(count = 18) {
  for (let index = 0; index < count; index++) await Promise.resolve();
}
function fakeTimers() {
  let next = 0;
  const pending = new Map(),
    cleared = [];
  return {
    pending,
    cleared,
    setTimer(callback) {
      const id = ++next;
      pending.set(id, callback);
      return id;
    },
    clearTimer(id) {
      pending.delete(id);
      cleared.push(id);
    },
    fire() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const fn of callbacks) fn();
    },
  };
}
function disposalHelper(timers = fakeTimers()) {
  const begin = source.indexOf("// BEGIN_TESTABLE_NATIVE_AUDIO_DISPOSAL_V4");
  const end = source.indexOf("// END_TESTABLE_NATIVE_AUDIO_DISPOSAL_V4", begin);
  if (begin < 0 || end <= begin) return null;
  const body = source.slice(begin, end).replace(/export\s+(?=async\s+function|function)/g, "");
  return new Function(
    "setTimeout",
    "clearTimeout",
    `${body}; return finalizeNativeAudioAfterTailV4;`,
  )(timers.setTimer, timers.clearTimer);
}
function engineHost({
  deferClose = false,
  deferDrain = false,
  closeFailure = null,
  closeState = "closed",
  resourceProof = true,
  remainingSources = 0,
  remainingSlots = 0,
} = {}) {
  const calls = [],
    updates = [],
    plays = [],
    close = deferred(),
    drain = deferred();
  let closed = false;
  const context = { state: "running", currentTime: 0, sampleRate: 48000 };
  const engine = {
    context,
    getTelemetry() {
      calls.push("telemetry");
      return {
        activeVoices: 8,
        activePaths: 64,
        nativeSlotsInUse: closed ? remainingSlots : 8,
        currentTimeSeconds: context.currentTime,
      };
    },
    getDiagnostics() {
      calls.push("diagnostics");
      return { status: "actual-stub-diagnostics" };
    },
    updateFrame(frame) {
      updates.push(structuredClone(frame));
    },
    playVoice(input, frame) {
      plays.push({ input: structuredClone(input), frame: structuredClone(frame) });
      return { status: "accepted", accepted: true };
    },
    async drainVoices() {
      calls.push("drain:start");
      if (deferDrain) await drain.promise;
      calls.push("drain:end");
    },
    dispose() {
      calls.push("dispose:legacy-fire-and-forget");
    },
    async disposeAsync() {
      calls.push("disposeAsync:start");
      if (deferClose) await close.promise;
      if (closeFailure) throw closeFailure;
      context.state = closeState;
      closed = closeState === "closed";
      calls.push("disposeAsync:end");
    },
  };
  if (resourceProof)
    engine.getNativeResourceSnapshot = () => {
      calls.push("resourceSnapshot");
      const nativeSourceNodes = closed ? remainingSources : 8;
      return {
        mode: "nativeReference",
        sourceContentModel: "nativeReference",
        nativeSourceNodes,
        sources: Array.from({ length: nativeSourceNodes }, (_, index) => ({
          instanceId: `source.${index}`,
        })),
      };
    };
  return { engine, context, calls, updates, plays, close, drain };
}
function acousticHost({ probeMode = "on", pathCap = 8, ...options } = {}) {
  const native = engineHost(options),
    requests = [],
    deliveries = [],
    timeouts = [],
    serviceCalls = [];
  const timers = fakeTimers(),
    finalize = disposalHelper(timers);
  let wall = 0;
  const clock = () => wall;
  const AcousticService = class {
    async solve(batch) {
      requests.push(structuredClone(batch));
      serviceCalls.push("solve");
      return batch.map((request) => ({
        frame: {
          requestId: request.requestId,
          sourceId: request.source.id,
          poseTick: request.poseTick,
          paths: Array.from({ length: request.budget.maxPaths }, (_, index) => ({
            id: `path.${index}`,
          })),
        },
        diagnostics: { segmentTests: 32, budgetExceeded: false },
      }));
    }
    getTelemetry() {
      serviceCalls.push("telemetry");
      return {
        lastRoundTripMs: 0,
        lastWorkerComputeMs: 0,
        lastDeliveryHandlerMs: 0,
        lastRequestBytes: 8,
        lastResponseBytes: 8,
      };
    }
    dispose() {
      serviceCalls.push("dispose");
    }
  };
  const requestCode = between("function acousticRequests(", "\nlet solverEngine =");
  const profileCode = between("async function acousticProfile(", "\nwindow.__performanceFixture =");
  const build = new Function(
    "dependencies",
    `
    const {engine,probesEnabled,probeMode,clock,AcousticService,setTimeout,
      measureNativeDelivery,nativeRouteState,DEFAULT_MATERIALS,finalizeNativeAudioAfterTailV4}=dependencies;
    let solverEngine=engine,solverPathCap=dependencies.pathCap,solverNativeStarts=[];
    ${requestCode}
    ${profileCode}
    return {run: (iterations)=>acousticProfile(iterations), engine:()=>solverEngine};
  `,
  );
  const host = build({
    engine: native.engine,
    probesEnabled: probeMode === "on",
    probeMode,
    pathCap,
    clock,
    AcousticService,
    DEFAULT_MATERIALS: [{ id: "material.hard", dataClass: "Synthetic" }],
    setTimeout(callback, delay) {
      assert.ok(Number.isFinite(delay) && delay >= 0);
      timeouts.push(delay);
      wall += delay;
      native.context.currentTime = wall / 1000;
      queueMicrotask(callback);
      return timeouts.length;
    },
    async measureNativeDelivery(service, batch, consume) {
      deliveries.push(structuredClone(batch));
      const solutions = await service.solve(batch);
      consume(solutions);
      return { solutions, delivery: { durationMs: 0 } };
    },
    nativeRouteState() {
      return { adapter: "controlled-route-state" };
    },
    finalizeNativeAudioAfterTailV4: finalize,
  });
  return { ...host, ...native, requests, deliveries, timeouts, serviceCalls, timers };
}

for (const pathCap of [8, 32]) {
  test(`V4 acoustic probe-off path cap ${pathCap} performs zero diagnostic reads and preserves the original workload`, async () => {
    const on = acousticHost({ probeMode: "on", pathCap }),
      off = acousticHost({ probeMode: "off", pathCap });
    const observed = await on.run(2),
      silent = await off.run(2);
    assert.equal(off.calls.filter((value) => value === "diagnostics").length, 0);
    assert.equal(
      on.calls.filter((value) => value === "diagnostics").length,
      25,
      "20 warmup + 2 measured rows plus baseline, warmup endpoint and final diagnostics",
    );
    assert.equal(off.deliveries.length, 0);
    assert.equal(on.deliveries.length, 22);
    assert.deepEqual(off.requests, on.requests);
    assert.deepEqual(off.updates, on.updates);
    assert.deepEqual(off.plays, on.plays);
    assert.deepEqual(off.timeouts, on.timeouts);
    assert.equal(off.requests.length, 22);
    assert.equal(off.updates.length, 22 * 8);
    assert.equal(off.plays.length, 8);
    for (const batch of off.requests) {
      assert.equal(batch.length, 8);
      assert.equal(new Set(batch.map((request) => request.source.id)).size, 8);
      for (const request of batch) {
        assert.equal(request.surfaces.length, 32);
        assert.equal(new Set(request.surfaces.map((surface) => surface.id)).size, 32);
        assert.deepEqual(request.budget, {
          maxSurfaces: 32,
          maxPaths: pathCap,
          maxSegmentTests: 16384,
        });
        assert.equal(request.topologyId, "profile.room-32-surfaces");
      }
    }
    assert.equal(silent.sourceCount, 8);
    assert.equal(silent.surfacesPerSource, 32);
    assert.equal(silent.warmupBatches, 20);
    assert.equal(silent.iterations, 2);
    assert.equal(silent.maxPathsPerBatch, 256);
    assert.equal(silent.maxReflectionOrder, 1);
    assert.equal(silent.requestedPathCapPerVoice, pathCap);
    assert.equal(silent.nativeGraphTargetPaths, 8 * pathCap);
    assert.deepEqual(silent.raw, []);
    assert.deepEqual(silent.warmupRaw, []);
    assert.equal(silent.timingStatus, "NOT_OBSERVED_PROBE_OFF");
    assert.equal(silent.baselineAudioDiagnostics, null);
    assert.equal(silent.measurementBaselineAudioDiagnostics, null);
    assert.equal(silent.audioDiagnostics, null);
    assert.equal(observed.raw.length, 2);
    assert.equal(observed.warmupRaw.length, 20);
    assert.equal(off.calls.filter((value) => value === "drain:start").length, 1);
  });
}

test("V4 exposes one directly testable asynchronous post-tail disposal helper", () => {
  assert.equal(typeof disposalHelper(), "function");
});
for (const probeMode of ["on", "off"]) {
  test(`V4 acoustic ${probeMode} retains the tail drain and awaits actual audio-context closure`, async () => {
    const host = acousticHost({ probeMode, deferClose: true, deferDrain: true });
    let settled = false;
    const pending = host.run(2);
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    try {
      await pump(160);
      assert.equal(host.updates.length, 22 * 8);
      assert.ok(host.calls.includes("drain:start"));
      assert.equal(host.calls.includes("disposeAsync:start"), false);
      assert.equal(settled, false);
      host.drain.resolve();
      await pump(24);
      assert.ok(host.calls.includes("drain:end"));
      assert.ok(host.calls.includes("disposeAsync:start"));
      assert.equal(host.context.state, "running");
      assert.equal(settled, false, "a fire-and-forget dispose cannot finish the solver workload");
      host.close.resolve();
      const result = await pending;
      assert.equal(host.context.state, "closed");
      assert.equal(result.audioDisposal.contextClosed, true);
      assert.equal(result.audioDisposal.disposePromiseSettled, true);
      assert.equal(result.audioDisposal.resourceAfter.nativeSourceNodes, 0);
      assert.equal(result.audioDisposal.resourcesReleased, true);
      assert.ok(host.calls.indexOf("drain:end") < host.calls.indexOf("disposeAsync:start"));
    } finally {
      host.drain.resolve();
      host.close.resolve();
      await pending.catch(() => {});
    }
  });
}

function uiHost(probeMode) {
  const native = engineHost({ deferClose: true }),
    timers = fakeTimers();
  const calls = native.calls,
    finalize = disposalHelper(timers);
  let wall = 1000,
    recording = "recording";
  const closed = {
    actions: [],
    captureWindows: [],
    final: { error: null },
    sampleMilliseconds: 600000,
    collectionWindow: { endPerformanceMs: 601000 },
  };
  const runtime = {
    audio: native.engine,
    busy: false,
    recorder: { getView: () => ({ pending: false, recording: { state: recording } }) },
    async dispatch(command) {
      calls.push(`dispatch:${command.type}`);
      if (command.type === "recordToggle") recording = "idle";
    },
    getSnapshot() {
      return { error: null, simulationState: "paused" };
    },
  };
  const finishCode = between("function cleanupUI(", "\n// BEGIN_TESTABLE_PHYSICS_MAINTENANCE");
  const build = new Function(
    "dependencies",
    `
    const {quiesceProfile,runProfileTail,clock,performance,setTimeout,finalizeNativeAudioAfterTailV4}=dependencies;
    const probesEnabled=dependencies.probeMode==='on',probeMode=dependencies.probeMode;
    let runtime=dependencies.runtime,mounted=dependencies.mounted,closedUIRaw=dependencies.closed,
      collectionWindow=closedUIRaw.collectionWindow,uiCleanupDone=false,uiTail=null,
      measuring=false,scriptBusy=false,scriptFrameHandle=null;
    const samples={actions:[],captureWindows:[]};
    const v3Proof={invalidate:()=>{},snapshot:()=>({closed:true}),close:()=>{}};
    const nativeCancelRAF=()=>{},restoreRAFObserver=()=>dependencies.calls.push('restoreRAF');
    const observer={disconnect:()=>{}};
    ${finishCode}
    return {finish:(options)=>finishUI(options),tail:()=>uiTail,runtime:()=>runtime};
  `,
  );
  const host = build({
    probeMode,
    runtime,
    closed,
    calls,
    mounted: {
      dispose() {
        calls.push("mounted:dispose");
      },
    },
    quiesceProfile,
    runProfileTail: (options) =>
      runProfileTail({
        ...options,
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
        onStage(stage) {
          calls.push(`tail:${stage}`);
          options.onStage(stage);
        },
      }),
    clock: () => ++wall,
    performance: { now: () => ++wall },
    setTimeout(callback) {
      queueMicrotask(callback);
      return 0;
    },
    finalizeNativeAudioAfterTailV4: finalize,
  });
  return { ...host, ...native, calls, timers, closed };
}
for (const probeMode of ["on", "off"]) {
  test(`V4 UI ${probeMode} preserves all tail stages before awaiting actual native disposal`, async () => {
    const host = uiHost(probeMode);
    let settled = false;
    const pending = host.finish();
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    try {
      await pump(80);
      for (const stage of ["drain", "pause", "recordToggle", "final-drain", "complete"])
        assert.ok(host.calls.includes(`tail:${stage}`));
      assert.ok(host.calls.includes("dispatch:pause"));
      assert.ok(host.calls.includes("dispatch:recordToggle"));
      assert.ok(host.calls.includes("disposeAsync:start"));
      assert.ok(host.calls.indexOf("tail:complete") < host.calls.indexOf("disposeAsync:start"));
      assert.equal(host.context.state, "running");
      assert.equal(
        settled,
        false,
        "finishUI must not report a closed context while close is unresolved",
      );
      host.close.resolve();
      const result = await pending;
      assert.equal(
        result,
        host.closed,
        "the original closed measurement window is not replaced by tail data",
      );
      const disposal = host.tail().audioDisposal;
      assert.equal(disposal.scope, "POST_WINDOW_DISPOSAL_ONLY");
      assert.equal(disposal.contextStateBefore, "running");
      assert.equal(disposal.contextStateAfter, "closed");
      assert.equal(disposal.contextClosed, true);
      assert.equal(disposal.disposePromiseSettled, true);
      assert.equal(disposal.resourceBefore.nativeSourceNodes, 8);
      assert.equal(disposal.resourceAfter.nativeSourceNodes, 0);
      assert.equal(disposal.resourcesReleased, true);
      assert.ok(host.calls.includes("mounted:dispose"));
      assert.equal(host.runtime(), null);
    } finally {
      host.close.resolve();
      await pending.catch(() => {});
    }
  });
}

test("native disposal helper waits for the actual engine promise rather than reporting browser cleanup", async () => {
  const helper = disposalHelper();
  if (typeof helper !== "function") return;
  const host = engineHost({ deferClose: true }),
    timers = fakeTimers();
  let settled = false;
  const pending = helper(host.engine, {
    timeoutMs: 5000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await pump(12);
  assert.equal(settled, false);
  assert.equal(host.context.state, "running");
  host.close.resolve();
  const result = await pending;
  assert.equal(result.contextClosed, true);
  assert.equal(result.resourcesReleased, true);
  assert.equal(result.disposePromiseSettled, true);
  assert.equal(timers.pending.size, 0);
});
for (const closeState of ["running", "suspended"]) {
  test(`resolved dispose promise with actual context ${closeState} cannot produce CLOSED evidence`, async () => {
    const helper = disposalHelper();
    if (typeof helper !== "function") return;
    const host = engineHost({ closeState }),
      timers = fakeTimers();
    await assert.rejects(() =>
      helper(host.engine, {
        timeoutMs: 5000,
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
      }),
    );
    assert.equal(host.context.state, closeState);
    assert.equal(timers.pending.size, 0);
  });
}
test("native disposal keeps unavailable resource endpoints null after genuine context close", async () => {
  const helper = disposalHelper();
  if (typeof helper !== "function") return;
  const host = engineHost({ resourceProof: false }),
    timers = fakeTimers();
  const result = await helper(host.engine, {
    timeoutMs: 5000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  assert.equal(result.contextClosed, true);
  assert.equal(result.resourceBefore, null);
  assert.equal(result.resourceAfter, null);
  assert.equal(
    result.resourcesReleased,
    null,
    "missing native resource proof is not zero native load",
  );
});
test("native disposal retains observed unreleased resources instead of writing false zeros", async () => {
  const helper = disposalHelper();
  if (typeof helper !== "function") return;
  const host = engineHost({ remainingSources: 1, remainingSlots: 1 }),
    timers = fakeTimers();
  const result = await helper(host.engine, {
    timeoutMs: 5000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  assert.equal(result.contextClosed, true);
  assert.equal(result.resourcesReleased, false);
  assert.equal(result.resourceAfter.nativeSourceNodes, 1);
});
test("a rejected actual context close remains a failure with no successful disposal receipt", async () => {
  const helper = disposalHelper();
  if (typeof helper !== "function") return;
  const failure = new Error("CONTROLLED_NATIVE_CLOSE_REJECTED");
  const host = engineHost({ closeFailure: failure }),
    timers = fakeTimers();
  await assert.rejects(
    () =>
      helper(host.engine, {
        timeoutMs: 5000,
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
      }),
    /CONTROLLED_NATIVE_CLOSE_REJECTED/,
  );
  assert.equal(host.context.state, "running");
  assert.equal(timers.pending.size, 0);
});
test("a bounded disposal timeout does not claim that an unresolved context was closed", async () => {
  const helper = disposalHelper();
  if (typeof helper !== "function") return;
  const host = engineHost({ deferClose: true }),
    timers = fakeTimers();
  const pending = helper(host.engine, {
    timeoutMs: 5000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const rejected = assert.rejects(pending, /TIMEOUT/);
  await pump(12);
  assert.equal(host.context.state, "running");
  assert.equal(timers.pending.size, 1);
  timers.fire();
  await rejected;
  assert.equal(host.context.state, "running");
  assert.equal(timers.pending.size, 0);
  host.close.resolve();
  await pump(12);
});
test("missing asynchronous native disposal API cannot be replaced by fire-and-forget disposal", async () => {
  const helper = disposalHelper();
  if (typeof helper !== "function") return;
  const host = engineHost(),
    timers = fakeTimers();
  delete host.engine.disposeAsync;
  await assert.rejects(() =>
    helper(host.engine, {
      timeoutMs: 5000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    }),
  );
  assert.equal(host.calls.includes("dispose:legacy-fire-and-forget"), false);
  assert.equal(host.context.state, "running");
});
