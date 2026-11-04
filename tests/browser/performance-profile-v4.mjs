import { serializeErrorRecord } from "./performance-error-record-v3.mjs";
import { parseProfileOptionsV4 } from "./performance-cli-v4.mjs";
import { V4_METHOD_SOURCE_PATHS } from "./performance-method-v4.mjs";
import {
  APPROVED_QUALIFICATIONS_V4,
  resolveApprovedQualificationV4,
} from "./performance-approved-qualifications-v4.mjs";
import {
  evaluateUIWorkloadV4,
  classifyProfileEvidenceV4,
  PROFILE_METHOD_VERSION_V4,
  PROFILE_SCHEMA_VERSION_V4,
} from "./performance-profile-contract-v4.mjs";
import { summarizeProbeObservationsV4 } from "./performance-observation-summary-v4.mjs";
export {
  evaluateUIWorkloadV4,
  classifyProfileEvidenceV4,
} from "./performance-profile-contract-v4.mjs";
export { summarizeProbeObservationsV4 } from "./performance-observation-summary-v4.mjs";
import { metric as attributionMetric } from "./performance-attribution-metrics-v1.mjs";
import { analyzeFormalTraceV4 } from "./performance-native-formal-v4.mjs";
import { observePreviewListenerV4 } from "./performance-preview-listen-v4.mjs";
import {
  captureProcessTimesEndpointV4,
  summarizeProcessTimesDeltaV4,
} from "./performance-process-times-v4.mjs";
import { summarizeProcessCpuDeltaV4 } from "./performance-process-cpu-v4.mjs";
/* global window, document, process, setTimeout, clearTimeout, fetch, AbortSignal */
/* eslint no-undef: "error" */
import { chromium } from "@playwright/test";
import { evaluatePhysicsWorkload, evaluateAcousticWorkload } from "./performance-profile.mjs";
import { FORMAL_TRACE_CAPS } from "./performance-native-v3.mjs";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, writeFile, cp, lstat, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, URL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { performance as nodePerformance } from "node:perf_hooks";
import {
  stopOwnedProcess,
  cleanupOwnedResources,
  saveOwnedTrace,
  createBoundedCapture,
  observeAsyncFailure,
  runOwnedStartup,
  writeBoundedUIRaw,
  checkpointThenCloseTrace,
  observeTraceFaults,
  finalizeTraceFaults,
  UI_RAW_MAX_BYTES,
} from "./performance-owned-cleanup-v3.mjs";

const allValid = (flags) =>
  flags !== null &&
  typeof flags === "object" &&
  Object.values(flags).length > 0 &&
  Object.values(flags).every((value) => value === true);
const nativeCounters = ["droppedPaths", "droppedVoices", "stolenVoices", "staleFrames"];
const finiteDelta = (after, before) =>
  Number.isFinite(after) && Number.isFinite(before) ? after - before : null;
