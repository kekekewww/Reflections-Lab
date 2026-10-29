<!-- english-source: {"path":"docs/08-ai/META_MODEL_RESEARCH.md","sha256":"f4b24f202b187897623b356f3d0b38950243167419b1a11d82f451aeb16d5f63","translated_at":"2026-10-27T03:39:38Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/08-ai/META_MODEL_RESEARCH.md`](../../08-ai/META_MODEL_RESEARCH.md). Source SHA-256: `f4b24f202b187897623b356f3d0b38950243167419b1a11d82f451aeb16d5f63`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-模型與-api-查核"></a>
# Meta Model and API Review

Review date: 2026-10-26 (Asia/Taipei). Status: **Public documentation research completed; account access, inference, and end-to-end integration `NOT RUN`**. No credentials were read, no keys were created, no paid APIs were called, and no terms were accepted. The model candidates in this document are not a list of models available to the account.

<!-- english-original-anchor --> <a id="官方文件所確認的能力"></a>
## Capabilities Confirmed by Official Documentation

| Claim ID | Conclusion | Applicable conditions and evidence |
| --- | --- | --- |
| AI-001 | Meta officially provides the Meta Model API; the base URL is `https://api.meta.ai/v1`, using a Bearer `MODEL_API_KEY`. | [Overview](https://dev.meta.ai/docs/overview), public documentation `VERIFIED_DOC`; connection `NOT RUN`. |
| AI-002 | The documentation currently lists `muse-spark-1.3`, `1.2`, `1.1`, and `muse-wonder-1.0`; Wonder is in preview. | [Overview](https://dev.meta.ai/docs/overview), [Models](https://dev.meta.ai/docs/models). Do not describe an older version as the fixed latest version. |
| AI-003 | Spark and Wonder accept text, images, video, audio, and PDF, and output text; the documentation lists a 1,048,576-token context. Wonder Full is available only through specified Muse Code subscriptions and is not available through the Model API. | [Models](https://dev.meta.ai/docs/models). The documentation also lists Wonder as unavailable in South Korea; this does not imply that a Taiwan account is necessarily eligible. |
| AI-004 | New agent work can evaluate the Responses API; Chat Completions does not retain reasoning across turns, while Responses offers encrypted replay or server state. | [Choosing an API](https://dev.meta.ai/docs/protocols). This project prioritizes managing its own concise history to avoid depending on server state by default. |
| AI-005 | Function tools are executed by the application; parallel calls and streaming arguments are supported, but `tool_choice` currently accepts only `auto`. `max_tool_calls` does not limit the total loop of developer function tools. | [Tool calling](https://dev.meta.ai/docs/tool-calling). The executor counts calls itself; execution must not begin before streaming has completed. |
| AI-006 | Structured output is available; strict mode requires a regular object root, all objects must forbid additional fields, and all properties must be required; `oneOf` / `allOf` are unsupported, and `anyOf` cannot be at the root. | [Structured output](https://dev.meta.ai/docs/structured-output). There is also a depth limit of 10, a total of 5,000 properties, and no circular `$ref`; these must be confirmed again through actual API contract tests. |
| AI-007 | Image understanding can provide semantic clues; video and audio understanding output text. | [Image understanding](https://dev.meta.ai/docs/image-understanding), [Video and audio understanding](https://dev.meta.ai/docs/video-understanding). These are not tools for acoustic calibration, RIR, or material measurement. |

The claims are sourced from official documentation on the review date, not independent capability evaluations. Model latency, scene accuracy, Taiwan account availability, and hackathon credits remain untested. Private preview descriptions in older announcements cannot replace the current Models documentation or account catalog.

<!-- english-original-anchor --> <a id="成本配額與資料"></a>
## Cost, Quotas, and Data

The following public prices were listed on the review date, in USD per million tokens; they are not account-specific quotes or permanent prices.

| Candidate | Uncached input | Cached input | Output | Public team limits RPM / TPM |
| --- | ---: | ---: | ---: | --- |
| Spark Standard | 1.25 | 0.15 | 4.25 | 3,000 / 4,000,000 |
| Spark 1.3 / 1.2 Contributor | 0.10 | 0.002 | 0.20 | 150 / 3,000,000 |
| Wonder Standard | 4.00 | 0.20 | 20.00 | 3,000 / 4,000,000 |

Rate limits are shared per team and per model; creating more API keys does not increase them. Handle 429 responses according to `Retry-After` and exponential backoff with jitter; web search is charged separately at 2.50 USD per thousand searches. This project does not enable built-in paid search by default. Source: [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits) (AI-008). For example, the **estimated price** for 8,000 uncached input tokens + 2,000 output tokens on Spark Standard is 0.0185 USD; this is not an incurred cost and does not include subsequent turns.

Standard Content is not used to train Meta Models; Discounted / Contributor Content may be used for training and improvement. Content includes inputs and outputs and is distinct from account-related Customer Data. General retention follows the terms and privacy policy; do not claim that “not used for training = not retained.” Source: [Data Commitments](https://dev.meta.ai/legal/commitments) (AI-009).

ZDR requires an eligible account and separate enablement by Meta, and may vary by model; it does not support server-side stateful history, background, file uploads, web search, or Contributor, and exceptions remain for legal compliance / abuse and operational metadata. This account's ZDR status has not been verified. Source: [ZDR](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention) (AI-010).

<!-- english-original-anchor --> <a id="reflection-lab-選型與上線閘門"></a>
## Reflection Lab Selection and Live Enablement Gates

**Provisional candidate: Spark Standard; Wonder may be evaluated for more complex planning within budget constraints.** This is an engineering inference based on documented costs and intended use; no A/B comparison between models has been performed. Contributor is not selected by default; the schema's live policy currently permits only Standard. Media is not uploaded by default; the user must explicitly select it and unnecessary personal information must be removed.

`AiProvider` should have the following conceptual interface; this is a design awaiting implementation, and the schemas / fixtures in the repository do not constitute a live adapter:

```ts
interface AiProvider {
  getAvailability(): Promise<CapabilityEvidence>;
  propose(context: RedactedContext, tools: ProviderToolSpec[]): Promise<Proposal>;
  cancel(requestId: string): Promise<void>;
}
// OfflineFixtureProvider: local deterministic proposals, no network or model identity.
// MetaModelApiProvider: future server-only adapter, guarded by verified account evidence.
```

Live enablement requires, in order: account authorization and applicable terms → actual `GET /v1/models` evidence → minimal function / strict-output contract tests for the specified model → confirmation of rates and privacy mode → a nonzero cost cap configured by the user → a verification artifact with a validity period written by the host. `GET /v1/models` is the officially recommended way to check the team catalog; this step was not executed in this review. [Models](https://dev.meta.ai/docs/models)

After validating `ai-provider-config.schema.json`, the host must also check the evidence issuer, model ID / data mode consistency, permissions, evidence validity period, pricing version, and quotas. Writing `verified` into JSON yourself has no effect. Defaults are `offlineFixture`, `networkEnabled:false`, and `maxEstimatedCostUsd:0`; without verification, return `PROVIDER_UNVERIFIED`, retain offline functionality, and clearly display “Offline example, not connected to Meta.” Do not present fallback behavior as Meta integration that satisfies the competition requirements.

<!-- english-original-anchor --> <a id="待驗證與解除條件"></a>
## Pending Verification and Conditions for Clearing the Gates

| Item | Status in this review | Evidence required next |
| --- | --- | --- |
| Official website documentation | `PASS` | The direct sources above are readable; check again before release. |
| Account models, region, credits / billing | `NOT RUN` | After the user configures the account, retain evidence using masked catalog / billing metadata. |
| Tools, strict JSON, end-to-end media | `NOT RUN` | Small, reproducible contract fixtures; test negative cases, refusal, truncation, timeout, and 429. |
| Accuracy, latency, cost A/B | `NOT RUN` | Fixed prompts / versions, with success rates and measured usage reported; promotional benchmarks cannot serve as a substitute. |
| Adapter and executor | `IMPLEMENTATION_PENDING` | Implement according to the other three contracts; product functionality was not started in this phase. |

Failure to obtain login page contents does not mean the API does not exist; readable public documentation does not mean the account has permission. If official documentation becomes unreachable later, record the URL / time / HTTP status, continue using the dated research, and disable unverified live paths without guessing newer capabilities.
