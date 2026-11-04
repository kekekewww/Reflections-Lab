// Bounded TCP endpoint observation only. Fake EventEmitter sockets never open
// an OS connection or start a process. Refusal describes this one probe instant,
// not persistent absence of every listener or ownership of all ports.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../browser/performance-preview-listen-v4.mjs", import.meta.url);
const candidate = existsSync(moduleUrl) ? await import(moduleUrl.href) : {};
const wrapper = await import("../browser/run-performance-v4.mjs");
const owned = { host: "127.0.0.1", port: 5194, timeoutMs: 500 };
const scope = "BOUNDED_TCP_CONNECT_ONLY";
async function pump() {
  await Promise.resolve();
  await Promise.resolve();
}
function io() {
  const socket = new EventEmitter(),
    connects = [],
    timers = new Map(),
    cleared = [];
  let nextTimer = 0,
    clock = 100,
    destroyed = 0;
  socket.destroy = () => {
    destroyed++;
    return socket;
  };
  const seams = {
    connect(options) {
      connects.push({ ...options });
      return socket;
    },
    setTimer(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      cleared.push(id);
      timers.delete(id);
    },
    now() {
      const value = clock;
      clock += 25;
      return value;
    },
  };
  return {
    socket,
    connects,
    timers,
    cleared,
    seams,
    destroyed: () => destroyed,
    fireTimeout() {
      const pending = [...timers.values()];
      for (const timer of pending) timer.callback();
    },
  };
}
function assertReceipt(receipt, state, host) {
  assert.equal(receipt.listening, state);
  assert.equal(receipt.observationScope, scope);
  assert.equal(receipt.host, owned.host);
  assert.equal(receipt.port, owned.port);
  assert.equal(receipt.timeoutMs, owned.timeoutMs);
  assert.equal(Number.isFinite(receipt.startedAtMonotonicMs), true);
  assert.equal(Number.isFinite(receipt.endedAtMonotonicMs), true);
  assert.ok(receipt.endedAtMonotonicMs >= receipt.startedAtMonotonicMs);
  assert.ok(receipt.startedAtMonotonicMs >= 100, "no invented zero clock origin");
  assert.equal(host.connects.length, 1, "exactly one bounded TCP attempt");
  assert.deepEqual(host.connects[0], { host: owned.host, port: owned.port });
  assert.equal(host.destroyed(), 1, "the owned socket is always destroyed");
  assert.equal(host.timers.size, 0);
  assert.equal(host.cleared.length, 1);
}

