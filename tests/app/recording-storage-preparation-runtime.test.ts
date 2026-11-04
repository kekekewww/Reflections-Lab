import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { setImmediate as nextTurn } from "node:timers/promises";
import { LabRuntime } from "../../src/app/runtime.js";
import {
  RecordingEvaluationClient,
  type RecordingEvaluationWorkerPort,
} from "../../src/app/recording-evaluation-client.js";
import { RecordingHost } from "../../src/app/recording-host.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import {
  RecordingPersistenceSession,
  type RecordingPersistenceBackend,
} from "../../src/experiments/recording-persistence.js";
import type { BlobStore } from "../../src/persistence/blob-store.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import { options, frame } from "../experiment-runtime/worker-fixture.js";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}
async function settle() {
  await nextTurn();
  await nextTurn();
}
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100 && !check(); attempt++)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(check(), true, "bounded storage preparation must become observable");
}
interface Access {
  blobStore: BlobStore;
  recorder: RecordingHost;
  audio: AudioEngine | null;
  world: { paused: boolean; tick: number };
  busy: boolean;
}
interface Row {
  id: string;
  create: ReturnType<typeof deferred<void>>;
  session: RecordingPersistenceSession | null;
  publishes: number;
}
async function fixture(timeoutMs?: number, allowPublish = false) {
  const runtime = await LabRuntime.create({ useWorker: false });
  const access = runtime as unknown as Access;
  const rows: Row[] = [],
    interrupted: string[] = [];
  const control = { autoReady: false };
  access.blobStore.createRecordingPersistence = (recorder, callbacks) => {
    const row: Row = {
      id: `session.runtime-prepared.${rows.length + 1}`,
      create: deferred<void>(),
      session: null,
      publishes: 0,
    };
    rows.push(row);
    if (control.autoReady) row.create.resolve();
    const backend: RecordingPersistenceBackend = {
      create: async () => {
        await row.create.promise;
      },
      append: async () => {},
      publish: async (_sessionId, artifact) => {
        row.publishes++;
        if (!allowPublish) throw new Error("this fixture must not publish");
        const bytes = Buffer.from(JSON.stringify(artifact));
        return {
          runId: artifact.runId,
          sha256: artifact.artifactSha256,
          hashKind: "canonicalRecordingArtifactSha256",
          encodedSha256: createHash("sha256").update(bytes).digest("hex"),
          encodedHashKind: "utf8JsonBytesSha256",
          byteLength: bytes.length,
        };
      },
      interrupt: async (sessionId) => {
        interrupted.push(sessionId);
      },
    };
    const session = new RecordingPersistenceSession(
      row.id,
      recorder.captureSealSnapshot(),
      backend,
      callbacks,
    );
    if (timeoutMs !== undefined) {
      const original = session.waitUntilReady.bind(session);
      session.waitUntilReady = (signal) => original(signal, timeoutMs);
    }
    row.session = session;
    return session;
  };
  return { runtime, access, rows, interrupted, control };
}
async function cleanup(f: Awaited<ReturnType<typeof fixture>>) {
  for (const row of f.rows) row.create.resolve();
  f.runtime.dispose();
  await settle();
}
async function seedOldArtifact(f: Awaited<ReturnType<typeof fixture>>) {
  const recorder = new ExperimentRecorder(options("run.old-runtime-storage"));
  recorder.appendFrame(frame(0));
  recorder.appendFrame(frame(1));
  await f.access.recorder.restoreArtifact(await recorder.finish());
  await f.access.recorder.captureComparison("A");
  return { artifact: f.runtime.getRecordingArtifact(), slots: f.access.recorder.getSlots() };
}

