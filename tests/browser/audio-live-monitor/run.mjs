import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.resolve(
  process.argv[2] ?? path.join(root, ".cache/audio-live-monitor", stamp, "summary.json"),
);
const directory = path.dirname(out),
  started = performance.now();
const WORK_MS = 30000,
  CLEANUP_MS = 9000,
  HARD_MS = 40000;
const exec = promisify(execFile),
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) =>
  JSON.stringify(
    value,
    (_, item) => (typeof item === "number" && !Number.isFinite(item) ? String(item) : item),
    2,
  ) + "\n";
const expectedArtifacts = new Map([
  ["loud-product-source-waveform", ["waveform", 1024, 1024]],
  ["loud-independent-source-waveform", ["waveform", 1024, 1024]],
  ["loud-product-waveform", ["waveform", 2048, 2048]],
  ["loud-product-spectrum", ["spectrumDbfs", 1024, 2048]],
  ["loud-independent-left-waveform", ["waveform", 2048, 2048]],
  ["loud-independent-right-waveform", ["waveform", 2048, 2048]],
  ["loud-independent-spectrum", ["spectrumDbfs", 1024, 2048]],
  ["muted-product-waveform", ["waveform", 2048, 2048]],
  ["muted-product-spectrum", ["spectrumDbfs", 1024, 2048]],
]);
const state = {
  status: "FAIL",
  recordedAt: new Date().toISOString(),
  node: process.version,
  command: "node tests/browser/audio-live-monitor/run.mjs <new-summary.json>",
  scope:
    "native digital monitor component only; no CPU, SPL, exact phase, hearing or Computer Use claim",
  nonfiniteJsonEncoding:
    "-Infinity/Infinity/NaN strings; null remains unmeasured; raw f32 files preserve IEEE values",
  deadlines: {
    workMs: WORK_MS,
    cleanupMs: CLEANUP_MS,
    hardOwnNodeMs: HARD_MS,
    hardTriggered: false,
  },
  stage: "initializing",
  files: [],
  filesAfter: [],
  sourceStable: false,
  pageErrors: [],
  errors: [],
  artifacts: [],
  result: null,
  cleanup: { browser: "NOT_STARTED", server: "NOT_STARTED", complete: false },
};
let browser,
  server,
  browserCreation,
  serverCreation,
  aborted = false,
  workSettled = false;
