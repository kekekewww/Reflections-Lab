# 音訊與動態聲學執行規格

2026-11-02 更新：正式 src/audio/ 已有 native Web Audio SourceGraph；custom AudioWorklet 仍為研究／後續方案，未找到產品 processor 註冊路徑；原生 DSP 分項證據與目前未驗範圍見[聲學研究](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md)。以下保留設計語義，不能據此宣稱 Worklet 完整 delivery／聽測或性能通過。RenderBackend 已用真 native OfflineAudioContext 與同一 AudioEngine 實作有限短 take mix／stems；發聲區間最多30秒、context最多45秒、16份輸出，工作／輸出估算256／192 MiB，不是完整長錄製 renderer 或 browser 峰值保證。理論見 research/theory/DSP_MODELS.md；穩定規範依據 [Web Audio 2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/)，1.1 Working Draft 新能力需逐引擎 feature test，不能當普遍支援。

## SourceGraph

連續 generator / buffer loop 與 collision one-shot → 各自 emission gain → direct delay/filter/spatialization；同一 emission signal 另送 early-path bank 與 late reverb bus → master headroom → limiter（明示會改峰值）→ 產品輸出安全上限（-1 dBFS 以下線性，上限低於全刻度；2026-10-30 R18 審查後加入）→ output。連續 loop 不因抓取或無重力重建。Raw 為相同 asset/event/seed/playhead 的 dry-centered bypass（含環境與 HRTF bypass）；Simulated 使用 backend 支援的傳播與空間化。切換只改 monitoring，ramp 交叉淡入，相同 emission／gain，不暗中正規化或補償延遲。若另做 direct-only spatial reference，必須另命名。

Direct 與每條 early path 各有 delay、band filtering、gain、arrival direction。PannerNode HRTF 的 position 應表示到達方向；若自行套 1/r，將 Panner 距離 rolloff 關閉，避免雙重衰減。反射的 binaural 方向用最後一段入射方向，不能用原 source direction。late reverb 可先用原創合成 IR／FDN approximation，明示 model；不能把藝術化 RT 參數宣稱量測室內結果。

## 時鐘

在 user gesture 啟動 AudioContext 後建立 epoch `(simulationTimeS, audioContextTimeS)`。對發聲時刻 te，排程 `audioEpoch + (te - simEpoch) + absolutePropagationDelay`；pause／resume 重新錨定時鐘並遵守選定 tail policy。事件已遲到時只可記錄 late／丟棄／立即補播其中明示政策，不能回到過去排程。裝置 output latency、DSP block latency 與 d/c 物理延遲分開上報，AudioContext currentTime 不等於使用者實際耳朵時間。

Pause 初版政策為 Freeze-and-fade：凍結 logical tick、source offset 與事件 cursor，run bus 以 20 ms 設計目標淡出（尚未 DSP 驗證），截斷舊 reverb tail 並標 interrupted boundary；取消舊 audio epoch 的實際排程，但保留尚未到達的 logical arrivals。Resume 明確重新錨定 epoch，只重排這些尚未到達的 arrivals 一次，不再次 dispatch 已記錄的 impact emission／已聽事件。AudioContext 可保持運行供獨立 paused audition，audition 不進 experiment metrics。錄製／A/B 不丟 physics tick；效能超限暫停並記原因。

動態傳播精確模型使用 retarded emission time，快取 pose history；初版低速、逐更新 quasi-static d/c 只能標 approximate。若可變 delay 已產生 Doppler，不再額外乘 playbackRate；固定 delay＋獨立 pitch shift 亦只能標聽覺近似。快速移動與突變 delay 需 fractional delay／crossfade，不能跳接造成 click。

## Thread / continuity

audio callback 不 fetch、不 await、不讀檔、不做幾何、不寫無界 log、不持鎖等待其他 thread；pool voices 與 buffer，使用實際 sample block length。messages 帶 sequence，覆蓋過期 control frame；連續參數有 ramp；path birth/death 使用有限時間 fade，ranking swap 保留 identity。SharedArrayBuffer 是可選後續優化，先評估 COOP/COEP 對部署與資產的影響，不能當作必須可用。

IR 更新至少雙 bank crossfade，記憶體與運算翻倍須列預算；Convolver normalization 預設行為需檢查，物理 gain 測試關閉自動 normalization。不可把 FIR、IR、energy histogram 三者混為同一表示。實際 AudioWorklet underrun、browser HRTF、headphone 聽測、裝置延遲與 V2 音訊圖均 NOT RUN。

## 初版 scope

箱體、球體與膠囊可作有限一階反射／遮擋；dynamicReflector 依當前真 pose 作準靜態求解，移動 emitter／listener 同樣受模型限制。Dynamic 剛體作聲源不會自動取得反射角色；非 Fixed 的 staticSurface 仍只遮擋。曲面不包含聚焦／caustics／curvature divergence，沒有 retarded-time 或移動邊界 Doppler，見[模型契約](../15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md)。scene topology update 仍由 pause／explicit commit 驗證。Behavior 邏輯 instances 與 native voice／early paths／reverb 的容量分開，超限要明示拒絕／抑制與原因，禁止靜默當作完整物理結果。

## Sound Behavior 接口（2026-10-27設計）

依[ADR-014](adr/014-sound-behavior-system.md)，Behavior只產生logical instance／generator與emitter意圖；所有3D內容進上述同一SourceGraph，不另外接master。AlwaysOn不因OnImpact或抓取而中斷；impact anchor由contact產生，不能一律COM。規則、材質音色與物理／傳播係數分開，資料與狀態見[行為架構](../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md)。

Pool重用decoded buffer與管理槽位；已停止AudioBufferSourceNode不能再start。continuous保持當次loop，新的one-shot要新source。不同emitter不能為節省節點先混到COM。所有距離／delay／HRTF／Doppler責任與本文件原clock政策相同，沒有新增第二份DSP規格。[固定Web Audio REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

以上為2026-10-27的設計語義；目前有限 evaluator、bridge、Inspector 與 native SourceGraph 已實作並共用傳播鏈，19種 trigger 按可信 Host producer 與有效 Zone registry 判定能力，不再是只有 draft validator 的階段。規則／邏輯 instances／native voices／emitters／paths／decode memory 分層限制；schema 上限不是可用效能。既有程式、有限 browser 與數位 WAV 收據見[核心交接](../14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md)，不能推成完整 routing／loop continuity、click/pop、underrun 或耳機驗收通過。custom AudioWorklet 仍未註冊。

## 有限離線輸出（2026-11-02）

Renderer 以錄製固定的聲音決策、pose／paths、素材與時窗驅動既有 AudioEngine，輸出雙聲道 float32 WAV 及含來源、設定、檔案 hash 的 manifest。Wet 為 master 前的 direct＋early＋Synthetic late，Dry 為傳播／空間化與 master 前的內容；同來源 pre-master stems 可在指定浮點容差內相加為 Wet。Master 包含既定 headroom／monitor／limiter 與安全圖，非線性後的各檔不可要求線性相加。control 依 native quantum 更新，沒有 sampleScheduledControls 承諾。

來源不足、取消、預算耗盡或 render 失敗時不發布部分新產物。native HRTF 身分為 browserManagedUnspecified；純 late tap、自訂 asset HRTF、listener replacement、長狀態 chunk／ADM／cloud 仍不支援。實際 UI 匯出與獨立 PCM 分析各有來源截點，後續原生 app 存取失敗不會改標成功；沒有真人聽感、600秒效能或完整校準聲學通過的推論。
