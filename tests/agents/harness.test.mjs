import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const loaded = await import("../../scripts/agents/engine.mjs").catch(() => ({}));
const setup = (plan = {}, overrides = {}) => {
  assert.equal(typeof loaded.createRun, "function", "Harness createRun must exist");
  mkdirSync(".cache/agent-tests", { recursive: true });
  const base = mkdtempSync(path.resolve(".cache/agent-tests/rlab-harness-"));
  const workspace = path.join(base, "workspace"),
    repository = path.join(base, "repository"),
    control = path.join(base, "control");
  mkdirSync(workspace);
  mkdirSync(repository);
  writeFileSync(
    path.join(repository, "accept.mjs"),
    `import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import path from 'node:path';const p=path.join(process.argv[2],'answer.mjs');const m=await import(pathToFileURL(p));if(m.answer!==42)process.exit(1);console.log('independent reference:42');`,
  );
  const contract = {
    schema_version: 1,
    id: "HARNESS-SMOKE",
    wiki_task_id: "RLAB-TASK-0008",
    goal_id: "goal-keep",
    milestone_id: "milestone-keep",
    objective: "Produce independently checked answer",
    allowed_files: ["answer.mjs"],
    acceptance: [{ id: "AC-1", script: "accept.mjs", args: [] }],
    policy: {
      backoff_ms: 1,
      max_backoff_ms: 20,
      timeout_ms: 2000,
      max_elapsed_ms: 60000,
      ...overrides,
    },
  };
  const state = loaded.createRun({ contract, workspace, repository, control, mockPlan: plan });
  return { base, workspace, repository, control, state, run_id: state.run_id };
};
const action = (kind, writes) => ({ kind, writes });
const good = () =>
  action("success", [{ path: "answer.mjs", content: "export const answer=42;\n" }]);
const run = async (s) => loaded.runTask({ control: s.control, runId: s.run_id, runner: "mock" });

