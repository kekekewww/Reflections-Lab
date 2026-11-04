import assert from "node:assert/strict";
import test from "node:test";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import {
  RecordingPersistenceSession,
  type EncodedRecordingFrame,
  type RecordingPersistenceBackend,
} from "../../src/experiments/recording-persistence.js";
import {
  RecordingStorageCommitDiagnostics,
  type RecordingCommitObserver,
} from "../../src/experiments/recording-commit-diagnostics.js";
import { canonicalStringify } from "../../src/experiments/hash.js";
import { frame, options } from "./worker-fixture.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
/** The append first awaits WebCrypto digests on the thread pool, which a loaded runner delays. */
async function untilCreated(fake: { created(): boolean }): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!fake.created() && Date.now() < deadline) await turn();
}

test("real memory appends keep exactly first eight and last two batches and original encoded sizes", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  try {
    for (let tick = 0; tick < 15; tick++) {
      recorder.appendFrame(frame(tick));
      session.enqueue(recorder.getLastFrame()!);
      await session.flush();
    }
    const diagnostics = session.getCommitDiagnostics!();
    assert.equal(diagnostics.sessionId, session.getTelemetry().sessionId);
    assert.equal(diagnostics.captureRunId, "run.a");
    assert.equal(diagnostics.runEpoch, "epoch.one");
    assert.equal(diagnostics.sceneRevision, 2);
    assert.equal(diagnostics.storage.count, 15);
    assert.deepEqual(
      diagnostics.storage.first.map((row) => row.sequence),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      diagnostics.storage.last.map((row) => row.sequence),
      [14, 15],
    );
    for (const row of [...diagnostics.storage.first, ...diagnostics.storage.last]) {
      assert.equal(row.batchFrameCount, 1);
      assert.equal(row.queueLengthAtStart, 1);
      assert.equal(row.batchEncodedBytes, row.reservedBytesAtStart);
      assert.equal(row.minFrameBytes, row.maxFrameBytes);
      assert.equal(row.minFrameBytes, row.batchEncodedBytes);
      assert.equal(row.descriptorCountBefore, row.sequence - 1);
      assert.equal(row.completed, true);
      assert.ok(row.appendEndedAtMs! >= row.appendStartedAtMs!);
      assert.ok(row.digestTotalMs! >= 0);
      for (const field of [
        "transactionCreatedAtMs",
        "readsReadyAtMs",
        "validationParseCloneMs",
        "requestsIssuedAtMs",
        "oncompleteAtMs",
      ] as const)
        assert.equal(row[field], null, `memory has no IDB phase ${field}`);
    }
    assert.equal(
      session.getLastEnqueuedFrameBytes!(),
      diagnostics.storage.last[1]?.batchEncodedBytes,
    );
    const artifact = await recorder.finish();
    await session.publish(artifact);
    assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
  } finally {
    store.close();
  }
});

test("batch observations include in-flight ownership and preserve the original batching order", async () => {
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const batches: number[][] = [];
  const recorder = new ExperimentRecorder(options());
  const backend: RecordingPersistenceBackend = {
    create: async () => {},
    append: async (_id, frames) => {
      batches.push(frames.map((frame) => frame.tick));
      if (batches.length === 1) {
        entered();
        await gate;
      }
    },
    interrupt: async () => {},
    publish: async () => {
      throw new Error("unused");
    },
  };
  const session = new RecordingPersistenceSession(
    "session.batch",
    recorder.captureSealSnapshot(),
    backend,
  );
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await started;
  for (let tick = 1; tick < 3; tick++) {
    recorder.appendFrame(frame(tick));
    session.enqueue(recorder.getLastFrame()!);
  }
  const pending = session.getCommitDiagnostics();
  assert.equal(pending.storage.first[0]?.completed, null);
  assert.equal(pending.storage.first[0]?.appendEndedAtMs, null);
  assert.equal(session.getTelemetry().pendingFrames, 3);
  assert.equal(session.getTelemetry().persistedFrames, 0);
  release();
  await session.flush();
  assert.deepEqual(batches, [[0], [1, 2]]);
  const row = session.getCommitDiagnostics().storage.first[1]!;
  assert.equal(row.batchFrameCount, 2);
  assert.equal(row.queueLengthAtStart, 2);
  assert.equal(row.batchEncodedBytes, row.reservedBytesAtStart);
  assert.ok(row.maxFrameBytes! >= row.minFrameBytes!);
  assert.equal(session.getTelemetry().persistedFrames, 3);
  assert.equal(pending.storage.first[0]?.completed, null);
});

