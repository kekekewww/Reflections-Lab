import { RecordingHost } from "../../../src/app/recording-host.js";
import { BlobStore } from "../../../src/persistence/blob-store.js";
import { ExperimentRecorder } from "../../../src/experiments/recorder.js";
import { canonicalStringify } from "../../../src/experiments/hash.js";
import { options, frame } from "../../experiment-runtime/worker-fixture.js";

const equal = (actual: unknown, expected: unknown) => {
  if (canonicalStringify(actual) !== canonicalStringify(expected))
    throw new Error("independent expected value differs");
};
const truth = (value: unknown, reason: string) => {
  if (!value) throw new Error(reason);
};
async function refused(work: Promise<unknown>, code?: string) {
  try {
    await work;
  } catch (error) {
    if (code && (error as { code?: string }).code !== code) throw error;
    return;
  }
  throw new Error("expected rejection");
}
function open(name: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version ? indexedDB.open(name, version) : indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      for (const store of ["assets", "recordings"])
        request.result.createObjectStore(store, {
          keyPath: store === "assets" ? ["assetId", "sha256"] : ["runId", "sha256"],
        });
      request.result.createObjectStore("state");
    };
    request.onsuccess = () => resolve(request.result);
  });
}
async function captured(runId: string, ticks = 3) {
  const recorder = new ExperimentRecorder(options(runId));
  for (let tick = 0; tick < ticks; tick++) recorder.appendFrame(frame(tick));
  return recorder.finish();
}
async function legacy(name: string, artifact: Awaited<ReturnType<typeof captured>>) {
  const database = await open(name, 1);
  const bytes = new TextEncoder().encode(canonicalStringify(artifact)).buffer;
  const encodedSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(["recordings", "state"], "readwrite");
    transaction.objectStore("recordings").add({
      kind: "recording",
      runId: artifact.runId,
      sha256: artifact.artifactSha256,
      hashKind: "canonicalRecordingArtifactSha256",
      encodedSha256,
      encodedHashKind: "utf8JsonBytesSha256",
      byteLength: bytes.byteLength,
      bytes,
    });
    transaction
      .objectStore("state")
      .put({ totalBytes: bytes.byteLength, assetEntries: 0, recordings: 1 }, "budget");
    transaction
      .objectStore("state")
      .put({ sha256: artifact.artifactSha256, revision: 1 }, `recording:${artifact.runId}`);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}
async function recording(store: BlobStore, runId: string) {
  const recorder = new ExperimentRecorder(options(runId));
  const session = store.createRecordingPersistence(recorder);
  for (let tick = 0; tick < 9; tick++) {
    const input = frame(tick);
    input.behaviorSnapshot = { text: "繁體中文／聲音 🎵", tick };
    recorder.appendFrame(input);
    session.enqueue(recorder.getLastFrame()!);
    await session.flush();
  }
  return { recorder, session, artifact: await recorder.finish() };
}

