<!-- english-source: {"path":"docs/02-architecture/adr/001-rendering.md","sha256":"66f61d80f7a8d03e5b8a68aad5feefac7d5b50785e9d52eb2f3d6b84e9e15340","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/001-rendering.md`](../../../02-architecture/adr/001-rendering.md). Source SHA-256: `66f61d80f7a8d03e5b8a68aad5feefac7d5b50785e9d52eb2f3d6b84e9e15340`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-0013d-rendering-framework"></a>
# ADR-001: 3D Rendering Framework

> Historical decision: The initial choice to use Three directly instead of R3F has been superseded by [ADR-011](011-web-core-and-rendering.md) in response to new requirements; the original reasoning is retained below. The R3F direction is not claimed to have been installed or validated.

- Status: Accepted for preproduction, 2026-10-26.
- Context: An empty project; the ten-day Demo prioritizes direct physical manipulation, path selection, and a measurable runtime.
- Decision: TypeScript + Three.js; React handles UI, while physics poses update in the Three runtime without passing each step back through React state. The lockfile is authoritative for the Three version validated in isolation; the exact React version will be pinned when the first task integrates it.
- Alternatives: R3F (declarative composition makes UI integration easier, but adds a lifecycle layer); Unity (a mature editor, but web/native packaging has different costs from the existing web judging workflow); pure DOM (does not meet requirements).
- Evidence: [Official Three API](https://threejs.org/docs/), [official R3F introduction](https://r3f.docs.pmnd.rs/getting-started/introduction); R3F has not been measured, so it cannot be claimed to be inherently slower.
- Trade-offs: Resource disposal, selection, and scene mapping are managed directly, reducing runtime abstractions but requiring custom editor interactions.
- Risks: React state and runtime divergence; synchronize explicitly through commands and revisions.
- Reversibility: SceneSpec/backend contracts are independent of the renderer, so the view adapter can be replaced with R3F; do not serialize Three Object3D into files.
