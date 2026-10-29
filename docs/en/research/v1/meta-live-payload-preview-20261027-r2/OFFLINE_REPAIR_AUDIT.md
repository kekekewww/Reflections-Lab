<!-- english-source: {"path":"research/v1/meta-live-payload-preview-20261027-r2/OFFLINE_REPAIR_AUDIT.md","sha256":"0f5d62efacea495bdd462bd215b9ac7d67121d619f3e49afd19bf1268c02419d","translated_at":"2026-10-27T03:43:35.566572Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/v1/meta-live-payload-preview-20261027-r2/OFFLINE_REPAIR_AUDIT.md`](../../../../../research/v1/meta-live-payload-preview-20261027-r2/OFFLINE_REPAIR_AUDIT.md). Source SHA-256: `0f5d62efacea495bdd462bd215b9ac7d67121d619f3e49afd19bf1268c02419d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-live-第二版離線修復審查"></a>
# Meta Live second-version offline repair audit

Audit date: 2026-10-27. This document and the payload preview do not call a model or read a key.

The first actual Sound request returned HTTP 400. Original records are in `../meta-live-validation-20261027/`, and the ledger retains US$0.25 for attempt `meta-live-057a820a-ee0b-49d7-9692-d8afe385f56d`. Because the old wrapper parsed only successful bodies, the rejection reason was not retained; response ID, model ID, usage, and actual billing remain null, so neither zero cost nor exhausted quota can be inferred. The original attempt is preserved, and only an explicit HTTP 400 reconciliation is appended under the existing US$1 repair authorization.

Repaired: retain only redacted error code/type/param/message with length limits; redact the complete key and any credential containing LLM_; save the transport receipt before checking the ledger; do not save raw bodies or headers. Proposals are not retried automatically, and a new 400 still independently blocks subsequent dispatch. A ledger reserve rejection returns BUDGET_EXCEEDED, while a known 4xx returns PROVIDER_REQUEST_FAILED.

Offline comparison against the official documentation current at the time:

- [Structured output](https://dev.meta.ai/docs/structured-output): root object, nested anyOf, additional fields disallowed, all properties required, no oneOf/allOf, maximum depth 10. The Sound schema complies with the published rules and has depth exactly 10; Scene tool depths are 1?4. The official documentation does not list minItems/maxItems or const/enum without an explicit type as prohibited. These items are not confirmed root causes of the 400, so restrictions are not speculatively removed and the original schema is not relaxed.
- [Tool calling](https://dev.meta.ai/docs/tool-calling): the current Chat Completions function wrapper, auto, and parallel_tool_calls:false are all supported by documentation.
- [Chat Completions protocol](https://dev.meta.ai/docs/protocols/chat-completions): developer role and max_completion_tokens have an official contract. The current transport and parameters are retained, without switching accounts, models, or endpoints.
- [Error format](https://dev.meta.ai/docs/error-handling): a validation rejection's code may be null, so the sanitized type, param, and message are also retained.
- [Pricing](https://dev.meta.ai/docs/pricing-rate-limits): muse-spark-1.3 Standard input US$1.25/M tokens, output US$4.25/M tokens. Estimates do not discount cached input; actual billing and remaining credit are still unknown.

The next attempt first sends only the smaller Scene body that was already reviewed. After success, the real product Host performs Apply; the subsequent Sound preview precisely reflects scene revision 1 after adding the sphere. Any failure stops that execution. The existing ledger has only two paid slots left; if Scene/Sound both succeed, RunSimulation is executed by the explicitly authorized local Host at 60 Hz for 3 seconds, without another model request. All three bodies provide exact bytes/SHA; the third is only for fake-data tests that still have a slot, and the actual ledger for this attempt will not dispatch the Run body.

The three bodies contain only fixed in-program synthetic scene, behavior, material label, oscillator, and fixed prompt content, without user projects, files, audio files, or credentials. The existing original 12 Scene enum values, 5 Sound operations, and local strict/domain/pin/revision validation remain in place. Only the ignored credential file is read by the server loader, and it is used only as the Authorization header for the fixed official domain; its value and hash are never output or passed into a prompt.
