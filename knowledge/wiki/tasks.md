---
id: RLAB-KB-0006
title: 任務索引
type: tasks
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T15:35:00.435Z
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
<!-- wiki:generated:end -->
