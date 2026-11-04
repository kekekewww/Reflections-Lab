<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/semantic-01-independent-review.md","sha256":"26a04e39193301791078b691daf4d50e1a98064c52fa97e2633483829d488f04","translated_at":"2026-11-03T02:22:58.368Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/semantic-01-independent-review.md`](../../../../16-nonadvanced-completion/lanes/performance/semantic-01-independent-review.md). Source SHA-256: `26a04e39193301791078b691daf4d50e1a98064c52fa97e2633483829d488f04`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="semantic-01-獨立-raw官方-producer-審查"></a>
# Semantic-01 Independent Raw/Official Producer Review

Status: **Read-only root-cause review complete; original V3 still rejects, no new qualification obtained**. This runSourceCommit is `bd64e4fba73b3a8d2ead6b6cca9d984c67299e81`; Chrome 156.0.8078.75/revision `@861389936bf33ea77529ee5dcc0605e68f6bb620`. See [JSON](../../../../16-nonadvanced-completion/lanes/performance/semantic-01-independent-review.json) for per-event observations, raw-file/official-source hashes, and limits.

Metadata scope: the old JSON field `observedHead` remains a runSourceCommit alias, not the latest HEAD at subsequent review time. The `reviewObservedHead` actually inspected read-only during this clarification is `047d977f723db067cf703cf265c207855095420e` (2026-11-02T19:37:30.8047856Z); original run, raw, and source pins are unchanged.

<!-- english-original-anchor --> <a id="原拒收的確切原因"></a>
## Exact Cause of Original Rejection

[Original trace](../../../../16-nonadvanced-completion/lanes/performance/semantic-attempt01/pilot.trace.json.gz) is 81, 393 B gzip, decoded 834, 926B/3,306 events; SHA256 `c4481687bfbcb7657a1f0a55d91f48b1e57d68c2736ea6de7a8dcfb40f887b72`.

The sole renderer task unsupported by the original predicate is at `/traceEvents/2377` (0-based):

```json
{"args":{"src_file":"cc/trees/proxy_impl.cc","src_func":"ScheduledActionSendBeginMainFrame","src_line":849},"cat":"toplevel","name":"ThreadControllerImpl::RunTask","ph":"B","pid":72488,"tid":93008,"ts":99067311504}
```

Original begin/end are 99066898433/99067295193µs. This event occurs **16,311µs after** end, without `dur`; the renderer has 48 task candidates, 47 `X` and 1 `B`, with no renderer `E`. Category is unchanged.

The [archived original predicate](../../../../../tests/browser/performance-native-v3.mjs) L291 explicitly validates all same-renderer candidates before overlap selection; L314–318 require non-instant events to be complete `X` spans. This `B` is correctly rejected for phase/missing duration; its out-of-window location does not justify relabeling the original result. Preserve original `RENDERER_TASK_SCHEMA_OR_CATEGORY`, `UNVERIFIED_NOT_APPROVED`, empty numeric results, and native oracle `observedCounts:null`.

<!-- english-original-anchor --> <a id="官方-pinned-producerexporter-鏈"></a>
## Official Pinned Producer/Exporter Chain

An independent subreview obtained all sources below with Windows `Invoke-WebRequest` over normal TLS, HTTP200, without disabling certificate validation. Web-tool inaccessibility, a Python trust-store error, and one 503 are acquisition history, not file 404 s. Complete decoded-source SHA/bytes/license headers are recorded in JSON; full texts were not copied into the repository.

| Pinned Source | Line Numbers and Supported Semantics |
| --- | --- |
| [Chromium controller](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/task/sequence_manager/thread_controller_with_message_pump_impl.cc#476) | L476–484 passes `ThreadControllerImpl::RunTask` to TaskAnnotator. |
| [TaskAnnotator header](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/task/common/task_annotator.h#102) | L102–115 encloses RunTaskImpl in `TRACE_EVENT("toplevel", event_name, …)`. |
| [TaskAnnotator implementation](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/task/common/task_annotator.cc#261), [interned location](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/trace_event/interned_args_helper.cc#34) | L261–264/L34–47 record posting-location file/function/line. |
| [Chromium DEPS](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/DEPS#2843) | L2843–2844 pins Perfetto `403906f4adfbf287a02e5546f8430dcc9d56b649`. |
| [Pinned JSON exporter](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/trace_processor/export_json.cc#646) | L646–660 maps `src_file/src_func/src_line`; L799–809 creates event ts/category/name/args. |
| [Pinned thread-slice export](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/trace_processor/export_json.cc#880) | L880–908: zero duration→`I+s:t`; positive duration→`X+dur`; unfinished negative duration→`B`, without generating duration/end. |
| [Actual posting site](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/cc/trees/proxy_impl.cc#806) | Within the function at L806, L849 is PostTask's `FROM_HERE`; L850 binds ProxyMain:: BeginMainFrame. |

Raw `B`/missing `dur`/missing `s` matches this pinned exporter's unfinished thread-slice branch, **not a new category or a proven version change**. `src_func` is posting location, not the task's executed function or duration. JSON lacks original protobuf `duration_ns` and alone cannot prove why the slice did not finish. Right censoring at trace stop is consistent with this out-of-window event but remains a mechanism inference; duration must not be invented.

<!-- english-original-anchor --> <a id="完整-raf-集合與時間觀察"></a>
## Complete RAF Set and Timing Observations

Independent Python read only original gzip/JSON, without calling the product parser or running a new browser:

- 26 unique journal registration handles, 24 callbacks, 13 groups; exact group sizes `[2,3,2,1,3,2,1,2,2,1,2,1,2]`.
- Owned document has 23 Requests, 24 Fires, 1 Cancel; 25 native trace handles, 0 unknown. The 23 Requests are 22 posttrace callbacks that execute plus MC.
- Every posttrace Request and the sole MC Cancel lies inside its parent Fire and original window. MC handle9 Request/Cancel are 99067112174/99067112220µs; parent B1 Fire is 99067112120+149µs; MC has no Fire.
- PC handle1 native register/cancel occurs before trace; this trace cannot independently prove its cancellation. P0/P1 Requests were not captured and each has one Fire, consistent with pretrace-pending scope.
- All 13 proof physical callTimes lie within their own Fire/window. E0 ordinal6/handle14 mark ts=99066512284µs is before begin, but physical callTime=99067178607µs lies inside Fire=99067178423+256µs.
- Last owned Fire.end=99067294986µs, 207µs before end mark. Native markers differ by 396760µs; DOM performance window is 396.70000000298023 ms. Preserve each original value without rounding or substitution.

These subresults are **passing observations, not qualification**. The formal native oracle stops at original strict rejection; this report does not backfill its null fields.

<!-- english-original-anchor --> <a id="後續方法候選與界線"></a>
## Follow-Up Method Candidate and Boundaries

Recommend a separately versioned method ADR/equivalence contract, bounded positive/negative fixtures, and producer registry, leaving original V3/old pins unchanged. The narrow candidate preserves complete raw and classifies every task, separately listing only the known begin-only event with the same owned renderer, `cat==="toplevel"`, exact verified source-args shape, absent `dur`, and finite `ts>end` as post-window unfinished. Initial allowed values should pin this verified source location; keep duration null and numericIncluded=false, never 0 or a deleted event. Any `B<=end`, unknown `E`, wrong category/args/identity, negative, or nonfinite value is still rejected.

Original complete-span numerical core, binary64 boundaries, caps, workload, voices/paths/geometry/capture, and thresholds remain unchanged, with no epsilon, rebinning, or duration scaling. This is only **PROPOSED, not adopted/not executed**. A new version still requires a new semantic pilot, original 20-second all wiring, and formal 600-second validation; this raw cannot be changed to PASS.

Another direction is a bounded renderer quiescence/freeze handshake after end before closing trace. It might reduce unfinished tails but adds post-window lifecycle intervention and cannot guarantee no more begin-only events; source must be pinned, all failures preserved, and measurements repeated. Capturing native protobuf directly provides clearer slice information but adds parser/resource/provenance work and cannot recover this JSON's duration.

<!-- english-original-anchor --> <a id="資源與本次操作"></a>
## Resources and Operations in This Review

Original process exit 1/4754.4203ms; browser disconnected, server no longer listening, cleanup233ms/0 errors. Process outcome is machineLeaseReleasable=true, pilotSucceeded=false; this is actual cleanup evidence from normal completion, without claiming forced process-tree termination.

This review adds only this MD/JSON, changing no source/tests, old raw, pin, predicate, or tolerance; no unit/build/format, new browser, audio-device/listening test, or formal 600-second run occurred. Persistent task/source registration is left to the single memory writer for reconciliation.
