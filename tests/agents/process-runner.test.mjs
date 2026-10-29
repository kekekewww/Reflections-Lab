import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  runProcess,
  parseJsonl,
  redact,
  summarizeMuseEvents,
} from "../../scripts/agents/process-runner.mjs";
import { buildMuseCommand, discoverMuseExecutable } from "../../scripts/agents/muse-adapter.mjs";

const fixture = fileURLToPath(new URL("./fixtures/child-process.mjs", import.meta.url));
const cwd = dirname(fixture);
const invoke = (mode, options = {}) =>
  runProcess({
    file: process.execPath,
    args: [fixture, mode],
    cwd,
    timeoutMs: 3000,
    maxOutputBytes: 8192,
    ...options,
  });

test("Muse discovery follows installed PATH beside launcher when sandbox remaps LocalAppData", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "reflection-muse-discovery-"));
  try {
    writeFileSync(resolve(directory, "muse.cmd"), "@echo off\n");
    writeFileSync(resolve(directory, ".muse-version"), "1.4.13-R6996.1\n");
    const binary = resolve(directory, "muse-bin-1.4.13-R6996.1.exe");
    writeFileSync(binary, "test fixture only");
    assert.equal(
      discoverMuseExecutable({
        platform: "win32",
        environment: { LOCALAPPDATA: resolve(directory, "remapped"), PATH: directory },
      }),
      binary,
    );
    writeFileSync(resolve(directory, ".muse-version"), "../../outside");
    assert.equal(
      discoverMuseExecutable({ platform: "win32", environment: { PATH: directory } }),
      null,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("captures actual process exit separately from claimed completion", async () => {
  const result = await invoke("failure");
  assert.equal(result.exit_code, 7);
  assert.equal(result.process_stopped, true);
  assert.equal(result.timed_out, false);
  assert.match(result.stdout, /completed/);
});

test("timeout stops the process before caller may route a replacement", async () => {
  const result = await invoke("hang", { timeoutMs: 150 });
  assert.equal(result.timed_out, true);
  assert.equal(result.process_stopped, true);
  assert.ok(result.duration_ms < 6000);
});

test("explicit cancellation stops an owned running process", async () => {
  const controller = new AbortController();
  const running = invoke("hang", { signal: controller.signal });
  setTimeout(() => controller.abort(), 150);
  const result = await running;
  assert.equal(result.cancelled, true);
  assert.equal(result.process_stopped, true);
});

test("pre-cancelled request does not launch its process", async () => {
  const result = await invoke("hang", { signal: AbortSignal.abort() });
  assert.equal(result.cancelled, true);
  assert.equal(result.exit_code, null);
  assert.equal(result.process_stopped, true);
  assert.equal(result.spawn_error, null);
});

test("unbounded output is capped and the process is stopped", async () => {
  const result = await invoke("flood", { maxOutputBytes: 128 });
  assert.equal(result.output_limit, true);
  assert.equal(result.process_stopped, true);
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 128);
});

test("output byte cap stays bounded across a partial UTF-8 character", async () => {
  const result = await invoke("unicode", { maxOutputBytes: 4 });
  assert.equal(result.output_limit, true);
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 4);
});

test("missing executable reports unavailable instead of quota", async () => {
  const result = await runProcess({ file: resolve(cwd, "does-not-exist.exe"), args: [], cwd });
  assert.equal(result.exit_code, null);
  assert.equal(result.process_stopped, true);
  assert.equal(result.spawn_error.code, "ENOENT");
});

test("no-shell runner rejects Windows command wrappers and non-string arguments", async () => {
  await assert.rejects(runProcess({ file: "muse.cmd", args: [], cwd }), /ERR_NO_SHELL/);
  await assert.rejects(
    runProcess({ file: process.execPath, args: [12], cwd }),
    /ERR_PROCESS_ARGUMENT/,
  );
});

test("redacts common secrets including tokens split across child writes", async () => {
  const result = await invoke("secret", {
    env: { REFLECTION_TEST_API_KEY: "private-test-value-321" },
  });
  assert.ok(!result.stdout.includes("sk-secret-value"));
  assert.ok(!result.stdout.includes("private-test-value-321"));
  assert.match(result.stdout, /\[REDACTED\]/);
  assert.equal(redact("Authorization: Bearer secret123"), "Authorization: Bearer [REDACTED]");
  assert.equal(
    redact('{"access_token":"private123","api_key":"opaque456"}'),
    '{"access_token":"[REDACTED]","api_key":"[REDACTED]"}',
  );
  assert.equal(redact("output opaque-pa", ["opaque-password-full"]), "output [REDACTED]");
});

