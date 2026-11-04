import path from "node:path";
import { fileURLToPath } from "node:url";
import { constants } from "node:fs";
import { lstat, realpath, open } from "node:fs/promises";
import { createHash } from "node:crypto";

/** Current transport fixture cap, independent of the product render job's output cap. */
export const NATIVE_DOWNLOAD_TRANSPORT_MAX_ENTRIES = 16;
const checkoutRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const ownedContexts = new WeakSet();
const guidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hashPattern = /^[a-f0-9]{64}$/;
const filenamePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/;
const devicePattern = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function error(code, message, cause) {
  return Object.assign(new Error(message, cause === undefined ? undefined : { cause }), { code });
}
function requireOwned(condition, code, message) {
  if (!condition) throw error(code, message);
}
function errorRecord(reason) {
  return {
    code: reason?.code ?? null,
    message: reason instanceof Error ? reason.message : String(reason),
  };
}
function strictChild(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
function publicOwnership(browser, context, page) {
  requireOwned(
    browser &&
      context &&
      page &&
      typeof browser.contexts === "function" &&
      typeof browser.isConnected === "function" &&
      browser.isConnected() &&
      typeof browser.browserType === "function" &&
      browser.browserType().name() === "chromium" &&
      typeof context.browser === "function" &&
      context.browser() === browser &&
      browser.contexts().includes(context) &&
      typeof context.pages === "function" &&
      context.pages().includes(page) &&
      typeof page.context === "function" &&
      page.context() === context &&
      typeof page.isClosed === "function" &&
      !page.isClosed() &&
      typeof browser.newBrowserCDPSession === "function" &&
      typeof context.newCDPSession === "function",
    "NATIVE_DOWNLOAD_OWNERSHIP",
    "Only the supplied public Chromium browser/context/page handles are owned.",
  );
}
function descriptors(outputs) {
  requireOwned(
    Array.isArray(outputs) &&
      outputs.length > 0 &&
      outputs.length <= NATIVE_DOWNLOAD_TRANSPORT_MAX_ENTRIES,
    "NATIVE_DOWNLOAD_DESCRIPTOR",
    "Supply one to sixteen frozen download descriptors for this fixture.",
  );
  const ids = new Map();
  const names = new Map();
  for (const value of outputs) {
    requireOwned(
      value &&
        typeof value.id === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value.id) &&
        !ids.has(value.id) &&
        typeof value.filename === "string" &&
        filenamePattern.test(value.filename) &&
        !value.filename.endsWith(".") &&
        !devicePattern.test(value.filename) &&
        path.basename(value.filename) === value.filename &&
        !names.has(value.filename.toLowerCase()) &&
        Number.isSafeInteger(value.bytes) &&
        value.bytes > 0 &&
        typeof value.sha256 === "string" &&
        hashPattern.test(value.sha256),
      "NATIVE_DOWNLOAD_DESCRIPTOR",
      "Download IDs, safe unique filenames, exact byte counts and SHA-256 must be pinned.",
    );
    const pin = Object.freeze({
      id: value.id,
      filename: value.filename,
      bytes: value.bytes,
      sha256: value.sha256,
    });
    ids.set(pin.id, pin);
    names.set(pin.filename.toLowerCase(), pin);
  }
  return { ids, names };
}
async function directoryIdentity(directory) {
  requireOwned(
    typeof directory === "string" && path.isAbsolute(directory),
    "NATIVE_DOWNLOAD_DIRECTORY",
    "Download directory must already exist at an absolute checkout-owned path.",
  );
  const requested = path.resolve(directory);
  const root = await realpath(checkoutRoot);
  requireOwned(
    strictChild(path.resolve(checkoutRoot), requested),
    "NATIVE_DOWNLOAD_DIRECTORY",
    "Download directory must be strictly inside this checkout.",
  );
  let info, canonical;
  try {
    info = await lstat(requested);
    canonical = await realpath(requested);
  } catch (cause) {
    throw error(
      "NATIVE_DOWNLOAD_DIRECTORY",
      "Download directory is not an existing owned directory.",
      cause,
    );
  }
  requireOwned(
    info.isDirectory() && !info.isSymbolicLink() && strictChild(root, canonical),
    "NATIVE_DOWNLOAD_DIRECTORY",
    "Download directory may not escape the checkout through a link or junction.",
  );
  const physical = await lstat(canonical);
  return Object.freeze({ requested, root, canonical, dev: physical.dev, ino: physical.ino });
}
async function unchangedDirectory(owned) {
  let info, physical, requested;
  try {
    info = await lstat(owned.canonical);
    physical = await realpath(owned.canonical);
    requested = await realpath(owned.requested);
  } catch (cause) {
    throw error("NATIVE_DOWNLOAD_PATH", "Owned download directory disappeared or changed.", cause);
  }
  requireOwned(
    info.isDirectory() &&
      !info.isSymbolicLink() &&
      info.dev === owned.dev &&
      info.ino === owned.ino &&
      physical === owned.canonical &&
      requested === owned.canonical &&
      strictChild(owned.root, physical),
    "NATIVE_DOWNLOAD_PATH",
    "Owned download directory identity or resolved location changed.",
  );
}
function childFile(owned, filename) {
  const target = path.resolve(owned.canonical, filename);
  requireOwned(
    path.dirname(target) === owned.canonical && strictChild(owned.canonical, target),
    "NATIVE_DOWNLOAD_PATH",
    "Native download file must be a direct child of its owned directory.",
  );
  return target;
}
async function absentTarget(target) {
  try {
    await lstat(target);
  } catch (cause) {
    if (cause.code === "ENOENT") return;
    throw error("NATIVE_DOWNLOAD_PATH", "Cannot inspect the owned destination.", cause);
  }
  throw error(
    "NATIVE_DOWNLOAD_TARGET_EXISTS",
    "An output already exists; no existing result is overwritten.",
  );
}
function sameFile(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}
async function regularFile(owned, target, missingCode) {
  await unchangedDirectory(owned);
  let entry, physical, handle;
  try {
    entry = await lstat(target);
    physical = await realpath(target);
    requireOwned(
      entry.isFile() &&
        !entry.isSymbolicLink() &&
        entry.nlink === 1 &&
        physical === target &&
        path.dirname(physical) === owned.canonical,
      "NATIVE_DOWNLOAD_PATH",
      "Native artifact must be the exact regular, unlinked owned file.",
    );
    handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const current = await handle.stat();
    requireOwned(
      current.isFile() && current.nlink === 1 && sameFile(entry, current),
      "NATIVE_DOWNLOAD_PATH",
      "Native artifact identity changed while it was opened.",
    );
    return { handle, stat: current };
  } catch (cause) {
    if (handle) await handle.close().catch(() => undefined);
    if (cause.code?.startsWith("NATIVE_DOWNLOAD_")) throw cause;
    throw error(
      cause.code === "ENOENT" ? missingCode : "NATIVE_DOWNLOAD_PATH",
      "The completed native artifact is missing, partial, or cannot be opened safely.",
      cause,
    );
  }
}

