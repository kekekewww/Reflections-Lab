import assert from "node:assert/strict";
import test from "node:test";
import { RecordingHost } from "../../src/app/recording-host.js";
import { LabRuntime } from "../../src/app/runtime.js";
import {
  RecordingEvaluationClient,
  type RecordingEvaluationWorkerPort,
} from "../../src/app/recording-evaluation-client.js";
import {
  RecordingPersistenceSession,
  type RecordingPersistenceBackend,
} from "../../src/experiments/recording-persistence.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { options, frame } from "../experiment-runtime/worker-fixture.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}
function finiteTime(value: number | null): asserts value is number {
  assert.equal(typeof value, "number");
  assert.ok(Number.isFinite(value) && value! >= 0);
}
class Port implements RecordingEvaluationWorkerPort {
  onmessage: RecordingEvaluationWorkerPort["onmessage"] = null;
  onerror: RecordingEvaluationWorkerPort["onerror"] = null;
  onmessageerror: RecordingEvaluationWorkerPort["onmessageerror"] = null;
  messages: { id: number }[] = [];
  terminated = 0;
  postMessage(value: unknown) {
    this.messages.push(value as { id: number });
  }
  terminate() {
    this.terminated++;
  }
  succeed() {
    this.onmessage?.({ data: { id: this.messages.at(-1)!.id, ok: true, output: [] } });
  }
}
function backend(create: Promise<void>, append = Promise.resolve()): RecordingPersistenceBackend {
  return {
    create: () => create,
    append: () => append,
    publish: async () => {
      throw new Error("not published by readiness tests");
    },
    interrupt: async () => {},
  };
}

test("evaluation and storage pressure identify the actual bounded lane", async () => {
  const evaluationGate = deferred<readonly []>();
  const origins: string[] = [];
  const host = new RecordingHost({
    getConfig: () => options("run.eval-pressure"),
    evaluateCapture: () => evaluationGate.promise,
    onEvaluationBackpressure: (origin) => origins.push(origin),
  });
  try {
    host.start();
    for (let tick = 0; tick < 8; tick++) host.appendEvaluationFrame(frame(tick), []);
    assert.deepEqual(origins, ["evaluation"]);
    assert.equal(host.getEvaluationTelemetry()!.acceptedFrames, 8);
    assert.equal(host.getEvaluationTelemetry()!.pendingFrames, 8);
    evaluationGate.resolve([]);
    await host.flushEvaluation();
  } finally {
    evaluationGate.resolve([]);
    host.dispose();
  }

  const createGate = deferred<void>();
  const storageOrigins: string[] = [];
  const storageHost = new RecordingHost({
    getConfig: () => options("run.storage-pressure"),
    createPersistence: (recorder, callbacks) =>
      new RecordingPersistenceSession(
        "session.pressure",
        recorder.captureSealSnapshot(),
        backend(createGate.promise),
        callbacks,
      ),
    onEvaluationBackpressure: (origin) => storageOrigins.push(origin),
  });
  try {
    storageHost.start();
    for (let tick = 0; tick < 8; tick++) storageHost.appendFrame(frame(tick));
    assert.deepEqual(storageOrigins, ["storage"]);
    assert.equal(storageHost.getPersistenceTelemetry()!.pendingFrames, 8);
  } finally {
    createGate.resolve();
    await storageHost.flushEvaluation();
    storageHost.dispose();
  }
});

