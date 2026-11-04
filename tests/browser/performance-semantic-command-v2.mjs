/* global process */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runProcess } from "../../scripts/agents/process-runner.mjs";
import { semanticProcessOutcome as originalSemanticProcessOutcome } from "./performance-semantic-command-v1.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const SEMANTIC_PROCESS_LIMIT_MS = 55000;
export function semanticProcessOutcome(result, childVerification) {
  const original = originalSemanticProcessOutcome(result, childVerification);
  return {
    ...original,
    pilotSucceeded: original.pilotSucceeded && childVerification?.numericCoverageComplete === true,
  };
}
export async function runSemanticCommandV2({ executablePath, output }) {
  if (process.version !== "v22.17.0") throw new Error("EXACT_NODE_REQUIRED");
  if (process.env.RLAB_SEMANTIC_WORKER === "1") throw new Error("NESTED_SEMANTIC_WRAPPER");
  if (!executablePath || !output)
    throw new Error("SEMANTIC_EXPLICIT_EXECUTABLE_AND_NEW_OUTPUT_REQUIRED");
  const directory = path.resolve(output);
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const files = [
    "tests/browser/performance-semantic-command-v2.mjs",
    "tests/browser/performance-semantic-command-v1.mjs",
    "tests/browser/performance-semantic-runner-v2.mjs",
    "scripts/agents/process-runner.mjs",
  ];
  const snapshot = () =>
    Promise.all(
      files.map(async (file) => ({
        path: file,
        sha256: createHash("sha256")
          .update(await readFile(path.join(root, file)))
          .digest("hex"),
      })),
    );
  const before = await snapshot();
  const plan = {
    file: process.execPath,
    args: [
      "--max-old-space-size=512",
      path.join(root, "tests/browser/performance-semantic-runner-v2.mjs"),
      "--executable-path",
      executablePath,
      "--output",
      path.join(directory, "native"),
    ],
    cwd: root,
    env: { RLAB_SEMANTIC_WORKER: "1" },
    timeoutMs: SEMANTIC_PROCESS_LIMIT_MS,
    maxOutputBytes: 8 * 1024 * 1024,
  };
  await writeFile(
    path.join(directory, "command.json"),
    JSON.stringify(
      {
        plan,
        source: before,
        scope:
          "45s operation + shared 10s cleanup; hard owned-child watchdog, never formal performance approval",
        paidCalls: 0,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  const result = await runProcess(plan);
  const after = await snapshot();
  let childVerification = null,
    childVerificationError = null;
  try {
    childVerification = JSON.parse(
      await readFile(path.join(directory, "native", "verification.json"), "utf8"),
    );
  } catch (error) {
    childVerificationError = String(error);
  }
  const sourceStable = JSON.stringify(before) === JSON.stringify(after);
  const observedOutcome = semanticProcessOutcome(result, childVerification);
  const outcome = {
    ...observedOutcome,
    pilotSucceeded: observedOutcome.pilotSucceeded && sourceStable,
  };
  await writeFile(path.join(directory, "stdout.txt"), result.stdout, { flag: "wx" });
  await writeFile(path.join(directory, "stderr.txt"), result.stderr, { flag: "wx" });
  await writeFile(
    path.join(directory, "process.json"),
    JSON.stringify(
      {
        result,
        before,
        after,
        sourceStable,
        outcome,
        childVerificationError,
        formalQualification: "NOT_APPROVED",
        formal600Run: false,
        overallV1Complete: false,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  return {
    directory,
    exitCode: result.exit_code,
    timedOut: result.timed_out,
    processStopped: result.process_stopped,
    ...outcome,
    outputLimit: result.output_limit,
    sourceStable,
    formalQualification: "NOT_APPROVED",
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--plan")
    process.stdout.write(
      JSON.stringify({
        timeoutMs: SEMANTIC_PROCESS_LIMIT_MS,
        paidCalls: 0,
        formalQualification: "NOT_APPROVED",
      }) + "\n",
    );
  else {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i],
        value = args[i + 1];
      if (
        !["--executable-path", "--output"].includes(key) ||
        !value ||
        value.startsWith("--") ||
        options[key]
      )
        throw new Error("INVALID_SEMANTIC_WRAPPER_CLI");
      options[key] = value;
    }
    const result = await runSemanticCommandV2({
      executablePath: options["--executable-path"],
      output: options["--output"],
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    if (
      result.exitCode !== 0 ||
      result.timedOut ||
      !result.processStopped ||
      result.outputLimit ||
      !result.sourceStable ||
      !result.pilotSucceeded ||
      !result.machineLeaseReleasable
    )
      process.exitCode = 1;
  }
}
