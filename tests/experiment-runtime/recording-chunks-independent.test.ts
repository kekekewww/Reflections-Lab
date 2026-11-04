import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { canonicalStringify } from "../../src/experiments/hash.js";
import { ExperimentRecorder, type RecordingSealSnapshot } from "../../src/experiments/recorder.js";
import {
  RecordingPersistenceSession,
  type EncodedRecordingFrame,
  type RecordingPersistenceBackend,
  type RecordingPersistenceBudget,
} from "../../src/experiments/recording-persistence.js";
import type { RecordingArtifact, RecordingFrame } from "../../src/experiments/types.js";
import type { StoredRecordingReceipt } from "../../src/persistence/blob-store.js";
import { options, frame } from "./worker-fixture.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}

type AppendTransaction = {
  frames: EncodedRecordingFrame[];
  completion: ReturnType<typeof deferred<void>>;
};
type PublicationTransaction = {
  signal: AbortSignal;
  completion: ReturnType<typeof deferred<void>>;
};

/** The external durable-store boundary: request entry never implies transaction completion. */
class GatedStorage implements RecordingPersistenceBackend {
  readonly appendEntered = deferred<AppendTransaction>();
  readonly publicationEntered = deferred<PublicationTransaction>();
  readonly appendTransactions: AppendTransaction[] = [];
  private readonly appendArrivals = new Map<
    number,
    ReturnType<typeof deferred<AppendTransaction>>
  >();
  readonly committedFrames: EncodedRecordingFrame[] = [];
  readonly interruptions: string[] = [];
  published: StoredRecordingReceipt | null = null;

  async create(_sessionId: string, _snapshot: RecordingSealSnapshot): Promise<void> {}

  async append(_sessionId: string, frames: readonly EncodedRecordingFrame[]): Promise<void> {
    const transaction = {
      frames: frames.map((entry) => ({ ...entry, bytes: entry.bytes.slice(0) })),
      completion: deferred<void>(),
    };
    const index = this.appendTransactions.length;
    this.appendTransactions.push(transaction);
    this.appendArrivals.get(index)?.resolve(transaction);
    this.appendEntered.resolve(transaction);
    await transaction.completion.promise;
    // A fulfilled append is the actual durable acknowledgement, including a completion/cancel race.
    this.committedFrames.push(...transaction.frames);
  }

  waitForAppend(index: number): Promise<AppendTransaction> {
    const existing = this.appendTransactions[index];
    if (existing) return Promise.resolve(existing);
    let arrival = this.appendArrivals.get(index);
    if (!arrival) {
      arrival = deferred<AppendTransaction>();
      this.appendArrivals.set(index, arrival);
    }
    return arrival.promise;
  }

  async publish(
    _sessionId: string,
    artifact: RecordingArtifact,
    signal: AbortSignal,
  ): Promise<StoredRecordingReceipt> {
    const transaction = { signal, completion: deferred<void>() };
    this.publicationEntered.resolve(transaction);
    await transaction.completion.promise;
    if (signal.aborted)
      throw Object.assign(new Error("Publication transaction aborted"), { code: "BOUNDARY_ABORT" });
    const bytes = Buffer.from(canonicalStringify(artifact), "utf8");
    this.published = {
      runId: artifact.runId,
      sha256: artifact.artifactSha256,
      hashKind: "canonicalRecordingArtifactSha256",
      encodedSha256: createHash("sha256").update(bytes).digest("hex"),
      encodedHashKind: "utf8JsonBytesSha256",
      byteLength: bytes.byteLength,
    };
    return { ...this.published };
  }

  async interrupt(_sessionId: string, reason: string): Promise<void> {
    this.interruptions.push(reason);
  }
}

function capture(budget: Partial<RecordingPersistenceBudget> = {}) {
  const recorder = new ExperimentRecorder(options("run.independent-storage"));
  const backend = new GatedStorage();
  const session = new RecordingPersistenceSession(
    "session.independent-storage",
    recorder.captureSealSnapshot(),
    backend,
    {},
    budget,
  );
  const next = (tick: number): RecordingFrame => {
    recorder.appendFrame(frame(tick));
    return structuredClone(recorder.getLastFrame()!);
  };
  return { recorder, backend, session, next };
}

// Regressions caught: treating an entered/request-success transaction as durable or published.
test("persisted watermark and flush wait for the append transaction acknowledgement", async () => {
  const { backend, session, next } = capture();
  session.enqueue(next(0));
  const transaction = await backend.appendEntered.promise;
  let flushed = false;
  const flush = session.flush().then(() => {
    flushed = true;
  });
  await Promise.resolve();
  assert.equal(flushed, false);
  assert.equal(backend.committedFrames.length, 0);
  assert.equal(session.getTelemetry().acceptedFrames, 1);
  assert.equal(session.getTelemetry().processedFrames, 1);
  assert.equal(session.getTelemetry().persistedFrames, 0);
  assert.equal(session.getTelemetry().persistedTick, null);
  transaction.completion.resolve();
  await flush;
  assert.equal(flushed, true);
  assert.deepEqual(
    backend.committedFrames.map((entry) => entry.tick),
    [0],
  );
  assert.equal(session.getTelemetry().persistedFrames, 1);
  assert.equal(session.getTelemetry().persistedTick, 0);
  assert.equal(session.getTelemetry().publishedFrames, 0);
});

