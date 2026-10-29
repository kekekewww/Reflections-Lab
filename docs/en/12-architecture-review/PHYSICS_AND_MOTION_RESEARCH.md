<!-- english-source: {"path":"docs/12-architecture-review/PHYSICS_AND_MOTION_RESEARCH.md","sha256":"461e799f18a050ac495e26538896df8c6d10c5fac2309c5b6cf2573d2c7049f1","translated_at":"2026-10-29T05:24:25Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/PHYSICS_AND_MOTION_RESEARCH.md`](../../12-architecture-review/PHYSICS_AND_MOTION_RESEARCH.md). Source SHA-256: `461e799f18a050ac495e26538896df8c6d10c5fac2309c5b6cf2573d2c7049f1`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="物理與-motion-架構研究"></a>
# Physics and Motion Architecture Research

Review date: 2026-10-29 (Asia/Taipei). Research baseline: `c210ca882ca8503b322c28884bf1e9f6e9fe126d`. This report inventories production `src/` and existing tests. Recommendations are not newly accepted product scope and do not replace the [frozen V1 acceptance](../11-v1/ACCEPTANCE.md) or [amendments](../11-v1/ACCEPTANCE_AMENDMENTS.md). No production code, physics formulas, parameters, existing fixtures, or acceptance thresholds were changed.

<!-- english-original-anchor --> <a id="判讀與結論"></a>
## Interpretation and conclusion

Retain the existing Rapier adapter, fixed step, dynamic grab, Drop/Throw, and recording/replay. The smallest architectural direction is to define explicit Motion intents, capabilities, and control ownership, then connect them to the existing adapter. There is no evidence requiring another engine, camera parenting for dynamic objects, or using authoring transforms for normal motion. Production Move To and Move & Release are not implemented; the presence of `setKinematicTarget` or replay does not establish those capabilities.

| Label | Meaning in this report |
| --- | --- |
| VERIFIED-SOURCE | Official source read directly in this review; establishes only what that document supports |
| VERIFIED-CODE | Baseline code and test content read in this review; not execution evidence |
| VERIFIED-PROBE | The bounded silent Rapier process below actually executed in this review; not a complete runtime suite |
| HISTORICAL-TEST | Existing fixed result/report, with its Git, source, and method scope retained |
| APPROXIMATION | Numerical or Derived/Tuned engineering model, not measured contact vibration |
| PROPOSED | Recommendation from this review, neither implemented nor accepted |
| UNVERIFIED / NOT RUN | Required measurement unavailable / not executed in this review; no inference fills the gap |

Code version, Node tests, browser, physical Pointer Lock/IME, hearing, and performance are judged separately. The existing [R17](../11-v1/BROWSER_PERFORMANCE.md) long run remains a performance and sustained-workload FAIL. This research does not promote it to PASS or claim all V1 complete. Native 200% was removed and is not reintroduced as a required gate.

<!-- english-original-anchor --> <a id="現行狀態與程式證據"></a>
## Current state and code evidence

| Area | Actual behavior and boundary | Evidence/status |
| --- | --- | --- |
| DynamicGravity | Rapier Dynamic with gravityScale=1; solver determines forces, impulses, and contacts | [PhysicsWorld](../../../src/physics/physics-world.ts) `addBody`/`setMode`; VERIFIED-CODE |
| DynamicNoGravity | Still Dynamic with gravityScale=0; retains mass, inertia, and collision. Gravity/NoGravity transitions preserve v/ω | Same implementation; [four-mode test](../../../tests/physics/physics-world.test.ts); VERIFIED-CODE. Zero gravity is not vacuum |
| Fixed | Ordinary impulses do not move Fixed; entering Fixed clears forces and v/ω; Unlock starts from zero velocity | `setMode`; [InteractionHost](../../../src/interaction/interaction-host.ts) `toggleFixed` retains the previous gravity mode and generation; [unlock clearance](../../../tests/interaction-runtime/unlock-clearance.test.ts) |
| Kinematic | Position-based; `setKinematicTarget` uses next pose, limits each translation to `3*fixedDt` m, and performs a shape sweep first; rotation checks final overlap | VERIFIED-CODE; [atomic target rejection](../../../tests/physics/physics-world.test.ts). A final rotation check is not proof of rotational CCD |
| Fixed step/interpolation | Default 1/60 s; control before step, data collection afterward; render interpolation does not write back into the solver | [FixedClock](../../../src/physics/fixed-clock.ts), [clock tests](../../../tests/physics/fixed-clock.test.ts), [interpolation differential tests](../../../tests/physics/interpolated-transform.test.ts) |
| Grab | Active Dynamic, 0.1–20 kg; same body retains contact solving without changing mass/mode/collision groups; bounded impulse/torque servo, shape sweep/overlap, and ramp | `grab`/`controlGrip`; [real WASM matrix](../../../tests/physics/v1-matrix.test.ts), [thin-wall regression](../../../tests/physics/physics-world.test.ts); VERIFIED-CODE/HISTORICAL-TEST |
| Drop | Clears grip, preserves current solver v/ω and gravity mode; successful command emits OnRelease+OnDrop with command-ID deduplication | `drop`; [NoGravity drop test](../../../tests/physics/physics-world.test.ts), [E-key edge](../../../tests/interaction-runtime/host.test.ts) |
| Throw | Retains existing momentum and adds a directional impulse. Requests are 0–20 Ns; the new impulse is limited by mass/current v so that, when existing speed is below 12 m/s, this increment cannot exceed that cap. At or above the cap, the increment is zero | `throwHeld`; VERIFIED-CODE. Existing speed is not forcibly clamped to 12, and high speed does not imply Throw |
| Collision after release | Drop/Throw do not disable the collider; the same Dynamic body continues contact solving. Sound candidates still pass episode/intensity/cooldown gates; release need not immediately produce Impact | `drop`/`throwHeld`/`samplePair`; VERIFIED-CODE |
| Pause/focus loss | Freezes stepping, clears input, and retains Held. Resume revalidates generation, geometry, and target clearance. Pause does not invent Drop/Throw | [InteractionHost](../../../src/interaction/interaction-host.ts), [host tests](../../../tests/interaction-runtime/host.test.ts); physical Pointer Lock and IME remain human gates |
| Gentle Place | Existing FPS Held object gradually approaches valid support, then calls Drop when near and slow; invalid support cancels placement while retaining Held | `gentlePlace`/`refreshGentleSupport`/`beforeStep`; not a general Move To authoring system |
| Move To/Move & Release | No versioned Motion Registry, generic authoring command, lifecycle, or completion criteria; AI `SetTrajectory` explicitly rejects | [Scene operations](../../../src/scene/types.ts) lack these operations; [AI adapter](../../../src/ai/scene-adapter.ts) returns `CAPABILITY_UNSUPPORTED`; VERIFIED-CODE |
| Arbitrary impulse authoring tool | Adapter exposes `applyImpulse` with a finite-vector bound; non-Dynamic does nothing. No complete UI/AI command, Undo, or intent trace | VERIFIED-CODE; direct use in tests does not establish a shipped authoring tool |

`OnRelease` denotes successful release, not a body mode. Mode/delete/invalid-grip changes end control with ContactInvalidated rather than fabricating a user Drop. Existing release events share a commandId but lack a formal receipt carrying both body generations, release reason, and before/after velocity. A future Motion receipt should state these explicitly without changing old physics-event semantics.

<!-- english-original-anchor --> <a id="接觸速度與音效資料"></a>
## Contact, velocity, and sound data

[PhysicsWorld `samplePair`](../../../src/physics/physics-world.ts) caches COM/v/ω before the step, then copies geometry through `contactPair`, handling flipped collider ordering and local-to-world quaternion transforms. Normal impulse comes from solver `contactImpulse`; contact force N is not relabeled impulse Ns. Point velocity is `v(point)=vCOM+ω×(point−COM)`, with `closing=max(0,−dot(vB−vA,nAtoB))`. `PreStepRigidBodyEstimate` uses the pre-step rigid velocity field at the post-step representative point: an APPROXIMATION without CCD-substep-accurate incident time.

Each SceneObject currently has one primitive collider (sphere/box/capsule), with geometric contacts aggregated per collider pair. Fixed support prefers its actual surface witness to avoid an emitter inside the floor; dynamic pairs use the midpoint of both witnesses. Normal-impulse aggregation, positional weights, and contact tolerance are engineering policies, not sound power or natural vibration energy. See the [contact-emission test](../../../tests/physics/contact-emission.test.ts) and [earlier bridge source](../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md).

| Classification | Current implementation | Confidence/boundary |
| --- | --- | --- |
| Moving/Spinning | Fixed-step enter/exit hysteresis, two low-speed steps to exit; getters do not advance state | Derived/Tuned; [motion hysteresis](../11-v1/MOTION_HYSTERESIS.md) and [real Rapier tests](../../../tests/physics/motion-hysteresis.test.ts) |
| Airborne | Dynamic without valid upward support; physics pose may be Held+Airborne, while behavior `WhileAirborne` also requires not Held | Support uses world +Y and threshold 0.4, not an arbitrary scene-up model |
| Sliding | Relative tangential slip at the contact point, not COM speed; support is not mislabeled because another body scrapes it | Derived/Tuned; selects a high-slip patch as the continuous sound anchor |
| Rolling | Supported spheres only; subtracts support velocity field at the COM and relative angular velocity, excluding normal-axis spin; mutually exclusive with Sliding | Derived/Tuned candidate. Arbitrary mesh/capsule/compound rolling is unsupported and returns null |
| Impact | New episode onset, not discontinuity, normal impulse+closing-speed thresholds and pair cooldown | Conservative audible candidate; support does not sound every tick. No formal persistent-contact new-strike rearm capability |
| Bounce | No production bridge producer; restitution>0, ContactEnd, or another Impact cannot substitute | UNVERIFIED/not implemented; accepting legal external OnBounce in the schema/evaluator does not make this product generate it |

Official documentation distinguishes collision and contact-force notifications; a contact-graph pair does not prove contact. Composite shapes may have several manifolds, and 1/2 fields depend on actual collider ordering. [Rapier advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/) (VERIFIED-SOURCE, accessed 2026-10-29). Episode and audibility gates are application policy.

<!-- english-original-anchor --> <a id="第一第三人稱共享狀態"></a>
## Shared first-/third-person state

The current other view is editor OrbitControls; there is no character-following third-person controller. [CameraRig](../../../src/ui/viewport/CameraRig.tsx) saves each Workspace orbit view; FPS uses the same `InteractionHost` player eye pose. `LabRuntime.listener()` uses the head pose in FPS and the independent Scene listener in editor mode. Switching cameras does not create another object or rigid-body world.

Shared authority runs from Scene authoring ID/revision to PhysicsWorld body/generation, then interaction ownership and copied view DTOs. The camera only consumes projections. For a future third-person view, PROPOSED: reuse `InteractionHost` intents and PhysicsWorld; camera mode is not another body mode. Separately declare whether the listener follows the head, camera, or independent pose and record that policy. An orbit camera must not silently move the listener or duplicate Held state. Existing [camera projection](../../../tests/app/camera-projection.test.ts), [listener projection](../../../tests/app/listener-projection.test.ts), and [FPS-entry race](../../../tests/app/fps-entry-race.test.ts) tests provide regression coverage. A new third-person view is NOT RUN in this review.

<!-- english-original-anchor --> <a id="motion-最小契約建議proposed"></a>
## Minimal Motion contract proposal (PROPOSED)

Retain SceneSpec v1 and the sound schema. First introduce a separate versioned Motion definition/capability contract and pure domain validator, without promising new playback UI. Each action needs at least `actionId/revision`, `objectId/generation`, expected scene revision, `startTick`, control kind, target pose, speed/acceleration/impulse caps, finite duration/timeout, collision policy, release-velocity policy, and provenance. Runtime state separately stores cursor/controller owner/last accepted target/receipt, never WASM objects.

| Intent | Minimum consistent semantics | Required rejection/recording |
| --- | --- | --- |
| Move To | Finite move on fixed ticks; Dynamic uses a bounded collision-preserving servo, Kinematic uses next pose. Arrival declares positional/angular/velocity tolerance and stable ticks | Fixed body, simultaneous Held, stale generation, invalid/out-of-bounds target, blocked timeout; record reached/blocked/cancelled instead of continually writing transforms |
| Move & Release | Atomically remove this controller after controlled motion. Dynamic preserves actual solver v/ω; transition from Kinematic to Dynamic explicitly chooses Zero or bounded TransferTrajectoryVelocity | Transfer uses adjacent accepted tick poses/orientations, not rejected requested positions; blocking cannot silently tunnel or count as reached |
| Apply Impulse | One bounded Ns input with direction/magnitude, Dynamic requirement, and command-ID deduplication; not persistent force | Rejection for Fixed/Kinematic must be visible; generic impulse is not OnThrow |
| Cancel/Pause/Reset | Pause freezes the cursor; Cancel removes its controller and records why; Reset changes epoch | No fabricated OnStopMoving/OnRelease edges; leaving a Workspace does not reset automatically |

Existing `setMode` clears v/ω for Kinematic→Dynamic, so Move & Release cannot promise trajectory momentum without an explicit release policy. Existing grip Held/OnGrab belongs to player interaction; programmed motion needs its own ownership and receipt rather than invented player Grab/Throw. `OnStartMoving/OnStopMoving` remain physical speed edges; action started/finished should be a separate lifecycle if required, not changes to existing sound triggers.

Use one controller-owner lease including generation, validate/accept/revoke atomically at a fixed-step boundary, and allow at most one controller to write each body. UI, AI, and third-person input propose the same closed intent; they do not receive Rapier/Three transform access. This connects to the existing adapter without another general animation graph or physics solver.

<!-- english-original-anchor --> <a id="主要-gap-與調整優先序"></a>
## Main gaps and priorities

| Priority | Difference/risk | Smallest follow-up |
| --- | --- | --- |
| High | Earlier [OBJECT_STATES](../04-physics/OBJECT_STATES.md) and [bridge](../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md) still say production unimplemented/all NOT RUN, despite runtime and scoped results | Add current status/canonical evidence entry points while retaining history; do not rewrite artifacts |
| High | No formal Move To/Move & Release/Motion Registry | Freeze the minimal intent/capability/receipt first; do not promote API primitives into finished tools |
| Medium | `pairKey` and domain collider IDs use only object IDs; `lastImpactByPair`/`pairEpisodes` survive remove/geometry rebuild until reset | The isolated probe below confirms that a new generation with the same ID inherits a configured 60 s pair cooldown; the default 0.08 s scenario was not newly tested. Long-running churn growth remains a static Map risk. Establish formal negative cases before affected-pair cleanup or versioned identities; do not change event schema in research |
| Medium | One body-level representative contact; multiple primitive colliders/compound/multiple patches are not formal schema/runtime capabilities | Retain current primitive scope. Define collider-generation/patch identity and bounded aggregation before extending shapes; do not average different wall normals |
| Medium | Translational sweep plus final overlap does not prove rotational path clearance; CCD does not imply complete substep-event traces | Add independent high-angular-speed thin-plate/corner fixtures; retain approximation labels and fail-closed policy |
| Medium | Recorder keeps authoritative motion/normalized events but no complete tick-indexed Motion command stream/native world snapshot for resimulation | Store future Motion receipts in a versioned sidecar; do not call existing replay resimulation |
| Retained | Physical FPS/IME and device hearing incomplete; R17 sustained performance FAIL | Continue original gates; lower-level success cannot replace human/performance evidence |

<!-- english-original-anchor --> <a id="錄製與-deterministic-邊界"></a>
## Recording and determinism boundaries

[Recorder](../../../src/experiments/recorder.ts)/[RecordingFrame](../../../src/experiments/types.ts) store tick, pose/v/ω, listener, normalized physics events, behavior decisions, audio events, acoustic references, and behavior checkpoints. [LabRuntime capture](../../../src/app/runtime.ts) uses fixed-step snapshots. `reprocessRecording` fixes raw motion/listener/physics events and recomputes behavior/acoustics; it does not rerun free physics.

| Category | Current supported claim | No extrapolation |
| --- | --- | --- |
| Authoritative replay | Same recorded motion/raw-event trace for acoustic/behavior A/B, with hashes/epochs/cursors checkable | Does not prove Rapier resimulation, recorded hardware PCM, or matching device time |
| Same-machine pinned resimulation | [v1-matrix](../../../tests/physics/v1-matrix.test.ts) runs two independent Worlds with the same construction/tick intents for 120 ticks and compares full public snapshot SHA | Not native `takeSnapshot` binary evidence, arbitrary UI timing, or cross-machine validation |
| Cross-platform engine determinism | Official JS/WASM guarantees are conditional on same version, initial values, construction and addition/removal order | Product cross-platform bitwise runs remain unmeasured; initialization operations such as sin/cos and different inputs can violate the premises |
| Changed mass/friction/geometry | Fresh physics rerun has a new motion trace | No longer matched A/B changing only acoustics/behavior |

See [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/) (VERIFIED-SOURCE, 2026-10-29). FixedClock interactive mode may drop wall time but cannot skip simulation ticks; recording overload pauses with backlog intact. Fixed dt is not evidence that the entire browser pipeline is deterministic.

<!-- english-original-anchor --> <a id="可重現驗證與本輪執行狀態"></a>
## Reproducible validation and execution status

Executed in this review: bounded file/code/test reading, official-source access, and the silent Rapier generation/cooldown probe below. The original workspace was read only; these two research reports were written only in the isolated research worktree. The commands below are reproduction entry points. Until a new execution result is entered, they are **NOT RUN in this review**; existing results are only HISTORICAL-TEST.

```powershell
node --import tsx --test tests/physics/physics-world.test.ts tests/physics/motion-hysteresis.test.ts tests/physics/fixed-clock.test.ts tests/physics/contact-emission.test.ts tests/interaction-runtime/host.test.ts tests/interaction-runtime/unlock-clearance.test.ts
node --import tsx --test tests/physics/v1-matrix.test.ts tests/app/camera-projection.test.ts tests/app/listener-projection.test.ts tests/app/replay-audio.test.ts tests/experiment-runtime/reprocess.test.ts
```

The first group checks four modes, Held collision/drop momentum, bounded Throw, contact onset/support, and pause/resume. The second checks same-machine resimulation, control/listener projection, and authoritative replay. `v1-matrix` may write its intended validation artifact, so use new output and source guards rather than overwrite previous formal results. Browser/long-run tests need not be repeated for document-only research.

Suggested meaningful fixtures, not implemented/NOT RUN: same-ID remove/readd within cooldown does not inherit the previous episode; thin-wall-blocked Motion does not teleport; Kinematic release Zero/Transfer each has expected v/ω; two camera modes act on the same body ID and replay can reconstruct listener policy. Invariants concern body/generation/finite bounds/collision ownership/raw trace; tests should not merely duplicate helper arithmetic.

<!-- english-original-anchor --> <a id="本輪-generationcooldown-probeverified-probe"></a>
### Generation/cooldown probe in this review (VERIFIED-PROBE)

2026-10-29, Node/tsx/real Rapier 0.21.0, exit 0. A legal but deliberately enlarged `impactCooldownSeconds=60` isolates cooldown semantics. Each segment runs 40 fixed steps with the same initial position/velocity. Generation1 emits Impact at tick8. After remove/readd of the same domain ID, generation2 has actual contact episode `.e2` but no Impact. A new domain ID then emits Impact at tick88. This confirms current pair-cooldown inheritance across same-ID generations; it does not establish behavior at default 0.08 s, UI operation, audibility, or long-run Map capacity. No file, audio, or network operation was used; finally disposes the world.

At repository root, execute with `node --import tsx --input-type=module`:
```javascript
import { PhysicsWorld } from "./src/physics/index.ts";
const obj = (id, shape, positionM, mode, dimensionsM) => ({
  id, shape, positionM, mode, dimensionsM, orientationQuaternion: [0, 0, 0, 1],
  massKg: 1, friction: 0.5, restitution: 0,
  physicsMaterialId: "test", acousticMaterialId: "test", acousticRole: "none"
});
const floor = obj("floor", "box", [0, -0.1, 0], "fixed", [8, 0.2, 8]);
const ball = id => obj(id, "sphere", [0, 0.3, 0], "dynamicGravity", [0.2, 0.2, 0.2]);
const scene = {
  schemaVersion: "1.0.0", sceneId: "probe", sceneRevision: 1, units: "SI",
  coordinateSystem: "right-handed-y-up-minus-z-forward", seed: 1,
  gravityMps2: [0, -9.81, 0], objects: [floor, ball("ball")], sources: [],
  listener: { id: "listener", positionM: [0, 1.6, 3],
    orientationQuaternion: [0, 0, 0, 1], attachment: "independent" }
};
const world = await PhysicsWorld.create(scene, { impactCooldownSeconds: 60 });
const sample = id => {
  world.setVelocity(id, [0, -1, 0]); world.resume();
  let impact = null, contact = null;
  for (let i = 0; i < 40; i++) {
    const s = world.step();
    impact ??= s.events.find(e => e.type === "OnImpact" && e.objectId === id) ?? null;
    contact ??= s.poses.find(p => p.objectId === id)?.contact ?? null;
  }
  world.pause();
  return { generation: world.getPose(id).generation,
    impactTick: impact?.tick ?? null, contactEpisode: contact?.episodeId ?? null };
};
try {
  const first = sample("ball");
  world.applyScene({ ...scene, sceneRevision: 2, objects: [floor] });
  world.applyScene({ ...scene, sceneRevision: 3, objects: [floor, ball("ball")] });
  const sameId = sample("ball");
  world.applyScene({ ...scene, sceneRevision: 4, objects: [floor] });
  world.applyScene({ ...scene, sceneRevision: 5, objects: [floor, ball("ball.new")] });
  console.log({ first, sameId, newId: sample("ball.new") });
} finally { world.dispose(); }
```
Observed result: `first={generation:1, impactTick:8, contactEpisode:pair-7229565ba11ed03e.e1}`; `sameId={generation:2, impactTick:null, contactEpisode:pair-7229565ba11ed03e.e2}`; `newId={generation:1, impactTick:88, contactEpisode:pair-8578165d088583da.e1}`. This isolated research probe does not replace the not-yet-added formal regression or full browser acceptance.
Existing fixed evidence: [physics acceptance](../11-v1/PHYSICS_ACCEPTANCE.md), [motion source/stdout manifest](../../../artifacts/v1/motion-hysteresis-validation-20261027/verification.json), [R17 functional receipt](../../../artifacts/v1/r17-browser-verification-20261029/verification.json). Each retains its limits; test counts across dates do not add up to full completion.

<!-- english-original-anchor --> <a id="官方來源與存取記錄"></a>
## Official sources and access record

Existing [physics source metadata](../../../research/sound-behaviors/physics-sources.json) fixes 0.21.0 package/type/license hashes. This review checked it and the [Evidence Ledger](../../../research/EVIDENCE_LEDGER.json) first; no SDK full text or new binary was downloaded. `package.json`/lock pin `@dimforge/rapier3d-compat 0.21.0`; mutable online documentation does not replace the pinned package.

| Claim | Direct support and limit | URL/access date |
| --- | --- | --- |
| PHY26-S01 VERIFIED-SOURCE | Official JavaScript guide displays 0.21 and separates Dynamic/Fixed/two Kinematic kinds. Contact forces do not block Kinematic, supporting application-level clearance checks | [Rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/); 2026-10-29 |
| PHY26-S02 VERIFIED-SOURCE | `setNextKinematicTranslation/Rotation`, COM impulse, and velocityAtPoint are engine primitives, not application Undo/Motion authoring | [RigidBody API](https://rapier.rs/javascript3d/classes/RigidBody.html); 2026-10-29 |
| PHY26-S03 VERIFIED-SOURCE | Collision and contact-force notifications differ; pair graph/geometric contacts/solver contacts have different semantics and indices | [Advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/); 2026-10-29 |
| PHY26-S04 VERIFIED-SOURCE | CCD motion clamping/substeps have cost and limits, without guaranteeing fully observable substep sound events | [Rigid-body CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/); 2026-10-29 |
| PHY26-S05 VERIFIED-SOURCE | JS/WASM determinism requires same version, initial values, and order; initialization transcendental operations need care | [Determinism](https://rapier.rs/docs/user_guides/javascript/determinism/); 2026-10-29 |

Research status: review input. The root agent separately decides and records the minimal proposal, implementation, independent verification, and safe merge/push. No new physics dependency or paid API call was introduced.


