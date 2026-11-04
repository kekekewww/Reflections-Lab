<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render/REPORT.md","sha256":"9e3edb006bde5d3546756b65d3498dbcdf2cb465f94427aa332eaa4961d405f6","translated_at":"2026-11-02T14:20:48.273Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render/REPORT.md`](../../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render/REPORT.md). Source SHA-256: `9e3edb006bde5d3546756b65d3498dbcdf2cb465f94427aa332eaa4961d405f6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="匯出面板全參數真瀏覽器盤點"></a>
# Export panel: actual browser inventory of all parameters

Method: **Playwright CLI scripted DOM / headless Chrome**. This batch used the existing production preview4173. The coordinator supplied candidate `9fcf3f0657813f5aa07bf936a1cb6a50f2628f30`; independently retrieved entry HTTP bytes were `index-DO7iDxDy.js`, SHA-256 `5c75259d334399afeab1c53a5d32e0e7a3b4067f862b245836fdd542b96e7819`. Each case separately stores actual loaded JS/CSS hashes.

This batch **passed4/4, CLI exit0, in2.7minutes**. The first actual Render browser attempt passed; earlier work was static preparation only. After all cases, the CLI worker exit and CIM headless Playwright Chrome count **0** were confirmed before this report was prepared and the Zone test slot returned. Product, Git index and guards were unchanged. Scene reset was not used for recovery. The original four cases in this section did not include combined or Help; those two later, separately authorized batches are now complete, as described below, without rewriting the original four results.

<!-- english-original-anchor --> <a id="逐項實際結果"></a>
## Actual per-control results

The machine-readable `parameter-inventory.json` has19 items covering interactive controls, read-only states and editors absent from this panel. The central semantic-family/source-site mapping is the parent `CONTROL_CROSSWALK.json`. Each item retains its own result and case ID; a passing CLI does not establish that every UX judgment is closed.

| Control/state | Actual operation and result |
| --- | --- |
| Record3seconds | Generate is disabled without a recording; actually recording enables it, and each WAV and manifest confirms the three-second timebase. Three fresh contexts completed it separately. |
| Preserve tail | min0, max10, step0.5, default2; Enter accepts0/0.25/0.5/10, ArrowUp/Down moves by0.5, blur commits, Escape restores, and changing tabs retains the value.0.25 is a valid finite value; step is an interaction increment. |
| Invalid tail | -0.5,10.5, empty and1e309 all show aria-invalid/range errors. The native number input normalizes1e309 to an empty string; the actual draft is retained. |
| Invalid draft with a complete take | Original9fc observation: visible10.5 is invalid, yet generation still uses the previously valid zero-second tail. A later501 guard fixed it with a separate actual test. |
| Per-source stems | Both pointer and Space toggle it, and it persists across tabs. OFF generates mix/master/dry; ON generates five files including actual object stems for ball and speaker. |
| Generate | Keyboard Enter starts it; tails0/2/10seconds produce3/5/13-second floating-point WAVs. |
| Busy state/progress | A bounded DOM observer actually reads progress0/3; tail, stems, capture and execute are disabled while Cancel is available. This reads the DOM without test injection controlling the Host. |
| Cancel/retry | An actual Cancel click displays RENDER_CANCELLED. The SHA of the last complete manifest downloaded before and after cancel is identical, and the old three output buttons remain visible. Retrying tail10 succeeds. This directly checks retention of the old manifest; the old three WAVs were not all downloaded again for a separate byte comparison. |
| Individual downloads | The three main outputs and both actual stem IDs are each clicked/activated with Enter to download. No internal API or combined download replaces the individual actions. |
| MB/boundary limits | Actual outputs show1.10/1.83/4.76MB and the boundary-limit label; boundary notices were not removed or ignored. |
| Status/errors | Offline WAV,0/3, downloadable and RENDER_CANCELLED were actually recorded. The transient recording badge has no independent snapshot assertion; the inventory explicitly retains this state gap. |
| Filename/independent master editor | Neither form exists in this panel, so they are ABSENT_NOT_A_CONTROL. Master is a downloadable output. Shared monitor/reverb settings are in the footer, verified separately by that lane and this batch's cross-panel receipt. |

The single reachable Render HelpTip caller has its own **hover->Escape, Tab focus movement->actual click->focus->Escape** evidence. The receipt fixes `src/ui/RenderPanel.tsx:48`, source-site ID, the audio-export topic, actual aria-label/aria-describedby and tooltip text; it does not borrow a generic HelpTip test.

