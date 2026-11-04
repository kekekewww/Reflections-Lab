<!-- english-source: {"path":"docs/16-nonadvanced-completion/history/CONTRACT.20261103.v2.md","sha256":"68d3c4efba030686e05262c52d8e6557987534f3fb23687158e5f2afaa36282e","translated_at":"2026-11-03T02:23:21.772Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/history/CONTRACT.20261103.v2.md`](../../../16-nonadvanced-completion/history/CONTRACT.20261103.v2.md). Source SHA-256: `68d3c4efba030686e05262c52d8e6557987534f3fb23687158e5f2afaa36282e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="非進階候選完整實作與驗證契約2026-11-03"></a>
# Full implementation and validation contract for non-advanced candidates (2026-11-03)

This round is new ACTIVE work explicitly started by the user. The original request is in [REQUEST](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/604f542340cce1f28358e638d028cd1a8171fe98); the actual starting point is e25f9f48302fd357b0f97a6f9bf8565f5916627c. The [baseline snapshot](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/447977886ffcba952ce5cc513109b41405dc15e3) pins the original tasks' complete dependencies, criteria, existing flags and source hashes. This is a supplementary execution contract. Original acceptance conditions, formal workloads and tolerances remain unchanged; a contract, plan or metadata cannot be claimed as a product pass.

<!-- english-original-anchor --> <a id="範圍與唯一任務權威"></a>
## Scope and sole task authority

Formal task authority remains knowledge/tasks/*.json. RLAB-TASK-0032 is the umbrella for this round's authorization, integration and evidence reconciliation. [TASK_OWNERSHIP](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/963e176b49dd66c3d1cbb1f7a1a3a6bd0dad311f) only projects this round's stage/file/resource assignments; it does not create another task system. While an original PERF dependency is not DONE, candidate engineering may research and implement in parallel under the umbrella. Claiming/closing original tasks must respect their original dependencies and real evidence for every criterion; dependencies must not be changed to bypass gates.

| Included in this round | Work and conditions retained |
| --- | --- |
| PERF-001, 014 | Bind source/bundle/browser/hardware/device/rate; attribution, probe overhead, two-stage lifecycle, original formal full 600-second workload and performance gates |
| PERF-002, 003 | Bounded per-tick evaluation; exact/threshold scalar, shape, delay and direction oracles, and benefit/output comparison under identical conditions |
| PERF-004, 005 | Separate preview/latest-valid from events/captures that cannot be dropped; identity, revision geometry/cache/owned-buffer, timeout/caps and all negative cases |
| PERF-006, 007 | Voice policy preserving phase/cursor/admission; existing asset-store pin/eviction/decode staging and real bytes/rights provenance |
| PERF-008, 011 | Actual chunk encoding/storage, four watermarks and seal ownership; long recordings and long PCM mix/stems output with continuous DSP state |
| Task0020, 0016 | Reconcile original requirement-by-requirement, quality/E2E/lifecycle, documentation/English/provenance and external gates; include the new UI and full-pipeline requirements in full |

Advanced Task0015 and PERF-009/010/012 are excluded; cloud PERF-013 is not authorized. The budget for new paid APIs is 0. No push, deployment or acceptance of terms on the user's behalf. Historically user-confirmed basic functionality does not require the same round of manual testing again. Final subjective human observation/listening for new functionality is explicitly ordered after Claude. Real Meta paid/live use is not authorized; fixtures must not be passed off as live.

The full original PERF conditions are pinned in BASELINE.original_task_snapshots; dependencies and baseline status remain unchanged. The seven old PROPOSED ADRs do not collectively become ACCEPTED through this contract; technical adoption requires an explicit decision/independent evidence. Historical true values for Task16/20 retain only their original literal evidence scope and do not count as reruns in this round.

<!-- english-original-anchor --> <a id="驗證必須分層"></a>
## Validation must be layered

All product tests for this round initially remain NOT_RUN. The 1536 runtime tests, 217 finite parameter families, five 5-second WAVs and historical Computer Use limitations are old checkpoints; they cannot substitute for new product evidence or completion of this round's methods. Implementation, unit/numerical, real production UI, native operation, digital audio files, performance, science, listening and Claude review each have their own provenance and results.

1. Pin code, bundle, browser/executable hashes, hardware, actual rate, support matrix, measurement method and overhead for the baseline and every candidate; report costs and benefits only from real measurements. Workload, capacity and original performance gates remain identical. Missing audio CPU/deadline data cannot be recorded as 0.
2. Run original regressions, applicable numerical/reference/physics/audio checks, schema positive/negative/boundary cases, full check/build, clean product E2E and reset/import/dispose, and independent processes/review according to the original Task20/16 text and affected scope. Do not reduce the repetitions required by the original criteria.
3. Computer Use must actually operate the product at normal 100% display scale. Playwright must also actually use production DOM pointer/keyboard/applicable gestures. Record the two methods separately; neither may impersonate the other. Cover Editor/FPS/Build/exit/focus/lock and other operating modes, Traditional Chinese/English UI, every reachable parameter and help/disabled reason, valid/invalid/exact boundaries, undo/redo, lifecycle, and save/load/import/export. Inventory/code review is not browser PASS. Reconcile each unrun combination in the finite state matrix; do not claim exhaustive coverage of infinitely many combinations.
4. The full pipeline must use actual data and audio files from real scene/physics → motion/contact/source behavior → acoustic geometry/solver → unified propagation/native audio → capture/persist/load/replay/A-B → offline mix, per-owner stems and manifest/download. Use identical conditions and real asset bytes; retain run/epoch/revision/source/path IDs, count emission time/propagation delay once, and preserve error atomicity. Sound rays are generated only from solver results.
5. Formal performance uses the original workload under test, gates and qualification checks. Separate 600-second wall, simulation and capture durations; the 18000-frame/bytes cap is not 600 seconds of continuous capture. Store drain outside the window separately without backfilling the original window. Separate formal rejection from research runs, and preserve the complete original FAIL. Keep unsupported/null/NOT_RUN. Reducing voices/paths/geometry/capture load cannot buy a formal PASS.

<!-- english-original-anchor --> <a id="長錄製與長輸出實作門檻"></a>
## Implementation gates for long recordings and long output

This is explicit work for this round. It must not retreat into a writer placeholder, an unsupported list or validation of only old short takes. Root has frozen [long-output specification v1](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f40932fa6ef3306512b99305837ebd9358a91a3f): a 60-second signal, 48 kHz stereo, 2 real stable owners, default 2-second tail, 62 seconds / 2,976,000 frames total; 5 WAVs (master/raw/simulated and 2 owner stems) plus manifest, each WAV 23,808,056 bytes, total 119,040,280 bytes. Maximum context 75 seconds, tail 0..10 seconds, at most 16 outputs, working 256 MiB, output 192 MiB and 32768-frame chunks. Each tap uses one complete native OfflineAudioContext to maintain continuous DSP state, releasing full PCM after each tap; this is neither unlimited streaming nor constant memory. The original capture limits of 18000 frames/64MiB remain unchanged; demonstrate that 3601 frames including metadata fit. Owner implementation and all audio-file/reference/peak validation remain NOT_RUN. This is a specification freeze, not a product pass or a claim that original PERF-011 had already specified 60 seconds. Record changes as a new version; do not solve capacity limits by removing the long-duration work.

- Chunk storage must actually encode/write/read/recover. There must be real evidence for accepted/processed/persisted/published watermarks, continuity of all accepted ticks, transaction completion, in-flight ownership and byte high-water marks. Mark cap/backpressure, cancel, IDB transaction failure/crash/reload recovery as interrupted/incomplete. Failures must not publish Completed; do not delete old valid results.
- Pure copy optimization preserves fullTraceSchema/canonical artifact/hash equivalence. A chunk hash is not the canonical recording hash. If the persistent format changes, first provide an explicit version, compatibility/migration positive and negative fixtures, and rollback, then adopt it. Trace JSON is not PCM.
- Obtain real asset bytes and verify hash/rate/channels/provenance/license refs. Compare sample origin, pitch/phase/cursor, propagation delay, filter/HRTF/IR/limiter state, warmup/history and tail with an independent whole-segment reference. Validate both chunk boundaries and the whole segment; do not concatenate multiple contexts or hide insufficient preroll.
- Per-owner stems, mix, required raw/simulated outputs and manifest must have actual duration/frame/rate/channel/hash data. Verify finite samples, sum/reference/boundary error under original tolerances. Peak/output cap/cancel/OOM/failure must not publish completion. Digital PCM/native offline evidence is not hardware listening or SPL evidence.

<!-- english-original-anchor --> <a id="分工與資源-lease"></a>
## Assignments and resource leases

Root is the sole owner of the integration/main worktree and its Git index, responsible for shared integration staging/commit and normal merges. Candidate owners may use their own worktrees and quietly stage/commit only their own files explicitly authorized by Root. No writing outside ownership or broad staging; do not use the integration/main index. No push/deploy authorization. The memory agent is the sole writer of shared knowledge/sources/tasks/Now/log/English metadata. Implementation owners use their respective worktrees and file ownership and do not directly edit others' files across trees. Root assigns actual owners/trees/branches before they are added to TASK_OWNERSHIP; do not guess. Wiki claims in all checkouts are cooperative leases, not cross-machine exclusivity.

Performance/native-audio/browser heavy workloads use machine resource leases scheduled by Root. Do not start parallel profiling/build/browser without a lease. Computer Use has a single operator; first confirm a trusted URL and tool qualification. If external policy rejects access, preserve the original error and do not use private IPC/bypass the block. Do not kill/delete old active trees, steal locks or clean/reset. Preserve uncommitted content, original failures and raw artifacts without overwriting them.

<!-- english-original-anchor --> <a id="階段與閉合規則"></a>
## Stages and closure rules

| Stage | Delivery and closure conditions |
| --- | --- |
| S0 baseline/contract | Freeze exact request, e25 task/criteria/source snapshot, actual assignments/leases, finite candidate and long-output matrices; product results remain NOT_RUN |
| S1 attribution/formal baseline | PERF001/014 P0, controlled fixtures, probe-free comparison and original formal-method qualification/full receipts; retain positive and negative results |
| S2 candidate implementation | Original PERF002–008/011 criteria individually, independent oracles, capacity/lifecycle, real long storage/PCM; if there is no benefit, retain the reference policy and report the result explicitly |
| S3 integration quality | Full check/build on latest sources, original Task20/16 repetition counts, numerical/reference/physics/audio/long recording and long output, provenance/format/rights reconciliation |
| S4 UI and full pipeline | Computer Use and Playwright separately complete the fixed whole-product matrix; revalidate affected items after bug fixes. Real exported files/independent parsing/full pipeline have receipts consistent in scope/source |
| S5 final archive | Requirement-by-requirement and original task-criterion reconciliation, memory/English current, stage reports/provenance/limits/actual Git SHA, full Claude handoff |
| S6 external follow-up | Claude independent validation/modification, then human testing. Retain NOT_RUN before execution; do not substitute this round's engineering documents for completion |

At important milestones, batch CAS/ingest sources → task evidence → synthesis pages → checkpoint. Each stage records actual commands/exit/raw hashes, sources and gaps. Only the single writer changes shared metadata; preserve CLI claim/token/heartbeat/lease/release, optimistic expected hashes and events. Update full English documentation centrally after the final source freeze, rather than rebuilding after each command. Final handoff updates Now. Explicitly mark every unrun item NOT_RUN; insufficient time or tokens cannot justify DONE. Keep conclusions about full V1 separate from this round's non-advanced engineering scope; tasks not meeting original conditions remain open.

<!-- english-original-anchor --> <a id="s0凍結更新v2"></a>
## S0 freeze update (v2)

[Seven-tree responsibilities and resources](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/963e176b49dd66c3d1cbb1f7a1a3a6bd0dad311f) are frozen against Root's actual ownership v1 and real Git branch/HEAD. The measurement folder is actually baseline; its branch is codex/nonadvanced-baseline-measure-20261103. The full-baseline exclusive lease has been released. Currently only two concurrency 1 small-test slots exist; other tests/build/browser/native work await Root leases. The [S0 receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5ff8c4a6d358f795845efe030066f715920f4308) preserves the initial OOM, 19 targeted reruns, and two full 1536 suites, each with 1535 PASS/1 FAIL/exit 1. The root cause of the reproduced mockMetaJSON failure awaits the Meta owner; it must not be passed off as OOM or baseline PASS. S0 completion means only preservation of scope/ownership/long specification/baseline facts. S1/S2 and original tasks remain open.
