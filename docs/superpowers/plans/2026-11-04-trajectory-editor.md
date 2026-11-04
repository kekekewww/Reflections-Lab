# Trajectory Editor (Hackathon MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users give each audible object one editable path (editor T mode or first-person Ctrl+press painting) that it travels at its Strength speed on Play/Record before handing over to normal physics, with repeatable takes.

**Architecture:** Paths live in the scene document as an optional per-object `trajectory` (offsets from the object's starting position), so they are saved, validated and undone like any scene edit. A pure path module turns a trajectory into an arc-length-timed curve; a dedicated `PathRunner` fixed-step observer moves objects kinematically along it and hands them back to their configured mode. The runtime starts a take from Play-at-ready and from Record (snapping objects back first), and the UI adds the Inspector section, viewport curves, T/Shift+T keys and first-person painting.

**Tech Stack:** TypeScript, React 19 + React Three Fiber, three.js, Rapier 0.21 (`@dimforge/rapier3d-compat`), Ajv 2020 schemas, `node --test` with `tsx`, Playwright (Chrome).

**Spec:** `docs/superpowers/specs/2026-11-03-trajectory-editor-design.md`

## Global Constraints

- SI units, right-handed +Y up, -Z forward, quaternions `[x, y, z, w]`; physics at the fixed 60 Hz step; path motion only inside fixed steps.
- Strength 0.5 to 20 m/s, default 3; start delay 0 to 30 s, default 0; face-along-path default off.
- At most 63 offsets per path (64 points with the start); travel time over 30 s marks a path invalid; at most 8 paths run per take.
- Painting brush distance 0.75 to 3 m; Ctrl is needed only at stroke start; Ctrl+T / Ctrl+Shift+T are never used.
- Keys: T toggles the selected audible object's trajectory editor, Shift+T toggles all curves, Esc leaves the editor; editor view only, never while typing (`isTyping` in `src/ui/App.tsx:33`).
- The Play/Record/Reset table in the spec is the behaviour contract.
- Every visible string exists in both `zh-TW` (canonical) and `en` in a locale catalog; UI follows `docs/05-ux/DESIGN_SYSTEM.md` and its tokens. Claude implements all UI; Codex may only take non-UI tasks (1 to 5).
- Scene edits go through the existing revision-checked, snapshot-undo `commitScene` path; no engine objects in the scene.
- Run tests with `node --import tsx --test <files>`; the repo gate is `npm run check`.

## Review Focus

1. T, Shift+T or Ctrl+press with no object, a non-audible object (floor, wall) or nothing aimed: nothing freezes or changes, a short notice explains why (tests in Tasks 5 and 6).
2. The object of an open trajectory editor is deleted, disabled or deselected: the editor closes without errors (test in Task 7).
3. The object is moved, rotated or changes mode after its path was drawn: the path follows the move and the hand-over uses the new mode (tests in Tasks 4 and 5).
4. Record pressed while a take is paused mid-way in first person: objects snap back, the player's eye position and view direction are unchanged (test in Task 5).
5. Undo right after a painted stroke restores the previous path and leaves the room at the starting layout (test in Task 6).

## File Structure

- `src/scene/types.ts`, `schemas/scene.schema.json`, `src/scene/validate-scene.ts`, `src/scene/commands.ts`: the `ObjectTrajectory` data and its validation and patching.
- `src/motion/trajectory-path.ts` (new): pure curve, timing, stroke and limit functions.
- `src/motion/path-runner.ts` (new): the fixed-step path runner.
- `src/physics/physics-world.ts`: kinematic speed parameter and fixed-geometry path check.
- `src/app/audible-objects.ts` (new): which objects are audible.
- `src/app/runtime.ts`, `src/app/view-projection.ts`, `src/ui/contracts.ts`: actions, take start, snap-back, view model.
- `src/interaction/interaction-host.ts`, `src/ui/viewport/useFPSInput.ts`: first-person painting.
- `src/ui/App.tsx`, `src/ui/Inspector.tsx`, `src/ui/inspector-trajectory.tsx` (new), `src/ui/viewport/SceneEntities.tsx`, `src/ui/viewport/TrajectoryCurves.tsx` (new), `src/ui/Viewport.tsx`, `src/ui/locales/trajectory.ts` (new), `src/ui/locales/index.ts`: editor UI.
- `tests/browser/trajectory-editor.spec.ts`, `tests/browser/trajectory-editor.config.ts` (new): real-browser flows.

---

### Task 1: Trajectory data in the scene

**Files:**
- Modify: `src/scene/types.ts:8-21`, `schemas/scene.schema.json:96-110`, `src/scene/validate-scene.ts:56`, `src/scene/commands.ts:14-26,310`, `src/ui/contracts.ts:37,256`
- Test: `tests/scene/trajectory-scene.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ObjectTrajectory {
    offsetsM: Vector3[];      // 1..63 entries, each relative to the object's positionM
    strengthMps: number;      // 0.5..20
    startDelayS: number;      // 0..30
    faceAlongPath: boolean;
  }
  // SceneObject gains: trajectory?: ObjectTrajectory
  // UpdateObject patch accepts trajectory: ObjectTrajectory | null (null deletes the key)
  // ObjectView gains trajectory?: ObjectTrajectory; ObjectPatch gains trajectory?: ObjectTrajectory | null
  export const TRAJECTORY_LIMITS = { maxOffsets: 63, minStrengthMps: 0.5, maxStrengthMps: 20, defaultStrengthMps: 3, maxStartDelayS: 30, maxDurationS: 30, maxPathsPerTake: 8 } as const; // in src/scene/types.ts
  ```

- [ ] **Step 1: Write the failing tests** in `tests/scene/trajectory-scene.test.ts`:
  - `createScene` accepts a ball with `trajectory: { offsetsM: [[1,0,0]], strengthMps: 3, startDelayS: 0, faceAlongPath: false }` and round-trips it unchanged.
  - Rejects (throws `SceneError` with code `INVALID_SCENE`): `offsetsM: []`, 64 offsets, `strengthMps: 0.4`, `strengthMps: 20.5`, `startDelayS: -1`, `startDelayS: 31`, a non-finite offset, an extra key `color`.
  - `applyCommand` with `UpdateObject { trajectory }` sets it; with `{ trajectory: null }` the resulting object has no `trajectory` key (`!("trajectory" in object)`).
  - `createProject` + `serializeProject` + `deserializeProject` (`src/persistence/index.ts:11,27,34`) keep the trajectory.
- [ ] **Step 2: Run** `node --import tsx --test tests/scene/trajectory-scene.test.ts`. Expected: FAIL (schema rejects `trajectory`).
- [ ] **Step 3: Implement**: add the optional schema property (not in `required`, `additionalProperties: false` inside), the type, `TRAJECTORY_LIMITS`, `"trajectory"` in `objectPatchKeys`, and in `UpdateObject` apply delete the key when the patch value is `null`; extend `ObjectView`/`ObjectPatch`.
- [ ] **Step 4: Run** the test file plus `node --import tsx --test tests/scene/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(scene): optional per-object trajectory`.

### Task 2: Path mathematics

**Files:**
- Create: `src/motion/trajectory-path.ts`
- Test: `tests/motion/trajectory-path.test.ts` (add the folder to `test:runtime` in `package.json`)

**Interfaces:**
- Consumes: `ObjectTrajectory`, `TRAJECTORY_LIMITS` (Task 1).
- Produces:
  ```ts
  export interface TimedPath { pointsM: Vector3[]; cumulativeM: number[]; lengthM: number; durationS: number; strengthMps: number; startDelayS: number; faceAlongPath: boolean; }
  export interface PathPose { positionM: Vector3; orientationQuaternion: Quaternion; velocityMps: Vector3; finished: boolean; }
  export function controlPoints(startM: Vector3, trajectory: ObjectTrajectory): Vector3[]; // [start, start+offset...]
  export function curvePoints(control: Vector3[], spacingM?: number /* default 0.05 */): Vector3[]; // centripetal Catmull-Rom through every control point
  export function timePath(startM: Vector3, trajectory: ObjectTrajectory): TimedPath;
  export function poseAt(path: TimedPath, baseRotation: Quaternion, elapsedS: number): PathPose; // elapsedS counts from the take start, including startDelayS
  export function simplifyStroke(strokeM: Vector3[], maxPoints: number, toleranceM?: number /* default 0.03 */): Vector3[]; // Ramer-Douglas-Peucker, then evenly thinned to maxPoints, endpoints kept
  export type PathProblem = "TOO_LONG" | "BLOCKED" | "TOO_MANY";
  ```
- [ ] **Step 1: Write the failing tests**:
  - `curvePoints` passes through every control point (each within 1e-9 m of some output point) and consecutive output spacing is at most 0.05 m + 1e-9.
  - `timePath` for start `[0,1,0]`, offsets `[[2,0,0]]`, strength 4: `lengthM` = 2 (±1e-6), `durationS` = 0.5.
  - `poseAt` at `elapsedS = startDelayS - 0.01` is the start pose with zero velocity and `finished: false`; at delay + 0.25 s the position is `[1,1,0]` (±1e-6); at delay + 0.6 s it is the end point, `finished: true`, and `velocityMps` = `[4,0,0]` (strength along the final tangent).
  - `faceAlongPath: true` yields a yaw-only quaternion whose forward `[0,0,-1]` rotates onto the horizontal tangent; `false` keeps `baseRotation`.
  - `simplifyStroke` of 500 points on a circle with `maxPoints: 63` returns at most 63 points, keeps first and last, and every input point lies within 0.15 m of the simplified polyline.
- [ ] **Step 2: Run** `node --import tsx --test tests/motion/trajectory-path.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the functions in `src/motion/trajectory-path.ts` (pure, no Rapier, no three.js).
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(motion): arc-length timed trajectory paths`.

### Task 3: Physics primitives for paths

**Files:**
- Modify: `src/physics/physics-world.ts:712-735` (`setKinematicTarget`), add a public method near `validatePlacement` (`:1111`)
- Test: `tests/physics/path-physics.test.ts`

**Interfaces:**
- Produces:
  ```ts
  setKinematicTarget(id: string, position: Vec3, rotation?: Quaternion, maxSpeedMps = 3): void; // existing callers unchanged
  firstFixedHitAlong(id: string, pointsM: readonly Vec3[], rotation: Quaternion): number | null; // index of the first segment whose swept shape hits a fixed collider; ignores dynamic, kinematic, player and self
  ```
- [ ] **Step 1: Write the failing tests**:
  - A kinematic sphere moved toward a target 1 m away with `maxSpeedMps: 20` covers 20/60 m in one fixed step (±1e-6); with the default it covers 3/60 m.
  - `firstFixedHitAlong` for the default ball and points `[[-0.8,1,0],[-0.8,1,-3],[-0.8,1,-6]]` returns `1` (back wall at z = -4.1); for points staying inside the room it returns `null`; a dynamic box placed on the segment does not count.
- [ ] **Step 2: Run** `node --import tsx --test tests/physics/path-physics.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**: the clamp at `:718` uses `maxSpeedMps * this.fixedDtSeconds`; `firstFixedHitAlong` uses Rapier `castShape` with a predicate that only accepts colliders whose record mode is `fixed`.
- [ ] **Step 4: Run** the test plus `node --import tsx --test tests/physics/*.test.ts`. Expected: PASS (existing 3 m/s callers unchanged).
- [ ] **Step 5: Commit** `feat(physics): kinematic speed limit parameter and fixed-geometry path check`.

### Task 4: PathRunner

**Files:**
- Create: `src/motion/path-runner.ts`
- Test: `tests/motion/path-runner.test.ts`

**Interfaces:**
- Consumes: `timePath`, `poseAt` (Task 2); `setKinematicTarget(..., maxSpeedMps)`, `setMode`, `setVelocity`, `observeFixedSteps` (Task 3 / existing).
- Produces:
  ```ts
  export type PathRunStatus = "delayed" | "moving" | "finished" | "blocked";
  export interface PathRunView { objectId: string; status: PathRunStatus; elapsedS: number; }
  export class PathRunner {
    constructor(world: PhysicsWorld, onChange?: () => void); // registers itself with world.observeFixedSteps
    beginTake(scene: SceneSpec, runnable: ReadonlySet<string>): PathRunView[]; // runnable = audible, valid, at most 8, sorted by id
    clear(): void;                 // called on reset; no world calls
    isRunning(objectId: string): boolean; // delayed or moving
    view(): PathRunView[];
    dispose(): void;
  }
  ```
  Behaviour: at `beginTake` each runnable object is switched to `kinematic` (original mode remembered). Each fixed step it is targeted at `poseAt(path, sceneRotation, elapsedS)` with `maxSpeedMps = 20`. At `finished` it returns to its original mode; a dynamic original mode gets `setVelocity(id, pose.velocityMps)`. `KINEMATIC_BLOCKED` ends the run as `blocked` and hands over with the path velocity at that instant. Pausing the world simply stops steps, so runs continue on resume.
- [ ] **Step 1: Write the failing tests** (real `PhysicsWorld` with `createDefaultScene()`):
  - Ball, offsets `[[0,0,-2]]`, strength 4, delay 0: after `ceil(0.5 * 60)` steps the run is `finished`, the ball mode is `dynamicGravity`, its z velocity is -4 (±0.05), and its position is the end point (±0.02).
  - Speaker (fixed), offsets `[[1,0,0]]`: after finishing the speaker mode is `fixed` and stays at the end point for 60 more steps.
  - Start delay 0.5 s: for the first 30 steps the ball stays at its start (±1e-6) and does not fall.
  - A dynamic box placed in the path: the run ends `blocked` and the ball is dynamic again before reaching the box.
  - Two takes from `world.reset(scene)` produce identical ball positions every tick (exact equality).
  - Nine objects with paths: only 8 run (lexical id order).
  - The scene ball moved to `[0,1,0]` before `beginTake`: the path starts at `[0,1,0]` (offsets move with the object).
- [ ] **Step 2: Run** `node --import tsx --test tests/motion/path-runner.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `PathRunner` in `src/motion/path-runner.ts` (fixed-step `beforeStep` targets, `afterStep` advances `elapsedS` by `world.fixedDtSeconds` and finishes runs).
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(motion): fixed-step path runner with physics hand-over`.

### Task 5: Runtime integration (actions, takes, snap-back, view model)

**Files:**
- Create: `src/app/audible-objects.ts`
- Modify: `src/app/runtime.ts` (`dispatch` `:2737`, `run` `:2920`, `reset` `:2947`, `recordToggle` `:3310`, `motionStart` `:3430`, publication `:3895`), `src/app/view-projection.ts:56`, `src/ui/contracts.ts`
- Test: `tests/app/trajectory-runtime.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 4.
- Produces:
  ```ts
  export function audibleObjectIds(scene: SceneSpec, behaviors: SoundBehaviorDocument): Set<string>; // enabled binding or a source on the object
  // LabAction additions
  | { type: "setTrajectory"; objectId: string; trajectory: ObjectTrajectory | null }
  // LabViewModel additions
  trajectoryStatus: Record<string, { lengthM: number; durationS: number; valid: boolean; problem?: PathProblem }>;
  pathRuns: PathRunView[];
  // ObjectView addition
  audible: boolean;
  ```
  Runtime rules: `setTrajectory` refuses non-audible objects (`TRAJECTORY_NOT_AUDIBLE`) and commits through `commitScene(..., remember = true)`. `run` from `ready` (paused and tick 0) calls `pathRunner.beginTake` before resuming; `run` from `paused` only resumes. `recordToggle` start: if tick > 0, first run the reset core with the first-person player kept, then `beginTake`, then the existing start sequence. `reset` calls `pathRunner.clear()`. `motionStart` for an object with `isRunning` throws `MOTION_PATH_ACTIVE`. Extract the reset body into `private async resetCore(options: { keepPlayer: boolean })`; keeping the player means reading `world.getPlayerPose()` before `world.reset` and calling `world.createPlayer(footM)` after it, where `footM` puts the eye back at the same height. `trajectoryStatus` is recomputed only when the scene revision changes.
- [ ] **Step 1: Write the failing tests** (a `LabRuntime.create({...})` runtime as in `tests/app/integration-regressions.test.ts:31`):
  - `setTrajectory` on the floor is refused with `TRAJECTORY_NOT_AUDIBLE` and the scene revision is unchanged; on the ball it is saved, and `undo` removes it.
  - Play at ready: after 1 s the ball has followed its path (`pathRuns[0].status` is `finished`); Pause, then Play: the run continues from the same elapsed time (no restart).
  - Record at tick > 0 with first-person entered: the ball's starting position is restored before recording begins, `pathRuns` restarts from elapsed 0, and the player's eye position is unchanged (±1 mm) and the host yaw and pitch are unchanged.
  - Reset: `pathRuns` is empty and objects are at their scene positions.
  - `motionStart` for the ball while its path runs throws `MOTION_PATH_ACTIVE`.
  - A path into the back wall publishes `trajectoryStatus.ball` with `valid: false, problem: "BLOCKED"` and is not run by Play.
  - `audible` is true for `ball` and `speaker`, false for `floor`.
  - Moving the ball (patchObject `positionM`) after setting its path keeps the same offsets; the next take starts at the new position. Changing its mode to `dynamicNoGravity` makes the hand-over use that mode.
- [ ] **Step 2: Run** `node --import tsx --test tests/app/trajectory-runtime.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the rules above.
- [ ] **Step 4: Run** the test plus `npm run test:runtime`. Expected: PASS, with no change to existing results.
- [ ] **Step 5: Commit** `feat(runtime): trajectory takes, record snap-back and path status`.

### Task 6: First-person painting

**Files:**
- Modify: `src/interaction/interaction-host.ts` (`active()` `:114`, `handleLook` `:353`, `handlePointer` `:377`, `handleWheel` `:426`, `snapshot()`), `src/ui/viewport/useFPSInput.ts` (`pointerDown` `:244`, `pointerUp` `:263`, `look` `:271`), `src/app/runtime.ts`, `src/ui/contracts.ts`
- Test: `tests/interaction-runtime/paint.test.ts`, `src/ui/viewport/fps-entry-coordination.test.ts` (new cases), `tests/app/trajectory-runtime.test.ts` (new cases)

**Interfaces:**
- Consumes: `simplifyStroke` (Task 2), `resetCore`, `audibleObjectIds`, `setTrajectory` commit path (Task 5).
- Produces:
  ```ts
  // LabAction additions
  | { type: "paintStart" } | { type: "paintEnd" }
  // LabViewModel addition
  paint: { objectId: string; pointsM: Vector3[]; distanceM: number } | null;
  // InteractionHost
  beginPaint(objectId: string, startM: Vector3): void; // distance = |camera - startM| clamped to 0.75..3
  endPaint(): Vector3[];   // the raw stroke, then clears paint state
  get painting(): boolean;
  ```
  Rules: `paintStart` uses the aimed object from `interaction.snapshot().hover`; it is refused with a notice when nothing is aimed, the object is not audible, or recording or replay is active, and in those cases nothing pauses. Otherwise the runtime runs `resetCore({ keepPlayer: true })`, then `beginPaint(objectId, scene start position)`. While painting, `active()` is true although the world is paused. `handleLook` updates yaw and pitch and appends a brush point when it moved at least 0.05 m. The brush is `camera + forward * distance`, or the first surface hit closer than that, offset by the object's radius + 0.01 m along the hit normal; the painted object is excluded from the ray. `handleWheel` changes the distance (0.75..3). `handlePointer` and `handleKey` ignore input. `paintEnd` simplifies to 63 points, converts to offsets from the scene start and commits `setTrajectory` (keeping strength, delay and face-along-path from the previous path, or the defaults); the world stays at `ready`. In `useFPSInput`, `pointerDown` with `event.ctrlKey && button === 0` while locked and armed dispatches `paintStart` instead of `inputPointer`; `look` also forwards while `model.paint` is non-null; `pointerUp` of button 0 while painting dispatches `paintEnd`. Walking while painting is out of scope: the world is frozen, so the player cannot move.
- [ ] **Step 1: Write the failing tests**:
  - Host: after `beginPaint`, ten `handleLook(40, 0)` calls produce more than 5 stroke points, all at the start distance from the camera unless a wall is closer; `handleWheel(+500)` clamps the distance to 3; `handlePointer(0, true)` does not grab.
  - Runtime: `paintStart` aiming at the ball while running pauses the world at tick 0 and keeps the player's eye position; `paintEnd` saves a trajectory with at most 63 offsets whose first world point is within 0.2 m of the ball start; `undo` restores the previous path (Review Focus 5).
  - Runtime: `paintStart` aiming at the floor, at nothing, or during recording leaves the world running, `paint` null, and sets a notice (Review Focus 1).
  - Hook: Ctrl+left press while locked dispatches `paintStart` and no `inputPointer`; look events while `model.paint` is set are forwarded although `simulationState` is `ready`; release dispatches `paintEnd`.
- [ ] **Step 2: Run** `node --import tsx --test tests/interaction-runtime/paint.test.ts src/ui/viewport/fps-entry-coordination.test.ts tests/app/trajectory-runtime.test.ts`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** the rules above.
- [ ] **Step 4: Run** the same command plus `npm run test:runtime`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(fps): Ctrl+press painting of an object's path`.

### Task 7: Editor UI (Claude only)

**Files:**
- Create: `src/ui/inspector-trajectory.tsx`, `src/ui/viewport/TrajectoryCurves.tsx`, `src/ui/locales/trajectory.ts`
- Modify: `src/ui/App.tsx:378-402` (keys), `src/ui/Inspector.tsx` (after the Rigid body section `:1114`), `src/ui/viewport/SceneEntities.tsx:102-111` (click), `src/ui/Viewport.tsx` (mount curves, edit hint), `src/ui/locales/index.ts`
- Test: `src/ui/trajectory-ui.test.ts`

**Interfaces:**
- Consumes: `ObjectView.trajectory`, `ObjectView.audible`, `trajectoryStatus`, `paint`, `setTrajectory` (Tasks 1, 5, 6); `curvePoints`, `controlPoints` (Task 2); `Section`, `NumberField` (`src/ui/components.tsx:251,137`).
- Produces:
  ```ts
  export interface TrajectoryUiState { editingObjectId: string | null; showAll: boolean; selectedPointIndex: number | null; }
  export function trajectoryKeyAction(event: { code: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; typing: boolean; composing: boolean }, model: Pick<LabViewModel, "interactionMode" | "selectedObjectId" | "objects">, state: TrajectoryUiState): TrajectoryUiState | null; // null = not handled; in src/ui/inspector-trajectory.tsx
  export function TrajectorySection(props: { object: ObjectView; status?: LabViewModel["trajectoryStatus"][string]; state: TrajectoryUiState; dispatch: LabController["dispatch"]; disabled: boolean }): JSX.Element;
  export function TrajectoryCurves(props: { model: LabViewModel; state: TrajectoryUiState; onSelectPoint(index: number): void; onMovePoint(index: number, worldM: Vector3): void }): JSX.Element;
  ```
  Behaviour: T toggles `editingObjectId` for the selected audible object (otherwise a notice); Shift+T toggles `showAll`; Esc clears `editingObjectId`; ignored when typing, composing, with Ctrl/Meta/Alt, or outside the editor view. While editing, clicking an object surface appends an offset (`event.point + event.face.normal * (radius + 0.01) - object.positionM`) instead of selecting. Curves are visible for the edited object, during painting (the live stroke from `model.paint`) and for all objects when `showAll`. Invalid paths are dashed in the warning token colour. Control points are small handles; the selected handle gets a translate-only `TransformControls` that commits one `setTrajectory` on mouseUp. Inspector section (audible objects only): point list with X/Y/Z `NumberField`s in world coordinates, insert-after and delete per point, Strength (0.5 to 20, unit m/s), Start delay (0 to 30, unit s), Face along path checkbox, Clear path button, and a status line with length, duration and the problem reason. Fields are disabled while running (same rule as `canEdit`, `Inspector.tsx:968`). The editor closes when its object is deleted, disabled or deselected (Review Focus 2).
- [ ] **Step 1: Write the failing tests** in `src/ui/trajectory-ui.test.ts` (static render, as the existing `src/ui/*.test.ts` do):
  - `trajectoryKeyAction` returns the toggled state for `KeyT` with the ball selected, `null` while typing, `null` with Ctrl, a `showAll` toggle for Shift+T, and `editingObjectId: null` for Esc.
  - T with the floor or nothing selected returns `null` (Review Focus 1).
  - `TrajectorySection` for a ball with two offsets renders two point rows with world coordinates (offset + position), a Strength field with min 0.5 and max 20, and the "too long" reason when the status says `TOO_LONG`; it renders nothing for a non-audible object.
  - With `editingObjectId` set to an object that is no longer in `model.objects`, the next `trajectoryKeyAction`/render path yields `editingObjectId: null`.
  - Every new message key exists in both `zh-TW` and `en`.
- [ ] **Step 2: Run** `node --import tsx --test src/ui/trajectory-ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the components and wiring, following the design system tokens and the existing Inspector field patterns.
- [ ] **Step 4: Run** `node --import tsx --test src/ui/*.test.ts src/ui/viewport/*.test.ts`, `npm run typecheck`, `npm run lint`, `npm run validate:design`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): trajectory editor, curves and Inspector section`.

### Task 8: Real-browser flows, docs and gate

**Files:**
- Create: `tests/browser/trajectory-editor.spec.ts`, `tests/browser/trajectory-editor.config.ts` (copy the `pointerlock-race.config.ts` pattern, preview `test-results/ui-preview-dist`)
- Modify: `docs/11-v1/PARAMETER_REFERENCE.md` (new "Trajectory" section) and its English mirror under `docs/en/`, `docs/11-v1/FULL_TEST_PROCEDURE.md` (add the new command), `knowledge/` (checkpoint)
- Test: the browser spec

- [ ] **Step 1: Write the browser tests** (canvas selector `.viewport-canvas-wrap canvas`):
  - Editor: select the ball, press T, click the floor twice, check two point rows in the Inspector, set Strength to 4, press Start; within 3 s `window.__reflectionLab.getSnapshot().pathRuns[0].status` is `finished` and the ball is dynamic again; Shift+T toggles the viewport's `data-trajectory-curves` attribute count.
  - Record twice from the same layout: the ball positions captured at tick 30 are identical in both recordings.
  - First person: enter first person, aim at the ball, hold Control, press the left button, release Control, move the mouse, release the button; the ball now has a trajectory and the simulation state is `ready`; Enter starts the take.
- [ ] **Step 2: Run** `node tests/browser/build-ui-preview.mjs` then `npx playwright test --config tests/browser/trajectory-editor.config.ts`. Expected: PASS.
- [ ] **Step 3: Write** the PARAMETER_REFERENCE section (keys, fields, ranges, take table), its English mirror, then `node scripts/validation/english-docs.mjs inventory` / `finalize` / `check` (PASS) and a Wiki checkpoint.
- [ ] **Step 4: Run** `npm run check`. Expected: exit 0.
- [ ] **Step 5: Commit** `test(browser): trajectory editor flows; docs: trajectory parameters`.
