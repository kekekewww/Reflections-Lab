<!-- english-source: {"path":"research/theory/DSP_MODELS.md","sha256":"62ac47d03e382717bff2451cb715ea2a526eee9116f9be25b80afb9f27200390","translated_at":"2026-10-27T05:44:44.235642Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/theory/DSP_MODELS.md`](../../../../research/theory/DSP_MODELS.md). Source SHA-256: `62ac47d03e382717bff2451cb715ea2a526eee9116f9be25b80afb9f27200390`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學參數至音訊處理模型"></a>
# Models from Acoustic Parameters to Audio Processing

Checked: 2026-10-26. This is a preliminary design and mathematical specification; there are no formal AudioWorklet, native mixer, or passing hearing-validation results. See [PAPER_INDEX](../papers/PAPER_INDEX.md) for source identifiers.

<!-- english-original-anchor --> <a id="1-rirbrirhrtf-的角色"></a>
## 1. Roles of RIR, BRIR, and HRTF

An LTI scene can be written as `y[n]=Σ h[k]x[n-k]`. An RIR is the room response from a source to a receiving point; a BRIR is the two-ear response, already including room and head-direction effects; an HRIR is the time-domain representation of an HRTF. Do not apply an HRTF again to a BRIR that already includes the head without first checking its contents. SOFA is an exchange format for data and coordinate metadata; it does not imply that the data are free, personalized, anechoic, or meet a particular frequency resolution. Check each dataset individually. [P06 §2–4; see DATASET_CATALOG for individual dataset sources]

Early specular paths are represented by `pathId, delaySeconds, arrivalDirection, departureDirection, bandResponse, provenance`; late reverberation may use decay / direction / energy parameters or a complete IR. A backend without path export can provide only the representation actually available; do not invent scientifically verifiable rays from late-reverb parameters.

Each renderer explicitly declares source-input normalization, the pressure/energy domain, and whether distance attenuation, directivity, air absorption, HRTF, and propagation delay are already included. A single module must own each effect to avoid duplicate attenuation or double spatialization.

<!-- english-original-anchor --> <a id="2-三種不同的延遲"></a>
## 2. Three Different Delays

```text
propagationDelay = physicalPathLength / speedOfSound
algorithmicDelay = fractionalFilterGroupDelay + convolutionSchedulingDelay + ...
deviceLatency = audioBuffering + driver + DAC (+ downstream device processing)
```

Record them in separate fields; total perceived latency also requires handling event scheduling across clocks. Device-reported values may not include all headphone processing. Do not conflate propagation and compensated DSP latency with zero just to display an attractive impulse arrival. The fractional-delay filter used by pyroomacoustics to generate an RIR has a global delay (documented as `frac_delay_length // 2` samples); V3 comparisons must report how much is removed, and must not interpret that delay as additional distance in the room [T03–T04; DSP-005].

<!-- english-original-anchor --> <a id="3-fractional-delay-與-doppler"></a>
## 3. Fractional Delay and Doppler

Delay is usually not an integer number of samples: `D=τ fs=N+μ`, `0≤μ<1`. The simplest independent interpolation contract is:

```text
y[n] = (1-μ) x[n-N] + μ x[n-N-1]
H(e^jω) = e^(-jωN) [(1-μ)+μe^(-jω)]
```

The equations show that linear interpolation does not preserve amplitude at high frequencies; this conclusion can be calculated directly, without citing the unread P11 to claim a particular error value. A windowed-sinc FIR improves in-band accuracy but increases length and delay; an all-pass filter can preserve static magnitude, but its group delay depends on frequency, and state handling for time-varying coefficients still requires testing. P11 is an entry point to the method; only its bibliography has been verified so far, and it cannot serve as evidence that the performance of a specific implementation has been validated.

Changing `delay(t)` changes the read rate and pitch; the read rate of a retarded source buffer should agree with `dte/dtr` (ACOUSTIC_THEORY §7). Abrupt delay changes may click; large changes may also produce an unwanted pitch glide. Crossfading two fixed delay lines and continuous delay modulation produce different audible results. Separate their modes by use case and validate with sine sweep / impulse / moving source fixtures. History underruns must not read uninitialized memory.

<!-- english-original-anchor --> <a id="4-early-reflections卷積與時變-ir"></a>
## 4. Early Reflections, Convolution, and Time-Varying IRs

Sparse low-order early paths may use persistent delay taps plus per-band filtering and directional rendering. A complete RIR may use partitioned FFT convolution; IR length, partition size, and update rate must be included in CPU / memory / latency budgets. These are design tradeoffs; local capacity has not yet been measured.

P06 §2 mentions running two convolution outputs in parallel and then interpolating in the time domain; this avoids an abrupt switch but increases cost during transitions. If the incoming IR uses a different time-zero, filter delay, or normalization, crossfading can still produce duplicate transients / comb filtering. Therefore, first align acoustic time, retain filter state, and test correlated signals. [DSP-004]

Low-sample-rate ray-energy histograms can estimate RT / DRR to drive late effects, with an example in P06 §4; these energy statistics do not retain sample-level phase and cannot be used as pressure IRs for accurate convolution. Their smoothing may slow responses to rapidly changing scenes; P06 §8 explicitly lists limitations in detailed IRs, low frequencies, directional resolution, and temporal lag. Reflection Lab may adopt the layered concept, but must not report the paper's hardware figures as project performance.

<!-- english-original-anchor --> <a id="5-schroeder-與-fdn"></a>
## 5. Schroeder and FDN

Schroeder's comb / all-pass structures and decay relationships were verified from the body of P07; all-pass filters increase echo density, which does not mean they predict every reflection from actual walls. Purely artificial reverberation should be labeled `EstimatedLateReverb`.

Basic FDN [P10 §II, DSP-003]:

```text
s_i[n+m_i] = Σ_j A_ij s_j[n] + b_i x[n]
y[n] = Σ_i c_i s_i[n] + d x[n]
```

`m_i` is an integer delay length. A unitary / real orthogonal `A` can form a lossless prototype for arbitrary positive-integer delays; P10 also gives more general conditions and counterexamples. **Having only the eigenvalues of `A` inside the unit circle is insufficient to guarantee FDN stability for arbitrary delays**. Do not declare a pass based only on checking matrix eigenvalues.

For a desired exponential pressure envelope with `T60(f)>0`, the simplified attenuation target for each feedback delay is:

```text
g_i(f) = 10^[-3 m_i / (fs T60(f))]
```

This can be independently derived from “every `T60` seconds, pressure decreases by `10^-3`”; P07/P06 also provide corresponding decay relationships. Frequency-dependent attenuation filters must remain passive and stable; time-varying reverb, modulated delays, and filter-coefficient interpolation introduce additional stability issues. A lossless prototype can sustain ringing, which does not imply BIBO stability. Test long impulse tails, extreme T60 values, zero input, parameter jumps, NaNs, and energy growth.

P09's abstract supports separating decay control from reverberator structure, but its full text has not been read; this project's FDN equations and stability are based only on the read P10 and independent mathematics. A single room-wide average of material absorption cannot reconstruct the phase and direction of a specific path.

<!-- english-original-anchor --> <a id="6-edc-與-room-metrics-的計算契約"></a>
## 6. Computational Contract for EDC and Room Metrics

Schroeder's backward energy integration method in P08 is the historical / theoretical source of EDC; only the searchable portions of its body were accessible in this review. The following is this project's explicit discrete metric contract, not yet a standard measurement certification based on the complete S05:

```text
E[n] = Σ_(k=n)^(N-1) h[k]^2
EDC_dB[n] = 10 log10(E[n]/E[0])
T60_est = -60 / fittedSlope_dB_per_second
EDT: fit 0..-10 dB, extrapolate to -60 dB
T20: fit -5..-25 dB, extrapolate to -60 dB
T30: fit -5..-35 dB, extrapolate to -60 dB
```

Apply explicitly defined band filtering before calculating EDC; retain filter design, pre- and post-ringing, tail padding, sample rate, noise floor, noise compensation, and fitting window [DSP-001–002]. Zero signals, short IRs, signals that have not decayed through the required range, clipped recordings, and low SNR must produce `INSUFFICIENT_DATA`; do not force an RT value. Regression outputs include slope, range, sample count, residual / fit quality; a dual-slope decay must not be reduced to one apparently precise T60.

Clarity uses a window **relative to direct arrival time**; `t0` must be defined first:

```text
C_T = 10 log10( Σ_(t0≤t<t0+T) h(t)^2 / Σ_(t≥t0+T) h(t)^2 )
C50: T=0.050 s; C80: T=0.080 s
DRR = 10 log10(E_direct / E_reverberant)
```

There is no automatic choice of a DRR direct window that applies to every input; specify the window length and arrival point, whether nearby ground reflections are included, binaural / monaural processing, and band. Fix sample rounding at window boundaries as well. A zero denominator returns explicit infinity / invalid; do not silently clamp it to make the data appear finite.

LTI metrics apply only under fixed-scene / short-time stationarity assumptions. A single long RIR for a moving Source cannot represent the entire motion simultaneously; compare by snapshot / window, or use an explicit time-varying model. A/B comparisons must use the same motion trace, source signal, random seeds, and metric settings, and separate model differences from measurement / random differences.

<!-- english-original-anchor --> <a id="7-連續-source-與-collision-source"></a>
## 7. Continuous Sources and Collision Sources

Continuous audio retains an independent playback phase; physical body mode / grabbing / throwing updates only position and velocity. A CollisionEvent creates a short sound-effect source at the contact point, which may coexist with the same object's loop. Generate dry sound first, then pass it through the same room propagation / spatial rendering contract, avoiding the application of room reverberation again to an impact sample that already contains it.

Physics events use the simulation clock; DSP uses the sample clock. Control updates and audio blocks exchange bounded data with timestamps and versions; the audio thread does not wait for the solver. When updates are missing, use the last valid parameters and follow an explicit stale policy; errors, queue overflow, late events, and source removal require recordable, bounded fallbacks. These are engineering safety requirements whose runtime validation has not yet been completed.

<!-- english-original-anchor --> <a id="8-最小-v2-計畫"></a>
## 8. Minimal V2 Plan

| Fixture | Oracle | Errors / behavior still to be checked |
|---|---|---|
| Integer / fractional impulse delay | Known delay and independent interpolation equations | arrival, amplitude / phase, DSP compensation |
| Static sine + moving source | Analytical retarded constant-velocity Doppler | Frequency-estimation error, duplicate pitch shifting, buffer bounds |
| Exponential synthetic tail | Known decay rate | EDC, EDT/T20/T30 fitting; validates only the metric algorithm |
| Two analytic taps | Known energy and time | C50/C80 boundaries, DRR window, zero denominator |
| FDN impulse | Contractivity / pole analysis and long-duration output | NaNs, unbounded growth, finite precision, parameter changes |
| Path birth/death, ranking swap | The same stable path identity | click, gain discontinuity, tail truncation, CPU upper bound |
| Continuous loop + impact | Known source timeline | Uninterrupted loop phase, impact at the contact point, event deduplication |

The above are acceptance specifications. Some mathematical references and synthetic EDC / RT have been tested by isolated kernels, recorded in `benchmarks/results/validation-local.json`; the ledger's `validation_evidence` links to the corresponding fixtures. Product audio, the fractional-delay renderer, FDN, crossfading, and hearing tests have not yet been run. The existence of literature and passing synthetic metrics do not establish that the complete V2 audio system has passed.
