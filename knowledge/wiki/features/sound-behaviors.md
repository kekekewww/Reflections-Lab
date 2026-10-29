---
id: RLAB-KB-0034
title: Sound Behavior核心與產品前置
type: feature
status: ACCEPTED
created_at: 2026-10-26T17:52:32.289Z
updated_at: 2026-10-27T23:15:42.060Z
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
related_tasks:
  - RLAB-TASK-0010
  - RLAB-TASK-0016
related_decisions:
  - ADR-013
  - ADR-014
supersedes: []
tags:
  - P1
  - SoundBehavior
---

# Sound Behavior已實作，整體驗收中

[ADR-014架構](../../../docs/10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md)採EventRules＋正交states與Inspector優先。Physics motion、creative waveform與propagation分開；所有3D聲源走統一聲學鏈，contact不一律COM，delay／distance／HRTF只一次。Creative sample不是真實振動；gravity0不是vacuum。

正式src/audio-behavior evaluator、normalized physics/player bridge、latches、voice budgets、Web Audio與Inspector已落地。getter不推進遲滯；真Rapier moving／spin／rolling／sliding分類及contact episodes有[驗證](../../../docs/11-v1/MOTION_HYSTERESIS.md)。不支援的producer需明示capability，不以等待狀態假裝可觸發。

Task0011 M0已帶證據DONE；curve-only編輯保留binding overrides、共享profile隔離、CAS／Undo／Redo與拒絕保留草稿有31項作者回歸及固定UI bundle證據。規格仍在[canonical schema](../../../docs/10-sound-behaviors/BEHAVIOR_SCHEMA.md)，Wiki不另維護數值／tokens。

Task0012／0013仍待原完整垂直／接觸／重播與聽測criteria。Task0014有真Meta RemoveBinding／AssignBinding Host切片，不能等同5類全Live或Meta規劃Run。原Task0010研究報告是歷史基線，Graph／modal／wave進階P2未實作。[當前證據與限制](../../../docs/11-v1/SESSION_PROGRESS_20261027.md)。


2026-10-28當前028b驗證建置已有UI27（EN8／ZH13及六個聲音分項）、physics2、storage5與product4通過；產品三個fresh contexts保留0／1／2次明確overrun恢復，A與restored hash一致。原生音訊25及IRv2三項／六PCM renders通過，Inspector抑制原因、獨立靜態preview與support anchor修補已有回歸。這些不代表實際Hi-x65／D3V聽感、native桌面或性能通過；正式profile保留FAIL／負載不完整／main NOTRUN。[r10證據與限制](../../../docs/11-v1/SESSION_PROGRESS_20261028-r10.md)取代舊22ca／9ae2／r2作現況入口，原歷史收據保留。

2026-10-28後續：[r11](../../../docs/11-v1/SESSION_PROGRESS_20261028-r11.md)已保存完整pinned check／runtime917與offline benchmark PASS、production12bytes確認及全英文當時current證據；本次最後文件delta仍須重驗。原生桌面、實機聽測、正式性能與外部權利各自未完成，既有分項證據不擴張。

2026-10-28正式續報：[active-rule實作](../../../artifacts/v1/active-rule-production-20261028/implementation-summary.json)已接入publication，原完整snapshot保留，931項currentruntime及TSC／lint／formatPASS；當前browser／build／完整品質與正式性能仍另驗。Source36的unapplied候選屬前一截點，未將operationcount升格速度主張。

2026-10-28 r12：[當前功能驗證](../../../artifacts/v1/active-rule-integration-20261028/current-functional-summary.json)已完成931runtime、26Vite與physics2/storage5/product4；UI27之相同12localbundle核對保留其截點。原完整snapshot不變；正式效能、原生與聽測未升格，詳見r12。
