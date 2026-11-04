# 非進階功能、完整操作驗證與交接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成使用者選定的非進階功能與實際驗證，包含長錄製／長音檔、原生 Computer Use、Playwright、完整管線、階段記憶與 Claude Code 完整交接；不以舊版成功或較小候選替代本輪目標。

**Architecture:** 沿用現有 React／R3F／Rapier／Custom Acoustic Core／native Web Audio。以固定輸入與資源所有權契約分離錄製、聲學交換、音訊資源、素材與離線輸出；跨域 runtime 只由 Root 接線。每條實作線在專案內完整工作樹，獨立快取與產物；重型測試及真 browser／音訊／性能獨占本機時段。

**Tech Stack:** Node22.17.0、npm11.4.2、鎖版 TypeScript／React／Three／Rapier、IndexedDB、Web Workers、native OfflineAudioContext、Playwright、computer-use skill。

**Spec:** `docs/16-nonadvanced-completion/CONTRACT.md`；`knowledge/tasks/RLAB-TASK-PERF-20261101-{001..008,011,014}.json` 原條款；`docs/11-v1/ACCEPTANCE.md` 與最新 amendments。Task0032 是本輪 umbrella，原 tasks 仍是唯一各領域驗收權威。

## Global Constraints

- 基底為真實 main `e25f9f48302fd357b0f97a6f9bf8565f5916627c`，新樹在 `D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/`，分支前綴 `codex/nonadvanced-`。舊樹／未提交檔及原始失敗保留。
- Scope：PERF001–008／011／014、Task0020／0016新的完整需求對帳及使用者要求的兩類實際操作。Task0015、PERF009／010／012排除；PERF013雲端與新付費／push／部署不自動授權。
- 保留 SI／右手+Y/-Z／xyzw、fixedDt=1/60、互動 catch-up≤4、record/A-B不丟simulation ticks。不得用 teleport、清除欠帳或改 admission 偽造正確性／性能。
- 原 recorder 18000frames／64MiB、in-flight 8frames／32MiB及其他現行 caps 不暗改；必要容量變更須明示新能力、RAM／輸出／持久格式預算及正負案例。既有 Recording schema1.0.0、canonical artifact SHA及encoded UTF8 SHA保留語義。
- Native DSP callback不等AI／network／geometry／physics／storage，不做無界allocation或log。Logical事件／phase與native render slots分離。
- 既有短take renderer不是未實作；本輪須真正支援長於30秒的安全長輸出、分塊儲存與接縫／相位／filter／delay／HRTF／IR／limiter連續性。不得只新增writer或unsupported標籤就稱完成。
- 優先以每tap整段單一native graph保留opaque DSP state、分段控制／編碼與持久化；內存中仍存在的完整AudioBuffer要據實計入峰值。不得硬接多OAC或把有限overlap冒無損state carry。實作可另提更好的完整方案，但不得偷加排除的自訂Worklet後端。
- UI沿既有 DESIGN_SYSTEM、tokens、Component/FPS/Motion與固定Emil來源。所有新可操作參數進inventory，合法／非法／邊界／保存復原及狀態都有真UI證據。
- 使用者要求兩種方法：原生Computer Use及Playwright。各自保存真實輸入方法與有限覆蓋矩陣，不以CDP／hidden bridge冒原生，不以內部Host call冒產品操作。
- 原生工具若拒絕或policy停止，保存真錯誤，停止該工具並續做不受影響工作；只有真正解除外部條件後補驗，不能假PASS或縮小goal。
- 主觀真人／專項聽測依使用者排在Claude後；本輪數位／browser／native輸入與硬體統計不冒聽感或校準SPL。Meta新付費仍為0，帳號／預算需要時另由具體可審結果取得授權。
- Root單寫 runtime.ts、source-phase.ts、package/config、共用UI接線與整合Git index。音訊owner單寫engine.ts；storage owner單寫blob-store.ts。其他代理在自己樹提交自有檔與lane報告。
- 唯一memory writer更新knowledge sources/tasks/now/log與English metadata；lane報告是既有task的stage投影，不建立另一套task系統。重要stage批次checkpoint，最後source freeze再finalize全英文。

## Review Focus

