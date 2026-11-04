<!-- english-source: {"path":"docs/IMPLEMENTATION_STATUS.md","sha256":"35808112cd75f8126f5d35e6a7be08182130998b9fc9a1c208db3b1b7c2ae004","translated_at":"2026-11-03T11:11:32.054Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Source SHA-256: `35808112cd75f8126f5d35e6a7be08182130998b9fc9a1c208db3b1b7c2ae004`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="2026-11-03-claude-接手完成工程驗證結果待人工測試"></a>
## 2026-11-03 Claude handoff completed: engineering validation results, awaiting manual testing

Product source is frozen at `544d8d9f` (later changes affect only tests and documentation). Local Main has merged the integration branch; there has been no push or deployment. See the [final Claude handoff](16-nonadvanced-completion/handoffs/CLAUDE_FINAL_HANDOFF_20261103.md) for complete results and manual-test instructions, and the [crosswalk](16-nonadvanced-completion/requirements/REQUIREMENT_CROSSWALK_20261103.md) for row-by-row adjudication. This is not a declaration that the entire first version is complete.

- Full `npm run check`: research regressions, lint/types/formatting, runtime 2270/2270, build and licenses passed; the 7 runtime failures at handoff were investigated (4 tests had not caught up with established rules, 1 product bug was fixed, and 2 were test timing races).
- Long-output whole63 passed the original thresholds; recording storage and evaluation now use two-stage pipelines and batching; acoustic transport and audio-resource comparisons retain reference defaults.
- Product E2E (refined v3) passed 4/4 for three clean launches plus relinking; ten reset/import cycles and disposal passed 2/2.
- Production top monitoring was 4/5; all 22 S4 routes were 11/11 (pass/fail), with failures retained and unfixed. Formal 600-second performance was not run by user decision.

<!-- english-original-anchor --> <a id="m4新整合與部分管線證據已固定錄製長輸出仍未完成"></a>
## M4: new integration and partial pipeline evidence pinned; recording/long output remain unfinished

<!-- english-original-anchor --> <a id="2026-11-03-使用者轉交claudecodex開發暫停整體尚未完成"></a>
## 2026-11-03 User transfer to Claude: Codex development paused, overall work unfinished

The latest committed integration baseline is 448a503f5373faccc19aa17c6789ffc01bc26017; the main entry is the [Claude handoff report](16-nonadvanced-completion/handoffs/CLAUDE_CODE_HANDOFF_20261103.md) and its pinned evidence index. This round only organizes handoff and memory, without resuming product development or rerunning product/browser/performance tests.

The four actual top-row audio/load monitors, Worker/storage-ready prerequisites and multiple candidates are integrated; latest production five cases are 4 PASS/1 FAIL, and diag04 still triggers storage backpressure. The 20-second V4 wiring has data but original physics/acoustic/UI gates have not passed; formal 600 seconds remains incomplete on latest sources. Long master's original 2e-6 gate still has 321 samples over limit; full S4, Windows Computer Use, final full check/English/Main merge remain unfinished.

Task0032/0033 were IN_PROGRESS at inventory time; after normal release of cooperative claims during this handoff, CLI follows original rules and changes them to READY for Claude to claim. READY means awaiting handoff, with full criteria text and booleans unchanged; it is neither completion nor reduced acceptance. Budget0, no push/deploy and normal 100% native acceptance rules remain. ACTIVE/implementation-in-progress descriptions below are historical cutoffs and do not mean the Codex goal is currently executing.


[M4 stage](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/73953e8828395991c584e3a81d1022f465e134b1) and the [Claude-readable partial handoff](16-nonadvanced-completion/handoffs/M4_PARTIAL_CLAUDE_HANDOFF_20261103.md) bind Root1f: global tsc 0, seven files 118/118. 83/77/64 overlap with 118 and must not be added. Worker 22/63, Runtime 25 and phase/lifecycle in Native03's ten pairs of 20 2-second PCM files are limited evidence, not full npm check or long-recording performance. prod05/e2e02 are retrospective receipts, completedAt=log mtime, not pre-build capture.

Production03 pins b7 at 4 PASS/1 FAIL. Zone draft/selection persistence across four modes PASS and four load values are finite, but recording's fixed-step guard still FAILS. diag02 headless has a fixed-step guard/pressure null/5 frames archived. diag03 headed has a storage guard, eval 14/7/7 and store 8/8/0/8. Worker ACK 531.8 ms was awaited; storage create 253.6 ms was not awaited at start. The Store-ready gate is being implemented, not fixed. Archiving 14 frames 58..71 is not throughput PASS. Source pins and index/entry HTTP are checked separately without inferring CPU/GPU causation or a sole root cause.

For V4, Root adopted only the exact-Chrome semantic prerequisite, window 222.6 ms. Root1f's registry remains empty; no new 20s/600/DSP CPU. pairedV2 has 150 s ERROR/5 false/comparison 6 result missing/0 WAV. Its snapshot was merged with 65 component cases, but real IDB/long WAV/parser/peaks are unverified and V3 pending. Two EN UX source hashes match, while 2 PASS is Root-reported only, not full English. Task33 AC02/06/07 remain false; Task32 has only AC01. Complete S4/CU/full npm check/full English/Main merge/final Claude handoff and subsequent humans remain incomplete, retaining original gates/FAIL. Root removed only two clean/Main-ancestor old trees; all other dirty/raw/active C/Claude trees remain.

<!-- english-original-anchor --> <a id="m3頂列四模式有有限ui與數值證據完整工程仍未完成"></a>
## M3: limited UI and numerical evidence for the four top-row modes; complete engineering remains unfinished

The [fixed M3 receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/aac9048a20f8addd2cb72f1a92466b98c21c8eb9) preserves ac0b895 focused 64/64, build01 exit 2 and 02/03/04 exit 0 (only 04 binds 13 sources/bundle). Playwright02 is 3 PASS/1 FAIL, 4/4 source/HTTP, 0 page errors/model calls. Evidence covers the four modes/keys/focus/L-R/ZH-EN, 390/929/1440 at DPR1 and real bounded readings. New native02 pins audio5b8ace component PASS: 9 raw files/53248B, the same render clock, waveform difference 0, DFT error 4.29683e-7 dB within the original 0.3, mute 0/-Infinity and release. Preserve original native01 FAIL/2 of 9. API duration is not DSP/CPU; 0 ms means no observed timer increment, not zero cost.

Recording remains incomplete: Pause precedes the first Spectrum; 1.42 s is global tick 85/60, not recording duration, and recording UI 0.12 s is not an accepted count. The shared guard cannot distinguish evaluation/storage, and causation from cold start/view switching is unproven. A composite supports Task33 AC01/03/04/05; 02/06/07 remain false/IN_PROGRESS. New uncommitted label/runtime work is not validated by source ac0. Task32/PERF/16/20/51 and original tolerances/caps/formal workload remain unchanged. Computer Use has no new feature input/method NOTPASS. Full check/complete PW/long pipeline/formal 600/English/Claude/humans and complete V1 still await evidence.

<!-- english-original-anchor --> <a id="2026-11-03-m2部分整合與真實驗證界線"></a>
# 2026-11-03 M2 partial integration and actual validation boundaries

The [M2 fixed milestone](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ac657109c4ae5a5390d9eecd2c1d425f2072e246) pins P1 at 3a251 separately from the earlier 41526 snapshot. Public 60 seconds means 3600 accepted frames; 3601 inclusive is an independent capacity fixture. [Specification v3](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f12c973679abfe1858d9d89f2e6cd1f491348b52) does not add one render-window tick or change the original schema/hash/2e-6 gate. This round's progress follows; earlier sections retain their dates and scopes.

- Root's original 41526/32 GREEN missed evidenceClass. P1 real-capture RED 1→32 GREEN at 3a251 restores the original cursorModel and moves the description to policy; the original validator is unchanged. Expanded global tsc 0 predates Blob 4d; no global tsc followed P1, so do not call it the latest complete check/build.
- Storage 4d has 107 Node tests and 7 new cases with real RED→GREEN. The original 9fe real-IDB 9 cases belong only to that historical source; the browser has not been rerun after 4d. Long09 actually ran 57/58; original whole63 master max 2.9802322387695312e-6 and 321 over still exceed original 2e-6. Downloads: 14 complete/15 partial/16 missing; 90-second deadline FAIL. Manual owned PID/port 0 was checked after termination; do not retroactively change the original unsaved finally data.
- Perf047 was not a Root ancestor at reader415/3a. Later writer677 was normally merged, pinning negative/method components without qualifying the method. 55 seconds is only the 45+10-second hard cap. Actual process 4754.4203 ms/native window 396760 us/DOM about 396.7 ms is rejected by the strict schema. Keep V3 launcher qualification rejection separate from V4 NOTQUALIFIED/NOTAPPROVED. No new formal 600-second run. Fields not requested or measured, including audio/device/DSP CPU, remain null.
- Resource candidate remains default reference/off. Audio-retirement105 is control scope; newer EOF226=224 PASS/2 preview FAIL and 45 focused tests are only unfrozen owner progress, not Root/global/native PASS. Owners of the new 9 trees and ephemeral slots follow Root's live authorization; they confer no permanent execution rights.
- All current decisions in the original 51-row draft remain undecided. Do not upgrade Task16/20/PERF/AC02–09 or complete V1. Computer Use remains blocked by URL policy/0 inputs this round. Complete product Playwright/long public pipeline/new full quality/formal performance, final English and Claude/subsequent humans still await real evidence. No new paid/push/deploy. Root continues engineering; this is neither final nor a completed handoff.

<!-- english-original-anchor --> <a id="以下保留m1與先前歷史截點"></a>
## M1 and earlier historical snapshots retained below


<!-- english-original-anchor --> <a id="2026-11-03-本批較晚的native02補充"></a>
## 2026-11-03 later native02 supplement for this batch

The [fixed supplementary receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c6a0d046f97f34e49eef67dc1658064857b6a6a2) updates the earlier M1 snapshot: native02 has actually run, exit 1, 2 PASS/3 FAIL. The 10 mono 96,000-frame PCM files are actually nonempty with matching SHAs, so they are no longer unrun, but the complete original 2e-6 gate is still unmet. This is short 2-second digital DSP and cannot replace 62-second long audio, complete product Playwright, Computer Use or hardware listening. Root selected bounded native content carriers only for next-round validation, retaining original a-rate/wave and counting all carriers toward cost/caps; not adopted/no new proof. Original native01's five FAIL/10 empty PCM files and M1 snapshot text are retained as history.

Root later reported recovery ports 4 RED→4 GREEN. Runtime/CSS remain dirty with source hashes awaiting commit. Storage 9fe's 2 GREEN cases do not count as a full rerun after original 98. Acoustic82bf's pinned 88 remains separate from old 79 and awaits review/adoption. New global check/real IDB/long PCM/formal 600 seconds/both full-method matrices, original Task16/20/PERF and complete V1 remain incomplete. “native02 not run/not granted” in the original M1 paragraphs below refers to the earlier cutoff, not the present state.

<!-- english-original-anchor --> <a id="2026-11-03-非進階候選整合進行中s2-partial"></a>
# 2026-11-03 non-advanced candidate integration in progress (S2 partial)

The user explicitly started the [complete non-advanced scope](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/604f542340cce1f28358e638d028cd1a8171fe98). Asset, Meta, long-output and UI candidates are currently being normally integrated against baseline e25. [This round's fixed milestone](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7cee6ae1118139b2bfd78376a89e5bba3601f322) separately lists actual merges/unit/static/raw evidence and unadopted fixes. Merges and focused GREEN only prove their limited components; there is no complete product PASS for this round.

- Receipts exist for asset 69 focused/real tsc 0, Meta 63+75 fake-only, UI 25 unit/static and the limited renderer candidate. The 19 new UI families and 3 authored Playwright cases are NOT_RUN. Recording has 98 focused tests; new review RED after acoustic 79 is being fixed. Preserve audio's original 5 native FAIL and 10 empty PCM files. Separate the latest Git merge state from the time of each receipt.
- The long-output [v2 specification](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bde27d90c0715399501ae6d2de1e43100433e85) includes 60+2 seconds, 2 owners/5 WAV files, per-job 192 MiB WAV/manifest 2MiB/aggregate 384MiB/max 64 archived jobs. Public UI/real IDB/WebLocks/3601 frames/62-second PCM/reference/peaks are not all validated; relaxed Host boundaries cannot stand in for a real 60-second run.
- The [51-row draft](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/195b1de848ab3b5496a5a362d45bde0f8006cded) retains the original 102 conditions and EN01–06, all with current status undecided. Do not mix the original 315 FAIL with that run's PASS. No new paid/current Meta live use; native GUI remains blocked by URL policy with 0 inputs. Complete check/browser/full pipeline/formal 600 seconds, English finalization/Claude and subsequent human testing still await real evidence. Original Task16/20/PERF and complete V1 remain open.

<!-- english-original-anchor --> <a id="以下保留前次有限交付與歷史截點"></a>
## Previous limited delivery and historical snapshots retained below

<!-- english-original-anchor --> <a id="2026-11-02-有限核心全參數與本機main交付現況"></a>
# 2026-11-02 status of limited core, all-parameter and local Main delivery

Six core features, real Zone entry/exit, sphere/capsule material roles and real dynamic reflections, and Project environment persistence have been implemented and integrated. Product code 5010685/entry index-Nm7oRfzL/baf254… retains original UI/audio-file pins. The [new complete check](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2f387d58e834799d809cbbdaab03e2afd2cb4194) actually exited 0: 8 TAP groups all had 0 failures/skips, runtime 1536/1536, English at that time 417/417 with 0 errors, and 14 rebuilt files exactly matched the 501 archive. [Local main](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/529524649ac8b7fbff91d919bf6dcab6403b7865) was normally integrated at `fe663ca9f384d247bcd89b331936f6be202c761f`. The original 129 untracked files and 4ba memory snapshot remain; all 11 feature/integration tips are ancestors. Root's original fresh build exited 0 and 8 runtime files matched exactly; this is not a claim that separate outDir maps match.

- Recording/A-B: bounded evaluation Worker with 8 frames/32MiB, cancel/epoch/drain/backpressure and source phase. A controlled short take preserves exact fixed steps without adding/removing ordinary wall-clock debt; this is not a total-heap/performance guarantee.
- Audio: actual disabled diagnostics/128 ring/unknown null, division of scalar/shape/delay/direction responsibilities and real OAC using the same AudioEngine. Control-thread observation is not native callback CPU/device evidence.
- Caps/Bounce/Zone: UI/AI/Preview/Host share producers; Bounce is a Tuned subset on unmoved Fixed support. Maximum 16 AABB/sphere zones, stable IDs, Undo/persistence, real center + hysteresis enter/exit; no outside-to-outside swept detection.
- Meta: persistent budget/request identity/cancel and a real UI loop from baseline→analysis→candidate→compare. Latest mode is offline, network off/budget 0, with no new Meta live use.
- Motion: real controller/kinematic/impulse/trajectory, atomic sidecar/Undo/generation and real motion in the experiment world. Each 30/60/144 render cadence has exactly 240 fixed ticks; this is not a general performance guarantee.
- Renderer: real OAC using the same AudioEngine, 30-second take/45-second context/16 outputs, working estimate 256MiB/output 192 MiB, mix/master/dry/owner stems, cancel/hash/atomicity; no ADM/cloud/complete long chunk carry.
- Curved surfaces: analytic occlusion and bounded first-order reflections using real current poses/normals. dynamicReflector is no longer occlusion-only. Shared budget 256; retain the old 105 fixtures. A quasi-static ray approximation, excluding focusing/caustics/moving-boundary Doppler/physical transmission.
- Environment: formal Project save/load/import/export of medium/temperature with legacy defaults; a10's four real UI fixes address the original vacuum 35.5 FAIL.

217/217 finite families have been joined, with 0 pending. 71 Help items = 68 public-content PASS + 3 conditions not observed. Pipeline22 and a separate Tail 1 PASS retain their different sources/original FAIL. New [Stage12](14-core-pipeline/stages/12-final-integrated-ui-audio.md) has real 180 ticks/Zone 30, 62/nonlinear gain/180 non-stale sphere reflections and 5 individually checked WAV files. Independent RIFF 5/5 PASS, 48 kHz stereo for 5 seconds, sum max 1.1420343071222305e-6 < original 2e-6. Pre-master float >1 is valid without normalization/clipping; safe master has 0 outside range. All 5 have historyIncomplete=true, so they do not claim complete DSP preroll. Large WAV files/partial traces are in D exports/ignored cache, not all in Git.

Tasks24..31 (including 28) are limited DONE. Task23 is BLOCKED only because original native AC04 is blocked by external URL policy. The first three timeouts with 0 inputs are historical. In the fourth round only real Ctrl+N created an authorized independent window; product operation/export did not complete and tools stopped. Do not describe the fourth as a timeout or all attempts as 0 inputs. [FINAL_FINDINGS](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8469bfd6009ac9f4d664456a2efb99a161148dfd) pins 9 fixed problems and 25 pins. The [complete Claude handoff](14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md), Wiki and English are synchronized. Next is independent Claude revalidation/adjustment → user observation of new features. Basic features are confirmed and not reopened. Task22's original literal metadata needs separate reconciliation and is not a prerequisite this round. Complete V1, science/device/listening/original 600-second FAIL/Meta live and other gates remain separate. No push/deployment/new paid use.

<!-- english-original-anchor --> <a id="以下保留先前版本截點"></a>
## Earlier version snapshots retained below

<!-- english-original-anchor --> <a id="2026-10-29-實作與研究現況"></a>
# 2026-10-29 implementation and research status

<!-- english-original-anchor --> <a id="2026-10-29-整合後更新與真人回報"></a>
## 2026-10-29 post-integration update and human feedback

This round's research and minimal fixes have been merged while preserving history. The original workspace's complete quality check and current UI28/linked8/product4/physics2/storage5 components passed. Actual commits, receipts and the incomplete publication process are in [integration-state.json](../12-architecture-review/integration-state.json).

The new [R18 human feedback](../11-v1/USER_TEST_FEEDBACK_20261029-r18.json) takes precedence over earlier descriptions of “awaiting the first human test”: inability to move or operate in first person is a user-reported failure, blocking downstream FPS operations. Materials and reflections were not tested; default volume and direct manipulation have problems. The tested bundle/device are unknown; automated passes cannot override this, nor imply successful numerical or device validation. The next engineering slice first pins the source and diagnoses the first-person input blocker, then addresses volume/direct manipulation and the original recording hot path/performance. These product problems were not fixed this round. Earlier sections retain their original snapshots and subsequent design.


The formal first version has been implemented and **is incomplete overall**. The current baseline is R17 c210ca8 and [REQUIREMENT_EVIDENCE](../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json), not the r11 counts below. R17 functional components succeeded, 600-second performance did not meet thresholds, and normal-100% human FPS/IME and Hi-x65/D3V listening remain incomplete. Task0020/0012 are BLOCKED. The user removed 200% from required gates.

[This round's Gap Analysis](12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md) lists IMPLEMENTED/PARTIAL/PLANNED/EXPERIMENTAL/BLOCKED/UNVERIFIED by domain. [Integration](12-architecture-review/INTEGRATION_REPORT.md) separately records actual validation this round. Additions are a shared 5-second propagation cap and types-only RenderBackend. Motion authoring, full take/stems/ADM and cloud deployment remain unimplemented; there is no Scene/Project/Recording migration.

The 2026-10-28 table and Phase1/2/3 below retain their respective historical snapshots. Do not override current code with early “unimplemented” statements or use old test counts to claim this round's results.

<!-- english-original-anchor --> <a id="實作狀態"></a>
# Implementation status

Status on 2026-10-28: the formal Web first version exists, and current functional components and product chain pass. Performance, human and external gates remain incomplete. The [r11 checkpoint](11-v1/SESSION_PROGRESS_20261028-r11.md), [frozen acceptance](11-v1/ACCEPTANCE.md) and [Now](knowledge/wiki/now.md) record direct evidence, conditions and work status respectively. Overall first-version completion has not been declared.

| Formal module | Current implementation and direct evidence scope |
| --- | --- |
| Scene/Rapier/FPS/Build | Atomic Scene, fixed-step, modes, bounded grab/throw, Staged/Enable and guards are implemented. Current physics2 real-browser tests and 391 related regressions pass; current complete pinned check including 917 runtime tests has passed. [Physics evidence](11-v1/PHYSICS_ACCEPTANCE.md) |
| Sound Behavior/Inspector | Deterministic evaluator, contact/latch, curves, overrides, versioned authoring transactions, suppression reasons and independent static preview are implemented. Current UI27 and component regressions pass; [M0](11-v1/M0_IMPLEMENTATION.md) retains its original narrower scope |
| Acoustic Worker | Direct/occlusion/bounded first-order ISM, cancel, bounds, identity/stale/telemetry are implemented; functional contracts and speed thresholds remain separate. Formal profile's 20Hz/stress path workload is incomplete; this round has not cleared worker targets |
| AudioEngine | Unified routing, one-time delay/distance/HRTF, pause cursor, WAV and bank are implemented. Current native25/IRv2 and 150 audio regressions pass. Preserve Firefox strict energy FAIL/WebKit capability BLOCKED; these are not device listening tests |
| Assets/recording/A-B | IndexedDB, original WAV SHA/rights receipt/relink, motion trace/source phase, RecordedOutput and real B reevaluation are implemented. Current storage5 and product4 all pass, including three fresh contexts and independent store WAV relinking |
| Web UI | EN8/ZH13 and six sound components, 27 PASS total on the current 028b validated build. Native 200%/320CSS/Pointer Lock were not executed this round because of a hidden preflight; old native PASS is historical only |
| Meta product tools | Server provider, safe Host/real simulation/bounded budget are implemented. [Minimal Sound live](../../research/v1/meta-live-validation-20261027-r3-minimal/summary.json) passed real proposal→Apply→local 180 ticks. Scene live/model-planned Run/UI live are not presented as completed; no new paid requests |
| Performance and devices | Preserve formal profile's 628.935-second FAIL/incomplete workload/main occupancy NOT RUN; initial numbers unchanged. Listening tools' 47 pure PASS only prove preparation. Actual Hi-x65/D3V route/sampleRate/block/listening await the user |
| Overall quality | 61 protected files unchanged; retain existing DONE for Task0006/0017/0019. Task0020 remains IN_PROGRESS. Current complete check/offline benchmarks pass, 12 production files and NOTICE candidate bindings match, and all 258 English mirrors were current at that snapshot. Revalidation and local Git preservation are still required after final document changes; external gates remain |

Phase3 Harness and Phase1/2 research evidence remain historical. Their counts or spike passes do not replace formal product acceptance. Phase1 status below is not the current module status.

Phase 3 adds an executable development Harness, failure handoff and offline prompt evaluation; see the [Phase3 report](09-agents/PHASE3_REPORT.md) for the latest scope and actual tests. This does not mean formal 3D/physics/audio/Meta runtimes are complete. Old Phase1/2 artifacts retain their original versions.

The **historical Phase 1 research-preparation status and counts** are retained below. Implementation Pending there does not describe current formal module status. Phase2/3 and this V1 each have separate versioned evidence; do not treat the table's 8 Skills/8 schemas as current repository totals.

Updated: 2026-10-26. Terminology: Research Completed/Decision Accepted/Technical Spike Verified/Implementation Pending/Implemented/Tested/Blocked.

| Component | Status | Actual scope |
| --- | --- | --- |
| Initial inventory/sources/public rules pages | Research Completed | Eligibility and unpublished detailed rules still require personal verification |
| Scientific literature/theory/dataset index | Research Completed (access limits apply) | ≥15 core sources; original paper experiments not reproduced/datasets not downloaded |
| Architecture/10 ADRs/data contracts | Decision Accepted | Reversible preproduction primary plan; not a formal runtime |
| 8 JSON schemas/positive and negative contracts | Implemented / Tested | Local V0; host domain executor unimplemented |
| Analytic kernels/13 fixtures and negative cases | Technical Spike Verified | V1, limited convex geometry/synthetic DSP |
| Basic Rapier physics | Technical Spike Verified | 6 checks; not a finished FPS/Grab product |
| Steam Audio native | Technical Spike Verified | Windows x64 direct/occlusion/transmission/reflections/IR, 3 cycles |
| npm toolchain/CI template/lockfile | Implemented / Tested | Locally tested; remote CI execution NOT RUN |
| Dataset acquisition tools | Implemented / Tested (offline) | Default dry-run/pin/license checks, 17 PASS/1 junction SKIP; no real data acquired |
| AGENTS/8 Skills | Implemented / Tested | Official structural validation + independent reading review; not all task behavior has been tested |
| Formal 3D editor/FPS/Build/Grab | Implementation Pending | Specifications and isolated physics evidence only |
| Formal acoustic worker/audio renderer | Implementation Pending | Principles/contracts; no end-to-end graph |
| AI Scene Composer/Experiment Agent | Implementation Pending | docs/schema/offline contracts; no live Meta connection |
| Record/replay/A-B interface | Implementation Pending | manifest/schema/spec; no end-to-end recording/playback |
| Browser/device/headphone/real room | NOT RUN | V2 actual audio graph, V3 independent solver and V5 measurements still missing |
| Competition eligibility/terms acceptance/submission | Not executed | The user handles these personally; not performed on their behalf this round |

All specific test commands, counts and times are in docs/06-validation, SDK_VALIDATION and benchmarks/results. Status must not present budget targets as measured performance or research results as completed formal features.
