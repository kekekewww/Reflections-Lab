<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/diagnostics/REPORT.md","sha256":"90a2c25672e80690c2c930ac5042eeaa4083c5efc2636bf2444c1279935a6437","translated_at":"2026-11-02T07:48:47.6232379+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/diagnostics/REPORT.md`](../../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/diagnostics/REPORT.md). Source SHA-256: `90a2c25672e80690c2c930ac5042eeaa4083c5efc2636bf2444c1279935a6437`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="效能面板全參數盤點"></a>
# Performance panel: complete parameter inventory

This independent run operated the existing production preview `http://127.0.0.1:4173` in Chrome 156.0.8078.75. It used only on-screen pointer/keyboard interaction, buttons and DOM reads; no HostInternal, runtime bridge, test-data injection, paid model, permission prompt or product-code changes. This validates panel parameters/states, not device hearing, PCM continuity, DSP callback CPU or complete performance acceptance.

<!-- english-original-anchor --> <a id="實際範圍與結果"></a>
## Actual scope and results

The machine-readable inventory is `parameter-inventory.json`, totaling **28 items**:

- 6 interactive controls: the cost-observation checkbox, breakdown details summary, control-thread scope explanation and 3 help buttons.
- 19 read-only metrics: 8 summary cards and 11 breakdown-table rows.
- 2 read-only states: native output and observation-enabled/retained state.
- 1 nonexistent operation: refresh is explicitly **ABSENT_NOT_A_CONTROL**. The panel updates displayed data through normal publication; there is no manual-refresh button.
- No numeric editing fields exist. Read-only metrics and a native binary checkbox do not accept arbitrary numeric/string boundaries, so invalid/min/max checks are explicitly inapplicable rather than fabricated editable parameters.

The actual browser test was **1/1 PASS, 34.7 seconds**. Scenario receipt time is 2026-11-02 06:39:14–06:39:36 UTC; total CLI duration includes startup. It passed on the first run with no product defects or overwritten failures.

| Operation | Actual observation |
| --- | --- |
| Listening not enabled yet | Cost-observation checkbox disabled/unchecked; native state reads "No native output observation yet", and unknown summary/breakdown values remain "—" |
| Scope and 3 help controls | Pointer interaction shows explanations; Escape closes them. Scope explicitly excludes DSP callback CPU, PCM continuity and hearing |
| Update costs and breakdown counts | Click opens 11 rows; Enter closes; Space reopens, preserving native details behavior |
| Enable listening | Checkbox becomes usable and checked; the UI actually displays "Waiting for the next native count". No browser dialog or permission prompt appears |
| Start simulation | At tick 94, accepted/rejected frames are 37/0 and readouts update automatically; values are not injected through the panel |
| Disable cost observation by pointer | Displays "Observation disabled; showing retained data". Simulation ticks advance 142 → 202 while all 19 readouts remain unchanged |
| Switch to audio export and return | Disabled state persists without re-enabling on a tab change |
| Re-enable with pointer and Space | Both Off/On states work; accepted-frame counts resume increasing, with a later snapshot at 58/0 |
| Pause and switch to English | Performance remains the selected tab, checkbox/details states persist, and English labels/help are visible |

<!-- english-original-anchor --> <a id="原生狀態與限制"></a>
## Native states and limitations

This browser actually displayed **NOT_OBSERVED → WARMUP → AVAILABLE**. One short AVAILABLE window reported 501.7 ms, browser-reported output latency 48 ms and output underruns 0/0 ms. Only AVAILABLE treats these native fields as observed numbers; earlier unknown/warmup values remain "—". These readouts do not establish measured physical output latency, zero PCM gaps, long-term stability or a device-hearing pass.

**UNSUPPORTED and COUNTER_RESET did not actually occur in this browser**, and the machine-readable inventory records `NOT_EXERCISED_IN_THIS_BROWSER`. No UI operation can force those two native conditions. This round neither overrode browser functionality nor injected counters to pretend coverage. Existing unit contracts can separately validate those presentation branches but cannot stand in for actual browser results from this run.

<!-- english-original-anchor --> <a id="證據與重現"></a>
## Evidence and reproduction

- Validation file: `tests/browser/parameter-audit/pipeline-render-performance-diagnostics.spec.ts` and the config with the same prefix.
- Rerun command: `node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-render-performance-diagnostics.config.ts`. Requires a separate production preview 4173 already running; the config starts no server and does not rebuild the product.
- `browser-initial.txt`/process: actual browser stdout, exit code and time.
- `performance-parameter-receipt.json`: stage-by-stage DOM, checkbox, readouts, native status, tooltips and actual HTTP-byte hashes for every loaded JS/CSS/entry HTML file.
- `parameter-inventory.json`: all 28 classifications, UI operations/observations and states not triggered.
- `performance-observed-zh.png`, `performance-observed-en.png`: actual production screenshots; screenshots or token calculations do not establish comprehensive visual usability.
- `source-and-artifact-manifest.json`: hashes of validation files, read-only source and evidence. Large Playwright traces remain under ignored `test-results/parameter-audit-performance-diagnostics/`, with their index and hashes recorded alongside.

The actual entry is `index-BDGeI4Sd.js`, SHA-256 `e9bbc4e496c9dfbe51a03f87f24f781caed1df166f9e2a249ebe172d4ab4e08d`; dynamic UI is `App-hX50zr2p.js`, SHA-256 `8b39a7b34d4065c24ff704a35d7c0ed475ce2b4d90cce832799494af3e1f1511`. Source 19db9f9 is the build point supplied by the coordinator; this run independently pinned the actual network-fetched contents and does not invent a new commit.

Page errors, browser dialogs and blocked paid/external requests all remained 0. No product, shared configuration, Git index or persistent Wiki was changed; the main agent handles later unified registration and commits.
