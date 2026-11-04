import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { OwnedDownloadBatch } from "./owned-downloads.mjs";

const root = process.cwd();
const baselineMix = Object.freeze({
  path: ".cache/nonadvanced-long-render/2026-11-02T184429091Z/mix.wav",
  sha256: "e3be2a05a360a29d56c182e532dceab1d861c32ba39fa01fc02378ca9bd4f33e",
  bytes: 23808056,
  route: "/__long-diagnostic-baseline-mix.wav",
  origin: "Preserved attempt01; b73512364d00bc1b8115e82b9a449b84b1a620be",
});
const stamp = new Date().toISOString().replace(/[:.]/g, "");
const evidenceDirectory = path.join(root, "docs/16-nonadvanced-completion/lanes/long-render");
const exportDirectory = path.join(root, ".cache/nonadvanced-long-render", stamp);
const browserExecutable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const deadlinesMs = Object.freeze({
  rendererCrash: 45000,
  store: 45000,
  dsp: 300000,
  downloads: 90000,
  independentParser: 45000,
  cleanupStep: 10000,
  serverClose: 5000,
});
await mkdir(evidenceDirectory, { recursive: true });
await mkdir(exportDirectory, { recursive: true });
const resultPath = path.join(evidenceDirectory, `native-${stamp}.json`);
const { sourceAtStart, server } = await prepareRunner();
async function prepareRunner() {
  try {
    const baselineMixBytes = await readFile(path.join(root, baselineMix.path));
    if (
      baselineMixBytes.length !== baselineMix.bytes ||
      createHash("sha256").update(baselineMixBytes).digest("hex") !== baselineMix.sha256
    )
      throw new Error("FIXED_ATTEMPT01_MIX_DEPENDENCY_MISMATCH");
    const sourceAtStart = await sourceReceipt();
    const server = await createServer({
      configFile: false,
      plugins: [
        {
          name: "fixed-attempt01-mix-dependency",
          configureServer(vite) {
            vite.middlewares.use((request, response, next) => {
              if (request.url !== baselineMix.route) {
                next();
                return;
              }
              if (request.method !== "GET") {
                response.writeHead(405);
                response.end();
                return;
              }
              response.writeHead(200, {
                "Content-Type": "audio/wav",
                "Content-Length": baselineMixBytes.length,
                "Cache-Control": "no-store",
                "X-Content-SHA256": baselineMix.sha256,
              });
              response.end(baselineMixBytes);
            });
          },
        },
      ],
      root,
      cacheDir: path.join(root, ".cache/long-render-vite"),
      server: { port: 5353, strictPort: true, host: "127.0.0.1" },
    });
    return { sourceAtStart, server };
  } catch (error) {
    await writeFile(
      resultPath,
      JSON.stringify(
        {
          status: "ERROR",
          phase: "runner-preflight",
          root,
          observedAtUtc: new Date().toISOString(),
          baselineMixDependency: baselineMix,
          error: String(error),
          stack: error.stack,
          browserLaunched: false,
          cleanup: "No browser or listening server was started.",
        },
        null,
        2,
      ) + "\n",
    );
    throw error;
  }
}
let browser, browserServer, ownedBrowserProcess;
let browserIdentity = null,
  dspStarted = false;
let capturedEvidence = null;
let crashChecks = [],
  storeChecks = [];
let activePage = null;
let downloadBatch = null;
const errors = [],
  phaseTimings = [];
