<!-- english-source: {"path":"src/README.md","sha256":"3c965a1a0c193add46e0435105bda22299b3271cf5be7beca68b6cfbf369a095","translated_at":"2026-10-29T05:28:32Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`src/README.md`](../../../src/README.md). Source SHA-256: `3c965a1a0c193add46e0435105bda22299b3271cf5be7beca68b6cfbf369a095`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab-正式產品原始碼"></a>
# Reflection Lab Production Product Source Code

2026-10-29: This directory now contains the production React / TypeScript / R3F application, Scene / Rapier / interaction, Sound Behavior, custom acoustics, Web Audio, recording/replay and A/B, asset / project persistence, and the product AI host. The server-side Meta adapter is in ../server/. See the [Architecture](../02-architecture/ARCHITECTURE.md), [Gap Analysis](../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md), and [V1 Acceptance](../11-v1/ACCEPTANCE.md) for actual capabilities and limitations.

schemas/ contains serializable contracts; experiments/ and benchmarks/analytic/ are isolated research / validation and do not replace product testing. src/audio/render-contract.ts contains only reserved types for an unimplemented backend; it does not mean offline mix / stems / ADM export exists. The complete V1, performance, physical user input, and device listening tests remain incomplete.
