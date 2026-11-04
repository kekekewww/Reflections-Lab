<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/behavior/REPORT.md","sha256":"9b367d9fdc5aa12c6e58278b847fe668426d2d9d09f7283a18f3daabfcc1fc91","translated_at":"2026-11-02T07:50:27.371Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/behavior/REPORT.md`](../../../../../14-core-pipeline/stages/11-ui-parameters/behavior/REPORT.md). Source SHA-256: `9b367d9fdc5aa12c6e58278b847fe668426d2d9d09f7283a18f3daabfcc1fc91`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲音行為參數映射與物件覆寫實際介面參數檢查"></a>
# Sound behavior, parameter mapping and object overrides: actual UI parameter audit

Date: 2026-11-02. Core result: **44 distinct core cases passed**, comprising32 passing cases from the first round,8 continuation cases under exclusive load and4 capacity/help supplements. This does not relabel original first-round failures as successes. Product source code was not changed. Assets have13 other distinct passing cases (assets/AUDIT_SUMMARY.json). The total57 distinct cases map to44 semantic parameter families in the central inventory; PARAMETER_INVENTORY.json contains the itemized crosswalk.

<!-- english-original-anchor --> <a id="方法與來源"></a>
## Method and sources

Actual DOM interaction used the production preview `http://127.0.0.1:4173/`, Chrome156.0.8078.75,1600×1200 and normal display scale, in an independent Playwright browser context. Input and clicks went through production React/Runtime/Host paths. Results were checked only through visible DOM and JSON downloaded using the Export Project button. No engine or test bridge was called directly, and no model/external-network request was made.

Source commits and per-file SHAs are in the two rounds' receipt.json. Both initial and continuation traces actually loaded `index-BDGeI4Sd.js`, `App-hX50zr2p.js` and `locale-model-76NfFkWb.js`. Trace network records contain HTTP200 and URLs, but JavaScript response bodies were not retained. browser-assets.json hashes only HTML/CSS trace bytes that actually exist; filenames cannot stand in for JS-byte hashes. artifact-manifest.json pins complete trace paths and hashes.

<!-- english-original-anchor --> <a id="參數與操作涵蓋"></a>
## Parameter and interaction coverage

| Parameter/control | Actually performed and confirmed |
| --- | --- |
| Rule volume0–4, pitch-24–24, cooldown0–10 seconds | Minimum, maximum, arbitrary decimals, out-of-range values on both sides and empty values; Enter/Escape; Apply/Discard. Every legal value was verified through UI-exported JSON |
| Rule enabled | Pointer checkbox and keyboard Space; disabled/enabled each applied and verified by export |
| Four classifications | Creative/Physical/Hybrid/Procedural selected individually and checked in exported profiles |
| Triggers |17 producer-backed options each selected, applied and verified by export. OnEnterZone/OnExitZone remain disabled with an explicit bridge reason |
| Add/delete rule | Select OnBounce, use Add to create a real rule, then that rule's Delete removes it and restores the original rule count |
| Seven mapping inputs | Under OnImpact or WhileRolling with appropriate metric availability, individually apply and verify each by export |
| Three mapping outputs | Configure/apply Gain/Pitch/Filter cutoff individually with legal lower/upper bounds, including each output's permitted limits |
| Mapping numeric fields | Arbitrary decimal input/output lower/upper bounds and smoothing time; invalid-range rejection and Discard |
| Mapping interpolation | Linear/Step both applied and checked through export |
| Curve points | Add an interior point and edit its x/y; illegal first-point x and out-of-range y are rejected; endpoints cannot be deleted. Removing an interior point leaves two legal endpoints |
| Curve capacity/minimum points | Formal schema cap16 points; actually reach16 and Apply. After the17th pointer click on disabled Add, exported curve data is unchanged. Both Remove controls at the two-point minimum cannot change data |
| Help/full precision |17 About callers and18 binding baseline/effective-value readouts, each focused with nonempty described-by content read and Escape used to close |
| Discard all drafts | Create rule and binding drafts together; explicit DiscardAll removes both, leaving the exported committed document unchanged |
| Add/remove mappings | Add up to three mappings for the three unique targets; duplicate-target options are disabled and Add is disabled when no other target exists. Exported count is correct after removal |
| Object overrides | Open details; Enabled/Volume/Pitch override selection and values; keyboard Space; Apply, invalid-value gates, Discard and Clear. Export confirms only the binding changes, not the profile |
| Unapplied drafts | Switch to speaker and back to ball; the original raw draft remains and can be explicitly discarded |
| Isolated preview | OnImpact explicitly rejects preview without a real contact event. OnGrab preview produces a source snapshot; provenance expands and Stop succeeds |
| Editing protection while running | Rule/classification/mapping buttons are disabled during Run and become available again after Pause |

PARAMETER_INVENTORY.json records each row's case IDs, methods and original observations. This table does not replace raw results.

<!-- english-original-anchor --> <a id="原始失敗與修正"></a>
## Original failures and corrections

| Before | After | Why |
| --- | --- | --- |
| Tests located exact Classification/Trigger labels, but those labels included native select-option text, causing four timeouts | Locate the actual label/select instead; retain the initial runner/stdout/FAIL. All four continuation cases pass | A test-locator assumption was wrong; product behavior and Host validation were not changed or relaxed |
| Several lanes ran Chrome together; fresh navigation near the end of the first round failed at an8-second load timeout | Close other owned browsers, take an exclusive lease and use DOMContentLoaded with a bounded30-second navigation, then continue only the eight unfinished/incorrectly located cases | The shared-load timeout is not declared a product-parameter defect, and the32 passing cases are not rerun |

<!-- english-original-anchor --> <a id="明確限制與後續"></a>
## Explicit limits and follow-up

- This is a bounded parameter/boundary/input-method matrix; it does not exhaust arbitrary values or every Cartesian combination.
- The Add Rule button was actually tested with OnBounce. All17 triggers were tested by switching an existing rule and applying it, not by creating a new rule separately for each trigger.
- An earlier draft incorrectly recorded the mapping-curve cap as64. It is corrected to16 from the formal schema (64 is a different Motion-trajectory limit). The original40-case document preimage remains in history/REPORT-initial-40-case-snapshot.txt. The schema was not relaxed;16→the17th disabled-add attempt was tested for data preservation.
- The main UI exposes no separate controls for schema fields such as oscillator frequency, fade or voice budget. This audit does not label unexposed API fields as broken parameters or pretend they were operated through the UI.
- Asset import/sample selection follows assets/AUDIT_SUMMARY.json and original receipts separately; other lanes audit other product controls.
- There are no human-hearing, calibrated-SPL, hardware-route or formal600-second performance results; headless-browser evidence does not replace them.
