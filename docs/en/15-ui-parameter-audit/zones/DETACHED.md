<!-- english-source: {"path":"docs/15-ui-parameter-audit/zones/DETACHED.md","sha256":"971e9e29d68d522d840ed81b80c4dffaeb8c7dbcb3d4f7fffd65aac0cb4efcdc","translated_at":"2026-11-02T09:11:56.1060853+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/zones/DETACHED.md`](../../../15-ui-parameter-audit/zones/DETACHED.md). Source SHA-256: `971e9e29d68d522d840ed81b80c4dffaeb8c7dbcb3d4f7fffd65aac0cb4efcdc`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0029-補充detached-聲源幾何歸屬與-zone-project-引用"></a>
# Task0029 supplement: detached-source geometry ownership and Zone Project references

Date: 2026-11-02; starting point fa4c3142ba56fa420608b3b1e4a87cc6143b322d. At source level, this supplement resolves the pending "Subsequent cross-module repair" at the end of core REPORT.md. Core 501/501 is an earlier pinned point and does not extend to this patch. Production browser/hearing remains NOT RUN, for unified Root validation after merging.

<!-- english-original-anchor --> <a id="問題與修補"></a>
## Problem and repair

Original AcousticSourceInput.objectId meant both logical owner and acoustic-geometry self-exclusion. When a rule explicitly selects a zone or fixed anchor, the source can be detached from its bound object. If the bound object lies across the source→listener path, the old projection still excludes it, falsely leaving the direct path visible.

- New behavior-acoustic-source.ts resolves binding, profile, rule, revision and generation from accepted documents and rejects identity mismatch. Attachment is not inferred from source coordinates.
- Logical objectId/instanceId remain unchanged, preserving tracks, audio budgets and ownership. VoiceIntent, AudioEvent, SoundInstance and Scene/config schemas receive no new fields or defaults.
- Only zone/fixed attachments add emitterObjectId:null to acoustic-source input. Object/contact inputs omit the field, retaining old source-input bytes. StaticPreview, Live solve/capture/pause restore, RecordingProcessor and ExperimentToolHost share this resolution.
- Builder tri-state: undefined uses old-owner self-exclusion; null means detached and does not exclude the owner; string means an explicit emitter body, which must exist. This branch adds only the smallest equivalent hunk to the existing box builder for independent testing. When Root merges acoustic_geometry_core's complete primitive builder, preserve its transform/bounds/capacity/cache and explicit-target checks rather than overwriting the new builder with this branch's old version.

End-to-end tests also exposed hardcoded zoneIds:[] in Project authoring validation: Scene volumes persisted, but Projects with zone-trigger/emitter rules failed UNKNOWN_ZONE. validate-project now projects zone IDs from the same sceneSnapshot and uses trusted product producer capabilities. Authoring validation does not claim playable assets; unknown regions and product zone triggers without explicit IDs remain rejected. Disabled regions preserve references and roundtrip.

<!-- english-original-anchor --> <a id="可重現驗證"></a>
## Reproducible validation

- detached-final.txt: 5/5 PASS. Real-solver contrast scene: source=(-2,1,0), listener=(2,1,0), owner box center=(0,1,0). Detached input retains the owner's six surfaces and directOccluded=true; old input without the field excludes the owner and returns directOccluded=false. Explicit zone/fixed previews share this policy; object attachment still self-excludes.
- Real LabRuntime import Project → captureShortTake(3/60) → verify → same-motion RecordingProcessor B and ExperimentToolHost RunSimulation(0.1s) all retain owner occlusion and original objectId. Evidence class remains logicalIntent, not hardware/native PCM.
- Project positives include zone trigger + zone emitter in one document and disabled references; negatives include removed registries/missing trigger IDs. Data roundtrips identically.
- detached-regression.txt: **92/92 PASS, 0 skipped**, concurrency=2; covers new/old acoustic input, Zone core, StaticPreview, RecordingProcessor, ExperimentToolHost and Project/persistence.
- detached-lint.txt/detached-format.txt/detached-typecheck.txt: scoped ESLint, Prettier and full-tree TypeScript exit 0.
- detached-build.txt: production npm run build exit 0; index-CR3KlAmZ.js. Retain the existing chunk-size warning without a performance-pass claim. This bundle was not served-browser evidence on 4173 and does not yet contain the later wireframe slice.
- Independent bounce_review performed read-only checks of accepted identity, stop diagnostics, candidate/pinned documents, pause restore and Project references. No new BLOCKER/MAJOR was confirmed; tests were not independently rerun.

<!-- english-original-anchor --> <a id="保留失敗與整合提醒"></a>
## Retained failures and integration reminders

- detached-initial.txt: 3/4; actually caught the missing Project registry and was fixed.
- detached-second.txt: 4/5; the new fixture incorrectly labeled the existing evidenceClass verified and was corrected to actual logicalIntent without relaxing product validation.
- detached-third-fixture-fail.txt: 4/5; new Host fixture duration=0.05 violated the original tool minimum 0.1 and was changed to a legal value without changing schema/min/assertions.
- Original core REPORT/evidence.json/501 receipts and frozen oracles remain unchanged. New source/receipt pins are in detached-evidence.json.
- Root integration must preserve the geometry branch's emitterObjectId tri-state: null must not fall back to the owner through ??. Wireframe is a separate commit/source point. Browser gates remain with the Zone UI audit on the latest production bundle.
