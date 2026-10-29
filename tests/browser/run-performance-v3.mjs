import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseProfileOptions } from "./performance-cli-v3.mjs";
import { runProcess } from "../../scripts/agents/process-runner.mjs";

export function planPerformanceRun(
  args,
  {
    nodeVersion = process.version,
    nodePath = process.execPath,
    cwd = process.cwd(),
    environment = process.env,
    defaultOutput,
  } = {},
) {
  if (nodeVersion !== "v22.17.0") throw Error("EXACT_NODE_REQUIRED");
  if (environment.RLAB_PERF_WORKER === "1") throw Error("NESTED_PERFORMANCE_WRAPPER");
  const options = parseProfileOptions(args);
  if (!options.executablePath) throw Error("V3_EXPLICIT_PINNED_EXECUTABLE_REQUIRED");
  const parent = path.resolve(
    cwd,
    options.output ??
      defaultOutput ??
      `artifacts/v1/performance-v3-${new Date().toISOString().replace(/[:.]/g, "")}-${randomUUID().slice(0, 8)}`,
  );
  const forwarded = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output") {
      i++;
      continue;
    }
    forwarded.push(args[i]);
  }
  return {
    parent,
    native: path.join(parent, "native"),
    file: nodePath,
    args: [
      "--max-old-space-size=2560",
      path.resolve(cwd, "tests/browser/performance-profile-v3.mjs"),
      ...forwarded,
      "--output",
      path.join(parent, "native"),
    ],
    cwd,
    timeoutMs: options.formal ? 1380000 : 420000,
    maxOutputBytes: 8 * 1024 * 1024,
    env: { RLAB_PERF_WORKER: "1" },
    formal: options.formal,
    paidCalls: 0,
  };
}
export async function runPerformance(args) {
  const plan = planPerformanceRun(args);
  await mkdir(plan.parent, { recursive: false });
  const sources = [
    "tests/browser/run-performance-v3.mjs",
    "tests/browser/performance-profile-v3.mjs",
    "tests/browser/performance-native-v3.mjs",
    "tests/browser/performance-numeric-formal-v3.mjs",
    "tests/browser/performance-stream-v3.mjs",
    "tests/browser/performance-fixture-v3.mjs",
    "tests/browser/performance-quiescence-v3.mjs",
    "tests/browser/performance-error-record-v3.mjs",
    "tests/browser/performance-proof-v3.mjs",
    "tests/browser/performance-owned-cleanup-v3.mjs",
    "scripts/agents/process-runner.mjs",
  ];
  const snapshot = () =>
    Promise.all(
      sources.map(async (file) => ({
        path: file,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
      })),
    );
  const before = await snapshot();
  await writeFile(
    path.join(plan.parent, "command.json"),
    JSON.stringify({ ...plan, source: before }, null, 2) + "\n",
    { flag: "wx" },
  );
  const result = await runProcess(plan);
  const after = await snapshot();
  await writeFile(path.join(plan.parent, "stdout.txt"), result.stdout, { flag: "wx" });
  await writeFile(path.join(plan.parent, "stderr.txt"), result.stderr, { flag: "wx" });
  const stable = JSON.stringify(before) === JSON.stringify(after);
  const receipt = { result, before, after, sourceStable: stable, overallV1Complete: false };
  await writeFile(path.join(plan.parent, "process.json"), JSON.stringify(receipt, null, 2) + "\n", {
    flag: "wx",
  });
  return {
    directory: plan.parent,
    exit: result.exit_code,
    timedOut: result.timed_out,
    stopped: result.process_stopped,
    outputLimit: result.output_limit,
    sourceStable: stable,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runPerformance(process.argv.slice(2)).then(
    (result) => {
      process.stdout.write(JSON.stringify(result) + "\n");
      if (
        result.exit !== 0 ||
        result.timedOut ||
        !result.stopped ||
        result.outputLimit ||
        !result.sourceStable
      )
        process.exitCode = 1;
    },
    (error) => {
      process.stderr.write(String(error?.stack ?? error) + "\n");
      process.exitCode = 1;
    },
  );
}
