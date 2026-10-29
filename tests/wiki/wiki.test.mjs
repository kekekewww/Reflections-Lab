import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { hostname } from "node:os";
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  symlinkSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../../scripts/wiki/cli.mjs", import.meta.url));
const fixtureBase = fileURLToPath(new URL("../../.cache/wiki-tests/", import.meta.url));
const date = "2026-10-26T00:00:00.000Z";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const read = (root, file) => readFileSync(path.join(root, file), "utf8");
const json = (root, file) => JSON.parse(read(root, file));

function put(root, file, value) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value));
}

function metadata(id, extra = {}) {
  return {
    id,
    title: `知識 ${id}`,
    type: "concept",
    status: "UNVERIFIED",
    created_at: date,
    updated_at: date,
    sources: [],
    related_tasks: [],
    related_decisions: [],
    supersedes: [],
    tags: [],
    ...extra,
  };
}

function page(meta, body) {
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${body}\n`;
}

function fixture(t) {
  mkdirSync(fixtureBase, { recursive: true });
  const root = mkdtempSync(path.join(fixtureBase, "reflection-wiki-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(fixtureBase));
    rmSync(root, { recursive: true, force: true });
  });
  for (const folder of ["sources", "tasks", "events", "inbox", "wiki/handoffs"])
    mkdirSync(path.join(root, "knowledge", folder), { recursive: true });
  put(root, "knowledge/sources/manifest.json", { schema_version: 1, sources: [] });
  put(root, "knowledge/wiki/index.md", page(metadata("KB-INDEX", { type: "index" }), "# 索引"));
  put(root, "knowledge/wiki/now.md", page(metadata("KB-NOW", { type: "state" }), "# 目前狀態"));
  return root;
}

function plan(root, name = "one", extra = {}) {
  const sourceId = `SRC-${name}`;
  put(root, `src/${name}.md`, `原始證據 ${name}\n`);
  const value = {
    agent: "codex",
    session: `session-${name}`,
    summary: `整理來源 ${name}`,
    source: {
      id: sourceId,
      title: `來源 ${name}`,
      version: "1",
      license: "project-internal",
      trust: "primary",
    },
    pages: [
      {
        path: `wiki/concepts/${name}.md`,
        expected_hash: null,
        metadata: metadata(`KB-${name}`, { sources: [sourceId] }),
        body: `# 綜合知識 ${name}\n\n來源支持的整理結論；仍需後續驗證。`,
      },
    ],
    ...extra,
  };
  put(root, `plans/${name}.json`, value);
  return value;
}

function run(root, args) {
  const result = spawnSync(process.execPath, [cli, ...args, "--root", root, "--format", "json"], {
    encoding: "utf8",
    timeout: 20_000,
  });
  if (result.error) throw result.error;
  return result;
}