(window as unknown as { runRecordingChunkSuite: () => Promise<unknown> }).runRecordingChunkSuite =
  async () => {
    const results: { name: string; status: string; details?: unknown }[] = [];
    const name = `reflection-chunks-${crypto.randomUUID()}`;
    const baseline = await captured("run.legacy");
    await legacy(name, baseline);
    const store = new BlobStore({ databaseName: name });
    equal(await store.loadRecording(baseline.runId, baseline.artifactSha256), baseline);
    results.push({
      name: "v1 legacy database migrates without rewriting or dropping immutable bytes",
      status: "PASS",
    });

    const first = await recording(store, "run.chunks");
    truth(
      first.session.getTelemetry().persistedFrames === 9 &&
        first.session.getTelemetry().publishedFrames === 0,
      "only committed staging watermark advances",
    );
    equal(await store.loadRecording(first.artifact.runId, first.artifact.artifactSha256), null);
    const receipt = await first.session.publish(first.artifact);
    equal(
      await store.loadRecording(first.artifact.runId, first.artifact.artifactSha256),
      first.artifact,
    );
    results.push({
      name: "real IndexedDB chunks remain unpublished until final manifest, exact Unicode roundtrip",
      status: "PASS",
      details: { receipt, watermarks: first.session.getTelemetry() },
    });

    // Abort after native request success: only transaction completion may advance persisted.
    const abortRecorder = new ExperimentRecorder(options("run.abort"));
    const abortSession = store.createRecordingPersistence(abortRecorder);
    const nativeAdd = IDBObjectStore.prototype.add;
    let aborts = 0;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore["add"]>) {
      const request = nativeAdd.apply(this, args);
      if (this.name === "recordingChunks")
        request.addEventListener(
          "success",
          () => {
            aborts++;
            this.transaction.abort();
          },
          { once: true },
        );
      return request;
    };
    try {
      abortRecorder.appendFrame(frame(0));
      abortSession.enqueue(abortRecorder.getLastFrame()!);
      await refused(abortSession.drain(), "BLOB_STORAGE_WRITE");
      truth(
        aborts === 1 &&
          abortSession.getTelemetry().persistedFrames === 0 &&
          abortSession.getTelemetry().publishedFrames === 0,
        "request success is not a transaction commit",
      );
    } finally {
      IDBObjectStore.prototype.add = nativeAdd;
    }
    equal(await store.loadRecording(baseline.runId, baseline.artifactSha256), baseline);
    results.push({
      name: "native transaction abort after chunk request success preserves prior published artifact",
      status: "PASS",
    });

    const backend = store as unknown as {
      appendRecordingChunks(...args: unknown[]): Promise<void>;
    };
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
      getConfig: () => options("run.slow-idb"),
      evaluateCapture: async () => [],
      createPersistence: (recorder, callbacks) =>
        store.createRecordingPersistence(recorder, callbacks, { maxFrames: 2 }),
      onEvaluationBackpressure: () => host.pause(),
    });
    try {
      host.start();
      for (let tick = 0; tick < 4; tick++) host.appendEvaluationFrame(frame(tick), []);
      for (
        let attempt = 0;
        attempt < 100 && host.getPersistenceTelemetry()!.pendingFrames < 2;
        attempt++
      )
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      truth(
        host.getPersistenceTelemetry()!.pendingFrames === 2 &&
          host.getEvaluationTelemetry()!.acceptedFrames === 4 &&
          host.getPersistenceTelemetry()!.persistedFrames === 0 &&
          host.getPersistenceTelemetry()!.state !== "interrupted",
        "slow real IDB keeps all accepted frames pending without interruption",
      );
      const stopping = host.stop();
      release();
      const artifact = await stopping;
      truth(
        artifact.status === "captured" &&
          artifact.frameCount === 4 &&
          host.getPersistenceTelemetry()!.publishedFrames === 4,
        "all slow IDB accepted ticks drain to publication",
      );
      equal(await store.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
      results.push({
        name: "slow actual IDB consumer retains evaluation backlog within unchanged independent caps",
        status: "PASS",
        details: host.getPersistenceTelemetry(),
      });
    } finally {
      release();
      backend.appendRecordingChunks = append;
      host.dispose();
    }

    // Two separate store instances must serialize simultaneous first publication with generation CAS.
    const peer = new BlobStore({ databaseName: name });
    const parallelA = await recording(store, "run.parallel");
    const parallelB = await recording(peer, "run.parallel");
    const left = store as unknown as {
      commit(...args: unknown[]): Promise<void>;
      readRecordingChunk(...args: unknown[]): Promise<ArrayBuffer>;
    };
    const right = peer as unknown as { commit(...args: unknown[]): Promise<void> };
    const leftCommit = left.commit.bind(store),
      rightCommit = right.commit.bind(peer),
      leftRead = left.readRecordingChunk.bind(store);
    let releaseLeft!: () => void,
      releaseRight!: () => void,
      bothReady!: () => void,
      readerReady!: () => void,
      releaseReader!: () => void;
    const leftGate = new Promise<void>((resolve) => {
      releaseLeft = resolve;
    });
    const rightGate = new Promise<void>((resolve) => {
      releaseRight = resolve;
    });
    const both = new Promise<void>((resolve) => {
      bothReady = resolve;
    });
    const readerEntered = new Promise<void>((resolve) => {
      readerReady = resolve;
    });
    const readerGate = new Promise<void>((resolve) => {
      releaseReader = resolve;
    });
    let arrivals = 0;
    left.commit = async (...args) => {
      if (++arrivals === 2) bothReady();
      await leftGate;
      return leftCommit(...args);
    };
    right.commit = async (...args) => {
      if (++arrivals === 2) bothReady();
      await rightGate;
      return rightCommit(...args);
    };
    const publicationA = parallelA.session.publish(parallelA.artifact);
    const publicationB = parallelB.session.publish(parallelB.artifact);
    void publicationB.catch(() => {});
    await both;
    try {
      releaseLeft();
      await publicationA;
      let firstRead = true;
      left.readRecordingChunk = async (...args) => {
        if (firstRead) {
          firstRead = false;
          readerReady();
          await readerGate;
        }
        return leftRead(...args);
      };
      const loading = store.loadRecording(
        parallelA.artifact.runId,
        parallelA.artifact.artifactSha256,
      );
      await readerEntered;
      releaseRight();
      await publicationB;
      releaseReader();
      equal(await loading, parallelA.artifact);
      truth(arrivals === 2, "both writers reached the first-publication commit race");
      results.push({
        name: "simultaneous first publishers in separate IDB instances retain the winning immutable reader generation",
        status: "PASS",
      });
    } finally {
      releaseLeft();
      releaseRight();
      releaseReader();
      left.commit = leftCommit;
      right.commit = rightCommit;
      left.readRecordingChunk = leftRead;
      peer.close();
    }

    // Cancel after the manifest request has succeeded but before its transaction completes.
    const cancellation = await recording(store, "run.cancel-manifest");
    let manifestCancelHooks = 0;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore["add"]>) {
      const request = nativeAdd.apply(this, args);
      if (this.name === "recordings")
        request.addEventListener(
          "success",
          () => {
            manifestCancelHooks++;
            void cancellation.session.cancel("CANCEL_DURING_MANIFEST");
          },
          { once: true },
        );
      return request;
    };
    try {
      await refused(cancellation.session.publish(cancellation.artifact));
      truth(
        manifestCancelHooks === 1 && cancellation.session.getTelemetry().publishedFrames === 0,
        "cancelled final transaction never advances published",
      );
      equal(
        await store.loadRecording(
          cancellation.artifact.runId,
          cancellation.artifact.artifactSha256,
        ),
        null,
      );
    } finally {
      IDBObjectStore.prototype.add = nativeAdd;
    }
    equal(await store.loadRecording(baseline.runId, baseline.artifactSha256), baseline);
    results.push({
      name: "cancel between manifest request success and transaction complete aborts atomic publication",
      status: "PASS",
    });

    const crash = await recording(store, "run.crash");
    const crashSessionId = crash.session.getTelemetry().sessionId;
    store.close();
    const reopened = new BlobStore({ databaseName: name });
    const entries = await reopened.listRecordingRecovery();
    truth(
      entries.some((entry) => entry.sessionId === crashSessionId && entry.persistedFrames === 9),
      "reopened store identifies the complete committed prefix",
    );
    await refused(reopened.recoverRecording(crashSessionId), "BLOB_STAGING_ACTIVE");
    await refused(reopened.discardRecordingRecovery(crashSessionId), "BLOB_STAGING_ACTIVE");
    const database = await open(name);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("recordingSessions", "readwrite");
      const sessions = transaction.objectStore("recordingSessions");
      const request = sessions.get(crashSessionId);
      request.onsuccess = () => sessions.put({ ...request.result, leaseExpiresAt: 0 });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    const recovered = await reopened.recoverRecording(crashSessionId);
    truth(
      recovered.status === "interrupted" && recovered.frameCount === 9,
      "recovery never promotes an abandoned prefix to captured",
    );
    equal(recovered.frames, crash.artifact.frames);
    equal(
      await reopened.loadRecording(first.artifact.runId, first.artifact.artifactSha256),
      first.artifact,
    );
    results.push({
      name: "reopen rejects active recovery, then recovers an expired interrupted prefix without changing published data",
      status: "PASS",
    });
    await reopened.discardRecordingRecovery(crashSessionId);
    truth(
      !(await reopened.listRecordingRecovery()).some((entry) => entry.sessionId === crashSessionId),
      "expired unpublished chunks are cleaned transactionally",
    );
    await refused(
      reopened.discardRecordingRecovery(first.session.getTelemetry().sessionId),
      "BLOB_STAGING",
    );
    equal(
      await reopened.loadRecording(first.artifact.runId, first.artifact.artifactSha256),
      first.artifact,
    );
    results.push({
      name: "orphan cleanup releases only expired unpublished ownership and cannot remove published chunks",
      status: "PASS",
    });

    let savedChunk: unknown;
    const publishedSessionId = first.session.getTelemetry().sessionId;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("recordingChunks", "readwrite");
      const chunks = transaction.objectStore("recordingChunks");
      const request = chunks.get([publishedSessionId, 4]);
      request.onsuccess = () => {
        savedChunk = request.result;
        chunks.delete([publishedSessionId, 4]);
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    await refused(
      reopened.loadRecording(first.artifact.runId, first.artifact.artifactSha256),
      "BLOB_INTEGRITY",
    );
    equal(await reopened.loadRecording(baseline.runId, baseline.artifactSha256), baseline);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("recordingChunks", "readwrite");
      transaction.objectStore("recordingChunks").put(savedChunk);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    equal(
      await reopened.loadRecording(first.artifact.runId, first.artifact.artifactSha256),
      first.artifact,
    );
    database.close();
    results.push({
      name: "missing published chunk fails integrity without accepting a gapped trace or damaging another reference",
      status: "PASS",
    });
    reopened.close();
    (document.getElementById("result") as HTMLElement).textContent = JSON.stringify(results);
    return {
      status: "PASS",
      method: "component API with actual browser IndexedDB, not product UI",
      results,
    };
  };
