# ADR-PERF-05：錄製無損反壓與連續 tick 提交

- 狀態：**PROPOSED／未採納**；2026-11-01。沒有搬遷 recorder、改 artifact 格式或新增 OPFS。
- 程式基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`；候選 lane／新性能與復原測試均 **NOT RUN**。
- 依據：[ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md)、[錄放契約](../../07-experiments/RECORD_REPLAY.md)、[錄製審查](../RECORDING_AND_RENDERING_REVIEW.md)、[時鐘審查](../CLOCK_AND_SCHEDULING_REVIEW.md)。

## 問題與不可回退的語義

[src/app/runtime.ts](../../../src/app/runtime.ts) `onTick` 在基準第933–977行蒐集 active voices 與同 tick events；第945行以每批16 sources 同步 `solveAcoustics`，第951行才 append。普通 live acoustic Worker 的存在不能消除這條 main 熱路徑。`appendFrame` 也要 owned clone、驗證、計 bytes；seal Worker 是後面的封存工作。

[FixedClock](../../../src/physics/fixed-clock.ts) 已區分互動最多四步追趕後丟 wall debt，與錄製超載暫停／保留 debt。候選不是新增「不丟錄製 tick」政策，而是讓逐 tick capture／evaluation／encoding 的有界接納可被量測與控制。錄製 trace 不能採 latest-only、overwrite ring 或事後插值補 tick。

## 候選決策

先 profile 同步 baseline，再 spike 與互動預覽分離的 ordered recorded-evaluation lane。immutable tick inputs 包括 run／scene identity、poses／listener、normalized events 與 sequence、Behavior pre/post state、instance decisions、source cursors 與 acoustic inputs；每一個需保存的 tick 都必須得到對應結果。不能以較低 solver quality、重算 admission 或少記 source 達成 throughput。

候選 producer 在每個權威 tick 前取得 frame slots 與 bytes reservation，再 step／capture／enqueue；若完整 next-tick 上界不能安全預留，先暫停，或在獨立設計明示安全拒絕策略。若世界已推進後仍發生 capture 失敗，不聲稱自動 rollback：只保留已完整接納的連續 prefix，標 interruption／未完成，保留原始錯誤。

| Watermark | 精確意義 |
| --- | --- |
| Accepted | tick snapshot 已驗證且有 owner／容量；不得在後面被覆寫。 |
| Evaluated | 同 tick acoustics／Behavior 等必要工作完成；缺項不能推進。 |
| Persisted | 對應資料的 storage transaction 完成；不等於 backup／斷電保證。 |
| Published | final counts／hash／range 與版本核實，完整 manifest／artifact 才可見。 |

概念 chunk descriptor 為 `runId, runEpoch, sceneRevision, startTick, endTick, sequence, frameCount, payloadBytes, ownershipGeneration, contentHash`。tick range 須連續，event order、body IDs、listener 與原 phase／provenance 不變。chunk digest 不可直接冒充現行 canonical artifact fingerprint。

## 容量、時鐘與滿載

分開界定 queued frames、queued bytes、最大 chunk tick span、evaluation jobs、resident snapshot bytes、storage bytes 與 final output bytes；不能只限「幾個 chunks」卻讓每個任意大。既有 recorder hard caps 為18,000 frames、64 MiB trace、256 objects、100,000 unique events、2,048 events/frame；這些不是新的 queue capacity 或總 heap 保證。

高／低水位依同負載 peak frame size、服務時間與 memory headroom 量測選定，暫停點必須早於無法保留下一個已接納 tick 的邊界。consumer ack 到低水位後才准明確續行；禁止無界擴容。反壓增加 wall duration，不在 recording timeline 插入 wall-clock silence。錄製仍以 integer physics tick 為權威，audio pause/resume 可換 scheduling epoch，不能因此換掉同 take 的 trace identity 或重發已聽事件。

互動 preview 可只顯示最新完成 snapshot，與 lossless queue 的全數 tick 分開。UI 顯示 waiting／reason／已接納與已處理 tick，而不是讓預覽停滯被誤讀成錄製成功。seek/replay／新的錄製不可重用舊 pending generation。

## Stop、cancel、quota 與 crash

Stop 先停止新接納、固定最後 accepted tick、drain 所有已接納結果、驗連續範圍，再走現有 seal／verify／publication。Cancel 使 operation generation 失效；舊 reply 只能釋放資源，不發布。重複 stop 應共用同一 finalization 結果；失敗保留 reason 與最後 watermark，不能把部分成果標 Captured，上一個 valid artifact 保留。

若將來改 chunk storage，先寫 immutable chunks 與 hash，再最後發布 manifest；quota、timeout、Worker crash、tab discard 都需重開辨識完整／interrupted，不能靜默刪有效錄製。OPFS 與 IndexedDB 之間沒有現成跨 API 原子 transaction；格式、migration、flush 與 orphan recovery 必須另作實作決策。現有封存與 prepared save 的獨立驗證不可因「同一個 Worker」就省略。

## 替代、採納與回復

保留 synchronous capture＋現有 pause/debt 是 baseline；先減少重複 snapshot／encode 可比搬 worker 更小。獨立 evaluation worker 或與 simulation 同 lane 都有 serialization／CPU contention／head-of-line blocking 代價；分離後平均快於實時也不保證每 tick deadline。持久 streaming 可減 memory，但需要相容性、quota 與 crash 證據，不在本頁預先採納。

依[量測計畫](../MEASUREMENT_PLAN.md)分開量 tick capture／solver／append、seal、save/load、replay，報 wall／simulated seconds、queue bytes／frames、所有 watermarks、tick debt、pause duration、peak memory 與完成狀態。對同一固定輸入要求 trace／events／phase／hash 等價，注入慢 consumer、滿載、pause/resume、stop 有待辦、取消／重新開始、quota、worker crash、malformed／duplicate／gap chunk；原正式性能負載與門檻不改。

只有有界性、完整性與可復原性通過，且量到原瓶頸／長任務改善，才凍結容量並採納。回復到原 synchronous per-tick capture／FixedClock 錄製暫停與現行 artifact 格式；丟棄未發布候選 staging，不把候選與原 take 混接或覆蓋舊 valid recording。
