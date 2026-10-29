<!-- english-source: {"path":"docs/04-physics/FPS_INTERACTION_SPEC.md","sha256":"703b597a3bbb3bb5952542c0f2d5f6fcc006bcb58bb6e2beb9aeb26b3338f783","translated_at":"2026-10-27T03:41:28.744971Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/04-physics/FPS_INTERACTION_SPEC.md`](../../04-physics/FPS_INTERACTION_SPEC.md). Source SHA-256: `703b597a3bbb3bb5952542c0f2d5f6fcc006bcb58bb6e2beb9aeb26b3338f783`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一人稱互動規格"></a>
# First-Person Interaction Specification

Review date: 2026-10-26. Status: a design contract for the next development phase; this document does not represent completed interaction features. [INPUT_CONTROLS.md](INPUT_CONTROLS.md) is authoritative for control bindings.

<!-- english-original-anchor --> <a id="1-三種工作模式"></a>
## 1. Three Work Modes

| Mode | View and cursor | Main behaviors | Entry conditions |
| --- | --- | --- | --- |
| Scene Editor | Free camera, visible cursor | Object hierarchy, Transform gizmo, Inspector, Source / Listener positions, undo | Scene loaded |
| FPS Simulation | Pointer Lock, crosshair | Walk, look, grab, rotate, drop, throw, and push | Player capsule has a valid spawn space; initiated by a user gesture |
| FPS Build | Same player and first-person view | library, ghost, surface alignment, snap, place/cancel, duplicate, lock | Idle; when Held, first explicitly place gently / release or cancel the switch |

Simulation running / paused is a separate state; do not conflate it with the three modes or the Workspace. An ordinary Scene / Analysis Workspace switch does not mean Reset / Pause. When leaving FPS input control, exit Pointer Lock and clear keyboard state first. If Held / ghost work is unfinished, pause at a safe tick, preserve the last valid snapshot, and display “Object held; continue after resuming”; do not silently drop. Geometry editing and placement confirmation require a safe pause and transaction validation; explicit Resume is required after closing the UI.

Pause uses `Freeze-and-fade` from the UX / audio specification: freeze the logical tick, Held / ghost, source offset, and pending arrival queue; do not execute grab impulses while paused. Fade out the run bus with a target of `20 ms`, still pending validation; cancel scheduling in the old audio epoch and truncate tails. On Resume, re-anchor the clocks and reschedule only logical arrivals that have not yet arrived; do not replay impacts already heard. This policy does not guarantee convolution waveform continuity across a pause; recordings must mark the interrupted boundary. See [WORKSPACE_ARCHITECTURE.md](../05-ux/WORKSPACE_ARCHITECTURE.md).

Before restoring Held, revalidate entity generation, collider revision, grip, and valid target space. If necessary, rebuild the controller for the same object using the saved settings. Ramp the restoring force limit from zero to the configured value within bounds; do not release energy from accumulated error on the first step. If restoration fails, remain Paused and show explicit Release / restore-scene options; do not silently select another object or automatically drop. A ghost must also be revalidated before displaying it as placeable.

The Three Pointer Lock addon is a tool for controlling input direction, not a collision system. Lock success is determined by the `lock` event / actual `pointerLockElement`. On errors or unsupported platforms, return to an operable UI; calling `lock()` alone does not establish success. Preserve the browser’s default unlock gesture; actual behavior must be tested in the target browsers. [FP-01]

<!-- english-original-anchor --> <a id="2-玩家與攝影機"></a>
## 2. Player and Camera

The initial player uses a position-based kinematic body with an upright capsule; the capsule must not rotate around pitch. The Rapier controller handles translation only: apply the intended input displacement, take the corrected displacement, then call `setNextKinematicTranslation`. [FP-02]

Initial candidates: capsule radius `0.25 m`, total height `1.75 m`, eye height `1.60 m` (measured from the feet), walking speed `2 m/s`, fast walking speed `3.5 m/s`, and controller offset `0.01 m`. These are interaction defaults unrelated to exact physical human dimensions. Jumping and crouching are optional P2 items, consistent with the FPS UX / core P0 schedule; P0 does not display unsupported bindings. Phase 2 unified the original P1/P2 discrepancy after recording it in the conflict record; optional items were not promoted to required features.

```text
horizontal = normalizeIfNeeded(WASD) * speed  // 對角不加速
desired = yawRotate(horizontal)*h + up*verticalVelocity*h
controller.computeColliderMovement(capsuleCollider, desired, filters)
corrected = controller.computedMovement()
player.setNextKinematicTranslation(player.position + corrected)
if grounded and verticalVelocity < 0: verticalVelocity = 0
else: verticalVelocity += gravityY*h
```

The implementation must decide the gravity integration order and grounded seam tolerance, and pin the version; this section lists only the data flow. Do not enable autostep initially: validate walls / slopes / doorways first, then enable it with fixtures. If the character can push objects, use a finite `characterMass` and test the controller’s dynamic impulse option; do not treat it as a fully dynamic human body. The Camera takes the capsule’s safe displacement plus eye height; eye height must not extend outside the capsule envelope. Future wall peeking or a third-person camera requires an added camera sphere sweep.

<!-- english-original-anchor --> <a id="3-選取抓取與受阻"></a>
## 3. Selection, Grabbing, and Obstruction

1. The crosshair displays query hover every frame; when the action key is pressed, raycast again on the next physics tick to avoid using stale hover.
2. Cast the ray from the eye point along the normalized view direction, with a default effective range of `3 m`; exclude self / ghost and retain blocking objects such as walls.
3. For the first hit, first check whether it is active, Dynamic, grabbable, within the mass and size limits, and occupied by another controller. Fixed / Kinematic objects display “Fixed” / “Controlled motion”; do not automatically change them to Dynamic.
4. Save `entityId`, revision, grip coordinates local to the object, current pose, configuredMode, and controller parameters. Grabbing is a temporary constraint state, orthogonal to the physics mode.
5. Create a virtual hold target, clamping distance between `max(0.75 m, playerRadius + objectBoundingRadius + 0.1 m)` and `3 m`. Reject grabbing if an oversized object has no legal distance.
6. Limit forward movement with an object-shape sweep, then validate overlap at the candidate pose. Both queries exclude every collider of the grabbed body itself and retain the player and environment. Stop in front of walls and make the object’s tracking error visible. When blocked, display “Obstructed” at the crosshair; do not warp the object to its target.
7. Apply the bounded impulse and torque from [PHYSICS_ARCHITECTURE.md](PHYSICS_ARCHITECTURE.md) every tick; distance changes and rotation must also obey speed limits.

Grabbed objects retain their original gravity settings, mass, collider, and collision properties. Fixed requires explicit unlock; unsupported objects only display a reason. During a run, safely drop and record the fault reason on excessive distance / entity deletion / NaN. Normal operation ends holding through an explicit Drop, Freeze, or Delete command. Pause / loss of focus preserves the Held snapshot without continuing to apply force; it must not be used as a reason for automatic dropping. Do not rewind physics history.

<!-- english-original-anchor --> <a id="4-放下投擲與推力"></a>
## 4. Dropping, Throwing, and Pushing

- **Drop**: remove the temporary controller and retain the actual linear / angular velocities and configuredMode, without adding an extra impulse. An object originally set to No Gravity remains No Gravity.
- **Throw**: remove the controller first, then apply `Jthrow` once at the COM in the same tick. The initial version uses a fixed, configurable absolute impulse: `Jthrow = direction * Jconfigured` (suggested `6 N·s`), without charging by holding the button; heavier objects therefore receive a smaller speed increase. Do not call it repeatedly every render frame or use `setLinvel` to erase the original momentum.
- **Push (a later tool, no P0 binding)**: while not holding, apply one finite impulse at the contact point of the first Dynamic object hit by a short-range ray. An off-center point produces rotation; record the force application point in the event. Fixed / Kinematic objects return a reason.
- Before throwing, check clearance in front of the hand, enable CCD, and check total speed limits. If the increment would exceed the demo range of `12 m/s`, `12 rad/s`, scale down this increment according to the remaining speed budget and display saturation; do not silently alter existing experimental momentum. Objects already exceeding the limit cannot be accelerated further, but may continue moving naturally.

These numerical values are design parameters awaiting tuning. Every throw must carry a `commandId` for deduplication; record the accepted tick, applied value, object mass at that time, and resulting velocity in the trace. A gesture used to click the UI or relock the mouse must not also throw.

<!-- english-original-anchor --> <a id="5-build-ghost-與交易式放置"></a>
## 5. Build Ghost and Transactional Placement

A Ghost is visual preview data with no active rigid body, sound source, or collision sound. A Rapier shape that is not added to the world may be used for queries; a ghost must not push existing objects.

```text
AimSurface -> SurfaceFrame -> SnapCandidate -> ValidatePose -> Preview
                                              │ valid + Place command
                                              ▼
        pause -> PlacementPending -> revalidate -> Staged -> geometry ack
                                              │                 │ explicit Enable
                                              └-> rollback       ▼
                                                              Active
```

- The surface ray first obtains the world position and normal. Choose a stable tangent that is not parallel to the normal to construct the basis, avoiding quaternion flips at the poles.
- Move the object outside the surface using the collider’s support radius, retaining `skin=0.01 m`; grid snap defaults to `0.1 m` and rotation snap to `15°`. The order is rotation / size first, surface offset next, planar snap next, and validation last.
- Perform a broad-phase range check first, then confirm using overlap / signed contact distance where needed for all collider shapes. AABB alone, a ray hit, or a green mesh cannot establish the absence of penetration.
- Queries must include Fixed, Dynamic, Kinematic, and the player, while ignoring sensors / ghost. Fixed-v-Fixed is not necessarily reported by dynamic contact events, so placement cannot rely on contact events for its decision. [FP-03]
- Valid supporting contact allows an exterior skin gap. Do not treat “same entity as the supporting surface” as a reason to ignore the entire entity; that would allow placement inside a wall or floor.
- `Place` revalidates revision, player position, and overlap at the fixed step. If a moving body has entered the candidate region, reject placement, preserve the ghost, and show “Position occupied.” Do not trust only the previous frame’s result.
- Placement confirmation first pauses at a safe tick. Create a recoverable pending entity, then enter Staged after validation: the domain entity exists, but the runtime body is disabled and produces no sound. Show Enable after the backend geometry update completes and acknowledges it; only explicit user activation makes it Active. Time advances only after a separate Resume. Roll everything back on failure. Spawn velocity defaults to zero; select the mode explicitly from the library preset / Inspector. This two-phase flow does not promise immediate availability of dynamic reflections during uninterrupted simulation.
- Duplication creates a new `entityId`, copying settings but not running velocities / voices / experimental results. Fixed, freely moving, and not-yet-enabled objects have distinct labels.

<!-- english-original-anchor --> <a id="6-camera-與-audio-listener"></a>
## 6. Camera and Audio Listener

The data model holds separate `EditorCameraPose`, `PlayerHeadPose`, and `ListenerPose`. A Three AudioListener may be a camera child, but this is only a common usage pattern and is not the source of Editor listener position data in this project. [FP-04]

| Listener mode | Position and orientation source | Switching policy |
| --- | --- | --- |
| `ScenePinned` | Explicitly placed Listener entity in the scene | Editor camera movement has no effect on it |
| `FollowPlayer` | Capsule displacement plus eye height; view quaternion | Enabled only by user choice; preserve the original pinned pose |

Entering FPS retains the original listener selection by default. If following, the HUD displays “Listening position: Player.” Leaving FPS restores the original `ScenePinned` pose and marks a listener discontinuity. Keep only one active render listener. Compare multiple receiver positions through solver calculations or separate renders; do not create multiple AudioContext listeners that overwrite one another.

Compute `ListenerVelocity` from head-position differences at the fixed step. On repositioning / teleport / switching, set velocity to `0` and carry a discontinuity flag to avoid false Doppler. Normalize orientation and update HRTF with world forward/up; audio scheduling uses independent clock mapping and a short ramp. Render interpolation and decorative camera shake must not contaminate the formal motion velocity. Rotating the Listener need not change positional velocity, but does change HRTF orientation. Whether the audio renderer handles Doppler itself must be stated separately; sending velocity alone does not establish that Doppler has been implemented.

<!-- english-original-anchor --> <a id="7-驗收與來源"></a>
## 7. Acceptance and Sources

The following still await verification in the formal interaction implementation: round trips among the three modes, ESC / loss of focus / library opening and closing, grabbing against walls, heavy-object sag, No Gravity drop, placement races, Listener pinned independently of the camera, and correct FollowPlayer orientation / eye height. Record framebuffer / trace / maximum penetration and control impulse; do not declare a pass solely because it “looks normal.”

Official sources (all reviewed on 2026-10-26):

- **FP-01**: [PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html), [W3C Pointer Lock 2.0 Working Draft, 2026-02-25](https://www.w3.org/TR/2026/WD-pointerlock-2-20260225/); the latter is a draft, and actual browser support still requires execution-based verification.
- **FP-02**: [Rapier Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), [KinematicCharacterController API](https://rapier.rs/javascript3d/classes/KinematicCharacterController.html).
- **FP-03**: [Rapier Scene queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/), [World query API](https://rapier.rs/javascript3d/classes/World.html), [Rigid body type](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/); the placement strategy is this project’s design.
- **FP-04**: [Three.js AudioListener](https://threejs.org/docs/pages/AudioListener.html); independent listener data, velocity, and restoration policies are this project’s design.
