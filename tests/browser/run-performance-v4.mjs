/* global process */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseProfileOptionsV4 } from "./performance-cli-v4.mjs";
import { V4_METHOD_SOURCE_PATHS } from "./performance-method-v4.mjs";
import {
  PROFILE_METHOD_VERSION_V4,
  PROFILE_SCHEMA_VERSION_V4,
} from "./performance-profile-contract-v4.mjs";
import {
  APPROVED_QUALIFICATIONS_V4,
  resolveApprovedQualificationV4,
} from "./performance-approved-qualifications-v4.mjs";
import { runProcess } from "../../scripts/agents/process-runner.mjs";
import { semanticProcessOutcome as originalProcessOutcome } from "./performance-semantic-command-v1.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const scope = "FORMAL_V4_SEMANTIC_PRECONDITION";
export async function readCurrentSemanticPinsV4(cwd = root) {
  const paths = [...V4_METHOD_SOURCE_PATHS];
  return await Promise.all(
    paths.map(async (file) => {
      const bytes = await readFile(path.join(cwd, file));
      return { path: file, sha256: sha(bytes), bytes: bytes.length };
    }),
  );
}

export async function planPerformanceRunV4(
  args,
  {
    nodeVersion = process.version,
    nodePath = process.execPath,
    cwd = process.cwd(),
    environment = process.env,
    defaultOutput,
    hashExe = async (filename) => sha(await readFile(filename)),
    currentSourcePins = () => readCurrentSemanticPinsV4(cwd),
  } = {},
) {
  if (nodeVersion !== "v22.17.0") throw Error("EXACT_NODE_REQUIRED");
  if (environment.RLAB_PERF_WORKER === "1") throw Error("NESTED_PERFORMANCE_WRAPPER");
  const options = parseProfileOptionsV4(args);
  if (!options.executablePath) throw Error("V4_EXPLICIT_PINNED_EXECUTABLE_REQUIRED");
  let qualification = null;
  if (options.formal || options.qualificationId !== null) {
    const metadata = APPROVED_QUALIFICATIONS_V4.find(
      (record) => record.qualificationId === options.qualificationId,
    );
    if (!metadata) throw Error("V4_QUALIFICATION_REQUIRED_OR_UNKNOWN");
    qualification = await resolveApprovedQualificationV4({
      qualificationId: options.qualificationId,
      executableSha256: await hashExe(options.executablePath),
      producerRevision: metadata.producerRevision,
      sourcePins: await currentSourcePins(),
      requiredScope: scope,
    });
  }
  const parent = path.resolve(
    cwd,
    options.output ??
      defaultOutput ??
      `artifacts/v1/performance-v4-${new Date().toISOString().replace(/[:.]/g, "")}-${randomUUID().slice(0, 8)}`,
  );
  const forwarded = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--output") {
      index++;
      continue;
    }
    forwarded.push(args[index]);
  }
  return {
    methodVersion: PROFILE_METHOD_VERSION_V4,
    schemaVersion: PROFILE_SCHEMA_VERSION_V4,
    parent,
    native: path.join(parent, "native"),
    file: nodePath,
    args: [
      "--max-old-space-size=2560",
      path.resolve(cwd, "tests/browser/performance-profile-v4.mjs"),
      ...forwarded,
      "--output",
      path.join(parent, "native"),
    ],
    cwd,
    timeoutMs: options.formal ? 1380000 : 420000,
    maxOutputBytes: 8 * 1024 * 1024,
    env: { RLAB_PERF_WORKER: "1" },
    formal: options.formal,
    probeMode: options.probeMode,
    topMonitorMode: options.topMonitorMode,
    topMonitorInput: options.topMonitorInput,
    audioPolicyArm: options.audioPolicyArm,
    qualificationId: qualification?.qualificationId ?? null,
    requiredProducerRevision: qualification?.producerRevision ?? null,
    qualificationScope: qualification?.scope ?? null,
    formalRunApproved: false,
    paidCalls: 0,
  };
}

export function performanceProcessOutcomeV4(result, childVerification) {
  const cleanup = childVerification?.cleanup;
  // Preserve the frozen owned-process stop semantics. Audio/context endpoints
  // remain separate evidence; an exit code does not fabricate their closure.
  const stopped = originalProcessOutcome(result, {
    browserConnectedAfterCleanup: cleanup?.browserConnected,
    serverListeningAfterCleanup:
      cleanup?.previewProcessStopped === true ? cleanup?.previewListeningAfterCleanup : null,
    cleanupErrors: cleanup?.errors,
  });
  return {
    machineLeaseReleasable: stopped.machineLeaseReleasable,
    processTreeStopped: stopped.processTreeStopped,
    stopScope: stopped.stopScope,
    formalQualified:
      stopped.machineLeaseReleasable &&
      result?.exit_code === 0 &&
      result?.timed_out === false &&
      result?.cancelled === false &&
      result?.output_limit === false &&
      result?.spawn_error === null &&
      childVerification?.formalQualified === true,
    overallV1Complete: false,
  };
}

export async function runPerformanceV4(args) {
  const plan = await planPerformanceRunV4(args);
  await mkdir(path.dirname(plan.parent), { recursive: true });
  await mkdir(plan.parent);
  const sourcePaths = [...V4_METHOD_SOURCE_PATHS].sort();
  const snapshot = () =>
    Promise.all(
      sourcePaths.map(async (file) => ({
        path: file,
        sha256: sha(await readFile(path.join(plan.cwd, file))),
      })),
    );
  const before = await snapshot();
  await writeFile(
    path.join(plan.parent, "command.json"),
    JSON.stringify(
      {
        ...plan,
        source: before,
        qualificationMeaning:
          "Semantic precondition only; not a600s run, device, GUI, DSP or hearing approval",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  const result = await runProcess(plan),
    after = await snapshot();
  let childVerification = null,
    childVerificationError = null;
  try {
    childVerification = JSON.parse(
      await readFile(path.join(plan.native, "verification.json"), "utf8"),
    );
  } catch (error) {
    childVerificationError = String(error);
  }
  const sourceStable = JSON.stringify(before) === JSON.stringify(after);
  const outcome = performanceProcessOutcomeV4(result, childVerification);
  if (!sourceStable) outcome.formalQualified = false;
  await writeFile(path.join(plan.parent, "stdout.txt"), result.stdout, { flag: "wx" });
  await writeFile(path.join(plan.parent, "stderr.txt"), result.stderr, { flag: "wx" });
  await writeFile(
    path.join(plan.parent, "process.json"),
    JSON.stringify(
      {
        result,
        before,
        after,
        sourceStable,
        childVerificationError,
        outcome,
        overallV1Complete: false,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  return {
    directory: plan.parent,
    exit: result.exit_code,
    timedOut: result.timed_out,
    stopped: result.process_stopped,
    outputLimit: result.output_limit,
    sourceStable,
    ...outcome,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args[0] === "--plan")
    process.stdout.write(JSON.stringify(await planPerformanceRunV4(args.slice(1))) + "\n");
  else {
    const result = await runPerformanceV4(args);
    process.stdout.write(JSON.stringify(result) + "\n");
    if (
      result.exit !== 0 ||
      result.timedOut ||
      !result.stopped ||
      result.outputLimit ||
      !result.sourceStable ||
      !result.machineLeaseReleasable
    )
      process.exitCode = 1;
  }
}
