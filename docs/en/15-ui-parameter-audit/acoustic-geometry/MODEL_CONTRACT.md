<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md","sha256":"e3cd40caad12ed9bef8601d7fa0b4121a7ac31fc88f4009fa09ce77689bd8b5b","translated_at":"2026-11-02T09:42:23.2443461+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md`](../../../15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md). Source SHA-256: `e3cd40caad12ed9bef8601d7fa0b4121a7ac31fc88f4009fa09ce77689bd8b5b`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="曲面與移動反射器有限模型契約"></a>
# Bounded model contract for curved surfaces and moving reflectors

This round follows the user's request to implement options previously marked unsupported and corresponds to RLAB-TASK-0030. Preserve existing analytical box references, mathematical formulas and tolerances. Add curved-surface and explicitly moving-reflector models without marking full V1 or human acceptance complete.

<!-- english-original-anchor --> <a id="幾何與數學"></a>
## Geometry and mathematics

Spheres and capsules retain Scene physical dimensions. Sphere radius is dimensionsM[0]/2. Capsule radius is the same; its axis follows local +Y under the current quaternion, and its half straight-segment length is (dimensionsM[1]-dimensionsM[0])/2. Every non-fixed object must supply a true pose for the current tick; missing data is explicitly rejected rather than falling back to authored pose as a snapshot.

Occlusion queries analytically intersect closed volumes with a finite segment: a quadratic for spheres and the union of a finite cylinder and end spheres for capsules. Only actual endpoint epsilon is excluded; interior segments and mid-segment tangencies conservatively count as opaque occlusion. No transmission paths are added. Curved reflection positions use stationary points on the strictly common-visible exterior arc: at most 48 bisections per sphere candidate; capsules enumerate both end caps and the side, at most 144 iterations. The side's axial solution is weighted by the two legs' radial distances. Candidates use true outward normals, and a seam returns only one path. Independent analytical/value-only numerical references, conditions and fixed tolerances are in [REFERENCE](reference/REFERENCE.md).

Reflector roles are staticReflector or dynamicReflector; dynamicOccluder only occludes. Existing moving staticSurface objects retain occlusion semantics. Inspector explains that the author must select dynamicReflector instead of silently changing the authored role. dynamicReflector uses true position/rotation from every snapshot, with no moving-boundary retarded-time or Doppler solution.

<!-- english-original-anchor --> <a id="預算與可追溯性"></a>
## Budgets and traceability

All surfaces + primitives + boxOccluders share the original maxSurfaces (default 256), without relaxing the cap or silently dropping geometry. Each sphere/capsule consumes one item. Only in the extended model, when uncompressed geometry exceeds budget, dynamicOccluder boxes switch from six planes to analytical OBB-volume occlusion. Reflecting boxes always retain six real finite planes. OBBs use three-axis slab intersection after inverse-quaternion transformation and produce no reflections. Old planar-only requests keep their representation. Exclude the emitting body for each source before checking budget. Cache keys include face/volume representation; caches live for only one snapshot build, not across ticks.

The original 105-object mixed regression contains 33 boxes, 33 spheres, 33 capsules and 6 base objects. After adding curved geometry, the old representation had 289 items and actually failed. Analytical-occluder compression produces 124 items: 124 is admitted and 123 explicitly rejected, with the original fixture and 256 cap unchanged. Segment tests remain explicitly bounded. Incomplete visibility fails closed; missing paths must not be interpreted as physically absent paths.

Path IDs comprise model/topology/source/listener/geometry IDs, without coordinates or ranking. Normals serve solving only, without inventing AcousticFrame normal fields. Only the solver produces rays.

<!-- english-original-anchor --> <a id="模型版本與錄放"></a>
## Model versions and recording/replay

Pure legacy planar requests retain web-geometric-1.0.0. Any scene with an acoustically participating curved object or dynamicReflector uses web-geometric-primitives-1.0.0. Every source in the same complete Scene explicitly pins that same version, even when its own geometry exclusion leaves no curved object. Unknown pins and extended geometry paired with the old pin are explicitly rejected.

New recording/reevaluation metadata must verify the actual model. Do not recompute an old baseline under the new model and silently call it matched A/B; recording again is required for comparison. Existing stored AudioReplay retains its original version/paths and is not retroactively rejected based on today's Scene capabilities. source.objectId retains binding ownership. Omitted emitterObjectId retains owner self-exclusion; null denotes a zone/fixed detached source without owner exclusion; a string excludes an explicit existing entity. An explicitly dynamic emitting body must still supply a valid true pose with unit rotation even when excluded from geometry.

All new Runtime/Host recordings add emitterGeometryPolicy=explicit-emitter-body-v1 to solverConfig. This versions the caller's geometry-exclusion policy, not the global solver version. New-model object attachment A→fixed/zone attachment B retains the same policy and follows the existing behavior-A/B independent-variable rules. The existing artifact validator adds no default and changes no stored bytes. Affected old fixed/zone baselines missing the policy require recording again; new reevaluation must not silently change occlusion. Policy differences explicitly mismatch through the original solverConfigHash; unchanged stored AudioReplay remains playable.

<!-- english-original-anchor --> <a id="能量及未建模範圍"></a>
## Energy and unmodeled scope

Existing pressure magnitude remains 1/pathLength × sqrt((1-scattering)R) × air attenuation. Unrendered scattering×R is a diffuse-reflection allocation, not additional absorption. This is a bounded ray-path-amplitude approximation without curvature divergence/focusing/caustics compensation. It has no solid transmission, diffraction, surface waves, coherent interference, low-frequency full-wave solving, retarded time or moving-boundary Doppler. The model does not guarantee accurate small-object occlusion at arbitrary wavelengths. Scientific claims CG-REF-001–005 and original sources are in the [Evidence Ledger](../../../../research/EVIDENCE_LEDGER.json); literature is not numerical-test evidence.

<!-- english-original-anchor --> <a id="驗證層級"></a>
## Validation levels

V0: original receipts separately cover contracts, positive/negative data, UI enabled/state gates, versions and budgets. V1: independent analytical/value-only numerical references plus legacy planar regressions. V2: fake-context replay/transport connection tests only, without claiming actual Web Audio waveform validation. V3: external independent acoustic-solver/full-wave comparisons NOT RUN. V4: this stage's Node-test elapsed time is not formal device performance; actual browser/runtime/deadline evidence is separately listed under integration acceptance. V5: calibrated-room/hearing/human tests NOT RUN.
