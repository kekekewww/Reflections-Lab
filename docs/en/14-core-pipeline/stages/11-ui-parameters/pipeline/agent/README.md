<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/agent/README.md","sha256":"2b46c5b27ef7d440cef7d92ca6e127b30a1f2651e2cb77389e331bb877e704ae","translated_at":"2026-11-02T10:56:45.575Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/agent/README.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/agent/README.md). Source SHA-256: `2b46c5b27ef7d440cef7d92ca6e127b30a1f2651e2cb77389e331bb877e704ae`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-agent-與實驗流程參數驗證"></a>
# Meta Agent and experiment-workflow parameter validation

Status: **actual browser interaction passed within the specified scope**. This round added/adjusted only independent tests and receipts. It changed no product code, Git index, paid settings or acceptance thresholds.

The coordinator designated formal candidate `49bde82be6f9def5058bc8f3076e105fcdfd535d`. All three cases actually loaded entry `index-C4qRBPy8.js`, SHA-256 `8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123`. The Git commit comes from the lease notice; this run independently read and checked the entry's HTTP bytes. Uncommitted versions of the tests are separately pinned by file hash; no commit was invented for them.

<!-- english-original-anchor --> <a id="執行結果"></a>
## Execution results

`PIPELINE_AGENT_ATTEMPT=final-49bde82-01`; `PIPELINE_AGENT_SOURCE_HINT` records the complete candidate and entry hash. Command:

```text
node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-agent-audit.config.ts
```

Three cases: **3/3 PASS, CLI exit0,42.5 seconds**. One worker, independent fresh contexts, headless Chrome,1440×1100 and normal scale. The configuration connects to the existing production preview on4173 without starting/rebuilding a web server. Original JSON records Node/Chrome versions, per-case timing and loaded JS/CSS hashes.

| Case | Actual interactions |
| --- | --- |
|01 provider/prompt | Blank-input blocking;4001→4000-character input cap; Enter newline; Ctrl+Enter preview; keyboard focus in the diff; cancel preview; hover/click/focus/Escape/Tab blur-refocus for five help callers; Chrome composition-input guard; unknown/out-of-scope command rejection; actual API status/refresh; Meta→offline; stale-revision preview rejection. |
|02 duration/cancel | Empty,0,−1 and11 show errors; Escape restores;1-second blur commit;10-second Enter commit; ArrowDown/Up10→9→10; Host rejects1.01 seconds; actually cancel an initiated10-second run and receive Host acknowledgment. |
|03 complete loop | During simulation, pointer-apply hard through Pause and apply operation;1-second baseline Run/Capture/Analyze; steps and original-description disclosures; keyboard-apply soft; candidate Run/Capture/Analyze/Compare; Host Undo; reject baseline-motion reuse after geometry is added. |

All three cases had no page errors, blocked external/paid requests or Agent POST. Case01 made only two actual `GET /api/agent/status` requests triggered through the UI.

Teardown completed before this report was assembled. The original worker PID90776 had exited, and surviving owned controller/worker child processes numbered **0**; no Chrome instance retained the next lease. See `run-final-49bde82-01-process.json`.

<!-- english-original-anchor --> <a id="逐項清單與來源"></a>
## Per-control inventory and provenance

`CONTROL_INVENTORY.json` points only to the latest `OBSERVED_CONTROLS-final-49bde82-01.json`, which aligns with the central14 Agent/Workflow semantic families. Five independent caller instances additionally map to shared `help.{callerTopic}`. All19 named control instances have this run's interaction evidence; one generic tooltip pass is not substituted for every caller. Each entry has actual context, input/bounds, disabled observations and original-outcome references.

The five help callers are execution method, AI Undo, experiment command, operation preview and experiment workflow. Each records topic, instance ID, sourceCallerRefs, original visible wording and actual click/focus/Escape results.

Model, API key, budget and editable context have no UI controls and are recorded as `ABSENT_NOT_A_CONTROL`. Selecting floor and changing the Inspector revision are actual interaction-context dependencies, not a fabricated context editor.

<!-- english-original-anchor --> <a id="關鍵觀察"></a>
## Key observations

