// Whole-process cumulative CPU for the exact CDP-owned PID whitelist.
// Win32 success flags are required; this does not measure callback/DSP CPU.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile, stat } from "node:fs/promises";
import { isAbsolute, join, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { runProcess as runOwnedProcess } from "../../scripts/agents/process-runner.mjs";

const METHOD = "WIN32_GET_PROCESS_TIMES_V4";
const MAX_PROCESSES = 1024;
const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_UINT64 = 18446744073709551615n;
const HELPER_PATH = fileURLToPath(new URL("./performance-process-times-v4.ps1", import.meta.url));
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const text = (value, maximum) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  value.trim().length > 0 &&
  !/[\x00-\x1f\x7f]/.test(value);
const absolutePath = (value) =>
  typeof value === "string" &&
  !value.includes("\0") &&
  (isAbsolute(value) || win32.isAbsolute(value));
const executable = (value) =>
  absolutePath(value) && /^(?:powershell|pwsh)\.exe$/i.test(win32.basename(value));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const hashString = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const identity = (value) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
const canonicalPath = (value) => win32.normalize(value).toLowerCase();
function requireValue(condition, reason) {
  if (!condition) throw new Error(reason);
}

function ownersFromCdp(value) {
  requireValue(
    object(value) &&
      Array.isArray(value.processInfo) &&
      value.processInfo.length > 0 &&
      value.processInfo.length <= MAX_PROCESSES,
    "OWNED_PID_LIST_REQUIRED_WITHIN_CAP",
  );
  const ids = new Set();
  return value.processInfo.map((row) => {
    requireValue(
      object(row) &&
        Number.isSafeInteger(row.id) &&
        row.id > 0 &&
        row.id <= 4294967295 &&
        text(row.type, 128) &&
        !ids.has(row.id),
      "INVALID_OR_DUPLICATE_OWNED_PID",
    );
    ids.add(row.id);
    return { id: row.id, type: row.type };
  });
}
function buildRequest(value, options) {
  requireValue(
    object(options) &&
      identity(options.requestId) &&
      text(options.scope, 256) &&
      ["before", "after"].includes(options.boundary),
    "REQUEST_ID_BOUNDARY_AND_SCOPE_REQUIRED",
  );
  const request = {
    schemaVersion: 1,
    method: METHOD,
    requestId: options.requestId,
    boundary: options.boundary,
    scope: options.scope,
    processes: ownersFromCdp(value),
  };
  const requestJson = JSON.stringify(request);
  requireValue(Buffer.byteLength(requestJson) <= MAX_REQUEST_BYTES, "REQUEST_BYTE_CAP");
  return { request, requestJson };
}

/** A file argv plan, never a shell command or JSON argv payload. No process is started. */
export function planProcessTimesCaptureV4(cdpResponse, options) {
  const { request, requestJson } = buildRequest(cdpResponse, options);
  requireValue(
    executable(options.powerShellPath) &&
      absolutePath(options.inputPath) &&
      absolutePath(options.cwd),
    "ABSOLUTE_POWERSHELL_INPUT_AND_CWD_REQUIRED",
  );
  return {
    request,
    requestJson,
    processPlan: {
      file: options.powerShellPath,
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        HELPER_PATH,
        "-InputPath",
        options.inputPath,
      ],
      cwd: options.cwd,
      timeoutMs: 5000,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    },
  };
}

