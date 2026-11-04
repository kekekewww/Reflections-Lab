# 效能與緩衝風險登錄

日期：2026-11-01（Asia/Taipei）。狀態：**研究／PROPOSED；風險排序不是已證實根因、修復或產品驗收**。主要程式基準固定為 `05d40fd2d52f4b737f6acac61fa00356403c0038`。本頁不更動產品、設定、既有測試、正式預算或有效 ADR；後續工作見[優化路線](OPTIMIZATION_ROADMAP.md)。

## 證據閱讀規則

- **CONFIRMED BY CODE**：固定基準可重查的資料流、限制或保護；不提供成本大小或音訊品質結論。
- **CONFIRMED BY BROWSER PROFILE（歷史）**：R17 原收據及其固定來源／環境；不是05d40或R21的重測。
- **USER REPORTED**：R21斷續觀察；實測bundle、輸出路徑、buffer與CPU負載未完整取得，根因尚未證實。
- **HYPOTHESIS／NOT MEASURED**：可證偽機制或缺少量測；不得由事件晚到、snapshot拒收或RAF延遲直接推算native output underrun。
- R21 dirty 初版、regression repair及最後觀察bytes是不同版本。早期短樣本不能綁到最後修補，也不能因功能測試通過宣稱平順。版本與hash界線沿用[音訊審查](AUDIO_GRAPH_DSP_REVIEW.md)。

所有優先級是後續工作的建議。表中短號 `001` 等對應 `RLAB-TASK-PERF-20261101-001` 等完整ID；任務全部保持BACKLOG、owner=null、criteria=false，沒有自動啟動。

## 風險矩陣

