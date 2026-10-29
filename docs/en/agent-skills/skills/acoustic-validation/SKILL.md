<!-- english-source: {"path":".agents/skills/acoustic-validation/SKILL.md","sha256":"867e0ba93c369165f7e735b7222d27d07c76158f8c6ee9003fb7adfa127a43f4","translated_at":"2026-10-27T03:37:45Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: acoustic-validation
description: Validate Reflection Lab geometric acoustics, band energy, propagation, RIR, and numerical benchmarks; use for formula and solver changes.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/acoustic-validation/SKILL.md`](../../../../../.agents/skills/acoustic-validation/SKILL.md). Source SHA-256: `867e0ba93c369165f7e735b7222d27d07c76158f8c6ee9003fb7adfa127a43f4`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學驗證"></a>
# Acoustic Validation

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

When modifying a solver, formula, or analysis metric, establish an analytical or independent comparison with a reference and tolerance.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

Model version, units, fixture, Claim ID, expected result, tolerance, and the V0–V5 level to be claimed.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read docs/06-validation and the relevant theory; confirm amplitude/energy/dB and absolute/relative delay.
2. Validate direct paths, finite polygon reflections, bounds/visibility, and energy conservation against independent analytical answers.
3. Record Input, Units, Expected, Reference, Tolerance, and Reproduction for every fixture.
4. Validate NaN, out-of-bounds cases, degenerate geometry, stale geometry, and path birth/death; do not test only the happy path.
5. For RT metrics, check the RIR decay interval and noise floor first. Return insufficient when data is inadequate; do not fill in a fabricated RT60.
6. Run the relevant tests and measured benchmarks; record hardware, versions, sample count, and results. Keep target and measured separate.

<!-- english-original-anchor --> <a id="references"></a>
## References

`docs/06-validation/ACOUSTIC_VALIDATION.md`, `BENCHMARK_PLAN.md`, `benchmarks/fixtures/`, `research/theory/`.

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Reproducible fixtures, machine-readable results, validation levels, errors, and untested scope.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

`npm test`, `npm run benchmark`, `npm run validate:research`. A mathematics kernel PASS does not mean the audio graph or a real room has passed.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Retain failing inputs and original errors; do not merely widen tolerance. When a model is inapplicable, record its limitations and select a simpler model; explicitly mark unexecuted V3/V5 as NOT RUN.
