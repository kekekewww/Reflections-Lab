import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRun, exportWiki, checkpointTask } from "../../scripts/agents/engine.mjs";
import { writeAgentProjection } from "../../scripts/wiki/agent-projection.mjs";

const base = fileURLToPath(new URL("../../.cache/phase3/projection-tests/", import.meta.url));
const wikiCli = fileURLToPath(new URL("../../scripts/wiki/cli.mjs", import.meta.url));
function fixture() {
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(path.join(base, "case-"));
  const put = (relative, value) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  };
  const date = new Date().toISOString();
  for (const folder of ["sources", "tasks", "events", "wiki/handoffs"])
    mkdirSync(path.join(root, "knowledge", folder), { recursive: true });
  put("knowledge/sources/manifest.json", { schema_version: 1, sources: [] });
  for (const name of ["index", "now"])
    put(
      `knowledge/wiki/${name}.md`,
      `---\n${JSON.stringify({ id: `KB-${name}`, title: name, type: name === "now" ? "state" : "index", status: "ACCEPTED", created_at: date, updated_at: date, sources: [], related_tasks: [], related_decisions: [], supersedes: [], tags: [] })}\n---\n# ${name}\n`,
    );
  put("knowledge/tasks/RLAB-TASK-0008.json", {
    id: "RLAB-TASK-0008",
    title: "Harness",
    description: "Fixture",
    status: "READY",
    priority: "P0",
    owner: null,
    dependencies: [],
    acceptance_criteria: [
      { id: "AC-01", text: "Independent evidence required", verified: false, evidence: [] },
    ],
    relevant_files: [],
    evidence: [],
    created_at: date,
    updated_at: date,
  });
  put("acceptance/check.mjs", "process.exitCode = 0;\n");
  mkdirSync(path.join(root, "workspace"), { recursive: true });
  mkdirSync(path.join(root, "artifacts/control"), { recursive: true });
  const control = path.join(root, "artifacts/control");
  const run = createRun({
    repository: root,
    workspace: path.join(root, "workspace"),
    control,
    contract: {
      schema_version: 1,
      id: "TASK-01",
      wiki_task_id: "RLAB-TASK-0008",
      goal_id: "GOAL-01",
      milestone_id: "MILESTONE-01",
      objective: "Fixture",
      allowed_files: ["result.mjs"],
      acceptance: [{ id: "AC-01", script: "acceptance/check.mjs" }],
    },
  });
  return { root, control, run, put };
}
function wiki(root, args) {
  const result = spawnSync(
    process.execPath,
    [wikiCli, ...args, "--root", root, "--format", "json"],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

test("actual Harness export maps into Wiki task update with immutable state evidence", () => {
  const { root, control, run } = fixture();
  const projection = exportWiki({ control, runId: run.run_id });
  const patch = writeAgentProjection({
    root,
    control,
    projection,
    output: "artifacts/wiki-run.json",
  });
  const originalSnapshot = readFileSync(
    path.join(root, patch.agent_execution.run_state_path),
    "utf8",
  );
  const claim = wiki(root, [
    "task",
    "claim",
    "RLAB-TASK-0008",
    "--agent",
    "codex",
    "--session",
    "projection",
  ]);
  const args = [
    "task",
    "update",
    "RLAB-TASK-0008",
    "--agent",
    "codex",
    "--session",
    "projection",
    "--token",
    claim.token,
    "--file",
    "artifacts/wiki-run.json",
  ];
  const updated = wiki(root, args);
  assert.equal(updated.task.agent_execution.run_id, run.run_id);
  assert.equal(updated.task.agent_execution.run_state, "PENDING");
  assert.equal(updated.task.status, "IN_PROGRESS");
  assert.equal(updated.task.acceptance_criteria[0].verified, false);
  checkpointTask({ control, runId: run.run_id, reason: "later-event" });
  assert.equal(
    readFileSync(path.join(root, patch.agent_execution.run_state_path), "utf8"),
    originalSnapshot,
  );
  wiki(root, args);
  assert.throws(() =>
    writeAgentProjection({ root, control, projection, output: "artifacts/wiki-run.json" }),
  );
});

test("projection rejects stale source hashes and external output before writing", () => {
  const { root, control, run } = fixture();
  const projection = exportWiki({ control, runId: run.run_id });
  assert.throws(() =>
    writeAgentProjection({
      root,
      control,
      projection: { ...projection, run_state_sha256: "0".repeat(64) },
      output: "artifacts/bad.json",
    }),
  );
  assert.equal(existsSync(path.join(root, "artifacts/bad.json")), false);
  assert.throws(() =>
    writeAgentProjection({ root, control, projection, output: "../outside.json" }),
  );
  assert.throws(() =>
    writeAgentProjection({ root, control, projection, output: "knowledge/tasks/forged.json" }),
  );
});
