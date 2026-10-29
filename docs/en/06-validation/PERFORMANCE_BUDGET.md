<!-- english-source: {"path":"docs/06-validation/PERFORMANCE_BUDGET.md","sha256":"2a2f3d55dbb018c73913c740eef4fc960b85c88b16a672bb1c767713a774f8b8","translated_at":"2026-10-28T19:34:44.999Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/06-validation/PERFORMANCE_BUDGET.md`](../../06-validation/PERFORMANCE_BUDGET.md). Source SHA-256: `2a2f3d55dbb018c73913c740eef4fc960b85c88b16a672bb1c767713a774f8b8`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->


<!-- english-original-anchor --> <a id="效能目標與量測界線"></a>
# Performance Targets and Measurement Boundaries

Evidence for the local Node mathematical kernel, isolated SDK/Rapier and formal browser profiles is retained separately. Initial product performance targets remain in the table below. [The R17 formal 600-second measurement](../11-v1/BROWSER_PERFORMANCE.md) produced interpretable negative results: performance/sustained workload did not pass, and unmeasured intervals remain **TARGET/UNVERIFIED**. Analytical microbenchmarks do not imply passed browser or audio deadlines.

This document remains the single maintained location for official numerical budgets. Phase 2 [UI measurement standards](../05-ux/PERFORMANCE_STANDARDS.md) add profiles, separate clocks, and stress-testing methods without relaxing the thresholds in this table. New UI latency thresholds remain PROPOSED and will be merged here only after adoption.

<!-- english-original-anchor --> <a id="初始工程目標"></a>
## Initial Engineering Targets

| Subsystem                    | Initial target (unverified)                                      | Acceptance method                                                                      |
| ---------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 3D interaction/UI            | 60 Hz, frame 16.67 ms; main-thread application work p95 <4 ms     | Browser trace, specified scene/GPU/resolution, 10 min                                   |
| physics                      | fixed dt=1/60 s; step p95 <2 ms, maximum catch-up 4 steps         | 256 primitive bodies, including a CCD subset, contact flood                             |
| acoustic worker              | 20 Hz updates, each p95 <20 ms; stale frames are not applied     | Initial profile of 1 listener, 8 sources, 32 surfaces, order≤2                           |
| acoustic main-thread delivery | p95 <1 ms/update; bounded message/queue                          | worker payload/path limit of 256, backpressure telemetry                                |
| audio render                 | 48 kHz, 128-frame quantum approximately 2.67 ms; work p99 <1 ms   | Actual AudioWorklet profiling, underrun/extended listening                               |
| AI simulation                | serial concurrency=1, simulation time per run ≤30 s              | host quotas, cancel/timeout/cost ledger; this is not a guarantee of model speed          |

These scenes are initial profiles awaiting execution; they do not imply that the targets will necessarily be met at schema limits. Browser audio quantum/device latency must not be described as fixed across devices before measurement; a fixed quantum is a benchmark setting.

The catch-up limit applies to interactive previews. Under overload, accumulated wall-clock backlog may be dropped, but dropped-time telemetry must be recorded. Recording/comparable A/B runs must not skip simulation ticks; overload must pause wall-clock progression or mark the run as non-comparable. The two modes must not share an accumulator policy that silently discards time.

<!-- english-original-anchor --> <a id="已量測的微基準"></a>
## Measured Microbenchmarks

Running `npm run benchmark` produces [`analytic-local.json`](../../../benchmarks/results/analytic-local.json), saving UTC, Node, OS, CPU/memory, fixture/kernel/lockfile SHA-256, iteration count, warmup, median, p95, and min/max. Each workload has 20 batches; direct/order2 each have 5000 iterations per batch, and the 4096-sample EDC has 100 iterations per batch. The i%10 parameter is fixed, with no stochastic seed.

Measurements include JavaScript allocation; the EDC workload also includes synthetic input creation. p95 is the **quantile of batch-average elapsed times**, not the tail latency of a single frame. JIT, OS scheduling, and thermal conditions on a single machine can change the data. JSON is authoritative for the latest results; this document does not duplicate numbers that may become stale.

This test excludes BVH, complete scenes, cross-thread serialization, GPU, Web Audio, native Steam Audio real-time reflections, and path explosion at arbitrary orders. Memory leak soak, browser compatibility, and actual end-to-end audio latency tests have not been run; V4 therefore remains PARTIAL.

<!-- english-original-anchor --> <a id="效能退階"></a>
## Performance Degradation Strategy

If future measurements exceed the budget, first reduce the acoustic update rate, reflection order, active source/path limits, and IR update frequency, then use a bounded ranked path bank/late reverb approximation. The UI must show the actual backend/model/limitations and stale status; reducing data volume must not conceal changes in numerical behavior or capability.

<!-- english-original-anchor --> <a id="2026-10-28-實測補充"></a>
## 2026-10-28 Measurement Addendum

The initial values, workloads, and degradation policy remain as written above. The [r10 formal profile](../11-v1/SESSION_PROGRESS_20261028-r10.md) and its raw receipts retain actual FAIL/UNVERIFIED/NOT RUN results, safe-overload pauses, and incomplete workloads; a native process exit code does not equal a performance pass. ACO04's worker functional contract is separate from VAL04's profile/metadata/transparent degradation. Without action by the acceptance authority, the initial TARGET values are not independently changed into new thresholds, and openly reporting FAIL does not declare the overall first version complete.
