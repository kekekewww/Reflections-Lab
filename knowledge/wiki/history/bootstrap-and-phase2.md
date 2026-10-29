---
id: RLAB-KB-0019
title: 專案演進基準
type: history
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T15:49:35.117Z
sources:
  - RLAB-SRC-0001
  - RLAB-SRC-0002
  - RLAB-SRC-0003
  - RLAB-SRC-0039
  - RLAB-SRC-0062
  - RLAB-P3-SRC-0016
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - history
  - provenance
---

# 從空目錄到研究／知識工程

2026-10-26 Phase1查核目錄空、無Git／舊原型；初始化main但未commit。新增140檔案、27核心來源、64中央claims、8schemas／10ADR／8skills與原生／物理／解析spikes。這是當時快照，不代表Phase2後的檔案或Skills總數。

Phase2由使用者新需求啟動：保留已有研究，建立三層Wiki、source versions、tasks/events/claims/handoff與Emil設計工程環境。新增YAML parser與AJV相容修正會改變lockfile；Phase1[總驗證快照](../../../benchmarks/results/phase1-validation-preserved.json)保持原值，不能拿新鎖檔假裝舊run已用新版。

目前沒有證據顯示舊架構被放棄；WASM／Unity是比較方案，不可寫成已開發後失敗。新的實際操作歷史在[log](../log.md)；task開始/完成以事件與artifact時間為準，不從文件建立日推產品完成日。

Phase 2完整16命令gate已通過，Wiki50PASS/1junctionSKIP、Design14PASS、原契約30PASS；原始stdout/exit與hash保存在[Phase2 artifact](../../../benchmarks/results/phase2-validation-local.json)。Tasks3/4/5依證據結案，非正式產品／browser驗收；無前情讀取與handoff接收結果另見[情境紀錄](../../../docs/09-knowledge/SCENARIO_VALIDATION.json)。


Phase3新增[開發代理歷史](agent-runs.md)：Muse優先／Codex接手／獨立驗收、官方模型與quota研究、prompt基礎。這是開發工具；正式產品仍BACKLOG。最新使用者確認無Muse額度，Active Codex，未進行模型推論。
