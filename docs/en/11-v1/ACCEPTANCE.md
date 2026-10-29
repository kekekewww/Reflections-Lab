<!-- english-source: {"path":"docs/11-v1/ACCEPTANCE.md","sha256":"9a7355656a1fdb734a4261cd525f25baaad99664bbe876952087026b2ab6e406","translated_at":"2026-10-27T05:43:17.548494Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/ACCEPTANCE.md`](../../11-v1/ACCEPTANCE.md). Source SHA-256: `9a7355656a1fdb734a4261cd525f25baaad99664bbe876952087026b2ab6e406`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版驗收矩陣"></a>
# First-Version Acceptance Matrix

Created: 2026-10-27; baseline commit `2662bc8ee3976280c5c14f619ff798570f035f14`. An isolated acceptance agent compiled this document from existing authoritative sources. **It is a specification awaiting acceptance, not test results**; it does not create another Task system or substitute research or M0 for the complete first version. See [REQUIREMENTS.json](../../11-v1/REQUIREMENTS.json) for machine-readable fields, source hashes and the frozen list.

The user has authorized direct implementation; Codex leads and no Muse allowance is used. Original acceptance criteria must not be deleted or relaxed. Task0006 and 0011 can proceed in parallel; 0012 depends on both; 0013 depends on FPS interaction wiring; 0014 real Meta additionally depends on the 0007 account/budget.

<!-- english-original-anchor --> <a id="完成判定"></a>
## Completion Criteria

Do not mark full first-version goal achieved until required in-scope requirements and required external/evidence gates have direct current evidence. Missing, indirect, narrower or uncertain evidence is not completion. P2 is explicitly deferred, not faked.

- P0: essential first-version core. P1: Roadmap D5–D8 and Task0013 product capabilities; dividing work into slices does not allow silently removing them from closure scope.
- EXTERNAL_GATE: account, budget, rules or user rights confirmation; retain BLOCKED / NOT RUN and continue other work.
- EVIDENCE_GATE: real browser, DSP, device and performance evidence; narrower tests cannot substitute for it.
- Keep PASS / FAIL / BLOCKED / NOT RUN separate; keep V0–V5 separate. Distinguish offline Mock from real Meta, and Computed from Measured.
- If frozen acceptance itself is defective, first conduct an isolated review and record a new version and rationale; implementers may not change expected/tolerance to manufacture success.

<!-- english-original-anchor --> <a id="第一版需求"></a>
## First-Version Requirements

<!-- english-original-anchor --> <a id="system"></a>
### system

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-SYS-01／P0 | **Reproducible production Web app**: after a clean npm ci, open room/sphere with the documented dev command; production typecheck/build passes, with original research scripts retained. Pin exact versions of new dependencies and record license/source; do not call a spike or empty page the production app. | Fresh-environment installation, build stdout/exit, browser view and versions. [ROADMAP.md D1/D9](../ROADMAP.md); [NEXT_ENGINEERING_TASK.md Implementation Items and Acceptance](../NEXT_ENGINEERING_TASK.md) |

<!-- english-original-anchor --> <a id="scene"></a>
### scene

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-SCN-01／P0 | **Scene v1 and positive/negative domain cases**: SI, right-handed +Y/-Z, xyzw unit quaternion, unique IDs and valid cross-references; reject NaN/Infinity, duplicate IDs, dangling refs, negative mass and invalid geometry. Only box/sphere/capsule; sphere has equal diameters on all three axes; 256 objects/32 sources/one listener; dimensions 0.01..100m, position ±200m, mass 0.001..10000kg. | Schema and independent literal negative domain cases; real host API. [DATA_CONTRACTS.md Scene/Material](../02-architecture/DATA_CONTRACTS.md); [scene.schema.json Entire File](../../../schemas/scene.schema.json); [NEXT_ENGINEERING_TASK.md Global Limits/Review focus](../NEXT_ENGINEERING_TASK.md) |
| V1-SCN-02／P0 | **Atomic transactions, revision and Undo**: failure of any operation in a multi-operation transaction rolls back everything; explicitly reject STALE_REVISION and UNKNOWN_ID. Do not mutate inputs or the existing scene; commit/undo revision increases monotonically, and stable IDs do not depend on array order or engine handles. | Original Scene acceptance in an independent process plus new negative transaction cases. [DATA_CONTRACTS.md Scene/Material](../02-architecture/DATA_CONTRACTS.md); [scene-host-acceptance.mjs Original Frozen Acceptance](../../../examples/agents/scene-host-acceptance.mjs) |
| V1-SCN-03／P0 | **Import/export, Reset and resource cleanup**: roundtrip preserves all IDs, units and source/listener metadata; invalid import preserves the old scene. Pause does not step; reset returns to the starting point of the current document revision; repeated reset/import/dispose leaves no world, queue, geometry/material or multiple RAFs behind. | Host roundtrip plus browser reset 10 consecutive times/resource counts. [NEXT_ENGINEERING_TASK.md Acceptance/Review focus](../NEXT_ENGINEERING_TASK.md) |

<!-- english-original-anchor --> <a id="physics"></a>
### physics

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-PHY-01／P0 | **Fixed step and overload policy**: fixedDt=1/60s; 30/60/144Hz render does not change fixed-step results; render only interpolates. Interactive catch-up≤4, with telemetry for discarded wall-time; record/A-B overload pauses without dropping simulation ticks. | Compare multiple render cadences from the same initial state plus overload trace. [PHYSICS_ARCHITECTURE.md Fixed Step and Clocks](../04-physics/PHYSICS_ARCHITECTURE.md); [PERFORMANCE_BUDGET.md catch-up Policy](../06-validation/PERFORMANCE_BUDGET.md) |
| V1-PHY-02／P0 | **Four body modes and transitions**: real Rapier demonstrates that Gravity on/off preserves velocity, NoGravity still responds to impulse/contact, Fixed is unaffected by forces, and Kinematic uses next pose with trajectory clearance validation. Lock/Unlock defaults to zero velocity and restores the original gravity mode; transitions clear controllers/old contacts and record discontinuity; delete/undo does not reuse invalid handles. | Real WASM mode/transition matrix plus browser operations. [OBJECT_STATES.md §2–4 and Acceptance](../04-physics/OBJECT_STATES.md); [NEXT_ENGINEERING_TASK.md Four modes](../NEXT_ENGINEERING_TASK.md) |
| V1-PHY-03／P0 | **FPS character collision and movement**: upright capsule character, normalized WASD diagonals, effective wall/slope/doorway collisions; camera does not move directly through geometry. Accept view input only after pointer lock succeeds; provide usable controls without locking. | Real Rapier character cases plus browser keyboard/mouse/alternative controls. [ROADMAP.md D2](../ROADMAP.md); [FPS_INTERACTION_SPEC.md §1–3](../04-physics/FPS_INTERACTION_SPEC.md) |
| V1-PHY-04／P0 | **Bounded, wall-safe grabbing**: Held does not change Dynamic mode, mass, gravity or collision groups; finite impulse/torque servo, target sweep+overlap excludes self but retains walls/player/other objects. Target may lag when blocked and shows the reason; no parenting to camera, teleporting through walls or disguising Kinematic as Dynamic. | Real WASM at 0.1/1/5/20kg, thin walls/corners/stacks/low FPS/NoGravity; record penetration/tracking/force saturation/blocked. [PHYSICS_ARCHITECTURE.md Grabbing/target clamp](../04-physics/PHYSICS_ARCHITECTURE.md); [FPS_INTERACTION_SPEC.md Grabbing](../04-physics/FPS_INTERACTION_SPEC.md) |
| V1-PHY-05／P0 | **Drop/Throw semantics and deduplication**: Drop adds no impulse and preserves the instantaneous solver velocity and NoGravity; Throw removes the controller, then applies a single finite COM impulse in the same tick. Resending commandId does not throw again; velocity/clearance/CCD is bounded; the click that acquires lock does not throw. | Explicit intent events plus WASM velocity/impulse assertions plus browser lock click. [FPS_INTERACTION_SPEC.md §4](../04-physics/FPS_INTERACTION_SPEC.md); [INPUT_CONTROLS.md Grab/Throw Controls](../04-physics/INPUT_CONTROLS.md); [OBJECT_STATES.md Held](../04-physics/OBJECT_STATES.md) |
| V1-PHY-06／P0 | **Pause/focus and Listener restoration**: Esc/blur/hidden clears input and safely pauses, cancels uncommitted throw, preserves Held/ghost and stops control impulses; no hidden Drop or automatic Resume. Resume first revalidates generation/collider/grip/clearance, then ramps; editor camera does not silently modify Pinned Listener; exiting FPS restores Pinned pose, velocity=0 and records discontinuity. | Browser blur/visibility/lock/IME trace plus fixedstep controller/state assertions. [INPUT_CONTROLS.md §2/6](../04-physics/INPUT_CONTROLS.md); [OBJECT_STATES.md Grab Contact and Sleep](../04-physics/OBJECT_STATES.md); [FPS_INTERACTION_SPEC.md Listener](../04-physics/FPS_INTERACTION_SPEC.md) |

<!-- english-original-anchor --> <a id="build"></a>
### build

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-BLD-01／P0 | **Three stages: Ghost/Staged/Active**: Ghost has no active body/source; Place revalidates at a safe fixed step and atomically creates Staged; wait for geometry ack before explicit Enable, then Resume separately. Surface support and shape query reject overlap; invalid/stale/racing occupancy/repeated clicks leave no partial object, duplicate IDs or unintended source. | Browser placement plus document/body/source/revision counts plus WASM shape queries. [FPS_INTERACTION_SPEC.md §5](../04-physics/FPS_INTERACTION_SPEC.md); [OBJECT_STATES.md §1](../04-physics/OBJECT_STATES.md); [FPS_INTERACTION_UX.md First-Person Build](../05-ux/FPS_INTERACTION_UX.md) |

<!-- english-original-anchor --> <a id="events"></a>
### events

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-EVT-01／P0 | **Reliable normalized physics events**: copy temporary contact values after the step; record tick/sequence/materialPair/worldContact using domain IDs/generation/episode. Point velocity=vCOM+omega×r; correct local→world and collider normal direction; do not mix force N/impulse Ns; missing values are null. | Real Rapier multicontact/rotation/collider ordering fixtures and unit assertions. [EVENT_MODEL.md Entire File](../10-sound-behaviors/EVENT_MODEL.md); [PHYSICS_AUDIO_EVENTS.md contact extraction/aggregation](../04-physics/PHYSICS_AUDIO_EVENTS.md) |
| V1-EVT-02／P0 | **Impact deduplication and invalidations**: support/persistent contact does not emit impact every tick; sensible multipoint aggregation, bounded episode/cooldown/hysteresis. Mode/delete/teleport/replay invalidation does not fabricate a bounce or new impact; audible voice drop does not delete raw event trace. | single impact/resting/microjitter/multiobject/held-wall/pause/mode/CCD fixtures. [EVENT_MODEL.md Impact/episodes](../10-sound-behaviors/EVENT_MODEL.md); [PHYSICS_AUDIO_EVENTS.md Deduplication and Classification](../04-physics/PHYSICS_AUDIO_EVENTS.md) |

<!-- english-original-anchor --> <a id="behavior"></a>
### behavior

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-SND-01／P0 | **Ordering/deduplication and orthogonal state**: event order is defined by tick/sequence; resending eventId does not replay it; each binding of a shared profile has independent runtime state. AlwaysOn continues through movement, Impact, Grab/Throw and NoGravity; Held/contact and other dimensions can coexist; Throw/Drop comes only from successful interaction. | Fixed golden event trace, same-tick different-sequence, resend and multiple-binding fixtures. [NEXT_AUDIO_MILESTONE.md Non-Relaxable Acceptance 1–3](../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md) |
| V1-SND-02／P0 | **Bounded mappings and valid references**: mapping/fade/cooldown have ranges/units, curve has strictly ordered x and clamp; effective enabled/overrides are correct. Reject NaN/Infinity, missing asset/rule, stale scene/profile/binding revision; no eval of arbitrary JS. | Positive/negative fixtures plus runtime extreme-value/disabled override tests. [NEXT_AUDIO_MILESTONE.md Non-Relaxable Acceptance 4](../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md); [behavior-document.schema.json draft v1](../../../schemas/sound-behavior/behavior-document.schema.json) |
| V1-SND-03／P0 | **Sound budgets and deterministic admission**: continuous and one-shot lifecycles are separate but subject to the same effective budget; priority/stableID tie-break determines drop/steal and records the reason. Enforce instance/voice, active emitter and path/decoded-memory limits separately; overload does not cause unbounded queue/allocation. | event burst/over-cap/cleanup/equal-priority ordering fixtures and browser telemetry. [NEXT_AUDIO_MILESTONE.md Non-Relaxable Acceptance 5](../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md); [SOUND_BEHAVIOR_ARCHITECTURE.md Resource Budgets](../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md) |
| V1-SND-04／P0 | **Snapshots/epochs and decision replay**: pause does not advance logical tick; reset/seek changes epoch and clears old dedup/deadline/schedule. Saving state and reevaluating the same raw trace produces the same logical decisions; do not serialize AudioNode/Rapier objects. | golden snapshot/resume/replay plus negative stale-epoch cases. [NEXT_AUDIO_MILESTONE.md Non-Relaxable Acceptance 6–7](../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md); [RECORD_REPLAY.md Sound Behavior extension](../07-experiments/RECORD_REPLAY.md) |
| V1-SND-05／P1 | **Contact/bounded latch/material pair layers**: rolling/sliding uses contact and relative point velocity/angular velocity, with hysteresis; missing support data returns unknown, rather than treating all translation as rolling. OnThrow-start/OnImpact-stop bounded latch has stopOn/retrigger/deadline and is not replaced with WhileAirborne; materialpair overrides remain subject to finite generator and voice limits. | rotating support/slip/held/mode/CCD/latch deadline/retrigger/layer trace tests. [RLAB-TASK-0013.json AC-01/02](../../../knowledge/tasks/RLAB-TASK-0013.json); [EVENT_MODEL.md Rolling/Sliding/Bounce](../10-sound-behaviors/EVENT_MODEL.md); [MUSE_SOUND_BEHAVIOR_INTEGRATION.md latched semantics](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-SND-07／P0 | **Safe manual authoring and Apply/Undo**: draft→validate→diff→pause/fade/drain→atomic new revision/new epoch; commit derivedAssetPins with the operations, with an inverse for Undo. Invalid/stale preserves the draft and old configuration; list affected bindings for shared profiles; do not claim seamless retired-profile voices. | Positive/negative domain transaction cases plus browser Apply/Cancel/Undo. [SOUND_BEHAVIOR_UX.md §3](../05-ux/SOUND_BEHAVIOR_UX.md); [MUSE_SOUND_BEHAVIOR_INTEGRATION.md Trusted pins and v1 Apply](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |

<!-- english-original-anchor --> <a id="assets"></a>
### assets

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-SND-06／P0 | **Trusted asset import/selection and generation**: asset ID/revision/SHA and rights/availability come from the trusted registry; fixture-only cannot serve as production audio; the model does not supply arbitrary paths/URLs. Support usable sample/loop and simple oscillator/envelope; continuous instances preserve playhead, new one-shots create new sources, decoded buffers can be reused; creative content is not labeled Measured vibration. | Real audio file decode/playback and negative registry cases plus deterministic synth references. [SOUND_BEHAVIOR_ARCHITECTURE.md Audio generation/assets](../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md); [MUSE_SOUND_BEHAVIOR_INTEGRATION.md Trusted pins and v1 Apply](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |

<!-- english-original-anchor --> <a id="acoustics"></a>
### acoustics

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-ACO-01／P1 | **Real direct path/occlusion**: the product solver uses actual source/listener/geometry to calculate t=r/c, 1m reference pressure 1/r and finite segment occlusion; r=0 has explicit rejection or sourced regularization. Source movement or blocker changes update real paths; UI decorative lines cannot substitute for solving. | 3-4-5 literal fixture plus blocker cases plus real browser path inspector. [ROADMAP.md D5](../ROADMAP.md); [ACOUSTIC_VALIDATION.md ACO-001/002](../06-validation/ACOUSTIC_VALIDATION.md) |
| V1-ACO-02／P1 | **Finite first-order ISM reflections and path identity**: reflection point is inside a finite polygon, with blockers checked on every segment; first-order path carries real vertices/length/absolute delay/relative delay/arrival direction. ID is determined by source/listener/ordered surfaces/model, excluding coordinates or rank; arrival points from listener toward the penultimate vertex. | Fixed first-order sqrt20, outside-polygon and reflection-blocker negative cases, 1mm continuity; may compare with an independent reference. [ROADMAP.md D5](../ROADMAP.md); [DATA_CONTRACTS.md AcousticFrame](../02-architecture/DATA_CONTRACTS.md); [ACOUSTIC_VALIDATION.md ACO-002/003](../06-validation/ACOUSTIC_VALIDATION.md) |
| V1-ACO-03／P1 | **Material/atmosphere/model labels**: per-band A+R+T=1, finite/[0,1]; scattering only redistributes R, and pressure magnitude follows the declared phase/impedance approximation. Demo materials are labeled Synthetic; the air model has a source/applicability conditions; gravity0 does not mean vacuum, and vacuum does not eliminate mechanical collision; do not claim compliance with unverified ISO. | Band energy literal fixtures, air conversion, invalid material and medium tests. [ROADMAP.md D6](../ROADMAP.md); [DATA_CONTRACTS.md Scene/Material](../02-architecture/DATA_CONTRACTS.md); [ACOUSTIC_VALIDATION.md MAT-001/AIR-001](../06-validation/ACOUSTIC_VALIDATION.md) |
| V1-ACO-04／P1 | **AcousticFrame and worker boundaries**: frame includes source/listener/revision/poseTick/solver version and capabilities; stale or mismatched frames are not applied. Bounded bounds/backpressure and cancellation; distinguish unsupported/empty paths/0/incomplete; do not fabricate substitutes without IR/individual-path capability. | Real worker/message/queue/cancel/stale-frame tests and UI states. [DATA_CONTRACTS.md AcousticFrame](../02-architecture/DATA_CONTRACTS.md); [PERFORMANCE_BUDGET.md worker/delivery](../06-validation/PERFORMANCE_BUDGET.md) |

<!-- english-original-anchor --> <a id="audio"></a>
### audio

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-AUD-01／P0 | **Unified SourceGraph and processing once**: all 3D continuous/contact emission passes through the same Acoustic Core route; contact sources use world contact rather than fixed COM. Add absolute propagation delay once per emission epoch; do not duplicate 1/r, air/material, HRTF or Doppler; reflected HRTF uses the final segment's apparent direction. | Real OfflineAudioContext impulse arrival/gain/direction/routing assertions plus browser graph. [AUDIO_RUNTIME.md SourceGraph/Scheduling](../02-architecture/AUDIO_RUNTIME.md); [DATA_CONTRACTS.md AcousticFrame](../02-architecture/DATA_CONTRACTS.md) |
| V1-AUD-02／P0 | **Continuous sources and smooth updates**: grabbing/collision/NoGravity does not rebuild continuous sources or reset phase; source/listener/path updates use stable IDs with smooth gain/delay. Path birth/death/voice steal has audio-clock fade; callback does not wait for AI/network/physics/geometry or perform unbounded allocation/log. | Real graph continuous source identity/playhead, parameter ramps, burst/dispose tests. [AUDIO_RUNTIME.md Continuous Sources/path bank/Parameter Smoothing](../02-architecture/AUDIO_RUNTIME.md) |
| V1-AUD-03／P0 | **Pause/Resume audio time**: Freeze-and-fade preserves logical offsets/event cursor/pending arrivals and cancels the old epoch; Resume reanchors and schedules only not-yet-arrived events once. Seek/reset clears old scheduling; audition while paused uses a separate clock and is excluded from run/metrics. | OfflineAudioContext arrival/duplication tests plus browser pause/seek trace. [AUDIO_RUNTIME.md Pause/Resume](../02-architecture/AUDIO_RUNTIME.md); [RECORD_REPLAY.md Time and Storage](../07-experiments/RECORD_REPLAY.md) |
| V1-AUD-04／P1 | **Raw/Simulated and basic reverb**: Raw/Simulated uses the same asset/event/seed/playhead/gain without changing the run; route crossfade uses the audio clock. Basic reverb is explicitly a perceptual approximation; whether IR includes direct/distance/air/material/normalization is inspectable; Convolver automatic normalization must not conceal energy validation. | Real offline graph energy/arrival/normalization tests plus browser route switching. [ROADMAP.md D6](../ROADMAP.md); [AUDIO_RUNTIME.md Monitor/IR/normalization](../02-architecture/AUDIO_RUNTIME.md); [AB_COMPARISON.md Reports](../07-experiments/AB_COMPARISON.md) |

<!-- english-original-anchor --> <a id="ux"></a>
### ux

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-UX-01／P0 | **Workspace/Transport and data authority**: switching Scene/Simulation/Analysis does not Reset run/source/recording; Run/Pause/Resume/Reset have distinct semantics, and Reset preserves completed results and labels interrupted capture. Scene Explorer/Library/Inspector/Transport/Monitor and precise numeric inputs are usable, showing units/revision/tick and actionable errors. | Real browser workflow U01–U08/command trace. [WORKSPACE_ARCHITECTURE.md Orthogonal State/Acceptance](../05-ux/WORKSPACE_ARCHITECTURE.md); [COMPONENT_SPEC.md P0 Components](../05-ux/COMPONENT_SPEC.md) |
| V1-UX-02／P0 | **Shared selection and real data visualization**: 3D/table/Inspector share stable object/path/event IDs; sorting/deleting/stale results does not select another object incorrectly. Draw only solver-generated paths and show model/source/units/stale/revision; distinguish unsupported/empty/unavailable/0. | Browser linked-selection plus stale frame/empty capability cases. [WORKSPACE_ARCHITECTURE.md Selection/Capability](../05-ux/WORKSPACE_ARCHITECTURE.md); [COMPONENT_SPEC.md Integration Acceptance](../05-ux/COMPONENT_SPEC.md) |
| V1-UX-03／P0 | **FPS input arbitration and safe exit**: pointer-lock acquisition click does not Throw/Place; Esc/blur/hidden safely pauses; Tab navigates normally and browser shortcuts remain available. Input/contenteditable/Chinese IME owns keystrokes; keydown repeat does not repeat throw/fix/create; provide alternatives without lock or dragging. | Browser composition/focus/keyboard/lock-denied/action-log tests. [FPS_INTERACTION_UX.md Entry/Focus/Exit and MVP mappings](../05-ux/FPS_INTERACTION_UX.md); [UI_STRESS_TESTS.md UX-STRESS-10/14/18](../05-ux/UI_STRESS_TESTS.md) |
| V1-UX-04／P0 | **Sound Inspector authoring/diagnostics**: add/enable/disable rules, valid trigger/asset, gain/pitch/curve and preset/binding override; show contact emitter and suppression/voice reasons. Audition/3D preview/run are separate; changing selection does not silently lose drafts; error/stale/disabled has actionable explanations; Apply/Undo matches runtime version. | Real browser rule editing and audio/event/instance trace. [SOUND_BEHAVIOR_UX.md §§2–5 / SB-UX-01..06](../05-ux/SOUND_BEHAVIOR_UX.md) |
| V1-UX-05／P0 | **Accessibility/reflow/motion**: usable native controls/visible focus/accessible names/dialog focus-return/keyboard controls; no per-tick aria-live flooding. Mute/Pause/exit/forms remain reachable at 200% and 320CSSpx; Reduced Motion does not delay commands; tokens use canonical values, and color/animation cannot be the only state cue. | Real browser keyboard/dialog/zoom/reflow/reduced-motion/contrast checks. [DESIGN_SYSTEM.md Accessibility/Layout and Zoom/Motion](../05-ux/DESIGN_SYSTEM.md); [COMPONENT_STATES.json profiles/commonStates](../../05-ux/COMPONENT_STATES.json); [UI_STRESS_TESTS.md UX-STRESS-08/09/18](../05-ux/UI_STRESS_TESTS.md) |
| V1-UX-06／P0 | **Monitor and audio exposure states**: muted by default, enabled through user gesture; Mute/gain remains visible, and Mute does not stop simulation. Distinguish blocked/error/source stop; dBFS does not claim SPL or headphone safety calibration; events have text/visual alternatives. | Browser autoplay/gesture/mute test and actual sound-state confirmation. [DESIGN_SYSTEM.md Accessibility and Audio Exposure](../05-ux/DESIGN_SYSTEM.md); [WORKSPACE_ARCHITECTURE.md Monitor](../05-ux/WORKSPACE_ARCHITECTURE.md) |

<!-- english-original-anchor --> <a id="recording"></a>
### recording

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-RPL-01／P1 | **Traceable capture and finalization**: save tick-indexed motion/velocity/listener/raw physics-player trace and separate behavior/audio decisions, linked to scene/profile/assets/solver versions and hashes. Correct final state flush/chunk count/hash; reject missing ticks/duplicate sequence/invalid quaternion/unresolved refs; cancel/crash must not produce a Captured incomplete manifest. | Real runtime capture, format-corruption/cancel/crash fixtures, serialized size and quota measurements. [RECORD_REPLAY.md Time and Storage/Sound Behavior extension](../07-experiments/RECORD_REPLAY.md) |
| V1-RPL-02／P1 | **Authoritative replay and seek**: authoritative motion replay reuses saved motion/raw events; physics does not redetermine the path; listener/source time series are consistent. Pause/resume/seek/reset uses a new epoch and explicit tail policy without replaying impact; preserve the distinction between recorded-output and behavior reevaluation modes. | end-to-end record/replay/hash compare/audio event counts. [RECORD_REPLAY.md Three Modes and Acceptance](../07-experiments/RECORD_REPLAY.md) |
| V1-RPL-03／P1 | **Pinned resimulation evidence**: same initial snapshot, same Rapier/WASM, seed/creation order/fixedDt; rerun 120ticks twice on the same machine and compare state hashes/explicit errors. Passing on one machine does not imply cross-platform bitwise equivalence; fresh physics rerun uses a new run/motion trace. | Real WASM two-run 120tick snapshot regression. [RECORD_REPLAY.md Acceptance](../07-experiments/RECORD_REPLAY.md) |

<!-- english-original-anchor --> <a id="analysis"></a>
### analysis

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-AB-01／P1 | **Fixed conditions for Acoustic A/B**: same motion/source signal/listener/geometry/seed/sampleRate/window/backend/solver/analysis; change only declared acoustic material or propagation; otherwise return INCOMPATIBLE. Retain original values, candidate−baseline, units/band/window/artifact; baseline0 percentage is unavailable; normalized listening does not imply absolute energy. | Real run manifests/hash gates and negative numeric-delta cases. [AB_COMPARISON.md Comparability Conditions and Reports](../07-experiments/AB_COMPARISON.md) |
| V1-AB-02／P1 | **Behavior A/B independent variables**: fix motion/raw physicsEvent/listener/geometry/physics/solver/atmosphere/propagation; allow only declared asset/generator/gain/pitch/profile changes and retain both hashes. Behavior decisions may differ; do not call creative sample differences improved wall RT; explicitly return CAPABILITY_UNSUPPORTED when unsupported rather than pretend comparison is complete. | Real authoritative replay with two profiles plus negative comparison-metadata cases. [AB_COMPARISON.md Sound Behavior A/B](../07-experiments/AB_COMPARISON.md); [behavior-document.schema.json SoundBehaviorComparison](../../../schemas/sound-behavior/behavior-document.schema.json) |
| V1-MET-01／P1 | **Grounded metrics and rejection without data**: produce supported metrics only from solver/PCM/RIR artifacts, including method/window/unit/band/provenance; separate Computed/Estimated/Measured/AI explanation. Insufficient decay or fit<3sample returns null/reason; do not generate RT60/SPL from ordinary music or AI; without V5, do not label as measured. | Independent synthetic impulse/EDC/0.6s decay fixtures and artifact missing/tamper/insufficient-data negative cases. [AI_EXPERIMENT_AGENT.md Reproducible Experiments and Provenance Labels](../08-ai/AI_EXPERIMENT_AGENT.md); [ACOUSTIC_VALIDATION.md RIR/DSP Boundaries](../06-validation/ACOUSTIC_VALIDATION.md); [AB_COMPARISON.md Reports](../07-experiments/AB_COMPARISON.md) |

<!-- english-original-anchor --> <a id="ai"></a>
### ai

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-AI-01／P1 | **Safe host for the original 12 tools**: do not silently change the original tool enum; scene proposals only stage; host validates schema/domain/revision/authorization before preview, with explicit and idempotent Apply/Cancel/Undo. RunSimulation queued≠complete; immutable input/run ledger/cancel/timeout works; manual editing does not depend on API. | OfflineFixtureProvider/recorded response labels plus real host transaction/run tests. [AI_TOOL_SCHEMAS.md 12 tools](../08-ai/AI_TOOL_SCHEMAS.md); [AI_SCENE_CONTROL.md preview/apply/undo](../08-ai/AI_SCENE_CONTROL.md); [AI_EXPERIMENT_AGENT.md Roles and Data Flow](../08-ai/AI_EXPERIMENT_AGENT.md) |
| V1-AI-02／P0 | **Safe host for Behavior proposals**: five new operations remain separate from the old 12enum; reject unknown/JS/URL/asset/trigger/stale generation; derived pins and operations commit atomically with Undo. Traceable proposal→preview/diff→user Apply→actual runtime artifact; the model has no OS/shell/repo permissions and cannot approve itself. | Real host tool positive/negative fixtures/duplicate proposal/shared-profile migration/Undo. [MUSE_SOUND_BEHAVIOR_INTEGRATION.md Machine Contract/Required Host Validation/Trusted pins](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-AI-03／P0 | **Provider boundaries, budgets and errors**: strict provider schema adapter is separate from local AJV/domain; stage only after complete arguments, with controlled outcomes for model text/no-tool/refusal/truncation. Host manages 12turns/48calls/6runs/concurrency1/120s/session and token/runtime caps; paid spending defaults to 0, with no Muse allowance used; distinguish 401/403/billing/429/outage and allow at most 2 retries for transient errors. | Provider contracts/fixture fault injection plus budget/cancel/unknown mutation result ledger tests. [AI_EXPERIMENT_AGENT.md Run States and Stop Conditions](../08-ai/AI_EXPERIMENT_AGENT.md); [MUSE_SOUND_BEHAVIOR_INTEGRATION.md Meta adapter/Failures and Acceptance](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-AI-04／P0 | **Model explanations cite only real results**: every number links to an actual metricRecord/artifact; reject missing/tampered references; AI does not fabricate assets, acoustic measurements, run success or global optimum. Clearly label offline fixture/recorded/live provenance; the same authoring and experiment workflow remains manually completable if the model fails. | Artifact removal/rewriting/misleading prompts and manual fallback E2E. [AI_EXPERIMENT_AGENT.md Grounding](../08-ai/AI_EXPERIMENT_AGENT.md); [MUSE_SOUND_BEHAVIOR_INTEGRATION.md Demonstrable Controlled Experiments](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-AI-05／EXTERNAL_GATE | **Real Meta product integration**: after verifying account/model/source/explicit finite budget, retain actual Meta response/model ID, redacted tool trace, preview/Apply and real runtime run/results. Codex development, Mock, MuseCode CLI or other model outputs cannot clear this gate; no automatic top-up/cap increase/switch to an unauthorized account. | Authorized real Meta end-to-end trace; record BLOCKED or NOT RUN without account/budget. [RLAB-TASK-0014.json AC-02](../../../knowledge/tasks/RLAB-TASK-0014.json); [RLAB-TASK-0007.json account/eligibility](../../../knowledge/tasks/RLAB-TASK-0007.json); [MUSE_SOUND_BEHAVIOR_INTEGRATION.md Real Meta Integration and Competition Demonstration](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |

<!-- english-original-anchor --> <a id="verification"></a>
### verification

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-VAL-01／P0 | **Frozen acceptance and independent review**: original tests/fixtures/reference/schema hashes do not change because of implementation; a defect in original acceptance requires independent review and a new version/rationale, not changing expected/tolerance to rush completion. Independent processes retain command/exit/stdout/stderr/version/hash; isolated review includes reproduced defects, fixes and retesting, rather than only self-declaration by the same model. | Protected hash comparison plus original regression plus new product tests plus isolated review. [VALIDATION_POLICY.md Entire File](../09-agents/VALIDATION_POLICY.md) |
| V1-VAL-02／EVIDENCE_GATE | **Browser/DSP/E2E and clean relaunches**: real browser validates input/view/cleanup and product chain; real OfflineAudioContext validates arrival/energy/continuity/voice cleanup, not Node formulas as a substitute. Reproducible end-to-end scene→throw→impact→sound→capture→A/B; three clean relaunch demonstrations retain failures/console records. | Browser artifacts, offline PCM analysis, 3 clean-launch E2E runs. [ROADMAP.md D9](../ROADMAP.md); [VALIDATION_POLICY.md frontend/audio Acceptance](../09-agents/VALIDATION_POLICY.md); [RLAB-TASK-0012.json AC-03](../../../knowledge/tasks/RLAB-TASK-0012.json) |
| V1-VAL-03／EVIDENCE_GATE | **Actual-device listening and cross-browser tests**: specify browser/OS/hardware/headphones/sampleRate/actual block, and actually check click/pop, volume jump, moving position, dropout and Pause/Resume. Explicitly mark untested device/hearing/crossbrowser checks NOT RUN; audible PCM, code review or smooth UI cannot imply PASS/V5/calibrated SPL. | Actual device records and cross-browser comparison; retain limitations when no observer/device is available for verification. [ROADMAP.md D9](../ROADMAP.md); [VALIDATION_POLICY.md Audio Device Listening Tests](../09-agents/VALIDATION_POLICY.md); [BENCHMARK_PLAN.md V2/V4/V5](../06-validation/BENCHMARK_PLAN.md) |

<!-- english-original-anchor --> <a id="performance"></a>
### performance

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-VAL-04／EVIDENCE_GATE | **Formal performance profiles and degradation**: formal profiles measure UI/physics/worker/delivery/audio separately; Node batch averages do not stand in for frame tails or schema capacity. Retain 10min UI trace and hardware/viewport/scene/voice/paths versions; unmeasured items remain TARGET/UNVERIFIED; degradation shows capability/stale and actual caps. | Canonical profile benchmark and telemetry; native nodes do not justify claiming AudioWorklet p99 passes. [PERFORMANCE_BUDGET.md Initial Engineering Targets/Performance Degradation](../06-validation/PERFORMANCE_BUDGET.md); [PERFORMANCE_STANDARDS.md Measurement metadata](../05-ux/PERFORMANCE_STANDARDS.md) |

<!-- english-original-anchor --> <a id="provenance"></a>
### provenance

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-OPS-01／P0 | **Wiki/Task/handoff/Git persistence**: use the same Task/Wiki; criteria become DONE only with actual hash evidence; release claims and update source versions/current state/limits/next steps. Preserve uncommitted changes and old evidence; checkpoint/handoff carries real commands/Git provenance; local commits are recoverable, with no unauthorized push/deploy. | wiki lint/status, task/evidence hashes, fresh handoff reader, git diff/log. [AGENTS.md Session Startup/Authorization and Completion Definition](../AGENTS.md); [schema.md Task and Operations](../knowledge/schema.md) |

<!-- english-original-anchor --> <a id="compliance"></a>
### compliance

| ID / Priority | Passing Conditions | Evidence / Authoritative Sources |
| --- | --- | --- |
| V1-COM-01／EXTERNAL_GATE | **Rights/rules/publication authorization**: actual dependencies/materials/sound effects/HRTF have license/version/hash/NOTICE; do not copy EchoCanvas/Reflections core or unauthorized commercial assets. Public codingagent terms are UNSTATED; personal eligibility/logged-in terms/submission fields still require verification; do not accept terms, deploy, submit or decide the root LICENSE on the user's behalf. | Actual dependency/asset manifest and external user confirmation; development completion does not establish competition compliance. [AGENTS.md Authorization and Safety](../AGENTS.md); [HACKATHON_RULES.md 2026-10-27 Recheck](../01-compliance/HACKATHON_RULES.md); [LICENSE_REGISTER.md register](../01-compliance/LICENSE_REGISTER.md) |

<!-- english-original-anchor --> <a id="p2明確延期"></a>
## P2 Explicitly Deferred

Node-based Behavior Graph, modal/complex procedural synthesis, advanced sound layering/AI optimization, production reflections of second-order and above, diffraction/wave solver/advanced impedance, dynamic reflectors, complete free physics/cross-platform bitwise replay, Steam Audio browser backend, jump/crouch/push tools. Retain existing analytical regressions and capability rejection; passing research does not establish product support.

<!-- english-original-anchor --> <a id="規格差異與解讀"></a>
## Specification Differences and Interpretation

- **V1-CON-01** The old Phase3 Harness preferred=MUSE/only-src/dependency prohibition conflicts with current full Codex implementation: ADR013 and the latest user authorization take precedence; retain the old profile as history and still use the original Scene literal acceptance; package-lock may update for authorized new dependencies.
- **V1-CON-02** The P0-01 document prohibits adding FPS/audio/AI alongside it, with a different scope from the overall first-version Roadmap: that prohibition applies only to the P0-01 slice; the complete first version still includes D2–D8 and Task0012–0014, which cannot be excluded on this basis.
- **V1-CON-03** Sound UX candidate P0 triggers are broader than the latest Roadmap minimum vertical: AlwaysOn/Impact first; Grab/Throw/Airborne needs FPS prerequisites and subsequent Task0013 acceptance; an enum's existence does not establish executability.
- **V1-CON-04** Schema has no room/cylinder/label and requires a listener; UI stress includes empty-scene/name cases: room is composed of valid box walls; label is limited to temporary UI storage or requires a separate version decision; listenerless is a draft/invalid-import negative case and cannot silently relax Scene v1.
- **V1-CON-05** Early Workspace two-stage terminology versus detailed Build three-stage flow: follow Ghost→PlacementPending→Staged→explicit Active; geometry ack and Resume cannot be omitted.
- **V1-CON-06** Performance proposes several configurations/latency targets, not yet measured: numerical authority is exclusively PERFORMANCE_BUDGET; UI p95≤50/p99≤100ms remains PROPOSED, and desktop-60 configuration is not a capacity guarantee.
- **V1-CON-07** Keep the old 12AI tools/Scene/Experiment v1 separate from new Sound proposal/comparison drafts: do not silently extend the old enum or claim cross-document atomic transactions; use explicit version adapters, with separate gates for the two A/B types.
- **V1-CON-08** Task0012 AC03 includes listening tests, and Task0014 AC02 requires real Meta; no live resource evidence currently exists: offline/built/fixture cannot count as DONE. Complete independently feasible work, retain that AC as BLOCKED/NOT RUN and state exact clearing conditions.
- **V1-CON-09** Research/unauthorized statuses in existing source material have been superseded by new implementation authorization: retain history and research documents; root updates new status/Now from actual implementation/tests; this matrix is not a gate requiring authorization reconfirmation.

<!-- english-original-anchor --> <a id="凍結與原命令"></a>
## Freeze and Original Command

Freeze original-byte SHA256 hashes of 61 existing tests/fixtures/contracts/references, and retain original criterion IDs/text for Task0006/0011–0014. See the machine-readable list for full paths and hashes; task status, owner and new evidence may update normally. Source document hashes are capture provenance and do not prohibit subsequent evidence-based status updates.

Original Scene-slice acceptance requires four synchronous exports from `src/scene-host.mjs` in the candidate workspace; a compatible adapter is allowed without changing the original acceptance:

```powershell
node examples/agents/scene-host-acceptance.mjs <candidate-workspace>
```

This command establishes only Scene pure host, not Rapier/browser/audio/Meta. Overall regression still requires `npm run check`; new production build/dev/test commands must be confirmed and documented after implementation, not guessed in this document. Original Optional Harness defaults of MUSE, only-file and no new dependencies belong only to the old profile; they should not block currently authorized React/R3F/build dependencies.

<!-- english-original-anchor --> <a id="數值效能與限制"></a>
## Numerical Values, Performance and Limitations

[PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md) is the sole authoritative source for performance numbers; UI60Hz/main p95<4ms/10min, physics1/60/p95<2ms/256bodies/catchup4, worker20Hz/p95<20ms/8sources32surfaces, deliveryp95<1ms/256paths and actual Worklet48k128frame/p99<1ms all still require measurements under the corresponding profiles. Native nodes can serve the MVP but must not be claimed as measured Worklet results. UI50/100ms candidate latency remains PROPOSED.

[Analytical fixed fixtures](../../../benchmarks/fixtures/analytical.json) retain original expected/tolerance: 3-4-5/material/air 1e-12, reflection 1e-10m, polygon epsilon 1e-9m, EDC 1e-10dB, synthetic 0.6s decay 5e-5s. These do not establish general mesh, ISO9613/3382, V3 independent solver or V5 room measurements.

No universal numerical thresholds for click/pop or wall penetration have been adopted; record actual values, methods, devices, sources and case-specific judgments rather than inventing permissive tolerances on the spot. The 20ms pause fade is an initial design value, and 0.01m skin is not an accepted penetration error.

This review only read specifications and frozen hashes; it did not execute product tests, real Meta models, browser or headphone listening tests. All requirements initially have evidence status NOT RUN; root must add real artifacts item by item, and missing items must not count as overall completion.
