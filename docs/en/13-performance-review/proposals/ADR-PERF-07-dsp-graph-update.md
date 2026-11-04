<!-- english-source: {"path":"docs/13-performance-review/proposals/ADR-PERF-07-dsp-graph-update.md","sha256":"67187b63c8993d96119b7cd3b96789958b299c855805afa3dbfa580a8da38041","translated_at":"2026-11-01T08:32:24.292Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/proposals/ADR-PERF-07-dsp-graph-update.md`](../../../13-performance-review/proposals/ADR-PERF-07-dsp-graph-update.md). Source SHA-256: `67187b63c8993d96119b7cd3b96789958b299c855805afa3dbfa580a8da38041`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-07dsp-圖更新的準備接納與退役"></a>
# ADR-PERF-07: Preparing, Admitting, and Retiring DSP Graph Updates

- Status: **PROPOSED / not adopted**; 2026-11-01. No Worklet/DSP backend is added, and existing routing, formulas, quality, and acceptance remain unchanged.
- Code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`; new graph-update benchmarks/output validation are **NOT RUN**.
- Basis: [audio contract](../../02-architecture/AUDIO_RUNTIME.md), [ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md), [DSP Review](../AUDIO_GRAPH_DSP_REVIEW.md), and [Buffer Review](../BUFFER_ARCHITECTURE_REVIEW.md).

<!-- english-original-anchor --> <a id="問題與已實作保護"></a>
## Problem and Implemented Safeguards

[band-filter.ts](../../../../src/audio/band-filter.ts) already has exact response keys, a normalized-kernel cache, layout/transform plans, bounded scratch, private output copies, and a reentrant fallback. FIRs are not rebuilt from scratch on every call. [routes.ts](../../../../src/audio/routes.ts) already reuses delay/panner nodes by stable path ID, with dual convolver banks, bitwise kernel equality, gain/delay/direction smoothing, and a crossfade admission gate. [LateReverbBus](../../../../src/audio/late-reverb.ts) already has dual IR banks, budgeting, priming/crossfade, and one coalesced pending setting; double buffering is not absent.

A cache hit does not make graph-control costs zero: response snapshots/keys, copies, AudioBuffer creation, node control/validation, and route churn remain. `AudioEngine.updateFrame` clones frames on main and applies them to related voices. Measure kernel computation, buffer preparation, native graph control, and retirement separately; an improved FIR microbenchmark does not establish improved full delivery/audio quality.

<!-- english-original-anchor --> <a id="候選決策"></a>
## Candidate Decision

Instrument existing prepare/apply/retire stages first and spike immutable prepared responses plus bounded submission only for measured expensive work. Prefer existing exact caches, native routes, and dual banks rather than immediately replacing all DSP with a Worklet, coarsening gains, or adding tolerance epsilons. Newer dirty R21 target-suppression/onset-lookahead observations have separate provenance and cannot be treated as results of this commit or guaranteed benefits.

1. Prepare is pure data work: pin bands, gains, sample rate, tap count, model/operator version, and exact response identity; return owned coefficients, scale, and group delay. If a Worker candidate merits testing, transfer only these data, not AudioNode/AudioBuffer/context or Scene authority.
2. Apply stays on the native graph owner's control thread. First validate runEpoch/scene+geometry revision/source+path ID/response generation and reserve incoming bank/routes/bytes. An old-generation prepare completion only releases resources and never changes the audible graph.
3. Schedule continuous parameters—delay, direction, pressure scale—separately from expensive response replacement. A busy FIR queue cannot permanently freeze direction/delay. Only unadmitted responses belonging to the same identity may coalesce to the latest; count every skipped/coalesced update and measure age.
4. While banks are busy, retain the last complete response and existing smoothing with explicit pending/stale state. Never overwrite active/fading coefficients or create an unbounded third/fourth bank. New policy cannot weaken the existing admission gate or rebuild an identical kernel for scale-only updates.
5. Retire/disconnect after the audio-clock fade/tail boundary and graph-reference completion. A wall timer only triggers reclamation checks. Tail/retiring routes still consume budgets; pause/seek retain interrupted-tail policy, without claiming verified click-free output.

<!-- english-original-anchor --> <a id="容量時鐘與取消"></a>
## Capacity, Clocks, and Cancellation

Bound preparation separately by jobs, responses, coefficient bytes, and maximum taps/bands. Bound the graph by active/fading/retired routes, late sends, AudioBuffer/IR bytes, and simultaneous transitions. Derive pool/queue capacity from cache hits/misses, source bursts, preparation service time, and measured peak overlap; schema hard maxima do not establish usable performance, and this proposal chooses no arbitrary values.

Identify preparation wall duration, consumed acoustic snapshot tick, native apply AudioContext time, and recording emission timeline separately. Publish FIR group delay with response metadata; do not subtract it as physical d/c or double-count propagation in direct/early/late. Unknown native HRTF/limiter latency remains unknown.

Cancel/run reset/scene commit/source removal invalidate pending-preparation generations. Data already supplied to AudioBuffer cannot be overwritten as scratch. Pause/resume do not re-emit original emissions. Dispose rejects late completions, clears pending work, disconnects the graph, and releases pins. Reject unknown/invalid prepared responses and retain the previous valid graph; partial application cannot be reported as success.

<!-- english-original-anchor --> <a id="替代與品質風險"></a>
## Alternatives and Quality Risks

Existing caches/banks are the control. Moving kernel work into a Worker may add latency/copies if graph control, rather than FIR computation, dominates. Additional AudioBuffer caching must account for context/sample-rate ownership and retained memory; native objects cannot be assumed reusable across contexts/threads. Quantizing gains to increase hit rate changes acoustic output and requires separate error/scientific labeling; it is not an exact optimization.

Custom convolution/Worklets offer callback control but require new HRTF/filter/state/tail equivalence and actual underrun/deadline measurements. The [fixed Web Audio Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/#rendering-loop) does not verify the product callback. Any new callback uses actual block lengths and preallocated state, never waits for geometry/network/AI/physics, and does not generate kernels inside the callback.

<!-- english-original-anchor --> <a id="採納條件與回復"></a>
## Adoption Criteria and Rollback

The [Measurement Plan](../MEASUREMENT_PLAN.md) first reports exact-cache hits/misses, kernel preparation, copy/createBuffer, route creation/reuse/retirement, native apply, coalesced age, node/byte peaks, and full delivery, separating cold/warm and steady/burst conditions. Compare fixed-reference impulse arrivals, band magnitudes, scale, FIR group delay, delay ramps, path birth/death, and crossfade/tails. Without output evidence, click/pop or continuity cannot be marked passing.

Test reordered/duplicate/old-epoch preparation, busy banks, unchanged/scale-only responses, topology changes, source removal, cancel/pause/resume/seek/dispose, retirement floods, and exhaustion. Keep frozen mathematical references/tolerances rather than relaxing them for the candidate. Adopt a concrete implementation only after targeted costs improve, full output oracles/boundedness pass, and browser compatibility risk is acceptable.

Rollback stops new preparation, invalidates the candidate generation, and returns through existing fade/drain boundaries to `createBandFilterKernel`/`PathRoute.update`/`LateReverbBus`. Preserve original formulas, cache keys, artifact/asset references, and quality. Rollback does not immediately overwrite a bank with active readers.
