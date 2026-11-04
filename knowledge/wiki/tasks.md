---
id: RLAB-KB-0006
title: 任務索引
type: tasks
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-04T02:22:09.811Z
sources:
  - RLAB-SRC-0002
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P0
  - tasks
---

# 任務與認領

唯一權威是 `knowledge/tasks/<ID>.json`，以下只是生成視圖。BACKLOG/READY/IN_PROGRESS/BLOCKED/DONE/CANCELLED不代表相同證據層級；DONE必須每個criterion與artifact可追溯。

claim/heartbeat/release透過CLI，過期lease不自動搶鎖。跨機／worktree沒有共享鎖，先分檔再Git reconcile；不要以最後寫入者覆蓋。未授權的正式產品工作維持後續task。

<!-- wiki:generated:start -->
- [RLAB-TASK-0001: Phase1研究與驗證基礎](../tasks/RLAB-TASK-0001.json) — DONE / P0 / 未認領
- [RLAB-TASK-0002: Steam Audio原生隔離可行性](../tasks/RLAB-TASK-0002.json) — DONE / P1 / 未認領
- [RLAB-TASK-0003: 建立持久Wiki工具與證據協定](../tasks/RLAB-TASK-0003.json) — DONE / P0 / 未認領
- [RLAB-TASK-0004: 固定Emil Skills與設計工程標準](../tasks/RLAB-TASK-0004.json) — DONE / P0 / 未認領
- [RLAB-TASK-0005: 跨Agent入口與無對話交接](../tasks/RLAB-TASK-0005.json) — DONE / P0 / 未認領
- [RLAB-TASK-0006: P0-01場景與固定步物理骨架](../tasks/RLAB-TASK-0006.json) — DONE / P0 / 未認領
- [RLAB-TASK-0007: 核實參賽條件與Meta帳號存取](../tasks/RLAB-TASK-0007.json) — BLOCKED / P1 / 未認領
- [RLAB-TASK-0008: Phase3開發Harness與自動Executor接手](../tasks/RLAB-TASK-0008.json) — DONE / P0 / 未認領
- [RLAB-TASK-0009: Harness Live模型與安全程序隔離驗證](../tasks/RLAB-TASK-0009.json) — CANCELLED / P2 / 未認領
- [RLAB-TASK-0010: Sound Behavior研究、契約與架構整合](../tasks/RLAB-TASK-0010.json) — DONE / P0 / 未認領
- [RLAB-TASK-0011: M0 Audio Event Runtime](../tasks/RLAB-TASK-0011.json) — DONE / P0 / 未認領
- [RLAB-TASK-0012: Sound P0垂直整合](../tasks/RLAB-TASK-0012.json) — BLOCKED / P0 / 未認領
- [RLAB-TASK-0013: Sound P1互動、接觸與Behavior A/B](../tasks/RLAB-TASK-0013.json) — BACKLOG / P1 / 未認領
- [RLAB-TASK-0014: 產品Muse Sound Behavior真實工具切片](../tasks/RLAB-TASK-0014.json) — BACKLOG / P0 / 未認領
- [RLAB-TASK-0015: P2 Behavior Graph與進階合成](../tasks/RLAB-TASK-0015.json) — BACKLOG / P2 / 未認領
- [RLAB-TASK-0016: 第一版完整產品整合與獨立驗收](../tasks/RLAB-TASK-0016.json) — BACKLOG / P0 / 未認領
- [RLAB-TASK-0017: FPS／Build／物理接觸邊界驗收](../tasks/RLAB-TASK-0017.json) — DONE / P0 / 未認領
- [RLAB-TASK-0018: 聲學Worker與即時路由證據](../tasks/RLAB-TASK-0018.json) — DONE / P1 / 未認領
- [RLAB-TASK-0019: 錄放與資產產品整合驗收](../tasks/RLAB-TASK-0019.json) — DONE / P1 / 未認領
- [RLAB-TASK-0020: 瀏覽器／效能與完整乾淨啟動驗收](../tasks/RLAB-TASK-0020.json) — BLOCKED / P0 / 未認領
- [RLAB-TASK-0021: 獨立 Worktree 架構研究、整合與公開發佈](../tasks/RLAB-TASK-0021.json) — DONE / P0 / 未認領
- [RLAB-TASK-0022: R18 真人回報工程修補：第一人稱、場景直接操作與預設音量](../tasks/RLAB-TASK-0022.json) — BLOCKED / P0 / 未認領
- [RLAB-TASK-0023: 六項核心實作、基本驗證與本地整合](../tasks/RLAB-TASK-0023.json) — BLOCKED / P0 / 未認領
- [RLAB-TASK-0024: 共用產品能力與最小靜態支撐Bounce核心](../tasks/RLAB-TASK-0024.json) — DONE / P1 / 未認領
- [RLAB-TASK-0025: Meta既有工具UI閉環核心](../tasks/RLAB-TASK-0025.json) — DONE / P1 / 未認領
- [RLAB-TASK-0026: Motion authoring與SetTrajectory有限核心](../tasks/RLAB-TASK-0026.json) — DONE / P1 / 未認領
- [RLAB-TASK-0027: 30秒16輸出短take mix與object stems核心](../tasks/RLAB-TASK-0027.json) — DONE / P1 / 未認領
- [RLAB-TASK-0028: 全產品UI參數真實操作盤點、邊界驗證與缺陷修復](../tasks/RLAB-TASK-0028.json) — DONE / P0 / 未認領
- [RLAB-TASK-0029: 區域作者設定與真固定步ZoneEnter/Exit能力](../tasks/RLAB-TASK-0029.json) — DONE / P0 / 未認領
- [RLAB-TASK-0030: 曲面聲學材質／角色與真動態反射能力](../tasks/RLAB-TASK-0030.json) — DONE / P0 / 未認領
- [RLAB-TASK-0031: 正式Project環境參數持久化與載入原子修復](../tasks/RLAB-TASK-0031.json) — DONE / P0 / 未認領
- [RLAB-TASK-0032: 非進階候選完整實作、雙方法UI驗證與Claude交接](../tasks/RLAB-TASK-0032.json) — READY / P0 / 未認領
- [RLAB-TASK-0033: 以四種可切換頂列監測取代三步導覽](../tasks/RLAB-TASK-0033.json) — READY / P1 / 未認領
- [RLAB-TASK-0034: 軌跡編輯器 hackathon MVP](../tasks/RLAB-TASK-0034.json) — READY / P1 / 未認領
- [RLAB-TASK-PERF-20261101-001: 建立音訊斷續歸因與native output基準](../tasks/RLAB-TASK-PERF-20261101-001.json) — BACKLOG / P0 / 未認領
- [RLAB-TASK-PERF-20261101-002: 研究並驗證錄製逐tick有界evaluation lane](../tasks/RLAB-TASK-PERF-20261101-002.json) — BACKLOG / P0 / 未認領
- [RLAB-TASK-PERF-20261101-003: 分離native scalar／shape／delay／direction更新壓力](../tasks/RLAB-TASK-PERF-20261101-003.json) — BACKLOG / P0 / 未認領
- [RLAB-TASK-PERF-20261101-004: 釐清latest-valid acoustic snapshot與pending event交換](../tasks/RLAB-TASK-PERF-20261101-004.json) — BACKLOG / P1 / 未認領
- [RLAB-TASK-PERF-20261101-005: 量測geometry／payload成本與revision快取、transfer候選](../tasks/RLAB-TASK-PERF-20261101-005.json) — BACKLOG / P1 / 未認領
- [RLAB-TASK-PERF-20261101-006: 研究保留phase的voice virtualization與資源admission](../tasks/RLAB-TASK-PERF-20261101-006.json) — BACKLOG / P1 / 未認領
- [RLAB-TASK-PERF-20261101-007: 在既有asset store內研究pinning、eviction與decode staging](../tasks/RLAB-TASK-PERF-20261101-007.json) — BACKLOG / P1 / 未認領
- [RLAB-TASK-PERF-20261101-008: 研究無損chunk encode／storage及seal copy所有權](../tasks/RLAB-TASK-PERF-20261101-008.json) — BACKLOG / P1 / 未認領
- [RLAB-TASK-PERF-20261101-009: 隔離研究dedicated simulation worker](../tasks/RLAB-TASK-PERF-20261101-009.json) — BACKLOG / P2 / 未認領
- [RLAB-TASK-PERF-20261101-010: 選用custom PCM／AudioWorklet adapter可行性與等價研究](../tasks/RLAB-TASK-PERF-20261101-010.json) — BACKLOG / P2 / 未認領
- [RLAB-TASK-PERF-20261101-011: 驗證短take離線renderer與chunk state carry](../tasks/RLAB-TASK-PERF-20261101-011.json) — BACKLOG / P2 / 未認領
- [RLAB-TASK-PERF-20261101-012: 評估GPU／高階反射／多listener與能源收益](../tasks/RLAB-TASK-PERF-20261101-012.json) — BACKLOG / P3 / 未認領
- [RLAB-TASK-PERF-20261101-013: 選用雲端長job與資源／成本admission研究](../tasks/RLAB-TASK-PERF-20261101-013.json) — BACKLOG / P2 / 未認領
- [RLAB-TASK-PERF-20261101-014: 兩階段lifecycle／裝置與長run驗證](../tasks/RLAB-TASK-PERF-20261101-014.json) — BACKLOG / P0 / 未認領
- [RLAB-TASK-PERF-20261101-REVIEW: 效能與緩衝架構獨立研究審查（僅研究交付）](../tasks/RLAB-TASK-PERF-20261101-REVIEW.json) — DONE / P0 / 未認領
<!-- wiki:generated:end -->
