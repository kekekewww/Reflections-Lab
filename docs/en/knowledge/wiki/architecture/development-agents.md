<!-- english-source: {"path":"knowledge/wiki/architecture/development-agents.md","sha256":"4809888bd0c984c89f9b15c7dc14f1b46795c71b18c1fd345544b9334fccfa98","translated_at":"2026-10-27T05:42:31.833508Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0030
title: Codex Muse Harness and safe takeover
type: architecture
status: ACCEPTED
created_at: 2026-10-26T15:49:11.979Z
updated_at: 2026-10-27T05:41:13.996Z
sources:
  - RLAB-P3-SRC-0004
  - RLAB-P3-SRC-0018
  - RLAB-P3-SRC-0019
  - RLAB-P3-SRC-0022
  - RLAB-P3-SRC-0023
  - RLAB-P3-SRC-0024
  - RLAB-P3-SRC-0026
  - RLAB-P3-SRC-0027
  - RLAB-P3-SRC-0028
  - RLAB-P3-SRC-0029
  - RLAB-P3-SRC-0030
  - RLAB-P3-SRC-0032
  - SB-SRC-0001
  - SB-SRC-0011
  - SB-SRC-0012
  - SB-SRC-0013
  - SB-SRC-0014
  - SB-SRC-0039
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0006
  - V1-SRC-0013
related_tasks:
  - RLAB-TASK-0008
  - RLAB-TASK-0016
related_decisions:
  - ADR-011
  - ADR-012
supersedes: []
tags:
  - P0
  - agents
  - failover
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/architecture/development-agents.md`](../../../../../knowledge/wiki/architecture/development-agents.md). Source SHA-256: `4809888bd0c984c89f9b15c7dc14f1b46795c71b18c1fd345544b9334fccfa98`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="codex主導與可選harness"></a>
# Codex-led development and the optional Harness

[ADR-013](../../../02-architecture/adr/013-codex-primary-development.md) replaces mandatory Muse-first execution and automatic switching back when quota recovers. Codex owns architecture, implementation, and progress. Fixed tests, benchmarks, references, and isolated review provide validation; self-review alone is insufficient. The latest first-version authorization does not use Muse quota, and all V1 sources record Codex. Muse Code and the old Harness remain Optional. Task0009 CANCELLED means the mandatory goal was canceled, not that Live validation passed.

The user previously reported Muse0 and most recently reported US$150 of available Muse Code credit. This is user-provided information, not confirmation from a billing API. [Current resource status](../../../../09-agents/RESOURCE_STATUS.json) is the operational entry point. The failed Muse version probe involved local updater write permissions and must not be misreported as quota exhaustion. The actual observed Codex CLI version was 0.164.0. Product Meta Runtime accounting is separate; development Executor provenance cannot substitute for model evidence.

Task JSON is the sole work authority; agent_execution is an optional run projection. Agents sharing a checkout use separate file ownership, leases, optimistic hashes, and preserved events. Root is the sole Wiki writer. Follow Task→implementation→independent acceptance→checkpoint/handoff→Git; do not create a second backlog. The original Phase3 75 tests/19 gates and takeover records retain their historical scope.

Production V1 modules are implemented and undergoing overall acceptance; see [progress](../../../11-v1/SESSION_PROGRESS_20261027.md). Sound layering follows [ADR-014](../../../02-architecture/adr/014-sound-behavior-system.md).


This session added an official read-only Codex app usage observation: the account-shared 7-day window was 79% used/21% remaining; other window/model-specific fields were unknown. This is a point-in-time observation, not a monetary balance, project token balance, or general CLI REST API. The [sanitized evidence](../../../../../artifacts/v1/codex-usage-observation-20261027.json) retains provenance and limits without storing account/reset identifiers or converting credit to USD. No reset, purchase, limit increase, or account switch occurred. Current execution and subsequent changes still follow [resource status](../../../../09-agents/RESOURCE_STATUS.json) and actual errors.
