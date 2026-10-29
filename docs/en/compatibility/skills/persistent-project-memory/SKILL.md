<!-- english-source: {"path":".claude/skills/persistent-project-memory/SKILL.md","sha256":"fc2e9763d7c3ade13d60912af8c996d98814c399cd0bf711b790a3a5017b2525","translated_at":"2026-10-27T03:38:38.947915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: persistent-project-memory
description: Use when maintaining the Reflection Lab shared knowledge base, tasks, checkpoints, and handoffs; load the single shared Skill.
---

<!-- english-notice:start -->
> English translation of [`.claude/skills/persistent-project-memory/SKILL.md`](../../../../../.claude/skills/persistent-project-memory/SKILL.md). Source SHA-256: `fc2e9763d7c3ade13d60912af8c996d98814c399cd0bf711b790a3a5017b2525`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="共用記憶入口"></a>
# Shared Memory Entry Point

First read the [shared Skill](../../../agent-skills/skills/persistent-project-memory/SKILL.md) in full and follow its workflow. That file is the sole workflow source; this entry point does not separately define schemas, task states, or tool behavior.

If the shared file is missing, report the exact path and preserve the current work state; do not create a second specification yourself. This entry point has no hooks, advance tool authorization, or background services.
