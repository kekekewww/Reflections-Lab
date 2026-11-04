<!-- english-source: {"path":"docs/13-performance-review/proposals/ADR-PERF-04-worker-communication.md","sha256":"424f373204e325114a5dca2e2fad9822ccec608e23c657ea6cae06e6814623be","translated_at":"2026-11-01T08:32:24.282Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/proposals/ADR-PERF-04-worker-communication.md`](../../../13-performance-review/proposals/ADR-PERF-04-worker-communication.md). Source SHA-256: `424f373204e325114a5dca2e2fad9822ccec608e23c657ea6cae06e6814623be`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-04worker-通訊控制平面與有界資料平面"></a>
# ADR-PERF-04: Worker Communication, Control Plane, and Bounded Data Plane

- Status: **PROPOSED / not adopted**; 2026-11-01. No physics worker, SAB, Worklet, or wholesale migration is adopted.
- Code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`; new transport/worker benchmarks are **NOT RUN**.
- Basis: [ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md), [Current Runtime Audit](../CURRENT_RUNTIME_AUDIT.md), [Acoustic Worker Review](../ACOUSTIC_WORKER_REVIEW.md), and [Browser Boundaries](../BROWSER_CLOUD_SCALABILITY.md).

<!-- english-original-anchor --> <a id="問題與當前界線"></a>
## Problem and Current Boundaries

[acoustic-service.ts](../../../../src/app/acoustic-service.ts) already has a native module Worker, single in-flight batch, payload/path/source caps, timeout, exact identity validation, and termination after cancellation. [recording-worker-client.ts](../../../../src/experiments/recording-worker-client.ts) also has a dedicated sealing Worker and transfers returned bytes. This does not put physics, the per-tick capture solver, or receiver parsing/freezing in the background.

RAF in [bootstrap.ts](../../../../src/app/bootstrap.ts) still calls main-thread `advance`. The recording branch of `onTick` in [runtime.ts](../../../../src/app/runtime.ts) directly calls synchronous `solveAcoustics`. Before adding Workers, separate the cost of main-thread production, message serialization, Worker compute, dispatch, receiver validation, and consumption instead of looking only at Worker round-trip time.

<!-- english-original-anchor --> <a id="候選決策與遷移次序"></a>
## Candidate Decision and Migration Order

First retain existing client-first lanes and spike geometry caching/packets on current acoustic requests. Dynamic world surfaces cannot be cached by geometryRevision alone; rebuild them or key exact pose content under the [Snapshot Proposal](ADR-PERF-01-acoustic-snapshot-exchange.md). Adopt a dedicated simulation/recorded-evaluation Worker separately only when profiling identifies main-thread physics or capture occupancy as a bottleneck and complete semantics are reproducible. Do not rename a seal Worker into a simulation Worker.

1. The control plane carries small, bounded commands/acknowledgments/cancellation/errors with `protocolVersion, runId, runEpoch, sequence, expectedSceneRevision`. For input intents crossing ticks, define target tick and actual admitted tick. Preserve revision checks, atomic commands, undo, and stable domain IDs. Reject unresolved references; do not transfer engine objects/Rapier handles.
2. The data plane carries immutable complete snapshots or bounded chunks. Descriptors contain tick range, geometry revision, byteLength, layout version, and ownership generation. Validate bounds/layout/identity before receipt; transfer pools follow the [Ownership Proposal](ADR-PERF-03-buffer-ownership-lifecycle.md).
3. Interactive pose/path preview retains the latest completed result; old unsubmitted poses can be coalesced. Recorded events/evaluation/trace use a separate ordered lossless lane and cannot share latest-only mailbox semantics. Measure fairness and batch cost; lengthy sealing must not block interactive control.
4. In a simulation-Worker experiment, Rapier creation/stepping/event normalization/Behavior ownership remain in one lane. Main submits intents and reads completed snapshots/interpolation. OS scheduling still affects Workers; an independent timer does not guarantee real-time 60 Hz. The acknowledged tick for cancellation/safe pause must be visible.
5. Main retains DOM/Pointer Lock/IME/R3F and native AudioNode control. Audio rendering never waits for a Worker. AI/network/storage cannot become audio-callback dependencies.

<!-- english-original-anchor --> <a id="容量取消與復原"></a>
## Capacity, Cancellation, and Recovery

Bound each lane independently by in-flight jobs, commands, snapshot/chunk slots, bytes, tick span, and timeout. Existing acoustic single-batch limits such as 32 sources/256 paths/2 MiB remain the baseline and do not imply a new simulation-queue capacity. Select new values from residency, bursts, and original formal budgets under the [Measurement Plan](../MEASUREMENT_PLAN.md), then record them in a separate adoption task.

Explicitly accept or reject busy control commands; never silently drop a scene transaction. Count superseded interactive previews. A lossless producer reserves capacity before admission and pauses rather than overwriting accepted work. Publish only when `epoch, sequence, revision, tick` all match. Received, processed, and persisted acknowledgments are different claims.

Cancellation first invalidates the generation and stops new admission. A Worker may be terminated when noninterruptible compute needs prompt termination. Termination is not successful saving: retain diagnostics for accepted ticks, unfinished buffers, and the last watermark. Ignore old-port/old-generation replies; they cannot revive a run. After a crash, mark interrupted unless a verified snapshot/trace supports recovery; automatically generating different motion is not the same take.

<!-- english-original-anchor --> <a id="替代與風險"></a>
## Alternatives and Risks

Main-thread physics plus component-level optimization is a valid control; structured cloning is simpler for compatibility. Transferables may reduce particular payload copies, while dispatch/validation remain. Propose SAB only if transfer remains a measured bottleneck and deployment isolation is acceptable. It requires single-writer publication, generations, bounds, and underrun policy; audio cannot use `Atomics.wait`. This ADR does not automatically enable SAB, new isolation headers, or dependencies.

A physics Worker changes input-admission timing, safe pause, FPS grab/build, snapshot restore, and recording-callback ordering. It may improve main responsiveness while increasing input-to-view latency. Multiple Workers also compete for CPU/memory; more Workers do not necessarily increase throughput. Browser background freeze/discard can still interrupt every lane.

<!-- english-original-anchor --> <a id="採納條件與回復"></a>
## Adoption Criteria and Rollback

Use the same scene, fixed input intents/ticks, versions, and original quality to compare main baseline, localized packet optimization, and a simulation Worker only if needed. Measure main occupancy, Worker compute, full delivery, input-to-ack/view, copied bytes, heap, tick debt, and dropped wall time. Require motion/events/Behavior/recording-hash equivalence or an already frozen tolerance oracle. Test revision conflicts, reordering, timeout, cancellation, Worker crashes, blur/pause/resume, snapshot restore, source removal, and unresolved commands.

Adopt only if improvements are attributable to the targeted bottleneck, costs have not merely become stale snapshots/input latency, and fixed acceptance remains unchanged. Roll back through backend selection to existing main PhysicsWorld/ordinary acoustic Worker/seal Worker. Stop the candidate run and start a new epoch from a verified snapshot; do not silently change physics ownership within one take.
