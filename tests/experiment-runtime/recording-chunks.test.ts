import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { canonicalStringify } from "../../src/experiments/hash.js";
import { options, frame } from "./worker-fixture.js";

// Breaks caught: early publication, lost/reordered ticks, changed canonical bytes, and unsafe cleanup.
test("capture chunks persist before stop but stay invisible until atomic publication", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  for (let tick = 0; tick < 3; tick++) {
    recorder.appendFrame(frame(tick));
    session.enqueue(recorder.getLastFrame()!);
  }
  await session.drain();
  const staged = session.getTelemetry();
  assert.equal(staged.acceptedFrames, 3);
  assert.equal(staged.processedFrames, 3);
  assert.equal(staged.persistedFrames, 3);
  assert.equal(staged.publishedFrames, 0);
  const artifact = await recorder.finish();
  assert.equal(await store.loadRecording(artifact.runId, artifact.artifactSha256), null);
  const receipt = await session.publish(artifact);
  const expectedBytes = Buffer.from(canonicalStringify(artifact), "utf8");
  assert.equal(receipt.encodedSha256, createHash("sha256").update(expectedBytes).digest("hex"));
  assert.equal(receipt.byteLength, expectedBytes.byteLength);
  assert.notEqual(receipt.encodedSha256, artifact.artifactSha256);
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
  assert.equal(session.getTelemetry().publishedFrames, 3);
  assert.deepEqual(await store.listRecordingRecovery(), []);
});

test("bounded chunk admission interrupts without replacing the prior published recording", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder, {}, { maxFrames: 1 });
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  recorder.appendFrame(frame(1));
  assert.throws(() => session.enqueue(recorder.getLastFrame()!), {
    code: "RECORDING_STORAGE_BACKPRESSURE",
  });
  await assert.rejects(session.drain());
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.equal(session.getTelemetry().acceptedFrames, 1);
});

test("cancel retains an identifiable incomplete prefix and cleanup cannot delete published chunks", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(7));
  session.enqueue(recorder.getLastFrame()!);
  await session.drain();
  await session.cancel("USER_CANCELLED");
  const [recovery] = await store.listRecordingRecovery();
  assert.equal(recovery!.persistedFrames, 1);
  assert.equal(recovery!.persistedTick, 7);
  assert.equal(recovery!.state, "interrupted");
  const recovered = await store.recoverRecording(recovery!.sessionId);
  assert.equal(recovered.status, "interrupted");
  assert.deepEqual(
    recovered.frames.map((value) => value.tick),
    [7],
  );
  await store.discardRecordingRecovery(recovery!.sessionId);
  assert.deepEqual(await store.listRecordingRecovery(), []);
  assert.equal(await store.loadRecording(recovered.runId, recovered.artifactSha256), null);
});

test("quota failure leaves the previous artifact valid and never publishes a partial manifest", async () => {
  const baselineRecorder = new ExperimentRecorder(options());
  baselineRecorder.appendFrame(frame(0));
  const baseline = await baselineRecorder.finish();
  const store = new BlobStore({
    indexedDB: null,
    limits: { maxTotalBytes: Buffer.byteLength(canonicalStringify(baseline)) + 32 },
  });
  await store.saveRecording(baseline);
  const next = new ExperimentRecorder({ ...options(), runId: "run.next" });
  const session = store.createRecordingPersistence(next);
  next.appendFrame(frame(0));
  session.enqueue(next.getLastFrame()!);
  await assert.rejects(session.drain(), { code: "BLOB_BUDGET" });
  assert.equal(session.getTelemetry().persistedFrames, 0);
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.deepEqual(await store.loadRecording(baseline.runId, baseline.artifactSha256), baseline);
});

test("publication independently verifies all frame bytes and canonical fingerprints", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await session.drain();
  const artifact = await recorder.finish();
  const corrupt = structuredClone(artifact);
  corrupt.frames[0]!.tick = 2;
  await assert.rejects(session.publish(corrupt), { code: "ARTIFACT_HASH" });
  assert.equal(session.getTelemetry().publishedFrames, 0);
  assert.equal(await store.loadRecording(artifact.runId, artifact.artifactSha256), null);
  await session.publish(artifact);
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
});

test("published recording ownership is released by the store rather than retaining every capture session", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  const artifact = await recorder.finish();
  await session.publish(artifact);
  // Closing the store must not cancel an already-published session or replace its final watermark.
  store.close();
  assert.equal(session.getTelemetry().state, "published");
  await assert.rejects(store.discardRecordingRecovery(session.getTelemetry().sessionId), {
    code: "BLOB_CLOSED",
  });
});

