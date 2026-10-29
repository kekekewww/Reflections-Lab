<!-- english-source: {"path":"docs/09-agents/QUOTA_RESEARCH.md","sha256":"286348d7bce2553c18388572008ad7d9ca1820a86290852e9eab24863140c3b8","translated_at":"2026-10-27T03:44:09.368719Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/QUOTA_RESEARCH.md`](../../09-agents/QUOTA_RESEARCH.md). Source SHA-256: `286348d7bce2553c18388572008ad7d9ca1820a86290852e9eab24863140c3b8`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="額度錯誤與資源查核"></a>
# Quota, Error, and Resource Review

Reviewed: 2026-10-26 (Asia/Taipei); Muse Code **1.4.13 (R6996.1)**. Public documentation, installed CLI help / schema, and actual account responses are recorded separately. This review performed no model inference, payments, upgrades, quota resets, or account changes.

<!-- english-original-anchor --> <a id="分開的資源來源"></a>
## Separate Resource Sources

| Resource | Confirmable observation method | Evidence and limits in this review |
| --- | --- | --- |
| Muse Code subscription | `muse usage --json`; serve protocol `usage/read` / `usage/changed`; exec JSONL `run.usage` | 1.4.13 help and schema reviewed. Actual usage query exited 1: `usage refresh failed (transient)`; remaining quota is **UNKNOWN**, not exhausted. |
| Meta Model API product Runtime | Usage / rate headers in successful responses, actual errors, verified dashboard billing | No model requests / account billing review in this review; credit balance is **UNKNOWN**. No public, verified general API for remaining credits was found. |
| Codex development quota | Official app-server `account/rateLimits/read` / `account/rateLimits/updated`; local app's read-only usage tool | Documentation confirms these methods exist; this does not mean the Harness directly connects to the current Codex session or establishes an OpenAI API balance. Harness adapter availability depends on resource evidence from that run. |

Muse subscriptions apply only to the Muse Code-specific onboarding credential; separately created API keys use pay-as-you-go. Product API credits must not be treated as remaining Muse subscription quota, and unauthorized credentials / plans must not be used to continue a task. [Subscriptions](https://dev.meta.ai/docs/muse-code/subscriptions), [Authentication and billing](https://dev.meta.ai/docs/muse-code/auth)

<!-- english-original-anchor --> <a id="muse-額度資料契約"></a>
## Muse Quota Data Contract

Official changelog: 1.4.0 added serve `usage/read`; 1.4.11 added exec `run.usage`; 1.4.13 added `muse usage`. These are version-specific capabilities and cannot be applied to arbitrary older versions. [Changelog](https://dev.meta.ai/docs/muse-code/changelog)

An actual 1.4.13 `muse schema` export confirms that `SubscriptionUsage` contains `observedAtMs`, `tier`, `window{usedPercent,resetsAtMs,windowDurationMins}`, and `weekly{usedPercent,resetsAtMs}`. Percentages represent usage and may exceed 100; apply `max(0,100-usedPercent)` only when displaying remaining quota. Times are epoch **milliseconds**. These are last-observed data, and the observation time must be displayed. Stale timestamps, a reset time that has passed, missing fields, or a failed query do not support a claim of real-time remaining quota. When `usage/read` has not observed any data, it omits `usage`; do not fill it in as 0%.

The optional `quota{limitKind,resetsAtMs}` in `TurnError` is typed quota detail. The actual schema says it appears only for quota-related stop errors; branch on its presence, rather than only searching the message. The known `limitKind` is `tierLimit`; this enum is open, so retain unknown values and take the conservative branch. Schema fingerprint: `7fddaf646dbc317e5fcac0785e135eb04df14fbb0db1863089dfd6da21730e5b`; JSON file bytes SHA256: `59c3c649418af35b54d4c64153210b2c77f8e0be2e47bf595a0ad33194530894`. These are different. Local observations and sources are fixed in [metadata](../../../research/agents/quota-source-metadata.json). No actual quota-stop frame was obtained, so this is **schema validation**, not a reproduced account exhaustion.

<!-- english-original-anchor --> <a id="錯誤分類與執行政策"></a>
## Error Classification and Execution Policy

| Evidence | Classification | Action |
| --- | --- | --- |
| Muse typed `quota`, or valid, unexpired window / weekly usedPercent ≥100 | Subscription quota stop | Save changes, confirm the old process has stopped, and create a handoff; Codex takeover is allowed. |
| HTTP 429 / `rate_limit_error` | Temporary rate limit | Bounded backoff; a temporary switch is allowed after the attempt / waiting budget is exceeded, with the reason still recorded as RATE_LIMIT. |
| HTTP 402 / `billing_error` | Billing unavailable | Do not retry blindly; it does not directly mean credits are exhausted, as payment / account configuration may be the issue. |
| Verified evidence that billing quota is exhausted | Credit exhausted | Stop live calls using that resource; retain the source and observation time. |
| HTTP 401 / `authentication_error` | Authentication error | Do not retry with guessed keys or switch accounts; save the error, then switch the development executor under policy or mark BLOCKED. |
| HTTP 403 | Permission error | Do not elevate permissions; retain the error and do not label it quota exhausted. |
| HTTP 500 / 503, disconnection | Transient fault | Bounded backoff; switch under the fault policy once limits are exceeded. |
| HTTP 400 / 404 / 413 | Request / resource / size issue | Fix the request; do not repeatedly resend it. It is not quota. |
| HTTP 504 / `gateway_timeout` | Request exceeded the server time limit | Reduce the work or use a suitable streaming / background mode; do not retry the unchanged request indefinitely. |
| Local EPERM, schema drift, unknown exit / text | Local / protocol / unknown error | Stop and retain diagnostics; do not infer quota from a nonzero exit. |

The official error envelope is `error{message,type,param,code}`, where `code` may be null; use status and type as the primary clues. Confirmed examples include `invalid_api_key`, `billing_not_configured`, `rate_limit_exceeded`, `server_shutting_down`, `service_overloaded`, and `backend_unavailable`. There is no evidence that OpenAI's `insufficient_quota` is a fixed Meta code. [Error handling](https://dev.meta.ai/docs/error-handling), [Common errors](https://dev.meta.ai/help/usage-and-limits/common-api-errors)

Rate headers for 429 describe short-term request / token quotas for a team / model. Retries respect the minimum wait in `Retry-After`; otherwise use bounded exponential backoff + jitter. Local policy limits both attempts and total waiting. If `Retry-After` exceeds the remaining wait budget, save and fall back directly instead of resending early. These headers do not establish a dollar balance or available subscription quota. [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits), [Retry cookbook](https://dev.meta.ai/docs/cookbook/error-handling-retry)

Official Codex rate-limit results use `usedPercent`, `windowDurationMins`, and `resetsAt` (epoch **seconds**), and can provide multiple `rateLimitsByLimitId` entries. Do not mix these with Muse's millisecond fields; missing / null means unknown. Automatically consuming reset credits, sending billing nudges, changing spending limits, or bypassing restrictions is prohibited. [Codex App Server](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt)

<!-- english-original-anchor --> <a id="實際驗證範圍"></a>
## Scope of Actual Validation

CLI version, help, and public schema: reviewed. Actual read-only Muse usage query: the [actual failure observation](../../../research/agents/muse-cli-probe/usage-query.json) was a transient failure; no numerical values were obtained. Live reproduction of Muse subscription exhaustion and Meta API balance / 429 / 401 / 503: **NOT RUN**. Fault injection validates mock processes / fixtures and must not be described as provider live quota proof. When the product Meta API is unavailable, data explicitly labeled `offlineFixture` can still be used for tests; the live Meta integration gate remains BLOCKED / NOT RUN.
