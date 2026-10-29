<!-- english-source: {"path":"knowledge/wiki/handoffs/index.md","sha256":"12c7d185f8138e533c7217fe024b73a5e5750b4eda349dd15ac44a13e8b49e71","translated_at":"2026-10-27T05:42:05.466Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0023
title: "Handoff entry point"
type: index
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-25T20:08:10.942Z
sources:
  - RLAB-SRC-0002
  - RLAB-SRC-0046-V2
  - SRC-CLAUDE-MEMORY-20261026
  - SRC-CLAUDE-SKILLS-20261026
  - SRC-CLAUDE-HOOKS-20261026
  - SRC-CLAUDE-SUBAGENTS-20261026
  - SRC-CODEX-AGENTS-20261026
  - SRC-CODEX-SKILLS-20261026
  - SRC-CODEX-HOOKS-20261026
  - SRC-CODEX-SUBAGENTS-20261026
  - SRC-CODEX-COMMANDS-20261026
  - SRC-PI-INSTALLED-README-V0-85-1
  - SRC-PI-INSTALLED-PACKAGE-V0-85-1
  - SRC-PI-INSTALLED-SKILLS-V0-85-1
  - SRC-PI-INSTALLED-EXTENSIONS-V0-85-1
  - SRC-PI-INSTALLED-LICENSE-V0-85-1
  - SRC-PI-MAIN-PACKAGE-20261026
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P0
  - handoff
  - startup
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/handoffs/index.md`](../../../../../knowledge/wiki/handoffs/index.md). Source SHA-256: `12c7d185f8138e533c7217fe024b73a5e5750b4eda349dd15ac44a13e8b49e71`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="最新交接與恢復工作"></a>
# Latest handoff and resuming work

A new Agent first reads [Now](../now.md)→[Tasks](../tasks.md), then finds the latest type=handoff page in the generated main index below; every CLI-generated handoff includes task/agent/session/Git/actual scopehash/commands/evidence/risks/next. Original events are not overwritten.

The [complete handoff index](../index.md) and [chronological log](../log.md) locate the latest records. There is no automatic hook; do not assume state was saved before an unexpected interruption. Read status/pending transactions/files before taking over. The previous Agent's command text alone is not proof that tests succeeded.

The shared entry point across Agents is root AGENTS; Claude's thin entry point references the same rules, and Pi reads the same documents using the support available in the verified version. See [compatibility](../../../09-knowledge/AGENT_COMPATIBILITY.md) for actual compatibility and the native sessions that have not been run.
