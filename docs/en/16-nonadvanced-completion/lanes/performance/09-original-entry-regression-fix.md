<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/09-original-entry-regression-fix.md","sha256":"1735787bd7e2808dfe00bdc3aed90a0f838171fc3e628566ac4a15ec79bb90cb","translated_at":"2026-11-03T02:19:12.420Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/09-original-entry-regression-fix.md`](../../../../16-nonadvanced-completion/lanes/performance/09-original-entry-regression-fix.md). Source SHA-256: `1735787bd7e2808dfe00bdc3aed90a0f838171fc3e628566ac4a15ec79bb90cb`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="原完整性能回歸恢復v2-preimage-與-probe-on-測試環境"></a>
# Original Full Performance Regression Restored: V2 Preimage and Probe-on Test Environment

Root actually ran 826 tests at the integration entry: 824 PASS/2 FAIL. These two failures are preserved in original-entry-regression-red-r1.tap; the original reference's fixed SHA and behavioral assertions were not changed to obtain PASS.

I previously put attribution-metric derived behavior into the original V2 source that had to remain immutable; this was an implementation error in this batch. The exact preimage bytes were then obtained with git show e25f9f4:tests/browser/performance-profile.mjs, verifying SHA df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c both before and after writing them back, without reset or clean. The new metric moved to performance-attribution-metrics-v1.mjs; only the new attribution test changes its import. Original V2 and the original numerical/reference core retain their exact original bytes.

The other failure was that the original exact-wrapper test host did not provide the new probesEnabled outer environment. Only probesEnabled: true and its destructuring were added to env to execute the real probe-on branch; all original callback bits/handle/cancel/invoke-once/restoration assertions were preserved unchanged.

A serial rerun of the original integration entry plus seven new specs passed 826/826 with 0 skipped; raw is original-entry-plus-seven-green-r1.tap. Scoped formatting/lint also passed. See original-v2-preimage-restoration-receipt.json for the exact preimage, before/after SHAs, and original failure receipt.

The 27 Semantic V2 frozen source pins still match file by file; this fix does not change them. Old bd64 and attempt01 raw/rejection results are not rewritten. The old source SHA in the PCM source-v1 receipt is a historical snapshot; this fix supersedes the file containing its metric. Real PCM, fresh semantic, 20-second wiring, and the formal 600-second run remain NOT RUN.