/**
 * Public Playwright/CDP-only adapter for an already owned Chromium context.
 * Browser.allowAndName writes real GUID files; Node reads those exact files in bounded chunks only
 * after matching native completion, then copies verified bytes to an exclusive known
 * filename. It never uses Playwright internals or synthesizes browser download bytes.
 * Official APIs, also checked against installed playwright-core public types:
 * https://playwright.dev/docs/api/class-browser#browser-new-browser-cdp-session
 * https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session
 * https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Browser.pdl
 * Browser download commands/events are experimental and need actual owned-Chrome evidence.
 */
export async function createOwnedNativeDownloadTransport(
  browser,
  context,
  page,
  directory,
  options,
) {
  publicOwnership(browser, context, page);
  const pins = descriptors(options?.outputs);
  requireOwned(
    !ownedContexts.has(context),
    "NATIVE_DOWNLOAD_OWNERSHIP",
    "This context already has an owned download transport.",
  );
  ownedContexts.add(context);
  let pageSession,
    browserSession,
    policyAttempted = false,
    listeners = false;
  let owned, identity;
  let cancelled = false,
    disposed = false,
    disposal = null,
    active = null;
  let protocolFailure = null;
  const records = new Map();
  const invalidBegins = new Map();
  const operations = new Set();
  const cancellations = new Map();
  const outcomes = [];
  const completedIds = new Set();
  const wake = () => {
    if (active?.waiter) {
      const notify = active.waiter;
      active.waiter = null;
      notify();
    }
  };
  const assertOperation = (operation) => {
    if (operation.failure) throw operation.failure;
    if (protocolFailure) throw protocolFailure;
    if (cancelled || disposed)
      throw error("NATIVE_DOWNLOAD_CANCELLED", "Owned native download transport was cancelled.");
    if (operation.record?.failure) throw operation.record.failure;
  };
  const cancelRecord = (record) => {
    if (!record.claimedBy || record.state === "completed" || record.state === "canceled")
      return null;
    if (!cancellations.has(record.guid)) {
      const task = Promise.resolve().then(() =>
        browserSession.send("Browser.cancelDownload", {
          guid: record.guid,
          browserContextId: identity.browserContextId,
        }),
      );
      void task.catch(() => undefined);
      cancellations.set(record.guid, task);
    }
    return cancellations.get(record.guid);
  };
  const failOperation = (operation, reason) => {
    operation.failure ??= reason;

    wake();
  };
  const beginKey = (filename, url) => `${filename}\n${url}`;
  const knownBlobUrl = (value) => {
    if (typeof value !== "string") return false;
    try {
      const url = new URL(value);
      return url.protocol === "blob:" && url.origin === identity.origin;
    } catch {
      return false;
    }
  };
  const onBegin = (event) => {
    if (
      disposed ||
      cancelled ||
      !event ||
      event.frameId !== identity.frameId ||
      typeof event.suggestedFilename !== "string"
    )
      return;
    const pin = pins.names.get(event.suggestedFilename.toLowerCase());
    if (
      !pin ||
      pin.filename !== event.suggestedFilename ||
      typeof event.url !== "string" ||
      !knownBlobUrl(event.url)
    )
      return;
    const key = beginKey(pin.filename, event.url);
    if (typeof event.guid !== "string" || !guidPattern.test(event.guid)) {
      const reason = error(
        "NATIVE_DOWNLOAD_GUID",
        "Native download GUID is not an owned UUID filename.",
      );
      if (invalidBegins.size < NATIVE_DOWNLOAD_TRANSPORT_MAX_ENTRIES * 2)
        invalidBegins.set(key, reason);
      if (active?.pin.filename === pin.filename && active.url === event.url)
        failOperation(active, reason);
      wake();
      return;
    }
    const previous = records.get(event.guid);
    if (previous) {
      if (previous.url !== event.url || previous.filename !== pin.filename) {
        const reason = error(
          "NATIVE_DOWNLOAD_GUID",
          "A native GUID was reused for another artifact.",
        );
        previous.failure ??= reason;
        protocolFailure ??= reason;
        if (invalidBegins.size < NATIVE_DOWNLOAD_TRANSPORT_MAX_ENTRIES * 2)
          invalidBegins.set(key, reason);
        if (active) failOperation(active, reason);
      }
      wake();
      return;
    }
    if (records.size >= NATIVE_DOWNLOAD_TRANSPORT_MAX_ENTRIES * 2) {
      protocolFailure ??= error(
        "NATIVE_DOWNLOAD_AMBIGUOUS",
        "Too many native candidates for the frozen download list.",
      );
      if (active) failOperation(active, protocolFailure);
      wake();
      return;
    }
    records.set(event.guid, {
      guid: event.guid,
      url: event.url,
      filename: pin.filename,
      frameId: event.frameId,
      state: "waitingProgress",
      totalBytes: null,
      receivedBytes: 0,
      filePath: null,
      claimedBy: null,
      failure: null,
    });
    if (
      active?.record &&
      active.pin.filename === pin.filename &&
      active.url === event.url &&
      active.record.guid !== event.guid
    )
      failOperation(
        active,
        error(
          "NATIVE_DOWNLOAD_AMBIGUOUS",
          "A second native GUID appeared after this download was claimed.",
        ),
      );
    wake();
  };
  const onProgress = (event) => {
    if (disposed || !event || typeof event.guid !== "string") return;
    const record = records.get(event.guid);
    if (!record) return; // Global progress has no context ID; unknown GUIDs are never attributed.
    const pin = pins.names.get(record.filename.toLowerCase());
    const terminal = record.state === "completed" || record.state === "canceled";
    if (terminal) {
      if (
        event.state !== record.state ||
        event.totalBytes !== record.totalBytes ||
        event.receivedBytes !== record.receivedBytes
      )
        record.failure ??= error(
          "NATIVE_DOWNLOAD_PROGRESS",
          "Native progress changed after its terminal event.",
        );
      wake();
      return;
    }
    record.state = event.state;
    record.filePath = event.filePath ?? null;
    if (
      !["inProgress", "completed", "canceled"].includes(event.state) ||
      !Number.isSafeInteger(event.totalBytes) ||
      event.totalBytes < 0 ||
      !Number.isSafeInteger(event.receivedBytes) ||
      event.receivedBytes < record.receivedBytes ||
      event.receivedBytes > pin.bytes ||
      (event.totalBytes !== 0 && event.totalBytes !== pin.bytes)
    ) {
      record.failure ??= error(
        "NATIVE_DOWNLOAD_PROGRESS",
        "Native progress does not match pinned safe byte counts.",
      );
    } else if (event.state === "canceled") {
      record.failure ??= error(
        "NATIVE_DOWNLOAD_PARTIAL",
        "Chrome cancelled this native download; partial files remain private.",
      );
    } else if (
      event.state === "completed" &&
      (event.totalBytes !== pin.bytes || event.receivedBytes !== pin.bytes)
    ) {
      record.failure ??= error(
        "NATIVE_DOWNLOAD_PROGRESS",
        "Native completion byte counts differ from the pinned artifact.",
      );
    }
    record.totalBytes = event.totalBytes;
    record.receivedBytes = event.receivedBytes;
    wake();
  };
  async function currentFrame() {
    publicOwnership(browser, context, page);
    try {
      const { targetInfo } = await pageSession.send("Target.getTargetInfo");
      const { frameTree } = await pageSession.send("Page.getFrameTree");
      const frame = frameTree?.frame;
      requireOwned(
        page.url() === identity.pageUrl &&
          targetInfo?.targetId === identity.targetId &&
          targetInfo?.type === "page" &&
          targetInfo?.browserContextId === identity.browserContextId &&
          targetInfo?.url === identity.pageUrl &&
          frame?.id === identity.frameId &&
          frame?.loaderId === identity.loaderId &&
          frame?.url === identity.pageUrl,
        "NATIVE_DOWNLOAD_FRAME_CHANGED",
        "The frozen target, context, main frame or document changed.",
      );
    } catch (cause) {
      if (cause.code === "NATIVE_DOWNLOAD_FRAME_CHANGED") throw cause;
      throw error(
        "NATIVE_DOWNLOAD_FRAME_CHANGED",
        "Cannot revalidate the owned native frame.",
        cause,
      );
    }
  }
  async function waitUntil(operation, observe) {
    for (;;) {
      assertOperation(operation);
      const value = observe();
      if (value) return value;
      await new Promise((resolve) => {
        operation.waiter = resolve;
      });
    }
  }
  async function hashHandle(handle, operation) {
    const chunk = Buffer.allocUnsafe(65536);
    const hash = createHash("sha256");
    let bytes = 0;
    for (;;) {
      assertOperation(operation);
      const result = await handle.read(chunk, 0, chunk.byteLength, bytes);
      assertOperation(operation);
      if (result.bytesRead === 0) break;
      bytes += result.bytesRead;
      requireOwned(
        Number.isSafeInteger(bytes) && bytes <= operation.pin.bytes,
        "NATIVE_DOWNLOAD_PROGRESS",
        "Native artifact exceeds its frozen byte count.",
      );
      hash.update(chunk.subarray(0, result.bytesRead));
    }
    return { bytes, sha256: hash.digest("hex") };
  }
  async function verifyAndCopy(operation, record) {
    assertOperation(operation);
    const sourcePath = childFile(owned, record.guid);
    const targetPath = childFile(owned, operation.pin.filename);
    if (record.filePath !== null)
      requireOwned(
        typeof record.filePath === "string" &&
          path.isAbsolute(record.filePath) &&
          path.resolve(record.filePath) === sourcePath,
        "NATIVE_DOWNLOAD_PATH",
        "Native completion filePath is not the exact owned GUID file.",
      );
    const native = await regularFile(owned, sourcePath, "NATIVE_DOWNLOAD_PARTIAL");
    let destination = null;
    try {
      assertOperation(operation);
      requireOwned(
        native.stat.size === operation.pin.bytes,
        "NATIVE_DOWNLOAD_PARTIAL",
        "Native GUID file is incomplete or differs in size.",
      );
      const source = await hashHandle(native.handle, operation);
      requireOwned(
        source.bytes === operation.pin.bytes && source.sha256 === operation.pin.sha256,
        "NATIVE_DOWNLOAD_HASH",
        "Actual Chrome GUID file differs from the frozen artifact SHA-256.",
      );
      requireOwned(
        sameFile(native.stat, await native.handle.stat()),
        "NATIVE_DOWNLOAD_PATH",
        "Native source changed during verification.",
      );
      await unchangedDirectory(owned);
      await absentTarget(targetPath);
      assertOperation(operation);
      try {
        destination = await open(targetPath, "wx", 0o600);
      } catch (cause) {
        throw error(
          cause.code === "EEXIST" ? "NATIVE_DOWNLOAD_TARGET_EXISTS" : "NATIVE_DOWNLOAD_PATH",
          "Cannot exclusively create the owned output filename.",
          cause,
        );
      }
      const chunk = Buffer.allocUnsafe(65536);
      let read = 0;
      let written = 0;
      for (;;) {
        assertOperation(operation);
        const input = await native.handle.read(chunk, 0, chunk.byteLength, read);
        assertOperation(operation);
        if (input.bytesRead === 0) break;
        read += input.bytesRead;
        requireOwned(
          Number.isSafeInteger(read) && read <= operation.pin.bytes,
          "NATIVE_DOWNLOAD_PROGRESS",
          "Native source grew beyond its frozen byte count while copying.",
        );
        let offset = 0;
        while (offset < input.bytesRead) {
          const result = await destination.write(chunk, offset, input.bytesRead - offset, written);
          assertOperation(operation);
          requireOwned(
            result.bytesWritten > 0,
            "NATIVE_DOWNLOAD_PARTIAL",
            "Native artifact copy made no progress.",
          );
          offset += result.bytesWritten;
          written += result.bytesWritten;
        }
      }
      requireOwned(
        written === operation.pin.bytes,
        "NATIVE_DOWNLOAD_PARTIAL",
        "Copied artifact length is incomplete.",
      );
      await destination.sync();
      await destination.close();
      destination = null;
      assertOperation(operation);
      requireOwned(
        sameFile(native.stat, await native.handle.stat()),
        "NATIVE_DOWNLOAD_PATH",
        "Native source changed while copying.",
      );
      const copied = await regularFile(owned, targetPath, "NATIVE_DOWNLOAD_PARTIAL");
      try {
        const initiallyVerified = await hashHandle(copied.handle, operation);
        requireOwned(
          initiallyVerified.bytes === operation.pin.bytes &&
            initiallyVerified.sha256 === operation.pin.sha256,
          "NATIVE_DOWNLOAD_HASH",
          "Actual saved output does not match the native artifact SHA-256.",
        );
        await currentFrame();
        assertOperation(operation);
        // Keep the original copied FD alive across the final CDP await. Re-open
        // the actual path afterwards and compare it with that held identity.
        const finalTarget = await regularFile(owned, targetPath, "NATIVE_DOWNLOAD_PARTIAL");
        try {
          requireOwned(
            sameFile(copied.stat, await copied.handle.stat()) &&
              sameFile(copied.stat, finalTarget.stat),
            "NATIVE_DOWNLOAD_PATH",
            "Saved output identity changed during the final native frame check.",
          );
          const verified = await hashHandle(finalTarget.handle, operation);
          requireOwned(
            verified.bytes === operation.pin.bytes && verified.sha256 === operation.pin.sha256,
            "NATIVE_DOWNLOAD_HASH",
            "Saved output bytes changed during the final native frame check.",
          );
          const finalStat = await finalTarget.handle.stat();
          const heldStat = await copied.handle.stat();
          await unchangedDirectory(owned);
          const pathEntry = await lstat(targetPath);
          const physical = await realpath(targetPath);
          requireOwned(
            pathEntry.isFile() &&
              !pathEntry.isSymbolicLink() &&
              pathEntry.nlink === 1 &&
              physical === targetPath &&
              path.dirname(physical) === owned.canonical &&
              sameFile(finalTarget.stat, finalStat) &&
              sameFile(finalTarget.stat, heldStat) &&
              sameFile(finalTarget.stat, pathEntry),
            "NATIVE_DOWNLOAD_PATH",
            "Saved output path or held file identity changed during final byte verification.",
          );
          assertOperation(operation);
          completedIds.add(operation.pin.id);
          return Object.freeze({
            id: operation.pin.id,
            guid: record.guid,
            filename: operation.pin.filename,
            path: targetPath,
            sourcePath,
            bytes: verified.bytes,
            sha256: verified.sha256,
            browserContextId: identity.browserContextId,
            targetId: identity.targetId,
            frameId: identity.frameId,
            totalBytes: record.totalBytes,
            receivedBytes: record.receivedBytes,
          });
        } finally {
          await finalTarget.handle.close().catch(() => undefined);
        }
      } finally {
        await copied.handle.close().catch(() => undefined);
      }
    } finally {
      if (destination) await destination.close().catch(() => undefined);
      await native.handle.close().catch(() => undefined);
      // Chrome GUID files, .crdownload files and any failed copy remain as evidence.
    }
  }
  function save(download, filename, id) {
    let operation;
    try {
      requireOwned(
        !cancelled && !disposed,
        "NATIVE_DOWNLOAD_CANCELLED",
        "Owned native download transport was cancelled.",
      );
      if (protocolFailure) throw protocolFailure;
      const pin = pins.ids.get(id);
      requireOwned(
        pin &&
          pin.filename === filename &&
          download &&
          typeof download.page === "function" &&
          download.page() === page &&
          typeof download.suggestedFilename === "function" &&
          download.suggestedFilename() === pin.filename &&
          typeof download.url === "function" &&
          knownBlobUrl(download.url()),
        "NATIVE_DOWNLOAD_BINDING",
        "Public Download page, URL, ID and suggested filename must match the frozen owned output.",
      );
      requireOwned(
        !completedIds.has(id),
        "NATIVE_DOWNLOAD_ID_REUSED",
        "An output has already been saved by this transport.",
      );
      requireOwned(
        active === null,
        "NATIVE_DOWNLOAD_BUSY",
        "Only one sequential native save may be active.",
      );
      operation = {
        pin,
        url: download.url(),
        record: null,
        failure: null,
        waiter: null,
        timer: null,
      };
      active = operation;
    } catch (cause) {
      return Promise.reject(cause);
    }
    const perform = async () => {
      try {
        await currentFrame();
        assertOperation(operation);
        operation.timer = setTimeout(() => {
          failOperation(
            operation,
            error(
              "NATIVE_DOWNLOAD_TIMEOUT",
              "Native save exceeded the unchanged 90 second transport bound.",
            ),
          );
          if (operation.record) cancelRecord(operation.record);
        }, 90000);
        operation.timer.unref?.();
        const record = await waitUntil(operation, () => {
          const invalid = invalidBegins.get(beginKey(operation.pin.filename, operation.url));
          if (invalid) throw invalid;
          const candidates = [...records.values()].filter(
            (entry) => entry.filename === operation.pin.filename && entry.url === operation.url,
          );
          requireOwned(
            candidates.length <= 1,
            "NATIVE_DOWNLOAD_AMBIGUOUS",
            "Multiple native GUIDs match this public download; none is guessed.",
          );
          if (!candidates.length) return null;
          const candidate = candidates[0];
          requireOwned(
            candidate.claimedBy === null,
            "NATIVE_DOWNLOAD_AMBIGUOUS",
            "Native GUID is already claimed by another save.",
          );
          candidate.claimedBy = operation.pin.id;
          operation.record = candidate;
          return candidate;
        });
        await waitUntil(operation, () => (record.state === "completed" ? record : null));
        assertOperation(operation);
        return await verifyAndCopy(operation, record);
      } finally {
        if (operation.timer) clearTimeout(operation.timer);
        operation.waiter = null;
        if (active === operation) active = null;
      }
    };
    const task = perform();
    operations.add(task);
    void task.then(
      (value) => {
        operations.delete(task);
        outcomes.push({ status: "fulfilled", value });
      },
      (reason) => {
        operations.delete(task);
        outcomes.push({ status: "rejected", reason: errorRecord(reason) });
      },
    );
    return task;
  }
  async function cancel() {
    cancelled = true;
    if (active)
      failOperation(
        active,
        error("NATIVE_DOWNLOAD_CANCELLED", "Owned native download transport was cancelled."),
      );
    for (const record of records.values()) cancelRecord(record);
    const results = await Promise.allSettled([...cancellations.values()]);
    return { cancelledGuids: [...cancellations.keys()], results };
  }
  async function settle() {
    for (;;) {
      const count = cancellations.size;
      await Promise.allSettled([...operations, ...cancellations.values()]);
      if (operations.size === 0 && cancellations.size === count)
        return {
          operations: [...outcomes],
          cancellations: await Promise.allSettled([...cancellations.values()]),
        };
    }
  }
  async function resetOwnedPolicy() {
    if (!policyAttempted) return { status: "notAttempted" };
    if (!browser.isConnected()) return { status: "skippedDisconnected" };
    try {
      await browserSession.send("Browser.setDownloadBehavior", {
        behavior: "default",
        browserContextId: identity.browserContextId,
        eventsEnabled: false,
      });
      return { status: "fulfilled" };
    } catch (reason) {
      return { status: "rejected", reason: errorRecord(reason) };
    }
  }
  async function detachOwnedSessions() {
    return Promise.all(
      [
        { kind: "page", session: pageSession },
        { kind: "browser", session: browserSession },
      ].map(async ({ kind, session }) => {
        if (!session) return { kind, status: "notCreated" };
        try {
          await session.detach();
          return { kind, status: "fulfilled" };
        } catch (reason) {
          return { kind, status: "rejected", reason: errorRecord(reason) };
        }
      }),
    );
  }
  async function cleanupPolicyAndSessions() {
    const policyReset = await resetOwnedPolicy();
    const sessions = await detachOwnedSessions();
    const requiresOwnedContextClose =
      policyAttempted && policyReset.status === "rejected" && browser.isConnected();
    // Never forget an unrecovered policy on a still-live context. The WeakSet
    // owns no strong browser references; only the parent closes its own handles.
    if (!requiresOwnedContextClose) ownedContexts.delete(context);
    return {
      browserContextId: identity?.browserContextId ?? null,
      frameId: identity?.frameId ?? null,
      policyAttempted,
      policyReset,
      sessions,
      requiresOwnedContextClose,
    };
  }
  async function dispose() {
    disposal ??= (async () => {
      disposed = true;
      if (listeners) {
        browserSession.off("Browser.downloadWillBegin", onBegin);
        browserSession.off("Browser.downloadProgress", onProgress);
        listeners = false;
      }
      await cancel();
      await settle();
      return cleanupPolicyAndSessions();
    })();
    return disposal;
  }
  try {
    owned = await directoryIdentity(directory);
    for (const pin of pins.ids.values()) await absentTarget(childFile(owned, pin.filename));
    pageSession = await context.newCDPSession(page);
    const { targetInfo } = await pageSession.send("Target.getTargetInfo");
    requireOwned(
      targetInfo?.type === "page" &&
        typeof targetInfo.targetId === "string" &&
        targetInfo.targetId.length > 0,
      "NATIVE_DOWNLOAD_OWNERSHIP",
      "The supplied page does not resolve to an owned page target.",
    );
    requireOwned(
      typeof targetInfo.browserContextId === "string" && targetInfo.browserContextId.length > 0,
      "NATIVE_DOWNLOAD_CONTEXT_REQUIRED",
      "A concrete owned browser context ID is required; default context is never guessed.",
    );
    const { frameTree } = await pageSession.send("Page.getFrameTree");
    const frame = frameTree?.frame;
    const pageUrl = page.url();
    let origin;
    try {
      const parsed = new URL(pageUrl);
      requireOwned(
        ["http:", "https:"].includes(parsed.protocol),
        "NATIVE_DOWNLOAD_OWNERSHIP",
        "Only a concrete owned HTTP(S) fixture origin is supported.",
      );
      origin = parsed.origin;
    } catch (cause) {
      throw error("NATIVE_DOWNLOAD_OWNERSHIP", "Owned fixture URL is invalid.", cause);
    }
    requireOwned(
      frame &&
        typeof frame.id === "string" &&
        frame.id.length > 0 &&
        typeof frame.loaderId === "string" &&
        frame.loaderId.length > 0 &&
        frame.url === pageUrl &&
        targetInfo.url === pageUrl,
      "NATIVE_DOWNLOAD_OWNERSHIP",
      "Main frame and document must match the supplied owned page URL.",
    );
    browserSession = await browser.newBrowserCDPSession();
    const contexts = await browserSession.send("Target.getBrowserContexts");
    const browserTarget = await browserSession.send("Target.getTargetInfo", {
      targetId: targetInfo.targetId,
    });
    requireOwned(
      contexts.browserContextIds?.includes(targetInfo.browserContextId) &&
        browserTarget.targetInfo?.targetId === targetInfo.targetId &&
        browserTarget.targetInfo?.browserContextId === targetInfo.browserContextId,
      "NATIVE_DOWNLOAD_OWNERSHIP",
      "Page target and concrete context must resolve on the supplied owned browser session.",
    );
    identity = Object.freeze({
      mode: "Browser.allowAndName",
      browserContextId: targetInfo.browserContextId,
      targetId: targetInfo.targetId,
      frameId: frame.id,
      loaderId: frame.loaderId,
      pageUrl,
      origin,
      directory: owned.canonical,
      maxEntries: NATIVE_DOWNLOAD_TRANSPORT_MAX_ENTRIES,
      expectedOutputs: pins.ids.size,
    });
    browserSession.on("Browser.downloadWillBegin", onBegin);
    browserSession.on("Browser.downloadProgress", onProgress);
    listeners = true;
    policyAttempted = true;
    await browserSession.send("Browser.setDownloadBehavior", {
      behavior: "allowAndName",
      browserContextId: identity.browserContextId,
      downloadPath: owned.canonical,
      eventsEnabled: true,
    });
    return Object.freeze({ identity, save, cancel, settle, dispose });
  } catch (cause) {
    if (listeners) {
      browserSession.off("Browser.downloadWillBegin", onBegin);
      browserSession.off("Browser.downloadProgress", onProgress);
      listeners = false;
    }
    const cleanup = await cleanupPolicyAndSessions();
    // Preserve the original setup Error, while making all partial-application
    // cleanup evidence serializable. Primitive/frozen thrown values retain cause.
    if ((typeof cause === "object" && cause !== null) || typeof cause === "function") {
      let attached = false;
      try {
        Object.defineProperty(cause, "nativeDownloadCleanup", {
          value: cleanup,
          enumerable: true,
          configurable: true,
        });
        attached = true;
      } catch {
        /* A frozen thrown value is retained as the wrapped error cause. */
      }
      if (attached) throw cause;
    }
    const wrapped = error("NATIVE_DOWNLOAD_CDP_SETUP", String(cause), cause);
    wrapped.nativeDownloadCleanup = cleanup;
    throw wrapped;
  }
}
