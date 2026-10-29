---
id: RLAB-KB-0036
title: Sound Behavior draft與風險spike驗證
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

# 限定範圍的可重現證據

Draft contracts分項21/21、5組CLIfixtures；Physics policy13/13、真WASM API3/3。獨立review重現並修正effective-enabled、有限one-shot／latch、material override選中generator、asset pins、collider身份、rotating support等問題；參見[審查](../../../docs/10-sound-behaviors/INDEPENDENT_REVIEW.md)。根整合回歸另由[報告](../../../docs/10-sound-behaviors/SOUND_BEHAVIOR_REPORT.md)列raw results，不把作者自述替代exit/stdout。

[驗證計畫](../../../docs/10-sound-behaviors/SOUND_BEHAVIOR_VALIDATION.md)明列PASS／FAIL／NOTRUN；schema/domain與isolated Derived/Tuned policy不是正式Runtime。Asset fixtures標FIXTURE_ONLY，不能拿fakehash當可播放素材／Measured。

Browser／OfflineAudioContext／HRTF／arrival／click-pop／underrun／聽測／完整capture／Meta live皆NOTRUN。v1只驗目前revision；Apply需pause/fade/drain／新epoch，尚無retired-profile多版本無縫切換。acoustic A/B固定signal；behavior A/B可改明示生成參數、仍固定rawphysics/motion/listener/solver，不能混用。
