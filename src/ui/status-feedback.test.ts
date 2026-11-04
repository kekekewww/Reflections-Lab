import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../app/runtime.js";
import { statusFeedbackMessages } from "./status-feedback.js";

test("a saved outcome remains visible alongside an existing real runtime pause reason", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const paused = app.getSnapshot();
    assert.ok(paused.pauseReason);
    const scene = app.getSceneDocument();
    await app.dispatch({ type: "save" });
    const saved = app.getSnapshot();
    assert.ok(saved.notice?.includes("儲存"));
    assert.equal(saved.pauseReason, paused.pauseReason);
    assert.equal(saved.simulationState, "paused");
    assert.deepEqual(app.getSceneDocument(), scene);
    assert.deepEqual(statusFeedbackMessages(saved), [saved.notice, saved.pauseReason]);
  } finally {
    app.dispose();
  }
});

test("status presentation deduplicates localized feedback while retaining its latest-outcome order", () => {
  const state = Object.freeze({ notice: "saved", pauseReason: "paused" });
  assert.deepEqual(statusFeedbackMessages(state), ["saved", "paused"]);
  assert.deepEqual(statusFeedbackMessages({ notice: "paused", pauseReason: "paused" }), ["paused"]);
  assert.deepEqual(
    statusFeedbackMessages(state, () => "same localized feedback"),
    ["same localized feedback"],
  );
  assert.deepEqual(state, { notice: "saved", pauseReason: "paused" });
});

test("empty or missing feedback does not invent a success state", () => {
  assert.deepEqual(statusFeedbackMessages({}), []);
  assert.deepEqual(statusFeedbackMessages({ notice: "", pauseReason: "paused" }), ["paused"]);
  assert.deepEqual(statusFeedbackMessages({ notice: "   " }), []);
  assert.deepEqual(
    statusFeedbackMessages({ pauseReason: "paused" }, () => ""),
    [],
  );
});
