<!-- english-source: {"path":"knowledge/wiki/features/interactive-sandbox.md","sha256":"6f7f99969218f40922a9c7460bf92e586200916a850ef3ebff572fa67bd56e63","translated_at":"2026-10-29T14:02:28.416Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0009
title: Interactive sandbox: implementation and scoped acceptance
type: feature
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T13:59:04.320Z
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
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0016
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
> English translation of [`knowledge/wiki/features/interactive-sandbox.md`](../../../../../knowledge/wiki/features/interactive-sandbox.md). Source SHA-256: `6f7f99969218f40922a9c7460bf92e586200916a850ef3ebff572fa67bd56e63`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
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
