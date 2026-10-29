<!-- english-source: {"path":"docs/10-sound-behaviors/EVENT_MODEL.md","sha256":"6b2bfded3ebe97212890bc27c5ac84ea3e85acbbebf2797e8f5ec305611dedd0","translated_at":"2026-10-29T05:29:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/EVENT_MODEL.md`](../../10-sound-behaviors/EVENT_MODEL.md). Source SHA-256: `6b2bfded3ebe97212890bc27c5ac84ea3e85acbbebf2797e8f5ec305611dedd0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-事件與狀態模型"></a>
# Sound Behavior Event and State Model

2026-10-29: The event design semantics below are retained; the production evaluator, physics bridge, and Audio Runtime now have implementations. See the [Sound Behavior Research](../12-architecture-review/SOUND_BEHAVIOR_RESEARCH.md) for actual support and gaps among producers, schemas, and UI; the runtime does not produce every event in these tables. [Physics-to-Audio](../04-physics/PHYSICS_AUDIO_EVENTS.md) and [Object States](../04-physics/OBJECT_STATES.md) remain authoritative for PhysicsStamp, body modes, and pause/audio epoch. This page does not create another clock.

<!-- english-original-anchor --> <a id="三層事件"></a>
## Three event layers

Raw physics/player observations → normalized behavior inputs → committed AudioEvent / SoundInstance. Cooldown or voice rejection does not delete the raw contact trace; a collision does not guarantee playback, and hearing nothing does not mean no collision occurred. Rapier has no native OnThrow or Rolling Sound event; the host must normalize them.

The shared gates are an Active lifecycle and an enabled profile/rule; Preview / Staged do not emit sound. Continuous is a level that maintains the same playback instance; Discrete is an edge and does not retrigger every render/tick. Triggers use stable PascalCase IDs:

| Continuous Trigger | Definition | Position / limits |
| ------------------ | ---------- | ----------------- |
| `AlwaysOn` | Active and enabled; Moving, Held, NoGravity, and sleep do not stop it | Object binding point; do not rebuild the playhead/node every step |
| `WhileMoving` | Linear speed in the specified reference frame passes start/stop hysteresis; the world frame is the explicit default | Object; a moving platform may specify a relative basis separately; thresholds are Tuned |
| `WhileAirborne` | Active Dynamic, not Held, with no **valid support** | Object; this may hold even at v=0 with no gravity; a flight preset may additionally AND WhileMoving |
| `WhileRolling` | Supported, with a shape that has an applicable rolling model, nonzero tangential motion / relative angular velocity in the support frame, and near-zero contact-point slip | Contact patch; P0/P1 do not accept an object anchor. Only sphere candidates are validated; unknown meshes return UNCLASSIFIED |
| `WhileSliding` | In contact, with relative tangential slip at the contact point exceeding hysteresis | Contact patch; COM speed alone is insufficient |
| `WhileSpinning` | Angular velocity magnitude / a specified axis component passes hysteresis, independently of support | Object; spin does not automatically mean rolling |
| `WhileHeld` | Held state from a successful interaction transaction | Object/grip; Held is not a body type and still participates in contact |

Valid support requires valid nonsensor geometric contact, a distance within the recorded contact tolerance, and a canonical normal compatible with the declared `sceneUp`; brushing a wall does not mean landing. Zero gravity cannot be used to infer up, and contact in zero gravity may have no positive force, so force>0 cannot be the sole condition. A missing contact snapshot is UNKNOWN, rather than assumed airborne; any short hold/fade policy must be recorded.

Moving, Held, sleep, lifecycle, and contact mode are orthogonal dimensions, rather than one mutually exclusive giant enum. Held+Moving+Contact is valid, and AlwaysOn and OnImpact may layer sounds; the Rolling/Sliding substates specifically need explicit priority and hysteresis.

| Discrete Trigger | Successful event source | Signals that cannot substitute for it |
| ---------------- | ----------------------- | ------------------------------------- |
| `OnGrab` | Accepted Free Dynamic→Held command | Hover / key down / failed grab |
| `OnRelease` | Successful release/drop/throw, carrying interactionId and reason | Invalidation from blur/pause/delete/type-change must not fabricate a user release |
| `OnThrow` | Explicit, successful Throw, carrying a finite impulse / commandId | High speed, natural falling, or being knocked away by another object |
| `OnDrop` | Successful Drop from Held, with no throw impulse | Freefall, turning off gravity, pause |
| `OnImpact` | A new episode onset or an explicitly rearmed onset that passes the intensity policy, merging, and cooldown | Arbitrary collision-start, nonzero force/J, or every manifold point |
| `OnBounce` | Separation candidate with a normal-velocity reversal exceeding a Tuned threshold within a bounded time window after its parent impact | Restitution>0 or the initial collision-start; P0 may defer this trigger |
| `OnStartMoving` | Moving false→true under the same speed basis | Awake, switching to Dynamic, teleport |
| `OnStopMoving` | Moving true→false, meeting the threshold / stability duration | A single noisy low-speed sample, simulation pause |
| `OnEnterZone` | Registry sensor occupancy false→true | Impact; occupancy already inside a zone at load only establishes a baseline by default |
| `OnExitZone` | The same occupancy true→false | Delete/reset/invalid handles use an invalidation reason |
| `OnSleep` | The isSleeping state edge of an Active Dynamic body, polled / normalized at fixed steps | Fixed, Paused, Staged, force event |
| `OnWake` | Sleep true→false for the same Dynamic body, retaining the reason when available | Construction / load baseline / body-type changes |

Drop / Throw may fan out both OnRelease and their specific trigger, sharing an interactionId. Different rules may deliberately subscribe to both triggers and layer sounds; the same rule accepts a redelivered event only once. Conflicts between Throw/Drop and Lock/Delete are first resolved by the host's atomic command ordering, rather than guessed by the sound evaluator. Bounce requires outgoing normal-velocity reversal and separation evidence within a bounded time window after the parent impact, excluding command invalidation; ContactEnd alone may just mean sliding off a platform and cannot count as Bounce. An impact already played cannot be rewritten; the Inspector must explicitly show layering from dual subscriptions.

<!-- english-original-anchor --> <a id="contact-episodes與可聽候選"></a>
## Contact episodes and audible candidates

- `pairKey` = canonical domain collider IDs + entity generations; `episodeId` = the contact lifecycle. Rapier handles / array indices cannot serve as persistent IDs.
- Aggregate positive normal J across geometric contacts in the same tick/pair/episode/surface region; weight world positions by J from that same set of contacts. When the sum=0 or some values are unknown, use an explicit fallback / unavailable value; do not divide by zero or fill unknowns with 0.
- A geometric index can only locate data locally within the current step's callback, not identify it across ticks. The solver contact index belongs to a separate index domain.
- For compound colliders, retain collider pairs first, then merge by object pair + compatible patch. Different walls / normals cannot all be averaged into the object center; grouping and patch identity still await production implementation acceptance.
- The conservative P0 policy accepts only one onset per episode/patch, retaining pair/region cooldown across episodes. If a new strike during persistent contact needs sound, add a closing-speed/J rising-edge rearm and impactCycle; sound must not recur merely because cooldown has expired.
- Retain the raw trace, audible rejection, and voice decision. Author policy may suppress a physically real tiny bounce; that does not mean there was no physical bounce.

Existing impact thresholds are maintained in the [original event contract](../04-physics/PHYSICS_AUDIO_EVENTS.md); spike numbers are only Tuned/Synthetic fixtures, rather than calibrated product defaults. Round cooldown seconds up to ticks using fixedDt, independently of render FPS.

<!-- english-original-anchor --> <a id="identityrevision與replay"></a>
## Identity, revision, and replay

Normalized inputs retain PhysicsStamp and carry runEpoch, eventId/interactionId, generation, pair/episode/surface/material revisions, and metric provenance. The tick is stamped after a fixed step completes, and simulationTimeSeconds=tick\*fixedDtSeconds; this is neither the AudioContext clock nor an exact CCD substep time.

The physics event ID is independent of the profile. Committed AudioEvent.eventId is an emission identity linked to parentPhysicsEventId, profileId/profileRevision, ruleId, layer, and occurrence. A/B retains the same pose/contact/normalized-event trace, then changes the behavior to produce new emissions without rewriting the original physics trace. Scene stores declarative profiles/bindings/overrides; short-lived cooldown/hysteresis/episode/cursor data belongs in BehaviorRuntimeState, with no Rapier/AudioNode serialization. See the [draft schema](../../../schemas/sound-behavior/behavior-document.schema.json).

| Boundary | Behavior |
| -------- | -------- |
| Mode / delete / teleport / collider rebuild | ContactInvalidated; clear transient state for that generation and fade/release; do not fabricate OnImpact/OnDrop |
| Gravity on/off | Retain Dynamic and velocity; do not automatically change the medium / vacuum |
| Pause | Freeze tick, state, and pending logical arrivals; fade under the original bus policy; do not emit OnStopMoving/OnRelease |
| Resume | Map a new audio epoch and reschedule only arrivals that have not yet arrived, once; do not replay emissions already played |
| Profile edit / Undo | Preview→revision check→atomic application; do not rewrite old records |
| Asset missing / not ready | Explicit error / degradation record; do not silently substitute another asset |
| Reset/load/seek | A new epoch or explicit cursor restore, without fabricating initial edges |

If the creative intent is “OnThrow starts a loop, and the first OnImpact stops it until the next throw,” use an explicit latched lifecycle / stopOn and maximum duration. Plain WhileAirborne is state-gated and may restart when a bounce leaves it unsupported again, so it cannot promise the same semantics. The latched runtime has not been implemented. Rerunning physics is not equivalent to bitwise replay; retain motion/contact/accepted commands/profile/asset hash/seed and necessary state.

<!-- english-original-anchor --> <a id="驗證界線"></a>
## Validation boundaries

[Policy tests](../../../experiments/sound-behavior-spike/physics-policy.test.mjs): **13/13 PASS**, validating only Synthetic/Derived control rules: sphere point velocity, platform-relative motion, hysteresis, multipoint weighting, one episode onset, cooldown across episodes, regions, Throw/Drop, epoch IDs, and invalid overflow. Production rolling, authoring, audio/node lifecycles, voice budgets, and listening tests are all NOT RUN. The additional [WASM probe](PHYSICS_AUDIO_BRIDGE.md) separately checks 3 API risks; this does not establish production sound functionality.
