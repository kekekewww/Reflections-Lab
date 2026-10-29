<!-- english-source: {"path":"docs/04-physics/PHYSICS_AUDIO_EVENTS.md","sha256":"0653712d397024845f278be654238785ed986ea722be415594338cbd533356bc","translated_at":"2026-10-27T03:39:48.816915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/04-physics/PHYSICS_AUDIO_EVENTS.md`](../../04-physics/PHYSICS_AUDIO_EVENTS.md). Source SHA-256: `0653712d397024845f278be654238785ed986ea722be415594338cbd533356bc`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="physics-to-audio-事件契約"></a>
# Physics-to-Audio Event Contract

Reviewed on: 2026-10-26. Status: data flow and deduplication design; an isolated Node/WASM smoke has verified some APIs, but actual audio has not yet been played and AudioWorklet has not yet been completed.

2026-10-27 Sound Behavior extension: this page remains authoritative for PhysicsStamp / contact / audio epoch; see [Event Model](../10-sound-behaviors/EVENT_MODEL.md) for authoring triggers, and [Physics Bridge](../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md) for the pinned Rapier0.21 mapping and new isolated probes. This does not mean the production sound runtime is complete, and does not change the pause / propagation clock.

<!-- english-original-anchor --> <a id="1-時間身分與所有權"></a>
## 1. Time, Identity, and Ownership

The physics world outputs a `TransformBatch` on every fixed step. After collision callbacks are read, copy their values immediately into plain data and pass them to the acoustic and audio sides. `TempContactForceEvent` / `TempContactManifold` must not be retained for asynchronous use outside the callback. [PA-01]

```typescript
type PhysicsStamp = {
  experimentId: string;
  sceneRevision: number;
  tick: number;
  simulationTimeSeconds: number; // tick * fixedDt；暫停不前進
  fixedDtSeconds: number;
  sequence: number;
};

type BodyPose = {
  objectId: string;
  generation: number;
  poseRevision: number;
  positionMetres: Vec3;
  rotation: Quaternion;
  linearVelocityMetresPerSecond: Vec3;
  angularVelocityRadiansPerSecond: Vec3;
  discontinuity: boolean;
};
```

`objectId / colliderId / surfaceId` are stable domain identifiers; Rapier handles are resolved only through lookup tables inside the runtime adapter. Observed handles include opaque values such as `5e-324`; do not treat them as ordinary incrementing integers or use them as cross-session IDs. `generation` prevents collision deduplication from mistaking a deleted and recreated object for the old object.

Production tick `0` is the initial state; after step `n→n+1` completes, the pose / contact stamp is `tick=n+1`, `simulationTime=(n+1)*h`. A contact onset timestamp has fixed-step precision; without substep data, it must not be described as an exact impact time. The independent smoke's loop index is used only to locate that result, not as the production emission clock.

`PhysicsStamp` represents simulation time only and is not equal to `AudioContext.currentTime`. The audio scheduler maintains `audioTime = epochAudioTime + (simulationTime - epochSimulationTime) + schedulingLead`. Pause uses Freeze-and-fade: freeze the logical tick, source offset, Held / ghost, and pending logical arrivals; fade out the run bus (`20 ms` is an initial value awaiting validation), cancel scheduling in the old epoch, truncate tails, and record an interrupted boundary. Resume creates a new epoch and reschedules the logical queue that has not yet arrived exactly once; it must not retrigger emissions already heard. AudioContext does not need to stop device time; paused audition uses an independent epoch and must not contaminate the original trace. Propagation delay is calculated separately from acoustic paths; record device latency, DSP latency, and propagation delay in separate fields rather than combining them into one timestamp.

<!-- english-original-anchor --> <a id="2-事件種類與最少欄位"></a>
## 2. Event Types and Minimum Fields

| Event | Content and Purpose |
| --- | --- |
| `TransformBatch` | Object / source pose, COM / source-offset velocity, listener pose / velocity, revision; used by direct sound, occlusion, reflection, and candidate Doppler models |
| `ContactBegin` / `ContactEnd` | Stable pair key, episode, start / end tick; these describe the contact lifecycle and do not automatically equal an audible impact |
| `ContactSample` | World contact position, normal, surfaces / materials on both sides, normal impulse, force diagnostics, and relative-velocity provenance |
| `ImpactCandidate` | A single trigger after thresholds, merging, and cooldown; identifies whether the data comes from the actual solver or approximate derivation |
| `FrictionLoopUpdate` | Contact episode, tangential velocity, support force, and candidate rolling/scraping type; smooths parameters instead of creating a new voice every step |
| `ContactInvalidated` | modeChange / delete / teleport / replayReset; clears state and fades, and must not masquerade as a new collision |
| `BodyModeChanged` | old/new mode, commandId, restorePolicy, discontinuity; used to interpret results |

Recommended complete `ContactSample`:

```typescript
type ContactSample = PhysicsStamp & {
  pairKey: string;                 // canonical domain collider IDs + generations
  episodeId: string;
  objectA: string; objectB: string;
  colliderA: string; colliderB: string;
  surfaceA: string; surfaceB: string;
  materialA: string; materialB: string;
  materialRevisionA: string; materialRevisionB: string;
  pointWorldMetres: Vec3;
  normalAtoB: Vec3;               // canonical orientation，正規化
  normalImpulseNewtonSeconds: number | null;
  impulseMethod: 'RapierContactImpulse' | 'ForceDtEstimate' | 'Unavailable';
  totalContactForceMagnitudeNewtons: number | null;
  maxContactForceNewtons: number | null;
  relativeVelocityMetresPerSecond: Vec3 | null;
  velocityMethod: 'PreStepRigidBodyEstimate' | 'PostSolveSample' | 'Unavailable';
  closingSpeedMetresPerSecond: number | null;
  tangentSpeedMetresPerSecond: number | null;
  representativePointMethod: 'GeometricContactMidpoint' | 'SolverRepresentative';
};
```

When the source attachment point is not at the COM, `v_source = v_COM + ω × (p_source - COM)`; listener velocity uses the fixed-step value appropriate to its control mode. Set velocity to zero and mark discontinuity for teleport, listener switching, and scene reset. A stationary source's Transform may be sent only when its revision changes; send active objects as a batch, and do not allow ordinary pose updates to overwrite important contact events.

<!-- english-original-anchor --> <a id="3-rapier-api-的實際語意"></a>
## 3. Actual Rapier API Semantics

Collision events require `ActiveEvents.COLLISION_EVENTS` to be enabled on at least one collider; contact-force events require `CONTACT_FORCE_EVENTS` and a reasonable threshold. These are separate queues. A contact-force event provides `totalForce()`, `totalForceMagnitude()`, `maxForceMagnitude()`, and `maxForceDirection()`, **with no direct contact-impulse field**. Total force magnitude is the sum of the magnitudes of individual contact forces, not the length of the total force vector. [PA-01][PA-02]

`world.contactPair(colliderA,colliderB, callback)` can read manifolds; `contactImpulse(i)` is the post-solve normal impulse of a geometric contact (N·s). `localContactPoint1/2(i)` are in each collider's local space and must be transformed to world coordinates using the corresponding collider pose; `normal()` is a world direction, which must then be adjusted according to callback `flipped` and the canonical A/B ordering. `solverContactPoint(j)` provides world coordinates, but `j` and the geometric contact's `i` belong to different index domains: **do not directly pair contactImpulse(i) with solverContactPoint(i) as if they correspond one-to-one**. [PA-03]

For each geometric contact, this project uses the midpoint of the world contact points on both sides as its representative position; impulses on the same surface patch may be merged, with position weighted by positive impulse. If only a solver representative is available, label the method as approximate rather than pretending it is the exact impulse application point. If a manifold cannot be obtained, set `normalImpulse=null`; if only force is available, an `F*h` proxy may be calculated separately and labeled `ForceDtEstimate`. Do not silently replace an unknown with zero. Intermediate contact data for multiple manifolds, multiple normals, and CCD in compound shapes may not all remain in the post-step state; the first version does not claim to provide a complete force time series for every micro-contact.

The following is isolated evidence that was actually executed: a 1 kg sphere falling to the ground, `h=1/60 s`, with force approximately `304.109741 N` and normal impulse read back at approximately `5.068496 N·s` on tick 30; after settling, each tick still has `9.81 N` of support force and `0.1635 N·s` of impulse. Therefore, “nonzero impulse” cannot be the condition for an impact sound effect. Sources are the [spike README](../experiments/physics-spike/README.md) and [pinned saved result](../../../experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json); `results.json` is an overwritable latest result, not immutable evidence for a fixed time. This is not an audio listening-test result.

<!-- english-original-anchor --> <a id="4-相對速度與強度估計"></a>
## 4. Relative Velocity and Intensity Estimates

Relative velocity at the same contact point is defined as `v_rel = v_B(point) - v_A(point)`, with the normal pointing from A to B, closing speed `v_close=max(0,-dot(v_rel,n))`, and tangential speed `v_tan=|v_rel-dot(v_rel,n)*n|`. Post-step velocity has already been reduced by the solver and must not masquerade as pre-impact velocity.

The initial version saves `pose,v,ω` before each step's solve, estimates rigid-body point velocity at the post-step contact position, and labels it `PreStepRigidBodyEstimate`. This estimate must not be treated as exact CCD pre-contact velocity obtained natively from a Rapier event; errors must be allowed for high speed, multiple contacts, or multiple collisions within one step. When only post-solve values are available, retain a different label and reduce confidence in the intensity judgment.

The demo's mass / velocity intensity proxy may use `E_proxy=0.5*μ*v_close²`, `μ=1/(invMassA+invMassB)` (treat the corresponding term for Fixed / Kinematic as 0; a denominator of 0 produces no candidate). This ignores eccentric rotation and contact coupling, and is used only to drive samples, not described as exact dissipated energy. If physical sound energy is needed, add effective mass including rotational inertia and a vibration model separately.

The sample-based MVP selects samples by material pair and spectral presets by object size, and controls gain and envelope with impulse / velocity proxies. `gain=saturate(k*log1p(J/Jref))` may be used as an adjustable perceptual mapping; `k,Jref` are author settings and must not be treated as dB SPL calibration. `SampleImpact` and future `ModalSynthesis` use different backend labels; playing a metal impact audio file must not be described as rigid-body vibration solving.

<!-- english-original-anchor --> <a id="5-去重遲滯與-cooldown"></a>
## 5. Deduplication, Hysteresis, and Cooldown

Deduplication has three layers: raw contacts, audible impacts, and voices. Preserve the raw trace for research; discarding an audible candidate must not be written back as “no collision.”

```text
after world.step:
  drain collision events -> update canonical pair episodes
  drain contact force events -> copy values, collect candidate pair IDs
  contactPair each relevant pair -> copy contacts, aggregate surfaces
  for each surface patch:
    merge same tick / pair / surface cluster
    onset = new episode or rearmedAfterSeparation
    eligible = onset && !discontinuity && J >= Jmin && closingSpeed >= vmin
    if eligible and tick-lastAudibleTick >= cooldownTicks:
      enqueue ImpactCandidate; update lastAudibleTick
    else update existing friction/rolling envelope, never start a new impact per tick
```

Recommended initial values (awaiting listening tests / measurement, not constant laws): `Jmin=0.02 N·s`, `vmin=0.15 m/s`, same-surface-patch distance `0.1 m`, pair cooldown `80 ms`, and separation of at least `2 ticks` before rearming. Low-speed contact may produce `ContactBegin` without sound. Another rapid strike during continuous contact may retrigger on a hysteretic rising edge of closing speed; this requires an impulse increment and cooldown, not merely a force peak. Actual small, rapid rebounds may be suppressed by cooldown, so results must identify the difference between the audible policy and raw trace.

Compound colliders on the same body may report multiple pairs simultaneously; first deduplicate by stable collider ID, then merge by object pair + surface region + tick. Do not unconditionally merge impacts on two different walls into one. Removal / mode switching / replay reset clears the episode, but the first discontinuity tick must not emit an impact. Audio produced by moving platforms and player pushes follows the same pipeline.

<!-- english-original-anchor --> <a id="6-voice-limiting-與音訊執行緒"></a>
## 6. Voice Limiting and the Audio Thread

- Allow only one friction loop per `episodeId + soundFamily`. Suggested global impact voices: `24`; per object: `4`; rolling/scraping loops: `8`. These values await testing.
- Ignore repeated `eventId` directly. Priority is determined by estimated audible gain, distance, event freshness, and the source specified by the experiment; when full, steal the lowest-priority voice and release it with a `5–20 ms` fade rather than cutting the waveform abruptly.
- Record voice decisions (accepted, rejected, replaced) in a diagnostic trace; the multi-source limiter must not make acoustic solver data disappear.
- The audio thread performs bounded DSP only, without Rapier / geometry queries / extensive allocation. The main thread or a Worker prepares fixed-size batches first; the audio side must not retain an arbitrarily growing event queue.
- Continuous sources read smoothed pose / path updates and are routed separately from impact one-shots. The acoustic renderer crossfades the birth/death of occlusion or reflection paths rather than rebuilding all voices.
- Count stale events that exceed scheduling tolerance first. Exploration mode may degrade; recording / comparison mode must stop or label the distortion. Do not replay all impacts from one second ago in the current audio frame.

<!-- english-original-anchor --> <a id="7-驗證矩陣"></a>
## 7. Validation Matrix

| Case | Mechanically Checkable Result | Status |
| --- | --- | --- |
| 1 kg sphere falls to the ground + settles | Onset is present; force and impulse can be obtained and have different dimensions | Node smoke PASS |
| Same event resent / 60 support steps | At most one onset impact, without creating 60 voices | NOT RUN |
| Valid rebounds, simultaneous hits on two walls, compound | Episode / surface groups are not incorrectly merged | NOT RUN |
| Deletion, mode switch, teleport, replay | No ghost voices or false new-impact events | NOT RUN |
| Many collisions | Bounded voice limit; auditable event drops; no audio clicks | NOT RUN |
| Space and time | Correct source position / listener orientation; known-distance delay consistent with epoch | NOT RUN |

<!-- english-original-anchor --> <a id="8-官方來源"></a>
## 8. Official Sources

All checked on 2026-10-26; data structures, thresholds, gain, and voice strategies are Reflection Lab designs.

- **PA-01**: [Rapier Advanced collision-detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/): enabling contact / force events, graphs and manifolds, and the distinction between geometric / solver contacts.
- **PA-02**: [TempContactForceEvent API](https://rapier.rs/javascript3d/classes/TempContactForceEvent.html): force aggregation semantics and temporary-object lifecycle.
- **PA-03**: [TempContactManifold API](https://rapier.rs/javascript3d/classes/TempContactManifold.html), [World API](https://rapier.rs/javascript3d/classes/World.html): `contactImpulse`, local points, world solver point, and callbacks.
- **PA-04**: [RigidBody API](https://rapier.rs/javascript3d/classes/RigidBody.html): COM, velocity, angular velocity, `velocityAtPoint`; the project's pre-impact velocity estimate must still identify its provenance.
- **PA-05**: [Actual pinned-version smoke](../experiments/physics-spike/README.md): API and numerical evidence; does not support the claim that “collision sound effects are complete.”
