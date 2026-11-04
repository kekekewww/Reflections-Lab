<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/13-bootstrap-v3-source-review.md","sha256":"9b7a4aa4021240bf57c406f6e475fe65458b39075245a627d632aa55f02e584b","translated_at":"2026-11-03T02:21:45.848Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/13-bootstrap-v3-source-review.md`](../../../../16-nonadvanced-completion/lanes/performance/13-bootstrap-v3-source-review.md). Source SHA-256: `9b7a4aa4021240bf57c406f6e475fe65458b39075245a627d632aa55f02e584b`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="bootstrap-v3-獨立來源審查"></a>
# Bootstrap V3 Independent Source Review

Conclusion: NO_P1_P2_REMAINING_SOURCE_REVIEW_ONLY. This round read only the new bootstrap-v1, page-v2, pilot-v2.html, runner-v3, command-v3 and their tests; no Node, test, browser, build, fresh native, or formal 600-second run was executed. Source review cannot stand in for a successful next real capture; formal qualification remains NOT_APPROVED.

The two previous actual gaps have been fixed at source level. The 50 ms criterion no longer relies solely on auxiliary self-reporting: captured TimerFire.ts-native.begin must not exceed 50000 us, and captured enter mark.startTime-origin must not exceed 50 ms. Trace timestamps and physical callTime of both ordinary marks must lie inside a complete Fire with the same owner; navigation, mark ordering, and linkage to entry/exit clocks are also checked. Negative cases for native-late/self-reported-early and backdated ordinary marks exist; this review read them without rerunning them.

The original numeric core, begin/end, complete native spans, and 50 ms threshold are retained. The runner must obtain actual true for journal, strict native, full native set, bootstrap capture, and numeric complete simultaneously; missing values or flags cannot rescue a failure. The page schedules only one extra real timer after original begin/OPEN, with no repeated heartbeat, busy loop, or change to the original 26 registrations/24 callbacks/13 groups and E0 special-timing scenario.

sourceArchive declares 44 distinct sources, all present and including the original 27 frozen inputs; every hash matched in this round, and original V2 exact bits remain intact. The server serves archived in-memory bytes; the four actual resources are the new html, page, bootstrap, and original proof collector. No product UI or AudioContext is loaded.

The 45-second operational deadline, shared 8-second cleanup operations, and 2-second receipt reserve are retained; a normally failed capture may release its lease after browser/server actually close, while measurement success separately checks bootstrap FIRED and no pending timer. Forced timeout/cancel/output limit still require evidence that the process tree stopped; unknown or false cannot become success.

55 seconds is the owned-child watchdog trigger, not a guarantee of a completed receipt or whole-process-tree termination within 55.000 seconds. The original frozen runner allows up to another 2.5 seconds for taskkill and 3 seconds for closure confirmation on Windows; outer receipt I/O follows. Root must retain exclusivity until actual terminal/cleanup are read back and reserve approximately 65 seconds in scheduling. This clarification changed no original program source or threshold.

A separate source-document P2 was corrected: the initial 12-bootstrap-producer-schema draft listed only the first three categories, omitting v8 and disabled-by-default-devtools.timeline.frame. Parent explicitly authorized correction before freeze/commit; both 12 reports now list all five. The conclusion that stack is disabled and official source pins remain unchanged; initial and corrected SHAs are preserved in this review's JSON, without portraying a document correction as a measurement rerun.

Limits remain: one new task cannot recover uncaptured CPU from the old resume task or prove the entire window omission-free; new results can come only from the next exclusive actual run. Original attempt01/02 FAILs and all 27 original inputs are preserved. This review verifies none of 20-second wiring, PCM, the original 600-second product load, Task0033 default top-row cost, devices, or hearing.
