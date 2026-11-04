<!-- english-source: {"path":"docs/13-performance-review/CLOCK_AND_SCHEDULING_REVIEW.md","sha256":"15da0fa3b63885acc632859abbff89579d79d1513c39e3d0ce7c0619a5a5b362","translated_at":"2026-11-01T08:32:24.179Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/CLOCK_AND_SCHEDULING_REVIEW.md`](../../13-performance-review/CLOCK_AND_SCHEDULING_REVIEW.md). Source SHA-256: `15da0fa3b63885acc632859abbff89579d79d1513c39e3d0ce7c0619a5a5b362`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="clock-與排程研究"></a>
# Clock and Scheduling Review

Status: CODE FACT, HYPOTHESIS, and PROPOSED are separate. Baseline `05d40fd2d52f4b737f6acac61fa00356403c0038`; this page uses no dirty R21 supplement. Seven clocks map data responsibilities, not seven new threads. The offline sample timeline has types only and no implemented renderer. This review changes no clock, and this page compares no new clock candidate. The coordinator separately runs a non-formal600-second study; see the [measurement plan](MEASUREMENT_PLAN.md) and [final report](FINAL_REVIEW_REPORT.md).

Formal authorities: [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md), [Data Contracts](../02-architecture/DATA_CONTRACTS.md), [Physics Architecture](../04-physics/PHYSICS_ARCHITECTURE.md), [Record/Replay](../07-experiments/RECORD_REPLAY.md), and [ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md). Numerical targets are maintained only in [Performance Budget](../06-validation/PERFORMANCE_BUDGET.md).

<!-- english-original-anchor --> <a id="perf-clock-001使用者指定的七時鐘"></a>
## PERF-CLOCK-001: The seven clocks requested by the user

| Clock | Current representation / owner | Mapping / use | Boundary that must remain explicit |
| --- | --- | --- | --- |
| 1. Wall clock | App RAF timestamps and `performance.now()`; UTC Date for provenance only | Bootstrap derives adjacent RAF deltas; runtime `clock += delta` throttles live solving/publication; service uses monotonic wall time for durations/timeouts | Wall elapsed time is not completed simulation time; raw performance timestamps from different globals must not be subtracted without time-origin mapping |
| 2. Render frame | App RAF and R3F useFrame are different callback paths, both on main | Fixed accumulator supplies alpha; getPose reads copied interpolation of previous/current states | A visual frame may contain zero or multiple physics steps; React/R3F callbacks neither determine physics dt nor guarantee hard real-time execution |
| 3. Physics fixed tick | `PhysicsWorld.tickValue` and `FixedClock.currentTick`; default h=1/60 | Completed step n→n+1; simTime=(n+1)h; behavior, event time and capture derive from post-step snapshots | RAF indices, Date.now, and unavailable CCD substep contact times cannot replace event time |
| 4. Acoustic snapshot tick | Request/frame `poseTick`, scene/geometry revisions and service batch ID | Live requests sample the latest physics snapshot when available; results retain its tick; compute/completion occupy an asynchronous wall interval | Snapshot tick is not an independent Worker simulation clock; geometryRevision currently equals sceneRevision, so dynamic poses still require poseTick |
| 5. AudioContext clock | Native context.currentTime plus simulation/audio epoch pair | Emission te maps to audioEpoch+(te−simEpoch), with each path's absolutePropagationDelay once; pause/resume reanchors | currentTime is not ear arrival time; base/output latency and physical d/c remain separate; logical lifetimes do not depend on onended |
| 6. Recording timeline | Accepted consecutive integer ticks, fixedDtS, runEpoch, event sequence and source cursors | Capture appends authoritative poses/events/behavior/acoustics; replay reads stored frames and seek changes cursor/epoch | Recording time excludes wall gaps and RAF cadence; completion time of a sealing Worker is not trace time |
| 7. Offline render sample timeline | **Types only**: `RenderClockMapping` and RenderWindow | sample(k)=round((k−tickOrigin)×p×Fs/q), with explicit rounding, preroll, tail and window origin | No runtime validator/backend/PCM exists; sample-accurate full mixes, stems and offline throughput are not implemented |

Source references: [bootstrap](../../../src/app/bootstrap.ts) L150–159, 315–327; [runtime](../../../src/app/runtime.ts) L421–438, 774–838, 1001–1032, 1086–1114, 2024–2041; [fixed clock](../../../src/physics/fixed-clock.ts) L91–143; [physics](../../../src/physics/physics-world.ts) L1176–1288; [audio engine](../../../src/audio/engine.ts) L206–220, 778–863, 1048–1064; [render contract](../../../src/audio/render-contract.ts) L27–49.

Behavior tick/cooldown/playhead derive from clock 3. The authoritative replay cursor derives from clock 6 while live Rapier is paused. AI/provider/tool timeouts, run quotas and progress are auxiliary orchestration clocks. They neither replace the seven clocks nor enter the audio callback. Paused audition is an independent preview domain excluded from experiment metrics.

<!-- english-original-anchor --> <a id="perf-clock-002現行-scheduling-與-overload"></a>
## PERF-CLOCK-002: Current scheduling and overload

```text
RAF wall delta
  -> FixedClock accumulator
  -> up to 4 complete fixed callbacks
       physics step -> post-step snapshot -> behavior -> audio control
       -> if capturing: synchronous acoustic evaluation -> validated append
  -> interactive: discard whole-step wall debt, retain logical tick continuity
     recording: pause and retain debt; no skipped simulation tick
  -> maybe latest live acoustic request (>=50 ms and idle)
  -> runtime view -> coalesced panel publication
```

FixedClock commits its tick only after the step callback returns successfully. A PhysicsWorld observer error pauses after the completed physics tick without rolling physics back; runtime failure safely pauses. The entire physics/recording tick therefore cannot be described as an atomic transaction with cross-module rollback. [fixed-clock](../../../src/physics/fixed-clock.ts) L110–133; [physics-world](../../../src/physics/physics-world.ts) L332–344; [runtime](../../../src/app/runtime.ts) L817–818, 2052–2055. A future asynchronous recording lane needs a captured watermark and failed trace range for atomic publication; inserting an `await` into the callback does not establish those semantics.

Replay performs at most four `nextReplay` calls per RAF and retains excess replayAccumulator. It has neither the interactive wall-time dropping branch nor the same FixedClock recording-overrun pause branch. [runtime](../../../src/app/runtime.ts) L779–800. These are actual differences, not one common overload policy. Replay lag and native audio drift require measurement. Candidate alternatives include retaining debt, pausing and reanchoring, or bounded look-ahead; skipping authoritative frames to regain speed requires an explicit record and is not assumed acceptable.

PauseCore freezes world/behavior/recorder and uses Freeze-and-fade for audio. App RAF can still publish views and perform live request housekeeping. Paused does not mean AudioContext is suspended: the context may continue for preview. Authoring drain cancels the acoustic Worker and clears pending voices/solutions; ordinary pause does not terminate every Worker. [runtime](../../../src/app/runtime.ts) L458–487. Scene/behavior commits create a new epoch. Gravity-only edits preserve logical state/cursors, change revision and cancel the previous batch (L611–672). Each transition needs separate verification rather than one generic pause fixture.

<!-- english-original-anchor --> <a id="perf-clock-003聲學年齡的三種量"></a>
## PERF-CLOCK-003: Three acoustic age measurements

| Quantity | Current implementation fact | Future benchmark fields |
| --- | --- | --- |
| Request snapshot age | Submission uses latest snapshot; request ID includes scene/tick/source | sampledTick, submit wall time, geometry/input bytes and main-thread construction duration |
| Delivery age | If latest.tick−frame.poseTick>3, runtime rejects the whole batch and retains previous solutions; epoch/revision checked first | Receive wall time, latest tick, accepted/rejected and reason; also wall age while paused ticks do not advance |
| Display freshness | UI marks any poseTick different from latest as stale; busy takes precedence as pending | Actual represented tick, published tick and display wall age; do not describe a 20 Hz live result as fresh at every physics tick |

References: [runtime](../../../src/app/runtime.ts) L1042–1053, 2192–2209, 2300–2321. A rejection window of three ticks is not an end-to-end latency target and does not guarantee 50 ms of wall time: simulation may pause or discard wall debt. Ignoring a late result is distinct from proving that no path exists.

<!-- english-original-anchor --> <a id="perf-clock-004不可省略的時間映射"></a>
## PERF-CLOCK-004: Time mappings that cannot be omitted

Audio emissions use physics/behavior simulation time. Each path's absolute delay already covers total propagation from source emission to listener. Relative delay is for analysis and must not have directDelay added again when scheduling. Adding another buffer-latency compensation to a complete propagation delay can double-count physical delay. Record logical emission time, intended context arrival, context time at native-node creation, and device latency separately. Distance/gain calculations are not end-to-end acoustic calibration. [Data Contracts](../02-architecture/DATA_CONTRACTS.md), [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md).

The pinned Web Audio Recommendation separates control/render execution and context audio time. Epoch scheduling cannot send a main-thread event back into already rendered audio. [Web Audio REC 2021](https://www.w3.org/TR/2021/REC-webaudio-20210617/), accessed 2026-11-01. New 1.1 Working Draft features still require engine feature testing.

Offline mapping uses integer ticks, rational fixedDt and one absolute rounding operation to avoid accumulating error by repeatedly rounding each tick delta. At 1/60, one tick is 800 samples at 48 kHz and 735 at 44.1 kHz; these are arithmetic examples, not implementation evidence. Arbitrary fractional emission/subtick, other fixedDt values and fractional propagation delays still need explicit renderer rules. Output length is the difference of mapped window endpoints plus tail; preroll is discarded and padding excluded. The rounding policy is nearestTiesToPositiveInfinity; products/sample indices need safe-integer, nonnegative, finite and bounds validation rather than TypeScript alone. These are [existing type contracts](../../../src/audio/render-contract.ts) and **PROPOSED runtime validation**, not verified implementation.

<!-- english-original-anchor --> <a id="perf-clock-005候選排程設計與決策門檻"></a>
## PERF-CLOCK-005: Candidate scheduling designs and decision gates

| Option: all PROPOSED | Problem it may address | Unresolved costs / new risks | Evidence before selection |
| --- | --- | --- | --- |
| Keep the main-thread fixed clock; instrument stages first | Locates actual remaining costs and preserves a smaller lifecycle boundary | Moves no CPU work | Formal profile stage times, GC, catch-up debt and input latency |
| Bounded recording-evaluation Worker | Moves capture acoustic evaluation and some serialization off main | Cross-thread ACKs, watermarks, memory, finalize drain and cancellation consistency; cannot overwrite ticks with latest state | Equivalent artifacts/events/cursors/hashes; pause at capacity; failure/timeout/stop/seek fixtures |
| Physics Worker | Isolates Rapier CPU work | Input-to-step latency, synchronous query API redesign, expanded grab/build collision ownership, revision, wake/reset/dispose ordering | Main-thread physics is a measured bottleneck; prototype improves equal-load tails without input/physics regression |
| Adjust live solver coalescing/publication cadence | Reduces obsolete work, delivery or view load | Faster motion can lag; path age and audible lateness can increase | Request age, rejection ratio, path continuity and equal-model comparison |
| Replay look-ahead scheduling | Reduces main jitter for already known future events | Pause/seek/stop cancellation, tails and current cursors remain necessary; live contact cannot be predicted this way | Sequential replay identity, arrivals once, epoch cancellation and alignment |
| Offline sample scheduler | Reproducible output independent of wall time | No current backend; opaque native DSP does not imply cross-engine bit exact output | Sample count/alignment/tail tests and observed capabilities; see [Recording/Rendering](RECORDING_AND_RENDERING_REVIEW.md) |

<!-- english-original-anchor --> <a id="perf-clock-006必保留的順序與測量收據"></a>
## PERF-CLOCK-006: Required order and measurement receipts

Future tasks must freeze this order: accepted command/revision, control before step, physics/contact copies, post-step tick stamping, ordered/deduplicated behavior input, logical voice intent, acoustic identity/revision validation, native admission and record commit. Render interpolation cannot feed the authoritative trace. Native onended or Worker completion order cannot change deterministic logical lifetimes. Date.now cannot supply audio emission time.

Suggested minimum measurement fields are run/bundle/Git/browser/hardware, mode/epoch/revision, RAF sequence/delta, tick range/steps/alpha, debt/dropped wall seconds, sampled acoustic tick/submit/receive/consume, recording commit watermark, audio epoch/currentTime, and pending arrival/late/rejection counters. Across globals, compare correlated requests and local durations, or explicitly map `timeOrigin+now` with its conditions. Do not directly compare raw now values from different realms. Keep wall provenance separate from monotonic intervals.

A candidate Proposed ADR should state all seven clocks, control/data ownership, mailbox versus lossless queue classification, capacity units, pause/drop/reject overload behavior, publication barriers, cancellation/crash recovery, rounding and future observability/acceptance. Measure before selecting. Schema caps and types do not verify clock synchronization. [Measurement Plan](MEASUREMENT_PLAN.md), [Buffer Review](BUFFER_ARCHITECTURE_REVIEW.md).

For time-origin concepts see [High Resolution Time](https://www.w3.org/TR/hr-time-3/), accessed 2026-11-01; the page is the 2026-09-01 Working Draft. It informs the distinction between monotonic time and time origin, without introducing an API, accepting the draft, or promising cross-browser resolution/deadlines.
