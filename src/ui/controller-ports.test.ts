import assert from "node:assert/strict";
import test from "node:test";
import { createSafeController } from "./controller-ports.js";
import type { LabController, LabViewModel } from "./contracts.js";

function controller(): LabController {
  return {
    getSnapshot: () => ({ projectName: "fixture" }) as LabViewModel,
    subscribe: () => () => {},
    getPose: () => undefined,
    dispatch: () => {},
  };
}
test("shell error wrapper preserves optional prototype ports and their runtime receiver", async () => {
  const base = controller();
  const calls: number[] = [];
  const marker = { id: "runtime-port" };
  const runtime = Object.assign(
    Object.create({
      getRenderHost() {
        assert.equal(this, runtime);
        return marker;
      },
      getMotionWorkspace() {
        assert.equal(this, runtime);
        return marker;
      },
      getAgentSession() {
        assert.equal(this, runtime);
        return marker;
      },
      getAudioDiagnostics() {
        assert.equal(this, runtime);
        return marker;
      },
      readLiveMonitor(mode: string, input?: string) {
        assert.equal(this, runtime);
        assert.equal(mode, "waveform");
        assert.equal(input, "master-right");
        return null;
      },
      releaseLiveMonitor() {
        assert.equal(this, runtime);
        calls.push(-1);
      },
      async captureShortTake(seconds: number) {
        assert.equal(this, runtime);
        calls.push(seconds);
      },
    }),
    base,
  ) as LabController;
  const safe = createSafeController(runtime, (message) => assert.fail(message));
  assert.equal(safe.getRenderHost?.(), marker);
  assert.equal(safe.getMotionWorkspace?.(), marker);
  assert.equal(safe.getAgentSession?.(), marker);
  assert.equal(safe.getAudioDiagnostics?.(), marker);
  await safe.captureShortTake?.(3);
  assert.equal(safe.readLiveMonitor?.("waveform", "master-right"), null);
  safe.releaseLiveMonitor?.();
  assert.deepEqual(calls, [3, -1]);
});
test("legacy controllers retain absent optional capabilities and dispatch errors stay visible", async () => {
  const base = controller(),
    errors: string[] = [];
  const safe = createSafeController(base, (message) => errors.push(message));
  assert.equal(safe.getRenderHost, undefined);
  assert.equal(safe.getMotionWorkspace, undefined);
  assert.equal(safe.captureShortTake, undefined);
  assert.equal(safe.readLiveMonitor, undefined);
  assert.equal(safe.releaseLiveMonitor, undefined);
  base.dispatch = () => {
    throw new Error("sync refusal");
  };
  await safe.dispatch({ type: "run" });
  base.dispatch = async () => {
    throw new Error("async refusal");
  };
  await safe.dispatch({ type: "run" });
  assert.deepEqual(errors, ["sync refusal", "async refusal"]);
});
