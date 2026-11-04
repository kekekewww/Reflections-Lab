# Trajectory editor: hackathon MVP design

Status: for the user's approval (2026-11-04). Nothing is built yet. Reviewed once by an independent builder check; the user answered the two questions only they could answer.

## Intent

The user's headline hackathon feature: edit the trajectory of each audible object in the scene (for example the default ball or the speaker), then press Play or Record and let the objects travel those paths, so people can record how the audio reaches the listener's ears. The user calls this the last but most important feature, and values it for sound design: a sound moving through the room, its direction, distance and the room's reflections changing on the way. This is an MVP for the hackathon; the user will direct refinements afterwards.

Today there is no way to do this in the product. The Motion panel only scripts single moves (Move To, Move and Release, Impulse). The engine has a multi-point `trajectory` motion, but only through a JSON import, only for Kinematic bodies, capped at 3 m/s, and it never hands the object back to physics.

## The experience (decided with the user)

### Editor view

1. The user first designs the scene as today.
2. With an audible object selected, pressing **T** opens the trajectory editor for that object: its curve is shown and becomes editable. Pressing **T** again or **Esc** leaves it. (The user suggested Ctrl+T as a demo key and delegated the choice; Ctrl+T and Ctrl+Shift+T are reserved by Chrome, so T and Shift+T are used.)
3. In the trajectory editor, each click on a surface (floor, wall, another object) adds a point at the click; the path starts at the object's position in the starting layout and a smooth curve runs through the points in order.
4. Points can be dragged with the existing move gizmo, including vertically, to put the path in the air.
5. The Inspector gets a **Trajectory** section for the selected object: the point list with X/Y/Z values (delete, insert), **Strength** and the basic parameters.
6. **Shift+T** toggles showing every object's curve in the scene at once.

### First person

1. The user aims at an audible object, holds **Ctrl** and presses the left mouse button: the room freezes and snaps back to its starting layout (only objects; the player stays where they stand), and the user paints that object's path starting at the object. The crosshair is the brush; the curve follows it "like a painter for curves" (user). Releasing the mouse button finishes the stroke.
2. Ctrl only has to be held to start the stroke. After letting go of Ctrl, the user can keep the mouse button held, look around and scroll the brush depth. (Holding Ctrl would send browser shortcuts such as Ctrl+W, which closes the tab.) Walking while painting was proposed and accepted, but is deferred: the player only moves when the physics world steps, and the room is frozen during the stroke. For the MVP the user paints standing still and walks between takes.
3. After the stroke the room stays frozen; Enter or a click starts the take.
4. Plain left click keeps today's grab and throw behaviour; only Ctrl+left-press paints.
5. After the stroke, the same path is editable point by point in the editor view (T).

### Play, Record and Reset (agreed with the user)

The "starting layout" is the scene as designed: object positions, placed objects and their paths, not where things end up after running or after being thrown around.

| The user presses | Room is at the starting layout (fresh, or after Reset) | Room has already run and is paused |
| --- | --- | --- |
| **Play** | Starts the take: every path runs from its beginning | **Resume**: continues exactly where it paused; paths continue mid-way |
| **Record** | Records a fresh take from the beginning | Objects snap back to the starting layout, then a fresh take is recorded |
| **Reset** | (already there) | Back to the starting layout, as today |

When an object's path ends, the object continues with its normal physics behaviour (user). A dynamic ball keeps flying with the path's speed and direction, falls, bounces and makes its impact sounds; a fixed object such as the speaker stays where its path ends. Paths run once per take. In first person only objects snap back; the player and the listener that follows them stay where they are. Because every take starts from the same layout, recordings are repeatable and the existing replay, A/B comparison and audio render and download apply unchanged.

## Parameters

