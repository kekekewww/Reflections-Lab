<!-- english-source: {"path":"docs/11-v1/SESSION_PROGRESS_20261027-r6.md","sha256":"4190531a15de4a58903ab3a03d9149c37360f796ee39a67f53da15e5cac4819f","translated_at":"2026-10-27T17:34:23Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/SESSION_PROGRESS_20261027-r6.md`](../../11-v1/SESSION_PROGRESS_20261027-r6.md). Source SHA-256: `4190531a15de4a58903ab3a03d9149c37360f796ee39a67f53da15e5cac4819f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版整合-checkpoint-r6正式性能首輪未達標開始原因修補"></a>
# First-Version Integration Checkpoint r6: First Formal Performance Run Missed Targets; Root-Cause Fixes Begin

Date: 2026-10-27. **The complete first version is not yet finished; the goal remains active**. The original 51 items, EN01–06, numerical tolerances, performance workloads/thresholds, and Task criteria are unchanged. Development used no Muse Code and added no paid Meta requests. The local Git recovery point is `f006b0e60db18450bdfcbcf22d790b9913724b1e`; subsequent functional and validation fixes have not been committed, pushed, or deployed. [r5](SESSION_PROGRESS_20261027-r5.md) retains current functional acceptance and Task0006/0017/0019 closure evidence; Task0020 remains IN_PROGRESS.

<!-- english-original-anchor --> <a id="原生視窗-v2-的實際結果"></a>
## Actual Results of Native Window V2

The [single V2 native round](../../../artifacts/v1/native-zoom-reachability-v2-2026-10-27T13-09-13.922Z-6ad461b3/summary.json) achieved **2/2 PASS**; the [independent audit](../../../artifacts/v1/native-zoom-reachability-v2-2026-10-27T13-09-13.922Z-6ad461b3/independent-proof-audit.json) retains visual limitations. V2 activates the precisely owned window/tab through the official Chrome API, then requires actual visible/non-hidden/focus; there was no focus emulation, Cua, OS keyboard, or change to security flags. Four original scripts and all original assertions/thresholds retain their original bytes.

200% used the real API 1→2, DPR 1→2, 1424→712 CSS px, the same window, and CSS zoom=1; 320 is a separate native100%/DPR1 CSS viewport case. Each case passed three actual precondition gates, 14 control reachability checks, and five Mute/Pause/dialog/form/Exit checks; actual CANVAS lock, trusted/focused/active gesture, and Listener exit restoration were established. Seven program files and 181 local inputs, plus 12 HTTP assets, matched before and after; owned browsers, preview, and port 5174 were cleaned up.

The 200% PNG is clipped and cannot serve as visual corroboration that the complete Exit control is visible; the focused Exit control is visible in the 320 PNG. Restoration of 320 screen emulation also has explicitly listed limitations. Functional/DOM geometry results and image limitations are separate; OS IME, manual listening tests, or complete WCAG conformance are not claimed.

<!-- english-original-anchor --> <a id="已真正完成一次-600-秒量測結果未通過"></a>
## One Actual 600-Second Measurement Completed; Result Did Not Pass

The [formal results](../../../artifacts/v1/browser-performance-20261027T131711449Z/verification.json), [operational summary](../../../artifacts/v1/browser-performance-20261027T131711449Z/operational-summary.json), and [cleanup evidence](../../../artifacts/v1/browser-performance-20261027T131711449Z/cleanup-proof.json) retain the raw data. The sole command was `node tests/browser/performance-profile.mjs --phase all --seconds 600`; the complete batch took about 13 minutes 48 seconds, with 600.072 seconds of UI measurement. The original status is `MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD`; **the outer wrapper's exit 0 cannot be called a performance pass**; the native Node exit code was not reliably obtained and is recorded as UNKNOWN.

Hardware/environment: i9-13980HX, NVIDIA RTX 4070 Laptop/D3D11, actual Chrome 156.0.8078.48, 1920×1080 CSS px/DPR1, native context 48kHz. The p95 values below are measurements from this run, not new tolerances or budgets.

| Scope | First-Run Measurement/Assessment |
| --- | --- |
| Native WASM step with 256 primitives/64 CCD | 2.10ms, missing the original `<2ms` target; actual maintain-awake validity was also false, so a pass under the complete specified workload cannot be claimed. The complete public tick including copying was 23.30ms. |
| Default 8 voices/64 current paths | Worker compute 5.20ms, but 20Hz cadence was invalid, hence UNVERIFIED; service reply validation 0.60ms, actual synchronous native consumers 14.30ms, observable receive→consumer 15.10ms, missing the original `<1ms` target. |
| Explicit 256-path stress configuration | Worker 6.40ms is UNVERIFIED because workload/cadence were invalid; service validation 2.00ms, native consumers 50.00ms, observable delivery 51.10ms. Current paths were 254–256; aggregate/retired paths cannot be presented as a constant 256; actual drops/deadline misses occurred. |
| UI 100 dynamic | 21872 RAF entries; p95 interval 66.60ms, all RAF callback CPU 44.40ms, advance 40.60ms, pose lookup 2.10ms. 604 overruns, 35.65s dropped wall time, 296 paused advances, with warmup and three capture-window validity checks false. |
| UI internal components | Native physics 0.30ms belongs only to that slice; physics wrapper 5.50ms, behavior/recording tick 4.80ms, capture tick 16.60ms. A native-slice pass cannot replace the overall CPU budget. |
| renderer-main trace | 600.073 seconds of markers, with no CDP loss reported, but the first RAF preceded the begin marker by 22.5ms and was rejected by strict boundary validation, so main occupancy is NOT RUN. Callback CPU cannot imply a complete main-thread PASS. |
| Audio device/Worklet | Remained muted; this is not evidence of headphone listening tests, actual block, underruns, Worklet p99, or SPL. |

Complete raw UI data is about 24MB and the compressed trace about 89MB; originals remain unchanged. During cleanup the browser was disconnected, the preview received SIGTERM, known root/direct children were checked, and the port 5191 listener returned to zero; this check does not extend to a claim that no processes exist across the entire machine.

<!-- english-original-anchor --> <a id="下一步是原因修補不是重跑碰運氣"></a>
## Next: Root-Cause Fixes, Not Rerunning for Luck

Investigate separately the AudioEngine's actual consumer cost, UI advance/physics snapshot/bridge/capture cost, and the measurement boundary for the first straddling RAF frame and maintain-awake method. First read the actual code and component data, then propose minimal fixes, fixed references, and regressions; success must not be manufactured by reducing bodies/voices/paths/cadence, changing solver quality, ignoring drops, or relaxing thresholds. The first-round failure is permanently retained; testing a new version is scheduled only after implementation or methodology fixes and independent review.

The user has reported Austrian Audio Hi-x65 headphones and ADAM Audio D3V speakers; actual listening tests remain NOT RUN. The muted-block validation probe for the same main AudioContext currently consists only of an ignored cache draft and 18 Synthetic tests; there has been no playback, native callback measurement, or product change, and the actual block remains UNKNOWN. Provide a concrete listening-test page after the fixed version passes the corresponding validation, without pre-filling 128 frames or hardware latency.

Finally, itemized evidence, original Tasks, status/limits, all English freshness, the latest handoff, the complete check, and local Git still need updates; personal eligibility/terms and root LICENSE/publication decisions remain separate. The real Meta minimal Sound slice retains its original PASS; all three authorized requests have been used, billing/balance are unknown, and no more calls will be made.
