<!-- english-source: {"path":"docs/12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md","sha256":"efc3d1546515361902da061f00d27705203e1678828fdf558af742365744d1ae","translated_at":"2026-10-29T05:24:09.178Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md`](../../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md). Source SHA-256: `efc3d1546515361902da061f00d27705203e1678828fdf558af742365744d1ae`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="custom-web-acoustic-core研究實作邊界與最小調整"></a>
# Custom Web Acoustic Core: Research, Implementation Boundaries, and Minimal Adjustment

Access date: 2026-10-29 (Asia/Taipei). The research baseline is the user-specified `c210ca882ca8503b322c28884bf1e9f6e9fe126d`. The five-second contract correction described below was made on the isolated research branch; the overall report binds the final commit and integration tests. The Traditional Chinese source is the canonical research document. This document does not declare the first formal Web version complete.

<!-- english-original-anchor --> <a id="1-判讀方式與結論"></a>
## 1. Interpretation and Findings

The existing pure Web approach is suitable to retain as a traceable interactive geometric acoustic core with explicit budgets. The current sound-path visualization does not require a rewrite as a full-wave solver. The effective capabilities of the production runtime are direct sound, first-order specular reflection from finite convex planar surfaces, and snapshot dynamic occlusion. Higher orders, solid transmission, diffraction, diffuse reflection paths, complex material phase, and a complete room RIR are not implemented. Synthetic late reverb is a separate, explicitly labeled perceptual layer. These capabilities must be declared individually; visible sound paths or spatial sound over headphones do not establish scientific completeness.

The labels mean: **VERIFIED fact** refers to facts observed in code, named tests, or primary sources; **analytical** refers to an analytical derivation under stated assumptions; **engineering approximation** refers to an engineering choice; **PROPOSED** refers to a recommendation that has not been adopted; and **UNVERIFIED** refers to missing evidence. Citing a standard or paper does not mean its experiments have been reproduced or conformance certification obtained. The local claim IDs `CR-ACO-*` apply only to this review and do not pretend to be claims registered in the central Ledger.

The existing sources checked first were [PAPER_INDEX](../research/papers/PAPER_INDEX.md), [EVIDENCE_LEDGER](../../../research/EVIDENCE_LEDGER.json), [acoustic theory](../research/theory/ACOUSTIC_THEORY.md), and [DSP models](../research/theory/DSP_MODELS.md). Existing `ACO-001..005`, `MAT-001`, `AIR-001/003`, and DSP claims already cover most of the basic principles. This round does not create a second measured-material database.

<!-- english-original-anchor --> <a id="2-實際程式與證據地圖"></a>
## 2. Actual Code and Evidence Map

| Scope | Actual source / evidence | Finding supported in this round |
| --- | --- | --- |
| Geometry and solving | `src/acoustics/geometry.ts`, `solver.ts`, `types.ts` | VERIFIED fact: finite, convex, coplanar polygons; visibility of actual line segments; first order; explicit budgets; pressure ratios |
| Scene conversion | `src/app/acoustic-input.ts` | VERIFIED fact: the six box faces have stable object-ID suffixes; non-box shapes are not represented as exact curved surfaces; moving bodies provide only occlusion snapshots; the source-owner box is excluded |
| Worker boundary | `src/app/acoustic-service.ts`, `acoustic-worker.ts` | VERIFIED fact: request/revision/tick identity, source and payload/path limits, timeouts, and rejection of late replies exist; this is not an infinitely scalable solving service |
| Original analytical oracles | `tests/acoustics-runtime/solver.test.ts` | Direct 3-4-5, first-order in-face/out-of-face/occlusion, material, air, stable IDs, budgets/NaN/degenerate geometry, and other cases; this round's correction did not alter their oracles |
| Audio routes | `src/audio/routes.ts`, `engine.ts`, `band-filter.ts` | VERIFIED fact: one delay and one panner per path; distance rolloff=0; band FIR is a bounded approximation; path birth/death fades exist |
| Late | `src/audio/late-reverb.ts` | VERIFIED fact: original deterministic mono synthetic IR, 30ms zero prefix, unit energy, normalize=false, and two banks; it is not a solver-generated room response |
| Native evidence | `tests/audio-runtime/README.md`, `native-audio-bank-verified-20261027.json` | Historical Chromium results passed 25 individual cases; the original Firefox energy FAIL and WebKit API blocker remain; this is neither a rerun in this round nor a human listening test |
| Current limits / performance | `docs/KNOWN_LIMITATIONS.md`, `docs/11-v1/BROWSER_PERFORMANCE.md` | The existing 600-second measurement retains its negative performance findings; pure-function tests cannot replace Worklet/device latency, real-room, or human gates |

The opening text of `docs/02-architecture/AUDIO_RUNTIME.md` and `docs/06-validation/ACOUSTIC_VALIDATION.md` still contains the early statement that no product runtime exists. Read these documents together with current code and hashed results. This is an inconsistency in document tense. The older text must not be treated as proof that no audio graph currently exists, and the inconsistency must not erase earlier results.

<!-- english-original-anchor --> <a id="3-幾何有限-visibility-與多階"></a>
## 3. Geometry, Finite Visibility, and Higher Orders

**CR-ACO-001 / analytical**: In a homogeneous stationary medium, in the far field of a linear point source, path length `L` corresponds to `tau=L/c` and relative pressure `1/L` at a 1m reference distance. The physical Green function term `1/(4*pi*L)` must not be applied again on top of this project's relative source definition. `r=0` is undefined. The runtime rejects coincident endpoints and explicitly clamps near distances with `minimumDistanceM`. This is a finite-source engineering approximation, not a near-field model or SPL calibration. [Allen–Berkley original paper](https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf)

**CR-ACO-002 / VERIFIED fact + analytical**: The planar image `s'=s-2*n*dot(n,s-p0)` still requires intersecting listener→image with the physical finite face, checking that the hit lies inside the face, checking the same/permitted side, and checking occlusion on every segment. The runtime's `segmentIntersection` excludes only a small region at the actual endpoints; it does not permanently ignore the entire reflecting face. An intersection on an infinite plane is not directly listed as a sound path. `EPSILON_M=1e-7` is a fixed engineering tolerance; coincident/coplanar grazing cases are explicitly unsupported.

**CR-ACO-003 / VERIFIED fact (literature) + PROPOSED (extension)**: Higher-order images require recursive reflection and backtracking from the final face, with checks on every finite face and actual segment. The number of candidates grows combinatorially with the number of surfaces and reflection order. A BVH accelerates visibility checks but cannot by itself remove the combinatorial cost of the image tree. Section 1.1 of the original Siltanen et al. paper supports this distinction; the study's geometry-reduction results are not a performance guarantee for this project. [Siltanen et al., 2008](https://users.aalto.fi/~ktlokki/Publs/siltanen_aaua_2008.pdf)

The first follow-up extension should be an isolated second-order shoebox/finite-wall fixture that proves reflection order, every reflection point, angles, length, and occlusion before considering a `maxOrder` API. Merely changing an `order` field or a schema limit cannot establish higher-order support. Coplanar acoustic patches in a complex mesh can be merged, but merging must not cross openings, material boundaries, or stable surface identities. Beam tracing is a possible pruning direction to research. The precomputation conditions in the authors' work cannot be presented directly as a promise for arbitrary moving geometry. [Funkhouser et al., authors' publication page](https://pixl.cs.princeton.edu/gfx/pubs/Funkhouser_1998_ABT/index.php)

<!-- english-original-anchor --> <a id="4-材質頻帶傳輸與大氣"></a>
## 4. Materials, Bands, Transmission, and Atmosphere

**CR-ACO-004 / analytical + VERIFIED fact (code)**: Under the same-medium and consistent-energy conditions, `A+R+T=1`, `Rspec=(1-s)R`, and `Rdiff=sR`; the specular pressure magnitude is `sqrt(Rspec)`. The runtime validates conservation and renders only the specular portion. It explicitly identifies `sR` as unrendered scattered energy rather than renaming it absorption. This does not mean the whole sound field's energy has been reconstructed. `phaseModel=zeroPhaseMagnitudeOnly` also does not provide complex impedance, reflection phase, or low-frequency interference.

At present, `transmissionEnergy` is only part of the material-allocation contract. A direct path through a blocker is removed; no additional solid-transmission path is generated. A nonzero T value cannot be used to claim that sound transmission through walls is implemented. A future thick-wall path must choose and record entry/exit points, thickness, medium/angle, wall-transfer phase, interaction order, two-interface handling, and a double-counting policy. `10^(-TL/10)` derived from wall TL data is an energy ratio; taking its square root as a pressure ratio is valid only under the applicable equal-impedance conditions. If measured absorption includes transmission loss, T must not be deducted again. All Synthetic presets must remain labeled Synthetic.

**CR-ACO-005 / engineering approximation**: The solver's seven default band centers are 125..8000Hz; 1..32 centers can also be declared explicitly. Material bands must align exactly, with no implicit interpolation. The renderer's default 129-tap Hann frequency-sampling FIR is a separate frequency-reconstruction approximation. Errors may be larger for narrow low-frequency bands, and its group delay `64/fs` is not physical propagation time. Material coefficients at band centers should not be treated as precise across an entire octave band, nor should the FIR's inherent phase be treated as measured material phase.

A future data contract should preserve band edges, coefficient meaning, incidence, thickness/back cavity/installation, uncertainty, raw source/version/license, and adapter version, with Measured, Derived, Tuned, and Synthetic values separately traceable. Band merging or resampling must be defined in the correct domain, such as energy or complex response. Silent interpolation must not retain a measured-data claim.

**CR-ACO-006 / VERIFIED fact (code and official scope)**: When `alpha_b` (dB/m) is supplied, pressure loss is `10^(-alpha_b*L/20)`, applied once. Omitting alpha is a zero-loss Synthetic assumption. The dry-air speed of sound `sqrt(1.4*287.05*T_K)` is a Derived ideal-gas model with fixed composition, without humidity, pressure, or composition corrections. The official ISO 9613-1 abstract confirms that the standard's scope includes frequency and meteorological conditions. This round did not obtain the complete standard's formulas and licensed reference tables, so the current implementation cannot be described as ISO-conformant. [Official ISO scope](https://www.iso.org/standard/17426.html)

<!-- english-original-anchor --> <a id="5-穩定-paths-與時間基準"></a>
## 5. Stable Paths and Time Bases

**CR-ACO-007 / VERIFIED fact (code)**: Path identity is `solverVersion|topologyId|sourceId|listenerId|orderedSurfaceIds-or-direct`. It excludes coordinates, rank, request ID, poseTick, and ordinary revisions. This allows the same topological path to reuse its route when endpoints move. A material change does not require renaming the path. Reusing a physical surface ID after deletion could, however, incorrectly continue an old path. Future topology editing therefore needs an identity/generation policy; a numeric geometryRevision alone should not serve as the path ID.

**CR-ACO-008 / engineering approximation**: `L/c` from a source/listener snapshot at the same tick is quasi-static. Accurate moving propagation requires solving retarded time in the emission/arrival relationship. For example, a direct path must satisfy `t_arr-t_emit=|x_l(t_arr)-x_s(t_emit)|/c`. Reflections also involve the time and geometry of each reflection. The current implementation does not solve roots over pose history, so fast motion cannot be described as exact dynamic acoustics.

The audio epoch is `(simEpoch,audioEpoch)`: generator emission is scheduled at `audioEpoch+(t_emit-simEpoch)`, then the path DelayNode applies `absoluteDelayS` once. `relativeDelayS=(L-Ldirect)/c` is only a value relative to direct sound and must not be added again. HRTF uses the direction from the listener toward the preceding path vertex. The panner is positioned at `listenerPosition+arrivalDirection` with distance rolloff disabled. This is compatible with Web Audio's node/distance model. Device output time still differs from AudioContext currentTime. [Fixed Web Audio 2021 REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

Routes improve continuity with an approximately 30ms delay ramp, 20ms gain/direction ramp, and bounded dual FIR banks. These constants are engineering choices. Variable delay produces a frequency shift; adding another pitch shift for the same motion may double-count Doppler. `y(t)=x(t-D(t))` yields a local frequency ratio `1-D'(t)`. This is an analytical relationship, not proof that this project's smoothing produces physically correct Doppler. An abrupt change or teleport can cause substantial resampling during a delay ramp. Continuous motion, path birth/death, and editing teleports should be tested separately. [Julius O. Smith, authorship-based textbook source](https://www.dsprelated.com/freebooks/pasp/Doppler_Simulation.html)

**PROPOSED**: Add hysteresis and separate raw/rendered records for stale frames, packet coalescing, ranking swaps, and visibility boundaries. Hysteresis must not rewrite raw solver truth. The maximum age for retaining valid parameters without a new frame should be observable; old frames cannot remain current indefinitely. Existing Worker identity/runtime stale checks provide a sound basis, but they do not establish that 20Hz updates and perceptual continuity meet the targets under high load.

<!-- english-original-anchor --> <a id="6-rirlatehrtf-與數值穩定性"></a>
## 6. RIR, Late Reverb, HRTF, and Numerical Stability

**CR-ACO-009 / VERIFIED fact (code)**: The solver returns `impulseResponseArtifactId=null`, and RT60/DRR/C50 return null with an insufficient reason. Finite first-order paths containing non-complex pressure magnitudes do not form a complete phase-correct RIR. Reverse integration of squared pressure can produce an EDC, but adequate decay range, noise-floor handling, band filtering, and fit quality are still required before extrapolating EDT/T20/T30. Null must not be replaced with RT60=0.

Future pressure RIRs and energy histograms must be different artifact types. Preserve sample rate, absolute/relative origin, direct inclusion, fractional-delay kernel, group delay, normalization, phase assumptions, band/direction representation, truncation, and solver version. Comparisons with an independent solver must first align the global delay from fractional-delay filtering. The official pyroomacoustics documentation explicitly notes that its fractional-delay filter introduces a global delay. [pyroomacoustics RIR documentation](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html)

**CR-ACO-010 / engineering approximation**: Current late reverb is a synthetic mono response fed by the earliest valid solver route, without additional solved late rays. It improves perception but does not establish room RT, directional diffusion, or diffuse-energy conservation. Applying HRTF before mono convolution also does not constitute direction-resolved late BRIR. If a parametric reverb is adopted later, first fix the model and the time/energy join to avoid overlap and double counting with early reflections. Schissler–Manocha demonstrate another tradeoff using low-rate IRs to drive directional reverb, while explicitly describing detail and fast-dynamics limits. Their performance or listening results cannot be transferred as evidence for this project. [Original paper, Sections 4 / 8](https://arxiv.org/html/1803.00430v1)

If an FDN is selected later, start with a proven lossless/contractive structure and then apply explicit attenuation. Checking only that the feedback matrix's eigenvalue magnitudes are <1 cannot establish stability for arbitrary delay lengths. Schlecht–Habets provide counterexamples to that insufficient condition. LTV updates, filter interpolation, and finite precision still need separate evidence. [Original paper, Sections II–III](https://arxiv.org/html/1606.07729v1)

**UNVERIFIED**: A finite/nonzero native HRTF render sanity check is not evidence of personalized HRTF, front/back or elevation localization, head turning, headphone calibration, or perceptual certification. The internal latency of native browser HRTF/limiter processing has not been directly measured. This research cannot clear the remaining callback-deadline, underrun, real-device latency, or room-measurement requirements.

<!-- english-original-anchor --> <a id="7-本輪真正缺陷與-category-b-最小修正"></a>
## 7. Actual Defect and Category B Minimal Correction in This Round

**CR-ACO-011 / VERIFIED fact (reproduced before the change; regression after correction)**: The baseline solver accepts `maxPropagationSeconds=10`, while route validation and the native DelayNode support only 5s. A Synthetic input with source `[-200,-200,-200]`, listener `[200,200,200]`, `c=100m/s`, and cap10 produces `L=692.8203230275509m` / `tau=6.928203230275509s`, and `validateFrame` throws `INVALID_AUDIO_VALUE`. This is a configuration incompatibility across layers, not evidence of a failure in the default 2s scene.

The minimal correction defines the [shared limit](../../../src/acoustics/limits.ts) as 5s. The solver rejects values above the limit early at the configuration boundary using the existing `INVALID_BUDGET` error, while route allocation/validation reference the same limit. **Category B: narrowing a configuration that the audio renderer could not accept**. It does not silently clamp values, modify the scene schema/geometry/units, or change original tests/references/tolerances. The existing 2s default remains unchanged. With a valid cap, overlong paths still follow the original policy: drop them and mark `budgetExceeded`, without pretending that physical reflections do not exist. Numeric `directDelayS` may still record the geometric direct delay; only admitted `paths` may enter audio.

The new [propagation-limit.test.ts](../../../tests/acoustics-runtime/propagation-limit.test.ts) first demonstrates that `5+1e-9` / 10 did not originally throw. RED was 4PASS / 2FAIL. After the correction, all six cases PASS. The tests also retain acceptance of 0.001 / 5 configurations, renderability of a path at exactly 5s, and explicit degradation for a path longer than 5s. This does not establish higher-order reflections, complete transmission, or new performance capabilities.

<!-- english-original-anchor --> <a id="8-本輪實際命令數值證據與後續-gate"></a>
## 8. Actual Commands, Numerical Evidence, and Follow-up Gates in This Round

The working directory is the isolated research root; Node v22.17.0. Receipts are in [acoustics-propagation](../../../artifacts/architecture-review-20261029/acoustics-propagation). Only commands actually executed by the authoring agent are listed. The overall report adds the final complete check.

| Command | Actual result / scope in this round |
| --- | --- |
| `node --import tsx --test tests/acoustics-runtime/propagation-limit.test.ts` (before the change) | RED: 6 cases, 4PASS / 2FAIL; `red.tap`, expected missing exception |
| Same command (after the change) | GREEN: 6PASS; `green.tap` |
| `node --import tsx --test tests/acoustics-runtime/*.test.ts tests/audio-runtime/*.test.ts` | PASS: 185 tests; `targeted.tap`; control-graph/domain scope, not native rendering |
| `npm run typecheck` | PASS; `typecheck.txt` |
| `npm test` | PASS: 668 tests; `project-tests.tap` |
| `node --import tsx artifacts/architecture-review-20261029/acoustics-propagation/rigid-transform-probe.mjs` | PASS: rigid-coordinate transforms of 100 first-order fixtures; absolute tolerance `1e-10`; `rigid-transform-result.json` |

The 100-case probe starts from source `[1,1,0]`, listener `[5,1,0]`, and a finite floor. Independent expected values are hit `[3,0,0]`, length `sqrt(20)`, delay `sqrt(20)/343`, and final direction `[-2,-1,0]/sqrt(5)`. Each case rotates the whole scene about Z and translates it by `[0,2,-3]`. `R=.64,s=.25,alpha=.1dB/m` are Synthetic; expected pressure is `sqrt(.64*.75)/sqrt(20)*10^(-.1*sqrt(20)/20)`. The probe tests rigid-transform invariance, finite polygons, IDs, and pressure/time semantics. It does not use solver helpers to generate expected values and does not measure real materials.

Recommended evidence to add, in order (all PROPOSED / NOT RUN):

1. Independent analytical second-order scenes; finite small faces, occlusion on both segments, coplanar/grazing cases, scale sweeps, front/back sides, and mirror reciprocity.
2. Frequency-response oracles: DC/Nyquist, low-frequency slopes, per-band and band-edge errors, 48/44.1/96kHz, and cross-engine impulse/sine cases with noninteger delays. Separate propagation, FIR group delay, and native HRTF latency.
3. Dynamic stability: continuous motion of the same path, ranking swaps, repeated occlusion, birth/death, teleport, stale/out-of-order frames, and pause/seek. Measure output PCM peaks, finite values, energy, modulation, and discontinuities; assess perception separately.
4. Independent-solver V3 comparison with fixed identical material, atmosphere, and epsilon definitions. Compare geometry/delay first, then amplitude. Complete RIR metrics require the model's applicability conditions to be met.
5. Long-duration browser/audio delivery at the original workload and thresholds, devices, and V5 real-room/human testing. Preserve all existing FAIL/UNKNOWN results. Neither this small correction nor the 100-case numerical PASS can replace those gates.

<!-- english-original-anchor --> <a id="9-本輪外部來源存取紀錄"></a>
## 9. External Source Access Record for This Round

Every source has an access date of 2026-10-29. No third-party full text is stored or redistributed. “Readable” in this table refers only to relevant sections, not a complete word-by-word review.

| Source | Access and usage boundaries |
| --- | --- |
| [Allen–Berkley 1979](https://jontalle.web.engr.illinois.edu/Public/AllenBerkley79.pdf), DOI 10.1121/1.382599 | Original-text excerpts were searchable; the existing PARTIAL_TEXT status is retained, without upgrading it to full-text review |
| [Siltanen et al. 2008](https://users.aalto.fi/~ktlokki/Publs/siltanen_aaua_2008.pdf), DOI 10.3813/AAA.918049 | The public authors' PDF was readable; this round checked Section 1.1 and methods/limits, without reproducing the ODEON experiments |
| [Funkhouser et al. 1998](https://pixl.cs.princeton.edu/gfx/pubs/Funkhouser_1998_ABT/index.php) | The authors' abstract was readable; direct PDF access returned 403, so details remain PARTIAL, with no claim of reconstructing the full beam implementation |
| [Schissler–Manocha 2018 v1](https://arxiv.org/html/1803.00430v1) | Relevant sections of the original preprint HTML were readable; used only to inform model tradeoffs |
| [Schlecht–Habets 2016 v1](https://arxiv.org/html/1606.07729v1) | Original preprint Sections II–III were readable; supports FDN counterexamples/conditions, not measurements of this project |
| [Web Audio 2021 REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/) | The fixed technical specification was readable; [current 1.1](https://www.w3.org/TR/webaudio-1.1/) is a 2026-09-22 Working Draft, not grounds to expand browser-support promises |
| [ISO 9613-1](https://www.iso.org/standard/17426.html) | Official abstract/status; complete formulas and tables were not obtained, with no redistribution or ISO-conformance claim |
| [pyroomacoustics room](https://pyroomacoustics.readthedocs.io/en/pypi-release/pyroomacoustics.room.html) | Official 0.10.0 documentation was readable; no dependency was added and no independent-solver comparison was run |
| [Smith Doppler textbook](https://www.dsprelated.com/freebooks/pasp/Doppler_Simulation.html) | The author's textbook was readable; the original Stanford URL was a cache miss in this round; the local-delay derivation is separately labeled analytical |
| [Schroeder 1965 author/university PDF](https://labrosa.ee.columbia.edu/~dpwe/papers/Schro65-reverb.pdf) | Direct access timed out in this round; EDC follows the existing Ledger and independent analysis, with no new full-text-review claim |