async function filePin(path) {
  const metadata = await stat(path);
  requireValue(metadata.isFile(), "PINNED_REGULAR_FILE_REQUIRED");
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return { sha256: hash.digest("hex"), bytes: metadata.size };
}
function helperStopped(processResult) {
  if (!object(processResult) || processResult.process_stopped !== true) return false;
  const forced =
    processResult.timed_out === true ||
    processResult.cancelled === true ||
    processResult.output_limit === true;
  if (forced)
    return (
      processResult.process_tree_stopped === true && processResult.stop_scope === "process_tree"
    );
  return (
    processResult.stop_scope === "direct_process" || processResult.stop_scope === "not_started"
  );
}
function validatePins(pins) {
  requireValue(object(pins), "SOURCE_AND_EXECUTABLE_PINS_REQUIRED");
  for (const name of ["helper", "powerShell"]) {
    const pin = pins[name];
    requireValue(
      object(pin) &&
        absolutePath(pin.path) &&
        hashString(pin.beforeSha256) &&
        hashString(pin.afterSha256) &&
        pin.beforeSha256 === pin.afterSha256,
      "SOURCE_OR_EXECUTABLE_CHANGED",
    );
  }
  requireValue(
    win32.basename(pins.helper.path).toLowerCase() === "performance-process-times-v4.ps1" &&
      executable(pins.powerShell.path),
    "FIXED_HELPER_AND_POWERSHELL_REQUIRED",
  );
}
function ticks(value, allowZero) {
  requireValue(
    typeof value === "string" && /^(?:0|[1-9][0-9]{0,19})$/.test(value),
    "EXACT_UNSIGNED_FILETIME_STRING_REQUIRED",
  );
  const number = BigInt(value);
  requireValue(number <= MAX_UINT64 && (allowZero || number > 0n), "FILETIME_OUT_OF_RANGE");
  return number;
}
function readCapture(value, side, scope) {
  requireValue(object(value) && object(value.request), "RAW_CAPTURE_REQUIRED");
  const request = value.request;
  const expected = buildRequest({ processInfo: request.processes }, request);
  requireValue(
    request.schemaVersion === 1 &&
      request.method === METHOD &&
      request.boundary === side &&
      request.scope === scope &&
      expected.requestJson === value.requestJson &&
      JSON.stringify(request) === value.requestJson,
    "REQUEST_SOURCE_OR_BOUNDARY_MISMATCH",
  );
  requireValue(
    object(value.artifacts) &&
      value.artifacts.requestSha256 === digest(value.requestJson) &&
      value.artifacts.requestAfterSha256 === value.artifacts.requestSha256,
    "REQUEST_HASH_MISMATCH",
  );
  validatePins(value.pins);
  requireValue(
    object(value.timing) &&
      finite(value.timing.startedMonotonicMs) &&
      finite(value.timing.endedMonotonicMs) &&
      value.timing.startedMonotonicMs >= 0 &&
      value.timing.endedMonotonicMs >= value.timing.startedMonotonicMs,
    "CAPTURE_MONOTONIC_BRACKETS_REQUIRED",
  );
  const processResult = value.process;
  requireValue(
    object(processResult) &&
      processResult.exit_code === 0 &&
      processResult.signal === null &&
      processResult.timed_out === false &&
      processResult.cancelled === false &&
      processResult.output_limit === false &&
      processResult.spawn_error === null &&
      processResult.process_stopped === true &&
      processResult.stop_scope === "direct_process" &&
      processResult.process_tree_stopped === null &&
      finite(processResult.duration_ms) &&
      processResult.duration_ms >= 0,
    "HELPER_PROCESS_NOT_SUCCESSFULLY_CLOSED",
  );
  requireValue(
    typeof processResult.stdout === "string" &&
      typeof processResult.stderr === "string" &&
      Buffer.byteLength(processResult.stdout) + Buffer.byteLength(processResult.stderr) <=
        MAX_OUTPUT_BYTES &&
      value.artifacts.stdoutSha256 === digest(processResult.stdout),
    "HELPER_OUTPUT_CAP_OR_HASH_MISMATCH",
  );
  const reply = JSON.parse(processResult.stdout);
  requireValue(
    object(reply) &&
      reply.schemaVersion === 1 &&
      reply.method === METHOD &&
      reply.requestId === request.requestId &&
      Array.isArray(reply.processes) &&
      reply.processes.length === request.processes.length,
    "REPLY_SCHEMA_OR_WHITELIST_MISMATCH",
  );
  const wanted = new Map(request.processes.map((row) => [row.id, row.type]));
  const rows = new Map();
  for (const row of reply.processes) {
    requireValue(
      object(row) && wanted.has(row.id) && wanted.get(row.id) === row.type && !rows.has(row.id),
      "REPLY_UNOWNED_OR_DUPLICATE_PID",
    );
    requireValue(
      row.openSucceeded === true &&
        row.querySucceeded === true &&
        row.closeSucceeded === true &&
        row.openErrorCode === null &&
        row.queryErrorCode === null &&
        row.closeErrorCode === null,
      "WIN32_QUERY_OR_CLOSE_NOT_VERIFIED",
    );
    rows.set(row.id, {
      id: row.id,
      type: row.type,
      creationTimeFileTimeTicks: row.creationTimeFileTimeTicks,
      creation: ticks(row.creationTimeFileTimeTicks, false),
      user: ticks(row.userTimeTicks, true),
      kernel: ticks(row.kernelTimeTicks, true),
    });
  }
  return { rows, pins: value.pins };
}

