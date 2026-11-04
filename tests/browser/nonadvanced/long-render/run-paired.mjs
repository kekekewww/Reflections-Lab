import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { readFile, mkdir, realpath } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { OwnedDownloadBatch } from "./owned-downloads.mjs";
import { createOwnedNativeDownloadTransport } from "./native-download-transport.mjs";

const started = performance.now();
const startedAtUtc = new Date().toISOString();
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const stamp = startedAtUtc.replace(/[:.]/g, "");
const lane = path.join(root, "docs/16-nonadvanced-completion/lanes/long-render");
const directory = path.join(root, ".cache/nonadvanced-long-render-paired", stamp);
const resultPath = path.join(lane, `paired-native-${stamp}.json`);
const executablePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const limits = Object.freeze({
  whole: 270000,
  dsp: 150000,
  downloads: 90000,
  parser: 45000,
  cleanupTotal: 10000,
});
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
  transport;
let parserExited = true,
  cleanupStarted = null;
const evidence = {
  schemaVersion: "paired-native-run-v1",
  status: "RUNNING",
  startedAtUtc,
  root,
  directory,
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
  writeFileSync(resultPath, JSON.stringify(evidence, null, 2) + "\n");
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
  let timer;
  const pending = observe(Promise.resolve().then(action));
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
async function acquired(name, milliseconds, create, closeLate) {
  const creating = observe(Promise.resolve().then(create));
  void creating.then(
    (handle) => {
      if (stopped) {
        const row = {
          name,
          status: "closing-late-owned-handle",
          ownedPid: typeof handle.process === "function" ? handle.process().pid : null,
        };
        (evidence.lateOwnedResources ??= []).push(row);
        const closing = observe(Promise.resolve().then(() => closeLate(handle)));
        void closing.then(
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
    },
    () => undefined,
  );
  const result = await bounded(name, milliseconds, () => creating);
  assertActive();
  return result;
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
  await mkdir(lane, { recursive: true });
  await mkdir(directory, { recursive: true });
  const actualRoot = await realpath(root),
    actualCwd = await realpath(process.cwd());
  if (path.relative(actualRoot, actualCwd) !== "") throw new Error("PAIRED_WRONG_WORKTREE_CWD");
  evidence.sourceAtStart = await phase("source-start-receipt", 15000, () =>
    receipt(Math.min(started + limits.whole, performance.now() + 14500)),
  );
  assertActive();
  evidence.executableSha256 = await phase("browser-executable-hash", 10000, async () =>
    createHash("sha256")
      .update(await readFile(executablePath))
      .digest("hex"),
  );
  server = await acquired(
    "owned-vite-create",
    15000,
    () =>
      createServer({
        configFile: false,
        root,
        cacheDir: path.join(root, ".cache/paired-long-render-vite"),
        server: { host: "127.0.0.1", port: 5353, strictPort: true },
      }),
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
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) =>
    console.log(`paired-browser:${message.type()}:${message.text()}`),
  );
  await phase("owned-fixture-open", 15000, () =>
    page.goto("http://127.0.0.1:5353/tests/browser/nonadvanced/long-render/paired-index.html", {
      timeout: 10000,
    }),
  );
  await phase("paired-fixture-ready", 10000, () =>
    page.waitForFunction(
      () =>
        typeof window.runPairedNativeWholeMaster === "function" &&
        typeof window.pairedExpectedOutputs === "function",
      null,
      { timeout: 8000 },
    ),
  );
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
          errors.length === 0
        ? "PASS"
        : "FAIL";
}
async function cleanup() {
  cleanupStarted = performance.now();
  const record = evidence.cleanup;
  record.status = "RUNNING";
  record.startedAtUtc = new Date().toISOString();
  const remaining = () => Math.max(0, limits.cleanupTotal - (performance.now() - cleanupStarted));
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
  // Cancel flags are set immediately; only already-owned download handles/GUIDs are touched.
  if (batch || transport)
    await step("owned-download-cancel", 1000, () =>
      Promise.allSettled([
        ...(batch ? [batch.cancel()] : []),
        ...(transport ? [transport.cancel()] : []),
      ]),
    );
  if (page && !page.isClosed()) await step("owned-page-close", 1000, () => page.close());
  if (browser) await step("owned-browser-close", 1500, () => browser.close());
  if (browserServer && observedExit() === false)
    await step("owned-browser-server-kill", 2000, () => browserServer.kill());
  if (parserWorker && !parserExited)
    await step("owned-parser-worker-terminate", 1000, () => parserWorker.terminate());
  if (server) {
    server.httpServer?.closeAllConnections();
    await step("owned-vite-close", 1500, () => server.close());
    if (server.httpServer?.listening) server.httpServer.close();
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
  record.ownedBrowserPid = ownedProcess?.pid ?? null;
  record.ownedBrowserExited = observedExit();
  record.ownedBrowserExitCode = ownedProcess?.exitCode ?? null;
  record.ownedBrowserSignal = ownedProcess?.signalCode ?? null;
  record.serverListening = server?.httpServer?.listening ?? false;
  record.parserExited = parserExited;
  record.pendingSdkPromises = sdkPending.size;
  record.elapsedMs = performance.now() - cleanupStarted;
  record.finishedAtUtc = new Date().toISOString();
  record.status =
    record.steps.every((row) => row.status === "settled") &&
    record.ownedBrowserExited !== false &&
    record.serverListening === false &&
    parserExited &&
    record.pendingSdkPromises === 0 &&
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
    evidence.sourcesUnchanged === false
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
  // Every timer belongs to this runner. Never leave a delayed callback to affect later work.
  clearTimeout(hardStop);
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  console.log(
    JSON.stringify({
      resultPath,
      status: evidence.status,
      mainElapsedMs: evidence.mainElapsedMs,
      cleanupElapsedMs: evidence.cleanup.elapsedMs,
      ownedBrowserPid: evidence.ownedBrowserPid,
      ownedBrowserExited: evidence.cleanup.ownedBrowserExited,
      serverListening: evidence.cleanup.serverListening,
    }),
  );
  if (evidence.status !== "PASS") process.exitCode = 1;
  if (sdkPending.size > 0 || !parserExited) {
    // All feasible owned cleanup above has already been attempted within the ten-second total.
    ownedEmergencyStop("OWNED_PENDING_WORK_AFTER_BOUNDED_CLEANUP");
  }
}
