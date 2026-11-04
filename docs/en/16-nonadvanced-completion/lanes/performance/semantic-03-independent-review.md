<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/semantic-03-independent-review.md","sha256":"48c87337545f31fa1d7fac9af481ee300fdef484a754fb5a22f4781915bd8ab2","translated_at":"2026-11-03T02:22:58.374Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/semantic-03-independent-review.md`](../../../../16-nonadvanced-completion/lanes/performance/semantic-03-independent-review.md). Source SHA-256: `48c87337545f31fa1d7fac9af481ee300fdef484a754fb5a22f4781915bd8ab2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="semantic-attempt03獨立原始追蹤審查"></a>
# Semantic attempt03: Independent Raw Trace Review

Journal, complete native RAF events, single bootstrap, and unchanged numerical core of the actual short scenario were independently reconciled, with no differences found. Conclusion is limited to `SHORT_SEMANTIC_EVIDENCE_CORROBORATED_NOT_FORMAL_APPROVAL`; formal 600 seconds has not run, registry/formal are unapproved, and the complete first version is unfinished. Original attempt01/02 FAILs are unchanged.

Python standard library directly read gzip/JSON and Git bytes, without importing/executing product JavaScript or running Node, tests, build, or browser. Actual observed HEAD and run source are both `03d665a720de4d1b32f1e0a4818d25a28e48d25d`. See the same-named JSON for all 44 sources, original event indexes, binary floating-point output, and raw SHAs.

<!-- english-original-anchor --> <a id="完整固定情境"></a>
## Complete Fixed Scenario

All 52 operations were checked against original fixed order and parents: 26 unique-handle registrations, 24 callbacks, PC/MC cancellations, pending 0 after close. Callback counts in 13 groups are `[2,3,2,1,3,2,1,2,2,1,2,1,2]`; every rawRAF/observedNow binary64 matches 24 callback proofs, 13 representative frames, mark names, and all counters.

Owner derived from original begin `/traceEvents/181` and end `/1848` is `51296:44384`, with thread metadata CrRendererMain; document/navigation match before/after. All actual RAF events belong to that owner/frame: 23 RequestAnimationFrame, 24 FireAnimationFrame, 1 MC CancelAnimationFrame, totaling 25 native handles. Every measured registration/cancel lies inside its designated parent Fire, with request preceding fire/cancel. PC cancellation and P0/P1 registration precede trace; their native events are not falsely claimed captured.

E0 special mark `/traceEvents/31` has ts `2667039546`, before begin; actual callTime is `2667694868`, inside E0 `/1283` Fire `[2667694771,2667694906]`. Custom startTime=0 is explicitly separate from actual occurrence time; mark ts is not presented as callback time.

<!-- english-original-anchor --> <a id="單次bootstrap"></a>
## Single Bootstrap

| Original Event | Index | Evidence |
| --- | ---: | --- |
| TimerInstall | 195 | timerId1、singleShot true、requested timeout0 |
| Complete native RunTask | 197 | ts2667590009, dur181 microseconds |
| TimerFire | 198 | ts2667590016, dur174 microseconds, fully enclosed by the task above |
| Entry/exit marks | 202/203 | Same owner/navigation, both ts and physical callTime inside Fire |

Aux receipt has scheduled550 ms, entered550.5 ms, exited 550.6000000000931 ms; requested0 and actual delivery0.5 ms are separate. Entry is 0.8999999999068677 ms after original begin. Original begin/end did not move; bootstrap task actually entered original numerical input. Entire raw has only bootstrap timerId1 and original close timerId2 Install/Fire pairs, exactly 2 auxiliary bootstrap marks, and no repeated heartbeat. This single task cannot recover the missing outer task from original resume or prove all CPU in the entire window omission-free.

<!-- english-original-anchor --> <a id="未修改數值核心"></a>
## Unchanged Numerical Core

764 native named tasks total, 44 owned all valid X, no owned B/E; original raw V3 receipt is true, V4 classifications0. The out-of-window B classification branch was not retriggered, so this does not establish new native evidence for that branch.

Original window is `[2667589229,2667811785]` microseconds, selected38, merged38; starting gap780 microseconds, ending gap0, meeting original ≤50000-microsecond criterion at both ends. Independently reconstructed 14 occupancy bins, 15 native boundaries, and performance bins using the same binary64 operation order match bit for bit; merged-task arrays also match exactly. This reconciles the original algorithm for a short qualification scenario, not original 600-second performance-threshold results.

<!-- english-original-anchor --> <a id="來源執行環境與清理"></a>
## Sources, Execution Environment, and Cleanup

All 44 method inputs were checked individually: sourceBefore/After, saved archives, current files, and Git bytes at run commit `03d665…` all match. Original V3 core remains `3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782`; original V2 exact SHA remains `df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c`; protected baseline remains e25f9f4. These 44 inputs define method-source scope, not a claim that the full product UI workload was loaded.

Saved CDP/OS receipts report Chrome 156.0.8078.75, revision 861389936bf33ea77529ee5dcc0605e68f6bb620, i9-13980HX/32 logical/33959825408B RAM, Windows10.0.26200, 1920×1080/DPR1; GPU/driver/commandLine remain in JSON. Independent recalculation of current Chrome executable SHA matches both endpoint receipts: `7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa`. Hardware fields come from that saved run receipt; this review did not reopen browser or probe devices. Audio was not requested; sample rate/hardware block/device route stay null.

Original process exit 0, no timeout/cancel/output limit, direct process stopped; processTreeStopped remains null, without overstating forced-tree closure. cleanup403 ms, empty errors, browser disconnected, server not listening, original RAF/cancel identities identical, pending 0, bootstrap FIRED/not pending, state CLOSED. MachineLeaseReleasable=true and pilotSucceeded=true each have evidence. Console retains one 404; pageErrors and trace lifecycle faults are empty. The 404 resource identity was not inferred and the entry was not deleted.

Raw trace SHA is `bbe3d9de15928fcfde0e1cf311d6427199ff4a1f31e770ac8ff0eeca585bc110`, 2716 events/65192B gzip; raw journal SHA `89ead0e679b89f7b9078a03489c3bb1fa7ca9e67889367b37841f48f67ab10f4`. All actual sizes and original caps were checked.

Original attempt01 verification SHA4984cb50… and attempt02 verification SHA9816901c… remain UNVERIFIED_NOT_APPROVED; attempt02 numericCoverageComplete is still false. This success does not replace old failures or establish a pass for formal 600 seconds, probe overhead, product monitor, PCM, native DSP CPU, hardware output, or listening impressions.