test("runtime retains one immutable pressure snapshot and keeps the original pause guard", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    assert.equal(runtime.getRecordingBackpressureDiagnostics(), null);
    await runtime.dispatch({ type: "recordToggle" });
    for (let tick = 0; tick < 8; tick++) runtime.advance(1 / 60);
    const captured = runtime.getRecordingBackpressureDiagnostics();
    assert.ok(captured);
    assert.equal(captured.origin, "evaluation");
    assert.equal(captured.worldTick, 8);
    assert.equal(captured.simulationTimeSeconds, 8 / 60);
    assert.equal(captured.recordingDurationSeconds, 0);
    assert.equal(captured.evaluation?.acceptedFrames, 8);
    assert.equal(captured.evaluation?.committedFrames, 0);
    assert.equal(captured.evaluation?.pendingFrames, 8);
    assert.equal(captured.persistence?.pendingFrames, 0);
    assert.equal(
      captured.persistence?.acceptedFrames,
      0,
      "raw storage watermark must not be overwritten by evaluation's producer watermark",
    );
    assert.equal(captured.evaluationReadiness?.mode, "yieldingReference");
    assert.equal(captured.evaluationReadiness?.firstWorkerCreatedAtWallMs, null);
    assert.equal(runtime.getSnapshot().simulationState, "paused");
    assert.equal(runtime.getSnapshot().recording.state, "recording");
    assert.ok(Object.isFrozen(captured));
    assert.ok(
      Buffer.byteLength(JSON.stringify(captured)) < 8192,
      "the retained scalar snapshot has a finite diagnostic payload",
    );
    assert.ok(Object.isFrozen(captured.evaluation));
    assert.ok(Object.isFrozen(captured.persistence));
    assert.throws(() => {
      (captured.evaluation as { pendingFrames: number }).pendingFrames = 1;
    }, TypeError);
    await runtime.flushRecordingEvaluation();
    assert.equal(
      runtime.getRecordingBackpressureDiagnostics(),
      captured,
      "drain does not replace first-guard evidence",
    );
    assert.equal(captured.evaluation?.pendingFrames, 8, "retained snapshot is by value");
    assert.equal(
      runtime.getSnapshot().simulationState,
      "paused",
      "diagnostic reads and draining do not resume physics",
    );
    await runtime.dispatch({ type: "recordToggle" });
    await runtime.dispatch({ type: "recordToggle" });
    assert.equal(
      runtime.getRecordingBackpressureDiagnostics(),
      null,
      "new capture clears only the previous diagnostic",
    );
    await runtime.dispatch({ type: "recordToggle" });
  } finally {
    runtime.dispose();
  }
  assert.equal(runtime.getRecordingBackpressureDiagnostics(), null);
});

test("worker lifecycle diagnostics stay lazy and distinguish create, successful post and protocol reply", async () => {
  const port = new Port();
  let created = 0;
  const client = new RecordingEvaluationClient({
    workerFactory: () => {
      created++;
      return port;
    },
  });
  try {
    const initial = client.getReadinessDiagnostics();
    assert.equal(created, 0);
    assert.equal(initial.workerCreateCount, 0);
    assert.equal(initial.firstWorkerCreatedAtWallMs, null);
    assert.equal(initial.firstWorkerPostedAtWallMs, null);
    assert.equal(initial.firstWorkerProtocolReplyAtWallMs, null);
    const capture = client.capture([]);
    const pending = client.getReadinessDiagnostics();
    assert.equal(created, 1);
    assert.equal(pending.workerActive, true);
    finiteTime(pending.firstWorkerCreatedAtWallMs);
    finiteTime(pending.firstWorkerPostedAtWallMs);
    assert.ok(pending.firstWorkerPostedAtWallMs >= pending.firstWorkerCreatedAtWallMs);
    assert.equal(pending.firstWorkerProtocolReplyAtWallMs, null);
    port.onmessage?.({ data: { id: port.messages[0]!.id + 100, ok: true, output: [] } });
    assert.equal(client.getReadinessDiagnostics().firstWorkerProtocolReplyAtWallMs, null);
    port.succeed();
    await capture;
    const ready = client.getReadinessDiagnostics();
    finiteTime(ready.firstWorkerProtocolReplyAtWallMs);
    assert.ok(ready.firstWorkerProtocolReplyAtWallMs >= ready.firstWorkerPostedAtWallMs!);
    assert.ok(Object.isFrozen(ready));
    assert.equal(
      pending.firstWorkerProtocolReplyAtWallMs,
      null,
      "earlier diagnostic snapshots cannot mutate",
    );
  } finally {
    client.dispose();
  }
});

test("retired worker replies cannot update the next worker's timing generation", async () => {
  const first = new Port(),
    second = new Port();
  let creates = 0;
  const client = new RecordingEvaluationClient({
    workerFactory: () => (creates++ === 0 ? first : second),
  });
  try {
    assert.equal(typeof client.getReadinessDiagnostics, "function");
    const old = client.capture([]);
    const oldHandler = first.onmessage!;
    const oldId = first.messages[0]!.id;
    const oldGeneration = client.getReadinessDiagnostics().workerGeneration;
    client.cancel("TEST_REPLACE");
    await assert.rejects(old, { code: "EVALUATION_CANCELLED" });
    assert.equal(client.getReadinessDiagnostics().workerActive, false);
    const current = client.capture([]);
    assert.notEqual(client.getReadinessDiagnostics().workerGeneration, oldGeneration);
    oldHandler({ data: { id: oldId, ok: true, output: [] } });
    assert.equal(client.getReadinessDiagnostics().firstWorkerProtocolReplyAtWallMs, null);
    second.succeed();
    await current;
    finiteTime(client.getReadinessDiagnostics().firstWorkerProtocolReplyAtWallMs);
    assert.equal(client.getReadinessDiagnostics().workerCreateCount, 2);
  } finally {
    client.dispose();
  }
});

