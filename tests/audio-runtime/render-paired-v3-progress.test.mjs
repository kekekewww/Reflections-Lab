import test from "node:test";
import assert from "node:assert/strict";
import {
  createPairedV3Progress,
  createPairedV3PartialCapture,
} from "../browser/nonadvanced/long-render/paired-v3-progress.mjs";

const sha = "a".repeat(64);
function file(id) {
  return {
    id,
    filename: `${id}.paired.wav`,
    bytes: 72,
    sha256: sha,
    frames: 2,
    channels: 2,
    rate: 48000,
  };
}
function graph(id) {
  return {
    id,
    frames: 2,
    contextFrames: 802,
    tailFrames: 0,
    peak: 0.5,
    outsideUnit: 0,
    nonfinite: 0,
    controlSha256: sha,
    startedAtUtc: "2026-11-03T00:00:00.000Z",
    finishedAtUtc: "2026-11-03T00:00:00.001Z",
    renderMs: 1,
    persistMs: 2,
    estimatedWorkingBytes: 4096,
  };
}
function comparison(id, actualId, referenceId) {
  return {
    id,
    actualId,
    referenceId,
    frames: 2,
    summary: {
      frames: 2,
      channels: 2,
      sampleRateHz: 48000,
      tolerance: 2e-6,
      actualFrames: 2,
      referenceFrames: 2,
      comparedSamples: 4,
      maxError: 3e-6,
      seamError: 0,
      tailError: 0,
      rmsError: 1.5e-6,
      firstOver: { frame: 1, channel: 0, actual: 3e-6, reference: 0, error: 3e-6 },
      atMax: { frame: 1, channel: 0, actual: 3e-6, reference: 0, error: 3e-6 },
      overCount: 1,
      perSecondMax: [3e-6],
      nonfinite: { count: 0, actual: 0, reference: 0, difference: 0, first: null },
    },
  };
}
function completedJournal() {
  const journal = createPairedV3Progress();
  const ids = ["master-62a", "master-63a", "master-63b", "master-62b"];
  for (const id of ids) journal.recordGraph(file(id), graph(id));
  const pairs = [
    ["same-duration-62", ids[0], ids[3]],
    ["same-duration-63", ids[1], ids[2]],
    ["cross-62a-63a", ids[0], ids[1]],
    ["cross-62a-63b", ids[0], ids[2]],
    ["cross-62b-63a", ids[3], ids[1]],
    ["cross-62b-63b", ids[3], ids[2]],
  ];
  for (const [id, actualId, referenceId] of pairs)
    journal.recordComparison(comparison(id, actualId, referenceId));
  return journal;
}

test("V3 progress retains the same frozen metadata references and refuses heavy or over-bound payloads", () => {
  const journal = createPairedV3Progress();
  const originalFile = file("master-62a"),
    originalGraph = graph("master-62a");
  journal.recordGraph(originalFile, originalGraph);
  const row = comparison("same-duration-62", "master-62a", "master-62a");
  journal.recordComparison(row);
  const snap = journal.snapshot();
  assert.equal(snap.files[0], originalFile);
  assert.equal(snap.graphs[0], originalGraph);
  assert.equal(snap.comparisons[0], row);
  assert.equal(snap.comparisons[0].summary, row.summary);
  assert.ok(Object.isFrozen(snap) && Object.isFrozen(snap.files) && Object.isFrozen(originalFile));
  assert.ok(Object.isFrozen(row.summary.perSecondMax));
  assert.equal(snap.productComplete, false);
  assert.equal(snap.downloads, "NOT_COMPLETED");
  assert.equal(snap.independentParser, "NOT_COMPLETED");
  const shallow = createPairedV3Progress();
  shallow.recordGraph(file("master-62a"), graph("master-62a"));
  const shallowRow = Object.freeze(comparison("same-duration-62", "master-62a", "master-62a"));
  assert.equal(Object.isFrozen(shallowRow.summary), false);
  shallow.recordComparison(shallowRow);
  assert.ok(Object.isFrozen(shallowRow.summary) && Object.isFrozen(shallowRow.summary.nonfinite));
  assert.throws(() => {
    shallowRow.summary.input = new ArrayBuffer(8);
  }, TypeError);
  const customPrototype = createPairedV3Progress();
  customPrototype.recordGraph(file("master-62a"), graph("master-62a"));
  const customRow = comparison("same-duration-62", "master-62a", "master-62a");
  Object.setPrototypeOf(
    customRow.summary.perSecondMax,
    Object.assign(Object.create(Array.prototype), { hidden: new ArrayBuffer(8) }),
  );
  assert.throws(() => customPrototype.recordComparison(customRow), /METADATA/);
  assert.throws(
    () => journal.recordGraph({ ...file("bad"), blob: new Blob(["PCM"]) }, graph("bad")),
    /METADATA/,
  );
  assert.throws(
    () =>
      journal.recordTiming({
        stage: "read",
        id: "source",
        elapsedMs: 1,
        input: new ArrayBuffer(8),
      }),
    /METADATA/,
  );
  assert.throws(
    () =>
      journal.recordComparison({
        ...comparison("bad", "master-62a", "master-62a"),
        source: { frames: [] },
      }),
    /METADATA/,
  );
  const coerciveHashesAccepted = [];
  for (const field of ["file-hash", "control-hash"]) {
    const coercive = { toString: () => sha, retained: new ArrayBuffer(8) };
    const hashFile = file(`coercive-${field}`),
      hashGraph = graph(`coercive-${field}`);
    if (field === "file-hash") hashFile.sha256 = coercive;
    else hashGraph.controlSha256 = coercive;
    try {
      createPairedV3Progress().recordGraph(hashFile, hashGraph);
      coerciveHashesAccepted.push(field);
    } catch (failure) {
      assert.match(failure.message, /METADATA/);
    }
  }
  assert.deepEqual(coerciveHashesAccepted, []);
  const bounded = createPairedV3Progress();
  for (let i = 0; i < 128; i++)
    bounded.recordTiming({ stage: "read", id: String(i), elapsedMs: i });
  bounded.recordTiming({ stage: "read", id: "overflow", elapsedMs: 1 });
  assert.equal(bounded.snapshot().timings.length, 128);
  assert.equal(bounded.snapshot().overflow.timings, 1);
  assert.equal(bounded.snapshot().status, "ERROR");
});

