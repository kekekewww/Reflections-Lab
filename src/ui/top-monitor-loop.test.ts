import assert from "node:assert/strict";
import test from "node:test";
import { startTopMonitorLoop, TOP_MONITOR_MAX_HZ } from "./top-monitor-loop.js";

function fixture(
  overrides: {
    sample?: (interval: number | null) => void;
    onError?: (error: unknown) => void;
  } = {},
) {
  let nextId = 0;
  let visible = true;
  const pending = new Map<number, (time: number) => void>();
  const all = new Map<number, (time: number) => void>();
  const cancelled: number[] = [];
  const samples: { at: number; interval: number | null }[] = [];
  const errors: unknown[] = [];
  let at = 0;
  let releases = 0;
  const loop = startTopMonitorLoop({
    requestFrame(callback) {
      const id = nextId++;
      pending.set(id, callback);
      all.set(id, callback);
      assert.equal(pending.size, 1, "only one RAF may be pending");
      return id;
    },
    cancelFrame(id) {
      cancelled.push(id);
      pending.delete(id);
    },
    sample(interval) {
      samples.push({ at, interval });
      overrides.sample?.(interval);
    },
    release() {
      releases++;
    },
    onError(error) {
      errors.push(error);
      overrides.onError?.(error);
    },
    isVisible: () => visible,
  });
  return {
    loop,
    pending,
    all,
    cancelled,
    samples,
    errors,
    releases: () => releases,
    visibility(value: boolean) {
      visible = value;
    },
    step(time: number) {
      const entry = pending.entries().next().value;
      assert.ok(entry, "expected a pending RAF");
      const [id, callback] = entry;
      pending.delete(id);
      at = time;
      callback(time);
      return id;
    },
  };
}

test("monitor samples at most 15 Hz while observing actual adjacent RAF intervals", () => {
  const f = fixture();
  assert.equal(TOP_MONITOR_MAX_HZ, 15);
  for (let time = 0; time < 1000; time += 5) f.step(time);
  assert.ok(f.samples.length > 1 && f.samples.length <= 15);
  assert.equal(f.samples[0]?.interval, null);
  for (let index = 1; index < f.samples.length; index++) {
    assert.ok(f.samples[index]!.at - f.samples[index - 1]!.at >= 1000 / 15);
    assert.equal(
      f.samples[index]!.interval,
      5,
      "frame interval is not the throttled sample period",
    );
  }
  f.loop.stop();
  assert.equal(f.pending.size, 0);
});

test("hide cancels the only RAF, releases once, and resume starts a fresh cadence", () => {
  const f = fixture();
  f.step(20);
  const staleId = f.pending.keys().next().value!;
  f.visibility(false);
  f.loop.setVisible(false);
  assert.equal(f.pending.size, 0);
  assert.equal(f.releases(), 1);
  f.loop.setVisible(false);
  assert.equal(f.releases(), 1);
  f.visibility(true);
  f.loop.setVisible(true);
  f.loop.setVisible(true);
  assert.equal(f.pending.size, 1);
  f.all.get(staleId)!(10000);
  assert.equal(
    f.pending.size,
    1,
    "a cancelled old callback cannot consume or duplicate the new RAF",
  );
  assert.equal(f.samples.length, 1);
  f.step(20000);
  assert.equal(f.samples.at(-1)?.interval, null, "hidden wall time is not frame cost");
  f.loop.stop();
  assert.equal(f.releases(), 2);
});

test("visibility is checked before sampling even if its DOM event has not arrived", () => {
  const f = fixture();
  f.step(0);
  f.visibility(false);
  f.step(100);
  assert.equal(f.samples.length, 1);
  assert.equal(f.pending.size, 0);
  assert.equal(f.releases(), 1);
  f.loop.stop();
  assert.equal(f.releases(), 1);
});

test("stop before the first frame cancels handle zero and rejects late delivery", () => {
  const f = fixture();
  f.loop.stop();
  f.loop.stop();
  assert.deepEqual(f.cancelled, [0]);
  assert.equal(f.releases(), 1);
  f.all.get(0)!(30);
  assert.equal(f.samples.length, 0);
  assert.equal(f.pending.size, 0);
  f.loop.setVisible(true);
  assert.equal(f.pending.size, 0);
});

test("sample error stops, reports once, and releases even on repeated calls", () => {
  const failure = new Error("read or canvas failure");
  const f = fixture({
    sample() {
      throw failure;
    },
  });
  assert.doesNotThrow(() => f.step(0));
  assert.deepEqual(f.errors, [failure]);
  assert.equal(f.pending.size, 0);
  assert.equal(f.releases(), 1);
  f.loop.stop();
  f.loop.setVisible(true);
  assert.equal(f.releases(), 1);
  assert.equal(f.pending.size, 0);
});

test("an error reporter cannot escape into a RAF callback or restart the loop", () => {
  const f = fixture({
    sample() {
      throw new Error("sample");
    },
    onError() {
      throw new Error("reporter");
    },
  });
  assert.doesNotThrow(() => f.step(0));
  assert.equal(f.errors.length, 1);
  assert.equal(f.releases(), 1);
  assert.equal(f.pending.size, 0);
});

test("reentrant sample stop never queues a successor", () => {
  let stop: (() => void) | undefined;
  const f = fixture({
    sample() {
      stop?.();
    },
  });
  stop = f.loop.stop;
  f.step(0);
  assert.equal(f.samples.length, 1);
  assert.equal(f.releases(), 1);
  assert.equal(f.pending.size, 0);
});

test("reentrant hide and resume queues exactly one fresh epoch", () => {
  let change: (() => void) | undefined;
  const f = fixture({
    sample() {
      change?.();
      change = undefined;
    },
  });
  change = () => {
    f.loop.setVisible(false);
    f.loop.setVisible(true);
  };
  f.step(0);
  assert.equal(f.pending.size, 1);
  assert.equal(f.releases(), 1);
  f.step(1000);
  assert.equal(f.samples.at(-1)?.interval, null);
  f.loop.stop();
});

for (const invalidTime of [Number.NaN, Infinity, -1, 5]) {
  test(`invalid or regressing RAF timestamp ${String(invalidTime)} fails closed`, () => {
    const f = fixture();
    f.step(10);
    f.step(invalidTime);
    assert.equal(f.samples.length, 1);
    assert.equal(f.errors.length, 1);
    assert.equal(f.releases(), 1);
    assert.equal(f.pending.size, 0);
  });
}

test("request failure releases the activated observation scope", () => {
  const failure = new Error("RAF unavailable");
  let released = 0;
  const errors: unknown[] = [];
  const loop = startTopMonitorLoop({
    requestFrame() {
      throw failure;
    },
    cancelFrame() {
      assert.fail("no handle was acquired");
    },
    sample() {
      assert.fail("no frame was requested");
    },
    release() {
      released++;
    },
    onError(error) {
      errors.push(error);
    },
  });
  assert.equal(released, 1);
  assert.deepEqual(errors, [failure]);
  loop.stop();
  assert.equal(released, 1);
});
