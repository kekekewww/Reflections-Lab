import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  IndexedDBRenderOutputStore,
  MemoryRenderOutputDatabase,
  MemoryRenderOutputStore,
  RENDER_OUTPUT_MAX_JOB_BYTES,
} from "../../src/audio/render-output-store.js";

const bytes = (...values: number[]): Uint8Array<ArrayBuffer> => new Uint8Array(values);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const options = { maxMaterializedBytes: 6 };
async function fixture() {
  const database = new MemoryRenderOutputDatabase();
  const store = new MemoryRenderOutputStore({ database });
  await store.begin("job", 6, ["mix", "stem"]);
  for (const [id, value] of [
    ["mix", bytes(1, 2, 3)],
    ["stem", bytes(4, 5, 6)],
  ] as const) {
    await store.append("job", id, 0, value.subarray(0, 1));
    await store.append("job", id, 1, value.subarray(1));
    await store.sealOutput("job", id, 3, hash(value));
  }
  await store.publish("job", '{"note":"完整"}');
  return { database, store };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

class PausedStore extends MemoryRenderOutputStore {
  reached = deferred();
  resume = deferred();
  stage: "capture" | "authority" = "capture";
  protected override async captureSnapshot(jobId: string, maximum: number, signal?: AbortSignal) {
    const result = await super.captureSnapshot(jobId, maximum, signal);
    if (this.stage === "capture") {
      this.reached.resolve();
      await this.resume.promise;
    }
    return result;
  }
  protected override async verifySnapshotAuthority(
    ...args: Parameters<MemoryRenderOutputStore["verifySnapshotAuthority"]>
  ) {
    await super.verifySnapshotAuthority(...args);
    if (this.stage === "authority") {
      this.reached.resolve();
      await this.resume.promise;
    }
  }
}

test("a whole-job snapshot owns immutable bytes, frozen metadata and exact Unicode manifest", async () => {
  const { database, store } = await fixture();
  const snapshot = await store.readVerifiedJobSnapshot("job", options);
  assert.ok(snapshot);
  assert.equal(snapshot.kind, "verified-historical-render-job-v1");
  assert.equal(snapshot.encodedBytes, 6);
  assert.equal(snapshot.manifestJson, '{"note":"完整"}');
  assert.equal(
    snapshot.pins.manifestBytes,
    new TextEncoder().encode(snapshot.manifestJson!).byteLength,
  );
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.pins));
  assert.ok(Object.isFrozen(snapshot.outputs) && Object.isFrozen(snapshot.pins.outputs));
  for (const output of snapshot.outputs) assert.ok(Object.isFrozen(output));
  database.chunks.values().next().value!.bytes.fill(99);
  assert.deepEqual(new Uint8Array(await snapshot.outputs[0]!.blob.arrayBuffer()), bytes(1, 2, 3));
  await assert.rejects(() => store.readBlob("job", "mix"), /SHA-256/);
  await store.deletePublishedJob("job");
  assert.equal(await store.readBlob("job", "mix"), null);
  assert.equal(await store.readVerifiedJobSnapshot("job", options), null);
  assert.deepEqual(new Uint8Array(await snapshot.outputs[1]!.blob.arrayBuffer()), bytes(4, 5, 6));
});

for (const mutation of ["unselected-content", "gap", "extra", "metadata", "manifest"] as const) {
  test(`whole-job snapshot rejects ${mutation} corruption without partial delivery`, async () => {
    const { database, store } = await fixture();
    if (mutation === "unselected-content") {
      [...database.chunks.values()].find((chunk) => chunk.outputId === "stem")!.bytes[0] = 99;
    } else if (mutation === "gap") {
      const entry = [...database.chunks.entries()].find(
        ([, chunk]) => chunk.outputId === "stem" && chunk.index === 0,
      )!;
      database.chunks.delete(entry[0]);
    } else if (mutation === "extra") {
      database.chunks.set("extra", { jobId: "job", outputId: "alien", index: 0, bytes: bytes(9) });
    } else if (mutation === "metadata") {
      database.jobs.get("job")!.outputs[0]!.bytes = 2;
    } else {
      database.manifests.set("job", '{"note":"损坏"}');
    }
    await assert.rejects(() => store.readVerifiedJobSnapshot("job", options), {
      code: "RENDER_STORE_INTEGRITY",
    });
    assert.equal(
      database.jobs.get("job")!.status,
      "published",
      "reading never rewrites archive state",
    );
  });
}

