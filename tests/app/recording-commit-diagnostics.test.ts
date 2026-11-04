import assert from "node:assert/strict";
import test from "node:test";
import {
  RecordingEvaluationCommitDiagnostics,
  RecordingStorageCommitDiagnostics,
  beginRecordingCommit,
  observeRecordingCommit,
  recordingCommitElapsed,
  recordingCommitTime,
} from "../../src/experiments/recording-commit-diagnostics.js";
import { RecordingHost } from "../../src/app/recording-host.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import {
  RecordingEvaluationClient,
  type RecordingEvaluationWorkerPort,
} from "../../src/app/recording-evaluation-client.js";
import { frame, options } from "../experiment-runtime/worker-fixture.js";

test("both tables retain exactly first eight and last two scalar rows, including an in-flight row", () => {
  for (const diagnostics of [
    new RecordingStorageCommitDiagnostics(),
    new RecordingEvaluationCommitDiagnostics(),
  ]) {
    for (let index = 1; index <= 1000; index++) {
      diagnostics.begin();
      diagnostics.mark("tick", index);
      diagnostics.mark("firstTick", index);
      diagnostics.mark("completed", index < 1000);
      diagnostics.mark("unlistedFrameOrBuffer", new Uint8Array(1));
    }
    const result = diagnostics.snapshot();
    assert.equal(result.count, 1000);
    assert.deepEqual(
      result.first.map((row) => row.sequence),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      result.last.map((row) => row.sequence),
      [999, 1000],
    );
    assert.equal(result.last[1]?.completed, false);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.first));
    for (const row of [...result.first, ...result.last]) {
      assert.ok(Object.isFrozen(row));
      assert.ok(
        Object.values(row).every(
          (value) => value === null || typeof value === "number" || typeof value === "boolean",
        ),
      );
      assert.ok(!("unlistedFrameOrBuffer" in row));
    }
    diagnostics.begin();
    assert.equal(result.count, 1000);
    assert.equal(result.last[1]?.sequence, 1000);
  }
});

test("unavailable/invalid observations are null and a measured zero stays zero", (t) => {
  const diagnostics = new RecordingEvaluationCommitDiagnostics();
  diagnostics.begin();
  diagnostics.mark("capacityCallMs", 0);
  diagnostics.mark("capacityAwaitMs", NaN);
  diagnostics.mark("appendEnqueueMs", -1);
  diagnostics.mark("encodedFrameBytes", Infinity);
  diagnostics.mark("completed", "yes");
  const row = diagnostics.snapshot().first[0]!;
  assert.equal(row.tick, null);
  assert.equal(row.capacityCallMs, 0);
  assert.equal(row.capacityAwaitMs, null);
  assert.equal(row.appendEnqueueMs, null);
  assert.equal(row.encodedFrameBytes, null);
  assert.equal(row.completed, null);
  assert.equal(recordingCommitElapsed(null, 5), null);
  assert.equal(recordingCommitElapsed(5, 4), null);
  assert.equal(recordingCommitElapsed(0, 0), 0);
  for (const value of [NaN, Infinity, -1]) {
    const mock = t.mock.method(performance, "now", () => value);
    assert.equal(recordingCommitTime(), null);
    mock.mock.restore();
  }
  const mock = t.mock.method(performance, "now", () => {
    throw new Error("clock");
  });
  assert.equal(recordingCommitTime(), null);
  mock.mock.restore();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "performance")!;
  try {
    Object.defineProperty(globalThis, "performance", { configurable: true, value: undefined });
    assert.equal(recordingCommitTime(), null);
  } finally {
    Object.defineProperty(globalThis, "performance", descriptor);
  }
  const throwing = {
    begin() {
      throw new Error("begin");
    },
    mark() {
      throw new Error("mark");
    },
  };
  assert.doesNotThrow(() => beginRecordingCommit(throwing));
  assert.doesNotThrow(() => observeRecordingCommit(throwing, "tick", 0));
});

test("host splits synchronous capacity, asynchronous wait and append, reusing enqueue's byte count", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const store = new BlobStore({ indexedDB: null });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const host = new RecordingHost({
    getConfig: options,
    evaluateCapture: async () => [],
    createPersistence: (recorder, callbacks) => {
      const session = store.createRecordingPersistence(recorder, callbacks);
      const wait = session.waitForCapacity.bind(session);
      session.waitForCapacity = (input) => {
        now += 3;
        return wait(input).then(() => gate);
      };
      const enqueue = session.enqueue.bind(session);
      session.enqueue = (input) => {
        enqueue(input);
        now += 5;
      };
      return session;
    },
  });
  try {
    host.start();
    host.appendEvaluationFrame(frame(0), []);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const pending = host.getCommitDiagnostics()!;
    assert.equal(pending.evaluation.first[0]?.capacityCallMs, 3);
    assert.equal(pending.evaluation.first[0]?.capacityAwaitMs, null);
    assert.equal(pending.evaluation.first[0]?.encodedFrameBytes, null);
    now += 17;
    release();
    await host.flushEvaluation();
    const finished = host.getCommitDiagnostics()!;
    assert.equal(finished.evaluation.first[0]?.capacityAwaitMs, 17);
    assert.equal(finished.evaluation.first[0]?.appendEnqueueMs, 5);
    await host.stop();
    const stopped = host.getCommitDiagnostics()!;
    assert.equal(
      stopped.evaluation.first[0]?.encodedFrameBytes,
      stopped.storage?.first[0]?.batchEncodedBytes,
    );
    assert.equal(pending.evaluation.first[0]?.capacityAwaitMs, null);
  } finally {
    release();
    host.dispose();
    store.close();
  }
});

