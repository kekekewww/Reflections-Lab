<!-- english-source: {"path":"docs/15-ui-parameter-audit/environment/REPORT.md","sha256":"6c6f848c051d8c52194c457ad59b20478f9dedf1f06fc598a69657536ff2e1df","translated_at":"2026-11-02T07:57:58.399Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/environment/REPORT.md`](../../../15-ui-parameter-audit/environment/REPORT.md). Source SHA-256: `6c6f848c051d8c52194c457ad59b20478f9dedf1f06fc598a69657536ff2e1df`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="project-環境設定持久化修復"></a>
# Project environment-settings persistence fix

Task: RLAB-TASK-0031, continuing Task0028's all-product parameter-interaction audit. Implementation branch codex/pipeline-environment; product source is pinned at59360da1b3e513fa7b80ca881d5214cf694867e4. This page does not close full V1, the all-parameter audit, native-desktop interaction or performance acceptance.

<!-- english-original-anchor --> <a id="原始問題與根因"></a>
## Original problem and root cause

After saving a project through the actual production UI with vacuum/35.5 °C, the downloaded Project lacked an atmosphere field. Reloading the page and loading the saved project reset the settings to air/20 °C. The original FAIL, Project JSON and screenshots are preserved byte-for-byte under original-ui-failure/; the original observation used19db9f9/index-BDGeI4Sd.

The runtime atmosphere existed only in running memory. ProjectDocument, the closed validator and currentProject() did not carry it.

<!-- english-original-anchor --> <a id="實際修復"></a>
## Actual fix

- Project v1 adds optional atmosphere using the existing Atmosphere data contract. medium must be air or vacuum; temperature is−80–100 °C, explicit sound speed100–1000 m/s, absorption in each of the seven product bands0–10 dB/m, and dataClass accepts only the four existing classifications. A pure validator does not default absent fields or valid optional fields.
- Save/Export explicitly copies the current environment so an old value in the project cannot overwrite runtime state. Import/Load first validates the complete Project, assets and candidate physics world, then applies the environment once at the existing successful-commit point. Invalid environments and missing required audio files do not modify old settings first.
- When an older file lacks atmosphere, runtime restores the original air/343 m/s/20 °C/zero synthetic band losses/Synthetic settings. It preserves the original343 value rather than silently recalculating it on load and changing existing digital results. Pure validation/serialization of old files still adds no field and preserves their original bytes.
- For a valid partial atmosphere without temperature, runtime supplies20 so the existing temperature control remains reachable. It does not add an explicit sound speed, thus retaining the solver's original temperature-derived semantics.
- setAtmosphere validates the candidate before drain. Invalid input neither contaminates the environment nor pauses/interrupts valid recording. After drain, it checks disposal to prevent committing settings during cleanup.
- Under PARAMETER_REFERENCE section3, environment settings still do not enter ordinary Scene Undo. Undoing object edits does not roll back later environment changes. New recording configuration and actual acoustic delays both use the same loaded environment.

This is not an ISO atmospheric-absorption model, new formula or measurement evidence. The original solver/recording models and declared scope remain; runtime engine objects are not serialized into Scene.

<!-- english-original-anchor --> <a id="驗證"></a>
## Verification

VERIFICATION.json contains complete machine-readable commands, exit codes, source and hashes of raw outputs.

- New targeted tests:11/11 PASS,0 skip.
- Related Project/persistence/app-control/recording-environment/experiment-workflow regressions:51/51 PASS,0 skip. These include the11 above and must not be added into62 distinct tests.
- TypeScript, designated ESLint, Prettier, production build and diff check all exited0.
- Independent read-only review found no blocker. The reviewer read source and original test outputs but did not independently rerun them.
- The Node disposal case injects a drain failure to test transaction lifetime; it is not a pure UI test. Other save/import/recording results use public runtime and production Project APIs.
- Browser revalidation of the fixed version: NOT RUN, awaiting root merge, a new build and an exclusive browser lease. The old FAIL is not relabeled successful. This branch did not operate native Brave, paid APIs, devices or human hearing, and did not run600-second performance tests.

<!-- english-original-anchor --> <a id="失敗與修復歷程"></a>
## Failure and repair history

red.txt retains the initial8 cases with2 PASS/6 FAIL, covering rejected fields, missing saved data, old settings and invalid commands. That initial test version assumed a paused projection field it had not reached; it was later corrected to the formal simulationState.

green-asset-unreferenced-harness-failure.txt and green-asset-profile-harness-failure.txt retain test-precondition errors in new negative cases. Metadata for an unused missing asset could legitimately remain; the next round also used a wrong profile ID. Neither was a new product defect. After correction to a real OnImpact sample referencing a missing asset, the preflight-rollback test passed, without changing product validation or relaxing conditions.

<!-- english-original-anchor --> <a id="rootclaude-重驗入口"></a>
## Root/Claude revalidation entry

1. Merge all commits from this branch, preserving other runtime recording and Zone fixes. This branch only adds environment fields and their corresponding connections.
2. In a new production bundle, use the UI to set air/35.5 °C, switch to vacuum, Save, Export, reload the page and Load. Confirm vacuum/35.5 °C remains. Importing the same JSON in a new browser context must give the same result.
3. Import an old project without atmosphere and confirm air/20 °C/343 m/s. Import an invalid environment or a missing-required-audio project and confirm the previous scene, environment and assets remain intact.
4. Record using the loaded environment and check configuration.atmosphere and propagation delay. Replay still uses its original recorded environment without contaminating current author settings.
5. If new source/bundle differs from this page's pinned snapshot, record new results separately. Do not treat the Node/build PASS here as browser PASS for a new bundle.
