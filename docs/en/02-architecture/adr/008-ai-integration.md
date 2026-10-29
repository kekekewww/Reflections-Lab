<!-- english-source: {"path":"docs/02-architecture/adr/008-ai-integration.md","sha256":"337c5fbe104ac8b90cf1ef28142be98a30ac17f3f8cf12f3554b8a52a3a9b132","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/008-ai-integration.md`](../../../02-architecture/adr/008-ai-integration.md). Source SHA-256: `337c5fbe104ac8b90cf1ef28142be98a30ac17f3f8cf12f3554b8a52a3a9b132`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-008meta-ai-integration"></a>
# ADR-008: Meta AI Integration

- Status: Design accepted; account/live API unverified.
- Context: AI can orchestrate scenes and experiments, but is not an authoritative numerical source; model documentation support does not imply account access.
- Decision: A server-side provider adapter; every tool call passes JSON schema and registry/units/budget domain checks, displays a preview, and is applied atomically by a trusted host with undo support. Model names come from approved provider config, without inventing available versions in hard-coded values.
- Alternatives: Client secrets (rejected); arbitrary model-generated code/eval (rejected); explicit fixture replay as the fallback, which must not pose as a Meta live Demo or evidence of competition compliance.
- Evidence: [META_MODEL_RESEARCH.md](../../08-ai/META_MODEL_RESEARCH.md), [AI_SCENE_CONTROL.md](../../08-ai/AI_SCENE_CONTROL.md).
- Trade-offs: Additional host control and strict-schema flattening conversions; differences between web/provider schema capabilities require testing.
- Risks: Prompt injection, parallel mutations, stale revisions, costs, and hallucinated data; numerical tools return only computed artifact IDs and sources.
- Reversibility: Domain tools are decoupled from the provider; replacing the model still requires the same approval and performance validation.