test("yielding reference never reports a native worker creation or readiness", async () => {
  const client = new RecordingEvaluationClient({ useWorker: false, yieldTask: async () => {} });
  try {
    assert.equal(typeof client.getReadinessDiagnostics, "function");
    await client.capture([]);
    const value = client.getReadinessDiagnostics();
    assert.equal(value.mode, "yieldingReference");
    assert.equal(value.workerCreateCount, 0);
    assert.equal(value.workerGeneration, null);
    assert.equal(value.firstWorkerCreatedAtWallMs, null);
    assert.equal(value.firstWorkerPostedAtWallMs, null);
    assert.equal(value.firstWorkerProtocolReplyAtWallMs, null);
  } finally {
    client.dispose();
  }
});

test("storage diagnostics distinguish pending creation, readiness and actual append completion", async () => {
  const create = deferred<void>(),
    append = deferred<void>();
  const recorder = new ExperimentRecorder(options("run.storage-readiness"));
  const session = new RecordingPersistenceSession(
    "session.readiness",
    recorder.captureSealSnapshot(),
    backend(create.promise, append.promise),
  );
  const first = session.getReadinessTelemetry();
  finiteTime(first.createStartedAtWallMs);
  assert.equal(first.createReadyAtWallMs, null);
  assert.equal(first.createFailedAtWallMs, null);
  assert.equal(first.firstAppendStartedAtWallMs, null);
  create.resolve();
  await session.flush();
  const ready = session.getReadinessTelemetry();
  finiteTime(ready.createReadyAtWallMs);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await Promise.resolve();
  await Promise.resolve();
  const writing = session.getReadinessTelemetry();
  finiteTime(writing.firstAppendStartedAtWallMs);
  assert.equal(writing.firstAppendCompletedAtWallMs, null);
  append.resolve();
  await session.flush();
  const completed = session.getReadinessTelemetry();
  finiteTime(completed.firstAppendCompletedAtWallMs);
  assert.ok(completed.firstAppendCompletedAtWallMs >= completed.firstAppendStartedAtWallMs!);
  assert.ok(Object.isFrozen(completed));
  assert.equal(first.createReadyAtWallMs, null);
  assert.equal(session.getTelemetry().persistedFrames, 1);
  await session.cancel("TEST_COMPLETE");
});

test("storage creation diagnostics preserve the original error without claiming readiness", async () => {
  const create = deferred<void>();
  const original = new Error("CREATE_TEST_FAILED");
  const failures: Error[] = [];
  const recorder = new ExperimentRecorder(options("run.storage-failed"));
  const session = new RecordingPersistenceSession(
    "session.failed",
    recorder.captureSealSnapshot(),
    backend(create.promise),
    { onFailure: (value) => failures.push(value) },
  );
  create.reject(original);
  await assert.rejects(session.flush(), (value) => value === original);
  await Promise.resolve();
  await Promise.resolve();
  const diagnostics = session.getReadinessTelemetry();
  assert.equal(diagnostics.createReadyAtWallMs, null);
  finiteTime(diagnostics.createFailedAtWallMs);
  assert.equal(diagnostics.createError, "CREATE_TEST_FAILED");
  assert.deepEqual(failures, [original]);
  assert.equal(session.getTelemetry().state, "interrupted");
});

test("an unavailable optional diagnostic cannot defeat the original complete-tick pause", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  const client = Reflect.get(runtime, "recordingEvaluation") as RecordingEvaluationClient;
  const original = client.getReadinessDiagnostics;
  try {
    await runtime.dispatch({ type: "recordToggle" });
    client.getReadinessDiagnostics = () => {
      throw new Error("OBSERVATION_ONLY_FAILURE");
    };
    for (let tick = 0; tick < 8; tick++) runtime.advance(1 / 60);
    const retained = runtime.getRecordingBackpressureDiagnostics();
    assert.ok(retained);
    assert.equal(retained.origin, "evaluation");
    assert.equal(retained.diagnosticError, "RECORDING_DIAGNOSTIC_UNAVAILABLE");
    assert.equal(retained.evaluationReadiness, null);
    assert.equal(retained.evaluation?.acceptedFrames, 8);
    assert.equal(runtime.getSnapshot().simulationState, "paused");
    assert.equal(runtime.getSnapshot().recording.state, "recording");
  } finally {
    client.getReadinessDiagnostics = original;
    runtime.dispose();
  }
});
