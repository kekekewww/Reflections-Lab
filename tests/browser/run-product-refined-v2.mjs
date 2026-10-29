import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { promisify, stripVTControlCharacters } from "node:util";
import os from "node:os";
import path from "node:path";

const selection = process.env.PRODUCT_BROWSER_CHANNEL ?? "chrome";
const observerProfile = process.env.PRODUCT_OBSERVER_PROFILE ?? "light";
const gpuProfile = process.env.PRODUCT_GPU_PROFILE ?? "default";
if (!["light", "instrumented"].includes(observerProfile))
  throw new Error("Unsupported product observer profile");
if (!["default", "swiftshader"].includes(gpuProfile))
  throw new Error("Unsupported product GPU profile");
if (!["chrome", "msedge", "firefox", "webkit"].includes(selection))
  throw new Error("Unsupported product browser selection");
const prefix =
  selection === "chrome" ? "test-results/product-e2e/" : `test-results/product-e2e-${selection}/`;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile("test-results/product-e2e/build.json");
const manifest = JSON.parse(manifestBytes.toString("utf8"));
await mkdir(prefix, { recursive: true });
if (prefix !== "test-results/product-e2e/") await writeFile(prefix + "build.json", manifestBytes);
if (manifest.exitCode !== 0 || manifest.sourceStableDuringBuild !== true)
  throw new Error("A successful stable product build is required");
async function current(files) {
  return Promise.all(
    files.map(async (item) => ({ path: item.path, sha256: digest(await readFile(item.path)) })),
  );
}
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const file = path.posix.join(directory, entry.name);
        return entry.isDirectory() ? walk(file) : [file];
      }),
    )
  )
    .flat()
    .sort();
}
async function liveInputs() {
  const names = [
    ...(await walk("src")),
    ...(await walk("schemas")),
    ...(await walk("public")),
    "docs/05-ux/DESIGN_TOKENS.json",
    "package.json",
    "package-lock.json",
    "index.html",
    "tsconfig.json",
    "vite.config.ts",
  ].sort();
  return current(names.map((path) => ({ path })));
}
async function liveBundle() {
  return current((await walk("test-results/product-preview-dist")).map((path) => ({ path })));
}
const harnessNames = [
  "tests/browser/build-product-preview.mjs",
  "tests/browser/product-refined-v2.config.ts",
  "tests/browser/product-e2e-refined-v2.spec.ts",
  "tests/browser/run-product-refined-v2.mjs",
];
const startedAt = new Date().toISOString(),
  before = await liveInputs(),
  bundleBefore = await liveBundle(),
  harnessBefore = await current(harnessNames.map((path) => ({ path })));
