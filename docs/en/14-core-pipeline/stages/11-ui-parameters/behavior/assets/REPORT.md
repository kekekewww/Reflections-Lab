<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/behavior/assets/REPORT.md","sha256":"7635ae5e5350d508ae127696305e9ab09e8912f82609ecd9f6e2fdc5eb518bc2","translated_at":"2026-11-02T07:48:47.5732613+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/behavior/assets/REPORT.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/behavior/assets/REPORT.md). Source SHA-256: `7635ae5e5350d508ae127696305e9ab09e8912f82609ecd9f6e2fdc5eb518bc2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="素材參數實際介面檢查"></a>
# Asset parameters: actual interface checks

Date: 2026-11-02. Result: **13 distinct cases PASS**. The authoritative combined result is [AUDIT_SUMMARY.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/caf047a08adcc55a47957c0f6943a71470686f2c), combining 9 passing cases from the original receipt.json with 4 passing cases from isolated-oracle-resume-fixed-setup/receipt.json. Original FAIL/RUNNING/INTERRUPTED receipts remain; do not treat the old receipt.json alone as the final status.

Used the SceneExplorer asset section and RuleCard in the official production preview, Chrome 156.0.8078.75, through actual DOM pointer/keyboard interaction, browser filechooser events and product-downloaded project JSON. This was not operation of a Windows native file dialog. No runtime/test bridge, model API or third-party assets were used.

<!-- english-original-anchor --> <a id="已執行的參數與行為"></a>
## Exercised parameters and behavior

| Control/parameter | Actual result |
| --- | --- |
| Import audio disclosure/rights checkbox/Import button | Keyboard Enter/Space and pointer toggling work; the button is disabled until checked; import is unavailable while running |
| Empty files, non-RIFF/WAVE and files over 8 MiB | Clear errors are shown; both the original assets references and visible decoded bank remain unchanged |
| Five original WAVs | PCM8/16/24/32 and IEEE float32 import successfully, including mono/stereo and 8–192 kHz; SHA matches original bytes |
| Source details | Every imported asset opens through keyboard disclosure; read-only provenance and user-confirmed local rights are inspectable |
| Reimporting identical bytes under another filename | Reuses the same asset ID/original name and retains only one asset with the same SHA; this does not test every missing-file recovery case |
| Five dry-preview buttons | All start with keyboard Enter; disabled during Run and restored after Pause. Starting a preview is not human-hearing evidence |
| Sound asset selection and Apply | A representative imported asset is applied to rule.grab. Product-exported canonical generator.kind=sample and generator.asset.assetId are correct; scene sample preview and Stop work |
| Save/Reload/Load saved project | All five assets retain asset ID/SHA, restore as decoded-ready and have usable preview buttons |

The test signal is an original runner-generated 330 Hz, 120 ms, peak 0.12 sine wave, not commercial content, real material vibration or a measurement. Rights status is USER_CONFIRMED_LOCAL_USE; the project root LICENSE was not decided unilaterally.

<!-- english-original-anchor --> <a id="原始失敗與測試修正"></a>
## Original failures and test corrections

| Before | After | Why |
| --- | --- | --- |
| Treating the number of all project asset references as the size of the visible decoded bank | Check the two sets separately | Projects also contain built-in generator descriptors with different semantics |
| Locating by raw error code or whole-page Pause | Check actual localized error text; scope to Simulation controls | Understandable errors already existed; Inspector also has a Pause with the same name |
| Reading a temporary error banner only after Export project cleared it | Pin the error text first, then export to check atomic preservation | Read order caused a false failure, not an import that failed to reject |
| Reading canonical JSON through UI-projected assetId/generator strings | Use generator.kind and generator.asset.assetId | Official Scene/Behavior schemas differ from the UI view shape |
| Resuming only four cases while skipping the necessary rights prerequisite, leaving the filechooser button disabled | Establish minimal rights confirmation and one sample-fixture prerequisite for the resumed run; use Promise.all to wait for click/filechooser together | Reducing reruns does not permit omitting dependent state; retain that timeout without changing the product gate |

Original failures are in receipt-initial-harness-failures.json, receipt.json and their original stdout; resource-lock interruption is in receipt-partial-exclusive-lease.json. The initial runner preimage has no complete hash, so no reconstruction of that early version is claimed. Later runner-before-final-oracle-fix.txt and original traces/source pins are saved separately.

<!-- english-original-anchor --> <a id="限制"></a>
## Limitations

No standalone asset deletion, rename or license/provenance editing controls exist; those fields are read-only or NOT_EXPOSED. This report does not unilaterally add capabilities. Sound asset selection uses a representative fixture; each of the five formats is separately imported and previewed. This is not an exhaustive test of all unknown files or arbitrary generator combinations. Human hearing, Windows file dialogs, calibrated SPL, hardware loopback and formal performance are all NOT RUN.
