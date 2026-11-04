<!-- english-source: {"path":"docs/11-v1/FULL_TEST_PROCEDURE.md","sha256":"1b29bc127d543ab6232e3b344256354d7648116cd9b4c46b8147717000d46373","translated_at":"2026-11-03T20:28:27.000Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/FULL_TEST_PROCEDURE.md`](../../11-v1/FULL_TEST_PROCEDURE.md). Source SHA-256: `1b29bc127d543ab6232e3b344256354d7648116cd9b4c46b8147717000d46373`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="完整測試流程r19r20r21"></a>
# Complete test procedure (R19/R20/R21)

This page combines automated verification and hands-on human testing for branch `claude/meta-hack-r18-handoff-d292c8`: R19 product checkpoint `5e56260b1a9242e29c4afe6ce393bd8a37986320` plus the repairs made after the R20 automated retest and the R21 changes made for the user's 2026-11-01 report: first-person mouse controls and direct building, audio buffering and the dropout fix, and interface help moved into hover tooltips (see [known limitations](../KNOWN_LIMITATIONS.md) and the [acceptance amendments](ACCEPTANCE_AMENDMENTS.md)); `git log -1` gives the actual version. The unit, range and default of every parameter are in the [parameter reference](PARAMETER_REFERENCE.md). The three R19 retests (first person, direct manipulation, default level) still follow the [human test guide at normal scale](HUMAN_TEST_GUIDE.md); this page covers the remaining scope and gives an order and a report format.

Section numbers on this page are new and differ from the R18 conversation manual; each section states the status R18 recorded. Completing this procedure does not mean the first version is complete: the R17 600-second performance FAIL, device listening and external gates are recorded separately; see [known limitations](../KNOWN_LIMITATIONS.md) and [acceptance](ACCEPTANCE.md). Keep the browser at normal 100% scale; 200% zoom is no longer a gate.

<!-- english-original-anchor --> <a id="目前進度"></a>
## Current progress

| Item                                                        | Status                                                                                  | Basis                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| No control after entering first person (R18 blocker)        | Repaired; automated tests pass; awaiting human retest                                   | [R19 verification record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/50eff1a6f87323c9a90eff221c2a40e9e9193c0e) |
| Direct scene selection, move, rotate, scale                 | Implemented; automated tests pass; awaiting human retest                                | Same                                                                                   |
| Default level too quiet                                     | Monitor default 0 dB, headroom −6 dB; digital peak about −51 → −29 dBFS; awaiting listening | Same; digital level only                                                            |
| Building unintuitive, cannot leave build mode (R21 report)  | Left click grabs / throws, hold the right button to preview and release to place; automated tests pass; awaiting human retest | [R21 report](../../11-v1/USER_TEST_FEEDBACK_20261101-r21.json) |
| Audio breaks up (R21 report)                                | Default Stable buffer, redundant parameter automation removed; headless output underruns fell sharply; awaiting listening | [R21 audio measurements](archive://uncommitted-local/artifacts/v1/r21-audio-smoothness-20261101) |
| Materials and reflections                                   | NOT TESTED (not tested in R18)                                                          | [R18 report](../../11-v1/USER_TEST_FEEDBACK_20261029-r18.json)                                     |
| Recording/replay, A/B, save/import/export, offline assistant | UNVERIFIED (R18 manual section 9 onward)                                               | Same                                                                                   |
| 600-second performance                                      | FAIL (R17), retained                                                                    | [Known limitations](../KNOWN_LIMITATIONS.md)                                           |
| Hi-x65 / D3V device listening                               | NOT RUN                                                                                 | [Listening tool](../../../tests/browser/device-hearing-v3/README.md)                      |
| Meta Model API live                                         | The three authorized requests are used up; this procedure sends none                    | [User guide](../../11-v1/USER_GUIDE.en.md)                                                         |

RLAB-TASK-0022 is BLOCKED, awaiting the human R19 retest; the branch is not pushed or merged. All automated evidence comes from headless Chrome with CDP input, so physical keyboard and mouse, a human Pointer Lock, visual quality, usability and listening all need the human testing on this page.

<!-- english-original-anchor --> <a id="測試前準備"></a>
## Before testing

1. Check that Node/npm match `.node-version` and `package.json`; if `node_modules` is missing, run `npm ci` once in the project directory.
2. Run `npm run dev` in the project directory. It starts the Vite web app (`http://127.0.0.1:5173/`) and the local API service; press Ctrl+C in the terminal that started it to stop. If an agent started it, ask the agent to stop it.
3. Use Chrome at 100% scale with the window maximized. Note the Chrome version (type `chrome://version` in the address bar) and the Windows version.
4. **Lower the Windows / DAC / speaker physical volume first**, and start with headphones. The R19 default monitor level is about 23 dB louder than R18 (digital level).
5. For a clean state, use a new Chrome profile or an incognito window; closing an incognito window discards local projects and recordings, so do the B11 reload test within the same window.
6. B11 needs a short PCM/float WAV (1 to 5 seconds suggested, 120 seconds maximum) that you have the right to use. If `.cache/human-test/test-tone-440hz-1s.wav` exists locally, it is a self-synthesized 1-second 440 Hz sine with no third-party rights and can be used directly.

<!-- english-original-anchor --> <a id="a-自動化驗證"></a>
## A. Automated verification

Run by a developer or an agent to confirm there is no regression; it does not replace the human testing in section B. Run in order and read the results; the results column shows the final R21 working tree ([R21 final verification](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ab0b1838a7e4d7eb0152047367f0299dd336049d)); the corresponding R20 numbers were 137, 445 and 37.

```powershell
npm run check
node --import tsx --test src/ui/*.test.ts src/ui/viewport/*.test.ts tests/app/fps-entry-race.test.ts tests/interaction-runtime/*.test.ts
node --import tsx --test tests/audio-runtime/*.test.ts tests/app/*.test.ts
node tests/browser/build-ui-preview.mjs
npx playwright test --config tests/browser/ui-refined-v2.config.ts
npx playwright test --config tests/browser/pointerlock-race.config.ts
npx playwright test --config tests/browser/linked-workflow-v2.config.ts
npx playwright test --config tests/browser/trajectory-editor.config.ts
npm run test:browser:physics
npm run test:browser:storage
node tests/browser/build-product-preview.mjs
node tests/browser/run-product-refined-v3.mjs
node tests/browser/audio-smoothness/run.mjs --seconds 20 --scenario editor,fps-walk --variant tap=0 --out <output-folder>
```

| Command                                      | R21 result | Notes                                                                                   |
| -------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `npm run check`                              | see the [receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8799b0c018427bcd80ba12fd509ff3cf2197fd9b) | Research regressions, runtime, build, licenses and English docs; no browser, native or listening |
| UI / viewport / interaction / race unit tests | 175 pass  | First-person entry coordination, gizmo and interaction host                             |
| audio-runtime / app unit tests               | 526 pass   | Monitor level, safety ceiling and runtime                                               |
| ui-refined-v2                                | 47 pass    | Run `build-ui-preview.mjs` first, or it tests a stale preview                           |
| pointerlock-race                             | 2 pass     | Pointer-lock races and recovery                                                         |
| linked-workflow-v2                           | 8 pass     | Linked scene, path and event workflows                                                  |
| trajectory-editor                            | 3 pass (added 2026-11-04, not an R21 result) | Trajectory editor: T and two floor clicks, Strength 4 m/s and Start hand the ball back to physics, Shift+T; two recordings from the same layout are identical tick by tick through tick 30; first-person Ctrl + left press painting, then Enter starts the take. Run `build-ui-preview.mjs` first; under load a recording may pause at a whole tick, and the test continues it with the product's Resume and records how often |
| `test:browser:physics`                       | 2 pass     | Physics lifecycle; leaves an untracked record under `artifacts/v1/`                     |
| `test:browser:storage`                       | 5 pass     | Local storage; leaves an untracked record under `artifacts/v1/`                         |
| product refined v3                           | 4 pass     | Run `build-product-preview.mjs` first; check that source/bundle provenance is true      |
| Audio smoothness measurement                 | 1 output underrun per 20 s | Chrome `playbackStats` in headless Chrome; 1 each in the editor and first-person walk (R20: 19 and 14); not a listening test |

The legacy entries `npm run test:browser:ui` (5 pass / 8 fail) and `npm run test:browser:product` (4 fail) fail the same way on baseline `a5f2a90`; they are old tests written before the R17 interface disclosures. Do not delete them, and do not treat them as new regressions. R21 changed only their assertions about the build flow and the reverb explanation, following the acceptance amendments; the failure counts still match the baseline.

These browser tests use their own preview ports, so `npm run dev` can keep running. Keep the untracked records the tests produce; do not delete them. If you suspect a stale tsx cache, set `TSX_DISABLE_CACHE=1` and rerun the unit tests.

Not covered by automation: physical keyboard and mouse and a human Pointer Lock, device listening, the 600-second performance profile (see [browser performance](BROWSER_PERFORMANCE.md)), the native accessibility runner, and Meta live.

<!-- english-original-anchor --> <a id="b-真人測試"></a>
## B. Human testing

For each section, record "pass / fail / not tested" with the concrete steps. Write "not tested" for anything you did not observe; do not guess a pass. When something goes wrong, note which step, what you pressed, what you expected, what happened and any on-screen text. If listening becomes uncomfortable, press **Mute monitor** at once.

Suggested order: B5 and B6 first (the R21 retest, about 15 minutes), checking the bottom hint bar and the hover tooltips in B1; then B7 and B9 to B12, then B8 and B13. The user reported B1 to B4 as normal on 2026-11-01, so B2 to B4 only need a quick regression. The whole set takes about 60 to 90 minutes and can be split across sessions; B14 needs a collaborator and is scheduled separately.

| Section | Scope                          | R18 status                                                  | Focus this round                       |
| ------- | ------------------------------ | ----------------------------------------------------------- | -------------------------------------- |
| B1      | Startup, language and layout   | Reported normal in R21                                      | Check the tooltips and removed help text |
| B2      | Direct scene manipulation      | Reported normal in R21                                      | Quick regression                       |
| B3      | Physics simulation             | Reported normal in R21                                      | Quick regression                       |
| B4      | First person                   | Reported normal in R21                                      | Quick regression (hint bar moved to the bottom) |
| B5      | Grab, throw, freeze and build  | R21 failure report (USER-R21-BUILD-01 to 04, USER-R21-FPS-02) | R21 priority, new mouse controls      |
| B6      | Sound and default level        | Usability issue (USER-R18-AUDIO-01); R21 dropout report (USER-R21-AUDIO-02) | R21 priority              |
| B7      | Materials and reflections      | NOT_TESTED                                                  | First test                             |
| B8      | Rule preview                   | Not recorded individually; no pass assumed                  | First item-by-item test                |
| B9      | Recording and replay           | UNVERIFIED                                                  | First test                             |
| B10     | A/B comparison                 | UNVERIFIED                                                  | First test                             |
| B11     | Save, import and export        | UNVERIFIED                                                  | First test                             |
| B12     | Offline experiment assistant   | UNVERIFIED                                                  | First test                             |
| B13     | Keyboard, IME and focus        | First-person-dependent parts BLOCKED_NOT_TESTED             | First test                             |
| B14     | Device listening               | NOT RUN                                                     | Needs a collaborator                   |

The default scene is a 6-metre-wide, 4-metre-high, 8-metre-deep open-front demonstration bay: a wood floor, hard back and side walls, a metal ball `ball` under gravity, and a speaker `speaker` playing a continuous 220 Hz test tone. The Listener stands independently at the front of the scene. All materials are Synthetic demonstration values.

<!-- english-original-anchor --> <a id="b1-啟動語言與版面"></a>
### B1 Startup, language and layout

1. Open `http://127.0.0.1:5173/`; the default should be Traditional Chinese. Use **Interface language** in the top bar to switch to English and back; the scene, sound settings and recordings should not change.
2. Switch between the **Build scene**, **Interactive experiment** and **Inspect & compare** workspaces; the scene and simulation state should be kept.
3. Drag the left and right panel borders, and collapse and expand the bottom analysis area; check that no text covers a button.
4. Expand **View details** below the scene; it should show the revisions, coordinates, path legend and blocked candidates. Collapsing it should enlarge the scene area.
5. Editor view: Alt + left mouse button orbits, the middle button pans, the wheel zooms. Select an object and press **Frame selection**; the observer camera should frame it and the Listener should not move.
6. Help text (R21): the Inspector, Scene list, Monitor and analysis area should no longer show explanatory paragraphs; help moved into an ⓘ next to the field or heading. Hovering over the ⓘ or focusing it with Tab should show the help, Esc or moving away should hide it, and the tooltip should stay inside the window. Disabled buttons should also reveal their reason on hover or focus. Field labels, values, status, errors and safety warnings should still be visible directly. Check once in each language.
7. Select the sphere; its dimensions should have a single **Diameter** field. Select or add a capsule; it should have **Diameter** and **Height**. Setting the height below the diameter keeps your input and shows the reason, and the reason follows a language switch.

<!-- english-original-anchor --> <a id="b2-場景直接操作r19-優先"></a>
### B2 Direct scene manipulation (R19 priority)

1. While **Ready** or **Paused**, move the mouse over the ball; the cursor should become a pointing hand. Clicking it should show a selection outline and the transform tool, with its settings in the Inspector on the right. Selecting it from the object list on the left should give the same result.
2. With **Move** above the scene, drag a coloured arrow; after release the object should update exactly once. **Undo scene command** should return it, and **Redo scene command** should bring it back.
3. Select the speaker and drag a ring with **Rotate**; select the ball and drag with **Scale**, and the ball should stay uniformly scaled.
4. Press Esc during a drag; the object should return to its pre-drag state and no undo entry should be added.
5. Press **Start simulation**; the transform tool should hide and show **Pause to drag or scale**. After **Pause** the tool returns.
6. Right after releasing a handle, click another object: if the previous change has not finished committing, that click is ignored and a second click selects the object; the wrong object should never be selected. Quick consecutive drags should not produce two overlapping changes.

<!-- english-original-anchor --> <a id="b3-物理運算"></a>
### B3 Physics simulation

1. Press **Start simulation**; the ball should fall under gravity, collide and bounce. **Pause** should stop it; **Resume simulation** continues.
2. Press **Reset**; physics returns to the initial state of the current scene document. This does not undo scene commands or delete sealed recordings.
3. While paused, select the ball and set Body mode in the Inspector to **Dynamic · no gravity**, then run: the ball no longer falls but still collides. Set it to **Fixed · immovable**: ordinary forces no longer move it. Undo afterwards.
4. Try adding an object while running; it should show **Pause before adding an object**. While paused, add a box, sphere or capsule from the **Object library** on the left; it should appear in the scene and be undoable.
5. This is a behaviour observation, not numerical physics validation.

<!-- english-original-anchor --> <a id="b4-第一人稱r19-優先"></a>
### B4 First person (R19 priority)

1. Press **Enter first person** above the scene. Once the pointer lock succeeds the simulation should start directly; no extra Enter is needed. A one-line hint bar at the bottom of the view lists the current keys (for example **Left click Grab · Hold right button Preview, release Place · L Library · Enter Pause · Esc Release pointer**) and does not cover the crosshair. The entry click must not also grab, throw or place an object.
2. Use W / S to move forward and back, A / D to strafe and the mouse to look; hold Shift to sprint. Hold a movement key for about a second and release it; the character should move and stop.
3. Enter should pause, with the hint **Paused · Click the view or press Enter to resume · Esc releases the pointer**; clicking the view or pressing Enter again resumes.
4. Esc should release the pointer and pause safely. After about a second, clicking the view or **Enable mouse control** should lock again and resume; Chrome briefly refuses a relock right after Esc, so click again if needed.
5. Alt+Tab to another window and come back; it should stay paused until you click the view or press Enter.
6. If the browser refuses the pointer lock: note the hint, press **Enable controls without pointer lock** and **Start first-person controls**, click the view and use WASD, the arrow keys and Enter, or the buttons below.
7. When finished, press **Exit first person**.

<!-- english-original-anchor --> <a id="b5-抓取投擲固定與建造"></a>
### B5 Grab, throw, freeze and build

Requires B4 to pass first.

1. Walk within three metres of the ball, aim with the crosshair and press the **left button** to grab; the ball should follow while still colliding and never pass through walls. The mouse wheel adjusts the hold distance. While holding, the left button throws and the **right button** puts the object down (E still grabs or puts down, but is not needed).
2. Press Esc while holding; after relocking it should stay paused until you click the view or press Enter, to avoid an accidental throw.
3. Aim at a wall and press the left button; it should show **The first hit object is fixed, controlled, or exceeds the grab budget.** When too far away it should show **No grabbable object is within 3 m.**
4. Aim at the ball and press F to freeze it; the ball should become fixed, the simulation should pause safely, and the status line should show **The object is fixed; explicitly resume to continue the simulation.** After you press Enter or click the view to continue, that hint should disappear.
5. Building: while not holding anything, **hold the right button**; a translucent placement preview should appear and follow the crosshair. Aimed at the floor or a wall it attaches to the surface; aimed at empty space it floats at the preview distance, and the hint bar shows **Surface attached** or **Mid-air (no gravity)**. The wheel adjusts the distance; press R and move the mouse sideways to rotate the preview. **Releasing the right button** places it: the object is usable at once, with no confirmation, enable step or extra resume, the simulation keeps its previous state, and the status line shows **Object placed and ready to interact with.** A quick right click also places.
6. An object placed in mid-air should stay in the air and still collide (it moves only when the ball or a thrown object hits it); one placed on the floor falls under gravity. Right after placing you can grab it with the left button or hold the right button again for the next one.
7. While holding the right button, press the left button or Esc; the preview disappears and nothing is placed. Aim at your own feet or beyond 3.5 m and release the right button; the reason it cannot be placed should appear and the preview should disappear, and the left button should still grab normally afterwards instead of staying stuck in a preview.
8. In the object library (L, or the **Object library** on the left after Esc) choose a sphere or capsule, return to first person and hold the right button; the preview should use that shape.
9. Press Esc to release the pointer and press Ctrl+Z; the object you just placed should disappear (one undo per placement).
10. Start a recording, then hold the right button in first person; it should show **Placement preview and placement are unavailable during recording (including paused takes) or replay. Stop recording or return to the live scene first.** and the recording should be unaffected.

<!-- english-original-anchor --> <a id="b6-聲音與預設音量r19-優先"></a>
### B6 Sound and default level (R19 priority)

1. Confirm the physical volume is low. While **Ready** or **Paused**, press **Enable listening** in the Monitor strip at the bottom. Enabling listening does not start the simulation.
2. **Monitor gain** should be shown in dB, defaulting to 0 dB with a range of −40 to +12 dB. **Audio buffer** defaults to **Stable**, with the device output latency (ms) and **Output underruns: N** next to it.
3. Press **Start simulation**; you should hear the speaker's continuous test tone and the ball's impacts. Report whether the default level is too quiet, right or too loud, together with the Windows volume and output device at the time.
4. Dropouts (R21 focus): run for about a minute on **Stable** while entering first person, walking, turning, grabbing and placing objects; report whether the sound still breaks up and the **Output underruns** count at the end. Then try **Balanced** and **Low latency** once each: switching should fade the sound briefly and recover, without doubled sound or pops; note each underrun count and how it sounds. Switching during a recording should be refused with a reason.
5. Switch between **Simulated** and **Raw reference**: Raw reference is centred dry audio without environmental propagation or HRTF, so a level difference alone is not an error.
6. Direction and distance: rotating the editor view alone does not move the Listener. In first person the Listener follows the head automatically, and **Listener / Environment** on the left shows **Follows FPS**; walk and turn, and listen for direction and distance changes. After leaving first person it returns to **Independent position**.
7. Listen for pops, sudden level jumps or dropouts while pausing/resuming, moving, adjusting the monitor gain and switching modes.
8. Finish with **Pause** and **Mute monitor**; muting only affects monitoring and does not pause physics.

<!-- english-original-anchor --> <a id="b7-材質與反射"></a>
### B7 Materials and reflections

1. Pause. Open the **Acoustic paths** tab in the bottom analysis area; it should list direct and **Reflection** paths with path ID, distance, propagation delay and amplitude ratio. Compare with the path legend (Listener / Direct, Reflection) and the **Solver-provided paths** count in **View details**.
2. Select the back wall `wall.back` and, under **Acoustic material** in the Inspector, change **Surface material** from **Hard surface · Synthetic** to **Absorptive surface · Synthetic**. After the paths are re-solved, the amplitude ratio of any reflection off the back wall in the path table should drop; with Simulated monitoring the reflections should sound different, though possibly subtly. Undo afterwards.
3. Acoustic geometry currently includes only boxes, so spheres and capsules neither block nor reflect sound paths; with the ball selected, the Inspector should disable **Surface material** and **Acoustic role**, and the ⓘ tooltip next to them should say why. Add a box from the object library and use the B2 move tool to put it between the speaker and the Listener; the direct path should disappear from **Acoustic paths**. Also check the blocked candidates in **View details**. Undo afterwards.
4. Select **Listener / Environment** on the left and, in the Inspector, set **Propagation medium** to **Vacuum · no airborne propagation**. The scene should show **Vacuum · No airborne sound** and the paths area should explain that sound does not propagate through air in a vacuum, rather than showing 0; mechanical collisions remain. Set it back to **Air** afterwards.
5. These materials are hand-authored demonstration coefficients, not measurements; geometric propagation is a numerical approximation, and HRTF and the late reverb are perceptual approximations. Record only what you see and hear; do not judge scientific correctness.

<!-- english-original-anchor --> <a id="b8-規則預聽"></a>
### B8 Rule preview

1. Run until the ball has impacted, then pause. In **Events & recording**, select an admitted impact audio event.
2. Select the ball and, on its impact rule in the Inspector, press **Preview scene acoustics**; you should hear that rule in the current static scene. Expand **Preview snapshot and provenance** to check the provenance.
3. Press **Stop preview**. Confirm that the simulation time, recording and events did not advance because of the preview.
4. Without a valid selected event, it should explain that a real contact event is required instead of inventing input.

<!-- english-original-anchor --> <a id="b9-錄製與重播"></a>
### B9 Recording and replay

1. Press **Reset**, press **● Start recording** in **Events & recording**, then **Start simulation** for about 10 seconds while the ball bounces a few times, then press **■ Stop recording**; the record should be sealed. In headless Chrome without a GPU, recording repeatedly paused for workload, and the seconds recorded varied widely on the same day; record how many times it pauses in real Chrome and how many seconds are actually recorded.
2. Press **▶ Replay recording**; it should show **Replaying recorded physics trajectories; Rapier is not being run again.** Seek back and forth on the timeline; the picture and sound should follow, and resuming should not replay old impact sounds as new ones.
3. Press **End replay**; it should return to the paused live scene.
4. Press **Export archived recording**; a recording JSON should download, saved separately from the project JSON.
5. If **The fixed-step workload limit was exceeded** appears, note the scene and time; this is a known performance limit, and you can continue in batches or stop explicitly.

<!-- english-original-anchor --> <a id="b10-ab-比較"></a>
### B10 A/B comparison

1. With a sealed recording, press **Save snapshot A** in **Experiment comparison**.
2. Change only one acoustic condition, for example set the back wall to **Absorptive surface · Synthetic**, then press **Save snapshot B** and **Check and compare**. B re-evaluates the same recorded motion; it is not a new physics run.
3. Read the compatibility, units, analysis window, sample count, provenance and unavailable reasons before the deltas; missing or incompatible data is not zero.
4. Behaviour A/B: restore the material, adjust the gain or pitch of the ball's impact rule instead, and compare again.
5. Do not change mass, friction, restitution or geometry for a material comparison; that changes the physical stimulus and needs a new run.

<!-- english-original-anchor --> <a id="b11-儲存匯入與匯出"></a>
### B11 Save, import and export

1. Make a recognizable change (for example move the ball), then press **Save project** or Ctrl+S. Reload the page and press **Load locally saved project**; the change should be restored.
2. Press **Export project**; Chrome downloads the project JSON.
3. Make another change, press **Import project JSON** and choose the file you just exported; a review dialog should appear first. After **Apply and open project** the state should match the export.
4. Try importing a file that is not a project (for example a WAV or a text file); it should be rejected and the current project kept.
5. While paused, tick **I confirm that I have the right to use the imported audio** (it may be inside a collapsed section), press **Import audio** and choose the WAV; it should pass the size, structure, duration and decoding checks. Optional: assign it to a sound rule and listen.
6. A project JSON does not contain the WAV or recording data; clearing browser data may remove them.

<!-- english-original-anchor --> <a id="b12-離線實驗助理"></a>
### B12 Offline experiment assistant

1. Open the **Meta experiment agent** tab in the bottom analysis area and confirm it is on the default **Offline tools (not a model)**.
2. Enter `新增一顆無重力發聲球` (in the English interface, "add a no gravity sound ball"); an operation preview should appear without being applied. After **Apply actions** (shown as **Pause and apply actions** while running) it should report that the proposal was applied as a new revision; Undo should remove it.
3. Enter `ball impact audio quiet`; a preview of the ball's impact sound should appear.
4. Enter text it cannot recognize; it should explain that the offline command was not recognized and suggest the Inspector.
5. **Do not switch to Meta Model API and send requests**: the three live requests authorized for this project are used up, and the ledger must not be reset. **Check server status again** only reads the status and does not request inference.

<!-- english-original-anchor --> <a id="b13-鍵盤輸入法與焦點"></a>
### B13 Keyboard, IME and focus

1. Use Tab to move through the main controls; the focus position should be visible and no important button should be skipped.
2. While typing in an Inspector number field or the assistant input, W / A / S / D, E, B and F must not move the character, grab, build or freeze objects.
3. While composing with a Zhuyin IME in the assistant input, the character must not move; Enter during composition only confirms the text.
4. Pressing Tab or clicking into a text field while first person is waiting for the lock should cancel the pending entry, and movement must not start later on its own. This wait is usually very short; if there is no time to act, write "not tested".

<!-- english-original-anchor --> <a id="b14-裝置聽測"></a>
### B14 Device listening

This needs a collaborator and follows the [frozen listening tool](../../../tests/browser/device-hearing-v3/README.md) and the [original listening protocol](../../../tests/browser/device-hearing/manual-probe-protocol.json). Use the Hi-x65 headphones first, then the D3V speakers; mute and pause before every device change and start from a low physical volume. Record the actual Windows output device, DAC / audio interface and volume, writing UNKNOWN when unknown. Do not keep the ordinary development page or another preview page open while running it, so the wrong audio source is not selected.

<!-- english-original-anchor --> <a id="c-回報範本"></a>
## C. Report template

Copy the template below and fill it in section by section; write "not tested" for anything you did not do.

```text
日期 Date／Chrome版本 Chrome version／Windows版本 Windows version：
顯示比例 Zoom：100%
介面語言 Language／視窗大小 Window size：
測試網址 URL／分支或 commit Branch or commit：

B1 啟動、語言與版面 Startup, language, layout：通過 Pass／失敗 Fail／未測 Not tested；步驟 Steps：
B2 場景直接操作 Direct manipulation：
B3 物理運算 Physics：
B4 第一人稱 First person：
B5 抓取、投擲、固定與建造 Grab, throw, freeze, build：
B6 聲音與預設音量 Sound and default level：
    耳機或喇叭 Headphones or speakers／Windows輸出 Output／DAC／音量 Volume：
    預設音量 Default level（太小 Too quiet／合適 OK／太大 Too loud）：
    方向與距離 Direction and distance：
    爆音、音量突變、斷音 Pops, jumps, dropouts：
B7 材質與反射 Materials and reflections：
B8 規則預聽 Rule preview：
B9 錄製與重播 Recording and replay：
B10 A/B 比較 A/B comparison：
B11 儲存、匯入與匯出 Save, import, export：
B12 離線實驗助理 Offline assistant：
B13 鍵盤、輸入法與焦點 Keyboard, IME, focus：
B14 裝置聽測 Device listening：
其他問題 Other issues：
```

<!-- english-original-anchor --> <a id="d-結束與後續"></a>
## D. Finishing and follow-up

1. Press Ctrl+C in the terminal that started `npm run dev` to stop the service; if an agent started it, ask the agent to stop it.
2. Keep the untracked records left by the automated tests; do not delete them.
3. Once the report reaches an agent, it creates a separate report record and updates RLAB-TASK-0022; failing items are reproduced before they are repaired. The report, automated tests, performance numbers, licensing and external gates are recorded separately; filling in the template does not declare the first version complete.
