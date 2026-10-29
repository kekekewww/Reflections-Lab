import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { chromium } from "@playwright/test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const argumentsList = process.argv.slice(2);
let run = false,
  outputArgument = null;
for (let index = 0; index < argumentsList.length; index++) {
  const argument = argumentsList[index];
  if (argument === "--prepare") continue;
  if (argument === "--run") {
    run = true;
    continue;
  }
  if (argument === "--output") {
    outputArgument = argumentsList[++index];
    if (!outputArgument || outputArgument.startsWith("--"))
      throw new Error("Missing --output value");
    continue;
  }
  throw new Error(`Unknown argument: ${argument}`);
}
const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
const output = resolve(
  root,
  outputArgument ?? `artifacts/v1/audio-ir-state-reference-v1-${run ? "run" : "prepare"}-${stamp}`,
);
if (output === root || !output.startsWith(root + sep))
  throw new Error("Evidence output must be a directory within the workspace");
if (
  existsSync(resolve(output, "preparation.json")) ||
  existsSync(resolve(output, "verification.json"))
)
  throw new Error("Refusing to overwrite an earlier evidence run");
await mkdir(output, { recursive: true });
const write = (name, value) =>
  writeFile(resolve(output, name), JSON.stringify(value, null, 2) + "\n");
const errorValue = (error) => ({
  name: error?.name ?? "Error",
  message: error?.message ?? String(error),
  stack: error?.stack ?? null,
});
const deadline = (promise, milliseconds, label) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`${label} exceeded ${milliseconds}ms`);
        error.name = "HarnessTimeoutError";
        reject(error);
      }, milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
};
async function fileHash(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function sources() {
  const audio = (await readdir(resolve(root, "src/audio")))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `src/audio/${name}`);
  const paths = [
    ...audio,
    "tests/audio-runtime/browser.ts",
    "tests/audio-runtime/native-pause.ts",
    "tests/audio-runtime/native-reverb.ts",
    "tests/audio-runtime/native-continuity.ts",
    "tests/audio-runtime/native-restore.ts",
    "tests/audio-runtime/native-wave.ts",
    "tests/audio-runtime/native-ir-state-reference-v1.ts",
    "tests/audio-runtime/ir-state-reference-v1-data.ts",
    "tests/audio-runtime/ir-state-reference-v1.test.ts",
    "tests/audio-runtime/run-ir-state-reference-v1.mjs",
    "package-lock.json",
    "node_modules/playwright-core/browsers.json",
  ].sort();
  return Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await fileHash(resolve(root, path))])),
  );
}
const referenceVersion = "native-ir-state-reference-v1";
const expectedCheckIds = [
  "native-identical-ir-impulse-tail",
  "native-identical-ir-continuous-tone-scale-20ms",
  "native-changed-ir-bank-reverse",
];
const expectedRenderIds = expectedCheckIds.flatMap((id) => [`${id}:actual`, `${id}:reference`]);
const before = await sources();
const manifest = JSON.parse(
  await readFile(resolve(root, "node_modules/playwright-core/browsers.json"), "utf8"),
);
const pinnedBrowser = manifest.browsers.find(
  (browser) => browser.name === "chromium-headless-shell",
);
const chromiumApiExecutablePath = chromium.executablePath();
// The current reference environment is Windows x64. Derive the cache root from
// Playwright's resolved Chromium path, including its selected cache environment,
// but explicitly select headless shell using its own manifest revision.
const supportedPlatform = process.platform === "win32" && process.arch === "x64";
const cacheRoot = dirname(dirname(dirname(chromiumApiExecutablePath)));
const executablePath =
  supportedPlatform && pinnedBrowser?.revision
    ? resolve(
        cacheRoot,
        `chromium_headless_shell-${pinnedBrowser.revision}`,
        "chrome-headless-shell-win64",
        "chrome-headless-shell.exe",
      )
    : null;
const executableExists = executablePath !== null && existsSync(executablePath);
const executableSha256 = executableExists ? await fileHash(executablePath) : null;
const runnerBlockReason = !supportedPlatform
  ? "This runner's explicit headless-shell cache layout is qualified only for Windows x64"
  : !pinnedBrowser?.revision
    ? "Installed Playwright manifest has no chromium-headless-shell revision"
    : !executableExists
      ? "Cached Chromium headless-shell executable missing; installation is not authorized"
      : null;
