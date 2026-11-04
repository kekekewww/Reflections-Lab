<!-- english-source: {"path":"knowledge/wiki/features/trajectory-editor-mvp-20261104.md","sha256":"9ae623839fd70bbf2dacd04acfec384b14df263fa708b313b5fd9364c7d73e86","translated_at":"2026-11-04T10:28:19.421Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
---
id: RLAB-KB-TRAJECTORY-EDITOR-20261104
title: Trajectory editor hackathon MVP
type: feature
status: UNVERIFIED
created_at: 2026-11-03T20:44:31.904Z
updated_at: 2026-11-04T10:28:19.421Z
sources:
  - V1-PARAMETER-REFERENCE-20261104-V5
  - PUB-V1-FULL-TEST-PROCEDURE-20261104-V1-1b29bc127d54
  - PUB-TRAJECTORY-LIMITS-20261104-V2-8fa6ea68e59c
related_tasks:
  - RLAB-TASK-0034
related_decisions: []
supersedes: []
tags:
  - trajectory
  - editor
  - first-person
  - recording
  - hackathon
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/features/trajectory-editor-mvp-20261104.md`](../../../../../knowledge/wiki/features/trajectory-editor-mvp-20261104.md). Source SHA-256: `9ae623839fd70bbf2dacd04acfec384b14df263fa708b313b5fd9364c7d73e86`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="軌跡編輯器-hackathon-mvp"></a>
# Trajectory editor hackathon MVP

The user-approved design is the [design](../../../../superpowers/specs/2026-11-03-trajectory-editor-design.md); the implementation plan is the [plan](../../../../superpowers/plans/2026-11-04-trajectory-editor.md). Formal parameters and behaviour follow [Parameter reference §21](../../../11-v1/PARAMETER_REFERENCE.md) plus the code and tests; this page is only an index.

<!-- english-original-anchor --> <a id="內容"></a>
## Contents

- Every audible object (an enabled sound behaviour binding or a sound source) can have one trajectory, stored in the scene document's `trajectory` field (offsets from the starting position, at most 63 points), written only through `setTrajectory` and undoable.
- Editor: select an object and press T to open or close; Shift+T shows all; Esc ends. Clicking a surface adds a point (offset "bounding radius + 1 cm" from the surface), the selected point can be dragged, Delete removes a point; the Inspector trajectory section edits points, Strength (0.5 to 20 m/s, default 3), Start delay (0 to 30 s) and Face along path.
- First person: Ctrl + left press while aiming at an audible object starts a stroke; the room returns to its starting layout and freezes while the player stays in place; after Ctrl is released the user can still look and scroll the depth (0.75 to 3 m); releasing the left button commits, and Enter or a click starts the take.
- Start only begins a take at tick 0; Record first returns to the starting layout when the room has run and a runnable path exists. When a path ends the object returns to its configured mode, and a dynamic object keeps the Strength speed; a path blocked on the way hands over at that point. At most 8 paths run at once, travel time is capped at 30 s, and a path that touches fixed geometry is marked blocked and does not run.
- Curve: a chord-length-knot Hermite curve; the vertical axis is limited (Fritsch–Carlson) so it never passes beyond neighbouring point heights (so floor points do not sag into a blocked path); horizontally the tangent is zero on flat runs along a wall, so a painted stroke is not stored as a curve through the wall, and elsewhere the curve stays smooth.
- Repeatable takes: after a scene edit the world is marked stale, and the next Start or Record (when a runnable path exists) first returns to the starting layout, so takes from the same layout match tick for tick; when first-person painting produces a path that cannot run, a notice says why; duplicated objects carry no path.

<!-- english-original-anchor --> <a id="驗證"></a>
## Verification

- Real browser: `node tests/browser/build-ui-preview.mjs`, then `npx playwright test --config tests/browser/trajectory-editor.config.ts` (see the [full test procedure](../../../11-v1/FULL_TEST_PROCEDURE.md)).
- Runtime: `tests/motion/`, `tests/physics/path-physics.test.ts`, `tests/app/trajectory-runtime.test.ts`, `tests/interaction-runtime/paint.test.ts`, `src/ui/trajectory-ui.test.ts`.

<!-- english-original-anchor --> <a id="限制"></a>
## Limitations

Muse can't write curves drawn with the T key, but it can propose Motion panel paths (the earlier statement here that it couldn't write paths was wrong). See the [scene builder record](../../../../00-project/MUSE_SCENE_BUILDER_20261104.md) and [Meta Agent](meta-agent.md).

The full list is in the 2026-11-04 section of [Known limitations](../../../KNOWN_LIMITATIONS.md): not yet tested by a person; no walking while painting; exactly axis-aligned points form a corner; sparse points near a wall can bulge and be marked blocked; Start after a scene edit while paused restarts the take; curves follow the replayed pose during replay.
