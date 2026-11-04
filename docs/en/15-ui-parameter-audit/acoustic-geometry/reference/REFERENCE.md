<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/reference/REFERENCE.md","sha256":"d6911d82471f27fb01a08271211f1490fa9c042e8baa116e00445e41abdbfb58","translated_at":"2026-11-02T09:43:18.0648728Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/reference/REFERENCE.md`](../../../../15-ui-parameter-audit/acoustic-geometry/reference/REFERENCE.md). Source SHA-256: `d6911d82471f27fb01a08271211f1490fa9c042e8baa116e00445e41abdbfb58`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="曲面與移動反射器獨立數學參考"></a>
# Curved and Moving Reflectors: Independent Mathematical Reference

This page covers Task0030 and source claims CG-REF-001/005. This is V1 geometry/engineering-formula validation; it cannot serve as V2 audio, V3 external acoustic solver, V4 formal performance, or V5 real-room/listening evidence. See [SOURCES](SOURCES.md) for scientific sources and amplitude limitations; the original test is [curved-reference.test.ts](../../../../../tests/acoustics-runtime/curved-reference.test.ts).

<!-- english-original-anchor --> <a id="參考方法與獨立性"></a>
## Reference Methods and Independence

The product solves spherical reflections by bisecting the path-length derivative on the mutually visible arc. The independent reference does not use the product's derivative, arc boundaries, bisection, or capsule decomposition to generate expected values:

1. Exact construction from the reflection law: first fix a surface point P, outward normal n, and unit tangent t. Set the directions from P toward the source and receiver to cos(a)n + sin(a)t and cos(a)n - sin(a)t, respectively. Fix the two distances at 2.3 m and 4.7 m, so the expected intersection P, total path length 7 m, and normal are known. This tests spheres, capsule sides, end caps, arbitrary rotations, and seams.
2. Independent numerical reference: in the source–sphere-center–receiver plane, scan 32768 points over the complete 2π normal-angle domain, assign Infinity cost to invisible points, then refine with 90 iterations of golden-section search that reads only total distance. It does not read the product derivative or use a product-returned point as the expected value.
3. Existing analytical plane answers: take two snapshots of a moving plane at y=0 and y=0.5, with fixed endpoints (1,1,0) and (5,1,0). The expected reflection points are (3,0,0) and (3,0.5,0), and the path lengths are sqrt(20) and sqrt(17) m, respectively. Expected values are not calculated with the product's mirroring helper.

The exact construction does not copy the implementation: it applies the reflection law in reverse to generate fixtures, and the product must independently recover the intersection from different endpoints and geometry. The numerical reference uses only general vector algebra and distance functions; it does not import product geometry helpers.

<!-- english-original-anchor --> <a id="共同可見凸弧的條件"></a>
## Conditions for the Mutually Visible Convex Arc

Fermat's general condition is stationarity, not an unconditional global minimum. Minimization here applies only to the mutually visible domain of an external convex body.

Let the sphere center be C, radius r>0, P(θ)=C+r n(θ), and tangent t. For a single endpoint E, let d=|P-E| and u=(P-E)/d. Direct differentiation gives:

d''(θ) = r² [1-(u·t)²] / d - r (u·n).

In the strictly externally visible domain (E-P)·n>0, u·n<0, so this expression is positive; the sum of the two distances is strictly convex on the mutually visible arc. This project derivation supports the unique stationary point/minimum within that finite domain; **it does not extend to general concave surfaces, multiple reflections, caustics, or endpoints inside the body**. An exact tangent has no strictly positive visibility dot product and is rejected as a reflection in this model; segment queries against a closed opaque body may conservatively count contact as occlusion.

Capsule side/end-cap candidates and their numerical implementation are product engineering work; this test does not generate expected values with the same decomposition. When halfLength is 0, it checks against the independently equivalent sphere geometry.

<!-- english-original-anchor --> <a id="fixture單位與容差"></a>
## Fixtures, Units, and Tolerances

All positions and distances are in m, angles in rad, sound speed in m/s, and delay in s; gain is a pressure ratio. The material is an original project Synthetic material with R=0.64, A=0.36, T=0, and scattering=0.25, not a measured material.

| Fixture | Input/Expected | Tolerance/Rejection |
| ------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| CURVE-REF-01 | Translated sphere, three arbitrary outward normals, each tested at a=0, 0.43, 1.1, 89°; known intersection and two leg lengths | Point/normal 2e-7; total length 4e-7 m; incidence/reflection cosine 2e-7 |
| CURVE-REF-02 | Four asymmetric endpoint pairs; full-angle-domain value-only reference | Intersection 2e-6 m; separate from exact-fixture tolerances |
| CURVE-REF-03 | Capsule with axis normalize(1,2,-1); side, upper/lower seams and points 1e-6 m from the seams, both end caps including near-seam normals | Same as exact fixtures; cannot be relaxed to facet error |
| CURVE-REF-04 | capsule halfLength=0 versus a concentric sphere of the same radius | Point/normal difference 2e-7 |
| CURVE-REF-05 | Same-direction collinear endpoints, opposite endpoints, interior/surface endpoints, exact grazing | Same-direction intersection (1,0,0); the others produce no reflection |
| CURVE-REF-06 | Open segment, endpoint self-intersection, entire segment inside body, exterior sphere miss, both capsule end caps and side | Opaque-body queries match expected values; cap y=±1.5, side x=±0.5 |
| CURVE-REF-07 | Actual solver output for curved surfaces | Length 7 m, delay=7/343 s (2e-9 s), gain=sqrt(0.64×0.75)/7 (2e-8); small movements retain the path ID |
| CURVE-REF-08 | Two actual geometry snapshots of a dynamicReflector | Point 2e-7 m; plane path length 1e-10 m; same path ID |
| CURVE-REF-09 | Actual solver paths at capsule end-cap/side seams, plus opaque dynamic occluders | A seam produces only one reflection; direct paths crossing the volume are occluded, without fabricating transmission paths |

The 2e-7 m threshold for exact intersections is on the same scale as the product's existing 1e-7 m self-intersection epsilon; it is not a real acoustic error bound. The value-only total distance is second-order flat near its minimum, so double-precision distance differences lose significant digits before angles do. The independent optimization therefore uses a separate point-difference tolerance of 2e-6 m, without changing the product's acceptance boundary or the existing plane reference. Total bisection work must also be bounded (sphere ≤48, capsule ≤144).

<!-- english-original-anchor --> <a id="執行與結果"></a>
## Execution and Results

The initial round covered only six math-kernel groups:

- Command: node --import tsx --test --test-name-pattern='CURVE-REF-0[1-6]' tests/acoustics-runtime/curved-reference.test.ts
- Raw result: [math-initial.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9eb5f9ec6e01252b36e6155f8de77519e7be58c0).
- Inspected result: 6/6 PASS, 0 FAIL, 0 skip, exit 0. This does not include the solver wiring in CURVE-REF-07/08.

After complete wiring, all nine groups were run separately:

- Command: node --import tsx --test tests/acoustics-runtime/curved-reference.test.ts.
- Final raw result: [reference-final-pinned.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/83b18eda76458a22e8bfc6c0cf81ec1a733b2cec); machine-readable sources/methods/validation levels: [verification.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8696b2748d68395b6213db3d374d3fa11b7957c2).
- Inspected result: **9/9 PASS, 0 FAIL, 0 skip, exit 0**. The hashes of the five product/reference-test files were identical before and after execution. They are a fixed snapshot of the uncommitted working tree; the observed Git HEAD is not presented as a commit containing the uncommitted implementation.
- An exact tangent conservatively counts as a hit in closed-body segment queries; epsilon excludes only tangents at actual endpoints. Axial capsules, end-cap interior/seam endpoints, opposite axial endpoints, and duplicate cap/cylinder candidates are all included.
- Local ESLint and Prettier checks both exited 0. Existing analytical plane answers, fixtures, and tolerances were unchanged.

<!-- english-original-anchor --> <a id="明確未驗與模型限制"></a>
## Explicitly Unverified Items and Model Limitations

The engineering amplitude proxy 1/pathLength × sqrt((1-s)R) is retained; **it does not include curvature spreading/focusing, caustics, diffraction, surface waves, coherent wave interference, transmission through thick solids, or reflector retarded-time/Doppler effects**. Passing geometric position and delay checks does not establish these amplitude effects.

Formal V0 schema/capability/budget negative cases are listed separately in the lead package. V2, V3, V4, and V5 are all NOT RUN in this reference task. Results were not used to infer RT60, DRR, C50, or calibrated SPL; values remain null when the expected evidence is insufficient.