test("snapshot materialization uses its exact per-call admission without changing original job caps", async () => {
  const { store } = await fixture();
  assert.equal((await store.readVerifiedJobSnapshot("job", options))!.encodedBytes, 6);
  await assert.rejects(() => store.readVerifiedJobSnapshot("job", { maxMaterializedBytes: 5 }), {
    code: "RENDER_STORE_SNAPSHOT_CAP",
  });
  for (const maximum of [0, -1, 1.5, NaN, RENDER_OUTPUT_MAX_JOB_BYTES + 1]) {
    await assert.rejects(
      () => store.readVerifiedJobSnapshot("job", { maxMaterializedBytes: maximum }),
      { code: "RENDER_STORE_PLAN" },
    );
  }
  assert.ok(await store.readBlob("job", "mix"));
  assert.equal(RENDER_OUTPUT_MAX_JOB_BYTES, 192 * 1024 * 1024);
});

test("missing or incomplete jobs stay private, and a no-manifest publication snapshots null", async () => {
  const store = new MemoryRenderOutputStore();
  assert.equal(await store.readVerifiedJobSnapshot("missing", options), null);
  await store.begin("job", 6);
  await store.append("job", "mix", 0, bytes(1));
  assert.equal(await store.readVerifiedJobSnapshot("job", options), null);
  await store.sealOutput("job", "mix", 1, hash(bytes(1)));
  await store.publish("job");
  assert.equal((await store.readVerifiedJobSnapshot("job", options))!.manifestJson, null);
});

for (const stage of ["capture", "authority"] as const) {
  for (const action of ["cancel", "dispose"] as const) {
    test(`${action} after ${stage} awaits prevents late snapshot delivery`, async () => {
      const { database } = await fixture();
      const store = new PausedStore({ database });
      store.stage = stage;
      const controller = new AbortController();
      const read = store.readVerifiedJobSnapshot("job", { ...options, signal: controller.signal });
      await store.reached.promise;
      if (action === "cancel") controller.abort();
      else store.dispose();
      store.resume.resolve();
      await assert.rejects(read, {
        code: action === "cancel" ? "RENDER_CANCELLED" : "RENDER_STORE_DISPOSED",
      });
      assert.equal(database.jobs.get("job")!.status, "published");
    });
  }
}

for (const action of ["delete", "replace-pins", "replace-manifest", "same-pins-aba"] as const) {
  test(`fresh authority handles ${action} after a verified data transaction`, async () => {
    const { database, store: writer } = await fixture();
    const reader = new PausedStore({ database });
    const read = reader.readVerifiedJobSnapshot("job", options);
    await reader.reached.promise;
    if (action === "delete" || action === "same-pins-aba") {
      const job = structuredClone(database.jobs.get("job")!);
      const chunks = structuredClone([...database.chunks.entries()]);
      const manifest = database.manifests.get("job")!;
      await writer.deletePublishedJob("job");
      if (action === "same-pins-aba") {
        database.jobs.set("job", job);
        for (const [key, value] of chunks) database.chunks.set(key, value);
        database.manifests.set("job", manifest);
      }
    } else if (action === "replace-pins") {
      database.jobs.get("job")!.maxBytes = 7;
    } else {
      database.manifests.set("job", '{"note":"更改"}');
    }
    reader.resume.resolve();
    if (action === "same-pins-aba") {
      assert.deepEqual(
        new Uint8Array(await (await read)!.outputs[0]!.blob.arrayBuffer()),
        bytes(1, 2, 3),
      );
    } else await assert.rejects(read, { code: "RENDER_STORE_SNAPSHOT_CHANGED" });
  });
}

