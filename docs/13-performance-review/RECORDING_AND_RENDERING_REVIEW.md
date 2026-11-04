# 錄製、重播與渲染緩衝審查

日期：2026-11-01（Asia/Taipei）。狀態：**研究／PROPOSED，未實作或執行新產品測試**。程式基準固定為 `05d40fd2d52f4b737f6acac61fa00356403c0038`；較新 dirty R21 觀察只可另附為補充，不能併稱此 commit 的結果。本頁 `REC-*` 是本地研究／後續工作標籤，並非新的正式任務系統、中央 Claim ID 或驗收。

## 結論與既有研究關係

應先量測逐 tick capture、封存、儲存及重播載入的不同成本，再決定搬遷。一般聲學 Worker、背景封存、60 Hz fixed step 都已存在，但三者均不代表整條錄製鏈獨立於主緒。建議候選是有界、依 tick 順序、可停止 producer 的 lossless lane；只讀預覽才可採 latest-only。這是後續實作提案，沒有新增 Worker、OPFS、服務或 schema migration。

本頁補足資料所有權、queue、提交及資源量測，不重寫 [既有錄放研究](../12-architecture-review/RECORDING_AND_REPLAY_RESEARCH.md)、[Browser 研究](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md)、[離線渲染研究](../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md)或 [ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md)。正式 [錄放契約](../07-experiments/RECORD_REPLAY.md)、[A/B](../07-experiments/AB_COMPARISON.md)、[性能結果](../11-v1/BROWSER_PERFORMANCE.md)及原 FAIL 均保留。

## REC-01：可由基準程式確認的資料流

| 邊界 | CODE 事實（固定基準行號） | 應量的成本／限制 |
| --- | --- | --- |
| RAF → physics | [bootstrap.ts](../../src/app/bootstrap.ts) L315–322 呼叫 advance／publication；[runtime.ts](../../src/app/runtime.ts) L774–805 推進 physics。 | 同主緒供應；fixed dt 不是實時排程保證。 |
| tick → capture | runtime L839–880 擷取 Behavior 前／後 snapshot 與 cursors；L935–945 分批同步求解；L951 append。 | 分開 Behavior、solver、frame 組裝、append；不能用普通 20 Hz acoustic Worker 時間取代。 |
| append → owned frame | [recorder.ts](../../src/experiments/recorder.ts) L468–495；[hash.ts](../../src/experiments/hash.ts) L80–83 canonical stringify → parse／deep freeze → UTF-8 byte 計數，再驗證／接納。 | 每 tick 配置及複製；超界 frame 的處理成本也可能已發生。 |
| stop → seal | recorder L529–543 複製 frame list／event IDs；[worker client](../../src/experiments/recording-worker-client.ts) L121 structured clone 傳送。 | 單一 in-flight；timeout ≤120 秒不能中斷主緒同步工作。 |
| seal → publication | recorder L746–763 重建／逐 frame 驗證／封存／獨立 verify；[seal worker](../../src/experiments/recording-seal.worker.ts) L6–8 transfer bytes；client L100–114 再 copy／hash／decode／parse／freeze。 | Worker compute、傳送、主緒接收及 peak ownership 分開計。 |
| save／load | [blob-store.ts](../../src/persistence/blob-store.ts) L464–519 prepared save 仍 copy／digest／parse；公開非 prepared 輸入保留完整 verify。 | 非同步 IndexedDB 不免除主緒編碼／複製；並行相同 prepared save 共用 commit。 |
| replay／seek | [MotionReplay](../../src/experiments/replay.ts) L16–23、[ReplayAudioHost](../../src/app/replay-audio.ts) L52–56 各有核驗／owned clone；後者另建 tick map。 | artifact、A/B、prepared bytes、兩個 replay owners 的重疊生命期；seek 及 restore burst。 |
| B reevaluation | [recording-host.ts](../../src/app/recording-host.ts) L264–274 每32 frame yield；[recording-processor.ts](../../src/app/recording-processor.ts) L285–317 仍同步 solve 並 structuredClone output。 | 32 frame 是目前 yield 粒度，並非已達 frame budget；逐 frame／整批時間分開。 |

Recorder hard caps 為18,000 frames、64 MiB trace、256 objects、100,000 unique events、2,048 events/frame（recorder L29–34）。60 Hz 全數錄製的 frame ceiling 約300秒，可能更早達 bytes/event 限制。這些是產品資料上限，不是總 RAM 或任意長度錄製的保證。

## REC-02：預覽與無損錄製採不同接納政策

| Lane（PROPOSED） | 時鐘與資料權威 | 滿載處理 | 不能犧牲的資訊 |
| --- | --- | --- | --- |
| UI／聲線預覽 | latest complete snapshot；標 tick／revision／age。 | 合併尚未消費的舊預覽；記 skipped preview counters。 | 不把預覽插值寫回 dynamic pose；不將跳畫面寫成 trace 漏 tick。 |
| 互動 live solver | 沿用一批 in-flight 與 stale reply 拒收。 | 等完成再提交最新合法輸入；不另設無界 queue。 | event emission 身分另保存，不能因更新 pose 合併而消失。 |
| 錄製 evaluation／encode／storage | immutable tick inputs；run／epoch／revision／sequence 明確。 | reserve bytes＋frame slots 後接納；高水位 pause producer，ack 到低水位才可續行。 | tick 全數連續、同 tick event 順序、pre-state、source cursor、聲學 refs 及原本 admission。 |
| 離線輸出 | pinned recording → rational tick/sample timeline。 | 依工作／輸出預算拒絕或可取消等待；不回改 capture。 | sample origin、phase、preroll／tail、filter／delay／IR state。 |

