/* global window, process, setTimeout, clearTimeout, fetch, AbortSignal, Buffer, TextDecoder */
/* eslint no-undef: "error" */
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, writeFile, cp } from "node:fs/promises";
import { once } from "node:events";
import { finished } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const list = (value) => (Array.isArray(value) ? value : []);
const allValid = (value) => Object.values(value).every((flag) => flag === true);
const uniqueIds = (value, count) =>
  Array.isArray(value) &&
  value.length === count &&
  new Set(value).size === count &&
  value.every((id) => typeof id === "string" && id.length > 0);
const sameIds = (a, b) =>
  a.length === b.length && [...a].sort().every((id, index) => id === [...b].sort()[index]);
const nativeCounters = ["droppedPaths", "droppedVoices", "stolenVoices", "staleFrames"];
export function evaluateAcousticWorkload(data) {
  const raw = list(data.raw),
    warmup = list(data.warmupRaw),
    all = [...warmup, ...raw];
  const target = data.nativeGraphTargetPaths,
    cap = data.requestedPathCapPerVoice;
  const baseline = data.baselineNativeAudio;
  return {
    completeSamples: raw.length >= 600 && raw.length === data.iterations && warmup.length === 20,
    eightVoicesAdmitted:
      uniqueIds(
        list(data.admissions).map((voice) => voice.sourceId),
        8,
      ) && data.admissions.every((v) => v.accepted),
    actualModuleWorker: data.telemetry?.mode === "worker",
    frozenAcousticMatrix:
      data.sourceCount === 8 &&
      data.surfacesPerSource === 32 &&
      data.maxReflectionOrder === 1 &&
      data.targetHz === 20,
    nativeContextRunning:
      all.length > 0 && all.every((row) => row.nativeAudio?.contextState === "running"),
    sustainedRequestedPaths:
      raw.length > 0 &&
      raw.every((row) => {
        const routes = row.routeState,
          voices = list(routes?.voices);
        return (
          target === 8 * cap &&
          [8, 32].includes(cap) &&
          uniqueIds(
            voices.map((voice) => voice.sourceId),
            8,
          ) &&
          uniqueIds(
            voices.map((voice) => voice.instanceId),
            8,
          ) &&
          voices.every(
            (voice) =>
              voice.active === true &&
              voice.sourceStopped === false &&
              voice.internalArrival === false &&
              voice.routesConnected === true &&
              voice.lateRouteCount === 0 &&
              uniqueIds(voice.wantedPathIds, cap) &&
              uniqueIds(voice.currentPathIds, cap) &&
              sameIds(voice.wantedPathIds, voice.currentPathIds) &&
              voice.expectedPoseTick === row.tick &&
              voice.framePoseTick === row.tick &&
              typeof voice.expectedRequestId === "string" &&
              voice.cachedRequestId === voice.expectedRequestId,
          ) &&
          routes.activeCurrentRouteCount === target &&
          routes.retiringCurrentRouteCount === 0 &&
          routes.activeLateRouteCount === 0 &&
          routes.retiringLateRouteCount === 0 &&
          routes.retiringVoiceCount === 0 &&
          Number.isSafeInteger(routes.retiredRouteCount) &&
          routes.retiredRouteCount >= 0 &&
          Number.isSafeInteger(routes.retiredLateRouteCount) &&
          routes.retiredLateRouteCount >= 0 &&
          routes.retiredLateRouteCount <= routes.retiredRouteCount &&
          row.nativeAudio?.activePaths === target + routes.retiredRouteCount
        );
      }),
    sustainedEightVoices:
      raw.length > 0 &&
      raw.every(
        (row) => row.nativeAudio?.activeVoices === 8 && row.nativeAudio?.activeSources === 8,
      ),
    cleanNativeState:
      raw.length > 0 &&
      raw.every((row) => {
        const audio = row.nativeAudio;
        return (
          audio?.enabled === true &&
          audio.paused === false &&
          audio.draining === false &&
          audio.retiringVoices === 0 &&
          audio.pendingVoices === 0 &&
          audio.frozenVoices === 0 &&
          audio.frozenArrivals === 0 &&
          audio.budget?.maxPathsPerVoice === cap &&
          audio.budget.maxTotalPaths === (cap === 32 ? 256 : 96)
        );
      }),
    noNativeCapacityOrStaleLoss:
      Boolean(baseline && data.measurementBaselineNativeAudio) &&
      nativeCounters.every((counter) => baseline[counter] === 0) &&
      [baseline, data.measurementBaselineNativeAudio, ...all.map((row) => row.nativeAudio)].every(
        (audio) =>
          audio &&
          audio.lastError === null &&
          nativeCounters.every(
            (counter) =>
              Number.isSafeInteger(audio[counter]) && audio[counter] === baseline[counter],
          ),
      ),
    eightSuccessfulNativeStarts:
      list(data.nativeStarts).filter((v) => v.successfulNativeStart).length === 8,
    nativeClockAdvances:
      raw.length > 1 &&
      Number.isFinite(raw[0].nativeAudio?.currentTimeSeconds) &&
      raw.at(-1).nativeAudio?.currentTimeSeconds > raw[0].nativeAudio.currentTimeSeconds,
    meets20HzWindows:
      raw.length > 0 &&
      raw.every(
        (row) =>
          row.deadlineMissed === false &&
          Number.isFinite(row.submittedAtMs) &&
          Number.isFinite(row.completedAtMs) &&
          row.scheduledAtMs === row.tick * 50 &&
          row.completedAtMs >= row.submittedAtMs &&
          row.completedAtMs <= row.scheduledAtMs + 50,
      ),
    observableDeliveryIdentity:
      raw.length > 0 &&
      raw.every((row) => {
        const delivery = row.observedDelivery;
        const times = [
          delivery?.receiveEntryAtMs,
          delivery?.receiveExitAtMs,
          delivery?.awaitContinuationAtMs,
          delivery?.consumerFinishedAtMs,
        ];
        return (
          delivery &&
          Number.isSafeInteger(delivery.batchId) &&
          delivery.batchId > 0 &&
          times.every(
            (time, index) => Number.isFinite(time) && (index === 0 || time >= times[index - 1]),
          ) &&
          delivery.durationMs === times[3] - times[0] &&
          row.receiveThroughNativeConsumersMs === delivery.durationMs &&
          uniqueIds(
            list(delivery.requestIdentities).map((identity) => identity.requestId),
            8,
          ) &&
          delivery.requestIdentities.every(
            (identity) =>
              identity.poseTick === row.tick &&
              list(row.routeState?.voices).some(
                (voice) =>
                  voice.sourceId === identity.sourceId &&
                  voice.expectedRequestId === identity.requestId,
              ),
          )
        );
      }),
  };
}
export function evaluatePhysicsWorkload(data) {
  const count = data.iterations,
    probe = data.catchupProbe;
  return {
    exactBodyProfile:
      data.totalBodies === 256 &&
      data.dynamicBodies === 255 &&
      data.fixedBodies === 1 &&
      data.ccdBodyCount === 64,
    fixedStepAndWarmup:
      data.fixedDtSeconds === 1 / 60 && data.maxCatchUpSteps === 4 && data.warmupSteps === 240,
    completeSamples:
      Number.isSafeInteger(count) &&
      count >= 3000 &&
      [
        data.nativeStepMs,
        data.completeFixedTickMs,
        data.contacts,
        data.events,
        data.awakeBodies,
      ].every(
        (values) =>
          Array.isArray(values) &&
          values.length === count &&
          values.every((v) => Number.isFinite(v) && v >= 0),
      ),
    awakeDynamicLoad:
      list(data.awakeBodies).length > 0 && data.awakeBodies.every((count) => count === 255),
    allDynamicBodiesContacted:
      uniqueIds(data.contactBodyIds, 255) &&
      data.contactBodyIds.every(
        (id) => /^stress\.(?:0|[1-9]\d*)$/.test(id) && Number(id.split(".").at(-1)) < 255,
      ),
    observedContactLoad: list(data.contacts).some((count) => count > 0),
    boundedCatchup:
      Boolean(probe) &&
      probe.steps === 4 &&
      probe.afterTick - probe.beforeTick === 4 &&
      probe.overrun === true &&
      Number.isFinite(probe.droppedWallTimeSeconds) &&
      probe.droppedWallTimeSeconds > 0,
  };
}
export function analyzeFrameCoverage(
  frame,
  { startedAtPerformanceMs, sampleMilliseconds, collectionWindow },
) {
  const frames = list(frame);
  const times = frames.map((value) => (typeof value === "number" ? value : value?.timestamp));
  const validClock =
    Number.isFinite(startedAtPerformanceMs) &&
    Number.isFinite(sampleMilliseconds) &&
    sampleMilliseconds > 0;
  const hasWindow = collectionWindow !== undefined;
  const proofWindowValid = Boolean(
    hasWindow &&
      collectionWindow &&
      validClock &&
      collectionWindow.schemaVersion === "2.0.0" &&
      typeof collectionWindow.collectionId === "string" &&
      collectionWindow.collectionId.length > 0 &&
      collectionWindow.beginPerformanceMs === startedAtPerformanceMs &&
      Number.isFinite(collectionWindow.endPerformanceMs) &&
      collectionWindow.endPerformanceMs - collectionWindow.beginPerformanceMs ===
        sampleMilliseconds,
  );
  const end = proofWindowValid
    ? collectionWindow.endPerformanceMs
    : startedAtPerformanceMs + sampleMilliseconds;
  const rawFiniteAndStrictlyOrdered =
    times.length >= 2 &&
    times.every((time, index) => Number.isFinite(time) && (index === 0 || time > times[index - 1]));
  const membershipProofValid =
    proofWindowValid &&
    frames.every(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        value.collectionId === collectionWindow.collectionId &&
        Number.isFinite(value.callbackObservedAtPerformanceMs) &&
        value.callbackObservedAtPerformanceMs >= startedAtPerformanceMs &&
        value.callbackObservedAtPerformanceMs <= end &&
        value.timestamp <= value.callbackObservedAtPerformanceMs,
    );
  const legacyContained =
    !hasWindow &&
    validClock &&
    times.every((time) => Number.isFinite(time) && time >= startedAtPerformanceMs && time <= end);
  const collectionMembershipValid = hasWindow ? membershipProofValid : legacyContained;
  const complete = validClock && rawFiniteAndStrictlyOrdered && collectionMembershipValid;
  const rawLeadingOffsetsMs = times
    .filter((time) => Number.isFinite(time) && time < startedAtPerformanceMs)
    .map((time) => time - startedAtPerformanceMs);
  return {
    measurementBoundaryVersion: hasWindow
      ? (collectionWindow?.schemaVersion ?? "UNRECOGNIZED")
      : "legacy-contained-native-times",
    complete,
    rawFiniteAndStrictlyOrdered,
    membershipProofValid,
    collectionMembershipValid,
    boundaries: complete
      ? [
          startedAtPerformanceMs,
          ...times.filter((time) => time > startedAtPerformanceMs && time < end),
          end,
        ]
      : [],
    firstRafGapMs:
      Number.isFinite(times[0]) && validClock ? times[0] - startedAtPerformanceMs : null,
    lastRafGapMs: Number.isFinite(times.at(-1)) && validClock ? end - times.at(-1) : null,
    rawLeadingOffsetsMs,
    leadingCount: rawLeadingOffsetsMs.length,
    method:
      "Raw RAF timestamps remain finite/strictly ordered evidence. V2 collection identity and actual callback-observation time prove window membership independently from the native RAF timestamp. Bins are exact markers plus strictly interior native timestamps; raw leading negative offsets are retained. No epsilon or outside-window legacy acceptance.",
  };
}
export function evaluateUIWorkload(data, { pageErrors = [], traceCoverage = {} } = {}) {
  const advances = list(data.advances),
    captures = list(data.captureWindows),
    warmup = data.warmup;
  const measuredActions = list(data.actions).filter((value) => value.phase !== "warmup");
  const frameCoverage = analyzeFrameCoverage(data.frame, data);
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
  const root = process.cwd(),
    args = process.argv.slice(2);
  const option = (key, fallback) => {
    const at = args.indexOf(key);
    return at < 0 ? fallback : args[at + 1];
  };
  const seconds = Number(option("--seconds", "600")),
    phase = option("--phase", "all"),
    physicsIterations = Number(option("--physics-iterations", "3000")),
    acousticIterations = Number(option("--acoustic-iterations", "600"));
  if (
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    seconds > 3600 ||
    !["all", "ui", "physics", "acoustics"].includes(phase) ||
    !Number.isSafeInteger(physicsIterations) ||
    physicsIterations < 1 ||
    physicsIterations > 18000 ||
    !Number.isSafeInteger(acousticIterations) ||
    acousticIterations < 1 ||
    acousticIterations > 18000
  )
    throw new Error("Invalid profile duration or phase");
  const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\./g, "");
  const directory = path.resolve(option("--output", `artifacts/v1/browser-performance-${runId}`));
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
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
      "tests/browser/performance.vite.config.ts",
      "tests/browser/performance-fixture.html",
      "tests/browser/performance-fixture.mjs",
      "tests/browser/performance-profile.mjs",
      "tests/integration/performance-profile.test.mjs",
    ];
    return Promise.all(
      names
        .sort()
        .map(async (file) => ({ path: file, sha256: sha(await readFile(path.join(root, file))) })),
    );
  }
  const initialHashes = await inputHashes();
  const buildStartedAt = new Date().toISOString();
  const build = spawnSync(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--config",
      "tests/browser/performance.vite.config.ts",
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
          (await walk("test-results/performance-dist")).map(async (file) => ({
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
  await cp(path.resolve("test-results/performance-dist"), path.join(directory, "bundle"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  if (args.includes("--prepare")) {
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
      "tests/browser/performance.vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      "5191",
      "--strictPort",
    ],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  async function stopPreview() {
    if (preview.exitCode !== null || preview.signalCode !== null) return;
    preview.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000);
      preview.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (preview.exitCode === null && preview.signalCode === null)
      throw new Error(`Preview process ${preview.pid} did not terminate`);
  }
  let previewLog = "";
  preview.stdout.on("data", (value) => {
    previewLog += value.toString();
  });
  preview.stderr.on("data", (value) => {
    previewLog += value.toString();
  });
  const url = "http://127.0.0.1:5191/tests/browser/performance-fixture.html";
  let browser, context, page, browserCDP;
  const softwareGPU = args.includes("--swiftshader");
  try {
    const startupDeadline = Date.now() + 15_000;
    for (;;) {
      if (preview.exitCode !== null || preview.signalCode !== null)
        throw new Error(`Preview exited ${preview.exitCode}: ${previewLog}`);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (response.ok && previewLog.includes("5191")) break;
      } catch {
        /* bounded startup probe */
      }
      if (Date.now() >= startupDeadline) throw new Error("Preview startup timeout");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({
      channel: "chrome",
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
  } catch (error) {
    await browser?.close();
    await stopPreview();
    await writeFile(path.join(directory, "preview.log.txt"), previewLog);
    throw error;
  }
  const consoleEvents = [],
    pageErrors = [];
  page.on("console", (message) =>
    consoleEvents.push({
      type: message.type(),
      text: message.text(),
      at: new Date().toISOString(),
    }),
  );
  page.on("pageerror", (error) =>
    pageErrors.push({ message: error.message, stack: error.stack, at: new Date().toISOString() }),
  );
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
    gitStatusProbe = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all", "-z"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
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
    profileClass: ["all", "ui"].includes(phase)
      ? seconds >= 600
        ? "FORMAL_DURATION"
        : "SMOKE_ONLY"
      : "SUBSYSTEM_PROFILE",
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
  let traceMeta = null;
  const watchdog = setTimeout(
    () => {
      report.status = "TIMED_OUT";
      report.wallTimeLimitSeconds = seconds + 240;
      void browser.close();
    },
    (seconds + 240) * 1000,
  );
  watchdog.unref();
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
      cdp.on("Tracing.bufferUsage", (value) => bufferUsage.push(value));
      const completion = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
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
      const data = await page.evaluate(() => window.__performanceFixture.finishUI());
      await cdp.send("Tracing.end");
      let traceFlushTimer;
      try {
        traceMeta = await Promise.race([
          completion,
          new Promise((_, reject) => {
            traceFlushTimer = setTimeout(() => reject(new Error("CDP_TRACE_FLUSH_TIMEOUT")), 60000);
          }),
        ]);
      } finally {
        clearTimeout(traceFlushTimer);
      }
      traceMeta.bufferUsage = bufferUsage;
      const traceFile = path.join(directory, "ui.trace.json.gz");
      await saveTrace(cdp, traceMeta, traceFile);
      await writeFile(path.join(directory, "ui.raw.json"), JSON.stringify(data));
      const trace = await analyzeTrace(traceFile, data);
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
        pageErrors,
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
    report.sourceStableDuringRun =
      JSON.stringify(initialHashes) === JSON.stringify(await inputHashes());
    const finalBundle = await Promise.all(
      (await walk("test-results/performance-dist")).map(async (file) => ({
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
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    report.consoleEvents = consoleEvents;
    report.pageErrors = pageErrors;
    const cleanupErrors = [];
    try {
      await browser.close();
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    try {
      await stopPreview();
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    report.cleanup = {
      browserConnected: browser.isConnected(),
      previewExitCode: preview.exitCode,
      previewSignalCode: preview.signalCode,
      errors: cleanupErrors,
    };
    if (cleanupErrors.length) {
      report.status = "FAILED_CLEANUP";
      process.exitCode = 1;
    }
    await writeFile(path.join(directory, "preview.log.txt"), previewLog);
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
    );
    process.stdout.write(
      JSON.stringify({
        directory,
        status: report.status,
        failures: report.metrics
          .filter((value) => value.status === "FAIL")
          .map((value) => value.id),
        pageErrors: pageErrors.length,
      }) + "\n",
    );
  }
}
export function metric(id, values, threshold = null) {
  const raw = values
      .filter((value) => typeof value === "number" && Number.isFinite(value))
      .sort((a, b) => a - b),
    n = raw.length;
  const quantile = (fraction) => (n ? raw[Math.min(n - 1, Math.ceil(n * fraction) - 1)] : null);
  return {
    id,
    unit: "ms",
    count: n,
    p50: quantile(0.5),
    p95: quantile(0.95),
    p99: quantile(0.99),
    max: n ? raw[n - 1] : null,
    thresholdP95LessThan: threshold,
    exceedanceCount: threshold === null ? null : raw.filter((value) => value >= threshold).length,
    status:
      n === 0
        ? "NOT_RUN"
        : threshold === null
          ? "MEASURED"
          : quantile(0.95) < threshold
            ? "PASS"
            : "FAIL",
  };
}
async function saveTrace(cdp, metadata, filename) {
  if (!metadata.stream) throw new Error("CDP trace stream unavailable");
  const target = createWriteStream(filename),
    writer = metadata.streamCompression === "gzip" ? target : createGzip();
  if (writer !== target) writer.pipe(target);
  for (;;) {
    const part = await cdp.send("IO.read", { handle: metadata.stream, size: 1024 * 1024 });
    if (!writer.write(Buffer.from(part.data, part.base64Encoded ? "base64" : "utf8")))
      await once(writer, "drain");
    if (part.eof) break;
  }
  writer.end();
  await finished(target);
  await cdp.send("IO.close", { handle: metadata.stream });
}
export async function analyzeTrace(filename, ui) {
  const v2 = ui.collectionWindow?.schemaVersion === "2.0.0";
  const beginMarkName = v2
    ? `reflection-profile.begin.${ui.collectionWindow.collectionId}`
    : "reflection-profile.begin";
  const endMarkName = v2
    ? `reflection-profile.end.${ui.collectionWindow.collectionId}`
    : "reflection-profile.end";
  const markerIdentityValid =
    !v2 ||
    (ui.collectionWindow.beginMarkName === beginMarkName &&
      ui.collectionWindow.endMarkName === endMarkName);
  const names = new Map(),
    tasks = [],
    markers = new Map();
  let events = 0,
    found = false,
    prefix = "",
    depth = 0,
    quoted = false,
    escaped = false,
    eventText = "";
  const decoder = new TextDecoder();
  for await (const chunk of createReadStream(filename).pipe(createGunzip())) {
    let text = decoder.decode(chunk, { stream: true });
    if (!found) {
      prefix += text;
      const match = /"traceEvents"\s*:\s*\[/.exec(prefix);
      if (!match) {
        prefix = prefix.slice(-64);
        continue;
      }
      text = prefix.slice(match.index + match[0].length);
      prefix = "";
      found = true;
    }
    for (const character of text) {
      if (depth === 0) {
        if (character !== "{") continue;
        depth = 1;
        eventText = "{";
        quoted = false;
        escaped = false;
        continue;
      }
      eventText += character;
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === "{") depth++;
      else if (character === "}" && --depth === 0) {
        const event = JSON.parse(eventText);
        events++;
        if (event.ph === "M" && event.name === "thread_name")
          names.set(`${event.pid}:${event.tid}`, event.args?.name);
        if (event.name === beginMarkName || event.name === endMarkName)
          markers.set(event.name, { ts: event.ts, key: `${event.pid}:${event.tid}` });
        if (
          event.ph === "X" &&
          ["RunTask", "ThreadControllerImpl::RunTask"].includes(event.name) &&
          Number.isFinite(event.dur)
        )
          tasks.push([`${event.pid}:${event.tid}`, event.ts, event.ts + event.dur]);
      }
    }
  }
  const beginMarker = markers.get(beginMarkName),
    endMarker = markers.get(endMarkName),
    begin = beginMarker?.ts,
    end = endMarker?.ts;
  const mainThreads =
    beginMarker &&
    names.get(beginMarker.key) === "CrRendererMain" &&
    beginMarker.key === endMarker?.key
      ? [beginMarker.key]
      : [];
  const selected = tasks
    .filter(([key, start, stop]) => mainThreads.includes(key) && stop >= begin && start <= end)
    .map(([, start, stop]) => [Math.max(start, begin), Math.min(stop, end)])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const item of selected) {
    const previous = merged.at(-1);
    if (previous && item[0] <= previous[1]) previous[1] = Math.max(previous[1], item[1]);
    else merged.push([...item]);
  }
  const origin = ui.startedAtPerformanceMs,
    performanceDurationMs = ui.sampleMilliseconds ?? (end - begin) / 1000,
    frameCoverage = analyzeFrameCoverage(ui.frame, {
      startedAtPerformanceMs: origin,
      sampleMilliseconds: performanceDurationMs,
      collectionWindow: ui.collectionWindow,
    }),
    frameBoundaries = frameCoverage.boundaries.map(
      (time) => begin + ((time - origin) / performanceDurationMs) * (end - begin),
    ),
    cpu = Array.from({ length: Math.max(0, frameBoundaries.length - 1) }, () => 0);
  let frameIndex = 0;
  for (const [taskStart, taskEnd] of merged) {
    const start = taskStart,
      stop = taskEnd;
    while (frameIndex + 1 < frameBoundaries.length && frameBoundaries[frameIndex + 1] <= start)
      frameIndex++;
    for (let i = frameIndex; i + 1 < frameBoundaries.length && frameBoundaries[i] < stop; i++)
      cpu[i] +=
        Math.max(0, Math.min(stop, frameBoundaries[i + 1]) - Math.max(start, frameBoundaries[i])) /
        1000;
  }
  const complete =
    Number.isFinite(begin) &&
    Number.isFinite(end) &&
    end > begin &&
    mainThreads.length > 0 &&
    selected.length > 0 &&
    markerIdentityValid &&
    frameCoverage.complete &&
    selected[0][0] - begin <= 50_000 &&
    end - selected.at(-1)[1] <= 50_000;
  return {
    parsedTraceEvents: events,
    rendererMainThreads: mainThreads,
    nativeTaskCount: selected.length,
    mergedTaskCount: merged.length,
    coverage: {
      complete,
      beginMarkTsUs: begin ?? null,
      endMarkTsUs: end ?? null,
      markedDurationMs:
        Number.isFinite(begin) && Number.isFinite(end) ? (end - begin) / 1000 : null,
      frameCoverage,
      markerIdentityValid,
      beginMarkName,
      endMarkName,
      clockCorrelation: {
        method:
          "Two matching begin/end PerformanceMark anchors map only RAF bin positions into native trace microseconds; RunTask clipping, union and occupancy stay in native trace units, converted only /1000 to ms",
        performanceBeginMs: origin,
        performanceDurationMs,
        performanceEndMs: ui.collectionWindow?.endPerformanceMs ?? origin + performanceDurationMs,
        traceBeginUs: begin ?? null,
        traceEndUs: end ?? null,
        beginAnchorOffsetMs: Number.isFinite(begin) ? begin / 1000 - origin : null,
        endAnchorOffsetMs: Number.isFinite(end)
          ? end / 1000 - (ui.collectionWindow?.endPerformanceMs ?? origin + performanceDurationMs)
          : null,
        rawDurationDifferenceMs:
          Number.isFinite(begin) && Number.isFinite(end)
            ? (end - begin) / 1000 - performanceDurationMs
            : null,
        binMappingTraceMicrosecondsPerPerformanceMillisecond:
          Number.isFinite(begin) && Number.isFinite(end) && performanceDurationMs > 0
            ? (end - begin) / performanceDurationMs
            : null,
        occupancyUnit: "Native RunTask trace microseconds /1000; durations are never rescaled",
        nativeTraceBinBoundariesUs: frameBoundaries,
      },
    },
    method:
      "Union of actual RunTask wall spans on the begin/end marker's CrRendererMain thread, clipped exactly to native trace markers and split using two-anchor-correlated strict-interior RAF bin positions. Every cross-edge span is retained inside the window; overlapping tasks counted once, occupancy converted only from native microseconds /1000. Raw leading timestamps require v2 callback-membership proof. This is wall occupancy, not thread CPU tdur.",
    mainTaskOccupancyMs: complete ? cpu : [],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
