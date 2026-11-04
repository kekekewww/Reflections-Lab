import test from "node:test";
import assert from "node:assert/strict";
import { makeFixtureHost } from "./fixture-adapter.mjs";

test("probe-free fixture retains native RAF and cancel identities", () => {
  const host = makeFixtureHost({ probeMode: "off" });
  assert.equal(host.window.requestAnimationFrame, host.previousRAF);
  assert.equal(host.window.cancelAnimationFrame, host.previousCancelRAF);
});

test("instrumented fixture still observes native callbacks by default", () => {
  const host = makeFixtureHost();
  assert.notEqual(host.window.requestAnimationFrame, host.previousRAF);
  let called = 0;
  const handle = host.window.requestAnimationFrame(() => called++);
  host.fire(handle, 20);
  assert.equal(called, 1);
  assert.equal(host.proof.snapshot().callbacks.length, 1);
});

test("probe-free callback cannot contribute a measured callback or proof mark", () => {
  const host = makeFixtureHost({ probeMode: "off" });
  let called = 0;
  const handle = host.window.requestAnimationFrame(() => called++);
  host.fire(handle, 20);
  assert.equal(called, 1);
  assert.equal(host.proof.snapshot().callbacks.length, 0);
  assert.equal(
    host.nativeCalls.marks.filter((name) => name.startsWith("rlab-v3.observe.")).length,
    0,
  );
});

test("probe-free closed window keeps unobserved capture and UI counters null", () => {
  const host = makeFixtureHost({ probeMode: "off" });
  host.samples.captureWindows.push({ index: 0, scheduledAtMs: 1000 });
  const raw = host.close();
  assert.equal(raw.probeMode, "off");
  assert.equal(raw.captureWindows[0].advanceCount, null);
  assert.equal(raw.captureWindows[0].overrunCount, null);
  assert.equal(raw.captureWindows[0].pausedAdvanceCount, null);
  assert.equal(raw.captureWindows[0].maxAccumulatorSeconds, null);
  assert.equal(raw.interpolationCalls, null);
  assert.equal(raw.poseCalls, null);
  assert.equal(raw.interpolationObservation, null);
  assert.equal(raw.interpolationMs, null);
});
