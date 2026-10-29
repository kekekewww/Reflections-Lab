<!-- english-source: {"path":"docs/10-sound-behaviors/NEXT_AUDIO_MILESTONE.md","sha256":"86dbe18573ac3f8969b6934c10b1245e1c8aa03d98be873fdd3bf2c65d0deaa9","translated_at":"2026-10-27T05:42:51.746764Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/NEXT_AUDIO_MILESTONE.md`](../../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md). Source SHA-256: `86dbe18573ac3f8969b6934c10b1245e1c8aa03d98be873fdd3bf2c65d0deaa9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="下一個可指派milestonem0-audio-event-runtime"></a>
# Next Assignable Milestone: M0 Audio Event Runtime

Corresponds to **RLAB-TASK-0011**. This work establishes only executable research / draft validation; **this production runtime has not started**. Codex leads; MuseCode, an API key, a Graph editor, and new middleware are not required. The overall Scene / physics skeleton in Task0006 can proceed in parallel, while M0's pure logic initially develops against normalized fixtures; connecting it to the product requires the subsequent Task0012.

<!-- english-original-anchor --> <a id="交付"></a>
## Deliverables

Build a domain layer in TypeScript with no renderer / AudioNode dependencies: Profile / binding validation, a sorted event evaluator, orthogonal continuous gates, idempotent one-shot intents, per-binding cooldown, and bounded VoiceIntent. Consume the [Event Model](EVENT_MODEL.md) and draft contract without treating the isolated spike directly as a production engine; establish independent fixtures and tolerances for important derived rules first.

Suggested files: `src/audio-behavior/profile-registry.ts`, `evaluate.ts`, `runtime-state.ts`, `voice-admission.ts`, `trace.ts`, and independent tests. These are paths to create in the next Milestone and do not exist now; do not invent corresponding build / dev commands.

<!-- english-original-anchor --> <a id="不可放寬的驗收"></a>
## Acceptance conditions that must not be relaxed

1. Process different sequences in the same tick as defined; redelivering an eventId does not replay it. Different rules on the same object may have explicit layers; a shared profile does not share runtime state.
2. AlwaysOn must not be accidentally stopped by a one-shot during movement, OnImpact, Grab / Throw, or NoGravity; dimensions such as Held and contact may coexist.
3. OnThrow / OnDrop accept only successful interaction events; natural gravitational falling does not synthesize Throw. Define impact pair / owner / cooldown according to the production Event Model, rather than triggering on contact force every tick.
4. Mapping / fade / cooldown have ranges and units; explicitly reject extremes, NaN / Infinity, missing assets / rules, and stale scene/profile/binding revisions; no arbitrary JS.
5. Over-limit bursts have deterministic priority / a stable ID tie-break and drop/steal reasons; manage continuous and one-shot separately, both under effective budgets. VoiceIntent here is not yet playable audio.
6. Pause does not advance the logical tick; a new epoch on reset / seek clears old deduplication / deadlines. After saving state, reevaluating the same raw trace yields the same logical decision trace. Different behavior A/B variants may have different decision traces.
7. Do not alter Scene v1 / the old AI12enum / original benchmark references to manufacture success; preserve the actual commands, stdout / exit, Git scope, and limitations in full, and update the Wiki task after independent review.

Split P1 latch, rolling/sliding, assetvariant, and advanced materialpair routing into slices according to acceptance needs; do not implement every draft capability at once in M0. Return CAPABILITY_UNSUPPORTED for unsupported features; WhileAirborne cannot stand in for a latch that stops on the first Impact.

<!-- english-original-anchor --> <a id="當前可執行的前置檢查"></a>
## Currently executable prerequisite checks

```powershell
npm run validate:sound-behaviors
npm run test:sound-behaviors
npm run smoke:sound-physics
```

These are draft / isolated-spike commands established in this work, rather than evidence that production Runtime acceptance is complete. Record actual commands when M0 adds production tests and scripts; continue using the existing `npm run check` for regression.

<!-- english-original-anchor --> <a id="接下來的依賴"></a>
## Subsequent dependencies

Task0012: M0 + Scene/Physics Task0006 → minimal SourceGraph / AlwaysOn + OnImpact / unified acoustic routing / Inspector, adding OfflineAudioContext and browser / hearing checks. Validate with a small number of emitters first, before building a large multivoice scene.

Task0013: Then add complete Grab/Throw/Airborne wiring (requiring the corresponding FPS interactions to be complete), rolling / sliding, latch / materialpairs / timeline, and both A/B types.

Task0014: The product Meta agent's minimal valid proposal→preview→apply→experiment / actual results chain, independent of the Coding Agent; live prerequisites include Task0007 account / budget. Missing prerequisites prevent DONE, and fixtures cannot serve as Meta evidence.

Task0015: Graph / modal / complex procedural features are P2, rather than necessary prerequisites for this Demo.
