import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createStartupObservabilityV2 } from "../browser/nonadvanced/long-render/paired-startup-observability-v2.mjs";

const ORIGIN = "http://127.0.0.1:5353";
function fakeClock() {
  let current = 0;
  let sequence = 0;
  const timers = new Map();
  return {
    now: () => current,
    setTimer: (callback, delay) => {
      const id = ++sequence;
      timers.set(id, { callback, due: current + delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    fireAt: (time) => {
      current = time;
      const next = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
      assert.ok(next, "a heartbeat must actually be scheduled");
      timers.delete(next[0]);
      next[1].callback();
    },
    pending: () => timers.size,
  };
}
function ownedHttp(url = "/entry.ts", host = "127.0.0.1:5353", address = "127.0.0.1") {
  return { url, method: "GET", headers: { host }, socket: { remoteAddress: address } };
}
function response(status = 200) {
  const value = new EventEmitter();
  value.statusCode = status;
  return value;
}
function request(page, url, timing) {
  return {
    frame: () => ({ page: () => page }),
    url: () => url,
    timing: () => timing,
    method: () => "GET",
    resourceType: () => "script",
    failure: () => ({ errorText: "net::ERR_ABORTED" }),
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("startup v2 heartbeat measures scheduler lag without catch-up, bounds samples and disposes its timer", () => {
  const clock = fakeClock();
  const observer = createStartupObservabilityV2({
    origin: ORIGIN,
    ...clock,
    heartbeatIntervalMs: 50,
    maxHeartbeatSamples: 2,
  });
  assert.equal(clock.pending(), 1);
  clock.fireAt(50);
  clock.fireAt(125);
  const snapshot = observer.snapshot();
  assert.equal(snapshot.clocks.node, "performance.now-relative-to-observer-start-ms");
  assert.equal(snapshot.heartbeat.sampleCount, 2);
  assert.equal(snapshot.heartbeat.maxLagMs, 25);
  assert.equal(snapshot.heartbeat.sampleLimitReached, true);
  assert.equal(clock.pending(), 0);
  observer.dispose();
  const disposed = observer.snapshot();
  assert.equal(disposed.disposed, true);
  assert.equal(clock.pending(), 0);
  assert.deepEqual(observer.dispose(), disposed);
  const secondClock = fakeClock();
  const second = createStartupObservabilityV2({ origin: ORIGIN, ...secondClock });
  assert.equal(secondClock.pending(), 1);
  second.dispose();
  assert.equal(secondClock.pending(), 0);
});

test("startup v2 separates server receipt and browser timing, keeps unknown -1 and removes only owned listeners", () => {
  const clock = fakeClock();
  const page = new EventEmitter();
  let existingCallbacks = 0;
  page.on("request", () => existingCallbacks++);
  const observer = createStartupObservabilityV2({
    origin: ORIGIN,
    ...clock,
    maxEvents: 8,
    maxInflight: 1,
  });
  observer.attachPage(page);
  assert.throws(() => observer.attachPage(page), /PAGE_ALREADY_ATTACHED/);
  let nextCalls = 0;
  const first = response();
  observer.middleware(ownedHttp(), first, () => nextCalls++);
  const overflow = response();
  observer.middleware(ownedHttp("/overflow.ts"), overflow, () => nextCalls++);
  observer.middleware(
    ownedHttp("https://foreign.invalid/secret.ts"),
    response(),
    () => nextCalls++,
  );
  observer.middleware(
    ownedHttp("/secret.ts", "foreign.invalid", "203.0.113.1"),
    response(),
    () => nextCalls++,
  );
  const timing = {
    startTime: 1762000000000,
    domainLookupStart: -1,
    domainLookupEnd: -1,
    connectStart: -1,
    secureConnectionStart: -1,
    connectEnd: -1,
    requestStart: 1.25,
    responseStart: 6.5,
    responseEnd: -1,
    privateUnexpected: { secret: "must not escape" },
  };
  const req = request(page, `${ORIGIN}/entry.ts`, timing);
  const foreignReq = request(page, "https://foreign.invalid/private.ts", timing);
  page.emit("request", foreignReq);
  page.emit("request", req);
  page.emit("response", { request: () => req, status: () => 200 });
  timing.responseEnd = 8.75;
  page.emit("requestfinished", req);
  first.emit("finish");
  const snapshot = observer.snapshot();
  assert.equal(nextCalls, 4);
  assert.equal(snapshot.server.counts.received, 2);
  assert.equal(snapshot.server.counts.foreignIgnored, 2);
  assert.equal(snapshot.server.overflow.inflight, 1);
  assert.equal(snapshot.server.inflight.length, 0);
  assert.equal(overflow.listenerCount("finish"), 0);
  const received = snapshot.server.events.find((row) => row.type === "receive");
  assert.equal(received.clock, "node-callback");
  const finished = snapshot.browser.events.find((row) => row.type === "requestfinished");
  assert.equal(finished.clock, "node-callback");
  assert.equal(finished.requestTiming.clock, "playwright-public-request-timing");
  assert.equal(finished.requestTiming.values.domainLookupStart, -1);
  assert.equal(finished.requestTiming.values.responseEnd, 8.75);
  const receivedResponse = snapshot.browser.events.find((row) => row.type === "response");
  assert.equal(receivedResponse.requestTiming.values.responseEnd, -1);
  assert.equal(finished.requestTiming.values.startTime, 1762000000000);
  assert.equal(Object.hasOwn(finished.requestTiming.values, "privateUnexpected"), false);
  assert.equal(JSON.stringify(snapshot).includes("secret"), false);
  const bad = request(page, `${ORIGIN}/bad.ts`, { ...timing, responseEnd: Infinity });
  page.emit("request", bad);
  page.emit("requestfinished", bad);
  const invalid = observer.snapshot();
  const invalidFinished = invalid.browser.events.find(
    (row) => row.url === `${ORIGIN}/bad.ts` && row.type === "requestfinished",
  );
  assert.equal(invalidFinished.requestTiming.values, null);
  assert.equal(invalid.browser.counts.observerErrors, 2);
  const active = response(503);
  observer.middleware(ownedHttp("/active.ts"), active, () => undefined);
  assert.equal(active.listenerCount("finish"), 1);
  observer.dispose();
  assert.equal(active.listenerCount("finish"), 0);
  assert.equal(active.listenerCount("close"), 0);
  assert.equal(page.listenerCount("request"), 1);
  assert.equal(page.listenerCount("response"), 0);
  const disposed = observer.snapshot();
  page.emit("request", req);
  active.emit("finish");
  assert.deepEqual(observer.snapshot(), disposed);
  assert.equal(existingCallbacks, 4);
  assert.equal(clock.pending(), 0);
});

test("startup v2 operation records real late settlement and rejection without retaining SDK objects or publishing after dispose", async () => {
  const clock = fakeClock();
  const observer = createStartupObservabilityV2({ origin: ORIGIN, ...clock, maxEvents: 4 });
  const goto = deferred();
  const result = observer.operation("inner-goto", () => goto.promise);
  await Promise.resolve();
  observer.marker("outer-deadline");
  let snapshot = observer.snapshot();
  assert.deepEqual(
    snapshot.operations.events.map((row) => row.type),
    ["begin", "marker"],
  );
  assert.equal(snapshot.operations.activeCount, 1);
  const actualSdkResult = { intentionallyNotSerializable: () => undefined };
  goto.resolve(actualSdkResult);
  assert.equal(await result, actualSdkResult);
  snapshot = observer.snapshot();
  assert.deepEqual(
    snapshot.operations.events.map((row) => row.type),
    ["begin", "marker", "fulfilled"],
  );
  assert.equal(snapshot.operations.activeCount, 0);
  const rejected = observer.operation("inner-ready", () =>
    Promise.reject(new Error("read failed")),
  );
  await assert.rejects(rejected, /read failed/);
  assert.equal(observer.snapshot().operations.counts.rejected, 1);
  assert.ok(observer.snapshot().operations.overflow.events >= 1);
  assert.equal(JSON.stringify(observer.snapshot()).includes("intentionallyNotSerializable"), false);
  const late = deferred();
  const lateResult = observer.operation("after-dispose", () => late.promise);
  await Promise.resolve();
  observer.dispose();
  const disposed = observer.snapshot();
  late.resolve("settled later");
  assert.equal(await lateResult, "settled later");
  assert.deepEqual(observer.snapshot(), disposed);
  assert.equal(clock.pending(), 0);
});
