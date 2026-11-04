<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/reference/SOURCES.md","sha256":"2384083d4a9231285bffe9c62faaf361a15bd97467606d4b34a919116da0ef88","translated_at":"2026-11-02T09:43:10.4623617Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/reference/SOURCES.md`](../../../../15-ui-parameter-audit/acoustic-geometry/reference/SOURCES.md). Source SHA-256: `2384083d4a9231285bffe9c62faaf361a15bd97467606d4b34a919116da0ef88`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="曲面幾何聲學來源與主張界線"></a>
# Curved Geometrical Acoustics: Sources and Claim Boundaries

Checked at: 2026-11-02T07:24:44Z. This document checks only the scientific sources and applicable scope for Task0030; it is not acceptance evidence for code, audio, or a real room. See [SOURCES.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/22a499b577dc5129b1d62c906a4f455b66c8e8b6) for the machine-readable version; see [ACOUSTIC_THEORY](../../../research/theory/ACOUSTIC_THEORY.md) and [PAPER_INDEX](../../../research/papers/PAPER_INDEX.md) for existing background.

<!-- english-original-anchor --> <a id="原始來源與實際讀取範圍"></a>
## Primary Sources and Material Actually Read

| ID | Source, version, and location | Scope supported by this review |
| --- | --- | --- |
| CG-SRC-FERMAT-CALTECH26 | [Caltech, The Feynman Lectures I §26-3, §26-5](https://www.feynmanlectures.caltech.edu/I_26.html), official online chapter; the publication year of the web edition was not separately verified in this review. | Fermat's precise condition is first-order stationarity of travel time, not an unconditional global minimum over every imaginable path. |
| CG-SRC-FANG2014 | [Nick Fang, MIT 2.71/2.710, lecture notes dated 2014-02-10](https://ocw.mit.edu/courses/2-71-optics-spring-2014/d558a4fabb2cc2eee8f864d3928b31f6_MIT2_71S14_lec2_notes.pdf), relevant printed pages 1, 4–6. | Applicable principles for the geometrical-path approximation, Fermat, and planar/curved reflection; not source code or tests for this project's specific algorithm. |
| CG-SRC-LYNCH2012 | [MIT 2.682, Lecture #4–5](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/912f81a910bbd70f22a2be6e25113d09_MIT2_682S12_lec04.pdf), relevant printed pages 3–6; the [course page](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/) lists James Lynch as instructor. The PDF does not separately name an author. | Intensity requires ray-tube spreading/transport information; ray approximations have pathological behavior at caustics and in shadow regions. A single path length cannot establish the full amplitude. |
| CG-SRC-BREMMER1982 | [H. Bremmer, S. W. Lee, Radio Science 17(5), 1117–1131, 1982](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/RS017i005p01117), DOI 10.1029/RS017i005p01117. **Only the official abstract and bibliographic information were read**. | Reflected-wavefront curvature depends on the reflecting surface and incident-wavefront curvature; the abstract discusses divergence coefficients. Full-text equations and numerical values were not checked. |
| CG-SRC-SFU-REFLECTION | [Simon Fraser University, Handbook for Acoustic Ecology: Reflection](https://www.sfu.ca/sonic-studio-webdav/cmns/Handbook5/handbook/Reflection.html), no publication year shown; the entire short page was read. | The acoustic reflection angle law and conditions relating wavelength to surface scale; does not establish the actual response of small objects at low frequencies. |

This repository stores only original summaries and links; it does not store or redistribute third-party PDFs, images, or full texts. The original bytes of remote content were not pinned, so the SHA256 of third-party full texts is null. A check date is not presented as a publication year; public readability does not imply unrestricted redistribution rights.

<!-- english-original-anchor --> <a id="本專案可採用的主張"></a>
## Claims This Project May Adopt

- **CG-REF-001 / Derived + V0 source scope**: In a homogeneous medium, surface-constrained reflection candidates should satisfy first-order stationarity of path length and the reflection law with respect to the local normal. A specific candidate's stationary-path problem may be reduced to the shortest valid reflected path only within an independently proven common visible domain of an exterior convex body; this special case cannot be treated as a general Fermat global-minimum theorem. [Caltech §26-5](https://www.feynmanlectures.caltech.edu/I_26.html) and [MIT 2014](https://ocw.mit.edu/courses/2-71-optics-spring-2014/d558a4fabb2cc2eee8f864d3928b31f6_MIT2_71S14_lec2_notes.pdf) support the principles; the specific sphere/capsule reductions are supported by this project's derivations and V1 fixtures.
- **CG-REF-002 / V0**: Curved paths are a geometrical approximation, not full-wave occlusion/reflection. In particular, this does not support claims of real low-frequency accuracy when the wavelength is comparable to or larger than the object scale. [SFU reflection teaching material](https://www.sfu.ca/sonic-studio-webdav/cmns/Handbook5/handbook/Reflection.html).
- **CG-REF-003 / V0**: Geometrical correctness of reflection position and delay is insufficient to establish amplitude correctness. Amplitude/intensity additionally depends on geometrical spreading/ray-tube transport. [MIT 2012, pp.3–6](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/912f81a910bbd70f22a2be6e25113d09_MIT2_682S12_lec04.pdf).
- **CG-REF-004 / Engineering limitation**: Retaining `1/pathLength × sqrt((1-s)R)` provides a bounded ray-path amplitude approximation that **does not include curvature divergence, focusing, or caustics**. This is the project's assessment of its limitations based on the [MIT transport discussion](https://ocw.mit.edu/courses/2-682-acoustical-oceanography-spring-2012/912f81a910bbd70f22a2be6e25113d09_MIT2_682S12_lec04.pdf) and the [official Bremmer/Lee abstract](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/RS017i005p01117); it does not imply that their coefficients have been implemented.
- **CG-REF-005 / Derived; V1 results listed separately**: Bisection over the common visible arc, capsule side/end-cap candidate decomposition, epsilon, iteration limits, and stable path ID are this project's engineering work. External sources do not directly establish their convergence, capacity, boundaries, or implementation. The mathematical-reference runner should separately list the original inputs, expected values, tolerances, and results.

<!-- english-original-anchor --> <a id="v0v5-與未做項目"></a>
## V0–V5 and Work Not Performed

| Level | Scope of this source review |
| --- | --- |
| V0 Model Contract | Relevant sources and model conditions were checked; product schema/capability tests are attached separately. |
| V1 Analytical / Numerical | NOT RUN in this source review. Assessed separately from independent analytical/numerical fixture receipts; this document does not replace them. |
| V2 DSP Correctness | NOT RUN; no audio graph or OfflineAudioContext validation. |
| V3 Independent Solver | NOT RUN; no same-scene comparison with an external full-wave/acoustic solver. Another in-house numerical optimization method is only a V1 reference. |
| V4 Runtime / Performance | NOT RUN; no formal runtime/performance or device deadline measurements. |
| V5 Perceptual / Measurement | NOT RUN; no human listening tests, calibrated SPL, physical RIR, or real-room measurements. |

No new solid transmission, diffraction, coherent wave interference, or retarded-time/Doppler solution for moving reflectors is claimed. The planar image-source literature P01/P05 cannot directly serve as evidence that curved-surface amplitude has been validated.
