<!-- english-source: {"path":"docs/13-performance-review/BROWSER_CLOUD_SCALABILITY.md","sha256":"01271dbc0e685b1aa9f0935ebbd21e337dfac1e9ce556347b1f115cdfefd3443","translated_at":"2026-11-01T08:32:24.157Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/BROWSER_CLOUD_SCALABILITY.md`](../../13-performance-review/BROWSER_CLOUD_SCALABILITY.md). Source SHA-256: `01271dbc0e685b1aa9f0935ebbd21e337dfac1e9ce556347b1f115cdfefd3443`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="browserclient-first與未來雲端工作的容量邊界"></a>
# Browser, Client-First and Future Cloud Job Capacity Boundaries

Date: 2026-11-01 (Asia/Taipei). Status: **research / PROPOSED; no new services created/deployed and no new paid calls**. Baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`. `CLOUD-*` labels identify local research/future work. This page changes no original acceptance criteria, spending caps, cloud scenario inputs or accepted ADRs.

<!-- english-original-anchor --> <a id="cloud-01先把本機性能與雲端用量分開"></a>
## CLOUD-01: Separate Local Performance from Cloud Usage

Keep the client-first boundary in [ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md): interactive physics, Behavior, acoustics, 3D view and Web Audio run on each user's device. 100/1,000/10,000 browsers do not require the same number of cloud simulation instances, nor guarantee that every device meets original performance targets. Ordinary acoustic and sealing Workers do not remove main RAF or capture's synchronous solver work. Measure local scheduling/buffering costs using the [recording review](RECORDING_AND_RENDERING_REVIEW.md) and [resource review](MEMORY_AND_RESOURCE_REVIEW.md) first.

Reuse the [hybrid research](../12-architecture-review/HYBRID_CLOUD_ARCHITECTURE.md), [cost model](../12-architecture-review/CLOUD_COST_MODEL.md) and [scenario JSON](../../12-architecture-review/cloud-cost-scenarios.json), instead of creating another drifting provider price table. Original rates were checked on 2026-10-29. This round rechecks only official browser lifecycle, Worker and job-billing semantics. **It does not fully refresh prices, account quotas, free allowances, bills or capacity.** Existing nine scenarios remain estimates, not deployment recommendations or performance commitments.

| Responsibility | Current state/candidate | Capacity/cost authority |
| --- | --- | --- |
| Real-time interaction/audio | CODE: client; physics/capture still perform main-thread work. | Per-device CPU/GPU/RAM/input/audio evidence, not cloud-user capacity. |
| Metadata/asset sync/Meta control plane | Existing loopback server and local storage; formal public service incomplete. | Only a separately authorized phase can verify auth/tenants/durable budgets and storage traffic. |
| Local offline PCM/stems | Types-only RenderBackend seam; complete renderer unimplemented. | Establish short-take sample/state/phase correctness and working set first; trace JSON export is not WAV. |
| Cloud long renders | PLAN: explicitly chosen, replaceable job backend. | Verify local/backend capabilities and pinned inputs before job limits, queues and actual fees. |

<!-- english-original-anchor --> <a id="cloud-02browser背景不是可靠job-host"></a>
## CLOUD-02: A Background Browser Is Not a Reliable Job Host

[Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) explains that frozen pages suspend freezable tasks and discarded pages execute no JS. A final callback cannot reliably finish arbitrary asynchronous saving. A Worker provides no background-completion SLA. [WHATWG Workers](https://html.spec.whatwg.org/multipage/workers.html) notes startup/per-instance costs, so a Worker per source/frame is not recommended.

The following lifecycle policy is proposed. **No visibility/freeze handlers are implemented this round.**

| Boundary | Candidate behavior | Permitted result claim |
| --- | --- | --- |
| Hidden/about to freeze | Request pause at the last complete tick and submit a bounded checkpoint without blocking; display save progress. | Only checkpoints with persistence acknowledgements are saved; incomplete work remains pending. |
| Freeze/discard/tab close | Do not depend on unload or a long asynchronous flush; persistent format already distinguishes staging/committed states. | Interruption cannot become continuous measurement or Captured. |
| Reload/resume | Verify run identity, last committed tick, chunk/artifact hashes and references; continue at the same tick or mark interrupted. | Do not insert hidden wall-clock gaps as simulation data or replay already-arrived impacts. |
| Long local output | State the requirement to keep the page available and its cancellation limits; optionally preserve a work descriptor for later retry. | Without checkpoint capability, do not promise continuation after closing the page. |
| Future cloud job | Voluntarily upload selected pinned inputs for an independent durable job host. | Do not present an unimplemented/unauthorized backend as available or automatically upload when local RAM is insufficient. |

Browser persistence still depends on origin quota, clearing site data and eviction policy; OPFS is not a backup. See the [recording review](RECORDING_AND_RENDERING_REVIEW.md) for disk flush, metadata commit and recovery. `navigator.storage.estimate()` is not a physical-space reservation.

<!-- english-original-anchor --> <a id="cloud-03把吞吐等待費用寫成不同模型"></a>
## CLOUD-03: Separate Throughput, Waiting and Cost Models

The following is analytical planning, not a load test. `λ` is admitted logical jobs/s, `A` average attempts/job, `W` complete instance lifetime seconds/attempt and `c` concurrency cap. Approximate running demand is `L ≈ λ × A × W`; Little's Law describes average in-flight work only in a stable, completing system. If `L ≥ c`, there is no steady-state waiting guarantee. Even `L < c` does not prevent queues caused by bursts, long tails, cold starts, regional quotas or failures. Report completion latency separately as upload, queue wait, startup, execution, output commit and download.

| Model item | Calculation/required inputs | Invalid conflation |
| --- | --- | --- |
| Local device capacity | Same scene/events/source/path counts, actual sample rate/DPR and device profile. | Do not divide one high-end machine into a per-user server cost. |
| CPU/RAM use | `attempts × billable lifetime × provisioned vCPU`; `attempts × billable lifetime × provisioned GiB`. | Do not count only the DSP kernel. Report reserved RAM separately from measured peaks. |
| Bytes/retention | Input/asset reads, output writes, downloads, retries, retention; distinguish GB/GiB. | Uploads are not unique stored bytes; mature steady-state archives are not first-month accumulation. |
| Complete cost | Compute, storage, operations, egress, control/queue, observability, AI and explicitly listed other costs. | Existing priced subtotals exclude AI and unmodeled items; they are not full bills. |
| Queue/admission | Global/tenant caps, max bytes/duration/attempts, TTL/cancellation, budget reservation. | Queue dispatch rate, per-job parallelism and global concurrency are separate limits. |

[Official Cloud Run billing](https://cloud.google.com/run/pricing) charges started job instances over complete instance lifetime under instance-based billing, with a minimum billing duration. Include startup, input preparation, upload and retries. This confirms semantics only, not the user's 2026-11-01 prices or quotas. Actual recalculation still requires refreshing every rate source and region.

The existing high scenario gives a direct counterexample: 10,000 peak sessions, 0.05 jobs/user-hour, 1.2 attempt multiplier and 600 s/attempt require 100 concurrent attempts; at duty 0.75 the average demand is still about 75, above the original cap 50. That cap supplies approximately 250 logical jobs/hour, less than 375 average arrivals/hour. The original model estimates eventual completion costs without promising completion inside the operating window. This page does not alter caps, rates or workload to remove that shortfall.

<!-- english-original-anchor --> <a id="cloud-04未來job契約的最小研究邊界"></a>
## CLOUD-04: Minimum Research Boundary for a Future Job Contract

Reuse [RenderJob/RenderBackend](../../../src/audio/render-contract.ts) instead of creating another renderer. Jobs need pinned recording/configuration/asset hashes, sample clock/window, tail/preroll, source selection, actual backend/engine/capabilities and output-byte/frame limits. Starting Web Audio or native DSP inside a container does not establish equivalence to the current browser's HRTF/routes/delays/filters/limiter. Until equivalence is verified, identify the separate backend and approximation limitations.

If a cloud phase is separately authorized, use queue descriptors and private object references for large data. Verify tenant ownership, short-lived object permissions, hashes/revisions, idempotency, leases and global/per-user budget reservation. Do not expose the existing localhost server or treat Origin allowlists as authentication. Lost attempts remain uncertain; restarting cannot erase possibly incurred costs. Preserve original errors for cancellation/completion races, retries, quotas, missing assets and partial output. Verify all outputs before publishing completed.

Define rejection, waiting and expiration before discussing more capacity. Do not automatically upgrade plans, spend, change Meta providers or upload user audio. Existing default-zero spending and unverified-account conditions remain in force.

<!-- english-original-anchor --> <a id="cloud-05後續研究工作與未執行邊界"></a>
## CLOUD-05: Future Work and Unexecuted Scope

CLOUD-A first pins same-load local profiles on ordinary laptops/high-end devices; lowering device quality does not replace formal acceptance. CLOUD-B creates backend capability/sample-alignment comparisons only after a short local renderer exists. CLOUD-C refreshes dated cost inputs and implements bounded queues/auth/budgets with independent negative validation only in a separately authorized phase. This page's CLOUD-A multi-device candidate study, cloud load tests, public deployment, service provisioning, account/billing queries and power tests are **NOT RUN**. The coordinator separately runs a single-device non-formal600-second study; see the [measurement plan](MEASUREMENT_PLAN.md) and [final report](FINAL_REVIEW_REPORT.md).

These throughput formulas, initial resource plans and lifecycle policies support design review. They do not establish ten-thousand-user capacity, background completion, cross-backend audio equivalence or completion of V1.