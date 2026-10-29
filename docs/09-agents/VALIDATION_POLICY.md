# 獨立驗收與完成條件

實作者可以執行自測並輸出 ImplementationResult，但不能決定 task DONE。驗收由 Orchestrator 在實作前指定並固定，runner 以獨立子程序重跑；結果保存 command／exit／stdout／stderr／duration／script hash／run ID／Git revision。Acceptance runner 與實作函式不能同用未驗證程式產生 expected 與 actual。

Protected scripts／fixtures／contracts 的 hash 在前後檢查；任何變更或 scope 以外修改先停止。若正式驗收本身有缺陷，需獨立 review、新 contract version／理由／來源，不允許實作者原地刪測試或降低 tolerance。此為意外變更防護，具相同 OS 權限的惡意程序仍可能破壞控制資料，不能稱 cryptographic sandbox。

Verification failure 建立可重現 RepairTask，列 expected／actual、defects、allowed scope 和原驗收；預設單缺陷最多三輪，亦受總時間／attempts 限制。資源耗盡、同問題持續失敗、權限不足、spec 衝突時 BLOCKED；不無限循環。模型宣稱成功、exit 0、漂亮 UI 都不能略過原測試。

正式 frontend 要有 typecheck／lint／component／interaction／visual；physics 要有 deterministic fixtures／modes／contacts／CCD；acoustics 要有解析幾何／delay／energy／path IDs／numerical tolerances；audio 要有 offline graph／arrival／continuity／voice cleanup 與裝置聽測。每項按實際執行程度標 PASS／FAIL／BLOCKED／NOT RUN，不能用本階段 Node fixture 代替 browser／耳機測試。

## 本階段驗證層

- Mock subprocess：12 種 failover／repair／恢復情境與故障注入，證明 Harness 的控制邏輯。
- Muse echo：安裝版本的 CLI／JSONL／terminal events，不是 Muse 模型實作。
- 現有 Codex Orchestrator：可依 handoff 修改隔離 fixture，runner 獨立驗證；必須有實際 artifact 才列實證。
- 模型 Prompt eval：離線 fixture 只驗證測試基礎；task success／latency／tokens／cost 對真模型尚未知。
- 原 core／physics／Wiki／design regression：保留原 fixture／tolerance，新增工具不能破壞舊結果。
- 隔離 code review：獨立 Agent 提出有重現的問題並核對修復；不是產品 live／物理實驗證據。

遠端 CI 已配置 workflow 不等於已執行；完整 raw results、gate／skip 及版本範圍由 [Phase3 報告](PHASE3_REPORT.md) 索引。
