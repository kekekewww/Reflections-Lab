import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { readFile, mkdir, realpath, lstat } from "node:fs/promises";
import { openSync, writeSync, ftruncateSync, closeSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPairedStartupViteOptions,
  observeOwnedPairedStartup,
} from "./paired-startup-probe.mjs";
import { closeOwnedBrowserServer, drainOwnedPendingActions } from "./owned-cleanup.mjs";
import { createStartupObservabilityV2 } from "./paired-startup-observability-v2.mjs";
import { acquireOwnedPageBeforeListen } from "./startup-page-before-listen.mjs";

// Node performance.now() starts at process startup, including static import work.
const started = 0;
const startedAtUtc = new Date(performance.timeOrigin).toISOString();
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, "");
const lane = path.join(root, "docs/16-nonadvanced-completion/lanes/long-render");
const parentDirectory = path.join(root, ".cache/nonadvanced-long-render-startup-v3");
const directory = path.join(parentDirectory, stamp);
const cacheDir = path.join(directory, "vite-cache");
const resultPath = path.join(lane, `startup-probe-v3-${stamp}.json`);
const origin = "http://127.0.0.1:5353";
const fixtureHtml = "tests/browser/nonadvanced/long-render/paired-v3-index.html";
const fixtureUrl = `${origin}/${fixtureHtml}`;
const executablePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const expectedExecutableSha256 = "7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa";
const limits = Object.freeze({
  main: 25000,
  cleanupTotal: 10000,
  total: 35000,
  fixtureOpen: 15000,
  gotoLoad: 10000,
  fixtureReady: 10000,
  readyPredicate: 8000,
  stateCapture: 500,
});
const timers = new Set();
const sdkPending = new Set();
const pendingActions = new Map();
const phases = [];
let stopped = false;
let resultFd = null;
let server, browserServer, browser, context, page, observer, ownedProcess;
let consoleListener;
let startupObservability,
  startupObservabilityDisposed = false;
const evidence = {
  schemaVersion: "paired-startup-only-probe-v3",
  status: "RUNNING",
  startedAtUtc,
  root,
  directory,
  cacheDir,
  fixtureUrl,
  method:
    "One cold, entry-scoped, page-before-listen versioned startup-only probe of the V3 fixture. No DSP, output job, render, download, warmup or prerequest is invoked.",
  gate: "Original load 10s then readiness 8s: five original functions, releasePairedV3Exports and paired-v3-progress-v1 schema. Not a waveform or product gate.",
  scopeDefect:
    "Unscoped optimizer scanning extra root HTML was proven; the remaining 8.28s blocking HTTP/import is UNKNOWN.",
  methodPin: {
    version: "startup-v3-page-before-listen-v3-entry-six-functions-and-progress-v1",
    baseCoordinatorCommit: "b31739c100ab0552d60b5bf3b4ab9b4f5fa5e6dc",
    baseCoordinatorPath: "tests/browser/nonadvanced/long-render/run-startup-probe-v2.mjs",
    orderingIntervention:
      "PROPOSED isolation only: createServer, then launch/connect/context and retain a blank page, then listen, then observe/navigate/ready; not a proven cause or PASS.",
    timingInterpretation:
      "Unavailable timing remains -1; no aggregate maximum is assigned an inferred maxAt timestamp.",
    targetHtml: fixtureHtml,
    optimizerEntries: [fixtureHtml],
    originalFiveFunctions: [
      "runPairedNativeWholeMaster",
      "pairedManifest",
      "pairedCheckSnapshot",
      "pairedExpectedOutputs",
      "nativeLongDownload",
    ],
    additionalReadiness: {
      function: "releasePairedV3Exports",
      partialProperty: "__pairedV3Partial",
      partialSchemaVersion: "paired-v3-progress-v1",
    },
    changedMethodSources: [
      "versioned coordinator",
      "V3 HTML target/readiness",
      "public owned BrowserServer close and pending-action drain",
      "three-clock startup observability",
      "versioned page-before-listen ordering helper",
    ],
    claim:
      "This is a versioned method; it does not claim all original 392 source hashes are identical.",
    processClock: "performance.now() from process startup including static imports",
    observationClock:
      "relative to observability construction; unknown timing stays -1 in helper snapshots",
    observationCaps: {
      eventsPerChannel: 512,
      channels: ["server", "browser", "operations"],
      totalNewEvents: 1536,
      inflightPerHttpChannel: 256,
      totalNewInflight: 512,
      heartbeatIntervalMs: 50,
      heartbeatMaxSamples: 1024,
      heartbeatStorage: "bounded scalar aggregates",
      legacyObserverEvents: 512,
    },
    helperSources: [
      "startup-page-before-listen.mjs",
      "owned-cleanup.mjs",
      "paired-startup-observability-v2.mjs",
      "paired-startup-probe.mjs",
    ],
  },
  historical: {
    startupProbeV2B317: "OWNED_BROWSER_PAGE_ERROR_PRESERVED_NOT_RERUN",
    pairedV3C740: "ERROR_PRESERVED_NOT_RERUN",
    pairedBaselineAttempt01: "STARTUP_ERROR_PRESERVED_NOT_RERUN",
    originalAttempt02: "ERROR_PRESERVED",
    originalWhole63Gate: "FAIL_PRESERVED_NOT_RERUN",
    original16Downloads: "INCOMPLETE_PRESERVED_NOT_RERUN",
  },
  limitsMs: limits,
  phases,
  dspCalls: 0,
  graphsCompleted: 0,
  outputJobsCreated: 0,
  downloadsRequested: 0,
  console: [],
  consoleOverflow: 0,
  cleanup: { status: "NOT_STARTED", steps: [] },
};

