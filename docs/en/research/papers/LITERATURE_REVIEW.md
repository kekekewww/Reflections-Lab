<!-- english-source: {"path":"research/papers/LITERATURE_REVIEW.md","sha256":"ef2240f2f62b26f2c911b850db06fca545a4facda2bcda2de6fa28140244a6b2","translated_at":"2026-10-27T05:41:35Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/papers/LITERATURE_REVIEW.md`](../../../../research/papers/LITERATURE_REVIEW.md). Source SHA-256: `ef2240f2f62b26f2c911b850db06fca545a4facda2bcda2de6fa28140244a6b2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="科學文獻評估與工程結論"></a>
# Scientific Literature Assessment and Engineering Conclusions

Reviewed: 2026-10-26. Full bibliographic details / access levels appear in [PAPER_INDEX](PAPER_INDEX.md). This file is an original methodological assessment; equations, numerical values, and experimental settings unavailable in the original text are explicitly marked as unverified, and abstracts are not expanded into claims of full-text review. The paper-by-paper 13-field analysis of collision and wave sources in [COLLISION_WAVE_NOTES](COLLISION_WAVE_NOTES.md) is an essential part of this review.

<!-- english-original-anchor --> <a id="幾何聲學與動態路徑"></a>
## Geometric Acoustics and Dynamic Paths

<!-- english-original-anchor --> <a id="p01--allen--berkley1979"></a>
### P01 — Allen & Berkley, 1979

**Problem / method / model**: Build a point-to-point time-domain RIR in a rectangular enclosure using image expansion; each image supplies distance attenuation and arrival delay, with audio rendered through convolution. **Data / experiment**: Searchable main text includes a FORTRAN implementation and a comparison of modal / image methods, but not all examples were read in full during this review. **Assumptions / limitations**: Rectangular rooms and point sources; this does not establish accuracy for arbitrary wall impedance or low frequencies. **Engineering / reproduction / this project**: Suitable as a shoebox analytical oracle; fix c, reflection order, and gain convention, and compare each arrival; the original code was not run. **Evidence**: PARTIAL_TEXT; a direct request for the author PDF returned 403. [Original source](https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf)

<!-- english-original-anchor --> <a id="p02--borish1984"></a>
### P02 — Borish, 1984

**Problem / contribution**: Extend the image model to arbitrary polyhedra. **Method / mathematics / data**: Only bibliographic details were verified in this review; insufficient main text was obtained, so there is no claim of reading the visibility procedure equation by equation or reviewing experimental results. **Assumptions / limitations**: Arbitrary shape does not imply inclusion of diffraction, scattering, or moving walls; finite surfaces still require independent geometric validation. **Engineering / reproduction / this project**: Retain this historical entry point; reflection, within-face checks, occlusion, and second-order backtracking are cross-supported by P05's full text plus this project's geometric derivations, and cannot be warranted by this paper's title alone. **Evidence**: METADATA_ONLY; the full text remains to be obtained legally. [DOI](https://doi.org/10.1121/1.390983)

<!-- english-original-anchor --> <a id="p03--funkhouser-et-al1998"></a>
### P03 — Funkhouser et al., 1998

**Problem / method**: The cost of multiple-reflection paths in interactive VR; prepartition space into convex cells and represent reachable sequences using a cell adjacency graph / pyramidal beam tree. **Mathematics / data**: Clipping of geometrically reachable regions; the readable abstract describes reflection / transmission structures, while full-text experimental tables were not verified. **Assumptions / limitations**: Geometry preprocessing and spatial partitioning have costs; early hardware results cannot establish latency on this machine. **Engineering / reproduction / this project**: Supports separating static-geometry acceleration from endpoint updates; implement a bounded first-order path oracle first, then evaluate a beam tree. The authors' code was not rerun. **Evidence**: PARTIAL_TEXT. [Original ACM page](https://doi.org/10.1145/280814.280818)

<!-- english-original-anchor --> <a id="p04--funkhouser-min--carlbom1999"></a>
### P04 — Funkhouser, Min & Carlbom, 1999

**Problem / method**: Sources and receivers move simultaneously; exploit constraints on avatar positions and accelerate using priority-driven, bidirectional, and other beam-tracing methods. **Mathematics / data**: The author abstract describes cell-graph best-first search and early-reflection termination; detailed equations / experimental tables were not verified. **Assumptions / limitations**: The scene's avatar use case does not imply arbitrary deformable geometry. **Engineering / reproduction / this project**: Listener importance, distance, and energy can be investigated as constraints on the path budget; thresholds and missed paths must be observable, and ranking swaps must not reset path identity. This identity proposal is this project's design, with no claim that it is the authors' approach. **Evidence**: ABSTRACT_ONLY; not reproduced. [Author page](https://pixl.cs.princeton.edu/gfx/pubs/Funkhouser_1999_RAM/index.php)

<!-- english-original-anchor --> <a id="p05--siltanen-et-al2008"></a>
### P05 — Siltanen et al., 2008

**Problem / method / model**: Visual models are too dense; reduce acoustic geometry using octree volume reconstruction and coplanar merging, paying attention to volume and absorption area. **Data / experiment**: Compare room metrics for original / reduced models in ODEON; limitations in the main text include damaged surface orientations and severed narrow passages. **Assumptions / limitations**: Static geometry and a limited set of evaluation cases; similar overall metrics cannot guarantee every early path. **Engineering / reproduction / this project**: Separate the visual mesh from the acoustic mesh and retain portals / material boundaries; reduction ratios are not performance promises for this project. The method can be reimplemented, but the authors' scenes / solver were not obtained and run. **Evidence**: FULL_TEXT_REVIEWED, §1–4. [Author-hosted full text](https://users.aalto.fi/~ktlokki/Publs/siltanen_aaua_2008.pdf)

<!-- english-original-anchor --> <a id="p06--schissler--manocha2018"></a>
### P06 — Schissler & Manocha, 2018

**Problem / method / model**: The cost of full convolution for multiple dynamic sources; estimate RT / DRR from ray-derived low-time-resolution IRs, then drive spherical-harmonic reverb, with delay taps for early paths. **Data / experiment**: Desktop / mobile scenes, timings, and subjective comparisons; not rerun by this project. **Assumptions / limitations**: Artificial reverberation cannot retain all IR details; geometric low-frequency error, SH directional resolution, and dynamic-response delay caused by smoothing remain limitations. **Engineering / reproduction / this project**: Supports a layered representation of early geometry plus parameterized late reverb; an energy histogram cannot be treated as a pressure RIR. Reproduction requires the same scenes, ray settings, HRTF, and hardware. **Evidence**: FULL_TEXT_REVIEWED, §3–4 and §7–10. [Preprint full text](https://arxiv.org/pdf/1803.00430)

<!-- english-original-anchor --> <a id="房間聲學與-dsp"></a>
## Room Acoustics and DSP

<!-- english-original-anchor --> <a id="p07--schroeder1962"></a>
### P07 — Schroeder, 1962

**Problem / method / model**: Simple feedback delays readily cause coloration / insufficient echo density; comb and cascaded all-pass structures, with analysis of `H=(z^-m−g)/(1−g z^-m)` and decay relationships involving delay / loop gain. **Data / experiment**: Electronic reverberation design and listening observations, rather than comprehensive calibration data for real rooms. **Assumptions / limitations**: Stable, fixed-coefficient structures; “natural” does not imply geometric path accuracy. **Engineering / reproduction / this project**: Can provide an inexpensive late-reverb fallback, verified using impulses / spectra; this review only analyzed it and did not implement the reverberator. **Evidence**: FULL_TEXT_REVIEWED, equations 1–15 and the echo-density discussion. [Public full text](https://hajim.rochester.edu/ece/sites/zduan/teaching/ece472/reading/Schroeder_1962.pdf)

<!-- english-original-anchor --> <a id="p08--schroeder1965"></a>
### P08 — Schroeder, 1965

**Problem / method / model**: Noise decay fluctuates between trials; integrating the squared impulse response yields ensemble-average decay and allows observation of non-single-exponential decay. **Data / experiment**: Readable main text includes the white-noise assumption and measurement motivation; the complete experimental procedure was not verified in this review. **Assumptions / limitations**: Linear, stable room response; finite IRs, noise floors, and truncation contaminate the integral. **Engineering / reproduction / this project**: Validate the metric algorithm using a synthetic exponential, then move to measured RIRs; a correct EDC does not imply a correct room solver. **Evidence**: PARTIAL_TEXT; the original PDF timed out; this project's discrete EDC equation and fitting contract are explicitly documented in DSP_MODELS. [DOI](https://doi.org/10.1121/1.1909343)

<!-- english-original-anchor --> <a id="p09--jot--chaigne1991"></a>
### P09 — Jot & Chaigne, 1991

**Problem / method**: Separate reverberator structure from frequency-decay control; the abstract supports a unitary feedback delay network and frequency-response compensation. **Mathematics / data**: Detailed damping design and experiments were not obtained and must not be filled in as verified original equations. **Assumptions / limitations**: Reading the abstract cannot establish stability for arbitrary filter interpolation. **Engineering / reproduction / this project**: A historical basis for FDNs; current equations and stability constraints are instead supported by P10's full text. Reproduction requires legally obtaining the complete paper or using an independent licensed implementation. **Evidence**: ABSTRACT_ONLY; AES requires a subscription, and the restriction was not bypassed. [Original AES page](https://aes2.org/publications/elibrary-page/?id=5663)

<!-- english-original-anchor --> <a id="p10--schlecht--habets2016-預印本"></a>
### P10 — Schlecht & Habets, 2016 preprint

**Problem / method / model**: Fully characterize feedback matrices that remain lossless for different delay lengths; prove the conditions through the FDN characteristic polynomial and present counterexamples showing that eigenvalue-only checks are insufficient. **Data / experiment**: Mathematical proofs and small-matrix counterexamples, not room measurements. **Assumptions / limitations**: Discrete, fixed linear systems; a lossless pole condition does not guarantee stability under time-varying parameters. **Engineering / reproduction / this project**: Start with a checkable prototype using an orthogonal matrix and passive damping; the system including all delays still requires long-tail tests. The counterexamples can be recalculated independently, but this has not yet been done in this review. **Evidence**: FULL_TEXT_REVIEWED, §II–III. [Full text](https://arxiv.org/pdf/1606.07729)

<!-- english-original-anchor --> <a id="p11--laakso-et-al1996"></a>
### P11 — Laakso et al., 1996

**Problem / contribution**: An entry point to FIR / all-pass designs for fractional sample delays. **Method / mathematics / data**: Only Aalto / IEEE bibliographic details were verified in this review; full-text figures, tables, and performance numbers were not verified. **Assumptions / limitations**: Band-limited interpolation is not an unconditionally perfect delay; validation conclusions for fixed and time-varying filters cannot be interchanged. **Engineering / reproduction / this project**: This project's linear-interpolation transfer function is directly derived and tested; consult the full text or official teaching materials before upgrading to windowed-sinc / all-pass, and do not declare high-frequency error acceptable merely because the paper exists. **Evidence**: METADATA_ONLY. [Author institution page](https://research.aalto.fi/en/publications/splitting-the-unit-delay-tools-for-fractional-delay-filter-design/)

<!-- english-original-anchor --> <a id="正式量測標準與介質"></a>
## Formal Measurement Standards and Media

Only the official public scopes of these five ISO standards were read; paid full text is not stored. They are formal technical sources, but this project does not claim to have completed measurements to the standards, implemented their full equations, or obtained compliance certification.

<!-- english-original-anchor --> <a id="s01--iso-9613-11993"></a>
### S01 — ISO 9613-1:1993

**Problem / method**: Calculate atmospheric absorption under meteorological conditions, using frequency, temperature, RH, and pressure as inputs. **Mathematics / data**: The public scope was verified; complete equations / coefficient tables were not obtained. **Assumptions / limitations**: It is not a complete propagation model for every indoor near-field case and does not include all reflections or geometric attenuation. **Engineering / reproduction / this project**: The air-loss module separates c from absorption; only the `α d → 10^(-αd/20)` conversion and units are verified, with numerical ISO coefficients deferred until a legal, complete reference is available. **Evidence**: ABSTRACT_ONLY. [Official page](https://www.iso.org/standard/17426.html)

<!-- english-original-anchor --> <a id="s02--iso-3542003"></a>
### S02 — ISO 354:2003

**Problem / method / data**: Measure material sound absorption or the equivalent absorption area of objects in a reverberation room; the official scope explicitly excludes weakly damped resonators. **Mathematics**: The complete procedure and uncertainty equations were not read, and no reproduction is claimed. **Assumptions / limitations**: Mounting and test-field conditions are part of the result and cannot be directly interchanged with normal-incidence figures. **Engineering / this project**: Store mounting, thickness, frequency bands, and method; do not generate Measured coefficients from a “wood” name. **Reproduction**: Suitable measurement equipment and a licensed standard are required; not done in this review. [Official page](https://www.iso.org/standard/34545.html)

<!-- english-original-anchor --> <a id="s03--iso-10534-220232025-corrected"></a>
### S03 — ISO 10534-2:2023, 2025 corrected

**Problem / method / data**: Use the two-microphone impedance-tube technique to obtain normal-incidence absorption and surface impedance. **Mathematics**: The complete transfer-function / calibration procedure was not read. **Assumptions / limitations**: The official scope explicitly states that diffuse-incidence estimates from this method require locally reacting materials; it differs conditionally from the reverberation-room method. **Engineering / this project**: Import records must retain normal incidence, complex impedance, and backing; the old 1998 edition must not be mislabeled as the latest. **Reproduction**: No measurement was performed in this review; the complete standard and equipment calibration remain to be obtained. [Official page](https://www.iso.org/standard/81294.html)

<!-- english-original-anchor --> <a id="s04--iso-17497-12004amd-12014"></a>
### S04 — ISO 17497-1:2004, Amd 1:2014

**Problem / method / data**: Measure random-incidence scattering of rough surfaces in a reverberation room, expressing the degree of departure from specular reflection. **Mathematics**: The complete test equations were not read. **Assumptions / limitations**: The official scope specifically states that it does not assess spatial uniformity of scattering; scattering cannot be directly treated as diffusion uniformity. **Engineering / this project**: The data schema separates `scatteredFraction` from the scattering direction distribution; cross-engine comparisons require checking definitions. **Reproduction**: No room / scale-model tests were performed in this review. [Official page](https://www.iso.org/standard/31397.html)

<!-- english-original-anchor --> <a id="s05--iso-3382-12009"></a>
### S05 — ISO 3382-1:2009

**Problem / method / data**: Measure / report RT and other RIR room parameters for performance spaces. **Mathematics**: The public abstract does not include complete analysis requirements; this project's metric definitions are an explicit contract and are not yet an ISO-compliant reproduction. **Assumptions / limitations**: Equipment, coverage, data evaluation, and reporting are all part of measurement; a single attractive RT value is insufficient. **Engineering / this project**: Store frequency bands, time zero, noise handling, and fitting range; return insufficient data when dynamic range is inadequate. **Reproduction**: Synthetic metrics can be tested first; real standards-based measurement additionally requires complete references and equipment. [Official page](https://www.iso.org/standard/40979.html)

<!-- english-original-anchor --> <a id="t01--nasa-glenn2021-更新"></a>
### T01 — NASA Glenn, updated 2021

**Problem / method / model**: Derive `c²=γRT` from mass, momentum, isentropic, and ideal-gas relations. **Data / experiment**: Theoretical teaching material, with no humid-air measurement data for this project. **Assumptions / limitations**: Small perturbations in an ideal gas of fixed composition; humidity / composition also affect parameters. **Engineering / reproduction / this project**: Enforce Kelvin and specific-gas-constant units; separate fixed-c tests from the environmental model, avoiding treating 343 as a universal measured truth. **Evidence**: OFFICIAL_DOCUMENTATION; the complete short page. [NASA](https://www.grc.nasa.gov/www/k-12/BGP/snddrv.html)

<!-- english-original-anchor --> <a id="t02--openstax-university-physics-1772016"></a>
### T02 — OpenStax University Physics §17.7, 2016

**Problem / method / model**: Derive moving-source / observer Doppler from wave-crest emission / reception times, with a stationary medium and a subsonic source. **Data / experiment**: Analytical textbook examples, not Reflection Lab measurements. **Assumptions / limitations**: Simplified one-dimensional radial motion; general accelerating trajectories require retarded-time geometry. **Engineering / reproduction / this project**: Test positive and negative directions with analytical constant-velocity examples using explicit signs; this project's vector equation is derived independently by differentiating the retarded equation. **Evidence**: FULL_TEXT_REVIEWED. [Original textbook](https://openstax.org/books/university-physics-volume-1/pages/17-7-the-doppler-effect)

<!-- english-original-anchor --> <a id="t03t04--pyroomacoustics-0100-官方文件"></a>
### T03–T04 — Official pyroomacoustics 0.10.0 Documentation

**Problem / method / model**: Provides programmable shoebox / general-room ISM and an experimental ray hybrid, band materials, and RIRs. **Data / experiment**: Documentation examples can be reproduced, but have not yet been run or yielded this project's V3 figures. **Assumptions / limitations**: The official warning explicitly distinguishes old `absorption` from current energy absorption; the hybrid remains experimental, and RIRs have a fractional-delay offset and default filtering. **Engineering / this project**: Suitable as an independent reference, not a sole ground truth; disable / report randomization, filtering, and offset, and fix the version and seeds. **Reproduction**: Obtain it through the catalog and record the version and parameters; data generated by one's own simulator must not be called measured. [Parameters](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.parameters.html), [Room](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html)

<!-- english-original-anchor --> <a id="綜合判斷與研究邊界"></a>
## Overall Assessment and Research Boundaries

Prioritize validation of static geometry, dynamic Source / Listener, bounded first-order reflections, explicit material energy definitions, and continuously playing audio. Late reverb, low-frequency waves, and real modal impact are layered capabilities; they cannot be combined into a single “physical sound effects” switch. Correct geometric paths, correct DSP, agreement with an independent solver, real measurements, and listening acceptability are different evidence levels.

The public full texts already provide a sufficient methodological foundation for early analytical benchmarks; gaps remain in restricted full-text literature, complete numerical ISO procedures, licenses for individual measurement datasets, and actual V3–V5 results. All engine performance, perceptual quality, band-conversion errors, and dynamic crossfade times still require measurement; figures cannot be inherited directly from older literature.
