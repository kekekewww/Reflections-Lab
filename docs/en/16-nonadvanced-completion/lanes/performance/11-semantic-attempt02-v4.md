<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/11-semantic-attempt02-v4.md","sha256":"5bcc9c5f71bba237ee856da9c1aaeacd7064cff43f58a929d07e2e037c6bbbea","translated_at":"2026-11-03T02:20:49.819Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/11-semantic-attempt02-v4.md`](../../../../16-nonadvanced-completion/lanes/performance/11-semantic-attempt02-v4.md). Source SHA-256: `5bcc9c5f71bba237ee856da9c1aaeacd7064cff43f58a929d07e2e037c6bbbea`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="semantic-attempt02-v4原數值覆蓋拒收"></a>
# Semantic attempt02 V4: Original Numerical Coverage Rejection

After Root explicitly granted an exclusive window, the pinned V2 short-trace command actually ran on 2026-11-03. Result: exit 1, UNVERIFIED_NOT_APPROVED; actual owned-child duration 4942.5342 ms, without timeout/output limit. This is not the formal 600-second workload or evidence of product/new top-row performance.

Original V3 event eligibility, V4 strict native, journal, and full native set all passed; V4 classified no events. This attempt did not require the out-of-window B exception; preserve attempt01's original rejection and every original threshold. The original 26 registrations, 24 callbacks, 13 groups, 23 Request/24 Fire/1 Cancel, and 25 trace handles are retained.

The failure condition is precisely located: the original numeric core requires the first selected task to be no more than 50000 us after begin. Here begin=953965750 us; the first complete renderer task at original ordinal 226 starts at 954017620 us, a gap of 51870 us, exceeding the limit by 1870 us; trailing gap is 0, selected tasks=41. Thus complete=false and main-thread numerical arrays remain null, never misreported as 0 ms or PASS. V4 classification was not the cause; original core, bin boundaries, completeness threshold, and measurement endpoints were unchanged.

Preliminary source inspection shows the prepareAndPause task had already entered before trace and was paused by the debugger; begin occurs within that same existing task after resume. This fixture startup-timing issue awaits independent raw reconciliation and alone does not establish why the slice was unfinished. No immediate rerun occurred; any follow-up fixture fix requires a separate version, independent RED/GREEN, and a new source freeze, retaining the original failure.

Cleanup succeeded: browserConnectedAfterCleanup=false, serverListeningAfterCleanup=false, cleanupErrors=[], taking 584 ms; RAF/cancel identities retained, pending=0, state=CLOSED. Source/executable were stable before/after; the wrapper's machineLeaseReleasable=true was reported separately to Root from pilotSucceeded=false. Normal direct_process exit, processTreeStopped=null, without claiming forced tree-closure evidence.

See semantic-attempt02-v4-receipt.json for eight canonical raw copies and hashes; trace gzip SHA256=02e874df3350dbab25db5a9b10c7503bc2bc9bd65f26b87c613aa952fd767d0b. 3565 events, gzip 85161 B/decoded 892375 B. All 27 frozen sources match individually; original V2 exact SHA256 remains df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c.

This short trace has no AudioContext/product UI; sample rate, hardware block, and native DSP CPU are null. RAF, 15 Hz sampling, and analyser for the new top row's default levels/master-left are formal product load; future probe-on/off and before/after comparisons must pin and retain them separately, without using this short trace to estimate their cost. The formal qualification registry remains empty; 20-second wiring, PCM, and formal 600-second measurement have not run.
