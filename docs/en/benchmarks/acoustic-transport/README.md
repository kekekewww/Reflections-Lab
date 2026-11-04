<!-- english-source: {"path":"benchmarks/acoustic-transport/README.md","sha256":"d309627d146279ac2d99ac06d260b61f6fc3deff6fbab21472346b2984d6807f","translated_at":"2026-11-03T02:22:58.376Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`benchmarks/acoustic-transport/README.md`](../../../../benchmarks/acoustic-transport/README.md). Source SHA-256: `d309627d146279ac2d99ac06d260b61f6fc3deff6fbab21472346b2984d6807f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="acoustic-component-benchmark"></a>
# Acoustic component benchmark

This is the Node component comparison tool for `PERF-V1-004/005`; product cache/packet still require explicit opt-in. Tool existence, passing unit tests, or smaller packet JSON do not prove product adoption.

`fixture.ts` reads the bounded scene-construction region of the original formal UI fixture, preserving 105 objects (100 dynamic/5 fixed), materials, roles, and original budget `maxPaths=8 / maxSurfaces=256 / maxSegmentTests=10000`. Curved surfaces and emitter self-exclusion are retained; the initial speaker has 24 faces + 67 analytic primitives + 33 OBBs, with dynamic emitters usually excluding themselves. Builder 16-source and service 32-source/256-path limits are unchanged; original refusals remain row by row.

After Root freezes sources, `capture.ts` can load Root's actual `LabRuntime` to generate a bounded fixed-step prefix of real physics/behavior. The 10-second warmup + 12-second prefix preserve original control formulas, busy gate, action sequence, and formal 600's first 10-second recording window; during capture, the instance's automatic live-preview scheduling is paused, and original requests are obtained manually outside timing. Serialized dispatch, audio disabled, and fixed virtual stepping differ from original parallel RAF scheduling; this is neither a formal 600 trace nor simulated-time performance results. A successfully recorded sealed artifact, at least 1000 ms control window, accepted Grab/Throw, nonempty physics/audio events, and complete request oracle are all prerequisites to publishing a corpus. Failure retains the exact partial and publishes no comparable result.

Browser-safe `corpus.ts` can also use a sidecar in the original browser fixture to compare each original request result and unchanged emission events. No browser capture was run in this worktree, and Root runtime/formal fixture were unchanged.

Comparison fixes four configurations: A uncached+clone, B cached+clone, C uncached+packet, D cached+packet. Every fresh Node invocation reads the same exact corpus; full uncached requests/solutions are generated and frozen before all target timing. Each row validates every identity, path order, vertex, band gain, delay, diagnostic, signed zero, and original refusal, without new tolerances. Each configuration has a fresh worker/cache, four unchanged-original-load warmup rows, and one frozen replay; every worker waits for native exit, rejecting comparison on failure. Packet-selection cost, guards, and encoder cost remain within service cost.

CLI adds 12 `invalidation.*` boundaries: cold clear, same-pose reuse, same-revision pose/orientation, material binding/content, role, revision, topology, dimensions, namespace, epoch clear, and restore. They retain all bodies/caps but are explicitly synthetic, not evidence of original motion-trace speed.

The capture CLI has not run yet. All 32 dedicated unit tests across five files passed; owned lint/typecheck also passed after narrow type fixes and formatting. See `docs/16-nonadvanced-completion/lanes/acoustic/COMPONENT_QUALITY_20261103.md` for separate source stages and limits. Historical source checkpoints and raw tests are preserved.

Below are source-validation commands and capture/run examples to execute only after Root's latest source freeze; the last two have not run:

```powershell
node --import tsx --test --test-concurrency=1 tests/app/acoustic-component-benchmark.test.ts tests/app/acoustic-component-driver.test.ts tests/app/acoustic-component-scenarios.test.ts tests/app/acoustic-corpus-codec.test.ts tests/app/acoustic-node-worker.test.ts
node node_modules/typescript/bin/tsc --project benchmarks/acoustic-transport/tsconfig.json --noEmit
node --import tsx benchmarks/acoustic-transport/run.ts capture --runtime-root 'D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/integration' --out .cache/nonadvanced-acoustic/component/capture-01
node --import tsx benchmarks/acoustic-transport/run.ts run --corpus ABSOLUTE_CORPUS_FILE --run-id r1 --order ABCD --out .cache/nonadvanced-acoustic/component/r1
```

When actually running capture in PowerShell, enclose the entire runtime-root containing spaces in single quotes. Output requires a fresh directory; the tool does not overwrite historical failures. Subsequently use at least five fresh Node processes in fixed order `ABCD / BCDA / CDAB / DABC / ADCB`, serially, against the same pinned corpus, preserving all raw data and actual order. First verify each configuration's warmup/accepted/rejected/source counts/actual transport/full oracles/physical exits; then compare builder/service/encode/Node post/worker compute/delivery/checksum/component-age distributions for identical rows and callScope. List every run, median, and p95; faster rejected returns are not benefits, and `invalidation.*` is shown separately. Separate original default-live and explicit-event-batch groups; the latter measures only DTOs through AcousticService, not Root RecordingEvaluationClient's capture pipeline. Mark ordinary shared-machine use explicitly, without claiming hardware isolation.

`requestBodyJSONBytes` is the UTF-8 JSON body of requests-array/packet (excluding `{batchId, requests|packet}` envelope), not native wire bytes. The independent untimed copy probe counts only actual main-thread `structuredClone` calls and input-graph containers/numeric values/JSON-representation bytes; it excludes V8/worker-internal copies and is not VM allocated bytes. Node post bracket is not browser dispatch; checksum consumer is not AudioEngine/UI consumer; live pose age, native onset, VM allocation, and formal 600 results remain null. Whether measurements support Root opt-in still requires independent judgment; default does not switch automatically.