test("throwing storage observers and clocks cannot change success, order or the original append failure", async (t) => {
  t.mock.method(performance, "now", () => {
    throw new Error("clock");
  });
  t.mock.method(RecordingStorageCommitDiagnostics.prototype, "mark", () => {
    throw new Error("observer");
  });
  const order: number[] = [];
  const original = new Error("append failed");
  const failures: Error[] = [];
  const recorder = new ExperimentRecorder(options());
  const backend: RecordingPersistenceBackend = {
    create: async () => {},
    append: async (_id, frames) => {
      order.push(...frames.map((entry) => entry.tick));
      if (order.length > 1) throw original;
    },
    interrupt: async () => {},
    publish: async () => {
      throw new Error("unused");
    },
  };
  const session = new RecordingPersistenceSession(
    "session.failure",
    recorder.captureSealSnapshot(),
    backend,
    { onFailure: (error) => failures.push(error) },
  );
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await session.flush();
  assert.equal(session.getTelemetry().persistedFrames, 1);
  recorder.appendFrame(frame(1));
  session.enqueue(recorder.getLastFrame()!);
  await assert.rejects(session.flush(), (reason) => reason === original);
  assert.deepEqual(order, [0, 1]);
  assert.deepEqual(failures, [original]);
  assert.equal(session.getTelemetry().acceptedFrames, 2);
  assert.equal(session.getTelemetry().persistedFrames, 1);
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.equal(session.getCommitDiagnostics().storage.first[0]?.appendStartedAtMs, null);
});

/** Controlled IDB event seam: production digest/append/stagingTransaction remain intact. */
function fakeAppendDatabase(session: unknown) {
  const reads: { result: unknown; onsuccess?: () => void }[] = [];
  const writes: { store: string; value: unknown }[] = [];
  const transaction = {
    oncomplete: null as (() => void) | null,
    onabort: null as (() => void) | null,
    onerror: null as (() => void) | null,
    abort() {
      queueMicrotask(() => transaction.onabort?.());
    },
    objectStore(store: string) {
      return {
        get(key: string) {
          const request = {
            result:
              key === "session.idb" ? session : key === "recordingStagingBytes" ? 0 : undefined,
          };
          reads.push(request);
          return request;
        },
        add(value: unknown) {
          writes.push({ store, value });
        },
        put(value: unknown) {
          writes.push({ store, value });
        },
      };
    },
  };
  let created = false;
  return {
    reads,
    writes,
    transaction,
    database: {
      transaction(stores: string[], mode: string) {
        assert.deepEqual(stores, ["recordingSessions", "recordingChunks", "recordings", "state"]);
        assert.equal(mode, "readwrite");
        created = true;
        return transaction;
      },
    } as unknown as IDBDatabase,
    created: () => created,
  };
}

test("IDB phases belong to one append; three reads precede validation/writes and only oncomplete acknowledges", async (t) => {
  let now = 100;
  t.mock.method(performance, "now", () => now++);
  const recorder = new ExperimentRecorder(options());
  const snapshot = recorder.captureSealSnapshot();
  const session = {
    sessionId: "session.idb",
    runId: snapshot.runId,
    runEpoch: snapshot.runEpoch,
    sceneRevision: 2,
    state: "staging",
    persistedFrames: 0,
    persistedTick: null,
    reservedBytes: 0,
    chunks: [],
    snapshot,
  };
  const fake = fakeAppendDatabase(session);
  const store = new BlobStore({ indexedDB: {} as IDBFactory });
  const backend = store as unknown as {
    open(): Promise<IDBDatabase>;
    appendRecordingChunks(
      id: string,
      frames: readonly EncodedRecordingFrame[],
      observer?: RecordingCommitObserver,
    ): Promise<void>;
  };
  backend.open = async () => fake.database;
  const frames: EncodedRecordingFrame[] = [0, 1].map((tick) => {
    recorder.appendFrame(frame(tick));
    return {
      sequence: tick,
      tick,
      bytes: new TextEncoder().encode(canonicalStringify(recorder.getLastFrame())).buffer,
    };
  });
  const diagnostics = new RecordingStorageCommitDiagnostics();
  diagnostics.begin();
  let acknowledged = false;
  const writing = backend.appendRecordingChunks("session.idb", frames, diagnostics).then(() => {
    acknowledged = true;
  });
  await untilCreated(fake);
  assert.equal(fake.created(), true);
  assert.equal(fake.reads.length, 3);
  assert.equal(fake.writes.length, 0);
  const before = diagnostics.snapshot();
  assert.ok(before.first[0]!.digestTotalMs! >= 0);
  assert.ok(before.first[0]!.transactionCreatedAtMs! >= before.first[0]!.digestsCompletedAtMs!);
  assert.equal(before.first[0]!.readsReadyAtMs, null);
  fake.reads[2]!.onsuccess!();
  fake.reads[0]!.onsuccess!();
  assert.equal(fake.writes.length, 0);
  fake.reads[1]!.onsuccess!();
  const issued = diagnostics.snapshot().first[0]!;
  assert.equal(issued.descriptorCountBefore, 0);
  assert.ok(issued.readsReadyAtMs! > issued.transactionCreatedAtMs!);
  assert.ok(issued.validationParseCloneMs! > 0);
  assert.ok(issued.requestsIssuedAtMs! >= issued.readsReadyAtMs! + issued.validationParseCloneMs!);
  assert.equal(issued.oncompleteAtMs, null);
  assert.equal(fake.writes.length, frames.length + 2);
  await turn();
  assert.equal(acknowledged, false);
  fake.transaction.oncomplete!();
  await writing;
  assert.equal(acknowledged, true);
  assert.ok(diagnostics.snapshot().first[0]!.oncompleteAtMs! > issued.requestsIssuedAtMs!);
  assert.equal(before.first[0]!.readsReadyAtMs, null);
});

