<!-- english-source: {"path":"src/audio-behavior/README.md","sha256":"41185bb530c8ad1cf07560ac34bea7fdebee0bea25d1c6cb7b17035caeafe41a","translated_at":"2026-10-27T23:18:17.233266Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`src/audio-behavior/README.md`](../../../../src/audio-behavior/README.md). Source SHA-256: `41185bb530c8ad1cf07560ac34bea7fdebee0bea25d1c6cb7b17035caeafe41a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-runtime"></a>
# Sound Behavior Runtime

The production pure TypeScript domain evaluator; it does not create AudioNodes or derive Physics events itself, and does not constitute audio/browser acceptance.

Entry point `index.ts`:

- `createBehaviorRuntime(document, context, options)`: creates a runtime after AJV and trusted registry/domain validation.
- `runtime.step(frame)`: returns `{ events, voices, decisions }`. `events` are committed AudioEvents; `voices` are VoiceIntents delegated to an independent audio host for execution.
- `runtime.getActiveRuleStates()`: retrieves a detached data projection of each binding's current `{ bindingId, activeRuleIds }` for the Inspector to read the logical active state; callers may mutate the returned containers without changing the runtime.
- `runtime.snapshot()`/`restore(snapshot)`: saves bounded state, the input cursor, and voice metadata; rejects mismatched versions, identities, assets, lifetimes, or epochs.
- `runtime.setPaused(boolean)`: freezes only the logical clock; it does not fabricate StopMoving/Release. Audio bus fading/pausing is handled by the audio host.
- `runtime.reset(newEpoch)`: clears logical voices, cooldowns, deduplication, and the cursor. **The caller must first stop/drain old AudioNodes and establish a new audio epoch**; this pure domain method cannot directly clean up AudioNodes in another layer.
- `runtime.replaceDocument(next, context, newEpoch?)`: logical voices must be drained first; the same document's revision increases monotonically. If the third argument is omitted, subsequent steps are blocked by `NEW_EPOCH_REQUIRED` until `reset(newEpoch)`.
- `runtime.notifyEnded(instanceId)`: releases the corresponding logical instance after the audio host confirms natural playback completion.
- `runtime.getTrace()`: retrieves bounded admission/update/stop/reject diagnostics.
- `createProfileRegistry(document, context)`: strict activation preflight; samples must have a real ready/rights-approved registry and decoded duration.
- `validateBehaviorAuthoring(document, context)`: persistence load preflight. It still validates the schema, references, curves, and lifecycle, but retains external assets that have not been relinked; the returned `AUTHORING_ONLY_NOT_ACTIVATED` **cannot serve as evidence of playability**.
- `mapParameter(mapping, input)`: finite input, explicit clamping, and piecewise linear/step curves.

<!-- english-original-anchor --> <a id="producerhost-契約"></a>
## Producer/Host Contract

`types.ts` defines `BehaviorFrame`, `BehaviorObjectInput`, `NormalizedBehaviorEvent`, `BehaviorContext`, and `VoiceIntent`.

Each frame's event tick must match the object snapshot tick; sort first by tick/sequence/ASCII stable ID. Unknown state is `null` and must not be replaced with `false`. Throw/Drop/Grab/Release accept only events already accepted by the interaction producer and carrying a commandId; high-speed movement does not synthesize Throw. Real contacts must have registry collider ownership, geometry, a unit normal, and method/null provenance.

Continuous and one-shot/latched instances do not overwrite each other. Object attachments follow the quaternion/pose; contact one-shots retain the original contact position. All discrete start/update/stop operations retain the normalized parent; cleanup stops for contact emitters still retain the contact. A single profile does not share runtime cursors across different bindings.

For each ordered input, voice admission sorts candidates first by priority and stable binding/rule ID. Global/per-object/per-rule limits all count fading tails; the current policy is explicit rejection, without abruptly stealing a playing sound. There is no claim that the renderer's additional crossfade voices have passed a device budget.

The event ID cache is bounded and also retains a monotonic input cursor to prevent an evicted ID from being resent in the same tick; late old sequences are explicitly rejected. Reset/seek uses a new epoch. The recorder should still retain the full raw input trace; this bounded diagnostic trace does not replace experiment records.

<!-- english-original-anchor --> <a id="active-rule-唯讀投影"></a>
## Active-rule Read-only Projection

`getActiveRuleStates()` reads the current state on every call, preserves binding and rule order, and creates a new outer array, binding objects, and `activeRuleIds` arrays. It does not advance ticks, reconstruct voices, or update cooldowns, nor does it cache previous state. After restore, reset, replaceDocument, or rollback following a failure, it uses the current state.

App publication needs only these IDs to determine each rule's logical active marker, so it uses this projection. Recording, replay, restoration, and complete checkpoints continue to use the original `snapshot()`; its existing data and method implementation are retained. Actual audio admission/playback state still comes from audio telemetry.

Differential tests compare the full snapshot reference, output decisions, trace, App views, and capture/replay artifacts, and verify that caller mutation does not change the runtime. Reducing snapshot-copy calls is operation-count evidence; speed, frame tails, GC, Worker, and device audio still require separate measurements.

<!-- english-original-anchor --> <a id="能力界線"></a>
## Capability Boundaries

Supports legal normalized inputs for the existing seven continuous and twelve discrete trigger IDs, orthogonal conditions, gain/pitch/filter mappings, cooldowns, bounded latches, and material-pair generator selection. The producer validates the physical classification of Rolling/Sliding/Bounce; this module does not claim to implement arbitrary-shape contact solving. There are no variants, arbitrary JavaScript, DSP graphs, or modal synthesis.

The audio host must use the unified SourceGraph/Acoustic Core and perform real scheduling/gain smoothing/Nyquist clamping/device budgeting; the digital gain here must not be described as dB SPL.

Tests: `node --import tsx --test tests/audio-behavior/*.test.ts tests/app/active-rule-view.test.ts`. Tests include an independent-process cross-check against the pinned old domain validator, plus detached data, rollback, and complete App differential regressions for the active-rule projection; Node domain PASS does not equal browser/AudioNode/listening-test PASS.
