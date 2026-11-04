<!-- english-source: {"path":"docs/13-performance-review/FINAL_REVIEW_REPORT.md","sha256":"23109a98dd6a6924e9d27349a271f24049741ee360dc3737cd42e48e21ea47fd","translated_at":"2026-11-01T08:47:39.899Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/FINAL_REVIEW_REPORT.md`](../../13-performance-review/FINAL_REVIEW_REPORT.md). Source SHA-256: `23109a98dd6a6924e9d27349a271f24049741ee360dc3737cd42e48e21ea47fd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="最終效能與緩衝架構審查報告"></a>
# Final Performance and Buffering Architecture Review

Date: 2026-11-01 (Asia/Taipei). Status: **research delivery complete; documentation-only patch, dirty target not merged**. Executor: Codex; no verifiable model ID was supplied. Committed product baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`; research branch: `review/performance-buffer-20261101`. Results apply only to their stated versions/environments. Full V1 remains incomplete.

<!-- english-original-anchor --> <a id="1-結論與交付"></a>
## 1. Conclusion and delivery

This round delivers independent research and engineering plans for later adoption, with no product optimization implemented. Main-thread per-tick recording solves, live Worker/control-consumer boundaries, native graph lifetimes and multi-clock semantics now have traceable inventories. The user's particular stutter cause remains undiagnosed. Keep source emission, scheduling offset and propagation delay separate. Existing single-inflight admission, FIR caching, stable routes, dual banks and asset store are documented as existing safeguards.

The [summary](EXECUTIVE_SUMMARY.md) connects all 14 requested domain/synthesis documents. Additional delivery includes the [review contract](REVIEW_CONTRACT.md), [measurement plan](MEASUREMENT_PLAN.md), seven `proposals/ADR-PERF-01..07` and complete English counterparts. See the [risk register](RISK_REGISTER.md) and [roadmap](OPTIMIZATION_ROADMAP.md) for 18 risks and 14 P0–P3 future tasks. Every future task is BACKLOG, owner=null, with 42 criteria=false. Seven ADRs remain PROPOSED; Accepted ADRs and formal MVP scope are unchanged.

<!-- english-original-anchor --> <a id="2-本輪實際量測"></a>
## 2. Actual measurements

Local host: Windows 10.0.26200, i9-13980HX / 32 logical CPUs, reported RAM approximately 31.63 GiB, Chrome 156.0.8078.75, Node 22.17.0 / npm 11.4.2. The GPU inventory lists an RTX 4070 Laptop and other devices; that inventory is not device listening evidence. Raw powercfg output has encoding limitations. Original fixture configuration: 1920×1080/DPR1, UI 100 Dynamic / 105 objects, physics 256 bodies / 64 CCD; muted native graph, actual rate 48000 Hz. This local instrumented workload cannot represent the reported Brave/light scene. [Window/tail supplement](../../13-performance-review/evidence/window-tail-supplement.json).

The [measurement receipt](../../13-performance-review/evidence/measurement-summary.json) is authoritative for commands, environment, hashes, raw locations and all judgments. Acquired raw data, the short-run trace, bundles and research prototype remain under ignored `.cache/performance-review/measurement/` in the isolated Worktree and are not committed. The original runner and research copy have different qualification paths.

The registered receipt is v2 (SHA-256: ee538ee2af989b9e2e8eb86af80b3c6068ff61e56a6a3aee51c5ed2e2e7e25dc); retain [original v1](../../13-performance-review/evidence/measurement-summary-v1.json). V2 only removes redundant no-trace derived labels incorrectly applied to smoke. It changes no original smoke trace, long-run failure, metric or raw artifact.

| Step/claim | Actual result and boundary |
|---|---|
| Pinned original runner | Unchanged `run-performance-v3.mjs --formal-600` rejects current Chrome's different hash with exit1 and `V3_UNSUPPORTED_NATIVE_LAUNCHER_SHA256`. No formal workload measurement or qualification upgrade occurs |
| Research adapter | Eight bounded changes: five import locations, launcher hash, native producer revision and explicit research metadata. Fixtures/load/thresholds/membership/caps/timeouts/cleanup are unchanged; outer classification always RESEARCH_ONLY/NOT_APPROVED |
| all 20-second smoke | Exit0; collection/native wiring is interpretable, while performance and sustained-load conditions fail. It is neither formal 600 qualification nor a retest of final R21 bytes |
| PERF-MEASURE-600-001 | Exactly one same-load long study: UI raw window 600415.2 ms; process wall 1026636.133 ms, exit1, original 180-second `CDP_TRACE_FLUSH_TIMEOUT`. No rerun or timeout extension |
| PERF-MEASURE-600-002 | 3000 physics native steps, p95 ≈ 8.2 ms; original 2 ms numeric target FAIL. This is not the user's light scene or device measurement |
| PERF-MEASURE-600-003 | productDefault: 600 worker samples: p95 ≈ 40.9 ms; receive-through-native-consumers approximately 13.8 ms. Original 20/1 ms targets FAIL; 20 Hz sustained windows are invalid |
| PERF-MEASURE-600-004 | stress256: 600 worker samples: p95 ≈ 15.1 ms remains UNVERIFIED because requested-path/no-native-loss workload is invalid. Delivery approximately 23.5 ms FAIL. Being below a compute threshold does not upgrade overall qualification |
| PERF-MEASURE-600-005 |Raw records 8294 frames, 2161 overruns, 1120 paused advances and 19705 fixed ticks, approximately 328.4167 simulation seconds and 242.6667 seconds of interactive dropped wall time. Three captures contain 8/4/4 frames and pause from debt. A 600-second wall window is not 600 seconds of continuous simulation or recording |
| Native trace/main occupancy |No completed trace or native analysis. CLOSED_WINDOW_UNVERIFIED; main-thread wall occupancy and complete native 600 qualification remain UNVERIFIED. Do not substitute short-run figures |

The browser/preview were cleaned up, cleanup errors=0, with no outer timeout/output cap. Closed-window pending=false and outside-window tail are retained separately; tail does not repair capture. Audio lateEvents/drop counters are cumulative engine snapshots, not automatically 600-second deltas. This run collects no actual output underruns, Worklet callback deadlines, hardware latency, complete PCM click integrity or human hearing evidence.

Flush failure skips the runner's normal final source/bundle/executable stability fields. They remain absent, never rewritten true. Independent post-run review separately compares 237 build inputs, 13 working bundle files and 13 archived bundle files against their manifests; all match, as do raw UI/tail hashes. This is a separate POST-RUN endpoint observation, not reconstructed normal checks or a continuous whole-run integrity guarantee.

Code/browser differ from R17, and there is only one long study with an incomplete trace. Claim neither causal improvement nor regression. Retain original R17 failures. Separate initial/regression-repair/final-dirty R21 sources; final repair effects still require controlled retesting.

<!-- english-original-anchor --> <a id="3-來源提案與持久知識"></a>
## 3. Sources, proposals and persistent knowledge

The [supplemental claim ledger](../../13-performance-review/evidence/claims.json) pins 39 sources, 15 foundation claims and version/environment/limits. The [source index](../../13-performance-review/evidence/research-index.json) pins research-stage document hashes and citations. Official documentation supports APIs/patterns, not product/device performance. New measurements use PERF-MEASURE-600claims while retaining original metric IDs and judgments.

One recorded provenance adjustment preserves historical integrity: DONE Task0021 pins the global `research/EVIDENCE_LEDGER.json` hash, so keep it unchanged and register a supplemental ledger with existing Wiki source ingest. The supplement supersedes no unrelated Accepted/scientific claim and creates no second task system. Fourteen shared Backlog JSONs use the existing schema, exclusive creation and serialized CLI source/events/index/handoff operations.

Independent review checks principal source boundaries, ownership, pose-aware caches, resume epochs, important English conditions, adapter differences and measurement limits. Corrections clarify that sceneRevision alone cannot key moving geometry, AudioContext re-anchoring differs from take runEpoch, solver non-saturation is not assumed,014freezes a finite activation-time candidate list, and static domain review differs from the coordinator's research measurement. These are research wording corrections.

<!-- english-original-anchor --> <a id="4-驗證與整合"></a>
## 4. Validation and integration

The [validation receipt](../../13-performance-review/evidence/validation.json) records actual commands/exits/scope. The [scope audit](../../13-performance-review/evidence/scope-audit.json) lists tracked/untracked changes, protected diffs and task/proposal states. English documents have complete source hashes/currentness. File/index checks and independent semantic review are separate; tools do not prove every external URL, arbitrary secret format or scientific inference.

The [documentation integration report](INTEGRATION_REPORT.md) records baseline, latest target, reviewed payload SHA, merge base, every added/changed file and patch. Re-read target HEAD and dirty state before integration. Preserve original/R21 edits without stash/reset/overwrite. If dirty, retain the branch and produce a local documentation patch, with no merge/push/deployment.

Public APIs/types/Scene/Recording contracts, runtime/build/dependencies, formal tests/benchmarks, acceptance/performance thresholds, AGENTS and existing product-task criteria/results remain unchanged. This round adds no formal test, Worklet, worker lane, renderer, cache, cloud service or paid Meta request.


Baseline document links require four existing ignored historical JSON receipts. Read-only byte copies were restored from the original workspace into isolated test-results, with recorded hashes (two historical manifest pins checked). These are not new tests or newly passed results and are not committed; a fresh clone may require that historical archive. See the [copy receipt](../../13-performance-review/evidence/historical-link-copy.json).

<!-- english-original-anchor --> <a id="5-限制與下一步"></a>
## 5. Limits and next work

1. Start with001/014source/device/output attribution, then select002recording hot-path and003automation candidates from evidence. Research closure starts none automatically.
2. CDP flush failure has no diagnosed cause. Missing-trace main-thread conclusions, GC/native-DSP cost and output continuity remain gaps. Conduct bounded diagnostic research before scheduling another measurement task.
3. The512MiB memory research envelope, SAB/Worklet/Physics Worker/cloud/incremental-offline options remain proposals with unmeasured benefits and browser/device conditions. Lowering workload cannot hide acoustic-quality or interaction-latency changes.
4. Unmeasured acoustic/human/device, root LICENSE, account/terms and full V1 conditions retain their existing limits. Research, metadata and process exit0 do not establish product completion.

The initial commit did not stop after four CR-at-EOL findings. [Correction provenance](../../13-performance-review/evidence/newline-correction.json) preserves the failure/preimages, LF-only repair, superseding source versions and unchanged Backlog activation state. Default Git whitespace checking subsequently passes; no history, threshold or measured result was rewritten.
