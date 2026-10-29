<!-- english-source: {"path":"research/papers/COLLISION_WAVE_NOTES.md","sha256":"bb3f6567888b9021e2db57e1d2b2e5a6b0868d711b4f899cb478111ad0c4e012","translated_at":"2026-10-27T05:41:35Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/papers/COLLISION_WAVE_NOTES.md`](../../../../research/papers/COLLISION_WAVE_NOTES.md). Source SHA-256: `bb3f6567888b9021e2db57e1d2b2e5a6b0868d711b4f899cb478111ad0c4e012`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="碰撞聲音與波動求解研究筆記"></a>
# Research Notes on Collision Sound and Wave Solvers

Review date: 2026-10-26 (Asia/Taipei). This file contains original research summaries; it does not store full papers, figures, tables, or audio. Online readability does not imply permission to redistribute. `FULL_TEXT_REVIEWED` means the main text was opened and its methods and results sections consulted, not that every equation was reproduced; `PARTIAL_TEXT_REVIEWED` means only searchable portions of the main text were available; `ABSTRACT_ONLY` does not support algorithm details that were not read. No paper code or listening experiments were run here.

<!-- english-original-anchor --> <a id="cw01--foleyautomatic"></a>
## CW01 — FoleyAutomatic

| Field | Review findings |
|---|---|
| Title / Authors / Year | *FoleyAutomatic: Physically-based Sound Effects for Interactive Simulation and Animation*; Kees van den Doel, Paul G. Kry, Dinesh K. Pai; 2001 |
| DOI / Publication Type | [10.1145/383259.383322](https://doi.org/10.1145/383259.383322); SIGGRAPH 2001 peer-reviewed conference paper, 537–544 |
| Access / Evidence | `FULL_TEXT_REVIEWED`; [UBC author-hosted public PDF](https://www.cs.ubc.ca/labs/lci/papers/docs2001/van-foleyautomatic.pdf), §2–5; DOI cross-checked against the [authors' BibTeX](https://www.cs.mcgill.ca/~kry/pubs/foleyautomatic/vandenDoelKryPai01bibtex.htm) |
| Research Problem | How to continuously generate impact, scraping, and rolling sounds from low-update-rate rigid-body contact data. |
| Methodology / Mathematical Model | Contact position determines excitation weights in a bank of damped modal oscillators; microscopic contact forces are also generated at the audio sample rate. Impacts use finite-duration force pulses to represent hardness; scraping uses roughness excitation as contact moves along the surface, with frictional power determining intensity. |
| Data / Experiment | Modal measurements of a physical wok, a stone falling into the wok, a ball rolling over a textured surface, and an interactive bell demonstration; §5.1 explicitly states that sound quality was compared informally. |
| Assumptions / Limitations | Small-amplitude modal superposition; roughness and audio-force are physically inspired approximations. The authors explicitly state that the model is not fully derived from first principles; the rolling model and its perceptual improvement still require further evaluation. |
| Engineering Applicability / Reproducibility | Separate fixed-step dynamics from audio-rate excitation; record position, velocity, average normal force, and impulse. A simplified version can be reimplemented from the equations; redistribution licenses for the original code / measured audio were not confirmed in this review. |
| Reflection Lab | Supports separating continuous friction states from instantaneous impact events; this is P2 modal-sound research, and P0 sample triggering must be labeled as an approximation. |

<!-- english-original-anchor --> <a id="cw02--從可變形運動產生聲音"></a>
## CW02 — Generating Sound from Deformable Motion

| Field | Review findings |
|---|---|
| Title / Authors / Year | *Synthesizing Sounds from Physically Based Motion*; James F. O’Brien, Perry R. Cook, Georg Essl; 2001 |
| DOI / Publication Type | [10.1145/383259.383321](https://doi.org/10.1145/383259.383321); SIGGRAPH 2001 peer-reviewed conference paper, 529–536 |
| Access / Evidence | `FULL_TEXT_REVIEWED`; [author page](https://jamesobrien.com/papers/Obrien-SSF-2001-08/index.html), [author-hosted public PDF](https://jamesobrien.com/papers/Obrien-SSF-2001-08/Obrien-SSF-2001-08.pdf), §3–5. The original Berkeley URL timed out; the existing download link on the author page was used instead. |
| Research Problem | How to connect small vibrations of a solid's surface to sound, rather than merely playing prerecorded samples based on rigid-body displacement. |
| Methodology / Mathematical Model | Nonlinear tetrahedral FEM produces deformation; surface normal velocity is converted to a pressure approximation, then band-limited / downsampled. The local relation is `p ≈ ρ c v_n`; patch contributions with propagation delay, visibility, and directional weights are accumulated at the receiver. |
| Data / Experiment | A falling metal bowl, comparison of an excited bar's spectrum against theoretical modes, and other deformation examples; these are not measurement validation for Reflection Lab. |
| Assumptions / Limitations | Linear air acoustics; the radiation step assumes no reflections and ignores obstacle diffraction, and patch directivity is a rough approximation. High-frequency solid vibration requires time resolution far finer than a typical game physics step. |
| Engineering Applicability / Reproducibility | Equations, mesh / time-step details, and example methods are available for reimplementation; redistributable original code was not confirmed. The patch-radiation formula cannot be treated as a complete FEM/BEM coupled sound field, nor can a rigid-body engine be claimed to directly provide real vibrations. |
| Reflection Lab | Explicitly distinguish `RigidBodyMotion`, `VibrationExcitation`, `Radiation`, and `RoomPropagation`; use as an offline research reference. |

<!-- english-original-anchor --> <a id="cw03--模態與接觸耦合"></a>
## CW03 — Modal and Contact Coupling

| Field | Review findings |
|---|---|
| Title / Authors / Year | *Toward High-Quality Modal Contact Sound*; Changxi Zheng, Doug L. James; 2011 |
| DOI / Publication Type | [10.1145/1964921.1964933](https://doi.org/10.1145/1964921.1964933); ACM TOG 30(4), Article 38, SIGGRAPH 2011 |
| Access / Evidence | `PARTIAL_TEXT_REVIEWED`; searchable main text §1–2 / Fig.3 from the [Cornell author project page](https://www.cs.cornell.edu/projects/Sound/mc/) and [author PDF](https://www.cs.cornell.edu/projects/Sound/mc/ModalContactSound2011.pdf); fetching the full PDF failed because of the 12 MB limit. The DOI was also cross-checked against [Stanford author information](https://profiles.stanford.edu/doug-james). |
| Research Problem | Why directly feeding rigid-body contact impulses into modal filters causes buzzing, discontinuous contact, and missed micro-collisions. |
| Methodology / Mathematical Model | Incorporate modal deformation into frictional contact; modify Staggered Projections using modal-adapted asynchronous integration, impulse redistribution, and contact-dependent damping. Conceptually, rigid-body degrees of freedom and linear modal coordinates solve contact jointly; the complete discrete equations were not verified equation by equation in this review. |
| Data / Experiment | The author page and readable main text show offline cases such as multi-object clatter / micro-collisions and vibration transmission through a table; the complete numerical tables and supplementary videos were not read or viewed. |
| Assumptions / Limitations | Small modal deformation; the target is high-quality offline synthesis. The evidence reviewed here cannot support browser real-time performance or specific accuracy figures. |
| Engineering Applicability / Reproducibility | Supports treating contact chatter as a solver artifact requiring validation; complete reproduction still requires obtaining the full text, implementing a contact solver, and checking licenses for supporting assets. |
| Reflection Lab | P0 requires event deduplication, rest thresholds, and contact states at the sample layer; these are engineering safeguards and must not be represented as reproduction of this paper. |

<!-- english-original-anchor --> <a id="cw04--隱式-fdtd-與-gpu"></a>
## CW04 — Implicit FDTD and GPU

| Field | Review findings |
|---|---|
| Title / Authors / Year | *Revisiting Implicit Finite Difference Schemes for 3-D Room Acoustics Simulations on GPU*; Brian Hamilton, Stefan Bilbao, Craig J. Webb; 2014 |
| DOI / Publication Type | DOI not confirmed in this review; DAFx-14 peer-reviewed conference paper; [official proceedings PDF](https://www.dafx.de/paper-archive/2014/dafx14_brian_hamilton_revisiting_implicit_finit.pdf) |
| Access / Evidence | `FULL_TEXT_REVIEWED`; §2–9 and Appendix, eight pages. |
| Research Problem | Whether more accurate implicit stencils can improve numerical dispersion and the cost of spatial refinement in 3D wave grids. |
| Methodology / Mathematical Model | Constant-speed scalar wave equation; 27-point spatial discretization and implicit time updates, solving a sparse linear system using Jacobi at each step; analysis of dispersion, stability, and residuals. |
| Data / Experiment | Comparison of cubic-room modes against theoretical frequencies, residuals for fixed Jacobi iteration counts, and finite-precision stability; Tesla K20 CUDA timings are also reported. The paper's hardware figures are not extrapolated to modern WebGPU / browsers. |
| Assumptions / Limitations | This version in the paper mainly addresses regular grids and frequency-independent lossy boundaries; stability does not imply low dispersion, and floating-point rounding still requires long-duration testing. |
| Engineering Applicability / Reproducibility | Stencils, boundary matrices, and solver forms are provided, enabling independent reimplementation of a small cubic-room case; CUDA was not compiled and numerical experiments were not rerun in this review. |
| Reflection Lab | Suitable for offline low-frequency cross-validation; insufficient to promise a full-band, dynamic-geometry, real-time wave solver. |

<!-- english-original-anchor --> <a id="cw05--一般阻抗邊界-fvtd"></a>
## CW05 — FVTD with General Impedance Boundaries

| Field | Review findings |
|---|---|
| Title / Authors / Year | *Finite Volume Time Domain Room Acoustics Simulation under General Impedance Boundary Conditions*; Stefan Bilbao, Brian Hamilton, Jonathan Botts, Lauri Savioja; 2016 |
| DOI / Publication Type | [10.1109/TASLP.2015.2500018](https://doi.org/10.1109/TASLP.2015.2500018); IEEE/ACM TASLP 24(1), 161–173. The 2015 in the DOI is not the formal issue year. |
| Access / Evidence | `ABSTRACT_ONLY` plus publication metadata; [official Aalto publication page](https://research.aalto.fi/en/publications/finite-volume-time-domain-room-acoustics-simulation-under-general/); fetching the [Edinburgh accepted manuscript](https://www.pure.ed.ac.uk/ws/portalfiles/portal/22154168/fv_genimp_final_r3.pdf) timed out, and another official entry point returned 403. |
| Research Problem | How to obtain energy-stable time-domain discretization for irregular room geometry and walls with general locally reacting impedance. |
| Methodology / Mathematical Model | FVTD and numerical energy analysis; the regular-grid special case can reduce to FDTD. The full text containing the actual boundary discretization was not obtained in this review, so it cannot be cited as a verified formula. |
| Data / Experiment | The official abstract explicitly lists room simulations and frequency-dependent modal decay cases; grid sizes, errors, and timing figures were not verified. |
| Assumptions / Limitations | Locally reacting impedance; boundary geometry and fitted meshes affect modal decay. The abstract cannot establish that any measured absorption coefficient can be converted without loss into a stable filter boundary. |
| Engineering Applicability / Reproducibility | If a wave solver is introduced in the next stage, the full text must be obtained legally, passivity verified, and modal-decay tests rerun; currently a research direction only. |
| Reflection Lab | A reminder that complex material impedance, band energy coefficients, and numerical filters are different kinds of data. |

<!-- english-original-anchor --> <a id="cw06--加速-bem-房間聲學"></a>
## CW06 — Accelerated BEM Room Acoustics

| Field | Review findings |
|---|---|
| Title / Authors / Year | *Fast multipole accelerated boundary element methods for room acoustics*; Nail A. Gumerov, Ramani Duraiswami; 2021 |
| DOI / Publication Type | arXiv:2103.16073v1; the preprint is cited here, without labeling it as a verified journal version; [full-text HTML](https://arxiv.org/html/2103.16073v1) |
| Access / Evidence | `FULL_TEXT_REVIEWED`; §2–4, particularly the boundary-condition differences in the comparison in §4.1. The arXiv page specifies CC BY-NC-SA 4.0; this project stores only links and summaries. |
| Research Problem | Dense BEM systems for room problems at high wavenumbers and the recurrence stability of fast multipole methods. |
| Methodology / Mathematical Model | Frequency-domain Helmholtz equation, locally reacting complex impedance, direct / indirect boundary integrals, FMM acceleration, and flexible GMRES. |
| Data / Experiment | Shoebox comparison against image sources; L-shaped room, aperture, and baffle examples. §4.1 explains that the two models use different boundary conditions, so their differences cannot all be attributed to BEM discretization error. |
| Assumptions / Limitations | Uniform constant sound speed, linear acoustics, fixed geometry, and locally reacting boundaries; iterative convergence is affected by absorption, geometry, and preconditioner settings. |
| Engineering Applicability / Reproducibility | The scenes and equations are sufficient to design cross-tests; the authors' solver was not obtained / run in this review. Fix the source, boundary model, frequency bands, and time truncation when comparing. |
| Reflection Lab | Suitable as an independent offline wave reference; no claim that it can directly serve as an interactive audio callback backend. |

<!-- english-original-anchor --> <a id="cw07--fem-室內聲學綜述"></a>
## CW07 — Review of FEM Room Acoustics

| Field | Review findings |
|---|---|
| Title / Authors / Year | *A Review of Finite Element Methods for Room Acoustics*; Albert G. Prinn; 2023 |
| DOI / Publication Type | [10.3390/acoustics5020022](https://doi.org/10.3390/acoustics5020022); Acoustics 5(2), 367–395, peer-reviewed review article |
| Access / Evidence | `PARTIAL_TEXT_REVIEWED`; searchable methods passages from the [journal page](https://www.mdpi.com/2624-599X/5/2/22) and [XML full-text entry point](https://www.mdpi.com/2624-599X/5/2/22/xml); direct opening returned 429. |
| Research Problem | FEM methods and uses for complex geometry, wave-dominated frequency ranges, and frequency-dependent complex boundaries. |
| Methodology / Mathematical Model | Reviews frequency-domain Helmholtz FEM, eigenvalue / modal-coordinate methods, and others; it is not a new single solver. `(K − ω²M + boundary terms) p = f` is this project's summary notation, not a verbatim equation from the paper. |
| Data / Experiment | This is a history of methods and a research synthesis; the experiments it cites were not read in full during this review, so a secondary synthesis cannot be treated as independent validation. |
| Assumptions / Limitations | Low-frequency wave problems still require mesh convergence, correct boundaries, and traceable inputs; model complexity does not automatically imply measurement accuracy. |
| Engineering Applicability / Reproducibility | An entry point for selecting low-frequency FEM tools and understanding terminology; read the original validation papers and fix the mesh and solver tolerances before formal adoption. |
| Reflection Lab | P2 / offline reference; P0 does not build a full-band FEM room solver. |

<!-- english-original-anchor --> <a id="跨來源結論與待查"></a>
## Cross-source Conclusions and Open Checks

- `SampleBasedImpact`: select a sample from a contact event, then adjust gain / pitch using empirical rules; this can provide interactive feedback, but does not predict object vibration.
- `ModalImpact`: requires modal frequencies, damping, contact-position weights, and excitation waveforms; a “metal” string or impulse alone is insufficient to determine a real spectrum.
- `CoupledModalContact`: contact and modes affect each other, with greater cost and numerical difficulty than feeding an impulse into a filter. CW03 provides research support; this project has not implemented it.
- `WaveRoomSolver`: solves the air sound field; it differs from FEM that solves solid vibration. Low-frequency numerical references can identify modes / interference missed by geometric acoustics, but the two must first align their boundary conditions.
- Unverified: CW03's complete equations and numerical tables, CW05's full text, CW07's full text, and licenses for each author's code / supporting audiovisual assets. These limits must remain in the evidence ledger; the existence of literature does not justify recording `Technical Spike Verified`.
