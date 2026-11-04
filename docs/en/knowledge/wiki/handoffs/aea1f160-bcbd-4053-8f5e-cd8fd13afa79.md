<!-- english-source: {"path":"knowledge/wiki/handoffs/aea1f160-bcbd-4053-8f5e-cd8fd13afa79.md","sha256":"e89bd850ba3b45464b4e06d4239f48894f591371c437bc0adaebdc9d42fd537f","translated_at":"2026-11-01T18:07:12.000Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
---
id: RLAB-HANDOFF-aea1f160-bcbd-4053-8f5e-cd8fd13afa79
title: R21: first-person mouse controls, audio dropout fix and hover tooltips complete and handoff saved; only the human retest remains
type: handoff
status: UNVERIFIED
created_at: 2026-11-01T18:06:08.850Z
updated_at: 2026-11-01T18:06:08.850Z
sources: []
related_tasks:
  - RLAB-TASK-0022
related_decisions: []
supersedes: []
tags: []
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/handoffs/aea1f160-bcbd-4053-8f5e-cd8fd13afa79.md`](../../../../../knowledge/wiki/handoffs/aea1f160-bcbd-4053-8f5e-cd8fd13afa79.md). Source SHA-256: `e89bd850ba3b45464b4e06d4239f48894f591371c437bc0adaebdc9d42fd537f`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="r21第一人稱滑鼠操作音訊斷續修正與懸浮提示完成並保存交接只剩真人重測"></a>
# R21: first-person mouse controls, audio dropout fix and hover tooltips complete and handoff saved; only the human retest remains

Agent / Session: claude-code / r21-fps-audio-help-20261101

Task: [RLAB-TASK-0022](../../../../../knowledge/tasks/RLAB-TASK-0022.json)

Git: claude/meta-hack-r18-handoff-d292c8 / 05d40fd2d52f4b737f6acac61fa00356403c0038

<!-- english-original-anchor --> <a id="已完成"></a>
## Completed

- Recorded the user's 2026-11-01 report (B1 to B4 normal, B5 building failed, audio breaking up) and two requirement changes: mouse controls with direct building, and help text moved into hover tooltips
- First person: left click grabs / throws, hold the right button to preview and release to place, the right button puts down a held object; mid-air placements use dynamicNoGravity; placement completes the geometry ack and activation automatically and is one undo step; placement is refused during recording, replay and an audio restart; the hint bar moved to the bottom of the viewport
- Audio: audio buffer presets (default Stable), a scheduling lookahead used only for onsets, an output underrun counter and a safe restart with timeouts; removed the parameter automation repeated on every physics step; state is published at most once per frame
- Help text: 35 explanations became HelpTip hover tooltips; a sphere has a single diameter and a capsule a diameter plus height; the status line no longer shows help at startup; added the parameter reference (Chinese and English)
- Codex (gpt-6.1-sol, xhigh) implemented the changes; Claude Code coordinated, measured, wrote the docs and re-ran verification; three independent review rounds (Claude subagents, read-only) found 1 BLOCKER, 8 MAJOR and 21 MINOR issues, all fixed
- Measurement found and withdrew one regression: parameter ramps scheduled in the future raised editor output underruns to 74

<!-- english-original-anchor --> <a id="修改範圍與-hash"></a>
## Changed scope and hashes

- {"path":"src/app/behavior-diagnostics.ts","sha256":"deb024f1594cec3c5e72325531084f8f99026805b9a4446120b2091f2ea94ff2","state":"present"}
- {"path":"src/app/bootstrap.ts","sha256":"31101de786ff6ee80e25b555802136c0d3910ad9744741adb5edce48a69bb5a5","state":"present"}
- {"path":"src/app/replay-audio.ts","sha256":"69213a4e4698d2c7af3e9ef28b9c9578ab5b1b961a16e8c0bc67324b2e1dc20f","state":"present"}
- {"path":"src/app/runtime.ts","sha256":"e14324019677af9bc25d642d6f357c64bb0172e8034a43ceba3d53a8b5994f0f","state":"present"}
- {"path":"src/audio/control.ts","sha256":"3afa1252bccae701b5c7a6d51c68f5bb3f180120f3df65a30b12b98847859d24","state":"present"}
- {"path":"src/audio/engine.ts","sha256":"46937e8957d7e09dcb81d492441f16e6aa12863d364da6b2d586e5cad8dac423","state":"present"}
- {"path":"src/audio/routes.ts","sha256":"57da0e83cdf09dd549db7498aa81c1c0bdecd351063fa8023e08ed88d66320f9","state":"present"}
- {"path":"src/audio/types.ts","sha256":"543b132ae44ab9a8ff36d72aae075b327932d4b632fcfe8dd6043d4e7174b9bd","state":"present"}
- {"path":"src/interaction/interaction-host.ts","sha256":"e2ca52217cc66a97453d9ffdadb2efd2df14a159089d536e4aff77cceb6b37ef","state":"present"}
- {"path":"src/interaction/types.ts","sha256":"36b480fe07e838019cf9afacb63fbd6d2fd87e701a28f9553e76dddcaf548bc1","state":"present"}
- {"path":"src/physics/fixed-clock.ts","sha256":"064583c1b040a3243f95f562d95d3c90587c914b7b4e9d9278f36eb60e8d77a0","state":"present"}
- {"path":"src/scene/validate-scene.ts","sha256":"39b0c5c467693a9a781147b993714f4479225c23566e5bb06b953c02d6ca7c05","state":"present"}
- {"path":"src/ui/AnalysisDock.tsx","sha256":"b55d9147b829c9ab7d0de9538f01d935673a53c4c89acb205744e37889df237d","state":"present"}
- {"path":"src/ui/App.tsx","sha256":"9788a59539805d6963372b2c603d4bef554ec28ed8a40ea54023c801418c4263","state":"present"}
- {"path":"src/ui/BindingOverrideEditor.tsx","sha256":"2e6526f568b522d4dcdd7c3da60302369cf6f449a4daa99a00f61a2ff568ac35","state":"present"}
- {"path":"src/ui/Inspector.tsx","sha256":"36c90056da5290bb5a38f66f402fb4e12f05ba88a459c0b29b16478960c6aec7","state":"present"}
- {"path":"src/ui/MappingEditor.tsx","sha256":"44f48dc48c36b7c043ec381bd5cb91965de2a356fed3e12fc9261f451faa1c29","state":"present"}
- {"path":"src/ui/ProjectImport.tsx","sha256":"ddfa344a73eebae37c2b3dabebdaf728de2179286e6045ec52cb9b1983093d18","state":"present"}
- {"path":"src/ui/RuleCard.tsx","sha256":"c57fa87a6024f6be63cd33e79e5ce1d19b122d6d16b67e6e6df757793e52bdba","state":"present"}
- {"path":"src/ui/SceneExplorer.tsx","sha256":"3c82cf69f5a1c7d4537de62b86e3cd51f097191d77bd85dfee814bb77cdf2e54","state":"present"}
- {"path":"src/ui/Viewport.tsx","sha256":"a90fbfafa5d84ac0033f7108ed1b936ced7adfcd8c6a337755b7e9ceea7f70c8","state":"present"}
- {"path":"src/ui/behavior-diagnostic-text.ts","sha256":"e480805a66b9053d1dfd0ff2aa7c48714695a7587c2fe6d767933aa24152fd7b","state":"present"}
- {"path":"src/ui/components.tsx","sha256":"692188edc3afb0186f4bbdd8f3f863ada5bac6dafc47a188903fce98b10466d1","state":"present"}
- {"path":"src/ui/contracts.ts","sha256":"357c538dfcfbada80089bf3e70ff36d759b27ce42887b14acc3c35174d323342","state":"present"}
- {"path":"src/ui/locale-model.test.ts","sha256":"2b0e5822a8d87fd1f7f8c1e435cc34edd019e70da8af1576fd03694aea831ba9","state":"present"}
- {"path":"src/ui/locale-model.ts","sha256":"d9ebca7d46713c2cb917e8949440574ecf21feef28f65c566314e5fb296dcce2","state":"present"}
- {"path":"src/ui/locales/core.ts","sha256":"9c18551c0bc7c3963fa549b2c7466227024fb503927d3f25a590d32b68f085da","state":"present"}
- {"path":"src/ui/locales/explorer.ts","sha256":"4456acead0c52a97eabcf24d403c47363f4dc27e9bcdabaea4dd69e4b2e59cc5","state":"present"}
- {"path":"src/ui/locales/index.ts","sha256":"cbbdc68c222e0c15f6c79f7f1000c5a7d744e8ec250e36ca0c88129bcc7c101c","state":"present"}
- {"path":"src/ui/locales/status.ts","sha256":"4d38337f74a7fec89f18e139446e5d2f9bf204df869b3c7674570501cb8cb6d5","state":"present"}
- {"path":"src/ui/locales/viewport.ts","sha256":"3846b6d83de7c8136643bd476ba8d30bd5647d2b681dbb70ca21cc199ae9c2b0","state":"present"}
- {"path":"src/ui/styles.css","sha256":"61730452a3d03a0e88607499f725463c78fe381fb3eab5052be769419c008b3e","state":"present"}
- {"path":"src/ui/viewport/SceneEntities.tsx","sha256":"343370c64dd945e89832eb679ae73164892f88498a3de39f49d24a2e68174c3f","state":"present"}
- {"path":"src/ui/viewport/fps-entry-coordination.test.ts","sha256":"5bf90dd4656c6cbd89dac070b0b7e5df2a734e0cba7c7719ea85046cab1183ff","state":"present"}
- {"path":"src/ui/viewport/useFPSInput.ts","sha256":"aad985be346f8dce4fe767f20af9cb75ada3346fd1751017b3aff5791d72e714","state":"present"}
- {"path":"tests/app/interaction-outcome-status.test.ts","sha256":"d65afd235461f0e9cebc85ad449f718e25d55baa3d473ba4de5546ef7bb5380a","state":"present"}
- {"path":"tests/app/native-admission.test.ts","sha256":"a64e967b8cb76abc1a63fa420c8c3a8bb81586ee99a448dcb808bb7634a38f02","state":"present"}
- {"path":"tests/app/replay-audio.test.ts","sha256":"63db1dd0c665443236315efd50f237cc59d68ae3f876fa864703693049341fc3","state":"present"}
- {"path":"tests/app/view-projection.test.ts","sha256":"05e89cdaa942336e11649fe4a4068fdab78b3a1c522c9f5237a2dbdfd5c653e0","state":"present"}
- {"path":"tests/audio-runtime/routes-response-reuse.test.ts","sha256":"d83abd4bc48edf816bc66617f7d9bc1dfa324701902a67a64aff6e48823415be","state":"present"}
- {"path":"tests/browser/fps-entry-race-recovery.spec.ts","sha256":"d55d8ee0a62f534630908de813d3c8beb512944dc29aaf493cb94552febfc3d1","state":"present"}
- {"path":"tests/browser/gizmo-lifecycle.spec.ts","sha256":"79c6a054b2893d19c7d36c100eac2e52a218a49f914d430ff2c9b8406b9beada","state":"present"}
- {"path":"tests/browser/ui-first-use-refined-v2.spec.ts","sha256":"37a05b278c6618c02f3d2f92604eff8c8702d04a4efc27961095cab1eda2a8a8","state":"present"}
- {"path":"tests/browser/ui-locale-refined-v2.spec.ts","sha256":"7655f68175c8d0ada1a82d2b0355e82bc29f5d407c1acc620b5dd0b1b49600bb","state":"present"}
- {"path":"tests/browser/ui-refined-v2.spec.ts","sha256":"7d325aff020b1c3c7ce3cecaeccd2b9d170dc9c1a7b176bc2dbb97d2633a9c2c","state":"present"}
- {"path":"tests/browser/ui.spec.ts","sha256":"963a12c1d0c794066a12b1a079c92f36d690120dd009403da785173339603641","state":"present"}
- {"path":"tests/interaction-runtime/host.test.ts","sha256":"d627f7dcfea9cbc91aca4ba11b937b54909e1d3d01e84d6ba4b2588bb50d344a","state":"present"}
- {"path":"src/audio/buffer-preset.ts","sha256":"d13bd3382644c55867f7d0139b73d45ce9be89115684b6620ac58b4b431780e4","state":"present"}
- {"path":"src/ui/HelpTip.tsx","sha256":"6de8e0e9f26ec6ac6b2c9acabcf99d52d0364397a02656fda56a6fc10c8598f7","state":"present"}
- {"path":"src/ui/help-tip.test.ts","sha256":"6fda1b5de0bb3a41630056eb53a1712b2a7b641ccd222773933d8fc32d01ade1","state":"present"}
- {"path":"src/ui/locales/help.ts","sha256":"bbc86cf604ec8e8379ec6bf06ed267b66d1d29b43eda3694b76cebc16ded2a8c","state":"present"}
- {"path":"src/ui/viewport-controls-review.test.ts","sha256":"0c06ae56f108e778add7705377c27b3730033b6e496f1e3104c6ad28d783a1af","state":"present"}
- {"path":"tests/app/audio-review2.test.ts","sha256":"5b8de0465ee6e3af34cbf1e7ce2725b003f63f763b68ab9984673efb962a18ac","state":"present"}
- {"path":"tests/app/audio-review3.test.ts","sha256":"6bf480f0e2bf46a10106744f0e96ebeeb17e68315c6bd139bf98b55f3c8a1b4d","state":"present"}
- {"path":"tests/app/audio-smoothness.test.ts","sha256":"bf38376a11d3fc18b6573265ca3fde4e6414dcbd143bcdb5945af2c5b15b8162","state":"present"}
- {"path":"tests/app/fps-placement.test.ts","sha256":"2bbabcea68632791b895d2d2f9d8f0f636766ed1fa7bac1778ca45cecedaba6d","state":"present"}
- {"path":"tests/app/fps-review.test.ts","sha256":"181695f73a0b99ae3a31d661e3a54941c4922d4d83b87e756656ede738ea3708","state":"present"}
- {"path":"tests/app/startup-status.test.ts","sha256":"b6317e3740a5935171ebaf9f73c56dff5f69104207cd3bf86b0efcbc101eac66","state":"present"}
- {"path":"tests/audio-runtime/buffer-preset.test.ts","sha256":"5f1917934d1f2e7813d5d48588d16f4fbb3dc68c2dfc54b2f5016dace5c94f62","state":"present"}
- {"path":"tests/audio-runtime/review2.test.ts","sha256":"1c5b249bc7a28c24c1fab783af6a2575794f45d87ef7c557f9006c1618397c1f","state":"present"}
- {"path":"tests/audio-runtime/smoothness.test.ts","sha256":"8d1f7438253a18b1f59dc8ef2e5d6e58454187d70f1fbaf32b2d17ed8f1f968a","state":"present"}
- {"path":"tests/browser/audio-smoothness/fixture.html","sha256":"b25296ff97684c59cc74fef48ac4bfa7ab484955900be3c6968e8bd3b5a64435","state":"present"}
- {"path":"tests/browser/audio-smoothness/fixture.mjs","sha256":"3c26b962e25eea3cdc4ed4ed7837ae6de36c6815947366ac5d0db0cbb018d573","state":"present"}
- {"path":"tests/browser/audio-smoothness/run.mjs","sha256":"7f646a6743180a24975980dbee3ee81908f4de07bb0f4fa70c1bf910f6ed84f1","state":"present"}
- {"path":"tests/browser/audio-smoothness/tap-processor.js","sha256":"de7d7aad25f08061878ad5b9699358fb9c07cc7dc2247c918ab77c1744db397e","state":"present"}

<!-- english-original-anchor --> <a id="執行命令與結果"></a>
## Commands and results

- npm run check (R21 final working tree): exit 0; receipt artifacts/v1/r21-final-20261101/npm-run-check.txt
- unit: UI/viewport/interaction/race 175 pass; audio-runtime/app 526 pass; typecheck, lint and format:check exit 0
- browser: ui-refined-v2 47, pointerlock-race 2, linked-workflow-v2 8, physics 2, storage 5, run-product-refined-v3 4 (source/bundle provenance true)
- Legacy entries: npm run test:browser:ui 5 pass / 8 fail and npm run test:browser:product 4 fail, identical to the baseline; the legacy product failure archives were moved to the session scratchpad
- Audio smoothness (headless, 20 s, no capture tap, final two runs): editor output underruns 19 → 1, first-person walk 14 → 1; physics about 0.64 → 0.95× real time

<!-- english-original-anchor --> <a id="證據"></a>
## Evidence

- {"path":"docs/11-v1/USER_TEST_FEEDBACK_20261101-r21.json","sha256":"c5080ecb3aabbfbe1fb734b314092498ffd81842b7881a3dccb1e6ce7b5f044b","result":"R21 user report: B1 to B4 normal, B5 building failed, audio breaking up, parameter documentation and help-text requests"}
- {"path":"artifacts/v1/r21-final-20261101/verification.json","sha256":"b717b06d700a1d7e9151f152e6e927cc92b27090e17a27d0d050302acd384432","result":"R21 final verification record: gates, three independent review rounds, audio measurements and items pending a human"}
- {"path":"artifacts/v1/r21-final-20261101/npm-run-check.txt","sha256":"db7fd6208a4474bded17601892149724cfc6c821352f7703c9c83f10ee2bf98d","result":"npm run check receipt for the R21 final working tree, exit 0"}
- {"path":"artifacts/v1/r21-final-20261101/gates.tsv","sha256":"d1f766967de80f8b9b498c7fd907ec88e69be6c0ef151c1da6d58923e050e4d5","result":"Exit codes of every gate on the R21 final working tree"}
- {"path":"artifacts/v1/r21-audio-smoothness-20261101/final-notap-1/summary.json","sha256":"b8ccbde356c9a9797fe10733ffc27462789d05a4faaa96edbb47a337273c0aeb","result":"R21 final audio measurement, run 1"}
- {"path":"artifacts/v1/r21-audio-smoothness-20261101/final-notap-2/summary.json","sha256":"03695b3d64e6436b0f2bb240afb183d1951fee0f632b8e78bf6f61c09c7b14f3","result":"R21 final audio measurement, run 2"}
- {"path":"artifacts/v1/r21-audio-smoothness-20261101/baseline-r20-notap/summary.json","sha256":"8ea951d6f26a8b26f192357746f622df6bf8eb21ebe232deb874f2e9003b3aea","result":"R20 baseline audio measurement"}
- {"path":"docs/11-v1/ACCEPTANCE_AMENDMENTS.md","sha256":"86277ac416219466182bd1e3721c942633a46a1d7734b30c474933425b3766ff","result":"Acceptance amendments: mouse controls with direct building, and hover tooltips"}
- {"path":"docs/11-v1/PARAMETER_REFERENCE.md","sha256":"ddd7e8b64c2932dcf0959ca8fbb58774c778bd39e8ef30c6c6762ec7750eb85d","result":"Parameter reference"}
- {"path":"docs/11-v1/FULL_TEST_PROCEDURE.md","sha256":"5b52edd90c8b216e8bf04eb751f6dbeb763fe444d2eeb9fb0d7b8d99e5a619c8","result":"Complete test procedure (R19/R20/R21)"}
- {"path":"docs/KNOWN_LIMITATIONS.md","sha256":"4b2f7c89f0c263d120b00cb49165d82ed52de8b0556e24b26106a95da81f711e","result":"R21 current limitations"}
- {"path":"docs/05-ux/FPS_INTERACTION_UX.md","sha256":"c591a093c11fc0b9f5a24c789063ed7130fae02e8af1070ff535387eab616aef","result":"First-person interaction UX (R21 mouse controls)"}

<!-- english-original-anchor --> <a id="風險與未完成"></a>
## Risks and unfinished work

- All evidence is headless Chrome, CDP input and code review; a physical right mouse button, a human Pointer Lock, real listening on Brave, touch and screen readers are unverified
- Physics and interaction still run on the main thread; if a real GPU browser still stutters, the next step is a Web Worker, not implemented in this round
- The playbackStats field names come from Chrome 156; other browsers may show NOT_AVAILABLE
- The R21 changes are not committed; the branch is not pushed or merged

<!-- english-original-anchor --> <a id="下一步"></a>
## Next steps

- The user follows docs/11-v1/FULL_TEST_PROCEDURE.md, starting with B5, B6 (the R21 focus) and the B1 hover tooltips, at normal 100% scale and with the physical volume turned down first
- Update RLAB-TASK-0022 from the report; for failing items create a new R report and reproduce before fixing
- The user decides whether to commit the R21 changes and merge this branch; never push the full local history to the public main

Original event: [aea1f160-bcbd-4053-8f5e-cd8fd13afa79](../../../../../knowledge/events/aea1f160-bcbd-4053-8f5e-cd8fd13afa79.json)