test("sealing cannot replace capture configuration with a different self-consistent artifact", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await session.drain();
  const changed = options();
  changed.atmosphere = { medium: "air", speedOfSoundMps: 330 };
  const replacement = new ExperimentRecorder(changed);
  replacement.appendFrame(frame(0));
  const changedArtifact = await replacement.finish();
  await assert.rejects(session.publish(changedArtifact), { code: "BLOB_STAGING" });
  const artifact = await recorder.finish();
  await session.publish(artifact);
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
});

test("public save owns the artifact before the caller can mutate it across an await", async () => {
  const first = new ExperimentRecorder(options("run.original"));
  first.appendFrame(frame(0));
  const original = await first.finish();
  const second = new ExperimentRecorder(options("run.replacement"));
  second.appendFrame(frame(0));
  const replacement = await second.finish();
  const input = structuredClone(original);
  const store = new BlobStore({ indexedDB: null });
  const saving = store.saveRecording(input);
  Object.assign(input, replacement);
  const receipt = await saving;
  assert.equal(receipt.runId, original.runId);
  assert.equal(receipt.sha256, original.artifactSha256);
  assert.deepEqual(await store.loadRecording(original.runId, original.artifactSha256), original);
  assert.equal(await store.loadRecording(replacement.runId, replacement.artifactSha256), null);
});

test("an active capture reservation prevents another save from stealing its recording entry", async () => {
  const store = new BlobStore({ indexedDB: null, limits: { maxRecordings: 1 } });
  const recorder = new ExperimentRecorder(options("run.reserved"));
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await session.flush();
  const other = new ExperimentRecorder(options("run.other"));
  other.appendFrame(frame(0));
  await assert.rejects(store.saveRecording(await other.finish()), { code: "BLOB_BUDGET" });
  const artifact = await recorder.finish();
  await session.publish(artifact);
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
});

test("a verified same-reference save repairs missing published chunks instead of falsely succeeding", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  const artifact = await recorder.finish();
  await session.publish(artifact);
  // A missing persisted chunk models damaged local bytes at the storage boundary.
  const disk = store as unknown as { chunks: Map<string, unknown> };
  disk.chunks.delete(`${session.getTelemetry().sessionId}:0`);
  await assert.rejects(store.loadRecording(artifact.runId, artifact.artifactSha256), {
    code: "BLOB_INTEGRITY",
  });
  const receipt = await store.saveRecording(artifact);
  assert.equal(receipt.sha256, artifact.artifactSha256);
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
});

test("a healthy same-reference save retains the published chunk layout used by crash recovery", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  const artifact = await recorder.finish();
  await session.publish(artifact);
  await store.saveRecording(artifact);
  const disk = store as unknown as { chunks: Map<string, unknown> };
  assert.equal(
    disk.chunks.size,
    1,
    "normal persist must not silently rewrite the new layout to monolithic bytes",
  );
  disk.chunks.delete(`${session.getTelemetry().sessionId}:0`);
  await assert.rejects(store.loadRecording(artifact.runId, artifact.artifactSha256), {
    code: "BLOB_INTEGRITY",
  });
});

test("publication owns a mutable artifact at invocation before waiting for pending storage", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await session.flush();
  const artifact = await recorder.finish();
  const interruptedRecorder = new ExperimentRecorder(options());
  interruptedRecorder.appendFrame(frame(0));
  interruptedRecorder.interrupt("REPLACED_AFTER_CALL");
  const interrupted = await interruptedRecorder.finish();
  const input = structuredClone(artifact);
  const publishing = session.publish(input);
  Object.assign(input, interrupted);
  const receipt = await publishing;
  assert.equal(receipt.sha256, artifact.artifactSha256);
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
  assert.equal(await store.loadRecording(interrupted.runId, interrupted.artifactSha256), null);
});

