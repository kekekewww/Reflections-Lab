# 效能與緩衝審查摘要

日期：2026-11-01。狀態：研究結論與未來工程規劃；沒有產品效能修復。已提交基準`05d40fd2d52f4b737f6acac61fa00356403c0038`；R21僅作未提交補充觀察。完整交付／量測／整合狀態見[最終報告](FINAL_REVIEW_REPORT.md)，授權及限制見[審查契約](REVIEW_CONTRACT.md)。

## 主要發現

| 發現 | 證據強度／適用版本 | 對未來工作的含義 |
|---|---|---|
| Physics與Behavior仍由app RAF在主緒推進；錄製逐tick同步聲學求解及append | CONFIRMED BY CODE；05d40；[Runtime](CURRENT_RUNTIME_AUDIT.md)／[錄製](RECORDING_AND_RENDERING_REVIEW.md) | 優先分項量capture/clone/solver/seal，不因live Worker存在就認為錄製已平行化 |
| Live acoustic service已有single-inflight與busy rejection；app另有epoch/revision／tick freshness及last-valid frame | CONFIRMED BY CODE；05d40；[Worker](ACOUSTIC_WORKER_REVIEW.md) | 比較latest pending／geometry reuse／參數transition，先量現有瓶頸；triple buffer不是預設答案 |
| Native Web Audio渲染與main-thread控制分開；既有FIR cache、stable routes、dual banks、assets與分層voice/path預算 | CONFIRMED BY CODE；05d40；[Audio/DSP](AUDIO_GRAPH_DSP_REVIEW.md) | 研究automation／kernelshape／nativebuffer/nodechurn的邊際成本，不重建第二套cache |
| R17指定負載曾量到嚴重過載及未完成capture | CONFIRMED BY BROWSER PROFILE；歷史cde1e2b；[原始結果](../11-v1/BROWSER_PERFORMANCE.md) | 保留負面證據；不同code/browser的新run不能直接當因果改善證明 |
| 使用者回報聲音斷續；R21早期output統計與最後修正屬不同截點 | USER REPORTED／帶限制歷史觀測；R21實測bundle與裝置條件不完整；[Audio證據分期](AUDIO_GRAPH_DSP_REVIEW.md) | 最後bytes需獨立重測；不能以unit assertions或早期統計宣告聽感修復 |
| Trace／decoded PCM budget不等於總heap、native convolution/delay、GPU或export峰值 | CODE＋解析模型；[資源](MEMORY_AND_RESOURCE_REVIEW.md) | 以所有權及同時存活時段建模；研究512MiB envelope維持PROPOSED，不改正式預算 |

## 架構判斷

Buffer是不同用途的工具：PCM供料、控制快照、一次性事件、decoded assets與無損錄製各自需要容量單位、所有權、滿載／取消／回收政策。增加容量可能吸收短暫jitter，但不能保證解決持續CPU不足；實際填充量與演算法read-ahead也有不同延遲語意。[Buffer矩陣](BUFFER_ARCHITECTURE_REVIEW.md)、[產業比較](INDUSTRY_AUDIO_ARCHITECTURES.md)。

互動連續狀態可coalesce；碰撞事件與正式錄製不可靜默latest-only。發聲時間、context排程offset與物理傳播delay分開；已知replay可以預先準備，未知玩家輸入／碰撞不能任意提前播放。[時鐘審查](CLOCK_AND_SCHEDULING_REVIEW.md)。

先量出主緒工作、worker compute／delivery、audio控制及真正output統計，再依收益決定移動工作。SAB、自訂Worklet、Physics Worker、串流資產與雲端render均需特定瓶頸證據及回退路徑。維持client-first，不新增服務。[Browser／Cloud](BROWSER_CLOUD_SCALABILITY.md)。

## 優先順序與驗證

P0先處理可重現歸因、錄製熱路徑／完整性及automation／輸出連續性風險；P1比較有限snapshot交換、既有cache邊際成本、voice與資產政策；P2才評估較大worker／DSP／offline／cloud遷移；P3保留GPU／高階求解／能源研究。每項完整task、依賴、benchmark、音質／互動延遲風險及rollback見[Roadmap](OPTIMIZATION_ROADMAP.md)與[Risk Register](RISK_REGISTER.md)。所有優化task為BACKLOG，七份[提案](proposals/ADR-PERF-01-acoustic-snapshot-exchange.md)為PROPOSED。

原鎖版Profile對目前Chrome的拒絕保留；經使用者選擇的暫存研究副本採相同負載／門檻收集600秒，結果屬非正式單次研究。[量測方法](MEASUREMENT_PLAN.md)列十情境與可取得／未取得metrics。Physics droppedwall、snapshot rejection、lateevent、voice/path rejection與output underrun分列；不推稱Worklet deadline或裝置聽測已量得。

本輪不更改產品、設定、正式測試、有效ADR或驗收門檻，不推送／部署。整合時重新核對目標；若仍有R21未提交內容，只交付已審查文件Patch。完整V1與性能gate仍依原正式來源。
