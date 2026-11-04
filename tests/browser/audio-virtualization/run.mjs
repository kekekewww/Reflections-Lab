import { encodeNativePcmArtifact } from "./pcm-artifacts.mjs";
import { readNativePartialOnce } from "./partial-results.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const out = path.resolve(
  process.argv[2] || path.join(root, ".cache/audio-virtualization/summary.json"),
);
const cleanupOut = out.replace(/\.json$/i, "") + ".cleanup.json";
const outputDirectory = path.dirname(out);
const SOFT_DEADLINE_MS = 80000;
const CLEANUP_BUDGET_MS = 9000;
const HARD_DEADLINE_MS = 90000;
const started = performance.now();
const startedAt = new Date().toISOString();
const execFileAsync = promisify(execFile);
const sources = [
  "src/audio/engine.ts",
  "src/audio/live-monitor.ts",
  "src/acoustics/limits.ts",
  "src/acoustics/types.ts",
  "schemas/sound-behavior/types.ts",
  "src/audio/routes.ts",
  "src/audio/control.ts",
  "src/audio/native-source-cursor.ts",
  "src/audio/content-model.ts",
  "src/audio/assets.ts",
  "src/audio/asset-leases.ts",
  "src/audio/types.ts",
  "src/audio/route-response.ts",
  "src/audio/diagnostics.ts",
  "src/audio/band-filter.ts",
  "src/audio/late-reverb.ts",
  "src/audio/buffer-preset.ts",
  "src/audio/monitor-level.ts",
  "src/audio/output-safety.ts",
  "src/audio/wav.ts",
  "src/audio/virtual-timeline.ts",
  "src/audio/virtual-policy.ts",
  "tests/browser/audio-virtualization/pcm-artifacts.mjs",
  "tests/browser/audio-virtualization/partial-results.mjs",
  "tests/browser/audio-virtualization/partial-results.d.mts",
  "tests/browser/audio-virtualization/fixture.ts",
  "tests/browser/audio-virtualization/fixture.html",
  "tests/browser/audio-virtualization/live-lifecycle.ts",
  "tests/browser/audio-virtualization/run.mjs",
  "tests/browser/audio-virtualization/analyze-pcm.mjs",
  "package.json",
  "package-lock.json",
  ".node-version",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
];
let browser;
let server;
let ownedPage;
let pcmReceiptsClosed = false;
const pcmClaims = new Map();
const pendingPcmWrites = new Set();
const pendingAtomicWrites = new Set();
let browserCreation;
let serverCreation;
let aborted = false;
let workFinished = false;
let attemptSettled = false;
let snapshotSequence = 0;
const state = {
  status: "FAIL",
  validationModel: "retainedNativeCarrierAndRouteVirtualization",
  recordedAt: startedAt,
  node: process.version,
  command: "node tests/browser/audio-virtualization/run.mjs <summary.json>",
  deadlines: {
    softWorkMs: SOFT_DEADLINE_MS,
    cleanupMs: CLEANUP_BUDGET_MS,
    hardOwnNodeMs: HARD_DEADLINE_MS,
    hardDeadlineTriggered: false,
  },
  stage: "initializing",
  sourceStable: false,
  files: [],
  filesAfter: [],
  sourceChanges: [],
  results: [],
  pcmFiles: [],
  corePcmFiles: [],
  expandedPausePcmFiles: [],
  groups: {
    corePhasePcm: { status: "NOT_RUN", expectedCases: 5, expectedPcmFiles: 10 },
    expandedPausePcm: { status: "NOT_RUN", expectedCases: 5, expectedPcmFiles: 10 },
  },
  liveLifecycle: { status: "NOT_RUN" },
  partialRecoveryAttempted: false,
  pageErrors: [],
  errors: [],
  tolerance: { maxAbsolute: 2e-6, relativeRms: 2e-6 },
  cleanup: {
    status: "NOT_STARTED",
    complete: false,
    browser: { status: "NOT_STARTED" },
    server: { status: "NOT_STARTED" },
    sourceSnapshot: { status: "NOT_STARTED" },
    partial: { status: "NOT_STARTED", readAttempts: 0 },
    pendingWrites: { status: "NOT_STARTED" },
  },
};

