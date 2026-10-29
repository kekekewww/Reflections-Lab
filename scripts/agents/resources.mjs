import { classifyFailure } from "./failure-policy.mjs";

const finiteNonnegative = (value) => Number.isFinite(value) && value >= 0;
const limit = (value, fallback) => (finiteNonnegative(value) ? value : fallback);

export function initialResources(_policy = {}, options = {}) {
  return {
    started_at_ms: limit(options.nowMs, Date.now()),
    attempts: 0,
    elapsed_ms: 0,
    reserved_usd: 0,
    cost_usd: null,
    input_tokens: null,
    output_tokens: null,
    cached_tokens: null,
    tool_calls: null,
    remaining_quota: null,
  };
}

export function canStartAttempt(resources, policy = {}, options = {}) {
  if (
    !resources ||
    !Number.isSafeInteger(resources.attempts) ||
    resources.attempts < 0 ||
    !finiteNonnegative(resources.started_at_ms) ||
    !finiteNonnegative(resources.elapsed_ms)
  ) {
    return { allowed: false, reason: "INVALID_RESOURCE_STATE" };
  }
  if (!["MUSE", "CODEX"].includes(options.executor)) {
    return { allowed: false, reason: "UNAUTHORIZED_EXECUTOR" };
  }
  const now = limit(options.nowMs, Date.now());
  if (resources.attempts >= limit(policy.max_attempts, 8)) {
    return { allowed: false, reason: "ATTEMPT_BUDGET_EXHAUSTED" };
  }
  const elapsed = Math.max(resources.elapsed_ms ?? 0, now - resources.started_at_ms);
  if (elapsed >= limit(policy.max_elapsed_ms, 600000)) {
    return { allowed: false, reason: "TIME_BUDGET_EXHAUSTED" };
  }
  if (options.mock === true) return { allowed: true, reason: "OFFLINE_ATTEMPT" };
  const development = policy.development ?? policy;
  const cap = limit(development.max_paid_usd, 0);
  const used = Math.max(resources.reserved_usd ?? 0, resources.cost_usd ?? 0);
  if (cap <= used) return { allowed: false, reason: "COST_BUDGET_EXHAUSTED" };
  if (!finiteNonnegative(development.per_attempt_reservation_usd)) {
    return { allowed: false, reason: "UNKNOWN_ATTEMPT_COST" };
  }
  if (used + development.per_attempt_reservation_usd > cap) {
    return { allowed: false, reason: "COST_BUDGET_EXHAUSTED" };
  }
  return { allowed: true, reason: "RESERVED_ATTEMPT" };
}

export function retryDelay(observation, attempt, policy = {}) {
  const failure = classifyFailure(observation);
  if (!failure.retryable) return { allowed: false, delay_ms: null, reason: "NOT_RETRYABLE" };
  const maximum = Math.min(10, limit(policy.max_rate_retries, 2));
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= maximum) {
    return { allowed: false, delay_ms: null, reason: "RETRY_BUDGET_EXHAUSTED" };
  }
  const cap = limit(policy.max_backoff_ms, 30000);
  const base = limit(policy.backoff_ms, 1000);
  const after = failure.retry_after_ms ?? 0;
  if (after > cap) return { allowed: false, delay_ms: null, reason: "RETRY_AFTER_EXCEEDS_BUDGET" };
  const delay = Math.max(after, Math.min(cap, base * 2 ** attempt));
  if (!Number.isFinite(delay)) return { allowed: false, delay_ms: null, reason: "INVALID_BACKOFF" };
  return { allowed: true, delay_ms: delay, reason: "BOUNDED_RETRY" };
}

export function recordUsage(current, reported = {}) {
  const next = { ...current };
  for (const key of [
    "attempts",
    "elapsed_ms",
    "reserved_usd",
    "cost_usd",
    "input_tokens",
    "output_tokens",
    "cached_tokens",
    "tool_calls",
  ]) {
    if (finiteNonnegative(reported[key])) next[key] = (next[key] ?? 0) + reported[key];
  }
  // Remaining provider quota is an observation, never inferred by subtracting local tokens.
  if (reported.remaining_quota_verified === true && finiteNonnegative(reported.remaining_quota)) {
    next.remaining_quota = reported.remaining_quota;
  }
  return next;
}
