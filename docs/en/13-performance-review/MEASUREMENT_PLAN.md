<!-- english-source: {"path":"docs/13-performance-review/MEASUREMENT_PLAN.md","sha256":"e534768d139b4b16cab2cfe51770aed346b72c08028c13beb1520fc61faf8384","translated_at":"2026-11-01T08:32:24.237Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/MEASUREMENT_PLAN.md`](../../13-performance-review/MEASUREMENT_PLAN.md). Source SHA-256: `e534768d139b4b16cab2cfe51770aed346b72c08028c13beb1520fc61faf8384`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="量測方法研究長測與未來-benchmark"></a>
# Measurement methodology, research long run and future benchmarks

Review date: 2026-11-01. Product baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`. This page defines the study and collection method. The [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md) and [formal browser method/R17 failure](../11-v1/BROWSER_PERFORMANCE.md) retain authority; neither is changed here. See the [final report](FINAL_REVIEW_REPORT.md) for receipts and limitations.

<!-- english-original-anchor --> <a id="1-本輪執行與資格"></a>
## 1. Execution and qualification

Use Node 22.17.0 / npm 11.4.2 and the original lockfile for isolated dependency installation. First run the unchanged `tests/browser/run-performance-v3.mjs`. Its `--formal-600` requires all phases,600 seconds,3000 physics iterations and600 acoustic iterations; do not substitute a smaller workload. The original launcher hash is `480f275b63d1ea39113cbc8344ac395578acc25b432bd39af5fbc77005179aca`; installed156.0.8078.75 hashes to `7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa`. Retain the original rejection and exit status.

The user explicitly selected a separate temporary research copy under ignored `.cache/performance-review/measurement/` with current Chrome. Change only import locations, actual launcher/native producer identities and explicit research-only metadata. Keep fixtures, workloads, windows, thresholds, native trace membership/caps/closure and error handling intact. Bind the adapter text/diff/hash and observed producer revision in its receipt. Any formal-candidate fields emitted internally remain subordinate to the outer `RESEARCH_ONLY / NOT_APPROVED` classification.

Run an all-phase20-second collection smoke, then one all-phase600-second study. A single instrumented observation does not estimate cross-run reliability. Preserve every command, stdout/stderr, build/source/bundle/browser/hash, raw/tail/trace and error in fresh directories. Keep raw data and research programs in isolated temporary storage; commit only compact receipts and verifiable hashes.

Use localhost5193 and owned browser processes. Preserve port conflicts instead of killing other work. Avoid concurrent builds/browser/CPU tests during collection; residual document-authoring load and CDP overhead remain limitations. If current traces do not satisfy the original parser, keep the corresponding analysis UNVERIFIED. Do not relax membership or infer missing results from average FPS. Never backfill the600-second window with finish-tail work.

<!-- english-original-anchor --> <a id="2-情境矩陣"></a>
## 2. Scenario matrix

These are future independently implementable research fixtures. The current legacy profile covers only a subset, so this review cannot claim all were executed.

| ID/scenario | Fixed inputs and variable | Principal observations/output |
|---|---|---|
| BM01 Baseline Audio | One continuous source; no physics/reflections; fixed asset/gain/device | Native output stats, long tasks, node/automation baseline, PCM integrity |
| BM02 Physics Only | Same initial state/impulse sequence; acoustic/audio lanes disabled | Core/full-step/onTick cost, catch-up, dropped wall time, event continuity |
| BM03 Direct Sound | Fixed listener/distance/direction trajectory; direct only | Emission/audio mapping, admission/age, physical arrival and gain error |
| BM04 Early Reflections | Same scene/first order/explicit effective path budget; default and stress separate | Compute/delivery/snapshot age/path churn and audio quality |
| BM05 Dynamic Filter | Vary overall gain and frequency shape separately; same path identities | Cache hits/misses, kernel builds, native buffer assignment, automation/node cost |
| BM06 Collision Burst | Same body IDs/initial state/collision/event sequence; retain logical/native budgets | Event ordering/dedup, admission, late starts, active/retiring/steal/tail |
| BM07 FPS Interaction | Fixed movement/grab/throw/fast-view trajectory; real input separately | RAF, physics/render synchronization, listener updates, input/audio latency |
| BM08 Recording | Capture every fixed tick, with early/mid/late capture | Capture solver/clone/append/seal/save stages, debt/backlog, integrity |
| BM09 Replay | Same RecordingArtifact/assets/listener/seek sequence | Replay cloning/index, source phase, tail/pause/seek semantics and PCM |
| BM10 Long Stress | Same sustained load and create/dispose cycles; background transitions separate | Memory trend/recovery, overruns, output stats, thermal proxies and restoration |

Background/quota/worker-crash/seek/pause-resume/revision/out-of-order tests are separate negative scenarios. Do not fold them into a steady-state distribution and call it the same workload. Formal recording checks contiguous ticks/bodies/events, hashes, seal/commit and cancellation; it must not use latest-only replacement.

<!-- english-original-anchor --> <a id="3-metrics-與誠實的可觀測邊界"></a>
## 3. Metrics and honest observability boundaries

| Metric group | Required values | Method and gaps |
|---|---|---|
| Render/UI | FPS, frame time, long tasks, main occupancy, draw calls/DPR/React commits | Native RAF+CDP; occupancy is wall spans, not thread CPU; GPU/React need separate tools |
| Physics | Core/full-step/onTick p50/p95/p99/max, catch-up, overruns, dropped seconds, paused advances/debt | Existing fixtures cover a subset; Rapier timing does not include all tick-bridge cost |
| Acoustics | Request building/validation/cloning, worker compute, round trip, handler, consumer, snapshot age, stale/reject/timeout, payload bytes | Service round trip excludes request construction; delivery does not automatically cover app consumers/OS pre-handler time |
| Audio control | Late events, pending age, admission rejection, active/retiring voices, active paths, steals/path drops | Preserve separate logical/native/solver budgets; none is output underrun |
| DSP graph | Kernel/cache hits, convolver replacements, IR generation, AudioNode creation/disposal, automation events | Native graphs expose no complete public counter set; remain NOT MEASURED before research instrumentation |
| Audio render/output | Actual sample rate/block size, render capacity, underrun events/duration, output integrity | Record only supported APIs; current fixtures have no custom Worklet and measure no DSP deadline; hardware listening is separate |
| Memory/GC | JS/worker heaps, WASM, native working set, owned decoded PCM/IR/trace bytes, peak/steady, GC pauses | State each API's scope/rate; Node analyzer heap is not browser RAM; opaque native/GPU memory stays separate |
| Recording/export | Queue items/bytes/age, high water/producer pause, encoding/hashing/writing/flushing/commit, render duration, frame/event/PCM integrity | No formal PCM renderer exists here; missing metrics become instrumentation tasks, never zeros |
| Energy | Service CPU time, wakeups, long tasks, temperature/battery/throttling when reliable | Keep proxies separate; never convert CPU percent to watts; fix power/charging conditions and duration |

Feature-test APIs and prototype capabilities for each run. Experimental `AudioPlaybackStats` defines output underrun/latency statistics. It provides neither root-cause attribution nor Worklet callback execution p99, and the live object's update cadence limits temporal correlation. [MDN definition](https://developer.mozilla.org/en-US/docs/Web/API/AudioPlaybackStats), [Web Audio specification](https://webaudio.github.io/web-audio-api/#AudioPlaybackStats). Unsupported or uncollected values remain NOT MEASURED; never substitute lateEvents or path drops.

Output integrity checks at least finite PCM, unintended silence, discontinuities, clipping, arrivals, tails and source phase. Native underrun counters, digital PCM anomalies, device loopback and human click reports are four separate evidence classes. Crossfades or a muted graph cannot substitute for them.

<!-- english-original-anchor --> <a id="4-未來比較規則"></a>
## 4. Future comparison rules

Freeze baseline/candidate commits, full source/bundle hashes, scene/assets/physics initial state/event sequence, actual sample rate, browser/device/OS/GPU/power mode, viewport/DPR, recording duration and instrumentation. Record requested and observed values and every mismatch.

Preregister warmup and at least five independent short-fixture runs. For research long-run comparisons, preregister at least three identical-load runs, interleaved ordering and cold/warm states. These are future study recommendations, not new formal gates. Do not delete runs, change windows or redefine percentiles after seeing results. R17 and this study differ in code/browser and support only qualified historical comparison, not causal improvement/regression attribution.

Report per-run distributions and sample counts. Distinguish individual-event percentiles, batch-average percentiles and cross-run variation. Include p50/p95/p99/max, and do not force p99 from insufficient samples. Explain inclusion/exclusion of warmup, pauses, safe overload, invalid workload and finish-tail, while retaining all failures.

Assess performance, acoustic quality, interaction latency and data integrity separately. Lower reflection order/source count/path count/update rate changes quality/load and cannot pass an unchanged-load target. Unmeasured proposals describe expected direction without invented acceleration percentages.

<!-- english-original-anchor --> <a id="5-交付檢查"></a>
## 5. Delivery checks

Each receipt contains command, exit, elapsed time, UTC, baseline, actual browser/device, script/adapter/source/bundle hashes, raw locations/hashes, metric/workload judgments, unmeasured items and cleanup. Commit no prototype or full trace. A compact committed receipt must not imply publication of the full raw bundle.

Use existing validate:docs/validate:research/validate:schemas, Wiki lint/test:wiki and validate:english. Create no tests that merely repeat document text, and change no formal snapshots/tolerances/expected values. Independent review checks sources, version boundaries and scope because the static link checker proves neither external claims nor causation.
