<!-- english-source: {"path":"docs/10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md","sha256":"e029fae4bf3b8d97e67f46fd387f634d6d0d0c7c94674d310255048b95a4a1ff","translated_at":"2026-10-27T05:42:51.746764Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md`](../../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md). Source SHA-256: `e029fae4bf3b8d97e67f46fd387f634d6d0d0c7c94674d310255048b95a4a1ff`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="rapier--sound-behavior-bridge"></a>
# Rapier → Sound Behavior Bridge

2026-10-27; locally pinned to `@dimforge/rapier3d-compat 0.21.0 / Apache-2.0`. The production adapter has not been implemented; this covers only research into official sources / pinned types and isolated Node/WASM probes. The existing [Physics-to-Audio](../04-physics/PHYSICS_AUDIO_EVENTS.md) retains clock/contact authority; the new [Event Model](EVENT_MODEL.md) defines author-facing triggers.

<!-- english-original-anchor --> <a id="api-mapping"></a>
## API mapping

| Rapier data | Normalized input | Limits |
| ----------- | ---------------- | ------ |
| drainCollisionEvents(a,b,started) | ContactBegin/End, zone occupancy edges | At least one side needs COLLISION_EVENTS; JS callbacks have only 3 parameters, so do not apply Rust SENSOR/REMOVED flags |
| drainContactForceEvents | Force diagnostics and candidate pairs | CONTACT_FORCE_EVENTS + threshold, in N; totalForceMagnitude is the sum of individual force magnitudes and need not equal the length of the totalForce vector |
| world.contactPair / TempContactManifold | Geometric contacts, normals, post-solve normal J, solver representative points | Copy plain data inside the callback; contactImpulse(i) and solverContactPoint(j) are not guaranteed to correspond one-to-one |
| collider translation/rotation + localContactPoint1/2 | World points on both contact sides / patch representative position | Resolve colliders using flipped first, then apply quaternion transforms; do not use COM for everything |
| linvel/angvel/worldCom/velocityAtPoint | Object/contact point velocities, rolling/slip candidates | Current values are usually post-step; cache pre-step values separately for pre-impact estimates and attach the method; these are not exact CCD velocities |
| isSleeping polling / accepted host commands | Sleep/Wake, Grab/Release/Throw/Drop, mode invalidation | These are not native Rapier sound events; rejected commands do not produce success sounds |
| sensor intersection graph/events | Zone occupancy | Not impact/force; non-dynamic pairs may require explicit ActiveCollisionTypes enablement |

Original sources read: [Advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/), [EventQueue](https://rapier.rs/javascript3d/classes/EventQueue.html), [TempContactManifold](https://rapier.rs/javascript3d/classes/TempContactManifold.html), and [RigidBody](https://rapier.rs/javascript3d/classes/RigidBody.html). The local 0.21 d.ts/package/LICENSE SHA256 values and 9 official sources are recorded in [physics-sources](../../../research/sound-behaviors/physics-sources.json). Online pages may change with versions and cannot replace pinned-version types.

<!-- english-original-anchor --> <a id="positionnormal與velocity"></a>
## Position, normal, and velocity

After defining canonical A/B, use the midpoint of the world points on both sides of a geometric contact as its representative position. Resolve the actual colliders using flipped first, then transform local points with each collider's world quaternion/translation. Likewise, first account for callback order when handling the normal, then reverse it if domain ordering requires it. A solver point is only a fallback with a different method; do not force a pairing between solverIndex and geometricIndex.

Engineering derivation: `v(point)=v_COM + ω × (point-COM)`; `v_relative=v_B(point)-v_A(point)`, normal A→B, `closing=max(0,-dot(v_relative,n))`. Slip is the tangential magnitude after removing the normal component. For moving / rotating platforms, use velocity at that same world point as well. `r×ω` reverses the sign.

For ideal sphere rolling, tangential COM motion relative to the surface cancels the angular-velocity contact component. COM speed alone misclassifies sliding as rolling, while |ω| alone misclassifies normal-axis spin as rolling. Arbitrary meshes, deformation, and multiple patches require separate models; return UNCLASSIFIED when unsupported.

Retaining pre-step COM/pose/v/ω and estimating incident velocity at a post-step representative point is **Derived / PreStepRigidBodyEstimate**, affected by multiple impacts within a step, force integration, rotation, and CCD timing. J is solver data or an explicit ForceDtEstimate; it cannot be called real vibration energy or SPL.

```text
accepted commands → pre-step cache → world.step(eventQueue)
copy collision/sensor/force callbacks → update domain episodes/occupancy
query persistent contact pairs → copy/normalize IDs/units/points/normals
derive support/motion edges → aggregate compatible patches → keep raw trace
behavior evaluation → bounded AudioEvents / persistent-instance updates
→ Custom Acoustic Core + recorder → audio renderer
```

Sleeping support cannot be reconstructed solely from this tick's force events; retain a valid episode/contact snapshot and invalidate it on generation/geometry changes. AudioWorklet does not run contactPair or wait for physics/AI/network.

<!-- english-original-anchor --> <a id="十個風險"></a>
## Ten risks

| Scenario | Handling and acceptance |
| -------- | ----------------------- |
| Multiple contacts | Aggregate J and world points within a patch; retain distinct regions. The box-floor probe has 4 contacts, which does not imply 4 voices |
| Persistent contact | Support J/force is not impact; episode onset + cooldown; isolated tests cover 60 support steps and held-contact with high closing speed without retriggering |
| Microvibration | Separate movement/slip hysteresis; rearm only after stable separation; fixture thresholds are Tuned, and actual listening tests are NOT RUN |
| Low-speed / strong impact | Separate raw and audible gates; attach methods to J/closing; clamped perceptual mapping does not alter physics, and SPL is uncalibrated |
| High speed / CCD | 0.21 has a specific automatic sweep for fast dynamic→fixed; moving-body CCD/maxCcdSubsteps remain limited; complete impact timing / stress tests are NOT RUN |
| Multiple objects / compound / multiple walls | Collider→object registry + generation + pair/episode/patch; distinct normals cannot all be averaged. Production cases are NOT RUN |
| Held object hitting a wall | Held remains in the Dynamic solver and data is retained; authors may conditionally mute/layer, without disabling colliders or inferring a throw |
| Fixed / NoGravity | Mode-change invalidation/fade; gravity0 remains Dynamic with inertia and does not mean vacuum; the original 4-mode policy is unchanged |
| Pause/Resume | Do not fabricate StopMoving/Release; freeze the logical trace and reschedule not-yet-arrived arrivals once under the original epoch policy |
| Replay | The same version, initial values, and creation/removal order are only engine prerequisites; retain motion/contact/commands/profile/asset/seed, with no end-to-end bitwise guarantee |

Sources: [CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/), [Colliders](https://rapier.rs/docs/user_guides/javascript/colliders/), and [Determinism](https://rapier.rs/docs/user_guides/javascript/determinism/). CCD capability must not be restated as complete observable sound events for every substep.

<!-- english-original-anchor --> <a id="隔離證據"></a>
## Isolated evidence

```powershell
node --test experiments/sound-behavior-spike/physics-policy.test.mjs
node experiments/sound-behavior-spike/physics-probe.mjs
```

Policy: **13/13 PASS**; [final raw stdout and source hashes](../../../experiments/sound-behavior-spike/physics-validation-final-2026-10-27.json) are retained. This is Synthetic/Derived risk control, rather than a production evaluator. State is limited to 256 entries, with overflow rejected; production still needs lifecycle cleanup. The rearm extension for new strikes during persistent contact has not been implemented.

Pinned 0.21 WASM: **3/3 PASS**, [latest results](../../../experiments/sound-behavior-spike/physics-results-2026-10-26T17-24-46-117Z.json). A 2m/s sphere with ω canceling contact velocity; a box-floor case with 4 contacts / 60 rest-force steps, where contact position differs from COM; a dynamic sphere passing through a sensor with Enter/Exit counts of 1 each, force0. [Earlier results](../../../experiments/sound-behavior-spike/physics-results-2026-10-26T17-23-43-200Z.json) remain historical: world points initially used an identity-orientation approximation, later changed to actual quaternion transforms; contact-position claims use the latest artifact. The original 6 physics smoke checks and old fixed results were not overwritten.

**NOT RUN**: production bridge / behavior runtime / browser audio / click-pop / voice-stealing listening tests; full CCD/compound/multiple-wall/multiple-object stress tests; real rolling/sliding friction models and material acceptance; cross-platform physics+audio replay. This probe does not establish that the whole physics-sound feature is complete.

A rotating support surface also requires its angular velocity: let r=contact-COM, v_support_at_COM=v_support_at_contact−ω_support×r, then classify rolling using ω_relative=ω_object−ω_support and relative tangential COM motion. contact slip=0 alone cannot rule out shared rigid-body rotation of the object and platform; their relative pose is unchanged in that case, which should be RESTING. Missing surface angular data returns UNCLASSIFIED, rather than assuming a static support. This is a Derived engineering classification, not yet a production solver model.
