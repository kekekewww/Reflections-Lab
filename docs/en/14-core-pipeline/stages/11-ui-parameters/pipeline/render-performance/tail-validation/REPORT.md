<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/tail-validation/REPORT.md","sha256":"5512b58588f5e5d2edad6d588db23499c8395e3988e14f2613aa7ae09d0e106e","translated_at":"2026-11-02T14:11:31.488Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/tail-validation/REPORT.md`](../../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/tail-validation/REPORT.md). Source SHA-256: `5512b58588f5e5d2edad6d588db23499c8395e3988e14f2613aa7ae09d0e106e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="無效尾響護欄-focused-ui-回歸"></a>
# Focused UI regression for the invalid-tail guard

Method: **Playwright CLI scripted DOM / headless Chrome**, one scenario, **1/1 PASS in45.2seconds**. The actual candidate is `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`. The lease supplied entry `index-Nm7oRfzL.js`; its HTTP SHA-256 exactly matches `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a`. This is a separate regression against a new source after the original9fc P2 finding. The original four cases were not rewritten.

First, actual UI creates a procedural source with stems OFF, then captures a complete take using “Record3seconds.” Every subsequent action uses visible fields, Enter, Escape, and download buttons. There are no direct handler calls, HostInternal, bridge, Scene resets, or guard bypasses.

| Sequence | Actual result |
| --- | --- |
| baseline tail0 | Actual mix/master/dry generation and individual downloads, followed by the manifest. Each WAV is three seconds, tailFrames=0. |
|10.5 | aria-invalid=true; Generate disabled; visible field reason; existing output buttons and manifest hash remain unchanged. |
|10.50 | Generate stays disabled for the second invalid raw draft. Repeated invalidity or the same numeric value does not re-enable it. |
| blank | Generate remains disabled; the prior complete outputs and manifest remain unchanged. |
| Escape | The field restores the last committed0, aria-invalid=false, Generate enabled. |
| valid0.25 | Native input.validity.stepMismatch=true/valid=false, but the app's finite-range policy permits the value. Generate is enabled; actual3.25-second WAVs are generated and downloaded individually, with manifest tailFrames=12000. |
| valid10 | Normal generation and individual downloads of13-second WAVs, manifest tailFrames=480000. |

All three invalid drafts retain the baseline manifest SHA `e1f4b65120db830c510e44aa1f443a849d4d535f8604a15f2fd97c3892c3d374`. There are nine WAV and six manifest UI downloads in total, with each file SHA matching the actual manifest. WAV format/48kHz/stereo/float32 and output clocks have hard assertions. This focused case adds no DSP, listening, or performance PASS claim.

New central source-site mapping:

- Generate: `ui.renderpanel.renderpanel.button.8540c33586`.
- Tail NumberField: `ui.renderpanel.renderpanel.numberfield.1723b03d62`.
- These map to `render.execute`, `render.tail`, and actual-outputId `render.download.{outputId}`/`render.manifest`. The original9fc source-sites retain their historical version meaning.

Raw evidence resides in `attempts/final-5010685-01/`: `tail-validation-receipt.json`, `candidate-preflight.json`, stdout/process, two actual screenshots, and `browser-closed-cim.json`. The main receipt SHA-256 is `88bd2f41751e2084357d2f7950ab13d554197f481404d7c3d690388820a6e441`. CLI exited0. At11:42:57UTC, CIM confirmed worker PID92720 had exited and zero headless Playwright Chrome processes remained; report preparation followed.

Page errors, agent requests, blocked external/paid requests, and browser dialogs were all0. All source/test harnesses are frozen. This regression changes neither product code nor the Git index.

Reproduction requires a fresh `PIPELINE_TAIL_AUDIT_ATTEMPT` and lease-provided `PIPELINE_RENDER_EXPECTED_ENTRY`/`PIPELINE_RENDER_EXPECTED_SHA256`. Run the sole config against production preview4173: `tests/browser/parameter-audit/pipeline-render-performance-tail-validation.config.ts`. The same attempt uses wx to prevent overwrites, and failures retain their original causes. Do not reset the Scene or alter controlled-clock safeguards to obtain a pass.
