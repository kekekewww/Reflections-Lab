// Observation summaries only. These finite-or-null values neither qualify a
// workload nor replace the original metric/reference and acceptance gates.
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const duration = (value) => Number.isFinite(value) && value >= 0;
const text = (value) => typeof value === "string" && value.length > 0;

function completeValues(value, select = (entry) => entry, valid = duration) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const result = [];
  for (const entry of value) {
    const selected = select(entry);
    if (!valid(selected)) return null;
    result.push(selected);
  }
  return result;
}
function aggregate(values, kind) {
  if (values === null) return null;
  let result = values[0];
  if (kind === "mean") {
    for (let index = 1; index < values.length; index++)
      result += (values[index] - result) / (index + 1);
  } else {
    for (let index = 1; index < values.length; index++)
      result = kind === "min" ? Math.min(result, values[index]) : Math.max(result, values[index]);
  }
  return Number.isFinite(result) ? result : null;
}
function observations(rows, field) {
  return completeValues(rows, (row) => row?.[field], count);
}
function counters(value) {
  if (
    !object(value) ||
    !["calls", "successfulCalls", "failedCalls"].every((key) => count(value[key]))
  )
    return null;
  return {
    calls: value.calls,
    successfulCalls: value.successfulCalls,
    failedCalls: value.failedCalls,
  };
}
function interpolationObservation(value) {
  if (
    !object(value) ||
    !text(value.requiredMethod) ||
    !Array.isArray(value.observedMethods) ||
    value.observedMethods.length === 0 ||
    !object(value.byMethod)
  )
    return null;
  const observedMethods = [];
  for (const method of value.observedMethods) {
    if (!text(method) || observedMethods.includes(method)) return null;
    observedMethods.push(method);
  }
  const total = counters(value);
  if (total === null) return null;
  const byMethod = [];
  for (const [method, entry] of Object.entries(value.byMethod)) {
    const measured = counters(entry);
    if (!text(method) || measured === null) return null;
    byMethod.push([method, measured]);
  }
  if (
    byMethod.length === 0 ||
    observedMethods.some((method) => !Object.hasOwn(value.byMethod, method))
  )
    return null;
  return {
    requiredMethod: value.requiredMethod,
    observedMethods,
    ...total,
    aggregateScope: text(value.aggregateScope) ? value.aggregateScope : null,
    byMethod: Object.fromEntries(byMethod),
  };
}
function summarizeUI(ui) {
  const frames = completeValues(ui?.frame, (row) => row?.timestamp, Number.isFinite);
  const calls = count(ui?.interpolationCalls) ? ui.interpolationCalls : null;
  const ratio = calls !== null && frames !== null ? calls / frames.length : null;
  return {
    interpolationObservation: interpolationObservation(ui?.interpolationObservation),
    interpolationMs: completeValues(ui?.interpolationMs),
    interpolationCallsPerPresentedFrame: Number.isFinite(ratio) ? ratio : null,
    peakNativeVoices: aggregate(observations(ui?.audioTelemetry, "activeVoices"), "max"),
    peakNativePaths: aggregate(observations(ui?.audioTelemetry, "activePaths"), "max"),
  };
}
function summarizePhysics(physics) {
  const contacts = completeValues(physics?.contacts, (value) => value, count);
  const awake = completeValues(physics?.awakeBodies, (value) => value, count);
  const events = completeValues(physics?.events, (value) => value, count);
  const preWake = observations(physics?.loadMaintenance, "nativePreWakeSleepingBodies");
  const postWake = observations(physics?.loadMaintenance, "nativePostWakeSleepingBodies");
  const postStep = completeValues(physics?.nativePostStepSleepingBodies, (value) => value, count);
  return {
    maxContactPairs: aggregate(contacts, "max"),
    minContactPairs: aggregate(contacts, "min"),
    meanContactPairs: aggregate(contacts, "mean"),
    minAwakeBodies: aggregate(awake, "min"),
    meanAwakeBodies: aggregate(awake, "mean"),
    maxEventsPerStep: aggregate(events, "max"),
    minNativePreWakeSleepingBodies: aggregate(preWake, "min"),
    maxNativePreWakeSleepingBodies: aggregate(preWake, "max"),
    maxNativePostWakeSleepingBodies: aggregate(postWake, "max"),
    maxNativePostStepSleepingBodies: aggregate(postStep, "max"),
  };
}
function cadence(rows) {
  if (!Array.isArray(rows) || rows.length === 0)
    return { actualCompletedHz: null, deadlineMissedBatches: null, cadenceStatus: "NOT_OBSERVED" };
  let complete = true,
    knownMiss = false,
    misses = 0,
    priorCompleted = -Infinity;
  const completions = [];
  for (const row of rows) {
    const timingValid =
      duration(row?.scheduledAtMs) &&
      duration(row?.completedAtMs) &&
      row.completedAtMs >= row.scheduledAtMs;
    const deadlineKnown = typeof row?.deadlineMissed === "boolean";
    const computedMiss = timingValid ? row.completedAtMs - row.scheduledAtMs > 50 : null;
    if (row?.deadlineMissed === true || computedMiss === true) knownMiss = true;
    if (!timingValid || !deadlineKnown || row.deadlineMissed !== computedMiss) complete = false;
    else if (row.deadlineMissed) misses++;
    if (!timingValid || row.completedAtMs <= priorCompleted) completions.push(null);
    else completions.push(row.completedAtMs);
    if (timingValid) priorCompleted = row.completedAtMs;
  }
  let actualCompletedHz = null;
  if (completions.length > 1 && completions.every(Number.isFinite)) {
    const elapsedMs = completions.at(-1) - completions[0];
    const measured = (completions.length - 1) / (elapsedMs / 1000);
    if (elapsedMs > 0 && Number.isFinite(measured)) actualCompletedHz = measured;
  }
  return {
    actualCompletedHz,
    deadlineMissedBatches: complete ? misses : null,
    cadenceStatus: knownMiss
      ? "DEADLINE_MISSES"
      : complete
        ? "ALL_UPDATES_COMPLETED_IN_20HZ_WINDOWS"
        : "UNVERIFIED",
  };
}
function summarizeAcousticProfile(profile) {
  const rows = profile?.raw;
  const returnedPaths = observations(rows, "returnedPaths");
  const nativePaths = completeValues(rows, (row) => row?.nativeAudio?.activePaths, count);
  const nativeVoices = completeValues(rows, (row) => row?.nativeAudio?.activeVoices, count);
  return {
    profileId: text(profile?.profileId) ? profile.profileId : null,
    ...cadence(rows),
    maxReturnedPaths: aggregate(returnedPaths, "max"),
    minReturnedPaths: aggregate(returnedPaths, "min"),
    minNativePaths: aggregate(nativePaths, "min"),
    maxNativePaths: aggregate(nativePaths, "max"),
    minNativeVoices: aggregate(nativeVoices, "min"),
  };
}

export function summarizeProbeObservationsV4(input = {}) {
  const { ui, physics, acousticProfiles } = object(input) ? input : {};
  const acoustic = [];
  if (Array.isArray(acousticProfiles))
    for (const profile of acousticProfiles) acoustic.push(summarizeAcousticProfile(profile));
  return { ui: summarizeUI(ui), physics: summarizePhysics(physics), acousticProfiles: acoustic };
}
