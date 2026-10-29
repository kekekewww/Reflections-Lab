import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { chromium, firefox, webkit } from "@playwright/test";
import {
  CROSS_ENGINE_DEFAULTS,
  NATIVE_AUDIO_SUITES,
  NATIVE_AUDIO_CASE_COUNT,
  parseCrossEngineArgs,
} from "./cross-engine.config.mjs";
import {
  classifySuiteOutcome,
  missingSuiteCapabilities,
  summarizeEngineResults,
} from "./cross-engine-report.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const types = { chromium, firefox, webkit };
const options = parseCrossEngineArgs(process.argv.slice(2));
const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
const output = resolve(
  root,
  options.output ?? `artifacts/v1/audio-cross-engine-${options.run ? "run" : "prepare"}-${stamp}`,
);
if (output !== root && !output.startsWith(root + sep))
  throw new Error("Evidence output must remain within the workspace");
if (
  existsSync(resolve(output, "verification.json")) ||
  existsSync(resolve(output, "preparation.json"))
)
  throw new Error("Refusing to overwrite an earlier evidence run");
await mkdir(output, { recursive: true });
async function write(name, value) {
  await writeFile(resolve(output, name), JSON.stringify(value, null, 2) + "\n");
}
async function hash(path) {
  return createHash("sha256")
    .update(await readFile(resolve(root, path)))
    .digest("hex");
}
async function sources() {
  const audio = (await readdir(resolve(root, "src/audio")))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `src/audio/${name}`);
  const paths = [
    ...audio,
    ...NATIVE_AUDIO_SUITES.map((suite) => suite.module.slice(1)),
    "tests/audio-runtime/cross-engine.config.mjs",
    "tests/audio-runtime/cross-engine-report.mjs",
    "tests/audio-runtime/cross-engine-harness.ts",
    "tests/audio-runtime/run-cross-engine.mjs",
    "tests/audio-runtime/cross-engine-runner.test.mjs",
    "tests/audio-runtime/CROSS_ENGINE.md",
    "package-lock.json",
    "node_modules/playwright-core/browsers.json",
  ].sort();
  return Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await hash(path)])));
}
const before = await sources();
const browserManifest = JSON.parse(
  await readFile(resolve(root, "node_modules/playwright-core/browsers.json"), "utf8"),
);
const playwrightPackage = JSON.parse(
  await readFile(resolve(root, "node_modules/@playwright/test/package.json"), "utf8"),
);
const cache = options.engines.map((engine) => {
  const path = types[engine].executablePath(),
    pinned = browserManifest.browsers.find((browser) => browser.name === engine);
  return {
    engine,
    executablePath: path,
    executableExists: existsSync(path),
    manifestRevision: pinned?.revision ?? null,
    manifestVersion: pinned?.browserVersion ?? null,
  };
});
const preparation = {
  createdAt: new Date().toISOString(),
  mode: options.run ? "RUN_REQUESTED" : "PREPARED_NO_BROWSER_LAUNCH",
  browserLaunched: false,
  playwrightVersion: playwrightPackage.version,
  node: process.versions.node,
  platform: os.platform(),
  release: os.release(),
  engines: cache,
  targetSuites: NATIVE_AUDIO_SUITES.length,
  targetCasesPerEngine: NATIVE_AUDIO_CASE_COUNT,
  sources: before,
  limitations: [
    "Manifest/cache presence does not establish actual engine launch, audio capabilities or DSP correctness",
    "No install, application backend/API call, hearing, device latency or Worklet benchmark",
  ],
};
await write("preparation.json", preparation);
if (!options.run) {
  process.stdout.write(
    JSON.stringify(
      {
        status: "PREPARED_NO_BROWSER_LAUNCH",
        browserLaunched: false,
        output: relative(root, output),
        engines: cache,
        targetCasesPerEngine: NATIVE_AUDIO_CASE_COUNT,
      },
      null,
      2,
    ) + "\n",
  );
  process.exitCode = cache.every((engine) => engine.executableExists) ? 0 : 2;
} else {
  const engineResults = [],
    cleanup = [],
    ownedBrowserServers = [];
  let server = null,
    interrupted = false,
    runnerError = null;
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
  const stopBrowser = async (browserServer) => {
    if (!browserServer) return;
    const pid = browserServer.process().pid;
    try {
      await deadline(
        browserServer.close(),
        CROSS_ENGINE_DEFAULTS.cleanupTimeoutMs,
        "owned browser close",
      );
      cleanup.push({ resource: "browser", pid, method: "close", ok: true });
    } catch (error) {
      const killError = await deadline(
        browserServer.kill(),
        CROSS_ENGINE_DEFAULTS.cleanupTimeoutMs,
        "owned browser kill",
      ).then(() => null, errorValue);
      cleanup.push({
        resource: "browser",
        pid,
        method: "kill after close failure",
        ok: false,
        error: errorValue(error),
        killError,
      });
    }
  };
  const interrupt = () => {
    interrupted = true;
    for (const browserServer of ownedBrowserServers) void browserServer.kill().catch(() => {});
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
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
    const url = `http://127.0.0.1:${address.port}`;
    for (const cached of cache) {
      if (interrupted) throw new Error("Runner interrupted");
      const engine = { engine: cached.engine, cache: cached, actualVersion: null, suites: [] };
      engineResults.push(engine);
      if (!cached.executableExists) {
        engine.status = "BLOCKED";
        engine.reason = "Cached executable missing; installation is not authorized";
        continue;
      }
      let browserServer = null,
        browser = null;
      try {
        browserServer = await types[cached.engine].launchServer({
          headless: true,
          timeout: CROSS_ENGINE_DEFAULTS.launchTimeoutMs,
        });
        ownedBrowserServers.push(browserServer);
        browser = await types[cached.engine].connect(browserServer.wsEndpoint(), {
          timeout: CROSS_ENGINE_DEFAULTS.launchTimeoutMs,
        });
        engine.actualVersion = browser.version();
        for (const suite of NATIVE_AUDIO_SUITES) {
          if (interrupted) throw new Error("Runner interrupted");
          let context = null,
            page = null,
            capabilities = {},
            diagnostics = null,
            observation = {},
            contextAcquisitionFailed = false,
            contextCleanupFailed = false;
          try {
            try {
              context = await deadline(
                browser.newContext(),
                15_000,
                "owned browser context creation",
              );
            } catch (error) {
              // A timed-out protocol request may still create a context later. Retire
              // this entire owned browser before another suite shares its resources.
              contextAcquisitionFailed = true;
              throw error;
            }
            page = await deadline(context.newPage(), 15_000, "owned native audio page creation");
            page.setDefaultTimeout(15_000);
            await deadline(
              page.route(`${url}/__native_audio__`, (route) =>
                route.fulfill({
                  status: 200,
                  contentType: "text/html",
                  body: '<!doctype html><meta charset="utf-8"><title>Native audio only</title><button id="run-native-audio">Run native audio suite</button>',
                }),
              ),
              15_000,
              "isolated native audio page interception",
            );
            await deadline(
              page.goto(`${url}/__native_audio__`),
              15_000,
              "native audio page navigation",
            );
            capabilities = await deadline(
              page.evaluate(async () => {
                const harness = await import("/tests/audio-runtime/cross-engine-harness.ts");
                return harness.nativeCapabilities();
              }),
              15_000,
              "native API capability probe",
            );
            if (!missingSuiteCapabilities(suite, capabilities).length) {
              await deadline(
                page.evaluate(async (suite) => {
                  const harness = await import("/tests/audio-runtime/cross-engine-harness.ts");
                  return harness.prepareNativeSuite(suite);
                }, suite),
                15_000,
                "original suite import and preparation",
              );
              await page.getByRole("button", { name: "Run native audio suite" }).click();
              observation = await deadline(
                page.evaluate(async () => {
                  const harness = await import("/tests/audio-runtime/cross-engine-harness.ts");
                  return harness.awaitNativeSuite();
                }),
                CROSS_ENGINE_DEFAULTS.suiteTimeoutMs,
                `${cached.engine}/${suite.id}`,
              );
            }
          } catch (error) {
            observation = {
              error: errorValue(error),
              timedOut: error?.name === "HarnessTimeoutError",
            };
          } finally {
            if (page)
              diagnostics = await deadline(
                page.evaluate(async () => {
                  const harness = await import("/tests/audio-runtime/cross-engine-harness.ts");
                  return harness.nativeDiagnostics();
                }),
                2000,
                "diagnostic capture",
              ).catch((error) => ({ captureError: errorValue(error) }));
            if (context)
              try {
                await deadline(
                  context.close(),
                  CROSS_ENGINE_DEFAULTS.cleanupTimeoutMs,
                  "owned browser context close",
                );
              } catch (error) {
                contextCleanupFailed = true;
                cleanup.push({
                  resource: "context",
                  engine: cached.engine,
                  suite: suite.id,
                  ok: false,
                  error: errorValue(error),
                });
              }
          }
          const result = classifySuiteOutcome(suite, { ...observation, capabilities, diagnostics });
          engine.suites.push(result);
          await write(`${cached.engine}.${suite.id}.json`, result);
          process.stdout.write(
            `${cached.engine}/${suite.id}: ${result.status} (${result.cases.filter((value) => value.status === "PASS").length}/${suite.cases.length})\n`,
          );
          if (contextAcquisitionFailed || contextCleanupFailed)
            throw new Error(
              "Owned context acquisition/cleanup failed; stop this engine before another suite",
            );
        }
      } catch (error) {
        engine.status = "ERROR";
        engine.error = errorValue(error);
      } finally {
        if (browser)
          await deadline(
            browser.close(),
            CROSS_ENGINE_DEFAULTS.cleanupTimeoutMs,
            "owned browser client disconnect",
          ).catch(() => {});
        await stopBrowser(browserServer);
      }
    }
  } catch (error) {
    runnerError = errorValue(error);
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    if (server)
      try {
        await deadline(
          server.close(),
          CROSS_ENGINE_DEFAULTS.cleanupTimeoutMs,
          "owned source server close",
        );
        cleanup.push({ resource: "source-server", ok: true });
      } catch (error) {
        server.httpServer?.closeAllConnections();
        const watcherError = await deadline(
          server.watcher.close(),
          CROSS_ENGINE_DEFAULTS.cleanupTimeoutMs,
          "owned source watcher close",
        ).then(() => null, errorValue);
        cleanup.push({
          resource: "source-server",
          ok: false,
          error: errorValue(error),
          watcherError,
        });
      }
  }
  const after = await sources(),
    sourceStable = JSON.stringify(before) === JSON.stringify(after);
  let summary = summarizeEngineResults(engineResults, sourceStable);
  if (runnerError || interrupted || cleanup.some((event) => !event.ok))
    summary = {
      ...summary,
      status: "ERROR",
      exitCode: 1,
      reason:
        "Runner interruption/error or incomplete owned cleanup; retain the measured suite results",
    };
  const verification = {
    ...summary,
    createdAt: new Date().toISOString(),
    browserLaunched: ownedBrowserServers.length > 0,
    runnerError,
    interrupted,
    sourceStable,
    sourcesBefore: before,
    sourcesAfter: after,
    engines: engineResults,
    cleanup,
    limitations: [
      "All original numeric thresholds and fixture decisions are unchanged",
      "Missing APIs block affected checks; unrelated checks inside an unchanged aggregate may remain NOT_RUN_AGGREGATE_DEPENDENCY",
      "Native resume timeout with observed suspended context is environment-blocked, not a passing DSP result",
      "No hearing/headphone/device-latency/SPL or AudioWorklet/real-time capacity claim",
    ],
  };
  await write("verification.json", verification);
  process.stdout.write(`${relative(root, output)}: ${summary.status}\n`);
  process.exitCode = summary.exitCode;
}
