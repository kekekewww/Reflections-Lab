<!-- english-source: {"path":"tests/audio-runtime/README.md","sha256":"72c019e875ce3596858614d1a7d904f3af5dd1d3c6a45cf6497846282148e5d5","translated_at":"2026-10-27T06:03:13.2900802Z","executor":"Codex","model_id":null,"links":"english-relative","publication_adaptation":{"kind":"mechanical_archive_link_and_source_metadata_adaptation","adapted_at":"2026-10-29T14:26:40.354Z","source_commit":"14da3d7fdcdb5dc73d69b6420238689e22f3846e","previous_source_sha256":"2b975ff9eccdcb4633550728dbad0e7596962d5bfb5a07e15d13e7efeb737401","semantic_retranslation":false}} -->
<!-- english-notice:start -->
> English translation of [`tests/audio-runtime/README.md`](../../../../tests/audio-runtime/README.md). Source SHA-256: `72c019e875ce3596858614d1a7d904f3af5dd1d3c6a45cf6497846282148e5d5`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="正式音訊-runtime-驗證"></a>
# Production Audio Runtime Validation

This directory tests the production Web Audio renderer in `src/audio/`; it is not a research spike. Product integration, geometry solving, and human listening tests each have their own acceptance criteria, which a pass here cannot replace.

The original Chromium native results are in [native-audio-bank-verified-20261027.json](../../../../tests/audio-runtime/native-audio-bank-verified-20261027.json). They were executed in Chromium's separate HTML harness without mounting the product App or Vite HMR client; all 25 checks across six groups passed. The original tool JSON bytes are also saved in the same-named `.raw`; the formatted JSON contains identical data. See `audio-validation-manifest-20261027.json` for the SHA-256 hashes of inputs, test programs, and results.

The newly added, unchanged cross-engine execution is an overall **FAIL**: Firefox157.0 had 8 PASS / 1 energy FAIL / 9 API-blocked / 7 not run due to aggregate dependency; Windows cached WebKit27.2 had 25 API-blocked. Firefox's missing test-only Offline suspend does not imply that the product's live Pause is unsupported; the WebKit observation also does not represent all Safari platforms. [Original cross-engine report](../../../../artifacts/v1/audio-cross-engine-run-20261027053729781/verification.json), [execution and classification details](CROSS_ENGINE.md).

The independently versioned native reference with 9 graphs has saved 864000bytes of complete PCM, confirming that this Firefox build's 0.075s native Delay behavior matches the Float32 fractional-delay interpolation model fixed in advance and reproduces the original energy; the original `<1e-5` acceptance remains **FAIL**. The new `1e-7` is used only for sample-by-sample model diagnostics; it has not replaced the old oracle or relaxed the threshold. [Compatibility and limitations report](../../artifacts/v1/audio-delay-reference-v1-run-20261027054851146/compatibility-summary.md), [complete PCM](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/f04028c02f6bb4f2eae35c5c31c7bb8ed3274467), [pre-execution v1 reference plan](DELAY_REFERENCE_V1.md).

Node control-graph, scheduling, memory, and negative-case results are in [node-final-20261027.tap](../../../../tests/audio-runtime/node-final-20261027.tap). FakeAudioContext only records control and connections and has never served as evidence of a native DSP pass. The added pause, late reverb, asset, WAV, and cursor regressions were also implemented by an isolated agent and executed independently.

Reproducible commands:

```powershell
node --import tsx --test tests/audio-runtime/*.test.ts
$audioFiles = @(rg --files src/audio tests/audio-runtime -g '*.ts')
node node_modules/typescript/bin/tsc --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022,DOM,DOM.Iterable --types node @audioFiles
node node_modules/eslint/bin/eslint.js src/audio tests/audio-runtime
node node_modules/prettier/bin/prettier.cjs --check src/audio tests/audio-runtime
```

The native harness must load the exported validation functions from `browser.ts`, `native-pause.ts`, `native-reverb.ts`, `native-continuity.ts`, `native-restore.ts`, and `native-wave.ts` from the same origin; it uses a real OfflineAudioContext and one real AudioContext clock check. Test impulses, ramps, sines, WAVs, and synthetic IRs are all original procedural content, with no third-party audio files or codecs.

Confirmed scope:

