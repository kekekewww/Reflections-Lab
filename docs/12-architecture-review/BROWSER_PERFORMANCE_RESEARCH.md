# Browser 執行緒、錄製與效能研究

狀態：**研究＋後續設計建議；未採納為性能保證**。查核日：2026-10-29。程式基準：`c210ca882ca8503b322c28884bf1e9f6e9fe126d`；後續微調需另附實際 diff／測試。本文不更動 [正式性能預算](../06-validation/PERFORMANCE_BUDGET.md)、[凍結驗收](../11-v1/ACCEPTANCE.md)或[已確認補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)。一般100%顯示比例為現行範圍。

## 可由現行程式確認的事實

| 路徑／責任 | 現行實作與證據 | 結論與風險 |
|---|---|---|
| `src/app/bootstrap.ts` 的 application RAF | `frame()` → `created.advance(delta)` → publication flush → 下一個 RAF | runtime scheduling 與畫面共用主緒。獨立 React state 不代表獨立 thread；layout、React、view更新、GC及本方工作都可延後 physics advance。GPU可平行執行，但draw submission／JS仍可競爭主緒。 |
| `src/app/runtime.ts:advance` → `PhysicsWorld.advance` | 固定 `1/60 s`、互動最多四步追趕；超載捨棄wall time並記錄；錄製超載pause保留tick | 固定dt定義的是模擬積分時間，**不是60Hz實時排程保證**。render卡頓會延後下一次advance；不能由「固定步」推論畫面不影響物理。 |
| `src/app/acoustic-service.ts`／`acoustic-worker.ts` | `LabRuntime`預設`useWorker=true`；原生module Worker，`busy`只允許一批；32sources、每source256surfaces、整批256paths、2MiB payload、5s timeout、128timing samples；identity/revision validation、late reply忽略 | 一般solver確實在worker。單一in-flight backpressure已存在，毋須再設一個無界待辦queue。requests仍是物件結構複製，主緒`payloadBytes`／回覆驗證及消費者成本仍在。 |
| `src/app/runtime.ts:onTick`的`capturing`分支 | 為捕捉實際event tick的傳播，對active voices＋本tick events分16source批，直接`solveAcoustics(request).frame`，隨後`recorder.appendFrame` | **錄製時每個physics tick仍有同步聲學求解熱路徑**；不能把一般20Hz worker路徑當成錄製整條鏈已平行化。應把它與互動solver、seal分項量測。 |
| `src/app/recording-host.ts`、`src/experiments/recorder.ts` | `appendFrame`由physics callback執行；sealing/publication serial；hard cap 18,000frames、64MiB trace、256objects、100,000events | trace綁integer tick，沒有用render插值當真實運動；但取樣觸發仍受RAF供應。以60Hz全數錄製時frame上限約300秒，並可能先撞bytes上限；這不是任意長度錄製。 |
| `src/persistence/blob-store.ts`／`recording-seal.worker.ts`／`recording-worker-client.ts` | 原生seal worker對凍結snapshot封存；bytes回傳使用transfer；client又做owned copy、SHA驗證、JSON.parse及deep freeze | seal worker是真正的背景封存，**不是獨立simulation clock**。主緒仍有snapshot與最終驗證／解析；70MiB bytes cap不等於總heap cap。 |
| `src/audio/control.ts`、`engine.ts`、`routes.ts` | default24voices、8paths/voice、96total paths、64MiB decoded PCM、16 late sends；hard maxima64voices／32paths/voice／256total | 256屬hard/stress cap，不能冒充產品預設聲部容量。retiring paths及late sends也消耗預算。Behavior runtime另有16logical voices／每object8，須與audio admission分開。 |
| 音訊主鏈 | 現行以原生AudioBufferSource／Gain／Delay／Biquad／Panner等AudioNode建圖；未找到產品自訂`AudioWorkletProcessor`的註冊路徑 | native graph可以運作，不等於已具備自訂Worklet、無allocation DSP或實際callback deadline證據。圖更新仍在control thread。 |
| `src/persistence/index.ts`、`blob-store.ts` | project JSON透過StorageAdapter，本機啟動使用localStorage；blobs以IndexedDB保存，缺能力時可退為記憶體。blob總預算128MiB，asset16MiB、recording70MiB | 同步metadata serialize／setItem可能阻塞。IndexedDB是非同步API，仍有JS編碼與複製成本。當前不是OPFS串流系統，也不是跨裝置雲同步。 |
| `asset-host.ts`、`runtime.ts`的export actions | `OfflineAudioContext`用於匯入asset decode／驗證；export與exportRecording輸出JSON | **尚無正式整段離線WAV輸出產品流程**。以下local/cloud render均為候選設計，不能因有OfflineAudioContext測試就宣稱已實作。 |

