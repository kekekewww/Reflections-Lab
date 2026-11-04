<!-- english-source: {"path":"docs/16-nonadvanced-completion/history/CONTRACT.20261103.v1.md","sha256":"c7d5600193efa1747ce92399834ef26f23c9da8ae7d364c044817a39566e5e0e","translated_at":"2026-11-03T02:23:19.064Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/history/CONTRACT.20261103.v1.md`](../../../16-nonadvanced-completion/history/CONTRACT.20261103.v1.md). Source SHA-256: `c7d5600193efa1747ce92399834ef26f23c9da8ae7d364c044817a39566e5e0e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="非進階候選完整實作與驗證契約2026-11-03"></a>
# Contract for Complete Implementation and Validation of Non-advanced Candidates (2026-11-03)

This round is new ACTIVE work explicitly started by the user. The exact request is in [REQUEST](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/604f542340cce1f28358e638d028cd1a8171fe98); the actual starting point is e25f9f48302fd357b0f97a6f9bf8565f5916627c. The [baseline snapshot](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/447977886ffcba952ce5cc513109b41405dc15e3) pins the original tasks' complete dependencies, criteria, existing flags and source hashes. This is a supplementary execution contract. The original acceptance conditions, formal workload and tolerances remain unchanged; the contract, plans or metadata cannot be claimed as a product pass.

<!-- english-original-anchor --> <a id="範圍與唯一任務權威"></a>
## Scope and Sole Task Authority

The authoritative tasks remain knowledge/tasks/*.json. RLAB-TASK-0032 is the umbrella for this round's authorization, integration and evidence reconciliation. [TASK_OWNERSHIP](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/963e176b49dd66c3d1cbb1f7a1a3a6bd0dad311f) only projects this round's stage/file/resource assignments; it does not create a separate task system. Before the original PERF dependencies are DONE, candidate research and implementation may proceed in parallel under the umbrella. Claiming/closing original tasks must still follow their original dependencies and real evidence for every criterion; do not change dependencies to bypass gates.

| Included in this round | Work and conditions retained |
| --- | --- |
| PERF-001, 014 | Bind source/bundle/browser/hardware/device/rate; attribution, probe overhead, two-stage lifecycle, the original full formal 600-second workload and performance gate |
| PERF-002, 003 | Bounded per-tick evaluation; exact/threshold scalar, shape, delay and direction oracles, with benefit/output comparisons under the same conditions |
| PERF-004, 005 | Separate preview/latest-valid from events/capture that must not be dropped; identity, revision geometry/cache/owned-buffer, timeout/caps and all negative cases |
| PERF-006, 007 | Voice policy preserving phase/cursor/admission; pin/eviction/decode staging in the existing asset store, with actual bytes and rights provenance |
| PERF-008, 011 | Actual chunk encoding/storage, four watermarks and seal ownership; long recordings and long PCM mix/stems output with continuous DSP state |
| Task0020, 0016 | Original requirement-by-requirement, quality/E2E/lifecycle, documentation/English/provenance and external-gate reconciliation; fully include the new UI and full-pipeline requirements |

Advanced Task0015 and PERF-009/010/012 are excluded; cloud PERF-013 is not authorized. The budget for new paid APIs is 0. No push, deployment or acceptance of terms on the user's behalf. Do not ask to repeat the same round of human testing for basic functions the user has already confirmed. Final human subjective observation/listening for new functions follows Claude in the explicitly defined order. Real Meta paid/live use is not authorized; fixtures must not be represented as live.

The complete original PERF conditions are pinned in BASELINE.original_task_snapshots; dependencies and baseline status remain unchanged. The 7 old PROPOSED ADRs do not become ACCEPTED as a batch through this contract. Technical adoption requires an explicit decision/independent evidence. Historical true flags for Task16/20 retain only the scope of their original literal evidence; they do not represent reruns this round.

<!-- english-original-anchor --> <a id="驗證必須分層"></a>
## Validation Must Be Layered

All product tests for this round initially have status NOT_RUN. The 1536 runtime tests, 217 finite parameter families, five 5-second WAVs and historical Computer Use limitations are previous cutoffs; they cannot substitute for new product results or completion of this round's methods. Implementation, unit/numerical tests, real production UI, native operation, digital audio files, performance, science, listening and Claude review each need their own sources and results.

1. Pin code, bundle, browser/executable hashes, hardware, actual rate, support matrix, measurement method and overhead for the baseline and every candidate; report costs and benefits only from real measurements. The same workload, same capacity and original performance thresholds remain unchanged. Missing audio CPU/deadline measurements cannot be recorded as 0.
2. Run the original regression, applicable numerical/reference/physics/audio tests, schema positive/negative/boundary cases, full check/build, clean product E2E, reset/import/dispose and independent processes/review according to the original Task20/16 text and affected scope. Do not reduce the counts required by the original criteria.
3. Computer Use must actually operate the product on a normal 100% display. Playwright must also actually use production DOM pointer/keyboard/applicable gestures. Record the two methods separately; neither may stand in for the other. Cover Editor/FPS/Build/exit/focus/locking and other modes, Traditional Chinese/English UI, all reachable parameters and help/disabled reasons, legal/illegal/exact boundaries, undo/redo, lifecycle and save/load/import/export. Inventory/code review is not a browser PASS. Reconcile unrun combinations individually against the finite state matrix; do not claim exhaustive coverage of infinitely many combinations.
4. Use real data and audio files through the full pipeline: real scene/physics → motion/contact/source behavior → acoustic geometry/solver → unified propagation/native audio → capture/persist/load/replay/A-B → offline mix, per-owner stems and manifest/download. Use identical conditions and real asset bytes. Preserve run/epoch/revision/source/path IDs, count emission time/propagation delay once, and retain error atomicity. Sound rays must come only from solver results.
5. Formal performance uses the original tested workload, thresholds and qualification checks. Separate 600-second wall, simulation and capture time; an 18000-frame/byte cap is not 600 seconds of continuous capture. Save out-of-window drain separately and do not backfill the original window. Keep formal rejection separate from research runs and preserve all original FAIL evidence. Preserve unsupported/null/NOT_RUN. Reducing voices/paths/geometry/capture workload cannot earn a formal PASS.

<!-- english-original-anchor --> <a id="長錄製與長輸出實作門檻"></a>
## Implementation Gates for Long Recordings and Long Output

This is explicit work for this round. It must not be reduced to a writer placeholder, unsupported list or validation of only old short takes. At S0, Root and the renderer/storage owners freeze duration, source/owner/stem/tail matrices and RAM/disk caps according to the actual memory/format contract. The planning baseline is at least 60 seconds of digital native output, exceeding the historical 30-second take/45-second output limits. Record the frozen values in a separate version; do not solve capacity limits by deleting long work. This added duration does not claim that original PERF-011 already specified 60 seconds.

- Chunk storage must actually encode/write/read/recover. Provide real evidence for the accepted/processed/persisted/published watermarks, continuity of every accepted tick, transaction completion, in-flight ownership and byte high-water marks. cap/backpressure, cancel and IDB transaction failure/crash/reload recovery must mark interrupted/incomplete. Failures must not publish Completed; do not delete previous valid results.
- Pure copy optimizations preserve fullTraceSchema/canonical artifact/hash equivalence. A chunk hash is not a canonical recording hash. If the persistent format changes, first deliver an explicit version, compatibility/migration positive and negative fixtures and rollback before adoption. Trace JSON must not be represented as PCM.
- Obtain actual asset bytes and verify hash/rate/channels/provenance and license refs. Compare sample origin, pitch/phase/cursor, propagation delay, filter/HRTF/IR/limiter state, warmup/history and tail against an independent whole-run reference. Validate both chunk boundaries and the entire run; do not splice multiple contexts or conceal insufficient preroll.
- Per-owner stems, mix, necessary raw/simulated outputs and manifest must have actual duration/frame/rate/channel/hash values. Validate finite values and sum/reference/boundary errors using the original tolerances. peak/output cap/cancel/OOM/failure must not publish completion. Digital PCM/native offline evidence is not hardware listening or SPL evidence.

<!-- english-original-anchor --> <a id="分工與資源-lease"></a>
## Assignments and Resource Leases

Root is the sole Git index/integration owner; only Root stages/commits/merges. The memory agent is the sole writer for shared knowledge/sources/tasks/Now/log/English metadata. Implementation owners use their own worktrees and file ownership and must not directly change others' files across trees. Root assigns the actual owner/tree/branch and then records them in TASK_OWNERSHIP; do not guess. Wiki claims in every checkout are cooperative leases, not cross-machine exclusive locks.

Performance/native audio/heavy browser loads use machine resource leases scheduled by Root. Do not start parallel profile/build/browser work without a lease. Computer Use has one operator. First confirm a trustworthy URL and tool qualification; if external policy rejects an action, preserve the original error and do not operate private IPC or bypass the block. Do not kill/delete active old trees, take locks or clean/reset them. Preserve uncommitted work and do not overwrite original failures or raw artifacts.

<!-- english-original-anchor --> <a id="階段與閉合規則"></a>
## Stages and Closure Rules

| Stage | Delivery and closure conditions |
| --- | --- |
| S0 Baseline/contract | Freeze exact request, e25 task/criteria/source snapshot, actual assignments/leases, finite candidates and long-output matrix; product results remain NOT_RUN |
| S1 Attribution/formal baseline | PERF001/014 P0, controlled fixtures, probe-free comparison and original formal-method qualification/full receipts; do not delete positive or negative results |
| S2 Candidate implementation | Each original PERF002–008/011 criterion, independent oracles, capacity/lifecycle and real long storage/PCM; when there is no benefit, retain the reference policy and report the result explicitly |
| S3 Integration quality | Full check/build on latest sources, original Task20/16 required counts, numerical/reference/physics/audio/long recording/long output, and provenance/format/rights reconciliation |
| S4 UI and full pipeline | Computer Use and Playwright each complete the frozen whole-product matrix; rerun affected items after bug fixes; actual exported files/independent parsing/full pipeline have receipts with consistent scope/source |
| S5 Final archive | Reconcile requirement-by-requirement and original task criteria; current memory/English, stage reports/provenance/limitations/actual Git SHA and complete Claude handoff |
| S6 External follow-up | Claude independently validates/modifies, then humans test; retain NOT_RUN before execution, and do not present this round's engineering documents as completion |

At important milestones, batch CAS/ingest sources → task evidence → synthesis pages → checkpoint. Every stage records actual commands/exits/raw hashes, sources and gaps. Only the single writer changes shared metadata; retain CLI claim/token/heartbeat/lease/release, optimistic expected hashes and events. Update complete English documentation together after the final source freeze, not after every command. The final handoff updates Now. Explicitly record NOT_RUN for anything unrun; lack of time or tokens cannot justify DONE. Keep conclusions about full V1 separate from this round's non-advanced engineering scope; tasks that do not meet their original conditions remain open.
