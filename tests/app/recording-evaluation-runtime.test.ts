import test from "node:test";
import assert from "node:assert/strict";
import { solveAcoustics } from "../../src/acoustics/index.js";
import { LabRuntime } from "../../src/app/runtime.js";
import { RecordingHost } from "../../src/app/recording-host.js";
import type { RecordingEvaluationClient } from "../../src/app/recording-evaluation-client.js";
import type { ExperimentRecorderOptions } from "../../src/experiments/types.js";

interface RuntimeTestAccess {
  recorder: RecordingHost;
  world: { paused: boolean };
  latest: { tick: number };
  recordingConfig(): ExperimentRecorderOptions;
  pauseCore(reason: string): void;
}

test("runtime yieldingReference capture keeps one client job per accepted tick", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  const access = runtime as unknown as RuntimeTestAccess & {
    recordingEvaluation: RecordingEvaluationClient;
  };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ticks: number[] = [];
  access.recordingEvaluation.capture = async (requests) => {
    ticks.push(requests[0]!.poseTick);
    if (ticks.length === 1) await gate;
    return requests.map((request) => solveAcoustics(request).frame);
  };
  try {
    await runtime.dispatch({ type: "recordToggle" });
    for (let index = 0; index < 4; index++) runtime.advance(1 / 60);
    const firstTick = ticks[0]!;
    assert.equal(access.recorder.getEvaluationTelemetry()!.pendingFrames, 4);
    release();
    await runtime.flushRecordingEvaluation();
    assert.deepEqual(ticks, [firstTick, firstTick + 1, firstTick + 2, firstTick + 3]);
    assert.equal(runtime.getRecordingCommitDiagnostics()!.evaluation.count, 4);
    await runtime.dispatch({ type: "recordToggle" });
  } finally {
    release();
    runtime.dispose();
  }
});

for (const mode of ["editor", "fpsAlternative"] as const) {
  test(`recording backpressure refuses early ${mode} Resume before physics advances`, async () => {
    const runtime = await LabRuntime.create({ useWorker: false });
    const access = runtime as unknown as RuntimeTestAccess;
    access.recorder.dispose();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const recorder = new RecordingHost({
      getConfig: () => ({
        ...access.recordingConfig(),
        createdAt: "2026-11-02T00:00:00.000Z",
      }),
      evaluateCapture: async (requests) => {
        await gate;
        return requests.map((request) => solveAcoustics(request).frame);
      },
      evaluationBudget: { maxFrames: 1, lowWaterFrames: 0 },
      onEvaluationBackpressure: () => access.pauseCore("TEST_EVALUATION_BACKPRESSURE"),
    });
    access.recorder = recorder;
    try {
      if (mode === "fpsAlternative") {
        await runtime.dispatch({ type: "setAlternativeInput", enabled: true });
        await runtime.dispatch({ type: "enterFPS" });
      }
      await runtime.dispatch({ type: "recordToggle" });
      runtime.advance(1 / 60);
      const firstTick = access.latest.tick;
      assert.equal(firstTick, 1);
      assert.equal(access.world.paused, true);
      assert.equal(recorder.getEvaluationTelemetry()!.backpressured, true);
      assert.equal(recorder.getEvaluationTelemetry()!.acceptedTick, firstTick);

      await runtime.dispatch({ type: "run" });
      assert.equal(access.world.paused, true, "a rejected Resume must not start the physics clock");
      runtime.advance(1 / 60);
      assert.equal(
        access.latest.tick,
        firstTick,
        "a rejected Resume must not create an unrecorded tick",
      );
      assert.equal(recorder.getEvaluationTelemetry()!.acceptedTick, firstTick);

      release();
      await recorder.flushEvaluation();
      assert.equal(recorder.getEvaluationTelemetry()!.backpressured, false);
      assert.equal(access.world.paused, true, "draining evaluation must not resume the producer");
      await runtime.dispatch({ type: "run" });
      assert.equal(access.world.paused, false);
      runtime.advance(1 / 60);
      await recorder.flushEvaluation();
      assert.equal(access.latest.tick, firstTick + 1);
      assert.equal(recorder.getEvaluationTelemetry()!.acceptedTick, firstTick + 1);
      assert.equal(recorder.getEvaluationTelemetry()!.committedTick, firstTick + 1);

      const artifact = await recorder.stop();
      assert.equal(artifact.status, "captured");
      assert.deepEqual(
        artifact.frames.map((frame) => frame.tick),
        [firstTick, firstTick + 1],
      );
    } finally {
      release();
      runtime.dispose();
    }
  });
}
