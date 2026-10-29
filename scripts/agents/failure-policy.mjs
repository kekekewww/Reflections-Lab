// Only structured error evidence or confirmed billing information establishes exhaustion.
// Free-form model/tool text is deliberately never interpreted as a billing signal.
const exhaustionCodes = new Set([
  "insufficient_quota",
  "quota_exceeded",
  "insufficient_balance",
  "credit_exhausted",
  "subscription_usage_limit",
]);

function retryAfterMilliseconds(observation) {
  if (Number.isFinite(observation.retry_after_ms) && observation.retry_after_ms >= 0) {
    return observation.retry_after_ms;
  }
  const header = observation.retry_after;
  if (typeof header !== "string" && typeof header !== "number") return null;
  const seconds = Number(header);
  if (String(header).trim() !== "" && Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const timestamp = Date.parse(String(header));
  if (!Number.isFinite(timestamp)) return null;
  const now = Number.isFinite(observation.now_ms) ? observation.now_ms : Date.now();
  return Math.max(0, timestamp - now);
}

export function classifyFailure(observation = {}) {
  const code = typeof observation.code === "string" ? observation.code.toLowerCase() : "";
  const status = observation.http_status;
  const developmentMuse = observation.domain === "development" && observation.executor === "MUSE";
  let category = "UNKNOWN";
  let retryable = false;
  let mayFallback = false;
  if (
    status === 401 ||
    code === "authentication_error" ||
    code === "invalid_api_key" ||
    code === "authrequired"
  ) {
    category = "AUTHENTICATION";
  } else if (status === 403 || code === "permission_denied" || code === "permission_error") {
    category = "PERMISSION";
  } else if (
    exhaustionCodes.has(code) ||
    (observation.executor === "MUSE" &&
      observation.provider_quota?.verified === true &&
      observation.provider_quota.limit_kind === "tierLimit" &&
      Number.isSafeInteger(observation.provider_quota.resets_at_ms)) ||
    (observation.explicit_billing?.verified === true &&
      observation.explicit_billing.status === "exhausted")
  ) {
    category = "QUOTA_EXHAUSTED";
    mayFallback = true;
  } else if (status === 402 || code === "billing_not_configured") {
    category = "BILLING_CONFIGURATION";
  } else if (status === 429 || code === "rate_limit_exceeded" || code === "rate_limited") {
    category = "RATE_LIMIT";
    retryable = true;
    mayFallback = true;
  } else if (
    (Number.isInteger(status) && status >= 500 && status <= 599) ||
    code === "service_unavailable"
  ) {
    category = "SERVICE_OUTAGE";
    retryable = true;
    mayFallback = true;
  } else if (code === "enoent" || code === "executor_unavailable") {
    category = "EXECUTOR_UNAVAILABLE";
    mayFallback = true;
  } else if (code === "etimedout" || code === "timeout") {
    category = "TIMEOUT";
    mayFallback = true;
  } else if (code === "cancelled" || observation.signal === "SIGINT") {
    category = "CANCELLED";
  }
  return {
    category,
    quota_exhausted: category === "QUOTA_EXHAUSTED",
    retryable,
    fallback_allowed: developmentMuse && mayFallback,
    reason: category,
    retry_after_ms: retryAfterMilliseconds(observation),
  };
}
