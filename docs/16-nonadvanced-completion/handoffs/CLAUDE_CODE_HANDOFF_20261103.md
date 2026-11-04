# Reflection Lab：Claude Code 接手報告（2026-11-03）

這份報告由使用者要求直接轉交 Claude Code，目的是接手尚未完成的實作、獨立驗證與修正。Codex 開發目標目前為 paused；本次只核實 Git／既存證據、保存未提交成果及更新交接記憶，沒有啟動新產品測試、瀏覽器、效能長跑或功能開發。這是工程交接，整體非進階功能與第一版驗收尚未完成。

**Claude 請從下列 D 槽整合工作樹接手，不要從 C 槽舊 checkout 或舊 Claude 工作樹開始。** 使用者交付本報告後，請依完整範圍繼續實作與驗證；獨立審查、修正完成後，才由使用者進行最後人工操作與聽測。

## 1. 現況與接手入口

| 項目 | 本次實際核對 |
| --- | --- |
| 主整合工作樹 | D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/integration |
| 分支 | codex/nonadvanced-integration-20261103 |
| 交接前已存在的最新提交 | 448a503f5373faccc19aa17c6789ffc01bc26017 |
| 本機 Main 工作樹／HEAD | D:/Developing/Meta Hack；e25f9f48302fd357b0f97a6f9bf8565f5916627c |
| Main 整合情況 | 本輪成果尚未合併回 Main；盤點時 Main 為 integration ancestor，差170個可達提交，不代表170項功能 |
| 最新產品 src tree | bc1ad463b3de9351255e2d4b22f80175b73daf93；後續文件提交不可冒充重新驗證產品 |
| 工具鏈 | Node22.17.0、npm11.4.2；版本權威為 .node-version／package.json／lockfile |
| 交接時程序觀察 | 2026-11-03T05:27Z 對4173／5241／5353／5194未見 Listen；沒有匹配的舊測試程序，只匹配到盤點自身 PowerShell。接手仍須重新核對，不代表全機沒有其他程序 |

448a503 是交接前的產品／文件整合基準；本報告與記憶保存若另有文件提交，以實際 git log 為準，不在文件捏造自身提交 SHA。本次不 merge 產品分支、不移動 Main、不 push、不部署。

先依序讀：

1. 根 AGENTS.md → knowledge/schema.md → knowledge/wiki/index.md → knowledge/wiki/now.md。
2. knowledge/tasks/RLAB-TASK-0032.json、RLAB-TASK-0033.json，以及相關原 PERF／Task0016／0020。
3. docs/11-v1/ACCEPTANCE.md、ACCEPTANCE_AMENDMENTS.md、REQUIREMENTS.json。
4. docs/16-nonadvanced-completion/CONTRACT.md、BASELINE_20261103.json、LONG_OUTPUT_FREEZE_20261103_V3.json。
5. 本報告與 [Git 盤點](claude-20261103/GIT_HANDOFF_NOTES.md)、[驗證核實](claude-20261103/VERIFICATION_AUDIT.md)、[完整範圍核實](claude-20261103/SCOPE_AUDIT.md)。
6. [M4 階段交接](M4_PARTIAL_CLAUDE_HANDOFF_20261103.md)與 stages/00–04、對應 SNAPSHOT_INDEX；這些固定歷史截點不改寫為較晚結果。

本報告中的 paths 除完整 D:/ 或 C:/ 外，皆相對於 integration 根目錄。證據 [EVIDENCE_INDEX.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5490a9f25e7180765b225d696ab2f7b656bc0af7)與各審核 JSON 提供原位置／bytes／SHA。大型 PCM、trace、bundle 仍有未入 Git 的實體檔；不能只複製報告便刪原樹。

## 2. 已完成的實作與證據範圍

### 既有六核心及前次交付

前次核心包括有界錄製／A-B、音訊更新拆責、能力／Bounce／Zone、Meta 實驗流程、Motion authoring、同 AudioEngine 離線 mix／stems renderer；另有 Zone 真進出、球／膠囊遮擋與有界動態反射、Project 環境持久化。前次217個有限參數 families 與五個5秒 WAV 有實際證據，已在 e25 基準歷史中。

這些是已存在的功能與歷史證據，不要重新寫一套；但不能拿前次1536 runtime／217 families／5秒 WAV 抵充本輪最新功能、60秒長管線或正式效能。前次完整交接見 docs/14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md，原始證據見 docs/15-ui-parameter-audit/。

