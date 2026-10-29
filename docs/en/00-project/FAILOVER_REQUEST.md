<!-- english-source: {"path":"docs/00-project/FAILOVER_REQUEST.md","sha256":"712df3c9a036b3c7ecd98122c4876e0a5cc955cd43186ec3943a51570efec6e6","translated_at":"2026-10-27T03:38:54.963Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/FAILOVER_REQUEST.md`](../../00-project/FAILOVER_REQUEST.md). Source SHA-256: `712df3c9a036b3c7ecd98122c4876e0a5cc955cd43186ec3943a51570efec6e6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="automatic-agent-failover最新使用者需求紀錄"></a>
# Automatic Agent Failover: Latest User Requirements Record

Source: the user's instructions in this session on 2026-10-26. This is an excerpt of requirements with stable acceptance IDs, not model research or test evidence. It applies together with the [original Phase3 attachment](PHASE3_REQUEST.md); in a conflict, the current failover requirements take precedence. Full implementation of the production product, increasing paid spending limits, changing accounts, or pushing is not authorized.

| ID | Authorized requirement |
| --- | --- |
| FR-01 | The normal flow is Codex Orchestrator → Muse Code implementation → Codex verification; when Muse is unavailable, Codex takes over and undergoes independent verification. |
| FR-02 | Distinguish Muse subscription, product Meta API credit, 429, insufficient balance / quota, outage, authentication / permission, and Codex usage. Leave values as unknown when reliable information is unavailable; do not fabricate numbers. |
| FR-03 | For a temporary 429, first use bounded retry / backoff, and fall back only when the original budget would be exceeded; do not increase limits, circumvent restrictions, or switch to unauthorized accounts. |
| FR-04 | Stop dispatching and stop the original writer; preserve the redacted session log / Git diff / checkpoint / unfinished content. Inspect partial changes before taking over, and do not redo completed work. |
| FR-05 | Keep Task, Milestone, Git state, and `/goal` linked; do not claim that the runner can directly invoke its own currently running Session. |
| FR-06 | Do not delete or relax the original Acceptance Criteria / tests / benchmark. Judge results using predefined acceptance checks, deterministic benchmark, and an independent runner / reference / review; identify the limitation if an independent verification surface is missing. |
| FR-07 | Run State includes PENDING / ASSIGNED_MUSE / RUNNING_MUSE / MUSE_QUOTA_EXHAUSTED / HANDOFF_PENDING / ASSIGNED_CODEX / RUNNING_CODEX / VERIFYING / REPAIR_REQUIRED / COMPLETED / BLOCKED. |
| FR-08 | Each task run preserves preferred / actual / previous executor, fallback reason, model / CLI, successful checkpoint, Git revision, modified files, completed criteria, remaining work, verification evidence, and resource usage. |
| FR-09 | If Codex is also unavailable, preserve the state and mark it BLOCKED. When Muse recovers, switch back only at a task / safe checkpoint boundary to avoid repeated switching and concurrent writers. |
| FR-10 | Keep development quota separate from product Meta API quota. Mock / recorded responses / offline fixture testing is allowed, but cannot be called Meta live output; do not replace Meta with the Codex API and then claim verification passed. |
| FR-11 | Actually implement the detector, router, fallback adapter, checkpoint/resume, handoff serializer, budget manager, event logger, and status CLI, integrating with the existing Task / Wiki rather than creating a contradictory task system. |
| FR-12 | Verify at least 12 scenarios: normal operation, 429, quota, failure after partial modifications, Codex takeover, passing the original tests, repair, Muse recovery, both executors unavailable, Wiki/Git provenance, idempotency / mutual exclusion, and offline testing when the product API is exhausted. Keep Mock and Live separate. |

The completion report must list actual triggers, verified quota capabilities, the takeover method, Mock / Live results, unresolved limitations, and executable commands. Documentation claims do not count as implemented functionality; actual behavior is determined by code and reproducible tests. The user instructed that Git / Wiki records be preserved, but the fact that the existing checkout has no HEAD cannot be rewritten as a previously existing commit.

<!-- english-original-anchor --> <a id="本次執行中的最新資源指示"></a>
## Latest Resource Instructions During This Run

On 2026-10-26, the user explicitly stated: “There is currently no Muse quota available to use.” The development MUSE state therefore changes to **exhausted / USER_CONFIRMED**, with 0 available development quota. This is user confirmation, not a claim that the usage API successfully returned a value. Stop dispatching Muse model tasks; the existing Codex continues implementation and acceptance for this phase. Keep Preferred=MUSE and set Active=CODEX; recovery requires a new, trustworthy observation, and switching back is allowed only at a safe task boundary.

Do not infer the product Meta Model API billing / credits from this statement; they remain independently unknown / live NOT RUN. Do not call any paid Muse / Meta models or increase paid spending limits in this phase. The Mock registry must not overwrite this actual resource state.
