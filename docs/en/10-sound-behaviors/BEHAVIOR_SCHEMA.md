<!-- english-source: {"path":"docs/10-sound-behaviors/BEHAVIOR_SCHEMA.md","sha256":"2e2d3287eedd9c5e3215d28100937ee618a98b11f3c34f802429b0a813a0a3ea","translated_at":"2026-10-27T03:40:43Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/BEHAVIOR_SCHEMA.md`](../../10-sound-behaviors/BEHAVIOR_SCHEMA.md). Source SHA-256: `2e2d3287eedd9c5e3215d28100937ee618a98b11f3c34f802429b0a813a0a3ea`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-資料契約草案-v1"></a>
# Sound Behavior Data Contract Draft v1

2026-10-27. Status: **DRAFT / schema and domain fixtures validated; product Runtime not implemented**. The formal files are [behavior-document.schema.json](../../../schemas/sound-behavior/behavior-document.schema.json), [sound-behavior-ai.schema.json](../../../schemas/sound-behavior/sound-behavior-ai.schema.json), and [types.ts](../../../schemas/sound-behavior/types.ts). The existing SceneSpec, 12 AI tools, and Experiment schema remain in place; this draft does not silently extend their executable capabilities.

<!-- english-original-anchor --> <a id="1-版本權威與最小儲存單位"></a>
## 1. Versions, Authority, and the Minimum Storage Unit

The top-level document is `{schemaVersion:"1.0.0",documentId,revision,assets,profiles,bindings}`. `documentId`, `profileId`, `ruleId`, `bindingId`, `instanceId`, and object IDs are stable domain IDs, never array indices or Rapier handles. `revision` is the behavior document revision; each profile has its own revision. Neither is interchangeable with the original Scene revision. Reject unknown versions; do not conceal migration by removing fields or filling values automatically.

`assets` stores only pinned `{assetId,revision,sha256}` references. Users or AI cannot include URLs, local paths, base64, or self-declared authorization. The trusted host catalog manages actual file availability, decoder metadata, source/license, byte hashes, and permissions. A subsequent host transaction adapter must implement the Scene–sidecar association, manifest hash, and atomic Apply/inverse; there is currently no executable sidecar save/load UI.

| Type | Purpose and Key Fields |
| --- | --- |
| `SoundBehaviorProfile` | Reusable preset; profileId/revision/name/presetKind/rules/materialPairOverrides |
| `SoundBehaviorRule` | enabled, trigger, conditions, generator, emitter, gain/pitch/fades/cooldown/priority/voiceLimit/layerGroup/mappings; optional P1 lifecycle |
| `SoundTrigger` | `kind:continuous|discrete` and the corresponding allowlisted type; the two kinds cannot be mixed |
| `TriggerCondition` | Typed metric comparison, state boolean, or material-pair; no expression/JavaScript |
| `ParameterMapping` | SI input, finite range, normalized curve, explicit target/clamp/smoothing |
| `SoundAssetReference` | An assetId, revision, and SHA256 already present in the host registry; never guess a file from its display name |
| `SoundGenerator` | Sample reference plus loop/offset, or bounded oscillator waveform/frequencyHz; not an acoustic solver |
| `SoundInstance` | Logical voice, pinned profile/rule/binding, playback state, playhead, seed, and position; stores no AudioNode |
| `SpatialEmitter` | Object offset, contact representative, zone, or fixed position; no routing field that bypasses the acoustic core |
| `AudioEvent` | Decided logical start/update/stop, independent emission ID, physics stamp, profile/rule references, source position, and contact provenance |
| `BehaviorRuntimeState` | Replayable epoch/tick/sequence, active rules, cooldown, instances, processed event IDs, and seed; not an engine object from an implementation |

`BehaviorBinding` also explicitly records `objectId/objectGeneration/profileId/profileRevision`, supporting multiple objects sharing a profile and per-object `enabled/gainLinear/pitchSemitones` overrides. An object may also have multiple bindings/layers; each binding has its own ID. Sharing a preset must not mean sharing a runtime cursor. Show affected objects before changing a shared profile; use a new profileId for an independent copy.

Effective enabled is the binding master flag AND (the individual rule override.enabled if supplied, otherwise profile rule.enabled). A disabled state must not create/update emissions or retain scheduled/playing instances. Explicit stop and fading/stopped cleanup may remain; disabling must not discard cleanup records for existing tails.

<!-- english-original-anchor --> <a id="2-trigger-與條件"></a>
## 2. Triggers and Conditions

Continuous allowlist: AlwaysOn, WhileMoving, WhileAirborne, WhileRolling, WhileSliding, WhileSpinning, WhileHeld. Discrete allowlist: OnGrab, OnRelease, OnThrow, OnDrop, OnImpact, OnBounce, OnStartMoving, OnStopMoving, OnEnterZone, OnExitZone, OnSleep, OnWake. Events follow the definitions in [EVENT_MODEL](EVENT_MODEL.md) / [Physics Bridge](PHYSICS_AUDIO_BRIDGE.md); a speed threshold must not simply be renamed as a player throw.

`OnThrow` comes from a throw interaction event accepted by the host. `WhileAirborne` relies on reliable support/contact classification; it does not mean “speed greater than zero” or “no gravity.” Use UNKNOWN when a state classification is unknown. Do not treat unknown as false and then accidentally trigger `equals:false`. This is required behavior for the future evaluator; the schema shape alone cannot prove that it executes correctly.

`OnImpact/OnBounce/WhileRolling/WhileSliding` use a contact emitter. The schema/domain gate does not accept silently substituting the object center. A contact position is a selected representative position; ContactData retains the aggregation method and limitations for multiple manifolds. It cannot be described as an exact solution for all microcontacts. Other triggers cannot arbitrarily choose a contact attachment.

<!-- english-original-anchor --> <a id="有界-p1-latch"></a>
### Bounded P1 Latch

The exact behavior “start a loop on a throw, stop on the first impact, and wait until the next throw” cannot be replaced with WhileAirborne; the latter may become true again on a bounce. The draft can describe:

```json
{
  "trigger": {"kind":"discrete","type":"OnThrow"},
  "lifecycle": {
    "mode":"latched",
    "stopOn":["OnImpact"],
    "retriggerPolicy":"ignore",
    "maxDurationSeconds":5
  }
}
```

The rule trigger specifies the starting event; a sample generator must have loop=true. Disallow adding a latch to a continuous trigger, listing the start event in stopOn, and zero or infinite duration. Processing follows normalized `(tick,sequence)` order; a duplicate input ID does not retrigger. `ignore` retains the original instance; `restart` must fade out the old instance and create a new ID within the same voice budget, without instantly stacking unbounded voices. The host stops instances and records the reason for invalidations such as mode/delete/teleport/reset. An epoch change must not carry an old latch into a new run.

A latched instance in a checkpoint must retain `{startEventId,deadlineTick,retriggerCount}`. Its deadline is expressed as `startedAtTick + ceil(maxDurationSeconds/fixedDtSeconds)`; Pause does not advance the logical tick. This is a **P1 data draft**, not a completed latch evaluator. When the host has not declared this capability, the product AI should return CAPABILITY_UNSUPPORTED or create only a draft awaiting validation; it must not claim executability.

After the deadline, the instance cannot remain scheduled/playing; it may only enter fading/stopped. A normal discrete oscillator additionally requires `oneShotDurationSeconds` (0.005–30 seconds), and fadeIn + fadeOut must not exceed that value. Reject it without this finite stop; do not mislabel indefinitely playing native oscillators as one-shots. Continuous/latched rules cannot also include oneShotDurationSeconds. A plain discrete sample must have loop=false; the same field may shorten playback. The renderer must still validate the actual decoder duration and end envelope.

<!-- english-original-anchor --> <a id="3-曲線參數與安全"></a>
## 3. Curves, Parameters, and Safety

A mapping is a normalized piecewise linear/step curve: inputMin < inputMax; curve x values strictly increase, start/end at 0/1, and x/y both lie in [0,1]; `clamp:true` is required. Each rule permits only one mapping per target; rule order cannot provide implicit overrides. There are no arbitrary functions, paths, shell commands, or graph payloads.

| Input | Applicable Context |
| --- | --- |
| sourceSpeedMetresPerSecond, angularSpeedRadiansPerSecond | Object motion snapshot for every trigger |
| normalImpulseNewtonSeconds, closingSpeedMetresPerSecond, tangentSpeedMetresPerSecond | OnImpact / OnBounce |
| slipSpeedMetresPerSecond, tangentSpeedMetresPerSecond, contactSupportForceNewtons | WhileRolling / WhileSliding |

Contact tangent relative velocity and rolling slip are not synonyms; do not substitute fields to conceal missing classification data. Missing values are unavailable/null, not filled with zero. Draft safe target ranges are gainLinear 0–4, pitchSemitones −24–24, filterCutoffHz 20–20000; smoothingSeconds 0–1. These are adjustable engineering input limits, **not guarantees of hearing quality or measured performance**. The device sample rate determines the actual Nyquist limit; the future renderer must additionally clamp/reject unachievable cutoff values.

gainLinear is a digital source amplitude ratio, not sound power/dB SPL. Creative pitch mapping must not add Doppler already produced by propagation delay a second time. A physical preset is only a creative sample/procedural preset; without a vibration model, it cannot be called physically natural generation. Physical material, acoustic absorption/scattering, and presetKind do not share a single freely rewritable field.

Draft storage limits: 64 profiles, 256 bindings/asset pins, 32 rules/material-pair overrides per profile, 8 conditions/mappings per rule, 16 points per curve, and 256 instances/4096 recent event IDs per runtime snapshot. These are initial bounded-input values, not runtime capacity. Voice allocation is also constrained by the host's global/per-object/per-rule budgets and the [canonical performance budget](../06-validation/PERFORMANCE_BUDGET.md); an array limit does not authorize 256 simultaneous sources.

<!-- english-original-anchor --> <a id="4-資產材質配對與來源"></a>
## 4. Assets, Material Pairs, and Provenance

For each pinned asset, the domain validator checks its ID/revision/hash, availability, and rightsStatus against an external catalog; a model-provided document has no catalog authority. When decoded duration is available, a sample offset must be within its range. Material-pair overrides are an unordered pair + ruleId; reject duplicate pairs. Material IDs must exist in the host registry. Replacing a collision sound file cannot change friction, restitution, or absorption.

A contact's object/collider must exist in the trusted host context, and the collider must actually belong to the listed object. The binding and original physics/player trace link the body generation. This still neither re-solves nor proves that every contact DTO is genuine Rapier output; the data producer and preservation of raw traces require separate validation.

The assets in [examples](../../../schemas/sound-behavior/examples/document.json) point only to [SyntheticDescriptorNotAudio](../../../schemas/sound-behavior/examples/asset-descriptor.json), not audio files. The [context](../../../schemas/sound-behavior/examples/context.json) explicitly marks FIXTURE_ONLY; references can be validated only in offlineFixture mode. Switching to product mode is rejected. No third-party sound effects have been downloaded or distributed, and these fixtures are not claimed to provide audible audio.

Randomized variants, arbitrary procedural DSP/ADSR/filter graphs, an automatic material sample library, node graphs, modal synthesis, and arbitrary latch graphs still require subsequent independent schema/capability/tests. The current generators are only a single sample and a simple oscillator. Recording a seed does not mean randomized sample selection is implemented.

<!-- english-original-anchor --> <a id="5-ai-提案與-transaction"></a>
## 5. AI Proposals and Transactions

Proposal envelope: `schemaVersion/proposalId/sceneId/expectedSceneRevision/expectedBehaviorRevision/operations`. Only CreateProfile, ReplaceProfile, DeleteProfile, AssignBinding, and RemoveBinding are available. ReplaceProfile supplies a complete new profile, preserves the ID, has the correct expected profile revision, and increments by one revision; arbitrary JSON Patch paths are not accepted.

Schema capacity is 64 operations, but the local domain gate accepts at most the smaller of the host limit and 32; it cannot bypass the existing application mutation budget. The validator simulates the complete proposal only on a clone to check references. It neither mutates the input nor applies the formal scene. Deleting a profile cannot leave dangling bindings. After replacing a shared profile, every retained binding must explicitly pin the new revision (remove/reassign may occur in the same candidate proposal).

Choosing a known asset from the catalog that is not yet in document.assets does not require giving the model permission to add to the catalog. The candidate validator derives missing pins from **ID/revision/hash matching the trusted catalog**, returning `derivedAssetPins` on success. Unknown IDs, stale hashes, missing files, or unverified rights remain rejected. The formal host must show these pins in Preview and include pins/profiles/bindings and their inverses in the same atomic commit; it must not Apply a profile while failing to save its pins. This is an explicit preflight/candidate data specification; host commit is not implemented.

The formal trusted host must still check authorization, a single writer, scene/profile/document revisions, assets, capability, and source budgets before stage → Preview → Apply. Undo uses inverse contents to create a new revision; it cannot roll back the revision counter. Composite atomic transactions across Scene and Behavior, a provider strict-schema adapter, and a persistent engine executor are **NOT IMPLEMENTED**. See [Product Muse Integration](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md).

<!-- english-original-anchor --> <a id="6-runtime錄製與-ab"></a>
## 6. Runtime / Recording and A/B

An AudioEvent's emission ID is separate from `parentPhysicsEventId`. The latter refers to the normalized physics/player input trace. Changing a creative profile may change emission IDs/voices; it must not rewrite the original collision count. epoch, tick, fixedDt, scene/profile revision, object generation, logical playhead, seed, and voice allocation/drop decisions should link to one another in the recording ledger. Do not serialize AudioNode, Rapier world, or AudioContext.currentTime.

The `SoundBehaviorComparison` draft distinguishes `acoustic` and `behavior`. Both fix geometry, physicsConfig (including mass/friction/restitution/gravity/modes), motion, raw physics/player events, listener, solver, and atmosphere hashes.

- acoustic: the only permitted independent variable is acousticMaterial; source signal/profile/asset manifest/generator config remain identical.
- behavior: propagation material remains identical; sourceAsset, generator, gainMapping, pitchMapping, and behaviorProfile vary as declared. The profile hash may change as a derived consequence of changes to embedded asset/generator references; do not mistake it for a second independent variable. Reject a comparison if the source signal changes without any generation input hash changing.

`physicsEventTraceHash` refers to raw normalized input, not the AudioEvent/VoiceDecision trace. Behavior A/B may produce different emission decisions, but must preserve them completely. Hash equality checks cannot prove that the host wrote genuine data; immutable run artifacts and a correct producer are still required. The existing Experiment schema does not automatically accept a new comparison kind because this draft exists; the formal analysis adapter remains to be implemented.

<!-- english-original-anchor --> <a id="來源與驗證"></a>
## Sources and Validation

Retains the pinned AJV 8.20.0/TypeScript; no Zod or new dependencies were added. JSON Schema shape, TS compilation, and host domain validation each have their own scope. The original [Draft2020-12 validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation), [AJV strict mode](https://ajv.js.org/strict-mode.html), and [options](https://ajv.js.org/options.html) were read on 2026-10-27. This document is an original synthesis, with no reproduction of third-party full texts. See the [Validation Plan](SOUND_BEHAVIOR_VALIDATION.md) for formal local commands and items not run.
