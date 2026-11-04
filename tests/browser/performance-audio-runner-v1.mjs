/* global process, window, fetch, setTimeout, clearTimeout */
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, cp, lstat, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeCapturedPcmWave } from "./performance-pcm-artifact-v1.mjs";
import {
  verifyControlledAudioCase,
  summarizeControlledAudioOverhead,
} from "./performance-audio-controls-v1.mjs";
import {
  cleanupOwnedResources,
  createBoundedCapture,
  stopOwnedProcess,
} from "./performance-owned-cleanup-v3.mjs";
import { serializeErrorRecord } from "./performance-error-record-v3.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CASES = [
  "steady",
  "main-stall",
  "late-onset",
  "stale-frame",
  "path-churn",
  "voice-path-budget",
  "digital-gap",
];
const CONFIG = "tests/browser/performance-audio-attribution-v1.vite.config.ts";
const DIST = "test-results/performance-audio-attribution-v1-dist";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function walk(relative) {
  const result = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = path.posix.join(relative, entry.name);
    result.push(...(entry.isDirectory() ? await walk(file) : [file]));
  }
  return result.sort();
}
async function snapshot(files) {
  return Promise.all(
    files.map(async (file) => ({ path: file, sha256: sha(await readFile(path.join(root, file))) })),
  );
}
function cpuDifference(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after))
    return {
      status: "UNAVAILABLE",
      processes: null,
      completeCoverage: false,
      totalMatchedProcessCpuSeconds: null,
    };
  const initial = new Map(before.map((row) => [`${row.id}:${row.type}`, row]));
  const processes = after.map((row) => {
    const previous = initial.get(`${row.id}:${row.type}`);
    const known =
      previous &&
      Number.isFinite(previous.cpuTime) &&
      Number.isFinite(row.cpuTime) &&
      row.cpuTime >= previous.cpuTime;
    return {
      id: row.id,
      type: row.type,
      beforeCpuSeconds: previous?.cpuTime ?? null,
      afterCpuSeconds: row.cpuTime ?? null,
      deltaCpuSeconds: known ? row.cpuTime - previous.cpuTime : null,
      status: known ? "OBSERVED" : "NEW_OR_RESET_PROCESS_UNAVAILABLE",
    };
  });
  const afterKeys = new Set(after.map((row) => `${row.id}:${row.type}`));
  const disappeared = before.filter((row) => !afterKeys.has(`${row.id}:${row.type}`));
  const completeCoverage =
    disappeared.length === 0 && processes.every((row) => row.deltaCpuSeconds !== null);
  const values = processes.map((row) => row.deltaCpuSeconds).filter((value) => value !== null);
  return {
    status: completeCoverage ? "OBSERVED" : "PARTIAL_PROCESS_COVERAGE",
    processes,
    disappeared,
    completeCoverage,
    totalMatchedProcessCpuSeconds: values.length
      ? values.reduce((sum, value) => sum + value, 0)
      : null,
    scope:
      "Browser API cumulative process CPU endpoints over whole case including setup/capture/encoding/report/cleanup; not native DSP callback CPU",
  };
}
function controlObservations(data) {
  const diag = data.afterDiagnostics;
  const counters = diag
    ? {
        onsetCount: diag.onsets.count,
        lateOnsets: diag.onsets.lateCount,
        staleFrames: diag.frameDecisions.stale,
        snapshotDecisions: diag.delivery,
        voiceRejections: diag.admissions?.droppedVoices ?? null,
        pathDrops: diag.admissions?.droppedPaths ?? null,
      }
    : null;
  const nativeWindows = [],
    seen = new Set();
  for (const row of data.telemetry ?? []) {
    const output = row.diagnostics?.nativeOutput;
    if (!output || output.status !== "AVAILABLE") continue;
    const key = `${output.contextGeneration}:${output.polledAtMs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nativeWindows.push(output);
  }
  return {
    control: counters,
    nativeOutputCounterWindows: nativeWindows.length ? nativeWindows : null,
    nativeOutputScope:
      "Native browser playbackStats counter windows only; no exact hardware/PCM event alignment or hearing inference",
    nativeDspCpuMs: null,
    hardwareBufferFrames: null,
    hearing: "NOT_RUN",
  };
}
function expectedSignalChecks(data, analysis) {
  if (data.probeMode === "off")
    return { status: "NOT_OBSERVED_PROBE_OFF", digitalContinuity: null };
  if (!analysis?.qualified) return { status: "UNVERIFIED_PCM", digitalContinuity: null };
  if (data.caseId !== "digital-gap")
    return {
      status: analysis.digitalGaps.length
        ? "NEGATIVE_DIGITAL_SILENCE_OBSERVED"
        : "NO_BLOCK_LENGTH_DIGITAL_SILENCE_OBSERVED",
      digitalContinuity: analysis.digitalGaps.length === 0,
      scope:
        "Known active source and exact-zero runs only; not a universal click/pop, hardware underrun or hearing test",
    };
  const injected = data.injectedGap;
  const matching = analysis.digitalGaps.find(
    (gap) =>
      gap.startFrame <= injected.startFrame + 1 && gap.endFrameExclusive >= injected.endFrame - 1,
  );
  return {
    status: matching ? "EXPECTED_INJECTED_DIGITAL_GAP_OBSERVED" : "INJECTED_GAP_NOT_VERIFIED",
    digitalContinuity: null,
    injectedGapVerified: Boolean(matching),
    boundaryToleranceFrames: 1,
    scope:
      "Intentional post-master GainNode silence; preserved as a negative source-signal control, never a product underrun",
  };
}

export async function runAudioAttribution({
  executablePath,
  output,
  smoke = false,
  audioModel = "nativeReference",
}) {
  if (process.version !== "v22.17.0") throw new Error("EXACT_NODE_REQUIRED");
  if (
    !executablePath ||
    !output ||
    !["nativeReference", "nativeCarrierRoutes"].includes(audioModel)
  )
    throw new Error("EXPLICIT_VALID_AUDIO_PROFILE_REQUIRED");
  const directory = path.resolve(output);
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const ownFiles = (await readdir(path.join(root, "tests/browser")))
    .filter((name) => name.startsWith("performance-") && /\.(mjs|js|html|ts)$/.test(name))
    .map((name) => `tests/browser/${name}`);
  const files = [
    ...(await walk("src")),
    ...(await walk("schemas")),
    ...(await walk("public")),
    ...ownFiles,
    "package.json",
    "package-lock.json",
    ".node-version",
    "tests/browser/render/verify-downloaded-wav.mjs",
  ].sort();
  const before = await snapshot(files),
    exeBefore = sha(await readFile(executablePath));
  const report = {
    schemaVersion: 1,
    method: "controlled-native-audio-pcm-v1",
    sourceBefore: before,
    startedAt: new Date().toISOString(),
    status: "RUNNING",
    audioModel,
    scope: smoke ? "CONTROLLED_COMPONENT_SMOKE" : "CONTROLLED_COMPONENT_ABBA",
    formal600Run: false,
    formalQualification: "NOT_APPROVED",
    overallV1Complete: false,
    paidCalls: 0,
    repetitions: smoke ? ["on", "off"] : ["on", "off", "off", "on"],
    cases: smoke ? ["steady"] : CASES,
    samples: [],
    pageErrors: [],
    limitations: [
      "No physical listening or calibrated SPL",
      "Process CPU is whole-case cost, not DSP callback CPU",
      "A single ABBA sequence does not estimate cross-run reliability",
    ],
  };
  let preview,
    browser,
    page,
    browserCDP,
    pendingTerminal = null;
  const previewCapture = createBoundedCapture({
    maxEntries: 1024,
    maxBytes: 1024 * 1024,
    maxEntryBytes: 16384,
  });
  async function processInfo() {
    try {
      return (await browserCDP.send("SystemInfo.getProcessInfo")).processInfo;
    } catch (error) {
      report.processInfoUnavailable = serializeErrorRecord(error);
      return null;
    }
  }
  async function observedCase(caseId, mode, tag) {
    await page.selectOption("#case", caseId);
    await page.selectOption("#probe-mode", mode);
    await page.selectOption("#audio-model", audioModel);
    let resolveTerminal, timer;
    const terminal = new Promise((resolve, reject) => {
      resolveTerminal = resolve;
      timer = setTimeout(() => reject(new Error("CONTROLLED_CASE_TERMINAL_TIMEOUT")), 16000);
    });
    terminal.catch(() => {});
    pendingTerminal = (data) => resolveTerminal(data);
    const cpuBefore = await processInfo(),
      wallStarted = performance.now();
    let data;
    try {
      await page.click("#start");
      data = await terminal;
    } finally {
      clearTimeout(timer);
      pendingTerminal = null;
    }
    const wallFinished = performance.now(),
      cpuAfter = await processInfo();
    const sample = {
      tag,
      caseId,
      probeMode: mode,
      audioModel,
      wholeCaseWallMs: wallFinished - wallStarted,
      cpu: cpuDifference(cpuBefore, cpuAfter),
      data,
      observations: controlObservations(data),
      controlVerification: verifyControlledAudioCase(data),
    };
    if (data.caseId !== caseId || data.probeMode !== mode || data.audioModel !== audioModel)
      throw new Error("CONTROLLED_CASE_IDENTITY_MISMATCH");
    await writeFile(
      path.join(directory, `${tag}.case.json`),
      JSON.stringify(sample, null, 2) + "\n",
      { flag: "wx" },
    );
    if (data.rawPcm) {
      const waiting = page.waitForEvent("download", { timeout: 5000 });
      waiting.catch(() => {});
      await page.click("#download-pcm");
      const download = await waiting;
      const filename = `${tag}.float32le.pcm`,
        file = path.join(directory, filename);
      await download.saveAs(file);
      const failure = await download.failure();
      if (failure) throw new Error(`RAW_PCM_DOWNLOAD_FAILED:${failure}`);
      const bytes = await readFile(file);
      sample.rawPcm = {
        path: filename,
        sha256: sha(bytes),
        bytes: bytes.length,
        declaredBytes: data.rawPcm.bytes,
        format: data.rawPcm.format,
      };
      if (bytes.length !== data.rawPcm.bytes) throw new Error("RAW_PCM_DOWNLOAD_LENGTH_MISMATCH");
    } else sample.rawPcm = null;
    if (data.wav) {
      const waiting = page.waitForEvent("download", { timeout: 5000 });
      waiting.catch(() => {});
      await page.click("#download");
      const download = await waiting;
      const filename = `${tag}.wav`,
        file = path.join(directory, filename);
      await download.saveAs(file);
      const failure = await download.failure();
      if (failure) throw new Error(`PCM_DOWNLOAD_FAILED:${failure}`);
      const bytes = await readFile(file);
      sample.wav = {
        path: filename,
        sha256: sha(bytes),
        bytes: bytes.length,
        suggestedFilename: download.suggestedFilename(),
      };
      sample.originalPcmBitsPreserved =
        sample.rawPcm !== null &&
        bytes.length >= 56 &&
        bytes.subarray(56).equals(await readFile(path.join(directory, sample.rawPcm.path)));
      if (!sample.originalPcmBitsPreserved)
        throw new Error("WAV_CHANGED_OR_PADDED_ORIGINAL_PCM_BITS");
      sample.pcm = analyzeCapturedPcmWave(bytes, data);
      await writeFile(
        path.join(directory, `${tag}.pcm.json`),
        JSON.stringify(sample.pcm, null, 2) + "\n",
        { flag: "wx" },
      );
    } else sample.pcm = null;
    sample.signalChecks = expectedSignalChecks(data, sample.pcm);
    await writeFile(
      path.join(directory, `${tag}.receipt.json`),
      JSON.stringify(sample, null, 2) + "\n",
      { flag: "wx" },
    );
    process.stdout.write(
      JSON.stringify({ tag, caseId, mode, status: data.status, pcm: sample.pcm?.status ?? null }) +
        "\n",
    );
    return sample;
  }
  try {
    // Vite clears only this exact owned output directory. Reject junctions before it can delete.
    const canonicalRoot = await realpath(root);
    for (const relative of ["test-results", DIST]) {
      const target = path.resolve(root, relative);
      const lexical = path.relative(root, target);
      if (path.isAbsolute(lexical) || lexical.startsWith(".."))
        throw new Error("CONTROLLED_BUILD_OUTPUT_OUTSIDE_WORKSPACE");
      try {
        const entry = await lstat(target);
        if (!entry.isDirectory() || entry.isSymbolicLink())
          throw new Error("CONTROLLED_BUILD_OUTPUT_LINK_OR_NON_DIRECTORY");
        const resolved = await realpath(target),
          inside = path.relative(canonicalRoot, resolved);
        if (path.isAbsolute(inside) || inside.startsWith(".."))
          throw new Error("CONTROLLED_BUILD_OUTPUT_RESOLVES_OUTSIDE_WORKSPACE");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    report.resolvedOwnedBuildOutput = path.resolve(root, DIST);
    const build = spawnSync(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "build", "--config", CONFIG],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        timeout: 30000,
      },
    );
    await writeFile(path.join(directory, "build.stdout.txt"), build.stdout ?? "", { flag: "wx" });
    await writeFile(path.join(directory, "build.stderr.txt"), build.stderr ?? "", { flag: "wx" });
    report.build = {
      exitCode: build.status,
      error: build.error ? serializeErrorRecord(build.error) : null,
    };
    const afterBuild = await snapshot(files);
    report.sourceStableDuringBuild = JSON.stringify(before) === JSON.stringify(afterBuild);
    if (build.status !== 0 || !report.sourceStableDuringBuild)
      throw new Error("CONTROLLED_BUILD_FAILED_OR_SOURCE_CHANGED");
    report.bundle = await snapshot(await walk(DIST));
    await cp(path.join(root, DIST), path.join(directory, "bundle"), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    preview = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "preview", "--config", CONFIG],
      { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let previewSpawnError = null;
    preview.once("error", (error) => {
      previewSpawnError = error;
    });
    preview.stdout.on("data", (chunk) => previewCapture.add(String(chunk)));
    preview.stderr.on("data", (chunk) => previewCapture.add(String(chunk)));
    const url = "http://127.0.0.1:5197/tests/browser/performance-audio-attribution-v1.html",
      startupDeadline = Date.now() + 10000;
    while (true) {
      if (previewSpawnError) throw previewSpawnError;
      if (preview.exitCode !== null) throw new Error("CONTROLLED_OWNED_PREVIEW_EXITED");
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (
          response.ok &&
          previewCapture.snapshot().entries.join("").includes("http://127.0.0.1:5197/")
        )
          break;
      } catch {
        /* bounded owned startup */
      }
      if (Date.now() >= startupDeadline) throw new Error("CONTROLLED_PREVIEW_TIMEOUT");
      await sleep(100);
    }
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--mute-audio"],
      timeout: 10000,
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      acceptDownloads: true,
    });
    page = await context.newPage();
    browserCDP = await browser.newBrowserCDPSession();
    report.host = {
      node: process.version,
      nodeExecutable: process.execPath,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model ?? null,
      logicalCpus: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      osRelease: os.release(),
      browserVersion: browser.version(),
      browserVersionReceipt: await browserCDP.send("Browser.getVersion"),
      executablePath,
      executableSha256: exeBefore,
      requestedFlags: ["--mute-audio"],
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    };
    try {
      report.host.systemInfo = await browserCDP.send("SystemInfo.getInfo");
    } catch (error) {
      report.host.systemInfo = { unavailable: serializeErrorRecord(error) };
    }
    await page.exposeBinding("__audioAttributionTerminal", (_source, data) => {
      if (pendingTerminal) pendingTerminal(data);
      else report.unexpectedTerminal = true;
    });
    page.on("pageerror", (error) => {
      if (report.pageErrors.length < 128) report.pageErrors.push(serializeErrorRecord(error));
      else report.pageErrorOverflow = true;
    });
    await page.goto(url, { timeout: 10000 });
    await page.waitForFunction(() => window.__audioAttributionReady === true, null, {
      timeout: 10000,
    });
    const warmup = await observedCase("steady", "off", "warmup-steady-off");
    report.warmup = { path: "warmup-steady-off.receipt.json", status: warmup.data.status };
    if (warmup.data.status !== "PROBE_OFF_COMPLETED" || !warmup.controlVerification.qualified)
      throw new Error("CONTROLLED_CAPABILITY_PREPARATION_FAILED");
    for (const caseId of report.cases)
      for (let index = 0; index < report.repetitions.length; index++) {
        const mode = report.repetitions[index],
          tag = `${caseId}-${index + 1}-${mode}`;
        report.samples.push(await observedCase(caseId, mode, tag));
      }
    report.incrementalProbeOverhead = summarizeControlledAudioOverhead(report.samples);
    const negative = report.samples.some(
      (sample) =>
        !sample.controlVerification.qualified ||
        !["CAPTURED_DIGITAL_ONLY", "PROBE_OFF_COMPLETED"].includes(sample.data.status) ||
        (sample.probeMode === "on" &&
          (!sample.pcm?.qualified ||
            sample.signalChecks.digitalContinuity === false ||
            sample.signalChecks.injectedGapVerified === false)),
    );
    report.status = negative
      ? "COLLECTED_WITH_NEGATIVE_RESULTS"
      : "COLLECTED_DIGITAL_COMPONENT_EVIDENCE";
  } catch (error) {
    report.status = "FAILED_COLLECTION";
    report.error = serializeErrorRecord(error);
  } finally {
    pendingTerminal = null;
    const cleanup = await cleanupOwnedResources({
      operationMs: 5000,
      budgetMs: 10000,
      resources: [
        { label: "owned-browser", close: () => browser?.close() },
        { label: "owned-preview", close: () => (preview ? stopOwnedProcess(preview) : undefined) },
      ],
    });
    report.cleanup = {
      errors: cleanup.errors.map((error) => serializeErrorRecord(error)),
      browserConnected: browser?.isConnected() ?? null,
      previewStopped: preview ? preview.exitCode !== null || preview.signalCode !== null : null,
      previewExitCode: preview?.exitCode ?? null,
      previewSignalCode: preview?.signalCode ?? null,
    };
    report.preview = previewCapture.snapshot();
    await writeFile(path.join(directory, "preview.log.txt"), report.preview.entries.join(""), {
      flag: "wx",
    });
    try {
      report.sourceAfter = await snapshot(files);
      report.sourceStableDuringRun = JSON.stringify(before) === JSON.stringify(report.sourceAfter);
    } catch (error) {
      report.sourceStableDuringRun = null;
      report.sourceEndpointError = serializeErrorRecord(error);
    }
    try {
      report.bundleAfter = report.bundle
        ? await snapshot(report.bundle.map((row) => row.path))
        : null;
      report.bundleStableDuringRun = report.bundle
        ? JSON.stringify(report.bundle) === JSON.stringify(report.bundleAfter)
        : null;
    } catch (error) {
      report.bundleStableDuringRun = null;
      report.bundleEndpointError = serializeErrorRecord(error);
    }
    try {
      report.executableSha256After = sha(await readFile(executablePath));
      report.executableStable = exeBefore === report.executableSha256After;
    } catch (error) {
      report.executableStable = null;
      report.executableEndpointError = serializeErrorRecord(error);
    }
    if (
      cleanup.errors.length ||
      report.preview.invalidated ||
      report.pageErrors.length ||
      report.pageErrorOverflow ||
      report.unexpectedTerminal ||
      report.sourceStableDuringRun !== true ||
      report.executableStable !== true ||
      report.bundleStableDuringRun !== true
    )
      report.status = "UNVERIFIED_COLLECTION";
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
    formal600Run: false,
    formalQualification: "NOT_APPROVED",
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    options = {};
  let smoke = false;
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--smoke") {
      if (smoke) throw new Error("DUPLICATE_OPTION");
      smoke = true;
      continue;
    }
    const value = args[++index];
    if (
      !["--executable-path", "--output", "--audio-model"].includes(key) ||
      !value ||
      value.startsWith("--") ||
      options[key]
    )
      throw new Error("INVALID_CONTROLLED_AUDIO_CLI");
    options[key] = value;
  }
  const result = await runAudioAttribution({
    executablePath: options["--executable-path"],
    output: options["--output"],
    audioModel: options["--audio-model"] ?? "nativeReference",
    smoke,
  });
  process.stdout.write(JSON.stringify(result) + "\n");
  if (
    !["COLLECTED_DIGITAL_COMPONENT_EVIDENCE", "COLLECTED_WITH_NEGATIVE_RESULTS"].includes(
      result.status,
    )
  )
    process.exitCode = 1;
}
