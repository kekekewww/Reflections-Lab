<!-- english-source: {"path":"docs/02-architecture/adr/003-first-person.md","sha256":"1f32ba2c18f064c844d66265d419a927ebe9c76d0dc4d3de13e7321968106c67","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/003-first-person.md`](../../../02-architecture/adr/003-first-person.md). Source SHA-256: `1f32ba2c18f064c844d66265d419a927ebe9c76d0dc4d3de13e7321968106c67`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-003first-person-controller"></a>
# ADR-003: First-person Controller

- Status: Accepted for preproduction; browser interaction NOT RUN.
- Context: Requires WASD, camera wall collision, build/grab, and listener synchronization; the editor camera must not change the measurement listener.
- Decision: Three PointerLockControls manages view direction only, while the Rapier capsule character controller handles movement/slide; the character determines head pose. Entering FPS requires a gesture; Esc/blur releases held inputs, pauses, and explicitly offers resume.
- Alternatives: A freely flying camera (editor only); a dynamic rigid-body player (natural pushing/collision, but more slope/stair tuning); a fallback with no pointer lock plus keyboard camera/orbit.
- Evidence: [PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html), [Rapier controller](https://rapier.rs/docs/user_guides/javascript/character_controller/).
- Trade-offs: The kinematic controller needs an explicit policy for pushing forces and mass interactions; it must not be treated as complete humanoid dynamics.
- Risks: Browser pointer-lock support, keyboard layouts, and focus capture. B activates build, Tab retains its focus function; typing in UI must not trigger world actions.
- Reversibility: Input intent, character movement, view, and listener attachment are separate layers, allowing the controller to be replaced.