const playwrightVersion = JSON.parse(
  await readFile(resolve(root, "node_modules/@playwright/test/package.json"), "utf8"),
).version;
const preparation = {
  createdAt: new Date().toISOString(),
  mode: run ? "RUN_REQUESTED" : "PREPARED_NO_BROWSER_LAUNCH",
  browserLaunched: false,
  referenceVersion,
  engine: "chromium-headless-shell",
  playwrightVersion,
  manifestName: pinnedBrowser?.name ?? null,
  manifestRevision: pinnedBrowser?.revision ?? null,
  manifestVersion: pinnedBrowser?.browserVersion ?? null,
  executablePath,
  executableExists,
  executableSha256,
  chromiumApiExecutablePath,
  runnerBlockReason,
  node: process.versions.node,
  platform: os.platform(),
  architecture: process.arch,
  release: os.release(),
  command: ["node", "tests/audio-runtime/run-ir-state-reference-v1.mjs", ...argumentsList],
  expectedCheckIds,
  expectedRenderIds,
  sampleRate: 48000,
  channelsPerRender: 2,
  framesPerChannel: 12000,
  maximumRawPcmBytes: 576000,
  sources: before,
  originalSuiteAndOraclesRetained: true,
  acceptanceClaim:
    "Only this separate three-check IR reference; never a replacement for original25",
};
await write("preparation.json", preparation);
if (!run) {
  process.stdout.write(
    JSON.stringify(
      { ...preparation, sources: undefined, output: relative(root, output) },
      null,
      2,
    ) + "\n",
  );
  process.exitCode = runnerBlockReason ? 2 : 0;
} else {
  let server = null,
    browserServer = null,
    browser = null,
    context = null,
    result = null,
    runnerError = null,
    actualVersion = null,
    userAgent = null,
    actualExecutablePath = null,
    interrupted = false;
  const cleanup = [],
    startedAt = Date.now();
  const interrupt = () => {
    interrupted = true;
    if (browserServer) void browserServer.kill().catch(() => {});
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    if (!runnerBlockReason) {
      const { createServer } = await import("vite");
      server = await createServer({
        configFile: false,
        root,
        appType: "custom",
        cacheDir: resolve(output, "vite-cache"),
        logLevel: "error",
        server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      await deadline(server.listen(), 30_000, "owned source server startup");
      const address = server.httpServer?.address();
      if (!address || typeof address === "string")
        throw new Error("Owned source server has no TCP address");
      const url = `http://127.0.0.1:${address.port}/__ir_state_reference_v1__`;
      if (interrupted) throw new Error("Runner interrupted before browser launch");
      browserServer = await chromium.launchServer({
        executablePath,
        headless: true,
        timeout: 20_000,
      });
      actualExecutablePath = browserServer.process().spawnfile;
      if (resolve(actualExecutablePath).toLowerCase() !== resolve(executablePath).toLowerCase())
        throw new Error("Spawned executable differs from the pinned Chromium headless shell");
      browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 20_000 });
      actualVersion = browser.version();
      // A late context-acquisition completion cannot reach another batch. Any
      // exception retires the entire owned browser before this runner can finish.
      context = await deadline(browser.newContext(), 15_000, "owned browser context creation");
      const page = await deadline(context.newPage(), 15_000, "owned reference page creation");
      page.setDefaultTimeout(15_000);
      await deadline(
        page.route(url, (route) =>
          route.fulfill({
            status: 200,
            contentType: "text/html",
            body: '<!doctype html><meta charset="utf-8"><title>Native IR state reference v1</title><button id="run-reference">Run native IR reference</button>',
          }),
        ),
        15_000,
        "owned reference page interception",
      );
      await deadline(page.goto(url), 15_000, "owned reference page navigation");
      userAgent = await deadline(
        page.evaluate(() => navigator.userAgent),
        15_000,
        "native user agent capture",
      );
      await deadline(
        page.evaluate(async () => {
          const module = await import("/tests/audio-runtime/native-ir-state-reference-v1.ts");
          document.getElementById("run-reference").onclick = () => {
            globalThis.__nativeIrStateReferenceV1 = Promise.resolve(
              module.runNativeIrStateReferenceV1(),
            );
            void globalThis.__nativeIrStateReferenceV1.catch(() => {});
          };
        }),
        15_000,
        "standalone IR reference module preparation",
      );
      if (interrupted) throw new Error("Runner interrupted before native reference batch");
      await page.getByRole("button", { name: "Run native IR reference" }).click();
      result = await deadline(
        page.evaluate(() => globalThis.__nativeIrStateReferenceV1),
        45_000,
        "single native IR state reference batch",
      );
      await write("reference-result.json", result);
    }
  } catch (error) {
    runnerError = errorValue(error);
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    if (context)
      await deadline(context.close(), 8_000, "owned context close").then(
        () => cleanup.push({ resource: "context", ok: true }),
        (error) => cleanup.push({ resource: "context", ok: false, error: errorValue(error) }),
      );
    if (browser)
      await deadline(browser.close(), 8_000, "owned browser client disconnect").then(
        () => cleanup.push({ resource: "browser-client", ok: true }),
        (error) =>
          cleanup.push({ resource: "browser-client", ok: false, error: errorValue(error) }),
      );
    if (browserServer) {
      const pid = browserServer.process().pid;
      await deadline(browserServer.close(), 8_000, "owned Chromium headless-shell close").then(
        () => cleanup.push({ resource: "browser", pid, method: "close", ok: true }),
        async (error) => {
          const killError = await deadline(
            browserServer.kill(),
            8_000,
            "owned headless-shell kill",
          ).then(() => null, errorValue);
          cleanup.push({
            resource: "browser",
            pid,
            method: "kill after close failure",
            ok: false,
            error: errorValue(error),
            killError,
          });
        },
      );
    }
    if (server)
      await deadline(server.close(), 8_000, "owned source server close").then(
        () => cleanup.push({ resource: "source-server", ok: true }),
        async (error) => {
          server.httpServer?.closeAllConnections();
          const watcherError = await deadline(
            server.watcher.close(),
            8_000,
            "owned watcher close",
          ).then(() => null, errorValue);
          cleanup.push({
            resource: "source-server",
            ok: false,
            error: errorValue(error),
            watcherError,
          });
        },
      );
  }
  let after = null,
    executableSha256After = null;
  try {
    after = await sources();
    executableSha256After = executableExists ? await fileHash(executablePath) : null;
  } catch (error) {
    runnerError ??= errorValue(error);
  }
  const sourceStable = after !== null && JSON.stringify(before) === JSON.stringify(after);
  const executableStable = executableSha256 === executableSha256After;
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const renders = Array.isArray(result?.renders) ? result.renders : [];
  const checksComplete =
    checks.length === expectedCheckIds.length &&
    new Set(checks.map((entry) => entry?.id)).size === expectedCheckIds.length &&
    expectedCheckIds.every((id) => checks.some((entry) => entry?.id === id)) &&
    checks.every((entry) => typeof entry?.pass === "boolean");
  const rawPcmComplete =
    renders.length === expectedRenderIds.length &&
    new Set(renders.map((entry) => entry?.id)).size === expectedRenderIds.length &&
    expectedRenderIds.every((id) => renders.some((entry) => entry?.id === id)) &&
    renders.every(
      (entry) =>
        Array.isArray(entry?.rawPcm) &&
        entry.rawPcm.length === 2 &&
        Array.from(entry.rawPcm).every(
          (channel) =>
            Array.isArray(channel) &&
            channel.length === 12000 &&
            Array.from(channel).every(Number.isFinite),
        ),
    );
  const resultVersionValid = result?.referenceVersion === referenceVersion;
  const blocked = runnerBlockReason || (resultVersionValid && result?.status === "BLOCKED");
  const invalid =
    runnerError ||
    interrupted ||
    !sourceStable ||
    !executableStable ||
    cleanup.some((entry) => !entry.ok);
  let status = "ERROR";
  if (!invalid) {
    if (blocked) status = "BLOCKED";
    else if (resultVersionValid && checksComplete && rawPcmComplete) {
      if (result.status === "PASS")
        status = checks.every((entry) => entry.pass === true) ? "PASS" : "FAIL";
      else if (result.status === "FAIL") status = "FAIL";
    }
  }
  const exitCode = status === "PASS" ? 0 : status === "BLOCKED" ? 2 : 1;
  const verification = {
    status,
    exitCode,
    createdAt: new Date().toISOString(),
    elapsedMilliseconds: Date.now() - startedAt,
    referenceVersion,
    engine: "chromium-headless-shell",
    manifestName: preparation.manifestName,
    manifestRevision: preparation.manifestRevision,
    manifestVersion: preparation.manifestVersion,
    playwrightVersion,
    actualVersion,
    userAgent,
    executablePath,
    actualExecutablePath,
    executableSha256,
    executableSha256After,
    executableStable,
    browserLaunched: Boolean(browserServer),
    browserPid: browserServer?.process().pid ?? null,
    checksComplete,
    rawPcmComplete,
    rawPcmBytes: rawPcmComplete ? 576000 : null,
    expectedCheckIds,
    expectedRenderIds,
    runnerBlockReason,
    runnerError,
    interrupted,
    sourceStable,
    sourcesBefore: before,
    sourcesAfter: after,
    cleanup,
    originalSuiteAndOraclesRetained: true,
    acceptanceClaim:
      "Only the separately versioned three-check IR state reference; original25 unchanged",
    limitations: [
      "A PASS is scoped to these three fixed native comparisons, not the full audio acceptance",
      "Unsupported platform/cache/API stays BLOCKED; unknown errors, incomplete PCM or cleanup failures stay ERROR",
      "No product App, hearing, device latency, SPL, AudioWorklet or external/model API validation",
    ],
  };
  await write("verification.json", verification);
  process.stdout.write(`${relative(root, output)}: ${status}\n`);
  process.exitCode = exitCode;
}