test("normal Muse completion requires independent reference test and immutable result", async () => {
  const s = setup({ MUSE: [good()] });
  const out = await run(s);
  assert.equal(out.status, "COMPLETED");
  assert.equal(out.actual_executor, "MUSE");
  assert.equal(out.verification_evidence.at(-1).status, "PASS");
  assert.equal(out.goal_id, "goal-keep");
  assert.equal(out.resources.attempts, 1);
  assert.equal((await run(s)).resources.attempts, 1, "completed task must not repeat");
});
test("429 retries with bounded backoff before fallback", async () => {
  const s = setup({ MUSE: [action("rate"), good()] });
  const out = await run(s);
  assert.equal(out.status, "COMPLETED");
  assert.equal(out.actual_executor, "MUSE");
  assert.equal(out.resources.attempts, 2);
  assert.equal(out.fallback_reason, null);
});
test("confirmed Muse quota stops dispatch and hands off to Codex same task", async () => {
  const s = setup({ MUSE: [action("quota")], CODEX: [good()] });
  const out = await run(s);
  assert.equal(out.status, "COMPLETED");
  assert.equal(out.actual_executor, "CODEX");
  assert.equal(out.previous_executor, "MUSE");
  assert.equal(out.fallback_reason, "QUOTA_EXHAUSTED");
  assert.equal(out.goal_id, "goal-keep");
  assert.equal(out.milestone_id, "milestone-keep");
  assert.ok(out.handoffs.length);
  assert.equal(out.resources.attempts, 2);
});
test("confirmed live subscription exhaustion routes to current Codex before any Muse process", async () => {
  const s = setup({ MUSE: [good()] });
  loaded.setResource({
    control: s.control,
    executor: "MUSE",
    status: "exhausted",
    remaining: 0,
    evidence: "Unit fixture: operator-confirmed development subscription exhaustion",
    mock: false,
  });
  const state = loaded.createRun({
    contract: { ...s.state.contract, id: "CONFIRMED-EXHAUSTED" },
    workspace: path.join(s.base, "live-route-workspace"),
    repository: s.repository,
    control: s.control,
  });
  const routed = await loaded.runTask({ control: s.control, runId: state.run_id, runner: "muse" });
  assert.equal(routed.status, "HANDOFF_PENDING");
  assert.equal(routed.fallback_reason, "QUOTA_EXHAUSTED");
  assert.equal(routed.resources.attempts, 0);
  assert.equal(routed.model_provenance.length, 0);
  assert.equal(routed.validation_mode, "LIVE_NOT_RUN");
  assert.equal(
    loaded.exportWiki({ control: s.control, runId: state.run_id }).resource_status.META_API.status,
    "unknown",
  );
  const ack = loaded.acknowledgeCodex({
    control: s.control,
    runId: state.run_id,
    handoffHash: routed.handoffs.at(-1).sha256,
  });
  assert.equal(ack.actual_executor, "CODEX");
  assert.equal(ack.model_provenance.at(-1).execution_mode, "CURRENT_ORCHESTRATOR");
  assert.equal(ack.model_provenance.at(-1).model, null);
});
test("partial Muse edit is captured then Codex appends without redoing completed work", async () => {
  const s = setup({
    MUSE: [action("quota", [{ path: "answer.mjs", content: "export const preserved=40;\n" }])],
    CODEX: [action("success", [{ path: "answer.mjs", append: "export const answer=42;\n" }])],
  });
  const out = await run(s);
  assert.equal(out.status, "COMPLETED");
  assert.match(readFileSync(path.join(s.workspace, "answer.mjs"), "utf8"), /preserved=40/);
  assert.ok(out.checkpoints.some((c) => c.reason === "before-fallback"));
});
test("failed acceptance creates repair task and reruns original immutable test", async () => {
  const s = setup({
    MUSE: [action("quota")],
    CODEX: [action("success", [{ path: "answer.mjs", content: "export const answer=0;" }]), good()],
  });
  const out = await run(s);
  assert.equal(out.status, "COMPLETED");
  assert.equal(out.repairs.length, 1);
  assert.equal(out.verification_evidence.length, 2);
  assert.equal(out.verification_evidence[0].status, "FAIL");
});
test("bounded repair budget blocks repeated defect", async () => {
  const bad = action("success", [{ path: "answer.mjs", content: "export const answer=0;" }]);
  const s = setup({ MUSE: [bad, bad, bad] }, { max_repairs: 1 });
  const out = await run(s);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.resources.attempts, 2);
  assert.equal(out.blocked_reason, "REPAIR_BUDGET_EXHAUSTED");
});
test("both executors unavailable stops without dropping workspace", async () => {
  const s = setup({ MUSE: [action("unavailable")], CODEX: [action("unavailable")] });
  const out = await run(s);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.resources.attempts, 2);
  assert.equal(out.blocked_reason, "EXECUTOR_UNAVAILABLE");
  assert.ok(existsSync(s.workspace));
});
test("resource recovery switches preference only at completed task boundary", async () => {
  const s = setup({ MUSE: [action("quota")], CODEX: [good()] });
  const out = await run(s);
  loaded.setResource({
    control: s.control,
    executor: "MUSE",
    status: "available",
    evidence: "offline recovery fixture",
    mock: true,
  });
  assert.equal(loaded.readStatus({ control: s.control, runId: s.run_id }).actual_executor, "CODEX");
  const next = loaded.createRun({
    contract: { ...out.contract, id: "NEXT" },
    workspace: s.workspace,
    repository: s.repository,
    control: s.control,
    mockPlan: { MUSE: [good()] },
  });
  assert.equal(
    (await loaded.runTask({ control: s.control, runId: next.run_id, runner: "mock" }))
      .actual_executor,
    "MUSE",
  );
});
test("workspace lease prevents concurrent executor run and duplicate assignment", async () => {
  const s = setup({ MUSE: [good()] });
  assert.throws(
    () =>
      loaded.createRun({
        contract: s.state.contract,
        workspace: s.workspace,
        repository: s.repository,
        control: s.control,
      }),
    /WORKSPACE_BUSY/,
  );
  await run(s);
});
test("product Meta exhaustion preserves development and records offline provenance", async () => {
  const s = setup({ MUSE: [good()] });
  loaded.setResource({
    control: s.control,
    executor: "META_API",
    status: "exhausted",
    evidence: "mock credit exhausted",
    mock: true,
  });
  const out = await run(s);
  assert.equal(out.status, "COMPLETED");
  assert.equal(out.actual_executor, "MUSE");
  const projection = loaded.exportWiki({ control: s.control, runId: s.run_id });
  assert.equal(projection.product_runtime.status, "exhausted");
  assert.equal(projection.product_runtime.live_tests, "BLOCKED");
  assert.equal(projection.validation_mode, "MOCK");
});
test("acceptance tampering blocks instead of treating executor report as success", async () => {
  const s = setup({ MUSE: [good()] });
  writeFileSync(path.join(s.repository, "accept.mjs"), "process.exit(0)");
  const out = await run(s);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.blocked_reason, "ACCEPTANCE_INTEGRITY_CHANGED");
  assert.equal(out.resources.attempts, 0);
});
test("authentication and unknown error are not quota and never auto fallback", async () => {
  for (const kind of ["auth", "unknown"]) {
    const s = setup({ MUSE: [action(kind)], CODEX: [good()] });
    const out = await run(s);
    assert.equal(out.status, "BLOCKED");
    assert.equal(out.actual_executor, "MUSE");
    assert.equal(out.fallback_reason, null);
    assert.equal(out.resources.attempts, 1);
  }
});
test("manual Codex fallback reserves workspace and verifies after explicit handoff ack", async () => {
  const s = setup({ MUSE: [action("quota")] });
  const out = await run(s);
  assert.equal(out.status, "HANDOFF_PENDING");
  assert.throws(
    () => loaded.acknowledgeCodex({ control: s.control, runId: s.run_id, handoffHash: "wrong" }),
    /HANDOFF_HASH/,
  );
  const ack = loaded.acknowledgeCodex({
    control: s.control,
    runId: s.run_id,
    handoffHash: out.handoffs.at(-1).sha256,
  });
  assert.equal(ack.status, "RUNNING_CODEX");
  writeFileSync(path.join(s.workspace, "answer.mjs"), "export const answer=42;\n");
  const verified = await loaded.verifyTask({ control: s.control, runId: s.run_id });
  assert.equal(verified.status, "COMPLETED");
  assert.equal(verified.actual_executor, "CODEX");
  assert.equal(verified.verification_evidence.at(-1).authority, "independent-node-runner");
});
test("two control roots cannot reserve one workspace", () => {
  const s = setup({ MUSE: [good()] });
  assert.throws(
    () =>
      loaded.createRun({
        contract: s.state.contract,
        workspace: s.workspace,
        repository: s.repository,
        control: path.join(s.base, "other-control"),
      }),
    /WORKSPACE_BUSY/,
  );
});
test("executor cannot claim the canonical workspace lock as a writable file", () => {
  const s = setup({ MUSE: [good()] });
  assert.throws(
    () =>
      loaded.createRun({
        contract: {
          ...s.state.contract,
          id: "BAD-LOCK",
          allowed_files: [".reflection-agent.lock"],
        },
        workspace: path.join(s.base, "another-workspace"),
        repository: s.repository,
        control: s.control,
      }),
    /Unsafe|reserved/,
  );
});
test("handoff ack rejects altered checkpoint or unreviewed partial edits", async () => {
  const s = setup({ MUSE: [action("quota")] });
  const out = await run(s);
  writeFileSync(path.join(s.workspace, "answer.mjs"), "export const unreviewed=99;");
  assert.throws(
    () =>
      loaded.acknowledgeCodex({
        control: s.control,
        runId: s.run_id,
        handoffHash: out.handoffs.at(-1).sha256,
      }),
    /STALE_HANDOFF_WORKSPACE/,
  );
});
test("completed cache is historical and refuses to validate changed current content", async () => {
  const s = setup({ MUSE: [good()] });
  await run(s);
  writeFileSync(path.join(s.workspace, "answer.mjs"), "export const answer=0;");
  await assert.rejects(run(s), /COMPLETED_WORKSPACE_CHANGED/);
  await assert.rejects(
    loaded.verifyTask({ control: s.control, runId: s.run_id }),
    /COMPLETED_WORKSPACE_CHANGED/,
  );
  assert.throws(
    () => loaded.exportWiki({ control: s.control, runId: s.run_id }),
    /COMPLETED_WORKSPACE_CHANGED/,
  );
  assert.equal(
    loaded.readStatus({ control: s.control, runId: s.run_id }).current_validation.valid,
    false,
  );
  assert.throws(
    () => loaded.checkpointTask({ control: s.control, runId: s.run_id }),
    /COMPLETED_WORKSPACE_CHANGED/,
  );
  assert.throws(
    () => loaded.handoffTask({ control: s.control, runId: s.run_id }),
    /HANDOFF_STATE_UNSAFE/,
  );
});
test("secret-bearing file content is hashed but never stored in snapshots", async () => {
  const s = setup({ MUSE: [action("quota")] });
  const handoff = await run(s);
  loaded.acknowledgeCodex({
    control: s.control,
    runId: s.run_id,
    handoffHash: handoff.handoffs.at(-1).sha256,
  });
  writeFileSync(path.join(s.workspace, "answer.mjs"), "const api_key='sk-abcdef123456789';");
  const out = await loaded.verifyTask({ control: s.control, runId: s.run_id });
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.blocked_reason, "SECRET_CONTENT_DETECTED");
  for (const cp of out.checkpoints) {
    const body = readFileSync(path.join(s.control, cp.path), "utf8");
    assert.ok(!body.includes("sk-abcdef123456789"));
    assert.ok(
      !body.includes(Buffer.from("const api_key='sk-abcdef123456789';").toString("base64")),
    );
  }
});