// Actual Runtime + Host + persistence session, with controlled backend promises.
// This is not browser, native IDB, physical audio, or scheduling-performance proof.
test(
  "runtime freezes physics and enabled audio until storage is ready, then explicitly admits recording",
  { timeout: 5000 },
  async () => {
    const f = await fixture();
    const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
    f.access.audio = engine;
    let starting: Promise<void> | null = null;
    try {
      await engine.enable(0);
      await f.runtime.dispatch({ type: "run" });
      f.runtime.advance(1 / 60);
      await settle();
      assert.equal(engine.getTelemetry().paused, false);
      starting = f.runtime.dispatch({ type: "recordToggle" });
      await until(() => f.rows.length === 1);
      const beforeTick = f.access.world.tick;
      assert.equal(f.access.world.paused, true);
      assert.equal(engine.getTelemetry().paused, true);
      assert.equal(f.runtime.getSnapshot().notice, "正在準備錄製…");
      assert.equal(f.access.recorder.getView().pending, true);
      assert.equal(f.access.recorder.getView().recording.state, "idle");
      for (let tick = 0; tick < 12; tick++) f.runtime.advance(1 / 60);
      assert.equal(f.access.world.tick, beforeTick);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      f.rows[0]!.create.resolve();
      await starting;
      assert.equal(f.access.world.paused, false);
      assert.equal(engine.getTelemetry().paused, false);
      assert.equal(f.access.recorder.getView().recording.state, "recording");
      assert.notEqual(f.runtime.getSnapshot().notice, "正在準備錄製…");
      f.runtime.advance(1 / 60);
      await f.runtime.flushRecordingEvaluation();
      await f.rows[0]!.session!.flush();
      assert.equal(f.access.world.tick, beforeTick + 1);
      assert.equal(f.rows[0]!.session!.getTelemetry().persistedFrames, 1);
    } finally {
      f.runtime.dispose();
      await starting?.catch(() => {});
      await cleanup(f);
    }
  },
);

for (const action of ["pause", "reset", "dispose"] as const)
  test(
    `${action} during storage preparation releases its owner and late readiness never resumes the runtime`,
    { timeout: 5000 },
    async () => {
      const f = await fixture();
      let starting: Promise<void> | null = null;
      try {
        const old = await seedOldArtifact(f);
        const previousRunId = f.runtime.getSnapshot().runId;
        starting = f.runtime.dispatch({ type: "recordToggle" });
        await until(() => f.rows.length === 1);
        assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
        if (action === "dispose") f.runtime.dispose();
        else await f.runtime.dispatch({ type: action });
        await starting;
        assert.equal(f.access.busy, false, action);
        assert.equal(f.access.world.paused, true, action);
        assert.notEqual(f.access.recorder.getView().recording.state, "recording", action);
        assert.equal(f.runtime.getRecordingArtifact(), old.artifact, action);
        assert.deepEqual(f.access.recorder.getSlots(), old.slots, action);
        if (action === "reset") assert.notEqual(f.runtime.getSnapshot().runId, previousRunId);
        const stoppedTick = f.access.world.tick;
        f.rows[0]!.create.resolve();
        await settle();
        f.runtime.advance(1);
        assert.equal(
          f.access.world.tick,
          stoppedTick,
          "late storage completion has no resume authority",
        );
        assert.equal(f.access.world.paused, true);
        assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
        assert.equal(f.rows[0]!.publishes, 0);
        assert.equal(f.runtime.getRecordingArtifact(), old.artifact);
      } finally {
        f.runtime.dispose();
        await starting?.catch(() => {});
        await cleanup(f);
      }
    },
  );

test(
  "storage preparation timeout releases runtime ownership while one retirement blocks duplicate sessions until cleanup",
  { timeout: 5000 },
  async () => {
    const f = await fixture(5);
    try {
      const old = await seedOldArtifact(f);
      await f.runtime.dispatch({ type: "recordToggle" });
      assert.match(f.runtime.getSnapshot().error ?? "", /錄製儲存.*逾時/);
      assert.equal(f.access.busy, false);
      assert.equal(f.access.world.paused, true);
      assert.notEqual(f.runtime.getSnapshot().notice, "正在準備錄製…");
      assert.equal(f.runtime.getRecordingArtifact(), old.artifact);
      assert.equal(f.rows.length, 1);
      for (let retry = 0; retry < 3; retry++) {
        await f.runtime.dispatch({ type: "recordToggle" });
        assert.equal(f.access.busy, false);
        assert.equal(
          f.rows.length,
          1,
          "explicit retries cannot accumulate unresolved storage sessions",
        );
      }
      f.control.autoReady = true;
      f.rows[0]!.create.resolve();
      await settle();
      assert.ok(f.interrupted.includes(f.rows[0]!.id));
      await f.runtime.dispatch({ type: "recordToggle" });
      assert.equal(f.rows.length, 2);
      assert.equal(f.access.recorder.getView().recording.state, "recording");
      assert.equal(f.access.world.paused, false);
      assert.equal(f.rows[1]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.runtime.getRecordingArtifact(), old.artifact);
    } finally {
      await cleanup(f);
    }
  },
);

