<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/monitor/REPORT.md","sha256":"412cce84c9cf553cce375778f27304f190e6e926bad76b56de54454c675d42d2","translated_at":"2026-11-02T10:09:17.824Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/monitor/REPORT.md`](../../../../../14-core-pipeline/stages/11-ui-parameters/monitor/REPORT.md). Source SHA-256: `412cce84c9cf553cce375778f27304f190e6e926bad76b56de54454c675d42d2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="monitorfooter-參數實測與修補"></a>
# Monitor/Footer parameter audit and fixes

Date: 2026-11-02. Lane: audio_core. The interface retains the existing design language; global CSS, NumberField and other panels were not changed. The central inventory has10 semantic families and13 AST sites; see [summary.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/515490210e23636e835cf7b1ac577eb74ee7a3c8) for the crosswalk.

<!-- english-original-anchor --> <a id="方法與來源"></a>
## Method and sources

- An isolated Chrome156.0.8078.75 context used1600×1100 CSS pixels and deviceScaleFactor=1. Values changed only through actual DOM locators, pointer and keyboard input; evaluate only read DOM/focus/native validity. No bridge, internal engine state or test mode was used.
- The baseline was4173's `/assets/index-BDGeI4Sd.js`: [audit-baseline.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9af4cafa71b78376e0be644041b6928c204cb98c),39 cases =36 PASS/3 FAIL. The initial parameter inventory, native ARIA and images are retained separately.
- The fixed version was coordinator-provided a10b741, entry `/assets/index-BmjZ1Zyf.js`. The actually downloaded JS SHA-256 is `0ed373c786549c63413e9ef5cac502630df727ba9a1d331c988c2101c8a5d42a`: [retest-final-a10b741.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5aaca7e38be154a6b2a9ff598c2b65522c4fab71). The affected scope passed11/11 with0 page errors. The browser was closed in finally and its exclusive lease released.
- This is not device listening, DSP performance, physical keyboard/mouse operation or complete V1 acceptance. The two rounds use different sources; their counts are not added, and this does not claim all39 old cases were rerun on the new source.

<!-- english-original-anchor --> <a id="逐參數覆蓋"></a>
## Itemized parameter coverage

| Parameter/control | Actual interaction and result |
| --- | --- |
| Enable/mute | Actual baseline click and Space/Enter cycles passed. The new source retained desired gain/Raw on enable; click mute and safe-final passed. Enabling did not start simulation. |
| Monitor gain | Home returning to0dB before enable was an original FAIL. After the fix, pre-enable−40/+12 bounds, out-of-range arrow clamping, enable and three rebuilds all retained the setting. The baseline separately records pointer adjustment and nonnumeric keys leaving the value unchanged. |
| Three buffers | Stable is the default. Pre-enable selection, all three preset transitions and keyboard input passed on the baseline. Three rebuilds on the new source retained gain/route/mute, with DOM readbacks of60/80/120ms lookahead. |
| Raw/Simulated | Pre-enable Raw was an original FAIL. After the fix, Raw is visible before enable without creating a device, and survives enable/rebuild. Baseline pointer/Space/Enter switching and Raw help passed; new-source safe-final selection of Simulated passed. |
| Monitor details | Baseline keyboard opening/closing passed, but opening it with the reverb panel obscured route help. After the fix, actual pointer hover and elementFromPoint hits, plus mutually exclusive keyboard toggles, passed. |
| Synthetic reverb details | Mutually exclusive with metadata on the new source; pointer/keyboard toggling, field clicking and Tab reachability passed. |
| Reverb enable | Actual baseline checkbox click/Space true↔false cycles passed. On the new source, Tab reachability and final false were confirmed. Actual new-source toggling is delegated to the Render lane's shared context; neither Tab nor unchecking an already-false value is counted as a toggle. |
| Decay | Baseline0.1/4/1.2, both out-of-range sides, empty input,1e309, typed NaN, Escape restoration, blur commit and ArrowUp passed. The new source rechecked bounds, out-of-range errors/Escape and retention across popovers. |
| Wet | Baseline0/1/0.12 and the same negative/restoration/blur/ArrowUp flow passed; default0.12 also showed native stepMismatch at step0.05. The new source uses step0.01; default native validity, Up0.13/Down0.12, bounds/errors/restoration all passed. |
| HelpTips/Tab/Reset | Baseline Synthetic help focus/Escape, Raw hover/Escape and Reset retaining settings passed. On the new source, actual pointer route help was unobscured and native Tab traversed every visible footer control. |

The range slider cannot receive arbitrary NaN/Infinity through normal UI input; DOM injection was not used to fabricate this. Independent Node domain tests verify rejection of those illegal gain values. Nonfinite/invalid NumberField input used only the keyboard, retaining the invalid draft, visible error and Escape restoration.

<!-- english-original-anchor --> <a id="修補與node回歸"></a>
## Fixes and Node regressions

- `runtime.ts` retains desired monitor gain/mode. Before creating AudioEngine, it validates finite values,0..MAX_MONITOR_GAIN and the raw/simulated enum. The selected value is visible in the disabled-engine view and applied on enable. Changing preferences does not create a device.
- Init, buffer rebuild, preview and the RenderHost master-gain fallback retain selected settings. Mute, pause and buffer/reverb guards were not changed. MAX_MONITOR_GAIN=`10^(12/20)`, not2; Node regressions cover the exact +12dB bound before and after enable.
- The App's two footer details share a single mutually exclusive enum; an outdated close event cannot clear the other section. Native keyboard interaction remains.
- Only wet-gain UI step changed from0.05 to0.01. Its continuous0..1 runtime domain was not narrowed; this does not turn every NumberField into a step-grid constraint.

Public LabRuntime Node regression:6/6 GREEN, [runtime-green.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/baccf620e07a4fac888cf52d7cee37a7253f9b0a). The effective RED is the [baseline after fixture correction](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7b5c6dcb8b82827c02d39943c1578ba0a1d52445),2 PASS/3 FAIL. The [first run](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c437896d0f42abe07461487bd8b00845e1d709c2) also contains an OAC fixture-precondition failure; its original is retained without counting it as an effective product FAIL. Type checking, scoped ESLint and formatting all exited0. FakeAudioContext/the public asset-staging adapter prove only control contracts, not DSP.

<!-- english-original-anchor --> <a id="共用render-lane待補項目"></a>
## Shared Render-lane items still pending

1. Before enabling listening, use the UI to set−40dB, export master, and inspect the actual downloaded manifest for monitorGain=0.01. The fallback is fixed and statically reviewed; manifest verification is not claimed yet.
2. Actual true/false readback of the reverb checkbox in the latest bundle. The Render lane should use its already leased shared context to avoid interference from multiple Chrome instances.

After the coordinator/Render lane supplies evidence, update summary's sharedConfirmationsPending and checkbox-family status; source-version boundaries must remain explicit. This lane did not change the Git index, commit, Wiki or English mirrors.
