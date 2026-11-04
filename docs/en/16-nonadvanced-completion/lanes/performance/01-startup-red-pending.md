<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/01-startup-red-pending.md","sha256":"f3c1135e2d2ed21c2c22e22942066e48e65cb35a033b973f23d820aeb5ea7cb3","translated_at":"2026-11-03T02:19:12.407Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/01-startup-red-pending.md`](../../../../16-nonadvanced-completion/lanes/performance/01-startup-red-pending.md). Source SHA-256: `f3c1135e2d2ed21c2c22e22942066e48e65cb35a033b973f23d820aeb5ea7cb3`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="perf001014啟動與待執行-red2026-11-03"></a>
# PERF001/014: Startup and Pending RED (2026-11-03)

This lane's worktree: `D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/baseline`; actual HEAD: `e25f9f48302fd357b0f97a6f9bf8565f5916627c`. This page is a stage report for the existing PERF001/014 tasks; it does not replace the task JSON. A single memory writer updates shared knowledge/source/task files.

Read, in order: AGENTS, knowledge/schema, index, now, the latest handoff, PERF001/014, effective ADR011/013/014, AUDIO_RUNTIME, the formal PERFORMANCE_BUDGET, BROWSER_PERFORMANCE, and this round's read-only integration CONTRACT/plan. Applied the spatial-audio-dsp, experiment-validation, and RED→GREEN/systematic-debugging skills.

<!-- english-original-anchor --> <a id="固定範圍與既有證據"></a>
## Fixed Scope and Existing Evidence

- Original V3 formal load: all, a 600-second UI wall window, physics3000, acoustic 600. Do not reduce sources/paths/geometry/captures, or treat 18000 frames or a bytes cap as 600 seconds of continuous capture.
- The rejection of the original V3 launcher SHA `480f275b63d1ea39113cbc8344ac395578acc25b432bd39af5fbc77005179aca` and producer revision `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c` remains unchanged. If a new browser needs qualification, record a separate version and real semantic evidence; changing only the pin is insufficient.
- Preserve the original R17 600-second FAIL and the 2026-11-01 research run of 600.4152 seconds/trace flush timeout. Late onset, snapshot refusal, voice/path drops, PCM gaps, native output underruns, and listening impressions are different metrics.
- e25 already includes `src/audio/diagnostics.ts` and `AudioEngine.getDiagnostics/setDiagnosticsEnabled`. Its 128-slot ring, 500 ms native polling, and unsupported/reset/null semantics are reusable; the current fixture stores only getTelemetry, without full diagnostics.
- `consumerMs + (lastDeliveryHandlerMs ?? 0)` in `performance-fixture-v3.mjs` treats an unknown handler as zero; total cost must preserve null.
- The existing fixture always enables RAF proof, method wrappers, PerformanceObserver, and CDP. Disabling only engine diagnostics does not make it probe-free.

<!-- english-original-anchor --> <a id="新增回歸尚未執行"></a>
## Added Regressions (Not Yet Run)

| File | Behavior to Verify | Result |
| --- | --- | --- |
| `tests/performance-v3/attribution-fixture.spec.mjs` | Run the actual acoustic collector; unknown handler→null total cost; a measured 0 is valid; preserve bounded diagnostics without misreporting unsupported native/PCM as 0 | NOT_RUN, awaiting Root's serial small-test resource lease |
| `tests/performance-v3/probe-free-fixture.spec.mjs` | off preserves native RAF/cancel identities and has no proof callbacks/marks; default on still collects proof | NOT_RUN, awaiting Root's serial small-test resource lease |
| `tests/performance-v3/fixture-adapter.mjs` | Inject an explicit probeMode only into the test host; do not start a browser or simulate product conclusions | Written, NOT_RUN |

No product/formal collector/threshold changes have been made; no test/typecheck/build/browser/benchmark has been run. Root's original baseline full suite holds the machine lease. Next, first observe the correct RED, then implement the smallest change; formal long runs and probe-free pairing require a separate Root exclusive machine lease.
