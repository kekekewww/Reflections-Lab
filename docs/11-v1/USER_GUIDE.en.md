# Reflection Lab user guide

[English README](../../README.en.md) · [Traditional Chinese README](../../README.md)

This original English guide covers the implemented local Web workflow; it is not a translation of a separate Chinese user guide. The first version is still under integration validation, not a completed or scientifically calibrated release. The interface is available in Traditional Chinese and English.

For translated supporting documents, check the canonical source path, source hash, and current/stale status. An older translation is not current implementation or test evidence. Both languages use the same task, contract, and result data.

## Choose the interface language

Use **Interface language** in the top project bar and select **English** or Traditional Chinese (`繁體中文`). A fresh profile defaults to Traditional Chinese. The choice is remembered locally when browser storage is available; clearing or blocking storage can reset that preference. Switching languages changes presentation, not the scene, sound configuration, recordings, or numerical results.

User-provided object, project, and asset names retain their original text. Unknown backend diagnostics can retain their source language under an explicit diagnostic label; stable error codes, IDs, paths, and units are preserved.

## Start and orient yourself

Install the pinned Node/npm versions, then run `npm ci` and `npm run dev` from the project root. Open **http://127.0.0.1:5173**. The app starts with Meta inference disabled and a US$0 spending limit.

For a production bundle, use `npm run build`. Contributors can use `npm run check` for the defined research/runtime, build, license, and English-documentation checks. Browser, native audio, device listening, and live API checks have separate commands and evidence; `check` does not establish those results.

The workspaces are **Build scene**, **Interactive experiment**, and **Inspect & compare**. They share a scene/object list, a 3D viewport, an Inspector, simulation controls, and an experiment dock. Select objects in the list or viewport. The Inspector displays their properties and sound rules; the dock shows captured events, computed acoustic paths, comparisons, and the experiment agent.

Pause before structural edits. Reset returns physics to the starting state of the current scene document; it does not undo scene commands or delete sealed recordings. Undo/Redo applies to authoring commands, not to the passage of simulation time.

The scene uses SI units: metres, kilograms, seconds, radians, and hertz. The coordinate system is right-handed, with +Y up and −Z forward. Technical IDs and units remain the same in either interface language.

## Work with objects

Select a box, sphere, or capsule, then use the Inspector to edit its supported transform and properties. Invalid changes are rejected; a failed revision check means the scene changed after the draft was prepared. Review the current values and try again rather than assuming that a rejected change was applied.

| Body mode               | Behavior                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Dynamic with gravity    | Responds to gravity, forces, impulses, and contacts.                                                                      |
| Dynamic without gravity | Keeps mass and inertia; responds to impulses and contacts without gravity. It is not a fixed body or a vacuum simulation. |
| Fixed                   | Does not move under ordinary forces.                                                                                      |
| Kinematic               | Uses the supported host-driven motion policy rather than ordinary dynamic forces.                                         |

Use the on-screen state and rejection reason when a mode or placement cannot be applied. Placement follows preview → staged object → explicit enable; a staged object is not silently activated or allowed to emit sound.

## First-person interaction

Choose **Enter first person** and wait for mouse control to be confirmed. If it is not acquired, use **Enable pointer control** or choose alternative controls. Entering or acquiring controls may pause the simulation; choose **Resume simulation** explicitly after control is confirmed. Entering the mode does not start motion by itself.

| Input             | Action                                                           |
| ----------------- | ---------------------------------------------------------------- |
| W / A / S / D     | Move while first-person controls are active.                     |
| Shift             | Sprint.                                                          |
| Mouse movement    | Look around while pointer lock is active.                        |
| E                 | Grab the eligible aimed dynamic object, or drop the held object. |
| Left mouse button | Throw while interacting, or confirm placement in build mode.     |
| Mouse wheel       | Adjust the supported held-object/placement distance.             |
| B                 | Switch to/from build mode when its state permits.                |
| Enter             | Pause/resume while mouse control is locked.                      |
| Esc or Tab        | Release mouse control and safely suspend interaction.            |

The alternative controls provide explicit movement, look, and interaction buttons. Keyboard shortcuts do not act as scene controls while you are typing or composing text.

Grabbed objects remain dynamic and keep collision solving; they are not attached directly to the camera. An obstruction or insufficient clearance may prevent a motion or state change. Read the reason rather than forcing a placement through geometry.

Changing focus or hiding the page can pause interaction and clear held input. Return to the app and resume explicitly; it does not silently restart. If a key was held during suspension, release it before pressing it again.

## Configure and listen to sound

Use the object's sound-behavior section to configure supported continuous rules and discrete triggers, such as impacts, grabs, or throws. Unsupported triggers are identified as unavailable; adding a label is not evidence that a physics producer emits it.

Rules can use an oscillator or a validated sample. Edit gain, pitch, mappings, and per-binding overrides in the Inspector, then apply the draft. Mapping previews show the configured function; they are not a simulated run or a measurement. A rejected draft remains available for correction. Use the explicit discard action if you want to abandon it.

