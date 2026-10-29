<!-- english-source: {"path":"docs/09-agents/MUSE_MODEL_RESEARCH.md","sha256":"5d35e46de2c07eca3716cf6f258b0a54882c41e8ddc5058a3766f953c10e324e","translated_at":"2026-10-27T03:39:47Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/MUSE_MODEL_RESEARCH.md`](../../09-agents/MUSE_MODEL_RESEARCH.md). Source SHA-256: `5d35e46de2c07eca3716cf6f258b0a54882c41e8ddc5058a3766f953c10e324e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="muse-模型研究與採用邊界"></a>
# Muse Model Research and Adoption Boundaries

Review date: 2026-10-26 (Asia/Taipei). Status: `DOC_REVIEWED`; model inference, account catalog, latency, usage, and actual cost measurements are all `NOT RUN`. This page supplements the existing [Meta model research](../08-ai/META_MODEL_RESEARCH.md); it does not replace its data rights or release gates. Sources and retrieval limitations are retained in the [metadata](../../../research/agents/model-source-metadata.json).

<!-- english-original-anchor --> <a id="環境必須分開"></a>
## Environments Must Remain Separate

| Environment | Purpose, identification, and limitations |
| --- | --- |
| Meta Model API | Candidate service for the in-product AI Experiment Agent; `https://api.meta.ai/v1`. Only the server may hold the key; a publicly listed model does not mean it is enabled for the account. |
| Muse Code CLI | Development executor with its own sandbox, session, subscription, or usage-based billing rules. Using Muse to write code is not evidence of product integration with the Meta API. |
| Self-hosted open weights | Requires your own hardware, runtime, chat template, tool parser, service security, and operations; Meta API prices, parameters, or account quotas cannot be applied directly. |
| Third-party hosting | The provider defines its own model aliases, service capabilities, data terms, prices, and quotas; these were not verified in this review, and automatic switching is not authorized. |

These service boundaries follow the [Overview](https://dev.meta.ai/docs/overview) and [Models](https://dev.meta.ai/docs/models). The official model list supports querying the team catalog with `GET /v1/models`; no such call was made in this review.

<!-- english-original-anchor --> <a id="型號與工作負載"></a>
## Models and Workloads

In the table, “supported” refers only to official documentation; it does not mean this project has completed contract tests. `null` means unpublished or unverified and must not be replaced with zero.

| Model / identifier | Context, input → output | Tools / structured output / reasoning controls | Available environments, candidate work, and unsupported uses |
| --- | --- | --- | --- |
| Muse Spark: `muse-spark-1.3`; `1.2` and `1.1` retained | 1,048,576 tokens; text, images, video, audio, PDF → text | API function tools, structured output; 1.3 has minimal/low/medium/high/xhigh/max; Contributor 1.3 has no max | Meta API; CLI does not include 1.1. Candidates: small fixes, classification, parameter planning, short tool loops. Cannot produce measurement evidence or execute host functions directly. |
| Muse Wonder: `muse-wonder-1.0` | 1,048,576; same as Spark → text | Same API tools / structured output; minimal through max | API (preview), Muse Code; candidates: changes across files, difficult debugging, and complex planning. `max` does not select Wonder Full; currently unavailable in South Korea. |
| Muse Wonder Full: API ID `null` | API specifications `null` | CLI subscription capability; API parameters do not apply | Muse Code with Power / Maximum Usage; not a Meta API model, and no callable ID may be fabricated. |
| Muse Spark Open: `meta-models/Muse-Spark-Open-816B-A42B` (checkpoint identifier, not a Meta API ID) | 1,048,576; text, images, audio, video → text | Self-hosting requires the correct reasoning/tool parser; OpenAI-style tools; structured-output constraints require separate runtime verification. reasoning_effort only low/medium/high/xhigh | Self-hosted or provider-hosted, not Meta API. 816B total parameters / 42B active; suitable for future large-scale self-hosting evaluation, not adopted for the MVP for now. Hosted API max/none settings or prices cannot be applied to it. |
| Muse Glimmer: `meta-models/Muse-Glimmer-30B` | Default 128K, extensible but maximum `null`; text, images → text | Template supports ATEM tools; strict structured decoding depends on the runtime; reasoning_strength low/medium/high/xhigh | 30B dense open weights, self-hosted; candidate for small local classification, drafting, and routing. Not a Meta API model; no hosted API SLA or promise of zero hardware costs. |
| Muse Image: `muse-image-1.0` | Token context `null`; text, images → images | Responses / images endpoints; not Spark's general function-tool implementation loop; see the sources for image-specific controls | May be evaluated for future material visual drafts or reference assets; not a generator of 3D geometry reconstructions, collision meshes, or measured material absorption coefficients. |
| SAM 3.1: `sam-3.1` | Token context `null`; text prompts, images, video → boxes/masks | Segmentation geometry; not a general chat, coding, or reasoning model | May be evaluated for marking scene object regions; image masks do not directly provide world dimensions, acoustic material measurements, 3D meshes, or individual sound paths. |

Spark / Wonder versions, media, and availability follow [Models](https://dev.meta.ai/docs/models); see [Reasoning](https://dev.meta.ai/docs/reasoning) for reasoning values, lack of `none` / `logprobs` support, and reasoning-token billing. See [Open prompting](https://dev.meta.ai/docs/muse-spark-open/prompting) for Open controls and checkpoint identification, and [Glimmer prompting](https://dev.meta.ai/docs/muse-glimmer/prompting) for Glimmer templates / ATEM. Image and segmentation capabilities are covered in [Image generation](https://dev.meta.ai/docs/image-generation) and [Media segmentation](https://dev.meta.ai/docs/media-segmentation).

API tools are executed by the host; Responses uses flat tool definitions and function_call_output, while Chat Completions uses nested function definitions and tool messages. Do not mix request shapes. Execution may begin only after streamed arguments are complete and locally validated. [Tool calling](https://dev.meta.ai/docs/tool-calling)

Strict schemas require an object root, additionalProperties:false for every object, and every property included in required; oneOf/allOf cannot be used. Limits include depth 10 and 5,000 total properties; recursive refs are not accepted. This constrains only the shape; the host must still validate domain IDs, units, scene revisions, capabilities, and budgets. [Structured output](https://dev.meta.ai/docs/structured-output)

<!-- english-original-anchor --> <a id="成本速率與延遲"></a>
## Cost, Rate Limits, and Latency

Public prices are in USD as of the review date; actual account rates / credits / remaining quotas are all `null`. Rate limits are team/model rate windows and cannot be used to infer available cash or remaining Muse subscription prompts.

| Meta API model | Per million tokens: input / cached input / output | Public RPM / TPM | Project latency / actual cost measurements |
| --- | --- | --- | --- |
| Spark Standard (1.3 / 1.2 / 1.1) | 1.25 / 0.15 / 4.25 | 3,000 / 4,000,000 | null / null |
| Spark Contributor (1.3 / 1.2) | 0.10 / 0.002 / 0.20 | 150 / 3,000,000 | null / null; not adopted |
| Wonder Standard | 4.00 / 0.20 / 20.00 | 3,000 / 4,000,000 | null / null |
| Image | $0.01 / successful image | 150 / no TPM | null / null |
| SAM 3.1 | $2.50 / thousand images; $0.20 / thousand video frames; minimum 50 frames billed per video | 3,000 / no TPM | null / null |
| Open / Glimmer | Not Meta API pricing; GPU / provider / operations costs are separate | Determined by runtime / provider | null / null |

Prices and rate-limit values come from [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits). Greater reasoning effort may increase output tokens, initial latency, and cost; models were not ranked by speed in this review. [Reasoning](https://dev.meta.ai/docs/reasoning)

<!-- english-original-anchor --> <a id="自架與資料條款"></a>
## Self-Hosting and Data Terms

Open BF16 weights are approximately 1.65TB and NVFP4 approximately 537GB; execution also requires additional memory such as the KV cache. Official guidance lists a BF16 VRAM budget of approximately 2TB. It uses the Muse Model License and AUP, not Apache. These are official deployment guidelines; no local download or benchmark was performed. [Spark Open overview](https://dev.meta.ai/docs/muse-spark-open)

Glimmer30B weights use Apache2.0; quantization, context extension, hardware sufficiency, and performance still require separate verification. No checkpoint was downloaded and no local server was started in this review. [Glimmer overview](https://dev.meta.ai/docs/muse-glimmer)

Standard Content is not used to train Meta Models; Contributor / Discounted Content may be used for training and improvement. This does not mean there is no retention or safety review. Do not enable Contributor independently to reduce costs, and do not use model-generated text to prove rights to third-party materials. [Data Commitments](https://dev.meta.ai/legal/commitments)

<!-- english-original-anchor --> <a id="採用決策與下一次驗證"></a>
## Adoption Decisions and Next Verification

Reflection Lab currently retains Spark Standard as a low-cost runtime candidate; Wonder is only a candidate for difficult planning / development and requires an explicit budget. This is an engineering inference based on workloads, not a claim of measured superiority. Image, SAM, Open, and Glimmer do not add mandatory MVP dependencies; unauthorized providers are excluded from automatic fallback.

Development Executor quota and Product Runtime API quota retain separate statuses. When Muse is unavailable, development may switch to Codex; when the Meta runtime is unavailable, switch only to offline fixtures / recorded tools, and keep live Meta tests BLOCKED / NOT RUN. The sequence for clearing these gates is account catalog → billing / data-mode confirmation → minimal tools and strict-output contract tests → repeated fixed-prompt evaluation → latency and usage measurements. All live gates are `NOT RUN` in this review; see [Quota research](QUOTA_RESEARCH.md) for error classification and quota detection.
