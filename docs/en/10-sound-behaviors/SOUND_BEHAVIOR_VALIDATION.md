<!-- english-source: {"path":"docs/10-sound-behaviors/SOUND_BEHAVIOR_VALIDATION.md","sha256":"4bfbdeca917e0084a0293b492dce0ce9e415c1ed6c6e0baad85795def4b93ec4","translated_at":"2026-10-27T05:42:51.746764Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/SOUND_BEHAVIOR_VALIDATION.md`](../../10-sound-behaviors/SOUND_BEHAVIOR_VALIDATION.md). Source SHA-256: `4bfbdeca917e0084a0293b492dce0ce9e415c1ed6c6e0baad85795def4b93ec4`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-驗證矩陣與下一階段關卡"></a>
# Sound Behavior Validation Matrix and Next-Stage Gates

2026-10-27. This stage completes **V0 schema / domain fixtures and isolated physics research**; there is no production Behavior evaluator, Audio Event Runtime, Web Audio graph, browser UI, or Meta live loop. Validation scripts are not product features.

<!-- english-original-anchor --> <a id="已執行的契約驗證"></a>
## Contract validation executed

```powershell
node --test tests/sound-behaviors/contracts.test.mjs
node scripts/validation/sound-behavior.mjs
node node_modules/typescript/bin/tsc --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck schemas/sound-behavior/types.ts
```

The original RED was a missing validator module. After the earlier 11 cases passed, 5 added regressions for latch / identity / host budget / A/B coupling first reproduced failures. Independent review then reproduced gaps in effective-enabled, finite one-shot / expired latch, the catalog pin workflow, and collider identity, adding 4 regressions. It also reproduced the same defect whereby a material-pair generator could bypass the oscillator stop requirement; the check was moved into the shared selected-generator gate and 1 regression was added, without deleting original acceptance cases. Results: **21/21 PASS, 5 CLI draft fixture sets PASS, strict TS noEmit PASS**. These counts are local contract checks and cannot be added up into a physics, audio, or model success rate. The root's complete gate / raw output is retained separately in this stage's report.

| Test area | Mechanically checked | Status / boundaries |
| --------- | -------------------- | ------------------- |
| Data shape | Version, required / unknown fields, continuous/discrete discriminator, array / numeric bounds, no graph / JS payload | PASS; does not prove host execution |
| Asset references | Host registry ID/revision/hash, availability / rights, trusted derived pins, FIXTURE_ONLY forbidden for product use | PASS; no sound decoding or playback |
| Shared profiles | Sharing among objects, object generation, binding override, stale profile revision, duplicate IDs / unknown rules | PASS; no Inspector / Apply |
| Mapping | Context metrics, curve endpoints / strict x, clamp, input/output ranges, duplicate targets / NaN / Infinity | PASS; no audio automation generated |
| Contact emitter | Contact source, event position matching the representative point, unit normal, nullable impulse / velocity provenance, known object/collider participants | PASS; actual playback position / HRTF not validated |
| Runtime snapshot | Logical epoch / tick, document/profile refs, voice cap, effective-enabled / active rules / cooldown, duplicate events / instances, finite one-shot / latch deadline | PASS; checks only checkpoint shape and consistency, without advancing a runtime |
| AI proposal | Scene/document/profile revisions, typed full replacement, host 32-op limit, clone validation, stranded refs, prohibited physics changes | PASS; Meta API / transaction executor NOT RUN |
| A/B | Acoustic fixes the source; behavior permits declared generation variables while fixing physics/motion/inputtrace/propagation | PASS; actual capture/replay / analysis NOT RUN |

The [asset descriptor](../../../schemas/sound-behavior/examples/asset-descriptor.json) is not a WAV or recording. The tests' FIXTURE_ONLY registry is explicitly synthetic data; the product gate rejects it. This data must not be described as real playable assets or actual Meta responses.

<!-- english-original-anchor --> <a id="正式事件行為-runtime-的必過條件"></a>
## Mandatory conditions for the production event / behavior Runtime

All of the following are **NOT RUN / Implementation Pending**; PASS in the table above cannot automatically check these off.

| Category | Independent fixture / observation | Acceptance |
| -------- | --------------------------------- | ---------- |
| Single impact and support | Fixed seed, sphere remains in contact after landing; retain raw manifold / force / J separately from accepted emissions | Exactly one qualifying onset; persistent support does not replay every tick. Suppressed low-speed events require a reason without removing the raw collision |
| Multiple contacts / CCD | Compound colliders, multiple walls, fast spheres, multiple manifolds in the same tick, independent geometric position references | Patch / episode deduplication does not merge different surfaces incorrectly; retain UNKNOWN and limitations when substep data is unavailable |
| OnThrow / OnDrop | Paired cases of accepted player command traces and freefall with no command | Throw comes only from an explicit interaction command; freefall does not fabricate Throw; redelivery of an event ID is idempotent |
| Rolling / Sliding | Sphere no-slip, pure sliding, spinning in place, moving platforms, unsupported and UNKNOWN contact | Linear / angular / point velocity and support models distinguish cases; do not infer rolling from planar translation |
| Continuous / layers | AlwaysOn + WhileHeld / Airborne + impact simultaneously, with a fixed voicebudget | Pose/mapping updates do not rebuild persistent logical instances; one-shots do not interrupt loops |
| Cooldown / hysteresis | Jitter on both sides of thresholds, replay/redelivery, different profiles sharing an object | Tick-based state is reproducible; cooldown and reset policies do not leak across epochs |
| P1 latch | OnThrow→bounce / impact→next throw, different sequences in the same tick, timeout, pause / reset | Exact start/stop; redelivery does not recreate instances; airborne-gated and latched behavior cannot be interchanged |
| Disable / mode / delete | dynamic/fixed/kinematic/gravity0, held object hitting a wall, teleport, removal | No ghost impacts; appropriate fades; record a reason separately for data and sound drops |

Fixed golden traces must not use expected values generated by the classifier under test. For isolated Rapier API observations, refer to the raw artifacts in [Physics Bridge](PHYSICS_AUDIO_BRIDGE.md). Thresholds / cooldown / support angles are Tuned settings, rather than universal physical constants.

<!-- english-original-anchor --> <a id="正式-audiospatial-驗收"></a>
## Production Audio / Spatial acceptance

Establish the Audio Event Runtime / clock bridge / voice registry first, then connect the behavior evaluator. Use predefined test impulses, analytical `d/c`, and fixed generator waveforms as independent answers; do not use the function under test to calculate both expected and actual values.

- **Click / pop and parameter continuity: NOT RUN.** Measure envelope / gain / pitch / delay boundaries across frames with OfflineAudioContext, retaining sample rate, block size, waveforms, and peak differences; base thresholds on the signal and device rather than unilaterally declaring something “inaudible.” Headphone listening tests separately list the person, device, volume, and conditions.
- **Loudness and positioning: NOT RUN.** Send the same emission to direct/early/late, counting distance gain / delay only once. Contact one-shots originate at known world contact positions; object-following sources update smoothly. Reuse the HRTF / IR capability in [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md), verifying no duplicate Panner attenuation or HRTF.
- **Acoustic bypass: NOT RUN.** Creative samples / oscillators only generate emissions; presetKind must not let them bypass Custom Acoustic Core. Use instrumentation to verify every positioned emission and solver request/frame ID; dry audition has an explicitly separate bus / epoch and does not enter experiments.
- **Budgets / overlap: NOT RUN.** Voice allocation / stolen / drop records can be replayed, and fades avoid hard cuts. AudioBufferSourceNode is a single-playback node: a used node cannot be “pooled and started again.” Decoded buffers and persistent Gain / Panner / Worklet processing resources may be reused; validate the actual strategy against the renderer.
- **Callback safety: NOT RUN.** Actual block size; no blocking, unbounded allocation, geometry, AI, or network; main/worker/control changes are not solved in the audio callback.

Record the physics 60Hz target, acoustic update rate, and audio sample clock separately; the added behavior evaluation rate / batch size are initial values awaiting profiling. Measure capacity and latency under [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md) on specified devices; schema limits are not throughput figures.

<!-- english-original-anchor --> <a id="錄製ab與ai"></a>
## Recording, A/B, and AI

Record retains scene / physics input traces, profile / bindings / assets / generator versions and hashes, event/voice decisions, seed, solver / listener / clock policies; explicitly state Pause / Resume and late-event policies. Replay may reuse recorded AudioEvents without triggering them a second time from physics.

Acoustic A/B retains the same source signal; Behavior A/B may change declared assets / gain / pitch / profiles while fixing the same physics/player inputs and propagation conditions. Output metrics come only from numerical / audio artifacts; hash checks validate only metadata. The real run producer and analysis remain **NOT RUN**. See the updated production requirements in the [Experiment docs](../../07-experiments) and this draft's comparison types.

Meta tool tests need cases for valid / invalid triggers, unknown assets, stale revisions, provider failures, domain rejection, and Preview / Apply / Undo. Manual authoring does not depend on the API; AI cannot generate measurement numbers or invent assetIDs. Current Meta live, strict provider schema conversion, product Apply / Undo, UI event editing, and measurement are **NOT RUN**; fixture and model provenance are explicitly separate.

<!-- english-original-anchor --> <a id="最小下一切片"></a>
## Smallest next slice

The next production step still follows the Scene / fixed-step prerequisites in [NEXT_ENGINEERING_TASK](../NEXT_ENGINEERING_TASK.md). First carve out an Audio Event Runtime without sound-device dependencies for Sound Behavior: fixed logical clocks, deduplication, instance/voice IDs, bounded queues, epoch reset, and golden traces. Only after this slice passes should an audible Web Audio / Acoustic Core smoke test be built, followed by Inspector P0 and manual rules. Unlock P1 latch, rolling/sliding, and AI proposals when capabilities and acceptance are ready; the node graph / modal synthesis remain P2.
