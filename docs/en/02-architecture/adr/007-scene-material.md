<!-- english-source: {"path":"docs/02-architecture/adr/007-scene-material.md","sha256":"a80bab8fa86ec093bd19a4f7e309c51b109690874f5df0ee12b670bdf70c7793","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/007-scene-material.md`](../../../02-architecture/adr/007-scene-material.md). Source SHA-256: `a80bab8fa86ec093bd19a4f7e309c51b109690874f5df0ee12b670bdf70c7793`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-007scene--material-data-contracts"></a>
# ADR-007: Scene / Material Data Contracts

- Status: Accepted for preproduction; schema does not replace domain validation.
- Context: Physics, acoustics, AI, and the recorder must agree on units, IDs, and band coefficients.
- Decision: Versioned JSON Schema, SI, right-handed +Y/-Z, quaternion xyzw; separate Scene revision from geometry revision. Materials record evidence class, source, frequency bands, and mounting conditions; the validator checks A/R/T energy conservation.
- Alternatives: Directly serializing Three/Rapier/Steam objects (coupled and hard to migrate); untyped AI JSON (unreliable); explicit migration adapters as the fallback.
- Evidence: [DATA_CONTRACTS.md](../DATA_CONTRACTS.md), [material theory](../../research/theory/ACOUSTIC_THEORY.md).
- Trade-offs: Schema alone cannot validate registry refs, mass tensors, mesh manifoldness, or energy sums; a second stage of domain checks is required.
- Risks: Counting absorption and transmission losses twice, presenting band interpolation as measured, and mesh normals with negative scale. Reject measurement labels without sources.
- Reversibility: Migrations preserve the original hash/version; silent reinterpretation is prohibited.
