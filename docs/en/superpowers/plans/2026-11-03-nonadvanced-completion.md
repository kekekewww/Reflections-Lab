<!-- english-source: {"path":"docs/superpowers/plans/2026-11-03-nonadvanced-completion.md","sha256":"de03854f91217d6608d18a675cf9d191d6c909e19f26dc7c4feca59fb57ec1d5","translated_at":"2026-11-03T02:23:56.043Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/superpowers/plans/2026-11-03-nonadvanced-completion.md`](../../../superpowers/plans/2026-11-03-nonadvanced-completion.md). Source SHA-256: `de03854f91217d6608d18a675cf9d191d6c909e19f26dc7c4feca59fb57ec1d5`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="非進階功能完整操作驗證與交接-implementation-plan"></a>
# Nonadvanced Features, Complete Operational Validation, and Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers: subagent-driven-development or superpowers: executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the user-selected nonadvanced features and actual validation, including long recordings/long audio files, native Computer Use, Playwright, full pipeline, stage memory, and a complete Claude Code handoff; old-version success or a smaller candidate cannot replace this round's goal.

**Architecture:** Retain existing React/R3F/Rapier/Custom Acoustic Core/native Web Audio. Separate recording, acoustic exchange, audio resources, assets, and offline output through fixed-input and resource-ownership contracts; only Root wires cross-domain runtime. Each implementation lane has a complete worktree within the project, with independent caches/artifacts; heavy tests and real browser/audio/performance work receive exclusive local-machine windows.

**Tech Stack:** Node 22.17.0, npm11.4.2, pinned TypeScript/React/Three/Rapier, IndexedDB, Web Workers, native OfflineAudioContext, Playwright, computer-use skill.

**Spec:** `docs/16-nonadvanced-completion/CONTRACT.md`; original clauses of `knowledge/tasks/RLAB-TASK-PERF-20261101-{001..008,011,014}.json`; `docs/11-v1/ACCEPTANCE.md` and latest amendments. Task0032 is this round's umbrella; original tasks remain the sole acceptance authority in each domain.

<!-- english-original-anchor --> <a id="global-constraints"></a>
## Global Constraints

- Base is actual main `e25f9f48302fd357b0f97a6f9bf8565f5916627c`; new trees live under `D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/`, with branch prefix `codex/nonadvanced-`. Preserve old trees/uncommitted files and original failures.
- Scope: PERF001–008/011/014, new complete requirement reconciliation for Task0020/0016, and the two kinds of actual operation requested by the user. Task0015, PERF009/010/012 are excluded; PERF013 cloud, new paid usage, push, and deployment are not automatically authorized.
- Preserve SI/right-handed +Y/-Z/xyzw, fixedDt=1/60, interactive catch-up≤4, and no dropped simulation ticks in record/A-B. Do not fabricate correctness/performance with teleportation, cleared backlog, or altered admission.
- Do not silently change original recorder 18000 frames/64MiB, in-flight 8 frames/32MiB, or other current caps; necessary capacity changes must explicitly state new capability, RAM/output/persistent-format budgets, and positive/negative cases. Preserve existing Recording schema1.0.0, canonical artifact SHA, and encoded UTF8 SHA semantics.
- Native DSP callbacks do not wait for AI/network/geometry/physics/storage, or perform unbounded allocation/logging. Logical events/phases are separate from native render slots.
- The existing short-take renderer is already implemented; this round must actually support safe output longer than 30 seconds, chunked storage, and continuity of seams/phase/filter/delay/HRTF/IR/limiter. Adding only a writer or unsupported label does not establish completion.
- Prefer a single native graph per tap for the whole segment to preserve opaque DSP state, with chunked control/encoding/persistence; a complete AudioBuffer still in memory must honestly count toward peak usage. Do not concatenate multiple OACs or present finite overlap as lossless state carry. A better complete implementation may be proposed, but do not silently add the excluded custom Worklet backend.
- UI follows existing DESIGN_SYSTEM, tokens, Component/FPS/Motion, and pinned Emil sources. Every new operable parameter enters inventory, with actual UI evidence for legal/illegal/boundary/save-restore/state behavior.
- The user requires two methods: native Computer Use and Playwright. Each preserves its actual input method and bounded coverage matrix; CDP/hidden bridges are not native input, and internal Host calls are not product operations.
- If a native tool refuses or policy stops it, save the actual error, stop that tool, and continue unaffected work; retest only after the external condition actually clears, without false PASS or a smaller goal.
- The user schedules subjective human/specialist listening after Claude; this round's digital/browser/native-input/hardware stats are not listening impressions or calibrated SPL. New Meta spending stays 0; account/budget authorization, when needed, requires concrete reviewable results.
- Root alone writes runtime.ts, source-phase.ts, package/config, shared UI wiring, and the integration Git index. Audio owner alone writes engine.ts; storage owner alone writes blob-store.ts. Other agents commit owned files and lane reports in their own trees.
- A single memory writer updates knowledge sources/tasks/now/log and English metadata; lane reports are stage projections of existing tasks, not another task system. Batch checkpoints at important stages; finalize all English after final source freeze.

<!-- english-original-anchor --> <a id="review-focus"></a>
## Review Focus

1. Same revision but changed object/Listener/material/role: cache must invalidate using actual pose/content, never stale world geometry.
2. virtual/retiring/pending/record/offline simultaneously borrow an asset: do not evict before the last lease ends; an old-generation release must not remove new resources.
3. quota/cancel/crash races around chunk commit: only a complete transaction advances persisted/published; original valid results must survive.
4. Movement/pitch/path birth-death/IR/limiter state at long-output chunk boundaries: sample origin, complete DSP history, and stems relationship must not reset.
5. FPS/Build/editor/record/replay/rebuild transitions: keyboard/mouse ownership, Esc/blur, cancel/retry/Undo, and visible limits stay consistent; native and Playwright each retain actual provenance.

<!-- english-original-anchor --> <a id="task-1基底驗收工作樹與歸因基準perf001014-p0"></a>
## Task 1: Base, Acceptance, Worktrees, and Attribution Baseline (PERF001/014 P0)

Files: Add `docs/16-nonadvanced-completion/`, this plan, `tests/browser/nonadvanced/`; measurement lanes may add bounded telemetry pure modules, while owners handle existing `engine.ts`/`runtime.ts` wiring.
Interfaces: Consume original formal performance profile/browser qualification and current AudioEngine diagnostics; produce a fixed run manifest containing source/bundle/browser/device/scene/workload/probe state and actual/null fields.
- [ ] Save original requirements/annotation1, original criteria, exclusions, sole task0032, and file ownership; pin bounded baseline/candidate lists.
- [ ] Confirm pinned dependencies in new full checkouts; run typecheck and original runtime, preserving actual raw/exit/Git hashes without overwriting original FAIL.
- [ ] First write attribution RED: stall/late onset/snapshot refusal/voice-path rejection/PCM gap cannot impersonate one another; unsupported/null cannot become 0.
- [ ] Add bounded low-cost observation and probe-off/on comparisons; baseline/candidate use identical load with exclusive CPU/GPU/browser, without concurrent builds/tests.
- [ ] Preserve distinction between formal qualification refusal and research profile; a browser update needing new qualification first requires independent capability evidence and a new version, without changing load/thresholds.

<!-- english-original-anchor --> <a id="task-2錄製與分塊持久化perf002008"></a>
## Task 2: Recording and Chunked Persistence (PERF002/008)
Files: `src/experiments/recorder.ts`, `recording-worker-client.ts`, `recording-seal.worker.ts`, `src/persistence/blob-store.ts`; owned tests `tests/experiment-runtime/recording-chunks*.test.ts`/`tests/persistence/recording-chunks*.test.ts`.
Interfaces: Preserve outward semantics of `BlobStore.saveRecording(artifact: RecordingArtifact): Promise<StoredRecordingReceipt>` and `loadRecording(runId: string, sha256: string): Promise<RecordingArtifact | null>`; put new chunk manifest/watermarks/ownership in small owned modules, with public changes checked by Root first.
- [ ] Write RED against the old monolithic path: chunk staging, final-manifest atomic publication, and bounded encode/save queues must be observable.
- [ ] Preserve existing 8-frame lane and remove provably redundant ownership; implement chunk encoding/persistence and recoverable commit strategy without treating prepared metadata as trusted bytes.
- [ ] Use old canonical codec as independent reference to verify exact bytes/both SHAs, continuous ticks/order/phase, old-data loading, and new-data round trips.
- [ ] Negative tests for quota/abort/duplicate/crash/reopen/orphan cleanup/transaction completion; old artifacts remain valid on failure.
- [ ] Run original recording lane/host/worker/blob-store regressions; save capture→seal→save→replay peak usage and timing components, and submit lane report.

<!-- english-original-anchor --> <a id="task-3素材生命期與resident管理perf007"></a>
## Task 3: Asset Lifecycle and Resident Management (PERF007)
Files: `src/audio/assets.ts`, `src/app/asset-host.ts`; add pure lease/residency module and `tests/audio-runtime/asset-leases*.test.ts`/`tests/app/asset-residency*.test.ts`. Do not change blob-store/engine.
Interfaces: Consume existing `saveAsset/loadAsset`, AudioAssetBankEntry/descriptor IDs/revision/SHA; produce idempotent scoped leases and a reconstructible eviction plan, with engine/runtime integration by owners.
- [ ] RED: no eviction during overlapping active/retiring/pending/frozen/record/replay/offline borrowing; without pins, resident memory can release and reload exactly.
- [ ] Implement reference protection/decode staging/generation ownership in existing store; release AssetHost strong references too, rather than only deleting a Map without releasing actual PCM.
- [ ] Failed decode/cancel retains original assets; unfinished native decode still counts as a reservation; old lease release does not affect a new version.
- [ ] Evidence for exact SHA/revision reload, quota/context rebuild, cold/warm resident and recovery; submit API required for Root wiring.

<!-- english-original-anchor --> <a id="task-4聲學交換與pose-aware幾何perf004005"></a>
## Task 4: Acoustic Exchange and Pose-Aware Geometry (PERF004/005)
Files: `src/app/acoustic-service.ts`, `acoustic-input.ts`, `acoustic-worker.ts`; add small snapshot-policy/pending-emission/geometry-cache modules and dedicated tests in `tests/acoustics-runtime/`, `tests/app/`.
Interfaces: Preserve current source/epoch/revision/listener/model pins and worker envelope; cache shares only immutable local geometry or a complete pose/content key, with explicit generations for ownership/pools.
- [ ] RED pins existing per-source latest-valid behavior and pending emissions that cannot be dropped; out-of-order/duplicate/timeout/reset/source removal cannot lose or replay events.
- [ ] RED: with unchanged sceneRevision but changed pose, material/role/analytic-volume/source self-exclusion, world geometry must update.
- [ ] Implement incremental cache/smaller payload/bounded exchange; transfers require proof of safe detach/return/crash/cancel/pool exhaustion, without silently adding SAB isolation headers.
- [ ] Compare path IDs/vertices/bands/delay/identity/admission against original clone/solver reference, without loosening mathematical tolerances.
- [ ] Measure copy/allocation/age/onset/consumer cost under identical load; a candidate without benefits cannot claim improvement by reducing update rate or deleting paths.

<!-- english-original-anchor --> <a id="task-5native更新與phase保留的virtualizationperf003006"></a>
## Task 5: Native Updates and Phase-Preserving Virtualization (PERF003/006)
Files: Audio owner exclusively owns `src/audio/engine.ts`, `routes.ts`, `control.ts`, `route-response.ts`; pure virtual policy/timeline and dedicated `tests/audio-runtime/virtual*.test.ts` may be delegated, without dual writing engine.
Interfaces: Logical deterministic admission and recorded AudioEvents stay unchanged; render slots are separate from logical voice/timeline, and native/virtual cursor provenance is not mixed.
- [ ] RED: when native slots are insufficient, virtual timeline still advances by pitch integration; promote resumes at the correct phase, expired one-shots do not replay.
- [ ] Preserve existing scalar/shape separation and stable path IDs; implement bounded virtual slots, hysteresis, pending-arrival/tail/resume policies.
- [ ] Integrate Task3 leases; runtime pending must not treat virtual as permanent rejection and delete it; Root wires source-phase.
- [ ] Original delay counted only once; negative tests for path birth/death/crossfade/pause-rebuild/release, leaks, and digital output.
- [ ] Verify control/IR upload/output continuity/deadband error with identical sources/load; unobservable native CPU stays null, without guessing callback cost.

<!-- english-original-anchor --> <a id="task-6實質長輸出與分塊音訊perf011"></a>
## Task 6: Substantial Long Output and Chunked Audio (PERF011)
Files: `src/audio/render-backend.ts`, `render-validation.ts`, `render-types.ts`, `render-pcm.ts`, and new chunk writer/artifact sink/incremental hash; renderer owner owns `src/app/render-host.ts`, Root handles UI/runtime wiring.
Interfaces: Consume existing RenderJob/RenderInput/RenderConfiguration/AudioEngine; produce complete RenderResult and individually downloadable WAV/manifest. If RenderFile changes to Blob/chunk references, every caller must remain backward compatible and file hashes explicit, without serializing native objects.
- [ ] RED: real native graph can complete 60+ seconds of 48 kHz stereo within legal budgets; valid selections of 5 existing outputs and owner stems, with explicit over-cap rejection.
- [ ] Implement actual native rendering longer than 30 seconds; one uninterrupted graph per tap preserves DSP history, with exact global sample origin; control/file chunks must not reset filter/HRTF/IR/limiter.
- [ ] Implement bounded chunked WAV encoding/hash/persistence/cancellation to reduce PCM copies; still explicitly count full nativeAudioBuffer cost without claiming unlimited streaming.
- [ ] Compare chunk seams against whole-segment reference with delay, moving directions/paths, pitch, IR, and limiter state; exact reassembled chunk payload and original stem-sum 2e-6/other tolerances remain unchanged.
- [ ] Real browser OAC, long runs, cancel/retry/quota/crash without publishing partial output; digital finite/peak/hash/channel/frame/tail checks and complete-history labels.
- [ ] After Root wires new UI capability, scope, progress/cancel/download/historical-artifact compatibility, validate using both operation methods.

<!-- english-original-anchor --> <a id="task-7產品接線模式與全部參數rootui"></a>
## Task 7: Product Wiring, Modes, and All Parameters (Root/UI)
Files: Root alone writes `src/app/runtime.ts`, `src/experiments/source-phase.ts`, shared UI/locale/styles/package/vite/test-entry configuration.
Interfaces: Consume reviewed public seams from Tasks2–6; frequent state does not route fixed steps through React; no duplicate AudioEngine or asset store.
- [ ] Each candidate first receives RED/GREEN and independent review, then normal merge into integration; introduce one complete testable mechanism per shared-wiring change.
- [ ] Preserve design language; new features have clear usable entry points and limits, rather than only hidden APIs/diagnostics inaccessible to users.
- [ ] Refresh full UI AST/semantic families; list default/range/type/state/persistence/undo/method/actual evidence for every control, without hiding new items outside the old denominator of 217.
- [ ] Complete bounded matrix for editor/FPS/Build/held-ghost/run-pause-record-replay/page switching/blur-Esc/engine rebuild/cancel-retry.

<!-- english-original-anchor --> <a id="task-7b目前版本meta產品閉環與展示接線"></a>
## Task 7b: Current-Version Meta Product Loop and Demo Wiring

Files: Meta owner handles server/provider, pure AI modules, and owned fixtures; Root still handles shared runtime/UI wiring.
Interfaces: Retain existing trusted tools, revision/generation, persistent budget ledger, preview→Apply→real run/artifact→grounded comparison; add no model OS/repo/shell permissions.
- [ ] First validate current-source offline fault fixtures for proposal/full arguments/rejection/cancel/retry/cost reservation/UI outcomes, without rewriting finished tools.
- [ ] Verify current live provider and catalog/schema compatibility, keep key server-only and spending gate0; any new paid call requires reviewable dry-run results and explicit call count/total amount before user authorization.
- [ ] Once authorized, complete the minimum live loop through real product UI on current source, preserving model ID/redacted trace/actual runtime results; historical minimal Sound live does not count as this round's live run.
- [ ] Without live authorization or external provider availability, preserve explicit gates and continue other stages; do not claim live operation or switch paid services autonomously.

<!-- english-original-anchor --> <a id="task-8computer-use與playwright完整產品驗證專屬browser-lease"></a>
## Task 8: Complete Computer Use and Playwright Product Validation (Exclusive Browser Lease)
Files: `tests/browser/nonadvanced/`, `docs/16-nonadvanced-completion/verification/{playwright,native,pipeline}/`, and an in-project directory for external exports.
Interfaces: Import fixtures/operate only through normal product UI; DOM/evaluate is for observation only, not HostInternal actions. Native input uses computer-use skill; Playwright is a separately stated method.
- [ ] First freeze cases, source/bundle/viewport/locale, and mode/parameter cross-index; all initially NOT_RUN.
- [ ] Playwright complete bounded parameters/states/error recovery/full pipeline, preserving original FAIL→root cause→fix→affected retest.
- [ ] Actual native operations on the same product, all modes/key gestures/parameter usability/full pipeline, preserving each tool input/observation/actual download; scripted DOM is not native.
- [ ] Long recording→chunk save→reload/replay→same-motion A/B→long mix/master/dry/stems exported file by file→independent byte/hash/sample validation; both tools each have actual operation records.
- [ ] An unresolved external native-tool/account gate still means incomplete; continue other work and follow the real goal's blocked audit, without false completion.

<!-- english-original-anchor --> <a id="task-9最終同負載效能驗收表與獨立程序"></a>
## Task 9: Final Same-Load Performance, Acceptance Table, and Independent Process
Files: Owned measurement/independent-review tests and `docs/16-nonadvanced-completion/verification/`; new requirement-ledger version, without overwriting R17.
Interfaces: This round's immutable source/bundle/assets/workload/device metadata, fixed candidate list, and each run's genuine actual/null fields.
- [ ] Measure identical load for every candidate and final source, separating producer/evaluate/commit, main/physics/worker/delivery/native control/output, queue age/resident/peak usage.
- [ ] Report 600-second wall/sim/capture durations separately; with original 18000-frame/byte caps unchanged, do not claim continuous 600-second capture; preserve original FAIL and qualification refusals.
- [ ] Retest lifecycle pause/resume/seek/background/freeze/sleep/quota/cancel/context-worker crash/dispose case by case in a bounded set.
- [ ] Original full check/type/lint/format/build/licenses, affected scientific references, real OAC/UI, and independent review; judge every PERF task against original criteria.
- [ ] New 51-requirement+amendment crosswalk links this round's evidence; update Task20/16 and historical metadata under actual conditions, without claiming overall V1/listening/Meta live.

<!-- english-original-anchor --> <a id="task-10階段記憶英文main與claude完整交接"></a>
## Task 10: Stage Memory, English, Main, and Complete Claude Handoff
Files: Single memory writer manages knowledge/formal current entry/English; Root handles only Git integration and external reporting.
- [ ] Every completed stage outputs fixed command/exit/raw/source/hash/limits and change list; batch CAS ingest→task/page→checkpoint, preserving old/new versions.
- [ ] After source freeze, perform one full English finalize/check and Wiki lint; do not repeatedly stale the three generated pages for each small action.
- [ ] After final independent review and identical-source actual UI/PCM/performance evidence are complete, normally merge locally into main, preserving original branches/user files; no push/deployment/history rewrite.
- [ ] Complete Claude handoff covers architecture/interfaces/all changes/test commands/original FAILs/unresolved limits/physical asset-export locations/retest list; unexecuted post-Claude verification and final human checks remain next stage.
- [ ] Root audits completion goal clause by clause; missing native/Playwright/features/performance/memory work keeps the goal active, without shrinking scope for remaining time or a single green result.
