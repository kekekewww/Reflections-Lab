<!-- english-source: {"path":"docs/15-ui-parameter-audit/CONTRACT.md","sha256":"448d56090ae21d2ea7369448eb9dc2d43dd204ce145bcfa983756b0efa406683","translated_at":"2026-11-02T07:14:53.0580293+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/CONTRACT.md`](../../15-ui-parameter-audit/CONTRACT.md). Source SHA-256: `448d56090ae21d2ea7369448eb9dc2d43dd204ce145bcfa983756b0efa406683`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="全產品-ui-參數實際操作與缺陷修復契約"></a>
# Whole-product UI parameter operation and defect-repair contract

Date: 2026-11-02 (Taiwan time). Scope is added by the [latest user request](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a72f7bab1db603a9911d74a287164e1a63fd6f98); the official task is `RLAB-TASK-0028`. After six-core basic validation, this round expands to the entire existing product UI, postponing local-main closure. Original six-core evidence and the user's confirmation that basic functions work retain their original dates/scopes.

<!-- english-original-anchor --> <a id="範圍與權威"></a>
## Scope and authority

Use the official production UI at normal 100% display scale. Cover all three workspaces, every reachable tab/panel/Inspector, toolbar/menu/dialog/tooltip, Scene/Project/asset import/export, FPS/Build/selection/transform, physics/materials/sources/behavior, record/replay/A-B, Meta, Motion, renderer and monitor controls. This is not limited to the six new tabs.

Original V1 acceptance, confirmed amendments, the design system/tokens/components and input/Domain contracts remain effective. Check numerical ranges and defaults against actual schema/domain/canonical parameter sources. Do not copy another token set or lower acceptance criteria/references/tolerances.

Use the traceable, realistic/schema-boundary methods of ux-engineering/reflection-lab-design-system and break-ui. The latest user instruction authorizes actual operation and defect repair. Do not introduce prerequisites from upstream skills' greetings, dev-only toggles, stop-after-report instructions or 200% sections. Parameter tests enter through actual UI data-entry paths; do not alter markup or execute hidden runtime bridges to manufacture success.

<!-- english-original-anchor --> <a id="五lane與單一共享記憶"></a>
## Five lanes and one shared memory

| Lane | Owner | Report location and main responsibility |
| --- | --- | --- |
| scene | ui_params_scene | `docs/14-core-pipeline/stages/11-ui-parameters/scene/`; scene/Inspector/objects/materials and tools/file entry points attributable to scene |
| behavior | behavior audit agent | Under the same root, `behavior/`; source/asset/behavior authoring and capabilities, valid/invalid rules |
| interaction | interaction audit agent | Under the same root, `interaction/`; FPS/Build/grab/throw/transform/focus/pointer and alternative controls |
| pipeline | pipeline_ui and children with separate file ownership | Under the same root, `pipeline/`; record/replay/A-B, Meta, Motion, renderer, workflow UI and their parameters |
| monitor | audio_core | Under the same root, `monitor/`; audio enable/mute/gain/Raw-Sim/buffer/rebuild and desired preferences before enable |

The static whole-product inventory is `INVENTORY.json`/Markdown under the same root. It supplies the coverage denominator and navigation index, not actual browser PASS evidence. Each lane uses its own browser context/data/identifiable scene to prevent contamination of local state/recordings/assets. Root assigns one file owner for cross-lane shared runtime, NumberField and controllers; do not overwrite the same file concurrently. Only the memory writer updates Wiki/sources/task/log sequentially, while root controls the Git index and integration.

<!-- english-original-anchor --> <a id="每個控制項的有限操作矩陣"></a>
## Finite operation matrix for each control

Each row uses a stable semantic control ID and locatable selector/accessible name. Record workspace/tab/visibility conditions, parameter label/unit/type/default/min/max/step/pattern and authoritative source. Read-only fields and disabled/unsupported states remain in the denominator rather than disappearing to inflate coverage.

1. **Actual pointer and keyboard**: perform actual click/focus/Tab/Shift-Tab/Enter/Space/Arrow interactions and component-appropriate drag/range/select/text-selection/input/paste/blur/Esc/rapid-resubmission/cancellation. Record inapplicable gestures as N/A with a reason. Distinguish browser DOM/CDP from human/native input.
2. **Valid values and boundaries**: default forms can save. Test representative legal values, exact min/max, reasonable decimals/positive/negative/zero, valid IDs and Traditional Chinese/English/realistic long text. Check HTMLstep/pattern consistency with the Domain rather than merely observing that an input value changed.
3. **Invalid values and rejection**: test empty/out-of-range/nonfinite/malformed values, duplicate IDs/stale state/invalid references and unsupported combinations. The UI must provide an understandable reason and preserve the last valid state. Failed transactions must not silently alter the scene or treat unknown values as zero.
4. **State and lifecycle**: within each feature's applicable scope, test no selection/valid selection, paused/running, recording/replay, tab/workspace changes, focus/blur, cancel/reset, rebuild/retry and rapid repetition. Check for unexpected reset/source restart/ghost commits/duplicate commands.
5. **Persistence and recovery**: distinguish session/view preferences, Scene, Project, recording and assets under their official contracts. Where persistence is required, test save/load/reload/import-export. Where Undo is supported, test atomic revision/undo/redo. Explicitly scope nonpersistent/non-Undo controls; do not force runtime engine objects into Scene.
6. **Results actually take effect**: verify through visible state, model/results, revisions, files/artifacts or appropriate existing digital tests. Merely filling an input, SSR/code review alone or a button's presence cannot count as actual-operation PASS.

The matrix is this round's finite auditable coverage. Mark unexecuted states/combinations NOT RUN rather than claiming exhaustive infinite-input/all-combination testing. Science, DSP, performance and physical devices retain their respective formal methods; UI operability cannot replace them.

<!-- english-original-anchor --> <a id="結果缺陷與修補"></a>
## Results, defects and repairs

Each row records at least source/bundle/browser/viewport/locale, steps/inputs, preconditions/before-and-after state, result, original receipts/hashes and limitations. Use PASS, FAIL, NOT RUN, BLOCKED and EXPECTED_DISABLED/UNSUPPORTED. Disabled/unsupported states require reasons, conditions that would resolve them and a concrete implementation path; do not fake-enable them to claim success.

For FAIL, preserve the original result/source first, then record root cause, repair, targeted regression and actual UI retest. Continue fixing repairable no-ops, invalid defaults, unpublished data, transaction/focus issues and similar defects. Retain genuinely unsupported or native/device-dependent items rather than silently excluding them from coverage. New findings under the expanded scope do not rewrite the user's original basic-function confirmation as a failed original report.

Initial confirmed issue: monitor gain is operable but silently no-ops while AudioEngine is not enabled. Root authorized repairing desired preferences while retaining default mute. Raw/Sim has a similar concern but it is not confirmed yet; validate and then classify it rather than labeling suspicion a proven defect.

<!-- english-original-anchor --> <a id="證據與結案"></a>
## Evidence and closure

- Native computer-use currently encounters app approval timeout; native Brave operation is incomplete. This round can use actual Browser tools/production DOM within their testable scope. State Browser/OS/human differences explicitly without relabeling Brave/native as successful.
- Load test data through actual UI entry points, using original or clearly licensed fixtures. Meta remains offline/fixture, budget 0; there is no new paid/deployment/push authorization.
- Reconcile all five lanes against the static denominator item by item. Report counts for every status, gaps and before/after repairs rather than one total PASS. Unresolved blockers affect closure. List legitimate unsupported items under feature limits and later implementation without erasing them.
- After repairs, run basic/targeted/build and real-DOM revalidation for affected source. Finally retain separate commands for code quality, full-check English failure and later language PASS. When code source changes again, do not borrow an old PASS for new bytes.
- Update canonical parameter documentation/necessary UX specifications, sources/tasks/Wiki/English and the Claude handoff. Fill final main SHA/integration location only after actual completion. Do not close this whole-product UI audit or local main before Task0028 coverage, repairs and revalidation are complete.

<!-- english-original-anchor --> <a id="尚未支援選項已納入實作"></a>
## Unsupported options are now included in implementation

The user explicitly answered, "Also implement the options that are not yet supported," resolving the original SCOPE_PENDING. See the [formal source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1863912da15dd68ade3ee77d87fb9cff0307e4f8) and [acceptance amendment](AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md). This round must inventory all visible unsupported options and implement their missing product capabilities, including OnZoneEnter/OnZoneExit authoring, real producers and related shared-capability/Host/UI entry points. Listing them only as future work cannot close the task, and false enablement or synthetic events cannot manufacture success. Classify legitimate state/data prerequisites and external account/device gates separately; this does not authorize paid usage.

Existing five-lane testing and repair of exposed controls continues. After new implementation, refresh the inventory and source pins, then add basic/targeted/build and actual production-DOM revalidation for affected scope. Task0028 and Main remain incomplete until implementation, reconciliation and necessary validation have actual evidence. Exact bytes of the earlier awaiting-answer version remain in history without overwriting its historical source.
