<!-- english-source: {"path":"docs/12-architecture-review/OFFLINE_RENDERING_RESEARCH.md","sha256":"889a59520b8ff61c47474e8d9092f10e06bfa8952d864091a3189ca0af19bb21","translated_at":"2026-10-29T05:23:28Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/OFFLINE_RENDERING_RESEARCH.md`](../../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md). Source SHA-256: `889a59520b8ff61c47474e8d9092f10e06bfa8952d864091a3189ca0af19bb21`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="離線音訊渲染研究"></a>
# Offline Audio Rendering Research

Date: 2026-10-29 (Asia/Taipei). Baseline: `c210ca882ca8503b322c28884bf1e9f6e9fe126d`. This page separates official-document review, current code, historical measurements and unimplemented plans. Individual OfflineAudioContext graph tests, research benchmarks and type contracts do not establish a complete recording-export product. All official sources were accessed this round on 2026-10-29; only references and short summaries are retained, with no downloaded or redistributed specification full text.

<!-- english-original-anchor --> <a id="結論與最小演進"></a>
## Conclusion and Minimal Evolution

Existing `AudioEngineOptions.context: BaseAudioContext` already accepts injected realtime or offline contexts; `engine.isOffline()` avoids realtime context resume, and native DSP tests actually inject OfflineAudioContext. Preserve SourceGraph and models instead of building a second sound/propagation engine. The missing piece is scheduling, job lifecycle, output taps/storage and capacity policy for “complete RecordingArtifact → verifiable PCM outputs.”

This round adds only the types-only job interface in [render-contract.ts](../../../src/audio/render-contract.ts) (Category B/PLAN). It connects no backend, changes no live routing and enables no paid/cloud service. [Recording research](RECORDING_AND_REPLAY_RESEARCH.md) explains input/replay integration; existing graph and delay/gain responsibilities remain governed by [AUDIO_RUNTIME](../02-architecture/AUDIO_RUNTIME.md).

<!-- english-original-anchor --> <a id="官方能力與版本文件查核非本輪瀏覽器實測"></a>
## Official Capabilities and Versions (Document Review, No New Browser Execution)

| Claim ID | Reviewed fact | Implementation implication/limit |
| --- | --- | --- |
| OFF-01 | [Web Audio 1.0 REC 2021](https://www.w3.org/TR/2021/REC-webaudio-20210617/#OfflineAudioContext) defines fixed-length, one-time `startRendering()` returning an in-memory AudioBuffer | Suitable baseline for a bounded one-shot backend; does not record hardware or guarantee a particular speedup over realtime |
| OFF-02 | [Web Audio 1.1 WD 2026-09-22](https://www.w3.org/TR/2026/WD-webaudio-1.1-20260922/#OfflineAudioContext) adds nullable length, `startRendering(chunkSize)`, close and renderSizeHint; still a Working Draft | The old blanket statement that Web Audio can never render incrementally is outdated; the draft also does not establish existing cross-browser support |
| OFF-03 | [Chromium main IDL](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/webaudio/offline_audio_context.idl) gates chunk overload/close on runtime feature `OfflineAudioContextIncrementalRendering`; observed blob `3002a96921cb83915c6930aace18fde131259053` | Source proves gating for that revision, not target stable-browser behavior; incremental capability and continuous-state oracles require separate tests |
| OFF-04 | [1.0 suspend specification](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-offlineaudiocontext-suspend) rounds up to render quantum and disallows duplicate suspension at one quantized position; [MDN suspend](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/suspend) instead says down | Sources conflict. Pin the normative version and record actual engine behavior; suspend is not a universal sample-accurate control point |
| OFF-05 | [BaseAudioContext.audioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/audioWorklet) provides custom processing; [process](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process) must inspect actual channel-array lengths; [currentFrame](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/currentFrame) is the block sample-frame clock | API architecture accommodates offline Worklet, but secure context, loading, target engine and combinations still need tests. Do not hardcode 128 frames per block |
| OFF-06 | [AudioScheduledSourceNode.start](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-audioscheduledsourcenode-start) uses context seconds for `when` and requires the precise scheduled time | Project tick→sample quantization is an explicit policy; it is not a claim that all native Web Audio events inherently round to the same sample |
| OFF-07 | [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) contains planar Float32 PCM; its [constructor](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/AudioBuffer) can fail for insufficient memory | No universal maximum minutes/fixed MB follows from this; use explicit budgets and real rejection paths |
| OFF-08 | [AudioNode tail-time](https://www.w3.org/TR/2021/REC-webaudio-20210617/#tail-time) explains that past input can continue affecting later output | Recreating a context cannot automatically continue filter/delay/convolution state; export windows must explicitly address history and tail |

[`MDN startRendering`](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering) still documents the no-argument interface. That differs from the newer incremental draft and cannot be merged into one compatibility conclusion. An old API can ignore extra JavaScript arguments; `startRendering(chunkSize)` not throwing does not prove incremental rendering.

<!-- english-original-anchor --> <a id="現有程式與實測邊界"></a>
## Current Code and Measurement Boundaries

| Existing item | Behavior/evidence available | Unsupported claim |
| --- | --- | --- |
| [AudioEngine](../../../src/audio/engine.ts)/[types](../../../src/audio/types.ts) | BaseAudioContext injection; direct/early routes, band filtering, HRTF, late bus, headroom, monitor, limiter, source cursors and pause/restore | Calling every replay frame before startRendering automatically produces a correct dynamic full-scene render |
| [ReplayAudioHost](../../../src/app/replay-audio.ts) | Applies recorded start/update/stop/listener by tick; validates artifact/original content/asset pins; seek does not emit old impacts again | Current API is realtime control. updateVoice/updateListener/stopVoice schedule against context.currentTime, without a complete future sample-index control timeline |
| [Native tests](../tests/audio-runtime/README.md) | Real OfflineAudioContext fixtures cover individual energy, arrival, reverb, pause, continuity and restore behavior; [cross-engine results](../tests/audio-runtime/CROSS_ENGINE.md) retain Firefox numerical FAIL and API blocking in the specific WebKit build | All engines passed, or human listening/device latency/Worklet underrun/long-duration capacity passed |
| [WAV preflight](../../../src/audio/wav.ts) | Bounded RIFF/WAVE PCM/float32 **import** checking and decode-memory estimates; compressed formats/bad data rejected | A WAV export encoder exists; RIFF writing/large files/dither/quantization/stem naming still need separate work |
| [Recording worker](../../../src/experiments/recording-worker-client.ts) | Moves trace validation/sealing to Worker while preserving hashes/bytes/errors | Worker itself supplies Web Audio offline rendering, PCM streaming or removal of all main-thread long tasks |

Scheduling is the principal implementation risk: invoking all frame updates through realtime APIs before rendering, while `currentTime = 0`, does not automatically place them at their recorded ticks. First convert emissions, gain/pitch/filter changes, source/listener positions, path birth/death and IR updates into an ordered control timeline. Preschedule eligible AudioParams on the audio clock; graph mutations need verified quantum control points or a sample-aware Worklet. Existing prohibitions on waiting for geometry/AI/network in audio callbacks continue to apply.

<!-- english-original-anchor --> <a id="renderjobrenderbackend-預留plan"></a>
## RenderJob/RenderBackend Reservation (PLAN)

`RenderJob` is serializable data: references to the original recording and complete render configuration artifact (stable IDs/SHA-256), scene revision, required backend ID/version/capabilities, rational tick→sample mapping, exclusive tick window, preroll/tail, listener/HRTF, output selection and memory/output budgets. `RenderBackend.render(job)` returns completion or explicit failure/cancellation; `cancel(jobId)` is idempotent. Completion reports actual backend/engine/capabilities and each output's hash/sample rate/frame count/peak/samples outside unit range/clipping count/historyIncomplete/tailTruncated.

Every request must match exactly one output by `requestId`, with the same sample rate/origin/length/gain configuration. Verify references, revisions, materials/assets, clocks and byte hashes before publishing completed. renderConfiguration should pin solver, speed of sound/atmosphere, geometry, asset sample-rate conversion, profile revisions, HRTF, whether IR includes direct sound, normalization, headroom, limiter parameters and other audio-graph settings. Backends cannot report required capabilities as observed capabilities.

Output sample 0 corresponds to `sample(startTick)` and length is exactly `sample(endTickExclusive) − sample(startTick) + tailFrames`; remove preroll and backend quantum padding. Reject negative samples, invalid denominators, non-integer counters and intermediate multiplication overflow instead of allowing backend-specific rounding. `RenderArtifactRef.sha256` verifies stored bytes; `recordingContentSha256` separately verifies the recording's canonical body hash. `jobSha256` uses existing canonical JSON/SHA-256 rules over the entire RenderJob, including source selection/tail/listener/HRTF/configuration references.

Job identity/cancellation are also PLAN: within one backend scope, the same jobId and job hash return the same terminal result; the same ID with changed content conflicts, and a new job retry uses a new ID. `cancel(jobId)` is idempotent. Cancellation accepted before final atomic publication wins and yields cancelled. Published completed results remain immutable; later cancellation does not delete success. Cancelling an unknown ID does not create a job. Cancel/completion races, repeated requests, crash recovery and exactly-once publication still require real host/backend tests; the type interface implements none of these guarantees.

Current types allow only `float32Pcm` and `normalization:none`, deliberately without an unverified encoder or normalization flow. Types provide no runtime validation of untrusted JSON and no actual backend/validator/job registry. Output artifact references abstract host storage; they authorize no uploads, external URLs or cloud services.

<!-- english-original-anchor --> <a id="window尾音與-clipping"></a>
## Window, Tail and Clipping

Apply `absolutePropagationDelay` exactly once for each emission. Tail must cover direct/early arrivals still pending after the final emission, filter group delay, late IR/reverb state and fades. Do not cut at the last source-emission timestamp. Finite IR tails can use known support length; IIR/some reverbs can have theoretically infinite tails. An explicit threshold plus maximum frames is a numerical/perceptual approximation, with method and truncation recorded. Insufficient decay does not produce RT60.

Preroll and captured source cursors solve different problems. A cursor restores source playhead, not generic prior filter/delay/convolver/native-HRTF hidden state. Mid-run recordings lacking earlier input or a verifiable DSP snapshot must mark historyIncomplete even if the source cursor is complete; they cannot claim equivalence to rendering continuously from the beginning. Realtime seek's old-tail cutoff is also different from offline editing's natural-tail preservation.

Float32 PCM can contain finite values above 1. `samplesOutsideUnitRange` counts samples outside the unit range and does not directly establish clipping. `clippedSampleCount` should describe actual hard limiting/format-conversion clipping. Limiter/compressor changes peaks and dynamics; pin parameters and processing position. Uncalibrated dBFS cannot become dB SPL. Check peaks, sample count, NaN/Infinity, tails and unexpected silence; file existence alone is not success.

The minimal type confines clipping observation to final `float32OutputConversion`, using unavailable plus reason when it cannot be observed. Unknown is not zero, and final PCM must not be used to guess prior clipping inside opaque DSP. Measure peak/outside-unit-range counts on the same delivered PCM before publication, while pinned graph configuration discloses nonlinear master processing.

<!-- english-original-anchor --> <a id="聲源drywet-與-stems"></a>
## Sources, Dry/Wet and Stems

Source selection filters only originally admitted emissions, retaining all physics/geometry/Behavior admission. Freed voice capacity must not alter other emissions. Use stable sourceId, including multiple one-shot/continuous emitters on an object. Process delay/bands/arrival direction separately for differently positioned sources; do not mix them first at object COM.

Each selection uses `independentGraphPerSelection`: filter emissions first, then reconstruct the output's complete audio graph from the same pinned configuration. Unselected signals drive no reverb/compressor in that output. This explicitly defined isolated rendering does not extract an exact contribution from the original full mix's shared nonlinear bus. Compatible taps for all sources/the same selection can share one graph execution only if semantics remain unchanged.

| Tap | Contract meaning | Reconstruction limit |
| --- | --- | --- |
| `dryContent` | Authored generator/sample/gain/pitch/envelope; no propagation, spatialization or master | Not hardware output of Raw monitoring; preserve shared emission phase and original sample start offset |
| `direct`/`early` | Each solver path's delay, bands and arrival-direction spatialization exactly once; before master | Do not add extra distance attenuation, another d/c delay or duplicate HRTF to stems |
| `late` | Late-bus output with its declared send path; current synthetic reverb remains Synthetic/perceptual approximation | Not a wall-solved RIR; shared reverb with nonlinearity/state modulation requires additional summation validation |
| `simulatedMix` | Direct + early + late before master | Different overlap windows/gains/phases/tails can still prevent summation equality |
| `master` | All selected sources mixed, then passed through pinned headroom/limiter/output gain | Processing each source through a limiter independently and summing generally differs from limiting the combined mix |

Do not leave `wet` undefined. This minimal contract separates direct/early/late. If a future product offers wet = early + late, explicitly define its combination and output metadata. Validate stem summation against pre-master mix only when routes, processing and mixing meet linear/equivalent time-varying conditions, the window/phase match and shared state is correct. Compressor/limiter/waveshaper/nonlinear effects, changed voice admission or independent stem normalization can break equality. Such mismatch must not automatically be diagnosed as a physics-energy error.

<!-- english-original-anchor --> <a id="一次性增量與重建分段"></a>
## One-Shot, Incremental and Reconstructed Segments

| Strategy | Memory/state | Project position |
| --- | --- | --- |
| Bounded one-shot OfflineAudioContext | Entire PCM in memory; state remains continuous inside the graph; assets and control data must be ready before starting | Candidate for first implementation, NOT RUN; reject excess using maxOutputFrames/working bytes |
| Native incremental rendering in one context | New draft describes this, but target-engine support and cross-chunk graph continuity require tests | Reserve `statePreservingChunks`; passing chunkSize without an exception is insufficient |
| Separate new context per segment | A new context lacks previous hidden delay/filter/IR/HRTF/limiter state | No assumed seamless equivalence; require verifiable state transfer or sufficient history/overlap/cropping with a validated error bound |
| Realtime AudioContext/MediaRecorder recording | Runs on wall time, scheduling and encoding paths, potentially with device/format limits | A separate capture pipeline, not a substitute for a reproducible offline PCM renderer |

Offline rendering must not rely on Worker/AI/network frames arriving at realtime speed. Complete asset decode/hashes/Worklet addModule/control timeline first, or use an incremental protocol with explicit backpressure and acknowledgements. Rendering so fast that control messages arrive late is a correctness failure, not merely a performance improvement.

<!-- english-original-anchor --> <a id="容量預算解析估算非裝置量測"></a>
## Capacity Budget (Analytical Estimate, Not Device Measurement)

Minimum Float32 PCM data size is `4 × channels × sampleRateHz × durationSeconds` bytes. Stereo at 48 kHz for 60 seconds is 23,040,000 bytes (about 21.97 MiB); 10 minutes is 230,400,000 bytes (about 219.73 MiB). These are analytical sizes of a single output PCM, **not browser allocation limits or measured peak working sets**.

Also budget simultaneous stems, decoded assets, dual IR banks, delay buffers, Worklet/WASM heap, control/trace data, structured clones/AudioBuffer copies, encoded output and storage transactions. Calculate bounds and limit outputs/frames/bytes first; return failed on actual memory/quota errors. Do not discover limits with unbounded allocations and try-catch. Incremental APIs do not automatically eliminate decoded-asset/graph-state costs. Traditional RIFF/WAVE large-file limits, RF64, 24-bit/dither and other formats remain future capabilities; none is implemented this round.

<!-- english-original-anchor --> <a id="未來驗證條件與本輪狀態"></a>
## Future Validation and This Round's Status

1. Probe actual API/rate/capabilities for every backend and reject unsupported requirements explicitly. Preserve original oracles; cross-engine differences must not relax existing FAIL thresholds.
2. Use impulse/sine/step/loop/pitch-mapping/late-capture/same-tick-event/moving-listener cases to check tick→sample boundaries, arrival, phase, updates and stops. Distinguish sample accuracy from suspend quantum precision.
3. Obtain a one-shot reference from the same full scene/trace; compare full PCM, segment seams, tails, dry/path taps, stem sums and expected non-equivalence of shared nonlinear master processing.
4. Check missing assets/hash mismatches/revisions/budget excess/cancellation/crash/partial-output failure. Never publish completed partial results; retain diagnostics and retry identity.
5. Measure peak working memory, duration, speed, bytes and storage failure. Keep listening, device latency, SPL and real Worklet underrun separate; PCM examples do not establish them.

This round completed current code/schema/test and official-document review plus a minimal pure-type contract. New renderer/encoder/listener override/HRTF-asset adapter/stems/incremental-chunk browser tests are all **NOT RUN/not implemented**. Typecheck and original-regression results belong to this integration's verification receipt; document text is not a test-execution record.

Actual commands this round: Node `22.17.0`/npm `11.4.2`; `npm run typecheck` PASS; Prettier check for both TS files PASS. No implementation-mirroring tests were added for pure types, and no new browser/audio test was run. Independent read-only review identified output-window, selected-source bus and clipping-availability ambiguities; these were clarified in the contract. That is not renderer runtime PASS evidence.