### 本輪頂部監測區

已刪除無實質用途的 Build scene／Interactive experiment／Inspect & compare 頂部導覽，改為可切換四種視圖，沿用既有設計與雙語：

- Levels：實際來源與 master L/R，來源顯示可辨識名稱與穩定 voice instance ID；零訊號、未知及未就緒分開。
- Spectrum：實際 Blackman FFT，標示 Hz／dBFS，支援 L/R。
- Waveform：實際左右聲道波形，顯示縮放僅影響觀測，不改音訊。
- Load：實測 RAF 間隔、physics wrapper、Worker solve、audio control 更新耗時。這些不是整個程序 CPU 百分比，也不是 native DSP CPU；無資料不能填0。

觀測迴圈最高15Hz，canvas imperative 更新、不逐畫格設 React state；分析器按需要建立與釋放，有限來源／聲道預算。Footer 的 listening／mute／gain／buffer／raw／simulated／reverb 控制保留。模式切換可保留選取與一種有效未儲存 Zone 草稿；不是所有草稿類型已驗。

主要實作：src/ui/TopMonitor.tsx、top-monitor-model.ts、top-monitor-loop.ts、top-monitor.css；src/audio/live-monitor.ts／engine.ts；src/app/live-monitor-labels.ts、live-monitor-observation.ts／runtime.ts。

### 錄製、音訊、儲存及方法工程

- Worker prepare ACK 及 generation／取消／timeout 所有權已接入；開始前等待準備，不在 audio callback 等待 Worker／網路。
- 94995984 的 storage-ready gate 已整合至735cb747；真 backend.create／transaction 完成後才開始 admission，與 Worker 共用原10秒準備期限。取消／重設／dispose 保護舊成果，不自動 Resume。
- readVerifiedJobSnapshot 已正常整合：一次驗證歷史 job descriptors／全部 chunks／hash／sequence，再核對 pins；取消／額度／交易完成與原錯誤保留。有65個元件案例，不能當真長音檔或真 IDB 整體通過。
- 資產 scoped lease／pin／LRU／cold restore／decode staging、runtime capture／replay／offline finally 保護與 preview replacement 修補已有候選整合；仍須真 OAC／reload／資源成本驗證。
- 音訊 resource policy 有保留 phase／cursor 的候選與負面生命期測試；預設仍 reference/off，未因短 PCM 通過便宣稱全面採納或效能收益。
- Acoustic pose-aware cache／compact packet 候選已有實作與元件證據；預設仍 clone reference，尚未完成同一真 corpus 的 A/B/C/D 成本／等價比較。
- Meta server envelope／reader ownership／UTF-8／redirect／credential 等窄修及 fixture 測試已有；本輪沒有新付費 inference，沒有新的 authenticated live integration 證據。
- V4 效能 collector／原 trace 語義資格／CPU 觀測／fail-closed parser 與611個方法案例已整合。方法可收集數據不代表產品性能合格。

## 3. 已跑測試：哪些是真的，哪些仍未過

### 最新整合與監測區

| 驗證 | 實際結果與限制 |
| --- | --- |
| Monitor 元件 | 83/83；與較後118有重疊，不可相加 |
| 1f3779 整合回歸 | 七檔118/118，17.801s，global tsc exit0；不是完整 npm run check |
| b902 V4 collector | 611/611，5.090s；是方法測試，不是600秒性能 |
| 1f258 最新準備 gate | global tsc exit0；production／e2e build 各exit0 |
| Production Playwright attempt03 | b7ade 固定 bundle：4 PASS／1 FAIL，0 page errors／0 model calls |
| 短 native phase／lifecycle | 10對20份各2秒 PCM，maxAbs1.62112216e-7、relative RMS8.55679227e-9，在原2e-6內；不是60秒連續錄製 |
| Native meter／FFT | 固定375Hz／48k同 clock：波形差0、DFT誤差4.29683e-7dB；有 mute／release／dispose 證據，不是硬體聽測 |

Playwright attempt03 通過四模式／鍵盤／focus／L-R／ZH-EN、實際 levels／FFT／waveform／load、mute／pause、390／929／1440 CSS px、footer／viewport 控制與選取／Zone 草稿保留。失敗案例為錄製 fixed-step guard（global tick87），在該版本無法保持錄製推進，不能推論是切換按鈕造成。