test("JSONL mock parser validates all events and rejects drift", () => {
  const events = parseJsonl(
    '{"type":"start","run_id":"r"}\r\n{"type":"error","error":{"code":"quota_exceeded"}}\n',
    { mode: "mock" },
  );
  assert.equal(events.length, 2);
  assert.equal(events[1].error.code, "quota_exceeded");
  assert.throws(() => parseJsonl('{"type":"unexpected"}', { mode: "mock" }), /ERR_EVENT_SCHEMA/);
  assert.throws(
    () => parseJsonl('{"type":"error","error":"bad"}', { mode: "mock" }),
    /ERR_EVENT_SCHEMA/,
  );
  assert.throws(() => parseJsonl("not json", { mode: "mock" }), /ERR_EVENT_SCHEMA/);
  assert.throws(() => parseJsonl("", { mode: "mock" }), /ERR_EVENT_SCHEMA/);
});

test("Muse command requires verified installed flags and keeps sandbox enabled", () => {
  const flags = [
    "--provider",
    "--json",
    "--prompt-file",
    "--workspace",
    "--model",
    "--reasoning-effort",
    "--max-model-steps",
    "--session-id",
    "--contributor-mode",
    "--disable-approval",
    "--sandbox-network",
    "--trust-workspace",
    "--no-foreign-personal-context",
    "--disable-web-tools",
    "--disable-reminders",
    "--disable-request-user-input",
  ];
  const probe = {
    available: true,
    executable: process.execPath,
    version: "1.4.13 (R6996.1)",
    flags,
  };
  const command = buildMuseCommand({
    probe,
    promptFile: fixture,
    workspace: cwd,
    provider: "echo",
    model: "muse-spark-1.3",
    maxModelSteps: 3,
  });
  assert.equal(command.file, process.execPath);
  assert.equal(command.cwd, cwd);
  assert.equal(command.env.MUSE_NO_AUTO_UPDATE, "1");
  assert.ok(command.args.includes("--contributor-mode"));
  assert.equal(command.args[command.args.indexOf("--contributor-mode") + 1], "off");
  assert.equal(command.args[command.args.indexOf("--sandbox-network") + 1], "restricted");
  assert.ok(!command.args.includes("--yolo"));
  assert.ok(!command.args.includes("--disable-sandbox"));
  assert.throws(
    () =>
      buildMuseCommand({
        probe: { ...probe, flags: [] },
        promptFile: fixture,
        workspace: cwd,
        provider: "echo",
        model: "x",
        maxModelSteps: 3,
      }),
    /ERR_MUSE_PROFILE/,
  );
  assert.throws(
    () =>
      buildMuseCommand({
        probe: { ...probe, available: false },
        promptFile: fixture,
        workspace: cwd,
        provider: "echo",
        model: "x",
        maxModelSteps: 3,
      }),
    /ERR_MUSE_PROFILE/,
  );
  assert.ok(existsSync(command.args[command.args.indexOf("--prompt-file") + 1]));
  const versionSeven = buildMuseCommand({
    probe,
    promptFile: fixture,
    workspace: cwd,
    provider: "echo",
    model: "muse-spark-1.3",
    maxModelSteps: 3,
    sessionId: "01a178d1-7021-7d20-a4bc-00077146ea68",
  });
  assert.ok(versionSeven.args.includes("01a178d1-7021-7d20-a4bc-00077146ea68"));
  assert.throws(
    () =>
      buildMuseCommand({
        probe,
        promptFile: fixture,
        workspace: cwd,
        provider: "echo",
        model: "x",
        maxModelSteps: 3,
        sessionId: "not-a-session",
      }),
    /ERR_MUSE_PROFILE/,
  );
});

const envelope = (
  payload_type,
  payload,
  sequence = 1,
  stream = { kind: "session", id: "session-a" },
) => ({
  schema_version: 1,
  payload_schema_version: 1,
  id: `record-${stream.kind}-${sequence}`,
  stream,
  sequence,
  recorded_at: sequence,
  record_type: "event",
  durability: "durable",
  payload_type,
  payload,
});
test("actual Muse envelope profile permits independent stream sequences and extracts completion", () => {
  const rows = capturedMuseRows();
  const events = parseJsonl(rows.map(JSON.stringify).join("\n"), { mode: "muse" });
  const expectedWorkspace = rows.find((e) => e.payload_type === "session.workspace_branch.observed")
    .payload.record.workspace_root;
  const expectedSessionId = rows[0].stream.id;
  const summary = summarizeMuseEvents(events, { expectedWorkspace, expectedSessionId });
  assert.equal(summary.completed, true);
  assert.equal(summary.session_id, expectedSessionId);
  assert.equal(
    summary.run_id,
    rows.find((e) => e.payload_type === "session.run.linked").payload.run_stream.id,
  );
  assert.equal(summary.error, null);
  assert.equal(summary.usage.input_tokens, 0);
  assert.equal(summary.usage.allowance, null);
  assert.equal(summary.usage.cost_usd, null);
});

