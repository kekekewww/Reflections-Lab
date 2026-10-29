<!-- english-source: {"path":"prompts/muse/bugfix.md","sha256":"4760e6380eea124ea835402c412d388c292702d76a1f6eccbf1673ae00d04415","translated_at":"2026-10-27T05:42:24.755Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`prompts/muse/bugfix.md`](../../../../prompts/muse/bugfix.md). Source SHA-256: `4760e6380eea124ea835402c412d388c292702d76a1f6eccbf1673ae00d04415`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="bug-fix-與-regression"></a>
# Bug Fix and Regression

Fix reproducible defects according to the frozen Task Contract.

```json
{{TASK_CONTRACT_JSON}}
```

First read AGENTS.md, relevant ADRs, and original defect evidence. Reproduce with the failing input first, distinguish expected / actual / environment issues, and then identify the cause; explicitly state limitations when reproduction is unavailable, and do not patch by guesswork. Modify only allowed_files, preserving protected_files, original acceptance, and benchmark truth. You may add regression tests within the allowed scope, but must not delete, skip, relax tolerances, or rewrite established acceptance.

Check nearby regressions involving the same state transitions or boundaries, without expanding into unrelated refactoring. If remaining work has already been partially completed, first check the diff and checkpoint rather than redoing it. Report an ImplementationResult with actual reproduction and post-fix commands / exit codes, modified files, unverified portions, and known limitations. An independent process determines acceptance; preserve diagnostics on failure and return to the bounded repair loop.