- Meta's actual status says it is blocked: NETWORK_DISABLED; Live validation NOT_RUN; remaining credit unknown. Its proposal button is actually disabled. Root's separate zero-budget backend receipt is `docs/15-ui-parameter-audit/evidence/ROOT_GATED_API_REFRESH.json`. This run did not rename unknown UI data as measured zero or attempt live planning.
- The native textarea limits4001 UTF-16 code units to4000; blank commands produce no preview. Ctrl+Enter does not submit during Chrome composition set by `Input.imeSetComposition`; normal submission returns after composition is canceled. This is browser-input-protocol evidence, **not native OS/human IME**. No DOM composition event or HostInternal access was injected.
- After an external Inspector change to the scene revision, the old preview rejects with `REVISION_CONFLICT`, preserving the externally set soft material.
- With1.01 seconds retained in the field, native validity stepMismatch is true while aria-invalid is false. Submission then makes the Host explicitly show `DOMAIN_INVALID：實驗時長必須是 1/60 秒的整數倍。` This is not a successful experiment and does not bypass Domain validation.
- Actual cancellation displays Host-confirmed cancellation with no subsequent steps executed, and experiment stopped. Duration/baseline become available again; compare remains disabled without a baseline. This round captured actual cancellation and did not use a partial branch for an uncaptured transient.
- Baseline run is `run.tool.ad841bb317378d808e023061464809f82fb073c6`; candidate is `run.tool.9f0013f38764214f4e5ef38af2e297b0d00f14eb`. They differ and the baseline remains. All three baseline steps and four candidate steps show completed.
- The directArrivalTimeS table shows **0.017067 s**; the original description retains0.01706715921524334 s. The candidate's six bands125/250/500/1000/2000/4000 Hz are distinguishable; rt60S remains unavailable in every band. Synthetic late reverb or limited paths were not presented as a fully analyzable IR, and no material-improvement claim was made.
- Undo changes revision2→3 and restores hard; a second Undo is disabled. After adding a box, RunSimulation that reuses motion is rejected without a fabricated metrics table.

<!-- english-original-anchor --> <a id="證據與歷史"></a>
## Evidence and history

- `01-provider-prompt-final-49bde82-01.json`, `02-duration-cancel-final-49bde82-01.json`, `03-closed-loop-final-49bde82-01.json`: per-case control snapshots, outcomes, GET/POST/pageerror and HTTP asset hashes.
- `playwright-final-49bde82-01.json`, `run-final-49bde82-01.txt`/process: raw framework results, command exit and teardown.
- PNGs containing `final-49bde82-01`: this run's input, preview, provider, stale guard, cancellation, baseline, candidate and rejection views.
- `SOURCE_AND_EVIDENCE_MANIFEST.json`: pins this run's two test files, product caller sources and original evidence hashes. Large traces stay in project `.cache/pipeline-agent-parameter-audit/`, without bulk Git inclusion.
- `run-initial.txt`/process and `playwright-initial.json`: the earliest test callback fixture had an invalid destructuring signature before product interaction. The coordinator relocated the reporter's exact original bytes; see parent `REPORTER_RAW_RELOCATION.json`. Raw results were not polished.
- `01-provider-prompt-fixture-fix.json` and `lease-interruption.json`: case01 succeeded on the older19db candidate, while the older API did not return JSON. The coordinator paused that run and the other two cases did not run. These remain historical and do not stand in for the new gated API or final three cases.
- `STATIC_READY.json` is a static pre-execution checkpoint, not a substitute for this run's browser results. `own-process-check.json` retains the older process-exit inventory.

<!-- english-original-anchor --> <a id="適用範圍"></a>
## Applicability

This run verifies representative valid/invalid values, bounds, keyboard/pointer methods and triggered state dependencies for named controls. It does not exhaust every transient, state ordering, natural-language command, overflow situation or OS input method. Native OS IME, native Mac Cmd, Meta live, human keyboard/mouse, hearing, scientific measurement,600-second performance and full V1 gates remain separate. The disabled transient while cancellation waits for acknowledgment is supported by existing contracts/regressions separately. This run directly preserves disabled running controls and the final Host acknowledgment; an unpreserved intermediate transient is not marked browser PASS.

No confirmed defect requiring product changes was found in this run. The native/ARIA state difference for1.01 seconds remains verbatim for Claude Code to assess whether input feedback needs adjustment. Next, the coordinator integrates this per-control evidence. Claude Code may rerun the three cases on the same gated backend and formal build before user manual testing.
