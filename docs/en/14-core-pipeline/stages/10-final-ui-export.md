<!-- english-source: {"path":"docs/14-core-pipeline/stages/10-final-ui-export.md","sha256":"363d6d4d3d24bf7139d8859566b9fb8e040158986ea4627aae8d28cdd1ec1ef0","translated_at":"2026-11-02T07:08:55.973Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/10-final-ui-export.md`](../../../14-core-pipeline/stages/10-final-ui-export.md). Source SHA-256: `363d6d4d3d24bf7139d8859566b9fb8e040158986ea4627aae8d28cdd1ec1ef0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="stage-10b41cdeb-產品音檔與後續來源界線"></a>
# Stage 10: b41cdeb product audio files and subsequent source boundaries

Date: 2026-11-02. This page pins the second batch of digital audio files exported through the actual Browser DOM. The original [Stage09](09-integration-and-export.md) and first audio batch are retained in full; their sources and results are not overwritten.

<!-- english-original-anchor --> <a id="固定來源與實際檔案"></a>
## Pinned source and actual files

The second batch's source is `b41cdeb0eac47d1b23e04fbda6a196049a9c66a5`, job `render-7d0bdb25-8a5d-44fe-9b13-ded5207513f9`. Downloaded files are under `D:/Developing/Meta Hack/exports/core-pipeline-20261102/final/`. That run's `source-bundle/index-CgrKG5Ax.js` is retained alongside them, with SHA-256 `91145f8d501538d73954f6746c17dccd47865f3b71953beb4092f9cec8fa22bb`.

The UI operation still captures3 seconds/180 ticks in the production app, generates output and individually downloads mix/master/dry/ball stem/speaker stem and the manifest. The successful method is actual DOM input through Playwright MCP. Native Computer Use had previously stopped after two app-approval timeouts; no native input succeeded. This page does not relabel the fallback as native PASS.

<!-- english-original-anchor --> <a id="獨立-riff-檢查"></a>
## Independent RIFF checks

The [independent receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/36e52efc07660c876e7d8c722e0904065ed65043) pins the verifier SHA, Node22.17.0, source Git-tree pins, bundle and download/copy hashes. It does not use the product's WAVE encoder as its own proof.

- All5/5 files are float32 stereo48kHz,240000 frames =5 seconds, covering a3-second take and2-second tail. Each file is1920056 bytes, finite/nonzero, with0 samples outside the unit range.
- Every file's hash matches the manifest, original download and project copy. The maximum error between the two pre-master stems and mix is `1.210719347000122e-8`, below the original `2e-6` tolerance.
- Master and dry each differ from mix. Full peak/RMS/first-nonzero-frame values and all hashes are in the JSON. This is not a sound-pressure or hardware-loopback test.
- The receipt's `pinnedSourceExists=true` and bundle `HASH_VERIFIED` support the b41cdeb snapshot. `sameProductSource=false` explicitly records that the workspace already contained later UI changes at verification time. This batch cannot be called a fresh export with every file identical to subsequent main.

The directory name final identifies this delivery batch; it does not replace source verification. Later Meta frequency-band/grounding and Motion-form fixes have their own source/basic tests. Claiming audio from a new bundle requires separately pinning that source and generating another batch, rather than rewriting this receipt.

<!-- english-original-anchor --> <a id="品質與目前未完成項目"></a>
## Quality and work incomplete at this snapshot

Root corrected the third fullcheck runtime result to1328/1328 PASS. Other passing stages reported research669, agents82, prompts12, wiki54, design14, sound34, datasets18, plus build/licenses. Exact totals/skip details for each group follow the original raw stdout; totals are not uniformly presented as having no skips. The full command finally exited1 because documents in progress produced English missing2/stale5/errors16. English/Wiki need separate revalidation after the final documents are fixed. This complete command must not be rewritten as exit0.

The actual Meta UI workflow has a separate [success-and-rejection receipt](04-meta-ui-workflow-receipt.md), retaining the initial empty-table FAIL,22 unit tests, actual production DOM1/1, seven source pins and index-CsQTPNJk bundle. Its source/bundle evidence differs from this audio batch.

When root clicked Save in the actual Motion UI, default HTML step/pattern rules made the form invalid. Root was locally fixing NumberField/the Motion form and adding basic browser cases; final source was not yet frozen. The main switch, complete handoff and Claude's independent later validation still await their actual receipts and are not prefilled as complete.

This page supports only digital files at the pinned source and the recorded progress. The original600-second performance FAIL, device hearing/acoustic science/Meta live/external gates and budget0/fixture boundaries remain unchanged.
