<!-- english-source: {"path":"knowledge/wiki/experiments/muse-prompts.md","sha256":"2517db6a6cda5f8aca27ea4ee8aef1d41c91882bcf712901baa9a43aaff277c7","translated_at":"2026-10-27T05:41:56.131987Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0033
title: "Muse offline prompt evaluation and Skills"
type: experiment
status: VERIFIED
created_at: 2026-10-26T15:49:30.101Z
updated_at: 2026-10-26T16:08:58.309Z
sources:
  - RLAB-P3-SRC-0013
  - RLAB-P3-SRC-0014
  - RLAB-P3-SRC-0015
  - RLAB-P3-SRC-0025
related_tasks:
  - RLAB-TASK-0008
related_decisions:
  - ADR-011
  - ADR-012
supersedes: []
tags:
  - P1
  - prompts
  - offline
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/experiments/muse-prompts.md`](../../../../../knowledge/wiki/experiments/muse-prompts.md). Source SHA-256: `2517db6a6cda5f8aca27ea4ee8aef1d41c91882bcf712901baa9a43aaff277c7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="prompt評測基礎"></a>
# Prompt evaluation foundations

The [reproducible benchmark](../../../benchmarks/muse/README.md) has four categories—TScomponent, physicsimpulse, acousticreflection and bugregression—across two strategies, direct/structured, with fixed independent analytical values and 4 bad controls. These are handwritten trusted fixtures, not model output; model success/tokens/cost/latency are all null, and LIVE EVAL NOT RUN.

[Templates](../../../prompts/muse/implementation.md) narrow context through TaskContract / domain / design safety. The 3 [product runtime prompts](../../../prompts/runtime/experiment-agent.md) grant no shell/repo access and do not generate solver numbers. The original Meta tool schemas remain. Exhausted development quota still permits offline fixtures, but cannot justify claiming Meta live completion.

The 5 new Skills each passed 5/5 in real local Muse validation and Codex official format checks. Muse project discovery saw 23 projectskills, with no diagnostics for the 5 additions. The existing 8 project + memory/design files and 8 Emil originals remain; vendor-specific fields were not claimed to have fully passed the official format.

The evaluator's emptyexports falsePASS and finiteoverflow negative cases were fixed; original failures and old results remain. This phase's report links the latest fixture results, which cannot establish that a prompt is generally better.
