---
id: RLAB-KB-0035
title: 互動聲音設計與來源限制
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

# 音訊設計研究的可支持範圍

[成熟工具比較](../../../docs/10-sound-behaviors/SOUND_BEHAVIOR_RESEARCH.md)：FMOD2.04與MetaSounds原文已讀，Wwise現行403僅官方2017.2headers，SoundParticles按SP2/SP3分版。借鑑event／instance／parameters／DSP與position分層，不採用其SDK／UI／商業素材，不宣稱本案首創其中單項。

Rapier0.21.0官方與本地types／WASM對照；velocityAtPoint、multi-contact／world anchor、sensor events有隔離實證。接觸力不是一次Impact，point velocity為vCOM＋ω×r，旋轉支撐面還需相對參考frame；缺資料UNCLASSIFIED。來源在research/sound-behaviors，不把engine子例當真實房間／完整CCD／任意rolling證明。

Web Audio使用固定REC2021與實際API文檔；已停BufferSource不能restart，reuse buffers而非死node；Worklet讀真block長度，WD1.1不是全browser保證。callback不等physics／AI/network。產品audio／hearing未跑。

[官方規則重查](../../../docs/01-compliance/HACKATHON_RULES.md)：公開waiver10/25、codingagent條款UNSTATED，完整details/submit登入受限；Meta產品實質整合不能由MuseCode或mock替代。
