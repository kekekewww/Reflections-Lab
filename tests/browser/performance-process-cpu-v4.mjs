// Reported cumulative process CPU endpoints only. This is not callback/DSP CPU.
const MAX_PROCESSES = 1024;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

function readEndpoint(value, side) {
  if (!object(value) || !Array.isArray(value.processInfo) || value.processInfo.length === 0)
    return { status: "NOT_MEASURED", reason: `PROCESS_ENDPOINT_MISSING:${side}` };
  if (value.processInfo.length > MAX_PROCESSES)
    return { status: "UNVERIFIED", reason: `PROCESS_OBSERVATION_CAP:${side}` };
  const rows = new Map();
  for (const row of value.processInfo) {
    if (
      !object(row) ||
      !["id", "type", "cpuTime"].every((key) => Object.hasOwn(row, key)) ||
      !positiveId(row.id) ||
      typeof row.type !== "string" ||
      row.type.trim().length === 0 ||
      !finite(row.cpuTime) ||
      row.cpuTime < 0
    )
      return { status: "UNVERIFIED", reason: `PROCESS_ROW_SCHEMA:${side}` };
    // A PID is unique within one endpoint, even if a duplicate row changes type.
    if (rows.has(row.id)) return { status: "UNVERIFIED", reason: `DUPLICATE_PROCESS_ID:${side}` };
    rows.set(row.id, row);
  }
  return { rows };
}

export function summarizeProcessCpuDeltaV4(before, after, options) {
  const wallMilliseconds =
    object(options) && finite(options.wallMilliseconds) && options.wallMilliseconds > 0
      ? options.wallMilliseconds
      : null;
  const scope =
    object(options) && typeof options.scope === "string" && options.scope.trim().length > 0
      ? options.scope
      : null;
  const base = {
    scope,
    wallMilliseconds,
    completeCoverage: false,
    totalCpuSeconds: null,
    cpuToWallRatio: null,
    nativeDspCpuMs: null,
    hardwareUnderruns: null,
    coverageScope: "MATCHED_ENDPOINT_PROCESS_SETS_ONLY_NOT_CONTINUOUS_CPU_COVERAGE",
  };
  const unavailable = (status, reason, processes = null) => ({
    ...base,
    status,
    reasons: [reason],
    processes,
  });
  try {
    if (wallMilliseconds === null || scope === null)
      return unavailable("UNVERIFIED", "EXPLICIT_MONOTONIC_INTERVAL_AND_SCOPE_REQUIRED");
    const wallSeconds = wallMilliseconds / 1000;
    if (!Number.isFinite(wallSeconds) || wallSeconds <= 0)
      return unavailable("UNVERIFIED", "WALL_INTERVAL_NOT_REPRESENTABLE");
    const initial = readEndpoint(before, "before");
    if (!initial.rows) return unavailable(initial.status, initial.reason);
    const final = readEndpoint(after, "after");
    if (!final.rows) return unavailable(final.status, final.reason);

    const ids = [...new Set([...initial.rows.keys(), ...final.rows.keys()])].sort((a, b) => a - b);
    let changedSet = false,
      invalidCounter = false;
    const processes = ids.map((id) => {
      const previous = initial.rows.get(id),
        current = final.rows.get(id);
      let status = "OBSERVED",
        deltaCpuSeconds = null;
      if (!previous) {
        status = "NEW_PROCESS";
        changedSet = true;
      } else if (!current) {
        status = "DISAPPEARED_PROCESS";
        changedSet = true;
      } else if (previous.type !== current.type) {
        status = "PROCESS_TYPE_CHANGED";
        changedSet = true;
      } else if (previous.cpuTime === 0 || current.cpuTime === 0) {
        // Pinned Chromium substitutes TimeDelta(0) for failed native CPU queries.
        // A zero cumulative reading has no validity bit; never infer idle CPU.
        status = "ZERO_CUMULATIVE_COUNTER_AMBIGUOUS";
        invalidCounter = true;
      } else if (current.cpuTime < previous.cpuTime) {
        status = "CPU_COUNTER_RESET";
        invalidCounter = true;
      } else {
        deltaCpuSeconds = current.cpuTime - previous.cpuTime;
        if (!Number.isFinite(deltaCpuSeconds) || deltaCpuSeconds < 0) {
          status = "CPU_DELTA_NOT_REPRESENTABLE";
          invalidCounter = true;
          deltaCpuSeconds = null;
        }
      }
      return {
        id,
        type: current?.type ?? previous.type,
        beforeType: previous?.type ?? null,
        afterType: current?.type ?? null,
        beforeCpuSeconds: previous?.cpuTime ?? null,
        afterCpuSeconds: current?.cpuTime ?? null,
        deltaCpuSeconds,
        status,
      };
    });
    if (changedSet || invalidCounter)
      return unavailable(
        changedSet ? "PARTIAL_PROCESS_COVERAGE" : "UNVERIFIED",
        changedSet ? "PROCESS_ENDPOINT_IDENTITY_SET_CHANGED" : "PROCESS_CPU_COUNTER_NOT_VERIFIED",
        processes,
      );
    const totalCpuSeconds = processes.reduce((sum, row) => sum + row.deltaCpuSeconds, 0);
    const cpuToWallRatio = totalCpuSeconds / wallSeconds;
    if (!Number.isFinite(totalCpuSeconds) || !Number.isFinite(cpuToWallRatio))
      return unavailable("UNVERIFIED", "DERIVED_CPU_TOTAL_OR_RATIO_NOT_FINITE", processes);
    return {
      ...base,
      status: "OBSERVED",
      reasons: [],
      completeCoverage: true,
      totalCpuSeconds,
      cpuToWallRatio,
      processes,
    };
  } catch {
    return unavailable("UNVERIFIED", "PROCESS_ENDPOINT_INPUT_UNREADABLE");
  }
}
