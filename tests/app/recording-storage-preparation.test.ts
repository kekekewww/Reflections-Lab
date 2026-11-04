import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { setImmediate as nextTurn } from "node:timers/promises";
import { RecordingHost } from "../../src/app/recording-host.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import {
  RecordingPersistenceSession,
  type RecordingPersistenceBackend,
} from "../../src/experiments/recording-persistence.js";
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
  // Drain real Promise reactions rather than assuming a fixed number of nested awaits.
  await nextTurn();
  await nextTurn();
}
function operationalFailure(reason: unknown): boolean {
  return (
    reason instanceof Error &&
    !(reason instanceof TypeError) &&
    typeof (reason as Error & { code?: unknown }).code === "string"
  );
}
interface SessionRow {
  id: string;
  create: ReturnType<typeof deferred<void>>;
  session: RecordingPersistenceSession | null;
  appends: number;
  publishes: number;
}
function fixture(
  settings: {
    readyInitially?: boolean;
    evaluation?: boolean;
    interrupt?: (sessionId: string) => Promise<void>;
  } = {},
) {
  const rows: SessionRow[] = [],
    interrupted: string[] = [],
    cancelled: string[] = [];
  const failures: Error[] = [];
  const host = new RecordingHost({
    getConfig: () => options("run.storage-prepared"),
    createPersistence: (recorder, callbacks) => {
      const row: SessionRow = {
        id: `session.prepared.${rows.length + 1}`,
        create: deferred<void>(),
        session: null,
        appends: 0,
        publishes: 0,
      };
      rows.push(row);
      if (settings.readyInitially) row.create.resolve();
      const backend: RecordingPersistenceBackend = {
        create: async () => {
          await row.create.promise;
        },
        append: async () => {
          row.appends++;
        },
        publish: async (_sessionId, artifact) => {
          row.publishes++;
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
          await settings.interrupt?.(sessionId);
        },
      };
      row.session = new RecordingPersistenceSession(
        row.id,
        recorder.captureSealSnapshot(),
        backend,
        callbacks,
      );
      return row.session;
    },
    ...(settings.evaluation ? { evaluateCapture: async () => [] } : {}),
    cancelEvaluation: (reason) => cancelled.push(reason),
    onEvaluationFailure: (reason) => failures.push(reason),
  });
  return { host, rows, interrupted, cancelled, failures };
}
async function cleanup(f: ReturnType<typeof fixture>) {
  for (const row of f.rows) row.create.resolve();
  f.host.dispose();
  await settle();
}
async function oldArtifact(host: RecordingHost) {
  const recorder = new ExperimentRecorder(options("run.old-preserved"));
  recorder.appendFrame(frame(0));
  recorder.appendFrame(frame(1));
  await host.restoreArtifact(await recorder.finish());
  await host.captureComparison("A");
  return { artifact: host.getArtifact(), slots: host.getSlots(), comparison: host.getComparison() };
}

// These tests use actual RecordingPersistenceSession readiness/cancellation and a
// controlled backend. They do not claim native IDB, Web Locks, or browser proof.
test(
  "prepared capture accepts no frames until storage is ready and an explicit resume commits it",
  { timeout: 5000 },
  async () => {
    const f = fixture();
    const signal = new AbortController();
    let preparing: Promise<void> | null = null;
    try {
      preparing = f.host.prepareStart(signal.signal);
      assert.equal(f.rows.length, 1);
      assert.equal(f.host.getView().pending, true);
      assert.equal(f.host.getView().recording.state, "idle");
      assert.equal(f.host.appendFrame(frame(0)), false);
      assert.equal(f.host.appendEvaluationFrame(frame(0), []), false);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.throws(() => f.host.resume(), operationalFailure);
      f.rows[0]!.create.resolve();
      await preparing;
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.session!.getReadinessTelemetry().createState, "ready");
      assert.equal(f.host.appendFrame(frame(0)), false, "readiness alone is not admission");
      f.host.resume();
      assert.equal(f.host.getView().pending, false);
      assert.equal(f.host.getView().recording.state, "recording");
      assert.equal(f.host.appendFrame(frame(0)), true);
      const artifact = await f.host.stop();
      assert.equal(artifact.frameCount, 1);
      assert.equal(artifact.startTick, 0);
      assert.equal(artifact.endTick, 0);
      assert.equal(f.rows[0]!.publishes, 1);
    } finally {
      signal.abort();
      await preparing?.catch(() => {});
      await cleanup(f);
    }
  },
);

