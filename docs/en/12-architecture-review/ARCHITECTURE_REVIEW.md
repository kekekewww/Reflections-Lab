<!-- english-source: {"path":"docs/12-architecture-review/ARCHITECTURE_REVIEW.md","sha256":"57b654be0567ffd4d9663b9b1fefa271a893ffe9d7ec71e1b9fc66b6e700e178","translated_at":"2026-10-29T14:22:37.350Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/ARCHITECTURE_REVIEW.md`](../../12-architecture-review/ARCHITECTURE_REVIEW.md). Source SHA-256: `57b654be0567ffd4d9663b9b1fefa271a893ffe9d7ec71e1b9fc66b6e700e178`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab-全面架構研究與整合審查"></a>
# Reflection Lab Comprehensive Architecture Research and Integration Review

<!-- english-original-anchor --> <a id="整合狀態更新"></a>
## Integration status update

The research and minimal fixes have been safely merged. The original workspace's full quality check and current functional browser suites passed; [integration-state.json](../../12-architecture-review/integration-state.json) records the authoritative commit and public-release gates. This round also preserves [R18 human feedback](../../11-v1/USER_TEST_FEEDBACK_20261029-r18.json) added in the original workspace: failed first-person operation and blocked downstream FPS operations, untested materials / reflections, low volume, and unintuitive direct manipulation. The tested bundle and device were not captured. This is user-reported feedback with no independent reproduction or repair; this round's automated tests do not overwrite it. P0 must first diagnose the input blocker, then continue the recording hot path and performance work. Other research retains its own source, approximation, and unimplemented-status labels.

The existing CI's legacy UI entry point was run at an isolated address, retaining 1 PASS / 1 FAIL / 11 NOT RUN. The failure was an outdated visibility assertion for collapsed details. CI now uses the existing maintained UI / linked suites, preserving the original tests and their assertions. The linked suite's CI browser selection matches the installed Chromium. This CI correction has not changed product source, acceptance, or acoustic models.

Date: 2026-10-29. Baseline c210ca882ca8503b322c28884bf1e9f6e9fe126d; original branch codex/sound-behavior-research; research branch research/architecture-review-20261029. See the [receipt](../../12-architecture-review/baseline.json) for the actual workspace / baseline and the [Integration Report](INTEGRATION_REPORT.md) for final Git / validation / publication gates. This document is the single research entry point; it does not create a second product specification or task system.

<!-- english-original-anchor --> <a id="結論與原架構比較"></a>
## Conclusions and Comparison with the Original Architecture

Retain React / TypeScript / R3F, Rapier, the Custom Web Acoustic Core, Web Audio, and the server Meta adapter. Existing Scene / revision / undo, Sound Behavior, recording/replay / source phase, A/B, and asset-rights refs provide a reusable foundation. No research evidence requires a wholesale rewrite.

This round corrects two kinds of gaps: canonical documentation lagged behind code, and the solver's maximum propagation budget accepted 10 seconds while audio supported a maximum of 5 seconds. Add a shared hard limit of 5 seconds, retaining the 2-second default and rejecting out-of-range settings early without changing the Scene schema. Also add types-only portable RenderJob / RenderBackend without starting or fabricating an unimplemented offline/stems/cloud backend. See [ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md) for evidence and tradeoffs.

| Boundary | Actual original baseline | This round's result / remaining validation |
| --- | --- | --- |
| Scene / runtime | Authoring documents already separate from Rapier / AudioNode, with atomic commands / undo | Retain original formats, no migration |
| Physics / render | Fixed steps advance through a RAF accumulator; Rapier on the main thread | Not moved to a worker; 60 Hz does not establish main-thread independence or a real-time guarantee |
| Acoustics | Ordinary live lane uses a Worker; record onTick has a separate synchronous solve | Correct documentation and retain the recording lane as a performance priority |
| Audio | Native-node graph, delay applied once, and paths exist; custom Worklet is unimplemented | Shared 5-second limit; complete delivery / dropout / listening tests unverified |
| Recorder | Snapshots + integer ticks + raw/behavior/audio events + phase + hashes | Retain RecordingArtifact; native playhead estimates are not hardware PCM |
| Render / export | JSON / WAV helper / offline DSP tests; no complete take renderer | New portable types-only seam; mix/stems/drywet/ADM remain PLANNED |
| Cloud | Loopback Meta service and client runtime, not deployed | Client-first decision; auth / tenant / durable quotas / optional queue await implementation |
| AI / UI | Tools have schema / preview / apply; UI shares the domain, with capability gaps remaining | Retain manual workflows; tool aliases or static code review do not establish completion |
| Publication | Original history contains build/cache/archive artifacts and three blobs larger than 100 MiB | Independent safety gate; deleting only HEAD does not clean history; no unauthorized rewriting |

See the [Gap Analysis](ARCHITECTURE_GAP_ANALYSIS.md) for complete capabilities, code paths, dependencies, and test-coverage scope. Statement/branch coverage was not collected; no percentage is invented.

<!-- english-original-anchor --> <a id="研究交付與來源"></a>
## Research Deliverables and Sources

| Required domain | Deliverable and primary source types |
| --- | --- |
| Physics / Move To / Move & Release / Impulse | [PHYSICS_AND_MOTION_RESEARCH](PHYSICS_AND_MOTION_RESEARCH.md): official Rapier body/controller/CCD/joint documentation and existing runtime |
| Sound generation / behavior / voices | [SOUND_BEHAVIOR_RESEARCH](SOUND_BEHAVIOR_RESEARCH.md): FMOD / Wwise / MetaSounds, with producers and evaluators explicitly separated |
| Custom core / timebase / paths / bands | [CUSTOM_ACOUSTIC_CORE_RESEARCH](CUSTOM_ACOUSTIC_CORE_RESEARCH.md): existing primary papers, Web Audio, geometric analytical probes, and bounded models |
| Scene performance recording / replay | [RECORDING_AND_REPLAY_RESEARCH](RECORDING_AND_REPLAY_RESEARCH.md): existing implementation, W3C timing, snapshots, and determinism boundaries |
| Offline mix / stems / memory / tail | [OFFLINE_RENDERING_RESEARCH](OFFLINE_RENDERING_RESEARCH.md): separate the 2021 REC and 1.1 WD from actual engine availability |
| ADM / BW64 / Dolby profile | [ADM_EXPORT_RESEARCH](ADM_EXPORT_RESEARCH.md): ITU BS.2076 / BS.2088, EBU libadm/libbw64; valid profile delivery requires separate validation |
| Browser performance | [BROWSER_PERFORMANCE_RESEARCH](BROWSER_PERFORMANCE_RESEARCH.md): main/worker/worklet, RAF / recording hot paths, SAB/COOP/COEP, IDB/OPFS, and a two-hardware matrix |
| Hybrid cloud | [HYBRID_CLOUD_ARCHITECTURE](HYBRID_CLOUD_ARCHITECTURE.md): official Cloudflare / Vercel / Supabase / Cloud Run/container limits and deployment boundaries |
| 100 / 1,000 / 10,000 scenarios | [CLOUD_COST_MODEL](CLOUD_COST_MODEL.md): nine recalculable workloads / shared free tier / symbolic AI costs and capacity limits |
| Product Muse / rules / models | [MUSE_AGENT_ARCHITECTURE](MUSE_AGENT_ARCHITECTURE.md): Meta Model API / official competition / 13-tool mapping, without new paid APIs |
| UI / interaction | [UI_UX_REVIEW](UI_UX_REVIEW.md): existing Design System / Emil pins and official references from eight products; static review, not visual PASS |
| Validation / integration | [VALIDATION_PLAN](VALIDATION_PLAN.md), [INTEGRATION_REPORT](INTEGRATION_REPORT.md), [PUBLICATION_AUDIT](PUBLICATION_AUDIT.md) |

Each research document retains source URLs, verification dates, applicable conditions, and access limitations. Detailed existing theory remains in research/, without copying papers or creating contradictory architectures. See the [Evidence Ledger](../../../research/EVIDENCE_LEDGER.json) for central Claim IDs / source indexes, cross-referenced with local claims in each domain document.

<!-- english-original-anchor --> <a id="高風險發現與可行性"></a>
## High-risk Findings and Feasibility

1. **Recording hot path**: Ordinary-worker success does not establish a nonblocking recording main thread. First use immutable tick inputs / a bounded record-evaluation lane in an isolated spike, preserving continuous ticks, source phase / event order, and overload-pause semantics.
2. **Capability differences**: Schemas can express OnBounce / zones while producers are missing; AI preview may propose triggers that currently never occur. A shared capability projection and negative fixtures deserve priority. Successful preview does not establish emitted sound.
3. **Offline rendering**: The new incremental direction in Web Audio 1.1 still requires feature tests. Rebuilding graphs in chunks loses filter / delay / reverb state. First build a short-take local mix, truly isolated stems, and a sample-alignment oracle before long-duration / cloud work.
4. **Deployment**: Existing Host/Origin / in-memory cost reserves are not session auth / multi-instance durable quotas. The loopback server cannot be deployed directly as a public service.
5. **Science**: Preserve limitations from geometric approximation, Synthetic materials / late reverb, quasi-static updates, and unpinnable native HRTF profiles. An analytical ISM probe is not real-room validation.
6. **Public history**: Audit all reachable blobs and compressed archives; large artifacts and embedded bundles remain public content even without a separate .wasm extension.

<!-- english-original-anchor --> <a id="變更分級與開發順序"></a>
## Change Categories and Development Order

Category A: research, sources, canonical tense corrections, ADRs, roadmap / Wiki / handoff, and cost / safety tools. Category B: the narrow 5-second contract fix with a new boundary regression and types-only RenderBackend. No dependency upgrades, product-module deletion, or Category C changes.

The [P0/P1/P2 Roadmap](../ROADMAP.md) prioritizes existing capabilities, the official deadline of 2026-11-05 10:00 Taipei, and integration risks. P0 preserves a reproducible demo and existing unresolved performance / human / external gates. P1 implements Motion, recording lane / local mix/stems, and product-tool capabilities one by one. Higher-order acoustics / ADM / long cloud renders are P2. Research completion does not make every feature mandatory for this competition.

The [Next Engineering Task](../NEXT_ENGINEERING_TASK.md) retains original acceptance and provides concrete file boundaries and stop conditions. Independent worktree, file ownership, and baseline / research / merge / remote states enter the existing Wiki. [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) is only a reference for the original pattern and does not replace this project's schema / provenance / Git evidence.
