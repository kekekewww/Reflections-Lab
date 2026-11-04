---
id: RLAB-KB-0017
title: FPS Grab開發與驗收導覽
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-02T09:35:04.597Z
sources:
  - RLAB-SRC-0017
  - RLAB-SRC-0018-V2
  - RLAB-SRC-0021
  - RLAB-SRC-0026
  - RLAB-SRC-0027
  - RLAB-SRC-0024-V2
  - RLAB-SRC-0043
  - RLAB-SRC-0044-V2
  - SB-SRC-0003
  - V1-SRC-0088
  - V1-SRC-0090
  - V1-SRC-0095
  - PUB-V1-FPS-UX-20261102-V1-338d604e7939
  - PUB-V1-ACCEPTANCE-AMENDMENTS-20261102-V1-b6163f9c9f2c
  - V1-SOUND-UX-PREVIEW-20261102-V1
  - V1-USER-FLOWS-PREVIEW-20261102-V1
  - V1-COMPONENT-STATES-PREVIEW-20261102-V1
  - V1-UI-STRESS-PREVIEW-20261102-V1
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0028
related_decisions: []
supersedes: []
tags:
  - P0
  - FPS
  - grab
  - acceptance
  - UI
  - audio
---








# FPS Grab 情境：新Agent的最短閱讀路徑

1. [Physics Architecture](../../../docs/04-physics/PHYSICS_ARCHITECTURE.md)與[FPS Spec](../../../docs/04-physics/FPS_INTERACTION_SPEC.md)：bounded force/torque、排除held自身的shape queries、CCD限制。
2. [Input Controls](../../../docs/04-physics/INPUT_CONTROLS.md)與[FPS UX](../../../docs/05-ux/FPS_INTERACTION_UX.md)：E/G/throw/R/B、Tab焦點、IME、Esc/blur與Resume重驗。
3. [Design System](../../../docs/05-ux/DESIGN_SYSTEM.md)、[Components](../../../docs/05-ux/COMPONENT_SPEC.md)、[Emil配置](../../../docs/05-ux/EMIL_SKILLS.md)：HUD距離／阻塞／mode、錯誤恢復與有目的motion。
4. [Physics→Audio Events](../../../docs/04-physics/PHYSICS_AUDIO_EVENTS.md)與[Audio Runtime](../../../docs/02-architecture/AUDIO_RUNTIME.md)：continuous不因grab重啟、contact音在真實位置、voice caps、delay不雙算。
5. [UI Stress Matrix](../../../docs/05-ux/UI_STRESS_TESTS.md)與[驗證計畫](../../../docs/06-validation/BENCHMARK_PLAN.md)：各自測UI/physics/audio，不把Node數學當視覺測試。

驗收重點：超距不teleport、牆／薄牆／角落／高質量比不穿透、按住鍵失焦不續跑、Held切Build不暗中drop、Inspector打字不投擲、未取audio permission有可見恢復、pause截尾政策明示。view camera與measurement listener分開，FPS綁定為顯式動作。

本情境是閱讀／驗收模擬，沒有在Phase2實作Grab或宣稱browser通過。相關P0先後依賴見[正式roadmap](../../../docs/ROADMAP.md)。

## 2026-11-01 R21：滑鼠操作取代 E 與 B

依[驗收補充](../../../docs/11-v1/ACCEPTANCE_AMENDMENTS.md)，抓取改為左鍵，放下改為持有時右鍵，建造改為按住右鍵預覽、放開放置；E 與 B 只是選用捷徑，沒有使用者可見的建造模式。[第一人稱互動 UX](../../../docs/05-ux/FPS_INTERACTION_UX.md) 的輸入映射與狀態機已同步。


2026-11-02：FPS原文三處泛文與33/65明確ghost取消條款相衝突；已保全[原版](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/15a9f8dda4b2807b226d526f6174aafd83ebc5a4)及owner原FAIL比較，按已確認11/1政策精準同步[canonicalFPS](../../../docs/05-ux/FPS_INTERACTION_UX.md)。此為文件/oracle語義對齊，不改產品、不預填修正後browserPASS；[Conflict Record](../../conflicts/78d81bb5-7d39-426e-8394-8cc5838ee626.json)另記明確reconcile理由。

已reconcile：明確新條款／使用者驗收補充優先於舊泛文，原ghost保留預期撤回但原FAIL保留；新case應驗pause清preview、objectcount不變、primary只Resume不重建。原生Esc預設解鎖不另新增兩步規則。


相關Sound UX／User Flows／Component States／UI Stress四處ghost保留泛文已精準同步已確認取消政策，原exactbytes與SourceIDs另存history；[相關Conflict](../../conflicts/364713fa-a544-4c3e-a1f8-6b177c943456.json)連回已解主Conflict。Help索引沿相同canonical連結，沒有變更UI程式或製造browserPASS。

四處相關文字Conflict已reconcile：僅held/ghost語義精準對齊，原stress/設計NOT RUN與舊測試失敗保留，不代表新產品缺陷或實測通過。