test(
  "aborting unresolved storage releases the UI owner but retirement blocks duplicate sessions and preserves old results",
  { timeout: 5000 },
  async () => {
    const f = fixture();
    const signal = new AbortController();
    let preparing: Promise<void> | null = null;
    try {
      const before = await oldArtifact(f.host);
      preparing = f.host.prepareStart(signal.signal);
      const rejection = assert.rejects(preparing, operationalFailure);
      assert.equal(f.host.getView().recording.state, "finalized");
      signal.abort();
      await rejection;
      assert.equal(f.host.getView().pending, false);
      assert.equal(f.host.getArtifact(), before.artifact);
      assert.deepEqual(f.host.getSlots(), before.slots);
      assert.equal(f.host.getComparison(), before.comparison);
      for (let attempt = 0; attempt < 3; attempt++) {
        assert.throws(() => f.host.start(), operationalFailure);
        await assert.rejects(f.host.prepareStart(), operationalFailure);
        assert.equal(
          f.rows.length,
          1,
          "one unresolved create is the complete bounded retirement set",
        );
      }
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.publishes, 0);
      f.rows[0]!.create.resolve();
      await settle();
      assert.ok(f.interrupted.includes(f.rows[0]!.id));
      const next = f.host.prepareStart();
      assert.equal(
        f.rows.length,
        2,
        "a new explicit click may create only after retirement finishes",
      );
      f.rows[1]!.create.resolve();
      await next;
      assert.equal(f.host.getArtifact(), before.artifact);
      f.host.abortPreparedStart("TEST_COMPLETE");
    } finally {
      signal.abort();
      await preparing?.catch(() => {});
      await cleanup(f);
    }
  },
);

test(
  "late create failure of an aborted empty candidate cannot change old artifact, comparison, or current error",
  { timeout: 5000 },
  async () => {
    const f = fixture();
    const signal = new AbortController();
    let preparing: Promise<void> | null = null;
    try {
      const before = await oldArtifact(f.host);
      preparing = f.host.prepareStart(signal.signal);
      const rejection = assert.rejects(preparing, operationalFailure);
      signal.abort();
      await rejection;
      const errorBefore = f.host.getView().error;
      const failuresBefore = f.failures.length;
      f.rows[0]!.create.reject(new Error("LATE_OLD_CREATE_FAILED"));
      await settle();
      assert.equal(f.host.getView().pending, false);
      assert.equal(f.host.getView().error, errorBefore);
      assert.equal(
        f.failures.length,
        failuresBefore,
        "retired callbacks have no current capture authority",
      );
      assert.equal(f.host.getArtifact(), before.artifact);
      assert.deepEqual(f.host.getSlots(), before.slots);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.publishes, 0);
    } finally {
      signal.abort();
      await preparing?.catch(() => {});
      await cleanup(f);
    }
  },
);

test(
  "explicit abort, interrupt, and disposal detach unready empty candidates without waiting for create",
  { timeout: 5000 },
  async () => {
    for (const action of ["abort", "interrupt", "dispose"] as const) {
      const f = fixture();
      let preparing: Promise<void> | null = null;
      try {
        preparing = f.host.prepareStart();
        const rejection = assert.rejects(preparing, operationalFailure);
        if (action === "abort") f.host.abortPreparedStart("RESET");
        else if (action === "interrupt") await f.host.interrupt("RESET");
        else f.host.dispose();
        await rejection;
        assert.equal(f.host.getView().pending, false, action);
        assert.equal(f.host.getView().recording.state, "idle", action);
        assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0, action);
        f.rows[0]!.create.resolve();
        await settle();
        assert.equal(f.rows[0]!.publishes, 0, action);
        assert.equal(f.host.getArtifact(), null, action);
      } finally {
        await preparing?.catch(() => {});
        await cleanup(f);
      }
    }
  },
);

