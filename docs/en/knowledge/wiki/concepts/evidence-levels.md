<!-- english-source: {"path":"knowledge/wiki/concepts/evidence-levels.md","sha256":"59a2e4943a0209350df0a7b1159a9f9cace156ef2e2220ce9c8ce29b140e4c8d","translated_at":"2026-10-27T05:42:31.833508Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0021
title: Evidence, status, and time
type: concept
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:52:34.879Z
sources:
  - RLAB-SRC-0039
  - RLAB-SRC-0002
  - RLAB-SRC-0028-V2
  - SB-SRC-0002
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - evidence
  - V0
  - V5
  - provenance
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/concepts/evidence-levels.md`](../../../../../knowledge/wiki/concepts/evidence-levels.md). Source SHA-256: `59a2e4943a0209350df0a7b1159a9f9cace156ef2e2220ce9c8ce29b140e4c8d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="計畫實作驗證不是同一件事"></a>
# Planning, implementation, and validation are different

PROPOSED/ACCEPTED are decision statuses; IMPLEMENTED means code exists; PASS is the result of an actual command; V0–V5 are validation levels. A VERIFIED Wiki page must explain exactly what kind of information it verifies, rather than using one status to cover every feature.

V0 schema, V1 analytical/numerical, V2DSP correctness, V3 independent solver, V4runtime/performance, V5perceptual/real-world. Reading documents cannot be promoted to runtime validation, Node microbenchmarks to browser validation, or synthetic RIR to measurements.

Measured/Computed/Estimated describe result provenance; an AI explanation is only text. Measured/Derived/Tuned/Synthetic describe material provenance and have different semantics. Time is separated into user events/physics ticks/acoustic jobs/audio samples/device output; 60FPS is not the audio callback budget.

A task being DONE requires an artifact and hash for every criterion. The CLI only checks existence/matches; the operator must also read stdout/exit and assess validity. A new version requires new validation; an old report cannot endorse new code. Source changes create a new version, and significant contradictions retain a conflict rather than being blended.
