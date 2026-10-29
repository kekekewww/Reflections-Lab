<!-- english-source: {"path":"research/theory/ACOUSTIC_THEORY.md","sha256":"26e8c37564eac4ffe827cccabeba4a47a041d55c2f9b3811fdd78e0e373cb1f4","translated_at":"2026-10-27T05:42:40.323531Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/theory/ACOUSTIC_THEORY.md`](../../../../research/theory/ACOUSTIC_THEORY.md). Source SHA-256: `26e8c37564eac4ffe827cccabeba4a47a041d55c2f9b3811fdd78e0e373cb1f4`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學理論與可驗證的模型契約"></a>
# Acoustic Theory and Verifiable Model Contracts

Checked: 2026-10-26. Source identifiers correspond to [PAPER_INDEX](../papers/PAPER_INDEX.md) and `research/EVIDENCE_LEDGER.json`. This document separates original literature content, independent mathematical derivations, and engineering choices. The fixed `c=343 m/s` used in numerical fixtures is a **Synthetic / Computed** parameter, not a claimed measurement of the speed of sound on that day.

<!-- english-original-anchor --> <a id="1-單位振幅與範圍"></a>
## 1. Units, Amplitude, and Scope

Space in m, time in s, frequency in Hz, velocity in m/s, and pressure in Pa; band centers and band edges must be retained. Assume a linear, small-disturbance, homogeneous stationary medium. The pressure factor of the free-field Green function for a 3D point source is `1/(4πr)`, with arrival time `τ=r/c` [P01; ACO-001]. If the input is already defined at reference distance `r_ref`, relative amplitude may use `r_ref/r`; do not apply another `1/(4π)` or duplicate the engine's distance attenuation.

`pressure ∝ 1/r`; in the far field of the same medium, `intensity ∝ pressure² ∝ 1/r²`. At twice the distance, relative pressure is `1/2`; audio amplitude is not multiplied by `1/4`. `r=0` is the point-source singularity and should return invalid or use an explicit finite-source / minimum-distance model; a clamped radius must be recorded and cannot be claimed accurate in the near field.

`dB SPL=20 log10(p_rms/20 µPa)` requires actual pressure calibration; `dBFS` refers only to digital full scale. Until the HRTF, asset level, headphones, and DAC gain are calibrated, panels may display only relative dB / dBFS [DSP-006].

<!-- english-original-anchor --> <a id="2-有限面鏡射路徑必須通過幾何驗證"></a>
## 2. Reflection from Finite Surfaces: Paths Must Pass Geometric Validation

A plane is represented by a unit normal `n` and a point `p0` on the plane. Mirroring:

```text
mirror(s) = s - 2 n dot(n, s-p0)
x(u) = receiver + u (mirror(s)-receiver)
u = dot(n,p0-receiver) / dot(n,mirror(s)-receiver)
```

This is an independent derivation from plane geometry; P01 establishes the shoebox method, P02 is its historical extension to nonrectangular rooms, and the full text of P05 §1 confirms recursive mirroring and visibility requirements. **An intersection with an infinite plane is insufficient to establish a valid reflection from a finite wall** [ACO-002]:

1. Treat a near-zero denominator as parallel / degenerate; do not divide by zero.
2. Require `0<u<1` (handle endpoints separately with a scale-dependent tolerance).
3. The intersection must lie inside the finite polygon; concave polygons require reliable point-in-polygon testing or correct triangulation.
4. Every actual segment must be visible; it must not pass through an occluder, the back of a wall, or a side on which reflection is disallowed.
5. Verify that the angle of incidence equals the angle of reflection, that every segment has positive length, and that total length is no shorter than the direct Euclidean distance.

Second and higher orders: record the surface sequence `(P1,…,Pk)` in source-to-receiver order and mirror across each surface to obtain `s1,…,sk`; from the receiver, follow the direction of `sk` to intersect `Pk`, then from that intersection head toward `s(k-1)` to intersect `P(k-1)`, and continue backtracking to the real source. Check containment and occlusion at each surface, and sum the **actual polyline** length [ACO-003]. Visibility of an arbitrary image point does not establish the correctness of a higher-order path.

Engineering boundaries: the self-intersection tolerance at reflection vertices must be designed for the room scale and exclude a small segment at the surface currently in contact; do not permanently ignore the entire surface, which would miss other occlusions. Double-sided thin sheets, outward normals of closed bodies, holes, overlapping surfaces, and T-junctions must be defined in the acoustic geometry contract. Tests retain polygon IDs, intersections, lengths, angles, and occlusion results for each segment.

<!-- english-original-anchor --> <a id="3-動態場景與成本"></a>
## 3. Dynamic Scenes and Cost

A naive image tree for `M` surfaces and reflection order `K` has approximately `Σ M^k` candidates; practical pruning can reject impossible consecutive reflections and use beam clipping, visibility, and distance / energy thresholds [P05 §1; ACO-004]. A BVH accelerates intersection and occlusion queries but does not eliminate combinatorial growth. Triangle count is not the number of physical reflecting surfaces; coplanar acoustic patches with the same material may be merged, but narrow doors, holes, and material boundaries must be retained. P05's octree reduction applies only to the evaluated models; its reduction ratios cannot be adopted directly as a guarantee for this project.

P03's beam tree reduces searching through spatial partitioning and precomputed reachable regions; P04 proposes priority, bidirectional, and other accelerations for simultaneously moving sources / receivers. The evidence read is insufficient to reconstruct their complete implementations, so the initial version's scope is **static rooms with dynamic Source / Listener**: retain static topology and the BVH, and recompute intersections and visibility for the endpoints; invalidate relevant caches by scene revision when an object moves. Do not claim that moving only the Listener never requires reevaluating reflection visibility.

The initial recommendation is low-order deterministic early paths plus bounded rays or parametric late reverb; maximum order, path budget, energy threshold, and maximum propagation time are all **visible approximation settings**. A reflection absent from sampled rays is not necessarily nonexistent. The finite receiver sphere radius, ray count, PDF / solid-angle normalization, and seed affect bias and variance and must be recorded; receiver connections require separate visibility tests, and energy histograms must not be presented as pressure RIRs with phase. Reflection, transmission, diffraction, and diffuse reflection must each declare backend capabilities; without a diffraction model, low-frequency occlusion cannot be described as a full physical solution.

<!-- english-original-anchor --> <a id="4-path-identity-與音訊連續性"></a>
## 4. Path Identity and Audio Continuity

The following are this project's **engineering proposals**, inspired by geometric paths and time-varying rendering literature, and have not yet passed product DSP / hearing validation [ACO-005; P06 §2, §4, §8]:

- `pathId = sourceId + listenerId + orderedStableSurfaceIds + interactionTypes`. Hit triangle indices, ranks, or coordinates are unsuitable as the sole identity; invalidate explicitly when the geometry revision changes.
- Interpolate gain / filter / delay over time for existing paths in every audio block. Ranking swaps change only budget selection, without renaming physical paths.
- Fade births in from zero gain; retain a short tail on death before fading out. Use hysteresis at thresholds to avoid repeated flickering. Specific fade lengths must be selected through transient, rapid-motion, and many-path tests, without inventing a universally inaudible number of milliseconds.
- Distinguish actual geometric discontinuities (a path crossing a wall edge) from solver undersampling. Smoothing improves clicks but introduces temporal lag and must not rewrite the original scientific paths; retain raw geometric traces and rendered parameters separately.
- Compare crossfading between two renderer outputs or persistent path delay lines; with complete time-varying convolution, merely linearly blending IRs can turn the same event in transit into two events. Select a consistent model for Doppler arising naturally from a varying delay and additional pitch shifting, avoiding double application.

<!-- english-original-anchor --> <a id="5-材質是量測條件與係數定義不是名稱"></a>
## 5. Materials Are Measurement Conditions and Coefficient Definitions, Not Names

For the same band, incidence conditions, passive interface, and consistent energy normalization, use this project's conservation contract:

```text
A + R + T = 1,       0 ≤ A,R,T ≤ 1
R_specular = (1-s) R
R_diffuse  = s R,    0 ≤ s ≤ 1
TL_dB = -10 log10(T)
```

Here `A` is dissipative absorption, `T` is the transmitted energy ratio, and `R` is the total reflected energy ratio; `s` is the fraction **of already reflected energy** that leaves the specular component [MAT-001, independent energy derivation; S04's random-incidence scattering is not equivalent to uniformity of scattering directions]. At `T=0`, TL is positive infinity; do not use an unlabeled finite number to represent complete blocking.

In the same medium and under corresponding angular / energy-flux conditions, `|r_pressure|=sqrt(R)`; `sqrt(1-A)` applies only to nontransmitting surfaces. Transmission amplitude across different media requires impedance and angle factors and cannot simply use `sqrt(T)`. Noncomplex absorption data provide only magnitude and cannot recover reflection phase; negative reflection coefficients, phase rotation, and multilayer interference require a separate complex impedance / transfer model.

For local reaction, a plane boundary, plane waves, and angles measured from the normal, a nontransmitting impedance boundary gives:

```text
r(θ,f) = [Zs(f) cosθ - ρc] / [Zs(f) cosθ + ρc]
A(θ,f) = 1 - |r(θ,f)|²
```

This is an analytical model of the stated ideal boundary, not data obtained automatically from an arbitrary reverberation-room coefficient. Material thickness, the air gap behind it, mounting, surface roughness, moisture content, frequency, and incidence angle affect data applicability; a name such as “wood / concrete” alone cannot determine any measured spectrum.

S02's reverberation-room method and S03's impedance-tube normal-incidence method are different measurement contexts. S03's official page permits estimation of diffuse-incidence conditions only for **locally reacting materials**; do not claim that normal-incidence values are random-incidence values. Apparent reverberation-room coefficients may differ from this project's 0–1 interface allocation because of test definitions / edge effects and other factors; retain raw measurements and uncertainty, and store backend adaptations separately rather than silently clamping values and calling them original measurements.

Every material record retains at least `provenanceKind: Measured|Derived|PerceptuallyTuned|Synthetic`, source, license, version, `centerFrequenciesHz`, edges, coefficientMeaning, incidence, sampleThicknessM, backing, mounting, measurementMethod, and uncertainty. Band conversion must operate in the correct domain, such as energy / complex response; label it Estimated when comparison data are unavailable. Interpolation between sample points must not fabricate measurement precision.

pyroomacoustics explicitly defines `Material.energy_absorption` as energy; the old `absorption` used a different definition and is deprecated [T03–T04; MAT-002]. Map the bands and transmission conventions of Steam Audio and other backends individually against the official API for the corresponding version; this research does not assume that all scattering definitions are synonymous. Material adapters must have conservation and round-trip fixtures.

| Model / backend | Bands and meaning | Conversion limits |
|---|---|---|
| This project's canonical material | Explicitly records arbitrary measured bands, complex impedance, or A/R/T definitions; preserves raw metadata | Derive `sqrt(R)` only when the necessary conditions hold; retain phase UNKNOWN |
| pyroomacoustics 0.10.0 documentation | `energy_absorption` and `scattering` may contain `coeffs` / `center_freqs`; may be resampled internally to octave bands [T03] | Do not transfer old `absorption` values directly; fix internal band settings and do not assume they exactly match external lookup-table centers |
| Steam Audio 4.8.1 precompiled three-band version | 400 Hz, 2.5 kHz, 15 kHz; absorption is the absorbed energy fraction, scattering is the scattered fraction of already reflected energy; transmission is used only for direct occlusion [SDK-07] | These three points are not standard octave bands; the engine's use of transmission does not constitute a general solution for multiple transmissions / energy closure. See the checked header in `docs/03-sdk/STEAM_AUDIO_RESEARCH.md` |

This project has not yet measured the error of any adapter across bands. Log-frequency interpolation of finite energy data may be an explicit `Derived` candidate, but measurements from 125 Hz–4 kHz must not be extrapolated to 15 kHz and labeled `Measured`, nor can three frequency points recover narrow-band resonance.

<!-- english-original-anchor --> <a id="6-空氣聲速與延遲"></a>
## 6. Air, Speed of Sound, and Delay

NASA's small-disturbance ideal-gas derivation gives `c=sqrt(γ R_specific T_K)` [T01; AIR-003]. With fixed gas composition, the equation makes the speed of sound proportional to the square root of absolute temperature; it does not imply a change in sound speed from pressure alone. Humidity changes gas composition and requires an additional model. `T_K=T_C+273.15`; use Pa consistently for pressure and convert to kPa only in an adapter when required externally; explicitly record whether RH is a fraction or percentage.

S01's official scope: atmospheric absorption depends on frequency, temperature, humidity, and pressure, with typical ranges of 50 Hz–10 kHz, −20…50 °C, and RH 10…100%, plus extended calculations. Without obtaining the standard's complete equations and tables, do not claim ISO 9613-1 conformity or publish coefficient tables that appear to have been validated against the standard.

Given a validated or explicitly Synthetic `α_dB_per_m(f)`:

```text
airLossDb = α(f) × pathLengthM
pressureGain = 10^(-airLossDb/20)
energyGain = 10^(-airLossDb/10)
```

This is an algebraic conversion from dB definitions [AIR-001]; do not fold in geometric `1/r`. For the same α, the additional dB loss over 100 m is 100 times that over 1 m: a path-length ratio, not a fixed audible difference. Wall effects and early reflections usually have greater influence over short indoor distances, but air absorption must not be declared universally negligible without calculation; longer paths, high frequencies, and the total length of multiple reflections still accumulate loss.

<!-- english-original-anchor --> <a id="7-retarded-time-與-doppler"></a>
## 7. Retarded Time and Doppler

For stationary air, subsonic motion, and a direct path, emission time `te` and reception time `tr` must satisfy:

```text
tr - te = |receiver(tr) - source(te)| / c
n = [receiver(tr)-source(te)] / distance
fo/fs = dte/dtr = (c - dot(v_receiver(tr),n)) / (c - dot(v_source(te),n))
```

The second equation is obtained by differentiating the first with respect to `tr` and is an **independent derivation in this repository**; its one-dimensional constant-velocity limit agrees with OpenStax §17.7 [T02; AIR-002]. `n` points from the source at emission time to the listener at reception time; when the source moves toward the listener, the denominator decreases and the received frequency rises. Do not merely insert the endpoints' instantaneous relative velocity into an unconditional formula; finite propagation time requires the direction from retarded geometry.

Updating delay using only `|receiver(t)-source(t)|/c` is a quasi-static approximation; do not claim it equals the retarded solution under general acceleration or rapid motion. Linear constant-velocity motion permits analytical root solving; general trajectories may solve for `te` in a bounded history transform buffer, with monotonicity, tolerances, and history-underrun handling required. Multiple reflections and moving reflecting surfaces have their own time-dependent path problems; this project's initial version does not claim to handle the complete Doppler effect of moving mirrors.

<!-- english-original-anchor --> <a id="8-可驗證層級與實作邊界"></a>
## 8. Verifiable Levels and Implementation Boundaries

First perform V1: distance, finite-surface intersections, occlusion, invariance to reflection-normal reversal, reflection order, conservation, retarded constant-velocity roots, Doppler signs, bands, and units. Then perform V2: delay interpolation, gain / filter smoothing, arrival samples, path birth/death, and audio continuity when geometry updates are lost. V3 uses an independent solver and reports differences in normalization / fractional-delay offset / filtering; only V5 can discuss real-room error using legally obtained measurement data.

A complete reproducible record requires source / listener trajectories, scene/material revisions, solver build, geometric tolerances, ray seed, sample rate, speed of sound, band definitions, and IR trimming / filtering / delay compensation. `RIR metric looks plausible` is insufficient to prove individual early reflections correct; conversely, correct low-order arrival times do not establish accurate late decay or low-frequency behavior in a room.
