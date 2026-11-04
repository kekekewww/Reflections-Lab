import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { canonicalStringify } from "../../src/experiments/hash.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import {
  RecordingPersistenceSession,
  type EncodedRecordingFrame,
  type RecordingAppendOptions,
  type RecordingPersistenceBackend,
  type RecordingPersistenceBudget,
} from "../../src/experiments/recording-persistence.js";
import type { RecordingCommitObserver } from "../../src/experiments/recording-commit-diagnostics.js";
import { frame, options } from "./worker-fixture.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}

function fixture(
  hook = true,
  budget: Partial<RecordingPersistenceBudget> = {},
  events: { onChanged?(): void; synchronousIssued?: boolean } = {},
) {
  const creation = deferred();
  const recorder = new ExperimentRecorder(options());
  const batches: {
    frames: readonly EncodedRecordingFrame[];
    observer?: RecordingCommitObserver;
    issue(): void;
    commit: ReturnType<typeof deferred>;
  }[] = [];
  const failures: Error[] = [];
  let active = 0,
    peak = 0,
    publications = 0,
    pressures = 0;
  const backend: RecordingPersistenceBackend = {
    create: () => creation.promise,
    append: (_id, frames, observer, appendOptions?: RecordingAppendOptions) => {
      active++;
      peak = Math.max(peak, active);
      const commit = deferred();
      const batch = {
        frames,
        observer,
        commit,
        issue: () => {
          try {
            if (hook) appendOptions?.onIssued?.();
          } catch {
            // Match the backend contract: notification errors do not abort writes.
          }
        },
      };
      batches.push(batch);
      if (events.synchronousIssued) batch.issue();
      return commit.promise.finally(() => {
        active--;
      });
    },
    interrupt: async () => {},
    publish: async (_id, artifact) => {
      assert.equal(active, 0, "publication must never overlap an append");
      publications++;
      const bytes = Buffer.from(canonicalStringify(artifact));
      return {
        runId: artifact.runId,
        sha256: artifact.artifactSha256,
        hashKind: "canonicalRecordingArtifactSha256",
        encodedSha256: createHash("sha256").update(bytes).digest("hex"),
        encodedHashKind: "utf8JsonBytesSha256",
        byteLength: bytes.length,
      };
    },
  };
  const session = new RecordingPersistenceSession(
    "session.pipeline",
    recorder.captureSealSnapshot(),
    backend,
    {
      onChanged: events.onChanged,
      onFailure: (error) => failures.push(error),
      onBackpressure: () => {
        pressures++;
      },
    },
    budget,
  );
  const enqueue = (tick: number) => {
    recorder.appendFrame(frame(tick));
    session.enqueue(recorder.getLastFrame()!);
  };
  return {
    session,
    recorder,
    creation,
    batches,
    failures,
    enqueue,
    active: () => active,
    peak: () => peak,
    publications: () => publications,
    pressures: () => pressures,
  };
}

test("depth two waits for issued, keeps contiguous undispatched frames and accounts out-of-order promises in order", async () => {
  const f = fixture();
  f.enqueue(0);
  await turn();
  assert.equal(f.batches.length, 0, "first append still waits for create");
  f.creation.resolve();
  await turn();
  f.enqueue(1);
  f.enqueue(2);
  const bytes = f.session.getTelemetry().reservedBytes;
  assert.equal(f.batches.length, 1);
  f.batches[0]!.issue();
  assert.equal(f.batches.length, 2, "issue must dispatch without waiting for commit");
  f.enqueue(3);
  f.batches[0]!.issue();
  f.batches[1]!.issue();
  assert.equal(f.batches.length, 2);
  f.batches[1]!.commit.resolve();
  await turn();
  assert.equal(f.session.getTelemetry().persistedFrames, 0);
  assert.equal(f.session.getTelemetry().pendingFrames, 4);
  assert.ok(f.session.getTelemetry().reservedBytes > bytes);
  assert.equal(f.batches.length, 2, "a settled later batch cannot open a third slot yet");
  f.batches[0]!.commit.resolve();
  await turn();
  assert.equal(f.session.getTelemetry().persistedFrames, 3);
  assert.equal(f.session.getTelemetry().persistedTick, 2);
  assert.equal(f.session.getTelemetry().pendingFrames, 1);
  assert.deepEqual(
    f.batches.map((batch) => batch.frames.map((entry) => entry.tick)),
    [[0], [1, 2], [3]],
  );
  f.batches[2]!.commit.resolve();
  await f.session.flush();
  assert.equal(f.peak(), 2);
  assert.equal(f.session.getTelemetry().reservedBytes, 0);
  assert.equal(f.session.getTelemetry().persistedFrames, 4);
});

