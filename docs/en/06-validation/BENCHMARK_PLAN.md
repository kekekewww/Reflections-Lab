<!-- english-source: {"path":"docs/06-validation/BENCHMARK_PLAN.md","sha256":"e8305598f2069b3a07c1ecc057cb5ffa94149f56ead7dd1e8659336436592893","translated_at":"2026-10-27T03:39:37.5810752Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/06-validation/BENCHMARK_PLAN.md`](../../06-validation/BENCHMARK_PLAN.md). Source SHA-256: `e8305598f2069b3a07c1ecc057cb5ffa94149f56ead7dd1e8659336436592893`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="驗證與重現計畫"></a>
# Validation and Reproduction Plan

This directory contains research preparation and isolated validation, with no production acoustic engine, browser interface, or audio product. Passing synthetic data and analytical formulas supports only their corresponding conditions; it cannot be elevated to measured results or completed product functionality.

<!-- english-original-anchor --> <a id="重現"></a>
## Reproduction

The environment is pinned to Node 22.17.0 and npm 11.4.2; Python 3.12.11 is used only for SDK/other research scripts. Node tests do not depend on Python.

```powershell
npm ci --ignore-scripts
npm ci --prefix experiments/physics-spike --ignore-scripts
npm run check
npm run benchmark
npm run validate:all
```

`package-lock.json` pins the actually resolved versions and npm integrity. `npm run environment -- --strict --output benchmarks/results/environment-local.json` saves version/hardware information without secrets; `validate:all` saves each command, exit code, stdout/stderr, timing, and version hashes. CI also installs from the lockfile; see the SDK documentation for the separate native Steam Audio smoke test. Execution of a Windows binary is not falsely claimed for Linux CI.

CI actions are pinned to the official [checkout commit](https://github.com/actions/checkout/commit/11bd71901bbe5b1630ceea73d27597364c9af683) and [setup-node commit](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020); the commits' existence was checked on 2026-10-26. The remote GitHub Actions jobs have not been triggered in this session. `typecheck` currently covers the TypeScript adapter for fixture metadata/future src. Correctness of the JavaScript kernel is checked by Node tests and lint; there is no claim of TypeScript static type coverage across the entire repository.

<!-- english-original-anchor --> <a id="驗證層級"></a>
## Validation Levels

| Level                       | Current status            | Specific evidence and boundaries                                                                                                                     |
| --------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| V0 Model Contract           | PASS (isolated contracts) | 8 Draft2020-12 schemas compiled, with positive/negative cases; quaternion, energy sum, capability, and ID references have test-only domain checks. The production host transaction validator remains to be implemented. |
| V1 Analytical / Numerical   | PASS (limited fixtures)   | 13 fixtures plus boundary/continuity tests; analytical, synthetic, and Rapier numerical results are labeled separately.                                 |
| V2 DSP Correctness          | PARTIAL                   | EDC and synthetic decay regression can be rerun; AudioWorklet, fractional delay, filters, HRTF, and click-free crossfade have not been tested.             |
| V3 Independent Solver       | NOT RUN                   | No numerical comparison against pyroomacoustics/an independent wave solver using the same scene yet. Steam Audio initialization cannot substitute for this. |
| V4 Runtime / Performance    | PARTIAL                   | Three math operations, Rapier WASM/fixed stepping, and the Node analytical kernel have run; browser/Worker/GPU/audio deadlines have not yet run.           |
| V5 Perceptual / Measurement | NOT RUN                   | No participant listening tests, calibrated SPL, real RIRs, or measurement-room comparisons have been performed.                                          |

<!-- english-original-anchor --> <a id="fixture-與追溯"></a>
## Fixtures and Traceability

Complete input, units, expected values, referenceClaimIds, tolerance, and reproduction commands are stored in [`analytical.json`](../../../benchmarks/fixtures/analytical.json). Acoustic result tests are in [`analytical.test.mjs`](../../../tests/acoustics/analytical.test.mjs); the kernel is in `scripts/validation`, outside the production product directory.

| Fixture scope                    | Main expectation                                                                                           | Absolute tolerance                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 3-4-5 free-field                 | 5 m, 5/343 s, pressure ratio 0.2 with a 1 m reference                                                       | 1e-12                              |
| Finite first-/second-order images | First-order hit (3,0,0), length √20 m; second-order length 5 m                                              | 1e-10 m                            |
| Finite polygon/occlusion          | Valid plane but rejection outside the polygon; interior blockers rejected on each direct/reflected segment | 1e-9 m geometry epsilon            |
| Material                         | A+R+T=1 per band; reflected pressure magnitude √R for the same medium                                       | 1e-12                              |
| Air dB conversion                | **Synthetic** alpha=0.1 dB/m, 10 m, pressure ratio 0.8912509381                                              | 1e-12                              |
| Doppler                          | Stationary/equal velocity 1; approaching at 10 m/s gives 1030.03003 Hz                                       | 1e-9 Hz                            |
| Shoebox mode                     | 5×4×3 m rigid room (1,0,0) = 34.3 Hz                                                                       | 1e-10 Hz                           |
| arrival/EDC                      | 48 kHz, 3.43/6.86 m = 480/960 samples; reverse sum of squared energy                                         | sample 0; EDC 1e-10 dB              |
| Synthetic EDT/T20/T30             | exponential amplitude; extrapolated RT60 = 0.6 s for all three regressions                                  | 5e-5 s                             |
| path continuity/dynamic update   | Stable IDs for the same surface sequence; a 1 mm source translation changes length by ≤1 mm; an added blocker can cause rejection | 1e-12 m floating-point allowance |

See [PHYSICS_VALIDATION](PHYSICS_VALIDATION.md) for actual WASM smoke tests of zero gravity, fixed bodies, free fall, impulse/force, collision events, and spring joints. Throw audio events, cross-platform replay, complete dynamic geometry broad phase, and audio path birth/death crossfade are only designed; the geometry tests above cannot be treated as delivered interaction features.

<!-- english-original-anchor --> <a id="後續驗證順序"></a>
## Subsequent Validation Order

First compare paths/IR arrival against an independent ISM with identical geometry, sound speed, materials, and order; then test actual fractional delay and a unified direct/early time base. Only afterward use a lawfully obtained small RIR/HRTF subset and calibrated measurements. See [DATASET_CATALOG](../research/datasets/DATASET_CATALOG.md) for dataset selection and license conditions.

When a backend lacks per-path capability, return unsupported; empty arrays, fabricated paths, or inferred statistics cannot serve as numerical comparisons. Every result must pin the scene/material/motion revision, backend version, seed, dt, sample rate, and file SHA-256.

<!-- english-original-anchor --> <a id="最後整合補充"></a>
## Final Integration Addendum

Phase 1 `check`/`validate:all` comprised 11 commands; historical results are preserved in `benchmarks/results/phase1-validation-preserved.json`. After Phase 2 added Wiki/design/source validation, the current count is 16 commands. New aggregate results are saved separately in `benchmarks/results/phase2-validation-local.json`, without rewriting Phase 1 evidence. Core `npm test` remains 30 analytical/contract groups, with an additional 18 data acquisition tool cases (17 PASS/1 junction fixture SKIP due to EPERM/0 FAIL) and 6 Rapier cases run separately. Acquisition tool tests use local mocks only; a dry-run returning BLOCKED/exit2 for the example's UNKNOWN license/null pins is expected and does not mean actual data was acquired. See the [dataset spike](../experiments/dataset-fetch-spike/README.md) for complete limitations and rerun commands.

Skills can be checked separately with `scripts/setup/validate-skills.ps1 -PythonPath <Python executable with pip>`; on the first run, `-InstallDependency` can be added to place pinned PyYAML6.0.3 in the ignored cache and check 8 Skills using the local Codex skill-creator's quick_validate.py. The local run actually used bundled Python, with the official validator reporting 8/8 PASS; this check is outside cross-platform npm CI.