上述是code inspection；不是新browser／聽測／性能PASS。歷史 [ARCHITECTURE](../02-architecture/ARCHITECTURE.md)仍有「尚未實作」措辭，遇衝突以本次基準程式和實際收據確認行為，交由正式來源維護者處理，不能將舊敘述直接當現況。

## R17負面證據必須保留

[正式性能頁](../11-v1/BROWSER_PERFORMANCE.md)的R17 C4為600.051秒、19,498frames，可判讀的負面量測：physics core p95約4.8ms；default/stress worker約46.3/27.1ms；已觀測delivery約12.4/28.7ms；renderer-main wall occupancy p95約83.23ms。原physics／delivery／main目標均未通過。main wall occupancy不是CPU時間，完整delivery含pre-handler／OS等未量區段仍UNVERIFIED。

另有106.117秒interactive dropped wall time、1,222overruns、1,653paused advances、錄製超載pause與最後capture/pending失敗。窗外排空不能回填原600秒。muted native graph不提供真Worklet deadline／underrun或真人聽感證據。任何後續質量退階、裝置分級或雲端候選都不抹除原FAIL，也不把改小負載當成同一驗收通過。

## 執行責任與遷移次序

| 層 | 適合保留／移入的工作 | 禁止依賴與待驗項 |
|---|---|---|
| Main thread | UI／Pointer Lock／IME／DOM、Three/R3F view、輸入命令、bounded pose插值、AudioNode控制 | 不執行大型JSON／hash／全量solver／長時間批次。physics遷移前仍需量主緒fixed-step與每tick capture的分項。 |
| Dedicated simulation worker（建議，未實作） | Rapier固定步、normalized physics events、Behavior evaluation；帶tick/revision的snapshot；錄製時用有界批次逐tick推進 | worker沒有DOM；輸入須有sequence/tick與可取消命令。穩定domain IDs不變，不傳Rapier handle。OS可延遲worker；timer本身不是實時時鐘。 |
| 現有 acoustic worker | 有版本的geometry及source/listener輸入、有限階solver、每批有budget | 先把不變geometry按revision快取，再量傳輸改善。錄製的逐tick求解可用獨立recorded-evaluation lane，和interactive latest-pose更新分開，避免互相阻塞。 |
| Recorder/storage worker（建議） | chunk encode/hash、IndexedDB/OPFS寫入、manifest最後提交；有界queue高水位即pause producer | 一般預覽可跳wall time；**實驗trace不漏tick、不以latest-only覆蓋待寫frame**。write failure、quota、cancel與crash後殘片必須可辨識；不發Captured。 |
| Audio render thread／可選Worklet | 既有native graph；將來僅需要的bounded DSP、預配置buffer、平滑參數 | 不等physics／geometry／network／AI／storage、不做無界allocation/log。只有實際profile才能決定是否值得改Worklet。 |
| 離線render lane（建議） | pinned recording→同一路由audio graph或另驗等價DSP→PCM/WAV；與互動run分開 | 「快於實時」由裝置實測；不能替換原physics trace或把不同backend輸出當同條件。 |

建議先量清`onTick/capture`、snapshot/encode、solver compute、request/reply dispatch、AudioEngine consumer、view更新，再依收益移動physics／recorded evaluation；不要只把另一個timer放在主緒就宣稱已解耦。錄製可用「批次執行固定tick→await bounded consumers→yield」，保留同一run/tick語義；互動預覽用last-complete snapshot插值，render只讀，不反寫dynamic pose。

## 資料傳輸、SharedArrayBuffer與隔離

現況物件`postMessage`依structured clone複製；對頻繁pose/path更新，候選是固定layout TypedArray＋兩到三個buffer pool，發送`ArrayBuffer` transfer並把所有權交給receiver，receiver用完歸還。transfer後sender buffer會detached，因此不得把Scene權威或仍供UI使用的array一起轉走；metadata、revision、tick與byteLength仍須驗證。transfer減少大buffer複製，不免除message排程與JS validation。[MDN Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)

