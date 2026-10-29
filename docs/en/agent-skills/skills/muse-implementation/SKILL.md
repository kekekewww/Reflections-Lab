<!-- english-source: {"path":".agents/skills/muse-implementation/SKILL.md","sha256":"1f043b440669100111dd84d39799193f7fb54d2913e6b0ee5ba8850d3afffac0","translated_at":"2026-10-27T05:41:23.2538458Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: muse-implementation
description: Delegate implementation or repair to Muse Code through a Reflection Lab Task Contract, handling restricted workspaces, implementation reports, and quota failures; not a substitute for independent acceptance.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/muse-implementation/SKILL.md`](../../../../../.agents/skills/muse-implementation/SKILL.md). Source SHA-256: `1f043b440669100111dd84d39799193f7fb54d2913e6b0ee5ba8850d3afffac0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="muse-實作"></a>
# Muse Implementation

<!-- english-original-anchor --> <a id="trigger--inputs"></a>
## Trigger / Inputs

**Optional tool**: Under ADR-013, trigger only when Muse Code is explicitly selected and has concrete value, available quota, and authorization; Codex normally implements. docs/09-agents/RESOURCE_STATUS.json is authoritative for the latest availability and sources; do not treat available credit as a configured per-run spending limit or automatically switch executor when quota recovers. When selected, inputs are WikiTask, the frozen contract, run/goal/milestone, workspace, budget, and remaining work.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Resume through AGENTS startup, reading only relevant ADRs, relevant_files, and applicable domain/design Skills. Check completed checkpoints and the diff, retaining partial results.
2. Confirm current runner commands with `node scripts/agents/cli.mjs help`; use a controlled adapter, checking installed CLI help, sandbox, model availability, and budget first. Record unknown quota as null; do not generate a paid model run without paid-use authorization.
3. Use the corresponding templates in prompts/muse and the frozen contract. Modify only allowed_files; do not modify protected acceptance, benchmark references, Task scope/budget/ADRs, or automatically commit/push.
4. Preserve session events, model/CLI version, modified files, partial tests, and remaining work; output ImplementationResult. Exit0 and self-reported success cannot complete the task.

<!-- english-original-anchor --> <a id="completion--validation"></a>
## Completion / Validation

An external verifier executes the original acceptance and checks artifacts and protected hashes. Full policy is in docs/09-agents/CODEX_MUSE_ORCHESTRATION.md, VALIDATION_POLICY.md, and FAILURE_RECOVERY.md; templates are in prompts/muse/implementation.md and repair.md.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

The detector separately identifies temporary 429, confirmed quota/credit, authentication, permissions, service failures, and unknown errors. Use only bounded backoff within policy; hand over the workspace only after stopping the process and saving a checkpoint. Do not disable the sandbox, raise paid limits, switch to an unauthorized account, or write concurrently with Codex.
