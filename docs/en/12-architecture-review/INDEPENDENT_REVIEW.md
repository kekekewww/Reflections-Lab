<!-- english-source: {"path":"docs/12-architecture-review/INDEPENDENT_REVIEW.md","links":"english-relative","translated_at":"2026-10-29T05:34:01Z","sha256":"01edad2688037da63dd3297a7eb3580191af6fa696487d441e3fedc6af4a84f4","executor":"Codex","model_id":null} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/INDEPENDENT_REVIEW.md`](../../12-architecture-review/INDEPENDENT_REVIEW.md). Source SHA-256: `01edad2688037da63dd3297a7eb3580191af6fa696487d441e3fedc6af4a84f4`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="獨立架構驗收審查"></a>
# Independent Architecture Verification Review

Date: 2026-10-29 (Taiwan). Reviewer: an independent Codex agent, with a read-only child reviewer for cost and publication tools. Model ID is unavailable and is not invented. Baseline/current research HEAD: `c210ca882ca8503b322c28884bf1e9f6e9fe126d`. The reviewed changes are the working diff and new files on `research/architecture-review-20261029`; no commit containing them exists yet. Worktree: `C:/Users/kevin/.codex/worktrees/architecture-review-20261029/Meta Hack`. This reviewer did not modify product code, existing tests, shared Wiki, the original workspace or Git history.

<!-- english-original-anchor --> <a id="結論與適用範圍"></a>
## Conclusion and Scope

**Narrow runtime and portable-contract review: PASS; complete integration acceptance: PARTIAL; publication of the baseline full history: BLOCKED.** Root's final complete-quality/browser/integration receipts and review of the final publication ref are still required. This report does not establish a completed merge/push or complete V1.

The original request, validation plan, architecture/gap report, ADR-015, domain research, actual diff/source and relevant receipts were read. Independent processes followed codex-verification. Reviewed product code and tools stayed frozen; the designated integrator corrected documents. This report records only observed judgments and does not declare the task DONE for root.

| Area | Verdict | Direct evidence and limits |
| --- | --- | --- |
| Original workspace isolation | PASS at observation | Read-only Git checks confirmed `D:/Developing/Meta Hack` remained on `codex/sound-behavior-research`, the same c210ca8, with empty porcelain status; worktrees have separate physical roots. Recheck before merging. |
| Product-change scope | PASS | Shared solver/routes limit, type exports in the audio index, new types-only contract. Package/lockfile, existing tests, Scene/Project/Recording schemas and protected V1 documents have no diff. Six cases were added without deleting old oracles or reducing tolerances. |
| Five-second solver/audio boundary | PASS | `solver.ts:271–276` rejects out-of-range configuration early; `routes.ts:48/87/206` share the constant. Default remains two seconds; paths outside a valid budget retain drop/incomplete diagnostics. Independent execution passed all six cases. |
| Portable RenderJob | PASS for contract review | `src/audio/render-contract.ts:27–50` defines rational time mapping and exclusive window/preroll/tail; `:76–128` defines independent graphs after selection while preserving original physics/behavior admission; `:141–186` defines diagnostics, complete publication and cancel/retry identity. No renderer, validator or cloud side effect exists. |
| Recording/main-thread description | PASS for code inspection | `runtime.ts:792–795/924–955` directly solves and appends in the fixed-step callback; `recorder.ts:468–496` clones/counts bytes/validates on the calling thread. Worker sealing does not remove this cost. Research preserves the negative R17 performance result. |
| Research/status honesty | PASS within reviewed scope | Motion, missing bounce/zone producers, complete renderer, ADM, cloud, human and performance limits remain distinct. Historical live evidence does not establish fresh Meta, billing or complete current-code equivalence. See the resolved P2 below. |
| Recomputable costs | PASS arithmetic / PARTIAL actual cost and capacity | All nine rows match the calculator; AI is symbolic and capacity UNVERIFIED. Retention, egress, shared allowances, render backlog and excluded costs are explicit. There is no actual bill or 10,000-user throughput evidence. |
| Full secret-content scan evidence | PARTIAL | The publication reviewer disclosed that original full JSON stdout from two complete scans was not retained. Later summaries/targeted candidate checks cannot substitute for original raw output. No independent acceptance of the complete-content safety conclusion. |
| Full-history publication | BLOCKED | Independent metadata inventory reproduced 13 commits, 8,774 objects, 6,758 blobs, 2,579,720,986 bytes and three blobs above 100 MiB. Ancestors also contain excluded build/cache/archive outputs. Deleting only the latest tree does not remove ancestors. |
| Final regression/merge/remote | PARTIAL / NOT RUN | Root's final full-quality and later browser receipts are pending. This reviewer performed no merge, push or remote CI. The first product-browser failure below must be retained. |

<!-- english-original-anchor --> <a id="重要發現與處理"></a>
## Material Findings and Disposition

**P2 — Incorrect claim of an implemented Worklet lane, RESOLVED.** Initially `ARCHITECTURE.md:7`, `AUDIO_RUNTIME.md:3`, `ARCHITECTURE_GAP_ANALYSIS.md:12` and the overview claimed an optional Worklet lane existed; the Gap listed nonexistent `worklet/controller.ts`. Independent search found no product `addModule`/AudioWorkletProcessor registration. The integrator was notified. Canonical entry points now state native Web Audio is implemented and custom AudioWorklet is planned/research, with the false path removed. Root still owns final English-currentness validation.

**Retain the first browser failure.** Read `.cache/architecture-review/validation/product-process.json`, product.log and actual [browser verification](../../../artifacts/v1/product-e2e-chrome-20261029T052845Z/verification.json)/[results](../../../artifacts/v1/product-e2e-chrome-20261029T052845Z/results.json): build exit 0; product exit 1, three PASS/one FAIL. The first clean launch reached `Explicit capture recovery budget exhausted (8)` in unchanged `product-e2e-refined-v3.spec.ts:367`. Source and bundle matched/stayed stable during the run, and owned processes had zero remaining. This is a real functional-run failure; later success must not erase it. There is no evidence assigning its cause to this five-second change, and the original two-second default is unchanged. Root must decide rerun, baseline attribution and merge gates from actual results; this report does not prefill PASS.

**Publication blockers and scan limits are separate.** Size and excluded-output findings already block a full-history push. Missing original full scan receipts remain PARTIAL; metadata or zero rule hits do not prove absence of secrets. Final new commits/the actual publication ref still need review. No history rewrite or change of publication ancestry was authorized here; preserving local work is a safe state.

No other material defect blocking the narrow code change was found. This does not remove existing missing OnBounce/zone producers, the generation-cooldown research finding, R17 performance failure, normal-100% physical FPS/IME, Hi-x65/D3V hearing, root LICENSE, eligibility or terms gates.

<!-- english-original-anchor --> <a id="獨立實際命令與結果"></a>
## Actual Independent Commands and Results

| Command/check | Actual result |
| --- | --- |
| `node --version` / `npm --version` | v22.17.0 / 11.4.2, matching pinned versions. |
| `node --import tsx --test tests/acoustics-runtime/propagation-limit.test.ts` | Exit 0; TAP tests 6, PASS 6, FAIL 0, cancelled/skipped/todo all zero. Two early rejections, two valid configurations, exactly-five-second path and over-budget drop passed. |
| `npm run typecheck` | Independent process exit 0; stdout invokes `tsc --noEmit`, with no diagnostics. |
| `node scripts/validation/cloud-cost-model.mjs --self-test` / `--markdown` (independent child) | Exit 0; all nine rows exactly match the report. No cloud service or Meta request. |
| `node scripts/validation/publication-audit.mjs --self-test` (independent child) | Exit 0; split-token/GZIP synthetic cases PASS; no secret values printed or archive files extracted. |
| `node scripts/validation/publication-audit.mjs --ref c210ca882ca8503b322c28884bf1e9f6e9fe126d --metadata-only` (independent child) | Exit 0; reproduced full-history inventory and three >100 MiB blockers. Not a content scan. |
| Git diff/status/worktree/input hashes | Actual read-only checks; original workspace clean at the same baseline; no dependency/schema/old-test changes. |

This reviewer did not rerun full `npm run check`, benchmark, browser, native audio, 600-second measurement, cross-device/hearing tests, paid API or deployment. Root's centrally executed receipts must be attached separately; narrow results cannot replace them.

<!-- english-original-anchor --> <a id="契約與來源限制"></a>
## Contract and Source Limitations

Readonly types/literal unions do not validate untrusted JSON, verify hashes, bound memory or implement atomic publication. A future backend still requires safe-integer/intermediate-product checks, sample alignment, prehistory/tail, asset/clock pins, source isolation/nonlinear-master behavior, NaN/Infinity/clipping availability, capability refusal, cancellation races/crashes/retry oracles. No PCM renderer exists in this change, so these runtime conditions are NOT RUN. Contract acceptance means the necessary semantics are reserved explicitly.

Independent spot checks of the [W3C Web Audio 1.1 2026-09-22 WD](https://www.w3.org/TR/2026/WD-webaudio-1.1-20260922/) draft status/incremental direction, [Rapier 0.21 determinism](https://rapier.rs/docs/user_guides/javascript/determinism/) same-version/initialization/order preconditions, and public [Meta models](https://dev.meta.ai/docs/models)/[pricing](https://dev.meta.ai/docs/pricing-rate-limits) match the research qualifications. Access date: 2026-10-29. Official pages do not establish this account's live access, browser support or product capacity.

The cost child reviewer also checked official Workers/R2/Queues/Supabase/Cloud Run/GCS rates without finding a material arithmetic defect. Conclusions remain conditional on stated duty, tokens, steady-state retention, price date, exclusions and unmeasured worker throughput.

<!-- english-original-anchor --> <a id="受驗產品與工具-sha-256"></a>
## Reviewed Product and Tool SHA-256

| Path | SHA-256 |
| --- | --- |
| src/acoustics/limits.ts | `91713abae3b371eff19499040c51488b9c0a35418fbcfef742c2a9688a04fa17` |
| src/acoustics/solver.ts | `81bf485d565cbe15ddacf944130346b55c4048c1cc54dfd4e7ff7b5f7eda83d4` |
| src/audio/routes.ts | `72f8fda5726a29c45ddeabc60f65087f7e9cf5f619de887ef152b28ae90b8a1d` |
| src/audio/index.ts | `c1fde890e91e01b0a9ff33f9efd4ab1467b97376ebf383eb7aa61d7d6fd820e7` |
| src/audio/render-contract.ts | `2ffea48d29e1abf25ab64a267ef7d7c7da338ab1b1b7c4240e4b5a6f0b76e95a` |
| tests/acoustics-runtime/propagation-limit.test.ts | `58a27fa3e9db1ca126d4774b66670cf0ef12fae97b7ccc7307937570bcb9cd1e` |
| scripts/validation/cloud-cost-model.mjs | `f8510ce37800b24cc4e160ba3c5819dc45678a7ca1456ee810b0283d5b4c2408` |
| scripts/validation/publication-audit.mjs | `5bf634aa4d3e0b886837c4b22dcac52b2035371aeb74be9baba337f83b09e699` |

These are actual post-change file hashes, not a future Git commit SHA. Any further reviewed runtime/tool change requires corresponding re-review. Root should link this report and preserve full validation/integration results, without changing this reviewer's PARTIAL/BLOCKED into PASS.
