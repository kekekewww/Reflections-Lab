<!-- english-source: {"path":".agents/skills/physics-interaction/SKILL.md","sha256":"874626461c0ea67d2fae0bb2ac99840e10e7d2f821e8039196df552cfb23114f","translated_at":"2026-10-27T03:38:38.947915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: physics-interaction
description: Design and validate Reflection Lab Rapier FPS, grabbing and throwing, build placement, rigid-body states, and collision audio events.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/physics-interaction/SKILL.md`](../../../../../.agents/skills/physics-interaction/SKILL.md). Source SHA-256: `874626461c0ea67d2fae0bb2ac99840e10e7d2f821e8039196df552cfb23114f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="物理互動"></a>
# Physics Interaction

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

Maintain collidable, replayable dynamic behavior when changing character, grab, throw, placement, rigid-body mode, or contacts.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

Object mass/geometry/mode, fixedDt, input intent, control limits, and the target operation.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read the relevant specifications in docs/04-physics; confirm the pinned Rapier API, and do not use an opaque handle as a persistent integer ID.
2. Apply controls before the fixed step, and collect pose/contact after the step; render only interpolates.
3. Use a bounded impulse/torque servo to grab a dynamic body; perform target shape sweep/overlap checks. Do not parent it to the camera or teleport it through walls.
4. Record pose, velocities, sleep, grab, and restore policy when switching gravity/fixed/kinematic.
5. Keep the preview, staged, and enabled phases separate; a failed placement overlap check must not silently enable physics.
6. Separate collision onset from sustained contact; a resting support force is not an impact. Retain dedup/cooldown/voice caps.

<!-- english-original-anchor --> <a id="references"></a>
## References

`docs/04-physics/`, `experiments/physics-spike/`, `docs/06-validation/PHYSICS_VALIDATION.md`.

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Engine adapter/interaction state, a stable event schema, and test evidence for wall penetration, mode switching, and collisions.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

`npm run test:physics`; list complete grab/CCD/browser experiments separately. A passing spring test in an empty scene does not replace corner/high-speed tests.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Do not directly change the transform because a collision blocks movement; release within constraints and record the reason. When the API does not provide impulse, retain forceN or unavailable; do not mislabel it as Ns.
