<!-- english-source: {"path":"docs/00-project/PHASE2_REQUEST.md","sha256":"f011353125ab3b2d22c5e19f0e3fa3783b0a110ebca6840905ec4a1950da9160","translated_at":"2026-10-27T03:37:55.6385493Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/PHASE2_REQUEST.md`](../../00-project/PHASE2_REQUEST.md). Source SHA-256: `f011353125ab3b2d22c5e19f0e3fa3783b0a110ebca6840905ec4a1950da9160`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab--persistent-llm-wiki--uiux-design-standards"></a>
# Reflection Lab — Persistent LLM Wiki & UI/UX Design Standards

<!-- english-original-anchor --> <a id="phase-2跨-agent-長期記憶專案知識庫與設計工程規範"></a>
## Phase 2: Cross-Agent Long-Term Memory, Project Knowledge Base, and Design Engineering Standards

This is a supplementary task to the preceding Reflection Lab Research & Project Bootstrap Master Prompt.

Preserve the research findings, documentation, code, Skills, AGENTS.md, and technical decisions completed in the previous phase.

This task requires building a long-term project knowledge and memory management system directly in the current Repository, for continuous use across AI Agents, Sessions, and development phases, while also introducing complete UI/UX Design Engineering Standards.

Actually create the necessary files, tools, Skills, workflows, and tests. Do not only write a conceptual architecture proposal.

---

<!-- english-original-anchor --> <a id="1-persistent-llm-wiki--核心理念"></a>
# 1. Persistent LLM Wiki — Core Concept

Read Andrej Karpathy's LLM Wiki Pattern in full:

https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

Do not implement it solely from other people's summaries. Obtain and read the original Gist first, then design a concrete system based on Reflection Lab's actual needs.

I want to develop the LLM Wiki into this project's **Persistent Project Intelligence Layer**.

It should continuously record, understand, and manage:

- The project's long-term goals and product vision.
- Current development direction and milestones.
- All completed, ongoing, and pending tasks.
- Feature development status and actual implementation results.
- Historical decisions, their rationale, and superseded approaches.
- Acoustics and physics research findings.
- SDK, framework, API, and third-party dependency information.
- The current architecture, important modules, and data flows.
- Experiment results, Benchmarks, and failure cases.
- UI/UX design standards and their revision history.
- Technical limitations, known Bugs, risks, and blockers.
- Agent work history, handoff information, and unfinished work.
- Overall project state at different points in time.

The core goal is:

**Any newly joining Agent, even with no conversational context from the preceding Session, should be able to quickly understand the project, recover its working state, and continue development through the Wiki.**

Build this system with versionable, open formats accessible directly through files.

Prefer Git + Markdown + structured Metadata.

Do not make long-term memory depend on a model's conversation history, a single Agent's private memory feature, a proprietary cloud database, or a specific IDE.

---

<!-- english-original-anchor --> <a id="2-wiki-architecture--三層架構"></a>
# 2. Wiki Architecture — Three Layers

Following Karpathy's design, establish three logical layers.

<!-- english-original-anchor --> <a id="layer-a--immutable-sources"></a>
## Layer A — Immutable Sources

Preserve or index the original evidence for project knowledge.

This includes:

- Original papers and research sources.
- Official SDK documentation.
- Completed experiment results.
- Benchmark Reports.
- Git Commits.
- Confirmed user requirements.
- Architecture Decision Records.
- Verified code and test results.
- Original Agent work records.
- Confirmed competition rules.

Original materials are evidence; Wiki summaries must not overwrite them.

Create a Source Manifest recording source locations, retrieval dates, versions, Hashes, licenses, confidence, and related Wiki pages.

For materials that cannot appropriately be copied for legal or licensing reasons, retain only Metadata and original links.

If a source already lives in `research/`, `docs/`, or Git History, prefer indexing it rather than creating duplicate documents.

<!-- english-original-anchor --> <a id="layer-b--llm-maintained-wiki"></a>
## Layer B — LLM-maintained Wiki

This is the knowledge layer that Agents can maintain continuously.

The Wiki is not a simple collection of original-document summaries; it is organized, cross-linked, and continuously revised project knowledge.

Whenever research, development, or experiments make significant progress, the Agent should update the relevant Wiki pages.

For example:

After completing a Steam Audio Smoke Test, update SDK status, technical feasibility, architecture decisions, related tasks, risks, and history.

Do not only add an isolated experiment report.

<!-- english-original-anchor --> <a id="layer-c--wiki-schema--agent-operating-rules"></a>
## Layer C — Wiki Schema & Agent Operating Rules

Create an explicit Schema defining:

- Wiki page categories.
- Metadata format.
- File naming conventions.
- Source citation methods.
- Knowledge update and invalidation methods.
- Task statuses and completion criteria.
- Read/write protocols between Agents.
- Conflict handling.
- Work handoffs.
- Search, Ingest, Lint, and maintenance procedures.

This Schema is the Wiki's core configuration.

Put the most basic entry rules in the root `AGENTS.md`, but keep the full standards in a separate Wiki Schema and Skills to avoid loading large amounts of unrelated content in every Session.

---

<!-- english-original-anchor --> <a id="3-wiki-directory-structure"></a>
# 3. Wiki Directory Structure

Prefer reusing the existing project structure.

If a Wiki has not yet been established, use the following as a reference:

```text
knowledge/
├── README.md
├── schema.md
├── sources/
│   └── manifest.yaml
├── inbox/
├── events/
└── wiki/
    ├── index.md
    ├── log.md
    ├── now.md
    ├── goals.md
    ├── roadmap.md
    ├── tasks.md
    ├── architecture/
    ├── decisions/
    ├── features/
    ├── research/
    ├── ui-ux/
    ├── experiments/
    ├── history/
    ├── blockers/
    ├── concepts/
    └── handoffs/
```

This is only a reference; do not forcibly move existing materials.

The directories have the following responsibilities.

<!-- english-original-anchor --> <a id="indexmd--knowledge-directory"></a>
### index.md — Knowledge Directory

The Wiki's main entry point.

Record links to main pages, brief descriptions, categories, importance, and last-updated times.

New Agents should find relevant knowledge through this index without having to search the entire Repository.

<!-- english-original-anchor --> <a id="nowmd--current-project-state"></a>
### now.md — Current Project State

This is the most important entry point for short-term working memory.

Keep it concise and record:

- The current project phase.
- Major work recently completed.
- Features currently in development.
- Highest-priority tasks.
- Unresolved Blockers.
- Recent important decisions.
- The next directly executable action.
- The most recent validation results.
- Links to relevant detailed documentation.

Make this document quick to read within a reasonable Context Budget.

Avoid turning it into a continuously appended full history log.

<!-- english-original-anchor --> <a id="goalsmd--project-objectives"></a>
### goals.md — Project Objectives

Manage long-term and short-term goals:

- Product Vision
- Hackathon Objectives
- MVP Scope
- Milestones
- Success Criteria
- Out of Scope
- Long-term Research Goals

Distinguish goals formally accepted by the user, Agent proposals, and superseded goals.

<!-- english-original-anchor --> <a id="roadmapmd--development-roadmap"></a>
### roadmap.md — Development Roadmap

Record development phases, priorities, prerequisite dependencies, delivery criteria, and planned work.

Do not create two contradictory authoritative versions alongside the existing `docs/ROADMAP.md`.

Explicitly designate a single official source; the other document may only index it or provide a derived summary.

<!-- english-original-anchor --> <a id="tasksmd--task-management"></a>
### tasks.md — Task Management

Maintain a work list that multiple Agents can understand and update.

Each task must have at least:

- Stable Task ID
- Title
- Description
- Status
- Priority
- Owner / Claim
- Dependencies
- Acceptance Criteria
- Relevant Files
- Evidence / Validation
- Created / Updated Timestamp

Suggested statuses:

`BACKLOG / READY / IN_PROGRESS / BLOCKED / DONE / CANCELLED`

Research tasks and engineering tasks should each use appropriate completion evidence.

Do not mark a task DONE merely because an Agent claims it is complete.

<!-- english-original-anchor --> <a id="decisions--architecture--product-decisions"></a>
### decisions/ — Architecture & Product Decisions

Record important decisions and their context.

Each decision should include:

- Decision ID
- Context
- Alternatives
- Decision
- Rationale
- Evidence
- Trade-offs
- Status
- Superseded By
- Related Tasks / Commits

Do not directly delete old decisions.

When a new approach supersedes a decision, preserve the history and link the relationship.

<!-- english-original-anchor --> <a id="history--project-history"></a>
### history/ — Project History

Preserve important milestones and the evolution of development.

It should answer:

- Why did the project initially choose a particular architecture?
- When did development of a feature begin?
- Which version first passed validation?
- Why was a technology abandoned?
- Which change introduced a new limitation?

<!-- english-original-anchor --> <a id="handoffs--agent-handoffs"></a>
### handoffs/ — Agent Handoffs

Record work handoffs across Sessions.

Include at least:

- Agent / Session ID
- Task ID
- Work objectives
- Completed work
- Modified files
- Commands executed
- Test results
- Unfinished work
- Blockers
- Next recommended action
- Git Commit / Branch / Worktree

A Handoff must be sufficient for another Agent to take over without relying on the original Session.

---

<!-- english-original-anchor --> <a id="4-wiki-metadata--provenance"></a>
# 4. Wiki Metadata & Provenance

Define a unified Markdown Frontmatter Schema.

Support at least:

```yaml
---
id: RLAB-KB-0001
title: Example Knowledge Page
type: concept
status: verified
created_at: 2026-10-26T00:00:00+08:00
updated_at: 2026-10-26T00:00:00+08:00
sources: []
related_tasks: []
related_decisions: []
supersedes: []
tags: []
---
```

The above is a format example, not an actual creation date or verified status.

All important knowledge must distinguish:

- VERIFIED: Supported by direct evidence.
- ACCEPTED: A formally adopted project decision.
- PROPOSED: An approach not yet approved.
- EXPERIMENTAL: Under validation.
- UNVERIFIED: Insufficient evidence.
- DEPRECATED: Outdated or superseded.

Distinguish "a feature is planned," "the code is implemented," "tests have passed," and "the acoustic model has been physically validated."

These four things must not be conflated.

Define Source of Truth priorities by information type.

For example:

- Actual code behavior: Source code and reproducible tests.
- Research data: Original papers and measurement data.
- Product requirements: The latest confirmed user requirements.
- Formal technical decisions: Accepted ADRs.
- Work status: Task Records supported by files and tests.
- Knowledge organization: The Wiki's latest valid synthesis pages.

The Wiki should not overwrite authoritative sources in other domains.

---

<!-- english-original-anchor --> <a id="5-wiki-operations"></a>
# 5. Wiki Operations

Establish the following six operational workflows.

<!-- english-original-anchor --> <a id="a-ingest"></a>
## A. Ingest

When an Agent discovers a new paper, research document, architecture decision, or experiment result:

1. Confirm the source and license.
2. Record it in the Source Manifest.
3. Check whether the same version has already been Ingested.
4. Extract important information and verifiable claims.
5. Update existing Wiki pages.
6. Create new pages when necessary.
7. Update cross-links and the index.
8. Record the change log.
9. Run Wiki Lint.

Repeatedly Ingesting the same source must not keep generating duplicate pages.

<!-- english-original-anchor --> <a id="b-query"></a>
## B. Query

When an Agent needs project information:

1. Read `index.md` first.
2. Search relevant Wiki pages.
3. Read only content relevant to the task.
4. Trace back to original materials when necessary.
5. Provide conclusions with sources.
6. Update the Wiki for new findings with long-term value.

Use Progressive Disclosure.

Do not load the entire Wiki into the Context Window at every startup.

<!-- english-original-anchor --> <a id="c-lint"></a>
## C. Lint

Regularly check for:

- Invalid links.
- Orphan pages.
- Duplicate knowledge.
- Contradictory claims.
- Superseded decisions.
- Outdated dependency versions.
- Incomplete citations.
- Data without evidence.
- Task statuses inconsistent with Git / Tests.
- Completed tasks without validation information.
- Blockers that have not been updated for a long time.
- Work that is complete but has not been closed.

Issues that can safely be fixed automatically may be handled automatically.

Do not guess which side of an important factual conflict is correct; record it and flag it for revalidation.

<!-- english-original-anchor --> <a id="d-checkpoint"></a>
## D. Checkpoint

Save the current project state when important work is completed.

A Checkpoint should record:

- Task ID
- Agent / Session
- Git Revision
- Scope of modifications
- Completed work
- Validation evidence
- Remaining risks
- Next steps

There is no need to create a Checkpoint after every tool call.

Recommended occasions include completion of important tasks, changes to key decisions, passing tests, and work handoffs.

<!-- english-original-anchor --> <a id="e-handoff"></a>
## E. Handoff

When an Agent is preparing to end a Session or transfer a task:

1. Update task status.
2. Update relevant Wiki pages.
3. Record actual tests and unfinished work.
4. Create a Handoff.
5. Update `now.md`.
6. Confirm that no modifications have been left in an unclear state.

If tools support reliable Session Hooks, investigate automation.

If they do not, create explicit manual commands or a Skill; do not claim automatic memory functionality exists.

<!-- english-original-anchor --> <a id="f-reconcile"></a>
## F. Reconcile

When different Agents modify the same knowledge:

- Track changes with Git and explicit modification provenance.
- Prioritize preserving original evidence.
- Compare sources and times rather than directly adopting the last writer's version.
- Do not silently overwrite each other's research or decisions.
- Create a Conflict Record when a conflict is found.
- Flag authority conflicts that cannot be resolved automatically as pending.

---

<!-- english-original-anchor --> <a id="6-multi-agent-shared-memory-protocol"></a>
# 6. Multi-Agent Shared Memory Protocol

This system must support at least:

- OpenAI Codex
- Claude Code
- Pi Agent
- Other future Coding Agents able to read and write project files

Do not restrict it to a format exclusive to one Agent Framework.

<!-- english-original-anchor --> <a id="61-agent-startup-protocol"></a>
## 6.1 Agent Startup Protocol

When a new Agent Session starts, it should perform these steps in order:

1. Read the root `AGENTS.md`.
2. Read the Wiki Schema and `index.md`.
3. Read `now.md`.
4. Check the current task and relevant Dependencies.
5. Read the latest Handoff.
6. Retrieve pages relevant to the current task.
7. Verify important information against Git and actual file state.

Do not unconditionally load all historical records or all research documents.

<!-- english-original-anchor --> <a id="62-task-claiming"></a>
## 6.2 Task Claiming

When multiple Agents work simultaneously, prevent duplicate claims on the same task.

Investigate Task Claims, Owners, Heartbeats, Leases, Git Worktrees, or other coordination methods suitable for a local project.

If a reliable cross-Process Lock cannot be provided, use conservative division-of-work rules and avoid false exclusivity claims.

<!-- english-original-anchor --> <a id="63-concurrent-writes"></a>
## 6.3 Concurrent Writes

Multiple Agents may update `now.md`, `tasks.md`, or `log.md` simultaneously.

Design a safe write process, such as:

- A single Writer or explicit file ownership.
- Atomic file updates.
- Optimistic Concurrency.
- Git-based Conflict Detection.
- Per-session Event Files.
- A Chronological Log generated from events.

`log.md` must preserve the full historical meaning.

If Event Files are used to solve concurrency issues, `log.md` may serve as a rebuildable chronological index, but the original events must not be lost.

<!-- english-original-anchor --> <a id="64-cross-agent-compatibility"></a>
## 6.4 Cross-Agent Compatibility

Check what Codex, Claude Code, and Pi Agent actually support for:

- Project Instructions
- Skills
- Session Hooks
- Tool Invocation
- Workspace Layout
- Subagents
- Handoff Mechanisms

Create the thinnest compatibility entry point in each tool.

If `CLAUDE.md` is required, make it point to shared standards rather than copying the entire AGENTS.md.

The same applies to Pi Agent.

All Agents should ultimately read the same Wiki Schema and knowledge sources.

An Agent's private settings should not become the sole location where knowledge is preserved.

<!-- english-original-anchor --> <a id="65-git-sync"></a>
## 6.5 Git Sync

The Wiki should synchronize through Git across different machines and Agent work environments.

Handle:

- Branch / Worktree.
- Merge Conflicts.
- Commit Provenance.
- Sensitive Information.
- Large File Management.
- Generated Index Files.

Do not push a Private Repository, change Remote permissions, or publish research materials on your own initiative.

---

<!-- english-original-anchor --> <a id="7-durable-project-memory-rules"></a>
# 7. Durable Project Memory Rules

Put the following rules in AGENTS.md or a dedicated Wiki Skill.

**After completing important work, Agents must update long-term knowledge accordingly.**

Events requiring Wiki updates include:

- Completion of a new feature.
- Significant feature changes.
- New formal requirements.
- Architecture Decisions.
- Replacement of an SDK or major dependency.
- New research conclusions.
- Important experiment results.
- A Benchmark passing or failing.
- Discovery of an important Bug.
- A task becoming blocked or unblocked.
- Major UI/UX design decisions.
- Preparing to hand work to another Agent.

However, the following are prohibited:

- Rewriting the entire Wiki after every small change.
- Copying all conversations verbatim into the Wiki.
- Unconditionally preserving transient intermediate reasoning.
- Saving model guesses as formal decisions.
- Automatically marking unverified content VERIFIED.
- Storing private credentials, Tokens, or API Keys in the Wiki.
- Creating multiple contradictory versions between the Wiki and formal program specifications.

Long-term memory should prioritize information quality over text volume.

---

<!-- english-original-anchor --> <a id="8-wiki-tooling--automation"></a>
# 8. Wiki Tooling & Automation

Create concise, testable Wiki management tools.

Provide at least these functions or equivalent CLI commands:

```text
wiki ingest <source>
wiki query <question>
wiki lint
wiki checkpoint
wiki handoff
wiki status
```

Actual CLI names may be adjusted to the project's existing toolchain.

Prefer Python, Node.js, or existing tools for a lightweight management workflow.

Support:

- Idempotent Ingest.
- Metadata Validation.
- Link Validation.
- Duplicate Detection.
- Source Traceability.
- Task State Checks.
- Chronological Events.
- JSON / Markdown Output.
- Dry Run.

Investigate qmd, mentioned by Karpathy:

https://github.com/tobi/qmd

Determine whether it is suitable as the local Wiki Search Engine.

If the initial file count is small, prefer a Markdown Index, full-text search, and file links.

There is no need to deploy a Vector Database, Embedding Pipeline, or separate search service at the outset.

Add BM25, Hybrid Search, or MCP later if the scale grows.

<!-- english-original-anchor --> <a id="81-wiki-validation-tests"></a>
## 8.1 Wiki Validation Tests

Actually create tests covering at least:

1. After a new document is Ingested, the Index and relevant pages update correctly.
2. Repeated Ingest does not create duplicate pages.
3. When a new decision supersedes an old one, history is preserved.
4. Task status can be traced to validation evidence.
5. A new Agent can resume work from a Handoff.
6. Lint detects invalid links.
7. Contradictory knowledge is not silently merged.
8. Concurrent updates by multiple Agents do not silently lose content.
9. Repeated execution of the main Wiki tools does not corrupt data.
10. Manual workflows can still maintain the system when automatic Hooks are absent.

Create concrete test files, Fixtures, and execution commands.

---

<!-- english-original-anchor --> <a id="9-uiux-design-engineering-standards"></a>
# 9. UI/UX Design Engineering Standards

The second task is to establish lasting UI/UX design and code quality standards for Reflection Lab.

Research the following in full:

https://github.com/emilkowalski/skills

This is the primary Design Engineering reference.

Read the official README, license, and the Skills actually needed, rather than merely citing the Repository name.

<!-- english-original-anchor --> <a id="91-skills-selection--installation"></a>
## 9.1 Skills Selection & Installation

Prioritize evaluating:

- `emil-design-eng`
- `animate`
- `review-animations`
- `improve-animations`
- `animation-performance`
- `pick-ui-library`
- `prototype`
- `break-ui`

Choose the Skills needed based on the project's technology and development needs.

The official installation method is:

```bash
npx skills@latest add emilkowalski/skills
```

Before running it, check the source, installation tool, actual installation behavior, and version.

If automatic installation is used, preserve reproducible version information; a formal project should avoid an uncontrolled dependency on `latest`.

Confirm that the installation location works for Codex, and assess whether other Agents can share the same Skills.

If a third-party Skill needs to be kept in the Repository, retain its license and source record.

Do not create duplicate documents identical to the original Skills.

Project-specific design standards may additionally be provided as:

`reflection-lab-design-system`

or an equivalent Project Skill.

---

<!-- english-original-anchor --> <a id="10-reflection-lab-uiux-standards"></a>
# 10. Reflection Lab UI/UX Standards

Integrate Emil Kowalski's design engineering principles with the Reflection Lab UI/UX Research completed in the preceding phase.

Produce standards that can be checked in practice.

<!-- english-original-anchor --> <a id="101-visual-design"></a>
## 10.1 Visual Design

Suggested style:

- Modern Professional Tool
- Dark UI, while avoiding pure black.
- Clear and consistent information hierarchy.
- Information density appropriate for professional tools.
- 4px Spacing System.
- Consistent Radius, Typography, Border, and Shadow.
- Low-distraction Accent Colors.
- Highly readable numbers and engineering parameters.
- Appropriate monospaced fonts for precise data.

Define Design Tokens:

- Color
- Typography
- Spacing
- Radius
- Border
- Elevation
- Motion
- Z-index
- Interactive States

Acoustic data visualization should use consistent color and line-style semantics.

For example, Direct, Reflected, Blocked, and Selected Path states need to be clear and distinguishable.

Do not convey information through color alone.

<!-- english-original-anchor --> <a id="102-motion--micro-interactions"></a>
## 10.2 Motion & Micro-interactions

Refer to Emil Kowalski's Animation Decision Framework.

Before designing each animation, answer:

- Does this component really need animation?
- What information should the animation convey?
- Will it appear frequently?
- Which animation properties have the lowest cost?
- Does it support interruption and repeated input?
- Does it affect readability or interaction latency?
- Does it support Reduced Motion?

For frequent interactions, such as keyboard shortcuts, object dragging, or an AI Command Palette, prioritize immediate feedback.

Do not force every interface transition to be animated for the sake of showcasing effects.

Prefer properties suitable for compositor handling, such as `transform` and `opacity`.

Avoid unnecessary Layout Thrashing, excessive Blur, global `transition: all`, or large numbers of React Re-renders every frame.

Clearly separate 3D physics animation, UI micro-interactions, and the acoustic time reference.

<!-- english-original-anchor --> <a id="103-interaction-design"></a>
## 10.3 Interaction Design

All interactive components must have:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error

Add states such as Selected, Recording, Paused, and Simulating according to actual needs.

Define:

- Keyboard operation.
- Focus Management.
- Pointer Lock behavior.
- Shortcut priority.
- Modal / Popover behavior.
- Undo / Redo.
- Drag / Drop.
- Keyboard Accessibility.
- Reduced Motion.
- Error Recovery.

Do not substitute large amounts of text for clear interaction design.

<!-- english-original-anchor --> <a id="104-first-person-ux"></a>
## 10.4 First-Person UX

Create separate specifications for FPS Simulation and Build Mode.

Include:

- Player perspective.
- Crosshair and object Hover.
- Grab / Drop / Throw.
- Holding distance.
- Object rotation.
- Ghost Preview.
- Surface Snapping.
- Gravity Modes.
- Fixed / Dynamic Feedback.
- Player / Object Collision.
- Camera / Listener Synchronization.

Handle:

- Objects beyond grabbing range.
- Objects occluded by other geometry.
- Switching modes while grabbing an object.
- Pointer Lock when opening a settings panel.
- Conflicts between FPS controls and Inspector input.
- State restoration after exiting Simulation.
- Audio that has not yet obtained browser playback permission.
- Acoustic output behavior while the simulation is paused.

These interactions must work beyond the normal case.

<!-- english-original-anchor --> <a id="105-professional-workspaces"></a>
## 10.5 Professional Workspaces

Plan and maintain:

- Scene Workspace
- Simulation Workspace
- Analysis Workspace

Each Workspace must have a clear primary task and information priority.

Switching Workspaces must not accidentally reset the physics world, audio playback, or experiment state.

The Inspector uses Contextual Editing.

Keep Selection State consistent across the Scene Explorer, Viewport, Inspector, and Analysis Dock.

Acoustic reflection paths and analysis charts should support bidirectional selection and locating.

<!-- english-original-anchor --> <a id="106-performance-standards"></a>
## 10.6 Performance Standards

Establish a UI Performance Budget.

Distinguish at least:

- Viewport Frame Rate.
- Main Thread Blocking.
- Physics Step Duration.
- Acoustic Solver Update Cost.
- Audio Processing Deadline.
- UI Interaction Latency.

60 FPS may serve as an initial target for a desktop 3D UI, but actual thresholds must be determined by test hardware and project requirements.

Do not treat 60 FPS or 16.7 ms as the actual Audio Callback time budget.

Confirm performance through actual measurements; do not claim success merely because the developer's computer runs smoothly.

<!-- english-original-anchor --> <a id="107-ui-stress-testing"></a>
## 10.7 UI Stress Testing

Use Skills such as `break-ui` to establish testing standards.

Include:

- Very long object names.
- Large numbers of Scene Objects.
- Empty scenes.
- No Listener.
- Invalid Materials.
- Large numbers of Collision Events.
- Acoustic Solver Failure.
- Different screen resolutions.
- Long text and Chinese interfaces.
- High DPI.
- Large numbers of Reflection Paths.
- Devices lacking support for particular features.
- Failure to obtain an audio device or Pointer Lock.

Design standards must cover interaction correctness and failure recovery as well as visual quality.

---

<!-- english-original-anchor --> <a id="11-design-knowledge-integration"></a>
# 11. Design Knowledge Integration

Integrate UI/UX design standards into the long-term Wiki.

Create or index the following knowledge:

- Design Philosophy
- Design Tokens
- Workspace Architecture
- Component Guidelines
- Motion Guidelines
- First-person Interaction
- Acoustic Visualization
- Accessibility
- Performance Standards
- UX Decisions
- UI Review History

Designate the location of the formal Design System document to avoid duplicate, inconsistent standards between the Wiki and `docs/05-ux/`.

The Wiki may maintain summaries, indexes, and design decisions; concrete Component Specs and Design Tokens must retain a single authoritative source.

When an Agent adds or modifies UI:

1. Read the applicable Design System.
2. Use relevant Emil Kowalski Skills.
3. Check existing Component Patterns.
4. Implement or adjust the interface.
5. Perform actual visual and interaction validation.
6. Check animation and performance.
7. Update corresponding design decisions or knowledge pages.

Without real browser or screen validation capability, do not claim that code review alone passes visual testing.

---

<!-- english-original-anchor --> <a id="12-agentsmd-integration"></a>
# 12. AGENTS.md Integration

Add the new long-term memory protocol and UI/UX standards to the existing AGENTS.md.

Keep it concise.

Suggested content:

<!-- english-original-anchor --> <a id="session-startup"></a>
### Session Startup

Read the project Wiki entry point, Current State, current task, and latest Handoff.

<!-- english-original-anchor --> <a id="before-research"></a>
### Before Research

Query existing research to avoid duplicate work.

<!-- english-original-anchor --> <a id="before-implementation"></a>
### Before Implementation

Check the latest Architecture Decision, Feature Status, Relevant Skills, and Testing Requirements.

<!-- english-original-anchor --> <a id="before-ui-changes"></a>
### Before UI Changes

Read the Design System and use applicable design engineering Skills.

<!-- english-original-anchor --> <a id="after-important-work"></a>
### After Important Work

Update the Task, relevant Wiki pages, Evidence, and any necessary Checkpoint.

<!-- english-original-anchor --> <a id="before-session-end"></a>
### Before Session End

Create a Handoff and preserve a reproducible working state.

Do not load the entire research database every time.

Do not copy all Wiki rules into every Agent configuration file.

Maintain cross-Agent consistency through a shared Schema and clear file links.

---

<!-- english-original-anchor --> <a id="13-end-to-end-validation"></a>
# 13. End-to-End Validation

After completion, actually simulate the following scenarios.

<!-- english-original-anchor --> <a id="scenario-a--new-codex-session"></a>
## Scenario A — New Codex Session

Assume the Agent knows nothing about the preceding work.

Using only AGENTS.md and the Wiki, confirm that it can find:

- Current project goals.
- Completed technical research.
- The next P0 task.
- Applicable technical specifications.
- Executable validation commands.

<!-- english-original-anchor --> <a id="scenario-b--agent-handoff"></a>
## Scenario B — Agent Handoff

Simulate Agent A completing a research task and handing it to Agent B.

Agent B must be able to continue correctly through the Handoff and Wiki without repeating unnecessary research.

<!-- english-original-anchor --> <a id="scenario-c--outdated-decision"></a>
## Scenario C — Outdated Decision

Create old and new decisions for testing.

Confirm that the Wiki can identify their relationship, preserve history, and update the effective decision.

<!-- english-original-anchor --> <a id="scenario-d--uiux-implementation"></a>
## Scenario D — UI/UX Implementation

Simulate development of an FPS Grab Interaction.

Confirm that the Agent can find:

- Physics Interaction Spec.
- Input Controls.
- Design System.
- Relevant Emil Kowalski Skills.
- Acceptance Criteria.
- UI / Physics / Audio Testing Requirements.

<!-- english-original-anchor --> <a id="scenario-e--conflicting-agent-updates"></a>
## Scenario E — Conflicting Agent Updates

Simulate different Agents concurrently modifying tasks and project state.

Confirm that the system detects conflicts, does not silently overwrite data, and preserves necessary original records.

---

<!-- english-original-anchor --> <a id="14-final-deliverables"></a>
# 14. Final Deliverables

Actually deliver:

1. A usable Persistent LLM Wiki.
2. Wiki Schema and Source Manifest.
3. Project Goals, Current State, Roadmap, and Task System.
4. Project History, Decision Records, and Experiment Knowledge.
5. Cross-Agent Startup / Handoff Protocol.
6. Compatibility entry points for Codex, Claude Code, and Pi Agent.
7. Wiki Ingest, Query, Lint, Checkpoint, and Handoff tools.
8. Complete tests and execution results.
9. Organized or installed Emil Kowalski Skills.
10. UI/UX Design Standards specific to Reflection Lab.
11. Updated AGENTS.md.
12. A complete work handoff document immediately usable by the next Agent.

If existing project documents overlap with the new Wiki, first confirm and designate a single formal maintenance location for each type of information, then connect them through indexes or links.

Do not delete existing content on your own initiative, or comprehensively rewrite previously completed research merely because a new Wiki is being established.

Finally, provide:

- A list of added and modified files.
- The complete Wiki entry point.
- How cross-Agent memory operates.
- Actual test results.
- Skills installation or configuration status.
- The location of UI/UX standards.
- Remaining limitations.
- How a completely new Agent should begin work.

**Final acceptance criteria:**

Reflection Lab's project knowledge must accumulate continuously through research, development, experiments, and design, and transfer reliably between different Coding Agents and Sessions.

A new Agent should quickly understand where the project is now, what has been done, which decisions are established, what issues remain, and how to execute the next step.

At the same time, all UI/UX changes should follow shared design engineering standards, preventing different Agents from producing conflicting visual systems and interaction logic.

**Now read the two specified official references, inspect the current Repository, then directly build and validate the entire long-term Wiki and design engineering environment. Do not only output a plan.**
