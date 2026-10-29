<!-- english-source: {"path":"docs/09-agents/VALIDATION_POLICY.md","sha256":"671f4c9de3cbc3d9aec2b6fe6eb530a642e6fdf308da348018ee7ec0f554676b","translated_at":"2026-10-27T03:40:19.256Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/VALIDATION_POLICY.md`](../../09-agents/VALIDATION_POLICY.md). Source SHA-256: `671f4c9de3cbc3d9aec2b6fe6eb530a642e6fdf308da348018ee7ec0f554676b`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="獨立驗收與完成條件"></a>
# Independent Acceptance and Completion Conditions

The implementer may run self-tests and output an ImplementationResult, but cannot decide that a task is DONE. The Orchestrator specifies and freezes acceptance before implementation, and the runner reruns it in an independent subprocess; results retain command/exit/stdout/stderr/duration/script hash/run ID/Git revision. The acceptance runner and implementation function must not use the same unverified program to generate both expected and actual.

Check hashes of protected scripts/fixtures/contracts before and after; stop first on any change or modification outside scope. If formal acceptance itself has a defect, it requires independent review, a new contract version/reason/source; implementers may not delete tests or lower tolerances in place. This protects against accidental changes; a malicious process with the same OS permissions may still damage control data, so it cannot be called a cryptographic sandbox.

Verification failure creates a reproducible RepairTask listing expected/actual, defects, allowed scope, and original acceptance; by default, a single defect gets at most three rounds, also subject to total time/attempt limits. Resource exhaustion, repeated failure of the same issue, insufficient permissions, or spec conflicts result in BLOCKED; do not loop indefinitely. A model's success claim, exit 0, or a polished UI cannot bypass the original tests.

The formal frontend requires typecheck/lint/component/interaction/visual checks; physics requires deterministic fixtures/modes/contacts/CCD; acoustics requires analytical geometry/delay/energy/path IDs/numerical tolerances; audio requires offline graph/arrival/continuity/voice cleanup and device listening tests. Mark each PASS/FAIL/BLOCKED/NOT RUN according to what was actually executed; this phase's Node fixtures cannot substitute for browser/headphone tests.

<!-- english-original-anchor --> <a id="本階段驗證層"></a>
## Verification Layers in This Phase

- Mock subprocess: 12 failover/repair/recovery scenarios and fault injection demonstrate the Harness control logic.
- Muse echo: the installed version's CLI/JSONL/terminal events, not Muse model implementation.
- Existing Codex Orchestrator: can modify an isolated fixture according to the handoff, with independent runner verification; actual artifacts are required before listing it as evidence.
- Model Prompt eval: offline fixtures verify only the test foundation; task success/latency/tokens/cost remain unknown for real models.
- Original core/physics/Wiki/design regression: retain original fixtures/tolerances; new tools must not break previous results.
- Isolated code review: an independent Agent raises reproducible issues and checks fixes; this is not product live/physical experiment evidence.

A remote CI workflow being configured does not mean it has run; the [Phase3 Report](PHASE3_REPORT.md) indexes complete raw results, gates/skips, and version scope.

