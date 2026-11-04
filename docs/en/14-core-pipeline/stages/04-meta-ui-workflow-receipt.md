<!-- english-source: {"path":"docs/14-core-pipeline/stages/04-meta-ui-workflow-receipt.md","sha256":"8dec2d859b512bd87cc51ddedfd16920f7173600c5cea7a4132accd5a4d71874","translated_at":"2026-11-02T06:30:45.239Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/04-meta-ui-workflow-receipt.md`](../../../14-core-pipeline/stages/04-meta-ui-workflow-receipt.md). Source SHA-256: `8dec2d859b512bd87cc51ddedfd16920f7173600c5cea7a4132accd5a4d71874`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-離線實驗-ui-閉環收據"></a>
# Meta offline experiment UI workflow receipt

This receipt supplements Stage 04 with actual browser evidence. Chrome156.0.8078.75 ran in an independent headless process against the existing production preview at `http://127.0.0.1:4173`, without a test bridge, runtime dispatch or paid-model calls. The test acts only through visible inputs, buttons and forms, reading the DOM for source identifiers, numbers and state. This is not evidence that Meta live, human keyboard/mouse operation, hearing,600-second performance or full V1 passed.

<!-- english-original-anchor --> <a id="發現與最小修正"></a>
## Finding and minimal correction

In the first actual-UI run, material preview/apply and baseline Run → Capture → Analyze succeeded, but the Traceable Results table had no data rows even though the original Host explanation and two citations existed. The original helper incorrectly treated a metric record's original recording artifact ID and the explanation's derived grounding artifact ID as the same string.

After correction, a record is accepted only within the same successful Host result, with matching run ID and metric ID and a citation artifact explicitly published by that result. It does not join across steps, accept failed results or foreign runs/artifacts, or invent missing values. Corresponding positive and negative cases were added. This is a UI presentation correction; it changes no acoustic formula, physics, audio, Domain, Host, original tolerance or model authority.

Comparison returns six frequency bands, so a bilingual Frequency Hz column was also added.125,250,500,1000,2000 and4000 Hz are distinguishable; a null band displays “—”. Scientific values retain the existing format without thousands grouping.

<!-- english-original-anchor --> <a id="最終實際操作"></a>
## Final actual operations

| Stage | Visible result |
| --- | --- |
| Select floor and enter material.hard | Preview contains floor/material IDs and leaves scene revision0 unchanged. Explicit Apply produces revision1, Inspector shows hard and Host Undo is available. |
| Create a1-second baseline | RunSimulation → CaptureExperiment → AnalyzeAcousticResults all show completed. |
| Enter material.soft | Preview does not change the scene. Explicit Apply produces revision2, Inspector shows soft and the baseline run ID is retained. |
| Compare with the same motion | Candidate RunSimulation → CaptureExperiment → AnalyzeAcousticResults → CompareExperiments all show completed; candidate and baseline run IDs differ. |
| Undo Last AI Apply | Revision2 →3; Inspector returns to hard and the now-undone Host Undo becomes disabled. |
| Enter an unauthorized OS/API-key instruction | Shows that the request exceeds the allowed tool scope and the scene is unchanged, with no applicable preview and no revision change. |
| Preview/apply an added box, then request same-motion comparison | RunSimulation shows failed. The Host explicitly rejects reusing the old motion trace after geometry/initial-pose and similar changes; it retains the baseline and shows no fabricated metric table. |

The final baseline is `run.tool.29a09c8556e4804d220d0df102e0543610ea05c1`, and the candidate is `run.tool.c3b925507a2600f708d0df36d4fee4916623b3ea`. At1000 Hz, the baseline directArrivalTimeS table value is **0.017067 s**; the original Host explanation retains fuller precision. All six candidate bands also show0.017067 s, with no claim that material changes caused an improvement. rt60S stays unavailable in the baseline and every candidate band, because finite paths and Synthetic late reverb do not constitute a complete IR from which RT60 can be derived.

The UI table presents metrics already cited by the candidate. This receipt does not read replayTraceId through a runtime bridge or execute the Host independently. Existing Host validation supports the matched-motion tool contract; this round adds an operable end-to-end UI success path and evidence of incompatible-scene rejection.

<!-- english-original-anchor --> <a id="驗證與來源"></a>
## Verification and sources

- Final `node --import tsx --test src/ui/pipeline-workflow-model.test.ts src/ui/pipeline-ui.test.ts src/ui/controller-ports.test.ts src/ui/locale-model.test.ts`: **22/22 PASS** (helper5, pipeline SSR8, ports2, locale7).
- Final scoped ESLint and Prettier check for7 files: **PASS**. The first run after adding frequency-band cases was21/22 because the test incorrectly expected thousands grouping for frequency. The assertion was corrected to follow the existing formatter; original stdout is retained and the product formatter was not changed.
- `npm run build`: **PASS**, including TypeScript. The existing large-bundle warning is retained; build success is not extrapolated to performance acceptance.
- `node node_modules/@playwright/test/cli.js test --config tests/browser/meta-ui-workflow.config.ts`: final **1/1 PASS,21.2 seconds**. Scenario receipt times are2026-11-02 06:25:40–06:25:54 UTC; total CLI time includes startup.
- Final agent API requests, blocked planning/external requests and page errors are all **0**. Routing prevents paid planning and external HTTP requests before dispatch; it does not send requests first and then rely on a zero-budget guard.
- The final entry JS is `index-CsQTPNJk.js`, SHA-256 `a8a4950a569a02a93ae1dbf7dc664440458eee928ee99ca1fafe897d7a9d1be0`. Actual entry/CSS HTTP bytes are in the receipt; build-artifact-manifest covers non-sourcemap files from that complete production build.
- source-manifest records hashes/bytes for the7 UI-source and new independent-verification files. Root will commit them together later; no commit SHA is invented here.

Original files are under [04-meta-ui-evidence](../../../14-core-pipeline/stages/04-meta-ui-evidence):

- `UI_WORKFLOW_RECEIPT.json`, `browser-final.txt`/process: the final complete workflow including the frequency-band column.
- `UI_WORKFLOW_RECEIPT-initial-fail.json`, `browser-initial.txt`/process, `initial-failure.png` and `initial-error-context.md`: the initial actual-UI gap.
- `UI_WORKFLOW_RECEIPT-before-frequency-pass.json`, `browser-before-frequency-pass.txt`/process: the successful snapshot after correcting source associations but before adding the frequency column.
- `targeted-unit-frequency-initial.txt`: the21/22 formatting-assumption failure; `targeted-unit-final.txt` records22/22.
- `material.hard-preview.png`, `material.soft-preview.png`, `baseline-completed.png`, `candidate-comparison-completed.png` and `incompatible-comparison-rejected.png`: final production screenshots.
- `artifact-manifest.json` indexes local-cache locations for large traces and all evidence hashes. Traces remain in the project's `.cache/meta-ui-workflow-receipts/` rather than being added to Git in bulk.

<!-- english-original-anchor --> <a id="claude-code-複核入口"></a>
## Claude Code review entry

Read the initial FAIL first, then check citation/metric/run/artifact relations within successful results and their positive/negative cases. Start an independent production preview on4173 and rerun this config to reproduce the complete workflow, Undo and rejection cases. Retain unavailable RT60 and frequency-band data; do not convert missing values to zero or claim improved absorption. Final manual testing, actual hearing, Meta live and overall product/performance gates still depend on their respective formal evidence. Root's export receipt separately preserves its actual audio-source and bundle snapshot.
