<!-- english-source: {"path":"prompts/muse/codex-fallback.md","sha256":"16ed3c6ae9d67b7e8b0693ed312093a5227d78debe16bdaa09c655deb96a1986","translated_at":"2026-10-27T05:42:24.755Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`prompts/muse/codex-fallback.md`](../../../../prompts/muse/codex-fallback.md). Source SHA-256: `16ed3c6ae9d67b7e8b0693ed312093a5227d78debe16bdaa09c655deb96a1986`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="codex-接手剩餘實作"></a>
# Codex Takes Over Remaining Implementation

```json
{{TASK_CONTRACT_JSON}}
```

```json
{{RUN_STATE_JSON}}
```

```json
{{HANDOFF_JSON}}
```

You are now the Codex Implementation Executor for the same Task. First check the handoff hash, workspace, evidence that the process stopped, and exclusive ownership; do not call your own currently running session or establish an unverified recursive CLI. Preserve goal_id, milestone_id, task ID, Git state, original acceptance, and all partial results.

Read AGENTS, effective ADRs, relevant_files, applicable Skills, and canonical UI specifications. Check diff / checkpoint / completed_acceptance_criteria before doing remaining_work; repair already modified areas only when the original implementation fails to meet acceptance. Modify only allowed_files; do not change protected tests, references, resource budgets, or test tolerances.

Report an ImplementationResult conforming to schemas/agents/implementation-result.schema.json, with schema_version=1 and executor=CODEX; use null when actual model / CLI information is unknown. Have an independent test process run the original acceptance; add an isolated reviewer when available. Codex also handling orchestration does not constitute independent verification. When the Meta product API quota is exhausted, offline fixtures may run, but Meta integration must be retained; do not switch to the Codex API and claim Meta live PASS.
