<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/review.md","sha256":"596a217c82c237ced3e485d4fd28995f72ef63fa41fbb06e94ebcb3469fd0c33","translated_at":"2026-11-02T09:44:46.673Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/review.md`](../../../15-ui-parameter-audit/acoustic-geometry/review.md). Source SHA-256: `596a217c82c237ced3e485d4fd28995f72ef63fa41fbb06e94ebcb3469fd0c33`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0030-曲面與遮蔽幾何最終複核"></a>
# Task0030 final review of curved-surface and occlusion geometry

Status: this bounded mathematics/integration review PASS, with no confirmed blocking defect found. It is not full-product or acoustic-science acceptance. Recorded at2026-11-02T09:27:55.716Z.

<!-- english-original-anchor --> <a id="方法與獨立性"></a>
## Method and independence

This reviewer previously implemented the primitive and OBB mathematical core. This is therefore an isolated integration review, not a wholly independent code review of the entire implementation. Nine independent references authored by another agent construct expected answers from predetermined reflection points/equal-angle directions, plus a full-circumference value-only scan/golden search, without taking product outputs as expected values. This review reran those tests while leaving original reference receipts unchanged.

Read-only scope covers solver, primitives/OBB, request builder, shared role/model capabilities and delivery-identity connections. No product source, test, Wiki or Git index changed. During review, lead only added shared model derivation, service pins and a builder string-pose gate; that connection was reread. The mathematical core did not change during this test run.

<!-- english-original-anchor --> <a id="查核結果"></a>
## Findings

| Item | Result and evidence scope in this review |
| --- | --- |
| Curved geometry | Sphere uses derivative bisection on a commonly visible arc. Capsule considers both spherical caps and side candidates with an analytical axial side solution. Actual radial normals; only one body path at a capsule seam. At most48 sphere bisections/144 total for capsule, without tessellation |
| Closed bodies/endpoints | Analytical sphere/capsule volume intervals; OBB uses three-axis slabs after actual inverse-normalized quaternion transformation. Actual endpoints are excluded by1e-7m. Closed-body tangency conservatively occludes. Interior representative points serve only blocked booleans, never surface normals/reflection vertices |
| Capacity/degradation | Planar, primitive and boxOccluder entries share original maxSurfaces; each visibility test is bounded by maxSegmentTests. Incomplete work fails closed with budgetExceeded. maxPaths overflow explicitly truncates; absent paths do not prove no actual sound path exists |
| Mixed105 objects | Only in the extended model and when uncompressed items exceed budget does the builder replace dynamicOccluder boxes with one OBB. Reflecting boxes retain six exact faces. No objects removed or256 cap increased. Independent mixed105 fixtures and exact124/123 capacity positive/negative cases were read; their execution receipts belong to lead's other regressions, not this24-case run |
| Roles/poses | dynamicOccluder never enters the reflection loop. dynamicReflector uses the actual snapshot pose for that tick. Moving staticSurface is not silently upgraded. All new inputs receive bounded/nondegeneracy validation |
| Identity/ownership | Path IDs derive from model/scene topology/source/listener/geometry domain IDs, excluding rank, pose, candidate indices and Rapier handles. Builder caches distinguish faces/volume and deep-copy across sources. Detached emitters do not incorrectly remove binding-owner geometry |
| Legacy data/model pins | Legacy planar-only omits primitives/boxOccluders/modelVersion. Original planar formulas/reference tolerances are unchanged. Scene-wide model pins do not mix versions because one emitter excludes itself; a legacy pin with new geometry rejects. The new backendVersion/path-ID-prefix identity gate in service was read; this run did not independently inject transport faults |
| Energy/time | Original A/R/T energy sum, sqrt((1-s)R) pressure and single absolute delay remain. Scattering is not added to absorption. Curves solve geometric positions only;1/pathLength amplitude has no curvature divergence/focusing/caustic compensation. Solid-transmission capability remains false; no transmitted sound is fabricated |

<!-- english-original-anchor --> <a id="本輪執行"></a>
## Executed in this review

`node --import tsx --test tests/acoustics-runtime/primitives.test.ts tests/acoustics-runtime/box-volume.test.ts tests/acoustics-runtime/curved-reference.test.ts`

Exit0;24/24 PASS,0 FAIL,0 SKIP, comprising primitive8+OBB7+independent reference9. TAP duration289.5623ms is only this small test's elapsed time, not performance acceptance.

Raw output: [`math-final-review.txt`](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c55040d7224e98e6f7750d4aa4f0e785d7152e6e), SHA256 `b6aa4cd7fe0d52c762068e93687108900225216e5ac29298f38938eef7cad6f2`.

<!-- english-original-anchor --> <a id="source-pins"></a>
## Source pins

Actual HEAD `f6abb936a8c7c87ff8eb5e6587260b837e6b67ae` is the branch base. This review checks uncommitted new working-tree bytes pinned by the following SHA256 values; no final commit is invented.

| Path | SHA256 |
| --- | --- |
| `src/acoustics/types.ts` | `b63c408f7567483716625cf614524a7064a31a4700e307fd6968d107ef2e34c3` |
| `src/acoustics/geometry.ts` | `d6f32a043e29794d08b950f50addfb7841673a441723cde3fc3674e930929dd4` |
| `src/acoustics/primitives.ts` | `1194f590e30dc52ee33683e2b052674f2673287fb59f02b933d88242bbc9f702` |
| `src/acoustics/box-volume.ts` | `012692cde885e28cf3b7023c8201c2dab9249e2a0d851a8b1d6872b267bf852f` |
| `src/acoustics/solver.ts` | `bb06e300ba9528306c6d1420ef7a15c77fbaaa4d1ba7c4c226399a4144fcf20f` |
| `src/capabilities/acoustic-geometry.ts` | `13309dc0b4e75aa169777404f39a16d1b6359bbd6e4b961622433aa709f4e9e9` |
| `src/app/acoustic-input.ts` | `f9c6cc11e12676aea45c2bd09ce238faec3bc3ed347359acbe290fbfa72c9a5b` |
| `src/app/acoustic-service.ts` | `a41bcf0ed33fda8b5183cd9ed29b69e9841d5b6b3ea4262bd8abbaae774f0ed3` |
| `tests/acoustics-runtime/primitives.test.ts` | `46234fb4f703950c30c2bd10ffc3d0f5f440bfadfe5070987031b337689b4949` |
| `tests/acoustics-runtime/box-volume.test.ts` | `c6a6825939ba574fbcedce5e598f3c222f218aefa76b4a3d8aa7500030a33965` |
| `tests/acoustics-runtime/curved-reference.test.ts` | `dbaade7a63ac53b912387f1c9709b0ad119c14ea9883ea8b2be2fde126f11fc1` |
| `tests/acoustics-runtime/curved-solver.test.ts` | `7ac0bf387b2d482331e69ced132e851e191bf65410795a488335c5c2cffbd30c` |
| `tests/app/acoustic-primitives-input.test.ts` | `85a46ccb1304f0ffe9d126d81a49f33dccbe7f163cfb4806195f7b1d329aeb58` |

<!-- english-original-anchor --> <a id="限制與未執行"></a>
## Limits and work not run

- These24 cases support the V0/V1 type, geometry and synthetic-reference scope. They do not fill complete V2 renderer/V3 room-measurement/V4 hearing/V5 physical-device validation.
- No correctness claim covers curvature focusing, diffraction, surface waves, phase-correct wave interference, retarded-time moving boundaries or an independent Doppler model.
- Browser Worker, UI, final Zone merge, WAV/hardware output, humans and formal600-second performance were not run; root validates them separately through actual flows.
- Infinite inputs, every extreme condition number and all scene combinations were not exhausted. Grazing/near-boundary behavior follows explicit EPS/model limits.