test("V4 exposes a bounded actual TCP listener observation independently of child exit flags", () => {
  assert.equal(typeof candidate.observePreviewListenerV4, "function");
});
test("a real connect event observes a listening owned endpoint and cleans the socket", async () => {
  if (typeof candidate.observePreviewListenerV4 !== "function") return;
  const host = io(),
    pending = candidate.observePreviewListenerV4(owned, host.seams);
  await pump();
  host.socket.emit("connect");
  const receipt = await pending;
  assertReceipt(receipt, true, host);
  assert.equal(receipt.errorCode, null);
});
test("ECONNREFUSED alone proves no listener at the bounded observation instant", async () => {
  if (typeof candidate.observePreviewListenerV4 !== "function") return;
  const host = io(),
    pending = candidate.observePreviewListenerV4(owned, host.seams);
  await pump();
  const error = new Error("controlled refusal");
  error.code = "ECONNREFUSED";
  host.socket.emit("error", error);
  const receipt = await pending;
  assertReceipt(receipt, false, host);
  assert.equal(receipt.errorCode, "ECONNREFUSED");
});
for (const code of ["EACCES", "ETIMEDOUT", "ECONNRESET", undefined]) {
  test(`TCP error ${String(code)} keeps listening unknown rather than fabricating false`, async () => {
    if (typeof candidate.observePreviewListenerV4 !== "function") return;
    const host = io(),
      pending = candidate.observePreviewListenerV4(owned, host.seams);
    await pump();
    const error = new Error("controlled unknown observation");
    if (code !== undefined) error.code = code;
    host.socket.emit("error", error);
    const receipt = await pending;
    assertReceipt(receipt, null, host);
    assert.equal(receipt.errorCode, code ?? null);
  });
}
test("a bounded connect timeout remains null and destroys the socket without a fake refusal", async () => {
  if (typeof candidate.observePreviewListenerV4 !== "function") return;
  const host = io(),
    pending = candidate.observePreviewListenerV4(owned, host.seams);
  await pump();
  assert.equal(host.timers.size, 1);
  assert.equal([...host.timers.values()][0].delay, 500);
  host.fireTimeout();
  const receipt = await pending;
  assertReceipt(receipt, null, host);
  assert.ok(typeof receipt.errorCode === "string" && receipt.errorCode.includes("TIME"));
});
for (const [name, options] of [
  ["another host", { ...owned, host: "localhost" }],
  ["a non-loopback address", { ...owned, host: "0.0.0.0" }],
  ["another port", { ...owned, port: 5193 }],
  ["a string port", { ...owned, port: "5194" }],
  ["zero timeout", { ...owned, timeoutMs: 0 }],
  ["timeout above the 5000ms hard bound", { ...owned, timeoutMs: 5001 }],
  ["nonfinite timeout", { ...owned, timeoutMs: Infinity }],
  ["fractional timeout", { ...owned, timeoutMs: 1.5 }],
]) {
  test(`listener observation rejects ${name} before any TCP side effect`, async () => {
    if (typeof candidate.observePreviewListenerV4 !== "function") return;
    const host = io();
    await assert.rejects(async () => await candidate.observePreviewListenerV4(options, host.seams));
    assert.deepEqual(host.connects, []);
    assert.equal(host.timers.size, 0);
    assert.equal(host.destroyed(), 0);
  });
}
for (const timeoutMs of [1, 5000]) {
  test(`listener observation permits the exact ${timeoutMs}ms finite bound`, async () => {
    if (typeof candidate.observePreviewListenerV4 !== "function") return;
    const host = io(),
      options = { ...owned, timeoutMs };
    const pending = candidate.observePreviewListenerV4(options, host.seams);
    await pump();
    assert.equal([...host.timers.values()][0].delay, timeoutMs);
    host.socket.emit("connect");
    const receipt = await pending;
    assert.equal(receipt.listening, true);
    assert.equal(receipt.timeoutMs, timeoutMs);
    assert.equal(host.destroyed(), 1);
    assert.equal(host.timers.size, 0);
  });
}

function stoppedWorker() {
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
function observedCleanup() {
  return {
    formalQualified: true,
    cleanup: {
      browserConnected: false,
      previewProcessStopped: true,
      previewListeningAfterCleanup: false,
      errors: [],
    },
  };
}
test("V4 wrapper releases known stopped processes only with an actual false preview listening observation", () => {
  const result = wrapper.performanceProcessOutcomeV4(stoppedWorker(), observedCleanup());
  assert.equal(result.machineLeaseReleasable, true);
  assert.equal(result.formalQualified, true);
  assert.equal(result.processTreeStopped, null);
  assert.equal(result.stopScope, "direct_process");
});
for (const [name, value, missing] of [
  ["null", null, false],
  ["missing", undefined, true],
  ["still listening", true, false],
  ["false string", "false", false],
]) {
  test(`stopped preview child plus ${name} listener evidence cannot release the machine`, () => {
    const child = observedCleanup();
    if (missing) delete child.cleanup.previewListeningAfterCleanup;
    else child.cleanup.previewListeningAfterCleanup = value;
    const result = wrapper.performanceProcessOutcomeV4(stoppedWorker(), child);
    assert.equal(result.machineLeaseReleasable, false);
    assert.equal(result.formalQualified, false);
  });
}
test("an observed refusal cannot rescue a preview process that was not confirmed stopped", () => {
  const child = observedCleanup();
  child.cleanup.previewProcessStopped = false;
  const result = wrapper.performanceProcessOutcomeV4(stoppedWorker(), child);
  assert.equal(result.machineLeaseReleasable, false);
  assert.equal(result.formalQualified, false);
});
test("actual preview refusal cannot rescue an unknown browser close", () => {
  const child = observedCleanup();
  child.cleanup.browserConnected = null;
  const result = wrapper.performanceProcessOutcomeV4(stoppedWorker(), child);
  assert.equal(result.machineLeaseReleasable, false);
});
test("actual no-listen evidence preserves the frozen forced-process-tree requirement", () => {
  const process = {
    ...stoppedWorker(),
    exit_code: null,
    signal: "SIGKILL",
    timed_out: true,
    process_tree_stopped: false,
  };
  const result = wrapper.performanceProcessOutcomeV4(process, observedCleanup());
  assert.equal(result.machineLeaseReleasable, false);
  assert.equal(result.formalQualified, false);
});