test("Muse unknown protocol versions, payload shapes and duplicate sequence fail closed", () => {
  const row = envelope("run.terminal.completed", { kind: "run_terminal", terminal: "completed" });
  assert.throws(
    () => parseJsonl(JSON.stringify({ ...row, schema_version: 2 }), { mode: "muse" }),
    /ERR_EVENT_SCHEMA/,
  );
  assert.throws(
    () => parseJsonl(JSON.stringify({ ...row, payload_type: "run.future" }), { mode: "muse" }),
    /ERR_EVENT_SCHEMA/,
  );
  assert.throws(
    () =>
      parseJsonl(JSON.stringify({ ...row, payload: { kind: "other", terminal: "completed" } }), {
        mode: "muse",
      }),
    /ERR_EVENT_SCHEMA/,
  );
  assert.throws(
    () => parseJsonl([row, row].map(JSON.stringify).join("\n"), { mode: "muse" }),
    /ERR_EVENT_SCHEMA/,
  );
  const captured = capturedMuseRows();
  captured[1].id = captured[0].id;
  assert.throws(
    () => parseJsonl(captured.map(JSON.stringify).join("\n"), { mode: "muse" }),
    /ERR_EVENT_SCHEMA/,
  );
});

test("Muse partial output and human error text are never treated as quota proof or completion", () => {
  const started = envelope("run.lifecycle.started", { kind: "run_started" });
  assert.equal(
    summarizeMuseEvents(parseJsonl(JSON.stringify(started), { mode: "muse" })).completed,
    false,
  );
  const rows = capturedMuseRows();
  const terminal = rows.find((event) => event.payload_type === "run.terminal.completed");
  terminal.payload_type = "run.terminal.failed";
  terminal.payload.terminal = "failed";
  terminal.payload.reason = "quota maybe?";
  const summary = summarizeMuseEvents(
    parseJsonl(rows.map(JSON.stringify).join("\n"), { mode: "muse" }),
  );
  assert.equal(summary.completed, false);
  assert.equal(summary.error.code, "MUSE_TERMINAL_FAILED");
  assert.equal(summary.error.quota_exhausted, undefined);
  assert.equal(summary.usage.cost_usd, null);
});

function capturedMuseRows() {
  return readFileSync(
    new URL("../../research/agents/muse-cli-probe/echo.stdout.jsonl", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
}

test("Muse completion correlates every session, run, command, task and expected workspace", () => {
  const mutations = [
    (rows) => {
      rows.find((e) => e.payload_type === "run.terminal.completed").payload.run_stream.id =
        "foreign-run";
    },
    (rows) => {
      rows.find((e) => e.payload_type === "run.terminal.completed").payload.command_id =
        "foreign-command";
    },
    (rows) => {
      rows.find((e) => e.payload_type === "run.usage").stream.id = "foreign-session";
    },
    (rows) => {
      rows.find((e) => e.payload_type === "run.output.delta").causation_id = "foreign-command";
    },
    (rows) => {
      rows.find((e) => e.payload_type === "task.lifecycle.completed").payload.event.task_id =
        "foreign-task";
    },
    (rows) => {
      rows.find(
        (e) => e.payload_type === "session.workspace_branch.observed",
      ).payload.record.workspace_root = "C:\\another-workspace";
    },
    (rows) => {
      rows.splice(
        rows.findIndex((e) => e.payload_type === "session.run.linked"),
        1,
      );
    },
  ];
  for (const mutate of mutations) {
    const rows = capturedMuseRows();
    const expectedWorkspace = rows.find(
      (e) => e.payload_type === "session.workspace_branch.observed",
    ).payload.record.workspace_root;
    const expectedSessionId = rows[0].stream.id;
    mutate(rows);
    const summary = summarizeMuseEvents(
      parseJsonl(rows.map(JSON.stringify).join("\n"), { mode: "muse" }),
      { expectedWorkspace, expectedSessionId },
    );
    assert.equal(summary.completed, false);
    assert.equal(summary.error.code, "MUSE_PROVENANCE_MISMATCH");
    assert.equal(summary.usage, null);
  }
  const rows = capturedMuseRows();
  const events = parseJsonl(rows.map(JSON.stringify).join("\n"), { mode: "muse" });
  assert.equal(
    summarizeMuseEvents(events, { expectedSessionId: "wrong-session" }).completed,
    false,
  );
  assert.equal(summarizeMuseEvents(events, { expectedWorkspace: "C:\\other" }).completed, false);
});
