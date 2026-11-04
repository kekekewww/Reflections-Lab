<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/events/REPLAY_LIFECYCLE_FIX.md","sha256":"870078487c08c904d9c71aa8647ec467423ce845b1d125d94b13e1e2458d1780","translated_at":"2026-11-02T10:55:34.028Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/events/REPLAY_LIFECYCLE_FIX.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/events/REPLAY_LIFECYCLE_FIX.md). Source SHA-256: `870078487c08c904d9c71aa8647ec467423ce845b1d125d94b13e1e2458d1780`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="events錄放參數稽核原始缺陷與生命週期修復"></a>
# Events/record-replay parameter audit: original defects and lifecycle repairs

The two original replay probes were retested in a new production browser on a10b741/index-BmjZ1Zyf.js: **2/2 PASS**. The complete Events flow then found a separate export-busy gate. The final complete Events case for that repair passed1/1 on49bde82 (final-49bde82-01/); the original two probes and reset retain their a10 pins. This document does not claim overall V1, hearing, human input or performance acceptance.

<!-- english-original-anchor --> <a id="原始真瀏覽器結果"></a>
## Original real-browser results

An exclusive lease ran only two short probes. Recordings were prepared through the public “Audio export → Record 3 seconds” button before returning to Events. There was no HostInternal, runtime bridge or direct dispatch. The actual HTTP entry was `index-BDGeI4Sd.js`, SHA-256 `e9bbc4e496c9dfbe51a03f87f24f781caed1df166f9e2a249ebe172d4ab4e08d`. Root identified its source as 19db9f9; the working-tree HEAD, then containing unbuilt changes, was not presented as tested code.

| Control/entry | Original actual result | Root cause |
| --- | --- | --- |
| events.seek: operate the enabled timeline after a recording completes, before replay starts | End displayed “Open recording replay first”; the cursor stayed at 0. | UI canReplay already enabled the timeline, but Runtime had not created a replay cursor/audio catalog. |
| events.record: record again after playback ends naturally | “Start recording” was enabled and “End replay” absent; Enter displayed STOP_REPLAY_REQUIRED. | Host hid the replay session based on ended, while Runtime retained replayFrame, preventing the natural-completion cleanup branch. |

Both original cases FAILed. No agent POST, external request or page error occurred. stdout/process records, both original JSON files, screenshots and traces remain. An earlier complete Events run without an exclusive lease stopped at a small tick count because the product explicitly enforced fixed-step load protection. Its timeout was not misclassified as a physics-clock defect.

<!-- english-original-anchor --> <a id="修復範圍"></a>
## Repair scope

Only `src/app/runtime.ts` and `src/app/recording-host.ts` were modified, with new `tests/app/replay-lifecycle.test.ts`. UI, DSP, ReplayAudioHost, physics formulas, original reference values and tolerances were not changed, and nothing was staged/committed to Git.

- Finalized seek now validates and creates an independent catalog without a native engine, enters paused replay, then seeks. Sources resume only on explicit Run: no brief sound or re-emission of old events.
- Host retains the cursor session until shared closing for natural completion/manual ending finishes. Closing first cancels native Resume, waits for prerequisite/current operations, drains the captured engine once, then restores paused live logic, cursor and interaction lease before allowing recording again.
- New Record and Run share the recovery path that preserves source cursors; replay pose/listener data is not written into the live physics world.
- Transport generation and explicit cancellation are separate. Delayed prerequisite stops, native Resume, acoustic replies and dispose have boundary guards. Real initialization/seek errors remain visible rather than being swallowed as cancellation.
- A non-destructive clearError was added under root coordination: only the error is cleared, without clearing notice/pauseReason, unpausing or releasing a guard.

Independent read-only review first identified three races in an intermediate patch: normal open mixed into cancellation classification, reset not awaiting preview-stop prerequisites, and the timeline unpausing before native Resume. Directly corresponding negative cases were added after repair. The reviewer reread the changes and found no new confirmed correctness defect. This review did not operate a browser or replace test execution.

<!-- english-original-anchor --> <a id="目前驗證"></a>
## Current validation

- All 12 new public Runtime/Host/audio-control-graph regressions PASS. Coverage includes seek-before-play, recording after natural ending, last-frame paused seek, cancellation through pause/stop/reset/dispose, real seek/native Resume failures, delayed prerequisite reset, no timeline advancement during delayed Resume, continuous instance/cursor continuation, and clearError.
- These 12 cases plus existing replay audio/atmosphere, Runtime integration, controlled take, recording evaluation and Host review total **61/61 PASS**, run serially; see lifecycle-regression.txt.
- Integrated TypeScript and scoped ESLint/Prettier checks for five files all PASS.
- Audio tests use FakeAudioContext as a control-graph adapter. They do not claim native DSP, sound pressure/timbre or device hearing acceptance.
- Original stdout retains corrections to the initial test adapter, asynchronous closing waits, and cursor sampling baselines around pause. Product tolerances were not adjusted to obtain a pass.
- Complete commands/source hashes are in lifecycle-source-manifest.json and the corresponding stdout. Root will later provide a lease for the new production build, original two probes and complete Events audit. Unexecuted items remain NOT RUN.

<!-- english-original-anchor --> <a id="尚待完整參數重驗"></a>
## Complete parameter retest still pending

Central semantic families are events.record, events.replay, events.export, events.filter, events.seek, events.select.{eventId}, and events.table-scroll. Event selection preserves the real event.id. Read-only evidence and HelpTip entries are listed separately by source location; a row index is not a persistent ID.

The complete test is prepared: empty/recording/finalized/replay/interrupted states, actual JSON downloads, case-sensitive/insensitive search, whitespace/Unicode/object/rule/decision reasons, timeline keyboard bounds and pointer input, event evidence, HelpTip hover/focus/Escape, and retention of the previous archive during a second recording with a new run ID.

Events has no public recording-import, A/B-capture or discard-cancel control. A/B is in the Comparison panel and audited by its owner. Engine errors, a playable zero-length artifact, additional nativeRejection evidence, and real overflow/more than 200 displayed rows are marked PASS only after actual induction and interaction, never inferred from code.

<!-- english-original-anchor --> <a id="a10-production-後續收據"></a>
## Follow-up a10 production receipts

The original two probes were rerun with exclusive Chrome and public UI: 2/2 PASS in 34.2 seconds, separately saved under attempt-final-probes/. Seeking directly from a completed recording reaches paused replay, and a new recording can start directly after natural replay ending. The Reset/interrupted-save case also PASSes in attempt-final/. These receipts do not overwrite the original two 19db FAILs.

The complete finalized case first encountered a test assumption about a native range max not aligning with step: with HTML max=0.066666… and step=0.001, End's legal value is 0.066, so it cannot be required to equal the unaligned max. The test now checks within one step and verifies that the displayed physics tick equals the exported endTick; the original failure remains. Continuing the complete case then confirmed the immutable-export busy gate; see EXPORT_GATE_FINDING.md. The complete Events flow is not declared wholly passing.
The specified complete Events case on the final merged source passed1/1 in28.9 seconds; see final-49bde82-01/REPORT.md. That receipt explicitly lists conditions not induced and items not rerun in this batch. No overall V1 acceptance is inferred.
