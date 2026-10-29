<!-- english-source: {"path":"artifacts/v1/physics-boundaries-20261027/README.md","sha256":"bcbc2222247da86cc7d673a1967985378409f25d6c2a212e6343982098561b1c","translated_at":"2026-10-27T07:03:39Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/physics-boundaries-20261027/README.md`](../../../../../artifacts/v1/physics-boundaries-20261027/README.md). Source SHA-256: `bcbc2222247da86cc7d673a1967985378409f25d6c2a212e6343982098561b1c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="正式物理邊界驗證2026-10-27"></a>
# Production Physics Boundary Verification (2026-10-27)

This work only added `tests/physics/v1-boundaries.test.ts` and evidence in this directory; it did not modify the core, existing matrix, packages, or frozen acceptance criteria. This is evidence for individual checks in Node/actual Rapier 0.21.0 WASM. It does not mean that the complete first version, browser checks, hearing tests, or performance have passed.

Final execution: `node artifacts/v1/physics-boundaries-20261027/run.mjs combined-final --combined`. The actual subprocess was `node --import tsx --test --test-concurrency=1 tests/physics/v1-matrix.test.ts tests/physics/v1-boundaries.test.ts`; 2026-10-27 06:10:36.265Z–06:10:41.301Z, 38/38 PASS (29 existing matrix checks + 9 new checks), FAIL/SKIP 0, exit 0. Each test's simulation loop ran at most 240 ticks; the process deadline was 55 seconds, with no timeout.

The [final verification](../../../../../artifacts/v1/physics-boundaries-20261027/combined-final/verification.json) preserves the command/times/exit/full before-after hashes, 61 protected expected/actual hashes, raw TAP/stderr hashes, and hashes of two fresh measurements. Source stable, protected stable/match, counts valid, and measurement freshness are all true. The [independent semantic review](../../../../../artifacts/v1/physics-boundaries-20261027/independent-review.json) was completed by another read-only Codex subagent, which did not run or modify the core; the final test and runner SHAs match those reviewed.

| New case | Actual measurement/decision |
| --- | --- |
| 20° slope | Actual 45° climb setting; 90 ticks advanced 2.571926 m and rose 0.925472 m |
| 60° slope | Maximum uphill displacement over 90 ticks was 0.021937 m, less than the actual radius of 0.25 m; no climb across the slope |
| 0.7 m doorway | Actual radius 0.25 m, skin 0.01 m, clearance on each side 0.09 m; passed through, z went from 1 to -1.877539 m |
| 0.4 m doorway | Clearance on each side -0.06 m; stopped at z=0.266063 m, without crossing the near face of the doorposts |
| Small ball high-speed Throw/CCD | Ball diameter 0.02 m, wall thickness 0.01 m, 12 m/s and 0.2 m per tick; one 1.2 Ns COM impulse, CCD enabled, x=-0.014999 m after 30 ticks, still on the near side of the wall; after re-grabbing, resending the command ID preserved Held/original velocity |
| Rotated surface, support ordered first | 30° rotated fixed surface, world normal approximately [-0.5,0.8660254,0]; both the analytical plane condition for the static surface witness and pre-step v+ω×r matched |
| Rotated surface, body ordered first | Canonical normal reversed, with positions/magnitudes unchanged; contact tangential velocity was approximately 0.8000005 m/s, materially different from the COM-only 0.5 m/s |
| Multiple-contact box face | Actual 4 positive impulses, totaling 2.104348302 Ns; COM momentum change 2.104348354 Ns; the fixed-surface witness calculated independently using positive impulse weights matched the event position; only one impact in 120 ticks |
| Same-tick wall corner | Hit floor/wall simultaneously at tick 10; two domain pairs/episodes with their own normals, two impacts in total over 120 ticks, with no mixing of normals |

`1e-5` absolute applies only to comparisons of copied Float32 WASM values with analytical vector/transform/momentum calculations in these cases; no general physical penetration tolerance was added. Penetration and tracking measurements in the original matrix retain their existing criteria, without relaxation.

The first [RED](../../../../../artifacts/v1/physics-boundaries-20261027/boundaries-red/stdout.tap) occurred because the new test incorrectly assumed that positive impulse weights for planar contact must be symmetric, requiring weighted x/z=0; the actual iterative solver produced asymmetric weights (x=-0.006241885 m). This was not a product defect. The corrected oracle reads each positive impulse and fixed-surface witness from the raw manifold and independently computes Σ(J·witness)/ΣJ; it still retains the y=0, raw J sum, and actual COM momentum assertions. The RED test's original source, stdout/stderr, and before-after hashes are fully preserved and have not been overwritten. `boundaries-v2` and `combined-v1` remain as intermediate history; `combined-final` is the current final evidence.

All four independent [static check](../../../../../artifacts/v1/physics-boundaries-20261027/static-checks/verification.json) processes exited 0/without timeout: project-wide `tsc --noEmit`, strict type checking of the new test (including noUncheckedIndexedAccess/exactOptionalPropertyTypes), eslint for the new test, and Prettier check. Each process's raw stdout/stderr is in `static-checks/`.

Important final SHA256 hashes:

- `tests/physics/v1-boundaries.test.ts`: `ca07b4182943e0a3475f7750d75136e64e1262126c081b24b7e58e47e3b3636e`
- Original `tests/physics/v1-matrix.test.ts`: `8c04776ba0ab6ba618a1d8ac30042f34ab6403c7a484187a44896d6428d57e81`
- `src/physics/physics-world.ts`: `071adc79ac6a0b7f12b7dade2994e7d4ae0df07c40899eaae547fd45a764dcc4`
- `src/physics/character-motor.ts`: `5e3d29d2e0d71c6ae0b4a87f3bb944bd123ebe0402220e574859421fddd4a8f9`
- `src/app/runtime.ts`: `691c62a6307911dd0a92b87be58710131ec6b06f7bd404a6b8a4d6c9fc7bfc40`
- `combined-final/verification.json`: `bb9755a7a92ce65e4c82a4e81fae50b1f1c10759e9bc5e32a94fc1787ba005e4`

Limits: slope tests start at legal spawn points on the slope and do not yet cover slope-entry seams; the wall corner uses separate convex domain objects and does not claim completeness for multiple patches within the same pair for arbitrary compound shapes; public events expose Ns without exporting N force, and force equivalent is explicitly J/dt; intermediate CCD contacts may not remain in the post-step manifold, and complete micro-contact timing is not claimed. No browser/CI/installation/Git writes/Meta/Muse calls occurred. The root takes over Wiki updates as the sole writer.
