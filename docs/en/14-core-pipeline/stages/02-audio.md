<!-- english-source: {"path":"docs/14-core-pipeline/stages/02-audio.md","sha256":"d7982995b2353987eda4759151a24bb14b4ae8f056553c0b9fecf5208000549a","translated_at":"2026-11-02T05:31:33.5452449+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/02-audio.md`](../../../14-core-pipeline/stages/02-audio.md). Source SHA-256: `d7982995b2353987eda4759151a24bb14b4ae8f056553c0b9fecf5208000549a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="音訊核心成本觀測與原生路徑更新"></a>
# Audio core: cost observation and native route updates

Date: 2026-11-02 (Taiwan time). Scope: item 2 of the six-core implementation. Baseline `429efb7`, core commit `17e3318`; subsequent observation-switch and verification closure use this branch's actual Git log. This does not establish full V1, 600-second performance or real-device hearing acceptance.

<!-- english-original-anchor --> <a id="已實作"></a>
## Implemented

- `AudioEngine.getDiagnostics()` explicitly models control-thread observations. Frame-consumer accepted/stale/unavailable/source-budget/restart-blocked/invalid/error fields are separate from runtime batch-delivery accepted/epoch/revision/age/solver rejections.
- `recordAcousticDelivery()` provides the root-runtime connection, distinguishing batch counts from source-frame counts. Until connected, it reports NOT_OBSERVED, without treating missing observations as zero rejections.
- Onset lateness uses the requested versus actual native-generator start, without adding physical propagation or device latency. The count represents native generator starts, not unique physics events.
- Each of the three control costs (frame consumer, route control and listener control), onset lateness and delivery age/cost retains at most 128 samples. Quantiles describe the recently retained window; lifetime observation counts are separate. Route control is a subtask of frame consumption, so the two costs must not be added together.
- Native `playbackStats` is read at most once every 500ms. Only cumulative differences within the same context generation represent window data. Unsupported, warming-up, counter-reset and unobserved values remain null. PCM gaps, native DSP CPU, resident memory and SPL are not measured.
- The `diagnosticsEnabled` option and `setDiagnosticsEnabled(boolean)` disable performance-clock sampling, ring/counter accumulation and native-getter polling without changing voices/graph. Re-enabling rebuilds the native baseline and never computes differences across the disabled interval; existing historical observations remain.
- PathRoute separates scalar pressure gain, normalized spectral shape, delay and direction. It exactly compares normalized Float64 keys and active-target Float32 coefficients. Scalar-only changes neither build/copy FIRs nor upload IRs. Scalar values can update smoothly and independently during a shape crossfade.
- A spectral bank retains at most one pending-latest update and reclaims the old bank after the audio-clock crossfade completes. The final shape does not need another solver frame. Live rendering has at most one route timer; offline rendering completes through explicit checkpoints. disconnect/retire cancel pending work without resurrecting a route.
- Delay retains a 1e-6-second deadband and position retains a 1e-4-metre deadband: these are explicitly render policies with error, separate from exact scalar/shape suppression. Preserve dual banks, Convolver.normalize=false, group delay, stable path IDs, continuous generators and one absolute propagation delay.

<!-- english-original-anchor --> <a id="給離線renderer的接縫"></a>
## Seam for the offline renderer

`AudioEngineOptions.offlineOutputTap` is allowed only with OfflineAudioContext:

| Tap | Semantics |
| --- | --- |
| master | Existing full monitor-output graph, including headroom/monitor/mute and the configured limiter/ceiling. |
| simulatedMix | Unity pre-master propagated signal, including direct/early/late enabled in this graph; not a pure late-reverb output. |
| dryContent | Unity pre-master Raw dry content, without propagation or spatialization. Mono in a stereo-speakers layout is copied once to each of left and right, not equal-power panning. |

Pre-master taps do not bake in monitor/master processing. Monitor mode is fixed, and an incorrect mode is explicitly rejected. `flushControlUpdates()` is called by the renderer at actual OfflineAudioContext.suspend audio-time points and tail checkpoints. Do not overwrite all Convolver.buffer values in advance and pretend that this schedules future updates. A pure late tap is not supported yet; subtraction cannot invent stems.

<!-- english-original-anchor --> <a id="基本測試與直接證據"></a>
## Basic tests and direct evidence

- Full audio runtime plus three app-audio regression files: 226/226 PASS; original receipt [02-audio-unit.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1b7cfe8d56854061ed881ad934d88ee9617dc1b3). This run started before adding one engine-disable regression, which is covered by the final core tests below. Do not count the case twice.
- Final diagnostics/native-update core: 19/19 PASS, including retaining the same native source with observation disabled; [02-audio-core-unit.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/b76b33ea8b8d11f3301186cc04c0effb2ca582df).
- Real Chrome OfflineAudioContext: 4/4 PASS, 0 page errors. [02-audio-oac.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1cc4fa48448f141e5f905529b9a2f8933500af64) saves browser version, source bytes/SHA-256 and results. Command: `node tests/browser/audio-update-core/run.mjs docs/14-core-pipeline/stages/02-audio-oac.json`.
- Type/scoped-ESLint/format results are recorded in the [static-check receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e0df9584d92a396ba58848713ea2e69782135c75).

Claim AUDIO-CORE-PCM-01: a 48kHz literal impulse, emission at 0.01 seconds and a 0.075-second path. The first nonzero sample for master and simulatedMix is 4080; dry begins at 480. With master headroom=.25 and monitor=.5, total two-channel energy is approximately .003906249866 (analytical .00390625); simulatedMix is approximately .249999991443 (analytical .25). The native graph applies delay, pressure gain and headroom only once. This is V2 native-graph PCM evidence, not geometric-solver or device-calibration evidence.

Claim AUDIO-CORE-PCM-02: doubling the scalar of a nonuniform-band FIR gives a native-OAC before/after RMS ratio of approximately 2.000000014; shape build/upload each remain 1, and generator onset remains 1. This does not claim dropout-free behavior for all movement/filter changes on all devices.

Actual commands for the basic regressions:

```powershell
node --import tsx --test tests/audio-runtime/*.test.ts tests/app/audio-smoothness.test.ts tests/app/audio-review2.test.ts tests/app/audio-review3.test.ts
node --import tsx --test tests/audio-runtime/update-core.test.ts tests/audio-runtime/diagnostics.test.ts
```

<!-- english-original-anchor --> <a id="首次fail與參考更正"></a>
## Initial FAIL and reference correction

Only the dry oracle failed in the initial 4 cases: it expected stereo total energy 1, but actual unity mono-to-stereo produces 1 in each channel and total energy 2. The [original FAIL](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/88c748362ea62f978e7563e8a91d2dd5ff473657) is fully retained. Following the speakers up-mixing equations in [W3C Web Audio 2021 §4.4](https://www.w3.org/TR/2021/REC-webaudio-20210617/#up-mixing), the reference was corrected to energy 1 per channel/total energy 2, and per-channel checks were added. No product graph or tolerance was changed. Final source-based evidence is saved separately rather than overwriting the initial FAIL.

The original `routes-response-reuse` test explicitly showed scalar updates also blocked by the 20ms shape gate; separating those responsibilities is the defect repaired in this round. The regression now verifies scalar arrival independently during a transition. Existing IR-identity, arrival-fade, tiny-response, disconnect and other assertions remain.

<!-- english-original-anchor --> <a id="claude-code複驗入口與界線"></a>
## Claude Code revalidation entry and boundaries

1. Check integrated Git, this report and source-bound JSON. Run the core unit and OAC runner above, then the full integrated runtime/browser checks.
2. Verify root runtime really connects recordAcousticDelivery and the UI enable switch. NOT_OBSERVED must not display as zero errors.
3. Compare fixed-source/browser/load runs with and without observation, then perform long profiles. This round did not run 600-second performance, device playback, native CPU/memory or actual hearing tests.
4. Retain the initial framework, R17 and research long-run negative results. These basic tests do not remove limitations of the original native-audio framework, audio-quality approximations or cross-browser behavior.

Codex audio_core implemented this stage; the routes_review subagent collaborated on diagnostics and unit tests. Root's independent review identified the missing observation switch, which was repaired. Root owns cross-feature merging, UI, English mirrors, Wiki tasks/checkpoints and the full Claude handoff. This branch added no dependencies, paid APIs, deployment or push.
