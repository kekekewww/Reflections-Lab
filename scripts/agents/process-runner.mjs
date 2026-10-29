import { spawn, spawnSync } from "node:child_process";
import { join, resolve, isAbsolute, win32 } from "node:path";
import { realpathSync } from "node:fs";
import { performance } from "node:perf_hooks";

const ENV_NAMES = new Set([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "LANG",
  "LC_ALL",
  "TERM",
]);

/** Log sanitization is defense in depth, never permission to log credentials. */
export function redact(value, knownSecrets = []) {
  let output = String(value ?? "");
  for (const secret of knownSecrets.filter((v) => typeof v === "string" && v.length >= 4)) {
    output = output.split(secret).join("[REDACTED]");
    // The output cap can split a known secret at the last captured byte.
    for (let length = Math.min(secret.length - 1, output.length); length >= 4; length--) {
      if (output.endsWith(secret.slice(0, length))) {
        output = output.slice(0, -length) + "[REDACTED]";
        break;
      }
    }
  }
  return output
    .replace(/(Bearer\s+)[^\s"'<>;,]+/gi, "$1[REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]+|EAA[A-Za-z0-9_-]{10,})\b/g, "[REDACTED]")
    .replace(
      /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)["']?\s*[=:]\s*["']?)[^\s"'<>;,}]+/gi,
      "$1[REDACTED]",
    );
}

function childEnvironment(extra = {}) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => ENV_NAMES.has(key.toUpperCase())),
  );
  for (const [key, value] of Object.entries(extra)) {
    if (
      typeof value !== "string" ||
      key.includes("=") ||
      key.includes("\0") ||
      value.includes("\0")
    ) {
      throw new Error("ERR_PROCESS_ARGUMENT: invalid environment entry");
    }
    environment[key] = value;
  }
  environment.MUSE_NO_AUTO_UPDATE = "1";
  return environment;
}

function boundedUtf8(text, maximumBytes) {
  // Streaming decode deliberately leaves a final incomplete code point out.
  // Converting a cut Buffer directly would insert a 3-byte replacement glyph.
  return new TextDecoder("utf-8").decode(Buffer.from(text).subarray(0, maximumBytes), {
    stream: true,
  });
}

function stopOwnedTree(child) {
  if (!child.pid) return { confirmed: true, scope: "not_started" };
  if (process.platform === "win32") {
    const command = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    const result = spawnSync(command, ["/PID", String(child.pid), "/T", "/F"], {
      encoding: "utf8",
      timeout: 2500,
      windowsHide: true,
      shell: false,
    });
    if (result.status === 0) return { confirmed: true, scope: "process_tree", tree_stopped: true };
    // Restricted Windows tokens may deny taskkill while allowing our own child
    // handle to be terminated. This confirms only that handle, never its tree.
    try {
      return { confirmed: child.kill("SIGKILL"), scope: "direct_process", tree_stopped: false };
    } catch {
      return { confirmed: false, scope: "unconfirmed", tree_stopped: false };
    }
  }
  try {
    process.kill(-child.pid, "SIGKILL");
    return { confirmed: true, scope: "process_group", tree_stopped: true };
  } catch (error) {
    return {
      confirmed: error.code === "ESRCH",
      scope: error.code === "ESRCH" ? "process_group" : "unconfirmed",
      tree_stopped: error.code === "ESRCH",
    };
  }
}

/**
 * Starts one owned process without a shell. Never returns success based on JSON.
 * process_stopped confirms direct close, plus tree kill success when stopped.
 * stop_scope explicitly does not promise an OS job sandbox for ordinary exits.
 */
