<!-- english-source: {"path":"tests/audio-runtime/DELAY_REFERENCE_V1.md","sha256":"ad278c7b0ebac521cf2b89c32bc5c4629407fbf6bd3e097836cc563484eefae3","translated_at":"2026-10-27T06:02:57.2940465Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`tests/audio-runtime/DELAY_REFERENCE_V1.md`](../../../../tests/audio-runtime/DELAY_REFERENCE_V1.md). Source SHA-256: `ad278c7b0ebac521cf2b89c32bc5c4629407fbf6bd3e097836cc563484eefae3`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="native-delay-reference-v1"></a>
# Native Delay Reference v1

Status: **PREPARED / NATIVE NOT RUN**. This is a separately versioned diagnostic reference, not a revision of the original 25-item acceptance suite. The original Firefox 157.0 energy **FAIL**, the original `<1e-5` threshold, and the evidence of missing APIs in the WebKit Windows build are all retained; product code and the original suite remain unchanged. Under `docs/09-agents/VALIDATION_POLICY.md`, this plan requires new native evidence and independent review before reaching a conclusion about a root cause or oracle defect.

Original evidence: `artifacts/v1/audio-cross-engine-run-20261027053729781/firefox.baseline.json`. At 48kHz, the unit impulse occurs at sample 480 after emission 0.05s; direct/reflection are respectively 0.025s / gain 0.5 and 0.075s / gain 0.25, with centered equalpower panning. The measured peaks are 4080 / 0.3535533845424652 and 6480 / 0.17673353850841522; energy is 0.31246948243551215, versus the ideal 0.3125. The original artifact contains no per-sample PCM, so the fractional-delay tail at 6481 cannot be claimed as observed.

Uniform gain across a single frequency band makes `src/audio/band-filter.ts` return null, so `routes.ts` uses an identity convolver with the single tap `[1]` and `normalize=false`, applying gain only once; the original impulse is outside the attack/release and path-crossfade intervals. Existing data do not support nonuniform FIR / automatic normalize as the root cause. There is also no empirical evidence of 16-bit PCM or privacy/dither settings, so the energy difference alone cannot be used to attribute the cause to them.

A stronger hypothesis, still awaiting confirmation by a native reference, is native DelayNode Float32 seconds-to-frames conversion and two-sample linear interpolation:

```js
const f = Math.fround;
const c = f(Math.SQRT1_2);
const d = f(f(0.075) * 48000) - 3600; // 1/4096
const a = f(0.5 * c);
const b = f(f(0.25 * (1 - d)) * c);
const s = f(f(0.25 * d) * c);
const E = 2 * a * a + 2 * b * b + 2 * s * s;
```

`a` and `b` match the stored peak values exactly; `E=0.3124694824355657`, differing from the original measurement by 5.35682609381638e-14. The per-channel value `s=0.0000431583721365314` at 6481 is a **prediction**. With the same Float32 conversion, 0.025s yields the integer 1200 frames, 0.075s yields 3600.000244140625 frames, and 0.125s is the exactly representable binary control.

Web Audio AudioParam scheduling values are float, and Convolver with `normalize=false` uses the original IR. The DelayNode implementation indexed by Mozilla calculates delayFrames using float, and DelayBuffer blends the two adjacent frames at a fractional position; these original sources support the model, but the indexed revision has not yet been matched to the actual build revision of the cached Firefox binary and cannot serve as proof of execution. [W3C AudioParam](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-audioparam-setvalueattime), [W3C Convolver](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-convolvernode-normalize), [Mozilla DelayNode](https://searchfox.org/firefox-main/source/dom/media/webaudio/DelayNode.cpp#104), [Mozilla DelayBuffer](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/webaudio/DelayBuffer.cpp).

A single native Firefox batch of 9 graphs is frozen in advance; no preferences are changed, no best rerun is selected, and the original data and thresholds are not modified:

| Graph | Delay | Unit Convolver | Gain |
| ------------------------ | -------------- | ---------------------- | --------- |
| gain-only-zero | None | None | 0.25 |
| convolver-unit-zero | None | `[1]`, normalize=false | 0.25 |
| gain-only-delay-025 | 0.025s | None | 0.25 |
| convolver-unit-delay-025 | 0.025s | Same as above | 0.25 |
| gain-only-delay-075 | 0.075s | None | 0.25 |
| convolver-unit-delay-075 | 0.075s | Same as above | 0.25 |
| gain-only-delay-125 | 0.125s | None | 0.25 |
| convolver-unit-delay-125 | 0.125s | Same as above | 0.25 |
| parallel-original-paths | 0.025s and 0.075s | Same as above for both paths | 0.5 and 0.25 |

All graphs use the same centered equalpower Panner (position 0,0,-1, rolloff 0) to avoid the upmix energy difference from sending mono directly to a stereo destination; source, sample rate, and output length are fixed. Each graph saves the complete 2×12000 Float32 PCM, native AudioParam / IR / panner readbacks, samples adjacent to arrivals, total energy, and native context data. Total output PCM is 864000 bytes; no live AudioContext or hardware output is created.

The independent Float32 model does not import product DSP; a prediction is created before each graph starts rendering. The advance-fixed `maxSampleAbsoluteError <= 1e-7` compares only the new model and native PCM and is labeled diagnostic; it cannot replace the original `energy error <1e-5` acceptance criterion. Only if the no-Delay / identity-convolver controls behave normally, 0.025s / 0.125s retain a single impulse, 0.075s produces the predicted two samples both with and without Convolver, and the two-path native graph reproduces the original values is there sufficient basis to narrow the root cause to native Delay precision / interpolation compatibility in that cached Windows Firefox version. If the conditions are not met, retain counterexamples and raw PCM without changing the original thresholds or product code.

Execute only after Root confirms that the English browser slot has ended and gives GO:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\kevin\AppData\Local\ms-playwright'
node tests/audio-runtime/run-delay-reference-v1.mjs --run
```

The default `--prepare` starts no server/browser; an actual run uses only its own random-port Vite / isolated page without App or HMR, and Firefox. Preparation / imports / execution / cleanup all have bounded deadlines; before/after hashes cover the original 15 files and the new reference. A return value of `REFERENCE_MEASURED` means only that this independent reference data was obtained and does not carry the original 25-item PASS meaning. On failure, retain exceptions / PCM and cleanup status; human listening tests, device latency, AudioWorklet, long-running capacity, and the Meta API remain outside scope.