來源：docs/16-nonadvanced-completion/lanes/top-monitor-browser/ATTEMPT03_REPORT.json、test-results/top-monitor-production-attempt03/。較晚 storage-ready 產品尚未完整重跑這五案。

最新成功 build receipts：
.cache/nonadvanced-20261103/root/top-monitor-production-build-attempt06.json（dist .cache/top-monitor-production-attempt04）
及 .cache/recording-readiness/e2e-build-attempt03.json（dist .cache/recording-readiness/e2e-dist-attempt03）。
兩者 buildHEAD 是1f258，不是尚未合併的 df838 observer。原 receipts 的 completedAt 使用 logmtime／事後 pin 範圍須照原文，不升格成建置前 capture。

### 錄製 diag04：準備修補有效，持續吞吐仍失敗

這次觀察來源 c321b02、build1f258，第一個 guard 確定來自 storage：

- storage create 完成73.3ms後才建立 Worker；prepare ACK約147.6ms，gate 確實生效。
- 首筆 append 約83ms，已有1 frame persisted，之後仍 pending8，觸發原背壓。
- 當時 evaluation accepted14／committed8／pending6，未背壓；storage accepted9／persisted1／pending8，已背壓。
- 透過公開 Stop 成功封存14個連續 accepted frames52..65。這只是合法 prefix，不是60秒完成或持續吞吐通過。
- 首筆83ms不是穩態成本或純磁碟延遲，不能直接歸因 IndexedDB、GPU 或單一函式。

df838 已在 recording-readiness 分支加入有界 advance 診斷：first8／last2／first overrun、capture identity、host flush 與 advance／onTick／publish 分開；尚未合併 integration。它不涵蓋 Worker reply 的 async commit 同步工作，不能因 advance 耗時低便排除主緒瓶頸。

**後續 async commit 分段耗時／batch size 觀測尚未實作。** 清查沒有這段未提交 source。原 storage audit 46da指出 append 還含 SHA、UTF-8 decode／JSON parse、身份驗證、固定讀取與 transaction completion；同幀也有重複 frame walk／encode，但缺實測成本。

不要提高8 frame／32MiB queue、丟 accepted tick、清欠步、縮負載或自動 Resume 來換綠。

### 效能 WIRING-01：CLI0，產品門檻明確未過

實際資料在 baseline 工作樹：
artifacts/v1/perf-nonadvanced-20261103-v4-wiring-01/。
另有保全副本 docs/16-nonadvanced-completion/lanes/performance/v4-wiring-01-evidence/。這批 raw／壓縮保全／部分報告仍 untracked，尚未完整封存到 integration。

status = MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD；
formalQualified=false；overallV1=false。CLI exit0只代表收集完成。這次是20秒 UI wiring pilot，**最新來源的正式600秒尚未執行；歷史600秒 FAIL保留。**

| 子測試 | 原負載與實測 |
| --- | --- |
| Physics | 256 bodies＝255dynamic＋1fixed，CCD64，3000步；native p95=2.5ms，未達原2ms；complete fixed tick p95=16.4ms |
| Acoustic productDefault | 8 sources／native voices，每voice pathcap8、目標64，600次；20.000267Hz，但deadline misses20，20Hz windows=false |
| Acoustic stress | 同8 sources／voices，pathcap32、目標256，600次；19.993458Hz，deadline misses21，20Hz windows=false |
| Native consumer chain | productDefault／stress p95=6.3／14.5ms，未達原1ms |
| Stress paths | 量測視窗新增 droppedPaths76（85−warmup9）；current＋retired 共256，退場路徑可能占容量，但唯一根因尚未證明 |
| UI | 105objects／100dynamic，20.1791秒、804 frames；frame p95=50.1ms>16.67，RAF callback42.8ms>4，main occupancy50.026ms>4，皆FAIL |
| UI validity | uninterrupted／fixedTick／noDebt／periodicCapture 等條件未過；不是完整合格負載 |
| Native underrun | 累計2已在 warmupAfter；20 samples與結尾沒有再增加，窗口 delta0；不當作聽測或 PCM 無中斷證據 |
| CPU | Win32 before／after均OBSERVED且exit0；8→9程序新增TracingService，所以 whole CPU total／ratio為PARTIAL／null，不是0也不是API讀失敗 |
| 實際環境 | headless Chrome156.0.8078.75；ANGLE NVIDIA RTX4070 D3D11。不能由 flags含SwiftShader就說實際用SwiftShader |

