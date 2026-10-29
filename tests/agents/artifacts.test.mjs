import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRun, runTask } from "../../scripts/agents/engine.mjs";
import { validateArtifact } from "../../scripts/agents/contract.mjs";

test("generated repair, verification, and handoff artifacts conform to their actual schemas", async () => {
  const fixtures = path.resolve(".cache/agent-artifact-tests");
  mkdirSync(fixtures, { recursive: true });
  const root = mkdtempSync(path.join(fixtures, "fixture-"));
  const repository = path.join(root, "repository");
  const workspace = path.join(root, "workspace");
  const control = path.join(root, "control");
  mkdirSync(path.join(repository, "tests"), { recursive: true });
  mkdirSync(workspace, { recursive: true });
  writeFileSync(
    path.join(repository, "tests/acceptance.mjs"),
    `
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
assert.equal(readFileSync(path.join(process.argv[2], "result.txt"), "utf8"), "fixed");
`,
  );
  const state = createRun({
    repository,
    workspace,
    control,
    contract: {
      schema_version: 1,
      id: "artifact-fixture",
      wiki_task_id: "RLAB-TASK-0008",
      goal_id: "goal-artifact",
      milestone_id: "milestone-artifact",
      objective: "Produce fixed fixture text",
      allowed_files: ["result.txt"],
      acceptance: [{ id: "AC-01", script: "tests/acceptance.mjs" }],
      policy: { backoff_ms: 0 },
    },
    mockPlan: {
      MUSE: [
        { kind: "success", writes: [{ path: "result.txt", content: "broken" }] },
        { kind: "quota" },
      ],
    },
  });
  const repaired = await runTask({ control, runId: state.run_id, runner: "mock" });
  assert.equal(repaired.status, "HANDOFF_PENDING");
  assert.equal(repaired.repair_round, 1);
  const verification = JSON.parse(
    readFileSync(path.join(control, repaired.verification_evidence[0].path), "utf8"),
  );
  const repair = JSON.parse(readFileSync(path.join(control, repaired.repairs[0].path), "utf8"));
  assert.deepEqual(validateArtifact("verification-result", verification), verification);
  assert.deepEqual(validateArtifact("repair-task", repair), repair);
  const handoffState = await runTask({ control, runId: state.run_id, runner: "mock" });
  assert.equal(handoffState.status, "HANDOFF_PENDING");
  assert.equal(handoffState.resources.attempts, repaired.resources.attempts);
  const handoff = JSON.parse(
    readFileSync(path.join(control, handoffState.handoffs[0].path), "utf8"),
  );
  assert.deepEqual(validateArtifact("handoff", handoff), handoff);
  assert.equal(handoff.goal_id, "goal-artifact");
  assert.equal(handoff.milestone_id, "milestone-artifact");
  assert.equal(handoff.completed_acceptance_criteria.length, 0);
  assert.throws(() => validateArtifact("../task", handoff), { code: "ERR_ARTIFACT" });
  assert.throws(
    () => validateArtifact("verification-result", { ...verification, authority: "self-review" }),
    { code: "ERR_ARTIFACT" },
  );
});
