import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIVE_AUDIO_SUITES,
  NATIVE_AUDIO_CASE_COUNT,
  parseCrossEngineArgs,
} from "./cross-engine.config.mjs";
import { classifySuiteOutcome, summarizeEngineResults } from "./cross-engine-report.mjs";

const fixture = NATIVE_AUDIO_SUITES[0];
const capabilities = Object.fromEntries(
  [
    "offlineAudioContext",
    "nativeNodes",
    "offlineSuspend",
    "offlineResume",
    "periodicWave",
    "audioContext",
    "webCrypto",
    "decodeAudioData",
  ].map((key) => [key, true]),
);
const success = {
  status: "PASS",
  checks: fixture.cases.map(({ id }) => ({
    id,
    pass: true,
    evidence: { measured: 0.123, tolerance: 1e-5 },
  })),
};
test("preparation is the default and only an explicit run flag permits launching", () => {
  assert.equal(parseCrossEngineArgs([]).run, false);
  assert.equal(parseCrossEngineArgs(["--prepare"]).run, false);
  assert.equal(parseCrossEngineArgs(["--run", "--engines", "firefox,webkit"]).run, true);
  assert.throws(() => parseCrossEngineArgs(["--engines", "safari"]));
  assert.throws(() => parseCrossEngineArgs(["--install"]));
});
test("metadata targets exactly the original twenty-five unique fixture IDs", () => {
  const ids = NATIVE_AUDIO_SUITES.flatMap((s) => s.cases.map((c) => c.id));
  assert.equal(NATIVE_AUDIO_CASE_COUNT, 25);
  assert.equal(new Set(ids).size, 25);
});
test("a full native return preserves raw evidence and original pass/fail decisions", () => {
  const result = classifySuiteOutcome(fixture, { value: success, capabilities });
  assert.equal(result.status, "PASS");
  assert.equal(result.raw, success);
  assert.deepEqual(
    result.cases.map((x) => x.status),
    fixture.cases.map(() => "PASS"),
  );
  const failed = {
    ...success,
    status: "FAIL",
    checks: success.checks.map((c, i) =>
      i ? c : { ...c, pass: false, evidence: { measured: 4, tolerance: 1e-5 } },
    ),
  };
  const observed = classifySuiteOutcome(fixture, { value: failed, capabilities });
  assert.equal(observed.status, "FAIL");
  assert.equal(observed.raw.checks[0].evidence.tolerance, 1e-5);
  assert.equal(observed.cases[0].status, "FAIL");
});
test("missing results, empty pass returns and omitted cases can never count as passed", () => {
  for (const value of [
    undefined,
    { status: "PASS", checks: [] },
    { ...success, checks: success.checks.slice(1) },
  ])
    assert.notEqual(classifySuiteOutcome(fixture, { value, capabilities }).status, "PASS");
});
test("unsupported timed-offline API is distinct from unrelated cases not reached by an aggregate suite", () => {
  const pause = NATIVE_AUDIO_SUITES.find((x) => x.id === "pause"),
    result = classifySuiteOutcome(pause, {
      capabilities: { ...capabilities, offlineSuspend: false },
    });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.cases[0].status, "BLOCKED_CAPABILITY");
  assert.equal(result.cases.at(-1).status, "NOT_RUN_AGGREGATE_DEPENDENCY");
  assert.equal(result.cases.filter((c) => c.status === "PASS").length, 0);
});
test("only explicit unsupported or permission evidence is classified as blocked", () => {
  assert.equal(
    classifySuiteOutcome(fixture, {
      capabilities,
      error: { name: "NotSupportedError", message: "native unavailable" },
    }).status,
    "BLOCKED",
  );
  assert.equal(
    classifySuiteOutcome(fixture, {
      capabilities,
      error: { name: "TypeError", message: "readonly createOscillator" },
    }).status,
    "ERROR",
  );
  assert.equal(
    classifySuiteOutcome(fixture, {
      capabilities,
      timedOut: true,
      diagnostics: { liveContexts: [{ resumePending: true, state: "suspended" }] },
    }).classification,
    "ENVIRONMENT_BLOCKED",
  );
  assert.equal(
    classifySuiteOutcome(fixture, {
      capabilities,
      timedOut: true,
      diagnostics: { liveContexts: [] },
    }).status,
    "ERROR",
  );
});
test("a failed or absent capability probe is a harness error rather than unsupported audio", () => {
  assert.equal(classifySuiteOutcome(fixture, { capabilities: {} }).status, "ERROR");
  const failed = classifySuiteOutcome(fixture, {
    capabilities: {},
    error: { name: "TypeError", message: "Module fetch failed before native API probe" },
  });
  assert.equal(failed.status, "ERROR");
  assert.equal(failed.classification, "HARNESS_OR_RUNTIME_EXCEPTION");
});
test("duplicated suites cannot replace missing original native coverage", () => {
  const suites = ["baseline", "pause", "pause", "late", "continuity", "continuity"].map((id) => {
    const suite = NATIVE_AUDIO_SUITES.find((value) => value.id === id);
    return classifySuiteOutcome(suite, {
      capabilities,
      value: {
        status: "PASS",
        checks: suite.cases.map(({ id }) => ({ id, pass: true, evidence: {} })),
      },
    });
  });
  assert.equal(suites.flatMap((suite) => suite.cases).length, 25);
  assert.equal(summarizeEngineResults([{ engine: "firefox", suites }], true).status, "ERROR");
});
test("partial capability coverage and changed sources cannot produce a green overall gate", () => {
  const passed = {
    engine: "firefox",
    suites: [classifySuiteOutcome(fixture, { value: success, capabilities })],
  };
  assert.notEqual(summarizeEngineResults([passed], true).status, "PASS");
  const all = {
    engine: "firefox",
    suites: NATIVE_AUDIO_SUITES.map((s) =>
      classifySuiteOutcome(s, {
        capabilities,
        value: {
          status: "PASS",
          checks: s.cases.map(({ id }) => ({ id, pass: true, evidence: {} })),
        },
      }),
    ),
  };
  assert.equal(summarizeEngineResults([all], true).status, "PASS");
  assert.equal(summarizeEngineResults([all], false).status, "ERROR");
  const partial = {
    ...all,
    suites: all.suites.map((s, i) => (i ? s : { ...s, status: "BLOCKED" })),
  };
  assert.equal(summarizeEngineResults([partial], true).exitCode, 2);
});
