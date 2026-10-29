<!-- english-source: {"path":".agents/skills/ux-engineering/SKILL.md","sha256":"74d3a6764cbfe5e108de669c1fd7f19c5386bf216c33981edf75665cde130d8a","translated_at":"2026-10-27T03:38:38.947915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: ux-engineering
description: Handle Reflection Lab Workspace, Inspector, FPS HUD, input arbitration, build preview, and acoustic path selection; read the existing UX specifications first.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/ux-engineering/SKILL.md`](../../../../../.agents/skills/ux-engineering/SKILL.md). Source SHA-256: `74d3a6764cbfe5e108de669c1fd7f19c5386bf216c33981edf75665cde130d8a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ux-工程"></a>
# UX Engineering

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

Maintain consistent modes, input, and data sources when adding or adjusting 3D/analysis operations.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

User flow, workspace, simulation state, selected ID, input focus, and backend capabilities.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read the corresponding flow/component/design system in docs/05-ux, and avoid resetting the layout without a reason.
   Use the machine-readable file specified by the Design System as the sole source of token values; load `reflection-lab-design-system` and the pinned Emil Skills according to the work, without creating a parallel visual system.
2. Separate workspace layout from computation state, and do not reset on page changes; pause/revision before structural changes.
3. Focus takes priority: typing/menu/gizmo consumes input; the click that enters pointer lock must not also throw/place; Tab retains keyboard focus, and B switches to build.
4. Separate preview/staged/enabled and hover/selected/held; show the reason for invalid placement; Esc/blur clears input and explicitly indicates pause/resume.
5. Path/chart/inspector share stable selection; display only real solver data, and explain missing capabilities.
6. Do not communicate state through color/audio alone; provide keyboard operation, reduced motion, collapsible panels, and a safe initial volume.
7. For significant design/interaction changes, use `persistent-project-memory` to update the task/design Wiki/sources and handoff; maintain specific specifications in docs/05-ux, and do not duplicate tokens in the Wiki.

<!-- english-original-anchor --> <a id="references"></a>
## References

`docs/05-ux/`, `docs/04-physics/INPUT_CONTROLS.md`, `docs/02-architecture/DATA_CONTRACTS.md`.

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Flows/state transitions/components that can be acceptance-tested, and UI corresponding to the actual runtime; do not call a research wireframe a completed UI.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

Manually run focus/pointerlock/cancel/undo/capability cases according to USER_FLOWS; do not add tests that simply copy CSS for purely visual changes.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Use alternative controls without pointer lock when the browser does not provide it; errors must not swallow operations or silently reset. Report conflicting specifications and integrate them according to the latest ADR.
