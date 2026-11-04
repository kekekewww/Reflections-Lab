<!-- english-source: {"path":"docs/15-ui-parameter-audit/zones/HANDOFF.md","sha256":"eed26f17af9621a8cfc787b1b738e1500bd719163116e3a2a29f5e238373762e","translated_at":"2026-11-02T09:12:04.207Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/zones/HANDOFF.md`](../../../15-ui-parameter-audit/zones/HANDOFF.md). Source SHA-256: `eed26f17af9621a8cfc787b1b738e1500bd719163116e3a2a29f5e238373762e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0029-給整合與-claude-的交接"></a>
# Task0029 integration and Claude handoff

This commit series implements actual Zone core functionality on codex/pipeline-zones rather than merely enabling an unsupported option. The respective owners coordinate root's final merge/browser/WAV and Wiki/task/English work.

| Snapshot | Implementation and results | Official stage source |
| --- | --- | --- |
| fa4c314 | Optional Scene AABB/sphere, atomic authoring UI, actual fixed-step occupancy→raw/normalized→record/replay, shared capabilities and AI/Host references;501/501+build | REPORT.md, evidence.json |
| d35112f | Detached zone/fixed sources do not exclude remote-owner geometry, while retaining stem/budget ownership; Project zone references persist;92/92+build | DETACHED.md, detached-evidence.json |
| a22c978 | Editor-only nominal wireframes, enabled/disabled tokens, raycast pass-through, memoization/disposal; Three/SSR6/6 | volumes.md, volumes-verification.json |
|20bf09a | Atomic stale-draft rejection for same-revision imports with different contents; UI/Runtime registry pins and Scene identity;57/57, tsc/lint | BASELINE.md, baseline-evidence.json |
| Same commit as this file | Zone-only position discontinuity preserves actual Motion-release crossings; RED4 FAIL→new cases PASS, related76/76, final build including all sources above exits0 | POSITION.md, position-marker-evidence.json, final-source-pins.json |

These suites overlap and cannot be added into a new acceptance total. Each older receipt pins its original source. Old PASS results cannot be reused for different latest working-source bytes. Root needs new pins for its source/bundle after merging the curved-geometry builder.

<!-- english-original-anchor --> <a id="接線"></a>
## Connections

SceneSpec.zones is optional; absence does not insert a default[]. At most16 regions. Product Sound discrete triggers must specify zoneId explicitly; the default emitter remains object. Static volumes are only Derived fixed-step body-center samples, not collider overlap or swept tests. Start/reset/new/enable/authored transform/registry changes establish a baseline; continuous mode changes do not. Enter uses an inset and exit an outset. Disabled regions only stop occupancy, retaining IDs and explicit zone-center anchors.

UI Zone tab: zone.browser AABB center(-.8,1,0), half-extents(.5,.4,.5), h=.02 lets the default falling ball cross in/out. Select ball, add enter/exit rules and choose zone.browser. ZonePanel's new saveZone/removeZone actions require expectedSceneRevision and zoneRegistryPin(current zones). Drafts must use their creation-time pin rather than repinning an old draft at Save time.

Same-motion B cannot change registry geometry/enabled/h; it requires new physics. When Scene configuration contains Zones, source-phase reconstruction creates the actual registry and checks raw/normalized zoneId. Zones are not acoustic geometry. Emitter geometry has three states: undefined→legacy owner exclusion, null→detached, string→explicit real body. Root uses the curved-geometry branch's complete builder; do not overwrite it with this branch's legacy box builder.

<!-- english-original-anchor --> <a id="仍待整合-gate"></a>
## Integration gates still pending

Actual browser cases include add/edit/delete/disabled, invalid values, same-metadata-import stale state, ZONE_IN_USE, saving/reloading Projects with rules, editor wireframes and picking behind them, no residual FPS/replay volumes, and complete record-replay/WAV/manifest flows. New functionality does not mean human hearing, Meta live, formal performance or every V1 requirement passed. All source/failure/Git history is retained; no push occurred.