| ID／可觀察症狀 | 候選機制與已有保護 | 證據層級、來源及版本 | 優先級／需要的證明 | 後續任務 |
| --- | --- | --- | --- | --- |
| R01 音訊斷續但原因不明 | 晚onset、graph更新、device underrun、tail截斷及監測負載均可能不同；native graph已有獨立render責任，控制仍由main發起。 | USER REPORTED＋HYPOTHESIS；[音訊審查§2／§7](AUDIO_GRAPH_DSP_REVIEW.md)分類R21早期與最後dirty；[engine](../../src/audio/engine.ts)為05d40。 | P0；相同輸入逐項比對event lateness、PCM/output gaps、可用playbackStats、裝置率／latency及觀測擾動，缺欄回null。 | 001、014 |
| R02 錄製反覆暫停、模擬時間落後 | RAF供應physics；capture每tick同步solve、clone／freeze及append。普通acoustic Worker與seal Worker已存在，不能代表capture獨立。 | CONFIRMED BY CODE；[runtime](../../src/app/runtime.ts) onTick、[recorder](../../src/experiments/recorder.ts)；[錄製審查REC-01](RECORDING_AND_RENDERING_REVIEW.md)，05d40。R17失敗為歷史。 | P0；分項capture p95/p99、tick debt、queue水位與完成狀態，證明無漏tick／event／cursor。 | 001、002、008 |
| R03 參數更新密集、音色／方向跳動 | 主基準相同target也可重送ramp；FIR cache與雙bank已在。R21已做deadband／coalescing，最後修補只將lookahead留給onset。 | CONFIRMED BY CODE＋HYPOTHESIS；[routes](../../src/audio/routes.ts)、[band-filter](../../src/audio/band-filter.ts)；[音訊審查§4](AUDIO_GRAPH_DSP_REVIEW.md)。R21只為dirty補充。 | P0；量控制訊息／IR upload／cache copy／native時間；exact去重與近似deadband分開比較，不宣稱raw聲學精度不變。 | 001、003 |
| R04 發聲等不到合格frame | 主基準超過3ticks可整批拒收；pending event與source pose更新生命期不同。service已有一批in-flight，不缺第二個queue。 | CONFIRMED BY CODE；[acoustic service](../../src/app/acoustic-service.ts)、runtime solve；[音訊審查§3](AUDIO_GRAPH_DSP_REVIEW.md)，05d40。 | P1；量request/reply age、pending admission age；驗scene/run/epoch失效、最終有效snapshot與事件身分分離。stale不冒充新結果。 | 001、004 |
| R05 delivery／main慢且solver歸因未明 | geometry重複組裝、payloadBytes、structured clone、驗證與consumer可能有成本；尚未歸因。transfer不消除排程／驗證。 | CONFIRMED BY CODE＋HYPOTHESIS；acoustic service、[既有browser研究](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md)，05d40 code對照。 | P1；分geometry建構／serialize／dispatch／validate／consume及bytes，先比較revision快取與transfer；SAB需另證isolation相容性。 | 001、004、005 |
| R06 voice／path拒絕或尾音消失 | logical與native admission不同；active、retiring、retired routes及late sends均占預算。沒有phase-preserving virtual voice系統。 | CONFIRMED BY CODE；[voice admission](../../src/audio-behavior/voice-admission.ts)、engine；[音訊審查§5／§6](AUDIO_GRAPH_DSP_REVIEW.md)，05d40。 | P1；獨立記各層reject／steal／tail／resume phase；不得刪physics事件或改已錄logical decisions。 | 001、006、014 |
| R07 匯入／切換資產出現峰值或失敗 | decoded AudioBuffer可重用、decode reservation及有界concurrency已存在；encoded、staging、decoded與native memory可重疊。 | CONFIRMED BY CODE＋NOT MEASURED；[assets](../../src/audio/assets.ts)、[asset host](../../src/app/asset-host.ts)、[資源審查MEM-01](MEMORY_AND_RESOURCE_REVIEW.md)，05d40。 | P1；量cold/warm decode峰值與取消、hash/ref、active asset pin；使用現有store，不新增競爭cache。 | 001、007 |
| R08 stop／seal／save／replay峰值大 | transfer後仍有owned copy／hash／parse／freeze；A/B、artifact與replay owners可重疊。資料cap不是process RAM cap。 | CONFIRMED BY CODE＋HYPOTHESIS；[worker client](../../src/experiments/recording-worker-client.ts)、[blob store](../../src/persistence/blob-store.ts)；REC-01、MEM-01，05d40。 | P1；每stage所有權／backing store及峰值；先去可證冗餘copy，格式改變須另過migration gate。 | 001、002、008 |
| R09 畫面卡頓連動physics或錄製 | main RAF、render submission、input、fixed-step仍共緒；搬到Worker有message成本及命令時序風險。 | CONFIRMED BY CODE＋HYPOTHESIS；[bootstrap](../../src/app/bootstrap.ts)、[FixedClock](../../src/physics/fixed-clock.ts)、[browser研究](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md)，05d40。 | P2；先證001/002/004後剩餘瓶頸；command revision／atomic undo／stable ID／fixedtick與插值等價。 | 001、002、004、009 |
| R10 自訂PCM／Worklet引入新underrun | 目前為native graph，無產品custom processor。另建render backend可能新增ring、callback配置、跨緒同步與HRTF差異。 | CONFIRMED BY CODE＋HYPOTHESIS；[音訊審查§3／§8](AUDIO_GRAPH_DSP_REVIEW.md)、[Audio runtime](../02-architecture/AUDIO_RUNTIME.md)，05d40。 | P2，選用；僅native方案不足時開；實際block length、callback耗時／underrun、no-wait、fallback及sample/phase一致性。 | 001、003、004、010 |
| R11 長離線輸出OOM或chunk接縫 | 完整renderer仍未實作；OfflineAudioContext單份PCM與stems可大，delay／filter／HRTF／IR／limiter state不能硬切。 | CONFIRMED BY CODE＋NOT MEASURED；[render contract](../../src/audio/render-contract.ts)、[REC-04](RECORDING_AND_RENDERING_REVIEW.md)、[既有offline研究](../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md)。 | P2；先短take sample origin／phase／tail oracle，再chunk state等價與peak memory；不把JSON trace export標為WAV。 | 001、008、011 |
| R12 高階功能拖累現有單listener場景 | GPU、higher-order或multi-listener收益未量；CPU wall、GPU duration與energy proxy不同。 | NOT MEASURED；[MEM-04](MEMORY_AND_RESOURCE_REVIEW.md)、[acoustic core研究](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md)。 | P3；原P0穩定後才量；error/energy accounting、capability與相同負載；不得以CPU下降推算省電百分比。 | 001、014、012 |
| R13 隱藏／sleep／discard後遺失或重複 | Workers沒有背景完成SLA；最後async flush可能來不及，尚未證實完整checkpoint恢復。 | 官方來源審查＋HYPOTHESIS；[CLOUD-02](BROWSER_CLOUD_SCALABILITY.md)、[REC-03](RECORDING_AND_RENDERING_REVIEW.md)，05d40能力界線。 | P0 baseline／P1 candidate；實際visibility／freeze／sleep／close，核最後accepted/persisted/published tick，不補造中間資料。 | 001、008、014 |
| R14 quota／cancel／crash留下假Captured | IDB已有immutable refs／budget；未有chunk持久協定。OPFS與IDB無本案跨API原子提交。 | CONFIRMED BY CODE＋官方來源審查；blob store、REC-03，05d40；新chunk為PROPOSED。 | P1；transaction complete、partial／orphan辨識、cancel/stop競爭、hash驗證及復原；不刪既有有效成果。 | 002、008、014 |
| R15 雲端方案掩蓋本機問題或增加費用 | client-first已採納；可選長job尚未有backend。queue、auth、tenant、durable budget及跨backend等價仍需證。 | ACCEPTED ADR＋NOT MEASURED；[ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md)、[CLOUD-03／04](BROWSER_CLOUD_SCALABILITY.md)。 | P2，選用；先本機renderer；另行授權才驗費率／quota／job限額；不自動上傳、不開服務或花費。 | 001、011、013 |
| R16 用新診斷覆蓋舊FAIL或變更負載取得PASS | R17是負面歷史；新Chrome研究入口不具原正式資格。降低voices／paths、改窗口或窗外排空皆不是原profile通過。 | CONFIRMED BY BROWSER PROFILE（歷史）；[正式性能頁](../11-v1/BROWSER_PERFORMANCE.md)、[審查契約](REVIEW_CONTRACT.md)。 | P0；固定source/bundle/browser/硬體/scene與窗口，正式及研究收據分開，原門檻原樣保存。 | 001、014 |
| R17 早期R21數字被綁到最後修補 | 初版短樣本與regression repair source hashes不同；自動功能PASS不證明output平順。 | CONFIRMED BY CODE／既有收據盤點；[音訊審查§2](AUDIO_GRAPH_DSP_REVIEW.md)。最後dirty可能再改。 | P0；整合前重查HEAD、status及hash；最後source需重新量，同時保留較早負面觀察。 | 001、003、014 |
| R18 文件merge混入產品修改或覆寫共用記憶 | Claude目標有R21 dirty；跨worktree的claim不是全域鎖，source/task/page有實質衝突。 | CONFIRMED BY CODE／Git盤點；[preflight](evidence/preflight.json)、[審查契約](REVIEW_CONTRACT.md)、[Wiki操作](../09-knowledge/WIKI_OPERATIONS.md)。 | 本研究交付P0；允許清單diff、最新target比較、events保留/reconcile/rebuild；dirty時只交Patch，不stash/reset/merge。 | 研究task REVIEW；非優化任務 |

## 風險處理與停止條件

先做001及014的基準部分，再用單變因、同負載、可回復的候選處理002／003。沒有正面證據時保留HYPOTHESIS；若改善onset卻增加互動延遲、phase錯誤或尾音缺漏，不能只憑較低CPU採納。native統計不可用時保留缺口；不為取得統計而默改產品或新增COOP/COEP。

錄製保留每個已接納整數tick、事件順序、pre-state與cursor；高水位暫停producer而非覆寫。資料格式、hash、solver精度、動態物理權威或accepted ADR需要改變時，停止「窄優化」並另提相容性／migration審查。沒有取得所需裝置、受控輸入或實際output證據，就把對應結果留NOT MEASURED／NOT RUN；本研究完成不解除既有V1 gates。
