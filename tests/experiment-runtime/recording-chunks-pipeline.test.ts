import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { canonicalStringify } from "../../src/experiments/hash.js";
import { ExperimentRecorder, type RecordingSealSnapshot } from "../../src/experiments/recorder.js";
import type {
  EncodedRecordingFrame,
  RecordingAppendOptions,
} from "../../src/experiments/recording-persistence.js";
import type { RecordingCommitObserver } from "../../src/experiments/recording-commit-diagnostics.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { frame, options } from "./worker-fixture.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
type StorageSeam = {
  open(): Promise<IDBDatabase>;
  createRecordingSession(id: string, snapshot: RecordingSealSnapshot): Promise<void>;
  interruptRecordingSession(id: string, reason: string): Promise<void>;
  appendRecordingChunks(
    id: string,
    frames: readonly EncodedRecordingFrame[],
    observer?: RecordingCommitObserver,
    options?: RecordingAppendOptions,
  ): Promise<void>;
};

function inputs() {
  const recorder = new ExperimentRecorder(options());
  const snapshot = recorder.captureSealSnapshot();
  const frames = [0, 1, 2].map((tick) => {
    recorder.appendFrame(frame(tick));
    return {
      sequence: tick,
      tick,
      bytes: new TextEncoder().encode(canonicalStringify(recorder.getLastFrame())).buffer,
    };
  });
  return { snapshot, frames };
}

/** IDB event seam only: real hashing, validation and transaction work run unchanged.
 * Reads execute after earlier overlapping transactions commit/abort, independently
 * of when the main thread receives their oncomplete event.
 */
function orderedDatabase(snapshot: RecordingSealSnapshot) {
  const data = new Map<string, Map<unknown, unknown>>([
    [
      "recordingSessions",
      new Map([
        [
          "session.pipeline",
          {
            sessionId: "session.pipeline",
            runId: snapshot.runId,
            runEpoch: snapshot.runEpoch,
            sceneRevision: 2,
            state: "staging",
            persistedFrames: 0,
            persistedTick: null,
            reservedBytes: 0,
            chunks: [],
            snapshot,
          },
        ],
      ]),
    ],
    ["recordingChunks", new Map()],
    ["recordings", new Map()],
    ["state", new Map([["recordingStagingBytes", 0]])],
  ]);
  function transaction() {
    const reads: { store: string; key: unknown; result?: unknown; onsuccess?: () => void }[] = [];
    const writes: { store: string; key: unknown; value: unknown }[] = [];
    const tx = {
      reads,
      writes,
      finished: false,
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
      objectStore(store: string) {
        return {
          get(key: unknown) {
            const request = { store, key };
            reads.push(request);
            return request;
          },
          add(value: { sessionId: string; sequence: number }) {
            writes.push({
              store,
              key: `${value.sessionId}:${value.sequence}`,
              value: structuredClone(value),
            });
          },
          put(value: { sessionId?: string }, key?: unknown) {
            writes.push({ store, key: key ?? value.sessionId, value: structuredClone(value) });
          },
        };
      },
      start() {
        assert.ok(
          transactions.slice(0, transactions.indexOf(tx)).every((earlier) => earlier.finished),
        );
        assert.equal(reads.length, 3, "append still uses the same three reads");
        for (const read of reads) {
          read.result = structuredClone(data.get(read.store)!.get(read.key));
          read.onsuccess!();
        }
      },
      commit() {
        assert.equal(tx.finished, false);
        for (const write of writes) data.get(write.store)!.set(write.key, write.value);
        tx.finished = true;
      },
      abort() {
        assert.equal(tx.finished, false);
        tx.finished = true;
        queueMicrotask(() => tx.onabort?.());
      },
    };
    return tx;
  }
  const transactions: ReturnType<typeof transaction>[] = [];
  const arrivals = new Map<number, (tx: ReturnType<typeof transaction>) => void>();
  const waitForTransaction = (index: number): Promise<ReturnType<typeof transaction>> => {
    if (transactions[index]) return Promise.resolve(transactions[index]!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        arrivals.delete(index);
        reject(new Error(`Transaction ${index} was not created`));
      }, 10000);
      arrivals.set(index, (tx) => {
        clearTimeout(timer);
        resolve(tx);
      });
    });
  };
  const database = {
    transaction(stores: string[], mode: string) {
      assert.deepEqual(stores, ["recordingSessions", "recordingChunks", "recordings", "state"]);
      assert.equal(mode, "readwrite");
      const tx = transaction();
      transactions.push(tx);
      arrivals.get(transactions.length - 1)?.(tx);
      arrivals.delete(transactions.length - 1);
      return tx;
    },
  } as unknown as IDBDatabase;
  return { database, transactions, data, waitForTransaction };
}

