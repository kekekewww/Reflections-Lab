---
name: agent-orchestration
description: 管理 Reflection Lab Codex主導的任務、驗收與checkpoint；只在明確選用時使用舊跨Agent Harness，維持Wiki Task唯一權威。
---

# 開發代理調度

## Trigger / Inputs

執行可驗收milestone或恢復task。一般使用Wiki Task、正式規格、Git scope、資源限制與handoff；只有選用舊Harness才需它的TaskContract／RunState。新政策見docs/02-architecture/adr/013-codex-primary-development.md。

## Workflow

1. 依 AGENTS startup 查 task／依賴／有效 ADR；先讀 run state、最近 handoff 與實檔，不建立第二套 Task backlog，不重跑已完成工作。
2. 正常由Codex直接規劃與實作，獨立tests／reference／review驗收。舊Harness為Optional，明確選用時才查`node scripts/agents/cli.mjs help`；其Muse預設不是專案預設。未配置付費run上限時維持0、未知quota為null；依docs/09-agents/RESOURCE_STATUS.json讀最新帶來源觀察，已確認耗盡仍停派。
3. 派送前凍結 acceptance／protected files 與 scope；同工作區只有一個 executor。以 session／run／Git snapshots 保存模型與修改來源。
4. 若選用Muse，沿用detector錯誤分類與有界backoff；確認原writer停止才交接。一般Codex工作不為此建立多餘跨Agent切換。
5. 延續 task／goal／milestone／Git state／原 acceptance。凍結 tests 由獨立程序執行，失敗進有限 repair，兩個 executor 都不可用則 BLOCKED 並停止資源消耗。
6. Muse恢復不使專案自動切回；只有再選用該工具時才在安全邊界切換，保留歷史。重要成果由既有Wiki protocol更新與交接。

## Completion / Failure Handling

完整權威見 docs/09-agents/CODEX_MUSE_ORCHESTRATION.md、FAILURE_RECOVERY.md。開發 quota 與產品 Meta API quota 分帳；產品 credit耗盡可跑 mock／offline，但 live tests 保持 BLOCKED／NOT RUN。無可靠獨立 Codex process 時使用現有 orchestrator 接手，不遞迴呼叫自身 session，不自動提高預算或換帳號。
