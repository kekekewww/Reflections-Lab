<!-- english-source: {"path":"docs/15-ui-parameter-audit/zones/REPORT.md","sha256":"a1276b3d9b3cdcec188eb200f679e4a8933fef5bea6c5c32ad4a4f0f18ca29a3","translated_at":"2026-11-02T09:11:55.9650535+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/zones/REPORT.md`](../../../15-ui-parameter-audit/zones/REPORT.md). Source SHA-256: `a1276b3d9b3cdcec188eb200f679e4a8933fef5bea6c5c32ad4a4f0f18ca29a3`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0029靜態區域作者設定與真固定步進出事件"></a>
# Task0029: static-zone authoring and real fixed-step enter/exit events

Date: 2026-11-02. Branch: codex/pipeline-zones; implementation starting point: f6abb936a8c7c87ff8eb5e6587260b837e6b67ae. Executor: Codex capability_core, with zone_domain/zone_ui implementation and read-only bounce_review checks.

This stage completes zone-core connections and Node/Rapier/worker validation. **Production browser UI, actual monitoring, WAV export and post-integration revalidation are left to Root on the latest sole 4173 bundle. This branch neither started a browser nor claims those gates passed.** This is not a full first-version, performance, hearing or Meta-live pass.

<!-- english-original-anchor --> <a id="作者資料與命令"></a>
## Authoring data and commands

- SceneSpec adds optional zones, with at most 16 static regions. Old data without zones does not receive an empty array, preserving old canonical bytes/hashes. Explicit zones:[] is preserved, and Undo can restore the original omission.
- SceneZone shares id, name, enabled, centerM and hysteresisM. shape=aabb has halfExtentsM; shape=sphere has radiusM. Names are 1–80 characters, each center axis is ±200 m, half-extents/radius are 0.05–50 m, and hysteresis is 0–0.25 m and strictly less than the minimum half-extent/radius. IDs are unique across all Scene entity classes.
- SceneOperation adds AddZone, UpdateZone, RemoveZone and SetZones, retaining expected revisions, isolated copies and atomic commit after validation. SetZones null means omission and an array means explicit data; its inverse preserves complete authoring order/values.
- Closed JSON/schema rejects unknown fields, wrong-shape parameters, NaN/Infinity, sparse arrays, invalid dimensions/hysteresis, duplicate IDs across classes and a 17th region.
- No phantom objects, Rapier sensor bodies or acoustic surfaces are created, and object physics/acoustic roles are unchanged.

<!-- english-original-anchor --> <a id="真-producer-與明示語意"></a>
## Real producer and explicit semantics

After Rapier finishes a fixed step, PhysicsWorld runs PhysicsZoneProducer on actual BodyPose data. Zone events follow existing events and bounce but precede fixedStep afterStep observers, so recording, behavior bridges and observers see the same raw-event batch.

- DerivedFixedStepBodyCenterWithHysteresis classifies object centers only, not full-collider overlap or continuous swept crossings/CCD. A fast outside→outside crossing within one step may produce no event.
- Nominal-volume signed boundary: sphere uses Euclidean distance minus radius; AABB uses maximum axis distance minus half-extent. When previously outside, distance <= -h enters; when previously inside, distance > +h exits.
- At this reported source point, the first stable completed step after start/reset, generation changes, teleport discontinuities, re-enabling after disable, region geometry/enabled/hysteresis changes, epoch changes or time discontinuities establishes only an occupancy baseline, without inventing enter/exit events.
- Normal held/kinematic fixed-step motion still produces crossings; ordinary dynamic motion, grab/release and trajectories have no blanket suppression. Disable/delete/inactive states emit no fabricated exit.
- enabled controls occupancy only. Disabled regions retain IDs/centers/rule references, and explicit zone emitters can still use those centers, consistently in Live and StaticPreview. A zone trigger's default emitter remains the object's actual center rather than silently moving object sources to the region center.
- Per-step limits are 16 regions, 256 poses and 2048 existing+new events. Stable zone/object IDs determine ordering; event IDs contain epoch/tick/zone/object/generation/edge. Budget overflow is explicitly rejected.

<!-- english-original-anchor --> <a id="共用規則uiai-與信任入口"></a>
## Shared rules, UI, AI and trusted entry points

- The discrete trigger's optional zoneId is backward compatible. Product OnEnterZone/OnExitZone must explicitly identify an existing region. Raw PhysicsEvent and normalized input both retain source=zone, zoneId and actual object center.
- The single getSoundBehaviorCapabilities projection now has zoneProducer=true, but an empty registry still returns ZONE_REGISTRY_EMPTY and a Host without a producer still returns ZONE_PRODUCER_UNAVAILABLE. Limits include Derived/sampled/baseline/disabled semantics.
- ProfileRegistry/Sound Host/BehaviorEditor/Offline planner share the same trusted context. Unknown IDs, zoneId on non-zone triggers, product zone triggers without IDs and forged source/normalized metadata are rejected. The Offline planner requires the prompt to explicitly contain exactly one known zone ID; it does not guess a region.
- Meta strict wire declares the new optional zoneId as required nullable. The decoder fills null only for zoneId omitted by old discrete wire, then validates strict schema and the restored original schema without relaxing unknown-field or operation checks.
- AnalysisDock adds the Zones tab, reusing existing components, HelpTip, fonts and tokens. It can add/edit AABB/sphere regions, enable/disable and delete. Numeric inputs use raw drafts, finite/range validation and step=any; errors do not fall back to old numbers.
- RuleCard/Inspector adds an explicit event-region selector. New rules select only enabled regions. Existing disabled regions show disabled status while preserving references. Switching to a non-zone trigger clears zoneId; dirty/ack comparison includes zone ID.
- saveZone/removeZone LabAction carries expectedSceneRevision. Pause, finish recording/replay and return to Editor first; revalidate revision/mode before asynchronous commit. Atomically reject deletion of regions referenced by triggers/zone emitters with ZONE_IN_USE, listing profileId/ruleId without silently changing rules.
- Project save/load, JSON export/import and Undo/Redo use the same Scene authority. Replay-view zones come from displayScene; event details include Zone ID.

<!-- english-original-anchor --> <a id="錄製與-ab"></a>
## Recording and A/B

- Raw/normalized coreEvent comparisons conditionally include zoneId. Source phase reconstructs zoneIds/zonePositions from recorded sceneSnapshot. With regions present, product producer capabilities also apply; stripping IDs from both raw and normalized data is still rejected.
- A nonempty registry and Derived producer policy enter the physicsConfig fingerprint; zones do not enter acoustic geometryHash. Omitted/empty registries do not contaminate legacy physics fingerprints.
- A/B reevaluation after geometry/enabled/hysteresis changes returns ZONE_REGISTRY_CHANGED and requires a new physics recording. Without region changes, same-motion behavior B can reevaluate through both the yielding client and a real Node worker while preserving the raw trace. Zone input without a baseline returns ZONE_BASELINE_REQUIRED.
- A real Rapier trace crossed an AABB, recorded OnEnterZone/OnExitZone matching normalized metadata and retained raw traces through serialization, verification and MotionReplay, without recalculating the producer to invent new events.

<!-- english-original-anchor --> <a id="驗證與保留失敗"></a>
## Validation and retained failures

Final broader regression-final.txt: **501/501 PASS, 0 skipped, exit 0**; build-final.txt: TypeScript + Vite production build exit 0. Toolchain: Node 22.17.0/npm 11.4.2. Per-file source and receipt SHA-256 values are in evidence.json. Completed component receipts:

- domain-tests.txt: Scene 32/32 (14 new). domain-checks.json is the domain subagent's checkpoint at that time. Later schema-format changes can make its early hashes historical; use evidence.json for final source hashes.
- focused-final.txt: 44/44, including real Rapier, source phase, actual worker reprocessing, AI wire and capability negatives.
- anchor-consistency-final.txt: 10/10, including the original StaticPreview negative and real BehaviorRuntime consistency for disabled anchors.
- rapier-lifecycle.txt: 11/11; rapier-lifecycle-and-budget.txt: 12/12. Covers actual Rapier authoring teleports, registry changes, disable/re-enable, delete/recreate, no fake reset events, and exact 2048 capacity/overflow rejection.
- typecheck-final.txt, lint.txt, format.txt: types, scoped ESLint and Prettier checks for all changed code/schema completed.
- schemas.txt: existing schema validation 19 schemas/3 examples PASS.

Retain tests-initial-fail.txt (new recording fixture reflectionOrder=0 outside the existing processor range), regression-first.txt (473/482), fixture-contract-recheck.txt, review-gaps-regression.txt, anchor-consistency.txt, lint-initial-fail.txt and format-initial-fail.txt. No failures were deleted or assertions/tolerances relaxed.

Of the broader first run's 9 FAIL cases: strict-wire discrete-trigger positives needed explicit new nullable zoneId (two literals affecting three cases); the original "missing producer" negative now explicitly sets zoneProducer=false; 5 capture-baseline ENOENT cases came from unmaterialized sparse-checkout files, restored from pinned starting-point Git blobs with identical hashes and no reference changes. The original missing-zone StaticPreview negative remains, with only the precise rejection reason under the new capability updated to ZONE_REFERENCE_UNAVAILABLE. Old test preimages remain under preimages/.

<!-- english-original-anchor --> <a id="整合操作交接"></a>
## Integration-operation handoff

- Open the Zones tab → Add zone → ID/name/shape/center/dimensions/hysteresis → Save zone. Example: zone.browser, AABB center=(-0.8,1,0), halfExtents=(0.5,0.4,0.5), h=0.02. The default ball falls from y=2 and crosses after a stable step; no fabricated event is needed.
- Select ball → add OnEnterZone and OnExitZone → select zone.browser as the event region. Rules default to an oscillator and object emitter. Operate the latest production bundle and retain receipts when recording/replay/raw metadata/audio evidence is required.
- Available selectors: `getByRole('tab',{name:'區域',exact:true})`; `region(name:'區域')`; `button(name:'新增區域')`; `form(name:/編輯 zone\./)`; `textbox(name:'區域 ID'/'名稱')`; `combobox(name:'形狀')`; spinbutton prefixes `中心位置 X/Y/Z m`, `半尺寸 X/Y/Z m`, `半徑 m`, `邊界遲滯 m`; `button(name:'儲存區域'/'取消草稿')`; Esc discards the draft.
- Root owns the final browser lease, integration merge, Wiki/tasks/sources and English documentation. This stage did not push, add dependencies or call paid/external APIs.

<!-- english-original-anchor --> <a id="後續跨模組修補"></a>
## Subsequent cross-module repair

Integration review confirmed that the old AcousticSourceInput.objectId served both voice ownership and geometry self-exclusion. With an explicit zone/fixed anchor detached from its owner, that owner must not be automatically excluded. Coordinated with acoustic_geometry_core to add optional tri-state emitterObjectId: undefined retains old-owner fallback, null is detached without exclusion and string explicitly identifies an entity. The 501-PASS/build source point here does not yet include that patch. At that point, the next limited patch was to retain ownership/stem/budget IDs and separately test real-solver occlusion contrasts. This known cross-module item was not claimed closed at that source point.
