<!-- english-source: {"path":"knowledge/wiki/ui-ux/design-engineering.md","sha256":"0205bcd268716316ab9aa3e027651b27ed995cbd14994be49a330f22d9f6d23e","translated_at":"2026-10-29T14:02:28.418Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0016
title: Design engineering and current verification
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T13:59:04.321Z
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
related_tasks:
  - RLAB-TASK-0004
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
> English translation of [`knowledge/wiki/ui-ux/design-engineering.md`](../../../../../knowledge/wiki/ui-ux/design-engineering.md). Source SHA-256: `0205bcd268716316ab9aa3e027651b27ed995cbd14994be49a330f22d9f6d23e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="設計工程與當前驗證"></a>
# Design engineering and current validation

The sole concrete authorities are [DESIGN_SYSTEM](../../../05-ux/DESIGN_SYSTEM.md), [Tokens](../../../../05-ux/DESIGN_TOKENS.json), [Component](../../../05-ux/COMPONENT_SPEC.md), [Motion](../../../05-ux/MOTION_GUIDELINES.md) and [Stress Tests](../../../05-ux/UI_STRESS_TESTS.md). This Wiki does not duplicate token values or component tables. Work follows the [project skill](../../../agent-skills/skills/reflection-lab-design-system/SKILL.md) and [pinned Emil sources](../../../05-ux/EMIL_SKILLS.md), without independently upgrading sources.

The user's explicit Emil preference prioritizes scene and primary actions, expandable technical details, clear hierarchy, adjustable panels, immediate feedback and restrained motion. The three workspaces do not reset world/audio/recorder; Contextual Inspector and scene/path/event share stable IDs. High-frequency actions respond immediately without mandatory transitions; motion follows purpose, frequency, interruption, cost and reduced motion, with independent physics/audio clocks.

[R17 integration](../../../../../artifacts/v1/r17-integration-progress-20261029/verification.json) fixed erroneous selection after deletion, actual vacuum results incorrectly shown as Computed, replay environment labels and invalid historical-path hints. Original no-result/available-empty runtime shapes remain; shared read-only presentation displays distinct reasons in three locations, without generating illustrative sound paths or changing null to 0. New linked 8 and original refined UI/FPS28 passed in real browsers; Root also viewed the error screen and used the same enhanced oracle RED then GREEN. Code checks, screenshots, physical input, audio and performance remain separately scoped; counts do not establish complete V1.

English scope is explicitly [interface plus all project documents](../../../00-project/V1_ENGLISH_FULL_DOCS_REQUEST_20261027.md): Traditional Chinese canonical sources and traceable English translations share task/schema/test data, without a second system. Manifest current/stale checks must continue. Normal 100% human FPS/IME and Hi-x65/D3V listening remain untested; native 200% is no longer a gate.

The maintained entry point is documented in [product browser validation](../../../11-v1/PRODUCT_E2E.md): reviewed v3 product flow and v2 linked cases, with original and v2 sources retained. The original four formal cases specify three clean browser contexts plus empty-store relink; an additional multi-process FAIL is saved separately, neither adding nor waiving the frozen original gate.


R17 scope supplement: [independent original-text interpretation and English raw-evidence classification](../../../../../artifacts/v1/r17-english-scope-20261029/verification.json) confirmed the original three formal runs are clean app/browser contexts; three product flows within the current four cases passed. The additional multi-process FAIL and overload limits are not converted into success. English adds an exact immutable pin for one actual failure context/report only; Root passed 39 contract tests. Raw is not translated and authored-document exclusions are not broadened. Full-inventory finalization, full check and formal 600 seconds remained pending at this cutoff.


R17 final assessment: [REQUIREMENT_EVIDENCE_20261029-r17.json](../../../../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json) preserves each original requirement and Root/isolated review. Current 600-second data is complete, but performance and sustained workload FAIL; out-of-window finishing was not backfilled. Full functional checks, current browser and R6 silent qualification passed. Next are physical input at normal100% and device listening; complete V1 is unfinished.

<!-- english-original-anchor --> <a id="2026-10-29真人回報第一人稱失敗限定第1至8節的未提及項目"></a>
## Human feedback on 2026-10-29: FPS failed; unmentioned items limited to sections 1–8

[Original feedback and scope record](../../../../11-v1/USER_TEST_FEEDBACK_20261029-r18.json): after entering first person, the user could not move or operate. This is a user-reported blocker; its root cause has not been diagnosed. All subsequent FPS-dependent operations, including grab/throw, building and FPS listening, are BLOCKED_NOT_TESTED. Materials and reflections are explicitly NOT_TESTED and are not successful results. Default sound is too quiet; direct scene click selection, dragging and scaling are unavailable or unintuitive. These remain unresolved reports.

Under the user's explicit rule, only independent, unmentioned items in sections 1–8 unaffected by these failures or exclusions are USER_REPORTED_NO_ISSUE. This is not an overall PASS, independent reproduction, scientific validation or device validation. Section 9 recording/replay, section 10 A/B, section 11 storage/import/export, section 12 offline assistant and other scope remain UNVERIFIED. The tested bundle, device route, DAC and volume were not provided and remain UNKNOWN. Historical automated receipts remain preserved and cannot override this human failure.

This round records feedback only: no code repair, test launch or resumption of this chat's paused development goal. Task0021's existing research/integration state remains unchanged. When product engineering resumes, investigate the FPS blocker first, then direct manipulation and default volume. FPS can no longer be described solely as awaiting its first human test.
