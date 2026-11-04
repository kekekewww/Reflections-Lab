/* global process, window */
import { runBeforeDeadline } from "./performance-deadline-v1.mjs";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unchangedNumericV3, SHORT_TRACE_CAPS } from "./performance-native-v3.mjs";
import { validateNativeBoundaryV4 } from "./performance-native-boundary-v4.mjs";
import { parseTraceStream } from "./performance-stream-v3.mjs";
import { validateSemanticPilotJournal } from "./performance-semantic-oracle-v1.mjs";
import { verifySemanticNativeEvidenceV2 } from "./performance-semantic-native-oracle-v2.mjs";
import { serializeErrorRecord } from "./performance-error-record-v3.mjs";
import {
  saveOwnedTrace,
  cleanupOwnedResources,
  observeTraceFaults,
  checkpointThenCloseTrace,
} from "./performance-owned-cleanup-v3.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const SEMANTIC_PILOT_LIMITS = Object.freeze({
  operationMs: 45000,
  cleanupMs: 10000,
  callbacks: 128,
  compressedBytes: 8 * 1024 * 1024,
  decodedBytes: 32 * 1024 * 1024,
  events: 200000,
});
const sourceFiles = [
  "tests/browser/performance-semantic-command-v2.mjs",
  "tests/browser/performance-deadline-v1.mjs",
  "scripts/agents/process-runner.mjs",
  "tests/browser/performance-semantic-runner-v2.mjs",
  "tests/browser/performance-semantic-page-v1.mjs",
  "tests/browser/performance-semantic-pilot-v1.html",
  "tests/browser/performance-semantic-oracle-v1.mjs",
  "tests/browser/performance-semantic-native-oracle-v1.mjs",
  "tests/browser/performance-semantic-native-oracle-v2.mjs",
  "tests/browser/performance-native-boundary-v4.mjs",
  "tests/browser/performance-qualification-registry-v4.mjs",
  "tests/browser/performance-semantic-command-v1.mjs",
  "tests/performance-v3/native-boundary-v4.spec.mjs",
  "docs/16-nonadvanced-completion/lanes/performance/ADR-PERF-QUALIFICATION-V4.md",
  "docs/16-nonadvanced-completion/lanes/performance/semantic-01-independent-review.json",
  "docs/16-nonadvanced-completion/lanes/performance/semantic-attempt01/pilot.raw.json",
  "docs/16-nonadvanced-completion/lanes/performance/semantic-attempt01/pilot.trace.json.gz",
  "docs/16-nonadvanced-completion/lanes/performance/semantic-attempt01/native-verification.json",
  "tests/browser/performance-proof-v3.mjs",
  "tests/browser/performance-native-v3.mjs",
  "tests/browser/performance-numeric-formal-v3.mjs",
  "tests/browser/performance-stream-v3.mjs",
  "tests/browser/performance-owned-cleanup-v3.mjs",
  "tests/browser/performance-error-record-v3.mjs",
  "tests/performance-v3/semantic-pilot.spec.mjs",
  "package-lock.json",
  ".node-version",
].sort();
const sha = (value) => createHash("sha256").update(value).digest("hex");
const pins = () =>
  Promise.all(
    sourceFiles.map(async (file) => ({
      path: file,
      sha256: sha(await readFile(path.join(root, file))),
    })),
  );
const documentPin = (frame) => ({ id: frame.id, loaderId: frame.loaderId, url: frame.url });

