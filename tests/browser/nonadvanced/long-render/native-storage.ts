import { IndexedDBRenderOutputStore } from "../../../../src/audio/render-output-store.js";
import { IncrementalSha256 } from "../../../../src/persistence/incremental-sha256.js";

type NativeStoreCheck = { id: string; pass: boolean; evidence: unknown };

function hash(bytes: Uint8Array): string {
  return new IncrementalSha256().update(bytes).digestHex();
}

async function nativeHash(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function sameBytes(actual: Uint8Array, expected: Uint8Array): boolean {
  return (
    actual.byteLength === expected.byteLength &&
    actual.every((value, index) => value === expected[index])
  );
}

function errorEvidence(error: unknown): { name: string; message: string; code: unknown } {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    code: error instanceof Error && "code" in error ? error.code : null,
  };
}

/**
 * Real browser IndexedDB transactions, ownership, publication and restart recovery.
 * This is a storage fixture, not native DSP, a full-disk quota test, or hardware PCM.
 * The unique database and valid publication are retained for explicit inspection and
 * cleanup; every check includes the exact database name. No application archive is used.
 */
export async function validateNativeOutputStore(): Promise<NativeStoreCheck[]> {
  const databaseName = `reflection-lab-render-native-store-${Date.now()}-${crypto.randomUUID()}`;
  const checks: NativeStoreCheck[] = [];
  const stores: IndexedDBRenderOutputStore[] = [];
  const check = (id: string, pass: boolean, evidence: Record<string, unknown>): void => {
    checks.push({ id, pass, evidence: { databaseName, ...evidence } });
  };
  const open = (): IndexedDBRenderOutputStore => {
    const store = new IndexedDBRenderOutputStore({ name: databaseName });
    stores.push(store);
    return store;
  };
  const publishedJobId = "native.published";
  const writingJobId = "native.interrupted";
  const outputId = "pcm";
  const payload = Uint8Array.from({ length: 65557 }, (_, index) => (index * 37 + 11) % 256);
  const payloadSha256 = hash(payload);
  const manifest =
    '{"schemaVersion":"native-store-fixture-v1","jobId":"native.published","label":"逐字保留"}\n';
  const manifestBytes = new TextEncoder().encode(manifest);
  const manifestSha256 = hash(manifestBytes);
  try {
    if (typeof indexedDB !== "object" || typeof IDBDatabase !== "function")
      throw new Error("NATIVE_INDEXEDDB_UNAVAILABLE");
    const first = open();
    await first.recover();
    await first.begin(publishedJobId, 131072, [outputId], payload.byteLength);
    const callerChunk = payload.slice(0, 32768);
    const append = first.append(publishedJobId, outputId, 0, callerChunk);
    // Mutate synchronously, before awaiting any promise: append must already own a copy.
    callerChunk.fill(0xee);
    await append;
    await first.append(publishedJobId, outputId, 1, payload.slice(32768));
    await first.sealOutput(publishedJobId, outputId, payload.byteLength, payloadSha256);
    const sealedSnapshot = await first.getSnapshot(publishedJobId);
    const sealedBlob = await first.readBlob(publishedJobId, outputId);
    const sealedManifest = await first.readManifest(publishedJobId);
    check(
      "native-idb-sealed-output-remains-private",
      sealedBlob === null &&
        sealedManifest === null &&
        sealedSnapshot?.status === "writing" &&
        sealedSnapshot.bytes === payload.byteLength &&
        sealedSnapshot.chunks === 2,
      {
        sealedSnapshot,
        blobVisible: sealedBlob !== null,
        manifestVisible: sealedManifest !== null,
      },
    );

    await first.publish(publishedJobId, manifest);
    const blob = await first.readBlob(publishedJobId, outputId);
    const outputBytes = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    const storedManifest = await first.readManifest(publishedJobId);
    const publishedJobs = await first.listPublishedJobs();
    const published = publishedJobs.find((job) => job.jobId === publishedJobId);
    const independentPayloadSha256 = await nativeHash(payload);
    const independentManifestSha256 = await nativeHash(manifestBytes);
    check(
      "native-idb-append-owns-caller-bytes-before-first-await",
      outputBytes !== null &&
        sameBytes(outputBytes, payload) &&
        hash(outputBytes) === payloadSha256 &&
        callerChunk.every((value) => value === 0xee),
      {
        payloadBytes: payload.byteLength,
        payloadSha256,
        readbackSha256: outputBytes ? hash(outputBytes) : null,
        callerWasOverwrittenBeforeAwait: callerChunk.every((value) => value === 0xee),
      },
    );
    check(
      "native-idb-publication-reads-exact-payload-and-manifest",
      outputBytes !== null &&
        independentPayloadSha256 === payloadSha256 &&
        storedManifest === manifest &&
        independentManifestSha256 === manifestSha256 &&
        published?.encodedBytes === payload.byteLength &&
        published.manifestBytes === manifestBytes.byteLength &&
        published.bytes === payload.byteLength + manifestBytes.byteLength &&
        published.outputs.length === 1 &&
        published.outputs[0]?.sha256 === payloadSha256,
      {
        published,
        payloadSha256,
        independentPayloadSha256,
        manifestSha256,
        independentManifestSha256,
        manifestBytes: manifestBytes.byteLength,
        manifestExact: storedManifest === manifest,
      },
    );

    first.dispose();
    const second = open();
    const recovery = await second.recover();
    const reopenedManifest = await second.readManifest(publishedJobId);
    const reopenedBlob = await second.readBlob(publishedJobId, outputId);
    const reopenedBytes = reopenedBlob ? new Uint8Array(await reopenedBlob.arrayBuffer()) : null;
    const reopenedPublished = (await second.listPublishedJobs()).find(
      (job) => job.jobId === publishedJobId,
    );
    check(
      "native-idb-reopen-recovers-published-bytes-manifest-and-hashes",
      recovery.some((job) => job.jobId === publishedJobId && job.status === "published") &&
        reopenedBytes !== null &&
        sameBytes(reopenedBytes, payload) &&
        hash(reopenedBytes) === payloadSha256 &&
        reopenedManifest === manifest &&
        hash(new TextEncoder().encode(reopenedManifest)) === manifestSha256 &&
        reopenedPublished?.encodedBytes === payload.byteLength &&
        reopenedPublished.manifestBytes === manifestBytes.byteLength &&
        reopenedPublished.bytes === payload.byteLength + manifestBytes.byteLength,
      {
        recovery,
        reopenedPublished,
        payloadSha256,
        manifestSha256,
        manifestExact: reopenedManifest === manifest,
      },
    );

    await second.begin(writingJobId, 1024, [outputId], 5);
    await second.append(writingJobId, outputId, 0, new Uint8Array([3, 4, 5]));
    const beforeAbort = await second.getSnapshot(writingJobId);
    const originalTransaction = IDBDatabase.prototype.transaction;
    let armed = true;
    let abortIssued = false;
    let abortIssueFailure: unknown = null;
    let appendFailure: unknown = null;
    let appendRejected = false;
    try {
      IDBDatabase.prototype.transaction = function (
        this: IDBDatabase,
        storeNames: string | string[],
        mode?: IDBTransactionMode,
        options?: IDBTransactionOptions,
      ): IDBTransaction {
        const transaction = originalTransaction.call(this, storeNames, mode, options);
        if (this.name === databaseName && mode === "readwrite" && armed) {
          armed = false;
          queueMicrotask(() => {
            try {
              transaction.abort();
              abortIssued = true;
            } catch (error) {
              abortIssueFailure = error;
            }
          });
        }
        return transaction;
      };
      try {
        await second.append(writingJobId, outputId, 1, new Uint8Array([6, 7]));
      } catch (error) {
        appendRejected = true;
        appendFailure = error;
      }
    } finally {
      IDBDatabase.prototype.transaction = originalTransaction;
    }
    const afterAbort = await second.getSnapshot(writingJobId);
    check(
      "native-idb-transaction-abort-does-not-advance-committed-watermarks",
      abortIssued &&
        abortIssueFailure === null &&
        appendRejected &&
        JSON.stringify(afterAbort) === JSON.stringify(beforeAbort) &&
        afterAbort?.bytes === 3 &&
        afterAbort.chunks === 1 &&
        afterAbort.status === "writing",
      {
        beforeAbort,
        afterAbort,
        abortIssued,
        appendRejected,
        appendFailure: appendFailure === null ? null : errorEvidence(appendFailure),
        abortIssueFailure: abortIssueFailure === null ? null : errorEvidence(abortIssueFailure),
        method:
          "One real native readwrite IDBTransaction.abort() queued before request completion; not a quota-fill test.",
      },
    );
    await second.append(writingJobId, outputId, 1, new Uint8Array([6, 7]));
    const afterRetry = await second.getSnapshot(writingJobId);
    check(
      "native-idb-transaction-abort-allows-same-chunk-index-retry",
      afterRetry?.bytes === 5 &&
        afterRetry.chunks === 2 &&
        afterRetry.status === "writing" &&
        (await second.readBlob(writingJobId, outputId)) === null,
      { afterRetry, retriedIndex: 1, expectedBytes: 5 },
    );

    second.dispose();
    const third = open();
    const restartRecovery = await third.recover();
    const incomplete = await third.getSnapshot(writingJobId);
    const incompleteBlob = await third.readBlob(writingJobId, outputId);
    const incompleteManifest = await third.readManifest(writingJobId);
    const retainedManifest = await third.readManifest(publishedJobId);
    const retainedBlob = await third.readBlob(publishedJobId, outputId);
    const retainedBytes = retainedBlob ? new Uint8Array(await retainedBlob.arrayBuffer()) : null;
    const retainedJobs = await third.listPublishedJobs();
    check(
      "native-idb-recovery-interrupts-incomplete-work-and-retains-old-publication",
      restartRecovery.some((job) => job.jobId === writingJobId && job.status === "interrupted") &&
        incomplete?.status === "interrupted" &&
        incomplete.bytes === 5 &&
        incomplete.chunks === 2 &&
        incompleteBlob === null &&
        incompleteManifest === null &&
        restartRecovery.some((job) => job.jobId === publishedJobId && job.status === "published") &&
        retainedManifest === manifest &&
        retainedBytes !== null &&
        sameBytes(retainedBytes, payload) &&
        hash(retainedBytes) === payloadSha256 &&
        retainedJobs.length === 1 &&
        retainedJobs[0]?.jobId === publishedJobId,
      {
        restartRecovery,
        incomplete,
        incompleteBlobVisible: incompleteBlob !== null,
        incompleteManifestVisible: incompleteManifest !== null,
        retainedJobs,
        payloadSha256,
        manifestSha256,
        retainedForInspection: true,
        cleanup: "Unique fixture database retained; delete only by explicit database name.",
      },
    );
  } catch (error) {
    check("native-idb-storage-fixture-unexpected-failure", false, { error: errorEvidence(error) });
  } finally {
    for (const store of stores) store.dispose();
  }
  return checks;
}
