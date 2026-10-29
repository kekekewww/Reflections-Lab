<!-- english-source: {"path":".agents/skills/codex-verification/SKILL.md","sha256":"c55d962dd2e3e24c4e9d46dfe341da40e18fdb818aefdc879d548856993c6d74","translated_at":"2026-10-27T03:37:45Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: codex-verification
description: Independently verify Reflection Lab implementation results, checking frozen acceptance, Git diff, test artifacts, and provenance, and create reproducible repair tasks with bounded attempts.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/codex-verification/SKILL.md`](../../../../../.agents/skills/codex-verification/SKILL.md). Source SHA-256: `c55d962dd2e3e24c4e9d46dfe341da40e18fdb818aefdc879d548856993c6d74`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="codex-驗證"></a>
# Codex Verification

<!-- english-original-anchor --> <a id="trigger--inputs"></a>
## Trigger / Inputs

Codex or an optionally selected Muse implementer has produced changes that require an acceptance and repair decision. Normal inputs are WikiTask/formal acceptance, Git diff, and artifacts; include TaskContract/RunState/ImplementationResult when selecting the legacy Harness. A cross-Agent workflow is not mandatory for every task.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Check task/goal/milestone/run and workspace; confirm that the executor has stopped and released write ownership. Inspect actual files, untracked changes, and protected acceptance hashes.
2. Execute the original acceptance in an independent process, retaining the actual command, exit, stdout, stderr, and hash. A model's or executor's tests_reported is only a lead; it must not be the acceptance authority.
3. Select deterministic physics/acoustic references, schema, CI, browser, audio, or E2E according to the task. Execute only commands with an implementation and reproducible environment; explicitly mark unexecuted items NOT RUN. UI appearance cannot replace numerical validation.
4. Convert failures into RepairTask with expected/actual, reproduction, and evidence, retaining the original allowed_files, acceptance, and repair budget. Only after a pass may the Orchestrator update the existing Wiki Task and checkpoint.

<!-- english-original-anchor --> <a id="completion--validation"></a>
## Completion / Validation

Output VerificationResult, explicitly listing verification scope, defects, and limitations. Refer to docs/09-agents/VALIDATION_POLICY.md and schemas/agents. `node scripts/agents/cli.mjs help` is authoritative for exact CLI commands.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Refuse completion when protected tests/references have changed, evidence is missing, or someone is still writing in the workspace. When Codex handles both orchestration and implementation, it cannot claim independence through self-review; use tests frozen in advance and independent processes, add an isolated reviewer when available, and list remaining verification gaps as limitations.
