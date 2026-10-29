<!-- english-source: {"path":"knowledge/wiki/research/muse-models-and-quota.md","sha256":"daad57acbea4c38edacd9753ce7fd326255cc48d4d09a27aa0aac366f0bdc5f0","translated_at":"2026-10-27T03:44:07.128220Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0031
title: Muse model quota and prompt research
type: research
status: VERIFIED
created_at: 2026-10-26T15:49:19.315Z
updated_at: 2026-10-26T15:49:44.460Z
sources:
  - RLAB-P3-SRC-0008
  - RLAB-P3-SRC-0009
  - RLAB-P3-SRC-0010
  - RLAB-P3-SRC-0011
  - RLAB-P3-SRC-0019
  - RLAB-P3-SRC-0020
related_tasks:
  - RLAB-TASK-0008
related_decisions:
  - ADR-011
  - ADR-012
supersedes: []
tags:
  - P1
  - Muse
  - quota
  - DOC_REVIEWED
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/research/muse-models-and-quota.md`](../../../../../knowledge/wiki/research/muse-models-and-quota.md). Source SHA-256: `daad57acbea4c38edacd9753ce7fd326255cc48d4d09a27aa0aac366f0bdc5f0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="官方研究與實際額度分開"></a>
# Official research and actual quota are separate

[Model comparison](../../../09-agents/MUSE_MODEL_RESEARCH.md), [prompt guide](../../../09-agents/MUSE_PROMPT_ENGINEERING.md), [routing](../../../09-agents/MODEL_ROUTING.md), and [quota research](../../../09-agents/QUOTA_RESEARCH.md) pin official URLs/versions/conditions. The original texts were read; these are not rankings from model tests. Source metadata is in research/agents.

Local versions are Muse1.4.13 and Codex0.163.0. A real Muse echo produced 15 parseable JSONL events; it was not a model implementation. A usage query had a transient failure, leaving the original API observation UNKNOWN. The user subsequently explicitly confirmed that Muse had no available quota; the status became USER_CONFIRMED exhausted and model dispatch stopped. This information was not extended into a claim about the product API balance. A read-only Codex app snapshot showed weekly usage at 7%/93% remaining, valid only at the observation time. No account/credits IDs were saved and no quota was reset.

429 uses bounded retry. 402billing, 401authentication, 403permission, 5xx/outage, and explicit quota are distinct. MSP typed quota and rawexec failure shapes must not be mixed. Without an actual rawexec quota-stop example, it remains UNKNOWN; not every error is guessed to be quota. Provider credit/subscription/rate headers cannot substitute for one another.

[Headless/SDK](../../../09-agents/HEADLESS_EXECUTION.md) CLIhelp and schema have evidence. SDKruntime, model prompt effectiveness, actual quota-stop recovery, and product Meta live are NOT RUN.
