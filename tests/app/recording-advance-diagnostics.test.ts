import assert from "node:assert/strict";
import test from "node:test";
import {
  RecordingAdvanceDiagnostics,
  type RecordingAdvanceTimingInput,
} from "../../src/app/recording-advance-diagnostics.js";

function row(index: number, overrun = false): RecordingAdvanceTimingInput {
  return {
    previousRafAtMs: 100 + (index - 1) * 16,
    currentRafAtMs: 100 + index * 16,
    callbackAtMs: 101 + index * 16,
    deltaSeconds: 1 / 60,
    accumulatorBeforeSeconds: 1 / 120,
    accumulatorAfterSeconds: 0,
    steps: 1,
    tickBefore: index - 1,
    tickAfter: index,
    overrun,
    advanceElapsedMs: 2,
    onTickElapsedMs: 1,
    admissionElapsedMs: 0.5,
    publishElapsedMs: 0.25,
    hostFlushElapsedMs: null,
  };
}

test("advance diagnostics begin with no invented recording or timing observations", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.captureSequence, 0);
  assert.equal(snapshot.startTick, null);
  assert.equal(snapshot.startWallMarkMs, null);
  assert.equal(snapshot.latestResumeWallMarkMs, null);
  assert.equal(snapshot.advanceCount, 0);
  assert.deepEqual(snapshot.first, []);
  assert.deepEqual(snapshot.last, []);
  assert.equal(snapshot.firstOverrun, null);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.first));
  assert.ok(Object.isFrozen(snapshot.last));
});

test("100 advances retain only the first eight, latest two, and first overrun", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(0, 90);
  diagnostics.markResumed(100);
  for (let index = 1; index <= 100; index++) diagnostics.record(row(index, index === 37));
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.advanceCount, 100);
  assert.deepEqual(
    snapshot.first.map((value) => value.sequence),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.deepEqual(
    snapshot.last.map((value) => value.sequence),
    [99, 100],
  );
  assert.equal(snapshot.firstOverrun?.sequence, 37);
  assert.equal(snapshot.firstOverrun?.overrun, true);
  assert.equal(
    snapshot.first.length + snapshot.last.length + Number(snapshot.firstOverrun !== null),
    11,
  );
  assert.equal(snapshot.first[0]?.previousRafAtMs, 100);
  assert.equal(snapshot.last[1]?.tickAfter, 100);
});

test("the first overrun remains fixed when later overruns replace the latest ring rows", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(0, 0);
  for (let index = 1; index <= 30; index++)
    diagnostics.record(row(index, index === 2 || index === 9 || index === 30));
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.firstOverrun?.sequence, 2);
  assert.equal(snapshot.firstOverrun?.tickAfter, 2);
  assert.deepEqual(
    snapshot.last.map((value) => value.sequence),
    [29, 30],
  );
  assert.equal(snapshot.last[1]?.overrun, true);
});

test("inputs and returned immutable snapshots cannot mutate retained diagnostic rows", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(0, 1);
  const input = row(1, true);
  diagnostics.record(input);
  input.deltaSeconds = 9;
  const first = diagnostics.snapshot();
  const second = diagnostics.snapshot();
  assert.notEqual(first, second);
  assert.notEqual(first.first, second.first);
  assert.notEqual(first.first[0], second.first[0]);
  assert.notEqual(first.firstOverrun, second.firstOverrun);
  assert.ok(Object.isFrozen(first.first[0]));
  assert.ok(Object.isFrozen(first.last[0]));
  assert.ok(Object.isFrozen(first.firstOverrun));
  assert.equal(Reflect.set(first.first[0]!, "steps", 999), false);
  assert.equal(first.first[0]?.deltaSeconds, 1 / 60);
  diagnostics.record(row(2));
  assert.equal(first.advanceCount, 1);
  assert.deepEqual(
    first.last.map((value) => value.sequence),
    [1],
  );
  assert.equal(diagnostics.snapshot().advanceCount, 2);
});