test("throwing clocks/observers preserve host ordering, canonical result and capacity failure", async (t) => {
  const run = async () => {
    const store = new BlobStore({ indexedDB: null });
    const host = new RecordingHost({
      getConfig: options,
      evaluateCapture: async () => [],
      createPersistence: (recorder, callbacks) =>
        store.createRecordingPersistence(recorder, callbacks),
    });
    try {
      host.start();
      for (let tick = 0; tick < 3; tick++) {
        host.appendEvaluationFrame(frame(tick), []);
        await host.flushEvaluation();
      }
      return await host.stop();
    } finally {
      host.dispose();
      store.close();
    }
  };
  const baseline = await run();
  t.mock.method(performance, "now", () => {
    throw new Error("clock");
  });
  t.mock.method(RecordingEvaluationCommitDiagnostics.prototype, "begin", () => {
    throw new Error("observer");
  });
  t.mock.method(RecordingEvaluationCommitDiagnostics.prototype, "mark", () => {
    throw new Error("observer");
  });
  assert.deepEqual(await run(), baseline);
  const original = new Error("original capacity failure");
  let enqueues = 0;
  const store = new BlobStore({ indexedDB: null });
  const host = new RecordingHost({
    getConfig: options,
    evaluateCapture: async () => [],
    createPersistence: (recorder, callbacks) => {
      const session = store.createRecordingPersistence(recorder, callbacks);
      session.waitForCapacity = async () => {
        throw original;
      };
      session.enqueue = () => {
        enqueues++;
      };
      return session;
    },
  });
  try {
    host.start();
    host.appendEvaluationFrame(frame(0), []);
    await assert.rejects(host.flushEvaluation(), (reason) => reason === original);
    assert.equal(enqueues, 0);
    assert.equal(host.getEvaluationTelemetry()?.committedFrames, 0);
  } finally {
    host.dispose();
    store.close();
  }
});

test("a reused worker and a late earlier reply cannot populate the next capture's commit rows", async () => {
  let creates = 0;
  const messages: { id: number }[] = [];
  const port: RecordingEvaluationWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage(value) {
      messages.push(value as { id: number });
    },
    terminate() {},
  };
  const client = new RecordingEvaluationClient({
    workerFactory: () => {
      creates++;
      return port;
    },
  });
  const store = new BlobStore({ indexedDB: null });
  const host = new RecordingHost({
    getConfig: options,
    evaluateCapture: (requests) => client.capture(requests),
    createPersistence: (recorder, callbacks) =>
      store.createRecordingPersistence(recorder, callbacks),
  });
  try {
    host.start();
    host.appendEvaluationFrame(frame(0), []);
    const firstMessage = messages[0]!;
    port.onmessage!({ data: { id: firstMessage.id, ok: true, output: [] } });
    await host.stop();
    const prior = host.getCommitDiagnostics()!;
    host.start();
    const empty = host.getCommitDiagnostics()!;
    assert.notEqual(empty.captureRunId, prior.captureRunId);
    assert.notEqual(empty.sessionId, prior.sessionId);
    host.appendEvaluationFrame(frame(0), []);
    port.onmessage!({ data: { id: firstMessage.id, ok: true, output: [] } });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(host.getCommitDiagnostics()!.evaluation.count, 0);
    const nextMessage = messages[1]!;
    port.onmessage!({ data: { id: nextMessage.id, ok: true, output: [] } });
    await host.stop();
    const next = host.getCommitDiagnostics()!;
    assert.equal(creates, 1);
    assert.equal(next.evaluation.count, 1);
    assert.equal(next.storage?.count, 1);
    assert.equal(prior.evaluation.count, 1);
    assert.equal(empty.evaluation.count, 0);
  } finally {
    host.dispose();
    client.dispose();
    store.close();
  }
});

test("host rejects storage diagnostics with any mismatched capture/session/epoch/revision", () => {
  const store = new BlobStore({ indexedDB: null });
  const host = new RecordingHost({
    getConfig: options,
    createPersistence: (recorder, callbacks) =>
      store.createRecordingPersistence(recorder, callbacks),
  });
  try {
    host.start();
    const access = host as unknown as {
      persistence: import("../../src/experiments/recording-persistence.js").RecordingCapturePersistence;
    };
    const session = access.persistence;
    const get = session.getCommitDiagnostics!.bind(session);
    const before = get();
    for (const change of [
      { captureRunId: "run.other" },
      { sessionId: "session.other" },
      { runEpoch: "epoch.other" },
      { sceneRevision: 99 },
    ]) {
      session.getCommitDiagnostics = () => ({ ...before, ...change });
      assert.equal(host.getCommitDiagnostics(), null);
    }
    session.getCommitDiagnostics = get;
    assert.ok(host.getCommitDiagnostics());
    assert.equal(session.getTelemetry().acceptedFrames, 0);
  } finally {
    host.dispose();
    store.close();
  }
});

test("missing persistence leaves capacity timings, session and byte observations unavailable", async () => {
  const host = new RecordingHost({ getConfig: options, evaluateCapture: async () => [] });
  try {
    host.start();
    host.appendEvaluationFrame(frame(0), []);
    await host.flushEvaluation();
    const diagnostics = host.getCommitDiagnostics()!;
    assert.equal(diagnostics.sessionId, null);
    assert.equal(diagnostics.storage, null);
    assert.equal(diagnostics.evaluation.first[0]?.capacityCallMs, null);
    assert.equal(diagnostics.evaluation.first[0]?.capacityAwaitMs, null);
    assert.equal(diagnostics.evaluation.first[0]?.encodedFrameBytes, null);
    assert.equal(diagnostics.evaluation.first[0]?.completed, true);
  } finally {
    host.dispose();
  }
});