test(
  "storage create failure preserves its original error and previous valid recording without admitting frames",
  { timeout: 5000 },
  async () => {
    const f = await fixture();
    let starting: Promise<void> | null = null;
    try {
      const old = await seedOldArtifact(f);
      starting = f.runtime.dispatch({ type: "recordToggle" });
      await until(() => f.rows.length === 1);
      f.rows[0]!.create.reject(new Error("ORIGINAL_STORAGE_CREATE_DENIED"));
      await starting;
      assert.match(f.runtime.getSnapshot().error ?? "", /ORIGINAL_STORAGE_CREATE_DENIED/);
      assert.equal(f.access.busy, false);
      assert.equal(f.access.world.paused, true);
      assert.notEqual(f.runtime.getSnapshot().notice, "正在準備錄製…");
      assert.notEqual(f.access.recorder.getView().recording.state, "recording");
      assert.equal(f.runtime.getRecordingArtifact(), old.artifact);
      assert.deepEqual(f.access.recorder.getSlots(), old.slots);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.publishes, 0);
    } finally {
      f.runtime.dispose();
      await starting?.catch(() => {});
      await cleanup(f);
    }
  },
);

test(
  "a controlled one-tick take waits for storage, ignores RAF advances, and publishes exactly one fixed frame",
  { timeout: 5000 },
  async () => {
    const f = await fixture(undefined, true);
    let capture: Promise<void> | null = null;
    try {
      const scene = f.runtime.getSceneDocument();
      const beforeTick = f.access.world.tick;
      capture = f.runtime.captureShortTake(1 / 60);
      // Attach an error observer immediately while the original promise remains authoritative.
      void capture.catch(() => {});
      await until(() => f.rows.length === 1);
      assert.equal(f.runtime.getSnapshot().notice, "正在準備錄製…");
      assert.equal(f.access.world.paused, true);
      assert.equal(f.access.recorder.getView().pending, true);
      assert.equal(f.access.recorder.getView().recording.state, "idle");
      for (let tick = 0; tick < 12; tick++) f.runtime.advance(1 / 60);
      assert.equal(f.access.world.tick, beforeTick);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      f.rows[0]!.create.resolve();
      await capture;
      const artifact = f.runtime.getRecordingArtifact();
      assert.ok(artifact);
      assert.equal(artifact.status, "captured");
      assert.equal(artifact.frameCount, 1);
      assert.deepEqual(
        artifact.frames.map((recorded) => recorded.tick),
        [beforeTick + 1],
      );
      assert.equal(f.access.world.tick, beforeTick + 1);
      assert.equal(f.access.world.paused, true);
      assert.equal(f.access.busy, false);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 1);
      assert.equal(f.rows[0]!.session!.getTelemetry().persistedFrames, 1);
      assert.equal(f.rows[0]!.session!.getTelemetry().publishedFrames, 1);
      assert.equal(f.rows[0]!.publishes, 1);
      assert.deepEqual(f.runtime.getSceneDocument(), scene);
    } finally {
      f.runtime.dispose();
      await capture?.catch(() => {});
      await cleanup(f);
    }
  },
);

