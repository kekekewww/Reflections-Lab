<!-- english-source: {"path":"docs/RESEARCH_STATUS.md","sha256":"ce772924a9ff10eb4a282e9749f330f7d5317c0b276f15e75c517728a76ddb62","translated_at":"2026-10-27T03:42:42.0027597Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/RESEARCH_STATUS.md`](../RESEARCH_STATUS.md). Source SHA-256: `ce772924a9ff10eb4a282e9749f330f7d5317c0b276f15e75c517728a76ddb62`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="研究狀態"></a>
# Research Status

Date: 2026-10-26. Complete claims and sources are in `research/EVIDENCE_LEDGER.json`; source access and validation status have separate fields, and API documentation is not treated as execution evidence.

| Area | Research completed | Open issues |
| --- | --- | --- |
| Geometric acoustics | Image source, finite polygon, ray/beam, dynamic path identity, hybrid | Low frequency/diffraction/scattering and general meshes are not implemented |
| Materials | A/R/T, scattering, impedance, angle/band/measurement conditions | No universal cross-engine coefficient equivalence and no measured-material library |
| Air/motion | c, ISO9613 sources, air dB, Doppler/retarded time | Limited access to full ISO text/complete reference points; high-speed dynamics not solved |
| DSP/room | RIR/BRIR, HRTF/SOFA, EDC/RT/clarity, FDN/conv/fractional delay | Actual-graph listening tests and consistency with ISO measurements have not been validated |
| Collision/wave | Excitation, modal/sample, rolling/friction, FDTD/FEM/BEM, and room modes | Data-driven/modal cost, data rights, and real-time feasibility require later spikes |
| SDK | 4.8.1 licensing/API/comparison of five approaches/minimal native validation | Dynamic/browser WASM/individual-path capability limitations |
| Physics | Official Rapier/Three APIs, FPS/build/grab states and events | Corner/heavy-object stability and browser integration have not been tested |
| UX | Comparison of 8 products, workspace/flows/components/design system | Some sources are index-only/legacy; no interviews/hands-on tests |
| Meta | Official models/tools/strict/pricing/privacy | Actual account/inference not validated; zero-cost default |
| Rules | Official Meta/CV waiver/dates/rights/judging | Pre-competition code, Codex, commercial SDKs, and submission fields await confirmation |

Research coverage has reached the scope needed for a bootstrap handoff; not all sources may be described as having been read in full. Each work's contribution, methods, formulas, experiments, limitations, and reproducibility are documented in LITERATURE_REVIEW/COLLISION_WAVE_NOTES.