export async function runProcess({
  file,
  args = [],
  cwd,
  timeoutMs = 60000,
  maxOutputBytes = 1024 * 1024,
  signal,
  env = {},
}) {
  if (
    typeof file !== "string" ||
    !file ||
    file.includes("\0") ||
    !Array.isArray(args) ||
    args.some((arg) => typeof arg !== "string" || arg.includes("\0")) ||
    typeof cwd !== "string"
  ) {
    throw new Error("ERR_PROCESS_ARGUMENT: file, string argv and cwd required");
  }
  if (/\.(?:cmd|bat|ps1)$/i.test(file))
    throw new Error("ERR_NO_SHELL: command wrappers are not executable profiles");
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 3600000 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes < 1 ||
    maxOutputBytes > 16 * 1024 * 1024
  ) {
    throw new Error("ERR_PROCESS_ARGUMENT: bounded timeout and output required");
  }
  const started = performance.now();
  const base = {
    exit_code: null,
    signal: null,
    timed_out: false,
    cancelled: false,
    process_stopped: true,
    stdout: "",
    stderr: "",
    duration_ms: 0,
    output_limit: false,
    spawn_error: null,
    stop_scope: "not_started",
    process_tree_stopped: null,
  };
  if (signal?.aborted) return { ...base, cancelled: true };
  const environment = childEnvironment(env);
  const knownSecrets = Object.entries(environment)
    .filter(([key]) => /key|token|secret|password/i.test(key))
    .map(([, value]) => value);
  return await new Promise((resolve) => {
    let child,
      timer,
      stopTimer,
      settled = false,
      stopping = false,
      stopProof = null,
      total = 0;
    const buffers = { stdout: [], stderr: [] };
    function finish(closed) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(stopTimer);
      signal?.removeEventListener("abort", cancel);
      const out = redact(Buffer.concat(buffers.stdout).toString("utf8"), knownSecrets);
      const err = redact(Buffer.concat(buffers.stderr).toString("utf8"), knownSecrets);
      // Redaction may expand short tokens; cap again after sanitization.
      base.stdout = boundedUtf8(out, maxOutputBytes);
      base.stderr = boundedUtf8(err, Math.max(0, maxOutputBytes - Buffer.byteLength(base.stdout)));
      base.process_stopped = closed && (!stopping || stopProof?.confirmed === true);
      base.stop_scope = stopping
        ? (stopProof?.scope ?? "unconfirmed")
        : child?.pid
          ? "direct_process"
          : "not_started";
      base.process_tree_stopped = stopping ? stopProof?.tree_stopped === true && closed : null;
      base.duration_ms = performance.now() - started;
      if (!base.process_stopped) child?.unref();
      resolve(base);
    }
    function stop() {
      if (stopping || settled) return;
      stopping = true;
      stopProof = stopOwnedTree(child);
      stopTimer = setTimeout(() => finish(false), 3000);
    }
    function cancel() {
      base.cancelled = true;
      stop();
    }
    function append(stream, bytes) {
      const remaining = Math.max(0, maxOutputBytes - total);
      if (remaining) buffers[stream].push(bytes.subarray(0, remaining));
      total += bytes.length;
      if (total > maxOutputBytes) {
        base.output_limit = true;
        stop();
      }
    }
    try {
      child = spawn(file, args, {
        cwd,
        env: environment,
        shell: false,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      base.spawn_error = {
        code: error.code ?? "SPAWN_ERROR",
        message: redact(error.message, knownSecrets),
      };
      finish(true);
      return;
    }
    child.stdout.on("data", (bytes) => append("stdout", bytes));
    child.stderr.on("data", (bytes) => append("stderr", bytes));
    child.on("error", (error) => {
      base.spawn_error = {
        code: error.code ?? "SPAWN_ERROR",
        message: redact(error.message, knownSecrets),
      };
    });
    child.on("close", (code, closedSignal) => {
      base.exit_code = base.spawn_error ? null : code;
      base.signal = closedSignal;
      finish(true);
    });
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    timer = setTimeout(() => {
      base.timed_out = true;
      stop();
    }, timeoutMs);
  });
}

function eventError(line, detail) {
  throw new Error(`ERR_EVENT_SCHEMA: line ${line}: ${detail}`);
}

// Pinned to Muse 1.4.13 (R6996.1) captured echo JSONL. Unknown tool/session
// additions require an adapter update; the raw bounded log remains available.
const MUSE_PAYLOADS = new Map([
  ["runtime.command.accepted", "command_accepted"],
  ["session.run.linked", "session_run_linked"],
  ["session.workspace_branch.observed", "workspace_branch_observed"],
  ["turn.input.user", "turn_input_user"],
  ["run.lifecycle.started", "run_started"],
  ["task.stream.linked", "task_stream_linked"],
  ...[
    "proposed",
    "accepted",
    "scheduled",
    "side_effect_intent",
    "started",
    "completed",
    "failed",
    "cancelled",
  ].map((state) => [`task.lifecycle.${state}`, "task_lifecycle"]),
  ["run.output.delta", "run_output_delta"],
  ["run.usage", "run_usage"],
  ...["completed", "failed", "cancelled"].map((state) => [`run.terminal.${state}`, "run_terminal"]),
]);