function persistSync() {
  if (resultFd === null) throw new Error("STARTUP_RECEIPT_NOT_EXCLUSIVELY_CLAIMED");
  const bytes = Buffer.from(JSON.stringify(evidence, null, 2) + "\n");
  let written = 0;
  while (written < bytes.length) {
    const count = writeSync(resultFd, bytes, written, bytes.length - written, written);
    if (count < 1) throw new Error("STARTUP_RECEIPT_SHORT_WRITE");
    written += count;
  }
  ftruncateSync(resultFd, bytes.length);
}
function observedExit() {
  return ownedProcess ? ownedProcess.exitCode !== null || ownedProcess.signalCode !== null : null;
}
function sdk(promise) {
  const pending = Promise.resolve(promise);
  sdkPending.add(pending);
  void pending.catch(() => undefined);
  void pending.then(
    () => sdkPending.delete(pending),
    () => sdkPending.delete(pending),
  );
  return pending;
}
function assertActive() {
  if (stopped) throw new Error("STARTUP_PROBE_STOPPED");
}
function mainRemaining() {
  return Math.max(0, limits.main - (performance.now() - started));
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
async function phase(name, maximum, action) {
  assertActive();
  const budget = Math.floor(Math.min(maximum, mainRemaining()));
  const begin = performance.now();
  const row = {
    name,
    deadlineMs: budget,
    startedAtUtc: new Date().toISOString(),
    status: "RUNNING",
  };
  phases.push(row);
  console.log(`STARTUP_PHASE_START:${name}:${budget}`);
  try {
    const result = await bounded(name, budget, action);
    assertActive();
    row.status = "settled";
    return result;
  } catch (error) {
    row.status = "error";
    row.error = String(error);
    throw error;
  } finally {
    row.elapsedMs = performance.now() - begin;
  }
}
function startupOperation(name, action) {
  if (!startupObservability || startupObservabilityDisposed) return action();
  return startupObservability.operation(name, action);
}
async function acquired(name, maximum, create, closeLate) {
  let candidate,
    abandoned = false,
    closing = false;
  const creating = sdk(
    Promise.resolve().then(() => startupOperation(`sdk-create:${name}`, create)),
  );
  function closeAbandoned(handle) {
    if (closing) return;
    closing = true;
    const row = {
      name,
      status: "closing-late-owned-handle",
      ownedPid: typeof handle.process === "function" ? handle.process().pid : null,
    };
    (evidence.lateOwnedResources ??= []).push(row);
    const closed = sdk(
      Promise.resolve().then(() =>
        startupOperation(`sdk-late-close:${name}`, () => closeLate(handle)),
      ),
    );
    void closed.then(
      () => {
        row.status = "closed";
      },
      (error) => {
        row.status = "error";
        row.error = String(error);
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
async function receipt(deadline) {
  const git = (...args) => {
    const remaining = Math.floor(deadline - performance.now() - 50);
    if (remaining < 1) throw new Error("STARTUP_SOURCE_RECEIPT_DEADLINE");
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: Math.min(1500, remaining),
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
        "server",
        "schemas",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        ".node-version",
        "tests/audio-runtime/render-fixture.ts",
        "tests/audio-runtime/render-paired-startup-probe.test.mjs",
        "tests/audio-runtime/render-owned-cleanup.test.mjs",
        "tests/audio-runtime/render-startup-observability-v2.test.mjs",
        "tests/audio-runtime/render-startup-page-before-listen.test.mjs",
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
  if (performance.now() >= deadline) throw new Error("STARTUP_SOURCE_HASH_DEADLINE");
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
function sourceUnchanged() {
  evidence.sourcesUnchanged =
    !!evidence.sourceAtStart &&
    !!evidence.sourceAtEnd &&
    evidence.sourceAtStart.head === evidence.sourceAtEnd.head &&
    evidence.sourceAtStart.sourceSetSha256 === evidence.sourceAtEnd.sourceSetSha256;
}
async function captureState(name, budget) {
  if (!observer) return;
  evidence.observation = observer.snapshot();
  try {
    evidence.observation = await bounded(
      name,
      Math.floor(Math.min(limits.stateCapture, budget)),
      () => sdk(observer.captureState()),
    );
  } catch (error) {
    evidence.stateCaptureError = String(error);
    evidence.observation = observer.snapshot();
  }
}
function telemetryComplete(snapshot) {
  return (
    !!snapshot &&
    Object.values(snapshot.overflow).every((value) => value === 0) &&
    snapshot.counts.observerErrors === 0 &&
    snapshot.counts.unknownIgnored === 0 &&
    snapshot.browserState.error === null
  );
}
function summarizeStartupHttpCorrelation(snapshot, required) {
  const serverUrls = [
    ...new Set(
      snapshot.server.events.filter((event) => event.type === "receive").map((event) => event.url),
    ),
  ];
  const browserUrls = [
    ...new Set(
      snapshot.browser.events.filter((event) => event.type === "request").map((event) => event.url),
    ),
  ];
  const serverSet = new Set(serverUrls),
    browserSet = new Set(browserUrls);
  const matchedUrls = browserUrls.filter((url) => serverSet.has(url));
  return {
    requiredForSuccessfulStartup: required,
    serverReceived: snapshot.server.counts.received,
    browserRequests: snapshot.browser.counts.requests,
    matchedUrls,
    browserUrlsWithoutServerReceive: browserUrls.filter((url) => !serverSet.has(url)),
    serverUrlsWithoutBrowserRequest: serverUrls.filter((url) => !browserSet.has(url)),
    criterionMet:
      snapshot.server.counts.received > 0 &&
      snapshot.browser.counts.requests > 0 &&
      matchedUrls.length > 0 &&
      browserUrls.every((url) => serverSet.has(url)),
    terminalCallbacks: {
      serverFinished: snapshot.server.counts.finished,
      serverClosedWithoutFinish: snapshot.server.counts.closed,
      browserRequestFinished: snapshot.browser.counts.finished,
      browserRequestFailed: snapshot.browser.counts.failed,
    },
    note: required
      ? "Every observed own-page browser request URL requires a server receive; extra server URLs remain explicit, with no fixed count or cross-clock subtraction."
      : "Original startup failed; preserve raw URL and terminal records without forcing a successful HTTP correspondence.",
  };
}
function completeStartupObservabilityV2(snapshot, httpCorrelation) {
  if (!snapshot || snapshot.schemaVersion !== "paired-startup-observability-v2") return false;
  const overflows = [
    snapshot.overflow.errors,
    snapshot.overflow.text,
    snapshot.server.overflow.events,
    snapshot.server.overflow.inflight,
    snapshot.browser.overflow.events,
    snapshot.browser.overflow.inflight,
    snapshot.operations.overflow.events,
  ];
  return (
    snapshot.disposed === true &&
    snapshot.observerErrors === 0 &&
    snapshot.errors.length === 0 &&
    overflows.every((value) => value === 0) &&
    snapshot.server.counts.observerErrors === 0 &&
    snapshot.browser.counts.observerErrors === 0 &&
    snapshot.browser.counts.unknownIgnored === 0 &&
    snapshot.server.inflight.length === 0 &&
    snapshot.browser.inflight.length === 0 &&
    snapshot.operations.activeCount === 0 &&
    snapshot.heartbeat.sampleCount > 0 &&
    snapshot.heartbeat.sampleLimitReached === false &&
    (!httpCorrelation.requiredForSuccessfulStartup || httpCorrelation.criterionMet)
  );
}
async function verifiedDirectory(target, actualRoot, allowRoot = false, expected) {
  assertActive();
  const stat = await lstat(target);
  assertActive();
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("STARTUP_DIRECTORY_SYMLINK_OR_NOT_DIRECTORY");
  const actual = await realpath(target);
  assertActive();
  const relative = path.relative(actualRoot, actual);
  if (
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    (!allowRoot && relative === "")
  )
    throw new Error("STARTUP_DIRECTORY_OUTSIDE_OWN_CHECKOUT");
  const identity = { path: actual, device: String(stat.dev), inode: String(stat.ino) };
  if (
    expected &&
    (identity.path !== expected.path ||
      identity.device !== expected.device ||
      identity.inode !== expected.inode)
  )
    throw new Error("STARTUP_DIRECTORY_IDENTITY_CHANGED");
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
async function main() {
  assertActive();
  const actualRoot = await realpath(root);
  assertActive();
  const actualCwd = await realpath(process.cwd());
  assertActive();
  if (path.relative(actualRoot, actualCwd) !== "") throw new Error("STARTUP_WRONG_WORKTREE_CWD");
  const rootIdentity = await verifiedDirectory(root, actualRoot, true);
  assertActive();
  const laneIdentity = await verifiedDirectory(lane, actualRoot);
  assertActive();
  const cacheIdentity = await ownedChildDirectory(rootIdentity, ".cache", actualRoot, false);
  assertActive();
  const parentIdentity = await ownedChildDirectory(
    cacheIdentity,
    "nonadvanced-long-render-startup-v3",
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
  evidence.sourceAtStart = await phase("source-start-receipt", 4000, () =>
    receipt(Math.min(limits.main, performance.now() + 3900)),
  );
  evidence.executableSha256 = await phase("browser-executable-hash", 2000, async () =>
    createHash("sha256")
      .update(await readFile(executablePath))
      .digest("hex"),
  );
  if (evidence.executableSha256 !== expectedExecutableSha256)
    throw new Error("STARTUP_BROWSER_EXECUTABLE_CHANGED");
  startupObservability = createStartupObservabilityV2({
    origin,
    heartbeatIntervalMs: 50,
    maxHeartbeatSamples: 1024,
    maxEvents: 512,
    maxInflight: 256,
  });
  startupObservability.marker("before-vite-create");
  const baseViteOptions = createPairedStartupViteOptions(root, cacheDir);
  const scopedOptimizer = { ...baseViteOptions.optimizeDeps, entries: [fixtureHtml] };
  const observationPluginName = "paired-startup-observability-v2";
  const viteOptions = {
    ...baseViteOptions,
    optimizeDeps: scopedOptimizer,
    plugins: [
      {
        name: observationPluginName,
        configureServer(ownedServer) {
          ownedServer.middlewares.use(startupObservability.middleware);
        },
      },
    ],
  };
  evidence.viteOptions = {
    ...structuredClone(baseViteOptions),
    optimizeDeps: structuredClone(scopedOptimizer),
    observationPlugin: {
      name: observationPluginName,
      method:
        "public configureServer pre hook before Vite internal middleware; no warmup or prerequest",
    },
  };
  server = await acquired(
    "owned-vite-create",
    5000,
    () => createServer(viteOptions),
    (late) => late.close(),
  );

  browserServer = await acquired(
    "owned-browser-launch",
    12000,
    () =>
      chromium.launchServer({
        executablePath,
        host: "127.0.0.1",
        timeout: 12000,
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
    3000,
    () => chromium.connect(browserServer.wsEndpoint(), { timeout: 3000 }),
    (late) => late.close(),
  );
  evidence.browserVersion = browser.version();
  evidence.nodeVersion = process.version;
  context = await acquired(
    "owned-browser-context",
    2000,
    () => browser.newContext({ acceptDownloads: false }),
    (late) => late.close(),
  );
  await acquireOwnedPageBeforeListen({
    acquirePage: () =>
      acquired(
        "owned-browser-page",
        2000,
        () => context.newPage(),
        (late) => late.close(),
      ),
    retainPage: (owned) => {
      page = owned;
    },
    listen: () => {
      startupObservability.marker("before-vite-listen-after-blank-page");
      return phase("owned-vite-listen", 3000, () =>
        sdk(startupOperation("sdk-vite-listen", () => server.listen())),
      );
    },
  });
  assertActive();
  startupObservability.attachPage(page);
  observer = observeOwnedPairedStartup(page, { origin, maxEvents: 512, maxInflight: 256 });
  consoleListener = (message) => {
    if (evidence.console.length >= 128) {
      evidence.consoleOverflow++;
      return;
    }
    const row = {
      type: message.type(),
      text: message.text().slice(0, 2048),
      elapsedMs: performance.now() - started,
    };
    evidence.console.push(row);
    console.log(`startup-browser:${row.type}:${row.text}`);
  };
  page.on("console", consoleListener);
  const response = await phase("owned-fixture-open", limits.fixtureOpen, () =>
    sdk(
      startupOperation("inner-goto", () =>
        page.goto(fixtureUrl, { waitUntil: "load", timeout: limits.gotoLoad }),
      ),
    ),
  );
  evidence.navigation = {
    url: page.url(),
    status: response?.status() ?? null,
    waitUntil: "load",
    timeoutMs: limits.gotoLoad,
  };
  if (!response || response.status() !== 200 || page.url() !== fixtureUrl)
    throw new Error("STARTUP_FIXTURE_NAVIGATION_IDENTITY");
  await phase("paired-fixture-ready", limits.fixtureReady, () =>
    sdk(
      startupOperation("inner-ready", () =>
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
          { timeout: limits.readyPredicate },
        ),
      ),
    ),
  );
  evidence.fixtureReady = true;
  startupObservability.marker("v3-fixture-ready-no-render");
  await captureState("startup-ready-state", mainRemaining());
  evidence.telemetryComplete =
    telemetryComplete(evidence.observation) && evidence.consoleOverflow === 0;
  if (
    !evidence.observation?.browserState.allGlobalsReady ||
    evidence.observation.browserState.readyState !== "complete"
  )
    throw new Error("STARTUP_READY_STATE_NOT_CONFIRMED");
  if (!evidence.telemetryComplete || evidence.observation.pageErrors.length !== 0)
    throw new Error("STARTUP_OBSERVATION_INCOMPLETE_OR_PAGE_ERROR");
  evidence.sourceAtEnd = await phase("source-end-receipt", 3000, () =>
    receipt(Math.min(limits.main, performance.now() + 2900)),
  );
  sourceUnchanged();
  evidence.status = evidence.sourcesUnchanged ? "PASS" : "ERROR";
}
async function cleanup() {
  const began = performance.now();
  const record = evidence.cleanup;
  record.status = "RUNNING";
  record.startedAtUtc = new Date().toISOString();
  const remaining = () =>
    Math.max(
      0,
      Math.min(
        limits.cleanupTotal - (performance.now() - began),
        limits.total - (performance.now() - started),
      ),
    );
  async function step(name, maximum, action) {
    const budget = Math.floor(Math.min(maximum, remaining()));
    const row = { name, budgetMs: budget, status: "RUNNING" };
    record.steps.push(row);
    const begin = performance.now();
    if (budget < 1) {
      row.status = "budget-exhausted";
      return;
    }
    try {
      await bounded(name, budget, () => startupOperation(`cleanup-step:${name}`, action));
      row.status = "settled";
    } catch (error) {
      row.status = "error";
      row.error = String(error);
    } finally {
      row.elapsedMs = performance.now() - begin;
    }
  }
  if (observer) {
    if (!evidence.fixtureReady)
      await step("failure-browser-state", limits.stateCapture, () =>
        captureState("failure-state-read", limits.stateCapture),
      );
    evidence.observation = observer.snapshot();
    evidence.telemetryComplete =
      telemetryComplete(evidence.observation) && evidence.consoleOverflow === 0;
    await step("owned-observer-dispose", 500, () => {
      evidence.observation = observer.dispose();
      evidence.observerDisposed = evidence.observation.disposed === true;
      evidence.telemetryComplete =
        telemetryComplete(evidence.observation) && evidence.consoleOverflow === 0;
      if (!evidence.observerDisposed || evidence.observation.counts.observerErrors !== 0)
        throw new Error("STARTUP_OBSERVER_DISPOSE_ERROR");
    });
  }
  if (page && consoleListener)
    await step("owned-console-listener-dispose", 500, () => page.off("console", consoleListener));
  if (page && !page.isClosed()) await step("owned-page-close", 1000, () => sdk(page.close()));
  if (context) await step("owned-context-close", 1000, () => sdk(context.close()));
  if (browserServer)
    await closeOwnedBrowserServer({ browserServer, observedExit, step, closeBudgetMs: 1000 });
  if (server) {
    await step("owned-vite-close", 1500, async () => {
      try {
        server.httpServer?.closeAllConnections();
      } finally {
        await sdk(server.close());
      }
    });
    if (server.httpServer?.listening)
      await step("owned-http-server-close", 500, () => {
        server.httpServer.close();
      });
  }
  if (!evidence.sourceAtEnd && evidence.sourceAtStart && remaining() > 1200)
    await step("source-error-end-receipt", Math.min(2500, remaining() - 100), async () => {
      evidence.sourceAtEnd = await receipt(
        Math.min(limits.total - 100, performance.now() + remaining() - 100),
      );
      sourceUnchanged();
    });
  if (sdkPending.size)
    await step("owned-sdk-settle", Math.min(1000, remaining()), async () => {
      while (sdkPending.size) await Promise.allSettled([...sdkPending]);
    });
  const drainRow = { name: "owned-pending-actions-drain", status: "RUNNING" };
  record.steps.push(drainRow);
  try {
    const drain = await drainOwnedPendingActions(pendingActions, {
      remainingMs: remaining,
      exclude: [],
    });
    record.pendingActionDrain = drain;
    Object.assign(drainRow, drain, {
      status: drain.status === "settled" ? "settled" : "error",
      drainStatus: drain.status,
    });
  } catch (error) {
    drainRow.status = "error";
    drainRow.error = String(error);
  }
  if (startupObservability) {
    const row = { name: "owned-startup-observability-dispose", status: "RUNNING" };
    record.steps.push(row);
    const begin = performance.now();
    try {
      startupObservability.marker("cleanup-final");
      startupObservability.dispose();
      startupObservabilityDisposed = true;
      evidence.startupObservability = startupObservability.snapshot();
      evidence.startupHttpCorrelation = summarizeStartupHttpCorrelation(
        evidence.startupObservability,
        evidence.status === "PASS" && evidence.fixtureReady === true,
      );
      evidence.startupObservabilityComplete = completeStartupObservabilityV2(
        evidence.startupObservability,
        evidence.startupHttpCorrelation,
      );
      row.observationComplete = evidence.startupObservabilityComplete;
      row.status = "settled";
    } catch (error) {
      row.status = "error";
      row.error = String(error);
    } finally {
      row.elapsedMs = performance.now() - begin;
    }
  }
  record.ownedBrowserPid = ownedProcess?.pid ?? null;
  record.ownedBrowserExited = observedExit();
  record.ownedBrowserExitCode = ownedProcess?.exitCode ?? null;
  record.ownedBrowserSignal = ownedProcess?.signalCode ?? null;
  record.serverListening = server?.httpServer?.listening ?? false;
  record.pendingSdkPromises = sdkPending.size;
  record.pendingActionCount = pendingActions.size;
  record.pendingActions = [...pendingActions.values()];
  record.lateOwnedResourcesClosed = (evidence.lateOwnedResources ?? []).every(
    (row) => row.status === "closed",
  );
  record.elapsedMs = performance.now() - began;
  record.finishedAtUtc = new Date().toISOString();
  record.status =
    record.steps.every((row) => row.status === "settled") &&
    record.ownedBrowserExited !== false &&
    record.serverListening === false &&
    sdkPending.size === 0 &&
    pendingActions.size === 0 &&
    record.lateOwnedResourcesClosed &&
    record.elapsedMs <= limits.cleanupTotal
      ? "PASS"
      : "ERROR";
}
function emergencyStop(reason) {
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
    note: "Only this runner's owned stops were issued; Root must inspect the recorded PID/port before releasing the machine lease.",
  };
  try {
    void browserServer?.kill().catch(() => undefined);
  } catch {
    /* actual emergency */
  }
  try {
    server?.httpServer?.closeAllConnections();
    server?.httpServer?.close();
  } catch {
    /* actual emergency */
  }
  try {
    persistSync();
  } catch {
    /* stderr preserves fatal reason */
  }
  try {
    if (startupObservability) {
      startupObservability.marker("emergency");
      startupObservability.dispose();
      startupObservabilityDisposed = true;
      evidence.startupObservability = startupObservability.snapshot();
      persistSync();
    }
  } catch {
    /* original emergency evidence remains authoritative */
  }
  process.stderr.write(`STARTUP_EMERGENCY_ERROR:${reason}\n`);
  process.exit(1);
}
const hardStop = setTimeout(
  () => emergencyStop("PROCESS_TOTAL_35000MS"),
  Math.max(1, limits.total - (performance.now() - started)),
);
try {
  await bounded("startup-node-main", Math.max(1, mainRemaining()), main);
} catch (error) {
  evidence.status = "ERROR";
  evidence.error = String(error);
  evidence.stack = error.stack;
  evidence.observation = observer?.snapshot() ?? null;
  process.stderr.write(`${String(error)}\n`);
} finally {
  stopped = true;
  evidence.mainElapsedMs = performance.now() - started;
  try {
    await cleanup();
  } catch (error) {
    evidence.cleanup.status = "ERROR";
    evidence.cleanup.error = String(error);
  }
  if (
    evidence.mainElapsedMs > limits.main ||
    evidence.cleanup.status !== "PASS" ||
    evidence.sourcesUnchanged === false ||
    evidence.telemetryComplete === false ||
    (evidence.observation?.pageErrors?.length ?? 0) > 0 ||
    evidence.startupObservabilityComplete !== true
  )
    evidence.status = "ERROR";
  evidence.finishedAtUtc = new Date().toISOString();
  evidence.totalElapsedMs = performance.now() - started;
  if (evidence.totalElapsedMs > limits.total) evidence.status = "ERROR";
  try {
    persistSync();
  } catch (error) {
    evidence.status = "ERROR";
    process.stderr.write(`STARTUP_RECEIPT_WRITE_FAILED:${String(error)}\n`);
  }
  if (
    sdkPending.size > 0 ||
    pendingActions.size > 0 ||
    observedExit() === false ||
    server?.httpServer?.listening ||
    evidence.lateOwnedResources?.some((row) => row.status !== "closed")
  )
    emergencyStop("OWNED_PENDING_WORK_AFTER_BOUNDED_CLEANUP");
  clearTimeout(hardStop);
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  if (resultFd !== null) closeSync(resultFd);
  console.log(
    JSON.stringify({
      resultPath,
      status: evidence.status,
      fixtureReady: evidence.fixtureReady ?? false,
      mainElapsedMs: evidence.mainElapsedMs,
      cleanupElapsedMs: evidence.cleanup.elapsedMs,
      totalElapsedMs: evidence.totalElapsedMs,
      ownedBrowserPid: evidence.ownedBrowserPid,
      ownedBrowserExited: evidence.cleanup.ownedBrowserExited,
      serverListening: evidence.cleanup.serverListening,
      dspCalls: evidence.dspCalls,
    }),
  );
  if (evidence.status !== "PASS") process.exitCode = 1;
}