For a first live listening session:

1. Keep the scene **Ready** or **Paused**. In the bottom Monitor strip, choose **Enable listening** and start at low device volume.
2. Adjust **Monitor gain**. Choose **Simulated** for the acoustic chain or **Raw reference** for centered dry audio without environmental propagation or HRTF.
3. Choose **Start simulation** or **Resume simulation** when you want a live experiment to advance. Enabling listening does not resume physics automatically.
4. Finish with **Pause** and **Mute monitor**. Muting only changes monitoring; it does not pause physics. Pause alone is not the monitor's mute control.

You can inspect saved evidence or replay an existing recording without creating a new run. Raw audition and independent preview are local listening aids, outside an experiment's computed metrics.

A rule's **Logical instance active**, created, or updated status describes a logical sound decision. It does not establish native admission or actual device output. When a matching native rejection is available, read its original reason, attempted tick, and instance ID. These recent live diagnostics are bounded and excluded from recordings; absence of a rejection is not proof that you heard a sound. The standard product limits are 24 voices and 32 sources; reaching an audio limit does not indicate that Meta API credit is exhausted.

All simulated 3D voices use the common acoustic route. Paths in the viewport come from the solver; an unavailable or stale result is not a fresh computed path. The current model supports direct sound, occlusion, and finite first-order reflections within its stated geometry limits. It does not simulate general wave acoustics, diffraction, or arbitrary vibrating materials.

Materials marked **Synthetic** are demonstration parameters, not measured wood, metal, or concrete. Geometric propagation is a **numerical approximation**; browser HRTF and synthetic late reverb provide **perceptual approximations**. Physics-inspired samples are creative sound content, not measured vibration or proof of physical realism. Values labeled dBFS are digital levels, not calibrated dB SPL.

## Preview a rule without advancing the experiment

1. Keep the scene **Ready** or **Paused**, and choose **End replay** if replay is active. Apply or discard rule and object-override drafts first.
2. For an impact rule, first perform a real interaction, pause, then select a retained, admitted impact audio event. It must match the current object, generation, sound document, and rule versions. After relevant edits, capture and select a new event. Missing real mapping inputs are rejected rather than invented.
3. In the selected rule, choose **Preview scene acoustics**. It previews the applied rule at the current static scene and listener positions. Use the Monitor controls to select Simulated or Raw reference and adjust or mute the output.
4. Inspect **Preview snapshot and provenance** and use **Stop preview** to end it. This also stops a dry asset audition. A new preview replaces the previous one; the displayed emission window excludes propagation and reverb tails.

Independent preview uses the actual acoustic solver and audio route with a separate preview lifetime. It does not advance the original simulation, recording, or metrics, and it does not evaluate the rule's trigger or conditions. It is a static listening aid, not a replay of the collision trajectory, a formal run, or a vibration measurement. Dry asset audition also requires the live scene to be paused and replay to be stopped.

## Import audio and save work

1. Pause the simulation.
2. Confirm that you have the rights needed to use the file.
3. Use **Import audio** to select a supported PCM/float WAV. The app validates file size, structure, duration, decoding, and asset identity before admission.
4. Keep the original WAV. A project pins its asset identity, revision, and hash; renaming a different file does not make it the same asset.

Project actions include **Save project**, **Load locally saved project**, **Export project**, and **Import project JSON**. Ctrl/⌘+S saves locally. An import first presents a review dialog; only **Apply and open project** reaches the validated importer. Invalid input keeps the existing project.

Audio bytes and recordings use browser-local storage. A project JSON is not a self-contained WAV-and-recording backup: its references still need the corresponding stored content. Export a sealed recording separately if you need its raw JSON for inspection or evidence. Do not assume that clearing browser data preserves local assets or recordings.

When a project cannot open because a pinned WAV is missing, keep its pending import. Import the **matching original WAV** through the rights-confirmed audio flow, then apply the pending project again. This preserves its existing asset ID, revision, and hash. A wrong file is rejected; the app does not substitute it silently.

## Record and replay

1. Prepare the scene and sound settings.
2. In **Events & recording**, choose **Start recording** and perform a short experiment.
3. Choose **Stop recording** to seal the artifact. A completed artifact can be opened with **Replay recording** and inspected on the timeline.
4. Choose **End replay** before returning to a new live recording or editing the live experiment.

Replay presents captured motion and events. It is not proof that a fresh physics simulation will produce identical states on another platform. Its audio restoration uses saved logical/source-cursor evidence, not a hardware PCM read pointer.

If recording cannot keep up, the app pauses and retains the fixed-step debt instead of skipping ticks. Resume explicitly or stop to preserve the available record. An interrupted record can be exported with its status and reason; it must not be treated as a complete replayable experiment. Repeated overruns mean the current scene, graphics environment, or recording load needs investigation.

