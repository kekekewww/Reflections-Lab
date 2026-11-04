<!-- english-source: {"path":"docs/13-performance-review/MEMORY_AND_RESOURCE_REVIEW.md","sha256":"e2242527a106809d242431f594af09612ea03be192bed6b10e52b1a351fdf723","translated_at":"2026-11-01T08:32:24.245Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/MEMORY_AND_RESOURCE_REVIEW.md`](../../13-performance-review/MEMORY_AND_RESOURCE_REVIEW.md). Source SHA-256: `e2242527a106809d242431f594af09612ea03be192bed6b10e52b1a351fdf723`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="記憶體與執行資源審查"></a>
# Memory and Execution Resource Review

Date: 2026-11-01 (Asia/Taipei). Status: **research / PROPOSED; no new RAM, GPU or power measurements in this page; CPU/performance research collection is separate in the [measurement plan](MEASUREMENT_PLAN.md) and [final report](FINAL_REVIEW_REPORT.md)**. Fixed code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`. `MEM-*` labels identify local research/future work. Every new number is identified as a current code limit, analytical size or research assumption. This page changes neither the [official budget](../06-validation/PERFORMANCE_BUDGET.md), [frozen acceptance](../11-v1/ACCEPTANCE.md) nor [amendments](../11-v1/ACCEPTANCE_AMENDMENTS.md).

<!-- english-original-anchor --> <a id="mem-01先分辨資料上限與真正-working-set"></a>
## MEM-01: Separate Data Limits from Actual Working Set

There is no evidence that a 64 MiB trace uses only 64 MiB of RAM. The same content may coexist as canonical strings, UTF-8 bytes, ordinary JS objects, Worker structured clones, AudioBuffers, IndexedDB transaction copies and GPU/native graphs. ByteLength accounting is not a complete browser-memory observation. [Chrome's memory documentation](https://developer.chrome.com/docs/devtools/memory-problems) distinguishes OS memory footprint from reachable JS heap and notes that safe memory numbers vary by device/browser.

| Category/owner | Current behavior and accounting boundary | CODE source |
| --- | --- | --- |
| Recorder/sealed artifact/A-B/replay | 18,000 frames/64 MiB canonical trace excludes full object overhead. Append stringifies/parses/freezes; sealing and replay own further copies. Add them only while their lifetimes overlap. | [Recorder](../../../src/experiments/recorder.ts) L29–34, L468–495, L588–617; [replay](../../../src/experiments/replay.ts) L16; [replay-audio](../../../src/app/replay-audio.ts) L52–56. |
| Worker input/reply/prepared storage | Input is structured-cloned. Reply transfer is followed by a main-owned copy/parse/freeze; prepared save copies/hashes/parses again. Measure when old buffers are released. | [Worker client](../../../src/experiments/recording-worker-client.ts) L100–121; [blob store](../../../src/persistence/blob-store.ts) L464–519. |
| Decoded assets | AudioEngine defaults to 64 MiB decoded PCM and 2 concurrent decodes; hard maxima reach 256 MiB/4, which are not defaults. Count compressed files, staging decodes and potential AudioBuffer duplication separately. | [Control](../../../src/audio/control.ts) L3–16, L28–41; [asset host](../../../src/app/asset-host.ts). |
| Voice/route/pending arrivals | Defaults: 24 native voices, 8 paths/voice, 96 total paths, 256 pending events. Behavior logical admission is separate. Retiring paths/arrival tails also consume resources. | Control L3–16; [engine](../../../src/audio/engine.ts) totalPaths/retiring/restore logic. |
| IR/filter banks | Late bus has two mono IR banks, with a default 4 MiB limit. Route filters/Panner native state are separate. | [Late reverb](../../../src/audio/late-reverb.ts) L33–77; [routes](../../../src/audio/routes.ts). |
| Local persistence | Asset 16 MiB, recording 70 MiB and total blobs 128 MiB are stored-data budgets, not available-disk/heap guarantees. Memory fallback retains data in RAM. | Blob store L15–21, capabilities/mode. |
| Rapier/geometry/view | Separate WASM linear memory, JS wrappers, physics snapshots, Three geometries/materials/textures/render targets and driver allocations. | [Physics world](../../../src/physics/physics-world.ts), [viewport](../../../src/ui/viewport). |

Proposed ownership fields: `ownerId, backingStoreId, logicalBytes, reservedCapacityBytes, retainedReferences, createdAt, releasedAt, stage`. Count each shared backing store once. Transfer changes ownership; copying adds another store. API totals may overlap: do not add process footprint, page-memory estimates, JS heap and individual ArrayBuffer byte counts indiscriminately. Releasing a JS reference, disconnecting a node and disposing a GPU resource are different operations; the application does not guarantee GC timing.

<!-- english-original-anchor --> <a id="mem-02可重算的解析大小與峰值模型"></a>
## MEM-02: Recomputable Analytical Sizes and Peak Model

Every formula is analytical accounting, **not a measurement of allocation strategy**. `Fs` is the actual sample rate, `C` channels and `T` seconds including explicit tails. MiB＝2^20 bytes; MB＝10^6 bytes.

| Item | Formula/example | Limitation |
| --- | --- | --- |
| Float32 PCM | `4 × Fs × C × T`; 48 kHz stereo 30 s＝11,520,000 B (10.99 MiB), 600 s＝230,400,000 B (219.73 MiB). | One PCM copy. Count each truly independent stem/output; add preroll/state separately. |
| PCM16 WAV | `2 × Fs × C × T + headerBytes`; retaining float PCM simultaneously requires at least `6 × Fs × C × T + headerBytes`. Stereo 600 s is approximately 329.59 MiB before headers. | Assumes uncompressed PCM16; no product exporter currently implements this. |
| Two mono IR banks | `2 × 4 × Fs × T_IR`; 48 kHz/4 s＝1,536,000 B (1.46 MiB). | IR samples only. Add convolution partitions/FFT/native overhead; this does not measure the full 4 MiB budget. |
| Route filter samples | `N_routes × N_liveBanks × C_filter × taps × 4`. | Include crossfading/retiring banks. Actual taps/native copies require version-specific measurement. |
| Assumed delay capacity | If each route reserved a mono 5 s float ring: `N_routes × 5 × Fs × 4`; 96 routes/48 kHz is approximately 87.89 MiB. | The project creates delays with a 5 s maximum; browser allocation is opaque. This is a design-pressure scenario, **not observed or inevitable allocation**. |
| Geometry/texture estimate | Typed-array byteLength plus indices; texture estimates use width×height×format, mips/layers/render targets. | CPU/GPU may each own copies. Driver alignment, compression and caches are unknown; counts cannot produce exact bytes. |
| Trace/queue | `Σ actual serialized frame bytes`; queue approximates `producer bytes/s × consumer stall s`, plus slots/metadata and at least one maximum in-flight frame. | Measure JSON heap expansion; assume no fixed 2× or 4× multiplier. Report simulated-time and wall-time byte rates separately. |

`peak(stage) = live owned data + in-flight copies + transient encoder/decoder + native/WASM/GPU state + measurement overhead`. Do not sum unrelated stage maxima blindly or assume stages cannot overlap. Build a capture→seal→save→replay→B→dispose lifetime table, including A/B and old-epoch tails. OfflineAudioContext returns an AudioBuffer and does not establish that full PCM stays off RAM. Retain the existing [offline research](../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md) limitations on long output and chunk state carry.

<!-- english-original-anchor --> <a id="mem-03初始研究-envelope未採納未強制執行"></a>
## MEM-03: Initial Research Envelope (Not Adopted or Enforced)

Use **30 seconds, 48 kHz, stereo and one future output** as an initial capacity-accounting example. The renderer is unimplemented; this is neither a new official test nor an available feature. The 512 MiB below is an **initial planning assumption** for research allocation and identifying unknowns. It refers to work added above a warmed baseline, not a universal device RAM guarantee or new acceptance threshold.

| Research accounting item | Initial allocation MiB | Explanation |
| --- | ---: | --- |
| Decoded asset backing data | 64 | Follows the current default data budget; charge additional staging copies separately. |
| All live trace/artifact representations | 128 | Count actual owned representations. This does not guarantee that a 64 MiB trace fits within 128 MiB of heap. |
| Output PCM/encoder temporary data | 96 | One 30 s PCM plus PCM16 WAV analytically needs about 16.48 MiB. Leave conversion/copy headroom without authorizing more stems. |
| Queue/transfer pools | 16 | Candidate cap includes in-flight and not-yet-returned buffers; unimplemented. |
| IR/filter sample payload | 16 | Separate from the current late-IR cap; does not claim to include every native convolution cost. |
| Geometry/path/render data | 32 | Directly attributable data only; report actual GPU allocation as unknown. |
| Incremental runtime/WASM/view planning allowance | 64 | A profile may falsify this assumption; do not omit existing WASM capacity. |
| Unallocated research remainder | 96 | Allows visible transients/measurement overhead; **cannot absorb unbounded opaque costs and establish safety**. |
| Total | 512 | Not a known total peak for the browser, OS, GPU or native engine. |

If a later implementation cannot estimate/measure an item or exceeds its initial allowance, report that the envelope fails or evidence is insufficient. Reduce the next isolated case or propose another design; do not change original fixtures/formal thresholds to obtain PASS. Never drop ticks/events to satisfy this table. 512 MiB is not a trace quota, storage quota, safe distance from OOM or automatic product stop condition.

An initial candidate queue study uses an 8 MiB byte cap and 120 tick slots, high water 6 MiB/90 slots, low water 2 MiB/30 slots; the other 8 MiB is for in-flight/buffer-pool storage. Slots represent two simulated seconds, not tolerance of two wall-clock seconds of stalling. Reject/pause and report before admission when maximum frames/snapshots cannot fit. Never exceed capacity and overwrite old frames. All values remain inactive until implemented.

<!-- english-original-anchor --> <a id="mem-04cpugpurendergc與能耗分開量"></a>
## MEM-04: Measure CPU, GPU, Rendering, GC and Energy Separately

| Observation | Proposed evidence/units | Invalid inference |
| --- | --- | --- |
| Main-thread wall spans | Existing CDP RunTask unions/RAF bins in ms,p50/p95/max, plus per-stage tick-capture timing. | Wall occupancy is neither thread CPU nor GPU time. |
| CPU | Same-device OS process/thread CPU samples, sampling interval, core/frequency/throttling state and profiling overhead. | Tools define 100% differently; RAF delay alone does not establish CPU saturation. |
| GPU | Feature-test asynchronous timer queries; accept only available, non-disjoint results. Record render calls/triangles/passes/DPR. | CPU submission time/fps is not GPU duration. Do not use gl.finish to force synchronization and call it normal workload. |
| JS/Worker/WASM/native | Reachable heap, ArrayBuffer backing, linear-memory capacity and process footprint, with sources/scopes/sampling gaps. | Stable heap does not rule out native/GPU growth. |
| GC | Pause spans, allocation rate, retained-object trends and capture/seal/replay alignment. | Sawtooth patterns are not automatically leaks. Forced GC is a separately labeled diagnostic, excluded from normal timing. |
| Energy | CPU/GPU busy time, wakeups, disk/network bytes are proxies. Actual power measurements require sensor method, W, integrated J and idle baseline. | CPU down 20% does not mean energy down 20%; profiling can itself wake the device. |

[Three.js renderer.info](https://threejs.org/docs/pages/WebGLRenderer) reports geometry/texture counts in its memory fields; declare reset boundaries for multiple passes. Its [disposal manual](https://threejs.org/manual/pages/how-to-dispose-of-objects.html) requires ownership-aware geometry/material/texture disposal and notes legitimate internal caches; cleanup need not make every counter zero. [Khronos timer queries](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/) and [Mozilla power profiling](https://firefox-source-docs.mozilla.org/performance/power_profiling_overview.html) support asynchronous GPU observation and separation of energy proxies from power evidence, respectively.

Optional `measureUserAgentSpecificMemory()` provides a conditional estimate with scope limitations. Do not call it frequently inside frame callbacks or add COOP/COEP merely for this research. Record support, failures and measurement perturbation. [Chrome-team explanation](https://web.dev/articles/monitor-total-page-memory-usage)

<!-- english-original-anchor --> <a id="mem-05穩態成長及操作峰值的後續觀測not-run"></a>
## MEM-05: Future Steady-State, Growth and Operation-Peak Observation (NOT RUN)

On identical source/bundle/browser/device, record cold startup, warm idle, fixed interaction, capture, seal, save/load, replay/seek, B and disposal. Report each stage's peak, warm range and wall-time growth slope (MiB/min), plus retained increments per completed run/artifact cycle. Repeat several identical lifecycles before discussing leaks; a single heap recovery or stable interval does not establish long-term steady state. Label tab closure, GC and tail release separately. Retain ownership evidence for Worker termination, AudioContext/nodes, GPU resources and database connections.

The existing [performance fixture](../../../tests/browser/performance-fixture-v3.mjs) L455–508 measures fixedStep/onTick/publish/interpolation/advance; L597–604 collects long tasks. This does not establish complete browser RAM coverage. The [trace analyzer](../../../tests/browser/performance-native-v3.mjs) L25, L668–670 uses a 2 GiB Node heap cap to protect analysis, not as product-RAM evidence. The new resource model does not rewrite negative R17 results.

Future work: MEM-A owner/stage inventory and low-frequency bounded observation → MEM-B replay/A-B/seal lifetime profiling → MEM-C compare allocation/copy candidates under the same load → MEM-D independent review before adoption. Reviewing tools, analytical sizes and methodology does not mean product/device/power verification has been executed.