1. 同revision但物件／Listener／材質／role已變：cache必須依實際pose/content失效，不能使用舊world geometry。
2. virtual／retiring／pending／record／offline同時借素材：最後一個lease結束前不得evict；舊generation release不能移除新資源。
3. quota／cancel／crash在chunk commit前後競爭：只有完整transaction才推persisted/published；原有效成果不遺失。
4. 長輸出在chunk邊界有移動／pitch／path birth/death／IR或limiter狀態：sample origin、完整DSP歷史及stems relation不可重置。
5. FPS／Build／editor／record／replay／重建切換：鍵鼠所有權、Esc／blur、取消／retry／Undo及可見限制一致，native與Playwright各保存實際來源。

## Task 1：基底、驗收、工作樹與歸因基準（PERF001／014 P0）

Files: 新增 `docs/16-nonadvanced-completion/`、本計畫、`tests/browser/nonadvanced/`；量測lane可新增bounded telemetry純模組，既有 `engine.ts`／`runtime.ts` 接線交owner。
Interfaces: consume原正式performance profile／browser資格及現行AudioEngine diagnostics；produce帶source/bundle/browser/device/scene/workload/probe狀態與actual/null欄位的固定run manifest。
- [ ] 保存原要求／annotation1、原criteria、排除範圍、唯一task0032及file ownership；固定有限baseline/candidate清單。
- [ ] 新完整checkout確認鎖版依賴，跑typecheck與原runtime；保真raw／exit／Git hashes，原FAIL不覆寫。
- [ ] 先寫歸因RED：stall／late onset／snapshot refusal／voice/path rejection與PCM gap不能互相冒名；unsupported/null不可變成0。
- [ ] 補bounded低成本觀測與probe-off/on對照；baseline與候選同負載、CPU／GPU／browser獨占，不混跑build/test。
- [ ] 保存正式資格拒絕與研究profile差別；browser更新若需新qualification先獨立能力證據與新version，不改負載／門檻。

## Task 2：錄製與分塊持久化（PERF002／008）
Files: `src/experiments/recorder.ts`、`recording-worker-client.ts`、`recording-seal.worker.ts`、`src/persistence/blob-store.ts`；自有測試 `tests/experiment-runtime/recording-chunks*.test.ts`／`tests/persistence/recording-chunks*.test.ts`。
Interfaces: 保持 `BlobStore.saveRecording(artifact: RecordingArtifact): Promise<StoredRecordingReceipt>`、`loadRecording(runId: string, sha256: string): Promise<RecordingArtifact | null>` outward語義；新增chunk manifest／watermarks／ownership放自有小模組，public變更先Root核對。
- [ ] 對舊monolithic路徑寫RED：chunk staging、最後manifest atomic publication與有界encode／save queue必須可觀察。
- [ ] 保留現有8frame lane，去除可證冗餘所有權；實作chunk encode/persist與可恢復的commit策略，不把prepared metadata當trusted bytes。
- [ ] 用舊canonical codec作獨立reference，驗exact bytes／兩種SHA、連續tick／順序／phase、舊資料載入與新資料往返。
- [ ] quota／abort／duplicate／crash／reopen／orphan cleanup／transaction completion負測，失敗舊artifact仍有效。
- [ ] 跑原recording lane/host/worker/blob-store回歸；保存capture→seal→save→replay峰值與時間分項，提交lane報告。

## Task 3：素材生命期與resident管理（PERF007）
Files: `src/audio/assets.ts`、`src/app/asset-host.ts`；新增lease/residency純模組，新增 `tests/audio-runtime/asset-leases*.test.ts`／`tests/app/asset-residency*.test.ts`。不改blob-store／engine。
Interfaces: consume既有 `saveAsset/loadAsset`、AudioAssetBankEntry／descriptor IDs/revision/SHA；produce冪等scoped lease與可重建eviction計畫，engine/runtime接入由owner。
- [ ] RED：active/retiring/pending/frozen/record/replay/offline重疊借用時不evict；無pin時可釋放resident並精確reload。
- [ ] 在既有store實作引用保護／decode staging／generation ownership；同步解除AssetHost強引用，不能只delete Map而不釋放實際PCM。
- [ ] 失敗decode/cancel仍保原資產、未完成native decode仍計reservation；舊lease release不影響新版本。
- [ ] exact SHA/revision reload、quota／context rebuild、cold/warm resident與recovery證據，提交Root接線所需API。

