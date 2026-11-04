<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/18-process-cpu-source-method.md","sha256":"28d4c738e0aedab43049ce5654dc0772be9e67aaeed88e82769b62fb0e4285b1","translated_at":"2026-11-03T02:49:45.468Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/18-process-cpu-source-method.md`](../../../../16-nonadvanced-completion/lanes/performance/18-process-cpu-source-method.md). Source SHA-256: `28d4c738e0aedab43049ce5654dc0772be9e67aaeed88e82769b62fb0e4285b1`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="process-cpu-端點方法來源與有限測試準備"></a>
# Process CPU Endpoint Method: Source and Bounded Test Preparation

This round is SOURCE_METHOD_AND_TESTS_AUTHORED_NOT_MEASURED. A new pure summarizer and bounded negative cases were authored; no local process CPU was queried and no browser/Node/test/build was started. Parent actually ran the initial missing-functionality RED: 1 missing-export FAIL and 74 explicitly SKIPPED behavioral cases out of 75. Parent performs subsequent GREEN, formatting, and actual measurement; this report does not claim a pass.

Under experiment-validation and test-first rules, formal 600 seconds, original load/thresholds, original failures, and frozen sources remain unchanged. See the same-named JSON for pinned revisions, URLs, bytes, SHAs, line numbers, and research time for all 10 sources; only this report's own paraphrases and source identities are retained, without repository copies of official full texts.

<!-- english-original-anchor --> <a id="cpu-語義與零值陷阱"></a>
## CPU Semantics and Zero-Value Trap

SystemInfo.getProcessInfo at pinned Chromium revision 861389936bf33ea77529ee5dcc0605e68f6bb620 returns a processInfo array with id, type, and cpuTime per entry. cpuTime is cumulative seconds across all threads since process start; multicore totals can exceed elapsed wall time, so ratio must not be capped at 1. [Official schema](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/public/devtools_protocol/domains/SystemInfo.pdl#93), [CPU API contract](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/process/process_metrics.h#175)

A key limit is that the handler substitutes zero TimeDelta for a failed native CPU query, then emits seconds without a validity flag. A cumulative endpoint of 0 may therefore be query failure, not observed idle CPU. The new version marks such endpoints UNVERIFIED, leaving total/ratio null; only equal positive cumulative values (such as 3→3) retain a 0 delta at API resolution, without claiming the hardware did no work. [Pinned handler](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/content/browser/devtools/protocol/system_info_handler.cc#325)

The Windows producer may use calibrated QueryProcessCycleTime/TSC or fall back to kernel+user GetProcessTimes. This round did not probe the branch taken or actual precision on this machine; source defaults do not establish successful measurement. [Windows implementation](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/process/process_metrics_win.cc#183)

<!-- english-original-anchor --> <a id="新版純摘要器契約"></a>
## New Pure Summarizer Contract

summarizeProcessCpuDeltaV4 in performance-process-cpu-v4.mjs handles only two raw responses, caller-measured monotonic wallMilliseconds, and explicit scope. Each endpoint has at most 1024 processes; the entire PID set must be unique with matching types before/after, and valid, nonzero, nonreset CPU counters. Only complete data permits summing delta seconds and dividing by actual wall seconds. There is no fixed 600-second denominator or filtering of bad values to portray a smaller subtotal as complete CPU.

New/disappearing processes, type changes, duplicate PIDs, missing fields, nonfinite values, counter reset, ambiguous zero endpoints, exceeded caps, and nonfinite derived values all retain unknown total/ratio. A measured zero delta from positive counters stays 0. nativeDspCpuMs and hardwareUnderruns are always null; this does not measure native DSP callbacks or hardware underruns.

completeCoverage means only that the two endpoint sets reconcile. The protocol has no creation epoch, fixed sampling interval, or complete process lifecycle; matching PID/type cannot prove no PID reuse or short-lived processes within the window. Sequential reads/transmission are also not a simultaneous whole-system snapshot. This method cannot claim lossless CPU coverage.

Actual on/off comparisons must use the same two shared browser endpoints, before trace setup and after collection closes its window but before tail/drain, explicitly listing Node monotonic interval and IPC/setup boundary error; normal product top-row 15 Hz sampling remains. off gains no page CDP trace, per-callback observation, or extra diagnostics from this. These connections still require parent source freeze and exclusive actual execution; this round has no probe-overhead values.

Existing cpuDifference at performance-audio-runner-v1.mjs line 48 accepts finite zero counters and retains matched subtotal under partial coverage. This only exposes source limitations; it changes no old raw or retroactively assigns PASS. Old consumers must not treat subtotal as overall CPU, or a 0 lacking validity evidence as actual 0.

<!-- english-original-anchor --> <a id="後續-windows-owned-pid-reader-的來源可行性"></a>
## Source Feasibility of a Future Windows Owned-PID Reader

Official .NET runtime v10.0.0 source is pinned to 60629d14374c56f1cb51819049ad1fa529307f8d; it is reference implementation, not the locally installed version. For another process's TotalProcessorTime, invalid handle/GetProcessTimes failure throws rather than returning false 0; the native call itself has BOOL, SetLastError, and creation/kernel/user outputs. [Process. Windows](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/Process.Windows.cs#L695), [Interop](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/Common/src/Interop/Windows/Kernel32/Interop.GetProcessTimes.cs#L11)

Two further limits: StartTime is cached in the Process object and Refresh does not clear it, so rereading the same object is not a fresh identity bracket; GetProcessById failure can enumerate system-wide PIDs, so Get-Process -Id/GetProcessById alone cannot guarantee reading only an owned whitelist. [StartTime/Refresh](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/Process.cs#L199), [ProcessManager fallback](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/ProcessManager.Windows.cs#L29)

A future separately versioned candidate should accept only an owned PID/type whitelist already returned by CDP, directly OpenProcess (QUERY_LIMITED_INFORMATION) for each PID, obtain creation+kernel+user in one GetProcessTimes call on the same handle, then CloseHandle; reconcile creation FILETIME before/after, keeping success flags/error codes/tick strings separate. Hidden helper, timeout, input/output limits, and raw values must all be pinned. This reader is currently only SOURCE_PROPOSAL_NOT_IMPLEMENTED_NOT_RUN, is not mixed into this round's CDP format, and does not establish hardware/listening/DSP/formal 600-second success.