test("unknown invalid and nonfinite observations remain null while true zero and false survive", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(NaN, Infinity);
  diagnostics.markResumed(NaN);
  diagnostics.record({
    previousRafAtMs: undefined,
    currentRafAtMs: NaN,
    callbackAtMs: -1,
    deltaSeconds: { scene: "must not be retained" },
    accumulatorBeforeSeconds: Infinity,
    accumulatorAfterSeconds: "0",
    steps: 0.5,
    tickBefore: -1,
    tickAfter: Number.MAX_SAFE_INTEGER + 1,
    overrun: 0,
    advanceElapsedMs: null,
    onTickElapsedMs: [],
    admissionElapsedMs: -Infinity,
    publishElapsedMs: undefined,
    hostFlushElapsedMs: { unknown: true },
  });
  const unknown = diagnostics.snapshot();
  assert.equal(unknown.startTick, null);
  assert.equal(unknown.startWallMarkMs, null);
  assert.equal(unknown.latestResumeWallMarkMs, null);
  for (const [key, value] of Object.entries(unknown.first[0]!))
    if (key !== "sequence") assert.equal(value, null, key);
  diagnostics.markResumed(0);
  diagnostics.record({
    previousRafAtMs: 0,
    currentRafAtMs: 0,
    callbackAtMs: 0,
    deltaSeconds: 0,
    accumulatorBeforeSeconds: 0,
    accumulatorAfterSeconds: 0,
    steps: 0,
    tickBefore: 0,
    tickAfter: 0,
    overrun: false,
    advanceElapsedMs: 0,
    onTickElapsedMs: 0,
    admissionElapsedMs: 0,
    publishElapsedMs: 0,
    hostFlushElapsedMs: 0,
  });
  const zero = diagnostics.snapshot().last[1]!;
  for (const [key, value] of Object.entries(zero)) {
    if (key === "sequence") assert.equal(value, 2);
    else if (key === "overrun") assert.equal(value, false);
    else assert.equal(value, 0, key);
  }
});

test("a new capture increments its identity and clears previous rows and overrun", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(37, 123);
  diagnostics.markResumed(124);
  diagnostics.record(row(1, true));
  diagnostics.startCapture(80, null);
  const next = diagnostics.snapshot();
  assert.equal(next.captureSequence, 2);
  assert.equal(next.startTick, 80);
  assert.equal(next.startWallMarkMs, null);
  assert.equal(next.latestResumeWallMarkMs, null);
  assert.equal(next.advanceCount, 0);
  assert.deepEqual(next.first, []);
  assert.deepEqual(next.last, []);
  assert.equal(next.firstOverrun, null);
  diagnostics.record({ tickBefore: 80, tickAfter: 81, steps: 1 });
  assert.equal(diagnostics.snapshot().first[0]?.sequence, 1);
  assert.equal(diagnostics.snapshot().first[0]?.resumeWallMarkMs, null);
});

test("resume marks apply to later rows without clearing the capture or its earlier observations", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(5, 5);
  diagnostics.markResumed(10);
  diagnostics.record(row(1));
  diagnostics.markResumed(30);
  diagnostics.record(row(2));
  diagnostics.markResumed(null);
  diagnostics.record(row(3));
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.captureSequence, 1);
  assert.equal(snapshot.advanceCount, 3);
  assert.equal(snapshot.latestResumeWallMarkMs, null);
  assert.deepEqual(
    snapshot.first.map((value) => value.resumeWallMarkMs),
    [10, 30, null],
  );
});

test("only the fixed scalar whitelist is retained, never scene PCM or trace references", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(0, 0);
  diagnostics.record({
    ...row(1),
    scene: { secret: "SCENE_REFERENCE" },
    pcm: new Float32Array([1, 2]),
    trace: { secret: "TRACE_REFERENCE" },
  } as RecordingAdvanceTimingInput);
  const snapshot = diagnostics.snapshot();
  assert.deepEqual(
    Object.keys(snapshot.first[0]!).sort(),
    [
      "sequence",
      "previousRafAtMs",
      "currentRafAtMs",
      "callbackAtMs",
      "resumeWallMarkMs",
      "deltaSeconds",
      "accumulatorBeforeSeconds",
      "accumulatorAfterSeconds",
      "steps",
      "tickBefore",
      "tickAfter",
      "overrun",
      "advanceElapsedMs",
      "onTickElapsedMs",
      "admissionElapsedMs",
      "publishElapsedMs",
      "hostFlushElapsedMs",
    ].sort(),
  );
  assert.ok(!JSON.stringify(snapshot).includes("SCENE_REFERENCE"));
  assert.ok(!JSON.stringify(snapshot).includes("TRACE_REFERENCE"));
});

