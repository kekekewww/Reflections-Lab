<!-- english-source: {"path":"docs/02-architecture/adr/002-physics.md","sha256":"f6e24ed1f008fcc093dcae567c57c885bc4eaf59bfd42a7bd9f4c7cbac846e8e","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/002-physics.md`](../../../02-architecture/adr/002-physics.md). Source SHA-256: `f6e24ed1f008fcc093dcae567c57c885bc4eaf59bfd42a7bd9f4c7cbac846e8e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-002physics-engine"></a>
# ADR-002: Physics Engine

- Status: Accepted for preproduction, 2026-10-26.
- Context: Requires dynamic/no-gravity/fixed/kinematic, collision, raycast, a character controller, and WASM deployment.
- Decision: A pinned Rapier JS compat package, a 60 Hz fixed step, and render interpolation. Main-thread physics is permitted in the initial version; move it to a worker after profiling.
- Alternatives: Ammo/Bullet, Cannon, Unity PhysX; no comprehensive speed comparison was performed here, so Rapier cannot be claimed to be the fastest. The fallback is to limit bodies and replay recorded trajectories, rather than write an incomplete rigid-body engine ourselves.
- Evidence: [Rapier Rigid Bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/), [Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), execution results from the isolated experiments/physics-spike.
- Trade-offs: WASM initialization, types/query pipeline, and timestep management; a spike does not establish that all wall-penetration risks have been eliminated.
- Risks: CCD has limitations; high mass ratios/rigid grabs may be unstable. The official determinism description requires strictly identical initialization and operation ordering; this project has no evidence of cross-machine bit-exact behavior.
- Reversibility: All handles remain in runtime mappings; Scene IDs are independent of the physics engine.
