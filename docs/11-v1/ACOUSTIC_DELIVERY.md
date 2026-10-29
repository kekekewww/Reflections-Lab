# 聲學 Worker 傳輸與取消驗證

本頁只記錄 `AcousticService` 與實際 acoustic Worker，不能取代整體產品效能驗收。正式效能門檻仍以 [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md) 為準。

## 實際行為

- 同時只有一個批次，沒有隱藏 queue；忙碌時拒絕並累計 backpressure。
- 取消、逾時與 transport failure 會終止舊 Worker。下一個工作建立新 Worker；舊 port／batch 回覆無法套用到新工作。
- 驗證每筆 request/source/listener、scene/geometry revision、pose tick，以及完整有界結果形狀；不發布部分成功或格式損壞的 batch。
- 批次上限為 32 個來源、每來源 256 surfaces、整批 256 paths、2 MiB JSON。預檢也拒絕 sparse array／陣列額外屬性，避免 JSON 忽略的內容繞過傳輸界線。
- `dispose()` 可重複呼叫，之後所有 solve 都拒絕。沒有 Worker 的明確同步模式仍可用，telemetry 不將其標為 Worker。
- `getTelemetry()` 提供固定 128 筆成功 timing 歷史、pending age、失敗／取消／逾時／backpressure／晚回覆計數、payload bytes 與 Worker restarts。

`lastRoundTripMs` 包含該批次派送後的往返；profile 的 `roundTripIncludingDispatchMs` 另包含輸入預檢與複製。`lastWorkerComputeMs` 是 Worker 內同一時鐘的實測差值。`lastDeliveryHandlerMs` 僅量本服務的結果驗證與 resolution，不包含 runtime 的 audio/UI consumers。實際世界目前 pose／frame age 的過期判斷仍由 runtime 負責；相符的 pinned request 並不代表目前世界沒有前進。

## 重現與證據

```powershell
node tests/browser/run-acoustic-delivery.mjs
```

此命令先正式打包 fixture，再建立自己持有的 localhost:5187 preview process，序列執行 strict TypeScript、Node transport／解析回歸及真 Chrome Worker 測試，再直接停止持有的 process。它避免 Windows 的 Playwright shell webServer teardown 等待；不使用其他開發服務、不呼叫模型。

2026-10-27T01:39:38Z 的正式 bundle 重測：strict PASS、Node **46/46 PASS**（17 service／29 solver）、真 Chrome **4/4 PASS**，前後來源 hash 相符。固定 profile 的 dispatch-inclusive roundtrip p95 **8.1 ms**、Worker compute p95 **3.9 ms**、本服務 handler p95 **0.8 ms**；cold production Worker、取消／逾時與失敗後重建均通過。完整 raw samples 仍保留較慢尖峰，不能將 p95 通過稱為沒有 deadline miss。

- [來源與命令 manifest](../../tests/acoustics-runtime/delivery-validation-manifest-20261027.json)：前後來源 hash、實際 exit、raw stdout/stderr hashes。
- [Chrome profile](../../tests/acoustics-runtime/delivery-browser-20261027.json)：機器／瀏覽器／viewport、120 個 measured jobs、10 warmup、20 Hz、8 sources／32 finite planes／一階反射與完整 samples。
- [原始輸出](../../tests/acoustics-runtime/delivery-evidence-20261027/)：Node 的 fault injection 是 Mock；Chrome 生產 Worker 與延遲 transport fixture 分開。
- [第一輪 handler 超標紀錄](../../tests/acoustics-runtime/delivery-failure-20261027/)：p95 1.1 ms 超過固定門檻；保留當時輸出。之後移除回覆端重複的 allocation-heavy 泛用 tree traversal，保留完整已知形狀與大小檢查。
- [同機併行負載下失敗](../../tests/acoustics-runtime/delivery-contention-20261027/)：包括冷啟動 timeout 與 compute／roundtrip 超標。保留錯誤；不能只選擇第一次較快的結果宣告穩定通過。
- [受控開發伺服器失敗](../../tests/acoustics-runtime/delivery-quiet-dev-20261027/)：cold Worker timeout，roundtrip p95 21 ms、handler p95 1.4 ms。正式 bundle 避開 runtime TypeScript transform／HMR；這是另外的 release 環境證據，沒有抹除 dev 失敗。

最終結果以 manifest 與最後原始輸出為準。整體 runtime 的過期顯示、所有 consumer delivery、10 分鐘 UI soak、AudioWorklet deadline、硬體聽測與 order2 仍不由本切片宣稱通過。
