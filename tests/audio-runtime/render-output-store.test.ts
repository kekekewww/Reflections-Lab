import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  IndexedDBRenderOutputStore,
  MemoryRenderOutputDatabase,
  MemoryRenderOutputStore,
  RENDER_OUTPUT_MAX_CHUNKS,
  RENDER_OUTPUT_MAX_JOB_BYTES,
  RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
  RENDER_OUTPUT_MAX_JOBS,
} from "../../src/audio/render-output-store.js";

const hash = (...values: number[]): string =>
  createHash("sha256").update(new Uint8Array(values)).digest("hex");
const bytes = (...values: number[]): Uint8Array<ArrayBuffer> => new Uint8Array(values);

test("chunk output remains private until every expected output is sealed and published", async () => {
  const store = new MemoryRenderOutputStore();
  await store.begin("job", 8, ["mix", "stem"]);
  await store.append("job", "mix", 0, bytes(1, 2));
  assert.equal(await store.readBlob("job", "mix"), null);
  await store.sealOutput("job", "mix", 2, hash(1, 2));
  await assert.rejects(() => store.publish("job"), /expected output/);
  await store.append("job", "stem", 0, bytes(3, 4));
  await store.sealOutput("job", "stem", 2, hash(3, 4));
  await store.publish("job");
  assert.deepEqual(
    new Uint8Array(await (await store.readBlob("job", "mix"))!.arrayBuffer()),
    bytes(1, 2),
  );
  assert.equal((await store.getSnapshot("job"))!.bytes, 4);
  await store.abort("job");
  assert.ok(await store.readBlob("job", "mix"), "abort preserves already valid published work");
  await store.deletePublishedJob("job");
  assert.equal(await store.readBlob("job", "mix"), null);
});

test("append owns caller bytes, enforces sequence and exact inclusive byte cap atomically", async () => {
  const store = new MemoryRenderOutputStore();
  await store.begin("job", 4);
  const input = bytes(1, 2);
  const write = store.append("job", "mix", 0, input);
  input.fill(99);
  await write;
  await assert.rejects(() => store.append("job", "mix", 2, bytes(3)), /sequence/);
  await store.append("job", "mix", 1, bytes(3, 4));
  await assert.rejects(() => store.append("job", "mix", 2, bytes(5)), /byte cap/);
  assert.deepEqual(await store.getSnapshot("job"), {
    jobId: "job",
    status: "writing",
    bytes: 4,
    chunks: 2,
    outputs: 1,
  });
  await assert.rejects(() => store.sealOutput("job", "mix", 3, hash(1, 2, 3)), /byte count/);
  await store.sealOutput("job", "mix", 4, hash(1, 2, 3, 4));
  await assert.rejects(() => store.append("job", "mix", 2, bytes(5)), /sealed/);
  await store.publish("job");
  assert.deepEqual(
    new Uint8Array(await (await store.readBlob("job", "mix"))!.arrayBuffer()),
    bytes(1, 2, 3, 4),
  );
});

test("failed chunk transaction changes neither persisted bytes nor sequence", async () => {
  let fail = true;
  const store = new MemoryRenderOutputStore({
    beforeCommit: (operation) => {
      if (operation === "append" && fail) throw new Error("injected quota failure");
    },
  });
  await store.begin("job", 4);
  await assert.rejects(() => store.append("job", "mix", 0, bytes(1, 2)), /quota/);
  assert.equal((await store.getSnapshot("job"))!.bytes, 0);
  fail = false;
  await store.append("job", "mix", 0, bytes(1, 2));
  await store.sealOutput("job", "mix", 2, hash(1, 2));
  await store.publish("job");
  assert.equal((await store.readBlob("job", "mix"))!.size, 2);
});

