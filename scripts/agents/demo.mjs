import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRun, runTask, setResource, exportWiki } from "./engine.mjs";
import { sha } from "./store.mjs";

const good = () => ({
  kind: "success",
  writes: [{ path: "answer.mjs", content: "export const answer=42;\n" }],
});
export async function runDemo({ output, workspaceRoot }) {
  const root = path.resolve(output);
  if (existsSync(root)) throw new Error("DEMO_OUTPUT_EXISTS_USE_NEW_DIRECTORY");
  mkdirSync(root, { recursive: true });
  const workspaces = path.resolve(workspaceRoot ?? `.cache/agent-demo-workspaces/${randomUUID()}`);
  if (existsSync(workspaces)) throw new Error("DEMO_WORKSPACE_EXISTS_USE_NEW_DIRECTORY");
  mkdirSync(workspaces, { recursive: true });
  const control = path.join(root, "control"),
    repository = path.resolve(".");
  const base = {
    schema_version: 1,
    wiki_task_id: "RLAB-TASK-0008",
    goal_id: "goal-demo-failover",
    milestone_id: "milestone-demo-failover",
    objective: "Offline fixture: answer=42 verified by prewritten independent acceptance",
    allowed_files: ["answer.mjs"],
    acceptance: [{ id: "AC-ANSWER", script: "examples/agents/acceptance.mjs", args: [] }],
    policy: { backoff_ms: 1, max_backoff_ms: 20, max_elapsed_ms: 300000, timeout_ms: 5000 },
  };
  const scenarios = [
    ["normal", { MUSE: [good()] }, "COMPLETED", "MUSE"],
    ["temporary-429", { MUSE: [{ kind: "rate" }, good()] }, "COMPLETED", "MUSE"],
    ["quota", { MUSE: [{ kind: "quota" }], CODEX: [good()] }, "COMPLETED", "CODEX"],
    [
      "partial-edit",
      {
        MUSE: [
          {
            kind: "quota",
            writes: [{ path: "answer.mjs", content: "export const preserved=40;\n" }],
          },
        ],
        CODEX: [
          {
            kind: "success",
            writes: [{ path: "answer.mjs", append: "export const answer=42;\n" }],
          },
        ],
      },
      "COMPLETED",
      "CODEX",
    ],
    [
      "repair",
      {
        MUSE: [{ kind: "quota" }],
        CODEX: [
          {
            kind: "success",
            writes: [{ path: "answer.mjs", content: "export const answer=0;\n" }],
          },
          good(),
        ],
      },
      "COMPLETED",
      "CODEX",
    ],
    [
      "both-unavailable",
      { MUSE: [{ kind: "unavailable" }], CODEX: [{ kind: "unavailable" }] },
      "BLOCKED",
      "CODEX",
    ],
    ["product-runtime-exhausted", { MUSE: [good()] }, "COMPLETED", "MUSE"],
  ];
  const results = [];
  for (const [name, plan, expected, executor] of scenarios) {
    setResource({
      control,
      executor: "MUSE",
      status: "available",
      evidence: `Independent offline fixture setup for ${name}; previous run evidence retained`,
      mock: true,
    });
    setResource({
      control,
      executor: "CODEX",
      status: "available",
      evidence: `Independent offline fixture setup for ${name}; no real account availability asserted`,
      mock: true,
    });
    if (name === "product-runtime-exhausted")
      setResource({
        control,
        executor: "META_API",
        status: "exhausted",
        evidence: "Explicit offline credit-exhaustion simulation",
        mock: true,
      });
    const run = createRun({
      contract: { ...base, id: `DEMO-${name}` },
      workspace: path.join(workspaces, name),
      repository,
      control,
      mockPlan: plan,
    });
    const end = await runTask({ control, runId: run.run_id, runner: "mock" });
    let pass = end.status === expected && end.actual_executor === executor;
    if (name === "partial-edit")
      pass &&= readFileSync(path.join(end.workspace, "answer.mjs"), "utf8").includes(
        "preserved=40",
      );
    const projection = exportWiki({ control, runId: run.run_id });
    const projectionPath = path.join(root, `${name}.projection.json`);
    writeFileSync(projectionPath, JSON.stringify(projection, null, 2) + "\n", { flag: "wx" });
    results.push({
      scenario: name,
      status: pass ? "PASS" : "FAIL",
      run_id: run.run_id,
      run_status: end.status,
      actual_executor: end.actual_executor,
      fallback_reason: end.fallback_reason,
      attempts: end.resources.attempts,
      repair_rounds: end.repair_round,
      verification_evidence: end.verification_evidence,
      projection: { path: projectionPath, sha256: sha(readFileSync(projectionPath)) },
    });
  }
  setResource({
    control,
    executor: "MUSE",
    status: "available",
    evidence: "Explicit offline quota recovery at completed task boundary",
    mock: true,
  });
  const recovered = createRun({
    contract: { ...base, id: "DEMO-recovered-boundary" },
    workspace: path.join(workspaces, "recovered-boundary"),
    repository,
    control,
    mockPlan: { MUSE: [good()] },
  });
  const end = await runTask({ control, runId: recovered.run_id, runner: "mock" });
  results.push({
    scenario: "muse-recovery-safe-boundary",
    status: end.status === "COMPLETED" && end.actual_executor === "MUSE" ? "PASS" : "FAIL",
    run_id: end.run_id,
    run_status: end.status,
    actual_executor: end.actual_executor,
    attempts: end.resources.attempts,
  });
  const report = {
    schema_version: 1,
    validation_mode: "MOCK",
    status: results.every((r) => r.status === "PASS") ? "PASS" : "FAIL",
    recorded_at: new Date().toISOString(),
    output: root,
    workspace_root: workspaces,
    control,
    scenarios: results,
    live_validation: "NOT RUN",
    limitations: [
      "Processes implement deterministic fixtures; no Muse or Codex model inference occurred",
      "Product Meta API live tests remain BLOCKED in exhaustion fixture",
      "No automatic Git commit/push; snapshots retain null revision if no HEAD",
      "The fuller test suite covers all12requiredfailoverscenarios and adversarial cases",
    ],
  };
  writeFileSync(path.join(root, "report.json"), JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
  });
  return report;
}
