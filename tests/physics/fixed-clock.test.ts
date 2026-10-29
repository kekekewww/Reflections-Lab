import assert from "node:assert/strict";
import test from "node:test";
import { FixedClock } from "../../src/physics/fixed-clock.js";

const near = (actual: number, expected: number, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test("30, 60 and 144 Hz rendering each execute 600 identical fixed steps in ten seconds", () => {
  for (const renderHz of [30, 60, 144]) {
    const clock = new FixedClock();
    const integration: number[] = [];
    let position = 0;
    clock.resume();
    for (let frame = 0; frame < renderHz * 10; frame++) {
      const state = clock.advance(1 / renderHz, () => {
        position += 2 / 60;
        integration.push(position);
      });
      assert.equal(state.overrun, false);
      assert.equal(state.droppedWallTimeSeconds, 0);
      assert.ok(state.alpha >= 0 && state.alpha <= 1);
    }
    assert.equal(clock.tick, 600);
    assert.equal(integration.length, 600);
    near(position, 20, 1e-9);
    near(clock.accumulatorSeconds, 0);
  }
});

test("initial pause and explicit pause freeze ticks and do not accumulate paused wall time", () => {
  const clock = new FixedClock();
  let calls = 0;
  assert.equal(clock.paused, true);
  assert.equal(clock.advance(10, () => calls++).steps, 0);
  clock.resume();
  clock.advance(1 / 120, () => calls++);
  near(clock.accumulatorSeconds, 1 / 120);
  clock.pause();
  clock.advance(10, () => calls++);
  near(clock.accumulatorSeconds, 1 / 120);
  clock.resume();
  clock.advance(1 / 120, () => calls++);
  assert.equal(calls, 1);
  assert.equal(clock.tick, 1);
});

test("interactive catch-up is bounded and reports discarded wall time without skipping ticks", () => {
  const clock = new FixedClock();
  let calls = 0;
  clock.resume();
  const report = clock.advance(0.2 + 1 / 240, () => calls++);
  assert.equal(calls, 4);
  assert.equal(report.tick, 4);
  assert.equal(report.overrun, true);
  assert.equal(clock.paused, false);
  near(report.droppedWallTimeSeconds, 8 / 60);
  near(clock.totalDroppedWallTimeSeconds, 8 / 60);
  near(report.alpha, 0.25);
  const next = clock.advance(3 / 240, () => calls++);
  assert.equal(next.steps, 1);
  assert.equal(next.tick, 5);
  assert.equal(next.droppedWallTimeSeconds, 0);
});

test("recording overload pauses with backlog intact and explicit resume can drain it", () => {
  const clock = new FixedClock({ mode: "recording" });
  let calls = 0;
  clock.resume();
  const first = clock.advance(0.2, () => calls++);
  assert.equal(first.steps, 4);
  assert.equal(first.overrun, true);
  assert.equal(first.alpha, 1);
  assert.equal(clock.paused, true);
  near(clock.accumulatorSeconds, 8 / 60);
  assert.equal(clock.totalDroppedWallTimeSeconds, 0);
  clock.advance(30, () => calls++);
  assert.equal(calls, 4);
  near(clock.accumulatorSeconds, 8 / 60);
  clock.resume();
  assert.equal(clock.advance(0, () => calls++).steps, 4);
  assert.equal(clock.paused, true);
  clock.resume();
  const last = clock.advance(0, () => calls++);
  assert.equal(last.steps, 4);
  assert.equal(last.overrun, false);
  assert.equal(clock.paused, false);
  assert.equal(clock.tick, 12);
  assert.equal(calls, 12);
  near(clock.accumulatorSeconds, 0);
  assert.equal(clock.totalDroppedWallTimeSeconds, 0);
});

test("reset returns the clock to a paused initial epoch", () => {
  const clock = new FixedClock();
  clock.resume();
  clock.advance(1, () => {});
  assert.ok(clock.totalDroppedWallTimeSeconds > 0);
  clock.reset();
  assert.equal(clock.tick, 0);
  assert.equal(clock.paused, true);
  assert.equal(clock.accumulatorSeconds, 0);
  assert.equal(clock.totalDroppedWallTimeSeconds, 0);
});

test("invalid clock configuration and wall deltas are rejected", () => {
  for (const fixedDtSeconds of [0, -1, NaN, Infinity, 1e-12, 2]) {
    assert.throws(() => new FixedClock({ fixedDtSeconds }), RangeError);
  }
  for (const maxCatchUpSteps of [0, 1.1, NaN, Infinity, 241]) {
    assert.throws(() => new FixedClock({ maxCatchUpSteps }), RangeError);
  }
  assert.throws(() => new FixedClock({ mode: "unknown" as "interactive" }), TypeError);
  const clock = new FixedClock();
  clock.resume();
  for (const delta of [-1, NaN, Infinity, Number.MAX_VALUE]) {
    assert.throws(() => clock.advance(delta, () => {}), RangeError);
    assert.equal(clock.tick, 0);
    assert.equal(clock.accumulatorSeconds, 0);
  }
});

test("a failed physics callback does not commit that tick or consume its pending time", () => {
  const clock = new FixedClock();
  clock.resume();
  assert.throws(
    () =>
      clock.advance(1 / 60, () => {
        throw new Error("physics failed");
      }),
    /physics failed/,
  );
  assert.equal(clock.tick, 0);
  near(clock.accumulatorSeconds, 1 / 60);
  const recovered = clock.advance(0, () => {});
  assert.equal(recovered.tick, 1);
  near(clock.accumulatorSeconds, 0);
});

test("a custom 120 Hz fixed step remains independent of 60 Hz rendering", () => {
  const clock = new FixedClock({ fixedDtSeconds: 1 / 120 });
  clock.resume();
  for (let frame = 0; frame < 60; frame++) {
    assert.equal(clock.advance(1 / 60, () => {}).steps, 2);
  }
  assert.equal(clock.tick, 120);
  near(clock.accumulatorSeconds, 0);
});

test("pause requested at a physics boundary stops catch-up and preserves pending time", () => {
  const clock = new FixedClock();
  clock.resume();
  const state = clock.advance(3 / 60, () => clock.pause());
  assert.equal(state.steps, 1);
  assert.equal(state.tick, 1);
  assert.equal(state.overrun, false);
  assert.equal(state.droppedWallTimeSeconds, 0);
  near(clock.accumulatorSeconds, 2 / 60);
  clock.resume();
  assert.equal(clock.advance(0, () => {}).steps, 2);
  assert.equal(clock.tick, 3);
});
