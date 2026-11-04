<!-- english-source: {"path":"docs/13-performance-review/RECORDING_AND_RENDERING_REVIEW.md","sha256":"00cf7cbe657eb06d56d4c491ef6578d7dc0ffd39daa7414d828e4facd6ad10fa","translated_at":"2026-11-01T08:32:24.260Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/RECORDING_AND_RENDERING_REVIEW.md`](../../13-performance-review/RECORDING_AND_RENDERING_REVIEW.md). Source SHA-256: `00cf7cbe657eb06d56d4c491ef6578d7dc0ffd39daa7414d828e4facd6ad10fa`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="錄製重播與渲染緩衝審查"></a>
# Recording, Replay and Rendering Buffer Review

Date: 2026-11-01 (Asia/Taipei). Status: **research / PROPOSED; no implementation or new product tests executed**. The code baseline is fixed at `05d40fd2d52f4b737f6acac61fa00356403c0038`. Newer dirty R21 observations may only be supplementary and cannot be reported as results for this commit. `REC-*` labels identify local research/future work, not a new official task system, central Claim IDs or acceptance criteria.

<!-- english-original-anchor --> <a id="結論與既有研究關係"></a>
## Conclusion and Relationship to Existing Research

Measure per-tick capture, sealing, storage and replay loading separately before deciding what to move. The ordinary acoustic Worker, background sealing and 60 Hz fixed step already exist, but none establishes that the entire recording pipeline is independent of the main thread. The candidate is a bounded, tick-ordered lossless lane that can pause its producer; only read-only previews may use latest-only updates. This is a future implementation proposal. No Worker, OPFS system, service or schema migration is added.

This page adds ownership, queue, commit and resource-measurement detail without rewriting the [existing recording research](../12-architecture-review/RECORDING_AND_REPLAY_RESEARCH.md), [browser research](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md), [offline rendering research](../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md) or [ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md). The official [record/replay contract](../07-experiments/RECORD_REPLAY.md), [A/B contract](../07-experiments/AB_COMPARISON.md), [performance results](../11-v1/BROWSER_PERFORMANCE.md) and original failures remain intact.

<!-- english-original-anchor --> <a id="rec-01可由基準程式確認的資料流"></a>
## REC-01: Data Flow Established by Baseline Code

| Boundary | CODE fact (line numbers at the fixed baseline) | Cost/limit to measure |
| --- | --- | --- |
| RAF → physics | [bootstrap.ts](../../../src/app/bootstrap.ts) L315–322 calls advance/publication; [runtime.ts](../../../src/app/runtime.ts) L774–805 advances physics. | Both depend on the main thread; fixed dt is not a real-time scheduling guarantee. |
| Tick → capture | Runtime L839–880 captures pre/post Behavior snapshots and cursors; L935–945 performs synchronous batched solving; L951 appends. | Separate Behavior, solver, frame assembly and append. Ordinary 20 Hz acoustic Worker timing is not a substitute. |
| Append → owned frame | [recorder.ts](../../../src/experiments/recorder.ts) L468–495; [hash.ts](../../../src/experiments/hash.ts) L80–83 performs canonical stringify → parse/deep freeze → UTF-8 byte counting, followed by validation/admission. | Per-tick allocations and copies; even a rejected oversized frame may already have incurred processing cost. |
| Stop → seal | Recorder L529–543 copies the frame list/event IDs; [worker client](../../../src/experiments/recording-worker-client.ts) L121 sends through structured clone. | One in-flight operation; a timeout ≤120 seconds cannot interrupt synchronous main-thread work. |
| Seal → publication | Recorder L746–763 reconstructs, validates every frame, seals and independently verifies; [seal worker](../../../src/experiments/recording-seal.worker.ts) L6–8 transfers bytes; client L100–114 copies/hashes/decodes/parses/freezes again. | Account separately for Worker computation, transport, main-thread reception and overlapping peak ownership. |
| Save/load | [blob-store.ts](../../../src/persistence/blob-store.ts) L464–519 still copies/digests/parses prepared saves; public non-prepared input retains full verification. | Asynchronous IndexedDB does not remove main-thread encoding/copying. Concurrent saves of the same prepared artifact share one commit. |
| Replay/seek | [MotionReplay](../../../src/experiments/replay.ts) L16–23 and [ReplayAudioHost](../../../src/app/replay-audio.ts) L52–56 each verify/own a clone; the latter also builds a tick map. | Overlapping lifetimes of artifact, A/B, prepared bytes and two replay owners; seek/restore bursts. |
| B reevaluation | [recording-host.ts](../../../src/app/recording-host.ts) L264–274 yields every 32 frames; [recording-processor.ts](../../../src/app/recording-processor.ts) L285–317 still solves synchronously and structured-clones output. | Thirty-two frames is the current yield granularity, not evidence of meeting the frame budget. Separate frame and batch times. |

Recorder hard caps are 18,000 frames, 64 MiB trace, 256 objects, 100,000 unique events and 2,048 events/frame (recorder L29–34). At a full 60 Hz the frame ceiling is approximately 300 seconds; bytes/events may bind earlier. These are product data limits, not total RAM or unlimited-duration recording guarantees.

<!-- english-original-anchor --> <a id="rec-02預覽與無損錄製採不同接納政策"></a>
## REC-02: Different Admission Policies for Preview and Lossless Recording

| Lane (PROPOSED) | Clock and data authority | Full-capacity policy | Information that must survive |
| --- | --- | --- | --- |
| UI/ray preview | Latest complete snapshot with tick/revision/age. | Coalesce unconsumed old previews; count skipped previews. | Never write preview interpolation into dynamic poses or turn skipped display frames into missing trace ticks. |
| Interactive live solver | Keep one in-flight batch and reject stale replies. | Submit the latest valid input after completion; no extra unbounded queue. | Preserve emission identity separately so pose coalescing cannot erase events. |
| Recording evaluation/encoding/storage | Immutable tick inputs with explicit run/epoch/revision/sequence. | Reserve bytes and frame slots before admission; pause the producer at high water and resume only after acknowledgement reaches low water. | Every contiguous tick, within-tick event order, pre-state, source cursors, acoustic references and original admission decisions. |
| Offline output | Pinned recording → rational tick/sample timeline. | Reject or wait cancelably within job/output budgets; never rewrite capture. | Sample origin, phase, preroll/tail and filter/delay/IR state. |

Recording cannot overwrite a ring buffer, use latest-only frames or fill dropped ticks with interpolation. Failure must not silently lower solver quality, omit sources or relabel interrupted data as captured. The current [FixedClock](../../../src/physics/fixed-clock.ts) L111–131 already distinguishes interactive wall-time discard from recording debt/pause; a candidate lane must preserve this meaning. Average throughput faster than real time also does not guarantee every deadline.

Draft queue descriptor: `runId, runEpoch, sceneRevision, startTick, endTick, sequence, frameCount, payloadBytes, contentHash, ownershipGeneration`. Track separate `accepted/processed/persisted/published` watermarks. Return a transfer-pool buffer only when consumers no longer reference it. Never transfer an array that remains authoritative for Scene/UI. Chunk hashes cannot substitute for the existing canonical artifact hash; a new persistent format/fingerprint requires a separate migration/compatibility task.

<!-- english-original-anchor --> <a id="rec-03flush提交quota-與-crash"></a>
## REC-03: Flush, Commit, Quota and Crash

The candidate stop sequence is: stop new admissions → pin the final accepted tick → drain admitted contiguous frames → verify counts/hashes/versions → write the complete artifact or verified chunks → publish the manifest last. Cancel, timeout, quota, Worker crash and repeated stop must retain their original reasons and last known watermarks. Received is not persisted; persisted is not a backup or a power-loss guarantee.

The [IndexedDB 3.0 Editor’s Draft (2026-10-30)](https://w3c.github.io/IndexedDB/#transaction-lifetime) distinguishes transaction commit and durability hints; request success cannot replace transaction complete. Feature-test and record actual `strict`/`relaxed` behavior; neither warrants a universal zero-loss power-failure claim. This review does not change the product's durability policy.

If OPFS is adopted later, this project has **no implemented atomic transaction spanning OPFS staging chunks and an IndexedDB manifest**. A candidate uses immutable chunk names/content hashes, finishes data and an explicit flush first, then publishes the complete manifest in one metadata transaction. Startup accepts only fully verifiable references. Orphan staging data remains interrupted for an explicit cleanup process, without automatically deleting valid user results. The [File System Standard](https://fs.spec.whatwg.org/#api-filesystemsyncaccesshandle-flush) distinguishes `flush()` from `close()`; the latter does not provide the former's immediate-storage guarantee. The [official OPFS explanation](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) describes origin-private, quota-managed storage, not a separate user-visible backup.

The [Storage Standard](https://storage.spec.whatwg.org/#dom-storagemanager-estimate) defines estimated usage/quota, not a reservation of physical disk space. Record `persist()` as granted/denied/unsupported. Actual writes can still fail. The [quota guide](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) identifies QuotaExceededError; preserve failure data and retry options instead of silently deleting recordings. See [browser/cloud boundaries](BROWSER_CLOUD_SCALABILITY.md) for freeze/discard recovery.

<!-- english-original-anchor --> <a id="rec-04重播與輸出保持同一實驗"></a>
## REC-04: Preserve the Experiment Through Replay and Output

Keep authoritative motion replay, pinned resimulation and fresh physics separately named. Acoustic A/B reuses motion/events/listener/source phase; Behavior A/B reevaluates content. Paused frozen arrivals differ from seeking's old-tail cut. Without an actual captured cursor, mapped pitch cannot claim exact phase restoration (replay-audio L393, L438–443).

Full offline PCM rendering, stems and ADM remain unimplemented. [RenderBackend](../../../src/audio/render-contract.ts) is a types-only seam; future work should reuse it and AudioEngine. Calling real-time update APIs for all frames while context time is 0 does not schedule those updates at their future ticks. Chunk rendering must preserve or validate reconstruction of delay/filter/HRTF/IR/limiter state; joining independent contexts is not assumed equivalent. OfflineAudioContext produces an AudioBuffer, which establishes neither disk streaming nor guaranteed faster-than-real-time execution. [Official API](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)

<!-- english-original-anchor --> <a id="rec-05後續隔離量測與驗證全部-not-run"></a>
## REC-05: Future Isolated Measurement and Validation (All NOT RUN)

Pin commit, dirty diff, bundle/browser hashes, device, power/thermal state, sample rate, scene/assets/solver configuration. Compare identical inputs across idle/interactive, capture, seal, save/load, replay/seek and B reevaluation. Separate cold/warm operation and main/Worker work. Save p50/p95/max, bytes/frame, bytes/simulated-second, event/source/path counts, queue watermarks, tick debt, paused time, long tasks/GC, completion state and hash equivalence for every stage. Report wall seconds and simulated seconds together.

The existing `node tests/browser/run-performance-v3.mjs --phase ui --seconds 20 --output <new-path>` is only a future diagnostic entry point. It writes a shared build directory, so execute sequentially in an isolated checkout. Preserve formal 600-second settings and historical results. `node tests/browser/recording-worker/run.mjs` measures only a fixed sealing fixture and enforces historical Chrome/fixture pins; do not silently remove pins or treat it as live-capture evidence. New research output must not overwrite existing official artifact directories.

Future work: REC-A stage profiling/equivalence oracle → REC-B bounded sequential-lane spike → REC-C quota/cancel/stop/crash recovery → REC-D short PCM renderer correctness. Each needs negative cases, resource ownership and rollback; obtain evidence before adopting an ADR. This research executes none of those tasks and changes no acceptance criteria, original tests, product or services.