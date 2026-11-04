# 效能與緩衝優化路線

日期：2026-11-01（Asia/Taipei）。狀態：**PROPOSED／未啟動**。主要基準 `05d40fd2d52f4b737f6acac61fa00356403c0038`。本輪交付研究、證據分類與後續任務；不實作下列優化、不變更原負載／正式性能門檻、不改產品或有效ADR。研究task完成不代表完整V1完成。

## 先做能辨認原因的工作

第一優先是001的音訊／成本歸因及014的基準／裝置能力，再依數據選擇002錄製evaluation與003native更新責任的窄修。使用者回報斷續是實際症狀；「全部計算只在同一thread」仍不能當成診斷。原生Web Audio graph、普通acoustic Worker、seal Worker、單批in-flight、FIR cache、雙filter banks與asset store已存在；不從零重做這些能力。

R17負面數字保留於[正式性能頁](../11-v1/BROWSER_PERFORMANCE.md)，其來源／環境不等於本基準。R21未提交初版、regression repair與最後dirty觀察分開，早期短profile不得綁最後source；整合前重查。詳細差異見[音訊審查](AUDIO_GRAPH_DSP_REVIEW.md)，風險與證明需求見[風險登錄](RISK_REGISTER.md)。新Chrome的研究profile不具原正式入口資格；不能以降低voices／paths、改取樣窗口或窗外drain取得原profile PASS。

排序綜合使用者影響、證據強弱、預期效益、成本、風險、依賴與撤回難度；不以猜測加速比打分。所有效益均為待量的候選，沒有工期／改善百分比承諾。

## P0–P3與完整穩定任務

短號全部屬 `RLAB-TASK-PERF-20261101-` 前綴。每項**status=BACKLOG、owner=null、所有acceptance criteria=false**；建立／索引提案不觸發執行，也不聲稱已通過。下列連結指向唯一共享task JSON；英文鏡像共用同一任務與原始測量資料。

