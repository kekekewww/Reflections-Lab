import { evaluateUIWorkload as originalUIWorkload } from "./performance-profile-v3.mjs";
import { APPROVED_QUALIFICATIONS_V4 } from "./performance-approved-qualifications-v4.mjs";

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
export const PROFILE_METHOD_VERSION_V4 = "4.1.0";
export const PROFILE_SCHEMA_VERSION_V4 = 2;

// Decode explicit versions without migrating or relabeling historical reports.
export function readProfileMethodV4(report) {
  if (report?.methodVersion === "4.0.0" && report.schemaVersion === 1) {
    return {
      methodVersion: "4.0.0",
      schemaVersion: 1,
      beforeEndpointOrder:
        report.probeMode === "off"
          ? "before-beginUI-no-tracing"
          : "before-tracing-start-before-beginUI",
    };
  }
  if (
    report?.methodVersion === PROFILE_METHOD_VERSION_V4 &&
    report.schemaVersion === PROFILE_SCHEMA_VERSION_V4
  ) {
    const beforeEndpointOrder =
      report.probeMode === "off"
        ? "before-beginUI-no-tracing"
        : "after-tracing-start-before-beginUI";
    if (
      report.processCpu?.beforeEndpointOrder !== beforeEndpointOrder ||
      report.processCpu?.excludesTracingStartPreparationCost !== true
    )
      return null;
    return {
      methodVersion: PROFILE_METHOD_VERSION_V4,
      schemaVersion: PROFILE_SCHEMA_VERSION_V4,
      beforeEndpointOrder,
    };
  }
  return null;
}
// Exact inventories of the unchanged evaluators plus the explicit V4
// monitor/resource witnesses produced by performance-profile-v4.
const requiredUIGates = Object.freeze([
  "actual600Seconds",
  "finiteOrderedFrames",
  "frameCollectionMembership",
  "actualInterpolationObserved",
  "noSampleTruncation",
  "noRuntimeOrScriptErrors",
  "uninterruptedSimulation",
  "fixedTickProgress",
  "noDroppedWallTime",
  "noOverrunOrRecordingDebt",
  "acceptedGrabAndThrow",
  "closedWindowNoPending",
  "periodicCaptureCompleted",
  "captureTickSamples",
  "nativeGraphStarted",
  "genuineRunningWarmup",
  "topMonitorSnapshotValid",
  "actualAudioPolicyAtEnable",
  "actualAudioPolicyAtClose",
]);
const requiredPhysicsGates = Object.freeze([
  "exactBodyProfile",
  "fixedStepAndWarmup",
  "completeSamples",
  "awakeDynamicLoad",
  "allDynamicBodiesContacted",
  "observedContactLoad",
  "boundedCatchup",
]);
const requiredAcousticGates = Object.freeze([
  "completeSamples",
  "eightVoicesAdmitted",
  "actualModuleWorker",
  "frozenAcousticMatrix",
  "nativeContextRunning",
  "sustainedRequestedPaths",
  "sustainedEightVoices",
  "cleanNativeState",
  "noNativeCapacityOrStaleLoss",
  "eightSuccessfulNativeStarts",
  "nativeClockAdvances",
  "meets20HzWindows",
  "observableDeliveryIdentity",
  "actualAudioPolicyAtEnable",
  "actualAudioPolicyAtClose",
]);
const requiredAcousticProfiles = Object.freeze([
  Object.freeze({
    profileId: "productDefault",
    isProductDefault: true,
    requestedPathCapPerVoice: 8,
    nativeGraphTargetPaths: 64,
  }),
  Object.freeze({
    profileId: "stress256",
    isProductDefault: false,
    requestedPathCapPerVoice: 32,
    nativeGraphTargetPaths: 256,
  }),
]);
function allRequiredTrue(value, keys) {
  return (
    object(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key) && value[key] === true)
  );
}
function acousticProfilesValid(profiles) {
  if (!Array.isArray(profiles) || profiles.length !== requiredAcousticProfiles.length) return false;
  const seen = new Set();
  for (const profile of profiles) {
    if (!object(profile) || seen.has(profile.profileId)) return false;
    const required = requiredAcousticProfiles.find(
      (entry) => entry.profileId === profile.profileId,
    );
    if (
      !required ||
      profile.isProductDefault !== required.isProductDefault ||
      profile.requestedPathCapPerVoice !== required.requestedPathCapPerVoice ||
      profile.nativeGraphTargetPaths !== required.nativeGraphTargetPaths ||
      !allRequiredTrue(profile.workloadValidity, requiredAcousticGates)
    )
      return false;
    seen.add(profile.profileId);
  }
  return seen.size === requiredAcousticProfiles.length;
}
const count = (value) => Number.isSafeInteger(value) && value >= 0;
function monitorValid(data, expected = {}) {
  const snapshot = data?.topMonitorObservation,
    end = data?.collectionWindow?.endPerformanceMs,
    origin = data?.startedAtPerformanceMs;
  if (
    !object(snapshot) ||
    snapshot.visible !== true ||
    snapshot.observed !== true ||
    snapshot.mode !== (expected.mode ?? "levels") ||
    snapshot.input !== (expected.input ?? "master-left") ||
    !Number.isFinite(end) ||
    !Number.isFinite(origin) ||
    !Number.isFinite(snapshot.normalReadAtPerformanceMs) ||
    snapshot.normalReadAtPerformanceMs < origin ||
    snapshot.normalReadAtPerformanceMs > end ||
    !Number.isFinite(snapshot.sampledAtAudioTimeSeconds) ||
    snapshot.sampledAtAudioTimeSeconds < 0 ||
    !Number.isFinite(snapshot.sampleRateHz) ||
    snapshot.sampleRateHz <= 0 ||
    !Number.isSafeInteger(snapshot.fftSize) ||
    snapshot.fftSize <= 0 ||
    !count(snapshot.analyserNodeCount) ||
    snapshot.analyserNodeCount === 0 ||
    !count(snapshot.tapNodeCount) ||
    snapshot.tapNodeCount < snapshot.analyserNodeCount ||
    !Array.isArray(snapshot.sourceIDs) ||
    snapshot.sourceIDs.length > 6 ||
    snapshot.sourceIDs.some((value) => typeof value !== "string" || value.length === 0) ||
    new Set(snapshot.sourceIDs).size !== snapshot.sourceIDs.length ||
    ![
      "sampledSourceVoices",
      "warmingSourceVoices",
      "unmeasuredNativeVoices",
      "unmeasuredVirtualVoices",
      "unmeasuredPendingVoices",
    ].every((key) => count(snapshot[key]))
  )
    return false;
  const age = end - snapshot.normalReadAtPerformanceMs;
  if (!Number.isFinite(age) || age < 0) return false;
  // A freshness ceiling is an explicit method option, never inferred from the
  // product's maximum 15Hz read rate or substituted for an original threshold.
  if (
    Object.hasOwn(expected, "maxAgeMs") &&
    (!Number.isFinite(expected.maxAgeMs) || expected.maxAgeMs < 0 || age > expected.maxAgeMs)
  )
    return false;
  if (Object.hasOwn(expected, "sampleRateHz") && snapshot.sampleRateHz !== expected.sampleRateHz)
    return false;
  if (Object.hasOwn(expected, "fftSize") && snapshot.fftSize !== expected.fftSize) return false;
  return true;
}

