<!-- english-source: {"path":"docs/13-performance-review/ACOUSTIC_WORKER_REVIEW.md","sha256":"7aea174c3633dc689070a44588a78cb2229b69e6bf532289cf509c9949d89719","translated_at":"2026-11-01T08:32:24.129Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/ACOUSTIC_WORKER_REVIEW.md`](../../13-performance-review/ACOUSTIC_WORKER_REVIEW.md). Source SHA-256: `7aea174c3633dc689070a44588a78cb2229b69e6bf532289cf509c9949d89719`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="acoustic-worker-與-live-delivery-研究"></a>
# Acoustic Worker and Live Delivery Review

Status: CODE FACT is a static source finding. Every new buffer/scheduler option is **PROPOSED**, with gains **UNMEASURED**. Baseline `05d40fd2d52f4b737f6acac61fa00356403c0038`; dirty R21 work, the old HEAD and public snapshot are not mixed into this baseline. This review changes documentation only, with no product/schema/package/threshold changes and no new benchmark PASS.

<!-- english-original-anchor --> <a id="perf-aco-001現行服務已經有界"></a>
## PERF-ACO-001: The existing service is already bounded

[AcousticService](../../../src/app/acoustic-service.ts) L4–11, 324–491 already implements one in-flight batch and no hidden waiting batch. Calling solve while busy returns `SOLVER_BUSY` and counts a rejection. LabRuntime normally checks busy first, so busy periods do not create a FIFO backlog. [runtime](../../../src/app/runtime.ts) L821–828, 1034–1046. Describing the baseline as submitting every RAF into a Worker queue or lacking backpressure would be inaccurate.

| Layer | Current limit / semantics | Performance meaning and limitation |
| --- | --- | --- |
| Runtime behavior | 16 logical voices, eight per object | Voice caps do not replace engine/emitter/path caps |
| Acoustic input builder | 16 explicit sources, 256 poses; defaults maxPaths=8, maxSurfaces=256, maxSegmentTests=10000 | Rejects complete geometry over budget; stable source/object sorting |
| Service batch | At most 32 sources, surfaces/materials per source ≤256; total requested maxPaths≤256; payload≤2 MiB | App builder16 and service32 are distinct limits, not a contradiction or a measured 32-source product profile |
| Solver | Caller budgets; maxPropagationSeconds default two, shared hard cap five; finite planar first-order geometry | Counts bound work/quality, not wall CPU deadlines; direct/incomplete/unsupported states remain different |
| Worker lifecycle | One Worker/batch; timeout≤5000 ms; cancellation/error terminates and later ensureWorker recreates | Restart has costs; main queues the timer, which cannot interrupt synchronous main work |
| Reply/history | 128 timing samples; full identity/shape/size checks | Response caps bound handler shapes but do not eliminate browser clone costs before the handler |
| Source frames/native graph | AudioEngine independently validates revision/tick/path/voice/frame budgets | Service acceptance is not native admission; native rejection reasons must remain observable |

References: [input](../../../src/app/acoustic-input.ts) L39–135; [service](../../../src/app/acoustic-service.ts) L279–323, 415–491; [solver](../../../src/acoustics/solver.ts) L260–287; [audio control](../../../src/audio/control.ts) L3–49. Formal profiles/targets are maintained only in [Performance Budget](../06-validation/PERFORMANCE_BUDGET.md). Disclose the difference between its 32-surface/eight-source/order≤2 starting profile and current first-order capability rather than claiming second-order support to pass a profile.

<!-- english-original-anchor --> <a id="perf-aco-002現行-live-狀態機"></a>
## PERF-ACO-002: Current live state machine

```text
IDLE
  -> request construction on main
  -> service admission: busy? reject; bounds/bytes/identity valid?
  -> pin scalar identity; submit; start timeout; state IN_FLIGHT
  -> Worker: synchronous serial map(solveAcoustics)
  -> reply arrives on main
       wrong worker/batch/disposed -> ignore late reply
       malformed/solver error/budget/identity mismatch -> reject + terminate
       valid -> clear pending, record timing, resolve promise
  -> runtime epoch/revision gate
  -> runtime age gate (>3 physics ticks -> keep old solutions)
  -> replace published solutions; audio updateFrame; pending voice admission
  -> runtime view publication; coalesced panel delivery
  -> IDLE
```

This does not make service completion and runtime publication one atomic transaction. The service clears pending before resolution, then runtime consumers execute through the promise continuation. Runtime can reject a batch for epoch/revision/age after the service counted it as completed; that is not a transport failure. [service](../../../src/app/acoustic-service.ts) L493–556; [runtime](../../../src/app/runtime.ts) L1042–1075.

**Cancellation/errors.** Cancellation rejects pending and terminates the synchronously running Worker. The next submission recreates it; no mid-compute cancellation-message polling exists. Timeouts and Worker errors also terminate. Late replies are ignored by port/batch identity. Without a factory, such as explicit useWorker:false or unavailable Worker, the service directly runs `requests.map(solveAcoustics)` and returns a resolved Promise. This is not background computation and has neither a pending timer nor an interruptible synchronous fallback. [service](../../../src/app/acoustic-service.ts) L349–383, 444–459, 569–596.

**Pending has several meanings.** Service pending is one transport batch. Runtime pendingAudio retains the original start intent and voice input for native admission after a valid frame. UI pending is a busy status. Panel pendingSnapshot is an overwriteable latest view. These four have different ownership and loss policies, which a generic buffer proposal cannot collapse. [runtime](../../../src/app/runtime.ts) L101–105, 902–918, 1054–1073; [bootstrap](../../../src/app/bootstrap.ts) L242–279.

<!-- english-original-anchor --> <a id="perf-aco-003組裝validation-與結果一致性"></a>
## PERF-ACO-003: Construction, validation and result consistency

Before submission, main already validates scene, builds pose maps, sorts sources/objects, generates box faces and clones materials/atmosphere. The box cache lasts for one build call, and later sources still clone faces. Moving bodies become snapshot dynamicOccluders even when authored as reflectors; the source owner's surfaces are excluded. [acoustic-input](../../../src/app/acoustic-input.ts) L39–135. A Worker does not remove this work.

The service walks a bounded tree, then counts request bytes through JSON.stringify/TextEncoder. Native postMessage has no transfer list. Retaining scalar identity avoids an additional full geometry clone in the service, but does not make transport zero-copy. [service](../../../src/app/acoustic-service.ts) L243–277, 421–435, 483. WHATWG distinguishes cross-realm serialization from transfer. Transferable arrays require explicit representation/ownership changes; Scene/record data still held by other consumers cannot simply be transferred. [HTML structured data](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializewithtransfer), accessed 2026-11-01, Living Standard dated 2026-10-30.

Replies check known keys, plain shapes, dense arrays, finite values, source/listener/sceneRevision/geometryRevision/poseTick, path count, band vectors, model and capabilities. One source error rejects the batch; partial sources cannot silently appear complete. Duplicate request/source IDs are rejected, and replies match identities by request index. Packing cannot remove these safety/domain gates on the assumption that a Worker is trusted. [service](../../../src/app/acoustic-service.ts) L90–240, 279–323, 500–545.

Runtime additionally validates runEpoch/sceneRevision and age>3 ticks. UI calls any poseTick different from latest stale, so an accepted valid 20 Hz result can still display stale. Empty paths, vacuum unsupported, budget failed and stale are distinct; IR or effective reflections cannot be invented. [runtime](../../../src/app/runtime.ts) L1042–1053, 2300–2321; [solver](../../../src/acoustics/solver.ts) L328–383, 516–521.

<!-- english-original-anchor --> <a id="perf-aco-004真正的求解成本邊界"></a>
## PERF-ACO-004: Actual solver cost boundaries

For each source, the solver prepares, copies and sorts surfaces and constructs a material map. Surface validation includes checks between vertices. Direct tracing scans surfaces; each static reflection candidate may trace two segments, each scanning surfaces again. maxSegmentTests bounds ray/surface tests, not all validation or path sorting costs. maxPaths truncates only after candidate generation and ranking by direct-first, energy, then stable ID. Reducing maxPaths therefore does not promise proportional compute savings. [solver](../../../src/acoustics/solver.ts) L60–140, 279–297, 417–511; [geometry](../../../src/acoustics/geometry.ts) L39–77.

These are source facts about complexity and allocation, **not** a measured claim that quadratic work is the bottleneck. Candidate studies include pinned topology/material epochs with dynamic pose packets, Worker prepared-geometry caching, typed packets/transfer pools, broad-phase/BVH, segmented solving and cancellation boundaries. Every candidate needs reference comparisons for the same finite-polygon visibility, surface/source ownership, stale geometry, canonical path IDs and budget/quality results. Do not first change formulas or hide performance through budget changes. Current geometryRevision equals sceneRevision and alone cannot key world-space geometry for moving occluders. Cache immutable local geometry and rebuild world surfaces by poseTick/actual pose, or key the full transformed content. See the [Worker Communication proposal](proposals/ADR-PERF-04-worker-communication.md) and [Measurement Plan](MEASUREMENT_PLAN.md).

<!-- english-original-anchor --> <a id="perf-aco-005單-in-flight-與-triple-buffering-的選項"></a>
## PERF-ACO-005: Single in-flight versus triple-buffer options

Three slots must specify whether they mean three owned data slots or admission/inflight/pending/publication roles. A current pending batch plus published solutions is not an implemented triple buffer.

| Option: PROPOSED | Admission / pending / publication | Possible benefit to measure | Costs / required semantics |
| --- | --- | --- | --- |
| A Retain single-flight baseline and instrument stages | Sample only while idle; no waiting; publish valid fresh replies | Smallest change and clear baseline | Does not remove synchronous capture CPU; lag/rejection needs age histograms |
| B Single flight plus one latest unsent descriptor | Replace only unsent descriptor while busy; after completion sample latest valid state; publication retained separately | May reduce idle gaps or old inputs | Decide whether descriptor owns an immutable snapshot or only a latest pointer; a pointer does not preserve past ticks and cannot serve recording; record sample timing and bytes |
| C Three-slot transferable input/output pool | FREE→WRITING→READY→READING→FREE, explicit ACK; newest READY may replace older READY, never READING | May reduce allocation/copying and stabilize memory | Three slots do not guarantee throughput; capacity, detach/version/epoch/error reclamation required; cannot recycle while published consumers hold data |
| D SAB / Atomics mailbox | Published sequence, length/capacity, ownership states; reader never waits for producer | May avoid some clones | COOP/COEP/asset compatibility, security and memory model; audio rendering must not wait on locks; availability unproven |
| E Multiple Worker pool | Bounded workers/batches, source partition and publication barrier | May increase large-batch throughput | Contention/startup/memory and merged result age; 16 voices and nominal 20 Hz do not automatically justify these costs |
| F Bounded recording FIFO | Immutable per-tick input, item/byte caps, ACK advances commit watermark, producer pauses when full | Preserves experimental data while moving capture evaluation | **Not a live latest-state mailbox**; cannot overwrite unprocessed ticks; finalize drain/crash/retry must preserve comparability |

Three slots address ownership when writers cannot modify reader-held memory. If compute per tick, geometry reconstruction or native graph work dominates, adding slots does not guarantee improvement. Compare A/B/C with identical payloads/scenes and total end-to-end cost, not only postMessage duration. Show the complete clone/transfer-detach/borrowed published-frame lifecycle, including old-epoch late replies. [Buffer Architecture](BUFFER_ARCHITECTURE_REVIEW.md), [Memory Review](MEMORY_AND_RESOURCE_REVIEW.md).

<!-- english-original-anchor --> <a id="perf-aco-006不可混為一談的-recording-路徑"></a>
## PERF-ACO-006: The distinct recording path

Recording onTick directly solves synchronously, splitting sources in groups of 16 and immediately mapping each group. It does not use the single-batch AcousticService gate and does not yield. Active voices plus diagnostic events such as current-tick stops can require multiple groups. Grouping meets the builder's source API bound; it is not asynchronous batching. appendFrame then validates and freezes the complete canonical snapshot. [runtime](../../../src/app/runtime.ts) L935–978. A dedicated Worker seals stopped recordings in a separate stage. Sealing tests cannot establish nonblocking capture. [Recording/Rendering](RECORDING_AND_RENDERING_REVIEW.md).

Late live frames may be discarded; recorded ticks, original event order, behavior decisions and emission/cursors cannot be skipped because the consumer is busy. A future recording-evaluation lane needs a separate proposal for maximum bytes/items, producer pause, ready/committed watermarks, sealing barriers, failure recovery and hash equivalence. Do not replace the live single-flight service with a lossless FIFO that accumulates obsolete geometry between main and audio. Do not replace recording with latest-only delivery either.

<!-- english-original-anchor --> <a id="perf-aco-007telemetry範圍與後續驗收"></a>
## PERF-ACO-007: Telemetry scope and future verification

The service already reports request/response bytes, pending age, submitted/completed/failed/cancelled/timeout/busy/budget/late/restart counters, and round-trip/worker-compute/delivery p95 over a 128-entry timing ring. [service](../../../src/app/acoustic-service.ts) L386–413, 565–567. Round-trip begins after request checking/encoding; worker compute spans handler entry to just before response postMessage, excluding reply serialization/send; delivery spans receive to before resolve, excluding application audio/UI consumers. Runtime age rejection happens after service completion accounting. Consumer accept/reject counters are proposed, not implemented here.

Future minimum fixtures: submit while busy, oversized payload early rejection, malformed/sparse/reordered/wrong-revision replies, partial source errors, cancellation/timeout/crash/restart, old-port late reply, reply after pause, authoring/epoch changes, the three-tick boundary, native admission failure, rapid birth/death and disposal in flight. Reuse [existing service fixtures](../../../tests/app/acoustic-service.test.ts) and preserve references/tolerances. Separate performance fixtures cover source×surface×band×path loads, capture on/off, overload, dynamic/static geometry, payload bytes, GC and consumer durations. Keep functional passes separate from performance profiles and retain existing thresholds. [Measurement Plan](MEASUREMENT_PLAN.md).