| 任務／優先級 | 問題與候選工作 | 預期效益、成本及主要風險 | 依賴／撤回界線 |
| --- | --- | --- | --- |
| [001](../../knowledge/tasks/RLAB-TASK-PERF-20261101-001.json) P0：歸因／native output | 分開late onset、stale/rejected frame、voice/path拒絕、PCM gap、native output統計與聽感；建立source-bound低頻觀測及無probe對照。 | 避免錯誤搬遷；中成本。probe可能改圖／負載，unsupported留null，不能當零。 | 無；停止診斷並drain tap／polling資源後回原native圖。 |
| [002](../../knowledge/tasks/RLAB-TASK-PERF-20261101-002.json) P0：逐tick evaluation | capture同步solve熱路徑；研究immutable inputs與有限frame/byte lane，高水位pause producer。 | 可能縮短main capture spans；高成本。需保留全tick／事件／pre-state／phase，和008分責。 | 001；固定最後完整tick，drain或interrupt後回原同步evaluation。 |
| [003](../../knowledge/tasks/RLAB-TASK-PERF-20261101-003.json) P0：native更新分工 | 分scalar pressure gain、normalized shape、delay、direction；先重驗R21最後修補，exact去重與近似deadband分名。 | 可能減control／IR upload／copy；中高成本。保留既有cache／雙banks、group delay與raw solver真值。 | 001；完成route fade／tail後回已驗更新策略，不重啟所有sources掩蓋差異。 |
| [004](../../knowledge/tasks/RLAB-TASK-PERF-20261101-004.json) P1：snapshot／event交換 | 定義latest-valid snapshot與不可丟pending emission身分、age及epoch；沿現有一批in-flight。 | 候選可減過期工作並釐清onset等待；中成本。latest-only誤用會漏event／tick。 | 001；失效新generation，保留未到達事件並回原service。 |
| [005](../../knowledge/tasks/RLAB-TASK-PERF-20261101-005.json) P1：geometry／payload | 先量revision geometry快取與小DTO，再視copy歸因研究transfer pool；SAB另驗isolation。 | 可能減serialize／配置；中高成本。transfer仍有dispatch／validation，detach不能傷Scene／UI權威。 | 001、004；收回／取消pool ownership，回clone reference。 |
| [006](../../knowledge/tasks/RLAB-TASK-PERF-20261101-006.json) P1：phase virtualization | profile證voice／route瓶頸後才研究有限virtual slots、hysteresis、logical time／pitch／resume offset及arrival history。 | 可降低部分昂貴render工作；高成本且有音質／phase風險，實際降級須可見。 | 001、004；drain transitions／tails，回原admission，不重播one-shots。 |
| [007](../../knowledge/tasks/RLAB-TASK-PERF-20261101-007.json) P1：既有asset政策 | 在現有store量encoded／staging／decoded所有權、pins與可重建resident eviction。 | 可能減峰值；中成本，miss會增加載入延遲。不得刪recording、active／retiring／pending refs。 | 001；停eviction、保留immutable refs並按原caps工作。 |
| [008](../../knowledge/tasks/RLAB-TASK-PERF-20261101-008.json) P1：無損chunk／seal copies | 先去可證冗餘copy；研究有限encode／persist queue、水位、stop/drain與最後manifest發布。 | 可能減seal峰值／main stop成本；高成本。chunk hash不是原artifact hash，持久格式改變需migration gate。 | 001、002；保留staging及舊有效成果，回canonical整段路徑。 |
| [009](../../knowledge/tasks/RLAB-TASK-PERF-20261101-009.json) P2：simulation Worker | 前序窄修後仍證physics／main耦合才試可替換simulation owner，render讀last-complete snapshot。 | 可能隔離render長任務；很高成本，增加command latency／snapshot copy與回歸面。 | 001、002、004；僅在可驗state交接點回main adapter，否則明示reset。 |
| [010](../../knowledge/tasks/RLAB-TASK-PERF-20261101-010.json) P2選用：PCM／Worklet | native方案不足才研究有限adapter、實際block、nonblocking callback與明示hold/fade。 | 增加DSP可觀測／控制能力；很高成本，不保證較快。須驗HRTF／IR／limiter／phase與fallback。 | 001、003、004；fade/drain並關processor／worker後回native，無法續播則interrupt。 |
| [011](../../knowledge/tasks/RLAB-TASK-PERF-20261101-011.json) P2：offline renderer | 沿types-only RenderBackend，先短take sample／phase／tail oracle，再驗chunk state carry與真stems。 | 新輸出能力；高成本及RAM／state風險，不先解互動stutter。Worklet不是必要前置。 | 001、008；取消未完成job，保留pinned trace/assets與有效輸出，回短reference或無export。 |
| [012](../../knowledge/tasks/RLAB-TASK-PERF-20261101-012.json) P3：GPU／高階／多listener | P0穩定且另有功能需求後，分開研究能力、科學reference、GPU timing與能源證據。 | 新容量可能性；很高成本且收益未量。CPU降低不能換算W/J或電池時間。 | 001、014；失效新backend generation，回CPU／單listener／有限階能力。 |
| [013](../../knowledge/tasks/RLAB-TASK-PERF-20261101-013.json) P2選用：cloud jobs | 011有可驗renderer且另行授權才研究private refs、tenant/global queue、durable budget與attempt。 | 可選長輸出；很高營運／相容風險。不能替代本機音訊優化，不自動上傳／花費。 | 001、011；停admission、保留uncertain費用ledger及成果後回local-only。 |
| [014](../../knowledge/tasks/RLAB-TASK-PERF-20261101-014.json) P0基準／P1重驗 | 001後固定裝置、browser資格與原負載；候選完成後才重跑lifecycle／output／長run及真聽測。 | 建立採納／撤回依據；中高成本，需互斥負載窗口及實際裝置。未跑仍NOT RUN。 | 靜態僅001；P1逐候選安排而非反向dependency，避免cycle。原FAIL/raw保留。 |

002與003可在001後分檔、分負載窗口研究；不因可平行就同時跑音訊／性能profile。004先固定資料語義，再做005／006；007可獨立觀察assets；008處理encode/persist，避免與002重複搬遷。009、010、011是不同可替換邊界，沒有規定必須全部採納。013保持client-first與費用預設0；012在最後，不把新增高階能力當成原性能成功。

