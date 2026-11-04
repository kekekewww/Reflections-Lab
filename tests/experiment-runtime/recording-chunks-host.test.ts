import assert from "node:assert/strict";
import test from "node:test";
import { RecordingHost } from "../../src/app/recording-host.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { options, frame } from "./worker-fixture.js";

test("host does not replace its valid artifact until persistence publishes the complete next take", async () => {
  const store = new BlobStore({ indexedDB: null });
  let rejectPublication = false;
  const host = new RecordingHost({
    getConfig: options,
    createPersistence: (recorder, callbacks) => {
      const session = store.createRecordingPersistence(recorder, callbacks);
      const publish = session.publish.bind(session);
      session.publish = async (artifact) => {
        if (rejectPublication)
          throw Object.assign(new Error("quota failure"), { code: "TEST_QUOTA" });
        return publish(artifact);
      };
      return session;
    },
  });
  host.start();
  host.appendFrame(frame(0));
  const baseline = await host.stop();
  assert.equal(host.getPersistenceTelemetry()!.publishedFrames, 1);
  rejectPublication = true;
  host.start();
  host.appendFrame(frame(0));
  await assert.rejects(host.stop(), { code: "TEST_QUOTA" });
  assert.equal(host.getArtifact()!.artifactSha256, baseline.artifactSha256);
  assert.equal(host.getPersistenceTelemetry()!.publishedFrames, 0);
  assert.deepEqual(await store.loadRecording(baseline.runId, baseline.artifactSha256), baseline);
});

test("an explicitly interrupted failed publication releases the host for another take", async () => {
  const store = new BlobStore({ indexedDB: null });
  let rejectPublication = true;
  const host = new RecordingHost({
    getConfig: options,
    createPersistence: (recorder, callbacks) => {
      const session = store.createRecordingPersistence(recorder, callbacks);
      const publish = session.publish.bind(session);
      session.publish = (artifact) =>
        rejectPublication
          ? Promise.reject(Object.assign(new Error("quota failure"), { code: "TEST_QUOTA" }))
          : publish(artifact);
      return session;
    },
  });
  host.start();
  host.appendFrame(frame(0));
  await assert.rejects(host.stop(), { code: "TEST_QUOTA" });
  assert.equal(await host.interrupt("RETRY"), null);
  rejectPublication = false;
  host.start();
  host.appendFrame(frame(0));
  const artifact = await host.stop();
  assert.equal(artifact.status, "captured");
  assert.deepEqual(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
});

test("accepted evaluation backlog waits for bounded storage ownership instead of interrupting slow writes", async () => {
  const store = new BlobStore({ indexedDB: null });
  const backend = store as unknown as { appendRecordingChunks(...args: unknown[]): Promise<void> };
  const append = backend.appendRecordingChunks.bind(store);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  backend.appendRecordingChunks = async (...args) => {
    await gate;
    return append(...args);
  };
  const host = new RecordingHost({
    getConfig: options,
    evaluateCapture: async () => [],
    createPersistence: (recorder, callbacks) =>
      store.createRecordingPersistence(recorder, callbacks, { maxFrames: 2 }),
    onEvaluationBackpressure: () => host.pause(),
  });
  host.start();
  for (let tick = 0; tick < 4; tick++) host.appendEvaluationFrame(frame(tick), []);
  for (
    let attempt = 0;
    attempt < 20 && host.getPersistenceTelemetry()!.pendingFrames < 2;
    attempt++
  )
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(host.getEvaluationTelemetry()!.acceptedFrames, 4);
  assert.equal(host.getPersistenceTelemetry()!.persistedFrames, 0);
  assert.equal(host.getPersistenceTelemetry()!.publishedFrames, 0);
  assert.notEqual(host.getPersistenceTelemetry()!.state, "interrupted");
  const stopping = host.stop();
  release();
  const artifact = await stopping;
  assert.equal(artifact.status, "captured");
  assert.deepEqual(
    artifact.frames.map((value) => value.tick),
    [0, 1, 2, 3],
  );
  assert.equal(host.getPersistenceTelemetry()!.publishedFrames, 4);
});