test("enqueue after issued can use the second slot; a legacy backend remains serial", async () => {
  for (const hook of [true, false]) {
    const f = fixture(hook);
    f.creation.resolve();
    f.enqueue(0);
    await turn();
    f.batches[0]!.issue();
    f.enqueue(1);
    await turn();
    assert.equal(f.batches.length, hook ? 2 : 1);
    f.batches[0]!.commit.resolve();
    await turn();
    assert.equal(f.batches.length, 2);
    f.batches[1]!.commit.resolve();
    await f.session.drain();
    assert.equal(f.peak(), hook ? 2 : 1);
  }
});

test("synchronous issued notifications reserve slots before reentry and a stale signal cannot restart a writer", async () => {
  const f = fixture(true, {}, { synchronousIssued: true });
  f.creation.resolve();
  f.enqueue(0);
  await turn();
  f.enqueue(1);
  f.enqueue(2);
  assert.equal(f.batches.length, 2);
  f.batches[0]!.commit.resolve();
  await turn();
  assert.equal(f.batches.length, 3);
  assert.equal(f.active(), 2);
  f.batches[1]!.commit.resolve();
  f.batches[2]!.commit.resolve();
  await f.session.flush();
  f.batches[0]!.issue();
  f.enqueue(3);
  await turn();
  assert.equal(f.batches.length, 4);
  f.batches[3]!.commit.resolve();
  await f.session.flush();
  assert.equal(f.peak(), 2);
  assert.deepEqual(
    f.batches.map((batch) => batch.frames.map((entry) => entry.tick)),
    [[0], [1], [2], [3]],
  );
});

test("the default eight-frame guard still counts both in-flight batches and the undispatched suffix", async () => {
  const f = fixture();
  f.creation.resolve();
  f.enqueue(0);
  await turn();
  f.enqueue(1);
  f.batches[0]!.issue();
  for (let tick = 2; tick < 8; tick++) f.enqueue(tick);
  assert.equal(f.batches.length, 2);
  assert.equal(f.session.getTelemetry().pendingFrames, 8);
  assert.equal(f.session.getTelemetry().backpressured, true);
  assert.throws(() => f.enqueue(8), { code: "RECORDING_STORAGE_BACKPRESSURE" });
  assert.equal(f.session.getTelemetry().acceptedFrames, 8);
  f.batches[0]!.commit.resolve();
  f.batches[1]!.commit.resolve();
  await assert.rejects(f.session.drain(), { code: "RECORDING_STORAGE_BACKPRESSURE" });
  assert.equal(f.batches.length, 2, "no suffix is dispatched after the guard failure");
  assert.equal(f.session.getTelemetry().persistedFrames, 2);
  assert.equal(f.session.getTelemetry().pendingFrames, 6);
});

