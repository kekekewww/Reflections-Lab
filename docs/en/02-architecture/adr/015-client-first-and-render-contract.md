<!-- english-source: {"path":"docs/02-architecture/adr/015-client-first-and-render-contract.md","sha256":"53c8d8e329513fc3cb0facc75aa6ce8b835a7b1a50279a2c3cede7d13b91f494","translated_at":"2026-10-29T05:28:32Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/015-client-first-and-render-contract.md`](../../../02-architecture/adr/015-client-first-and-render-contract.md). Source SHA-256: `53c8d8e329513fc3cb0facc75aa6ce8b835a7b1a50279a2c3cede7d13b91f494`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-015client-first-執行邊界與可替換-render-工作契約"></a>
# ADR-015: Client-first Execution Boundaries and a Replaceable Render Job Contract

- Status: Accepted for architecture refinement, 2026-10-29. Initially present on the research branch; it becomes an effective decision on the original branch only after a safe merge. This is not a cloud deployment or completion of a full renderer.
- Requirement: [this user request](../../00-project/ARCHITECTURE_REVIEW_REQUEST.md); continues ADR-009 / 010 / 011 / 014 without replacing their Scene, clock, scientific, or development policies.
- Evidence: [current inventory](../../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md), [browser](../../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md), [cloud](../../12-architecture-review/HYBRID_CLOUD_ARCHITECTURE.md), and [offline render](../../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md).

<!-- english-original-anchor --> <a id="決策"></a>
## Decision

1. Run 3D, Rapier, custom acoustics, sound generation, recording/replay, and short offline renders on the client first, while keeping the existing main approach operational. The cloud handles static distribution, identity / project metadata, assets, and a controlled model proxy; cloud rendering remains a later replaceable option.
2. Do not infer that the whole system is nonblocking merely because a Worker exists. Current physics and recording acoustic evaluation still run on the main thread, with RAF advancing the accumulator. Preserve explicit clock, snapshot, and backpressure contracts first, then use profiling to decide whether to migrate physics / recording lanes. No wholesale migration in this round.
3. Add types-only RenderJob / RenderBackend / RenderResult in src/audio/render-contract.ts. Jobs reference existing RecordingArtifact, settings, and asset hashes, and explicitly specify integer tick/sample mapping, pre-roll/tail, listener/HRTF, emission selection and taps, and memory/output budgets. Do not create a duplicate version of the existing AudioEngine.
4. Stem selection selects only emissions that already exist in the original recording. It does not remove other physics objects or recompute voice admission or the collision world. Per-object outputs share one timebase. Do not assume that stems add up to the full mix when bus limiters or other nonlinear processing are involved. Listener/HRTF changes require reevaluation of affected spatial/acoustic results.
5. Backends must report actual capabilities, versions, limits, and finite-sample diagnostics; they must not copy requests into a success result. Reject unsupported capabilities. Native browser HRTF has no pinnable coefficients hash and must honestly be labeled unspecified.
6. Solver and audio propagation budgets share an explicit hard limit of 5 seconds. Solver validation returns INVALID_BUDGET above it. This corrects the previous cross-layer mismatch where the solver accepted 10 seconds while audio rejected more than 5 seconds; it changes neither the 2-second default nor the Scene schema.
7. The current loopback Host / Origin gate is not cloud user authentication. Before deployment, separately implement tenant isolation, request idempotency, durable per-user/global quotas and in-flight leases, asset ACL / size / rights checks, and timeouts. No deployment or new paid requests in this round.

<!-- english-original-anchor --> <a id="選項代價與驗證"></a>
## Alternatives, Costs, and Validation

Running all real-time physics/audio on the server would tie cost to each interactive user and require low-latency streaming. No current requirement or measurement supports that approach. Moving all systems into Workers immediately would expand lifecycle, input, and time-synchronization risks. Retaining the client main approach and first adding an explicit interface is a smaller, reversible change, but it does not resolve the current main-thread budget overrun.

Types do not replace runtime validators, serializers, or a real backend. Future renderer work must add negative job validation, NaN / clipping / tail / alignment / stem-isolation checks, cancellation / retry, and hash verification. The narrow 5-second fix uses independent RED/GREEN boundary tests and existing regression tests; complete performance targets remain unchanged.

Category A/B; no dependency update, no Scene / Project / Recording migration, and no Category C refactor. See the [Publication Audit](../../12-architecture-review/PUBLICATION_AUDIT.md) for risks from large / prohibited artifacts in public history. This ADR does not automatically authorize deletion or history rewriting.