Pause fades/freezes the experiment's voices while the native audio clock continues. Resume and seek restore eligible source state without treating old arrivals as new emissions. These mechanisms have scoped automated evidence; they do not replace a listening test on your device.

## Compare A and B

In **Experiment comparison**, choose **Save snapshot A** from a sealed recording. Change only the intended condition, choose **Save snapshot B** to re-evaluate the same recorded trace, then choose **Check and compare**. Creating B re-evaluates the recorded motion; it does not secretly perform a new physics run.

| Comparison   | Keep fixed                                                                                                     | Change deliberately                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Acoustic A/B | Motion, raw physical events, listener, source signal/phase, geometry, and required solver/analysis conditions. | The declared acoustic-material or propagation condition.               |
| Behavior A/B | Motion, raw physical events, listener, geometry, physics, and propagation/solver conditions.                   | The declared sound asset, generator, gain, pitch, or behavior profile. |

Changing mass, friction, restitution, or geometry can change the physical stimulus and requires an appropriate new run. Do not label that as a material-only acoustic comparison.

Read compatibility, units, analysis window, sample population, provenance, and unavailable reasons before interpreting a delta. Missing or incompatible data is not zero. Do not interpret a different sound sample as improved room reverberation. The current four-case product suite passed its scoped capture, acoustic-B, persistence, and replay checks; that does not establish every comparison or complete first-version acceptance. See the [latest evidence report](../en/11-v1/REQUIREMENT_EVIDENCE_20261027.md) and [known limitations](../en/KNOWN_LIMITATIONS.md) for the verified scope.

## Use the experiment agent

The **Meta experiment agent** panel offers **Offline tools (not a model)** and **Meta Model API**. Offline tools use bounded deterministic commands; they are **not a language model** and are not evidence of Meta integration. You can continue authoring manually when the model is unavailable.

The local parser accepts supported patterns rather than arbitrary conversation. For example, `ball impact audio quiet` requests a preview for the existing `ball` object's impact sound. Inspect the actual preview and validation result; the command does not bypass object IDs, available assets, or explicit Apply.

For scene or sound changes, inspect the operation preview. A preview is not applied until you explicitly choose Apply. The host checks schema, stable IDs, asset pins, capabilities, revisions, and budget. Unsupported operations fail explicitly. A queued run is not a completed result; numerical claims need a completed run artifact.

**Check server status again** does not request inference. Selecting the Meta provider does not grant access or spend permission. Model requests require the server's access and budget gates; keys stay on the server and must never be pasted into the app, project JSON, or repository.

The small live validation authorized for this project has already used all **three request slots** within a **US$1 total authorization**. Its reservation is **US$0.75**. The successful response's usage estimate is **US$0.0073235**; actual billing, earlier error charges, and remaining account credit are unknown. Do not reset the ledger or send more requests. Read the [live-validation record](../en/server/META_LIVE_VALIDATION.md) for the safe read-only status command.

Real Meta evidence currently covers two Sound operations, host application, and a local 180-tick run. It does not establish Scene live tools, a model-planned run, live use through the product UI, hardware audio, or hearing quality. The development executor being Codex does not change the product model's provenance.

Reusing the saved model response offline preserves its recorded provenance; it is not another live Meta request. Inspecting that evidence does not require a new run or paid call.

## Understand the evidence

Computed values, estimates, Synthetic inputs, and measured data have different meanings. A passing Node test, a valid schema, an audible waveform, or a plausible picture does not establish acoustic accuracy or a complete product release.

Device hearing checks, cross-browser behavior, formal long-duration performance, real-room validation, and external rights/competition requirements each need their own evidence. Items that have not been run remain **NOT RUN** or **BLOCKED**. No calibrated SPL, actual AudioWorklet deadline, or general real-room accuracy is implied.

The current headless Chromium native-audio checks and IR comparison passed within their stated scope. Firefox retains an original energy-threshold failure and capability blocks; the cached Windows WebKit run was capability-blocked. These results do not establish Safari or complete cross-browser support. Current native desktop checks for 200% zoom, 320-CSS-pixel width, and Pointer Lock did not reach app testing; earlier passes are historical.

The listening-preparation session completed its preflight and a 30-minute waiting window, then was closed and archived. No selected or measured app AudioContext and no listening report were captured during that window. The reported Hi-x65 and D3V models do not establish the actual route, sample rate, or block size; those remain unknown. This does not determine unobserved later user actions. The formal 600-second profile retains its failures and incomplete load; a separate 120-second case passing does not replace it. Overall first-version acceptance is unfinished.

For current work and reproducible evidence, use the [requirement matrix](../en/11-v1/ACCEPTANCE.md), [implementation status](../en/IMPLEMENTATION_STATUS.md), [known limitations](../en/KNOWN_LIMITATIONS.md), and [current project state](../en/knowledge/wiki/now.md).
