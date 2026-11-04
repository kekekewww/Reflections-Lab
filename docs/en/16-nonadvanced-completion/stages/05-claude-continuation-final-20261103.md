<!-- english-source: {"path":"docs/16-nonadvanced-completion/stages/05-claude-continuation-final-20261103.md","sha256":"465d8b7430855ae31af83c6db54c629afc545b5a67b406947fa46310c332be55","translated_at":"2026-11-03T11:11:58.180Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/stages/05-claude-continuation-final-20261103.md`](../../../16-nonadvanced-completion/stages/05-claude-continuation-final-20261103.md). Source SHA-256: `465d8b7430855ae31af83c6db54c629afc545b5a67b406947fa46310c332be55`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="m5claude-接手的工程驗證結果不是第一版完成"></a>
# M5: engineering validation results after Claude handoff (not first-version completion)

The [machine-readable record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4ab7d96b3ce136dbeaf8cff047259842688479f3) pins product source `544d8d9f` (src tree `0d955495`) and evidence SHA-256 values. See the [final handoff](../handoffs/CLAUDE_FINAL_HANDOFF_20261103.md) for explanations and the manual-test entry point.

| Scope | Result |
| --- | --- |
| Full `npm run check` | Research regressions, lint/types/formatting, runtime 2270/2270, build and licenses passed; English was incomplete then and was completed afterward |
| 7 runtime failures at handoff | 4 tests had not caught up with established rules, 1 product bug was fixed, 2 test timing races |
| Long output | attempt05 passed 58/58 (at `89f65e4d`, not a rerun on the frozen source) |
| Product E2E refined v3 | 4/4 passed |
| Ten reset/import cycles and disposal | 2/2 passed |
| Production top monitoring | 4/5; recording-continuity case paused at the original fixed-step guard |
| All 22 S4 routes | 11 passed/11 failed, retained without fixes |
| Windows Computer Use | BLOCKED (browser URL-determination policy), 0 product steps |
| Formal 600-second V4 | Not run by user decision |
| Human listening, physical keyboard/mouse, Meta live | Not run |
