<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/ADR-PERF-SEMANTIC-BOOTSTRAP-V3.md","sha256":"a872249635688d52a215b4d869632711c70f50e3b6068cb9709c6cb066e44bbd","translated_at":"2026-11-03T02:21:45.894Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/ADR-PERF-SEMANTIC-BOOTSTRAP-V3.md`](../../../../16-nonadvanced-completion/lanes/performance/ADR-PERF-SEMANTIC-BOOTSTRAP-V3.md). Source SHA-256: `a872249635688d52a215b4d869632711c70f50e3b6068cb9709c6cb066e44bbd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-semantic-bootstrap-v3一次真實的-post-begin-task"></a>
# ADR-PERF-SEMANTIC-BOOTSTRAP-V3: One Real Post-Begin Task

Status: Root approved candidate implementation; SOURCE/VM VALIDATED, FRESH NATIVE NOT RUN, formal qualification still NOT_APPROVED. This document applies only to the short semantic fixture and does not change the formal 600-second product load.

<!-- english-original-anchor --> <a id="問題與原始證據"></a>
## Problem and Original Evidence

Original V3 raw event eligibility, V4, journal, and full native set passed in attempt02, but original numeric complete rejected it: the first complete task appeared 51.870 ms after begin, exceeding the original 50 ms starting limit. No B/E, zero V4 classifications. Eight real raw files, independent Python binary64 reconstruction, and failure receipts remain in semantic-attempt02-v4/semantic-02-independent-review; original attempt01 rejection also remains. prepareAndPause had entered an old task before trace, then immediately began after resume, without ensuring a new complete captured task; this data cannot establish the scheduling cause of the 51 ms wait.

<!-- english-original-anchor --> <a id="決策"></a>
## Decision

Add page-v2/pilot-v2.html, bootstrap-v1, runner-v3/command-v3; original 27 frozen sources, old entries, original V2 exact bits, V3/formal numeric core, original begin/end, and 50000 us condition are unchanged. Preserve original 26 registrations, 24 callbacks, 13 RAF groups, 23 native Requests, 1 measured Cancel, and E0 special-timing tests.

After resume and original begin/OPEN, schedule setTimeout(0) exactly once. It is not a repeated heartbeat, busy loop, or invented RunTask; 0 represents only requested delay. The actual callback reads entry clock, emits two independent UserTiming marks, then reads exit clock; all scheduling, timing, mark, and callback costs remain in original numeric calculation. If unchanged coverage still falls short of 50 ms, reject it; do not move begin, trim the window, or backfill duration.

<!-- english-original-anchor --> <a id="新的捕獲契約"></a>
## New Capture Contract

An independent bootstrap receipt retains null for unmeasured fields and becomes FIRED only when the actual callback finishes; restore cancels its own unexecuted timer without rescheduling. Its event prefix is rlab-semantic.bootstrap, separate from original rlab-v3.observe.

The candidate must satisfy all of:

- Receipt agrees with original collection, schedule/fire each occur exactly once, requested delay=0, actual scheduled≤entry≤exit all within original performance window; entry is within original begin≤50 ms.
- Original document/navigation agree before/after; trace has no loss and is explicitly closed; original native eligibility is true.
- Unique TimerInstall and TimerFire with matching timerId, same owner/owned frame claim; matching IDs cannot be borrowed from foreign frames. Under pinned producer/category, Install is I/s: t with data only frame/timerId/timeout/singleShot; Fire is X with complete nonnegative duration and data only frame/timerId. Stack category is disabled; extra stack fields belong to a different method and are rejected.
- Captured Fire starts within native begin≤50000 us; captured enter mark startTime is within performance begin≤50 ms; auxiliary self-reported early time cannot conceal real delay. mark startTime and entry/exit clocks link in order; ordinary mark.ts and physical callTime both lie inside Fire with matching navigation.
- One complete raw RunTask encloses all of Fire, and that task has the same structure as a validated task from original native validator. TimerFire or marks cannot impersonate complete RunTask, and unknown/missing native values are not 0.

All five—original journal, original strict native, full native set, new bootstrap capture, original numeric complete—must be actual true; missing, null, truthy strings, or promotional flags cannot pass. Wrapper separately validates actual bootstrap restoration; measurement pass and actual browser/server/process closure are separate, and a genuinely closed failed run can still release its machine lease.

<!-- english-original-anchor --> <a id="已執行與未執行"></a>
## Executed and Not Executed

Actual RED includes missing modules, missing new page, auxiliary false-early/native-late, and backdated ordinary marks; raw TAP is preserved. 138 VM/raw negative tests passed, covering 50 ms and the next binary64 value, original complete callback scenario, foreign/wrong owner/navigation, duplicate/missing events, native/clock mismatch, early close, and false success flags. These establish source/fixture behavior, without claiming native pass.

The formal V4 registry remains empty. The new 55-second bounded command requires Root's exclusive scheduling; real raw, source/executable endpoints, and actual cleanup must be read back, with independent review before qualification can be assessed. Formal 20-second wiring, PCM, and original 600 seconds have not run and cannot be replaced by this short fixture.

<!-- english-original-anchor --> <a id="限制"></a>
## Limits

One new task cannot recover uncaptured CPU from the old resume task, prove the whole window omission-free, or represent product UI/top-row/audio performance. Original 50 ms is only the original edge-coverage criterion. All actual post-begin costs of the new bootstrap are counted; its purpose is only to explicitly and verifiably generate and capture a real task. Every nonconforming new capture still fails under original conditions.

See 12-bootstrap-producer-schema.json for official Timer/UserTiming and Perfetto producer pinned revisions, source URLs, SHAs, and units; formal performance, hardware audio, native-exclusive DSP, and hearing are not thereby qualified.
