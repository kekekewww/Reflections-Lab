<!-- english-source: {"path":"docs/08-ai/PHASE3_RUNTIME_AGENT.md","sha256":"f025979bd89692690bc9cd826c941717af6f0843073a8d3bd08529bc2440c8a5","translated_at":"2026-10-27T03:39:38Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/08-ai/PHASE3_RUNTIME_AGENT.md`](../../08-ai/PHASE3_RUNTIME_AGENT.md). Source SHA-256: `f025979bd89692690bc9cd826c941717af6f0843073a8d3bd08529bc2440c8a5`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="phase-3產品-meta-agent-與開發代理的界線"></a>
# Phase 3: Boundaries Between the Product Meta Agent and Development Agents

Status: `DESIGN_READY / PRODUCT_IMPLEMENTATION_PENDING`. This phase completed the development Harness, prompts, and the foundation for offline contracts / evaluation; it did not create a production scene executor, product Meta provider, or live Agent Loop. The existing [AI Experiment Agent](AI_EXPERIMENT_AGENT.md), [tool contracts](AI_TOOL_SCHEMAS.md), [scene transactions](AI_SCENE_CONTROL.md), and root-level `schemas/ai-*.schema.json` remain authoritative for the product runtime.

<!-- english-original-anchor --> <a id="三個角色與兩個資源帳"></a>
## Three Roles and Two Resource Accounts

| Role / resource | Usage | Behavior after failure |
| --- | --- | --- |
| Codex Orchestrator | Manage goals / milestones / tasks, freeze acceptance criteria, dispatch work, and recover | Can take over remaining implementation when Muse is unavailable; acceptance is still performed by an independent process. |
| Muse Code development executor | Modify code in a restricted workspace according to the Task Contract | Preserve work and hand it over to Codex when subscription / development quota is exhausted; do not change the product provider. |
| Meta Model API product agent | Call controlled scene / experiment tools and explain real artifacts | Stop the live branch when credit / quota is insufficient; retain provider integration and label offline fixture provenance separately. |
| Development budget | Model steps, wall time, retry / repair counts, spending caps, and usage | Does not replace provider billing information; unknown remaining quota is null, with no increase to caps or switch of accounts. |
| Product runtime budget | Tool / simulation / token / cost caps and provider gate | Does not switch to the Codex API because the coding executor changes to Codex; verify live evidence separately. |

The normal flow is Codex orchestration → Muse implementation → independent tests and Codex verification. Fallback is Codex orchestration → the existing Codex takes over implementation → an independent process using frozen acceptance criteria; add isolated review when available. Neither flow constitutes evidence that the Meta API has been integrated into the product.

<!-- english-original-anchor --> <a id="runtime-契約與提示詞"></a>
## Runtime Contracts and Prompts

The product continues to use the existing 12 tool contracts: CreateScene, AddObject, SetMaterial, SetRigidBodyMode, ConfigureSoundSource, MoveListener, SetTrajectory, RunSimulation, CaptureExperiment, AnalyzeAcousticResults, CompareExperiments, and PreviewSceneChanges. The model receives only each tool's parameters; the host supplies the scene / revision / transaction envelope and does not pass the local union schema directly as the provider strict schema.

The new [scene planner](../prompts/runtime/scene-planner.md), [experiment agent](../prompts/runtime/experiment-agent.md), and [acoustic analysis](../prompts/runtime/acoustic-analysis.md) prompts share the existing host boundaries: no shell, repository, arbitrary URLs, private files, or budget configuration; all changes are staged, validated against schema / domain / policy, and previewed before the host authorizes Apply. A Strict JSON shape cannot prove that IDs, units, material values, or scientific claims are correct.

The development Prompt Renderer is a template tool, not a security sandbox or product provider. It permits only fixed template names and 4 types of JSON input, rejects missing parameters and oversized payloads, and does not perform a second token expansion on task data. Host policy / workspace scope / protected acceptance must still be enforced by the Harness.

Muse CLI, Meta API, and Spark Open / third-party inference differ in model IDs, reasoning, costs, and usage rights; these cannot be copied from one to another. The review for a given run follows [model research](../09-agents/MUSE_MODEL_RESEARCH.md), [routing](../09-agents/MODEL_ROUTING.md), and official sources. Prompts do not hard-code the latest model ID; selection is determined by verified host configuration.

<!-- english-original-anchor --> <a id="runtime-quota耗盡時"></a>
## When Runtime Quota Is Exhausted

1. The provider adapter retains actual error types, request/run IDs, and available usage, and removes secrets; do not misclassify 401 / 403 as credit exhaustion or treat every 429 as definite quota exhaustion.
2. Retry temporary 429 responses only within the established limits; for mutations with an unknown outcome, check the host ledger first so resending cannot cause duplicate scene changes. The product budget remains constrained by the existing provider config.
3. When quota / credit cannot recover within the authorized budget, mark live tests BLOCKED / NOT RUN and preserve completed artifacts. Codex may continue general engineering and offline testing with Mock Model and Recorded Tool Responses.
4. Fixtures and recorded responses retain `offlineFixture` / Synthetic Fixture provenance; do not invent model IDs or live request IDs. Model explanations cannot become Measured records; missing data is null, not 0.
5. If the demo requires a real-time Meta agent, authorization, model, tool responses, and connectivity must be reverified with the real Meta provider before submission. This phase has no such live evidence.

<!-- english-original-anchor --> <a id="驗證面與完成限制"></a>
## Verification Areas and Completion Limits

| Verification area | Reproducible command / basis | Scope that can be claimed in this phase |
| --- | --- | --- |
| Runtime JSON contracts | `npm test`, `npm run validate:schemas` | Existing schema positive / negative cases and provider gate; not production host execution. |
| Prompt Renderer | `node --test prompts/render.test.mjs` | Fixed templates, JSON parameters, path / payload guards, and a single expansion. |
| Coding prompt evaluation foundation | `node --test benchmarks/muse/evaluate.test.mjs`, `node benchmarks/muse/evaluate.mjs` | Offline reference / bad-case validation of 4 fixture categories × 2 strategies; no model calls or comparison of model quality. |
| Meta provider catalog / function calls / strict decode / quota | Requires a real account and explicit budget | `NOT RUN`. Reviewing official documentation is not live integration. |
| Scene executor / Apply / Undo / cancel / grounding | Subsequent product implementation and E2E | `NOT RUN`. This phase retains only the contracts and testing requirements. |
| Acoustics / physics / audio / browser | Each domain's acceptance criteria and V levels | Cannot be inferred from LLM or prompt fixture results. |

The next product AI slice is still OfflineFixtureProvider with one AddObject → Preview → Apply → Undo host transaction and run ledger. Connect the gated Meta provider only after completing domain validation; this phase does not claim that functionality is already complete.
