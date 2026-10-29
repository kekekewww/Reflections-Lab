<!-- english-source: {"path":".agents/skills/muse-prompt-optimization/SKILL.md","sha256":"98e7632e881a32645c54843cd0f66bb8c8743a9202e88a97b58bba705a675a8d","translated_at":"2026-10-27T05:41:23.2557372Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: muse-prompt-optimization
description: Evaluate Reflection Lab Muse coding or product runtime prompts, comparing strategies with fixed fixtures and recording observable metrics and measured limitations; do not treat offline workflow tests as model performance.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/muse-prompt-optimization/SKILL.md`](../../../../../.agents/skills/muse-prompt-optimization/SKILL.md). Source SHA-256: `98e7632e881a32645c54843cd0f66bb8c8743a9202e88a97b58bba705a675a8d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="muse-提示詞評估"></a>
# Muse Prompt Evaluation

<!-- english-original-anchor --> <a id="trigger--inputs"></a>
## Trigger / Inputs

Select a task prompt, reduce context, compare repair strategies, or update model templates. Inputs are workload, model/CLI versions, data environment, fixed acceptance, strategies, and cost/time limits.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read docs/09-agents/MUSE_PROMPT_ENGINEERING.md, MODEL_ROUTING.md, and corresponding official sources first; distinguish Muse CLI, Meta Model API, and open weights/third-party platforms. Do not copy reasoning, context, or model IDs across environments.
2. Compare Direct and Structured with the four fixture categories in benchmarks/muse/evaluation-config.json; fix acceptance, inputs, and permitted changes. Add only defect-relevant context when needed; do not assume longer prompts are better.
3. Run `node --test benchmarks/muse/evaluate.test.mjs` and `node benchmarks/muse/evaluate.mjs` first to validate the offline evaluator. This step checks only fixed references and bad cases; it does not call a model.
4. Live evaluation separately requires confirmed model access, data mode, and an explicit budget; preserve each run, prompt/fixture hashes, model/CLI, actual tests, repairs, extra file modifications, and usage. Do not fill unknown cost/tokens/latency with 0.

<!-- english-original-anchor --> <a id="completion--validation"></a>
## Completion / Validation

Describe only observable success rates, tests, repairs, latency, usage, and limitations; retain failed samples. Passing fixture checks for multiple strategies cannot prove one strategy superior; LIVE EVAL NOT RUN cannot become a model comparison.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Without a key/quota/permissions, complete the offline fixtures and explanation and keep live metrics null. Do not increase paid limits, switch accounts, change acceptance, or discard failed runs to manufacture results.
