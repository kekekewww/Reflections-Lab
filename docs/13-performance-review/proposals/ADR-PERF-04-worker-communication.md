# ADR-PERF-04：Worker 通訊、控制平面與有界資料平面

- 狀態：**PROPOSED／未採納**；2026-11-01。沒有採納 physics worker、SAB、Worklet 或全面搬遷。
- 程式基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`；新 transport／worker benchmark 均 **NOT RUN**。
- 依據：[ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md)、[當前盤點](../CURRENT_RUNTIME_AUDIT.md)、[聲學 Worker](../ACOUSTIC_WORKER_REVIEW.md)、[瀏覽器邊界](../BROWSER_CLOUD_SCALABILITY.md)。

## 問題與當前界線

目前 [acoustic-service.ts](../../../src/app/acoustic-service.ts) 已有原生 module Worker、單一 in-flight、payload/path/source caps、timeout、精確 identity validation 與 cancel 後 terminate；[recording-worker-client.ts](../../../src/experiments/recording-worker-client.ts) 也已有專用封存 Worker，回傳 bytes 使用 transfer。這不等於 physics、逐 tick capture solver 或接收端 parse／freeze 都在背景。

[bootstrap.ts](../../../src/app/bootstrap.ts) 的 RAF 仍呼叫 main `advance`；[runtime.ts](../../../src/app/runtime.ts) `onTick` 在錄製分支直接同步 `solveAcoustics`。因此「多加 Worker」之前需要分量主緒 production、message serialization、worker compute、dispatch、receiver validation 與 consumer 的成本，而非只看 worker round trip。

## 候選決策與遷移次序

先保持 existing client-first lanes，對現有 acoustic request 做 geometry cache／packet spike；動態 world surfaces 不可只按 geometryRevision 快取，須依[快照提案](ADR-PERF-01-acoustic-snapshot-exchange.md)重建或 key 精確 pose content；只有 profile 證明 physics 或 capture 的主緒占用是瓶頸，且完整 semantics 可重現，才另採 dedicated simulation／recorded-evaluation worker。seal worker 不改名成 simulation worker。

1. 控制平面維持小而有界的 command／ack／cancel／error，帶 `protocolVersion, runId, runEpoch, sequence, expectedSceneRevision`；輸入意圖若跨 tick，明定 target tick 與實際接納 tick。revision 驗證、原子 command、undo 與 stable domain IDs 保留，拒絕 unresolved refs，不傳 engine object／Rapier handles。
2. 資料平面傳 immutable 完整 snapshot 或 bounded chunk；descriptor 帶 tick 範圍、geometry revision、byteLength、layout version 與 ownership generation。接收前驗 bounds／layout／identity；transfer pool 遵守[所有權提案](ADR-PERF-03-buffer-ownership-lifecycle.md)。
3. Interactive pose／聲線預覽只保最新完成結果；未提交的舊 pose 可以合併。recorded events／evaluation／trace 是另一條有序 lossless lane，不能與 latest-only mailbox 混用。公平排程與批次成本需量測，不能讓長封存阻塞互動控制。
4. 若實驗 simulation worker，Rapier 建立／step／event normalization／Behavior owner 在同一 lane；main 只提交 intents 與讀已完成 snapshots／插值。worker 仍受 OS 排程影響，不提供「獨立 timer 即60 Hz實時」保證。取消／安全暫停的 acknowledged tick 必須可見。
5. 主緒保留 DOM／Pointer Lock／IME／R3F 與 native AudioNode control；audio rendering 不等待 Worker。AI／network／storage 不可成為 audio callback dependency。

## 容量、取消與復原

每 lane 分別限制 in-flight jobs、commands、snapshot/chunk slots、bytes、tick span 與 timeout；沿用聲學單批32 sources／256 paths／2 MiB 等現有界線作 baseline，不把它們推導成新 simulation queue 容量。新增值依[量測計畫](../MEASUREMENT_PLAN.md)的 residency、burst 與原正式 budget 選定，先寫入獨立採納任務。

忙碌時控制命令明確接納或拒絕；不得 silently drop scene transaction。互動 preview 合併時記 superseded，lossless producer 在接納前 reserve 後暫停，不能事後覆寫。結果只有在 `epoch, sequence, revision, tick` 全部符合後發布；「已收到」「已處理」「已持久化」的 ack 不可混稱。

cancel 先使 generation 失效並停止新接納；需要快速終止的不可中斷 compute 可 terminate Worker。termination 不等於保存成功：已接納 tick、未完成 buffers 與最後 watermark 留診斷。舊 port／舊 generation 回覆忽略，不能復活 run。crash 後若無已驗 snapshot／trace 可恢復，標 interrupted；不可自動重建出另一條 motion 卻稱同 take。

## 替代與風險

保留 main physics 加上分項優化是有效對照；structured clone 相容性較簡單。Transferable 可降低特定 payload copy，仍須 dispatch／validation。SAB 只在 transfer 仍為瓶頸且部署隔離成本可接受時提出；需要 single-writer publication、generation、越界與 underrun 政策，audio 不得 `Atomics.wait`。SAB／新隔離 headers／新 dependency 不由本 ADR 自動啟用。

Physics worker 會改變輸入接納時序、安全暫停、FPS grab/build、snapshot restore 與錄製 callback 順序，可能改善 main responsiveness 也可能增加 input-to-view latency。多 worker 還會競爭 CPU／記憶體；不可假設 worker 數增加必然提高 throughput。瀏覽器 background freeze／discard 仍可能中斷所有 lanes。

## 採納條件與回復

同 scene、固定輸入 intents／ticks、相同版本與原品質，對比 main baseline、局部 packet 優化、必要才加入 simulation worker；分量 main occupancy、worker compute、完整 delivery、input-to-ack／view、copy bytes、heap、tick debt 與 dropped wall time。要求 motion／events／Behavior／recording hash 或已凍結容忍 oracle 等價，並測 revision conflict、亂序、timeout、cancel、worker crash、blur/pause/resume、snapshot restore、source removal 與未解 command。

只有改善可歸因到目標瓶頸、未把原成本移成過期 snapshot／輸入延遲，且固定驗收未放寬才採納。回復透過 backend selection 回到現有 main PhysicsWorld／ordinary acoustic Worker／seal Worker；停止候選 run 並從已驗 snapshot 開新 epoch，不在同一 take 中悄悄切換 physics ownership。
