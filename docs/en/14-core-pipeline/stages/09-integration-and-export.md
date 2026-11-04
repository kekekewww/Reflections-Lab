<!-- english-source: {"path":"docs/14-core-pipeline/stages/09-integration-and-export.md","sha256":"24c2bd0b272e1aeaf8702404617592d8ae6d46d2474f6347b3a66a3881780b3d","translated_at":"2026-11-02T06:25:24.6537560+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/09-integration-and-export.md`](../../../14-core-pipeline/stages/09-integration-and-export.md). Source SHA-256: `24c2bd0b272e1aeaf8702404617592d8ae6d46d2474f6347b3a66a3881780b3d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="stage-09正式產品瀏覽器匯出與獨立-wav-驗證"></a>
# Stage 09: production-product browser export and independent WAV verification

Date: 2026-11-02 (Taiwan time). This report pins evidence from "actual product Browser DOM interaction → downloaded files → independent RIFF parser". It does not convert native Computer Use timeouts into success or declare full V1 or final source/main closure.

<!-- english-original-anchor --> <a id="實際-ui-與來源"></a>
## Actual UI and source

The product source for this run is `42d25cb51d8e7d7621b3c1a7038ce00bf6e33459`. The production bundle is `dist/assets/index-27NgeX35.js`, SHA-256 `d285817d4852ce5b8bf6a56ff3d830430ccca76904ac3e4a2787330e22fc0316`. Chrome 156.0.8078.75 operated the official UI at `http://127.0.0.1:4173/`.

Root first followed the computer-use skill and attempted native `sky.get_window`. Both responses were Computer Use app approval timed out, so that native route stopped under the skill; no native input succeeded. Playwright MCP then operated the actual product DOM rather than using an internal render API as a substitute for UI downloads. Native Computer Use for this round is therefore **NOT COMPLETED/approval timeout**; Browser DOM interaction and actual downloads have the evidence below.

Interaction order: Audio export tab → Capture 3 seconds (180 ticks) → Render audio files → individually download mix/master/dry/ball stem/speaker stem → download the provenance manifest. The screenshot shows the completed short take, tick 180 and five file entries: see the [export screenshot](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ee63846ea5cb4c08690b1894fa379547df17ec70), [DOM snapshot](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f98b43d6180410bb86de3c956e4239061c2b3b31) and [provenance record](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/694dc6ffc2ba25189677f01d6984c223da9534a0). This is evidence of that screen and interaction, not an overall visual-quality/physical-keyboard-and-mouse/hearing PASS.

<!-- english-original-anchor --> <a id="實際檔案與獨立檢查"></a>
## Actual files and independent checks

Files are saved under `D:/Developing/Meta Hack/exports/core-pipeline-20261102/`; the job is `render-b5fbe4bd-78ec-4836-abb8-9dcd4ed792ca`. Recording SHA: `e9f3508faa83e98f47b037d8c465c535269bb08201e6228f3191eb2294dff990`; render-configuration SHA: `ca63bd605c7289b0885b549957806ab355dab0a55a648561d6fe6d8d2abbfac3`. Full filenames, hashes and absolute paths are in the [independent machine-readable receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/073407528ed68aab5c9aaa1e8a9cffa41c8d52ac). The nearly 10MB of WAVs/original download folder are not added wholesale to Git.

The independent `tests/browser/render/verify-downloaded-wav.mjs` uses its own RIFF parser, without calling the product's WAVE encoder as the answer. Its receipt pins verifier SHA, actual Node 22.17.0, source/bundle and the rerun command.

- 5/5 files pass IEEE float32, stereo 48kHz, 240000 frames = 5 seconds (3-second take + 2-second tail); each file is 1920056 bytes.
- All PCM is finite and nonzero, with 0 samples outside the unit range. Every file matches its manifest hash, and original downloads match the project-exports copies.
- Summing the two pre-master object stems against mix gives maximum per-sample error `1.4901161193847656e-8`, below the existing `2e-6` tolerance; master and dry each differ from mix.
- The manifest is 23871 bytes, SHA `ee724df50a7ef3857b8326439b5598688ce4b128b4351a824e114d3332001903`. JSON retains detailed peaks/RMS/first nonzero samples.

These checks support the digital files and output semantics for this run, not hardware playback, SPL, user hearing, arbitrary scenes/long takes or 600-second performance. Native HRTF remains browser-managed; nonlinear master processing does not require independently mastered stems to add up.

<!-- english-original-anchor --> <a id="主整合品質目前進度與保留失敗"></a>
## Current main-integration quality progress and retained failures

The following is root's reported integration progress at that point. Final stdout/exit codes/source still await the formal closure receipt; a brief report does not replace original results:

1. The first full-check run stopped because an isolated spike lacked dependencies. Root restored existing pinned dependencies with offline npm ci, without using this to upgrade packages.
2. The second run had 23 failures: 19 involved premature Host-rebind publication, and 4 concerned old oracles missing newly added fields. Root repaired them in `42d25cb` and reported 46+8 related regressions passing. Retain original FAIL and new results separately; do not relabel the second run PASS.
3. The third full check had reached lint at that time; this is not a final full-check PASS receipt.
4. The actual Meta UI workflow exposed "Host has metrics but the table is empty". Root/the UI agent were performing a minimal repair and basic retest. Neither the original 183 Host cases nor tabs smoke can establish that this UI feature is complete. Final source will be separate from this 42d25cb audio-export point.
5. Original-root memory was saved as a snapshot in `4ba4378`; local main has not switched yet. Final SHA/location and Claude's complete independent revalidation await the final handoff.

<!-- english-original-anchor --> <a id="claude接手"></a>
## Claude handoff

Read the [core contract](../IMPLEMENTATION_CONTRACT.md) and [complete handoff](../CLAUDE_CODE_HANDOFF_20261102.md) for final quality/UI-repair/main receipts first. Then independently verify the files at this page's source point or generate a new batch on the latest source. Do not transfer old-bundle download evidence into a later modified source's fresh-browser PASS.

There were no paid Meta requests in this round. Fixture/offline identity, budget 0 and the original live boundary remain. Original R17/research 600-second FAIL results and device/scientific/external gates remain; Claude has not independently revalidated this round yet.
