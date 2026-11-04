<!-- english-source: {"path":"docs/13-performance-review/INDUSTRY_AUDIO_ARCHITECTURES.md","sha256":"a03c05a783912c28d860c93804bd95af2427989a60751b233d398995031a8873","translated_at":"2026-11-01T08:32:24.221Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/INDUSTRY_AUDIO_ARCHITECTURES.md`](../../13-performance-review/INDUSTRY_AUDIO_ARCHITECTURES.md). Source SHA-256: `a03c05a783912c28d860c93804bd95af2427989a60751b233d398995031a8873`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="業界音訊架構預讀即時期限與資源政策"></a>
# Industry Audio Architectures: Read-Ahead, Real-Time Deadlines and Resource Policies

Status: official-document verification plus engineering inference; accessed 2026-11-01. Reflection Lab code baseline: 05d40fd2d52f4b737f6acac61fa00356403c0038. This page compares architectures and proposes research; it changes no product, configuration, tests or acceptance criteria. None of these commercial engines was benchmarked. See the local [buffer review](BUFFER_ARCHITECTURE_REVIEW.md).

<!-- english-original-anchor --> <a id="比較框架"></a>
## Comparison framework

“Buffer” can mean asset reads, decoded PCM, DSP block adaptation, cross-thread supply, control/event queues or device output. Explicit vendor behavior below is VERIFIED-DOCS. Adoption conditions for Reflection Lab are PROPOSED; documentation cannot establish a product performance pass.

| System | Main problem | Transferable idea | Assumption that does not transfer |
| --- | --- | --- | --- |
| REAPER | Media and FX work on a known timeline | Prepare predictable work; separate live and offline | Future interactions and collisions are known |
| Ableton Live | Monitoring latency and each audio deadline | Measure the critical path, peaks and causes | Low average system CPU prevents dropouts |
| FMOD | Game asset supply, decoding and physical mixing budgets | Separate buffer types, loading policies and priorities | More read-ahead always adds monitoring latency |
| Wwise | Voice states, streaming and starvation attribution | Specify virtual timeline and return costs | Virtual means zero CPU and memory |
| JUCE | Real-time callbacks and thread communication | Bounded SPSC and explicit data ownership | The FIFO owns PCM or supports multiple writers |
| Chrome / Web Audio | Native browser graph, AudioWorklet and observation | Distinguish native/custom paths and actual deadlines | A ring extends the same callback’s execution budget |

<!-- english-original-anchor --> <a id="ind-01--reaper可預知工作與-live-input-的界線"></a>
## IND-01 — REAPER: predictable work versus live input

Vendor documentation: REAPER 7.84 / November 2026 separates media buffering, anticipative FX and live FX multiprocessing, with per-track buffering/anticipation overrides. Anticipation can improve work distribution, but excessive settings can crackle. PDC can read existing media ahead for alignment; live monitoring still experiences latency. Rendering offers full-speed, 1× offline, online and idle modes; monitoring FX are excluded from renders. Locations: §6.14–6.15, §21.3, §22.6.2 and §22.6.8; printed pages 118–119, 411–413, 433 and 435. [IND-S01: Official HTML User Guide](https://dlx.reaper.fm/userguide/html/)

Engineering inference: preloading assets or preparing a pinned replay can help; unknown collisions and player input cannot be solved ahead. Offline work can use larger batches; interaction must allow new input to affect the next valid update. PDC alignment must neither cancel physical d/c nor count emission delay twice.

<!-- english-original-anchor --> <a id="ind-02--ableton先識別延遲階段與-critical-path"></a>
## IND-02 — Ableton: identify latency stages and the critical path

Vendor documentation: one buffer stage lasts frames/sample rate; end-to-end latency also includes drivers, devices and DSP. Smaller buffers increase callback frequency and overhead. Lookahead and convolution can add algorithmic latency. [IND-S02: How Latency Works](https://help.ableton.com/hc/en-us/articles/360010545559-How-Latency-Works)

Reduced Latency When Monitoring bypasses compensation for other paths, not devices on the monitored path. [IND-S03: Monitoring FAQ](https://help.ableton.com/hc/en-us/articles/209072249-Reduced-Latency-When-Monitoring-FAQ) Direct monitoring bypasses the DAW monitoring route. [IND-S04: Reduce monitoring latency](https://help.ableton.com/hc/en-us/articles/360011924559-How-to-reduce-latency-while-monitoring)

Live’s CPU meter compares computation time with the buffer’s playback duration; averages can hide momentary overloads. [IND-S05: Live’s CPU Meter](https://help.ableton.com/hc/en-us/articles/360019151379-Live-s-CPU-Meter) Independent signal-path segments can run in parallel, but dependencies and summing points still wait; the critical path can miss a deadline before total CPU is saturated. [IND-S06: Multi-core FAQ](https://help.ableton.com/hc/en-us/articles/209067649-Multi-core-performance-in-Ableton-Live-FAQ) Crackles can also arise from disk supply or competing software; Ableton suggests progressive buffer comparisons on the same project. [IND-S07: Crackles and dropouts](https://help.ableton.com/hc/en-us/articles/209070329-How-to-avoid-crackles-and-audio-dropouts)

Engineering inference: observe solver age, main-thread delivery, native rendering and device latency separately. More Workers or average Task Manager CPU cannot replace deadline evidence. A direct-only reference still needs genuine solver data with correct medium and occlusion; an invented direct ray cannot conceal waiting.

<!-- english-original-anchor --> <a id="ind-03--fmodmixerread-aheaddecode-三種-buffer"></a>
## IND-03 — FMOD: mixer, read-ahead and decode buffers

Vendor documentation: DSP block size and count configure the mixer. Smaller values trade lower latency for overhead and underrun risk; configuration precedes initialization. [IND-S08: System DSP buffer](https://www.fmod.com/docs/2.04/api/core-api-system.html#system_setdspbuffersize)

The stream buffer handles file read-ahead, separately from the PCM decodebuffersize. Read-ahead for an already prebuffered stream does not directly add playback latency. [IND-S09: System stream/decode buffers](https://www.fmod.com/docs/2.04/api/core-api-system.html#system_setstreambuffersize)

CREATESAMPLE fully decodes on loading; CREATECOMPRESSEDSAMPLE retains compressed content and decodes during playback; CREATESTREAM incrementally reads and decodes, suiting large assets with few concurrent instances. [IND-S10: Loading and playing sounds](https://www.fmod.com/docs/2.04/api/loading-and-playing-sounds-in-the-core-api.html)

Logical channels and physically mixed software channels have different budgets. Virtual voices maintain position; priority and audibility select physical mixing. Some hardware-decoded streams retain a decoder while virtual. [IND-S11: Virtual voice system](https://www.fmod.com/docs/2.04/api/managing-resources-in-the-core-api.html#virtual-voice-system)

Engineering inference: Reflection Lab already has a decoded asset bank. Asset size, hit rate and decode peaks should justify any streaming addition. Budget logical state, physical rendering, decoders, paths and tails separately; silence does not imply resource release.

<!-- english-original-anchor --> <a id="ind-04--wwise虛擬化是明確的時間政策"></a>
## IND-04 — Wwise: virtualization is an explicit time policy

Vendor documentation: Wwise SDK 2025.1.12 gives these relative costs; they are not Reflection Lab measurements. [IND-S12: Understanding virtual voices](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=SDK&id=concept_virtualvoices.html)

| Return behavior | Relative CPU | Relative memory | Virtual/return behavior |
| --- | --- | --- | --- |
| Beginning | Medium | Low | No ongoing servicing; flush buffers; restart |
| Elapsed time | High | Low | Service each buffer; flush buffers; advance logical time |
| Resume | Low | High | Retain buffers; pause playhead |

Virtual streams consume no I/O. Refilling flushed buffers can delay audibility. Elapsed-time return is not sample accurate and may lose synchronization. [IND-S13: Advanced settings](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=advanced_settings_tab_actor_mixer_objects)

Voice starvation means missing the next output-buffer deadline; investigate CPU, preemption and voice work. [IND-S14: Voice starvation](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=ErrorCode_VoiceStarving) Source starvation concerns disk-stream supply; Streams and Streaming Devices distinguish throughput, prefetch and buffer-memory causes. [IND-S15: Source starvation](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=ErrorCode_StreamingSourceStarving) Performance Monitor and Advanced Profiler support time-series attribution. [IND-S16: Optimizing CPU](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=optimizing_cpu)

Engineering inference: specify whether omitted loops/one-shots continue, restart or expire, including replay consistency, before proposing virtualization. Existing priority rejection/stealing is not a full virtual timeline. Do not silently reduce acceptance load or remove recording events to meet resource targets.

<!-- english-original-anchor --> <a id="ind-05--jucespsc-邏輯與資料所有權分開"></a>
## IND-05 — JUCE: separate SPSC logic from data ownership

Vendor documentation: AbstractFifo manages indices and space for one reader and one writer; it owns no data. Prepare/finished calls or scoped handles publish actual amounts. Usable capacity is configured size minus one; wrapping can produce two spans. setTotalSize must not overlap other operations. [IND-S17: AbstractFifo](https://docs.juce.com/master/classjuce_1_1AbstractFifo.html)

AudioIODeviceCallback runs on a high-priority audio thread. Input is valid only during the callback; output must be filled, including zeros for silence. Block size is not guaranteed constant. [IND-S18: AudioIODeviceCallback](https://docs.juce.com/master/classjuce_1_1AudioIODeviceCallback.html)

Engineering inference: the application separately owns preallocated PCM and metadata. Publish after writing; recycle after consumption. Aggregate multiple producers first or give them separate queues. General FIFO retry guidance does not authorize waiting in an audio callback. No waiting for Workers, locks, network, geometry or unbounded allocation is consistent with the project’s existing AUDIO_RUNTIME rules.

<!-- english-original-anchor --> <a id="ind-06--chromeweb-audio保留-native-graph按實際-quantum-設計"></a>
## IND-06 — Chrome / Web Audio: preserve the native graph and use actual quantum sizes

Vendor documentation: Chrome’s 2018 article uses 128-frame examples. A ring adapts kernel blocks without extending the same render callback’s deadline. A Worker with shared memory can produce PCM ahead, but AudioWorklet never waits for it; missing data can still glitch. [IND-S19: Audio worklet design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern)

The Web Audio 1.1 Editor’s Draft dated 2026-10-31, revision 3e4bdbd0976d87b34877dd728a9ec0596d567830, defines renderSizeHint, which may be ignored. AudioParam supports a-rate/k-rate; a Worklet parameter array can contain a single constant value. Process actual channel lengths. [IND-S20: Web Audio 1.1 ED](https://webaudio.github.io/web-audio-api/)

ChromeStatus lists configurable quantum shipping in Chrome 153 and warns that its accuracy has not recently been rechecked. [IND-S21: Configurable render quantum](https://chromestatus.com/feature/5078190552907776) It lists AudioPlaybackStats shipping in 146, with underrun count/duration and latency statistics; playoutStats is a deprecated alias. [IND-S22: Playback statistics](https://chromestatus.com/feature/5172818344148992) These are specification/vendor records, not local browser tests: feature-test and report unavailable values.

Tracing can distinguish callback misses, Worklet execution and GC. Recheck the 2020 guide’s UI and threading descriptions against the actual version; they are not current scheduling guarantees. [IND-S23: Profiling Web Audio](https://web.dev/articles/profiling-web-audio-apps-in-chrome)

Engineering inference: this baseline uses native AudioNodes for sources, gain, delay, convolution and HRTF; searches of src/server found no custom processor registration path. Measure main-thread control and native graph work first. Introduce PCM rings only when evidence justifies custom DSP or streaming. AudioPlaybackStats alone cannot identify the offending queue.

<!-- english-original-anchor --> <a id="ind-07--對-reflection-lab-的有條件結論"></a>
## IND-07 — Conditional conclusions for Reflection Lab

1. Start with attribution and the contracts in [buffer D1–D8](BUFFER_ARCHITECTURE_REVIEW.md); there is no universal buffer size.
2. Preserve existing asset/FIR caches, voice/path caps, revision gates and bank reuse. Add telemetry before LRU, SAB or PCM transport.
3. Interactive freshness, complete discrete-event order, recording losslessness and offline throughput need distinct backpressure. Latest-value overwrite is not valid for every data type.
4. New measurements, configuration comparisons, audible glitches/device latency and long-run stability are NOT RUN. This page establishes no performance improvement.

<!-- english-original-anchor --> <a id="來源存取與版本界線"></a>
## Source access and version boundaries

All sources are official pages, recorded only as links, metadata and short paraphrases. No manual or SDK was redistributed. Complete remote copies/content hashes were not retained; pages can change. Versions describe the retrieved pages, not the latest installed release on every platform.

| Source ID | Verified version/date | Access and limitations |
| --- | --- | --- |
| IND-S01 | REAPER 7.84 / November 2026 | Official HTML readable; latest PDF around 28.55 MB exceeded web-fetch size limits; settings images unread. No unverified numeric defaults used |
| IND-S02–07 | Current Ableton KB; S02: All Live Versions; S05 covers Live 11 onward | Text readable; most pages lack pinned releases. Live not executed |
| IND-S08–11 | FMOD Engine User Manual 2.04 | Official API/guide readable; no installation or benchmark |
| IND-S12–16 | Wwise public-library 2025.1.12_9287; SDK 2025.1.12 | Pinned URLs readable; old edge/guessed virtual_voice ID returned 404 and supports no claim |
| IND-S17–18 | JUCE master retrieved 2026-11-01 | Readable; master is not a pinned release/commit. Pin before reuse |
| IND-S19 | Chrome article updated 2018-06-18 | Historical patterns; fixed quantum/deployment statements are not universal current facts |
| IND-S20 | Web Audio 1.1 ED, 2026-10-31, revision above | Readable; Editor’s Draft separated from implementation support |
| IND-S21–22 | ChromeStatus retrieved 2026-11-01; S22 updated 2026-07-23 | Lists shipping 153/146; does not establish local or non-Chromium support |
| IND-S23 | web.dev updated 2020-05-04 | Readable; historical profiling UI requires installed-version verification |