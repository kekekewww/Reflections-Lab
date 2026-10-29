<!-- english-source: {"path":"docs/00-project/SOUND_BEHAVIOR_REQUEST.md","sha256":"6bb4f1fee27066056afb2d99bd93a59ef7fe049e513421cbf83984c72613db85","translated_at":"2026-10-27T03:38:12Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/SOUND_BEHAVIOR_REQUEST.md`](../../00-project/SOUND_BEHAVIOR_REQUEST.md). Source SHA-256: `6bb4f1fee27066056afb2d99bd93a59ef7fe049e513421cbf83984c72613db85`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab--sound-behavior-system-research--architecture-integration"></a>
# Reflection Lab — Sound Behavior System Research & Architecture Integration

<!-- english-original-anchor --> <a id="0-任務背景與執行目標"></a>
## 0. Task Background and Execution Objectives

You are the Lead Software Architect, Computational Acoustics Researcher, Interactive Audio Engineer, Physics Systems Engineer, and UX Researcher for Reflection Lab.

This task requires research into a new core feature:

**Sound Behavior System — Physics-Driven Interactive Sound Design**

We want users to be able to define, for every object in a three-dimensional space, the sounds it should produce under different physical states and interaction events.

For example:

A metal ball plays a mechanical sound effect when the player grabs it; plays a Whoosh when thrown; continuously emits a specified sound during flight; produces a metallic impact sound when it strikes a wooden floor; plays a Rolling Sound that varies with speed while rolling; and naturally fades out when it stops.

Users can also completely change these sound effects, making the metal ball play a piano note, an electronic tone, or another sound they import when it collides.

However, the object should still obey normal three-dimensional physics, and every sound it emits should pass through Reflection Lab's acoustic core for distance attenuation, direction, occlusion, material reflections, and spatial propagation.

**The core of this task is to research feasibility, establish a reasonable technical design, assess the impact on the existing architecture, and integrate the results into the project documentation, Roadmap, AGENTS.md, and LLM Wiki.**

Please actually complete the research and documentation updates.

Do not begin large-scale production feature implementation at this stage; create an isolated Technical Spike only when needed to validate an important technical risk.

---

<!-- english-original-anchor --> <a id="1-先更新開發架構決策"></a>
## 1. Update the Development Architecture Decisions First

The user has formally adjusted the development strategy for the Meta hackathon.

<!-- english-original-anchor --> <a id="11-codex-負責主要開發"></a>
### 1.1 Codex Is Responsible for Primary Development

The project no longer mandates Muse Code as the primary implementation agent.

New direction:

- Codex is responsible for architecture, code implementation, task advancement, and quality verification.
- Codex Skills, Subagents, Goal, and other existing development capabilities may be used.
- Muse Code is an optional development tool and should be used only when it clearly provides practical value.
- Do not introduce unnecessary complexity through cross-Coding-Agent Orchestration.

Earlier decisions about the Codex × Muse Code division of responsibilities and automatic quota switching should be marked Superseded or Optional. Preserve their history rather than deleting them directly.

Verification should still come, wherever possible, from independent tests, Benchmarks, CI, or an isolated Review Agent, rather than relying solely on the same model's claim that its own work is correct.

<!-- english-original-anchor --> <a id="12-meta-muse-agent-負責產品內-ai"></a>
### 1.2 The Meta Muse Agent Is Responsible for In-Product AI

Meta's model capabilities will be integrated into Reflection Lab through the **Meta Model API**.

Production uses:

- Create and modify 3D scenes.
- Add objects and configure materials.
- Set physics parameters.
- Define Sound Behaviors.
- Generate valid sound event configurations.
- Control and run acoustic experiments.
- Retrieve acoustic solver results.
- Compare experiments and propose improvements.

The Muse Agent is part of the Reflection Lab product.

Using Codex during development should not affect this capability.

Please recheck the official competition rules and confirm:

- Whether development using Codex or other third-party Coding Agents is allowed.
- Whether actual use of the Meta Model API or open-weight models is required.
- What degree of Meta AI integration is required.
- How to demonstrate real Muse Agent functionality at submission.

Sources:

https://dev.meta.ai/events/global-hackathon

https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details

If the complete rules require login and cannot be read in the current environment, explicitly identify the terms that cannot be independently verified.

Do not assume that using Muse Code means the project satisfies the Meta AI integration requirements.

<!-- english-original-anchor --> <a id="13-保留目前的技術架構"></a>
### 1.3 Retain the Current Technical Architecture

Current candidates:

- React / TypeScript
- Three.js / React Three Fiber
- Rapier 3D
- Custom Acoustic Core
- Web Audio API / AudioWorklet
- Meta Model API
- Git-based LLM Wiki

The Steam Audio SDK serves only as an optional reference implementation, independent Benchmark, or future Backend.

There is no plan to directly reuse the original code core of Echo Canvas / Reflections.

---

<!-- english-original-anchor --> <a id="2-sound-behavior-system--功能需求"></a>
## 2. Sound Behavior System — Feature Requirements

Research how to give each 3D object independent, editable, reusable sound behavior settings.

Research at least the following events.

<!-- english-original-anchor --> <a id="continuous-behaviors"></a>
### Continuous Behaviors

- Always On: the object continuously emits sound.
- While Moving: plays while the object is moving.
- While Airborne: plays while the object is in flight.
- While Rolling: plays while the object is rolling.
- While Sliding: plays while the object is sliding or experiencing friction.
- While Spinning: produces sound according to angular velocity.
- While Held: plays while the player holds the object.

<!-- english-original-anchor --> <a id="discrete-events"></a>
### Discrete Events

- On Grab
- On Release
- On Throw
- On Drop
- On Impact
- On Bounce
- On Start Moving
- On Stop Moving
- On Enter / Exit Zone
- On Sleep / Wake

Determine a reliable definition for each event in the physics system.

For example:

`On Throw` is an interaction event in which the player actively applies a throwing impulse; it cannot be determined solely by an object's speed exceeding a certain value.

`While Rolling` must account for contact between the object and a surface, linear velocity, and angular velocity; not all movement on a plane can be classified as rolling.

`On Impact` should account for relative contact velocity, normal impulse, collision position, and material pairing.

---

<!-- english-original-anchor --> <a id="3-physics-integration-research"></a>
## 3. Physics Integration Research

Please research the events and data provided by Rapier.

Official source:

https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/

Research:

- Collision Events
- Contact Force Events
- Contact Manifolds
- Relative Velocity
- Contact Normals
- Contact Position
- Collider / RigidBody IDs
- Linear / Angular Velocity
- Fixed Time Step
- Dynamic / Fixed / Kinematic Modes

Analyze how to convert these data into Sound Behavior Events.

The following must be handled:

1. A single physical collision produces multiple contact points.
2. Sustained contact causes large numbers of repeated events.
3. An object vibrates slightly on a surface.
4. Low-speed and high-intensity collisions.
5. High-speed objects and CCD.
6. Multiple objects collide simultaneously.
7. A player-held object contacts a wall.
8. An object switches from Dynamic to Fixed or No Gravity.
9. Simulation Pause / Resume.
10. Reproducibility of Physics Replay.

Research suitable:

- Contact Event Aggregation
- Debouncing / Cooldown
- Hysteresis
- Thresholds
- Rolling / Sliding State Machine
- Voice Limiting
- Event Timestamping

These rules should be supported by tests and must not rely solely on subjective parameter tuning.

---

<!-- english-original-anchor --> <a id="4-sound-behavior-architecture"></a>
## 4. Sound Behavior Architecture

Research an architecture with the following layers:

**Physics / Player Events → Behavior Evaluation → Audio Event Instances → Acoustic Propagation → Spatial Audio Rendering**

<!-- english-original-anchor --> <a id="41-event-layer"></a>
### 4.1 Event Layer

Receives standardized physics and interaction events.

Each event should carry the necessary identifying information, timestamp, position, and parameters.

<!-- english-original-anchor --> <a id="42-behavior-layer"></a>
### 4.2 Behavior Layer

Determines which sounds to play based on events, object state, materials, user rules, and parameters.

Supports conditions, parameter mapping, cooldowns, and state transitions.

<!-- english-original-anchor --> <a id="43-audio-generation-layer"></a>
### 4.3 Audio Generation Layer

Research:

- Sample Playback
- Looping Audio
- Randomized Variants
- Oscillator / Synthesis
- Procedural Sound
- ADSR / Envelopes
- Filters
- Pitch / Gain Automation
- Crossfade
- Sound Instance Pooling

Prioritize Sample-based and simple Procedural Audio in the first version.

Complex Modal Synthesis can initially remain a research feature.

<!-- english-original-anchor --> <a id="44-acoustic-propagation-layer"></a>
### 4.4 Acoustic Propagation Layer

All sound sources with an actual 3D position should receive acoustic processing through the current Custom Acoustic Core.

This includes:

- Source Position
- Listener Position
- Propagation Delay
- Distance Attenuation
- Occlusion
- Reflections
- Material Responses
- Air Absorption
- Spatialization

Multiple events can occur simultaneously, but reasonable Audio Voice and computation budgets are required.

<!-- english-original-anchor --> <a id="45-聲源定位規則"></a>
### 4.5 Sound Source Positioning Rules

Please specifically research:

- Continuously sounding objects: usually bound to the object's Transform.
- Throw sound effects: may move with the object.
- Collision sound effects: should originate at the Collision Contact Position.
- Friction sound effects: should update according to the effective contact region or a representative position.
- Multiple contact positions: require a reasonable merging or multiple-source strategy.

Do not fix every sound at the object's center.

---

<!-- english-original-anchor --> <a id="5-physical-sound-vs-creative-sound"></a>
## 5. Physical Sound vs Creative Sound

This is the most important design principle.

**Physical motion, sound generation, and sound propagation should be independent of one another.**

Users can create sound content that does not match an object's real-world material, but that content should still propagate through the specified three-dimensional acoustic environment.

For example:

A metal ball strikes a wooden floor.

Physical Preset:

Plays an appropriate sound effect based on the impact sound characteristics of metal and wood.

Creative Preset:

The user changes it to play piano C4, an electronic tone, or another sound.

Both still use the same model for position, occlusion, reflections, and propagation through air.

Please research whether the following are needed:

- Physical Sound Preset
- Creative Sound Preset
- Hybrid Sound Layering
- Procedural Sound Mode

All materials and acoustic coefficients must distinguish real measurements, formula-based calculations, and creative settings.

A sound effect specified by the user must not be described as naturally produced by real physical vibrations.

The following must also be distinguished:

- Gravity
- Atmospheric Medium
- Acoustic Propagation
- Physical Collision

Zero gravity does not imply a vacuum.

A vacuum also does not imply that objects cannot undergo mechanical collisions.

---

<!-- english-original-anchor --> <a id="6-成熟音訊工具研究"></a>
## 6. Research into Mature Audio Tools

Research the following fully:

<!-- english-original-anchor --> <a id="fmod-studio"></a>
### FMOD Studio

https://www.fmod.com/docs/2.04/studio/authoring-events.html

Research:

- Events
- Event Instances
- Parameters
- Instruments
- Automation
- Event Conditions
- Audio Routing

<!-- english-original-anchor --> <a id="unreal-metasounds"></a>
### Unreal MetaSounds

https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine

Research:

- Node-based Audio Generation
- Trigger Nodes
- Audio Parameters
- Signal Processing
- Procedural Sound
- Graph Evaluation

<!-- english-original-anchor --> <a id="wwise"></a>
### Wwise

https://www.audiokinetic.com/

Research:

- Events
- Game Parameters / RTPC
- Switches / States
- Interactive Music and Sound
- Spatial Audio
- Event Profiler

<!-- english-original-anchor --> <a id="sound-particles"></a>
### Sound Particles

https://soundparticles.com/

Research:

- Moving Sources
- Object-based Audio
- Audio Automation
- Spatial Source Behaviors

Please prepare a comparison covering:

- Which designs suit Reflection Lab.
- Which features do not need to be redeveloped from scratch.
- Which concepts can be implemented directly using Web Audio.
- Which would add unnecessary technical complexity.
- Which offer innovative value suitable for a hackathon demonstration.

Draw only on publicly available design principles; do not directly copy protected code, materials, or UI assets.

---

<!-- english-original-anchor --> <a id="7-sound-behavior-data-model"></a>
## 7. Sound Behavior Data Model

Please design versioned, validatable JSON / TypeScript data contracts.

Include at least:

- SoundBehaviorProfile
- SoundBehaviorRule
- SoundTrigger
- TriggerCondition
- ParameterMapping
- SoundAssetReference
- SoundGenerator
- SoundInstance
- SpatialEmitter
- AudioEvent
- BehaviorRuntimeState

The following must be supported:

- Multiple Behaviors for one object.
- Multiple objects sharing a Behavior Preset.
- Parameter overrides for individual objects.
- Simultaneous Continuous and One-shot Events.
- Material Pair Overrides.
- Parameter Curves.
- Fade In / Out.
- Cooldown.
- Priority / Voice Limit.
- Versioned Save / Load.
- Undo / Redo.
- Experiment Recording.

Please research using Zod, JSON Schema, or the existing Validation Layer.

AI or user input must not be allowed to execute unrestricted JavaScript code as audio rules.

If a Behavior Graph is needed, use explicitly allowed node types and a validatable Graph Schema.

Please provide a concrete Schema draft and data flow, rather than only a conceptual diagram.

---

<!-- english-original-anchor --> <a id="8-uiux-research--design"></a>
## 8. UI/UX Research & Design

Integrate the Sound Behavior System into the existing Reflection Lab Workspace.

Research two levels:

<!-- english-original-anchor --> <a id="level-1--sound-behavior-inspector"></a>
### Level 1 — Sound Behavior Inspector

The primary interface for the first version.

After selecting an object, users can:

- Open Sound Behaviors.
- Add an Event.
- Select a Trigger.
- Assign an Audio Asset.
- Adjust volume and pitch.
- Set Loop / One-shot.
- Select speed, impact, or other parameters.
- Set a Mapping Curve.
- Enable / disable a Behavior.
- Preview a sound effect.
- Save a Behavior Preset.

Its interaction patterns should remain consistent with the Scene Inspector, Audio Asset Library, and 3D Viewport.

<!-- english-original-anchor --> <a id="level-2--sound-behavior-graph"></a>
### Level 2 — Sound Behavior Graph

Research whether node-based editing is needed in the future.

Candidate nodes:

- Event Trigger
- Condition
- Comparator
- Parameter
- Mapping Curve
- Math Operation
- Sample Player
- Oscillator
- Envelope
- Mixer
- Audio Output

Analyze:

- Whether it is actually easier to use than the Inspector.
- Development and maintenance costs.
- Whether an existing Graph UI Library has a suitable license.
- Undo / Redo for graph editing.
- Node Validation.
- Graph Cycle Detection.
- Runtime Compilation.
- Debugging.

Do not assume that the hackathon MVP must include a completed Graph Editor.

If the Inspector already covers most core requirements, prioritize the simpler, more reliable design.

Please refer to the configured Emil Kowalski Skills:

https://github.com/emilkowalski/skills

UI design should follow the project's current Design System.

---

<!-- english-original-anchor --> <a id="9-event-timeline--experiment-recording"></a>
## 9. Event Timeline & Experiment Recording

Sound Behavior should integrate with the existing experiment recording system.

Research how to record:

- Physics Tick
- Event Type
- Object ID
- Material Pair
- Contact Position
- Velocity / Impulse
- Triggered Behavior
- Audio Asset ID
- Playback Parameters
- Acoustic Result Reference

Users should be able to:

1. Record a throwing experiment.
2. View the event timeline.
3. Locate the time at which an impact occurred.
4. Inspect which sound effect was used for that impact.
5. Modify the Sound Behavior.
6. Replay under the same physical conditions.
7. Perform an A/B sound comparison.

Research how to maintain time synchronization among Audio, Physics, and Acoustics.

Do not assume that rerunning a physics simulation will necessarily produce bit-for-bit identical results.

If needed, save physics trajectory snapshots and normalized event records to improve replay reliability.

---

<!-- english-original-anchor --> <a id="10-muse-agent-integration"></a>
## 10. Muse Agent Integration

This feature must also integrate with the Meta Muse Agent inside the Reflection Lab product.

Please research how to let Muse configure Sound Behaviors through natural language.

For example:

“Create five balls without gravity, make each ball play a different note when thrown, and adjust the collision volume according to speed.”

Or:

“Make this ball emit a low-frequency mechanical sound when grabbed, start playing a synthesizer sound after it is thrown, and stop after it hits the floor.”

AI should compile the user's intent into validated structured operations.

Candidate tools:

- CreateSoundBehavior
- AddBehaviorRule
- UpdateTrigger
- SetSoundAsset
- SetParameterMapping
- ConfigureSoundLayer
- EnableBehavior
- PreviewSoundBehavior
- RunExperiment
- CompareAudioResults

Please design:

- Tool Schemas
- Parameter Validation
- Material / Audio Asset Registry
- Valid Trigger IDs
- Maximum Rule Count
- Safe Execution
- Error Recovery
- User Confirmation
- Audit Logging

The in-product Muse Agent should not directly execute arbitrary JavaScript, operate the OS, or modify the Repository.

The model is responsible only for proposing or choosing valid operations.

All actual physics, DSP, and acoustic calculations should be performed by code.

Users should also be able to edit Sound Behaviors manually without the Muse API.

---

<!-- english-original-anchor --> <a id="11-performance--audio-quality"></a>
## 11. Performance & Audio Quality

The Sound Behavior System may produce many simultaneous audio playbacks, so its performance needs to be researched.

Evaluate at least:

- Concurrent Audio Voices.
- Voice Stealing.
- Audio Asset Preloading.
- Memory / Buffer Pooling.
- Continuous Sound Instance Management.
- Event Burst Handling.
- Audio Graph Stability.
- Web Audio Scheduling.
- AudioWorklet Requirements.
- Physics-to-Audio Communication.
- Parameter Smoothing.
- Sound Propagation Update Frequency.

Clearly distinguish the time scales of physics updates, acoustic solving, and audio processing.

The Audio Callback must not wait for physics simulation, AI, or the network.

Continuous Sound should maintain persistent playback instances, avoiding the creation of new Audio Nodes on every update.

Establish independent verification of acoustic and DSP results, including:

- No obvious Click / Pop.
- No unreasonable volume jumps.
- Correct sound source positions.
- Correct collision event counts.
- Controllable sound effect overlap.
- Spatial acoustic effects are not bypassed by Behavior Routing.

Performance targets must be based on actual Benchmarks and test devices.

---

<!-- english-original-anchor --> <a id="12-scientific--engineering-validation"></a>
## 12. Scientific & Engineering Validation

Please plan reproducible tests:

**Physics Events**

- A single impact triggers correctly.
- Sustained contact does not repeatedly trigger impact sound effects.
- Throw events can be distinguished from natural drop events.
- Rolling and sliding state transitions are correct.

**Sound Behaviors**

- Always On does not stop unexpectedly while the object moves.
- On Grab / On Throw trigger correctly.
- Event Cooldown works correctly.
- Multiple sound layers can play simultaneously.
- Parameter mappings follow the configured curves.

**Spatial Acoustics**

- Collision sounds originate at the correct contact position.
- Audio follows the direct sound, occlusion, and reflection settings.
- Moving sound source updates are continuous.
- Audio Routing does not process HRTF twice.

**Recording**

- The Event Log is reproducible.
- Scene Revision and Behavior Profile are traceable.
- A/B Comparison does not change unrelated physical conditions.

**Muse Agent**

- Valid requests can successfully create a Behavior.
- Invalid Triggers are rejected.
- Nonexistent Audio Assets are not fabricated.
- Manual operation remains available when the API fails.
- AI does not generate acoustic measurement results unsupported by data.

Tests must explicitly distinguish PASS, FAIL, BLOCKED, and NOT RUN.

---

<!-- english-original-anchor --> <a id="13-feasibility--mvp-prioritization"></a>
## 13. Feasibility & MVP Prioritization

Please assess whether this feature can be integrated into the MVP within the remaining development time for the Meta Global AI Developer Hackathon.

Prioritize research into:

**P0 — Core**

- Always On
- On Grab
- On Throw
- While Airborne
- On Impact
- Basic Sound Asset Selection
- Gain / Pitch Mapping
- Acoustic Core Integration
- Simple Sound Behavior Inspector

**P1 — Enhancement**

- Rolling / Sliding
- Material Pair Rules
- Event Timeline
- Behavior Presets
- Muse Agent Sound Configuration
- A/B Comparison

**P2 — Advanced**

- Node-based Behavior Graph
- Complex Procedural Synthesis
- Modal Synthesis
- Advanced Sound Layering
- AI-assisted Audio Design

Determine whether to raise or lower priorities based on the actual state of the Repository.

If an Audio Event Runtime must be completed first for architectural reasons, list it as a prerequisite task.

Complete the research and prioritization decisions first at this stage; do not assume directly that every feature must be included in this Demo.

---

<!-- english-original-anchor --> <a id="14-documentation--llm-wiki-integration"></a>
## 14. Documentation & LLM Wiki Integration

Integrate the completed research into the existing project documentation.

Following the current Repository structure, create or update:

- `docs/audio/SOUND_BEHAVIOR_RESEARCH.md`
- `docs/audio/SOUND_BEHAVIOR_ARCHITECTURE.md`
- `docs/audio/EVENT_MODEL.md`
- `docs/audio/PHYSICS_AUDIO_BRIDGE.md`
- `docs/audio/BEHAVIOR_SCHEMA.md`
- `docs/audio/SOUND_BEHAVIOR_VALIDATION.md`
- `docs/ux/SOUND_BEHAVIOR_UX.md`
- `docs/ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md`

The paths above are suggestions; prioritize the existing documentation architecture.

Also update:

- Architecture Decision Records
- AGENTS.md
- Product Roadmap
- Feature Backlog
- Technical Risk Register
- LLM Wiki
- Current Project State
- Agent Handoff

Do not create another Wiki.

Avoid copying entire existing documents and creating conflicting authoritative sources.

The new Sound Behavior feature must be incorporated into the Roadmap with Stable Task IDs and explicit Dependencies.

If a dedicated Skill is created, focus it on sound behavior architecture, event handling, and verification workflows; do not duplicate the entire research document.

---

<!-- english-original-anchor --> <a id="15-final-deliverables"></a>
## 15. Final Deliverables

After completing the research, deliver:

1. An overall feasibility conclusion for the Sound Behavior System.
2. A technical comparison of mature audio tools.
3. Rapier Physics Event Mapping.
4. A complete event and state model.
5. A versioned Sound Behavior Schema draft.
6. The Audio Generation / Acoustic Propagation architecture.
7. A comparison of UI/UX designs for the Inspector and advanced Graph.
8. The Muse Agent Tool Calling integration specification.
9. Runtime Performance and safety limits.
10. Acceptance test and Benchmark plans.
11. An analysis of the impact on the existing Reflection Lab architecture.
12. The updated MVP Scope and Task Dependencies.
13. The project documents actually added or modified.
14. The results of updates to the Wiki, AGENTS.md, and ADRs.
15. The next executable production development Task.

Finally, explicitly answer:

- Is this feature worth making an official core of Reflection Lab?
- Does the existing Physics or Acoustic Core architecture need to change?
- Should Event Rules, a State Machine, or a Node-based Graph be used?
- Which features need to be developed in-house?
- Which can use existing APIs or libraries directly?
- Which features best demonstrate innovation for the competition?
- How can the Muse Agent participate substantively in Sound Behavior creation and experiments?
- What is a reasonable MVP boundary within the remaining competition time?

---

<!-- english-original-anchor --> <a id="16-執行要求"></a>
## 16. Execution Requirements

Please start the Repository Audit and related research directly.

Subagents may be used to research:

- Physics Event Modeling
- Interactive Audio Middleware
- Acoustic Propagation Integration
- UI/UX Behavior Authoring
- Muse Agent Tool Calling

All important conclusions should be supported by official documentation, papers, source code, or actual tests.

After the research is complete, integrate the findings, confirm that the architecture has no conflicts, and actually write the results into the documentation, ADRs, Roadmap, and LLM Wiki.

Preserve existing Git changes and project history.

**This task primarily concerns Research & Architecture Integration; do not begin large-scale production feature development beyond isolated technical validation.**

On completion, provide specific Architecture Recommendations, updated files, verification results, and the next Milestone that can be executed immediately.

The ultimate goal is to make Reflection Lab a 3D Interactive Acoustic Sandbox combining realistic physics simulation, explainable acoustic propagation, and highly flexible sound behavior authoring.

Start work now.
