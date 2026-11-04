<!-- english-source: {"path":"docs/13-performance-review/proposals/ADR-PERF-02-realtime-audio-scheduling.md","sha256":"e37d2ed833754175895e7c327787909f9f35a11936c5c320ff29aa881d7fb771","translated_at":"2026-11-01T08:32:24.275Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/proposals/ADR-PERF-02-realtime-audio-scheduling.md`](../../../13-performance-review/proposals/ADR-PERF-02-realtime-audio-scheduling.md). Source SHA-256: `e37d2ed833754175895e7c327787909f9f35a11936c5c320ff29aa881d7fb771`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-02即時音訊排程與有界發聲視窗"></a>
# ADR-PERF-02: Real-time Audio Scheduling and a Bounded Emission Window

- Status: **PROPOSED / not adopted**; 2026-11-01. No current clock policy, runtime, or fixed acceptance criterion is rewritten.
- Code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`; new scheduling candidates and listening tests are **NOT RUN**.
- Continues the [audio runtime contract](../../02-architecture/AUDIO_RUNTIME.md) and [ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md); compare the [Clock Review](../CLOCK_AND_SCHEDULING_REVIEW.md) and [DSP Review](../AUDIO_GRAPH_DSP_REVIEW.md).

<!-- english-original-anchor --> <a id="問題與現況"></a>
## Problem and Current Behavior

`setEpoch` in [src/audio/engine.ts](../../../../src/audio/engine.ts) establishes the simulation/AudioContext mapping. `startVoice` derives the requested time from logical emission, counts lateness, and starts at `max(currentTime, requested)`. [PathRoute](../../../../src/audio/routes.ts) applies absolute propagation delay once. Pause/resume already retains frozen voices/unarrived arrivals and reanchors the epoch. Scheduling exists, and clocks do not all share wall time.

RAF currently supplies physics, while the main control layer creates AudioNodes and submits parameters. Neither the fixed step nor the native audio rendering thread guarantees early delivery of events. Increasing lookahead also adds action-to-sound latency and cannot predict collisions that have not occurred. Newer dirty R21 observations of 60/80/120 ms onset lookahead and target suppression are separate observations outside this commit; these candidates cannot be described as absent or proven improvements.

<!-- english-original-anchor --> <a id="候選決策"></a>
## Candidate Decision

First measure event emission → host dispatch → native scheduling → observable output and the reasons for lateness. Then compare retaining current behavior, a finite scheduling horizon, and reducing control-thread work. Evaluate a Worklet separately only for necessary custom DSP. No lookahead value is selected here.

| Timebase | Candidate responsibility |
| --- | --- |
| Wall clock | Measure duration, timeouts, and user-action latency only; never replace simulation time. |
| Render frame | Read completed snapshots and submit input; never determine sample offsets. |
| Physics fixed tick | Determine motion/contact/logical-emission ordering. |
| Acoustic snapshot tick | Identify the poseTick used for parameters, separately from emission tick. |
| AudioContext clock | Execute native starts/ramps/delays in real time, with an explicit epoch. |
| Recording timeline | Retain integer ticks/event cursors/content phase, without wall-pause gaps. |
| Offline render sample timeline | Reserved only in types-only `RenderClockMapping`; no formal renderer exists, so this is not current scheduling capability. |

A candidate scheduler accepts only existing, validated emissions carrying an epoch. Report the control horizon in AudioContext seconds and output sample frames separately. Physical d/c, FIR group delay, control lookahead, DSP block latency, and device latency cannot be collapsed into one audio-latency value. A fixed lookahead does not guarantee no late events.

A conceptual event record is `runEpoch, scheduleGeneration, instanceId, eventSequence, emissionTick, emissionTimeS, sourceId, frameRevision, requestedAudioTimeS, admissionResult`. One emission signal feeds direct/early/late; reflections do not add direct delay again. Continuous and contact one-shots have separate pool responsibilities; asset/seed/playhead identity is retained. A stopped AudioBufferSourceNode cannot be reused for another start, whereas decoded assets can be reused.

<!-- english-original-anchor --> <a id="有界接納晚到與生命週期"></a>
## Bounded Admission, Lateness, and Lifecycle

Bound the scheduling window separately by admitted-event count, future seconds, active/retiring voices, paths, and bytes. Existing `maxPendingEvents` and voice/path limits are the baseline. Derive new horizon/capacity values from same-load bursts and pause-boundary measurements. Explicitly reject and report saturation; never erase the recorder's original emission. Without a valid frame, retain the existing explicit unavailable/pending policy rather than creating a fake direct frame for catch-up playback.

Each experiment fixes its late policy. A candidate may retain immediate catch-up with a late counter or, after separate validation, explicitly drop by age; it cannot silently change experimental content with machine speed. Pause cancels native schedules from the old generation and freezes source cursors/unarrived logical arrivals. Resume only reanchors the AudioContext scheduling epoch/scheduleGeneration and reschedules remaining arrivals once, preserving the same take runEpoch, logical tick, and source identity. Seek/reset/scene commit/dispose invalidate old schedules/callbacks. Audition has a separate clock and is excluded from metrics. Timers do not guarantee playback through background freeze.

If a Worklet is adopted later, its callback performs bounded DSP using actual block lengths and preallocated state, without fetch/await/geometry/physics/logging or waiting for queues. A future PCM ring separately specifies frames/channels/layout, fill target, silence/fade underflow policy, overflow rejection, epoch flush, and actual added latency. The current native graph does not need an invented ring.

<!-- english-original-anchor --> <a id="替代風險與採納門檻"></a>
## Alternatives, Risks, and Adoption Gate

Retaining native scheduling and current late policy has the lowest cost; preparing assets/routes earlier may help more than a longer horizon. Known recorded events can be scheduled ahead, but that method cannot be directly applied to unknown live contacts. Replacing all DSP expands HRTF/convolution/browser differences, callback-deadline obligations, and maintenance risk, requiring an independent equivalence oracle. Control/render separation and scheduled-source semantics are defined in the [fixed 2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioScheduledSourceNode); an API definition does not establish product deadline compliance.

Under the [Measurement Plan](../MEASUREMENT_PLAN.md), use the same trace for cold/warm starts, bursts, main stalls, pause/resume, seek, and rate changes. Measure scheduled/observable actual time, late age, duplicates, drop reasons, PCM arrivals, and discontinuities. Device latency/headphone perception require separate evidence; a muted graph is insufficient. Adopt only with reduced lateness/control cost under original load/quality, no unacceptable additional action latency, and passing epoch/phase/single-propagation regressions. Freeze allowable latency/error in the implementation task rather than inventing them in research.

Rollback cancels the candidate schedule generation, fades at the existing interrupted boundary, and reanchors before returning to current `startVoice`/native routes. It does not rewrite recording content or emit old-epoch events again.
