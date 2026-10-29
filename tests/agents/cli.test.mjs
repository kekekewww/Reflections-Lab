import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const cli = path.resolve("scripts/agents/cli.mjs");
function invoke(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000,
    windowsHide: true,
  });
}
function fixture() {
  mkdirSync(".cache/agent-cli-tests", { recursive: true });
  return mkdtempSync(path.resolve(".cache/agent-cli-tests/case-"));
}
test("CLI documents real commands and rejects unknown arguments", () => {
  const help = invoke(["help"]);
  assert.equal(help.status, 0, help.stderr);
  const doc = JSON.parse(help.stdout);
  assert.ok(doc.commands.init);
  assert.ok(doc.commands.acknowledge);
  assert.ok(doc.commands["export-wiki"]);
  const bad = invoke(["status", "--unknown", "value"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /UNKNOWN_OPTION/);
});
test("CLI init, run and resume preserve run identity and immutable Wiki export", () => {
  const base = fixture(),
    control = path.join(base, "control"),
    workspace = path.join(base, "workspace"),
    output = path.join(base, "projection.json");
  let out = invoke([
    "init",
    "--contract",
    "examples/agents/smoke-task.json",
    "--workspace",
    workspace,
    "--control",
    control,
    "--plan",
    "examples/agents/mock-plan.json",
  ]);
  assert.equal(out.status, 0, out.stderr);
  const runId = JSON.parse(out.stdout).run_id;
  out = invoke(["run", "--run", runId, "--control", control, "--runner", "mock"]);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout).status, "COMPLETED");
  out = invoke(["resume", "--run", runId, "--control", control, "--runner", "mock"]);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout).resource_usage.attempts, 2);
  out = invoke(["export-wiki", "--run", runId, "--control", control, "--output", output]);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(readFileSync(output, "utf8")).run_id, runId);
  out = invoke(["export-wiki", "--run", runId, "--control", control, "--output", output]);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /EEXIST/);
});
test("CLI milestone reuses completed task without duplicate work", () => {
  const base = fixture(),
    manifest = path.join(base, "milestone.json"),
    contract = path.resolve("examples/agents/smoke-task.json"),
    control = path.join(base, "control"),
    workspaces = path.join(base, "workspaces");
  writeFileSync(
    manifest,
    JSON.stringify({
      goal_id: "goal-harness-smoke",
      milestone_id: "milestone-harness-smoke",
      tasks: [contract],
    }),
  );
  const args = [
    "milestone",
    "--manifest",
    manifest,
    "--control",
    control,
    "--workspace-root",
    workspaces,
    "--runner",
    "mock",
    "--plan",
    "examples/agents/mock-plan.json",
  ];
  const first = invoke(args);
  assert.equal(first.status, 0, first.stderr);
  const a = JSON.parse(first.stdout);
  assert.equal(a.status, "COMPLETED");
  const second = invoke(args);
  assert.equal(second.status, 0, second.stderr);
  const b = JSON.parse(second.stdout);
  assert.deepEqual(b.run_ids, a.run_ids);
  assert.equal(b.completed_tasks, 1);
});

test("CLI milestone serializes actual concurrent callers", async () => {
  const base = fixture(),
    manifest = path.join(base, "milestone.json"),
    control = path.join(base, "control");
  writeFileSync(
    manifest,
    JSON.stringify({
      goal_id: "goal-harness-smoke",
      milestone_id: "milestone-harness-smoke",
      tasks: [path.resolve("examples/agents/smoke-task.json")],
    }),
  );
  const args = [
    cli,
    "milestone",
    "--manifest",
    manifest,
    "--control",
    control,
    "--workspace-root",
    path.join(base, "workspaces"),
    "--runner",
    "mock",
    "--plan",
    "examples/agents/mock-plan.json",
  ];
  const start = () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true });
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (bytes) => (stdout += bytes));
      child.stderr.on("data", (bytes) => (stderr += bytes));
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
  const results = await Promise.all([start(), start()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [0, 1]);
  assert.match(results.find((r) => r.status === 1).stderr, /MILESTONE_BUSY/);
  assert.equal(JSON.parse(results.find((r) => r.status === 0).stdout).completed_tasks, 1);
});

