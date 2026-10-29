# 音訊與動態聲學執行規格

2026-10-29：正式 src/audio/ 已有 native Web Audio SourceGraph；custom AudioWorklet 仍為研究／後續方案，未找到產品 processor 註冊路徑；原生 DSP 分項證據與目前未驗範圍見[聲學研究](../12-architecture-review/CUSTOM_ACOUSTIC_CORE_RESEARCH.md)。以下保留設計語義，不能據此宣稱 Worklet 完整 delivery／聽測或性能通過。RenderBackend 目前只有 types-only 契約，完整離線 mix／stems 尚未實作。理論見 research/theory/DSP_MODELS.md；穩定規範依據 [Web Audio 2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/)，1.1 Working Draft 新能力需逐引擎 feature test，不能當普遍支援。

## SourceGraph

連續 generator / buffer loop 與 collision one-shot → 各自 emission gain → direct delay/filter/spatialization；同一 emission signal 另送 early-path bank 與 late reverb bus → master headroom → limiter（明示會改峰值）→ output。連續 loop 不因抓取或無重力重建。Raw 為相同 asset/event/seed/playhead 的 dry-centered bypass（含環境與 HRTF bypass）；Simulated 使用 backend 支援的傳播與空間化。切換只改 monitoring，ramp 交叉淡入，相同 emission／gain，不暗中正規化或補償延遲。若另做 direct-only spatial reference，必須另命名。

Direct 與每條 early path 各有 delay、band filtering、gain、arrival direction。PannerNode HRTF 的 position 應表示到達方向；若自行套 1/r，將 Panner 距離 rolloff 關閉，避免雙重衰減。反射的 binaural 方向用最後一段入射方向，不能用原 source direction。late reverb 可先用原創合成 IR／FDN approximation，明示 model；不能把藝術化 RT 參數宣稱量測室內結果。

## 時鐘

在 user gesture 啟動 AudioContext 後建立 epoch `(simulationTimeS, audioContextTimeS)`。對發聲時刻 te，排程 `audioEpoch + (te - simEpoch) + absolutePropagationDelay`；pause／resume 重新錨定時鐘並遵守選定 tail policy。事件已遲到時只可記錄 late／丟棄／立即補播其中明示政策，不能回到過去排程。裝置 output latency、DSP block latency 與 d/c 物理延遲分開上報，AudioContext currentTime 不等於使用者實際耳朵時間。

Pause 初版政策為 Freeze-and-fade：凍結 logical tick、source offset 與事件 cursor，run bus 以 20 ms 設計目標淡出（尚未 DSP 驗證），截斷舊 reverb tail 並標 interrupted boundary；取消舊 audio epoch 的實際排程，但保留尚未到達的 logical arrivals。Resume 明確重新錨定 epoch，只重排這些尚未到達的 arrivals 一次，不再次 dispatch 已記錄的 impact emission／已聽事件。AudioContext 可保持運行供獨立 paused audition，audition 不進 experiment metrics。錄製／A/B 不丟 physics tick；效能超限暫停並記原因。

動態傳播精確模型使用 retarded emission time，快取 pose history；初版低速、逐更新 quasi-static d/c 只能標 approximate。若可變 delay 已產生 Doppler，不再額外乘 playbackRate；固定 delay＋獨立 pitch shift 亦只能標聽覺近似。快速移動與突變 delay 需 fractional delay／crossfade，不能跳接造成 click。

## Thread / continuity

audio callback 不 fetch、不 await、不讀檔、不做幾何、不寫無界 log、不持鎖等待其他 thread；pool voices 與 buffer，使用實際 sample block length。messages 帶 sequence，覆蓋過期 control frame；連續參數有 ramp；path birth/death 使用有限時間 fade，ranking swap 保留 identity。SharedArrayBuffer 是可選後續優化，先評估 COOP/COEP 對部署與資產的影響，不能當作必須可用。

IR 更新至少雙 bank crossfade，記憶體與運算翻倍須列預算；Convolver normalization 預設行為需檢查，物理 gain 測試關閉自動 normalization。不可把 FIR、IR、energy histogram 三者混為同一表示。實際 AudioWorklet underrun、browser HRTF、headphone 聽測、裝置延遲與 V2 音訊圖均 NOT RUN。

## 初版 scope

靜態房間／反射面，移動 emitter／listener。Dynamic rigid body 作聲源不代表它也成為 dynamic reflector；這兩項 capability 分開。動態遮蔽可後加，scene topology update 於 pause / explicit commit 生效。限制音效 voice／early paths 與 reverb send 的總預算；超限要降級並顯示 dropped voices，禁止靜默當作完整物理結果。

## Sound Behavior 接口（2026-10-27設計）

依[ADR-014](adr/014-sound-behavior-system.md)，Behavior只產生logical instance／generator與emitter意圖；所有3D內容進上述同一SourceGraph，不另外接master。AlwaysOn不因OnImpact或抓取而中斷；impact anchor由contact產生，不能一律COM。規則、材質音色與物理／傳播係數分開，資料與狀態見[行為架構](../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md)。

Pool重用decoded buffer與管理槽位；已停止AudioBufferSourceNode不能再start。continuous保持當次loop，新的one-shot要新source。不同emitter不能為節省節點先混到COM。所有距離／delay／HRTF／Doppler責任與本文件原clock政策相同，沒有新增第二份DSP規格。[固定Web Audio REC](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

規則數／voices／active emitters／paths／decode memory必須分別限制，依既有正式budget量測；schema硬上限不代表可用效能。此接口尚未實作，browser routing、loop continuity、click/pop、underrun與耳機測試仍NOT RUN。
