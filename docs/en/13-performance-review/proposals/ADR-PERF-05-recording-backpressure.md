<!-- english-source: {"path":"docs/13-performance-review/proposals/ADR-PERF-05-recording-backpressure.md","sha256":"2fabee246577c9f98892aa7de399fcfe349f8a74c5672308d51b2af665af9e67","translated_at":"2026-11-01T08:32:24.285Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/proposals/ADR-PERF-05-recording-backpressure.md`](../../../13-performance-review/proposals/ADR-PERF-05-recording-backpressure.md). Source SHA-256: `2fabee246577c9f98892aa7de399fcfe349f8a74c5672308d51b2af665af9e67`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-05錄製無損反壓與連續-tick-提交"></a>
# ADR-PERF-05: Lossless Recording Backpressure and Contiguous Tick Commit

- Status: **PROPOSED / not adopted**; 2026-11-01. No recorder migration, artifact-format change, or OPFS addition.
- Code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`; candidate lanes/new performance and recovery tests are **NOT RUN**.
- Basis: [ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md), [record/replay contract](../../07-experiments/RECORD_REPLAY.md), [Recording Review](../RECORDING_AND_RENDERING_REVIEW.md), and [Clock Review](../CLOCK_AND_SCHEDULING_REVIEW.md).

<!-- english-original-anchor --> <a id="問題與不可回退的語義"></a>
## Problem and Semantics That Must Be Preserved

At baseline lines 933–977, `onTick` in [src/app/runtime.ts](../../../../src/app/runtime.ts) gathers active voices and same-tick events. Line 945 synchronously calls `solveAcoustics` in batches of 16 sources; append follows at line 951. The ordinary live acoustic Worker does not remove this main-thread hot path. `appendFrame` also takes an owned clone, validates, and counts bytes; the sealing Worker operates later.

[FixedClock](../../../../src/physics/fixed-clock.ts) already distinguishes interactive wall-debt discard after at most four catch-up steps from recording overload pause/debt retention. The candidate does not introduce a no-dropped-recording-tick policy; it makes bounded admission of per-tick capture/evaluation/encoding measurable and controllable. Recording traces cannot use latest-only replacement, overwrite rings, or later interpolation to fabricate ticks.

<!-- english-original-anchor --> <a id="候選決策"></a>
## Candidate Decision

Profile the synchronous baseline first, then spike an ordered recorded-evaluation lane separate from interactive preview. Immutable tick inputs contain run/scene identity, poses/listener, normalized events/sequences, Behavior pre/post state, instance decisions, source cursors, and acoustic inputs. Every tick that must be retained receives corresponding results. Lower solver quality, recomputed admission, or fewer recorded sources cannot be used to achieve throughput.

The candidate producer reserves frame slots and bytes before each authoritative tick, then steps/captures/enqueues. If a safe next-tick upper bound cannot be reserved, pause first or explicitly design a safe rejection policy separately. If capture still fails after the world advances, do not claim automatic rollback: retain only the completely admitted contiguous prefix, mark interruption/incompletion, and preserve the original error.

| Watermark | Exact meaning |
| --- | --- |
| Accepted | The tick snapshot is validated with ownership/capacity; later overwrite is forbidden. |
| Evaluated | Required same-tick acoustics/Behavior work is complete; missing work cannot advance this mark. |
| Persisted | The corresponding storage transaction completed; this is not backup/power-loss assurance. |
| Published | Final counts/hashes/range/versions are verified before a complete manifest/artifact becomes visible. |

A conceptual chunk descriptor is `runId, runEpoch, sceneRevision, startTick, endTick, sequence, frameCount, payloadBytes, ownershipGeneration, contentHash`. Tick ranges are contiguous; event order, body IDs, listener, original phase, and provenance remain unchanged. A chunk digest is not the current canonical artifact fingerprint.

<!-- english-original-anchor --> <a id="容量時鐘與滿載"></a>
## Capacity, Clocks, and Saturation

Bound queued frames, queued bytes, maximum chunk tick span, evaluation jobs, resident snapshot bytes, storage bytes, and final-output bytes separately. A limit on chunk count cannot allow arbitrarily large chunks. Existing recorder hard caps are 18,000 frames, 64 MiB trace, 256 objects, 100,000 unique events, and 2,048 events/frame. These are neither new queue capacities nor total-heap guarantees.

Derive high/low watermarks from measured peak frame size, service time, and memory headroom under the same load. Pause before reaching a boundary where the next admitted tick cannot be retained. Explicitly resume only after consumer acknowledgment below the low watermark; no unbounded growth. Backpressure extends wall duration without inserting wall-clock silence into the recording timeline. Integer physics ticks remain authoritative. Audio pause/resume may change the scheduling epoch without changing the take's trace identity or re-emitting already heard events.

Interactive preview may display only the latest complete snapshot, independently of the lossless queue retaining every tick. UI shows waiting/reason/admitted and processed ticks so that a frozen preview is not mistaken for successful recording. Seek/replay/new recording cannot reuse an old pending generation.

<!-- english-original-anchor --> <a id="stopcancelquota-與-crash"></a>
## Stop, Cancel, Quota, and Crash

Stop first closes admission, fixes the last accepted tick, drains all admitted results, verifies the contiguous range, and then uses existing seal/verify/publication. Cancel invalidates the operation generation; old replies release resources without publication. Repeated stop shares the same finalization result. Failure retains the reason and last watermark; partial output cannot be marked Captured, and the previous valid artifact survives.

If chunk storage is adopted later, write immutable chunks/hashes before publishing the final manifest. Quota, timeout, Worker crash, and tab discard require reopened state to distinguish complete/interrupted work; valid recordings cannot be silently deleted. There is no existing cross-API atomic transaction between OPFS and IndexedDB. Format, migration, flush, and orphan recovery require a separate implementation decision. Existing independent sealing/prepared-save verification cannot be omitted merely because the same Worker handled the data.

<!-- english-original-anchor --> <a id="替代採納與回復"></a>
## Alternatives, Adoption, and Rollback

Synchronous capture plus current pause/debt handling is the baseline. Reducing repeated snapshot/encoding work may be smaller than Worker migration. Separate evaluation Workers and evaluation within the simulation lane both have serialization/CPU-contention/head-of-line-blocking costs. Average faster-than-real-time service after separation does not guarantee every tick deadline. Persistent streaming may lower memory but needs compatibility, quota, and crash evidence; it is not adopted here.

Under the [Measurement Plan](../MEASUREMENT_PLAN.md), measure tick capture/solver/append, sealing, save/load, and replay separately. Report wall/simulated seconds, queue bytes/frames, all watermarks, tick debt, pause duration, peak memory, and completion state. Require trace/events/phase/hash equivalence for identical fixed input. Inject slow consumers, saturation, pause/resume, stop with queued work, cancel/restart, quota, Worker crash, and malformed/duplicate/gapped chunks. Original formal performance load and thresholds remain unchanged.

Adopt and freeze capacity only after boundedness, completeness, and recovery pass and measurements improve the original bottleneck/long tasks. Roll back to synchronous per-tick capture, FixedClock recording pause, and the current artifact format. Discard unpublished candidate staging; do not splice it into the original take or overwrite an old valid recording.
