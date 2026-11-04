<!-- english-source: {"path":"docs/14-core-pipeline/stages/01-recording.md","sha256":"24fafd921228e7ecda9c9faf85c6bcc5e1903e689fb520e6aa92411a145e9c84","translated_at":"2026-11-02T05:31:33.4675024+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/01-recording.md`](../../../14-core-pipeline/stages/01-recording.md). Source SHA-256: `24fafd921228e7ecda9c9faf85c6bcc5e1903e689fb520e6aa92411a145e9c84`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="階段-01有界錄製評估與-ab-重算核心"></a>
# Stage 01: bounded recording evaluation and A/B recomputation core

Date: 2026-11-02 (Taipei). Implementation baseline: `429efb7597ec913bd879ecc05c29a6be7ad5175c`; branch: `codex/pipeline-recording`. Executor: Codex recording_core; the evaluation_test_design subagent performed isolated testing and adversarial checks. This is stage-specific engineering evidence, not closure of full V1, performance gates or device-hearing tests.

<!-- english-original-anchor --> <a id="已實作"></a>
## Implemented

- `RecordingEvaluationLane` admits complete, immutable same-tick frame and AcousticRequest snapshots, preserving contiguous ticks, epoch, revision, event ordering, Behavior pre/post-state and source cursors. A result is submitted to the recorder only after the same-tick solver result passes schema/identity checks.
- The queue defaults to at most 8 frames and 32 MiB of reserved capacity, including in-flight entries, input bytes and bounded reply capacity. At the high-water mark, pause the producer on an accepted-tick boundary; allow continuation only after reaching the low-water mark. If a single input or the next entry cannot fit, explicitly interrupt without dropping accepted entries or claiming a complete recording. This is not a total-JS-heap, GC-transient-allocation or zero-copy guarantee.
- A dedicated module Worker performs recording acoustic solving and stateful `RecordingProcessor` A/B recomputation. Acoustic formulas, quality parameters, recording format, canonical fingerprints and the existing sealing Worker remain unchanged.
- When a Worker is unavailable or `useWorker:false`, yield to the event loop for every frame, then compute with the original solver/processor. Both Worker and reference paths have a default 10-second job timeout and cancellation. A timer cannot preempt synchronous JS; the reference path does not establish Worker isolation or real-time performance.
- stop/capture A first stops admission, drains accepted frames and finally publishes through the existing seal/verify/persist path. Previously accepted results may still commit while paused, without resuming the world, audio or user interaction.
- Worker errors, timeout, cancellation, capacity or sink errors explicitly interrupt recording. Preserve the last complete committed prefix without publishing a false Captured state; retain existing valid artifacts and A/B slots. Late replies must not contaminate the next recording generation.
- B recomputation has an asynchronous yield point per frame. Cancellation never publishes a partial B. The original processor's pre-state, native-cursor, phase and fixed-condition validation remain effective.
- Fixed premature continuation that skipped ticks, as actually reproduced in independent review: verify that the recorder can resume before advancing world/interaction/behavior clocks, and keep the world paused when backpressure rejects resumption.

<!-- english-original-anchor --> <a id="整合-api"></a>
## Integration API

| API | Semantics |
| --- | --- |
| `RecordingHost.appendEvaluationFrame(frame, requests)` | Takes ownership of input, evaluates and commits tick by tick in the background; does not use live preview's latest-only policy. |
| `RecordingHost.flushEvaluation()` | Waits for the accepted watermark at call time; does not close admission, seal or alter pause state. A controlled short take can await it after advancing each step. |
| `LabRuntime.flushRecordingEvaluation()` | Public integration/test entry for the barrier above; not a user action or simulation resume. |
| `RecordingHost.assertEvaluationReady()` | Pressure/failure guard before resuming any producer clock. |
| `RecordingHost.getEvaluationTelemetry()` | Accepted/committed ticks, counts, pending slots, reserved/peak bytes, pressure and failure state. |
| `RecordingEvaluationClient.capture()`/`reprocess()` | One in-flight job, with reply identity, capacity, cancellation, timeout and generation isolation. |
| `RecordingHost.stop()`/`captureComparison("A")` | Publication barrier: drain first, then seal. |

Runtime changes are limited to evaluation-client initialization, Host callbacks, the recording branch of `onTick`, reprocessing, resume guards, flushing and disposal. Geometry-input preparation and immutable cloning remain in the producer. The moved work is solving and the B evaluator, not the entire physics/audio runtime.

<!-- english-original-anchor --> <a id="基本驗證"></a>
## Basic validation

- The initial new lane/client/host and existing host/processor run passed 51/51; reference-stalled-scheduler and real-Rapier editor/FPS-alternative resume regressions were added afterward.
- Final new-core and related app/recording regressions total **153/153 PASS, 0 fail**. `tsc --noEmit` and ESLint for this stage's changed code/tests both exited 0.
- Existing tests that produced recording ticks in tight loops now wait for the actual evaluation watermark, preserving their original cooldown, contact, phase, complete-publication, A/B and 30-contiguous-tick data assertions.
- Final commands and results are in the [machine-readable receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4cfefa22b32e9218fc301d262d874a4cddc79780). Original failures and repair provenance are in the [failure record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/37e269f5b5bf6d33499ef8cc75f17d3629134097). This stage separately confirmed types, ESLint and Prettier.
- Real module-Worker browser transport, integrated short takes/Motion/offline audio output, performance benchmarks and computer-use are performed in main integration; this branch has not run them.

<!-- english-original-anchor --> <a id="給-claude-code-的重驗重點"></a>
## Claude Code revalidation priorities

1. Rerun the new tests and full runtime regressions, then validate module-Worker transport in a normal product bundle. Fake-port tests are not actual browser-Worker evidence.
2. Exercise recording, pause, stop and A/B. Check pressure messages and user-pause rules; low-water status must not automatically override an Esc/blur pause.
3. Gate ordinary RAF for a controlled take, advance fixed steps individually and flush after each one. Retain source/bundle/browser, tick range and artifact hash.
4. Producer/worker/commit cost improvements are not quantified yet. Retain original 600-second FAIL/UNVERIFIED results, formal performance thresholds and failure evidence.

No packages, paid APIs, cloud services, recording-schema migration or acoustic-formula changes were added. The root agent sequentially maintains Wiki/English and final main integration.