const command = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "--config",
  "tests/browser/product-refined-v2.config.ts",
  "--global-timeout",
  process.argv.includes("--grep") ? "240000" : "480000",
  ...process.argv.slice(2),
];
const previewArgs = [
  "node_modules/vite/bin/vite.js",
  "preview",
  "--outDir",
  "test-results/product-preview-dist",
  "--host",
  "127.0.0.1",
  "--port",
  "5190",
  "--strictPort",
];
const preview = spawn(process.execPath, previewArgs, {
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
const owned = {
  runnerPid: process.pid,
  previewPid: preview.pid ?? null,
  playwrightPid: null,
  previewCommand: [process.execPath, ...previewArgs],
  testCommand: [process.execPath, ...command],
  cleanup: [],
};
let previewStdout = "",
  previewStderr = "",
  testStdout = "",
  testStderr = "",
  runError = null,
  cli = null,
  watchdog = null,
  previewError = null;
let result = { status: null, signal: null };
preview.stdout.on("data", (chunk) => {
  previewStdout += chunk.toString();
});
preview.stderr.on("data", (chunk) => {
  previewStderr += chunk.toString();
});
preview.on("error", (error) => {
  previewError = String(error);
  previewStderr += String(error);
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);
function windowsIdentityAuditScript(roots) {
  const knownRoots = [...new Set(roots)].filter(
    (pid) => Number.isSafeInteger(pid) && pid > 0 && pid <= 0xffffffff,
  );
  return `
$ErrorActionPreference='Stop'
$properties=@('ProcessId','ParentProcessId','Name','ExecutablePath','CreationDate')
$knownRoots=@(${knownRoots.join(",")})
$maximumProcesses=1024
$maximumDepth=32
$seen=[System.Collections.Generic.HashSet[uint32]]::new()
$queue=[System.Collections.Generic.Queue[object]]::new()
$rows=[System.Collections.Generic.Dictionary[uint32,object]]::new()
foreach($value in $knownRoots){
  if($seen.Add([uint32]$value)){$queue.Enqueue(@{Id=[uint32]$value;Depth=0})}
}
if($seen.Count -gt $maximumProcesses){throw 'Owned identity audit node budget exceeded'}
while($queue.Count -gt 0){
  $item=$queue.Dequeue()
  $ownedId=[uint32]$item.Id
  $current=@(Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ownedId" -Property $properties)
  foreach($row in $current){
    if([uint32]$row.ProcessId -ne $ownedId){throw 'Owned identity query returned an unrelated process'}
    $rows[[uint32]$row.ProcessId]=$row
  }
  $children=@(Get-CimInstance -ClassName Win32_Process -Filter "ParentProcessId = $ownedId" -Property $properties)
  foreach($row in $children){
    if([uint32]$row.ParentProcessId -ne $ownedId -or [uint32]$row.ProcessId -eq 0){throw 'Owned ancestry query returned an unrelated process'}
    $rows[[uint32]$row.ProcessId]=$row
    if($seen.Add([uint32]$row.ProcessId)){
      if($seen.Count -gt $maximumProcesses){throw 'Owned identity audit node budget exceeded'}
      if($item.Depth -ge $maximumDepth){throw 'Owned identity audit depth budget exceeded'}
      $queue.Enqueue(@{Id=[uint32]$row.ProcessId;Depth=$item.Depth+1})
    }
  }
}
$left=@($rows.Values | Sort-Object ProcessId | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,@{Name='CreatedAt';Expression={if($null -ne $_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{$null}}})
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
@{checkedAt=[DateTime]::UtcNow.ToString('o');roots=$knownRoots;remaining=$left} | ConvertTo-Json -Depth 5 -Compress
`;
}
async function closeOwned(child, label) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) {
    owned.cleanup.push({ label, pid: child?.pid ?? null, alreadyExited: true });
    return;
  }
  const exited = once(child, "exit").then(() => true);
  if (process.platform === "win32" && label === "playwright") {
    const killed = await execFileAsync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      timeout: 10000,
      encoding: "utf8",
    });
    owned.cleanup.push({
      label: "playwright-owned-tree-taskkill",
      pid: child.pid,
      stdout: killed.stdout,
      stderr: killed.stderr,
    });
  } else child.kill("SIGTERM");
  let stopped = await Promise.race([exited, delay(5000).then(() => false)]);
  if (!stopped) {
    child.kill("SIGKILL");
    stopped = await Promise.race([exited, delay(5000).then(() => false)]);
  }
  owned.cleanup.push({
    label,
    pid: child.pid,
    exited: stopped,
    exitCode: child.exitCode,
    signalCode: child.signalCode,
  });
  if (!stopped) throw new Error(`Owned ${label} did not exit within bounded cleanup`);
}
try {
  await writeFile(prefix + "owned-processes.json", JSON.stringify(owned, null, 2) + "\n");
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (previewError) throw new Error(previewError);
    if (preview.exitCode !== null || preview.signalCode !== null)
      throw new Error(`Owned preview exited: ${previewStderr}`);
    if (!stripVTControlCharacters(previewStdout).includes("http://127.0.0.1:5190")) {
      await delay(100);
      continue;
    }
    try {
      const response = await fetch("http://127.0.0.1:5190/", { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const servedHash = digest(new Uint8Array(await response.arrayBuffer()));
        if (
          servedHash !==
          manifest.bundle.find(
            (file) => file.path === "test-results/product-preview-dist/index.html",
          )?.sha256
        )
          throw new Error("Preview did not serve frozen product HTML");
        ready = true;
        break;
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Preview did not serve frozen product HTML")
        throw error;
    }
    await delay(100);
  }
  if (!ready) throw new Error("Owned preview startup timeout");
  cli = spawn(process.execPath, command, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DEBUG: "pw:browser" },
  });
  cli.stdout.on("data", (chunk) => {
    testStdout += chunk.toString();
  });
  cli.stderr.on("data", (chunk) => {
    testStderr += chunk.toString();
  });
  const completed = new Promise((resolve, reject) => {
    cli.once("error", reject);
    cli.once("exit", (status, signal) => resolve({ status, signal }));
  });
  owned.playwrightPid = cli.pid ?? null;
  await writeFile(prefix + "owned-processes.json", JSON.stringify(owned, null, 2) + "\n");
  const hardLimit = process.argv.includes("--grep") ? 270000 : 510000;
  const bounded = new Promise((_, reject) => {
    watchdog = setTimeout(() => reject(new Error("E2E outer watchdog exceeded")), hardLimit);
  });
  result = await Promise.race([completed, bounded]);
} catch (error) {
  runError = String(error);
} finally {
  if (watchdog !== null) clearTimeout(watchdog);
  try {
    await closeOwned(cli, "playwright");
  } catch (error) {
    runError = [runError, String(error)].filter(Boolean).join("; ");
  }
  try {
    await closeOwned(preview, "preview");
  } catch (error) {
    runError = [runError, String(error)].filter(Boolean).join("; ");
  }
  owned.nativeLaunchedPids = [
    ...new Set([...testStderr.matchAll(/<launched> pid=(\d+)/g)].map((match) => Number(match[1]))),
  ];
  if (process.platform === "win32") {
    try {
      const roots = [owned.previewPid, owned.playwrightPid, ...owned.nativeLaunchedPids].filter(
        (value) => Number.isSafeInteger(value) && value > 0,
      );
      const script = windowsIdentityAuditScript(roots);
      const audit = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { windowsHide: true, timeout: 15000, encoding: "utf8", maxBuffer: 1024 * 1024 },
      );
      owned.treeAudit = JSON.parse(audit.stdout.replace(/^\uFEFF/, "").trim());
      if (owned.treeAudit.remaining.length !== 0)
        throw new Error("Owned E2E descendants remain after cleanup");
      owned.treeAudit.status = "PASS_ZERO_REMAINING";
    } catch (error) {
      owned.treeAudit = {
        ...(owned.treeAudit ?? {}),
        status: "UNVERIFIED_OR_REMAINING",
        error: String(error),
      };
      runError = [runError, "Owned process-tree audit failed: " + String(error)]
        .filter(Boolean)
        .join("; ");
    }
  }
  await writeFile(prefix + "owned-processes.json", JSON.stringify(owned, null, 2) + "\n");
  await writeFile(prefix + "preview.stdout.txt", previewStdout);
  await writeFile(prefix + "preview.stderr.txt", previewStderr);
  await writeFile(prefix + "run.stdout.txt", testStdout);
  await writeFile(prefix + "run.stderr.txt", testStderr);
}
const after = await liveInputs(),
  bundleAfter = await liveBundle(),
  harnessAfter = await current(harnessNames.map((path) => ({ path })));
