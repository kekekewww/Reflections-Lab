<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/dock/REPORT.md","sha256":"85685b649b0d6d27b81e4e18accb85d8dfcc10640893a43b8cba1e39f4d78df7","translated_at":"2026-11-02T14:20:48.265Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/dock/REPORT.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/dock/REPORT.md). Source SHA-256: `85685b649b0d6d27b81e4e18accb85d8dfcc10640893a43b8cba1e39f4d78df7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="pipeline-dockpathscomparison-實測交付"></a>
# Pipeline Dock, Paths and Comparison test handoff

This report retains source versions and methods separately; it does not combine different versions into one clean all-pass batch. Operations used Playwright CLI scripted DOM/headless Chrome, with read-only DOM evidence collection; they were not native app/MCP/human input.

<!-- english-original-anchor --> <a id="實際結果"></a>
## Actual results

- `navigation-paths-receipt.json`: old source19db/index-BDGeI4Sd passed pointer navigation through all seven tabs, arrow-key wrap/Home/End, collapse, selection of five actual solver paths, units/provenance, Help hover/focus/Escape and English switching. The new eight-tab UI has separate complete coverage in the first Zone case on source9fc; this report does not relabel the old seven tabs as the new version.
- `paths-state-receipt.json`: on the same old source, the real medium UI switched to vacuum, showing no fake paths, an old-selection-missing message and the unavailable reason, then restored air and actual solver rows; PASS. Other transient/error/unsupported states were not safely induced and are not marked PASS.
- `final-49bde82-02/comparison-receipt.json`: source49/index-C4qRBPy8, one Comparison case PASS in31.9seconds; actual HTTP SHA2568d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123. It actually tested Host rejection of missing A/B, the product's controlled three-second recording, saving A/B, acoustic and behavior comparison under matching conditions, material B reevaluation, behavior-incompatibility rejection, updating A and clearing B, and B rejection by the object-set guard after adding an object.
- The corresponding first source49 run was not a product failure: the last rejection correctly displayed the earlier requirement that reevaluation use the same object set as the original motion and scene; the old assertion waited for later generic geometry wording. Only the expected wording was corrected and a fresh attempt used, without changing product/guards/criteria. Original stdout, receipt and trace remain.
- The initial three failures came from an unquoted inventory CSS selector `[tabindex=0]`; another Comparison attempt incorrectly scoped the actual App-wide alert to the dock. All original evidence remains, and these harness errors were not attributed to the product.

<!-- english-original-anchor --> <a id="逐項機讀與限制"></a>
## Per-control machine-readable evidence and limits

`parameter-inventory.json` maps this subpanel's controls/methods/states to raw receipts. Readouts are not editable controls; no arbitrary path gain/delay editor exists. The comparison enum contains only acoustic/behavior; invalid options are not injected through the DOM.

The original19db Paths/Events table evidence showed focus and keyboard dispatch only, without proving an overflow change. The later source501 [final Help/scroll case](../help-sweep/REPORT.md) captured actual inner horizontal movement: Paths left0->6->0 and Events0->191->151, using real wheel and ArrowLeft. Outer vertical-clipping dimensions/scrollTop are stored separately, without claiming an inner vertical PASS; CSS/DOM style was unchanged. Path provenance and each Comparison caller also have their own pointer/focus/Escape observations with nonempty content. Original19db frozen raw is not overwritten, and generic HelpTip results do not fill callers. The official Host has no empty comparison.status, so only that fallback caller remains NOT_OBSERVED.

The curved/dynamic-reflector physical model, complete WAVs and Root's final new scene have separate complete-pipeline receipts. This report covers only the observed values/states/UI methods; it does not establish RT60, calibrated SPL, hearing,600-second performance or all V1 acceptance.
