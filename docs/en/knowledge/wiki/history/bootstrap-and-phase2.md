<!-- english-source: {"path":"knowledge/wiki/history/bootstrap-and-phase2.md","sha256":"9a3a34d60792b2ac4a72ad9a05eb42bc367077040f3543b43539c8ad9517ed91","translated_at":"2026-10-27T03:44:07.128220Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0019
title: Project evolution baseline
type: history
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T15:49:35.117Z
sources:
  - RLAB-SRC-0001
  - RLAB-SRC-0002
  - RLAB-SRC-0003
  - RLAB-SRC-0039
  - RLAB-SRC-0062
  - RLAB-P3-SRC-0016
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - history
  - provenance
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/history/bootstrap-and-phase2.md`](../../../../../knowledge/wiki/history/bootstrap-and-phase2.md). Source SHA-256: `9a3a34d60792b2ac4a72ad9a05eb42bc367077040f3543b43539c8ad9517ed91`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="從空目錄到研究知識工程"></a>
# From an empty directory to research/knowledge engineering

On 2026-10-26, Phase1 verified an empty directory with no Git/old prototype, then initialized main without committing. It added 140 files, 27 core sources, 64 central claims, 8schemas/10ADR/8skills, and native/physics/analytical spikes. This was a snapshot at the time, not the total file or Skill count after Phase2.

Phase2 began with a new user requirement: retain existing research and build a three-layer Wiki, source versions, tasks/events/claims/handoff, and an Emil design engineering environment. Adding a YAML parser and AJV compatibility fixes changes the lockfile. The Phase1 [complete validation snapshot](../../../../../benchmarks/results/phase1-validation-preserved.json) retains its original values; a new lockfile cannot be used to pretend the old run already used the newer versions.

There is currently no evidence that the old architecture was abandoned. WASM/Unity were comparison options and must not be described as implementations that later failed. New actual operation history is in the [log](../log.md). Task starts/completions follow event and artifact times; document creation dates do not establish product completion dates.

The complete Phase 2 gate of 16 commands passed, with Wiki50PASS/1junctionSKIP, Design14PASS, and original contracts30PASS. Original stdout/exit and hashes are preserved in the [Phase2 artifact](../../../../../benchmarks/results/phase2-validation-local.json). Tasks3/4/5 were closed based on evidence; this was not production product/browser acceptance. Context-free reading and handoff reception results are recorded separately in the [scenario record](../../../../09-knowledge/SCENARIO_VALIDATION.json).


Phase3 added [development-agent history](agent-runs.md): Muse-first/Codex takeover/independent acceptance, official model and quota research, and prompt foundations. These are development tools; the production product remained BACKLOG. The latest user confirmation reports no Muse quota, Active Codex, and no model inference performed.
