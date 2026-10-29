<!-- english-source: {"path":"docs/04-physics/PHYSICS_ARCHITECTURE.md","sha256":"718678474717ede3c190d6980d90bb2c0f9879c8297728f55ce8d83a931d37b4","translated_at":"2026-10-27T03:41:12.367020Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/04-physics/PHYSICS_ARCHITECTURE.md`](../../04-physics/PHYSICS_ARCHITECTURE.md). Source SHA-256: `718678474717ede3c190d6980d90bb2c0f9879c8297728f55ce8d83a931d37b4`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一人稱物理架構"></a>
# First-Person Physics Architecture

Reviewed: 2026-10-26 (Asia/Taipei). Status: research and architecture recommendations; the formal interaction product has not yet been implemented. The parameters in this document are initial values awaiting validation, not a guarantee of measured stability.

<!-- english-original-anchor --> <a id="1-選型與證據範圍"></a>
## 1. Technology Selection and Evidence Scope

The recommendation is to render with Three.js, run rigid bodies and queries with Rapier 3D WASM, and manage commands and snapshots with TypeScript. The first-person view uses `PointerLockControls` for mouse orientation; player movement is handled by Rapier `KinematicCharacterController`. These have different responsibilities: the `moveForward` / `moveRight` methods of PointerLockControls directly change the camera position, so the product movement path does not use these two methods.[PH-01][PH-02]

| Package | Recommended pinned version | License | Purpose in this phase |
| --- | --- | --- | --- |
| `three` | `0.186.1` | MIT | Candidate for formal implementation; PointerLockControls is the addon from the same version |
| `@dimforge/rapier3d-compat` | `0.21.0` | Apache-2.0 | Isolated smoke test and Web MVP candidate |

`-compat` embeds WASM in JavaScript to simplify bundler initialization, but has a larger package size. If it is later replaced with the main package using separate WASM, loading, deployment MIME, and caching must be retested; this cannot be treated as a zero-cost replacement. Preserve the upstream LICENSE / required NOTICE when distributing; the complete license registry is managed in `docs/01-compliance/`.[PH-03][PH-04]

<!-- english-original-anchor --> <a id="2-模組界線"></a>
## 2. Module Boundaries

```text
InputRouter / SceneCommandQueue
                │ fixed-step commands (revision + tick)
                ▼
PhysicsWorld ─ CharacterMotor ─ GrabController ─ PlacementValidator
    │               │                │
    └──────── authoritative poses + velocities + contact events
                         │
             PhysicsSnapshot / PhysicsAudioBridge
                  │                 │
          Render interpolation   Acoustic worker / audio scheduling
```

- `PhysicsWorld` alone can modify physical rigid bodies; UI, AI, and the editor must not directly write mesh transforms as a substitute for physics commands.
- `SceneCommandQueue` validates commands at step boundaries, carrying `commandId`, `sceneRevision`, and `tick`; mode changes, spawning, and deletion are undoable transactions. Build's `Preview → PlacementPending → Staged → Active` requires safe pause, geometry ack, and explicit Enable; it does not enable automatically.
- `PhysicsSnapshot` is immutable plain data; WASM handles and temporary manifolds do not cross Workers or get passed to AudioWorklet.
- `Render interpolation` may smooth the display; next-step queries, collision sounds, and experimental data still use physics snapshots.
- When the editor is paused, pose may be changed transactionally and marked as a discontinuity; during simulation, movement is only allowed through dynamics or controlled-motion commands.

<!-- english-original-anchor --> <a id="3-座標單位與步進"></a>
## 3. Coordinates, Units, and Stepping

Use a right-handed coordinate system, `+Y` up, with camera forward along local `-Z`; meters, kilograms, seconds, radians, newtons, and newton-seconds. Store rotation as a normalized quaternion (`x,y,z,w`). The initial gravity for ordinary scenes is `(0,-9.81,0) m/s²`, which experiment settings may override. Physics colliders and acoustic surfaces share `entityId` / `surfaceId`, but their geometric precision and lifecycles remain separate.

The initial version uses a fixed `h = 1/60 s`, while rendering may run at 30–144 Hz; step with `world.timestep = h`. Interaction stress tests also compare `1/120 s`. The following example is a scheduling contract, not product code:

```text
onFrame(realDelta):
  if suspended: clearInput(); return
  accumulator += realDelta       // recorded run 不 clamp／丟棄 wall-time
  steps = 0
  while accumulator >= h and steps < 4:
    applyCommands(tick)
    sampleInputAndComputeCharacterMove(h)
    constrainGrabTargetBySweeps(h)
    applyBoundedGrabImpulses(h)
    snapshotPreSolvePointVelocities()
    world.step(eventQueue)
    copyAndAggregateContacts(tick + 1)  // 不保留 Temp* 參照
    publishSnapshot(tick + 1)
    accumulator -= h; tick += 1; steps += 1
  if accumulator >= h:
    pauseAndReportOverrun()  // 保存 backlog，不靜默跳 logical tick
    renderCurrentFrozenPose(); return  // 不用 alpha>=1 外插
  render(previous, current, accumulator / h)
```

A non-recorded exploration mode may explicitly slow down / discard wall-time and record telemetry; recording / A/B mode pauses on overload, records the reason, and never skips a logical tick or uses variable `dt` to catch up. Focus loss / page hiding defaults to safe pause while retaining Held / ghost; controllers stop applying force when logical ticks stop. Audio follows Freeze-and-fade to fade out and retain pending arrivals, and Resume explicitly establishes a new audio epoch. Contact and input ordering is fixed, and package, WASM, scene, and controller versions are recorded; recording keyboard and mouse alone cannot guarantee the same trajectory. The Rapier guide and package README describe cross-platform determinism differently, so this project currently does not promise cross-platform bit-exact replay; measured hashes and transform / velocity time series are the basis for verification.[PH-05]

The formal event contract treats tick `0` as the initial state. The post-step snapshot for step `n→n+1` is labeled `tick=n+1`, `simulationTime=(n+1)*h`. The actual occurrence time of a discrete contact is only guaranteed to fall within this step interval; the post-step timestamp must not be called a CCD-precise contact time. The isolated smoke test's loop index is an internal label for that test, separate from the formal event tick definition.

<!-- english-original-anchor --> <a id="4-抓取候選比較與初版決策"></a>
## 4. Grab Candidate Comparison and Initial-Version Decision

| Method | Collision and mass response | Advantages | Risks / API limitations | Initial-version role |
| --- | --- | --- | --- | --- |
| Camera transform parenting | Bypasses contact solving | Easy to display | Wall penetration, distorted velocity, no inertia | Prohibited for physical grabbing |
| Kinematic anchor + fixed / spherical joint | The grabbed object stays Dynamic; the solver solves constraints | Little code, contact coupling | Anchor exerts nearly unlimited force; hard constraints can jitter against walls; off-center grab points produce large torque | Alternative spike |
| Kinematic anchor + spring joint | Dynamic; spring allows error | Natural lag, adjustable stiffness and damping | Excessive stiffness can still oscillate; `JointData.spring` has length / stiffness / damping, but the JS Spring joint exposes no general force-limit setter | Controlled demo candidate |
| Per-step `setLinvel` velocity servo | The contact solver can subsequently correct velocity | Easy to implement | Repeated overwriting every step can cancel contact response; without a clear force limit, it behaves like unlimited horsepower | Not the default |
| Bounded PD / velocity-error impulse servo | Dynamic; force is limited through mass and inertia | Explicit limits, observable blocking and weight, easy replay | Requires error / rotation / target-sweep policies; stability across all scenes still needs testing | **Recommended P0** |

This choice is an engineering judgment: the initial version prioritizes bounded control energy, debuggability, and allowing lag on collision; it does not claim proven maximum stability for every shape. An official `PidController` exists, but direct `applyLinearCorrection` does not expose a per-application force limit in its JS API; corrections may first be obtained and then wrapped after reviewing the source and units. An unverified API must not be treated as a ready-made bounded grab controller.[PH-06]

<!-- english-original-anchor --> <a id="41-平移控制契約"></a>
### 4.1 Translational Control Contract

The grabbed object remains Dynamic: do not switch it to Kinematic, disable collisions, or zero gravity. Compute the target using a virtual grip, but apply the initial version's translation impulse at the COM and use separate torque for rotation; this prevents off-center torque from `applyImpulseAtPoint` from bypassing the separate rotational limit.

Let `p_t` be the target COM after sweeping, `x,v` the current COM position and velocity, `v_t` the speed-limited / smoothed target velocity, and `e=p_t-x`. Use a backward-Euler linear spring-damper approximation to produce a candidate correction:

```text
kp = wn²                  // s⁻²
kd = 2*zeta*wn             // s⁻¹
dv = h * (kp*e + (kd + kp*h)*(vt-v)) / (1 + kd*h + kp*h²)
Jraw = m * dv             // kg*m/s
J = clampNorm(Jraw, min(FhandMax*h, m*amax*h))
body.applyImpulse(J, true)
```

The derivation assumes one contact-free linear degree of freedom and a target moving at constant velocity. This denominator reduces the numerical risk of an explicit stiff spring, but contact, force limits, and saturation make the system nonlinear and require separate validation. `FhandMax` is an absolute hand-force limit: heavier objects may have greater error; do not merely multiply by mass so that every mass always tracks identically. Gravity is handled by the physics engine; if assistance is added, it also counts toward the same total force budget, and `assistMode` is recorded.

Suggested starting values: `wn=10 rad/s`, `zeta=1`, `FhandMax=150 N`, `amax=20 m/s²`, target speed limit `3 m/s`, and grab mass `0.1–20 kg`. These are tunable demo boundaries, not human physiological data. First compare error and penetration with `0.1/1/5/20 kg`, thin walls, corners, and stacks, then lock the parameters.

<!-- english-original-anchor --> <a id="42-旋轉控制與故障收斂"></a>
### 4.2 Rotation Control and Failure Convergence

Choose the shortest arc for `q_e=q_t*inverse(q)` (negate if `w<0`) and convert it to a world-space axis-angle error `e_r`. Use the same type of formula to obtain the candidate `Δωraw`, first limit it to `Δω=clampNorm(Δωraw,αmax*h)`, calculate `Lraw=I_world*Δω` with the world inertia matrix `I_world`, then limit `|L| ≤ τmax*h` and call `applyTorqueImpulse(L,true)`. Locked rotational axes are excluded from control; the initial version allows only unlocked primitives with positive-definite, finite inertia. `τmax=15 N·m`, `αmax=30 rad/s²`, and target angular speed `2 rad/s` are initial values awaiting validation. When large-angle / shape rotation sweeps are insufficient, reduce target angular speed and, if necessary, retain the last valid orientation.

If blockage causes grip error greater than `0.75 m` for `0.25 s`, stop extending the target behind the wall. If runtime error exceeds `1.5 m`, the object is deleted, or values become non-finite, safely drop at the next fixed step. Focus loss / Workspace switching only pauses and retains the grab snapshot; entering Build requires Idle or an explicit release. This policy allows an object to lag or drop; it must not teleport to align with the camera. Every step outputs `trackingError, impulse, torqueImpulse, saturated, blocked` for diagnostics.

<!-- english-original-anchor --> <a id="5-碰撞與查詢規則"></a>
## 5. Collision and Query Rules

- Use box / ball / capsule / convex for ordinary objects; use compounds / convex decomposition for dynamic concave objects, rather than arbitrary trimeshes as grabbable dynamic bodies. Separate model render meshes from colliders.
- Selection rays use normalized directions and a distance limit in meters; the first blocking collider has priority. A non-grabbable object in front must not be passed through to select an object behind it. Exclude the player itself and pure previews.
- Sweep the hold target from the current object pose toward the intended position using `castShape`, retaining a skin; then validate candidate orientation and position with `intersectionsWithShape`. Both queries use `filterExcludeRigidBody=heldBody` (or an equivalent predicate) to exclude all colliders of the held body, otherwise they would continually hit the body itself; retain the player, walls, and other dynamic bodies. `castShape` is a linear sweep and must not be assumed to cover every rotational trajectory.[PH-07]
- Collisions between the held object and walls, floor, and other Dynamic bodies remain enabled. The player and held object also collide by default; the minimum hold distance must exceed the capsule radius plus the object's bounding radius. Drop when squeezed, rather than masking the issue by disabling collisions globally.
- Enable `enableCcd(true)` for throws / fast small objects; the initial `maxCcdSubsteps` is `2` and must not be `0`. The official 0.21 description states that fixed obstacles receive automatic swept collision, while explicit CCD extends to moving objects; it still explicitly states that collisions between two CCD dynamic bodies can be missed. Thin-wall, high-speed, and rotational cases must therefore be tested: CCD does not guarantee no penetration.[PH-08]
- All state switches execute at step boundaries; see [OBJECT_STATES.md](OBJECT_STATES.md). Read events after `world.step`; see [PHYSICS_AUDIO_EVENTS.md](PHYSICS_AUDIO_EVENTS.md).

<!-- english-original-anchor --> <a id="6-驗證契約"></a>
## 6. Verification Contract

Isolated verification lives in `experiments/physics-spike/`; `node experiments/physics-spike/smoke.mjs` has been executed with **6/6 PASS**: free fall, no-gravity inertia, Fixed→Dynamic, force / impulse, contact force / manifold impulse, and a kinematic anchor spring in an empty scene. Pinned evidence is stored in [rapier-win64-20261025T192231997Z.json](../../../experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json), including source / lock / WASM hashes; `results.json` only represents the latest result overwritten on each rerun. An API smoke test cannot replace FPS visual testing, grab stability testing, or audio listening tests.

| Gate | Completion condition | Current status in this document |
| --- | --- | --- |
| Minimal API / numerical | Initialization, Dynamic / Fixed / position-Kinematic, events, impulse, and spring are callable in the pinned version | 6/6 PASS; remaining query / velocity-Kinematic NOT RUN |
| Mass and grabbing | 4 masses; force / torque stays within limits; blockage can stop the target; no unlimited energy | NOT RUN |
| Collision | Quantify maximum penetration for wall corners, thin walls, narrow doors, stacks, dynamic-body collisions, and high-speed rotation | NOT RUN |
| FPS | Capsule does not pass through walls; slopes / steps; focus-loss safety; hold-drop-throw cycle | NOT RUN |
| Performance | p50/p95/max step duration on target hardware, 100 dynamic bodies, and worst-case contact peaks | NOT RUN |

<!-- english-original-anchor --> <a id="7-官方來源與主張索引"></a>
## 7. Official Sources and Claim Index

All sources below were reviewed on 2026-10-26; online documentation can change, and implementation still needs to be checked against the lockfile's `.d.ts`. This document's formulas and defaults are labeled as this project's designs, not upstream stability commitments.

- **PH-01**: [Three.js PointerLockControls documentation](https://threejs.org/docs/pages/PointerLockControls.html), [r186 source](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/controls/PointerLockControls.js): addon import, lock/unlock, orientation, and direct camera movement.
- **PH-02**: [Rapier Character Controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller/): kinematic player, collision-corrected movement, no rotation support, and gravity supplied by the application.
- **PH-03**: [three npm](https://www.npmjs.com/package/three), [Rapier compat npm](https://www.npmjs.com/package/@dimforge/rapier3d-compat): pinned-version recommendations and compat packaging.
- **PH-04**: [Three.js MIT LICENSE](https://github.com/mrdoob/three.js/blob/r186/LICENSE), [Rapier JS Apache-2.0 LICENSE](https://github.com/dimforge/rapier.js/blob/master/LICENSE): upstream licenses; distribution still requires checking the actual package contents.
- **PH-05**: [Rapier determinism guide](https://rapier.rs/docs/user_guides/javascript/determinism/), [Rapier npm README](https://www.npmjs.com/package/@dimforge/rapier3d): differences in source descriptions and limits on initial conditions and creation order.
- **PH-06**: [JointData](https://rapier.rs/javascript3d/classes/JointData.html), [SpringImpulseJoint](https://rapier.rs/javascript3d/classes/SpringImpulseJoint.html), [GenericImpulseJoint](https://rapier.rs/javascript3d/classes/GenericImpulseJoint.html), [PidController](https://rapier.rs/javascript3d/classes/PidController.html): public joint / PID interfaces exist, which does not mean all of them have configurable force limits.
- **PH-07**: [World](https://rapier.rs/javascript3d/classes/World.html), [Scene queries guide](https://rapier.rs/docs/user_guides/javascript/scene_queries/): ray, shape sweep, overlap, and filtering capabilities.
- **PH-08**: [Rapier CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/): CCD behavior, cost, and known tunneling limitations.
- **PH-09**: [RigidBody](https://rapier.rs/javascript3d/classes/RigidBody.html), [Rigid-bodies guide](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/): mass, inertia, modes, continuous force, and instantaneous impulse. `addForce` persists across steps and must not be accumulated every step without clearing; this design uses a one-step impulse to avoid this type of accumulation error.
