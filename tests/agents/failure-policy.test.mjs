import test from "node:test";
import assert from "node:assert/strict";
import { classifyFailure } from "../../scripts/agents/failure-policy.mjs";
import {
  initialResources,
  canStartAttempt,
  retryDelay,
  recordUsage,
} from "../../scripts/agents/resources.mjs";

test("429 is transient unless a distinct reliable exhaustion code exists", () => {
  const result = classifyFailure({ executor: "MUSE", domain: "development", http_status: 429 });
  assert.equal(result.category, "RATE_LIMIT");
  assert.equal(result.quota_exhausted, false);
  assert.equal(result.retryable, true);
  assert.equal(result.fallback_allowed, true);
});

test("explicit Muse subscription and API balance exhaustion are classified separately from auth", () => {
  for (const code of [
    "subscription_usage_limit",
    "insufficient_quota",
    "quota_exceeded",
    "insufficient_balance",
    "credit_exhausted",
  ]) {
    const result = classifyFailure({
      executor: "MUSE",
      domain: "development",
      http_status: 429,
      code,
    });
    assert.equal(result.category, "QUOTA_EXHAUSTED");
    assert.equal(result.quota_exhausted, true);
    assert.equal(result.retryable, false);
    assert.equal(result.fallback_allowed, true);
  }
  assert.equal(
    classifyFailure({
      executor: "MUSE",
      domain: "development",
      http_status: 402,
      code: "insufficient_balance",
    }).category,
    "QUOTA_EXHAUSTED",
  );
  assert.equal(
    classifyFailure({
      executor: "MUSE",
      domain: "development",
      http_status: 401,
      code: "quota_exceeded",
    }).category,
    "AUTHENTICATION",
  );
  assert.equal(
    classifyFailure({
      executor: "MUSE",
      domain: "development",
      http_status: 403,
      code: "quota_exceeded",
    }).category,
    "PERMISSION",
  );
});

test("arbitrary free text does not establish exhausted quota and secret data is not echoed", () => {
  const result = classifyFailure({
    executor: "MUSE",
    domain: "development",
    exit_code: 1,
    message: "quota exceeded sk-secret123 email@example.com",
  });
  assert.equal(result.category, "UNKNOWN");
  assert.equal(result.quota_exhausted, false);
  assert.equal(result.fallback_allowed, false);
  assert.ok(!JSON.stringify(result).includes("sk-secret123"));
});

test("confirmed billing information can establish exhaustion but an unverified claim cannot", () => {
  assert.equal(
    classifyFailure({
      executor: "MUSE",
      domain: "development",
      explicit_billing: { verified: true, status: "exhausted" },
    }).category,
    "QUOTA_EXHAUSTED",
  );
  assert.equal(
    classifyFailure({
      executor: "MUSE",
      domain: "development",
      explicit_billing: { verified: false, status: "exhausted" },
    }).category,
    "UNKNOWN",
  );
});

test("runtime Meta quota never routes development executor fallback", () => {
  const result = classifyFailure({
    executor: "META_API",
    domain: "product_runtime",
    code: "insufficient_balance",
    http_status: 429,
  });
  assert.equal(result.category, "QUOTA_EXHAUSTED");
  assert.equal(result.fallback_allowed, false);
});

test("temporary service outage and missing executable are distinguishable", () => {
  const outage = classifyFailure({ executor: "MUSE", domain: "development", http_status: 503 });
  assert.equal(outage.category, "SERVICE_OUTAGE");
  assert.equal(outage.retryable, true);
  assert.equal(
    classifyFailure({ executor: "MUSE", domain: "development", code: "ENOENT" }).category,
    "EXECUTOR_UNAVAILABLE",
  );
  assert.equal(
    classifyFailure({ executor: "MUSE", domain: "development", code: "ETIMEDOUT" }).category,
    "TIMEOUT",
  );
  assert.equal(
    classifyFailure({ executor: "MUSE", domain: "development", signal: "SIGINT" }).category,
    "CANCELLED",
  );
});

test("Codex exhaustion does not propose another unauthorized executor", () => {
  const result = classifyFailure({
    executor: "CODEX",
    domain: "development",
    code: "quota_exceeded",
  });
  assert.equal(result.quota_exhausted, true);
  assert.equal(result.fallback_allowed, false);
});