test("duplicate session publication cannot retire chunks owned by an already-started immutable reader", async () => {
  const store = new BlobStore({ indexedDB: null });
  const first = new ExperimentRecorder(options());
  const firstSession = store.createRecordingPersistence(first);
  first.appendFrame(frame(0));
  firstSession.enqueue(first.getLastFrame()!);
  const artifact = await first.finish();
  await firstSession.publish(artifact);
  const second = new ExperimentRecorder(options());
  const secondSession = store.createRecordingPersistence(second);
  second.appendFrame(frame(0));
  secondSession.enqueue(second.getLastFrame()!);
  await secondSession.flush();
  const backend = store as unknown as {
    readRecordingChunk(...args: unknown[]): Promise<ArrayBuffer>;
  };
  const read = backend.readRecordingChunk.bind(store);
  let release!: () => void;
  let readerStarted!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    readerStarted = resolve;
  });
  let firstRead = true;
  backend.readRecordingChunk = async (...args) => {
    if (firstRead) {
      firstRead = false;
      readerStarted();
      await gate;
    }
    return read(...args);
  };
  const loading = store.loadRecording(artifact.runId, artifact.artifactSha256);
  await started;
  try {
    await secondSession.publish(await second.finish());
    release();
    assert.deepEqual(await loading, artifact);
    assert.deepEqual(await store.listRecordingRecovery(), []);
  } finally {
    release();
    backend.readRecordingChunk = read;
  }
});

test("two first-time publishers racing at commit cannot retire the winning immutable reader generation", async () => {
  const store = new BlobStore({ indexedDB: null });
  async function capture() {
    const recorder = new ExperimentRecorder(options());
    const session = store.createRecordingPersistence(recorder);
    recorder.appendFrame(frame(0));
    session.enqueue(recorder.getLastFrame()!);
    await session.flush();
    return { session, artifact: await recorder.finish() };
  }
  const first = await capture();
  const second = await capture();
  const backend = store as unknown as {
    commit(...args: unknown[]): Promise<void>;
    readRecordingChunk(...args: unknown[]): Promise<ArrayBuffer>;
  };
  const commit = backend.commit.bind(store);
  const read = backend.readRecordingChunk.bind(store);
  let releaseFirst!: () => void,
    releaseSecond!: () => void,
    bothReady!: () => void,
    releaseReader!: () => void,
    readerReady!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  const both = new Promise<void>((resolve) => {
    bothReady = resolve;
  });
  const readGate = new Promise<void>((resolve) => {
    releaseReader = resolve;
  });
  const reading = new Promise<void>((resolve) => {
    readerReady = resolve;
  });
  let commits = 0;
  backend.commit = async (...args) => {
    if ((args[0] as { kind: string }).kind === "recording") {
      const sequence = ++commits;
      if (sequence === 2) bothReady();
      await (sequence === 1 ? firstGate : secondGate);
    }
    return commit(...args);
  };
  const firstPublication = first.session.publish(first.artifact);
  const secondPublication = second.session.publish(second.artifact);
  void secondPublication.catch(() => {});
  await both;
  try {
    releaseFirst();
    await firstPublication;
    let firstRead = true;
    backend.readRecordingChunk = async (...args) => {
      if (firstRead) {
        firstRead = false;
        readerReady();
        await readGate;
      }
      return read(...args);
    };
    const loading = store.loadRecording(first.artifact.runId, first.artifact.artifactSha256);
    await reading;
    releaseSecond();
    await secondPublication;
    releaseReader();
    assert.deepEqual(await loading, first.artifact);
    assert.equal(commits, 2);
    assert.deepEqual(await store.listRecordingRecovery(), []);
  } finally {
    releaseFirst();
    releaseSecond();
    releaseReader();
    backend.commit = commit;
    backend.readRecordingChunk = read;
  }
});

test("cancel during same-reference reuse cannot report that interrupted session as published", async () => {
  const store = new BlobStore({ indexedDB: null });
  const first = new ExperimentRecorder(options());
  const firstSession = store.createRecordingPersistence(first);
  first.appendFrame(frame(0));
  firstSession.enqueue(first.getLastFrame()!);
  const artifact = await first.finish();
  await firstSession.publish(artifact);
  const second = new ExperimentRecorder(options());
  const secondSession = store.createRecordingPersistence(second);
  second.appendFrame(frame(0));
  secondSession.enqueue(second.getLastFrame()!);
  await secondSession.flush();
  const backend = store as unknown as {
    verifyChunkedRecording(...args: unknown[]): Promise<unknown>;
  };
  const verify = backend.verifyChunkedRecording.bind(store);
  let release!: () => void, ready!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  backend.verifyChunkedRecording = async (...args) => {
    ready();
    await gate;
    return verify(...args);
  };
  const publishing = secondSession.publish(await second.finish());
  await entered;
  const cancelling = secondSession.cancel("CANCEL_DURING_REUSE");
  release();
  try {
    await assert.rejects(publishing, { code: "BLOB_CANCELLED" });
    await cancelling;
    assert.equal(secondSession.getTelemetry().publishedFrames, 0);
    assert.equal(secondSession.getTelemetry().state, "interrupted");
  } finally {
    release();
    backend.verifyChunkedRecording = verify;
  }
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
});