/**
 * Starts only the fixed helper through the existing bounded owned-process runner.
 * The injectable runner supports source tests; successful DTOs are not native proof.
 */
export async function captureProcessTimesEndpointV4(cdpResponse, options, dependencies = {}) {
  const startedMonotonicMs = performance.now();
  const result = {
    status: "UNVERIFIED",
    reasons: [],
    request: null,
    requestJson: null,
    process: null,
    pins: null,
    artifacts: {},
    timing: { startedMonotonicMs, endedMonotonicMs: null },
    helperLeaseReleasable: true,
    nativeDspCpuMs: null,
    hardwareUnderruns: null,
  };
  let launched = false;
  try {
    requireValue(
      object(options) &&
        absolutePath(options.directory) &&
        options.label === options.boundary &&
        ["before", "after"].includes(options.label),
      "CAPTURE_DIRECTORY_AND_BOUNDARY_REQUIRED",
    );
    const inputPath = join(
      options.directory,
      `${options.label}-${options.requestId}.process-times-request.json`,
    );
    const plan = planProcessTimesCaptureV4(cdpResponse, {
      ...options,
      inputPath,
      cwd: options.directory,
    });
    const run = Object.hasOwn(dependencies, "runProcess")
      ? dependencies.runProcess
      : runOwnedProcess;
    requireValue(typeof run === "function", "OWNED_RUNNER_REQUIRED");
    result.request = plan.request;
    result.requestJson = plan.requestJson;
    // A collision preserves the previous artifact and prevents a second launch.
    await writeFile(inputPath, plan.requestJson, { flag: "wx", encoding: "utf8" });
    result.artifacts = {
      requestPath: inputPath,
      requestSha256: digest(plan.requestJson),
      requestAfterSha256: null,
      stdoutSha256: null,
    };
    requireValue(
      (await filePin(inputPath)).sha256 === result.artifacts.requestSha256,
      "WRITTEN_REQUEST_HASH_MISMATCH",
    );
    result.pins = {
      helper: { path: HELPER_PATH, beforeSha256: null, afterSha256: null },
      powerShell: { path: plan.processPlan.file, beforeSha256: null, afterSha256: null },
    };
    for (const name of ["helper", "powerShell"]) {
      const pin = await filePin(result.pins[name].path);
      result.pins[name].beforeSha256 = pin.sha256;
      result.pins[name].beforeBytes = pin.bytes;
    }
    launched = true;
    result.process = await run(plan.processPlan);
    result.helperLeaseReleasable = helperStopped(result.process);
    if (typeof result.process?.stdout === "string")
      result.artifacts.stdoutSha256 = digest(result.process.stdout);
    for (const name of ["helper", "powerShell"]) {
      const pin = await filePin(result.pins[name].path);
      result.pins[name].afterSha256 = pin.sha256;
      result.pins[name].afterBytes = pin.bytes;
    }
    result.artifacts.requestAfterSha256 = (await filePin(inputPath)).sha256;
    requireValue(
      result.artifacts.requestAfterSha256 === result.artifacts.requestSha256,
      "REQUEST_FILE_CHANGED_DURING_COLLECTION",
    );
    result.timing.endedMonotonicMs = performance.now();
    readCapture(result, options.boundary, options.scope);
    result.status = "OBSERVED";
  } catch (error) {
    result.reasons = [
      typeof error?.message === "string" ? error.message.slice(0, 512) : "OWNED_CPU_CAPTURE_FAILED",
    ];
    if (launched && result.process === null) result.helperLeaseReleasable = false;
  } finally {
    result.timing.endedMonotonicMs = performance.now();
  }
  return result;
}

