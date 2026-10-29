<!-- english-source: {"path":"docs/09-agents/FAILOVER_POLICY.md","sha256":"0bd84b30308d54b57dfbb3967541e05a54e144c400b0629106a7f71d602a40b5","translated_at":"2026-10-27T03:40:19.256Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/FAILOVER_POLICY.md`](../../09-agents/FAILOVER_POLICY.md). Source SHA-256: `0bd84b30308d54b57dfbb3967541e05a54e144c400b0629106a7f71d602a40b5`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="executor-failover-與資源政策"></a>
# Executor Failover and Resource Policy

> **Current policy as of 2026-10-27: Codex leads; Muse Code is optional.** See [ADR-013](../02-architecture/adr/013-codex-primary-development.md). The Muse-preferred workflow below is retained as an Optional Harness/Phase3 historical profile, not a prerequisite for normal development; restored quota does not automatically switch the project back.

Preferred=MUSE; Fallback=CODEX; Orchestrator=CODEX; Verification=fixed automated tests/reference and isolated review. For interfaces executable on the actual machine, see the [Operating Procedure](CODEX_MUSE_ORCHESTRATION.md); for verified provider capabilities, see [Quota Research](QUOTA_RESEARCH.md). This policy cannot turn live validation that was not run into PASS.

| Evidence/situation | Classification and strategy |
| --- | --- |
| Muse operating normally | Muse executes; the original acceptance criteria are verified separately |
| HTTP 429 without a trustworthy quota signal | RATE_LIMIT; bounded exponential backoff/Retry-After, with total attempts/time still bounded |
| Muse typed quota (window/weekly), or explicit evidence of exhaustion | MUSE_QUOTA_EXHAUSTED; stop writes and snapshot before takeover |
| HTTP 402 billing_not_configured | Billing issue; payment may not be configured or the balance may be insufficient; do not automatically claim subscription exhaustion |
| Explicit API insufficient balance/quota exceeded | Stop for that resource domain; do not switch accounts/raise limits; development and product quotas remain separate |
| HTTP 500/503/temporary network failure | Bounded retries; take over according to the routing policy when the retry budget is insufficient |
| HTTP 504/long-task timeout | Do not blindly resubmit the same expensive work; preserve a checkpoint, reduce scope, or stop |
| 401/invalid API key | AUTHENTICATION; preserve and label it, do not claim quota exhaustion, and do not read/rotate private keys |
| 403 | PERMISSION; do not bypass the sandbox or switch to an unauthorized account |
| Unrecognized error/event schema change | UNKNOWN/PROTOCOL; reject a success determination, retain diagnostics, and do not guess quota |
| Codex also unavailable | Preserve, mark BLOCKED, and stop consuming resources |
| Muse recovers | Update timestamped resource evidence; consider switching back only after the current task finishes or reaches a safe checkpoint |

CLI and API error shapes differ; do not use a piece of model text containing “quota” as the sole basis for a determination. Retain the source of each HTTP status, official error type/code, typed quota, and verified usage/billing metadata separately. A failed `muse usage` is UNKNOWN, not 0% remaining. Percentages represent only the corresponding allowance window; rate headers, token counts, and dollar balances cannot be converted into one another.

<!-- english-original-anchor --> <a id="安全接手順序"></a>
## Safe Takeover Sequence

Stop dispatching → stop the original executor and confirm that the writer has released access → preserve the redacted session log, content and Git snapshot, success criteria/remaining work → update the same Run State → create a handoff → Codex reviews the partial diff → finish the remaining scope → run the original acceptance checks → bounded repair → update task evidence/Wiki. If safety cannot be demonstrated at any step, mark BLOCKED; do not allow two executors to overlap.

Switch back at a task boundary/an explicitly safe checkpoint, retaining previous/actual executor, reason, and event history to avoid switching repeatedly on every retry. Repeated resume does not redo implementation already marked COMPLETED; a checkpoint is not automatic completion, and acceptance still requires confirmation.

<!-- english-original-anchor --> <a id="預算與授權"></a>
## Budget and Authorization

The default monetary budget=0; retry/repair/steps/wall-time/output bytes are all bounded. Leave unknown usage null; label conservative estimates ESTIMATE and state their basis rather than fabricating them. The resource manager is a local scheduling limit and cannot guarantee that provider billing stops immediately; without a reliable per-run cost ceiling, nonzero paid paths should also fail closed. Do not treat a local timeout as a payment guarantee.

Do not automatically increase spending limits, buy credits, switch to unauthorized accounts, or bypass restrictions. `set-resource` records an operator observation, not a live query, and cannot make expired billing information into a trustworthy balance. Switching the development executor does not remove the product Meta integration; live tests lacking quota remain BLOCKED/NOT RUN, while explicitly labeled Mock/offline tests may continue.