/** Controlled request/transaction boundaries, not a claim of real browser IDB coverage. */
function controlledNative(database: MemoryRenderOutputDatabase) {
  let transactions = 0;
  let cursorRows = 0;
  let beforeComplete: ((index: number, transaction: IDBTransaction) => void) | undefined;
  let beforeOpen: (() => void) | undefined;
  let beforeRow: (() => void) | undefined;
  let beforeGet: ((index: number, name: string) => void) | undefined;
  const holds = new Map<
    number,
    { reached: ReturnType<typeof deferred>; resume: ReturnType<typeof deferred> }
  >();
  const factory = {
    open() {
      const request: Record<string, unknown> = {};
      queueMicrotask(() => {
        beforeOpen?.();
        request.result = {
          close() {},
          transaction(scope: string[], mode: string) {
            assert.deepEqual(scope, ["jobs", "chunks", "manifests"]);
            assert.equal(mode, "readonly");
            const index = ++transactions;
            const jobs = structuredClone(database.jobs);
            const chunks = structuredClone([...database.chunks.values()]);
            const manifests = structuredClone(database.manifests);
            let pending = 0,
              ended = false,
              completeQueued = false;
            const transaction: Record<string, unknown> = {
              error: null,
              abort() {
                if (ended) throw new Error("already ended");
                ended = true;
                queueMicrotask(() => (transaction.onabort as (() => void) | undefined)?.());
              },
              objectStore(name: string) {
                return {
                  get(key: string) {
                    beforeGet?.(index, name);
                    return requestFor(() =>
                      name === "jobs"
                        ? structuredClone(jobs.get(key))
                        : manifests.has(key)
                          ? { jobId: key, json: manifests.get(key) }
                          : undefined,
                    );
                  },
                  index() {
                    return {
                      openCursor(jobId: string) {
                        const rows = chunks
                          .filter((row) => row.jobId === jobId)
                          .sort(
                            (a, b) => a.outputId.localeCompare(b.outputId) || a.index - b.index,
                          );
                        let position = 0;
                        const cursorRequest: Record<string, unknown> = {};
                        const advance = () => {
                          pending++;
                          queueMicrotask(() => {
                            if (ended) return;
                            const value = rows[position++];
                            cursorRequest.result = value
                              ? { value: structuredClone(value), continue: advance }
                              : null;
                            if (value) {
                              beforeRow?.();
                              if (ended) return;
                              cursorRows++;
                            }
                            (cursorRequest.onsuccess as (() => void) | undefined)?.();
                            pending--;
                            scheduleComplete();
                          });
                        };
                        advance();
                        return cursorRequest;
                      },
                    };
                  },
                };
              },
            };
            function scheduleComplete() {
              if (pending !== 0 || ended || completeQueued) return;
              completeQueued = true;
              queueMicrotask(() => {
                completeQueued = false;
                if (pending !== 0 || ended) return;
                const hold = holds.get(index);
                if (hold) {
                  holds.delete(index);
                  hold.reached.resolve();
                  void hold.resume.promise.then(() => {
                    if (ended) return;
                    beforeComplete?.(index, transaction as unknown as IDBTransaction);
                    if (ended) return;
                    ended = true;
                    (transaction.oncomplete as (() => void) | undefined)?.();
                  });
                  return;
                }
                beforeComplete?.(index, transaction as unknown as IDBTransaction);
                if (ended) return;
                ended = true;
                (transaction.oncomplete as (() => void) | undefined)?.();
              });
            }
            function requestFor(value: () => unknown) {
              const request: Record<string, unknown> = {};
              pending++;
              queueMicrotask(() => {
                if (ended) return;
                request.result = value();
                (request.onsuccess as (() => void) | undefined)?.();
                pending--;
                scheduleComplete();
              });
              return request;
            }
            return transaction;
          },
        };
        (request.onsuccess as (() => void) | undefined)?.();
      });
      return request;
    },
  } as unknown as IDBFactory;
  return {
    factory,
    get transactions() {
      return transactions;
    },
    get cursorRows() {
      return cursorRows;
    },
    setBeforeComplete(value: typeof beforeComplete) {
      beforeComplete = value;
    },
    setBeforeOpen(value: typeof beforeOpen) {
      beforeOpen = value;
    },
    setBeforeGet(value: typeof beforeGet) {
      beforeGet = value;
    },
    setBeforeRow(value: typeof beforeRow) {
      beforeRow = value;
    },
    holdComplete(index: number) {
      const hold = { reached: deferred(), resume: deferred() };
      holds.set(index, hold);
      return hold;
    },
  };
}