test("real IDB appends overlap before oncomplete and persist contiguous original bytes and SHA-256 values", async () => {
  const { snapshot, frames } = inputs();
  const fake = orderedDatabase(snapshot);
  const store = new BlobStore({ indexedDB: {} as IDBFactory });
  const backend = store as unknown as StorageSeam;
  backend.open = async () => fake.database;
  let second: Promise<void> | undefined;
  const first = backend.appendRecordingChunks("session.pipeline", frames.slice(0, 1), undefined, {
    onIssued: () => {
      second = backend.appendRecordingChunks("session.pipeline", frames.slice(1));
    },
  });
  await fake.waitForTransaction(0);
  fake.transactions[0]!.start();
  await fake.waitForTransaction(1);
  assert.equal(fake.transactions[0]!.finished, false);
  assert.equal(fake.transactions[1]!.writes.length, 0);
  fake.transactions[0]!.commit();
  fake.transactions[1]!.start();
  fake.transactions[1]!.commit();
  fake.transactions[1]!.oncomplete!();
  await second;
  fake.transactions[0]!.oncomplete!();
  await first;
  const session = fake.data.get("recordingSessions")!.get("session.pipeline") as {
    persistedFrames: number;
    persistedTick: number;
    chunks: { sequence: number; tick: number }[];
  };
  assert.equal(session.persistedFrames, 3);
  assert.equal(session.persistedTick, 2);
  assert.deepEqual(
    session.chunks.map((chunk) => [chunk.sequence, chunk.tick]),
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
  );
  for (const frame of frames) {
    const stored = fake.data.get("recordingChunks")!.get(`session.pipeline:${frame.sequence}`) as {
      bytes: ArrayBuffer;
      sha256: string;
    };
    assert.deepEqual(stored.bytes, frame.bytes);
    assert.equal(
      stored.sha256,
      createHash("sha256").update(Buffer.from(frame.bytes)).digest("hex"),
    );
  }
});

test("aborting an issued first IDB append makes the queued second append fail closed on existing chunk order", async () => {
  const { snapshot, frames } = inputs();
  const fake = orderedDatabase(snapshot);
  const backend = new BlobStore({ indexedDB: {} as IDBFactory }) as unknown as StorageSeam;
  backend.open = async () => fake.database;
  let second: Promise<void> | undefined;
  let secondIssued = 0;
  const first = backend.appendRecordingChunks("session.pipeline", frames.slice(0, 1), undefined, {
    onIssued: () => {
      second = assert.rejects(
        backend.appendRecordingChunks("session.pipeline", frames.slice(1), undefined, {
          onIssued: () => {
            secondIssued++;
          },
        }),
        { code: "BLOB_CHUNK_ORDER" },
      );
    },
  });
  const firstRejected = assert.rejects(first, { code: "BLOB_STORAGE_WRITE" });
  await fake.waitForTransaction(0);
  fake.transactions[0]!.start();
  await fake.waitForTransaction(1);
  fake.transactions[0]!.abort();
  fake.transactions[1]!.start();
  await firstRejected;
  await second;
  assert.equal(secondIssued, 0);
  assert.equal(fake.transactions[1]!.writes.length, 0);
  assert.equal(fake.data.get("recordingChunks")!.size, 0);
});

test("throwing onIssued is called once after IDB writes and cannot abort a valid transaction", async () => {
  const { snapshot, frames } = inputs();
  const fake = orderedDatabase(snapshot);
  const backend = new BlobStore({ indexedDB: {} as IDBFactory }) as unknown as StorageSeam;
  backend.open = async () => fake.database;
  let issued = 0,
    complete = false,
    writesAtIssue = 0;
  const writing = backend
    .appendRecordingChunks("session.pipeline", frames, undefined, {
      onIssued: () => {
        issued++;
        writesAtIssue = fake.transactions[0]!.writes.length;
        throw new Error("notification failure");
      },
    })
    .then(() => {
      complete = true;
    });
  await fake.waitForTransaction(0);
  fake.transactions[0]!.start();
  assert.equal(issued, 1);
  assert.equal(writesAtIssue, 5);
  await turn();
  assert.equal(complete, false);
  assert.equal(fake.transactions[0]!.finished, false);
  fake.transactions[0]!.commit();
  fake.transactions[0]!.oncomplete!();
  await writing;
  assert.equal(issued, 1);
});

test("a refused identity path never calls onIssued in either storage mode", async () => {
  for (const mode of ["memory", "indexeddb"] as const) {
    const { snapshot, frames } = inputs();
    const fake = orderedDatabase(snapshot);
    const backend = new BlobStore({
      indexedDB: mode === "memory" ? null : ({} as IDBFactory),
    }) as unknown as StorageSeam;
    if (mode === "memory") await backend.createRecordingSession("session.pipeline", snapshot);
    else backend.open = async () => fake.database;
    const invalid = structuredClone(frames[0]!);
    const parsed = JSON.parse(new TextDecoder().decode(invalid.bytes));
    parsed.runEpoch = "epoch.foreign";
    invalid.bytes = new TextEncoder().encode(canonicalStringify(parsed)).buffer;
    let issued = 0;
    const writing = assert.rejects(
      backend.appendRecordingChunks("session.pipeline", [invalid], undefined, {
        onIssued: () => {
          issued++;
        },
      }),
      { code: "BLOB_CHUNK_IDENTITY" },
    );
    if (mode === "indexeddb") {
      await fake.waitForTransaction(0);
      fake.transactions[0]!.start();
    }
    await writing;
    assert.equal(issued, 0);
  }
});

test("memory onIssued observes synchronous writes once, tolerates throws and permits the next contiguous append", async () => {
  const { snapshot, frames } = inputs();
  const store = new BlobStore({ indexedDB: null });
  const backend = store as unknown as StorageSeam;
  await backend.createRecordingSession("session.pipeline", snapshot);
  let issued = 0,
    second: Promise<void> | undefined;
  await backend.appendRecordingChunks("session.pipeline", frames.slice(0, 1), undefined, {
    onIssued: () => {
      issued++;
      second = backend.appendRecordingChunks("session.pipeline", frames.slice(1));
      throw new Error("notification failure");
    },
  });
  assert.equal(issued, 1);
  await second;
  const [recovery] = await store.listRecordingRecovery();
  assert.equal(recovery!.persistedFrames, 3);
  await backend.interruptRecordingSession("session.pipeline", "TEST_RECOVERY");
  const artifact = await store.recoverRecording("session.pipeline");
  assert.deepEqual(
    artifact.frames.map((entry) => entry.tick),
    [0, 1, 2],
  );
  store.close();
});
