<!-- english-source: {"path":"docs/09-agents/PHASE3_REPORT.md","sha256":"77e57ff7c00f1cb5a93e90d67a6e827b14e38dfb292d5401ab332eceb7c69a22","translated_at":"2026-10-27T03:39:43Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/PHASE3_REPORT.md`](../../09-agents/PHASE3_REPORT.md). Source SHA-256: `77e57ff7c00f1cb5a93e90d67a6e827b14e38dfb292d5401ab332eceb7c69a22`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="phase3-harness-與-failover-交付報告"></a>
# Phase3 Harness and Failover Delivery Report

Inspected/implemented on 2026-10-26; closed on 2026-10-27 (Asia/Taipei). **The offline Harness and current Codex takeover have been implemented and verified; complete Live Muse failover still has BLOCKED items.** The formal Reflection Lab product has not been started.

<!-- english-original-anchor --> <a id="已有直接證據"></a>
## Direct Evidence Available

- Muse 1.4.13/Codex 0.163.0 versions and help have been verified; a real Muse echo subprocess produced 15 JSONL events without model inference.
- An actual Muse usage query encountered a transient failure; subscription remaining=UNKNOWN. The usage/MSP schemas have been verified, but there is no live evidence for the raw exec quota-stop shape, so it cannot be applied by assumption.
- The user subsequently explicitly confirmed that no Muse quota currently remained; status is recorded as USER_CONFIRMED exhausted. The real, non-Mock resource routing [user-zero run](../../../artifacts/phase3-user-zero-muse/export.json) handed off before any Muse startup, attempts=0; the current Codex actually completed the fixture, the original independent acceptance passed, and the result was written back to the Wiki. This is not evidence of an actual Muse quota terminal event.
- Fixed acceptance, detailed Run State, workspace locks, content/Git snapshots, bounded backoff/repair, a current Codex adapter, Milestone resume, and Wiki projection have been implemented.
- The corrected [Mock demo](../../../artifacts/phase3-demo-confirmation-20261026/report.json) passed 8 representative scenarios; agent tests cover all 12 requirement scenarios. The first [failed demo](../../../artifacts/phase3-demo-20261026/report.json) is retained and must not be erased by the new results.
- [Real takeover by the existing Codex](../../../artifacts/phase3-current-codex/proof.json): Mock Muse partial edit + quota → HANDOFF_PENDING → review and acknowledge → this chat actually appended `answer=preserved+2` → original independent acceptance PASS. The original `preserved=40`, same task/milestone/goal, and acceptance hash were retained; the CLI was used to freeze state and update the Wiki Task0008 projection. No additional Codex model was started.
- [Milestone](../../../artifacts/phase3-milestone-result.json) and [subsequent resume](../../../artifacts/phase3-milestone-resume-result.json) reused the same run without redoing completed implementation.
- 8 coding/handoff templates, 3 runtime templates, 5 skills, and offline evaluation of 4 categories × 2 strategies; model quality/tokens/cost remain null.
- The [independent code review](INDEPENDENT_REVIEW.md) reproduced and rechecked the main safety defects; original acceptance was neither deleted nor relaxed.

<!-- english-original-anchor --> <a id="live-限制"></a>
## Live Limits

Actual Muse model implementation, account quota stop/recovery, paid Meta API, SDK runtime, and product Meta live tests are **NOT RUN**. The monetary budget is 0; unknown quota is not credits that may be used automatically.

An ordinary Windows child close cannot prove that all descendants have stopped. Therefore, without process-tree containment evidence after live Muse execution, the state is **BLOCKED**, and another writer is not started automatically. Fallback has been verified for mocks without descendant processes and for cases where disallowed/unavailable status is detected before startup and no writer has been created. This is a substantive limitation preventing complete Live failover from being enabled; it must not be described as "completed live automatic switching."

Product Meta API integration remains in the existing contract and new runtime spec; it is still formal product work to do. Mock/Codex output cannot replace Meta live evidence. Browser/UI/physics/audio E2E, remote CI, and actual competition eligibility remain unverified.

<!-- english-original-anchor --> <a id="操作入口"></a>
## Operating Entry Points

[Operating workflow and two actual examples](CODEX_MUSE_ORCHESTRATION.md), [quota research](QUOTA_RESEARCH.md), [Failover policy](FAILOVER_POLICY.md), [Headless evidence](HEADLESS_EXECUTION.md), and [next product contract](../../../examples/agents/p0-01-scene-contract.json).

```powershell
node scripts/agents/cli.mjs help
node scripts/agents/cli.mjs probe
npm run test:agents
npm run test:prompts
node scripts/agents/cli.mjs demo --output artifacts/new-failover-demo
npm run validate:all
```

The new artifact path must not already exist. The complete gate does not overwrite old Phase1/2 evidence; actual tests, Gates, and limits follow.

<!-- english-original-anchor --> <a id="完整驗證結果"></a>
## Complete Verification Results

[Raw results for 19 commands](../../../benchmarks/results/phase3-validation-20261026-final.json): **19/19 exit0**, retaining every stdout/stderr/exit/duration; the [machine summary and 46 source hashes](../../09-agents/VALIDATION_SUMMARY.json) are available for takeover cross-checking.

| Scope | Actual result |
| --- | --- |
| Agent Harness | **75 PASS / 0 SKIP / 0 FAIL**, real Node mock subprocesses, independent acceptance, CLI cancellation/Milestone/scope/schema/resource guards |
| Prompts/evaluation tools | **12/12 PASS**; 4 categories × 2 strategies, 19 independent checks, 4 negative controls. No model generation; effectiveness/tokens/cost unknown |
| Original core + integration | **32/32 PASS**, including the new recursive agent schema gate/checks against overwriting old evidence |
| Wiki | **53 PASS / 1 SKIP / 0 FAIL**; Windows junction fixture not run; actual Harness export→immutable snapshot→real Wiki CLI update verified |
| Design specification | **14/14 PASS**; canonical 75 tokens/19 components unchanged; no claim of passing browser visual verification |
| Rapier/datasets | **6/6 PASS** basic WASM smoke; datasets **17 PASS / 1 SKIP**, no real data downloads |
| Schemas/tools | 17 schemas compile; typecheck/lint/format/links/research metadata/Emil pinned bytes all PASS |
| Skills | Each of the 5 new skills passed Muse validate and official Codex format validation, 5/5 for each; official format validation was also actually run and passed for all 15 owned Skills, with 8 Emil skills verified separately against fixed bytes. Muse discovery saw 23 project skills, with no diagnostics for the 5 new ones |

The first demo's FAIL and incorrect exit0 diagnosis are retained in Git; subsequent fixes addressed cross-scenario resource contamination and CLI failure exit. Independent review also reproduced and fixed issues including cross-control workspace locks, false conclusions about child-process survival, mixed JSONL identities, artifact/schema mismatch, stale handoff/completed cache, and terminal-operation boundaries. These were not resolved by deleting or relaxing original acceptance.

<!-- english-original-anchor --> <a id="failover-已實際可用的觸發與接手"></a>
## Failover Triggers and Takeover Actually Available

1. When Muse is confirmed exhausted/unavailable or the original resource budget is insufficient, preserve the same task/goal/milestone and establish a handoff **before startup**; the real routing for this user-confirmed 0-quota case had attempts=0.
2. For an already-started mock process, classify errors with formal fixtures, use limited backoff for transient 429, and hand off on explicit quota; preserve partial content, Git diff/untracked preimages, acceptance hashes, logs, and events.
3. The existing Codex reads the handoff and `acknowledge`s it, enters RUNNING_CODEX, completes the remaining scope, then runs `verify`. An Implementation report/exit0 cannot determine COMPLETED.
4. Failure creates a RepairTask, with at most 3 rounds and attempt/time/output caps; when both executors are unavailable or safety cannot be established, the state is BLOCKED. Switching back after Muse recovery happens only at a completed task/safe boundary; existing Codex work is not interrupted.
5. `cancel --run`, SIGINT/SIGTERM, and AbortSignal are wired up; an actual test of a second CLI requesting cancellation stopped the direct child, preserved partial content, completed the checkpoint, and did not start fallback. Forced kill/live descendant processes still cannot guarantee safety.

Verified capabilities for quota sources are: installed-version usage/MSP schemas, an actual failed read-only query, user-confirmed resource status, Mock error classification, and run.usage parsing. **A real raw CLI quota-stop has not yet been reproduced**; MSP `TurnError.quota` is not applied by guesswork. 402 billing can indicate payment configuration and does not always mean exhausted credits; 401/403 do not cause retries with guessed keys, and 429/5xx follow the bounded policy. No costs were increased and no accounts were switched.

The context pack includes AGENTS, Wiki startup, the task, and explicitly selected refs, with 64KiB/file and 256KiB total; the next Task must **explicitly list the latest scoped handoff in relevant_files**. The tool does not automatically crawl the whole Wiki. Workspace snapshots do not support large checkouts containing node_modules; formal build/worktree extensions still require verification.

<!-- english-original-anchor --> <a id="gates-ai"></a>
## Gates A–I

| Gate | Status | Evidence/boundary |
| --- | --- | --- |
| A Research | PASS | Official original text, versions/help, source metadata; unknown account capabilities stated explicitly |
| B Headless | PARTIAL | Real Muse echo and Mock PASS; real Muse model edits BLOCKED due to 0 quota |
| C Task Contract | PARTIAL | Schema, Mock exchange, and actual Codex takeover PASS; real Muse ImplementationResult NOT RUN |
| D Independent Verification | PASS | Fixed independent Node acceptance + actual Codex fixture + isolated review; not product E2E |
| E Repair Loop | PASS | Original acceptance failure→RepairTask→bounded retry, retaining FAIL/PASS artifacts |
| F Repository Safety | PARTIAL | Cooperative locks/paths/secrets/Git preservation PASS; live process tree/nonzero cost ceiling unverified |
| G Runtime AI | PASS (contract foundation) | Original 12 tools, prompts, offline positive/negative examples; product provider/host still unimplemented |
| H Long-term Memory | PASS | Sources/Task projections, checkpoint/handoff, and Now synchronized; historical raw evidence retained |
| I Cross-Agent Handoff | PASS (local recovery) | An Agent without prior context actually read the Wiki and verified state/acceptance and completed resume no-op; no Muse model dispatch |

The [new Agent receipt evidence](../../../artifacts/phase3-fresh-handoff-receipt.json) independently cross-checks the same run/goal/milestone and state/contract/acceptance/verifier/checkpoint hashes; after completion, resume still had revision11, attempts0, and no new event. The difference showing that the report scope was still undergoing closeout updates at receipt is also retained; the historical handoff was not erased. Closeout changes after the initial Git snapshot were saved in subsequent commits.

<!-- english-original-anchor --> <a id="git-與下一步"></a>
## Git and Next Steps

This repo originally had no HEAD; the local branch `codex/phase3-agent-failover` and initial snapshot **038d83d** have been created, preserving both the original Phase1/2 work and this Harness, with no push. Previous runs' null revision was the true state at the time; no fabricated commit was backfilled. The [Git bytes check](../../../artifacts/phase3-git-byte-check.json) confirms that 996 files match the index; `.gitattributes` disables implicit newline conversion to prevent checkout from breaking fixed SHA256 values. There are additional local record commits after the final handoff; the actual `git log` is authoritative.

This chat's `get_goal` observation was null; there was no existing Goal to resume, and no new Goal was created on the user's behalf. The Runner retains the same goal_id/milestone_id; it does not directly control the current product Session's `/goal`.

Task0008 closes only the engineering and verification achievable in this scope; [Task0009](../../../knowledge/tasks/RLAB-TASK-0009.json) retains the BLOCKED Live-model/safe-process-isolation work. The user currently has no Muse quota, Active=Codex, and Muse model dispatch is stopped; the product Meta API remains separately UNKNOWN/NOT RUN. Task0006 remains BACKLOG; the next formal P0-01 contract is ready and will begin after authorization for that task, without redoing research.

Complete file list: [PHASE3_FILE_MANIFEST](../00-project/PHASE3_FILE_MANIFEST.md).
