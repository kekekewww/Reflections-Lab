import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { OwnedDownloadBatch } from "../browser/nonadvanced/long-render/owned-downloads.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("owned downloads handle the event rejection before a delayed page action can fail", async () => {
  const event = deferred();
  // Test-owned safety handler avoids producing a real process-wide rejection;
  // the audited catch below must still be installed by the batch before evaluate.
  const originalCatch = event.promise.catch.bind(event.promise);
  originalCatch(() => undefined);
  let earlyHandler = false;
  event.promise.catch = (...args) => {
    earlyHandler = true;
    return originalCatch(...args);
  };
  let observed = false;
  const page = {
    waitForEvent() {
      return event.promise;
    },
    async evaluate() {
      observed = earlyHandler;
      throw new Error("PAGE_CLOSED");
    },
  };
  const batch = new OwnedDownloadBatch(page, ".cache/owned-download-unit", () =>
    assert.fail("late saved result"),
  );
  await assert.rejects(batch.run(["one"]), /PAGE_CLOSED/);
  event.reject(new Error("TARGET_CLOSED"));
  await batch.settle();
  assert.equal(observed, true, "event rejection must be handled before evaluating the page");
});

test("owned cancellation after a wall deadline prevents late file publication and the next download", async () => {
  const saved = deferred();
  let waits = 0,
    evaluated = 0;
  const publications = [];
  const download = {
    suggestedFilename: () => "one.wav",
    saveAs: () => saved.promise,
    async cancel() {},
  };
  const page = {
    waitForEvent() {
      waits++;
      return Promise.resolve(download);
    },
    async evaluate() {
      evaluated++;
    },
  };
  const batch = new OwnedDownloadBatch(page, ".cache/owned-download-unit", (value) =>
    publications.push(value),
  );
  const running = batch.run(["one", "two"]);
  const rejected = assert.rejects(running, /CANCELLED/);
  await nextTurn();
  await batch.cancel();
  saved.resolve();
  await rejected;
  await batch.settle();
  assert.deepEqual(publications, []);
  assert.equal(waits, 1);
  assert.equal(evaluated, 1);
});

test("owned cancellation aborts the received in-flight download and settles its rejection", async () => {
  const saved = deferred();
  let cancellations = 0;
  const download = {
    suggestedFilename: () => "one.wav",
    saveAs: () => saved.promise,
    async cancel() {
      cancellations++;
      saved.reject(new Error("DOWNLOAD_CANCELLED"));
    },
  };
  const page = { waitForEvent: () => Promise.resolve(download), async evaluate() {} };
  const batch = new OwnedDownloadBatch(page, ".cache/owned-download-unit", () =>
    assert.fail("cancelled saved result"),
  );
  const rejected = assert.rejects(batch.run(["one"]), /CANCELLED/);
  await nextTurn();
  await batch.cancel();
  // Release even the broken baseline so a failing assertion cannot strand a task.
  if (!cancellations) saved.reject(new Error("TEST_CANCELLED_BASELINE"));
  await rejected;
  await batch.settle();
  assert.equal(cancellations, 1);

  // A late event can create its cancellation after settle starts. Completion must
  // include that newly-created cancellation, not only an earlier array snapshot.
  const lateEvent = deferred();
  const cancellation = deferred();
  const lateDownload = {
    suggestedFilename: () => "late.wav",
    async saveAs() {
      assert.fail("late save");
    },
    cancel: () => cancellation.promise,
  };
  const latePage = { waitForEvent: () => lateEvent.promise, async evaluate() {} };
  const lateBatch = new OwnedDownloadBatch(latePage, ".cache/owned-download-unit", () =>
    assert.fail("late saved result"),
  );
  const lateRejected = assert.rejects(lateBatch.run(["late"]), /CANCELLED/);
  await nextTurn();
  await lateBatch.cancel();
  let settledBeforeCancellation = false;
  const settling = lateBatch.settle().then(() => {
    settledBeforeCancellation = true;
  });
  lateEvent.resolve(lateDownload);
  await nextTurn();
  const premature = settledBeforeCancellation;
  cancellation.resolve();
  await settling;
  await lateRejected;
  assert.equal(premature, false, "settle must wait for cancellation created by a late event");
});
