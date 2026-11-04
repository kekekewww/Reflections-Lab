import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createNativePartialJournal,
  readNativePartialOnce,
} from "../browser/audio-virtualization/partial-results.mjs";

const dimensions = { sampleRate: 48000, frames: 96000 };
function completedCase(id = "sample-integrated-pitch-and-offset") {
  return {
    id,
    pass: true,
    referencePcm: new Float32Array([0, 0.25, -0.5]),
    candidatePcm: new Float32Array([0, 0.25, -0.5]),
  };
}

test("a later render exception preserves the completed case and original PCM references", () => {
  const result = completedCase();
  const journal = createNativePartialJournal<typeof result>(dimensions);
  journal.append(result);
  try {
    throw new Error("LATER_OFFLINE_RENDER_FAILED");
  } catch (error) {
    journal.fail(error);
  }
  const snapshot = journal.snapshot();
  assert.equal(snapshot.status, "FAIL");
  assert.equal(snapshot.schemaVersion, "native03-partial-v1");
  assert.equal(snapshot.sampleRate, 48000);
  assert.equal(snapshot.frames, 96000);
  assert.match(snapshot.error ?? "", /LATER_OFFLINE_RENDER_FAILED/);
  assert.equal(snapshot.results.length, 1);
  assert.strictEqual(snapshot.results[0], result);
  assert.strictEqual(snapshot.results[0]!.referencePcm, result.referencePcm);
  assert.strictEqual(snapshot.results[0]!.candidatePcm, result.candidatePcm);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.results));
});

test("published snapshots remain stable while later completed cases are appended", () => {
  const first = completedCase("first");
  const second = completedCase("second");
  const journal = createNativePartialJournal<typeof first>(dimensions);
  journal.append(first);
  const earlier = journal.snapshot();
  journal.append(second);
  assert.deepEqual(earlier.results, [first]);
  assert.deepEqual(journal.snapshot().results, [first, second]);
  assert.ok(Object.isFrozen(earlier));
  assert.ok(Object.isFrozen(earlier.results));
});

test("completion cannot turn an already failed partial journal into success", () => {
  const journal = createNativePartialJournal(dimensions);
  const result = completedCase();
  journal.append(result);
  journal.fail(new Error("ORIGINAL_FAILURE"));
  journal.complete();
  assert.equal(journal.snapshot().status, "FAIL");
  assert.strictEqual(journal.snapshot().results[0], result);
});

test("an outer timeout recovers completed RUNNING results once and remains FAIL", async () => {
  const result = completedCase();
  const journal = createNativePartialJournal<typeof result>(dimensions);
  journal.append(result);
  let calls = 0;
  const recovery = await readNativePartialOnce(async () => {
    calls++;
    return journal.snapshot();
  }, 20);
  assert.equal(calls, 1);
  assert.equal(recovery.status, "FAIL");
  assert.equal(recovery.partialState, "AVAILABLE");
  assert.equal(recovery.snapshot?.status, "RUNNING");
  assert.strictEqual(recovery.snapshot?.results[0], result);
  assert.ok(Object.isFrozen(recovery.snapshot));
  assert.ok(Object.isFrozen(recovery.snapshot?.results));
});

test("reading a COMPLETE snapshot is evidence recovery and never upgrades outer FAIL", async () => {
  const journal = createNativePartialJournal(dimensions);
  journal.append(completedCase());
  journal.complete();
  const recovery = await readNativePartialOnce(async () => journal.snapshot(), 20);
  assert.equal(recovery.status, "FAIL");
  assert.equal(recovery.partialState, "AVAILABLE");
  assert.equal(recovery.snapshot?.status, "COMPLETE");
});

test(
  "a never-resolving partial read consumes one attempt and the caller's remaining budget",
  { timeout: 500 },
  async () => {
    let calls = 0;
    const recovery = await readNativePartialOnce(() => {
      calls++;
      return new Promise<unknown>(() => undefined);
    }, 10);
    assert.equal(calls, 1);
    assert.equal(recovery.status, "FAIL");
    assert.equal(recovery.partialState, "UNAVAILABLE");
    assert.equal(recovery.snapshot, null);
    assert.match(recovery.error ?? "", /DEADLINE/);
  },
);

test("a throwing read reports UNAVAILABLE without retrying", async () => {
  let calls = 0;
  const recovery = await readNativePartialOnce(async () => {
    calls++;
    throw new Error("PAGE_ALREADY_CLOSED");
  }, 20);
  assert.equal(calls, 1);
  assert.equal(recovery.status, "FAIL");
  assert.equal(recovery.partialState, "UNAVAILABLE");
  assert.equal(recovery.snapshot, null);
  assert.match(recovery.error ?? "", /PAGE_ALREADY_CLOSED/);
});

test(
  "late read resolution cannot mutate a returned deadline failure",
  { timeout: 500 },
  async () => {
    let settle!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      settle = resolve;
    });
    let calls = 0;
    const recovery = await readNativePartialOnce(() => {
      calls++;
      return pending;
    }, 10);
    assert.equal(calls, 1);
    const original = { ...recovery };
    const journal = createNativePartialJournal(dimensions);
    journal.append(completedCase());
    journal.complete();
    settle(journal.snapshot());
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(recovery, original);
    assert.equal(recovery.partialState, "UNAVAILABLE");
    assert.equal(recovery.snapshot, null);
  },
);

test("the twenty-first completed result is rejected without discarding the first twenty references", () => {
  const journal = createNativePartialJournal<ReturnType<typeof completedCase>>(dimensions);
  const results = Array.from({ length: 20 }, (_, index) => completedCase(`case-${index}`));
  for (const result of results) journal.append(result);
  assert.throws(() => journal.append(completedCase("overflow")), /NATIVE_PARTIAL_RESULT_CAP/);
  const snapshot = journal.snapshot();
  assert.equal(snapshot.results.length, 20);
  for (let index = 0; index < results.length; index++)
    assert.strictEqual(snapshot.results[index], results[index]);
});

test("unknown or out-of-bound payloads cannot become available partial evidence", async () => {
  const valid = {
    schemaVersion: "native03-partial-v1",
    status: "RUNNING",
    sampleRate: 48000,
    frames: 96000,
    results: [],
    error: null,
  };
  for (const payload of [
    null,
    { ...valid, schemaVersion: "unknown" },
    { ...valid, status: "PASS" },
    { ...valid, sampleRate: 0 },
    { ...valid, sampleRate: Infinity },
    { ...valid, frames: 1.5 },
    { ...valid, results: Array(21).fill({}) },
    { ...valid, error: 42 },
  ]) {
    let calls = 0;
    const recovery = await readNativePartialOnce(async () => {
      calls++;
      return payload;
    }, 20);
    assert.equal(calls, 1);
    assert.equal(recovery.status, "FAIL");
    assert.equal(recovery.partialState, "UNAVAILABLE");
    assert.equal(recovery.snapshot, null);
  }
});

test("the browser source pin manifest includes the recovery module and its companion declaration", async () => {
  const runner = await readFile(
    new URL("../browser/audio-virtualization/run.mjs", import.meta.url),
    "utf8",
  );
  const list = runner.match(/const sources\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(list, "the runner must declare the before/after source pin manifest");
  const paths = Array.from(list[1]!.matchAll(/["']([^"']+)["']/g), (match) => match[1]);
  assert.ok(paths.includes("tests/browser/audio-virtualization/partial-results.mjs"));
  assert.ok(paths.includes("tests/browser/audio-virtualization/partial-results.d.mts"));
});
