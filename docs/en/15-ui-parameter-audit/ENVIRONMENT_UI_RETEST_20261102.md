<!-- english-source: {"path":"docs/15-ui-parameter-audit/ENVIRONMENT_UI_RETEST_20261102.md","sha256":"c751bbfea68ccb96ce11fe3e7ff91748576db0afa1abc76e23a30d0c3173e3bd","translated_at":"2026-11-02T08:27:34.154Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/ENVIRONMENT_UI_RETEST_20261102.md`](../../15-ui-parameter-audit/ENVIRONMENT_UI_RETEST_20261102.md). Source SHA-256: `c751bbfea68ccb96ce11fe3e7ff91748576db0afa1abc76e23a30d0c3173e3bd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="環境保存修復a10真ui另批重驗"></a>
# Environment-persistence fix: separate actual-UI revalidation on a10

Date: 2026-11-02. Task0031's environment save/load defect has4/4 actual-production-DOM PASS results at pinned source `a10b7419908ecd88fd26d96dc354ca5659796986`, `index-BmjZ1Zyf.js`, Chrome156.0.8078.75. The original19db vacuum35.5→air20 FAIL and59360da branch Node/build report retain their original bytes; old results are not rewritten. This is not full-product/final-main acceptance.

<!-- english-original-anchor --> <a id="直接證據"></a>
## Direct evidence

The [original summary](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8a26db2657cf5059a182fe3ff6eb05f61bfab979) pins operations, times, before/after environments, actual HTTP-asset bytes/hashes and downloads. The [evidence manifest](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a08a483d05a3589efeb5587e77f1f34a64922751) retains19 files and initial observations. Actual flows use product DOM, Save/Export/Load and file Import in a fresh browser context, without a runtime/test bridge.

| Actual operation | Pinned result |
| --- | --- |
| Set35.5°C, switch to vacuum, Save and actually Export | Project.atmosphere is vacuum/35.5, preserving authored sound speed and seven band values |
| Reload the page, then Load saved project | UI remains vacuum/35.5, confirmed by a second actual Export |
| Import the same exported file in a fresh context using the actual file | UI and actual Export remain vacuum/35.5 |
| Import an old-file fixture with only optional atmosphere removed | Exact air/343m/s/20°C/seven bands0/Synthetic; no vacuum leakage from the previous project |

Page/consoleErrors are0. The owner reports process exit0, Chrome closed and lease released; the original raw stdout retains four PASS cases. The memory writer independently matched bytes/SHA for all19 evidence items and directly parsed three actual vacuum Exports and the actual legacy Export to check fields; see the [reconciliation JSON](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ca3b6f9e502ebf9b820fc223128e1c4008f8ec86). This is read-only reconciliation, not another browser run.

<!-- english-original-anchor --> <a id="原fail其他觀察與界線"></a>
## Original FAIL, other observations and boundaries

- The actual persistence FAIL in the [19db short environment probe](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/69a4b4305ec822ca484333b1e3c9786e97de4229) remains. The [component report](environment/REPORT.md) preserves RED2/8→GREEN11/11, related51/51 (including those11) and build/type/lint/format results. Original data and the new batch are judged separately.
- Initially, pressing temperature Enter and immediately switching medium was explicitly rejected as TRANSACTION_BUSY. Separately, an existing pauseReason obscured the Save notification, so an initial runner waiting for that notification failed before checking saved values. Both batches' original runners/JSON/stdout/screenshots are in the manifest and are not reclassified as data-persistence regressions. Root independently tracks Save-feedback UX and rapid-transaction policy under Task0028; these observations are not hidden.
- Under the official parameter contract, ordinary Scene Undo does not restore the environment. Targeted Node tests already verify that policy, atomic preservation on invalid commands/imports, missing-asset/disposing rejection and fixed environment sources for record/replay. This does not add atmosphere Undo.
- This batch revalidates only environment settings. It does not label the old27 Inspector functions, new curved/dynamic reflections or Zone as a10 PASS. Later source changes require evidence according to the affected scope.
- Task0031's first four data/validation/actual-UI/recording-semantics criteria have direct evidence. Final inventory/crosswalk and English/Claude integration remain pending; Task0031 and Task0028/Main are not closed early. Original native/device-hearing/science/600-second-performance/Meta-live and budget0 boundaries remain unchanged.
