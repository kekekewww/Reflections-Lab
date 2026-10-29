import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotValidationInputs } from "../../scripts/validation/source-snapshot.mjs";

process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
const args = process.argv.slice(2);
if (
  args.some((arg) => !["--list", "--evidence"].includes(arg)) ||
  new Set(args).size !== args.length
)
  throw new Error("Usage: node tests/browser/run-storage.mjs [--evidence] [--list]");
const cliArgs = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "--config",
  "tests/browser/persistence.config.ts",
];
if (args.includes("--list")) {
  const listed = spawnSync(process.execPath, [...cliArgs, "--list"], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (listed.error) throw listed.error;
  process.exit(listed.status ?? 1);
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const before = snapshotValidationInputs();
const startedAt = new Date().toISOString();
const attempt = startedAt.replace(/[^0-9]/g, "");
const output = args.includes("--evidence")
  ? `artifacts/v1/storage-browser-${attempt}`
  : `test-results/storage-runs/${attempt}`;
await mkdir(args.includes("--evidence") ? "artifacts/v1" : "test-results/storage-runs", {
  recursive: true,
});
await mkdir(output, { recursive: false });
const url = "http://127.0.0.1:5178";
const serverArgs = [
  "node_modules/vite/bin/vite.js",
  "--config",
  "tests/browser/persistence.vite.config.ts",
];
const logs = { serverStdout: "", serverStderr: "", stdout: "", stderr: "" };
const cleanup = [];
const cleanups = new Map();
let server = null,
  cli = null,
  serverError = null,
  runError = null,
  exitCode = 1;
let stopping = false,
  interrupted = false,
  serverUnexpectedExit = null;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function occupied() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: 5178 });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(true));
  });
}
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
function auditWindowsTree(roots) {
  const knownRoots = [...new Set(roots)].filter(
    (pid) => Number.isSafeInteger(pid) && pid > 0 && pid <= 0xffffffff,
  );
  const script = windowsIdentityAuditScript(knownRoots);
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.status !== 0 || result.error)
    return {
      verified: false,
      error: result.error?.message ?? result.stderr.trim(),
      remaining: null,
    };
  try {
    const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, "").trim());
    if (!Array.isArray(parsed.remaining)) throw new Error("Invalid process audit shape");
    return { verified: true, roots: knownRoots, remaining: parsed.remaining };
  } catch (error) {
    return { verified: false, error: String(error), remaining: null };
  }
}
function stopOwned(child, label) {
  if (!child?.pid) return Promise.resolve();
  if (cleanups.has(child.pid)) return cleanups.get(child.pid);
  const work = (async () => {
    let killResult = null,
      beforeAudit = null,
      afterAudit = null;
    let alreadyExited = child.exitCode !== null || child.signalCode !== null;
    if (process.platform === "win32") {
      beforeAudit = auditWindowsTree([child.pid]);
      // CIM is synchronous. Deliver queued exit events before re-checking the owned handle.
      await new Promise((resolve) => setImmediate(resolve));
      alreadyExited = child.exitCode !== null || child.signalCode !== null;
      const rootRow = beforeAudit.remaining?.find((row) => row.ProcessId === child.pid);
      const identityVerified =
        beforeAudit.verified &&
        rootRow?.ParentProcessId === process.pid &&
        typeof rootRow.ExecutablePath === "string" &&
        path.resolve(rootRow.ExecutablePath).toLowerCase() ===
          path.resolve(process.execPath).toLowerCase() &&
        Number.isFinite(Date.parse(rootRow.CreatedAt)) &&
        Date.parse(rootRow.CreatedAt) >= Date.parse(startedAt) - 1000 &&
        Date.parse(rootRow.CreatedAt) <= Date.now() + 1000;
      beforeAudit.rootIdentityVerified = identityVerified;
      // Only an owned ChildProcess is stopped. The audit is read-only and never authorizes new targets.
      if (!alreadyExited && identityVerified) {
        const killed = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          encoding: "utf8",
          timeout: 5000,
        });
        killResult = {
          exitCode: killed.status,
          error: killed.error?.message ?? null,
          stdout: killed.stdout ?? "",
          stderr: killed.stderr ?? "",
        };
        if (killed.status !== 0 || killed.error) child.kill("SIGKILL");
      } else if (!alreadyExited && !identityVerified) {
        // No numeric PID kill is safe to authorize without the identity audit. The original
        // ChildProcess handle can still stop its root; tree status remains unverified.
        killResult = { method: "owned-handle-only", treeUnverified: true };
        child.kill("SIGKILL");
      }
    } else if (!alreadyExited) {
      try {
        process.kill(-child.pid, "SIGKILL");
        killResult = { accepted: true };
      } catch (error) {
        killResult = { accepted: false, error: String(error) };
        child.kill("SIGKILL");
      }
    }
    const exited = await Promise.race([
      new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) resolve(true);
        else child.once("exit", () => resolve(true));
      }),
      delay(3000).then(() => false),
    ]);
    let treeStopped = false;
    if (process.platform === "win32") {
      afterAudit = auditWindowsTree([
        child.pid,
        ...(beforeAudit.remaining ?? []).map((row) => row.ProcessId),
      ]);
      treeStopped =
        beforeAudit.verified && afterAudit.verified && afterAudit.remaining.length === 0;
    } else {
      try {
        process.kill(-child.pid, 0);
        afterAudit = { verified: true, remainingProcessGroup: true };
      } catch (error) {
        treeStopped = error?.code === "ESRCH";
        afterAudit = {
          verified: treeStopped,
          remainingProcessGroup: treeStopped ? false : null,
          error: treeStopped ? null : String(error),
        };
      }
    }
    // A nonzero taskkill can race a normal exit. Accept only observed root exit AND a clear owned-tree audit.
    cleanup.push({
      label,
      pid: child.pid,
      accepted: exited && treeStopped && killResult?.treeUnverified !== true,
      alreadyExited,
      rootExitObserved: exited,
      beforeAudit,
      killResult,
      afterAudit,
    });
    child.stdout?.destroy();
    child.stderr?.destroy();
  })();
  cleanups.set(child.pid, work);
  return work;
}
const interrupt = () => {
  interrupted = true;
  stopping = true;
  void Promise.all([stopOwned(cli, "playwright-signal"), stopOwned(server, "vite-signal")]);
};
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
try {
  if (await occupied())
    throw new Error("Port 5178 is occupied; refusing to reuse or stop an unowned server.");
  server = spawn(process.execPath, serverArgs, {
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => {
    logs.serverStdout += chunk;
  });
  server.stderr.on("data", (chunk) => {
    logs.serverStderr += chunk;
  });
  server.on("error", (error) => {
    serverError = String(error);
  });
  server.on("exit", (code, signal) => {
    if (!stopping) serverUnexpectedExit = { code, signal };
  });
  const deadline = Date.now() + 30000;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    if (interrupted) throw new Error("Storage runner interrupted.");
    if (serverError || serverUnexpectedExit)
      throw new Error(serverError ?? `Owned Vite exited: ${logs.serverStderr}`);
    try {
      ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {}
    if (!ready) await delay(100);
  }
  if (!ready) throw new Error("Owned storage Vite startup timed out.");
  cli = spawn(process.execPath, [...cliArgs, "--global-timeout", "120000"], {
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  cli.stdout.on("data", (chunk) => {
    logs.stdout += chunk;
    process.stdout.write(chunk);
  });
  cli.stderr.on("data", (chunk) => {
    logs.stderr += chunk;
    process.stderr.write(chunk);
  });
  exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      void stopOwned(cli, "playwright-timeout").then(() =>
        reject(new Error("Storage Playwright exceeded its bounded teardown allowance.")),
      );
    }, 140000);
    cli.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    cli.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
} catch (error) {
  runError = String(error?.stack ?? error);
} finally {
  stopping = true;
  await stopOwned(cli, "playwright-finally");
  await stopOwned(server, "vite-finally");
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}
const after = snapshotValidationInputs();
let statistics = null,
  freshReport = false;
const artifacts = [];
for (const [name, text] of Object.entries(logs)) {
  const path = `${output}/${name}.txt`;
  await writeFile(path, text, { flag: "wx" });
  artifacts.push({ path, sha256: digest(text) });
}
try {
  const reportPath = "test-results/storage-browser-results.json";
  if ((await stat(reportPath)).mtimeMs >= Date.parse(startedAt)) {
    const bytes = await readFile(reportPath);
    statistics = JSON.parse(bytes).stats;
    freshReport = Date.parse(statistics?.startTime ?? "") >= Date.parse(startedAt) - 1000;
    const path = `${output}/browser-results.json`;
    await writeFile(path, bytes, { flag: "wx" });
    artifacts.push({ path, sha256: digest(bytes) });
  }
} catch {}
const sourceStable = JSON.stringify(before) === JSON.stringify(after);
const complete =
  statistics?.expected === 5 &&
  statistics?.unexpected === 0 &&
  statistics?.skipped === 0 &&
  statistics?.flaky === 0;
const report = {
  schemaVersion: 1,
  startedAt,
  completedAt: new Date().toISOString(),
  command: [process.execPath, ...cliArgs, "--global-timeout", "120000"],
  serverCommand: [process.execPath, ...serverArgs],
  ownedPids: { server: server?.pid ?? null, playwright: cli?.pid ?? null },
  exitCode,
  runError,
  statistics,
  freshReport,
  complete,
  sourceStable,
  sourceStabilityMethod:
    "Before/after hashes, not continuous monitoring; stop source writers before running.",
  serverStopped: !server || server.exitCode !== null || server.signalCode !== null,
  serverUnexpectedExit,
  interrupted,
  cleanup,
  before,
  after,
  artifacts,
  limitations: [
    "Persistence API fixture with native IndexedDB; not full product UI E2E or hearing validation.",
    "No model calls. --list performs discovery without starting Vite or a browser.",
  ],
};
await writeFile(`${output}/verification.json`, JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
const passed =
  exitCode === 0 &&
  !runError &&
  freshReport &&
  complete &&
  sourceStable &&
  report.serverStopped &&
  !serverUnexpectedExit &&
  !interrupted &&
  cleanup.every((event) => event.accepted && event.rootExitObserved);
process.stdout.write(
  JSON.stringify({
    status: passed ? "PASS" : "FAIL",
    verification: `${output}/verification.json`,
    statistics,
    sourceStable,
    serverStopped: report.serverStopped,
  }) + "\n",
);
process.exitCode = passed ? 0 : 1;
