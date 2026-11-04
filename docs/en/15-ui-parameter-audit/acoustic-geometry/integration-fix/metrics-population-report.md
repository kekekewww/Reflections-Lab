<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/integration-fix/metrics-population-report.md","sha256":"431ab24573bcd7cb0dac3f9a0084d6b7b58d09dc474b5e9bf20047852f164f57","translated_at":"2026-11-02T10:01:00.937Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/integration-fix/metrics-population-report.md`](../../../../15-ui-parameter-audit/acoustic-geometry/integration-fix/metrics-population-report.md). Source SHA-256: `431ab24573bcd7cb0dac3f9a0084d6b7b58d09dc474b5e9bf20047852f164f57`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="重複查詢測試資料修正"></a>
# Duplicate-query test-fixture correction

The original integration run produced a sample count of 7 in the conflicting-duplicate case (expected 6). The default Scene sphere makes the actual recording use the extended acoustic model. The manually constructed duplicate query had only an empty planar collection and no model-version pin, so the solver returned legacy. Under the contract, metrics first exclude queries with a different backend/version; the two queries therefore did not create same-model ambiguity.

Only the original frame's `modelVersion` was added to that artificial query, with backend ID/version equality checked before appending it. Removing these three lines makes the file byte-identical to the preserved original. The sample count of 6, invalid count of 2, 5/343 and all original tolerances are unchanged. Product code and the Git index were untouched.

The complete file passed 7/7 (10.206 seconds), with ESLint and Prettier exit 0. `metrics-population-verification.json` records commands and exact SHA-256 values; the original integration output, original file and this focused raw output are preserved. This receipt is not complete-integration, browser or audio validation.
