<!-- english-source: {"path":"docs/02-architecture/AUDIO_RUNTIME.md","sha256":"791c1f8c2db033f810850c022d9abff73d07593920dbd53cd9c621fb1aa04790","translated_at":"2026-11-02T10:45:05.9461910+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/AUDIO_RUNTIME.md`](../../02-architecture/AUDIO_RUNTIME.md). Source SHA-256: `791c1f8c2db033f810850c022d9abff73d07593920dbd53cd9c621fb1aa04790`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="音訊與動態聲學執行規格"></a>
# Audio and Dynamic Acoustics Runtime Specification

2026-11-02 update: Production src/audio/ has a native Web Audio SourceGraph; custom AudioWorklet remains research/future work, with no product processor registration path found. See the [Acoustic Research](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md) for native DSP component evidence and currently unverified scope. The design semantics below remain and do not establish complete Worklet delivery, hearing or performance acceptance. RenderBackend now implements finite short-take mix/stems through a real native OfflineAudioContext and the same AudioEngine: at most 30 seconds of emissions, 45 seconds per context and 16 outputs, with working/output estimates of 256/192 MiB. This is neither a complete long-recording renderer nor a browser-peak guarantee. For theory, see research/theory/DSP_MODELS.md. The stable specification reference is the [Web Audio 2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/); new 1.1 Working Draft capabilities require per-engine feature tests rather than assumed universal support.

<!-- english-original-anchor --> <a id="sourcegraph"></a>
## SourceGraph

Continuous generator / buffer loop and collision one-shot → their respective emission gain → direct delay/filter/spatialization; the same emission signal is also sent to the early-path bank and late reverb bus → master headroom → limiter (explicitly identified as changing peaks) → product output safety ceiling (linear below -1 dBFS, bounded below full scale; added after the 2026-10-30 R18 review) → output. Continuous loops are not rebuilt because of grabbing or zero gravity. Raw is a dry-centered bypass using the same asset/event/seed/playhead (including environment and HRTF bypass); Simulated uses propagation and spatialization supported by the backend. Switching changes monitoring only, with a ramped crossfade, the same emission / gain, and no hidden normalization or delay compensation. Any additional direct-only spatial reference must have a separate name.

Direct and every early path each have their own delay, band filtering, gain, and arrival direction. The PannerNode HRTF position should represent the arrival direction. If applying 1/r yourself, turn off the Panner distance rolloff to avoid double attenuation. The binaural direction of a reflection uses the incoming direction of the final segment, not the original source direction. Late reverb may initially use an original synthetic IR / FDN approximation with an explicit model label; artistic RT parameters must not be claimed as measured room results.

<!-- english-original-anchor --> <a id="時鐘"></a>
## Clocks

After a user gesture starts AudioContext, establish an epoch `(simulationTimeS, audioContextTimeS)`. For emission time te, schedule `audioEpoch + (te - simEpoch) + absolutePropagationDelay`; pause / resume reanchors the clock and follows the selected tail policy. If an event is already late, follow an explicit policy of recording it as late / dropping it / playing it immediately; scheduling into the past is impossible. Report device output latency, DSP block latency, and the d/c physical delay separately. AudioContext currentTime is not the time sound actually reaches the user's ears.

The initial Pause policy is Freeze-and-fade: freeze the logical tick, source offset, and event cursor; fade out the run bus with a 20 ms design target (not yet DSP-validated); truncate the old reverb tail and mark an interrupted boundary. Cancel actual scheduling from the old audio epoch while retaining logical arrivals that have not yet arrived. Resume explicitly reanchors the epoch and reschedules only these outstanding arrivals once, without dispatching recorded impact emissions / already-heard events again. AudioContext may keep running for independent paused audition; audition is excluded from experiment metrics. Recording / A/B does not discard physics ticks; pause on performance overrun and record the reason.

An accurate dynamic propagation model uses retarded emission time and cached pose history. The initial low-speed, per-update quasi-static d/c model can only be labeled approximate. If variable delay already produces Doppler, do not additionally multiply playbackRate; fixed delay plus an independent pitch shift can likewise only be labeled a perceptual approximation. Fast motion and abrupt delay changes require fractional delay / crossfade; discontinuous jumps must not cause clicks.

<!-- english-original-anchor --> <a id="thread--continuity"></a>
## Thread / continuity

The audio callback must not fetch, await, read files, perform geometry work, write unbounded logs, or hold a lock while waiting for another thread. Pool voices and buffers, and use the actual sample block length. Messages carry a sequence; replace outdated control frames. Continuous parameters have ramps; path birth/death uses finite-duration fades, and ranking swaps preserve identity. SharedArrayBuffer is an optional later optimization. Evaluate the impact of COOP/COEP on deployment and assets first; do not assume it must be available.

IR updates require at least a dual-bank crossfade; budget for the doubled memory and computation. Check the default Convolver normalization behavior, and disable automatic normalization for physical gain tests. FIR, IR, and energy histogram must not be conflated as the same representation. Actual AudioWorklet underrun, browser HRTF, headphone listening tests, device latency, and the V2 audio graph are all NOT RUN.

<!-- english-original-anchor --> <a id="初版-scope"></a>
## Initial-Version Scope

Boxes, spheres and capsules support bounded first-order reflection/occlusion. dynamicReflector uses current real poses for quasi-static solving; moving emitters/listeners have the same model limitations. A Dynamic rigid body used as a sound source does not automatically receive a reflector role; non-Fixed staticSurface remains occlusion-only. Curved surfaces include no focusing/caustics/curvature divergence, retarded-time or moving-boundary Doppler; see the [model contract](../15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md). Scene-topology updates still require pause/explicit-commit validation. Behavior logical instances and native voice/early-path/reverb capacities are separate. Over-budget rejection/suppression and its reasons must be explicit, rather than silently presented as complete physics.

<!-- english-original-anchor --> <a id="sound-behavior-接口2026-10-27設計"></a>
## Sound Behavior Interface (2026-10-27 Design)

Under [ADR-014](adr/014-sound-behavior-system.md), Behavior produces only logical instance / generator and emitter intents; all 3D content enters the same SourceGraph above, without a separate master connection. AlwaysOn is not interrupted by OnImpact or grabbing; an impact anchor comes from contact and must not always be the COM. Rules and material timbre are separate from physics / propagation coefficients. See the [Behavior Architecture](../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md) for data and states.

The pool reuses decoded buffers and manages slots; a stopped AudioBufferSourceNode cannot be started again. Continuous playback keeps its current loop, while a new one-shot requires a new source. Different emitters must not first be mixed at the COM to save nodes. All distance / delay / HRTF / Doppler responsibilities follow this document's original clock policy; there is no second DSP specification. [Pinned Web Audio REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

The above describes the 2026-10-27 design. The finite evaluator, bridge, Inspector and native SourceGraph are now implemented and share the propagation chain. Capabilities for 19 triggers depend on trusted Host producers and a valid Zone registry; this is no longer only a draft-validator stage. Rules/logical instances/native voices/emitters/paths/decode memory have layered limits; schema limits are not measured capacity. Existing code, limited browser and digital-WAV receipts are in the [core handoff](../14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md). They do not establish complete routing/loop continuity, click/pop, underrun or headphone acceptance. Custom AudioWorklet is still not registered.

<!-- english-original-anchor --> <a id="有限離線輸出2026-11-02"></a>
## Finite offline output (2026-11-02)

The renderer drives the existing AudioEngine with recording-pinned sound decisions, poses/paths, assets and time windows, producing stereo float32 WAVs and a manifest containing source, settings and file hashes. Wet is pre-master direct+early+Synthetic late; Dry is content before propagation/spatialization and master processing. Pre-master stems for the same sources can sum to Wet within the specified floating-point tolerance. Master contains the established headroom/monitor/limiter and safety graph; independently processed nonlinear outputs are not required to add linearly. Controls update on native quanta without a sampleScheduledControls promise.

Insufficient source data, cancellation, exhausted budgets or render failure do not publish partial new artifacts. Native HRTF identity is browserManagedUnspecified; pure late taps, custom asset HRTF, listener replacement and long stateful chunks/ADM/cloud remain unsupported. Actual UI export and independent PCM analysis each retain their own source point. Later native-app access failure is not relabeled success. No human-hearing, 600-second performance or complete calibrated-acoustics pass is inferred.
