<!-- english-source: {"path":"knowledge/wiki/research/interactive-sound-design.md","sha256":"d899658780a3a263a3572cc8d9e510913e88c4eebafc7f249f4141f36af51deb","translated_at":"2026-10-27T03:44:07.128220Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0035
title: Interactive sound design and source limitations
type: research
status: VERIFIED
created_at: 2026-10-26T17:52:32.290Z
updated_at: 2026-10-26T17:53:30.407Z
sources:
  - SB-SRC-0001
  - SB-SRC-0022
  - SB-SRC-0023
  - SB-SRC-0024
  - SB-SRC-0025
  - SB-SRC-0026
related_tasks:
  - RLAB-TASK-0010
related_decisions:
  - ADR-013
  - ADR-014
supersedes: []
tags:
  - P1
  - SoundBehavior
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/research/interactive-sound-design.md`](../../../../../knowledge/wiki/research/interactive-sound-design.md). Source SHA-256: `d899658780a3a263a3572cc8d9e510913e88c4eebafc7f249f4141f36af51deb`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="音訊設計研究的可支持範圍"></a>
# What audio design research can support

[Comparison of mature tools](../../../10-sound-behaviors/SOUND_BEHAVIOR_RESEARCH.md): original FMOD2.04 and MetaSounds documentation was read. Current Wwise access returned 403, so only official 2017.2headers were available; SoundParticles is separated into SP2/SP3 versions. The research draws on event/instance/parameters/DSP and position layers without adopting their SDKs/UI/commercial assets or claiming this project invented any individual element.

Rapier0.21.0 official materials were compared with local types/WASM. velocityAtPoint, multi-contact/world anchor, and sensor events have isolated empirical evidence. Contact force is not a single Impact. Point velocity is vCOM＋ω×r, and rotating support surfaces also require a relative reference frame. Missing data yields UNCLASSIFIED. Sources are in research/sound-behaviors; engine subcases are not evidence of real-room behavior, complete CCD, or arbitrary rolling.

Web Audio uses the pinned REC2021 and actual API documentation. A stopped BufferSource cannot restart; reuse buffers rather than dead nodes. Worklet reads the actual block length; WD1.1 is not a guarantee across all browsers. The callback does not wait for physics/AI/network. Product audio/hearing tests have not run.

[Official rules recheck](../../../01-compliance/HACKATHON_RULES.md): public waiver10/25, codingagent terms UNSTATED, and full details/submit restricted by login. MuseCode or mocks cannot substitute for substantive Meta integration in the product.
