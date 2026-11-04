<!-- english-source: {"path":"knowledge/wiki/ui-ux/design-engineering.md","sha256":"bb9a6137f0bc55e0e280d32031ff9718834cb3112bdab8f96c464c079e0fa838","translated_at":"2026-11-03T02:49:53.174Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0016
title: Design engineering and sole standards
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-03T02:33:49.790Z
sources:
  - RLAB-SRC-0042-V2
  - RLAB-SRC-0025
  - RLAB-SRC-0043
  - RLAB-SRC-0044-V2
  - RLAB-SRC-0045
  - RLAB-SRC-0023-V2
  - RLAB-SRC-0061
  - SB-SRC-0020
  - SB-SRC-0001
  - V1-SRC-0011
  - V1-SRC-0012
  - V1-SRC-0054
  - V1-SRC-0055
  - V1-SRC-0069
  - V1-SRC-0070
  - V1-SRC-0071
  - V1-SRC-0073
  - V1-USER-TEST-20261029-R18
  - V1-SRC-0076
  - V1-SRC-0078
  - V1-SRC-0079
  - V1-SRC-0083
  - V1-SRC-0084
  - V1-SRC-0091
  - V1-SRC-0092
  - PUB-NONADVANCED-UX-WORKSPACE-TOP-MONITOR-20261103-V3-c50a26196014
  - PUB-NONADVANCED-UX-COMPONENT-TOP-MONITOR-20261103-V2-4ea3fe0e4aaa
  - PUB-NONADVANCED-M4-PARTIAL-CLAUDE-HANDOFF-20261103-V1-ba2803b99e2f
related_tasks:
  - RLAB-TASK-0004
  - RLAB-TASK-0022
  - RLAB-TASK-0033
  - RLAB-TASK-0032
related_decisions: []
supersedes: []
tags:
  - P0
  - design
  - Emil
  - UI
  - UX
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/ui-ux/design-engineering.md`](../../../../../knowledge/wiki/ui-ux/design-engineering.md). Source SHA-256: `bb9a6137f0bc55e0e280d32031ff9718834cb3112bdab8f96c464c079e0fa838`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="m4頂列功能部分證據與兩份英文界線"></a>
## M4 partial top-row evidence and the limits of two English pages

The [partial handoff](../../../16-nonadvanced-completion/handoffs/M4_PARTIAL_CLAUDE_HANDOFF_20261103.md) preserves production03's four PASS/one FAIL; one Zone draft was retained across four modes, not every form. The two UX translations at de628 match their source hashes, but scoped2 PASS is Root-reported without independent scoped raw evidence, not full English coverage. Original canonical requirements/internal workspace compatibility/tokens are unchanged; complete S4/CU/recording have not passed.

<!-- english-original-anchor --> <a id="2026-11-03頂列需求取代範圍"></a>
## 2026-11-03 top-row requirement supersession scope

The latest user requirement replaces top-row three-step Workspace navigation with four switchable TopMonitor modes. [Workspace architecture](../../../05-ux/WORKSPACE_ARCHITECTURE.md) and [component contracts](../../../05-ux/COMPONENT_SPEC.md) retain old internal workspace compatibility/state/cameras and explicitly distinguish Worker from main-thread load. Only requirement specifications are updated; see source-bound [Task0033](../../../../../knowledge/tasks/RLAB-TASK-0033.json) evidence for current acceptance status. This page does not duplicate flags; original tokens/numbers/other gates are unchanged.

<!-- english-original-anchor --> <a id="設計工程與當前驗證"></a>
# Design engineering and current validation

The sole concrete authorities are [DESIGN_SYSTEM](../../../05-ux/DESIGN_SYSTEM.md), [Tokens](../../../../05-ux/DESIGN_TOKENS.json), [Component](../../../05-ux/COMPONENT_SPEC.md), [Motion](../../../05-ux/MOTION_GUIDELINES.md) and [Stress Tests](../../../05-ux/UI_STRESS_TESTS.md). This Wiki does not duplicate token values or component tables. Work follows the [project skill](../../../agent-skills/skills/reflection-lab-design-system/SKILL.md) and [pinned Emil sources](../../../05-ux/EMIL_SKILLS.md), without independently upgrading sources.

The user's explicit Emil preference prioritizes scene and primary actions, expandable technical details, clear hierarchy, adjustable panels, immediate feedback and restrained motion. The three workspaces do not reset world/audio/recorder; Contextual Inspector and scene/path/event share stable IDs. High-frequency actions respond immediately without mandatory transitions; motion follows purpose, frequency, interruption, cost and reduced motion, with independent physics/audio clocks.

[R17 integration](../../../../../artifacts/v1/r17-integration-progress-20261029/verification.json) fixed erroneous selection after deletion, actual vacuum results incorrectly shown as Computed, replay environment labels and invalid historical-path hints. Original no-result/available-empty runtime shapes remain; shared read-only presentation displays distinct reasons in three locations, without generating illustrative sound paths or changing null to 0. New linked 8 and original refined UI/FPS28 passed in real browsers; Root also viewed the error screen and used the same enhanced oracle RED then GREEN. Code checks, screenshots, physical input, audio and performance remain separately scoped; counts do not establish complete V1.

English scope is explicitly [interface plus all project documents](../../../00-project/V1_ENGLISH_FULL_DOCS_REQUEST_20261027.md): Traditional Chinese canonical sources and traceable English translations share task/schema/test data, without a second system. Manifest current/stale checks must continue. Normal 100% human FPS/IME and Hi-x65/D3V listening remain untested; native 200% is no longer a gate.

The maintained entry point is documented in [product browser validation](../../../11-v1/PRODUCT_E2E.md): reviewed v3 product flow and v2 linked cases, with original and v2 sources retained. The original four formal cases specify three clean browser contexts plus empty-store relink; an additional multi-process FAIL is saved separately, neither adding nor waiving the frozen original gate.


R17 scope supplement: [independent original-text interpretation and English raw-evidence classification](../../../../../artifacts/v1/r17-english-scope-20261029/verification.json) confirmed the original three formal runs are clean app/browser contexts; three product flows within the current four cases passed. The additional multi-process FAIL and overload limits are not converted into success. English adds an exact immutable pin for one actual failure context/report only; Root passed 39 contract tests. Raw is not translated and authored-document exclusions are not broadened. Full-inventory finalization, full check and formal 600 seconds remained pending at this cutoff.


R17 final assessment: [REQUIREMENT_EVIDENCE_20261029-r17.json](../../../../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json) preserves each original requirement and Root/isolated review. Current 600-second data is complete, but performance and sustained workload FAIL; out-of-window finishing was not backfilled. Full functional checks, current browser and R6 silent qualification passed. Next are physical input at normal 100% and device listening; complete V1 is unfinished.

<!-- english-original-anchor --> <a id="2026-10-29真人回報第一人稱失敗限定第1至8節的未提及項目"></a>
## Human feedback on 2026-10-29: FPS failed; unmentioned items limited to sections 1–8

[Original feedback and scope record](../../../../11-v1/USER_TEST_FEEDBACK_20261029-r18.json): after entering first person, the user could not move or operate. This is a user-reported blocker; its root cause has not been diagnosed. All subsequent FPS-dependent operations, including grab/throw, building and FPS listening, are BLOCKED/not tested. Materials and reflections are explicitly NOT TESTED and are not successful results. Default sound is too quiet; direct scene click selection, dragging and scaling are unavailable or unintuitive. These remain unresolved reports.

Under the user's explicit rule, only independent, unmentioned items in sections 1–8 unaffected by these failures or exclusions are recorded as “the user reported no issue.” This is not an overall PASS, independent reproduction, scientific validation or device validation. Section 9 recording/replay, section 10 A/B, section 11 storage/import/export, section 12 offline assistant and other scope remain UNVERIFIED. The tested bundle, device route, DAC and volume were not provided and remain UNKNOWN. Historical automated receipts remain preserved and cannot override this human failure.

This round records feedback only: no code repair, test launch or resumption of this chat's paused development goal. Task0021's existing research/integration state remains unchanged. When product engineering resumes, investigate the FPS blocker first, then direct manipulation and default volume. FPS can no longer be described solely as awaiting its first human test.

<!-- english-original-anchor --> <a id="2026-10-30-r19直接操作db-監聽與視圖資訊收納"></a>
## 2026-10-30 R19: direct manipulation, dB monitoring and the view details disclosure

Following the R18 report: the Viewport toolbar gained move / rotate / scale (TransformControls; frontend implemented by a Sonnet subagent, reviewed and merged on the main thread). Monitor became a whole-dB control from −40 to +12 dB, default 0 dB, with master headroom −6 dB and an output safety ceiling after the limiter (about −0.3 dBFS); the [Component Spec](../../../05-ux/COMPONENT_SPEC.md), [DESIGN_SYSTEM](../../../05-ux/DESIGN_SYSTEM.md) and [Audio Runtime](../../../02-architecture/AUDIO_RUNTIME.md) are synchronized and keep the "not calibrated SPL" limitation. The default scene's digital peak went from about −51 → −29 dBFS, and the extreme stress case dropped from +3 dBFS to about −0.3 dBFS with no full-scale samples; both are AudioContext digital levels only. The 3D view's revisions, coordinates, path legend and blocking candidates moved into "View details"; first-person hints explain the next step for each state.

These have only code review, headless measurements and automated browser evidence; visual quality, usability, layout proportions and listening wait for the human R19 retest, and no UI visual or listening pass is claimed.

<!-- english-original-anchor --> <a id="2026-10-31-r20狀態訊息無障礙與誠實標示"></a>
## 2026-10-31 R20: status messages, accessibility and honest labelling

Repairs after the automated retest: parameterized status-line messages are translated through catalogued templates, while unknown details stay under the original-detail label; interaction outcomes show as the pause reason while paused; the Inspector disables acoustic material and role for spheres and capsules and links a visible note through aria-describedby; the WebGL fallback text inside the canvas is aria-hidden, and real failures are still announced as an alert by CanvasBoundary. The evidence is headless Chrome, unit tests and the CDP accessibility tree, without a screen reader, visual check or human confirmation; see the [R20 repair record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/bc1d5761ca79212cbfd1a00eb2db4aa74be824c0).

<!-- english-original-anchor --> <a id="2026-11-01-r21懸浮提示與底部提示列"></a>
## 2026-11-01 R21: hover tooltips and the bottom hint bar

Static main-page help became a HelpTip: opened by mouse hover and keyboard focus, closed by Esc, role=tooltip plus aria-describedby, no focus trap, using the tooltip 125 ms and z-index 60 tokens; the reason a control is disabled is reachable by focus; field labels, values, status, errors, safety warnings and evidence tags stay visible. The first-person contextual hint became a one-line hint bar at the bottom of the viewport that does not cover the crosshair. A sphere now has a single diameter and a capsule a diameter plus height, with a translated reason when they conflict. The evidence is unit and headless browser tests; touch and screen readers are unverified, see the [R21 final verification](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ab0b1838a7e4d7eb0152047367f0299dd336049d).
