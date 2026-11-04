<!-- english-source: {"path":"docs/15-ui-parameter-audit/zones/volumes.md","sha256":"4c691428a172e768fd3d483aead45907edbc612429ae6fbe2640a93e41a5dcf6","translated_at":"2026-11-02T09:10:27.6540371+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/zones/volumes.md`](../../../15-ui-parameter-audit/zones/volumes.md). Source SHA-256: `4c691428a172e768fd3d483aead45907edbc612429ae6fbe2640a93e41a5dcf6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="區域名義範圍線框視圖"></a>
# Zone nominal-volume wireframe view

Date: 2026-11-02 (Taiwan). Branch: codex/pipeline-zones. This slice uses metadata commit d35112f as its baseline and adds the editor's Zone-volume view. It does not modify the Camera, Gizmo, physics, acoustic solving or serialization of authored data.

<!-- english-original-anchor --> <a id="實作"></a>
## Implementation

- Adds src/ui/viewport/ZoneVolumes.tsx; Viewport.tsx gains only an import and one component invocation.
- AABB converts authored halfExtentsM into full width, height and depth; spheres use authored radiusM, and positions use centerM. These Three geometries are view-only and do not enter Scene objects, Rapier colliders or acoustic-surface data.
- Visible only in editor mode. Hidden in FPS; current authored zones are hidden during replay so present regions are not overlaid on a potentially different historical scene.
- Enabled zones use canonical accent and disabled zones use canonical textMuted, with opacity also distinguishing them. Wireframes only, without solid fill, additional animation or new design tokens.
- Mesh raycast explicitly produces no hits and registers no pointer handlers, so objects behind it remain clickable. Wireframes do not write depth, preserving a recognizable authoring overlay. Existing Camera/Gizmo selection controls are unchanged.
- Geometry is memoized by shape/dimensions and disposed when its primitive is replaced or unmounted; the existing R3F declarative lifecycle manages materials. Three engine objects are not serialized.
- Bilingual ZonePanel HelpTips explain that the wireframe is the nominal volume: entry uses inset bounds and exit uses expanded bounds. This is fixed-step center sampling, not a continuous sweep; an outside-to-outside crossing within one step may emit no event. Disabled-occupancy and authored zone-center-anchor semantics remain those of the original metadata slice.

<!-- english-original-anchor --> <a id="基本驗證"></a>
## Basic validation

node --import tsx --test src/ui/viewport/zone-volumes.test.ts: 6/6 PASS.

1. Three AABB vertex bounds match authored half-extents without mutating input.
2. Every sphere vertex radius matches authored data.
3. Enabled/disabled states render differently while keeping their status visible.
4. A real Three Raycaster can hit the test overlay before suppression; after installing ignoreZoneRaycast, it hits only the object behind it.
5. FPS, replay and no-zone SSR output are empty.
6. Editor output retains each zone's stable ID/enabled state without changing original region data.

npm run typecheck: exit 0. Scoped ESLint for the four affected TS/TSX files: exit 0. Prettier applied; volumes-verification.json records sources and command results.

No browser, Computer Use, production build or GPU profiler was started. Node geometry/SSR/raycast checks do not establish human visuals, steady-state GPU resources or complete object-selection acceptance. After integration, the parent agent supplements production-build and real-browser validation under an exclusive lease.

<!-- english-original-anchor --> <a id="整合與後續複核"></a>
## Integration and later review

Check that enabled/disabled AABBs and spheres appear at the correct centers and nominal dimensions in the editor. Ensure no wireframes remain after switching to FPS/replay, loading a legacy project or Undo/Redo. Directly clicking objects behind wireframes must still use the original selection/Gizmo path. Changing dimensions must release old geometry. Actual readability and GPU behavior with many zones still await real-browser review.
