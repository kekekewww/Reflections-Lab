<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/19-runtime-audio-policy-source-review.md","sha256":"151c52b417c1c2c7f674fdf47d9b7cfa93e779e016704e1c80cd81512a75bc9f","translated_at":"2026-11-03T02:21:45.875Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/19-runtime-audio-policy-source-review.md`](../../../../16-nonadvanced-completion/lanes/performance/19-runtime-audio-policy-source-review.md). Source SHA-256: `151c52b417c1c2c7f674fdf47d9b7cfa93e779e016704e1c80cd81512a75bc9f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="runtime-audio-resource-policy限定來源審查"></a>
# Runtime Audio Resource Policy: Scoped Source Review

Conclusion: NO_P1_P2_REMAINING_SOURCE_REVIEW_ONLY. This round read only the scoped src/app/runtime.ts diff against eb45d19aee08a3b68a768c82af4fa192ea0b26fc, actual AudioEngine/diagnostics sources, and existing receipts. No Node, test, typecheck, format/lint, build, or browser was run; product/tests were unchanged. See the same-named JSON for complete source SHAs, original fixture, TAP hashes, and observed HEAD.

<!-- english-original-anchor --> <a id="選項與原配置"></a>
## Options and Original Configuration

New audioResourcePolicy accepts only false or a native policy record with five required/two optional finite numbers. Outer options and policy fields are read using own descriptors; accessors are not executed as ordinary value reads. Symbols, unknown keys (including non-enumerable budget/context), arrays, classes/custom prototypes are rejected. Plain data records with Object.prototype or null prototype are allowed. Required-field presence, numeric primitive/finite checks, and validateNativeVoicePolicy range validation remain; only owned copies of the seven scalars are then frozen and retained.

Validation is the constructor's first action, before creating RecordingEvaluationClient, AcousticService, or other owners. If the constructor rejects, the original create app? dispose: world.dispose catch remains and can release the already-created Rapier owner; this round added no test-only factory or product API.

Omission or explicit undefined retains original behavior: enableAudio adds no virtualization key; explicit false actually passes false. The original four allocation options bufferPreset, monitorGain, headroomGain, outputSafetyClip remain, conditionally adding only the policy value, without spreading arbitrary AudioEngineConfiguration or overriding budget, context, source content, limiter, or output tap. All 13 original default-budget values and nativeReference content semantics remain; acoustics still follow the original clone/cache-off path, with no acoustic option added.

<!-- english-original-anchor --> <a id="兩個公開端點的真成本"></a>
## Actual Costs of the Two Public Endpoints

getAudioResourceObservation is an ACTIVE shared benchmark/control endpoint, not a passive cache or zero-cost query. It first returns null when disposed/no engine allocated; with an engine, it reads real getTelemetry and getNativeResourceSnapshot, then returns a structuredClone DTO without leaking engine/native objects or a mutable original budget.

getTelemetry traverses existing voices/routes, updates maximumFilterDelay history, then calls diagnostics.snapshot; snapshot may read the clock and poll native playbackStats at the original frequency. Resource snapshot traverses bounded source owners/roles and uses native currentTime to determine pending status. Disabling diagnostics stops only diagnostic polling; it does not eliminate these traversals, clock/metadata access, or DTO allocation. If on/off use this endpoint, the method must list it as a shared control endpoint with cost, never as a passive TopMonitor getter.

setAudioDiagnosticsEnabled strictly requires a boolean primitive; disposed/no-engine states explicitly reject without creating an engine/context. The actual engine setter only switches observer state and resets the diagnostic baseline, without changing policy/voices/routes/capacity. The disposed getter's early guard does not touch the retained native context. A second independent source reader checked both endpoints and actual getter side effects, also finding no P1/P2.

<!-- english-original-anchor --> <a id="fixture-修正與真-redgreen-分層"></a>
## Fixture Correction and Actual RED/GREEN Stages

Original fixture v1 SHA4556f53f0a24941f9fd474f8a193ae8b4f888fe9545a197f252af8a53e7b40ea/12248B is fully preserved; original 22 FAILs are not deleted. It incorrectly expected interactive bufferPreset, a test-author assumption that does not make all 22 product defects. Original src/audio/buffer-preset.ts defaulted to playback from the start; this Node setup defines no window/audio storage, and RuntimeOptions.storage serves only ProjectStore, not audio-preference injection. monitorGain=1, headroom=0.5, safety cap true, simulated monitoring, and the original 13 budget values have been cross-checked against sources.

Independent inspection confirms the v2 frozen copy replaces only that one assertion, interactive→playback; the product default is unchanged. The versioned correction receipt retains the pending status when authored; later actual TAP clearly separates each stage:

| Stage | tests | pass | fail | Raw TAP |
| --- | ---: | ---: | ---: | --- |
| v1 original fixture | 22 | 0 | 22 | runtime-performance-options-red-r1.tap |
| v2 corrected fixture, product still missing functionality | 22 | 2 | 20 | runtime-performance-options-fixture-v2-red-r1.tap |
| Add 3 authorized public-endpoint cases | 25 | 2 | 23 | runtime-performance-options-endpoints-red-r1.tap |
| After scoped product implementation | 25 | 25 | 0 | runtime-performance-options-green-r1.tap |

The 25-case GREEN TAP has actual duration=1750.8608 ms and was run by parent; this reviewer only read it back, without rerunning. These tests use real Runtime/AudioEngine with the existing control-graph fake context, supporting options, safety boundaries, and control-graph data behavior, not PCM, DSP CPU, native hardware rendering, device output, listening impressions, or formal 600 seconds.

<!-- english-original-anchor --> <a id="範圍限制"></a>
## Scope Limits

This is new runtime source; evidence from original 03d665 native semantic run/frozen 44 inputs cannot retroactively cover this new code. Later source freeze, original-load before/after, 20-second wiring, PCM, 600 seconds, and external hardware gates must each obtain actual data; this review changes no existing FAIL or overall first-version status.
