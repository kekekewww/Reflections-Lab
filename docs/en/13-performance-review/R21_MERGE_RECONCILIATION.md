<!-- english-source: {"path":"docs/13-performance-review/R21_MERGE_RECONCILIATION.md","sha256":"86e351afb224cd92ebb5660aa5da16221088bd8581dff51a68417365043e47e8","translated_at":"2026-11-02T03:27:47.000Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/R21_MERGE_RECONCILIATION.md`](../../13-performance-review/R21_MERGE_RECONCILIATION.md). Source SHA-256: `86e351afb224cd92ebb5660aa5da16221088bd8581dff51a68417365043e47e8`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="效能研究合併與-r21-對照"></a>
# Performance review merge and R21 reconciliation

Date: 2026-11-02 (Asia/Taipei). Status: **documentation merge record**; it changes no research conclusion, product code, test, threshold, accepted ADR or task status. Executor: Claude Code (claude-opus-5-5). Per-file data is in the [machine-readable reconciliation record](../../13-performance-review/evidence/r21-merge-reconciliation.json).

<!-- english-original-anchor --> <a id="合併內容"></a>
## What was merged

The research branch `review/performance-buffer-20261101` (HEAD `7502cc5`, reviewed payload `23b93b3`) was merged into `claude/meta-hack-r18-handoff-d292c8` with `git merge --no-ff`. After the review finished, the target branch gained two R21 commits: `38925e6` (code and tests) and `6374acf` (documents, evidence and Wiki). At review time the target still had uncommitted R21 work, so the review only prepared a patch and did not merge (see the [integration report](INTEGRATION_REPORT.md)); with R21 committed, that precondition no longer holds.

Conflicts occurred only in the generated Wiki indexes, the English mirror inventory files and `now.md`:

- The Wiki index and log were rebuilt by the Wiki CLI from both sides' events, tasks and pages.
- The English inventory, manifest and validation were regenerated.
- `now.md` keeps R21 first, then this review, then R20 and older history.
- The English index, log and task lines are the union of both sides' translations, checked line by line against the rebuilt Chinese pages.

The review documents themselves are unchanged, word for word.

<!-- english-original-anchor --> <a id="版本界線"></a>
## Version boundary

The review's code facts and line numbers still refer to `05d40fd`. Of the 73 code and test files the review cites, R21 changed 42; the reconciliation record keeps each file's SHA-256 and Git blob at `05d40fd`, and `git show 05d40fd:<path>` reproduces what the review read.

At 2026-11-01T08:48Z the review recorded the then-uncommitted R21 working tree (49 files). Compared with the final commits, 30 are identical and 19 changed afterwards:

| Files | Version the review read vs. the commit | Meaning |
| --- | --- | --- |
| `src/audio/control.ts`, `src/audio/routes.ts`, `src/audio/types.ts`, `src/audio/buffer-preset.ts` | Identical | The code reading in section 2 of the [audio review](AUDIO_GRAPH_DSP_REVIEW.md) on buffer presets, the target deadband and coalesced listener updates applies to the committed R21 |
| `src/audio/engine.ts`, `src/app/runtime.ts`, `src/interaction/interaction-host.ts` | Different | After the review, the second and third R21 independent review rounds and the final fixes changed resume invalidation, cursor restoration, the catch-up time anchor, restart failure and placement refusal; the review never read these versions |
| The other 16 files (8 UI files, 2 browser tests, 6 R21 documents) | Different | Hover tooltips, dimension fields and test adjustments, with no direct bearing on the review's performance conclusions |

<!-- english-original-anchor --> <a id="r21-最後量測與研究任務"></a>
## Final R21 measurements and the review tasks

The final two R21 audio runs (headless Chrome 156, 20 s per scenario, no capture tap): the editor and the first-person walk each had 1 output underrun per run (about 10 to 12 ms); the R20 baseline had 19 and 14. No hash manifest was saved at run time; the source files were last modified at 01:11 (+08:00), the runs started at about 01:54, and at merge time `src/` is identical to `38925e6`, so the runs are inferred to have measured the committed code (INFERRED). The early negative samples the review preserved (74 and 38) are kept as they are.

These results relate to the review tasks but **meet no acceptance criterion**: the 14 optimization tasks stay BACKLOG with every criterion unverified, and the 7 proposals stay PROPOSED.

| Review task | What R21 already did that can serve as a starting point | Still missing |
| --- | --- | --- |
| [001](../../../knowledge/tasks/RLAB-TASK-PERF-20261101-001.json) attribution and native output baseline | A `playbackStats` output underrun counter (shown as NOT_AVAILABLE when unsupported); the `tests/browser/audio-smoothness` harness with no-tap, `render=none`, `freezeListener=1` and `lookahead=0` controls | Source and bundle hashes at run time, device and actual sample rate, controlled stall fixtures, listening; each kind of dropout recorded in its own field |
| [003](../../../knowledge/tasks/RLAB-TASK-PERF-20261101-003.json) native update responsibilities | Removed the parameter automation repeated on every physics step (target cache and deadband), listener synced once per frame, scheduling lookahead used only for onsets; future-scheduled ramps measured as a regression (74) and withdrawn | Separate oracles for scalar, shape, delay and direction; the deadband error reported on its own; benefit under the same load |
| [014](../../../knowledge/tasks/RLAB-TASK-PERF-20261101-014.json) baseline and revalidation | The two 20 s headless runs above | A 600 s profile, device and browser qualification, lifecycle scenarios, human listening |
| [009](../../../knowledge/tasks/RLAB-TASK-PERF-20261101-009.json) simulation Worker | Not done; physics still runs on the main thread | Following the review's order, first complete the attribution and data semantics of 001, 002 and 004 |

<!-- english-original-anchor --> <a id="對目前文件的影響"></a>
## Effect on current documents

The R21 [known limitations](../KNOWN_LIMITATIONS.md) said that if a real GPU browser still stutters, the next step is moving the physics simulation into a Web Worker. The review's order is attribution first (001), then deciding on the recording hot path (002) and native updates (003) from the data; the simulation Worker (009) is P2 and needs evidence from 001, 002 and 004. This merge changes that limitation to follow the review's order and no longer names a Web Worker as the default next step.

<!-- english-original-anchor --> <a id="任務證據重新釘選"></a>
## Task evidence repinned

The evidence of [002](../../../knowledge/tasks/RLAB-TASK-PERF-20261101-002.json) and [009](../../../knowledge/tasks/RLAB-TASK-PERF-20261101-009.json) pinned the `05d40fd` hashes of `src/app/runtime.ts` and `src/app/bootstrap.ts`; R21 changed both files, so Wiki lint reported `TASK_EVIDENCE`. The Wiki CLI can only update a task after claiming it, but these two tasks have dependencies that are not DONE, and claiming changes BACKLOG to IN_PROGRESS and then READY on release. The two evidence items were therefore edited directly to point at the [machine-readable reconciliation record](../../13-performance-review/evidence/r21-merge-reconciliation.json), which keeps the original hashes and Git blobs; status, owner, priority, dependencies and acceptance criteria are unchanged.

<!-- english-original-anchor --> <a id="仍不能宣稱"></a>
## Still not claimed

- The review's 600 s profile remains exit 1 with a trace flush timeout and is not changed to PASS.
- The R21 measurements are not the controlled retest the review asks for, nor a device listening test, and cannot be used to declare the audio dropouts fixed.
- The merge activates no BACKLOG task and adopts no PROPOSED proposal.
