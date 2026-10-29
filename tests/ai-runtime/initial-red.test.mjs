import test from "node:test";
import assert from "node:assert/strict";
import { OfflinePlanner } from "../../src/ai/offline-planner.ts";

test("offline planner is explicitly offline and preserves zero model calls", () => {
  assert.equal(new OfflinePlanner().provenance.label, "OFFLINE_DETERMINISTIC");
  assert.equal(new OfflinePlanner().provenance.modelId, null);
});
