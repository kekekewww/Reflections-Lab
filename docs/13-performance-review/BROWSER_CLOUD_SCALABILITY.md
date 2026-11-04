# Browser、Client-first與未來雲端工作的容量邊界

日期：2026-11-01（Asia/Taipei）。狀態：**研究／PROPOSED，未建立或部署任何新服務，未新增付費呼叫**。基準 `05d40fd2d52f4b737f6acac61fa00356403c0038`。`CLOUD-*` 為本地研究／後續工作標籤。本頁不改原驗收、成本上限、cloud scenario inputs或已接受ADR。

## CLOUD-01：先把本機性能與雲端用量分開

依 [ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md)維持client-first：互動physics、Behavior、acoustics、3D view與Web Audio在各自使用者裝置。100／1,000／10,000個瀏覽器不等於雲端需同時開相同數量simulation instances，也不保證每台裝置都能達原性能門檻。普通acoustic Worker與seal Worker不解除main RAF及capture同步求解限制；本機排程／緩衝成本應先依[錄製審查](RECORDING_AND_RENDERING_REVIEW.md)與[資源審查](MEMORY_AND_RESOURCE_REVIEW.md)量清。

沿用 [Hybrid研究](../12-architecture-review/HYBRID_CLOUD_ARCHITECTURE.md)、[成本模型](../12-architecture-review/CLOUD_COST_MODEL.md)與[情境JSON](../12-architecture-review/cloud-cost-scenarios.json)，不另建相互漂移的平台價表。原單價查核日為2026-10-29；本輪只重新查官方browser生命期、Worker及job計費語義，**沒有完整重查價目、帳號quota、免費額度、帳單或容量**。既有九情境仍是估算，不能提升為部署建議或性能承諾。

| 責任 | 現況／候選 | 擴展與成本權威 |
| --- | --- | --- |
| 即時互動／音訊 | CODE：client；physics/capture目前仍有main工作。 | 逐裝置CPU/GPU/RAM／輸入／音訊證據，非cloud-user capacity。 |
| Metadata／asset同步／Meta控制面 | 現有loopback server及local storage；正式公開服務未完成。 | 若日後另行授權，才驗auth／tenant／durable budget及儲存流量。 |
| 本機離線PCM／stems | types-only RenderBackend seam；完整renderer未實作。 | 先做短take sample／state／phase正確性與working set，不能用trace JSON export冒充WAV。 |
| 雲端長render | PLAN：使用者明示選擇的可替換job backend。 | 先有可驗本機／backend能力與pinned inputs，再談工作限額、queue及實際費用。 |

## CLOUD-02：Browser背景不是可靠job host

[Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)說明frozen頁面會暫停可凍結tasks，discarded頁面不再執行JS；不能依賴最後callback完成任意async保存。把工作移到Worker也沒有背景完成SLA。[WHATWG Workers](https://html.spec.whatwg.org/multipage/workers.html)提醒Worker有啟動及每instance成本，因此不建議每source／frame建立一個Worker。

候選生命期政策如下；**本輪沒有實作**visibility／freeze handlers：

| 邊界 | 候選行為 | 可宣稱結果 |
| --- | --- | --- |
| hidden／即將freeze | 在最後完整tick要求pause，非阻塞地提交有界checkpoint；顯示保存進度。 | 只有已收到持久化ack的checkpoint能稱已保存；未完成者保留pending。 |
| freeze／discard／tab close | 不依賴unload或一段長async flush；持久化格式預先區分staging／committed。 | 中斷不能補成連續量測，也不稱Captured。 |
| reload／resume | 檢查run identity、last committed tick、chunk／artifact hashes及refs；同tick續行或明示interrupted。 | 不把隱藏期間wall gap插成模擬資料；不重播已到達impact。 |
| local長輸出 | 顯示需要保持頁面可用與可取消的限制；可保存工作描述供後續重試。 | 未有checkpoint能力不能承諾關頁後續跑。 |
| 未來cloud job | 自願上傳所選pinned inputs，由獨立durable job host執行。 | 在backend未實作／授權前不顯示為可用功能，也不因本機RAM不足自動上傳。 |

Browser持久儲存仍受origin quota、清站資料及eviction政策；OPFS不是備份。磁碟flush／metadata commit／恢復協定見[錄製審查](RECORDING_AND_RENDERING_REVIEW.md)，不以`navigator.storage.estimate()`估計值作真正空間reservation。

## CLOUD-03：把吞吐、等待、費用寫成不同模型

以下為解析規劃，不是load test。`λ`為接納的logical jobs/s，`A`為每job的平均attempts，`W`為每attempt完整instance lifetime秒數，`c`為並行cap。近似running demand為 `L ≈ λ × A × W`；在平穩且可完成的系統中才可用Little's Law解讀平均在途量。若 `L ≥ c`，沒有穩態等待保證；即使 `L < c`，burst、長尾、cold start、regional quota及failures仍可能造成排隊。completion latency必須分開報upload、queue wait、startup、execution、output commit、download。

| 模型項 | 計算／必備輸入 | 不可混稱 |
| --- | --- | --- |
| Local device capacity | 同scene／events／source/path counts、實際sample rate／DPR與裝置profile。 | 不以一台高階機除出「每user server成本」。 |
| CPU／RAM用量 | `attempts × billable lifetime × provisioned vCPU`；`attempts × billable lifetime × provisioned GiB`。 | 不只計DSP kernel；RAM預留與實際peak另列。 |
| Bytes與留存 | input＋asset reads／output writes／downloads／retries／retention；GB、GiB明分。 | uploads不等於unique儲存；steady-state archive不等於第一個月累積量。 |
| 全部費用 | compute＋storage＋operations＋egress＋control／queue＋觀測＋AI＋其他明示費目。 | 既有已定價小計排除AI與未建模費用，不是總帳單。 |
| 排隊與admission | global＋tenant cap、max bytes／duration／attempts、TTL／取消、budget reservation。 | 單queue dispatch速度、單job parallelism與全域並行不是同一限制。 |

[Cloud Run官方計費](https://cloud.google.com/run/pricing)以已啟動job instance的完整lifetime計instance-based費用，且有最低計費時間；startup、input準備、upload及重試均需計入。這只確認計費語義，未為使用者核實2026-11-01的價格或quota；實際重算仍必須更新全部來源與region。

既有high情境的反例可直接手算：尖峰10,000 sessions、0.05 jobs/user-hour、attempt multiplier1.2、600s/attempt，需求為100個同時attempts；duty0.75時平均仍約75，超過原cap50。cap50約只能供250 logical jobs/hour，低於375個平均到達／hour。原模型估全部最終完成的費用，沒有承諾時窗內完成；本頁不改cap、費率或工作量以消除這個不足。

## CLOUD-04：未來job契約的最小研究邊界

沿用 [RenderJob／RenderBackend](../../src/audio/render-contract.ts)而不建第二套renderer。工作需pinned recording/config/asset hashes、sample clock與window、tail／preroll、source selection、actual backend／engine／capabilities、output bytes／frames上限。container裡能啟動Web Audio或native DSP，不等於與目前browser HRTF／路由／delay／filter／limiter等價；未驗等價時必須列獨立backend及近似限制。

若日後另行授權cloud phase，先以descriptor入queue、private object refs取大資料；驗證tenant ownership、short-lived object permissions、hash／revision、idempotency、lease及全域／每user預算reserve。不得公開現有localhost server或把Origin allowlist當auth。attempt失聯保持uncertain，不靠重啟洗掉已可能發生的費用。cancel與完成發布的競爭、retry、quota、缺素材及partial output皆需保留原始錯誤，最後核驗全部輸出才發布completed。

先設定拒絕／等待／過期行為，再討論加capacity；不自動升方案、花錢、改Meta provider或上傳使用者音訊。費用預設0與現有帳號未驗條件維持。

## CLOUD-05：後續研究工作與未執行邊界

CLOUD-A先固定同負載正常筆電／高階機的本機profile，不以裝置降階取代正式驗收；CLOUD-B僅在本機短renderer存在後建立backend capability／sample alignment比較；CLOUD-C若另行授權才更新dated cost inputs並做受限job queue／auth／budget實作與獨立負面驗證。本頁CLOUD-A跨裝置候選測試、雲端load test、公開部署、服務開通、帳號／billing查詢與功耗測試均**NOT RUN**；協調者另行執行的單裝置非正式600秒研究見[量測計畫](MEASUREMENT_PLAN.md)與[最終報告](FINAL_REVIEW_REPORT.md)。

本頁的吞吐公式、初始資源規劃及生命期政策可供設計審查，不提供萬人容量、背景完成、跨backend聲音等價或完整V1完成證明。