錄製不能採覆寫 ring／latest-only／丟 frame 後補插值。失敗不能悄悄降 solver quality、少存 source 或將 interrupted 改為 captured。現行 [FixedClock](../../src/physics/fixed-clock.ts) L111–131 已區分 interactive wall-time discard 與 recording debt pause；候選 lane 必須保留此語義。量到快於實時的平均 throughput 也不能保證每一個 deadline。

Queue descriptor 草案：`runId, runEpoch, sceneRevision, startTick, endTick, sequence, frameCount, payloadBytes, contentHash, ownershipGeneration`。記錄 `accepted/processed/persisted/published` 四個 watermark；只在消費者不再引用 buffer 後歸還 transfer pool。不得 transfer 尚為 Scene／UI 權威的 array。chunk hash 不能直接冒充現行 canonical artifact hash；若更換持久格式或指紋，另做 migration／相容性任務。

## REC-03：flush、提交、quota 與 crash

候選 stop 流程依序是停止新接納 → 固定最後 accepted tick → drain 已接納 contiguous frames → 核對 counts／hash／versions → 寫完整 artifact 或已驗 chunks → 最後發布 manifest。cancel、timeout、quota、worker crash 及重複 stop 都要保留原始原因與最後已知 watermark；「已收到」不等於「已保存」，「已保存」不等於備份或斷電保證。

[IndexedDB 3.0 Editor’s Draft（2026-10-30）](https://w3c.github.io/IndexedDB/#transaction-lifetime)區分 transaction commit 與 durability hint；request success 不能代替 transaction complete。`strict`／`relaxed` 取捨須 feature test 並記實際值，不保證所有裝置斷電後零資料損失。現行產品未在本輪改用新 durability 政策。

若日後採 OPFS，staging chunks 與 IndexedDB manifest 之間**沒有本案已實作的跨 API 原子 transaction**。候選是 immutable chunk names＋content hashes，先完成資料與明示 flush，再以單一 metadata transaction 發布完整 manifest；啟動只接受完整可驗引用。孤兒 staging 標 interrupted，由另行明示清理程序處理，不自動刪除使用者有效成果。[File System Standard](https://fs.spec.whatwg.org/#api-filesystemsyncaccesshandle-flush)區分 `flush()` 與 `close()`；後者不提供前者的即時儲存保證。[OPFS 官方說明](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)指出其為 origin 私有且受配額管理；這不是使用者可見的獨立備份。

[Storage Standard](https://storage.spec.whatwg.org/#dom-storagemanager-estimate)的 usage／quota 是估計，不能先 reserve 真正磁碟空間；`persist()` 結果要記 granted／denied／unsupported。實際寫入仍可能失敗。[配額說明](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)列出 QuotaExceededError；應保留失敗資料及重試選項，不默默刪既有 recordings。背景 freeze／discard 的恢復政策另見[瀏覽器／雲端邊界](BROWSER_CLOUD_SCALABILITY.md)。

## REC-04：重播與輸出保持同一實驗

Authoritative motion replay、pinned resimulation、fresh physics 必須分名。Acoustic A/B 沿用同 motion／events／listener／source phase；Behavior A/B 才重新評估內容。pause 的 frozen arrivals 與 seek 的舊 tail 截斷不同，mapped pitch 沒有真 captured cursor 時不能聲稱精確 phase restore（replay-audio L393、L438–443）。

完整離線 PCM renderer／stems／ADM 仍未實作。[RenderBackend](../../src/audio/render-contract.ts) 是 types-only seam；未來工作應沿用它與現有 AudioEngine。把即時 update API 在 context time 0 逐 frame 呼叫，不能自動排成未來 tick。分段 render 必須保存或驗證重建 delay／filter／HRTF／IR／limiter state；獨立 contexts 硬接不視為等價。OfflineAudioContext 產生 AudioBuffer，不能據此宣稱串流到磁碟或必定快於實時。[官方 API](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)

## REC-05：後續隔離量測與驗證（全部 NOT RUN）

先固定 commit、dirty diff、bundle／browser hash、裝置、供電／散熱、sample rate、scene／assets／solver config。比較相同輸入的 idle／interactive、capture、seal、save/load、replay/seek、B reevaluation，分開冷啟動與暖機、主緒與 Worker。每階段保存 p50/p95/max、bytes/frame、bytes/simulated-second、event/source/path counts、queue watermarks、tick debt、paused time、長任務／GC、完成狀態及 hash 等價。實測時長要同報 wall seconds 與 simulated seconds。

既有 `node tests/browser/run-performance-v3.mjs --phase ui --seconds 20 --output <new-path>` 只作未來診斷入口；runner 會寫共用 build 目錄，因此須在隔離 checkout 序列執行。正式600秒設定及歷史結果不改。`node tests/browser/recording-worker/run.mjs` 只量固定封存 fixture，且有歷史 Chrome／fixture pins；不為方便靜默移除 pins，也不拿它證明 live capture。新研究輸出不得寫進既有正式 artifact 目錄。

後續工作：REC-A 分項 profile 與等價 oracle → REC-B bounded sequential lane spike → REC-C quota／cancel／stop／crash recovery → REC-D 短 PCM renderer 正確性。每項另有負面案例、資源所有權及 rollback；先取得數據再採納 ADR。此研究沒有執行上述工作，沒有更動驗收、原測試、產品或服務。