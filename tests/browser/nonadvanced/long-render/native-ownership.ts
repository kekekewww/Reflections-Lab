import { IndexedDBRenderOutputStore } from "../../../../src/audio/render-output-store.js";
import type {
  ArchivedRenderOutputJob,
  RenderArchiveUsage,
} from "../../../../src/audio/render-output-store.js";
import { IncrementalSha256 } from "../../../../src/persistence/incremental-sha256.js";

type NativeOwnershipCheck = { id: string; pass: boolean; evidence: unknown };
type WriterJob = ArchivedRenderOutputJob & { activeWriter: boolean; canDiscard: boolean };
type WriterReply = Record<string, unknown>;
interface WriterPeer {
  frame: HTMLIFrameElement;
  url: string;
  readonly documentToken: string;
  call(
    command: "start" | "append" | "state",
    payload?: Record<string, unknown>,
  ): Promise<WriterReply>;
  reload(): Promise<{ before: string; after: string }>;
  remove(): void;
}

function hash(bytes: Uint8Array): string {
  return new IncrementalSha256().update(bytes).digestHex();
}

function failure(error: unknown): Record<string, unknown> {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    code: error instanceof Error && "code" in error ? error.code : null,
  };
}

function writerLockName(databaseName: string, jobId: string): string {
  return `reflection-lab.render-output.writer/${encodeURIComponent(databaseName)}/${encodeURIComponent(jobId)}`;
}

async function heldWriterLocks(lockName: string): Promise<LockInfo[]> {
  return (await navigator.locks.query()).held?.filter((lock) => lock.name === lockName) ?? [];
}

/** Same-origin real document; every RPC is bound to origin, source, nonce and document token. */
async function writerDocument(databaseName: string, jobId: string): Promise<WriterPeer> {
  const channel = "reflection-lab-native-writer-frame-v1";
  const nonce = crypto.randomUUID();
  const url = new URL("./writer-frame.html", import.meta.url);
  url.searchParams.set("database", databaseName);
  url.searchParams.set("job", jobId);
  url.searchParams.set("nonce", nonce);
  const frame = document.createElement("iframe");
  frame.title = "Native writer ownership fixture";
  frame.width = "1";
  frame.height = "1";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  let documentToken = "";
  let removed = false;
  const pending = new Map<
    string,
    {
      token: string;
      resolve(value: WriterReply): void;
      reject(error: Error): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const readiness = new Set<{
    previous: string;
    resolve(value: string): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  const waitForDocument = (previous: string): Promise<string> => {
    if (documentToken && documentToken !== previous) return Promise.resolve(documentToken);
    return new Promise<string>((resolve, reject) => {
      const waiter: {
        previous: string;
        resolve(value: string): void;
        reject(error: Error): void;
        timer: ReturnType<typeof setTimeout>;
      } = {
        previous,
        resolve,
        reject,
        timer: setTimeout(() => {
          readiness.delete(waiter);
          reject(new Error("WRITER_DOCUMENT_HANDSHAKE_TIMEOUT"));
        }, 8000),
      };
      readiness.add(waiter);
    });
  };
  const receive = (event: MessageEvent<unknown>): void => {
    if (
      event.origin !== location.origin ||
      event.source !== frame.contentWindow ||
      !event.data ||
      typeof event.data !== "object"
    )
      return;
    const message = event.data as Record<string, unknown>;
    if (
      message.channel !== channel ||
      message.nonce !== nonce ||
      typeof message.documentToken !== "string"
    )
      return;
    if (
      message.type === "ready" &&
      message.databaseName === databaseName &&
      message.jobId === jobId
    ) {
      documentToken = message.documentToken;
      for (const waiter of readiness) {
        if (waiter.previous === documentToken) continue;
        clearTimeout(waiter.timer);
        readiness.delete(waiter);
        waiter.resolve(documentToken);
      }
      return;
    }
    if (message.type !== "response" || typeof message.requestId !== "string") return;
    const request = pending.get(message.requestId);
    if (!request || request.token !== message.documentToken) return;
    pending.delete(message.requestId);
    clearTimeout(request.timer);
    if (message.error && typeof message.error === "object") {
      const details = message.error as Record<string, unknown>;
      request.reject(Object.assign(new Error(String(details.message)), { code: details.code }));
    } else if (message.result && typeof message.result === "object") {
      request.resolve(message.result as WriterReply);
    } else request.reject(new Error("WRITER_DOCUMENT_RESPONSE_INVALID"));
  };
  window.addEventListener("message", receive);
  const initialDocument = waitForDocument("");
  frame.src = url.href;
  document.body.append(frame);
  const remove = (): void => {
    if (removed) return;
    removed = true;
    // No RPC calls store.dispose(): removal really destroys the holding document.
    frame.remove();
    window.removeEventListener("message", receive);
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("WRITER_DOCUMENT_REMOVED"));
    }
    pending.clear();
    for (const waiter of readiness) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("WRITER_DOCUMENT_REMOVED"));
    }
    readiness.clear();
  };
  try {
    await initialDocument;
  } catch (error) {
    remove();
    throw error;
  }
  return {
    frame,
    url: url.href,
    get documentToken() {
      return documentToken;
    },
    call(command, payload = {}) {
      if (removed || !frame.contentWindow)
        return Promise.reject(new Error("WRITER_DOCUMENT_REMOVED"));
      const source = frame.contentWindow;
      const requestId = crypto.randomUUID();
      return new Promise<WriterReply>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error("WRITER_DOCUMENT_RPC_TIMEOUT"));
        }, 8000);
        pending.set(requestId, { token: documentToken, resolve, reject, timer });
        source.postMessage(
          { ...payload, channel, nonce, type: "command", documentToken, requestId, command },
          location.origin,
        );
      });
    },
    async reload() {
      if (removed || !frame.contentWindow) throw new Error("WRITER_DOCUMENT_REMOVED");
      const before = documentToken;
      const ready = waitForDocument(before);
      frame.contentWindow.location.reload();
      return { before, after: await ready };
    },
    remove,
  };
}

