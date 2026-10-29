# ADR-012：Codex 統籌、Muse 優先與安全自動接手

> **2026-10-27：角色與強制Muse優先政策已由 [ADR-013](013-codex-primary-development.md) 取代。** 下文保留Phase3歷史；Harness為Optional，獨立驗收／互斥／預算原則保留，不能當目前產品工作的前置關卡。

- 狀態：Accepted，2026-10-26；實作與測試證據見 [Phase3 報告](../../09-agents/PHASE3_REPORT.md)。
- Decision：Preferred Executor=Muse Code，Fallback Executor=Codex，Orchestrator=Codex；Verification Authority=預先固定的 independent automated runner／領域 reference，必要時加隔離 review agent。驗收缺口必須保留，不以同一實作者的自評取代。
- Task authority：`knowledge/tasks/*.json` 仍是唯一工作權威。Task Contract 固定 scope／acceptance／budget，run state 保存 PENDING、ASSIGNED_MUSE、RUNNING_MUSE、MUSE_QUOTA_EXHAUSTED、HANDOFF_PENDING、ASSIGNED_CODEX、RUNNING_CODEX、VERIFYING、REPAIR_REQUIRED、COMPLETED、BLOCKED；Wiki task 的宏觀 BACKLOG…DONE 不另行改成另一套競爭的清單。`agent_execution` 是有 run artifact 引用的細部投影。
- State preservation：同一 task_id／milestone_id／goal_id、固定 contract hash、驗收 hash、Git revision／工作區內容與 diff、成功 checkpoint、剩餘工作與模型／CLI 來源延續。完成項目不重跑實作；驗證可以為新修改重新執行。無 HEAD 也要保存 untracked 內容 hash。
- Failover：對可恢復 429／暫時故障做有限 backoff，尊重 Retry-After 與時間預算；明確訂閱耗盡／帳單證據與未知值分開。401／403 不叫額度耗盡；未知錯誤 fail closed。先停止派送，確認原 writer 停止，保存，再指定下一 executor；不能證明 process containment 時 BLOCKED，不能冒險重疊。
- Codex adapter：預設由現有 Orchestrator 進入 Implementation Mode，讀 handoff 後修改剩餘 scope，再向 runner 提交完成訊號；runner 另行驗收。此訊號不是驗收成功。獨立 Codex CLI process 需另外驗證 session／sandbox，不假設能調用自身 chat。
- Switchback：Muse 恢復只更新 resource evidence；目前 task 完成或已證明無 writer 的安全 checkpoint 才切回。保留 sticky executor／切換限制，不因每次 quota poll 反覆切換。
- Budget：開發訂閱、開發 Meta API、Codex usage、產品 Meta runtime 四個維度分離；未知剩餘量為 null。金額預設 0，不提額、不換帳號、不自動買 credits。手動觀察只記來源與時間，不能冒充即時 API 查詢。
- Product runtime：模型／工具 provider 保持 Meta；mock／recorded responses 明示 provenance，live tests BLOCKED／NOT RUN。改 coding executor 不改產品模型，也不能用 Codex 輸出充當 Meta 驗證。
- Isolation：已有 HEAD 時由操作者準備 worktree；無 HEAD 時使用明確的隔離 fixture 目錄與內容 snapshots，不偷偷 commit／reset 以建立 worktree。Harness cooperative lock 不是惡意程序隔離，OS sandbox 仍必要。
- Alternatives：遞迴啟動自己的 Codex chat（未驗，不採用）；所有錯誤叫 quota（誤判，不採用）；只寫政策無 runner（不滿足需求）；放寬失敗測試（禁止）。
- 限制：真正 Muse 模型輸出、可計費 API、完整產品 UI／physics／audio E2E 與遠端 CI，只有實際執行才能標 PASS。Mock runner 證明控制流程，CLI echo 證明離線協定，兩者不能證明模型品質或 live failover。