test("flush also awaits an append started during the previous writer's final microtask", async () => {
  let queueSuffix = false;
  const f = fixture(
    true,
    {},
    {
      onChanged() {
        if (queueSuffix && f.session.getTelemetry().persistedFrames === 1) {
          queueSuffix = false;
          queueMicrotask(() => f.enqueue(1));
        }
      },
    },
  );
  f.creation.resolve();
  f.enqueue(0);
  await turn();
  let flushed = false;
  const flush = f.session.flush().then(() => {
    flushed = true;
  });
  queueSuffix = true;
  f.batches[0]!.commit.resolve();
  await turn();
  assert.equal(f.batches.length, 2);
  assert.equal(flushed, false);
  f.batches[1]!.commit.resolve();
  await flush;
  assert.equal(f.session.getTelemetry().persistedFrames, 2);
});

test("frame pressure and low water match serial accounting with in-flight frames still charged", async () => {
  const snapshots = [];
  for (const hook of [false, true]) {
    const f = fixture(hook);
    for (let tick = 0; tick < 6; tick++) f.enqueue(tick);
    f.creation.resolve();
    await turn();
    f.enqueue(6);
    f.enqueue(7);
    const full = f.session.getTelemetry();
    assert.equal(full.pendingFrames, 8);
    assert.equal(full.backpressured, true);
    assert.equal(f.pressures(), 1);
    f.batches[0]!.issue();
    f.batches[0]!.commit.resolve();
    await turn();
    const low = f.session.getTelemetry();
    assert.equal(low.pendingFrames, 2);
    assert.equal(low.backpressured, false);
    f.batches[1]!.commit.resolve();
    await f.session.flush();
    snapshots.push([full, low, f.session.getTelemetry()]);
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
});

test("byte pressure still starts at 0.75 and waits for both low-water limits", async () => {
  const sample = new ExperimentRecorder(options());
  sample.appendFrame(frame(0));
  const size = Buffer.byteLength(canonicalStringify(sample.getLastFrame()));
  for (const hook of [false, true]) {
    const f = fixture(hook, { maxBytes: size * 4, lowWaterBytes: size, lowWaterFrames: 2 });
    f.enqueue(0);
    f.creation.resolve();
    await turn();
    f.enqueue(1);
    assert.equal(f.session.getTelemetry().backpressured, false);
    f.enqueue(2);
    assert.equal(f.session.getTelemetry().backpressured, true);
    f.batches[0]!.issue();
    f.batches[0]!.commit.resolve();
    await turn();
    assert.equal(f.session.getTelemetry().pendingFrames, 2);
    assert.equal(f.session.getTelemetry().backpressured, true, "bytes remain above low water");
    f.batches[1]!.commit.resolve();
    await f.session.flush();
    assert.equal(f.session.getTelemetry().backpressured, false);
    assert.equal(f.pressures(), 1);
  }
});

test("first batch failure stops dispatch and later success cannot skip the failed prefix; flush waits for both", async () => {
  const f = fixture();
  f.creation.resolve();
  f.enqueue(0);
  await turn();
  f.enqueue(1);
  f.batches[0]!.issue();
  assert.equal(f.batches.length, 2);
  f.enqueue(2);
  const failure = new Error("first transaction aborted");
  let flushed = false;
  const flush = assert
    .rejects(f.session.flush(), (error) => error === failure)
    .then(() => {
      flushed = true;
    });
  f.batches[0]!.commit.reject(failure);
  await turn();
  assert.deepEqual(f.failures, [failure]);
  assert.equal(flushed, false);
  f.batches[1]!.issue();
  f.batches[1]!.commit.resolve();
  await flush;
  assert.equal(f.batches.length, 2);
  assert.equal(f.session.getTelemetry().persistedFrames, 0);
  assert.equal(f.session.getTelemetry().pendingFrames, 3);
  assert.equal(f.session.getTelemetry().publishedFrames, 0);
  await assert.rejects(f.session.publish(await f.recorder.finish()), (error) => error === failure);
  assert.equal(f.publications(), 0);
});

test("an early later-batch rejection stops dispatch immediately but preserves only the successful prefix", async () => {
  const f = fixture();
  f.creation.resolve();
  f.enqueue(0);
  await turn();
  f.enqueue(1);
  f.batches[0]!.issue();
  assert.equal(f.batches.length, 2);
  f.enqueue(2);
  const failure = new Error("second transaction failed early");
  f.batches[1]!.commit.reject(failure);
  await turn();
  assert.deepEqual(f.failures, [failure]);
  assert.throws(
    () => f.enqueue(3),
    (error) => error === failure,
  );
  f.batches[0]!.commit.resolve();
  await assert.rejects(f.session.drain(), (error) => error === failure);
  assert.equal(f.batches.length, 2);
  assert.equal(f.session.getTelemetry().persistedFrames, 1);
  assert.equal(f.session.getTelemetry().persistedTick, 0);
});

test("cancel waits for both issued batches and retains definitive successful commit accounting", async () => {
  const f = fixture();
  f.creation.resolve();
  f.enqueue(0);
  await turn();
  f.enqueue(1);
  f.batches[0]!.issue();
  assert.equal(f.batches.length, 2);
  let cancelled = false;
  const cancel = f.session.cancel("USER_CANCELLED").then(() => {
    cancelled = true;
  });
  f.batches[0]!.commit.resolve();
  await turn();
  assert.equal(cancelled, false);
  assert.equal(f.active(), 1);
  f.batches[1]!.commit.resolve();
  await cancel;
  assert.equal(f.session.getTelemetry().persistedFrames, 2);
  assert.equal(f.session.getTelemetry().pendingFrames, 0);
  assert.equal(f.session.getTelemetry().reservedBytes, 0);
  assert.equal(f.session.getTelemetry().publishedFrames, 0);
});

test("publication waits for every in-flight completion, including an out-of-order acknowledgement", async () => {
  const f = fixture();
  f.creation.resolve();
  f.enqueue(0);
  await turn();
  f.enqueue(1);
  f.batches[0]!.issue();
  assert.equal(f.batches.length, 2);
  const publishing = f.session.publish(await f.recorder.finish());
  f.batches[1]!.commit.resolve();
  await turn();
  assert.equal(f.publications(), 0);
  assert.equal(f.session.getTelemetry().publishedFrames, 0);
  f.batches[0]!.commit.resolve();
  await publishing;
  assert.equal(f.publications(), 1);
  assert.equal(f.session.getTelemetry().publishedFrames, 2);
});

test("overlapping diagnostics remain bound to their batch, including reused last-two slots", async () => {
  const f = fixture();
  f.creation.resolve();
  for (let pair = 0; pair < 6; pair++) {
    f.enqueue(pair * 2);
    await turn();
    const first = f.batches[pair * 2]!;
    f.enqueue(pair * 2 + 1);
    first.issue();
    assert.equal(f.batches.length, pair * 2 + 2);
    const second = f.batches[pair * 2 + 1]!;
    first.observer!.mark("oncompleteAtMs", 100 + pair * 2);
    second.observer!.mark("oncompleteAtMs", 101 + pair * 2);
    second.commit.resolve();
    await turn();
    const pending = f.session.getCommitDiagnostics().storage;
    assert.equal(pending.last[0]!.completed, null);
    assert.equal(pending.last[1]!.completed, true);
    first.commit.resolve();
    await f.session.flush();
  }
  // A stale observer cannot corrupt a slot reused by a newer batch.
  f.batches[8]!.observer!.mark("oncompleteAtMs", 999);
  const rows = f.session.getCommitDiagnostics().storage;
  assert.equal(rows.count, 12);
  assert.deepEqual(
    rows.first.map((row) => row.sequence),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.deepEqual(
    rows.last.map((row) => row.sequence),
    [11, 12],
  );
  for (const row of [...rows.first, ...rows.last]) {
    assert.equal(row.oncompleteAtMs, 99 + row.sequence);
    assert.equal(row.firstTick, row.sequence - 1);
    assert.equal(row.inFlightAtStart, row.sequence % 2 === 1 ? 0 : 1);
    assert.equal(row.completed, true);
  }
});