try {
  await withDeadline("vite-start", 15000, () => server.listen());
  browserServer = await withDeadline("owned-browser-launch", 35000, () =>
    chromium.launchServer({
      executablePath: browserExecutable,
      host: "127.0.0.1",
      timeout: 30000,
      headless: true,
      args: ["--no-first-run", "--enable-precise-memory-info"],
    }),
  );
  ownedBrowserProcess = browserServer.process();
  browser = await withDeadline("owned-browser-connect", 15000, () =>
    chromium.connect(browserServer.wsEndpoint()),
  );
  browserIdentity = {
    browserVersion: browser.version(),
    browserExecutable,
    executableSha256: createHash("sha256")
      .update(await readFile(browserExecutable))
      .digest("hex"),
    ownedBrowserPid: ownedBrowserProcess.pid,
    ownedSpawnFile: ownedBrowserProcess.spawnfile,
    nodeVersion: process.version,
  };
  const context = await browser.newContext({ acceptDownloads: true });
  crashChecks = await timedPhase("renderer-crash", deadlinesMs.rendererCrash, () =>
    validateRendererCrash(context),
  );
  const page = await context.newPage();
  activePage = page;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => console.log(`browser:${message.type()}:${message.text()}`));
  await page.goto("http://127.0.0.1:5353/tests/browser/nonadvanced/long-render/index.html", {
    timeout: 30000,
  });
  await page.waitForFunction(
    () =>
      typeof window.runNativeLongValidation === "function" &&
      typeof window.runNativeStoreValidation === "function",
    null,
    { timeout: 30000 },
  );
  const stores = await timedPhase("store", deadlinesMs.store, () =>
    page.evaluate(() => window.runNativeStoreValidation()),
  );
  storeChecks = stores.checks;
  if (stores.status !== "PASS") throw new Error("NATIVE_STORE_PHASE_FAILED");
  // A separate full 300-second wall budget starts only after the storage phase settles.
  dspStarted = true;
  const result = await timedPhase("dsp", deadlinesMs.dsp, () =>
    page.evaluate(() => window.runNativeLongValidation()),
  );
  result.checks = [...crashChecks, ...storeChecks, ...result.checks];
  result.status = result.checks.every((check) => check.pass) ? "PASS" : "FAIL";
  capturedEvidence = {
    ...result,
    method:
      "Headless native OfflineAudioContext and native storage fixture; not product UI/native GUI input",
    revision: sourceAtStart.head,
    root,
    sourceAtStart,
    baselineMixDependency: baselineMix,
    sources: sourceAtStart.sources,
    ...browserIdentity,
    deadlinesMs,
    phaseTimings,
    errors,
    exportDirectory,
  };
  await persist();
  console.log(
    JSON.stringify({
      resultPath,
      status: result.status,
      checks: result.checks.map(({ id, pass }) => ({ id, pass })),
      errors,
    }),
  );
  const manifest = await page.evaluate(() => window.nativeLongManifest() ?? null);
  if (manifest?.result.status === "completed") {
    capturedEvidence.downloads = [];
    await timedPhase("downloads", deadlinesMs.downloads, async () => {
      const diagnosticManifest = await page.evaluate(
        () => window.nativeLongDiagnosticManifest() ?? null,
      );
      const diagnosticIds = diagnosticManifest
        ? [
            ...diagnosticManifest.files.map((file) => `diagnostic:${file.id}`),
            "diagnostic-manifest",
          ]
        : [];
      downloadBatch = new OwnedDownloadBatch(page, exportDirectory, (saved) =>
        capturedEvidence.downloads.push(saved),
      );
      await downloadBatch.run([
        ...manifest.files.map((file) => file.id),
        "manifest",
        "original-asset",
        ...diagnosticIds,
      ]);
    });
    try {
      const verified = await verifySavedDownloads(exportDirectory);
      capturedEvidence.independentFiles = verified.files;
      capturedEvidence.independentDiagnostics = verified.diagnostics;
    } catch (error) {
      capturedEvidence.independentFiles = { status: "FAIL", error: String(error) };
      capturedEvidence.status = "FAIL";
      process.exitCode = 1;
    }
    await persist();
    console.log(JSON.stringify({ independentFiles: capturedEvidence.independentFiles }));
  } else process.exitCode = 1;
  if (result.status !== "PASS" || errors.length) process.exitCode = 1;
} catch (error) {
  const partial = await withDeadline("partial-browser-checks", 2000, () =>
    dspStarted
      ? (activePage?.evaluate(() => window.nativeLongCheckSnapshot?.() ?? []) ??
        Promise.resolve([]))
      : Promise.resolve([]),
  ).catch(() => []);
  capturedEvidence = {
    ...capturedEvidence,
    status: "ERROR",
    root,
    revision: sourceAtStart.head,
    sourceAtStart,
    baselineMixDependency: baselineMix,
    sources: sourceAtStart.sources,
    ...browserIdentity,
    deadlinesMs,
    phaseTimings,
    checks: capturedEvidence?.checks ?? [...crashChecks, ...storeChecks, ...partial],
    error: String(error),
    stack: error.stack,
    errors,
    exportDirectory,
  };
  await persist();
  console.error(error);
  process.exitCode = 1;
} finally {
  const cleanup = {
    startedAtUtc: new Date().toISOString(),
    ownedBrowserPid: ownedBrowserProcess?.pid ?? null,
    steps: [],
  };
  const closeStep = async (name, action, timeout = deadlinesMs.cleanupStep) => {
    try {
      await withDeadline(name, timeout, action);
      cleanup.steps.push({ name, status: "closed" });
    } catch (error) {
      cleanup.steps.push({ name, status: "error", error: String(error) });
    }
  };
  // These handles were created above by this exact runner; no process enumeration or user app IDs.
  if (downloadBatch) await closeStep("owned-download-batch-cancel", () => downloadBatch.cancel());
  // Closing this owned page rejects event waits even when its evaluated action is blocked.
  if (activePage && !activePage.isClosed())
    await closeStep("owned-active-page-close", () => activePage.close());
  if (browser) await closeStep("owned-browser-connection-close", () => browser.close());
  if (browserServer && !processExited(ownedBrowserProcess))
    await closeStep("owned-browser-server-close", () => browserServer.close());
  if (browserServer && !processExited(ownedBrowserProcess))
    await closeStep("owned-browser-server-kill", () => browserServer.kill());
  cleanup.ownedBrowserExited = ownedBrowserProcess ? processExited(ownedBrowserProcess) : null;
  cleanup.ownedBrowserExitCode = ownedBrowserProcess?.exitCode ?? null;
  cleanup.ownedBrowserSignal = ownedBrowserProcess?.signalCode ?? null;
  if (downloadBatch) await closeStep("owned-download-batch-settle", () => downloadBatch.settle());
  await closeStep("owned-vite-close", () => server.close(), deadlinesMs.serverClose);
  if (server.httpServer?.listening) {
    server.httpServer.closeAllConnections();
    await closeStep(
      "owned-http-close",
      () =>
        new Promise((resolve, reject) => {
          server.httpServer.close((error) => (error ? reject(error) : resolve()));
        }),
      deadlinesMs.serverClose,
    );
  }
  cleanup.httpListening = server.httpServer?.listening ?? false;
  cleanup.finishedAtUtc = new Date().toISOString();
  capturedEvidence ??= {
    status: "ERROR",
    root,
    revision: sourceAtStart.head,
    sourceAtStart,
    ...browserIdentity,
    deadlinesMs,
    phaseTimings,
    errors,
    exportDirectory,
  };
  capturedEvidence.cleanup = cleanup;
  try {
    capturedEvidence.sourceAtEnd = await sourceReceipt();
    capturedEvidence.trackedSourcesUnchanged =
      capturedEvidence.sourceAtEnd.sourceSetSha256 === sourceAtStart.sourceSetSha256 &&
      capturedEvidence.sourceAtEnd.head === sourceAtStart.head &&
      capturedEvidence.sourceAtEnd.dependencies[0].observedSha256 === baselineMix.sha256;
  } catch (error) {
    capturedEvidence.sourceReceiptError = String(error);
    capturedEvidence.trackedSourcesUnchanged = false;
  }
  if (
    !capturedEvidence.trackedSourcesUnchanged ||
    cleanup.httpListening ||
    cleanup.ownedBrowserExited === false ||
    cleanup.steps.some((step) => step.status === "error")
  ) {
    capturedEvidence.status = "ERROR";
    process.exitCode = 1;
  }
  await persist();
  console.log(
    JSON.stringify({
      resultPath,
      status: capturedEvidence.status,
      cleanup,
      trackedSourcesUnchanged: capturedEvidence.trackedSourcesUnchanged,
    }),
  );
}

