<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/integration/RUNTIME_FAILURES_20261103.md","sha256":"7f7f8d57963f4952fd453030637a2b403a1cf65c6b331e219ea3733c1107f682","translated_at":"2026-11-03T09:57:53.243Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/integration/RUNTIME_FAILURES_20261103.md`](../../../../16-nonadvanced-completion/lanes/integration/RUNTIME_FAILURES_20261103.md). Source SHA-256: `7f7f8d57963f4952fd453030637a2b403a1cf65c6b331e219ea3733c1107f682`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="完整-runtime-測試的-7-項失敗原因與修正2026-11-03"></a>
# Seven full-runtime test failures: causes and fixes (2026-11-03)

Executor Claude Code (claude-opus-5-5). check-03 (source `18dbc908`) `test:runtime` was 2262/2269, 7 failures ([raw excerpts](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/56c387b7968a7b24e0ecd33567ff49c0cf3d6d6c)). Fixes are in `502d2472` and one subsequent test-fix commit. Acceptance gates, fixtures/tolerances were not relaxed; original failure records remain.

<!-- english-original-anchor --> <a id="先確認失敗從哪裡來"></a>
## First establish where failures began

`git bisect` in an independent detached worktree located each first-failing commit: these failures already existed before handoff (`cbbe774e`), while all pass on main `e25f9f48`; integration ran only partial tests, not complete `npm run check`.

| Test | First failing commit | Record |
| --- | --- | --- |
| 876,877,880 (1162 shares mechanism) | `41526a71` (long-recording recovery/audio cursor classification) | [bisect](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/runtime-failures-20261103/bisect-cursor-tests.log) |
| 941 | `466aa828` (prepare Worker/storage before recording) | [bisect](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/runtime-failures-20261103/bisect-native-admission.log) |
| 1024 | `cdacdeb3` (two-stage pipeline test added during this handoff) | — |
| 633 | Full-suite only; fails at `cbbe774e`, passes on main; unstable bisect result rejected | See below |

<!-- english-original-anchor --> <a id="1-錄製中的聲音游標8768778801162測試沒跟上已定的規則"></a>
## 1. Recording audio cursors (876,877,880, 1162): tests lagged established rules

Since `41526a71`, recording frames write only cursors with complete native playback history to `voiceCursors`; incomplete histories go to `nonNativeVoiceCursors`, marked `NATIVE_HISTORY_INCOMPLETE` (frame records `cursorEvidencePolicy: "nativeCompleteOnly; virtualAndIncompleteAuditsSeparate"`). Since `466aa828`, Record pauses physics, behavior/audio together until storage/Worker are ready; already-playing sources stop and restart from their prior positions, so their history is incomplete. Both are documented deliberate designs (independent preparation review required audio/physics synchronization), but four tests still read all cursors from `voiceCursors`.

Treatment (tests only, no product changes):

- Adds shared [`recordedCursor`](../../../../../tests/app/fixtures/recorded-cursor.ts), asserting classification by context: sources starting inside this recording must have complete native evidence and cannot also appear in audit fields; those already playing before Record or restored from pause must have `provenance: native`,`historyIncomplete: true`,`NATIVE_HISTORY_INCOMPLETE`, and must never appear in native fields. Original numerical cursor checks remain.
- 876/1162: first recording (sources start within recording) remains complete native; after stopping replay, sources restored by Run are asserted as incomplete audits. Original bounds on replay time not advancing paused live sources remain.
- 877: B (`restoredPreStepSnapshot`) copies only complete native cursors, so B must not promote audits to native cursors in this scenario (already playing before Record); pitch making engine seconds exceed behavior seconds is checked on audit cursors. Unit tests in `recording-processor.test.ts` cover B copying complete native cursors. Recording before Run was tried to obtain complete source history, but B legitimately remaps instance IDs, changing what the test compares, so that approach was rejected.
- 880: every Record restarts sources; the original exact 1 tick cursor difference between recordings measures Record restart rather than gravity switching. The fake test clock advances only 1 tick each time; the next Record pauses restarted sources within onset lookahead (about 0.12 seconds), so the engine deliberately retains their starting positions and difference is 0. Now read live engine cursors directly before/after gravity switching; they must match exactly (no restart/jump). After each recording, reidentify the unique playing AlwaysOn native source; the gravity-switch-must-not-stop/restart-it check remains. Cross-recording recorded cursors must not regress or advance beyond1 tick.

Observed product behavior (unchanged, listed as a limitation): continuous sources already playing when recording starts fade out/restart at their prior position; within this recording they have only incomplete-history audit cursors, and B comparison does not carry native cursors for them. If paused again within restart onset lookahead, native content may trail the behavior playhead by up to one lookahead.

<!-- english-original-anchor --> <a id="2-941未啟用聲音裝置時暫停後永遠停在暫停產品-bug已修"></a>
## 2. 941: permanently paused after pausing without an enabled audio device (product bug, fixed)

`AudioEngine.pause()` only sets logical `paused = true` without an enabled device, but `resume()` directly executes `return false` in that case without clearing it. After `466aa828` also pauses audio on Record, this asymmetry becomes permanent: all subsequent sound stays at `SIMULATION_PAUSED` without attempting admission, the user misses immediate `AUDIO_NOT_ENABLED` feedback, and the test fails after 75 seconds. `resume()` now clears logical pause without a device and returns `false`. A new engine test fails on old code ([RED](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9e0b9b88516ea2a3f197af86e01dfe837e0c0156)) and passes after fixing; 941 passes individually in 1.4 seconds.

<!-- english-original-anchor --> <a id="3-1024測試自己的計時太緊"></a>
## 3. 1024: the test's own timing was too tight

This two-stage pipeline test was added during this handoff. Its worker-error scenario sets job timeout100 ms; under load, timeout precedes the injected error, producing `EVALUATION_TIMEOUT` instead of expected `TEST_SOLVER_FAILED`. Worker-error scenario now uses60 seconds, timeout scenario1 second; assertions unchanged.

<!-- english-original-anchor --> <a id="4-633完整測試套件中的雜湊時序競爭測試修正"></a>
## 4. 633: full-suite hashing timing race (test fix)

Individual test, whole-file, fullCPUload, and 8parallel copies pass, but complete `test:runtime` fails every time: current branch2/2, handoff `cbbe774e`2/2, main `e25f9f48`2/2passes. Full-suite bisect points to `d18e030f`, but its parent `41526a71` also fails2/2on revalidation, showing the intermediate pass was luck;[that result is rejected](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/runtime-failures-20261103/active-rule-bisect-verification.log).

A probe copy recording each publication tick/call source in the full suite found the cause ([trace](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/62fdac6ebd6e2e01d0494419f96c64b3b347c290)): memory-mode recording storage awaits WebCryptoSHA-256 (Node thread pool) for every append, then triggers publication. About31 test processes contend for the thread pool in the full suite, so hash completion varies and publication falls before or after the test's `setImmediate`; publication order in the two paths consequently differs by one slot. This is insufficient test waiting, not projection error, and predates handoff.

Treatment: test `advance` now waits for recording storage `flush()` after existing `flushRecordingEvaluation()`, so both paths finish each append publication before the next fixed tick. Compared content (full publication order, checkpoints, counts) remains. Two full-suite runs with the fix/probe copy both pass ([record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9e38a83ae8bd416005373fd44bec0db2fe6a585d)).

The second run separately fails `recording-commit-storage.test.ts` "IDB phases belong to one append": it waits only 30`setImmediate` calls for two WebCrypto hashes/transaction creation, insufficient under load. Changed to wait at most10 seconds, assertions unchanged.

<!-- english-original-anchor --> <a id="驗證"></a>
## Validation

Five modified test files plus engine tests pass85/85 ([TAP](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fdc23356c40ba1c8d76bb872720e2bbfffee2a28));`tsc --noEmit -p .`, eslint/prettier pass on changed files. check-04 (`502d2472`) complete `npm run check` has only 633remaining (2269/2270), so build/license/English checks were not reached; complete post-633-fix results are in check-05.
