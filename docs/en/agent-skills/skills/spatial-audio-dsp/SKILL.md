<!-- english-source: {"path":".agents/skills/spatial-audio-dsp/SKILL.md","sha256":"d3fb7450947aa9fc2d56e320967bc1f78d919c0974ca9570750f0f34bd37145c","translated_at":"2026-10-27T03:38:38.947915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: spatial-audio-dsp
description: Handle Reflection Lab HRTF, SourceGraph, propagation delay, early paths, reverb, and audio continuity; not for organizing paper bibliographies.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/spatial-audio-dsp/SKILL.md`](../../../../../.agents/skills/spatial-audio-dsp/SKILL.md). Source SHA-256: `d3fb7450947aa9fc2d56e320967bc1f78d919c0974ca9570750f0f34bd37145c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="空間音訊-dsp"></a>
# Spatial Audio DSP

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

Preserve time and energy definitions when changing the audio graph/AcousticFrame mapping/delay or IR updates.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

Source signal, emission epoch, sample rate, backend capabilities, path/IR metadata, and voice budget.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read AUDIO_RUNTIME and DSP_MODELS; confirm whether direct is included in the IR, normalization, and the semantics of band gains.
2. Separate continuous emitters from collision voices; send the same emission to direct/early/late, and count absolute delay only once.
3. Use the last sound-ray segment for the HRTF arrival direction; disable duplicate attenuation when calculating distance gain yourself.
4. Assign voices by stable path ID, and crossfade birth/death and IR banks. Do not apply a duplicate pitch shift when delay changes produce Doppler.
5. Use the actual block length and preallocated bounded buffers in the callback; do not wait for workers, AI, or the network, and do not perform geometry work.
6. Keep raw/simulated gain consistent; output level is dBFS and must not be converted to dB SPL without calibration.
7. Separate Sound Behavior sound content from physics/propagation; all 3D sounds pass through a unified SourceGraph. Contact positioning is not always COM, and audition does not enter experiments. Before adding features, read docs/10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md and EVENT_MODEL.md.

<!-- english-original-anchor --> <a id="references"></a>
## References

`docs/02-architecture/AUDIO_RUNTIME.md`, `DATA_CONTRACTS.md`, `research/theory/DSP_MODELS.md`, `docs/06-validation/ACOUSTIC_VALIDATION.md`.

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Audio graph, parameter semantics, clock policy, headroom/voice telemetry, and DSP validation evidence.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

Analytical impulse arrival is only a V1/V2 foundation; a new audio graph requires OfflineAudioContext/browser output tests. List listening tests and device latency separately.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

For expired frames, reuse the most recent valid values and mark stale; show degradation when voices are exceeded. Return unavailable when IR/paths capabilities are absent; do not generate substitute fake data.
