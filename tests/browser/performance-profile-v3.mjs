import { serializeErrorRecord } from "./performance-error-record-v3.mjs";
import { parseProfileOptions } from "./performance-cli-v3.mjs";
/* global window, process, setTimeout, clearTimeout, fetch, AbortSignal */
/* eslint no-undef: "error" */
import { chromium } from "@playwright/test";
import {
  metric,
  evaluatePhysicsWorkload,
  evaluateAcousticWorkload,
} from "./performance-profile.mjs";
import {
  analyzeTraceV3,
  analyzeFormalTraceStreamV3,
  analyzeFrameCoverageV3,
  SHORT_TRACE_CAPS,
  FORMAL_TRACE_CAPS,
} from "./performance-native-v3.mjs";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, writeFile, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

const list = (value) => (Array.isArray(value) ? value : []);
const allValid = (value) => Object.values(value).every((flag) => flag === true);
const nativeCounters = ["droppedPaths", "droppedVoices", "stolenVoices", "staleFrames"];
export function closedWindowMetadataValid(data) {
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
export function evaluateUIWorkload(data, { pageErrors = [], traceCoverage = {} } = {}) {
  const advances = list(data.advances),
    captures = list(data.captureWindows),
    warmup = data.warmup;
  const measuredActions = list(data.actions).filter((value) => value.phase !== "warmup");
  const frameCoverage = analyzeFrameCoverageV3(data.frame, data, traceCoverage);
  const interpolation = data.interpolationObservation;
  const fastInterpolation = interpolation?.byMethod?.interpolatedTransforms;
  const actualInterpolationObserved =
    interpolation?.requiredMethod === "interpolatedTransforms" &&
    list(interpolation.observedMethods).includes("interpolatedTransforms") &&
    Number.isSafeInteger(interpolation.calls) &&
    interpolation.calls > 0 &&
    Number.isSafeInteger(interpolation.successfulCalls) &&
    interpolation.successfulCalls === interpolation.calls &&
    interpolation.failedCalls === 0 &&
    interpolation.calls === data.interpolationCalls &&
    list(data.interpolationMs).length === interpolation.calls &&
    Number.isSafeInteger(fastInterpolation?.successfulCalls) &&
    fastInterpolation.successfulCalls > 0 &&
    fastInterpolation.calls === fastInterpolation.successfulCalls &&
    fastInterpolation.failedCalls === 0 &&
    list(fastInterpolation.ms).length === fastInterpolation.calls;
  return {
    actual600Seconds:
      traceCoverage.complete === true && (traceCoverage.markedDurationMs ?? 0) >= 600000,
    finiteOrderedFrames: frameCoverage.rawFiniteAndStrictlyOrdered,
    frameCollectionMembership: frameCoverage.collectionMembershipValid,
    actualInterpolationObserved,
    noSampleTruncation: data.droppedSamples === 0,
    noRuntimeOrScriptErrors:
      pageErrors.length === 0 &&
      !data.final?.error &&
      measuredActions.every((value) => !value.error) &&
      advances.every((value) => !value.error && !value.after?.error),
    uninterruptedSimulation:
      list(data.frame).length > 0 && data.frame.every((frame) => frame.simulationRunning),
    fixedTickProgress:
      Number.isFinite(data.sampleMilliseconds) &&
      data.measuredEndTick - data.startedAtTick >=
        Math.floor((data.sampleMilliseconds * 60) / 1000) - 1,
    noDroppedWallTime: data.droppedWallTimeSeconds === 0,
    noOverrunOrRecordingDebt:
      advances.length > 0 &&
      advances.every(
        (value) =>
          value.overrun === false &&
          Number.isSafeInteger(value.steps) &&
          value.steps >= 0 &&
          value.steps <= 4 &&
          value.before &&
          value.after &&
          !value.before.paused &&
          !value.after.paused &&
          Number.isFinite(value.after.accumulatorSeconds) &&
          value.after.accumulatorSeconds >= 0 &&
          value.after.accumulatorSeconds < 1 / 60 &&
          value.droppedWallTimeSeconds === 0,
      ),
    acceptedGrabAndThrow:
      measuredActions.some((value) => value.action === "OnGrab" && value.accepted) &&
      measuredActions.some((value) => value.action === "OnThrow" && value.accepted),
    closedWindowNoPending:
      data.windowSnapshot === undefined ||
      (closedWindowMetadataValid(data) &&
        !data.pendingAtEnd.scriptBusy &&
        !data.pendingAtEnd.runtimeBusy &&
        !data.pendingAtEnd.recorderPending),
    periodicCaptureCompleted:
      captures.length === list(data.captureScheduleMs).length &&
      captures.length > 0 &&
      captures.every(
        (capture, index) =>
          capture.index === index &&
          capture.scheduledAtMs === data.captureScheduleMs[index] &&
          capture.start &&
          capture.end &&
          capture.end.atMs - capture.start.atMs >= 1000 &&
          Number.isFinite(capture.end.atMs) &&
          capture.end.atMs <= data.sampleMilliseconds &&
          capture.start.clockMode === "recording" &&
          !capture.start.paused &&
          !capture.end.paused &&
          capture.artifact?.status === "captured" &&
          /^[a-f0-9]{64}$/.test(capture.artifact.sha256) &&
          capture.artifact.frameCount > 0 &&
          capture.artifact.endTick >= capture.artifact.startTick &&
          capture.artifact.frameCount ===
            capture.artifact.endTick - capture.artifact.startTick + 1 &&
          capture.requested &&
          capture.beforeStop &&
          capture.artifact.startTick > capture.requested.tick &&
          capture.artifact.endTick <= capture.beforeStop.tick &&
          capture.advanceCount > 0 &&
          capture.overrunCount === 0 &&
          capture.pausedAdvanceCount === 0 &&
          Number.isFinite(capture.maxAccumulatorSeconds) &&
          capture.maxAccumulatorSeconds < 1 / 60,
      ),
    captureTickSamples: list(data.onTick).some((value) => value.recording),
    nativeGraphStarted:
      list(data.nativeStarts).some((value) => value.successfulNativeStart) &&
      list(data.audioTelemetry).some(
        (value) => value.contextState === "running" && value.activeVoices > 0,
      ),
    genuineRunningWarmup:
      Boolean(warmup) &&
      warmup.durationMs >= 10000 &&
      !warmup.error &&
      warmup.ended?.tick > warmup.started?.tick &&
      !warmup.ended?.paused &&
      warmup.nativeStartsAfter > warmup.nativeStartsBefore &&
      warmup.audioClockAfter > warmup.audioClockBefore &&
      warmup.audioAfter?.contextState === "running" &&
      warmup.audioAfter.activeVoices > 0 &&
      list(warmup.advances).length > 0 &&
      warmup.advances.some((value) => value.steps > 0) &&
      warmup.advances.every(
        (value) =>
          value.overrun === false &&
          !value.error &&
          !value.before.paused &&
          !value.after.paused &&
          value.droppedWallTimeSeconds === 0,
      ),
  };
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
  } = parseProfileOptions(process.argv.slice(2));
  const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\./g, "");
  const directory = path.resolve(
    output ?? `artifacts/v1/browser-performance-v3-qualifier-${runId}`,
  );
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
      ...(await walk("src")),
      ...(await walk("schemas")),
      ...(await walk("public")),
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
      names
        .sort()
        .map(async (file) => ({ path: file, sha256: sha(await readFile(path.join(root, file))) })),
    );
  }
  const initialHashes = await inputHashes();
  if (!executablePath) throw new Error("V3_EXPLICIT_PINNED_EXECUTABLE_REQUIRED");
  const executableSha256 = sha(await readFile(executablePath));
  if (executableSha256 !== "480f275b63d1ea39113cbc8344ac395578acc25b432bd39af5fbc77005179aca")
    throw new Error("V3_UNSUPPORTED_NATIVE_LAUNCHER_SHA256");
  const buildStartedAt = new Date().toISOString();
  const build = spawnSync(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--config",
      "tests/browser/performance-v3.vite.config.ts",
      "--mode",
      "e2e",
    ],
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
          (await walk("test-results/performance-v3-dist")).map(async (file) => ({
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
  await cp(path.resolve("test-results/performance-v3-dist"), path.join(directory, "bundle"), {
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
      "tests/browser/performance-v3.vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      "5193",
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
    const url = "http://127.0.0.1:5193/tests/browser/performance-fixture-v3.html";
    const startupDeadline = Date.now() + 15_000;
    for (;;) {
      if (preview.exitCode !== null || preview.signalCode !== null)
        throw new Error(`Preview exited ${preview.exitCode}: ${previewLog()}`);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (response.ok && previewLog().includes("5193")) break;
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
      if (
        browserVersionReceipt.revision?.replace(/^@/, "") !==
        "d0c02bfad08ec92a6ffcf989e53cd995e6381a4c"
      )
        throw new Error("V3_UNSUPPORTED_NATIVE_PRODUCER_REVISION");
    } catch (error) {
      try {
        await writeFile(
          path.join(directory, "v3-native-rejection.json"),
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
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      phase,
      requestedSeconds: seconds,
      profileClass: formal ? "V3_FORMAL_600_CANDIDATE" : "V3_SHORT_WIRING_QUALIFIER_ONLY",
      methodVersion: "3.0.0",
      formal600Run: false,
      overallV1Complete: false,
      traceBufferSizeKiB: 512 * 1024,
      traceCaps: formal ? FORMAL_TRACE_CAPS : SHORT_TRACE_CAPS,
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
  try {
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
        maxContactPairs: Math.max(...data.contacts),
        minContactPairs: Math.min(...data.contacts),
        meanContactPairs:
          data.contacts.reduce((sum, value) => sum + value, 0) / data.contacts.length,
        minAwakeBodies: Math.min(...data.awakeBodies),
        meanAwakeBodies:
          data.awakeBodies.reduce((sum, value) => sum + value, 0) / data.awakeBodies.length,
        maxEventsPerStep: Math.max(...data.events),
        catchupProbe: data.catchupProbe,
        contactBodyIds: data.contactBodyIds,
        contactLoadMethod: data.contactLoadMethod,
        loadMaintenanceScope: data.loadMaintenanceScope,
        minNativePreWakeSleepingBodies: Math.min(
          ...data.loadMaintenance.map((row) => row.nativePreWakeSleepingBodies),
        ),
        maxNativePreWakeSleepingBodies: Math.max(
          ...data.loadMaintenance.map((row) => row.nativePreWakeSleepingBodies),
        ),
        maxNativePostWakeSleepingBodies: Math.max(
          ...data.loadMaintenance.map((row) => row.nativePostWakeSleepingBodies),
        ),
        maxNativePostStepSleepingBodies: Math.max(...data.nativePostStepSleepingBodies),
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
        const data = await page.evaluate(
          async (count) => window.__performanceFixture.acousticProfile(count),
          acousticIterations,
        );
        await writeFile(
          path.join(directory, `acoustic-${profile.id}.raw.json`),
          JSON.stringify(data),
        );
        const acoustic = {
          profileId: profile.id,
          isProductDefault: profile.id === "productDefault",
          sourceCount: data.sourceCount,
          surfacesPerSource: data.surfacesPerSource,
          maxReflectionOrder: data.maxReflectionOrder,
          currentCapability: "first order; order2 NOT SUPPORTED",
          targetHz: data.targetHz,
          actualCompletedHz:
            data.raw.length > 1
              ? (data.raw.length - 1) /
                ((data.raw.at(-1).completedAtMs - data.raw[0].completedAtMs) / 1000)
              : null,
          deadlineMissedBatches: data.raw.filter((value) => value.deadlineMissed).length,
          cadenceStatus: data.raw.some((value) => value.deadlineMissed)
            ? "DEADLINE_MISSES"
            : "ALL_UPDATES_COMPLETED_IN_20HZ_WINDOWS",
          maxReturnedPaths: Math.max(...data.raw.map((value) => value.returnedPaths)),
          minReturnedPaths: Math.min(...data.raw.map((value) => value.returnedPaths)),
          minNativePaths: Math.min(...data.raw.map((value) => value.nativeAudio?.activePaths ?? 0)),
          maxNativePaths: Math.max(...data.raw.map((value) => value.nativeAudio?.activePaths ?? 0)),
          minNativeVoices: Math.min(
            ...data.raw.map((value) => value.nativeAudio?.activeVoices ?? 0),
          ),
          admissions: data.admissions,
          workloadValidity: evaluateAcousticWorkload(data),
          nativeCounterDeltas: Object.fromEntries(
            nativeCounters.map((counter) => [
              counter,
              {
                warmup:
                  data.measurementBaselineNativeAudio[counter] - data.baselineNativeAudio[counter],
                measured: data.nativeAudio[counter] - data.measurementBaselineNativeAudio[counter],
              },
            ]),
          ),
          nativeAudio: data.nativeAudio,
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
      await page.click("#profile-enable-audio");
      await page.waitForSelector('#profile-enable-audio[data-ready="true"]');
      const warmup = await page.evaluate(() => window.__performanceFixture.warmupUI(10_000));
      const cdp = await context.newCDPSession(page),
        bufferUsage = [];
      report.traceLifecycleFaults = [];
      traceObserver = observeTraceFaults({
        browser,
        page,
        cdp,
        records: report.traceLifecycleFaults,
        phase: () => tracePhase,
      });
      const documentBefore = (await cdp.send("Page.getFrameTree")).frameTree.frame;
      let bufferUsageCapped = false;
      cdp.on("Tracing.bufferUsage", (value) => {
        if (bufferUsage.length >= 1024) {
          bufferUsageCapped = true;
          return;
        }
        bufferUsage.push(value);
      });
      const completion = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
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
      tracePhase = "measurement";
      const environment = await page.evaluate(
        (duration) => window.__performanceFixture.beginUI(duration),
        seconds,
      );
      const end = Date.now() + seconds * 1000;
      while (Date.now() < end) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(30_000, Math.max(0, end - Date.now()))),
        );
        process.stdout.write(
          JSON.stringify({
            progress: "ui",
            data: await page.evaluate(() => window.__performanceFixture.progress()),
          }) + "\n",
        );
      }
      // BEGIN_TESTABLE_UI_WINDOW_FINALIZATION
      let data,
        tail,
        uiFailure,
        uiFailed = false,
        closeFailed = false;
      try {
        data = await page.evaluate(() => window.__performanceFixture.closeUIWindow());
      } catch (error) {
        uiFailed = true;
        closeFailed = true;
        uiFailure = error;
      }
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
          const tailSaved = await writeBoundedUIRaw(
            path.join(directory, "ui.finish-tail.raw.json"),
            tail,
          );
          report.uiFinishTail = { ...tailSaved, status: tail.status };
        }
      } catch (error) {
        if (uiFailed)
          uiFailure = new AggregateError([uiFailure, error], "UI finish and tail export failed");
        else {
          uiFailed = true;
          uiFailure = error;
        }
      }
      // Keep the original reference until the outer catch serializes durable diagnostics.
      if (uiFailed)
        report.uiFinishFailure = { status: "INCOMPLETE_UNVERIFIED", primary: uiFailure };
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
        tracePhase = "trace-stream";
        traceMeta.bufferUsage = bufferUsage;
        const traceFile = path.join(directory, "ui.trace.json.gz");
        await saveOwnedTrace(cdp, traceMeta, traceFile, {
          maxCompressedBytes: (formal ? FORMAL_TRACE_CAPS : SHORT_TRACE_CAPS).compressedBytes,
        });
      } catch (traceError) {
        if (uiFailed)
          throw new AggregateError([uiFailure, traceError], "UI finish and trace recovery failed");
        throw traceError;
      }
      if (uiFailed) throw uiFailure;
      if (!closedWindowMetadataValid(data)) throw new Error("UI_CLOSED_WINDOW_METADATA_INVALID");
      // END_TESTABLE_UI_WINDOW_FINALIZATION
      const traceFile = path.join(directory, "ui.trace.json.gz");
      if (bufferUsageCapped) throw new Error("V3_BUFFER_METADATA_CAP");
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
      };
      const trace = await (formal
        ? analyzeFormalTraceStreamV3(traceFile, data, traceContext)
        : analyzeTraceV3(traceFile, data, traceContext));
      report.formal600Run = formal && data.sampleMilliseconds >= 600000;
      report.traceBufferSizeKiB = 512 * 1024;
      trace.analysisContext = traceContext;
      await writeFile(
        path.join(directory, "ui.trace-analysis.json"),
        JSON.stringify(trace, null, 2) + "\n",
      );
      report.ui = {
        environment,
        sceneObjectCount: mounted.scene.objects.length,
        dynamicBodies: mounted.scene.objects.filter((value) => value.mode.startsWith("dynamic"))
          .length,
        warmupSeconds: 10,
        warmup,
        sampleMilliseconds: data.sampleMilliseconds,
        measurementBoundaryVersion:
          data.collectionWindow?.schemaVersion ?? "legacy-contained-native-times",
        collectionWindow: data.collectionWindow,
        frameCount: data.frame.length,
        simulationRunningFrames: data.frame.filter((frame) => frame.simulationRunning).length,
        simulationTickDelta: data.measuredEndTick - data.startedAtTick,
        droppedWallTimeSeconds: data.droppedWallTimeSeconds,
        cumulativeDroppedWallTimeSeconds: data.cumulativeDroppedWallTimeSeconds,
        measuredClockStart: data.measurementStartedClock,
        measuredClockEnd: data.measuredEndClock,
        captures: data.captureWindows,
        advanceCount: data.advances.length,
        overruns: data.advances.filter((value) => value.overrun).length,
        pausedAdvances: data.advances.filter((value) => value.before.paused || value.after.paused)
          .length,
        poseCalls: data.poseCalls,
        interpolationCalls: data.interpolationCalls,
        interpolationCallsPerPresentedFrame: data.interpolationCalls / data.frame.length,
        interpolationObservation: {
          ...data.interpolationObservation,
          byMethod: Object.fromEntries(
            Object.entries(data.interpolationObservation.byMethod).map(([method, value]) => [
              method,
              {
                calls: value.calls,
                successfulCalls: value.successfulCalls,
                failedCalls: value.failedCalls,
              },
            ]),
          ),
        },
        droppedSamples: data.droppedSamples,
        longTaskSupported: data.longTaskSupported,
        longTasks: data.longTasks.length,
        audio: data.audio,
        audioSampleCount: data.audioTelemetry.length,
        peakNativeVoices: Math.max(0, ...data.audioTelemetry.map((value) => value.activeVoices)),
        peakNativePaths: Math.max(0, ...data.audioTelemetry.map((value) => value.activePaths)),
        recording: data.recorderArtifact,
        trace: {
          ...traceMeta,
          stream: undefined,
          file: "ui.trace.json.gz",
          analysis: "ui.trace-analysis.json",
          markerCoverage: trace.coverage,
        },
        finalState: data.final.simulationState,
        finalError: data.final.error,
      };
      const intervals = data.frame
        .slice(1)
        .map((frame, i) => frame.timestamp - data.frame[i].timestamp);
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
      report.ui.workloadValidity = evaluateUIWorkload(data, {
        pageErrors: pageErrorCapture.snapshot().entries,
        traceCoverage: trace.coverage,
      });
      const main = metric("ui.rendererMainTaskOccupancyPerFrame", trace.mainTaskOccupancyMs, 4);
      main.method =
        "Conservative wall-occupancy upper bound including all renderer-main tasks, not thread CPU tdur";
      if (
        traceMeta.dataLossOccurred ||
        !trace.coverage.complete ||
        !Object.values(report.ui.workloadValidity).every(Boolean)
      )
        if (main.status === "PASS") main.status = "UNVERIFIED";
      report.metrics.push(main);
    }
    report.executableSha256After = sha(await readFile(executablePath));
    report.executableStableDuringRun = report.executableSha256After === executableSha256;
    if (!report.executableStableDuringRun) throw new Error("V3_NATIVE_EXECUTABLE_CHANGED");
    report.sourceStableDuringRun =
      JSON.stringify(initialHashes) === JSON.stringify(await inputHashes());
    const finalBundle = await Promise.all(
      (await walk("test-results/performance-v3-dist")).map(async (file) => ({
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
    report.status = "FAILED";
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
    let browserConnected = null;
    try {
      browserConnected = browser.isConnected();
    } catch (error) {
      cleanupErrors.push(error);
    }
    report.cleanup = {
      browserConnected,
      previewExitCode: preview.exitCode,
      previewSignalCode: preview.signalCode,
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
