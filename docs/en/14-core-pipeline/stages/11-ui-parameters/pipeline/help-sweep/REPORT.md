<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/help-sweep/REPORT.md","sha256":"6b62f364242f38927163e483545a7676f5cead702c59f62e89e7f38513ac4b77","translated_at":"2026-11-02T14:20:48.260Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/help-sweep/REPORT.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/help-sweep/REPORT.md). Source SHA-256: `6b62f364242f38927163e483545a7676f5cead702c59f62e89e7f38513ac4b77`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="最後-help表格捲動zone-overlay-實測"></a>
# Final Help, table scrolling and Zone overlay checks

Method: **Playwright CLI scripted DOM / headless Chrome**, not native app, MCP, human keyboard/mouse or hearing tests. Product source is fixed at `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`; HTTP entry `index-Nm7oRfzL.js`, SHA-256 `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a`. After restoring the existing preview, all eight actual HTTP files returned200 and matched the original501 build hashes; see `PREVIEW_RECOVERY_5010685.json`.

The final narrow retry, `final-5010685-04`, **passed1/1 in about1.1minutes, CLI exit0**. `FINAL_SCOPE_JOIN.json` joins each of the20 reachable callers to its actual PASS and covers the final four semantic families in this round. It combines fixed original observations; it does not claim that one clean run repeated the entire product UI on501.

<!-- english-original-anchor --> <a id="真正操作與可觀察結果"></a>
## Actual operations and observable results

- Help: each of this lane's20 callers has nonempty content, its own aria-describedby, and pointer/focus/Escape evidence; some also have hover evidence. Sources are attempts02/03/04. The six callers previously missing content were reached with their real prerequisites: disabled Start recording information during paused Replay, Independent preview metadata, an OnBounce draft, binding.enabled=false, an empty Scene/empty query, and dry audition of a ready original WAV. Comparison, Performance, Path and Monitor method gaps also have their own observations. A generic HelpTip PASS does not fill every caller.
- Dock collapse is a real action that moves the control itself. After a click, the pointer can leave the moving control and close its tooltip. The record captures the actual click, updated state and accessible description still present when it closes, then independently moves focus and displays a nonempty tooltip on focus. Closing is not misclassified as a product defect.
- Paths table: normal100% display at a1600x1200 viewport; the inner region's scrollLeft changed **0 -> wheel6 -> ArrowLeft0**.
- Events table: normal100% display at a1000x620 viewport; the inner region's scrollLeft changed **0 -> wheel191 -> ArrowLeft151**. Both read a new baseline after focus, so focus-induced scrolling is not passed off as a keyboard effect. DOM `elementFromPoint` confirmed that the wheel coordinate was inside the visible inner region.
- Both inner tables have the same height as their own scrollHeight; the outer `.dock-content` owns vertical clipping. Raw receipts separately record the outer clientHeight/scrollHeight/scrollTop, without claiming an inner vertical-scroll PASS. CSS/DOM style was not changed to manufacture overflow.
- Zone overlay: a fixed sphere, an enabled sphere volume and a disabled box volume were imported through the official Project UI. After Frame selection, the actual canvas showed large sphere wireframe and a fainter box region. Clicking empty space cleared selection, then a real pointer at `(793,550)` selected ball through the wireframe. Public slider End->Home opened paused Replay, with authoring disabled and screenshots captured; End replay restored authoring. FPS showed an actual crosshair/mode and disabled authoring, then exited normally after the screenshot.
- `ZONE_OVERLAY_VISUAL_REVIEW.json` is a separate bounded visual review of five actual PNGs: large volume wires are present in Editor, absent in Replay/FPS, and restored after End replay. A small physics ball's debug wire remains and was not mistaken for a Zone. This is not a numerical pixel-absence or opacity measurement. The original raw visualPending field was not overwritten as a retrospective automated PASS.

<!-- english-original-anchor --> <a id="保留的非可達條件"></a>
## Conditions not reached

The two native-rejection callers `ff9b12f624`/`d773ccb4d7` did not receive a real native rejection in this bounded flow and remain NOT_OBSERVED. No fake rejection, CPU overload or private state was injected. Comparison `c7bbe36cfd` is displayed only when status is empty; all official RecordingHost branches supply a nonempty status, and no model was fabricated. These three conditions are not counted as generally reachable public-UI PASS results.

<!-- english-original-anchor --> <a id="原失敗與修正"></a>
## Original failures and corrections

1. attempt01 hit4173 connection refused before `page.goto`, so product operations had not begun. The same501 dist preview was restarted, all eight HTTP files were rechecked, and a new attempt was used.
2. attempt02 had several real caller PASS observations, but the moving collapse layout violated the old tooltip assumption. The old harness also waited for the header Pause control that is deliberately disabled during Replay; after short Replay ended naturally, it mistakenly pressed Start. The owned CLI was stopped with Ctrl+C; raw/trace and `STOP_REASON.json` were retained, and CIM confirmed Chrome0.
3. attempt03 retained more caller PASS observations and Editor pickthrough, but its wheel point fell in an area clipped by the outer container. The slider was already0, so Home alone did not trigger onChange and paused Replay had not opened. Its raw result remains FAIL.
4. Only the harness was changed: wheel uses the visible intersection and a read-only DOM hit check, the slider actually moves End->Home, and already-passed callers are skipped through fixed raw references. attempt04 covered only the remaining phase and passed. **Product, guards and acceptance values were unchanged.**

CLI stdout/exit and small receipts are in each attempt directory. Large traces, original Projects and the self-authored WAV remain in `.cache/pipeline-help-sweep/`; they are not all claimed to be in Git. `HARNESS_FROZEN_QUALITY.json` pins the final spec/config SHA and strict TypeScript/ESLint/Prettier exit0. `BROWSER_CLOSED_FINAL.json` confirms this lane's Chrome/CLI counts are0 and the lease is released. This case does not establish formal600-second performance, native-tool access, Meta live, device listening or complete V1 acceptance.
