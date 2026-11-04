import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";

// R21 (USER-R21-UI-02): the main page shows no explanatory text. At startup nothing has
// happened yet, so the status line (pause reason, then notice) must stay empty.
test("startup leaves the status line empty instead of showing help text", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const view = app.getSnapshot();
  assert.equal(view.pauseReason || view.notice, "");
});
