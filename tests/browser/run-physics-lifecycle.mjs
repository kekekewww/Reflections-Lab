import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.some((value) => value !== "--evidence") || args.length > 1)
  throw new Error("Usage: node tests/browser/run-physics-lifecycle.mjs [--evidence]");
process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function walk(path, includeAll = false) {
  const entries = await readdir(path, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...(await walk(child, includeAll)));
    else if (includeAll || /\.(?:ts|tsx|mjs|css|json)$/.test(entry.name)) paths.push(child);
  }
  return paths;
}
const fixedPaths = [
  "package.json",
  "package-lock.json",
  ".node-version",
  "playwright.config.ts",
  "docs/05-ux/DESIGN_TOKENS.json",
  "tests/browser/physics-lifecycle.spec.ts",
  "tests/browser/physics-lifecycle.config.ts",
  "tests/browser/physics-lifecycle.vite.config.ts",
  "tests/browser/run-physics-lifecycle.mjs",
  "node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs",
  "node_modules/@dimforge/rapier3d-compat/dist/rapier_wasm3d_bg.wasm",
].sort();
const hashSources = async () => {
  const paths = [
    ...(await walk("src")),
    ...(await walk("schemas")),
    ...(await walk("public", true)),
    ...fixedPaths,
  ].sort();
  return Promise.all(paths.map(async (path) => ({ path, sha256: digest(await readFile(path)) })));
};
const before = await hashSources();
const attempt = new Date().toISOString().replace(/[^0-9]/g, "");
const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const root = args.includes("--evidence")
  ? `artifacts/v1/physics-acceptance-${day}/browser-${attempt}`
  : `test-results/physics-lifecycle-runs/${attempt}`;
await mkdir(root, { recursive: true });
let existing = false;
try {
  existing = (await fetch("http://127.0.0.1:5176", { signal: AbortSignal.timeout(1000) })).ok;
} catch {}
if (existing)
  throw new Error(
    "Port 5176 already has a server. Refusing to take ownership or stop an unknown process.",
  );
const startedAt = new Date().toISOString();
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--config", "tests/browser/physics-lifecycle.vite.config.ts"],
  {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  },
);
let cli = null;
let serverError = null;
let serverStopping = false;
let serverUnexpectedExit = null;
let interrupted = false;
const cleanupEvents = [];
server.on("error", (error) => {
  serverError = error;
});
server.on("exit", (code, signal) => {
  if (!serverStopping) serverUnexpectedExit = { code, signal };
});
// Only ChildProcess handles created above are eligible; never enumerate or stop other jobs.
const stopOwnedTree = async (child, reason) => {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  let accepted = true;
  let detail = null;
  if (process.platform === "win32") {
    // Windows SIGTERM is parent-only TerminateProcess. Kill the owned tree while its
    // parent still exists so Vite helpers cannot become unowned orphans.
    const result = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 5000,
    });
    accepted = result.status === 0 && !result.error;
    detail = { exitCode: result.status, error: result.error?.message ?? null };
    if (!accepted) child.kill("SIGKILL");
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      accepted = false;
      detail = { error: String(error) };
      child.kill("SIGKILL");
    }
  }
  const exited = await Promise.race([
    new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve(true);
      else child.once("exit", () => resolve(true));
    }),
    new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
  ]);
  cleanupEvents.push({ pid: child.pid, reason, accepted, rootExitObserved: exited, detail });
  child.stdout?.destroy();
  child.stderr?.destroy();
};
const interrupt = () => {
  if (interrupted) return;
  interrupted = true;
  serverStopping = true;
  void Promise.all([stopOwnedTree(cli, "signal"), stopOwnedTree(server, "signal")]);
  process.exitCode = 1;
};
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
let serverStdout = "",
  serverStderr = "",
  stdout = "",
  stderr = "",
  status = null;