async function listedWriter(
  store: IndexedDBRenderOutputStore,
  jobId: string,
): Promise<WriterJob | null> {
  return ((await store.listJobs()) as WriterJob[]).find((job) => job.jobId === jobId) ?? null;
}

/**
 * A bounded observation loop, not a lease TTL or timed unlock. Each attempt performs
 * native Web Locks query and committed IDB recovery/list operations. Success requires
 * the native lock to be absent and the actual stored job to have become interrupted.
 */
async function observeNaturalRelease(
  store: IndexedDBRenderOutputStore,
  databaseName: string,
  jobId: string,
): Promise<{
  released: boolean;
  attempts: number;
  job: WriterJob | null;
  held: LockInfo[];
  recovery: { jobId: string; status: "interrupted" | "published" }[];
  usage: RenderArchiveUsage;
}> {
  let job: WriterJob | null = null;
  let held: LockInfo[] = [];
  let recovery: { jobId: string; status: "interrupted" | "published" }[] = [];
  let usage = await store.getArchiveUsage();
  const started = performance.now();
  let attempts = 0;
  while (attempts < 100 && performance.now() - started < 8000) {
    attempts++;
    held = await heldWriterLocks(writerLockName(databaseName, jobId));
    recovery = await store.recover();
    job = await listedWriter(store, jobId);
    usage = await store.getArchiveUsage();
    if (
      held.length === 0 &&
      job?.status === "interrupted" &&
      job.activeWriter === false &&
      job.canDiscard === true
    )
      return { released: true, attempts, job, held, recovery, usage };
  }
  return { released: false, attempts, job, held, recovery, usage };
}

/**
 * Two-document native writer ownership and actual iframe unload/reload proof.
 * These arbitrary storage payloads are not PCM. Iframe lifecycle is not an OS or
 * whole-browser process crash; that separate public-CDP crash test has its own result.
 * The unique database, good publication, and interrupted records remain for inspection.
 */