let sequence = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function checkpoint() {
  assert(!aborted && performance.now() - started < WORK_MS, "MONITOR_WORK_DEADLINE");
}
async function bounded(action, milliseconds, label) {
  assert(milliseconds > 0, label);
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
async function atomic(destination, bytes) {
  const temporary = `${destination}.tmp-${process.pid}-${++sequence}`;
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
}
async function sourceSnapshot() {
  const audio = (await readdir(path.join(root, "src/audio")))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `src/audio/${name}`);
  const files = [
    ...audio,
    "src/acoustics/types.ts",
    "schemas/sound-behavior/types.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tests/browser/audio-live-monitor/fixture.ts",
    "tests/browser/audio-live-monitor/fixture.html",
    "tests/browser/audio-live-monitor/run.mjs",
  ].sort();
  return Promise.all(
    files.map(async (name) => {
      const bytes = await readFile(path.join(root, name));
      return { path: name, bytes: bytes.length, sha256: hash(bytes) };
    }),
  );
}
async function gitSnapshot() {
  const options = { cwd: root, timeout: 4000, maxBuffer: 16 * 1024 * 1024 };
  const [head, status, diff] = await Promise.all([
    exec("git", ["rev-parse", "HEAD"], { ...options, encoding: "utf8" }),
    exec("git", ["status", "--short"], { ...options, encoding: "utf8" }),
    exec("git", ["diff", "HEAD", "--binary"], { ...options, encoding: "buffer" }),
  ]);
  return {
    head: head.stdout.trim(),
    status: status.stdout,
    dirtyDiffSha256: hash(diff.stdout),
    sourceFilesPinUncommittedBytes: true,
  };
}
async function saveArtifacts(result) {
  assert(
    Array.isArray(result.artifacts) && result.artifacts.length <= expectedArtifacts.size,
    "INVALID_NATIVE_FLOAT_ARTIFACT_COLLECTION",
  );
  const names = new Set();
  for (const artifact of result.artifacts) {
    checkpoint();
    const expected = expectedArtifacts.get(artifact.name);
    assert(expected && !names.has(artifact.name), "UNKNOWN_OR_DUPLICATE_NATIVE_ARTIFACT");
    names.add(artifact.name);
    assert(
      artifact.domain === expected[0] &&
        artifact.data?.length === expected[1] &&
        artifact.fftSize === expected[2],
      "NATIVE_ARTIFACT_SHAPE_MISMATCH",
    );
    assert(
      artifact.sampleRateHz === result.actualSampleRate && artifact.sampleRateHz > 0,
      "NATIVE_ARTIFACT_SAMPLE_RATE_MISMATCH",
    );
    const valid = (value) =>
      typeof value === "number" &&
      (Number.isFinite(value) || (artifact.domain === "spectrumDbfs" && value === -Infinity));
    assert(artifact.data.every(valid), "INVALID_NATIVE_ARTIFACT_SAMPLE");
    const bytes = Buffer.alloc(artifact.data.length * 4);
    artifact.data.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
    for (let index = 0; index < artifact.data.length; index++)
      assert(valid(bytes.readFloatLE(index * 4)), "FLOAT32_CONVERSION_OVERFLOW");
    const destination = path.join(directory, `${artifact.name}.f32le`);
    await atomic(destination, bytes);
    const reread = await readFile(destination);
    assert(
      reread.length === bytes.length && hash(reread) === hash(bytes),
      "PERSISTED_NATIVE_FLOAT_BYTES_MISMATCH",
    );
    state.artifacts.push({
      name: artifact.name,
      path: destination,
      domain: artifact.domain,
      format: "IEEE754-float32-little-endian",
      valueCount: artifact.data.length,
      frames: artifact.domain === "waveform" ? artifact.data.length : null,
      frequencyBins: artifact.domain === "spectrumDbfs" ? artifact.data.length : null,
      fftSize: artifact.fftSize,
      sampleRateHz: artifact.sampleRateHz,
      bytes: reread.length,
      sha256: hash(reread),
    });
  }
  assert(state.artifacts.length === expectedArtifacts.size, "EXPECTED_NINE_NATIVE_FLOAT_ARTIFACTS");
}

