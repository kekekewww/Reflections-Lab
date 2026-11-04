<!-- english-source: {"path":"docs/15-ui-parameter-audit/zones/BASELINE.md","sha256":"1c4095a8437270edd14dd80ec8c0ebea6ee0dc7485710f57869dce57a74ebe0e","translated_at":"2026-11-02T09:12:04.199Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/zones/BASELINE.md`](../../../15-ui-parameter-audit/zones/BASELINE.md). Source SHA-256: `1c4095a8437270edd14dd80ec8c0ebea6ee0dc7485710f57869dce57a74ebe0e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0029-補充區域草稿與同-revision-匯入的基準守衛"></a>
# Task0029 supplement: baseline guards for Zone drafts and same-revision imports

Date: 2026-11-02; starting point a22c978b957ea3e5564b894f8a57a7353e0fa4da. Original core/DETACHED/volumes reports and pins are retained, each representing only its original pinned snapshot.

<!-- english-original-anchor --> <a id="已確認問題"></a>
## Confirmed problem

The zone_ui subagent reproduced the issue using actual LabRuntime and an in-memory Project import: keep projectId/sceneId/sceneRevision unchanged and change Zone half-extents from [1,1,1] to [2,2,2]. The old draft had only revision/project-key guards, so it could still successfully write back [1,1,1] and the name Old draft without an error. This was a direct Node observation against pre-fix a22 source. Original stdout was not archived separately, so an independent original TAP must not be claimed. The pinned source commit and later negative cases permit revalidation.

<!-- english-original-anchor --> <a id="修補與契約"></a>
## Fix and contract

- Pure zoneRegistryPin(zones) derives a bounded registry baseline from the same canonical plain JSON. The cap is16; absent and empty collections are equivalent for editing semantics. JSON object-key order does not affect the result, but authored array order, IDs, geometry, names, enabled and hysteresis do.
- ZoneDraft saves registryPin when created; editing numbers does not update that baseline. Both visible stale state and the controller's fresh snapshot before submission compare this value.
- The added saveZone/removeZone LabActions now require expectedZoneRegistryPin alongside the original expectedSceneRevision. Draft Save uses its creation-time pin; enable/disable and Delete use the registry pin displayed for that operation.
- Runtime compares the registry pin during preflight validation and again in the atomic guard after async prepare/drain, also pinning the Scene reference at operation start. Even an import with the same revision and regions but different contents of other objects cannot be overwritten by an old prepare's complete Scene.
- Conflicts reject with REVISION_CONFLICT and preserve the new Project/Scene/zones. The draft can still be canceled and reopened. No persistent Scene/config field, run hash, global epoch or security authority is added. The pin is only an optimistic authoring baseline, not a secret/credential.

<!-- english-original-anchor --> <a id="驗證"></a>
## Verification

- baseline-runtime.txt:8/8, including two new actual-LabRuntime negative cases. Old save/delete both reject when identical metadata contains different Zones. Importing a new Project with the same revision/regions but ball.massKg=2 during async drain rejects the old transaction and retains the new object value. A key-order-equivalence positive case still writes successfully.
- Focused UI-draft subagent tests:30/30, including new baseline changes, equivalent key order and registry deletion/state/authored-order changes.
- baseline-regression.txt:57/57 PASS,0 skipped, concurrency=2; includes UI drafts, actual Three wireframes, Zone runtime, real Rapier/worker pipeline and detached acoustic ownership.
- baseline-lint.txt, baseline-format.txt and baseline-typecheck.txt: scoped ESLint/Prettier and whole-tree TypeScript exit0.
- baseline-evidence.json records the final production-build status; Node/SSR is not represented as browser/GPU/actual-audio acceptance.

<!-- english-original-anchor --> <a id="目前生命期界線"></a>
## Lifecycle boundary at this snapshot

The original PhysicsWorld.setMode keeps generic BodyPose.discontinuity active until the next fixed step. Zone producer uses that flag, so the first step after an explicit body-mode change also establishes a baseline. Normal force/grab/setKinematicTarget does not establish a baseline every step. Root was informed of these source semantics and the finer position-discontinuity policy. Preserving exact edges across continuous mode changes would require a separate position-discontinuity marker and real-Rapier boundary tests; simply ignoring a same-tick teleport would be wrong. This patch did not silently change that physics policy.

<!-- english-original-anchor --> <a id="整合"></a>
## Integration

ZoneVolumes view source remains a22's editor-only nominal wireframe. This patch only connects the new action pin to the same ZonePanel. Root must preserve the prior DETACHED.md three-state contract when merging the complete geometry builder. Actual browser stale/save/overlay/audio-file gates still require root's latest production bundle under an exclusive lease. This branch did not start Chrome.
