import test from "node:test";
import assert from "node:assert/strict";
import { validateNativeV3, unchangedNumericV3 } from "../browser/performance-native-v3.mjs";
import { baseV3Fixture } from "./performance-v3-negative-fixtures.mjs";
import { makeFixtureHost } from "./fixture-adapter.mjs";
const instant = () => ({
  name: "ThreadControllerImpl::RunTask",
  ph: "I",
  cat: "toplevel",
  s: "t",
  ts: 500,
  pid: 7,
  tid: 9,
  args: {
    src_file: "cc/trees/proxy_impl.cc",
    src_func: "DidPresentCompositorFrameOnImplThread",
    src_line: 734,
  },
});
const validate = (d) => validateNativeV3(d.ui, d.events, d.context);
test("qualified thread instant is counted but never enters span numeric input", () => {
  const d = baseV3Fixture(),
    baseline = validate(d);
  d.events.push(instant());
  const result = validate(d);
  assert.equal(result.qualified, true);
  assert.equal(result.validatedInstantTasks, 1);
  assert.deepEqual(result.validatedTasks, baseline.validatedTasks);
  assert.deepEqual(unchangedNumericV3(d.ui, result), unchangedNumericV3(d.ui, baseline));
});
for (const [label, mutate] of Object.entries({
  scope: (e) => (e.s = "g"),
  category: (e) => (e.cat = "toplevel,other"),
  duration: (e) => (e.dur = 0),
  ts: (e) => (e.ts = NaN),
  file: (e) => (e.args.src_file = ""),
  func: (e) => (e.args.src_func = 3),
  line: (e) => (e.args.src_line = -1),
  identity: (e) => (e.pid = 0),
  phase: (e) => (e.ph = "B"),
  name: (e) => (e.name = "RunTask"),
}))
  test(`malformed instant ${label} fails closed`, () => {
    const d = baseV3Fixture(),
      e = instant();
    mutate(e);
    d.events.push(e);
    assert.equal(validate(d).qualified, false);
  });
test("malformed span outside window remains rejected alongside valid instant", () => {
  const d = baseV3Fixture();
  d.events.push(instant(), {
    name: "RunTask",
    ph: "X",
    cat: "toplevel",
    pid: 7,
    tid: 9,
    ts: -100,
    dur: -1,
  });
  assert.equal(validate(d).qualified, false);
});
test("warmup callback retires pending handle without creating measured proof", () => {
  const host = makeFixtureHost({ deferBegin: true });
  let called = 0;
  const id = host.window.requestAnimationFrame(() => called++);
  host.fire(id, 5);
  host.proof.begin("fixture-lifecycle");
  const snap = host.proof.snapshot();
  assert.equal(called, 1);
  assert.equal(snap.counters.precollectionRegistrations, 1);
  assert.equal(snap.counters.precollectionPendingAtBegin, 0);
  assert.equal(snap.callbacks.length, 0);
  assert.equal(snap.frames.length, 0);
  host.setState({ measuring: true });
  const id2 = host.window.requestAnimationFrame(() => called++);
  host.fire(id2, 20);
  assert.equal(host.proof.snapshot().callbacks.length, 1);
  assert.equal(host.proof.snapshot().frames[0].ordinal, 1);
});