async function persist() {
  await writeFile(resultPath, JSON.stringify(capturedEvidence, null, 2) + "\n");
}
// Field-by-field JSON value equality: the browser summary may store keys in canonical (sorted)
// order, so only the key order of these scalar records is ignored; every value is still exact.
function sameJsonRecord(left, right) {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
    return JSON.stringify(left) === JSON.stringify(right);
  const keys = Object.keys(left).sort();
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(right).sort())) return false;
  return keys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}
function processExited(child) {
  return Boolean(child && (child.exitCode !== null || child.signalCode !== null));
}
async function withDeadline(name, milliseconds, action) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name.toUpperCase()}_NODE_WALL_DEADLINE_${milliseconds}MS`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function timedPhase(name, milliseconds, action) {
  const started = performance.now();
  console.log(`NATIVE_PHASE_START:${name}:${milliseconds}`);
  try {
    const result = await withDeadline(name, milliseconds, action);
    phaseTimings.push({
      name,
      milliseconds: performance.now() - started,
      deadlineMs: milliseconds,
      status: "settled",
    });
    return result;
  } catch (error) {
    phaseTimings.push({
      name,
      milliseconds: performance.now() - started,
      deadlineMs: milliseconds,
      status: "error",
      error: String(error),
    });
    throw error;
  }
}
async function sourceReceipt() {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const porcelain = git("status", "--porcelain=v1", "--untracked-files=all");
  const files = git(
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
    "tests/audio-runtime/render-diagnostic-statistics.test.ts",
    "tests/audio-runtime/render-owned-downloads.test.mjs",
    "tests/browser/nonadvanced/long-render",
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  const sources = await Promise.all(
    files.map(async (file) => ({
      path: file,
      sha256: createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex"),
    })),
  );
  return {
    dependencies: [
      {
        ...baselineMix,
        observedSha256: createHash("sha256")
          .update(await readFile(path.join(root, baselineMix.path)))
          .digest("hex"),
      },
    ],
    observedAtUtc: new Date().toISOString(),
    root: git("rev-parse", "--show-toplevel").trim(),
    head: git("rev-parse", "HEAD").trim(),
    branch: git("branch", "--show-current").trim(),
    porcelain,
    porcelainSha256: createHash("sha256").update(porcelain).digest("hex"),
    sources,
    sourceSetSha256: createHash("sha256").update(JSON.stringify(sources)).digest("hex"),
  };
}

// The independent parser runs outside the coordinator's event loop so its wall
// deadline remains enforceable even if parsing CPU work blocks its own thread.
async function verifySavedDownloads(directory) {
  const worker = new Worker(
    `
    const { parentPort, workerData } = require("node:worker_threads");
    const { readFile } = require("node:fs/promises");
    const { createHash } = require("node:crypto");
    const path = require("node:path");
    const baselineMix = workerData.baselineMix;
    ${verifyExportDirectory.toString()}
    ${verifyDiagnosticDirectory.toString()}
    ${sameJsonRecord.toString()}
    (async () => {
      const files = await verifyExportDirectory(workerData.directory);
      const diagnostics = await verifyDiagnosticDirectory(workerData.directory);
      parentPort.postMessage({ ok: true, files, diagnostics });
    })().catch((error) => parentPort.postMessage({ ok: false, error: String(error), stack: error.stack }));
  `,
    { eval: true, workerData: { directory, baselineMix } },
  );
  const completed = new Promise((resolve, reject) => {
    worker.once("message", (message) =>
      message.ok ? resolve(message) : reject(new Error(message.error)),
    );
    worker.once("error", reject);
    worker.once("exit", (code) => reject(new Error(`OWNED_PARSER_EXIT_BEFORE_RESULT:${code}`)));
  });
  try {
    return await timedPhase("independent-parser", deadlinesMs.independentParser, () => completed);
  } finally {
    // Only this exact worker handle was created here; no unrelated processes are touched.
    await withDeadline("owned-parser-worker-stop", deadlinesMs.cleanupStep, () =>
      worker.terminate(),
    );
  }
}

// Independent Node parser: no product WAV/PCM/hash/renderer imports.
async function verifyExportDirectory(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, "long.manifest.json"), "utf8"));
  if (manifest.schemaVersion !== "render-export-manifest-v1" || manifest.files.length !== 5)
    throw new Error("INDEPENDENT_MANIFEST_FORMAT");
  const parsed = [];
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(directory, `${file.id}.wav`));
    const hash = createHash("sha256").update(bytes).digest("hex");
    const ascii = (offset, count) => bytes.toString("ascii", offset, offset + count);
    if (
      hash !== file.sha256 ||
      bytes.length !== file.bytes ||
      ascii(0, 4) !== "RIFF" ||
      ascii(8, 4) !== "WAVE" ||
      bytes.readUInt32LE(4) + 8 !== bytes.length ||
      ascii(12, 4) !== "fmt " ||
      bytes.readUInt16LE(20) !== 3 ||
      bytes.readUInt16LE(22) !== 2 ||
      bytes.readUInt32LE(24) !== 48000 ||
      bytes.readUInt16LE(34) !== 32 ||
      ascii(36, 4) !== "fact" ||
      bytes.readUInt32LE(44) !== 2976000 ||
      ascii(48, 4) !== "data" ||
      bytes.readUInt32LE(52) !== 2976000 * 8
    )
      throw new Error(`INDEPENDENT_WAV_FORMAT:${file.id}`);
    let peak = 0,
      outside = 0;
    for (let offset = 56; offset < bytes.length; offset += 4) {
      const sample = bytes.readFloatLE(offset);
      if (!Number.isFinite(sample)) throw new Error(`INDEPENDENT_NONFINITE:${file.id}`);
      peak = Math.max(peak, Math.abs(sample));
      if (Math.abs(sample) > 1) outside++;
    }
    if (peak === 0) throw new Error(`INDEPENDENT_EMPTY_OUTPUT:${file.id}`);
    if (file.id === "master" && outside !== 0) throw new Error("INDEPENDENT_MASTER_BOUNDS");
    parsed.push({
      id: file.id,
      frames: 2976000,
      rate: 48000,
      channels: 2,
      bytes: bytes.length,
      sha256: hash,
      peak,
      outside,
    });
  }
  const mix = await readFile(path.join(directory, "mix.wav"));
  const sum = new Float64Array(2976000 * 2);
  for (const file of manifest.files.filter((file) => file.id.startsWith("stem-"))) {
    const bytes = await readFile(path.join(directory, `${file.id}.wav`));
    for (let index = 0; index < sum.length; index++)
      sum[index] += bytes.readFloatLE(56 + index * 4);
  }
  let maximumStemError = 0;
  for (let index = 0; index < sum.length; index++)
    maximumStemError = Math.max(
      maximumStemError,
      Math.abs(sum[index] - mix.readFloatLE(56 + index * 4)),
    );
  if (maximumStemError > 2e-6) throw new Error(`INDEPENDENT_STEM_SUM:${maximumStemError}`);
  const asset = await readFile(path.join(directory, "original-asset.wav"));
  const sourceHash = createHash("sha256").update(asset).digest("hex");
  if (
    asset.readUInt16LE(22) !== 1 ||
    asset.readUInt32LE(24) !== 48000 ||
    asset.readUInt32LE(44) !== 96000
  )
    throw new Error("INDEPENDENT_ORIGINAL_ASSET_LAYOUT");
  if (sourceHash !== manifest.configuration.assets[0].sha256)
    throw new Error("INDEPENDENT_ASSET_PIN");
  return {
    status: "PASS",
    files: parsed,
    maximumStemError,
    tolerance: 2e-6,
    originalAssetSha256: sourceHash,
    originalAsset: {
      channels: 1,
      rate: 48000,
      frames: 96000,
      bytes: asset.length,
      origin: "Original generated fixture",
      licenseReference: "ORIGINAL_TEST_FIXTURE; source fixture.ts, no third-party recording",
    },
  };
}

// Public Chromium test protocol, two documents in the same browser context/origin.
// This intentionally crashes only the auxiliary renderer created by this runner.
async function validateRendererCrash(context) {
  const databaseName = `reflection-lab-renderer-crash-${Date.now()}`;
  const jobId = "job.renderer-crash",
    oldJobId = "job.renderer-crash-old-good";
  const url = "http://127.0.0.1:5353/tests/browser/nonadvanced/long-render/writer-frame.html";
  const owner = await context.newPage();
  let observer = await context.newPage();
  const checks = [];
  try {
    await owner.goto(url);
    await owner.waitForFunction(() => window.nativeWriterReady === true);
    const ownerState = await owner.evaluate((value) => window.nativeWriterStart(value), {
      databaseName,
      jobId,
    });
    await owner.evaluate(() => window.nativeWriterAppend(1, [44, 55]));
    await observer.goto(url);
    await observer.waitForFunction(() => window.nativeWriterReady === true);
    const before = await observer.evaluate(
      async ({ databaseName, jobId, oldJobId }) => {
        const { IndexedDBRenderOutputStore } = await import("/src/audio/render-output-store.ts");
        const { IncrementalSha256 } = await import("/src/persistence/incremental-sha256.ts");
        const store = new IndexedDBRenderOutputStore({ name: databaseName });
        const bytes = new Uint8Array([99, 88]);
        await store.begin(oldJobId, 1024, ["pcm"], bytes.length);
        await store.append(oldJobId, "pcm", 0, bytes);
        await store.sealOutput(
          oldJobId,
          "pcm",
          bytes.length,
          new IncrementalSha256().update(bytes).digestHex(),
        );
        await store.publish(oldJobId, "{}");
        const recovery = await store.recover();
        const jobs = await store.listJobs();
        const active = jobs.find((job) => job.jobId === jobId);
        const usage = await store.getArchiveUsage();
        store.dispose();
        return {
          recovery,
          active,
          usage,
          nativeLocks: typeof navigator.locks?.request === "function",
        };
      },
      { databaseName, jobId, oldJobId },
    );
    checks.push({
      id: "two-top-level-documents-preserve-active-writer-before-renderer-crash",
      pass:
        before.nativeLocks &&
        before.active?.status === "writing" &&
        before.active.activeWriter &&
        !before.active.canDiscard &&
        !before.recovery.some((job) => job.jobId === jobId),
      evidence: { databaseName, jobId, ownerState, ...before },
    });
    let crashObserved = false,
      commandError = null;
    const crashEvent = owner.waitForEvent("crash", { timeout: 10000 }).then(() => {
      crashObserved = true;
    });
    const session = await context.newCDPSession(owner);
    const command = session.send("Page.crash").catch((error) => {
      commandError = String(error);
    });
    await crashEvent;
    let commandTimer;
    await Promise.race([
      command,
      new Promise((resolve) => {
        commandTimer = setTimeout(resolve, 1000);
      }),
    ]);
    clearTimeout(commandTimer);
    await observer.close().catch(() => undefined);
    observer = await context.newPage();
    await observer.goto(url);
    await observer.waitForFunction(() => window.nativeWriterReady === true);
    const after = await observer.evaluate(
      async ({ databaseName, jobId, oldJobId }) => {
        const { IndexedDBRenderOutputStore } = await import("/src/audio/render-output-store.ts");
        const store = new IndexedDBRenderOutputStore({ name: databaseName });
        const recovered = await store.recover();
        const jobs = await store.listJobs();
        const interrupted = jobs.find((job) => job.jobId === jobId);
        const old = await store.readBlob(oldJobId, "pcm");
        const oldBytes = old ? Array.from(new Uint8Array(await old.arrayBuffer())) : null;
        const manifest = await store.readManifest(oldJobId);
        const usage = await store.getArchiveUsage();
        store.dispose();
        return { recovered, interrupted, oldBytes, manifest, usage };
      },
      { databaseName, jobId, oldJobId },
    );
    checks.push({
      id: "actual-renderer-crash-releases-writer-lease-and-retains-prior-publication",
      pass:
        crashObserved &&
        after.interrupted?.status === "interrupted" &&
        !after.interrupted.activeWriter &&
        after.interrupted.canDiscard &&
        after.interrupted.encodedBytes === 5 &&
        after.usage.reservedBytes === 0 &&
        JSON.stringify(after.oldBytes) === "[99,88]" &&
        after.manifest === "{}",
      evidence: {
        databaseName,
        jobId,
        crashObserved,
        commandError,
        ...after,
        method:
          "Public CDP Page.crash on a runner-owned auxiliary renderer; Playwright crash event observed. Not an OS/browser-process kill or native product input.",
      },
    });
  } catch (error) {
    checks.push({
      id: "renderer-crash-validation",
      pass: false,
      evidence: { databaseName, jobId, error: String(error) },
    });
  } finally {
    await owner.close().catch(() => undefined);
    await observer.close().catch(() => undefined);
  }
  return checks;
}

async function verifyDiagnosticDirectory(directory) {
  const diagnostic = JSON.parse(
    await readFile(path.join(directory, "long.diagnostics.json"), "utf8"),
  );
  const product = JSON.parse(await readFile(path.join(directory, "long.manifest.json"), "utf8"));
  if (
    diagnostic.schemaVersion !== "long-native-diagnostic-v1" ||
    diagnostic.files.length !== 8 ||
    diagnostic.sourceJobId !== product.job.jobId ||
    diagnostic.frozenInputWaveSha256 !== baselineMix.sha256
  )
    throw new Error("INDEPENDENT_DIAGNOSTIC_IDENTITY");
  const expectedDiagnosticIds = [
    "reference-mix63",
    "reference-master63",
    "reference-dry63",
    "reference-master62",
    "master-frozen-input62",
    "master-frozen-a62",
    "master-frozen-b62",
    "master-frozen-c63",
  ];
  if (
    new Set(diagnostic.files.map((file) => file.id)).size !== 8 ||
    expectedDiagnosticIds.some((id) => !diagnostic.files.some((file) => file.id === id))
  )
    throw new Error("INDEPENDENT_DIAGNOSTIC_FILE_SET");
  const verified = [];
  for (const file of diagnostic.files) {
    const bytes = await readFile(path.join(directory, `${file.id}.diagnostic.wav`));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (
      hash !== file.sha256 ||
      bytes.length !== file.bytes ||
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WAVE" ||
      bytes.toString("ascii", 12, 16) !== "fmt " ||
      bytes.readUInt32LE(16) !== 16 ||
      bytes.readUInt32LE(4) + 8 !== bytes.length ||
      bytes.readUInt16LE(20) !== 3 ||
      bytes.readUInt16LE(22) !== 2 ||
      bytes.readUInt32LE(24) !== 48000 ||
      bytes.readUInt32LE(44) !== file.frames ||
      bytes.readUInt32LE(28) !== 384000 ||
      bytes.readUInt16LE(32) !== 8 ||
      bytes.readUInt16LE(34) !== 32 ||
      bytes.toString("ascii", 36, 40) !== "fact" ||
      bytes.readUInt32LE(40) !== 4 ||
      bytes.toString("ascii", 48, 52) !== "data" ||
      bytes.readUInt32LE(52) !== file.frames * 8 ||
      bytes.length !== 56 + file.frames * 8
    )
      throw new Error(`INDEPENDENT_DIAGNOSTIC_WAV:${file.id}`);
    let peak = 0,
      outsideUnit = 0;
    for (let offset = 56; offset < bytes.length; offset += 4) {
      const sample = bytes.readFloatLE(offset);
      if (!Number.isFinite(sample)) throw new Error(`INDEPENDENT_DIAGNOSTIC_NONFINITE:${file.id}`);
      peak = Math.max(peak, Math.abs(sample));
      if (Math.abs(sample) > 1) outsideUnit++;
    }
    if (
      /^master-frozen-[abc]6[23]$/.test(file.id) &&
      (!(peak > 0 && peak <= 1 && outsideUnit === 0) ||
        diagnostic.frozenMasterBounds[file.id]?.peak !== peak ||
        diagnostic.frozenMasterBounds[file.id]?.outsideUnit !== outsideUnit)
    )
      throw new Error(`INDEPENDENT_DIAGNOSTIC_MASTER_BOUNDS:${file.id}`);
    if (
      file.id === "master-frozen-input62" &&
      (diagnostic.frozenInputPeak !== peak ||
        !(
          peak *
            product.configuration.master.headroomGain *
            product.configuration.master.monitorGain >
          10 ** (-3 / 20)
        ))
    )
      throw new Error("INDEPENDENT_DIAGNOSTIC_FROZEN_EXCITATION");
    const expectedFrames = file.id.endsWith("63") ? 3024000 : 2976000;
    if (
      file.frames !== expectedFrames ||
      (file.id === "master-frozen-input62" && hash !== baselineMix.sha256)
    )
      throw new Error(`INDEPENDENT_DIAGNOSTIC_FIXED_INPUT_OR_LENGTH:${file.id}`);
    verified.push({
      id: file.id,
      frames: file.frames,
      bytes: file.bytes,
      sha256: hash,
      peak,
      outsideUnit,
    });
  }
  const pairs = [
    ["whole-native-reference-mix", "mix.wav", "reference-mix63.diagnostic.wav"],
    ["whole-native-reference-master", "master.wav", "reference-master63.diagnostic.wav"],
    ["whole-native-reference-dry", "dry.wav", "reference-dry63.diagnostic.wav"],
    ["same-length-master-reference-62", "master.wav", "reference-master62.diagnostic.wav"],
    ["master-frozen-b62", "master-frozen-a62.diagnostic.wav", "master-frozen-b62.diagnostic.wav"],
    ["master-frozen-c63", "master-frozen-a62.diagnostic.wav", "master-frozen-c63.diagnostic.wav"],
  ];
  const comparisons = [];
  for (const [id, actualName, referenceName] of pairs) {
    const actual = await readFile(path.join(directory, actualName));
    const reference = await readFile(path.join(directory, referenceName));
    const frames = actual.readUInt32LE(44),
      channels = actual.readUInt16LE(22);
    if (
      frames !== 2976000 ||
      reference.readUInt32LE(44) < frames ||
      reference.readUInt16LE(22) !== channels
    )
      throw new Error(`INDEPENDENT_DIAGNOSTIC_PREFIX:${id}`);
    let maxError = 0,
      seamError = 0,
      tailError = 0,
      overCount = 0,
      squares = 0,
      firstOver = null,
      atMax = null;
    const perSecondMax = Array.from({ length: 62 }, () => 0);
    for (let frame = 0; frame < frames; frame++)
      for (let channel = 0; channel < channels; channel++) {
        const offset = 56 + (frame * channels + channel) * 4;
        const value = actual.readFloatLE(offset),
          expected = reference.readFloatLE(offset),
          error = Math.abs(value - expected);
        const point = { frame, channel, actual: value, reference: expected, error };
        if (atMax === null || error > maxError) {
          maxError = error;
          atMax = point;
        }
        if (error > 2e-6) {
          overCount++;
          firstOver ??= point;
        }
        squares += error * error;
        const remainder = frame % 32768;
        if (
          (frame >= 32768 && remainder <= 128) ||
          (remainder >= 32768 - 128 && frame - remainder + 32768 < frames)
        )
          seamError = Math.max(seamError, error);
        if (frame >= 2880000) tailError = Math.max(tailError, error);
        const second = Math.floor(frame / 48000);
        perSecondMax[second] = Math.max(perSecondMax[second], error);
      }
    const rmsError = Math.sqrt(squares / (frames * channels));
    const browser = diagnostic.comparisons.find((value) => value.id === id)?.summary;
    if (
      !browser ||
      browser.frames !== frames ||
      browser.channels !== channels ||
      browser.nonfinite.count !== 0 ||
      browser.maxError !== maxError ||
      browser.seamError !== seamError ||
      browser.tailError !== tailError ||
      browser.overCount !== overCount ||
      !sameJsonRecord(browser.atMax, atMax) ||
      !sameJsonRecord(browser.firstOver, firstOver) ||
      JSON.stringify(browser.perSecondMax) !== JSON.stringify(perSecondMax) ||
      Math.abs(browser.rmsError - rmsError) > 1e-15
    )
      throw new Error(`INDEPENDENT_DIAGNOSTIC_STATS:${id}`);
    comparisons.push({
      id,
      maximumWithinOriginalTolerance: maxError <= 2e-6,
      maxError,
      seamError,
      tailError,
      overCount,
      firstOver,
      atMax,
      rmsError,
      perSecondMax,
    });
  }
  const controlComparisons = Object.entries(diagnostic.referenceControlSamples).map(
    ([id, reference]) => {
      const productId = id.includes("master") ? "master" : id.includes("mix") ? "mix" : "dry";
      const actual = diagnostic.productControlSamples[productId];
      const identical =
        actual.length === reference.length &&
        actual.every((value, index) => value === reference[index]);
      return { id, identical, actualCount: actual.length, referenceCount: reference.length };
    },
  );
  return {
    status: "PASS",
    scope:
      "Byte/hash/statistics verification; any original waveform gate failure remains a failure.",
    files: verified,
    comparisons,
    controlComparisons,
  };
}
