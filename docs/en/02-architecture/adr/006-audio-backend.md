<!-- english-source: {"path":"docs/02-architecture/adr/006-audio-backend.md","sha256":"b49af84d4531ee93acd00c9ef251531fe676c6b84110580f23208a92375b3f28","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/006-audio-backend.md`](../../../02-architecture/adr/006-audio-backend.md). Source SHA-256: `b49af84d4531ee93acd00c9ef251531fe676c6b84110580f23208a92375b3f28`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-006audio-rendering-backend"></a>
# ADR-006: Audio Rendering Backend

- Status: Accepted for preproduction; the real audio graph has not yet been validated at V2/V5.
- Context: Continuous emission, collision voices, HRTF, path delays, and reverb must jointly maintain temporal continuity.
- Decision: A Web Audio source graph; use native nodes first when sufficient, introducing AudioWorklet only for fractional delay/high-density path banks. The audio thread must never wait for AI/workers; use a single emission epoch.
- Alternatives: A full native renderer (fallback requires complete native device/clock testing); many PannerNodes per path (cap/profile first); offline convolution (usable for analysis, but not interactive).
- Evidence: [Web Audio 2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/), [AUDIO_RUNTIME.md](../AUDIO_RUNTIME.md). The floating URL now redirects to the 1.1 Working Draft.
- Trade-offs: Browser HRTF, output latency, and node limits depend on the implementation; identical sound across all browsers cannot be guaranteed.
- Risks: Double distance gain/delay, delay jumps, IR normalization, late events, and voice clipping. When propagation is computed internally, avoid applying the same effect again.
- Reversibility: SpatialAudioRenderer accepts neutral frames/events; a future native implementation must provide equivalent capabilities.
