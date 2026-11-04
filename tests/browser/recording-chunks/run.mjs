import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { assertOwnedRecordingServer } from "./server-identity.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const home = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(home, "../../..");
const output = path.resolve(
  project,
  "docs/16-nonadvanced-completion/lanes/recording-storage",
  `idb-${new Date().toISOString().replace(/[:.]/g, "")}`,
);
await mkdir(output, { recursive: true });
const inputs = [
  "src/persistence/blob-store.ts",
  "src/persistence/incremental-sha256.ts",
  "src/experiments/recording-persistence.ts",
  "src/experiments/recorder.ts",
  "src/app/recording-host.ts",
  "src/app/recording-evaluation-lane.ts",
  "tests/browser/recording-chunks/fixture.ts",
  "tests/browser/recording-chunks/index.html",
  "tests/browser/recording-chunks/vite.config.mjs",
  "tests/browser/recording-chunks/run.mjs",
  "tests/browser/recording-chunks/server-identity.mjs",
  "tests/experiment-runtime/worker-fixture.ts",
  "package.json",
  "package-lock.json",
];
async function snapshot() {
  return Promise.all(
    inputs.map(async (file) => ({
      file,
      sha256: createHash("sha256")
        .update(await readFile(path.resolve(project, file)))
        .digest("hex"),
    })),
  );
}
const before = await snapshot();
const executable = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const executableSha256 = createHash("sha256")
  .update(await readFile(executable))
  .digest("hex");
const ownerNonce = randomUUID();
const ownerUrl = "http://127.0.0.1:5198/__recording_chunk_owner__";
const server = spawn(
  process.execPath,
  [
    path.resolve(project, "node_modules/vite/bin/vite.js"),
    "--config",
    path.resolve(home, "vite.config.mjs"),
  ],
  {
    cwd: project,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, REFLECTION_CHUNK_OWNER_NONCE: ownerNonce },
  },
);
let serverLog = "";
let serverError = null;
server.on("error", (error) => {
  serverError = error;
});
server.stdout.on("data", (bytes) => {
  serverLog += bytes.toString();
});
server.stderr.on("data", (bytes) => {
  serverLog += bytes.toString();
});
let browser;
let result;
try {
  for (let attempt = 0; ; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null || server.signalCode !== null || attempt >= 100)
      throw new Error(`Vite readiness failed: ${serverLog}`);
    try {
      const response = await fetch(ownerUrl);
      if (response.ok) {
        assertOwnedRecordingServer(ownerNonce, await response.text(), server);
        break;
      }
    } catch {
      /* not ready */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: executable, headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("http://127.0.0.1:5198", { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.runRecordingChunkSuite === "function");
  let suiteTimer;
  try {
    result = await Promise.race([
      page.evaluate(() => window.runRecordingChunkSuite()),
      new Promise((_resolve, reject) => {
        suiteTimer = setTimeout(
          () => reject(new Error("RECORDING_CHUNK_SUITE_TIMEOUT_45000_MS")),
          45000,
        );
      }),
    ]);
  } finally {
    clearTimeout(suiteTimer);
  }
  const ownershipResponse = await fetch(ownerUrl);
  assertOwnedRecordingServer(ownerNonce, await ownershipResponse.text(), server);
  const after = await snapshot();
  result = {
    ...result,
    consoleErrors,
    before,
    after,
    sourceStable: JSON.stringify(before) === JSON.stringify(after),
    browser: { version: browser.version(), executable, executableSha256 },
    node: process.version,
    ownedServer: { pid: server.pid, ownerNonce, verifiedAfterSuite: true },
    overallV1Complete: false,
    digitalAudioTest: false,
  };
  if (consoleErrors.length || !result.sourceStable || result.status !== "PASS")
    throw new Error("Recording chunk browser validation failed");
} catch (error) {
  result = {
    status: "FAIL",
    error: { name: error.name, message: error.message, stack: error.stack },
    result: result ?? null,
    before,
    executableSha256,
    overallV1Complete: false,
  };
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => {
    if (server.exitCode !== null || server.signalCode !== null) resolve();
    else server.once("exit", resolve);
  });
  await writeFile(path.resolve(output, "server.txt"), serverLog);
  await writeFile(path.resolve(output, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({ output, status: result.status, cases: result.results?.length ?? 0 })}\n`,
  );
}
