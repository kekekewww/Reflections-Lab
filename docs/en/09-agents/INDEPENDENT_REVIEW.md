<!-- english-source: {"path":"docs/09-agents/INDEPENDENT_REVIEW.md","sha256":"1b2bcf8d4b7d259b1ab8801603f6c6bf9e32cd3b347f13cdee7d5ad518f9b2d3","translated_at":"2026-10-27T03:39:43Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/INDEPENDENT_REVIEW.md`](../../09-agents/INDEPENDENT_REVIEW.md). Source SHA-256: `1b2bcf8d4b7d259b1ab8801603f6c6bf9e32cd3b347f13cdee7d5ad518f9b2d3`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="phase-3-harness-獨立審查"></a>
# Phase 3 Harness Independent Review

Review date: 2026-10-26. Reviewer: `/root/harness_review`; process/protocol review: `/root/harness_review/process_review`. Reviewed against the [original Phase 3 requirements](../00-project/PHASE3_REQUEST.md), the latest automatic takeover requirements, and the [implementation plan](../superpowers/plans/2026-10-26-agent-harness.md). The reviewer did not modify the implementation, schemas, or tests and created only this report. Actual inspection found that Git `HEAD` still did not exist; revision was `null`, and no commit was claimed.

**Verdict: the offline Harness, current Codex takeover, and independent acceptance within this review's scope can pass; there are no outstanding P1/P2 findings to fix. Live automatic takeover remains unverified, so this cannot be used to mark the complete Phase 3 live gates PASS.** This review did not run paid models, switch accounts, increase limits, push, or deploy.

<!-- english-original-anchor --> <a id="已修正並複核的問題"></a>
## Issues Fixed and Rechecked

| Issue | Severity | Fix and recheck |
| --- | --- | --- |
| Different `control` roots could reserve the same workspace simultaneously | P1 | Changed to a canonical writer lock for the workspace; duplicate claims across control roots are rejected. `.reflection-agent.lock` may not be included in a writable contract, and only the internal root-level lock is excluded from the content snapshot. |
| Detached child processes could keep writing after the main process exited 0 | P1 | Reproduced with a local one-time child process. When the live path lacks evidence that the process tree has stopped, it becomes BLOCKED before acceptance, retry, or takeover and retains the workspace reservation. Normal exit from `runProcess` still claims only that the direct process has stopped. |
| Sensitive files used fixed text instead of hashes, preventing detection of changes to existing files | P2 | Changed to store actual content hashes without storing sensitive content. Allowed-file content suspected of containing secrets is excluded from snapshots, and acceptance/takeover is rejected. This still does not constitute complete DLP. |
| Validly shaped JSONL could mix other workspace/session/run/command identities; real UUIDv7 sessions were rejected | P2 | All four identity tamper cases based on a real captured echo report `MUSE_PROVENANCE_MISMATCH`, and their usage is not adopted; the original echo and actual UUIDv7 pass. |
| Actual verification/repair artifacts did not match the schema; export could not directly serve as a Wiki projection | P2 | Added schema validation for real artifacts. The bridge reads actual export/state, verifies hashes and repo/control boundaries, freezes an immutable state copy, and then updates through the owner-authenticated Wiki CLI; it does not automatically complete the overall task. |
| Handoff checked only the handoff hash without rejecting changes to the checkpoint or partial edits | P2 | Acknowledge validates checkpoint bytes/hash and the current workspace together; an old handoff cannot be used to bypass unreviewed changes. |
| After a candidate changed following completion, `verify` still returned the old COMPLETED; terminal checkpoint/handoff could rewrite the verification boundary | P2 | The reviewer reproduced the `verify` cache gap. Run/verify/export now share integrity checks for acceptance, verification, checkpoint, and workspace. After completion, checkpoint may only verify and perform a no-op; COMPLETED/BLOCKED cannot transition into a handoff. The implementation side raised the additional terminal API gap in its own review, and the regression was rerun independently. |

<!-- english-original-anchor --> <a id="實際驗證"></a>
## Actual Verification

Every result below was checked against actual stdout and exit code; the test counts must not be added together as a total of unique tests.

| Execution | Result |
| --- | --- |
| `node --test tests/agents/harness.test.mjs tests/agents/artifacts.test.mjs tests/wiki/agent-projection.test.mjs` | 20/20 PASS, exit 0; run before the final two narrow fixes. Covers failure takeover, partial edits, original acceptance, repair, recovery boundaries, product quota isolation, and the real Wiki bridge. |
| `node --test --test-name-pattern='completed cache\|handoff ack\|two control roots\|secret-bearing\|reserved\|path aliases' tests/agents/harness.test.mjs tests/agents/contract.test.mjs` | 6/6 PASS, exit 0; rechecked the shared completed guard, stale handoff, mutual exclusion, and secret snapshots. |
| `node --test --test-name-pattern='executor cannot claim' tests/agents/harness.test.mjs` | 1/1 PASS, exit 0; rejects the internal lock as a writable file. |
| `node --test --test-name-pattern='completed cache' tests/agents/harness.test.mjs` | 1/1 PASS, exit 0 after the final terminal guard fix; includes run/verify/export/checkpoint/handoff. |
| The process reviewer ran `node --test tests/agents/process-runner.test.mjs` | 15/15 PASS, exit 0; also verified four provenance mismatch cases and UUIDv7 with a captured echo. The implementation side's subsequent full gate should still cover the final version. |
| Additional reviewer probe without inference | A mock-only Muse exhausted observation does not affect `runner=muse`; returns `COST_BUDGET_EXHAUSTED`, `LIVE_NOT_RUN`, model calls 0. The old gap involving a candidate changed after completion was first reproduced and then rejected by the regression. |

This report does not replace root's full `npm run check`/`npm run validate:all`. The original core/physics/Wiki/design regressions and all final commands are governed by this phase's raw gate report.

<!-- english-original-anchor --> <a id="規格符合範圍與限制"></a>
## Specification Coverage and Limits

- The control flows for normal Muse→independent verifier and Muse unavailable→same Task/Milestone/goal reference→current Codex implementation→fixed acceptance have evidence from mock subprocesses and the actual local Codex handoff API. A mock executor does not represent real Muse/Codex model implementation.
- Partial content, untracked/no-HEAD states, acceptance hashes, completion criteria, and remaining work are traceable. Workspace, operation, and milestone mutual exclusion is a cooperative protocol; arbitrary malicious processes with the same OS permissions can still damage control data.
- 401/403/402/429/explicit quota/unknown errors are distinguished; retries, repair, output, and elapsed budgets are bounded, and unknown usage remains `null`. Mock/live resource registries are separate; the product Meta API status is not presented as development quota.
- Live Muse code edits, actual subscription quota-stop/recovery, retained session resume/export, containment of arbitrary descendant processes, a nonzero paid ceiling, and product Meta API integration: **NOT RUN/BLOCKED**. There is currently no verifiable OS containment, so live automatic failover must not be claimed to operate safely.
- CLI echo establishes the local transport/envelope profile; it does not establish model quality, superiority of a prompt strategy, model costs, or formal product features. Browser, audio, and actual physics/acoustic product acceptance are outside the scope of this Harness review.
- Workspace snapshots have explicit file-count and capacity limits, and a workspace containing `node_modules` is rejected. Large formal checkouts still require a subsequent adapter/isolation solution; this small fixture cannot be used to infer that a complete product development workspace has been verified.

<!-- english-original-anchor --> <a id="最後審查範圍-hash"></a>
## Final Reviewed Scope Hashes

The following SHA-256 values were read after the final narrow fixes; they do not represent a Git commit or replace the final gate's source manifest.

| File | SHA-256 |
| --- | --- |
| `scripts/agents/engine.mjs` | `8236d1891c81d7f37f612f18567f0a71180d16ca7f401d145f7e73d1e3b2a588` |
| `scripts/agents/store.mjs` | `e0e608c50023976cae3b508357923b1ac14dfe4fd04676eb9d223d96ed788f28` |
| `scripts/agents/process-runner.mjs` | `fd54362f1093632050f4125f7b542296aab8651b404cc8ee3256c2dc87419109` |
| `scripts/agents/contract.mjs` | `dc12b921d009b05a4bbeb1c2741a11437bcb8a7b30f2431ab56f9c3c09202911` |
| `scripts/wiki/agent-projection.mjs` | `4c929a504565968f6a95a17d1f87509cb52b20cb0160ba081c9789f9803a7e20` |

<!-- english-original-anchor --> <a id="最後補充審查context取消與使用者確認零-muse-額度"></a>
## Final Supplementary Review: Context, Cancellation, and User-Confirmed Zero Muse Quota

This review covered only `context-pack.mjs`, the cancellation protocol/signal propagation, and advance takeover with zero Muse quota, added after the preceding report. The project `codex-verification`/`agent-orchestration` Skills were applied; the complete suite was not rerun. The user had confirmed that no Muse quota remained, so Muse was not started and no model calls were made. **No outstanding P1/P2 issues were found in the added scope.**

- The context pack reads only explicitly selected repo text, includes canonical AGENTS only once, and does not promote reference material into operating rules. Defaults are 64 KiB per file and 256 KiB total; exceeding limits is rejected rather than truncated. Hash, UTF-8, binary, secret, symlink, and source-path checks were inspected. `node --test tests/agents/context-pack.test.mjs` **8/8 PASS, exit 0**; the local symlink test also actually passed.
- `run`/`resume`/`verify`/`milestone` propagate AbortSignal. The CLI requests cancellation when JS receives SIGINT/SIGTERM; another CLI can cancel through a request file and 50 ms polling. The process reviewer ran only `node --test --test-name-pattern="second CLI cooperatively cancels" tests/agents/cli.test.mjs`, **1/1 PASS, exit 0**: the mock child actually ran and then stopped, partial edits were retained, status was `BLOCKED/CANCELLED`, attempts 1, no fallback, and the writer reservation was retained. Cancellation of an active verifier/milestone and OS signal delivery were not separately tested in this round; hard kill cannot guarantee a checkpoint, and the live tree-proof limitation remains.
- `node --test --test-name-pattern='confirmed live subscription exhaustion' tests/agents/harness.test.mjs` **1/1 PASS, exit 0**, confirming that known Muse exhaustion routes to the current Codex before CLI startup.
- The actual [user-zero-quota export](../../../artifacts/phase3-user-zero-muse/export.json) was inspected item by item: `QUOTA_EXHAUSTED`→current Codex, original run/goal/milestone retained, attempts **0**, `LIVE_NOT_RUN`, model/CLI versions remain `null`; fixed independent acceptance is PASS. Rechecking the current acceptance/checkpoint/candidate/evidence with `readStatus` returned `UNCHANGED_CHECKPOINT_AND_EVIDENCE`. Task0008's real Wiki projection run ID, immutable state hash, and verifier hashes match; the overall task was still `IN_PROGRESS` at the time.

Further context limits: automatic startup context contains schema/index/now/the relevant task; it **does not automatically expand the latest handoff or the entire Wiki**. When establishing the next formal task's contract at a safe boundary, the Orchestrator must explicitly include the applicable latest handoff in `relevant_files`; the current pack must not be claimed to have automatically completed all source selection required by AGENTS. Regex secret checks are still not complete DLP; 64/256 KiB are the budgets used by the current invocation.

The reviewer also read root's [final raw gate](../../../benchmarks/results/phase3-validation-20261026-final.json): status PASS, all 19 items exit 0; agents 75/75, prompts 12/12, Wiki 53 PASS/1 SKIP. This was inspection of the complete evidence executed by root, not another execution of the full suite by the reviewer, and it does not change the unverified status of any live gate.

The hashes below correspond to the version in this supplementary review and supersede the earlier scope hashes for files with the same names in the table above:

| File | SHA-256 |
| --- | --- |
| `scripts/agents/context-pack.mjs` | `316686fed91dd35875662c9ec362dc8ea4ed8f94802522b7b68cde1a1086f133` |
| `scripts/agents/cancellation.mjs` | `ef770d750f1541c93b890c44411d7aa61cf80bd5a5c788f11246f52e0b02db3c` |
| `scripts/agents/engine.mjs` | `9d809b08e02247216cc1a62c3bd725e3f05bdf2b7e8446b917070933b0370ae8` |
| `scripts/agents/cli.mjs` | `d8152433bf5d49b1ce1f6af4ca4ec86f6a8569ad5ee461acfbc8617d6bd5343c` |
| `scripts/agents/milestone.mjs` | `3b9fe3ae9804af918470f0e8bf609dfdfac2356c2398a37e89b02c5582aa904d` |
