<!-- english-source: {"path":"docs/02-architecture/adr/005-acoustic-backend.md","sha256":"989cdab0d9ef25cd0c47bfd9843a811bd3f64d8e1679b2f9dc015e65f2d509d9","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/005-acoustic-backend.md`](../../../02-architecture/adr/005-acoustic-backend.md). Source SHA-256: `989cdab0d9ef25cd0c47bfd9843a811bd3f64d8e1679b2f9dc015e65f2d509d9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-005acoustic-simulation-backend"></a>
# ADR-005: Acoustic Simulation Backend

- Status: Accepted for preproduction; the production solver is not implemented.
- Context: The Demo requires both selectable reflection paths and easy deployment; SDK reflections do not imply a per-path API.
- Decision: A Web worker finite-polygon image-source solver for direct/first-order paths is the primary approach; second order is P2. Sound rays must be generated from valid paths. Steam Audio C API is a native adapter candidate, returning direct/IR according to actual capabilities without synthesizing a nonexistent path list.
- Alternatives: All-Steam native (mature sound-field processing, but packaging/audio transport costs); Unity (existing integration, but requires restarting the product); WASM Steam (the 4.8.1 SDK does contain a static archive, but browser linking/runtime remain unverified); a fallback restricted to first-order static geometry, with late sound handled by a labeled approximation.
- Evidence: [SDK comparison](../../03-sdk/INTEGRATION_COMPARISON.md), [scientific index](../../research/papers/PAPER_INDEX.md), [Steam C API](https://valvesoftware.github.io/steam-audio/doc/capi/index.html).
- Trade-offs: Web geometry is inspectable, but low-frequency wave behavior, diffraction, diffuse reflections, and accuracy in real rooms are limited; native IR and Web path A/B are not guaranteed to use the same model.
- Risks: CPU overload, finite polygon visibility, path identity/crossfade, and SDK native deployment. Display capability and solver ID separately.
- Reversibility: Share Scene/Material and AcousticFrame; backend adapters perform explicit conversions and prevent SDK types from entering UI.
