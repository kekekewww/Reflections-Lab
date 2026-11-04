# Audio graph、DSP 與音訊連續性審查

狀態：**研究完成的程式盤點＋PROPOSED 後續工作；不是修復或音訊合格證明**。查核日：2026-11-01。主要基準為 `05d40fd2d52f4b737f6acac61fa00356403c0038`，研究 checkout 不套用 R21 未提交產品變更。本頁不改聲學公式、門檻、Scene／Recording schema、產品執行緒或音訊實作。

## 1. 結論與證據範圍

目前產品透過原生 Web Audio nodes 渲染；控制、solver 回覆消費與 AudioNode／AudioParam 更新仍由 main thread 發起；API 的兩緒與 control-message 模型見 [W3C §2.2–2.3](https://www.w3.org/TR/2021/REC-webaudio-20210617/#control-thread-and-rendering-thread)。這同時否定「音訊 sample 全部由主緒逐 sample 計算」與「有 audio thread 所以主緒不會影響聲音」兩種推論。現行程式已具備穩定 path identity、decoded asset 重用、FIR response cache、雙 filter banks、fade、分層預算與 cleanup；下一步應找出剩餘的 control／graph／device 成本，不能重複宣稱要從零補上這些能力。

使用者回報斷續是待定位的實際症狀；特定根因尚未被本研究證實。`lateEvents`、過期 frame、voice／path 拒絕、PCM gap、native output underrun、Worklet execution deadline 與人耳聽感是不同證據。本頁只讀程式、既有收據與官方資料，**未重跑R21最後修正的音訊harness、離線PCM或真人聽測**。協調者另以05d40已提交基準執行非正式600秒研究，結果見[量測計畫](MEASUREMENT_PLAN.md)及[最終報告](FINAL_REVIEW_REPORT.md)，不能替代R21最後bytes重測。本頁提及的測試是既有 coverage，不能當成本輪 PASS。

承接而不重複 [20261029 browser 研究](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md)、[acoustic core 研究](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md)、[Sound Behavior 研究](../12-architecture-review/SOUND_BEHAVIOR_RESEARCH.md)及 [ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md)。既有 Worker／transferable／SAB／offline-render 候選不因此變成 accepted 實作決策。正式數字仍以 [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md)為準。

## 2. 可重查基準與 R21 階段

下列路徑／行號均指主要 commit，並非 dirty R21 行號。SHA-256 為本研究 checkout 的實際 bytes；Git blob ID 另固定 Git 內容，避免換行轉換誤會。

| 主要檔案 | SHA-256 | Git blob |
| --- | --- | --- |
| `src/audio/engine.ts` | `365d9832ef462b262d093c0541ab95e6adbd5e8c932d1087e7c297155d49c2e0` | `4b2352e1ee6369fb7d550858d5c47365affdad90` |
| `src/audio/control.ts` | `4cf55ecbf59091a0193122c0b3c44e264b3d865f68f4896844923ca103c31b92` | `7e601f0bce0707aaec2ef30f61fafb0224c1dc4d` |
| `src/audio/routes.ts` | `72f8fda5726a29c45ddeabc60f65087f7e9cf5f619de887ef152b28ae90b8a1d` | `284625376bc4d19daa0889611ae8477fd0adc249` |
| `src/audio/band-filter.ts` | `f3e5cb2b6d1ad0301d44cd4f7092b0a4d4c621826484c5ed0588549c611f2693` | `0bd5437ab90c26e973d6dbdff610e4ac74281ee6` |
| `src/audio/late-reverb.ts` | `2e8836bc47f575b200b1a6f6d61ca1e84be99ea18266c91625a4de2503e80209` | `d5f7a4cc868d977cdfda3ec51403b796caf53e53` |
| `src/audio/assets.ts` | `3e5f7c7823b947c1271d0ddb1a3362d3824da74402003ac0dbbc016c8c0fc677` | `17ee8dc23353d015feafcf1e5bfa1c4833fd8498` |
| `src/audio-behavior/voice-admission.ts` | `8f934412b2113d206dcb4ec3a77142953d9e98153ea91ef4c3ee75af3fc3d76f` | `35a972b9cdc38847cd1e49b1ede66fb77caab9fb` |

R21 只在 `D:/Developing/Meta Hack/.claude/worktrees/meta-hack-r18-handoff-d292c8` 唯讀觀察。以下 artifact 名稱相對該 checkout；未假設它們已存在本研究分支，也不匯入其產品檔。

| 階段 | 實際差異與證據 | 可宣稱／不可宣稱 |
| --- | --- | --- |
| R20 committed `05d40fd` | 相對舊 `a5f2a90`，audio 變更為 monitor gain 範圍、產品 headroom 設定與可選 WaveShaper ceiling；`buffer-preset.ts` 不在 commit | native graph 基準；不能把 R21 preset 描述成已提交能力 |
| R21 初版 dirty | `artifacts/v1/r21-audio-smoothness-20261101/verification.json`（SHA `c8413a6681ace5ff750050f36dca017cdd01688b08a4da391d7da58eaa80edbd`）綁定 engine `e2d07bf4ac8f7b214421cf0c4dada6c49f522c50fe95d2ba369eb2bf880a53d1`、control `25f0028f9f66dc793a7717c354ab830b452d5ef90195ad1b3ee9ce9202e460c8`、routes `bfc702c221f6ba9b8614b4f1aa4999c0435d0217da136ed8e42080d16d081824`；初版報告含 future continuous automation、470 個 audio/app 與 1080 個 runtime 測試 | 屬較早修補階段的收據；不能對應較晚 repaired code 或倒推音訊平順 |
| R21 regression repair dirty | `REGRESSION_REPORT.md` SHA `67fdd14e5e97705f6aac7f25f6f78ebe610332ca6beef09ef4be7b40136e0898`；`artifacts/v1/r21-fps-controls-20261101/review-source-manifest.json` SHA `de61f1a4aeb49471fc1a6d0e6382b29fdab90a5ad2a4725492dbababeb73851f` | 修補後 continuous automation 回到 currentTime；lookahead 只用於 onset。報告指向490／1102測試，並明示修補後 smoothness harness 尚未重跑；本研究未重跑或完整重驗其測試收據 |
| 本研究觀察到的最後 dirty bytes | engine `515d158fb8bae22e52a8805281418c4f73cc1416196de28984f129de1363584f`、control `3afa1252bccae701b5c7a6d51c68f5bb3f180120f3df65a30b12b98847859d24`、routes `57da0e83cdf09dd549db7498aa81c1c0bdecd351063fa8023e08ed88d66320f9`、types `543b132ae44ab9a8ff36d72aae075b327932d4b632fcfe8dd6043d4e7174b9bd`，均與最後 review manifest 相符；buffer-preset `d13bd3382644c55867f7d0139b73d45ce9be89115684b6620ac58b4b431780e4` | 已讀現況有 presets、restart、cached admission、target deadband、listener frame coalescing 及 optional playbackStats；不重做此產品修補。後續整合前仍須重新比對最新 bytes |

既有 `baseline-r20-notap/summary.json` 與 `after-r21-notap/summary.json` 為 Chrome `156.0.8078.4`、約20秒短樣本：editor 的累計 underrun 分別19／0.1848秒及74／0.8029秒；fps-walk 分別14／0.1429秒及38／0.4042秒。`dropoutCount` 均為 null、graph node 建立數相同，simulated duration 不同。這是必須保留的較早負面觀測，**不是 regression repair 最終 bytes 的量測，也不是受控因果／正式容量比較**。不得以初版功能通過覆蓋它，亦不得用它斷言最後修補一定退步。

## 3. 實際 audio graph 與時鐘

```text
source -> optional content lowpass -> contentGain -> envelope
  envelope -> rawMix
  envelope -> stable direct/early PathRoute -> simulatedMix
  envelope -> earliest-path late PathRoute -> LateReverbBus -> simulatedMix
rawMix + simulatedMix -> runGain -> headroom -> monitor -> muteGain
  -> optional DynamicsCompressor -> optional product WaveShaper -> destination
PathRoute: Delay -> two FIR Convolver/Gain banks -> pathGain -> HRTF Panner
```

- [engine](../../src/audio/engine.ts) L68、L133、L154–190：產品自有 context 以 `latencyHint: interactive` 建立；未找到產品 `audioWorklet.addModule`／`registerProcessor`。`tests/browser/device-hearing/hearing-probe.mjs` 的 silent processor 只觀察 block size，不是產品 mixer 或 deadline profiler。
- 同檔 L206、L778、L862–909：`audioEpoch + emission - simEpoch` 排 source onset；晚超過1ms只加 `lateEvents`，實際排在 `max(currentTime, requested)`。absolute propagation delay 只由 route DelayNode 加一次。沒有回補遲到發聲已錯過的 sample；物理延遲不是排程餘裕。
- [runtime](../../src/app/runtime.ts) L1034–1059：主要基準把任一超過3ticks的 solve batch 整批拒絕；pending native voice 等可用 frame 才開始。這可延後 onset，但不能直接證明既有 continuous loop 的 sample underrun。
- 實際產品設定在 [runtime](../../src/app/runtime.ts) L1894–1897，使用 unity monitor、0.5 headroom 及 outputSafetyClip。engine 自身的預設值不同，測量時要記錄實際 host options。
- engine L203–371、L1255–1329：pause 保持 context 運行，以20ms fade建立 interrupted boundary，保存 logical cursor與有限未到達片段；resume重建 native source。這不是原 source/filter state 的逐 sample 無縫續播。source position使用 authored pitch積分，不是硬體 playhead。
- engine L1417–1470：sample rate、base/output latency、propagation責任有欄位；native HRTF／limiter latency仍為 null。這些欄位不能相加成已校準的耳朵延遲。

## 4. gain／shape／delay／direction 四種更新責任

| 維度 | 主要基準實作 | 已有保護與剩餘成本 | PROPOSED 研究界線 |
| --- | --- | --- | --- |
| scalar pressure gain | `band-filter.ts` L335–342 取最大gain作scale，normalized response作shape；uniform回null；`routes.ts` L126–133平滑path gain | scalar-only改動不重新upload相同Float32 target IR；nonuniform仍改JSON key、查kernel cache並copy結果；uniform則在input snapshot／validation後回null，不查response cache或copy kernel。gain與shape共用crossfade admission gate | 分離exact normalized-shape判斷與scalar ramp；保持raw solver真值、pressure語義、零gain及group delay，不把gain epsilon當材質量測誤差 |
| spectral shape | `routes.ts` L93–133 使用雙Convolver與20ms bank fade，`normalize=false`；`band-filter.ts` L317–401產生129tap預設FIR | exact Float32 equality保留細微差異；轉換／native buffer assignment仍有成本。第二次更新若在crossfade中會延後到之後的frame，route沒有獨立pending-latest timer | 量shape churn、cache命中、upload成本、latest-target age；避免每次純gain變動都做copy／IR工作，但不預先承諾重寫DSP |
| propagation delay | `routes.ts` L87–90，0..5秒、既有path用30ms ramp | 不重建stable route；可變delay會改變讀取速率。uniform與nonuniform FIR切換有額外group-delay差異 | continuous motion、teleport、path birth/death分測；延遲／Doppler與filter group delay分欄，不用增加lookahead掩蓋或重複計入d/c |
| arrival direction／listener pose | `routes.ts` L91–92、L137–147，`listenerPosition + arrivalDirection`；rolloff=0；engine L1212–1237更新listener與所有active routes | HRTF方向來自最後一段路徑；主基準即使target不變也送ramp，會產生control messages；沒有因此量得native HRTF CPU | frame-level listener coalescing及target suppression需與R21現況比較；只抑制冗餘control，不改求解方向或把原source位置當反射方向 |

R21已做target cache／deadband及50ms product ramps，最後修補已取消future continuous automation。本研究只提出獨立量測與exact shape／gain責任拆解；不再提出相同preset／smoothTarget補丁。deadband會影響rendered trajectory，應與raw path資料分開保存，不能直接稱科學精度不變。

## 5. allocation、cache 與 native 資源生命週期

| 位置 | 現行行為 | 應量而不能假設的成本 |
| --- | --- | --- |
| `engine.ts` L1048–1077 | validation後structuredClone(frame)，逐source套用active voices | 控制緒clone／validation／GC、每frame bytes；不是callback無allocation證明 |
| `engine.ts` L1080–1187 | activeSourceIds、totalPaths、排序／slice／Set每次建立；late另排序最早path | p95/p99 consumer wall time、allocation rate、路徑選擇／資源計數成本；不要把wall time稱CPU |
| `routes.ts` L48–69、L109–123 | 每route一Delay、一path Gain、一Panner、兩Convolver及兩bank Gain，共7 nodes；uniform路徑仍經identity convolution nodes；IR換shape才createBuffer／assign | connected／retiring nodes、每秒connect/disconnect與buffer set、native內部重建時間／memory；7是程式建立數，不是7倍固定CPU |
| `routes.ts` L94–99、L113–123 | fading bank只在之後另一個獲准的kernel-key變更內disconnect；shape swap後若key不變，舊bank可在gain=0時繼續connected，buffer也仍被引用 | 區分connected／audible／實際actively processing。不能由零gain連線推斷必然雙倍DSP；AGD-03量bank清理時機、buffer保留與native行為 |
| `band-filter.ts` L14–51、L124–145、L317–401 | 2048點transform；最多8 layout plans與8 prefix entries；response最多512且key+Float32 payload最多1MiB；共享scratch固定大小、reentrant用private workspace | warm/cold/layout-churn/response-churn分測；命中仍copyKernel及建立input/normalized arrays；Map/object與native buffers不包含在1MiB payload數字內 |
| `assets.ts` L109–123、L145–185 | PCM bytes、16MiB encoded input、WAVE預檢、重採樣reservation、decode concurrency先檢查；decoded AudioBuffer重用 | 來源bytes copy、hash／decode完成時間、decoder原生resident peak、同時持有來源／解碼PCM；PCM cap不是process heap cap |
| `late-reverb.ts` L67–129 | synthetic mono IR同步產生；最多雙bank＋一pending settings；先30ms prime再20ms fade | IR生成main-thread時間、兩bank並行成本、新IR生成瞬間舊buffer仍存的peak、native convolution state；不是只有PCM長度 |
| `engine.ts` L1190–1211、L1288–1329 | audio-clock fade／tail deadline，用bounded polling timers等currentTime，再disconnect | blocked main thread可能延後釋放，使retiring資源維持較久、增加admission拒絕；須量timer lateness，不把暫時高水位直接稱memory leak |
| `late-reverb.ts` L138–157 | pause clearTail換新convolver nodes但保留IR buffers | interrupted boundary／restart churn；不宣稱保留舊濾波器內部state |
| `engine.ts` L1417–1470 | telemetry本身建立arrays／sets，assetCount呼叫list並copy descriptors | 高頻polling會改變測量負載；固定低頻採樣、記錄probe overhead並做無probe對照 |

default預算24voices、32sources、64cached frames、8paths/voice、96total paths、64MiBdecoded PCM、256pending、64assets、2decode jobs、16late sends、4MiB late IR（[control](../../src/audio/control.ts) L3–17）。hard maxima64voices／32paths per voice／256total是輸入上界；不是已測容量。totalPaths包含active、retiring及retired routes，late routes也計算；不可用activeVoices×8推斷資源全貌。5秒DelayNode最大值也不能直接推出各browser實際resident bytes。

## 6. voices、排程與 virtualization

[logical admission](../../src/audio-behavior/voice-admission.ts) L14–46依priority及stable IDs排序，所有非stopped instances（含fade）計數，明示reject；[runtime](../../src/app/runtime.ts) L397–398設16logical／每object8，standalone evaluator預設32。native [engine](../../src/audio/engine.ts) L743–808另驗asset/reference、pending/source／retiring budgets，必要時fade/steal較低priority native voice。logical／native／solver三個結果必須分開，不能只看一個voice count。

sample每次native start建立新AudioBufferSourceNode（L830），重用decoded AudioBuffer；continuous loop在同一instance期間不因抓取或碰撞重建。聲源自然結束／被停／steal之後保留route tail再cleanup。沒有實作「維持邏輯時間但暫停昂貴聲學渲染、可恢復phase」的virtual voice系統。pool應重用asset、DTO或管理槽，不能把已start的AudioBufferSourceNode再start，見 [MDN lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode)。

**PROPOSED AGD-05**只在profile證明voice/route cost為瓶頸後研究virtualization：明定何時由rendered轉virtual、hysteresis、resume offset與propagation history、最大virtual slots及native admission ledger；不同emitter不能先混到COM。Raw監聽、interaction觸發、錄製／A/B、stem emission selection和priority競爭都可能受影響；virtualization不能刪physics事件、重算已錄的logical decisions或假裝被省略的paths已求解。方案先報actual降級，再用固定trace比較，不能藉此降低原正式profile負載來宣告通過。

## 7. click／pop／斷續的完整調查矩陣

本表為可判別的調查清單，不是診斷結果。除已明示的code／既有收據外，cause均為**HYPOTHESIS／待量測**；「緩解」為PROPOSED，並不表示本輪已修。每個實驗應保留negative result，先做最小單變因fixture，再回到完整產品負載。

| ID／症狀 | 候選原因與程式位置 | 現有證據／限制 | 診斷方法 | 候選緩解 | 副作用與後續工作 |
| --- | --- | --- | --- | --- | --- |
| C01 continuous聲音有整段gap | native graph／device未及供應；engine native鏈 | 早期R21 playbackStats有非零觀測；不是最後修補／本機耳朵證據 | same context start/end stats delta＋known continuous PCM＋quiet-machine graph-only對照 | 依profile降低render／graph更新成本，或明示較高device latency | latency增加；native counters不能定位單一node。AGD-01/06 |
| C02 impact起音晚／一群補播 | control晚到，engine L778、L862 | lateEvents確實計時差；不測sample underrun | emission tick、intended onset、actual start、首次frame可用時間逐事件對齊 | 評估R21 onset horizon／admission策略 | onset固定偏移、超horizon仍晚；不重寫event timestamp。AGD-01/04 |
| C03 新聲源等不到聲學frame | runtime L1048整批stale拒絕，pendingAudio L1054 | 主基準code支持等待路徑；R21已有per-source/cache修補 | frame age分布、pending wait、revision/epoch拒絕理由；不混入output counters | 驗R21有效cache與freshness界線 | 舊pose approximation須明示；禁止假路徑。AGD-01/04 |
| C04 靜止時仍大量automation／卡頓 | unchanged listener/path/content target仍smooth；control L51、routes L87/137 | R21 regression probe記43→12283events；是受控regression probe，非音訊deadline | 每param target與events/s、control time、no-probe對照 | 比較R21 target suppression／frame coalescing | deadband／response延遲；不能量化後改solver真值。AGD-01/02 |
| C05 gain接點click／fade提早開始 | ramp anchor／cancel hold或fallback，control L51–62 | README保留過去native anchor缺陷及修正；不是當前再次失敗 | fractional-currentTime下native constant/sine，抓每sample discontinuity及ramp | 在固定oracle下核實hold/anchor與fallback | target cache不能取代實際interpolated起點。AGD-04 |
| C06 音量跟隨忽快忽慢 | scalar和shape共用20msgate，routes L93/126 | code存在gate；未量聽感／丟掉的最後target | 快速scalar-only階躍，記last requested/applied age與PCM | exact shape不變時獨立scale ramp | 改動rendered軌跡；需保留原能量／arrival驗收。AGD-02/04 |
| C07 換材質時click／phase梳狀 | FIR bank交接／state priming／相關訊號 | 雙bank及exact-target reuse已有；不保證任意IR切換無縫 | A→B→A、低/高頻sine與impulse，crossfade中再更新 | 明示latest-target與bank reuse時限、核對alignment | 兩bank並行CPU、crossfade染色／lag。AGD-03/04 |
| C08 uniform↔nonuniform時transient | FIR group delay從0到64/fs（129taps），routes L105–107 | 確有不同group delay；是否可聽未量 | 同scale、只改shape，量arrival／phase／局部峰值 | 比較有明示time-origin的bank對齊候選 | 補償會改latency／phase；不可偷偷移除物理delay。AGD-02/04 |
| C09 移動時pitch glide／嘯叫感 | delay ramp改讀取速度，routes L87–90 | quasi-static L/c及30msramp是近似；不是精確retarded-time renderer | known-speed sine、頻譜／delay slope，與停止移動對照 | 分離continuous delay與teleport政策 | smoothing有lag，crossfade有comb；勿double Doppler。AGD-04/06 |
| C10 teleport／seek後啪聲 | 距離大跳、history不足／新epoch | pause/seek不保留完整native state | 最大合法delay跳變、epoch切換、history不足負例 | 明示fade／reset／bounded state切換 | intentional短暫中斷；不承諾瞬移物理連續。AGD-04 |
| C11 反射進出／rank交換時閃爍聲 | visibility／ranking／budget造成route churn，engine L1103–1187 | stable path IDs已有；birth/death仍會新建／退休 | 同topology跨visibility邊界，追id、admission、retired paths | renderer hysteresis／hold候選＋raw truth分離 | 多保留route增資源；不可捏造solver paths。AGD-03/04 |
| C12 轉頭／跨listener位置click | arrival direction與listener automation更新不同步 | HRTF位置=listener+arrival，關閉rolloff；HRTF內部行為未量 | 固定世界source、pure rotation/translation分開，錄兩耳PCM | 同frame一致listener/path target，驗R21 coalescing | lag會降低head-tracking感；不可改反射方向。AGD-02/04 |
| C13 loop縫／one-shot尾端click | asset端點不連續／零attack-release／截斷 | 可匯合法PCM不代表loop接縫連續 | dry/raw先測、sample首尾value/slope、loop crossing | 依asset意圖做有來源的loop/短fade處理 | 改content／duration；不要用reverb掩蓋。AGD-04 |
| C14 pitch改動／resume相位click | rate/frequency ramp與cursor／phase重建，engine L917–1044 | 有rateHistory上界512與phase重建；無全history保證 | pitch ramp pause/resume、nonzerooffset、極端合法pitch | 保留bounded state並核對cursor政策 | oscillator重建有harmonic上限，非原state逐sample延續。AGD-04 |
| C15 voice steal／stop／burst click | 最小1msvoice fade或大量tail後清理，engine L797、L1255 | native可steal；logical拒絕；timer延後可增加資源壓力 | voice burst到budget，記每次admission與fade後PCM | 有界fade／retiring預算／cleanup，不突然disconnect active聲音 | fade更長佔資源、增加拒絕。AGD-03/04/05 |
| C16 Pause/Resume後少尾／重複impact | Freeze-and-fade interrupted boundary／pending arrivals重建 | 正式README明示截late tail、latest參數approximation；已有native fixtures | event去重、cursor、未到達片段與tail分別驗 | 明示boundary；保留既有arrival與once-only政策 | 無縫state carry是額外功能，不能偷改目前語義。AGD-04 |
| C17 Raw/Simulated切換短暫染色 | 同source dry與delayed paths交叉混合 | 同emission／gain，但兩route時間／filter不同 | sustained sine、impulse與音樂分測；切換前後同playhead | 驗20msmonitor ramp；比較明示的監聽切換曲線 | 補償delay會改reference定義，不能偷偷對齊。AGD-04 |
| C18 reverb改seed/decay卡頓 | synchronous IR generation／雙bank／tail替換，late-reverb L94/138 | pending只一份已存在；PCM與native成本不同 | 固定長度/更新率，量buildwall、graphchurn、tail能量 | 先量生成搬離main或預備IR的效益 | 複製／跨context與memory peak；仍需alignment。AGD-01/03/06 |
| C19 大聲時破音似click | limiter非硬ceiling／WaveShaper非線性，output-safety.ts | R20已有產品ceiling；不代表SPL安全或無失真 | pre/post nonlinear tap、peak與spectrum；同monitor固定 | 正確headroom／明示saturation並保持保護 | 飽和／alias與mix非線性；stems不能假設相加等於master。AGD-04 |
| C20 preset/rebuild／asset替換後中斷 | context close/recreate、decode busy或失敗 | R21已有safe restart及refusal；不是連續硬體stream保證 | 成功/失敗/取消、paused、decode中、pending arrivals各測cleanup | 評估現有freeze/rebuild/recovery，不重寫一份 | device切換必有boundary；保留error cause與可復原狀態。AGD-03/04 |
| C21 import/generation時偶發卡頓 | hash/copy/FIR/IR工作及GC延後control | 有bounded inputs/cache；未有allocation cause attribution | separately標decode/copy/GC、wall/CPU可得性、禁在callback採樣log | 離線preparation／pool候選由profile選 | warmup／memory增加；bounded不等於低成本。AGD-01/03 |
| C22 只在某DAC／無線耳機出現 | OS/driver/device sample rate/buffering／其他程序 | 使用者路徑與音量UNKNOWN，不可補猜 | 同build換route；固定供電/OS/browser與實際rate/latency | 依裝置特性選hint與可觀察cap | hint不保證frame size；未測平台保持UNKNOWN。AGD-01/06 |
| C23 開probe／FPS腳本才斷續 | tap/graph instrumentation、blur/pause／腳本負載改變條件 | 舊no-tap dropout欄為null；fps樣本有pauseCalls | 有/無probe、editor/FPS分開，記script與pause時間線 | bounded低頻遙測、保留未instrumented對照 | 少probe會少PCM可觀測性；不能把null當零gap。AGD-01 |

## 8. 最小研究量測契約

1. 每次固定commit或dirty完整source manifest、bundle／lockfile／browser binary版本、實際host audio options、graph topology、context generation、sample rate、device route／OS／供電。dirty R21比較另存fullhash，不用`05d40fd`代指不同bytes。
2. 將「初次onset」、「已運行continuous」、「impact burst」、「path/shape churn」、「pause/rebuild」分成獨立scenario。每次保存wall/simulation/audio三個clock及pause/overrun/stale/admission時間線；不同simulated duration不直接算加速比。
3. 原生graph先測無probe、低頻counter、PCM tap三種instrumentation；存start/end累計native stats、context重建/reset界線。若用delta，必須同context、單調且有支援；unsupported/null保持UNKNOWN。不能把總累計直接當measurement window。
4. PCM gap判定需已知continuous reference、固定閾值／窗口與silence exclusion。合法無聲、聲源停播、fade、物理遮蔽與intentional pause不算同一種underrun；保留原PCM與判定設定，不用事後挑閾值達標。
5. control trace分欄記validated frame age、clone/consume wall time、native node與buffer-set數、automation events、cache hit/miss、route retirement／timer lateness。native內部CPU／memory若未可得就標unknown，不以JS elapsed代替。
6. 新增graph／automation修補的未來驗收包含真OfflineAudioContext PCM oracle（arrival、energy、continuity、phase、tail）與真browser長時間輸出；fake-context只證control requests。native API或PCM通過不能推出Worklet p99／耳機定位／SPL或整體V1完成。
7. 保留既有Firefox能量FAIL、WebKit API阻擋、R17正式性能FAIL與早期R21負面樣本。新measurements同門檻另存，不重寫舊結果或放寬fixture/tolerance。

## 9. 後續 backlog 與決策入口（全部 PROPOSED）

| 局部ID | 具體研究／未來實作邊界 | 必要證據與依賴 | 優先序候選 |
| --- | --- | --- | --- |
| AGD-01 | 對最終R21 source做可辨因的native連續性／control cost研究；核對舊artifacts階段，不重做presets | 第8節manifest、quiet/no-probe對照、各clock、stats delta、PCM及負面結果；先於backend選擇 | 高；先解決證據缺口 |
| AGD-02 | exact normalized shape／scalar gain／delay／direction責任拆解與target-age診斷 | 以R21現有suppression為起點；same-coefficient/scalar-only/zero/group-delay fixtures；保留raw truth | 高，需AGD-01確認收益 |
| AGD-03 | route/native buffer/crossfade/retirement/decode的完整資源budget | 計數與native resident unknown分開；suspended context／blocked cleanup／rapid IR負例 | 高；不可只加大voice cap |
| AGD-04 | C01–C23最小native fixtures與整鏈回歸；只對實際修補新增meaningful tests | 不改oracle；phase/tail/epoch/one-shot與continuous分開；長profile和聽測另列 | 高，與各修補綁定 |
| AGD-05 | 受控virtual voice設計與record/replay/admission語義 | 先證明資源瓶頸；bounded slots、hysteresis、phase/history、明示降級與same-trace比較 | 條件式中；不預設需要 |
| AGD-06 | native graph優化／worker preparation／bounded Worklet候選比較 | 同scope、sameinput/quality/headroom，actual block與latency、p99/underrun各自證據；不得等solver或network | 條件式中；profile後才決定 |

這些局部ID供總backlog映射，不自行建立第二套正式task或接受ADR。採用哪個backend及是否virtualize仍待資料；「DAW式平順」應轉成可重現的continuous／onset／control response／資源上限要求，不能直接翻譯成「加大buffer」或「全面改Worklet」。

## 10. 官方來源與適用範圍

存取日均為2026-11-01；只摘要API契約，不複製規範全文。source版本固定；新增或experimental能力仍需逐browser feature test。

| 來源 | 本頁使用的有限主張 |
| --- | --- |
| [W3C Web Audio 2021 Recommendation §1.5.3／§2.2–2.3](https://www.w3.org/TR/2021/REC-webaudio-20210617/) | control與rendering thread、非同步control messages、active processing與tail-time；不給本產品CPU／deadline保證 |
| [MDN AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode)及[start](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start) | source只能start一次，可重用AudioBuffer；過去的when立即開始，不能回到過去 |
| [MDN cancelAndHoldAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/cancelAndHoldAtTime) | 取消future automation並hold指定時刻；支援須檢查，不能以target取代ramp中值 |
| [MDN Convolver buffer](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode/buffer)及[normalize](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode/normalize) | buffer為IR；normalize預設true，false避免自動IR縮放；改normalize在下次buffer設定才生效 |
| [MDN AudioContext constructor](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext) | latencyHint為請求，不能當實際buffer/frame count或latency量測 |
| [W3C Web Audio 1.1 WD，2026-09-22，AudioPlaybackStats](https://www.w3.org/TR/2026/WD-webaudio-1.1-20260922/#AudioPlaybackStats)及[MDN AudioPlaybackStats](https://developer.mozilla.org/en-US/docs/Web/API/AudioPlaybackStats) | experimental/native playback path統計；underrun duration以秒、事件自context建立累計，低頻更新。不是per-node或Worklet execution time，也不替代人耳測試 |
| [Chrome Audio worklet design pattern，2018](https://developer.chrome.com/blog/audio-worklet-design-pattern) | ring僅處理block-size差異，不創造更多DSP執行時間；與當前產品是否值得採用是不同問題 |

網站存取失敗紀錄：MDN獨立`AudioContext/latencyHint`頁無法取得，改讀上述constructor官方頁；不假裝失敗頁已讀。沒有據此更新產品dependencies、provenance ledger或接受新架構。