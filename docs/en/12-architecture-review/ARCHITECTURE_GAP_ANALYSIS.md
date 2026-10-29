<!-- english-source: {"path":"docs/12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md","sha256":"032532ff55f7eda41c94dea6545b6f5a854e10642f786f8274a87f48b202ed00","translated_at":"2026-10-29T05:32:21Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md`](../../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md). Source SHA-256: `032532ff55f7eda41c94dea6545b6f5a854e10642f786f8274a87f48b202ed00`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="architecture-gap-analysis"></a>
# Architecture Gap Analysis

Date: 2026-10-29. Comparison baseline: c210ca882ca8503b322c28884bf1e9f6e9fe126d. Status describes domain capabilities, not a complete V1 pass; [R17](../../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json) and [actual performance](../11-v1/BROWSER_PERFORMANCE.md) remain authoritative.

| Capability | Status | Actual paths / workflows and tests | Gaps / research conclusions |
| --- | --- | --- | --- |
| React / TypeScript / Three / R3F | IMPLEMENTED | src/main.tsx, src/ui/Viewport.tsx, src/ui/viewport; pinned package.json; UI browser | Canonical architecture and src README still say uninstalled / no runtime and need correction |
| Rapier / Scene / FPS / Build | IMPLEMENTED / PARTIAL | src/scene, src/physics, src/interaction, src/app/runtime.ts; tests/scene, physics, interaction-runtime, browser physics | Code and browser components implemented; physical Pointer Lock / IME unverified; no complete third-person character system |
| Motion Authoring | PLANNED | Kinematic motor / SetTrajectory schema; src/ai/scene-adapter.ts returns UNSUPPORTED | Missing Motion Registry, curve-authoring UI, Move To / Move & Release state machines; a bounded target is not a complete timeline |
| Sound Behavior | IMPLEMENTED / PARTIAL | src/audio-behavior, src/app/physics-behavior.ts, behavior-editor.ts; tests/audio-behavior | Evaluator, bridge producer, and author UI have different capabilities; OnBounce / zones lack producers and must not be presented as implemented |
| Custom Acoustic Core | IMPLEMENTED / PARTIAL | src/acoustics, src/app/acoustic-service.ts / acoustic-worker.ts; tests/acoustics-runtime | Direct / limited first-order / snapshot occluders; higher orders, dynamic reflectors, and solid transmission unimplemented; 5/10-second cross-layer limit needs a narrow fix |
| Web Audio / Worklet | IMPLEMENTED / EXPERIMENTAL | src/audio/engine.ts, routes.ts; tests/audio-runtime | Native-node graph is implemented; custom AudioWorklet remains PLANNED, with no product processor registration path found; complete delivery / dropout unverified |
| Recorder / Replay / A-B | IMPLEMENTED / PARTIAL | src/experiments, src/app/recording-host.ts / recording-processor.ts; tests/experiment-runtime | Motion traces, snapshots, events, and source phase exist; synchronous per-tick solver hot path during recording, long-duration memory, and steady-state performance still need measurement |
| Render / WAV / Stems | PLANNED / EXPERIMENTAL | src/audio/wav.ts and OfflineAudioContext numerical tests; new render-contract.ts contains types only | WAV tools / DSP tests are not a complete take renderer; local mix / object stems / drywet / ADM UI unimplemented |
| Meta Model API | IMPLEMENTED / PARTIAL | server/meta-provider.ts, app.ts, src/ai; historical minimal Sound live run of 180 ticks | Loopback host/origin is not cloud session auth; in-memory quota is not durable multiuser billing; no new paid validation |
| Project Persistence | IMPLEMENTED / PARTIAL | src/persistence, assets / IndexedDB; storage browser | Local projects and asset refs exist; cloud tenant/RLS, synchronization / conflicts, and retention unimplemented |
| Deployment / Multiuser | PLANNED | server/cli.ts, vite.config.ts, .github/workflows/validation.yml | No production cloud deployment / auth / queue; client-first design cannot establish multiuser capacity |
| Wiki / Skills / ADR | IMPLEMENTED | knowledge, scripts/wiki, .agents/skills; test:wiki / design | Retain the single system; record worktree / base / merge / publication blocker |
| Tests / Benchmark | IMPLEMENTED / PARTIAL | Package scripts, tests, benchmarks | Existing R17 scoped functionality PASS, performance FAIL / human NOT RUN; save this round's results separately without overwriting old raw data |

<!-- english-original-anchor --> <a id="最小修改與延期"></a>
## Minimal Changes and Deferrals

Category A updates canonical architecture entry points, implementation status, ADRs, roadmap / next tasks, and source indexes. Category B covers the shared propagation limit, portable render job contract, and recalculable cost / publication-check tools. No product modules are deleted, dependencies upgraded, or Scene / Project / Recording schemas changed.

Category C was not performed: physics worker, recording-pipeline refactor, complete motion registry, offline renderer, cloud auth/tenant/rate-limit, and ADM serializer. Each needs frozen fixtures, migration, or capability tests; completion of this research round does not make them mandatory competition work.

The [Architecture Review](ARCHITECTURE_REVIEW.md) connects complete evidence and sources for each domain. This compares current code, historical tests, proposals, and unverified areas; it is not a test-coverage percentage. Existing tests do not collect statement/branch coverage, and this round does not invent a percentage.
