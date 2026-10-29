# 離線音訊渲染研究

日期：2026-10-29（Asia/Taipei）。基準：`c210ca882ca8503b322c28884bf1e9f6e9fe126d`。本頁區分官方文件查核、現有程式、既有實測及未實作計畫；不把 OfflineAudioContext 個別圖測試、研究 benchmark 或型別契約當完整錄製匯出產品。官方來源本輪存取日期均為 2026-10-29；僅索引與短摘要，未下載或再散布規格全文。

## 結論與最小演進

現有 `AudioEngineOptions.context: BaseAudioContext` 已容許注入即時或離線 context；`engine.isOffline()` 避開即時 context resume，原生 DSP 測試也已實際注入 OfflineAudioContext。因此沿用 SourceGraph 與模型，不另寫第二套聲音／傳播引擎。缺口是「完整 RecordingArtifact → 可核驗 PCM outputs」的排程、工作生命週期、輸出 taps／存儲與容量政策。

本輪僅增加 [render-contract.ts](../../src/audio/render-contract.ts) 的 types-only 工作介面（Category B／PLAN），不接任何 backend、不改 live routing、不啟用付費／雲端服務。錄製輸入／重播與新工作如何接合見 [Recording research](RECORDING_AND_REPLAY_RESEARCH.md)；原圖與 delay／gain 責任仍依 [AUDIO_RUNTIME](../02-architecture/AUDIO_RUNTIME.md)。

## 官方能力與版本（文件查核，非本輪瀏覽器實測）