<!-- english-original-anchor --> <a id="原無效草稿觀測與後續501修補"></a>
## Original invalid-draft observation and later501 fix

`02-min-tail` first commits tail=0, then enters10.5 and confirms aria-invalid=true. Generate remains enabled at that point; the actual downloaded manifest has tailFrames=0 and the WAV is three seconds. It uses the last valid configuration, without passing out-of-range10.5 to the Domain.

This row is **OBSERVED_REQUIRES_OWNER_DECISION**: its receipt preserves the fact that an invalid draft still permits generation using the prior valid value. This is a fixed original9fc observation, not a currently undecided issue. Root adopted a policy that blocks invalid drafts; source501 adds a raw-validity guard. The [separate Tail test](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9624077ab286d24f4330d953c0158a44b93ec7ce) passed1/1:10.5/10.50/blank are blocked, the previous manifest stays unchanged, Esc restores0, valid0.25 generates3.25seconds, and valid10 generates13seconds. Original9fc raw and observations are not overwritten.

<!-- english-original-anchor --> <a id="共用-monitor-跨面板實證"></a>
## Shared Monitor cross-panel evidence

In `02-min-tail`, before Enable listening was pressed, slider keyboard Home set **-40dB**. Listening remained disabled after recording. After downloading three WAVs and the manifest, actual `configuration.master.monitorGain = 0.01`.

Only after this main assertion was the independent supplement `02-monitor-reverb-cross` executed:

- Actual clicks on the Monitor information and Synthetic late reverb summaries confirmed mutually exclusive disclosures.
- A real pointer set the checkbox **checked=true**, then keyboard Space set **checked=false**. Both isChecked results and timestamps are stored.
- It remained at-40dB throughout, Enable listening stayed visible, and muted aria-pressed=true.
- The independent supplement itself is **PASS**; the four-case CLI result is not borrowed as proof of the checkbox.

Main receipt SHA-256: `d32e4a621480f3d372f2704a2a3b25e9784e2b13883c39c4a5998636d14ea171`.
Independent supplement SHA-256: `d675b6887c14b28da507cbc268781bedc52343193fbd9baf71da3c9a294d27eb`.

<!-- english-original-anchor --> <a id="數位檔案與範圍"></a>
## Digital files and scope

There were **16 UI downloads**:11 WAVs and five manifest downloads, including the same complete manifest before and after cancel. Every actual downloaded WAV was checked for RIFF/float32 PCM,48kHz/stereo, finite and nonzero samples, the requested3/5/13-second timebase and manifest SHA. This does not establish device listening, PCM continuity, native/MCP operations or600-second performance.

The final five outputs are `mix`, `master`, `dry`, `stem-46219de459d8-ball` and `stem-be569a2d963a-speaker`, stored by stable outputId rather than array index.

The fully coupled Zone/nonlinear curve/moving-sphere analytic reflection/individual-WAV workflow was a later, separately authorized batch: source501 [first combined attempt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/279a3bceb606308c1da386fa7b2eeee93117a258) passed1/1 in35.7seconds, with actual180 contiguous ticks, Zone enter/exit, nonlinear resolved gain, and changing vertex/distance/delay for a stable reflection pathID. Five WAVs and a manifest were downloaded individually. Stage12 independent parsing uses these new original files; this section's four9fc cases do not claim the new-source result.

<!-- english-original-anchor --> <a id="收據與重現"></a>
## Receipts and reproduction

Batch data is in `attempts/final-9fcf3f0-01/`:

- `candidate-preflight.json`, `browser-initial.txt`/process and `browser-closed-cim.json`.
- `01-controls-receipt.json`, `02-min-tail-receipt.json`, `03-cancel-max-tail-receipt.json`, `04-source-stems-receipt.json`.
- `02-monitor-reverb-cross-receipt.json` and actual screenshots for each case.
- `ARTIFACT_MANIFEST.json` in this directory indexes evidence, sources, actual downloaded-file hashes/statistics and four large traces.
- WAVs and traces remain in the project's ignored cache/test-results rather than being added to Git in bulk.

To reproduce the four cases, use a new `PIPELINE_RENDER_AUDIT_ATTEMPT` (receipts use wx to prevent overwrites within an attempt) against an independently built preview4173:
`node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-render-performance-render.config.ts --max-failures=1`.

Test sources passed scoped Prettier/ESLint/strict TypeScript. An earlier test typing issue, error.stack possibly undefined, was found while adding a caller and fixed with a message fallback. Original static-failure logs remain and are not combined with product browser failures. No fifth case was added to the original four; combined has a separate config and lease.
