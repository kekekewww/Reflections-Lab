import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  checkpointThenCloseTrace,
  observeTraceFaults,
} from "../browser/performance-owned-cleanup-v3.mjs";
const never = () => new Promise(() => {});
const options = (stop, completion = Promise.resolve("done")) => ({
  checkpoint: async () => 1,
  stop,
  completion,
  timeoutMs: 20,
});
test("pending stop is bounded even when completion already arrives", async () => {
  let n = 0;
  await assert.rejects(
    checkpointThenCloseTrace(
      options(() => {
        n++;
        return never();
      }),
    ),
    /CDP_TRACE_FLUSH_TIMEOUT/,
  );
  assert.equal(n, 1);
});
test("slow successful stop and completion are both awaited", async () => {
  let done = false;
  const r = await checkpointThenCloseTrace(
    options(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            done = true;
            resolve();
          }, 5),
        ),
    ),
  );
  assert.equal(done, true);
  assert.equal(r.traceMeta, "done");
});
test("fault with falsy value rejects even with pending stop", async () => {
  let reject;
  const fault = new Promise((_, r) => (reject = r));
  const p = checkpointThenCloseTrace({ ...options(never), fault });
  reject(0);
  let caught = false,
    value;
  try {
    await p;
  } catch (e) {
    caught = true;
    value = e;
  }
  assert.equal(caught, true);
  assert.equal(value, 0);
});
test("completion rejection interrupts hung stop and late stop rejection observed", async () => {
  let stopReject;
  const pending = new Promise((_, r) => (stopReject = r));
  const p = checkpointThenCloseTrace(
    options(() => pending, Promise.reject(Error("completion failed"))),
  );
  await assert.rejects(p, /completion failed/);
  stopReject(Error("late stop"));
  await new Promise((r) => setImmediate(r));
});
test("timeout observes late completion and stop rejections", async () => {
  let sr, cr;
  const stop = new Promise((_, r) => (sr = r)),
    completion = new Promise((_, r) => (cr = r));
  await assert.rejects(
    checkpointThenCloseTrace(options(() => stop, completion)),
    /CDP_TRACE_FLUSH_TIMEOUT/,
  );
  sr(Error("late stop"));
  cr(Error("late completion"));
  await new Promise((r) => setImmediate(r));
});
test("observer records actual event once and removes owned listeners before cleanup", async () => {
  const browser = new EventEmitter(),
    page = new EventEmitter(),
    cdp = new EventEmitter(),
    records = [];
  const obs = observeTraceFaults({ browser, page, cdp, records, phase: () => "measurement" });
  page.emit("crash");
  const f = await obs.fault;
  assert.equal(f.cause, "page.crash");
  assert.equal(f.phase, "measurement");
  assert.ok(Number.isFinite(Date.parse(f.at)));
  obs.dispose();
  browser.emit("disconnected");
  cdp.emit("close");
  assert.equal(records.length, 1);
  for (const [e, n] of [
    [browser, "disconnected"],
    [page, "crash"],
    [cdp, "close"],
  ])
    assert.equal(e.listenerCount(n), 0);
});
test("checkpoint failure still invokes hung stop exactly once and remains primary", async () => {
  let n = 0;
  const e = Error("checkpoint");
  await assert.rejects(
    checkpointThenCloseTrace({
      ...options(() => {
        n++;
        return never();
      }),
      checkpoint: async () => {
        throw e;
      },
    }),
    (err) =>
      err instanceof AggregateError && err.errors[0] === e && /TIMEOUT/.test(err.errors[1].message),
  );
  assert.equal(n, 1);
});
