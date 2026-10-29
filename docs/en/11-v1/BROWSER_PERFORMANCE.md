<!-- english-source: {"path":"docs/11-v1/BROWSER_PERFORMANCE.md","sha256":"568988a1d8c3cd62925907b15aafbdf38e624030bed4e820a94989950e5a98f7","translated_at":"2026-10-28T19:34:44.999Z","executor":"Codex","model_id":null,"links":"english-relative","publication_adaptation":{"kind":"mechanical_archive_link_and_source_metadata_adaptation","adapted_at":"2026-10-29T14:26:40.354Z","source_commit":"14da3d7fdcdb5dc73d69b6420238689e22f3846e","previous_source_sha256":"f411a58a49aa202befee5ef31d311c6285c95cd2f030318c3209f356c4042486","semantic_retranslation":false}} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/BROWSER_PERFORMANCE.md`](../../11-v1/BROWSER_PERFORMANCE.md). Source SHA-256: `568988a1d8c3cd62925907b15aafbdf38e624030bed4e820a94989950e5a98f7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->


<!-- english-original-anchor --> <a id="瀏覽器效能量測"></a>
# Browser Performance Measurement

<!-- english-original-anchor --> <a id="r17-c4完整600秒資料性能與持續負載未通過"></a>
## R17 C4: complete 600-second data; performance and sustained workload did not pass

[The actual receipt](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/f84b1a3ece40bc2fda71efb459380829a42c37f1) corresponds to product Git `cde1e2b0ed7c57228bfa64b01c262b6eeab3cba1`. Process exit0 and source/bundle/executable consistency were verified. UI raw spans 600051.100ms and 19498frames; trace markers span 600051.182ms, with 5201280events and 96816437bytes gzip. Native qualification and collection membership passed; no trace loss was recorded. This only confirms interpretable data. The native evidence's historical `formalQualification: NOT_APPROVED` field remains; it is not rewritten as performance approval.

Physics workload was valid across 3000 samples; native step p95 was about 4.8ms, FAIL against the original 2ms target. Default/stress worker p95 was about 46.3/27.1ms; observed delivery from reception entry to actual native consumers was about 12.4/28.7ms, FAIL against the original target. This interval still excludes browser pre-handler/OS dispatch and LabRuntime-specific bookkeeping; full delivery remains UNVERIFIED. Default/stress deadline misses were 130/226, with 170 stress measured path drops. Average Hz or a maximum 256paths does not establish passed sustained workload.

UI renderer-main wall occupancy p95 was about 83.23ms, FAIL against the original 4ms target; it is not CPU time. Raw data includes safe-overload pauses, 106.117 seconds of interactive dropped wall time, 1222overruns, 1653paused advances, invalid warmup workload and incomplete final capture. Script/runtime/recorder were all pending at the end. `ui.finish-tail.raw.json` later drained successfully, but the original 600-second window's pending/capture judgments remain failed. The first two recordings contain 7/8 consecutive frames without dropped recording ticks; this does not imply continuous 60Hz.

Negative measurement evidence is separate from budget PASS; original targets, workload and method remain. Audio uses a muted native graph; actual Worklet deadline/underrun/human perception remain unverified. Raw data, trace and individual clocks are in the same artifact directory.


<!-- english-original-anchor --> <a id="r16-維護入口與閉窗資料保存"></a>
## R16 maintained entry point and closed-window data preservation

The maintained entry point is the following V3 command. A new output directory is required each time; the specified Chrome version and executable hash must still satisfy the runner's original qualification checks.

```powershell
$out = 'artifacts/v1/performance-v3-' + (Get-Date -Format yyyyMMdd-HHmmss)
node tests/browser/run-performance-v3.mjs --formal-600 --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe' --output $out
```

For a short run, `--phase ui --seconds 20` may replace `--formal-600`; it validates collection and finalization only, not the complete 600-second workload. Original V2 commands and failure results remain below; original acceptance, workload, numerical kernel and thresholds are unchanged.

R16 first closes the original measurement window and saves `ui.raw.json`, `pendingAtEnd` and original timestamps, then drains under a shared maximum 135-second deadline. Out-of-window actions, recording completion and errors are saved separately in `ui.finish-tail.raw.json` and must not be backfilled into the original window. Even if finalization fails, native trace saving is attempted with a bound; multiple failure cause trees are saved in bounded form, with truncation explicit. Native longtask attribution is converted to savable JSON during collection; other raw data continues to use an original-precision detached clone.

The actual [R16 UI short run](../../../artifacts/v1/r16-short-ui-repaired-20261029/native/verification.json) saved about 20 seconds of raw, tail and trace, with stable source and bundle and clean cleanup. Its status was `MEASURED_WITH_INCOMPLETE_UI_WORKLOAD`: pause, recording overload, grab/throw and capture conditions were incomplete, and performance targets also failed. Process exit 0 means collection completed, not formal performance PASS.

The prior [C2 formal long run](../../../artifacts/v1/r15-formal-c2-20261028/native/verification.json) five-second drain failure and [R16 first short run](../../../artifacts/v1/r16-short-quiescence-20261029/native/verification.json) native attribution clone failure are retained. The former lacks UI raw/trace; the latter saved tail/trace but lacks UI raw. Missing original data is not reconstructed.

<!-- english-original-anchor --> <a id="2026-10-28正式結果fail負載不完整"></a>
## 2026-10-28 Formal Results: FAIL/Incomplete Workload

