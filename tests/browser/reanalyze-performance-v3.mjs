import { mkdir, writeFile, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runProcess } from "../../scripts/agents/process-runner.mjs";
export const REANALYSIS_SOURCES = [
  "tests/browser/reanalyze-performance-v3.mjs",
  "tests/browser/reanalyze-performance-v3-worker.mjs",
  "tests/browser/performance-native-v3.mjs",
  "tests/browser/performance-numeric-formal-v3.mjs",
  "tests/browser/performance-stream-v3.mjs",
  "tests/browser/performance-proof-v3.mjs",
  "tests/browser/performance-profile-v3.mjs",
  "tests/browser/performance-profile.mjs",
  "tests/browser/performance-owned-cleanup-v3.mjs",
  "scripts/agents/process-runner.mjs",
  "tests/performance-v3/reanalysis-cli.spec.mjs",
];
export const CAPTURE_FILES = [
  "verification.json",
  "ui.raw.json",
  "ui.trace.json.gz",
  "ui.trace-analysis.json",
];
export async function fileDigest(file) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest("hex"), bytes };
}
export async function snapshotFiles(root, names) {
  return Promise.all(
    names.map(async (name) => ({ path: name, ...(await fileDigest(path.join(root, name))) })),
  );
}
const inside = (base, target) => {
  const relative = path.relative(base, target);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};
export function planReanalysis(
  args,
  {
    cwd = process.cwd(),
    version = process.version,
    env = process.env,
    node = process.execPath,
  } = {},
) {
  if (version !== "v22.17.0") throw Error("EXACT_NODE_REQUIRED");
  if (env.RLAB_REANALYSIS_WORKER === "1") throw Error("NESTED_REANALYSIS");
  const values = new Map();
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    if (!["--capture", "--output"].includes(k)) throw Error("UNKNOWN_OPTION");
    if (values.has(k)) throw Error("DUPLICATE_OPTION");
    const v = args[++i];
    if (!v || v.startsWith("--")) throw Error("MISSING_OPTION_VALUE");
    values.set(k, v);
  }
  if (values.size !== 2) throw Error("CAPTURE_OUTPUT_REQUIRED");
  const base = path.resolve(cwd, "artifacts/v1"),
    capture = path.resolve(cwd, values.get("--capture")),
    output = path.resolve(cwd, values.get("--output"));
  if (
    !inside(base, capture) ||
    !inside(base, output) ||
    path.basename(capture) !== "native" ||
    inside(capture, output) ||
    inside(output, capture) ||
    capture === output
  )
    throw Error("PATH_CONTRACT");
  return {
    capture,
    output,
    cwd,
    file: node,
    args: [
      "--max-old-space-size=2560",
      path.resolve(cwd, "tests/browser/reanalyze-performance-v3-worker.mjs"),
      capture,
      output,
    ],
    timeoutMs: 420000,
    maxOutputBytes: 8 * 1024 * 1024,
    env: { RLAB_REANALYSIS_WORKER: "1" },
  };
}
export function verifyCaptureContract(report, analysis, inputs) {
  const files = new Map(inputs.map((x) => [x.path, x]));
  const declared = new Map((report.artifactFiles ?? []).map((x) => [x.path, x.sha256]));
  for (const n of ["ui.raw.json", "ui.trace.json.gz", "ui.trace-analysis.json"])
    if (!files.has(n) || declared.get(n) !== files.get(n).sha256)
      throw Error("CAPTURE_HASH_MISMATCH");
  const checkpoint = report.uiCheckpoint;
  if (
    !checkpoint ||
    checkpoint.sha256 !== files.get("ui.raw.json").sha256 ||
    checkpoint.bytes !== files.get("ui.raw.json").bytes
  )
    throw Error("CHECKPOINT_MISMATCH");
  const context = analysis.analysisContext;
  if (
    !context ||
    context.traceDataLoss !== false ||
    context.traceStreamClosed !== true ||
    !context.documentBefore ||
    !context.documentAfter
  )
    throw Error("MISSING_OR_INVALID_CONTEXT");
  if (analysis.status !== "UNVERIFIED" || !analysis.reasons?.includes("INPUT_CAP"))
    throw Error("ORIGINAL_ANALYSIS_NOT_INPUT_CAP");
  if (
    !report.host?.gitRevision ||
    !Array.isArray(report.metrics) ||
    !report.ui?.workloadValidity ||
    !Array.isArray(report.pageErrors)
  )
    throw Error("REPORT_SCHEMA");
  return context;
}
export async function runReanalysis(args) {
  const plan = planReanalysis(args),
    base = await realpath(path.resolve(plan.cwd, "artifacts/v1")),
    capture = await realpath(plan.capture),
    parent = await realpath(path.dirname(plan.output));
  if (
    !inside(base, capture) ||
    !inside(base, path.join(parent, path.basename(plan.output))) ||
    inside(capture, parent) ||
    capture === parent
  )
    throw Error("REALPATH_CONTRACT");
  await mkdir(plan.output, { recursive: false });
  const sourcesBefore = await snapshotFiles(plan.cwd, REANALYSIS_SOURCES),
    inputsBefore = await snapshotFiles(plan.capture, CAPTURE_FILES);
  await writeFile(
    path.join(plan.output, "command.json"),
    JSON.stringify({ ...plan, sourcesBefore, inputsBefore }, null, 2) + "\n",
    { flag: "wx" },
  );
  const result = await runProcess(plan);
  const sourcesAfter = await snapshotFiles(plan.cwd, REANALYSIS_SOURCES),
    inputsAfter = await snapshotFiles(plan.capture, CAPTURE_FILES);
  await writeFile(path.join(plan.output, "stdout.txt"), result.stdout, { flag: "wx" });
  await writeFile(path.join(plan.output, "stderr.txt"), result.stderr, { flag: "wx" });
  const sourceStable = JSON.stringify(sourcesBefore) === JSON.stringify(sourcesAfter),
    inputStable = JSON.stringify(inputsBefore) === JSON.stringify(inputsAfter);
  const receipt = {
    result,
    sourcesBefore,
    sourcesAfter,
    inputsBefore,
    inputsAfter,
    sourceStable,
    inputStable,
    retrospective: true,
    newCapture: false,
    overallV1Complete: false,
  };
  await writeFile(path.join(plan.output, "process.json"), JSON.stringify(receipt, null, 2) + "\n", {
    flag: "wx",
  });
  return {
    output: plan.output,
    exit: result.exit_code,
    timedOut: result.timed_out,
    stopped: result.process_stopped,
    outputLimit: result.output_limit,
    sourceStable,
    inputStable,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  runReanalysis(process.argv.slice(2)).then(
    (r) => {
      process.stdout.write(JSON.stringify(r) + "\n");
      if (
        r.exit !== 0 ||
        r.timedOut ||
        !r.stopped ||
        r.outputLimit ||
        !r.sourceStable ||
        !r.inputStable
      )
        process.exitCode = 1;
    },
    (e) => {
      process.stderr.write(String(e?.stack ?? e) + "\n");
      process.exitCode = 1;
    },
  );
