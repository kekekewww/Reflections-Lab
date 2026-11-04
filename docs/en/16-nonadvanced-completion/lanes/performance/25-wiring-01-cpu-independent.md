<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/25-wiring-01-cpu-independent.md","sha256":"24d3a7f2a08785b6639a2934b641f313331247b0616cc97f7c10bbbdef6067f4","translated_at":"2026-11-03T09:57:53.243Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/25-wiring-01-cpu-independent.md`](../../../../16-nonadvanced-completion/lanes/performance/25-wiring-01-cpu-independent.md). Source SHA-256: `24d3a7f2a08785b6639a2934b641f313331247b0616cc97f7c10bbbdef6067f4`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="wiring-01-cpu-原始證據獨立複核"></a>
# Wiring-01 CPU raw-evidence independent review

This probe-on/reference/levels/master-left wiring actually ran the Win32 helper on pinned source `6ba01b44b57a4741a7e58fb42718e71875b776f3`. **Both endpoints captured successfully, but overall CPU coverage is incomplete, total/ratio remain null; not formally qualified or overhead/DSP/hardware PASS.** Complete raw values, source pins/review scope are in [JSON](../../../../16-nonadvanced-completion/lanes/performance/25-wiring-01-cpu-independent.json).

Author only read existing JSON, requests/file hashes and recalculated with PowerShell integer arithmetic; no Node tests, Win32reader, browser, native workload or source implementation. Author previously implemented the original helper, disclosed here; a fresh `wiring01_cpu_raw_audit` task separately reread raw evidence to check per-row arithmetic, sets, times/hashes. Review covers rawCPUreceipts, not overall acceptance rerun.

<!-- english-original-anchor --> <a id="實際結果"></a>
## Actual results

Original wrapper `process.json`: childexit0, 164011.1264 ms,`process_stopped=true`,`stop_scope=direct_process`, treestatusnull. `verification.json` remains `MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD`,`formalQualified=false`,`formalQualification=NOT_APPROVED`,`formal600Run=false`; completion of 20-second diagnostics does not replace original acoustic workload gate.

Before has 8PID/types; after retains those 8 and adds `33516 | tracing.mojom.TracingService`, creationFILETIME `134381491501101454`. Endpoint CDP, physical request files, embedded requests/Win32 replies have identical sets. All17Win32 rows have strict boolean true for open/query/close, and null for all three error codes; both helpersexit0, empty stderr, no timeout/cancel/outputcap.

Creation strings match exactly for 8commonPIDs; BigInt separately subtracts kernel/user then adds them. Per-row ticks/seconds exactly match original OSsummary:

| PID | type | Same creation FILETIME | OS delta ticks | OS CPU seconds |
| --- | --- | --- | ---: | ---: |
| 54676 | audio.mojom. AudioService | 134381490641243149 | 625000 | 0.0625 |
| 69272 | renderer | 134381490232459173 | 0 | 0 |
| 74496 | renderer | 134381490232958037 | 0 | 0 |
| 78244 | GPU | 134381490230644297 | 46718750 | 4.671875 |
| 78952 | network.mojom. NetworkService | 134381490230747646 | 0 | 0 |
| 85208 | storage.mojom. StorageService | 134381490231157579 | 0 | 0 |
| 85828 | browser | 134381490226938490 | 3437500 | 0.34375 |
| 86724 | renderer | 134381490233047843 | 288906250 | 28.890625 |

These are CPU across all threads of each complete process. **AudioService's0.0625 seconds is not native graph DSP; renderer native graph threads are not separated. Do not subtract AudioServiceCPU from rendererCPU to infer main-threadCPU.** Successful queries with identical creation/actual zero deltas retain zero; new TracingService has no before endpoint, so intervaldelta remains null.

Both summaries correctly retain `PARTIAL_PROCESS_COVERAGE`,`completeCoverage=false`: OSreason `PROCESS_SET_IDENTITY_OR_COUNTER_CHANGED`, CDP `PROCESS_ENDPOINT_IDENTITY_SET_CHANGED`; both canonicaltotal/ratio are null. Surviving subsets are not summed as whole-browserCPU. CDP rows also match subtraction of their raw counters, but counter implementation/resolution/sequential brackets differ; do not force equality with Win32 or infer DSP/probe costs from differences.

<!-- english-original-anchor --> <a id="時間與原始資料"></a>
## Timing and raw data

Original browser window `20179.099999999627 ms`. Actual CDP completion-to-completion denominator `22809.280500000023 ms`, min/maxsamplinginterval `22803.080000000016 / 22811.597800000018 ms`. Win32OSdenominator `23034.858200000017 ms`, min/max `21973.23940000002 / 23863.149200000014 ms`. All recalculate consistently from actual Node monotonic brackets, without substituting fixed20or600 seconds.

Before OS completes before beginRPC starts; after CDP/OS start only after closeRPC completes. Includes tracingstart, begin/closecontrol/sharedendpointcost, excludes diskcheckpoint, tail/traceflush. CDP/OS exceeding browserwindow by `2630.180500000395 / 2855.7582000003895 ms` supports only duration differences, not probe overhead/benefits; this run has no matched-condition probe-off comparison.

Before/after helper process durations `804.4566999999806 / 1032.1988000000129 ms` are not their CPUtimes. Both physical request bytes exactly match recorded requestJson, SHA/before-after pins match; recalculated SHA of UTF-8rawstdout retainingCRLF also matches:

| Raw data | SHA256 |
| --- | --- |
| native/verification.json | `54bd0ad185a6be4f25acbccd4c8a2b6f7c4fc9268af4265205505ec8570bec7e` |
| before request | `f2056cd7c389113dc0462229c98822d09e55d13f125bf127996b6506bab644bc` |
| after request | `f5eca729f2fd78e711ee640f818f67ed40f0a03684e368c17662224769fc71d3` |
| before raw stdout | `47b7a17641acc5df106999310f62b4c688e2b7c18b4fbecd272f2ce9ea7322fd` |
| after raw stdout | `d8ba3b7214cdd560cfa70e846a67fc3deb399235c544efe240777701f0cf73b7` |

Pinned helper `596679bd1aaccf9c6b839b9cead0ed4d83c3cde930b4e7c1e37d4ccf1e505784`/7363 bytes; PowerShellexecutable `60c9b29843624dd8af6b6a7b26147753be6aeef65098b9a503cc50850afe410f`/495616 bytes, both endpoints' before/after pins/current files match. `v1.0` is part of executable path, not a measured version. Chrome 156.0.8078.75, revision `861389936bf33ea77529ee5dcc0605e68f6bb620`, executable `7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa` also matches original before/after pins/current file.

<!-- english-original-anchor --> <a id="來源集合與限制"></a>
## Source sets and limits

Exact set difference of 375uniquepins in [dispatch receipt24](../../../../16-nonadvanced-completion/lanes/performance/24-v4-wiring-01-source-pins.json) against374uniquepins in `verification.sourceInputs` contains only extra registration file `tests/integration/performance-v4-method.test.mjs` (534 bytes, SHA `64ad8e3ab51b7b7957e7f79b7be4930be87a787b0df783e1fe35922073a472e7`). Native-only set is empty, 374common hashes all match. build-manifest.inputs374 and native374have identical complete sets/hashes. command.source 59, wrapperbefore/after 59are identical-hash subsets; each layer's scope is recorded separately without forcing counts together.

Source/bundle stability are original run-receipt observations; this review recalculates current hashes only for five CPU-related producers/two executables, not all 375 files. Original cleanup records browserdisconnected, CPUhelperreleasable, previewchildstopped, independent boundedTCPprobeECONNREFUSED; wrapperoutcome machineLeaseReleasable=true. No new process/port query this review; lease release follows parent agent's original record.

`nativeDspCpuMs`,`hardwareUnderruns` remain null; native hardware block, deadline, PCMcontinuity, listening/formal 600 seconds are not established by these CPUreceipts. Original acousticfailure, all qualifications/thresholds remain; endpoint success is not upgraded to CPUcoverage/overhead/DSP/hardware/V1 PASS. Reports18, 22, 24/rawartifacts are unchanged.
