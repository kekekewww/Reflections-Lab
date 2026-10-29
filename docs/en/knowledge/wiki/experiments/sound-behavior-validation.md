<!-- english-source: {"path":"knowledge/wiki/experiments/sound-behavior-validation.md","sha256":"056205a851f64688695bc7599bbdd12260d78c9f4f54e9a23acfe79d8ceb5880","translated_at":"2026-10-27T05:42:10.929391Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0036
title: "Sound Behavior draft and risk spike validation"
type: experiment
status: VERIFIED
created_at: 2026-10-26T17:52:32.290Z
updated_at: 2026-10-26T18:08:15.675Z
sources:
  - SB-SRC-0001
  - SB-SRC-0017
  - SB-SRC-0019
  - SB-SRC-0023
  - SB-SRC-0028
  - SB-SRC-0029
  - SB-SRC-0030
  - SB-SRC-0032
  - SB-SRC-0033
  - SB-SRC-0038
  - SB-SRC-0040
  - SB-SRC-0041
  - SB-SRC-0042
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
> English translation of [`knowledge/wiki/experiments/sound-behavior-validation.md`](../../../../../knowledge/wiki/experiments/sound-behavior-validation.md). Source SHA-256: `056205a851f64688695bc7599bbdd12260d78c9f4f54e9a23acfe79d8ceb5880`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="限定範圍的可重現證據"></a>
# Reproducible evidence within a limited scope

Draft contracts passed 21/21 component cases and 5 CLI fixture sets; Physics policy passed 13/13, and the real WASM API passed 3/3. Independent review reproduced and fixed issues with effective-enabled, bounded one-shot/latch, material overrides selecting the generator, asset pins, collider identity and rotating support; see the [review](../../../10-sound-behaviors/INDEPENDENT_REVIEW.md). The [report](../../../10-sound-behaviors/SOUND_BEHAVIOR_REPORT.md) separately lists raw results for root integration regression; author statements do not replace exit/stdout.

The [validation plan](../../../10-sound-behaviors/SOUND_BEHAVIOR_VALIDATION.md) explicitly lists PASS / FAIL / NOTRUN. Schema/domain and isolated Derived/Tuned policy are not the production Runtime. Asset fixtures are labeled FIXTURE_ONLY; fakehash cannot stand in for playable media or Measured provenance.

Browser / OfflineAudioContext / HRTF / arrival / click-pop / underrun / listening tests / complete capture / Meta live are all NOTRUN. v1 validates only the current revision; Apply requires pause/fade/drain / a new epoch, and seamless switching across multiple retired-profile versions is not available. Acoustic A/B fixes the signal; behavior A/B may change explicitly stated generation parameters while still fixing rawphysics/motion/listener/solver. The two must not be mixed.