export async function validateNativeWriterOwnership(): Promise<NativeOwnershipCheck[]> {
  const checks: NativeOwnershipCheck[] = [];
  const databaseName = `reflection-lab-native-writer-ownership-${Date.now()}-${crypto.randomUUID()}`;
  const frames = new Set<WriterPeer>();
  let observer: IndexedDBRenderOutputStore | null = null;
  const check = (id: string, pass: boolean, evidence: Record<string, unknown>): void => {
    checks.push({ id, pass, evidence: { databaseName, ...evidence } });
  };
  try {
    const locksAvailable =
      typeof navigator.locks?.request === "function" &&
      typeof navigator.locks?.query === "function";
    check("native-writer-real-web-locks-available", locksAvailable, {
      requestAvailable: typeof navigator.locks?.request === "function",
      queryAvailable: typeof navigator.locks?.query === "function",
      origin: location.origin,
    });
    if (!locksAvailable) return checks;
    checks.push(...(await validateNativeReservationCAS()));
    observer = new IndexedDBRenderOutputStore({ name: databaseName });
    await observer.recover();
    const goodJobId = "native.good-publication";
    const goodPayload = new Uint8Array([91, 92, 93, 94]);
    const goodHash = hash(goodPayload);
    const goodManifest = '{"schemaVersion":"native-writer-fixture-v1","state":"published"}\n';
    await observer.begin(goodJobId, 1024, ["pcm"], goodPayload.byteLength);
    await observer.append(goodJobId, "pcm", 0, goodPayload);
    await observer.sealOutput(goodJobId, "pcm", goodPayload.byteLength, goodHash);
    await observer.publish(goodJobId, goodManifest);

    const unloadJobId = "native.writer-unload";
    const first = await writerDocument(databaseName, unloadJobId);
    frames.add(first);
    const initial = await first.call("start");
    const heldInitially = await heldWriterLocks(writerLockName(databaseName, unloadJobId));
    const activeRecovery = await observer.recover();
    const active = await listedWriter(observer, unloadJobId);
    const beforeForeign = await observer.getSnapshot(unloadJobId);
    check(
      "native-writer-observer-recovery-preserves-active-iframe",
      heldInitially.length === 1 &&
        heldInitially[0]?.mode === "exclusive" &&
        active?.status === "writing" &&
        active.activeWriter === true &&
        active.canDiscard === false &&
        active.encodedBytes === 3 &&
        !activeRecovery.some((job) => job.jobId === unloadJobId),
      { documentToken: first.documentToken, initial, heldInitially, activeRecovery, active },
    );

    const denied: { operation: string; rejected: boolean; code: unknown }[] = [];
    const foreignOperations: { operation: string; expectedCode: string; run(): Promise<void> }[] = [
      {
        operation: "append",
        expectedCode: "RENDER_STORE_WRITER_REQUIRED",
        run: () => observer!.append(unloadJobId, "pcm", 1, new Uint8Array([77])),
      },
      {
        operation: "seal",
        expectedCode: "RENDER_STORE_WRITER_REQUIRED",
        run: () => observer!.sealOutput(unloadJobId, "pcm", 3, hash(new Uint8Array([11, 22, 33]))),
      },
      {
        operation: "publish",
        expectedCode: "RENDER_STORE_WRITER_REQUIRED",
        run: () => observer!.publish(unloadJobId, '{"foreign":true}'),
      },
      {
        operation: "abort",
        expectedCode: "RENDER_STORE_ACTIVE_WRITER",
        run: () => observer!.abort(unloadJobId),
      },
      {
        operation: "discard",
        expectedCode: "RENDER_STORE_ACTIVE_WRITER",
        run: () => observer!.discard(unloadJobId),
      },
      {
        operation: "deletePublishedJob",
        expectedCode: "RENDER_STORE_ACTIVE_WRITER",
        run: () => observer!.deletePublishedJob(unloadJobId),
      },
    ];
    for (const operation of foreignOperations) {
      let rejected = false;
      let code: unknown = null;
      try {
        await operation.run();
      } catch (error) {
        rejected = true;
        code = error instanceof Error && "code" in error ? error.code : null;
      }
      denied.push({ operation: operation.operation, rejected, code });
      check(
        `native-writer-foreign-${operation.operation}-is-rejected`,
        rejected && code === operation.expectedCode,
        { operation: operation.operation, expectedCode: operation.expectedCode, code },
      );
    }
    const afterForeign = await observer.getSnapshot(unloadJobId);
    const continued = await first.call("append", { index: 1, bytes: [44, 55, 66] });
    const continuedSnapshot = await observer.getSnapshot(unloadJobId);
    const heldBeforeUnload = await heldWriterLocks(writerLockName(databaseName, unloadJobId));
    const usageBeforeUnload = await observer.getArchiveUsage();
    check(
      "native-writer-owner-continues-after-foreign-rejections",
      JSON.stringify(beforeForeign) === JSON.stringify(afterForeign) &&
        continuedSnapshot?.bytes === 6 &&
        continuedSnapshot.chunks === 2 &&
        heldBeforeUnload.length === 1 &&
        usageBeforeUnload.reservedBytes === 506,
      {
        beforeForeign,
        afterForeign,
        denied,
        continued,
        continuedSnapshot,
        heldBeforeUnload,
        usageBeforeUnload,
      },
    );
    const unloadedDocumentToken = first.documentToken;
    first.remove();
    frames.delete(first);
    const unloadRelease = await observeNaturalRelease(observer, databaseName, unloadJobId);
    check(
      "native-writer-document-unload-naturally-releases-lease",
      !first.frame.isConnected &&
        unloadRelease.released &&
        unloadRelease.job?.encodedBytes === 6 &&
        unloadRelease.job.outputs[0]?.bytes === 6 &&
        unloadRelease.usage.reservedBytes === 0 &&
        usageBeforeUnload.chargedBytes - unloadRelease.usage.chargedBytes === 506,
      {
        unloadedDocumentToken,
        ...unloadRelease,
        usageBeforeUnload,
        method:
          "Actual iframe.remove(); helper has no unload/pagehide disposal callback; native Locks query and committed IDB recovery observed release.",
      },
    );

    const reloadJobId = "native.writer-reload";
    const second = await writerDocument(databaseName, reloadJobId);
    frames.add(second);
    await second.call("start");
    await second.call("append", { index: 1, bytes: [44, 55, 66] });
    const heldBeforeReload = await heldWriterLocks(writerLockName(databaseName, reloadJobId));
    const recoveryBeforeReload = await observer.recover();
    const activeBeforeReload = await listedWriter(observer, reloadJobId);
    const usageBeforeReload = await observer.getArchiveUsage();
    const documentTokens = await second.reload();
    const freshDocumentState = await second.call("state");
    const reloadRelease = await observeNaturalRelease(observer, databaseName, reloadJobId);
    check(
      "native-writer-document-reload-replaces-token-and-releases-old-lease",
      heldBeforeReload.length === 1 &&
        activeBeforeReload?.status === "writing" &&
        activeBeforeReload.activeWriter === true &&
        activeBeforeReload.canDiscard === false &&
        !recoveryBeforeReload.some((job) => job.jobId === reloadJobId) &&
        documentTokens.before !== documentTokens.after &&
        documentTokens.after === second.documentToken &&
        second.frame.contentWindow?.location.href === second.url &&
        freshDocumentState.started === false &&
        reloadRelease.released &&
        reloadRelease.job?.encodedBytes === 6 &&
        reloadRelease.usage.reservedBytes === 0 &&
        usageBeforeReload.chargedBytes - reloadRelease.usage.chargedBytes === 506,
      {
        heldBeforeReload,
        recoveryBeforeReload,
        activeBeforeReload,
        usageBeforeReload,
        documentTokens,
        freshDocumentState,
        ...reloadRelease,
        method:
          "Same-origin iframe contentWindow.location.reload() at identical URL; fresh module document UUID, no explicit store disposal.",
      },
    );
    second.remove();
    frames.delete(second);

    const retainedManifest = await observer.readManifest(goodJobId);
    const retainedBlob = await observer.readBlob(goodJobId, "pcm");
    const retainedBytes = retainedBlob ? new Uint8Array(await retainedBlob.arrayBuffer()) : null;
    const published = await observer.listPublishedJobs();
    const finalJobs = (await observer.listJobs()) as WriterJob[];
    const finalUsage = await observer.getArchiveUsage();
    check(
      "native-writer-lifecycle-retains-old-good-publication-and-incomplete-data",
      retainedManifest === goodManifest &&
        retainedBytes !== null &&
        hash(retainedBytes) === goodHash &&
        retainedBytes.byteLength === 4 &&
        published.length === 1 &&
        published[0]?.jobId === goodJobId &&
        [unloadJobId, reloadJobId].every((jobId) =>
          finalJobs.some(
            (job) =>
              job.jobId === jobId &&
              job.status === "interrupted" &&
              job.encodedBytes === 6 &&
              job.activeWriter === false &&
              job.canDiscard === true,
          ),
        ) &&
        finalUsage.reservedBytes === 0,
      {
        published,
        finalJobs,
        finalUsage,
        goodHash,
        manifestExact: retainedManifest === goodManifest,
        retainedForInspection: true,
        limitation:
          "Two documents and real unload/reload; not an OS/browser-process kill or full crash guarantee. Payloads are storage fixtures, not PCM.",
      },
    );
  } catch (error) {
    check("native-writer-ownership-unexpected-failure", false, { error: failure(error) });
  } finally {
    for (const frame of frames) frame.remove();
    observer?.dispose();
  }
  return checks;
}
/** Metadata-only reservations exercise the real serialized IndexedDB admission CAS. */
async function validateNativeReservationCAS(): Promise<NativeOwnershipCheck[]> {
  const databaseName = `reflection-lab-native-reservation-cas-${Date.now()}-${crypto.randomUUID()}`;
  const checks: NativeOwnershipCheck[] = [];
  const perJobBytes = 192 * 1024 * 1024;
  const aggregateBytes = 384 * 1024 * 1024;
  const expectedCode = "RENDER_STORE_ARCHIVE_CAP";
  const jobIds = ["native.reserve-a", "native.reserve-b", "native.reserve-c"] as const;
  const owners = jobIds.map(() => new IndexedDBRenderOutputStore({ name: databaseName }));
  let observer: IndexedDBRenderOutputStore | null = null;
  let winningJobId: string | null = null;
  let losingJobId: string | null = null;
  const check = (id: string, pass: boolean, evidence: Record<string, unknown>): void => {
    checks.push({
      id,
      pass,
      evidence: {
        databaseName,
        ...evidence,
        method:
          "Real native IndexedDB admission transactions; metadata-only application reservations, not 384 MiB of written PCM or a browser QuotaExceeded test.",
      },
    });
  };
  try {
    await owners[0]!.begin(jobIds[0], perJobBytes, ["pcm"], perJobBytes);
    const competing = await Promise.allSettled([
      owners[1]!.begin(jobIds[1], perJobBytes, ["pcm"], perJobBytes),
      owners[2]!.begin(jobIds[2], perJobBytes, ["pcm"], perJobBytes),
    ]);
    const fulfilled = competing.flatMap((result, index) =>
      result.status === "fulfilled" ? [jobIds[index + 1]!] : [],
    );
    const rejected = competing.flatMap((result, index) =>
      result.status === "rejected"
        ? [{ jobId: jobIds[index + 1]!, error: failure(result.reason) }]
        : [],
    );
    winningJobId = fulfilled.length === 1 ? fulfilled[0]! : null;
    losingJobId = rejected.length === 1 ? rejected[0]!.jobId : null;
    observer = new IndexedDBRenderOutputStore({ name: databaseName });
    const rows = (await observer.listJobs()) as WriterJob[];
    const usage = await observer.getArchiveUsage();
    const missingLoser = losingJobId ? await observer.getSnapshot(losingJobId) : null;
    const firstRow = rows.find((job) => job.jobId === jobIds[0]);
    const winningRow = rows.find((job) => job.jobId === winningJobId);
    check(
      "native-idb-global-reservation-cas-admits-one-of-two-concurrent-writers",
      fulfilled.length === 1 &&
        rejected.length === 1 &&
        rejected[0]?.error.code === expectedCode &&
        losingJobId !== null &&
        missingLoser === null &&
        rows.length === 2 &&
        firstRow?.status === "writing" &&
        winningRow?.status === "writing" &&
        rows.every(
          (job) =>
            job.encodedBytes === 0 &&
            job.outputs.length === 0 &&
            job.activeWriter === true &&
            job.canDiscard === false,
        ) &&
        usage.payloadBytes === 0 &&
        usage.chargedBytes === aggregateBytes &&
        usage.reservedBytes === aggregateBytes &&
        usage.jobs === 2 &&
        usage.maxBytes === aggregateBytes &&
        usage.maxJobEncodedBytes === perJobBytes,
      {
        perJobBytes,
        aggregateBytes,
        expectedCode,
        competing: competing.map((result, index) => ({
          jobId: jobIds[index + 1],
          status: result.status,
          actualCode:
            result.status === "rejected" &&
            result.reason instanceof Error &&
            "code" in result.reason
              ? result.reason.code
              : null,
        })),
        rejected,
        winningJobId,
        losingJobId,
        missingLoser,
        rows,
        usage,
      },
    );

    const activeRecovery = await observer.recover();
    const activeRows = (await observer.listJobs()) as WriterJob[];
    const activeUsage = await observer.getArchiveUsage();
    check(
      "native-idb-global-reservations-survive-recovery-while-owners-are-active",
      activeRecovery.length === 0 &&
        activeRows.length === 2 &&
        activeRows.every(
          (job) =>
            job.status === "writing" &&
            job.activeWriter === true &&
            job.canDiscard === false &&
            job.encodedBytes === 0,
        ) &&
        activeUsage.payloadBytes === 0 &&
        activeUsage.chargedBytes === aggregateBytes &&
        activeUsage.reservedBytes === aggregateBytes &&
        activeUsage.jobs === 2,
      {
        activeRecovery,
        activeRows,
        activeUsage,
        winningJobId,
        losingJobId,
        perJobBytes,
        aggregateBytes,
      },
    );
  } catch (error) {
    check("native-idb-global-reservation-cas-unexpected-failure", false, { error: failure(error) });
  } finally {
    // Only instance ownership is released. The fixture never deletes archive records.
    for (const owner of owners) owner.dispose();
    observer?.dispose();
  }

  const freshObserver = new IndexedDBRenderOutputStore({ name: databaseName });
  try {
    let attempts = 0;
    let rows: WriterJob[] = [];
    let usage = await freshObserver.getArchiveUsage();
    let recovery: { jobId: string; status: "interrupted" | "published" }[] = [];
    let held: LockInfo[] = [];
    let released = false;
    const started = performance.now();
    while (attempts < 100 && performance.now() - started < 8000) {
      attempts++;
      held =
        (await navigator.locks.query()).held?.filter((lock) =>
          jobIds.some((jobId) => lock.name === writerLockName(databaseName, jobId)),
        ) ?? [];
      recovery = await freshObserver.recover();
      rows = (await freshObserver.listJobs()) as WriterJob[];
      usage = await freshObserver.getArchiveUsage();
      if (
        held.length === 0 &&
        rows.length === 2 &&
        rows.every(
          (job) =>
            job.status === "interrupted" && job.activeWriter === false && job.canDiscard === true,
        ) &&
        usage.chargedBytes === 0 &&
        usage.reservedBytes === 0
      ) {
        released = true;
        break;
      }
    }
    check(
      "native-idb-global-reservations-release-after-owner-disposal-and-fresh-recovery",
      released &&
        rows.some((job) => job.jobId === jobIds[0]) &&
        winningJobId !== null &&
        rows.some((job) => job.jobId === winningJobId) &&
        losingJobId !== null &&
        !rows.some((job) => job.jobId === losingJobId) &&
        usage.payloadBytes === 0 &&
        usage.jobs === 2 &&
        usage.maxBytes === aggregateBytes &&
        usage.maxJobEncodedBytes === perJobBytes &&
        rows.every((job) => job.bytes === 0 && job.encodedBytes === 0 && job.outputs.length === 0),
      {
        attempts,
        held,
        recovery,
        rows,
        usage,
        winningJobId,
        losingJobId,
        retainedMetadataForInspection: true,
        perJobBytes,
        aggregateBytes,
      },
    );
  } catch (error) {
    check("native-idb-global-reservation-release-unexpected-failure", false, {
      error: failure(error),
    });
  } finally {
    freshObserver.dispose();
  }
  return checks;
}
