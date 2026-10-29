<!-- english-source: {"path":"docs/superpowers/plans/2026-10-26-agent-harness.md","sha256":"d641fcc144cd7bc602fa05fea28c182c8c3532156defa871319b0954691eb3b2","translated_at":"2026-10-27T05:42:00.517Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/superpowers/plans/2026-10-26-agent-harness.md`](../../../superpowers/plans/2026-10-26-agent-harness.md). Source SHA-256: `d641fcc144cd7bc602fa05fea28c182c8c3532156defa871319b0954691eb3b2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="development-harness-與自動接手實作計畫"></a>
# Development Harness and Automatic Implementation Takeover Plan

> **For agentic workers:** Implement and review each item according to separate file ownership; use test-driven development and independent review. The user has explicitly requested direct execution, so do not add another design approval gate.

**Goal:** Within the existing permissions and budget, preserve task / Milestone / Goal / Git changes so Codex can take over when Muse fails, and continue only after passing the original acceptance criteria.

**Architecture:** Wiki task JSON remains the sole authority for work; the Task Contract fixes acceptance criteria, and Run State records detailed executor status. Separate the control directory from the isolated workspace, with a single workspace writer; independent subprocesses run acceptance and produce evidence with hashes. Keep product Meta API resources separate from development-agent resources.

**Tech Stack:** Existing Node 22.17.0 ESM, AJV, Node test runner, Git, and installed Muse / Codex CLI; no additional packages.

**Spec:** [Original Phase3 requirements](../../00-project/PHASE3_REQUEST.md) and the user's Automatic Agent Failover request in this session (the latest request takes precedence).

<!-- english-original-anchor --> <a id="global-constraints"></a>
## Global Constraints

- Do not begin formal product features; preserve the original Phase1 / 2 evidence and Steam Audio research.
- The monetary budget defaults to 0; do not increase payment limits, switch accounts, or read / save secrets.
- Do not conflate 429, 401, 403, 402, and explicit quota exhaustion.
- Acceptance is fixed; implementers must not change tests to manufacture a pass. Explicitly state when independent verification is missing.
- Do not push / deploy / accept terms; record null when there is no HEAD, and do not fabricate a commit.
- Formal documentation uses Traditional Chinese; paths, APIs, and code use English.

<!-- english-original-anchor --> <a id="review-focus"></a>
## Review Focus

- Do not unlock or switch executors until the subprocess is proven to have stopped, to avoid overlapping background writers.
- Do not silently treat unrecognized CLI events / errors as success or quota exhaustion.
- When Git has no HEAD, or there are untracked files or partial edits, preserve their contents and hashes, not just git diff.
- Reject verification if the acceptance script or contract has changed; do not adopt weaker new tests.
- Repeated resume, stale checkpoints, and sessions across workspaces must be rejected or idempotent; do not redo work that has already passed.

<!-- english-original-anchor --> <a id="task-1--官方能力錯誤與架構對齊"></a>
## Task 1 — Align Official Capabilities, Errors, and Architecture

**Files:** `docs/09-agents/*RESEARCH.md`, `HEADLESS_EXECUTION.md`, `CODEX_CAPABILITIES.md`, `research/agents/`; root maintains `docs/02-architecture/`.

- [x] Read official original sources and the actual version/help; verify the separation of CLI / usage / subscription / API layers.
- [x] Pin source metadata and local smoke evidence without paid calls; leave unknown values as null / NOT RUN.
- [x] Preserve old decisions and supersession in a new ADR; explicitly state the new project, Web custom core, R3F direction, and separation of development from product.

<!-- english-original-anchor --> <a id="task-2--可執行-harness"></a>
## Task 2 — Executable Harness

**Files:** `scripts/agents/`, `schemas/agents/`, `examples/agents/`, `tests/agents/`.

**Interfaces:** `node scripts/agents/cli.mjs help`; the Task Contract links through `wiki_task_id`, `goal_id`, and `milestone_id`, without creating a second task system.

- [x] First create and run failing tests: 12 failover scenarios, fixed original acceptance, process timeout, mutual exclusion, and resume.
- [x] Implement detector/router/resources, checkpoint / handoff, Muse adapter, current-Codex adapter, and independent verify / repair / events.
- [x] Run the original tests and isolated CLI demo; label test records Mock Runner, and label actual Muse echo CLI offline.

<!-- english-original-anchor --> <a id="task-3--promptsruntime-與離線評測"></a>
## Task 3 — Prompts, Runtime, and Offline Evaluation

**Files:** `prompts/`, `benchmarks/muse/`, `docs/08-ai/PHASE3_RUNTIME_AGENT.md`, and 5 new project skills.

- [x] 7 coding / 3 runtime template categories, with fixed acceptance, domain data authority, and fallback provenance.
- [x] Executable fixture benchmark for 4 task categories × 2 strategies; leave unknown model quality / token / cost as null, LIVE EVAL NOT RUN.
- [x] Reference the existing tool schema without implementing the formal runtime; labeled mocks remain runnable when Meta quota is exhausted.

<!-- english-original-anchor --> <a id="task-4--既有入口與共享持久狀態"></a>
## Task 4 — Existing Entry Points and Shared Persistent State

**Files:** `AGENTS.md`, `README.md`, `package.json`, `schemas/wiki-task.schema.json`, `scripts/wiki/core.mjs`, `tests/wiki/`, `knowledge/`.

- [x] First use failing tests to confirm that task update safely preserves the `agent_execution` projection and rejects invalid states.
- [x] Keep the high-level status of Wiki tasks unchanged; detailed PENDING…BLOCKED statuses belong in the run projection, while acceptance is still determined by task criteria backed by evidence.
- [x] Integrate check / CI and this session's independent result files, preserving the old Phase2 pinned gate.
- [x] Use CLI ingest / task update / checkpoint / handoff to synchronize sources, current state, history, and the next product task that is not yet authorized.

<!-- english-original-anchor --> <a id="task-5--整合與獨立審查"></a>
## Task 5 — Integration and Independent Review

- [x] Actually pass the original core / physics / wiki / design regressions and new tests; read stdout / exit, and do not rely on self-reported PASS.
- [x] Have an independent agent review the state machine / safety / requirements; fix reproducible defects and reverify the affected scope.
- [x] Complete Gate A–I (including BLOCKED / PARTIAL / NOT RUN), the file inventory, real executable commands, and limitations; a new session can continue by reading the Wiki.

<!-- english-original-anchor --> <a id="progress"></a>
## Progress

2026-10-26: Four groups with separate file ownership have been dispatched; Phase2 is complete, and there is no formal Harness yet. Muse is installed; Git has no HEAD yet. No paid inference has been started.

2026-10-27 closeout: 19/19 gates PASS; Agent75/75, Prompt12/12, Wiki53+1skip. Task0008 DONE, fresh receipt PASS; user-reported Muse0 → handoff before actual launch → current Codex edits → original independent acceptance PASS, attempts0. Live items remain Task0009 BLOCKED and are not listed as verified. Initial Git snapshot 038d83d; original evidence bytes preserved.
