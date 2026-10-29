<!-- english-source: {"path":"docs/02-architecture/ADR_INDEX.md","sha256":"bec1b55c057a08e83c2ade7c9093ff022c0d317d237a6db2662ac85ea4652e43","translated_at":"2026-10-29T05:29:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/ADR_INDEX.md`](../../02-architecture/ADR_INDEX.md). Source SHA-256: `bec1b55c057a08e83c2ade7c9093ff022c0d317d237a6db2662ac85ea4652e43`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="架構決策索引"></a>
# Architecture Decision Index

Date: 2026-10-29. ADRs are the design authority; actual capabilities are determined by code and reproducible tests. Older preproduction statements retain their historical scope. The production Web application has been implemented and continues through acceptance; the complete V1 remains unfinished. New ADRs on the research branch apply to the original branch only after a safe merge.

| ADR | Primary approach | Fallback |
| --- | --- | --- |
| [001 Rendering](adr/001-rendering.md) | Historical preproduction decision; Rendering portion superseded by ADR-011 | Retain the original rationale and reversible adapter |
| [002 Physics](adr/002-physics.md) | Rapier WASM fixed step | Reduce bodies, controlled trajectory |
| [003 FPS](adr/003-first-person.md) | Pointer Lock + Rapier character controller | Unlocked orbit / keyboard view |
| [004 Grab](adr/004-grab-throw.md) | Bounded impulse / torque servo | Constrained kinematic anchor joint |
| [005 Acoustics](adr/005-acoustic-backend.md) | Web direct / first-order for limited geometry | Native Steam Audio capability adapter |
| [006 Audio](adr/006-audio-backend.md) | Web Audio, progressively introduce worklets | Simplified early bank / native full audio |
| [007 Contracts](adr/007-scene-material.md) | SI / right-handed / versioned JSON | Explicit adapter migration |
| [008 AI](adr/008-ai-integration.md) | Server Meta adapter + validated commands | Explicitly labeled offline fixture; AI demos must not masquerade as live |
| [009 Replay](adr/009-recording.md) | Motion trace + snapshot + manifest | Resimulation on the same machine with a pinned runtime |
| [010 Deployment](adr/010-deployment.md) | HTTPS web + same-origin AI endpoint | Local demonstration + separate native spike |
| [011 Web Core / Rendering](adr/011-web-core-and-rendering.md) | Independent work, React/R3F view + custom Web acoustic core | Steam Audio optional; Web runtime implemented, complete acceptance unfinished |
| [012 Development Harness](adr/012-development-harness.md) | Historical / Optional; role policy superseded by ADR-013 | Retain mutual exclusion / validation / budget and historical evidence |
| [013 Codex Primary](adr/013-codex-primary-development.md) | Codex leads architecture / implementation / independent validation; Muse Code optional | Keep the Meta product Agent separate from development tools |
| [014 Sound Behavior](adr/014-sound-behavior-system.md) | EventRules + orthogonal states + Inspector + unified propagation; runtime implemented, check capabilities per producer separately | Graph/modal are P2; complete V1 unfinished |
| [015 Client-first / Render Contract](adr/015-client-first-and-render-contract.md) | Retain the client main approach, portable types-only RenderJob / RenderBackend, shared 5-second propagation limit | Cloud render / auth / ADM are later work, not presented as implemented |
