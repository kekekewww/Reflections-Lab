import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRun, runTask } from "./engine.mjs";
import { loadContract } from "./contract.mjs";
import { atomic } from "./store.mjs";
import { withCancellation } from "./cancellation.mjs";

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export async function runMilestone({
  manifestPath,
  workspaceRoot,
  control,
  repository = process.cwd(),
  runner = "muse",
  mockPlan,
  signal,
}) {
  const raw = readFileSync(manifestPath),
    manifest = JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, ""));
  if (
    !manifest ||
    !idPattern.test(manifest.goal_id) ||
    !idPattern.test(manifest.milestone_id) ||
    !Array.isArray(manifest.tasks) ||
    manifest.tasks.length < 1 ||
    manifest.tasks.length > 100 ||
    Object.keys(manifest).some((k) => !["goal_id", "milestone_id", "tasks"].includes(k)) ||
    manifest.tasks.some((t) => typeof t !== "string")
  )
    throw new Error("INVALID_MILESTONE_MANIFEST");
  const contracts = manifest.tasks.map((t) =>
    loadContract(path.resolve(path.dirname(path.resolve(manifestPath)), t)),
  );
  if (
    contracts.some(
      (t) => t.goal_id !== manifest.goal_id || t.milestone_id !== manifest.milestone_id,
    ) ||
    new Set(contracts.map((t) => t.id)).size !== contracts.length
  )
    throw new Error("MILESTONE_CONTRACT_MISMATCH");
  const manifestHash = createHash("sha256").update(raw).digest("hex"),
    directory = path.join(path.resolve(control), "milestones");
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${manifest.goal_id}.${manifest.milestone_id}.json`);
  const lockFile = `${file}.lock`,
    token = randomUUID();
  try {
    writeFileSync(
      lockFile,
      JSON.stringify({ pid: process.pid, token, manifest_sha256: manifestHash }) + "\n",
      { flag: "wx" },
    );
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("MILESTONE_BUSY");
    throw error;
  }
  try {
    let state = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : {
          schema_version: 1,
          goal_id: manifest.goal_id,
          milestone_id: manifest.milestone_id,
          manifest_sha256: manifestHash,
          run_ids: [],
          completed_tasks: 0,
          status: "PENDING",
          created_at: new Date().toISOString(),
        };
    if (state.manifest_sha256 !== manifestHash) throw new Error("MILESTONE_MANIFEST_CHANGED");
    if (!existsSync(file))
      writeFileSync(file, JSON.stringify(state, null, 2) + "\n", { flag: "wx" });
    for (let i = 0; i < contracts.length; i++) {
      let runId = state.run_ids[i];
      if (!runId) {
        const run = createRun({
          contract: contracts[i],
          workspace: path.resolve(workspaceRoot, contracts[i].id),
          control,
          repository,
          mockPlan,
        });
        runId = run.run_id;
        state.run_ids[i] = runId;
        atomic(file, state);
      }
      const result = await withCancellation({ control, runId, signal }, (childSignal) =>
        runTask({ control, runId, runner, signal: childSignal }),
      );
      state.status = result.status;
      state.updated_at = new Date().toISOString();
      state.completed_tasks = i + (result.status === "COMPLETED" ? 1 : 0);
      atomic(file, state);
      if (result.status !== "COMPLETED") return state;
    }
    state.status = "COMPLETED";
    atomic(file, state);
    return state;
  } finally {
    if (existsSync(lockFile) && JSON.parse(readFileSync(lockFile, "utf8")).token === token)
      unlinkSync(lockFile);
  }
}
