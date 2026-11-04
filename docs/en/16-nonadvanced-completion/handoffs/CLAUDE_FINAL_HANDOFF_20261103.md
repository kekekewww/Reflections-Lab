<!-- english-source: {"path":"docs/16-nonadvanced-completion/handoffs/CLAUDE_FINAL_HANDOFF_20261103.md","sha256":"8a866cc91d8cc0da980df04e96ef7c1e036a84503bca3b7da9e084702aea3181","translated_at":"2026-11-03T15:10:12.338Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/handoffs/CLAUDE_FINAL_HANDOFF_20261103.md`](../../../16-nonadvanced-completion/handoffs/CLAUDE_FINAL_HANDOFF_20261103.md). Source SHA-256: `8a866cc91d8cc0da980df04e96ef7c1e036a84503bca3b7da9e084702aea3181`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="claude-接手結果與人工測試交接2026-11-03"></a>
# Claude handoff results and manual-test handoff (2026-11-03)

Executor: Claude Code (claude-opus-5-5), with implementation delegated to Codex (gpt-6.1-sol, xhigh). The starting source was the [Codex handoff report](CLAUDE_CODE_HANDOFF_20261103.md). This document explains what was completed after handoff, what has not passed, and how to begin manual testing. **This does not declare the entire first version complete.**

<!-- english-original-anchor --> <a id="版本"></a>
## Version

| Item | Value |
| --- | --- |
| Frozen product source | `544d8d9fe7d4c87a62e093a64fb54eb2584826d7` (src tree `0d9554956dec35b1b7d340f8ad7c206147e1cbd4`); later commits change only tests and documentation, with the exceptions in the next two rows |
| Interface pass before manual testing | `1be15d5c6c4694e419c091e79754ef999ec6cab6`: changes only `src/ui/styles.css` and `src/ui/top-monitor.css` (src tree `3924149dff4e79a6c08da785f098975cf7e77d11`); DOM/roles/copy unchanged; see “Interface pass before manual testing” below |
| Fixes for issues reported in manual testing | `c1002ac7` (first-person view jumps, default ball occasionally silent, src tree `6cb3d25a`) and `2f2aa2c7` (grab coming loose during fast turns, src tree `c4bab9cb`); afterwards `15e0282f`, `956ee761` and `f04fbbf8` change only browser tests. See “Fixes for issues reported in manual testing” below |
| Integration branch | `codex/nonadvanced-integration-20261103` (`.worktrees/nonadvanced-20261103/integration`) |
| Local Main | `main` at `D:/Developing/Meta Hack` merged this integration branch (merge commit recorded in the Wiki handoff); no push or deployment |

<!-- english-original-anchor --> <a id="已完成且有證據"></a>
## Completed with evidence

| Item | Result | Evidence |
| --- | --- | --- |
| Full `npm run check` | Research regressions, lint/types/formatting, runtime 2270/2270, build and licenses all passed; English mirrors were pending then and were later brought to 0 missing, 0 stale | [check-05 summary](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/05b93659973a4e404060aaf5180bef2962a50c90) |
| 7 runtime failures | 4 tests had not caught up with established rules; 1 was a product bug (pausing before enabling audio left it permanently stopped, now fixed); 2 were test timing races | [Causes and fixes](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/385f4c2cf785e3d91f983fddc4343ac978ad79c9) |
| Long output | whole63 passed the original thresholds (58/58), with master/mix/dry bit-identical to independent references; Chrome's multiple-input summation order was unstable, so summation was changed to pairwise | [attempt05](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/552f1d842deccea00ed85339657538521067d67b) |
| Product E2E (maintained refined v3) | Three clean launches plus missing-WAV relinking passed 4/4, with source and bundle consistent throughout | `artifacts/v1/product-e2e-chrome-20261103T100747Z/` |
| Ten reset/import cycles and disposal | 2/2 passed | `artifacts/v1/physics-acceptance-20261103/browser-20261103100843747/` |
| Acoustic/voice/asset comparisons under the same conditions | Four acoustic transports and two audio-resource policies produced consistent Node and Chrome results; reference remains the default | [ABCD](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/97707dd1837e9b8633be70627c25d4b528a117ec), [resources](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/b17f4cfa2dda5eb35dba019b9fe1ebcedd474013) |
| Recording throughput improvements | Storage and evaluation now use two-stage pipelines and batching, encode each frame once, and reduce UI redraws | [IDB receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/39648bbaae94242178e022e9e8d02230ddcb0785) |
| 51-row requirements crosswalk | See the [crosswalk](../requirements/REQUIREMENT_CROSSWALK_20261103.md): PASS rows mean only that direct current evidence exists | Same link |

<!-- english-original-anchor --> <a id="仍未通過或有限制"></a>
## Not passed or subject to limits

| Item | Current state |
| --- | --- |
| Recording may pause at startup | A fresh browser profile's first storage operation or a single long frame exceeding the original 8-frame/about 66 ms limit causes a pause; data is retained, and “Resume processing in batches” continues. Production top monitoring was 4/5; this was the failed case (recorded 0.07 seconds, tick 52). Completely avoiding pauses would require increasing the original limit, violating acceptance, so it remains |
| Continuous sound already playing | Record fades it out and restarts at its original position. That recording has only an audit cursor for incomplete history; A/B does not carry the native cursor |
| All 22 S4 routes | [s4-final-01](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/ui/s4/attempts/s4-final-01): 11 passed, 11 failed; most cases within failed routes still passed (for example, interaction-main 17/18 and interaction-completion 37/39). One class is old scripts mismatching the current UI (renamed or duplicate buttons: “Resume” versus “Resume simulation”, two Pause controls, removed “01 Create scene”, duplicate help buttons). Another class needs product investigation: gizmo drag cancellation did not restore position, orbit did not stop after window blur, curved-acoustics disabled state, Zone rule-reference uncheck had no effect, Propagation medium was not found, 5 help entry points, audio-monitor wet default step, and “Render audio files” stayed disabled after a public 60-second recording (possibly the known recording pause). No fixes were made tonight; all original failures remain |
| Formal 600-second performance | **Not run: on 2026-11-03 the user decided not to run extreme scenarios tonight**; the 20-second pilot was contaminated by concurrent load and is not evidence |
| Windows Computer Use | **BLOCKED**: Codex's Computer Use tool refused operations because it could not reliably determine Chrome's current URL (the same policy as on 2026-11-02). No product steps ran: 0 passed, 0 failed, 1 BLOCKED, 8 NOT_RUN. The original refusal is in [attempt-01](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f49863c5b2d727e3332218fc941fe6c8b04e3dfd); manual testing must cover this part |
| Human listening, physical keyboard/mouse, Meta live | Require a person or external account; not run |

<!-- english-original-anchor --> <a id="人工測試前的介面整理css-only"></a>
## Interface pass before manual testing (CSS-only)

At the user's 2026-11-03 request (necessary spacing, similar elements no longer boxed inside boxes, better readability; Emil skills as reference): mutually exclusive modes became a single bordered segmented switch, the monitor-strip route buttons became one joined group, the top-monitor meter gained a frame, Inspector labels and values were given separate levels, and toolbars wrap instead of overlapping at narrow widths. Before/after screenshots and verification are in the [pass record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a55706f975b47cfe71a557a8f3e49dbea176fb6b).

- Passed: UI unit 232/232, format, lint, pinned Emil sources; ten-cycle lifecycle 2/2; production top monitor 4/5 (the 390/929/1440 px header layout test passed; the failure is still the original recording-pause case).
- **Refined v3 product E2E did not reproduce 4/4 tonight**: before and after the pass, in the same time window, most runs failed (1/6 clean launches before, 2/15 after), all with a pause during recording; the pre-pass build identical to the one that passed at 10:07 now fails as well, so this is judged an execution-environment problem, not the CSS. At the time C: had only about 4.1 GB free and memory commit was near its limit.
- The full S4 22-route suite was NOT RUN after the pass.

<!-- english-original-anchor --> <a id="人工測試回報與修正"></a>
## Fixes for issues reported in manual testing

Before and after manual testing the user reported three issues; they are fixed and confirmed by the user on their own hardware (view and impact sound "Both fixed", grab "Grab feels good"). Causes, fixes, numbers and evidence are in the [fix record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d297df44a4829fe6fc16487f07db5ff56790be89).

- First-person view jumps: raw mouse input (`unadjustedMovement`, with fallback when unsupported), and isolated bad mouse movements are dropped; sensitivity unchanged.
- Default ball occasionally silent: speculative contact points that carry actual impulse are no longer skipped, and a new strike after stable separation within one contact also sounds; in real Chrome every impact started one voice, 0 rejections.
- Grab coming loose: target point and velocity feed-forward 3→20 m/s, servo 10→20 rad/s, per-kilogram acceleration 20→150 m/s² (absolute hand force 150 N unchanged), released only when lag exceeds 1.5 m for 0.5 s or exceeds 3 m; turns of 172–573°/s no longer drop the object.
- Verification: runtime 2284/2284; real Chrome pointer-lock 2/2, ten-cycle lifecycle 2/2, linked-workflow-v2 8/8; ui-refined-v2 43/47, and the same 4 cases also fail on the pre-fix source; refined v3 is still affected by the recording-pause environment problem (1/3). S4 NOT RUN.

<!-- english-original-anchor --> <a id="人工測試怎麼開始"></a>
## Manual testing: getting started

1. In the integration tree or local Main, run `npm run build`, then `npx vite preview --host 127.0.0.1 --port 4173 --strictPort`, and open `http://127.0.0.1:4173/` in Chrome (this is the tested production version; `npm run dev` also works, but is slower).
2. Follow section B of the [full test procedure](../../11-v1/FULL_TEST_PROCEDURE.md) and record pass/fail/not tested; write “not tested” for anything not observed.
3. Pay particular attention to this round's new features: the four top-monitor views Levels/Spectrum/Waveform/Load and channel selection, recording (including Resume after a pause), replay and A/B, long-output rendering and individual downloads, and Chinese/English switching.

<!-- english-original-anchor --> <a id="3-分鐘展示建議"></a>
### Suggested 3-minute demo

- Before the demo, free space on C: and close large programs you do not need: tonight, with only about 4 GB free on C: and memory commit near its limit, recording pauses were clearly more frequent than earlier in the evening (exact cause not determined).
- Warm up with a short recording in the same browser window before the formal demo; wait 1–2 seconds after starting playback before pressing Record, and do not switch monitor views at the instant Record is pressed.
- Enable listening first so Spectrum/Waveform and sound have data.
- If “The fixed-step workload limit was exceeded… Recording is paused” appears, press Resume; data is retained.
- Temporarily avoid demonstrating gizmo drag cancellation or switching to another window while orbiting the camera: these two S4 checks failed, and product problems versus old test scripts have not yet been adjudicated.
- The default room scene runs smoothly; do not add many objects during the demo. A long render (63-second material) takes about 2.5 minutes; short recordings are fast.
- The Meta experiment panel uses offline demo data and does not connect to the network.

<!-- english-original-anchor --> <a id="給下一位工程師"></a>
## For the next engineer

1. Adjudicate each failed S4 route as a product regression or an old-script/current-UI mismatch (gizmo cancellation, stopping orbit on blur, locale buttons, Propagation medium location, curved acoustics, zones/render, etc.); fix and rerun product regressions.
2. For recording startup pauses, identify the source of the first long frame without increasing the original limit (production profiling plus Long Animation Frames is suggested).
3. Run formal 600-second V4 only after user agreement.
4. Long-output attempt05 ran at `89f65e4d`: afterward `src/audio`/`src/acoustics` gained only a 7-line `resume()` fix, but the recording pipeline and UI changed, so this was not a rerun on the frozen source; rerun there when needed.
5. Sync the pinned Wiki specs: the grab suggested values in `PHYSICS_ARCHITECTURE.md`, the rearm note in `PHYSICS_AUDIO_BRIDGE.md` and `ACCEPTANCE_AMENDMENTS.md`, with values taken from the [fix record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d297df44a4829fe6fc16487f07db5ff56790be89); specs outside the documented procedure that still use `locator("canvas")` also need their selector changed.
