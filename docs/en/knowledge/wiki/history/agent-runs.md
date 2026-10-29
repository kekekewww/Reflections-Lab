<!-- english-source: {"path":"knowledge/wiki/history/agent-runs.md","sha256":"599ebe4445408cc0bd31d9601eb914d4b6211b2c6e1f2ebac27d0fb0cb5fa0d2","translated_at":"2026-10-27T05:41:46.9646000Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0032
title: Harness Execution and Handoff History
type: history
status: VERIFIED
created_at: 2026-10-26T15:49:35.115Z
updated_at: 2026-10-26T18:07:51.540Z
sources:
  - RLAB-P3-SRC-0016
  - RLAB-P3-SRC-0017
  - RLAB-P3-SRC-0022
  - RLAB-P3-SRC-0023
  - RLAB-P3-SRC-0024
  - RLAB-P3-SRC-0026
  - RLAB-P3-SRC-0028
  - RLAB-P3-SRC-0031
  - SB-SRC-0001
  - SB-SRC-0031
related_tasks:
  - RLAB-TASK-0008
related_decisions:
  - ADR-011
  - ADR-012
supersedes: []
tags:
  - P1
  - history
  - provenance
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/history/agent-runs.md`](../../../../../knowledge/wiki/history/agent-runs.md). Source SHA-256: `599ebe4445408cc0bd31d9601eb914d4b6211b2c6e1f2ebac27d0fb0cb5fa0d2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="phase3操作與證據"></a>
# Phase3 Operations and Evidence

The [first demo failed](../../../../../artifacts/phase3-demo-20261026/report.json) after revealing resource contamination across scenarios; the original results are retained. After the fix, the [confirmation demo](../../../../../artifacts/phase3-demo-confirmation-20261026/report.json) achieved PASS in 8 scenarios. Agent tests cover the full 12 scenarios; mock must not be called live.

[Actual current Codex handoff](../../../../../artifacts/phase3-current-codex/proof.json): Mock Muse wrote preserved=40 and then stopped at its quota. Codex read the handoff, acknowledged it and used apply_patch to append answer=preserved+2. The original independent Node acceptance achieved PASS, preserving the same Goal/Milestone/Task, partial content and acceptance hash. export → immutable snapshot → actual Wiki CLI update succeeded; the hash of Task0008's agent_execution can be verified.

The [first Milestone execution](../../../../../artifacts/phase3-milestone-result.json) and [subsequent resume](../../../../../artifacts/phase3-milestone-resume-result.json) used the same run without redoing completed items. Git originally had no HEAD, so the run revision at that time was null; do not fabricate an old commit afterward.

The [independent review](../../../09-agents/INDEPENDENT_REVIEW.md) corrected defects in workspace locks across controls, process descendant safety, event identity, the acceptance schema, stale completed-state validation and terminal operations. Acceptance criteria/benchmarks were neither deleted nor relaxed. See the [report](../../../09-agents/PHASE3_REPORT.md) for the final scope.


After the user separately and explicitly confirmed Muse0, the actual non-Mock resource registry routing handed off before any Muse launch, with attempts0. The [actual zero-Muse run](../../../../../artifacts/phase3-user-zero-muse/export.json) was completed by Codex in this chat and passed the original independent acceptance. This is evidence of actual resource routing and Codex edits; it is not evidence of Muse live terminal quota exhaustion.


On 2026-10-27, a receiver without prior context [actually read the handoff](../../../../../artifacts/phase3-fresh-handoff-receipt.json): it resumed the same task/goal/milestone, with matching state/contract/acceptance/verifier/checkpoint hashes. The completed resume produced no new event and retained rev11/attempts0. Differences in the old scope that changed when the report was closed are also retained, without rewriting the original handoff. Task0008 was closed based on 19gate/receipt; official product and Live limitations remain separate.


The new requirements on 2026-10-27 formally made Codex the lead under ADR-013, with MuseCode Optional. The original mandatory LiveHarness prerequisite in Task0009 was CANCELLED (not passed validation); Phase3 sources and empirical evidence are retained. Sound Behavior Task0010 covers only research/drafts/isolated probes; the original product and Meta live are not yet complete.


Sound Behavior research Task0010 has been closed. The 34 draft/policy tests and 3 actual WASM APIs passed, and all 22 integration capabilities achieved PASS after a single Wiki relative-link fix. The original FAIL and Phase1/2/3 evidence are retained. Official runtime/browser/audio/Meta remain NOTRUN; the next Task0011 being READY does not mean it has been implemented.
