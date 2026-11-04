# Meta 可信實驗工作流程核心

執行者：Codex 子代理 `meta_core/experiment_workflow`。開發分支：`codex/pipeline-meta`；最終整合 Commit 由主代理記錄。

## 實作

- `TrustedExperimentWorkflow` 沿用產品的 `RunSimulation`、`CaptureExperiment`、`AnalyzeAcousticResults`、`CompareExperiments` 工具，不直接改動 Scene，也不代替使用者 Apply。
- 基準流程固定 duration、60 Hz、seed 與 sample rate。候選流程引用基準 run 的 motion trace；物理、幾何或 Listener 不相容時，沿用 Host 拒絕政策。
- 每一步只接受同 request ID、Scene revision、帶 artifact 的 `succeeded` 結果。失敗、未完成、空 artifact 或 revision 改變時，保留已完成結果並停止後續步驟。
- 數值說明只從 Host catalog 的 grounding artifact 取得，核對 run、完整 hash 與 metric record；缺值保持 unavailable，不把模型或 protocol fixture 當量測來源。
- 取消先請求 Host，等待結果；若 Host 已成功，保留成功狀態並只停止剩餘流程。只有明確 `canceled` 回覆才設定 `cancelAcknowledged`。
- `getView()` 提供基準／候選 run、capture、分析與比較 artifact IDs、逐步結果及引用，供既有介面整合。

## 基本驗證

已執行：

```text
node --import tsx --test tests/app/agent-experiment-workflow.test.ts
exit 0; tests 8; pass 8; fail 0; skipped 0
```

其中一案實際建立 Rapier／Behavior／幾何聲學 Host，完成基準 0.2 秒（13 frames）、只修改聲學材質、同 motion 候選、Capture／Analyze／Compare 與帶來源說明。其餘負例涵蓋失敗停止、未知成功、取消確認、成功後停止、revision 競態、缺少／篡改／錯誤 run 的 grounding 及非法輸入。

這些證據是本機 Computed 功能驗證，不是 Meta live、瀏覽器視覺、裝置聽測或 600 秒性能通過。未呼叫外部模型，沒有新增費用。整合後由主代理進行格式、型別、UI 與完整管線驗證。
