# Stage 04：Meta 產品工作流程核心

日期：2026-11-02（Asia/Taipei）。開發執行：Codex，功能分支 `codex/pipeline-meta`，基準 `429efb7597ec913bd879ecc05c29a6be7ad5175c`。本報告記本分支的程式與基本測試，不宣告整體 V1 或 Meta live 完成。

## 實作

- `server/meta-budget-ledger.ts`：獨立於歷史三次 live-validation ledger 的通用持久授權帳本。固定 authorization/model/data mode/rates/ceiling；每個 HTTP attempt 先 reserve、不退款；以整數金額單位避免浮點超額。每次 mutation 以 exclusive file lock、原始 hash、atomic rename 寫入。重啟保留 active/uncertain，未知結果拒絕重送；相同 ID/hash 的已完成回覆可重取。只記 hash、受限 provider 輸出與用量，API key、輸入 messages、headers 不入帳本。actual billing/remaining credit 保持 null。
- `server/meta-provider.ts`／`cli.ts`：request identity 在 transport callback 前安裝；每次 retry 先持久 reserve，取消／傳輸未確認保留 uncertain；已收到但未接受的提案不套用。真實網路 adapter 必須有持久帳本，CLI 僅在原 provider gate 已授權 READY 時開啟帳本，預設 network=false/budget=0 不變。重啟後 usage 讀持久累積值。測試依賴仍可注入 fixture transport。
- `server/app.ts`／`src/ai/client.ts`：相同 `X-Reflection-Request-ID` 與內容共享結果，內容不同拒絕；新增本機取消入口，區分取消請求與已確認結果。仍不提供 scene Apply 或 budget/config 設定的 HTTP 權限。
- `AgentSession`：保留原提案→本機預覽→Apply/Undo 流程；新增 planning generation/AbortSignal 保護，取消後 late live 回覆不得建立可套用預覽。新增明示 `runExperiment`／`compareExperiment`，執行時不與 planner/Apply 重疊，取消保留已完成步驟與 Host 確認。
- `TrustedExperimentWorkflow`：基準 RunSimulation→CaptureExperiment→AnalyzeAcousticResults；候選重用基準 motion trace、seed、duration、sample rate，再 capture/analyze/compare。每步必須有對應 request/revision、明確 succeeded 與 artifact IDs。候選材質變更仍由使用者先 Preview/Apply；流程不自動修改場景。
- `ExperimentToolHost.getGroundingArtifact`：分析與比較發布 immutable analysis artifact，由實際 computed records 建立並保存 hash。工作流程使用 trusted resolver 與 `explainVerifiedMetrics` 產生帶 metric/artifact/run citations 的 Host 說明；unsupported 指標維持 null，不由模型補值。

## 基本驗證

- 最終 `node --import tsx --test tests/ai-runtime/*.test.ts tests/app/agent-experiment-workflow.test.ts tests/app/experiment-tools.test.ts`：183/183 PASS，0 fail、0 skip，exit 0。收據：[04-meta-final-validation.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c9474af71b15f5c46d1a5fc14fe8c72a6058a2a6)。
- provider 舊回歸＋新增核心：27/27 PASS，含持久重啟去重、unknown/cancel 後阻止派送、HTTP identity 衝突與 late live 取消。收據：[04-meta-provider-validation.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/dc1b459c1a087d80c2944120621a295961dcd5ea)。
- 工作流程 8/8 PASS，其中一案使用真 Rapier、Sound Behavior、幾何聲學與 ExperimentToolHost 完成基準→只改聲學材質→同 motion 候選→比較→grounding，非模型或 Host success stub。
- 先前 scope 有一個同步 active-request 回歸：85/86。保留 [初次收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8e09a5b8c352c532d9f799dcf1203b209f8ff2ea)；修正為先安裝 identity promise、再同步 dispatch，未修改原測試或容差，已在最終完整 scope 通過。
- 新 ledger 的第一次 fixture 使用 Windows sandbox 特殊 temp 目錄，atomic rename 覆寫遭 EPERM。fixtures 改在各工作樹 `.cache` 範圍並於清理前確認絕對 parent；保留 production atomic rename 與鎖，不以刪除目的檔取代。最終 scoped suite 包含此處持久檔案測試且全通過。
- TypeScript、格式與 ESLint 結果另記 [靜態收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8ab060b50fccedc01b3fe29228aac89d2794cb59)。

## 整合接口與限制

根整合需在 `AgentSessionOptions` 傳入 `resolveGroundingArtifact: id => experimentTools.getGroundingArtifact(id)`、`cancelTool: id => experimentTools.cancel(id)`。UI 讀 `getWorkflowView()` 或 `getView().workflow`，呼叫 `runExperiment()`／`compareExperiment()`／`cancel()`，沿既有 onChange 發布狀態。workflow 的 baseline/candidate `runId` 可用 `ExperimentToolHost.getRun` 取得完整 take 給離線 renderer；不會自動切換 RecordingHost.current。

Motion transaction hooks 由 Stage 05 的 AI bridge 提供；根整合需把 hook 從 AgentSession options 透傳 Scene adapter。本分支避開其 `types.ts`／`host.ts`／`scene-adapter.ts` 所有權。Sound producer capability/schema 由 Stage 03 提供；真 OnBounce 來自 PhysicsWorld，不在此處由速度猜事件。

本輪所有模型 transport 為注入 fixture，沒有付費 Meta request，也沒有把 fixture 改標 live。持久帳本是單機授權上限，不是多人雲端 billing/auth；未知鎖需人工查核，不自動偷鎖。未做實體裝置聽測、600 秒性能重新資格或整體 V1 結案。根整合後仍需 browser workflow、Motion sidecar、匯出 UI 與 Computer Use 音檔驗證，最後交 Claude Code 獨立複核。