## Task 4：聲學交換與pose-aware幾何（PERF004／005）
Files: `src/app/acoustic-service.ts`、`acoustic-input.ts`、`acoustic-worker.ts`；新增 snapshot-policy／pending-emission／geometry-cache小模組與 `tests/acoustics-runtime/`、`tests/app/`專有tests。
Interfaces: 保持現有source/epoch/revision/listener/model pins及worker envelope；cache只共享immutable local geometry或完整pose/content key，所有權與pool有明確generation。
- [ ] RED固定現有逐source latest-valid與不可丟pending emission；亂序／duplicate／timeout／reset／source removal不能漏或重播事件。
- [ ] RED：同sceneRevision卻pose改變、material／role／analytic-volume／source自排除改變，world geometry必須更新。
- [ ] 實作增量cache／較小payload及有界交換；需transfer時證明detach/return/crash/cancel/pool耗盡安全，不暗加SAB隔離headers。
- [ ] 與原clone／solver reference比path IDs／vertices／bands／delay／identity／admission；數學容差不放寬。
- [ ] 同負載量copy／allocation／age／onset／consumer成本，沒有收益的候選不得靠降低更新率或刪paths偽稱改善。

## Task 5：native更新與phase保留的virtualization（PERF003／006）
Files: audio owner獨占 `src/audio/engine.ts`、`routes.ts`、`control.ts`、`route-response.ts`；純virtual policy／timeline及專有 `tests/audio-runtime/virtual*.test.ts`可分子代理，但不雙寫engine。
Interfaces: logical deterministic admission、recorded AudioEvents不變；render slots與logical voice/timeline分離，native及virtual cursor的provenance不混。
- [ ] RED：native slots不足時virtual timeline仍依pitch積分前進，promote從正確phase恢復；one-shot到期不重播。
- [ ] 保留已有scalar/shape分工與穩定path IDs，實作bounded virtual slots、hysteresis、pending arrivals／tail／resume政策。
- [ ] 與Task3 lease整合，runtime pending不能把virtual視同permanent rejection刪掉；source-phase側由Root接線。
- [ ] 原delay只計一次、path birth/death／crossfade／pause/rebuild／release、leak及digital output負測。
- [ ] 同source／load驗control／IR upload／output continuity與deadband誤差；native CPU不可觀測就null，不猜callback成本。

## Task 6：實質長輸出與分塊音訊（PERF011）
Files: `src/audio/render-backend.ts`、`render-validation.ts`、`render-types.ts`、`render-pcm.ts`及新chunk writer／artifact sink／incremental hash；`src/app/render-host.ts`歸renderer owner，UI/runtime接線Root。
Interfaces: consume既有RenderJob／RenderInput／RenderConfiguration／AudioEngine；produce完整RenderResult與可逐一下載的WAV/manifest。若RenderFile改Blob/chunk ref，須全callers向後相容與檔案hash明示，不序列化native objects。
- [ ] RED：60秒以上48kHz stereo真native圖在合法預算下可完成；5種既有輸出與owner stems合法選擇，超cap清楚拒絕。
- [ ] 實作長於30秒的實際native renderer；每tap一個不中斷graph保DSP history，精確全域sample origin，控制／存檔chunks不得重設filter/HRTF/IR/limiter。
- [ ] 實作bounded分塊WAV編碼／hash／持久化與取消，減少PCM副本；完整nativeAudioBuffer成本仍明算，不聲稱無上限streaming。
- [ ] 有delay、移動方向／path、pitch、IR與limiter狀態的chunk接縫與整段reference比較；chunk重組payload exact及stem sum原2e-6等既有容差不放寬。
- [ ] 真browser OAC、長run、cancel/retry/quota/crash不發布半成品、數位finite/peak/hash/channel/frame／tail與完整history標示。
- [ ] 新UI能力、範圍、progress／cancel／下載／歷史artifact兼容由Root接線後兩種操作法驗。

## Task 7：產品接線、模式與全部參數（Root／UI）
Files: Root單寫 `src/app/runtime.ts`、`src/experiments/source-phase.ts`、共用UI／locale／styles／package/vite/test入口設定。
Interfaces: 消費Task2–6經review的public seam；頻繁狀態不經React固定步，不新增重複AudioEngine或資產store。
- [ ] 各候選先RED／GREEN、獨立review再正常merge integration；共用接線每次只引入一個完整可測機制。
- [ ] 保留設計語言；新功能給清楚可用入口及限制，不只新增隱藏API／diagnostics讓使用者不可操作。
- [ ] 刷新全UI AST／semantic families，對每個控制列default/range/type/state/persistence/undo/method與實際證據，不藏新項於舊217分母外。
- [ ] editor/FPS/Build／held/ghost／run/pause/record/replay／切頁／blur/Esc／engine rebuild／取消retry等完整有限矩陣。