test("retry backoff is finite, exponential and honors Retry-After without early retry", () => {
  const observation = { domain: "development", executor: "MUSE", http_status: 429 };
  assert.deepEqual(retryDelay(observation, 0, {}), {
    allowed: true,
    delay_ms: 1000,
    reason: "BOUNDED_RETRY",
  });
  assert.equal(retryDelay(observation, 1, {}).delay_ms, 2000);
  assert.equal(retryDelay(observation, 2, {}).allowed, false);
  assert.equal(retryDelay({ ...observation, retry_after: "4" }, 0, {}).delay_ms, 4000);
  assert.equal(retryDelay({ ...observation, retry_after: "31" }, 0, {}).allowed, false);
  assert.equal(retryDelay({ ...observation, code: "quota_exceeded" }, 0, {}).allowed, false);
});

test("Retry-After dates and invalid metadata never cause negative or infinite delay", () => {
  const observation = { domain: "development", executor: "MUSE", http_status: 429 };
  assert.equal(retryDelay({ ...observation, retry_after_ms: 1500 }, 0, {}).delay_ms, 1500);
  assert.equal(retryDelay({ ...observation, retry_after: "not a date" }, 0, {}).delay_ms, 1000);
  assert.equal(retryDelay(observation, -1, {}).allowed, false);
  assert.equal(retryDelay(observation, Infinity, {}).allowed, false);
});

test("resource budget permits offline attempts and rejects unknown paid spend at zero cap", () => {
  const state = initialResources({}, { nowMs: 1000 });
  assert.equal(state.cost_usd, null);
  assert.equal(state.input_tokens, null);
  assert.equal(
    canStartAttempt(state, {}, { mock: true, executor: "MUSE", nowMs: 1000 }).allowed,
    true,
  );
  assert.equal(
    canStartAttempt(state, {}, { mock: false, executor: "MUSE", nowMs: 1000 }).allowed,
    false,
  );
});

test("attempt, elapsed and declared cost budgets stop resource consumption", () => {
  let state = initialResources({}, { nowMs: 1000 });
  state = recordUsage(state, { attempts: 2, cost_usd: 0.2, input_tokens: 20, output_tokens: 5 });
  assert.equal(
    canStartAttempt(state, { max_attempts: 2 }, { mock: true, executor: "MUSE", nowMs: 1000 })
      .reason,
    "ATTEMPT_BUDGET_EXHAUSTED",
  );
  assert.equal(
    canStartAttempt(state, { max_elapsed_ms: 100 }, { mock: true, executor: "MUSE", nowMs: 1100 })
      .reason,
    "TIME_BUDGET_EXHAUSTED",
  );
  assert.equal(
    canStartAttempt(state, { max_paid_usd: 0.2 }, { mock: false, executor: "MUSE", nowMs: 1000 })
      .reason,
    "COST_BUDGET_EXHAUSTED",
  );
  assert.equal(state.input_tokens, 20);
  assert.equal(recordUsage(state, {}).input_tokens, 20);
  assert.equal(recordUsage(state, { input_tokens: 10 }).input_tokens, 30);
});

test("malformed persistent resources fail closed rather than bypassing the budget", () => {
  assert.equal(
    canStartAttempt({ attempts: NaN }, {}, { mock: true, executor: "MUSE" }).allowed,
    false,
  );
  const state = initialResources({}, { nowMs: 1000 });
  assert.equal(
    canStartAttempt(state, {}, { mock: true, executor: "UNAUTHORIZED", nowMs: 1000 }).allowed,
    false,
  );
});

test("live authorization requires a declared conservative attempt reservation", () => {
  const state = initialResources({}, { nowMs: 1000 });
  assert.equal(
    canStartAttempt(
      state,
      { development: { max_paid_usd: 1 } },
      { mock: false, executor: "MUSE", nowMs: 1000 },
    ).reason,
    "UNKNOWN_ATTEMPT_COST",
  );
  assert.equal(
    canStartAttempt(
      state,
      { development: { max_paid_usd: 1, per_attempt_reservation_usd: 0.2 } },
      { mock: false, executor: "MUSE", nowMs: 1000 },
    ).allowed,
    true,
  );
});

test("installed Muse typed quota detail establishes exhaustion while billing configuration does not", () => {
  const observation = {
    executor: "MUSE",
    domain: "development",
    provider_quota: { verified: true, limit_kind: "tierLimit", resets_at_ms: 1793000000000 },
  };
  assert.equal(classifyFailure(observation).category, "QUOTA_EXHAUSTED");
  assert.equal(
    classifyFailure({
      ...observation,
      provider_quota: { verified: true, limit_kind: "unknownFutureKind" },
    }).category,
    "UNKNOWN",
  );
  assert.equal(
    classifyFailure({ executor: "MUSE", domain: "development", code: "authRequired" }).category,
    "AUTHENTICATION",
  );
  assert.equal(
    classifyFailure({
      executor: "META_API",
      domain: "product_runtime",
      http_status: 402,
      code: "billing_not_configured",
    }).category,
    "BILLING_CONFIGURATION",
  );
});
