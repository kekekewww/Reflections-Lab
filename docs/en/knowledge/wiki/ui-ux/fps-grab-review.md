<!-- english-source: {"path":"knowledge/wiki/ui-ux/fps-grab-review.md","sha256":"19e7ea36dca5ee526d4acea5172b3c8102253a5bbaa1f94c7c3a72500997579d","translated_at":"2026-10-27T03:44:07.128220Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0017
title: FPS Grab development and acceptance guide
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:52:37.412Z
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
related_tasks:
  - RLAB-TASK-0006
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
> English translation of [`knowledge/wiki/ui-ux/fps-grab-review.md`](../../../../../knowledge/wiki/ui-ux/fps-grab-review.md). Source SHA-256: `19e7ea36dca5ee526d4acea5172b3c8102253a5bbaa1f94c7c3a72500997579d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
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
