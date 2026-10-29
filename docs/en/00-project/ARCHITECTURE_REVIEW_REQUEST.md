<!-- english-source: {"path":"docs/00-project/ARCHITECTURE_REVIEW_REQUEST.md","sha256":"f08948c0cf0a3b6a9885fa3020aa5aedfde827949dd12541c650b19de93f21a9","translated_at":"2026-10-29T05:23:24Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/ARCHITECTURE_REVIEW_REQUEST.md`](../../00-project/ARCHITECTURE_REVIEW_REQUEST.md). Source SHA-256: `f08948c0cf0a3b6a9885fa3020aa5aedfde827949dd12541c650b19de93f21a9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab--comprehensive-research-architecture-refinement--git-worktree-integration"></a>
# Reflection Lab — Comprehensive Research, Architecture Refinement & Git Worktree Integration

<!-- english-original-anchor --> <a id="0-mission--execution-contract"></a>
## 0. Mission & Execution Contract

You are now the Principal Software Architect, Computational Acoustics Researcher, Audio DSP Engineer, Physics Systems Architect, Cloud Infrastructure Architect, and Independent Quality Assurance Lead for the Reflection Lab project.

Development of Reflection Lab's first version has already begun.

This task requires creating a complete, independent Git Worktree **without interfering with existing development work**, and conducting comprehensive research, technical architecture review, reasonable architecture refinements, testing, and documentation updates within it.

After completion, compare the results with the original branch under development, confirm the differences and compatibility, and merge back into the original branch only after verification passes.

Finally, push the integrated project to:

https://github.com/kekekewww/Reflections-Lab.git

This is the explicitly authorized final Git Push destination.

**This task requires actually performing research, file modifications, Worktree management, testing, merging, and Push, rather than merely producing a plan.**

<!-- english-original-anchor --> <a id="核心要求"></a>
### Core Requirements

1. Preserve all completed code and history from the current first version.
2. Do not interrupt, reset, overwrite, or damage the original workspace.
3. Perform all research and architecture adjustments in an independent Worktree wherever possible.
4. Prefer preserving the existing architecture and avoid unnecessary full rewrites.
5. Support every major technical decision with research or test evidence.
6. Complete the research and minimum necessary architecture adjustments before performing difference analysis.
7. Pass appropriate tests and Regression Gates before merging.
8. Account for new progress on the original branch during the research period when merging.
9. Push to the specified GitHub Repository after a successful merge.
10. Maintain the LLM Wiki, ADRs, Task Records, and Agent Handoff throughout the process.

Subagents may perform independent research, but the primary agent must take responsibility for integration and verification.

Project documentation uses Traditional Chinese (Taiwan); code, APIs, and necessary technical terms remain in English.

---

<!-- english-original-anchor --> <a id="1-phase-a--repository-preflight--baseline-protection"></a>
# 1. Phase A — Repository Preflight & Baseline Protection

Before beginning research, inspect the actual local Repository.

Run the applicable Git Read-only Commands:

```bash
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
git worktree list
git log -5 --oneline
```

Confirm:

- The current Git Repository Root.
- The original branch under development.
- The HEAD Commit.
- Whether uncommitted changes exist.
- Whether Untracked Files exist.
- Whether other Worktrees already exist.
- The actual URL of the current Remote.
- Whether the Repository already has Commits.
- The Build / Test Commands currently available for the first version.

<!-- english-original-anchor --> <a id="11-github-remote"></a>
## 1.1 GitHub Remote

Target Repository:

`kekekewww/Reflections-Lab`

The GitHub Repository is known to be Public, with `main` as its default branch, and had no Commits when this task was requested.

Check the remote state again.

Do not assume the remote is still empty or that the local `origin` already points to the correct Repository.

If the local `origin` points to another Repository, do not overwrite it directly.

Create another clearly named Remote, or use an equally safe and traceable method to push the results to the specified destination.

<!-- english-original-anchor --> <a id="12-baseline-snapshot"></a>
## 1.2 Baseline Snapshot

Before creating the Worktree, save:

- Original Branch Name.
- Original HEAD SHA.
- Current Working Tree Status.
- Current Architecture Summary.
- Existing Feature Status.
- Existing Test Results.
- Current LLM Wiki State.

Do not perform the following without authorization:

- `git reset --hard`
- `git clean -fd`
- Force Push
- Uncontrolled Git Stash
- Overwriting uncommitted changes
- Deleting an existing Branch
- Recreating the entire Repository

If the original workspace has uncommitted changes, explicitly distinguish the committed Baseline from work that has not yet been committed.

A Git Worktree does not automatically include uncommitted or untracked files from another workspace.

Do not treat uncommitted first-version progress as nonexistent.

If no Git Commit exists yet, inspect sensitive data and Git Ignore first, then safely create the first traceable Baseline Commit; do not indiscriminately add every file to version control.

If a Baseline cannot be created safely, preserve the current state and mark the blocker; do not force the process forward into merging and pushing.

---

<!-- english-original-anchor --> <a id="2-phase-b--create-isolated-research-worktree"></a>
# 2. Phase B — Create Isolated Research Worktree

Use a Git Worktree rather than creating another independent GitHub Fork.

The goal is to share the existing Git Repository's history and object database while creating a completely separate working directory, branch, and environment for file modifications.

Suggested names:

- Branch: `research/architecture-review-20261029`
- Worktree: `../Reflections-Lab-research`

If a name already exists, use a unique, nonconflicting name. Do not use `-B` to reset an existing branch.

Example:

```bash
git worktree add \
  -b research/architecture-review-20261029 \
  ../Reflections-Lab-research \
  <ORIGINAL_BASE_SHA>
```

`<ORIGINAL_BASE_SHA>` must come from the actual Repository.

After creation, confirm:

```bash
git worktree list
git status
git branch --show-current
git rev-parse HEAD
```

Ensure that:

1. The new Worktree contains all project files tracked by the Baseline Commit.
2. The original workspace retains its original branch and changes.
3. All research and code adjustments occur only in the Research Worktree.
4. The two Worktrees do not share Build Output or local state that needs modification.
5. Dependency installation and environment setup do not damage the original development environment.
6. The Worktree is not placed inside the original Repository, causing recursive file pollution.

Perform all research work for this task within the new Worktree Root.

Do not directly modify the original workspace before the merge phase.

---

<!-- english-original-anchor --> <a id="3-phase-c--complete-project-audit"></a>
# 3. Phase C — Complete Project Audit

Comprehensively inventory the features actually completed in the first version.

Do not infer the current code state from previous discussions.

Inspect:

- React / TypeScript.
- Three.js / React Three Fiber.
- Rapier 3D.
- Web Audio / AudioWorklet.
- Acoustic Core.
- Physics Runtime.
- Scene Editor.
- First-Person Simulation.
- Sound Behavior System.
- Motion Authoring.
- Recorder / Playback.
- Render / Export.
- Meta Model API.
- AGENTS.md / Skills.
- LLM Wiki.
- Testing / Benchmark.
- Deployment Configuration.

Mark each capability as:

`IMPLEMENTED / PARTIAL / PLANNED / EXPERIMENTAL / BLOCKED / UNVERIFIED`

Also record:

- Relevant code paths.
- Actual operational flow.
- Dependencies.
- Test coverage.
- Known issues.
- Research or refactoring needs.

Pay particular attention to features that exist only in documentation and have no actual code implementation.

Create an Architecture Gap Analysis.

Prioritize completing architecture contracts and future extensibility; do not overturn a functioning first version merely because the research is being revisited.

---

<!-- english-original-anchor --> <a id="4-phase-d--scientific--engineering-research"></a>
# 4. Phase D — Scientific & Engineering Research

Conduct comprehensive technical research and integrate existing research results.

Do not collect the same material again if it has already been verified and remains valid.

Prioritize:

- Official documentation.
- Peer-reviewed Research.
- IEEE / AES / JASA.
- ITU / EBU / ISO.
- Official SDKs.
- Open-source projects with tests and active maintenance.
- Reproducible Benchmarks.
- The latest stable API Reference.

Distinguish every important conclusion as one of:

- Verified Fact.
- Analytical Result.
- Engineering Estimate.
- Model Approximation.
- Proposed Design.
- Unverified Assumption.

<!-- english-original-anchor --> <a id="d1-3d-physics--interaction"></a>
## D1. 3D Physics & Interaction

Research Rapier 3D:

https://rapier.rs/

The scope includes:

- Dynamic / Fixed / Kinematic RigidBodies.
- Gravity Scale.
- Physics Fixed Step.
- Collision / Contact Events.
- Raycast.
- Character Controller.
- Physics-based Grab.
- Move / Drop / Throw.
- Spring / Joint / Impulse.
- Continuous Collision Detection.
- Dynamic Object States.
- Deterministic Recording.

The goal is to support first-person and third-person interaction.

Both perspectives must use the same Physics Runtime and Scene State.

<!-- english-original-anchor --> <a id="d2-motion-authoring"></a>
## D2. Motion Authoring

Research and design:

**Move To**

An object moves according to a specified position, orientation, speed, and curve, then stops or enters a Hold State when it reaches the target.

**Move & Release**

An object moves under control along a specified path. Upon reaching the target, control is released and the object becomes a Dynamic RigidBody, retaining the configured release velocity and angular velocity and continuing to respond to the physics engine.

**Apply Impulse**

An impulse is applied directly to the object, which then moves naturally according to the physics simulation; reaching a specified position is not guaranteed.

Research:

- Motion Curve Presets.
- Linear / Ease In / Ease Out / Ease In-Out.
- Velocity / Acceleration.
- Release Velocity.
- Dynamic / Kinematic Transitions.
- Motion Timeline.
- Motion State Recording.
- Motion Gizmo.
- First-person / Third-person Controls.

In particular, verify that transitions between controlled motion and physical motion do not cause wall penetration, velocity discontinuities, or unreasonable collisions.

<!-- english-original-anchor --> <a id="d3-sound-behavior-system"></a>
## D3. Sound Behavior System

Research how objects can produce editable sound effects in different states.

Events must include at least:

- Always On.
- On Grab.
- On Release.
- On Throw.
- On Drop.
- While Moving.
- While Airborne.
- On Impact.
- On Bounce.
- While Rolling.
- While Sliding.
- On Motion Start / End.

Research:

- Event Trigger.
- State Machine.
- Parameter Mapping.
- Material Pair.
- Collision Impulse.
- Sample Playback.
- Procedural Sound.
- Gain / Pitch / Filter Automation.
- Event Cooldown.
- Voice Management.
- Audio Source Position.
- Sound Behavior Presets.

References:

https://www.fmod.com/docs/

https://www.audiokinetic.com/

https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine

Sound generation and physical motion must be separated.

Users may replace collision sound effects with a piano, electronic tone, or other creative sound, but spatial propagation must still follow the specified acoustic model.

<!-- english-original-anchor --> <a id="d4-custom-acoustic-core"></a>
## D4. Custom Acoustic Core

Retain the custom Web-native Acoustic Core.

Research:

- Image Source Method.
- Ray Intersection / Visibility.
- Direct Sound.
- First-order Reflection.
- Multi-order Reflection.
- Reflection Path Identity.
- Occlusion / Transmission.
- Frequency-dependent Materials.
- Atmospheric Absorption.
- Dynamic Source / Listener.
- Room Impulse Response.
- Early / Late Reflections.
- HRTF / Binaural Rendering.
- Propagation Delay.
- Numerical Stability.
- Time-varying Acoustic Parameters.

Establish independent verification for important mathematical models.

Pay particular attention to consistent time references for direct and reflected sound, stable reflection path identities, and the definitions of material energy coefficients.

Steam Audio currently serves only as an optional Backend, a research reference, and an independent source for comparison.

Do not treat Steam Audio as a required dependency; there is also no need to directly rewrite the existing acoustic core for this research task.

<!-- english-original-anchor --> <a id="d5-sound-recording--performance-timeline"></a>
## D5. Sound Recording & Performance Timeline

Research complete Scene Performance Recording.

Recorded content should include:

- Initial Scene Snapshot.
- Object Motion Tracks.
- Physics States.
- Collision Events.
- Sound Behavior Events.
- Audio Asset References.
- Source Positions.
- Listener Position / Orientation.
- Material Configuration.
- Simulation Settings.
- Acoustic Backend Version.
- Timestamps / Sample Timeline.

Design a unified time contract.

It must address:

- Fixed Physics Step.
- Audio Sample Time.
- Timeline Interpolation.
- Recording Start / Stop.
- Replay.
- Event Deduplication.
- Deterministic or Snapshot-based Playback.
- Experiment A/B.

The authoritative recording data should not consist solely of a Stereo WAV.

It should be possible to change the Listener or HRTF when rerendering and produce different acoustic results.

<!-- english-original-anchor --> <a id="d6-offline-audio-rendering"></a>
## D6. Offline Audio Rendering

Research:

- OfflineAudioContext.
- AudioWorklet.
- Long-duration Rendering.
- Chunked Processing.
- DSP State Continuity.
- HRTF Rendering.
- Reverb Tail.
- WAV Encoding.
- Memory Budget.
- Batch Rendering.
- Render Job Lifecycle.

Plan at least the following outputs:

**Binaural Mixdown**

A binaural Stereo WAV mixing all sound sources.

**Individual Object Stems**

Render each object independently while retaining the physical interactions and time alignment of the same experiment.

**Selected Parallel Stems**

Select multiple sound sources for individual output, preventing sound content from other objects from being mixed in.

**Dry / Wet Multitrack**

Preserve separate layers of direct sound and spatial processing for DAW post-production.

Distinguish "sound source audio isolation" from "physical world isolation."

Even when outputting only one object, retain the physical effects that other objects had on it during the original recording, including collisions and occlusion.

For nonlinear bus processing, do not assume that summing the Stems necessarily equals the Full Mix.

<!-- english-original-anchor --> <a id="d7-adm--object-based-audio"></a>
## D7. ADM / Object-based Audio

Research:

- ITU-R BS.2076.
- ADM.
- BW64.
- Audio Objects.
- Object Position Metadata.
- Audio Track UID.
- Timeline / Coordinate Conversion.
- Bed / Objects.
- EBU libadm / libbw64.
- Dolby Atmos Compatibility.

References:

https://www.itu.int/rec/R-REC-BS.2076/en

https://github.com/ebu/libadm

https://github.com/ebu/libbw64

Distinguish general ADM BWF from Dolby Atmos-specific delivery requirements.

Production ADM export may be assigned to a later Milestone, but compatible data contracts should be reserved in advance.

---

<!-- english-original-anchor --> <a id="5-phase-e--browser-performance--cloud-architecture"></a>
# 5. Phase E — Browser Performance & Cloud Architecture

This is a new high-priority research area for this task.

The product is currently planned for Web-first development, with future cloud deployment for multiple users.

The central question:

**When many users are active simultaneously, how can cloud servers avoid handling the complete 3D physics, acoustics, and real-time audio computation for every user?**

<!-- english-original-anchor --> <a id="e1-preferred-architecture"></a>
## E1. Preferred Architecture

Initial architecture:

**Client-side**

- React / Three.js.
- Rapier Physics.
- Custom Acoustic Worker.
- Web Audio / AudioWorklet.
- Sound Behavior Runtime.
- Motion Authoring.
- Scene Performance Recorder.
- Local Offline Renderer.

**Cloud-side**

- Static Hosting / CDN.
- Authentication.
- Project Metadata Database.
- Asset Storage.
- Meta Model API Proxy.
- AI Quota / Rate Limiting.
- Optional Render Queue.
- Optional Autoscaling Render Workers.

This is a candidate architecture requiring research and verification, rather than a final decision that may be implemented without review.

<!-- english-original-anchor --> <a id="e2-client-runtime"></a>
## E2. Client Runtime

Research:

- Main Thread.
- Web Workers.
- AudioWorklet.
- WebAssembly.
- SharedArrayBuffer.
- Cross-Origin Isolation.
- Message Passing.
- Memory Transfer.
- Physics / Acoustic Update Frequencies.
- Browser Audio Scheduling.
- Background Tab Throttling.
- Browser Memory Limits.
- OPFS / IndexedDB.

Focus the analysis on:

1. Can 3D Rendering block Physics?
2. Should the Acoustic Solver move entirely to a Worker?
3. Is it necessary to move Physics to a Worker as well?
4. Can Web Audio DSP sustain real-time computation?
5. How should reflection costs be bounded as the number of dynamic sound sources increases?
6. How should large numbers of sound effect events be managed?
7. How can Record / Replay avoid dependence on the Render Frame Rate?
8. How can large offline renders avoid consuming all RAM at once?

<!-- english-original-anchor --> <a id="e3-cloud-infrastructure"></a>
## E3. Cloud Infrastructure

Compare at least:

- Vercel.
- Cloudflare Pages / Workers / R2.
- Supabase / PostgreSQL.
- Google Cloud Run Jobs.
- Container-based Render Workers.
- Object Storage.
- Render Queue.

Evaluate these options using the latest official pricing, resource limits, and technical capabilities.

Consider:

- 100 Concurrent Users.
- 1,000 Concurrent Users.
- 10,000 Concurrent Users.
- AI Requests / Minute.
- Project Save Frequency.
- Audio Asset Upload.
- Render Job Concurrency.
- WAV / Stem Download.
- Storage Retention.
- Bandwidth / Egress.
- CPU / Memory Requirements.

Estimate separately:

- Low-load.
- Expected-load.
- High-load.

The cost model must show assumptions, units, and calculation methods.

Do not guarantee concurrent user capacity without measurements or a usage model.

<!-- english-original-anchor --> <a id="e4-local-first-rendering"></a>
## E4. Local-first Rendering

Prioritize evaluating:

**Browser Local Render**

The client performs short Binaural / Stems renders.

**Optional Cloud Render**

For future high-quality, long-duration, or large-scale Stems output.

Cloud rendering must not be a required dependency for the MVP.

Establish a replaceable Render Backend contract.

Consider compatibility between browser Web Audio and future Native / Server DSP. Do not assume Browser-only APIs can run directly in Node.js.

<!-- english-original-anchor --> <a id="e5-performance-budgets"></a>
## E5. Performance Budgets

Research and establish adjustable initial performance targets:

- Desktop 3D: 60 FPS Target.
- Physics: Fixed 60 Hz Target.
- Active Dynamic Bodies: 8–16.
- Active Audio Sources: 4–8.
- Early Reflection Budget: determined by energy, perceptual importance, and performance.
- Acoustic Updates: initially evaluate 10–20 Hz.
- Audio: 48 kHz Stereo.
- Event Voices: appropriate limits with support for Voice Stealing.
- Local Recording: first verify 1–3 minutes.
- Offline Render: Full Mix + Independent Stems.

These are only engineering targets pending verification.

Actual feasibility must be confirmed through Benchmarks.

Record:

- FPS / Frame Time.
- Physics Step p95 / p99.
- Acoustic Solver p95 / p99.
- Audio Glitches / Dropouts.
- Memory Peak.
- Render Time.
- File Size.
- Long Task.
- Main Thread Blocking.
- Browser Compatibility.

Design at least two test environments: a typical laptop and a high-end development machine.

---

<!-- english-original-anchor --> <a id="6-phase-f--uiux--interaction-architecture"></a>
# 6. Phase F — UI/UX & Interaction Architecture

Comprehensively research the UI already established.

References:

- Unity Editor.
- Blender.
- Sound Particles.
- FMOD Studio.
- Wwise Spatial Audio.
- Treble.
- ODEON.
- Garry's Mod.

Design engineering guidelines:

https://github.com/emilkowalski/skills

Read the currently installed Skills and Design System first; do not unconditionally reinstall or overwrite them.

Core Workspaces:

1. Scene Editor.
2. Simulation.
3. Acoustic Analysis.
4. Render & Export.

First-person and third-person modes should share:

- Object Selection.
- Motion Actions.
- Physics State.
- Sound Behavior.
- Recording Commands.

Research and refine:

- Scene Explorer.
- 3D Viewport.
- Contextual Inspector.
- Motion Gizmo.
- Motion Curves.
- First-person HUD.
- Sound Behavior Inspector.
- Timeline.
- Acoustic Path Inspector.
- Render Dialog.
- AI Command Palette.

The goal is to reduce redundant operations and duplicated state.

Rebuilding the entire UI is not required in this research task.

Make limited changes only when the current architecture has problems that would obstruct future extension.

---

<!-- english-original-anchor --> <a id="7-phase-g--meta-muse-agent-runtime"></a>
# 7. Phase G — Meta Muse Agent Runtime

Recheck the official rules of the Meta Global AI Developer Hackathon and the Meta Model API documentation.

The project's formal strategy:

**Codex handles software development; the Meta Muse Agent handles AI features within the Reflection Lab product.**

Muse Code is not a required development agent.

Previous research into Muse Code Headless Orchestration, Quota Failover, and related topics may be retained, but should be reclassified as Optional / Superseded.

Do not treat Muse Code development work as evidence of Meta AI integration within the product.

<!-- english-original-anchor --> <a id="g1-muse-agent-capabilities"></a>
## G1. Muse Agent Capabilities

Research:

- Scene Generation.
- Object Creation.
- Material Assignment.
- Physics Configuration.
- Motion Authoring.
- Sound Behavior Authoring.
- Experiment Planning.
- Simulation Tool Calling.
- Acoustic Result Analysis.
- Render Job Configuration.

Use Tool Calling and Structured Outputs from the Meta Model API.

Research the latest available Muse models, Model IDs, latency, cost, and Prompt Design.

<!-- english-original-anchor --> <a id="g2-agent-tool-contract"></a>
## G2. Agent Tool Contract

Evaluate at least:

- CreateScene
- AddObject
- SetMaterial
- SetRigidBodyMode
- CreateMotionAction
- ConfigureSoundBehavior
- SetListener
- StartRecording
- RunSimulation
- CaptureExperiment
- AnalyzeAcoustics
- CompareExperiments
- CreateRenderJob

Every tool must have Schema Validation, permission restrictions, resource budgets, and reversible state management.

AI must not fabricate acoustic experiment values.

Acoustic and physics results must be calculated by a deterministic Runtime.

<!-- english-original-anchor --> <a id="g3-meta-api-security"></a>
## G3. Meta API Security

All API Keys must be stored in a secure Server-side Environment.

Do not expose Meta Model API Secrets directly in the browser Bundle.

Establish:

- Authentication.
- Rate Limiting.
- Request Validation.
- Usage Quota.
- Retry / Timeout.
- Error Handling.
- Spending Limits.
- Mock / Offline Test Mode.

If the Muse API is unavailable, manual editing and physics simulation must continue to function normally.

---

<!-- english-original-anchor --> <a id="8-phase-h--llm-wiki--durable-project-knowledge"></a>
# 8. Phase H — LLM Wiki & Durable Project Knowledge

Reference:

https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

Continue using the existing LLM Wiki.

Do not rebuild a separate long-term memory system.

Research and architecture changes require updating:

- Current State.
- Project Goals.
- Feature Status.
- Technical Decisions.
- Research Evidence.
- Experiment Results.
- Performance Findings.
- Architecture Limitations.
- Roadmap.
- Task Backlog.
- Agent Handoffs.

<!-- english-original-anchor --> <a id="h1-worktree-aware-memory"></a>
## H1. Worktree-aware Memory

Pay particular attention to the following:

Different Git Worktrees share a Git Repository but have different working files and branch states.

The Wiki therefore needs to record:

- Worktree Name / Path.
- Research Branch.
- Original Branch.
- Baseline Commit.
- Research Commits.
- Merged Commit.
- GitHub Remote.
- Integration Status.

Do not let provisional conclusions in the research Worktree directly overwrite formal decisions currently used by the original branch.

Create all new ADRs on the research branch first.

They become effective decisions for the integration branch only after the formal merge.

<!-- english-original-anchor --> <a id="h2-documentation-rules"></a>
## H2. Documentation Rules

Maintain a single Source of Truth.

Research documents should not duplicate formal Architecture in different versions.

If a document already exists, prioritize updating the existing file while retaining necessary version and history records.

Document references and Wiki links must pass Lint.

---

<!-- english-original-anchor --> <a id="9-phase-i--architecture-refinement"></a>
# 9. Phase I — Architecture Refinement

After completing the research, check whether the existing architecture needs refinement.

Focus on:

1. Scene Document / Runtime State Separation.
2. Physics Runtime Boundaries.
3. Motion Authoring Contract.
4. Sound Behavior Event Contract.
5. Custom Acoustic Backend Interface.
6. Audio DSP / Source Graph.
7. Experiment Recording Schema.
8. Render Job / Export Backend.
9. Browser Worker Architecture.
10. Cloud-ready API Boundaries.
11. Muse Agent Tool Schema.
12. Project Persistence / Versioning.

<!-- english-original-anchor --> <a id="i1-change-classification"></a>
## I1. Change Classification

Classify all changes as:

**Category A — Documentation Only**

Research, architecture diagrams, ADRs, Benchmarks, Roadmap, and API Contracts.

**Category B — Non-breaking Architectural Adjustments**

New Interfaces, Adapters, Schemas, Feature Flags, test tools, or small compatibility fixes.

**Category C — Breaking Changes**

Changes requiring modifications to existing data formats, core modules, Audio Runtime, or Scene Lifecycle.

Prioritize A and B.

Consider Category C only when the current architecture has been proven unable to meet core requirements, a complete Migration Strategy exists, and the change will not damage the first version.

Do not rewrite functioning code wholesale merely because a more ideal architecture exists.

<!-- english-original-anchor --> <a id="i2-technical-spikes"></a>
## I2. Technical Spikes

For high-risk technical issues that remain unresolved, create isolated minimal tests if needed.

Prioritize:

- AudioWorklet / Worker Messaging.
- Dynamic Reflection Update.
- Motion Release State Transition.
- Multi-source OfflineAudioContext.
- WAV / Stems Export Memory.
- RecordedTake Replay.
- Cloud Render Backend Contract.

Each Spike must have a clear question, limitations, tests, and conclusions.

Do not connect experimental code directly to the production Runtime unless the relevant regression tests pass.

---

<!-- english-original-anchor --> <a id="10-phase-j--research-deliverables--implementation-planning"></a>
# 10. Phase J — Research Deliverables & Implementation Planning

Research deliverables must cover at least:

- `ARCHITECTURE_REVIEW.md`
- `ARCHITECTURE_GAP_ANALYSIS.md`
- `PHYSICS_AND_MOTION_RESEARCH.md`
- `SOUND_BEHAVIOR_RESEARCH.md`
- `CUSTOM_ACOUSTIC_CORE_RESEARCH.md`
- `RECORDING_AND_REPLAY_RESEARCH.md`
- `OFFLINE_RENDERING_RESEARCH.md`
- `ADM_EXPORT_RESEARCH.md`
- `BROWSER_PERFORMANCE_RESEARCH.md`
- `HYBRID_CLOUD_ARCHITECTURE.md`
- `CLOUD_COST_MODEL.md`
- `MUSE_AGENT_ARCHITECTURE.md`
- `UI_UX_REVIEW.md`
- `VALIDATION_PLAN.md`
- `INTEGRATION_REPORT.md`

These are required content areas; a new file is not required for every topic.

Update, consolidate, and reference material appropriately based on the existing Repository documentation locations to avoid redundancy.

Also create an actionable Roadmap:

**P0 — Hackathon MVP**

Maintain the currently usable 3D Scene, Physics Interaction, sound sources, and core acoustic flow, prioritizing features needed for the Demo.

**P1 — Production Workflow**

Motion Authoring, Sound Behavior, Scene Recording, Binaural / Stems Export, and Muse Agent.

**P2 — Advanced Acoustic & Export**

Advanced Reflections, ADM, Cloud Render, long-duration rendering, and additional research features.

Adjust priorities based on actual first-version progress, the competition deadline, and remaining engineering risks.

Do not classify every researched feature as mandatory for this competition merely because research into it is complete.

---

<!-- english-original-anchor --> <a id="11-phase-k--independent-verification"></a>
# 11. Phase K — Independent Verification

After completing research and architecture refinements, run appropriate verification in the Research Worktree.

Include at least:

- Dependency Installation Check.
- Typecheck.
- Lint.
- Unit Tests.
- Integration Tests.
- Build.
- Regression Tests.
- Schema Validation.
- Wiki Lint.
- Git Diff Check.

If the project already has Playwright or Browser E2E tests, run them.

For UI changes, inspect the actual display and interactions.

For acoustic and physics changes, pass the relevant mathematical and numerical tests.

For audio output, check:

- Sample Rate.
- Duration.
- Channel Count.
- NaN / Infinite Samples.
- Clipping.
- Timeline Alignment.
- Stem Isolation.
- Render Tail.

For Runtime Architecture changes, confirm that:

- The existing first version still starts normally.
- FPS / Physics have no regressions.
- Sound Behavior has no duplicate events.
- Audio playback has no unexpected interruptions.
- Recorder / Renderer data contracts remain compatible.
- The Meta Agent API does not disrupt manual operations.

Do not claim all features are correct merely because Build succeeds.

Mark features that are not yet implemented as PLANNED rather than PASS.

---

<!-- english-original-anchor --> <a id="12-phase-l--original-branch-comparison"></a>
# 12. Phase L — Original Branch Comparison

This is one of the most important integration phases of the entire task.

**Do not merge immediately after completing the research and changes.**

First obtain:

- Original Baseline Commit.
- Current Original Branch HEAD.
- Research Branch HEAD.
- Merge Base.
- Commits added to the Original Branch since research began.

In particular, the original branch may continue developing during the research period.

Compare against the current original branch rather than only the Baseline from the beginning of the research.

Use appropriate Git Diff / Log Commands:

```bash
git log --graph --oneline --decorate --all
git diff --stat <BASE>..<RESEARCH_HEAD>
git diff --name-status <BASE>..<RESEARCH_HEAD>
git merge-base <ORIGINAL_BRANCH> <RESEARCH_BRANCH>
git diff <ORIGINAL_BRANCH>...<RESEARCH_BRANCH>
```

These variables must come from the actual Git state.

Also inspect the changes each branch has independently added since the Merge Base. Do not rely on a single Three-dot Diff to assess all differences.

<!-- english-original-anchor --> <a id="l1-compatibility-review"></a>
## L1. Compatibility Review

Compare:

- Existing first-version features.
- Documents added in the Research Worktree.
- New architecture and Schemas.
- Modified Interfaces.
- Git Conflicts.
- Dependency Changes.
- Breaking Changes.
- Tests.
- AGENTS.md / Wiki.
- Current Roadmap.

Produce:

**Original vs Research Architecture Comparison**

Include at least:

- Changed Files.
- New Files.
- Deleted Files.
- Behavior Changes.
- Architectural Decisions.
- Risk Assessment.
- Required Migration.
- Regression Impact.
- Merge Recommendation.

<!-- english-original-anchor --> <a id="l2-merge-preparation"></a>
## L2. Merge Preparation

If development has continued on the original branch, prioritize integrating its latest changes into the research Worktree and resolving actual conflicts there.

Do not overwrite newer first-version implementations with old research results.

For conflicts:

- Read each difference individually.
- Preserve existing correct functionality.
- Decide based on newer valid requirements and tests.
- Do not accept all of ours or theirs without analysis.
- Retain records of conflicts that cannot be resolved confidently; do not force a merge.

Run the tests again after completing integration preparation.

---

<!-- english-original-anchor --> <a id="13-phase-m--merge-back-to-original-branch"></a>
# 13. Phase M — Merge Back to Original Branch

Merge only after all of the following conditions pass:

1. Research Worktree changes are complete.
2. The Architecture Review is complete.
3. The Difference Report has been produced.
4. Required Regression Tests pass.
5. No major unresolved conflicts remain.
6. No unaddressed sensitive data remains.
7. The current modification state of the original branch allows a safe merge.

Return to the original workspace and confirm the actual branch and working state.

Do not assume the original branch is named `main`.

If the original workspace has uncommitted changes, do not automatically overwrite them or Stash them.

If safe merge conditions are met, merge in a way that preserves research history, for example:

```bash
git merge --no-ff <RESEARCH_BRANCH>
```

Before executing the command, confirm that the current branch is the correct integration target.

After the merge, run the following again:

- Typecheck.
- Lint.
- Unit / Integration Tests.
- Build.
- Relevant E2E.
- Wiki Validation.
- Smoke Tests.

If the merge introduces new errors, fix them and verify again.

Do not push while tests are failing.

After completion, create an integration report recording:

- Original Baseline SHA.
- Research Branch SHA.
- Merge Commit SHA.
- Merged files.
- Verification results.
- Remaining limitations.

Do not automatically delete the Research Branch or Worktree.

Retain them at least until GitHub Push and remote verification succeed.

---

<!-- english-original-anchor --> <a id="14-phase-n--security--github-publication-review"></a>
# 14. Phase N — Security & GitHub Publication Review

Before the final Push, perform a complete Repository Publication Audit.

Target:

https://github.com/kekekewww/Reflections-Lab.git

This Repository is public.

Therefore inspect:

- `.env`
- API Keys
- Meta Model API Tokens
- GitHub Tokens
- Cloud Credentials
- Database Passwords
- Private Certificates
- Private files
- Sensitive user data
- Paid or unlicensed sound effects
- Unauthorized research PDFs
- SDK Binary
- Large audio rendering results
- Local Cache
- `node_modules`
- Build Artifacts
- Unauthorized third-party assets

Inspect not only current files but also the Git History about to be pushed for sensitive information.

Do not push Secrets to a Public Repository.

Do not independently add private credentials or large research materials to Git.

Required third-party research materials may be retained as:

- Source URL.
- Metadata.
- License.
- Version.
- Hash.
- Reproducible Download Script.

If sensitive data is found already committed in history, do not ignore it and continue with Push; address it safely first and record the blocker.

---

<!-- english-original-anchor --> <a id="15-phase-o--push-to-github"></a>
# 15. Phase O — Push to GitHub

After all merging, testing, and public safety checks pass, perform the GitHub Push.

Confirm that the remote actually corresponds to:

`https://github.com/kekekewww/Reflections-Lab.git`

If the remote is still an empty Repository and local `main` is the confirmed formal integration branch, use a safe first Push:

```bash
git push -u <TARGET_REMOTE> main
```

`<TARGET_REMOTE>` must be confirmed from the actual configuration.

If the formal local development branch is not `main`, first determine its relationship to the final publication `main`; do not publish the wrong branch as the formal main branch without checking.

If the remote already contains Commits:

1. Fetch first.
2. Compare Remote and Local.
3. Check whether the update is a Fast-forward.
4. Preserve existing remote history.
5. Use a safe Merge or Pull Request workflow if necessary.
6. Do not Force Push.

If Branch Protection or Required Checks exist, follow the Repository settings and complete integration through a PR and the necessary verification.

**The goal is to actually complete the push, rather than merely produce a Push command.**

However, do not bypass protections if authentication issues, Branch Protection, history conflicts that cannot be resolved safely, or sensitive data issues arise.

Retain the completed local results and clearly report the specific blocker.

<!-- english-original-anchor --> <a id="o1-remote-verification"></a>
## O1. Remote Verification

After Push succeeds, confirm:

- The GitHub Repository is accessible.
- The formal integration branch has been uploaded.
- Remote HEAD matches the expected Local Commit.
- README displays correctly.
- AGENTS.md exists.
- LLM Wiki / Project Docs exist.
- The new research documents have been uploaded.
- Architecture / Schema / Tests have been uploaded.
- `.gitignore` works correctly.
- No sensitive data has been pushed.
- GitHub Actions / CI, if present, has a healthy status.

Report the formal Commit SHA, Branch, and GitHub URL.

Retain the research branch for later review if necessary, but do not push unreviewed private data or large temporary files.

---

<!-- english-original-anchor --> <a id="16-final-acceptance-gates"></a>
# 16. Final Acceptance Gates

This task must pass the following stages:

| Gate | Requirement |
|---|---|
| G0 | Complete inventory of the original Repository |
| G1 | Independent Research Worktree successfully created |
| G2 | Original workspace remains undamaged |
| G3 | Technical research and evidence organization complete |
| G4 | Browser / Cloud Architecture evaluation complete |
| G5 | Necessary architecture refinements complete |
| G6 | Research Worktree verification passes |
| G7 | Difference review against the latest original branch complete |
| G8 | Safe merge and integration tests pass |
| G9 | Public Repository safety checks pass |
| G10 | GitHub Push succeeds |
| G11 | Remote Commit and file verification complete |
| G12 | LLM Wiki / Handoff updates complete |

Record each Gate as:

- PASS
- PARTIAL
- FAIL
- BLOCKED
- NOT RUN

Do not mark tests that have not been run as successful.

---

<!-- english-original-anchor --> <a id="17-final-report"></a>
# 17. Final Report

After completion, provide a complete research and integration report.

Include at least:

<!-- english-original-anchor --> <a id="repository"></a>
### Repository

- Original Branch / SHA.
- Research Branch / SHA.
- Worktree Path.
- Merge Commit.
- GitHub Remote / Branch.
- Push Verification.

<!-- english-original-anchor --> <a id="research"></a>
### Research

- Research completed.
- Official and academic sources used.
- High-risk issues discovered.
- Original architecture assumptions that need correction.
- Features that are already feasible and those still requiring verification.

<!-- english-original-anchor --> <a id="architecture"></a>
### Architecture

- Original architecture.
- Revised architecture.
- Important ADRs.
- New or modified Interfaces.
- Browser Runtime division of responsibilities.
- Cloud-ready Architecture.
- Render / Export Architecture.
- Muse Agent Integration.

<!-- english-original-anchor --> <a id="changes"></a>
### Changes

- Added files.
- Modified files.
- Deleted files.
- Breaking Changes.
- Migration Requirements.

<!-- english-original-anchor --> <a id="testing"></a>
### Testing

- Commands actually run.
- Number of passing tests.
- Failing tests.
- Performance Results.
- Limitations not yet verified.

<!-- english-original-anchor --> <a id="development-roadmap"></a>
### Development Roadmap

- Completed MVP capabilities.
- Issues requiring immediate fixes.
- Remaining P0 items for this hackathon.
- P1 / P2.
- The next formal development task that can be handed directly to Codex.

<!-- english-original-anchor --> <a id="github"></a>
### GitHub

Provide:

- Repository URL.
- Final Branch.
- Merge Commit SHA.
- Remote Commit SHA.
- Push success or failure status.
- GitHub Actions / CI results, if applicable.

---

<!-- english-original-anchor --> <a id="18-execution-rules"></a>
# 18. Execution Rules

This task authorizes:

- Creating a local Git Worktree.
- Creating an independent research Branch.
- Researching official documentation and papers.
- Modifying code and documentation in the Research Worktree.
- Creating necessary Technical Spikes.
- Running tests.
- Creating Commits.
- Comparing the original branch.
- Safely merging after verification passes.
- Pushing integrated results to the specified GitHub Repository.

It does not permit:

- Damaging the original workspace.
- Resetting the branch under development.
- Overwriting user changes without review.
- Force Push.
- Deleting important history.
- Bypassing Branch Protection.
- Uploading Secrets to a public Repository.
- Marking unverified acoustic capabilities as complete.
- Expanding or rewriting the entire product without limits in this task.

Prioritize using the existing LLM Wiki, Skills, AGENTS.md, ADRs, and Test Infrastructure.

Do not create parallel management systems that contradict one another.

If independent research can be delegated to Subagents, divide the work appropriately; every Agent must follow Worktree isolation and file responsibility restrictions.

**Completing the research does not mean the task is complete.**

This task must ultimately complete:

**Research → Architecture Refinement → Verification → Original Branch Comparison → Safe Merge → GitHub Push → Remote Verification.**

If all safety and verification conditions have been met, proceed directly to subsequent phases without stopping at every normal step for user confirmation.

If a blocker cannot be removed safely, stop the affected operation, retain completed results, and report it explicitly.

---

<!-- english-original-anchor --> <a id="start-execution"></a>
## Start Execution

Begin immediately:

1. Inspect the current local Repository.
2. Record the original branch and Baseline.
3. Create a complete, independent Research Worktree.
4. Complete all research and necessary architecture refinements in that Worktree.
5. Verify the research results and code compatibility.
6. Compare against the latest original branch.
7. Complete a safe merge.
8. Push to `https://github.com/kekekewww/Reflections-Lab.git`.
9. Verify the remote results.
10. Update the LLM Wiki and provide the final report.

**Final objective: while fully preserving existing first-version development results, give Reflection Lab a complete architecture supported by research and verification, establish the technical foundation for future expansion into a cloud spatial audio production platform, and reliably save the integrated results to GitHub.**

Begin execution now. Do not merely produce a research plan.
