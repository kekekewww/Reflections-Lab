<!-- english-source: {"path":"research/theory/PHYSICS_THEORY.md","sha256":"a314a91fc7a3a262ef5c4ff88dfb73e0a795b1e82cd68bf7cbeff294906e29d7","translated_at":"2026-10-27T05:44:50.765511Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/theory/PHYSICS_THEORY.md`](../../../../research/theory/PHYSICS_THEORY.md). Source SHA-256: `a314a91fc7a3a262ef5c4ff88dfb73e0a795b1e82cd68bf7cbeff294906e29d7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="物理事件振動與碰撞聲音"></a>
# Physics Events, Vibration, and Collision Sounds

Checked: 2026-10-26. These are Reflection Lab's model contracts and engineering derivations awaiting validation; there is no formal product implementation yet. SI units: m, s, kg, N, N·s, rad. The Newtonian models below are limited to ordinary low-speed rigid bodies; exact engine behavior must still be verified against a fixed API version and experiments. For literature identifiers, see [COLLISION_WAVE_NOTES.md](../papers/COLLISION_WAVE_NOTES.md).

<!-- english-original-anchor --> <a id="1-狀態與接觸幾何"></a>
## 1. State and Contact Geometry

Each rigid body records its center-of-mass position `x`, orientation `q`, linear velocity `v`, angular velocity `ω`, mass `m`, and world-coordinate inertia tensor `I_world`. At a world contact point `p`, the rigid body's surface velocity is:

```text
r_A = p − x_A
v_A_contact = v_A + ω_A × r_A
v_rel = v_B_contact − v_A_contact
v_n = dot(v_rel, n)
v_t = v_rel − v_n n
```

This file fixes `n` as pointing from A to B; `v_n < 0` means approaching. This contract is derived from rigid-body kinematics and must not be mixed with the engine's normal / pair order. `contactPointVelocity` cannot simply subtract the two objects' center-of-mass velocities; a rotating object may have zero center-of-mass velocity and nonzero impact velocity.

<!-- english-original-anchor --> <a id="2-forceimpulse-與-restitution"></a>
## 2. Force, Impulse, and Restitution

Impulse is a time integral and has different units from force:

```text
J = ∫ F(t) dt = Δp                    [N·s = kg·m/s]
F_average = J / Δt                   [N]
e = −v_n_after / v_n_before          [dimensionless; central impact]
```

The definition of impulse and the impulse–momentum theorem follow [OpenStax University Physics §9.2](https://openstax.org/books/university-physics-volume-1/pages/9-2-impulse-and-collisions); the coefficient of restitution follows [Jönköping University Applied Mechanics §7.5](https://mechanics.ju.se/Kinetics/ImpulseMomentum.html). Both are complete textbook web pages, not Reflection Lab measurement data.

For a frictionless, single instantaneous contact, combining the momentum update and the coefficient of restitution gives:

```text
invEffectiveMass = 1/m_A + 1/m_B
  + dot(n, cross(I_A⁻¹ cross(r_A,n), r_A))
  + dot(n, cross(I_B⁻¹ cross(r_B,n), r_B))
j_n = −(1+e) v_n_before / invEffectiveMass
```

The conditions are `v_n_before < 0`, a unit-length contact normal, and valid mass / inertia. A fixed body is treated as having zero inverse mass / inertia in the dynamics solution; this does not mean that its material has no acoustic vibration or cannot produce sound. Multiple contacts, stacking, friction, penetration correction, and iterative solving make the single-contact formula insufficient to reproduce actual engine impulses; do not use it to overwrite engine results.

The one-dimensional relative normal kinetic-energy loss can also be derived:

```text
m_eff = 1 / invEffectiveMass
ΔE_normal = 0.5 m_eff (1−e²) v_n_before²
```

This expression has an energy meaning only within the specified contact model; `ΔE_normal` is distributed into deformation, heat, sound, and other channels and **is not equal to acoustic energy**. `e=1` in an ideal rigid-body model may still trigger an impact sound effect; physically closing the acoustic-energy budget requires a separately calibrated vibration / radiation model. Models commonly use `0≤e≤1` to represent passive collisions; do not use the coefficient of restitution as sound gain.

<!-- english-original-anchor --> <a id="3-重力與-body-mode"></a>
## 3. Gravity and Body Mode

```text
dv/dt = g_scale g_world + F_other/m
dx/dt = v
```

`NoGravityDynamic` should be defined as a dynamic body with `g_scale=0`; under the analytical conditions of no other external forces, no damping, and no contact, `v(t)=v0` and `x(t)=x0+v0 t`. It can still be affected by impulses, torques, and collisions. `Fixed` means that the integrated state does not move in response to forces; `Kinematic` is controlled by an external trajectory. The three cannot share an implementation that simply “stops updating the transform.” These are this project's model requirements; API details and engine test records form a separate layer of evidence.

The continuous-audio lifecycle of freely flying / zero-gravity / fixed objects is independent of body mode; position and velocity updates must not automatically stop a source. An impact sound creates its own sound-source event at the world contact coordinates.

<!-- english-original-anchor --> <a id="4-摩擦刮擦與滾動"></a>
## 4. Friction, Scraping, and Rolling

The simplified Coulomb tangential constraint is `|F_t|≤μ F_n`; during sliding, `F_t` opposes `v_t`. Frictional dissipation power can be written as `P_friction = max(0, −dot(F_t,v_t))`. If only the normal impulse per step is available, `j_n/Δt` estimates average force and cannot recover the actual contact-force waveform. Contact-point jumps and constraint stabilization may also contaminate this estimate.

CW01 converts surface roughness and relative motion into excitation at a high sampling rate; therefore `speed`, `normalLoad`, `roughness`, and `contactLocation` are candidate control variables. Relating gain to `sqrt(P_friction)` is conditional physical inspiration, not universal measurement calibration. In `pure rolling`, the contact-point relative velocity may be near zero while the object still produces sound on a rough surface; `|v_t|≈0` does not imply complete silence. Rolling and scraping require separate state / surface-motion estimates; label unmodeled behavior `Estimated`.

<!-- english-original-anchor --> <a id="5-sample-based-與-modal-synthesis"></a>
## 5. Sample-based and Modal Synthesis

A maintainable P0 contract for `SampleBasedImpact`: select a sample by material pair and shape class; use pre-impact `v_n`, `j_n`, or estimated energy to control monotonic, finite, capped gain; the event includes the contact point and source motion. Gain curves, pitch variation, and the sample random seed are a `PerceptuallyTunedPreset`, not claimed material measurements. Record sample sources, licenses, and versions.

The basic small-amplitude model of `ModalSynthesis` is:

```text
M u¨ + C u˙ + K u = f(t)
K φ_k = ω_k² M φ_k
u = Σ φ_k q_k
q¨_k + 2 ζ_k ω_k q˙_k + ω_k² q_k = φ_kᵀ f(t)  [mass-normalized modes]
```

The first equation is the standard linear vibration model; the independent modal ODEs here additionally assume classical / diagonal modal damping, and arbitrary nonproportional damping does not necessarily decouple. CW01/CW03 support modal decomposition and its application to contact sounds. Impact position affects `φ_kᵀ f`; material, geometry, boundaries, and contact damping affect frequencies and decay. For an underdamped mode, the impulse response contains `exp(−ζ_k ω_k t) sin(ω_d,k t)`, with `ω_d,k=ω_k sqrt(1−ζ_k²)`. Solid vibration must pass through a `radiationModel` to become airborne sound pressure; displacement or mode amplitude cannot directly be called Pa / SPL.

Impulses provided by a rigid-body engine can serve as excitation proxies but do not contain complete high-frequency forces, microcollisions, or elastic coupling. CW03 warns that fluctuations in resting-contact solvers may become audible buzzing; event deduplication and thresholds only reduce artifacts and cannot replace a coupling model.

<!-- english-original-anchor --> <a id="6-事件契約與時脈"></a>
## 6. Event Contracts and Clocks

A collision event requires at least:

```text
eventId, pairId, contactId, simulationTick, tSimulation_s
bodyAId, bodyBId, contactPoint_m, normal_A_to_B
preContactRelativeVelocity_m_s, normalImpulse_N_s
materialAId, materialBId, bodyModeA, bodyModeB
solverVersion, physicsDt_s, provenance, optionalForceEstimate_N
```

Route `ImpactBegin` and `ContactPersist` separately; multiple points in the same contact may first be aggregated by pair / tick / spatial grouping, then capped by energy/gain so that a change in manifold point count does not increase loudness. Aggregation rules, minimum onset, and retrigger interval are this project's engineering designs and must undergo V1/V2/V5 validation; they are not guarantees from the literature.

The audio renderer schedules by the sample clock; converting physics ticks to audio time requires an explicit epoch / clock mapping. The audio callback reads only a bounded event queue and prepared parameters; it must not wait for physics, the network, or geometry solving. Record queue-overflow / late-event policies; do not silently replay old impacts.

<!-- english-original-anchor --> <a id="7-波動求解的角色與成本"></a>
## 7. The Role and Cost of Wave Solvers

The linear lossless wave equation for air and its frequency-domain form are:

```text
∂²p/∂t² = c² ∇²p + source
∇²P + (ω/c)² P = source_frequency
```

CW04 and CW06 both use models of this type. FDTD samples the entire volume, FEM establishes a weak formulation on a volumetric mesh, and BEM uses Green functions to express a homogeneous-domain problem on the boundary; the latter reduces mesh dimensionality, but its general matrix is dense and still requires acceleration and a good iterative solver. These are not synonyms for “reflection-path enumeration.”

For a **uniform cubic grid and standard second-order 7-point explicit FDTD**, von Neumann analysis gives:

```text
λ_courant = c Δt / Δx ≤ 1/√3
```

This is an analytically derived condition for a specific stencil and **must not be applied to all of CW04's 27-point / implicit stencils or irregular boundaries**. Boundaries, floating-point error, dispersion, and source injection still require independent validation; stability does not imply correctness. Samples per wavelength determine the usable maximum frequency; satisfying Nyquist alone does not establish sufficiently small sound-pressure error.

For the same physical volume and simulation duration, with fixed resolution per wavelength / Courant ratio, grid-point and step counts independently imply that increasing the maximum frequency by a factor of 2 increases memory by approximately a factor of 8 and explicit update work by a factor of 16. This is an asymptotic estimate, not a local benchmark; constants, boundaries, GPU transfers, FEM order, and BEM acceleration are accounted for separately. CW04 provides analytical background for the same scaling issue.

Plan: P0/P1 use geometric acoustics and audio rendering; wave methods first provide small-room / low-frequency offline V3 comparisons. A hybrid must explicitly define band splitting, overlap regions, phase / gain, and crossfading to avoid adding the same energy twice across backends. CW06's shoebox comparison particularly shows that different incidence-angle boundary assumptions can produce differences between solvers; do not blindly select the “more complex” solver as ground truth.

For a rectangular room with dimensions `Lx,Ly,Lz`, homogeneous c, and **rigid Neumann boundaries**, separation of variables in the wave equation independently gives:

```text
f(nx,ny,nz) = c/2 × sqrt((nx/Lx)² + (ny/Ly)² + (nz/Lz)²)
nx,ny,nz = nonnegative integers; exclude (0,0,0) for nonzero modes
```

This is the `WAVE-001` analytical oracle, not a measured resonance; finite impedance, absorption, and nonrectangular geometry change modes and decay. Modal nodes at source / receiver positions may leave a theoretical frequency barely excited or received; the absence of an FFT peak does not directly establish a solver error. Frequency resolution, time window, damping, and spectral estimator must all be recorded.

<!-- english-original-anchor --> <a id="8-建議解析-fixtures-與限制"></a>
## 8. Suggested Analytical Fixtures and Limits

| Fixture | Analytical conditions and expectations | Validation focus |
|---|---|---|
| NoGravityDynamic | No other forces / damping / contact, `x=x0+v0t` | Distinguish modes, integration error, step size, and coordinates |
| FixedBodyCollision | Fixed plane remains stationary; dynamic sphere collides head-on | Momentum-normal sign, world impact position, event count; fixed boundaries may be externally supported, so do not require the isolated two-sphere momentum formula |
| CentralImpact | A single frictionless contact with specified `e` and masses | Approaching / separating velocities and `j_n`; solver tolerance should be measured from a fixed-version spike |
| OffCenterImpact | Contact point offset from the center of mass | Angular velocity and contact-point velocity; do not substitute center-of-mass velocity |
| RestingContact | Quiet rest under gravity | No repeated impact triggering; track solver jitter and artificial thresholds |
| ModalImpulse | A single damped mode with known excitation | Frequency, decay envelope, linearity, and no NaN; does not establish real-material validation |
| WaveShoebox | Fixed c, hard walls, the same source, and mesh convergence | Theoretical room modes, arrival time, stability; align boundaries first |

This document defines acceptance conditions and does not present suggested tolerances as measurement results. For the isolated analytical kernel and Rapier engine smoke tests already run, see `benchmarks/results/validation-local.json` and `experiments/physics-spike/`, respectively; results for their limited scenes do not mean that all physics / modal / wave fixtures above are complete. Each runner records actual tolerances, results, and commands; research claims, analytical derivations, engineering decisions, and executed tests are retained in separate fields.