## Task 7b：目前版本Meta產品閉環與展示接線

Files: Meta owner專責server/provider與AI純模組及自有fixtures；共享runtime與UI接線仍Root。
Interfaces: 沿既有可信工具、revision／generation、持久budget ledger、preview→Apply→真run/artifact→grounded comparison；不新增模型OS／repo／shell權限。
- [ ] 當前source離線fault fixtures先驗proposal／完整arguments／拒絕／取消／重試／成本reservation與UI結果，不重寫已完工具。
- [ ] 核實目前live provider及catalog／schema相容，key只在server，費用gate維持0；若需要新的付費call，先備可審乾跑結果與明確次數／總額後取得使用者授權。
- [ ] 有授權後以當前source真產品UI完成最小live閉環並保model ID／redacted trace／真runtime結果；歷史minimal Sound live不得冒當本輪live。
- [ ] 沒有live授權或provider外部可用性時保存明確gate並續做其他stage，不能假稱live或自行換付費服務。

## Task 8：Computer Use與Playwright完整產品驗證（專屬browser lease）
Files: `tests/browser/nonadvanced/`、`docs/16-nonadvanced-completion/verification/{playwright,native,pipeline}/`及外部exports專案內目錄。
Interfaces: 只透過正常產品UI匯入fixture／操作；DOM/evaluate只作觀測，不用HostInternal完成行為。原生輸入由computer-use skill，Playwright另列方法。
- [ ] 先凍結case與source/bundle/viewport/locale及mode／參數交叉索引；全部先NOT_RUN。
- [ ] Playwright完整有限參數/狀態/錯誤復原與全管線，保留原FAIL→根因→修補→受影響重驗。
- [ ] 真native操作同一產品與各模式／關鍵手勢／參數可用性／全管線，保存每次工具輸入、觀測與真正下載，不把scriptedDOM當native。
- [ ] 長錄製→chunk保存→reload/replay→相同motion A/B→long mix/master/dry/stems逐檔匯出→獨立byte/hash/sample驗證；兩種工具各有真實操作紀錄。
- [ ] Native工具或帳號外部gate未解除仍是未完成，續做其他工作並按真正goal blocked audit，不假完成。

## Task 9：最終同負載效能、驗收表與獨立程序
Files: 量測／獨立review自有tests與 `docs/16-nonadvanced-completion/verification/`；新版本requirement ledger，不覆寫R17。
Interfaces: 本輪immutable source/bundle/資產／workload/device metadata、固定candidate清單、各自真正actual/null欄位。
- [ ] 每個候選及最終source各量同負載，分producer/evaluate/commit、main/physics/worker/delivery/native control/output、queue age／resident／峰值。
- [ ] 600秒wall／sim／capture durations分報；原18000frames及bytes cap不變時不冒600秒連續capture；原FAIL和qualification拒絕保留。
- [ ] lifecycle pause/resume/seek/background/freeze/sleep/quota/cancel/context/worker crash/dispose按有限case逐項重驗。
- [ ] 原全check／type/lint/format/build/licenses、受影響scientific reference、真OAC/UI與獨立review；依原criteria裁定每PERF task。
- [ ] 新51requirement+amendment crosswalk串本輪證據，Task20/16與歷史metadata按真條件更新，不冒整體V1/聽測/Meta live。

## Task 10：階段記憶、英文、Main與Claude完整交接
Files: 唯一memory writer管理knowledge／正式current入口／English；Root只整合Git與對外報告。
- [ ] 每個完成stage輸出固定command/exit/raw/source/hash/limits與變更清單，batch CAS ingest→task/page→checkpoint，保新舊版本。
- [ ] source freeze後一次全英文finalize/check與Wiki lint；不每個小動作反覆使generated三頁stale。
- [ ] 最終獨立review及同source真UI/PCM/性能證據齊全後，正常本地合併main，保原分支與user檔；不push/deploy/歷史改寫。
- [ ] Claude完整交接涵蓋架構/接口/所有變更/測試命令與原FAIL/未解限制/資產與exports實體位置/重驗清單；CLAUDE後驗未執行及最終人工仍標下一階段。
- [ ] Root按goal逐條completion audit，原生／Playwright／功能／性能／記憶有缺漏則goal保持active，不以剩餘時間/單一綠燈縮scope。
