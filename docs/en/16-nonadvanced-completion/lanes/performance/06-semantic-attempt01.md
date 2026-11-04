<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/06-semantic-attempt01.md","sha256":"2f1df6e15d0e1216903059ecb17ee76875a663e0a86b9eb724358a93c4a18b65","translated_at":"2026-11-03T02:19:12.416Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/06-semantic-attempt01.md`](../../../../16-nonadvanced-completion/lanes/performance/06-semantic-attempt01.md). Source SHA-256: `2f1df6e15d0e1216903059ecb17ee76875a663e0a86b9eb724358a93c4a18b65`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="真瀏覽器語義-pilot第一輪拒收保留"></a>
# Real Browser Semantic Pilot: First Attempt Rejection Preserved

The actual run of frozen source bd64e4f did not obtain qualification. The original V3 --formal-600 entry first exited 1 with V3_UNSUPPORTED_NATIVE_LAUNCHER_SHA256, without running a build or browser; the original pin was not replaced to obtain PASS.

The new 55-second owned-child pilot actually exited 1 after approximately five seconds. The page's independent journal validation passed; the original strict native validator rejected RENDERER_TASK_SCHEMA_OR_CATEGORY, so the complete native/journal oracle also rejected it, with status UNVERIFIED_NOT_APPROVED. All 3,306 original events, the 81,393-byte gzip trace, and 834,926 decoded bytes are preserved, with trace dataLossOccurred=false. This failure is neither a formal 600-second performance failure nor a pass; that formal workload has not been run.

Actual Browser.getVersion was Chrome/156.0.8078.75, revision @861389936bf33ea77529ee5dcc0605e68f6bb620; executable SHA7c2fe7… matched before and after. i9-13980HX/32 logical CPUs, NVIDIA RTX4070 Laptop ANGLE D3D11, driver, and complete browser commandLine are in the raw native receipt. Audio was not requested; sampleRate/hardware block/device route are null.

Cleanup took 233 ms; actual browser disconnected, server listening=false, cleanupErrors=[]; original RAF/cancel identities were preserved, pending 0, CLOSED; wrapper process stopped=true, machineLeaseReleasable=true, and the exclusive lease was released to Root. The process_tree_stopped=null from ordinary normal exit was not presented as OS tree-kill evidence; lease release used evidence that the child's actual owned browser/server had closed.

See semantic-attempt01-receipt.json for exact raw paths, canonical copies, and SHAs; semantic-attempt01/ retains only copies of this attempt's raw files. The original source-snapshot remains in the artifact's native subdirectory; its 17 source hashes can also be reconstructed from bd64e4f and the freeze receipt. Next, independently compare the raw data with official producer source; do not directly relax V3 schema/tolerances or change tests to obtain PASS.
