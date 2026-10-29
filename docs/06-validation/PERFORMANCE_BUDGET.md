# 效能目標與量測界線

本機 Node 數學 kernel、獨立 SDK／Rapier及正式browser profile的證據分開保存。產品初始效能目標仍依下表；[R17正式600秒量測](../11-v1/BROWSER_PERFORMANCE.md)已取得可判讀的負面結果，性能／持續負載未通過，未量區段維持 **TARGET／UNVERIFIED**。沒有以解析微基準推論 browser 或 audio deadline 已通過。

本文件維持正式數值預算的唯一維護位置；Phase 2 [UI量測標準](../05-ux/PERFORMANCE_STANDARDS.md)補充profile、分項時鐘與壓測方法，不另行放寬本表門檻。新的UIlatency門檻仍為PROPOSED，採納後才合併到此處。

## 初始工程目標

| 子系統                        | 初始目標（未驗證）                                     | 驗收方法                                                    |
| ----------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| 3D 互動／UI                   | 60 Hz，frame 16.67 ms；main-thread 自有工作 p95 <4 ms  | 瀏覽器 trace、指定 scene／GPU／解析度，10 min               |
| physics                       | fixed dt=1/60 s；step p95 <2 ms，最大 catch-up 4 steps | 256 primitive bodies、含 CCD 子集、contact flood            |
| acoustic worker               | 20 Hz 更新，單次 p95 <20 ms；stale frame 不套用        | 1 listener、8 sources、32 surfaces、order≤2 起始 profile    |
| acoustic main-thread delivery | p95 <1 ms/update；bounded message/queue                | worker payload／path 256 上限、backpressure telemetry       |
| audio render                  | 48 kHz、128-frame quantum 約 2.67 ms；工作 p99 <1 ms   | 實際 AudioWorklet profile、underrun／長時間 listening       |
| AI simulation                 | serial concurrency=1、單 run ≤30 s 模擬時間            | host quotas、cancel／timeout／cost ledger；不是模型速度保證 |

上述場景是待執行的起始 profile，不代表 schema 上限下必然達標。browser audio quantum／裝置 latency 實測前不得寫成跨裝置固定值；固定 quantum 是 benchmark 設定。

catch-up 上限適用互動預覽，超載可捨棄 wall-clock 積欠但必須記錄 dropped-time telemetry；錄製／可比較 A/B run 不得跳過 simulation ticks，超載時暫停 wall-clock 或將 run 標為不可比較。兩者不共用會默默捨棄時間的 accumulator policy。

## 已量測的微基準

執行 `npm run benchmark` 產生 [`analytic-local.json`](../../benchmarks/results/analytic-local.json)，保存 UTC、Node、OS、CPU／記憶體、fixture/kernel/lockfile SHA-256、迭代數、warmup、median、p95、min/max。每 workload 20 batches；direct／order2 各 batch 5000 次，4096-sample EDC 各 batch 100 次。固定 i%10 参数，沒有 stochastic seed。

量測含 JavaScript allocation；EDC workload 也含 synthetic input 建立。p95 是 **batch 平均耗時的分位數**，不是單一 frame 的尾端延遲。單一機器的 JIT、OS 排程與散熱會改變數據。最新結果以 JSON 為準，文件不複製可能失效的數字。

此測試沒有 BVH、完整場景、cross-thread serialization、GPU、Web Audio、native Steam Audio real-time reflections 或任意階數路徑爆增。未執行 memory leak soak、browser compatibility、實際端到端聲音 latency；因此 V4 只有 PARTIAL。

## 效能退階

未來量測超過預算時，先降低 acoustic update rate、reflection order、active source／path 上限與 IR 更新頻率，再採 bounded ranked path bank／late reverb approximation。UI 必須顯示實際 backend/model/limitations 與 stale 狀態；不得以減少資料量掩飾數值或 capability 改變。

## 2026-10-28 實測補充

初始數值、負載與退階政策保持以上原文。[r10正式profile](../11-v1/SESSION_PROGRESS_20261028-r10.md)及其原始收據保留實際FAIL／UNVERIFIED／NOT RUN、safe-overload暫停與負載不完整；原生程序結束碼不等於性能通過。ACO04的worker功能契約與VAL04的profile／metadata／透明退階分開。未經驗收權威處理，不自行把初始TARGET改成新門檻，也不因公開FAIL而宣告整體第一版完成。
