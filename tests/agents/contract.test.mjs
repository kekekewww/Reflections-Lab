import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateContract, loadContract } from "../../scripts/agents/contract.mjs";

const minimal = () => ({
  schema_version: 1,
  id: "P0-01",
  wiki_task_id: "RLAB-TASK-0008",
  goal_id: "goal-harness",
  milestone_id: "milestone-harness",
  objective: "Complete only the isolated fixture",
  allowed_files: ["src/result.mjs"],
  acceptance: [{ id: "AC-01", script: "tests/acceptance/result.mjs", args: [] }],
});

test("task contract defaults preserve identity and never mutate caller input", () => {
  const input = minimal();
  const normalized = validateContract(input);
  assert.equal(normalized.preferred_executor, "MUSE");
  assert.equal(normalized.fallback_executor, "CODEX");
  assert.equal(normalized.policy.development.max_paid_usd, 0);
  assert.equal(normalized.policy.product_runtime.max_paid_usd, 0);
  assert.equal(normalized.policy.max_repairs, 3);
  assert.equal(normalized.policy.max_rate_retries, 2);
  assert.equal(normalized.goal_id, input.goal_id);
  assert.deepEqual(normalized.remaining_work, []);
  assert.equal(input.policy, undefined);
});

test("unknown fields, unconstrained schemas, and invalid types are rejected", () => {
  for (const patch of [
    { command: "rm -rf" },
    { schema_version: "1" },
    { id: "../task" },
    { objective: "" },
    { preferred_executor: "UNAUTHORIZED_ACCOUNT" },
    { acceptance: [] },
    { acceptance: [{ id: "AC-01", script: "tests/a.mjs", command: "anything" }] },
  ]) {
    assert.throws(() => validateContract({ ...minimal(), ...patch }), { code: "ERR_CONTRACT" });
  }
});

test("descriptive context is retained without shadowing execution authority", () => {
  const context = {
    title: "P0 fixture",
    scope: ["Only fixture"],
    out_of_scope: ["Product runtime"],
    architecture_refs: ["docs/02-architecture/ARCHITECTURE.md"],
    skill_refs: [".agents/skills/agent-orchestration/SKILL.md"],
    allowed_operations: ["edit declared source file"],
    forbidden_operations: ["change tests"],
    model_profile: "muse-short-coding",
    expected_deliverables: ["verified fixture"],
  };
  const contract = validateContract({ ...minimal(), ...context });
  for (const [key, value] of Object.entries(context)) assert.deepEqual(contract[key], value);
  for (const alias of [
    "resource_budget",
    "max_model_steps",
    "max_repair_rounds",
    "verification_commands",
    "task_status",
  ]) {
    assert.throws(() => validateContract({ ...minimal(), [alias]: "do not shadow policy" }), {
      code: "ERR_CONTRACT",
    });
  }
});

test("path aliases, traversal, absolute paths, and secret or Git paths fail closed", () => {
  for (const file of [
    "../outside.mjs",
    "./src/a.mjs",
    "src/../a.mjs",
    "src//a.mjs",
    "src\\a.mjs",
    "C:/secret.mjs",
    "/tmp/a.mjs",
    "src/name:stream",
    "src/a. ",
    "src/a.",
    ".git/config",
    ".env",
    ".env.production",
    "keys/id_rsa",
    "keys/private.pem",
    "keys/token.key",
    "src/CON",
    "src/aux.txt",
    "src/a\u0000.mjs",
  ]) {
    assert.throws(
      () => validateContract({ ...minimal(), allowed_files: [file] }),
      { code: "ERR_CONTRACT" },
      file,
    );
  }
  assert.throws(
    () => validateContract({ ...minimal(), allowed_files: ["src/a.mjs", "SRC/A.mjs"] }),
    { code: "ERR_CONTRACT" },
  );
});

test("acceptance and protected files cannot be writable and script identities are unique", () => {
  assert.throws(() => validateContract({ ...minimal(), protected_files: ["src/result.mjs"] }), {
    code: "ERR_CONTRACT",
  });
  assert.throws(
    () => validateContract({ ...minimal(), allowed_files: ["tests/acceptance/result.mjs"] }),
    { code: "ERR_CONTRACT" },
  );
  assert.throws(
    () =>
      validateContract({
        ...minimal(),
        acceptance: [
          { id: "AC-01", script: "tests/a.mjs" },
          { id: "AC-01", script: "tests/b.mjs" },
        ],
      }),
    { code: "ERR_CONTRACT" },
  );
  assert.throws(
    () => validateContract({ ...minimal(), completed_acceptance_criteria: ["MISSING"] }),
    { code: "ERR_CONTRACT" },
  );
});