// Refuse an occupied receipt directory marker; no earlier attempt is overwritten.
await mkdir(directory, { recursive: true });
await writeFile(
  path.join(directory, ".audio-live-monitor-owner"),
  json({ pid: process.pid, recordedAt: state.recordedAt }),
  { flag: "wx" },
);
try {
  await readFile(out);
  throw new Error("SUMMARY_ALREADY_EXISTS");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
// This timer exits only this owned Node harness; it never enumerates or kills external jobs.
const hardTimer = setTimeout(
  () => {
    aborted = true;
    state.status = "FAIL";
    state.deadlines.hardTriggered = true;
    state.errors.push("MONITOR_OWN_NODE_HARD_DEADLINE");
    state.stage = "hard-deadline";
    state.elapsedMs = performance.now() - started;
    try {
      mkdirSync(directory, { recursive: true });
      const temporary = `${out}.hard-${process.pid}`;
      writeFileSync(temporary, json(state));
      renameSync(temporary, out);
    } catch (error) {
      process.stderr.write(String(error) + "\n");
    }
    process.stderr.write(
      json({ status: "FAIL", output: out, reason: "MONITOR_OWN_NODE_HARD_DEADLINE" }),
    );
    process.exit(1);
  },
  Math.max(1, HARD_MS - (performance.now() - started)),
);

async function work() {
  state.stage = "source-freeze";
  state.files = await sourceSnapshot();
  state.git = await gitSnapshot();
  checkpoint();
  state.stage = "owned-server";
  serverCreation = createServer({
    root,
    configFile: false,
    cacheDir: path.join(root, ".cache/vite-audio-live-monitor"),
    server: { host: "127.0.0.1", port: 5232, strictPort: true },
  });
  server = await serverCreation;
  await server.listen();
  checkpoint();
  state.stage = "owned-browser";
  browserCreation = chromium.launch({
    headless: true,
    timeout: Math.max(1, WORK_MS - (performance.now() - started)),
  });
  browser = await browserCreation;
  checkpoint();
  const page = await browser.newPage();
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  state.browserVersion = await browser.version();
  const cdp = await page.context().newCDPSession(page);
  try {
    state.cdpVersion = await cdp.send("Browser.getVersion");
  } finally {
    await cdp.detach();
  }
  await page.goto("http://127.0.0.1:5232/tests/browser/audio-live-monitor/fixture.html", {
    waitUntil: "networkidle",
    timeout: 12000,
  });
  checkpoint();
  state.stage = "trusted-click-native-case";
  await page.locator("#run-live-monitor").click({ timeout: 3000 });
  const result = await page.evaluate(async () => await window.__audioLiveMonitor);
  checkpoint();
  assert(result && typeof result === "object", "NATIVE_MONITOR_RESULT_MISSING");
  state.result = { ...result, artifacts: undefined };
  await saveArtifacts(result);
  assert(
    result.passed === true &&
      result.status === "PASS" &&
      result.mainComplete === true &&
      result.cleanupComplete === true,
    "NATIVE_MONITOR_CASE_FAILED",
  );
  assert(
    Number.isFinite(result.actualSampleRate) &&
      result.actualSampleRate > 0 &&
      result.qualification?.fftSize === 2048,
    "NATIVE_MONITOR_ACTUAL_RATE_FFT_MISSING",
  );
  assert(
    result.cleanup?.contextState === "closed" &&
      result.cleanup?.nativeSourceNodes === 0 &&
      result.cleanup?.callbacksCleared === true,
    "NATIVE_CONTEXT_OWNERSHIP_CLEANUP_FAILED",
  );
}
const workPromise = work().finally(() => {
  workSettled = true;
});
try {
  await bounded(
    () => workPromise,
    Math.max(1, WORK_MS - (performance.now() - started)),
    "MONITOR_WORK_DEADLINE",
  );
} catch (error) {
  state.errors.push(String(error));
} finally {
  aborted = true;
  state.stage = "cleanup";
  const deadline = Math.min(started + HARD_MS - 250, performance.now() + CLEANUP_MS);
  async function clean(name, action) {
    try {
      state.cleanup[name] = await bounded(
        action,
        deadline - performance.now(),
        `${name}_CLEANUP_DEADLINE`,
      );
    } catch (error) {
      state.cleanup[name] = "FAIL";
      state.errors.push(String(error));
    }
  }
  await Promise.all([
    clean("browser", async () => {
      const owned = browser ?? (browserCreation ? await browserCreation.catch(() => null) : null);
      if (!owned) return "NOT_CREATED";
      await owned.close();
      assert(!owned.isConnected(), "OWNED_BROWSER_STILL_CONNECTED");
      return "CLOSED";
    }),
    clean("server", async () => {
      const owned = server ?? (serverCreation ? await serverCreation.catch(() => null) : null);
      if (!owned) return "NOT_CREATED";
      await owned.close();
      assert(!owned.httpServer?.listening, "OWNED_VITE_STILL_LISTENING");
      return "CLOSED";
    }),
    clean("sources", async () => {
      state.filesAfter = await sourceSnapshot();
      state.sourceStable = json(state.files) === json(state.filesAfter);
      assert(state.sourceStable, "NATIVE_MONITOR_SOURCES_CHANGED");
      return "VERIFIED";
    }),
  ]);
  state.cleanup.complete =
    [state.cleanup.browser, state.cleanup.server].every(
      (value) => value === "CLOSED" || value === "NOT_CREATED",
    ) && state.cleanup.sources === "VERIFIED";
  if (state.pageErrors.length) state.errors.push("NATIVE_MONITOR_PAGE_ERRORS");
  if (!workSettled) state.errors.push("NATIVE_MONITOR_WORK_NOT_SETTLED");
  state.status =
    state.errors.length === 0 &&
    state.result?.passed === true &&
    state.artifacts.length === expectedArtifacts.size &&
    state.cleanup.complete
      ? "PASS"
      : "FAIL";
  state.stage = "finished";
  state.elapsedMs = performance.now() - started;
  try {
    await atomic(out, json(state));
  } catch (error) {
    state.status = "FAIL";
    process.stderr.write(String(error) + "\n");
  }
  process.stdout.write(
    json({
      status: state.status,
      output: out,
      nativeArtifacts: state.artifacts.length,
      sourceStable: state.sourceStable,
      cleanup: state.cleanup,
    }),
  );
  if (state.status !== "PASS") process.exitCode = 1;
  if (workSettled && state.cleanup.complete) clearTimeout(hardTimer);
}
