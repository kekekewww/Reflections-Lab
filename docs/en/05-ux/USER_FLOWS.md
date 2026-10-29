<!-- english-source: {"path":"docs/05-ux/USER_FLOWS.md","sha256":"0e110f0877ce8962df9aa6c162f38e18d48172c7bf9ded44fcc7607f9a582ec0","translated_at":"2026-10-27T03:43:14.383Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/USER_FLOWS.md`](../../05-ux/USER_FLOWS.md). Source SHA-256: `0e110f0877ce8962df9aa6c162f38e18d48172c7bf9ded44fcc7607f9a582ec0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="核心操作流程與驗收情境"></a>
# Core User Flows and Acceptance Scenarios

Review date: 2026-10-26. Status: **Flow specifications established; all acceptance scenarios below are NOT RUN**. The default architecture is Web 3D/physics/Web Audio; a native backend is an optional capability and does not affect whether the basic flows can be reviewed. These flows are Reflection Lab designs; official competitor references are in [COMPETITIVE_UX_RESEARCH.md](COMPETITIVE_UX_RESEARCH.md).

<!-- english-original-anchor --> <a id="u01第一次建立可聆聽實驗p0"></a>
## U01: Create an Audible Experiment for the First Time (P0)

**Goal**: Hear the ball's continuous source and collision sounds under understandable initial conditions. **Preconditions**: A blank Document, simulation Ready, monitor muted; manual completion is possible without an API key.

1. Opening the project shows “Create room/Open example/Blank scene”; examples label materials synthetic/demo and do not call them measured materials.
2. Choose “Create room” and enter dimensions in meters. Show units directly; retain invalid numeric input and explain each affected field.
3. Choose Sphere in the Library and set size and position in the Scene preview; enable “Add” only after collision and boundary validation passes. Scene Explorer and Inspector both select the new object ID.
4. Set Dynamic, mass, and gravity; add a licensed built-in sound or an owned audio file in Sound Emitter, and separately select a Collision Profile. Audio-file loading/decoding failures show their respective states; silent physics tests remain available.
5. Add a Listener, or explicitly select “Listener follows first person.” Press “Enable listening” to resume AudioContext through a user gesture, with a low initial monitor gain; volume changes monitoring only.
6. Press Run to create a run ID. Gravity moves the ball, collisions do not interrupt the continuous source, and the event list adds contact sound effects; explicitly show the backend model and currently supported capabilities.
7. Mute/Pause is directly available at any time. Separately show “Simulation still running/Sound muted” to prevent users from mistakenly thinking there are no results.

**Success**: Document revision, run ID, source/listener, and known model limitations can be inspected; whether the sound is pleasing is not evidence of success. **Failure handling**: When the browser blocks audio, retain an explicit enable button; solver errors stop new results, preserve the last snapshot, and mark it stale; microphone permission is unnecessary and must not be requested for simple playback.

**Acceptance**: Can be completed without AI; Mute does not stop ticks; an unloaded source audio file cannot be falsely labeled “Playing.”

<!-- english-original-anchor --> <a id="u02第一人稱抓取投擲與擷取p0"></a>
## U02: First-Person Grab, Throw, and Capture (P0)

**Preconditions**: A valid room, grabbable body, and continuous emitter, with Run started; recording is available but cross-platform determinism is not claimed.

1. Switch to Simulation Workspace without resetting the run; click “Enter first person.” First show the actual E/G/Throw/B/Esc key bindings, then acquire lock; consume the click that acquires lock.
2. Aim the crosshair at the ball; hover shows its name and grabbable state; press E. HUD shows mass, distance, and dynamic state. The object moves toward a collision-constrained anchor.
3. Adjust distance; press R to rotate, with a toggle alternative available; the camera does not rotate at the same time during the same input interval.
4. If still locked before pressing “Start recording,” first safely pause and exit to the UI; show the recorded range and run ID. After starting, explicitly offer return to FPS/Resume.
5. A new left-button press applies the visibly configured throw impulse; grabbing ends, and the subsequent collision produces an impact event at the contact; the continuous source continues.
6. Esc releases the mouse and safely pauses; the event log records the pause cause; finish recording to obtain an Experiment Snapshot.

**Branches**: E releases while preserving velocity; G gently places the object after support-surface validation; F fixes it, ending the grab while retaining the source. Failed grabs show a reason, such as fixed, out of reach, or mass limit. **Success**: At minimum, save initial scene revision, fixed step, versions, trajectory or snapshot trace, and collision and sound events. **Recovery**: A lock error still permits reproduction using buttons/preset trajectories; blur does not automatically Resume.

**Acceptance**: The impact event position is not the camera; the last click before throwing must be a new press after lock; recording gaps and pauses are not hidden.

<!-- english-original-anchor --> <a id="u03第一人稱建造p0-互動核心聲學更新依-capability"></a>
## U03: First-Person Building (P0 Interaction Core; Acoustic Updates Depend on Capability)

**Preconditions**: FPS Idle, no Holding; Document is editable.

1. B enters BuildIdle, and the HUD explicitly shows “Build.” L opens the Library, exits lock, and safely pauses; search Cube/Wall/Sphere; UI clicks are not sent to the world.
2. After selecting an object, enter initial dimensions and material, then press “Return to preview”; reacquire lock through a gesture. Ghost shows surface normal, dimensions, distance, grid step, rotation, and validity.
3. Move the crosshair for surface raycasts; wheel adjusts distance, while rotation and alignment options adjust orientation. If there is no surface, the placement passes through a wall, overlaps the player, or exceeds Domain bounds, show a textual reason and prohibit submission.
4. Confirm placement: pause at the tick boundary→revalidate→one undoable command creates the staged object→update backend geometry. Show “Created/Awaiting activation”; it cannot play or collide early.
5. After ack, choose Dynamic/No Gravity/Fixed and “Activate,” then explicitly offer Resume. If dynamic reflecting geometry is unsupported, retain the fixed-obstacle option and capability notice; do not show nonexistent dynamic paths.
6. Canceling the ghost does not modify the Document; Undo of a committed build is one transaction. Duplicate reenters ghost and produces a new ID.

**Errors**: If another command changes the position during confirmation, recompute the preview after the version conflict; geometry failure rolls back the transaction or preserves a clearly marked staged object for correction; repeated clicks are deduplicated by command ID. **Acceptance**: Ghost/staged/active are distinguishable phases; invalid placement leaves no object; Tab can still exit the canvas to the UI.

<!-- english-original-anchor --> <a id="u04選取反射並檢驗聲學結果p1"></a>
## U04: Select a Reflection and Inspect Acoustic Results (P1)

**Preconditions**: A computed ResultSnapshot exists; if the backend has no `individualPaths`, use the IR/aggregate-result flow and explain it clearly.

1. Switch to Analysis, retaining the run; select source, listener, and result/frame, showing model, version, time, stale status, and validation level.
2. When individual paths are available, enable Direct/Reflection/Transmission layers and filter by order, band, and energy threshold. Filters change only the display; record “Showing 18/240 paths” rather than silently deleting solver data.
3. Pause or pin the frame and click a 3D path or path table; overlapping lines produce a candidate list. Precise 3D clicking is not the only way to select a path.
4. The same SelectionRef simultaneously highlights geometry/the corresponding table row/RIR arrival marker. Inspector shows path ID, surface IDs, order, distance, absolute and relative time, band attenuation, arrival direction, material contribution, solver, and limitations.
5. If the data source has no reliable confidence, show “Not provided” and use validation status instead of an invented percentage. Relative time uses the direct path for the same source/listener/frame as the reference; if no reference exists, leave it blank and explain.
6. Export metadata and data; a focused highlight in a chart is not a new solver result. Selecting a disappeared path retains its snapshot and marks it absent from the current frame.

**Success**: Users can answer “Which model and frame produced this line, which surfaces did it hit, and how is delay defined?” **Errors**: Do not force an inference when an IR arrival peak cannot be mapped to a discrete path; show unavailable/invalid fit for insufficient bands, truncated IR, or invalid RT fit, rather than attractive but misleading metrics.

<!-- english-original-anchor --> <a id="u05rawsimulated-聆聽p1"></a>
## U05: Raw/Simulated Listening (P1)

Raw is a **dry-signal reference mode**, distinct from “Experiment A/B.” The explicit Raw/Simulated routing is in [COMPONENT_SPEC.md](COMPONENT_SPEC.md).

1. Select the same recorded source event/fixed waveform (fixed seed), showing the current listener, time, volume, and whether level match is active.
2. Raw plays a centered dry reference without environmental propagation/HRTF; Simulated plays through the route of the currently labeled backend. A readable routing summary appears before switching; Raw cannot be called measured ground truth.
3. Switching changes monitoring only, crossfading on the audio timeline while preserving event time; it does not reset physics, stop continuous sources, or retrigger random samples. Show whether propagation delay is retained; do not silently align times.
4. Optional level match is a listening aid only; show the correction gain without rewriting original metrics; do not claim the comparison still represents original absolute energy after enabling it.
5. Both modes support Mute; show audio context blocked/device error separately. Leaving the page does not automatically resume with a higher gain.

**Acceptance**: Run ID, source playhead, collision events, and results do not change when switching; audible differences cannot replace numerical validation; a backend without HRTF must be labeled truthfully.

<!-- english-original-anchor --> <a id="u06材質-ab-與相同運動比較p1完整-replay-為-p2"></a>
## U06: Material A/B and Identical-Motion Comparison (P1; Full Replay Is P2)

**Preconditions**: Experiment A, motion trace, collision/source event trace, seed, and backend/material versions have been saved, rather than only keyboard input.

1. Choose “Create B” on the A card, copy the initial scene/recording references, and change only one acoustic material. Show the diff: surface ID, material version, coefficient provenance, and changed bands.
2. Select a comparison method: `trajectory replay` fixes transforms, source/listener, and event traces, recalculating acoustics only; changes to friction/mass/geometry require another physics run, labeled “Motion conditions changed; this is not a controlled experiment of material alone.”
3. Preflight backend, sample rate, time range, source asset checksum, listener trajectory, and validity. Different versions may be compared with a visible caveat; do not automatically claim direct attribution.
4. Run B; show progress as queued/running/failed/completed. Failure preserves A and does not overwrite an old B; cancellation does not pretend there is a completed result.
5. Show A/B metrics, units, definitions, bands, and valid intervals side by side/overlaid; linked selection can use the same source/listener/event. Do not force the same ID onto paths with different topologies; show “No corresponding path.”
6. A/B listening uses the same event and an explicit alignment strategy; list optional level match and actual gain separately. The report identifies Computed/Estimated/Measured and unvalidated items.

**Success**: Differences are traceable to conditions and data; accuracy is not judged by “sounds better.” **When full replay is missing**: Provide an isolated comparison with fixed source/listener+preset trajectory; label “Recorded replay not yet supported,” rather than calling a new manual throw the same conditions.

<!-- english-original-anchor --> <a id="u07ai-場景命令p1"></a>
## U07: AI Scene Commands (P1)

1. Open the Command Palette with a visible button, relinquishing FPS input first; describe “A room with a wooden floor, a continuously sounding metal ball, and no gravity,” and submit to the configured provider.
2. If the model is unconfigured/credit is insufficient, retain the input and manual tools without blocking the Sandbox. Show execution states draft→validating→preview→applying→complete/error; generated text alone is not success.
3. Domain Validator checks IDs, units, coefficients, and resource budgets, showing the add/modify/delete diff, pause requirements, and data used. Label material data unknown to AI estimated/demo; do not invent measured values.
4. After the user presses “Apply,” execute as one undoable transaction; revision conflicts require a new preview rather than forced overwrite. Control dangerous reset/bulk-object operations with a summary of concrete effects; ordinary undoable edits do not add unnecessary confirmations.
5. AI explanations may cite only results returned by tools, showing result ID/solver/validation; when no result exists, explicitly state it has not run.

**Acceptance**: Rejection or error leaves no partial scene; one Undo reverses the batch; E/WASD does not affect objects during text input.

<!-- english-original-anchor --> <a id="u08中斷與恢復p0"></a>
## U08: Interruption and Recovery (P0)

| Trigger | Immediate Behavior | Recovery/Data Handling |
| --- | --- | --- |
| Esc, lock loss, blur | Clear inputs, safely pause, show reason; no additional throw/drop | Explicit reentry+Resume; preserve held snapshot/ghost |
| Audio device/context error | Monitor stops, physics may continue; show “Silent, still recording” | User chooses recovery; record trace has a gap, with no claim of complete audio recording |
| Acoustic worker timeout | Mark the last result stale and stop publishing new frames | Retry/reduce fidelity/switch fallback; switching backend produces new result metadata |
| Document unsaved/disk failure | Show “Scene not saved” and retain in memory | Retry/save as/export; do not overwrite with an empty file |
| Reset | Show target revision, stop the run, and preserve completed results | Ready initial state; finalize incomplete recording as interrupted first |
| Browser refresh/close | Use platform-supported reminders for unsaved work, without guaranteeing closure can be prevented | Next time, offer to restore the latest valid document; do not claim runtime recovery without successful persistence |

<!-- english-original-anchor --> <a id="人工驗收記錄模板"></a>
## Manual Acceptance Record Template

For each execution, record `flowId`, build/version, OS/browser/input, backend, scene/result IDs, preconditions, expected/actual, observed error, recovery, PASS/PARTIAL/FAIL/NOT RUN, and evidence paths. Classify usability errors as: wrong mode, wrong focus, accidental deletion/Reset, misunderstood units, or mistaking estimates for measurements. Report them separately from mathematical/DSP validation.

Platform references: [W3C Pointer Lock 2.0](https://www.w3.org/TR/pointerlock-2/), [Web Audio API](https://www.w3.org/TR/webaudio-1.0/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/). This is currently a specification, not browser compatibility or accessibility test results.
