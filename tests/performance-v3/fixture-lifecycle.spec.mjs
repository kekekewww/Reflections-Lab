// Frozen R3 behavioral acceptance. No browser, product module import, or runner main.
import test from "node:test";
import assert from "node:assert/strict";
import {
  makeFixtureHost,
  allErrors,
  createProofCollector,
  float64Bits,
  observationName,
  V3_LIMITS,
} from "./fixture-adapter.mjs";

function restored(host) {
  assert.equal(
    host.window.requestAnimationFrame,
    host.previousRAF,
    "restore exact pre-observer RAF function",
  );
  assert.equal(
    host.window.cancelAnimationFrame,
    host.previousCancelRAF,
    "restore exact pre-observer cancel function",
  );
}
for (const method of ["register", "callback"])
  test(`observer ${method} exception invalidates proof and still delegates actual work exactly once`, () => {
    const observerError = new Error(`literal-${method}-observer-failure`);
    const host = makeFixtureHost({ [`${method}ObserverError`]: observerError });
    let calls = 0,
      received;
    const id = host.window.requestAnimationFrame((raw) => {
      calls++;
      received = raw;
    });
    assert.equal(
      id,
      host.nativeCalls.requests.at(-1),
      "return exact native handle after observer error",
    );
    const raw = 17.000000000000004;
    host.fire(id, raw);
    assert.equal(calls, 1);
    assert.equal(float64Bits(received), float64Bits(raw));
    assert.ok(
      host.proof.snapshot().reasons.length > 0,
      "observer exception makes evidence ineligible",
    );
  });
test("cancel observer exception still invokes native cancel exactly once with exact handle and return value", () => {
  const host = makeFixtureHost({
    cancelObserverError: new Error("literal-cancel-observer-failure"),
  });
  const id = host.window.requestAnimationFrame(() => assert.fail("cancelled callback invoked"));
  assert.equal(host.window.cancelAnimationFrame(id), "native-cancel-value");
  assert.deepEqual(host.nativeCalls.cancellations, [id]);
  assert.equal(host.pending.has(id), false);
  assert.ok(host.proof.snapshot().reasons.length > 0);
});
test("callback cap and failed proof mark never drop original callbacks or change raw bits", () => {
  for (const options of [
    { limits: { ...V3_LIMITS, callbacks: 1 } },
    { proofMarkError: new Error("literal-proof-mark-error") },
  ]) {
    const host = makeFixtureHost(options),
      rawValues = [17.000000000000004, 18.000000000000004],
      seen = [];
    for (const raw of rawValues) {
      const id = host.window.requestAnimationFrame((value) => seen.push(value));
      host.fire(id, raw);
    }
    assert.deepEqual(seen.map(float64Bits), rawValues.map(float64Bits));
    assert.equal(host.nativeCalls.fires.length, 2);
    assert.ok(host.proof.snapshot().reasons.length > 0);
  }
});
test("original callback error remains primary and observer is restored after the original CPU finally bracket", () => {
  const host = makeFixtureHost(),
    primary = new Error("literal-original-callback-error");
  const id = host.window.requestAnimationFrame(() => {
    throw primary;
  });
  assert.throws(
    () => host.fire(id, 17),
    (error) => allErrors(error).includes(primary),
  );
  assert.equal(
    host.samples.frame.get(17).callbacks,
    1,
    "retain original callback CPU accounting before restoration",
  );
  restored(host);
  assert.equal(host.state().measuring, false);
  assert.ok(
    host.proof.snapshot().reasons.length > 0,
    "failed callback cannot yield complete qualified proof",
  );
});
test("original callback plus foreign observer ownership failure preserves both errors without overwriting foreign RAF", () => {
  const host = makeFixtureHost(),
    primary = new Error("literal-callback-primary-with-ownership-failure"),
    foreign = () => {};
  const id = host.window.requestAnimationFrame(() => {
    host.window.requestAnimationFrame = foreign;
    throw primary;
  });
  let failure;
  try {
    host.fire(id, 19);
  } catch (error) {
    failure = error;
  }
  assert.ok(allErrors(failure).includes(primary), "preserve exact original callback error object");
  assert.ok(
    allErrors(failure).some((error) => /V3_RAF_OBSERVER_OWNERSHIP_CHANGED/.test(error.message)),
    "retain ownership cleanup error alongside primary",
  );
  assert.equal(host.window.requestAnimationFrame, foreign, "do not overwrite a foreign owner");
  assert.equal(host.samples.frame.get(19).callbacks, 1);
  assert.equal(host.state().measuring, false);
});
test("normal finish closes collector, cancels owned scripted handle, disconnects, disposes and restores", async () => {
  const host = makeFixtureHost();
  const scriptedHandle = host.nativeRequest(() =>
    assert.fail("script callback should have been cancelled"),
  );
  host.setState({ scriptFrameHandle: scriptedHandle });
  const result = await host.finish();
  assert.equal(result.v3Proof.closed, true);
  assert.equal(host.nativeCalls.dispose, 1);
  assert.equal(host.nativeCalls.disconnect, 1);
  assert.deepEqual(host.nativeCalls.cancellations, [scriptedHandle]);
  restored(host);
});
for (const [label, key] of [
  ["app dispose", "disposeError"],
  ["page collect", "collectError"],
  ["end boundary", "endMarkError"],
  ["pause dispatch", "dispatchError"],
])
  test(`finish failure from ${label} restores exact globals and preserves the original error`, async () => {
    const primary = new Error(`literal-${label}-error`),
      host = makeFixtureHost({ [key]: primary });
    await assert.rejects(host.finish(), (error) => allErrors(error).includes(primary));
    restored(host);
    assert.equal(host.state().measuring, false);
    assert.equal(host.nativeCalls.dispose, 1);
    assert.ok(host.proof.snapshot().reasons.length > 0, "finish error invalidates partial proof");
  });