/** Fixed protocol adapter. Unknown shapes are preserved in logs, never ignored. */
export function parseJsonl(text, { mode = "mock" } = {}) {
  if (!["mock", "muse"].includes(mode)) throw new Error("ERR_EVENT_SCHEMA: unknown protocol mode");
  const lines = String(text)
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length) eventError(0, "no events");
  const sequenceByStream = new Map();
  const recordIds = new Set();
  return lines.map((line, index) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      eventError(index + 1, "invalid JSON");
    }
    if (!event || typeof event !== "object" || Array.isArray(event))
      eventError(index + 1, "event object required");
    if (mode === "mock") {
      if (!["start", "completed", "error"].includes(event.type))
        eventError(index + 1, "unknown mock event type");
      if (
        event.type === "error" &&
        (!event.error || typeof event.error !== "object" || Array.isArray(event.error))
      )
        eventError(index + 1, "structured error required");
    } else {
      if (
        event.schema_version !== 1 ||
        event.payload_schema_version !== 1 ||
        typeof event.id !== "string" ||
        !event.stream ||
        !["session", "run", "task", "exec.usage"].includes(event.stream.kind) ||
        typeof event.stream.id !== "string" ||
        !Number.isSafeInteger(event.sequence) ||
        event.sequence < 1 ||
        typeof event.payload_type !== "string" ||
        !event.payload ||
        typeof event.payload !== "object" ||
        Array.isArray(event.payload)
      )
        eventError(index + 1, "unverified Muse envelope version/shape");
      const expectedKind = MUSE_PAYLOADS.get(event.payload_type);
      if (!expectedKind || event.payload.kind !== expectedKind)
        eventError(index + 1, "unknown Muse payload type/shape");
      if (recordIds.has(event.id)) eventError(index + 1, "duplicate Muse event identity");
      recordIds.add(event.id);
      if (
        event.payload_type.startsWith("run.terminal.") &&
        event.payload.terminal !== event.payload_type.slice("run.terminal.".length)
      )
        eventError(index + 1, "terminal kind mismatch");
      if (
        event.payload_type === "run.usage" &&
        (!Array.isArray(event.payload.models) ||
          event.payload.models.some(
            (model) =>
              !model ||
              ["input_tokens", "cached_tokens", "output_tokens"].some(
                (key) => !Number.isSafeInteger(model[key]) || model[key] < 0,
              ),
          ))
      )
        eventError(index + 1, "invalid token usage");
      const stream = `${event.stream.kind}:${event.stream.id}`;
      if (event.sequence <= (sequenceByStream.get(stream) ?? 0))
        eventError(index + 1, "duplicate or non-monotonic stream sequence");
      sequenceByStream.set(stream, event.sequence);
    }
    return event;
  });
}

function canonicalWorkspace(value) {
  if (typeof value !== "string" || !value || value.includes("\0"))
    throw new Error("workspace missing");
  const windows = /^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\");
  if (!windows && !isAbsolute(value)) throw new Error("workspace must be absolute");
  let canonical = value;
  try {
    canonical = realpathSync(value);
  } catch {
    /* Historical captured roots may no longer exist. */
  }
  return windows
    ? win32
        .normalize(canonical)
        .toLowerCase()
        .replace(/[\\/]+$/, "")
    : resolve(canonical);
}

