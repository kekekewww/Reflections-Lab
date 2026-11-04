<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/integration-fix/REPORT.md","sha256":"eb1dd7d0f930ddf9f4ea42a4842168c8cef89afa406d97719ff5ba6f6a5c4f4d","translated_at":"2026-11-02T10:01:02.357Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/integration-fix/REPORT.md`](../../../../15-ui-parameter-audit/acoustic-geometry/integration-fix/REPORT.md). Source SHA-256: `eb1dd7d0f930ddf9f4ea42a4842168c8cef89afa406d97719ff5ba6f6a5c4f4d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="整合回歸測試錄製的真模型標記"></a>
# Integration regression: actual model markers in test recordings

Root's first merged complete runtime had11 FAILs. This work addresses only six reevaluation-metadata failures and one metrics duplicate-query fixture failure. It does not declare the other four cases or the complete suite passed.

The actual Zone-fixture Scene includes a sphere, so its solver model is extended. The source-phase fixture contains only floor/speaker, so its model is legacy. Both original capture headers used placeholder1.0.0 instead of the actual web-geometric version; the formal exact-model gate correctly rejected them. Only the two fixture configs now use acousticSceneSolverVersion(scene) and emitterGeometryPolicyPin() to identify the new capture-caller policy. Clock, source phase, motion trace, cursor, numerical expectations and production gates are unchanged.

The metrics duplicate fixture's baseline comes from an extended Scene, but its artificial conflicting query had only surfaces:[] and no pin, making it legacy. The formal collector excludes backend-mismatched queries first, so there were not two conflicting queries under the same model and the result was7. The artificial query now explicitly pins original frame.backendVersion and adds backendId/version consistency assertions, actually testing a same-model duplicate. Original sampleCount=6, invalid=2,5/343 and all tolerances are entirely preserved. No production change was needed.

| Complete focused file | Result | Original receipt |
| --- | --- | --- |
| Zone pipeline, including an actual Node Worker realm |8/8 PASS, exit0 | [zone](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/295b8c684d5b6509c5b66221b7747b0e71dec457) |
| Source phase |12/12 PASS, exit0 | [phase](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d0a8249ab7ec0ac72c5f99ed62bf04e2fe8aae18) |
| Metrics population |7/7 PASS, exit0 | [metrics](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/cd12ceb77e64ea0a76aec4a973e1eb99c6e79acf) |
| Three-file ESLint/Prettier/diff check |exit0 | scoped-eslint.txt/scoped-prettier.txt |

Original preimages of the three files, original complete-failure receipts, each agent's original FAIL and exact hashes are retained. Validation pins are in verification.json. The Git index was not modified; Root owns staging/commit. No Chrome instance or duplicate full-runtime run was started. Root continues with final merged full checks, actual DOM/WAV and manual testing.
