<!-- english-source: {"path":"docs/14-core-pipeline/stages/03-capabilities.md","sha256":"12906db0beaa7c1c85e5d621e36985f5de2a87290c9dd52c7601626d96836653","translated_at":"2026-11-02T05:27:54.5835730+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/03-capabilities.md`](../../../14-core-pipeline/stages/03-capabilities.md). Source SHA-256: `12906db0beaa7c1c85e5d621e36985f5de2a87290c9dd52c7601626d96836653`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="階段-03聲音行為能力清單與反彈事件核心"></a>
# Stage 03: sound-behavior capability list and bounce-event core

Date: 2026-11-02 (Taiwan). Executor: Codex subagent capability_core; independent design review: bounce_review; implementation-code review awaits integration review. Baseline `429efb7597ec913bd879ecc05c29a6be7ad5175c`, branch `codex/pipeline-capabilities`. This stage does not establish full V1, hardware-audio or performance acceptance.

<!-- english-original-anchor --> <a id="已完成核心"></a>
## Completed core

- `src/capabilities/sound-behavior.ts` provides one typed/JSON-safe trigger-capability projection. Each entry contains trigger, kind, supported, reasonCode, Traditional Chinese/English reasons and limitations. The product declares the OnBounce producer connected and the zone producer unconnected.
- `makeBehaviorContext` carries trusted `producerCapabilities`. Profile Registry, authoring validation and Sound Proposal Host jointly reject enabled unsupported triggers/latch stops/zone emitters. Disabled rules may remain, but Binding overrides cannot enable unsupported rules.
- Offline Sound Planner handles bounce/zone intent through the same capability declarations. Unsupported zone requests are explicitly rejected instead of silently falling back to AlwaysOn. The Sound planner's closed input contract adds optional, strict boolean producer declarations; existing standalone evaluator/fixture contexts need no migration.
- The new `PhysicsBounceProducer` emits genuine `PhysicsEvent.OnBounce` after PhysicsWorld's fixed-step events complete. The pure adapter only forwards events. Runtime and AI Run share PhysicsWorld, so no separate bounce inference is needed. Recorded raw-physics and normalized discrete-event identities stay aligned.
- A bounce requires an accepted parent OnImpact, ContactEnd for the same contact pair, a finite tick window and separating contact-point velocity that includes angular velocity. Contact points are stored as local anchors on both bodies and restored using their current poses. A new contact episode, mode/generation/epoch/revision, held state, discontinuity, interaction or external impulse/velocity invalidates the previous candidate. Candidate, event and evidence rings are all bounded.

<!-- english-original-anchor --> <a id="明確範圍"></a>
## Explicit scope

`CAP-001`: Node/schema/Host tests support the positive and negative shared-capability contracts, not UI visual acceptance. Root's UI branch must consume this API and update the old OnBounce "unsupported" text.

`CAP-002`: Bounce is a **Tuned engineering classification**, limited to dynamic objects against fixed support surfaces that have neither moved nor rotated. Dynamic-versus-dynamic and rotating/moving support surfaces are conservatively left unclassified. This is not measured material data, complete contact-force data or a guarantee for arbitrary-shape bounces. The separating-candidate threshold is 0.15 m/s and the window is 0.25 s; these are not sound-pressure/physiological thresholds.

`CAP-003`: This project has no actual zone-region registry/occupancy authoring, so this stage still declares it unsupported. It adds no fake zone events and makes no Scene schema changes. A schema's expressive capability does not establish that the product has a producer.

The generic evaluator may consume normalized events from other trusted producers. Product support restrictions apply only when a product context explicitly declares producers. A model response grants no Host authority.

<!-- english-original-anchor --> <a id="基本測試"></a>
## Basic tests

- New capability 8 cases and bounce 9 cases: 17/17 PASS, including real Rapier fixed-step impact/separation → raw OnBounce → pure adapter → Behavior evaluator emission; this is neither a headless-browser run nor hardware playback.
- Broader existing and new regressions: 255/255 PASS, covering physics, audio-behavior, defaults, authoring edits, support anchors and Sound Host/provider/server/session. Original results are saved in `03-capabilities-regression.txt`.
- `npm run typecheck`: exit 0; see `03-capabilities-typecheck.txt`.
- Scoped ESLint/diff/source hashes are in the verification and check receipts in the same directory.

Browser UI/native Pointer Lock/hearing/600-second performance/Meta live were not run; these cannot be inferred to have passed from this stage's tests. Original numerical references/tolerances, package/lockfile, shared generated Wiki files and old artifacts were not changed.

<!-- english-original-anchor --> <a id="合併接線與-claude-code-複核"></a>
## Merge connections and Claude Code review

1. The UI uses `getSoundBehaviorCapabilities(PRODUCT_SOUND_BEHAVIOR_PRODUCERS)`. `soundTriggerCapability`, `assertSupportedSoundTrigger` and `assertSupportedBehaviorDocument` are available for other product boundaries to share.
2. The bounce append in `PhysicsWorld.fixedStep` must occur before motion after-step hooks/recording observers. When merging motion's `applyMotionImpulses`, call `this.bounceProducer.invalidateObject(id)` after successful mode/held/finite validation and before changing velocity, so a control impulse is not misclassified as a bounce.
3. The source-phase guard remains unchanged: raw-physics OnBounce and inputFrame events must map one to one. Do not synthesize or backfill events after recording.
4. Claude should reverify no retrigger from stable contact, sliding off not counting as a bounce, reversed canonical order, angular velocity/local anchors, control intervention, duplicate ticks/reset, new episodes, capacity and cancellation/import lifecycle, and also exercise actual product UI/audio operations.
