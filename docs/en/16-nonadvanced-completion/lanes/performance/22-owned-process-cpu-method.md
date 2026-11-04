<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/22-owned-process-cpu-method.md","sha256":"e6e830bcfb86ca616a47d42e3ed21bcbd63b715ceb04223fc986a4f56c453262","translated_at":"2026-11-03T02:49:45.545Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/22-owned-process-cpu-method.md`](../../../../16-nonadvanced-completion/lanes/performance/22-owned-process-cpu-method.md). Source SHA-256: `e6e830bcfb86ca616a47d42e3ed21bcbd63b715ceb04223fc986a4f56c453262`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="owned-pid-win32-cpu-方法來源與邊界v4"></a>
# Owned-PID Win32 CPU Method Sources and Boundaries (V4)

Status: source implemented, with pure-unit evidence already obtained by parent; **native Win32 reader and formal 600-second measurement have not run**. This document adopts no new formal qualification and does not backfill existing failures. See [JSON](../../../../16-nonadvanced-completion/lanes/performance/22-owned-process-cpu-method.json) for full versions, source hashes, and execution receipts. The original [report 18 on CDP sources](18-process-cpu-source-method.md) remains a historical version.

This method addresses Chromium CDP's limitation of converting native-query failure to cumulative zero without a validity bit. CDP supplies only this owned browser's PID/type whitelist; the new fixed helper directly calls `OpenProcess(0x1000, false, pid)` for each whitelisted entry, then obtains creation, kernel, and user in one `GetProcessTimes` call using that same handle, closing it in `finally`. Only an actually successful BOOL is accepted; a successful zero CPU counter may remain zero, while failure does not imply zero. No `Get-Process`, `GetProcessById`, system-wide enumeration, or elevated privileges.

<!-- english-original-anchor --> <a id="官方來源與數值意義"></a>
## Official Sources and Numerical Meaning

At `2026-11-03T02:16:36Z`, an independent source agent obtained six official Learn documents and pinned raw sources over normal TLS, all HTTP 200; only metadata and short summaries were recorded, without adding full texts or binaries to the project.

| Source | Pinned Source Version | raw SHA256 |
| --- | --- | --- |
| [OpenProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | `656e9656bfae`；L69-103 | `7201ba3494356422dfd75d102c601ef9d74ab57784de84c9acfbd07f71fdc427` |
| [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | `656e9656bfae`；L71-108 | `4c62c27d32b5e0e442d7b41e62247a88fe7c2b2632fbbcdd241c86ff24e1f460` |
| [GetLastError](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror) | `656e9656bfae`；L60-76 | `3b1a3e82d3c279de81eafe42143941930fbc6d7650e6b26bd9ae898ff585b91f` |
| [CloseHandle](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle) | `656e9656bfae`；L67-108 | `c0cd1b25e7d35a8f4fb020cfba13b9ee5b3643a332e7c1f592b507746e1e794b` |
| [FILETIME](https://learn.microsoft.com/en-us/windows/win32/api/minwinbase/ns-minwinbase-filetime) | `656e9656bfae`；L57-78 | `e89d88d9727e59bd8cd3131dd9feb83956ca9e7e6e83f7e676dd40b04ccf6ecf` |
| [Process security and access rights](https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights) | `ca8274decead`；L39-44 | `4074adbc739dc190736def83b30bb7f54fb454c7f52bf878cb6915778a4dd86f` |

[GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) kernel/user values are cumulative CPU across all threads; 100 ns is the unit, not a resolution guarantee. Creation FILETIME and CPU ticks are preserved as unsigned 64-bit decimal strings to avoid prior JavaScript Number rounding. Subtract each kernel/user value separately using BigInt, verify neither regresses, then sum and convert to seconds:

`CPU seconds = Σ[(userAfter − userBefore) + (kernelAfter − kernelBefore)] / 10,000,000`

`CPU/wall = CPU seconds / (actual monotonic wall milliseconds / 1,000)`

CPU/wall may exceed one due to multiple threads. The denominator must come from the same actual boundary procedure in both arms, not a formal 600-second constant. Creation strings must match exactly; two distinct FILETIMEs that round to the same Number are not the same process. Paired before must finish at or before after begins; request hashes before/after must also match, and summary cannot revive a capture already rejected by the producer as OBSERVED.

<!-- english-original-anchor --> <a id="程序與證據邊界"></a>
## Process and Evidence Boundaries

The PID whitelist allows at most 1024 entries, preserving the existing observation cap without truncating totals. The fixed `.ps1` accepts only a newly created `wx` JSON request-file path; it does not put JSON on the command line or use `-Command`, `-EncodedCommand`, or `ExecutionPolicy Bypass`. Existing runner uses `shell:false`, `windowsHide:true`, a 256 KiB request cap, 1 MiB total-output cap, and 5000 ms stop watchdog. The watchdog marks when stopping begins; existing taskkill and close-proof waits may add 2500 ms and 3000 ms, so a complete receipt is not guaranteed within five seconds.

Each endpoint saves request/raw-stdout hashes, before/after hashes of the fixed helper and chosen PowerShell executable, actual monotonic-clock brackets, and complete runner-termination fields. Until an executable is selected for actual measurement, version/path remain unknown. Timeout, cancellation, or output-cap overflow permits `helperLeaseReleasable=true` only with actual process-tree stop evidence. Normal helper closure proves only that owned helper closed, not cleanup of the entire machine, browser, or all handles. Win32 API/file-integrity failures retain original errors and null totals.

If PID/type sets, creation identity, any API-success flag, source/executable/request integrity, CPU counters, or representable values fail validation, canonical total/ratio are null. A surviving subset cannot be totaled as the entire browser's CPU. Matching endpoint sets still cannot prove there were no short-lived processes between them; CDP and later OS open are not one atomic observation.

These values cover only processes listed by CDP, excluding external PowerShell/Node CPU. Cold startup, Add-Type, IPC, and sample ordering have costs; helper wall duration/brackets are saved and cannot establish zero probe overhead. `nativeDspCpuMs` and `hardwareUnderruns` remain null.

<!-- english-original-anchor --> <a id="已讀證據與未執行項目"></a>
## Evidence Read and Items Not Executed

The author only wrote/read sources and receipts, without running Node tests, PowerShell script, OS queries, or browser. Parent ran the following unit command, whose actual TAP was read for this document: `node --test --test-concurrency=1 tests/performance-v3/process-times-v4.spec.mjs`.

| Receipt | Actual Result | Supported Scope |
| --- | --- | --- |
| [Initial RED](../../../../16-nonadvanced-completion/lanes/performance/process-times-v4-red-r1.tap) | 135: 1 FAIL, 134 SKIP, exit 1 | Missing export; skipped cases are not behavioral evidence |
| [Initial GREEN](../../../../16-nonadvanced-completion/lanes/performance/process-times-v4-green-r1.tap) | 138 PASS, exit 0 | Unit behavior of literal DTOs, injected runner, and controlled temporary files |
| [Integrity RED](../../../../16-nonadvanced-completion/lanes/performance/process-times-v4-integrity-red-r1.tap) | 141: 138 PASS, 3 FAIL, exit 1 | Actually exposes reversed/overlapping endpoints and summary reviving a mutated-request capture |
| [Final focused GREEN](../../../../16-nonadvanced-completion/lanes/performance/formal-v4-final-focused-r1.tap) | 611 PASS, 0 FAIL, 0 SKIP, parent-reported exit 0; 6255.2786 ms | Includes all 141 OS-reader and 76 CDP CPU unit cases; native helper still not executed |

The 138-case fixture preimage and added positive-environment field `requestAfterSha256` have a preserved [version receipt](../../../../16-nonadvanced-completion/lanes/performance/process-times-fixture-v1-before-afterhash.json) and [original bytes](../../../../16-nonadvanced-completion/lanes/performance/process-times-fixture-v1-before-afterhash.test.txt). Original assertions were neither removed nor relaxed. Final focused TAP was actually read as 611 PASS, 0 FAIL, 0 SKIP; all three new integrity negatives now pass. Parent's [format r1](../../../../16-nonadvanced-completion/lanes/performance/formal-v4-format-r1.txt) and [format r2](../../../../16-nonadvanced-completion/lanes/performance/formal-v4-format-r2.txt) completed; [lint r1](../../../../16-nonadvanced-completion/lanes/performance/formal-v4-lint-r1.txt) preserves two failures (missing URL import in driver, unused test helper), and after removing the unused helper/adding the import, [lint r2](../../../../16-nonadvanced-completion/lanes/performance/formal-v4-lint-r2.txt) reported actual exit 0. Assertions were not relaxed. Raw stdout does not list complete argv, so this document invents no full focused/format/lint commands; final empty lint stdout is also not standalone proof of success.

Final sources were reread and checked against values supplied by parent:

| Source | Bytes | SHA256 |
| --- | --- | --- |
| `tests/browser/performance-process-times-v4.mjs` | 16214 | `bf9404f8b80177249f2e9f5e57e7090a9e22950eef5ebf8ff7af42a91858ccd9` |
| `tests/browser/performance-process-times-v4.ps1` | 7363 | `596679bd1aaccf9c6b839b9cead0ed4d83c3cde930b4e7c1e37d4ccf1e505784` |
| `tests/performance-v3/process-times-v4.spec.mjs` | 30047 | `2c3164ff2d714c72277a262d6e36d669ced954d397f227e3f43d5dde4487c280` |

An independent reviewer confirmed closure of original evidence gates for both findings on preformat source, then reread final `bf9404f8…` to verify hash gate (L176–180) and timing gate (L375–377) still exist; fixed PS hash is unchanged. Report 18 MD/JSON hashes were also reread, still `28d4c738…` and `a13dd910…`, preserving historical source. These are source/unit evidence, not native measurements.

**NOT RUN:** actual Windows reader component, actually selected PowerShell/.NET executable and version, native CPU on/off pairing, formal 600 seconds, DSP CPU, hardware underruns, product GUI, and listening. Original V3/44 pins, binary64 numeric core, 50 ms/other original thresholds, voices/paths/geometry/capture load, and existing FAILs are all preserved.