/** Exact integer delta first; decimal CPU seconds only after subtraction. */
export function summarizeProcessTimesDeltaV4(before, after, options) {
  const wallMilliseconds =
    object(options) && finite(options.wallMilliseconds) && options.wallMilliseconds > 0
      ? options.wallMilliseconds
      : null;
  const scope = object(options) && text(options.scope, 256) ? options.scope : null;
  const base = {
    method: METHOD,
    status: "UNVERIFIED",
    completeCoverage: false,
    scope,
    wallMilliseconds,
    totalCpuSeconds: null,
    cpuToWallRatio: null,
    processes: null,
    nativeDspCpuMs: null,
    hardwareUnderruns: null,
    coverageScope: "MATCHED_ENDPOINT_CDP_OWNED_PID_SETS_ONLY_NOT_CONTINUOUS_CPU_COVERAGE",
  };
  try {
    requireValue(
      wallMilliseconds !== null && scope !== null,
      "EXPLICIT_MONOTONIC_WALL_AND_SCOPE_REQUIRED",
    );
    const wallSeconds = wallMilliseconds / 1000;
    requireValue(finite(wallSeconds) && wallSeconds > 0, "WALL_INTERVAL_NOT_REPRESENTABLE");
    const initial = readCapture(before, "before", scope),
      final = readCapture(after, "after", scope);
    requireValue(
      before.timing.endedMonotonicMs <= after.timing.startedMonotonicMs,
      "PAIRED_ENDPOINT_TIMING_NOT_CHRONOLOGICAL",
    );
    for (const name of ["helper", "powerShell"]) {
      requireValue(
        canonicalPath(initial.pins[name].path) === canonicalPath(final.pins[name].path) &&
          initial.pins[name].beforeSha256 === final.pins[name].beforeSha256,
        "PAIRED_SOURCE_OR_EXECUTABLE_CHANGED",
      );
    }
    const ids = [...new Set([...initial.rows.keys(), ...final.rows.keys()])].sort((a, b) => a - b);
    const processes = [];
    let complete = true,
      totalTicks = 0n;
    for (const id of ids) {
      const previous = initial.rows.get(id),
        current = final.rows.get(id);
      let status = "OBSERVED",
        delta = null;
      if (!previous || !current || previous.type !== current.type) {
        status = "PROCESS_SET_CHANGED";
        complete = false;
      } else if (previous.creationTimeFileTimeTicks !== current.creationTimeFileTimeTicks) {
        status = "PROCESS_IDENTITY_CHANGED";
        complete = false;
      } else if (current.user < previous.user || current.kernel < previous.kernel) {
        status = "CPU_COUNTER_RESET";
        complete = false;
      } else {
        delta = current.user - previous.user + current.kernel - previous.kernel;
        totalTicks += delta;
      }
      processes.push({
        id,
        type: current?.type ?? previous.type,
        status,
        beforeCreationTimeFileTimeTicks: previous?.creationTimeFileTimeTicks ?? null,
        afterCreationTimeFileTimeTicks: current?.creationTimeFileTimeTicks ?? null,
        deltaCpuTicks: delta === null ? null : delta.toString(),
        deltaCpuSeconds: delta === null ? null : Number(delta) / 10000000,
      });
    }
    if (!complete)
      return {
        ...base,
        status: "PARTIAL_PROCESS_COVERAGE",
        reasons: ["PROCESS_SET_IDENTITY_OR_COUNTER_CHANGED"],
        processes,
      };
    const totalCpuSeconds = Number(totalTicks) / 10000000;
    const cpuToWallRatio = totalCpuSeconds / wallSeconds;
    requireValue(
      finite(totalCpuSeconds) && finite(cpuToWallRatio),
      "CPU_TOTAL_OR_RATIO_NOT_FINITE",
    );
    return {
      ...base,
      status: "OBSERVED",
      completeCoverage: true,
      reasons: [],
      processes,
      totalCpuSeconds,
      cpuToWallRatio,
    };
  } catch (error) {
    return {
      ...base,
      reasons: [
        typeof error?.message === "string"
          ? error.message.slice(0, 512)
          : "OWNED_CPU_SUMMARY_FAILED",
      ],
    };
  }
}