export async function runSemanticPilotV2({ executablePath, output }) {
  if (!executablePath || !output)
    throw new Error("PILOT_EXPLICIT_EXECUTABLE_AND_NEW_OUTPUT_REQUIRED");
  const directory = path.resolve(output);
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const report = {
    schemaVersion: 1,
    method: "native-raf-semantic-pilot-v2",
    nativeBoundaryPolicy: "V4_CANDIDATE_NOT_QUALIFIED",
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    limits: SEMANTIC_PILOT_LIMITS,
    formal600Run: false,
    formalQualification: "NOT_APPROVED",
    overallV1Complete: false,
    browserDeviceAudio: {
      requested: false,
      sampleRate: null,
      hardwareBlockLength: null,
      deviceRoute: null,
      reason: "NO_AUDIO_REQUESTED_IN_SEMANTIC_PILOT",
    },
    traceLifecycleFaults: [],
    cleanupErrors: [],
    console: [],
    pageErrors: [],
  };
  const deadline = Date.now() + SEMANTIC_PILOT_LIMITS.operationMs;
  let browser,
    context,
    page,
    cdp,
    server,
    observer,
    tracingStarted = false,
    traceClosed = false;
  let sourceBefore = null,
    executableBefore = null,
    completion,
    phase = "setup",
    debuggerPaused = false;
  const remaining = () => Math.max(1, Math.min(45000, deadline - Date.now()));
  const within = (label, operation) =>
    runBeforeDeadline(label, operation, { deadlineMs: deadline });

  try {
    if (process.version !== "v22.17.0") throw new Error("EXACT_NODE_REQUIRED");
    const sourceArchive = new Map();
    sourceBefore = [];
    report.sourceArchive = [];
    await within("freeze-and-archive-inputs", async () => {
      for (const file of sourceFiles) {
        const bytes = await readFile(path.join(root, file));
        sourceArchive.set(file, bytes);
        const pin = { path: file, sha256: sha(bytes) };
        sourceBefore.push(pin);
        const archivedPath = path.join(directory, "source-snapshot", file);
        await mkdir(path.dirname(archivedPath), { recursive: true });
        await writeFile(archivedPath, bytes, { flag: "wx" });
        report.sourceArchive.push({
          path: `source-snapshot/${file}`,
          sha256: pin.sha256,
          bytes: bytes.length,
        });
      }
    });
    executableBefore = await within("executable-before", async () =>
      sha(await readFile(executablePath)),
    );
    report.sourceBefore = sourceBefore;
    report.executable = { path: executablePath, sha256Before: executableBefore };
    const allowed = new Map([
      ["/", "performance-semantic-pilot-v1.html"],
      ["/performance-semantic-pilot-v1.html", "performance-semantic-pilot-v1.html"],
      ["/performance-semantic-page-v1.mjs", "performance-semantic-page-v1.mjs"],
      ["/performance-proof-v3.mjs", "performance-proof-v3.mjs"],
    ]);
    server = createServer((request, response) => {
      const filename = allowed.get(request.url);
      if (!filename) {
        response.writeHead(404);
        response.end();
        return;
      }
      try {
        response.writeHead(200, {
          "Content-Type": filename.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "text/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        });
        const bytes = sourceArchive.get(`tests/browser/${filename}`);
        if (!bytes) throw new Error("FROZEN_SERVED_SOURCE_MISSING");
        response.end(bytes);
      } catch (error) {
        response.destroy(error);
      }
    });
    await within(
      "owned-server",
      () =>
        new Promise((resolve, reject) => {
          server.once("error", reject);
          server.listen(0, "127.0.0.1", resolve);
        }),
    );
    const url = `http://127.0.0.1:${server.address().port}/performance-semantic-pilot-v1.html`;
    report.ownedUrl = url;
    if (Date.now() >= deadline) throw new Error("PILOT_DEADLINE:browser-launch");
    // Playwright owns and terminates its launcher on its own bounded launch timeout.
    browser = await chromium.launch({ executablePath, headless: true, timeout: remaining() });
    context = await within("browser-context", () =>
      browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }),
    );
    page = await within("owned-page", () => context.newPage());
    const browserCDP = await within("browser-cdp", () => browser.newBrowserCDPSession());
    const version = await within("browser-version", () => browserCDP.send("Browser.getVersion"));
    let systemInfo;
    try {
      systemInfo = await within("system-info", () => browserCDP.send("SystemInfo.getInfo"));
    } catch (error) {
      systemInfo = { status: "UNAVAILABLE", error: serializeErrorRecord(error) };
    }
    report.host = {
      node: process.version,
      nodeExecutable: process.execPath,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpu: os.cpus()[0]?.model ?? null,
      logicalCpus: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      browserVersion: browser.version(),
      browserVersionReceipt: version,
      systemInfo,
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      cdpAttached: true,
      debuggerIntervention: "EXACT_PRETRACE_PENDING_PILOT_ONLY_NOT_PERFORMANCE",
    };
    page.on("console", (message) => {
      if (report.console.length < 128)
        report.console.push({ type: message.type(), text: message.text().slice(0, 4096) });
      else report.consoleOverflow = true;
    });
    page.on("pageerror", (error) => {
      if (report.pageErrors.length < 128) report.pageErrors.push(serializeErrorRecord(error));
      else report.pageErrorOverflow = true;
    });
    await within("owned-navigation", () => page.goto(url));
    await within("pilot-ready", () =>
      page.waitForFunction(() => window.__semanticPilotReady === true),
    );
    cdp = await within("page-cdp", () => context.newCDPSession(page));
    const scripts = new Map();
    cdp.on("Debugger.scriptParsed", (event) => {
      if (scripts.size < 512 || scripts.has(event.scriptId)) scripts.set(event.scriptId, event.url);
      else report.debuggerScriptOverflow = true;
    });
    await within("debugger-enable", () => cdp.send("Debugger.enable"));
    const before = documentPin(
      (await within("document-before", () => cdp.send("Page.getFrameTree"))).frameTree.frame,
    );
    report.documentBefore = before;
    let pausedResolve;
    const paused = new Promise((resolve) => {
      pausedResolve = resolve;
    });
    cdp.once("Debugger.paused", (event) => {
      debuggerPaused = true;
      pausedResolve(event);
    });
    cdp.on("Debugger.resumed", () => {
      debuggerPaused = false;
    });
    const evaluation = page.evaluate(() => window.__semanticPilot.prepareAndPause());
    evaluation.catch(() => {});
    const pause = await within("controlled-debugger-pause", () => paused);
    const top = pause.callFrames?.[0];
    const scriptUrl = top?.url || scripts.get(top?.location?.scriptId);
    if (
      top?.functionName !== "prepareAndPause" ||
      scriptUrl !== `${new URL(url).origin}/performance-semantic-page-v1.mjs`
    )
      throw new Error("PILOT_UNEXPECTED_DEBUGGER_PAUSE");
    report.debuggerPause = {
      reason: pause.reason,
      functionName: top.functionName,
      scriptUrl,
      location: top.location,
      document: before,
    };
    observer = observeTraceFaults({
      browser,
      page,
      cdp,
      records: report.traceLifecycleFaults,
      phase: () => phase,
    });
    completion = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
    phase = "starting-trace";
    await within("trace-start", () =>
      cdp.send("Tracing.start", {
        transferMode: "ReturnAsStream",
        streamFormat: "json",
        streamCompression: "gzip",
        traceConfig: {
          recordMode: "recordAsMuchAsPossible",
          traceBufferSizeInKb: 32768,
          includedCategories: [
            "devtools.timeline",
            "blink.user_timing",
            "toplevel",
            "v8",
            "disabled-by-default-devtools.timeline.frame",
          ],
        },
      }),
    );
    tracingStarted = true;
    phase = "semantic-window";
    await within("debugger-resume", () => cdp.send("Debugger.resume"));
    debuggerPaused = false;
    const data = await within("semantic-operations", () => evaluation);
    await writeFile(path.join(directory, "pilot.raw.json"), JSON.stringify(data, null, 2) + "\n", {
      flag: "wx",
    });
    report.journalOracle = validateSemanticPilotJournal(data.journal, data.ui);
    const after = documentPin(
      (await within("document-after", () => cdp.send("Page.getFrameTree"))).frameTree.frame,
    );
    report.documentAfter = after;
    phase = "trace-close";
    const checkpoint = await checkpointThenCloseTrace({
      checkpoint: async () => ({ saved: "pilot.raw.json" }),
      stop: () => cdp.send("Tracing.end"),
      completion,
      fault: observer.fault.then((record) =>
        Object.assign(new Error("PILOT_TRACE_LIFECYCLE_FAULT"), { record }),
      ),
      timeoutMs: remaining(),
    });
    traceClosed = true;
    const traceFile = path.join(directory, "pilot.trace.json.gz");
    await within("trace-save", () =>
      saveOwnedTrace(cdp, checkpoint.traceMeta, traceFile, {
        maxCompressedBytes: SEMANTIC_PILOT_LIMITS.compressedBytes,
      }),
    );
    report.traceMetadata = checkpoint.traceMeta;
    const nativeContext = {
      documentBefore: before,
      documentAfter: after,
      traceDataLoss: checkpoint.traceMeta.dataLossOccurred,
      traceStreamClosed: true,
      producerRevision: version.revision?.replace(/^@/, ""),
      executableSha256: executableBefore,
    };
    const caps = {
      ...SHORT_TRACE_CAPS,
      compressedBytes: SEMANTIC_PILOT_LIMITS.compressedBytes,
      decompressedBytes: SEMANTIC_PILOT_LIMITS.decodedBytes,
      events: SEMANTIC_PILOT_LIMITS.events,
    };
    const events = [];
    report.nativeEventRead = await within("native-journal-corroboration", () =>
      parseTraceStream(
        traceFile,
        (event) => {
          events.push(event);
        },
        {
          caps: {
            compressedBytes: SEMANTIC_PILOT_LIMITS.compressedBytes,
            decodedBytes: SEMANTIC_PILOT_LIMITS.decodedBytes,
            events: SEMANTIC_PILOT_LIMITS.events,
            timeoutMs: remaining(),
          },
        },
      ),
    );
    // Every raw event is parsed before V4 classification. No name-based retention
    // can discard an unknown owned B/E or a known posting site on a wrong owner.
    const native = await within("v4-typed-native-analysis", () =>
      validateNativeBoundaryV4(data.ui, events, nativeContext, caps),
    );
    const numeric = await within("unchanged-v3-numeric-core", () =>
      unchangedNumericV3(data.ui, native),
    );
    const analysis = {
      ...numeric,
      nativeEligibility: { ...native, validatedTasks: undefined },
      parsedTraceEvents: events.length,
      formalQualification: "NOT_APPROVED",
      method:
        "Versioned V4 typed post-window classification followed by unchanged V3 numeric core; original raw V3 result retained",
    };
    await writeFile(
      path.join(directory, "pilot.native-analysis.json"),
      JSON.stringify(analysis, null, 2) + "\n",
      { flag: "wx" },
    );
    report.strictNative = analysis.nativeEligibility;
    report.numericCoverageComplete = numeric.complete === true;
    report.nativeJournalCorroboration = await within("independent-native-oracle", () =>
      verifySemanticNativeEvidenceV2(data.journal, data.ui, events, nativeContext),
    );
    if (
      report.journalOracle.qualified !== true ||
      report.strictNative.qualified !== true ||
      report.numericCoverageComplete !== true ||
      report.nativeJournalCorroboration.qualified !== true ||
      report.traceLifecycleFaults.length ||
      report.pageErrors.length ||
      report.consoleOverflow ||
      report.pageErrorOverflow ||
      report.debuggerScriptOverflow
    )
      throw new Error("PILOT_SEMANTIC_EVIDENCE_UNVERIFIED");
    report.semanticCandidateObserved = true;
  } catch (error) {
    report.error = serializeErrorRecord(error);
    report.semanticCandidateObserved = false;
  } finally {
    observer?.dispose();
    const cleanupStartedAt = Date.now();
    report.endpointPins = {
      sourceStable: null,
      executableStable: null,
      scope: "BEFORE_AND_AFTER_ENDPOINTS_ONLY_NOT_CONTINUOUS_FILE_MONITORING",
    };
    // Every diagnostic and owned-resource close shares this one ten-second budget.
    const cleanup = await cleanupOwnedResources({
      // At most seven one-second diagnostics/closes; reserve the final two seconds for the receipt.
      operationMs: 1000,
      budgetMs: SEMANTIC_PILOT_LIMITS.cleanupMs - 2000,
      resources: [
        {
          label: "owned-debugger-resume",
          close: async () => {
            if (debuggerPaused && cdp) {
              await cdp.send("Debugger.resume");
              debuggerPaused = false;
            }
          },
        },
        {
          label: "owned-trace-recovery",
          close: async () => {
            if (tracingStarted && !traceClosed && cdp) {
              const recovery = await checkpointThenCloseTrace({
                checkpoint: async () => null,
                stop: () => cdp.send("Tracing.end"),
                completion,
                timeoutMs: Math.max(
                  1,
                  Math.min(
                    1000,
                    SEMANTIC_PILOT_LIMITS.cleanupMs - 2000 - (Date.now() - cleanupStartedAt),
                  ),
                ),
              });
              await saveOwnedTrace(
                cdp,
                recovery.traceMeta,
                path.join(directory, "pilot.recovery.trace.json.gz"),
                { maxCompressedBytes: SEMANTIC_PILOT_LIMITS.compressedBytes },
              );
              report.recoveryTrace = "SAVED_UNVERIFIED";
            }
          },
        },
        {
          label: "owned-page-restoration",
          close: async () => {
            if (page && !page.isClosed())
              report.restoration = await page.evaluate(() => window.__semanticPilot?.restore());
          },
        },
        { label: "owned-browser", close: () => browser?.close() },
        {
          label: "owned-server",
          close: () =>
            new Promise((resolve, reject) => {
              if (!server) {
                resolve();
                return;
              }
              server.close((error) => (error ? reject(error) : resolve()));
              server.closeAllConnections();
            }),
        },
        {
          label: "source-after-endpoint",
          close: async () => {
            try {
              const after = await pins();
              report.sourceAfter = after;
              report.endpointPins.sourceStable =
                sourceBefore !== null && JSON.stringify(sourceBefore) === JSON.stringify(after);
            } catch (error) {
              report.endpointPins.sourceError = serializeErrorRecord(error);
              throw error;
            }
          },
        },
        {
          label: "executable-after-endpoint",
          close: async () => {
            try {
              const after = sha(await readFile(executablePath));
              report.executable = { ...report.executable, sha256After: after };
              report.endpointPins.executableStable =
                executableBefore !== null && executableBefore === after;
            } catch (error) {
              report.endpointPins.executableError = serializeErrorRecord(error);
              throw error;
            }
          },
        },
      ],
    });
    report.cleanupWallMs = Date.now() - cleanupStartedAt;
    report.cleanupErrors = cleanup.errors.map((error) => serializeErrorRecord(error));
    report.browserConnectedAfterCleanup = browser?.isConnected() ?? null;
    report.serverListeningAfterCleanup = server?.listening ?? null;
    if (
      report.semanticCandidateObserved &&
      report.endpointPins.sourceStable === true &&
      report.endpointPins.executableStable === true &&
      report.cleanupErrors.length === 0 &&
      report.browserConnectedAfterCleanup === false &&
      report.serverListeningAfterCleanup === false &&
      report.restoration?.nativeRafIdentityUnchanged === true &&
      report.restoration?.nativeCancelIdentityUnchanged === true &&
      report.restoration?.pendingAfterRestore === 0 &&
      report.restoration?.state === "CLOSED"
    ) {
      report.status = "SEMANTIC_CANDIDATE_OBSERVED_NOT_APPROVED";
      report.qualificationCandidateId =
        "semantic-v2-" +
        sha(
          JSON.stringify({
            source: sourceBefore,
            executable: executableBefore,
            browser: report.host.browserVersionReceipt,
          }),
        ).slice(0, 24);
    } else report.status = "UNVERIFIED_NOT_APPROVED";
    report.completedAt = new Date().toISOString();
    report.artifactFiles = await Promise.all(
      (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name !== "verification.json")
        .map(async (entry) => ({
          path: entry.name,
          sha256: sha(await readFile(path.join(directory, entry.name))),
        })),
    );
    await writeFile(
      path.join(directory, "verification.json"),
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
  }
  return {
    directory,
    status: report.status,
    formalQualification: "NOT_APPROVED",
    formal600Run: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--plan") {
    process.stdout.write(
      JSON.stringify({
        limits: SEMANTIC_PILOT_LIMITS,
        formalQualification: "NOT_APPROVED",
        paidCalls: 0,
      }) + "\n",
    );
  } else {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i],
        value = args[i + 1];
      if (
        !["--executable-path", "--output"].includes(key) ||
        !value ||
        value.startsWith("--") ||
        options[key]
      )
        throw new Error("INVALID_PILOT_CLI");
      options[key] = value;
    }
    const result = await runSemanticPilotV2({
      executablePath: options["--executable-path"],
      output: options["--output"],
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.status !== "SEMANTIC_CANDIDATE_OBSERVED_NOT_APPROVED") process.exitCode = 1;
  }
}
