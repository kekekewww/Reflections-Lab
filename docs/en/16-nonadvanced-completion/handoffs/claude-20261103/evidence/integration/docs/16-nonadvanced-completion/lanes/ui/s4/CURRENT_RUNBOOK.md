<!-- english-source: {"path":"docs/16-nonadvanced-completion/handoffs/claude-20261103/evidence/integration/docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_RUNBOOK.md","sha256":"ba8eb1c2205f38972812b76f4c816b810a3ed25a8df8f8f2490c1d82c97a49ae","translated_at":"2026-11-03T09:52:55.809Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/handoffs/claude-20261103/evidence/integration/docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_RUNBOOK.md`](../../../../../../../../../../../16-nonadvanced-completion/handoffs/claude-20261103/evidence/integration/docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_RUNBOOK.md). Source SHA-256: `ba8eb1c2205f38972812b76f4c816b810a3ed25a8df8f8f2490c1d82c97a49ae`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="s4-current-source-runbook"></a>
# S4 current source runbook

This is source preparation after normal merging of Root snapshot `b7ade6727f50bac4544dd8d933729b6a13880a14`; subsequent Store/Runtimeopts integration, product build, formal browser freeze and full 22-route GO remain Root's responsibility. No browser commands in this document have run; 249 mixed registry rows do not mean 249 unique parameters, independent cases or validated items.

<!-- english-original-anchor --> <a id="root-final-freeze-commands"></a>
## Root final freeze commands

In the final integration tree, first confirm product and browser-test inputs are committed and the built production directory matches existing `http://127.0.0.1:4173` bytes, then obtain an exclusive browser lease. The runner itself neither builds nor starts a server. Names below must be fresh; existing freezes/attempts are not overwritten.

```text
node tests/browser/nonadvanced/run-s4-ui.mjs --lanes all

node tests/browser/nonadvanced/run-s4-ui.mjs --capture-freeze --freeze docs/16-nonadvanced-completion/lanes/ui/s4/freeze-s4-final-01.json --dist dist --lease root-s4-exclusive-01 --browser-executable "C:/Program Files/Google/Chrome/Application/chrome.exe" --browser-version "<Root實測完整version>"

node tests/browser/nonadvanced/run-s4-ui.mjs --execute --freeze docs/16-nonadvanced-completion/lanes/ui/s4/freeze-s4-final-01.json --attempt s4-final-01 --lease root-s4-exclusive-01 --lanes all --keep-going --lane-timeout-ms 1200000
```

The first command only lists the plan, without network/browser; the second reads built files, source, executable and local HTTP, without opening a browser. Only the third starts 22 sequential routes, one child at a time, Playwright workers1. The default `--lanes` is recovery only; `all` must be explicit for all 22 routes. Without `--keep-going`, execution stops at the first failure; with it, failure exit 1 remains and cancellation cannot be negated.

The freeze must freshly capture all actual tracked src/server/schemas/public/tests/browser, build inputs, canonical tokens, two original formal priority source-provenance documents, registry, immutable combined fixture and formal TopMonitor requirement. Old preparation receipts/plans' UNFROZEN sourceSnapshot and fixed owner1c6 pins remain historical and cannot be a new bundle freeze; Root's new preparation-locale source cannot inherit current PASS from the older38 cases.

<!-- english-original-anchor --> <a id="existing-route-budgets-and-completion-boundaries"></a>
## Existing route budgets and completion boundaries

Every route's outer-child timeout defaults to1200000 ms (20 minutes), configurable explicitly within 1000..3600000 ms; thresholds are neither changed nor shortened here. Below are original per-test config timeouts, preserving original expect/numeric/fixture assertions; direct scripts have no uniform per-case hard limit. Counts are source counts of top-level tests or selected checks, not semantic-family counts.

| route | Source cases/selected-check count | Original per-test timeout |
| --- | ---: | --- |
| interaction-main | 18 | script; no per-case hard limit |
| interaction-completion | direct script | script; no per-case hard limit |
| interaction-priority | direct script | script; no per-case hard limit |
| scene-inspector | direct script | script; no per-case hard limit |
| scene-environment | direct script | script; no per-case hard limit |
| scene-curved | direct script | script; no per-case hard limit |
| behavior-rules | direct script | script; no per-case hard limit |
| behavior-assets | direct script | script; no per-case hard limit |
| audio-monitor | direct script | script; no per-case hard limit |
| audio-monitor-retest | direct script | script; no per-case hard limit |
| pipeline-agent | 3 | 150 s/test |
| pipeline-dock | 3 | 120 s/test |
| pipeline-events | 4 | 120 s/test |
| pipeline-motion | 7 | 120 s/test |
| pipeline-zones | 6 | 150 s/test |
| pipeline-render | 4 | 150 s/test |
| pipeline-tail | 1 | 240 s/test |
| pipeline-diagnostics | 1 | 150 s/test |
| pipeline-combined | 1 | 240 s/test |
| interaction-help | 1 | 180 s/test |
| recovery | 7 | 180 s/test; public60 case300 s |
| top-monitor | 3 | 180 s/test |

Recovery's original test timeouts can total 23 minutes, a different boundary from the outer20 minutes. This does not mean actual execution needs23 minutes, nor guarantee that every test can exhaust its own timeout inside the outer limit. Public60-second capture needs at least its real60 seconds of tick sampling; full offline render, individual downloads and 119MB byte checks add time afterward. This round has no measured wall duration to promise.

A full execute-all has 23 HTTP-check groups (initial preflight1 + each lane's postcheck22), or24 total if freeze capture runs first. Each group allows15 seconds for HTML plus30 seconds per unique JS/CSS asset, sequentially.22×20 minutes＝7hours20 minutes is only the sum of child budgets; ordinary stop adds nominally about11seconds/lane, Windows catch cleanup about 16 seconds. Git, log opening, file I/O, staging, receipts and joins have no deadlines; HTTP pre/post is also outside the child timer. **The whole run currently has no hard walltime limit.** Root must schedule/supervise the total lease, without interpreting these numbers as measured speed or a complete wall cap.

Completion still requires original per-case assertions, raw state and actual outer exit; source/exe and actual HTTP bytes are rechecked after every lane. `current-results.json` only joins real raw/case/steps row by row pending independent review, without suite exit 0→batch family PASS. Hidden/unavailable/optional-port items lacking conditions remain unobserved or at their applicable unit/component layer; Playwright does not become native/hearing/formal performance evidence.

<!-- english-original-anchor --> <a id="artifacts-and-constrained-ports"></a>
## Artifacts and constrained ports

Each fresh attempt saves under `docs/16-nonadvanced-completion/lanes/ui/s4/attempts/<attempt>/`: Root freeze/run receipt/current-results; each lane's stdout/stderr/actual-exit, adapter-proof and independent browser-UUID guard; specs additionally have Playwright JSON, trace/screenshots. Current cases also save receipts, DOM screenshots, real downloads and independent RIFF/hash/stem checks. Copies and large caches are in this tree's `.cache/nonadvanced-s4/<attempt>/`; historical legacy files are unchanged, old raw is not deleted and large WAVs are not automatically staged.

This round's three small ports have true new RED 0/3→GREEN 3/3: monitor-retest retains original strict assert but receives full `/assets/index-*.js`; diagnostics updates declaredSource only in the copy; Held only aligns the original Place lookup to current Gentle place for the same bounded gentlePlace action, leaving G/disabled/outcome flow unchanged. Original numerical tolerances, caps, fixtures and historical files are unchanged; the adapter's6 affected preservation cases validate20 legacy sources/assertions, result6/6, without rerunning the full older38.

Root's process ledger must still verify actual browser-descendant cleanup. A process receipt's terminal means only that its owned Node exited; controlled cancellation has pure-Node cleanup tests, but a normally exiting terminal field cannot claim whole-tree absence.
