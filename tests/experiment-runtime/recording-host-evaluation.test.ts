import test from "node:test";
import assert from "node:assert/strict";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import { RecordingHost } from "../../src/app/recording-host.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}

function configuration(): ExperimentRecorderOptions {
  return {
    runId: "run.host-evaluation",
    runEpoch: "epoch.host-evaluation",
    createdAt: "2026-11-02T00:00:00.000Z",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    physicsVersion: "rapier-0.21.0",
    backendVersion: "web-geometric-1.0.0",
    sceneSnapshot: createDefaultScene(),
    sourceConfig: { signal: "sine" },
    behaviorConfig: { gain: 0.2 },
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [],
  };
}

function frame(tick: number): RecordingFrameInput {
  const scene = createDefaultScene();
  return {
    tick,
    sceneRevision: scene.sceneRevision,
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: [...object.positionM] as [number, number, number],
      orientationQuaternion: [...object.orientationQuaternion] as [number, number, number, number],
    })),
    listener: structuredClone(scene.listener),
    physicsEvents: [],
    behaviorDecisions: [],
    audioEvents: [],
    behaviorSnapshot: { diagnostic: { tick, cursor: tick / 60 } },
  };
}

async function settleUntil(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30 && !check(); attempt++)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(check(), true, "the host evaluation must settle");
}

test("stop freezes admission but drains accepted ticks before sealing", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  let sealCount = 0;
  const host = new RecordingHost({
    getConfig: configuration,
    evaluateCapture: () => gate.promise,
    sealRecording: (recorder) => {
      sealCount++;
      return recorder.finish();
    },
  });
  host.start();
  assert.equal(host.appendEvaluationFrame(frame(0), []), true);
  assert.equal(host.appendEvaluationFrame(frame(1), []), true);
  const stopping = host.stop();
  assert.equal(host.getView().pending, true);
  assert.equal(host.getArtifact(), null);
  assert.equal(sealCount, 0);
  assert.equal(host.appendEvaluationFrame(frame(2), []), false);
  assert.throws(() => host.start(), { code: "HOST_BUSY" });
  await assert.rejects(host.stop(), { code: "HOST_BUSY" });
  gate.resolve([]);
  const artifact = await stopping;
  assert.equal(sealCount, 1);
  assert.equal(artifact.status, "captured");
  assert.deepEqual(
    artifact.frames.map((value) => value.tick),
    [0, 1],
  );
  assert.equal(artifact.runEpoch, "epoch.host-evaluation");
  assert.equal(host.getView().recording.canReplay, true);
  assert.equal(host.getView().pending, false);
});

test("A publication waits for evaluation and preserves the full accepted prefix", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  const host = new RecordingHost({ getConfig: configuration, evaluateCapture: () => gate.promise });
  host.start();
  host.appendEvaluationFrame(frame(20), []);
  host.appendEvaluationFrame(frame(21), []);
  const capturing = host.captureComparison("A");
  assert.equal(host.getSlots().A, null);
  assert.equal(host.getView().pending, true);
  assert.equal(host.appendEvaluationFrame(frame(22), []), false);
  gate.resolve([]);
  const artifact = await capturing;
  assert.equal(artifact.status, "captured");
  assert.deepEqual(
    artifact.frames.map((value) => value.tick),
    [20, 21],
  );
  assert.equal(host.getSlots().A!.artifactSha256, artifact.artifactSha256);
});

test("accepted results drain while paused and restore the producer's paused state", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  const host = new RecordingHost({ getConfig: configuration, evaluateCapture: () => gate.promise });
  host.start();
  host.appendEvaluationFrame(frame(0), []);
  host.appendEvaluationFrame(frame(1), []);
  host.pause();
  gate.resolve([]);
  await settleUntil(() => host.getEvaluationTelemetry()!.committedFrames === 2);
  assert.equal(host.appendEvaluationFrame(frame(2), []), false, "draining cannot resume capture");
  assert.equal(host.getView().error, null);
  host.resume();
  assert.equal(host.appendEvaluationFrame(frame(2), []), true);
  const artifact = await host.stop();
  assert.equal(artifact.status, "captured");
  assert.deepEqual(
    artifact.frames.map((value) => value.tick),
    [0, 1, 2],
  );
});

test("high-water pause prevents resume until all reserved ownership reaches low-water", async () => {
  const gates = [deferred<readonly AcousticFrame[]>(), deferred<readonly AcousticFrame[]>()];
  let evaluations = 0;
  let pressure = 0;
  let host!: RecordingHost;
  host = new RecordingHost({
    getConfig: configuration,
    evaluateCapture: () => gates[evaluations++]?.promise ?? Promise.resolve([]),
    evaluationBudget: { maxFrames: 2, lowWaterFrames: 0 },
    onEvaluationBackpressure: () => {
      pressure++;
      host.pause();
    },
  });
  host.start();
  host.appendEvaluationFrame(frame(0), []);
  host.appendEvaluationFrame(frame(1), []);
  assert.equal(pressure, 1);
  assert.throws(() => host.resume(), { code: "EVALUATION_BACKPRESSURE" });
  gates[0]!.resolve([]);
  await settleUntil(() => evaluations === 2);
  assert.throws(() => host.resume(), { code: "EVALUATION_BACKPRESSURE" });
  gates[1]!.resolve([]);
  await settleUntil(() => host.getEvaluationTelemetry()!.pendingFrames === 0);
  assert.equal(host.appendEvaluationFrame(frame(2), []), false);
  host.resume();
  assert.equal(host.appendEvaluationFrame(frame(2), []), true);
  assert.equal((await host.stop()).frameCount, 3);
});

