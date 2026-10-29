# Automatic Agent Failover：最新使用者需求紀錄

來源：2026-10-26 本次使用者指示；此為需求摘錄與穩定驗收編號，非模型研究或測試證據。與 [Phase3 原始附件](PHASE3_REQUEST.md) 共同適用；衝突以本次 failover 要求優先。沒有授權正式產品全面實作、提高付費上限、換帳號或 push。

| ID | 已授權要求 |
| --- | --- |
| FR-01 | 正常為 Codex Orchestrator → Muse Code implementation → Codex verification；Muse 不可用時由 Codex 接手並接受獨立驗證。 |
| FR-02 | 區分 Muse subscription、產品 Meta API credit、429、insufficient balance／quota、outage、authentication／permission、Codex usage。沒有可靠資訊時留 unknown，不能造數字。 |
| FR-03 | 暫時性 429 先有界 retry／backoff，超出原預算才 fallback；不得提額、繞限制或換未授權帳號。 |
| FR-04 | 停止派送及原 writer，保存 redacted session log／Git diff／checkpoint／未完成內容；先檢視部分修改，再接手，不重作完成工作。 |
| FR-05 | 保持 Task、Milestone、Git state 與 `/goal` 的關聯；不能宣稱 runner 能直接調用正在執行的自己 Session。 |
| FR-06 | 原 Acceptance Criteria／tests／benchmark 不得刪除或放寬；以預建驗收、deterministic benchmark、獨立 runner／reference／review 判定，缺少獨立面要標限制。 |
| FR-07 | Run State 包含 PENDING／ASSIGNED_MUSE／RUNNING_MUSE／MUSE_QUOTA_EXHAUSTED／HANDOFF_PENDING／ASSIGNED_CODEX／RUNNING_CODEX／VERIFYING／REPAIR_REQUIRED／COMPLETED／BLOCKED。 |
| FR-08 | 每個 task run 保存 preferred／actual／previous executor、fallback reason、model／CLI、成功 checkpoint、Git revision、modified files、完成 criteria、remaining work、verification evidence、resource usage。 |
| FR-09 | Codex 也不可用時保存並 BLOCKED；Muse 恢復只在 task／安全 checkpoint 邊界切回，避免反覆切換與並行 writer。 |
| FR-10 | 開發 quota 與產品 Meta API quota 分開；可做 mock／recorded responses／offline fixture，但不能稱 Meta live 輸出，不能用 Codex API 替代 Meta 後聲稱驗證通過。 |
| FR-11 | 實際建立 detector、router、fallback adapter、checkpoint/resume、handoff serializer、budget manager、event logger、status CLI，並整合現有 Task／Wiki，不另建矛盾任務系統。 |
| FR-12 | 至少驗證正常、429、quota、部分修改失敗、Codex 接手、原測試通過、repair、Muse 恢復、雙 executor 不可用、Wiki/Git provenance、冪等／互斥、產品 API 耗盡離線測試等12情境；Mock 與 Live 分開。 |

完成報告必須列實際觸發、已驗 quota 能力、接手方法、Mock／Live 結果、未解限制與可執行命令。文件宣稱不算功能實作；實際行為看程式與可重現測試。使用者指示保留 Git／Wiki 紀錄，但既有 checkout 無 HEAD 的事實不能改寫成先前存在的 commit。

## 本次執行中的最新資源指示

2026-10-26 使用者明確告知：「目前沒有任何Muse額度可以使用」。因此開發 MUSE 狀態改為 **exhausted / USER_CONFIRMED**，可用開發額度0；這是使用者確認，不是假稱 usage API 成功讀值。停止派送 Muse 模型任務，現有 Codex 接續本階段實作與驗收。Preferred=MUSE 保留，Active=CODEX；恢復需新而可信的 observation，且只在安全任務邊界切回。

產品 Meta Model API 的帳單／credits 不由這句話推算，維持獨立未知／live NOT RUN。本階段不呼叫任何付費 Muse／Meta 模型、不增加付費上限。Mock registry 不得覆蓋這份真實資源狀態。