test("native snapshot traverses the full job once, then checks fresh pins in a separate completed transaction", async () => {
  const { database } = await fixture();
  const control = controlledNative(database);
  const store = new IndexedDBRenderOutputStore({ factory: control.factory, locks: null });
  const snapshot = await store.readVerifiedJobSnapshot("job", options);
  assert.equal(control.cursorRows, 4);
  assert.equal(control.transactions, 2);
  assert.deepEqual(new Uint8Array(await snapshot!.outputs[1]!.blob.arrayBuffer()), bytes(4, 5, 6));
  for (let pair = 0; pair < 6; pair++) {
    const left = new Uint8Array(await snapshot!.outputs[0]!.blob.arrayBuffer());
    const right = new Uint8Array(await snapshot!.outputs[1]!.blob.arrayBuffer());
    assert.equal(hash(left), snapshot!.outputs[0]!.sha256);
    assert.equal(hash(right), snapshot!.outputs[1]!.sha256);
  }
  assert.equal(
    control.cursorRows,
    4,
    "reusing immutable historical Blobs never silently rereads storage",
  );
});

for (const boundary of ["audit", "authority"] as const) {
  test(`last ${boundary} request success is not transaction completion`, async () => {
    const { database } = await fixture();
    const control = controlledNative(database);
    control.setBeforeComplete((index, transaction) => {
      if (index === (boundary === "audit" ? 1 : 2)) transaction.abort();
    });
    const store = new IndexedDBRenderOutputStore({ factory: control.factory, locks: null });
    await assert.rejects(() => store.readVerifiedJobSnapshot("job", options), /aborted/);
    assert.equal(control.cursorRows, 4);
  });
}

for (const boundary of ["open", "cursor", "audit", "authority"] as const) {
  for (const action of ["cancel", "dispose"] as const) {
    test(`native ${action} at ${boundary} rejects all delivery`, async () => {
      const { database } = await fixture();
      const control = controlledNative(database);
      const controller = new AbortController();
      const store = new IndexedDBRenderOutputStore({ factory: control.factory, locks: null });
      const stop = () => {
        if (action === "cancel") controller.abort();
        else store.dispose();
      };
      if (boundary === "open") control.setBeforeOpen(stop);
      else if (boundary === "cursor") control.setBeforeRow(stop);
      else
        control.setBeforeComplete((index) => {
          if (index === (boundary === "audit" ? 1 : 2)) stop();
        });
      await assert.rejects(
        () => store.readVerifiedJobSnapshot("job", { ...options, signal: controller.signal }),
        (error: unknown) => {
          const code = (error as { code?: string }).code;
          return (
            code === (action === "cancel" ? "RENDER_CANCELLED" : "RENDER_STORE_DISPOSED") ||
            code === "RENDER_STORE_TRANSACTION"
          );
        },
      );
    });
  }
}

test("caller mutation cannot replace the cancellation signal while a verified read awaits", async () => {
  const { database } = await fixture();
  const store = new PausedStore({ database });
  store.stage = "authority";
  const controller = new AbortController();
  const mutable = { ...options, signal: controller.signal };
  const read = store.readVerifiedJobSnapshot("job", mutable);
  await store.reached.promise;
  mutable.signal = new AbortController().signal;
  controller.abort();
  store.resume.resolve();
  await assert.rejects(read, { code: "RENDER_CANCELLED" });
});

