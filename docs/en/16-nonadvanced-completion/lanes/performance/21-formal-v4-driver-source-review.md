<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/21-formal-v4-driver-source-review.md","sha256":"2edfdf352d149304cd69818fa15fc5b0a047a606dfb659a276520dd492d1a124","translated_at":"2026-11-03T02:49:45.469Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/21-formal-v4-driver-source-review.md`](../../../../16-nonadvanced-completion/lanes/performance/21-formal-v4-driver-source-review.md). Source SHA-256: `2edfdf352d149304cd69818fa15fc5b0a047a606dfb659a276520dd492d1a124`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="formal-v4-driver-最終獨立來源審查"></a>
# Formal V4 Driver Final Independent Source Review

Conclusion: **No remaining P1/P2 found, limited to source review and existing-artifact reconciliation.** This is not a formal 600-second, native graphics/CPU, probe-overhead, DSP, hardware-audio, or listening pass. Here `formal600Run:false`, `nativeDspCpuMs:null`; this report does not close overall first-version or complete PERF014 acceptance.

Checkout HEAD actually read: `540be353d1dd99f36aa8928873e43ffa15be460f`, at `2026-11-03T02:26:55.5733348+00:00`. HEAD is a review snapshot; untracked new driver/helper files are separately identified by full source hashes, without claiming they belong to an earlier benchmark commit. See [JSON](../../../../16-nonadvanced-completion/lanes/performance/21-formal-v4-driver-source-review.json) for exact pins/line numbers.

<!-- english-original-anchor --> <a id="原工作負載與兩-arm-條件"></a>
## Original Workload and Conditions for Both Arms

- V4 CLI retains original V3 formal rules: 600 seconds, phase all, physics3000, acoustics600; original software-GPU/prepare flags still cannot enter formal runs. Formal monitor is fixed to Levels/master-left.
- UI preserves default ball + 99 dynamic, totaling original 100 dynamic; capture starts remain 10/300/580 seconds. Recorder's original 18000-frame hard limit is 300 seconds at 60 Hz, separate from 600-second UI wall time; it is not 600-second capture.
- Physics preserves 255 dynamic + floor, CCD/contact load, and 3000 measured iterations. Both worker profiles retain path8/32, 8 sources, 32 surfaces, 16384 segment budget, each 20 warmup + 600 measured at 50 ms cadence.
- Task0033 is the product TopMonitor task, not a 33 ms timer. Both arms use normal UI/RAF and 15 Hz native analyser; typed resource policy is an explicit difference, while content model must remain `nativeReference`.
- Actual resource witness against original caps: active24, graph48 + internal96/256, total graph144/304; reference carrier144/304, candidate176/336. No pass is obtained by reducing voices/paths/geometry/capture load. Enable/closed-window endpoints and passive monitor are separate and cannot establish continuous resource history.

Main sources: `performance-cli-v3.mjs:32–57`, `performance-cli-v4.mjs:20–67`, V4 fixture L88–127/388–391/800–822/1324–1420/1484–1493/1691–1797; original recorder L30–33 and `docs/11-v1/PARAMETER_REFERENCE.md:198`.

<!-- english-original-anchor --> <a id="已關閉的來源缺口"></a>
## Closed Source Gaps

**Cleanup no longer invents no-listen.** Initial wrapper converted preview-child exit to `serverListeningAfterCleanup:false` even when driver listening remained null. Final helper performs one bounded TCP observation of 127.0.0.1: 5194: connect=true, only ECONNREFUSED=false, timeout/other errors/reversed clock=null. Driver L1375–1408 saves actual receipt, adding cleanup errors for true/null; wrapper L109–114 passes actual listening value to original adapter rather than deriving false from child exit. Original forced-stop path still requires owned process-tree evidence; unknown helper closure also blocks normal lease release.

TCP receipt proves only that connection result at the recorded time, not permanent absence of a listener, and neither attributes nor stops a foreign listener. Timer provides a bounded trigger and actual monotonic receipt, not an exact global wall deadline.

**Qualification no longer accepts a true subset/duplicate profiles.** Final contract L7–94 explicitly lists 19 UI, 7 physics, and 15 own true gates per acoustic profile, validating unique productDefault/stress256 identities and original 8/64, 32/256 capacities. L185–190 validates browser revision as string before replace, closing the malformed-type throw. Original thresholds, rejected raw, and numerical core are not relaxed.

<!-- english-original-anchor --> <a id="cpu-接點的實際-scope"></a>
## Actual Scope of CPU Hooks

Driver L943 takes before ahead of `Tracing.start`; L1012 takes after following close-window RPC, before L1059 disk checkpoint/tail/disposal/flush. Both probe arms share the same existing browserCDP, PID observation, and resource endpoints without a new browser connection. Node monotonic brackets, actual completion-to-completion denominator, and browser collection marks are separate; requested 600 seconds cannot stand in as denominator or establish absolute cross-clock alignment.

CDP CPU and Win32 helper measure only **whole-process** cumulative endpoint deltas, including tracing/control/shared-endpoint disturbance; they are not callback, continuous lossless coverage, or native-exclusive DSP. Win32 helper queries only CDP PID/type whitelist, fixed-file argv, 5-second/1MiB bounds, retaining executable/helper pins, open/query/close flags, creation identity, and exact FILETIME strings; it computes BigInt deltas before converting to seconds. No execution-policy bypass. PID churn/regression/unknown values stay null; CDP zero without a validity flag is not treated as idle, while true zero under Win32 success flags has separate verifiable semantics.

These native observations were not started in this review; mock/source tests cannot prove actual CDP/Win32 counters, permissions, full PID coverage, disturbance, or GPU capacity. `nativeDspCpuMs` remains null.

<!-- english-original-anchor --> <a id="資格範圍與未閉合項"></a>
## Qualification Scope and Unclosed Items

Final classifier can still produce only `ORIGINAL_UI_PHYSICS_ACOUSTIC_PROFILE_ONLY`; probe-off is comparison-only. This classification is not overall PERF014/DSP/listening/V1 completion.

`completeMainThreadDelivery` remains explicitly **UNVERIFIED** (driver L839–886). `combinedDelivery` is `KNOWN_STAGE_SUM_ONLY`; although `receiveThroughNativeConsumers` covers actual receive entry→native consumers, it excludes pre-handler deserialization/OS dispatch and LabRuntime-specific bookkeeping. Partial PASS cannot replace the complete canonical main-thread delivery p95<1 ms gate. This round follows the existing contract without expanding classification or turning that limit into false PASS.

Probe-off retains normal monitor and active shared endpoints, so it is a same-condition comparison arm, not zero observation cost. Actual paired overhead, native graphics, 600-second wall, and OS CPU measurements remain **NOT RUN**.

<!-- english-original-anchor --> <a id="provenance-與既有驗證"></a>
## Provenance and Existing Validation

Approval-record SHA is `a9b46674b9e5225ba138f4f8014364d3c408f496946c0fe2236c5a5718a7824a`, matching the actual file. **All original 44/44 source pins and 7/7 evidence pins match**, with no mismatches. That record adopts only the semantic precondition; executionAuthorization browser lease, formal 600, losslessCPU, nativeDSP, hardware, and hearing are all false, without promotion here.

Read-only inspection of `formal-v4-final-focused-r1.tap`: 611 tests/611 pass/0 fail/0 skipped, duration 6255.2786 ms. These are main agent's existing eight focused-spec results, not this reviewer's rerun or native600/OS CPU evidence. Original two lint-r1 errors are preserved; empty lint-r2 log and format-r1/r2 are also pinned. Parent reported final exit 0; an empty log alone does not independently prove process status.

| Final Source | SHA-256 |
|---|---|
| `tests/browser/performance-profile-v4.mjs` | `41e9daf7cc1bfbb64b61ab65681efe5210b7f36cc186aa9c2431a16733d0cd2f` |
| `tests/browser/performance-fixture-v4.mjs` | `543be0708bd11d3790fa27b5478bee559a960fd7dd68f63f1aac50197d5ae757` |
| `tests/browser/performance-profile-contract-v4.mjs` | `728eb07cb7c462071b00dec2586a850545511d6a8dc3e0c674b568dc30c5c602` |
| `tests/browser/run-performance-v4.mjs` | `263a0199743066f387ee0a6999ca4525754bef4ef4e7dbf7a0752e09dee51ec0` |
| `tests/browser/performance-cli-v4.mjs` | `2477100c7bef7d0fe5f5a6e4a853a9e99c1210292456ccba55dfd6f14332a146` |
| `tests/browser/performance-preview-listen-v4.mjs` | `6a000dea8df3c30af868073a26f55d40a8c1ea40f887469b3447534a1f542bb6` |
| `tests/browser/performance-process-cpu-v4.mjs` | `82abea440a8fa34206f7ab0ad474844f6f7e1856c95c9f33ec168ff7f13a587e` |
| `tests/browser/performance-process-times-v4.mjs` | `bf9404f8b80177249f2e9f5e57e7090a9e22950eef5ebf8ff7af42a91858ccd9` |
| `tests/browser/performance-process-times-v4.ps1` | `596679bd1aaccf9c6b839b9cead0ed4d83c3cde930b4e7c1e37d4ccf1e505784` |
| `tests/browser/performance-native-formal-v4.mjs` | `05f4c66ab31cde4446d1bb9ed5a2a06bd12464e2f5c266368366c5056823b10d` |
| `tests/browser/performance-approved-qualifications-v4.mjs` | `fe41541e07bb82e6c483899a534001d8ba8e7e1ce71907f3832037d87ea31aa5` |
| `tests/browser/performance-observation-summary-v4.mjs` | `53ede61ed3d6cb30027a18703af46ef507e69c81ac598cb23961418b46af6359` |

This review used `codex-verification` to separate sources/existing receipts/protected pins, with an isolated reader checking TCP/CPU. Only this MD/JSON was added; production, specs, immutable44, approval, categories, and shared memory were unchanged. No Node, test, build, TCP probe, OS CPU helper, browser, or benchmark was started. Actual pilot/formal measurements still require separately scheduled exclusive windows with every failure preserved.
