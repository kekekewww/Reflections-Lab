<!-- english-source: {"path":"docs/13-performance-review/proposals/ADR-PERF-03-buffer-ownership-lifecycle.md","sha256":"1b65e6694a4cfa46905537b5d61e81b2e01c25a884d905218a1488c05ed38fba","translated_at":"2026-11-01T08:32:24.279Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/proposals/ADR-PERF-03-buffer-ownership-lifecycle.md`](../../../13-performance-review/proposals/ADR-PERF-03-buffer-ownership-lifecycle.md). Source SHA-256: `1b65e6694a4cfa46905537b5d61e81b2e01c25a884d905218a1488c05ed38fba`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-03buffer-所有權預算與生命週期"></a>
# ADR-PERF-03: Buffer Ownership, Budgets, and Lifecycle

- Status: **PROPOSED / not adopted**; 2026-11-01. This is a candidate for later ownership review, adding no public type, pool, SAB, or storage format.
- Code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`; new peak measurements/pool validation are **NOT RUN**.
- Basis: [data contracts](../../02-architecture/DATA_CONTRACTS.md), [ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md), [Buffer Review](../BUFFER_ARCHITECTURE_REVIEW.md), and [Memory Review](../MEMORY_AND_RESOURCE_REVIEW.md).

<!-- english-original-anchor --> <a id="問題與已有機制"></a>
## Problem and Existing Mechanisms

[src/audio/assets.ts](../../../../src/audio/assets.ts) already tracks decoded bytes, in-flight decode reservations, concurrency, and generations. In-use assets cannot be replaced, and a candidate bank is published only when all entries are valid. [band-filter.ts](../../../../src/audio/band-filter.ts) already has bounded response/layout caches, private kernel copies, fixed scratch workspace, and a reentrant fallback. [routes.ts](../../../../src/audio/routes.ts) already has dual FIR banks and stable route reuse. This proposal does not introduce these features.

However, separate layer budgets do not imply that one value bounds total heap peaks. Asset PCM, FIR cache, AudioBuffers, dual IR banks, retiring routes, snapshot clones, recording artifacts, canonical bytes, and parsed replay copies may coexist. Transfer and JS garbage collection are not resource-return protocols. Before returning storage to a pool, prove that no consumer still reads it.

<!-- english-original-anchor --> <a id="候選決策"></a>
## Candidate Decision

First create a measurable ownership inventory: owner, readers, capacity units, release boundary, and peak coexistence for each hot path. Pool only packets/scratch whose measured costs justify it. Retaining safe copies is an acceptable result; zero-copy is not the success criterion.

| Data kind | Candidate owner and access rules | Release/cancellation boundary |
| --- | --- | --- |
| Scene/authoring arrays | Host authority; never transfer storage still used by UI/commands. | Original revision transaction; transport completion does not change authority. |
| Transport ArrayBuffer | One writer; `free → filling → inFlight → consuming → returned`, with generation per use. | Acknowledge after the receiver's last reference. A crash invalidates the pool generation; do not guess that ownership returned. |
| Decoded PCM/AudioBuffer | AssetStore pin; native voices/frozen arrivals read the same revision/hash. | Preserve active, retiring, pending, and frozen pins. Replace only after drain; clear prevents old decode generations from committing. |
| FIR coefficients/scratch | Cache owns private immutable coefficients; caller receives an owned result; scratch never escapes. | Eviction releases only the cache reference. AudioBuffer/targetKernel lifetimes are accounted separately. |
| IR banks/route state | Graph owner; active/fading/retired resources all count as live. | Retire after the audio fade/tail boundary and disconnection; a late wall timer does not permit early overwrite. |
| Recording/replay | Independent owners for artifact, prepared bytes, and replay readers. | Stop/drain/publication or seek/dispose; one finished reader cannot reclaim another reader's data. |
| Future offline PCM | RenderJob-specific working/output budgets. | Cancel/output publication; currently only a types-only seam exists, with no such buffer owner implemented. |

A conceptual lease uses `resourceId, ownerId, runEpoch, generation, byteLength, state`; array indices/Rapier handles are not persistent identities. Transferring a packet does not transfer Scene/Recording authority. Multiple readers require explicit pins/acknowledgments or owned copies; TypeScript readonly does not prevent underlying mutation.

<!-- english-original-anchor --> <a id="容量與過載"></a>
## Capacity and Overload

Report both logical items and bytes for every budget. PCM uses frames×channels×bytes/sample, with sample rate stated separately. Include dual IR banks and overlap/tails. Report allocated/reserved/in-use/retiring/pooled-free/peak values and distinguish JS-visible payload, native audio allocations, and engine overhead that cannot be measured reliably. Existing limits such as 64 MiB decoded PCM do not bound total process memory.

Derive pool capacity from maximum legal packets, simultaneous consumers, and measured residency, with a hard upper bound and no automatic doubling. Without a free slot, interactive preview may skip an unadmitted update and count it; recording pauses its producer, assets/decode reject work, and audio follows its defined admission policy. No callback allocation expands the pool. Timeout changes job state; it does not reclaim a buffer a consumer can still access.

<!-- english-original-anchor --> <a id="替代相容性與風險"></a>
## Alternatives, Compatibility, and Risks

Existing owned copies most readily preserve validator/hash semantics. Pools may reduce particular allocations but risk stale views, ABA generations, double return, use-after-transfer, and retention in large pools. SAB adds shared-publication/deployment-isolation risks and remains conditional on profiling. A custom PCM ring suits a future streaming producer/consumer; current AudioBufferSources read assets directly and do not require a transport ring merely because they process audio.

The [HTML transferable specification](https://html.spec.whatwg.org/multipage/structured-data.html#transferable-objects) defines transfer/detachment behavior. Fewer copies do not eliminate scheduling, validation, native allocation, or receiver lifetime. Changes to the native graph, sample rate, or artifact-hash representation are not automatically authorized here.

<!-- english-original-anchor --> <a id="採納與回復"></a>
## Adoption and Rollback

Use the same largest legal fixture, frequent source churn, pause/resume, import/replace, cancel/dispose, and overlapping seal/save/replay to measure peaks and idle residuals. Inject delayed/duplicate acknowledgments, wrong generations, clear during decode, Worker crashes, retained typed views, and multiple readers. Require no alias mutation, detached reads, old-revision commits, early pin release, or unreported budget breaches. Numeric, asset-hash, and recording-hash oracles remain unchanged.

Adopt and freeze capacity only if [measurements](../MEASUREMENT_PLAN.md) identify material allocation/copy cost against original budgets and the pool reduces that cost without uncontrolled residency. New capacity/error limits undergo separate implementation-task review. Rollback stops new leases, cancels/drains in-flight generations, releases new pools with no readers, and returns to owned-copy/AssetStore/cache paths. Assets still referenced by native voices cannot simply be cleared.