function success(root, args) {
  const result = run(root, args);
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function ingest(root, name = "one", more = []) {
  return success(root, ["ingest", `src/${name}.md`, "--plan", `plans/${name}.json`, ...more]);
}

function eventFiles(root) {
  return readdirSync(path.join(root, "knowledge/events")).filter((name) => name.endsWith(".json"));
}

function task(root, id = "TASK-01") {
  const value = {
    id,
    title: "可重現驗證任務",
    description: "以實際檔案和驗證證據確認任務完成。",
    status: "READY",
    priority: "P1",
    owner: null,
    dependencies: [],
    acceptance_criteria: [{ id: "AC-01", text: "驗證結果為 PASS", verified: false, evidence: [] }],
    relevant_files: ["evidence/result.json"],
    evidence: [],
    created_at: date,
    updated_at: date,
  };
  put(root, `knowledge/tasks/${id}.json`, value);
  return value;
}

test("agent execution projection preserves shared task authority and validates source hash", (t) => {
  const root = fixture(t);
  task(root);
  const claim = success(root, ["task", "claim", "TASK-01", "--agent", "codex", "--session", "s"]);
  const owner = ["--agent", "codex", "--session", "s", "--token", claim.token];
  put(root, "artifacts/run/state.json", { run_id: "RUN-01", state: "ASSIGNED_CODEX" });
  const projection = {
    run_id: "RUN-01",
    run_state: "ASSIGNED_CODEX",
    preferred_executor: "MUSE",
    actual_executor: "CODEX",
    previous_executor: "MUSE",
    fallback_reason: "MUSE_SUBSCRIPTION_EXHAUSTED",
    model: null,
    cli_version: null,
    last_successful_checkpoint: null,
    git_revision: null,
    modified_files: ["src/example.mjs"],
    completed_acceptance_criteria: [],
    remaining_work: ["finish implementation then independent verification"],
    verification_evidence: [],
    resource_usage: { muse_remaining_percent: null, codex_remaining_percent: null },
    run_state_path: "artifacts/run/state.json",
    run_state_sha256: digest(read(root, "artifacts/run/state.json")),
    updated_at: date,
  };
  put(root, "update.json", { agent_execution: projection });
  const updated = success(root, ["task", "update", "TASK-01", ...owner, "--file", "update.json"]);
  assert.equal(updated.task.status, "IN_PROGRESS");
  assert.equal(updated.task.acceptance_criteria[0].verified, false);
  assert.deepEqual(updated.task.agent_execution, projection);
  put(root, "update.json", { agent_execution: { ...projection, run_state: "HALLUCINATED" } });
  assert.notEqual(
    run(root, ["task", "update", "TASK-01", ...owner, "--file", "update.json"]).status,
    0,
  );
  put(root, "update.json", {
    agent_execution: { ...projection, run_state_sha256: "0".repeat(64) },
  });
  assert.notEqual(
    run(root, ["task", "update", "TASK-01", ...owner, "--file", "update.json"]).status,
    0,
  );
  put(root, "artifacts/run/state.json", { run_id: "RUN-01", state: "COMPLETED" });
  const lint = run(root, ["lint"]);
  assert.notEqual(lint.status, 0);
  assert.match(lint.stdout, /(?:hash|evidence|證據)/i);
});

test("ingest writes synthesized pages, source provenance and linked generated index", (t) => {
  const root = fixture(t);
  const value = plan(root);
  ingest(root);
  const output = read(root, "knowledge/wiki/concepts/one.md");
  assert.ok(output.includes(value.pages[0].body));
  assert.ok(read(root, "knowledge/wiki/index.md").includes("concepts/one.md"));
  const source = json(root, "knowledge/sources/manifest.json").sources.find(
    (item) => item.id === "SRC-one",
  );
  assert.equal(source.sha256, digest(read(root, "src/one.md")));
  assert.ok(source.wiki_pages.includes("wiki/concepts/one.md"));
  assert.equal(eventFiles(root).length, 1);
});

test("repeated source and plan ingest preserves pages and immutable events", (t) => {
  const root = fixture(t);
  plan(root);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const events = eventFiles(root);
  ingest(root);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
  assert.deepEqual(eventFiles(root), events);
  assert.equal(json(root, "knowledge/sources/manifest.json").sources.length, 1);
});

test("dry-run plans an ingest without creating any durable mutation", (t) => {
  const root = fixture(t);
  plan(root);
  const before = read(root, "knowledge/wiki/index.md");
  ingest(root, "one", ["--dry-run"]);
  assert.equal(read(root, "knowledge/wiki/index.md"), before);
  assert.equal(json(root, "knowledge/sources/manifest.json").sources.length, 0);
  assert.equal(eventFiles(root).length, 0);
  assert.equal(readdirSync(path.join(root, "knowledge/wiki")).includes("concepts"), false);
});

test("lint identifies a broken local link and an orphan page", (t) => {
  const root = fixture(t);
  put(root, "knowledge/wiki/orphan.md", page(metadata("KB-ORPHAN"), "[缺少文件](missing.md)"));
  const result = run(root, ["lint"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /(?:missing\.md|BROKEN_LINK|broken.link)/i);
  assert.match(result.stdout, /(?:ORPHAN|orphan|孤立)/i);
});

test("stale optimistic hash preserves accepted page and records the competing proposal", (t) => {
  const root = fixture(t);
  plan(root);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const changed = plan(root, "two");
  changed.pages = [
    {
      ...changed.pages[0],
      path: "wiki/concepts/one.md",
      expected_hash: digest("stale"),
      body: "競爭修改，必須保留此提案。",
    },
  ];
  put(root, "plans/two.json", changed);
  const result = run(root, ["ingest", "src/two.md", "--plan", "plans/two.json"]);
  assert.notEqual(result.status, 0);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
  const conflicts = readdirSync(path.join(root, "knowledge/conflicts")).filter((name) =>
    name.endsWith(".json"),
  );
  assert.equal(conflicts.length, 1);
  assert.ok(read(root, `knowledge/conflicts/${conflicts[0]}`).includes("競爭修改"));
});

test("differing accepted structured assertions are recorded instead of silently merged", (t) => {
  const root = fixture(t);
  const first = plan(root);
  first.pages[0].metadata.assertions = [
    { key: "project.renderer", value: "Three.js", status: "ACCEPTED", evidence: [] },
  ];
  put(root, "plans/one.json", first);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const second = plan(root, "two");
  second.pages[0].metadata.assertions = [
    { key: "project.renderer", value: "OtherRenderer", status: "ACCEPTED", evidence: [] },
  ];
  put(root, "plans/two.json", second);
  const result = run(root, ["ingest", "src/two.md", "--plan", "plans/two.json"]);
  assert.notEqual(result.status, 0);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
  const records = readdirSync(path.join(root, "knowledge/conflicts"))
    .map((file) => read(root, `knowledge/conflicts/${file}`))
    .join("\n");
  assert.match(records, /project\.renderer/);
  assert.match(records, /OtherRenderer/);
});

test("concurrent child-process ingests retain all successful writes and immutable history", async (t) => {
  const root = fixture(t);
  plan(root, "parallel-a");
  plan(root, "parallel-b");
  const calls = await Promise.allSettled(
    ["parallel-a", "parallel-b"].map((name) =>
      execFileAsync(
        process.execPath,
        [
          cli,
          "ingest",
          `src/${name}.md`,
          "--plan",
          `plans/${name}.json`,
          "--root",
          root,
          "--format",
          "json",
        ],
        { timeout: 20_000 },
      ),
    ),
  );
  for (let index = 0; index < calls.length; index++) {
    if (calls[index].status === "rejected") ingest(root, index === 0 ? "parallel-a" : "parallel-b");
  }
  const manifest = json(root, "knowledge/sources/manifest.json");
  assert.equal(manifest.sources.length, 2);
  assert.equal(eventFiles(root).length, 2);
  for (const name of ["parallel-a", "parallel-b"]) {
    assert.ok(read(root, `knowledge/wiki/concepts/${name}.md`).includes(`綜合知識 ${name}`));
    assert.ok(read(root, "knowledge/wiki/index.md").includes(`${name}.md`));
  }
});

test("concurrent child-process claims produce exactly one task owner", async (t) => {
  const root = fixture(t);
  task(root);
  const outputs = await Promise.allSettled(
    ["agent-a", "agent-b"].map((agent) =>
      execFileAsync(
        process.execPath,
        [
          cli,
          "task",
          "claim",
          "TASK-01",
          "--agent",
          agent,
          "--session",
          `${agent}-session`,
          "--lease-seconds",
          "300",
          "--root",
          root,
          "--format",
          "json",
        ],
        { timeout: 20_000 },
      ),
    ),
  );
  assert.equal(outputs.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(outputs.filter((entry) => entry.status === "rejected").length, 1);
  const owner = json(root, "knowledge/tasks/TASK-01.json").owner;
  assert.ok(["agent-a", "agent-b"].includes(owner.agent));
  assert.ok(owner.token.length > 10);
});

test("DONE requires matching artifact hashes and verified acceptance evidence", (t) => {
  const root = fixture(t);
  task(root);
  success(root, ["task", "claim", "TASK-01", "--agent", "codex", "--session", "session-one"]);
  const owner = json(root, "knowledge/tasks/TASK-01.json").owner;
  const args = [
    "task",
    "update",
    "TASK-01",
    "--agent",
    "codex",
    "--session",
    "session-one",
    "--token",
    owner.token,
    "--file",
    "update.json",
  ];
  put(root, "update.json", { status: "DONE", evidence: [], acceptance_criteria: [] });
  assert.notEqual(run(root, args).status, 0);
  put(root, "evidence/result.json", { result: "PASS" });
  const evidence = {
    path: "evidence/result.json",
    sha256: digest(read(root, "evidence/result.json")),
    command: "node --test",
    result: "PASS",
  };
  put(root, "update.json", {
    status: "DONE",
    evidence: [evidence],
    acceptance_criteria: [
      { id: "AC-01", text: "驗證結果為 PASS", verified: true, evidence: [evidence] },
    ],
  });
  success(root, args);
  assert.equal(json(root, "knowledge/tasks/TASK-01.json").status, "DONE");
  put(root, "evidence/result.json", { result: "FAIL" });
  const lint = run(root, ["lint"]);
  assert.notEqual(lint.status, 0);
  assert.match(lint.stdout, /(?:hash|evidence|證據)/i);
});

test("query returns bounded lexical matches with source citations", (t) => {
  const root = fixture(t);
  const value = plan(root);
  value.pages[0].body = `# Propagation\n\npropagation evidence ${"bounded excerpt ".repeat(400)}`;
  put(root, "plans/one.json", value);
  ingest(root);
  const result = success(root, ["query", "propagation"]);
  const serialized = JSON.stringify(result);
  assert.match(serialized, /SRC-one/);
  assert.match(serialized, /concepts\/one\.md/);
  assert.ok(
    serialized.length < 12_000,
    "query must return bounded excerpts rather than whole wiki",
  );
});

test("source edits are reported stale against the pinned manifest hash", (t) => {
  const root = fixture(t);
  plan(root);
  ingest(root);
  put(root, "src/one.md", "原始資料已修改\n");
  const result = run(root, ["lint"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /(?:stale|hash|過時)/i);
});

test("supersede retains old decision body and records both metadata relationships", (t) => {
  const root = fixture(t);
  plan(root, "old");
  plan(root, "new");
  ingest(root, "old");
  ingest(root, "new");
  const before = read(root, "knowledge/wiki/concepts/old.md");
  success(root, [
    "supersede",
    "wiki/concepts/old.md",
    "--replacement",
    "wiki/concepts/new.md",
    "--agent",
    "codex",
    "--session",
    "session-one",
    "--expected-hash",
    digest(before),
  ]);
  const old = read(root, "knowledge/wiki/concepts/old.md");
  const replacement = read(root, "knowledge/wiki/concepts/new.md");
  assert.ok(old.includes("綜合知識 old"));
  assert.match(old, /DEPRECATED/);
  assert.match(old, /KB-new/);
  assert.match(replacement, /KB-old/);
});

test("manual handoff captures actual git state, scope hashes and a resumable now page", (t) => {
  const root = fixture(t);
  execFileSync("git", ["init", "--initial-branch", "main"], { cwd: root, stdio: "pipe" });
  task(root);
  put(root, "scope.txt", "已完成的可重現工作\n");
  const now = read(root, "knowledge/wiki/now.md");
  const record = {
    agent: "codex",
    session: "manual-session",
    task_id: "TASK-01",
    summary: "手動交接；沒有自動 Session Hook。",
    completed: ["完成離線驗證"],
    commands: [{ command: "node --test", result: "PASS" }],
    evidence: [],
    risks: ["跨 Agent 自動 Hook 尚未驗證"],
    next_steps: ["閱讀 scope.txt，執行下一項驗證"],
    modified_files: ["scope.txt"],
    now: { expected_hash: digest(now), body: "# 目前狀態\n\n下一步：閱讀最新交接並執行驗證。" },
  };
  put(root, "handoff.json", record);
  const result = success(root, ["handoff", "--file", "handoff.json"]);
  assert.ok(result.event_id);
  const event = json(root, `knowledge/events/${result.event_id}.json`);
  const eventText = JSON.stringify(event);
  assert.match(eventText, /manual-session/);
  assert.match(eventText, /main/);
  assert.match(eventText, /scope\.txt/);
  assert.match(eventText, new RegExp(digest(read(root, "scope.txt"))));
  assert.match(eventText, /"(?:head|revision|commit)":null/);
  assert.ok(read(root, `knowledge/${result.path}`).includes("閱讀 scope.txt"));
  assert.ok(read(root, "knowledge/wiki/now.md").includes("閱讀最新交接"));
});

test("repeating read-only status and lint does not mutate events or page bytes", (t) => {
  const root = fixture(t);
  plan(root);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const events = eventFiles(root);
  success(root, ["status"]);
  success(root, ["status"]);
  run(root, ["lint"]);
  run(root, ["lint"]);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
  assert.deepEqual(eventFiles(root), events);
});

test("claim heartbeat and release require the matching owner token", (t) => {
  const root = fixture(t);
  task(root);
  success(root, ["task", "claim", "TASK-01", "--agent", "codex", "--session", "owner-session"]);
  const owner = json(root, "knowledge/tasks/TASK-01.json").owner;
  const identity = ["--agent", owner.agent, "--session", owner.session, "--token", owner.token];
  assert.notEqual(
    run(root, [
      "task",
      "release",
      "TASK-01",
      "--agent",
      "other",
      "--session",
      "other",
      "--token",
      "wrong",
    ]).status,
    0,
  );
  assert.equal(json(root, "knowledge/tasks/TASK-01.json").owner.token, owner.token);
  success(root, ["task", "heartbeat", "TASK-01", ...identity, "--lease-seconds", "600"]);
  const renewed = json(root, "knowledge/tasks/TASK-01.json").owner;
  assert.ok(new Date(renewed.lease_until).valueOf() >= new Date(owner.lease_until).valueOf());
  success(root, ["task", "release", "TASK-01", ...identity]);
  assert.equal(json(root, "knowledge/tasks/TASK-01.json").owner, null);
});

test("an expired claim is visible but cannot be silently stolen", (t) => {
  const root = fixture(t);
  const value = task(root);
  value.status = "IN_PROGRESS";
  value.owner = {
    agent: "original",
    session: "old-session",
    token: "original-token-that-must-survive",
    claimed_at: date,
    heartbeat_at: date,
    lease_until: "2026-01-01T00:00:00.000Z",
  };
  put(root, "knowledge/tasks/TASK-01.json", value);
  assert.notEqual(
    run(root, ["task", "claim", "TASK-01", "--agent", "new", "--session", "new-session"]).status,
    0,
  );
  assert.equal(json(root, "knowledge/tasks/TASK-01.json").owner.token, value.owner.token);
  assert.match(JSON.stringify(success(root, ["status"])), /(?:expired|stale|lease|過期)/i);
});

test("ingest rejects traversal without writing outside the knowledge directory", (t) => {
  const root = fixture(t);
  const value = plan(root);
  value.pages[0].path = "../escaped.md";
  put(root, "plans/one.json", value);
  assert.notEqual(run(root, ["ingest", "src/one.md", "--plan", "plans/one.json"]).status, 0);
  assert.equal(readdirSync(root).includes("escaped.md"), false);
  assert.equal(json(root, "knowledge/sources/manifest.json").sources.length, 0);
});

test("lint rejects duplicate page IDs and unfinished source citations", (t) => {
  const root = fixture(t);
  put(
    root,
    "knowledge/wiki/a.md",
    page(metadata("KB-DUP", { sources: ["SRC-MISSING"] }), "第一份知識"),
  );
  put(root, "knowledge/wiki/b.md", page(metadata("KB-DUP"), "第二份知識"));
  const result = run(root, ["lint"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /(?:DUPLICATE_ID|duplicate.id)/i);
  assert.match(result.stdout, /SRC-MISSING/);
});

test("reconcile explicitly applies a current-hash resolution while retaining the original conflict", (t) => {
  const root = fixture(t);
  const first = plan(root);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const second = plan(root, "two");
  second.pages = [
    {
      ...second.pages[0],
      path: "wiki/concepts/one.md",
      expected_hash: digest("old-snapshot"),
      body: "待人工核對的競爭結論",
    },
  ];
  put(root, "plans/two.json", second);
  assert.notEqual(run(root, ["ingest", "src/two.md", "--plan", "plans/two.json"]).status, 0);
  const conflictFile = readdirSync(path.join(root, "knowledge/conflicts")).find((name) =>
    name.endsWith(".json"),
  );
  const conflictId = conflictFile.slice(0, -5);
  put(root, "resolution.json", {
    agent: "reviewer",
    session: "review-session",
    resolution: "依來源逐項核對後，明確採用合併結論；不自動判定科學正確性。",
    pages: [
      {
        ...first.pages[0],
        expected_hash: digest(before),
        body: "已核對的合併結論；保留原始 Conflict Record。",
      },
      {
        path: "wiki/concepts/reconciled-related.md",
        expected_hash: null,
        metadata: metadata("KB-RELATED", { sources: ["SRC-one"] }),
        body: "交叉整理來源的新知識。",
      },
    ],
  });
  success(root, ["reconcile", conflictId, "--file", "resolution.json"]);
  assert.ok(read(root, "knowledge/wiki/concepts/one.md").includes("已核對的合併結論"));
  const retained = read(root, `knowledge/conflicts/${conflictFile}`);
  assert.match(retained, /待人工核對的競爭結論/);
  assert.match(retained, /(?:RESOLVED|resolved)/);
  const source = json(root, "knowledge/sources/manifest.json").sources.find(
    (item) => item.id === "SRC-one",
  );
  assert.ok(source.wiki_pages.includes("wiki/concepts/one.md"));
  assert.ok(source.wiki_pages.includes("wiki/concepts/reconciled-related.md"));
});

test("multi-page stale patch preflight prevents partial changes and retains the complete proposal", (t) => {
  const root = fixture(t);
  const first = plan(root, "first");
  const second = plan(root, "second");
  ingest(root, "first");
  ingest(root, "second");
  const firstBefore = read(root, "knowledge/wiki/concepts/first.md");
  const secondBefore = read(root, "knowledge/wiki/concepts/second.md");
  const manifestBefore = read(root, "knowledge/sources/manifest.json");
  const incoming = plan(root, "incoming");
  incoming.pages = [
    { ...first.pages[0], expected_hash: digest(firstBefore), body: "第一頁提案應保留但不能套用" },
    { ...second.pages[0], expected_hash: digest("outdated second page"), body: "第二頁過時提案" },
  ];
  put(root, "plans/incoming.json", incoming);
  const result = run(root, ["ingest", "src/incoming.md", "--plan", "plans/incoming.json"]);
  assert.notEqual(result.status, 0);
  assert.equal(read(root, "knowledge/wiki/concepts/first.md"), firstBefore);
  assert.equal(read(root, "knowledge/wiki/concepts/second.md"), secondBefore);
  assert.equal(read(root, "knowledge/sources/manifest.json"), manifestBefore);
  const conflicts = readdirSync(path.join(root, "knowledge/conflicts"))
    .map((name) => read(root, `knowledge/conflicts/${name}`))
    .join("\n");
  assert.ok(conflicts.includes("第一頁提案應保留但不能套用"));
  assert.ok(conflicts.includes("第二頁過時提案"));
});

function snapshot(root, relative = "") {
  const result = {};
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result[`${name}/`] = null;
      Object.assign(result, snapshot(root, name));
    } else result[name] = read(root, name);
  }
  return result;
}

function fileSnapshot(root) {
  return Object.fromEntries(Object.entries(snapshot(root)).filter(([name]) => !name.endsWith("/")));
}

function journal(root, files, extra = {}) {
  const id = randomUUID();
  const value = {
    id,
    created_at: date,
    status: "APPLYING",
    files: files.map((file) => ({
      ...file,
      before_hash: file.before === null ? null : digest(file.before),
      after_hash: digest(file.after),
      exclusive: false,
    })),
    ...extra,
  };
  put(root, `knowledge/transactions/${id}.json`, value);
  return value;
}

test("invalid output format is rejected before any ingest mutation", (t) => {
  const root = fixture(t);
  plan(root);
  const before = snapshot(root);
  const result = spawnSync(
    process.execPath,
    [cli, "ingest", "src/one.md", "--plan", "plans/one.json", "--root", root, "--format", "yaml"],
    { encoding: "utf8", timeout: 20_000 },
  );
  assert.notEqual(result.status, 0);
  assert.deepEqual(snapshot(root), before);
});

test("YAML aliases and duplicate keys are rejected during metadata validation", (t) => {
  const root = fixture(t);
  const base = Object.entries(metadata("KB-INVALID"))
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  put(root, "knowledge/wiki/duplicate.md", `---\n${base}\ntitle: duplicate\n---\n\n重複 key\n`);
  put(
    root,
    "knowledge/wiki/alias.md",
    `---\n${base}\nextra: &shared [one, two]\ncopy: *shared\n---\n\nYAML alias\n`,
  );
  const result = run(root, ["lint"]);
  assert.notEqual(result.status, 0);
  const issues = JSON.parse(result.stdout).issues;
  assert.ok(
    issues.some((issue) => issue.path.endsWith("duplicate.md") && issue.code === "METADATA"),
  );
  assert.ok(issues.some((issue) => issue.path.endsWith("alias.md") && issue.code === "METADATA"));
});

test("task claim and transaction recovery dry runs do not create lock or durable files", (t) => {
  const root = fixture(t);
  task(root);
  const transaction = journal(root, [
    { path: "knowledge/recovery/a.txt", before: "before", after: "after" },
  ]);
  put(root, "knowledge/recovery/a.txt", "before");
  const before = snapshot(root);
  success(root, [
    "task",
    "claim",
    "TASK-01",
    "--agent",
    "codex",
    "--session",
    "dry-run-session",
    "--dry-run",
  ]);
  assert.deepEqual(snapshot(root), before);
  success(root, ["recover", transaction.id, "--action", "complete", "--dry-run"]);
  assert.deepEqual(snapshot(root), before);
});

test("interrupted multi-file transaction can complete and repeated recovery is idempotent", (t) => {
  const root = fixture(t);
  const transaction = journal(root, [
    { path: "knowledge/recovery/a.txt", before: "A-before", after: "A-after" },
    { path: "knowledge/recovery/b.txt", before: "B-before", after: "B-after" },
  ]);
  put(root, "knowledge/recovery/a.txt", "A-after");
  put(root, "knowledge/recovery/b.txt", "B-before");
  success(root, ["recover", transaction.id, "--action", "complete"]);
  assert.equal(read(root, "knowledge/recovery/a.txt"), "A-after");
  assert.equal(read(root, "knowledge/recovery/b.txt"), "B-after");
  assert.equal(json(root, `knowledge/transactions/${transaction.id}.json`).status, "COMMITTED");
  const before = read(root, `knowledge/transactions/${transaction.id}.json`);
  success(root, ["recover", transaction.id, "--action", "complete"]);
  assert.equal(read(root, `knowledge/transactions/${transaction.id}.json`), before);
});

test("interrupted transaction rollback restores old files and removes only its created files", (t) => {
  const root = fixture(t);
  const transaction = journal(root, [
    { path: "knowledge/recovery/existing.txt", before: "old-content", after: "changed-content" },
    { path: "knowledge/recovery/created.txt", before: null, after: "new-content" },
  ]);
  put(root, "knowledge/recovery/existing.txt", "changed-content");
  put(root, "knowledge/recovery/created.txt", "new-content");
  success(root, ["recover", transaction.id, "--action", "rollback"]);
  assert.equal(read(root, "knowledge/recovery/existing.txt"), "old-content");
  assert.equal(existsSync(path.join(root, "knowledge/recovery/created.txt")), false);
  assert.equal(json(root, `knowledge/transactions/${transaction.id}.json`).status, "ROLLED_BACK");
});

test("recovery preserves external edits and does not partially apply another file", (t) => {
  const root = fixture(t);
  const transaction = journal(root, [
    { path: "knowledge/recovery/a.txt", before: "A-before", after: "A-after" },
    { path: "knowledge/recovery/b.txt", before: "B-before", after: "B-after" },
  ]);
  put(root, "knowledge/recovery/a.txt", "A-before");
  put(root, "knowledge/recovery/b.txt", "external-editor-content");
  const result = run(root, ["recover", transaction.id, "--action", "complete"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /RECOVERY_EXTERNAL_CHANGE/);
  assert.equal(read(root, "knowledge/recovery/a.txt"), "A-before");
  assert.equal(read(root, "knowledge/recovery/b.txt"), "external-editor-content");
  assert.equal(json(root, `knowledge/transactions/${transaction.id}.json`).status, "APPLYING");
});

test("recovery rejects journal content inconsistent with its declared hashes", (t) => {
  const root = fixture(t);
  const transaction = journal(root, [
    { path: "knowledge/recovery/a.txt", before: "before", after: "after" },
  ]);
  put(root, "knowledge/recovery/a.txt", "before");
  transaction.files[0].after = "corrupted-journal-content";
  put(root, `knowledge/transactions/${transaction.id}.json`, transaction);
  const result = run(root, ["recover", transaction.id, "--action", "complete"]);
  assert.notEqual(result.status, 0);
  assert.equal(read(root, "knowledge/recovery/a.txt"), "before");
  assert.equal(json(root, `knowledge/transactions/${transaction.id}.json`).status, "APPLYING");
});

test("ingest refuses symlink or junction page ancestors leading outside the repository", (t) => {
  const root = fixture(t);
  const outside = mkdtempSync(path.join(fixtureBase, "reflection-wiki-outside-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(outside)), path.resolve(fixtureBase));
    rmSync(outside, { recursive: true, force: true });
  });
  const link = path.join(root, "knowledge/wiki/external");
  try {
    symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) {
      t.skip(`NOT RUN：本機拒絕建立 symlink/junction fixture (${error.code})。`);
      return;
    }
    throw error;
  }
  const value = plan(root);
  value.pages[0].path = "wiki/external/escaped.md";
  put(root, "plans/one.json", value);
  const result = run(root, ["ingest", "src/one.md", "--plan", "plans/one.json"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /SYMLINK/);
  assert.equal(existsSync(path.join(outside, "escaped.md")), false);
  assert.equal(json(root, "knowledge/sources/manifest.json").sources.length, 0);
});

test("ingest rejects Windows alternate data stream syntax before creating files", (t) => {
  const root = fixture(t);
  const value = plan(root);
  value.pages[0].path = "wiki/concepts/page.md:hidden.md";
  put(root, "plans/one.json", value);
  const before = fileSnapshot(root);
  const result = run(root, ["ingest", "src/one.md", "--plan", "plans/one.json"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /PATH/);
  assert.deepEqual(fileSnapshot(root), before);
});

test("lint recognizes canonical ADR identifiers in the architecture ADR directory", (t) => {
  const root = fixture(t);
  put(
    root,
    "docs/02-architecture/adr/001-rendering.md",
    "# ADR-001 rendering\n\n採納 Three.js。\n",
  );
  put(
    root,
    "knowledge/wiki/architecture.md",
    page(
      metadata("KB-ARCH", { related_decisions: ["ADR-001"] }),
      "[ADR-001](../../docs/02-architecture/adr/001-rendering.md)",
    ),
  );
  const result = run(root, ["lint"]);
  const report = JSON.parse(result.stdout);
  assert.ok(Array.isArray(report.issues), result.stdout);
  assert.equal(
    report.issues.some((issue) => issue.code === "DECISION_REFERENCE"),
    false,
    result.stdout,
  );
});

test("oversized and excessively nested YAML metadata fail with bounded validation errors", (t) => {
  const root = fixture(t);
  put(
    root,
    "knowledge/wiki/oversized.md",
    page(metadata("KB-LARGE", { oversized: "x".repeat(1024 * 1024) }), "限制 metadata 大小。"),
  );
  let nested = "leaf";
  for (let depth = 0; depth < 70; depth++) nested = { nested };
  put(
    root,
    "knowledge/wiki/deep.md",
    page(metadata("KB-DEEP", { nested }), "限制 metadata 深度。"),
  );
  const result = run(root, ["lint"]);
  assert.notEqual(result.status, 0);
  const issues = JSON.parse(result.stdout).issues;
  assert.ok(
    issues.some((issue) => issue.path.endsWith("oversized.md") && issue.code === "METADATA"),
  );
  assert.ok(issues.some((issue) => issue.path.endsWith("deep.md") && issue.code === "METADATA"));
  assert.ok(result.stdout.length < 12_000, "metadata errors must not echo an unbounded input");
});

test("abandoned writer unlock requires its exact token and records the explicit recovery reason", (t) => {
  const root = fixture(t);
  const child = spawnSync(process.execPath, ["-e", "process.exit(0)"], { encoding: "utf8" });
  assert.equal(child.status, 0);
  assert.ok(child.pid > 0);
  const owner = { token: randomUUID(), pid: child.pid, host: hostname(), created_at: date };
  put(root, "knowledge/.locks/writer/owner.json", owner);
  const common = [
    "--reason",
    "確認 owner 子程序已退出，人工解除遺留 writer lock。",
    "--agent",
    "reviewer",
    "--session",
    "recovery-session",
  ];
  assert.notEqual(run(root, ["unlock", "--token", "mismatched-token", ...common]).status, 0);
  assert.equal(json(root, "knowledge/.locks/writer/owner.json").token, owner.token);
  success(root, ["unlock", "--token", owner.token, ...common]);
  assert.equal(existsSync(path.join(root, "knowledge/.locks/writer")), false);
  const events = eventFiles(root)
    .map((name) => read(root, `knowledge/events/${name}`))
    .join("\n");
  assert.match(events, /確認 owner 子程序已退出/);
  assert.match(events, /recovery-session/);
});

test("unlock refuses a live local owner even when the supplied token matches", (t) => {
  const root = fixture(t);
  const owner = { token: randomUUID(), pid: process.pid, host: hostname(), created_at: date };
  put(root, "knowledge/.locks/writer/owner.json", owner);
  const result = run(root, [
    "unlock",
    "--token",
    owner.token,
    "--reason",
    "此持有者仍存活，必須拒絕。",
    "--agent",
    "reviewer",
    "--session",
    "live-owner-session",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /(?:LIVE|ALIVE|ACTIVE|仍存活|仍執行)/i);
  assert.deepEqual(json(root, "knowledge/.locks/writer/owner.json"), owner);
  assert.equal(eventFiles(root).length, 0);
});

test("query refuses an active writer and status exposes the diagnostic owner", (t) => {
  const root = fixture(t);
  const owner = { token: randomUUID(), pid: process.pid, host: hostname(), created_at: date };
  put(root, "knowledge/.locks/writer/owner.json", owner);
  const result = run(root, ["query", "knowledge"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /(?:READ_BUSY|RECOVERY_REQUIRED)/);
  assert.equal(success(root, ["status"]).writer.token, owner.token);
});

test("source supersession retains the old pinned hash and explicitly ingests the new local version", (t) => {
  const root = fixture(t);
  const first = plan(root);
  ingest(root);
  const oldHash = digest(read(root, "src/one.md"));
  const before = read(root, "knowledge/wiki/concepts/one.md");
  put(root, "src/one.md", "來源第二版；新結果需要更新既有綜合頁面。\n");
  const second = {
    ...first,
    session: "version-two-session",
    summary: "明確更新同一路徑的第二版來源。",
    source: { ...first.source, id: "SRC-one-v2", version: "2", supersedes: ["SRC-one"] },
    pages: [
      {
        ...first.pages[0],
        expected_hash: digest(before),
        metadata: metadata("KB-one", { sources: ["SRC-one-v2"] }),
        body: "# 同一知識的第二版綜合結論\n\n保留來源版本追溯。",
      },
    ],
  };
  put(root, "plans/version-two.json", second);
  success(root, ["ingest", "src/one.md", "--plan", "plans/version-two.json"]);
  const sources = json(root, "knowledge/sources/manifest.json").sources;
  assert.equal(sources.length, 2);
  assert.equal(sources.find((source) => source.id === "SRC-one").sha256, oldHash);
  assert.equal(sources.find((source) => source.id === "SRC-one").snapshot_mode, "historical");
  const current = sources.find((source) => source.id === "SRC-one-v2");
  assert.equal(current.sha256, digest(read(root, "src/one.md")));
  assert.deepEqual(current.supersedes, ["SRC-one"]);
  assert.ok(read(root, "knowledge/wiki/concepts/one.md").includes("第二版綜合結論"));
  const report = JSON.parse(run(root, ["lint"]).stdout);
  assert.ok(Array.isArray(report.issues));
  assert.equal(
    report.issues.some((issue) => issue.code === "SOURCE_HASH_STALE" && issue.severity === "error"),
    false,
  );
  const events = eventFiles(root);
  success(root, ["ingest", "src/one.md", "--plan", "plans/version-two.json"]);
  assert.deepEqual(eventFiles(root), events);
});

test("source version updates reject missing, unrelated and omitted predecessor relationships", (t) => {
  for (const scenario of ["missing", "different-path", "omitted", "self-cycle"]) {
    const root = fixture(t);
    const first = plan(root);
    ingest(root);
    plan(root, "other");
    ingest(root, "other");
    const before = read(root, "knowledge/wiki/concepts/one.md");
    const manifestBefore = read(root, "knowledge/sources/manifest.json");
    put(root, "src/one.md", "新版來源\n");
    const source = { ...first.source, id: "SRC-one-v2", version: "2" };
    if (scenario === "missing") source.supersedes = ["SRC-NOT-FOUND"];
    if (scenario === "different-path") source.supersedes = ["SRC-other"];
    if (scenario === "self-cycle") source.supersedes = ["SRC-one-v2"];
    put(root, "plans/version-two.json", {
      ...first,
      source,
      pages: [
        {
          ...first.pages[0],
          expected_hash: digest(before),
          metadata: metadata("KB-one", { sources: ["SRC-one-v2"] }),
          body: `不得無聲套用的 ${scenario} 新版提案。`,
        },
      ],
    });
    const result = run(root, ["ingest", "src/one.md", "--plan", "plans/version-two.json"]);
    assert.notEqual(result.status, 0, scenario);
    assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before, scenario);
    assert.equal(read(root, "knowledge/sources/manifest.json"), manifestBefore, scenario);
  }
});

test("ingest cannot silently replace an accepted assertion on the same page", (t) => {
  const root = fixture(t);
  const first = plan(root);
  first.pages[0].metadata.assertions = [
    { key: "project.renderer", value: "Three.js", status: "ACCEPTED", evidence: [] },
  ];
  put(root, "plans/one.json", first);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const second = plan(root, "two");
  second.pages = [
    {
      ...first.pages[0],
      expected_hash: digest(before),
      metadata: {
        ...first.pages[0].metadata,
        sources: ["SRC-two"],
        assertions: [
          { key: "project.renderer", value: "OtherRenderer", status: "ACCEPTED", evidence: [] },
        ],
      },
      body: "新的矛盾主張必須保留為衝突提案。",
    },
  ];
  put(root, "plans/two.json", second);
  const result = run(root, ["ingest", "src/two.md", "--plan", "plans/two.json"]);
  assert.notEqual(result.status, 0);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
  const conflicts = readdirSync(path.join(root, "knowledge/conflicts"))
    .map((name) => read(root, `knowledge/conflicts/${name}`))
    .join("\n");
  assert.match(conflicts, /Three\.js/);
  assert.match(conflicts, /OtherRenderer/);
});

test("concurrent abandoned-lock recovery records one unlock and retains a competing task claim", async (t) => {
  const root = fixture(t);
  task(root);
  const child = spawnSync(process.execPath, ["-e", "process.exit(0)"], { encoding: "utf8" });
  assert.equal(child.status, 0);
  const owner = { token: randomUUID(), pid: child.pid, host: hostname(), created_at: date };
  put(root, "knowledge/.locks/writer/owner.json", owner);
  const unlock = (session) =>
    execFileAsync(
      process.execPath,
      [
        cli,
        "unlock",
        "--token",
        owner.token,
        "--reason",
        "並行復原同一個已退出程序的遺留鎖。",
        "--agent",
        "reviewer",
        "--session",
        session,
        "--root",
        root,
        "--format",
        "json",
      ],
      { timeout: 20_000 },
    );
  const operations = await Promise.allSettled([
    unlock("unlock-a"),
    unlock("unlock-b"),
    execFileAsync(
      process.execPath,
      [
        cli,
        "task",
        "claim",
        "TASK-01",
        "--agent",
        "claimant",
        "--session",
        "claim-session",
        "--root",
        root,
        "--format",
        "json",
      ],
      { timeout: 20_000 },
    ),
  ]);
  assert.equal(operations.slice(0, 2).filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(operations[2].status, "fulfilled", JSON.stringify(operations[2]));
  const claimed = json(root, "knowledge/tasks/TASK-01.json");
  assert.equal(claimed.owner.agent, "claimant");
  assert.equal(claimed.owner.session, "claim-session");
  const events = eventFiles(root).map((name) => json(root, `knowledge/events/${name}`));
  assert.equal(events.filter((event) => event.type === "unlock").length, 1);
  assert.equal(events.filter((event) => event.type === "task.claim").length, 1);
});

test("historical source IDs cannot be replayed to reactivate old versions and a revert uses a new ID", (t) => {
  const root = fixture(t);
  const first = plan(root);
  ingest(root);
  const original = read(root, "src/one.md");
  let before = read(root, "knowledge/wiki/concepts/one.md");
  put(root, "src/one.md", "第二版來源\n");
  const second = {
    ...first,
    source: { ...first.source, id: "SRC-v2", version: "2", supersedes: [first.source.id] },
    pages: [
      {
        ...first.pages[0],
        expected_hash: digest(before),
        metadata: metadata("KB-one", { sources: ["SRC-v2"] }),
        body: "第二版綜合知識。",
      },
    ],
  };
  put(root, "plans/two.json", second);
  success(root, ["ingest", "src/one.md", "--plan", "plans/two.json"]);
  before = read(root, "knowledge/wiki/concepts/one.md");
  const manifestBefore = read(root, "knowledge/sources/manifest.json");
  put(root, "src/one.md", original);
  const replay = {
    ...first,
    source: { ...first.source, supersedes: ["SRC-v2"] },
    pages: [
      { ...first.pages[0], expected_hash: digest(before), body: "不得重新啟用歷史 Source ID。" },
    ],
  };
  put(root, "plans/replay.json", replay);
  assert.notEqual(run(root, ["ingest", "src/one.md", "--plan", "plans/replay.json"]).status, 0);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
  assert.equal(read(root, "knowledge/sources/manifest.json"), manifestBefore);
  const third = {
    ...first,
    source: { ...first.source, id: "SRC-v3", version: "3-revert", supersedes: ["SRC-v2"] },
    pages: [
      {
        ...first.pages[0],
        expected_hash: digest(before),
        metadata: metadata("KB-one", { sources: ["SRC-v3"] }),
        body: "以新版本明確記錄回復決策。",
      },
    ],
  };
  put(root, "plans/revert.json", third);
  success(root, ["ingest", "src/one.md", "--plan", "plans/revert.json"]);
  const sources = json(root, "knowledge/sources/manifest.json").sources;
  assert.equal(sources.find((source) => source.id === first.source.id).snapshot_mode, "historical");
  assert.equal(sources.find((source) => source.id === "SRC-v2").snapshot_mode, "historical");
  assert.equal(sources.find((source) => source.id === "SRC-v3").sha256, digest(original));
});

test("an existing source ID freezes all supplied provenance fields", (t) => {
  const root = fixture(t);
  const first = plan(root);
  first.source.url = "https://example.org/original";
  first.source.acquired_at = date;
  put(root, "plans/one.json", first);
  ingest(root);
  const before = read(root, "knowledge/sources/manifest.json");
  for (const [field, value] of Object.entries({
    title: "被改寫的名稱",
    license: "changed-license",
    trust: "changed-trust",
    url: "https://example.org/changed",
    acquired_at: "2026-10-25T00:00:00.000Z",
  })) {
    put(root, "plans/changed.json", { ...first, source: { ...first.source, [field]: value } });
    assert.notEqual(
      run(root, ["ingest", "src/one.md", "--plan", "plans/changed.json"]).status,
      0,
      field,
    );
    assert.equal(read(root, "knowledge/sources/manifest.json"), before, field);
  }
});

test("lint detects a manually introduced source supersession cycle", (t) => {
  const root = fixture(t);
  plan(root);
  ingest(root);
  const manifest = json(root, "knowledge/sources/manifest.json");
  const first = manifest.sources[0];
  first.supersedes = ["SRC-cycle"];
  manifest.sources.push({ ...first, id: "SRC-cycle", supersedes: [first.id] });
  put(root, "knowledge/sources/manifest.json", manifest);
  const result = run(root, ["lint"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /(?:SOURCE_CYCLE|SOURCE_SUPERSEDES_CYCLE|cycle|循環)/i);
});

test("an existing wiki page retains its stable domain ID even with a current expected hash", (t) => {
  const root = fixture(t);
  plan(root);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const next = plan(root, "two");
  next.pages[0].path = "wiki/concepts/one.md";
  next.pages[0].expected_hash = digest(before);
  next.pages[0].metadata.id = "KB-DIFFERENT-IDENTITY";
  put(root, "plans/two.json", next);
  const result = run(root, ["ingest", "src/two.md", "--plan", "plans/two.json"]);
  assert.notEqual(result.status, 0);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
});

test("supersede cannot reactivate a deprecated replacement and create a decision cycle", (t) => {
  const root = fixture(t);
  plan(root, "a");
  plan(root, "b");
  ingest(root, "a");
  ingest(root, "b");
  success(root, [
    "supersede",
    "wiki/concepts/a.md",
    "--replacement",
    "wiki/concepts/b.md",
    "--agent",
    "reviewer",
    "--session",
    "first-decision",
    "--expected-hash",
    digest(read(root, "knowledge/wiki/concepts/a.md")),
  ]);
  const first = read(root, "knowledge/wiki/concepts/a.md");
  const second = read(root, "knowledge/wiki/concepts/b.md");
  const result = run(root, [
    "supersede",
    "wiki/concepts/b.md",
    "--replacement",
    "wiki/concepts/a.md",
    "--agent",
    "reviewer",
    "--session",
    "reverse-decision",
    "--expected-hash",
    digest(second),
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(read(root, "knowledge/wiki/concepts/a.md"), first);
  assert.equal(read(root, "knowledge/wiki/concepts/b.md"), second);
});

test("lint detects manually introduced wiki supersession cycles", (t) => {
  const root = fixture(t);
  put(
    root,
    "knowledge/wiki/a.md",
    page(
      metadata("KB-A", { status: "DEPRECATED", supersedes: ["KB-B"], superseded_by: ["KB-B"] }),
      "歷史 A。",
    ),
  );
  put(
    root,
    "knowledge/wiki/b.md",
    page(
      metadata("KB-B", { status: "DEPRECATED", supersedes: ["KB-A"], superseded_by: ["KB-A"] }),
      "歷史 B。",
    ),
  );
  const result = run(root, ["lint"]);
  const report = JSON.parse(result.stdout);
  assert.ok(Array.isArray(report.issues));
  assert.ok(
    report.issues.some((issue) => /(?:cycle|循環)/i.test(`${issue.code} ${issue.message}`)),
    result.stdout,
  );
});

test("invalid percent escapes in Markdown links produce a lint issue instead of aborting the report", (t) => {
  const root = fixture(t);
  put(root, "knowledge/wiki/bad-link.md", page(metadata("KB-BAD-LINK"), "[錯誤 URI](bad%ZZ.md)"));
  const result = run(root, ["lint"]);
  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.ok(Array.isArray(report.issues), result.stdout);
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.path.endsWith("bad-link.md") &&
        /(?:LINK|bad%ZZ)/i.test(`${issue.code} ${issue.message}`),
    ),
  );
});

test("VERIFIED page evidence must have the structured evidence schema", (t) => {
  const root = fixture(t);
  put(
    root,
    "knowledge/wiki/bad-evidence.md",
    page(
      metadata("KB-BAD-EVIDENCE", { status: "VERIFIED", evidence: "garbage" }),
      "不能以字串冒充可追溯證據。",
    ),
  );
  const report = JSON.parse(run(root, ["lint"]).stdout);
  assert.ok(Array.isArray(report.issues));
  assert.ok(
    report.issues.some(
      (issue) => issue.path.endsWith("bad-evidence.md") && issue.code === "METADATA",
    ),
    JSON.stringify(report),
  );
});

test("page-level evidence validates actual artifact hashes", (t) => {
  const root = fixture(t);
  put(root, "evidence/page-result.json", { result: "PASS" });
  const evidence = {
    path: "evidence/page-result.json",
    sha256: digest(read(root, "evidence/page-result.json")),
  };
  put(
    root,
    "knowledge/wiki/evidence.md",
    page(
      metadata("KB-EVIDENCE", { status: "VERIFIED", evidence: [evidence] }),
      "直接 artifact 可作為此頁證據。",
    ),
  );
  let report = JSON.parse(run(root, ["lint"]).stdout);
  assert.ok(Array.isArray(report.issues));
  assert.equal(
    report.issues.some(
      (issue) => issue.path.endsWith("wiki/evidence.md") && /EVIDENCE/.test(issue.code),
    ),
    false,
  );
  put(root, "evidence/page-result.json", { result: "changed" });
  report = JSON.parse(run(root, ["lint"]).stdout);
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.path.endsWith("wiki/evidence.md") &&
        /(?:EVIDENCE|hash|證據)/i.test(`${issue.code} ${issue.message}`),
    ),
    JSON.stringify(report),
  );
});

test("recovery rejects protected lock and transaction paths with mixed separators", (t) => {
  const root = fixture(t);
  const protectedLock = journal(root, [
    {
      path: "knowledge/.locks\\writer\\owner.json",
      before: null,
      after: JSON.stringify({ token: "malicious-replacement" }),
    },
  ]);
  const before = snapshot(root);
  const dry = run(root, ["recover", protectedLock.id, "--action", "complete", "--dry-run"]);
  assert.notEqual(dry.status, 0);
  assert.match(dry.stdout, /(?:RECOVERY_JOURNAL|PATH)/);
  assert.deepEqual(snapshot(root), before);
  const original = JSON.stringify({ id: randomUUID(), status: "COMMITTED", files: [] });
  put(root, "knowledge/transactions/victim.json", original);
  const protectedTransaction = journal(root, [
    {
      path: "knowledge/transactions\\victim.json",
      before: original,
      after: JSON.stringify({ status: "tampered" }),
    },
  ]);
  const result = run(root, ["recover", protectedTransaction.id, "--action", "complete"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /(?:RECOVERY_JOURNAL|PATH)/);
  assert.equal(read(root, "knowledge/transactions/victim.json"), original);
});

test("recovery rejects duplicate canonical targets including Windows case aliases", (t) => {
  for (const alias of [
    "knowledge/recovery\\a.txt",
    ...(process.platform === "win32" ? ["knowledge/recovery/A.txt"] : []),
  ]) {
    const root = fixture(t);
    put(root, "knowledge/recovery/a.txt", "before");
    const transaction = journal(root, [
      { path: "knowledge/recovery/a.txt", before: "before", after: "first-after" },
      { path: alias, before: "before", after: "second-after" },
    ]);
    const result = run(root, ["recover", transaction.id, "--action", "complete"]);
    assert.notEqual(result.status, 0, alias);
    assert.match(result.stdout, /(?:RECOVERY_JOURNAL|PATH)/);
    assert.equal(read(root, "knowledge/recovery/a.txt"), "before", alias);
    assert.equal(json(root, `knowledge/transactions/${transaction.id}.json`).status, "APPLYING");
  }
});

test("source deduplication uses canonical path hash and version across different IDs", (t) => {
  const root = fixture(t);
  const first = plan(root);
  ingest(root);
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const manifestBefore = read(root, "knowledge/sources/manifest.json");
  put(root, "plans/alias.json", {
    ...first,
    source: { ...first.source, id: "SRC-alias" },
    pages: [
      {
        ...first.pages[0],
        expected_hash: digest(before),
        metadata: metadata("KB-one", { sources: ["SRC-alias"] }),
        body: "同版本來源不得藉由不同 ID 重複保存。",
      },
    ],
  });
  const result = run(root, ["ingest", "src/one.md", "--plan", "plans/alias.json"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /DUPLICATE_SOURCE_VERSION/);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), before);
  assert.equal(read(root, "knowledge/sources/manifest.json"), manifestBefore);
  const manifest = JSON.parse(manifestBefore);
  manifest.sources.push({ ...manifest.sources[0], id: "SRC-manual-duplicate" });
  put(root, "knowledge/sources/manifest.json", manifest);
  const lint = run(root, ["lint"]);
  assert.notEqual(lint.status, 0);
  assert.match(lint.stdout, /DUPLICATE_SOURCE_VERSION/);
});

test("an external edit after expected-hash validation is preserved instead of becoming a new transaction base", (t) => {
  const root = fixture(t);
  const first = plan(root);
  ingest(root);
  const target = path.join(root, "knowledge/wiki/concepts/one.md");
  const before = read(root, "knowledge/wiki/concepts/one.md");
  const external = `${before}\n外部編輯器在預檢後保存的內容，必須完整保留。\n`;
  const manifestBefore = read(root, "knowledge/sources/manifest.json");
  const second = plan(root, "two");
  second.pages = [
    {
      ...first.pages[0],
      expected_hash: digest(before),
      metadata: { ...first.pages[0].metadata, sources: ["SRC-two"] },
      body: "Agent 提案不得覆寫預檢後發生的外部修改。",
    },
  ];
  put(root, "plans/two.json", second);
  const core = fileURLToPath(new URL("../../scripts/wiki/core.mjs", import.meta.url));
  const childCode = `
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { run } = await import(pathToFileURL(process.argv[1]).href);
const root = process.argv[2];
const target = process.argv[3];
const external = process.argv[4];
const originalRead = fs.readFileSync;
let injected = false;
fs.readFileSync = function (file, options) {
  const value = originalRead.call(fs, file, options);
  if (!injected && typeof file === "string" && path.resolve(file) === target && (options === "utf8" || options?.encoding === "utf8")) {
    injected = true;
    fs.writeFileSync(target, external);
  }
  return value;
};
try {
  const result = await run(["ingest", "src/two.md", "--plan", "plans/two.json", "--root", root, "--format", "json"]);
  process.stdout.write(JSON.stringify({ injected, ...result }));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  process.stdout.write(JSON.stringify({ injected, ok: false, code: error.code, message: error.message }));
  process.exitCode = 2;
} finally {
  fs.readFileSync = originalRead;
}
`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", childCode, core, root, target, external],
    { encoding: "utf8", timeout: 20_000 },
  );
  if (result.error) throw result.error;
  const report = JSON.parse(result.stdout);
  assert.equal(report.injected, true);
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(report.code, "EXTERNAL_WRITE", result.stdout);
  assert.equal(read(root, "knowledge/wiki/concepts/one.md"), external);
  assert.equal(read(root, "knowledge/sources/manifest.json"), manifestBefore);
});
