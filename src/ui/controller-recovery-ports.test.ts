import assert from "node:assert/strict";
import test from "node:test";
import { createSafeController } from "./controller-ports.js";
import type { LabController, LabViewModel } from "./contracts.js";
import type { RecordingRecoveryEntryView } from "./recovery-contracts.js";

test("safe controller preserves asynchronous prototype recovery ports and their receiver", async () => {
  const calls: string[] = [];
  const entries: readonly RecordingRecoveryEntryView[] = [];
  const runtime = Object.assign(
    Object.create({
      async listRecordingRecovery() {
        assert.equal(this, runtime);
        calls.push("list");
        return entries;
      },
      async recoverRecording(id: string) {
        assert.equal(this, runtime);
        calls.push(`recover:${id}`);
      },
      async discardRecordingRecovery(id: string) {
        assert.equal(this, runtime);
        calls.push(`discard:${id}`);
      },
    }),
    {
      getSnapshot: () => ({ projectName: "fixture" }) as LabViewModel,
      subscribe: () => () => {},
      getPose: () => undefined,
      dispatch: () => {},
    },
  ) as LabController;
  const safe = createSafeController(runtime, assert.fail);
  assert.equal(await safe.listRecordingRecovery?.(), entries);
  await safe.recoverRecording?.("session.recover");
  await safe.discardRecordingRecovery?.("session.discard");
  assert.deepEqual(calls, ["list", "recover:session.recover", "discard:session.discard"]);
});

test("safe controller keeps absent recovery ports absent and preserves refusals for inline feedback", async () => {
  const runtime: LabController = {
    getSnapshot: () => ({ projectName: "fixture" }) as LabViewModel,
    subscribe: () => () => {},
    getPose: () => undefined,
    dispatch: () => {},
  };
  const legacy = createSafeController(runtime, assert.fail);
  assert.equal(legacy.listRecordingRecovery, undefined);
  assert.equal(legacy.recoverRecording, undefined);
  assert.equal(legacy.discardRecordingRecovery, undefined);
  runtime.recoverRecording = async () => {
    throw new Error("recovery integrity refusal");
  };
  const safe = createSafeController(runtime, assert.fail);
  await assert.rejects(() => safe.recoverRecording!("session.invalid"), /integrity refusal/);
});