- Direct / early paths apply absolute delay, band pressure gain, and directional rendering only once per path; Panner distance rolloff is disabled. Literal path fixtures validate only the renderer and do not claim to come from the geometry solver.
- Pause keeps AudioContext running. The logical source cursor is saved at the epoch-mapped pause tick; 20 ms defines only fade-out and the heard cutoff and is not added to logical age. `pauseClockSkewSeconds` separately records the difference between actual context time and logically mapped time.
- Resume preserves the generator cursor and reconstructs not-yet-arrived segments for each path; future emissions are scheduled only once. The original synthetic late convolution tail is cut off at the boundary, and reconstructed early segments are no longer sent to the late bus a second time.
- `getVoiceCursor(instanceId, simulationTimeSeconds)` returns source seconds derived from epoch mapping and integration of a bounded authored pitch ramp, excluding the sample's authored startOffset; it is not a hardware read cursor. `restoreVoiceAtCursor` adds the authored offset only once, preserves the not-yet-arrived propagation pipeline, and rejects duplicate restores, stale frames, and restores over budget.
- Late reverb is **Synthetic / perceptual approximation**. The original mono IR contains no direct sound, has zero output for the first 30 ms, and uses explicit unit-energy normalization; Convolver.normalize=false. An IR update first primes for 30 ms, then crossfades for 20 ms on the audio clock. The send uses the earliest valid path in an actually supplied solver frame and adds no solver rays or room RT60 claims.
- Voices, sources, frame cache, paths, late sends, IR PCM, asset count, decoded PCM, decode concurrency, pending arrivals, and restore dedup each have their own limits; completion / drain / dispose cleans up the corresponding resources. Drain retains decoded assets and the context.
- Import is limited to uncompressed RIFF/WAVE PCM8/16/24/32 and finite normalized float32 ([-1,1]). Before calling decodeAudioData, validate exact RIFF size, at most 128 chunks, a single fmt/data, alignment, channels, sample rate, duration, and the PCM reservation after context resampling. Compressed, WAVE_FORMAT_EXTENSIBLE, multiple-data, invalid, and over-budget inputs are explicitly rejected; arbitrary codecs are not bundled.
- A trusted persistence host can use `getAssetBuffer` to obtain PCM and `getAssetBudget` to obtain a frozen budget copy; `getAssetSampleRate` returns null when there is no context yet. `replaceAssets` synchronously prevalidates the complete bank's IDs / metadata / totals / duplicate references, then replaces it atomically; active / retiring / pending / frozen voices, in-flight decode, or builtin generation all block replacement. A validated bank can be saved before enable; the first enable only attaches the context and retains real PCM and does not thereby create a hardware device. Failure preserves the old bank; clear / dispose cancels old async generation so it cannot populate the new bank.

Validation levels and limitations:

- V1: Independent numerical / control-graph / resource and positive/negative cases passed; the band FIR is a bounded approximation with no claim of arbitrary octave accuracy.
- V2: The 25 Chromium native fixture checks above passed, including arrival, pressure gain, real HRTF nonzero / finite output, source / path lifecycle, IR energy, real WAV decode, and pause / seek cursors. Firefox / Windows WebKit coverage follows the separate FAIL / blocked records above; a complete cross-engine pass is not claimed. HRTF is only a native render sanity check, not personalization or listening-quality certification.
- V3: This audio slice has not undergone an independent room-solver comparison.
- V4: One real native clock case has been observed; 10-minute realtime capacity, device profiling, and AudioWorklet underruns are all **NOT RUN**.
- V5: Headphone / human listening tests, device end-to-end latency, SPL calibration, and real-room measurements are all **NOT RUN**.

Waveform or filter-state continuity across pause / seek is not claimed. Without complete old automation, pending history uses the latest pitch / content / path approximation; a three-field cursor must not be treated as complete sample history. The native decoder's internal resident peak has not been measured; WAV preflight limits its input and decodable frame count, and PCM reservation represents the PCM budget accepted and in flight in this runtime.

Retained early failures include the clock not yet advancing before device startup and premature path-death attenuation caused by a missing new ramp start point after a completed ramp. The latter was found by the native constant-source / path fixture and fixed with an explicit current-time anchor in `smooth`, without relaxing the oracle or energy tolerance. Each engine / version is governed by its own artifacts and limitations; a Chromium pass or a match to the new reference model cannot overwrite Firefox's original FAIL.
