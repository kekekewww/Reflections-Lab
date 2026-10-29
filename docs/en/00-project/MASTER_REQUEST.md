<!-- english-source: {"path":"docs/00-project/MASTER_REQUEST.md","sha256":"6074a24d2bc4b345de090eef07451a3f50c316b70114e0dbacadefe1e84b5e25","translated_at":"2026-10-27T03:41:08.5210066Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/MASTER_REQUEST.md`](../../00-project/MASTER_REQUEST.md). Source SHA-256: `6074a24d2bc4b345de090eef07451a3f50c316b70114e0dbacadefe1e84b5e25`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab--research--project-bootstrap-master-prompt"></a>
# Reflection Lab — Research & Project Bootstrap Master Prompt

**Version: 2026-10-26**  
**Project: Reflection Lab**  
**Phase: Research, Preproduction & Engineering Preparation**  
**Target: Meta Global AI Developer Hackathon 2026**

---

<!-- english-original-anchor --> <a id="0-核心任務與工作原則"></a>
# 0. Core Mission and Working Principles

You are now the Principal Research & Engineering Agent for Reflection Lab.

You also take on the following roles:

- Computational Acoustics Researcher
- Physics Simulation Engineer
- Spatial Audio & DSP Architect
- 3D Interaction / UX Researcher
- AI Systems Architect
- SDK Integration Engineer
- Software Architecture Engineer
- Agent Harness & Developer Infrastructure Engineer

Your task is to **carry out comprehensive predevelopment research, information organization, technical feasibility analysis, SDK preparation, and project environment initialization directly in the current project working directory**.

This is more than writing a proposal.

You must actually inspect files, obtain reliable research materials, verify official technical documentation, build a structured knowledge base, configure Agent Skills, complete AGENTS.md, prepare the project structure, and establish executable validation workflows.

<!-- english-original-anchor --> <a id="01-本階段的完成範圍"></a>
## 0.1 Completion Scope for This Phase

When this task is complete, the project should have:

1. A complete inventory of the existing project and assets.
2. Traceable research on acoustic, physics, and audio theory.
3. Reliable indexes of papers, public data, and reference implementations.
4. Steam Audio SDK licensing, compatibility, and practical integration preparation.
5. An engineering design for the 3D physics world and first-person interaction.
6. Complete UI/UX research, information architecture, and user workflows.
7. Meta AI model selection, tool specifications, and experiment agent design.
8. A technical architecture based on comparisons, with explicit ADRs.
9. A complete but concise Agent Harness, Skills, and AGENTS.md.
10. A reproducible development environment, benchmarks, a validation plan, and a task list for the next phase.

This phase primarily covers research and engineering preparation.

**Apart from SDK Smoke Tests, dependency validation, geometric mathematics validation, and necessary isolated Technical Spikes, do not yet implement production product features on a large scale.**

The aim is to avoid extensive development on an incorrect architecture before the research findings are settled.

However, do not merely list work to be done in the future. Complete research, environment configuration, data structures, and testing foundations directly whenever they do not need to wait for production development.

<!-- english-original-anchor --> <a id="02-自主執行原則"></a>
## 0.2 Principles for Autonomous Execution

- Read the current project before making technical decisions.
- Use Subagents reasonably for independent research tasks.
- Actually verify important information involving acoustic formulas, SDKs, licensing, and APIs.
- Do not fabricate papers, data, test results, or feature support.
- When uncertain, record the issue and alternatives, and continue other work.
- Do not repeatedly ask the user to confirm routine engineering details.
- Do not perform destructive Git or file operations.
- Respect existing code, research, project files, and uncommitted changes.
- Do not misrepresent research findings as completed production features.
- Do not copy third-party content in bulk before checking its license.

Use Traditional Chinese (Taiwan) for all formal project documentation. Use English for code, APIs, file paths, and technical identifiers.

---

<!-- english-original-anchor --> <a id="1-project-vision--reflection-lab"></a>
# 1. Project Vision — Reflection Lab

Reflection Lab is an interactive experimentation platform combining 3D physics simulation, computational acoustics, spatial audio, and AI.

Users can create 3D spaces, add objects, assign physical and acoustic materials, configure sound generation, and manipulate objects directly in the environment to observe and hear how sound changes with motion, collisions, materials, reflections, occlusion, and the air medium.

The project has three levels of design goals.

<!-- english-original-anchor --> <a id="11-interactive-physics-sandbox"></a>
## 1.1 Interactive Physics Sandbox

Users can:

- Create rooms, walls, floors, obstacles, and arbitrary basic geometric objects.
- Specify object dimensions, mass, friction, restitution, and collision properties.
- Use normal gravity, no gravity, fixed positions, or controlled motion.
- Enter a first-person view to move, observe, and listen within the space.
- Grab, move, rotate, drop, throw, and fix objects in place.
- Create and place new objects directly in first-person mode.
- Let objects fall freely, collide, bounce, roll, and rub against surfaces.
- Play continuously sounding objects, or generate sound when physics events occur.

<!-- english-original-anchor --> <a id="12-acoustic-simulation-laboratory"></a>
## 1.2 Acoustic Simulation Laboratory

The system must support:

- Direct Sound
- Distance Attenuation
- Propagation Delay
- Occlusion
- Transmission
- First-order / Higher-order Reflections
- Frequency-dependent Acoustic Materials
- Atmospheric Absorption
- Moving Sources / Listeners
- Doppler Effect
- Early Reflections
- Late Reverberation
- Room Impulse Response
- HRTF / Binaural Audio
- Acoustic Path Visualization
- Material and Scene A/B Comparison

Acoustic calculations must be supported by mathematical theory and experimental evidence, with clear distinctions between exact solutions, numerical approximations, perceptual approximations, and unverified models.

<!-- english-original-anchor --> <a id="13-ai-assisted-acoustic-experimentation"></a>
## 1.3 AI-Assisted Acoustic Experimentation

Use Meta model capabilities to let AI:

- Create scenes from natural language.
- Configure physical and acoustic parameters.
- Establish different experimental conditions.
- Control or arrange reproducible object motion.
- Call acoustic solvers to obtain data.
- Compare different materials or geometric conditions.
- Find configurations that meet particular acoustic goals.
- Explain experimental results, limitations, and directions for improvement.

AI must not invent simulation results. All physical and acoustic values must come from reliable computation or measurement workflows.

---

<!-- english-original-anchor --> <a id="2-phase-a--repository-discovery--existing-work-audit"></a>
# 2. Phase A — Repository Discovery & Existing Work Audit

<!-- english-original-anchor --> <a id="a1-檢查目前工作目錄"></a>
## A1. Inspect the Current Working Directory

Before making any changes, obtain:

- The current working directory and file tree.
- Git status, branch, and Commit.
- Existing AGENTS.md, CLAUDE.md, and Skills.
- README、PRD、Architecture、Roadmap.
- Source Code、Tests、Fixtures、Benchmarks.
- Existing Dependencies、Lockfiles、Build Scripts.
- PDFs, Markdown, CSV, JSON, and other research files.
- Local OS, CPU Architecture, Compiler, Node, Python, Rust, and other environment versions.

First read documents most likely to contain project decisions, the existing architecture, and open issues.

If older documents conflict with newer decisions, use this explicit priority order:

1. The user's latest direct requirements.
2. The latest verifiable project decision documents.
3. Verified existing code implementations.
4. Older plans and prototype documents.
5. Research recommendations and proposals not yet adopted.

Do not treat historical research drafts as the current formal architecture.

<!-- english-original-anchor --> <a id="a2-reflections--echo-canvas-既有成果"></a>
## A2. Existing Reflections / Echo Canvas Work

Check for materials related to the following projects or technologies:

- Reflections
- Echo Canvas / Echo-Canva
- Hybrid 3D Acoustic Engine
- SceneSpec / AcousticFrame
- Image Source Method
- Early Reflection Bank
- Spatial Audio Runtime
- Steam Audio Integration
- Acoustic Material Registry
- Reflection Path Rendering

Specifically check whether existing prototypes already have:

- First-order and second-order specular reflections.
- A unified time reference for direct and reflected sound.
- Stable Reflection Path IDs.
- Occlusion and Transmission calculations.
- Multiband material data.
- Air Absorption.
- Web Audio HRTF, Delay, Filter, and Reverb.
- Worker-based Acoustic Computation.
- Regression Tests and Benchmark Fixtures.

Do not assume that the existence of files means a feature actually works.

Label each feature:

`IMPLEMENTED / PARTIAL / PLANNED / UNVERIFIED / FAILED`

<!-- english-original-anchor --> <a id="a3-原有資產及競賽來源紀錄"></a>
## A3. Existing Assets and Competition Provenance Records

Record the source, author, License, Commit, creation time, and precompetition completion status of existing code.

Create:

- `docs/00-project/PROJECT_BASELINE.md`
- `docs/00-project/EXISTING_ASSETS_AUDIT.md`
- `docs/00-project/PROJECT_PROVENANCE.md`

Keep all changes recoverable. Do not use git reset --hard, git clean -fd, or other operations that could destroy existing data.

---

<!-- english-original-anchor --> <a id="3-phase-b--hackathon-rules--legal-compliance"></a>
# 3. Phase B — Hackathon Rules & Legal Compliance

Prioritize obtaining the latest official rules for the Meta Global AI Developer Hackathon 2026.

Official sources:

https://dev.meta.ai/events/global-hackathon

Investigate:

1. Eligibility, competition categories, and submission deadlines.
2. Restrictions on research and code preparation before the competition begins.
3. Whether existing code, open-source libraries, and commercial SDKs may be reused.
4. Restrictions on third-party sound effects, research data, models, and pretrained weights.
5. Restrictions on using Codex, Muse Code, and other AI Coding Agents.
6. Requirements for using the Meta Model API or specified models.
7. Requirements for project source code, deployment, and submission evidence.
8. Intellectual property rights, licensing, and disclosure obligations.
9. Judging criteria, technical demonstrations, and video requirements.
10. Any additional terms that may affect Reflection Lab.

Distinguish:

- Explicitly allowed by the official rules.
- Explicitly prohibited by the official rules.
- Subject to additional conditions.
- Not yet confirmed.

Do not infer that this competition allows something simply because hackathons generally allow it.

Create:

- `docs/01-compliance/HACKATHON_RULES.md`
- `docs/01-compliance/LICENSE_REGISTER.md`
- `docs/01-compliance/PROVENANCE_POLICY.md`

Include the verification time, links to official sources, and applicable terms.

If the legality of precompetition feature development cannot yet be confirmed, perform only research, document organization, SDK installation, engineering environment setup, and isolated feasibility validation.

Do not accept legal terms or submit competition materials on the user's behalf.

---

<!-- english-original-anchor --> <a id="4-phase-c--comprehensive-scientific-research"></a>
# 4. Phase C — Comprehensive Scientific Research

Conduct in-depth research on computational acoustics and interactive audio.

Prioritize:

- AES
- JASA
- IEEE
- Applied Acoustics
- Acta Acustica
- DOI / Crossref
- arXiv
- Official technical documentation
- Relevant ISO, IEC, and ASTM standards
- Research-oriented open-source implementations

Collect and evaluate at least 15 highly relevant core papers or formal technical research sources.

Analyze the actual contributions and limitations of each paper; avoid merely compiling abstracts.

<!-- english-original-anchor --> <a id="c1-geometrical-acoustics"></a>
## C1. Geometrical Acoustics

Research:

- Image Source Method
- Deterministic Specular Reflection
- Finite Polygon Reflection
- Ray Tracing
- Stochastic Ray Sampling
- Receiver Connection
- Direct / Indirect Sound
- Multi-order Reflections
- Diffuse Scattering
- Occlusion / Transmission
- Dynamic Geometry
- Reflection Path Identity
- Visibility and Acceleration Structures
- Hybrid Acoustic Simulation

Key questions:

How can correct reflection paths be updated quickly as sources and receivers move?

How can excessive CPU load from multiple-reflection calculations be avoided?

How should Reflection Path Birth, Death, Ranking Swap, and Crossfade be handled?

<!-- english-original-anchor --> <a id="c2-acoustic-material-modeling"></a>
## C2. Acoustic Material Modeling

Research:

- Absorption Coefficient
- Reflection Coefficient
- Transmission Loss
- Scattering
- Surface Impedance
- Angle-dependent Reflection
- Frequency Bands
- Surface Thickness
- Material Measurement Standards
- Energy Conservation

Analyze the material frequency bands, coefficient definitions, and conversion methods used by different acoustic engines.

Do not assume that Absorption or Scattering has exactly the same definition in different engines.

Distinguish:

- Measured Data
- Derived Data
- Perceptually Tuned Presets
- Synthetic / Demonstration Values

<!-- english-original-anchor --> <a id="c3-air-medium--dynamic-propagation"></a>
## C3. Air Medium & Dynamic Propagation

Research:

- Speed of Sound
- Temperature
- Relative Humidity
- Atmospheric Pressure
- Frequency-dependent Air Absorption
- Doppler Effect
- Retarded Time
- Time-varying Propagation
- Moving Source / Receiver

Verify applicable theoretical sources such as ISO 9613-1.

Analyze differences in effects between short indoor distances and long-distance environments.

<!-- english-original-anchor --> <a id="c4-room-acoustics--dsp"></a>
## C4. Room Acoustics & DSP

Research:

- RIR / BRIR
- HRTF / SOFA
- Early Reflections
- Late Reverberation
- RT60 / EDT / T20 / T30
- EDC
- DRR
- C50 / C80
- Schroeder Reverb
- Feedback Delay Network
- Convolution Reverb
- Fractional Delay
- Parameter Smoothing
- Time-varying Impulse Response

Focus on how Acoustic Solver data can be mapped to a real-time audio system.

Clearly distinguish propagation delay, DSP processing latency, and audio-device latency.

Do not directly equate dBFS with physically calibrated dB SPL.

<!-- english-original-anchor --> <a id="c5-physical-collision-sound-synthesis"></a>
## C5. Physical Collision Sound Synthesis

Research:

- Rigid Body Dynamics
- Collision Impulse
- Relative Contact Velocity
- Contact Force
- Restitution
- Friction
- Impact Sound
- Rolling Sound
- Scraping Sound
- Modal Synthesis
- Resonant Sound Synthesis
- Physically Based Sound Rendering

Find papers covering different material pairs, collision intensities, and sound generation.

Study which physical data should determine sound triggering, volume, spectrum, and decay when one object strikes another.

Clearly distinguish Sample-based Collision Audio from actual vibrational modal synthesis.

<!-- english-original-anchor --> <a id="c6-wave-based-acoustic-simulation"></a>
## C6. Wave-based Acoustic Simulation

Research:

- FDTD
- FEM
- BEM
- Room Modes
- Wave / Geometric Hybrid Solvers
- Low-frequency Propagation

Evaluate algorithm accuracy, computational complexity, and suitability for real-time, offline, or precomputed operation.

<!-- english-original-anchor --> <a id="c7-每項研究的輸出格式"></a>
## C7. Output Format for Each Research Item

Each paper and important technical resource must include:

- Title
- Authors / Year
- DOI / URL
- Publication Type
- Research Problem
- Methodology
- Mathematical Model
- Data / Experiment
- Assumptions
- Accuracy / Limitations
- Engineering Applicability
- Reproducibility
- Relevance to Reflection Lab

Create:

- `research/papers/PAPER_INDEX.md`
- `research/papers/LITERATURE_REVIEW.md`
- `research/theory/ACOUSTIC_THEORY.md`
- `research/theory/PHYSICS_THEORY.md`
- `research/theory/DSP_MODELS.md`
- `research/EVIDENCE_LEDGER.json`

Every important claim in the Evidence Ledger must include a Claim ID, sources, evidence type, applicable conditions, validation status, and related implementation.

For paywalled papers or restricted materials, retain bibliographic information, links, and content that may legally be used. Do not bypass payment or access controls.

---

<!-- english-original-anchor --> <a id="5-phase-d--steam-audio-sdk-preparation"></a>
# 5. Phase D — Steam Audio SDK Preparation

This project seeks to prioritize evaluating Steam Audio as an Acoustic Simulation Backend.

Official sources:

https://github.com/ValveSoftware/steam-audio

https://valvesoftware.github.io/steam-audio/downloads.html

https://valvesoftware.github.io/steam-audio/doc/capi/index.html

<!-- english-original-anchor --> <a id="d1-版本授權與-sdk-檢查"></a>
## D1. Version, Licensing, and SDK Inspection

First check:

- The current latest stable version.
- Official Release and Source Code.
- LICENSE, NOTICE, and Trademark Rights.
- Third-party Dependencies.
- Available platforms and CPU Architectures.
- C API support.
- Build System、Compiler、Runtime Requirements.
- Binary Redistribution Requirements.

Record official sources, version, SHA-256, licensing, and download method.

If the SDK needs to be downloaded, use a reproducible local Cache or an isolated `third_party` directory by default.

Do not put all SDK Binaries, third-party documentation, and large datasets directly into the Git Repository.

<!-- english-original-anchor --> <a id="d2-steam-audio-技術研究"></a>
## D2. Steam Audio Technical Research

Research:

- IPLContext
- IPLScene
- IPLStaticMesh
- IPLSimulator
- IPLSource
- IPLMaterial
- Direct / Occlusion / Transmission
- Reflections
- Pathing
- HRTF
- Convolution / Reverb
- Dynamic Geometry
- Simulation Commit
- Real-time Processing
- Memory / CPU Usage

Determine which results can be obtained directly and which require custom calculations.

Specifically investigate whether Individual Reflection Paths, IRs, or other acoustic outputs suitable for the UI can be obtained.

Do not assume that reflection support in the SDK necessarily includes individually inspectable geometric reflection paths.

<!-- english-original-anchor --> <a id="d3-多種整合架構比較"></a>
## D3. Compare Integration Architectures

Compare at least:

**A. Web-native Acoustic Engine**

Three.js + Rapier + TypeScript / Web Audio, using an existing or custom acoustic solver.

**B. Native Steam Audio Runtime**

Steam Audio C API + Rust / C++, with Tauri or a Web UI for the frontend.

**C. Unity + Steam Audio**

Use the mature Unity 3D and Steam Audio Integration.

**D. Hybrid Architecture**

The web handles UI, 3D, and control; a Native Service performs the main acoustic computations.

**E. WebAssembly Feasibility**

Investigate the actual cost, technical limitations, and licensing implications of porting Steam Audio native components to WebAssembly.

Do not assume that the Steam Audio C API can run directly in a browser.

Comparison dimensions:

- Implementation Complexity
- Browser Support
- Native Dependency
- Latency
- Performance
- Debuggability
- Deployment
- Licensing
- First-person Physics Integration
- Dynamic Geometry Support
- Reflection Path Inspection
- Future Reflections Reusability
- Ten-day MVP Feasibility

<!-- english-original-anchor --> <a id="d4-sdk-technical-spike"></a>
## D4. SDK Technical Spike

If licensing and the environment permit:

1. Complete SDK download and verification.
2. Create a standalone Build Example.
3. Test basic initialization.
4. Create a simple Scene / Material.
5. Run a minimal Acoustic Simulation.
6. Record computation results and elapsed time.
7. Test resource release and reinitialization.

Keep tests isolated from the production application.

If the SDK cannot be built or the environment is unsupported, record the complete errors and alternatives.

Create:

- `docs/03-sdk/STEAM_AUDIO_RESEARCH.md`
- `docs/03-sdk/INTEGRATION_COMPARISON.md`
- `docs/03-sdk/SDK_LICENSE.md`
- `docs/03-sdk/SDK_VALIDATION.md`

---

<!-- english-original-anchor --> <a id="6-phase-e--first-person-physics--interaction-research"></a>
# 6. Phase E — First-Person Physics & Interaction Research

This is a formal core requirement of Reflection Lab, with P0 priority.

We need three operating modes.

<!-- english-original-anchor --> <a id="e1-scene-editor"></a>
## E1. Scene Editor

Create spaces and edit objects using a free 3D view.

Features include:

- Object creation, deletion, duplication, and hierarchy management.
- Transform Gizmos.
- Position / Rotation / Scale.
- Material settings.
- Physics Properties.
- Source / Listener Placement.
- Grid Snapping.
- Surface Alignment.
- Collision-aware Placement.
- Undo / Redo.

Refer to mature interaction designs in Blender and Unity Editor.

<!-- english-original-anchor --> <a id="e2-first-person-simulation"></a>
## E2. First-Person Simulation

Users can enter the 3D space directly.

Controls:

- WASD movement.
- Mouse look.
- Jump or crouch (optional).
- Raycast object selection.
- Grab objects.
- Move or rotate objects.
- Drop objects.
- Throw forward.
- Apply a pushing force.
- Listen to physical interactions and changes in sound.

Research required:

- Three.js PointerLockControls.
- Rapier Character Controller.
- Raycast Object Selection.
- Physics-based Grab.
- Kinematic Grab Anchor.
- Joint / Spring / PD Controller.
- Dynamic Object Impulse.
- Collision Handling.
- CCD.
- Character / Object Collision.

Study how grabbing can provide reasonable inertia, mass response, and collision handling.

Do not attach every grabbed object rigidly to the Camera through Transform Parenting, causing objects to pass through walls or breaking the physics simulation.

Compare Joint, Spring, Velocity Servo, and other approaches, and select the most stable technique for the first version.

<!-- english-original-anchor --> <a id="e3-first-person-build-mode"></a>
## E3. First-Person Build Mode

Users remain in a first-person view while selecting objects from the Object Library and placing them directly.

Include:

- Object Ghost Preview
- Surface Raycast
- Distance Adjustment
- Rotation
- Position Snapping
- Grid / Surface Alignment
- Collision Validation
- Place / Cancel
- Duplicate Object
- Lock / Unlock

Object placement must clearly distinguish:

- Temporary previews.
- Created objects with physics not yet enabled.
- Placed objects with physics enabled.
- Objects fixed to the environment.
- Freely moving objects.

<!-- english-original-anchor --> <a id="e4-物件物理狀態"></a>
## E4. Object Physics States

Support at least four modes:

<!-- english-original-anchor --> <a id="dynamic--gravity-enabled"></a>
### Dynamic / Gravity Enabled

Affected by gravity, collisions, friction, and external forces.

<!-- english-original-anchor --> <a id="dynamic--gravity-disabled"></a>
### Dynamic / Gravity Disabled

The gravity scale is 0, but the object still has mass, momentum, and collision behavior.

<!-- english-original-anchor --> <a id="fixed"></a>
### Fixed

Maintains a fixed position and cannot be moved by ordinary external forces or throwing operations.

<!-- english-original-anchor --> <a id="kinematic"></a>
### Kinematic

Moves according to specified positions, velocities, animations, or control procedures.

Define the following when switching states:

- Position / Rotation
- Linear Velocity
- Angular Velocity
- Sleep / Wake
- Contact State
- Grab State
- Restore Policy

A fixed position and no gravity must not be treated as the same state.

<!-- english-original-anchor --> <a id="e5-camera-與-listener-設計"></a>
## E5. Camera and Listener Design

In the Scene Editor, the Camera and Audio Listener should be independent objects.

When entering First-Person Simulation, users can choose to attach the Audio Listener to the player's view.

Define the following before implementation:

- Listener Position
- Orientation
- Head Height
- Movement Velocity
- HRTF Updates
- Camera Collision
- Audio Listener Sync

Moving the editor camera must not accidentally change the designated Listener position.

<!-- english-original-anchor --> <a id="e6-physics-to-audio-bridge"></a>
## E6. Physics-to-Audio Bridge

Study how the physics world sends events to acoustic and audio systems.

Include at least:

- Object Transform Updates
- Source Velocity
- Listener Velocity
- Collision Start / End
- Contact Position
- Contact Normal
- Relative Velocity
- Contact Impulse
- Material Pair
- Surface ID
- Timestamp

Prevent a single collision from repeatedly triggering large numbers of sound effects across multiple Physics Steps.

Design Collision Event Deduplication, Cooldown, and Voice Limiting.

Create:

- `docs/04-physics/PHYSICS_ARCHITECTURE.md`
- `docs/04-physics/FPS_INTERACTION_SPEC.md`
- `docs/04-physics/OBJECT_STATES.md`
- `docs/04-physics/PHYSICS_AUDIO_EVENTS.md`
- `docs/04-physics/INPUT_CONTROLS.md`

---

<!-- english-original-anchor --> <a id="7-phase-f--ux--ui-reference-research"></a>
# 7. Phase F — UX & UI Reference Research

Study the UI/UX of mature professional tools and interactive physics games.

This phase requires more than finding attractive images: investigate actual user workflows, information architecture, and software interaction mechanisms.

<!-- english-original-anchor --> <a id="f1-必須研究的產品"></a>
## F1. Products That Must Be Studied

<!-- english-original-anchor --> <a id="unity-editor"></a>
### Unity Editor

https://docs.unity.com/

Research:

- Scene View
- Hierarchy
- Inspector
- Gizmos
- Play Mode
- Object Selection
- Property Editing

<!-- english-original-anchor --> <a id="blender"></a>
### Blender

https://docs.blender.org/manual/en/latest/

Research:

- Viewport Navigation
- Workspace System
- Outliner
- Properties Editor
- Transform Operations
- Object / Edit Mode
- Keyboard Shortcuts

<!-- english-original-anchor --> <a id="sound-particles"></a>
### Sound Particles

https://soundparticles.com/

Research:

- 3D Audio Source Editing
- Source Movement
- Virtual Microphone
- Spatial Audio Monitoring
- Timeline
- Sound Object Inspector

<!-- english-original-anchor --> <a id="treble"></a>
### Treble

https://docs.treble.tech/

Research:

- Acoustic Scene Setup
- Material Assignment
- Simulation Runs
- Acoustic Analysis
- Reflection Tracking
- Result Comparison
- Auralization

<!-- english-original-anchor --> <a id="wwise-spatial-audio"></a>
### Wwise Spatial Audio

https://www.audiokinetic.com/

Research:

- Game Object 3D Viewer
- Audio Listener
- Spatial Audio
- Room / Portal
- Runtime Debugging

<!-- english-original-anchor --> <a id="fmod-studio"></a>
### FMOD Studio

https://fmod.com/studio

Research:

- Interactive Audio Events
- Runtime Parameters
- 3D Source Behavior
- Profiler
- Event Timeline
- Recording / Playback

<!-- english-original-anchor --> <a id="odeon"></a>
### ODEON

https://odeon.dk/

Research:

- Ray Visualization
- 3D Billiard
- Room Impulse Response
- Acoustic Metrics
- Reflection Analysis

<!-- english-original-anchor --> <a id="garrys-mod"></a>
### Garry's Mod

https://www.garrysmod.com/

Research:

- First-person Physics Sandbox
- Physics Gun
- Object Grab / Rotate / Freeze
- Spawn Menu
- Physics Object Interaction
- Intuitive Sandbox Workflow

The above are research references; their inclusion does not imply copying their interfaces, assets, or copyrighted content.

Also consider:

https://github.com/emilkowalski/skills

Study mature approaches to interface spacing, motion, information density, and interaction feedback. Check licensing and scope of applicability before use.

<!-- english-original-anchor --> <a id="f2-ux-research-deliverables"></a>
## F2. UX Research Deliverables

For each product, document:

- Core users.
- Workflows.
- Main interface areas.
- Object selection methods.
- 3D Camera controls.
- Property editing logic.
- Mode switching logic.
- Audio feedback.
- Information visualization.
- Interaction cost and learning curve.
- Reusable design principles.
- Designs unsuitable for Reflection Lab.
- Links to official operating documentation or demonstration videos.

Create a competitive comparison matrix, rather than only a visual Moodboard.

<!-- english-original-anchor --> <a id="f3-reflection-lab-ui-architecture"></a>
## F3. Reflection Lab UI Architecture

Plan to design three Workspaces:

**Scene Workspace**

Edit objects, materials, physics, and sound sources.

**Simulation Workspace**

Run simulations, move in first person, grab, throw, and interact.

**Analysis Workspace**

Inspect Reflection Paths, RIR, RT60, spectra, and A/B Comparison.

Also retain First-Person Build Mode, allowing users to create and place objects directly in the simulation environment.

Workspace describes interface layout; Simulation State describes computation state.

Keep them separate. Switching Workspace must not reset the simulation.

<!-- english-original-anchor --> <a id="f4-建議的主介面"></a>
## F4. Suggested Main Interface

Basic layout:

- Top Bar: Project, Workspace, Simulation, AI.
- Left Sidebar: Scene Explorer / Object Library.
- Center: 3D Viewport.
- Right Sidebar: Contextual Inspector.
- Bottom Dock: Transport, Event Timeline, Acoustic Analysis.
- Floating Command Palette: AI Scene Commands.

The Inspector automatically changes its content based on the selected object type.

For example:

**Acoustic Wall**

Geometry / Surface Material / Absorption / Transmission / Scattering.

**Physical Sphere**

Transform / RigidBody / Gravity / Friction / Restitution / Sound Emitter / Collision Profile.

**Audio Listener**

Transform / Orientation / HRTF / Monitoring.

<!-- english-original-anchor --> <a id="f5-fps-hud--controls"></a>
## F5. FPS HUD & Controls

Keep the first-person display as uncluttered as possible.

Research required:

- Minimal Crosshair
- Object Hover Highlight
- Grab Distance Indicator
- Contextual Interaction Hint
- Physics State Indicator
- Object Placement Preview
- Simulation Debug Overlay

Candidate default controls to study:

- WASD: Move.
- Mouse: Look.
- E: Grab / Release.
- G: Put down gently.
- Left Mouse: Throw.
- R + Mouse: Rotate the held object.
- Mouse Wheel: Adjust grab distance.
- F: Fix / Unfix.
- Tab: Toggle Build Mode.
- Esc: Release Pointer Lock.

These are only candidate shortcuts.

The formal Input Mapping must address key conflicts, customizable bindings, different keyboard layouts, browser restrictions, and Accessibility.

<!-- english-original-anchor --> <a id="f6-acoustic-visualization"></a>
## F6. Acoustic Visualization

Study how to display:

- Direct Paths
- Reflection Paths
- Transmission Paths
- Occlusion
- Source / Listener Direction
- Acoustic Energy
- Frequency Bands
- Impulse Response
- Collision Events

Specifically design selectable acoustic paths.

When a user clicks a Reflection Path, the Inspector should display:

- Path ID
- Reflection Order
- Surface IDs
- Distance
- Absolute / Relative Delay
- Frequency-dependent Attenuation
- Arrival Direction
- Material Contributions
- Model / Solver
- Confidence / Limitations

3D paths, analysis charts, and the Inspector must share Selection State.

Do not draw sound rays merely for demonstration when they have no corresponding physical solver results.

<!-- english-original-anchor --> <a id="f7-ux-設計規範"></a>
## F7. UX Design Guidelines

Suggested visual direction:

- Dark, but not pure black.
- Modern, simple, and oriented toward professional tools.
- Moderately high information density.
- A 4px spacing design baseline.
- Avoid unnecessary decoration and excessive glassmorphism.
- Prioritize direct manipulation and visual feedback.
- Avoid large amounts of redundant instructional text.
- Allow collapsible sidebars and adjustable workspaces.
- Panel animation must not interfere with audio or physics time references.
- Support keyboard shortcuts and Undo / Redo.

Create:

- `docs/05-ux/COMPETITIVE_UX_RESEARCH.md`
- `docs/05-ux/WORKSPACE_ARCHITECTURE.md`
- `docs/05-ux/USER_FLOWS.md`
- `docs/05-ux/FPS_INTERACTION_UX.md`
- `docs/05-ux/COMPONENT_SPEC.md`
- `docs/05-ux/DESIGN_SYSTEM.md`

Use Markdown Wireframes, Mermaid, data structures, and state diagrams to describe the design.

A complete UI implementation is not yet required.

---

<!-- english-original-anchor --> <a id="8-phase-g--audio--acoustic-runtime-architecture"></a>
# 8. Phase G — Audio & Acoustic Runtime Architecture

Study the data flow integrating physics, acoustics, and audio systems.

Suggested separation:

1. Scene Document
2. Evaluated Runtime State
3. Physics Simulation
4. Acoustic Geometry
5. Acoustic Solver
6. Audio Event Generator
7. Spatial Audio Renderer
8. Visualization / Telemetry
9. Experiment Recorder

Clearly distinguish:

- Render Update
- Physics Fixed Step
- Acoustic Update
- Audio Processing
- AI Tool Execution

Do not force every system to use the same update rate.

The Audio Thread must not wait for AI, a Physics Worker, network requests, or expensive geometric calculations.

<!-- english-original-anchor --> <a id="g1-continuous-sound"></a>
## G1. Continuous Sound

Objects can emit sound continuously.

Sound sources should have:

- Audio Asset / Signal Generator
- Looping
- Gain
- Directivity
- Source Position
- Velocity
- Playback State

Audio should continue playing even when an object is grabbed, thrown, or in a no-gravity state, unless the source itself is stopped.

<!-- english-original-anchor --> <a id="g2-collision-sound"></a>
## G2. Collision Sound

Generate Impact, Friction, Rolling, and other sounds from Physics Events.

Use the collision location as the sound-source position.

Collision sounds and an object's continuous sound source must be able to coexist.

<!-- english-original-anchor --> <a id="g3-acoustic-rendering"></a>
## G3. Acoustic Rendering

Acoustic output must include at least:

- Direct Sound Parameters
- Occlusion
- Propagation Delay
- A Reflection Path Set or another representation supported by the Backend
- Material Attenuation
- Late Reverb Parameters
- Listener Orientation

Note:

Different Backends may provide different levels of path data.

Design a Capability-aware Acoustic Backend Contract; do not require every Backend to fabricate Reflection Paths that do not exist.

<!-- english-original-anchor --> <a id="g4-dynamic-geometry"></a>
## G4. Dynamic Geometry

For the first version, prioritize:

- Static room geometry.
- Dynamic sound-emitting objects.
- Dynamic Listeners.
- Fixed obstacles that can be adjusted during editing.

Study these later as advanced topics:

- Dynamic occluding objects.
- Dynamic reflective surfaces.
- Deformable geometry.
- The influence of many dynamic objects on the sound field.

Explicitly evaluate the cost of an Acoustic Scene Rebuild.

---

<!-- english-original-anchor --> <a id="9-phase-h--dataset--scientific-validation"></a>
# 9. Phase H — Dataset & Scientific Validation

Search for datasets with lawful licensing, reproducibility, and complete Metadata.

Evaluate at least:

- Measured Room Impulse Responses
- Binaural RIR
- HRTF / SOFA Datasets
- Acoustic Absorption Measurements
- Scattering / Impedance Data
- Impact Sound Datasets
- Collision Sound Recordings
- Acoustic Benchmark Rooms

Prioritize identifying at least 3 datasets or reference implementations with practical validation value.

Research:

https://github.com/LCAV/pyroomacoustics

For each dataset, record:

- Source.
- License.
- Measurement method.
- Applicable environment.
- Frequencies and sample rate.
- Physical configuration.
- Metadata completeness.
- Whether competition use is permitted.
- Whether redistribution is permitted.
- Which Validation Tests it can support.

Do not download data with unclear licensing directly into Git.

Create reproducible data acquisition scripts; download only small test subsets when necessary.

<!-- english-original-anchor --> <a id="h1-analytical-benchmarks"></a>
## H1. Analytical Benchmarks

Create test specifications for:

- Free-field Propagation
- Single-plane Reflection
- Shoebox Room
- Occlusion
- Material Energy Constraints
- Moving Source
- Doppler
- No-gravity Dynamic Body
- Fixed Body Collision
- Throw / Impact Sound Event
- Reflection Path Continuity
- Impulse Arrival Times
- Dynamic Scene Updates

Each Fixture requires:

- Input
- Units
- Expected Output
- Mathematical Reference
- Tolerance
- Reproduction Steps

<!-- english-original-anchor --> <a id="h2-validation-levels"></a>
## H2. Validation Levels

Distinguish:

- V0: Model Contract
- V1: Analytical / Numerical
- V2: DSP Correctness
- V3: Independent Solver Comparison
- V4: Runtime / Performance
- V5: Perceptual / Real-world Measurement

Do not substitute a plausible-looking UI or pleasant-sounding audio for mathematical and acoustic validation.

Create:

- `research/datasets/DATASET_CATALOG.md`
- `docs/06-validation/BENCHMARK_PLAN.md`
- `docs/06-validation/ACOUSTIC_VALIDATION.md`
- `docs/06-validation/PHYSICS_VALIDATION.md`
- `docs/06-validation/PERFORMANCE_BUDGET.md`

---

<!-- english-original-anchor --> <a id="10-phase-i--experiment-recording--reproducibility"></a>
# 10. Phase I — Experiment Recording & Reproducibility

Reflection Lab must be able to save and replay experiments.

Research a suitable Experiment Recording Architecture.

Target workflow:

1. Create the initial scene.
2. Configure Source, Listener, and physical parameters.
3. Start recording.
4. Grab and throw in first person.
5. Record motion, collisions, and acoustic events.
6. Save an Experiment Snapshot.
7. Change acoustic materials or propagation parameters.
8. Replay the same motion conditions.
9. Compare A/B Acoustic Results.

Evaluate:

- Deterministic Physics Replay
- Fixed Time Step
- Initial State
- Random Seed
- Input Event Recording
- Physics State Snapshots
- Transform / Velocity Timeline
- Collision Event Trace
- Solver Version
- Material Version
- Reproducibility Across Platforms

Do not assume that recording mouse and keyboard input alone guarantees identical physics computation across platforms.

Design Experiment ID, Scene Revision, Simulation Settings, Backend Version, and Results Metadata.

Create:

- `docs/07-experiments/EXPERIMENT_MODEL.md`
- `docs/07-experiments/RECORD_REPLAY.md`
- `docs/07-experiments/AB_COMPARISON.md`

---

<!-- english-original-anchor --> <a id="11-phase-j--meta-ai-research--integration-design"></a>
# 11. Phase J — Meta AI Research & Integration Design

Verify the latest capabilities and usage restrictions of Meta's official Model API.

Official sources:

https://dev.meta.ai/docs/overview

Study available Meta models and features, such as:

- Muse Spark
- Muse Wonder (if available)
- Tool Calling
- Structured Outputs
- Multimodal Input
- Agentic Workflows

Choose models according to the latest official documentation and actual account availability. Do not assume that a particular version is necessarily available.

<!-- english-original-anchor --> <a id="j1-ai-scene-composer"></a>
## J1. AI Scene Composer

Accept natural language input and generate Scene Operations that comply with the Schema.

For example:

"Create a room with a wooden floor, add a continuously sounding metal ball, enable no gravity, and place a concrete wall on the right."

AI must:

1. Parse intent.
2. Select valid Object / Material IDs.
3. Generate structured operations.
4. Pass Domain Validation.
5. Preview scene changes.
6. Apply undoable commands.

<!-- english-original-anchor --> <a id="j2-ai-experiment-agent"></a>
## J2. AI Experiment Agent

Allow AI to call deterministic experiment tools:

- CreateScene
- AddObject
- SetMaterial
- SetRigidBodyMode
- ConfigureSoundSource
- MoveListener
- SetTrajectory
- RunSimulation
- CaptureExperiment
- AnalyzeAcousticResults
- CompareExperiments

Create specifications for tool parameter Schemas, input constraints, error formats, and execution states.

Before AI modifies the actual scene, it must pass validation and appropriate user controls.

<!-- english-original-anchor --> <a id="j3-research-aware-ai"></a>
## J3. Research-aware AI

AI can read curated acoustic theory and material databases to assist with setting experimental parameters.

However, it must not treat paper abstracts or language-model inference as actual acoustic measurements.

Label:

- Measured
- Computed
- Estimated
- AI-generated Explanation

Create:

- `docs/08-ai/META_MODEL_RESEARCH.md`
- `docs/08-ai/AI_SCENE_CONTROL.md`
- `docs/08-ai/AI_TOOL_SCHEMAS.md`
- `docs/08-ai/AI_EXPERIMENT_AGENT.md`

---

<!-- english-original-anchor --> <a id="12-phase-k--architecture-decision-records"></a>
# 12. Phase K — Architecture Decision Records

After research, create formal architecture decisions.

Compare candidate technologies rather than declaring the default selection to be the final architecture immediately.

Current candidates:

- React / TypeScript
- Three.js / React Three Fiber
- Rapier 3D
- Web Audio API
- Steam Audio SDK
- Rust / C++ Native Runtime
- Tauri
- Unity
- Meta Model API

Main evaluation dimensions:

- Development cost.
- Likelihood of completing the MVP.
- Degree of Physics / Acoustics coupling.
- Runtime Latency.
- Audio Thread Safety.
- Debuggability.
- Cross-platform support.
- Deployment cost.
- SDK License.
- Testability.
- Value for future Reflections reuse.

Produce at least the following ADRs:

- 3D Rendering Framework
- Physics Engine
- First-person Controller
- Grab / Throw Architecture
- Acoustic Simulation Backend
- Audio Rendering Backend
- Scene / Material Data Contracts
- AI Integration
- Experiment Recording
- Deployment Architecture

Each ADR must include:

- Context
- Decision
- Alternatives
- Evidence
- Trade-offs
- Risks
- Reversibility
- Status

Design a primary approach and at least one explicit Fallback.

---

<!-- english-original-anchor --> <a id="13-phase-l--agent-harness--skills-setup"></a>
# 13. Phase L — Agent Harness & Skills Setup

Now use the preceding research findings to actually configure the project's agent development environment.

<!-- english-original-anchor --> <a id="l1-agentsmd"></a>
## L1. AGENTS.md

Create a concise, maintainable `AGENTS.md`.

Define at least:

- Project Mission
- Architecture Overview
- Repository Structure
- Source of Truth
- Coding Standards
- Physics Conventions
- Acoustic Model Rules
- Units / Coordinate System
- Audio Thread Rules
- Research Evidence Requirements
- Licensing / Provenance
- Testing Policy
- Build / Run Commands
- Safety / Rollback
- Documentation Updates
- Definition of Done

AGENTS.md should point to research documents and Skills.

Do not copy entire papers, SDK documentation, or lengthy research reports directly into AGENTS.md.

If a submodule needs different specialized rules, place an additional AGENTS.md in the appropriate subdirectory, while avoiding duplication and conflicts.

<!-- english-original-anchor --> <a id="l2-project-skills"></a>
## L2. Project Skills

Create project Skills in `.agents/skills/` that Codex can actually discover.

Use standard `SKILL.md` files and the required YAML Frontmatter.

Evaluate at least these Skills:

**acoustic-research**

Covers acoustic theory, papers, and experimental evidence.

**acoustic-validation**

Covers formulas, numerical tests, RIR, frequency bands, and Benchmarks.

**steam-audio-integration**

Covers Steam Audio SDK APIs, compilation, licensing, Backends, and Smoke Tests.

**physics-interaction**

Covers Rapier, Character Controller, Object Grab, Throw, Gravity, Fixed / Kinematic, and collision events.

**spatial-audio-dsp**

Covers HRTF, Delay, Reverb, SourceGraph, and audio continuity.

**ux-engineering**

Covers 3D Editor, FPS Controls, Interaction State, Inspector, and Workspace design.

**experiment-validation**

Covers experiment recording, reproducibility, A/B comparison, and result validation.

**compliance-and-provenance**

Covers third-party licensing, competition rules, and provenance records for existing code.

Reasonably combine similar Skills to avoid maintaining too many duplicate instructions.

Each Skill must include:

- Trigger
- Purpose
- Inputs
- Workflow
- References
- Outputs
- Validation
- Failure Handling

Store large research outputs in `research/` or `docs/`.

A Skill's `references/` should contain only lawful, concise, and actually needed technical summaries, original-document indexes, and executable commands.

Do not redistribute third-party original SDK documentation, full papers, or license-restricted assets in bulk.

<!-- english-original-anchor --> <a id="l3-durable-knowledge"></a>
## L3. Durable Knowledge

Create:

- `docs/ROADMAP.md`
- `docs/DECISION_LOG.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/RESEARCH_STATUS.md`
- `docs/IMPLEMENTATION_STATUS.md`

Clearly distinguish:

- Research Completed
- Decision Accepted
- Technical Spike Verified
- Implementation Pending
- Implemented
- Tested
- Blocked

Future Agents should be able to understand the current project status quickly without repeating all the research.

---

<!-- english-original-anchor --> <a id="14-phase-m--project-structure--environment"></a>
# 14. Phase M — Project Structure & Environment

Create an appropriate project structure based on the existing code.

Expected logical structure:

```text
reflection-lab/
├── AGENTS.md
├── README.md
├── .gitignore
├── .env.example
├── .agents/
│   └── skills/
├── docs/
│   ├── 00-project/
│   ├── 01-compliance/
│   ├── 02-architecture/
│   ├── 03-sdk/
│   ├── 04-physics/
│   ├── 05-ux/
│   ├── 06-validation/
│   ├── 07-experiments/
│   └── 08-ai/
├── research/
│   ├── papers/
│   ├── theory/
│   ├── datasets/
│   ├── references/
│   └── EVIDENCE_LEDGER.json
├── third_party/
│   └── steam-audio/
├── experiments/
│   └── sdk-smoke-tests/
├── src/
│   └── ...
├── tests/
│   ├── physics/
│   ├── acoustics/
│   ├── audio/
│   └── integration/
├── benchmarks/
│   ├── fixtures/
│   ├── analytic/
│   └── results/
└── scripts/
    ├── setup/
    └── validation/
```

This is only a logical reference.

If a mature, reasonable project structure already exists, continue that architecture instead of forcibly moving files.

This phase can prepare:

- Package Manager / Lockfile.
- Linter / Formatter.
- Typecheck.
- Test Runner.
- Build Scripts.
- SDK Download / Verify Scripts.
- Research Index Validation.
- License Manifest.
- Benchmark Runner.
- Environment Check.
- Git Ignore.
- CI Validation Templates.

Pin versions of all external tools and dependencies, or provide reproducible acquisition methods.

Do not write API Keys, user credentials, or other sensitive settings into the Repository.

Any expensive cloud API calls require cost and rate controls.

---

<!-- english-original-anchor --> <a id="15-phase-n--quality-gates"></a>
# 15. Phase N — Quality Gates

After completing research and configuration, check each item.

<!-- english-original-anchor --> <a id="gate-1--research"></a>
## Gate 1 — Research

Important acoustic, physics, and DSP claims have credible sources.

Papers, formulas, and datasets are traceable.

<!-- english-original-anchor --> <a id="gate-2--licensing"></a>
## Gate 2 — Licensing

Licensing for Steam Audio, Rapier, Three.js, research data, and other dependencies is recorded.

Unconfirmed terms are explicitly marked as requiring investigation.

<!-- english-original-anchor --> <a id="gate-3--sdk"></a>
## Gate 3 — SDK

The Steam Audio version and download source are recorded.

If the environment permits, minimal initialization and build tests have been run.

<!-- english-original-anchor --> <a id="gate-4--physics-feasibility"></a>
## Gate 4 — Physics Feasibility

Implementation approaches for first-person interaction, grabbing, throwing, placement, and different RigidBody Modes are supported by official APIs or actual tests.

<!-- english-original-anchor --> <a id="gate-5--acoustic-feasibility"></a>
## Gate 5 — Acoustic Feasibility

Data flows for dynamic sources, collision sounds, reflections, occlusion, and Listener Updates are clearly defined.

<!-- english-original-anchor --> <a id="gate-6--ux"></a>
## Gate 6 — UX

The main Workspaces, FPS controls, object operations, and acoustic analysis workflows have actionable specifications.

<!-- english-original-anchor --> <a id="gate-7--agent-harness"></a>
## Gate 7 — Agent Harness

AGENTS.md, Skills, project documents, and validation tools have actually been created.

<!-- english-original-anchor --> <a id="gate-8--reproducibility"></a>
## Gate 8 — Reproducibility

Reproducible research sources, dependency versions, test commands, and result records are provided.

Each Gate must output:

`PASS / PARTIAL / FAIL / BLOCKED / NOT RUN`

Do not mark tests that have not been run as successful.

---

<!-- english-original-anchor --> <a id="16-ten-day-implementation-roadmap"></a>
# 16. Ten-Day Implementation Roadmap

After completing research, plan production development work for the competition period.

Priorities are as follows:

<!-- english-original-anchor --> <a id="p0--core-interactive-sandbox"></a>
## P0 — Core Interactive Sandbox

- 3D Room
- Object Creation
- Scene Editor
- FPS Controller
- Grab / Drop / Throw
- Dynamic / No Gravity / Fixed
- Continuous Audio Sources
- Collision Sounds
- Basic Binaural Spatialization

<!-- english-original-anchor --> <a id="p1--acoustic-simulation"></a>
## P1 — Acoustic Simulation

- Direct Sound
- Occlusion
- First-order Reflections
- Basic Acoustic Materials
- Atmosphere Parameters
- Basic Reverb
- Acoustic Path Visualization
- Raw / Simulated Comparison

<!-- english-original-anchor --> <a id="p1--ai-experimentation"></a>
## P1 — AI Experimentation

- Meta AI Scene Commands
- Structured Tool Calls
- Validated Scene Modifications
- Simulation Execution
- Acoustic Metrics
- A/B Experiment Analysis

<!-- english-original-anchor --> <a id="p2--advanced-research-features"></a>
## P2 — Advanced Research Features

- Second-order Reflections
- Advanced Material Bands
- Dynamic Occlusion Geometry
- Full Experiment Replay
- Higher-quality IR
- Advanced Visualization
- Automated Acoustic Optimization

Clearly define the following for each phase:

- Dependencies
- Deliverables
- Acceptance Criteria
- Tests
- Risks
- Fallback
- Time Budget

The entire Roadmap must follow the official competition deadline and reserve buffer time for final integration and submission.

The goal is a stable Demo that judges can operate directly, rather than attempting to implement every acoustic theory within limited time.

---

<!-- english-original-anchor --> <a id="17-final-deliverables"></a>
# 17. Final Deliverables

After completing all executable work, provide a comprehensive Bootstrap Report.

Include at least:

<!-- english-original-anchor --> <a id="1-executive-summary"></a>
### 1. Executive Summary

Research findings, major technical decisions, and the most important risks.

<!-- english-original-anchor --> <a id="2-existing-project-audit"></a>
### 2. Existing Project Audit

Existing code, documents, research, and reusable components.

<!-- english-original-anchor --> <a id="3-scientific-research"></a>
### 3. Scientific Research

Papers and evidence on acoustics, physics, DSP, collision sounds, and moving sources.

<!-- english-original-anchor --> <a id="4-dataset-catalog"></a>
### 4. Dataset Catalog

Usable public data and validation datasets.

<!-- english-original-anchor --> <a id="5-steam-audio-feasibility"></a>
### 5. Steam Audio Feasibility

SDK version, licensing, installation status, test results, and recommended integration approach.

<!-- english-original-anchor --> <a id="6-physics-interaction-architecture"></a>
### 6. Physics Interaction Architecture

Complete technical specifications for FPS, Grab, Throw, Gravity, Fixed Body, and Collision Audio.

<!-- english-original-anchor --> <a id="7-uiux-research"></a>
### 7. UI/UX Research

Comparison of mature products, Workspace design, first-person interaction workflows, and main component specifications.

<!-- english-original-anchor --> <a id="8-architecture-decision-records"></a>
### 8. Architecture Decision Records

The formally recommended architecture, alternative architectures, and decision rationale.

<!-- english-original-anchor --> <a id="9-agent-harness"></a>
### 9. Agent Harness

The AGENTS.md, Skills, directories, Scripts, and Developer Tooling actually created.

<!-- english-original-anchor --> <a id="10-validation--readiness"></a>
### 10. Validation & Readiness

All tests run, pass status, limitations, and unverified items.

<!-- english-original-anchor --> <a id="11-implementation-roadmap"></a>
### 11. Implementation Roadmap

Production development work and completion conditions for each phase during the competition.

<!-- english-original-anchor --> <a id="12-immediate-next-engineering-task"></a>
### 12. Immediate Next Engineering Task

Write the next production development task as a concrete work item that can be handed directly to Codex.

Do not independently start full product development in this phase.

---

<!-- english-original-anchor --> <a id="18-final-execution-instructions"></a>
# 18. Final Execution Instructions

Begin the actual work now.

First perform Repository Discovery and Hackathon Compliance Review.

If the Agent Harness supports Subagents, delegate these independent research areas:

- Acoustic Theory / Scientific Evidence
- Steam Audio SDK / Licensing
- Physics / First-person Interaction
- UI/UX Competitive Research
- Meta AI / Agent Architecture

The principal agent is responsible for integrating conclusions, checking contradictions, creating ADRs, configuring AGENTS.md and Skills, running validation, and delivering complete research findings.

Do not let multiple agents modify the same document simultaneously.

If work is delegated, each research agent must report verified sources, evidence, limitations, and specific deliverable files.

After research, use the conclusions to actually create project preparation files, install and validate appropriate dependencies, and complete SDK preparation and minimal tests.

For items that cannot be completed, state the actual obstacles, methods already attempted, and conditions needed to remove the obstacles later.

**Final acceptance criterion for this work:**

When the next Codex Session enters this Repository, it should be able to understand Reflection Lab's research basis, implementation direction, technical limitations, and development sequence through AGENTS.md, Skills, Architecture, Research Documents, and Benchmarks, and directly begin the first production development phase without repeating the same foundational research.

In the final response, list the files actually created or modified, research evidence, SDK status, test results, adopted architecture, unresolved issues, and the first implementation task for the next phase.

**Start immediately with Phase A. Autonomously complete all research and preparation work that can currently be executed.**