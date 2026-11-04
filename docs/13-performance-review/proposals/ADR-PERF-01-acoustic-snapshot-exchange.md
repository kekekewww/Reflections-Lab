# ADR-PERF-01：聲學快照交換與可驗證發布

- 狀態：**PROPOSED／未採納**；2026-11-01。本頁只提出後續候選，不修改既有 Accepted ADR、runtime 型別或驗收。
- 程式基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`。所有新量測、實作與容量驗證均 **NOT RUN**。
- 承接：[ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md)、[資料契約](../../02-architecture/DATA_CONTRACTS.md)；詳情見[聲學 Worker 審查](../ACOUSTIC_WORKER_REVIEW.md)、[緩衝審查](../BUFFER_ARCHITECTURE_REVIEW.md)。

## 問題與既有保護

[src/app/acoustic-service.ts](../../../src/app/acoustic-service.ts) 的 `solve` 已拒絕第二批 `SOLVER_BUSY`，只保留 scalar request identities；原生 `postMessage` 傳遞完整 snapshot。`receive` 核對 Worker port、batch、request/source/listener、scene/geometry revision、poseTick 與 budget，late reply 不發布。不是缺少 backpressure 的無界 queue。

[src/app/runtime.ts](../../../src/app/runtime.ts) 的 `solveCurrent` 另核對 `runEpoch`、scene revision，拒絕超過三個固定步的結果，保留舊解；`AudioEngine.updateFrame` 再拒絕 stale／regressed frame 並做 owned clone。問題是同一批輸入仍重複帶 geometry，且傳送、驗證、clone、audio route 更新與 view 消費成本分散。舊解有效不等於新 pose 已求解，也不等於它對當前 topology 仍可重用。[acoustic-input.ts](../../../src/app/acoustic-input.ts) 目前每次依 pose 建立 world surfaces，但 geometryRevision 等於 sceneRevision；移動 occluder 可在兩個 revision 都不變時改變幾何快照。

## 候選決策

先保留目前單一 in-flight 與最近有效解語義，隔離量測 geometry-by-revision cache 與 bounded transferable snapshot pool。應採用哪一個、是否值得組合，由[量測計畫](../MEASUREMENT_PLAN.md)決定；本頁不先採 SAB 或新增 PCM ring。

1. Host 維持 Scene／physics 權威；只在獨立封裝的 packet 寫入 pose／listener／source 與 geometry version。Worker 只快取 immutable local geometry／material layout；移動物件每個 poseTick 重建 world surfaces，或以精確 transformed-geometry／pose content identity 另行 key。geometryRevision 本身不足以識別動態快照，只有相容 revision 與內容身分都符合才重用。cache miss 明確請求重送；不可套用其他 revision 的 surfaces。
2. 概念 envelope 包含 `protocolVersion, runEpoch, batchSequence, sceneRevision, geometryRevision, poseTick, sourceId, listenerId, payloadBytes, ownershipGeneration`。這不是新增正式 API。request ID／solver version 與現行能力／數值驗證仍保留。
3. 互動 producer 忙碌時不排每一個中間 pose；在下一個可接納點重建最新完整合法 snapshot。只合併未提交的預覽狀態，不能刪除 logical emission、contact events 或錄製 tick。
4. Receiver 完整驗證後才原子切換「published」reference。view、audio 各自標取用 poseTick／revision／age，不在 producer 寫入中的 storage 上讀。繪圖只使用真 solver paths，不能由插值或 IR 虛構新路徑。
5. topology／run epoch 改變時取消舊批、使 cache key 失效；舊 epoch 的 completed packet 只能歸還／釋放，不能重新發布。來源移除與 listener 變更必須清理對應 identity，不能讓不同 pairing 共用 direct delay。

## 所有權、容量與滿載

| 資源 | 單位與 owner | 候選滿載／失敗政策 |
| --- | --- | --- |
| In-flight solve | 一批；沿用 service owner | busy 拒絕，下一次取最新完整輸入，不追加無界 queue。 |
| Geometry cache | revision 數、surfaces 數、bytes；Worker | 先核實 total retained bytes 與逐 revision 失效；不足則拒絕／有界 eviction 後重送，不以錯誤 geometry 回成功。 |
| Transport pool | packet slots 與 bytes；依 generation 移交 | transfer 後 sender 不讀 detached storage；receiver ack 表示不再引用才可歸還。無空槽先跳預覽提交並計數。 |
| Published／retained frames | source/listener pairing 數、paths、bytes、age ticks；host consumers | 沿用既有上限；保留最近有效值與 stale 診斷。跨不相容 topology 時標 unavailable，不默默沿用。 |

既有 service 上限為32 sources、每 source 256 surfaces、整批256 paths、2 MiB payload；這些不是新 pool 大小或性能保證。pool slots／bytes、cache revision 容量與允許 age 必須由 fixture 分布、峰值 ownership 與原正式 budget 推導，再在獨立採納紀錄固定；本提案不新增任意數字。

## 替代方案與代價

保留物件 clone 是最低相容性風險的 baseline；若 geometry／clone 不是主要成本就保留。TypedArray transfer 可減少特定大 buffer 的複製，但增加 layout、detachment、歸還與版本成本，仍有 message dispatch／validation。SAB latest-complete mailbox 是更後面的候選：需要隔離部署、publication order、generation 與讀寫協定；不能以 audio 等待 producer，也不適合 lossless recording。逐 frame FIFO 則會累積過時 pose latency，不作互動預設。

可能品質風險包含 hold 舊 pose、cache 誤命中、漏 source、path identity churn 與失去 provenance。UI age 可觀測不代表聲學誤差已受控；gain／delay／方向仍按[音訊契約](../../02-architecture/AUDIO_RUNTIME.md)平滑，傳播延遲只計一次。

## 採納條件與回復

先固定相同 scene／asset／solver／輸入 trace，分量 request construction、geometry bytes、clone／transfer、worker compute、dispatch、validation、audio／view consumer，報 p50/p95/max、retained／peak bytes、stale age 與 drops。只有量測確認改善的是實際瓶頸、完整 delivery 對原預算有收益，且 frame identity／paths／數值 oracle 等價，才提出採納。

必測 malformed／truncated packet、cache miss、scene／geometry revision 不變的移動 occluder、亂序、timeout、cancel、epoch／revision 跳轉、來源刪除、pool 歸還重複與 Worker crash；recording 保持原完整 tick oracle。不可用較低 quality／較小負載換取原驗收 PASS。回復路徑是停用 cache／packed transport、取消在途 packets、清除新 generation，回到現有單批 structured clone；Scene／Recording 格式不變。