test("CLI run reports BLOCKED and HANDOFF_PENDING with nonzero exit codes", () => {
  for (const [name, plan, expectedStatus, expectedExit] of [
    ["auth", { MUSE: [{ kind: "auth" }] }, "BLOCKED", 1],
    ["quota", { MUSE: [{ kind: "quota" }] }, "HANDOFF_PENDING", 2],
  ]) {
    const base = fixture(),
      control = path.join(base, "control"),
      planFile = path.join(base, "plan.json");
    writeFileSync(planFile, JSON.stringify(plan));
    const init = invoke([
      "init",
      "--contract",
      "examples/agents/smoke-task.json",
      "--workspace",
      path.join(base, name),
      "--control",
      control,
      "--plan",
      planFile,
    ]);
    assert.equal(init.status, 0, init.stderr);
    const runId = JSON.parse(init.stdout).run_id;
    const result = invoke(["run", "--run", runId, "--control", control, "--runner", "mock"]);
    assert.equal(JSON.parse(result.stdout).status, expectedStatus);
    assert.equal(result.status, expectedExit, result.stdout);
    const status = invoke(["status", "--run", runId, "--control", control]);
    assert.equal(status.status, 0, "diagnostic status remains readable");
  }
});
test("CLI failure exit mapping cannot turn a failed demo into success", async () => {
  const module = await import("../../scripts/agents/cli.mjs");
  assert.equal(typeof module.exitCodeForResult, "function");
  assert.equal(module.exitCodeForResult("demo", { status: "FAIL" }), 1);
  assert.equal(module.exitCodeForResult("milestone", { status: "BLOCKED" }), 1);
  assert.equal(module.exitCodeForResult("run", { status: "HANDOFF_PENDING" }), 2);
  assert.equal(module.exitCodeForResult("status", { status: "BLOCKED" }), 0);
});

test("second CLI cooperatively cancels a running child and preserves checkpoint without fallback", async () => {
  const base = fixture(),
    control = path.join(base, "control"),
    planFile = path.join(base, "plan.json"),
    contractFile = path.join(base, "contract.json");
  const contract = JSON.parse(readFileSync("examples/agents/smoke-task.json", "utf8"));
  contract.policy.timeout_ms = 30000;
  writeFileSync(contractFile, JSON.stringify(contract));
  writeFileSync(
    planFile,
    JSON.stringify({
      MUSE: [
        { kind: "hang", writes: [{ path: "answer.mjs", content: "export const preserved=40;\n" }] },
      ],
      CODEX: [
        { kind: "success", writes: [{ path: "answer.mjs", content: "export const answer=42;\n" }] },
      ],
    }),
  );
  const init = invoke([
    "init",
    "--contract",
    contractFile,
    "--workspace",
    path.join(base, "workspace"),
    "--control",
    control,
    "--plan",
    planFile,
  ]);
  assert.equal(init.status, 0, init.stderr);
  const runId = JSON.parse(init.stdout).run_id;
  const child = spawn(
    process.execPath,
    [cli, "run", "--run", runId, "--control", control, "--runner", "mock"],
    { cwd: process.cwd(), windowsHide: true },
  );
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (b) => (stdout += b));
  child.stderr.on("data", (b) => (stderr += b));
  const completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  let running = false;
  for (let i = 0; i < 200; i++) {
    try {
      const state = JSON.parse(
        readFileSync(path.join(control, "runs", runId, "state.json"), "utf8"),
      );
      if (
        state.status === "RUNNING_MUSE" &&
        readFileSync(path.join(base, "workspace", "answer.mjs"), "utf8").includes("preserved=40")
      ) {
        running = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(running, "Mock child must actually run and write its partial edit before cancellation");
  const cancel = invoke([
    "cancel",
    "--run",
    runId,
    "--control",
    control,
    "--reason",
    "test cooperative cancellation",
  ]);
  assert.equal(cancel.status, 0, cancel.stderr);
  assert.equal(JSON.parse(cancel.stdout).requested, true);
  const ended = await completion;
  assert.equal(ended.code, 1, ended.stderr);
  const result = JSON.parse(ended.stdout);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blocked_reason, "CANCELLED");
  assert.equal(result.actual_executor, "MUSE");
  assert.equal(result.resource_usage.attempts, 1);
  assert.equal(result.handoffs.length, 0);
  const runDirectory = path.join(control, "runs", runId),
    logs = readdirSync(path.join(runDirectory, "logs")).map((name) =>
      JSON.parse(readFileSync(path.join(runDirectory, "logs", name), "utf8")),
    );
  assert.equal(logs.at(-1).cancelled, true);
  assert.equal(logs.at(-1).process_stopped, true);
  const checkpoints = readdirSync(path.join(runDirectory, "checkpoints"));
  assert.ok(checkpoints.length >= 2);
  assert.match(readFileSync(path.join(base, "workspace", "answer.mjs"), "utf8"), /preserved=40/);
});
