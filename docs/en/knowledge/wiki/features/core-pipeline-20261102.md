<!-- english-source: {"path":"knowledge/wiki/features/core-pipeline-20261102.md","sha256":"f1349fb3bc269370097b032ff327c3b159f6332419e85ed191c6ed9076265908","translated_at":"2026-11-03T02:49:59.443Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-CORE-PIPELINE-20261102
title: Six-core implementation and integration acceptance
type: feature
status: ACCEPTED
created_at: 2026-11-02T05:04:33.815Z
updated_at: 2026-11-03T02:33:40.542Z
sources:
  - CORE-REQ-20261102
  - PUB-CORE-CONTRACT-20261102-V1-c407c71c78da
  - CORE-STAGE-03-20261102-V1
  - CORE-STAGE-05-20261102-V1
  - PUB-CORE-STAGE-01-20261102-V1-24fafd921228
  - PUB-CORE-STAGE-02-20261102-V1-d7982995b235
  - PUB-CORE-STAGE-04-20261102-V1-cd85b0e37287
  - CORE-STAGE-06-20261102-V1
  - CORE-MOTION-GENERATION-20261102-V1
  - CORE-RENDER-CONTRACT-20261102-V2
  - CORE-STAGE-07-20261102-V1
  - CORE-STAGE-07-20261102-V2
  - CORE-WORKSPACE-STATE-20261102-V1
  - CORE-STAGE-08-20261102-V1
  - CORE-STAGES-20261102-V1
  - CORE-STATUS-20261102-V1
  - CORE-NEXT-20261102-V1
  - CORE-LIMITS-20261102-V1
  - PUB-CORE-STAGE-09-20261102-V1-24c2bd0b272e
  - CORE-INTEGRATION-PROGRESS-20261102-V1
  - CORE-META-UI-WORKFLOW-20261102-V1
  - PUB-CORE-STAGE-10-20261102-V1-363d6d4d3d24
  - CORE-INTEGRATION-PROGRESS-20261102-V2
  - UI-TAIL-COMBINED-501-READ-20261102-V1
  - CORE-STAGE12-WAV-20261102-V1
  - PUB-CORE-STAGE12-REPORT-20261102-V1-473e376849d2
  - CORE-R21-FINAL-READ-20261102-V1
  - UI-FINAL-FINDINGS-20261102-V1
  - CORE-STATUS-20261102-V2
  - CORE-NEXT-20261102-V2
  - CORE-STAGES-20261102-V2
  - CORE-RENDER-FINITE-CLOSURE-20261102-V1
  - UI-FINAL-PARAMETER-COVERAGE-20261102-V1
  - CORE-NATIVE-FINAL-URL-POLICY-20261102-V1
  - CORE-NATIVE-GATE-CLASSIFICATION-20261102-V2
  - CORE-FINAL-CHECK-FAD14CC-20261102-V1
  - CORE-MAIN-FIRST-FAST-FORWARD-20261102-V1
  - NONADVANCED-USER-20261103-V1
  - NONADVANCED-BASELINE-E25F9F4-20261103-V1
  - NONADVANCED-CONTRACT-20261103-V1
  - NONADVANCED-S0-FREEZE-20261103-V1
  - NONADVANCED-LONG-OUTPUT-FREEZE-20261103-V2
  - NONADVANCED-CONTRACT-20261103-V3
  - NONADVANCED-M1-UI-AUDIO-ACOUSTIC-READ-20261103-V1
  - NONADVANCED-M1-ASSETS-META-STORAGE-READ-20261103-V1
  - NONADVANCED-51-CROSSWALK-DRAFT-20261103-V1
  - NONADVANCED-STATUS-20261103-M1-V1
  - NONADVANCED-LIMITS-20261103-M1-V1
  - NONADVANCED-NEXT-20261103-M1-V1
  - NONADVANCED-OWNERSHIP-M1-20261103-V1
  - NONADVANCED-CANDIDATE-M1-20261103-V1
  - NONADVANCED-LONG-OUTPUT-FREEZE-20261103-V3
  - PUB-NONADVANCED-CONTRACT-20261103-V4-9f596a63a30f
  - NONADVANCED-M2-ROOT-STORAGE-READ-20261103-V1
  - NONADVANCED-M2-LONG-AUDIO-READ-20261103-V1
  - NONADVANCED-M2-PERF-READ-20261103-V1
  - NONADVANCED-M2-CURSOR-P1-READ-20261103-V1
  - NONADVANCED-M2-ROOT-OPERATOR-20261103-V1
  - NONADVANCED-OWNERSHIP-M2-20261103-V1
  - NONADVANCED-STATUS-20261103-M2-V1
  - NONADVANCED-LIMITS-20261103-M2-V1
  - NONADVANCED-NEXT-20261103-M2-V1
  - NONADVANCED-M2-PARTIAL-MILESTONE-20261103-V1
  - NONADVANCED-M3-TOP-MONITOR-PARTIAL-20261103-V1
  - NONADVANCED-M4-PARTIAL-STAGE-20261103-V1
related_tasks:
  - RLAB-TASK-0023
  - RLAB-TASK-0024
  - RLAB-TASK-0025
  - RLAB-TASK-0026
  - RLAB-TASK-0027
  - RLAB-TASK-0032
  - RLAB-TASK-0033
related_decisions:
  - ADR-011
  - ADR-013
  - ADR-014
  - ADR-015
supersedes: []
tags:
  - P0
  - core-pipeline
  - implementation
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/features/core-pipeline-20261102.md`](../../../../../knowledge/wiki/features/core-pipeline-20261102.md). Source SHA-256: `f1349fb3bc269370097b032ff327c3b159f6332419e85ed191c6ed9076265908`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="m4部分整合與claude可讀交接完整goal仍active"></a>
## M4 partial integration and readable Claude handoff; overall goal remains ACTIVE

The [frozen M4 stage](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/73953e8828395991c584e3a81d1022f465e134b1) / [partial Claude handoff](../../../16-nonadvanced-completion/handoffs/M4_PARTIAL_CLAUDE_HANDOFF_20261103.md) separate Root 1f and b7 browser sources: latest global tsc 0 + 118/118 focused; overlapping 83/77/64/118 are not summed. Worker 22/63, Runtime 25, and Native03's ten pairs / twenty 2-second PCM files each provide bounded evidence, neither full npm check nor one long take. The build receipt was created afterward, completedAt=log mtime, without claiming a prebuild capture.

Production03 is 4 PASS/1 FAIL: evidence covers Zone draft/selection across four modes and bounded load readings; recording fixed-step guard still FAILs. Headless diag02 is a fixed-step guard with pressure null / five archived frames; headed diag03 is storage FIRST_GUARD: eval 14/7/7, store 8/8/0/8, Worker ACK 531.8 ms was awaited, storage create 253.6 ms was not awaited at start; a new Store-ready gate is being developed, not already fixed. Fourteen frames 58..71 are an accepted prefix, not throughput PASS.20/19 are disk source pins; HTTP directly verifies index/entry, without inferring CPU/GPU or a sole root cause.

V4 only has Root's adoption of an exact-Chrome semantic prerequisite, window 222.6 ms; Root 1f registry remains empty, new record/module is not integrated, and no new 20s/600/DSPCPU evidence exists. V2: 150 s ERROR / five false / sixth result missing /0WAV; snapshot merged with 65 component cases, not real IDB/long WAV/parser/peak evidence. Later Root-reported V3 startupERROR/noDSP awaits M5 and is not this M4's six numerical comparison results. Two EN UX source hashes match; 2 PASS is only Root-reported, not full English coverage. Only two clean/Main-ancestor old trees were removed; other dirty/raw/activeC/Claude trees remain.

Task33 still has AC01/03/04/05 true, 02/06/07 false / IN_PROGRESS; Task32 only AC01. Original PERF/16/20/51, caps, tolerances, and formal workload remain unchanged. Full S4/CU/full npm check/full English/Main merge/final complete Claude handoff and subsequent human testing remain incomplete. This partial handoff cannot count as final goal completion.

<!-- english-original-anchor --> <a id="m3頂列四模式有限證據已固定完整工程仍active"></a>
## M3 top row's four modes: bounded evidence frozen, complete engineering remains ACTIVE

The [M3 partial milestone](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/aac9048a20f8addd2cb72f1a92466b98c21c8eb9) separates UI/build ac0b895, native02 audio5b8ace, and original native01 FAIL. Root 64/64 focused, without adding overlapping paint24; build01exit2, 02/03/04exit0, with only 04 tied to 13 sources. Playwright02 is 3 PASS/1 FAIL, 4/4 source/HTTP, 0pageerror/modelcall: evidence covers four modes/keys/focus/L-R/ZH-EN, 390/929/1440DPR1, and actual bounded charts.

New native02 componentPASS is supported by 9raw/53248B, the same render clock, wave difference 0, DFT error 4.29683e-7 dB<original 0.3, mute0/-Infinity, and release/dispose; original 01 FAIL/2of9 remains. API elapsed time is not DSP/CPU, and 0 ms means timer resolution only. Original50/58 control budgets and 15Hz/lazy/unknown matrix use composite evidence, not native upper-bound stress tests/formal performance.

Task0033 AC01/03/04/05 have literal-by-literal composite evidence; AC02/06/07 remain false/IN_PROGRESS. Task32 original AC02–09, original 51/PERF/16/20/formal workload/tolerances remain unchanged. Recording Pause preceded the first Spectrum;1.42 s=global 85/60, recording UI0.12 s is not accepted count, and shared guard does not distinguish evaluation/storage; cold-start or chart-switch causality is unproven. Old ac0 pins do not verify new uncommitted label/runtime and recording diagnostics. Computer Use remains Windows URL policy /0 new feature inputs; final fullcheck/dual-method/long pipeline/formal600/English/Claude→human testing remain incomplete.

<!-- english-original-anchor --> <a id="m2部分整合原驗收與全scope仍active"></a>
## M2 partial integration: original acceptance and full scope remain ACTIVE

The [frozen M2 milestone](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ac657109c4ae5a5390d9eecd2c1d425f2072e246) preserves different observation times for old 41526/32, new 3a251 P1, [91doc/raw copies](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/465cb0a1eed142f77586ca69854f49fbbcf602c4), and later writer677's normal merge. Root 32/107/105 etc. have bounded scopes; globalTS0 predates Blob4d and cannot represent latest full check. New P1 has actual RED 1→32 GREEN with validator unchanged.

Public60 s=3600acceptedframes; 3601 inclusive is only an independent capacity fixture, without adding one tick to render window. Long57/58 retains original whole63master2.9802322387695312e-6/321over above 2e-6; 14downloads complete, 15partial, 16missing, 90sFAIL/Worker not run. Zero owned processes after terminal does not mean original finally succeeded.

Perf55 seconds is only a cap; process4.754 seconds/native about 0.397 seconds was strictly rejected. Original V3/new unqualified V4/formal 600 remain separate, and null is not0.047 was unmerged at reader415/3a; later writer677 actually merged only a negative/method component, not qualification acceptance. Resource candidate defaults to reference/off; new EOF224/226+45 is unfrozen owner progress. Ninth owner and ephemeral responsibilities are explicit, not permanent authorization.

Original51draftcurrent/Task16/20/PERF/Task32AC02–09 are not upgraded. Computer Use remains policy-blocked with 0 inputs; complete product PW/long public pipeline/full quality/formal 600/final English/Claude/human testing remain incomplete. Root engineering continues; M2 is neither final nor handoff-complete. Old FAILs, original schema/tolerances/workload/credits gate0 all remain.

<!-- english-original-anchor --> <a id="2026-11-03-候選里程碑01s2-partial完整scope仍active"></a>
## 2026-11-03 candidate milestone01: S2 partial, full scope remains ACTIVE

The [frozen milestone](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7cee6ae1118139b2bfd78376a89e5bba3601f322) preserves Root 877→later a9de normal-merge timing and [66 exact doc/raw copies](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4a81067fda59aae11773b208dad09265503d069e). Assets69/Meta63+75/storage98/UI25 and renderer/voice each have different component scopes, not summed into complete product PASS. UI19 new families/3PW are authored only; Root 61reject/60BUSY's1 GREEN is not an actual 60-second run.

Audio original five native FAILs and ten invalid zero-frame PCMs remain; control133/18 and Nodeintegration52 GREEN do not change native results. Attempt02 has not run/has no grant/v2pin not adopted. Acoustic79 was followed by actual new review RED and intermediate82/88, still not finally adopted. Renderer foreignwriter3 FAIL/4, WebLocks/real IDB5198/long62sPCM, and public recover/archive UI await verification. Historical315 failing decoded text was not captured, so no sole-root-cause fix is claimed; that Meta fakePASS is not current live, key/newpaid0.

This round's GUI native remains URL-policy-blocked/0 inputs; Playwright-driven OAC digital DSP is neither Computer Use nor the complete Playwright product matrix. [Long specification v2](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bde27d90c0715399501ae6d2de1e43100433e85) preserves v1; the [51-row draft](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/195b1de848ab3b5496a5a362d45bde0f8006cded) is entirely current/unadjudicated. S1/original formal 600, S2/original Task16/20/PERF, fullcheck/UI/long pipeline/English/Claude/subsequent human testing remain incomplete; original criteria/dependencies/workload/tolerances are unchanged.

<!-- english-original-anchor --> <a id="s0scope已凍結兩次完整1536基準仍fail"></a>
## S0 scope frozen; both complete 1536-test baselines still FAIL

The [S0 receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5ff8c4a6d358f795845efe030066f715920f4308) freezes original request/criteria/seven-tree actual owners and long specification. Typecheck0; original OOM1520reported/1517pass/3fileabort exit 1 and targeted19/19exit0 retained. Complete concurrency 4 and original-default retry both have 1536 tests/1535 PASS/1 FAIL/exit 1/0 skip; original-default 129798.5083 ms, sourceStart/End both e25. Sole reproduction315mocktrustedApply(prior 400=0) expectedPASSED but actualINCOMPLETE, scene400/PROVIDER_REQUEST_FAILED “Meta response is not complete JSON.”; injected remoteFetch fixture, no real API/new payment. Root cause awaits Meta owner, without diagnosing OOM/WSL.

S0 closure means only preservation of scope/owner/longspec and baseline facts; S1 attribution/formal performance, S2 candidates, all original PERF criteria, and complete V1 remain open. Long output/Computer Use/Playwright/formal profile/Claude remain unverified; candidates began owned-file implementation/RED, not treating specifications or small tests as product completion. Original formal workload, tolerances, and failures remain; English deferred until final source freeze.

<!-- english-original-anchor --> <a id="2026-11-03-新非進階完整scope已active"></a>
# 2026-11-03 new complete nonadvanced scope is ACTIVE

The [new round's synthesis page](nonadvanced-completion-20261103.md) and [round contract](../../../16-nonadvanced-completion/CONTRACT.md) record explicit user authorization: PERF001–008/011/014, Task20/16 evidence reconciliation, and full product/pipeline Computer Use/Playwright. Six core/1536/217/five WAVs below are the prior bounded delivery, not new completion this round. New Task0032 IN_PROGRESS; all current-round product tests NOT_RUN. Original dependencies/criteria/formal workload/tolerances remain. Claude has not verified this round; final human testing follows Claude. Advanced Task15/009/010/012 excluded, cloud013/paid unauthorized.

<!-- english-original-anchor --> <a id="先前截點保留其日期方法與限制"></a>
## Earlier checkpoints (retain their dates, methods, and limits)



<!-- english-original-anchor --> <a id="核心管線目前狀態與交付邊界"></a>
# Current core-pipeline status and delivery boundaries

Product501 has bounded implementation of six cores, Zone/curved-surface dynamic reflections, and Project environment; Task24..31 including28 are bounded DONE, Task23 BLOCKED only for literal nativeAC04 external URL policy. Latest217/217family receipt join/0 pending, 68/71 public Help content PASS with three conditions explicitly unobserved, new Combined180 ticks/five WAVs and Stage12RIFF5/5 PASS, Tailguard1 PASS. Versioned sources and original FAILs are not relabeled as a complete 501 rerun; full method in [parameter audit](../ui-ux/product-parameter-audit-20261102.md) / [Now](../now.md) / [Claude handoff](../../../14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md). [New complete check](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2f387d58e834799d809cbbdaab03e2afd2cb4194) exit 0 and [local main](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/529524649ac8b7fbff91d919bf6dcab6403b7865) actual `fe663ca9f384d247bcd89b331936f6be202c761f` verified; 129 original untracked/4ba snapshot/11featuretips preserved. Independent Claude reverification and human observation of new features are next. After three native timeouts, fourth round only successfully created a separate window; Windows URL policy stopped product operations, Task23 literalAC04false. Complete V1/hearing tests/600 seconds/Meta live remain separate.

<!-- english-original-anchor --> <a id="歷史進度與原始來源截點"></a>
## Historical progress and original-source checkpoints

The following is progress at its original time; pending integration/Zone unsupported/not reverified and similar wording describes only that source. Current capabilities and frozen new receipts are at page top, without changing original FAILs/pins.

<!-- english-original-anchor --> <a id="原始核心分工與階段"></a>
### Original core responsibilities and stages

User authorized this implementation round; exact scope/completion conditions in [core contract](../../../14-core-pipeline/IMPLEMENTATION_CONTRACT.md), responsibilities/evidence delivery in [Stages](../../../14-core-pipeline/STAGES.md), and requirement summary in [authorization source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1c8807e9ba7b981c937b04a7e84ea12859bfb497).

Task0023 covers bounded core integration/basic verification; 0024 shared capabilities/Bounce, 0025 Meta UI, 0026 Motion, 0027 short-take renderer. PERF001/002/003/014 retain broader original conditions referenced this round, without relaxing dependencies or starting all 14 optimizations. All new criteria remain unverified until actual sources/tests exist.

User confirmed basic functionality, so prerequisite retesting is not repeatedly requested; independent subsequent Claude verification, human hearing tests for new features, original 600-second performance, and other V1 gates are listed separately. Every stage freezes source/commit/bundle/commands/exit codes/limits at delivery, followed by serialized ingest/checkpoint by the sole memory writer.

<!-- english-original-anchor --> <a id="階段-03-component-截點"></a>
### Stage03 component checkpoint

Shared capabilities and actual PhysicsWorld static-support OnBounce have component code/basic regressions. Machine-readable receipt records17/17 new cases, 255/255 broader regressions, typecheck/scoped lint PASS; original TAP ending read and confirmed255pass/0 fail. These are Node/Rapier evidence for that branch/source, not proof of UI wiring, postintegration bytes, or listening. Zone remains unsupported, Bounce is Tuned; Root must preserve Motion-control intervention invalidations.

Sources:[stage report](../../../14-core-pipeline/stages/03-capabilities.md) and [machine-readable receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/80d113653604089c99ab1e676e83cae1649e645d); report's last-change commit `9efd9ceeede5cc21dbb441ed14445c7bccd124d4`. This round's tasks do not prefill complete acceptance from component evidence.

<!-- english-original-anchor --> <a id="階段-05-component-截點"></a>
### Stage05 component checkpoint

Motion Registry, bounded controller, and AI transaction hooks have component code. Original TAP read confirming Motion12/12pass; machine-readable receipt lists AI bridge29/29, typecheck/scoped lint PASS; overlapping67 cases not added separately. Dynamic control is Tuned; Kinematic rotation checks endpoint overlap only. Actual Root runtime atomic publication, UI/Project/recording wiring, and browser still await integration verification; isolated callbacks are not completed product.

Sources:[stage report](../../../14-core-pipeline/stages/05-motion.md) and [machine-readable receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a83e337ede5d843823502dd16251727da2540fb0); report's last-change commit `dd4ef2232be111ffadaa0f0b4853150000a22e46`. This round's tasks do not prefill complete acceptance from component evidence.

<!-- english-original-anchor --> <a id="階段-01-component-截點"></a>
### Stage01 component checkpoint

Bounded recording evaluation, module Worker, and B recalculation delivered as components. Original JSONL final summary read confirming153/153pass, 0 fail; default queue8 frames/32MiB, work timeout10 seconds, preserving cancel/stale/backpressure/source-phase semantics. This guarantees neither total heap nor synchronous-JS preemption; actual browser Worker transport, Root short-take/Motion/renderer integration, and performance benefits still need independent evidence. Original missing-tick-on-resume and other failures retained in stage failure receipts, without overwriting original 600-second FAIL.

Sources:[stage report](../../../14-core-pipeline/stages/01-recording.md) and [original receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4cfefa22b32e9218fc301d262d874a4cddc79780); report's last-change commit `2582bf5e484019c86e2d830e4b7f8654530c95f2`. Basic component results do not prefill full product-integration acceptance.

<!-- english-original-anchor --> <a id="階段-02-component-截點"></a>
### Stage02 component checkpoint

Bounded disableable diagnostics and scalar/shape/delay/direction separation delivered as components. Original TAP read confirming broader226/226 and final core19/19 (without summing overlaps), plus actual Chrome OAC four-case PCM receipts. At48 kHz, literal impulse master/simulatedMix firstSample4080, dry480 support one delay/gain/headroom application in that graph, not solver/device calibration. Initial dry-energy oracle FAIL and correction under upmix equations saved separately; Root delivery/UI wiring, no-probe comparison, and original performance gates are not cleared by this.

Sources:[stage report](../../../14-core-pipeline/stages/02-audio.md) and [original receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1cc4fa48448f141e5f905529b9a2f8933500af64); report's last-change commit `506c19934abb2c2039162011c9a1b8514031db99`. Basic component results do not prefill full product-integration acceptance.

<!-- english-original-anchor --> <a id="階段-04-component-截點"></a>
### Stage04 component checkpoint

Persistent budget ledger, request identity/cancellation, AgentSession, and trusted baseline/candidate/analysis comparison workflow delivered as components. Original TAP read confirming final 183/183 and provider27/27pass, 0 fail; eight workflow cases include real Rapier/Behavior/acoustics/Host closed loop. Initial85/86 failure, Windows fixture EPERM, and fixes retain versions. All model transport remains fixture, default cost0, no new Meta live; Root grounding/cancel/Motion hooks/browser UI wiring need final integration evidence.

Sources:[stage report](../../../14-core-pipeline/stages/04-meta.md) and [original receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c9474af71b15f5c46d1a5fc14fe8c72a6058a2a6); report's last-change commit `42abb6fe6e0a71dce9dba1d20ccf2c331035c662`. Basic component results do not prefill full product-integration acceptance.

<!-- english-original-anchor --> <a id="階段-06-component-截點"></a>
### Stage06 component checkpoint

Original Node TAP read confirming13/13; original browser receipt confirms actual Chrome OAC7/7exit0, core source 55d40fd, with later report commit preserved separately. Reconstructs actual RecordingArtifact through the same AudioEngine; budget 30-second emission/single context45 seconds/16 outputs, estimated working 256MiB/output 192 MiB; estimate is not measured native peak. Original non-loop/continuous fixture rejection FAIL preserved; final pre-master stems/mix error 5.122274160385132e-9, direct impulse2654/2654, dry2080/2080 support only that fixture/source version. Root actual short take/UI downloads/Computer Use/final bundle still need separate evidence; byte production is not human hearing or original 600-second performance success.

Source:[original document or code](../../../14-core-pipeline/stages/06-render.md); last-change commit `2bbc1b78dbc0a25e1c78f5b53faa404cff39b3cb`.

<!-- english-original-anchor --> <a id="motion-混合世代修補截點"></a>
### Motion mixed-generation fix checkpoint

Independent review reproduced preview incorrectly setting generation2 to 1 after reset; fix uses actual PhysicsWorld identity projection and trusted prepareRestore, not guessing generation from scene revision. Real Rapier original TAP18/18 and AI bridge report37/37 read; original overlapping fixture FAIL/fix saved separately. Root still needs atomic runtime callbacks under the same World-identity policy and UI reverification, without extending isolated storage fixtures into product-integration acceptance.

Source:[original document or code](../../../14-core-pipeline/stages/05-motion-generation-fix.md); last-change commit `49bad90d1da9ee78ca9cdb2b02e413db97dad473`.

<!-- english-original-anchor --> <a id="render-契約來源版本更新"></a>
### Render-contract source version update

RenderJob's original type-only seam now connects bounded native-offline-recorded backend/runtime validator. This source pins actual src/audio/render-contract.ts bytes for this round; supersedes preserves AR-WIKI-ca2bde0e-2ffea48d's2026-10-29 type-only original hash/Git history. Old research remains its original checkpoint, not overwritten as new code. This source update resolves current-hash mismatch without changing acceptance, reference, or safe(), or claiming unimplemented capabilities are available.

Source:[original document or code](../../../../../src/audio/render-contract.ts); last-change commit `39606d9fe8808b8f460065b0260cca11b7b3f243`.

<!-- english-original-anchor --> <a id="ui-初版來源觀察"></a>
### Initial UI source observation

Initial report/original receipts read; 19/19, SSR5/5, headless browser 2/2 retain original scope. Initial canonical SHA0678c790... was actually observed but not committed to Git; current byte prefixes/LF-CRLF candidates do not match exactly, with no fabricated preimage/commit. Full old canonical and then-uncommitted product inputs cannot be reconstructed from hash alone; observation JSON states the gap, preserving original test stdout/process/failure receipts.

Source:[frozen source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1fd5831dccd9f74fb67888d65b2f1025a39d3dbc).

<!-- english-original-anchor --> <a id="ui-原子發布修補"></a>
### UI atomic-publication fix

Report now pinned to actual new hash; MotionPanel reads LabViewModel.motion from the same published snapshot rather than separately subscribing to live workspace, falling back only for absent legacy fields. New atomic-snapshot/legacy regressions9/9 (7SSR+2ports); Root connects runtime publication/critical revision. V1 is observation of prior hash, not reconstructable original text; old2/2browser is not reverification of new atomic source. Root final product output/independent Claude verification require separate evidence.

Source:[frozen source](../../../14-core-pipeline/stages/07-integration-ui.md).

<!-- english-original-anchor --> <a id="工作樹與封存範圍"></a>
### Worktree and archive scope

Seven new core worktrees are under project .worktrees; cleanup scope/original branch SHAs retained in compact JSON, private archives excluded from Git. Old C architecture/performance and D public trees archived then removed; C primary/old R21 retained for active attachment/broker, backup hash-checked per regular file. Automatic review rejected moving/deleting R21; no bypass/process kill. User said to handle it after closing Claude. Four fixture symlinks retain exact metadata only, without following external targets. This is DONE_SCOPED plus two active-process retentions, not deletion of all old trees.

Source:[frozen source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3920ee9b89eb7a1cd97ed7d31b03b5b4133e5ccc).

<!-- english-original-anchor --> <a id="作者motion實際進入experimenttoolhost錄製"></a>
### Authored Motion actually enters ExperimentToolHost recording

Experiment clone world now installs actual MotionWorkspace via trusted registry/pin/generation projection, at most8 simultaneous motions/one per object, tick 0 neither added nor removed; replay follows original trace without rerunning authored motions. Stage report lists final 8/8 separately from prior 38/38 scopes; Root frozen-source complete check needs separate evidence. Local pipeline results are not extended to browser/device/Meta live/full V1.

Source:[formal document](../../../14-core-pipeline/stages/08-motion-experiment.md).

<!-- english-original-anchor --> <a id="六core分檔與0708整合證據規則"></a>
### Six-core file separation and 07/08 integration evidence rules

Stages now uses actual component report filenames; 07/08 supplement cross-core integration, not new product cores. Reports, source/commit, original failures, basic/Claude/human tests, and original performance gates remain separate.

Source:[formal document](../../../14-core-pipeline/STAGES.md).

<!-- english-original-anchor --> <a id="六core合併後正式實作現況前言"></a>
### Formal implementation-status preface after six-core merge

Formal status preface retains user confirmation of basic functionality and updates six actual components/bounded capabilities. Root quality/CUA output/main are still in progress, without claiming full V1; older sections preserve historical time checkpoints.

Source:[formal document](../../../IMPLEMENTATION_STATUS.md).

<!-- english-original-anchor --> <a id="六core合併後交付與claude後驗證順序"></a>
### Delivery and subsequent Claude verification order after six-core merge

Next step now completes source-bound quality, product export, authorized local main, memory/English, and independent Claude reverification; it does not reopen original lane/capability/renderer proposals or activate all 14 candidates.

Source:[formal document](../../../NEXT_ENGINEERING_TASK.md).

<!-- english-original-anchor --> <a id="六core目前能力上限與原未解門檻"></a>
### Current six-core limits and original unresolved gates

New limitations preface lists bounded queue/non-total-heap, control-thread diagnostics, Tuned Bounce/Motion, 30s/45s/16 outputs renderer/unsupported features, fixture Meta/budget 0. Human confirmation of basic functionality is not extrapolated to science/device/performance; initial WikiFAIL, subsequent source/full-checkout repairs, unreconstructable prior UI, and two retained active old trees are explicit.

Source:[formal document](../../../KNOWN_LIMITATIONS.md).

<!-- english-original-anchor --> <a id="正式產品browserdom匯出與獨立wav檢查"></a>
### Formal product BrowserDOM export and independent WAV checks

42d25cb/index-27NgeX35.js used actual UI capture3 seconds/180 ticks, render, and individual five-WAV/manifest downloads. Independent RIFF parser5/5, stereo48k/240000 frames/5 seconds, finite/nonzero/0out-of-range, manifest and original download/copy hashes match; 2stems sum error 1.4901161193847656e-8<2e-6. Native sky.get_window stopped after two app-approval timeouts, without successful native input; BrowserDOM/digital-file PASS is not native, human-hearing, SPL, or performance success.

Source:[formal receipt or report](../../../14-core-pipeline/stages/09-integration-and-export.md).

<!-- english-original-anchor --> <a id="主整合回歸修補與產品輸出目前進度"></a>
### Main integration regression fixes and current product-output progress

Root reported first check missing spike dependencies, then supplied them offline; second round 23 FAIL (19 Host rebind premature publication, 4 old-oracle added fields) fixed at 42d25cb, with affected46+8 regressions reported PASS. Third complete check and Meta UI empty-table fix/reverification still underway; final source/main/Claude incomplete. These quality updates are Root-reported, not fabricated final raw results; 09 independent WAV evidence has its own frozen receipt.

Source:[formal receipt or report](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d42579a50834c13dbaa57b9e4c1fd31b40815402).

<!-- english-original-anchor --> <a id="真正production-meta離線ui閉環與拒絕案例"></a>
### Actual production Meta offline UI closed loop and rejection cases

Original browser exit 0/1passed21.2s, unit22/22 original TAP, and seven currently matching source pins read. Actual DOM completed hard preview/apply, 1-second baseline3tools, soft candidate4tools including Compare, Undo, out-of-scope rejection, and incompatible geometry/motion rejection; table has trusted numbers/125–4000 Hz columns, rt60 still unavailable. Original empty-table FAIL and 21/22 format-assumption FAIL preserved; no testbridge/runtime dispatch, API requests0, not Meta live/human/acoustic improvement.

Source:[frozen source](../../../14-core-pipeline/stages/04-meta-ui-workflow-receipt.md).

<!-- english-original-anchor --> <a id="b41cdeb第二批實際dom音檔與獨立檢查"></a>
### b41cdeb second batch of actual DOM audio files and independent checks

b41cdeb/index-CgrKG5Ax.js frozen under exports/final/source-bundle; actual DOM individually downloaded five WAVs+manifest, independent RIFF5/5, 48k stereo/240000 frames/5 seconds, finite/nonzero/0out-of-range/hash match, maximum stems-sum error 1.210719347000122e-8<2e-6. sameProductSource=false explicitly records later UI changes, without treating this frozen bundle as exactly identical to future main; native remains NOTCOMPLETED.

Source:[frozen source](../../../14-core-pipeline/stages/10-final-ui-export.md).

<!-- english-original-anchor --> <a id="完整code品質與meta成功後motion表單修補進度"></a>
### Complete code-quality and post-Meta-success Motion-form fix progress

Root corrected runtime to 1328/1328; other complete-check code/build/license stages reported passing, but command ultimately had English missing2/stale5/errors 16 and exit 1, so the complete command cannot be rewritten as PASS. Actual Meta UI succeeded; actual Motion Save then exposed invalid defaults from HTML step/pattern, with local fix/basic browser reverification ongoing; final source/main/Claude incomplete. Complete V1 bytes already saved as pre-closing history, rather than leaving only an old hash.

Source:[frozen source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d42579a50834c13dbaa57b9e4c1fd31b40815402).