const metric = (id, values, threshold = null) => {
  const known = Array.isArray(values),
    result = attributionMetric(id, known ? values : [], threshold);
  return known
    ? result
    : { ...result, requestedCount: null, unobservedCount: null, observationStatus: "NOT_OBSERVED" };
};
const CONFIG = "tests/browser/performance-v4.vite.config.ts";
const DIST = "test-results/performance-v4-dist";
export async function beginUIWithCpuEndpointV4({
  probesEnabled,
  startTracing,
  captureBefore,
  beginUI,
}) {
  if (probesEnabled) await startTracing();
  await captureBefore();
  return await beginUI();
}
function closedWindowMetadataValid(data) {
  const pending = data?.pendingAtEnd,
    end = data?.collectionWindow?.endPerformanceMs;
  return (
    data?.windowSnapshot?.status === "CLOSED_WINDOW" &&
    pending !== null &&
    typeof pending === "object" &&
    !Array.isArray(pending) &&
    Number.isFinite(end) &&
    Number.isFinite(pending.timestamp) &&
    pending.timestamp === end &&
    ["scriptBusy", "runtimeBusy", "recorderPending"].every(
      (key) => typeof pending[key] === "boolean",
    )
  );
}
export function isOwnedPreviewReadyV4(preview, log, expectedURL) {
  if (
    !preview ||
    preview.exitCode !== null ||
    preview.signalCode !== null ||
    typeof log !== "string" ||
    typeof expectedURL !== "string"
  )
    return false;
  let readyURL;
  try {
    readyURL = new URL(expectedURL).origin + "/";
  } catch {
    return false;
  }
  const plainLog = stripVTControlCharacters(log);
  return plainLog.split(/\r?\n/u).some((line) => {
    let announcement = line.trim();
    if (announcement.startsWith("➜")) announcement = announcement.slice(1).trimStart();
    const local = /^Local:\s+(\S+)$/u.exec(announcement);
    return local?.[1] === readyURL;
  });
}
async function assertOwnedBuildPaths(root) {
  const actualRoot = await realpath(root);
  for (const relative of [DIST, ".cache/performance-v4/vite"]) {
    const target = path.resolve(root, relative),
      inside = path.relative(path.resolve(root), target);
    if (!inside || inside === ".." || inside.startsWith(".." + path.sep) || path.isAbsolute(inside))
      throw new Error("V4_BUILD_OUTPUT_OUTSIDE_OWNED_ROOT");
    let current = path.resolve(root);
    for (const segment of relative.split("/")) {
      current = path.join(current, segment);
      let details;
      try {
        details = await lstat(current);
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      if (details.isSymbolicLink() || !details.isDirectory())
        throw new Error("V4_BUILD_OUTPUT_LINK_OR_NON_DIRECTORY");
      const resolved = await realpath(current),
        within = path.relative(actualRoot, resolved);
      if (within === ".." || within.startsWith(".." + path.sep) || path.isAbsolute(within))
        throw new Error("V4_BUILD_OUTPUT_RESOLVED_OUTSIDE_OWNED_ROOT");
    }
  }
}
async function selectNormalTopMonitor(page, mode, input) {
  const labels = {
    levels: /^(Levels|\u97f3\u91cf)$/u,
    spectrum: /^(Spectrum|\u983b\u8b5c)$/u,
    waveform: /^(Waveform|\u6ce2\u5f62)$/u,
    load: /^(Load|\u8ca0\u8f09)$/u,
  };
  const monitor = page.locator("[data-monitor-mode]");
  await monitor.waitFor({ state: "visible" });
  if (input !== "master-left") {
    await monitor.getByRole("button", { name: labels.spectrum }).click();
    await monitor.locator("select").selectOption(input);
  }
  if (mode !== "levels" || input !== "master-left")
    await monitor.getByRole("button", { name: labels[mode] }).click();
  await page.waitForFunction(
    (expected) =>
      document.querySelector("[data-monitor-mode]")?.getAttribute("data-monitor-mode") === expected,
    mode,
  );
}
async function main() {
  const root = process.cwd();
  const {
    seconds,
    phase,
    physicsIterations,
    acousticIterations,
    formal,
    prepare,
    softwareGPU,
    executablePath,
    output,
    probeMode,
    topMonitorMode,
    topMonitorInput,
    qualificationId,
    audioPolicyArm,
  } = parseProfileOptionsV4(process.argv.slice(2));
  const probesEnabled = probeMode === "on";
  const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\./g, "");
  const directory = path.resolve(output ?? `artifacts/v1/browser-performance-v4-${runId}`);
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const hashFile = async (file) => {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest("hex");
  };
  async function walk(relative) {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((entry) =>
          entry.isDirectory()
            ? walk(path.posix.join(relative, entry.name))
            : [path.posix.join(relative, entry.name)],
        ),
      )
    )
      .flat()
      .sort();
  }
  async function inputHashes() {
    const names = [
      ...V4_METHOD_SOURCE_PATHS,
      ...(await walk("src")),
      ...(await walk("schemas")),
      ...(await walk("public")),
      ...APPROVED_QUALIFICATIONS_V4.flatMap((record) =>
        record.requiredSourcePins.map((pin) => pin.path),
      ),
      "tests/browser/performance-profile-v4.mjs",
      "tests/browser/performance-profile-contract-v4.mjs",
      "tests/browser/performance-observation-summary-v4.mjs",
      "tests/browser/performance-approved-qualifications-v4.mjs",
      "docs/16-nonadvanced-completion/lanes/performance/VERSIONED_APPROVAL_RECORD-V4-SEMANTIC-03.json",
      "tests/browser/performance-native-formal-v4.mjs",
      "tests/browser/performance-preview-listen-v4.mjs",
      "tests/browser/performance-process-times-v4.mjs",
      "tests/browser/performance-process-times-v4.ps1",
      "tests/browser/performance-process-cpu-v4.mjs",
      "tests/browser/performance-cli-v4.mjs",
      "tests/browser/run-performance-v4.mjs",
      "tests/browser/performance-v4.vite.config.ts",
      "tests/browser/performance-fixture-v4.html",
      "tests/browser/performance-fixture-v4.mjs",
      "package.json",
      "package-lock.json",
      ".node-version",
      "docs/05-ux/DESIGN_TOKENS.json",
      "docs/05-ux/PERFORMANCE_STANDARDS.md",
      "docs/06-validation/PERFORMANCE_BUDGET.md",
      "docs/11-v1/ACCEPTANCE.md",
      "docs/11-v1/REQUIREMENTS.json",
      "tsconfig.json",
      "vite.config.ts",
      "tests/browser/performance-v3.vite.config.ts",
      "tests/browser/performance-fixture-v3.html",
      "tests/browser/performance-fixture.mjs",
      "tests/browser/performance-profile.mjs",
      "tests/integration/performance-profile.test.mjs",
      "tests/browser/performance.vite.config.ts",
      "tests/browser/performance-fixture.html",
      "tests/browser/performance-fixture-v3.mjs",
      "tests/browser/performance-quiescence-v3.mjs",
      "tests/browser/performance-proof-v3.mjs",
      "tests/browser/performance-native-v3.mjs",
      "tests/browser/performance-numeric-formal-v3.mjs",
      "tests/browser/reanalyze-performance-v3.mjs",
      "tests/browser/reanalyze-performance-v3-worker.mjs",
      "tests/performance-v3/reanalysis-cli.spec.mjs",
      "tests/performance-v3/formal-numeric.spec.mjs",
      "tests/browser/performance-stream-v3.mjs",
      "tests/browser/performance-cli-v3.mjs",
      "tests/performance-v3/streaming-trace.spec.mjs",
      "tests/performance-v3/formal-stream.spec.mjs",
      "tests/performance-v3/ui-checkpoint.spec.mjs",
      "tests/performance-v3/checkpoint-falsy.spec.mjs",
      "tests/performance-v3/ui-stream-fault.spec.mjs",
      "tests/performance-v3/trace-closure.spec.mjs",
      "tests/performance-v3/bounded-cli.spec.mjs",
      "tests/browser/run-performance-v3.mjs",
      "scripts/agents/process-runner.mjs",
      "tests/browser/performance-profile-v3.mjs",
      "tests/browser/performance-owned-cleanup-v3.mjs",
      "tests/browser/performance-error-record-v3.mjs",
      "tests/performance-v3/error-record.spec.mjs",
      "tests/performance-v3/window-boundary.spec.mjs",
      "tests/performance-v3/window-lifecycle.spec.mjs",
      "tests/performance-v3/window-metadata.spec.mjs",
      "tests/performance-v3/window-tail-error.spec.mjs",
      "tests/performance-v3/window-longtask.spec.mjs",
      "tests/browser/performance-qualifier-v3.mjs",
      "tests/integration/performance-v3-qualification.test.mjs",
      "tests/performance-v3/eligibility-repair.spec.mjs",
      "tests/performance-v3/fixture-adapter.mjs",
      "tests/performance-v3/fixture-lifecycle.spec.mjs",
      "tests/performance-v3/native-resource.spec.mjs",
      "tests/performance-v3/performance-profile-v3.spec.mjs",
      "tests/performance-v3/performance-v3-negative-fixtures.mjs",
      "tests/performance-v3/reference-acceptance.spec.mjs",
      "tests/performance-v3/reference/fixtures.mjs",
      "tests/performance-v3/reference/rational-binary64.mjs",
      "tests/performance-v3/reference/self-validation-receipt.json",
      "tests/performance-v3/runner-adapter.mjs",
      "tests/performance-v3/runner-cleanup.spec.mjs",
      "tests/performance-v3/startup-cleanup.spec.mjs",
    ];
    return Promise.all(
      [...new Set(names)]
        .sort()
        .map(async (file) => ({ path: file, sha256: sha(await readFile(path.join(root, file))) })),
    );
  }
  const initialHashes = await inputHashes();
  if (!executablePath) throw new Error("V4_EXPLICIT_PINNED_EXECUTABLE_REQUIRED");
  const selectedApproval = APPROVED_QUALIFICATIONS_V4.find(
    (record) => record.qualificationId === qualificationId,
  );
  if (!selectedApproval) throw new Error("V4_QUALIFICATION_REQUIRED_OR_NOT_APPROVED");
  const executableSha256 = sha(await readFile(executablePath));
  const preflightApproval = await resolveApprovedQualificationV4({
    qualificationId,
    executableSha256,
    producerRevision: selectedApproval.producerRevision,
    sourcePins: initialHashes,
    requiredScope: "FORMAL_V4_SEMANTIC_PRECONDITION",
  });
  await assertOwnedBuildPaths(root);
  const buildStartedAt = new Date().toISOString();
  const build = spawnSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build", "--config", CONFIG, "--mode", "e2e"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120000,
      windowsHide: true,
    },
  );
  await writeFile(path.join(directory, "build.stdout.txt"), build.stdout ?? "");
  await writeFile(path.join(directory, "build.stderr.txt"), build.stderr ?? "");
  const afterBuildHashes = await inputHashes();
  const bundle =
    build.status === 0
      ? await Promise.all(
          (await walk(DIST)).map(async (file) => ({
            path: file,
            sha256: sha(await readFile(path.join(root, file))),
          })),
        )
      : [];
  const manifest = {
    schemaVersion: 1,
    buildStartedAt,
    buildEndedAt: new Date().toISOString(),
    exitCode: build.status,
    sourceStableDuringBuild: JSON.stringify(initialHashes) === JSON.stringify(afterBuildHashes),
    inputDigest: sha(JSON.stringify(initialHashes)),
    inputs: initialHashes,
    bundle,
  };
  await writeFile(
    path.join(directory, "build-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  if (build.status !== 0 || !manifest.sourceStableDuringBuild)
    throw new Error("Build failed or input changed; no performance PASS claimed");
  await cp(path.resolve(root, DIST), path.join(directory, "bundle"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  if (prepare) {
    process.stdout.write(
      JSON.stringify({ prepared: true, directory, inputDigest: manifest.inputDigest }) + "\n",
    );
    process.exit(0);
  }

  const preview = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--config",
      CONFIG,
      "--host",
      "127.0.0.1",
      "--port",
      "5194",
      "--strictPort",
    ],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let browser, context, page, browserCDP;
  const {
    stopPreview,
    previewCapture,
    previewLog,
    consoleCapture,
    pageErrorCapture,
    report,
    watchdogFailures,
    watchdog,
    url,
  } = await runOwnedStartup(async () => {
    const stopPreview = () => stopOwnedProcess(preview);
    const previewCapture = createBoundedCapture();
    preview.stdout.on("data", (value) => previewCapture.add(value));
    preview.stderr.on("data", (value) => previewCapture.add(value));
    const previewLog = () => previewCapture.snapshot().entries.join("");
    const url = "http://127.0.0.1:5194/tests/browser/performance-fixture-v4.html";
    const startupDeadline = Date.now() + 15_000;
    for (;;) {
      if (preview.exitCode !== null || preview.signalCode !== null)
        throw new Error(`Preview exited ${preview.exitCode}: ${previewLog()}`);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (response.ok && isOwnedPreviewReadyV4(preview, previewLog(), url)) break;
      } catch {
        /* bounded startup probe */
      }
      if (Date.now() >= startupDeadline) throw new Error("Preview startup timeout");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: softwareGPU
        ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
    });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    browserCDP = await browser.newBrowserCDPSession();
    const consoleCapture = createBoundedCapture(),
      pageErrorCapture = createBoundedCapture();
    page.on("console", (message) =>
      consoleCapture.add({
        type: message.type(),
        text: message.text(),
        at: new Date().toISOString(),
      }),
    );
    page.on("pageerror", (error) =>
      pageErrorCapture.add({
        message: error.message,
        stack: error.stack,
        at: new Date().toISOString(),
      }),
    );
    let browserVersionReceipt;
    try {
      browserVersionReceipt = await browserCDP.send("Browser.getVersion");
      await resolveApprovedQualificationV4({
        qualificationId,
        executableSha256,
        producerRevision: browserVersionReceipt.revision?.replace(/^@/, ""),
        sourcePins: afterBuildHashes,
        requiredScope: "FORMAL_V4_SEMANTIC_PRECONDITION",
      });
    } catch (error) {
      try {
        await writeFile(
          path.join(directory, "v4-native-rejection.json"),
          JSON.stringify({ status: "UNVERIFIED", error: String(error), browserVersionReceipt }),
        );
      } catch (receiptError) {
        throw new AggregateError([error, receiptError], "Native rejection receipt failed");
      }
      throw error;
    }
    let systemInfo = null;
    try {
      systemInfo = await browserCDP.send("SystemInfo.getInfo");
    } catch (error) {
      systemInfo = { unavailable: String(error) };
    }
    const gitRevisionProbe = spawnSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      }),
      gitStatusProbe = spawnSync(
        "git",
        ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          maxBuffer: 8 * 1024 * 1024,
        },
      );
    const host = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpu: os.cpus()[0]?.model ?? null,
      logicalCpus: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytesAtStart: os.freemem(),
      browserVersion: browser.version(),
      browserVersionReceipt,
      executablePath,
      executableSha256,
      gitRevision: gitRevisionProbe.status === 0 ? gitRevisionProbe.stdout.trim() : null,
      dirtyPathsSha256: gitStatusProbe.status === 0 ? sha(gitStatusProbe.stdout) : null,
      gitProbeErrors: [gitRevisionProbe, gitStatusProbe]
        .filter((result) => result.status !== 0)
        .map((result) => ({
          exitCode: result.status,
          message: result.stderr || result.error?.message || "Git probe failed",
        })),
      requestedLaunchFlags: softwareGPU
        ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
      systemInfo,
      requestedGpuMode: softwareGPU
        ? "explicit ANGLE SwiftShader"
        : "browser default; inspect actual GPU metadata",
      devtoolsUIOpen: false,
      cdpAttached: true,
      cpuThrottleRequested: false,
      powerMode:
        process.platform === "win32"
          ? (spawnSync("powercfg", ["/getactivescheme"], {
              encoding: "utf8",
              windowsHide: true,
            }).stdout?.trim() ?? "UNKNOWN")
          : "UNKNOWN",
    };
    const report = {
      schemaVersion: PROFILE_SCHEMA_VERSION_V4,
      startedAt: new Date().toISOString(),
      phase,
      requestedSeconds: seconds,
      profileClass: formal ? "V4_FORMAL_600_CANDIDATE" : "V4_SHORT_DIAGNOSTIC_ONLY",
      methodVersion: PROFILE_METHOD_VERSION_V4,
      probeMode,
      requestedTopMonitor: { mode: topMonitorMode, input: topMonitorInput },
      requestedAudioPolicyArm: audioPolicyArm,
      sharedAudioEndpointObservation: {
        active: true,
        stages: ["AFTER_ENABLE_BEFORE_WARMUP", "AFTER_CLOSED_WINDOW_END"],
        diagnosticsEnabled: probesEnabled,
        productFooterNativeStatsObserverEnabled: probesEnabled,
        normalProductTopMonitorNativeAnalysisPreserved: true,
        scope: "ACTIVE_PUBLIC_AUDIO_RESOURCE_ENDPOINTS_NOT_PASSIVE_TOP_MONITOR",
      },
      sourceInputs: initialHashes,
      semanticPrecondition: {
        verified: true,
        qualificationId: preflightApproval.qualificationId,
        scope: preflightApproval.scope,
        runSourceCommit: preflightApproval.runSourceCommit,
      },
      nativeAudioDsp: {
        status: "NOT_MEASURED",
        cpuMs: null,
        hardwareBlockFrames: null,
        deadline: null,
      },
      processCpu: {
        status: "NOT_STARTED",
        scope: "WHOLE_CDP_OWNED_PROCESSES_NOT_DSP_CPU",
        beforeEndpointOrder: probesEnabled
          ? "after-tracing-start-before-beginUI"
          : "before-beginUI-no-tracing",
        excludesTracingStartPreparationCost: true,
        before: null,
        after: null,
        nativeDspCpuMs: null,
        hardwareUnderruns: null,
      },
      formal600Run: false,
      overallV1Complete: false,
      traceBufferSizeKiB: probesEnabled ? 512 * 1024 : null,
      traceCaps: probesEnabled ? FORMAL_TRACE_CAPS : null,
      manifest: "build-manifest.json",
      host,
      status: "RUNNING",
      metrics: [],
      limitations: [
        "No human hearing, calibrated SPL, device acoustic latency or dropout observation.",
        "The product uses native Web Audio nodes; actual AudioWorklet 48kHz/128-frame p99 deadline remains NOT RUN.",
        "CDP tracing and method wrappers add measurement overhead; this local instrumented setup does not establish cross-device capacity.",
      ],
    };
    const watchdogFailures = [];
    const watchdog = setTimeout(
      () => {
        report.status = "TIMED_OUT";
        report.watchdogTimedOut = true;
        report.wallTimeLimitSeconds = formal ? 1200 : seconds + 240;
        try {
          observeAsyncFailure(browser.close(), watchdogFailures, "watchdog-browser-close");
        } catch (error) {
          watchdogFailures.push({ label: "watchdog-browser-close", error });
        }
      },
      (formal ? 1200 : seconds + 240) * 1000,
    );
    watchdog.unref();
    return {
      stopPreview,
      previewCapture,
      previewLog,
      consoleCapture,
      pageErrorCapture,
      report,
      watchdogFailures,
      watchdog,
      url,
    };
  }, [
    { label: "context", close: () => context?.close() },
    { label: "browser", close: () => browser?.close() },
    { label: "preview", close: () => stopOwnedProcess(preview) },
  ]);
  let traceMeta = null,
    traceObserver = null,
    tracePhase = "before-start";
  const cpuScope =
    "ORIGINAL_UI_WINDOW_PLUS_BEGIN_CLOSE_CONTROL_AND_SHARED_ENDPOINT_OBSERVATION_EXCLUDING_TRACING_START_NOT_DSP_CPU";
  const cpuDirectory = path.join(directory, "cpu");
  async function captureSharedCpuEndpoint(boundary) {
    const endpoint = {
      boundary,
      scope: cpuScope,
      timing: { startedMonotonicMs: nodePerformance.now(), endedMonotonicMs: null },
      cdp: {
        method: "SystemInfo.getProcessInfo",
        response: null,
        status: "NOT_MEASURED",
        timing: { startedMonotonicMs: null, endedMonotonicMs: null },
      },
      os: null,
      helperLeaseReleasable: true,
    };
    report.processCpu[boundary] = endpoint;
    endpoint.cdp.timing.startedMonotonicMs = nodePerformance.now();
    let cdpTimer;
    try {
      endpoint.cdp.response = await Promise.race([
        browserCDP.send("SystemInfo.getProcessInfo"),
        new Promise((_, reject) => {
          cdpTimer = setTimeout(() => reject(new Error("V4_PROCESS_INFO_ENDPOINT_TIMEOUT")), 5000);
        }),
      ]);
      endpoint.cdp.status = "RECEIVED_UNVERIFIED_COUNTERS";
    } catch (error) {
      endpoint.cdp.error = serializeErrorRecord(error);
      endpoint.cdp.status = "UNAVAILABLE";
    } finally {
      clearTimeout(cdpTimer);
      endpoint.cdp.timing.endedMonotonicMs = nodePerformance.now();
    }
    if (endpoint.cdp.response === null) {
      endpoint.os = {
        status: "NOT_STARTED_CDP_UNAVAILABLE",
        helperStarted: false,
        helperLeaseReleasable: true,
        nativeDspCpuMs: null,
        hardwareUnderruns: null,
      };
    } else {
      let helperCallEntered = false;
      try {
        const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
        if (
          process.platform !== "win32" ||
          typeof systemRoot !== "string" ||
          !path.win32.isAbsolute(systemRoot)
        )
          throw new Error("V4_ABSOLUTE_WINDOWS_SYSTEMROOT_UNAVAILABLE");
        const powerShellPath = path.win32.join(
          systemRoot,
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        );
        await mkdir(cpuDirectory, { recursive: true });
        helperCallEntered = true;
        endpoint.helperLeaseReleasable = null;
        endpoint.os = await captureProcessTimesEndpointV4(endpoint.cdp.response, {
          directory: cpuDirectory,
          powerShellPath,
          label: boundary,
          boundary,
          requestId: `${runId}.${boundary}`,
          scope: cpuScope,
        });
        endpoint.helperLeaseReleasable = endpoint.os?.helperLeaseReleasable === true;
      } catch (error) {
        endpoint.os = {
          status: helperCallEntered ? "CAPTURE_CALL_FAILED" : "NOT_STARTED",
          helperStarted: helperCallEntered ? null : false,
          helperLeaseReleasable: !helperCallEntered,
          error: serializeErrorRecord(error),
          nativeDspCpuMs: null,
          hardwareUnderruns: null,
        };
        endpoint.helperLeaseReleasable = !helperCallEntered;
      }
    }
    endpoint.timing.endedMonotonicMs = nodePerformance.now();
    return endpoint;
  }
  const endpointWall = (before, after) => {
    if (
      ![
        before?.startedMonotonicMs,
        before?.endedMonotonicMs,
        after?.startedMonotonicMs,
        after?.endedMonotonicMs,
      ].every(Number.isFinite) ||
      before.startedMonotonicMs > before.endedMonotonicMs ||
      before.endedMonotonicMs > after.startedMonotonicMs ||
      after.startedMonotonicMs > after.endedMonotonicMs
    )
      return {
        completionToCompletionMilliseconds: null,
        minimumSamplingIntervalMilliseconds: null,
        maximumSamplingIntervalMilliseconds: null,
      };
    return {
      completionToCompletionMilliseconds: after.endedMonotonicMs - before.endedMonotonicMs,
      minimumSamplingIntervalMilliseconds: after.startedMonotonicMs - before.endedMonotonicMs,
      maximumSamplingIntervalMilliseconds: after.endedMonotonicMs - before.startedMonotonicMs,
    };
  };
  try {
    await page.addInitScript(
      (configuration) => {
        window.__performanceProfileConfig = configuration;
      },
      { probeMode, topMonitorMode, topMonitorInput, audioPolicyArm },
    );
    await page.goto(url);
    await page.waitForFunction(() => window.__performanceReady === true);
    if (phase === "all" || phase === "physics") {
      const data = await page.evaluate(
        async (count) => window.__performanceFixture.physicsProfile(count),
        physicsIterations,
      );
      await writeFile(path.join(directory, "physics.raw.json"), JSON.stringify(data));
      report.physics = {
        fixedDtSeconds: data.fixedDtSeconds,
        totalBodies: data.dynamicBodies + data.fixedBodies,
        dynamicBodies: data.dynamicBodies,
        ccdBodyCount: data.ccdBodyCount,
        warmupSteps: data.warmupSteps,
        iterations: data.iterations,
        ...summarizeProbeObservationsV4({ physics: data }).physics,
        catchupProbe: data.catchupProbe,
        contactBodyIds: data.contactBodyIds,
        contactLoadMethod: data.contactLoadMethod,
        loadMaintenanceScope: data.loadMaintenanceScope,
        workloadValidity: evaluatePhysicsWorkload(data),
      };
      const physicsMetrics = [
        metric("physics.nativeWasmStep", data.nativeStepMs, 2),
        metric("physics.completeFixedTickWithCopies", data.completeFixedTickMs),
        metric(
          "physics.wakeMaintenance",
          data.loadMaintenance.map((row) => row.wakeMaintenanceMs),
        ),
        metric(
          "physics.loadSetup",
          data.loadMaintenance.map((row) => row.totalSetupMs),
        ),
        metric("physics.measuredStepIncludingLoadSetup", data.completeWithLoadSetupMs),
      ];
      for (const entry of physicsMetrics)
        if (entry.status === "PASS" && !allValid(report.physics.workloadValidity))
          entry.status = "UNVERIFIED";
      report.metrics.push(...physicsMetrics);
      process.stdout.write(
        JSON.stringify({ progress: "physics complete", nativeStep: physicsMetrics[0] }) + "\n",
      );
    }
    if (phase === "all" || phase === "acoustics") {
      report.acousticProfiles = [];
      for (const profile of [
        { id: "productDefault", pathCap: 8 },
        { id: "stress256", pathCap: 32 },
      ]) {
        await page.evaluate(
          (pathCap) => window.__performanceFixture.configureSolverProfile(pathCap),
          profile.pathCap,
        );
        await page.click("#solver-enable-audio");
        await page.waitForSelector('#solver-enable-audio[data-ready="true"]');
        const policyAtEnable = await page.evaluate(() =>
          window.__performanceFixture.getAudioPolicyWitnessV4("solver"),
        );
        report.audioPolicySetupWitnesses ??= [];
        report.audioPolicySetupWitnesses.push({ profileId: profile.id, ...policyAtEnable });
        if (policyAtEnable.qualified !== true)
          throw new Error(`V4_AUDIO_POLICY_NOT_OBSERVED:${profile.id}`);
        const data = await page.evaluate(
          async (count) => window.__performanceFixture.acousticProfile(count),
          acousticIterations,
        );
        await writeFile(
          path.join(directory, `acoustic-${profile.id}.raw.json`),
          JSON.stringify(data),
        );
        const policyAtClose = await page.evaluate(
          (input) => window.__performanceFixture.verifyNativeAudioResourcePolicyV4(input),
          {
            requestedArm: audioPolicyArm,
            pathCap: profile.pathCap,
            telemetry: data.nativeAudio,
            resourceSnapshot: data.nativeResourceSnapshotAtClose,
          },
        );
        const acoustic = {
          profileId: profile.id,
          requestedAudioPolicyArm: audioPolicyArm,
          audioPolicyAtEnable: policyAtEnable,
          audioPolicyAtClose: policyAtClose,
          nativeResourceSnapshotAtClose: data.nativeResourceSnapshotAtClose ?? null,
          audioResourceEndpointScope: data.audioResourceEndpointScope ?? null,
          isProductDefault: profile.id === "productDefault",
          sourceCount: data.sourceCount,
          surfacesPerSource: data.surfacesPerSource,
          maxReflectionOrder: data.maxReflectionOrder,
          currentCapability: "first order; order2 NOT SUPPORTED",
          targetHz: data.targetHz,
          ...summarizeProbeObservationsV4({
            acousticProfiles: [{ profileId: profile.id, raw: data.raw }],
          }).acousticProfiles[0],
          admissions: data.admissions,
          workloadValidity: {
            ...evaluateAcousticWorkload(data),
            actualAudioPolicyAtEnable: policyAtEnable.qualified === true,
            actualAudioPolicyAtClose: policyAtClose.qualified === true,
          },
          nativeCounterDeltas: Object.fromEntries(
            nativeCounters.map((counter) => [
              counter,
              {
                warmup: finiteDelta(
                  data.measurementBaselineNativeAudio?.[counter],
                  data.baselineNativeAudio?.[counter],
                ),
                measured: finiteDelta(
                  data.nativeAudio?.[counter],
                  data.measurementBaselineNativeAudio?.[counter],
                ),
              },
            ]),
          ),
          nativeAudio: data.nativeAudio,
          audioDisposal: data.audioDisposal ?? null,
          telemetry: data.telemetry,
          fixture: data.fixture,
          requestedPathCapPerVoice: data.requestedPathCapPerVoice,
          nativeGraphTargetPaths: data.nativeGraphTargetPaths,
          completeMainThreadDelivery: {
            status: "UNVERIFIED",
            thresholdP95LessThanMs: 1,
            reason:
              "Known-stage sum excludes browser deserialization/event dispatch, Promise handoff, and LabRuntime consumer bookkeeping; not the complete canonical main-thread delivery interval",
          },
        };
        report.acousticProfiles.push(acoustic);
        const profileMetrics = [
          metric(
            `acoustic.${profile.id}.workerCompute`,
            data.raw.map((value) => value.workerComputeMs),
            20,
          ),
          metric(
            `acoustic.${profile.id}.serviceDelivery`,
            data.raw.map((value) => value.serviceDeliveryMs),
            1,
          ),
          metric(
            `acoustic.${profile.id}.actualAudioConsumers`,
            data.raw.map((value) => value.audioConsumerMs),
          ),
          metric(
            `acoustic.${profile.id}.combinedDelivery`,
            data.raw.map((value) => value.totalDeliveryMs),
            1,
          ),
          metric(
            `acoustic.${profile.id}.roundTrip`,
            data.raw.map((value) => value.roundTripMs),
          ),
          metric(
            `acoustic.${profile.id}.receiveThroughNativeConsumers`,
            data.raw.map((value) => value.receiveThroughNativeConsumersMs),
            1,
          ),
        ];
        profileMetrics[3].method =
          "Service reply validation plus synchronous native AudioEngine.updateFrame consumers for eight sources; excludes browser deserialization/event dispatch, Promise handoff, fixture diagnostics and LabRuntime consumer bookkeeping";
        profileMetrics[3].scope = "KNOWN_STAGE_SUM_ONLY";
        profileMetrics[1].scope = "SERVICE_REPLY_VALIDATION_ONLY";
        profileMetrics[2].scope = "SYNCHRONOUS_NATIVE_ENGINE_CONSUMERS_ONLY";
        profileMetrics[5].scope = "OBSERVABLE_RECEIVE_ENTRY_THROUGH_NATIVE_CONSUMERS";
        profileMetrics[5].method =
          "Actual matching AcousticService.receive entry through solve await continuation, fixture telemetry bookkeeping and final eight synchronous native AudioEngine.updateFrame calls. Browser pre-handler deserialization/OS dispatch and LabRuntime-specific bookkeeping remain UNVERIFIED.";
        for (const entry of profileMetrics) {
          entry.profileId = profile.id;
          entry.isProductDefault = profile.id === "productDefault";
          if (acousticIterations < 600 && entry.status === "PASS") entry.status = "UNVERIFIED";
          if (!Object.values(acoustic.workloadValidity).every(Boolean) && entry.status === "PASS")
            entry.status = "UNVERIFIED";
        }
        report.metrics.push(...profileMetrics);
        process.stdout.write(
          JSON.stringify({
            progress: "acoustic complete",
            profileId: profile.id,
            workloadValidity: acoustic.workloadValidity,
            worker: profileMetrics[0],
            delivery: profileMetrics[5],
          }) + "\n",
        );
      }
    }
    if (phase === "all" || phase === "ui") {
      const mounted = await page.evaluate(() => window.__performanceFixture.mountUI());
      await selectNormalTopMonitor(page, topMonitorMode, topMonitorInput);
      await page.click("#profile-enable-audio");
      await page.waitForSelector('#profile-enable-audio[data-ready="true"]');
      const uiPolicyAtEnable = await page.evaluate(() =>
        window.__performanceFixture.getAudioPolicyWitnessV4("ui"),
      );
      report.audioPolicySetupWitnesses ??= [];
      report.audioPolicySetupWitnesses.push({ profileId: "ui", ...uiPolicyAtEnable });
      if (uiPolicyAtEnable.qualified !== true) throw new Error("V4_AUDIO_POLICY_NOT_OBSERVED:ui");
      const warmup = await page.evaluate(() => window.__performanceFixture.warmupUI(10_000));
      let cdp = null,
        documentBefore = null,
        completion = null,
        bufferUsageCapped = false;
      const bufferUsage = [];
      report.traceLifecycleFaults = [];
      if (probesEnabled) {
        cdp = await context.newCDPSession(page);
        traceObserver = observeTraceFaults({
          browser,
          page,
          cdp,
          records: report.traceLifecycleFaults,
          phase: () => tracePhase,
        });
        documentBefore = (await cdp.send("Page.getFrameTree")).frameTree.frame;
        cdp.on("Tracing.bufferUsage", (value) => {
          if (bufferUsage.length >= 1024) {
            bufferUsageCapped = true;
            return;
          }
          bufferUsage.push(value);
        });
        completion = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
      }
      report.processCpu.status = "CAPTURING";
      report.processCpu.scope = cpuScope;
      const environment = await beginUIWithCpuEndpointV4({
        probesEnabled,
        startTracing: async () => {
          tracePhase = "starting";
          await cdp.send("Tracing.start", {
            transferMode: "ReturnAsStream",
            streamFormat: "json",
            streamCompression: "gzip",
            bufferUsageReportingInterval: 10000,
            traceConfig: {
              recordMode: "recordAsMuchAsPossible",
              traceBufferSizeInKb: 512 * 1024,
              includedCategories: [
                "devtools.timeline",
                "blink.user_timing",
                "toplevel",
                "v8",
                "disabled-by-default-devtools.timeline.frame",
              ],
            },
          });
        },
        captureBefore: () => captureSharedCpuEndpoint("before"),
        beginUI: async () => {
          tracePhase = probesEnabled ? "measurement" : "probe-off-no-trace";
          const beginUIRpc = { startedMonotonicMs: nodePerformance.now(), endedMonotonicMs: null };
          report.processCpu.beginUIRpc = beginUIRpc;
          try {
            return await page.evaluate(
              (duration) => window.__performanceFixture.beginUI(duration),
              seconds,
            );
          } finally {
            beginUIRpc.endedMonotonicMs = nodePerformance.now();
          }
        },
      });
      const end = Date.now() + seconds * 1000;
      while (Date.now() < end) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(30_000, Math.max(0, end - Date.now()))),
        );
        process.stdout.write(
          JSON.stringify({
            progress: "ui",
            probeMode,
            data: probesEnabled
              ? await page.evaluate(() => window.__performanceFixture.progress())
              : null,
            remainingWallMs: Math.max(0, end - Date.now()),
          }) + "\n",
        );
      }
      // The closed-window checkpoint precedes every drain, asynchronous disposal,
      // trace flush and report. Nothing from the tail is copied back into it.
      let data,
        tail,
        uiFailure,
        uiFailed = false,
        closeFailed = false;
      const closeUIRpc = { startedMonotonicMs: nodePerformance.now(), endedMonotonicMs: null };
      report.processCpu.closeUIRpc = closeUIRpc;
      try {
        data = await page.evaluate(() => window.__performanceFixture.closeUIWindow());
      } catch (error) {
        uiFailed = true;
        closeFailed = true;
        uiFailure = error;
      } finally {
        closeUIRpc.endedMonotonicMs = nodePerformance.now();
      }
      // Both arms observe the same owned process sets after the closed-window
      // RPC, before disk checkpoints, pause/drain, disposal or trace flushing.
      await captureSharedCpuEndpoint("after");
      const cpuBefore = report.processCpu.before,
        cpuAfter = report.processCpu.after;
      const cdpWall = endpointWall(cpuBefore.cdp.timing, cpuAfter.cdp.timing);
      const osWall = endpointWall(cpuBefore.os?.timing, cpuAfter.os?.timing);
      const browserWindowMilliseconds = Number.isFinite(data?.sampleMilliseconds)
        ? data.sampleMilliseconds
        : null;
      Object.assign(report.processCpu, {
        status: "ENDPOINTS_COLLECTED_NOT_CONTINUOUS_CPU_COVERAGE",
        endpointProtocol: [
          probesEnabled ? "AFTER_TRACING_START_BEFORE_BEGIN_UI" : "BEFORE_BEGIN_UI_NO_TRACING",
          "AFTER_CLOSED_WINDOW_RPC_BEFORE_DISK_AND_TAIL",
        ],
        clockScope: "NODE_MONOTONIC_BRACKETS_SEPARATE_FROM_BROWSER_PERFORMANCE_MARKS",
        denominatorBasis: "ACTUAL_CAPTURE_COMPLETION_TO_CAPTURE_COMPLETION_NOT_REQUESTED_SECONDS",
        browserWindowMilliseconds,
        cdpWall,
        osWall,
        includesTracingStartBeginAndCloseControlAndSharedEndpointCosts: false,
        includesBeginAndCloseControlAndSharedEndpointCosts: true,
        excludesDiskCheckpointTailAndTraceFlush: true,
        cdpMinusBrowserWindowMilliseconds:
          Number.isFinite(cdpWall.completionToCompletionMilliseconds) &&
          browserWindowMilliseconds !== null
            ? cdpWall.completionToCompletionMilliseconds - browserWindowMilliseconds
            : null,
        osMinusBrowserWindowMilliseconds:
          Number.isFinite(osWall.completionToCompletionMilliseconds) &&
          browserWindowMilliseconds !== null
            ? osWall.completionToCompletionMilliseconds - browserWindowMilliseconds
            : null,
        durationDifferenceScope:
          "DURATION_DIFFERENCE_ONLY_NOT_ABSOLUTE_CROSS_PROCESS_CLOCK_ALIGNMENT",
        cdpSummary: {
          source: "CDP_SYSTEMINFO_REPORTED_CPU_TIME_SECONDS",
          ...summarizeProcessCpuDeltaV4(cpuBefore.cdp.response, cpuAfter.cdp.response, {
            wallMilliseconds: cdpWall.completionToCompletionMilliseconds,
            scope: cpuScope,
          }),
        },
        osSummary: {
          source: "WIN32_GETPROCESSTIMES_SUCCESS_FLAGGED_CREATION_KERNEL_USER",
          ...summarizeProcessTimesDeltaV4(cpuBefore.os, cpuAfter.os, {
            wallMilliseconds: osWall.completionToCompletionMilliseconds,
            scope: cpuScope,
          }),
        },
      });
      if (!uiFailed) {
        try {
          const saved = await writeBoundedUIRaw(path.join(directory, "ui.raw.json"), data);
          report.uiCheckpoint = {
            ...saved,
            sampleMilliseconds: data.sampleMilliseconds,
            collectionId: data.collectionWindow?.collectionId ?? null,
            status: "CLOSED_WINDOW_UNVERIFIED",
            maxBytes: UI_RAW_MAX_BYTES,
          };
        } catch (error) {
          uiFailed = true;
          uiFailure = error;
        }
      }
      try {
        await page.evaluate(async () => {
          await window.__performanceFixture.finishUI();
        });
      } catch (error) {
        if (!uiFailed) {
          uiFailed = true;
          uiFailure = error;
        } else if (!closeFailed)
          uiFailure = new AggregateError([uiFailure, error], "UI checkpoint and cleanup failed");
      }
      try {
        tail = await page.evaluate(() => window.__performanceFixture.getUIFinishTail());
        if (tail) {
          const saved = await writeBoundedUIRaw(
            path.join(directory, "ui.finish-tail.raw.json"),
            tail,
          );
          report.uiFinishTail = {
            ...saved,
            status: tail.status,
            audioDisposal: tail.audioDisposal ?? null,
          };
        }
      } catch (error) {
        if (uiFailed)
          uiFailure = new AggregateError([uiFailure, error], "UI finish and tail export failed");
        else {
          uiFailed = true;
          uiFailure = error;
        }
      }
      if (uiFailed)
        report.uiFinishFailure = { status: "INCOMPLETE_UNVERIFIED", primary: uiFailure };
      let trace = {
        scope: "NOT_OBSERVED_PROBE_OFF",
        formal600Run: false,
        formalQualification: "NOT_APPROVED",
        mainTaskOccupancyMs: [],
        nativeTraceBinBoundariesUs: [],
        coverage: {
          complete: false,
          nativeV4Qualified: false,
          originalRawV3Qualified: null,
          markedDurationMs: null,
        },
      };
      if (probesEnabled) {
        tracePhase = "checkpoint-and-flush";
        try {
          const checkpointed = await checkpointThenCloseTrace({
            checkpoint: async () => report.uiCheckpoint ?? null,
            stop: () => cdp.send("Tracing.end"),
            completion,
            fault: traceObserver.fault.then((record) =>
              Object.assign(new Error("TRACE_LIFECYCLE_FAULT"), { record }),
            ),
            timeoutMs: formal ? 180000 : 60000,
          });
          traceMeta = checkpointed.traceMeta;
          traceMeta.bufferUsage = bufferUsage;
          tracePhase = "trace-stream";
          await saveOwnedTrace(cdp, traceMeta, path.join(directory, "ui.trace.json.gz"), {
            maxCompressedBytes: FORMAL_TRACE_CAPS.compressedBytes,
          });
        } catch (traceError) {
          if (uiFailed)
            throw new AggregateError(
              [uiFailure, traceError],
              "UI finish and trace recovery failed",
            );
          throw traceError;
        }
      }
      if (uiFailed) throw uiFailure;
      if (!closedWindowMetadataValid(data)) throw new Error("UI_CLOSED_WINDOW_METADATA_INVALID");
      if (probesEnabled) {
        if (bufferUsageCapped) throw new Error("V4_BUFFER_METADATA_CAP");
        const documentAfter = (await cdp.send("Page.getFrameTree")).frameTree.frame;
        const traceContext = {
          documentBefore: {
            id: documentBefore.id,
            loaderId: documentBefore.loaderId,
            url: documentBefore.url,
          },
          documentAfter: {
            id: documentAfter.id,
            loaderId: documentAfter.loaderId,
            url: documentAfter.url,
          },
          traceDataLoss: traceMeta.dataLossOccurred,
          traceStreamClosed: true,
          producerRevision: report.host.browserVersionReceipt.revision?.replace(/^@/, ""),
          executableSha256,
        };
        trace = await analyzeFormalTraceV4(
          path.join(directory, "ui.trace.json.gz"),
          data,
          traceContext,
        );
        await writeFile(
          path.join(directory, "ui.trace-analysis.json"),
          JSON.stringify(trace, null, 2) + "\n",
        );
      }
      report.formal600Run = formal && data.sampleMilliseconds >= 600000;
      const observed = summarizeProbeObservationsV4({ ui: data }).ui;
      report.ui = {
        environment,
        traceCoverage: trace.coverage,
        sceneObjectCount: mounted.scene.objects.length,
        dynamicBodies: mounted.scene.objects.filter((value) => value.mode.startsWith("dynamic"))
          .length,
        warmupSeconds: 10,
        warmup,
        sampleMilliseconds: data.sampleMilliseconds,
        measurementBoundaryVersion: data.collectionWindow?.schemaVersion ?? null,
        collectionWindow: data.collectionWindow,
        frameCount: probesEnabled ? data.frame.length : null,
        simulationRunningFrames: probesEnabled
          ? data.frame.filter((frame) => frame.simulationRunning).length
          : null,
        simulationTickDelta: data.measuredEndTick - data.startedAtTick,
        droppedWallTimeSeconds: data.droppedWallTimeSeconds,
        cumulativeDroppedWallTimeSeconds: data.cumulativeDroppedWallTimeSeconds,
        measuredClockStart: data.measurementStartedClock,
        measuredClockEnd: data.measuredEndClock,
        captures: data.captureWindows,
        advanceCount: probesEnabled ? data.advances.length : null,
        overruns: probesEnabled ? data.advances.filter((value) => value.overrun).length : null,
        pausedAdvances: probesEnabled
          ? data.advances.filter((value) => value.before.paused || value.after.paused).length
          : null,
        poseCalls: data.poseCalls,
        interpolationCalls: data.interpolationCalls,
        interpolationCallsPerPresentedFrame: observed.interpolationCallsPerPresentedFrame,
        interpolationObservation: observed.interpolationObservation,
        droppedSamples: data.droppedSamples,
        longTaskSupported: probesEnabled ? data.longTaskSupported : null,
        longTasks: probesEnabled ? data.longTasks.length : null,
        audio: data.audio,
        audioEndpointScope: "CLOSED_WINDOW_ENDPOINT_ONLY",
        requestedAudioPolicyArm: audioPolicyArm,
        audioPolicyAtEnable: uiPolicyAtEnable,
        audioPolicyAtClose: data.audioPolicyWitnessAtClose ?? null,
        audioResourceEndpointScope: data.audioResourceEndpointScope ?? null,
        audioSampleCount: probesEnabled ? data.audioTelemetry.length : null,
        peakNativeVoices: observed.peakNativeVoices,
        peakNativePaths: observed.peakNativePaths,
        nativeResourceSnapshotAtClose: data.nativeResourceSnapshotAtClose ?? null,
        topMonitorObservation: data.topMonitorObservation ?? null,
        topMonitorObservationAgeMs: data.topMonitorObservationAgeMs ?? null,
        recording: data.recorderArtifact,
        trace: probesEnabled
          ? {
              ...traceMeta,
              stream: undefined,
              file: "ui.trace.json.gz",
              analysis: "ui.trace-analysis.json",
              markerCoverage: trace.coverage,
            }
          : {
              status: "NOT_OBSERVED_PROBE_OFF",
              file: null,
              analysis: null,
              markerCoverage: trace.coverage,
            },
        finalState: data.final.simulationState,
        finalError: data.final.error,
      };
      const intervals = data.frame
        .slice(1)
        .map((frame, index) => frame.timestamp - data.frame[index].timestamp);
      report.metrics.push(
        metric("ui.frameInterval", intervals, 16.67),
        metric(
          "ui.allRafCallbackCPU",
          data.frame.map((frame) => frame.rafCpuMs),
          4,
        ),
        metric(
          "ui.advanceCPU",
          data.frame.map((frame) => frame.advanceMs),
        ),
        metric(
          "ui.poseLookupCPUPerFrame",
          data.frame.map((frame) => frame.poseMs),
        ),
        metric("ui.nativePhysicsStep", data.nativeStepMs, 2),
        metric("ui.physicsFixedStepInternal", data.fixedStepMs),
        metric(
          "ui.behaviorAndRecordingTick",
          data.onTick.map((value) => value.ms),
        ),
        metric(
          "ui.captureTick",
          data.onTick.filter((value) => value.recording).map((value) => value.ms),
        ),
        metric("ui.cachedInterpolation", data.interpolationMs),
      );
      report.ui.workloadValidity = {
        ...evaluateUIWorkloadV4(data, {
          pageErrors: pageErrorCapture.snapshot().entries,
          traceCoverage: trace.coverage,
          expectedTopMonitor: { mode: topMonitorMode, input: topMonitorInput },
        }),
        actualAudioPolicyAtEnable: uiPolicyAtEnable.qualified === true,
        actualAudioPolicyAtClose: data.audioPolicyWitnessAtClose?.qualified === true,
      };
      const main = metric("ui.rendererMainTaskOccupancyPerFrame", trace.mainTaskOccupancyMs, 4);
      main.method =
        "Conservative wall-occupancy upper bound including all renderer-main tasks, not thread CPU tdur";
      if (
        traceMeta?.dataLossOccurred ||
        !trace.coverage.complete ||
        !allValid(report.ui.workloadValidity)
      )
        if (main.status === "PASS") main.status = "UNVERIFIED";
      report.metrics.push(main);
    }
    report.executableSha256After = sha(await readFile(executablePath));
    report.executableStableDuringRun = report.executableSha256After === executableSha256;
    if (!report.executableStableDuringRun) throw new Error("V4_NATIVE_EXECUTABLE_CHANGED");
    const finalSourceInputs = await inputHashes();
    report.sourceStableDuringRun =
      JSON.stringify(initialHashes) === JSON.stringify(finalSourceInputs);
    await resolveApprovedQualificationV4({
      qualificationId,
      executableSha256: report.executableSha256After,
      producerRevision: report.host.browserVersionReceipt.revision?.replace(/^@/, ""),
      sourcePins: finalSourceInputs,
      requiredScope: "FORMAL_V4_SEMANTIC_PRECONDITION",
    });
    report.semanticPreconditionAfterRun = {
      verified: true,
      qualificationId,
      scope: "FORMAL_V4_SEMANTIC_PRECONDITION",
    };
    const finalBundle = await Promise.all(
      (await walk(DIST)).map(async (file) => ({
        path: file,
        sha256: sha(await readFile(path.join(root, file))),
      })),
    );
    report.bundleStableDuringRun = JSON.stringify(bundle) === JSON.stringify(finalBundle);
    report.status = report.metrics.some((value) => value.status === "FAIL")
      ? "MEASURED_WITH_FAILURES"
      : "MEASURED_LOCAL_ONLY";
    if (report.ui && !Object.values(report.ui.workloadValidity).every(Boolean))
      report.status = "MEASURED_WITH_INCOMPLETE_UI_WORKLOAD";
    if (report.physics && !allValid(report.physics.workloadValidity))
      report.status = "MEASURED_WITH_INCOMPLETE_PHYSICS_WORKLOAD";
    if (
      report.acousticProfiles?.some(
        (profile) => !Object.values(profile.workloadValidity).every(Boolean),
      )
    )
      report.status = "MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD";
    if (!report.sourceStableDuringRun || !report.bundleStableDuringRun)
      report.status = "HISTORICAL_SNAPSHOT_ONLY";
    report.completedAt = new Date().toISOString();
  } catch (error) {
    if (report.watchdogTimedOut !== true) report.status = "FAILED";
    report.error = serializeErrorRecord(error);
    if (report.uiFinishFailure)
      report.uiFinishFailure.primary = serializeErrorRecord(report.uiFinishFailure.primary);
    process.exitCode = 1;
  } finally {
    const traceFaulted = finalizeTraceFaults(report, traceObserver);
    if (traceFaulted) process.exitCode = 1;
    clearTimeout(watchdog);
    const consoleSnapshot = consoleCapture.snapshot(),
      errorSnapshot = pageErrorCapture.snapshot(),
      previewSnapshot = previewCapture.snapshot();
    report.consoleEvents = consoleSnapshot.entries;
    report.pageErrors = errorSnapshot.entries;
    const cleanup = await cleanupOwnedResources({
      resources: [
        { label: "browser", close: () => browser.close() },
        { label: "preview", close: stopPreview },
        {
          label: "preview log",
          close: () => writeFile(path.join(directory, "preview.log.txt"), previewLog()),
        },
      ],
    });
    const cleanupErrors = [...watchdogFailures.map((entry) => entry.error), ...cleanup.errors];
    const cpuHelperEndpoints = [report.processCpu?.before, report.processCpu?.after].filter(
      Boolean,
    );
    const cpuHelperLeaseReleasable = cpuHelperEndpoints.every(
      (entry) => entry.helperLeaseReleasable === true,
    );
    if (!cpuHelperLeaseReleasable)
      cleanupErrors.push(new Error("V4_CPU_HELPER_CLEANUP_NOT_VERIFIED"));
    let browserConnected = null;
    try {
      browserConnected = browser.isConnected();
    } catch (error) {
      cleanupErrors.push(error);
    }
    let previewListenerObservation;
    try {
      previewListenerObservation = await observePreviewListenerV4({
        host: "127.0.0.1",
        port: 5194,
        timeoutMs: 500,
      });
    } catch (error) {
      previewListenerObservation = {
        listening: null,
        observationScope: "OBSERVATION_CALL_FAILED_NO_TCP_RESULT",
        error: serializeErrorRecord(error),
      };
      cleanupErrors.push(error);
    }
    if (previewListenerObservation.listening !== false)
      cleanupErrors.push(
        new Error(
          previewListenerObservation.listening === true
            ? "V4_PREVIEW_PORT_STILL_LISTENING_NO_FOREIGN_PROCESS_TERMINATED"
            : "V4_PREVIEW_PORT_NOT_VERIFIED_CLOSED",
        ),
      );
    report.cleanup = {
      browserConnected,
      cpuHelperLeaseReleasable,
      cpuHelperObservationScope: cpuHelperEndpoints.length
        ? "ATTEMPTED_BOUNDED_HELPER_ENDPOINTS_ONLY"
        : "NO_CPU_HELPER_ENDPOINT_STARTED",
      previewExitCode: preview.exitCode,
      previewSignalCode: preview.signalCode,
      previewPid: preview.pid,
      previewProcessStopped: preview.exitCode !== null || preview.signalCode !== null,
      previewListeningAfterCleanup: previewListenerObservation.listening,
      previewListenerObservation,
      previewCleanupObservationScope: "OWNED_CHILD_EXIT_PLUS_SEPARATE_BOUNDED_TCP_CONNECT",
      errors: cleanupErrors.map(String),
    };
    report.capture = {
      console: consoleSnapshot,
      pageErrors: errorSnapshot,
      preview: previewSnapshot,
    };
    if (
      cleanupErrors.length ||
      consoleSnapshot.invalidated ||
      errorSnapshot.invalidated ||
      previewSnapshot.invalidated
    ) {
      if (!traceFaulted) report.status = "FAILED_CLEANUP";
      process.exitCode = 1;
    }
    Object.assign(
      report,
      classifyProfileEvidenceV4(report, { probeMode, formal, qualificationId }),
    );
    report.artifactFiles = await Promise.all(
      (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name !== "verification.json")
        .map(async (entry) => ({
          path: entry.name,
          sha256: await hashFile(path.join(directory, entry.name)),
        })),
    );
    await writeFile(
      path.join(directory, "verification.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    process.stdout.write(
      JSON.stringify({
        directory,
        status: report.status,
        failures: report.metrics
          .filter((value) => value.status === "FAIL")
          .map((value) => value.id),
        pageErrors: report.pageErrors.length,
      }) + "\n",
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