test("V3 partial failure is sticky and browser completion never claims download or independent completion", () => {
  const incomplete = createPairedV3Progress();
  incomplete.recordGraph(file("master-62a"), graph("master-62a"));
  incomplete.fail("original deadline");
  incomplete.finishBrowser("PASS");
  const failed = incomplete.snapshot();
  assert.equal(failed.phase, "INCOMPLETE");
  assert.equal(failed.status, "ERROR");
  assert.equal(failed.error, "original deadline");
  assert.equal(failed.files.length, 1);
  assert.equal(failed.productComplete, false);
  const complete = completedJournal();
  complete.finishBrowser("FAIL");
  const done = complete.snapshot();
  assert.equal(done.phase, "BROWSER_COMPLETE");
  assert.equal(done.status, "FAIL");
  assert.equal(done.files.length, 4);
  assert.equal(done.comparisons.length, 6);
  assert.equal(done.productComplete, false);
  assert.equal(done.downloads, "NOT_COMPLETED");
  assert.equal(done.independentParser, "NOT_COMPLETED");
  assert.throws(() => complete.recordGraph(file("extra"), graph("extra")), /LIMIT|CLOSED/);
});

test("V3 cleanup reads partial once within remaining budget and discards late payloads", async () => {
  const capture = createPairedV3PartialCapture();
  let resolveRead,
    reads = 0;
  const read = new Promise((resolve) => {
    resolveRead = resolve;
  });
  const result = await capture.capture(
    () => {
      reads++;
      return read;
    },
    { remainingMs: 25, reserveMs: 15, maxMs: 3 },
  );
  assert.equal(result.availability, "UNAVAILABLE");
  assert.match(result.reason, /DEADLINE/);
  assert.equal(result.overallStatus, "ERROR");
  assert.equal(result.partialRecoveryAttempted, true);
  assert.equal(reads, 1);
  const late = completedJournal();
  late.finishBrowser("PASS");
  resolveRead(late.snapshot());
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(capture.result, result);
  const repeated = await capture.capture(
    () => {
      reads++;
      return Promise.resolve(late.snapshot());
    },
    { remainingMs: 100, reserveMs: 0, maxMs: 50 },
  );
  assert.equal(repeated.availability, "SKIPPED");
  assert.equal(reads, 1);
  const available = createPairedV3PartialCapture();
  const received = await available.capture(() => Promise.resolve(late.snapshot()), {
    remainingMs: 100,
    reserveMs: 20,
    maxMs: 50,
  });
  assert.equal(received.availability, "AVAILABLE");
  assert.equal(received.overallStatus, "ERROR");
  assert.equal(received.partial.productComplete, false);
  const exhausted = createPairedV3PartialCapture();
  const skipped = await exhausted.capture(
    () => {
      throw new Error("must not read without close budget");
    },
    { remainingMs: 10, reserveMs: 20, maxMs: 500 },
  );
  assert.equal(skipped.availability, "SKIPPED");
  assert.equal(skipped.budgetMs, 0);
});
