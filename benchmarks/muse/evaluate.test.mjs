import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFixtures, evaluateCandidateSource, fixtures } from "./evaluate.mjs";

test("all four trusted fixture references pass independent acceptance", () => {
  assert.equal(fixtures.length, 4);
  for (const fixture of fixtures) {
    const result = evaluateCandidateSource(fixture.id, fixture.reference_source);
    assert.equal(result.status, "PASS", JSON.stringify(result));
    assert.ok(result.checks.length >= 3);
  }
});

test("every deliberately broken candidate is rejected by independent tests", () => {
  for (const fixture of fixtures) {
    const result = evaluateCandidateSource(fixture.id, fixture.broken_source);
    assert.equal(result.status, "FAIL");
    assert.ok(result.checks.some((check) => !check.passed));
  }
});

test("offline comparison contains eight prompt variants without invented model metrics", () => {
  const result = evaluateFixtures();
  assert.equal(result.results.length, 8);
  assert.equal(result.live_evaluation, "NOT RUN");
  for (const row of result.results) {
    assert.equal(row.fixture_reference.status, "PASS");
    assert.equal(row.negative_control.status, "FAIL");
    assert.equal(row.model_metrics.task_success_rate, null);
    assert.equal(row.model_metrics.tokens, null);
    assert.equal(row.model_metrics.cost_usd, null);
    assert.equal(row.model_metrics.latency_ms, null);
    assert.equal(row.model, null);
  }
});

test("unknown fixture and syntactically invalid candidate fail explicitly", () => {
  assert.throws(() => evaluateCandidateSource("unknown", ""), /Unknown fixture/);
  const result = evaluateCandidateSource(fixtures[0].id, "export function {");
  assert.equal(result.status, "FAIL");
  assert.ok(result.compile_errors.length > 0);
});

test("evaluation configuration selects fixtures and rejects unknown strategies", () => {
  const result = evaluateFixtures({
    fixtures: [fixtures[0].id],
    strategies: { B: "Structured Task Contract" },
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].strategy, "B");
  assert.throws(
    () => evaluateFixtures({ fixtures: [fixtures[0].id], strategies: { C: "unknown" } }),
    /strategy/,
  );
});

test("null and undefined exports fail closed instead of skipping acceptance", () => {
  for (const source of ["exports = null;", "exports = undefined;"]) {
    const result = evaluateCandidateSource("typescript-component", source);
    assert.equal(result.status, "FAIL", source);
    assert.ok(result.compile_errors.some((message) => /exports/.test(message)));
    assert.equal(result.expected_check_count, 4);
    assert.equal(result.checks.length, 0);
  }
});