export function evaluateUIWorkloadV4(data, options = {}) {
  // This boolean is the frozen helper's parameter ABI for already-validated
  // membership. The caller's raw V3 result is preserved and never relabeled.
  const coverage = options.traceCoverage ?? {};
  const original = originalUIWorkload(data, {
    ...options,
    traceCoverage: { ...coverage, nativeV3Qualified: coverage.nativeV4Qualified === true },
  });
  return { ...original, topMonitorSnapshotValid: monitorValid(data, options.expectedTopMonitor) };
}

function qualifiedContext(report, options) {
  const record = APPROVED_QUALIFICATIONS_V4.find(
    (entry) => entry.qualificationId === options.qualificationId,
  );
  if (
    !record ||
    record.status !== "APPROVED" ||
    record.scope !== "FORMAL_V4_SEMANTIC_PRECONDITION" ||
    report.semanticPrecondition?.verified !== true ||
    report.semanticPrecondition?.qualificationId !== record.qualificationId ||
    report.semanticPrecondition?.scope !== record.scope ||
    !Array.isArray(report.sourceInputs)
  )
    return false;
  const pins = new Map();
  for (const row of report.sourceInputs) {
    if (
      !object(row) ||
      typeof row.path !== "string" ||
      typeof row.sha256 !== "string" ||
      pins.has(row.path)
    )
      return false;
    pins.set(row.path, row.sha256);
  }
  const observedRevision = report.host?.browserVersionReceipt?.revision;
  return (
    record.requiredSourcePins.every((row) => pins.get(row.path) === row.sha256) &&
    report.host?.executableSha256 === record.executableSha256 &&
    typeof observedRevision === "string" &&
    observedRevision.replace(/^@/, "") === record.producerRevision
  );
}

