<!-- english-source: {"path":"knowledge/wiki/ui-ux/fps-grab-review.md","sha256":"5ed3223092812ee745b8f0caf0a76471c8ace455776ae8b257e8f067b89f1c7c","translated_at":"2026-11-02T09:59:36.7651633Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0017
title: FPS Grab development and acceptance guide
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-02T09:35:04.597Z
sources:
  - RLAB-SRC-0017
  - RLAB-SRC-0018-V2
  - RLAB-SRC-0021
  - RLAB-SRC-0026
  - RLAB-SRC-0027
  - RLAB-SRC-0024-V2
  - RLAB-SRC-0043
  - RLAB-SRC-0044-V2
  - SB-SRC-0003
  - V1-SRC-0088
  - V1-SRC-0090
  - V1-SRC-0095
  - PUB-V1-FPS-UX-20261102-V1-338d604e7939
  - PUB-V1-ACCEPTANCE-AMENDMENTS-20261102-V1-b6163f9c9f2c
  - V1-SOUND-UX-PREVIEW-20261102-V1
  - V1-USER-FLOWS-PREVIEW-20261102-V1
  - V1-COMPONENT-STATES-PREVIEW-20261102-V1
  - V1-UI-STRESS-PREVIEW-20261102-V1
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0028
related_decisions: []
supersedes: []
tags:
  - P0
  - FPS
  - grab
  - acceptance
  - UI
  - audio
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/ui-ux/fps-grab-review.md`](../../../../../knowledge/wiki/ui-ux/fps-grab-review.md). Source SHA-256: `5ed3223092812ee745b8f0caf0a76471c8ace455776ae8b257e8f067b89f1c7c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="fps-grab-情境新agent的最短閱讀路徑"></a>
# FPS Grab scenario: the shortest reading path for a new Agent

1. [Physics Architecture](../../../04-physics/PHYSICS_ARCHITECTURE.md) and [FPS Spec](../../../04-physics/FPS_INTERACTION_SPEC.md): bounded force/torque, shape queries excluding the held object itself, and CCD limitations.
2. [Input Controls](../../../04-physics/INPUT_CONTROLS.md) and [FPS UX](../../../05-ux/FPS_INTERACTION_UX.md): E/G/throw/R/B, Tab focus, IME, Esc/blur, and Resume revalidation.
3. [Design System](../../../05-ux/DESIGN_SYSTEM.md), [Components](../../../05-ux/COMPONENT_SPEC.md), and [Emil configuration](../../../05-ux/EMIL_SKILLS.md): HUD distance/blocking/mode, error recovery, and purposeful motion.
4. [Physics→Audio Events](../../../04-physics/PHYSICS_AUDIO_EVENTS.md) and [Audio Runtime](../../../02-architecture/AUDIO_RUNTIME.md): continuous sources do not restart on grab, contact sound occurs at the actual position, voice caps, and no double-counted delay.
5. [UI Stress Matrix](../../../05-ux/UI_STRESS_TESTS.md) and [validation plan](../../../06-validation/BENCHMARK_PLAN.md): test UI/physics/audio separately; Node mathematics is not a visual test.

Acceptance focus: out-of-range interactions do not teleport; walls/thin walls/corners/high mass ratios do not allow penetration; held keys do not keep running after focus loss; switching Held to Build does not silently drop; typing in the Inspector does not throw; missing audio permission offers visible recovery; the pause truncation policy is explicit. The view camera and measurement listener are separate; FPS binding is an explicit action.

This scenario is a reading/acceptance simulation. It did not implement Grab during Phase2 or claim browser acceptance passed. See the [production roadmap](../../../ROADMAP.md) for the related P0 ordering and dependencies.

<!-- english-original-anchor --> <a id="2026-11-01-r21滑鼠操作取代-e-與-b"></a>
## 2026-11-01 R21: mouse controls replace E and B

Following the [acceptance amendments](../../../11-v1/ACCEPTANCE_AMENDMENTS.md), grabbing moved to the left button, putting down to the right button while holding, and building to holding the right button to preview and releasing to place; E and B are only optional shortcuts, and there is no user-visible build mode. The input mapping and state machine of the [first-person interaction UX](../../../05-ux/FPS_INTERACTION_UX.md) were updated to match.

2026-11-02: Three general passages in the FPS source conflicted with the explicit ghost-cancellation clauses in 33/65. The [original version](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/15a9f8dda4b2807b226d526f6174aafd83ebc5a4) and the owner's original FAIL comparison were preserved; [canonical FPS](../../../05-ux/FPS_INTERACTION_UX.md) was precisely aligned with the confirmed 11/1 policy. This aligns document/oracle semantics, without changing the product or preassigning a corrected browser PASS; the [Conflict Record](../../../../../knowledge/conflicts/78d81bb5-7d39-426e-8394-8cc5838ee626.json) separately records the explicit reconciliation rationale.

Reconciled: the explicit new clauses/user acceptance amendments take precedence over the older general wording. The original expectation that the ghost would be retained was withdrawn, while the original FAIL was preserved. The new case should verify that pause clears the preview, object count stays unchanged, and primary only Resumes without recreating the preview. Native Esc unlocks by default; no additional two-step rule is introduced.

The four related general passages in Sound UX/User Flows/Component States/UI Stress that called for retaining the ghost were precisely aligned with the confirmed cancellation policy. Their original exact bytes and SourceIDs were stored separately in history; the [related Conflict](../../../../../knowledge/conflicts/364713fa-a544-4c3e-a1f8-6b177c943456.json) links back to the resolved primary Conflict. The Help index follows the same canonical links; no UI code was changed and no browser PASS was manufactured.

The Conflict covering those four related passages has been reconciled: only held/ghost semantics were precisely aligned. The original stress/design NOT RUN status and old test failures are preserved; they do not establish a new product defect or a measured pass.
