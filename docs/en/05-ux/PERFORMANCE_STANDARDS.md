<!-- english-source: {"path":"docs/05-ux/PERFORMANCE_STANDARDS.md","sha256":"2038370a55e7142d5a299bff7796c89b7b61822d842f3447fecb8dc32e50f569","translated_at":"2026-10-27T03:38:57Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/PERFORMANCE_STANDARDS.md`](../../05-ux/PERFORMANCE_STANDARDS.md). Source SHA-256: `2038370a55e7142d5a299bff7796c89b7b61822d842f3447fecb8dc32e50f569`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ui-與-runtime-效能規範"></a>
# UI and Runtime Performance Standards

Updated: 2026-10-26. Status: **Measurement standards and supplementary proposals; formal UI, browser profiles, device audio, and end-to-end performance tests are all NOT RUN**. The sole authority for product numerical budgets is [PERFORMANCE_BUDGET.md](../06-validation/PERFORMANCE_BUDGET.md); this document maintains six separate measurement boundaries, evidence requirements, and supplementary UI proposals, without independently changing existing thresholds. The [architecture](../02-architecture/ARCHITECTURE.md), [audio timing contract](../02-architecture/AUDIO_RUNTIME.md), and [physics fixed timestep](../04-physics/PHYSICS_ARCHITECTURE.md) retain their respective responsibilities. Node kernel benchmarks, native SDK smoke tests, and UI document reviews cannot substitute for the results below.

<!-- english-original-anchor --> <a id="量測配置先於門檻"></a>
## Measurement Configurations Before Thresholds

First establish replayable synthetic scenes with hashes and fixed action sequences, then measure them on specified hardware. Each report must retain the OS, CPU, RAM, GPU/driver, display refresh rate, CSS viewport, DPR, zoom, full browser version, power mode, build/dependency versions, scene/material/motion hashes, source/listener counts, dynamic/fixed body counts, contact count, visible/total path counts, audio device, sample rate, actual block size, and voice count. Fill in UNKNOWN when GPU/device information is unavailable; do not reuse an earlier CPU record to claim that the complete hardware configuration was tested.

Initial `desktop-60` measurement configuration proposal: 1920×1080 CSS px, DPR 1, 100% zoom, target presentation at 60 Hz; a static room + 100 dynamic primitives, one continuous source/listener, up to 64 displayed paths, and 16 contact voices. These counts are test inputs and candidate caps, **not implemented capacity guarantees or final product limits**. Also test DPR 2/200% zoom, 1000 objects, 10000 paths, and a collision storm; stress configurations do not receive the smoothness guarantee of the normal configuration, but must degrade safely, support pausing, and retain data. If the implementation uses different voice/path caps, the report must identify them and reassess the budget.

The current Scene/AcousticFrame schemas have limits of 256 objects/256 paths per frame, respectively; 1000/10000 are configurations for testing rejection beyond the limit or an isolated presentation-only adapter, and cannot be used as valid runtime inputs. See [stress-test boundaries](UI_STRESS_TESTS.md). Performance proposals do not change existing domain caps.

Record cold starts separately for each configuration; after warmup, measure according to the formal budget requirements (the current UI profile is 10 min). State the run count and warmup time in the report, and retain raw samples from each run and p50/p95/p99/max/exceedance counts, rather than reporting only averages. Short exploratory samples must be labeled smoke and cannot replace a formal profile. Record whether DevTools, screen capture, and CPU throttling are enabled and how they interfere with measurement; list simulated slowdown configurations separately, without presenting them as real low-end hardware. When the display refresh rate exceeds 60 Hz, list `desktop-native-refresh` results separately; do not insist that 60 updates per second achieve 144 Hz presentation.

<!-- english-original-anchor --> <a id="六種預算各自判定"></a>
## Assess the Six Budgets Separately

The IDs below are measurement categories; existing thresholds and baseline scenarios only reference the corresponding rows of the formal budget table. `desktop-60` is a supplementary configuration for combined UI workloads; passing a smaller scene cannot replace the formal physics profiles for 256 primitives/CCD/contact flood or the acoustic worker's formal multi-source profile. New UI latency thresholds remain **PROPOSED** and can only be adopted after the first browser spike; if adopted, merge them into the formal budget table and index them here. Time budgets are not a single pipeline whose durations can be added arbitrarily; main-thread work competes for resources, while workers and audio have their own deadlines.

| ID/scope | Authoritative clock and measurement boundary | Threshold source/supplementary proposal | Handling and interpreting exceedances |
| --- | --- | --- | --- |
| `PERF-VIEW` Viewport Frame Rate | Differences between `requestAnimationFrame` timestamps and main render update CPU duration; record GPU timing separately when available, without treating rAF intervals as pure GPU cost | The “3D interaction/UI” row in the formal budget; also report tail quantiles of frame intervals, the fraction exceeding the frame deadline, and the highest consecutive dropped-frame count, rather than only average FPS | First stop decorative motion and reduce displayed paths/render resolution; retain displayed/total counts and degradation labels; do not change solver results or physics dt to improve reported FPS |
| `PERF-MAIN` Main Thread Blocking | User Timing for handlers/transactions/DOM updates; supplement with a Long Tasks observer for tasks ≥50 ms when supported, and use browser traces separately to inspect layout/paint/GC | The own main-thread work in the “3D interaction/UI” row and the “acoustic main-thread delivery” row in the formal budget; report long-task counts and causes separately, and record initialization separately | Split bounded work, move geometry off the main thread, and batch layout reads and writes; if the Long Tasks API is unsupported, enter NOT AVAILABLE and measure using traces, rather than entering zero |
| `PERF-PHYSICS` Physics Step Duration | Wrap one `world.step` with a monotonic duration measurement; account separately for input/grab queries, contact copying, recording, and total fixed-tick cost; logical tick remains `tick * fixedDt` | The “physics” row in the formal budget and its specified primitive/CCD/contact profiles; also report total fixed-tick cost, backlog, and catch-up counts, rather than measuring only world.step and hiding bridge cost | Follow the existing four-step catch-up contract; pause recording/A/B on overload and retain the backlog without omitting ticks; only non-recording exploratory mode may explicitly discard wall-time and record the event; do not increase dt and thereby substitute different results |
| `PERF-SOLVER` Acoustic Solver Update Cost | Solve CPU duration inside the worker; separately measure queue wait, snapshot age, serialization/transfer, and publication latency; include scene revision/poseTick/job ID | The “acoustic worker” and “acoustic main-thread delivery” rows in the formal budget; the update-frequency range allowed by the architecture does not mean that the formal profile passes, and UI standards must not independently relax solve duration | Cancel superseded jobs, bound the queue, retain the latest valid frame, and label stale/age; only reduce explicitly stated capabilities or update frequency, without treating an old revision as new data; audio does not wait for the worker |
| `PERF-AUDIO` Audio Processing Deadline | Audio render quantum; `deadlineMs = actualFrames / actualSampleRate * 1000`. Calculate total cost for the entire render graph/all worklets, including the worst-case IR dual-bank crossfade configuration | The “audio render” row in the formal budget applies to its benchmark configuration; list other quantum/sample-rate configurations separately, with max strictly below the actual deadline, without relaxing the existing benchmark threshold. Also record underruns/dropouts during testing; without measurement, do not claim glitch-free operation | 128 frames/48 kHz is only a 2.667 ms worked example; do not hard-code 128 or substitute 16.7 ms. Separate continuous/contact voice pools; when the cap is exceeded, apply bounded degradation with a stable priority order and display dropped voices. If reliable aggregate timing/underrun visibility is unavailable, mark the corresponding items UNVERIFIED; do not infer PASS from smooth visuals or a single callback |
| `PERF-UI` UI Interaction Latency | Input-dispatch→presented visual feedback for a replayable action ID; separate this from completion of async work. Record browser Event Timing/trace support and estimation error | First effective feedback for selection, shortcuts, Inspector commits, and palette typing: p95 ≤50 ms, p99 ≤100 ms; Run/async commands show pending within the same budget, with completion time reported separately | Accept input without waiting for an animation to end; preserve focus and text and allow cancellation; without a paint timestamp, markers before and after rAF may only be labeled a proxy, not actual input-to-display latency |

50 ms is the platform classification boundary for Long Tasks, not a project standard that permits every operation to block for 49 ms. rAF presentation, DOM UI micro-interactions, fixed physics ticks, acoustic updates, the audio sample clock, and AI/network job completion times are all separate; AI jobs only use non-real-time bounded timeouts/cancellation and budgets, and cannot drive audio deadlines. UI latency is a measurement metric, and cannot serve as another physics timeline either.

Audio timing telemetry must be preallocated, bounded, and low-interference, with batch reads outside the callback; the callback must not `await`, fetch, perform geometry/physics, write per-block logs, or allocate unbounded arrays. If the measurement method changes thread behavior, first report its overhead/limitations. Use the same input for offline DSP correctness checks, then check deadlines/continuity using the actual graph, device, and recordings; keep the two kinds of evidence separate. Schedule source emission + propagation delay only once; do not subtract the visual animation duration from the sound arrival time to “correct” synchronization.

<!-- english-original-anchor --> <a id="複合工作與退化規則"></a>
## Combined Workloads and Degradation Rules

Tests must include simultaneous grabbing + collision events + Inspector opening/closing + path updates + Raw/Simulated crossfading; also test IR dual banks, solver timeouts, interruption of continuous gestures, and opening the AI palette. React panels must not rebuild the whole tree on every physics tick; UI numbers may refresh less frequently, but must retain their poseTick and original measured values. Table virtualization or path culling must not change stable IDs, selection identity, recorded events, or output data.

First reduce decoration and presentation work, then limit voices/paths according to a visible budget; degradation requires a reason, counts, recovery conditions, and exportable records. Pause recording overload according to [RECORD_REPLAY](../07-experiments/RECORD_REPLAY.md); resumption must be explicit and preserve logical tick, source offsets, pending arrivals, and event cursor. Switching Workspaces does not Reset, Mute does not stop solving, and the Paused tail policy follows Freeze-and-fade in [Workspace](WORKSPACE_ARCHITECTURE.md).

<!-- english-original-anchor --> <a id="結果與完成證據"></a>
## Results and Completion Evidence

Reports must include at least the fields below; use `null`/`NOT RUN` for unmeasured values, rather than disguising them as a measured duration of zero. Dated files under `benchmarks/results/`, indexed by the experiment manifest, are recommended; latest may be generated separately, but the original evidence must not be overwritten.

```json
{
  "scenarioId": "desktop-60-grab-collision-panels",
  "status": "NOT RUN",
  "gitRevision": null,
  "dirtyPathsSha256": null,
  "environmentArtifact": null,
  "sceneSha256": null,
  "motionSha256": null,
  "sampleRateHz": null,
  "actualBlockFrames": null,
  "warmupSeconds": 10,
  "sampleSeconds": 600,
  "runs": 3,
  "metrics": [],
  "rawSamplesArtifact": null,
  "traceArtifact": null,
  "dropoutEvidence": null,
  "limitations": ["尚無正式產品 UI／audio graph"]
}
```

For each metric, record ID, measurement method, scope, count, unit, p50/p95/p99/max, threshold, exceedanceCount, and PASS/FAIL/UNVERIFIED. A test may have some items PASS; passing acoustic V1 or visible controls does not promote V2/V4/V5. When first adopting hardware thresholds or changing acoustic quality or latency policies, update the formal PERFORMANCE_BUDGET, relevant ADR/design decisions, and Wiki index; proposals in this document cannot be promoted to measured performance based solely on static lint.

<!-- english-original-anchor --> <a id="官方量測依據"></a>
## Official Measurement References

The following were checked on 2026-10-26 and only support platform mechanisms; the numerical budgets are proposed by this project:

- [AudioWorkletProcessor.process](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process): obtain block length from the actual sample arrays; do not assume a fixed size.
- [PerformanceLongTaskTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming): the ≥50 ms classification and compatibility limitations.
- [Performance.measure](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure): named time intervals, usable in workers; cross-thread durations and end-to-end age still require explicit epoch/message correlation.
- [High-performance CSS animations](https://web.dev/articles/animations-guide): prioritize `transform`/`opacity` and use traces to inspect layout/paint; `will-change` requires measurement and must not remain enabled globally.

See [UI_STRESS_TESTS](UI_STRESS_TESTS.md) for complete interaction stress cases; [DESIGN_SYSTEM](DESIGN_SYSTEM.md) is the formal entry point for visual tokens and motion.
