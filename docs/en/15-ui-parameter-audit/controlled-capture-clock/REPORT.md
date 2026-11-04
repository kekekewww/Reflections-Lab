<!-- english-source: {"path":"docs/15-ui-parameter-audit/controlled-capture-clock/REPORT.md","sha256":"a19a81c8cc92c4f64e4c98ba58afdd0f475c2fb54f7770c14c544d7fae7f35f0","translated_at":"2026-11-02T10:50:05.6720900+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/controlled-capture-clock/REPORT.md`](../../../15-ui-parameter-audit/controlled-capture-clock/REPORT.md). Source SHA-256: `a19a81c8cc92c4f64e4c98ba58afdd0f475c2fb54f7770c14c544d7fae7f35f0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="負載暫停後的受控錄製修補"></a>
# Controlled-recording repair after overload pause

Baseline: 49bde82be6f9def5058bc8f3076e105fcdfd535d. This repairs a product problem found in the final actual-UI Motion case rather than relabeling it a test-script problem. Pinned product/test-file hashes, actual commands and raw output are in [verification.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0bdd1a1b852763a2effe83f73f1a137a1905bfc8). This implementation agent did not operate the Git index, browser or Wiki.

<!-- english-original-anchor --> <a id="原始失敗與根因"></a>
## Original failure and root cause

On recording overload, FixedClock correctly retains unprocessed wall-clock debt. After stopping and sealing the current prefix, the original three-second controlled capture still used wall-clock advance(dt), which could catch up multiple physics steps in one iteration. This violates controlled capture's one-tick-per-iteration guard and produces SHORT_TAKE_INTERRUPTED. A real Runtime regression reproduces the same failure through public RecordToggle → advance(0.2) → Stop → captureShortTake(3); retain the [original RED](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/df4b4c14507c7d000b0e2a11fde8f82a36aa599c).

<!-- english-original-anchor --> <a id="修補語義"></a>
## Repair semantics

Add an explicit controlled single-step entry that completes exactly one real physics fixed step per authored request. It adds no wall-clock input and neither consumes, clears nor resets existing wall-clock debt or dropped-time counters. Ordinary advance retains exactly the original recording debt-preservation/protective-pause and interactive catch-up/drop algorithms. Verification also checks hashes of the original method bodies rather than inferring this only from tests.

PhysicsWorld retains the same fixed step, Motion observation and external-snapshot callback path. Failure before solving does not invent a tick. An observer failure after solving commits the actual tick once in both clock and world, pauses and propagates the error. This proves safe pause/interruption only; it does not promise recovery from an injected internal-observer error without reset.

Runtime uses single-step only while controlled capture is actually recording, retaining existing scene-revision, pause-generation, cancellation, drain and exact-frame completeness guards. Old wall-clock debt is not mistaken for dropped time in the audio epoch.

<!-- english-original-anchor --> <a id="基本驗證"></a>
## Basic validation

- Original real-Runtime regression: 1 case FAIL, with the same error as the actual UI.
- Complete repaired focused set: 38/38 PASS, 0 skipped, including existing replay/export lifecycle cases.
- A new Runtime case verifies that after overload pause and sealing a 4-tick prefix, a new 180-contiguous-tick recording succeeds with replayable source and no Scene reset, while preserving old debt and the original zero-drop count. It also verifies that Pause after recording an actual tick can seal a contiguous prefix without late ticks.
- FixedClock tests verify exact preservation of both integer and fractional debt. Ordinary advance(0) still processes batches under the original load policy. Negative cases cover pause, wrong modes, callback failure and safe-integer bounds.
- Real Rapier tests cover single-step physical displacement, clock/world tick consistency and commit/pause semantics for pre-solve, post-solve and external-callback failures.
- TypeScript, scoped six-file ESLint, Prettier and diff checks pass.

Root continues final full-integration checks, rebuilt-product actual-UI validation and WAV export. This stage resolves none of the existing performance, hearing, native-desktop permission or full-V1 gates.
