# 效能研究合併與 R21 對照

日期：2026-11-02（Asia/Taipei）。狀態：**文件合併紀錄**；不改研究結論、產品程式、測試、門檻、有效 ADR 或任務狀態。執行者 Claude Code（claude-opus-5-5）。逐檔資料見[機讀對照紀錄](evidence/r21-merge-reconciliation.json)。

## 合併內容

研究分支 `review/performance-buffer-20261101`（HEAD `7502cc5`，已驗 payload `23b93b3`）以 `git merge --no-ff` 併入 `claude/meta-hack-r18-handoff-d292c8`。研究結束後，目標分支多了兩個 R21 提交：`38925e6`（程式與測試）與 `6374acf`（文件、證據與 Wiki）。研究當時目標仍有未提交的 R21，所以只備妥 Patch、沒有合併（見[整合報告](INTEGRATION_REPORT.md)）；R21 提交後，這個前提已經不存在。

衝突只出現在生成的 Wiki 索引、英文鏡像清單與 `now.md`：

- Wiki 索引與日誌由 Wiki CLI 依雙方的 events、tasks 與頁面重建。
- 英文 inventory、manifest 與 validation 重新產生。
- `now.md` 依序保留 R21、本研究、R20 與更早的歷史。
- 英文索引、日誌與任務行取雙方翻譯的聯集，再逐行對照重建後的中文頁。

研究文件本身一字未改。

## 版本界線

研究的程式事實與行號仍然指 `05d40fd`。研究引用的 73 個程式與測試檔中，有 42 個被 R21 修改；每個檔案在 `05d40fd` 的 SHA-256 與 Git blob 都記在對照紀錄裡，用 `git show 05d40fd:<path>` 可以重現研究讀到的內容。

研究在 2026-11-01T08:48Z 記錄了當時未提交的 R21 工作樹（49 個檔案）。與最後提交相比，30 個相同，19 個之後又改過：

| 檔案 | 研究讀到的版本與提交版 | 含義 |
| --- | --- | --- |
| `src/audio/control.ts`、`src/audio/routes.ts`、`src/audio/types.ts`、`src/audio/buffer-preset.ts` | 相同 | [音訊審查](AUDIO_GRAPH_DSP_REVIEW.md)第 2 節對緩衝預設、target deadband 與 listener 合併更新的讀碼，適用於已提交的 R21 |
| `src/audio/engine.ts`、`src/app/runtime.ts`、`src/interaction/interaction-host.ts` | 不同 | 研究結束後，R21 第二、三輪獨立審查與最後修正又改了 resume 失效、cursor 還原、catch-up 時間錨點、重建失敗與放置拒絕；研究沒有讀過這些版本 |
| 其餘 16 個檔案（8 個 UI 檔、2 個瀏覽器測試、6 份 R21 文件） | 不同 | 懸浮提示、尺寸欄位與測試調整，與研究的效能結論沒有直接關係 |

## R21 最後量測與研究任務

R21 最後兩輪音訊量測（headless Chrome 156、每情境 20 秒、不含擷取器）：編輯器與第一人稱走動每輪各 1 次輸出中斷（約 10～12 ms）；R20 基準分別是 19 次與 14 次。量測當下沒有保存 hash 清單；程式檔最後修改時間是 01:11（+08:00），量測約 01:54 開始，合併時 `src/` 與 `38925e6` 完全相同，所以推定量到的就是提交版（INFERRED）。研究保留的早期負面樣本（74 次與 38 次）照原樣保留。

這些結果與研究任務有關，但**沒有滿足任何驗收條件**：14 個優化任務仍是 BACKLOG、驗收條件全部未驗證，7 份提案仍是 PROPOSED。

| 研究任務 | R21 已做、可當起點的部分 | 仍缺 |
| --- | --- | --- |
| [001](../../knowledge/tasks/RLAB-TASK-PERF-20261101-001.json) 歸因與原生輸出基準 | `playbackStats` 輸出中斷計數（不支援時顯示 NOT_AVAILABLE）；`tests/browser/audio-smoothness` 量測工具有不含擷取器、`render=none`、`freezeListener=1` 與 `lookahead=0` 的對照 | 量測當下的 source 與 bundle hash、裝置與實際取樣率、受控 stall fixture、聽感；各類斷續分欄記錄 |
| [003](../../knowledge/tasks/RLAB-TASK-PERF-20261101-003.json) 原生更新分工 | 移除每個物理步重複的參數自動化（target cache 與 deadband），listener 每幀同步一次，排程餘裕只用於起始時間；未來時間排程的漸變量到退步（74 次）後撤回 | scalar、shape、delay、direction 各自的 oracle；deadband 誤差獨立報告；同負載下的收益 |
| [014](../../knowledge/tasks/RLAB-TASK-PERF-20261101-014.json) 基準與重驗 | 上述兩輪 20 秒 headless 量測 | 600 秒 profile、裝置與瀏覽器資格、lifecycle 情境、真人聽測 |
| [009](../../knowledge/tasks/RLAB-TASK-PERF-20261101-009.json) simulation Worker | 沒有做；物理仍在主執行緒 | 依研究排序，先完成 001、002、004 的歸因與資料語義 |

## 對目前文件的影響

R21 的[已知限制](../KNOWN_LIMITATIONS.md)原本寫「若真實 GPU 瀏覽器上仍卡頓，下一步是把物理模擬移到 Web Worker」。研究的排序是先歸因（001），再依數據決定錄製熱路徑（002）與原生更新（003）；simulation Worker（009）是 P2，需要 001、002、004 的證據。這次合併把該限制改成依研究排序，不再把 Web Worker 寫成預設的下一步。

## 任務證據重新釘選

[002](../../knowledge/tasks/RLAB-TASK-PERF-20261101-002.json) 與 [009](../../knowledge/tasks/RLAB-TASK-PERF-20261101-009.json) 的 evidence 釘住 `src/app/runtime.ts` 與 `src/app/bootstrap.ts` 在 `05d40fd` 的 hash；R21 改了這兩個檔案，Wiki lint 因此回報 `TASK_EVIDENCE`。Wiki CLI 只能先認領再更新，但這兩個任務的前置依賴尚未 DONE，而且認領會把 BACKLOG 改成 IN_PROGRESS、釋放後變成 READY。因此直接把這兩個 evidence 項目改指向[機讀對照紀錄](evidence/r21-merge-reconciliation.json)，紀錄裡保存原本的 hash 與 Git blob；狀態、owner、優先級、依賴與驗收條件都沒有改。

## 仍不能宣稱

- 研究的 600 秒 profile 仍是 exit 1 與 trace flush 逾時，不改成 PASS。
- R21 量測不是研究要求的受控重測，也不是裝置聽測，不能據此宣告音訊斷續已經修好。
- 合併不啟動任何 BACKLOG 任務，也不採納任何 PROPOSED 提案。
