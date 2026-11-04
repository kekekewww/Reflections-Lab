<!-- english-source: {"path":"docs/14-core-pipeline/stages/06-render.md","sha256":"a12bf59d465fbb96696bda7f830e98a0caf78d68f55963d800d4e08c0611fe93","translated_at":"2026-11-02T05:42:24.5000212+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/06-render.md`](../../../14-core-pipeline/stages/06-render.md). Source SHA-256: `a12bf59d465fbb96696bda7f830e98a0caf78d68f55963d800d4e08c0611fe93`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="核心階段-06短-take-離線音訊匯出"></a>
# Core stage 06: short-take offline audio export

Date: 2026-11-02 (Taiwan time). Implementer: Codex render_core. Baseline: R21 `429efb7`, with audio_core interface commits `17e3318`/`a19e308` merged. Use Git history for this stage's own final commit. This delivers core functionality and basic tests. Claude Code's later independent revalidation and the user's human acceptance are separate; this is not full V1 or 600-second performance closure.

<!-- english-original-anchor --> <a id="已實作"></a>
## Implemented

- Original `RecordingArtifact` → `verifyRecording` → original VoiceIntent/source cursors/listener/individual paths → the same `AudioEngine` and a real `OfflineAudioContext`. No separate propagation or timbre engine was written, and test tones do not replace the user's recorded content.
- A closed `RenderJob` runtime validator checks separate SHA-256 values for recording content and canonical stored bytes, scene revision, solver/material/behavior/asset settings, rational fixed-step clocks, exclusive windows, preroll/tail, source selection and frame/byte budgets.
- Default outputs are propagated mix (Wet), master, dry content and stems for sources grouped by their original objects. Emission-instance selection happens before every audio bus; original physics/Behavior/admission remain unchanged.
- An IEEE float32 RIFF/WAVE encoder provides a fact chunk, correct interleaved samples/length, peak, the count of samples outside the unit range and file hashes, without hidden normalization/clipping.
- A backend holds at most one job. The same ID/hash is idempotent; the same ID with different content is rejected. Publish the manifest atomically only after all outputs finish and their hashes are checked. Cancellation can win during preparation, between outputs and before final Host publication. Failure publishes no partial files.
- A failed or cancelled new job preserves the previous completed export. First fix recording/settings data ownership; after work starts, copy decoded PCM into a job-private bank so later asset changes cannot affect different stems.
- `RenderHost`/`RenderPanel` provide progress, cancellation, individual WAV downloads and a source-manifest download, reusing the existing dock/button/field/HelpTip and Traditional Chinese/English interface. The main integration agent owns App/runtime connections and the real 3-second recording entry. This report does not label an unoperated UI as having passed human acceptance.

<!-- english-original-anchor --> <a id="輸出語義"></a>
## Output semantics

| Output | Exact meaning |
| --- | --- |
| mix/Wet | Direct sound + early paths + configured Synthetic late reverb, at unity before master processing; not a pure reverb-tail stem. |
| source stem | An object's set of emissions with the same time origin, length, seed and pre-master gain; these should sum to mix within native floating-point tolerance. |
| dry | Original generator/gain/pitch/envelope without propagation/HRTF/master. As in the existing Raw graph, mono is copied at unity to each stereo channel, without stereo-total-energy normalization. |
| master | All sources mixed through the fixed headroom/monitor/limiter/safety graph; nonlinear master processing does not require independently mastered stems to add up. |

The default includes the entire short take. Hold the last recorded tick for one fixed step, then stop emissions and retain the explicit tail. Preroll must begin at an actually captured tick boundary. Each result records insufficient history and truncated tails rather than implying complete causal history. Original emission time and each path's absolute delay are counted only once each.

<!-- english-original-anchor --> <a id="容量與明確限制"></a>
## Capacity and explicit limitations

- The emission segment is at most 30 seconds; preroll + segment + tail occupy at most 45 seconds in one context. There are at most 16 outputs, a 256 MiB working estimate and a 192 MiB output limit. Estimates are not measurements of browser-internal peaks; native-allocation failure is still reported explicitly.
- Uses recorded listener/paths. Listener replacement, asset HRTF, pure late taps, long state-preserving chunks, ADM/cloud are explicitly unsupported.
- Source onsets follow the original epoch. Dynamic AudioParam/graph updates run on render-quantum boundaries at real suspend/resume points. Every requested sample/actual control sample/offset enters the manifest; this does not claim `sampleScheduledControls`. A mismatched control grid fails.
- Native HRTF/limiter coefficients and latency are browser-managed and cannot be fixed with a private asset hash. Results are digital PCM reconstructed from recording data, not hardware-loopback recordings, calibrated SPL or hearing evidence.
- A real recording lacking complete Behavior/cursor/path evidence follows ReplayAudioHost's explicit rejection. Missing propagated capabilities do not become fake paths or zero values labeled successful.

<!-- english-original-anchor --> <a id="基本測試與證據"></a>
## Basic tests and evidence

`06-render-verification.json` pins commands, exit codes and source hashes. Adjacent `06-render-*.txt` files retain output. The real OAC runner is `node tests/browser/render/run.mjs`; each run writes a separate timestamped JSON, and original failures remain.

- Node 13 basic regressions: real Behavior/solver recording fixtures, valid sample pins, closed job schema, source/clock/scene/configuration hashes, exact inclusive budgets, preroll, WAVE headers/samples, preparation-stage cancellation and overlapping jobs.
- Real headless Chrome OAC 7 cases: producing all files from a recording, summing two object stems (maximum per-sample error threshold 2e-6), file hashes/manifest/frame counts, idempotency and job-ID conflicts, an original pinned impulse's onset + absolute delay (1-sample tolerance), and no partial publication after cancellation.
- The initial browser fixture assigned a non-loop sample to a continuous lifecycle, which the production validator correctly rejected. The original ERROR receipt is retained. A legal OnGrab one-shot fixture then passed; product validation and tolerances were not changed.
- TypeScript, ESLint and Prettier use the pinned toolchain. Actual check results come from the machine-readable receipt; this text does not replace exit codes.

<!-- english-original-anchor --> <a id="主整合與-claude-code-重驗入口"></a>
## Main integration and Claude Code revalidation entry

`new RenderHost({getRecording, getAssetBank, getMasterSettings?})`; `RenderPanel` accepts `host`, `locale`, `onCaptureShortTake?`. The suggested next path through the official UI is a real 3-second recording, generation, then individual downloads of mix/master/dry/stems/manifest. Decode the WAVs again and verify filenames, hashes, length, nonempty content and the same time origin. The main agent records actual computer-use separately; these headless basic tests do not replace that interaction.

<!-- english-original-anchor --> <a id="本階段基本驗證完成點"></a>
## This stage's basic-validation completion point

The core-code commit is `55d40fd`. On that commit's source, Node 13/13, real OAC 7/7, TypeScript, ESLint and Prettier all exited 0. The latest browser receipt is `06-render-browser-2026-11-02T053458552Z.json`, Chrome 156.0.8078.75. The maximum per-sample error when summing the two stems is 5.122274160385132e-9. Expected/actual samples for the original impulse are direct 2654/2654 and dry 2080/2080. The test cleared the caller's original sample buffer after the first output completed; the later dry output remained correct, supporting the ownership boundary of the job-private PCM copy.

The manifest embeds the pinned render configuration. Stem IDs derive from a fixed hash of the object ID and its name rather than row order as persistent identity. Actual control-point comparisons are saved for the first output, and subsequent outputs individually verify the same native-grid boundaries.
