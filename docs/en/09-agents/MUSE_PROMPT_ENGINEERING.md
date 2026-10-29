<!-- english-source: {"path":"docs/09-agents/MUSE_PROMPT_ENGINEERING.md","sha256":"bea142d3ccaf2ea43f56d823bd38a840267b0db97f17918721d17e7f0c622e6c","translated_at":"2026-10-27T03:39:47Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/MUSE_PROMPT_ENGINEERING.md`](../../09-agents/MUSE_PROMPT_ENGINEERING.md). Source SHA-256: `bea142d3ccaf2ea43f56d823bd38a840267b0db97f17918721d17e7f0c622e6c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="muse-prompt-engineering-與評測方式"></a>
# Muse Prompt Engineering and Evaluation Methods

Reviewed: 2026-10-26 (Asia/Taipei). The following separates “what official documentation states,” “this project's engineering assumptions,” and “observed evaluations.” No Meta model inference data is available, so we cannot claim that Structured Task Contracts are generally better than short prompts. See [Model research](MUSE_MODEL_RESEARCH.md) for model fields and [Headless](HEADLESS_EXECUTION.md) for the local CLI.

<!-- english-original-anchor --> <a id="coding-agent由可驗收成果開始"></a>
## Coding Agent: Start with Verifiable Deliverables

The design adopted by this project is: Role / Objective → precise Scope → mandatory constraints → Acceptance Criteria → minimum relevant files → available tools and resource budget → failure recovery → completion report. The Task Contract is the sole source of acceptance conditions; prompts must not redefine looser conditions. This is an engineering choice suited to recoverable development, not a model benchmark conclusion.

| Task | Prompt and context selection | Completion evidence |
| --- | --- | --- |
| Small TypeScript / bug fix | Short objective + specified files / failure cases; omit unrelated full research documents. | Fixed regression test, scope diff, unverified limitations. |
| Implementation / refactor across files | Structured Task Contract; explicitly state external interfaces, file ownership, immutable acceptance criteria, and module boundaries. | Original tests + necessary integration tests; evidence that existing behavior is preserved. |
| React / Three UI | Point to canonical Design System / tokens / Component / Motion; React/R3F follows the effective ADR, without letting the agent change architecture independently. | List static and browser / input / performance evidence separately; a static pass does not mean a visual pass. |
| Rapier / FPS | Fixed step, stable IDs, four body modes, contact-solving grab, bounded impulse; load the physics skill as required by the task. | Deterministic fixture + separate WASM / browser verification when required. |
| Acoustic math / DSP | SI, energy / pressure, bands, model label, path identity, clock / delay; cite the specified claim / fixture. | Reference implementation / tolerance / mathematical benchmark; agent prose cannot replace numerical results. |
| Repair | Retain the original task ID / criteria / budget; provide the exact command, exit, expected / actual difference, and smallest failure excerpt. | Rerun the original gate; failure proceeds to the next bounded repair or BLOCKED. |

The general template is in [prompts/muse](../prompts/muse/implementation.md). “Just confirm it yourself when finished” must not replace an independent runner; a completion report's self-reported PASS cannot justify writing COMPLETED. Codex fallback still reads the same constraints / skills; only the executor and provenance change.

<!-- english-original-anchor --> <a id="prompt-長度examples-與-session"></a>
## Prompt Length, Examples, and Sessions

Short tasks that are simple, explicit, and have a fixed verifier may use Direct Instruction. Prefer a Task Contract for work across files, scientific constraints, or mid-task handoffs; include only documents that directly support decisions and a few examples. Few-shot examples should demonstrate difficult output contracts / error handling, without including an entire chat or requesting disclosure of private reasoning. More context does not necessarily improve quality; actual evaluation is required.

The SDK / CLI provides only model and reasoning controls, not the surrounding task decomposition, permissions, step limits, timeouts, and verification. The CLI's reasoning-effort enum is broader than the values available to any one model; choose only after checking the model profile / API documentation. Subagents suit work with independent scopes; official documentation allows a shared checkout when isolation is not required, so the Harness does not treat a compatibility flag as automatic isolation for every subagent. [Configuration](https://dev.meta.ai/docs/muse-code/configuration), [Extending](https://dev.meta.ai/docs/muse-code/extending)

On each session resume, first read the checkpoint / diff / remaining work; do not repeat completed criteria. Do not let a compact summary override traceable tasks / Git / original tests. Muse `/goal` is Muse session state; preserve the original objective and references across executors, without pretending that Codex can directly operate its currently active own session. [Working with the agent](https://dev.meta.ai/docs/muse-code/interactive)

<!-- english-original-anchor --> <a id="product-runtimetyped-tools-與停止條件"></a>
## Product Runtime: Typed Tools and Stop Conditions

Product prompts only propose scene / experiment candidates; the host executes tools. Separate plans from measured results; attach run IDs / artifacts to numerical values, and retain unknown when there are no tool results. The model may call only tools in the registry; after schema validation, validate revisions / domain IDs / SI / capabilities / budgets, and use preview → apply → undo. Arbitrary code execution through eval is not allowed.

Do not mix Chat Completions tool definitions and tool messages with Responses function_call / function_call_output. Retain the original assistant tool-call message and matching call ID; do not execute before streamed arguments are complete. The official cookbook demonstrates “receive a native tool call first, then let the application execute it and return the result”; a model's claim that a tool ran is not evidence. [Tool/function cookbook](https://dev.meta.ai/docs/cookbook/tool-function-calling)

Structured output schemas constrain shape; they cannot prove measurements are real or mathematics is correct. Runtime schemas must be converted to the subset supported by the provider. Missing fields, refusals, truncation, and timeouts all take explicit error paths; do not dress them up as valid success JSON. [Structured-output cookbook](https://dev.meta.ai/docs/cookbook/structured-output)

As a rule, place stable instructions / tool schemas / a few examples first and changing scene context later to support prefix caching. The cached_tokens field is in different locations in Responses / Chat; only actual usage may count as a cache hit, and identical prompts do not guarantee a hit. The official API provides optional prompt_cache_key; no call was made and latency / savings were not verified in this review. [Prompt caching](https://dev.meta.ai/docs/prompt-caching)

<!-- english-original-anchor --> <a id="開放權重不是代管-api-的參數別名"></a>
## Open Weights Are Not Parameter Aliases for the Hosted API

The official Muse Spark Open prompting guide recommends placing high-priority invariants first, with explicit scope / decision procedures / tools / output / stop conditions. It uses a self-hosted / provider chat template, which inserts tools; full tool definitions need not be repeated in system prose. Open's reasoning_effort supports only low / medium / high / xhigh and cannot be turned off; a numeric Reasoning strength in the system message can override it. These specific settings cannot be applied directly to Muse Code or the Meta API. [Spark Open prompting](https://dev.meta.ai/docs/muse-spark-open/prompting)

The Agent frameworks documentation shows connections to the Meta API through different protocols, but permissive settings in its SDK examples are not Reflection Lab's security defaults. Using a Codex agent with a Meta model also does not make it an independent OpenAI verifier; record the actual provider / model / tools and verification authority. [Agent frameworks](https://dev.meta.ai/docs/agent-frameworks)

<!-- english-original-anchor --> <a id="四類兩策略的可重現評測"></a>
## Reproducible Evaluation: Four Categories, Two Strategies

Isolated fixtures include a TypeScript component, Rapier interaction, geometry/acoustic math, and bugfix/regression; each category compares Direct Instruction (A) with Structured Task Contract (B). Fixtures / runner / results are in [benchmarks/muse](../benchmarks/muse/README.md). The actual commands are `node --test benchmarks/muse/evaluate.test.mjs` and `node benchmarks/muse/evaluate.mjs`. Offline fixtures can demonstrate the behavior of the harness, reference tests, and metric collection; they cannot compare the success rate of Muse-generated code.

Live evaluation awaits an authorized account and budget: fix the model / CLI / prompt hash / task fixture / acceptance hash; repeat each strategy multiple times and interleave runs to reduce time-of-day effects; use identical retry / repair limits; define success and anomalous files in advance. Retain failed samples too, rather than selecting only passing runs.

| Metric | Observation method and unknown rules |
| --- | --- |
| Task success / test pass | Fixed verifier results; completing a turn does not count as task success. |
| Repair rounds | Actual repair attempt count; retries cannot count as code repairs. |
| Unexpected modifications | Compare baseline / after manifests against task scope and retain the diff. |
| Hallucinated APIs | Type / runtime errors + manual source review; record null if there is no manual review. |
| Latency / tool calls | Process wall time, parsed events; echo counts only as transport. |
| Tokens / cost | Provider usage + fixed rates or actual account charges; missing data is null, and estimates are marked ESTIMATED. |
| Human intervention / quality | Defined events and rubric; high quality cannot be inferred automatically from exit0. |

Currently **LIVE EVAL NOT RUN**. No comparison of model success rates / mean latency / actual cost has been performed; no optimal prompt has been demonstrated. Future results will be written back to this guide by model, version, task, and conditions, avoiding promotion of a single small sample into a general rule.
