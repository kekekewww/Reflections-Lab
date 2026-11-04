<!-- english-source: {"path":"docs/14-core-pipeline/stages/12-final-integrated-ui-audio.md","sha256":"473e376849d2aff73c00ab302e636a64990608255895de9797e49351f3fdd4fa","translated_at":"2026-11-02T14:11:31.477Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/12-final-integrated-ui-audio.md`](../../../14-core-pipeline/stages/12-final-integrated-ui-audio.md). Source SHA-256: `473e376849d2aff73c00ab302e636a64990608255895de9797e49351f3fdd4fa`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="stage-12最新整合版本的實際音檔與獨立校驗"></a>
# Stage 12: Actual audio files from the latest integrated version and independent verification

Date: 2026-11-02 (Taiwan time). The product source is pinned to `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`, with production entry `index-Nm7oRfzL.js` and SHA-256 `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a`. This is a new batch; [Stage09](09-integration-and-export.md), [Stage10](10-final-ui-export.md), and their sources and results remain unchanged.

<!-- english-original-anchor --> <a id="實際操作與檔案來源"></a>
## Actual operations and file provenance

The [pinned actual UI receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/279a3bceb606308c1da386fa7b2eeee93117a258) records Playwright CLI scripted DOM / headless Chrome 156.0.8078.75: object movement, Zone enter/exit, nonlinear mapping, and dynamic reflection entered a three-second recording of 180 consecutive fixed ticks (19..198). The actual product OfflineAudioContext then generated five WAV files and a manifest, each downloaded individually. Claims about UI actions and the combined pipeline come from that external receipt; the independent RIFF parser does not represent another UI run.

The new job is `render-37c82ed6-7aaf-4b4a-9537-a718b75b46ab`. The actual files reside in `D:/Developing/Meta Hack/exports/core-pipeline-20261102/integrated-final/render-37c82ed6-7aaf-4b4a-9537-a718b75b46ab/`. The [original download index](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4548b0430029bafc040bba0701d43c4cc1985308) pins original download paths, suggested filenames, copy paths, byte counts, and SHA hashes. Original downloaded filenames have label prefixes; the parser checks them through that index without renaming or changing the audio content. The WAV files remain in the physical directory above; they are not all stored in Git.

<!-- english-original-anchor --> <a id="獨立位元組結果"></a>
## Independent byte-level results

The [new independent receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fd0e82716a062ccf7d6eb9e68742ae21806f2d64) is PASS / exit0. With no product decoder imported, the parser independently checks RIFF/fmt/fact/data, rational clock frame counts, finite/nonzero PCM, and manifest and original download hashes. All five files are float32 stereo at 48kHz with 240000 frames = five seconds (three-second take + two-second tail), each 1920056 bytes. The maximum sample-by-sample difference between the two stems summed and the mix is `1.1420343071222305e-6`, retaining the original `2e-6` threshold.

| Output | Independent peak | Samples exceeding ±1 |
| --- | ---: | ---: |
| mix | 6.864605903625488 | 1708 |
| master | 0.00924539566040039 | 0 |
| dry | 2.058187246322632 | 117174 |
| ball stem | 6.862547874450684 | 1704 |
| speaker stem | 0.051398251205682755 | 0 |

All peaks and outside-range counts exactly match the manifest. Every float32 output conversion has clippedSampleCount=0. The existing [Stage06 semantics](06-render.md) define mix/stems as pre-master and dry as original content; IEEE floating-point samples can exceed ±1 with no hidden normalization or clipping. The master configured with outputSafetyClip=true separately requires zero outside-range samples. This batch has headroomGain=0.5, monitorGain=0.01, and limiterEnabled=true; raw floating-point amplitude is not calibrated SPL or a listening result.

<!-- english-original-anchor --> <a id="舊錯oracle與修正驗證"></a>
## Original incorrect oracle and correction verification

The earlier parser required every output to stay within ±1 and therefore rejected this batch's valid pre-master samples. The [original RED](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e1ad98552d9998ddb160c480c2c5a835eceef4ac) and exit1 raw output remain intact. Only the test tool changed: it now independently measures pre-master values and checks the manifest exactly, while the safe master retains its range assertion. The product, audio files, and stem-sum tolerance were unchanged.

The [tool regressions](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/427777caf466940f063214d2a1a96a236728cfea) passed seven cases: valid pre-master positive control; rejection of altered outside-count, peak, or clipping metadata; rejection of an unsafe master; acceptance of identical manifest aliases; and rejection of differing aliases. These tests use copied bytes and explicitly synthetic metadata and add no product UI claims. [Rereading an old hyphen manifest](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9f8773c757ce5b0c646ad2a0cf7dd134ea4ffc44) also passed without rewriting the old Stage09/10 receipts. Syntax, ESLint, and Prettier each exited0; original commands and pinned hashes are in the [evidence manifest](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/00922504eaf04c6f0ddb33ee9efcdc1d5e07b36d).

<!-- english-original-anchor --> <a id="限制與接手"></a>
## Limits and handoff

All five files explicitly report historyIncomplete=true: the causal native DSP history before recording is insufficient, so complete pre-roll cannot be claimed. tailTruncated=false is recorded as observed. Native HRTF remains browserManagedUnspecified. Native Computer Use access timed out and no native input succeeded; this batch's actual DOM/digital output PASS does not change the native-method gate. There is no human listening test, hardware loopback, calibrated SPL, Meta live, or 600-second performance PASS.

Claude Code can rerun the independent parser using the new receipt's reproduction array, check the actual UI and source bundle, and independently verify the new features and audio files. Human testing follows Claude's subsequent adjustments.
