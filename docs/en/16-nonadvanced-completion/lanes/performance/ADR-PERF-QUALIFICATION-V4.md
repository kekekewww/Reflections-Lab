<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/ADR-PERF-QUALIFICATION-V4.md","sha256":"bc5d9f8af4053753da369248d95191a6a0e129ec37028c462944156549246737","translated_at":"2026-11-03T02:21:45.886Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/ADR-PERF-QUALIFICATION-V4.md`](../../../../16-nonadvanced-completion/lanes/performance/ADR-PERF-QUALIFICATION-V4.md). Source SHA-256: `bc5d9f8af4053753da369248d95191a6a0e129ec37028c462944156549246737`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-qualification-v4嚴格窗外-begin-only-task-的獨立方法版本"></a>
# ADR-PERF-QUALIFICATION-V4: Independent Method Version for Strictly Out-of-Window Begin-Only Tasks

Status: Root authorized implementation of the candidate rule; **NOT_QUALIFIED/NOT_APPROVED**. No new semantic pilot, 20-second wiring, or formal 600-second evidence exists. This ADR neither changes nor replaces original V3 results.

<!-- english-original-anchor --> <a id="問題與已核實來源"></a>
## Problem and Verified Sources

semantic-attempt01 is pinned to bd64e4f; original V3 correctly rejects the sole owned renderer task: ThreadControllerImpl:: RunTask, ph=B, cat=toplevel, no dur, starting 16,311 microseconds after original native end. The 47 complete X spans, RAF set, and time anchors are retained. The old result remains UNVERIFIED_NOT_APPROVED.

See semantic-01-independent-review.{md, json} for the independent official chain: Chromium revision 861389936bf33ea77529ee5dcc0605e68f6bb620 DEPS pins Perfetto 403906f4adfbf287a02e5546f8430dcc9d56b649; its export_json.cc emits B for an unfinished slice without inventing duration/end. Original JSON lacks protobuf duration_ns and cannot prove why that slice did not finish. src_file/src_func/src_line identify posting location, not executed-function cost.

<!-- english-original-anchor --> <a id="獨立-v4-候選契約"></a>
## Independent V4 Candidate Contract

The original trace is preserved in full. Original validateNativeV3 still runs on the same raw and preserves its rejection. New typed classification does not rewrite, trim, or patch raw, or generate a fictitious X span.

The only new classification is POST_WINDOW_BEGIN_ONLY, requiring all of:

- producer revision and launcher SHA exactly match the independent registry's pinned candidate values.
- Task owner exactly matches renderer pid/tid of the original valid begin/end anchors.
- Name ThreadControllerImpl:: RunTask, exact category toplevel, phase B; top level contains only the original seven fields args/cat/name/ph/pid/tid/ts, with dur/tdur/s absent.
- args contain only src_file/src_func/src_line, exactly cc/trees/proxy_impl.cc/ScheduledActionSendBeginMainFrame/849.
- ts is finite and strictly greater than original native end. Do not alter the boundary using epsilon, rounding, or display precision; end and the next smaller binary64 value are rejected, and only the next larger value may be classified.
- At most one such classification per owned renderer. Reject any owned task that original V3 cannot accept and this sole rule cannot classify.

Output preserves original event index and complete source event, separately listing duration: null, numericIncluded: false. A candidate at the verified source location with the wrong owner cannot use other-thread exclusion to obtain classification. Other originally excludable non-owner work is still recorded under original V3 rules; its time does not fill main-thread cost.

Reject B inside the window, an overlap with unknown end time, B.ts==end, unknown E, wrong category/name/args/location/identity, nonfinite time, any dur (including 0 or null), and multiple candidates. Missing duration is not 0 cost; this classification proves only a start after the cost window.

<!-- english-original-anchor --> <a id="原核心與新證據"></a>
## Original Core and New Evidence

Complete X spans go to unchanged unchangedNumericV3/formalNumericV3, preserving binary64 anchors, union/intersection, original caps, original 50,000-microsecond coverage, and original thresholds. The 600-second wall, voices, default/stress paths, geometry, capture, tails, and recorder caps are unchanged. Missing data stays null; unit tests or code review cannot replace native-trace qualification.

Bounded RED/GREEN covers old rejection of actual original raw, exact/nextfloat end boundaries, inside-overlap, schema/owner/producer/cap negative cases, unchanged original raw, and new typed complete-span costs exactly matching original numerical reference. Registry initially has status=NOT_QUALIFIED; only after independent source review and new semantic raw review may qualification be registered in a separate version. Do not retroactively assign PASS to attempt01.

Next: bounded pure regressions and independent review, a new semantic pilot, original 20-second all wiring, then original 600 seconds. Same-condition probe-free and PCM/process CPU overhead are separate; unobserved callback CPU/hardware underruns are not reported as 0.
