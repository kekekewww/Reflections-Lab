<!-- english-source: {"path":"docs/02-architecture/adr/004-grab-throw.md","sha256":"f087532133270679f6a523a25ab0f32f0b460982e201fdc5b58c7066f454c083","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/004-grab-throw.md`](../../../02-architecture/adr/004-grab-throw.md). Source SHA-256: `f087532133270679f6a523a25ab0f32f0b460982e201fdc5b58c7066f454c083`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-004grab--throw"></a>
# ADR-004: Grab / Throw

- Status: Accepted for preproduction; complete corner interactions still await validation.
- Context: Grabbing must preserve momentum, mass, and collision; parenting to the camera transform does not meet requirements.
- Decision: Apply a bounded impulse/torque servo to a Dynamic body at each fixed step; constrain the target through shape sweeps and overlap checks first. Use the actual pose after contact resolution as the sound source pose; dropping preserves the current velocity, and gentle drop requires an explicit damping policy. Throw uses impulse in Ns, with a total speed cap.
- Alternatives: A spring/joint to a kinematic anchor (fallback, but the cap API must be verified); a velocity servo (can easily disrupt contact resolution); direct teleportation (preview only, never for holding).
- Evidence: [Rapier forces/impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/), [physics docs](../../04-physics/PHYSICS_ARCHITECTURE.md).
- Trade-offs: Control gains, maximum force, and grabbable mass are design parameters and cannot be described as material measurements; heavy objects may fail to keep up with the target.
- Risks: Corners, thin walls, high speeds/high mass ratios, rotational inertia, and sleeping. Release on limit violations and record the reason; never pull an object instantly through a wall.
- Reversibility: The GrabController adapter can be replaced with a joint; Scene/record formats retain only intent and replayable motion.
