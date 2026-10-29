<!-- english-source: {"path":"docs/11-v1/SESSION_PROGRESS_20261028-r8.md","sha256":"a9acb526977a2675bd31a72d20b26c1b7bfe3489069a6eb9da0af118d0409d1e","translated_at":"2026-10-27T17:35:46.1587363Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/SESSION_PROGRESS_20261028-r8.md`](../../11-v1/SESSION_PROGRESS_20261028-r8.md). Source SHA-256: `a9acb526977a2675bd31a72d20b26c1b7bfe3489069a6eb9da0af118d0409d1e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版整合-checkpoint-r8原生音訊通過reference-缺陷已定位短效能仍未達標"></a>
# First Version Integration Checkpoint r8: Native Audio Passed, Reference Defect Located, Short Performance Run Still Below Target

Date: 2026-10-28 (Asia/Taipei; original filenames and receipt timestamps use UTC). The complete first-version goal remains ACTIVE, with the original 51 requirements, EN01–06, Task criteria, loads, and numerical thresholds unchanged. The locked-version offline CI, 900 scoped runtime cases, typecheck／lint, and `a699…` **E2E verification build** from [r7](SESSION_PROGRESS_20261027-r7.md) are retained; that build is not a production release without test hooks, nor does it establish overall completion.

<!-- english-original-anchor --> <a id="新版原生音訊-2525-pass"></a>
## New-Version Native Audio 25/25 PASS

Prepared-static V2 uses the frozen original runner, making only four bootstrap substitutions; the original flow, gesture, capability, classifier, oracle, 15-second／2-second limits, and suite time limits remain unchanged. Seven bundles were prebuilt from exact source bytes, 30 conformance／negative-case tests passed, and two isolated reviewers found no blocking issues.

The retained child close for actual Node 68988 was exit 0／signal null; cached Chromium headless-shell `156.0.8078.4` actually executed all 25 original unique IDs, **25 PASS, with no skips**. The original 23 source files, 6 supplemental source files, and manifest／bundles were unchanged; all 1749 global inputs matched before and after. Known Node／browser／build PIDs and direct child processes numbered 0, and the static server was closed. [Final receipt](../../../artifacts/v1/audio-prepared-native-v2-20261027154159861/qualification-receipt.json). The two earlier Vite preparation timeouts remain retained and are not rewritten as PASS. The first conformance round's stdout remains in the tool record, without a separate raw TAP file; this limitation is recorded in the receipt.

<!-- english-original-anchor --> <a id="新-ir-reference-的失敗與原因"></a>
## New IR Reference Failure and Cause

The independent IR state v1 actually completed 3 cases／6 renders／576000 bytes of PCM: both the identical-IR impulse-tail case and continuous-tone scalar 20ms case had **RMS／max error of 0**; the A→B→A case retains **FAIL** (RMS `0.028180324598435457`, max `0.24689234048128128`), with the original `.001`／`1e-5` boundaries unchanged. [Original failure receipt](../../../artifacts/v1/audio-prepared-ir-v1-20261027155431842/qualification-receipt.json).

Comparison of the existing PCM confirmed that the difference occurs only in frames 4097–5055, the first B's 20ms fade-in; the later steady state and return to A are identical. An independent literal FIR／direct-convolution model shows that the product matches B fading in from 0, while the reference matches B starting directly from 1. A separate small native diagnostic directly confirmed that for an unpulled GainNode, setting `.value=0` gives a getter value of 0, while using only `setValueAtTime(0,0)` leaves the getter at 1; the reference then uses that 1 as the ramp's starting value. The product's existing constructor initialization was unchanged, and an isolated reviewer verified the cause. [Native causal evidence](../../../artifacts/v1/audio-gain-getter-diagnostic-20261027160249209/causal-receipt.json). The [official Web Audio definition](https://webaudio.github.io/web-audio-api/#dom-audioparam-value) distinguishes assignment to the current value by the setter from automation scheduling; this is not a room measurement or hardware listening test.

Product code and the old oracle／tolerances were not changed because of this failure. The corrected reference must have a separate version, retain the v1 FAIL, confirm initialization and negative cases, then execute natively; currently **reference v2 NOT RUN**, and the diagnostic above cannot be treated as a v1 pass.

<!-- english-original-anchor --> <a id="一次診斷-smoke量測有效性改善實際成本仍-fail"></a>
## One Diagnostic Smoke Run: Measurement Validity Improved, Actual Cost Still FAIL

After all source writers and owned heavy workloads stopped, only one run was executed:

```powershell
node tests/browser/performance-profile.mjs --phase all --seconds 10 --physics-iterations 120 --acoustic-iterations 20
```

The actual retained native handle and .NET exit were both 0, with SafeHandle pin／two exit readers agreeing; this establishes only that the process ended normally. Sources／bundles were unchanged before and after, and cleanup of known Node 51808／direct child processes and 5191 was completed. [Diagnostic summary](../../../artifacts/v1/browser-performance-20261027T160813274Z/diagnostic-summary.json), [cleanup](../../../artifacts/v1/browser-performance-20261027T160813274Z/cleanup-proof.json). The summary's original PowerShell JSON contains a UTF-8 BOM; readers may remove the BOM before parsing, without changing the original bytes／hash.

- Physics: 120 measured steps, all 255 Dynamic bodies awake, 1 Fixed, 64 CCD, with wake／setup separated from the native bracket. Native p50／p95／max = `1.4／3.2／10.7ms`, failing the original `<2ms` target; 120 records do not meet the formal sample count.
- Acoustic: each configuration has only 20 warmup＋20 measured iterations. For the default 64 paths, observable delivery median／p95／max = `3.0／15.0／22.4ms`; the stress configuration is `5.8／8.8／9.6ms`, failing the original `<1ms` target. There are 4／2 deadline misses respectively; the stress configuration has 255–256 current paths and warmup 16＋measured 7 drops, so sustained 256 current paths or a full 20Hz load cannot be claimed.
- UI: 10.344 seconds, 189 RAF／257 ticks, 30 overruns, 80 paused advances, 2.267 seconds of dropped wall time; capture has only 4 frames, with overrun／recording debt. RAF interval p95 `184.3ms`, callback `114.7ms`, advance `91.9ms`; full native wall main occupancy p95 `183.873ms`. Short-sample and workload gaps are explicit, with no formal 600-second PASS.
- V2 RAF finiteness／ordering／collection membership／same-renderer markers／trace coverage checks all hold, with no CDP data loss; the leading RAF offset `−28.9ms` and two real clock anchors are retained, without discarding edge work or recalculating old traces.

Available memory at the start of this round was approximately 4.406GB, versus approximately 13.625GB for the earlier 600-second run, on the same hardware models. This difference and short-sample outliers are insufficient to establish GC, OS preemption, code regression, or repair effectiveness. Causes are being investigated using existing raw breakdowns, sources, and actual identity／call paths; there are no blind reruns, load reductions, threshold changes, or termination of other applications.

<!-- english-original-anchor --> <a id="未完成與下一步"></a>
## Incomplete Work and Next Steps

First complete bounded read-only cause diagnosis for UI／physics／audio, then propose minimal repairs and fixed references／RED-GREEN／independent verification. The corrected IR reference, current-source Firefox／WebKit comparison, new-version UI／native zoom／physics／storage／product E2E, formal 600-second run, and actual device listening tests and block remain pending their respective evidence. Hi-x65／D3V are user-reported only; the cached listening-test tool has 18 synthetic＋11 pure host tests and isolated review, but the driver／hardware remain NOT RUN, and it has not been promoted to formal files.

Final status／requirements table／Wiki／Tasks／English freshness／complete check／local Git checkpoint remain incomplete; Task0020 remains IN_PROGRESS, and the existing DONE status of Task0006／0017／0019 is retained. No Muse Code, new paid Meta requests, push, or deployment. External decisions such as eligibility／terms, the root LICENSE, and publishing have not been made on the user's behalf.
