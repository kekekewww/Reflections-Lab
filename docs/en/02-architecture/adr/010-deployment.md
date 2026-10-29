<!-- english-source: {"path":"docs/02-architecture/adr/010-deployment.md","sha256":"6af7ab1a287d8fdc25a1c5dc3ba476e0c4fdaa491111107978a78070d4c654b9","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/010-deployment.md`](../../../02-architecture/adr/010-deployment.md). Source SHA-256: `6af7ab1a287d8fdc25a1c5dc3ba476e0c4fdaa491111107978a78070d4c654b9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-010deployment-architecture"></a>
# ADR-010: Deployment Architecture

- Status: Accepted for preproduction; not deployed, and no cloud project has been created.
- Context: Judges need easy operation; the Meta API secret must remain server-side; Steam native increases distribution costs.
- Decision: An HTTPS web app + a same-origin AI proxy, with pinned static asset and registry versions. The initial version does not require SharedArrayBuffer; run a capabilities check/user-gesture audio setup on judging machines first.
- Alternatives: Tauri desktop (for a fallback native backend, but the Rust/signing/packaging environment must be added); Unity native (a separate primary approach); local-only (an offline demonstration fallback, with deployment compliance still to be investigated).
- Evidence: [Integration comparison](../../03-sdk/INTEGRATION_COMPARISON.md), [competition rules](../../01-compliance/HACKATHON_RULES.md), [Web Audio](https://www.w3.org/TR/webaudio/).
- Trade-offs: Web is convenient, but audio device/browser differences, CORS/isolation headers, and backend timeouts require testing; native avoids transport but adds installation.
- Risks: Public repo/deployment competition requirements remain unclear; do not treat recommendations as formal requirements. This phase does not create services or accept terms on the user's behalf.
- Reversibility: The static web bundle and backend contracts can be packaged for desktop; do not expose an unauthenticated localhost HTTP control endpoint with arbitrary CORS.
