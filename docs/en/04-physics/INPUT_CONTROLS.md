<!-- english-source: {"path":"docs/04-physics/INPUT_CONTROLS.md","sha256":"7cd4b0fd04c856f289e7f660c1acaa8ad979ec8bc7fddf5a5c645fc464f65706","translated_at":"2026-10-27T03:41:28.744971Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/04-physics/INPUT_CONTROLS.md`](../../04-physics/INPUT_CONTROLS.md). Source SHA-256: `7cd4b0fd04c856f289e7f660c1acaa8ad979ec8bc7fddf5a5c645fc464f65706`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="輸入與控制映射"></a>
# Input and Control Mapping

Review date: 2026-10-26. Status: P0 interaction contract; bindings are remappable and browser usability testing has not yet been performed. Keep modes, focus, and cancellation behavior consistent with the UX documents.

<!-- english-original-anchor --> <a id="1-inputrouter-優先序"></a>
## 1. InputRouter Priority

From highest to lowest: browser default unlock / loss of focus → modal / text field → gizmo / library → FPS actions → global shortcuts. A single DOM event may be consumed by only one layer; preserve `Tab` for accessible focus rather than using it to switch Build. During text input, WASD, Delete, and Undo do not act on the scene.

Convert input events to `actionId + pressed/released + sequence`; sample continuous actions at the fixed step, and give discrete commands a unique `commandId`. Do not use OS `keydown.repeat` to repeatedly spawn, throw, lock, or delete. Display labels from the user’s keyboard. `KeyboardEvent.code` may be used for default position mapping, but retain remapping and alternative UI.

<!-- english-original-anchor --> <a id="2-共通行為"></a>
## 2. Common Behaviors

| Input | Behavior |
| --- | --- |
| Mode toolbar / configurable shortcut | Enter Editor / FPS Simulation; show control instructions before entering FPS |
| Press the “Start / Continue” button | Request Pointer Lock; resume action input only after success |
| `Esc` / browser unlock | Clear all keys, stop stepping / control, retain the last valid Held / ghost, pause and display the reason; do not resume automatically |
| blur / hidden | Same as above; cancel any uncommitted throw command; resuming requires an explicit action |
| `B` | When Idle, switch FPS Simulation ↔ FPS Build; when Held, the user must first place gently / release or cancel the switch; do not intercept it in a text field |
| `Tab` / `Shift+Tab` | UI focus; if UI is needed, exit Pointer Lock first and show the interaction panel |
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` | undo / redo in Editor / while paused; during simulation, first prompt to pause to avoid claiming to reverse physics history |

Request Pointer Lock through a user gesture. Do not send FPS actions before `lock()` has reported success; listen to `pointerlockchange` / `pointerlockerror` and addon lock/unlock. Consume the click used to obtain the lock so that it cannot also throw / place. If raw mouse `unadjustedMovement` is unsupported, allow fallback to the ordinary mode and preserve the setting; do not repeatedly request the lock automatically. [IC-01]

After unlocking, pause safely and retain the hold controller settings / solver velocity / last valid ghost snapshot. Do not execute impulses during the pause. Resume first obtains a new lock, waits for release of the initiating key, then explicitly restores the original Held / ghost; release control only if the user selects Drop instead. Audio uses Freeze-and-fade to preserve logical source offset / pending arrivals; see [PHYSICS_AUDIO_EVENTS.md](PHYSICS_AUDIO_EVENTS.md) for the fade and new epoch policy.

Before resuming, revalidate object generation / collider revision / grip / target space. On controller restoration, ramp the force budget from zero within bounds. If the ID or geometry is invalid, remain Paused and offer explicit Release rather than automatically dropping. The ghost’s last valid pose must also be revalidated before Place is available again.

<!-- english-original-anchor --> <a id="3-fps-simulation"></a>
## 3. FPS Simulation

| Input | Nothing Held | Held object |
| --- | --- | --- |
| `W A S D` | Horizontal walking; normalize diagonals | Same as left; grabbing remains limited by distance / collision |
| Mouse movement | View yaw / pitch | Same as left, except during the `R` rotation state |
| `Shift` | Fast walking (can be disabled / remapped) | Same as left; exceeding tracking capacity causes lag or drop |
| `E` | Grab the first eligible Dynamic object under the crosshair | Drop: release control and retain velocity at that instant |
| Left mouse button | No throw / push; the push tool is a later feature | Throw: one fixed, configurable finite impulse |
| Mouse wheel | No physics action | Adjust hold distance, clamped to the legal interval and speed-limited |
| Hold `R` + mouse | No action | Change the object’s target orientation; pause view rotation and return to the view on release |
| `R` alternative toggle mode | No action | A toggle may replace holding; the HUD clearly displays rotation mode |
| `G` | No action / display the nearest support candidate | Gentle place: move slowly to the target only when valid support and space are found, then drop |
| `F` | When hovering over Fixed, explicitly Unlock and display the gravity / zero-velocity policy | Freeze: release the grab first, set Fixed, and clear velocities |

P0 `LMB` Throw does not charge according to hold duration; avoid firing while reacquiring the lock. Suggested `Jthrow=6 N·s`, adjustable in the Inspector; heavier objects receive a smaller speed increase. See [FPS_INTERACTION_SPEC.md](FPS_INTERACTION_SPEC.md). Experiment mode may lock the parameters and control-binding snapshot.

Gentle place is not a teleport: accept only when the support ray, shape clearance, and final pose are all valid, and complete it through slow, bounded control. If the target is obstructed, stay Held and display the reason. If the world is paused, enter staged through a preview transaction; a static teleport must not generate collision sounds. Unlock restores the gravity mode from before Lock, with velocity zero by default. If no record exists, require mode selection through the Inspector; do not silently guess.

P0 does not provide jumping / crouching; adding them later requires tests for grounding, ceiling clearance, crouch collider replacement, and listener eye height. Do not list unimplemented actions as available shortcuts.

<!-- english-original-anchor --> <a id="4-fps-build"></a>
## 4. FPS Build

| Input | Behavior |
| --- | --- |
| `L` / Library button | Unlock the mouse, pause, move accessible focus into the library; return to preview after choosing an object |
| View / mouse | Continue aiming at surfaces from the player’s view; rotate the view only after explicit resume + lock |
| Mouse wheel | Adjust ghost distance |
| `R` toggle / angle-step buttons | Rotate the ghost target; this mode does not dispatch Held rotation or grabbing |
| Snap button / configurable shortcut | Toggle grid / rotation snap; the HUD displays the step |
| Left mouse button / Place button | valid ghost → PlacementPending revalidation → Staged; when invalid, display the occupied / out-of-range reason |
| Right mouse button / Cancel preview button | Cancel only an uncommitted ghost; retain the standard context menu for right-clicks in the UI |
| `Esc` | Browser unlock and pause, preserving the ghost; does not also cancel the preview |
| Duplicate button | Create a duplicate ghost with a new entity ID; placement is required again |
| Lock / Mode control | Select the final Fixed / DynamicGravity / NoGravity mode; Kinematic requires explicit trajectory configuration |
| Enable / Apply button | Explicitly enable Active after Staged geometry and acoustics acknowledgement and the final overlap check are complete |

Resolve bindings by mode first; Build `R` must not accidentally trigger Held rotation. Before implementation, verify consistency against the UX source of truth. See [FPS_INTERACTION_SPEC.md](FPS_INTERACTION_SPEC.md) for placement states and safe queries.

<!-- english-original-anchor --> <a id="5-scene-editor"></a>
## 5. Scene Editor

Editor retains the cursor and standard focus by default, providing selection, gizmo, Inspector, and library. Camera orbit / pan / zoom can use the mouse, but buttons / alternative navigation must also be available. `W/E/R` may serve as translate / rotate / scale gizmo bindings only when no text input has focus and FPS is inactive. Deletion must act only on an explicit selection and provide Undo. Camera movement does not change the pinned listener; Source / Listener use separate gizmos and explicit selection labels.

<!-- english-original-anchor --> <a id="6-可用性與輸入驗收"></a>
## 6. Usability and Input Acceptance

- After losing focus while movement keys are pressed, resuming does not continue movement.
- Holding E, F, LMB, or OS key repeat produces only one corresponding command.
- The first lock click, a browser-rejected lock, and ESC unlock produce no throw / place.
- Both R hold and toggle can complete rotation; cancellation / mode switching leaves no residual rotation state.
- Do not intercept WASD, Undo, or Delete during text input or IME composition.
- Every key operation has a clickable UI equivalent, and bindings are remappable; when pointer lock is unavailable, the user can remain in Editor to complete the scene.
- If mode switch + throw occur in one tick, execute the legal sequence only once and report the rejection reason.

All browser interaction acceptance checks above are currently NOT RUN. Unit tests can validate the InputRouter state machine, but cannot replace real-browser Pointer Lock and focus tests.

<!-- english-original-anchor --> <a id="7-官方來源"></a>
## 7. Official Sources

**IC-01**: [Three.js PointerLockControls documentation](https://threejs.org/docs/pages/PointerLockControls.html), [r186 source code](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/controls/PointerLockControls.js), [W3C Pointer Lock 2.0 Working Draft 2026-02-25](https://www.w3.org/TR/2026/WD-pointerlock-2-20260225/) (all reviewed on 2026-10-26). Input mapping, focus layers, drop, and pause policies are Reflection Lab product design.
