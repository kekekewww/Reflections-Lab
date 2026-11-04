<!-- english-source: {"path":"knowledge/wiki/features/sound-behaviors.md","sha256":"7520ea8e3643a1726b995ac9acceb4974acc9908f4ad5f53faf191791089b357","translated_at":"2026-11-02T09:59:47.9971465+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0034
title: "Sound Behavior core and product prerequisites"
type: feature
status: ACCEPTED
created_at: 2026-10-26T17:52:32.289Z
updated_at: 2026-11-02T09:18:38.632Z
sources:
  - SB-SRC-0001
  - SB-SRC-0002
  - SB-SRC-0003
  - SB-SRC-0004
  - SB-SRC-0005
  - SB-SRC-0006
  - SB-SRC-0007
  - SB-SRC-0008
  - SB-SRC-0009
  - SB-SRC-0010
  - SB-SRC-0011
  - SB-SRC-0012
  - SB-SRC-0013
  - SB-SRC-0015
  - SB-SRC-0016
  - SB-SRC-0017
  - SB-SRC-0018
  - SB-SRC-0020
  - SB-SRC-0021
  - SB-SRC-0027
  - SB-SRC-0043
  - SB-SRC-0032
  - SB-SRC-0034
  - SB-SRC-0035
  - SB-SRC-0036
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0015
  - V1-SRC-0025
  - V1-SRC-0031
  - V1-SRC-0038
  - V1-SRC-0039
  - SB-ZONE-SCHEMA-20261102-V1
  - SB-ZONE-TYPES-20261102-V1
related_tasks:
  - RLAB-TASK-0010
  - RLAB-TASK-0016
  - RLAB-TASK-0028
  - RLAB-TASK-0029
related_decisions:
  - ADR-013
  - ADR-014
supersedes: []
tags:
  - P1
  - SoundBehavior
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/features/sound-behaviors.md`](../../../../../knowledge/wiki/features/sound-behaviors.md). Source SHA-256: `7520ea8e3643a1726b995ac9acceb4974acc9908f4ad5f53faf191791089b357`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior已實作整體驗收中"></a>
# Sound Behavior implemented; overall acceptance in progress

The [ADR-014 architecture](../../../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md) uses EventRules plus orthogonal states and prioritizes the Inspector. Physics motion, creative waveform and propagation are separate. All 3D sources use one acoustic chain; contact positions are not always COM, and delay/distance/HRTF are applied only once. A creative sample is not real vibration; gravity0 is not vacuum.

The production src/audio-behavior evaluator, normalized physics/player bridge, latches, voice budgets, Web Audio and Inspector are implemented. Getters do not advance hysteresis. Real Rapier moving/spin/rolling/sliding classification and contact episodes have [validation](../../../11-v1/MOTION_HYSTERESIS.md). Unsupported producers must state their capabilities explicitly rather than using a waiting state to pretend they can trigger.

Task0011 M0 is DONE with evidence. Curve-only editing retains binding overrides, isolates shared profiles, supports CAS/Undo/Redo and retains drafts after rejection, with 31 author regression checks and evidence from a fixed UI bundle. The specification remains in the [canonical schema](../../../10-sound-behaviors/BEHAVIOR_SCHEMA.md); Wiki does not separately maintain values/tokens.

Task0012/0013 still await the original complete vertical/contact/replay and listening-test criteria. Task0014 has a real Meta RemoveBinding/AssignBinding Host slice; this does not establish that all 5 categories are Live or that Meta planned a Run. The original Task0010 research report is a historical baseline; advanced P2 Graph/modal/wave features are not implemented. See [current evidence and limits](../../../11-v1/SESSION_PROGRESS_20261027.md).


The current 028b validation build on 2026-10-28 has passed UI27 (EN8/ZH13 and six Sound component checks), physics2, storage5 and product4. The three fresh product contexts retain 0/1/2 explicit overrun recoveries, and A and restored hashes match. The 25 native audio checks and three IRv2 checks / six PCM renders passed. Regression evidence exists for Inspector suppression reasons, independent static preview and the support anchor fix. These results do not establish actual Hi-x65/D3V listening impressions, native desktop or performance acceptance; the formal profile retains FAIL / incomplete workload / main NOTRUN. [r10 evidence and limits](../../../11-v1/SESSION_PROGRESS_20261028-r10.md) replaces old 22ca / 9ae2 / r2 as the current-state entry point; original historical receipts remain.

2026-10-28 follow-up: [r11](../../../11-v1/SESSION_PROGRESS_20261028-r11.md) retains the complete pinned check / runtime917 and offline benchmark PASS, production12bytes confirmation, and evidence that the full English version was current at that time; this final documentation delta still requires revalidation. Native desktop, on-device listening tests, formal performance and external rights remain individually unfinished; existing component evidence is not broadened.

2026-10-28 production follow-up: the [active-rule implementation](../../../../../artifacts/v1/active-rule-production-20261028/implementation-summary.json) is integrated into publication, retaining the original complete snapshot. The 931 currentruntime checks and TSC/lint/format have PASS results; current browser/build/full quality and formal performance still require separate validation. Source36's unapplied candidate belongs to an earlier cutoff; operationcount has not been promoted into a speed claim.

2026-10-28 r12: [current functional validation](../../../../../artifacts/v1/active-rule-integration-20261028/current-functional-summary.json) completed 931runtime, 26Vite and physics2/storage5/product4. The check of the same 12 local bundles for UI27 retains its original cutoff. The original complete snapshot is unchanged; formal performance, native checks and listening tests have not been promoted to a higher validation status. See r12 for details.

<!-- english-original-anchor --> <a id="2026-11-02zone資料與真producer已合入整合驗收中"></a>
## 2026-11-02: Zone data and real producer merged; integration acceptance in progress

The latest user request requires implementing visible unsupported options. Task0029 connects optional Scene zones and explicit OnEnterZone/OnExitZone.zoneId to atomic authoring commands, real Rapier fixed-step body-center sampling, shared capabilities/AI/Host/Preview and recording/replay. Missing zones does not inject [], preserving legacy bytes/hashes. Count/hysteresis/event-capacity and sampling limits are in the [pinned Zone synthesis](../../../15-ui-parameter-audit/ZONE_IMPLEMENTATION_20261102.md). Source 12786 merged into d9. Basic authoring-Domain/schema and real-producer conditions are verified; actual ZoneUI/WAV, Curves integration and whole-product Task0028 remain unclosed. Old research/original Node/human/science/performance/Meta-live results retain their scopes; new capabilities do not rewrite old PASS results.

Sound schema/types add optional zoneId and actual-event identity. Product zone triggers require explicit IDs from a trusted registry; legacy non-zone data receives no field. New source versions supersede the current SB-SRC-0032/0034 schema/types versions. Exact old bytes from pre-Zone Git are saved as the [original schema](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3a6c6b052eb70f10b9814c11663b8103d4ac3ed7) and [original types](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a10aebfbac503bf3b035556dc804d8581acdc593), without replacing historical hashes or claiming new scientific validation.