不要混淆 physics256 與 UI105，也不要把 stress每voice cap32 寫成32 voices。

方法本身還有兩個需先修的事項：

1. before CPU endpoint目前在 Tracing.start之前，導致新增TracingService無共同起點。候選是在既有 await Tracing.start完成後、beginUI前才取 before，after維持。需新版本、source-order／生命期測試與獨立 review；明示不含Tracing.start準備成本，不用補零或更換視窗。尚未實作。
2. transitive performance-attribution-metrics-v1.mjs漏列既有 source pin set。下一版補 pin；舊 sourceStable=true只能支持原已列集合，不能倒補歷史 capture。

指定 Chrome semantic前置曾通過並被採納，qualificationId為 semantic-v3-c59df8c64fdfa846d6e22daf，非Git SHA。
exe SHA：7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa。
若版本／exe改變需重新資格核實；原50ms native gate、正式 workload／門檻不改。native DSP CPU仍null，程序CPU不可代替DSP。

### 長輸出：有真音檔，數值與完整矩陣尚未過

產品五個 WAV＋manifest 曾實際完成下載，但原 whole63 reference master gate仍 FAIL：
maxAbs 2.9802322387695312e-6；321 samples超原2e-6；該次57/58。
不能用同長62／cropped／簡化圖的結果覆蓋原失敗，也不能只略過開頭或放寬容差。

診斷16檔僅14完整、1 partial、1 missing；完整六對 paired matrix尚未取得。