test(
  "failed retirement retries only the same cleanup and cannot create overlapping sessions",
  { timeout: 5000 },
  async () => {
    let failInterrupt = true;
    const retry = deferred<void>();
    const f = fixture({
      readyInitially: true,
      interrupt: async () => {
        if (failInterrupt) throw new Error("INTERRUPT_TRANSACTION_FAILED");
        await retry.promise;
      },
    });
    try {
      await f.host.prepareStart();
      f.host.abortPreparedStart("CANCEL_EMPTY");
      await settle();
      const callsBeforeRetry = f.interrupted.length;
      assert.ok(callsBeforeRetry > 0);
      assert.equal(f.host.getView().pending, false);
      assert.throws(() => f.host.start(), operationalFailure);
      failInterrupt = false;
      await assert.rejects(f.host.prepareStart(), operationalFailure);
      await settle();
      assert.ok(
        f.interrupted.length > callsBeforeRetry,
        "the explicit retry works on the retired session",
      );
      const callsWhileRetryPending = f.interrupted.length;
      for (let attempt = 0; attempt < 3; attempt++)
        await assert.rejects(f.host.prepareStart(), operationalFailure);
      await settle();
      assert.equal(f.rows.length, 1);
      assert.equal(
        f.interrupted.length,
        callsWhileRetryPending,
        "only one cleanup attempt may be in flight",
      );
      assert.ok(f.interrupted.every((id) => id === f.rows[0]!.id));
      retry.resolve();
      await settle();
      await f.host.prepareStart();
      assert.equal(f.rows.length, 2);
      assert.equal(f.rows[1]!.session!.getTelemetry().acceptedFrames, 0);
      f.host.abortPreparedStart("TEST_COMPLETE");
    } finally {
      failInterrupt = false;
      retry.resolve();
      await cleanup(f);
    }
  },
);

test(
  "retiring a prior completed evaluation lane cannot cancel the next prepared worker owner",
  { timeout: 5000 },
  async () => {
    const cancelled: string[] = [];
    const host = new RecordingHost({
      getConfig: () => options("run.second-prepared"),
      evaluateCapture: async () => [],
      cancelEvaluation: (reason) => cancelled.push(reason),
    });
    try {
      host.start();
      assert.equal(host.appendEvaluationFrame(frame(0), []), true);
      await host.flushEvaluation();
      await host.stop();
      assert.deepEqual(cancelled, []);
      await host.prepareStart();
      host.resume();
      assert.deepEqual(
        cancelled,
        [],
        "old lane disposal cannot terminate a worker prepared for a new candidate",
      );
      assert.equal(host.appendEvaluationFrame(frame(10), []), true);
      await host.flushEvaluation();
      const artifact = await host.stop();
      assert.equal(artifact.startTick, 10);
      assert.equal(artifact.frameCount, 1);
      assert.deepEqual(cancelled, []);
    } finally {
      host.dispose();
    }
  },
);

test(
  "legacy synchronous start keeps immediate frame admission while storage is not yet ready",
  { timeout: 5000 },
  async () => {
    const f = fixture();
    try {
      f.host.start();
      assert.equal(f.host.getView().pending, false);
      assert.equal(f.host.getView().recording.state, "recording");
      assert.equal(f.host.appendFrame(frame(0)), true);
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 1);
      assert.equal(f.rows[0]!.session!.getTelemetry().persistedFrames, 0);
      f.rows[0]!.create.resolve();
      const artifact = await f.host.stop();
      assert.equal(artifact.frameCount, 1);
      assert.equal(f.rows[0]!.publishes, 1);
    } finally {
      await cleanup(f);
    }
  },
);

