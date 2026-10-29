<!-- english-source: {"path":"knowledge/wiki/decisions/fps-listener-exit.md","sha256":"620eb5d5dd3185c5094d15727cfb8f8d856ce866c8ee8a077f75cff4384d7537","translated_at":"2026-10-27T05:42:31.833508Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0024
title: Integrated decision on the FPS exit Listener and optional actions
type: decision
status: ACCEPTED
created_at: 2026-10-25T20:06:44.646Z
updated_at: 2026-10-25T20:08:01.667Z
sources:
  - RLAB-SRC-0002
  - RLAB-SRC-0018-V2
  - RLAB-SRC-0023-V2
related_tasks:
  - RLAB-TASK-0004
related_decisions:
  - ADR-003
supersedes: []
tags:
  - UX
  - FPS
  - listener
  - conflict-resolution
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/decisions/fps-listener-exit.md`](../../../../../knowledge/wiki/decisions/fps-listener-exit.md). Source SHA-256: `620eb5d5dd3185c5094d15727cfb8f8d856ce866c8ee8a077f75cff4384d7537`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="fps-listener-退出政策整合"></a>
# Integrating the FPS Listener exit policy

Phase 2 independent review found that the old Workspace text required retaining the last position, while the Physics FPS specification required restoring the saved ScenePinned. Original excerpts/hashes are preserved in the [Conflict Record](../../../../../knowledge/conflicts/e12dc748-94fd-4ab2-b9d8-72808a5b1749.json); opposing text was not silently blended.

Engineering integration decision: save the original ScenePinned pose when the user selects FollowPlayer. On actually exiting FPS, restore it by default, set velocity=0, and mark a discontinuity. Ordinary Scene/Analysis observation cameras do not change the experiment listener. Using the last view as a new measurement point requires an explicit, undoable move-listener command. This retains the existing boundary between measurement listener and observer and avoids making mode exit a hidden variable.

The same review unified jump/crouch as optional P2, matching the original requirement that they be optional and the UX plan excluding them from MVP. This is engineering integration performed by the agent within authorized scope. It does not claim that the user separately selected this default, nor that browser behavior was implemented or measured.

Context/Alternatives: keeping the last position is convenient for exploration but silently changes measurement conditions. Saving the original position is more predictable, with an explicit command retained as an alternative. Trade-offs: exit returns to the original listener, requiring UI guidance and a ramp. Risks: renderer discontinuity and tails still require empirical testing. Status: ACCEPTED for specification; Superseded By: none; Related task: RLAB-TASK-0004; Commit: null (no HEAD yet).

The sole concrete specifications are [Physics FPS](../../../04-physics/FPS_INTERACTION_SPEC.md) and [Workspace](../../../05-ux/WORKSPACE_ARCHITECTURE.md).