export function classifyProfileEvidenceV4(report, options = {}) {
  const metrics = Array.isArray(report?.metrics) ? [...report.metrics] : [];
  const originalStatus = typeof report?.status === "string" ? report.status : "UNVERIFIED";
  const failedMetric = metrics.some((entry) => entry?.status === "FAIL");
  const protectedStatus =
    originalStatus === "HISTORICAL_SNAPSHOT_ONLY" ||
    originalStatus.startsWith("FAILED") ||
    originalStatus === "TIMED_OUT" ||
    originalStatus.startsWith("MEASURED_WITH_");
  const executionStatus = protectedStatus
    ? originalStatus
    : failedMetric
      ? "MEASURED_WITH_FAILURES"
      : originalStatus;
  const off = options.probeMode === "off";
  const purpose = off
    ? "PROBE_OVERHEAD_COMPARISON"
    : options.formal === true
      ? "FORMAL_PROFILE"
      : "SHORT_DIAGNOSTIC";
  const closed =
    report?.cleanup?.browserConnected === false &&
    report?.cleanup?.previewProcessStopped === true &&
    Array.isArray(report?.cleanup?.errors) &&
    report.cleanup.errors.length === 0;
  const native = report?.ui?.traceCoverage;
  const profiles = report?.acousticProfiles;
  const formalQualified =
    (!Object.hasOwn(report ?? {}, "methodVersion") || readProfileMethodV4(report) !== null) &&
    !off &&
    options.formal === true &&
    report?.formal600Run === true &&
    !protectedStatus &&
    !failedMetric &&
    report?.sourceStableDuringRun === true &&
    report?.bundleStableDuringRun === true &&
    report?.executableStableDuringRun === true &&
    closed &&
    qualifiedContext(report, options) &&
    allRequiredTrue(report?.ui?.workloadValidity, requiredUIGates) &&
    allRequiredTrue(report?.physics?.workloadValidity, requiredPhysicsGates) &&
    acousticProfilesValid(profiles) &&
    native?.complete === true &&
    native?.nativeV4Qualified === true &&
    metrics.length > 0 &&
    metrics.every((entry) => ["PASS", "MEASURED"].includes(entry?.status));
  return {
    purpose,
    executionStatus,
    status:
      protectedStatus || failedMetric
        ? executionStatus
        : off
          ? "COMPARISON_ONLY_NOT_QUALIFIED"
          : formalQualified
            ? "FORMAL_PROFILE_MEASURED"
            : originalStatus,
    formalQualified,
    formalQualification: formalQualified ? "QUALIFIED_MEASUREMENT" : "NOT_APPROVED",
    qualificationScope: formalQualified ? "ORIGINAL_UI_PHYSICS_ACOUSTIC_PROFILE_ONLY" : null,
    metrics,
    overallV1Complete: false,
  };
}
