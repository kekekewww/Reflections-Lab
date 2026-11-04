import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { ExperimentRecorder, type RecordingSealSnapshot } from "../../src/experiments/recorder.js";
import { options, frame } from "./worker-fixture.js";

interface SessionRow {
  leaseExpiresAt: number;
  snapshot: RecordingSealSnapshot;
}
interface StorageBoundary {
  sessions: Map<string, SessionRow>;
  heartbeatRecordingSession(sessionId: string): Promise<void>;
  readRecordingChunk(...args: unknown[]): Promise<ArrayBuffer>;
}
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function setup(t: TestContext) {
  const store = new BlobStore({ indexedDB: null });
  t.after(() => store.close());
  const baselineRecorder = new ExperimentRecorder(options("run.published"));
  baselineRecorder.appendFrame(frame(0));
  const baseline = await baselineRecorder.finish();
  await store.saveRecording(baseline);
  const recorder = new ExperimentRecorder(options("run.staging"));
  const session = store.createRecordingPersistence(recorder);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await session.flush();
  const sessionId = session.getTelemetry().sessionId;
  const backend = store as unknown as StorageBoundary;
  const expire = () => {
    backend.sessions.get(sessionId)!.leaseExpiresAt = Date.now() - 1;
  };
  return { store, recorder, session, sessionId, backend, baseline, expire };
}
async function unchangedValidArtifact(context: Awaited<ReturnType<typeof setup>>) {
  assert.deepEqual(
    await context.store.loadRecording(context.baseline.runId, context.baseline.artifactSha256),
    context.baseline,
  );
}
function gateChunkRead(context: Awaited<ReturnType<typeof setup>>) {
  const entered = deferred(),
    gate = deferred();
  const read = context.backend.readRecordingChunk.bind(context.store);
  let first = true;
  context.backend.readRecordingChunk = async (...args) => {
    if (first) {
      first = false;
      entered.release();
      await gate.promise;
    }
    return read(...args);
  };
  return { entered: entered.promise, release: gate.release };
}

test("a stale expired list entry cannot authorize recovery after the writer heartbeats", async (t) => {
  const context = await setup(t);
  context.expire();
  const [listed] = await context.store.listRecordingRecovery();
  assert.ok(listed!.leaseExpiresAt < Date.now());
  await context.backend.heartbeatRecordingSession(context.sessionId);
  const before = await context.store.listRecordingRecovery();
  await assert.rejects(context.store.recoverRecording(listed!.sessionId), {
    code: "BLOB_STAGING_ACTIVE",
  });
  assert.deepEqual(await context.store.listRecordingRecovery(), before);
  context.recorder.appendFrame(frame(1));
  context.session.enqueue(context.recorder.getLastFrame()!);
  await context.session.flush();
  assert.equal(context.session.getTelemetry().persistedFrames, 2);
  await unchangedValidArtifact(context);
});

test("writer renewal committed while recovery reads chunks is checked again before return", async (t) => {
  const context = await setup(t);
  context.expire();
  const gate = gateChunkRead(context);
  const recovering = context.store.recoverRecording(context.sessionId);
  await gate.entered;
  await context.backend.heartbeatRecordingSession(context.sessionId);
  const before = await context.store.listRecordingRecovery();
  gate.release();
  await assert.rejects(recovering, { code: "BLOB_STAGING_ACTIVE" });
  assert.deepEqual(await context.store.listRecordingRecovery(), before);
  await unchangedValidArtifact(context);
});

test("renewal after real sealing and hashing still precedes the final recovery authority guard", async (t) => {
  const context = await setup(t);
  context.expire();
  const entered = deferred(),
    gate = deferred();
  const finish = ExperimentRecorder.prototype.finish;
  t.mock.method(
    ExperimentRecorder.prototype,
    "finish",
    async function (this: ExperimentRecorder, ...args: Parameters<typeof finish>) {
      const artifact = await finish.apply(this, args);
      entered.release();
      await gate.promise;
      return artifact;
    },
  );
  const recovering = context.store.recoverRecording(context.sessionId);
  await entered.promise;
  await context.backend.heartbeatRecordingSession(context.sessionId);
  const before = await context.store.listRecordingRecovery();
  gate.release();
  await assert.rejects(recovering, { code: "BLOB_STAGING_ACTIVE" });
  assert.deepEqual(await context.store.listRecordingRecovery(), before);
  await unchangedValidArtifact(context);
});

test("a changed persisted prefix cannot be returned even if its renewed lease expires again", async (t) => {
  const context = await setup(t);
  context.expire();
  const gate = gateChunkRead(context);
  const recovering = context.store.recoverRecording(context.sessionId);
  await gate.entered;
  context.recorder.appendFrame(frame(1));
  context.session.enqueue(context.recorder.getLastFrame()!);
  await context.session.flush();
  context.expire();
  const before = await context.store.listRecordingRecovery();
  gate.release();
  await assert.rejects(recovering, { code: "BLOB_STAGING_CHANGED" });
  assert.deepEqual(await context.store.listRecordingRecovery(), before);
  assert.equal(context.session.getTelemetry().persistedFrames, 2);
  await unchangedValidArtifact(context);
});

test("the final authority guard includes the immutable capture snapshot pins", async (t) => {
  const context = await setup(t);
  context.expire();
  const gate = gateChunkRead(context);
  const recovering = context.store.recoverRecording(context.sessionId);
  await gate.entered;
  context.backend.sessions.get(context.sessionId)!.snapshot.configuration.atmosphere = {
    medium: "air",
    speedOfSoundMps: 330,
  };
  const before = structuredClone(context.backend.sessions.get(context.sessionId));
  gate.release();
  await assert.rejects(recovering, { code: "BLOB_STAGING_CHANGED" });
  assert.deepEqual(context.backend.sessions.get(context.sessionId), before);
  await unchangedValidArtifact(context);
});

test("an unchanged expired session recovers read-only and its original writer can still continue", async (t) => {
  const context = await setup(t);
  context.expire();
  const before = await context.store.listRecordingRecovery();
  const artifact = await context.store.recoverRecording(context.sessionId);
  assert.equal(artifact.status, "interrupted");
  assert.deepEqual(
    artifact.frames.map((value) => value.tick),
    [0],
  );
  assert.deepEqual(await context.store.listRecordingRecovery(), before);
  context.recorder.appendFrame(frame(1));
  context.session.enqueue(context.recorder.getLastFrame()!);
  await context.session.flush();
  assert.equal(context.session.getTelemetry().persistedFrames, 2);
  await unchangedValidArtifact(context);
});

test("an explicitly interrupted session remains recoverable without changing its stored prefix", async (t) => {
  const context = await setup(t);
  await context.session.cancel("USER_CANCELLED");
  const before = await context.store.listRecordingRecovery();
  const artifact = await context.store.recoverRecording(context.sessionId);
  assert.equal(artifact.status, "interrupted");
  assert.deepEqual(
    artifact.frames.map((value) => value.tick),
    [0],
  );
  assert.deepEqual(await context.store.listRecordingRecovery(), before);
  await unchangedValidArtifact(context);
});