test("retry and resource budgets are finite and cannot exceed repair or timeout boundaries", () => {
  for (const policy of [
    { max_attempts: 0 },
    { max_repairs: 4 },
    { max_rate_retries: -1 },
    { timeout_ms: Infinity },
    { max_elapsed_ms: 100, timeout_ms: 101 },
    { max_backoff_ms: 100, backoff_ms: 101 },
    { development: { max_paid_usd: -1 } },
    { product_runtime: { max_paid_usd: "unknown" } },
    { unknown_budget: true },
  ])
    assert.throws(() => validateContract({ ...minimal(), policy }), { code: "ERR_CONTRACT" });
});

test("all standalone agent schemas compile with strict draft2020-12 validation", () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  for (const name of [
    "task",
    "implementation-result",
    "verification-result",
    "repair-task",
    "handoff",
  ]) {
    const schema = JSON.parse(
      readFileSync(new URL(`../../schemas/agents/${name}.schema.json`, import.meta.url), "utf8"),
    );
    assert.equal(typeof ajv.compile(schema), "function");
  }
  assert.throws(() => loadContract("this-file-does-not-exist.json"), { code: "ERR_CONTRACT" });
});

function resultValidator(name) {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return ajv.compile(
    JSON.parse(
      readFileSync(new URL(`../../schemas/agents/${name}.schema.json`, import.meta.url), "utf8"),
    ),
  );
}

test("implementation report cannot smuggle authoritative completion or usage fields", () => {
  const validate = resultValidator("implementation-result");
  const value = {
    schema_version: 1,
    task_id: "P0-01",
    run_id: "run-1",
    executor: "MUSE",
    model: null,
    cli_version: null,
    modified_files: ["src/result.mjs"],
    completed_acceptance_criteria: ["AC-01"],
    remaining_work: [],
    tests_reported: [{ command: "node tests/example.mjs", result: "reported pass" }],
    notes: [],
  };
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...value, status: "COMPLETED" }), false);
  assert.equal(validate({ ...value, verification_authority: "SELF" }), false);
});

test("verification report requires independent authority and original check identity", () => {
  const validate = resultValidator("verification-result");
  const value = {
    schema_version: 1,
    id: "verify-1",
    task_id: "P0-01",
    run_id: "run-1",
    authority: "independent-node-runner",
    validation_mode: "MOCK",
    recorded_at: "2026-10-26T00:00:00Z",
    status: "FAIL",
    acceptance_hashes: { "tests/example.mjs": "a".repeat(64) },
    results: [
      {
        acceptance_id: "AC-01",
        command: ["node", "tests/example.mjs"],
        exit_code: 1,
        stdout: "",
        stderr: "AssertionError",
        duration_ms: 10,
        signal: null,
        timed_out: false,
        cancelled: false,
        process_stopped: true,
        output_limit: false,
        spawn_error: null,
        stop_scope: "direct_process",
        process_tree_stopped: null,
        status: "FAIL",
      },
    ],
    git_revision: null,
    limitations: ["No live Muse model call"],
  };
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...value, authority: "IMPLEMENTER_SELF_REPORT" }), false);
  assert.equal(validate({ ...value, status: "PROBABLY_PASS" }), false);
});

test("repair contract requires defect evidence references and limits repairs to three rounds", () => {
  const validate = resultValidator("repair-task");
  const value = {
    schema_version: 1,
    task_id: "P0-01",
    run_id: "run-1",
    repair_round: 1,
    defects: [
      {
        acceptance_id: "AC-01",
        expected: "exit0",
        actual: "exit1",
        evidence: {
          id: "verify-1",
          path: "run-1/verification/verify-1.json",
          sha256: "a".repeat(64),
          status: "FAIL",
          authority: "independent-node-runner",
        },
      },
    ],
    allowed_files: ["src/result.mjs"],
    remaining_work: ["Fix AC-01"],
  };
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...value, repair_round: 4 }), false);
  assert.equal(validate({ ...value, defects: [] }), false);
});
