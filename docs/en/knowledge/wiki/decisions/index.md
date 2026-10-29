<!-- english-source: {"path":"knowledge/wiki/decisions/index.md","sha256":"81b3d1edb9c337ef1845849ac5799de5d350e401286790d8e4402af05beddc47","translated_at":"2026-10-27T05:41:56.131987Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0008
title: "Effective decisions and supersession rules"
type: decision
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T18:08:03.674Z
sources:
  - RLAB-SRC-0052
  - RLAB-SRC-0053
  - RLAB-SRC-0054
  - RLAB-SRC-0055
  - RLAB-SRC-0056
  - RLAB-SRC-0057
  - RLAB-SRC-0058
  - RLAB-SRC-0059
  - RLAB-SRC-0060
  - RLAB-P3-SRC-0003
  - RLAB-P3-SRC-0004
  - SB-SRC-0011
  - SB-SRC-0014
  - SB-SRC-0015
  - SB-SRC-0001
  - SB-SRC-0037
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - decision
  - history
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/decisions/index.md`](../../../../../knowledge/wiki/decisions/index.md). Source SHA-256: `81b3d1edb9c337ef1845849ac5799de5d350e401286790d8e4402af05beddc47`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="決策保留理由與歷史"></a>
# Decisions: retaining rationale and history

The [formal ADR index](../../../02-architecture/ADR_INDEX.md) and original ADRs are the sole sources for technical decisions. Accepted in the original 10 ADRs means a preproduction engineering recommendation; it does not mean a production feature has been implemented or that the user accepted additional product scope.

| ID | Adopted content | Still unverified / reversibility |
| --- | --- | --- |
| ADR-001/002 | Historical Three approach; the Rendering part is superseded by ADR-011; Rapier fixed step | React integration pending; data contracts allow changing the view/engine |
| ADR-003/004 | Capsule FPS and bounded impulse grab | Actual wall corners / high mass ratios / CCD remain NOT RUN |
| ADR-005/006 | Bounded Web ISM + WebAudio, with native Steam as a candidate | Browser DSP unverified; individual Steam paths unsupported |
| ADR-007/008 | Versioned SI contracts, server Meta tools | Schemas do not replace domain validation; account live behavior unverified |
| ADR-009/010 | Motion trace A/B, HTTPS web deployment recommendation | Complete recorder / actual deployment not done |

New decisions must record Context/Alternatives/Decision/Rationale/Evidence/Trade-offs/Status/Superseded By/Tasks/Commits; use null when there is no commit. Supersession retains old pages and original evidence, with bidirectional supersedes links. Old and new decisions exercised in tests exist only in isolated fixtures and must not be mistaken for production architecture changes.


Phase3 added ADR-011 (a standalone project, custom Web Acoustic Core, React/R3F view direction) and ADR-012 (Codex coordination / Muse-first / independent acceptance / safe handoff), architectural revisions based on the latest confirmed requirements. Old ADR-001 retains its original text and supersession. Models and features still depend on actual evidence; adopting an ADR does not establish completion.


The current role policy is [ADR-013](../../../02-architecture/adr/013-codex-primary-development.md): Codex leads, replacing ADR-012's mandatory Muse-first / automatic switching back. The old Harness and 75tests/19gate remain Optional history, not product prerequisites. New [ADR-014](../../../02-architecture/adr/014-sound-behavior-system.md) adopts EventRules + orthogonal state + Inspector / unified propagation, with Graph at P2; production implementation is still pending.
