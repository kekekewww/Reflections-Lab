<!-- english-source: {"path":"docs/13-performance-review/REVIEW_CONTRACT.md","sha256":"c8eaa8f711267118e957db42e1be58ac094477a2ab603bcd68d99d4c2d1806a9","translated_at":"2026-11-01T08:32:24.264Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/REVIEW_CONTRACT.md`](../../13-performance-review/REVIEW_CONTRACT.md). Source SHA-256: `c8eaa8f711267118e957db42e1be58ac094477a2ab603bcd68d99d4c2d1806a9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="效能與緩衝架構審查契約"></a>
# Performance and buffering review contract

Date: 2026-11-01 (Asia/Taipei). Status: authorized research-delivery contract. Executor: Codex; no verifiable model ID was supplied. Baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`. Research task: [RLAB-TASK-PERF-20261101-REVIEW](../../../knowledge/tasks/RLAB-TASK-PERF-20261101-REVIEW.json).

<!-- english-original-anchor --> <a id="使用者確認的決策"></a>
## User-confirmed decisions

1. This is an Independent Research & Architecture Review. Produce research, plans, non-binding proposals and persistent knowledge; implement no performance optimization.
2. The baseline and documentation integration target are the latest Claude development line, `claude/meta-hack-r18-handoff-d292c8`. Preserve the original `codex/sound-behavior-research` workspace.
3. Run the existing 600-second workload. If the installed Chrome hash fails the original runner's pinned qualification, retain that formal rejection and use an isolated temporary research copy with current Chrome. Its results acquire no formal qualification.
4. Uncommitted R21 work is supplemental observation with timestamps, HEAD and hashes. Do not import it or attach earlier measurements to the final repair. Recompare the latest target at closure.
5. If the target is dirty, do not stash, overwrite or merge there. Retain the reviewed branch and a local documentation patch. No push or deployment is authorized.

<!-- english-original-anchor --> <a id="授權與保護邊界"></a>
## Authorized and protected boundaries

Allowed additions are research documents here, `proposals/`, compact `evidence/`, appended reviewed sources/claims in the existing Evidence Ledger, existing Wiki sources/pages/events/tasks/handoff and complete English mirrors. Agents own separate documents; one coordinator owns Wiki and integration.

Do not change `src/`, `server/`, current `schemas/`, official `tests/` or `benchmarks/`, packages/lockfiles, runtime/build/deployment/CI settings, AGENTS, formal acceptance/thresholds or existing results. Keep research prototypes, traces, bundles and large data in ignored isolated temporary storage; commit no research program. Validate new task files against the existing schema and create them exclusively; use the existing CLI for subsequent state/events/indexes. Overwrite no existing task.

<!-- english-original-anchor --> <a id="可核對的研究範圍"></a>
## Checkable research scope

| Work | Required delivery |
|---|---|
| A–B Current state and evidence | Per-module thread/clock/rate/buffer/backpressure/overload/copy/GC/order/telemetry matrix; cross-thread map; versioned R17–R21 evidence |
| C Industry | Official REAPER, Ableton, FMOD, Wwise, JUCE and Chrome/Web Audio comparison; desktop hardware-buffer controls are not browser controls |
| D Buffers | Separate PCM, acoustic snapshots, physics events, audio scheduling, assets, DSP/convolution, record/export and transfer/SAB reviews |
| E Clocks | Wall, render frame, physics tick, acoustic snapshot tick, AudioContext, recording and offline sample timelines; the last describes a future contract only |
| F Continuity | Falsifiable diagnostic matrix for callbacks/underruns, late events, node lifetimes, gain/delay/panner/filter/IR/path/tail/stealing, GC/long tasks/reply jitter |
| G Resources | CPU tail costs, steady/peak memory, GPU/React/view, energy proxies and client-first cloud scaling |
| H Measurement | Original-runner receipt, research 600 seconds, future ten-scenario/metric plan; unavailable measurements explicitly NOT MEASURED |
| I–J Planning | P0–P3, complete BACKLOG tasks, seven PROPOSED ADRs, Wiki and English counterparts |
| K–M Validation and integration | Independent review, source/document checks, zero protected diff, latest-target comparison, integration report, patch or safe merge and handoff |

<!-- english-original-anchor --> <a id="證據與完成語意"></a>
## Evidence and completion semantics

Classify important claims as CONFIRMED BY CODE, CONFIRMED BY TEST, CONFIRMED BY BROWSER PROFILE, USER REPORTED, HYPOTHESIS or NOT MEASURED, with version, date, environment, conditions and clickable sources. Label official-document review separately; it is not product measurement.

Record physics dropped wall time, snapshot rejection, audio late events, voice/path budget rejection and actual output underruns separately. A native graph is not a custom AudioWorklet; output statistics are not DSP callback timing or device listening evidence. Retain prior failures and unknowns.

Research completion means this contract and the research task criteria are met. All future optimizations remain BACKLOG, Proposed ADRs remain PROPOSED, and full V1/formal product acceptance retain their own states.

See [preflight](../../13-performance-review/evidence/preflight.json) for the baseline and original workspace, and the [final report](FINAL_REVIEW_REPORT.md) for results and limitations.