const report = {
  schemaVersion: 1,
  browserSelection: selection,
  observerProfile,
  requestedGpuProfile: gpuProfile,
  effectiveEnvironment: {
    PRODUCT_BROWSER_CHANNEL: selection,
    PRODUCT_OBSERVER_PROFILE: observerProfile,
    PRODUCT_GPU_PROFILE: gpuProfile,
  },
  browserLaunchCommands: [...testStderr.matchAll(/<launching> (.+)/g)].map((match) => match[1]),
  browserEngine:
    selection === "firefox" ? "firefox" : selection === "webkit" ? "webkit" : "chromium",
  browserChannel: ["chrome", "msedge"].includes(selection) ? selection : null,
  startedAt,
  completedAt: new Date().toISOString(),
  command: [process.execPath, ...command],
  exitCode: result.status,
  signal: result.signal,
  runError,
  ownedProcesses: owned,
  buildInputDigest: manifest.inputDigest,
  sourceMatchesBuildAtStart: JSON.stringify(before) === JSON.stringify(manifest.inputs),
  sourceStableDuringRun: JSON.stringify(before) === JSON.stringify(after),
  bundleMatchesBuildAtStart: JSON.stringify(bundleBefore) === JSON.stringify(manifest.bundle),
  bundleStableDuringRun: JSON.stringify(bundleBefore) === JSON.stringify(bundleAfter),
  harnessBefore,
  harnessAfter,
  harnessStableDuringRun: JSON.stringify(harnessBefore) === JSON.stringify(harnessAfter),
  host: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpu: os.cpus()[0]?.model ?? null,
    cpuCount: os.cpus().length,
    memoryBytes: os.totalmem(),
  },
  resultsPath: prefix + "results.json",
  limitations: [
    "Fixed e2e-mode native product bundle, isolated local preview; direct runtime action coverage is labelled in each case.",
    "No model inference. No hardware hearing, SPL calibration or AudioWorklet deadline claim.",
  ],
};
try {
  const resultsBytes = await readFile(prefix + "results.json");
  const results = JSON.parse(resultsBytes.toString("utf8"));
  report.testResults = {
    path: prefix + "results.json",
    sha256: digest(resultsBytes),
    stats: results.stats,
    fresh: Date.parse(results.stats?.startTime ?? "") >= Date.parse(startedAt) - 1000,
  };
} catch (error) {
  report.testResults = { path: prefix + "results.json", fresh: false, error: String(error) };
}
report.archiveDirectory = `artifacts/v1/product-e2e-${selection}-${startedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;
await writeFile(prefix + "verification.json", JSON.stringify(report, null, 2) + "\n");
await cp(prefix, report.archiveDirectory, { recursive: true, errorOnExist: true, force: false });
process.stdout.write(
  JSON.stringify({
    exitCode: report.exitCode,
    sourceMatchesBuildAtStart: report.sourceMatchesBuildAtStart,
    sourceStableDuringRun: report.sourceStableDuringRun,
    bundleStableDuringRun: report.bundleStableDuringRun,
    archiveDirectory: report.archiveDirectory,
    runError,
    stdoutTail: testStdout.slice(-3000),
    stderrTail: testStderr.slice(-1500),
  }) + "\n",
);
process.exitCode =
  result.status !== 0 ||
  runError !== null ||
  !report.sourceMatchesBuildAtStart ||
  !report.sourceStableDuringRun ||
  !report.bundleMatchesBuildAtStart ||
  !report.bundleStableDuringRun ||
  !report.harnessStableDuringRun ||
  !report.testResults.fresh
    ? 1
    : 0;
