<!-- english-source: {"path":"docs/16-nonadvanced-completion/handoffs/CLAUDE_CODE_HANDOFF_20261103.md","sha256":"52cb8b905f4a0851abfcdfc65e34a37b132b29066fb784e1994728dde217a3fc","translated_at":"2026-11-03T05:38:10.786Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/handoffs/CLAUDE_CODE_HANDOFF_20261103.md`](../../../16-nonadvanced-completion/handoffs/CLAUDE_CODE_HANDOFF_20261103.md). Source SHA-256: `52cb8b905f4a0851abfcdfc65e34a37b132b29066fb784e1994728dde217a3fc`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-labclaude-code-接手報告2026-11-03"></a>
# Reflection Lab: Claude Code handoff report (2026-11-03)

The user requested this report for direct handoff to Claude Code so that it can take over unfinished implementation, independent verification and corrections. The Codex development goal is currently paused. This handoff only checks Git and existing evidence, preserves uncommitted work and updates handoff memory; it does not start new product tests, browsers, long performance runs or feature development. This is an engineering handoff. Overall nonadvanced functionality and first-version acceptance remain incomplete.

**Claude should take over from the D-drive integration worktree below, rather than the old C-drive checkout or old Claude worktree.** Once the user provides this report, continue implementation and verification across the full scope. The user will perform final manual operation and listening tests only after independent review and corrections are complete.

<!-- english-original-anchor --> <a id="1-現況與接手入口"></a>
## 1. Current state and starting point

| Item | Actually checked for this handoff |
| --- | --- |
| Main integration worktree | D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/integration |
| Branch | codex/nonadvanced-integration-20261103 |
| Latest existing commit before handoff | 448a503f5373faccc19aa17c6789ffc01bc26017 |
| Local Main worktree / HEAD | D:/Developing/Meta Hack; e25f9f48302fd357b0f97a6f9bf8565f5916627c |
| Main integration state | This round's work has not been merged back into Main. At inventory time, Main was an ancestor of integration, with 170 additional reachable commits; this does not mean 170 features |
| Latest product src tree | bc1ad463b3de9351255e2d4b22f80175b73daf93; later documentation commits must not be presented as renewed product verification |
| Toolchain | Node 22.17.0, npm11.4.2; .node-version / package.json / lockfile are authoritative for versions |
| Process observation at handoff | At 2026-11-03T05:27Z, no Listen sockets were found on 4173 / 5241 / 5353 / 5194. No old test processes matched; only the inventory's own PowerShell matched. Check again on takeover; this does not mean the entire machine has no other processes |

448a503 is the product/documentation integration baseline before handoff. If this report and memory preservation receive a later documentation commit, use the actual git log; do not invent the document's own commit SHA. This handoff does not merge product branches, move Main, push or deploy.

Read in this order:

1. Root AGENTS.md → knowledge/schema.md → knowledge/wiki/index.md → knowledge/wiki/now.md.
2. knowledge/tasks/RLAB-TASK-0032.json, RLAB-TASK-0033.json and the relevant original PERF / Task0016 / 0020.
3. docs/11-v1/ACCEPTANCE.md, ACCEPTANCE_AMENDMENTS.md and REQUIREMENTS.json.
4. docs/16-nonadvanced-completion/CONTRACT.md, BASELINE_20261103.json and LONG_OUTPUT_FREEZE_20261103_V3.json.
5. This report and the [Git inventory](claude-20261103/GIT_HANDOFF_NOTES.md), [verification fact check](claude-20261103/VERIFICATION_AUDIT.md) and [complete scope check](claude-20261103/SCOPE_AUDIT.md).
6. The [M4 stage handoff](M4_PARTIAL_CLAUDE_HANDOFF_20261103.md), stages/00–04 and their SNAPSHOT_INDEX files. These pinned historical cutoffs must not be rewritten as later results.

Unless a full D:/ or C:/ path is given, paths in this report are relative to the integration root. [EVIDENCE_INDEX.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5490a9f25e7180765b225d696ab2f7b656bc0af7) and the audit JSON files provide original locations, bytes and SHA. Some large PCM, trace and bundle files still exist only as uncommitted physical artifacts. Copying the report does not permit deleting their original worktrees.

<!-- english-original-anchor --> <a id="2-已完成的實作與證據範圍"></a>
## 2. Implemented work and evidence boundaries

<!-- english-original-anchor --> <a id="既有六核心及前次交付"></a>
### Existing six core areas and the previous delivery

The previous core areas include bounded recording / A-B, separated audio-update responsibilities, capabilities / Bounce / Zone, the Meta experiment flow, Motion authoring and an offline mix/stems renderer using the same AudioEngine. They also include actual Zone entry/exit, sphere/capsule occlusion with bounded dynamic reflections, and Project environment persistence. The previous 217 finite parameter families and five 5-second WAV files have actual evidence in the e25 baseline history.

These functions and their historical evidence already exist; do not write a replacement system. However, the previous 1536 runtime tests / 217 families / 5-second WAVs cannot stand in for this round's latest functionality, 60-second long pipeline or formal performance. See docs/14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md for the previous complete handoff and docs/15-ui-parameter-audit/ for its original evidence.

<!-- english-original-anchor --> <a id="本輪頂部監測區"></a>
### This round's top monitor area

The top Build scene / Interactive experiment / Inspect & compare navigation, which had little practical function, has been removed and replaced with four switchable views, preserving the existing design and both languages:

- Levels: actual sources and master L/R. Sources show recognizable names and stable voice instance IDs; zero signal, unknown and not-ready states are distinct.
- Spectrum: actual Blackman FFT, labeled in Hz / dBFS, with L/R support.
- Waveform: actual left/right waveforms. Display scaling changes observation only and does not change audio.
- Load: measured RAF intervals, physics wrapper, Worker solve and audio control update times. These are neither whole-process CPU percentages nor native DSP CPU; missing data must not be filled with 0.

The observation loop is capped at 15 Hz, updates canvas imperatively and does not set React state every frame. Analyzers are created and released on demand, with bounded source/channel budgets. Footer listening / mute / gain / buffer / raw / simulated / reverb controls remain. Switching modes can preserve selection and one type of valid unsaved Zone draft; not every draft type has been tested.

Main implementation: src/ui/TopMonitor.tsx, top-monitor-model.ts, top-monitor-loop.ts and top-monitor.css; src/audio/live-monitor.ts / engine.ts; src/app/live-monitor-labels.ts, live-monitor-observation.ts / runtime.ts.

<!-- english-original-anchor --> <a id="錄製音訊儲存及方法工程"></a>
### Recording, audio, storage and measurement-method engineering

- Worker prepare ACK and generation/cancel/timeout ownership are connected. Preparation is awaited before starting; the audio callback does not wait for a Worker or network.
- The storage-ready gate from 94995984 was integrated at 735cb747. Admission starts only after actual backend.create / transaction completion, sharing the original 10-second preparation deadline with the Worker. Cancel/reset/dispose protect previous results; there is no automatic Resume.
- readVerifiedJobSnapshot is integrated through a normal merge. It verifies historical job descriptors / all chunks / hash / sequence together, then rechecks pins. Cancellation, limits, transaction completion and original errors are preserved. Its 65 component cases do not establish successful real long-audio or complete real-IDB verification.
- Asset scoped lease / pin / LRU / cold restore / decode staging, runtime capture/replay/offline finally protections and preview-replacement fixes have candidate integration. Real OAC / reload / resource-cost verification is still required.
- Audio resource policy has a phase/cursor-preserving candidate and negative lifecycle tests. The default remains reference/off. Short PCM success has not been treated as full adoption or a performance benefit.
- Acoustic pose-aware cache / compact packet candidates have implementation and component evidence. The default remains clone reference; cost/equivalence comparison across A/B/C/D using the same real corpus is unfinished.
- Meta server envelope / reader ownership / UTF-8 / redirect / credential fixes and fixture tests exist. This round has no new paid inference or new authenticated live-integration evidence.
- The V4 performance collector, original-trace semantic qualification, CPU observation, fail-closed parser and 611 method cases are integrated. Being able to collect data does not mean the product meets performance requirements.

<!-- english-original-anchor --> <a id="3-已跑測試哪些是真的哪些仍未過"></a>
## 3. Tests already run: supported results and remaining failures

<!-- english-original-anchor --> <a id="最新整合與監測區"></a>
### Latest integration and monitor area

| Verification | Actual result and limit |
| --- | --- |
| Monitor components | 83/83; overlaps the later 118, so do not add the totals |
| 1f3779 integration regression | Seven files, 118/118, 17.801 s, global tsc exit 0; not complete npm run check |
| b902 V4 collector | 611/611, 5.090 s; method tests, not 600-second performance |
| 1f258 latest preparation gate | global tsc exit 0; production / e2e builds each exit 0 |
| Production Playwright attempt03 | Pinned b7ade bundle: 4 PASS / 1 FAIL, 0 page errors / 0 model calls |
| Short native phase/lifecycle | 10 pairs, 20 PCM files of 2 seconds each; maxAbs1.62112216e-7 and relative RMS8.55679227e-9, within the original 2e-6; not a continuous 60-second recording |
| Native meter / FFT | Pinned 375 Hz / 48k on the same clock: waveform difference 0, DFT error 4.29683e-7 dB; mute/release/dispose evidence exists, but this is not hardware listening |

Playwright attempt03 passed the four modes / keyboard / focus / L-R / ZH-EN, real levels / FFT / waveform / load, mute/pause, 390 / 929 / 1440 CSS px, footer/viewport controls and preservation of selection / a Zone draft. Its failed case was the recording fixed-step guard at global tick 87. That version could not keep recording advancing; this does not establish that a mode-switch button caused the failure.

Sources: docs/16-nonadvanced-completion/lanes/top-monitor-browser/ATTEMPT03_REPORT.json and test-results/top-monitor-production-attempt03/. The later storage-ready product has not rerun all five cases.

Latest successful build receipts:
.cache/nonadvanced-20261103/root/top-monitor-production-build-attempt06.json (dist .cache/top-monitor-production-attempt04)
and .cache/recording-readiness/e2e-build-attempt03.json (dist .cache/recording-readiness/e2e-dist-attempt03).
Both buildHEAD values are 1f258, not the unmerged df838 observer. Preserve the original receipts' use of log mtime for completedAt and their retrospective pin scope; do not present these as prebuild capture.

<!-- english-original-anchor --> <a id="錄製-diag04準備修補有效持續吞吐仍失敗"></a>
### Recording diag04: preparation fixes work, sustained throughput still fails

This observation used source c321b02 and build1f258. The first guard was definitively from storage:

- Worker creation occurred only after storage create completed in 73.3 ms. Prepare ACK took about 147.6 ms; the gate did operate.
- The first append took about 83 ms. One frame had persisted, but pending later reached 8 and triggered the original backpressure.
- Evaluation was accepted 14 / committed8 / pending 6, without backpressure. Storage was accepted 9 / persisted1 / pending 8, with backpressure.
- Public Stop successfully sealed 14 continuous accepted frames 52..65. This is a valid prefix, not completion of 60 seconds or passing sustained throughput.
- The first 83 ms is neither a steady-state cost nor pure disk latency. It cannot be attributed directly to IndexedDB, GPU or one function.

df838 adds bounded advance diagnostics in the recording-readiness branch: first 8 / last 2 / first overrun, capture identity, and separate host flush and advance/onTick/publish timings. It has not been merged into integration. It does not cover synchronous work within async commit of a Worker reply; low advance time therefore cannot exclude a main-thread bottleneck.

**The subsequent async-commit segmented timing / batch-size observation has not been implemented.** The inventory found no uncommitted source for it. The original 46da storage audit shows that append also contains SHA, UTF-8 decode / JSON parse, identity validation, fixed reads and transaction completion. The same frame also undergoes repeated frame walks/encoding, but measured costs are missing.

Do not increase the 8-frame / 32 MiB queue, discard accepted ticks, clear tick debt, reduce the workload or automatically Resume to produce green results.

<!-- english-original-anchor --> <a id="效能-wiring-01cli0產品門檻明確未過"></a>
### Performance WIRING-01: CLI0, product gates clearly not met

Actual data is in the baseline worktree:
artifacts/v1/perf-nonadvanced-20261103-v4-wiring-01/.
There is also a preserved copy at docs/16-nonadvanced-completion/lanes/performance/v4-wiring-01-evidence/. These raw files, compressed preservation files and some reports remain untracked and are not fully archived into integration.

status = MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD;
formalQualified=false; overallV1=false. CLI exit 0 only means collection finished. This was a 20-second UI wiring pilot. **The latest source has not run the formal 600-second test; historical 600-second FAIL results remain preserved.**

| Subtest | Original workload and measurement |
| --- | --- |
| Physics | 256 bodies =255dynamic +1fixed, CCD64, 3000 steps; native p95=2.5 ms, missing the original 2 ms target; complete fixed tick p95=16.4 ms |
| Acoustic productDefault | 8 sources/native voices, pathcap8 per voice, target64, 600 iterations; 20.000267 Hz, but 20 deadline misses and 20 Hz windows=false |
| Acoustic stress | The same 8 sources/voices, pathcap32, target256, 600 iterations; 19.993458 Hz, 21 deadline misses, 20 Hz windows=false |
| Native consumer chain | productDefault/stress p95=6.3/14.5 ms, missing the original 1 ms target |
| Stress paths | 76 new droppedPaths in the measurement window (85−warmup9); current+retired totals256. Retiring paths may occupy capacity, but a sole root cause is unproven |
| UI | 105 objects/100dynamic, 20.1791 seconds, 804 frames; frame p95=50.1 ms>16.67, RAF callback42.8 ms>4, main occupancy50.026 ms>4; all FAIL |
| UI validity | uninterrupted/fixedTick/noDebt/periodicCapture and other conditions failed; this is not a complete qualifying workload |
| Native underrun | Cumulative2 already existed at warmupAfter; there was no increase over 20 samples or at the end, giving window delta0. This is not listening evidence or proof of uninterrupted PCM |
| CPU | Win32 before/after were both OBSERVED with exit 0. The process set grew 8→9 through a new TracingService, so whole CPU total/ratio is PARTIAL/null, not 0 and not an API read failure |
| Actual environment | headless Chrome 156.0.8078.75; ANGLE NVIDIA RTX4070 D3D11. A SwiftShader flag does not establish actual SwiftShader use |

Do not confuse physics256 with UI105, or describe stress cap 32 per voice as 32 voices.

The measurement method itself has two issues to fix first:

1. The before CPU endpoint currently precedes Tracing.start, leaving the new TracingService without a common starting point. The candidate is to take before after the existing await Tracing.start completes and before beginUI, leaving after unchanged. This requires a new version, source-order/lifecycle tests and independent review. Explicitly exclude Tracing.start preparation cost; do not fill missing values with zero or replace the window. This has not been implemented.
2. The transitive performance-attribution-metrics-v1.mjs dependency is missing from the existing source pin set. Add it in the next version. Historical sourceStable=true supports only the originally listed set; historical capture cannot be retroactively supplemented.

The designated Chrome semantic precondition passed and was adopted. Its qualificationId is semantic-v3-c59df8c64fdfa846d6e22daf, not a Git SHA.
exe SHA: 7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa.
A version/executable change requires qualification to be checked again. Keep the original 50 ms native gate and formal workload/thresholds unchanged. Native DSP CPU remains null; process CPU cannot replace DSP CPU.

<!-- english-original-anchor --> <a id="長輸出有真音檔數值與完整矩陣尚未過"></a>
### Long output: real audio files exist, but numerical gates and the full matrix have not passed

The five product WAV files plus manifest were actually downloaded completely, but the original whole63 reference master gate still FAILS:
maxAbs 2.9802322387695312e-6; 321 samples exceed the original 2e-6; that attempt was 57/58.
Same-length62 / cropped / simplified-graph results must not overwrite the original failure, nor may the beginning be skipped or tolerances relaxed.

Of 16 diagnostic files, only 14 are complete, 1 partial and 1 missing. The complete six-pair matrix is still unavailable.

- pairedV2: the DSP call reached ERROR/timeout at about 150 seconds; five comparisons were false and the sixth had no result. There were no new downloads or complete independent parser result.
- Snapshot-based pairedV3 source 85524212 is in offline-render, not integration. It has 8 method tests and evidence of 88 equivalent fields against old fixed PCM; this is not successful new native long output.
- One pairedV3 attempt stalled during startup and produced no new DSP values. startup-probe-v2 failed its original 2-second page deadline, without goto/HTTP/DSP. This does not prove fullV3 also fails its 10-second page deadline.
- The b317 cleanup improvement and ed7 startup-error/settled-cleanup evidence are committed in that branch. Only a startup-probe-v3 ordering change was prepared afterward: launch/connect/context/blank page before listen, avoiding overlap between cold-start stages. The new probe has not actually run, and final type/lint/review/sourcefreeze are unfinished.
- The 6 untracked offline-render files were separately preserved byte-for-byte in the [WIP snapshot](archive://uncommitted-local/docs/16-nonadvanced-completion/handoffs/claude-20261103/untracked-source-snapshot/offline-render), totaling 45, 437 B. Review them from the original tree; do not treat the snapshot directly as an adopted patch.

The original long-output specification remains 60 seconds of signal /3600 accepted ticks, 48k stereo, 2 stable owners, and a 2-second tail =62 seconds /2,976, 000 frames; 5WAV (master/raw/simulated/2owner stems) +manifest, 23,808, 056 B per WAV and 119, 040, 280 B for five files.
3601 inclusive is only an independent capacity fixture; do not expand the render window by a tick. Keep context75 seconds, working256 MiB estimate, output 192 MiB, archive384MiB/64jobs, chunk32768 and original capture18000 frames/64MiB unchanged.

<!-- english-original-anchor --> <a id="4-分支與未提交內容接手先保全再有序整合"></a>
## 4. Branches and uncommitted work: preserve first, then integrate in order

All worktrees for this round are inside the project at D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/.
The complete 13-tree / commit / dirty inventory is in [WORKTREE_INVENTORY.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/35fee8c93f8f6c2caedbb31812d59aa6b40a1b92).

| Worktree | Current tip / takeover notes |
| --- | --- |
| integration | 448a503; 29 tracked modifications under docs/en, plus untracked recording readonly findings and top-monitor reports. Preserve them; do not stage broadly |
| recording-readiness | 46da1f62516b0154b3ef2db3eb7c3d7e904723e2; 4 commits not reachable from integration: c4e77 diag04, eff1 normal merge of c321, df838 observer and 46da readonly append audit; source clean |
| offline-render | ed7bc0eeb00c120973d7959ec66773f3e206466c; 6 commits absent from integration plus the 6 untracked files above. d182 snapshot and Root b8d5 are the same implementation history; do not count this as a new feature twice |
| baseline | 6ba01b44b57a4741a7e58fb42718e71875b776f3; only 1 unmerged source-freeze documentation commit, but 206 untracked files include wiring raw/compressed preservation and historical method receipts. Archive before cleanup |
| render-performance | c321b02d133934606673a32014f83dfa4b77a9e4, clean; no renderer optimization implementation or WIP |
| Other 8 trees | acoustic-transport / asset-lifecycle / audio-resources / audio-retirement / meta-demo / recording-storage / top-monitor-ui / ui-recovery tips are all integration ancestors; this does not mean each scope has complete acceptance |

Before normally merging the recording branch, check the gate/diagnostic harness already in Root; do not overwrite it redundantly. For offline-render, review the shared snapshot history and test differences before the normal merge. Handle worktrees/new files/evidence ownership first; do not use reset --hard, clean or forced removal.

Old worktrees retain user and historical data: Main129untracked; old C checkout11modified +7untracked; old Claude tree9350dirty (9339deleted +11modified) and 602untracked. These are observations, not changes made for this handoff. Do not restore or delete them without authorization. The old C checkout and old Claude tree are both at 429efb7 and cannot serve as the latest source for this round.

Only the formerly clean, Main-ancestor environment and render-tail-validation trees were safely removed. The shared node_modules junction target and lockfile SHA were checked unchanged before/after. Other dirty/raw trees are retained. The new dependency junction points to D:/Developing/Meta Hack/node_modules; do not recursively delete its target.

<!-- english-original-anchor --> <a id="5-claude-執行順序與每步完成條件"></a>
## 5. Claude execution order and completion conditions

<!-- english-original-anchor --> <a id="p0先讓錄製與量測可信再修真瓶頸"></a>
### P0: make recording and measurements trustworthy, then fix measured bottlenecks

1. Check Git / dirty / untracked / original artifacts and preserve the baseline. Normally integrate reviewable recording-observer and long-method candidates; do not batch-merge unreviewed patches or touch old private trees.
2. Extend bounded async-commit diagnostics: capacity synchronous call / capacity-await wall time / Recorder+enqueue synchronous cost, existing encoded bytes / write batch size, and bounded scalar samples such as first8/last2 by capture identity. Do not retain frame buffers, re-encode or log from callbacks.
3. After checking new source / harness / fresh build / HTTP bytes, run one new recording diagnostic with the original 10-second observation /45-second test. Preparing is not recording; do not extend the observation window. Seal through public Stop. Use actual data to locate serialization/hash/main-thread/IDB transaction cost, then apply a narrow fix.
4. Preserve the four accepted/processed/persisted/published watermarks, original order/canonical hash/errors/capacity. Verify real IDB, cross-tab WebLocks, cancel/crash/reload/incomplete, protection of earlier results and negative capacity cases.
5. Rerun the five top-monitor cases against the same latest production bundle. Recording must continue through changes across four views/sources/channels. Verify source identity, drafts and dispose. 4/5 cannot stand in for overall success.

<!-- english-original-anchor --> <a id="p1長輸出與效能可並行寫碼重負載串行執行"></a>
### P1: long-output and performance code can proceed in parallel; heavy execution must be serial

1. Complete method verification / type / lint / review / sourcefreeze for the 6 startup-v3 files. After one startup-only probe passes, run complete pairedV3: four fresh native graphs62A/63A/63B/62B and all six original-tolerance pair comparisons.
2. Save each stage's wall time, bounded partial results and actual cleanup. Download the 5 product WAVs and necessary diagnostics serially; independently check RIFF/PCM/frame/rate/channel/hash/stem sums and whole-output/boundary references. Preserve the historical321 overs and prove the correction under the same conditions.
3. V3's current 260, 307, 504 B =248.249 MiB is only a conservative live-reference estimate, not measured process RAM. Ensure Trace / multiple native PCM buffers / snapshots are not retained simultaneously. Releasing references does not prove completed GC.
4. Fix V4 transitive pinning and CPU endpoint order, preserving old raw and PARTIAL/null. Create a new freeze after tests/review. Compare probe-on/off with the same workload and perform readonly attribution before accepting benefits or enabling candidates.
5. Unimplemented renderer candidate: SolverPath in src/ui/viewport/SceneEntities.tsx recreates Geometry/Vector3/Material/Line at every publication because path DTO identity changes. Retain bounded resources, update data and verify cleanup. Root currently has audit findings only and zero patch; do not claim a fix. Do not reduce64paths/vertices/precision/shadows/DPR/rate to pass performance.
6. Runtime.publish has candidate per-object find and path-DTO allocation costs, without measured stage costs yet. getPose already caches by the same snapshot+alpha; do not mistake it for recomputing the whole scene per object.
7. Design around Stress256's current+retired total cap and 76 drops according to the original contract. Do not increase256, remove retiring fades or loosen capacity assertions. An audio deterministic fan-in tree is only an unverified proposal; it changes Float32 summation order and cannot be claimed to fix whole63 without new numerical evidence.
8. Run acoustic A uncached clone / B cached clone / C uncached packet / D cached packet on the same real physics/behavior/request corpus, preserving oracle/stale/ownership/cost equivalence. Compare asset and voice policies under equal phase/pin/resident/staging/latency conditions; retain reference when benefit is unproven.
9. Complete the original full 600-second formal workload/thresholds and qualifications separately from the 20-second pilot. Missing nativeDSPCPU stays null. Do not conflate process/RAF/callback/device/listening layers.

<!-- english-original-anchor --> <a id="p2全產品驗證與真音檔管線"></a>
### P2: full-product verification and the real audio-file pipeline

Follow docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_RUNBOOK.md:
freeze fresh source/bundle/executable/HTTP bytes and run22 routes serially. **--lanes all is required.** The runner defaults to recovery only and does not build or start a server.
249 mixed registry rows = historical217 +21overlap scenarios +11topmonitor. They are neither249 unique parameters nor all PASS.

Scope includes Editor/FPS/Build/exit/lock/focus/IME, ZH-EN, every reachable parameter, Help and disabled reasons, valid/invalid/exact boundaries/undo/redo, save/load/import/export, Meta offline/rejection/rollback, and complete capture/A-B/render/archive/recover/download/delete/discard.

The real complete pipeline is Scene/Rapier → motion/contact/sound behavior → acoustic geometry/solver → unified native audio → capture/persist/load/replay/A-B → offline master/raw/simulated/each owner stem → actual individual downloads and independent parsing. Internal direct calls do not substitute for DOM clicks; trace JSON is not PCM, and checking download names alone is insufficient.

Windows Computer Use and Playwright must each have their own results. Native operation at normal 100% is required. The user removed200% as a gate; do not reinstate it.

Computer Use is currently unpassed because of a URL-confidence policy STOP. Read the available official computer-use SKILL and use its permitted Windows operation tools. Previously, only one authorized Ctrl+N to create a window succeeded; product operation/export did not complete. Do not use Playwright/headedDSP/private IPC/another tool to bypass the method's restriction, and do not read private Brave pages. If a trusted product window still cannot be safely identified, the user must manually create the designated local window, followed by identification under the tool rules. This does not guarantee the policy clears; if STOP remains, record the external blocker accurately.

<!-- english-original-anchor --> <a id="p3品質記憶英文main與人工前交付"></a>
### P3: quality, memory, English, Main and delivery before manual testing

- Run complete npm run check, build, applicable numerical/physics/acoustic/audio checks and independent review on the same final sourcefreeze. Preserve the original requirement for three clean product E2E runs and ten reset/import/dispose cycles. Scoped GREEN is not complete check.
- docs/16-nonadvanced-completion/requirements/REQUIREMENT_CROSSWALK_DRAFT_20261103.json is still a51-row draft. Adjudicate each literal condition against current evidence; do not simply mark all PASS.
- Task0032 currently has onlyAC01=true; AC02–09=false. Task0033 has AC01/03/04/05=true and AC02/06/07=false. Writing this handoff does not make the wholeAC09/AC07 true.
- Do not reduce Task0016/0020 or original PERF dependencies/criteria. Historical true values retain only their original scope; they do not establish renewed current success.
- Update each stage's source manifest/task evidence/relevant Wiki/checkpoint/handoff/Now serially. Shared memory and the Git index each have one writer. Preserve existing locks/events and use the normal CLI claim/release and optimistic hashes.
- Only after final English freshness/sourcehash/semantic review and license/NOTICE/CI/reproducible-command reconciliation should normal integration into local Main occur. Push/deployment are not authorized; do not push the large local history into public main.
- The user's final manual observation/listening comes after Claude completes its work. Do not reopen prior basic-function feedback as another identical manual test round.

<!-- english-original-anchor --> <a id="6-英文文件與共同記憶尚待收尾"></a>
## 6. English documentation and shared memory still need finalization

108 English documents and another30 were committed separately at ba206589/448a503. This is not final acceptance of the whole corpus. The last global finalize still returned exit 1:
575 originals, 545 required =545 translated, 0missing/0stale, 4 errors/15 warnings.

All4 errors concern historical test-results links in docs/en/11-v1/REQUIREMENT_EVIDENCE_20261027.md. The four hrefs have dirty fixes pointing to already committed aliases with identical bytes. Target SHA is b31ff1eeae3a51b068bdf4b1793fe8f2d83994612ff25e3112e094c390043dfa. Single-file scoped PASS 1 exists; claims and canonical source are unchanged. **The global check has not rerun after this fix.**

docs/en/index.md / manifest.json / validation.json and related English files still have tracked changes; retain them. Before another finalize, preserve the original failed JSON/manifest/log and use a fresh attempt; do not rewrite old results. This report and new Now/status updates will add English requirements. 0missing/stale does not mean full English PASS.

M4 already archived160 memory files under checkpoint d3532745-f33c-46ed-984c-d5098b826f24, pinned to the earlier1f source. M5 has not completed full engineering acceptance. This handoff only adds a “pause and transfer to Claude” record and preserves M4 history. The CLI handoff and Now locate new events. Task32/33 were IN_PROGRESS at inventory time; after normal release of their cooperative claims for this handoff, the existing CLI rules change them to READY for Claude to claim. The complete criterion text and truth values are unchanged. READY means neither completion nor reduced acceptance.

<!-- english-original-anchor --> <a id="7-建議分工與可用命令"></a>
## 7. Suggested division of work and available commands

Use three development lanes with separate file ownership: A recording runtime/storage, B long-render methods/DSP, C viewport/performance methods; add an independent review/UI-verification role and one memory/Git-integration writer. Confirm ownership first to avoid multiple writers in runtime/engine. Code analysis and small tests may run in parallel. Heavy builds/native audio/browser/profile execution on the same machine must be serial. Old Root ephemeral leases are not a gate requiring Claude to wait indefinitely for Codex approval. Claude should schedule execution after takeover while respecting user budget and safety boundaries.

Basic readonly startup:

~~~powershell
Set-Location -LiteralPath 'D:\Developing\Meta Hack\.worktrees\nonadvanced-20261103\integration'
git status --short
git log -8 --oneline
git worktree list --porcelain
node scripts/wiki/cli.mjs status --format json
~~~

Use the existing locked dependencies. If a clean install is needed, first check whether node_modules is a junction and who owns the shared target; do not blindly run npm ci against shared dependencies. The final quality command is npm run check; this report did not rerun it.

Existing reproducible focused entry points:

~~~powershell
node --import tsx --test tests/integration/performance-v4-method.test.mjs
node node_modules/@playwright/test/cli.js test --config tests/browser/top-monitor-production.config.ts
node node_modules/@playwright/test/cli.js test --config tests/browser/nonadvanced/recording-readiness/diagnostic.config.ts
node tests/browser/nonadvanced/run-s4-ui.mjs --lanes all
~~~

The Playwright commands above require a fresh build/receipt and the correct preview first. Set fresh TOP_MONITOR_RUN_NAME, TOP_MONITOR_PRODUCTION_DIST and TOP_MONITOR_BUILD_RECEIPT, or RECORDING_READINESS_ATTEMPT / DIST / BUILD_RECEIPT. Do not use defaults to overwrite an existing attempt. After merging the new observer, diagnostic source pins must include src/app/recording-advance-diagnostics.ts; synchronize the actual topmonitor inputs as well, rebuilding the bundle/receipt. Old17/20 product pins and old builds must not stand in for new source.

Exact historical wiring command, for method reproduction only: do not overwrite its original output, and fix the method issues above first.

~~~powershell
node tests/browser/run-performance-v4.mjs --seconds 20 --phase all --physics-iterations 3000 --acoustic-iterations 600 --probe-mode on --qualification semantic-v3-c59df8c64fdfa846d6e22daf --top-monitor-mode levels --top-monitor-input master-left --audio-policy-arm reference --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe' --output 'artifacts/v1/perf-nonadvanced-20261103-v4-wiring-01'
~~~

See CURRENT_RUNBOOK for the formal S4 execute command, complete freeze and original timeouts. There is no established overall hard wall limit for all 22 routes; do not present22×20-minute child budgets as an actual runtime promise.

<!-- english-original-anchor --> <a id="8-範圍與完成定義"></a>
## 8. Scope and completion definition

Included: PERF001–008/011/014, complete Task0016/0020 reconciliation, the additional top-monitor requirement, complete UI/parameter verification by both methods, the real long pipeline, stage memory and handoff. Excluded: Task0015 and PERF009/010/012; cloud013 is not authorized. New paid-API budget is 0. Do not accept terms, submit to the competition, deploy or push on the user's behalf. Meta keys stay on the server and out of Git.

Preserve React/TypeScript/Three/R3F/Rapier/Web Acoustic Core/Web Audio and the existing design. Before UI changes, read docs/05-ux/DESIGN_SYSTEM.md, canonical tokens, Component/FPS/Motion specifications and reflection-lab-design-system/Emil skills. Do not redesign the visual language. Important mathematical/schema/timing/ownership changes require meaningful tests and independent references; tests that copy implementation are not self-proof.

Keep scientific/quasi-static acoustic approximations, dBFS≠SPL, actual Hi-X65/D3V device listening, personal eligibility/external terms/root LICENSE separate. Fixtures or historical minimal Meta Sound live evidence do not establish this round's complete live integration. Original STOP/FAIL/NOT_RUN/null must not become PASS/0.

Before delivery, Claude should provide the user with actual final Git/Main state, changes made, each current verification result, failures/external limits, a complete per-file WAV and manifest list, reproducible commands, updated Now/tasks/checkpoints/handoff and an entry point for final manual testing. Preserve every incomplete condition accurately. A completed handoff document or one suite's exit 0 does not establish a complete first version.
