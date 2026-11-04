import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { readFile, mkdir, realpath, lstat } from "node:fs/promises";
import { openSync, writeSync, ftruncateSync, closeSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { OwnedDownloadBatch } from "./owned-downloads.mjs";
import { createOwnedNativeDownloadTransport } from "./native-download-transport.mjs";
import {
  createPairedStartupViteOptions,
  observeOwnedPairedStartup,
} from "./paired-startup-probe.mjs";

import { createPairedV3PartialCapture } from "./paired-v3-progress.mjs";
import { closeOwnedBrowserServer, drainOwnedPendingActions } from "./owned-cleanup.mjs";
const started = performance.now();
const startedAtUtc = new Date().toISOString();
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const stamp = startedAtUtc.replace(/[:.]/g, "");
const lane = path.join(root, "docs/16-nonadvanced-completion/lanes/long-render");
const parentDirectory = path.join(root, ".cache/nonadvanced-long-render-paired-v3");
const directory = path.join(parentDirectory, stamp);
const cacheDir = path.join(directory, "vite-cache");
const resultPath = path.join(lane, `paired-v3-native-${stamp}.json`);
const origin = "http://127.0.0.1:5353";
const fixtureUrl = `${origin}/tests/browser/nonadvanced/long-render/paired-v3-index.html`;
const executablePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const limits = Object.freeze({
  whole: 270000,
  dsp: 150000,
  downloads: 90000,
  parser: 45000,
  cleanupTotal: 10000,
  stateCapture: 500,
});
const pendingActions = new Map();
const partialCapture = createPairedV3PartialCapture();
const timers = new Set(),
  sdkPending = new Set(),
  phases = [],
  errors = [];
let stopped = false,
  browserServer,
  browser,
  context,
  page,
  server,
  ownedProcess,
  parserWorker,
  batch,
  transport,
  startupObserver;
let resultFd = null,
  pageErrorListener,
  consoleListener;
let parserExited = true,
  cleanupStarted = null;
const evidence = {
  schemaVersion: "paired-native-run-v3",
  status: "RUNNING",
  startedAtUtc,
  root,
  directory,
  cacheDir,
  startupScope:
    "Versioned entry-only Vite optimizer and a fresh owned cache; original startup ERROR is preserved and specific original blocking HTTP/import remains UNKNOWN.",
  previousPairedBaselineAttempt01: "STARTUP_ERROR_PRESERVED_NOT_RERUN",
  previousPairedV2Attempt01: "DSP150_ERROR_PRESERVED_NOT_RERUN",
  historicalV3Attempt01: "STARTUP_AND_CLEANUP_ERROR_PRESERVED_NOT_RERUN",
  cleanupMethod:
    "Owned BrowserServer graceful close at original 1500ms, original kill2000 fallback; already-issued pending actions drain only inside original remaining10s.",
  partialRecoveryAttempted: false,
  consoleTimeline: [],
  pageErrorOverflow: 0,
  consoleMessages: 0,
  consoleTextMaxLength: 2048,
  consoleOverflow: 0,
  method:
    "Independent paired-only complete native master graphs and five real anchor downloads; not the original product gate.",
  originalAttempt02: "ERROR_PRESERVED",
  originalWhole63Gate: "FAIL_PRESERVED_NOT_RERUN",
  original16Downloads: "INCOMPLETE_PRESERVED_NOT_RERUN",
  limitsMs: limits,
  phases,
  errors,
  downloads: [],
  transportFiles: [],
  cleanup: { status: "NOT_STARTED", steps: [] },
};

function nativeDownloadCleanupEvidence(error) {
  if (!error || typeof error !== "object" || error.nativeDownloadCleanup === undefined)
    return undefined;
  try {
    // The transport owns this bounded primitive-only record. Preserve it before
    // serializing Error (whose custom fields JSON.stringify otherwise discards).
    return JSON.parse(JSON.stringify(error.nativeDownloadCleanup));
  } catch (serializationError) {
    return {
      serializationFailed: true,
      reason: String(serializationError),
      requiresOwnedContextClose: true,
    };
  }
}
function attachNativeDownloadCleanup(target, error) {
  const cleanup = nativeDownloadCleanupEvidence(error);
  if (cleanup !== undefined) target.nativeDownloadCleanup = cleanup;
}

function persistSync() {
  if (resultFd === null) throw new Error("PAIRED_V3_RECEIPT_NOT_EXCLUSIVELY_CLAIMED");
  const bytes = Buffer.from(JSON.stringify(evidence, null, 2) + "\n");
  let written = 0;
  while (written < bytes.length) {
    const count = writeSync(resultFd, bytes, written, bytes.length - written, written);
    if (count < 1) throw new Error("PAIRED_V3_RECEIPT_SHORT_WRITE");
    written += count;
  }
  ftruncateSync(resultFd, bytes.length);
}
function observedExit() {
  return ownedProcess ? ownedProcess.exitCode !== null || ownedProcess.signalCode !== null : null;
}
function ownedEmergencyStop(reason) {
  stopped = true;
  evidence.status = "ERROR";
  evidence.emergency = {
    reason,
    observedAtUtc: new Date().toISOString(),
    elapsedMs: performance.now() - started,
    ownedBrowserPid: ownedProcess?.pid ?? null,
    ownedBrowserExited: observedExit(),
    serverListening: server?.httpServer?.listening ?? false,
    cleanupVerified: false,
    pendingActionCount: pendingActions.size,
    pendingActions: [...pendingActions.values()],
    note: "Emergency stop is not proof resources closed. Root must inspect recorded owned handles/PID/port before releasing lease.",
  };
  // Only handles created by this exact runner. Issue all feasible owned stops before exit.
  try {
    void batch?.cancel().catch(() => undefined);
  } catch {
    /* recorded emergency */
  }
  try {
    void transport?.cancel().catch(() => undefined);
  } catch {
    /* recorded emergency */
  }
  try {
    void parserWorker?.terminate().catch(() => undefined);
  } catch {
    /* recorded emergency */
  }
  try {
    void browserServer?.kill().catch(() => undefined);
  } catch {
    /* recorded emergency */
  }
  try {
    server?.httpServer?.closeAllConnections();
    server?.httpServer?.close();
  } catch {
    /* recorded emergency */
  }
  try {
    persistSync();
  } catch {
    /* stderr still records the actual fatal reason */
  }
  process.stderr.write(`PAIRED_EMERGENCY_ERROR:${reason}\n`);
  process.exit(1);
}
const hardStop = setTimeout(
  () => ownedEmergencyStop("NODE_WHOLE_PLUS_CLEANUP_280000MS"),
  limits.whole + limits.cleanupTotal,
);
function assertActive() {
  if (stopped) throw new Error("PAIRED_RUN_STOPPED");
}
function observe(promise) {
  const value = Promise.resolve(promise);
  sdkPending.add(value);
  void value.catch(() => undefined);
  void value.then(
    () => sdkPending.delete(value),
    () => sdkPending.delete(value),
  );
  return value;
}
async function bounded(name, milliseconds, action) {
  if (milliseconds < 1) throw new Error(`${name.toUpperCase()}_NO_REMAINING_BUDGET`);
  let timer;
  const pending = Promise.resolve().then(action);
  pendingActions.set(pending, {
    name,
    budgetMs: milliseconds,
    startedElapsedMs: performance.now() - started,
  });
  void pending.catch(() => undefined);
  void pending.then(
    () => pendingActions.delete(pending),
    () => pendingActions.delete(pending),
  );
  try {
    return await Promise.race([
      pending,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name.toUpperCase()}_NODE_WALL_DEADLINE_${milliseconds}MS`)),
          milliseconds,
        );
        timers.add(timer);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    timers.delete(timer);
  }
}
async function phase(name, milliseconds, action) {
  assertActive();
  const begin = performance.now();
  const row = {
    name,
    deadlineMs: milliseconds,
    startedAtUtc: new Date().toISOString(),
    status: "RUNNING",
  };
  phases.push(row);
  console.log(`PAIRED_PHASE_START:${name}:${milliseconds}`);
  try {
    const result = await bounded(name, milliseconds, action);
    assertActive();
    row.status = "settled";
    return result;
  } catch (error) {
    row.status = "error";
    row.error = String(error);
    attachNativeDownloadCleanup(row, error);
    throw error;
  } finally {
    row.elapsedMs = performance.now() - begin;
  }
}
async function acquired(name, maximum, create, closeLate) {
  let candidate,
    abandoned = false,
    closing = false;
  const creating = observe(Promise.resolve().then(create));
  function closeAbandoned(handle) {
    if (closing) return;
    closing = true;
    const row = {
      name,
      status: "closing-late-owned-handle",
      ownedPid: typeof handle.process === "function" ? handle.process().pid : null,
    };
    (evidence.lateOwnedResources ??= []).push(row);
    const closed = observe(Promise.resolve().then(() => closeLate(handle)));
    void closed.then(
      () => {
        row.status = "closed";
      },
      (error) => {
        row.status = "error";
        row.error = String(error);
        attachNativeDownloadCleanup(row, error);
        evidence.status = "ERROR";
      },
    );
  }
  void creating.then(
    (handle) => {
      candidate = handle;
      if (stopped || abandoned) closeAbandoned(handle);
    },
    () => undefined,
  );
  try {
    return await phase(name, maximum, async () => {
      const handle = await creating;
      assertActive();
      return handle;
    });
  } catch (error) {
    abandoned = true;
    if (candidate) closeAbandoned(candidate);
    throw error;
  }
}
async function receipt(deadline = started + limits.whole) {
  const git = (...args) => {
    const remaining = Math.floor(deadline - performance.now() - 50);
    if (remaining < 1) throw new Error("PAIRED_SOURCE_RECEIPT_DEADLINE");
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: Math.min(2000, remaining),
      maxBuffer: 16 * 1024 * 1024,
    });
  };
  const names = [
    ...new Set(
      git(
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "src",
        "schemas",
        "package.json",
        "package-lock.json",
        "tests/audio-runtime/render-fixture.ts",
        "tests/audio-runtime/render-paired-verifier.test.mjs",
        "tests/audio-runtime/render-native-download-transport.test.mjs",
        "tests/audio-runtime/render-owned-downloads.test.mjs",
        "tests/audio-runtime/render-paired-startup-probe.test.mjs",
        "tests/audio-runtime/render-paired-v3-progress.test.mjs",
        "tests/audio-runtime/render-owned-cleanup.test.mjs",
        "tests/browser/nonadvanced/long-render",
      )
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
  const sources = await Promise.all(
    names.map(async (name) => ({
      path: name,
      sha256: createHash("sha256")
        .update(await readFile(path.join(root, name)))
        .digest("hex"),
    })),
  );
  if (performance.now() >= deadline) throw new Error("PAIRED_SOURCE_HASH_DEADLINE");
  return {
    observedAtUtc: new Date().toISOString(),
    root: git("rev-parse", "--show-toplevel").trim(),
    head: git("rev-parse", "HEAD").trim(),
    branch: git("branch", "--show-current").trim(),
    porcelain: git("status", "--porcelain=v1", "--untracked-files=all"),
    sources,
    sourceSetSha256: createHash("sha256").update(JSON.stringify(sources)).digest("hex"),
  };
}
async function captureStartupState(name, budget) {
  if (!startupObserver) return;
  evidence.startupObservation = startupObserver.snapshot();
  try {
    evidence.startupObservation = await bounded(
      name,
      Math.floor(Math.min(limits.stateCapture, budget)),
      () => observe(startupObserver.captureState()),
    );
  } catch (error) {
    evidence.startupStateCaptureError = String(error);
    evidence.startupObservation = startupObserver.snapshot();
  }
}
async function capturePairedV3Partial(remainingMs) {
  evidence.partialRecoveryAttempted = true;
  // A partial recovery is an ERROR artifact even when the browser completed its part.
  evidence.status = "ERROR";
  const captured = await partialCapture.capture(
    () => observe(page.evaluate(() => window.__pairedV3Partial)),
    { remainingMs, reserveMs: 2000, maxMs: Math.max(0, Math.min(490, remainingMs - 2010)) },
  );
  if (!partialCapture.closed) {
    evidence.partialRecovery = captured;
    persistSync();
  }
}
function completeStartupTrace(snapshot) {
  return (
    !!snapshot &&
    Object.values(snapshot.overflow).every((value) => value === 0) &&
    snapshot.counts.observerErrors === 0 &&
    snapshot.counts.unknownIgnored === 0 &&
    snapshot.browserState.error === null
  );
}
async function verifiedDirectory(target, actualRoot, allowRoot = false, expected) {
  assertActive();
  const stat = await lstat(target);
  assertActive();
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("PAIRED_V3_STARTUP_DIRECTORY_SYMLINK_OR_NOT_DIRECTORY");
  const actual = await realpath(target);
  assertActive();
  const relative = path.relative(actualRoot, actual);
  if (
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    (!allowRoot && relative === "")
  )
    throw new Error("PAIRED_V3_STARTUP_DIRECTORY_OUTSIDE_OWN_CHECKOUT");
  const identity = { path: actual, device: String(stat.dev), inode: String(stat.ino) };
  if (
    expected &&
    (identity.path !== expected.path ||
      identity.device !== expected.device ||
      identity.inode !== expected.inode)
  )
    throw new Error("PAIRED_V3_STARTUP_DIRECTORY_IDENTITY_CHANGED");
  return identity;
}
async function ownedChildDirectory(parent, name, actualRoot, fresh) {
  await verifiedDirectory(parent.path, actualRoot, parent.path === actualRoot, parent);
  assertActive();
  const target = path.join(parent.path, name);
  try {
    assertActive();
    await mkdir(target, { recursive: false });
    assertActive();
  } catch (error) {
    assertActive();
    if (fresh || error.code !== "EEXIST") throw error;
  }
  await verifiedDirectory(parent.path, actualRoot, parent.path === actualRoot, parent);
  assertActive();
  const identity = await verifiedDirectory(target, actualRoot);
  assertActive();
  return identity;
}
async function verifyDownloads(outputs) {
  parserExited = false;
  parserWorker = new Worker(new URL("./paired-verify.mjs", import.meta.url), {
    workerData: { kind: "verify-paired-native-downloads", directory, outputs },
  });
  parserWorker.once("exit", () => {
    parserExited = true;
  });
  const completed = observe(
    new Promise((resolve, reject) => {
      parserWorker.once("message", (message) =>
        message.ok ? resolve(message.result) : reject(new Error(message.error)),
      );
      parserWorker.once("error", reject);
      parserWorker.once("exit", (code) =>
        reject(new Error(`PAIRED_PARSER_EXIT_BEFORE_RESULT:${code}`)),
      );
    }),
  );
  return phase(
    "independent-node-parser",
    Math.max(1, Math.min(limits.parser, limits.whole - (performance.now() - started))),
    () => completed,
  );
}
async function main() {
  assertActive();
  const actualRoot = await realpath(root);
  assertActive();
  const actualCwd = await realpath(process.cwd());
  assertActive();
  if (path.relative(actualRoot, actualCwd) !== "")
    throw new Error("PAIRED_V3_STARTUP_WRONG_WORKTREE_CWD");
  const rootIdentity = await verifiedDirectory(root, actualRoot, true);
  assertActive();
  const laneIdentity = await verifiedDirectory(lane, actualRoot);
  assertActive();
  const cacheIdentity = await ownedChildDirectory(rootIdentity, ".cache", actualRoot, false);
  assertActive();
  const parentIdentity = await ownedChildDirectory(
    cacheIdentity,
    "nonadvanced-long-render-paired-v3",
    actualRoot,
    false,
  );
  assertActive();
  const attemptIdentity = await ownedChildDirectory(parentIdentity, stamp, actualRoot, true);
  assertActive();
  const viteCacheIdentity = await ownedChildDirectory(
    attemptIdentity,
    "vite-cache",
    actualRoot,
    true,
  );
  assertActive();
  await verifiedDirectory(lane, actualRoot, false, laneIdentity);
  assertActive();
  resultFd = openSync(resultPath, "wx");
  evidence.outputOwnership = {
    exclusiveAttemptDirectory: true,
    exclusiveReceipt: true,
    cacheWasFresh: true,
    root: rootIdentity,
    parent: parentIdentity,
    attempt: attemptIdentity,
    cache: viteCacheIdentity,
  };
  evidence.sourceAtStart = await phase("source-start-receipt", 15000, () =>
    receipt(Math.min(started + limits.whole, performance.now() + 14500)),
  );
  assertActive();
  evidence.executableSha256 = await phase("browser-executable-hash", 10000, async () =>
    createHash("sha256")
      .update(await readFile(executablePath))
      .digest("hex"),
  );
  const viteOptions = createPairedStartupViteOptions(root, cacheDir);
  viteOptions.optimizeDeps.entries = ["tests/browser/nonadvanced/long-render/paired-v3-index.html"];
  evidence.viteOptions = structuredClone(viteOptions);
  server = await acquired(
    "owned-vite-create",
    15000,
    () => createServer(viteOptions),
    (late) => late.close(),
  );
  await phase("owned-vite-listen", 10000, () => server.listen());
  assertActive();
  browserServer = await acquired(
    "owned-browser-launch",
    25000,
    () =>
      chromium.launchServer({
        executablePath,
        host: "127.0.0.1",
        timeout: 20000,
        headless: true,
        args: ["--no-first-run", "--enable-precise-memory-info"],
      }),
    (late) => late.kill(),
  );
  ownedProcess = browserServer.process();
  evidence.ownedBrowserPid = ownedProcess.pid;
  evidence.ownedSpawnFile = ownedProcess.spawnfile;
  evidence.browserExecutable = executablePath;
  browser = await acquired(
    "owned-browser-connect",
    15000,
    () => chromium.connect(browserServer.wsEndpoint(), { timeout: 10000 }),
    (late) => late.close(),
  );
  evidence.browserVersion = browser.version();
  evidence.nodeVersion = process.version;
  context = await acquired(
    "owned-browser-context",
    10000,
    () => browser.newContext({ acceptDownloads: true }),
    (late) => late.close(),
  );
  page = await acquired(
    "owned-browser-page",
    10000,
    () => context.newPage(),
    (late) => late.close(),
  );
  startupObserver = observeOwnedPairedStartup(page, { origin, maxEvents: 512, maxInflight: 256 });
  pageErrorListener = (error) => {
    if (errors.length < 16) errors.push(String(error.message).slice(0, 2048));
    else evidence.pageErrorOverflow++;
  };
  consoleListener = (message) => {
    if (evidence.consoleMessages < 256) {
      evidence.consoleMessages++;
      const entry = {
        elapsedMs: performance.now() - started,
        atUtc: new Date().toISOString(),
        type: message.type(),
        text: message.text().slice(0, 2048),
      };
      evidence.consoleTimeline.push(entry);
      console.log(`paired-browser:${entry.type}:${entry.text}`);
    } else evidence.consoleOverflow++;
  };
  page.on("pageerror", pageErrorListener);
  page.on("console", consoleListener);
  await phase("owned-fixture-open", 15000, () =>
    page.goto(fixtureUrl, {
      waitUntil: "load",
      timeout: 10000,
    }),
  );
  await phase("paired-fixture-ready", 10000, () =>
    page.waitForFunction(
      () =>
        typeof window.runPairedNativeWholeMaster === "function" &&
        typeof window.pairedManifest === "function" &&
        typeof window.pairedCheckSnapshot === "function" &&
        typeof window.pairedExpectedOutputs === "function" &&
        typeof window.nativeLongDownload === "function" &&
        typeof window.releasePairedV3Exports === "function" &&
        window.__pairedV3Partial?.schemaVersion === "paired-v3-progress-v1",
      null,
      { timeout: 8000 },
    ),
  );
  evidence.fixtureReady = true;
  await captureStartupState(
    "startup-ready-state",
    Math.max(1, limits.whole - (performance.now() - started)),
  );
  evidence.startupTelemetryComplete = completeStartupTrace(evidence.startupObservation);
  if (
    !evidence.startupObservation?.browserState.allGlobalsReady ||
    evidence.startupObservation.browserState.readyState !== "complete"
  )
    throw new Error("PAIRED_V3_STARTUP_READY_STATE_NOT_CONFIRMED");
  assertActive();
  evidence.native = await phase("paired-native-dsp", limits.dsp, () =>
    page.evaluate(() => window.runPairedNativeWholeMaster()),
  );
  assertActive();
  persistSync();
  const outputs = await phase("paired-expected-downloads", 5000, () =>
    page.evaluate(() => window.pairedExpectedOutputs()),
  );
  if (!Array.isArray(outputs) || outputs.length !== 5)
    throw new Error("PAIRED_EXPECTED_FIVE_ACTUAL_DOWNLOADS");
  evidence.expectedOutputs = outputs;
  transport = await acquired(
    "owned-native-download-transport",
    10000,
    () => createOwnedNativeDownloadTransport(browser, context, page, directory, { outputs }),
    async (late) => {
      await late.cancel();
      await late.dispose();
    },
  );
  evidence.transportIdentity = transport.identity;
  batch = new OwnedDownloadBatch(page, directory, (saved) => evidence.downloads.push(saved), {
    save: async (download, filename, id) => {
      const saved = await transport.save(download, filename, id);
      evidence.transportFiles.push(saved);
      return saved;
    },
  });
  await phase("five-actual-anchor-downloads", limits.downloads, () =>
    batch.run(outputs.map((output) => output.id)),
  );
  assertActive();
  evidence.independentFiles = await verifyDownloads(outputs);
  assertActive();
  await phase("owned-verified-snapshot-release", 500, () =>
    page.evaluate(() => window.releasePairedV3Exports()),
  );
  evidence.snapshotExportsReleased = true;
  assertActive();
  evidence.sourceAtEnd = await phase(
    "source-end-receipt",
    Math.max(1, Math.min(15000, limits.whole - (performance.now() - started))),
    receipt,
  );
  evidence.sourcesUnchanged =
    evidence.sourceAtStart.head === evidence.sourceAtEnd.head &&
    evidence.sourceAtStart.sourceSetSha256 === evidence.sourceAtEnd.sourceSetSha256;
  evidence.status =
    evidence.native.status === "ERROR" || evidence.independentFiles.status === "ERROR"
      ? "ERROR"
      : evidence.native.status === "PASS" &&
          evidence.independentFiles.status === "PASS" &&
          evidence.sourcesUnchanged &&
          errors.length === 0 &&
          evidence.pageErrorOverflow === 0 &&
          evidence.consoleOverflow === 0 &&
          evidence.startupTelemetryComplete
        ? "PASS"
        : "FAIL";
}
async function cleanup() {
  cleanupStarted = performance.now();
  const record = evidence.cleanup;
  record.status = "RUNNING";
  record.startedAtUtc = new Date().toISOString();
  const remaining = () =>
    Math.max(
      0,
      Math.min(
        limits.cleanupTotal - (performance.now() - cleanupStarted),
        limits.whole + limits.cleanupTotal - (performance.now() - started),
      ),
    );
  async function step(name, maximum, action) {
    const budget = Math.floor(Math.min(maximum, remaining()));
    const row = { name, budgetMs: budget, status: "RUNNING" };
    record.steps.push(row);
    if (budget < 1) {
      row.status = "budget-exhausted";
      return;
    }
    const begin = performance.now();
    try {
      await bounded(name, budget, action);
      row.status = "settled";
    } catch (error) {
      row.status = "error";
      row.error = String(error);
      attachNativeDownloadCleanup(row, error);
    } finally {
      row.elapsedMs = performance.now() - begin;
    }
  }
  if (page && (evidence.status === "ERROR" || !evidence.native || !evidence.independentFiles)) {
    try {
      await step("bounded-partial-progress", 500, () => capturePairedV3Partial(remaining()));
    } finally {
      // Prevent an already-timed-out evaluate from publishing a late recovery result.
      partialCapture.close();
      if (evidence.partialRecoveryAttempted && !evidence.partialRecovery)
        evidence.partialRecovery = {
          availability: "UNAVAILABLE",
          reason: "PAIRED_V3_PARTIAL_CLEANUP_STEP_DEADLINE_OR_CLOSED",
          partialRecoveryAttempted: true,
          overallStatus: "ERROR",
          budgetMs: 0,
        };
    }
  } else partialCapture.close();
  if (startupObserver) {
    if (evidence.status !== "PASS")
      await step("failure-browser-state", limits.stateCapture, () =>
        captureStartupState("failure-state-read", limits.stateCapture),
      );
    evidence.startupObservation = startupObserver.snapshot();
    evidence.startupTelemetryComplete =
      completeStartupTrace(evidence.startupObservation) && evidence.consoleOverflow === 0;
    await step("owned-observer-dispose", 500, () => {
      evidence.startupObservation = startupObserver.dispose();
      evidence.startupObserverDisposed = evidence.startupObservation.disposed === true;
      evidence.startupTelemetryComplete =
        completeStartupTrace(evidence.startupObservation) && evidence.consoleOverflow === 0;
      if (
        !evidence.startupObserverDisposed ||
        evidence.startupObservation.counts.observerErrors !== 0
      )
        throw new Error("PAIRED_V3_STARTUP_OBSERVER_DISPOSE_ERROR");
    });
  }
  if (page && consoleListener)
    await step("owned-console-listener-dispose", 500, () => page.off("console", consoleListener));
  if (page && pageErrorListener)
    await step("owned-pageerror-listener-dispose", 500, () =>
      page.off("pageerror", pageErrorListener),
    );
  // Cancel flags are set immediately; only already-owned download handles/GUIDs are touched.
  if (batch || transport)
    await step("owned-download-cancel", 1000, () =>
      Promise.allSettled([
        ...(batch ? [batch.cancel()] : []),
        ...(transport ? [transport.cancel()] : []),
      ]),
    );
  if (page && !page.isClosed() && evidence.fixtureReady && !evidence.snapshotExportsReleased)
    await step("owned-verified-snapshot-release", 500, async () => {
      await observe(page.evaluate(() => window.releasePairedV3Exports()));
      evidence.snapshotExportsReleased = true;
    });
  if (page && !page.isClosed()) await step("owned-page-close", 1000, () => page.close());
  // BrowserServer owns the Chrome process; connected Browser.close only disconnects.
  if (browserServer) await closeOwnedBrowserServer({ browserServer, observedExit, step });
  if (parserWorker && !parserExited)
    await step("owned-parser-worker-terminate", 1000, () => parserWorker.terminate());
  if (server) {
    await step("owned-vite-close", 1500, async () => {
      try {
        server.httpServer?.closeAllConnections();
      } finally {
        await server.close();
      }
    });
    if (server.httpServer?.listening)
      await step("owned-http-server-close", 500, () => {
        server.httpServer.close();
      });
  }
  if (batch || transport)
    await step("owned-download-settle", 1000, () =>
      Promise.allSettled([
        ...(batch ? [batch.settle()] : []),
        ...(transport ? [transport.settle()] : []),
      ]),
    );
  if (transport)
    await step("owned-transport-dispose", 500, async () => {
      record.transportDispose = await transport.dispose();
    });
  // On an earlier failure preserve an end receipt if it fits this same total budget.
  if (!evidence.sourceAtEnd && evidence.sourceAtStart && remaining() > 1200) {
    await step("source-error-end-receipt", remaining() - 100, async () => {
      evidence.sourceAtEnd = await receipt(cleanupStarted + limits.cleanupTotal - 100);
      evidence.sourcesUnchanged =
        evidence.sourceAtStart.head === evidence.sourceAtEnd.head &&
        evidence.sourceAtStart.sourceSetSha256 === evidence.sourceAtEnd.sourceSetSha256;
    });
  }
  if (sdkPending.size)
    await step("owned-sdk-settle", Math.min(1000, remaining()), async () => {
      while (sdkPending.size) await Promise.allSettled([...sdkPending]);
    });
  // This drain is deliberately outside bounded()/step(): tracking itself would
  // make it wait on its own promise. Original failed step rows remain errors.
  if (pendingActions.size) {
    const row = { name: "owned-pending-actions-drain", status: "RUNNING" };
    record.steps.push(row);
    const drained = await drainOwnedPendingActions(pendingActions, { remainingMs: remaining });
    Object.assign(row, drained, { status: drained.status === "settled" ? "settled" : "error" });
  }
  record.ownedBrowserPid = ownedProcess?.pid ?? null;
  record.ownedBrowserExited = observedExit();
  record.ownedBrowserExitCode = ownedProcess?.exitCode ?? null;
  record.ownedBrowserSignal = ownedProcess?.signalCode ?? null;
  record.serverListening = server?.httpServer?.listening ?? false;
  record.parserExited = parserExited;
  record.pendingSdkPromises = sdkPending.size;
  record.pendingActionCount = pendingActions.size;
  record.pendingActions = [...pendingActions.values()];
  record.lateOwnedResourcesClosed = (evidence.lateOwnedResources ?? []).every(
    (row) => row.status === "closed",
  );
  record.elapsedMs = performance.now() - cleanupStarted;
  record.finishedAtUtc = new Date().toISOString();
  record.status =
    record.steps.every((row) => row.status === "settled") &&
    record.ownedBrowserExited !== false &&
    record.serverListening === false &&
    parserExited &&
    record.pendingSdkPromises === 0 &&
    record.pendingActionCount === 0 &&
    record.lateOwnedResourcesClosed &&
    record.elapsedMs <= limits.cleanupTotal
      ? "PASS"
      : "ERROR";
}
try {
  await bounded("paired-node-whole", limits.whole, main);
} catch (error) {
  evidence.status = "ERROR";
  evidence.error = String(error);
  evidence.stack = error.stack;
  evidence.startupObservation = startupObserver?.snapshot() ?? null;
  attachNativeDownloadCleanup(evidence, error);
  process.stderr.write(`${String(error)}\n`);
} finally {
  stopped = true;
  evidence.mainElapsedMs = performance.now() - started;
  try {
    await cleanup();
  } catch (error) {
    evidence.cleanup.status = "ERROR";
    evidence.cleanup.error = String(error);
    attachNativeDownloadCleanup(evidence.cleanup, error);
  }
  if (
    evidence.mainElapsedMs > limits.whole ||
    evidence.cleanup.status !== "PASS" ||
    evidence.sourcesUnchanged === false ||
    evidence.partialRecoveryAttempted ||
    errors.length > 0 ||
    evidence.startupTelemetryComplete === false ||
    evidence.pageErrorOverflow > 0 ||
    evidence.consoleOverflow > 0
  )
    evidence.status = "ERROR";
  evidence.finishedAtUtc = new Date().toISOString();
  evidence.totalElapsedMs = performance.now() - started;
  if (evidence.totalElapsedMs > limits.whole + limits.cleanupTotal) evidence.status = "ERROR";
  try {
    persistSync();
  } catch (error) {
    evidence.status = "ERROR";
    process.stderr.write(`PAIRED_RECEIPT_WRITE_FAILED:${String(error)}\n`);
  }
  if (
    sdkPending.size > 0 ||
    pendingActions.size > 0 ||
    !parserExited ||
    observedExit() === false ||
    server?.httpServer?.listening ||
    evidence.lateOwnedResources?.some((row) => row.status !== "closed")
  )
    ownedEmergencyStop("OWNED_PENDING_WORK_AFTER_BOUNDED_CLEANUP");
  // Every timer and receipt FD belongs only to this runner.
  clearTimeout(hardStop);
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  if (resultFd !== null) closeSync(resultFd);
  console.log(
    JSON.stringify({
      resultPath,
      status: evidence.status,
      mainElapsedMs: evidence.mainElapsedMs,
      cleanupElapsedMs: evidence.cleanup.elapsedMs,
      ownedBrowserPid: evidence.ownedBrowserPid,
      ownedBrowserExited: evidence.cleanup.ownedBrowserExited,
      serverListening: evidence.cleanup.serverListening,
      fixtureReady: evidence.fixtureReady ?? false,
    }),
  );
  if (evidence.status !== "PASS") process.exitCode = 1;
}