test(
  "Reset during controlled storage preparation finishes cleanup, preserves old results, and rejects late resume",
  { timeout: 5000 },
  async () => {
    const f = await fixture();
    let capture: Promise<void> | null = null;
    try {
      const old = await seedOldArtifact(f);
      const previousRunId = f.runtime.getSnapshot().runId;
      capture = f.runtime.captureShortTake(1 / 60);
      const interrupted = assert.rejects(capture, /SHORT_TAKE_INTERRUPTED/);
      await until(() => f.rows.length === 1);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      await f.runtime.dispatch({ type: "reset" });
      await interrupted;
      assert.notEqual(f.runtime.getSnapshot().runId, previousRunId);
      assert.equal(f.access.busy, false);
      assert.equal(f.access.world.paused, true);
      assert.equal(f.access.recorder.getView().pending, false);
      assert.notEqual(f.access.recorder.getView().recording.state, "recording");
      assert.equal(f.runtime.getRecordingArtifact(), old.artifact);
      assert.deepEqual(f.access.recorder.getSlots(), old.slots);
      const stoppedTick = f.access.world.tick;
      f.rows[0]!.create.resolve();
      await settle();
      f.runtime.advance(1);
      assert.equal(f.access.world.tick, stoppedTick);
      assert.equal(f.access.world.paused, true);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.publishes, 0);
      assert.equal(f.runtime.getRecordingArtifact(), old.artifact);
      assert.deepEqual(f.access.recorder.getSlots(), old.slots);
    } finally {
      f.runtime.dispose();
      await capture?.catch(() => {});
      await cleanup(f);
    }
  },
);

test(
  "storage failure after readiness but before the worker ACK cannot leave a prepared capture pending",
  { timeout: 5000 },
  async () => {
    const f = await fixture();
    const evaluationAccess = f.runtime as unknown as {
      recordingEvaluation: RecordingEvaluationClient;
    };
    evaluationAccess.recordingEvaluation.dispose();
    const messages: { kind: string; id: number; generation: number; protocolVersion: number }[] =
      [];
    const port: RecordingEvaluationWorkerPort = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage(value) {
        assert.ok(value !== null && typeof value === "object");
        const message = value as (typeof messages)[number] & { input?: unknown };
        assert.equal(message.kind, "prepare", "the ACK gate emits no empty solver job");
        assert.equal(message.input, undefined);
        messages.push(message);
      },
      terminate() {},
    };
    evaluationAccess.recordingEvaluation = new RecordingEvaluationClient({
      workerFactory: () => port,
    });
    let starting: Promise<void> | null = null;
    try {
      const old = await seedOldArtifact(f);
      starting = f.runtime.dispatch({ type: "recordToggle" });
      await until(() => f.rows.length === 1);
      f.rows[0]!.create.resolve();
      await until(() => messages.length === 1);
      assert.equal(f.rows[0]!.session!.getReadinessTelemetry().createState, "ready");
      assert.equal(f.access.world.paused, true);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      const deliver = port.onmessage!;
      const request = messages[0]!;
      const original = new Error("STORAGE_FAILED_DURING_WORKER_ACK");
      // Friend fault injection exercises the real session's existing failure path.
      (f.rows[0]!.session as unknown as { fail(reason: unknown): void }).fail(original);
      assert.equal(f.rows[0]!.session!.getTelemetry().state, "interrupted");
      deliver({
        data: {
          kind: "prepared",
          ok: true,
          id: request.id,
          generation: request.generation,
          protocolVersion: 1,
        },
      });
      await starting;
      assert.equal(f.access.world.paused, true);
      assert.equal(f.access.busy, false);
      assert.equal(
        f.access.recorder.getView().pending,
        false,
        "failed admission releases the prepared owner",
      );
      assert.notEqual(f.access.recorder.getView().recording.state, "recording");
      assert.equal(f.runtime.getRecordingArtifact(), old.artifact);
      assert.deepEqual(f.access.recorder.getSlots(), old.slots);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.publishes, 0);
      assert.match(f.runtime.getSnapshot().error ?? "", /STORAGE_FAILED_DURING_WORKER_ACK/);
    } finally {
      f.runtime.dispose();
      await starting?.catch(() => {});
      await cleanup(f);
    }
  },
);
