<!-- english-source: {"path":"docs/13-performance-review/proposals/ADR-PERF-01-acoustic-snapshot-exchange.md","sha256":"3c7f46b76f109bd752dbe916259511d3ac040171d777299271d0b094384e912c","translated_at":"2026-11-01T08:32:24.272Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/proposals/ADR-PERF-01-acoustic-snapshot-exchange.md`](../../../13-performance-review/proposals/ADR-PERF-01-acoustic-snapshot-exchange.md). Source SHA-256: `3c7f46b76f109bd752dbe916259511d3ac040171d777299271d0b094384e912c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-01聲學快照交換與可驗證發布"></a>
# ADR-PERF-01: Acoustic Snapshot Exchange and Verified Publication

- Status: **PROPOSED / not adopted**; 2026-11-01. This page offers a future candidate only; it changes no existing Accepted ADR, runtime type, or acceptance criterion.
- Code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`. All new measurements, implementation, and capacity validation are **NOT RUN**.
- Continues [ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md) and the [data contracts](../../02-architecture/DATA_CONTRACTS.md); see the [Acoustic Worker Review](../ACOUSTIC_WORKER_REVIEW.md) and [Buffer Review](../BUFFER_ARCHITECTURE_REVIEW.md).

<!-- english-original-anchor --> <a id="問題與既有保護"></a>
## Problem and Existing Safeguards

`solve` in [src/app/acoustic-service.ts](../../../../src/app/acoustic-service.ts) already rejects a second batch with `SOLVER_BUSY` and retains only scalar request identities; native `postMessage` sends the complete snapshot. `receive` checks the Worker port, batch, request/source/listener, scene/geometry revision, poseTick, and budgets, and does not publish late replies. This is not an unbounded queue lacking backpressure.

`solveCurrent` in [src/app/runtime.ts](../../../../src/app/runtime.ts) additionally checks `runEpoch` and scene revision, rejects results older than three fixed ticks, and retains the previous solution. `AudioEngine.updateFrame` also rejects stale/regressed frames and takes an owned clone. The problem is that inputs still repeat geometry, while sending, validation, cloning, audio route updates, and view consumption have distributed costs. A previously valid solution does not mean the new pose has been solved or that it remains reusable for the current topology. [acoustic-input.ts](../../../../src/app/acoustic-input.ts) currently builds world surfaces from poses on every call, while geometryRevision equals sceneRevision; a moving occluder can change the geometry snapshot while both revisions remain unchanged.

<!-- english-original-anchor --> <a id="候選決策"></a>
## Candidate Decision

First preserve the current single in-flight and last-valid-result semantics, then separately measure a geometry-by-revision cache and a bounded transferable snapshot pool. The [Measurement Plan](../MEASUREMENT_PLAN.md) determines which, if either, to adopt or combine. This proposal does not first select SAB or add a PCM ring.

1. The host retains Scene/physics authority and writes pose/listener/source data and geometry versions only into independently packaged packets. The Worker caches only immutable local geometry/material layout. Rebuild moving-object world surfaces for each poseTick, or key them separately by exact transformed-geometry/pose content identity. GeometryRevision alone cannot identify a dynamic snapshot; reuse requires compatible revision and content identity. A cache miss explicitly requests reinstallation; surfaces from another revision cannot be used.
2. A conceptual envelope contains `protocolVersion, runEpoch, batchSequence, sceneRevision, geometryRevision, poseTick, sourceId, listenerId, payloadBytes, ownershipGeneration`. This is not a new formal API. Request ID, solver version, and existing capability/numeric validation remain.
3. While the interactive producer is busy, it does not enqueue every intermediate pose; at the next admission point it rebuilds the latest complete valid snapshot. Only unsubmitted preview state may be coalesced, never logical emissions, contact events, or recording ticks.
4. Only after complete validation does the receiver atomically switch the published reference. View and audio identify the poseTick/revision/age they consume and never read storage being written by the producer. Drawing uses actual solver paths; interpolation or an IR cannot invent new paths.
5. A topology or run-epoch change cancels the old batch and invalidates cache keys. A completed packet from an old epoch may only be returned/released, never republished. Source removal and listener changes clean up their identities; different pairings cannot share direct delay.

<!-- english-original-anchor --> <a id="所有權容量與滿載"></a>
## Ownership, Capacity, and Saturation

| Resource | Unit and owner | Candidate saturation/failure policy |
| --- | --- | --- |
| In-flight solve | One batch; existing service owner | Reject busy submission, then take the latest complete input next time; no unbounded queue. |
| Geometry cache | Revisions, surfaces, bytes; Worker | Account for total retained bytes and per-revision invalidation; reject or perform bounded eviction/reinstallation, never succeed with incorrect geometry. |
| Transport pool | Packet slots and bytes; handed off by generation | After transfer the sender cannot read detached storage; return only after receiver acknowledgment that it has no references. Without a slot, skip preview submission and count it. |
| Published/retained frames | Source/listener pairings, paths, bytes, age ticks; host consumers | Preserve existing limits, last-valid values, and stale diagnostics. Mark unavailable across incompatible topology rather than silently reusing them. |

Existing service limits are 32 sources, 256 surfaces per source, 256 paths per batch, and a 2 MiB payload. These are neither new pool sizes nor performance guarantees. Pool slots/bytes, cached revision capacity, and permissible age must be derived from fixture distributions, peak ownership, and original formal budgets, then fixed in a separate adoption record. This proposal adds no arbitrary values.

<!-- english-original-anchor --> <a id="替代方案與代價"></a>
## Alternatives and Costs

Object cloning remains the baseline with the lowest compatibility risk; retain it if geometry/cloning is not a major cost. TypedArray transfer may reduce copies of particular large buffers but adds layout, detachment, return, and versioning costs, with message dispatch/validation still present. A SAB latest-complete mailbox is a later candidate requiring deployment isolation, publication order, generations, and a read/write protocol. Audio cannot wait for the producer, and this policy does not suit lossless recording. A per-frame FIFO accumulates obsolete pose latency and is not the interactive default.

Quality risks include holding old poses, incorrect cache hits, missing sources, path-identity churn, and lost provenance. Observable UI age does not establish controlled acoustic error. Gain/delay/direction still follow the [audio contract](../../02-architecture/AUDIO_RUNTIME.md), with propagation delay applied once.

<!-- english-original-anchor --> <a id="採納條件與回復"></a>
## Adoption Criteria and Rollback

Pin the same scene/assets/solver/input trace and separately measure request construction, geometry bytes, clone/transfer, Worker compute, dispatch, validation, and audio/view consumption. Report p50/p95/max, retained/peak bytes, stale age, and drops. Propose adoption only when measurements identify the actual bottleneck, demonstrate end-to-end delivery gains against original budgets, and retain equivalent frame identity, paths, and numerical oracles.

Test malformed/truncated packets, cache misses, moving occluders with unchanged scene/geometry revisions, reordering, timeout, cancellation, epoch/revision changes, source deletion, duplicate pool returns, and Worker crashes; recording retains its complete-tick oracle. Lower quality or smaller loads cannot turn original acceptance into PASS. Rollback disables the cache/packed transport, cancels in-flight packets, clears the new generation, and returns to existing single-batch structured cloning. Scene/Recording formats remain unchanged.