| Claim ID | 已查事實 | 實作含義／限制 |
| --- | --- | --- |
| OFF-01 | [Web Audio 1.0 REC 2021](https://www.w3.org/TR/2021/REC-webaudio-20210617/#OfflineAudioContext) 定義固定長度、一次 `startRendering()`，輸出記憶體 AudioBuffer | 可作有界 one-shot 後端基準；不會從硬體錄音，也不保證比 realtime 快多少 |
| OFF-02 | [Web Audio 1.1 WD 2026-09-22](https://www.w3.org/TR/2026/WD-webaudio-1.1-20260922/#OfflineAudioContext) 新增 nullable length、`startRendering(chunkSize)`、close 與 renderSizeHint；文件仍為 Working Draft | 不能沿用「Web Audio 永遠不支援增量渲染」的舊結論；也不能把草案當跨瀏覽器既有能力 |
| OFF-03 | [Chromium main IDL](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/webaudio/offline_audio_context.idl) 的 chunk overload／close 標 `OfflineAudioContextIncrementalRendering` runtime feature；查得 blob `3002a96921cb83915c6930aace18fde131259053` | Source code 能證明該版本的門控，不能替代目標穩定版實測；需要單獨 incremental capability 與連續狀態 oracle |
| OFF-04 | [1.0 suspend 規範](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-offlineaudiocontext-suspend) 以 render quantum 向上量化，不能在同一量化位置重複 suspend；[MDN suspend](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/suspend) 卻寫向下 | 來源存在衝突。採固定 normative 版本並記實際 engine；不能把 suspend 當 sample-accurate 的通用控制點 |
| OFF-05 | [BaseAudioContext.audioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/audioWorklet) 提供自訂 audio processing；[process](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process) 要讀實際 channel array 長度；[currentFrame](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/currentFrame) 是區塊 sample-frame 時間 | API 架構可容納 offline Worklet，但安全來源、載入、目標引擎與組合仍需實測；不硬編每區塊 128 frames |
| OFF-06 | [AudioScheduledSourceNode.start](https://www.w3.org/TR/2021/REC-webaudio-20210617/#dom-audioscheduledsourcenode-start) 的 `when` 是 context 秒時基，規範要求保留精確排程時間 | 專案的 tick→sample 量化是一項明示政策；不能說所有原生 Web Audio event 本來都會向同一 sample 取整 |
| OFF-07 | [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) 是分聲道 Float32 PCM；[constructor](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/AudioBuffer) 可能因記憶體不足失敗 | 沒有可由此推得的通用最長分鐘數／固定 MB 上限；應有預算與實際拒絕路徑 |
| OFF-08 | [AudioNode tail-time](https://www.w3.org/TR/2021/REC-webaudio-20210617/#tail-time) 說明過去輸入仍可能影響之後輸出 | filter／delay／convolution 的狀態不能透過重建 context 自動延續；匯出窗要明確處理 history 與 tail |

[`MDN startRendering`](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering) 仍記無參數介面；這與較新的增量草案版本不同，不能混成同一相容性結論。額外 JS 參數可能被舊 API 忽略，單純呼叫 `startRendering(chunkSize)` 沒丟錯不是增量能力證明。

## 現有程式與實測邊界

| 現有項目 | 已有行為／證據 | 尚不能宣稱 |
| --- | --- | --- |
| [AudioEngine](../../src/audio/engine.ts)／[types](../../src/audio/types.ts) | 注入 BaseAudioContext；direct／early 路由、band filter、HRTF、late bus、headroom、monitor、limiter；sample cursors 與 pause／restore | 可直接將全部 replay frames 在 startRendering 前呼叫完就得到正確動態整場 render |
| [ReplayAudioHost](../../src/app/replay-audio.ts) | 按已錄 tick 套用 start／update／stop／listener，驗證 artifact／原內容／asset pins；seek 不重新發出過去 impact | API 目前為即時控制；updateVoice、updateListener、stopVoice 等以 context.currentTime 排程，尚無完整未來 sample-index control timeline |
| [native 測試](../../tests/audio-runtime/README.md) | 真 OfflineAudioContext 個別能量、到達、reverb、pause、連續性、restore 等 fixtures；[cross-engine 結果](../../tests/audio-runtime/CROSS_ENGINE.md) 保留 Firefox 數值 FAIL 與指定 WebKit build API 阻擋 | 全部引擎已通過、真人聽測／裝置 latency／Worklet underrun 或長時間 capacity 已通過 |
| [WAV preflight](../../src/audio/wav.ts) | 有界 RIFF/WAVE PCM／float32 **匯入**檢查與 decode 記憶體預估；壓縮格式／壞資料拒絕 | 已有 WAV 匯出 encoder；RIFF 寫入／大檔／dither／量化／stems 命名仍需獨立實作 |
| [recording worker](../../src/experiments/recording-worker-client.ts) | 將 trace 驗證與封存移到 Worker，保留 hash／bytes／錯誤 | Worker 本身提供 Web Audio 離線渲染、PCM streaming 或消除所有主執行緒長任務 |

最重要的實作風險是排程：在尚未 render、`currentTime = 0` 時逐一呼叫所有 frame 的即時 update API，不能假定它們自動套到各自的 tick。未來應先把 emission、gain／pitch／filter、source position／listener、path birth/death 和 IR 更新轉為有序控制 timeline；能預排的 AudioParams 按音訊時基預排，圖結構更新使用經驗證的 quantum 控制點或 sample-aware Worklet。原先音訊 callback 不等 geometry／AI／network 的規範繼續適用。

## RenderJob／RenderBackend 預留（PLAN）

`RenderJob` 是可序列化資料：引用原 recording 與完整 render configuration artifact（stable ID／SHA-256），帶 scene revision、要求的 backend ID／version／capabilities、有理數 tick→sample mapping、排他 tick window、preroll／tail、listener／HRTF、輸出選擇與 memory／output budgets。`RenderBackend.render(job)` 回傳完成或明確失敗／取消，`cancel(jobId)` 為冪等要求。完成回傳 actual backend／engine／capabilities、各輸出 hash／sample rate／frame count／peak／超單位範圍與 clipping 計數、historyIncomplete／tailTruncated。

每個輸出應核對 `requestId` 與所有 requests 一一對應；同一 sample rate／origin／長度／gain 設定；所有 refs、revision、material／assets、clock 及 bytes hash 都通過，最後才發布 completed。renderConfiguration 應固定 solver、聲速／atmosphere、geometry、素材 sample-rate conversion、profile revision、HRTF、IR 是否含 direct、normalization、headroom、limiter 參數及其他聲音 graph 設定。backend 不得把要求的能力當成已觀察能力。

輸出 sample 0 對應 `sample(startTick)`，長度固定為 `sample(endTickExclusive) − sample(startTick) + tailFrames`；preroll 與 backend quantum padding 必須裁掉。負 sample、無效 denominator、非整數 counters 或中間乘積溢位應拒絕，不能讓不同 backend 各自取整。`RenderArtifactRef.sha256` 核對存放 bytes；`recordingContentSha256` 另核對錄製自己的 canonical body hash。`jobSha256` 使用既有 canonical JSON／SHA-256 規則計算完整 RenderJob，並包含 source selection／tail／listener／HRTF／配置 refs。

工作身份及取消規則也是 PLAN：同一 backend scope 內，同 jobId＋同 job hash 回同一 terminal result；同 ID 不同內容回衝突，重試新工作使用新 ID。`cancel(jobId)` 冪等；取消在最後原子發布前接納則 cancelled，已完成且發布的結果維持不可變，後到取消不回頭刪成功。未知 ID 的取消不建立工作。cancel／完成競爭、重複呼叫、crash 復原與 exactly-once publication 仍需真正 host／backend 測試，現有型別不實作這些保證。

目前型別只允許 `float32Pcm` 與 `normalization:none`，刻意不建立未驗的 encoder 或 normalization 流程。型別未對不受信任 JSON 做 runtime 驗證，也沒有真 backend／validator／job registry。回傳的 artifact ref 只作 host storage 抽象，沒有授權上傳、外部網址或任何雲端服務。

## Window、尾音與 clipping

同一 emission 的 `absolutePropagationDelay` 只計一次；tail 需涵蓋最後發聲之後仍未到達的 direct／early paths、filter group delay、late IR／reverb 狀態與 fade。不能只取最後 source emission timestamp 截斷。有限 IR 可由已知支援長度界定尾段；IIR／某些 reverb 的理論尾段可能無限，採明確 threshold＋最大 frames 是數值／感知近似，記錄方法與截尾標記。沒有有效 decay 不輸出 RT60。

Preroll 與已錄 source cursor 解決不同問題：cursor 可還原 source playhead，不能通用還原先前的 filter／delay／convolver／native HRTF 隱藏狀態。中段錄製若無更早輸入或可驗證的 DSP snapshot，即使 source cursor 完整也需標 historyIncomplete，不能聲稱與從頭連續 render 完全相同。即時 seek 的「截舊尾音」也不等於離線剪輯的「保留自然尾音」。

Float32 PCM 可以包含大於 1 的有限值；`samplesOutsideUnitRange` 是超出單位範圍的樣本計數，不直接等於已削波。`clippedSampleCount` 應記真正發生的硬限幅／格式轉換 clipping。limiter／compressor 會改峰值與動態，需固定參數與處理位置；未校準 dBFS 不能轉成 dB SPL。音訊峰值、樣本數、NaN／Infinity、tail 與意外 silence 都需檢查，不能只以有檔案判成功。

最小型別將 clipping 量測位置限定在最後 `float32OutputConversion`，無法觀察時使用 unavailable＋reason；不得以 0 代替未知，也不由最終 PCM 猜測 opaque DSP 內部是否早已限幅。前述 peak／超單位範圍計數在交付前的同一輸出 PCM 量測，另以 pinned graph configuration 揭露 master nonlinear 處理。

## 聲源、dry／wet 與 stems

聲源選擇只篩原始已接受 emissions，保留全部 physics／geometry／Behavior admission，不讓省下的 voice budget 改變其他發聲。每個來源用 stable sourceId，包含物件上的多個 one-shot／continuous emitter。不同位置的聲源先各自處理 delay／bands／arrival direction，不先混到物件 COM。

每個 selection 使用 `independentGraphPerSelection`：先篩 emissions，再以同一 pinned 配置重建該輸出的完整音訊 graph；未選的信號不驅動這個輸出的 reverb／compressor。這是明訂的 isolated rendering，並非從原全混音的共用 nonlinear bus 中精確抽離貢獻；全 source／同 selection 的相容 taps 才能共用同一 graph execution，且不得改變語義。

| Tap | 契約語義 | 重建限制 |
| --- | --- | --- |
| `dryContent` | authored generator／sample、gain、pitch、envelope；無傳播、空間化、master | 不是 Raw monitor 的硬體輸出；保留共同 emission phase 與原 sample start offset |
| `direct`／`early` | 各自 solver path 的 delay、bands、到達方向空間化一次；master 前 | 不額外對 stem 再做距離衰減、第二份 d/c 或重複 HRTF |
| `late` | late bus 輸出，包含其明示 send path；本版合成 reverb 保持 Synthetic／perceptual approximation | 不能聲稱是牆面求解 RIR；共用 reverb 若非線性或有狀態調制，需要額外加總驗證 |
| `simulatedMix` | direct＋early＋late，master 前 | 若重疊窗／gains／相位或 tail 不同，分項加總仍可能失配 |
| `master` | 全部選定聲源混合後，經 pinned headroom／limiter／output gain | 各來源「獨立過 limiter 再相加」一般不等於「先混合再過共用 limiter」 |

不能把 `wet` 當沒有定義的單一值：這份最小契約分開 direct／early／late；若產品未來要提供 wet＝early＋late，另明訂組合與輸出 metadata。只有在路徑、處理與混音滿足線性／相同時間變化條件、採同一窗及相位、且共享狀態正確時，才驗證 stems 加總等於 pre-master mix。compressor／limiter／waveshaper／非線性 effects、改變 voice admission 或各 stem 獨立 normalization 都可能破壞此等式；不能把失配誤診成物理能量錯誤。

## 一次性、增量與重建分段

| 策略 | 記憶體／狀態 | 本案決策 |
| --- | --- | --- |
| 有界 one-shot OfflineAudioContext | 整段 PCM 留在記憶體，圖內狀態連續；開始前需資產及控制資料準備完成 | 第一個實作可行候選，NOT RUN；以 maxOutputFrames／working bytes 提前拒絕超量 |
| 同一 context 的原生 incremental render | 新 draft 有對應設計，但目標 engine 能力與同一圖跨 chunk 狀態須實測 | 保留 `statePreservingChunks` 能力；不能只因傳入 chunkSize 沒例外就接受 |
| 多個全新 context 各算一段 | 新 context 沒有上一段隱藏 delay／filter／IR／HRTF／limiter 狀態 | 不預設接縫等價。需可驗證 state transfer，或充足 history／overlap／裁切策略及誤差上限 |
| 即時 AudioContext／MediaRecorder 錄音 | 依 wall-clock、排程與編碼路徑運行；可能包含裝置／格式限制 | 是另一種 capture pipeline，不能代替可重現離線 PCM renderer |

離線渲染不應依賴 Worker／AI／網路按 realtime 速度送 frame。先完成資產 decode／hash／Worklet addModule 與所需控制 timeline，或使用有明確背壓與確認語義的增量協定；渲染過快導致控制訊息來不及到達是 correctness 問題，不是單純 performance 改善。

## 容量預算（解析估算，非裝置量測）

Float32 PCM 最低資料量為 `4 × channels × sampleRateHz × durationSeconds` bytes。48 kHz 雙聲道 60 秒為 23,040,000 bytes（約 21.97 MiB）；10 分鐘為 230,400,000 bytes（約 219.73 MiB）。這只是單份輸出 PCM 的解析大小，**不是瀏覽器可配置上限或峰值 working set 實測**。

另外加計同時保存的 stems、decoded assets、IR 雙 bank、延遲 buffers、Worklet／WASM heap、控制／trace、structured clone／AudioBuffer copy、編碼輸出與存儲 transaction。先算上限、限制 outputs／frames／bytes，再依真記憶體／quota 錯誤回 failed；不靠 try-catch 無界配置來發現極限。增量 API 也不會自動消除已解碼資產與圖狀態成本。傳統 RIFF／WAVE 大檔、RF64、24-bit／dither 等另列未來格式能力，本輪沒有實作。

## 未來驗證條件與本輪狀態

1. 檢查每個 backend 的真 API／rate／capability；不支援時明確拒絕。固定原 oracle，不因跨引擎差異放寬既有 FAIL。
2. 以 impulse、sine、step、loop／pitch mapping、late-capture、同 tick 多事件及移動 listener 驗 tick→sample 邊界、arrival、phase、update／stop；分開 sample accuracy 與 suspend quantum。
3. 用同一完整 scene／trace 取得 one-shot reference；比較完整 PCM、分段接縫、tail、dry／path taps、stems 加總及共用 nonlinear master 的預期非等價。
4. 檢查 asset missing／hash mismatch／revision／超預算／取消／crash／部分輸出失敗；不得發布 completed partial result，保留診斷與重試身份。
5. 量測峰值工作記憶體、長度、速度、bytes 與儲存失敗；聽測、裝置 latency、SPL、實際 Worklet underrun 另列，不由 PCM 算例推論。

本輪已做：既有程式／schema／tests 與官方文件盤點、最小純型別契約。新 renderer／encoder／listener override／HRTF asset adapter／stems／incremental chunk browser 測試均 **NOT RUN／尚未實作**。程式 typecheck／既有回歸結果以本次整合驗證收據為準，不把文件內容當測試執行紀錄。

本輪實際命令：Node `22.17.0`／npm `11.4.2`；`npm run typecheck` PASS；兩個 TS 檔的 Prettier check PASS。沒有為純型別介面新增照抄實作的測試，沒有新跑瀏覽器或音訊。獨立 read-only review 發現的輸出 window、選源後 bus 與 clipping availability 三項語義已補入契約；這不是 renderer 的 runtime 通過證據。
