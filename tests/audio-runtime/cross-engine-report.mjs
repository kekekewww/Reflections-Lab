import { NATIVE_AUDIO_SUITES, NATIVE_AUDIO_CASE_COUNT } from "./cross-engine.config.mjs";

export function missingSuiteCapabilities(suite, capabilities) {
  return [...new Set(suite.cases.flatMap((testCase) => testCase.requires))].filter(
    (key) => capabilities?.[key] === false,
  );
}

/** Missing/unsupported checks stay unmeasured. Never change a fixture's numeric decision. */
export function classifySuiteOutcome(suite, observation) {
  const { value, error, timedOut, diagnostics, capabilities = {} } = observation;
  const missing = missingSuiteCapabilities(suite, capabilities);
  const base = {
    suite: suite.id,
    module: suite.module,
    capabilities,
    diagnostics: diagnostics ?? null,
    raw: value ?? null,
    error: error ?? null,
  };
  const unmeasured = (status, classification, reason) => ({
    ...base,
    status,
    classification,
    reason,
    cases: suite.cases.map((testCase) => ({
      id: testCase.id,
      status: missing.some((key) => testCase.requires.includes(key))
        ? "BLOCKED_CAPABILITY"
        : missing.length
          ? "NOT_RUN_AGGREGATE_DEPENDENCY"
          : "NOT_RUN_SUITE_EXCEPTION",
      reason,
    })),
  });
  if (timedOut) {
    const resumePending = diagnostics?.liveContexts?.some(
      (context) => context.resumePending && context.state === "suspended",
    );
    return unmeasured(
      resumePending ? "BLOCKED" : "ERROR",
      resumePending ? "ENVIRONMENT_BLOCKED" : "HARNESS_TIMEOUT",
      resumePending
        ? "Native AudioContext.resume remained pending/suspended; no DSP result was produced"
        : "Suite exceeded its bounded wall-clock deadline; no numerical result is inferred",
    );
  }
  if (error) {
    const unsupported =
      error.name === "NotSupportedError" ||
      (error.name === "EncodingError" &&
        diagnostics?.operations?.some(
          (op) => op.method === "decodeAudioData" && op.status === "rejected",
        ));
    if (unsupported)
      return unmeasured(
        "BLOCKED",
        "NATIVE_CAPABILITY_ERROR",
        "Native engine rejected the requested operation; preserve the original error and codec/stage trace",
      );
    if (error.name === "NotAllowedError" || error.name === "SecurityError")
      return unmeasured(
        "BLOCKED",
        "ENVIRONMENT_BLOCKED",
        "Native permission/security policy rejected the operation",
      );
    return unmeasured(
      "ERROR",
      "HARNESS_OR_RUNTIME_EXCEPTION",
      "The unchanged suite threw; this is not evidence of unsupported DSP or a passing render",
    );
  }
  const unconfirmed = [...new Set(suite.cases.flatMap((testCase) => testCase.requires))].filter(
    (key) => typeof capabilities[key] !== "boolean",
  );
  if (unconfirmed.length)
    return unmeasured(
      "ERROR",
      "INCOMPLETE_CAPABILITY_PROBE",
      `No structural native API evidence for: ${unconfirmed.join(", ")}; absence of probe data is not evidence of unsupported capabilities`,
    );
  if (missing.length)
    return unmeasured(
      "BLOCKED",
      "MISSING_CAPABILITY",
      `Missing native API(s): ${missing.join(", ")}. The unchanged aggregate suite cannot run independently reachable cases.`,
    );
  if (!value || !Array.isArray(value.checks))
    return unmeasured("ERROR", "MISSING_RESULT", "Suite returned no native check list");
  if (value.status === "BLOCKED")
    return unmeasured("BLOCKED", "SUITE_REPORTED_BLOCKED", (value.limitations ?? []).join("; "));
  const expected = new Set(suite.cases.map((testCase) => testCase.id)),
    actual = new Set(value.checks.map((check) => check.id));
  const complete =
    value.checks.length === expected.size &&
    actual.size === expected.size &&
    [...expected].every((id) => actual.has(id));
  if (!complete)
    return unmeasured(
      "ERROR",
      "INCOMPLETE_RESULT",
      "Returned fixture IDs/count do not match the original pinned suite",
    );
  const cases = value.checks.map((check) => ({
    id: check.id,
    status: check.pass === true ? "PASS" : "FAIL",
    evidence: check.evidence,
  }));
  const passed = value.status === "PASS" && cases.every((check) => check.status === "PASS");
  return {
    ...base,
    status: passed ? "PASS" : "FAIL",
    classification: passed ? "NATIVE_CHECKS_PASSED" : "ORIGINAL_THRESHOLD_FAILURE",
    cases,
  };
}

export function summarizeEngineResults(engines, sourceStable) {
  const expected = engines.length * NATIVE_AUDIO_CASE_COUNT;
  const passed = engines.reduce(
    (sum, engine) =>
      sum +
      (engine.suites ?? []).reduce(
        (n, suite) => n + suite.cases.filter((testCase) => testCase.status === "PASS").length,
        0,
      ),
    0,
  );
  const base = {
    requestedEngines: engines.map((engine) => engine.engine),
    expectedChecks: expected,
    passedChecks: passed,
  };
  if (!sourceStable)
    return {
      ...base,
      status: "ERROR",
      exitCode: 1,
      reason: "Pinned audio/harness source bytes changed during execution",
    };
  if (!engines.length || new Set(base.requestedEngines).size !== engines.length)
    return {
      ...base,
      status: "ERROR",
      exitCode: 1,
      reason: "Missing or duplicate engine result rows",
    };
  const invalidCoverage = engines.some((engine) => {
    const rows = engine.suites ?? [];
    if (new Set(rows.map((suite) => suite.suite)).size !== rows.length) return true;
    return rows.some((suite) => {
      const original = NATIVE_AUDIO_SUITES.find((entry) => entry.id === suite.suite);
      if (!original || !Array.isArray(suite.cases)) return true;
      const expectedIds = new Set(original.cases.map((testCase) => testCase.id)),
        actualIds = new Set(suite.cases.map((testCase) => testCase.id));
      return (
        suite.cases.length !== expectedIds.size ||
        actualIds.size !== expectedIds.size ||
        [...expectedIds].some((id) => !actualIds.has(id))
      );
    });
  });
  if (invalidCoverage)
    return {
      ...base,
      status: "ERROR",
      exitCode: 1,
      reason:
        "Duplicate or unexpected suite/fixture IDs cannot replace the original native coverage",
    };
  const suites = engines.flatMap((engine) => engine.suites ?? []);
  if (
    engines.some((engine) => engine.status === "ERROR") ||
    suites.some((suite) => suite.status === "ERROR")
  )
    return { ...base, status: "ERROR", exitCode: 1 };
  if (
    engines.some((engine) => engine.status === "FAIL") ||
    suites.some((suite) => suite.status === "FAIL")
  )
    return { ...base, status: "FAIL", exitCode: 1 };
  const complete = engines.every(
    (engine) =>
      (engine.suites ?? []).length === NATIVE_AUDIO_SUITES.length &&
      engine.suites.every((suite) => suite.status === "PASS"),
  );
  if (complete && passed === expected) return { ...base, status: "PASS", exitCode: 0 };
  return {
    ...base,
    status: passed ? "PARTIAL" : "BLOCKED",
    exitCode: 2,
    reason: "Missing/unsupported/unmeasured cases remain; partial coverage cannot be green",
  };
}
