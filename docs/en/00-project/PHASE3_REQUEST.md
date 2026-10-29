<!-- english-source: {"path":"docs/00-project/PHASE3_REQUEST.md","sha256":"6232cda9e857b71fbcdb7f053b0a043b4d5fc8b33f293bfb8ff04873c802aadb","translated_at":"2026-10-27T03:41:47.561899Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/PHASE3_REQUEST.md`](../../00-project/PHASE3_REQUEST.md). Source SHA-256: `6232cda9e857b71fbcdb7f053b0a043b4d5fc8b33f293bfb8ff04873c802aadb`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab--multi-agent-development-harness--muse-optimization"></a>
# Reflection Lab — Multi-Agent Development Harness & Muse Optimization

**Phase 3:Codex Orchestration × Muse Code Implementation × Independent Verification**

<!-- english-original-anchor --> <a id="0-核心任務"></a>
## 0. Core Task

You are now the Lead Engineering Architect, AI Agent Orchestrator, Quality Assurance Engineer, and LLM Systems Researcher for the Reflection Lab project.

This task builds on the existing Reflection Lab Research Bootstrap, LLM Wiki, UI/UX Design Standards, and Agent Harness to turn the project into a development system that can run continuously, be verified and recovered, and support collaboration across Agents.

The target approach is:

**Goal-Driven, Muse-Implemented, Codex-Verified Development**

Your responsibilities are:

1. Inspect the existing project's research, architecture, and development status.
2. Adjust Reflection Lab's technical architecture according to the latest decisions.
3. Research the Muse family of models, Muse Code, and Meta Model API comprehensively.
4. Research how to write high-quality prompts suited to Muse models.
5. Verify Muse Code Headless, CLI, Session Protocol, and SDK.
6. Establish a development workflow led by Codex, with Muse Code responsible for primary implementation.
7. Establish mechanisms for Codex independent verification, error reporting, repair, and retries.
8. Establish Agent Runtime specifications for Muse models within the Reflection Lab product.
9. Actually write research, Prompts, tests, scripts, Skills, and decisions into the Repository.
10. Integrate important changes into the existing LLM Wiki so different Agents can maintain them continuously.

Directly carry out the research, configuration, and technical verification that can be completed; do not merely output a plan.

This phase focuses on **development infrastructure and the AI operating model**. Apart from necessary Technical Spikes and Smoke Tests, do not yet begin implementing formal product features on a large scale.

---

<!-- english-original-anchor --> <a id="1-architecture-decisions--必須先對齊的最新決策"></a>
# 1. Architecture Decisions — Latest Decisions to Align with First

Before starting, read the current:

- AGENTS.md
- LLM Wiki
- Architecture Decision Records
- Research Status
- Roadmap
- Task Backlog
- Existing Code
- Validation Plans
- UI/UX Standards

Do not directly overwrite previously completed work.

Check whether the documents conflict with the following decisions, and use new ADRs to record the parts that need to change.

<!-- english-original-anchor --> <a id="11-reflection-lab-是獨立的新專案"></a>
## 1.1 Reflection Lab Is a Separate New Project

Reflection Lab is a standalone entry developed for the Meta Global AI Developer Hackathon 2026.

There is no intention to directly reuse core code from Echo Canvas or Reflections.

Past research, mathematical theory, public literature, and completed technical investigations may serve as references, but new development produced during the competition must have clear Git and Provenance records.

<!-- english-original-anchor --> <a id="12-acoustic-core-改為-web-native-自行開發"></a>
## 1.2 Acoustic Core Changes to Custom Web-native Development

The current primary technical direction is:

- React / TypeScript
- Three.js / React Three Fiber
- Rapier Physics
- Custom Geometric Acoustic Core
- Web Audio API / AudioWorklet
- Meta Model API
- Muse Code
- Codex
- Git-based LLM Wiki

Prioritize implementing the acoustic core in-house:

- Direct Propagation
- Distance Attenuation
- Occlusion
- First-order Reflection
- Image Source Method
- Path Identity
- Material Acoustic Properties
- Atmospheric Absorption
- Spatial Audio Rendering Parameters

Retain the Steam Audio SDK as:

- A research reference.
- An optional Acoustic Backend.
- Independent Benchmark.
- A future Native Runtime extension option.

Steam Audio should not become a mandatory MVP dependency.

Do not delete existing SDK research and licensing documents in order to remove Steam Audio.

<!-- english-original-anchor --> <a id="13-第一人稱物理沙盒是核心功能"></a>
## 1.3 The First-person Physics Sandbox Is a Core Feature

The following must be retained:

- Scene Editor
- First-Person Simulation
- First-Person Build Mode
- Grab / Drop / Throw / Rotate
- Gravity / No Gravity / Fixed / Kinematic
- Dynamic Audio Sources
- Collision Audio
- Listener Synchronization
- Acoustic Visualization
- Record / Replay
- A/B Experiments

<!-- english-original-anchor --> <a id="14-meta-ai-是作品中的正式功能"></a>
## 1.4 Meta AI Is a Formal Feature of the Entry

Muse Code developing the code does not mean that Meta model integration within the entry has been completed.

Reflection Lab itself should still have a Meta AI Experiment Agent that can actually create scenes, control parameters, run acoustic experiments, read results, and propose improvements.

This is an important competition feature of the product and must not be omitted.

---

<!-- english-original-anchor --> <a id="2-muse-family-research--官方模型研究"></a>
# 2. Muse Family Research — Official Model Research

Read Meta's latest official documentation directly:

https://dev.meta.ai/docs/overview

https://dev.meta.ai/docs/models

https://dev.meta.ai/docs/muse-code

https://dev.meta.ai/docs/muse-code/configuration

https://dev.meta.ai/docs/muse-code/extending

https://dev.meta.ai/docs/muse-code/permissions

https://dev.meta.ai/docs/muse-code/subscriptions

https://dev.meta.ai/docs/agent-frameworks

https://dev.meta.ai/docs/cookbook/tool-function-calling

https://dev.meta.ai/docs/cookbook/structured-output

https://dev.meta.ai/docs/prompt-caching

https://dev.meta.ai/docs/muse-spark-open/prompting

Do not rely solely on search-result summaries. Read the actual API, CLI, and usage examples.

For all information, record:

- Official source.
- Verification date.
- API / CLI Version.
- Supported platforms.
- Specific capabilities.
- Known limitations.
- Actual validation status.

<!-- english-original-anchor --> <a id="21-模型能力比較"></a>
## 2.1 Model Capability Comparison

Research at least:

**Muse Spark**

Evaluate routine coding, short tasks, tool calling, structured outputs, Agent Loops, and latency-sensitive tasks.

**Muse Wonder**

Evaluate complex coding, changes across files, extended reasoning, architecture adjustments, difficult debugging, and Subagent work.

**Muse Spark Open**

Evaluate open weights, deployment requirements, inference costs, and the feasibility of a future self-hosted Runtime.

**Muse Glimmer**

Evaluate whether there are suitable use cases for small, low-latency, and local inference tasks.

**Muse Image / SAM 3.1**

Evaluate whether these could help with future 3D scene generation, material recognition, scene semantic understanding, or visual asset processing.

Do not force every model into the project.

Decide whether a model is needed based on actual workloads.

For each model, compare:

- Model ID
- Context Window
- Tool Calling
- Structured Outputs
- Multimodal Capabilities
- Reasoning Controls
- Latency
- Cost
- Rate Limits
- Model Availability
- Suitable Tasks
- Unsupported Operations

Distinguish Meta Model API, Muse Code CLI, open-weight deployment, and third-party inference platforms.

Parameters and Prompt Templates may differ across environments and must not be mixed.

---

<!-- english-original-anchor --> <a id="3-muse-prompt-engineering-research"></a>
# 3. Muse Prompt Engineering Research

An important objective of this phase is to research:

**How to maintain a high task completion rate, a low error rate, reasonable latency, and controlled costs when Muse family models are used for Reflection Lab coding and product Runtime.**

Divide the research into two scenarios.

<!-- english-original-anchor --> <a id="31-coding-agent-prompting"></a>
## 3.1 Coding Agent Prompting

Research the best prompts for Muse Code in the following tasks:

- New feature implementation.
- Changes across multiple files.
- TypeScript / React.
- Three.js.
- Rapier Physics.
- Web Audio DSP.
- Mathematical algorithms.
- Bug Fix.
- Refactoring.
- Unit / Integration Tests.
- UI Implementation.
- Performance Optimization.

Investigate the effects of different Prompt structures:

- Role / Objective.
- Project Context.
- Exact Scope.
- Architecture Constraints.
- Acceptance Criteria.
- Relevant Files.
- Tool Permissions.
- Definition of Done.
- Negative Constraints.
- Error Recovery.
- Completion Report.

Research when to use:

- A short Task Prompt.
- An explicit Task Specification.
- Few-shot Examples.
- Structured Outputs.
- Reasoning Effort.
- Multi-step Agent Loop.
- Subagents.
- Skills.
- Session Resume.

Do not assume that longer prompts are better.

Evaluate Context Selection, Prompt Length, the number of file references, and model performance under different circumstances.

<!-- english-original-anchor --> <a id="32-muse-prompt-benchmark"></a>
## 3.2 Muse Prompt Benchmark

Establish an actual reproducible foundation for Prompt evaluation.

Choose at least four types of small representative tasks:

A. TypeScript Component Implementation.

B. Physics / Rapier Interaction.

C. Geometry / Acoustic Mathematics.

D. Bug Fix / Regression Test.

If the current project does not yet contain enough code, isolated minimal Fixtures may be used.

Compare at least two Prompt Strategies for each task type:

**Strategy A — Direct Instruction**

Have Muse execute simple, explicit requirements.

**Strategy B — Structured Task Contract**

Provide the complete Scope, Constraints, Acceptance Criteria, and verification commands.

Add the following if actually needed:

**Strategy C — Context-guided Implementation**

Use relevant research, Architecture, existing modules, and Skills to assist implementation.

Record:

- Task Success Rate.
- Test Pass Rate.
- Required Repair Rounds.
- Unexpected File Modifications.
- Hallucinated APIs.
- Latency.
- Tokens / Estimated Cost.
- Tool Calls.
- Human Intervention.
- Final Code Quality.

Use only metrics that can actually be observed.

Do not claim that a Prompt Strategy is generally superior because a single test succeeded.

Organize the evaluation results into an updatable Prompt Engineering Guide, providing recommended Prompt templates for different tasks.

If an API Key, model quota, or execution permission is unavailable, still create offline Fixtures, testing tools, and execution instructions, and mark LIVE EVAL NOT RUN.

---

<!-- english-original-anchor --> <a id="4-muse-code-headless--programmatic-execution"></a>
# 4. Muse Code Headless & Programmatic Execution

Research and actually verify how Muse Code runs in non-interactive mode.

Prioritize researching:

- `muse exec`
- `--prompt-file`
- `--json`
- `--model`
- `--reasoning-effort`
- `--max-model-steps`
- `--workspace`
- `--session-id`
- `muse export`
- `muse serve`
- `muse schema`
- `@muse-code/sdk`

First inspect the actual installed version and `muse --help`, `muse exec --help`.

Do not assume from the documentation alone that every option is available in the current environment.

<!-- english-original-anchor --> <a id="41-最小-headless-proof-of-concept"></a>
## 4.1 Minimal Headless Proof of Concept

First run a low-risk, verifiable task in a separate test directory.

Use a Prompt File to ask Muse to modify or create a test file.

For example, verify the availability of the following command; first confirm its parameters against the installed version's Help:

`muse exec --model muse-spark-1.3 --reasoning-effort medium --contributor-mode off --disable-approval --prompt-file ./tasks/smoke-test.txt --json --max-model-steps 30`

Retain:

- CLI Version.
- Model ID.
- Prompt.
- Workspace.
- Process Exit Code.
- JSONL Events.
- Modified Files.
- Execution Duration.
- Test Results.
- Error / Blocker.

**Muse Exit Code 0 cannot serve as evidence that the code is correct.**

A separate testing process must then inspect the resulting output.

<!-- english-original-anchor --> <a id="42-headless-security"></a>
## 4.2 Headless Security

Do not adopt `--yolo` as the default setting.

Prioritize execution methods that retain the Sandbox, such as a verified `--disable-approval`.

If the Sandbox or necessary permissions prevent a task from running, record the problem and use a least-privilege solution; do not independently disable all protections.

Consider:

- Workspace Trust.
- Filesystem Access.
- Network Permission.
- Dependency Installation.
- Process Timeout.
- Cancellation.
- Child Processes.
- Secrets Protection.
- Sandboxed Execution.

Do not directly execute unknown remote Scripts before formal validation.

<!-- english-original-anchor --> <a id="43-session-management"></a>
## 4.3 Session Management

Research:

- Session Creation.
- Session ID.
- Resume.
- Session Export.
- Failure Recovery.
- Interrupted Runs.
- Cross-workspace Safety.
- Structured Event Parsing.

Every Muse task should have a traceable Run ID.

When the Muse Code CLI event format changes, it must be detectable through an Adapter or Schema Validation rather than silently losing data.

<!-- english-original-anchor --> <a id="44-cli-與-sdk-選型"></a>
## 4.4 CLI and SDK Selection

Compare:

**Option A — CLI Wrapper**

Codex executes work through `muse exec`.

The expected advantages are simple implementation, easy inspection, and standard Process management.

**Option B — Muse Code Session SDK**

Manage Sessions through `muse serve` and the TypeScript SDK.

Evaluate its event reporting, cancellation, Resume, state management, and long-term maintenance cost.

**Option C — Muse Workflows**

If supported by the actual installed version, evaluate whether it is suitable for managing Muse's internal subagents.

Note that Muse's internal Workflow and Codex's overall task orchestration must not form two competing control systems.

**The current default is to implement the CLI Wrapper first.**

If research demonstrates that the SDK is more suitable, explain the reason for switching in an ADR.

---

<!-- english-original-anchor --> <a id="5-codex--muse-code--正式分工"></a>
# 5. Codex × Muse Code — Formal Responsibilities

Establish an explicit Orchestration Contract.

<!-- english-original-anchor --> <a id="51-codex--architect--independent-verifier"></a>
## 5.1 Codex — Architect & Independent Verifier

Codex is responsible for:

- Architecture Decisions.
- Milestone Planning.
- Task Decomposition.
- Prompt Selection.
- Muse Model Routing.
- Task Assignment.
- Acceptance Tests.
- Independent Code Review.
- Performance Validation.
- Regression Tests.
- Defect Classification.
- Retry Decisions.
- Integration Approval.
- Wiki Updates.

Codex may implement the Orchestrator, test infrastructure, verification tools, and necessary technical support.

However, formal product features should preferentially be implemented by Muse Code.

If Muse Code is unavailable, blocked, or seriously unable to complete a task, Codex may take over necessary changes under an explicit Fallback Policy, recording the reason and contribution provenance.

<!-- english-original-anchor --> <a id="52-muse-code--primary-implementation-agent"></a>
## 5.2 Muse Code — Primary Implementation Agent

Muse Code is responsible for:

- Reading relevant code according to the Task Contract.
- Implementing the frontend, Physics, Acoustic Core, and DSP.
- Creating or modifying feature code.
- Implementing local Unit Tests.
- Running permitted self-checks.
- Producing an Implementation Report.
- Fixing defects found by Codex.

Muse should not independently:

- Modify a formal Architecture Decision.
- Relax Acceptance Criteria.
- Delete failing tests.
- Change Benchmark Truth.
- Modify modules outside the Task Scope.
- Claim completion when tests fail.
- Integrate into the main branch without verification.

<!-- english-original-anchor --> <a id="53-meta-ai-runtime--product-agent"></a>
## 5.3 Meta AI Runtime — Product Agent

This is the AI running inside the Reflection Lab product.

Its primary task is to actually operate acoustic experiments.

It must have tool permissions, Prompts, memory, and a Runtime distinct from the Muse Code Coding Agent.

The in-product Agent should not be able to directly modify the Repository, execute arbitrary Shell Commands, or access private local files.

---

<!-- english-original-anchor --> <a id="6-machine-readable-task-contract"></a>
# 6. Machine-readable Task Contract

Establish a task format that Codex and Muse Code can exchange.

Each task must contain at least:

- task_id
- milestone_id
- title
- objective
- scope
- out_of_scope
- relevant_files
- architecture_refs
- skill_refs
- allowed_operations
- forbidden_operations
- model_profile
- reasoning_effort
- expected_deliverables
- acceptance_criteria
- verification_commands
- max_model_steps
- max_repair_rounds
- resource_budget
- task_status

The Task Contract should have a JSON Schema or an equivalent level of Runtime Validation.

Also create:

**ImplementationResult**

Include modified files, execution results, known limitations, test results, and unfinished work.

**VerificationResult**

Include the items independently verified by Codex, actual commands, test output, defects, and verdict.

**RepairTask**

Include reproduction steps, Expected / Actual Behavior, related tests, and the permitted repair scope.

Ensure that every state can be linked to a Task ID, Git Revision, and corresponding Agent Run.

---

<!-- english-original-anchor --> <a id="7-continuous-verification--repair-loop"></a>
# 7. Continuous Verification & Repair Loop

Establish the formal development loop:

1. Codex selects a READY Task.
2. Codex verifies Task Dependencies.
3. Codex creates or confirms the acceptance criteria.
4. Codex generates a Muse Implementation Prompt.
5. Muse Code executes within an isolated scope of work.
6. Collect code changes, the Session Log, and execution results.
7. Codex independently runs tests.
8. Codex performs Code Review and quality analysis.
9. If verification fails, create a RepairTask.
10. Muse Code repairs the problems.
11. Codex verifies again.
12. Update Task Status, Checkpoint, and Wiki only after passing.
13. Proceed to the next ready task.

There must be explicit stop conditions.

By default, a single defect may receive at most three repair rounds.

If the same problem continues to fail, necessary permissions cannot be obtained, test specifications conflict, or the resource budget has been exceeded, stop that task and report the reason.

Do not loop indefinitely.

<!-- english-original-anchor --> <a id="71-git-isolation"></a>
## 7.1 Git Isolation

Prioritize evaluating Git Worktree as the Muse Implementation Workspace.

Principles:

- Codex maintains the primary workspace.
- Muse implements in the designated Worktree.
- Two Agents may not arbitrarily modify the same workspace simultaneously.
- Changes may be accepted only after Codex inspects the Diff.
- Do not automatically Force Push, Reset, or overwrite uncommitted changes.
- Do not assume Muse Code Session Messaging is available on every platform.

Worktree creation, cleanup, and integration must have explicit safety rules.

<!-- english-original-anchor --> <a id="72-independent-verification"></a>
## 7.2 Independent Verification

Codex should perform the following according to task type:

**Frontend**

- Typecheck
- Lint
- Component Tests
- Playwright E2E
- Visual Inspection
- Interaction State Checks

**Physics**

- Deterministic Fixtures
- Gravity Modes
- Grab / Throw
- Collision Events
- CCD / Tunneling Tests
- State Transitions

**Acoustics**

- Analytical Geometry Tests
- Propagation Delay
- First-order Reflection
- Material Energy Constraints
- Path Identity
- Numerical Stability

**Audio**

- OfflineAudioContext
- Impulse Arrival Tests
- Parameter Continuity
- Collision Sound Triggering
- Audio Dropout / Glitch Analysis

**Runtime**

- Build
- Performance
- Regression
- Resource Cleanup
- Failure Recovery

For physics and acoustic verification, prioritize mathematical analytical results or independent reference models.

Do not use the same unverified function to generate both the Expected Value and the Actual Value.

---

<!-- english-original-anchor --> <a id="8-codex-goal-driven-development"></a>
# 8. Codex Goal-driven Development

Research the currently installed Codex version and `/goal` support.

Official reference:

https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex

This project intends to use Codex Goals to manage each Milestone.

However, do not turn the entire Hackathon Roadmap into one enormous Goal without an endpoint.

Define each Goal with:

- One Milestone.
- Measurable Outcomes.
- Verification Surface.
- Allowed Tools.
- Constraints.
- Resource Budget.
- Retry Policy.
- Blocked Stop Condition.

For example:

**Milestone — First-Person Physics**

The Goal's completion criteria require FPS movement, grabbing, dropping, throwing, physics mode switching, and all related tests to pass.

Codex is responsible for assigning Muse Code, verifying the code, creating Repair Tasks, and judging completion.

Muse Code does not need to start another uncontrolled `/goal` at the same time.

<!-- english-original-anchor --> <a id="81-goal-與長期記憶的分工"></a>
## 8.1 Responsibilities of Goals and Long-term Memory

Codex `/goal` manages the current Session's ongoing objective.

The LLM Wiki handles history, progress, decisions, and handoffs across Sessions.

The Task Contract handles the machine-readable current task.

Git handles code and document versions.

The Session Log provides traceability for an individual run.

These systems need to link to one another, but must not replace one another.

---

<!-- english-original-anchor --> <a id="9-muse-prompt-templates"></a>
# 9. Muse Prompt Templates

Create and validate reusable Muse prompt templates in the project.

At minimum, the following are needed:

<!-- english-original-anchor --> <a id="a-feature-implementation-prompt"></a>
## A. Feature Implementation Prompt

Take the Task Contract, relevant files, Architecture Rules, and Acceptance Criteria as inputs.

Ask Muse to complete a specific feature, restrict the modification scope, and return an ImplementationResult.

<!-- english-original-anchor --> <a id="b-bug-fix-prompt"></a>
## B. Bug Fix Prompt

Provide:

- Reproduction Steps
- Failing Test
- Expected Behavior
- Actual Behavior
- Suspected Modules
- Allowed Files

Ask Muse to identify the cause and perform the minimum necessary repair.

<!-- english-original-anchor --> <a id="c-ui-implementation-prompt"></a>
## C. UI Implementation Prompt

Automatically include:

- Design System
- Emil Kowalski Skills
- Workspace UX Spec
- Component Conventions
- Accessibility
- Animation Performance
- Visual Acceptance Criteria

Do not add unnecessary introductory text or components that conflict with the existing visual system.

<!-- english-original-anchor --> <a id="d-acoustic-solver-prompt"></a>
## D. Acoustic Solver Prompt

Include:

- Mathematical Model
- Units
- Assumptions
- Reference Papers
- Numerical Tolerances
- Benchmark Fixtures

Muse must implement according to the specified mathematical contract and must not invent new formulas or physical coefficients.

<!-- english-original-anchor --> <a id="e-physics-interaction-prompt"></a>
## E. Physics Interaction Prompt

Include:

- Rapier API References
- RigidBody States
- Coordinate System
- Physics Step Policy
- Grab / Joint Model
- Collision Event Contract
- Performance Requirements

<!-- english-original-anchor --> <a id="f-repair-prompt"></a>
## F. Repair Prompt

Address only the specific problems in Codex's verification report.

Require preservation of tests and behavior that have already passed.

<!-- english-original-anchor --> <a id="g-completion--handoff-prompt"></a>
## G. Completion / Handoff Prompt

Output the Task ID, modified files, tests executed, unfinished work, and next steps.

All templates need versioning and the task scenarios in which they actually apply.

Do not apply one enormous, identical System Prompt to every job.

---

<!-- english-original-anchor --> <a id="10-model-routing--inference-optimization"></a>
# 10. Model Routing & Inference Optimization

Based on research and actual Evals, establish a Model Routing Policy suited to Reflection Lab.

Initial candidates:

- Muse Spark 1.3: routine coding, short tool loops, and routine in-product Agents.
- Muse Wonder: complex architecture, changes across files, and difficult reasoning.
- Muse Image: use when image generation or editing is actually needed.
- Muse Spark Open / Glimmer: evaluate further when suitable deployment requirements and hardware conditions exist.

Choose the specific model based on official availability, actual model evaluations, and usage costs.

Do not automatically assign all work to a model because it is larger.

<!-- english-original-anchor --> <a id="101-reasoning-effort"></a>
## 10.1 Reasoning Effort

Research the Reasoning Effort officially supported by each model.

Compare the effects of different settings on:

- UI Implementation.
- Math / DSP.
- Multi-file Refactoring.
- Tool Calling.
- Error Recovery.
- Scene Planning.

Reasoning parameters may differ across models.

Do not apply Muse Spark Open inference settings unchanged to Muse Code CLI or hosted Muse Wonder.

<!-- english-original-anchor --> <a id="102-prompt-efficiency"></a>
## 10.2 Prompt Efficiency

Research and adopt:

- Stable Prompt Prefix.
- Minimal Relevant Context.
- Reusable Task Templates.
- Prompt Caching.
- Selective Wiki Retrieval.
- Appropriate Reasoning Effort.
- Tool Call Budget.
- Bounded Retry.
- Structured Output.

For APIs that support them, record Cached Tokens, Input / Output Tokens, Latency, Errors, and Estimated Cost.

Do not put the entire Wiki into every request merely to use the full Context Window.

<!-- english-original-anchor --> <a id="103-security--billing"></a>
## 10.3 Security & Billing

Distinguish Muse Code subscriptions, pay-as-you-go Meta Model API usage, and API Credits provided by the hackathon.

Do not assume these allowances can offset one another.

For Headless Muse Code, default to Standard / Contributor Off unless the user explicitly chooses another data usage mode.

Confirm whether the Muse Code CLI settings and the model selected in the API actually correspond to the intended data usage mode.

Do not write API Keys, private files, or sensitive data into Prompt Logs, the Repository, or test output.

Establish:

- Token / Cost Budget.
- Timeout.
- Model Step Budget.
- Retry Limit.
- Rate-limit Handling.
- Backoff Policy.
- Secret Redaction.
- Audit Logging.

---

<!-- english-original-anchor --> <a id="11-reflection-lab-runtime--ai-experiment-agent"></a>
# 11. Reflection Lab Runtime — AI Experiment Agent

In addition to the Coding Harness, research the in-product Muse Runtime Prompt.

Core objective:

**Enable Meta AI to operate experiments safely and effectively within a reproducible 3D acoustic experiment environment.**

Establish this workflow:

`Understand → Plan → Validate → Preview → Execute → Observe → Evaluate → Report`

<!-- english-original-anchor --> <a id="111-scene-planning"></a>
## 11.1 Scene Planning

The user enters natural language, and Muse generates a scene modification plan that conforms to the Schema.

For example:

"Create a room with a wooden floor and concrete walls, place a metal sphere with no gravity inside it, and have it continuously emit a 1 kHz test tone."

The AI should generate structured Scene Operations.

Do not directly modify unverified Scene State.

<!-- english-original-anchor --> <a id="112-tool-calling"></a>
## 11.2 Tool Calling

Research and design:

- CreateObject
- SetTransform
- SetMaterial
- ConfigureRigidBody
- ConfigureAudioSource
- MoveListener
- SetTrajectory
- RunSimulation
- CaptureExperiment
- GetAcousticMetrics
- CompareExperiments
- GenerateExperimentReport

Each tool requires:

- JSON Schema.
- Argument Validation.
- Error Result.
- Domain Constraints.
- Resource Limits.
- Audit Trail.

Structured Outputs or Tool Calling may be used, but choose according to the actual purpose.

Structured Output is suitable for generating explicit data objects.

Tool Calling is suitable for performing operations that require calling code.

Do not treat a result as structurally validated merely because Prompt text requests JSON output.

<!-- english-original-anchor --> <a id="113-deterministic-solver-boundary"></a>
## 11.3 Deterministic Solver Boundary

Muse must not generate RT60, Reflection Delay, Sound Pressure, or other experimental data on its own and then treat them as real solver results.

All numerical values are supplied by the Acoustic Core, Physics Runtime, or Measurement Pipeline.

Muse may:

- Propose hypotheses.
- Design tests.
- Modify parameters.
- Run tools.
- Compare experiments.
- Explain results.

However, AI inference must be separated from deterministic computation.

<!-- english-original-anchor --> <a id="114-runtime-agent-safety"></a>
## 11.4 Runtime Agent Safety

The following need limits:

- Maximum Tool Calls.
- Maximum Simulation Runs.
- Maximum Objects.
- Scene Dimensions.
- Valid Material IDs.
- Computational Budget.
- Scene Revision.
- Cancellation.
- Undo / Rollback.

For operations that change an existing scene or consume substantial computing resources, establish previews and appropriate user confirmation flows.

The in-product Agent must not execute arbitrary operating system commands.

<!-- english-original-anchor --> <a id="115-runtime-prompt-evaluation"></a>
## 11.5 Runtime Prompt Evaluation

Create test scenarios:

1. Create a normal acoustic scene.
2. Correctly specify objects' physical states.
3. Modify wall sound-absorption materials.
4. Compare two Experiments.
5. Correctly report unknown materials.
6. Handle requests exceeding scene limits.
7. The solver returns an error.
8. The user cancels midway.
9. The model returns invalid parameters.
10. Propose optimization plans based on existing results.

Verify Tool Call correctness, completion rate, latency, error handling, and reproducibility.

---

<!-- english-original-anchor --> <a id="12-llm-wiki--agentsmd-integration"></a>
# 12. LLM Wiki & AGENTS.md Integration

Integrate the new Multi-Agent development model into the existing long-term Wiki.

Do not create a second Wiki.

At least update or add the following knowledge:

- Muse Model Capabilities.
- Prompt Engineering Research.
- Model Routing Decisions.
- Coding Agent Responsibilities.
- Headless Integration.
- Task Contracts.
- Development Verification.
- Agent Failure Recovery.
- Prompt Evaluation Results.
- Model Cost / Latency Benchmarks.
- AI Experiment Agent Architecture.
- Agent Run History.

All important conclusions need corresponding sources, versions, and test evidence.

<!-- english-original-anchor --> <a id="121-agentsmd"></a>
## 12.1 AGENTS.md

Add concise development responsibility rules to the existing AGENTS.md:

**Codex is the Engineering Orchestrator and Independent Verifier.**

**Muse Code is the Preferred Implementation Agent.**

**Meta Model API powers the product's AI Experiment Agent.**

Also link to the formal:

- Task Contract.
- Orchestration Workflow.
- Prompt Templates.
- Validation Commands.
- Wiki Startup / Handoff Protocol.
- Model Routing Guide.

Do not paste the entire development operations manual into AGENTS.md.

<!-- english-original-anchor --> <a id="122-skills"></a>
## 12.2 Skills

Evaluate creating:

- `muse-implementation`
- `codex-verification`
- `muse-prompt-optimization`
- `agent-orchestration`
- `meta-experiment-agent`

Skills need clear triggers, inputs, operating steps, completion criteria, and failure handling.

Check whether Muse Code can load Skills from the Repository's `.agents/skills/`, and actually run feasible Skill Validation.

Retain the existing Acoustic Research, Physics Interaction, UI/UX, and Emil Kowalski Design Skills.

Avoid duplicating existing capabilities.

---

<!-- english-original-anchor --> <a id="13-repository-deliverables"></a>
# 13. Repository Deliverables

Adapt to the current project structure; do not forcibly recreate or move existing directories.

Suggested additions or updates:

`docs/09-agents/`

- `MULTI_AGENT_ARCHITECTURE.md`
- `CODEX_MUSE_ORCHESTRATION.md`
- `MUSE_MODEL_RESEARCH.md`
- `MUSE_PROMPT_ENGINEERING.md`
- `MODEL_ROUTING.md`
- `HEADLESS_EXECUTION.md`
- `VALIDATION_POLICY.md`
- `AGENT_SECURITY.md`
- `FAILURE_RECOVERY.md`

`prompts/muse/`

- `implementation.md`
- `bugfix.md`
- `ui-implementation.md`
- `acoustic-solver.md`
- `physics-interaction.md`
- `repair.md`
- `handoff.md`

`prompts/runtime/`

- `scene-planner.md`
- `experiment-agent.md`
- `acoustic-analysis.md`

`schemas/agents/`

- `task.schema.json`
- `implementation-result.schema.json`
- `verification-result.schema.json`
- `repair-task.schema.json`

`scripts/agents/`

- `run-muse`
- `verify-task`
- `run-milestone`
- `agent-status`

The Script names above are conceptual functional requirements; choose the actual extensions, language, and commands according to the existing technical environment.

`tests/agents/`

- Headless Smoke Test.
- Task Contract Validation.
- JSONL Event Parsing.
- Timeout / Cancellation.
- Verification Gate.
- Retry Limit.
- Workspace Isolation.
- Handoff Recovery.

`benchmarks/muse/`

- Prompt Fixtures.
- Evaluation Configuration.
- Model Comparison.
- Results.

All execution commands must be documented in the README or corresponding documents.

If the user has not installed Muse Code or lacks authentication, still complete the architecture, Mock Runner, and tests that can be verified offline, and accurately record unfinished Live Validation.

---

<!-- english-original-anchor --> <a id="14-engineering-acceptance-gates"></a>
# 14. Engineering Acceptance Gates

Before declaring this phase complete, check:

<!-- english-original-anchor --> <a id="gate-a--research"></a>
## Gate A — Research

Muse models, CLI, Prompts, API, data usage, and pricing restrictions have been checked.

Important conclusions have official sources.

<!-- english-original-anchor --> <a id="gate-b--headless"></a>
## Gate B — Headless

A Muse Headless Task can be started.

Execution records can be obtained and success, failure, and cancellation can be identified.

<!-- english-original-anchor --> <a id="gate-c--task-contract"></a>
## Gate C — Task Contract

Codex can generate valid tasks.

Muse can read tasks and produce implementation results.

<!-- english-original-anchor --> <a id="gate-d--independent-verification"></a>
## Gate D — Independent Verification

Codex can independently run tests.

Even if Muse reports success, a task must not be marked DONE while verification has not passed.

<!-- english-original-anchor --> <a id="gate-e--repair-loop"></a>
## Gate E — Repair Loop

Failures can be converted into specific RepairTasks.

Retries are bounded and do not loop indefinitely.

<!-- english-original-anchor --> <a id="gate-f--repository-safety"></a>
## Gate F — Repository Safety

Workspace isolation, Git Diff, Secret Protection, and Sandbox Policy work correctly.

<!-- english-original-anchor --> <a id="gate-g--runtime-ai"></a>
## Gate G — Runtime AI

The tool contracts, Prompts, and test scenarios for the in-product Meta AI Agent have been established.

<!-- english-original-anchor --> <a id="gate-h--long-term-memory"></a>
## Gate H — Long-term Memory

The LLM Wiki records model research, architecture decisions, completed work, and tasks for the next phase.

<!-- english-original-anchor --> <a id="gate-i--cross-agent-handoff"></a>
## Gate I — Cross-Agent Handoff

A new Codex Session can read the Wiki, run the Runner, assign Muse Code, and continue unfinished work.

Mark each Gate:

`PASS / PARTIAL / FAIL / BLOCKED / NOT RUN`

Include the actual test commands and results.

Do not mark an unexecuted Live Test as PASS.

---

<!-- english-original-anchor --> <a id="15-implementation-order"></a>
# 15. Implementation Order

Execute this task in the following order.

**Stage 1 — Audit**

Audit the Repository, existing Agent Harness, Wiki, Muse CLI, Codex, and formal specifications.

**Stage 2 — Research**

Complete research on Muse Models, Prompt Engineering, Headless, SDK, and security.

**Stage 3 — Architecture Revision**

Update ADRs, model selection, and the Codex/Muse responsibilities.

**Stage 4 — Orchestration Foundation**

Establish Task Contracts, Prompt Templates, a Headless Runner, and basic verification mechanisms.

**Stage 5 — Smoke Tests**

Run isolated Muse Headless tasks to verify JSONL, code changes, and independent tests.

**Stage 6 — Integration**

Integrate the Wiki, Skills, AGENTS.md, Task Status, and Handoff.

**Stage 7 — Product Agent Design**

Complete Runtime Contracts, Prompts, model strategies, and the testing foundation for the Reflection Lab Meta AI Experiment Agent.

**Stage 8 — Validation**

Check all Quality Gates for this phase in full.

If a stage encounters a blocker that cannot be resolved, record the reason and continue other independent tasks.

---

<!-- english-original-anchor --> <a id="16-final-deliverables--completion"></a>
# 16. Final Deliverables & Completion

On completion, provide:

1. The Codex × Muse Code development architecture actually adopted.
2. Muse family model research and classification of suitable work.
3. Muse Prompt Engineering Guide.
4. The actual feasibility of the Headless CLI / SDK.
5. The established Task Contracts and Orchestrator.
6. Validated Prompt Templates.
7. Codex independent verification and Repair Loop.
8. Model Routing、Cost、Security Policy.
9. The Reflection Lab Runtime Meta Agent specification.
10. The updated AGENTS.md, Skills, and LLM Wiki.
11. The list of files actually created or modified.
12. Tests actually executed, their results, and unfinished limitations.
13. An executable Task Contract for the next formal development Milestone.

Finally, provide two actual usage examples:

**Example A — Codex Goal**

How Codex starts a Milestone with ongoing verification and primarily delegates execution to Muse Code.

**Example B — Direct Headless Muse Task**

How to use the established Script and Task Contract to have Muse Code directly implement a specified feature in an isolated workspace, followed by Codex verification.

These two examples must use commands that have actually been created and are available in the current environment; do not merely use imagined CLI syntax.

---

<!-- english-original-anchor --> <a id="最終執行要求"></a>
## Final Execution Requirements

Start with the Repository Audit immediately.

Autonomously complete all research, document adjustments, Runners, Prompt Templates, Skills, Schemas, and verification foundations within the existing architecture and safety constraints.

Do not start full development of the entire Reflection Lab product in this phase.

Actual product Milestones should be assigned to Muse Code for implementation one by one after this Harness passes basic verification.

All important decisions and execution results must also be written to the LLM Wiki.

**Final objective: Give Reflection Lab a sustainable AI Development System in which Codex manages goals and quality, Muse Code leads code implementation, Meta AI runs in-product acoustic experiments, and the long-term Wiki preserves complete knowledge and development history.**

Start work directly now; do not stop at a research proposal.