test("host flush updates only current first recent and overrun slots, leaving prior snapshots unchanged", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(0, 1);
  diagnostics.record(row(1, true));
  const beforeFlush = diagnostics.snapshot();
  diagnostics.markHostFlush(6.5);
  const afterFlush = diagnostics.snapshot();
  assert.equal(afterFlush.first[0]?.hostFlushElapsedMs, 6.5);
  assert.equal(afterFlush.last[0]?.hostFlushElapsedMs, 6.5);
  assert.equal(afterFlush.firstOverrun?.hostFlushElapsedMs, 6.5);
  assert.equal(beforeFlush.first[0]?.hostFlushElapsedMs, null);
  assert.equal(beforeFlush.last[0]?.hostFlushElapsedMs, null);
  assert.equal(beforeFlush.firstOverrun?.hostFlushElapsedMs, null);
  diagnostics.record(row(2));
  diagnostics.markHostFlush(4);
  const next = diagnostics.snapshot();
  assert.equal(next.advanceCount, 2);
  assert.equal(next.first[0]?.hostFlushElapsedMs, 6.5);
  assert.equal(next.first[1]?.hostFlushElapsedMs, 4);
  assert.equal(next.last[0]?.hostFlushElapsedMs, 6.5);
  assert.equal(next.last[1]?.hostFlushElapsedMs, 4);
  assert.equal(next.firstOverrun?.hostFlushElapsedMs, 6.5);
  assert.equal(afterFlush.advanceCount, 1);
  assert.equal(afterFlush.first[0]?.hostFlushElapsedMs, 6.5);
});

test("host flush without a current advance is a no-op and unknown does not masquerade as zero", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  assert.doesNotThrow(() => diagnostics.markHostFlush(2));
  assert.equal(diagnostics.snapshot().advanceCount, 0);
  assert.deepEqual(diagnostics.snapshot().first, []);
  diagnostics.startCapture(0, 0);
  diagnostics.markHostFlush(9);
  assert.deepEqual(diagnostics.snapshot().last, []);
  diagnostics.record(row(1));
  for (const value of [undefined, null, NaN, Infinity, -1, "0", {}]) {
    diagnostics.markHostFlush(value);
    assert.equal(diagnostics.snapshot().first[0]?.hostFlushElapsedMs, null);
    assert.equal(diagnostics.snapshot().last[0]?.hostFlushElapsedMs, null);
  }
  diagnostics.markHostFlush(0);
  assert.equal(diagnostics.snapshot().first[0]?.hostFlushElapsedMs, 0);
  assert.equal(diagnostics.snapshot().last[0]?.hostFlushElapsedMs, 0);
  assert.equal(diagnostics.snapshot().advanceCount, 1);
});

test("false overrun observations do not invent a first overrun", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(0, 0);
  for (let index = 1; index <= 20; index++) diagnostics.record(row(index, false));
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.firstOverrun, null);
  assert.equal(snapshot.advanceCount, 20);
  assert.ok(snapshot.first.every((value) => value.overrun === false));
  assert.ok(snapshot.last.every((value) => value.overrun === false));
});

test("throwing observation getters become unknown without stopping retention of valid fields", () => {
  const diagnostics = new RecordingAdvanceDiagnostics();
  diagnostics.startCapture(0, 0);
  const input = row(1);
  for (const key of ["deltaSeconds", "overrun", "publishElapsedMs"]) {
    Object.defineProperty(input, key, {
      enumerable: true,
      get() {
        throw new Error("unavailable observation");
      },
    });
  }
  assert.doesNotThrow(() => diagnostics.record(input));
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.advanceCount, 1);
  assert.equal(snapshot.first[0]?.deltaSeconds, null);
  assert.equal(snapshot.first[0]?.overrun, null);
  assert.equal(snapshot.first[0]?.publishElapsedMs, null);
  assert.equal(snapshot.first[0]?.tickAfter, 1);
  assert.equal(snapshot.first[0]?.steps, 1);
  assert.equal(snapshot.firstOverrun, null);
});