| Parameter | Meaning (user's words) | MVP behaviour |
| --- | --- | --- |
| Curve | "transformation curve, which simulates the path" | Smooth curve through the user's points, starting at the object's starting-layout position. |
| Strength | "impulse speed, which simulates the hit strength" | Speed along the curve in m/s; travel time = curve length / strength; also the speed the object keeps when it hands over to physics. |
| Basic parameters | "some basic params" | Start delay (s) and face-along-path (on or off). More can follow after the hackathon. |

## Goals

- The T / Shift+T editor flow and the Inspector Trajectory section in the editor view.
- Ctrl+left-press painting in first person, with the freeze-and-snap behaviour above.
- The Play / Record / Reset behaviour in the table above.
- Paths are saved with the project and undoable with the normal Undo.
- Works for every audible object: objects with a sound behaviour binding or a sound source (the ball, the speaker, placed objects with behaviours).

## Non-goals for the MVP

- Speed or easing curves over time, rotation keyframes, a timeline UI, a separate preview animation (Play and Record are the preview).
- More than one path per object, chaining or looping paths.
- Listener paths, AI-planned paths, AI experiment runs that include the user's paths, paths edited while the simulation runs.
- New default sounds. The speaker's continuous tone travels with it; the ball sounds on its existing impact, grab and throw events. A user who wants a continuous sound on the ball adds a rule in the existing behaviour editor.

## Anti-goals (failure even if it technically works)

- A path that passes through walls, or scripted motion presented as physics.
- Breaking existing grab, throw, placement or editor shortcuts (W/E/R gizmo; first-person keys W A S D E R F G B L, Enter, Esc, Tab), or Pause and Resume.
- Takes that differ when nothing was changed.
- Visual clutter: curves stay hidden unless the object's trajectory editor is open, painting is in progress, or Shift+T is on.

## Calls made by Claude (the user can override)

- **Keys:** T opens and closes the selected object's trajectory editor and Shift+T shows all curves, both only in the editor view and never while focus is in a text field; Esc also leaves the editor.
- **Storage and undo:** paths are stored in the scene document as one optional path per object, so they are saved with the project and use the normal Undo. At take start they are compiled into the engine's kinematic trajectory runs. (The Motion registry is not part of the saved project today, its scene pin goes stale on every scene edit, and its undo is separate, so it is not used as the store.)
- **Anchoring:** points are stored as offsets from the object's starting-layout position (the first point is the object itself), so moving the object in the editor moves its whole path with it.
- **Start delay:** during the delay the object is held at its start pose (it does not fall).
- **Painting depth:** the brush stays at the distance where the stroke started (the object's distance from the camera), so paths can be painted in mid-air; after Ctrl is released the scroll wheel moves the brush nearer or farther (the same 0.75 to 3 m range as holding an object). If the crosshair meets a surface first, the stroke stays on the surface instead of going through it.
- **Stroke clean-up:** the painted stroke is simplified to at most 64 editable points, the engine's sample limit.
- **Redraw:** painting again on an object replaces its path; undo restores the previous one.
- **During recording:** Ctrl+press does nothing while a recording or replay is active (a short notice says why).
- **Strength range:** 0.5 to 20 m/s, default 3 m/s. The physics-world kinematic step, capped at 3 m/s today, gets a per-call speed limit, and paths use 20 m/s; existing callers keep 3 m/s. A path whose travel time at its Strength exceeds 30 s is shown as invalid.
- **Collisions before Play:** a path whose swept shape intersects fixed geometry is shown as invalid in the editor and Inspector and does not run; other objects' paths still run.
- **Collisions during a take:** the kinematic sweep does not push anything. If a path is blocked mid-take (by a dynamic object, another path or the player), the path ends at that point and the object hands over to physics there with its current velocity.
- **Hand-over:** at the end of the path the object returns to its configured mode. A dynamic object takes the path's final direction at Strength speed (the existing Kinematic-to-Dynamic `TransferTrajectoryVelocity` policy in `docs/04-physics/OBJECT_STATES.md`); fixed and kinematic objects stay at the end point with zero velocity.
- **Limits:** at most 8 paths run in one take (bounded per-tick work, matching the Motion engine's concurrency limit); more are shown as not running.
- **Motion panel actions:** while an object's path runs, Motion-panel actions for that object are refused with a reason.
- **Recording pauses:** if a recording pauses on the fixed-step guard (a known limitation), the paths pause with the simulation and continue from the same tick on resume.

## Constraints from the project

- SI units, right-handed +Y up, -Z forward; quaternions `[x, y, z, w]`. Physics runs at a fixed 60 Hz step with render interpolation; path motion is applied in fixed steps, not render frames.
- Scene changes go through revision-checked, atomic, undoable commands with stable domain IDs; no engine objects are serialized into the scene.
- Paths run in a dedicated fixed-step path runner in `src/motion/` built on the PhysicsWorld kinematic primitives. The existing Motion workspace is not reused for this, because its runs are pinned to the Motion registry (stale after any scene edit), are cancelled when the body mode changes, and are capped at 3 m/s. The runner provides the 20 m/s speed, the hand-over that restores the configured mode with transferred velocity, the block-ends-the-path hand-over, starting all paths at take start, and switching non-kinematic objects to kinematic for the duration of the path.
- First-person look, click and wheel input is accepted only while the world runs today; painting needs a frozen state in which look, click and wheel still work. `world.reset()` disposes the first-person player today; the snap-back must keep the player.
- Recording, replay, A/B and render already record object motion per tick; paths must flow through the same recorder so a replay never re-runs the path or physics.
- The UI follows `docs/05-ux/DESIGN_SYSTEM.md`, its canonical tokens and the component, motion and FPS rules; strings exist in Traditional Chinese (canonical) and English; the Inspector point list is the keyboard and non-pointer alternative to dragging. Codex must not do UI/UX design work in this project; Claude owns the UI.
- Impact sounds are not generated while an object moves kinematically against fixed geometry; the ball's impacts begin after hand-over.
- New documents need English mirrors or must be original English; canonical specs that are pinned Wiki sources (for example `docs/10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md` and `docs/04-physics/OBJECT_STATES.md`) are updated through the Wiki ingest flow.

## What success looks like

A three-minute demo shows both flows without explanation:

1. Editor: select the speaker, press T, click four points around the listener, set Strength to 4 m/s, press Record, hear the tone circle the listener, stop, render and download the WAV. Press Record again: the take repeats exactly.
2. First person: aim at the ball, Ctrl+press and sweep a stroke across the room, press Enter: the ball follows the stroke, then flies on, bounces off the wall and makes its impact sounds.
3. Shift+T shows both curves together.

## Left to the builder

- Curve mathematics (for example centripetal Catmull-Rom) and how it is sampled into the engine's timed samples.
- The stroke simplification method and sampling density.
- Offsetting clicked or painted points from surfaces so the object's swept shape does not count as hitting them.
- The visual style of curves, points and invalid segments within the design system.
- How the existing gizmo is reused for points.
- Test design, as long as curve sampling, validation, hand-over velocity, block hand-over, simultaneous start, the Play/Record/Reset table and repeatable takes have meaningful automated tests, and the editor and painting flows have a real-browser test.
