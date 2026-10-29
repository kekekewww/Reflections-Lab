import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { firefox } from "@playwright/test";

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
  outputArgument ?? `artifacts/v1/audio-delay-reference-v1-${run ? "run" : "prepare"}-${stamp}`,
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
    "tests/audio-runtime/native-delay-reference-v1.ts",
    "tests/audio-runtime/delay-reference-model-v1.ts",
    "tests/audio-runtime/delay-reference-v1.test.ts",
    "tests/audio-runtime/DELAY_REFERENCE_V1.md",
    "tests/audio-runtime/run-delay-reference-v1.mjs",
    "package-lock.json",
    "node_modules/playwright-core/browsers.json",
  ].sort();
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [
        path,
        createHash("sha256")
          .update(await readFile(resolve(root, path)))
          .digest("hex"),
      ]),
    ),
  );
}
const expectedIds = [
  "gain-only-zero",
  "convolver-unit-zero",
  "gain-only-delay-025",
  "convolver-unit-delay-025",
  "gain-only-delay-075",
  "convolver-unit-delay-075",
  "gain-only-delay-125",
  "convolver-unit-delay-125",
  "parallel-original-paths",
];
const before = await sources();
const executablePath = firefox.executablePath();
const browserManifest = JSON.parse(
  await readFile(resolve(root, "node_modules/playwright-core/browsers.json"), "utf8"),
).browsers.find((browser) => browser.name === "firefox");
const preparation = {
  createdAt: new Date().toISOString(),
  mode: run ? "RUN_REQUESTED" : "PREPARED_NO_BROWSER_LAUNCH",
  browserLaunched: false,
  referenceVersion: "native-delay-reference-v1",
  engine: "firefox",
  executablePath,
  executableExists: existsSync(executablePath),
  manifestRevision: browserManifest?.revision ?? null,
  manifestVersion: browserManifest?.browserVersion ?? null,
  node: process.versions.node,
  platform: os.platform(),
  release: os.release(),
  command: ["node", "tests/audio-runtime/run-delay-reference-v1.mjs", ...argumentsList],
  expectedIds,
  sampleRate: 48000,
  channelsPerCase: 2,
  framesPerChannel: 12000,
  maximumRawPcmBytes: 864000,
  sources: before,
  originalFailRetained: true,
  acceptanceClaim: "NONE; a measured reference does not change the original 25-case acceptance",
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
  process.exitCode = preparation.executableExists ? 0 : 2;
} else {
  let server = null,
    browserServer = null,
    browser = null,
    context = null,
    result = null,
    runnerError = null,
    actualVersion = null,
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
    if (!preparation.executableExists)
      throw new Error("Cached Firefox executable missing; installation is not authorized");
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
    const url = `http://127.0.0.1:${address.port}/__delay_reference_v1__`;
    browserServer = await firefox.launchServer({ headless: true, timeout: 20_000 });
    browser = await firefox.connect(browserServer.wsEndpoint(), { timeout: 20_000 });
    actualVersion = browser.version();
    // A late context-acquisition completion cannot reach another batch: every
    // exception exits this single batch and retires its entire owned browser.
    context = await deadline(browser.newContext(), 15_000, "owned browser context creation");
    const page = await deadline(context.newPage(), 15_000, "owned reference page creation");
    page.setDefaultTimeout(15_000);
    await deadline(
      page.route(url, (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: '<!doctype html><meta charset="utf-8"><title>Native delay reference v1</title><button id="run-reference">Run native reference</button>',
        }),
      ),
      15_000,
      "owned reference page interception",
    );
    await deadline(page.goto(url), 15_000, "owned reference page navigation");
    await deadline(
      page.evaluate(async () => {
        const module = await import("/tests/audio-runtime/native-delay-reference-v1.ts");
        document.getElementById("run-reference").onclick = () => {
          globalThis.__nativeDelayReferenceV1 = Promise.resolve(module.runNativeDelayReferenceV1());
          // Attach rejection observation while preserving the native/reference return.
          void globalThis.__nativeDelayReferenceV1.catch(() => {});
        };
      }),
      15_000,
      "standalone reference module preparation",
    );
    await page.getByRole("button", { name: "Run native reference" }).click();
    result = await deadline(
      page.evaluate(() => globalThis.__nativeDelayReferenceV1),
      45_000,
      "single native delay reference batch",
    );
    await write("reference-result.json", result);
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
      await deadline(browserServer.close(), 8_000, "owned Firefox close").then(
        () => cleanup.push({ resource: "browser", pid, method: "close", ok: true }),
        async (error) => {
          const killError = await deadline(browserServer.kill(), 8_000, "owned Firefox kill").then(
            () => null,
            errorValue,
          );
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
  const after = await sources(),
    sourceStable = JSON.stringify(before) === JSON.stringify(after);
  const cases = Array.isArray(result?.cases) ? result.cases : [];
  const rawPcmComplete =
    cases.length === expectedIds.length &&
    new Set(cases.map((entry) => entry.id)).size === expectedIds.length &&
    expectedIds.every((id) => cases.some((entry) => entry.id === id)) &&
    cases.every(
      (entry) =>
        Array.isArray(entry.rawPcm) &&
        entry.rawPcm.length === 2 &&
        entry.rawPcm.every(
          (channel) =>
            Array.isArray(channel) &&
            channel.length === 12000 &&
            Array.from(channel).every(Number.isFinite),
        ),
    );
  const measured =
    result?.status === "REFERENCE_MEASURED" &&
    result?.referenceVersion === "native-delay-reference-v1" &&
    rawPcmComplete;
  const blocked = result?.status === "BLOCKED" && !runnerError;
  const invalid = runnerError || interrupted || !sourceStable || cleanup.some((entry) => !entry.ok);
  const status = invalid
    ? "ERROR"
    : measured
      ? "REFERENCE_MEASURED"
      : blocked
        ? "BLOCKED"
        : "ERROR";
  const exitCode = status === "REFERENCE_MEASURED" ? 0 : status === "BLOCKED" ? 2 : 1;
  const verification = {
    status,
    exitCode,
    createdAt: new Date().toISOString(),
    elapsedMilliseconds: Date.now() - startedAt,
    referenceVersion: "native-delay-reference-v1",
    actualVersion,
    browserLaunched: Boolean(browserServer),
    browserPid: browserServer?.process().pid ?? null,
    rawPcmComplete,
    rawPcmBytes: rawPcmComplete ? 864000 : null,
    expectedIds,
    runnerError,
    interrupted,
    sourceStable,
    sourcesBefore: before,
    sourcesAfter: after,
    cleanup,
    originalFailRetained: true,
    acceptanceClaim: "NONE; measurement does not change original25 FAIL or its numeric thresholds",
    limitations: [
      "The runner records the separate reference; numeric inference remains in its raw diagnostic data",
      "No product App, hearing, device latency, SPL, AudioWorklet or external/model API validation",
    ],
  };
  await write("verification.json", verification);
  process.stdout.write(`${relative(root, output)}: ${status}\n`);
  process.exitCode = exitCode;
}
