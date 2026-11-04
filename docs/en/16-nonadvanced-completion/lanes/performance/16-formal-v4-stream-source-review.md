<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/16-formal-v4-stream-source-review.md","sha256":"977c8f4e1072309b7a38576c2112e932f2ca68cc0e0604b5e4791bcfbc74b154","translated_at":"2026-11-03T02:49:45.465Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/16-formal-v4-stream-source-review.md`](../../../../16-nonadvanced-completion/lanes/performance/16-formal-v4-stream-source-review.md). Source SHA-256: `977c8f4e1072309b7a38576c2112e932f2ca68cc0e0604b5e4791bcfbc74b154`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="formal-v4-stream-獨立來源審查"></a>
# Formal V4 Stream Independent Source Review

Conclusion: **No P1/P2 found, limited to source and existing-artifact review.** The new analyzer does not promote a short fixture into a formal 600-second or registry pass; `ALGORITHM_ONLY`, `formal600Run:false`, and `NOT_APPROVED` remain explicit on both success and failure paths.

Checkout HEAD actually read: `dc4aaa49f3ac0773c45263f35007018654034f8f`, at `2026-11-03T00:58:15.0645134+00:00`. The new analyzer/spec were untracked at that time; this HEAD is a review snapshot, not a new benchmark sourceCommit. See [JSON](../../../../16-nonadvanced-completion/lanes/performance/16-formal-v4-stream-source-review.json) for exact source/artifact pins.

<!-- english-original-anchor --> <a id="來源審查結果"></a>
## Source Review Results

| Check | New Analyzer Lines | Result |
|---|---|---|
| Original parser, fixed caps, single pass | L33–75 | Calls original `parseTraceStream` once, passing original 256 MiB gzip/2GiB decoded/8M events, with fixed parse timeout 300000 ms; does not substitute whole-file JSON.parse. |
| Validate all raw before filtering | L35–47 | Each raw row is first checked for object shape and name≤512, then original 2 GiB heap; foreign/pruned rows cannot bypass this. |
| Evidence retention and shared budget | L45–64 | Original V3 set plus B/E of all owners/names and all known posting-site events; all share original 512 MiB serialized retained cap, with no extra B/E allowance. |
| Original named-task cap | L48, L76 | All original task names retained. Frozen V4 runs original V3 first; original 2M `TASK_CANDIDATE_CAP` is not erased by typed B classification. |
| Original boundary + numerical core | L76–79 | Original `validateNativeBoundaryV4` followed by original `formalNumericV3`, without rewriting spans or adding epsilon/clock shift/rounding. |
| Original raw ordinal | L80–89 | First validates retained index and `source` object identity, then uses saved raw-index map; preserves `duration:null`/`numericIncluded:false`. |
| Separate full stream/view fields | L96–114 | Full raw count comes from parser stats; retained/input view from retained.length. 938 raw named/937 typed are not conflated. |
| Numerical completeness | L117–129 | Coverage requires both native qualified and original numeric complete; original V3 rejection is separate, without misreporting old results as PASS. |
| Failure evidence | L133–161 | Preserves original error strings; unknown full count stays null with prefix count separate; empty numeric, false coverage, marked duration null are not reported as zero cost. |

Actual original V3/V4/stream/numeric code was also checked: original V3 L272–281 named-task ceiling remains before typed exclusions; original numeric L24–56 complete-task validation, two-anchor binary64 mapping, union/intersection, and 50 ms edge are unchanged. This judgment does not rely only on wrapper self-reported fields.

Retaining a known-site wrong-owner unknown-name `X` without adding rejection is existing frozen V4 semantics; only its B/E follow that boundary's owner rejection. The new wrapper/spec do not expand frozen-helper qualification.

<!-- english-original-anchor --> <a id="既有測試與來源身份"></a>
## Existing Tests and Source Identity

Read-only inspection of existing TAP confirms:

- RED: 26 tests/25 pass/1 fail, with the first missing-export assertion failing; cases behind the guard did not execute semantic assertions then, so their ok status does not establish tested negative cases.
- GREEN: 26 tests/26 pass/0 fail/0 skipped; TAP duration `1519.7442ms`. This reviewer did not rerun it; TAP alone also does not establish process exit code or a 600-second workload.
- Existing lint log is empty; Parent reported lint exit 0, but an empty log alone does not prove exit. Format log lists only the two new files; no formatter was run in this review.

Spec covers canonical raw/hash and original full-raw V3 rejection, Float64-bits reference for 47 originally valid X spans, object/name boundaries, owned/unknown B/E, wrong-owner known site, wrong task outside window, original gzip/CRC/duplicate-key errors, and producer/executable/loss/close rejection. It also includes foreign B/E retained+2, original ordinal 2378 after insertion before pruned rows, and known-site foreign X retained+1; tests were not changed to obtain PASS.

Rehashed every entry in committed `semantic-v3-source-freeze-receipt.json`: **all original 27/27 and frozen 44/44 match**, with no mismatches. This review changed no original sources, raw, thresholds, caps, registry, or spec.

| Source | SHA-256 |
|---|---|
| `tests/browser/performance-native-formal-v4.mjs` | `05f4c66ab31cde4446d1bb9ed5a2a06bd12464e2f5c266368366c5056823b10d` |
| `tests/performance-v3/formal-v4-stream.spec.mjs` | `58cb77715c4f53262626554bcc8a9e05dccd416a312f7a36eaab643484f26e68` |
| `tests/browser/performance-native-v3.mjs` | `3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782` |
| `tests/browser/performance-native-boundary-v4.mjs` | `55ccd030a3650b78c197f29c68f671ab8d4f344dd43864fbf97bb0b4e439ad8d` |
| `tests/browser/performance-qualification-registry-v4.mjs` | `5517664d3e9437257488414584c3dc7140572797103b7611269a98f125adc48d` |
| `tests/browser/performance-stream-v3.mjs` | `064b3071d350f9bc3dc4f39682a21c1f1e19f68fd3929a9c147551a149abeaab` |
| `tests/browser/performance-numeric-formal-v3.mjs` | `93e4005ab4fc93c110a7f39d8e5272434f5f6b92500ab98e9f0e4a96588913e4` |

<!-- english-original-anchor --> <a id="未執行與後續有限測試缺口"></a>
## Not Executed and Remaining Bounded Test Gaps

Current code handles these correctly; the following nonblocking test gaps can receive real RED tests later. This review does not change the spec:

1. Malformed raw encountered after a retained prefix: directly verify full count remains null, prefix count separate, numeric empty, coverage false, preventing future treatment of partial prefix as a full stream.
2. First construct a native-candidate/numeric-incomplete fixture with an independent original oracle, then verify wrapper does not equate native qualified with numeric complete; original 50 ms edge is unchanged.
3. Short fixtures did not stress 256 MiB gzip, 2 GiB decoded/heap, 8M events, 2M named tasks, 512 MiB retained, or 300000 ms parsing. These guards were code-reviewed, not stress-measured.

300000 ms is the parser budget, not an end-to-end watchdog for all synchronous native/numeric analysis. Heap guards also sample by stage/event and cannot prove continuous allocation peak. A future launcher should retain its own watchdog and machine-lease lifecycle; this is not a new completion claim by this helper.

This review used `codex-verification` to separate source/existing artifacts/protected pins, with a separate isolated reviewer cross-check. Under explicit task limits, no Node, test, typecheck, build, browser, or benchmark was started; only this MD/JSON was added. Formal qualification remains **NOT_APPROVED**.