function museProvenance(events, { expectedWorkspace, expectedSessionId }) {
  const accepted = events.filter((event) => event.payload_type === "runtime.command.accepted");
  const linked = events.filter((event) => event.payload_type === "session.run.linked");
  const started = events.filter((event) => event.payload_type === "run.lifecycle.started");
  if (accepted.length !== 1 || linked.length !== 1 || started.length !== 1)
    throw new Error("one accepted command, linked run and start required");
  const command = accepted[0].payload.command_id;
  const run = linked[0].payload.run_stream?.id;
  if (
    typeof command !== "string" ||
    !command ||
    accepted[0].payload.command_kind !== "turn.submit" ||
    typeof run !== "string" ||
    !run ||
    linked[0].payload.run_stream?.kind !== "run"
  )
    throw new Error("command/run admission identity missing");
  const sessions = new Set(
    events
      .filter((event) => ["session", "exec.usage"].includes(event.stream?.kind))
      .map((event) => event.stream.id),
  );
  if (sessions.size !== 1) throw new Error("mixed or missing session identities");
  const session = [...sessions][0];
  if (expectedSessionId !== undefined && session !== expectedSessionId)
    throw new Error("unexpected session identity");
  const taskLinks = events.filter((event) => event.payload_type === "task.stream.linked");
  const tasks = new Set();
  for (const event of taskLinks) {
    const task = event.payload.task_id;
    if (
      typeof task !== "string" ||
      !task ||
      tasks.has(task) ||
      event.payload.task_stream?.kind !== "task" ||
      event.payload.task_stream?.id !== task
    )
      throw new Error("invalid task stream link");
    tasks.add(task);
  }
  const observedWorkspaces = [];
  for (const event of events) {
    const payload = event.payload;
    if (event.causation_id !== command || payload.command_id !== command)
      throw new Error("mixed command/causation identities");
    if (event.stream.kind === "run" && event.stream.id !== run)
      throw new Error("unexpected run stream");
    if (event.stream.kind === "task" && !tasks.has(event.stream.id))
      throw new Error("unlinked task stream");
    const requiresRun = !["runtime.command.accepted", "session.workspace_branch.observed"].includes(
      event.payload_type,
    );
    if (
      (requiresRun || payload.run_stream) &&
      (payload.run_stream?.kind !== "run" || payload.run_stream?.id !== run)
    )
      throw new Error("mixed or missing run identities");
    if (event.payload_type === "session.workspace_branch.observed") {
      if (payload.record?.command_id !== command)
        throw new Error("workspace command identity mismatch");
      observedWorkspaces.push(canonicalWorkspace(payload.record.workspace_root));
    }
    if (event.payload_type.startsWith("task.lifecycle.")) {
      if (
        !tasks.has(payload.task_id) ||
        payload.task_stream?.kind !== "task" ||
        payload.task_stream?.id !== payload.task_id ||
        payload.event?.task_id !== payload.task_id ||
        payload.event?.kind !== event.payload_type.slice("task.lifecycle.".length)
      )
        throw new Error("mixed task identities/lifecycle");
      if (payload.event.parent_task_id && !tasks.has(payload.event.parent_task_id))
        throw new Error("unlinked parent task");
    }
  }
  if (!observedWorkspaces.length || new Set(observedWorkspaces).size !== 1)
    throw new Error("missing or mixed workspace observations");
  if (
    expectedWorkspace !== undefined &&
    canonicalWorkspace(expectedWorkspace) !== observedWorkspaces[0]
  )
    throw new Error("unexpected workspace");
  return { session, run, command, workspace: observedWorkspaces[0] };
}

/** Reports correlated transport evidence; no error-string quota inference. */
export function summarizeMuseEvents(events, options = {}) {
  let provenance;
  try {
    provenance = museProvenance(events, options);
  } catch (error) {
    return {
      completed: false,
      error: { code: "MUSE_PROVENANCE_MISMATCH", message: redact(error.message) },
      usage: null,
      session_id: null,
      run_id: null,
      command_id: null,
      workspace: null,
    };
  }
  const terminal = events.filter((event) => event.payload_type?.startsWith("run.terminal."));
  const last = terminal.length === 1 ? terminal[0].payload : null;
  const usageEvents = events.filter((event) => event.payload_type === "run.usage");
  const models = usageEvents.at(-1)?.payload.models;
  const usage = models
    ? {
        input_tokens: models.reduce((sum, model) => sum + model.input_tokens, 0),
        cached_tokens: models.reduce((sum, model) => sum + model.cached_tokens, 0),
        output_tokens: models.reduce((sum, model) => sum + model.output_tokens, 0),
        cost_usd: null,
        allowance: usageEvents.at(-1).payload.allowance ?? null,
        models,
      }
    : null;
  return {
    completed: last?.terminal === "completed",
    error:
      last && last.terminal !== "completed"
        ? {
            code: `MUSE_TERMINAL_${last.terminal.toUpperCase()}`,
            message: redact(
              typeof last.reason === "string" ? last.reason : JSON.stringify(last.reason ?? null),
            ),
          }
        : terminal.length > 1
          ? {
              code: "MUSE_MULTIPLE_TERMINALS",
              message: "Ambiguous terminal events; review captured log",
            }
          : null,
    usage,
    session_id: provenance.session,
    run_id: provenance.run,
    command_id: provenance.command,
    workspace: provenance.workspace,
  };
}
