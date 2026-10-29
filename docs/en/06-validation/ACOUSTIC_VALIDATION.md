<!-- english-source: {"path":"docs/06-validation/ACOUSTIC_VALIDATION.md","sha256":"7c939ee86259c1532a1219fb82fad3b0af6d046d469cb913ab4868cb73d136cc","translated_at":"2026-10-29T05:28:32Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/06-validation/ACOUSTIC_VALIDATION.md`](../../06-validation/ACOUSTIC_VALIDATION.md). Source SHA-256: `7c939ee86259c1532a1219fb82fad3b0af6d046d469cb913ab4868cb73d136cc`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學驗證狀態"></a>
# Acoustic Validation Status

2026-10-29 scope note: The following is an early analytical baseline and does not mean that only a spike exists today. The production solver, Web Audio graph / HRTF now have runtimes and component tests; see the [research](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md), tests/acoustics-runtime/, and tests/audio-runtime/ for current capabilities and sources. Real-world / calibration, complete performance, and listening tests have not yet passed; unit or native DSP PASS results do not replace them. `npm test` still runs the analytical / contract regressions below; the original [`validation-local.json`](../../../benchmarks/results/validation-local.json) results retain their historical scope.

<!-- english-original-anchor --> <a id="已執行模型"></a>
## Models Executed

`ACO-001` uses SI units for t=r/c and free-field pressure 1/r, with a reference distance of 1 m. These are relative quantities for a point source; near-field/r=0 behavior is undefined, and r=0 is rejected. A pressure ratio is neither an energy ratio nor calibrated dB SPL.

`ACO-002`/`ACO-003` mirror the source along the specified surface sequence, backtrack intersection points from the listener, and check containment within finite convex polygons and occlusion of every actual segment. First-order, second-order, outside-polygon rejection, direct blocker, and reflection blocker cases all have independently fixed expected values. Reflection path IDs contain only source/listener/surface IDs; coordinates and rankings are excluded from IDs. Small source displacements and added blockers can be rerun; audio crossfade has not been tested.

The current kernel accepts only unit normals and convex, coplanar polygons, with boundary epsilon=1e-9 m. It lacks diffraction, diffuse scattering, non-convex decomposition, thick-wall transmission, complete handling of coincident/coplanar grazing, and an acceleration structure. These results cannot support accuracy promises for general mesh scenes.

`MAT-001` checks energy A+R+T=1, the [0,1] range, and finite values for each synthetic band, then maps them to magnitudes √R/√T in the same medium. There is no phase, complex impedance, or angle-dependent model. `scatteringFraction` distributes energy within reflected energy and cannot be added directly to A+R+T again.

`AIR-001` validates only the dB/m-to-pressure conversion `10^(-alpha*r/20)` for known alpha. alpha=0.1 is a **synthetic** test value, not a value from ISO 9613-1 tables. **ISO atmospheric absorption coefficient formula/reference point: NOT RUN**; a complete, lawfully obtained standard or an independently traceable reference is required before adding temperature/humidity/pressure sweeps or claiming consistency with the standard.

For `AIR-002` Doppler, n points from the emission source→listener, using `f*(c-v_receiver·n)/(c-v_source·n)`; stationary, equal-velocity, and radially approaching source cases are tested. Conditions are a uniform medium, a known emission direction, and subsonic velocities. Supersonic velocities are rejected; a retarded-time root solve for arbitrarily moving sources has not been implemented, and instantaneous direction is not presented as exact dynamic propagation.

`WAVE-001` is the analytical eigenfrequency of a rigid rectangular Neumann room, testing only the (1,0,0) axial mode of a 5×4×3 m room. This test does not validate FDTD/FEM/BEM or a low-frequency room response.

<!-- english-original-anchor --> <a id="rirdsp-邊界"></a>
## RIR/DSP Boundaries

`DSP-001` computes a reverse sum of squares for finite synthetic pressure samples and normalizes the EDC by total energy. Zero remaining energy is -Infinity; the JSON fixture encodes the expected value as null. Silent input is rejected instead of reporting an arbitrary RT.

`DSP-002` uses a synthetic RIR with exponential amplitude, known RT60=0.6 s, 8 kHz, and a 2 s duration, fits least-squares slopes over 0..-10, -5..-25, and -5..-35 dB, then extrapolates to 60 dB; tolerance is 5e-5 s. It returns null for an insufficient range or fewer than three fit samples. Noise-floor correction, measurement uncertainty, bandpass integration, and the full ISO 3382 measurement procedure have not been implemented; **ISO conformity or validation of real-room RT cannot be claimed**.

The arrival test converts distance/sound speed to the nearest sample, with quantization error of at most half a sample; a fractional-delay filter has not been implemented. Propagation delay, DSP processing delay, and device latency must be reported separately. DRR, C50, C80, BRIR, HRTF, convolution, FDN, Doppler resampling, and audible click tests remain NOT RUN.

Sources and applicability conditions are maintained in [`EVIDENCE_LEDGER.json`](../../../research/EVIDENCE_LEDGER.json) and [ACOUSTIC_THEORY](../research/theory/ACOUSTIC_THEORY.md). `validate:research` checks metadata, IDs, and fixture claim traceability; it does not prove the correctness of paper content or license interpretations.
