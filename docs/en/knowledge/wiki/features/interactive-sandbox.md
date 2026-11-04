<!-- english-source: {"path":"knowledge/wiki/features/interactive-sandbox.md","sha256":"0d7a4f03214607fc687cfb96bf873c58cff76189458f7c61f47b6ddd87044650","translated_at":"2026-11-02T03:30:37.000Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
---
id: RLAB-KB-0009
title: Interactive sandbox: implementation and scoped acceptance
type: feature
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-02T03:29:52.099Z
sources:
  - RLAB-SRC-0001
  - RLAB-SRC-0017
  - RLAB-SRC-0018-V2
  - RLAB-SRC-0019
  - RLAB-SRC-0021
  - SB-SRC-0003
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0025
  - V1-SRC-0031
  - V1-SRC-0038
  - V1-SRC-0039
  - V1-SRC-0053
  - V1-SRC-0062
  - V1-SRC-0064
  - V1-SRC-0069
  - V1-SRC-0073
  - V1-USER-TEST-20261029-R18
  - V1-SRC-0076
  - V1-SRC-0077
  - V1-SRC-0080
  - V1-SRC-0081
  - V1-SRC-0083
  - V1-SRC-0084
  - V1-SRC-0085
  - V1-SRC-0086
  - V1-SRC-0087
  - V1-SRC-0089
  - V1-SRC-0090
  - V1-SRC-0091
  - V1-SRC-0092
  - V1-SRC-0093
  - V1-SRC-0094
  - V1-SRC-0096
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0016
  - RLAB-TASK-0022
related_decisions:
  - ADR-002
  - ADR-003
  - ADR-004
supersedes: []
tags:
  - P0
  - FPS
  - grab
  - throw
  - build
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/features/interactive-sandbox.md`](../../../../../knowledge/wiki/features/interactive-sandbox.md). Source SHA-256: `0d7a4f03214607fc687cfb96bf873c58cff76189458f7c61f47b6ddd87044650`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="互動沙盒實作與分項驗收"></a>
# Interactive sandbox: implementation and scoped acceptance

The production Scene editor, real fixed-step Rapier, FPS simulation/build, four body modes, bounded grab/drop/throw and staged placement are implemented. Authorities remain [Physics](../../../04-physics/PHYSICS_ARCHITECTURE.md), [FPS](../../../04-physics/FPS_INTERACTION_SPEC.md) and [Inputs](../../../04-physics/INPUT_CONTROLS.md). Gravity=0 remains dynamic; objects are not parented to the camera. Blur/Esc first pauses and clears input, Held/ghost is retained, Resume rechecks identity and clearance, and staged objects require explicit Enable.

[R17 direct evidence](../../../../../artifacts/v1/r17-integration-progress-20261029/verification.json) records RED→GREEN for clearing selection on deletion; existing stable IDs do not shift to another selection when an earlier item is deleted. Real canvas objects/paths, event filtering and insertion, rule Apply/Undo and original UI/FPS28 were checked. Acoustic unavailability displays a reason and old references remain unchanged. The current 175/14 build and complete product4 passed; the additional third browser process's FAIL after exceeding the original 8 recoveries while waiting for OnImpact remains and cannot be described as three-process PASS.

The user's historical [basic feedback](../../../../../artifacts/v1/basic-user-feedback-20261028/feedback.json) confirmed audible sound, direction, gravity and bouncing, but FPS entry failed and UI explanations were excessive. Asynchronous entry/cancellation/blur/Esc, first-use entry and panel defaults were later repaired. Physical retesting at normal 100% remains required; headless cases cannot replace physical Pointer Lock/IME/device listening. Native 200% was removed by explicit request.

[Physics acceptance](../../../11-v1/PHYSICS_ACCEPTANCE.md), [recording/replay](../../../07-experiments/RECORD_REPLAY.md) and [frozen first-version acceptance](../../../11-v1/ACCEPTANCE.md) retain their own scopes. Mathematics, WASM, browser, listening and performance are separate. The current formal long run has preserved negative results; complete closure still awaits humans; historical receipts retain their own source/Git cutoffs and old counts cannot be added to imply overall PASS.


R17 final assessment: [REQUIREMENT_EVIDENCE_20261029-r17.json](../../../../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json) preserves each original requirement and Root/isolated review. Current 600-second data is complete, but performance and sustained workload FAIL; out-of-window finishing was not backfilled. Full functional checks, current browser and R6 silent qualification passed. Next are physical input at normal100% and device listening; complete V1 is unfinished.

<!-- english-original-anchor --> <a id="2026-10-29真人回報第一人稱失敗限定第1至8節的未提及項目"></a>
## Human feedback on 2026-10-29: FPS failed; unmentioned items limited to sections 1–8

[Original feedback and scope record](../../../../11-v1/USER_TEST_FEEDBACK_20261029-r18.json): after entering first person, the user could not move or operate. This is a user-reported blocker; its root cause has not been diagnosed. All subsequent FPS-dependent operations, including grab/throw, building and FPS listening, are BLOCKED_NOT_TESTED. Materials and reflections are explicitly NOT_TESTED and are not successful results. Default sound is too quiet; direct scene click selection, dragging and scaling are unavailable or unintuitive. These remain unresolved reports.

Under the user's explicit rule, only independent, unmentioned items in sections 1–8 unaffected by these failures or exclusions are USER_REPORTED_NO_ISSUE. This is not an overall PASS, independent reproduction, scientific validation or device validation. Section 9 recording/replay, section 10 A/B, section 11 storage/import/export, section 12 offline assistant and other scope remain UNVERIFIED. The tested bundle, device route, DAC and volume were not provided and remain UNKNOWN. Historical automated receipts remain preserved and cannot override this human failure.

This round records feedback only: no code repair, test launch or resumption of this chat's paused development goal. Task0021's existing research/integration state remains unchanged. When product engineering resumes, investigate the FPS blocker first, then direct manipulation and default volume. FPS can no longer be described solely as awaiting its first human test.

<!-- english-original-anchor --> <a id="2026-10-30-r19r18-工程修補完成待真人重測"></a>
## 2026-10-30 R19: R18 engineering repair complete, awaiting human retest

The [R19 verification record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/50eff1a6f87323c9a90eff221c2a40e9e9193c0e) was reviewed and merged on the Claude Code main thread (claude-opus-5-5), with frontend implementation by Sonnet subagents; see [RLAB-TASK-0022](../../../../../knowledge/tasks/RLAB-TASK-0022.json). Product checkpoint `5e56260`. Real Chrome (Playwright headless, CDP input, real native Pointer Lock) first reproduced the R18 blocker: after a successful lock the simulation stayed Ready at tick 0, W / mouse / clicks were all dropped, and only an extra Enter started it. It also found that transaction safe pauses such as fixing (F), placement and the database cleared the host's lock flag, so Enter could not resume while the browser still held the lock.

After the repair, the entry click starts controls directly once both the entry transaction and the actual lock complete; while an object or ghost is held it still waits for an explicit Resume. While paused, a click on the view (effective on release) or Enter resumes, and after Esc a click on the view re-locks; neither the lock-acquiring click nor the resume click is forwarded as a throw. Alternative controls accept WASD, the arrow keys and Enter while the view has focus, and do not report a native lock. On Tab, IME composition or focus on a text field, a pending entry or Resume is cancelled and input returns to the UI; a run already dispatched but still waiting for preview shutdown is dropped by the runtime's entry generation.

Codex (gpt-6.1-sol, xhigh, read-only) ran several adversarial review rounds: round 1 found six defects and one overload risk, round 2 two major and one minor, round 3 one major (gizmo remount), and round 4 one minor (a click during a commit changed the selection); each got a regression that was RED on the original code and then fixed to GREEN. The current ui-refined-v2, pointerlock-race, product v3 (bundle rebuilt and sources checked), linked v2, physics, storage and runtime suites all pass. The legacy ui.spec's 8 failures and the legacy product flow's 4 failures fail identically on baseline a5f2a90; they are kept on record and not rewritten.

The editor also gained a move / rotate / scale gizmo: one drag commits exactly one patchObject (one revision, one Undo); Esc, pointercancel, lost capture and window blur cancel without a commit; until the previous commit settles (including across a tool switch or a canvas rebuild) no new drag can start and clicks do not change the selection; it is hidden while running or replaying. All of this is headless automated evidence, not physical keyboard/mouse or human acceptance; R18 first person, grab/throw, building and FPS listening remain BLOCKED / untested until the human R19 retest, material reflection remains NOT TESTED, and sections 9 onward remain UNVERIFIED.

<!-- english-original-anchor --> <a id="2026-10-31-r20自動重測與修補"></a>
## 2026-10-31 R20: automated retest and repairs

Following the [complete test procedure](../../../11-v1/FULL_TEST_PROCEDURE.md), an automated retest with Playwright (headless Chrome, CDP input) found the existing gates identical to R19; 93 of the 117 exploratory checkpoints passed and five product issues were found, see the [automated retest record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/63829e86689cc544fc4e811eb9fb673cbe2871f0). [R20 repair record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/bc1d5761ca79212cbfd1a00eb2db4aa74be824c0): interaction outcomes such as F-freeze, staged creation and activation become the status-line pause reason while the simulation waits and are cleared once it resumes; B entering build mode starts a box placement preview like the HUD button, and leaving discards an unconfirmed preview; parameterized messages from the runtime, interaction and recording hosts have English forms; spheres and capsules stay out of the geometric acoustics, and the Inspector disables their acoustic material and role and says why; the WebGL fallback text inside the canvas is no longer read by assistive technology. Three Codex (gpt-6.1-sol, xhigh, read-only) review rounds found 5 MINOR issues, all repaired with RED→GREEN regressions; the third round found nothing new.

An inscribed-box trial of curved occlusion was withdrawn because a 105-object scene exceeds the 256-surface geometry budget; headless recording repeatedly paused for workload, consistent with the R17 performance FAIL. All of this is automated evidence, not human acceptance; Task0022 still awaits the human retest.

<!-- english-original-anchor --> <a id="2026-11-01-r21第一人稱滑鼠操作音訊斷續與說明文字"></a>
## 2026-11-01 R21: first-person mouse controls, audio dropouts and help text

Using Brave, the user reported B1 to B4 as normal; B5 building was unintuitive and build mode could not be left; audio broke up; and they asked for parameter documentation and for the main-page help text to be removed, see the [R21 report](../../../../11-v1/USER_TEST_FEEDBACK_20261101-r21.json). The requirement changes are in the [acceptance amendments](../../../11-v1/ACCEPTANCE_AMENDMENTS.md). Codex (gpt-6.1-sol, xhigh) implemented the changes; Claude Code coordinated, measured and re-ran verification, and Claude subagents performed three independent review rounds.

- First person: left click grabs / throws, holding the right button previews and releasing places, and the right button puts down a held object; mid-air placements use dynamicNoGravity. Placement revalidates, waits for the geometry ack and activates internally, keeps the previous running state and is one undo step; it is refused during recording, replay and an audio restart. Build mode could not be left because placement paused safely, the staged object blocked resume, and every key was ignored while paused.
- Audio: sound was already rendered by the browser audio thread through native nodes. Measurement found the main causes to be parameter automation re-issued on every physics step (about 37000 calls per 20 s in a static scene) and a small output buffer. R21 adds an audio buffer preset (default Stable), a scheduling lookahead used only for onsets, an output underrun counter and a safe restart with timeouts. In 20 s headless runs (final two runs), editor underruns fell from 19 to 1 and first-person walking from 14 to 1, and physics rose from about 0.64× to about 0.95× real time; see the [R21 audio measurements](archive://uncommitted-local/artifacts/v1/r21-audio-smoothness-20261101). Scheduling parameter ramps in the future was tried, measured as a regression to 74 underruns, and withdrawn.
- Help text: 35 explanations became hover tooltips, and the parameters are collected in the [parameter reference](../../../11-v1/PARAMETER_REFERENCE.md).

All of this is automated evidence (headless Chrome, CDP input), see the [R21 final verification](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ab0b1838a7e4d7eb0152047367f0299dd336049d); the human retest and real listening are pending. Physics still runs on the main thread; if a real browser still stutters, first attribute the causes following the [performance and buffering review](../research/performance-buffer-review-20261101.md) (RLAB-TASK-PERF-20261101-001); a Worker is only a P2 candidate that needs attribution evidence.