- pairedV2：DSP call約150秒 ERROR／timeout，五個比較false、第六缺結果，沒有新下載或獨立完整 parser。
- snapshot-based pairedV3 source85524212已在 offline-render，不在 integration；有8個方法測試與舊固定PCM88個欄位等價證據，不是新 native長輸出成功。
- pairedV3一次卡在 startup，沒有新DSP值。startup-probe-v2的 page原2秒失敗、無goto／HTTP／DSP；不能推論 fullV3 page10秒也失敗。
- b317 cleanup改善與 ed7 startup錯誤／settled cleanup證據已提交該分支。後來只準備 startup-probe-v3排序修改：先launch／connect／context／blank page，再listen，避免冷啟動階段重疊；未實際跑新probe，未完成最後type／lint／review／sourcefreeze。
- offline-render中6個untracked檔已逐byte另存 [WIP快照](archive://uncommitted-local/docs/16-nonadvanced-completion/handoffs/claude-20261103/untracked-source-snapshot/offline-render/)，合計45,437B；請從原樹審查，不直接把快照當已採納patch。

長輸出原規格仍是60秒signal／3600 accepted ticks、48k stereo、2個stable owners、2秒tail＝62秒／2,976,000frames；5WAV（master／raw／simulated／2owner stems）＋manifest，單WAV23,808,056B，五檔119,040,280B。
3601 inclusive只獨立容量fixture，不多一tick擴renderwindow。context75秒、working256MiB估算、output192MiB、archive384MiB／64jobs、chunk32768、原capture18000frames／64MiB不改。

## 4. 分支與未提交內容：接手先保全，再有序整合

所有本輪工作樹都在專案內的 D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/。
完整13樹、commits、dirty清單見 [WORKTREE_INVENTORY.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/35fee8c93f8f6c2caedbb31812d59aa6b40a1b92)。

| 工作樹 | 目前tip／接手注意 |
| --- | --- |
| integration | 448a503；docs/en有29個tracked修改，另有recording readonly finding與top-monitor報告未追蹤；保留，不廣泛stage |
| recording-readiness | 46da1f62516b0154b3ef2db3eb7c3d7e904723e2；4個未在integration可達提交：c4e77 diag04、eff1正常merge c321、df838 observer、46da唯讀append audit；source clean |
| offline-render | ed7bc0eeb00c120973d7959ec66773f3e206466c；6個未在integration提交＋上述6個untracked檔。d182 snapshot與Root b8d5是同實作歷史，不要重複視為新功能 |
| baseline | 6ba01b44b57a4741a7e58fb42718e71875b776f3；僅1個未整合source-freeze文件commit，但206個untracked含wiring raw／壓縮保全與歷史方法收據；先封存再清理 |
| render-performance | c321b02d133934606673a32014f83dfa4b77a9e4，乾淨；沒有renderer優化實作或WIP |
| 其他8樹 | acoustic-transport／asset-lifecycle／audio-resources／audio-retirement／meta-demo／recording-storage／top-monitor-ui／ui-recovery tips均已為integration ancestors；不等於各scope完整驗收 |

錄製分支正常merge前先檢查Root已有gate／diagnostic harness，不重複覆蓋；offline-render要審查正常merge的相同snapshot歷史與測試差異。先處理工作樹／新增檔與evidence ownership，不做 reset --hard／clean／強制移除。

舊工作樹仍有使用者與歷史資料：Main129untracked；C舊checkout11modified＋7untracked；舊Claude樹9350dirty（9339deleted＋11modified）及602untracked。這些是觀察不是本次修改，不要擅自還原或刪除。C舊checkout與舊Claude都在429efb7，不能作本輪最新來源。

已安全移除的只有原clean且Main ancestor的 environment、render-tail-validation；共用node_modules junction目標及lockfile前後SHA曾核對一致。其餘dirty／raw樹保留。新依賴junction指向 D:/Developing/Meta Hack/node_modules，不要遞迴刪junction目標。

## 5. Claude 執行順序與每步完成條件

### P0：先讓錄製與量測可信，再修真瓶頸

1. 核對 Git／dirty／untracked／原始artifact，保存基準；正常整合可審查的recording observer與long method候選；不要批次merge未審patch或動舊private樹。
2. 擴充有界 async commit診斷：capacity同步call／capacity await wall／Recorder＋enqueue同步成本、既有encoded bytes／write batch size，按capture identity保存first8／last2等有限標量。不要保留frame buffer、重編碼或callback記log。
3. 新source／harness／fresh build／HTTP核對後，只跑一個新10秒觀察／45秒test的recording diagnostic；開始preparing不當recording，不延長觀察窗，public Stop封存。以真數據定位序列化／hash／主緒／IDB交易，再窄修。
4. 保持accepted／processed／persisted／published四水位、原順序／canonical hash／錯誤與容量。真IDB／cross-tabWebLocks／cancel／crash／reload/incomplete／舊成果保護與容量負例全部驗證。
5. 同一最新production bundle重跑頂部五案，錄製持續且切四視圖／來源／聲道不能中斷；驗source identity、草稿與dispose。4/5不能冒整體通過。

### P1：長輸出與效能可並行寫碼，重負載串行執行

1. 完成startup-v3那6檔的方法驗證／type／lint／review／sourcefreeze；一次startup-only probe通過後，再執行完整pairedV3：62A／63A／63B／62B四個fresh native graphs與六對原容差比較。
2. 保存每stage walltime、有限partial及真清理；序列5產品WAV及必要診斷下載、獨立RIFF／PCM／frame／rate／channel／hash／stem sum與整段／邊界reference。歷史321 overs持續保留，修正原因後用相同條件證明。
3. V3目前260,307,504B＝248.249MiB只是保守live-reference估算，非實測processRAM；確認未同時保留Trace／多個native PCM／snapshot。不能以release引用等於GC已完成。
4. 修V4 transitive pin與CPU endpoint順序，保留舊raw和PARTIAL/null；測試／review後新freeze。先同負載probe-on/off與read-only歸因，才接受收益或啟用候選。
5. 尚未實作的renderer候選：src/ui/viewport/SceneEntities.tsx的SolverPath因path DTO identity每publication重建Geometry／Vector3／Material／Line，可保留有限resource並更新資料／驗cleanup。Root目前只有審核結論，零patch；不可聲稱已修。不能減64paths／vertices／精度／陰影／DPR／速率來過效能。
6. Runtime.publish有per-object find及path DTO配置成本候選，還沒有各段實測；getPose已有同snapshot＋alpha快取，不要誤認每物件重算整場。
7. Stress256 current＋retired總cap與76 drops需根據原契約設計，不能提高256、刪退場fade或鬆容量斷言。Audio deterministic fan-in tree只是未驗提案，Float32求和順序會改，未獲新數值證據不可宣稱修好whole63。
8. 同一真physics／behavior／request corpus執行 acoustic A未快取clone／B快取clone／C未快取packet／D快取packet，oracle／stale／ownership／cost等價；資產與voice policy同條件phase／pin／resident／staging／latency比較，無收益者保留reference。
9. 原完整600秒正式負載／門檻與qualifications完成，與20秒pilot分開。缺nativeDSPCPU保持null；process／RAF／callback／device／聽感各層不混稱。

### P2：全產品驗證與真音檔管線

按 docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_RUNBOOK.md：
fresh source／bundle／exe／HTTP freeze，串行跑22routes，**必須 --lanes all**，runner預設僅recovery、且不build／啟server。
249 mixed registry rows＝歷史217＋21overlap scenarios＋11topmonitor，不是249個唯一參數，更不是全PASS。

範圍包含 Editor／FPS／Build／退出／lock／focus／IME、ZH-EN、所有可達參數、Help及disabled理由、合法／非法／精確邊界／undo／redo、save／load／import／export、Meta offline／拒絕／rollback、完整capture／A-B／render／archive／recover／download／delete／discard。

真完整管線：Scene／Rapier → motion/contact／sound behavior → acoustic geometry/solver → unified native audio → capture/persist/load/replay/A-B → offline master/raw/simulated/各owner stem →逐一實際下載與獨立解析。不能用內部直接呼叫冒DOM點擊、用trace JSON冒PCM，或只驗下載檔名。

Windows Computer Use與Playwright必須各有自己的結果；原生正常100%必要，200%已由使用者移除，不重列gate。

Computer Use目前因URL-confidence政策STOP未通過。請讀可用的正式computer-use SKILL，使用其允許的Windows操作工具；先前只成功一次已授權Ctrl+N建立視窗，沒有完成產品操作／匯出。不可用Playwright／headedDSP／私有IPC／另一工具繞過方法阻擋，不讀私人Brave頁。若仍無法安全辨識可信產品視窗，需由使用者手動建立指定local視窗，再按工具規則重新辨識，不能保證政策解除；如仍STOP則照實記外部阻擋。

### P3：品質、記憶、英文、Main與人工前交付

- 在同一最後sourcefreeze跑完整 npm run check、build、適用numeric／physics／acoustic／audio與獨立review；保留原三次乾淨product E2E、十次reset/import/dispose的要求與次數。不要拿scoped GREEN代全check。
- docs/16-nonadvanced-completion/requirements/REQUIREMENT_CROSSWALK_DRAFT_20261103.json仍是51列草稿；按原literal條件、current evidence逐項裁決，不直接改全PASS。
- Task0032目前僅AC01=true，其餘AC02–09=false。Task0033 AC01/03/04/05=true，AC02/06/07=false。本次寫交接不自動使AC09／AC07整條為true。
- Task0016／0020與原PERF依賴／criteria不縮；歷史true保原scope，不冒目前重新通過。
- 每階段 source manifest／task evidence／相關wiki／checkpoint／handoff／Now序列更新；shared memory及Git index各只一writer。原鎖與事件保留，用正規CLI claim／release與optimistic hashes。
- 文件最後全英文current與sourcehash／semantic review、license／NOTICE／CI／重現命令對帳後，才正常合併本機Main。沒有push／deployment授權；不要把本地大歷史推上公開main。
- 使用者最後人工觀察／聽測在Claude完成之後；先前基本功能回報不重開成另一輪相同人工測試。

## 6. 英文文件與共同記憶尚待收尾

108份英文及另一批30份已分別提交ba206589／448a503，並非整套最終驗收。最後一次global finalize仍exit1：
575 originals、545 required＝545 translated、0missing／0stale、4errors／15warnings。

4errors全為 docs/en/11-v1/REQUIREMENT_EVIDENCE_20261027.md 的歷史test-results連結。四href已dirty修至既有同bytes的committed aliases，target SHA b31ff1eeae3a51b068bdf4b1793fe8f2d83994612ff25e3112e094c390043dfa；單檔scoped PASS1，claims與canonical未改，**global修後尚未重跑**。

docs/en/index.md／manifest.json／validation.json與相關英文檔仍有tracked變更，保留。下一次finalize前保存原失敗JSON／manifest／log，使用fresh attempt，不能篡改舊結果；本報告與新的Now／status還會帶來新增英文要求。0missing／stale不是fullEnglish PASS。

M4已有160檔記憶封存，checkpoint d3532745-f33c-46ed-984c-d5098b826f24，固定較早1f來源。M5尚未完整工程驗收；本輪只新增「暫停並轉交Claude」交接，保留M4歷史。CLI handoff與Now可定位新事件；Task32/33在盤點時IN_PROGRESS；本次交接正常release合作claim後，CLI依既有規則轉為READY供Claude認領。criteria全文與真假不變，READY不是完成，也不是驗收降級。

## 7. 建議分工與可用命令

可用三個互不覆寫的開發lane：A錄製runtime／storage、B長render方法／DSP、C viewport／效能方法；一個獨立review／UI驗證角色，加單一memory／Git整合writer。先確認各檔owner，避免runtime／engine多人同寫。程式分析／小測試可並行，build／native audio／browser／profile重負載使用同一機器時序列執行。舊Root的ephemeral lease不是Claude需無限等待Codex批准的gate；接手後由Claude自己排程，仍守使用者預算與安全邊界。

基本只讀啟動：

~~~powershell
Set-Location -LiteralPath 'D:\Developing\Meta Hack\.worktrees\nonadvanced-20261103\integration'
git status --short
git log -8 --oneline
git worktree list --porcelain
node scripts/wiki/cli.mjs status --format json
~~~

依賴使用既有鎖版；若需乾淨安裝，先確認node_modules是否junction與其共用owner，不盲目npm ci改共享依賴。最終品質命令為 npm run check；本報告核實沒有重跑它。

已存在可重現的focused入口：

~~~powershell
node --import tsx --test tests/integration/performance-v4-method.test.mjs
node node_modules/@playwright/test/cli.js test --config tests/browser/top-monitor-production.config.ts
node node_modules/@playwright/test/cli.js test --config tests/browser/nonadvanced/recording-readiness/diagnostic.config.ts
node tests/browser/nonadvanced/run-s4-ui.mjs --lanes all
~~~

上述Playwright需先freshbuild／receipt及正確preview；設定fresh TOP_MONITOR_RUN_NAME、TOP_MONITOR_PRODUCTION_DIST、TOP_MONITOR_BUILD_RECEIPT，或 RECORDING_READINESS_ATTEMPT／DIST／BUILD_RECEIPT。不能直接用預設覆寫既有attempt。新observer merge後，diagnostic sourcepin需納入src/app/recording-advance-diagnostics.ts；topmonitor實際input也要同步，重建bundle／receipt，不能拿舊17／20產品pin與舊build冒新來源。

歷史wiring精確指令（僅供重現方法；不要覆寫原output，先修上述方法）：

~~~powershell
node tests/browser/run-performance-v4.mjs --seconds 20 --phase all --physics-iterations 3000 --acoustic-iterations 600 --probe-mode on --qualification semantic-v3-c59df8c64fdfa846d6e22daf --top-monitor-mode levels --top-monitor-input master-left --audio-policy-arm reference --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe' --output 'artifacts/v1/perf-nonadvanced-20261103-v4-wiring-01'
~~~

S4正式execute命令與完整freeze／原timeout見CURRENT_RUNBOOK；全22輪沒有已證實的整體hard wall上限，不把22×20分鐘child預算當實際耗時承諾。

## 8. 範圍與完成定義

包含PERF001–008／011／014、Task0016／0020完整對帳、頂列監測追加需求、完整雙方法UI／參數／真長管線、階段記憶與交接。排除Task0015、PERF009／010／012；cloud013未授權。新paid API預算0，不代接受條款／提交競賽／部署／push，Meta key只在server且不入Git。

沿用React／TypeScript／Three/R3F／Rapier／Web Acoustic Core／Web Audio及既有設計，UI前讀docs/05-ux/DESIGN_SYSTEM.md、canonical tokens、Component／FPS／Motion規範及reflection-lab-design-system／Emil skills。不要另做視覺重設。重要數學／schema／時序／ownership修改需meaningful tests與獨立reference，不以測試照抄實作自證。

科學／準靜態聲學近似、dBFS≠SPL、Hi-X65／D3V真裝置聽測、本人資格／外部條款／根LICENSE等分開列；fixture或歷史最小Meta Sound live不代表本輪完整live。原STOP／FAIL／NOT_RUN／null不得改成PASS／0。

Claude交付前應給使用者：實際最終Git／Main狀態、做了什麼、每項current驗證、未過及外部限制、完整逐檔WAV與manifest清單、可重現命令、更新後Now／task／checkpoint／交接，以及最後人工測試入口。任何未完成條件如實保留，不因交接文件寫好或單一suite exit0宣稱完整第一版完成。
