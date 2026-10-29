<!-- english-source: {"path":"docs/09-agents/MODEL_ROUTING.md","sha256":"3437f3fdf45b447caf5df0d412ffa381b2a21a2423b3cac5576b21ed75951258","translated_at":"2026-10-27T03:44:09.346557Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/MODEL_ROUTING.md`](../../09-agents/MODEL_ROUTING.md). Source SHA-256: `3437f3fdf45b447caf5df0d412ffa381b2a21a2423b3cac5576b21ed75951258`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="model-與-executor-routing"></a>
# Model and Executor Routing

> **Current policy as of 2026-10-27: Codex leads; Muse Code is optional.** See [ADR-013](../02-architecture/adr/013-codex-primary-development.md). The Muse-preferred workflow below is retained as an Optional Harness / Phase3 historical profile. It is not a prerequisite for normal development, and restored quota does not automatically switch the project back.

Adopted engineering policy: **Codex Orchestrator ? Muse Code preferred implementation ? deterministic verification + Codex review**; when Muse cannot continue within the defined resource budget, switch to **Codex implementation ? independent validation**. Executor name and actual model are separate fields; ?Muse? or ?Codex? must not conceal the actual provider / model / CLI version.

<!-- english-original-anchor --> <a id="開發工作路由"></a>
## Development Work Routing

| Work | Preferred route | Escalation / fallback boundary |
| --- | --- | --- |
| Small implementations / fixes with clear acceptance criteria | Muse Code + a Spark Standard candidate confirmed available | First reduce scope / provide failure evidence; quota / faults follow the failover policy. |
| Difficult debugging and long-running work across files | A Muse Wonder candidate may be evaluated | Requires confirmed account availability / budget; do not automatically raise the spending limit. |
| Task decomposition, ADRs, acceptance, and integration | Codex Orchestrator | When Codex takes over implementation, its own review cannot also be the final basis for success. |
| Fixed acceptance, mathematical / physics references, schema / CI | Independent test runner / reference | The implementer must not arbitrarily change tests and expected values; missing UI / audio E2E must be explicit. |
| Muse quota exhausted / unavailable after bounded retries | Codex fallback | First stop the original process, save checkpoint / diff, and acquire sole workspace ownership; no concurrent writers. |

This is a workload-based choice, with no evidence of a model winning a speed / quality A/B comparison. The CLI default model was still Spark1.2 in the official documentation reviewed at the time; this project's 1.3 candidate must be configured explicitly and its availability checked first. Installing the CLI does not establish that the account has access to that model. [Models](https://dev.meta.ai/docs/models), [Configuration](https://dev.meta.ai/docs/muse-code/configuration)

<!-- english-original-anchor --> <a id="產品-runtime-路由"></a>
## Product Runtime Routing

The Meta Model API is the official target for the product's AI Experiment Agent; a change in development executor does not replace it with the Codex API. Spark Standard may be evaluated for low-cost planning; Wonder is evaluated only for difficult planning. Image / SAM / Open / Glimmer remain research candidates and do not add mandatory MVP models. [Model comparison](MUSE_MODEL_RESEARCH.md)

When runtime quota is exhausted, the host retains the Meta adapter / tools / integration gate and uses explicitly identified offlineFixture / recorded responses for offline testing. The product must not label fixtures, Codex development results, or outputs from another provider as actual Meta output. Demos requiring live Meta must revalidate catalog / tool calls / actual connectivity before submission.

<!-- english-original-anchor --> <a id="資源與身份"></a>
## Resources and Identity

Development Muse subscriptions, development Codex usage, and product Meta API credits are recorded separately. Unknown is treated as neither 0 nor infinity; observations include source / time. Subscription usage, rate headers, and dollar balances are not inferred from one another. Contributor mode defaults to off; automatic subscription upgrades, consume reset, key / account changes, or unauthorized providers are prohibited. Cost defaults to 0; a paid run requires an explicitly configured budget. [Quota research](QUOTA_RESEARCH.md)

When model availability recovers, switching back to Muse occurs only at a safe checkpoint / after task completion. The same task retains its original task ID, goal, milestone, criteria / test hashes, and completion progress; an executor change must not create a falsely new task. Detailed state machines and CLI behavior follow [Orchestration](CODEX_MUSE_ORCHESTRATION.md) and [Failure recovery](FAILURE_RECOVERY.md); this page does not create another state authority.