The [operational summary for this round](../../../artifacts/v1/browser-performance-20261027T183039817Z/operational-summary.json) and [r10 interpretation](SESSION_PROGRESS_20261028-r10.md) are archived. The actual 628.935 seconds/31295 frames, native/.NET exit0, unchanged hashes for 1789 sources before and after, and cleanup of owned processes and port 5191 all have evidence; these do not establish a performance pass.

- The Physics workload was valid, but core p95 2.2ms missed the original target of less than 2ms: FAIL; complete tick including copies p95 12.5ms is listed separately.
- Default/stress delivery p95 3.9/14.4ms missed the original target of less than 1ms: FAIL; there were default 6/stress 31 deadline misses, stress paths ranged from 254–256 with 95 measured drops, and 20Hz and configured capacity were not fully maintained.
- UI RAF p95 17ms and allRAF CPU p95 18.9ms did not meet the original thresholds; safe-overload pauses, 201 overruns, and 14.483 seconds of wall-time drop were included, so this cannot be called a continuous 600-second valid dynamic workload.
- The trace had no CDP data loss, and all sample ID/finite/in-window checks passed; 106 raw native RAF timestamps were slightly greater than raw callback performance.now(), and the original membership FALSE made main occupancy NOT RUN. No epsilon was added, no rebinning was performed, and the original result was not upgraded. The final stop/persist duration of 47.885 seconds is not attributed to unmeasured CPU/I/O components.
- The original first formal run, smoke runs, all failures, and raw data from the new run are retained; the initial TARGET values are separate from the overall closure policy, and the complete V1 is unfinished. Numerical authority remains [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md).

<!-- english-original-anchor --> <a id="可重現入口與固定方法"></a>
## Reproducible Entry Point and Fixed Method

The following command and method do not guarantee a pass; each actual result is saved in a new artifact.

```powershell
node tests/browser/performance-profile.mjs --phase all --seconds 600
```

Before execution, stop other heavy browser/build/benchmark workloads and freeze the sources. The runner builds its own `test-results/performance-dist` and uses localhost 5191; it does not use development HMR or call models. Each run writes to its own `artifacts/v1/browser-performance-<UTC>`, retaining build stdout/stderr, source and bundle hashes, hardware/actual GPU/browser/viewport, raw samples, console/errors, and compressed CDP trace. `--seconds 10` is only a smoke run and cannot pass the 10-minute gate; `--prepare` only builds and does not run measurements.

- Physics: 256 primitives (1 Fixed, 255 Dynamic), including 64 with CCD; fixed 60 Hz, measured after 240 warmup steps in real WASM. Every 30 steps, a bounded, replayable small impulse is applied to all Dynamic bodies to keep them awake. Native Rapier `world.step` and the complete public step, including contact copying/snapshots, are recorded separately; awake/contact pair/event counts are retained for each step, and workload is assessed from the measured distribution. Four-step catch-up and dropped wall time are also validated.
- Worker: a real module Worker, 8 sources, and 32 finite convex surfaces (a 30-sided room plus floor and ceiling), updated serially every 50ms using an absolute clock, with seven Synthetic bands. Only the actual first-order capability is claimed. First measure the product defaults (at most 8 paths per voice/the engine's default total cap), then measure the explicitly specified stress configuration of 256 total paths/32 paths per voice. The two results remain separate; the stress configuration must not be presented as product-default capacity. Each batch records worker CPU, round trip, service handler, actual native AudioEngine consumer, total delivery, native start recorded only after success, admission, active paths/voices/context clock, drops, and 20Hz deadline misses. Without the complete specified workload, the corresponding timing cannot be claimed as PASS.
- UI: production bootstrap/React/R3F/LabRuntime, 100 Dynamic bodies plus the original room and speaker, 1920×1080 CSS px/DPR1, and 10 seconds of warmup. The script toggles the workspace, selection, and Raw/Simulated through public runtime actions, and applies finite impulses, grabs, and throws through the public PhysicsWorld API; these are replayable measurement inputs and are not presented as user keyboard/mouse E2E. A 1-second capture is recorded at seconds 10, 300, and 580, covering early/mid/late state; total storage is kept within the established local budget, and synchronous capture cost is recorded separately. A short smoke run records once at second 1 and does not count as a formal gate.
- The union of renderer-main RunTask wall spans containing markers in the complete 600-second CDP trace is partitioned by native RAF intervals, covering React/layout/paint/GC. This is a conservative upper bound on main-thread wall occupancy, not thread CPU `tdur`. Separate components for RAF callback, advance, getPose, interpolation, and bridge/capture are also retained; internal `fixedStep` timing is not presented as a complete tick including the subsequent runtime bridge. The complete main-thread gate cannot PASS if the trace has data loss, lacks markers, has changed sources, lasts less than 600 seconds, has truncated samples, contains operation errors, is interrupted during computation, or has incomplete grab/throw or capture coverage. CDP and method wrappers add measurement overhead; results apply only to this local instrumented setup.

The actual native Web Audio graph remains muted; sample rate/latency/voice/path/drop counts come from native telemetry. There is no evidence of actual Worklet render deadlines/underruns, headphone listening tests, or SPL calibration, so the corresponding items remain **NOT RUN**. Short microbenchmarks or the existence of a Native Node graph do not establish that audio callback/hardware quality has passed.