server.stdout.on("data", (data) => {
  serverStdout += data;
});
server.stderr.on("data", (data) => {
  serverStderr += data;
});
try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    if (interrupted) throw new Error("Runner interrupted.");
    if (serverError) throw serverError;
    if (server.exitCode !== null)
      throw new Error(`Owned Vite exited ${server.exitCode}: ${serverStderr}`);
    try {
      ready = (await fetch("http://127.0.0.1:5176", { signal: AbortSignal.timeout(1000) })).ok;
    } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Owned Vite startup timed out.");
  cli = spawn(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "tests/browser/physics-lifecycle.config.ts",
      "--global-timeout",
      "120000",
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
      env: { ...process.env, V1_PHYSICS_SERVER_MANAGED: "1" },
    },
  );
  cli.stdout.on("data", (data) => {
    stdout += data;
    process.stdout.write(data);
  });
  cli.stderr.on("data", (data) => {
    stderr += data;
    process.stderr.write(data);
  });
  status = await new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      await stopOwnedTree(cli, "suite-timeout");
      reject(new Error("Playwright process exceeded the suite deadline plus teardown allowance."));
    }, 140000);
    cli.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    cli.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
} catch (error) {
  stderr += String(error?.stack ?? error) + "\n";
  status = 1;
} finally {
  serverStopping = true;
  await stopOwnedTree(server, "runner-finally");
}
const after = await hashSources();
const sourceStable = JSON.stringify(before) === JSON.stringify(after);
const afterByPath = new Map(after.map((file) => [file.path, file.sha256]));
const beforeByPath = new Map(before.map((file) => [file.path, file.sha256]));
const changedSources = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])]
  .filter((path) => beforeByPath.get(path) !== afterByPath.get(path))
  .map((path) => ({
    path,
    before: beforeByPath.get(path) ?? null,
    after: afterByPath.get(path) ?? null,
  }));
const artifacts = [];
for (const [name, content] of [
  ["browser.stdout.txt", stdout],
  ["browser.stderr.txt", stderr],
  ["browser-vite.stdout.txt", serverStdout],
  ["browser-vite.stderr.txt", serverStderr],
]) {
  const path = `${root}/${name}`;
  await writeFile(path, content);
  artifacts.push({ path, sha256: digest(content) });
}
let freshReport = false,
  statistics = null;
for (const [source, destination] of [
  ["test-results/v1-physics-browser-results.json", "browser-results.json"],
  ["test-results/v1-physics-browser-measurements.json", "browser-measurements.json"],
]) {
  try {
    const metadata = await stat(source);
    if (metadata.mtimeMs < Date.parse(startedAt)) continue;
    const bytes = await readFile(source),
      path = `${root}/${destination}`;
    await writeFile(path, bytes);
    artifacts.push({ path, sha256: digest(bytes) });
    if (destination === "browser-results.json") {
      freshReport = true;
      statistics = JSON.parse(bytes).stats;
    }
  } catch {}
}
const suiteComplete =
  statistics?.expected === 2 &&
  statistics?.unexpected === 0 &&
  statistics?.skipped === 0 &&
  statistics?.flaky === 0;
const proof = {
  schemaVersion: 1,
  command:
    "node node_modules/@playwright/test/cli.js test --config tests/browser/physics-lifecycle.config.ts --global-timeout 120000",
  server: {
    command:
      "node node_modules/vite/bin/vite.js --config tests/browser/physics-lifecycle.vite.config.ts",
    ownedPid: server.pid,
    stopped: server.exitCode !== null || server.signalCode !== null,
  },
  startedAt,
  finishedAt: new Date().toISOString(),
  exitCode: status,
  sourceStable,
  freshReport,
  suiteComplete,
  interrupted,
  cleanupEvents,
  serverUnexpectedExit,
  statistics,
  files: before,
  afterFiles: after,
  changedSources,
  artifacts,
};
await writeFile(`${root}/browser-verification.json`, JSON.stringify(proof, null, 2) + "\n");
process.stdout.write(
  JSON.stringify({
    path: `${root}/browser-verification.json`,
    exitCode: status,
    sourceStable,
    freshReport,
    statistics,
    serverStopped: proof.server.stopped,
  }) + "\n",
);
process.exitCode =
  status === 0 &&
  sourceStable &&
  freshReport &&
  suiteComplete &&
  proof.server.stopped &&
  !interrupted &&
  !serverUnexpectedExit &&
  cleanupEvents.every((event) => event.accepted && event.rootExitObserved)
    ? 0
    : 1;
