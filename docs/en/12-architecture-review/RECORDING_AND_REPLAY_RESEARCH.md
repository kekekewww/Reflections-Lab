<!-- english-source: {"path":"docs/12-architecture-review/RECORDING_AND_REPLAY_RESEARCH.md","sha256":"c2bb01b07b90573012b5bc2010121e8860a910e1a91a5bfbea0b6e200dd5a014","translated_at":"2026-10-29T05:23:28Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/RECORDING_AND_REPLAY_RESEARCH.md`](../../12-architecture-review/RECORDING_AND_REPLAY_RESEARCH.md). Source SHA-256: `c2bb01b07b90573012b5bc2010121e8860a910e1a91a5bfbea0b6e200dd5a014`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="錄製與重播架構研究"></a>
# Recording and Replay Architecture Research

Date: 2026-10-29 (Asia/Taipei). Audited baseline: `c210ca882ca8503b322c28884bf1e9f6e9fe126d`. This is independent architecture research; existing V1 recording/replay, acceptance and historical failures are retained. `PLAN` denotes a reserved contract, `CODE` behavior inspected this round, `HISTORICAL TEST` existing evidence, and `NOT RUN` a capability not executed this round. This page does not claim complete V1, cross-platform physics equivalence or device listening completion.

<!-- english-original-anchor --> <a id="結論與既有權威"></a>
## Conclusion and Existing Authority

Recording already has a usable data core; a second recorder is unnecessary. `RecordingArtifact` stores immutable configuration and per-tick inputs, derived decisions, routes and source-phase evidence; `verifyRecording` recomputes content and fingerprints; `MotionReplay` follows authoritative motion; `ReplayAudioHost` reconstructs sound control; actual Behavior/solver reevaluation belongs to `RecordingProcessor`. PCM export is a separate stage. Trace sealing or realtime replay must not be described as completed offline rendering.

Formal requirements remain V1-RPL-01–03 and V1-AB-01–02 in [ACCEPTANCE](../11-v1/ACCEPTANCE.md) and the [acceptance amendments](../11-v1/ACCEPTANCE_AMENDMENTS.md). The three replay modes follow [RECORD_REPLAY](../07-experiments/RECORD_REPLAY.md), single-variable conditions follow [AB_COMPARISON](../07-experiments/AB_COMPARISON.md), and separation of physics, content and propagation follows [ADR-014](../02-architecture/adr/014-sound-behavior-system.md). Older design documents retain historical “not yet implemented” passages. Assess current behavior against code and named evidence; one paragraph cannot establish that everything is absent or everything is complete.

<!-- english-original-anchor --> <a id="既有資料盤點code"></a>
## Existing Data Inventory (CODE)

| Item | Currently stored/validated | Replay and future export boundary |
| --- | --- | --- |
| Initial Scene | `configuration.sceneSnapshot`; Scene schema, IDs, revision, units, coordinates and canonical SHA-256; geometry snapshot and actual scene geometry enter the fingerprint together | Authoring/initial-scene data, not a complete Rapier engine snapshot at an arbitrary time |
| Motion | Every tick includes every object's stable ID, position and unit quaternion; optional linear/angular velocity and sleeping; contiguous integer ticks | Original trace drives playback; display interpolation cannot rewrite motion authority. Velocity is optional in the generic recorder, so exporters must check fields required by their use |
| Physics | Scene mode/mass/friction/restitution/gravity/seed, plus `physicsConfig` and `physicsVersion` fingerprint | Formal RecordingArtifact has no dedicated Rapier binary snapshot, creation order or complete per-tick input-intent log field; these data alone cannot establish precise resimulation |
| Collision/player events | Separate `physicsEvents` and `audioEvents`; eventId, tick, sequence, object references and cross-frame deduplication; ContactData can preserve collider IDs, contact position, normal, materials and impulse method | Retains original contact stimulus/classification; `null`/Unavailable impulse is not filled with measured data. Generic `unknown[]` recorder validation does not replace full domain validation |
| Behavior | Original `inputFrame`, `preStepSnapshot`, post-step `runtimeSnapshot`, `voiceIntents`, decisions and document/profile/binding/rule revision | An already-started AlwaysOn/impact must continue from true pre-state; post-step state cannot initialize another evaluation of the same tick |
| Source content/phase | Source/generator/profile/asset manifest fingerprints; pre/post `voiceCursors`; `content-and-cursors-v2` distinguishes `nativeEpoch`, `logicalIntent`, `silent`, `missing` | Epoch-mapped source cursors and logical intent are not hardware PCM read pointers. Silence requires a genuinely evaluated empty emission history |
| Assets | Manifest with asset ID/revision/hash/origin/license; product configuration merges decoded metadata | A manifest does not mean asset bytes are bundled into recording. Rerendering requires the host to obtain matching bytes and check decoded rate/channels/duration; missing or unauthorized assets fail explicitly |
| Listener | Per-frame ID, position and quaternion, plus listenerTraceHash; ReplayAudioHost restores orientation | Existing replay strictly preserves the original listener; old source-listener paths cannot represent a changed listener |
| Material/geometry | Full registry, object acoustic-material bindings, geometrySnapshot and actual scene bindings enter fingerprints | Measured/Derived/Tuned/Synthetic provenance and bands/installation conditions remain governed by formal material data; replay does not turn them into measurements |
| Settings/backend | solverConfig/atmosphere/backend ID/version/fixedDtS/sampleRateHz/physics version; path propagation-speed provenance is checked for consistency | Version strings are not WASM/browser-build byte hashes. The complete audio graph, monitor gain, limiter and native HRTF profile are not all first-class existing recording fields |
| Time/provenance | runId/runEpoch/UTC, sceneRevision, start/end ticks/counts/bytes/artifact hash; AcousticFrame poseTick/listener references | Declared sampleRateHz is not actual device-rate evidence: product recordingConfig fixes 48000 while AudioEngine can use a default AudioContext. A future renderer must record actual sample rate/engine separately |
| Results | acousticFrames/result references; manifest links paths/events, classified Computed and V1 | Trace/geometric pressure-gain estimators are not rendered PCM/SPL/RT60. Vacuum or unresolved propagation speed can make the old Experiment v1 manifest explicitly unavailable; a valid RecordingArtifact need not be fabricated as an air manifest |

Code locations: [types](../../../src/experiments/types.ts), [recorder/fingerprints/verification](../../../src/experiments/recorder.ts), [source phase](../../../src/experiments/source-phase.ts), [product configuration and recording integration](../../../src/app/runtime.ts), [Behavior/Contact contracts](../../../schemas/sound-behavior/types.ts), and [minimal Experiment manifest schema](../../../schemas/experiment.schema.json). `schemas/experiment.schema.json` is a summary manifest, not a complete RecordingArtifact schema. Its version and fields remain unchanged this round.

<!-- english-original-anchor --> <a id="三種執行方式"></a>
## Three Execution Modes

| Mode | Inputs and actual work | Supported claim/unsupported inference |
| --- | --- | --- |
| Recorded-output authoritative replay (CODE) | Uses captured poses, listener, raw events, decisions, voice intents/cursors and acoustic routes; physics does not recalculate the trajectory | Replay of the same recorded inputs; not a new physics solve or bitwise-identical hardware output |
| Acoustic/Behavior reevaluation (CODE) | `reprocessRecording` preserves motion/listener/raw physics; the host callback genuinely reevaluates content or solver; candidate receives a new run/hash | Acoustic A/B must fix content and phase; Behavior A/B can declare profile/asset/gain/pitch changes. Changing metadata while reusing old results is insufficient |
| Pinned resimulation/fresh physics (existing independent validation scope) | The former reruns the same engine/initial snapshot/seed/order/fixedDt and compares; the latter creates new motion after mass/friction/geometry changes | Consult original physics-snapshot evidence; RecordingArtifact's authoritative trace itself does not establish full resimulation |

[Rapier's official determinism documentation](https://rapier.rs/docs/user_guides/javascript/determinism/) explains same-version, initialization and order conditions. This research did not rerun same-machine or cross-machine resimulation and adds no PASS claim. Reviewed/accessed: 2026-10-29; this page redistributes no SDK or documentation full text.

<!-- english-original-anchor --> <a id="時間順序與去重"></a>
## Time, Ordering and Deduplication

The current authoritative clock is the integer physics tick, with `simulationTime = tick × fixedDtS`. Ticks do not advance during pause; recording overload pauses instead of inserting a wall-clock gap. Recorder rejects tick gaps, repeated eventIds, non-increasing sequences, revision/epoch mismatches and invalid quaternions; failed frames cannot be partially accepted. `MotionReplay.seek(tick)` creates a new replay epoch and returns a preview with `emitEvents:false`. `ReplayAudioHost` also checks emitted ticks, drains old voices first and restores remaining content from its cursor. Pending arrivals during pause and tail cutoff during seek are distinct boundaries.

Future PCM work follows the same trace and introduces an explicit integer sample-frame coordinate (PLAN):

`n(tick) = round((tick − tickOrigin) × fixedDtNumerator × sampleRateHz / fixedDtDenominator)`

`round` is nearest, with exact ties toward positive infinity; numerator/denominator form a rational number with denominator > 0. Use safe/exact integer arithmetic to avoid intermediate multiplication overflow. Map every tick directly; never repeatedly add an already-rounded step. At 60 Hz, 48000/44100 Hz yield 800/735 frames respectively, but the contract does not assume other steps divide evenly. Convert to Web Audio seconds using `n / sampleRate` only at the final boundary. This is the project's proposed traceable quantization policy, **not a Web Audio guarantee for all events**.

Emission windows use `[startTick, endTickExclusive)`. Existing artifact `endTick` is the last frame, so it cannot directly serve as the exclusive upper bound. Content output length is `n(endTickExclusive) − n(startTick)`, plus explicit tailFrames; preroll does not count toward delivered frames. Event identity remains runEpoch/tick/sequence/eventId/instanceId, rather than being renamed from floating-point currentTime or output sample index.

<!-- english-original-anchor --> <a id="改-listenerhrtf-的正確界線plan"></a>
## Correct Boundaries for Listener/HRTF Changes (PLAN)

- Moving the listener changes distance, propagation time, occlusion, reflection paths and arrival direction, requiring acoustic reevaluation from original scene/motion/emission history. Changing orientation also requires rerendering binaural direction. Original collision/Behavior stimulus can remain fixed; original AcousticFrames cannot be presented as results for the new listener.
- Replacing only HRTF with identical listener/scene can reuse verified geometric paths/emission signal and rerender spatialization. HRTF assets require profile ID/revision/hash/sample rate/license. Native Panner does not expose coefficient hashes that can be pinned; record browser/engine and the `browserManagedUnspecified` limitation.
- Listener/HRTF changes are separately declared research variables and cannot bypass existing Acoustic/Behavior A/B listener-equality gates. This round changes no comparison rules and implements no listener-override renderer.
- Completed stereo binaural PCM cannot generally be inverted into independent sources/paths and recalculated at another listener position. Preserve emissions, paths or re-solvable inputs to retain future rerendering options.

<!-- english-original-anchor --> <a id="聲源隔離與物理隔離"></a>
## Source Isolation and Physics Isolation

Source isolation selects which recorded emissions enter rendering while retaining every object's motion, collisions, occlusion/reflection role and original Behavior voice admission. Removing an emitting body or collision counterpart changes contacts, paths and stimulus: that is fresh physics/scene work. Muting one source must not give other sounds emissions previously dropped by the voice budget; that would be another Behavior execution requiring a distinct name and record.

Select using existing stable `sourceId`/instance mappings, not object indices or Rapier handles. One object can have a continuous source and multiple contact/one-shot emitters. Preserve contact-source positions; do not move all emitters to object COM for stem convenience.

<!-- english-original-anchor --> <a id="本輪保留的最小擴充category-bplan"></a>
## Minimal Extension Retained This Round (Category B/PLAN)

New [render-contract.ts](../../../src/audio/render-contract.ts) is exposed only through `export type` in the [audio index](../../../src/audio/index.ts): portable `RenderJob`/`RenderBackend`/`RenderResult`. Jobs reference existing RecordingArtifact and configuration stable IDs/SHA-256, without duplicating scene/trace formats or taking AudioContext/AudioNode/Rapier/Node objects. They include backend identity/required capabilities, rational clock, window/tail, listener/HRTF, emission selection, dry/direct/early/late/mix/master taps and three capacity budgets. Results distinguish completed/failed/cancelled; completion reports actual backend/engine/capabilities/output hashes/peak/tail truncation/history insufficiency.

These are reserved types and semantics. **There is no runtime validator, backend implementation, provider registration, UI, cloud, asset upload or PCM encoder.** Future implementation must validate every number, data reference, capability, revision and hash. TypeScript types cannot validate untrusted JSON or copy required capabilities into actual capabilities.

`RenderArtifactRef.sha256` is explicitly the digest of stored bytes. `RenderJob.recordingContentSha256` separately corresponds to original `RecordingArtifact.artifactSha256`, computed over its canonical body excluding its own hash field. They generally differ and cannot be interchanged. Check bytes first, then call original `verifyRecording` for full content/fingerprints/source-phase classification. A matching hash establishes integrity of specified content; it does not promote `missing` phase to reproducible sound.

<!-- english-original-anchor --> <a id="證據與下一步"></a>
## Evidence and Next Steps

| Evidence | Assessment this round |
| --- | --- |
| `tests/experiment-runtime/recording.test.ts` | Original cases inspected: full sealing, atomic rejection, pause/seek, cancellation, hashes and comparison gates; rerun results belong to the integration receipt |
| `tests/experiment-runtime/source-phase.test.ts` | Original cases inspected: 4 ms phase counterexample, true silence/missing distinction, same-source remap and forged pitch/generator rejection; not hardware PCM phase proof |
| `tests/app/replay-audio.test.ts` | Original cases inspected: captured routes/listener, late cursor, no seek retrigger, asset pins, stop and bounded lifetime; mostly control-graph-level tests |
| `tests/app/recording-processor.test.ts` | Original cases inspected: pre-state restoration, phase continuity, reevaluation rollback, motion/contact provenance, materials and independent geometry oracle |
| `tests/browser/recording-worker/run.mjs`/existing R15 artifact | HISTORICAL TEST: approximately 8.26 MB single-case silent sealing comparison; not full-scene capacity or PCM export PASS |
| New renderer/listener override/custom HRTF/stems/chunk seams | NOT RUN/not implemented; retain separate future acceptance |

Actually executed this round: Node `22.17.0`/npm `11.4.2` match; `npm run typecheck` PASS; `node node_modules/prettier/bin/prettier.cjs --check src/audio/render-contract.ts src/audio/index.ts` PASS. These check types/formatting only and execute no new audio renderer; Root's integration validation lists complete original regressions separately.

The next actual renderer task should first deliver bounded single-pass PCM rendering: verify assets/recording → fix clock/event scheduling → render output window/tail → check hash/peak/clipping/sample counts → commit last. Then separately add listener override, stems and incremental rendering, each with real-browser numerical oracles. This research or pure-type checks cannot replace those checks. [Offline rendering research](OFFLINE_RENDERING_RESEARCH.md) covers official APIs, memory, tails and nonlinear mixing limitations.
