# 階段 01：有界錄製評估與 A/B 重算核心

日期：2026-11-02（台北）。實作基準：`429efb7597ec913bd879ecc05c29a6be7ad5175c`；分支：`codex/pipeline-recording`。Executor：Codex recording_core；隔離測試與對抗檢查由 evaluation_test_design 子代理執行。這是本階段工程證據，不是完整 V1、性能門檻或裝置聽測結案。

## 已實作

- `RecordingEvaluationLane` 接納完整、不可變的同 tick frame 與 AcousticRequest 快照，保存連續 tick、epoch、revision、事件順序、Behavior 前後狀態與聲源游標。只有同 tick 求解結果通過 schema／身分檢查後才提交 recorder。
- 佇列預設最多 8 個 frame、32 MiB 保留容量，包含執行中項目、輸入 bytes 及有上限的回覆容量。高水位在已接納 tick 邊界暫停 producer，降到低水位後才允許繼續。單一輸入或下一筆無法容納時明確中斷，不丟已接納項目或偽稱完整錄製。這不是總 JS heap、GC 暫存或零複製保證。
- 專用 module Worker 執行錄製聲學求解及有狀態的 `RecordingProcessor` A/B 重算。聲學公式、品質參數、錄製格式、canonical 指紋及既有封存 Worker 不變。
- Worker 不可用或 `useWorker:false` 時，每個 frame 讓出 event loop，再用原求解器／processor 計算。Worker 與 reference 均有預設 10 秒工作逾時及取消。timer 不能搶占同步 JS；reference 不代表 Worker 隔離或實時效能。
- stop／capture A 先停止接納，再 drain 已接納 frame，最後沿原 seal／verify／persist 路徑發布。paused 時仍可提交先前接納的結果，但不恢復 world、audio 或使用者操作。
- Worker 錯誤、逾時、取消、容量或 sink 錯誤明確中斷錄製；保留最後已提交的完整前綴，不發布假的 Captured；既有有效 artifact 與 A/B slots 保留。遲到回覆不污染下一代錄製。
- B 重算每 frame 有非同步讓出點；取消不發布 partial B。原 processor 的 pre-state、native cursor、phase 與固定條件驗證繼續適用。
- 修復獨立審查實際重現的過早繼續漏 tick：先驗證 recorder 能恢復，再動 world／interaction／behavior 時鐘，背壓拒絕時保持世界暫停。

## 整合 API

| API | 語意 |
| --- | --- |
| `RecordingHost.appendEvaluationFrame(frame, requests)` | 取得輸入所有權，背景逐 tick 評估並提交；不使用 live preview 的 latest-only 政策。 |
| `RecordingHost.flushEvaluation()` | 等待呼叫當下 accepted watermark；不關接納、不封存、不改暫停。受控短 take 可每步 advance 後 await。 |
| `LabRuntime.flushRecordingEvaluation()` | 上述 barrier 的公開整合／測試入口；不是使用者操作或模擬恢復。 |
| `RecordingHost.assertEvaluationReady()` | 恢復任何 producer 時鐘前的壓力／失敗 guard。 |
| `RecordingHost.getEvaluationTelemetry()` | accepted／committed tick、counts、pending slots、reserved／peak bytes、pressure 與失敗狀態。 |
| `RecordingEvaluationClient.capture()`／`reprocess()` | 單一 in-flight 工作，含回覆身分、容量、取消、逾時與世代隔離。 |
| `RecordingHost.stop()`／`captureComparison("A")` | publication barrier：先 drain，再 seal。 |

Runtime 變更限 evaluation client 初始化、Host callbacks、`onTick` 錄製分支、reprocess、恢復 guard、flush 與 dispose。geometry 輸入建立及 immutable clone 仍在 producer；搬移的是求解與 B evaluator，沒有把整個 physics／audio runtime 搬到 Worker。

## 基本驗證

- 新 lane／client／host 與既有 host／processor 初輪 51／51 PASS；另新增 reference stalled scheduler 與真 Rapier editor／FPS alternative 恢復回歸。
- 最終新核心與相關 app／錄放回歸合計 **153／153 PASS、0 fail**；`tsc --noEmit` 與本階段修改程式／測試 ESLint 均 exit 0。
- 原測試中以緊迴圈產生錄製 tick 的地方改為等待實際 evaluation watermark，保留原 cooldown、contact、phase、完整 publication、A/B、30 連續 tick 等資料 assertions。
- 最終命令與結果見 [機讀收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4cfefa22b32e9218fc301d262d874a4cddc79780)；原失敗及修復來源見 [失敗紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/37e269f5b5bf6d33499ef8cc75f17d3629134097)。型別、ESLint、Prettier 另由本階段確認。
- 真 module Worker browser transport、整合短 take／Motion／離線音檔輸出、效能 benchmark 及 computer-use，由主整合階段執行；這個分支尚未執行。

## 給 Claude Code 的重驗重點

1. 重跑新測試與完整 runtime 回歸，再在正常產品 bundle 驗 module Worker transport；fake-port 測試不是實際 browser Worker 證據。
2. 操作錄製、暫停、停止及 A/B，確認 pressure 提示及使用者暫停規則；low-water 不自動覆蓋 Esc／blur 暫停。
3. 受控 take 要 gate 普通 RAF，逐固定步 advance 後 flush，保留 source／bundle／browser、tick 範圍與 artifact hash。
4. 尚未量化 producer／worker／commit 成本改善；原 600 秒 FAIL／UNVERIFIED、正式性能門檻及失敗證據保留。

沒有新增套件、付費 API、雲端服務、錄製 schema migration 或聲學公式變更。Wiki／英文與最終 main 整合由根代理序列維護。