test("explicit collection abort restores globals, closes proof and preserves supplied AbortError", async () => {
  const primary = new Error("literal-controlled-abort");
  primary.name = "AbortError";
  const host = makeFixtureHost();
  await assert.rejects(host.finish({ abortError: primary }), (error) =>
    allErrors(error).includes(primary),
  );
  restored(host);
  assert.equal(host.state().measuring, false);
  assert.equal(host.nativeCalls.dispose, 1);
  assert.equal(host.proof.snapshot().closed, true);
  assert.ok(host.proof.snapshot().reasons.length > 0);
});
test("collect error and every cleanup failure are retained while remaining cleanup and restoration are attempted", async () => {
  const primary = new Error("literal-primary-collect"),
    dispose = new Error("literal-dispose-cleanup"),
    disconnect = new Error("literal-disconnect-cleanup"),
    cancel = new Error("literal-native-cancel-cleanup");
  const host = makeFixtureHost({
    collectError: primary,
    disposeError: dispose,
    disconnectError: disconnect,
    cancelError: cancel,
  });
  const id = host.nativeRequest(() => {});
  host.setState({ scriptFrameHandle: id });
  let failure;
  try {
    await host.finish();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, "failure must be surfaced");
  for (const expected of [primary, dispose, disconnect, cancel])
    assert.ok(allErrors(failure).includes(expected), `retain ${expected.message}`);
  assert.equal(host.nativeCalls.dispose, 1);
  assert.equal(host.nativeCalls.disconnect, 1);
  assert.deepEqual(host.nativeCalls.cancellations, [id]);
  restored(host);
});
test("pending native callback after closed window delegates but adds no new eligibility or illegal-record count", async () => {
  const host = makeFixtureHost(),
    received = [];
  const id = host.window.requestAnimationFrame((raw) => received.push(raw));
  await host.finish();
  const before = host.proof.snapshot();
  const raw = 23.000000000000004;
  host.fire(id, raw);
  assert.deepEqual(received.map(float64Bits), [float64Bits(raw)]);
  const after = host.proof.snapshot();
  assert.deepEqual(after.frames, before.frames);
  assert.deepEqual(after.callbacks, before.callbacks);
  assert.equal(after.counters.samplesAfterClose, before.counters.samplesAfterClose);
  host.proof.callback(id + 100, 24, 25, true);
  assert.equal(
    host.proof.snapshot().counters.samplesAfterClose,
    before.counters.samplesAfterClose + 1,
  );
  assert.ok(host.proof.snapshot().reasons.includes("SAMPLE_AFTER_CLOSE"));
});
test("restoration refuses to overwrite a foreign replacement and preserves ownership error", async () => {
  const host = makeFixtureHost(),
    foreign = () => {};
  host.window.requestAnimationFrame = foreign;
  await assert.rejects(host.finish(), /V3_RAF_OBSERVER_OWNERSHIP_CHANGED/);
  assert.equal(host.window.requestAnimationFrame, foreign);
});
test("collector pending, frame, proof, callback and mark caps are exact boundaries with visible cap+1 loss", () => {
  const marks = [],
    limits = { ...V3_LIMITS, rawFrames: 1, proofs: 1, callbacks: 2, pendingHandles: 1, marks: 1 };
  const c = createProofCollector({ mark: (name) => marks.push(name), limits });
  c.begin("cap-fixture");
  c.register(1, true);
  assert.equal(c.snapshot().counters.capHits, 0);
  c.register(2, true);
  assert.ok(c.snapshot().reasons.includes("PENDING_HANDLE_CAP"));
  c.callback(1, 1, 2, true);
  assert.equal(c.snapshot().frames.length, 1);
  assert.equal(marks.length, 1);
  c.callback(2, 2, 3, true);
  assert.equal(c.snapshot().frames.length, 1);
  assert.equal(c.snapshot().counters.droppedProofs, 1);
  c.callback(3, 3, 4, true);
  assert.equal(c.snapshot().callbacks.length, 2);
  assert.equal(c.snapshot().counters.droppedCallbacks, 1);
});
test("ASCII mark-name byte and character budgets pass exactly and fail cap-minus-one without retained growth", () => {
  const row = {
    ordinal: 1,
    requestHandle: 1,
    rawRafBits: "3ff0000000000000",
    observedNowBits: "4000000000000000",
  };
  const bytes = observationName("mark-boundary", row).length;
  for (const [budget, expected] of [
    [bytes, 1],
    [bytes - 1, 0],
  ]) {
    const c = createProofCollector({
      mark() {},
      limits: { ...V3_LIMITS, markNameCharacters: budget, markNameBytes: budget },
    });
    c.begin("mark-boundary");
    c.register(1, true);
    c.callback(1, 1, 2, true);
    assert.equal(c.snapshot().frames.length, expected);
    assert.equal(c.snapshot().counters.emittedMarks, expected);
    assert.ok(c.snapshot().counters.markNameBytes <= budget);
    if (!expected) assert.ok(c.snapshot().reasons.includes("MARK_STORAGE_CAP"));
  }
});
test("collector rejects unbounded, missing, nonfinite and nonpositive cap configuration before retaining data", () => {
  for (const overrides of [
    null,
    {},
    { ...V3_LIMITS, callbacks: Infinity },
    { ...V3_LIMITS, proofs: NaN },
    { ...V3_LIMITS, pendingHandles: 0 },
    { ...V3_LIMITS, marks: -1 },
    { ...V3_LIMITS, callbacks: V3_LIMITS.callbacks + 1 },
  ]) {
    assert.throws(() => createProofCollector({ mark() {}, limits: overrides }), /CAP|LIMIT|SCHEMA/);
  }
});
test("precollection registrations are bounded and their cap loss survives collection begin", () => {
  const c = createProofCollector({
    mark() {},
    limits: { ...V3_LIMITS, callbacks: 2, pendingHandles: 1 },
  });
  c.register(40, false);
  c.register(41, false);
  c.begin("precollection-cap");
  const snapshot = c.snapshot();
  assert.equal(snapshot.counters.precollectionRegistrations, 2);
  assert.equal(snapshot.counters.precollectionPendingAtBegin, 1);
  assert.ok(snapshot.reasons.includes("PRECOLLECTION_HANDLE_CAP"));
});
