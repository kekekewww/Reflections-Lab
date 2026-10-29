<!-- english-source: {"path":"docs/04-physics/OBJECT_STATES.md","sha256":"e74507a63520ba51ed47a5c2e2120ce798c0a895b17b4de2e71101f3904db801","translated_at":"2026-10-27T03:39:41.362709Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/04-physics/OBJECT_STATES.md`](../../04-physics/OBJECT_STATES.md). Source SHA-256: `e74507a63520ba51ed47a5c2e2120ce798c0a895b17b4de2e71101f3904db801`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="物件生命週期與物理狀態"></a>
# Object Lifecycle and Physics States

Reviewed: 2026-10-26. Status: state machine design; the minimal API verification is governed by the results in `experiments/physics-spike/`.

<!-- english-original-anchor --> <a id="1-使用三層狀態"></a>
## 1. Use Three State Layers

Store the lifecycle `Preview / PlacementPending / Staged / Active / Removed`, physics mode `DynamicGravity / DynamicNoGravity / Fixed / Kinematic`, and interaction state `Free / Held / ProgramControlled` separately. `Held` is not a RigidBodyType; `Fixed` and a dynamic body with `gravityScale=0` behave differently. `simulationState=Paused` is also an independent state: it retains the Held snapshot and stops stepping without changing the body type.

| Lifecycle | Collider / body in the world | Sound and acoustics | Available operations |
| --- | --- | --- | --- |
| Preview | No active body; validate with a query shape | No source or collision events | Move ghost, cancel |
| PlacementPending | Domain entity is being validated and has not joined the active world | Source / surface not registered | Safe pause, revalidate at the fixed-step boundary, commit / rollback |
| Staged | Domain entity created; runtime body / collider not yet enabled | Source does not emit sound; awaiting backend geometry ack | Explicit Enable or cancel and restore; cannot collide or push objects |
| Active | Body / colliders created in the specified mode | Enable source / surface according to the feature | Interact, simulate, convert, delete |
| Removed | Handles invalidated and event caches cleared | fade out / release | Can only be recreated through an Undo transaction |

This design does not use a disabled physics body to represent a ghost, avoiding confusion in queries and acoustic registration. `PlacementPending` is a transient transaction state; `Staged` may appear as "Created / awaiting enable." After geometry ack, the user chooses Enable and separately chooses Resume; it cannot automatically become Active.

<!-- english-original-anchor --> <a id="2-物理模式映射"></a>
## 2. Physics Mode Mapping

| Domain mode | Rapier | Gravity | External forces / momentum | Position policy |
| --- | --- | --- | --- | --- |
| DynamicGravity | `RigidBodyType.Dynamic` | `gravityScale=1` or an explicit experimental scale | Has mass and inertia; affected by contact, friction, and impulse | Integrated by the solver |
| DynamicNoGravity | Same as above | `gravityScale=0` | Retains existing velocity, mass, and collisions; can still be pushed or thrown | Integrated by the solver |
| Fixed | `RigidBodyType.Fixed` | No effect | External forces cannot move it | Pose can only be changed by an editing transaction |
| Kinematic | position-based (P0) or velocity-based (explicitly configured) | No effect | Unaffected by ordinary forces; can affect Dynamic bodies | Specified trajectory; position-based uses the next pose |

Rapier officially defines Fixed as not moving due to force, and Kinematic as unaffected by ordinary force / impulse; the application still needs to prevent a kinematic path from passing through walls. NoGravity is a Dynamic body's gravity scale setting, not a fixed body.[OS-01]

The domain `configuredMode` records user intent; `controllerOwner` records the temporary source of control. Two controllers must not modify the same object simultaneously. An object must have nonzero, finite mass and inertia to be grabbed; the UI "Mass" field must not use zero to mean no gravity.

<!-- english-original-anchor --> <a id="3-切換交易與還原政策"></a>
## 3. Switching Transactions and Restoration Policy

All rigid-body mode changes (as distinct from Workspace / Pause changes) first complete input validation, capture a memento at the fixed step, end Held / ProgramControlled, and clean up controllers before updating the Rapier type / gravity / velocity. Finally, wake the body and emit `BodyModeChanged`, pose revision, and `discontinuity`. A failed switch restores the complete memento; changing only the UI label is insufficient.

| Switch | Pose | Linear / Angular velocity | Sleep / Wake | Restoration policy |
| --- | --- | --- | --- | --- |
| Gravity on ↔ off | Retain | **Retain** | `setGravityScale(scale,true)` | Do not restore past velocity; only acceleration changes |
| Dynamic → Fixed (Lock) | Retain | Set to zero; clear custom force / torque | Do not use sleep as a substitute for fixed | Remember the original configured Dynamic mode; retain old velocity only for Undo |
| Fixed → Dynamic (Unlock) | Retain; check the space first | Zero by default | `setBodyType(Dynamic,true)` and wake | Restore the gravity mode from before Lock; do not restore old throwing momentum |
| Dynamic / Fixed → Kinematic | Retain; initialize next pose to the current pose | Start the trajectory from zero; do not reuse garbage velocity | Controlled | Save the original mode; schedule the trajectory in fixed ticks |
| Kinematic → Dynamic | Retain | Zero by default; if transfer is selected, use a bounded finite difference from the last trajectory | wake | Explicitly select `Zero` / `TransferTrajectoryVelocity` and include it in the trace |
| Kinematic → Fixed | Retain | Zero | Stop scheduling the trajectory | Clear the trajectory owner |
| Delete in any mode | Save domain settings in a tombstone | Clear caches | remove and release | Undo recreates new Rapier handles and restores the domain ID according to the transaction policy |

Position / rotation commands must explicitly distinguish `Teleport` from `ControlledMotion`. Normal motion during simulation must not call `setTranslation` every frame; normal kinematic motion uses `setNextKinematicTranslation/Rotation` so that the engine can derive velocity.[OS-02]

The `memento` includes at least: `entityId`, geometry / collider version, pose, `v,ω`, body type, configured gravity, mass / inertia settings, damping, CCD, locked axes, collision / solver groups, sleep flag, controller configuration, source / surface binding, and scene revision. Undo restores in the paused state and requires revalidation when a scene revision conflict occurs; a single-object Undo is not claimed to reverse the entire world's physics history.

<!-- english-original-anchor --> <a id="4-grab接觸與睡眠"></a>
## 4. Grab, Contact, and Sleep

- Only Free Dynamic can enter Held. Grabbing does not change type, gravity, mass, or collision groups. Drop / Throw only removes the controller and retains actual velocity; the original gravity does not need "guessed restoration."
- Explicit object-changing commands such as Lock and Delete end Held before executing the transaction; an object must not receive both throw and freeze in the same tick. Command sequence numbers and priorities determine the outcome, and rejected events include a reason. Simple focus loss / unlock / Workspace switching instead safely pauses and retains the Held / ghost snapshot without dropping; recovery requires explicit Resume.
- Resume first revalidates object generation, collider revision, grip, and target space, then restores / rebuilds the controller for the same object; a bounded ramp raises the force budget. If the ID / geometry cannot be restored, remain Paused and provide an explicit Release; do not reuse an invalid handle or silently substitute another object.
- `isSleeping` is a dynamic optimization and differs from Fixed. User grab / push / throw / unlock / gravity changes must wake the body; changes to world gravity must also explicitly wake affected objects.[OS-03]
- After a switch, contact data is rebuilt by the next `world.step`; do not manually retain the old manifold. Emit domain `ContactInvalidated(reason=modeChange/delete/teleport)` for the old pair; do not fabricate a physics `ContactEnd` or produce sound as if a new collision occurred.
- Contact / sound dedup keys include entity generation and contact episode; deleting and recreating must not accidentally reuse a cooldown.
- If forcibly moving scene geometry during Lock causes overlaps with other objects, check / wake affected neighbors before restoration. Unlocking does not guarantee that the collision world is automatically free of penetration.

<!-- english-original-anchor --> <a id="5-調整尺寸與材質"></a>
## 5. Resizing and Materials

Physics friction / restitution and acoustic absorption / scattering / transmission are separate fields. A material change may increase revision; do not automatically infer mass or friction from an acoustic material. Scaling requires rebuilding the collider and recalculating mass / inertia, not merely scaling the Three mesh; rotation must not apply negative scale or shear. The Scene hierarchy does not serve as the transform parent of Dynamic objects; visual organization is separate from physics world pose.

<!-- english-original-anchor --> <a id="6-驗收案例"></a>
## 6. Acceptance Cases

| Case | Expected result |
| --- | --- |
| Disable gravity while moving | Velocity does not become zero at that instant; no gravitational acceleration afterward |
| Apply an impulse to a no-gravity object | The dynamic body with mass accelerates, and collisions still act |
| Apply an impulse to a fixed object | Pose does not change |
| Lock then Unlock an object with velocity | Start at zero velocity in the same position, restoring the original gravity mode |
| Held NoGravity Drop | Retain NoGravity and the solver velocity at that instant |
| Kinematic hits a wall | The trajectory validator constrains / rejects it; kinematic contact alone cannot be trusted |
| Delete / Undo | No invalid-handle access or lingering voice; revisions are correct after recreation |
| Contact persists during a switch | State rebuilding does not create a series of impact sounds |

The above are formal acceptance requirements; the minimal API cases actually executed are documented separately in the isolated spike. All others are NOT RUN.

<!-- english-original-anchor --> <a id="7-官方來源"></a>
## 7. Official Sources

- **OS-01**: [Rapier Rigid-bodies guide](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/) (reviewed 2026-10-26): four types, gravity scale, mass, sleep, and the difference between force / impulse.
- **OS-02**: [RigidBody API](https://rapier.rs/javascript3d/classes/RigidBody.html) (same date): methods including `setBodyType`, `setGravityScale`, `setNextKinematicTranslation`, `setNextKinematicRotation`, and velocity / force resets.
- **OS-03**: [World API](https://rapier.rs/javascript3d/classes/World.html) (same date): body removal, stepping, and snapshots; transaction and restoration policies are Reflection Lab designs, not engine-provided Undo.
