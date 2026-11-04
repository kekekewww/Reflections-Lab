<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/evidence/geometry-contract-report.md","sha256":"433f4ccd22108e3c8da400df82fb26ac3546b311e2826457af14263ab004217d","translated_at":"2026-11-02T10:01:02.355Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/evidence/geometry-contract-report.md`](../../../../15-ui-parameter-audit/acoustic-geometry/evidence/geometry-contract-report.md). Source SHA-256: `433f4ccd22108e3c8da400df82fb26ac3546b311e2826457af14263ab004217d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="幾何資料與模型版本契約驗證"></a>
# Geometry-data and model-version contract validation

Task0030. This round added only `tests/acoustics-runtime/geometry-contract.test.ts`; it did not modify product code, older numerical references, tolerances or the Git index.

13/13 tests passed. Coverage includes omission of new fields on old planar requests, rejection of unknown versions, rejection of new geometry/dynamic reflectors under an old pin, an extended pin with empty geometry, OBB format/sparse arrays/duplicate IDs across collections, and positive/negative cases for the combined count of three geometry forms.

Actual `AcousticService` with actual `solveAcoustics` runs through a structured-clone test transport, confirming OBB-pose preservation and updated occlusion after movement. Changing caller data after dispatch cannot rewrite the dispatched snapshot's expected model. Wrong backend/model-version/path-ID prefixes are rejected. This transport is not a native browser Worker.

The new test file's ESLint and Prettier checks both exited0. Commands, original output and then-current source SHA-256 are in `geometry-contract-verification.json`; original test output is `geometry-contract.txt`. This receipt establishes data contracts and service boundaries only. Other subtasks validate independent curved mathematics; browser operation, actual WAV export, hearing, physical measurement and complete integration checks are outside this receipt's scope.
