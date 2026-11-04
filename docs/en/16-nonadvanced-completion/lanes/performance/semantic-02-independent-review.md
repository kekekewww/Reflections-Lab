<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/semantic-02-independent-review.md","sha256":"219090e9d857ef077a72d0ff162f465ec203dd27a9cb039cd426df534dd081db","translated_at":"2026-11-03T02:22:58.373Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/semantic-02-independent-review.md`](../../../../16-nonadvanced-completion/lanes/performance/semantic-02-independent-review.md). Source SHA-256: `219090e9d857ef077a72d0ff162f465ec203dd27a9cb039cd426df534dd081db`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="semantic-attempt02獨立原始追蹤審查"></a>
# Semantic attempt02: Independent Raw Trace Review

This round actually failed original numerical-core starting coverage, preserving `exit1 / UNVERIFIED_NOT_APPROVED`. Journal, strict native, original raw V3, and full native journal qualified, but cannot replace numerical coverage. Zero V4 classifications; the out-of-window B exception was unused, and formal 600 seconds remains unqualified.

Python standard library independently read actual gzip/JSON, without importing or executing product JavaScript. Observed HEAD is `94cb2c49b5b00be5c777978b660eb1f9cf4c5f3e`; original V3 core SHA `3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782` and original V2 SHA `df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c` are exactly preserved. See the same-named JSON for raw files/source pins, complete event fields, and reconstructed values.

<!-- english-original-anchor --> <a id="精確拒收條件"></a>
## Exact Rejection Condition

`tests/browser/performance-native-v3.mjs:550` retains `selected.length > 0 && firstStart - begin <= 50000 && end - lastStop <= 50000`. The three results here are true, false, true respectively:

| Field | Actual Value (Microseconds) | Raw Location |
| --- | ---: | --- |
| begin | 953965750 | `/traceEvents/168` |
| First selected task start | 954017620 | `/traceEvents/226` |
| Starting gap | 51870 | Exceeds original 50000 limit by 1870 |
| end | 954578676 | `/traceEvents/2338` |
| Last task original start/dur | 954578569/5591 | `/traceEvents/2329` |
| Last task clipped stop/ending gap | 954578676/0 | Original unchanged overlap |

Owner is `39104:32064`. All 52 owned named tasks are valid X, with 41 selected/41 merged in the window; no B/E. First task posting location is `extensions/renderer/script_injection_manager.cc:190 / DidDispatchDOMContentLoadedEvent`, not CPU attribution to an executed function. The last task is DOMTimer; its tail beyond end is clipped by the original algorithm. Independently reconstructed merged tasks match exactly; performance bins and native bin boundaries match value by value in binary64. `mainTaskOccupancyMs` remains an empty array due to insufficient coverage, without false zeros or passing values.

<!-- english-original-anchor --> <a id="可證實的啟動缺口與未證實原因"></a>
## Established Startup Gap and Unproven Cause

Page v1 `prepareAndPause` registers PC (immediately canceled) and P0/P1 before trace, then pauses at debugger on line 147; Runner v2 lines 271–294 starts trace while paused, and the same existing call establishes begin immediately after resume. Code does not require begin to lie in a new complete trace-captured task. Actual preceding inspector task `/traceEvents/156` ends at `953964944`, 806 microseconds before begin; this raw has no selected complete RunTask enclosing begin.

This establishes insufficient coverage in this receipt and a startup design lacking a task-boundary guarantee; it does not establish the scheduling cause of the 51.870-millisecond wait, trace loss, or that rerunning/extending would qualify. First RAF timestamp is 273.5 ms, while actual callback observation is 597.2000000000698 ms; preserve both clock values without replacing original timestamp with later observation or moving the start.

<!-- english-original-anchor --> <a id="有限修正候選"></a>
## Bounded Fix Candidate

Root approved the following minimal approach for source/VM unit implementation (not permission for another native retry or a qualification pass). Source-only review is complete: a separately versioned page schedules exactly one `setTimeout(0)` bootstrap after original begin/OPEN, without moving begin/end or changing 26 registrations/24 callbacks/13 groups/original 50000-microsecond criterion/numerical core. This is an actual new task with its full cost in original numeric; if actual delivery is too late, original coverage still fails. Under these limits no inherent cheating or hard blocker was found, but this bootstrap cannot recover the uncaptured outer task of original resume or prove all CPU within the window omission-free. It is controlled startup for original edge eligibility, not formal product-load improvement.

Save a separate bounded scheduled/entry/exit/actual-delay auxiliary receipt, paired using real `TimerInstall → TimerFire → aux marks` with the same renderer/exact frame/document navigation/timerId, all inside the window and a complete native RunTask. Schedule only once, without repeated heartbeat until passing; requested timeout=0 is not actual delay=0. Auxiliary names must avoid `rlab-v3.observe.` or the old validator treats them as unknown proof. Bootstrap emits no additional RAF/cancel; cleanup handles its sole pending timer.

Original close timer in this raw provides actual schema: `/traceEvents/2316` TimerInstall is `ph:I / cat:devtools.timeline`, args.data contains frame, singleShot: true, timeout: 0, timerId: 1; `/2330` TimerFire is X with the same frame/timerId. Timer args frame is frame ID, not navigation ID; navigation requires separate mark/document-pin reconciliation. This is only original close-timer schema, not evidence bootstrap executed.

Pin negative cases from this raw, 50000-microsecond/next-binary64 boundaries, missing/duplicate/late bootstrap, wrong owner/frame/navigation/id, nonfinite/reversed timestamps, and the original complete 26/24/13 oracle; validate before a separate version freeze, then at most one Root-scheduled fresh native run. Original V2/V3 core, thresholds, attempt01 rejection, and this failure remain; no immediate retry of identical source. The larger initial proposal to move begin into a fresh task is not adopted, preserving original start and P0/P1 pending relationships.

<!-- english-original-anchor --> <a id="清理與範圍"></a>
## Cleanup and Scope

Actual receipt shows cleanup584 ms, empty errors, browser disconnected, server not listening, identical RAF/cancel identities, pending 0, state CLOSED; source/executable stable before/after. Wrapper machineLeaseReleasable=true and pilotSucceeded=false remain separate. This is a short qualification trace, without any claim of formal 600-second, product-monitor load, PCM, device-output, or listening pass.
