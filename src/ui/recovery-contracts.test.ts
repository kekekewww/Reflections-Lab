import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveRemovalActions,
  recordingRecoveryActions,
  type RecordingRecoveryEntryView,
} from "./recovery-contracts.js";

const entry: RecordingRecoveryEntryView = {
  sessionId: "session.pending",
  runId: "run.pending",
  runEpoch: "epoch.pending",
  sceneRevision: 1,
  state: "staging",
  persistedFrames: 3,
  persistedTick: 2,
  reservedBytes: 2048,
  reason: null,
  leaseExpiresAt: 100,
  canRecover: true,
  canDiscard: true,
};

test("a live recording lease blocks recovery and discard despite stale capabilities", () => {
  assert.deepEqual(recordingRecoveryActions(entry, 99), {
    activeLease: true,
    canRecover: false,
    canDiscard: false,
  });
  assert.deepEqual(recordingRecoveryActions(entry, 100), {
    activeLease: false,
    canRecover: true,
    canDiscard: true,
  });
});

test("recovery needs a verified persisted prefix and host permission; discard remains explicit", () => {
  assert.equal(
    recordingRecoveryActions({ ...entry, state: "interrupted", persistedFrames: 0 }, 0).canRecover,
    false,
  );
  assert.equal(
    recordingRecoveryActions({ ...entry, state: "interrupted", canRecover: false }, 0).canRecover,
    false,
  );
  assert.equal(
    recordingRecoveryActions({ ...entry, state: "interrupted", canDiscard: false }, 0).canDiscard,
    false,
  );
  assert.equal(recordingRecoveryActions({ ...entry, state: "interrupted" }, 0).canRecover, true);
});

// Archive writer status and cleanup authorization are independent of recording leases.
test("archive cleanup requires interrupted status and explicit permission, and never removes an active writer", () => {
  assert.deepEqual(
    archiveRemovalActions({ status: "published", activeWriter: false, canDiscard: false }),
    { canRemove: true, reason: null },
  );
  assert.deepEqual(
    archiveRemovalActions({ status: "interrupted", activeWriter: false, canDiscard: true }),
    { canRemove: true, reason: null },
  );
  for (const status of ["writing", "published", "interrupted"] as const) {
    assert.deepEqual(archiveRemovalActions({ status, activeWriter: true, canDiscard: true }), {
      canRemove: false,
      reason: "activeWriter",
    });
  }
  assert.deepEqual(
    archiveRemovalActions({ status: "writing", activeWriter: false, canDiscard: true }),
    { canRemove: false, reason: "needsRecovery" },
  );
  assert.deepEqual(
    archiveRemovalActions({ status: "interrupted", activeWriter: false, canDiscard: false }),
    { canRemove: false, reason: "needsRecovery" },
  );
});
