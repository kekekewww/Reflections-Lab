<!-- english-source: {"path":"docs/02-architecture/AUDIO_RUNTIME.md","sha256":"8da89aaeb25a4f7bb6683f879b03ec5618cd599995c7b3246b00b6794645e3a9","translated_at":"2026-10-29T05:32:21Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/AUDIO_RUNTIME.md`](../../02-architecture/AUDIO_RUNTIME.md). Source SHA-256: `8da89aaeb25a4f7bb6683f879b03ec5618cd599995c7b3246b00b6794645e3a9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="音訊與動態聲學執行規格"></a>
# Audio and Dynamic Acoustics Runtime Specification

2026-10-29: Production src/audio/ now has a native Web Audio SourceGraph; custom AudioWorklet remains research / future work, with no product processor registration path found. See the [Acoustic Research](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md) for native DSP component evidence and currently unverified areas. The design semantics below are retained and cannot establish that complete Worklet delivery, listening tests, or performance have passed. RenderBackend currently has a types-only contract; complete offline mix / stems remain unimplemented. For theory, see research/theory/DSP_MODELS.md. The stable specification reference is the [Web Audio 2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/); new 1.1 Working Draft capabilities require per-engine feature tests and cannot be treated as universally supported.

<!-- english-original-anchor --> <a id="sourcegraph"></a>
## SourceGraph

Continuous generator / buffer loop and collision one-shot → their respective emission gain → direct delay/filter/spatialization; the same emission signal is also sent to the early-path bank and late reverb bus → master headroom → limiter (explicitly identified as changing peaks) → output. Continuous loops are not rebuilt because of grabbing or zero gravity. Raw is a dry-centered bypass using the same asset/event/seed/playhead (including environment and HRTF bypass); Simulated uses propagation and spatialization supported by the backend. Switching changes monitoring only, with a ramped crossfade, the same emission / gain, and no hidden normalization or delay compensation. Any additional direct-only spatial reference must have a separate name.

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

Static rooms / reflecting surfaces, moving emitters / listeners. Using a dynamic rigid body as a sound source does not mean it also becomes a dynamic reflector; these are separate capabilities. Dynamic occlusion can be added later; scene topology updates take effect on pause / explicit commit. Limit the total budget for sound-effect voices / early paths and reverb sends; on overrun, degrade and display dropped voices. Do not silently present the result as complete physics.

<!-- english-original-anchor --> <a id="sound-behavior-接口2026-10-27設計"></a>
## Sound Behavior Interface (2026-10-27 Design)

Under [ADR-014](adr/014-sound-behavior-system.md), Behavior produces only logical instance / generator and emitter intents; all 3D content enters the same SourceGraph above, without a separate master connection. AlwaysOn is not interrupted by OnImpact or grabbing; an impact anchor comes from contact and must not always be the COM. Rules and material timbre are separate from physics / propagation coefficients. See the [Behavior Architecture](../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md) for data and states.

The pool reuses decoded buffers and manages slots; a stopped AudioBufferSourceNode cannot be started again. Continuous playback keeps its current loop, while a new one-shot requires a new source. Different emitters must not first be mixed at the COM to save nodes. All distance / delay / HRTF / Doppler responsibilities follow this document's original clock policy; there is no second DSP specification. [Pinned Web Audio REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

Rule count / voices / active emitters / paths / decode memory must each have separate limits, measured against the existing formal budget; schema hard limits do not imply usable performance. This interface has not yet been implemented. Browser routing, loop continuity, click/pop, underrun, and headphone tests remain NOT RUN.