function errorRecord(error, stage) {
  return {
    stage,
    error: String(error),
    stack: error instanceof Error ? error.stack : null,
    elapsedMs: performance.now() - started,
  };
}
function fail(message, stage = state.stage) {
  state.errors.push(errorRecord(new Error(message), stage));
}
function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function remainingWorkMs() {
  return Math.max(0, SOFT_DEADLINE_MS - (performance.now() - started));
}
function checkpoint() {
  if (aborted || remainingWorkMs() <= 0) throw new Error("NATIVE03_SOFT_DEADLINE");
}
async function withDeadline(action, milliseconds, label) {
  if (!(milliseconds > 0)) throw new Error(label);
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
async function atomicWrite(destination, bytes, guard = () => true) {
  const writing = (async () => {
    const temporary = destination + `.tmp-${process.pid}-${++snapshotSequence}`;
    await writeFile(temporary, bytes);
    if (!guard()) {
      await unlink(temporary).catch(() => undefined);
      return false;
    }
    await rename(temporary, destination);
    return true;
  })();
  pendingAtomicWrites.add(writing);
  try {
    return await writing;
  } finally {
    pendingAtomicWrites.delete(writing);
  }
}

async function saveSnapshot(guard = () => true) {
  const text = JSON.stringify(state, null, 2) + "\n";
  await atomicWrite(out, text, guard);
}
function syncEmergencyWrite(destination, value) {
  const temporary = destination + `.hard-${process.pid}`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n");
  renameSync(temporary, destination);
}

// This timer terminates only this harness process. It never enumerates or kills
// any external process, browser belonging to another attempt, or other Node job.
const hardTimer = setTimeout(() => {
  aborted = true;
  state.status = "FAIL";
  state.deadlines.hardDeadlineTriggered = true;
  state.stage = "own-node-hard-deadline";
  fail("NATIVE03_HARD_DEADLINE_OWN_NODE");
  state.cleanup.complete = false;
  state.cleanup.status = "HARD_DEADLINE";
  state.elapsedMs = performance.now() - started;
  try {
    mkdirSync(outputDirectory, { recursive: true });
    syncEmergencyWrite(out, state);
    syncEmergencyWrite(cleanupOut, {
      status: "FAIL",
      hardDeadlineTriggered: true,
      elapsedMs: state.elapsedMs,
      cleanup: state.cleanup,
      errors: state.errors,
    });
  } catch (error) {
    process.stderr.write(
      JSON.stringify({ status: "FAIL", emergencyReceiptError: String(error) }) + "\n",
    );
  }
  process.stderr.write(
    JSON.stringify({ status: "FAIL", reason: "NATIVE03_HARD_DEADLINE_OWN_NODE", output: out }) +
      "\n",
  );
  process.exit(1);
}, HARD_DEADLINE_MS);

async function sourceSnapshot() {
  return Promise.all(
    sources.map(async (relative) => {
      try {
        const bytes = await readFile(path.join(root, relative));
        return { path: relative, bytes: bytes.length, sha256: hash(bytes) };
      } catch (error) {
        return { path: relative, error: String(error) };
      }
    }),
  );
}
async function gitSnapshot() {
  const options = {
    cwd: root,
    timeout: Math.max(1, Math.min(5000, remainingWorkMs())),
    maxBuffer: 16 * 1024 * 1024,
  };
  const [head, status, diff] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { ...options, encoding: "utf8" }),
    execFileAsync("git", ["status", "--short"], { ...options, encoding: "utf8" }),
    execFileAsync("git", ["diff", "--binary"], { ...options, encoding: "buffer" }),
  ]);
  return { head: head.stdout.trim(), status: status.stdout, dirtyDiffSha256: hash(diff.stdout) };
}
function validQuantum(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function validateGroups(fixture) {
  for (const name of ["corePhasePcm", "expandedPausePcm"]) {
    const entries = state.results.filter((entry) => entry.group === name);
    const pcm = state.pcmFiles.filter((entry) => entry.group === name && entry.status === "SAVED");
    const valid =
      entries.length === 5 &&
      pcm.length === 10 &&
      entries.every(
        (entry) =>
          entry.pass === true &&
          entry.maxError < 2e-6 &&
          entry.relativeRmsError < 2e-6 &&
          entry.ignoredPostPromotionFrames === 0 &&
          entry.referenceActualSampleRate === fixture.sampleRate &&
          entry.candidateActualSampleRate === fixture.sampleRate &&
          validQuantum(entry.referenceActualQuantumFrames) &&
          validQuantum(entry.actualQuantumFrames) &&
          entry.referenceActualQuantumFrames === entry.actualQuantumFrames,
      );
    state.groups[name] = {
      status: valid ? "PASS" : "FAIL",
      expectedCases: 5,
      actualCases: entries.length,
      expectedPcmFiles: 10,
      savedPcmFiles: pcm.length,
      cases: entries.map((entry) => entry.id),
    };
    if (!valid) fail(`NATIVE03_GROUP_${name}_FAILED`, "offline-group-validation");
  }
  if (
    fixture.status !== "PASS" ||
    fixture.coreStatus !== "PASS" ||
    fixture.expandedPauseStatus !== "PASS"
  )
    fail("NATIVE03_FIXTURE_GROUP_STATUS_FAILED", "offline-group-validation");
  if (
    state.results.length !== 10 ||
    state.pcmFiles.filter((entry) => entry.status === "SAVED").length !== 20
  )
    fail("NATIVE03_EXPECTED_TEN_CASES_TWENTY_PCM_FILES", "offline-group-validation");
}
async function persistPcm(fixture, options = {}) {
  const check = options.check ?? checkpoint;
  const writeGuard = options.guard ?? (() => !aborted);
  check();
  if (
    fixture.sampleRate !== 48000 ||
    fixture.frames !== 96000 ||
    !Array.isArray(fixture.results) ||
    fixture.results.length > 20
  )
    throw new Error("NATIVE03_PCM_DIMENSIONS_OR_RESULTS_INVALID");
  state.sampleRate = fixture.sampleRate;
  state.frames = fixture.frames;
  state.offlineStatus = fixture.status;
  state.coreStatus = fixture.coreStatus ?? "FAIL";
  state.expandedPauseStatus = fixture.expandedPauseStatus ?? "FAIL";
  const existingResults = new Map(state.results.map((entry) => [entry.id, entry]));
  for (const entry of fixture.results) {
    const copy = { ...entry };
    delete copy.referencePcm;
    delete copy.candidatePcm;
    if (!existingResults.has(copy.id)) existingResults.set(copy.id, copy);
  }
  state.results = [...existingResults.values()];
  const identities = new Set();
  for (const entry of fixture.results) {
    check();
    if (
      typeof entry.id !== "string" ||
      !/^[a-z0-9-]{1,120}$/.test(entry.id) ||
      identities.has(entry.id)
    ) {
      fail("NATIVE03_PCM_CASE_ID_INVALID_OR_DUPLICATE", "offline-pcm");
      continue;
    }
    identities.add(entry.id);
    for (const kind of ["reference", "candidate"]) {
      check();
      const key = `${entry.id}:${kind}`;
      // One writer claim per artifact for this attempt. SAVED, interrupted and
      // pending claims are never overwritten or raced by cleanup recovery.
      if (pcmClaims.has(key)) continue;
      if (pcmClaims.size >= 20) throw new Error("NATIVE03_PCM_ARTIFACT_CAP");
      const receipt = { id: entry.id, group: entry.group, kind, status: "PENDING" };
      pcmClaims.set(key, receipt);
      state.pcmFiles.push(receipt);
      const writing = (async () => {
        try {
          check();
          const { bytes, frames } = encodeNativePcmArtifact(entry[`${kind}Pcm`], fixture.frames);
          if (frames !== 96000 || bytes.byteLength !== 96000 * 4)
            throw new Error("NATIVE03_STRICT_PCM_FRAME_OR_BYTE_COUNT");
          const pcmPath = path.join(outputDirectory, `${entry.id}-${kind}.f32`);
          Object.assign(receipt, {
            path: pcmPath,
            frames,
            channels: 1,
            bytes: bytes.byteLength,
            sampleRate:
              kind === "reference"
                ? entry.referenceActualSampleRate
                : entry.candidateActualSampleRate,
            actualQuantumFrames:
              kind === "reference" ? entry.referenceActualQuantumFrames : entry.actualQuantumFrames,
            sha256: hash(bytes),
          });
          const writtenAtomically = await atomicWrite(pcmPath, bytes, writeGuard);
          if (!writtenAtomically) throw new Error("NATIVE03_PCM_WRITE_INTERRUPTED");
          check();
          const written = await readFile(pcmPath);
          check();
          if (written.byteLength !== bytes.byteLength || hash(written) !== receipt.sha256)
            throw new Error("NATIVE03_WRITTEN_PCM_HASH_OR_BYTE_COUNT_MISMATCH");
          if (!pcmReceiptsClosed && writeGuard()) receipt.status = "SAVED";
        } catch (error) {
          if (pcmReceiptsClosed) return;
          receipt.status = writeGuard() ? "FAIL" : "INTERRUPTED";
          receipt.error = String(error);
          state.errors.push(errorRecord(error, `offline-pcm:${entry.id}:${kind}`));
        }
      })();
      pendingPcmWrites.add(writing);
      try {
        await writing;
      } finally {
        pendingPcmWrites.delete(writing);
      }
    }
    check();
    if (!options.partial) await saveSnapshot(writeGuard);
  }
  state.corePcmFiles = state.pcmFiles.filter((entry) => entry.group === "corePhasePcm");
  state.expandedPausePcmFiles = state.pcmFiles.filter(
    (entry) => entry.group === "expandedPausePcm",
  );
  validateGroups(fixture);
}

async function runAttempt() {
  await mkdir(outputDirectory, { recursive: true });
  checkpoint();
  state.stage = "source-before";
  state.files = await sourceSnapshot();
  if (state.files.some((entry) => entry.error))
    throw new Error("NATIVE03_SOURCE_BEFORE_INCOMPLETE");
  checkpoint();
  state.git = await gitSnapshot();
  checkpoint();
  state.stage = "server-start";
  serverCreation = createServer({
    root,
    logLevel: "warn",
    cacheDir: path.join(root, ".cache/vite-audio-virtualization"),
    server: { host: "127.0.0.1", port: 5228, strictPort: true },
  });
  server = await serverCreation;
  checkpoint();
  await server.listen();
  checkpoint();
  state.stage = "browser-start";
  browserCreation = chromium.launch({ headless: true, timeout: Math.max(1, remainingWorkMs()) });
  browser = await browserCreation;
  checkpoint();
  state.browser = browser.version();
  const session = await browser.newBrowserCDPSession();
  try {
    state.browserVersion = await session.send("Browser.getVersion");
  } finally {
    await session.detach();
  }
  checkpoint();
  const page = await browser.newPage();
  ownedPage = page;
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  state.stage = "offline-native-groups";
  await page.goto("http://127.0.0.1:5228/tests/browser/audio-virtualization/fixture.html", {
    timeout: Math.max(1, remainingWorkMs()),
  });
  checkpoint();
  const fixture = await page.evaluate(() => window.__audioVirtualization);
  checkpoint();
  if (!fixture || typeof fixture !== "object") throw new Error("NATIVE03_FIXTURE_RESULT_MISSING");
  if (fixture.error) fail(fixture.error, "offline-native-groups");
  await persistPcm(fixture);
  checkpoint();
  state.stage = "trusted-live-lifecycle-click";
  await page.locator("#run-live-lifecycle").click({ timeout: Math.max(1, remainingWorkMs()) });
  checkpoint();
  await page.waitForFunction(() => Boolean(window.__audioLiveLifecycle), null, {
    timeout: Math.max(1, remainingWorkMs()),
  });
  checkpoint();
  state.stage = "live-lifecycle";
  const live = await page.evaluate(() => window.__audioLiveLifecycle);
  state.liveLifecycle = live ?? { status: "FAIL", error: "NATIVE03_LIVE_RESULT_MISSING" };
  if (
    live?.status !== "PASS" ||
    !Number.isFinite(live?.actualSampleRate) ||
    live.actualSampleRate <= 0 ||
    !validQuantum(live?.actualQuantumFrames)
  )
    fail("NATIVE03_LIVE_LIFECYCLE_FAILED_OR_CLOCK_MISSING", "live-lifecycle");
  checkpoint();
  workFinished = true;
  state.stage = "work-complete";
  await saveSnapshot(() => !aborted);
}

const work = withDeadline(
  () =>
    runAttempt().finally(() => {
      attemptSettled = true;
    }),
  remainingWorkMs(),
  "NATIVE03_OVERALL_SOFT_DEADLINE",
);
try {
  await work;
} catch (error) {
  state.errors.push(errorRecord(error, state.stage));
} finally {
  aborted = true;
  const cleanupStarted = performance.now();
  const cleanupDeadline = Math.min(
    started + HARD_DEADLINE_MS - 500,
    cleanupStarted + CLEANUP_BUDGET_MS,
  );
  state.stage = "cleanup";
  state.cleanup.startedAt = new Date().toISOString();
  state.cleanup.budgetMs = Math.max(0, cleanupDeadline - cleanupStarted);
  state.cleanup.status = "RUNNING";
  async function clean(name, action) {
    const receipt = state.cleanup[name];
    receipt.status = "PENDING";
    const begin = performance.now();
    try {
      const status = await withDeadline(
        action,
        Math.max(0, cleanupDeadline - performance.now()),
        `NATIVE03_${name.toUpperCase()}_CLEANUP_DEADLINE`,
      );
      receipt.status = status ?? "CLOSED";
    } catch (error) {
      receipt.status = String(error).includes("DEADLINE") ? "TIMEOUT" : "FAIL";
      receipt.error = String(error);
      state.errors.push(errorRecord(error, `cleanup:${name}`));
    } finally {
      receipt.elapsedMs = performance.now() - begin;
    }
  }
  const incompletePcm =
    state.results.length !== 10 ||
    state.pcmFiles.filter((entry) => entry.status === "SAVED").length !== 20;
  if (incompletePcm && ownedPage) {
    state.partialRecoveryAttempted = true;
    state.cleanup.partial.status = "RUNNING";
    // Recovery shares the original nine-second budget. Reserve at least half
    // of its remaining time (up to three seconds) for owned browser/server close.
    const remaining = Math.max(0, cleanupDeadline - performance.now());
    const recoveryDeadline = cleanupDeadline - Math.min(3000, remaining / 2);
    let recoveryOpen = true;
    const guard = () => recoveryOpen && !pcmReceiptsClosed && performance.now() < recoveryDeadline;
    const recovery = async () => {
      const partial = await readNativePartialOnce(
        () => {
          if (!guard()) throw new Error("NATIVE03_PARTIAL_BUDGET_EXHAUSTED");
          state.cleanup.partial.readAttempts++;
          // Read the plain readonly snapshot, never the original rendering promise.
          return ownedPage.evaluate(() => window.__audioVirtualizationPartial ?? null);
        },
        Math.max(0, recoveryDeadline - performance.now()),
      );
      if (!guard()) return;
      state.cleanup.partial.status =
        partial.partialState === "AVAILABLE" ? "PARTIAL_AVAILABLE" : "PARTIAL_UNAVAILABLE";
      state.cleanup.partial.error = partial.error;
      if (!partial.snapshot) return;
      const snapshot = partial.snapshot;
      state.cleanup.partial.snapshot = {
        schemaVersion: snapshot.schemaVersion,
        status: snapshot.status,
        sampleRate: snapshot.sampleRate,
        frames: snapshot.frames,
        completedResults: snapshot.results.length,
        ids: snapshot.results.map((entry) => entry.id),
        error: snapshot.error,
      };
      // A timed-out normal persist may still own a temporary write. Wait only
      // inside this same recovery budget, then fill unclaimed artifacts once.
      if (pendingPcmWrites.size || pendingAtomicWrites.size)
        await Promise.allSettled([...pendingPcmWrites, ...pendingAtomicWrites]);
      if (!guard()) return;
      const check = () => {
        if (!guard()) throw new Error("NATIVE03_PARTIAL_PERSIST_DEADLINE");
      };
      await persistPcm(
        { ...snapshot, status: "FAIL", coreStatus: "FAIL", expandedPauseStatus: "FAIL" },
        { check, guard, partial: true },
      );
      if (guard())
        state.cleanup.partial.savedPcmFiles = state.pcmFiles.filter(
          (entry) => entry.status === "SAVED",
        ).length;
    };
    try {
      await withDeadline(
        recovery,
        Math.max(0, recoveryDeadline - performance.now()),
        "NATIVE03_PARTIAL_RECOVERY_DEADLINE",
      );
    } catch (error) {
      state.cleanup.partial.status = String(error).includes("DEADLINE")
        ? "PARTIAL_TIMEOUT"
        : "PARTIAL_UNAVAILABLE";
      state.cleanup.partial.error = String(error);
      state.errors.push(errorRecord(error, "cleanup:partial"));
    } finally {
      recoveryOpen = false;
    }
  } else
    state.cleanup.partial.status = incompletePcm
      ? "PARTIAL_UNAVAILABLE_NO_OWNED_PAGE"
      : "NOT_NEEDED_COMPLETE_PCM";
  await Promise.all([
    clean("browser", async () => {
      let owned = browser;
      if (!owned && browserCreation) {
        try {
          owned = await browserCreation;
        } catch {
          return "NOT_CREATED_LAUNCH_FAILED";
        }
      }
      if (!owned) return "NOT_CREATED";
      await owned.close();
      return "CLOSED";
    }),
    clean("server", async () => {
      let owned = server;
      if (!owned && serverCreation) {
        try {
          owned = await serverCreation;
        } catch {
          return "NOT_CREATED_START_FAILED";
        }
      }
      if (!owned) return "NOT_CREATED";
      await owned.close();
      return "CLOSED";
    }),
    clean("pendingWrites", async () => {
      if (pendingPcmWrites.size || pendingAtomicWrites.size)
        await Promise.allSettled([...pendingPcmWrites, ...pendingAtomicWrites]);
      return pendingPcmWrites.size === 0 && pendingAtomicWrites.size === 0 ? "SETTLED" : "PENDING";
    }),
    clean("sourceSnapshot", async () => {
      const filesAfter = await sourceSnapshot();
      if (pcmReceiptsClosed || performance.now() >= cleanupDeadline)
        throw new Error("NATIVE03_SOURCE_SNAPSHOT_LATE_RESULT_DISCARDED");
      state.filesAfter = filesAfter;
      state.sourceChanges = state.filesAfter.filter(
        (entry, index) =>
          entry.error ||
          state.files[index]?.sha256 !== entry.sha256 ||
          state.files[index]?.bytes !== entry.bytes,
      );
      state.sourceStable =
        state.files.length === sources.length &&
        state.files.every((entry) => !entry.error) &&
        state.filesAfter.length === sources.length &&
        state.sourceChanges.length === 0;
      if (!state.sourceStable)
        fail("NATIVE03_SOURCE_CHANGED_OR_AFTER_SNAPSHOT_INCOMPLETE", "source-after");
      return state.sourceStable ? "VERIFIED" : "MISMATCH";
    }),
  ]);
  state.cleanup.elapsedMs = performance.now() - cleanupStarted;
  state.cleanup.complete =
    [state.cleanup.browser.status, state.cleanup.server.status].every((status) =>
      ["CLOSED", "NOT_CREATED", "NOT_CREATED_LAUNCH_FAILED", "NOT_CREATED_START_FAILED"].includes(
        status,
      ),
    ) &&
    ["VERIFIED", "MISMATCH"].includes(state.cleanup.sourceSnapshot.status) &&
    state.cleanup.pendingWrites.status === "SETTLED";
  state.cleanup.status = state.cleanup.complete ? "COMPLETE" : "INCOMPLETE";
  if (!state.cleanup.complete) fail("NATIVE03_CLEANUP_INCOMPLETE", "cleanup");
  if (state.pageErrors.length) fail("NATIVE03_BROWSER_PAGE_ERRORS", "final-validation");
  state.status =
    workFinished &&
    !state.partialRecoveryAttempted &&
    state.errors.length === 0 &&
    state.sourceStable &&
    state.groups.corePhasePcm.status === "PASS" &&
    state.groups.expandedPausePcm.status === "PASS" &&
    state.liveLifecycle.status === "PASS" &&
    state.cleanup.complete
      ? "PASS"
      : "FAIL";
  state.corePcmFiles = state.pcmFiles.filter((entry) => entry.group === "corePhasePcm");
  state.expandedPausePcmFiles = state.pcmFiles.filter(
    (entry) => entry.group === "expandedPausePcm",
  );
  for (const receipt of pcmClaims.values())
    if (receipt.status === "PENDING") receipt.status = "INTERRUPTED_CLEANUP_DEADLINE";
  pcmReceiptsClosed = true;
  state.stage = "finished";
  state.elapsedMs = performance.now() - started;
  try {
    await mkdir(outputDirectory, { recursive: true });
    await saveSnapshot();
    await atomicWrite(
      cleanupOut,
      JSON.stringify(
        {
          status: state.status,
          elapsedMs: state.elapsedMs,
          deadlines: state.deadlines,
          cleanup: state.cleanup,
          errors: state.errors,
          summary: out,
        },
        null,
        2,
      ) + "\n",
    );
  } catch (error) {
    state.status = "FAIL";
    process.stderr.write(
      JSON.stringify({ status: "FAIL", finalReceiptError: String(error) }) + "\n",
    );
  }
  process.stdout.write(
    JSON.stringify({
      status: state.status,
      cases: state.results.length,
      corePhasePcm: state.groups.corePhasePcm.status,
      expandedPausePcm: state.groups.expandedPausePcm.status,
      savedPcmFiles: state.pcmFiles.filter((entry) => entry.status === "SAVED").length,
      liveLifecycle: state.liveLifecycle.status,
      cleanup: state.cleanup.status,
      sourceStable: state.sourceStable,
      output: out,
      cleanupReceipt: cleanupOut,
    }) + "\n",
  );
  if (state.status !== "PASS") process.exitCode = 1;
  // Leave the own-node hard deadline armed if cleanup did not establish closure.
  if (state.cleanup.complete && attemptSettled) clearTimeout(hardTimer);
}
