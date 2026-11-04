<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/integration-fix/source-phase-fixture-repair.md","sha256":"d7138216eb99aeedd4833c7614b4b0faabe2a57012490ef095eee4237857f893","translated_at":"2026-11-02T10:01:00.945Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/integration-fix/source-phase-fixture-repair.md`](../../../../15-ui-parameter-audit/acoustic-geometry/integration-fix/source-phase-fixture-repair.md). Source SHA-256: `d7138216eb99aeedd4833c7614b4b0faabe2a57012490ef095eee4237857f893`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="source-phase-測試資料標記修正"></a>
# Source-phase test-fixture metadata correction

Integration tree: `D:\Developing\Meta Hack\.worktrees\integration`; HEAD at inspection: d6bc27667220aa0c0b7a91c85a2f6e423e42fd80.

The original file is preserved byte-for-byte in source-phase.test.ts.preimage.raw.txt. Of the original 12 tests, 8 passed and 4 failed with CAPABILITY_UNSUPPORTED. The pure-box Scene actually uses web-geometric-1.0.0, while the test header still used the placeholder 1.0.0. The new exact-model check correctly rejected reevaluation.

Changes are limited to two fixture imports, deriving backendVersion from the actual Scene, and adding emitterGeometryPolicyPin() for a new recording. Applying the three exact replacements produces the current file byte-for-byte. Product guards, clocks, source phase, cursor, epoch and every expected value are unchanged.

Verification: the entire specified test file passed 12/12 with no skips; its scoped ESLint and Prettier checks both exited 0. Original/final raw output and source SHA-256 values are in source-phase-fixture-repair.json.

This report covers only that test file. No complete runtime, browser, hardware audio or human hearing test was run. The Git index, commits and Wiki were not modified.
