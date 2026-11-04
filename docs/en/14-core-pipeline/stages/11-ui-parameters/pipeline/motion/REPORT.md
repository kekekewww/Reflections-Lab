<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/motion/REPORT.md","sha256":"f719f60f0ca7a106ad2b4ad750b5e775c391394172b9d2e39de34f9ab3015007","translated_at":"2026-11-02T11:06:31.1581307+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/motion/REPORT.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/motion/REPORT.md). Source SHA-256: `f719f60f0ca7a106ad2b4ad750b5e775c391394172b9d2e39de34f9ab3015007`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="motion-參數稽核與版本化重驗"></a>
# Motion parameter audit and versioned revalidation

Current status: **COMPLETE_IN_LISTED_UI_SCOPE_WITH_VERSIONED_EVIDENCE**. The original five passing scenarios retain 49bde82 as their source; the affected recording/replay scenario passes separately after the narrow 9fc repair. This does not claim all six scenarios were rerun on the same new source, nor extend 23 expanded control definitions/a single family/old-version native stepper checks to every value combination.

The official new source is `49bde82be6f9def5058bc8f3076e105fcdfd535d`, using actual Chrome 156.0.8078.75/production 4173 HTTP entry `index-C4qRBPy8.js`, SHA-256 `8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123`. Each scenario separately pins loaded JS/CSS bytes. All actions use public DOM forms, buttons, file inputs and downloads. evaluate only reads DOM/native validity; there is no HostInternal, runtime bridge, paid API or claim of human keyboard/mouse/hearing testing.

<!-- english-original-anchor --> <a id="已完成的實際範圍"></a>
## Completed actual scope

Of six scenarios in `final-49bde82-01`, **5 PASS/1 FAIL, 1.6 minutes**, with CLI exit 1 retained honestly:

- No-object/fixed/dynamic states; ID pattern, 64-character valid/65-character truncation; each of seven moveTo numeric fields' min/max, out-of-range/empty values and Enter/Escape.
- Impulse axes −1000/1000/1001; actual vector `[2,1,-1]` saved/downloaded/Run applied; `[10,10,0]` atomically rejected because its L2 norm exceeds limit 10.
- Dynamic moveAndRelease preserve/zero authoring values; Undo/Redo verified through actual downloads, zero actually Run reached; Remove/valid Import and retention of original actions after malformed/schema/foreign-scene/foreign-object rejection.
- Kinematic zero/transfer and gravity/noGravity authoring values, acceleration disabled; legal trajectory imported through public JSON Import and Run reached; kinematic impulse Run explicitly rejected as EXPECTED_UNAVAILABLE_VERIFIED.
- While Motion is active, authoring/Import disabled and Export still available; keyboard Enter cancellation shows cancelled; timeout shows timedOut; changing scene body mode makes the action stale and Run disabled, with public Rebase restoring Run.

Concrete values, methods, limitations and actual action instances are in `COVERAGE.json`. Kinematic release authoring values were checked for persistence; this does not infer release-velocity/mode physics details that DOM checks did not inspect. Imported advanced parameters do not establish UI testing of every schema combination.

<!-- english-original-anchor --> <a id="真負載限制與新候選分開記錄"></a>
## Real load limit and new candidate recorded separately

The original sixth scenario's actual live recording hit fixed-step safety/load protection at **tick 5**. DOM explicitly stated that debt was retained and the user could continue in batches or explicitly stop and seal. This is a **real observed safety/load guard/known performance limit**. The test's assumption that it could passively wait for tick 180 was invalid. Original FAIL, screenshots, trace and UI text remain; the guard was not treated as a fake test event.

After coordination, only that scenario changed to a public workflow: verify recording disables authoring → explicitly Stop and seal the short prefix → use Render's "Record 3 seconds" to create a stable replay source. Narrow retest `final-49bde82-02` again **FAIL**:

- Before Stop, the header was **tick 7/0.12s/Paused**.
- Stop disappeared and Replay became enabled, proving that the original prefix was sealed.
- The new public "Record 3 seconds" actually displayed `SHORT_TAKE_INTERRUPTED: fixed step did not complete`.
- The world reached **tick 10/0.17s**, but the new artifact contained only **0.03s** and displayed "Interrupted recording sealed; not replayable".
- Replay authoring-disable/end-restoration checks therefore remained **NOT_RUN**, without Scene reset or internal clock operations as a bypass.