test("neither verified cursor EOF nor successful final guard delivers before its transaction completes", async () => {
  const { database } = await fixture();
  const control = controlledNative(database);
  const audit = control.holdComplete(1);
  const authority = control.holdComplete(2);
  const store = new IndexedDBRenderOutputStore({ factory: control.factory, locks: null });
  let delivered = false;
  const read = store.readVerifiedJobSnapshot("job", options).then((value) => {
    delivered = true;
    return value;
  });
  await audit.reached.promise;
  await Promise.resolve();
  assert.equal(control.cursorRows, 4);
  assert.equal(delivered, false);
  assert.equal(control.transactions, 1);
  audit.resume.resolve();
  await authority.reached.promise;
  await Promise.resolve();
  assert.equal(delivered, false);
  authority.resume.resolve();
  assert.ok(await read);
});

test("native final authority rejects cross-instance metadata changes after the complete verified snapshot", async () => {
  const { database } = await fixture();
  const control = controlledNative(database);
  control.setBeforeComplete((index) => {
    if (index === 1) database.jobs.get("job")!.reservationBytes = 5;
  });
  const store = new IndexedDBRenderOutputStore({ factory: control.factory, locks: null });
  await assert.rejects(() => store.readVerifiedJobSnapshot("job", options), {
    code: "RENDER_STORE_SNAPSHOT_CHANGED",
  });
  assert.equal(control.cursorRows, 4);
  assert.equal(
    database.jobs.get("job")!.reservationBytes,
    5,
    "read does not rewrite the changed row",
  );
});

test("native materialization rejects one byte over its allowance before reading any payload chunk", async () => {
  const { database } = await fixture();
  const control = controlledNative(database);
  const store = new IndexedDBRenderOutputStore({ factory: control.factory, locks: null });
  await assert.rejects(() => store.readVerifiedJobSnapshot("job", { maxMaterializedBytes: 5 }), {
    code: "RENDER_STORE_SNAPSHOT_CAP",
  });
  assert.equal(control.cursorRows, 0);
  assert.equal(control.transactions, 1);
});

test("a bounded manifest decode rejects excess multibyte data without changing publication", async () => {
  const { database, store } = await fixture();
  database.manifests.set("job", "全".repeat(2048));
  database.jobs.get("job")!.manifestBytes = 2048;
  await assert.rejects(() => store.readVerifiedJobSnapshot("job", options), {
    code: "RENDER_STORE_INTEGRITY",
  });
  assert.equal(database.jobs.get("job")!.status, "published");
});

test(
  "native final authority synchronous request failure rejects instead of leaving delivery pending",
  { timeout: 1000 },
  async () => {
    const { database } = await fixture();
    const control = controlledNative(database);
    const failure = new Error("injected final manifest request failure");
    control.setBeforeGet((index, name) => {
      if (index === 2 && name === "manifests") throw failure;
    });
    const store = new IndexedDBRenderOutputStore({ factory: control.factory, locks: null });
    await assert.rejects(
      () => store.readVerifiedJobSnapshot("job", options),
      (error) => error === failure,
    );
    assert.equal(database.jobs.get("job")!.status, "published");
  },
);

test("snapshot metadata rejects a truthy nonboolean seal state", async () => {
  const { database, store } = await fixture();
  Object.assign(database.jobs.get("job")!.outputs[0]!, { sealed: "yes" });
  await assert.rejects(() => store.readVerifiedJobSnapshot("job", options), {
    code: "RENDER_STORE_INTEGRITY",
  });
});

test("final authority does not normalize a changed seal state into verified pins", async () => {
  const { database } = await fixture();
  const reader = new PausedStore({ database });
  const read = reader.readVerifiedJobSnapshot("job", options);
  await reader.reached.promise;
  Object.assign(database.jobs.get("job")!.outputs[0]!, { sealed: "yes" });
  reader.resume.resolve();
  await assert.rejects(read, { code: "RENDER_STORE_SNAPSHOT_CHANGED" });
});