test("failed evaluation seals an interrupted prefix and retains existing comparison slots", async () => {
  const failure = deferred<readonly AcousticFrame[]>();
  let mode: "baseline" | "failure" = "baseline";
  let evaluations = 0;
  const host = new RecordingHost({
    getConfig: configuration,
    evaluateCapture: async () => {
      evaluations++;
      if (mode === "failure" && evaluations === 2) return failure.promise;
      return [];
    },
    reprocessFrame: () => ({ behaviorDecisions: [], audioEvents: [] }),
  });
  host.start();
  host.appendEvaluationFrame(frame(0), []);
  host.appendEvaluationFrame(frame(1), []);
  await host.stop();
  const a = await host.captureComparison("A");
  const b = await host.captureComparison("B");
  mode = "failure";
  evaluations = 0;
  host.start();
  host.appendEvaluationFrame(frame(10), []);
  host.appendEvaluationFrame(frame(11), []);
  host.appendEvaluationFrame(frame(12), []);
  await settleUntil(() => evaluations === 2);
  failure.reject(new Error("worker crashed"));
  await settleUntil(() => host.getEvaluationTelemetry()!.state === "failed");
  const artifact = await host.stop();
  assert.equal(artifact.status, "interrupted");
  assert.equal(artifact.frameCount, 1);
  assert.equal(artifact.endTick, 10);
  assert.match(artifact.reason!, /EVALUATION_FAILED/);
  assert.equal(host.getSlots().A!.artifactSha256, a.artifactSha256);
  assert.equal(host.getSlots().B!.artifactSha256, b.artifactSha256);
  assert.equal(host.getView().recording.canReplay, false);
});

test("interrupt rejects late old-generation results without contaminating the next capture", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  let evaluations = 0;
  let cancellations = 0;
  const host = new RecordingHost({
    getConfig: configuration,
    evaluateCapture: () => (++evaluations === 1 ? gate.promise : Promise.resolve([])),
    cancelEvaluation: () => cancellations++,
  });
  host.start();
  host.appendEvaluationFrame(frame(0), []);
  host.appendEvaluationFrame(frame(1), []);
  const interrupted = await host.interrupt("RESET_REQUESTED");
  assert.equal(interrupted!.status, "interrupted");
  assert.equal(interrupted!.frameCount, 0);
  assert.equal(cancellations, 1);
  host.start();
  host.appendEvaluationFrame(frame(30), []);
  gate.resolve([]);
  const completed = await host.stop();
  assert.equal(completed.status, "captured");
  assert.deepEqual(
    completed.frames.map((value) => value.tick),
    [30],
  );
  assert.notEqual(completed.runId, interrupted!.runId);
});

test("capture admission failure cannot produce a captured partial manifest", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  const host = new RecordingHost({
    getConfig: configuration,
    evaluateCapture: () => gate.promise,
    evaluationBudget: { maxFrames: 1, lowWaterFrames: 0 },
  });
  host.start();
  host.appendEvaluationFrame(frame(0), []);
  assert.throws(() => host.appendEvaluationFrame(frame(1), []), { code: "EVALUATION_CAPACITY" });
  const artifact = await host.stop();
  assert.equal(artifact.status, "interrupted");
  assert.equal(artifact.frameCount, 0);
  assert.equal(host.getView().recording.canReplay, false);
  gate.resolve([]);
});

test("cancelled B evaluation retains a previously completed B and pinned configuration", async () => {
  const current = configuration();
  const gate = deferred<void>();
  const entered = deferred<void>();
  let block = false;
  let cancellations = 0;
  const seen: number[] = [];
  const host = new RecordingHost({
    getConfig: () => current,
    evaluateCapture: async () => [],
    cancelEvaluation: () => cancellations++,
    reprocessFrame: async (_source, pinned) => {
      seen.push((pinned.behaviorConfig as { gain: number }).gain);
      if (block) {
        entered.resolve();
        await gate.promise;
      }
      return { behaviorDecisions: [], audioEvents: [] };
    },
  });
  host.start();
  host.appendEvaluationFrame(frame(0), []);
  host.appendEvaluationFrame(frame(1), []);
  await host.stop();
  await host.captureComparison("A");
  const previousB = await host.captureComparison("B");
  block = true;
  current.behaviorConfig = { gain: 0.8 };
  const candidate = host.captureComparison("B");
  await entered.promise;
  current.behaviorConfig = { gain: 0.1 };
  await host.interrupt("CANCEL_CANDIDATE");
  gate.resolve();
  await assert.rejects(candidate, { code: "OPERATION_CANCELLED" });
  assert.equal(seen.at(-1), 0.8);
  assert.equal(cancellations, 1);
  assert.equal(host.getSlots().B!.artifactSha256, previousB.artifactSha256);
  assert.equal(host.getView().pending, false);
});
