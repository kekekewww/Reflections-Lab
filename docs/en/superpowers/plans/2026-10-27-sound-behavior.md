<!-- english-source: {"path":"docs/superpowers/plans/2026-10-27-sound-behavior.md","sha256":"a47ab30311abded2b024bbe6d248f8039ead2d7720fbe29aff2f198ad3a5cabe","translated_at":"2026-10-27T05:42:00.517Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/superpowers/plans/2026-10-27-sound-behavior.md`](../../../superpowers/plans/2026-10-27-sound-behavior.md). Source SHA-256: `a47ab30311abded2b024bbe6d248f8039ead2d7720fbe29aff2f198ad3a5cabe`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-research--architecture-integration-plan"></a>
# Sound Behavior Research & Architecture Integration Plan

> Execute directly as explicitly requested by the user; complete through research with separate file ownership, positive and negative draft validation, and independent review, without building a large formal product.

**Goal:** Evaluate the feasibility of editable sound behaviors, connect them to the existing system through traceable events, data contracts, and a shared propagation chain, and switch to Codex-led development.

**Spec:** [User requirements](../../00-project/SOUND_BEHAVIOR_REQUEST.md).

**Architecture:** Physics / interaction events → normalized state and rules → logical SoundInstance / SpatialEmitter → existing Custom Acoustic Core → Web Audio renderer. Sound content, rigid-body materials, and propagation materials remain separate; all 3D sounds follow the same spatial propagation contract. The data draft attaches to the existing SceneSpec without silently migrating the formal schema.

**Tech Stack:** Existing Node / TypeScript / AJV and an isolated Rapier0.21.0 spike; React/R3F and the formal WebAudio runtime are not yet implemented. Add no new dependencies.

<!-- english-original-anchor --> <a id="constraints"></a>
## Constraints

- Codex is the primary developer; MuseCode is optional and still has no available quota, so do not dispatch model calls. Meta Model API retains its role as the product AI; do not claim completion without live evidence.
- Physics events are not acoustic measurements; creative samples are not natural vibrations. dBFS is not SPL, and gravity0 is not vacuum.
- Fixed step, stable IDs, revisions, atomic commands / undo; replay saves trajectories and normalized events, without assuming arbitrary resimulation is bit-for-bit identical.
- The audio callback does not wait for AI / network / physics, and propagation delay/HRTF/distance are each counted only once; the single maintenance location for the performance budget stays unchanged.
- Preserve old ADRs / sources / gates; new versions supersede them. The Wiki remains the single task authority, with sequential CLI writes. Do not push / deploy / accept terms.

<!-- english-original-anchor --> <a id="分工與驗證"></a>
## Work Allocation and Verification

- [ ] Physics: Compare official and installed APIs, define complete events / boundaries, and provide the necessary real WASM risk spike and independent fixtures.
- [ ] Middleware: Original FMOD / MetaSounds / Wwise / SoundParticles sources; distinguish version / web / license / access, what can inform the design, and what does not need rebuilding.
- [ ] Contracts: Draft schema/TS for 12 types, bounded declarative rules, asset refs and revision, positive and negative validation; keep AI tools in a separate v1 draft without changing the original 12enum.
- [ ] UX / AI / rules: Inspector first / Graph deferred, canonical design references; Meta tool preview/domain/apply/undo and manual fallback; recheck unknown items in the official competition rules.
- [ ] Root: Codex-primary supersession ADR, sound layering / acoustics / scheduling / recording, safety and performance, MVP and stable task dependencies; establish the next formal Milestone.
- [ ] Integration: Actually run schema / spike / existing regressions, fix independent review findings; synchronize sources / Wiki / Task / checkpoint / handoff / Now, distinguishing PASS / NOTRUN.

<!-- english-original-anchor --> <a id="review-focus"></a>
## Review Focus

1. Do not conflate Force(N) with impulse(Ns), or pre-solve velocities with post-solve data; sustained contact must not turn into an impact storm.
2. OnThrow/Drop sources, rolling/sliding/contact/state boundaries, and held/mode/pause/replay must be traceable.
3. Explicitly define routing when two surface profiles trigger the same sample twice, or when the same source bypasses / passes twice through HRTF, distance, or delay.
4. Valid JSON does not mean an asset exists / rights are complete / trigger parameters are usable; do not mix different revisions / runEpoch values.
5. P0 planning must not promise that all Graph / rolling / AI / acoustic features are already available when the product is not yet implemented and time is limited.