test("published watermark waits for the separately acknowledged manifest transaction", async () => {
  const { recorder, backend, session, next } = capture();
  session.enqueue(next(0));
  const append = await backend.appendEntered.promise;
  append.completion.resolve();
  await session.drain();
  const artifact = await recorder.finish();
  const publication = session.publish(artifact);
  const transaction = await backend.publicationEntered.promise;
  assert.equal(session.publish(artifact), publication, "duplicate stop shares one publication");
  assert.equal(backend.published, null);
  assert.equal(session.getTelemetry().persistedFrames, 1);
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.equal(session.getTelemetry().publishedTick, null);
  transaction.completion.resolve();
  const receipt = await publication;
  assert.equal(receipt.sha256, artifact.artifactSha256);
  assert.deepEqual(receipt, backend.published);
  assert.equal(session.getTelemetry().state, "published");
  assert.equal(session.getTelemetry().publishedFrames, 1);
  assert.equal(session.getTelemetry().publishedTick, 0);
});

// Regressions caught: dropping the in-flight entry from the capacity/byte ledger too early.
test("frame capacity still owns the blocked in-flight append and never overwrites its bytes", async () => {
  const { backend, session, next } = capture({ maxFrames: 2, lowWaterFrames: 0 });
  session.enqueue(next(0));
  const transaction = await backend.appendEntered.promise;
  const firstBytes = transaction.frames[0]!.bytes.slice(0);
  session.enqueue(next(1));
  assert.equal(session.getTelemetry().pendingFrames, 2);
  assert.equal(session.getTelemetry().backpressured, true);
  assert.throws(() => session.enqueue(next(2)), { code: "RECORDING_STORAGE_BACKPRESSURE" });
  assert.equal(session.getTelemetry().acceptedFrames, 2);
  assert.equal(session.getTelemetry().peakPendingFrames, 2);
  assert.equal(backend.appendTransactions.length, 1);
  assert.deepEqual(transaction.frames[0]!.bytes, firstBytes);
  const cancellation = session.cancel("TEST_CLEANUP");
  transaction.completion.resolve();
  await cancellation;
  assert.deepEqual(
    backend.committedFrames.map((entry) => entry.tick),
    [0],
  );
  assert.equal(session.getTelemetry().pendingFrames, 0);
  assert.equal(session.getTelemetry().reservedBytes, 0);
});

test("encoded-byte capacity includes the blocked append until its transaction completes", async () => {
  const producer = new ExperimentRecorder(options("run.independent-storage"));
  producer.appendFrame(frame(0));
  const first = structuredClone(producer.getLastFrame()!);
  const bytes = Buffer.byteLength(canonicalStringify(first), "utf8");
  const { backend, session, next } = capture({ maxBytes: bytes, lowWaterBytes: 0 });
  session.enqueue(first);
  const transaction = await backend.appendEntered.promise;
  assert.equal(session.getTelemetry().reservedBytes, bytes);
  assert.throws(() => session.enqueue(next(1)), { code: "RECORDING_STORAGE_BACKPRESSURE" });
  assert.equal(session.getTelemetry().acceptedFrames, 1);
  assert.equal(session.getTelemetry().peakReservedBytes, bytes);
  const cancellation = session.cancel("TEST_CLEANUP");
  transaction.completion.resolve();
  await cancellation;
  assert.equal(session.getTelemetry().persistedFrames, 1);
  assert.equal(session.getTelemetry().reservedBytes, 0);
});

test("cancel during append retains only the transaction-complete prefix and never publishes", async () => {
  const { recorder, backend, session, next } = capture();
  session.enqueue(next(4));
  const transaction = await backend.appendEntered.promise;
  session.enqueue(next(5));
  const cancellation = session.cancel("USER_CANCELLED");
  assert.equal(session.getTelemetry().state, "interrupted");
  assert.equal(session.getTelemetry().persistedFrames, 0);
  transaction.completion.resolve();
  await cancellation;
  assert.equal(
    backend.appendTransactions.length,
    1,
    "queued suffix cannot start after cancellation",
  );
  assert.deepEqual(
    backend.committedFrames.map((entry) => entry.tick),
    [4],
  );
  assert.equal(session.getTelemetry().acceptedFrames, 2);
  assert.equal(session.getTelemetry().persistedFrames, 1);
  assert.equal(session.getTelemetry().persistedTick, 4);
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.equal(backend.published, null);
  await assert.rejects(session.publish(await recorder.finish()), {
    code: "RECORDING_STORAGE_CANCELLED",
  });
});