Exact full steps, HTTP pins, identifier availability, original UI text, stdout/trace/PNG paths and source comparisons are in `SHORT_TAKE_DEBT_CANDIDATE.json`. The residual fixed-clock-debt relationship across Stop/mode transitions was sent to the Runtime owner for investigation. This report labels the cause a hypothesis and the UI failure a direct observation. Do not relax the exact-step guard or claim healthy performance from later successful controlled capture.

<!-- english-original-anchor --> <a id="9fc-窄修後原序列重驗"></a>
## Original-sequence revalidation after the narrow 9fc repair

Source: `9fcf3f0657813f5aa07bf936a1cb6a50f2628f30`; actual entry `index-DO7iDxDy.js`, SHA-256 `5c75259d334399afeab1c53a5d32e0e7a3b4067f862b245836fdd542b96e7819`. Only the affected scenario was rerun: **1/1 PASS, 25.3 seconds, CLI exit 0**. The original five scenarios were neither rerun nor reassigned to the new source.

The original load branch occurred naturally in this run; DOM actually showed fixed-step overload and retained debt. After public Stop, the downloaded prefix was `captured`, 5 frames, ticks 1–5, run `recording.1b4960c7-d0d4-4fda.capture.1`. Then the public "Record 3 seconds" produced a new downloaded artifact: `captured`, **180 frames, ticks 6–185 all contiguous**, new run `recording.86fa73bc-d835-4ab5.capture.2`. Both files came through the UI's "Export sealed recording"; frameCount matched actual frames.length. There was no Scene reset, clock injection, internal call or relaxed protection.

During replay, Motion Save/Import are actually disabled; explicit End replay restores Save. 180 frames were verified from downloaded JSON. Slider maximum is recorded only, without treating UI millisecond steps or rounded displays as frame-correctness evidence. Full receipts and all tick/run IDs/download SHAs are in `SHORT_TAKE_DEBT_RESOLUTION.json` and `final-9fcf3f0-02/`.

`final-9fcf3f0-01` retains a newly introduced literal harness error: artifact.status was incorrectly asserted to equal workflow `completed`; the actual schema and prefix both use `captured`. That attempt stopped at the prefix check before running the new controlled capture, so it is **not evidence that the repair failed**. Only two status assertions changed before revalidation. The official artifact enum is `captured | interrupted | cancelled`, separate from UI finalized and Host-workflow completed.

Original `49bde82` failures remain fully retained rather than rewritten PASS. The safety/load limit remains an actual observation. Later controlled-sampling success does not establish healthy ordinary interactive recording performance, 600-second performance or device hearing.

<!-- english-original-anchor --> <a id="其他證據與限制"></a>
## Other evidence and limitations

- Old `19db9f9 / index-BDGeI4Sd` browser-native stepper short scenario: **1/1 PASS**. Target X, speed and timeout ArrowUp/Down and actual native-spinner pointer actions retain before/after values, actual bbox/padding/border coordinates and screenshots. This proves only those three concrete fields on the old source; see `native-stepper-summary.json`.
- MotionPanel and MotionDock wrapper **have no HelpTip caller**, classified ABSENT_NOT_A_CONTROL. NumberField native title/field-error text are recorded separately without borrowing a generic HelpTip PASS.
- Every executed new scenario has 0 page errors/API requests; absence of exceptions is not a whole-product PASS.
- Latest own spec/config scoped ESLint/Prettier PASS is in `scoped-eslint.txt`/`scoped-format.txt`.
- Retain the initial attempt01's two locator errors and resource-lease interruption rather than labeling them product defects.
- Each new run confirmed 0 owned CLI/worker/Chrome children afterward; all new browsers stopped. Product code, guards and Git index were unchanged.

The original candidate converged through a Runtime narrow repair and revalidation of the original public-UI sequence. Claude Code independently reviews the versioned receipts next. The five passing scenarios, original load limit, old/new failures and 9fc success each retain their own source. This does not claim full V1, every import-only advanced combination, every release-physics detail or formal performance acceptance.