test(
  "prepared start rejects a persistence without readiness capability while legacy start remains compatible",
  { timeout: 5000 },
  async () => {
    const f = fixture();
    const hostOptions = Reflect.get(f.host, "options") as ConstructorParameters<
      typeof RecordingHost
    >[0];
    const originalCreate = hostOptions.createPersistence!;
    hostOptions.createPersistence = (recorder, callbacks) => {
      const session = originalCreate(recorder, callbacks);
      // A valid legacy persistence may lack this optional capability. Missing is not ready.
      Object.defineProperty(session, "waitUntilReady", { value: undefined });
      return session;
    };
    let preparing: Promise<void> | null = null;
    try {
      preparing = f.host.prepareStart();
      await assert.rejects(preparing, { code: "RECORDING_STORAGE_PREPARATION_UNSUPPORTED" });
      assert.equal(f.rows.length, 1);
      assert.equal(f.host.getView().pending, false);
      assert.equal(f.host.getView().recording.state, "idle");
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.publishes, 0);
      assert.equal(f.host.appendFrame(frame(0)), false);
      assert.equal(f.host.appendEvaluationFrame(frame(0), []), false);
      assert.throws(() => f.host.start(), operationalFailure);
      assert.equal(f.rows.length, 1, "unresolved retirement cannot create a second session");
      f.rows[0]!.create.resolve();
      await settle();

      // The new prepared gate must not silently change the older synchronous API.
      f.host.start();
      assert.equal(f.rows.length, 2);
      assert.equal(f.host.getView().pending, false);
      assert.equal(f.host.appendFrame(frame(0)), true);
      assert.equal(f.rows[1]!.session!.getTelemetry().acceptedFrames, 1);
      assert.equal(f.rows[1]!.session!.getTelemetry().persistedFrames, 0);
      f.rows[1]!.create.resolve();
      const artifact = await f.host.stop();
      assert.equal(artifact.frameCount, 1);
      assert.equal(f.rows[1]!.publishes, 1);
    } finally {
      await preparing?.catch(() => {});
      await cleanup(f);
    }
  },
);

test(
  "current storage creation failure preserves its original error and old results before allowing a fresh preparation",
  { timeout: 5000 },
  async () => {
    const f = fixture({ evaluation: true });
    let preparing: Promise<void> | null = null;
    try {
      const before = await oldArtifact(f.host);
      const errorBefore = f.host.getView().error;
      const original = new Error("CURRENT_PREPARATION_CREATE_FAILED");
      preparing = f.host.prepareStart();
      const rejection = assert.rejects(preparing, (reason) => reason === original);
      assert.equal(f.rows.length, 1);
      f.rows[0]!.create.reject(original);
      await rejection;
      await settle();
      assert.equal(f.rows[0]!.session!.getReadinessTelemetry().createState, "failed");
      assert.equal(f.rows[0]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.rows[0]!.publishes, 0);
      assert.equal(f.host.getView().pending, false);
      assert.equal(f.host.getView().error, errorBefore);
      assert.equal(f.host.getArtifact(), before.artifact);
      assert.deepEqual(f.host.getSlots(), before.slots);
      assert.equal(f.host.getComparison(), before.comparison);
      assert.deepEqual(
        f.failures,
        [],
        "the preparation await owns its failure rather than reporting a current-run failure",
      );
      assert.deepEqual(
        f.cancelled,
        [],
        "rolling back an empty candidate cannot cancel another evaluation owner",
      );

      const next = f.host.prepareStart();
      assert.equal(
        f.rows.length,
        2,
        "a rejected create left no completed session, so its retirement slot may clear",
      );
      f.rows[1]!.create.resolve();
      await next;
      assert.equal(f.rows[1]!.session!.getReadinessTelemetry().createState, "ready");
      assert.equal(f.rows[1]!.session!.getTelemetry().acceptedFrames, 0);
      assert.equal(f.host.getArtifact(), before.artifact);
      assert.deepEqual(f.host.getSlots(), before.slots);
      f.host.abortPreparedStart("TEST_COMPLETE");
    } finally {
      await preparing?.catch(() => {});
      await cleanup(f);
    }
  },
);
