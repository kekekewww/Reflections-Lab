<!-- english-source: {"path":"docs/13-performance-review/BUFFER_ARCHITECTURE_REVIEW.md","sha256":"bec8afc7012af8fdb2127ef29f36a0a1df8be4bcb1a71a09a490e8331c925127","translated_at":"2026-11-01T08:32:24.167Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/BUFFER_ARCHITECTURE_REVIEW.md`](../../13-performance-review/BUFFER_ARCHITECTURE_REVIEW.md). Source SHA-256: `bec8afc7012af8fdb2127ef29f36a0a1df8be4bcb1a71a09a490e8331c925127`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="緩衝架構審查d1d8-的資料語義期限與所有權"></a>
# Buffer Architecture Review: D1–D8 Data Semantics, Deadlines and Ownership

Status: static baseline inspection plus PROPOSED architecture; dated 2026-11-01. Baseline: 05d40fd2d52f4b737f6acac61fa00356403c0038, excluding uncommitted implementations in other checkouts. This page is a static buffer-candidate review: no product, configuration, test or acceptance changes and no D1–D8 candidate implementation comparison. The coordinator separately runs a non-formal600-second study; see the [measurement plan](MEASUREMENT_PLAN.md) and [final report](FINAL_REVIEW_REPORT.md). See [industry architectures](INDUSTRY_AUDIO_ARCHITECTURES.md) for official sources and versions.

<!-- english-original-anchor --> <a id="核心判定與基線"></a>
## Main finding and baseline

The current native Web Audio graph does not lack one universal PCM ring. Read-ahead can absorb bounded supply jitter and prepare known data; it cannot fix sustained insufficient throughput, predict collisions or extend the current callback deadline. Identify the failing stage before choosing a queue, cache, batch, reduced repeated work or different algorithm.

Static inspection found these existing safeguards. They must not be proposed again as entirely new functionality:

- [AudioAssetStore](../../../src/audio/assets.ts) owns a decoded bank, checking provenance/revision, budgets and in-flight decode bytes. It has decode-concurrency gates, generation cancellation and built-in reuse. This does not establish automatic LRU or a streaming player.
- [AcousticService](../../../src/app/acoustic-service.ts) permits one in-flight batch, rejects busy calls, and bounds payloads, sources, paths, timeouts, reply identity and retained timing samples. It does not already have a pending-latest queue.
- [Runtime](../../../src/app/runtime.ts) gates solver publication by run epoch, scene revision and pose-tick age; pendingAudio waits for valid solutions. Synchronous solving during capture serves a separate completeness requirement and cannot simply adopt interactive coalescing.
- [AudioEngine](../../../src/audio/engine.ts) already budgets voices, sources, frames, pending events and paths. It has priority admission/stealing, lateEvents, source-frame retention and pause/resume arrival policies. These are not complete voice virtualization.
- The [FIR implementation](../../../src/audio/band-filter.ts) already caches normalized responses separately from pressure scale, with bounded workspaces/layout plans/entries/bytes and copy ownership. [PathRoute](../../../src/audio/routes.ts) reuses stable path IDs, uses identicalKernel to avoid replacing buffers for unchanged shapes, updates delay/direction separately and crossfades two banks. [LateReverbBus](../../../src/audio/late-reverb.ts) also has two banks, IR-setting reuse and latest pending.
- The [recorder](../../../src/experiments/recorder.ts) already bounds frames/events/bytes, validates ticks/identity, captures immutable data and uses a sealing Worker plus IndexedDB commit. This is not an incremental chunk journal. See [recording and rendering](RECORDING_AND_RENDERING_REVIEW.md).

These are code-inspection findings, not new browser, hearing, deadline or long-run evidence.

<!-- english-original-anchor --> <a id="不同資料的-queue-政策"></a>
## Queue policy depends on the data

| ID | Producer → consumer / data | Expiry or capacity policy | First measurements |
| --- | --- | --- | --- |
| BUF-D1 | Decode/custom-DSP Worker → AudioWorklet PCM | Fixed capacity; explicit underflow/overflow; renderer never waits | Occupancy, producer lateness, underrun frames |
| BUF-D2 | Solver → control/audio acoustic snapshots | Latest-wins for compatible run/source/revision continuous updates; reject incompatible revisions | Compute, clone, delivery, age |
| BUF-D3 | Physics → behavior/recording discrete events | Bounded, ordered, deduplicated; recording cannot overwrite events | Count, age, sequence gaps, rejection |
| BUF-D4 | Logical emissions → native audio scheduling | Explicit late, missing-solution and admission deadlines | Event → admission → onset stages |
| BUF-D5 | Asset storage/decode → decoded bank | Existing byte/concurrency gates; safe eviction only if justified | Hit rate, decode tail, peak bytes |
| BUF-D6 | Control/solver → FIR/IR/routes | Reuse shapes; bounded bank updates and tail ownership | Cache misses, IR generation, node peaks |
| BUF-D7 | Recorder → storage/export lossless chunks | Pause/backpressure or interrupted; never latest-wins | Serialization, queued bytes, commit lag |
| BUF-D8 | Large thread payloads / ownership | Single owner or explicit shared protocol; no early recycling | Clone/transfer duration, bytes, GC |

<!-- english-original-anchor --> <a id="buf-d1--pcm-ring只用於已證明的-block-mismatch-或異步供料"></a>
## BUF-D1 — PCM rings: only for demonstrated block mismatch or asynchronous supply

Adoption conditions: a future custom kernel has a different block size from the browser’s actual quantum; a Worker must produce PCM ahead; or long streams require bounded read-ahead. The current source/gain/delay/convolution/HRTF path is primarily native. Wrapping it in a PCM ring adds latency, copies and ownership requirements and needs evidence. [IND-06](INDUSTRY_AUDIO_ARCHITECTURES.md)

Proposed contract: measure capacity in frames, not ambiguous samples. Declare channel format, sample rate, epoch, start frame and a unique producer/consumer owner. Preallocate storage; publish write position after data is written and read position after consumption. Support wrapping spans and actual channel lengths on every call. Distinguish single-value AudioParam arrays from per-frame values. The callback must not await, spin or wait for the Worker; block adaptation still finishes within the current render budget. [JUCE AbstractFifo](https://docs.juce.com/master/classjuce_1_1AbstractFifo.html) is a SPSC reference, not proof of JavaScript or multi-producer correctness.

Watermarks and bounds: define low/high water, maximum capacity, maximum producer burst, latest producer completion and startup prefill. Capacity must fit admitted bursts without growing unboundedly. Target occupancy/sample rate approximates queue residence; capacity/sample rate is maximum storage depth, not fixed added latency. Analytical example: 4096 stereo Float32 frames occupy 32768 bytes; 1024 queued frames at 48 kHz represent about 21.33 ms residence. These are neither product defaults nor measurements.

Failure policy: underflow writes zero or a controlled fade and counts missing frames. Specify whether recovery catches up, skips or reanchors. Do not silently repeat old PCM, alter speed or overwrite unread data. Interactive freshness may discard old data after an explicit discontinuity; lossless capture/output requires backpressure and cannot share that discard policy.

Required evidence: compare the native baseline, a block adapter alone and a Worker producer using identical sources/seeds/paths/output. Record steady and burst occupancy, first-sound latency, render peaks/tails, underruns and memory. A larger ring that keeps draining is not a fix. New validation: NOT RUN.

<!-- english-original-anchor --> <a id="buf-d2--聲學-snapshotlatest-valid不堆積未來會過期的解"></a>
## BUF-D2 — Acoustic snapshots: latest valid, without accumulating obsolete solutions

Current behavior: AcousticService accepts one batch and returns SOLVER_BUSY while occupied. The host gates old work by epoch/revision and rejects solutions beyond the existing pose-tick window. AudioEngine also checks frame revision/tick regression. Source-frame retention already exists; this proposal adds no duplicate unbounded frame cache.

Candidate: if measured pose-production and solve rates diverge, evaluate one in-flight plus one pending-latest request, or immutable double/triple snapshots. Publish an entire snapshot only after all validation succeeds. Consumers retain published versions; writers never overwrite buffers being read. A third buffer reduces ownership conflicts but does not guarantee freshness or faster solving.

Each snapshot identity includes request/source/listener, scene/geometry revisions and pose tick; the host additionally retains run epoch/generation. The coalescing compatibility key is epoch/generation plus source/listener plus revisions and compatible configuration/medium, with monotonically increasing pose ticks; different snapshots need not share a request ID. Latest-wins applies only to permitted continuous updates in that valid scope. Topology/medium/run changes or source removal invalidate prior work. Retention applies only while an old solution remains valid and is visibly stale, not indefinitely.

Recording/acoustic A/B requiring per-tick solver references must retain each required result or pause/backpressure; interactive latest-wins cannot remove intermediate samples. Measure compute, serialization, postMessage, delivery, graph application and frame age separately. Existing service delivery timing explicitly excludes app audio/UI consumers, so it is not total delivery time. New double/triple-buffer concurrency, late-reply, cancellation, disposal and revision tests: NOT RUN.

<!-- english-original-anchor --> <a id="buf-d3--物理事件有界有序dedupcontinuous-才-coalesce"></a>
## BUF-D3 — Physics events: bounded, ordered and deduplicated; coalesce continuous state

Baseline: [physics-world](../../../src/physics/physics-world.ts) caps pending events at 2048 and command-ID deduplication at 4096. The [behavior runtime](../../../src/audio-behavior/index.ts) checks tick, scene revision and run epoch and separately limits frame events. The UI eventLog is a bounded display, not the complete recording authority. Truncating that display does not authorize truncating physics, behavior or recording.

Proposed contract: retain stable event ID, run epoch, tick, within-tick sequence, revision, accepted state and causal parent for each discrete event. Physics-to-behavior consumption and one-to-many voice intents must replay deterministically; retries or late delivery must not emit twice. Continuous poses/gains/motion states may retain the latest value by ID with smoothing. Impact starts/stops, throws and drops cannot share a latest-value overwrite slot. Stops/cancels must survive load.

Overflow: interaction explicitly rejects new events or uses an approved priority policy with reasons, counts and visible degradation. Recording pauses/backpressures before loss; incomplete data remains interrupted with original events preserved. Batching changes transport, not ticks or sequence; merging collisions into one event is not a performance pass.

Candidate validation: contact storms, multiple objects per tick, duplicate delivery, epoch changes, stalled consumers, full queues, tail-end stops and replay equivalence. Observe event age, maximum occupancy and rejection/duplicate/gap counts separately from UI-log length. New validation: NOT RUN.

<!-- english-original-anchor --> <a id="buf-d4--排程clock-mappinglookaheadlate-policy-與新-voice-admission"></a>
## BUF-D4 — Scheduling: clock mapping, lookahead, late policy and new-voice admission

Baseline AudioEngine maps source start to audioEpoch + (emissionTime − simulationEpoch), then native path delay implements absolutePropagationDelay. Events later than the existing condition increment lateEvents and clamp to currentTime; this is not a deadline guarantee. Pending voices require valid acoustic frames. The clock contract remains [AUDIO_RUNTIME](../02-architecture/AUDIO_RUNTIME.md).

Candidate: evaluate bounded lookahead/epoch lead only if main-thread scheduling jitter demonstrably causes misses. New interactive events cannot be predicted. Fixed lead adds input-to-sound latency and must be compared with glitches and perceived synchronization. Report device base/output latency, queue residence, solver age, algorithmic group delay and physical d/c separately. Do not add the same lead to epoch, source start and DelayNode.

A new voice needs an admission deadline: admit with a valid current solution; otherwise use bounded deferral, explicit dropping or an authorized genuine direct-only solver fallback. A fallback still obeys revision, medium, occlusion, gain and delay, and records capability/degradation. It must not invent rays, treat missing data as a zero-distance direct path or bypass the unified SourceGraph. Recording retains logical emission and admission outcome; late playback must not rewrite emission time.

Specify immediate catch-up, expired-event skipping, sample-offset catch-up or rejection separately for one-shots, continuous voices and replay. These alter content/phase and are not equivalent. Bound lookahead by events, bytes and time. Pause/resume/seek/epoch changes cancel old schedules and reschedule remaining logical arrivals once. Candidate tests for new/existing source onset, stopping, pause tails, time jumps and single-counted d/c: NOT RUN.

<!-- english-original-anchor --> <a id="buf-d5--資產延續-decoded-bank按需求補-eviction-或-streaming"></a>
## BUF-D5 — Assets: preserve the decoded bank; add eviction or streaming only when needed

Implemented: decoded bank, byte reservations, native-decode concurrency, WAVE preflight/native-output checks, in-use replacement gates and generation cancellation in AudioAssetStore. New one-shots reuse decoded AudioBuffers; stopped AudioBufferSourceNodes cannot restart. A parallel PCM cache must not bypass budgets or provenance.

First candidate: preload expected assets during permitted authoring/preparation boundaries, with asset ID, revision, hash and decode sample rate defining cache identity. Measure hits/misses, first-sound waiting and reservation peaks. Consider single-flight decoding only if repeated imports are a measured hot spot, preserving caller failure/cancellation semantics. Decoded bytes alone omit encoded input, slices, native decoder work, temporary results and simultaneous playback buffers.

Add LRU only if the working set exceeds the existing bank and measured hit/memory benefits justify it. Never evict assets referenced by active, retiring, paused/frozen, pending-resume or export work, or in-flight decoding. Specify pin/refcount, bounded metadata, release and reload failures. Current code must not be described as already providing LRU.

Streaming requires a separate format/seek/prefetch/decode-buffer contract when long assets cannot reasonably remain resident. Distinguish asset read-ahead from output latency. Use [FMOD’s layers](INDUSTRY_AUDIO_ARCHITECTURES.md) as comparison; native decodeAudioData is not an incremental streaming API. Improvements and onset/memory regressions for LRU, single-flight and streaming: NOT RUN.

<!-- english-original-anchor --> <a id="buf-d6--firir-與-path保留既有-shapescale-分離與-bank-reuse"></a>
## BUF-D6 — FIR, IR and paths: retain existing shape/scale separation and bank reuse

The existing FIR cache separates normalized band shape from scale; uniform gains use native gain. Response/layout/scratch storage is bounded and private. PathRoute updates delay/direction first and replaces AudioBuffer only for a changed kernel shape; gain-only updates can adjust scale. Stable path IDs reuse routes. Shape/gain separation is not entirely unimplemented.

First measure cache hits/misses, key/copy cost, kernel generation, Convolver buffer replacements, route births/deaths and simultaneous active/fading/retiring node/byte peaks. Consider versioned immutable kernel handles or bounded per-context AudioBuffer reuse only if misses, keys or copies dominate. Never expose mutable private arrays or reuse native objects across incompatible contexts/sample rates.

IR exchange owns incoming prefill, crossfade, old tails and pending-latest data. Budget simultaneous bank CPU/memory peaks. LateReverbBus already reuses matching seed/decay IRs; changing wet gain does not require rebuilding. Add IR caching only after finding new repeated long-tail work. Track short-FIR group delay, late-IR onset and physical propagation separately; retain normalization=false physical-gain semantics.

Future Worker-generated kernels may use D2 snapshots/D8 ownership, but rendering never waits; revalidate versions at completion. Hold shape precision, tap count, path caps and acoustic tolerances fixed in comparisons. Changing approximation quality requires a separate decision and cannot silently lower load. New cache, DSP and listening comparisons: NOT RUN.

<!-- english-original-anchor --> <a id="buf-d7--recordingexportlossless-chunk-queue-與-commit-protocol"></a>
## BUF-D7 — Recording/export: lossless chunk queues and a commit protocol

The baseline recorder performs immutable cloning, canonical byte counting and validation at append, then retains bounded frames. At finish, it submits a snapshot to a sealing Worker. Storage validates hashes/identity/commit; each tick is not already durable. Preserve these checks. The detailed authority is [recording and rendering](RECORDING_AND_RENDERING_REVIEW.md).

Candidate chunk journal: frame batches contain run/epoch, first/last tick, sequence, schema/configuration digest, byte count, chunk hash and links. Bound queued bytes and chunks. The writer validates in order, writes temporary data and ACKs/releases ownership only after successful commit. A final manifest references only a complete contiguous committed sequence. Flush means the current queue is drained, not that the run is final or Captured.

Backpressure safely pauses before a fixed step generates new authoritative data. Quota errors, IDB denial, Worker failures, tab closure/freeze/crash preserve incomplete/interrupted state. Switching silently to volatile memory must not claim durability. Expose commit lag/pending bytes. Recovery accepts only a committed prefix with valid hashes, identity and sequence; interruption must not be relabeled Captured.

Large offline PCM/stems are separate artifacts. They may use bounded chunk sinks, cancellation/retry/cleanup and a final hash; renaming recording JSON does not create an audio renderer. Incremental chunks may require schemas, migration and recovery tests under a separate implementation task. New performance/quota/crash/offline-rendering tests: NOT RUN.

<!-- english-original-anchor --> <a id="buf-d8--transferablessabpool先量-clone再定-protocol"></a>
## BUF-D8 — Transferables, SAB and pools: measure cloning before defining the protocol

Baseline acoustic postMessage uses structured clone. The service already avoids cloning complete geometry again merely to retain identity. The recording-seal client copies output and performs hash, decode/parse and freeze work for verification/ownership; copies must not be removed on sight. Separate payload building, cloning, serialization, validation, application and GC. Compare transferables/pools/SAB only if cloning is proven dominant.

Transferables detach the sender’s buffer. Confirm that recorder, replay, hash, cache and UI retain no conflicting references; publish only after receiver validation. Pool leases specify owner/generation/state. Disposal, timeout, cancellation or stale replies must not recycle memory still being read by another thread. Adding a transfer list does not make the whole object graph zero-copy.

SAB requires evaluation of COOP/COEP, third-party assets/embeds, fallback and deployment compatibility before choosing bounded SPSC/snapshot protocols. Publish indices/sequences through Atomics only after writing data. Consumers read published state and release only after complete consumption. Multiple producers or variable payloads require fuller admission/ownership; a few atomics do not automatically make them safe. Audio rendering must neither Atomics.wait nor busy-wait. Lost notifications and stalled producers need recovery.

Compare clone, transfer and shared modes using the same payload and identity validation, including pool exhaustion, ABA/generation, detached-buffer misuse, mixed revisions and error teardown. Measure added resident/peak bytes, reuse, latency tails and browser compatibility. Without clone-dominant evidence, retain simple owned messages. SAB does not guarantee faster solving or native DSP. New measurements/deployment compatibility: NOT RUN.

<!-- english-original-anchor --> <a id="決策順序與不可越過的界線"></a>
## Decision order and boundaries

1. Separate freshness, ordering and audio deadlines through D2/D3/D4, then add telemetry for existing D5/D6 caches and nodes.
2. D7 recording requires completeness and recoverable commits; validate it separately from interaction.
3. Prototype D1/D8 only when their adoption conditions hold. Every buffer needs owners, units, capacity, age, overflow/underflow and cancel/dispose policies.
4. Compare identical scenes, seeds, sources, paths, physics ticks, quality and frozen acceptance conditions. Do not loosen caps, delete events, reduce precision or replace live stability with offline throughput.
5. Research is neither adoption nor delivery. All new validation is NOT RUN; existing incomplete product/performance/listening gates remain unchanged.