test("failed staging creation releases the store's strong capture ownership for retry", async () => {
  const store = new BlobStore({ indexedDB: null, limits: { maxTotalBytes: 1 } });
  const session = store.createRecordingPersistence(new ExperimentRecorder(options()));
  await assert.rejects(session.flush(), { code: "BLOB_BUDGET" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const ownership = store as unknown as { captureSessions: Set<unknown> };
  assert.equal(
    ownership.captureSessions.size,
    0,
    "failed attempts cannot accumulate whole capture configurations",
  );
});

test("same-reference reuse still verifies the accepted staging content rather than skipping its frames", async () => {
  const store = new BlobStore({ indexedDB: null });
  const first = new ExperimentRecorder(options());
  const firstSession = store.createRecordingPersistence(first);
  first.appendFrame(frame(0));
  firstSession.enqueue(first.getLastFrame()!);
  const artifact = await first.finish();
  await firstSession.publish(artifact);
  const second = new ExperimentRecorder(options());
  const secondSession = store.createRecordingPersistence(second);
  const different = frame(0);
  different.poses[0]!.positionM = [8, 1, 0];
  second.appendFrame(different);
  secondSession.enqueue(second.getLastFrame()!);
  await secondSession.flush();
  await assert.rejects(secondSession.publish(artifact), { code: "BLOB_INTEGRITY" });
  assert.equal(secondSession.getTelemetry().publishedFrames, 0);
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
  await secondSession.cancel("WRONG_SEAL_INPUT");
});

test("failure notification storage errors cannot retain the store's strong capture ownership", async () => {
  const store = new BlobStore({ indexedDB: null });
  const backend = store as unknown as {
    appendRecordingChunks(): Promise<void>;
    interruptRecordingSession(): Promise<void>;
  };
  backend.appendRecordingChunks = async () => {
    throw Object.assign(new Error("quota exhausted"), { code: "TEST_QUOTA" });
  };
  backend.interruptRecordingSession = async () => {
    throw Object.assign(new Error("storage unavailable"), { code: "TEST_STORAGE_UNAVAILABLE" });
  };
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await assert.rejects(session.flush(), { code: "TEST_QUOTA" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const ownership = store as unknown as { captureSessions: Set<unknown> };
  assert.equal(ownership.captureSessions.size, 0);
});

test("cancel while opening storage prevents a new write transaction from starting", async () => {
  const store = new BlobStore({ indexedDB: {} as IDBFactory });
  const backend = store as unknown as {
    open(): Promise<IDBDatabase>;
    commit(candidate: unknown, signal: AbortSignal): Promise<void>;
  };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let transactions = 0;
  backend.open = async () => {
    await gate;
    return {
      transaction() {
        transactions++;
        throw new Error("cancelled write must never start");
      },
    } as unknown as IDBDatabase;
  };
  const controller = new AbortController();
  const committing = backend.commit(
    { kind: "asset", assetId: "asset.cancel", sha256: "a".repeat(64), byteLength: 1 },
    controller.signal,
  );
  controller.abort("CANCEL_DURING_OPEN");
  release();
  await assert.rejects(committing, { code: "BLOB_CANCELLED" });
  assert.equal(transactions, 0);
});

test("a concurrent repair cannot cause reuse to return an older unverified encoded receipt", async () => {
  const store = new BlobStore({ indexedDB: null });
  const recorder = new ExperimentRecorder(options());
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  const artifact = await recorder.finish();
  const originalReceipt = await session.publish(artifact);
  const backend = store as unknown as {
    memory: Map<string, { byteLength: number }>;
    read(...args: unknown[]): Promise<unknown>;
  };
  const row = backend.memory.get(`recording:${artifact.runId}\u0000${artifact.artifactSha256}`)!;
  row.byteLength++;
  const read = backend.read.bind(store);
  let release!: () => void, ready!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let first = true;
  backend.read = async (...args) => {
    const snapshot = await read(...args);
    if (first) {
      first = false;
      ready();
      await gate;
    }
    return snapshot;
  };
  const saving = store.saveRecording(artifact);
  void saving.catch(() => {});
  await entered;
  try {
    await store.saveRecording(artifact);
    release();
    const receipt = await saving;
    assert.equal(receipt.encodedSha256, originalReceipt.encodedSha256);
    assert.equal(receipt.byteLength, originalReceipt.byteLength);
    assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
  } finally {
    release();
    backend.read = read;
  }
});
