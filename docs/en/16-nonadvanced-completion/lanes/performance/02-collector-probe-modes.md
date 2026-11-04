<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/02-collector-probe-modes.md","sha256":"5207e737b8d2a86d2d576107c992381fe4c9ddf8067037f81fd4e29d77ef4b29","translated_at":"2026-11-03T02:19:12.412Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/02-collector-probe-modes.md`](../../../../16-nonadvanced-completion/lanes/performance/02-collector-probe-modes.md). Source SHA-256: `5207e737b8d2a86d2d576107c992381fe4c9ddf8067037f81fd4e29d77ef4b29`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="歸因收據與同負載probe模式有限unit證據"></a>
# Attribution Receipts and Probe Modes Under the Same Load (Limited Unit Evidence)

The actual base HEAD is `e25f9f48302fd357b0f97a6f9bf8565f5916627c`. This stage changes only the performance fixture/isolated tests. It does not change the formal CLI, browser qualification, load, product budgets, or thresholds; no browser/overhead/600-second results exist yet. Preserve the original FAIL and the original formal dual-pin rejection.

<!-- english-original-anchor --> <a id="實作"></a>
## Implementation

- Acoustic raw saves the existing bounded `AudioEngine.getDiagnostics()` for each batch, retaining the baseline/warmup endpoint/final snapshot; UI saves the same diagnostics at approximately 1 Hz. Late onset, consumer stale/refusal, delivery age/refusal, voice/path drops, native output stats, and unmeasured PCM/DSP fields remain separate.
- If either handler or consumer is unmeasured, `totalDeliveryMs=null`; a measured 0 can still be summed. The original receive-entry→synchronous native-consumer envelope continues to be saved independently, without claiming browser pre-handler/OS dispatch or full LabRuntime cost.
- `window.__performanceProfileConfig.probeMode` allows only `on` (default)/`off`. off preserves the same scene, physics steps, 255 wakes, original 30-tick impulses, 8-source worker batches, consumer count, absolute 50 ms schedule, and capture/action scripts. It does not install fixture RAF/cancel, method/advance/interpolation, native-start, receive, route-state, or longtask observers, does not read physics sleep/timing probes, and disables the engine's optional diagnostics.
- off retains only minimal wall endpoints, work actions, and ending counters/results; timingStatus explicitly states `NOT_OBSERVED_PROBE_OFF`. A new runner must separately disable CDP tracing to count as fully probe-free; the original V3 entry does not read the off setting and retains its original instrumented formal method.

<!-- english-original-anchor --> <a id="實際單工命令與原失敗"></a>
## Actual Serial Commands and Original Failures

| raw | Actual Command/Result |
| --- | --- |
| attribution-red.tap | `node --test --test-concurrency=1 tests/performance-v3/attribution-fixture.spec.mjs` exit 1, 1/3 pass; unknown handler treated as 0 and diagnostics not saved: correct RED |
| attribution-green.tap | Same command exit 0, 3/3 pass |
| probe-free-red.tap | `node --test --test-concurrency=1 tests/performance-v3/probe-free-fixture.spec.mjs` exit 1, 1/3 pass; off still replaced RAF and produced proof: correct RED |
| probe-free-green.tap | Same command exit 0, 3/3 pass |
| probe-free-physics-red.tap | `node --test --test-concurrency=1 tests/performance-v3/probe-free-physics.spec.mjs` exit 1, 0/3 pass; off still read clock/sleep and returned measurements: correct RED |
| collector-focused-green.tap | Combined three-file run exit 1, 6/9 pass; the new probeMode lexical dependency was not injected into the test host, causing ReferenceError. Fixed the host without changing expectations; original error preserved |
| collector-focused-green-r2.tap | Combined three-file run exit 0, 9/9 pass |
| collector-focused-green-r3.tap | After adding actual acoustic off same-batch/consumer verification, combined three-file run exit 0, 10/10 pass, 245.7275 ms |

Final combined command: `node --test --test-concurrency=1 tests/performance-v3/attribution-fixture.spec.mjs tests/performance-v3/probe-free-fixture.spec.mjs tests/performance-v3/probe-free-physics.spec.mjs`. Root granted a serial small-test lease; it did not run concurrently with other tests/builds/browsers.

<!-- english-original-anchor --> <a id="尚未驗證"></a>
## Not Yet Verified

Original performance regression, scoped lint, build/typecheck, real browser on/off, current browser dual pins and semantic pilot, stall/event/path fixtures, hardware/device/rate/PCM capabilities, probe overhead, and full formal 600-second qualification/performance are all NOT_RUN. The table verifies only collector and load-action equivalence; it is not evidence of audio output, main-thread CPU, hardware listening impressions, or overall PERF001/014 completion. The single memory writer handles source/task/Now according to the original criteria.
