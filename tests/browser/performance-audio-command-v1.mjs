/* global process */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runProcess } from "../../scripts/agents/process-runner.mjs";
const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export async function runAudioCommand({
  executablePath,
  output,
  smoke = false,
  audioModel = "nativeReference",
}) {
  if (process.version !== "v22.17.0") throw new Error("EXACT_NODE_REQUIRED");
  if (process.env.RLAB_AUDIO_ATTRIBUTION_WORKER === "1")
    throw new Error("NESTED_CONTROLLED_AUDIO_WRAPPER");
  if (
    !executablePath ||
    !output ||
    !["nativeReference", "nativeCarrierRoutes"].includes(audioModel)
  )
    throw new Error("EXPLICIT_CONTROLLED_AUDIO_ARGUMENTS_REQUIRED");
  const directory = path.resolve(output);
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const files = [
    "tests/browser/performance-audio-command-v1.mjs",
    "tests/browser/performance-audio-runner-v1.mjs",
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
      "--max-old-space-size=768",
      path.join(root, "tests/browser/performance-audio-runner-v1.mjs"),
      "--executable-path",
      executablePath,
      "--output",
      path.join(directory, "native"),
      "--audio-model",
      audioModel,
      ...(smoke ? ["--smoke"] : []),
    ],
    cwd: root,
    env: { RLAB_AUDIO_ATTRIBUTION_WORKER: "1" },
    timeoutMs: smoke ? 90000 : 240000,
    maxOutputBytes: 8 * 1024 * 1024,
  };
  await writeFile(
    path.join(directory, "command.json"),
    JSON.stringify(
      {
        plan,
        sourceBefore: before,
        paidCalls: 0,
        formal600Run: false,
        formalQualification: "NOT_APPROVED",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  const result = await runProcess(plan),
    after = await snapshot();
  await writeFile(path.join(directory, "stdout.txt"), result.stdout, { flag: "wx" });
  await writeFile(path.join(directory, "stderr.txt"), result.stderr, { flag: "wx" });
  let child = null,
    childReceiptError = null;
  try {
    child = JSON.parse(await readFile(path.join(directory, "native", "verification.json"), "utf8"));
  } catch (error) {
    childReceiptError = String(error);
  }
  const forced = result.timed_out || result.cancelled || result.output_limit;
  const cleanupConfirmed =
    child?.cleanup?.browserConnected === false &&
    child?.cleanup?.previewStopped === true &&
    Array.isArray(child?.cleanup?.errors) &&
    child.cleanup.errors.length === 0;
  const machineLeaseReleasable =
    result.process_stopped === true &&
    (forced ? result.process_tree_stopped === true : cleanupConfirmed);
  const sourceStable = JSON.stringify(before) === JSON.stringify(after);
  const collectionCompleted =
    machineLeaseReleasable &&
    !forced &&
    sourceStable &&
    result.exit_code === 0 &&
    ["COLLECTED_DIGITAL_COMPONENT_EVIDENCE", "COLLECTED_WITH_NEGATIVE_RESULTS"].includes(
      child?.status,
    );
  const receipt = {
    result,
    before,
    after,
    sourceStable,
    childReceiptError,
    machineLeaseReleasable,
    collectionCompleted,
    childStatus: child?.status ?? null,
    processTreeStopped: result.process_tree_stopped,
    stopScope: result.stop_scope,
    formal600Run: false,
    formalQualification: "NOT_APPROVED",
    overallV1Complete: false,
  };
  await writeFile(path.join(directory, "process.json"), JSON.stringify(receipt, null, 2) + "\n", {
    flag: "wx",
  });
  return { directory, ...receipt, result: undefined, before: undefined, after: undefined };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--plan")
    process.stdout.write(
      JSON.stringify({
        smokeWatchdogMs: 90000,
        fullAbbaWatchdogMs: 240000,
        paidCalls: 0,
        formal600Run: false,
        formalQualification: "NOT_APPROVED",
      }) + "\n",
    );
  else {
    const options = {};
    let smoke = false;
    for (let index = 0; index < args.length; index++) {
      const key = args[index];
      if (key === "--smoke") {
        if (smoke) throw new Error("DUPLICATE_OPTION");
        smoke = true;
        continue;
      }
      const value = args[++index];
      if (
        !["--executable-path", "--output", "--audio-model"].includes(key) ||
        !value ||
        value.startsWith("--") ||
        options[key]
      )
        throw new Error("INVALID_CONTROLLED_AUDIO_CLI");
      options[key] = value;
    }
    const receipt = await runAudioCommand({
      executablePath: options["--executable-path"],
      output: options["--output"],
      audioModel: options["--audio-model"] ?? "nativeReference",
      smoke,
    });
    process.stdout.write(JSON.stringify(receipt) + "\n");
    if (!receipt.collectionCompleted || !receipt.machineLeaseReleasable) process.exitCode = 1;
  }
}
