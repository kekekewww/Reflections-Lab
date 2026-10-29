import test from "node:test";
import assert from "node:assert/strict";
import { makeWindowHost, driveWindow } from "./window-boundary.spec.mjs";

test("tail preserves initial-drain runtime error before a resolved pause clears it", async () => {
  const h = makeWindowHost(),
    lateError = "literal-initial-drain-recording-failure";
  const raw = h.close(),
    before = JSON.stringify(raw);
  h.schedule(() => {
    h.live.error = lateError;
    h.samples.actions.push({
      phase: "measure",
      atMs: 606000,
      method: "dispatch",
      action: "recordToggle",
      error: lateError,
      simulationState: "running",
      recordingState: "finalizing",
    });
  }, 6000);
  h.runtime.dispatch = async () => {
    h.live.error = null;
  };
  await assert.rejects(driveWindow(h, h.finish()), (error) => String(error).includes(lateError));
  assert.equal(h.tail().status, "TAIL_INCOMPLETE_UNVERIFIED");
  assert.ok(
    h
      .tail()
      .runtimeErrorObservations.some((row) => row.stage === "pause" && row.error === lateError),
  );
  assert.ok(
    h.tail().lateActions.some((row) => row.action === "recordToggle" && row.error === lateError),
  );
  assert.equal(JSON.stringify(raw), before);
  assert.equal(raw.captureWindows[0].end, null);
  assert.equal(h.disposing, 1);
});

test("tail rejects a resolved pause dispatch that publishes a new runtime error", async () => {
  const h = makeWindowHost(),
    lateError = "literal-resolved-pause-runtime-failure";
  h.live.pending = false;
  const raw = h.close(),
    before = JSON.stringify(raw);
  h.runtime.dispatch = async () => {
    h.live.error = lateError;
  };
  await assert.rejects(driveWindow(h, h.finish()), (error) => String(error).includes(lateError));
  assert.equal(h.tail().status, "TAIL_INCOMPLETE_UNVERIFIED");
  assert.ok(h.tail().runtimeErrorObservations.some((row) => row.error === lateError));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(h.disposing, 1);
});

test("same preexisting runtime error permits drain and saves late action/capture only in sidecar", async () => {
  const h = makeWindowHost(),
    baselineError = h.live.error;
  const raw = h.close(),
    before = JSON.stringify(raw);
  h.schedule(() => {
    h.samples.actions.push({
      phase: "measure",
      atMs: 606000,
      method: "dispatch",
      action: "recordToggle",
      error: null,
      simulationState: "running",
      recordingState: "captured",
    });
  }, 6000);
  await driveWindow(h, h.finish());
  const tail = h.tail();
  assert.equal(tail.status, "TAIL_DRAINED_OUTSIDE_WINDOW");
  assert.ok(Array.isArray(tail.runtimeErrorObservations), "tail must retain runtime observations");
  assert.ok(Array.isArray(tail.lateActions), "tail must retain post-window action summaries");
  assert.ok(
    Array.isArray(tail.postWindowCaptures),
    "tail must retain post-window capture summaries",
  );
  assert.ok(tail.runtimeErrorObservations.every((row) => row.error === baselineError));
  assert.ok(
    tail.lateActions.some(
      (row) => row.action === "recordToggle" && row.atMs === 606000 && row.error === null,
    ),
  );
  assert.ok(
    tail.postWindowCaptures.some(
      (row) => row.index === 2 && row.endAtMs === 606000 && row.outsideWindow === true,
    ),
  );
  assert.equal(tail.lateActionsTruncated, false);
  assert.equal(tail.captureSummariesTruncated, false);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(raw.actions.length, 0);
  assert.equal(raw.captureWindows[0].end, null);
  assert.equal(h.disposing, 1);
});