test("IDB observer/clock failures preserve completion and the original validation abort with no writes", async (t) => {
  t.mock.method(performance, "now", () => {
    throw new Error("clock");
  });
  for (const corrupt of [false, true]) {
    const recorder = new ExperimentRecorder(options());
    const snapshot = recorder.captureSealSnapshot();
    const fake = fakeAppendDatabase({
      runEpoch: snapshot.runEpoch,
      sceneRevision: 2,
      state: "staging",
      persistedFrames: 0,
      persistedTick: null,
      reservedBytes: 0,
      chunks: [],
    });
    const store = new BlobStore({ indexedDB: {} as IDBFactory });
    const backend = store as unknown as {
      open(): Promise<IDBDatabase>;
      appendRecordingChunks(
        id: string,
        frames: readonly EncodedRecordingFrame[],
        observer: RecordingCommitObserver,
      ): Promise<void>;
    };
    backend.open = async () => fake.database;
    recorder.appendFrame(frame(0));
    const owned = structuredClone(recorder.getLastFrame()!);
    if (corrupt) owned.runEpoch = "epoch.foreign";
    const bytes = new TextEncoder().encode(canonicalStringify(owned)).buffer;
    const observer = {
      begin() {
        throw new Error("begin");
      },
      mark() {
        throw new Error("mark");
      },
    };
    const writing = backend.appendRecordingChunks(
      "session.idb",
      [{ sequence: 0, tick: 0, bytes }],
      observer,
    );
    // Install the rejection handler before manually releasing the read events.
    const result = corrupt ? assert.rejects(writing, { code: "BLOB_CHUNK_IDENTITY" }) : writing;
    await untilCreated(fake);
    assert.equal(fake.created(), true);
    for (const read of fake.reads) read.onsuccess!();
    if (!corrupt) fake.transaction.oncomplete!();
    await result;
    assert.equal(fake.writes.length, corrupt ? 0 : 3);
  }
});

test("invalid or absent clocks leave real storage times null without changing accepted/persisted counts", async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "performance")!;
  for (const value of [undefined, { now: () => NaN }, { now: () => -1 }]) {
    Object.defineProperty(globalThis, "performance", { configurable: true, value });
    t.after(() => Object.defineProperty(globalThis, "performance", descriptor));
    const store = new BlobStore({ indexedDB: null });
    try {
      const recorder = new ExperimentRecorder(options());
      const session = store.createRecordingPersistence(recorder);
      recorder.appendFrame(frame(0));
      session.enqueue(recorder.getLastFrame()!);
      await session.flush();
      const row = session.getCommitDiagnostics!().storage.first[0]!;
      assert.equal(row.appendStartedAtMs, null);
      assert.equal(row.appendEndedAtMs, null);
      assert.equal(row.digestTotalMs, null);
      assert.equal(row.digestsCompletedAtMs, null);
      assert.equal(row.completed, true);
      assert.equal(session.getTelemetry().acceptedFrames, 1);
      assert.equal(session.getTelemetry().persistedFrames, 1);
    } finally {
      store.close();
      Object.defineProperty(globalThis, "performance", descriptor);
    }
  }
});

test("enqueue reuses recorder bytes and diagnostics never encode frames or session records", async (t) => {
  const store = new BlobStore({ indexedDB: null });
  try {
    const recorder = new ExperimentRecorder(options());
    const session = store.createRecordingPersistence(recorder);
    await session.waitUntilReady!();
    recorder.appendFrame(frame(0));
    const encode = TextEncoder.prototype.encode;
    let encodes = 0;
    t.mock.method(TextEncoder.prototype, "encode", function (this: TextEncoder, input) {
      encodes++;
      return encode.call(this, input);
    });
    session.enqueue(recorder.getLastFrame()!);
    assert.equal(encodes, 0);
    const bytes = session.getLastEnqueuedFrameBytes!();
    session.getCommitDiagnostics!();
    await session.flush();
    const result = session.getCommitDiagnostics!();
    assert.equal(encodes, 0);
    assert.equal(result.storage.first[0]?.batchEncodedBytes, bytes);
    assert.equal(result.storage.first[0]?.descriptorCountBefore, 0);
  } finally {
    store.close();
  }
});