## 每項task的18欄交付規則

| 欄 | 任務中的內容 | 驗收限制 |
| --- | --- | --- |
| 1 ID／2 title | 固定穩定ID、具體問題標題。 | 不另建英文或研究專用替代工作系統。 |
| 3 problem／4 evidence | 問題、實際code／result定位及版本；真正evidence用已存在檔案和實際hash。 | 讀碼不冒充測量；R17、05d40、R21各階段不混。 |
| 5 affected modules／6 solution | 明確檔案邊界與候選解法。 | 所有本輪解法維持PROPOSED，未實作。 |
| 7 alternatives／8 benefit | 保留現況、較小改動與其他方案；質性預期效益。 | 沒有量測不報加速比、節能或品質提升。 |
| 9 complexity／10 performance | 實作／驗證成本及CPU、wall、allocation／native／GPU等影響。 | 成本不是工期承諾；wall不等於CPU。 |
| 11 audio quality／12 latency | phase／tail／spatial／render近似；onset／control／device／d/c。 | buffer類型與時鐘分別命名，不以物理delay當排程餘裕。 |
| 13 compatibility/regression risk／14 dependencies | 格式、API、能力／browser與原fixture風險；前置task。 | accepted契約變動另經審查，dependency不自動啟動。 |
| 15 benchmark／16 acceptance | 固定source／負載／裝置、負面案例、oracle／tolerance及可檢驗criteria。 | criteria全部false直到真正驗證；原門檻不降低。 |
| 17 rollback／18 priority rationale | 執行中drain／取消／state／所有權復原及排序理由。 | 不只寫revert commit；保留原raw與使用者成果。 |

每項共享task另有schema要求的description、status、priority、owner、dependencies、acceptance_criteria、relevant_files、evidence與created/updated時間。source定位是工作依據；未來成功證據及criteria不可預填。純研究交付沒有新增產品測試或測量的暗示。

## 採納與驗證閘門

1. **基準閘門**：001／014 P0取得實際source、bundle、browser資格／版本、硬體、供電／散熱、viewport/DPR、scene／asset／voice/path及裝置資料。無法取得欄位留UNKNOWN/null。正式資格拒絕與研究profile分別保存。
2. **正確性閘門**：固定trace及獨立oracle先確認tick、事件、revision、pre-state、source phase、delay只計一次、path來源與tail。任何持久格式／hash／schema變動先做獨立相容性／migration提案。
3. **收益閘門**：相同負載列compute、copy／dispatch、consumer、native控制、CPU/GPU、p95/p99/max、穩態／peak memory、queue age與actual output。control成本下降而latency／品質退步不能只報成功；unsupported及未量項保留。
4. **生命期閘門**：候選各自跑014 P1的pause/resume/seek、background/freeze/sleep、quota、cancel、worker/context失效與dispose。回復須能辨識最後accepted/persisted/published tick，不將incomplete標Captured。
5. **採納閘門**：獨立review、回歸與回復證據齊全才提採納／ADR變更；BACKLOG轉態由後續明確任務操作執行。本輪不自動做優化、服務、付費API、push或部署。

600秒wall profile必須另報simulated seconds與capture frames。現行18,000-frame ceiling在60Hz約300秒，且可能先撞bytes上限；600秒窗口中短錄製成功不等於600秒連續capture。正常100%為現行顯示範圍，200%不是必要真人gate。Hi-x65／D3V裝置聽測、材質反射與其他未驗項目各保留既有狀態。

整合維持[審查契約](REVIEW_CONTRACT.md)：最新target有dirty內容時交已審文件Patch，不stash／reset／覆寫／merge；保留Wiki events，以來源與時間reconcile後重建索引、英文鏡像及hash。研究branch與文件可審查不等於產品完成。

Geometry／payload候選沿[pose-aware提案](proposals/ADR-PERF-04-worker-communication.md)：geometryRevision目前等於sceneRevision，移動物件必須依pose重建world surfaces或以完整變換內容作key。014啟動時凍結有限的baseline／候選清單；清單外的後續候選沿用方法並在各自task保存結果，不持續擴張或重開014的完成範圍。
