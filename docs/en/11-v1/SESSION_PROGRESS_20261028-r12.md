<!-- english-source: {"path":"docs/11-v1/SESSION_PROGRESS_20261028-r12.md","sha256":"15c2f31631a236770a3bb9affb5f4c91057f893564694e43b6adae871436526d","translated_at":"2026-10-27T23:18:57.038Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/SESSION_PROGRESS_20261028-r12.md`](../../11-v1/SESSION_PROGRESS_20261028-r12.md). Source SHA-256: `15c2f31631a236770a3bb9affb5f4c91057f893564694e43b6adae871436526d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版整合續報-r12行為投影與-dev-server-修復"></a>
# First version integration follow-up r12: behavior projection and dev server repair

This cutoff continues the original Tasks, 51 acceptance items and `/goal`; the first version remains unfinished. Codex handles implementation, with no additional Muse or paid model calls. The latest formal matrix remains [r6](REQUIREMENT_EVIDENCE_20261028-r6.md), with 43 scoped PASS/8 PARTIAL; this page does not treat functional tests as passage of all gates.

<!-- english-original-anchor --> <a id="產品與固定回歸"></a>
## Product and fixed regressions

`BehaviorRuntime.getActiveRuleStates()` now lets publication read detached binding/active rule ID arrays, while the complete 297 bytes of `snapshot()` remain unchanged. The new tests were frozen first and 12 RED cases confirmed the missing API, then the three product source files were applied; the original behavior regressions and new cases total 54 GREEN. The full runtime for the current formatted version is **931/931 PASS, 0 FAIL, 0 SKIP**, with TypeScript, scoped lint and formatting checks passed. The [implementation and independent review](../../../artifacts/v1/active-rule-production-20261028/implementation-summary.json) preserve sources and failure records.

Full App views, checkpoints and record/replay results are equivalent. Instrumented app full-snapshot calls fell from 270 to 51 under the default workload, and from 186 to 0 in the large scene; the tests' own saved-method oracle calls were excluded symmetrically, with audio=NULL/worker=false. This is not evidence of total snapshot counts, speed, FPS or GC improvement.

<!-- english-original-anchor --> <a id="dev-server-修復"></a>
## Dev server repair

The first current physics2 attempt failed during module loading, before reaching numerical assertions. Vite scanned extension HTML in an ignored directory and encountered an unresolvable `chrome`; an old cache rename also returned EPERM, whose cause remains unconfirmed. The [original failure](../../../artifacts/v1/current-physics-guarded-20261027223458311/failure-seal.json) and cache are both retained.

The main dev configuration now sets `index.html` as the explicit scan entry; physics uses the same entry, copies only the main configuration's file-deny rules, does not inherit the API proxy, and uses a new fixed cache namespace. The original six dependencies, port, HMR, assertions and time limits are unchanged. persistence inherits the entry and denial rules through the existing merge. See [Vite entries](https://vite.dev/config/dep-optimization-options#optimizedeps-entries); the new namespace only isolates the old cache and does not prove the cause of EPERM or guarantee it will not recur.

The new tests load the installed Vite directly, use isolated fake extensions, fake keys and ordinary files, and actually run the optimizer and loopback HTTP. Before the repair they reproduced seven leaf-node failures; the same tests recorded **26/26 PASS** after the repair, retaining the positive control where removing the entry restriction scans the fake extension. No actual user key was read or requested. The [RED/GREEN and independent review](../../../artifacts/v1/vite-dev-policy-repair-20261028/sealed-red-green/manifest.json) are fully preserved.

<!-- english-original-anchor --> <a id="browser-整合"></a>
## Browser integration

| Scope | Actual results and evidence | Limits |
| --- | --- | --- |
| UI | Original [27 PASS](../../../artifacts/v1/ui-active-rule-current-20261027T222013338Z/proof-receipt.json) | The latest 12 local resources are byte-identical; no rerun of UI27 or additional complete HTTP coverage is claimed. |
| Physics/lifecycle | [2 PASS](../../../artifacts/v1/physics2-independent-file-review-20261027T225427312Z-r2/verification.json), with no retries or skips | Actual WASM and ten reset/import/dispose cycles; software ANGLE, not performance evidence. |
| Storage | [5 PASS](../../../artifacts/v1/storage5-independent-file-review-20261027T225814856Z/verification.json), with no retries or skips | IndexedDB fixtures, not all product workflows. |
| Product | [4 PASS](../../../artifacts/v1/product4-build-independent-file-review-20261027T230526601Z/verification.json), with no retries or skips | Chrome 156.0.8078.48/default GPU/light observer; three clean contexts share one OS browser, with WAV original-file relinking also verified. |

The latest fixed build has 170 inputs/12 resources, input digest `59439858b4e0039c8cda6a3104eb29d8b530b7d4f933ede2aa662c30fd5b9ae1`. The [local bundle derivation](../../../artifacts/v1/current-build-guarded-20261027225733263/optional-ui-bundle-byte-binding.json) and [portable receipt](../../../artifacts/v1/current-build-guarded-20261027225733263/portable-build-receipt.json) retain the manifest. For each physics, storage, build and product run, the 1927 global source inputs and 61 protected files were identical before and after, and owned processes and ports were cleaned up; subsequent document changes are outside those global hash cutoffs.

Product native graph/logical intent remains marked `NATIVE_CURSOR_PARTIAL`, with no PCM, hearing or deadline conclusion. Existing native25/IRv2 evidence is reused only for the same DSP closure; the [23/16/6 checks](../../../artifacts/v1/audio-active-rule-lineage-20261028/assessment.json) and independent review are preserved. Old global1781/1782 is not treated as current global evidence.

<!-- english-original-anchor --> <a id="量測權利與下一步"></a>
## Measurement, rights and next steps

The small R3 causal trace captured native RAF/mark/RunTask, and independent checks verified the original bins and occupancy Float64 bits. This only supports subsequent measurement engineering under an independent version; it is not formal V3 qualification, and no new 600-second run occurred. The original profile's FAIL/UNVERIFIED/NOT RUN, V2 files and all raw data remain; no epsilon is added, no window is moved, and no old result is upgraded.

The [production build](../../../artifacts/v1/production-active-rule-build-20261028/verification.json) passed. The [new notice pack](../../../artifacts/v1/bundle-notice-pack-20261028-active-rule-r12/manifest.json) preserves 173 text items and the six original gap records; the [independent current-binding review](../../../artifacts/v1/bundle-notice-current-qualification-r12-20261028/qualification-seal.json) checked 12 production resources and added only a source substatus for the complete official `esbuild` MIT text. This does not mean binary/source, native closure, redistribution or the root LICENSE has been approved.

At this page's publication cutoff, the full `npm run check`/offline benchmark, latest English delta and this round's local Git checkpoint still await completion; the old full 917-item check cannot stand in for this round's 931-item version. New receipts and a Wiki handoff will record the actual runs afterward.

Direct native200%/Pointer Lock evidence, actual Hi-x65/D3V hearing tests and device routing, formal performance results, and rights/competition confirmation are still required. The unlocked desktop is user-reported; this does not erase the two NativeV2 hidden failures or UI tool initialization failures, and no SessionID inference or automatic retry is made. Existing actual product Meta live evidence is retained separately; this round adds no request slots or spending ceiling.
