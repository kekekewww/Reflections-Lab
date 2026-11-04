<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/SERIAL_BROWSER_PLAN.md","sha256":"a90951b96729359b64c469cd5042ff3f3cad363203acd83bf594e8dc8915c936","translated_at":"2026-11-02T10:15:14.383Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/SERIAL_BROWSER_PLAN.md`](../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/SERIAL_BROWSER_PLAN.md). Source SHA-256: `a90951b96729359b64c469cd5042ff3f3cad363203acd83bf594e8dc8915c936`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="最終-pipeline-真-dom-串行驗證計畫"></a>
# Final Pipeline actual-DOM serial validation plan

Status: all 22 cases STATIC READY / WAITING ROOT EXCLUSIVE LEASE. Root supplied candidate product 49bde82be6f9def5058bc8f3076e105fcdfd535d and entry index-C4qRBPy8.js / SHA256 8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123; each actual batch still records HTTP bytes independently. This batch has not run. The method is **Playwright CLI scripted DOM / headless Chrome**, not native-app or MCP operation. Evidence of Root's three incomplete native-app attempts is stored separately; this batch does not replace those method labels.

Everything runs in `D:/Developing/Meta Hack/.worktrees/integration`, connecting to the existing production preview on 4173. Do not start a dev server, build, or modify the product/Git. Execute only after Root supplies the final candidate and browser lease. At most one Chrome may run at once; start the next batch only after the previous CLI finishes and its fixture teardown completes. Each retry uses a new attempt, preserving original FAIL/interrupted/success cutoffs.

Common command prefix: `node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/`. Append the following configs and filters to that prefix in order.

| Order | Config and filter | Cases | Attempt/source environment |
| --- | --- | --- | --- |
| 1 | `pipeline-events-audit.config.ts --grep 'events controls cover finalized recording replay seek and normalized event evidence'` | 1 | PIPELINE_EVENTS_ATTEMPT, PIPELINE_EVENTS_CANDIDATE |
| 2 | `pipeline-dock-paths-comparison.config.ts --grep 'comparison controls'` | 1 | PIPELINE_DOCK_ATTEMPT |
| 3 | `pipeline-agent-audit.config.ts` | 3 | PIPELINE_AGENT_ATTEMPT, PIPELINE_AGENT_SOURCE_HINT |
| 4 | `pipeline-motion-audit.config.ts --grep-invert 'native keyboard and pointer'` | 6 | MOTION_AUDIT_ATTEMPT |
| 5 | `pipeline-render-performance-render.config.ts` | 4 | PIPELINE_RENDER_AUDIT_ATTEMPT |
| 6 | `pipeline-zones-audit.config.ts` | 6 | PIPELINE_ZONES_BROWSER_LEASE=granted, PIPELINE_ZONES_ATTEMPT, PIPELINE_ZONES_CANDIDATE |
| 7 | `pipeline-render-performance-combined.config.ts` | 1 | PIPELINE_COMBINED_AUDIT_ATTEMPT; results from the first six batches cannot substitute for completion |

The first six batches total 21 cases, followed by one complete-pipeline case. Performance already has finite-state receipts, and native numeric increment/decrement for Motion has old-source receipts for three fields and two methods; do not add duplicate batches without cause. Old results retain their actual source/HTTP bundle pins and do not extend to the final source.

<!-- english-original-anchor --> <a id="每批共同收據"></a>
## Common receipts for each batch

- The Root candidate is a source hint. Separately retain hashes of HTML/JS/CSS actually loaded, Chrome version, start/end times, stdout/exit and itemized machine statuses.
- Use product UI clicks/keyboard/normal file upload/download only; evaluate reads DOM only. Do not call runtime/HostInternal/test bridges.
- Block paid propose and external HTTP; local actual public provider status may be queried. Root's gated API is offline available, Meta NETWORK_DISABLED, budget 0 and live NOT RUN; do not mock live status.
- Record PASS/FAIL/ABSENT_NOT_A_CONTROL/NOT_OBSERVED/not-run separately. One family example does not represent every instance/state.
- Preserve original reporter JSON bytes. Misplaced historical Agent/Motion raw files were hash-verified and moved back to canonical docs, as recorded in REPORTER_RAW_RELOCATION.json; do not format raw data.
- Preserve screenshot/trace/machine facts before classifying a failure as harness, prerequisite or product. Root assigns the owner for product changes; rebuild and retest the affected scope.

<!-- english-original-anchor --> <a id="主要待驗點"></a>
## Main pending checks

The final Events case waits for a new seal and runId before export, also verifying immutable archive reads. Earlier success for the two replay entries and reset keeps its respective source. Comparison uses global role=alert to verify A/B/geometry rejection messages, without treating an old error as the current result.

The three Agent cases cover the actual gated API, prompt/4,000-character cap, keyboard/browser CDP composition (not OS/human IME), preview/stale apply/Undo, duration/cancel, baseline/candidate/comparison and rejection. There are no editable model/key/budget/context fields.

The six Motion cases cover all remaining kinds/release/import/history/timeout/cancel/rebase and recording/replay disabled conditions. The first new Zone case includes actual pointer/keyboard operation of eight tabs. Six Zone cases cover all authoring/references/capacity/schema/occupancy events/recording/replay/A-B/Project roundtrips. Emitter attachment has no editing control; valid Project UI import is listed as a separate method.

The four Render cases include tail bounds, stems off/on, cancellation preserving the previous publication/retry, and individual WAV/manifest downloads. Before Enable Audio, first set Monitor to -40 dB through UI and verify downloaded manifest master.monitorGain=0.01. A subsequent separate receipt verifies actual Synthetic late-reverb true→false, without hiding the earlier completed result.

<!-- english-original-anchor --> <a id="最後完整管線"></a>
## Final complete pipeline

Prepare only one combined scene, without unrelated high-CPU batches: a dynamicNoGravity sphere ball moves horizontally through a Zone with MoveTo; an AlwaysOn nonlinear speed→gain curve and OnEnter/OnExit; the ball is a metal dynamicReflector and another speaker source supplies actual reflection evidence. Complete all author edits first and Save Motion last to avoid a stale pin. Immediately Pause through UI after Run, then record 3 seconds of fixed steps through UI, preserving the unfinished Motion.

Planned positions: ball from [-0.8,2,0] to [2.5,2,0], speed 1.5, acceleration 12, impulse limit 10, timeout 10; Zone center [0.2,2,0], half [0.4,0.5,0.5], hysteresis 0.05. The combined case sets speaker/Listener on the same side through normal UI. Clearly identify any imported authoring portion; do not present it as manually filled fields.

The actually downloaded recording JSON must prove object-position changes, raw/normalized Zone IDs, resolved mapping, and speaker order-1 reflection surfaceIds containing `ball.body`; reflection point/delay must change across ticks while path ID stays stable. The ball's own sound self-excludes, so it cannot prove reflection from its own body. Backend version/capability labels alone are insufficient.

Finally generate and individually download mix/master/dry/object stems and manifest, check each file's bytes/hash/WAV format and non-silent data, and pass them to Root's independent WAV verifier. Claim only bounded snapshot reflection and model results, not Doppler/focusing/RT60/human hearing or whole-product performance acceptance.
