<!-- english-source: {"path":".agents/skills/agent-orchestration/SKILL.md","sha256":"09e3338f61509ab19d5cb05c1ec7a7d5c24ebe2398ba1c3463246defed804058","translated_at":"2026-10-27T03:37:45Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: agent-orchestration
description: Manage Reflection Lab tasks, acceptance, and checkpoints led by Codex; use the legacy cross-Agent Harness only when explicitly selected, keeping Wiki Task as the sole authority.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/agent-orchestration/SKILL.md`](../../../../../.agents/skills/agent-orchestration/SKILL.md). Source SHA-256: `09e3338f61509ab19d5cb05c1ec7a7d5c24ebe2398ba1c3463246defed804058`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="開發代理調度"></a>
# Development Agent Orchestration

<!-- english-original-anchor --> <a id="trigger--inputs"></a>
## Trigger / Inputs

Execute an acceptance-testable milestone or resume a task. Normally use Wiki Task, formal specifications, Git scope, resource limits, and handoff; its TaskContract/RunState are needed only when selecting the legacy Harness. See docs/02-architecture/adr/013-codex-primary-development.md for the new policy.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Follow AGENTS startup to check the task, dependencies, and effective ADRs; read run state, the latest handoff, and actual files first. Do not create a second Task backlog or rerun completed work.
2. Normally Codex directly plans and implements, with acceptance through independent tests, references, and review. The legacy Harness is Optional; consult `node scripts/agents/cli.mjs help` only when explicitly selecting it. Its Muse default is not the project default. Keep an unconfigured paid-run limit at 0 and unknown quota at null; read the latest sourced observations in docs/09-agents/RESOURCE_STATUS.json, and continue to stop dispatch when exhaustion is confirmed.
3. Freeze acceptance, protected files, and scope before dispatch; only one executor operates in the same workspace. Preserve model and modification provenance through session/run/Git snapshots.
4. If Muse is selected, retain detector error classification and bounded backoff; confirm that the original writer has stopped before handoff. Do not create unnecessary cross-Agent switching for ordinary Codex work.
5. Carry forward the task, goal, milestone, Git state, and original acceptance. Run frozen tests in an independent process; failures enter bounded repair. If both executors are unavailable, mark BLOCKED and stop resource consumption.
6. Muse recovery does not automatically switch the project back; switch at a safe boundary only when that tool is selected again, preserving history. Update and hand off important results using the existing Wiki protocol.

<!-- english-original-anchor --> <a id="completion--failure-handling"></a>
## Completion / Failure Handling

The full authority is docs/09-agents/CODEX_MUSE_ORCHESTRATION.md and FAILURE_RECOVERY.md. Account for development quota separately from product Meta API quota; when product credit is exhausted, mock/offline runs may continue, but live tests remain BLOCKED/NOT RUN. Without a reliable independent Codex process, use the existing orchestrator to take over; do not recursively invoke the same session, automatically increase budgets, or switch accounts.