test("cancel during publication wins, rejects concurrent copied writes and exposes no partial output", async () => {
  let release!: () => void;
  let publicationStarted!: () => void;
  const reached = new Promise<void>((resolve) => {
    publicationStarted = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = new MemoryRenderOutputStore({
    beforeCommit: async (operation) => {
      if (operation === "publish") {
        publicationStarted();
        await held;
      }
    },
  });
  await store.begin("job", 4);
  await store.append("job", "mix", 0, bytes(1));
  await store.sealOutput("job", "mix", 1, hash(1));
  const publication = store.publish("job");
  await reached;
  await assert.rejects(() => store.append("job", "other", 0, bytes(2)), /busy/);
  const cancelled = store.abort("job");
  release();
  await assert.rejects(() => publication, /cancelled/);
  await cancelled;
  assert.equal(await store.readBlob("job", "mix"), null);
  assert.equal(await store.getSnapshot("job"), null);
});

test("reload recovery interrupts incomplete work while retaining completed outputs", async () => {
  const database = new MemoryRenderOutputDatabase();
  const first = new MemoryRenderOutputStore({ database });
  await first.begin("partial", 4);
  await first.append("partial", "mix", 0, bytes(1));
  await first.begin("complete", 4);
  await first.append("complete", "mix", 0, bytes(2));
  await first.sealOutput("complete", "mix", 1, hash(2));
  await first.publish("complete");
  first.dispose();
  const reopened = new MemoryRenderOutputStore({ database });
  assert.deepEqual(await reopened.recover(), [
    { jobId: "complete", status: "published" },
    { jobId: "partial", status: "interrupted" },
  ]);
  assert.equal(await reopened.readBlob("partial", "mix"), null);
  assert.ok(await reopened.readBlob("complete", "mix"));
  await assert.rejects(
    () => reopened.append("partial", "mix", 1, bytes(3)),
    /not writable|writer lease/,
  );
  await reopened.abort("partial");
  assert.equal(await reopened.getSnapshot("partial"), null);
});

test("production store explicitly rejects missing IndexedDB and disposed operations", async () => {
  const native = new IndexedDBRenderOutputStore({ factory: null });
  await assert.rejects(() => native.begin("job", 4), /IndexedDB/);
  const memory = new MemoryRenderOutputStore();
  memory.dispose();
  await assert.rejects(() => memory.begin("job", 4), /disposed/);
});

test("explicit owner rollback removes only its exact published job", async () => {
  const store = new MemoryRenderOutputStore();
  for (const jobId of ["old", "new"]) {
    await store.begin(jobId, 4);
    await store.append(jobId, "mix", 0, bytes(1));
    await store.sealOutput(jobId, "mix", 1, hash(1));
    await store.publish(jobId);
  }
  await store.discard("new");
  assert.equal(await store.readBlob("new", "mix"), null);
  assert.ok(await store.readBlob("old", "mix"));
});

test("bounded chunk count rejects one extra row and malformed admission does not wedge the store", async () => {
  const store = new MemoryRenderOutputStore();
  await assert.rejects(() => store.begin("invalid", 0), /byte cap/);
  await store.begin("job", RENDER_OUTPUT_MAX_CHUNKS + 1);
  for (let index = 0; index < RENDER_OUTPUT_MAX_CHUNKS; index++)
    await store.append("job", "mix", index, bytes(1));
  await assert.rejects(
    () => store.append("job", "mix", RENDER_OUTPUT_MAX_CHUNKS, bytes(1)),
    /chunk-count cap/,
  );
  assert.equal((await store.getSnapshot("job"))!.chunks, RENDER_OUTPUT_MAX_CHUNKS);
});

test("recovery rejects same-length content corruption using an independent sealed SHA", async () => {
  const database = new MemoryRenderOutputDatabase();
  const store = new MemoryRenderOutputStore({ database });
  await store.begin("job", 4);
  await store.append("job", "mix", 0, bytes(1, 2));
  await store.sealOutput("job", "mix", 2, hash(1, 2));
  await store.publish("job");
  database.chunks.values().next().value!.bytes[0] = 9;
  await assert.rejects(() => store.readBlob("job", "mix"), /SHA-256/);
  assert.deepEqual(await store.recover(), [{ jobId: "job", status: "interrupted" }]);
  assert.equal(await store.readBlob("job", "mix"), null);
});

test("a syntactically valid but incorrect sealed SHA fails the durable read-back before publication", async () => {
  const store = new MemoryRenderOutputStore();
  await store.begin("job", 4);
  await store.append("job", "mix", 0, bytes(1, 2));
  await store.sealOutput("job", "mix", 2, hash(9, 9));
  await assert.rejects(() => store.publish("job"), /SHA-256/);
  assert.equal((await store.getSnapshot("job"))!.status, "writing");
  assert.equal(await store.readBlob("job", "mix"), null);
});

test("aggregate reservation has an exact inclusive cap and never deletes existing published work", async () => {
  const store = new MemoryRenderOutputStore();
  await store.begin("old", RENDER_OUTPUT_MAX_JOB_BYTES);
  await store.begin("active", RENDER_OUTPUT_MAX_JOB_BYTES);
  await assert.rejects(() => store.begin("excess", 1), /archive byte cap/);
  await store.append("old", "mix", 0, bytes(1));
  await store.sealOutput("old", "mix", 1, hash(1));
  await store.publish("old");
  await store.begin("exact", RENDER_OUTPUT_MAX_JOB_BYTES, ["mix"], RENDER_OUTPUT_MAX_JOB_BYTES - 1);
  await assert.rejects(() => store.begin("one-too-many", 1), /archive byte cap/);
  assert.ok(await store.readBlob("old", "mix"));
  assert.equal(RENDER_OUTPUT_MAX_ARCHIVE_BYTES, 2 * RENDER_OUTPUT_MAX_JOB_BYTES);
});

test("actual bytes beyond a reservation are admitted atomically against remaining archive capacity", async () => {
  const store = new MemoryRenderOutputStore();
  await store.begin("a", RENDER_OUTPUT_MAX_JOB_BYTES);
  await store.begin("b", RENDER_OUTPUT_MAX_JOB_BYTES, undefined, RENDER_OUTPUT_MAX_JOB_BYTES - 1);
  await store.begin("small", 2, ["mix"], 1);
  await store.append("small", "mix", 0, bytes(1));
  await assert.rejects(() => store.append("small", "mix", 1, bytes(2)), /archive byte cap/);
  assert.equal((await store.getSnapshot("small"))!.bytes, 1);
  await store.abort("a");
  await store.append("small", "mix", 1, bytes(2));
  assert.equal((await store.getSnapshot("small"))!.bytes, 2);
  await assert.rejects(() => store.begin("too-large", RENDER_OUTPUT_MAX_JOB_BYTES + 1), /byte cap/);
  await assert.rejects(() => store.begin("bad-reservation", 2, undefined, 3), /reservation/);
});

test("shared database admission serializes concurrent store instances", async () => {
  const database = new MemoryRenderOutputDatabase();
  const stores = Array.from({ length: 3 }, () => new MemoryRenderOutputStore({ database }));
  const results = await Promise.allSettled(
    stores.map((store, index) => store.begin(`job-${index}`, RENDER_OUTPUT_MAX_JOB_BYTES)),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("published archive inventory and explicit deletion preserve other jobs and reject active deletion", async () => {
  const store = new MemoryRenderOutputStore();
  for (const jobId of ["one", "two"]) {
    await store.begin(jobId, 4);
    await store.append(jobId, "mix", 0, bytes(1, 2));
    await store.sealOutput(jobId, "mix", 2, hash(1, 2));
    await store.publish(jobId);
  }
  await store.begin("writing", 4);
  assert.deepEqual(
    await store.listPublishedJobs(),
    ["one", "two"].map((jobId) => ({
      jobId,
      bytes: 2,
      encodedBytes: 2,
      manifestBytes: 0,
      outputs: [{ id: "mix", sha256: hash(1, 2), bytes: 2 }],
    })),
  );
  await assert.rejects(() => store.deletePublishedJob("writing"), {
    code: "RENDER_STORE_ACTIVE_WRITER",
  });
  await store.deletePublishedJob("one");
  assert.equal(await store.readBlob("one", "mix"), null);
  assert.ok(await store.readBlob("two", "mix"));
  assert.equal((await store.getSnapshot("writing"))!.status, "writing");
  await assert.rejects(() => store.deletePublishedJob("missing"), /published/);
});

test("manifest bytes publish atomically, survive reopen and participate in archive inventory", async () => {
  const database = new MemoryRenderOutputDatabase();
  const store = new MemoryRenderOutputStore({ database });
  const manifest = '{"schemaVersion":"render-export-manifest-v1","title":"聲音"}';
  await store.begin("job", 1024, ["mix"], 2);
  await store.append("job", "mix", 0, bytes(1, 2));
  await store.sealOutput("job", "mix", 2, hash(1, 2));
  assert.equal(await store.readManifest("job"), null);
  await store.publish("job", manifest);
  const reopened = new MemoryRenderOutputStore({ database });
  assert.equal(await reopened.readManifest("job"), manifest);
  const inventory = (await reopened.listPublishedJobs())[0]!;
  assert.equal(inventory.encodedBytes, 2);
  assert.equal(inventory.manifestBytes, new TextEncoder().encode(manifest).byteLength);
  assert.equal(inventory.bytes, inventory.encodedBytes + inventory.manifestBytes);
  await reopened.deletePublishedJob("job");
  assert.equal(await reopened.readManifest("job"), null);
  assert.equal(database.manifests.size, 0);
});

test("manifest payload is separate from the encoded budget and cannot cross aggregate cap at publication", async () => {
  const store = new MemoryRenderOutputStore();
  await store.begin("a", RENDER_OUTPUT_MAX_JOB_BYTES);
  await store.begin("b", RENDER_OUTPUT_MAX_JOB_BYTES, undefined, RENDER_OUTPUT_MAX_JOB_BYTES - 1);
  await store.begin("small", 4, ["mix"], 1);
  await store.append("small", "mix", 0, bytes(1));
  await store.sealOutput("small", "mix", 1, hash(1));
  await assert.rejects(() => store.publish("small", "{}"), /archive byte cap/);
  assert.equal((await store.getSnapshot("small"))!.status, "writing");
  assert.equal(await store.readManifest("small"), null);
  await store.abort("a");
  await store.publish("small", "{}");
  await store.begin("tiny", 2);
  await store.append("tiny", "mix", 0, bytes(1));
  await store.sealOutput("tiny", "mix", 1, hash(1));
  await store.publish("tiny", "{}");
  assert.equal(await store.readManifest("tiny"), "{}");
  await store.begin("manifest-excess", 2);
  await store.append("manifest-excess", "mix", 0, bytes(1));
  await store.sealOutput("manifest-excess", "mix", 1, hash(1));
  await assert.rejects(
    () => store.publish("manifest-excess", "x".repeat(2 * 1024 * 1024 + 1)),
    /manifest byte cap/,
  );
  assert.equal(await store.readBlob("manifest-excess", "mix"), null);
});

test("recovery rejects same-length manifest corruption before listing the archive as published", async () => {
  const database = new MemoryRenderOutputDatabase();
  const store = new MemoryRenderOutputStore({ database });
  await store.begin("job", 16);
  await store.append("job", "mix", 0, bytes(1));
  await store.sealOutput("job", "mix", 1, hash(1));
  await store.publish("job", "{}");
  database.manifests.set("job", "[]");
  await assert.rejects(() => store.readManifest("job"), /SHA-256/);
  assert.deepEqual(await store.recover(), [{ jobId: "job", status: "interrupted" }]);
  assert.deepEqual(await store.listPublishedJobs(), []);
});

test("all archive states count toward the exact metadata job cap and explicit cleanup frees one slot", async () => {
  const database = new MemoryRenderOutputDatabase();
  let store = new MemoryRenderOutputStore({ database });
  for (let index = 0; index < RENDER_OUTPUT_MAX_JOBS; index++) await store.begin(`job-${index}`, 1);
  await assert.rejects(() => store.begin("excess", 1), /archive job-count cap/);
  assert.equal((await store.listJobs()).length, RENDER_OUTPUT_MAX_JOBS);
  store.dispose();
  store = new MemoryRenderOutputStore({ database });
  await store.recover();
  assert.ok((await store.listJobs()).every((job) => job.status === "interrupted"));
  await assert.rejects(() => store.begin("excess", 1), /archive job-count cap/);
  await store.discard("job-0");
  await store.begin("replacement", 1);
  assert.equal((await store.listJobs()).length, RENDER_OUTPUT_MAX_JOBS);
});

test("archive listing exposes incomplete jobs for explicit cleanup without offering published downloads", async () => {
  const database = new MemoryRenderOutputDatabase();
  let store = new MemoryRenderOutputStore({ database });
  await store.begin("partial", 4);
  await store.append("partial", "mix", 0, bytes(1, 2));
  assert.deepEqual(await store.listJobs(), [
    {
      jobId: "partial",
      status: "writing",
      activeWriter: true,
      canDiscard: false,
      bytes: 2,
      encodedBytes: 2,
      manifestBytes: 0,
      outputs: [{ id: "mix", sha256: null, bytes: 2 }],
    },
  ]);
  store.dispose();
  store = new MemoryRenderOutputStore({ database });
  await store.recover();
  assert.equal((await store.listJobs())[0]!.status, "interrupted");
  assert.equal((await store.listJobs())[0]!.activeWriter, false);
  assert.equal((await store.listJobs())[0]!.canDiscard, true);
  assert.deepEqual(await store.listPublishedJobs(), []);
  await store.discard("partial");
  assert.deepEqual(await store.listJobs(), []);
});

test("archive usage separates actual payload from reservations across publish, interruption and explicit deletion", async () => {
  const database = new MemoryRenderOutputDatabase();
  let store = new MemoryRenderOutputStore({ database });
  const expected = (
    payloadBytes: number,
    reservedBytes: number,
    chargedBytes: number,
    jobs: number,
  ) => ({
    payloadBytes,
    reservedBytes,
    chargedBytes,
    maxBytes: RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
    jobs,
    maxJobs: RENDER_OUTPUT_MAX_JOBS,
    maxJobEncodedBytes: RENDER_OUTPUT_MAX_JOB_BYTES,
    maxManifestBytes: 2 * 1024 * 1024,
  });
  await store.begin("completed", 20, ["mix"], 12);
  assert.deepEqual(await store.getArchiveUsage(), expected(0, 12, 12, 1));
  await store.append("completed", "mix", 0, bytes(1, 2));
  assert.deepEqual(await store.getArchiveUsage(), expected(2, 10, 12, 1));
  await store.sealOutput("completed", "mix", 2, hash(1, 2));
  await store.publish("completed", "{}");
  assert.deepEqual(await store.getArchiveUsage(), expected(4, 0, 4, 1));
  await store.begin("partial", 20, ["mix"], 8);
  await store.append("partial", "mix", 0, bytes(3, 4, 5, 6));
  assert.deepEqual(await store.getArchiveUsage(), expected(8, 4, 12, 2));
  store.dispose();
  store = new MemoryRenderOutputStore({ database });
  await store.recover();
  assert.deepEqual(await store.getArchiveUsage(), expected(8, 0, 8, 2));
  await store.deletePublishedJob("completed");
  assert.deepEqual(await store.getArchiveUsage(), expected(4, 0, 4, 1));
  await store.discard("partial");
  assert.deepEqual(await store.getArchiveUsage(), expected(0, 0, 0, 0));
});

test("recovery in another store preserves a live writer and its reservation", async () => {
  const database = new MemoryRenderOutputDatabase();
  const owner = new MemoryRenderOutputStore({ database });
  const observer = new MemoryRenderOutputStore({ database });
  await owner.begin("active", 20, ["mix"], 12);
  await owner.append("active", "mix", 0, bytes(1, 2));
  assert.deepEqual(await observer.recover(), []);
  assert.equal((await observer.getSnapshot("active"))!.status, "writing");
  assert.equal((await observer.listJobs())[0]!.activeWriter, true);
  assert.equal((await observer.listJobs())[0]!.canDiscard, false);
  const usage = await observer.getArchiveUsage();
  assert.equal(usage.payloadBytes, 2);
  assert.equal(usage.reservedBytes, 10);
  assert.equal(usage.chargedBytes, 12);
  await owner.append("active", "mix", 1, bytes(3, 4));
  assert.equal((await observer.getSnapshot("active"))!.bytes, 4);
  owner.dispose();
  observer.dispose();
});

test("foreign append, seal and publish cannot use another store's active writer", async () => {
  const database = new MemoryRenderOutputDatabase();
  const owner = new MemoryRenderOutputStore({ database });
  const foreign = new MemoryRenderOutputStore({ database });
  await owner.begin("active", 20, ["mix"], 12);
  await owner.append("active", "mix", 0, bytes(1, 2));
  await assert.rejects(
    () => foreign.append("active", "mix", 1, bytes(3, 4)),
    /writer|owner|active/i,
  );
  await assert.rejects(
    () => foreign.sealOutput("active", "mix", 2, hash(1, 2)),
    /writer|owner|active/i,
  );
  await assert.rejects(() => foreign.publish("active"), /writer|owner|active/i);
  assert.equal((await owner.getSnapshot("active"))!.bytes, 2);
  await owner.sealOutput("active", "mix", 2, hash(1, 2));
  await owner.publish("active");
  assert.ok(await foreign.readBlob("active", "mix"));
  owner.dispose();
  foreign.dispose();
});

test("disposing the owner releases the writer so another store can recover interrupted work", async () => {
  const database = new MemoryRenderOutputDatabase();
  const owner = new MemoryRenderOutputStore({ database });
  const successor = new MemoryRenderOutputStore({ database });
  await owner.begin("abandoned", 20, ["mix"], 12);
  await owner.append("abandoned", "mix", 0, bytes(1, 2));
  owner.dispose();
  assert.deepEqual(await successor.recover(), [{ jobId: "abandoned", status: "interrupted" }]);
  assert.equal((await successor.getSnapshot("abandoned"))!.status, "interrupted");
  assert.equal((await successor.listJobs())[0]!.activeWriter, false);
  assert.equal((await successor.listJobs())[0]!.canDiscard, true);
  const usage = await successor.getArchiveUsage();
  assert.equal(usage.payloadBytes, 2);
  assert.equal(usage.reservedBytes, 0);
  assert.equal(usage.chargedBytes, 2);
  await successor.discard("abandoned");
  assert.deepEqual(await successor.listJobs(), []);
  successor.dispose();
});

test("foreign abort and discard cannot delete a live writer; published deletion works after release", async () => {
  const database = new MemoryRenderOutputDatabase();
  const owner = new MemoryRenderOutputStore({ database });
  const foreign = new MemoryRenderOutputStore({ database });
  await owner.begin("active", 20);
  await owner.append("active", "mix", 0, bytes(1, 2));
  await assert.rejects(() => foreign.abort("active"), /writer|owner|active/i);
  await assert.rejects(() => foreign.discard("active"), /writer|owner|active/i);
  await assert.rejects(
    () => foreign.deletePublishedJob("active"),
    /writer|owner|active|published/i,
  );
  assert.equal((await owner.getSnapshot("active"))!.status, "writing");
  await owner.sealOutput("active", "mix", 2, hash(1, 2));
  await owner.publish("active");
  await foreign.deletePublishedJob("active");
  assert.equal(await owner.getSnapshot("active"), null);
  owner.dispose();
  foreign.dispose();
});

test("missing Web Locks fails closed before allocating IndexedDB for a new writer", async () => {
  let opens = 0;
  const factory = {
    open: () => {
      opens++;
      throw new Error("IndexedDB must not open without writer liveness support");
    },
  } as unknown as IDBFactory;
  const store = new IndexedDBRenderOutputStore({ factory, locks: null });
  await assert.rejects(() => store.begin("unsupported-writer", 4), {
    code: "RENDER_STORE_LOCKS_UNAVAILABLE",
  });
  assert.equal(opens, 0);
  store.dispose();
});
