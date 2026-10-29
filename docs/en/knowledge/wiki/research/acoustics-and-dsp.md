<!-- english-source: {"path":"knowledge/wiki/research/acoustics-and-dsp.md","sha256":"417bc810fadcf4b0e10be3559547815e186e8bd059b584dd77864bd0de1bc88b","translated_at":"2026-10-27T03:44:07.128220Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0011
title: Consolidated acoustics and DSP knowledge
type: research
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:54:59.738Z
sources:
  - RLAB-SRC-0006
  - RLAB-SRC-0007
  - RLAB-SRC-0008
  - RLAB-SRC-0010
  - RLAB-SRC-0009
  - SB-SRC-0002
  - SB-SRC-0001
related_tasks:
  - RLAB-TASK-0001
related_decisions: []
supersedes: []
tags:
  - P1
  - acoustics
  - DSP
  - research
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/research/acoustics-and-dsp.md`](../../../../../knowledge/wiki/research/acoustics-and-dsp.md). Source SHA-256: `417bc810fadcf4b0e10be3559547815e186e8bd059b584dd77864bd0de1bc88b`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學dsp可追溯結論與實作界線"></a>
# Acoustics/DSP: traceable conclusions and implementation boundaries

The 27 core paper/ISO/technical sources and 64 central claims are indexed in [PAPER_INDEX](../../../research/papers/PAPER_INDEX.md) and the [Ledger](../../../../../research/EVIDENCE_LEDGER.json). VERIFIED refers only to source indexing/reviewed methods and limited analytical evidence. It does not mean every full text was read, original paper experiments were reproduced, or real-room validation was performed.

- Finite polygon ISM must check that reflection points lie within faces and that every segment is visible. Stable path identity depends on source/listener/ordered surfaces/model version, not ranking/coordinates.
- A/R/T are energy definitions; sqrt(R) applies only to magnitude-only calculations at equal impedance. Scattering distributes reflected energy. If measured absorption includes transmission, it must not be deducted again. A Synthetic preset must not be labeled Measured.
- Direct and reflections share emission t0. Absolute/relative delay must not be counted twice; propagation/DSP/device delays are separate.
- EDC uses reverse integration. EDT/T20/T30 fitting requires consideration of the decay range and noise. An insufficient result must not be filled in as RT60=0. dBFS is not dB SPL.
- Exact moving propagation requires retarded time; quasi-static delay is an approximation. When delay variation already produces Doppler, another pitch shift must not duplicate it.
- Collision sample playback is not modal synthesis; impulse is only part of excitation. The applicability, grid, and cost of wave FDTD/FEM/BEM cannot be inferred from a geometric microbenchmark.

Original equations and conditions are in [ACOUSTIC_THEORY](../../../research/theory/ACOUSTIC_THEORY.md), [DSP_MODELS](../../../research/theory/DSP_MODELS.md), and [PHYSICS_THEORY](../../../research/theory/PHYSICS_THEORY.md). A complete ISO atmospheric coefficient reference, V3 independent solver, and V5 real-room validation are still missing; see [blockers](../blockers/open-questions.md).


Sound research separates generated sound content from propagation. The new Web Audio lifecycle/Worklet block claims SB-AUD-C01/02 are DOC/SPEC review, not measured audio tests. The new Ledger has 68sources/66claims; the original Phase1 counts remain historical. Physical-inspired samples are perceptual, not natural vibration. See [sources and limits](interactive-sound-design.md).
