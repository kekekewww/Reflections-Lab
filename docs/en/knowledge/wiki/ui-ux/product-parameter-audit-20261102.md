<!-- english-source: {"path":"knowledge/wiki/ui-ux/product-parameter-audit-20261102.md","sha256":"a1befd2cba6eb608788b2ee93f58bccb1f69f815d8d318bef8f608242b1d17be","translated_at":"2026-11-02T15:07:26.292Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-UI-PARAMETERS-20261102
title: Whole-product UI parameter audit and repair progress
type: design
status: ACCEPTED
created_at: 2026-11-02T06:47:04.079Z
updated_at: 2026-11-02T15:03:54.112Z
sources:
  - UI-PARAM-USER-20261102-V1
  - UI-PARAM-CONTRACT-20261102-V1
  - UI-PARAM-CONTRACT-20261102-V2
  - UI-PARAM-UNSUPPORTED-USER-20261102-V1
  - PUB-UI-PARAM-UNSUPPORTED-AMENDMENT-20261102-V1-6fa38f4180ce
  - PUB-UI-PARAM-CONTRACT-20261102-V3-448d56090ae2
  - UI-PARAM-IMPLEMENTATION-ASSIGNMENTS-20261102-V1
  - UI-PARAM-ENVIRONMENT-ASSIGNMENT-20261102-V1
  - UI-PARAM-ACTIVE-FINDINGS-20261102-V1
  - PUB-V1-ACCEPTANCE-AMENDMENTS-20261102-V1-b6163f9c9f2c
  - UI-PARAM-BEHAVIOR-BASELINE-20261102-V1
  - PUB-UI-PARAM-ASSETS-BASELINE-20261102-V1-7635ae5e5350
  - UI-PARAM-SCENE-BASELINE-20261102-V1
  - UI-PARAM-DIAGNOSTICS-BASELINE-20261102-V1
  - UI-PARAM-BASELINE-RECONCILIATION-20261102-V1
  - PUB-UI-PARAM-BASELINE-REPORT-20261102-V1-39a3836c60c9
  - UI-PARAM-ENVIRONMENT-IMPLEMENTATION-20261102-V1
  - V1-PARAMETER-REFERENCE-20261102-V1
  - UI-PARAM-ENVIRONMENT-RECONCILIATION-20261102-V1
  - UI-PARAM-ENVIRONMENT-RECONCILIATION-20261102-V2
  - UI-PARAM-ACTIVE-FINDINGS-20261102-V2
  - UI-PARAM-ENVIRONMENT-UI-A10-20261102-V1
  - PUB-UI-PARAM-ENVIRONMENT-UI-REPORT-20261102-V1-c751bbfea68c
  - UI-PARAM-NATIVE-RETRY-20261102-V1
  - UI-PARAM-ZONE-CORE-20261102-V1
  - UI-PARAM-ZONE-DETACHED-20261102-V1
  - UI-PARAM-ZONE-VOLUMES-20261102-V1
  - UI-PARAM-ZONE-BASELINE-20261102-V1
  - UI-PARAM-ZONE-POSITION-20261102-V1
  - UI-PARAM-ZONE-HANDOFF-20261102-V1
  - UI-PARAM-ZONE-RECONCILIATION-20261102-V1
  - PUB-UI-PARAM-ZONE-IMPLEMENTATION-20261102-V1-9542151872cc
  - SB-ZONE-SCHEMA-20261102-V1
  - SB-ZONE-TYPES-20261102-V1
  - PUB-V1-FPS-UX-20261102-V1-338d604e7939
  - V1-SOUND-UX-PREVIEW-20261102-V1
  - V1-USER-FLOWS-PREVIEW-20261102-V1
  - V1-COMPONENT-STATES-PREVIEW-20261102-V1
  - V1-UI-STRESS-PREVIEW-20261102-V1
  - CG-DATA-CONTRACTS-20261102-V1
  - CG-ACOUSTIC-VALIDATION-20261102-V1
  - CG-EVIDENCE-LEDGER-20261102-V1
  - PUB-CG-REPORT-20261102-V1-23f0fd97e1da
  - CG-MODEL-CONTRACT-20261102-V1
  - PUB-CG-MATH-REVIEW-20261102-V1-596a217c82c2
  - PUB-CG-METADATA-REVIEW-20261102-V1-7332e0d51f09
  - PUB-CG-REFERENCE-20261102-V1-d6911d82471f
  - PUB-CG-SOURCES-20261102-V1-2384083d4a92
  - CG-RECONCILIATION-20261102-V1
  - PUB-CG-IMPLEMENTATION-20261102-V1-0c090fd0460e
  - CORE-ARCHITECTURE-20261102-V1
  - CORE-AUDIO-RUNTIME-20261102-V1
  - SB-ARCHITECTURE-CURRENT-20261102-V1
  - SB-UX-CURRENT-20261102-V1
  - CORE-LIMITS-20261102-V2
  - V1-PARAMETER-REFERENCE-20261102-V2
  - UI-FORMAL-CURRENT-RECONCILIATION-20261102-V1
  - V1-PARAMETER-REFERENCE-20261102-V3
  - UI-FORMAL-CURRENT-RECONCILIATION-20261102-V2
  - PUB-UI-INTERACTION-REPORT-20261102-V1-9f0782afe955
  - UI-INTERACTION-FINAL-49BDE82-20261102-V1
  - UI-CURVES-FINAL-49BDE82-20261102-V1
  - UI-SCOPED-FINAL-READ-20261102-V1
  - UI-CONTROLLED-DEBT-20261102-V1
  - CORE-R21-FRESH-AUDIT-20261102-V1
  - PUB-UI-CONTROLLED-CLOCK-REPORT-20261102-V1-a19a81c8cc92
  - UI-CONTROLLED-CLOCK-VERIFICATION-20261102-V1
  - SB-UX-CURRENT-20261102-V2
  - UI-MOTION-REPORT-20261102-V1
  - UI-MOTION-COVERAGE-20261102-V1
  - UI-MOTION-READ-20261102-V1
  - UI-CONTROLLED-CLOCK-INDEPENDENT-20261102-V1
  - UI-MOTION-CADENCE-20261102-V1
  - UI-RENDER-MISSING-ASSET-20261102-V1
  - UI-RENDER-MISSING-ASSET-READ-20261102-V1
  - UI-AGENT-REPORT-20261102-V1
  - CORE-CAPS-META-FINITE-READ-20261102-V1
  - CORE-TASK0024-DOC-SNAPSHOTS-20261102-V1
  - V1-PARAMETER-REFERENCE-20261102-V4
  - CORE-CANDIDATE-5010685-20261102-V1
  - UI-ZONE-BROWSER-REPORT-20261102-V1
  - UI-ZONE-BROWSER-READ-20261102-V1
  - UI-TAIL-COMBINED-501-READ-20261102-V1
  - CORE-STAGE12-WAV-20261102-V1
  - PUB-CORE-STAGE12-REPORT-20261102-V1-473e376849d2
  - CORE-R21-FINAL-READ-20261102-V1
  - UI-FINAL-FINDINGS-20261102-V1
  - UI-FINAL-PARAMETER-COVERAGE-20261102-V1
  - UI-HELP-FINAL-ROOT-READ-20261102-V1
  - UI-FINAL-FINDINGS-20261102-V2
  - CORE-STATUS-20261102-V3
  - CORE-NEXT-20261102-V3
  - CORE-STAGES-20261102-V3
  - CORE-LIMITS-20261102-V4
  - CORE-CLAUDE-HANDOFF-20261102-V1
  - UI-HELP-FINAL-REPORT-20261102-V1
  - CORE-FINAL-CHECK-FAD14CC-20261102-V1
  - CORE-MAIN-FIRST-FAST-FORWARD-20261102-V1
  - PUB-CORE-CLAUDE-HANDOFF-20261102-V2-52362f71b678
  - CORE-STATUS-20261102-V4
  - CORE-NEXT-20261102-V4
  - PUB-CORE-STAGES-20261102-V4-f35fb0755e05
  - CORE-LIMITS-20261102-V5
  - UI-FINAL-FINDINGS-20261102-V3
  - CORE-NATIVE-GATE-CLASSIFICATION-20261102-V3
related_tasks:
  - RLAB-TASK-0028
  - RLAB-TASK-0023
  - RLAB-TASK-0020
  - RLAB-TASK-0029
  - RLAB-TASK-0030
  - RLAB-TASK-0031
related_decisions:
  - ADR-011
  - ADR-013
  - ADR-014
  - ADR-015
supersedes: []
tags:
  - P0
  - ui-audit
  - parameter
  - actual-browser
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/ui-ux/product-parameter-audit-20261102.md`](../../../../../knowledge/wiki/ui-ux/product-parameter-audit-20261102.md). Source SHA-256: `a1befd2cba6eb608788b2ee93f58bccb1f69f815d8d318bef8f608242b1d17be`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="全產品ui參數217有限family對帳完成與交付界線"></a>
# Whole-product UI parameters: 217 bounded-family joins complete and delivery boundaries

Product code5010685 / index-Nm7oRfzL / baf254… is pinned. The [501 build reconciliation](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3e3f490e543511fc9820d959c37cbcde7647e4a1) records1536/1536 runtime tests,0 skips, separate format/type/build/licenses exit0,14 archived files/8 HTTP requests/6 maps not requested. The [new complete check](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2f387d58e834799d809cbbdaab03e2afd2cb4194) actually exited0: all eight TAP suites had0 failures/skips, runtime1536, English417/417 with0 errors at that snapshot, and14 rebuilt files matched exactly. [Local Main](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/529524649ac8b7fbff91d919bf6dcab6403b7865) was normally integrated at `fe663ca9f384d247bcd89b331936f6be202c761f`, preserving the129 original untracked files/4ba snapshot/all11 feature tips. Old FAIL results remain unchanged; later bookkeeping HEAD must be read from actual Git.

- The [final central receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1400fa2fa72a41540ca46112193f7fed6b2e262f) verifies11 input hashes. All275 AST sites/217 semantic families have bounded interaction/reachability receipts, with0 unjoined families: interaction59/scene22/behavior46/pipeline80/audio10. This is a versioned finite matrix, not every real-valued combination or one full501 rerun. Former unsupported Zone, sphere/capsule material/role controls and actual dynamicReflector are implemented; closure does not depend on fake enablement.
- Of71 Help callers,68 ordinarily public callers have real nonempty content. The final20 unique callers add methods using exact original PASS indices/SHAs from02/03/04. Two Audio nativeRejection conditions were not naturally observed, and one empty comparison.status branch is unreachable through the current Host. None is invented as browser PASS. Both inner tables have actual wheel/ArrowLeft changes: Paths0→6→0, Events0→191→151; outer vertical scrolling does not replace inner-region proof.
- The [Root's final image/raw review](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/af0cee341db1385f595c0abb1e2cb9bc308b0d7d) supports Zone editor wireframes/object picking through them, large-wire hiding in Replay/FPS and restoration on End, from bounded visual review of five real images. This is not quantitative pixel-absence analysis. Attempt02 still says RUNNING with a separate STOP_REASON, and03 remains FAIL; individual caller PASS must not become whole-attempt success.
- The22 Pipeline cases each have bounded PASS across49/9fc/501. Interaction59 families, eight curved-geometry groups and six Zone cases across02/03/04 retain their original sources/FAIL results. The501 Tail adds one PASS:10.5/10.50/blank block Generate, Esc restores0, and.25/10 produce actual outputs. The real clock-debt defect was repaired in9fc and revalidated through public Stop at5 ticks followed by a new180 ticks6..185. Original overload/queue-full behavior remains a performance limit.
- [Stage12](../../../14-core-pipeline/stages/12-final-integrated-ui-audio.md) adds Combined180 ticks19..198/Zone30,62/nonlinear gain/180 nonstale sphere reflections and five individual WAV downloads. Independent RIFF5/5 PASS verifies48kHz stereo/240000 frames over5 seconds; stems-sum maximum1.1420343071222305e-6 stays below the original2e-6. Raw float pre-master values above1 are valid without hidden normalization/clipping; master has0 outside-range samples. All five historyIncomplete=true/limited DSP pre-roll disclosures remain.24 original downloads/nine Root copies have separate hash review. Large WAV/trace data lives in D exports/ignored cache, not entirely in Git.
- [FINAL_FINDINGS](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8469bfd6009ac9f4d664456a2efb99a161148dfd) pins nine repaired problems with25 evidence pins; old ACTIVE is a10 interim history. Tasks24..31, including28, are closed under their original bounded criteria. Task23 is BLOCKED only by the original native AC04 external method gate; already-executed Claude is not added as a prerequisite. The20-section parameter reference and [current Claude handoff](../../../14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md) are updated. Complete-check/Main execution receipts now exist; final memory/English bookkeeping receives separate lightweight checks.
- The first three Native approval timeouts/0 input are historical. The [fourth recheck](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7592a80024b7c1f8d94c546048a7b3e5b5bcd463) only created the user-authorized new window through actual Ctrl+N, then Windows URL policy stopped Computer Use for the entire turn. It completed no product navigation/export. It is neither a fourth timeout nor all-zero native input. Task23 AC04 remains false/PARTIAL_EXTERNAL_NATIVE_URL_POLICY, separately from DOM/digital PASS. Unaffected work/Main are now complete, and Task23 is BLOCKED only by this method gate.
- The user has confirmed the original basic functions. Claude's independent verification followed by human observation of new features is the next stage. The latest R21 check finds only broker20952 alive/descendants empty, with jobs unknown. The C primary attachment/original files/backups remain; no kill/IPC/review bypass occurs. Complete V1, science/devices/hearing/original600-second FAIL/Meta live remain separate. No paid use/push/deployment is authorized.

<!-- english-original-anchor --> <a id="歷史進度與來源截點"></a>
## Historical progress and source snapshots

The following records describe progress when saved. Wording such as "implementation/revalidation pending" or "criteria unverified" applies only to that snapshot. The page header, formal tasks and latest fixed receipts define current status. [Exact bytes before reorganization](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2b11a43b979a5617f476cf2e4da4b7887cbd9733) remain; no original FAIL was deleted and no old source was invented.

<!-- english-original-anchor --> <a id="起始範圍"></a>
### Initial scope

The user's latest [original request](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a72f7bab1db603a9911d74a287164e1a63fd6f98) expands to the entire existing product UI. Official acceptance is in [this round's contract](../../../15-ui-parameter-audit/CONTRACT.md), and the sole work authority is [Task0028](../../../../../knowledge/tasks/RLAB-TASK-0028.json). This round is not limited to reviewing six new tabs and does not rewrite the original basic human confirmation or six-core evidence.

The five-lane evidence root is `docs/14-core-pipeline/stages/11-ui-parameters/`. Scene/behavior/interaction/pipeline/monitor each perform actual operations and repairs. INVENTORY is the coverage denominator, not automatic PASS. Root integrates by file ownership, and the memory writer sequentially registers sources/tasks/checkpoints.

Known starting point: root confirmed FAIL for operable but no-op monitor gain before the engine is enabled; a desiredprefs repair is authorized. Validate Raw/Sim concerns before classification. Do not premark untested items PASS. Native/Brave is incomplete because of appapprovaltimeout. Chrome productionDOM, keyboard/pointer methods, valid/invalid/boundary/persistence/undo and science/audio/performance are reported separately.

Main closure is postponed pending whole-product coverage and necessary repairs/revalidation. List reasons and implementation paths for legitimate unsupported/disabled states rather than using fake enablement to manufacture success. Retain existing 600-second FAIL, Meta budget 0/fixture, device/science and other external gates.

<!-- english-original-anchor --> <a id="尚未支援功能已明確納入實作"></a>
### Unsupported features are explicitly included in implementation

The user explicitly answered, "Also implement the options that are not yet supported," resolving the original SCOPE_PENDING. See the [formal authorization](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1863912da15dd68ade3ee77d87fb9cff0307e4f8) and [acceptance amendment](../../../15-ui-parameter-audit/AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md). Fully inventory visible unsupported options and implement their missing product capabilities. OnEnterZone/OnExitZone cannot remain only future work at closure. Classify genuine external account/device/permission gates separately from legitimate state prerequisites; this authorizes neither paid use nor false enablement. All five lanes continue, revalidating affected scope after new features are implemented. Main still awaits implementation and evidence.

<!-- english-original-anchor --> <a id="未支援能力的兩項正式實作任務"></a>
### Two formal implementation tasks for unsupported capabilities

[Task0029](../../../../../knowledge/tasks/RLAB-TASK-0029.json) assigns capability_core to implement zone authoring and real fixed-step OnEnterZone/OnExitZone in the project's zones tree. [Task0030](../../../../../knowledge/tasks/RLAB-TASK-0030.json) assigns acoustic_geometry_core to implement Sphere/Capsule acoustic materials/roles and real DynamicReflector reflections in the acoustic-geometry tree. Both branches start at f6abb936; see the [fixed assignment source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/32459dcf8fba5a9485bc978070a062aee7e460a8) for full SHAs and ownership. These are the three currently identified gap categories, not a completed unsupported-options inventory; all criteria remain unverified.

Optional Zone data must not alter legacy hashes; a real fixed-step producer must not be replaced with synthetic events. Curved surfaces must disclose analytical/bounded numerical approximations, real solver paths and the original 105 object/surface budget policy. All five lanes continue. After the new capabilities are complete, refresh inventory/pins/crosswalk and affected real DOM/Domain evidence. Main awaits all implementation and revalidation.

<!-- english-original-anchor --> <a id="正式project環境保存修補"></a>
### Formal Project environment persistence repair

Root separately confirmed in the real UI that vacuum 35.5 returns to air 20 after save/reload. [Task0031](../../../../../knowledge/tasks/RLAB-TASK-0031.json) assigns environment_persistence in the project's environment tree / codex/pipeline-environment, based on f6abb936, to repair formal Project environment fields, validation and save/load; localprefs alone is insufficient. See the [fixed assignment and original FAIL summary](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8df207db905ef2e6c579943d494de04a1e32a0d2). Implementation and real DOM revalidation are still in progress; do not prefill PASS.

<!-- english-original-anchor --> <a id="原fail與修補待真ui重驗截點"></a>
### Original FAIL and repairs awaiting real UI revalidation

Root reported monitor prefs/footer/wet step repair f6abb936 (Node 6 PASS) and camera/transform gesture repair 5360cfd (5 targeted plus type/lint/format PASS). At that point the served bundle was still 19db/index-BDGeI4Sd; neither repair had browser revalidation, so a commit cannot establish PASS for the new bundle. Replay seek before playback / residual replayFrame when recording after natural completion is also being repaired. Environment persistence and unsupported capabilities proceed under Task0029..0031. See the [fixed interim findings source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/124c189b7b85b8d98acf4d441ab53178e728e675). Each lane must substantiate original FAIL → fix → PASS and final pins with new receipts.

The formal V1 [acceptance amendments](../../../11-v1/ACCEPTANCE_AMENDMENTS.md) now connect the 11/2 basic-function confirmation, six-core evidence, and the new priority scope for whole-product / unsupported-capability implementation. Original history and external/science/performance boundaries remain.

<!-- english-original-anchor --> <a id="已凍結19db批次的分項結果"></a>
### Scoped results from the frozen 19db batch

The [baseline synthesis report](../../../15-ui-parameter-audit/BASELINE_UI_AUDIT_20261102.md) read raw evidence and reconciled all 112 fixed evidence hashes: behavior/asset has 57 distinct cases and 44 families; among 29 Inspector groups, 27 operational PASS, 1 previously unsupported, and 1 real environment-persistence FAIL; diagnostics has 1/1 real browser case and 28 inventory items, including read-only items and a nonexistent refresh. These different counts must not be added or presented as whole-product coverage. New Zone/geometry/Project environment repairs still require revalidation against new sources. Original FAIL and NOT_RUN remain; JS filenames and actual body hashes also represent different source strengths.

<!-- english-original-anchor --> <a id="project環境修補已合入真ui待重驗"></a>
### Project environment repair merged; real UI revalidation pending

Environment branch tip 0ab136b is already an ancestor of integration a10b741. The [formal report](../../../15-ui-parameter-audit/environment/REPORT.md) pins product source 59360da: 11/11 new tests, 51/51 related tests (including the 11), and build/type/lint/format PASS. Original RED and two asset-prerequisite FAIL results remain. The memory writer verified all 7 pinned Git sources and the output hashes of all 7 runs with raw output; see the [independent read reconciliation](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/046e5407d8bb1705c6310cab6966135ee3aa4824). Formal Project atmosphere selection / legacy-file defaults / atomic rejection of invalid values are connected. Ordinary Scene Undo does not restore the environment, per the original contract. This still does not establish browser PASS for the new integration bundle. Original vacuum 35.5 → air 20 UI FAIL awaits revalidation with a new build; Task0031/0028/Main remain open.

Environment reconciliation count correction: the earlier source title / task summary said 8, a descriptive typo. Original VERIFICATION and reconciliation JSON contain only 7 runs with raw output, plus diffCheck metadata without raw output. V2 explicitly states 7. The original 7 contents/hashes/test results are unchanged; exact V1 bytes remain in history.

<!-- english-original-anchor --> <a id="a10續接截點immutable-export確認新fail其他scope分開"></a>
### a10 continuation: immutable export confirms a new FAIL; other scopes remain separate

Root reported source a10b741, 4173/Bmj, with API 8787 still gated. After two replay probes and the interrupted case passed, the complete flow found immutable export still enabled during finalized/persistbusy but returning TRANSACTION_BUSY. This is a confirmed product FAIL; an early-readonly repair is authorized and public Node RED is preserved. It must not be reclassified as a harness issue.

The new 11 browser PASS / Node 6 for Monitor are root reports; reverb true/false and -40 → render manifest still need evidence, and the Env QA retry still awaits results. Zone fa4 has fixed 501/501/0 skip plus build 0, but detached-anchor self-exclusion, wireframe/Project Zone context and browser checks remain pending. Curves backend-pin repair has 19 targeted PASS; full runtime awaits a CPU window. The fixed source is [interim V2](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/124c189b7b85b8d98acf4d441ab53178e728e675). Task0028..0031/Main remain open; source/bundle/method scopes must not be transferred.

<!-- english-original-anchor --> <a id="環境a10真ui重驗44"></a>
### Environment a10 real UI revalidation: 4/4

The [separate formal synthesis](../../../15-ui-parameter-audit/ENVIRONMENT_UI_RETEST_20261102.md) records 4/4 PASS under source a10/index-BmjZ1Zyf for Save/real Export, reload/Load, fresh-context fileImport and exact legacy defaults. All 19 file hashes match, real Project fields were independently checked, and page/console errors are 0. Original 19db persistence FAIL remains. This updates environment scope only; it does not relabel the old 27 Inspector groups / new curves / Zone as PASS. Save-feedback UX / rapidbusy observations remain with Task0028. The first 4 Task0031 criteria can be verified; final reconciliation/English/Claude/Main remain pending.

<!-- english-original-anchor --> <a id="native第三次access重試仍未完成"></a>
### Third Native access retry remains incomplete

After the user's continuation, root retried Brave: list_apps succeeded, but get_window/state still returned Computer Use app approval timed out. No native input was sent. The [fixed receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a0226c188241d51b054e5ab15c1f204560079508) records previous 2 / current 1 = 3 attempts total; the original two Stage09 attempts' bytes remain unchanged. Actual production DOM pointer/keyboard fallback remains a separate method and is not relabeled native / human / hearing success. This retry did not initiate a new paid request.

<!-- english-original-anchor --> <a id="zone合入d9資料與真producer基本條件已驗"></a>
### Zone merged into d9; basic data and real-producer conditions verified

The [Zone synthesis](../../../15-ui-parameter-audit/ZONE_IMPLEMENTATION_20261102.md) read raw evidence and Git phase by phase: all hashes match for 124 source entries / 50 evidence entries. fa4 501, d35 192, a22 6, 20bf 57, and 12786 green 17 / reg 76 each retain their own scope and must not be added. POSITION preserves real continuous mode-change edges and supersedes the old baseline boundary. DETACHED repairs remote-owner exclusion. Root reported d9 merged 46 focused / build 0 and index-Cla4CyjN. Curves remains unmerged and real Zone UI/WAV remain pending; a local build does not establish what was served or overall completion. The first 2 Task0029 criteria are verified; the rest remain IN_PROGRESS.

After the Zone merge, current Sound schema/types continue through new sources at the same paths. Exact Git bytes of old SB-SRC-0032/0034 are preserved in history. This is an extension of the formal data contract, not a change to old research results.

After the Zone merge, current Sound schema/types continue through new sources at the same paths. Exact Git bytes of old SB-SRC-0032/0034 are preserved in history. This is an extension of the formal data contract, not a change to old research results.

2026-11-02: Three generic passages in the original FPS text conflicted with the explicit ghost-cancellation clauses at 33/65. The [original version](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/15a9f8dda4b2807b226d526f6174aafd83ebc5a4) and the owner's original FAIL comparison were preserved. The [canonical FPS document](../../../05-ux/FPS_INTERACTION_UX.md) was precisely synchronized to the confirmed 11/1 policy. This aligns document/oracle semantics; it does not change the product or prefill repaired browser PASS. The [Conflict Record](../../../../../knowledge/conflicts/78d81bb5-7d39-426e-8394-8cc5838ee626.json) separately records the explicit reconciliation rationale.

Reconciled: explicit new clauses / the user's acceptance amendment take priority over old generic text. The old expectation that the ghost remains is withdrawn, while the original FAIL remains. New cases should verify that pause clears the preview, objectcount remains unchanged, and primary only resumes without recreating it. Native Esc's default unlock does not acquire an additional two-step rule.

The four related generic ghost-retention passages in Sound UX / User Flows / Component States / UI Stress were precisely synchronized to the confirmed cancellation policy. Original exact bytes and Source IDs are preserved separately in history. The [related Conflict](../../../../../knowledge/conflicts/364713fa-a544-4c3e-a1f8-6b177c943456.json) links back to the resolved main Conflict. The Help index retains the same canonical links; no UI code was changed and no browser PASS was manufactured.

The four related text Conflicts are reconciled: only held/ghost semantics were precisely aligned. Original stress/design NOT RUN and old test failures remain; this establishes neither a new product defect nor a successful actual test.

<!-- english-original-anchor --> <a id="curves動態反射正式來源接續b4-candidate"></a>
### Curves/dynamic-reflection formal source continuation (b4 candidate)

Curves 7bb was normally merged into a06, followed by gizmo source b4. Root's full program check / final UI remain in progress. Formal Data Contracts / Acoustic Validation / Ledger continue through new sources; old exact Git originals are preserved in docs15/history, and original research/Task0021 evidence is not rewritten. Analytical sphere/capsule and true snapshot dynamicReflector are added under the shared 256 budget. The 105 objects example genuinely failed at 289 entries, then used exact OBB occluders to represent it in 124 entries, without changing the fixture/cap. See the [model contract](../../../15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md) for model/policy pins and compatibility of old Replay/new reevaluation. Unmodeled curvature focusing/fullwave and similar effects must not be presented as science/performance PASS.

<!-- english-original-anchor --> <a id="curves已合入b4-candidate真ui與最後品質另驗"></a>
### Curves merged into b4 candidate; real UI and final quality checked separately

The [finite Curves synthesis](../../../15-ui-parameter-audit/CURVES_IMPLEMENTATION_20261102.md) read all 31 pins, which match 7bb Git, 8 raw outputs, and the Ledger's old 82 sources / 74 claims, each preserved with 6/5 added. focused 171 / analytic 17 / math 24 / contract 13 / policy 10 each retain their own scope and are not added. The 650/12 sparse ENOENT exit 1 and initial runtime PARTIAL remain. The b4 merged source-only review ran no new tests; four callers / both policies remain. Root quality and new browser/WAV remain pending. Task0030 AC02..04 basic conditions are verified; remaining production DOM / current crosswalk / English / Claude handoff are pending. External Claude revalidation / human testing belong to the next stage and are not required to have already run for closure of the current stage.

<!-- english-original-anchor --> <a id="正式-current-文件與完整新增參數參考"></a>
### Current formal documents and the complete new parameter reference

The [six-document version reconciliation](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/63d4c4f61553a6e1e8bf1106c046581b7386e7d7) preserves each original byte/hash and new source ID. The [formal parameter reference](../../../11-v1/PARAMETER_REFERENCE.md) synchronizes three shapes/four roles,19 triggers/Zone prerequisites, Motion drivers and layered budgets. New sections16–20 describe actual controls, defaults/bounds/state dependencies/JSON-only capabilities for Motion/Render/Zones/Agent workflow/Diagnostics. Architecture/Audio/Behavior UX distinguishes old designs from the current bounded implementation. Original R20/R17 text remains in KNOWN_LIMITATIONS, with the current header explicitly superseding old limits on the same capabilities.

This is code/document reconciliation, with no new browser/product tests.49bde fullruntime1523 PASS is a fixed historical snapshot; the latest controlled short-take debt reproduced a real product FAIL. Pipeline failures and pending repair/revalidation are not resolved by documentation updates. Three native timeouts/0 input,600-second performance and science/device/live gates remain separate. All product functions/Main still need final direct receipts.

A string replacement in the parameter reference accidentally expanded the original prefix following the Zone regex. An English reader found this before writing the mirror. Exact raw bytes of the erroneous73KB snapshot and previous read-reconciliation JSON remain. Reconstruction uses a literal callback. The current47KB document has a single title,20 numbered sections and a sources section; newV3/read-reconciliationV2 supersedes the erroneous snapshot without changing historical product/test results.

<!-- english-original-anchor --> <a id="已凍結49互動曲面有限ui證據"></a>
### Frozen49 interaction/curved-geometry bounded UI evidence

The [independent review](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/bd80edfd4b4c721320b9e82f870723370f0c7542) verifies305 owned artifacts, six trace hashes,19 source snapshot pins (uncommitted runners are not presented as Git versions), and all55/39 files in the two curved-geometry batches. Interaction59 families/58 distinct case IDs have evidence across253/d9/49. The final49 reruns only two cases: the original receipt containing paused-click still has overall FAIL, while the separate gizmo batch has1/1 PASS; both selected cases have0 console errors. Eight curved-geometry groups comprise four original PASS plus four harness-only recheck PASS. Original four FAIL remain. Real solver seven-band sphere ratios and capsule/box moving pose/path/delay have bounded evidence, not every numerical combination/PCM/hearing.

<!-- english-original-anchor --> <a id="新confirmed產品缺陷舊欠帳污染受控短take"></a>
### Newly confirmed product defect: old debt contaminates controlled short takes

The [49 real DOM reproduction](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/856448129a63d8f086f5ae75e02b7f758f57fe88) reports SHORT_TAKE_INTERRUPTED for a new3-second capture after ordinary recording triggers a load-safety pause and Stop seals the prefix. This is a real product issue; it cannot be blamed on the harness or hidden by resetting debt. The original overload guard/negative performance evidence remains valid. Root9fcf adds one exact controlled step through the same physics path, preserving the ordinary wall-time accumulator/discard policy.38 focused tests and new1532 runtime PASS do not establish the latest build/real UI success; affected Motion revalidation and later Render/Zone/Combined remain pending.

<!-- english-original-anchor --> <a id="motion有限矩陣收斂clock缺陷已實際重驗"></a>
### The bounded Motion matrix closes; the clock defect has real revalidation

The [Motion report](../../../14-core-pipeline/stages/11-ui-parameters/pipeline/motion/REPORT.md) and [reconciliation](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0716dde1ce6104d12f63936e74a93e80f3a490e1) cover five49 scenarios plus one new9fc affected record/replay case, not all six rerun under9fc. All73 evidence and15 ignored trace hashes match. Actual downloaded JSON was parsed for the public Stop's five-tick prefix and new180 ticks6..185. Replay authoring is disabled and restored on End; the clock is FIXED_WITH_REAL_RETEST. Original natural overload remains a known performance limit. The49 genuine product FAIL and9fc01 literal-status harness FAIL remain. The owner separately locates/adds bounded Node Motion evidence at different render cadences for Task26 AC02; ordinary PhysicsWorld cadence cannot substitute for it. The full pipeline/crosswalk/final tasks/Main remain pending.

<!-- english-original-anchor --> <a id="task0026有限motion驗收完成"></a>
### Task0026 bounded Motion acceptance complete

The [direct cadence evidence](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4d9a298a737c1e12b78a8c21caee7a8bda740acf) uses real Rapier plus MotionWorkspace with three authored actions, each at30/60/144Hz and240 authoritative fixed ticks. Complete Physics snapshots, published Motion receipt/read model/timeline and terminal state are compared by deepStrictEqual, excluding only runId, with no retiming/rounding/added tolerance. One Node case passes, not three independent tests. Six source pins and original raw results were verified; product files match9fcf Git. The new test itself is a working-file pin, not falsely said to have been committed in9fcf. Combined with Stage05/08/generation fixes and versioned UI of five49 cases plus one9fc case, Task0026's original three criteria have direct bounded evidence and are closed through the CLI. Main completion or already-executed Claude is not required for this task; no full-pipeline/science/device/600-second/complete V1 claim follows.

<!-- english-original-anchor --> <a id="renderer缺資產直接負例已補tail草稿ux另修"></a>
### Direct missing-asset renderer negatives added; Tail-draft UX repaired separately

The [direct negatives](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/55c1a91660460455f240ed6cc24004d1136084a0) and [read reconciliation](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5a2fbfaaa99b06567ff6271734f0a7d317fcbaf0) use valid positive-control PCM/WAV hashes from a real Behavior/solver/Recorder sample. Direct production NativeOfflineRenderBackend calls reject missing PCM/wrong revision/wrong hash with RENDER_ASSET_PIN, no native allocation/progress/file/manifest and unchanged job/recording hashes. One Node case/three variants are not added. Nine exact copies preserve the original test type FAIL and corrected PASS; five pins match test-only commitb6fec5, with product code identical to9fcf. This establishes preflight rejection, not native DSP behavior. Task27 separately awaits the new Generate guard for invalid Tail drafts, actual revalidation and final outputs. Original9fc Render4 PASS does not establish the new guard result; full pipeline/Main remain open.

<!-- english-original-anchor --> <a id="task00240025有限條件完成"></a>
### Tasks0024/0025 bounded conditions complete

The [shared-capability and Meta direct review](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4120d9335f572543ef3b3260103f42a611694f10) verifies that all seven current capability consumers match9fcf Git. Stage03 real Rapier Bounce and17/255 retain their original scopes separately. Zone now has a subsequent real producer; empty registries/uncovered supports still correctly reject. All three49 production DOM Meta/Agent cases pass/CLI0, covering provider/invalid/stale states, cancel Host ack, preview/apply/undo and baseline/candidate/compare. All34 artifacts/five caller pins/seven traces match hashes. Actual requests are only two GETs/zero POSTs; unknown quota does not become billing evidence. Both tasks have bounded DONE under their original three criteria, without extra prerequisites for Main/already-run Claude. Task29's full Zone lifecycle, Task28's whole-product crosswalk, Task27's new Tail guard and Task23's native/Main gates remain separate.

Task0024's current parameter/limits documents now have [exact closure bytes](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7e804965d2cdf96fd8caa9d7fdf4d8fa57bd9177). Later Tail/final-status updates do not alter hashes verified by the old task. Only evidence paths move to originals with identical hashes; status/criteria/test results stay unchanged. The Agent manifest actually has34 evidence files/five sources/seven traces, correcting the synthesis's earlier31 typo; the original machine-readable proof already correctly said34.

<!-- english-original-anchor --> <a id="tail草稿意圖guard已合入真ui仍待"></a>
### Tail-draft intent guard merged; real UI still pending

Root normally merged5010685 after the original9fc product plus test-onlyb6, adding optional draft-validity reporting for the sole Render consumer. Blank/nonfinite/out-of-range drafts disable Generate and give a readable reason; the handler also guards entry. Esc restores the committed value. Original NumberField commit/no-clamp policy remains. This does not claim that DSP rejection was previously broken:9fc output used a valid old value, an intent-UX gap. [Formal parameter section17](../../../11-v1/PARAMETER_REFERENCE.md) now reflects actual code. At this snapshot there are only14 focused tests and an independent source review; real Tail UI/new HTTP/Combined/Help remain pending, without borrowing old Render4 PASS.

<!-- english-original-anchor --> <a id="最新zone真ui讀核有限9fc來源不冒501全重跑"></a>
## Latest real Zone UI review: bounded9fc source, not a complete501 rerun

The [formal Zone report](../../../14-core-pipeline/stages/11-ui-parameters/pipeline/zones/REPORT.md) and [independent review](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7d7f65aa520947ef3e2cacb5acfa69eb999c6b83) verify six distinct passing cases: first four from02, fifth from03, sixth from04, not one clean6/6 run. All44 tracked evidence plus2895 ignored artifacts match bytes/hashes, as do nine product and three final-harness pins. Three old static-preparation harness files differ from current versions; their old hashes were not found in this lane's archive. That historical-reconstruction limit is explicit and does not negate the six final receipts.

Actual180 frames include two raw and two normalized genuine Zone events, Replay retains the same IDs, and downloaded file hashes match. Before/after data covers Project save/load/import,16/17 capacity, references/disabled state, unchanged A/B matched/changed center requiring fresh physics, and an explicit Zone-center anchor through valid JSON. Three Help sites/four instances/eight activation records and three original harness FAILs remain. The real queue-full pause at tick201 is a performance guard, not a health PASS. Task29 AC03/04 basic conditions are verified; AC05 final crosswalk and AC06 documents/English/handoff remain pending, without claiming complete V1/hearing/performance or Main completion.