test("an aborted append cannot advance persisted even though the storage request was entered", async () => {
  const { backend, session, next } = capture();
  session.enqueue(next(0));
  const transaction = await backend.appendEntered.promise;
  const failure = Object.assign(new Error("Quota transaction aborted"), {
    code: "TEST_QUOTA_ABORT",
  });
  const rejectedFlush = assert.rejects(session.flush(), (reason) => reason === failure);
  transaction.completion.reject(failure);
  await rejectedFlush;
  assert.equal(session.getTelemetry().state, "interrupted");
  assert.equal(session.getTelemetry().persistedFrames, 0);
  assert.equal(session.getTelemetry().persistedTick, null);
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.equal(backend.committedFrames.length, 0);
  await session.cancel("TEST_CLEANUP");
});

test("duplicate, gap, epoch and revision tampering cannot extend an admitted tick prefix", async () => {
  const changes: { name: string; change(value: RecordingFrame): void }[] = [
    {
      name: "duplicate",
      change: (value) => {
        value.tick = 0;
      },
    },
    {
      name: "gap",
      change: (value) => {
        value.tick = 2;
      },
    },
    {
      name: "epoch",
      change: (value) => {
        value.runEpoch = "epoch.other";
      },
    },
    {
      name: "revision",
      change: (value) => {
        value.sceneRevision++;
      },
    },
  ];
  for (const { name, change } of changes) {
    const { backend, session, next } = capture();
    session.enqueue(next(0));
    const transaction = await backend.appendEntered.promise;
    const invalid = next(1);
    change(invalid);
    assert.throws(() => session.enqueue(invalid), { code: "RECORDING_STORAGE_IDENTITY" }, name);
    assert.equal(session.getTelemetry().acceptedFrames, 1, name);
    assert.equal(session.getTelemetry().acceptedTick, 0, name);
    const cancellation = session.cancel("TEST_CLEANUP");
    transaction.completion.resolve();
    await cancellation;
    assert.deepEqual(
      backend.committedFrames.map((entry) => entry.tick),
      [0],
      name,
    );
    assert.equal(session.getTelemetry().publishedFrames, 0, name);
  }
});

test("non-JSON accessor tampering is rejected without reserving or writing a frame", async () => {
  const { backend, session, next } = capture();
  const invalid = next(0);
  Object.defineProperty(invalid, "poses", { enumerable: true, get: () => [] });
  assert.throws(() => session.enqueue(invalid), { code: "NON_JSON" });
  assert.equal(session.getTelemetry().acceptedFrames, 0);
  assert.equal(session.getTelemetry().reservedBytes, 0);
  assert.equal(backend.appendTransactions.length, 0);
  await session.cancel("TEST_CLEANUP");
});

test("post-admission caller mutation cannot change the bytes owned by a pending append", async () => {
  const { backend, session, next } = capture();
  const input = next(0);
  const expected = canonicalStringify(input);
  session.enqueue(input);
  input.poses[0]!.positionM = [999, 1, 0];
  input.listener.positionM = [999, 1, 3];
  const transaction = await backend.appendEntered.promise;
  assert.equal(new TextDecoder().decode(transaction.frames[0]!.bytes), expected);
  transaction.completion.resolve();
  await session.drain();
  assert.equal(new TextDecoder().decode(backend.committedFrames[0]!.bytes), expected);
});

test("cancel during the final transaction propagates its signal and leaves publication absent", async () => {
  const { recorder, backend, session, next } = capture();
  session.enqueue(next(0));
  const append = await backend.appendEntered.promise;
  append.completion.resolve();
  await session.drain();
  const publication = session.publish(await recorder.finish());
  const transaction = await backend.publicationEntered.promise;
  const rejectedPublication = assert.rejects(publication, { code: "BOUNDARY_ABORT" });
  const cancellation = session.cancel("USER_CANCELLED");
  assert.equal(transaction.signal.aborted, true);
  transaction.completion.resolve();
  await Promise.all([rejectedPublication, cancellation]);
  assert.equal(backend.published, null);
  assert.equal(session.getTelemetry().persistedFrames, 1);
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.equal(session.getTelemetry().state, "interrupted");
});

// Regression caught: background evaluation bypassing storage acknowledgement when its FIFO is full.
test("capacity wait keeps the next evaluated frame pending until storage releases its owned slot", async () => {
  const { backend, session, next } = capture({ maxFrames: 1, lowWaterFrames: 0 });
  session.enqueue(next(0));
  const first = await backend.appendEntered.promise;
  const secondFrame = next(1);
  let capacityReady = false;
  const capacity = session.waitForCapacity(secondFrame).then(() => {
    capacityReady = true;
  });
  await Promise.resolve();
  assert.equal(capacityReady, false);
  assert.equal(session.getTelemetry().acceptedFrames, 1);
  assert.equal(session.getTelemetry().pendingFrames, 1);
  first.completion.resolve();
  await capacity;
  assert.equal(capacityReady, true);
  session.enqueue(secondFrame);
  const second = await backend.waitForAppend(1);
  assert.deepEqual(
    second.frames.map((entry) => entry.tick),
    [1],
  );
  assert.equal(session.getTelemetry().peakPendingFrames, 1);
  second.completion.resolve();
  await session.drain();
  assert.deepEqual(
    backend.committedFrames.map((entry) => entry.tick),
    [0, 1],
  );
  assert.equal(session.getTelemetry().acceptedFrames, 2);
  assert.equal(session.getTelemetry().persistedFrames, 2);
});