SAB僅在量測證明copy/dispatch為主要瓶頸後另開方案。一般網頁需要secure context與cross-origin isolation；常見為`Cross-Origin-Opener-Policy: same-origin`＋`Cross-Origin-Embedder-Policy: require-corp`（或經驗證的credentialless路線），並檢查`crossOriginIsolated`。跨來源WASM、script、fonts、audio、object downloads必須配CORS/CORP；OAuth popup／embedded內容需另測。現行ADR-010不要求SAB，不把新增隔離header當成無風險的小改。[MDN SAB](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)、[Google isolation guide](https://web.dev/articles/cross-origin-isolation-guide)

若日後採SAB，明定single producer/consumer、ring大小、overflow counters、Atomics publication order與generation；AudioWorklet不得阻塞等待producer。可以重用最新已完成參數，不能讀半寫frame；沒資料時採明示hold/fade策略。128frames／48kHz約2.67ms只屬常見benchmark設定，實作每次讀實際array length，不假設永遠128。[MDN process](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process)、[Chrome AudioWorklet patterns](https://developer.chrome.com/blog/audio-worklet-design-pattern)

## 背景分頁、磁碟與離線RAM

RAF在多數browser背景分頁會暫停；頁面也可能freeze/discard。將工作搬到worker不提供背景完成SLA，service worker也不是任意長運算保證。建議在visibility/freeze邊界明示pause互動實驗，先checkpoint；恢復時續同tick或明示中斷，不把背景wall gap偽裝成有資料的模擬。需要離開頁面後可靠完成的輸出才走可選雲queue；本輪未實作此流程。[MDN RAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)、[Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api?authuser=2)

IndexedDB保留小型索引／manifest；若長trace驗證確實需要大容量，OPFS可作chunk staging，worker可用sync access handle。OPFS是origin私有、受quota與清除政策限制，**不是使用者檔案備份**。以`navigator.storage.estimate()`探測剩餘量，`persist()`結果記錄為requested/granted/denied；QuotaExceededError、private mode、清站資料與中途關閉都要保留恢復方式。先寫chunk及hash，再原子發布manifest；重開只接受完整hash鏈。[MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)、[Storage quota](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

離線音訊的最低PCM記憶體公式為`durationSeconds × sampleRate × channels × 4 bytes`。48kHz stereo的30秒／5分鐘／10分鐘約11.52／115.2／230.4MB（十進位）；尚未計decoded assets、AudioNodes、trace、encode output、複製及runtime heap。PCM16 WAV再需`duration × sampleRate × channels × 2 + header` bytes；如果先持有完整float PCM再完整WAV，10分鐘最低約345.6MB，總峰值更高。OfflineAudioContext會產生記憶體AudioBuffer，不是直接串流至磁碟。[MDN OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)

長輸出候選為有overlap/state carry的chunk renderer及streaming encoder；跨chunk filter/HRTF/IR tail／delay狀態須驗證，不能獨立切段後硬接。先以最短安全local duration及headroom顯示可用性，再提供用戶自願的雲端輸出；不因RAM估算就自動上傳音檔。

## 正常筆電／高階機驗證矩陣（全部NOT RUN）

| 組別 | 設備與環境固定 | 同一測試負載／資料 | 應報證據 |
|---|---|---|---|
| 一般筆電 | 16GB RAM、整合GPU、至少四實體core級；實際型號／OS／供電／散熱／browser version/hash保存 | 原正式physics256含CCD、worker default與256stress分開、UI100dynamic、1920×1080/DPR1、100%縮放、完整600秒 | 原p95目標、長task/GC、heap、dropped wall time、paused ticks、capture完成、實際GPU、AudioContext rate/latency；不以「一般筆電」泛稱實測所有機種。 |
| 高階機 | 32GB以上、獨顯、8core級；相同browser/build/profile | **同上**，另列可選更高負載，不替代同負載比較 | 同一oracle／raw／trace／版本，避免把不同機器或不同負載相除當加速比。 |
| browser相容 | Chrome／Edge固定版本；Firefox、macOS Safari需實體對應平台 | input／WASM/module workers／storage／source graph；Firefox歷史strict FAIL保留 | 每browser PASS/FAIL/UNVERIFIED分開，禁止借Chromium推論Safari。 |
| lifecycle/storage負面 | 切背景、最小化、螢幕鎖定／睡眠、quota不足、清站資料、關閉重開 | 錄製與匯出各測pause/cancel/recovery；人工操作另列 | 無漏tick宣稱需真raw；不足即invalid/incomplete；本機persist不等於備份。 |
| 真音訊 | 同一Hi-x65／D3V聽測、裝置sample rate與實際block資訊 | pause/resume、seek、voice/path flood、delay/gain平滑 | muted graph與offline PCM證據分開；聲音聽感／硬體latency／Worklet deadline均需各自證據。 |

研究交付只核對既有程式與官方資料；本輪未重跑600秒、沒有真人聽測、沒有跨設備容量benchmark。正式性能失敗與未完成V1 gate持續保留。
